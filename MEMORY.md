# MEMORY — dsh-token-balance

Engineering memory for this project: what was built, why, which DSH internals had
to be reverse-engineered, and how to verify a change. Read this before editing the
plugin; the details below were learned the hard way and are not obvious from the
source.

Last updated: 2026-10-24. Verified against DeepSeek Harness Desktop 0.2.1-rc.2
(`%LOCALAPPDATA%\Programs\DeepSeek Harness`, Web GUI on `http://127.0.0.1:50556`).

---

## 1. What this is

A DSH profile plugin with two halves plus a companion skill:

- **host half** — a Cordis plugin that registers `GET /token-balance` on the
  harness webserver, reads the DeepSeek API key from `~/.dsh/.credentials.yaml`,
  calls `https://api.deepseek.com/user/balance`, caches the answer 45 s;
- **client half** — a hand-written browser bundle (`window.__ModuleLoader__`)
  that registers one control in the `conversation.composer.dock` slot and renders
  balance + estimated spend under the composer;
- **skill** — `skill/SKILL.md`, installed to `~/.dsh/skills/dsh-token-balance`,
  which tells a future agent how to install/verify/remove the thing.

Nothing patches the app bundle, `app.asar`, or any `node_modules`. The only writes
are `<profile>\plugins\token-balance\*`, one `insert` row in
`<profile>\cordis.patch.yml`, and the skill directory.

## 2. Why a plugin and not an app patch

The installed desktop app ships its runtime inside
`resources\app.asar` (182 MB, 18 309 entries). There is no source checkout on the
machine, so editing the app means unpacking/packing an asar — and every app update
would wipe it. The profile layer (`~/.dsh/profiles/<name>/`) is the supported
extension point: `cordis.patch.yml` is watched by `dsh-hmr` and applied live, and
a plugin can be inserted by path, so a local folder is a first-class plugin.

## 3. Runtime facts worth remembering

### 3.1 Patch file syntax (insert by path)

`cordis.patch.yml` is a YAML list of loader patches. To append a plugin:

```yaml
- insert:
    - id: token-balance
      name: ./plugins/token-balance/lib/index.js
```

- Paths in `insert` rows may be absolute, `file:` URLs, or `./`-relative; relative
  ones are anchored **beside the patch file** and converted to `file:` URLs at load.
- The package does **not** need to be in `node_modules`; Node resolves the file URL
  and `dsh-client-modules` finds the nearest `package.json` above it.
- An existing-entry patch replaces `config` **wholesale** (no deep merge); a patch
  that matches nothing prints a warning; an empty/comments-only patch file fails
  boot (use `[]`).
- **A host module is re-imported only when the patch list is re-applied.** Touch
  `cordis.patch.yml` (append and later remove a comment line) to reload host code.
  That trick was used repeatedly during development.

### 3.2 Client bundle format (no bundler needed)

A browser half is a plain script:

```js
window.__ModuleLoader__.load({
  id: "@local/dsh-token-balance",          // must equal package.json "name"
  factory: (require) => {
    var module = { exports: {} }; var exports = module.exports;
    const react = require("react");
    const { jsx, jsxs } = require("react/jsx-runtime");
    ...
    exports.apply = apply; exports.inject = inject;
    return module.exports;
  }
});
```

- `require` resolves only the platform seed table (react, react-dom, jsx-runtime,
  DSH client packages declared in `dsh.client.inject` / a baseline table).
- `package.json` needs `"dsh": { "client": { "platform": "web", "inject": [] } }`
  and an `exports["./client"]` entry pointing at `lib/client.js`.
- CSS is injected by the factory itself (a `<style data-plugin-css=...>` tag), as
  the shipped plugins do — module bodies run lazily at materialisation.

### 3.3 Client bundles do **not** hot-swap

Adding a *new* plugin row does mount live (the graph update arrives over SSE and a
new page mount loads it), but **editing an existing `client.js` does not** reach an
open window even though its mtime/size revision changed. Any client-side change
needs a page reload (F5). Host-side changes need a patch-file touch. Plan edits
accordingly: batch client edits, verify by render test, then have the user reload.

### 3.4 Slots

- The dock is `conversation.composer.dock` (`kind: list`, `scope: session`),
  already used by `ui-chat` for `activity` (order 0) and `usage` (order 1). Our row
  registers with `order: 2` and shows up to the right.
