# Backtest handoff for the central Backtesting area

Prepared by the strategy worker, 2026-11-17, as the coordinator-facing package that sits on top of
`docs/strategy/BACKTEST_AUDIT.md`. Read-only: no dashboard, data or SQL file was changed. Every figure was read from
the artefact named beside it; nothing here is inferred from page copy.

Companion machine-readable index: `docs/strategy/backtest-index-v1.json` (31 studies, 8 fields each, 17 flagged
negative). A screen can render that file directly; this document is the human key to it.

---

## 1. Receipt

| Field | Value |
| --- | --- |
| Repository | `trading-agent-dashboard` — `https://github.com/kevincreedycars-debug/trading-agent-dashboard.git` |
| Checkout used for the audit | `D:/trading-agent-dashboard-codex/.local/worktrees/strategy` |
| Branch | `workers/strategy-advisory-20260920` |
| Commit | `ec253bbc4811cedea523a7dd533ab36780d12984` — "docs(strategy): coordinator handoff and machine index for the backtesting area". It adds this package and the index, and carries the audit corrections listed in §8. The audit body itself was first committed at `fc7392d9c16ff4fd8e162a5ab3541db520a1f1bb`. HEAD may be one commit later, a one-line record of this SHA. |
| Audit document | `docs/strategy/BACKTEST_AUDIT.md` |
| This package | `docs/strategy/BACKTEST_HANDOFF_FOR_COORDINATOR.md` |
| Machine index | `docs/strategy/backtest-index-v1.json` |
| Link | none. `workers/strategy-advisory-20260920` is local-only (not pushed), so
`https://github.com/kevincreedycars-debug/trading-agent-dashboard/blob/<sha>/docs/strategy/BACKTEST_AUDIT.md` is a 404
until the branch is pushed. The path is the durable reference; the SHA is `ec253bbc4811cedea523a7dd533ab36780d12984`,
which contains the corrected audit and this package. |

## 2. The two trees inspected

1. **Canonical checkout** — `D:/trading-agent-dashboard-codex`, branch `main-published`, HEAD
   `7aea9dfbebfea8c57a0a308b6a0cff0bd96c97fb`. This is the published truth: what `origin/main` serves and what the
   dashboard on the web reads.
2. **Strategy worktree** — `D:/trading-agent-dashboard-codex/.local/worktrees/strategy`, branch
   `workers/strategy-advisory-20260920`. It carries research artefacts that exist on no published branch: the whole
   `l2l-*` family, `half-l2l-reach-research.json`, `usd-layer1-backtester/`, the gold pilot and the EUR H1 baseline.

Two further refs were used only to date an absence, never edited: `origin/main` (the published tree) and the
preservation commit `30ffe5ba` "Preserve L2L directional research and session-close experiments".

## 3. Inspection ledger

### Inspected directly (file content read)

- All 31 studies in `backtest-index-v1.json`: JSON artefacts under `data/`, plus `data/research/` copies where present.
- `backtester/sql/001`–`010`: 20 table definitions and the 16 views created in `006_research_query_layer.sql`
  (`research_prediction_primary_summary`, `research_prediction_usd_benchmark_summary`,
  `research_usd_24h_direction_accuracy`, `research_accuracy_by_verdict_strength`,
  `research_accuracy_by_confidence_bucket`, `research_trade_quality_thresholds`, `research_overall_win_rate`,
  `research_win_rate_by_timeframe`, `research_win_rate_by_conviction_bucket`, `research_win_rate_by_weekday`,
  `research_win_rate_by_magnitude_bucket`, `research_win_rate_by_market_regime`, `research_factor_reliability`,
  `research_factor_contribution`, `research_best_factor_combinations`, `research_dashboard_infrastructure_status`).
  `005_usd_replay_foundation.sql` adds indexes only (938 bytes, no table).
- 16 exported n8n workflow JSONs in `exports/` plus `automation/n8n/usd-l1-shadow-decision.workflow.json`. Their Supabase
  nodes name exactly three runtime tables: `market_snapshots`, `agent_outputs`, `economic_events`. Node types present:
  `scheduleTrigger`, `executeCommand`, `code`, `if`, `supabase`, `github`, `executeWorkflowTrigger`, `stickyNote`, `noOp`.
  No Google Sheets node, no spreadsheet id, no `storage/v1` call.
