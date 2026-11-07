# Feasibility audit: current USD model vs a 25-factor model, three outcomes, identical sessions

Read-only audit, 2026-11-07. Branch `research/usd-session-20261013`. Nothing was run against the live VPS
trader, the dispatcher, Supabase or any provider write endpoint; every number below was re-derived from
committed artefacts and the ignored `backtester/tmp/` CSV caches.

The question: on the *same* historical sessions, compare the current USD model against a 25-factor model on
three outcomes — (1) direction of the dollar index from 05:00 London to 05:00 London on the next local date,
(2) the original level-to-level (L2L) setup, (3) the half-distance L2L setup.

Short answer: outcome 1 has **zero** usable sessions because no intraday dollar-index series exists anywhere in
the repository; outcomes 2 and 3 have **648 Layer 2 / 827 Layer 1 dated sessions already computed**, but they
were measured on 1-hour candles over a New-York-keyed day, not over the 05:00 London session, and with no stops
and no costs. The "25-factor model" does not exist as a model: it is 25 research chains, one of which has a
single delivered report.

## 1. What is actually being compared

| Arm | Status | Where it lives | Reusable as a scoring arm today? |
| --- | --- | --- | --- |
| Current USD model | Deployed, 10 factors F1–F10 | `logic/agent_usd_direction.md`; deterministic replay `backtester/replay/usd/usd_replay_core.js` (`FACTOR_WEIGHTS`, plus the live export vector `LIVE_24H_FACTOR_WEIGHTS`) | **Partly.** Archived calls exist for 604 sessions, 2024-01-02 → 2026-04-30 (`data/backtester-checker-usd-24h-2024-01.json`, 6,040 stored factor entries), and replay parity was measured (`backtester/scripts/check_usd_live_replay_24h_parity.js`, `compare_usd_live_vs_replay.js`, `docs/review/usd-24h-ruleset-v1/usd_live_replay_comparison.json`). But every archived call answers *09:30 ET → next 16:00 ET*, 30.5 hours at the median, never the 05:00 London session. |
| "25-factor model" | **Does not exist** | `data/research-library/catalog.json` — 25 factor chains (10 deployed-factor audits + 15 session-research factors), each with research / red-team / adjudication stages; `usd-final-asset-analysis` is the gated final chain | **No.** Chain states: 1 `dispatched` (`live.f1-vix-level`), 24 `queued`. `data/research-library/documents.json` holds 42 documents, of which exactly one is a returned report (`usd-baseline-audit-01-vix-usd-report`). The final chain reads `0/25` and renders no stage. There are no weights, thresholds, verdict rules or code for any of the 15 new factors. |

Consequence: this is not a model-versus-model comparison yet. It is a comparison between one implemented
engine and a research programme. Before any session can be scored, someone has to decide and freeze what the
25-factor model *is* (which of the 25 enter, their weights, their thresholds, their missing-input rule and their
verdict-to-direction mapping), and that is a build item, not a reuse item.

## 2. The three outcomes, one row each

| # | Outcome | Sessions that exist today | Data in the repository | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Dollar-index direction, 05:00 London → 05:00 London next local date | **0** | No intraday dollar index of any kind. The live field `dxy_level` is FRED `DTWEXBGS` (H.10 broad nominal index, daily, released Mondays 16:15 ET, 1–2 business-day lag, revisable). The warehouse schema (`backtester/sql/002_usd_historical_market_snapshots.sql`, `003_generic_historical_warehouse.sql`) only ever names daily proxies. `docs/research/usd-session/v1/session_contract_v1.json` carries `outcome_instrument.verification_state: "UNVERIFIED"` with a null quote source, and `target_source_assessment.md` rules out a free intraday mirror outright. | **Rebuild or rename.** Either license ICE DX prints at both ends, or publish the label as the instrument that does have a source (the named fallback is `alt.eurusd-session-h1`, EUR/USD, explicitly not callable DXY). |
| 2 | Original L2L (dynamic level-to-level distance) | **648** Layer 2 dates / **827** Layer 1 dates, all 2024-01-03 → 2026-04-30 | `data/half-l2l-reach-research.json` (`half-l2l-reach-v2`, built 2026-08-10, 35 MB with `row_level`) already computes, per call, `adr20`, `currentStandardL2lDistance` (= ADR20 × 0.5), `halfL2lDistance` (= ADR20 × 0.25) and a FULL_STANDARD outcome. Its 1-hour ancestor is `data/adr-reach-research.json` ("L2L 1H Sequence Research", 2026-07-05). | **Reuse the outcome logic, rebuild the window.** The evaluator exists and is tested (`backtester/lib/half_l2l_reach_research.js`, `backtester/tests/half_l2l_reach_research.test.js`). The window does not: it is keyed by the source date and runs over the New-York day, not 05:00 London → 05:00 London. |
| 3 | Half L2L (0.5 × the level-to-level distance) | Same sessions as row 2 | Same artifact, `HALF_OF_STANDARD` mode in `outcomes` | **Same as row 2.** Half-target reach is already computed for every row; only the session window and the stop/cost layer are missing. |

