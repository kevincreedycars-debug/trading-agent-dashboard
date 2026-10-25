# Release surprise at first print - macro.release-surprise-at-first-print - stage 3 of 3: Adjudication

- Factor chain `usd-factor-macro-release-surprise-at-first-print` for factor `macro.release-surprise-at-first-print` on asset USD; group label `usd-topic-economic-surprise-and-fed-bias` (Economic surprises, first prints and Fed bias); stage `adjudication`; this stage returns exactly one Markdown document (synthesis).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `macro.release-surprise-at-first-print` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.1.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- Attach both documents this stage judges: the research return for factor `macro.release-surprise-at-first-print` (chain `usd-factor-macro-release-surprise-at-first-print`) and the red-team review of it. Each stage card shows its document id, version and sha256; attach those exact versions.

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

## The questions this stage must decide

A question does not stop at stage 1. Decide each question below on the two documents and on the sources you fetched yourself; where the evidence does not decide, record it as unresolved and name what would decide it.

1. What is the surprise - the first print minus the consensus published before the release - and can any such pair be reached without a paid vintage archive?
2. At which moment does the surprise become observable, and how much of the reaction is already inside the dollar by the next 05:00 London cutoff?
3. Is the mechanism a policy-expectation repricing or a risk-premium change, and does the sign depend on the state of the policy cycle and on where the policy rate sits?
4. Does the surprise add information beyond the front-end rate change and the equity move that follow the print, and what is the honest conclusion if no vintage source is reachable at all?
5. Which of these three chains is testing a surprise, which is testing a narrative, and which is testing the same underlying information twice?
6. Is the first print the only honest vintage, and what does the revision history of the tested series look like?

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
- **A potentially useful input or interaction** - the evidence may support a directional input, or a pair whose interaction carries information, as worth testing further. State the sign, the condition, the window it was evidenced on and the measurement that would validate it, and mark it unvalidated: this stage can support a candidate, never a confirmation.

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

- **macro.release-surprise-at-first-print** - Release surprise at first print (research blocked on data access). Role: direction. Group: research_session_v1.
  - The question this entry stands for: The honest test of the highest-weight live family. Asking for a first-print surprise with the consensus that was published before the release, and stating plainly if no such source is reachable.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Rates package USD-SESSION-A2; docs/research/usd-session/v1/inventory.md section 7.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/macro_data_inventory.md` (publication timing, revisions, missingness and live versus historical availability) - sha256 `3a473fd839c4676ff51a7b373822a5639e89d4b540ec1d4907074e391532418d`

## What to return

- Required content: Corrected conclusions; finding-by-finding decisions; accepted, rejected and unresolved claims; proposed treatment of the factor in the engine; inputs, transformations, timing, interactions and missing-data treatment; explicitly unvalidated parameters; required empirical tests and remaining blockers; the handoff section.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-macro-release-surprise-at-first-print
Reviewed factor: macro.release-surprise-at-first-print
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
