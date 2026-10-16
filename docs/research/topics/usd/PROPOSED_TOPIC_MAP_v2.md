# Proposed USD topic map and stage prompts v2

Date: 2026-10-16  
Owner: workstream C, research programme  
For application by: workstream A  
Baseline: checkpoint `56afd67b`, six generated topics and eighteen hash-checked prompts

This is a review proposal, not a generated artefact. It changes no catalogue, prompt hash, registry row, factor status, rule, score or live system. A returned document is evidence rather than approval; research accepted after adjudication is still a hypothesis for empirical testing, not a validated trading rule.

## 1. Map audit

The current map covers all twenty-five factor entries exactly once, but three boundaries are not clean enough for independent research:

- `usd-topic-front-end-rates` currently combines monetary-policy transmission with credit stress. Credit spreads, safe-haven demand and the cross-asset risk state are a distinct funding/liquidity channel and should be researched together.
- `usd-topic-dollar-index-gold-and-equities` currently combines the dollar's own lagged price with cross-asset carriers. The dollar's own level/change belongs with session momentum, range position and volatility; gold, equities and the Dollar Smile belong in a cross-asset topic.
- `usd-topic-fx-session-structure` currently combines price-state variables with safe-haven state. Separating them makes continuation/mean-reversion evidence distinguishable from risk-off transmission.

The proposed seven-topic map still owns each of the twenty-five entries exactly once: 2 + 7 + 3 + 4 + 3 + 3 + 3 = 25. It adds the missing funding, credit and dollar-liquidity topic without inventing a factor entry or claiming that the available catalogue is exhaustive. Positioning/flows, global relative growth, commodity/energy shocks and non-Fed policy divergence remain mandatory interaction searches inside the relevant prompts; they are not promoted to owner topics until the catalogue has independently specified observables for them.

## 2. Exact proposed `TOPIC_MAP` replacement

Change id: `MAP-ALL`  
Stage: topic map  
Reason: give every factor one coherent owner, make the real overlaps explicit and add the missing funding/credit/liquidity channel.

Replace the current `TOPIC_MAP` array with the following exact text. Existing constants named below remain unchanged.

