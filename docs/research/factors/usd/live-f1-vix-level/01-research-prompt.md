# F1 VIX level and risk regime - live.f1-vix-level - stage 1 of 3: Research

- Factor chain `usd-factor-live-f1-vix-level` for factor `live.f1-vix-level` on asset USD; group label `usd-topic-vix-level-and-risk-regime` (VIX, its change and the USD risk regime at the 05:00 London cutoff); stage `research`; this stage returns exactly one Markdown document (report).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `live.f1-vix-level` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- The programme has already dispatched the research behind this chain: it is deep-research step 1 under task `USD-BASELINE-AUDIT-01`, pack version 2.0.0, context version usd-session-context-20261014.1.

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

1. Chain question: does `live.f1-vix-level` - F1 VIX level and risk regime - carry information about the next 24-hour dollar move, and in which quantity? VIX level is read as the risk regime the dollar is trading in. The rulebook also describes 1d and 5d modifiers; the deployed code does not implement them.
2. Is the informative quantity the level, the one-day change or a five-day change, and does the answer differ between calm and stressed regimes?
3. Does the volatility-of-volatility or term-structure information add anything the level does not already carry?
4. Is the mechanism safe-haven demand, risk appetite, carry or policy expectations, and what observable at the cutoff distinguishes them?
5. How much of the VIX move is already in the dollar at 05:00 Europe/London, and what is left for the following 24 hours?

## Existing thresholds are context, not the scope limit

The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.

## The dispatched assignment

The programme sent this brief for the research behind this chain. It is reproduced here in full so that this one prompt is sufficient on its own; its own file is `docs/research/handoff/usd/v1/deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md`, and its hash is recorded in the chain registry.

--- begin dispatched brief ---

# VIX and the subsequent direction of the US dollar - comprehensive research brief (live.f1-vix-level)

