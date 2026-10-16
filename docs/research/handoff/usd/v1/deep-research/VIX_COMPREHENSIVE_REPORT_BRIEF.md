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
