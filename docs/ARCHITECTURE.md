# Architecture

This document is the reference for *how* the chip is wired: the two halves, the exact
contracts between them, the loading mechanics of the DSH profile layer, and what
happens when things fail. For the narrative and the traps already paid for, read
[`../MEMORY.md`](../MEMORY.md) first.

## 1. Two halves, one profile

```
DSH desktop / dsh web
└── profile (<DSH_HOME>/profiles/<desktop|web>)
    ├── cordis.patch.yml          ← one `insert` row, the only wiring
    └── plugins/token-balance/
        ├── package.json          ← name must match the client module id
        └── lib/
            ├── index.js          ← host half   (Cordis plugin, ESM)
            └── client.js         ← client half (browser bundle, CJS-in-factory)
```

The two files never import each other. They talk over exactly one HTTP route on the
harness webserver, which is already bound to loopback and already serves the GUI.

## 2. Request lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant UI as client.js (composer dock)
    participant Host as index.js (host plugin)
    participant Cred as .credentials.yaml
    participant API as api.deepseek.com

    Note over UI: mount → fetch() + setInterval(60 s)
    UI->>Host: GET /token-balance
    alt cache fresh (< 45 s)
        Host-->>UI: cached JSON (cached: true)
    else cache stale
        Host->>Cred: read file, match /sk-[A-Za-z0-9_-]{10,}/
        alt no key
            Host-->>UI: { ok: false, error: "no-api-key" }
        else key found
            Host->>API: GET /user/balance (Bearer key, 20 s timeout)
            alt 200
                API-->>Host: { is_available, balance_infos[] }
                Host->>Host: normalize rows, store cache
                Host-->>UI: { ok: true, at, available, balances[] }
            else non-200 / network / timeout
                Host-->>UI: { ok: false, error: "upstream-<status>" | "<message>" }
            end
        end
    end
    Note over UI: render chip; dot green / red / hollow
```

Concurrent callers share one upstream promise (`inflight` guard), so a burst of
refreshes still produces a single `api.deepseek.com` call.

## 3. Host contract

Route: `GET /token-balance` (default; overridable via plugin config `path`).
Cache TTL: 45 s (overridable via `ttlMs`). Upstream timeout: 20 s.

Success:

```json
{
  "ok": true,
  "at": 1792784049918,
  "available": true,
  "balances": [
    { "currency": "USD", "total": "2.24", "granted": "0.00", "toppedUp": "2.24" },
    { "currency": "CNY", "total": "23.93", "granted": "0.00", "toppedUp": "23.93" }
  ]
}
```

Failure (always HTTP 200 with a JSON body, so the UI can show the reason):

```json
{ "ok": false, "error": "no-api-key" }
{ "ok": false, "error": "upstream-429" }
{ "ok": false, "error": "fetch failed" }
```

Rules:

- Only `GET` and `HEAD`; everything else is `405`.
- `cache-control: no-store`, no CORS headers.
- Row order is **not** guaranteed. Consumers look currencies up by `currency`.
- The key never appears in a response, a log, or an error string.

## 4. Client contract

Registration:

```js
ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
  name: "conversation.composer.dock",
  id: "token-balance",
  order: 2
}, BalanceChip))
```

Slot props consumed:

| Prop | Use |
|---|---|
| `useProjection("tokenUsage")` | `uncachedInputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `outputTokens` — exact, provider-reported |
| `useProjection("modelSelection")` | `lastUsed.model` (fallback `pending.model`), defaults to `deepseek-flash` |

Derived values:

- `billedInput = uncached + cacheRead + cacheWrite`
- `cacheHit% = cacheRead / billedInput`
- `totalTokens = billedInput + output`
- `cost = Σ(tokens × price[tier]) / 1e6`, tier = peak ? 1 : 0 for the current UTC hour
- `¥ = cost × 7.2` — a labelled conversion, not a billing currency

Layout: the chip is an inline `<button>` in the dock. The popover is `position: fixed`,
placed from the chip's `getBoundingClientRect()` on open (`bottom = innerHeight -
rect.top + 6`), closed on outside pointerdown, `Escape`, resize, and scroll.

Styling comes from DSH theme variables (`--dsw-alias-*`, `--dsw-specific-menu`) with hex
fallbacks, so it follows the app theme. The panel paints an **opaque** base and then the
theme tint as a gradient: the menu token carries alpha, and the chip is rendered above
chat content that must not bleed through.

## 5. Loading mechanics

- `cordis.patch.yml` is watched by `dsh-hmr`; an `insert` row by relative path is a
  first-class plugin, no `node_modules` needed.
- Host modules are re-imported when the patch list is re-applied — editing the patch
  file (even a comment) reloads the host half.
- Client bundles are read at page load and **do not hot-swap**. Any `lib/client.js`
  change needs a window reload (`F5`). This is a product behaviour, not a bug.
- `package.json` must carry `"dsh": { "client": { "platform": "web", "inject": [] } }`
  and an `exports["./client"]` entry; the client module id must equal `"name"`.

## 6. Failure states

| State | Host | Chip | Popover |
|---|---|---|---|
| Loading | — | hollow dot, `···` | — |
| OK | `ok: true` | green dot, balance + spend | full breakdown |
| No key | `ok: false, no-api-key` | red dot, `—` | `ошибка: no-api-key` |
| Upstream error | `ok: false, upstream-<n>` | last good balance kept | `ошибка: upstream-<n>` |
| Network throw | `ok: false, "<message>"` | last good balance kept | `ошибка: <message>` |
| No usage yet | — | balance only | `нет данных по токенам` |

The popover's footer always shows either `обновлено в HH:MM:SS` or the error, plus a
manual `обновить` button.

## 7. Cost of the feature

- One upstream request per 45 s at most, per host process.
- One `fetch` per 60 s per open window (same cached answer, usually).
- No polling when no window is open.
- Client bundle is ~15 KB unminified; host module ~4 KB. No runtime dependencies.

## 8. Trust boundary

The route lives on the same loopback webserver as the GUI, so it inherits its access
model: a local process that can reach the port can read the same balance numbers. The
route exposes nothing beyond the balances — no key, no token history, no account data.
The API key is read from disk inside the host process and is used only for the outbound
`Authorization: Bearer` header.

## 9. File map

| File | Responsibility |
|---|---|
| `skill/assets/plugin/lib/index.js` | route, cache, key lookup, upstream call, error shapes |
| `skill/assets/plugin/lib/client.js` | CSS, formatting, price table, chip, popover, slot registration |
| `skill/assets/plugin/package.json` | DSH plugin manifest and client export |
| `skill/scripts/install.ps1` | copy plugin, patch `cordis.patch.yml` (backup), install skill |
| `skill/scripts/uninstall.ps1` | remove patch row, plugin directory, skill |
| `skill/SKILL.md` | agent runbook and troubleshooting table |
| `install.cmd` / `uninstall.cmd` | double-click wrappers that prefer `pwsh` |
