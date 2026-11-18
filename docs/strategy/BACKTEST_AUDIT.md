# Backtests and research artefacts: audit and handoff

Written 2026-11-17 by the strategy worker (`workers/strategy-advisory-20260920`) for the separate build of a central
Backtesting area. Read-only audit: no artefact was moved, edited, re-run or published. Every number below was read from
a committed file or a command output named beside it; nothing is estimated.

## 0. The one thing to know before reading

There are **three different things called a backtest** here, they answer different questions, and two of them disagree
in public:

1. **Live-call replay at a 24-hour horizon.** Five checker corpora and the dashboard's `Backtest` tab. It asks "did the
   call the agent actually published come true by the next session close".
2. **Research harnesses on saved snapshots.** Reach, edge, calibration and shadow studies over the same archive, each
   with its own outcome definition.
3. **A point-in-time session replay.** `data/usd-layer1-backtester/*` replays 725 mornings from a 05:00 London cutoff,
   and its own gate currently accepts **0 of 725**. It is the newest work and the only one that tries to prove the
   inputs existed at the decision instant.

A central Backtesting area must keep those three apart, or it will present a reach rate as an accuracy and an accuracy
as an edge — which the repository's own artefacts explicitly forbid.

## 1. Which tree this audit describes

| Tree | HEAD | What it holds |
| --- | --- | --- |
| This worktree, `workers/strategy-advisory-20260920` | `b9d430c0`, 2026-11-16 | Diverged from `origin/main` at **2026-09-07** (`125d871e`); 2,881 commits behind, 225 ahead. Holds the September generation of backtest assets. |
| Canonical checkout, `main-published` | `7aea9dfb`, 2026-11-15 | The published tree. Holds everything built after 7 September, including the whole USD Layer 1 backtester. |
| `origin/main` | `fb059c17`, 2026-11-15 | Same content for the files audited here. |

Consequence: `docs/strategy/` here cannot see the current backtester, and the canonical checkout cannot see the
September research files. **Neither tree alone is a complete inventory.** Files that exist only in this worktree and
`main`: the five `data/backtester-checker-*.json` corpora, `data/backtesting-development.json`, the eight
`data/l2l-*.json` artefacts, `half-l2l-reach-research.json` (35.3 MB), `half-l2l-executable-entry-v1-draft.json`,
`eur-h1-ta-directional-baseline-v1.json`, the gold `*-20260906.json` audits. Files that exist only in the canonical
tree: `data/usd-layer1-backtester/` (7 files), `usd-24h-experiment-registry.json`, `usd-24h-selection.json`,
`data/research/usd-session/` (3 files), `data/research-library/` (2), the live-trading snapshots, `data/l2l-levels.json`, and
eleven of the canonical tree's sixteen root HTML pages (this worktree has five).

Verified by `git cat-file -e origin/main:<path>`, the September artefacts that **did** survive to `origin/main` are
`adr-reach-research.json`, `factor-edge-lab.json`, `phase-2-shadow-backtest.json`, `confidence-calibration.json`,
`confidence-band-delivery.json`, `research-proof-map.json`, `backtest-engine.json` and `backtest.json`. Everything absent
is therefore either archived research (the eight `l2l-*` files, the four gold audits, `eur-h1-ta-*`,
`half-l2l-executable-entry-v1-draft.json`, `backtesting-development.json`) or the moved corpora.

`main` (local, `6c43cbb4`, 2026-09-07) still contains all of them, so **the September archive is recoverable from a
local branch** — including `half-l2l-reach-research.json`, the five corpora, the gold audits, `eur-h1-ta-*` and
`backtesting-development.json`. Commit `30ffe5ba` ("Preserve L2L directional research and session-close experiments") is
the preservation commit and is on `main` and several worker branches, but on no published branch.

One absence is a live defect, not an archive decision: `script.js` line 28 still requests
`./data/half-l2l-reach-research.json`, resolved at line 22325 and wired at line 22516, so the published
**L2L Directional Accuracy** sub-tab of the Backtest tab renders a generic "50% L2L Reach unavailable" card. The card
names no cause: the fetch failure is swallowed by `resolveResearchTask(..., null)` and nothing is logged. That file is
absent from `origin/main` and from every published branch.

