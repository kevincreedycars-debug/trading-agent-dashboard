# Release surprise at first print - macro.release-surprise-at-first-print - USD stage 3 of 3: Adjudication

## Assignment

- Chain: `usd-factor-macro-release-surprise-at-first-print` on USD (US Dollar); chain kind `factor`.
- Factor: `macro.release-surprise-at-first-print` - Release surprise at first print.
- Group label: `usd-topic-economic-surprise-and-fed-bias` (Economic surprises, first prints and Fed bias). The label groups chains; it owns no stage and this prompt is the only stage you run for it.
- Stage: 3 of 3, adjudication. This stage returns exactly one Markdown document (synthesis), named `usd-macro-release-surprise-at-first-print-s3-adjudication.md`.
- Prompt template: `research-prompt-v3.1.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Decide one chain: settle every material objection against the stage 1 report and the stage 2 review for Release surprise at first print - macro.release-surprise-at-first-print, and return the corrected, best-supported conclusion. State what the chain rules out, what stays unresolved and what would settle it, and state a treatment of the entries only where the evidence supports one, naming every parameter that has not been measured. This stage decides on the evidence available when it is run; it does not fit, score, deploy or change a live call.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this chain answers for

These are the catalogue entries this chain is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `macro.release-surprise-at-first-print` - Release surprise at first print. Role: direction. Group: research_session_v1. Research status: blocked.
  - What the entry stands for: The honest test of the highest-weight live family. Asking for a first-print surprise with the consensus that was published before the release, and stating plainly if no such source is reachable.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Rates package USD-SESSION-A2; docs/research/usd-session/v1/inventory.md section 7.
  - Recorded blocker: No consensus or first-print vintage source is reachable from this repository: the ALFRED vintage CSV needs a key, and the live calendar feed stores no consensus snapshot..
  - Published brief: `docs/research/handoff/usd/v1/packs/macro-release-surprise-at-first-print.md` (sha256 `4cfa12e5074d569f8daab01a73ffaf6dc7e195f45370fc54700ec6bb201549bc`, 14299 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents you are given

Supplied by the operator. Record the file name and the first heading of each document you judge in the header lines your deliverable asks for. If either is clearly another topic or another stage, stop and say so.

- `usd-macro-release-surprise-at-first-print-s1-research.md` - the stage 1 report for this chain, at the version and hash registered against its stage 1. As supplied: version `unknown`, sha256 `unknown`.
- `usd-macro-release-surprise-at-first-print-s2-red-team.md` - the stage 2 review for this chain, at the version and hash registered against its stage 2. As supplied: version `unknown`, sha256 `unknown`.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/macro_data_inventory.md` - publication timing, revisions, missingness and live versus historical availability. sha256 `3a473fd839c4676ff51a7b373822a5639e89d4b540ec1d4907074e391532418d`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions to decide, finding by finding

1. For each material objection: do the two documents and the sources you fetch decide it, or does it stay open?
2. Where the report and the review agree, do they rest on the same source - and if so, is that agreement evidence, or one source counted twice?
3. Which conclusion survives in corrected form, and exactly what changed in it?
4. Which objection is rejected, and what is wrong with it?
5. Which claim stays unresolved, and what measurement would settle it?
6. Is any proposed treatment computable from the data named in this prompt, and which of its parameters have not been measured?
7. Does the proposed treatment count one input twice across entries or chains, and if so, which chain owns it?
8. What must the asset synthesis decide that this chain cannot?

### Questions this chain must settle

9. What is the surprise - the first print minus the consensus published before the release - and can any such pair be reached without a paid vintage archive? Settle it: accepted, rejected or unresolved, and what evidence decides it?
10. At which moment does the surprise become observable, and how much of the reaction is already inside the dollar by the next 05:00 London cutoff? Settle it: accepted, rejected or unresolved, and what evidence decides it?
11. Is the mechanism a policy-expectation repricing or a risk-premium change, and does the sign depend on the state of the policy cycle and on where the policy rate sits? Settle it: accepted, rejected or unresolved, and what evidence decides it?
12. Does the surprise add information beyond the front-end rate change and the equity move that follow the print, and what is the honest conclusion if no vintage source is reachable at all? Settle it: accepted, rejected or unresolved, and what evidence decides it?
13. Which of these three chains is testing a surprise, which is testing a narrative, and which is testing the same underlying information twice? Settle it: accepted, rejected or unresolved, and what evidence decides it?
14. Is the first print the only honest vintage, and what does the revision history of the tested series look like? Settle it: accepted, rejected or unresolved, and what evidence decides it?

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

- File name: `usd-macro-release-surprise-at-first-print-s3-adjudication.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Header lines, above the first heading, in this form:

```
Reviewed chain: usd-factor-macro-release-surprise-at-first-print
Reviewed document: <the file name you were given>
Reviewed version: <the version you were given, or unknown>
Reviewed sha256: <the hash you were given, or unknown>
Reviewed first heading: <the first heading of that document, verbatim>
```

Write `unknown` where a version or a hash was not supplied. Do not invent one, and do not stop because it is missing.

- Sections: exactly these, in this order, each as a `## ` heading with the exact title:

  1. `## Summary - the decision, in at most ten lines`
  2. `## The documents judged - file names, first headings, versions and hashes`
  3. `## Decision register - one row per material objection: accepted, rejected or unresolved, with the evidence and the reason`
  4. `## The conclusion for this chain, in corrected form`
  5. `## What the evidence supports, by entry, with the sample behind each claim`
  6. `## What this chain rules out`
  7. `## Unresolved items, and the measurement that would settle each`
  8. `## Proposed treatment, if the evidence supports one, with every unvalidated parameter named`
  9. `## Required empirical tests and remaining blockers`
  10. `## Ownership of inputs that overlap another chain`
  11. `## Handoff to the asset synthesis`
  12. `## Sources`

Keep a section that turns out to be empty, and say in one sentence why it is empty.
Do not restate these instructions, and do not add a section that summarises the prompt.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Every material objection from the review has a decision.
- [ ] Every decision names the evidence it rests on.
- [ ] Agreement between the two documents that rests on one source is identified as such.
- [ ] The corrected conclusion can be used without reading either input document.
- [ ] Every unresolved item carries the measurement that would settle it.
- [ ] Any treatment names its unmeasured parameters and the chain that owns each overlapping input.
- [ ] Nothing here changes a live call, and no parameter is presented as validated.

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

The adjudication becomes the record for this chain. It is the input to the asset synthesis chain, which reconciles every factor chain into one candidate model and one validation plan. Nothing is fitted or deployed at this step, and a treatment named here stays unvalidated until that plan runs and is itself reviewed.
