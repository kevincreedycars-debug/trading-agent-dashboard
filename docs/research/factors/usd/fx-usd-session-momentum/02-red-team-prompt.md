# USD session momentum - fx.usd-session-momentum - stage 2 of 3: Red-team

- Factor chain `usd-factor-fx-usd-session-momentum` for factor `fx.usd-session-momentum` on asset USD; group label `usd-topic-fx-session-structure` (Session structure, overnight range and safe-haven demand); stage `red_team`; this stage returns exactly one Markdown document (review).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `fx.usd-session-momentum` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.1.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- Reviewed document: the research return registered against factor chain `usd-factor-fx-usd-session-momentum`, stage `research`. The stage 1 card shows its document id, its version and its sha256: attach exactly that version.

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
- **Mixed evidence**: is a mechanism, a contemporaneous association, another window's measurement or information already in an earlier input being presented as predictive evidence for our session?
- **Already priced**: does the claim count an effect as predictive that the cutoff has already absorbed?
- **Identification and scope**: sample period, era dependence, regime dependence, conditioning on the outcome, survivorship in the sources chosen, base rates behind a conditional claim, and any number with no stated origin.
- **Counter-evidence**: is the strongest contrary evidence in the sources the report fetched absent, or present and dismissed without a reason?
- **Internal consistency**: does one section contradict another, and does the what-is-not-claimed section match what the body actually does?
- **Overlap**: does the report lean on an interaction that counts one input twice across factor entries, and does it say so?

## Five kinds of evidence that must not be mixed

Each kind answers a different question, and evidence of one kind never stands in for another. State which kind every load-bearing claim rests on, in the sentence that makes the claim:

- **Economic mechanism** - why an input could move the dollar inside the session at all. A mechanism is a reason to look; it is not a measurement, and a plausible channel is not evidence that the channel operates.
- **Contemporaneous association** - what moves with the dollar at the same time. It says nothing about direction after the cutoff, and the dollar may be the thing doing the moving.
- **Predictive evidence from other windows** - measured relations for a close-to-close day, a New York session, an event window or a monthly horizon. Relevant background, not evidence for this session; name the window every time the number is quoted.
- **Evidence for our exact session** - a measurement of the 05:00 Europe/London start to the 05:00 Europe/London endpoint on the next local date. Where none exists for a claim, say so rather than borrowing another window's result.
- **Incremental value beyond existing inputs** - what this factor adds to a decision already able to use the entries before it. Information already contained in an earlier input is not new, and a factor that adds nothing is a finding, not a gap.

A claim that changes kind between sections - a mechanism presented as a measurement, another window presented as ours, an input already in the decision presented as new - is the most common way a body of research overstates what is known. Where the same evidence is counted twice, say so.

## A verdict for every load-bearing claim

`SUPPORTED` - the sources given support it as stated. `NARROWED` - something in it is supported, and the supported part is stated in your own words. `NOT_SUPPORTED` - the sources given do not support it, or contradict it; say which. `UNASSESSABLE` - it could not be judged from the sources given; say what would settle it.

For each claim also give the claim quoted, its severity (fatal, material, cosmetic), what is wrong, and the evidence that would resolve it. End with two lists: what survives the attack unchanged, and what the review could not reach at all.

## The questions this stage must carry forward

A question does not stop at stage 1. For each question below, say whether the research report answers it, answers it only partly or does not answer it, and give the verdict that follows from the source you checked.

1. Momentum in which instrument, over which lookback, and is a trailing one-day or five-day move in the label instrument observable at 05:00 London when that instrument has no verified intraday source?
2. Is the trailing move measured on the same instrument and quote source as the label, or on a proxy that introduces a basis the signal cannot separate from momentum?
3. Is the mechanism continuation under gradual information diffusion, or mean reversion after a liquidity-driven move, and what measurable condition separates them?
4. Is session momentum distinct from the dollar index delta and the overnight range position, and does it survive the bid-ask bounce of a 24-hour window?
5. Which instrument labels these factors, given that DXY has no verified intraday source?

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Starts and ends**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is never a session; the Saturday start is the only one that can contain a London daylight-saving transition, which is why every eligible session is exactly 24 hours (`backtester/lib/usd_session_engine_interface.js`, `SESSION_CONTRACT`, `session_start_rule`). A Friday session therefore ends at the 05:00 London endpoint on the Saturday. When the endpoint value does not exist, record the session as not evaluable and leave the value missing: never fill it from a Friday close, a Monday open, an interpolation or a later revision, and never quote a number whose window you cannot name.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **fx.usd-session-momentum** - USD session momentum. Role: direction. Group: research_session_v1.
  - The question this entry stands for: Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/session_contract_v1.json` (the session contract the cutoff and endpoint come from) - sha256 `aa7c6c191e6407935b6335e941a1a66de8979f828a23e22a1f6d249b086a2757`

## What to return

- Required content: The issue register, the two closing lists (what survives unchanged, what the review could not reach), the sources you re-fetched and the questions you could not resolve.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-fx-usd-session-momentum
Reviewed factor: fx.usd-session-momentum
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
Recommending data the collector should record and a treatment a future engine should apply is required content, not a change being made. No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, none may be carried out now, and none may be reported as done or as agreed.

## What happens after you return it

The adjudication (stage 3) reads the report and this review together and decides every material objection. Nothing here approves a hypothesis, scores a factor or changes a live call: an upload records evidence and moves no status.