## 2. Register A: live-call replay and the checker corpora

Built by `backtester/scripts/build_backtester_checker_data*.js` (5), validated by `validate_backtester_checker*.js` (5),
parity-checked by `check_*_live_replay_24h_parity.js` (5), scored by `run_*_prediction_outcome_evaluations.js` (4) and
`run_*_24h_flat_band_sensitivity.js` (3).

| Corpus | Bytes | Consumer |
| --- | ---: | --- |
| `backtester-checker-usd-24h-2024-01.json` | 20,830,766 | Backtest Checker sub-tab; `usd-layer1-logic.html` §9.2 |
| `backtester-checker-btc-24h-2024-2026.json` | 13,587,160 | same |
| `backtester-checker-gold-24h-2024-2026.json` | 8,784,728 | same |
| `backtester-checker-nq-24h-2024-2026.json` | 8,472,623 | same |
| `backtester-checker-eur-24h-2024-2026.json` | 7,778,217 | same |
| **total** | **59,453,494** | |

Each row is one archived call with every factor argument and the published headline; the USD corpus alone has 604
evaluated 24-hour rows. Status and limitations:

- They were **removed from the published tree** on 2026-11-07 (`f5b0b8ae`): a legacy-branch Pages publish moved all
  80.4 MB and timed out, and these five files were 70.5 % of it. They now live on the orphan branch
  `frozen/backtester-checker-20261107`, and `script.js` fetches them from `raw.githubusercontent.com` on that branch
  (`checkerDataBase`), with `npm run checker:corpus` filling the ignored `.local/checker-corpus` for local work.
- A failed read degrades to an empty checker table and **raises no error**. Any new Backtesting area that fetches these
  inherits a silent-empty failure mode plus a cross-origin dependency on an unguarded branch.
- They replay *published* calls, so they measure the deployed engine, not a candidate. The horizon is the repository's
  "following 24hrs" (next 16:00 ET close), not 24 elapsed hours.

## 3. Register B: research artefacts on saved snapshots

Each item: what it asks, what it covers, what it found, what it cannot support.

### B1. Half-L2L and full-L2L reach — `data/half-l2l-reach-research.json` (35.3 MB, this worktree only)

Coverage: layer 1 2,493 eligible calls, layer 2 1,592; data coverage 93.6 % and 59.8 %.

| Measure | Layer 1 | Layer 2 |
| --- | --- | --- |
| Full standard reach | 70.5 % [68.7, 72.27] | 72.3 % [70.05, 74.44] |
| Half-standard reach | 97.0 % [96.25, 97.59] | 97.3 % [96.38, 97.99] |
| Median time to target | 4 h / 2 h | 4 h / 2 h |

Limitation: `maxAdverseExcursionSupported: false`, `adverseBoundarySequenceSupported: false`. The study knows how far
price went the call's way, not what it did first — so it is **not** a win rate.

Do not corroborate it with `data/backtest-engine.json`'s 73.2 % full / 99.1 % half: those are a different population (328
and 444 of 448 XAU/USD lane calls) and the two denominators must never be mixed. That file's own verdict still applies —
strength grade `UNAVAILABLE`, "not expectancy, risk-adjusted performance, or a production strength grade".

Verdict: reuse as the reach benchmark, never as accuracy. It is also the figure the directional study re-measures at
64.34 % (layer 1) and 37.26 % full once the walk is anchored at the designated session open — see B3.

### B2. ADR-20 reach — `data/adr-reach-research.json` (1.53 MB)

Same question with an ADR-20 target instead of a marked level: layer 1 and layer 2 summary, strength, comparison and
entry-reliability rows, plus a per-asset and per-pair **threshold sensitivity** table, generated 2026-07.

Verdict: the sensitivity table is the reusable part. It shows reach moving with the threshold, which is what a central
page should show instead of one headline number.

### B3. The L2L directional family — seven of the eight `l2l-*` files, this worktree only

The most complete research chain in the repository, and its clearest negative result. (The eighth file is the EUR H1
dataset in B10.)