- Task: `USD-BASELINE-AUDIT-01`. Report brief 1.0.0 of the deep-research tier, context version usd-session-context-20261014.1, pack version 2.0.0, extracted 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`.
- Read [`deep-research/CONTEXT_PACK_NEUTRAL.md`](deep-research/CONTEXT_PACK_NEUTRAL.md) first. It carries the session, the existing factors, the rules in force, the data that exists and the decisions that are open - and nothing else, on purpose.
- This brief is step 1 of four. A research card is step 3's output, under the same task, and it is not what this brief asks for.

## 1. What is asked

Produce one comprehensive, source-backed report. It is the primary deliverable of this programme:

A comprehensive, source-backed report investigating how VIX - its level, its change and its interactions with the other factors in this system - relates to the subsequent direction of the US dollar over one session: 05:00 Europe/London to 05:00 Europe/London on the next local date.

We have a rule in force that reads the VIX level as a risk regime, and a session we have defined but have not measured, because the instrument that would label it has no verified quote source. Neither of those is the question. The question is what the evidence actually says about how VIX and the things it interacts with relate to where the dollar goes next, inside this window, and where that evidence is thin, contradictory or absent.

Return the report as markdown, plus the source note described in section 6. Format the report with the sections of section 3 in that order: a reader who disagrees with you should be able to find the weakness.

## 2. The session the report is written for

- Start 05:00 Europe/London. End 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart; every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- The label instrument is proposed as DXY and is UNVERIFIED: no intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. The closed 24-hour study behind it overlaps the corrected session for 14.5 nominal hours (15.5 in the weeks when New York has changed and London has not) and leaves the session's first 9.5 hours unmeasured. Read every number in this repository as belonging to one of those windows, and say which.

## 3. What the report must cover

1. What VIX is and what it measures, from sources: the level, the index family around it, the futures term structure, and anything published about volatility of volatility. Name the instrument and the window of every claim.
2. The proposed mechanisms by which VIX would move the dollar inside a 24-hour London-to-London window - safe-haven demand, risk appetite and cross-asset correlation, carry and funding, policy expectations, positioning and flows - and the observable each mechanism would leave at the cutoff.
3. Level against change: whether the level, the 1-day change or a longer change is the informative quantity, and on what evidence that judgement rests.
4. Interactions with the factors in this system, taken from the context pack's factor table: for each one, whether the sources support an interaction with VIX, what the two together would imply, and which pairs would double-count one input. The deployed set already reads VIX in 3 places - `live.f1-vix-level`, `live.f9-dollar-smile`, `live.f10-equity-versus-usd` - and the session set carries its own VIX card, so name every overlap you rely on and every overlap you are introducing.
5. Where the relation weakens, changes sign or stops being informative: growth shocks against policy and funding shocks, low-volatility regimes, event days, month-end and quarter-end, and what the sources say distinguishes them.
6. What is already in the price at the cutoff, given that 05:00 London follows the US close that produced the VIX print, and how a study could tell a reaction from a prediction.
7. The cross-asset carriers of the same channel: equities, credit, gold, rates and crypto, with the same instrument and window labelling.
8. Event and calendar conditioning inside the window, including the release calendar and the H.10 timing.
9. What the sources cannot settle: contradictions, weak identification, period dependence, and claims that are plausible but unsourced.
10. What our own session cannot be measured on yet, stated plainly, and what that does not block.
11. Candidate relations, unranked: as many as the sources support, each with the window it was evidenced on, the direction, the condition under which it holds and what would falsify it.
12. Open questions, and what you would need to fetch or measure next.
13. What is not claimed, in your own words.

## 4. Evidence standards

- Cite only what you actually fetched in this session: the link, the passage you relied on, when the source is dated, and what that passage supports.
- Label the window of every piece of evidence. A close-to-close daily relation, an intraday slice, an options-implied measure and a 30-hour study window are four different objects; none of them may be presented as evidence about our 05:00-to-05:00 session.
- Keep mechanism apart from measurement. A coherent argument for why a channel exists is not a measurement of it, and a modelled or simulated figure is not an observed one.
- Where sources disagree, give both and say which one you find better identified and why.
- Prefer primary sources - the exchange, the index provider, the Federal Reserve, the paper itself - over summaries, and say when only a summary was reachable.
- Name the instrument a claim is really about, every time. Never present another instrument as DXY.
- A relation that exists on another asset, another window or another era is reported as exactly that.

## 5. Context, not a limit

- The rule in force and the data reachable today are context for this programme, not limits on it. The deployed sign, weight, threshold and lookback are the object of an audit; they are never evidence for a claim. A review may use any source it can fetch and cite, whether or not this repository can reproduce it. What is missing blocks one thing only: empirical validation of our exact session. It does not block research into mechanisms, evidence and interactions, and it is never a reason to narrow the question to what this repository happens to hold.
- At most two programmable hypotheses per returned card. That limit is a card rule: it applies to the individual research card in step 3, and it does not apply to the discovery phase, where a report may state, compare and rank as many candidate relations as its sources support.
- The label instrument and quote source are unverified, and the missing-quote policy, the flat band and the tie rule are open decisions listed in the context pack. None of them is frozen here, none of them is yours to freeze, and the report may say what the sources imply for each of them.

## 6. What to return

1. The report, as markdown, with the sections of section 3 in that order and an explicit what-is-not-claimed section.
2. The source note: every source you fetched, its link, the passage you relied on, what it supports, the window it concerns and whether it is primary; then the questions you could not resolve and what you could not reach behind a paywall or a login.
3. Both upload against `USD-BASELINE-AUDIT-01` for `live.f1-vix-level` in the Research Library. An upload records evidence; it is not an approval, and it moves no factor's status.

## 7. Prohibitions

Do not invent a backtest, a performance figure, an accuracy rate or a sample size. If you have not
measured it, say it is unmeasured. Numbers you remember are not evidence.
Do not use hindsight: never state what a past period would have predicted using information that was not
available at that time, and do not present a later revision as a first print.
Cite only sources you actually fetched in this session, with the link and the passage you relied on.
Where you are uncertain, say so and give the reason; an unresolved question is a valid return.
State effects that are already in the price at the cutoff rather than counting them again as predictive.
Treat the deployed weights, thresholds and signs as a baseline to audit, never as evidence for your claim.
Name the instrument a claim is really about. Never present another instrument as DXY.
No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by
this pack, and none may be proposed as part of the deliverable.

## 8. What happens after you return it

An independent red team attacks the report claim by claim (step 2, `deep-research/RED_TEAM_REVIEW_BRIEF.md`). Only what survives is carried into the revised synthesis and the structured research cards (step 3, `deep-research/SYNTHESIS_AND_CARDS_BRIEF.md`), where the per-card limit of at most two programmable hypotheses applies. Nothing is scored before the session and data contract is frozen (step 4, `deep-research/BACKTEST_HANDOFF_BRIEF.md`), and no weight, sign, threshold or lookback changes because a report or a backtest exists.

## 9. What this brief is not

- Not a research card: a card is step 3's output, on the schema, and the two-hypothesis limit is not a limit on this report.
- Not an audit of our deployed rule, and not an approval of it or of any replacement: the deployed rule is context to be tested against the evidence, never evidence for a claim.
- Not a measurement of our session: the report says what is known and how well, and states plainly what the missing label data leaves unmeasured.
- Not a backtest, a performance figure, an accuracy rate or a sample size, and it asserts none.
- Not a live change of any kind: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this brief.

## 10. The other nine deployed factors and the fifteen session factors

This brief is the programme's first report and its subject is VIX. The other factor ids in the context pack get their own assignments: the deployed set audits code that runs (tasks `USD-BASELINE-AUDIT-01` to `USD-BASELINE-AUDIT-10`, one per factor, of which only `USD-BASELINE-AUDIT-01` is addressed here), and the fifteen session factors carry the two field packages. The same four steps apply to them when their turns come.

--- end dispatched brief ---

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
