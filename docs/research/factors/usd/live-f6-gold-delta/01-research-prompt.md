# F6 Gold delta - live.f6-gold-delta - stage 1 of 3: Research

- Factor chain `usd-factor-live-f6-gold-delta` for factor `live.f6-gold-delta` on asset USD; group label `usd-topic-dollar-index-gold-and-equities` (Dollar index, gold and equity-against-USD relations); stage `research`; this stage returns exactly one Markdown document (report).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `live.f6-gold-delta` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- This chain has not been dispatched yet. This is the next research assignment, written and hash-checked so it is ready to run.

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

## Questions for this factor

1. Chain question: does `live.f6-gold-delta` - F6 Gold delta - carry information about the next 24-hour dollar move, and in which quantity? Gold move as an inverse dollar-risk read.
2. Is the dollar smile a measured relation for this window, or a descriptive convenience: what would falsify it?
3. Which dollar index is a claim actually about, and does the answer change with the index construction?
4. Does a same-day dollar move followed by a session direction suggest mean reversion or continuation, and on what evidence?
5. Are gold and equities independent evidence for the dollar, or the same risk factor counted twice?

## Existing thresholds are context, not the scope limit

The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **live.f6-gold-delta** - F6 Gold delta. Role: direction. Group: live_engine.
  - The question this entry stands for: Gold move as an inverse dollar-risk read.
  - Rule in force today, as context to audit and never as evidence: at or below -0.1% reads BULLISH, above +0.1% BEARISH; falls back from 5-day to 1-day and records only a warning string.
  - Threshold: +/- 0.1%; lookback: 5 days, 1-day fallback.
  - Series the collector reads: Coinbase XAU-USD spot.

## Companion files in the repository

Files in the checkout this chain rests on, if you can reach them. They are aids: the prompt has to stand on its own without them.

- `docs/research/usd-session/v1/target_source_assessment.md` (DXY and intraday source coverage, access and cost) - sha256 `078f8951777b782643b0aa4d1a87ba82b1beede0128f2e43cf2b5faeed1277da`
- `docs/research/handoff/usd/v1/packs/f6-gold-delta.md` - the published brief for `live.f6-gold-delta`; sha256 `a52d73415b8684085e4b8d4642615409f759bc34059364e178b0e37c8e3b177a`

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
Recommending data the collector should record and a treatment a future engine should apply is required content, not a change being made. No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, none may be carried out now, and none may be reported as done or as agreed.

## What happens after you return it

An independent red team attacks the report claim by claim (stage 2). Only what survives is carried into the adjudication (stage 3), which decides what, if anything, enters central USD synthesis. Nothing is scored before the session and data contract is frozen, and no weight, sign, threshold, lookback or live call changes because a report exists.