| File | Bytes | Headline |
| --- | ---: | --- |
| `l2l-trading-day-directional-v1.json` | 13,785,165 | 4,085 rows; three chronological folds; session open-to-close label |
| `l2l-directional-discrimination-v1.json` | 75,705 | Layer 1 47.65 %, layer 2 47.99 % vs always-bullish 53.19 % / 53.45 %; `BEARISH_ASYMMETRY_ONLY` |
| `l2l-directional-failure-diagnostics-v1.json` | 95,864 | validation 43.84 / 43.88, final test 48.52 / 52.44; `mechanicalMismatches: 0`; `reliableDailyCloseSignal: false` |
| `l2l-directional-research-verdict-v1.json` | 5,684 | `validatedPredictorOfDesignatedSessionDirection: false`; original 96.99 / 70.52 (L1), 97.3 / 72.3 (L2) declared `ORIGINAL_METRIC_PATH_DEPENDENT` |
| `l2l-signal-construction-audit-v1.json` | 16,531 | `bestExplainedBy: "horizon_mismatch"`; no implementation defect; stored directions reproduced exactly |
| `l2l-excursion-definition-reconciliation-v1.json` | 6,858,355 | joins reach and directional populations; 1,325 original-only half hits, 1,207 with a later initiating swing |
| `l2l-session-close-redesign-feasibility-v1.json` | 3,605,635 | `INPUT_TIMING_NOT_DEFENSIBLE`; sources stop at 2026-04-30; no read-only environment |

Verdict: internally consistent, final test already consumed, and four claims are forbidden in writing — do not call the
97 % / 70–72 % excursion rates directional accuracy, a win rate, evidence of reliability, or an executable forecasting
result. **Any new Backtesting surface must carry that prohibition, not just the numbers.**

Two reconciliations the files support and prose usually omits:

1. **Where 97 % goes.** The same 2,493 layer 1 calls carry `halfAdr20ReachRatePct: 64.34` and `fullAdr20ReachRatePct:
   37.26` in `l2l-trading-day-directional-v1` once the walk starts at the designated session open, against 97.0 % / 70.5 %
   when the original builder may claim a swing that began earlier. Of the 1,325 original-only half hits, 1,207 are
   explained by a later initiating swing. The gap is a definition, not a discovery.
2. **Where the baseline bites.** Slice by slice, always-bullish beats the call in five of six folds — layer 1 TRAIN
   49.95 % vs 54.18 %, VALIDATION 43.84 % vs 54.52 %, FINAL_TEST 48.52 % vs 50.33 %; layer 2 TRAIN 48.55 % vs 53.78 %,
   VALIDATION 43.88 % vs 56.12 % — with one exception, layer 2 FINAL_TEST 52.44 % vs 50.64 % on 389 calls. The pooled
   53.19 / 53.45 baselines are the wrong comparator for a fold that has its own drift; the fold table is the honest one.

### B4. Half-L2L executable entry — `data/half-l2l-executable-entry-v1-draft.json`

A draft frozen before outcome, with entry scenarios, strategy variants and OHLC sequencing rules, and
`costs.approved_for_profitability_execution: false`. No trade ledger exists and none was produced.

Verdict: blueprint only — the right starting point for an executable test, deliberately containing no result.

### B5. Factor edge lab — `data/factor-edge-lab.json` (4.8 MB)

`phase2-factor-edge-lab-v1`, 2026-07-06, timeframe 24H, primary metric `ex_flat_wr`: per-asset layer 1 (5 assets) and
layer 2 (4 pairs) factor combinations, outcome markets, declared known limitations.

Verdict: the largest single-factor survey and the only per-factor combination table. It is a 24-hour-horizon artefact
and its `methodology.known_limitations` must travel with it.

### B6–B7. Confidence calibration and band delivery

`confidence-calibration.json` (751,004 B) and `confidence-band-delivery.json` (552,279 B), both 2026-07-28. Calibration is
pooled plus per asset and per pair on the locked checker definition; band delivery has 330 band rows, 44 strength rows,
4 no-trade rows, 90 asymmetry rows, 10 confidence bands, 4 strength bands, a five-step fallback hierarchy and its own
`reconciliation` block. Calibration's `existing_analysis_audit` records what earlier views lacked.