```js
const TOPIC_MAP = [
  {
    topic_id: 'usd-topic-vix-level-and-risk-regime',
    slug: 'vix-level-and-risk-regime',
    title: 'VIX level, change, term structure and the USD volatility regime',
    summary: 'Whether VIX level, changes, term structure or volatility-of-volatility contain incremental information about the next 24-hour London-to-London USD direction, after separating an already-observed US-close reaction from a subsequent-session prediction.',
    factor_ids: ['live.f1-vix-level', 'risk.vix-level-and-change-at-cutoff'],
    overlaps: ['usd-topic-funding-credit-and-dollar-liquidity', 'usd-topic-dollar-index-gold-and-equities', 'usd-topic-fx-session-structure'],
    dispatch: {
      state: 'dispatched',
      task_id: 'USD-BASELINE-AUDIT-01',
      pack_version: '2.0.0',
      context_version: 'usd-session-context-20261014.1',
      dispatched_at: '2026-10-15'
    },
    dispatched_brief_path: VIX_DISPATCHED_BRIEF,
    programme_red_team_path: `${DEEP_RESEARCH_DIR}/RED_TEAM_REVIEW_BRIEF.md`,
    companion_paths: [
      { repo_path: CONTEXT_PACK_NEUTRAL, role: 'the neutral context pack the brief asks the reader to work from' }
    ],
    pack_factor_ids: ['live.f1-vix-level', 'risk.vix-level-and-change-at-cutoff'],
    probes: [
      'Which quantity is informative after the 05:00 Europe/London cutoff: the VIX level, a one-day or five-day change, futures term structure, volatility risk premium or volatility-of-volatility, and what evidence separates them?',
      'Does any relation survive calm, transition, acute-risk, policy-shock and funding-stress regimes, or is a threshold only an in-sample description?',
      'Which mechanism is supported - safe-haven demand, dealer or funding constraints, carry unwinds, policy repricing or positioning - and what cutoff-observable distinguishes it from the others?',
      'How much of the US-close volatility shock is already reflected in the dollar by 05:00 Europe/London, and what design distinguishes reaction, continuation and reversal over the following session?',
      'What incremental information remains after credit spreads, equities, gold and the dollar\'s own pre-cutoff move are controlled for?'
    ],
    next_step: 'The research report is registered. Run stage 2 (red-team) against research version 1, then stage 3 (adjudication).'
  },
  {
    topic_id: 'usd-topic-front-end-rates',
    slug: 'front-end-rates',
    title: 'US and relative rates, real yields and curve transmission',
    summary: 'Whether US front-end changes, cross-country rate differentials, real yields and curve measures contain incremental information about the next 24-hour USD direction, and whether the information is level, change, policy-path repricing or term structure.',
    factor_ids: ['live.f2-us-2y-delta', 'live.f3-us-de-2y-spread-delta', 'live.f4-real-yield-delta', 'rates.us-front-end-delta', 'rates.relative-front-end-delta', 'rates.real-yield-delta', 'rates.term-premium-and-curve'],
    overlaps: ['usd-topic-economic-surprise-and-fed-bias', 'usd-topic-funding-credit-and-dollar-liquidity', 'usd-topic-calendar-and-data-quality'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/weight_vector_discrepancy.md', role: 'the two live weight vectors and where each is used' }
    ],
    pack_factor_ids: ['live.f2-us-2y-delta', 'live.f3-us-de-2y-spread-delta', 'live.f4-real-yield-delta', 'rates.us-front-end-delta', 'rates.relative-front-end-delta', 'rates.real-yield-delta', 'rates.term-premium-and-curve'],
    probes: [
      'Which entries measure distinct information and which restate the same policy-path move through a different maturity, country or inflation adjustment?',
      'Is the predictive object a yield level, a change, a curve move, a relative-rate change or a rate-futures repricing, and over what measurement interval?',
      'Does a real-yield change add information beyond nominal rates and inflation compensation, after differences in publication timing and construction are respected?',
      'Does the relation change across hiking, easing, zero-lower-bound, inflation-shock and growth-shock regimes?',
      'What was observable by 05:00 Europe/London, and how much had the dollar already incorporated before the forecast window began?'
    ],
    next_step: 'Dispatch next after workstream A applies and verifies this proposal; its causal definitions are dependencies for the macro and funding topics.'
  },
  {
    topic_id: 'usd-topic-funding-credit-and-dollar-liquidity',
    slug: 'funding-credit-and-dollar-liquidity',
    title: 'Funding stress, credit spreads and safe-haven dollar liquidity',
    summary: 'Whether credit stress, funding constraints and cross-asset safe-haven demand identify a dollar-liquidity regime with information about the next 24-hour USD direction beyond VIX and rates.',
    factor_ids: ['rates.credit-spread-delta', 'risk.usd-safe-haven-demand', 'risk.risk-on-off-cross-asset-state'],
    overlaps: ['usd-topic-vix-level-and-risk-regime', 'usd-topic-front-end-rates', 'usd-topic-dollar-index-gold-and-equities'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: CONTEXT_PACK_NEUTRAL, role: 'the current credit, funding and cross-asset inputs and their cutoff staleness' }
    ],
    pack_factor_ids: ['rates.credit-spread-delta', 'risk.usd-safe-haven-demand', 'risk.risk-on-off-cross-asset-state'],
    probes: [
      'Which observable distinguishes generic risk aversion from a specifically dollar-funding shock: credit spreads, cross-currency basis, funding rates, dealer constraints, bank stress or another measure?',
      'When does safe-haven demand strengthen the dollar, and when do US-centred credit or fiscal stresses weaken it?',
      'Do credit and funding measures add information after VIX, rates, equities and gold are controlled for, or do they double-count one stress state?',
      'Are market-close credit series timely enough at the cutoff, and what higher-frequency or publication-timestamped inputs would an honest test need?',
      'How should missing, stale or contradictory stress measures affect direction, confidence or abstention without treating missingness as neutral evidence?'
    ],
    next_step: 'Queue after the rates research and VIX adjudication, because both define the principal confounds this topic must test for incrementality.'
  },
  {
    topic_id: 'usd-topic-dollar-index-gold-and-equities',
    slug: 'dollar-index-gold-and-equities',
    title: 'Gold, equities and the Dollar Smile as cross-asset USD evidence',
    summary: 'Whether gold, equities and the proposed Dollar Smile carry incremental information about the next 24-hour USD direction or restate volatility, rates, funding stress or the dollar\'s own prior move.',
    factor_ids: ['live.f6-gold-delta', 'live.f9-dollar-smile', 'live.f10-equity-versus-usd'],
    overlaps: ['usd-topic-vix-level-and-risk-regime', 'usd-topic-funding-credit-and-dollar-liquidity', 'usd-topic-fx-session-structure'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/target_source_assessment.md', role: 'DXY and intraday source coverage, access and cost' }
    ],
    pack_factor_ids: ['live.f6-gold-delta', 'live.f9-dollar-smile', 'live.f10-equity-versus-usd'],
    probes: [
      'Is the Dollar Smile a measured conditional relation, which state variables define its arms, and what evidence would falsify or narrow it?',
      'Do gold and equity moves add information after VIX, rates, funding stress and the dollar\'s own pre-cutoff move are controlled for?',
      'When do gold and the dollar move together because of real yields, liquidity or reserve demand rather than provide independent directional signals?',
      'Which equity instrument and return window are relevant, and can index, futures and ETF evidence be transferred without changing the claim?',
      'How do commodity, energy and crypto moves challenge or clarify the proposed cross-asset state even though they have no owner factor in this topic?'
    ],
    next_step: 'Queue after VIX adjudication and the funding topic so the report can test incremental cross-asset information rather than redescribe risk-off.'
  },
  {
    topic_id: 'usd-topic-economic-surprise-and-fed-bias',
    slug: 'economic-surprise-and-fed-bias',
    title: 'Economic surprises, first prints and observable Fed repricing',
    summary: 'Whether publication-time economic surprises and observable changes in the expected Fed path contain information about the next 24-hour USD direction beyond the rates move through which they may already have transmitted.',
    factor_ids: ['live.f7-economic-surprise', 'live.f8-fed-bias', 'macro.release-surprise-at-first-print'],
    overlaps: ['usd-topic-front-end-rates', 'usd-topic-calendar-and-data-quality', 'usd-topic-fx-session-structure'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/macro_data_inventory.md', role: 'publication timing, revisions, missingness and live versus historical availability' }
    ],
    pack_factor_ids: ['live.f7-economic-surprise', 'live.f8-fed-bias', 'macro.release-surprise-at-first-print'],
    probes: [
      'Which surprise denominator is defensible - survey consensus, model nowcast, market-implied expectation or standardised historical error - and what does each measure?',
      'Which vintage was observable at release time, how are revisions prevented from leaking into history, and how are changing survey panels handled?',
      'Can Fed bias be replaced by an observable policy-path repricing measure rather than a narrative string, and what independent information remains after rates?',
      'How quickly is a release incorporated into the dollar, and what design separates the immediate reaction from continuation or reversal after the cutoff?',
      'Do growth and inflation surprises have stable signs, or do their effects depend on the policy reaction function, risk regime and source economy?'
    ],
    next_step: 'Queue after rates and calendar/data-quality research, because the report needs their timing, vintage and mediation definitions.'
  },
  {
    topic_id: 'usd-topic-fx-session-structure',
    slug: 'fx-session-structure',
    title: 'USD price state, session momentum, range position and volatility',
    summary: 'Whether the dollar\'s own pre-cutoff change, placement in its range, session momentum and volatility contain continuation or reversal information for the next 24-hour London-to-London session.',
    factor_ids: ['live.f5-dxy-delta', 'fx.usd-session-momentum', 'fx.usd-overnight-range-position', 'fx.usd-session-volatility-regime'],
    overlaps: ['usd-topic-vix-level-and-risk-regime', 'usd-topic-dollar-index-gold-and-equities', 'usd-topic-calendar-and-data-quality'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/session_contract_v1.json', role: 'the session contract the cutoff and endpoint come from' },
      { repo_path: 'docs/research/usd-session/v1/target_source_assessment.md', role: 'the unresolved label instrument and quote-source boundary' }
    ],
    pack_factor_ids: ['live.f5-dxy-delta', 'fx.usd-session-momentum', 'fx.usd-overnight-range-position', 'fx.usd-session-volatility-regime'],
    probes: [
      'Which dollar instrument is each claim about, and can DXY, broad trade-weighted indices, futures and currency pairs support the same directional statement?',
      'Do pre-cutoff returns, range position or volatility predict continuation, reversal or only future dispersion after transaction costs and bid-ask effects?',
      'How sensitive are the features to the 05:00 Europe/London boundary, daylight-saving transitions, holidays and the construction of an overnight range?',
      'Does any price-state feature add information beyond rates, VIX, event state and cross-asset returns, or is it a compressed record of them?',
      'What quote resolution, venue policy and executable endpoint are required to prevent label-feature overlap and non-synchronous-price bias?'
    ],
    next_step: 'Queue last among the directional topics; literature research can proceed, but empirical specification remains blocked until the label instrument and both endpoint quotes are frozen.'
  },
  {
    topic_id: 'usd-topic-calendar-and-data-quality',
    slug: 'calendar-and-data-quality',
    title: 'Event calendar, causal availability and the data-quality gate',
    summary: 'Whether known event state changes expected direction, dispersion or confidence, and how timestamp, vintage, missingness and staleness should gate or abstain across all twenty-five factor entries.',
    factor_ids: ['calendar.known-releases-between-cutoff-and-endpoint', 'calendar.days-since-and-until-high-impact-events', 'data.quality-gate-for-abstention'],
    overlaps: ['usd-topic-economic-surprise-and-fed-bias', 'usd-topic-front-end-rates', 'usd-topic-fx-session-structure'],
    dispatch: { state: 'queued' },
    companion_paths: [
      { repo_path: 'docs/research/usd-session/v1/inventory.md', role: 'the input and decision inventory this topic closes out' },
      { repo_path: 'docs/research/usd-session/v1/macro_data_inventory.md', role: 'the publication, revision and historical-availability audit' }
    ],
    pack_factor_ids: ['calendar.known-releases-between-cutoff-and-endpoint', 'calendar.days-since-and-until-high-impact-events', 'data.quality-gate-for-abstention'],
    probes: [
      'Does a release known to fall inside the forecast session change expected direction, expected dispersion, confidence or only the decision to abstain?',
      'Which event classifications and scheduled timestamps were knowable at the cutoff, and how are postponements, unscheduled events, holidays and daylight-saving transitions represented?',
      'For each input family, what age, vintage and missingness state is acceptable, and why should failure cause exclusion, abstention, shrinkage or an explicit missing indicator rather than a neutral score?',
      'Can a data-quality gate be evaluated without selecting only difficult periods after observing outcomes, and which coverage and utility measures must accompany directional accuracy?',
      'Which data failures are likely informative about market stress or vendor operations, and how will the design prevent that missingness from leaking the target?'
    ],
    next_step: 'Queue immediately after rates and before macro-surprise research; its causal timing and vintage rules are dependencies for every later empirical handoff.'
  }
];
```

