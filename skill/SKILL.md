---
name: dsh-token-balance
description: Install, update, or remove the DeepSeek balance and spend chip in the DeepSeek Harness chat panel — shows live CNY/USD balance and estimated session spend under the message box.
whenToUse: The user asks to see their DeepSeek balance or token spending inside the DSH GUI, or asks to install/update/remove the token-balance panel add-on.
---

# DeepSeek balance and spend chip for DSH

This bundle installs a local DeepSeek Harness plugin plus the skill that keeps it
maintainable. The result is one line under the chat composer:

`● ¥24.93 · $2.24 · потрачено ¥0.07 · <$0.01`

Balance is green, spend and tokens are muted; clicking the line opens a breakdown
(balance per currency, topped-up/bonus split, spend estimate, cache-hit ratio,
per-session token counts). It refreshes every 60 seconds.

## Install

Run the bundled installer from this skill directory:

```powershell
powershell -ExecutionPolicy Bypass -File "<this skill dir>/scripts/install.ps1"
```

`pwsh -ExecutionPolicy Bypass -File ...` works too when PowerShell 7 is installed;
the scripts are written for Windows PowerShell 5.1 as the lowest common version.

It does three things and is safe to re-run:

1. copies `assets/plugin/` to `<DSH_HOME>/profiles/<desktop|web>/plugins/token-balance`;
2. appends one marked `insert` row to that profile's `cordis.patch.yml` (timestamped backup written first);
3. copies this skill bundle to `<DSH_HOME>/skills/dsh-token-balance` so the assistant can install or remove it later.

Then tell the user to refresh the GUI with `F5`. Client bundles are read once at
page load, so an already-open page keeps rendering the old UI until reload.

Options: `-DshHome <path>` for a non-default harness root, `-Profile <name>` to
pick a profile explicitly, `-NoSkill` to skip step 3.

## Verify

1. `curl http://127.0.0.1:<port>/token-balance` returns
   `{"ok":true,"balances":[{"currency":"CNY",...}]}`.
   The port is the GUI URL port (`$env:DSH_WEB_URL`, usually printed by the app).
2. After the reload, the line appears under the message box; its dot is green
   when the last balance request succeeded and red when it failed.
3. The Plugins settings page lists `token-balance` as an active row.

## Remove

```powershell
powershell -ExecutionPolicy Bypass -File "<this skill dir>/scripts/uninstall.ps1"
```

Removes the insert row (backup kept), deletes the plugin directory, and deletes
this skill unless `-KeepSkill` is passed.

## How it works

- Host half (`assets/plugin/lib/index.js`) is a plain Cordis plugin: it registers
  `GET /token-balance` on `ctx.webServer`, caches the upstream answer for 45 s,
  and reads the DeepSeek API key from `<DSH_HOME>/.credentials.yaml`.
- Client half (`assets/plugin/lib/client.js`) is a hand-written browser bundle for
  `window.__ModuleLoader__` (no build step, no bundler): it registers a control in
  the `conversation.composer.dock` slot and reads the session's `tokenUsage`
  projection from the slot props.
- No core files, no `app.asar`, no `node_modules` are touched — only the profile's
  plugin directory and its patch file.

Spend is an estimate, not a bill: token counts are exact (provider-reported) but
prices come from a table in the client bundle — official DeepSeek list prices,
USD per 1M tokens, off-peak / peak: `deepseek-flash` 0.003/0.006 cache hit,
0.15/0.30 miss, 0.60/1.20 output; `deepseek-v4-pro` 0.022/0.044, 0.66/1.32,
1.98/3.96. Peak is 01:00–04:00 and 06:00–10:00 UTC on weekdays. The model comes
from the session's `modelSelection` projection. The ¥ figure is a 7.2 conversion,
not a second billing currency. Say so if the user compares it with the DeepSeek
billing page, and re-check the price page before "fixing" arithmetic.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| No line under the composer | Page not reloaded, or the profile patch row missing — re-check `cordis.patch.yml` and reload. |
| Dot is red, tooltip says `no-api-key` | No `sk-...` key in `<DSH_HOME>/.credentials.yaml`; sign in or add the key. |
| Balance shows `···` forever | Host process cannot reach `api.deepseek.com` (proxy/firewall). |
| Line shows only spend, no balance | The route is reachable but upstream returned a non-200; check the popover error text. |
| Numbers look stale | The chip caches upstream for 45 s and polls every 60 s; the popover has a manual refresh button. |
