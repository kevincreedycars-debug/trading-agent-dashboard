# USD asset-level final analysis - stage 1 of 3: Final analysis

- Asset-level final chain `usd-final-asset-analysis` on asset USD; stage `final_analysis`; this stage returns exactly one Markdown document (synthesis).
- This is the asset-level synthesis chain: it reads every factor-chain adjudication and is not itself a factor result. It opens only through the gate, never because a prompt was copied.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- This stage opens only when every factor chain has delivered research, red team and adjudication against its current parent versions. Read the adjudications of all of them; do not substitute an earlier research report for an adjudication.

## What this stage is for

Read every factor-chain adjudication for the asset and produce the best-supported asset-level conclusion. The adjudications are the evidence; this stage synthesises them, resolves what conflicts between factor chains, and states plainly what the whole body of work does and does not support.

## Which documents you are reading

- Read the adjudication of each of these chains, at the exact version and sha256 shown on its stage card:

- `usd-factor-live-f1-vix-level`
- `usd-factor-risk-vix-level-and-change-at-cutoff`
- `usd-factor-live-f2-us-2y-delta`
- `usd-factor-live-f3-us-de-2y-spread-delta`
- `usd-factor-live-f4-real-yield-delta`
- `usd-factor-rates-us-front-end-delta`
- `usd-factor-rates-relative-front-end-delta`
- `usd-factor-rates-real-yield-delta`
- `usd-factor-rates-term-premium-and-curve`
- `usd-factor-rates-credit-spread-delta`
- `usd-factor-live-f5-dxy-delta`
- `usd-factor-live-f6-gold-delta`
- `usd-factor-live-f9-dollar-smile`
- `usd-factor-live-f10-equity-versus-usd`
- `usd-factor-live-f7-economic-surprise`
- `usd-factor-live-f8-fed-bias`
- `usd-factor-macro-release-surprise-at-first-print`
- `usd-factor-fx-usd-session-momentum`
- `usd-factor-fx-usd-overnight-range-position`
- `usd-factor-fx-usd-session-volatility-regime`
- `usd-factor-risk-usd-safe-haven-demand`
- `usd-factor-risk-risk-on-off-cross-asset-state`
- `usd-factor-calendar-known-releases-between-cutoff-and-endpoint`
- `usd-factor-calendar-days-since-and-until-high-impact-events`
- `usd-factor-data-quality-gate-for-abstention`

- If a chain has no adjudication, say so and stop: this stage is gated on all of them existing.

## How to decide

- A relation that survived its own adjudication is carried forward at the strength that adjudication supports, not at the strength its research claimed.
- Where two chains conflict, say which evidence decides and why, or record the conflict as unresolved.
- Do not average adjudications, and do not treat cross-chain agreement as independent confirmation when the chains share an input.
- A relation that was rejected or left unresolved in adjudication stays rejected or unresolved here.

## What the synthesis must contain

1. **Asset-level conclusion** - what the evidence supports about the direction of the dollar over the session, stated plainly.
2. **What survives** - the relations carried forward from adjudication, each with the strength its adjudication supports.
3. **Conflicts between chains** - each conflict, the evidence that decides it, and what remains unresolved.
4. **Proposed asset-level treatment** - only where the evidence supports it: inputs, transformations, signs, thresholds, lookbacks and timing. Where it does not, say that instead.
5. **Explicitly unvalidated parameters** - every number or choice proposed that has not been measured, named as unvalidated.
6. **Required empirical tests and remaining blockers** - what would have to be measured, on what sample and window, with what data, and what is missing or behind a paywall.
7. **What is not claimed** - a plain section listing what this synthesis does not establish.

## The line this stage must not cross

This is accepted research, not a validated trading rule. It proposes; it does not implement, score, deploy or change a live call, and it asserts no performance figure it has not measured.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window**: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps the corrected session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.

## The asset-level synthesis this chain produces

This chain reads every factor chain adjudication for the asset. It is the synthesis layer, not a fourth factor review.


## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/inventory.md` (the input and decision inventory the synthesis closes out) - sha256 `a886f1ddcce52d4d8a0af77069b391deb1338275380cccd2e08d41fd61f2d56a`

## What to return

- Required content: The asset-level conclusion; which factor-chain findings survive; how conflicts between factor chains are resolved; the proposed asset-level treatment; explicitly unvalidated parameters; required empirical tests; and an explicit what-is-not-claimed section.
- Return one Markdown document. At the top, before the body, list every factor-chain adjudication you read with its document id, version and sha256 as shown on its stage card, so the gate can be audited from the return alone.

```
Synthesis chain: usd-final-asset-analysis
Adjudication read: <factor id> - <document id> - version <version> - sha256 <sha256>
Adjudication read: <factor id> - <document id> - version <version> - sha256 <sha256>
```
- Keep it in one file. Tables, sources, hypotheses, candidate relations and appendices all belong inside that document; nothing here needs a second file, a JSON payload or a hand-built schema.
- The dashboard records the chain, the stage and the exact input package this document judged, so that metadata is not yours to assemble: download the package, choose the file, upload it.

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

The final red-team judges this synthesis and the evidence behind it. Only after the final adjudication decides those findings can an isolated implementation and validation step follow, and nothing enters the live engine because a document exists.