### One-line reasons by topic

- `usd-topic-vix-level-and-risk-regime` / map: names term structure and the reaction-versus-prediction problem and exposes its credit, cross-asset and price-state overlaps.
- `usd-topic-front-end-rates` / map: removes credit stress and makes nominal, real, relative and curve measures one monetary-policy transmission family.
- `usd-topic-funding-credit-and-dollar-liquidity` / map: adds the missing funding/credit topic and owns the three stress-state entries that otherwise span unlike topics.
- `usd-topic-dollar-index-gold-and-equities` / map: becomes the cross-asset topic and no longer owns the dollar's own lagged return.
- `usd-topic-economic-surprise-and-fed-bias` / map: makes rates mediation, observable policy repricing and causal vintages explicit.
- `usd-topic-fx-session-structure` / map: owns the dollar's own price-state variables, including `live.f5-dxy-delta`, and no longer mixes them with safe-haven state.
- `usd-topic-calendar-and-data-quality` / map: treats event state, causal availability and missingness as cross-cutting design inputs, not just collector housekeeping.

## 3. Exact proposed research-stage wording

Change id: `PROMPT-RESEARCH-COMMON`  
Topic id: all seven topics  
Stage: `research`  
Reason: make a fresh-chat prompt require measurement, mechanism, regimes, interactions, timing, predictive evidence, contradictions, falsifiable hypotheses and reproducible data requirements, while treating current thresholds only as audit context.