- Session-scoped slot entries receive `useProjection`, `sessionId`, `t`, … as props
  without an explicit `inject`; `useProjection("tokenUsage")` yields the exact
  provider-reported totals. Guard with `typeof useProjection === "function"` anyway.
- The header counterpart is `conversation.session.header.actions` (used by
  `ui-jobs`). The first iteration lived there; the dock was requested later because
  tokens are already displayed there, so the chip duplicates nothing.

### 3.5 Data available without any host work

`tokenUsage` projection totals: `uncachedInputTokens`, `outputTokens`,
`cacheReadTokens`, `cacheWriteTokens`. Also present: `contextPressure`,
`contextBreakdown`, `sessionStats` (turns/steps/ttft/llmMs/toolMs). The projection
cache file `~/.dsh/storages/session_projcache/sessions/<sessionId>.json` carries the
same numbers when a host-side consumer needs them.

### 3.6 Misc

- `GET /plugins/...` returns 404 for arbitrary URLs by design: only revisioned,
  advertised combo URLs are served, and the index/graph endpoints sit behind the
  browser session cookie. Do not use them for verification.
- `ctx.get("modules")` is `undefined` from a plugin inserted at the profile root —
  the client-module service lives in the web-app tree, a different isolate.
- `~/.dsh/profiles/node_modules/@deepseek-ai/*` are **dead junctions** pointing at
  a removed global npm install. Ignore them; the desktop app resolves its own
  packages from `app.asar`.

## 4. Decisions

| Decision | Why |
|---|---|
| Insert by path under the profile | no package manager, no registry, survives app updates |
| Hand-written client bundle | no esbuild/tsdown in the packaged app; the format is simple CJS |
| Dock instead of header | the dock already shows tokens/cache stats; the user asked for balance + spend next to them |
| Balance both CNY and USD | the API returns both; users top up in either |
| Spend = estimate from a price table | the API exposes no billing history; token counts are exact, prices are configured |
| Green for balance, muted for spend/tokens | requested; uses `--dsw-alias-state-success-primary` with a hex fallback |
| 45 s server cache, 60 s client poll | one upstream call per minute at most, no rate-limit risk |

## 5. Contracts

`GET /token-balance` (loopback only, GET/HEAD, no CORS headers):

```json
{ "ok": true, "at": 1792776229277, "available": true,
  "balances": [ { "currency": "CNY", "total": "24.93", "granted": "0.00", "toppedUp": "24.93" },
                { "currency": "USD", "total": "2.24",  "granted": "0.00", "toppedUp": "2.24" } ] }
```

Failure shapes: `{ "ok": false, "error": "no-api-key" | "upstream-<status>" | "<message>" }`.
Entries are not guaranteed in CNY-first order — the client looks currencies up by
`currency`, never by index.

## 6. Verification recipes

1. **Route**: `Invoke-WebRequest http://127.0.0.1:<port>/token-balance` → 200 JSON
   with the expected balance. Also proves the host half mounted.
2. **Client render** (offline, no GUI): run the bundle in a `vm` with a stub
   `window.__ModuleLoader__`, feed it real `react`/`react-dom/server`, call
   `exports.apply` with a stub `slots`, then `renderToString` the registered
   component. Two passes: default state (chip only) and a source-patched state with
   `payload`/`open`/`position` preseeded to exercise the popover. This caught a real
   missing `)` in the JSX builder chain — run it after every client edit.
3. **Is the chip alive?** Temporarily count hits inside the host handler and expose
   them (or write a temp file from a probe request); a mounted chip polls every 60 s.
   This is how the first live mount was confirmed. Remove the probe afterwards.
4. **Syntax**: `node --check skill/assets/plugin/lib/client.js`.

## 7. Pitfalls already paid for

- `jsxs("div", { ... })` — the closing `})` is easy to lose when children are a big
  array; the browser reports it as a syntax error at the *next* line, not the cause.
- Children arrays need keys; pass them as the third argument of `jsx`/`jsxs`.
- `<dt>/<dd>` inside a `<div>` wrapper inside `<dl>` is valid HTML5 here.
- `cash()` renders sub-cent amounts as `<$0.01`; `money()` alone would produce `$<0.01`.
- The dock only renders when `variant === "composer"` and a session exists.
- An empty `cordis.patch.yml` breaks boot — the installer writes the block directly
  when the file is missing.
