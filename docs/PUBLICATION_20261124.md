# Publication record: Backtest Engine v2 control room (2026-11-24)

Published page: <https://kevincreedycars-debug.github.io/trading-agent-dashboard/backtest-engine-v2.html>

This record separates three states on purpose: what was **local** to the worktrees, what was
**merged** to `main`, and what the live site actually **served** at read-back.

## Merged revisions

| PR | Branch | Merged commit | Contents |
| --- | --- | --- | --- |
| #32 | `backtesting/usd-l1-fresh-call-20261124` (`4ad274e5`) | **`a591a245`** | the fresh-call proof record, capture 7260 (children 7261/7262), the H1 coverage wording and the screen's new document path |
| #33 | `release/backtest-engine-v2-20261124` (`5d64d233`, merge `84b96641` of `13e091d0`) | **`1250f6a5`** | the design lane's control room plus the fresh-call step, readiness artefact, sources panel, rail entry, contract and state-report replacement |

The design lane's own commit is `13e091d0`; it is the second parent of `84b96641` and is unchanged
in the published tree apart from the additions listed in
`docs/dashboard-design/BACKTEST_ENGINE_V2_HANDOFF_20261124.md`.

## What the live site served, and that it is the committed bytes

Read over HTTPS on 2026-11-24 after the merge, each fetched with `cache: no-store`:

| Path | HTTP | Bytes | sha256 (first 16) | Equal to the blob at `1250f6a5` |
| --- | --- | --- | --- | --- |
| `backtest-engine-v2.html` | 200 | 20,872 | `996e821f7b1e82ca` | yes |
| `backtester/assets/backtest-engine-v2.manifest.json` | 200 | 43,672 | `f3c64772f5d64432` | yes |
| `backtester/assets/backtest-engine-v2.js` | 200 | 32,824 | `e7e9bf4b563d4963` | yes |
| `data/usd-layer1-backtester/market-readiness-v1.json` | 200 | 12,430 | `9e9dd567b8016bec` | yes |
| `data/usd-layer1-backtester/n8n/fresh-call-v1.json` | 200 | 35,689 | `cfb64d5a2c858533` | yes |

The readiness artefact's own `readiness_sha256` is
`4b4d2aa7e5d80970e45b4da2e1975b58b8590afd47c3371eee7f15b2845ed34c`.

## The page read back in a real browser

A headless Chromium read of the published URL, at 1440x900, recorded:

- title `Backtesting Control Room - Backtest Engine v2`, status line
  `12 steps - 10 of 10 artefacts read`, footer `Evidence built 24 Nov 2026, 05:33 UTC - 10 of 10
  artefacts read`, no console or page errors, every artefact request HTTP 200.
- the rail's `Evidence` group heading, then `Backtest Engine v2` (a link to the page), then
  `Research Library`, `Backtesting`, `Backtest / Accuracy` - the entry is directly below Evidence,
  as asked, and is a link rather than a dashboard tab.
- the sources panel, each stamp read from its own artefact: `evidence` 24 Nov 2026 05:33 UTC,
  `retrieval`/`coverage`/`spec`/`readiness` 23 Nov 2026 22:10 UTC, `rules` 14 Nov 2026 00:00 UTC,
  `m5` 10 Nov 2026 20:57 UTC, `matrix` 23 Nov 2026 00:00 UTC, `freshcall` 24 Nov 2026 06:50 UTC,
  and `parity` `read - no timestamp published` (that file carries no timestamp).
- the `Fresh-call proof` step at `pending` (software complete, data complete, research pending),
  naming `7260`, `7261`, `7262`, `8 of 8 calls`, `27 of 110` probes and the sentence
  "does not establish contemporaneous availability across the 725 mornings".
- the `Outcome scoring` step at `pending`, showing 4 scored, 1 proxy-scored, 8 measured and
  11 blocked; `pending data distribution` for XAG/WTI/GBP; both `bid/ask 5-minute tape` and
  `pre-session level ladder`; `not established` for advantage; and the scratch run printed only as
  "unpublished research evidence, not live readiness".

The missing-evidence path was exercised rather than assumed: with `market-readiness-v1.json`

## Status source and update mechanism

- Statuses, pending items and links: `backtester/assets/backtest-engine-v2.manifest.json`, evaluated
  over the ten artefacts it names. Verification timestamps: each artefact's own field
  (`generated_at`, `frozen_on`, `created_at`, or none).
- Readiness refresh: `node scripts/build_backtesting_screen.js --write` ->
  `npm run build:usd-l1-market-readiness` -> `npm run check:usd-l1-market-readiness`. The page reads
  the artefact at open; no UI text is edited for a rebuild.
- Call-generation refresh: `npm run prove:usd-l1-fresh-call` -> `npm run check:usd-l1-fresh-call`.
- Full contract: `docs/dashboard-design/BACKTEST_ENGINE_V2_STATUS_CONTRACT.md`.
- Lane state: `npm run report:design-state` (replaces the absent `monitor-state.js`; the coordination
  mailbox tool cannot run on `main` because its registry is not committed there).

## Verification at the merged revision

| Command | Result |
| --- | --- |
| `npm run test:usd-l1-n8n` | 41/41 |
| `npm run check:usd-l1-fresh-call` | reproduces, 8 cases, 27 probes |
| `npm run check:usd-l1-market-readiness` | reproduces `4b4d2aa7...` |
| `npm run test:usd-l1-platform` | 56/56 |
| `npm run screen:backtesting:check` | reproduces `9591f0d7...` |
| control-room browser guard | 9/9 |
| shared-nav browser guard | 6/6 |
| shared-nav builder `--check` | 15 pages, 21 rail entries, 9 outbound, 0 changes |
| `tests/dashboard_globe_landmasses.browser.test.js` | 2 fail - same names at `origin/main` `a591a245` |
| `tests/backtesting_h1.browser.test.js` | 1 fail - same name at `origin/main` `a591a245` |

## Remaining blockers

1. **Data distribution for XAG/WTI/GBP.** Direction stays blocked until the acquired one-hour rows
   are committed under licence or fetched by a documented step; no count moves off 4/1/8/11.
2. **L2L for those three markets.** No pre-session ladder and no bid/ask tape.
3. **Historical input availability.** Not established across the 725 mornings; the fresh-call proof
   does not claim it.
4. **WTI symbol mapping.** `WTICO_USD` versus `USOIL` remains unconfirmed in the matrix.

No trading workflow was activated, edited or executed by this publication.

blocked, the page read `12 steps - 9 of 10 artefacts read - 1 unavailable`, the readiness source
said `unavailable - the page could not read it`, and the outcomes step read `unknown` with
software complete and data/research unknown. Nothing was filled in or guessed.
