# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-10-24

First public release.

### Added

- Composer-dock chip with the live DeepSeek balance in CNY and USD, plus an estimated
  session spend in USD.
- Click-through popover: balance split (topped-up / granted), spend in USD with a `≈ ¥`
  conversion, cache-hit ratio, uncached input, cache read, cache write, output, total
  tokens, last refresh time, manual refresh.
- Host half: `GET /token-balance` on the harness webserver, 45 s upstream cache,
  in-flight request deduplication, `no-api-key` / `upstream-<status>` error shapes.
- Peak / off-peak pricing for `deepseek-flash` and `deepseek-v4-pro`, selected from the
  session's model and the current UTC hour.
- Installer and uninstaller for the `desktop` and `web` profiles, with timestamped
  backups of `cordis.patch.yml` and idempotent re-runs.
- Companion skill so an agent can install, verify, or remove the chip later.
- English and Russian documentation with real screenshots.

### Fixed

- The popover background was translucent: the theme's menu token carries alpha and,
  without a backdrop filter, chat text bled through the panel. It now paints an opaque
  base colour, keeps the theme tint on top, and blurs the backdrop.