Measured outcome counts inside those rows (both layers, `status: ELIGIBLE` only):

| Layer | Eligible rows | Unique evaluation dates | FULL hit / HALF hit | FULL miss / HALF hit | FULL miss / HALF miss |
| --- | --- | --- | --- | --- | --- |
| Layer 1 | 2,493 | 827 | 1,758 | 660 | 75 |
| Layer 2 | 1,592 | 648 | 1,151 | 398 | 43 |

Per instrument, Layer 1: EUR 570, GOLD 570, NQ 560, BTC 793. Per pair, Layer 2: EUR_USD 385, XAU_USD 448,
NQ_USD 372, BTC_USD 387. Dates carrying all four assets in both layers: **143** (2024-01-31 → 2026-04-22) — that
is the strictest like-for-like panel available without new data. `FULL hit / HALF miss` is impossible by
construction: any full-distance hit implies the half distance was touched first.

Excluded from those counts and worth naming: 151 Layer 1 and 807 Layer 2 rows `EXCLUDED` (non-directional or
missing signal), plus 20 and 265 `UNRESOLVED_MISSING_DATA`.

Reading note added 2026-11-07: the ADR20 × 0.5 distance in rows 2 and 3 is the **backtester's** research
definition, not the trader's. The working trader's L2L is a marked level ladder with a 5:1 stop (§8), and the two
must never be mixed into one table.

## 3. Session-window mismatch, measured

| Item | Current artefacts | The question asked |
| --- | --- | --- |
| Session anchor | source `snapshot_date`; 1H candles keyed by date; evaluation window 22:00/23:00Z → 21:00/23:00Z | 05:00 Europe/London on one local date → 05:00 Europe/London on the next |
| Number of hours | 24 × 1H candles per session | 24 nominal hours, ends resolved from declared London DST transitions (`backtester/lib/usd_session_engine_interface.js`, `usd-session-engine-interface-v2`, `resolveSession`) |
| Label instrument | EUR/USD, XAU/USD, NAS100, BTCUSDT | dollar index; not available |
| Overlap with the archived USD study | — | 14.5 nominal hours (15.5 in the two weeks New York changes first), 9.5 hours of the session never covered, median 16 hours of the study beyond the endpoint (`session_contract_v1.json` → `contract_vs_deployed_engine`) |

The good news, verified on the caches themselves: **every one of the 14,428 / 13,715 / 13,675 / 20,424 hourly
rows in the four caches sits exactly on the UTC hour** (0 off-grid timestamps in `oanda_eur_usd_h1.csv`). The
05:00 London instant therefore falls exactly on a candle open — `05:00Z` while London is on GMT, `04:00Z` while
on BST. A 05:00 → 05:00 London label is mechanically buildable for these four instruments with the data already
on disk. It is not buildable for the dollar index.

Cache coverage available for a re-keyed label: EUR_USD 604 sessions, XAU_USD 601, NAS100_USD 602, BTCUSDT 851
(BTC includes weekends), all ending 2026-04-30. Daily ADR20 history starts 2023-11-01, which satisfies the
20-bar warm-up for every evaluated date.

## 4. Worked verification session

Two sessions, one in each London offset regime, computed from the caches with the rule above (start = open of
the hour candle that opens at 05:00 London; end = the same rule on the next local date).

| Session start | London offset | Instrument | 05:00 London | 05:00 London next local date | Change |
| --- | --- | --- | --- | --- | --- |
| 2025-01-15 | GMT, 05:00Z | EUR/USD | 1.03023 | 1.02872 | −0.147% |
| 2025-01-15 | GMT, 05:00Z | XAU/USD | 2,675.595 | 2,697.330 | +0.812% |
| 2025-01-15 | GMT, 05:00Z | NAS100 | 20,811.6 | 21,255.8 | +2.134% |
| 2025-01-15 | GMT, 05:00Z | BTC/USDT | 97,189.71 | 99,610.00 | +2.490% |
| 2025-06-10 | BST, 04:00Z | EUR/USD | 1.14034 | 1.14164 | +0.114% |
| 2025-06-10 | BST, 04:00Z | XAU/USD | 3,307.635 | 3,339.395 | +0.960% |
| 2025-06-10 | BST, 04:00Z | NAS100 | 21,918.0 | 21,887.8 | −0.138% |
| 2025-06-10 | BST, 04:00Z | BTC/USDT | 109,568.03 | 109,722.95 | +0.141% |

Both sessions reproduce by hand from `backtester/tmp/oanda_eur_usd_h1.csv`, `oanda_xau_usd_h1.csv`,
`oanda_nas100_usd_h1.csv` and `binance_btcusdt_1h.csv`. There is no dollar-index row in this table because there
is no dollar-index column to read.

## 5. The reuse / rebuild / collect table

