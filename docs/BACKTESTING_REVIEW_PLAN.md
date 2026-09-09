# Backtesting review plan

Baseline date: 2026-09-07. Objective: establish what each engine actually measures, correct demonstrated measurement defects, and qualify evidence before optimization.

First review checkpoint: [Gold timestamped contract and implementation audit](GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md). The versioned review records the two input paths, measurement rules, denominator accounting, independent examples, and three reproduced gaps. The v2 evaluator now requires explicit candle completion, declares normalized storage-entry semantics and preserves as-of protocol metadata. Frozen pilot artifacts remain unchanged. Shared snapshot selection and report provenance are also repaired. The next milestone prepares isolated validation of the history-input repair.

## Engine inventory

| Path / family | Inputs and question | Current disposition / main limitation |
| --- | --- | --- |
| `backtester/replay/{usd,eur,gold,nq,btc}/`, checker builders | Reconstructed snapshots and fixed rules: can stored calls be reproduced? | Preserve as parity tools. Correct reproduction cannot prove historical availability or predictive value. |
| `outcome_evaluation.js`, `outcome_direction.js`, `timeframe_windows.js` | Call/date and reference/endpoint prices: did direction match the mapped window? | Legacy compatibility. “Following 24hrs” is a weekday/session mapping, not necessarily 24 elapsed hours or a fill. Gold fixes reject invalid prices and inconsistent evaluability. |
| `layer2_pair_logic.js` and pairing analysis | Independent Layer 1 outputs: what pair decision follows the historical rules? | Rule research, separate from real tradable-price execution. Preserve asset relationship and no-call semantics. |
| `adr_reach_research.js`, `half_l2l_reach_research.js` | Daily ADR plus hourly paths: did a favorable swing reach the threshold in sequence? | Frozen reach research. Swing availability is not forecast accuracy or a strategy win rate. |
| `half_l2l_executable_entry_draft.js` | Proxy entry scenarios and historical candles | Frozen draft. Names such as `executable` describe scenarios, not validated broker fills. Consumed folds and timing uncertainty prevent qualification. |
| `l2l_trading_day_directional.js` and `l2l_directional_*` | Preserved calls versus designated trading-day close, with diagnostics | Frozen directional audit. Existing 24H signal horizon differs from the close question. Do not reuse final-test data for validation of revised logic. |
| `l2l_signal_construction_audit.js`, session-close contract/builder/feasibility | Historical feature timing and redesigned session dataset | Preserve findings: date-only/end-of-day reconstruction cannot establish pre-session availability. |
| `eur_h1_session_close_pilot.js`, `eur_h1_ta_directional_baseline.js` | Hourly EUR technical baseline | Separate pilot/hypothesis, not evidence for all assets or a substitute for production-call validation. |
| `gold_asof_dataset.js`, `gold_stored_call_evidence.js` | Versioned feature records / stored calls and explicit cutoffs | **First review target.** Audit availability, repeated snapshots, storage versus publication time, timestamp precision and inherited rejections. |
| `gold_timestamped_evaluation.js`, `gold_oanda_candles.js` | Timestamped calls and explicit candle windows | **First evaluator target.** Strict contiguous path is default; exact-endpoint mode is descriptive only. No spread/fill/P&L model. |
| `gold_evidence_audit.js`, `gold_snapshot_lineage_audit.js`, `gold_history_repair_impact.js` | Saved outputs/source hashes and snapshot history | Source-quality audits. Counterfactual input repair is not an outcome-improvement experiment. |
| `gold_chronological_factors.js`, `gold_pilot_diagnostics.js`, `factor_edge_lab.js` | Outcomes, factors, cohorts and pairs | Diagnostics only until source timing and independence are defensible. No weight tuning on consumed holdouts. |
| `confidence_calibration.js`, `confidence_band_delivery.js`, `phase2_shadow_backtest.js` | Historical outcome artifacts and comparison rules | Downstream descriptive/calibration research; inherits upstream timing and sample-quality limits. |
| `backtester/replay/gbp/` | GBP snapshot contract and deterministic factor rules | Draft onboarding baseline. No qualified historical GBP edge established. |
| `macro-engine/` | Synthetic chronological event fixtures and lifecycle rules | Parked independent prototype; no live integration or staged database provisioning. |

Module names in the middle rows are under `backtester/lib/`. These families should not be merged into a single accuracy percentage.

## First bounded review: Gold directional measurement

Question: given a real Gold call and only information demonstrably available when it was made, what price-direction outcome occurs over one explicitly defined horizon?

1. Write the contract before changing behavior: decision/publication time, storage proxy status, feature availability, selected source version, entry rule, end time, price basis, flat band, no-call handling and session/gap policy.
2. Trace stored-call export -> as-of selection -> evaluation -> factor/cohort reporting. For each transition, record rejected inputs, deduplication and timestamp precision.
3. Validate against independent hand-calculated examples: bullish/bearish/flat/no-call, missing/late features, exact boundary, microseconds, duplicate snapshots, missing candles, mixed feeds, weekends and daylight-saving boundaries.
4. Separate strict continuous coverage from endpoint-only diagnostics. Reconcile every input call into evaluated or rejected counts, with reasons and unchanged source hashes.
5. Review the confirmed Gold history-query repair in isolated n8n. Verify ordering, pagination, date cutoff, no future leakage and equivalent node output shape. Production application remains a separate deployment decision.
6. Collect a fresh source-quality baseline before calibration. Record authentic publication and release timestamps where available; retain proxy labels where unavailable.

Acceptance: an explicit versioned contract; a source-to-report trace; independent expected outcomes and passing regressions; complete denominator/rejection reconciliation; reproducible hashes/commands; no changes to frozen legacy artifacts or production logic merely to improve reported accuracy.

## Subsequent gates

- Directional evidence: chronological splits, deduplication/dependency policy, always-bullish/bearish/no-skill baselines, uncertainty and a genuinely untouched holdout. The old final-test window is consumed; September pilot observations are already inspected.
- Executable research: establish MT5-aligned bid/ask prices, complete paths, session calendars, spreads/commissions/slippage, entry/exit orders, stop/target collision rules and fill assumptions. Until then, retain `executable_trade_validated: false` for timestamped Gold outputs.
- Generalization: extend the proven contract asset by asset. Do not assume Gold data rules apply to FX, crypto or index proxies.

## Working discipline

Use one active milestone, one branch per bounded change, short coherent commits and explicit test evidence. Source and selected reports are versioned; raw acquisitions and browser output are ignored. Avoid building another engine until this inventory demonstrates why an existing path cannot answer the question.

Local validation: `npm ci`, `npm run playwright:install`, then `npm test`. `npm run test:unit` and `npm run test:browser` provide focused runs. The two linked-warehouse suites are intentionally excluded from local defaults because they can mutate remote research data.
