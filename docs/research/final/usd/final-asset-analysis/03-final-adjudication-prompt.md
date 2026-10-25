# USD asset-level final analysis - stage 3 of 3: Final adjudication

- Asset-level final chain `usd-final-asset-analysis` on asset USD; stage `final_adjudication`; this stage returns exactly one Markdown document (synthesis).
- This is the asset-level synthesis chain: it reads every factor-chain adjudication and is not itself a factor result. It opens only through the gate, never because a prompt was copied.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.1.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- Attach both documents this stage judges: the final analysis and the final red-team of it, plus the factor-chain adjudications that support the analysis, at the exact versions and sha256 values shown in the input package.

## What this stage is for

Read the final analysis and the final red-team findings together and produce the best-supported final decision. Resolve each material red-team objection on the evidence; do not split the difference, do not average the two documents, and do not treat agreement between them as evidence. Then write the complete candidate Layer 1 logic that follows from the decision, ready for an isolated backtest and not for deployment.

## Which documents you are judging

- The final analysis is the synthesis under adjudication.
- The final red-team is the independent challenge to it.
- The supporting evidence is the adjudication of each of these factor chains, at the exact versions shown in the input package:

- `usd-factor-live-f1-vix-level`
- `usd-factor-risk-vix-level-and-change-at-cutoff`
- `usd-factor-live-f2-us-2y-delta`
- `usd-factor-live-f3-us-de-2y-spread-delta`
- `usd-factor-live-f4-real-yield-delta`
- `usd-factor-rates-us-front-end-delta`
- `usd-factor-rates-relative-front-end-delta`
- `usd-factor-rates-real-yield-delta`
- `usd-factor-rates-term-premium-and-curve`
- `usd-factor-rates-credit-spread-delta`
- `usd-factor-live-f5-dxy-delta`
- `usd-factor-live-f6-gold-delta`
- `usd-factor-live-f9-dollar-smile`
- `usd-factor-live-f10-equity-versus-usd`
- `usd-factor-live-f7-economic-surprise`
- `usd-factor-live-f8-fed-bias`
- `usd-factor-macro-release-surprise-at-first-print`
- `usd-factor-fx-usd-session-momentum`
- `usd-factor-fx-usd-overnight-range-position`
- `usd-factor-fx-usd-session-volatility-regime`
- `usd-factor-risk-usd-safe-haven-demand`
- `usd-factor-risk-risk-on-off-cross-asset-state`
- `usd-factor-calendar-known-releases-between-cutoff-and-endpoint`
- `usd-factor-calendar-days-since-and-until-high-impact-events`
- `usd-factor-data-quality-gate-for-abstention`

- Those adjudications are the direct evidence behind the analysis and the red-team. Each names the research report and red-team it decided; use those earlier documents when a decision needs the underlying passage.
- If any file in the input package does not match the version and sha256 on its card, say so and stop.

## How to decide

- Answer a material red-team objection on the evidence the documents give, and on sources you fetched yourself; say which it was.
- Reject an objection the evidence does not support, and say what is wrong with it.
- A claim that neither document settles stays unresolved and is listed as unresolved rather than quietly dropped.
- A narrowing that keeps the true part of a claim is a decision, not a compromise.
- The candidate logic follows the adjudicated evidence. It is not a compromise between the analysis and the red-team.

## Five kinds of evidence that must not be mixed

Each kind answers a different question, and evidence of one kind never stands in for another. State which kind every load-bearing claim rests on, in the sentence that makes the claim:

- **Economic mechanism** - why an input could move the dollar inside the session at all. A mechanism is a reason to look; it is not a measurement, and a plausible channel is not evidence that the channel operates.
- **Contemporaneous association** - what moves with the dollar at the same time. It says nothing about direction after the cutoff, and the dollar may be the thing doing the moving.
- **Predictive evidence from other windows** - measured relations for a close-to-close day, a New York session, an event window or a monthly horizon. Relevant background, not evidence for this session; name the window every time the number is quoted.
- **Evidence for our exact session** - a measurement of the 05:00 Europe/London start to the 05:00 Europe/London endpoint on the next local date. Where none exists for a claim, say so rather than borrowing another window's result.
- **Incremental value beyond existing inputs** - what this factor adds to a decision already able to use the entries before it. Information already contained in an earlier input is not new, and a factor that adds nothing is a finding, not a gap.

