# F5 DXY delta - live.f5-dxy-delta - stage 3 of 3: Adjudication

- Factor chain `usd-factor-live-f5-dxy-delta` for factor `live.f5-dxy-delta` on asset USD; group label `usd-topic-dollar-index-gold-and-equities` (Dollar index, gold and equity-against-USD relations); stage `adjudication`; this stage returns exactly one Markdown document (synthesis).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `live.f5-dxy-delta` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Attach both documents this stage judges: the research return for factor `live.f5-dxy-delta` (chain `usd-factor-live-f5-dxy-delta`) and the red-team review of it. Each stage card shows its document id, version and sha256; attach those exact versions.

## What this stage is for

Read the research report and the red-team review together and produce the best-supported conclusion. Resolve each material objection on the evidence; do not split the difference, do not average the two documents, and do not treat agreement between them as evidence. Where the evidence does not decide, say which finding is unresolved and what would decide it.

## Which versions you are judging

- Reproduce the research document id, version and sha256, and the red-team document id, version and sha256, in the identifier lines at the top of your return.
- If either attachment does not match the card it came from, say so and stop.

## How to decide

- Answer a material objection on the evidence the two documents give, and on sources you fetched yourself; say which it was.
- Reject an objection the evidence does not support, and say what is wrong with it.
- A claim that neither document settles stays unresolved and is listed as unresolved rather than quietly dropped.
- A narrowing that keeps the true part of a claim is a decision, not a compromise.

## What the adjudication must contain

1. **Corrected conclusions** - the best-supported version of each conclusion, stated plainly.
2. **Finding-by-finding decisions** - every material objection from the review, decided as accepted, rejected or unresolved, each with its reason.
3. **Accepted, rejected and unresolved claims** - as three explicit lists.
4. **Proposed treatment of the factor in the engine** - only where the evidence supports it: the input, the transformation, the sign, the threshold, the lookback, the timing and how any interaction is handled. Where the evidence does not support a treatment, say that instead. The rules in force are context to be tested, never a target to agree with.
5. **Inputs, transformations, timing, interactions and missing-data considerations** - including what the collector does not record today and what it would have to record.
6. **Explicitly unvalidated parameters** - every number or choice you propose that has not been measured, named as unvalidated.
7. **Required empirical tests and remaining blockers** - what would have to be measured, on what sample and window, with what data, and what is missing or behind a paywall.
8. **Handoff to central USD synthesis** - a short, self-contained section a later central synthesis can read on its own: what this factor contributes, what it rules out, what stays unresolved, and what it does not claim.

## The line this stage must not cross

Research accepted for synthesis is not a validated trading rule. This stage proposes; it does not implement, score, deploy or change a live call, and it asserts no performance figure it has not measured.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window**: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps the corrected session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **live.f5-dxy-delta** - F5 DXY delta. Role: direction. Group: live_engine.
  - The question this entry stands for: Trailing change in the dollar index the collector stores as dxy_level (FRED DTWEXBGS), with a d1 to d5 to d20 substitution ladder.
  - Rule in force today, as context to audit and never as evidence: 1-day change at or above +0.15% reads BULLISH, at or below -0.15% BEARISH; falls back d1 then d5 then d20 and records only a warning string.
  - Threshold: +/- 0.15%; lookback: 1 day on the 24h timeframe.
  - Series the collector reads: FRED DTWEXBGS.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/target_source_assessment.md` (DXY and intraday source coverage, access and cost) - sha256 `078f8951777b782643b0aa4d1a87ba82b1beede0128f2e43cf2b5faeed1277da`

## What to return

- Required content: Corrected conclusions; finding-by-finding decisions; accepted, rejected and unresolved claims; proposed treatment of the factor in the engine; inputs, transformations, timing, interactions and missing-data treatment; explicitly unvalidated parameters; required empirical tests and remaining blockers; the handoff section.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-live-f5-dxy-delta
Reviewed factor: live.f5-dxy-delta
Reviewed document: <document id shown on the stage card you downloaded>
Reviewed version: <version>
Reviewed sha256: <sha256 shown on that card>
```
- Keep it in one file. Tables, sources, hypotheses, candidate relations and appendices all belong inside that document; nothing here needs a second file, a JSON payload or a hand-built schema.
- The dashboard records the chain, the stage and the exact version this document judged, so that metadata is not yours to assemble: pick the stage card, choose the file, upload it.

## Prohibitions

Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not measured it, say it is unmeasured. Numbers you remember are not evidence.
Do not use hindsight: never state what a past period would have predicted using information that was not available at that time, and do not present a later revision as a first print.
Cite only sources you actually fetched in this session, with the link and the passage you relied on.
Where you are uncertain, say so and give the reason; an unresolved question is a valid return.
State effects that are already in the price at the cutoff rather than counting them again as predictive.
Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.
Name the instrument a claim is really about. Never present another instrument as DXY.
No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, and none may be proposed as part of the deliverable.

## What happens after you return it

Central USD synthesis is a separate step: it reads the adjudications of every factor chain, resolves what conflicts between them, and only then can an isolated implementation and validation step follow. Nothing enters the live engine because a document exists.