| Element | Reuse as-is | Rebuild | Collect (does not exist) |
| --- | --- | --- | --- |
| Session contract, two London instants, DST, as-of refusal | `backtester/lib/usd_session_engine_interface.js` (`resolveSession`, `assertAsOf`, `buildAsOfSnapshot`) — v2, already corrected to 05:00 → 05:00 | — | — |
| USD arm (10-factor engine) | Replay core, archived 604 calls, parity harness | Re-score the same calls on the 05:00 London label; the stored calls were never asked this question and must be labelled diagnostic-only | — |
| 25-factor arm | 25 briefs, 1 delivered report, chain states | Everything numeric: which factors enter, weights, thresholds, missing-input rule, direction mapping, and a replay for each | 24 unfinished research chains and their adjudications |
| Outcome 1 label (DXY direction) | — | Name and instrument decision | An intraday dollar-index print at both 05:00 London ends, with a statement of rights. Nothing free qualifies. |
| Outcomes 2 and 3 (L2L, 0.5 L2L) | Target-reach engine, ADR20 warm-up, half-target logic, HIT/MISS resolution, Wilson intervals, fold definitions | Re-key the evaluation window from the source date to the 05:00 London session; add an explicit expiry rule at the session endpoint | — |
| Stops | `STOP_FIRST_PESSIMISTIC` convention and stop multiples (0.25 / 0.5 ADR20) as a *draft contract* in `data/half-l2l-executable-entry-v1-draft.json`, status `DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION` | Implement it; it has never been executed. The reach research itself records `adverse_boundary_policy: "Not supported"` | Approved stop distance per asset |
| Costs | — | Wire spread, commission and slippage into the trade ledger | Every field is `null` in the draft; no bid/ask history anywhere; MT5-aligned quotes are still an open gate in `docs/BACKTESTING_REVIEW_PLAN.md` |
| Entry | — | Entry proxies today are 09:30 / 10:00 / 12:00 America/New_York (`half_l2l_executable_entry_draft.js`) | An entry rule at the 05:00 London cutoff |
| Candle granularity | 1H caches with hash lineage | — | 5-minute candles for all four instruments. Nothing finer than 1H is staged; an intraday-close trigger cannot be evaluated on the current files. |
| R-multiple language ("next full level at 5R", "0.5 distance at 3R") | **Corrected 2026-11-07 — see §8.** The rule, the level ladder and the 5:1 stop are live code: `lib/l2l_strategy.js` (`REWARD_R_MULTIPLE = 5`, `DEVIATION_TIMEFRAME = "M5"`), `lib/l2l_ladder.js`, `data/l2l-levels.json`, at `origin/main` `4faf3f35` | Nothing for 5R: it is already the deployed arithmetic. The 3R midpoint variant is one parameter (`options.rMultiple`) away but has no midpoint levels to target | Midpoint (`half-l2l`) levels for any pair; they are an allowed kind in `lib/l2l_levels_store.js` and zero are marked |
| Live Layer 2 semantics | — | — | Two different things, and the earlier note conflated them. The deployed Layer 2 agent emits only instrument, direction, confidence and reason (`exports/layer2_trade_selection_agent.json`, `backtester/lib/layer2_pair_logic.js`, `data/layer2.json`); the *trader* turns that direction into a ticket from the marked ladder (`scripts/run-live-trading-trader.js`, `lib/l2l_strategy.js`), which is the live behaviour to reproduce. The ADR20 × 0.5 distance is the backtester's own research definition, not the trader's risk unit. | — |

## 6. Which sessions can honestly be called unseen

From `docs/research/usd-session/v1/exposed_periods.md`, re-checked:

- 2024-01-02 → 2026-04-30 daily: burned for 24-hour questions. Development, validation and the nominal holdout
  (2025-11-03 → 2026-04-30) were all read on 2026-10-12.
- The L2L final-test fold 2025-10-01 → 2026-04-30 is consumed: `final_test_consumed: true` appears in
  `l2l-directional-discrimination-v1.json`, `l2l-directional-failure-diagnostics-v1.json` and
  `l2l-session-close-redesign-feasibility-v1.json`, and the executable-entry draft forbids selecting parameters
  on it.
- Genuinely unopened: the 05:00 → 05:00 London label itself, which no artefact has ever computed for any date,
  and any day after 2026-04-30, which the caches do not yet hold.

So the only clean design available today is: build the label on pre-2026-05-01 history, use it for mechanism and
pipeline work only, and hold the post-2026-04-30 days as the one independent confirmation set — while stating
that the DXY arm contributes nothing until an instrument with an intraday print is chosen.

## 7. Minimum build order

1. Decide the outcome-1 instrument and its rights; write the answer into `session_contract_v1.json`.
2. Re-key outcomes 2 and 3 to the 05:00 London session with an explicit endpoint expiry, reusing the existing
   target-reach engine unchanged.
3. Freeze the 25-factor arm's structure, or declare it unbuildable and compare only implemented engines.
4. Stage 5-minute candles and bid/ask if the executable version of the setup matters; until then every result
   stays `executable_trade_validated: false`.
