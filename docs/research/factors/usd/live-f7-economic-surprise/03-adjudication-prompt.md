# F7 US economic surprise - live.f7-economic-surprise - stage 3 of 3: Adjudication

- Factor chain `usd-factor-live-f7-economic-surprise` for factor `live.f7-economic-surprise` on asset USD; group label `usd-topic-economic-surprise-and-fed-bias` (Economic surprises, first prints and Fed bias); stage `adjudication`; this stage returns exactly one Markdown document (synthesis).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `live.f7-economic-surprise` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.2.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- Governing research contract: USD North Star v2.0, `docs/research-library/USD_North_Star_Model_Contract_v2.md`, sha256 `e39e13098829fd2f61e53a8430277bcbf04ba103b8ef9f93b914847c19e8369f`. Read the supplied contract when available; its substantive requirements are repeated below so this prompt remains self-contained. Report a missing or mismatched copy, do not invent having read or verified it.
- Earlier briefs and implementation notes remain historical evidence. Apply the v2 contract to this assignment without rewriting their history, changing live behaviour or treating a later requirement as something an earlier author already met.
- Attach both documents this stage judges: the research return for factor `live.f7-economic-surprise` (chain `usd-factor-live-f7-economic-surprise`) and the red-team review of it. Each stage card shows its document id, version and sha256; attach those exact versions.

## Responsibility of this stage

Trace every material claim and objection to a decision: retained conditional hypothesis, exclusion, regime-only finding, insufficient evidence or no incremental value. Record claim/issue ids, parent document versions, source passages, reasons, surviving conditions and the evidence needed to settle unresolved points. Do not manufacture a positive result or promote an unmeasured hypothesis into a validated rule. Distinguish a newly required v2 coverage gap in an older report from a false claim made by that report.



Return a coverage checklist inside the same Markdown document: each required section and factor question addressed, partial, not applicable with reason, or blocked with missing evidence. A truncated or missing required section is not a complete return. Source-access gaps must remain visible; a fully reported negative finding is a valid result.

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

1. What is a surprise here, and can the consensus archived before the release and the actual first print published at release be reached, or is the stored usd_signal an unversioned derived value whose inputs cannot be recovered?
2. Is the release outcome observable before the 05:00 London cutoff, and what does the signal do on a session whose releases land inside the window rather than before it?
3. Is the mechanism an immediate repricing of rate expectations, a risk-premium change or a growth surprise, and does the direction depend on the policy reaction function in force?
4. Does a surprise signal add information beyond the front-end rate change that follows it, and how much of the surprise reaction is already in the dollar by the next cutoff?
5. For CPI, PCE, NFP, GDP, retail sales and ISM, which headline, components, prior revisions and consensus vintages define the shock, and how do inflation/labour regimes change its USD sign? Treat FOMC and ECB policy shocks separately from numeric release surprises.
6. Which of these three chains is testing a surprise, which is testing a narrative, and which is testing the same underlying information twice?
7. Which vintage was actually available at each forecast cutoff, including revisions published by then, and how are first-release surprise tests kept distinct from later revision-news tests?

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

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the following local calendar date. Resolve each endpoint separately using the IANA zone `Europe/London`, record both UTC timestamps and offsets, and derive elapsed hours from those endpoints. Never implement the endpoint as a fixed UTC offset or by adding 24 elapsed hours. References below to a 24-hour or London-to-London session are shorthand for this local-date contract, not a fixed-duration rule. The North Star v2.0 contract pinned above governs this research; `docs/research/usd-session/v1/session_contract_v1.json` describes the earlier study.
- **Starts and ends**: the earlier study and `backtester/lib/usd_session_engine_interface.js` use Monday-to-Friday starts. That eligibility rule is provisional for this v2 research, not a universal requirement supplied by North Star v2.0. Declare and freeze eligible starts, holidays and quote handling before evaluation; do not silently broaden or narrow the sample. A Friday start ends on Saturday at 05:00 London, never Monday. Resolve DST even when the selected weekday sample contains no transition. When either endpoint quote is missing, retain the scheduled endpoints and report a data exclusion with coverage loss, never fill from a Friday close, Monday open, interpolation or later revision. Distinguish those unscorable observations from model abstentions on evaluable sessions, which remain in coverage and no-call reporting.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## North Star evidence and evaluation requirements