- `script.js` around the research fetches: the REST base and publishable key at lines 57–58, the hosted research-library
  gateway at line 63, and the eight local research fetches at lines 27–34.

### Identified only through references (not queried)

- The live Supabase project `eaolqbrlywczinfordvg`. The client config in `script.js` proves the dashboard reads REST
  views and one edge function; the DDL proves which tables should exist. **No query was run** and no credential was used:
  the assignment forbids access, so row counts, freshness and whether the 16 views exist as written are unverified.
- The n8n instance that produced `exports/`. The exports are snapshots; their run history, credentials and schedule state
  are not in the repository.
- GitHub Actions publish workflow: inferred from `script.js` comments (1200 s publish cycle, Pages deploy timeout), not
  read as a workflow file.

### Inaccessible or absent

- **Spreadsheets: nothing to inspect.** Zero references to `spreadsheet`, `Google Sheet`, `spreadsheetId` or
  `sheetName` anywhere in the repository outside `node_modules` — no sheet-backed input exists in the code, so a sheet
  outside the repo would be invisible to this audit and to the dashboard.
- **Supabase storage:** no bucket, no `storage/v1`, no upload path. The research library is JSON in the repo plus a REST
  gateway; there is no file store to audit.
- **Coordination channel:** `scripts/coordination.js` fails in the canonical checkout (no `docs/orchestration/projects.json`),
  the worktree copy refuses to run outside the canonical root, this worker is absent from the September registry, and
  `docs/orchestration/assignments/strategy.md` does not exist. Reports went to files, not to the mailbox. Detail in §11 of
  the audit.
- **`usd-24h-research-dataset.json`:** referenced by the 24-hour study, never published. The study cannot be re-run from
  the published tree alone.

## 4. Compact index of every previous study

Full eight-field records (model, version, question, dates, metric definition, denominator, outcome, evidence, verdict)
are in `backtest-index-v1.json`. The table below is the same set, shortened for a screen.

`pub` = present on `origin/main`; `wt` = strategy worktree only.