Verdict: the **best-built artefacts here** for a central Backtesting view — sample-size tiers, evidence-quality labels,
"insufficient sample" flags, reconciliation checks. Adopt their vocabulary rather than inventing one.

### B8. Phase 2 shadow backtest — `data/phase-2-shadow-backtest.json`

`phase2-shadow-backtest-v1`, 2026-07-07, five assets under a shadow weight formula and decision gate:
`improved_assets: 2`, `degraded_assets: 0`, `mixed_or_warn_assets: 3`, `average_ex_flat_change_pct_points: 23`.

Caution: a +23 point average improvement from a shadow engine is implausible beside the 47–53 % results the same archive
later produced. Treat it as **unverified**, not a finding; nothing later re-derives it.

### B9. Gold — five artefacts, this worktree only

| File | What it is |
| --- | --- |
| `gold-stored-call-pilot-20260906.json` (332 KB) | 154 stored calls scored two ways: strict 24 elapsed hours → **0 evaluable**; endpoint (next minute after storage → next 16:00) → 97 evaluable, **54.88 %** vs always-bullish 52.44 % on the same 82 scored calls |
| `gold-snapshot-lineage-audit-20260906.json` | lineage and hashes for the 154 snapshot outputs |
| `gold-history-repair-impact-20260906.json` | what a collector-history repair would change; `historical_snapshots_rewritten: false` |
| `gold-history-query-audit-20260906.json` | old vs replacement collector query; `workflow_updated: false`, `isolated_n8n_execution_validated: false` |
| `gold-evidence-audit.json` | the evidence chain behind the Gold tab |

Verdict: the honest label is "54.9 % on 97 calls, 2.4 points over always-bullish, storage time is not publication time,
not executable". The strict lane scoring zero is itself the finding.

### B10. EUR H1 technical baseline

`data/eur-h1-ta-directional-baseline-v1.json`: fixed layer 2 regularised logistic regression on six EUR/USD H1 features,
`FIXED_BASELINE_NOT_PRODUCTION_READY`. Folds are 205 training / 153 validation / 118 final test records. Validation
56.21 % vs 53.59 % (+2.61), final test **42.37 % vs 44.92 % (−2.54)**, `readyForDashboard: false`.
`data/l2l-session-close-eur-h1-ta-v1.json` is the 476-record feature/label dataset it was fitted on, with hashes and a
source audit that excludes 128 input records before feature construction.

Verdict: a correctly run, correctly reported failure — keep it as the worked example of train / validate / final-test
discipline that a central page should reproduce.

### B11. Trackers, not results

`data/backtest.json` (phase-2 progress: 22 snapshots, 88 predictions, 880 factor observations, January 2024 only),
`data/backtest-engine.json` (XAU/USD engineering tracker, four lanes, qualification gate `not qualified`),
`data/research-proof-map.json` (`backtesting-development-v1`, six stages, release gate, XAU/USD control surface).
Their numbers are context and the engine file says so in its own `scope` field.


## 4. Register C: the current backtester — `data/usd-layer1-backtester/` (canonical tree only)

Seven files, 7.7 MB, committed 2026-11-14/15. This is the only place where the repository asks "could this decision have
been made at 05:00 London with information that existed then", and the answer is currently no.

| File | Size | Contents |
| --- | ---: | --- |
| `run-v1.json` | 6,584,003 | The replay: 725 sessions with saved inputs and source legend, factor accounting (25 factors, 18,125 rows), five tests, progress, m5 coverage, level provenance, cutoff study, assumption ledger, execution demo, provenance |
| `engine-v1.json` | 927,740 | `usd-session-engine-v1`: 25-row rulebook and per-morning execution states |
| `decision-rules-v1.json` | 48,654 | Frozen thresholds and bands, per-arm scoring, `run_sha256` pin |
| `audit-v1.json` | 43,353 | Independent re-derivation of the book, the factor audit and the L2L block |
| `audit-v1-superseded.json` | 30,292 | Same, from an earlier run (`d374020c`, 275 / 167 / 52) — keep for the diff, never for numbers |
| `event-calendar-v1.json` | 13,606 | 23 FOMC-only events, status `partial_staged`: one release type is staged, the other nine are not, which is why band 5 is unreachable |
| `f8-fomc-statements-v1.json` | 69,705 | 23 statements with hashes and release clocks, status `staged_not_wired`; 11 hawkish, 8 neutral, 4 dovish |

