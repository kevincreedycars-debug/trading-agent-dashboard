# Backtesting under a frozen session and data contract - step 4 brief

- Task: `USD-BASELINE-AUDIT-01`. Step 4 of four of the deep-research tier 1.0.0, context version usd-session-context-20261014.1. The candidates it may score are the cards of [`deep-research/SYNTHESIS_AND_CARDS_BRIEF.md`](deep-research/SYNTHESIS_AND_CARDS_BRIEF.md), not the prose of a report.
- The design lives in `docs/research/usd-session/v1/session_contract_v1.json`. This brief does not change it; it states what has to be closed before anything is scored.

## 1. Nothing is scored before the design is frozen

A number produced before the design is fixed is a number that can be fitted, and every later comparison against it is contaminated. So the freeze comes first, in one recorded step, with the open entries of the contract resolved in writing: the label instrument and its quote source, the missing-quote policy, the flat band, the tie rule and the session calendar.

## 2. What the freeze has to contain

- The session: 05:00 Europe/London to 05:00 Europe/London on the next local date, Monday-to-Friday starts only, 24 nominal hours, resolved from the declared London transitions and never by adding hours, held by test over every start from 2023 to 2027.
- The session calendar: exchange holidays carried as data rather than inferred, so a holiday session is a stated exclusion and not a silent one.
- The label: the instrument and the quote source that price both ends of the session. Until that is closed nothing below can be computed, because both end prints come from it. Calling the label DXY while it is priced from something else is a defect, not a simplification.
- The missing-quote policy: one policy, frozen, with a session whose start or endpoint print is missing counted as a data exclusion that leaves the scored sample and is reported as coverage. The one proposed policy is that one, and it stays explicitly proposed until the freeze records it: this bundle does not freeze it and neither does the report.
- The flat band and the tie rule, re-derived for this session and frozen with the rest. The closed 24-hour study's 0.1 percentage-point band was fitted to a daily index over a nominal day and may not be borrowed.
- The split: which sessions are training and which are validation, fixed chronologically and declared before any result is seen. A parameter chosen on validation sessions is a parameter chosen on the answer.
- The input as-of rule, per input: every value carries an observation instant at or before the cutoff, no later revision is used as if it were a first print, and a daily series is the previous close with its declared staleness rather than the same morning's print.
- The scoring: primary metric balanced accuracy on decided calls; abstention allowed (true); a data exclusion and a model abstention counted and reported separately.

## 3. What any run must report

- coverage; sample size; matched-day comparison against the original and repaired engines; uncertainty; stability across periods; event-day versus quiet-day split.
- Which sessions were excluded and why, so coverage can be read as coverage rather than as a result.
- The deployed engine's stored calls score on this label only as a diagnostic arm, and every table says so: the deployed engine's stored calls score on the new label only as a diagnostic arm and every table says so; the deployed engine was never asked this question (09:30 ET to the next 16:00 ET close, 30.5 hours at the median) and was never asked to forecast from 05:00 London
- A parameter's chosen value, the range it was chosen from and the training-only rule that chose it, exactly as the card declared them before the run.

## 4. What a passing run would not mean

- Not a deployment: no weight, sign, threshold or lookback changes because a backtest passed.
- Not an approval: a reviewer accepts a card on evidence, and a backtest is one input to that review.
- Not a probability: forbidden unless a calibration beats the base rate.
- Not a licence to reopen the design: if the freeze has to change, the previous results are void and the freeze is recorded again before the next run.

## 5. What is deliberately deferred here

- The missing-quote policy stays proposed, not frozen: it is settled by the owner with the methodology review, and the VIX return is one input to that decision rather than the decision.
- No per-factor interface work is added by this bundle: nothing here changes a live node, a feed, a dashboard or a configuration.
- The label decision precedes everything else, and no scoring run starts while it is open.

## 6. Prohibitions

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

## 7. What this brief is not

- Not a result: it produces no number by itself and asserts none.
- Not authorisation to touch the live system: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by it.
