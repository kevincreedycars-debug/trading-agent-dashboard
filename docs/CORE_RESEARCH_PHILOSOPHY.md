# Core Research Philosophy

Last updated: 2026-06-22

## Project Mission

The mission of this platform is to build the most evidence-driven macro directional trading intelligence platform possible.

It should improve through objective historical measurement while protecting live production integrity at every stage.

The goal is not simply to maximize historical win rate. The goal is to build a robust, explainable, continuously validated macro intelligence system that can adapt across changing market regimes without contaminating production discipline.

## Core Statement

> Research exists to measure reality, not to confirm assumptions.

> The platform must first determine how well the current production Layer 1 agents perform before attempting to improve them.

## The Golden Rule

Nothing is changed because it seems like a good idea.

Every production change must answer three questions:

1. What evidence supports it?
2. How much does it improve performance?
3. Can the improvement be reproduced over meaningful historical data?

If those questions cannot be answered, the change does not belong in production.

This philosophy document should be treated as the first document future AI agents read before making research or backtester changes.

## Verdict Quality Is Part Of The Verdict

A directional call is not fully evaluated until its confidence and strength have also been evaluated.

The platform must know whether higher-confidence calls are actually more reliable than lower-confidence calls.

The platform must know whether VERY_STRONG calls are actually more accurate than WEAK, MODERATE, and STRONG calls.

This is essential because confidence and strength are the verdict-quality layer, not decorative dashboard labels.

Direction alone is not the full verdict.

The verdict is direction plus confidence plus strength.

A model with modest overall accuracy may still be useful if high-confidence or VERY_STRONG calls are materially more accurate than weaker calls.

Research must therefore evaluate not only whether calls were correct, but whether the model knew when it had edge.

Confidence and strength must be treated as first-class research dimensions.

## Trade Quality Research Is A Filter, Not A Production Rule

Prediction accuracy and trade quality are related but not identical.

The platform must measure both all-call accuracy and filtered trade-quality accuracy.

A weak low-confidence prediction and a very strong high-confidence prediction should not be treated as equal evidence of tradeability.

Trade-quality research exists to identify where the model may have genuine edge, not to automatically suppress or change live production calls.

## 1. Project Objective

The immediate goal of the historical research platform is to measure the current production Layer 1 agents exactly as they exist today.

This project is not trying to optimize live trading logic first. It is trying to establish a trustworthy evidence base for how the current system performs across timeframes, assets, regimes, and factor conditions.

## 2. Production Vs Research Separation

Production and research must remain separate systems with different responsibilities.

Production exists to generate live sealed Layer 1 directional calls.

Research exists to replay, evaluate, and analyze those calls after the fact.

Research must be read-only from the production system's point of view.

## 3. Why `/logic` Is The Source Of Truth

The current production logic documents in `/logic` define what the live Layer 1 agents are supposed to do.

Historical replay must use those same logic documents so the backtester measures the real production system rather than a hypothetical or partially rewritten version.

If replay uses anything else, the research ceases to measure production reality.

## 4. Why Research Is Downstream-Only

Research outputs must never feed back into production automatically.

They may inform future human decisions, but they must not mutate live Layer 1 logic, weights, thresholds, or workflow behavior on their own.

This protects the production system from hidden contamination and keeps the measurement process honest.

## 5. Why The First Goal Is Measurement, Not Optimization

Optimization before measurement is guesswork.

The first duty of the research platform is to answer:

- what the current production agents actually did
- how often they were correct
- which timeframe was strongest
- whether 24H accuracy is genuinely usable
- whether any proposed improvement is better than the current baseline

Only after those answers exist should Version 2 logic changes be considered.

## 6. Staged Path From Current Layer 1 To Evidence To Layer 1 Version 2

The development path is:

1. Preserve the current production Layer 1 system.
2. Replay the current production logic historically.
3. Measure benchmark accuracy and coverage.
4. Expand the dataset until the evidence is large enough to trust.
5. Analyze factor value and failure patterns.
6. Propose candidate Layer 1 Version 2 improvements.
7. Replay full history again to validate whether Version 2 is actually better.
8. Require human approval before any production adoption.

## 7. Production Changes Require Historical Justification

No live Layer 1 logic change should be made merely because it sounds better, feels cleaner, or matches an intuition.

Production changes require historical justification from the downstream research platform.

That justification should show:

- what changed
- why it changed
- which benchmark improved
- which timeframe improved
- whether tradeoffs worsened elsewhere
- whether the result held across a meaningful sample

## 8. Future Continuous Research Engine Philosophy

The long-term research engine should continuously observe production outputs, attach realized outcomes, monitor drift, and surface evidence-backed recommendations.

It should eventually detect:

- benchmark deterioration
- factor decay
- timeframe drift
- regime-sensitive failures
- logic version differences

Its role is to generate evidence and recommendations, not to self-deploy production changes.

## Success Criteria

Success means the platform can answer important production and research questions with evidence rather than assumption.

### Production

Success in production means:

- live Layer 1 agents remain sealed
- `/logic` remains authoritative
- no research output mutates production automatically
- every production change is traceable to evidence and human approval

### Historical Replay

Success in historical replay means the system can reconstruct what each Layer 1 agent believed at the time, using the current production logic documents rather than a research-only substitute.

It should be able to answer:

- What did each Layer 1 agent believe?
- Why?
- Which benchmark was used?
- Which timeframe succeeded or failed?

### Research

Success in research means the system can measure correctness in a way that is benchmark-specific, timeframe-specific, and regime-aware.

It should be able to answer:

- Was it correct?
- By how much?
- Which factors helped?
- Which factors hurt?
- Which regimes strengthened or weakened performance?

### Optimization

Success in optimization does not mean changing production often. It means only proposing changes when the measured evidence is strong enough to justify them.

It should be able to answer:

- Did a proposed production change improve 24H accuracy without degrading other timeframes?
- Did it improve the primary benchmark rather than only contextual diagnostics?
- Did the improvement persist across meaningful historical data?

### Continuous Research

Success in continuous research means the platform can keep validating production behavior over time, detect drift, and surface evidence-backed recommendations without creating an automatic production feedback loop.

## 9. Human Approval Requirement

Research may recommend.

Humans approve.

No production Layer 1 logic update should go live without explicit human review of the historical evidence, the benchmark impact, and the implementation scope.

## 10. Anti-Patterns To Avoid

- Changing `/logic` before enough historical evidence exists.
- Letting research outputs feed automatically into production.
- Quietly redefining benchmark rules midstream.
- Measuring a rewritten research-only version instead of the real production logic.
- Counting contextual or diagnostic markets as headline benchmark accuracy when they are not the primary benchmark.
- Expanding feature count faster than validation quality.
- Treating optimization as proof.
- Using backtester convenience shortcuts that weaken production/research separation.

## Research Hierarchy

Every research layer answers a different question.

### Level 1 - Directional Accuracy

Question:

> Was the model directionally correct?

Metric:

- Overall win rate

Purpose:

Measures the base forecasting ability of the Layer 1 agent.

### Level 2 - Timeframe Accuracy

Question:

> Which forecast horizons are strongest?

Metrics:

- 24H
- 3-Day
- Current Week
- Next Week
- Current Month

Purpose:

Determine where the model performs best.

The 24H forecast is the primary production product.

### Level 3 - Verdict Quality

Question:

> Did stronger verdicts deserve more trust?

Metrics:

- WEAK
- MODERATE
- STRONG
- VERY_STRONG

Purpose:

Verify that the model correctly distinguishes between weak and strong opportunities.

### Level 4 - Confidence Calibration

Question:

> Did the confidence percentage reflect reality?

Metrics:

Confidence bucket accuracy.

Purpose:

Measure whether predicted confidence is well calibrated.

Determine whether the model is:

- overconfident
- underconfident
- well calibrated

### Level 5 - Trade Quality

Question:

> Which subset of predictions would actually have been worth trading?

Metrics:

Threshold-based research:

- Confidence >= 70
- Confidence >= 75
- Confidence >= 80
- Confidence >= 85
- Confidence >= 90

Combined with strength filters.

Purpose:

Separate prediction quality from tradeable edge.

### Level 6 - Factor Value Research

Question:

> Why was the model correct?

Measure:

- factor contribution
- interaction
- regime dependency
- marginal predictive value

Purpose:

Determine which variables genuinely improve forecasting.

This begins only after sufficient historical coverage, roughly 300 trading days.

### Level 7 - Production Improvement

Question:

> What should actually change?

Purpose:

Use historical evidence to propose Layer 1 Version 2.

Production changes must never be based on intuition.

### Level 8 - Continuous Research

Question:

> Is the model still healthy?

Purpose:

Detect:

- factor drift
- regime change
- weakening variables
- strengthening variables

Generate recommendations only.

Never automatically update production.

## Closing Principle

> Every research layer exists to answer a specific question.
>
> Higher layers depend on the integrity of the layers below them.
>
> The platform must never skip directly from historical outcomes to production optimisation.
>
> It must first establish:
>
> - whether the model is correct,
> - when it is correct,
> - how confident it should have been,
> - which signals were genuinely tradeable,
> - why those signals worked,
> - and only then determine whether production should change.
>
> This hierarchy protects the platform from curve-fitting, over-optimisation, and opinion-driven development.

## Fixed Principles

- Production Layer 1 remains sealed.
- `/logic` remains the production source of truth.
- Historical replay must use the current `/logic` documents.
- Research outputs must never feed into production automatically.
- Research is read-only from the production system's point of view.
- No live Layer 1 logic changes until historical evidence justifies them.
- Optimization comes after measurement, not before.
- Correctness matters more than feature count.

## Current Development Order

### Stage 1

Expand USD replay coverage from roughly 22 trading days to roughly 100 trading days.

### Stage 2

Expand USD replay coverage from roughly 100 trading days to roughly 300 trading days once the smaller pipeline is stable.

### Stage 3

Add pair-specific primary benchmark research for:

- USD -> DXY
- EUR -> EUR/USD
- Gold -> XAU/USD
- NQ -> QQQ / NQ proxy
- BTC -> BTC/USD

### Stage 4

Begin factor-value analysis only after enough history exists to make those results meaningful.

### Stage 5

Use research evidence to propose Layer 1 Version 2.

### Stage 6

Replay full history again to validate Layer 1 Version 2 against the current baseline.

### Stage 7

Build the continuous research engine for drift detection, monitoring, and recommendation generation without creating an automatic production feedback loop.