Code: `backtester/lib/usd_layer1_backtester` (30 modules), `backtester/scripts` (34 scripts, 14 lib modules, 20 test
files), warehouse DDL in `backtester/sql/001…010`.

### The gate — why 0 of 725

`run.validity_gate` rung by rung: present 618 / 725, fresh 617 / 725, **clocked 0 / 725, identified 0 / 725**. The failure
is not data coverage; it is that no session can prove *when* its inputs were stamped, because the archive stores values
without a vintage. `progress` therefore records `current_stage: test2`, and the model identity is
`RESEARCH_FROZEN_NOT_VALIDATED`, `CONFIG_BLOCKED`, `rule_defined: false`, with six unresolved items including "the sign of
every factor", "the weight of every factor" and "a registered sample, holdout, multiplicity and pass/fail plan".

### The five tests, as the file reports them

| Test | Status | Numbers |
| --- | --- | --- |
| 1. DXY direction, official series | blocked | no official cash DXY with a 05:00 quote |
| 1b. DXY direction, broker `DXY.cash` CFD | `scored_proxy` | 360 of 480 sessions priced; current model 284 scored, 49.65 % (lower bound 43.88); challenger 205 scored / 42.93 %; challenger_v1 209 scored / 43.54 % |
| 2. Four markets | partial | 685 of 725 sessions priced; the frozen v1 book makes 196 directional calls, all four hit 17, any four 136; per-market figures for the three arms are below |
| 3. L2L full, 5R geometry | blocked | 0 usable; no 5-minute tape and no ladder archived before the setup |
| 4. L2L half, 3R geometry | blocked | 0 usable; same two blockers |

Three four-market arms exist in the folder and one of them is superseded. Quote the arm by name or not at all:

| Arm | Directional calls | EUR/USD | XAU/USD | NAS100 | BTC/USD |
| --- | ---: | --- | --- | --- | --- |
| live-engine arm (`run-v1.tests.four_markets.models.current`, scored per market) | 439 / 458 / 454 / 536 scored | 49.43 % (217/439) | 55.68 % (255/458) | 52.86 % (240/454) | 50.00 % (268/536) |
| frozen v1 book (`decision-rules-v1.scored.current`, same as `audit-v1.markets`) | 196 | 49.2 % (63/128) | 55.7 % (73/131) | 46.5 % (59/127) | 44.6 % (70/157) |
| **superseded** earlier run (`scored.superseded`, pinned to run `9e4b8d5f`) | 167 | 50.0 % (54/108) | 58.6 % (65/111) | 51.9 % (54/104) | 46.6 % (62/133) |

The superseded block sits beside the current one with no row label; its only marker is the pinned run hash. A page that
prints 58.6 % for XAU/USD is quoting a run that has been replaced.


Check failures E2 404, E3 297, E4 6, E5 529, E6 134; three mornings hit the `CAP-3` cap. Band counts 22 / 105 / 50 / 19 /
**0**, and band 5 is defined but unreachable because only the FOMC statement type is staged and it is staged but not
wired. The assertions that pass are
internal ones — invariance against `decision_rules_v1`, six checks in order, no silent refusal, a traced proof morning
(2024-02-06) — not an edge.

`run.execution_demo` is a **two-day EUR/USD M5 replay whose call direction came from the live fill record**, because no
05:00 archive exists for 2026-11-05/06 in the checkout. It reports +6.97 % over six fills. It is a plumbing test; never
present it as a backtest result.

### One open reconciliation inside this folder

