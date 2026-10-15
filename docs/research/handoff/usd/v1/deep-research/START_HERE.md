# USD deep research - start here

Generated 2026-10-15 on branch `research/usd-session-20261013` at `d07af11166ea1d39e5f4184e85a993e03bcb7137`. Deep-research tier 1.0.0, context version usd-session-context-20261014.1, pack version 2.0.0, card schema usd-session-research-card-v3.

## The primary deliverable

A comprehensive, source-backed report investigating how VIX - its level, its change and its interactions with the other factors in this system - relates to the subsequent direction of the US dollar over one session: 05:00 Europe/London to 05:00 Europe/London on the next local date.

That report is the primary deliverable of this programme. A returned research card is neither a substitute for it nor its equal: the twenty-five briefs one level up are per-factor assignments whose returns are cards, and a card is the third step below rather than the first.

## The four steps, in this order

**1. Deep research with Astra**

- Owner: one frontier-model session, prepared and run by the owner.
- Deliverable: The report, plus the source note: every source actually fetched, its link, the passage relied on and the questions left unresolved.
- Gate: The report is a literature-and-evidence synthesis. It measures nothing of our own session, and nothing in it is a finding about this system until step 2 and step 4 have run.

**2. Independent red-team review**

- Owner: a reviewer that is not the author's session and did not write the report.
- Deliverable: An issue register: every load-bearing claim quoted, the exact defect named, the evidence that would settle it, and a verdict per claim.
- Gate: Only what survives the attack is carried into the synthesis. A claim that cannot be assessed from the sources given is marked as such rather than repaired by argument.

**3. Revised synthesis and structured research cards**

- Owner: the synthesising session, on the red team's register.
- Deliverable: The revised report with every issue marked folded, contested or open, and one research card per factor the synthesis supports, on the card schema.
- Gate: The limit of at most two programmable hypotheses applies here, to an individual card, and only here; the discovery phase of steps 1 and 2 is not limited to two.

**4. Backtesting under a frozen session and data contract**

- Owner: the backtesting lane, after the design is frozen.
- Deliverable: Candidate results on the frozen design, with coverage, sample size, uncertainty, stability across periods and the event-day split reported.
- Gate: Nothing is scored before the design is frozen, and no weight, sign, threshold or lookback changes because a backtest passed.

## The files in this folder

- `deep-research/VIX_COMPREHENSIVE_REPORT_BRIEF.md` - step 1, the primary deliverable, in full.
- `deep-research/CONTEXT_PACK_NEUTRAL.md` - the factual context a report may assume, with every prior conclusion and proposed hypothesis left out on purpose.
- `deep-research/RED_TEAM_REVIEW_BRIEF.md` - step 2: attack the report claim by claim before anything is synthesised.
- `deep-research/SYNTHESIS_AND_CARDS_BRIEF.md` - step 3: the revised synthesis and the structured cards.
- `deep-research/BACKTEST_HANDOFF_BRIEF.md` - step 4: what must be frozen before anything is scored.
- `deep-research/START_HERE.md` - this note.

## What is context and what is a limit

- The rule in force and the data reachable today are context for this programme, not limits on it. The deployed sign, weight, threshold and lookback are the object of an audit; they are never evidence for a claim. A review may use any source it can fetch and cite, whether or not this repository can reproduce it. What is missing blocks one thing only: empirical validation of our exact session. It does not block research into mechanisms, evidence and interactions, and it is never a reason to narrow the question to what this repository happens to hold.
- At most two programmable hypotheses per returned card. That limit is a card rule: it applies to the individual research card in step 3, and it does not apply to the discovery phase, where a report may state, compare and rank as many candidate relations as its sources support.
- The label decision and the frozen evaluation design belong to step 4's owner, not to the report: a report may say what its sources imply for the missing-quote policy, the flat band and the tie rule, and it freezes none of them.

## The session every file here is written for

Start 05:00 Europe/London, end 05:00 Europe/London on the next local date, 24 nominal hours, a start on a Monday-to-Friday local date only. The contract behind that is `docs/research/usd-session/v1/session_contract_v1.json`, horizon `london-0500-to-london-0500-next-day`, corrected 2026-10-14; the context pack states the whole of it, and no file in this folder may describe another window.

## How a return is handled

- The report and its source note upload against `USD-BASELINE-AUDIT-01` for `live.f1-vix-level` in the Research Library, the task that covers the factor. An upload records evidence; it is not an approval.
- The card that came back from pilot 1 is recorded as preliminary, unreviewed and not backtested in the hand-written record beside the frozen package (`pilot/PILOT_1_RETURN_STATUS.md`, in the repository rather than inside this archive), and it is not the completion of that task.
- The library's review assignments for the twenty-five factors are the card-step reviews. The red team of step 2 is a separate, earlier pass over the report and is recorded on its own.

## The prohibitions this tier carries

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

## What is not claimed

- No backtest was run for any factor here and no performance figure is asserted anywhere in it.
- A report is evidence, a review is an opinion on evidence, a card is a hypothesis and a passing backtest is not a deployment.
- Nothing here made or authorised a change to anything that runs: no production, workflow, dashboard, feed, dispatcher, database or configuration change.

## Regenerating it

`node scripts/build_research_handoff.js write` writes this folder with the rest of the bundle, and `check` fails if a file here is stale, if the context pack stops matching `docs/research/usd-session/v1/session_contract_v1.json`, or if the catalogue and the briefs stop agreeing.