| # | Study (version) | Question | Window | Metric | Denominator | Reported outcome | Evidence | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | checker-usd (no, `wt`) | did replay reproduce the published call | 2024-01-02→2026-04-30 | row parity, 24 h | 604 | 604 pass, 603 exact | `data/backtester-checker-usd-24h-2024-01.json` | archive of calls; never accuracy |
| 2 | checker-gold (no, `wt`) | same, GOLD | same | parity | 608 | 608 pass, 608 exact | `…-gold-24h-2024-2026.json` | archive; calibration input |
| 3 | checker-eur (no, `wt`) | same, EUR | same | parity | 602 | 602 pass, 602 exact | `…-eur-24h-2024-2026.json` | archive; calibration input |
| 4 | checker-nq (no, `wt`) | same, NQ (QQQ proxy) | same | parity | 604 | 604 pass, 604 exact | `…-nq-24h-2024-2026.json` | archive; calibration input |
| 5 | checker-btc (no, `wt`) | same, BTC | same | parity | 850 | 850 pass, 850 exact | `…-btc-24h-2024-2026.json` | archive; calibration input |
| 6 | half-l2l-reach-v2 (no, `wt`) | did price travel half or all of the L2L distance | 2023-11-01→2026-04-30 | reach in session; ADR20×0.5 and ×0.25 | 2,493 L1, 1,592 L2 | L1 70.5 % / **97.0 %**; L2 72.3 % / 97.3 % | `data/half-l2l-reach-research.json` | reach only; 97 % may not be called accuracy |
| 7 | adr-reach-v1 (pub) | full-distance reach over 24 h | 2023-11-01→2026-04-30 | l2lRangeAvailablePct | EUR 570 | EUR 72.3 % (412/158) | `data/adr-reach-research.json` | threshold tables reusable; headline superseded |
| 8 | trading-day-directional-v1 (no, `wt`) | does the call predict open-to-close | 2024-01-02→2026-04-30 | accuracy vs per-fold always-bullish | 4,085 (2,493 + 1,592) | L1 47.65 %, L2 47.99 %; baseline wins 5 of 6 folds | `data/l2l-trading-day-directional-v1.json` | negative; population reusable |
| 9 | discrimination-v1 (no, `wt`) | does the called side reach more than the other | same | paired reach difference, McNemar | 2,493 / 1,592 | −2.61 / −1.76 pp half; bearish asymmetry p 0.0076 | `data/l2l-directional-discrimination-v1.json` | negative, `BEARISH_ASYMMETRY_ONLY` |
| 10 | failure-diagnostics-v1 (no, `wt`) | where does it fail | same | excess vs baseline | 4,085 | −5.54 / −5.46 pp; bullish 50.69/51.12, bearish 42.96/42.33 | `data/l2l-directional-failure-diagnostics-v1.json` | negative; bearish weakness is a diagnostic |
| 11 | research-verdict-v1 (no, `wt`) | what may be claimed | same | frozen summary of hashed files | 4,085 | `validatedPredictor…: false`; four claims prohibited | `data/l2l-directional-research-verdict-v1.json` | the authority on wording |
| 12 | signal-construction-audit-v1 (no, `wt`) | defect or horizon mismatch | same | code trace, exact reproduction | 4,085 | `horizon_mismatch`; no defect | `data/l2l-signal-construction-audit-v1.json` | read before "fixing" the calls |
| 13 | excursion-reconciliation-v1 (no, `wt`) | why 97 % vs 64.34 % | same | transition matrix | 4,085 | 1,325 original-only half hits, 1,207 with later swing | `data/l2l-excursion-definition-reconciliation-v1.json` | 97 % is path dependent |
| 14 | session-close-redesign-v1 (no, `wt`) | could a pre-open predictor exist | same | input-timing audit | 4,085 | `INPUT_TIMING_NOT_DEFENSIBLE` | `data/l2l-session-close-redesign-feasibility-v1.json` | reusable as the 05:00 requirements list |
| 15 | executable-entry-v1-draft (no, `wt`) | what would a real test need | same | design only | none scored | draft blocked on costs and M5 | `data/half-l2l-executable-entry-v1-draft.json` | spec for the first real backtest |
| 16 | factor-edge-lab-v1 (pub) | which factor carried the call | 2024-01-02→2026-04-30 | per-factor ex-flat win rate | USD 604 obs, 10 factors | F10 62.5; F2 56.9; F7 −45.5 | `data/factor-edge-lab.json` | descriptive survey, not a ranking |
| 17 | confidence-calibration-v1 (pub) | does confidence match hit rate | corpora window | ex-flat per 10-pt bucket; gap; folds | L1 3,268 rows / 3,094 calls; L2 874 | L1 54.39 % (1,066/894; 981 flat), L2 56.10 %; 90-100 bucket = 14 calls | `data/confidence-calibration.json` | labelling vocabulary reusable; 16:00 ET horizon |
| 18 | confidence-band-delivery-v3 (pub) | what may a band be labelled | corpora window | 330 band rows; tiers 0-9/10-29/30-99/100+ | 330 rows | delivery contract plus reconciliation block | `data/confidence-band-delivery.json` | use verbatim for band displays |
| 19 | phase2-shadow-backtest-v1 (pub) | would a shadow book have beaten live | 2024-01-02→2026-04-30 | ex-flat win rate, shadow vs live | 5 assets | claims +23 pp; 2 improved, 0 degraded, 3 mixed | `data/phase-2-shadow-backtest.json` | non-authoritative; do not publish +23 pp |
| 20 | gold-stored-call-pilot-v1 (pub) | does the stored Gold record beat always-bullish | 154 calls, split at 2026-08-01 | ex-flat accuracy, two lanes | strict 0/154; endpoint 97 evaluable | endpoint 54.88 % vs 52.44 %; training 68 %, validation 34.38 % | `data/gold-stored-call-pilot-20260906.json` | raw calls reusable; 54.88 % unstable |
| 21 | eur-h1-ta-baseline-v1 (pub) | does an H1 TA rule set beat always-long | 2024→2025-10, source stops 2026-04-30 | ex-flat accuracy per split | 205 / 153 / 118 | validation 56.21 % vs 53.59 %; final 42.37 % vs 44.92 % | `data/eur-h1-ta-directional-baseline-v1.json` | worked example of a clean failure |
| 22 | phase2-tracker (pub) | pipeline status, no performance claim | January 2024 | counts only | 22 snapshots, 88 predictions, 880 factor rows | status document | `data/backtest.json` | archive only |
| 23 | engine + proof-map trackers (pub) | engine state and release gate | 2024-01-02→2026-04-30 | status lanes, gates | 448 eligible calls | 73.2 % full (328/448), 99.1 % half (444/448); grade `UNAVAILABLE` | `data/backtest-engine.json`, `data/research-proof-map.json` | gate vocabulary reusable; different population from row 6 |
| 24 | usd-layer1-backtester run-v1 (no, `wt`) | can the USD book be replayed point-in-time | 2024-01-02→2026-10-12, cutoff 05:00 London | gate ladder; execution states | 725 sessions, 320 eligible, 196 calls, 62 trades | present 618, fresh 617, **clocked 0, identified 0**; bands 22/105/50/19/0 | `data/usd-layer1-backtester/run-v1.json` | most reusable engine; 0/725 is a label |
| 25 | run-v1 test 1 (no, `wt`) | official cash DXY direction | same | direction agreement | 0 scored | blocked: no official DXY with a 05:00 quote | `run-v1.json` `tests.dxy_official` | missing-input list, not a result |
| 26 | run-v1 test 1b (no, `wt`) | same on broker `DXY.cash` CFD | same | agreement, lower bound | 480 in scope, 360 priced | `scored_proxy`; current 49.65 % (284), challenger 42.93 %, v1 43.54 % | `run-v1.json` `tests.dxy_proxy` | proxy lane only; `is_official_cash_dxy: false` |
| 27 | run-v1 test 2 (no, `wt`) | four markets against the inverted USD call | same | agreement, joint hits | 685 priced; 196 calls; 439-536 scored per market | v1 book 49.2/55.7/46.5/44.6 %; live arm 49.43/55.68/52.86/50.00 % | `run-v1.json` `tests.four_markets`; `decision-rules-v1.json` | never quote the 167-call superseded arm |
| 28 | run-v1 tests 3 and 4 (no, `wt`) | 5R and 3R L2L geometry | same | R-multiple under OHLC sequencing | 0 usable | blocked: no M5 tape, no pre-setup ladder | `run-v1.json` `tests.l2l_*` | the only profitability-shaped tests are empty |
| 29 | run-v1 execution demo (no, `wt`) | does order plumbing work | 2026-11-05→06 | fills, percentage change | 6 fills | +6.97 %, direction taken from the live fill | `run-v1.json` `execution_demo` | plumbing only; never a backtest |
| 30 | usd-session-engine-v1 book (no, `wt`) | what did the frozen rule book produce | 2024-01-02→2026-10-12 | states, failures, bands | 725 mornings | 41 allowed / 541 blocked / 143 abstained; 62 traded | `data/usd-layer1-backtester/engine-v1.json` | rule book reusable; counts carry no edge |
| 31 | usd-24h-selection-v1 (pub) | can a 17-feature challenger beat the engine | 2024-01-02→2026-04-30 | holdout ex-flat accuracy, 60 % target | 583 rows, 93 configs, 80 decided | 46.25 % vs 52.78 %; `not_supported` | `data/usd-24h-selection.json`, `docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md` | pre-registration pattern reusable; clean negative |