In `researchPrompt(topic)`, replace the text from `## What this stage is for` through the paragraph immediately below `## Existing thresholds are context, not the scope limit` with the following exact wording; retain the generated frontmatter, topic probes, dispatched-brief inclusion, session section, full factor context, companion block, return block and prohibitions after it.

```md
## What this stage is for

Produce one comprehensive, source-backed research report on whether and how the inputs owned by this topic contain information about the direction of the US dollar over the next session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Investigate levels, changes, transformations, regimes and interactions. Separate a plausible mechanism, an observed contemporaneous relation and genuine out-of-sample predictive evidence; none is a substitute for another.

This is a fresh-chat assignment. Everything required to understand the question is in this prompt. Repository excerpts and current rules below are factual context to audit, not conclusions to preserve and not a limit on the evidence, variables, transformations or interactions you may investigate. The exact session is not yet measurable because its label instrument and quote source are unverified; that blocks a claim of validation on our session, but it does not block literature research, mechanism analysis, contradictory evidence, candidate hypotheses or a precise data plan.

## Required method

1. Search broadly enough to find primary definitions, serious empirical work and credible contradictory findings. Prefer the index provider, exchange, central bank, statistical agency, original dataset documentation and original paper. Use secondary sources only when they add analysis or the primary source is unreachable, and label that limitation.
2. For every material empirical claim, name the actual instrument, market, sampling frequency, predictor measurement interval, outcome window, sample period, publication or revision convention and conditioning variables. Do not transfer a result from EUR/USD, another dollar index, futures, an ETF or a close-to-close day to this session without marking the transfer as untested.
3. Separate what was observable by the 05:00 Europe/London cutoff from information published, revised or formed later. Distinguish an immediate market reaction already embedded at the cutoff from a prediction of the following session.
4. Report null, unstable and contradictory results with the same care as supportive results. Explain which finding is better identified and why; do not resolve disagreement by vote counting.
5. Do not infer predictive value from mechanism, correlation, narrative fit or a deployed rule. If no study measures the relevant subsequent direction, say so.

## What the report must contain

1. **Definitions and measurement** - define every owned input; its unit, source family, level/change/shape alternatives, release or market timestamp, revision process, feasible cutoff value and known proxies. State where two entries are alternative measurements of the same latent state.
2. **Mechanisms and observable implications** - give each supported causal or behavioural channel, the sign it could imply, the condition under which the sign changes, and the cutoff-observable that could distinguish it from competing mechanisms.
3. **Regimes and structural change** - examine policy cycles, growth versus inflation shocks, calm versus stress, liquidity and funding conditions, event versus quiet sessions, crisis periods and relevant market-structure changes. Do not assume a threshold is stable across them.
4. **Timing and information set** - map the sequence from source observation or publication through 05:00 Europe/London and the forecast endpoint. Identify stale closes, asynchronous markets, revisions, look-ahead risks, embargoes and data that arrive inside the session.
5. **Predictive evidence** - summarise evidence that actually relates a cutoff-known predictor to a subsequent direction or return. For each result give the sample, era, instrument, window, method, comparator or base rate, uncertainty where reported, and whether it is in-sample, out-of-sample or merely contemporaneous.
6. **Contradictory and null evidence** - present the strongest findings against each material proposed relation, including sign reversals, weak identification, publication-period dependence and evidence that an apparent predictor is absorbed by another variable.
7. **Interactions and overlap** - test the named topic overlaps and search for positioning/flows, global relative growth, commodity/energy, non-Fed policy and liquidity interactions when economically relevant. For every proposed interaction state the mechanism, timing, expected form, incremental question and double-counting risk.
8. **Existing rule audit** - describe what the current thresholds, signs, weights and lookbacks assume. Look for evidence for and against them, but do not organise the research around defending them. Treat every numeric choice as unvalidated unless a cited study or measurement supports that exact choice on a transferable instrument and window.
9. **Candidate hypotheses** - provide as many evidence-supported candidates as discovery warrants. For each give a falsifiable directional or abstention statement, exact predictor and transformation, cutoff availability, regime or interaction, expected sign, outcome, alternative explanation and result that would refute it. Do not tune a parameter here.
10. **Data and empirical design requirements** - specify series and vendor or primary-source candidates, instrument identity, timestamp and timezone, frequency, point-in-time vintage, history length, corporate or contract adjustments, missing/stale policy, session calendar, joins, transformations, controls and leakage checks. Mark what is available, absent, paywalled or still unverified.
11. **Evidence matrix** - one row per material claim with claim id, claim, source, source type, instrument, predictor window, outcome window, sample/era, result, identification limits, transferability to our session and status: supportive, contradictory, null or unresolved.
12. **Conclusions with confidence** - state what is well supported, conditionally supported, unsupported and unknown. Keep literature confidence separate from confidence that the relation will work in this programme.
13. **What is not claimed** - state explicitly that the report is evidence, not approval; it does not validate a trading rule, establish performance, choose the label instrument, freeze a parameter or authorise implementation.

## Questions for this topic

<insert the topic's generated numbered probes here>

## Existing thresholds are context, not the scope limit

The factor context below records what the engine or research catalogue currently names. Audit it. A deployed sign, weight, threshold, lookback, neutral treatment or data source is neither prior evidence nor a required endpoint. Follow the best evidence to different variables or formulations when warranted, and label every proposed numeric value that has not been measured on the frozen programme design as unvalidated.
```

