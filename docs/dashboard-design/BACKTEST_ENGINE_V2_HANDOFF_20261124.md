# Handoff: Backtest Engine v2 integration - exact revisions, evidence and status mappings

From: coordinator lane (this checkout) to the design lane (`dashboard-design`, worktree
`.local/worktrees/backtest-engine-v2`). Written 2026-11-24.

The control room you built is integrated and published. This note is the revision to integrate
against and the evidence it now reads.

## Revisions

| What | Revision |
| --- | --- |
| Your branch | `design/backtest-engine-v2` at `13e091d0` ("design: add the Backtest Engine v2 control room and its evidence guards") |
| Fresh-call lane, merged first | `backtesting/usd-l1-fresh-call-20261124` at `4ad274e5`; **PR #32**; squash-merged to `main` as **`a591a245`** |
| Integration branch | `release/backtest-engine-v2-20261124`, merge commit `84b96641` (your `13e091d0` merged onto `a591a245`) |
| Integration PR | see the PR linked from this release; squash-merged to `main` as the release commit named in `docs/PUBLICATION_20261124.md` |

Nothing of yours was rewritten. Your commit is the second parent of the release; the coordinator's
changes sit on top of it and are listed in section 4.

## Evidence paths the page reads

| Evidence | Path | What it establishes |
| --- | --- | --- |
| Fresh-call proof | `data/usd-layer1-backtester/n8n/fresh-call-v1.json` | `verdict.status: recomputed_from_cutoff_inputs`, 8 cases, 8/8 calls, 4/4 scored, 27/110 probes, `blocking: []` |
| Live capture metadata | `data/usd-layer1-backtester/n8n/fresh-call-live-v1.json` | parent `89uk5JnPbWPL5lGD`, execution `7260`, children `7261`/`7262`, both models BULLISH / conviction 2 / `allowed` |
| Raw capture | `data/usd-layer1-backtester/n8n/execution-7260-fresh-call.json` | 23,471 bytes, sha256 `5b7147180f91...13e89e1` |
| Written proof | `docs/research/usd-session/v1/FRESH_CALL_PROOF_20261124.md` | the argument, field by field |
| Recompute / check | `scripts/prove_usd_l1_fresh_call.js` (`--write`, `--check`) | rebuilds the record from `run-v1.json` |
| Guard | `tests/usd_l1_fresh_call.test.js` | 7 assertions, inside `test:usd-l1-n8n` |
| Published readiness | `data/usd-layer1-backtester/market-readiness-v1.json` | 4 scored, 1 proxy-scored, 8 measured_tick_replay, 11 blocked over 24 cells |
| Readiness build / check | `scripts/build_usd_l1_market_readiness.js`, `npm run build:usd-l1-market-readiness` / `check:usd-l1-market-readiness` | copies the counts from the screen and fails if they disagree |
| Readiness guard | `tests/usd_l1_market_readiness.test.js` | pins the artefact to the screen and keeps the scratch counts out |
| Matrix (the source of the counts) | `data/usd-layer1-backtester/backtesting-screen-v1.json` -> `market_matrix.counts` | 8 markets x 3 tests = 24 cells |
| Acquired one-hour rows | `data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json` | XAG/WTI/GBP rows 17,149 / 17,139 / 18,026 and endpoint coverage |
| Status-update contract | `docs/dashboard-design/BACKTEST_ENGINE_V2_STATUS_CONTRACT.md` | the mapping and refresh rules in full |

## Status mappings the manifest now carries

| Claim | Manifest rule | State | Source |
| --- | --- | --- | --- |
| The child computes the call | `freshcall.verdict.status eq recomputed_from_cutoff_inputs` | `complete` | fresh-call proof |
| The proof rests on cases | `freshcall.totals.cases gt 0` | `complete` | fresh-call proof |
| The rules behind the call | `evidence.claims.model_logic.status eq not_established` | `pending` | n8n execution evidence |
| Historical availability | `evidence.claims.historical_availability.status eq not_established` | `unknown` (on `sources`) | n8n execution evidence |
| Published readiness has blocked cells | `readiness.published.counts.blocked gt 0` | `pending` | market readiness |
| No predictive advantage | `readiness.advantage.status` rendered as a claim | `not established` | market readiness |

