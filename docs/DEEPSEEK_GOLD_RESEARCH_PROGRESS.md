# DeepSeek Gold research progress

Milestone: first assignment of `docs/DEEPSEEK_GOLD_RESEARCH_HANDOFF.md` — variable/horizon/prior-context
registry, deterministic coverage audit, tests, real-local-source evidence and implementation gap report.

Branch: `docs/gold-variable-research-scope` (not switched or reset). Recorded 2026-09-19. This document is
the deliverable for handoff section 7; it contains no secrets and no bulk raw data.

## 1. Owned files and what was implemented

New files created (all inside the handoff's owned list):

| File | What it contains |
| --- | --- |
| `backtester/registries/gold_variable_horizon_context.v1.json` | Scope declaration: all 28 declared inventory variables in the exact order of `GOLD_VARIABLES`, each with definition, units, value kind, event type, transformations, source/schema mapping, timestamp and version semantics, applicable horizons, known gaps and a coverage status. Five candidate horizons, eight prior-context fields with strict cutoff rules and leakage guards, three forbidden-context rules, two additional local series outside the declared 28, the verified derived-name alias map, the production-snapshot caveat, six unresolved policies and six known gaps. |
| `backtester/lib/gold_variable_coverage.js` | Deterministic readers for FRED vintage archives, OANDA H1 candle archives and event-calendar archives, plus the audit builder, Markdown renderer, registry validator, prior-observation selectors and the `checkResult` evidence guard. |
| `backtester/scripts/audit_gold_variable_coverage.js` | CLI. Accepts `FRED_DIRECTORY HOURLY_DIRECTORY EVENTS_DIRECTORY NEW_OUTPUT_DIRECTORY [REGISTRY_JSON]`, accepts the token `none` for a deliberately absent source, writes `coverage.json` and `COVERAGE.md` with the exclusive `wx` flag, and refuses to overwrite existing reports. |
| `backtester/tests/gold_variable_coverage.test.js` | 24 tests: registry/inventory agreement, registry validation failures, evidence guard, FRED/hourly/event readers, cutoff boundary table, prior-context coverage paths, horizon geometry against hand-counted expectations, event-to-candle alignment, unsupported-horizon handling, denominators, determinism, Markdown, CLI overwrite refusal and absence-of-accuracy assertions. |
| `backtester/tests/fixtures/gold-variable-coverage/{fred/DFII10.json,fred/DGS2.json,hourly/candles.json,events/events.json}` | Synthetic fixtures with their intended defects and expected counts recorded in `_fixture` blocks. |
| `backtester/docs/gold_variable_coverage.md` | Implementation documentation: purpose, artifacts, usage, registry vocabulary, horizon semantics, prior-context rule, deduplication policy, determinism, evidence locations and limits. |
| `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md` | This report. |

Existing modules were read and reused without modification: `gold_source_readiness.js` (inventory
constant), `gold_timestamped_evaluation.js` (`parseTimestamp`) and `gold_macro_vintage_dataset.js` (the
36-hour conservative lag and the implemented series names). The strict exact-24-hour evaluator was not
edited and was not consulted for any additional horizon.

Implementation findings that shaped the registry:

- The declared shorthand transformation IDs are not the implemented feature names. The engine emits
  `<source>_change_<lag>_<unit>` (for example `us_10y_real_yield_change_5_bps`,
  `vix_level_change_1_pct`). The registry records the verified alias map, and a test asserts that the
  alias map and the series map still agree with `gold_macro_vintage_dataset.js`.
- Six declared transformations have no local implementation at all: `dxy_d1`, `dxy_d5`, `dxy_d20`,
  `gold_d1_pct`, `gold_d5_pct`, `gold_d20_pct`. They exist only as live-agent, replay or asset-builder
  inputs, so they are reported as `unknown` rather than assumed available.
- Six declared variables have no verified local source: `dxy_level` and its transforms, `fed_bias`,
  `inflation_signal`, `risk_headline_context`, `equities_regime`, `growth_regime`.
- Twenty of the twenty-eight entries are levels or transformations of five macro/price series, so the
  inventory is not twenty independent raw inputs.
- `us_10y_yield` (DGS10) and `broad_usd_index` (DTWEXBGS) exist locally but are outside the declared 28.
  DTWEXBGS is not ICE DXY and must not be relabelled as the `dxy_*` variables.

## 2. Exact commands and observed results

Focused suite (synthetic fixtures):

```powershell
node --test backtester/tests/gold_variable_coverage.test.js
```

Observed: 24 tests, 24 pass, 0 fail. These are fixture and contract tests; they are not market evidence.

Real local sources (read-only, ignored output directory):

```powershell
node backtester/scripts/audit_gold_variable_coverage.js backtester/tmp/gold-fred-extended-20260918 backtester/tmp/gold-hourly-extended-20260918 backtester/tmp/gold-calendar-extended-20260918 backtester/tmp/gold-variable-coverage-20260919
```

Observed: exit 0. Wrote `backtester/tmp/gold-variable-coverage-20260919/coverage.json` and `COVERAGE.md`.
This is a real-source execution, not a fixture run. No remote query, no warehouse access and no new
acquisition occurred.

Full local suite:

```powershell
npm.cmd test
```

Observed: 71 local test files, 360 tests, 357 pass, 3 fail, 0 cancelled. The three failures are all in
`backtester/tests/secret_scanner.test.js` and are pre-existing environmental failures unrelated to this
milestone:

- `scripts/check-repo-for-secrets.ps1` and that test file are unmodified, which `git status` confirms.
- The tests build their own temporary repositories, so none of the files created here is in their scope.
- Direct probe: the scanner exits 1 and prints `keys.txt 1 private-...` for a private-key fixture. The
  Pattern column is truncated by the host's default output width, so `/private-key-header/` cannot match
  the captured stdout in this non-interactive environment.
- The documented baseline before this milestone was 336/336; this milestone adds exactly 24 tests
  (336 + 24 = 360), so those three failures were not introduced by the new tests.

Repository hygiene (run after all edits; results in section 5):

```powershell
git diff --check
git status --short --untracked-files=all
```

Routine implementation choices were resolved without escalation: positional CLI arguments matching the
sibling `run_gold_research_bundle.js` convention; a literal `none` token instead of inventing absent
sources; `content_sha256` excluding only run metadata so determinism is testable; and the earliest
non-null FRED vintage as the availability basis, because using the newest revision understated coverage
for heavily revised series.


## 3. Compact coverage totals, evidence locations and hashes

Evidence location (ignored, local only): `backtester/tmp/gold-variable-coverage-20260919/coverage.json` and
`backtester/tmp/gold-variable-coverage-20260919/COVERAGE.md`.

- Report `content_sha256`: `278b4070ab4e47cae82fa755d341265141e0983e7dde0b338e8461302b846123`
- Registry `sha256`: `4075f110ee29cc38775dd2e39e0e2567675068d48f0e5e0ec223e0bc1eec1d3e`
- Registry version: `gold-variable-horizon-context-v1`

Sources and hashes (as recorded in the report):

| Source | File | SHA-256 |
| --- | --- | --- |
| FRED vintages | `DFII10.json` | `33e76f1763959bda85de102321d180d57654c050bdb5535bbc841e59b9d9ba3b` |
| FRED vintages | `DGS2.json` | `a7285f40e5bf9568b93b938dc3448c929dc4fd8ecee633290c5a1f64c59dcc47` |
| FRED vintages | `DGS10.json` | `ea597deba93fa48817f47d1f0ce114d1b1aaa160b0ad7b36feeb4c6660fee112` |
| FRED vintages | `DTWEXBGS.json` | `51064923587d8c2b72104131cf6ba293c726380faac3c0ce374e55e6244a4977` |
| FRED vintages | `VIXCLS.json` | `53907005aba33d7beb140c4c73f0b322283aa43f53fd190c9bcfad80c741ea07` |
| Hourly candles | `candles.json` | `20ff2299f8c8d42269bb99f683d43f12d0fb7cb1c1f5c538ffc1a7f13d8ff392` |
| Event archive | `events.json` | `eb23079944e1c5a6293f59a034f631c4e744a2e55186858fd287f4c01c266586` |

Manifest versions: `gold-fred-vintage-acquisition-v1`, `gold-hourly-acquisition-v1`,
`gold-event-archive-merged-v1`.

Variable coverage:

- Declared inventory: 28. Variables with a present local source in this run: 16.
- By source backing: `fred_series` 3, `derived_macro` 6, `hourly_candles` 1, `event_calendar` 6,
  `none` 6, `unmapped_transformation` 6 (sums to 28).
- By coverage status: `verified_local_source` 3, `verified_derived_from_local_source` 6,
  `proposed_mapping` 10, `unavailable_no_local_source` 9 (sums to 28).
- Checks executed: 142 — `passed` 58, `failed` 17, `unknown` 66, `not_applicable` 1.
- Variable checks that failed: `gold_price:continuity`, `event_actual`, `event_consensus`,
  `event_previous_as_released`, `event_surprise` (field completeness).

FRED archives:

| Series | Raw rows | Distinct dates | Missing values | Revision rows |
| --- | ---: | ---: | ---: | ---: |
| DFII10 | 1,008 | 1,008 | 44 | 0 |
| DGS2 | 1,008 | 1,008 | 44 | 0 |
| DGS10 | 1,008 | 1,008 | 44 | 0 |
| DTWEXBGS | 2,146 | 1,004 | 42 | 1,142 |
| VIXCLS | 1,010 | 1,009 | 13 | 1 |

Hourly archive: 21,871 usable bars from 2023-01-02T23:00Z to 2026-09-11T20:00Z; 953 intra-span gaps over
one hour, 192 of them crossing a weekend boundary, largest gap 74 hours. Gaps remain unclassified because
no XAU/USD session calendar is declared.

Anchor cohorts: 965 weekday 14:00Z daily snapshot anchors and 5,115 event release anchors, always reported
separately.

Horizon availability (exact candle-open matching, no partial bars):

| Horizon | Cohort | Anchors | Outside coverage | Entry exact | Endpoint exact | Both | Both and contiguous |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `h1_post_event` | daily | 965 | 1 | 954 | 954 | 954 | 954 |
| `h1_post_event` | events | 5,115 | 89 | 1,898 | 1,882 | 1,867 | 1,867 |
| `h4_post_event` | daily | 965 | 1 | 954 | 951 | 951 | 951 |
| `h4_post_event` | events | 5,115 | 90 | 1,897 | 1,826 | 1,811 | 1,495 |
| `h24_post_event` | daily | 965 | 2 | 953 | 763 | 757 | 0 |
| `h24_post_event` | events | 5,115 | 98 | 1,893 | 1,323 | 1,313 | 0 |

`immediate_event_window` is `not_applicable` with reason `sub_hourly_window_not_measurable_from_h1_bars`
and produces no counts. `d5_trading_days_post_event` is `unknown` with reason
`session_calendar_policy_pending` for both cohorts.

Cross-check against `docs/GOLD_EXTENDED_RESEARCH_20260918.md`: that run reported 964 scheduled decisions,
208 exclusions, 196 missing horizon candles plus 4 windows without candles, and 756 endpoint-evaluable
windows all failing strict continuity. This audit independently finds 196 + 4 = 200 missing entry/endpoint
candles on its own grid and 757 both-endpoint windows with zero contiguous — the difference of one window
comes from the extra candle day 2026-09-11 in the hourly archive, which the research schedule did not
include. The two independent procedures therefore reconcile.

Event release audit: 5,115 rows, all with a parsable release timestamp; 5,115 unique releases under
`eventId|dateUtc|name`, 0 duplicate rows, 0 overlapping groups under `dateUtc|name`, 136 event families.
Missing actual 1,911; missing consensus 2,591; missing previous 1,912; archive revision present 1,779;
unusable for an event study without both actual and consensus 2,745 (53.7%). Country counts `{"US":5115}`.
Every row carries an archive `lastUpdated` epoch, which the audit deliberately does not read as a
consensus or release vintage.

Prior-context coverage (strictly-before cutoffs, usable non-null values only):

| Field | Daily anchors | Event anchors | Anchors that would change under an inclusive cutoff |
| --- | ---: | ---: | ---: |
| `us_10y_real_yield_prior_5obs_change_bps` | 965/965 | 5,115/5,115 | 0 |
| `us_2y_yield_prior_5obs_change_bps` | 965/965 | 5,115/5,115 | 0 |
| `us_10y_yield_prior_5obs_change_bps` | 965/965 | 5,115/5,115 | 0 |
| `broad_usd_index_prior_5obs_change_pct` | 965/965 | 5,115/5,115 | 0 |
| `recent_event_surprise_state` | 965/965 | 5,109/5,115 | n/a |
| `hours_since_last_release` | 965/965 | 5,109/5,115 | n/a |

`gold_trailing_5d_return_pct` and `gold_trailing_5d_realized_volatility` are `unknown` with reason
`session_calendar_or_estimator_policy_pending`, as declared.


## 4. Proven gaps versus unverified assumptions

This section was completed at the checkpoint review, because the first delivery stopped after section 3.
Every statement below is taken from the checked-in registry, the generated report or the review's own
independent re-run; none of it is inferred from a passing test.

Proven gaps (measured against the local versioned sources):

- Nine declared variables have no verified local source: `dxy_level`, `dxy_d1`, `dxy_d5`, `dxy_d20`,
  `fed_bias`, `inflation_signal`, `risk_headline_context`, `equities_regime`, `growth_regime`. The audit
  counts sixteen of twenty-eight variables with a present local source.
- Six declared transformations have no local implementation: `dxy_d1`, `dxy_d5`, `dxy_d20`,
  `gold_d1_pct`, `gold_d5_pct`, `gold_d20_pct`. `gold_price` itself exists, so these three are blocked by
  missing implementation rather than by a missing series.
- The registry and the audit label the ICE DXY transformations differently, and both labels are correct:
  the registry reports `unavailable_no_local_source` because the base series is absent, while the audit
  reports `unmapped_transformation` because the implementation check is evaluated first. Neither is a pass.
- The exact 24-hour horizon has zero contiguous windows in either cohort: 757 both-endpoint daily anchors
  and 1,313 both-endpoint event anchors, all with gaps; 953 intra-span hourly gaps remain unclassified
  because no XAU/USD session calendar is declared.
- Event surprises are retrospective only: 2,591 of 5,115 rows carry no consensus value, 2,745 (53.7%)
  cannot support an event study at all, and the archive exposes no pre-release consensus vintage.
- The immediate sub-hourly window is unsupported at H1 resolution and produces no counts.
- The five-trading-day horizon and the two trailing five-trading-day price-context fields are `unknown`
  pending a session calendar and a volatility-estimator declaration.
- The originally supplied external research documents are unavailable, so the original input set beyond
  the repository logic document stays unverified.
- Family identity is not connected to the live agent's `latest_us_event` vocabulary, so archive event
  families cannot yet be joined to production event labels.

Unverified assumptions that the evidence must not be read as supporting:

- FRED availability uses `realtime_start` plus a 36-hour conservative proxy. That is a documented proxy,
  not an authenticated publication time, and intraday availability is unestablished.
- Stored production snapshots reportedly carry nineteen of the twenty-eight fields as exact top-level
  values. That evidence is retrospective, is not verified in this milestone, and its storage timestamps
  are proxies rather than publication times.
- The archive's `lastUpdated` field is archive-update evidence and is never a release or consensus vintage.
- `eventId|dateUtc|name` is a declared deduplication policy. It is not proof that each retained row is a
  distinct real-world release, and repeated releases inside one daily observation remain unresolved.

Proposed next actions are the report's own generated list, in order: resolve, replace or formally retire
the six unavailable variables and the six unimplemented transformations; declare the XAU/USD session
calendar before any five-trading-day or trailing-five-day measurement; declare the anchor-to-candle
alignment rule before measuring one-hour and four-hour reactions; authenticate pre-release consensus
vintages; classify the 953 hourly gaps; then build the individual-variable reaction report on the resolved
subset only, with combination search, formula development and untouched-data qualification kept out of
scope until those policies are reviewed.

## 5. Changed files, commit status and inherited edits

New files delivered by this milestone, all committed by the checkpoint review:

| File | State at review |
| --- | --- |
| `backtester/registries/gold_variable_horizon_context.v1.json` | untracked, sha256 `4075f110ee29cc38775dd2e39e0e2567675068d48f0e5e0ec223e0bc1eec1d3e` |
| `backtester/lib/gold_variable_coverage.js` | untracked, reviewed in full |
| `backtester/scripts/audit_gold_variable_coverage.js` | untracked, reviewed in full |
| `backtester/tests/gold_variable_coverage.test.js` | untracked, 24 tests |
| `backtester/tests/fixtures/gold-variable-coverage/` (4 files) | untracked, synthetic only |
| `backtester/docs/gold_variable_coverage.md` | untracked, implementation documentation |
| `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md` | untracked, this report |

Existing modules were read and reused without modification: `gold_source_readiness.js`,
`gold_timestamped_evaluation.js` and `gold_macro_vintage_dataset.js`. The strict exact-24-hour evaluator is
unchanged. No commit ID is claimed here, because the milestone was still uncommitted when the first
delivery was written; the checkpoint review records the commit reference in `docs/CHANGELOG.md`.

Inherited edits left untouched by this milestone and committed separately by the review: the seven
agreed-scope documents (`CURRENT_STATE`, `CURRENT_TASK`, `ACTIVE_MILESTONE`, `SESSION_NOTES`, `CHANGELOG`,
`BACKTESTING_REVIEW_PLAN`, `GOLD_RESEARCH_DELIVERY_CONTRACT`) and `docs/DEEPSEEK_GOLD_RESEARCH_HANDOFF.md`.
Untouched throughout: sealed Layer 1 logic, production exports, dashboard UI, package and lock files,
frozen reports, existing registries and other builders' files. Generated evidence stayed in the ignored
`backtester/tmp/gold-variable-coverage-20260919/` and `backtester/tmp/checkpoint-coverage-20260920*/`
directories. No branch was switched or reset.

## 6. No production or predictive change

- No n8n workflow, credential, Supabase schema, linked-warehouse row or published dashboard artifact was
  created, edited, activated or mutated.
- No combination search, formula, directional call or qualification was produced. The report carries
  `research_only: true`, `executable_trade_validated: false` and `qualified_for_live_calls: false`, and a
  test asserts that no accuracy, win-rate, pnl, expectancy or Sharpe field can appear in it.
- Availability is not association: the audit answers which declared inputs can be measured, not whether
  any of them relates to the Gold price.
- The Layer 1 agents remain independent and this work stays downstream of them.

## 7. Checkpoint review, 2026-09-20

Reviewing agent: Codex (Astra), on branch `docs/gold-variable-research-scope` at `4108e02`, before the
milestone commit. Scope reviewed: registry, library, CLI, tests, fixtures and the generated reports.

Independently reproduced rather than accepted on trust:

- The audit was re-run twice into two fresh output directories against the same real local sources. Both
  runs reported `content_sha256 278b4070ab4e47cae82fa755d341265141e0983e7dde0b338e8461302b846123`,
  identical to the delivered hash, and the registry hash matched
  `4075f110ee29cc38775dd2e39e0e2567675068d48f0e5e0ec223e0bc1eec1d3e`, so determinism holds across output
  locations.
- Reported totals reproduce exactly: 28 declared, 16 with a local source, 142 checks (58 passed, 17
  failed, 66 unknown, 1 not applicable), 965 daily anchors, 5,115 event releases, 136 families, and zero
  contiguous 24-hour windows in both cohorts.
- The hourly source directory holds `candles.json` plus fifteen `page-*.json` files, so its 43,742 raw rows
  are two copies of the same 21,871 hourly opens. An independent merge check found zero value conflicts and
  confirmed `candles.json` matches the declared merged artifact hash
  `20ff2299f8c8d42269bb99f683d43f12d0fb7cb1c1f5c538ffc1a7f13d8ff392`. Deduplication is therefore
  lossless and the report discloses the condition as `duplicate_open_times: 21871`; the summary line in
  section 3 did not state it plainly.
- Focused suite: 24 of 24 tests pass on an independent run.
- Full suite: 360 tests, 356 pass, 4 fail. All four failures are in `backtester/tests/secret_scanner.test.js`
  and assert on `private-key-header`, `assignment-known-secret` and `github-pat`. A clean worktree at
  `4108e02` containing no milestone file reproduces the same four failures, and both the scanner script and
  its test file are unmodified, so they are pre-existing and unrelated. Cause: the scanner prints findings
  with `Format-Table ... -AutoSize`, which truncates the Pattern column to the host console width, so the
  pattern names never reach captured stdout in this non-interactive environment. The earlier report of
  three such failures is not stable across runs, which is consistent with that environmental cause; the
  stable statement is that every failure is confined to that one file.

Review outcome: implementation, evidence, tests, disclosures and limits are accepted. The handoff's
completion criterion is met now that sections 4 to 6 above are present. The coverage-registry milestone is
recorded as complete, with the session calendar, anchor alignment, gap classification and consensus
vintage policies as the next work. The secret-scanner truncation is recorded as a separate pre-existing
defect for follow-up, not as part of this milestone.