Validation note: this exact block strengthens the corresponding generated `01-research-prompt.md` block for every topic. The current prompt already has the nine requested themes, but it lacks a claim-level evidence matrix, explicit null-evidence search, transferability fields, alternative explanations and a point-in-time design checklist.

## 4. Exact proposed red-team-stage wording

Change id: `PROMPT-RED-TEAM-COMMON`  
Topic id: all seven topics  
Stage: `red_team`  
Reason: require independent source verification and an independent contradictory-evidence search without rewarding performative disagreement.

In `redTeamPrompt(topic)`, replace the text from `## What this stage is for` through the paragraph ending `what the review could not reach at all` with this exact wording; retain version binding, the optional programme brief, session section, factor context, companion block, return block and prohibitions.

```md
## What this stage is for

Independently test every material claim in the registered research report before adjudication. Verify claims and sources, search for evidence the report missed, and identify reasoning, identification and timing failures. Preserve claims that survive. Narrow claims whose evidence supports only a smaller statement. Reject claims that fail. Leave unassessable claims unresolved. Do not manufacture disagreement, reward novelty or treat the number of objections as a measure of review quality.

## Which version you are attacking

- Attach the exact registered research document named by the stage card and reproduce its document id, version and sha256 at the top of the return.
- Hash mismatch means stop and report the mismatch; do not review a nearby draft.
- Work independently of the author. Do not ask what the author meant and do not use the report's source summaries as a substitute for opening sources yourself.

## Required independent verification

1. Build a claim inventory before judging it. Include every conclusion, mechanism used to justify a conclusion, empirical number, directional sign, regime condition, interaction, threshold, timing assertion and data-availability assertion that affects the report's result.
2. Re-fetch every material cited source that is reachable. Confirm document identity, authorship, date, version, table or passage, instrument, sample, predictor window, outcome window and whether the cited text supports the claim as stated. Record sources that are unavailable, paywalled, superseded or only available through a quotation.
3. Independently search for primary or original empirical evidence that supports, contradicts, narrows or nullifies each load-bearing claim. Search beyond the report's bibliography. A good-faith search that finds no credible contrary result is itself reportable; inventing an opposing position is not.
4. Check causal availability at 05:00 Europe/London. Flag revised data used as first prints, later publications used at an earlier cutoff, non-synchronous closes, endpoint overlap, target leakage, lookback windows that cross the forecast outcome and claims that count a pre-cutoff reaction as subsequent prediction.
5. Check transferability. Flag evidence about another dollar index, currency pair, future, ETF, geography, frequency, era or horizon when the report carries it into this programme without a justified bridge.
6. Check reasoning. Flag mechanism presented as measurement, correlation presented as prediction, conditioning on realised outcomes, selected regimes, omitted base rates, multiple-testing freedom, post hoc thresholds, double-counted inputs, endogenous controls and narrative labels without reproducible observables.

## Verdicts and issue register

Use exactly one verdict per claim: `SUPPORTED`, `NARROWED`, `NOT_SUPPORTED` or `UNASSESSABLE`.

For every claim record: claim id; exact quotation; whether it is load-bearing; severity (`fatal`, `material` or `cosmetic`); verdict; cited source verification; independent evidence found; contradictory or null evidence found; instrument and timing check; reasoning or identification defect; corrected narrow wording where applicable; and the evidence or test that would settle what remains.

End with five explicit sections:

1. claims that survive unchanged;
2. claims that survive only in narrowed form;
3. claims rejected and why;
4. claims unresolved or sources unreachable and what would settle them;
5. omissions in the report, including credible contradictory evidence, missing interactions, timing flaws and data requirements.

The review is successful when its verdicts track the evidence, even if every material claim survives. It is not a summary, rewrite, vote, alternative research report, card approval or trading recommendation.
```

