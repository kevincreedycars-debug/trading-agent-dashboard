# USD asset-level final analysis - USD stage 2 of 3: Red-team

## Assignment

- Chain: `usd-final-asset-analysis` on USD (US Dollar); chain kind `asset_synthesis`.
- Stage: 2 of 3, red-team. This stage returns exactly one Markdown document (review), named `usd-final-asset-analysis-s2-red-team.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Gate: this chain does not open early. It runs only when all 25 factor chains have delivered research, red-team and adjudication against their current parent versions, and the gate is `all-factor-chains`. If any one of them is missing or stale, stop and say which: an incomplete synthesis presented as a result is worse than no synthesis.
- The gate is enforced by the library, not by this prompt. Reading the condition here is not permission to begin, and returning a file does not change the locked state of anything.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Attack the US Dollar candidate model specification and validation plan in the document you are given, claim by claim, and return one issue register. Attack both halves: whether the specification is computable, timely and free of double counting, and whether the plan could tell a real relation from an artefact of the sample, the benchmarks or the number of comparisons tried. Do not rewrite the specification. Say what is wrong, how much it matters and what evidence would settle it.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### Documents you are given

Supplied by the operator. Record the file name and the first heading of the document you judge in the header lines your deliverable asks for. If what you were given is clearly another topic or another stage, stop and say so.

- `usd-final-asset-analysis-s1-proposal.md` - the final analysis for this asset, at the version registered against its stage 1. As supplied: version `unknown`, sha256 `unknown`.
- `usd-factor-*-s3-adjudication.md` - every supporting adjudication the final analysis recorded, at the version and hash it recorded for each. As supplied: version `unknown`, sha256 `unknown`.

### The entries in scope

Every entry below belongs to at least one of the factor chains this synthesis reads. They are the catalogue's record of what is being proposed, not evidence, and not the scope limit of the reconciliation.


### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/inventory.md` - the input and decision inventory the synthesis closes out. sha256 `a886f1ddcce52d4d8a0af77069b391deb1338275380cccd2e08d41fd61f2d56a`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions to answer, claim by claim

1. Can the specification be computed from the inputs it names, at the cutoff it names, with the vintage discipline it claims?
2. Is the timing honest: is every input observable at the cutoff, or does one of them only arrive later?
3. Is any input counted twice - across entries, across factor chains, or through an interaction term?
4. Is the aggregation policy justified, or is it a sum of scores dressed as a model? Where a weight is fitted, on what sample and with what protection?
5. Are the signs and thresholds supported by the evidence cited, or inherited from the deployed baseline?
6. Is the label the same instrument and window as the analysis, or has an ETF, a basket or a different closing time slipped in?
7. Could the validation plan tell a real relation from a lucky one: sample size, era splits, multiplicity, holdout, and the number of variants tried?
8. Are the benchmarks fair or trivially beatable - the no-call baseline, the deployed engine and a shuffled control?
9. Do the metrics measure what matters, including base rates, coverage when the rule abstains, and sensitivity to costs?
10. What is unvalidated but presented as settled, and what would falsify the whole specification?

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

- File name: `usd-final-asset-analysis-s2-red-team.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Header lines, above the first heading, in this form:

```
Reviewed chain: usd-final-asset-analysis
Reviewed document: <the file name you were given>
Reviewed version: <the version you were given, or unknown>
Reviewed sha256: <the hash you were given, or unknown>
Reviewed first heading: <the first heading of that document, verbatim>
```

Write `unknown` where a version or a hash was not supplied. Do not invent one, and do not stop because it is missing.

- Sections: exactly these, in this order, each as a `## ` heading with the exact title:

  1. `## Summary - the verdict, in at most ten lines`
  2. `## The document judged - file name, first heading, the version and hash you were given`
  3. `## Claims checked - one row per load-bearing claim: claim as stated, where it is, verdict, severity, the evidence and the reason`
  4. `## Specification defects - computability, timing, double counting, aggregation, signs and thresholds, the label`
  5. `## Validation-plan defects - splits, multiplicity, benchmarks, metrics, costs, coverage`
  6. `## What the proposal gets right`
  7. `## What is unvalidated but presented as settled`
  8. `## What a corrected version would have to change, and what it should not change`
  9. `## Questions the proposal should have answered and did not`
  10. `## Sources consulted`

Keep a section that turns out to be empty, and say in one sentence why it is empty.
Do not restate these instructions, and do not add a section that summarises the prompt.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Both halves of the proposal are attacked: the specification and the validation plan.
- [ ] Every load-bearing claim has a row in the register with a verdict, a severity and a reason.
- [ ] Computability at the stated cutoff is checked input by input.
- [ ] Double counting is checked across entries, across factor chains and through interactions.
- [ ] The multiplicity of the validation design is assessed, not only its metrics.
- [ ] What the proposal gets right is listed as such.
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

The operator supplies this review and the final analysis it judges, unchanged, to stage 3 (adjudication) for the same asset. The review does not replace the proposal.