5. Score all three outcomes on one identical session list and report coverage, decidable counts, uncertainty
   and the fold split against the frozen design.

## 8. The working trader's rule, traced read-only (2026-11-07)

Nothing on this branch contains the rule; it lives on `origin/main`. Neither `lib/l2l_strategy.js` nor
`data/l2l-levels.json` exists on `research/usd-session-20261013` or on the local `main` ref, which is behind
`origin/main`; they were read from the `main-poke` worktree of the same repository, checked out at `origin/main`
`4faf3f35`. No file was modified and no order path was touched.

| Object | Where | Identity |
| --- | --- | --- |
| Deployed trader run | `scripts/run-live-trading-trader.js` | file sha256 `b6422a720f1117274560c226e6aa690a0ad3d6132d8643cae0152d9751c13580`, git blob `f43ac5ea318fb5e8c87bf55a6a88b76cc1eb6958` = `origin/main` |
| Deployed trader state, 2026-11-07T15:26:30Z | `data/live-trading-trader.ftmo-1.json` | `armed: true`, `status: "nothing_to_place"`, 2 positions open, both ours, 300 s interval, host `vmi3697641`, checkout `runtime`; its recorded `code.sha256` equals the file hash above, so the code on the VPS is byte-identical to `origin/main` |
| The rule | `lib/l2l_strategy.js`, 705 lines | blob `338bb2f6e8ea7546bc93d1942ca595525280859d` |
| Ladder drawing | `lib/l2l_ladder.js` | blob `e4029a9c49ef1e6711ba4040304a84efd77e3fca` |
| Marked ladder | `data/l2l-levels.json`, generated 2026-10-04T16:14:19Z | blob `521d3a556117c4d0a207f6c0fbd4291b8558fa0e`, 4 instruments, 22 levels each, one seed pair each, all `kind: "l2l"` |
| The only order path | `tools/mt5-bridge/live-trading-order.py`, spawned by the trader | the trader file itself names no order function |

The arithmetic, quoted from the module and its own header comment: take the direction Layer 1 published
(`data/layer1.json`); wait for a **five-minute candle to close beyond** a marked level, where "beyond" means the
newest closed M5 bar finished past a level the bar before it did not (`DEVIATION_TIMEFRAME = "M5"`,
`MIN_BARS = 3`); put a limit back **at that level** as the entry; aim at the **next marked level**
(`nearestAbove` / `nearestBelow`); and set the stop at `reward / rMultiple`, i.e. `REWARD_R_MULTIPLE = 5`, one
fifth of the entry-to-target distance behind the entry. So the risk unit is exactly what the user stated: R is the
initial entry-to-stop distance, and it is *derived from the level*, not from any range. The module refuses with
`stop-inside-grid` when that risk is smaller than one point break. The trader adds one pending order per asset, a
one-fifth-of-target stop, re-entry of the same limit at the same level after a stop-out, and a two-rung stop
ladder once a position has run to twice its placed risk.

Worked arithmetic from the committed ladder (EURUSD, seeds 1.12308 and 1.12729, spacing 0.00421, 22 levels):

- Long entry at the seed 1.12729 → next marked level 1.13150 → reward 0.00421 → R = 0.000842 = 84.2 points.
- The 0.5L2L reading is not marked anywhere. `half-l2l` is an allowed level kind in `lib/l2l_levels_store.js` and
  the file holds zero of them, so the midpoint ladder the 3R target needs does not exist yet. `options.rMultiple`
  is accepted by all three reading functions and no caller in `scripts/` or `lib/` passes it, so 3 is a variant to
  declare, not a behaviour to reproduce.

The trigger data is the blocker, not the arithmetic: `data/live-trading.json` carries `m5` at 576 bars per
instrument (2026-11-04T19:20Z → 2026-11-06T21:50Z for XAUUSD and US100.cash, 2026-11-05T13:15Z → 2026-11-07T15:30Z
for BTCUSD) and `h1` at 336 bars. Two days of five-minute bars is the entire trigger history in the repository, so
no 2024-01 → 2026-04 session can be replayed at M5 today.

## 9. Do the hourly timestamps mark bar opens or closes? Opens

Verified from the caches themselves rather than assumed. In `backtester/tmp/oanda_eur_usd_h1.csv` (14,428 bars,
2024-01-01T22:00:00Z → 2026-04-29T23:00:00Z) the weekly gaps read:

| Week boundary | Last bar before the gap | First bar after it | Reading |
| --- | --- | --- | --- |
| 2024-01-05 → 2024-01-07 (EST, close/open 22:00Z) | `2024-01-05T21:00Z` | `2024-01-07T22:00Z` | opens: the market opens at 22:00Z and the bar *stamped* 22:00 exists, while the last bar is 21:00, not 22:00 |
| 2026-04-10 → 2026-04-12 (EDT, close/open 21:00Z) | `2026-04-10T20:00Z` | `2026-04-12T21:00Z` | same, one hour earlier, in step with US daylight time |

