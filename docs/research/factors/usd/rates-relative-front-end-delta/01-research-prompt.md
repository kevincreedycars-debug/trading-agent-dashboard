# Relative front-end delta - rates.relative-front-end-delta - stage 1 of 3: Research

- Factor chain `usd-factor-rates-relative-front-end-delta` for factor `rates.relative-front-end-delta` on asset USD; group label `usd-topic-front-end-rates` (US front-end rates, real yields and curve position); stage `research`; this stage returns exactly one Markdown document (report).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `rates.relative-front-end-delta` and is not counted as a second independent result elsewhere.
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

## Questions for this factor

1. Chain question: does `rates.relative-front-end-delta` - Relative front-end delta - carry information about the next 24-hour dollar move, and in which quantity? US against German and other G10 front ends, with each euro-area and UK leg named rather than implied.
2. Which of the eight entries is measuring something the others do not, and which pairs are the same information counted twice?
3. Is the informative quantity the level, a five-day change or a same-session change, and does the answer depend on the policy cycle?
4. Does a real-yield change add information beyond the nominal front end, and does that survive the inflation-expectation measurement problem?
5. Are these relations already in the dollar by 05:00 Europe/London, given that the US cash market is closed at the cutoff?

## Existing thresholds are context, not the scope limit

The rules in force are listed below because they are what the deployed engine does today. Audit them rather than defend them, and do not treat them as the limit of what may be investigated: if the sources support a different quantity, window, sign or interaction, say so and say what it rests on.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window**: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps the corrected session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **rates.relative-front-end-delta** - Relative front-end delta. Role: direction. Group: research_session_v1.
  - The question this entry stands for: US against German and other G10 front ends, with each euro-area and UK leg named rather than implied.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Bundesbank 2Y series; Rates package USD-SESSION-A2.

## Companion files in the repository

Files in the checkout this chain rests on, if you can reach them. They are aids: the prompt has to stand on its own without them.

- `docs/research/usd-session/v1/weight_vector_discrepancy.md` (the two live weight vectors and where each is used) - sha256 `2f420763193b0a032ccd38c1958563cd848c942f7cf49b53cad8de0ad98535cc`
- `docs/research/handoff/usd/v1/packs/rates-relative-front-end-delta.md` - the published brief for `rates.relative-front-end-delta`; sha256 `63d9f1d934b160314332f6b955ef84adca0df19bdf6cdbc19af881006c82f751`

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
No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, and none may be proposed as part of the deliverable.

## What happens after you return it

An independent red team attacks the report claim by claim (stage 2). Only what survives is carried into the adjudication (stage 3), which decides what, if anything, enters central USD synthesis. Nothing is scored before the session and data contract is frozen, and no weight, sign, threshold, lookback or live call changes because a report exists.
