# F1 VIX level and risk regime - live.f1-vix-level - stage 2 of 3: Red-team

- Factor chain `usd-factor-live-f1-vix-level` for factor `live.f1-vix-level` on asset USD; group label `usd-topic-vix-level-and-risk-regime` (VIX, its change and the USD risk regime at the 05:00 London cutoff); stage `red_team`; this stage returns exactly one Markdown document (review).
- The chain belongs to one factor entry, so the evidence this stage returns maps to `live.f1-vix-level` and is not counted as a second independent result elsewhere.
- Paste this whole prompt as one message into your own fresh session. Nothing is sent to a model from the dashboard, and this page holds no model credentials.
- Prompt template `research-prompt-v3.2.0`; `data/research-library/catalog.json` carries this file's sha256, and both the dashboard copy and the dispatcher verify it.
- Governing research contract: USD North Star v2.0, `docs/research-library/USD_North_Star_Model_Contract_v2.md`, sha256 `e39e13098829fd2f61e53a8430277bcbf04ba103b8ef9f93b914847c19e8369f`. Read the supplied contract when available; its substantive requirements are repeated below so this prompt remains self-contained. Report a missing or mismatched copy, do not invent having read or verified it.
- Earlier briefs and implementation notes remain historical evidence. Apply the v2 contract to this assignment without rewriting their history, changing live behaviour or treating a later requirement as something an earlier author already met.
- Reviewed document: the research return registered against factor chain `usd-factor-live-f1-vix-level`, stage `research`. The stage 1 card shows its document id, its version and its sha256: attach exactly that version.

## Responsibility of this stage

Independently re-fetch primary sources for load-bearing claims and search for omitted or contradictory primary evidence beyond the report bibliography. Test alternative explanations, causal identification, pre-cutoff availability, revisions, instrument/horizon mismatch, regime selection and multiple testing across transformations, signs, horizons and related chains. Record the search and sources actually reached, including unsuccessful searches; inherited quotations are not independently verified evidence. Propose decisive tests rather than running new backtests.



Return a coverage checklist inside the same Markdown document: each required section and factor question addressed, partial, not applicable with reason, or blocked with missing evidence. A truncated or missing required section is not a complete return. Source-access gaps must remain visible; a fully reported negative finding is a valid result.

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

1. Is the informative quantity the VIX level at the last US close, its one-day change or its five-day change, and does the deployed 25/16 pair add anything a continuous level does not?
2. How stale is the VIXCLS observation at the 05:00 London cutoff, and what does that staleness do to a claim that the level is a cutoff-time regime read?
3. Is the mechanism safe-haven demand, risk appetite, carry or policy expectations, and which observable at the cutoff separates them from a common hidden driver?
4. Does the VIX level still carry information once the cross-asset risk state, gold and the credit spread are in the model, or is it the same risk factor counted twice?
5. Do inflation-driven equity stress and a liquidity/funding crisis imply different USD signs for the same VIX level, and which pre-cutoff observations identify the distinction around CPI and FOMC sessions?
6. Which of these two chains is measuring something the other does not, and which is the same VIX variable counted twice?

## The programme brief this stage follows

The deep-research tier wrote a step-2 brief for the dispatched research. It stays at `docs/research/handoff/usd/v1/deep-research/RED_TEAM_REVIEW_BRIEF.md`, sha256 `69c76511b16bab61ebcbd01e987fd5fefec72cfcdc2764e131ad10aee3fe2670`, as the record of what was asked, and it is not reproduced here: it was written for a four-step programme with research cards, and this chain uses three stages. This prompt is the red-team instruction for this stage, and the report is attacked against the claims it actually makes.

## The session this is written for