Validation note: this exact block replaces the weaker generated `02-red-team-prompt.md` language that re-fetches the report's sources but only asks whether counter-evidence inside those sources was omitted. The replacement requires an independent external search and an auditable distinction between no contrary evidence found and manufactured disagreement.

## 5. Exact proposed adjudication-stage wording

Change id: `PROMPT-ADJUDICATION-COMMON`  
Topic id: all seven topics  
Stage: `adjudication`  
Reason: turn the two earlier documents into evidence-resolved decisions, reproducible candidate treatments and a bounded central-synthesis handoff, with every unvalidated parameter and blocker visible.

In `adjudicationPrompt(topic)`, replace the text from `## What this stage is for` through the paragraph below `## The line this stage must not cross` with the following exact wording; retain version binding, session section, factor context, companion block, return block and prohibitions.

```md
## What this stage is for

Adjudicate the exact registered research report and the exact registered red-team review. Resolve every material objection by the strength and relevance of the evidence, not by averaging the documents, counting sources or preferring agreement. You may re-fetch sources and obtain additional sources needed to decide an objection; record that new evidence separately. When evidence cannot decide, preserve the issue as unresolved and state the precise test, source or decision needed.

## Which versions you are judging

- Attach the research and red-team documents named by the stage cards. Reproduce both document ids, versions and sha256 values at the top of the return.
- If either hash differs, stop and report the mismatch.
- Build a complete crosswalk from every material research finding to every relevant review objection before writing conclusions. No material objection may disappear because the report was rewritten.

## Decision rules

1. Accept an objection when independently checked evidence establishes its defect; correct or remove the affected claim.
2. Reject an objection only when evidence shows why it fails; disagreement or confidence is not a reason.
3. Mark an objection unresolved when the evidence, source access or programme design cannot decide it; name what would decide it.
4. Narrow a claim to the strongest wording the evidence supports, preserving instrument, window, era, regime and uncertainty limits.
5. Keep mechanism, contemporaneous association, predictive evidence and programme validation as four separate judgements.
6. Do not convert a literature threshold, a deployed constant or a plausible value into a validated programme parameter.

## Required adjudication sections

1. **Executive corrected conclusions** - concise best-supported conclusions with confidence (`high`, `moderate`, `low` or `unresolved`) and the evidence basis for each.
2. **Finding-by-finding crosswalk** - every material research finding and every material red-team objection, with identifiers, decision (`accepted`, `rejected`, `narrowed` or `unresolved`), reason, controlling evidence, corrected wording and downstream consequence.
3. **Accepted claims** - exact claims retained, including their instrument, timing, regime and scope limits.
4. **Rejected claims** - exact claims removed and the evidence or flaw that removes them.
5. **Unresolved claims** - exact claims not decided, why they remain open and what evidence or test would settle each one.
6. **Proposed engine treatment by owned factor** - choose one of `candidate directional input`, `candidate interaction or regime condition`, `candidate confidence or abstention input`, `research-only monitor`, or `exclude pending evidence`. For any treatment state the input; source and instrument; point-in-time availability; transformation; direction or role; timing; lookback; regime; interactions; overlap controls; missing, stale and conflicting-data handling; and reason. Say `no supported treatment` where appropriate.
7. **Parameters and implementation assumptions** - list every threshold, lag, lookback, window, winsorisation rule, normalisation, interaction form, missingness rule and conflict rule. Mark each `evidence-bounded`, `to be selected on training data`, `sensitivity range only` or `unvalidated`; none may be described as validated before the frozen empirical test.
8. **Required empirical tests** - specify the label instrument and endpoint requirements, point-in-time dataset, sample and subperiods, baselines, ablations, incremental tests against overlapping topics, event/quiet and regime splits, multiple-testing control, uncertainty, coverage, calibration where relevant, falsification criteria, stability tests and untouched holdout. State which tests are impossible with current data.
9. **Blockers and dependencies** - list missing data, licence or source access, unresolved label or calendar decisions, causal-timing gaps, insufficient history and dependencies on other topic adjudications. Distinguish a blocker to research, a blocker to empirical validation and a blocker to implementation.
10. **Handoff to central USD synthesis** - a concise standalone section containing: contributions to carry forward; claims and treatments to exclude; unresolved conflicts with other topics; overlap and double-counting warnings; required shared inputs; explicitly unvalidated parameters; empirical gates; and what this topic does not claim.

## The line this stage must not cross

An adjudicated document is evidence accepted for central synthesis, not proof of predictive edge and not a validated trading rule. This stage does not score, tune, implement, deploy or change a live call. It reports no performance figure unless that figure exists in cited evidence and is labelled with its own instrument, sample and window; it never presents an external result as performance of this programme.
```