Rows 6 and 8–15 are one research chain and must be read together: the reach, direction, discrimination, verdict,
reconciliation and redesign files all cover the same 4,085 calls, and the sum of them is a negative result, not a set of
options.


## 5. The two figures that travel, with their exact labels

**97 %** — "97.0 % of layer 1 calls (2,418 of 2,493; 95 % CI 96.25–97.59) and 97.3 % of layer 2 calls (1,549 of 1,592;
CI 96.38–97.99) reached half the standard L2L distance inside the session attached to the call. Half distance is ADR20 ×
0.25 against a standard of ADR20 × 0.5. This is a reach rate: there is no entry, stop, sequence or adverse boundary, so
it is not a win rate or a directional accuracy, and the same calls score 64.34 % under a session-anchored walk."

Use that sentence or nothing. The four prohibited forms are listed in `l2l-directional-research-verdict-v1.json`:
directional accuracy, win rate, evidence of reliability, executable forecasting result.

**0/725** — belongs to one legacy gate, not to the models: `run-v1.validity_gate.ladder` reads present 618, fresh 617,
clocked 0, identified 0 of 725 sessions (directional-call scope 451, 450, 0, 0 of 515). It fails because stored values
carry no observed-at stamp, while the session cutoffs themselves are recorded (`cutoff_at_utc`, 05:00 London). One
hundred and seven sessions are absent from "present" for ordinary coverage reasons; the 0 is an input-provenance
verdict.