- **Session**: 05:00 Europe/London to 05:00 Europe/London on the following local calendar date. Resolve each endpoint separately using the IANA zone `Europe/London`, record both UTC timestamps and offsets, and derive elapsed hours from those endpoints. Never implement the endpoint as a fixed UTC offset or by adding 24 elapsed hours. References below to a 24-hour or London-to-London session are shorthand for this local-date contract, not a fixed-duration rule. The North Star v2.0 contract pinned above governs this research; `docs/research/usd-session/v1/session_contract_v1.json` describes the earlier study.
- **Starts and ends**: the earlier study and `backtester/lib/usd_session_engine_interface.js` use Monday-to-Friday starts. That eligibility rule is provisional for this v2 research, not a universal requirement supplied by North Star v2.0. Declare and freeze eligible starts, holidays and quote handling before evaluation; do not silently broaden or narrow the sample. A Friday start ends on Saturday at 05:00 London, never Monday. Resolve DST even when the selected weekday sample contains no transition. When either endpoint quote is missing, retain the scheduled endpoints and report a data exclusion with coverage loss, never fill from a Friday close, Monday open, interpolation or later revision. Distinguish those unscorable observations from model abstentions on evaluable sessions, which remain in coverage and no-call reporting.
- **Label instrument**: proposed as DXY and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. Never present another instrument as DXY: if a source is about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence, and say whether its window is a close-to-close day, an intraday slice or something else.
- **The deployed engine is not this window, and its timing is read from the code that defines it, never from memory or from a document**: the stored live calls were attached to the window resolved by the repository's own Phase 1 contract - a 09:30 America/New_York open on the call date to the 16:00 America/New_York close of the next date that has a value, sliding up to three days when the scheduled close has none (`getPhase1OutcomeWindow` in `backtester/lib/timeframe_windows.js`, applied in `backtester/lib/usd24h/outcomes.js`, whose own note calls it a nominal 24-hour horizon rather than 24 elapsed hours and which records `measured_elapsed_hours` per row). The "median 30.5 elapsed hours" figure is a measurement on the closed study's own 583 evaluable rows, recorded under `contract_vs_deployed_engine` in `docs/research/usd-session/v1/session_contract_v1.json`: it is a property of that study, not a declared property of the live engine, and it must be attributed that way every time it is quoted. The same block measures the overlap of that study's interval with this session as 14.5 hours on 528 rows and 15.5 hours on 55 rows - the two weeks a year when New York has changed and London has not - and the session's first 9.5 hours (8.5 in those weeks) as uncovered. Those figures are measured and date-dependent: they are not to be derived by subtracting a fixed London-to-New-York offset, and any comparison of a London-anchored window with a New-York-anchored one must be resolved per date from declared transitions. The archive's "next valid trading session" means the next date with an available value, not a holiday-aware exchange calendar, and the engine does not model market holidays. If the code and a document disagree about the live engine's timing, the code is the authority; report the disagreement rather than repeating the document.

## North Star evidence and evaluation requirements

