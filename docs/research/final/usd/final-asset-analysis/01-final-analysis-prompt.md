# USD asset-level final analysis - USD stage 1 of 3: Final analysis

## Assignment

- Chain: `usd-final-asset-analysis` on USD (US Dollar); chain kind `asset_synthesis`.
- Stage: 1 of 3, final analysis. This stage returns exactly one Markdown document (synthesis), named `usd-final-asset-analysis-s1-proposal.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Gate: this chain does not open early. It runs only when all 25 factor chains have delivered research, red-team and adjudication against their current parent versions, and the gate is `all-factor-chains`. If any one of them is missing or stale, stop and say which: an incomplete synthesis presented as a result is worse than no synthesis.
- The gate is enforced by the library, not by this prompt. Reading the condition here is not permission to begin, and returning a file does not change the locked state of anything.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Produce one candidate US Dollar model specification and one empirical validation plan, reconciled from the factor-chain adjudications, and state what the evidence does and does not support. The question is not which factor chain scored best. It is whether the chains, read together, describe one coherent decision rule for the session above, which entries actually carry it, and what a fair test of it would look like. A list of per-factor scores added together is not a model: state the aggregation policy, the reason for it and the evidence behind it. Nothing in this stage is fitted, scored, validated or deployed.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor-chain adjudications this stage reconciles

These are the factor-chain adjudications this stage reconciles, supplied by the operator. If some are missing, name which and continue: an incomplete reconciliation that says so is a usable result, a silent one is not.

- `usd-live-f1-vix-level-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f1-vix-level`, at the version and hash registered against that chain
- `usd-risk-vix-level-and-change-at-cutoff-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-risk-vix-level-and-change-at-cutoff`, at the version and hash registered against that chain
- `usd-live-f2-us-2y-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f2-us-2y-delta`, at the version and hash registered against that chain
- `usd-live-f3-us-de-2y-spread-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f3-us-de-2y-spread-delta`, at the version and hash registered against that chain
- `usd-live-f4-real-yield-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f4-real-yield-delta`, at the version and hash registered against that chain
- `usd-rates-us-front-end-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-rates-us-front-end-delta`, at the version and hash registered against that chain
- `usd-rates-relative-front-end-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-rates-relative-front-end-delta`, at the version and hash registered against that chain
- `usd-rates-real-yield-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-rates-real-yield-delta`, at the version and hash registered against that chain
- `usd-rates-term-premium-and-curve-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-rates-term-premium-and-curve`, at the version and hash registered against that chain
- `usd-rates-credit-spread-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-rates-credit-spread-delta`, at the version and hash registered against that chain
- `usd-live-f5-dxy-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f5-dxy-delta`, at the version and hash registered against that chain
- `usd-live-f6-gold-delta-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f6-gold-delta`, at the version and hash registered against that chain
- `usd-live-f9-dollar-smile-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f9-dollar-smile`, at the version and hash registered against that chain
- `usd-live-f10-equity-versus-usd-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f10-equity-versus-usd`, at the version and hash registered against that chain
- `usd-live-f7-economic-surprise-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f7-economic-surprise`, at the version and hash registered against that chain
- `usd-live-f8-fed-bias-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-live-f8-fed-bias`, at the version and hash registered against that chain
- `usd-macro-release-surprise-at-first-print-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-macro-release-surprise-at-first-print`, at the version and hash registered against that chain
- `usd-fx-usd-session-momentum-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-fx-usd-session-momentum`, at the version and hash registered against that chain
- `usd-fx-usd-overnight-range-position-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-fx-usd-overnight-range-position`, at the version and hash registered against that chain
- `usd-fx-usd-session-volatility-regime-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-fx-usd-session-volatility-regime`, at the version and hash registered against that chain
- `usd-risk-usd-safe-haven-demand-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-risk-usd-safe-haven-demand`, at the version and hash registered against that chain
- `usd-risk-risk-on-off-cross-asset-state-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-risk-risk-on-off-cross-asset-state`, at the version and hash registered against that chain
- `usd-calendar-known-releases-between-cutoff-and-endpoint-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-calendar-known-releases-between-cutoff-and-endpoint`, at the version and hash registered against that chain
- `usd-calendar-days-since-and-until-high-impact-events-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-calendar-days-since-and-until-high-impact-events`, at the version and hash registered against that chain
- `usd-data-quality-gate-for-abstention-s3-adjudication.md` - the stage 3 adjudication of `usd-factor-data-quality-gate-for-abstention`, at the version and hash registered against that chain

### The entries in scope

Every entry below belongs to at least one of the factor chains this synthesis reads. They are the catalogue's record of what is being proposed, not evidence, and not the scope limit of the reconciliation.


### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/inventory.md` - the input and decision inventory the synthesis closes out. sha256 `a886f1ddcce52d4d8a0af77069b391deb1338275380cccd2e08d41fd61f2d56a`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions about the reconciliation