Under close-stamping the first bar of a week could not be the opening instant (23:00Z in winter, 22:00Z in summer)
and the last would be 22:00Z / 21:00Z. Both ends instead sit one hour inside the open and close, and the shift
tracks US DST, which is the trader's clock. The XAU file opens at 23:00Z in January, matching the metals open
at 18:00 ET, again as an open.


Consequence for extraction: a price at 05:00 Europe/London is the **open** of the bar stamped 05:00Z in winter and
04:00Z in summer, and a session return is open-to-open on the same instrument. Using the close of the preceding bar
is identical in FX but not in XAU, NAS100 or BTC, so the open must be the field read.

## 10. Research inventory reconciled: two stores, and the 0/25 is the older one

The `0/25` count the earlier audit repeated comes from **this checkout's own registry**, not from the hosted
research register, and it is dated before the 4 November deliveries.

| Question | Answer from the repository |
| --- | --- |
| Which file said `0/25`? | `data/research-library/catalog.json`, `generated_at: "2026-10-13"`, twenty-five `factor_chains`, and a `final_chain` whose `gate` is `requires: "all-factor-chains"`; the count is computed from the registry, not stored |
| Which store does that gate read? | `data/research-library/documents.json` (`schema_version: research-library-documents-v1`): **42** documents — 37 `brief`, 2 `experiment`, 2 `context_package`, 1 `report` — latest registration **2026-10-15**, and **zero** documents carrying a `chain_id` |
| What is the newest factor document here? | one report, `usd-baseline-audit-01-vix-usd-report` v1, `e4151937…`, the VIX chain's stage 1. No red-team and no adjudication for any chain |
| Where are the delivered files? | `.local/research-library/objects/` holds exactly one object, `e4/e4151937…` (84,056 bytes); the service writes its own registry beside it at run time and that file is not committed |
| So where are the 27 inputs of 4 November? | Not in this checkout, in either store. The panel reads the service's authenticated `/manifest` at `http://127.0.0.1:8791` for exactly this reason (`docs/CURRENT_TASK.md`, 2026-10-20), so a register that lives on the hosted surface is invisible to a repository audit |


Two availability statements, kept apart as requested:

- **Research availability**: complete on the hosted register, per the owner's record — twenty-five factor
  adjudications plus the final analysis and the final red-team review, 27 inputs checked against registered hashes.
  In this checkout: unverified, because neither the documents nor the registry entries are here. It is a fetch and
  not a rebuild: pull the service `/manifest` (or export the hosted registry) and re-run
  `node scripts/build_research_library.js verify`.
- **Runnable model availability**: zero. No weights, no thresholds, no factor-to-direction mapping and no scoring
  code for the 25-factor arm exist in any branch; each chain's stage deliverable is a prose synthesis and `verify`
  hashes prompts only. The final adjudication's statement that weights and thresholds remain unresolved matches the
  repository exactly.

Until that fetch happens the honest label is "research available on the hosted register, unverified here; nothing
runnable" — neither "0/25 delivered" nor "model ready".

## 11. Official ICE DXY: source, coverage at both endpoints, and cost

- **Who publishes it.** ICE Data Indices, LLC owns and maintains the U.S. Dollar Index (USDX / DXY), a geometric
  weighted mean of six currencies (EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%). ICE's own
  product page states that all rights, title and interest, including formulation, components, values, weightings
  and methods of calculation, are the exclusive property of ICE Data Indices, LLC, and that any use whatsoever is
  "strictly prohibited without the express written consent of ICE Data Indices, LLC". A licensed feed is therefore
  the only lawful route to an official intraday cash-index history; a scraped or third-party series cannot be
  labelled ICE DXY.
- **Where a print exists.** DX futures trade 21 hours a day, Sunday 18:00 ET open to 17:00 ET close (ICE gives the
  London column as 01:00–22:00), and the cash index is calculated over that same week. 05:00 Europe/London is
  exactly **00:00 America/New_York in both DST regimes** (London +0 / ET −5, London +1 / ET −4), so both session
  ends map onto one New York timestamp all year and both fall inside the Sunday-to-Friday week. Expect a print at
  both ends of every weekday session, none on Saturday or on Sunday's London morning, and a check for the daily
  maintenance break, US holidays and the Thanksgiving and Christmas half days.
- **Coverage and cost.** ICE publishes no price list: the Index Solutions pages describe index agreements between
  client and provider and route everything to "Contact us", and the historical tick archive is sold through ICE
  Data Services. Cost is therefore quote-only, nothing has been purchased and nothing will be committed without a
  figure in writing. Channels to quote: ICE Data Services first (the only party that can speak for the cash index),
  then LSEG, Bloomberg, FactSet and Morningstar as licensed redistributors. Retail APIs do advertise a DXY symbol —
  Twelve Data lists its Grow plan at $79/month — but none states an ICE licence for the cash index, so they fail
  the official test until the vendor names its source and its rights in writing.