- Patch edits made by a *user file* are judged at the next recomposition; that is
  what makes the live install work without restarting the app.
- **PowerShell precedence, cost one broken install**: inside `@(...)`, the comma
  binds tighter than `+`, so `$Marker + 'text',` appends the *rest of the array* to
  the string, space-joined. The whole YAML block became one comment line, YAML
  stayed valid, and the plugin silently never mounted (404). Always parenthesise:
  `($Marker + 'text')`.
- This machine has no `pwsh` (PowerShell 7); scripts must run under Windows
  PowerShell 5.1. Write files with `[System.IO.File]::WriteAllText` plus
  `UTF8Encoding($false)`: 5.1's `-Encoding utf8` emits a BOM, which is an
  unnecessary risk in front of a YAML list.
- The installed skill directory must be named after the SKILL.md `name`, not after
  the bundle folder (`skill/`), or `~/.dsh/skills/skill` shows up with a mismatched
  name. The installer parses the frontmatter for this.
- Verify installers by a **round trip** (uninstall → install): check that the patch
  tail is real lines, `GET /token-balance` returns 200, and
  `~/.dsh/skills/dsh-token-balance/SKILL.md` exists. The first version passed a
  "looks fine" eyeball and was still broken.
- `--dsw-specific-menu` carries **alpha**. Using it as the only `background` of the
  popover made the panel see-through, and the chat text behind it collided with the
  panel's own rows — it looked like broken layout, not like glass. The shipped fix
  paints an opaque base (`background-color: var(--dsw-alias-bg-base, #1b1b1d)`), lays
  the theme tint over it as a `linear-gradient`, and adds a `backdrop-filter` blur.
  Check any new surface for the same trap: a theme token is not guaranteed opaque.
- Screenshot tooling note: the desktop window can be larger than the display (it was
  `1619x1029` physical on a `1536x960` screen), so synthetic clicks on the composer
  dock miss it. Resize the window into the display first, and set DPI awareness in the
  helper process or `SetCursorPos`/`GetWindowRect` disagree by the 125 % scale factor.

## 8. Pricing used for the estimate

`skill/assets/plugin/lib/client.js` → `PRICES`, **USD per 1M tokens**, as
`[off-peak, peak]`. Source: <https://api-docs.deepseek.com/quick_start/pricing/>
(read 2026-10-23).

| model | cache hit | cache miss | output |
|---|---|---|---|
| `deepseek-flash` (V4.1-Flash-1017) | 0.003 / 0.006 | 0.15 / 0.30 | 0.60 / 1.20 |
| `deepseek-v4-pro` (V4-Pro-0813) | 0.022 / 0.044 | 0.66 / 1.32 | 1.98 / 3.96 |

Peak = 01:00–04:00 and 06:00–10:00 UTC, Mon–Fri, excluding Chinese public holidays;
every other hour is off-peak at exactly half. The model id comes from the session's
`modelSelection` projection (`lastUsed.model`), defaulting to `deepseek-flash`.

**Do not reuse the V3 prices.** The first version of this chip shipped
0.028 / 0.28 / 0.42 USD and 0.2 / 2 / 3 CNY — the old deepseek-chat list — which
over-charged cache reads by ~5–9× and made a 19M-token session look like ¥4.31
while the real balance had dropped ¥1.00. The user caught it; the correction was
verified arithmetically:

- session totals: 18 985 856 cache-read, 96 828 uncached, 107 807 output;
- Flash off-peak: 0.0570 + 0.0145 + 0.0647 = **$0.136** → ¥0.98 at 7.2;
- observed balance drop over the same window: 25.36 → 24.36 CNY = **¥1.00**.

That match is the acceptance test for the price table. Also note DeepSeek bills in
USD while the platform reports a CNY wallet too; the yuan figure here is a
conversion, labelled `≈` in the popover, not a second billing currency.

Small amounts keep extra digits (`moneyPrecise`): $0.14, $0.018, $0.0047 — recent
Flash sessions routinely cost under a cent, and rounding to "‹$0.01" hides real
signal.

## 9. Open ideas (not implemented)

- Optional per-day / per-session history table in the popover (projection cache has
  the data).
- Cost shown in the dock only when the user enables it (toggle in Settings).
- Read the price table from config instead of constants.
- Editor: a `web`-profile fallback path for `dsh web` CLI installs is implemented in
  the installer but has never been tested on a CLI-only box.