`decision-rules-v1.json` and `audit-v1.json` are pinned to the same `run_sha256` (`20ef865c…`) and agree on the counts
(725 / 320 / 196 / 62). But the `scored.current` block inside decision-rules records an `outcome_check` of 2,900 checked,
2,497 matched, **403 mismatched** between 2026-04-29 and 2026-10-12 (stored `present: false`, fresh `present: true`),
while `audit-v1.outcome_check` reads 2,900 / 2,900 matched, 0 mismatched. They check different arms — audit the 196-call
book, decision-rules the 167-call current arm — so this is not a contradiction, but **neither file says which arm its
check covers, and one was written before an outcome refresh**. Any new page must label the arm beside the number; a
reader comparing the two files today will conclude the data is broken.


## 5. Register D: the 24-hour USD study — closed, negative (canonical tree only)

`data/usd-24h-experiment-registry.json` and `data/usd-24h-selection.json`, generated 2026-10-12, plus
`docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md`.

- 584 rows / 583 evaluable, 2024-01-02 → 2026-04-30. Splits: dev 2024-01-02→2025-03-31, validation 2025-04-01→2025-10-31,
  holdout 2025-11-03→2026-04-30.
- 93 configurations attempted, 85 in the candidate pool, 0 passed the declared filters, 2 passed the reduced tier;
  selected `challenger_logistic_l2_0.03` (L2 logistic, λ 0.03, 17 features), `selected_from_survivors: false`.
- Holdout: candidate 46.25 % [35.75, 57.10] on 80 decided calls vs the deployed engine 52.78 % [41.40, 63.87];
  `target_60_percent_met: false`; `evidence_classification: "not_supported"`, labels `NOT_DEMONSTRATED` and
  `NOT_SUPPORTED`. Over the untouched window no probability calls were made: 123 rows, 84 disagreements, 24 days the
  book had no call.
- The dataset it was computed from, `data/usd-24h-research-dataset.json`, is **in no branch of the published tree** — only
  its SHA-256 (`fafdab0d…`). The study can be quoted, not re-run, from a published checkout.

Verdict: a properly pre-registered, properly lost experiment — the best template here for "declare the selection rule
before reading the holdout".

## 6. Data and lineage: what exists, what does not

Present and usable as saved inputs: `run-v1.sessions[*].saved_inputs` (per-morning values with a source legend),
`backtester/tmp/ftmo_dxy_cash_h1.csv` (10,052 rows, hashed), the F8 statements, the 23-event FOMC calendar, `data/l2l-levels.json`,
the checker corpora on the frozen branch, and the Supabase tables defined in `backtester/sql/001…010`.

Absent, and named as absent by the artefacts themselves:

| Missing | Consequence | Where it is recorded |
| --- | --- | --- |
| Input vintages (when a value was stamped) | gate rung "clocked" fails on 725/725; no point-in-time claim survives | `run-v1.validity_gate`, `cutoff_study` |
| Official cash DXY with a 05:00 quote | test 1 remains blocked; only a labelled broker CFD lane exists | `run-v1.tests.dxy_direction` |
| 5-minute tape and pre-setup level ladders | tests 3 and 4 blocked at 0 usable sessions | `run-v1.tests.l2l_*` |
| Staged calendar for the other nine release types | band 5 unreachable; only FOMC statements are staged, as text, and not wired | `event-calendar-v1.scope`, `decision-rules-v1.bands` |
| FOMC consensus / expectations | event factor has no surprise term | factor book, `open_judgements: 3` |
| Intraday prices after 2026-04-30 | every intraday-horizon study stops there | `l2l-session-close-redesign-feasibility-v1`, 24h selection |
| `data/usd-24h-research-dataset.json` | 24h study not reproducible | registry `dataset_sha256` only |
| Collector workflows in this repo | the gold query audit cannot confirm what n8n runs | `gold-history-query-audit-20260906` |

`docs/HISTORICAL_DATA_INVENTORY.md` in this worktree is stale: it still says only DE 2-year coverage is complete to
target, which the 725-session replay has since overtaken. Do not cite it as current.

## 7. Duplicates, orphans and contradictions a new area must resolve