- **Acceptance test before any payment.** Ask for ten dates: two in each DST regime, one US holiday, one half day,
  one Monday and one Friday, each carrying a 00:00 ET print. Reject the vendor if a requested print is missing
  without a market closure, if the series is a futures or CFD proxy, or if the rights do not permit local storage
  for backtesting. Keep ICE's DX settlement (the 14:59–15:00 ET volume-weighted average) separate from any "close":
  they are different figures.
- **EUR/USD pilot, separately labelled.** The existing hourly EUR cache (14,428 bars, 2024-01-01T22:00Z →
  2026-04-29T23:00Z, open-stamped per §9) can answer whether a bearish USD call preceded a EUR/USD rise, under its
  own contract id such as `alt.eurusd-session-h1`. It is a proxy pilot and must not be reported as the DXY arm; the
  DXY outcome stays unscored until the index data arrives.

## 12. What can be scored today, what each remaining test needs, and the smallest next step

| Test | Scorable today | What it still needs | Smallest next step |
| --- | --- | --- | --- |
| Hourly ADR benchmark: L2L and 0.5L2L reach, and directional accuracy | **Yes** — 1,592 L2 rows / 648 dates and 2,493 L1 rows / 827 dates, 2024-01-03 → 2026-04-30, already computed | Nothing | Freeze it as the historical benchmark and stop re-deriving it |
| Outcomes 2 and 3 on the 05:00 London label | **Partly** — data present and open-stamped (§9), but every stored number is on the New-York day | A re-key from the New-York day to 05:00 → 05:00 London, with an explicit endpoint expiry | One script over the existing H1 caches, pre-2026-05-01 sessions only |
| Original L2L as 5R trades | **No** | M5 triggers per session (2 days exist, §8), a ladder dated per session (marked once on 2026-10-04), L1 calls per session (present) | Decide M5 collection versus an hour-open entry, and label the difference |
| 0.5L2L as 3R trades | **No** | Midpoint (`half-l2l`) levels — zero marked; plus a declared `rMultiple: 3` | Mark midpoints for one pair and run it as a labelled variant |
| DXY direction, official index | **No** — zero sessions | Licensed cash-index prints at 00:00 ET plus a rights statement (§11) | Request the ICE sample and fee quote; buy nothing yet |
| EUR/USD proxy pilot | **Yes, as a labelled pilot** | The same 05:00 label as row 2, under its own contract id | Reuse row 2's script and report separately |
| 25-factor arm | **No** | The 27 registered inputs pulled from the hosted manifest, then weights, thresholds and a direction mapping that the final adjudication leaves unresolved (§10) | Pull `/manifest`, run `verify`, record "27 available, 0 runnable" |
| Bid/ask, commission, slippage | **No** | Bid/ask history; only live quotes exist | Wait for rows 3 and 4 |

A 5R or 3R trade counts as replayable only where one session's data carries the whole sequence: the M5 close
beyond a marked level as the trigger, that level as the entry, the next marked level as the target, and the
one-fifth (or one-third) stop. On today's artefacts that is true of no historical session, so no 5R/3R number may
be published as scored.

Reading note: section 13, added later the same day, supersedes three cells of the table above - the 5R row now
has an M5 replay for two sessions, the 3R row no longer needs hand-marked midpoints, and the manifest row is
"42 available and verified, 26 factor-scoped, 0 runnable". The judgement that nothing is scorable is unchanged.

Smallest next step of all: ask ICE Data Indices for the ten-date sample and a written fee, in parallel with
re-keying outcomes 2 and 3 to the 05:00 London label on the caches already in hand.


## 13. Executed 2026-11-07: the M5 replay, the ICE letter, the hosted manifest

Three of §12's "smallest next steps" were done on 2026-11-07. Nothing was scored, published or placed, the live
VPS trader was not touched, and no production artefact was written.

### 13.1 The replay engine, and what it preserves

New, additive and committed: `backtester/lib/l2l_session_replay.js` (rule arithmetic, no I/O),
`backtester/scripts/run_l2l_m5_session_replay.js` (inputs, provenance, ledger and picture) and
`backtester/tests/l2l_session_replay.test.js` (16 tests, all green). It replays `lib/l2l_strategy.js` at
`origin/main` (`4faf3f35`) and it keeps every part of the live trader a replay could quietly improve:

- the trigger is a **crossing** - the newest closed M5 bar finishes past a line the bar before it did not;
- the entry is a **limit back at the crossed line**, never the breakout candle;
- the limit carries **no expiry of its own**: it ends when it fills, when the target is taken without it, or when
  the call ends;
