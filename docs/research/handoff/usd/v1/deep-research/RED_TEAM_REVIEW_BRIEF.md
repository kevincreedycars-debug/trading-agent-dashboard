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
