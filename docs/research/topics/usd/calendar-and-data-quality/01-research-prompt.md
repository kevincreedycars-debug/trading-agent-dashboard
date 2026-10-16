# Calendar state and the data-quality gate - stage 1 of 3: Research

- Topic `usd-topic-calendar-and-data-quality` on asset USD; stage `research`; this stage returns exactly one Markdown document (report).
- Factors this stage is evidence for: `calendar.known-releases-between-cutoff-and-endpoint`, `calendar.days-since-and-until-high-impact-events`, `data.quality-gate-for-abstention`. One document can carry evidence for more than one factor entry; that is a mapping, not a second independent result.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- This topic has not been dispatched yet. This is the next research assignment, written and hash-checked so it is ready to run.

## What this stage is for

Produce one comprehensive, source-backed report investigating how the inputs of this topic - their levels, their changes and their interactions with each other and with the rest of the system - relate to the subsequent direction of the US dollar over one session: 05:00 Europe/London to 05:00 Europe/London on the next local date.

Rules are in force for some of these entries, and the session is defined but unmeasured because the instrument that would label it has no verified quote source. Neither is the question. The question is what the evidence actually says about where the dollar goes next inside this window, and where that evidence is thin, contradictory or absent.

## What the report must cover

1. **Measurement**: what each input is and what it measures, from sources - the index or series family around it, any futures or forward structure, the publication and revision process, and the exact window each measurement refers to. Name the instrument and the window of every claim.
2. **Mechanisms**: the channels by which each input could move the dollar inside a 24-hour London-to-London window - safe-haven demand, risk appetite and cross-asset correlation, carry and funding, policy expectations, positioning and flows - and the observable each mechanism would leave at the cutoff.
3. **Regimes**: whether the relation is stable or regime-dependent (volatility level, direction of the dollar, policy cycle, liquidity), and on what evidence that judgement rests.
4. **Level against change**: whether the level, a one-day change or a longer change is the informative quantity, and on what evidence.
5. **Interactions**: for each pair of entries the sources support - inside this topic and with the other factor entries - the sign, the mechanism, the window, and whether the pair is the same information counted twice.
6. **Timing**: what is observable at 05:00 Europe/London, what is already in the price by then, and what arrives only during the session.
7. **Predictive evidence**: what has actually been measured about the subsequent 24-hour direction, with the sample, the window and the era stated; and where the honest answer is that nothing has been measured for this instrument and window.
8. **Contradictory findings**: the strongest contrary evidence you found, named as such rather than omitted.
9. **Hypotheses**: the candidate relation or relations worth testing, each with a falsifiable statement, what would refute it, and how it could be measured in this repository.
10. **Data requirements**: the series, resolution, vintage handling and history the test would need, and which of them are missing or behind a paywall.

## Questions for this topic

1. Does a scheduled release inside the session change the expected direction, the expected dispersion, or only the confidence?
2. What is the honest treatment when the collector input is stale or missing: abstain, shrink or score neutral?
3. Which releases matter for the dollar over this window, and are the timestamps verifiable at the cutoff?
4. Can an abstention rule be evaluated at all without a frozen label instrument, and what would it take?

## Existing thresholds are context, not the scope limit

The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The factor entries this topic is evidence for

These entries are context to audit. They are not evidence for any claim, and they are not the scope limit of this assignment.

- **calendar.known-releases-between-cutoff-and-endpoint** - Known releases inside the window. Role: quality gate. Group: research_session_v1.
  - The question this entry stands for: Which releases are scheduled between the cutoff and the endpoint, and how a known-but-unreleased event may be used without using its outcome.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Collector calendar feed (paid); Rates package USD-SESSION-A2.
- **calendar.days-since-and-until-high-impact-events** - Distance from high-impact events. Role: regime. Group: research_session_v1.
  - The question this entry stands for: Positioning measured as distance from known high-impact dates, using only the release calendar and never the surprise.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Collector calendar feed (paid); Rates package USD-SESSION-A2.
- **data.quality-gate-for-abstention** - Data quality gate for abstention. Role: quality gate. Group: research_session_v1.
  - The question this entry stands for: Which data states should force abstention instead of a weak call, given that the live collector has no as-of check and no staleness test.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: docs/research/usd-session/v1/inventory.md section 4 and 7.

## Companion files in the repository

Files in the checkout this topic rests on, if you can reach them. They are aids: the prompt has to stand on its own without them.

- `docs/research/usd-session/v1/inventory.md` (the input and decision inventory this topic closes out) - sha256 `a886f1ddcce52d4d8a0af77069b391deb1338275380cccd2e08d41fd61f2d56a`
- `docs/research/handoff/usd/v1/packs/calendar-known-releases-between-cutoff-and-endpoint.md` - the published brief for `calendar.known-releases-between-cutoff-and-endpoint`; sha256 `600b05e33f5f29894b51ff501bec88d0d6d89ed5cd1105a9a2736bfa8e7e89db`
- `docs/research/handoff/usd/v1/packs/calendar-days-since-and-until-high-impact-events.md` - the published brief for `calendar.days-since-and-until-high-impact-events`; sha256 `d7af3823c18f92ac4ca110b72cd76ea2cce7d67dc7fe1d5091a1b49f089f14dd`
- `docs/research/handoff/usd/v1/packs/data-quality-gate-for-abstention.md` - the published brief for `data.quality-gate-for-abstention`; sha256 `a4415c7cc67ec20a53ab66b069313299e5280f0ebffea4bf3ec15a0a8cafb236`

## What to return

- Required content: Sections in the order the prompt asks for, an explicit what-is-not-claimed section, and the source note naming every source you fetched, the passage you relied on, the window it concerns and whether it is primary.
- Return one Markdown document. The report and its source note belong inside that one file: sections in order, then the source note, then the what-is-not-claimed section.
- Keep it in one file. Tables, sources, hypotheses, candidate relations and appendices all belong inside that document; nothing here needs a second file, a JSON payload or a hand-built schema.
- The dashboard records the topic, the stage and the exact version this document judged, so that metadata is not yours to assemble: pick the stage card, choose the file, upload it.

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

An independent red team attacks the report claim by claim (stage 2). Only what survives is carried into the adjudication (stage 3), which decides what, if anything, enters central USD synthesis. Nothing is scored before the session and data contract is frozen, and no weight, sign, threshold, lookback or live call changes because a report exists.