## 6. Reusable assets for VSC 1, in priority order

"Requirement" is the thing the asset already satisfies. "Missing for 05:00 London" is what still blocks a defensible
morning backtest, not a display.

| P | Asset | Satisfies | Missing for 05:00 London |
| --- | --- | --- | --- |
| P1 | `run-v1.sessions[*]` (`saved_inputs`, `audit_values`, `input_meta`, `cutoff_at_utc`) | the "present" rung: 725 mornings of the nine inputs, 196 directional calls, 62 trades, all traceable | a per-value observed-at stamp (that is the whole 0/725 story); `input_meta` records a source date and age, not a vintage; no sessions after 2026-10-12 |
| P1 | `engine-v1.book` (25 rows, `frozen_on`, execution states) | a deterministic, readable rule book with an audit trail and named failure codes | factor signs and weights (`rule_defined: false`, six open judgements), so the book cannot be re-derived from data alone |
| P1 | `backtester/tmp/ftmo_dxy_cash_h1.csv` (hashed, 10,052 hourly rows from 2024-12-10) | a dollar-index benchmark lane for test 1b, already replayed | the official ICE cash DXY and a 05:00 quote; this is one broker's spot CFD (`is_official_cash_dxy: false`) |
| P1 | `data/l2l-levels.json` plus the ladder block in `audit-v1.l2l` (stamp 2026-10-04T16:14:19Z) | a genuine pre-setup ladder for six sessions, 2026-10-05 to 2026-10-12 | ladders archived before 05:00 for the other mornings; without them tests 3 and 4 stay at zero |
| P1 | `data/half-l2l-reach-research.json` (or the 695 kB slim version) | the reach definition, per-asset and per-pair tables, coverage and fold columns | nothing for display; it cannot serve as a trading input because it has no entry, stop or sequencing |
| P2 | the five checker corpora (59.4 MB, frozen branch) | per-call archive of what was published, with factor arguments; the only source for calibration | publication stamps (they are date-keyed with a next-16:00 horizon), and they are not on the published tree |
| P2 | `f8-fomc-statements-v1` (23 records, hashed with clocks) and `event-calendar-v1` | the FOMC text lane and 23 event windows, staged `partial_staged` | the other nine release types; FOMC consensus and expectations; wiring into the engine (statements are `staged_not_wired`, which is why band 5 is unreachable) |
| P2 | gold pilot stored calls (154) with two evaluation lanes | a small, honest labelled set and a two-lane design worth copying | a clock that separates storage from publication; the strict lane scores 0 of 154 for exactly that reason |
| P2 | `confidence-calibration-v1` + `confidence-band-delivery-v3` | the labelling vocabulary: bucket, tier, gap, fold, insufficient-evidence rule | recomputation on point-in-time inputs; today's numbers belong to the 16:00 ET horizon |
| P2 | 16 exported n8n workflows | collector cadence and table contract (`market_snapshots`, `agent_outputs`, `economic_events`) | run timestamps and the live instance; exports cannot prove when a snapshot was written |
| P3 | `usd-24h-selection.json` + registry (93 configurations) | a pre-registration and filter pattern that survives a negative result | the referenced dataset is absent from the published tree, so it cannot be re-run |
| P3 | `l2l-session-close-eur-h1-ta-v1.json` dataset | a worked chronological split with a stated failure | any 05:00 feature; 128 input records are dropped before features are built |
| P3 | `half-l2l-executable-entry-v1-draft.json` | the design of the first genuine test (entry, sequencing, costs) | approved costs and 5-minute data |
| P3 | `phase-2-shadow-backtest.json` | nothing until its pooling is re-derived | the +23 pp must not be published |

Raw data is worth keeping even where the claim is dead: the checker corpora, the gold stored calls, the EUR H1 dataset
and the reach row-level file are all reusable as inputs or as worked examples. What must not travel is the performance
sentence attached to each.


## 7. The blank half-level view: repair brief for VSC 1

