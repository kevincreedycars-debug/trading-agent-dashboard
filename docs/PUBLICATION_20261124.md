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
blocked, the page read `12 steps - 9 of 10 artefacts read - 1 unavailable`, the readiness source
said `unavailable - the page could not read it`, and the outcomes step read `unknown` with
software complete and data/research unknown. Nothing was filled in or guessed.

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


## Post-release design tip (reviewed, deliberately not merged)

The design lane pushed `7ba4fc82` ("design: draw all four readiness dimensions, repeat links and the
published tally") after the reviewed tip `13e091d0` was integrated. It is based on `13e091d0`, not on
this release, and it rewrites the same manifest, reader and guard files. Merging it blind would have
overwritten the evidence bindings, so it is queued as a deliberate reconciliation rather than a merge.

What it contains:

- a fourth readiness dimension, `deployed` (software / deployed / data / research), with a
  `defaults.readiness.deployed` fallback for steps that run in the checkout;
- its own `fresh-call` step and `fresh`, `freshLive`, `tick` and `screen` sources, including a
  selector path syntax (`freshLive.calls[model=challenger].child_execution_id`) its reader supports;
- the same rail entry this release added, so the navigation half is already on `main`;
- challenger copy this release already rewrote in its own words.

What reconciling it needs, in one place:

1. One fresh-call step. This release binds `fresh-call-v1.json` (verdict, 8 cases, 27/110 probes) and
   `market-readiness-v1.json`; `7ba4fc82` binds `fresh-call-live-v1.json` for deployment evidence.
   Both are true and belong together - one step, two artefacts.
2. One source list with `verified_at`, and one readiness source. `7ba4fc82` would add `tick` and a
   lazy `screen`; the screen is ~18 MB, so lazy loading must be proved before it is added.
3. A decision on the fourth dimension. The browser guard, the readiness test and this contract all
   pin the three-dimension form; extending them to four is a design revision with its own checks.
4. Regenerating all fifteen pages from the partial after the rebase (the nav entry must not double).

Until that lands, the published page is the three-dimension form described above; the designer's
next branch should be rebased onto `4ba73ac7` so the two lanes stop diverging.

1. **Data distribution for XAG/WTI/GBP.** Direction stays blocked until the acquired one-hour rows
   are committed under licence or fetched by a documented step; no count moves off 4/1/8/11.
2. **L2L for those three markets.** No pre-session ladder and no bid/ask tape.
3. **Historical input availability.** Not established across the 725 mornings; the fresh-call proof
   does not claim it.
4. **WTI symbol mapping.** `WTICO_USD` versus `USOIL` remains unconfirmed in the matrix.

No trading workflow was activated, edited or executed by this publication.

## Post-publication updates, 2026-11-24

Two focused changes were published after this record was written, and neither was the designer's
queued tip.

**PR #36 (`34c62426`, design lane).** A 2px focus ring drawn inside the shared rail entry, so the
rail's own clipping cannot cut it away, and a 12px floor on every word in the block and on the
control-room page (chips, pips, badges, stamps, group headings, clocks). It adds two guards:
`backtester/tests/backtest_engine_v2.browser.test.js` (no word under 12px, ring visible inside the
control at 1440 and 390) and the same promises for the shared block in
`backtester/tests/site_nav_consistency.browser.test.js`. No number, label, route or anchor changed.

**PR #37 (`release/bev2-deployed-dim`).** Deployment verification is now its own readiness dimension
rather than a sentence inside `software`: the chip is the worst of `software`, `deployed`, `data` and
`research`, and `deployed` is complete only where `fresh-call-v1.json` names the parent workflow, the
pinned bundle and the child execution that answered. The seven steps that run in the checkout take
`defaults.readiness.deployed` (`inactive`, with the reason), so no step can borrow a deployment it
does not have. This answers the four reconciliation points above in one place - one fresh-call step,
one source list, one readiness source, and a decision on the fourth dimension - on top of `main`
rather than by merging `7ba4fc82`, whose manifest and guards the release has since moved past.

**Data work in the same release.** The readiness builder read `licence.status` from the acquisition
record, which carries `position` instead, so every held market published `licence: null`. It now
publishes the position ("the rows are a licensed quote history"); the artefact rebuilds to
`readiness_sha256` `d3e3778b434b452e5ffe0828b380fc63defa579a5d6a919859310d45b41cad16`. The new
`tests/h1_oanda_acquisition.test.js` binds the record to the readiness copy of it (rows, hashes,
endpoint coverage, licence), checks the Friday-endpoint rule in the record's own missing list, and
refuses a committed CSV. Published counts do not move: 4/1/8/11, with 7/1/8/8 still unpublished.

**Shared baseline.** `docs/dashboard-design/SHARED_BASELINE_20261124.md` is now the single record both
lanes read before their next edit: the commit, the four dimensions, the numbers and their non-claims,
the rules for the next design branch, and the open blockers.

**Verified live at `89b56339`.** GitHub Pages served the committed bytes, fetched cache-busted and
unauthenticated on 2026-11-24:

| Path | HTTP | Bytes | sha256 (first 16) |
| --- | --- | --- | --- |
| `backtest-engine-v2.html` | 200 | 21,356 | `290718c29f26795e` |
| `backtester/assets/backtest-engine-v2.manifest.json` | 200 | 48,239 | `7a45e63d75e91411` |
| `backtester/assets/backtest-engine-v2.js` | 200 | 35,446 | `8f8a448bd6c25462` |
| `backtester/assets/backtest-engine-v2.css` | 200 | 25,562 | `f6d806d36c336bbb` |
| `data/usd-layer1-backtester/market-readiness-v1.json` | 200 | 12,535 | `77ca8c4d0a497842` |

The same headless read recorded `12 steps - 10 of 10 artefacts read`, no console or page errors, the
dimension key `Sof / Dep / Dat / Res`, the fresh-call pips `complete / complete / complete / pending`,
all four readiness rows in its panel naming bundle `usd-l1-cloud-runtime-v3` and `Cloud execution
7260`, and `deployed:inactive` on the seven checkout steps.

