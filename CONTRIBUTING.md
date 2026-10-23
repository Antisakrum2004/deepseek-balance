# Contributing

Thanks for looking. This is a small, dependency-free add-on; the bar for a change is
"it works in a real DeepSeek Harness window and it is documented".

## Ground rules

1. **Never ship a secret.** No `sk-...` keys, no `.credentials.yaml`, no tokens in
   logs, screenshots, or issues. The plugin must keep returning balances only.
2. **Never patch the DSH installation.** Nothing under `app.asar`, `resources\`, or the
   profile's `node_modules` is a valid edit target. The profile plugin directory and one
   `cordis.patch.yml` row are the whole surface.
3. **Keep the two halves honest.** Token counts stay exact (provider-reported); money
   stays labelled as an estimate.
4. **`skill/assets/plugin/` is the single source of truth.** The installer copies from
   it; do not edit the copy inside `~/.dsh`.

## Before you open a PR

```powershell
node --check skill/assets/plugin/lib/index.js
node --check skill/assets/plugin/lib/client.js

# round trip on a disposable machine/profile
powershell -ExecutionPolicy Bypass -File .\skill\scripts\uninstall.ps1
powershell -ExecutionPolicy Bypass -File .\skill\scripts\install.ps1
Invoke-WebRequest http://127.0.0.1:<port>/token-balance
```

Then reload the GUI with `F5` and check:

- the chip appears under the composer with a green dot;
- clicking it opens the popover, nothing bleeds through the panel;
- the popover numbers match `tokenUsage` and the price table;
- uninstalling restores `cordis.patch.yml` (the backup is kept) and removes the chip.

Client bundles do **not** hot-swap: an edit to `lib/client.js` reaches an open window
only after `F5`. Host-side edits need the patch file to be re-applied (touch it).

## Style

- Plain ES modules on the host, plain CommonJS-in-a-factory on the client — no bundler,
  no new dependencies.
- Comments explain *why*, not *what*; the hard-won details belong in `MEMORY.md`.
- Keep the UI text in the user's language, as it is today (Russian in the chip).
- Screenshots go to `docs/images/` and must not contain keys or unrelated personal data.

## Documentation

`README.md` is user-facing, `README.ru.md` mirrors it, `MEMORY.md` is the engineering
log, `docs/ARCHITECTURE.md` is the contract reference, and `skill/SKILL.md` is the
agent runbook. If you change behaviour, all five may need a touch.
