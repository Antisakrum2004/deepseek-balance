# AGENTS.md

This repository is a DeepSeek Harness add-on: a profile plugin that renders the
DeepSeek balance and estimated session spend in the chat composer dock, plus the
skill that installs it.

- Read `MEMORY.md` before changing anything. It documents the DSH plugin/patch
  mechanics, the hand-written client bundle format, and the traps that already
  cost debugging time.
- `README.md` is user-facing: install/uninstall, what the chip shows, accuracy.
- `skill/SKILL.md` is the agent runbook that ships with the installer; keep its
  paths and commands in sync with `skill/scripts/*.ps1`.
- Plugin sources live only in `skill/assets/plugin/` — that bundle is the single
  source of truth and is copied into the DSH profile at install time.

Working rules:

- Never edit files under the DeepSeek Harness installation (`app.asar`,
  `resources\`), and never add packages to the profile's `node_modules`.
- After any change to `lib/client.js`, run the render check described in
  `MEMORY.md` §6; after any change to `lib/index.js`, verify
  `GET /token-balance` on the running host.
- A client-bundle change only reaches an open GUI after `F5`; say so instead of
  claiming the change is live.