- a **stopped-out trade re-enters at the same line** until the target is taken or another line is crossed, and
  the re-entry is not placed while the line sits behind the market (the live trader's "a sell limit at or below
  the market is a sell now" refusal);
- ticket prices are rounded to the **instrument's own digits** (5 for EUR/USD), which is the live rounding, not
  six decimals;
- one trade at a time per pair; size is the study's own 1% of the running balance, which the live trader does not
  do (it trades the instrument minimum) and which is therefore labelled as the study's rule.

Sessions come from `usd_session_engine_interface.resolveSession`, so they are 05:00 Europe/London to 05:00
Europe/London, 24 hours in an ordinary week and never assumed.

### 13.2 The tape, its provenance, and the call

| Input | Source | Bytes | sha256 (16) | Coverage |
| --- | --- | --- | --- | --- |
| M5 bars | `origin/main:data/live-trading.json`, read via `git cat-file` into the ignored research folder | 2,407,747 | `76dbf9fea9c7f5d9` | EURUSD 576 bars, 2026-11-04T21:30Z → 2026-11-06T21:50Z |
| Ladder | `origin/main:data/l2l-levels.json` | 47,758 | `a5dc10a32e0ccb50` | 22 EURUSD levels, generated 2026-10-04T16:14:19Z, marked 2026-10-04T15:26Z, seeds 1.12308 / 1.12729, spacing 0.00421 |

The ladder predates every bar on the tape by 31 days, so it is available before entry for both sessions. The
instrument's own grid: digits 5, point 0.00001, contract size 100,000, minimum lot 0.01, lot step 0.01.

**The call is the weak link, and it is labelled as one.** No archived Layer 1 file for 2026-11-05 or 2026-11-06
exists in this checkout - `data/layer1.json` carries the 2026-11-07 call - so the direction used is the one the
live trader acted on, evidenced by its own fill record (position 305833833, sell, opened 2026-11-06T00:02:23Z),
and every ledger row and picture says so in those words. A genuine call-model attribution still needs a call
archive, which is why both variants are labelled "call model: L2L rule, Layer 1 EUR direction consumed by the
ftmo-1 trader" and nothing else.


### 13.3 Full L2L (5R) on the tape: six rows, +7R gross

`node backtester/scripts/run_l2l_m5_session_replay.js --symbol EURUSD --side short --r-multiple 5`

| Session | Line | Entry | Stop | Target | Crossing | Fill | Exit | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-05 | 1.12308 | 1.12308 | 1.12392 | 1.11887 | 10:35 | 10:40 | 17:40 stop | −1.00R |
| 2026-11-05 | 1.12308 | 1.12308 | 1.12392 | 1.11887 | 18:40 | 19:00 | 11-06 06:40 target | +5.00R |
| 2026-11-06 | 1.11887 | 1.11887 | 1.11971 | 1.11466 | 06:45 | 08:15 | 13:30 target | +5.00R |
| 2026-11-06 | 1.11466 | 1.11466 | 1.11550 | 1.11045 | 13:40 | 13:45 | 15:05 stop | −1.00R |
| 2026-11-06 | 1.11466 | 1.11466 | 1.11550 | 1.11045 | 15:55 | 16:00 | 16:50 stop | −1.00R |
| 2026-11-06 | 1.11466 | 1.11466 | 1.11550 | 1.11045 | 17:45 | 18:00 | working at tape end | 0 |

Totals: 6 rows, 2 targets, 3 stops, 1 still working, **+7.00R gross**, £100,000 → £106,975.47 (+6.98% gross),
**0 ambiguous bars**. Every stop is exactly one fifth of the entry-to-target distance and every ticket price
matches the live order to the point (`1.12392`, `1.11971`, `1.11550` are the same prices the account carried).

### 13.4 0.5L2L (3R) on the same tape: nine fills, +8R gross

`node backtester/scripts/run_l2l_m5_session_replay.js --symbol EURUSD --side short --r-multiple 3 --half-grid`
(midpoints computed inside the replay from each session's own ladder, never stored)

4 targets (+12R), 4 stops (−4R), 1 order removed because its target was taken before the retrace, 1 still
working: **+8.00R gross**, £100,000 → £108,115.93 (+8.12% gross).

The finding that matters more than the number: **every trigger in this window landed on an original marked level,
so no midpoint ever fired.** The 3R variant's results here come entirely from the shorter target and stop, not
from half-level entries. Two days of one pair cannot say anything about whether midpoints add entries; that needs
a tape where price travels less than one 42-point step in a session.

### 13.5 The replay against the live account, row by row

The live EUR/USD fills in the same window are the check, and they agree where the data allows agreement:

| Live fill (ftmo-1, magic 20261004) | Replay | Verdict |
| --- | --- | --- |
| sell 1.12308 opened 11-05 15:47:40, stopped 17:44:48 at 1.12392 | stop 17:40 bar at 1.12392 | same trade, same price, four minutes inside one M5 bar |
| sell 1.12308 opened 11-06 00:02:23, target 06:40:04 at 1.11884 | fill 19:00, target 06:40 | same level and the same target minute |
| sell 1.11886 opened 11-06 08:41:52, target 13:30:04 at 1.11455 | fill 08:15, target 13:30 | same target minute; the replay filled earlier at 1.11887 |
| sell 1.11463 opened 11-06 14:37:38, stopped 15:08:09 | stop 15:05 | same trade |
| sell 1.11468 opened 11-06 18:00:33, still open at 15:26Z | working at tape end | same state |

Three differences, all named rather than smoothed:

- **Two live closes are not replayed.** The account closed positions at 15:27 and 23:29 on 11-05 at neither stop
  nor target (+0.15 and −0.10 of a lot-sized move). The replay holds the call constant for the whole tape, so it
  has no way to express a call that changed mid-session or an operator's own close; those two exits are outside
  what this replay models.
- **One stop is missed for want of a spread.** The live position opened 08:15 was stopped at 08:34 at 1.11971.
  The replay opens the same trade at the same price and rides it to target, because the M5 bars are bid prices:
  the ask touched the stop while the bid high did not. A stop can therefore be missed by up to one spread on this
  data, which is one more reason no number here is net.
- **Size differs by design.** The account trades 0.01 lots; the replay sizes at 1% of a simulated £100,000
  balance (11.9 lots on a 0.00084 stop), which is the study's rule and is labelled on every row.


### 13.6 The picture

One visual session replay per variant, self-contained HTML with an inline SVG, drawn in the frame
`docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md` asks for (dark plot, thin teal level lines with right-edge
value tags, execution markers on the candles):

- `backtester/tmp/usd-session-research/replays/replay-EURUSD-5r-short-2026-11-06.html` - the 5R session with
  three trades, the trigger candle, the limit, the fills, the stop, the target and each result in R;
- `.../replay-EURUSD-5r-short-2026-11-05.html` - the previous session, where the first ticket stops out and the
  re-entry runs into the next morning;
- `.../replay-EURUSD-3r-half-short-2026-11-06.html` - the same 2026-11-06 session as the 3R half-grid variant, so
  the two geometries can be read against the same candles;
- `.../ledger-EURUSD-5r-short.json` and `.../ledger-EURUSD-3r-half-short.json` - the full ledgers, each carrying
  the rules, the provenance hashes, the per-session coverage and the totals.

Both are ignored local artefacts, not committed, and both carry the call model, the execution rules, the
"gross of spread, commission and slippage" note and the ambiguity count in the picture itself, so a reader
cannot see the numbers without seeing what they are.

### 13.7 The hosted manifest, pulled and verified

The loopback service was started for the pull and stopped afterwards. `/manifest` answered **HTTP 200** with the
service token: 43,310 bytes, sha256 `818aebce384b0734ef1bbef333c9632cfd3771bc774de75c2f3053e7aca5ae15`,
`generated_at` 2026-11-07T17:18:07.370Z, saved only under `backtester/tmp/usd-session-research/hosted/`.

Verified against the bytes this checkout can reach:

| Check | Result |
| --- | --- |
| Documents in the manifest | 42 (41 repo documents, 1 uploaded) |
| Versions | 86 |
| Documents whose stored bytes were found and re-hashed | 41 |
| Hash matches the manifest's own `latest_sha256` | 41 of 41 |
| The 42nd document | `usd-baseline-audit-01-vix-usd-report`, storage `library_object`, content-addressed at `.local/research-library/objects/e4/e4151937…` whose filename is its sha256 and whose size is the manifest's 84,056 bytes |
| Documents naming a factor | 26 (the 25 published briefs plus that VIX report) |
| Documents naming a `chain_id` or a stage beyond VIX research | 0 |
| `node scripts/build_research_library.js verify` | clean: 25 factor chains, 0 complete, VIX `live.f1-vix-level` 1/3, final chain locked at 0/25 |

So §10's "27 registered inputs" is superseded by this measurement, and the honest sentence is: **42 documents are
available and hash-verified, 26 of them are factor-scoped, one factor stage is delivered, and zero factors are
runnable.** The challenger build can now start from a verified input list; it cannot start from a verified
*signal*, because no factor has research, red-team and adjudication delivered against current versions.

### 13.8 What this does and does not change in §12

- Row 3 (5R trades) moves from "no M5 trigger exists" to "an M5 replay exists for two sessions of one pair"; it
  is still **not scorable**, because two sessions in one call direction is a demonstration, not a sample.
- Row 4 (3R trades) no longer needs hand-marked `half-l2l` midpoints: the replay computes them per session. What
  it still needs is a tape where a midpoint actually triggers.
- Row 8 (25-factor arm) now records "42 available and verified, 26 factor-scoped, 0 runnable" instead of
  "27 available, 0 runnable".
- Rows 1, 2, 5 and 6 are unchanged, and the DXY arm still needs ICE's answer (§11 and the letter at
  `ice_dxy_sample_and_fee_request_20261107.md`).

### 13.9 Still open

- M5 history beyond 2026-11-04 to 11-06. Every 5R/3R statement above is two days of one pair; the rule needs
  sessions from more than one call direction before anything is labelled a result.
- Whether to accept bid-only bars for stop detection, or to stage a bid/ask series. A stop missed by one spread
  is a real difference (§13.5) and not a rounding detail.
- Where a call archive comes from, so a replay can be attributed to a call model rather than to the fill record.
- The ICE reply. Until it arrives, the DXY factor is unbuilt and the EUR/USD proxy arm remains a separately
  labelled pilot.

