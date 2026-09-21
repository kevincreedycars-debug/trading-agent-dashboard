# Central decisions

## 2026-09-20: coordinator and workers

- This canonical project owns overall architecture, priorities, integration,
  cross-project decisions and durable memory. Workers use separate worktrees.
- Shared immutable submission/reply files replace copying chat history. The
  coordinator reviews on request; no background runner has been configured.
- All five registered workers have bounded assignments. Existing asset workers
  must reconcile current state before more implementation is assigned. Their
  worktree HEADs are observed facts, not proof of current deployment or completion.
- Central review can accept, request changes, acknowledge or mark blocked. Accepted,
  integrated and deployed are distinct states. Production actions require the
  applicable user authorization; a worker submission does not supply it.

## Gold research facts and dependencies

Coverage milestone b8193ba is accepted in 0b0e92d. Twenty-eight variables are
declared, sixteen have a local source; availability is not measured association.
The accepted audit reports zero contiguous 24-hour windows in either cohort.
Immediate/event windows need appropriate resolution; five-trading-day horizons
need declared session rules. Hourly source duplicates were losslessly deduplicated.
See the complete evidence in `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md`.

Next proposal must address XAU/USD session/calendar and DST/holiday provenance,
hourly gap classification, anchor alignment, trailing five-session return and
volatility estimators, missing-context handling and a bounded first report.
The coordinator reviews the proposal before measurement implementation proceeds.
Source coverage, endpoint availability and contiguous tradable paths must remain
distinct. No gap filling or timestamp-policy change may silently manufacture evidence.

Order remains individual direction AND return magnitude -> prior-context
conditioning -> systematic combinations with all attempts and year stability ->
frozen formula and untouched qualification. Descriptive reaction is not causation
or reliable predictive influence. Programs perform bulk processing; AI writes,
debugs and interprets compact reports. Layer 1 agents remain independent and
backtesting downstream-only.

Consistency rule (2026-09-21 review of 20260920-gold-findings-summary-005-r2): a
consistency claim requires at least two supported years. States with zero or one
supported year are not assessable for between-year agreement, and pooled-sign
agreement is reported separately from between-year agreement. Under that rule the
between-year same/differ/not-assessable totals are pooled 43/27/320, exact
41/21/305 and delayed 6/50/231 (unavailable states included). Pooled-sign totals
47/29/314, 48/21/298 and 6/50/231 are unchanged. This applies to later
documentation, companion tables, conditioning cells and any variable added by the
coverage plan.

Known separate defect: accepted coverage checkpoint reports 356/360 full tests;
failures are confined to pre-existing secret-scanner console-width truncation.
This historical result is not a test result for new changes.

## Gold transition review: changes requested

Submission 20260920-gold-policy-transition-001 was independently reproduced but not accepted. Verified two blocking bugs: close values used before candle completion and missing declared closes silently replaced. The archive-derived exception register does not independently validate source completeness. gold-policy-002 authorizes preserving the five files in the worker branch, corrective implementation/tests and a provider-evidenced proposal; canonical originals remain untouched. Earlier user research authorization remains valid; implementation preservation is not integration or permission to proceed to reaction reports. See the durable review for evidence and reported user horizon constraints.

## Project aim

Project aim (user relayed and confirmed 2026-09-20): every tracked asset provides a 24-hour directional call. Layer 2 is intended to issue a higher-conviction cross-pair call when two independent Layer 1 calls move in opposing directions. The dashboard is the decision aid for acting on those calls. This records intended product behaviour; higher conviction is not established predictive accuracy or profitability. Research/backtesting stays downstream-only.