- **Source standard**: use primary publications, official series methodology, original research and release records for load-bearing claims; trace secondary summaries to originals where reachable. Record source title, publisher, URL, publication/version date, access date, relevant passage or pinpoint reference, instrument, sample and horizon. Separate what you fetched from inherited citations. Give the strongest supporting and opposing evidence and explain conflicts by identification, definitions, timing, sample or regime; inaccessible evidence remains unverified.
- **Point-in-time ledger**: for every proposed input distinguish observation/reference time, scheduled and actual release time, first publicly obtainable time, vendor dissemination time, local ingestion time and vintage/revision time. An observation date is not an availability timestamp; ingestion is not proof of earliest public availability. Only data published and obtainable by the cutoff qualify, and an operational replay must also respect when the system actually possessed them. Record time zones, source evidence, missing timestamps, staleness, consensus as-of time and first-print versus later-vintage values; never substitute revised history for the original snapshot.
- **Conditional regimes**: consider inflation, growth, labour, monetary-policy expectations, relative international policy, liquidity/funding stress, risk appetite and crisis regimes. For this factor, identify the material channels and cutoff-observable regime definitions, sign changes, already-priced effects and falsifiers; mark other regimes not applicable with a reason or unsupported, without inventing a new factor. Do not define a predictive regime using its subsequent outcome.
- **Economic events**: explicitly assess relevance of CPI, PCE, NFP, FOMC, GDP, retail sales, ISM and ECB decisions, plus other material releases supported by sources. Give proportionate detail: direct macro/calendar factors need release-level treatment; other factors need the relevant event-conditioned channel or a reason for no direct relation. Distinguish the pre-cutoff calendar, consensus, prior and revisions already known from actual/realised surprise and revisions released later; cover expected versus realised surprise, release timing, positioning and conditional policy/risk effects. Future actuals never enter the original cutoff forecast. Unscheduled shocks are a separate uncertainty class, not a claim that all shocks can be predicted.
- **Immutable forecasts and separate cohorts**: a proposed forecast record preserves issue time, target end time, input snapshot/version, model and prompt versions, evidence, direction or abstention and confidence. The original 05:00 call is immutable. Alternative horizons and post-release shadow reforecasts need separate issue/expiry times, snapshots and scored cohorts; never overwrite original calls, pool their outcomes or retroactively improve reported performance.
- **Event infrastructure boundary**: where this factor needs event data or a reassessment, inventory and reuse existing n8n/API collection from authorised inputs. Verify the event-to-snapshot-to-model chain in code before claiming automatic reruns or a manual-only limitation; otherwise mark that status unverified. A shadow proposal must address selective event eligibility, complete source data, consensus/revision integrity, as-of timestamps, deduplication/idempotency, cooldowns, rate limits, market hours, stale-input rejection and fail-closed handling. These are design requirements, not instructions to build a duplicate calendar, trigger a workflow or change trades.
- **Downstream tests**: propose falsifiable tests with frozen instrument/source, session eligibility, label/flat-band and missing-quote/abstention rules; time-ordered walk-forward and out-of-sample splits, an untouched holdout, simple baselines, overlap-aware ablations, uncertainty and a multiple-testing plan. Record previously exposed periods and candidate variants so a reused holdout is never called unseen. Parameters and regime definitions must be chosen on development data only. Do not run new experiments in these research stages or claim an unmeasured gain.
- **Separate outcomes**: distinguish directional accuracy, coverage, abstention, skipped-correct sessions and confidence calibration where applicable from downstream L2L performance under its own declared execution/outcome contract, costs and risk assumptions. Do not infer either outcome from the other. Compare abstention to always calling and to coverage-matched baselines; report data exclusions separately. Backtesting and portfolio-wide consistency remain downstream: independent Layer 1 agents must not read other agents' calls or shared conclusions to manufacture agreement.


## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **live.f7-economic-surprise** - F7 US economic surprise (research blocked on data access). Role: direction. Group: live_engine.
  - The question this entry stands for: The highest-weight live family. The stored usd_signal per event is copied straight through, with no consensus and no first-print vintage reachable from this repository.
  - Rule in force today, as context to audit and never as evidence: the collector pre-computes a usd_signal per event and the node copies it; no threshold, no as-of check, no vintage.
  - Threshold: none; lookback: whatever the collector stored.
  - Series the collector reads: Finnhub economic calendar (paid key), no consensus archive kept.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/macro_data_inventory.md` (publication timing, revisions, missingness and live versus historical availability) - sha256 `3a473fd839c4676ff51a7b373822a5639e89d4b540ec1d4907074e391532418d`

## What to return

- Required content: Corrected conclusions; finding-by-finding decisions; accepted, rejected and unresolved claims; proposed treatment of the factor in the engine; inputs, transformations, timing, interactions and missing-data treatment; explicitly unvalidated parameters; required empirical tests and remaining blockers; the handoff section.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-live-f7-economic-surprise
Reviewed factor: live.f7-economic-surprise
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
Do not invent numeric parameters to complete a specification. Retain a supported candidate value with provenance, or use a named unresolved parameter, the evidence needed to choose it and a fail-closed blocker; mark all unvalidated choices explicitly.
Do not spend paid API credits, purchase data, enable overages or change order execution. A paywall is a reported evidence gap, not permission to buy access. Preserve original reports, prompt lineage, input snapshots and forecasts.
Recommending data the collector should record and a treatment a future engine should apply is required content, not a change being made. No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, none may be carried out now, and none may be reported as done or as agreed.

## What happens after you return it

Central USD synthesis is a separate step: it reads the adjudications of every factor chain, resolves what conflicts between them, and only then can an isolated implementation and validation step follow. Nothing enters the live engine because a document exists.