Validation note: this exact block expands the generated `03-adjudication-prompt.md` from eight broad deliverables to an auditable claim/objection crosswalk, an enumerated factor treatment, classified parameters, explicit empirical design and typed blockers.

## 6. Topic-specific prompt changes and reasons

The exact topic-specific wording is the `title`, `summary`, `overlaps`, `probes` and `next_step` text in section 2. The common stage builders insert those fields into all three prompts.

- `usd-topic-vix-level-and-risk-regime` / all stages: term structure, volatility risk premium, credit controls and reaction-versus-prediction are explicit; reason - level-only evidence cannot settle the current factor or its overlaps.
- `usd-topic-front-end-rates` / all stages: the prompt must distinguish absolute, relative, real and curve repricing and test mediation; reason - seven rate entries are not seven independent signals.
- `usd-topic-funding-credit-and-dollar-liquidity` / all stages: the prompt must distinguish generic risk-off from a dollar-funding shock; reason - that mechanism was missing as an owner topic.
- `usd-topic-dollar-index-gold-and-equities` / all stages: the prompt asks whether gold, equities and Dollar Smile add information after VIX/rates/funding; reason - cross-asset evidence otherwise double-counts a latent risk state.
- `usd-topic-economic-surprise-and-fed-bias` / all stages: first-print vintage, expectation denominator, policy-path observable and rates mediation are mandatory; reason - a narrative bias string and revised actuals cannot establish a causal predictor.
- `usd-topic-fx-session-structure` / all stages: instrument identity, venue, boundary sensitivity, microstructure and label-feature overlap are mandatory; reason - the topic owns the dollar's own price history and is most exposed to horizon leakage.
- `usd-topic-calendar-and-data-quality` / all stages: known-at-cutoff events, informative missingness, selection and coverage utility are mandatory; reason - neutral, exclusion and abstention are different empirical treatments.

