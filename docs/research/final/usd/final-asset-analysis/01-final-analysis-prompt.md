# USD asset-level final analysis - stage 1 of 3: Final analysis

- Asset-level final chain `usd-final-asset-analysis` on asset USD; stage `final_analysis`; this stage returns exactly one Markdown document (synthesis).
- This is the asset-level synthesis chain: it reads every factor-chain adjudication and is not itself a factor result. It opens only through the gate, never because a prompt was copied.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- This stage opens only when every factor chain has delivered research, red team and adjudication against its current parent versions. Read the adjudications of all of them; do not substitute an earlier research report for an adjudication.

## What this stage is for

Read every factor-chain adjudication for the asset and produce the best-supported asset-level conclusion. The adjudications are the evidence; this stage synthesises them, resolves what conflicts between factor chains, and states plainly what the whole body of work does and does not support.

## Which documents you are reading

- Read the adjudication of each of these chains, at the exact version and sha256 shown on its stage card:

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

- If a chain has no adjudication, say so and stop: this stage is gated on all of them existing.

## How to decide

- A relation that survived its own adjudication is carried forward at the strength that adjudication supports, not at the strength its research claimed.
- Where two chains conflict, say which evidence decides and why, or record the conflict as unresolved.
- Do not average adjudications, and do not treat cross-chain agreement as independent confirmation when the chains share an input.
- A relation that was rejected or left unresolved in adjudication stays rejected or unresolved here.

## Five kinds of evidence that must not be mixed

Each kind answers a different question, and evidence of one kind never stands in for another. State which kind every load-bearing claim rests on, in the sentence that makes the claim:

- **Economic mechanism** - why an input could move the dollar inside the session at all. A mechanism is a reason to look; it is not a measurement, and a plausible channel is not evidence that the channel operates.
- **Contemporaneous association** - what moves with the dollar at the same time. It says nothing about direction after the cutoff, and the dollar may be the thing doing the moving.
- **Predictive evidence from other windows** - measured relations for a close-to-close day, a New York session, an event window or a monthly horizon. Relevant background, not evidence for this session; name the window every time the number is quoted.
- **Evidence for our exact session** - a measurement of the 05:00 Europe/London start to the 05:00 Europe/London endpoint on the next local date. Where none exists for a claim, say so rather than borrowing another window's result.
- **Incremental value beyond existing inputs** - what this factor adds to a decision already able to use the entries before it. Information already contained in an earlier input is not new, and a factor that adds nothing is a finding, not a gap.

A claim that changes kind between sections - a mechanism presented as a measurement, another window presented as ours, an input already in the decision presented as new - is the most common way a body of research overstates what is known. Where the same evidence is counted twice, say so.

## Conclusions this stage is allowed to reach

- **Exclusion** - the evidence may support leaving this factor out of the decision entirely.
- **Regime-only use** - the evidence may support using it only in a named regime, and only where that regime is identifiable at the cutoff.
- **Insufficient evidence** - where nothing has been measured for this session, saying so is the correct return; the remedy is a measurement or a supplement, never a stronger claim.
- **Adding nothing** - a factor whose information is already in the inputs before it earns no weight. More factors are not assumed to improve accuracy, and improved accuracy is only ever an empirical result.

## What the synthesis must contain

1. **Asset-level conclusion** - what the evidence supports about the direction of the dollar over the session, stated plainly.
2. **What survives** - the relations carried forward from adjudication, each with the strength its adjudication supports.
3. **Conflicts between chains** - each conflict, the evidence that decides it, and what remains unresolved.
4. **Proposed asset-level treatment** - only where the evidence supports it: inputs, transformations, signs, thresholds, lookbacks and timing. Where it does not, say that instead.
5. **Explicitly unvalidated parameters** - every number or choice proposed that has not been measured, named as unvalidated.
6. **Required empirical tests and remaining blockers** - what would have to be measured, on what sample and window, with what data, and what is missing or behind a paywall.
7. **What is not claimed** - a plain section listing what this synthesis does not establish.

## The line this stage must not cross

This is accepted research, not a validated trading rule. It proposes; it does not implement, score, deploy or change a live call, and it asserts no performance figure it has not measured.

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

- Required content: The asset-level conclusion; which factor-chain findings survive; how conflicts between factor chains are resolved; the proposed asset-level treatment; explicitly unvalidated parameters; required empirical tests; and an explicit what-is-not-claimed section.
- Return one Markdown document. At the top, before the body, list every factor-chain adjudication you read with its document id, version and sha256 as shown on its stage card, so the gate can be audited from the return alone.

```
Synthesis chain: usd-final-asset-analysis
Adjudication read: <factor id> - <document id> - version <version> - sha256 <sha256>
Adjudication read: <factor id> - <document id> - version <version> - sha256 <sha256>
```
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

The final red-team judges this synthesis and the evidence behind it. Only after the final adjudication decides those findings can an isolated implementation and validation step follow, and nothing enters the live engine because a document exists.
