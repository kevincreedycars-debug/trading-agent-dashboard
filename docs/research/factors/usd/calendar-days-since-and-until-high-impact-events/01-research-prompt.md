# Distance from high-impact events - calendar.days-since-and-until-high-impact-events - stage 1 of 3: Research

- Factor chain `usd-factor-calendar-days-since-and-until-high-impact-events` for factor `calendar.days-since-and-until-high-impact-events` on asset USD; group label `usd-topic-calendar-and-data-quality` (Calendar state and the data-quality gate); stage `research`; this stage returns exactly one Markdown document (report).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `calendar.days-since-and-until-high-impact-events` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.2.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- Governing research contract: USD North Star v2.0, `docs/research-library/USD_North_Star_Model_Contract_v2.md`, sha256 `e39e13098829fd2f61e53a8430277bcbf04ba103b8ef9f93b914847c19e8369f`. Read the supplied contract when available; its substantive requirements are repeated below so this prompt remains self-contained. Report a missing or mismatched copy, do not invent having read or verified it.
- Earlier briefs and implementation notes remain historical evidence. Apply the v2 contract to this assignment without rewriting their history, changing live behaviour or treating a later requirement as something an earlier author already met.
- This is a versioned research assignment. Check the registry for existing returns before scheduling new work; preserve prior evidence and request a versioned supplement where needed. A generated prompt is not proof that this chain has never been dispatched.

## Responsibility of this stage

Develop comprehensive primary-source research and falsifiable conditional hypotheses, with measurement definitions, competing mechanisms, strongest supporting and opposing evidence, availability and a proposed rejection test. Literature review and test design are this stage; running a new backtest is not required or authorised. Lack of exact-session measurements limits the conclusion, not the ability to return honest research.



Return a coverage checklist inside the same Markdown document: each required section and factor question addressed, partial, not applicable with reason, or blocked with missing evidence. A truncated or missing required section is not a complete return. Source-access gaps must remain visible; a fully reported negative finding is a valid result.

## What this stage is for

Produce one comprehensive, source-backed report investigating how the inputs of this factor - their levels, their changes and their interactions with each other and with the rest of the system - relate to the subsequent direction of the US dollar over one session: 05:00 Europe/London to 05:00 Europe/London on the next local date.

Rules are in force for some of these entries, and the session is defined but unmeasured because the instrument that would label it has no verified quote source. Neither is the question. The question is what the evidence actually says about where the dollar goes next inside this window, and where that evidence is thin, contradictory or absent.

## What the report must cover

1. **Measurement**: what each input is and what it measures, from sources - the index or series family around it, any futures or forward structure, the publication and revision process, and the exact window each measurement refers to. Name the instrument and the window of every claim.
2. **Mechanisms**: the channels by which each input could move the dollar inside a 24-hour London-to-London window - safe-haven demand, risk appetite and cross-asset correlation, carry and funding, policy expectations, positioning and flows - and the observable each mechanism would leave at the cutoff.
3. **Regimes**: whether the relation is stable or regime-dependent (volatility level, direction of the dollar, policy cycle, liquidity), and on what evidence that judgement rests.
4. **Level against change**: whether the level, a one-day change or a longer change is the informative quantity, and on what evidence.
5. **Interactions**: for each pair of entries the sources support - inside this factor and with the other factor entries - the sign, the mechanism, the window, and whether the pair is the same information counted twice.
6. **Timing**: what is observable at 05:00 Europe/London, what is already in the price by then, and what arrives only during the session.
7. **Predictive evidence**: what has actually been measured about the subsequent 24-hour direction, with the sample, the window and the era stated; and where the honest answer is that nothing has been measured for this instrument and window.
8. **Contradictory findings**: the strongest contrary evidence you found, named as such rather than omitted.
9. **Hypotheses**: the candidate relation or relations worth testing, each with a falsifiable statement, what would refute it, and how it could be measured in this repository.
10. **Data requirements**: the series, resolution, vintage handling and history the test would need, and which of them are missing or behind a paywall.

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

## Questions for this factor

1. Chain question: does `calendar.days-since-and-until-high-impact-events` - Distance from high-impact events - carry information about the next defined London-to-London dollar move, and in which quantity? Positioning measured as distance from known high-impact dates, using only the release calendar and never the surprise.
2. Is distance from a high-impact date a meaningful state variable, and does the evidence support drift before a release, after it, or neither?
3. Which events count as high impact, and does the answer depend on a classification that is itself hindsight-defined?
4. Is the mechanism positioning, hedging demand, or pre-announcement drift, and what observable at the cutoff separates it from ordinary seasonality?
5. Is the distance measure distinct from the release-window factor and from a volatility regime, and does it carry any information beyond them?
6. How do rescheduled CPI/PCE/NFP, FOMC, GDP, retail sales, ISM and ECB events, time-zone changes and prior-release revisions affect distance as known at cutoff, and is positioning measured independently of the later price response?
7. Can an abstention rule be evaluated at all without a frozen label instrument, and what would it take?

## Existing thresholds are context, not the scope limit

The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.

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

- **calendar.days-since-and-until-high-impact-events** - Distance from high-impact events. Role: regime. Group: research_session_v1.
  - The question this entry stands for: Positioning measured as distance from known high-impact dates, using only the release calendar and never the surprise.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Collector calendar feed (paid); Rates package USD-SESSION-A2.

## Companion files in the repository

Files in the checkout this chain rests on, if you can reach them. They are aids: the prompt has to stand on its own without them.

- `docs/research/usd-session/v1/inventory.md` (the input and decision inventory this topic closes out) - sha256 `a886f1ddcce52d4d8a0af77069b391deb1338275380cccd2e08d41fd61f2d56a`
- `docs/research/handoff/usd/v1/packs/calendar-days-since-and-until-high-impact-events.md` - the published brief for `calendar.days-since-and-until-high-impact-events`; sha256 `d7af3823c18f92ac4ca110b72cd76ea2cce7d67dc7fe1d5091a1b49f089f14dd`

## What to return

- Required content: Sections in the order the prompt asks for, an explicit what-is-not-claimed section, and the source note naming every source you fetched, the passage you relied on, the window it concerns and whether it is primary.
- Return one Markdown document. The report and its source note belong inside that one file: sections in order, then the source note, then the what-is-not-claimed section.
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

An independent red team attacks the report claim by claim (stage 2). Only what survives is carried into the adjudication (stage 3), which decides what, if anything, enters central USD synthesis. Nothing is scored before the session and data contract is frozen, and no weight, sign, threshold, lookback or live call changes because a report exists.
