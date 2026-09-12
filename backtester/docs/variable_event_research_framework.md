# Variable and event research framework

## Purpose

Version 2 enforces exactly 24 elapsed hours from explicit entry (default decision), validates timezone-aware real-calendar timestamps and rejects null/coercible numeric values. The previous version did not enforce this duration; its one-hour synthetic example must not be called 24-hour evidence. Report files now refuse overwrite. Gold reports retain evaluator configuration and protocol. Numeric raw-variable Pearson correlation and mean/median return are descriptive only; Wilson intervals are unadjusted for serial dependence and multiple hypotheses.

This is the common harness for the question: **given information demonstrably available at a decision time, which pre-declared variable or event conditions are associated with the following 24-hour market outcome?**

It is downstream-only research. It does not change Layer 1 logic, weights, thresholds, collectors, or production workflows.

## Required inputs

Every analysis supplies two immutable inputs:

1. A **registry**, committed before inspecting validation results. It declares each feature's key, meaning, source, units, availability policy and each hypothesis/cohort to test.
2. A **dataset** containing one observation per decision: decision time, realised outcome end time/direction, and feature values with their own `available_at` timestamp.

The engine rejects duplicate decision IDs, invalid decision/outcome times, outcomes that end before the decision, records crossing the chronological split/embargo, and per-hypothesis features that are missing, malformed or available after the decision.

## Standard research record

```json
{
  "observation_id": "gold-call-123",
  "decision_time": "2026-01-12T14:00:00Z",
  "outcome_end_time": "2026-01-13T14:00:00Z",
  "outcome_direction": "BULLISH",
  "features": {
    "us_2y_5d_change_bps": { "value": 7.2, "available_at": "2026-01-12T13:59:00Z" },
    "us_cpi_surprise": { "value": "HOT", "available_at": "2026-01-12T13:31:00Z" }
  }
}
```

`outcome_direction` must be `BULLISH`, `BEARISH`, or `FLAT`, using the versioned 24-hour outcome contract named by the registry. The harness does not define prices or flat thresholds itself; the evaluator supplying the dataset must do that.

## Registry rules

A hypothesis is explicit and directional. For example:

```json
{
  "id": "gold-real-yield-fall",
  "feature_key": "us_10y_real_yield_5d_change_bps",
  "cohort": { "operator": "lte", "value": -5 },
  "expected_outcome_direction": "BULLISH",
  "research_status": "exploratory"
}
```

Supported cohort operators are `equals`, `gte`, `lte`, and inclusive `between` (`minimum`/`maximum`). Variables and events use the same structure; an event's release time must be its `available_at`, not its calendar date.

## Output and interpretation

For each hypothesis, training and validation results separately show feature coverage/exclusions, cohort direction counts, flat count, ex-flat directional hit rate, Wilson 95% interval, and the percentage-point association against feature-usable observations in the same partition.

The output is descriptive. It does not prove causation, tradeability, a statistically reliable edge, or a valid untouched holdout. It explicitly reports those limitations. A registry/split changed after looking at outcomes creates new exploratory work; it cannot be presented as validation.

## Use in this repository

`backtester/lib/variable_event_research.js` is the generic engine. It is deliberately separate from `factor_edge_lab.js`, which retains legacy checked-in checker analysis, and from `gold_chronological_factors.js`, which remains a Gold-specific diagnostic.

Gold's timestamped evaluation and history-query isolation remain prerequisites for any qualifying Gold result: a correctly computed association still cannot be trusted if feature availability or historical query order is wrong.

## First wired implementation: Gold factor states

`backtester/registries/gold_24h_factor_hypotheses.v1.json` pre-declares the bullish and bearish state hypotheses for the ten existing Gold Layer 1 factors. It deliberately registers the **factor states**, not an unsupported claim about their raw provider variables. Every feature remains labelled `descriptive_pending_source_timing` until the source lineage gate is complete.

Use a new output path only:

```powershell
node backtester/scripts/build_gold_variable_event_research.js DATASET.json backtester/registries/gold_24h_factor_hypotheses.v1.json NEW_REPORT.json SPLIT_ISO EMBARGO_MS
```

The Gold adapter first applies `gold-timestamped-direction-v2`, forwards only evaluable calls to the shared harness, and preserves upstream evaluator exclusions in the final report. The synthetic fixture is a contract check, never market evidence.