A claim that changes kind between sections - a mechanism presented as a measurement, another window presented as ours, an input already in the decision presented as new - is the most common way a body of research overstates what is known. Where the same evidence is counted twice, say so.

## What the adjudication must contain

1. **Corrected final conclusions** - the best-supported version of each conclusion, stated plainly.
2. **Finding-by-finding decisions** - every material red-team finding, decided as accepted, rejected or unresolved, each with its reason.
3. **Accepted, rejected and unresolved claims** - as three explicit lists.
4. **Complete candidate Layer 1 logic for isolated backtesting** - a self-contained specification: the candidate rule identity and version; every input with its series, transformation, sign and timing; every threshold, weight, lookback and interaction with its units; the abstention and missing-data rules; the score construction and any tie-break; and deterministic pseudocode another person can implement without going back to the analysis.
5. **Parameter table** - every threshold, weight, lookback, sign and interaction named above, each marked `measured` or `unvalidated`, with its source and units.
6. **Isolated-backtest plan** - the sample, the window, the outcome definition, the controls, the metrics and the pass/fail conditions that would test the candidate without touching the live engine.
7. **Data requirements and blockers** - the series, resolution, vintage handling and history the test needs, and what is missing or behind a paywall.
8. **What is not claimed** - a plain section listing what this adjudication and candidate logic do not establish.

## The line this stage must not cross

The candidate Layer 1 logic is for an isolated backtest only. This stage does not implement, score, deploy, publish or change a live call, and it asserts no performance figure it has not measured. Every number that has not been measured is marked unvalidated, and no production configuration is proposed as part of the deliverable.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The asset-level synthesis this chain produces

This chain reads every factor chain adjudication for the asset. It is the synthesis layer, not a fourth factor review.


## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/inventory.md` (the input and decision inventory the synthesis closes out) - sha256 `a886f1ddcce52d4d8a0af77069b391deb1338275380cccd2e08d41fd61f2d56a`

## What to return

- Required content: Finding-by-finding decisions; accepted, rejected and unresolved claims; and the complete candidate Layer 1 logic: inputs, transformations, signs, thresholds, weights, interactions, timing, abstention, score construction and deterministic pseudocode, with every unvalidated parameter named, plus the isolated-backtest plan, data requirements and explicit what-is-not-claimed section.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the input package you downloaded:

```
Adjudicated chain: usd-final-asset-analysis
Final analysis: <document id> - version <version> - sha256 <sha256>
Final red-team: <document id> - version <version> - sha256 <sha256>
Supporting adjudication read: <factor id> - <document id> - version <version> - sha256 <sha256>
```
- End the document with a section headed `## Complete candidate Layer 1 logic for isolated backtesting`. It must be complete enough for another person to implement without going back to the analysis, and it must be explicitly a candidate, not a deployed rule.
- Inside that section, give: the rule identity and version; every input with its series, transformation, sign and timing; every threshold, weight, lookback and interaction with its units; the abstention and missing-data rules; the score construction and any tie-break; deterministic pseudocode; the parameter table marking each parameter measured or unvalidated; the isolated-backtest plan, sample and metrics; and the data requirements and blockers.
- Mark every parameter that has not been measured as `unvalidated`. Do not present a candidate number as a live threshold, and do not include a production change or a performance claim.
- Keep it in one file. Tables, sources, hypotheses, candidate relations and appendices all belong inside that document; nothing here needs a second file, a JSON payload or a hand-built schema.
- The dashboard records the chain, the stage and the exact input package this document judged, so that metadata is not yours to assemble: download the package, choose the file, upload it.

## Prohibitions

Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not measured it, say it is unmeasured. Numbers you remember are not evidence.
Do not use hindsight: never state what a past period would have predicted using information that was not available at that time, and do not present a later revision as a first print.
Cite only sources you actually fetched in this session, with the link and the passage you relied on.
Where you are uncertain, say so and give the reason; an unresolved question is a valid return.
State effects that are already in the price at the cutoff rather than counting them again as predictive.
Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.
Name the instrument a claim is really about. Never present another instrument as DXY.
Recommending data the collector should record and a treatment a future engine should apply is required content, not a change being made. No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, none may be carried out now, and none may be reported as done or as agreed.

## What happens after you return it

The candidate Layer 1 logic can be handed to an isolated backtest as a candidate, never as a live rule. Only a measured, out-of-sample test can support a later deployment decision, and nothing enters the live engine because a document exists.
