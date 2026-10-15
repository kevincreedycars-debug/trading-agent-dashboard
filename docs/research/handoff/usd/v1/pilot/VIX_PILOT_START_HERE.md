# USD research pilot 1 - the VIX baseline audit as one package

Generated 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`. Pilot package 1.0.0, context version usd-session-context-20261014.1, pack version 2.0.0, card schema usd-session-research-card-v3.

This package is one brief, not the programme: the VIX factor `live.f1-vix-level` (task `USD-BASELINE-AUDIT-01`), the output template that shows the shape of a return, and the complete card schema. The three are packed together because the brief lists the card's field names while the schema states the JSON structure those names live in - which block is required, which fields are objects, what those objects must contain, which values are allowed and where a list or a string has a minimum length. A return assembled from the field list alone is not a valid card.

## What is inside

- `f1-vix-level.md` - the brief, byte-identical to the bundle's own `packs/f1-vix-level.md`. It carries the session, the deployed baseline for this factor, the research prompt, the prohibitions and the output instructions.
- `RESEARCH_OUTPUT_TEMPLATE.md` - the same field list in the order the card must carry it, with the placeholders a return replaces.
- `research_card.schema.json` (usd-session-research-card-v3) - the structure a returned card is validated against, extending `docs/research/usd-session/v1/research-card.schema.json`.
- `VIX_PILOT_START_HERE.md` - this note.

## How the pilot runs

1. Read `f1-vix-level.md` first; it is the brief and it is self-contained for everything except the structure of the return.
2. Open the schema before writing: every field of the card is listed in the brief, but the required blocks (`session_horizon`, `calendar_and_quote_handling`, `observable_by_cutoff`, `historical_data_requirements`, `live_data_requirements`, `missing_or_stale_handling`, `dependencies_and_overlap`, `evidence`, `limitations`, `open_questions`) carry their own required keys, and the enums are closed.
3. Paste the brief into your own model session. Nothing in this repository calls a model API, and no brief authorises a workflow, feed, dashboard or configuration change.
4. Return one JSON document for the factor, following the schema, plus the short note the brief asks for: every source you actually fetched, with its link and the passage you relied on, and the questions you could not resolve. Upload it against `USD-BASELINE-AUDIT-01` in the Research Library. An upload records evidence; it is not an approval.

## What this pilot is and is not

- It is a **baseline audit**: the VIX factor is one of the ten the deployed node computes today (USD Layer 1 Agent, workflow OCt1tB9yVMUgFTha: executing version v155 (version id 0fb553c2-b1f1-4afa-bfdc-1166b60a6a79, versionCounter 155, published 2026-10-12T19:52:13.451Z by the supervised live apply of the null-conversion guard, nodes_sha256 b2583215ca256a96dd0d7693635a66681fff42595805cdb254d48ae52960b974); the audited baseline is the repository export exports/usd_layer1_agent.json, measured against v154 on 2026-10-11 (scoped export 2026-10-11T18:59:54.307Z), whose Calculate USD Conviction jsCode sha256 is 580f0aa34bc1dd5d210e0dc3391dd653414ac1f68fbc0594133dc597a29254d4, the same bytes the executing version runs), so the question is whether the deployed sign, weight, threshold and lookback are justified, and the deployed values are the object of the audit rather than evidence for the claim.
- It is not a review, a backtest or a rule. A returned card is evidence; it becomes a rule only after a review accepts it and a backtest supports it.
- It asserts nothing about this factor's behaviour: no accuracy, no sample size and no performance number exists for it here, and none may be invented.
- No live deployment, workflow, dashboard, feed or database change was made or is authorised by this bundle.
- No backtest was run for any factor here and no performance figure is asserted anywhere in it.
- A pack is an assignment, a passing schema check is not a review, and a reviewed hypothesis is not a tested one.

## The prohibitions the brief carries

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

## Answers to anticipate

- A return that says part of the mechanism cannot be tested on this horizon with the data that is reachable is a valid return; the brief asks for it to be stated plainly rather than substituted.
- Every parameter you propose must carry the values you allow, a default and the rule for choosing it on training sessions only, declared before validation.

The whole bundle, all 25 briefs, is one level up: `START_HERE.md` describes it.