1. **Two directional answers for the same archive.** The checker replay says the published calls were right about half the
   time at 24 hours; the L2L study says session direction was below always-bullish. Both are correct about different
   questions. A single "accuracy" column would be a lie.
2. **Two backtesters.** The September `script.js` Backtest tab (reach, edge, calibration, shadow) and the November
   `usd-layer1-backtester` page (point-in-time replay). The second supersedes the first's *method*, not its findings.
3. **`audit-v1` vs `audit-v1-superseded`.** Both sit in one folder with names that assume a reader knows which is current.
   Only `audit-v1` matches `run-v1`'s `run_sha256`.
4. **`audit-v1` vs `decision-rules-v1` outcome checks** (section 4, last part): 0 vs 403 mismatches, different arms,
   unlabelled.
5. **`phase-2-shadow-backtest` +23 points** against everything later measured at 47–53 %. Unexplained and un-reproduced.
6. **`research-proof-map.json`** still describes the September release board and a XAU/USD control surface; the live
   backtester is USD-centric. It is now a historical tracker.
7. **Checkers described as backtests.** In prose they are "backtest checkers"; mechanically they replay published calls at
   a 16:00 ET horizon. The word does real damage in a navigation label.
8. **Orphans.** Eight `l2l-*` files, five corpora, four gold audits and `eur-h1-ta-*` exist only on this branch and the
   stale local `main`; no published branch carries them, and the published half-L2L view asks for a file that is a live
   **404** there.


## 8. Access gaps: what this audit could not verify

| Gap | Effect on this document | What would close it |
| --- | --- | --- |
| No credentials for this assignment | Supabase row counts, n8n executions, spreadsheet sources and the live collector history are **unverified** | a read-only query lane with named views; the DDL in `backtester/sql/001…010` already encodes the intended shapes |
| n8n workflows are outside the repo (only `exports/`, 17 files, plus `automation/n8n/usd-l1-shadow-decision.workflow.json`) | "what the collector actually ran" cannot be confirmed; the gold query audit says so itself | export the live workflow and diff it against `exports/` |
| Intraday price caches stop at 2026-04-30 | no intraday study after that date is possible, so tests 3 and 4 stay blocked | an M5 backfill with a timestamped contract |
| `data/usd-24h-research-dataset.json` is missing | the 24h study is quotable but not reproducible | restore the dataset by SHA-256 or regenerate it from the registry stage list |
| No input vintages anywhere | the 725-morning gate cannot pass regardless of code quality | store `observed_at` beside every value, or stage a replay tape that carries it |

Nothing in this document should be read as a statement about data that lives only in Supabase or n8n.

## 9. Consolidation proposal (no moves made)

Principle: one authoritative home per question, and the folder name should say which question.

1. **Keep `data/usd-layer1-backtester/` as the only point-in-time backtest** and make it the Backtesting area's default
   view. Its five labels (`present`, `fresh`, `clocked`, `identified`, gate) are the vocabulary the whole area should use.
2. **Move the September research set under `data/research/` with a generation note per file** —
   `data/research/l2l-directional/` (seven files), `data/research/reach/` (adr + half-l2l), `data/research/gold/`
   (four audits + pilot), `data/research/calibration/` (two files), `data/research/edge/` (factor-edge-lab, shadow,
   eur-h1 + its dataset). No content change, only location plus a `README` that pins each file to its generation date and
   its prohibited claim. Order: reach first (most cited in prose), then calibration (cleanest), then l2l (largest, and its
   prohibition text must move with it), then gold, then edge.
3. **Leave the checker corpora off the published tree** and keep the frozen branch, but replace the fetch with an
   explicit "archived corpus, 59.4 MB, not loaded by default" state. For the `half-l2l-reach-research.json` 404, do not
   restore the file as-is: it is 35.3 MB, of which `row_level` is 23.4 MB, which is why it is not published. Publish a
   slim summary (`meta`, `source_audit`, `comparisons`, `monotonicity`, `manual_review` — 695 kB pretty-printed) and keep
   the full record on an archive branch.
4. **Archive, do not delete:** `audit-v1-superseded.json`, `backtest.json`, `backtesting-development.json`,
   `research-proof-map.json`. They are status history; each gets one sentence saying what superseded it.