- **Source standard**: use primary publications, official series methodology, original research and release records for load-bearing claims; trace secondary summaries to originals where reachable. Record source title, publisher, URL, publication/version date, access date, relevant passage or pinpoint reference, instrument, sample and horizon. Separate what you fetched from inherited citations. Give the strongest supporting and opposing evidence and explain conflicts by identification, definitions, timing, sample or regime; inaccessible evidence remains unverified.
- **Point-in-time ledger**: for every proposed input distinguish observation/reference time, scheduled and actual release time, first publicly obtainable time, vendor dissemination time, local ingestion time and vintage/revision time. An observation date is not an availability timestamp; ingestion is not proof of earliest public availability. Only data published and obtainable by the cutoff qualify, and an operational replay must also respect when the system actually possessed them. Record time zones, source evidence, missing timestamps, staleness, consensus as-of time and first-print versus later-vintage values; never substitute revised history for the original snapshot.
- **Conditional regimes**: consider inflation, growth, labour, monetary-policy expectations, relative international policy, liquidity/funding stress, risk appetite and crisis regimes. For this factor, identify the material channels and cutoff-observable regime definitions, sign changes, already-priced effects and falsifiers; mark other regimes not applicable with a reason or unsupported, without inventing a new factor. Do not define a predictive regime using its subsequent outcome.
- **Economic events**: explicitly assess relevance of CPI, PCE, NFP, FOMC, GDP, retail sales, ISM and ECB decisions, plus other material releases supported by sources. Give proportionate detail: direct macro/calendar factors need release-level treatment; other factors need the relevant event-conditioned channel or a reason for no direct relation. Distinguish the pre-cutoff calendar, consensus, prior and revisions already known from actual/realised surprise and revisions released later; cover expected versus realised surprise, release timing, positioning and conditional policy/risk effects. Future actuals never enter the original cutoff forecast. Unscheduled shocks are a separate uncertainty class, not a claim that all shocks can be predicted.
- **Immutable forecasts and separate cohorts**: a proposed forecast record preserves issue time, target end time, input snapshot/version, model and prompt versions, evidence, direction or abstention and confidence. The original 05:00 call is immutable. Alternative horizons and post-release shadow reforecasts need separate issue/expiry times, snapshots and scored cohorts; never overwrite original calls, pool their outcomes or retroactively improve reported performance.
- **Event infrastructure boundary**: where this factor needs event data or a reassessment, inventory and reuse existing n8n/API collection from authorised inputs. Verify the event-to-snapshot-to-model chain in code before claiming automatic reruns or a manual-only limitation; otherwise mark that status unverified. A shadow proposal must address selective event eligibility, complete source data, consensus/revision integrity, as-of timestamps, deduplication/idempotency, cooldowns, rate limits, market hours, stale-input rejection and fail-closed handling. These are design requirements, not instructions to build a duplicate calendar, trigger a workflow or change trades.
- **Downstream tests**: propose falsifiable tests with frozen instrument/source, session eligibility, label/flat-band and missing-quote/abstention rules; time-ordered walk-forward and out-of-sample splits, an untouched holdout, simple baselines, overlap-aware ablations, uncertainty and a multiple-testing plan. Record previously exposed periods and candidate variants so a reused holdout is never called unseen. Parameters and regime definitions must be chosen on development data only. Do not run new experiments in these research stages or claim an unmeasured gain.
- **Separate outcomes**: distinguish directional accuracy, coverage, abstention, skipped-correct sessions and confidence calibration where applicable from downstream L2L performance under its own declared execution/outcome contract, costs and risk assumptions. Do not infer either outcome from the other. Compare abstention to always calling and to coverage-matched baselines; report data exclusions separately. Backtesting and portfolio-wide consistency remain downstream: independent Layer 1 agents must not read other agents' calls or shared conclusions to manufacture agreement.


## The factor entry this chain is evidence for

This entry is context to audit. It is not evidence for any claim, and it is not the scope limit of this assignment.

- **live.f1-vix-level** - F1 VIX level and risk regime. Role: regime context. Group: live_engine.
  - The question this entry stands for: VIX level is read as the risk regime the dollar is trading in. The rulebook also describes 1d and 5d modifiers; the deployed code does not implement them.
  - Rule in force today, as context to audit and never as evidence: VIX above 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH; level only; the documented 1d/5d modifier is not implemented.
  - Threshold: 25 / 16; lookback: level.
  - Series the collector reads: FRED VIXCLS, read by the collector and stored as vix_level.

## Companion files in the repository

Files in the checkout behind this chain, if you can reach them. They are aids, not attachments you must have.

- `docs/research/handoff/usd/v1/deep-research/CONTEXT_PACK_NEUTRAL.md` (the neutral context pack the brief asks the reader to work from) - sha256 `7e92e4e568df0b84cde906ab4db0ce6135348c99ec871ef8f7b6e48ee8471b00`

## What to return

- Required content: The issue register, the two closing lists (what survives unchanged, what the review could not reach), the sources you re-fetched and the questions you could not resolve.
- Return one Markdown document. Put these identifier lines at the top of the file, before the body, and fill them from the stage card you downloaded:

```
Reviewed chain: usd-factor-live-f1-vix-level
Reviewed factor: live.f1-vix-level
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
Do not invent numeric parameters to complete a specification. Retain a supported candidate value with provenance, or use a named unresolved parameter, the evidence needed to choose it and a fail-closed blocker; mark all unvalidated choices explicitly.
Do not spend paid API credits, purchase data, enable overages or change order execution. A paywall is a reported evidence gap, not permission to buy access. Preserve original reports, prompt lineage, input snapshots and forecasts.
Recommending data the collector should record and a treatment a future engine should apply is required content, not a change being made. No production, workflow, dashboard, feed, dispatcher, database or configuration change is authorised by this prompt, none may be carried out now, and none may be reported as done or as agreed.

## What happens after you return it

The adjudication (stage 3) reads the report and this review together and decides every material objection. Nothing here approves a hypothesis, scores a factor or changes a live call: an upload records evidence and moves no status.