Historical availability is deliberately a **different claim** from call generation. The fresh-call
proof says the child derives the call from the inputs it is handed; it does not say those inputs
were knowable at 05:00 London on each of the 725 mornings. That stays `not_established`.

The scratch result **7 scored / 1 proxy-scored / 8 measured / 8 blocked** is carried in the readiness
artefact under `unpublished_research` with `published: false`, and the page prints it only as
"unpublished research evidence, not live readiness".


## What changed on top of your commit

1. **Two new sources.** `freshcall` and `readiness`, ten in total; every source now declares
   `verified_at` (or `null` for `parity-v1.json`, which publishes no timestamp).
2. **A twelfth step.** `Fresh-call proof`, in the `proof` band after `Reproduction and parity`,
   with edges `controller -> freshcall -> evidence`. It shows 8 cases, 8/8 calls, 4/4 scored,
   27/110 probes, execution 7260 and children 7261/7262, its own three limitations, and
   `freshcall.not_claimed` as the open list.
3. **Readiness on `outcomes`.** Four counts read from the readiness artefact, a claims block with
   the three distribution-pending markets and the "not established" advantage row, and the scratch
   7/1/8/8 sentence labelled unpublished.
4. **The superseded wording removed.** Challenger v0 no longer says it merely "replays a stored
   call"; both challengers say the child recomputes and that reproduction is not correctness.
5. **A sources panel.** `#crSources` prints each artefact's own verification stamp (or that it has
   none, or that it could not be read). Links may now name a source (`{ "source": "freshcall" }`).
6. **The rail entry.** `Backtest Engine v2` is the first outbound entry under the `Evidence` group
   heading in both nav variants, so it is one click from every page without becoming a dashboard
   tab. The builder renders it into all fifteen pages.

## Checks run on the release tree (all exit 0)

| Command | Result |
| --- | --- |
| `npm run check:usd-l1-fresh-call` | reproduces (8 cases, 27 probes) |
| `npm run test:usd-l1-n8n` | 41/41 |
| `npm run check:usd-l1-market-readiness` | reproduces `4b4d2aa7...` |
| `npm run test:usd-l1-platform` | 48/48 + the readiness suite's 8 assertions |
| `node --test backtester/tests/backtest_engine_v2.browser.test.js` | 9/9 |
| `node --test backtester/tests/site_nav_consistency.browser.test.js` | 6/6 |
| `node backtester/scripts/build_shared_nav.js --check` | 15 pages, 21 rail entries, 9 outbound, 0 changes |

Two browser guards fail on this tree **and identically at `origin/main`** (`a591a245`), so they are
not this release's: `tests/dashboard_globe_landmasses.browser.test.js` (2 of 2) and
`tests/backtesting_h1.browser.test.js` (1 of 1). The baseline was run from a detached worktree at
`origin/main` and produced the same test names.

## Live read-back

After the release merged, the page was read over HTTPS at
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/backtest-engine-v2.html`:
the manifest and the ten sources answered 200, the rail carried `Backtest Engine v2` directly
under `Evidence`, the Fresh-call step named 7260/7261/7262, and the outcomes step showed
4 / 1 / 8 / 11 with the scratch run labelled unpublished. The byte counts, digests and the exact
wording read back are recorded with the release; `docs/PUBLICATION_20261124.md` carries the record.

## Remaining blockers (unchanged by this release)

1. **Data distribution for XAG/WTI/GBP.** Their direction cells stay blocked until the acquired
   one-hour rows are either committed under licence or fetched by a documented step. No count moves
   off 4/1/8/11 until that decision is made.
2. **L2L for those three markets.** No pre-session level ladder and no bid/ask 5-minute tape; both
   are named in the artefact and on the page.
3. **Historical input availability.** Not established across the 725 mornings; the fresh-call proof
   is not evidence for it.
4. **WTI symbol mapping.** `WTICO_USD` source series versus `USOIL` broker symbol is not claimed as
   confirmed; the matrix records `broker_symbol_confirmed: false`.