5. **Never merge the three definitions.** If the area needs one headline, it is the gate rung (0 / 725), not an accuracy.

## 10. Handoff for the central Backtesting area

**This document is the inventory.** Companion reading, in the canonical checkout and in this order:
`docs/BACKTESTING_NATIVE_TAB.md` (what the November page does and why), `docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md` (the pre-registration template),
`docs/strategy/LAYER1_GOLD_FRONTIER_REDTEAM_AND_ENGINE_SCOPE_20261008.md` (the scope argument), and
`docs/research/usd-session/v1/` (the data contract and its exposed periods).

What has already been tested, and how it ended:

| Question | Answer | Confidence |
| --- | --- | --- |
| Do published calls resolve as called by the next 16:00 ET? | 54.39 % pooled layer 1 ex-flat (1,066 correct / 894 wrong over 1,960 decided calls; 981 flat and 153 unresolved out of 3,094 directional calls) and 56.10 % layer 2 (322 / 252 of 574 decided; 247 flat, 53 unresolved of 874); the 90–100 confidence bucket holds 14 calls, so the top band is not a finding, and bearish calls trail bullish inside the same bucket (30–39: 42.7 % vs 56.8 %) | moderate; 24-hour horizon, replay of published calls, no always-bullish control printed against it |
| Does price reach the marked level? | 70–72 % full, 97 % half | good as a reach measure, **not** an accuracy |
| Does session direction beat always-bullish? | no: 47.6–48.0 % vs 53.2–53.5 % | settled, final test consumed |
| Did a better 24-hour ruleset exist? | no: 46.25 % vs 52.78 % on the holdout | settled, pre-registered |
| Does the 05:00 Layer 1 book have edge? | unknown: 0 of 725 mornings pass the gate | the honest answer, and the reason the page exists |
| Does Gold's stored-call record beat always-bullish? | 54.88 % vs 52.44 % on 82 scored calls | weak; strict lane scores 0 |

Reuse directly: the confidence band and calibration vocabulary; the gate-plus-ladder display; the split discipline from the
24h study; the excursion-versus-direction distinction; the checker corpora as an archive (frozen branch).

Do not reuse: the shadow backtest's +23 point claim; the 97 % figure as an accuracy; any "45 % → 55 %" improvement that
comes from changing the horizon; the execution demo as a result.

Missing data to request: input vintages, an official 05:00 DXY print, M5 tape plus pre-setup level ladders, staged
calendars for the nine unstaged release types, FOMC consensus, and any intraday prices past 2026-04-30.

Next things to inspect: `data/research/usd-session/v1/exposed_periods.md` for which windows are contaminated;
`backtester/sql/006_research_query_layer.sql` as the intended warehouse contract; `exports/` (17 files) for the n8n side; and the
`open_judgements: 3` entries in `engine-v1` before touching any factor sign.

## 11. Method and reproduction

Read-only commands used, all against the canonical checkout by absolute path; scratch tools live in this worktree's
gitignored `tmp/`:

```powershell
# which tree holds which artefact
git -C D:/trading-agent-dashboard-codex cat-file -e origin/main:data/<name>.json

# counts and labels quoted above
node -e "const j=require('D:/trading-agent-dashboard-codex/data/usd-layer1-backtester/run-v1.json');console.log(j.validity_gate.ladder, j.tests.four_markets.usable_sessions)"

# page to data mapping
Select-String -Path 'script.js' -Pattern 'data/[a-z0-9-]+\.json'
```

Only `docs/strategy/` was written in this worktree, plus throwaway scratch scripts under the gitignored `tmp/`. No artefact
was moved or regenerated, so every figure remains attributable to its committed JSON.

The prescribed coordination channel could not be used for this report: `scripts/coordination.js` in the canonical
checkout exits because `docs/orchestration/projects.json` is absent there, the worktree copy refuses to run outside the
canonical root, this worker is not listed in the September registry, and `docs/orchestration/assignments/strategy.md`
does not exist. This document is therefore the report of record until the registry is restored.

