# Active milestone

## Current Feature
Gold variable-price relationships over horizons up to five trading days.

## Current Milestone
Resolve Gold session-calendar, hourly gap and trailing-return policies, then specify the first automated individual-variable reaction report.

## Status
Coverage registry delivered and acceptance-verified on 2026-09-20; every measurement horizon beyond the coverage audit stays gated on the unresolved policies.

## Completed Work
Both evidence modes executed on 964 scheduled decisions. Retrospective: 53,751 candidates, 69 event families and 23 eligible event candidates. Claims below consensus, bullish: 43/58 training and 12/16 validation, with five validation flats and 21 unique validation releases. Macro winner: 15/28 validation. Delivered all 20 macro feature scorecards, yearly breakdowns and month-block diagnostics. See GOLD_EXTENDED_RESEARCH_20260918.md. Coverage registry milestone: `gold_variable_horizon_context.v1.json`, deterministic `audit_gold_variable_coverage.js` with 24 passing focused tests and independently reproduced hashes; verified 16 of 28 variables with a local source, 965 daily anchors, 5,115 event releases, 136 families and zero contiguous 24-hour windows. Full local suite 356/360, where the four failures are the pre-existing environment-dependent secret-scanner console-width truncation. See DEEPSEEK_GOLD_RESEARCH_PROGRESS.md.

## Remaining Work
Session calendar, anchor-to-candle alignment and gap-classification policies; trailing-return and volatility estimators; automated individual-variable reaction reports; systematic combinations; then daily formula development and untouched qualification with separate Layer 2 evaluation. Use programs, workflows and database queries to minimize AI-credit use. Gold history repair remains separately gated.

## Next Immediate Action
Decide and document the XAU/USD session calendar, the hourly gap classification rule and the trailing-return/volatility estimators, then specify the first automated individual-variable reaction report.

## Last Updated
2026-09-20.