1. What do the factor-chain adjudications agree on, and where do they conflict - each conflict named as a pair of claims rather than a general tension?
2. Which conflicts are real disagreements, and which are different windows or different instruments being compared?
3. Which entries survive as separate evidence, which are one idea under two names, and which are dropped or stay blocked - each with the reason and the chain it came from?

### Questions about the candidate specification

4. What is the decision rule, stated so that it can be computed: inputs, transforms, timing, sign logic, interactions, abstention and the missing-data policy?
5. What is the aggregation policy, and what is the evidence for it? Equal weights, a fixed rule and a fitted vector are three different claims; say which you propose and what would validate it.
6. Does the rule double-count anything the factor chains already flagged, and is the overlap removed rather than reweighted?
7. What is unvalidated in the specification, stated as a named parameter rather than a caveat?

### Questions about the validation plan

8. What is the plan: dataset, label, eras, holdout, benchmarks, metrics with their base rates, abstention and coverage, and sensitivity to costs?
9. Are the benchmarks fair - a no-call baseline, the deployed engine and a shuffled control - or is the plan trivially beatable?
10. How many independent comparisons does this design buy after the overlaps, and what does that do to the significance of anything it finds?
11. What would falsify the whole specification, and what result would make you withdraw it?
12. What cannot be tested with the data reachable from this repository, and what would have to be bought or recorded first?

## Evidence standard

- Name the source for every load-bearing claim: publication, series id, table or section, and the date you read it. A claim with no source is written as your reading, not as a finding.
- Cite the passage you rely on. Where a source only partly supports a claim, write what it does support and what it leaves out.
- Separate measurement from mechanism. A channel is a hypothesis; say which part of a claim has been measured and which part has not.
- State the sample behind any relation: instrument, window, era and the number of non-overlapping observations. A number with no sample is not evidence.
- Prefer the primary source to a summary, and the series documentation to a post about the series.
- Report what you could not reach: paywalls, undated pages, dead links, series with no documented vintage. Do not fill the gap with a plausible number.
- Where two sources disagree, say so and say which you would trust and why.
- Every claim about timing is about this session and this cutoff, not about a general close-to-close convention.

## Deliverable

Return exactly one Markdown file and nothing else.

- File name: `usd-final-asset-analysis-s1-proposal.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Sections: exactly these, in this order, each as a `## ` heading with the exact title:

  1. `## Summary - the proposal, in at most fifteen lines`
  2. `## The adjudications reconciled - which you were given, which were missing`
  3. `## Where the factor chains agree, and how strong that agreement is`
  4. `## Where the factor chains conflict, and how each conflict is resolved`
  5. `## The entries that survive as separate evidence, the ones merged, and the ones dropped, each with its reason`
  6. `## The candidate specification - inputs, transforms, timing, sign logic, interactions, abstention, missing data and aggregation, with the evidence for each`
  7. `## What is unvalidated in the specification, as named parameters rather than caveats`
  8. `## The validation plan - dataset, label, eras, holdout, benchmarks, metrics with base rates, coverage, costs and multiplicity`
  9. `## What would falsify the specification`
  10. `## What cannot be tested here, and what would have to be bought or recorded first`
  11. `## Sources`

Keep a section that turns out to be empty, and say in one sentence why it is empty.
Do not restate these instructions, and do not add a section that summarises the prompt.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Every adjudication you were given is used, and any missing one is named.
- [ ] Every conflict between factor chains is named as a pair of claims, with a resolution or an open flag.
- [ ] The specification states inputs, transforms, timing, sign logic, interactions, abstention, missing data and aggregation.
- [ ] The aggregation policy is stated and argued, not implied by a sum of scores.
- [ ] Double counting is addressed explicitly.
- [ ] The validation plan names data, label, eras, holdout, benchmarks, metrics with base rates, coverage and costs.
- [ ] What is unvalidated is listed as named parameters.
- [ ] The file name and every section heading match the instructions exactly.

## Prohibitions

- Do not treat a rule in force as evidence for itself. It is the baseline you are auditing.
- Do not propose or make a change to a live engine, a live call or a deployed workflow.
- Do not invent a number, a series id, a citation, a date or a hash. `unknown` is allowed; a guess is not.
- Do not return JSON, a dashboard card, a zip, a spreadsheet, a second file, or this prompt pasted back.
- Do not add, rename, reorder or merge the deliverable sections.
- Do not report a directional edge from a sample you have not described.
- Do not use a value published after the cutoff, or a later revision, as what was known at the cutoff.
- Do not treat a local export, a passing replay test or a workflow run as evidence that anything is deployed, timely or profitable.
- Do not assume access to data this prompt does not name; if a test needs it, say what it is and where it would come from.

If a question can only be answered by breaking one of these, say so in the file rather than breaking it.

## What happens next

The operator supplies this file, unchanged and under the same name, to stage 2 (red-team) for the same asset. Nothing is fitted, scored or deployed at this step, and no engine reads this file.
