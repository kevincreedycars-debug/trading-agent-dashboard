# US front-end delta - rates.us-front-end-delta - stage 3 of 3: Adjudication

- Factor chain `usd-factor-rates-us-front-end-delta` for factor `rates.us-front-end-delta` on asset USD; group label `usd-topic-front-end-rates` (US front-end rates, real yields and curve position); stage `adjudication`; this stage returns exactly one Markdown document (synthesis).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `rates.us-front-end-delta` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Attach both documents this stage judges: the research return for factor `rates.us-front-end-delta` (chain `usd-factor-rates-us-front-end-delta`) and the red-team review of it. Each stage card shows its document id, version and sha256; attach those exact versions.

## What this stage is for

Read the research report and the red-team review together and produce the best-supported conclusion. Resolve each material objection on the evidence; do not split the difference, do not average the two documents, and do not treat agreement between them as evidence. Where the evidence does not decide, say which finding is unresolved and what would decide it.

## Which versions you are judging

- This stage judges two documents, and each needs its own identifier: the research return, and the red-team review of it.
- The dashboard supplies both, one card per document: the stage 2 card carries the research document id, version and sha256, and the stage 3 card carries the red-team document id, version and sha256, shown as a prefix on the card; any "Versions to judge" block copied with this prompt, and the handoff that supplies it, carries the same six values with the sha256 in full. Reproduce them in the identifier lines at the top of your return; do not assemble them yourself and do not take them from memory of another session.
- If your session can hash a file locally (`sha256sum`, `Get-FileHash`, `certutil -hashfile`, or the equivalent), recompute the sha256 of each attached file and write whether it matches the supplied value. If an attachment does not match the identifier supplied for it, say so and stop.
- If your session has no hashing tool, write plainly that the hashes were taken from the dashboard and were not independently recomputed in this session. Do not claim a verification you did not perform, and do not present the card's value as something you confirmed.
- If either attachment is missing, say so and stop.

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

Research accepted for synthesis is not a validated trading rule. This stage proposes; it does not implement, score, deploy or change a live call, and it asserts no performance figure it has not measured. A recommendation is not a change and is required content: which series and resolution the collector should record, with what vintage and history handling, and how a future engine should treat this factor, all belong in sections 4, 5 and 7. What is forbidden is making the change, presenting it as agreed or scheduled, or claiming that anything in the live engine, a workflow, the dashboard, the feed, the dispatcher or the database has already been changed.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **rates.us-front-end-delta** - US front-end delta. Role: direction. Group: research_session_v1.
  - The question this entry stands for: 2Y and 3M yield changes as policy-expectation proxies, with the publication lag of each series stated.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED DGS2 and DTB3 via the closed study dataset; Rates package USD-SESSION-A2.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/weight_vector_discrepancy.md` (the two live weight vectors and where each is used) - sha256 `2f420763193b0a032ccd38c1958563cd848c942f7cf49b53cad8de0ad98535cc`

## What to return

- Required content: Corrected conclusions; finding-by-finding decisions; accepted, rejected and unresolved claims; proposed treatment of the factor in the engine; inputs, transformations, timing, interactions and missing-data treatment; explicitly unvalidated parameters; required empirical tests and remaining blockers; the handoff section.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-rates-us-front-end-delta
Reviewed factor: rates.us-front-end-delta
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
Recommending data the collector should record and a treatment a future engine should apply is required content, not a change being made. No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, none may be carried out now, and none may be reported as done or as agreed.

## What happens after you return it

Central USD synthesis is a separate step: it reads the adjudications of every factor chain, resolves what conflicts between them, and only then can an isolated implementation and validation step follow. Nothing enters the live engine because a document exists.
