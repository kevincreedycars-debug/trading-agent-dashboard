# Gold 24-hour research delivery contract

User objective recorded September 12, 2026: build a trustworthy dataset of Gold explanatory variables, assess individual variables first, then combinations conditional on economic events, and qualify daily Layer 1 and Layer 2 Gold calls against a greater-than-60% accuracy target.

## Delivery order

1. Inventory original research claims and repository Gold inputs. Track each variable's definition, units, transformations, source, historical coverage, publication timing, vintages and missing-data behavior. The initial 28-variable inventory is derived from `logic/agent_gold_direction.md` and explicit event decomposition; coverage of the originally supplied research documents is not yet verified.
2. Assemble immutable raw observations and release vintages. Preserve actual, pre-release consensus, unrevised prior values and revisions separately for events. Never use a revised value before its publication. Event categories need distinct units and surprise direction conventions; higher unemployment is not automatically the same economic signal as higher payrolls.
3. Build as-of feature records on a fixed daily decision schedule. A separate event study may use event-relative decisions; those samples must not inflate the daily-call score. Choose the schedule from verified production evidence before outcome inspection. Record stale, missing, ambiguous and excluded observations without fabricating values.
4. Attach exact 24-elapsed-hour outcomes from declared entry. Preserve price source, basis, flat band, calendar gaps and complete path checks. The current stored-call protocol retains its 0.3-percentage-point flat band and conservative storage-entry assumption for descriptive continuity only.
5. Evaluate individual raw variables against direction and return magnitude with baseline comparisons, chronological splits, overlap purging and dependence-aware uncertainty. Current summaries now include descriptive Pearson correlation and mean/median return; dependence-adjusted inference remains to implement.
6. Freeze a bounded family of event-conditioned factor combinations using training data. Record all attempted hypotheses, including failures. Account for multiple comparisons and correlated predictors. Tune only in training/development; reserve a fresh final holdout whose results are accessed once after the formula is frozen.
7. Qualify Layer 1 and Layer 2 separately. Layer 1 remains independent; Layer 2 may combine independently generated legs with aligned timestamps. Compare the final formula to the existing formula and constant-direction baselines on identical eligible samples.

## Accuracy target and acceptance

Greater than 60% is a target, not a guaranteed deliverable. A reported point estimate above 60% does not alone establish a reliable probability above 60%. Qualification requires an untouched chronological test, a predeclared denominator, adequate effective sample size, uncertainty accounting for serial/event dependence, and no tuning after seeing the final result. For a claim of reliably exceeding 60%, require the appropriate predeclared lower confidence bound to exceed 60%, as well as improvement over the baseline. If the evidence does not support the target, report that result rather than changing the benchmark.

Always disclose correct, wrong, flat, no-call, rejected and total scheduled decisions, and the fraction receiving a directional call. Ex-flat directional accuracy and accuracy over all evaluable directional calls must both be shown. A model cannot achieve the daily-call objective by silently dropping difficult days. Any selective-call product requires its own explicit coverage target.

Directional accuracy is separate from executable trade win rate. Trade qualification additionally requires bid/ask entry and exit, costs, fills, order rules, complete paths and positive net expectancy. Neither the current factor framework nor the stored-call pilot establishes trade profitability.

## Current concrete gaps

The first framework version accepted one-hour outcomes despite its 24-hour label. Version 2 rejects every duration other than exactly 24 hours from entry, uses the strict timezone-aware timestamp parser, rejects coercible missing numeric data and preserves the evaluation configuration. CLI output now refuses overwrite.

The 28-variable source-readiness audit checks metadata and exposes missing fields; it does not authenticate evidence references. Fresh September 12 acquisition contains 164 stored Gold calls across 83 storage dates and 154 linked snapshots, including nine repeated-snapshot groups. All ten factor labels are present, but authentic raw-feature release times and publication times remain unverified.

The operational Gold history query repair is still unapplied. Its isolated-runtime gate must be completed before deployment. That repair cannot retroactively create source vintages, and it does not block independent raw historical acquisition or framework corrections.

## Reproduction

`node backtester/scripts/audit_gold_source_readiness.js RECORDS.json NEW_REPORT.json` audits versioned feature records.

`node backtester/scripts/audit_gold_snapshot_variables.js SNAPSHOTS.json NEW_REPORT.json` audits exact stored snapshot fields without promoting storage time to publication time.

`node backtester/scripts/build_gold_variable_event_research.js DATASET.json REGISTRY.json NEW_REPORT.json SPLIT_ISO EMBARGO_MS` runs the timestamped evaluator and 24-hour cohort harness. All raw evidence stays in ignored local directories.
