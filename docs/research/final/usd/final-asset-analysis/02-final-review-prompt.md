# USD asset-level final analysis - stage 2 of 2: Final review

- Asset-level final chain `usd-final-asset-analysis` on asset USD; stage `final_review`; this stage returns exactly one Markdown document (review).
- This is the asset-level synthesis chain: it reads every factor-chain adjudication and is not itself a factor result. It opens only through the gate, never because a prompt was copied.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Attach the asset-level synthesis this stage judges. Its stage card shows the document id, version and sha256; attach those exact versions.

## What this stage is for

Review the asset-level synthesis as an independent reviewer. Your job is to find where it claims more than the factor adjudications support, where conflicts were smoothed over, and where the proposed asset-level treatment rests on an unvalidated parameter. You are not asked to defend or to rewrite it.

## Which version you are judging

- Reproduce the synthesis document id, version and sha256 in the identifier lines at the top of your return.
- If the attachment does not match the card it came from, say so and stop.

## How to review

- Quote every load-bearing sentence you judge, then give a verdict, a severity and the evidence that would settle it.
- Check the synthesis against the adjudications it names: a claim stronger than its source adjudication is an issue.
- Check that unresolved and rejected findings were not silently carried forward as accepted.
- Check that every number in the proposed treatment is either measured or marked unvalidated.
- Say when a claim survives unchanged; a review that finds nothing still has to show what was tested.

## What the review must contain

1. **Issue register** - each issue with the quoted claim, verdict, severity and settling evidence.
2. **What survives unchanged** - the claims you tested and did not overturn.
3. **What the review could not reach** - scope limits, missing evidence and paywalled sources.
4. **Sources you re-fetched** - with the link and the passage you relied on.
5. **Questions you could not resolve** - stated as unresolved rather than guessed.

## The line this stage must not cross

The review is evidence, not an approval. It does not implement, score, deploy or change a live call, and it asserts no performance figure it has not measured.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window**: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps the corrected session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.

## The asset-level synthesis this chain produces

This chain reads every factor chain adjudication for the asset. It is the synthesis layer, not a fourth factor review.


## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/usd-session/v1/inventory.md` (the input and decision inventory the synthesis closes out) - sha256 `undefined`

## What to return

- Required content: The issue register, the two closing lists (what survives unchanged, what the review could not reach), the sources you re-fetched and the questions you could not resolve.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-final-asset-analysis
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

The review is adjudicated like any other stage, and only then can an isolated implementation and validation step follow. Nothing enters the live engine because a document exists.