| Item | Value |
| --- | --- |
| Page | `index.html` → Backtest tab → sub-tab **L2L Directional Accuracy**, button `data-backtest-tab="half-l2l-reach"`, target panel `#backtestPanel` |
| Requested path | `./data/half-l2l-reach-research.json?v=20260809-half-l2l-reach-v2` — `script.js` line 28, resolved at line 22325, wired into the research payload at line 22516 as `half_l2l_reach` |
| Observed failure | HTTP 404. `resolveResearchTask(..., null)` swallows it, so the renderer at line 12531 falls through to the card "50% L2L Reach unavailable — The downstream 50% L2L Reach artifact could not be loaded." The reader sees no path, no status and no console error |
| Second defect | the sub-tab is named "L2L Directional Accuracy" while the artefact is reach research. That is the conflation the verdict file prohibits, printed in the navigation |
| Authoritative source | `data/half-l2l-reach-research.json`, version `half-l2l-reach-v2`, generated 2026-08-10T08:53:37Z by `backtester/scripts/validate_half_l2l_reach_research.js`. Present in the strategy worktree and in the canonical checkout's local `main` (preservation commit `30ffe5ba`); absent from `origin/main` and from every published branch. Size 35.3 MB, of which `row_level` is 23.4 MB |
| Smallest safe repair | publish a slim `data/half-l2l-reach-summary.json` containing only `meta`, `source_audit`, `comparisons`, `monotonicity`, `manual_review` (695 kB pretty-printed, roughly 300 kB minified), point line 28 at it, change the empty-state copy to name the archive path, and keep the full file on an archive branch. No renderer change is needed: every field `renderResearchHalfL2lReach` reads lives in `meta` and `comparisons` |
| Second smallest | if publishing is unwanted, rename the sub-tab to "L2L Reach Research" and make the card say where the archive lives. That removes the false claim and the dead end, and leaves the data unpublished |

Boundary: the strategy worker changed no dashboard file, no data file and no SQL, and pushed nothing. `script.js`,
`index.html` and `data/` are untouched by this audit, so VSC 1 can take the repair without a merge conflict from here.

## 8. Corrections this handoff makes to the first audit

Four figures were tightened after re-reading the files. The first audit's structure stands; these are the changed lines.

1. **Four markets.** The 167-call arm scoring EUR/USD 50.0 %, XAU/USD 58.6 %, NAS100 51.9 %, BTC/USD 46.6 % is
   `scored.superseded`, pinned to run `9e4b8d5f`. The current book makes 196 calls at 49.2 / 55.7 / 46.5 / 44.6 %, and the
   live-engine arm scores 49.43 / 55.68 / 52.86 / 50.00 % on 439–536 calls per market. Quoting 58.6 % is quoting a
   replaced run.
2. **Reach corroboration.** `backtest-engine.json`'s 73.2 % (328/448) and 99.1 % (444/448) are a different population
   from `half-l2l-reach-v2` (2,493 and 1,592 calls). The two must not be presented together.
3. **Calibration headline.** "About 50 %, rising to 55–59 % in the top bands on 20–50 scored calls" was wrong in both
   directions. Layer 1 pooled is 54.39 % ex-flat over 1,960 decided calls (1,066 correct, 894 wrong; 981 flat and 153
   unresolved of 3,094 directional calls); layer 2 is 56.10 % (322 / 252 of 574). The 90–100 bucket holds 14 calls, and
   the largest high buckets hold hundreds, not tens.
4. **The blank view.** It is not silent: it shows a generic unavailable card. The cause is still unstated, and the
   sub-tab's name is itself a prohibited conflation.

Two additions: the fold-by-fold baseline (always-bullish wins five of six folds, §3 of the audit) and the
97 % → 64.34 % reconciliation. Both were derivable from the committed files and neither was in the first draft.

## 9. What remains unverified

- Supabase: schema read, nothing queried. Live row counts, view definitions at runtime and freshness are unknown.
- n8n: exports read, instance not reached. No run history.
- Storage and spreadsheets: absent from the repository; if either exists outside it, this audit cannot see it.
- Coordination: unusable in this checkout (missing `docs/orchestration/projects.json`, worker absent from the September
  registry, assignment file missing). Reports live in `docs/strategy/` only.
- The four-market and 24-hour numbers cannot be extended past 2026-04-30 (intraday sources) or 2026-10-12 (session
  windows) without new input data.
- No claim in this package is a recommendation to trade. The rule book is `RESEARCH_FROZEN_NOT_VALIDATED`, the gate
  never reaches "clocked", and the only tests that could speak to profitability score zero usable sessions.