## 7. Next batch and dependency order

The next undispatched research topic should be `usd-topic-front-end-rates` after workstream A applies this map. It owns seven entries, defines the policy-transmission and relative-rate concepts used by the macro topic, and supplies a necessary control for VIX, funding and cross-asset claims. Its literature work can proceed while the exact label remains blocked, provided it makes no claim of validation on the programme session.

Proposed dispatch order:

1. `usd-topic-front-end-rates` - establish distinct rate observables, timing and mediation.
2. `usd-topic-calendar-and-data-quality` - establish point-in-time, vintage, event and missingness rules used by every empirical handoff.
3. `usd-topic-economic-surprise-and-fed-bias` - consume the rates and causal-availability definitions; do not treat a Fed narrative as an observable.
4. `usd-topic-funding-credit-and-dollar-liquidity` - consume rates research and the VIX adjudication; test whether stress measures are incremental.
5. `usd-topic-dollar-index-gold-and-equities` - consume VIX and funding conclusions; test cross-asset incrementality and Dollar Smile claims.
6. `usd-topic-fx-session-structure` - research last because its empirical formulation depends most directly on the unresolved label instrument, venue and endpoint quotes.

This order does not delay the already-dispatched VIX chain: VIX stage 2 red-team against registered research version 1 remains the immediate gate, followed by VIX adjudication. The queued research sequence may start independently, but no downstream adjudication may silently import a result from a topic whose registered stage is incomplete.

## 8. Application and validation handoff to workstream A

Workstream A should review topic-id stability for the new topic, then apply the approved text in `scripts/build_research_library.js`. It should not edit the frozen VIX pilot archive or claim that regenerated prompt hashes describe the already-dispatched VIX research brief.

Required application sequence:

```text
node scripts/build_research_library.js catalog --write
node scripts/build_research_library.js registry --check
node scripts/build_research_library.js catalog --check
node scripts/build_research_library.js topics --check
node scripts/build_research_library.js verify
npm run test:research-library
npm run test:research-handoff
```

Before writing, A should add or update a guard that asserts: seven topics; every one of the twenty-five factor ids appears exactly once; the new funding topic owns exactly `rates.credit-spread-delta`, `risk.usd-safe-haven-demand` and `risk.risk-on-off-cross-asset-state`; all three generated stage prompts contain their required evidence contract; every prompt hash and byte count matches the file; and the VIX registered document and frozen pilot bytes remain unchanged.

## 9. Proposal validation performed in workstream C

- Compared the proposed common research wording with all current generated `01-research-prompt.md` files: the proposal retains every existing required theme and adds the evidence matrix, transferability, null-evidence and point-in-time design requirements.
- Compared the proposed common red-team wording with all current generated `02-red-team-prompt.md` files: the proposal retains source re-fetch and claim verdicts and adds independent source discovery, explicit timing/leakage checks and a no-manufactured-disagreement success rule.
- Compared the proposed common adjudication wording with all current generated `03-adjudication-prompt.md` files: the proposal retains corrected conclusions, per-objection decisions, treatment, data, tests and central handoff and makes each item auditable.
- Reconciled the proposed factor ownership against `data/research-library/catalog.json`: all twenty-five current factor ids are owned once, none is added or dropped.
- The existing thresholds remain context rather than scope limits, and every stage repeats the boundary between evidence, approval, empirical validation and deployment.
- Baseline guard result on 2026-10-16: `topics --check` is clean for all eighteen current prompt files. `verify` reaches clean catalogue, registry and topic-prompt checks but remains non-zero on two pre-existing repo-document hash mismatches outside this proposal: `usd-24h-experiment-registry` and `usd-24h-selection`. Workstream A must reconcile or knowingly baseline those two records before claiming a fully clean `verify`; this lane did not edit either document or its registry entry.
