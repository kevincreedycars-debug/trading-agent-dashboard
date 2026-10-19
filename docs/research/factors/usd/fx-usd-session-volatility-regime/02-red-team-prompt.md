# USD session volatility regime - fx.usd-session-volatility-regime - stage 2 of 3: Red-team

- Factor chain `usd-factor-fx-usd-session-volatility-regime` for factor `fx.usd-session-volatility-regime` on asset USD; group label `usd-topic-fx-session-structure` (Session structure, overnight range and safe-haven demand); stage `red_team`; this stage returns exactly one Markdown document (review).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `fx.usd-session-volatility-regime` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Reviewed document: the research return registered against factor chain `usd-factor-fx-usd-session-volatility-regime`, stage `research`. The stage 1 card shows its document id, its version and its sha256: attach exactly that version.

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

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window**: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps the corrected session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.

## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **fx.usd-session-volatility-regime** - USD session volatility regime. Role: abstention gate. Group: research_session_v1.
  - The question this entry stands for: Realised volatility of the label instrument and the effect of that regime on the expected move and on whether a call should be withheld.
  - Rule in force today, as context to audit and never as evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/session_contract_v1.json` (the session contract the cutoff and endpoint come from) - sha256 `aa7c6c191e6407935b6335e941a1a66de8979f828a23e22a1f6d249b086a2757`

## What to return

- Required content: The issue register, the two closing lists (what survives unchanged, what the review could not reach), the sources you re-fetched and the questions you could not resolve.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-fx-usd-session-volatility-regime
Reviewed factor: fx.usd-session-volatility-regime
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
No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, and none may be proposed as part of the deliverable.

## What happens after you return it

The adjudication (stage 3) reads the report and this review together and decides every material objection. Nothing here approves a hypothesis, scores a factor or changes a live call: an upload records evidence and moves no status.
