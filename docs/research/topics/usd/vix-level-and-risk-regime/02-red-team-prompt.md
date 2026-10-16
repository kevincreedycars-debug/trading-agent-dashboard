# VIX, its change and the USD risk regime at the 05:00 London cutoff - stage 2 of 3: Red-team

- Topic `usd-topic-vix-level-and-risk-regime` on asset USD; stage `red_team`; this stage returns exactly one Markdown document (review).
- Factors this stage is evidence for: `live.f1-vix-level`, `risk.vix-level-and-change-at-cutoff`. One document can carry evidence for more than one factor entry; that is a mapping, not a second independent result.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Reviewed document: the research return registered against topic `usd-topic-vix-level-and-risk-regime`, stage `research`. The stage 1 card shows its document id, its version and its sha256: attach exactly that version.

## What this stage is for

Find what is wrong, unsupported or overstated in the research report before the adjudication carries it further. A report that survives an honest attack is worth more than one that was never attacked, so this stage is expected to damage claims and to say which ones stood up. It is not a summary, not a rewrite and not a vote, and it does not manufacture disagreement.

## Which version you are attacking

- Attach the exact research version the stage 1 card points to, and nothing else about its reasoning.
- Copy that card's document id, version and sha256 into the identifier lines at the top of your return.
- If the copy you hold has a different hash from the one on the card, say so and stop: you would not be reviewing the registered version.

## Independence rules

- You are not the author's session and you did not write the report; do not ask it what it meant. The report must stand on the words it contains.
- Open the sources yourself wherever they are reachable, and say which ones you could re-fetch. Where a source is behind a login or a paywall, judge only on the quotation given and mark the claim status accordingly.
- Judge claims, not style, and attack the strongest version of a claim rather than a weakened one.
- Say when a claim is right and only its scope is too wide: a narrower true claim is a result, not a loss.

## What to attack, claim by claim

- **Traceability**: does the passage cited actually say what the claim says, and is the link the source itself rather than a summary of it?
- **Window**: is the evidence about our 05:00 London to 05:00 London session, or about a close-to-close day, an intraday slice or another window, presented as if it were ours?
- **Instrument**: is a claim really about EUR/USD, a basket or a future, presented under the DXY name?
- **Mechanism against measurement**: is a plausible channel being used as if the relation had been measured?
- **Already priced**: does the claim count an effect as predictive that the cutoff has already absorbed?
- **Identification and scope**: sample period, era dependence, regime dependence, conditioning on the outcome, survivorship in the sources chosen, base rates behind a conditional claim, and any number with no stated origin.
- **Counter-evidence**: is the strongest contrary evidence in the sources the report fetched absent, or present and dismissed without a reason?
- **Internal consistency**: does one section contradict another, and does the what-is-not-claimed section match what the body actually does?
- **Overlap**: does the report lean on an interaction that counts one input twice across factor entries, and does it say so?

## A verdict for every load-bearing claim

`SUPPORTED` - the sources given support it as stated. `NARROWED` - something in it is supported, and the supported part is stated in your own words. `NOT_SUPPORTED` - the sources given do not support it, or contradict it; say which. `UNASSESSABLE` - it could not be judged from the sources given; say what would settle it.

For each claim also give the claim quoted, its severity (fatal, material, cosmetic), what is wrong, and the evidence that would resolve it. End with two lists: what survives the attack unchanged, and what the review could not reach at all.

## The programme brief this stage follows

The deep-research tier wrote this step-2 brief for the dispatched topic. It is reproduced in full so that this one prompt is sufficient; its own file is `docs/research/handoff/usd/v1/deep-research/RED_TEAM_REVIEW_BRIEF.md`.

--- begin programme brief ---

# Independent red-team review of the VIX report - step 2 brief

- Task: `USD-BASELINE-AUDIT-01`. Step 2 of four of the deep-research tier 1.0.0, context version usd-session-context-20261014.1. The report under review is the return of [`deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md`](deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md).
- Attach the report and its source note, and nothing else about its reasoning.

## 1. What you are for

Your job is to find what is wrong, unsupported or overstated in the report before the synthesis carries it further. A report that survives an honest attack is worth more than a report that was never attacked, so the review is expected to damage claims and to say which ones stood up. It is not a summary, not a rewrite and not a vote.

## 2. Independence rules

- You are not the author's session and you did not write the report; do not ask it what it meant. The report must stand on the words it contains.
- Open the sources yourself wherever they are reachable, and say which ones you could re-fetch. Where a source is behind a login or a paywall and you cannot reach it, judge only on the quotation given and mark the claim's status accordingly.
- Judge claims, not style, and attack the strongest version of a claim rather than a weakened one.
- Say when a claim is right and only its scope is too wide: a narrower true claim is a result, not a loss.

