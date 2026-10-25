# F1 VIX level and risk regime - live.f1-vix-level - stage 1 of 3: Research

- Factor chain `usd-factor-live-f1-vix-level` for factor `live.f1-vix-level` on asset USD; group label `usd-topic-vix-level-and-risk-regime` (VIX, its change and the USD risk regime at the 05:00 London cutoff); stage `research`; this stage returns exactly one Markdown document (report).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `live.f1-vix-level` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.1.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- The programme has already dispatched the research behind this chain: task `USD-BASELINE-AUDIT-01`, brief 1.0.0, pack version 2.0.0, context version usd-session-context-20261014.1. That brief is the record of what was asked; this prompt is what this stage is judged against.

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

1. Chain question: does `live.f1-vix-level` - F1 VIX level and risk regime - carry information about the next 24-hour dollar move, and in which quantity? VIX level is read as the risk regime the dollar is trading in. The rulebook also describes 1d and 5d modifiers; the deployed code does not implement them.
2. Is the informative quantity the VIX level at the last US close, its one-day change or its five-day change, and does the deployed 25/16 pair add anything a continuous level does not?
3. How stale is the VIXCLS observation at the 05:00 London cutoff, and what does that staleness do to a claim that the level is a cutoff-time regime read?
4. Is the mechanism safe-haven demand, risk appetite, carry or policy expectations, and which observable at the cutoff separates them from a common hidden driver?
5. Does the VIX level still carry information once the cross-asset risk state, gold and the credit spread are in the model, or is it the same risk factor counted twice?
6. Which of these two chains is measuring something the other does not, and which is the same VIX variable counted twice?

## Existing thresholds are context, not the scope limit

The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.

## The dispatched assignment

This chain was dispatched under task `USD-BASELINE-AUDIT-01` - brief 1.0.0, pack version 2.0.0, context version `usd-session-context-20261014.1`, issued 2026-10-15. The brief's own file is `docs/research/handoff/usd/v1/deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md`, sha256 `40a05c141bf2c6baab1417b896d763174fd06242725b4c0d6c60842aacdc0923`; it stays in the repository as the record of what was asked, and it is not reproduced here.

The brief was written for a four-step programme: report, red team, research cards, then a backtest handoff. This chain replaced that with three stages - research, red team, adjudication - so anything the brief says about step numbers, research cards, card schemas or a per-card hypothesis limit belongs to a workflow this chain does not use and does not constrain this report. This stage returns one report, stage 2 attacks it claim by claim, and stage 3 decides what, if anything, enters central USD synthesis.

Two requirements of the brief are kept here because the rest of this prompt does not say them:

- Prefer primary sources - the exchange, the index provider, the Federal Reserve, the paper itself - over summaries, and say when only a summary was reachable. Where sources disagree, give both and say which you find better identified, and why.
- Follow the same channel into its cross-asset carriers - equities, credit, gold, rates and crypto - labelling every instrument and window the same way, and condition the window on the event and release calendar, including the timing of the Federal Reserve H.10 release.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **live.f1-vix-level** - F1 VIX level and risk regime. Role: regime context. Group: live_engine.
  - The question this entry stands for: VIX level is read as the risk regime the dollar is trading in. The rulebook also describes 1d and 5d modifiers; the deployed code does not implement them.
  - Rule in force today, as context to audit and never as evidence: VIX above 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH; level only; the documented 1d/5d modifier is not implemented.
  - Threshold: 25 / 16; lookback: level.
  - Series the collector reads: FRED VIXCLS, read by the collector and stored as vix_level.

## Companion files in the repository

Files in the checkout this chain rests on, if you can reach them. They are aids: the prompt has to stand on its own without them.

- `docs/research/handoff/usd/v1/deep-research/CONTEXT_PACK_NEUTRAL.md` (the neutral context pack the brief asks the reader to work from) - sha256 `7e92e4e568df0b84cde906ab4db0ce6135348c99ec871ef8f7b6e48ee8471b00`
- `docs/research/handoff/usd/v1/packs/f1-vix-level.md` - the published brief for `live.f1-vix-level`; sha256 `808dc01ada48798e01561ef31fd19899dffc0eac9fee826bf9dacd067e499842`

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
