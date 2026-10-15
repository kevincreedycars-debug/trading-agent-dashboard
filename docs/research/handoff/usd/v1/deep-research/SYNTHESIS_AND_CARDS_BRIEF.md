# Revised synthesis and structured research cards - step 3 brief

- Task: `USD-BASELINE-AUDIT-01`. Step 3 of four of the deep-research tier 1.0.0, context version usd-session-context-20261014.1, card schema usd-session-research-card-v3.
- Inputs: the report of [`deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md`](deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md) and the issue register of [`deep-research/RED_TEAM_REVIEW_BRIEF.md`](deep-research/RED_TEAM_REVIEW_BRIEF.md). Nothing else is synthesised.

## 1. What is asked

Two deliverables, in this order:

1. the revised report, with every issue from the register answered or left visibly open;
2. one structured research card per factor the synthesis supports, on the card schema.

The cards come out of the revised synthesis. A card written before the register is answered is a second draft of the first report, not a result of this step.

## 2. The revised synthesis

- Keep the section order of the report brief and keep the source note with it.
- Mark every issue from the register as `folded` (and say what changed), `contested` (and say what evidence would settle it and why the claim is kept) or `open` (and say plainly that it is unresolved).
- A claim repeated more confidently is not a claim with better evidence. Downgrade what the attack weakened, and delete what it destroyed.
- Say what changed and why, in a short section of its own, so a reader can see the effect of the attack rather than having to reconstruct it.
- What the sources cannot settle stays stated as such through the revision; the session's own measurement gap is stated, not filled.

## 3. The structured cards

- Schema: `docs/research/handoff/usd/v1/research_card.schema.json` (usd-session-research-card-v3), which extends `docs/research/usd-session/v1/research-card.schema.json`. Field list, order and a copyable skeleton: [`RESEARCH_OUTPUT_TEMPLATE.md`](RESEARCH_OUTPUT_TEMPLATE.md). The factor's own assignment is its pack one level up in `packs/`.
- At most two programmable hypotheses per returned card. That limit is a card rule: it applies to the individual research card in step 3, and it does not apply to the discovery phase, where a report may state, compare and rank as many candidate relations as its sources support.
- Every card carries: the session horizon block, the calendar and quote handling, what was observable at the cutoff with each input's staleness, whether the relation is a reaction or a prediction, the mechanism, the direction claim, the session role, the programmable hypotheses with the values each parameter may take, its default and the rule for choosing it on training rows only, the result that would falsify each one, the rejection test, the evidence, the limitations and the open questions.
- Every claim in a card's verdict is traceable to an entry in its evidence, or is labelled as a judgement. An empty required field is not an accepted card.
- Cards are tied to sessions, not to instruments: a card that needs a different window or a different instrument says so instead of borrowing ours.
- A card is evidence. It is not a rule, not an approval and not a change to anything that runs.

## 4. Identity, evidence and registration

- One card per factor id. `card_version` increments, a revision supersedes the earlier card rather than overwriting it, and `supersedes` names it.
- A card's evidence is the revised report and the register behind it: cite the entry, and keep the source note's link with it.
- The preliminary card of pilot 1 - recorded as preliminary, unreviewed and not backtested in `pilot/PILOT_1_RETURN_STATUS.md` - may be read as an input. Where a card contradicts it, say so; never treat it as reviewed, as tested or as the completion of the task.
- Upload the revised synthesis and the cards against `USD-BASELINE-AUDIT-01` in the Research Library. An upload records evidence; it is not an approval, and it moves no factor's status.

## 5. Prohibitions

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

## 6. What this step is not

- Not step 4: no card is scored here, no sample, no coverage and no performance number is produced.
- Not an approval: a review accepts or rejects a card, and this step is not that review.
- Not a decision on the label instrument, the missing-quote policy, the flat band or the tie rule.
- Not a live change of any kind: no production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by it.