## 3. What to attack, claim by claim

- Traceability: does the passage cited actually say what the claim says, and is the link the source itself rather than a summary of it?
- Window: is the evidence about our 05:00 London to 05:00 London session, or about a daily close-to-close day, an intraday slice or another window, presented as if it were ours?
- Instrument: is a claim really about EUR/USD, a basket or a future, presented under the DXY name?
- Mechanism against measurement: is a plausible channel being used as if the relation had been measured?
- Already priced: does the claim count an effect as predictive that the cutoff has already absorbed?
- Identification and scope: sample period, era dependence, regime dependence, conditioning-on-the-outcome, survivorship in the sources chosen, base rates behind a conditional claim, and any number that has no stated origin.
- Counter-evidence: is the strongest contrary evidence in the sources the report fetched absent, or present and dismissed without a reason?
- Internal consistency: does one section contradict another, and does the what-is-not-claimed section match what the body actually does?
- Overlap: does the report lean on an interaction that double-counts one input across factors, and does it say so?

## 4. A verdict for every load-bearing claim

- `SUPPORTED` - the sources given support it as stated.
- `NARROWED` - something in it is supported, and the supported part is stated here in your own words.
- `NOT_SUPPORTED` - the sources given do not support it, or contradict it; say which.
- `UNASSESSABLE` - it could not be judged from the sources given; say what would settle it.

For each claim also give: the claim quoted, severity (fatal, material, cosmetic), what is wrong, and the evidence that would resolve it. End with two lists: what survives the attack unchanged, and what the review could not reach at all.

## 5. What to return

1. The issue register, claim by claim, with the verdicts of section 4.
2. The two closing lists: what survives, and what this review could not reach.
3. A short note of the sources you re-fetched and those you could not, and the questions you could not resolve.
4. Upload it against `USD-BASELINE-AUDIT-01` in the Research Library, beside the report it attacks. An upload records evidence; it is not an approval, and it moves no factor's status.

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

## 7. What this review is not

- Not the card review of step 3: no card exists yet, and nothing here approves a hypothesis.
- Not a rewrite of the report: the synthesiser revises it, and every issue you raised must be answered or left visibly open.
- Not a place to impose the card rule: At most two programmable hypotheses per returned card. That limit is a card rule: it applies to the individual research card in step 3, and it does not apply to the discovery phase, where a report may state, compare and rank as many candidate relations as its sources support. A report of twenty sourced candidate relations is a better report than one with two, and the attack is on whether each of them is supported.
- Not a decision on the label instrument, the missing-quote policy, the flat band or the tie rule: those are open, and this brief freezes none of them.
- Not a live change of any kind: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by it.

--- end programme brief ---

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The factor entries this topic is evidence for

These entries are context to audit. They are not evidence for any claim, and they are not the scope limit of this assignment.

- **live.f1-vix-level** - F1 VIX level and risk regime. Role: regime context. Group: live_engine.
  - The question this entry stands for: VIX level is read as the risk regime the dollar is trading in. The rulebook also describes 1d and 5d modifiers; the deployed code does not implement them.
  - Rule in force today, as context to audit and never as evidence: VIX above 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH; level only; the documented 1d/5d modifier is not implemented.
  - Threshold: 25 / 16; lookback: level.
  - Series the collector reads: FRED VIXCLS, read by the collector and stored as vix_level.
- **risk.vix-level-and-change-at-cutoff** - VIX level and change at the cutoff. Role: regime. Group: research_session_v1.
  - The question this entry stands for: VIX level and its change, read as risk regime rather than as a standalone direction, with the documented-but-unimplemented 1d and 5d modifiers examined.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED VIXCLS; Price and risk package USD-SESSION-A1.

## Companion files in the repository

Files in the checkout behind this topic, if you can reach them. They are aids, not attachments you must have.

- `docs/research/handoff/usd/v1/deep-research/CONTEXT_PACK_NEUTRAL.md` (the neutral context pack the brief asks the reader to work from) - sha256 `7e92e4e568df0b84cde906ab4db0ce6135348c99ec871ef8f7b6e48ee8471b00`

## What to return

- Required content: The issue register, the two closing lists (what survives unchanged, what the review could not reach), the sources you re-fetched and the questions you could not resolve.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed topic: usd-topic-vix-level-and-risk-regime
Reviewed document: <document id shown on the stage card you downloaded>
Reviewed version: <version>
Reviewed sha256: <sha256 shown on that card>
```
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

The adjudication (stage 3) reads the report and this review together and decides every material objection. Nothing here approves a hypothesis, scores a factor or changes a live call: an upload records evidence and moves no status.
