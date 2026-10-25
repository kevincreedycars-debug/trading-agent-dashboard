# Economic surprises, first prints and Fed bias - USD stage 2 of 3: Red-team

## Assignment

- Topic: `usd-topic-economic-surprise-and-fed-bias` on USD (US Dollar), chain `factor`.
- Stage: 2 of 3, red-team. This stage returns exactly one Markdown document (review), named `usd-economic-surprise-and-fed-bias-s2-red-team.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this topic has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Attack one document: the stage 1 report for Economic surprises, first prints and Fed bias, which the operator supplies, and return one issue register. Judge every load-bearing claim on the passage it cites and on the sources you fetch yourself, give each claim a verdict, a severity and the evidence that would settle it, and keep separate what the report gets right, what it cannot support and what you could not reach. Do not rewrite the report and do not propose an implementation; a narrower true claim is a result, not a loss.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this topic answers for

These are the catalogue entries this topic is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `live.f7-economic-surprise` - F7 US economic surprise. Role: direction. Group: live_engine. Research status: blocked.
  - What the entry stands for: The highest-weight live family. The stored usd_signal per event is copied straight through, with no consensus and no first-print vintage reachable from this repository.
  - Rule in force today, the baseline to audit and never evidence: the collector pre-computes a usd_signal per event and the node copies it; no threshold, no as-of check, no vintage.
  - Threshold: none. Lookback: whatever the collector stored.
  - Series the collector reads: Finnhub economic calendar (paid key), no consensus archive kept.
  - Recorded blocker: No consensus or first-print vintage source is reachable from this repository..
  - Published brief: `docs/research/handoff/usd/v1/packs/f7-economic-surprise.md` (sha256 `604185221074fa2673da9b24d387cca6ac286de6443a0baae6e8de9b1d891fd3`, 17272 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `live.f8-fed-bias` - F8 Fed bias. Role: direction. Group: live_engine. Research status: blocked.
  - What the entry stands for: Directional read of the Fed bias string, tested for the words hawkish or dovish. The rulebook describes a delta; the code measures no change.
  - Rule in force today, the baseline to audit and never evidence: string contains hawkish or dovish; unknown is treated as a missing input and scores NEUTRAL.
  - Threshold: none. Lookback: current string only.
  - Series the collector reads: Collector-derived from the paid calendar feed.
  - Recorded blocker: No vintage of the bias string is retained, so no change can be measured..
  - Published brief: `docs/research/handoff/usd/v1/packs/f8-fed-bias.md` (sha256 `5cddde1f4eab88538555f7869b234e0030518bb01f8e52bf6f1af1c6abe6728e`, 16999 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `macro.release-surprise-at-first-print` - Release surprise at first print. Role: direction. Group: research_session_v1. Research status: blocked.
  - What the entry stands for: The honest test of the highest-weight live family. Asking for a first-print surprise with the consensus that was published before the release, and stating plainly if no such source is reachable.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Rates package USD-SESSION-A2; docs/research/usd-session/v1/inventory.md section 7.
  - Recorded blocker: No consensus or first-print vintage source is reachable from this repository: the ALFRED vintage CSV needs a key, and the live calendar feed stores no consensus snapshot..
  - Published brief: `docs/research/handoff/usd/v1/packs/macro-release-surprise-at-first-print.md` (sha256 `4cfa12e5074d569f8daab01a73ffaf6dc7e195f45370fc54700ec6bb201549bc`, 14299 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents you are given

Supplied by the operator. Record the file name and the first heading of the document you judge in the header lines your deliverable asks for. If what you were given is clearly another topic or another stage, stop and say so.

- `usd-economic-surprise-and-fed-bias-s1-research.md` - the stage 1 research report for this topic, supplied by the operator. As supplied: version `unknown`, sha256 `unknown`.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/macro_data_inventory.md` - publication timing, revisions, missingness and live versus historical availability. sha256 `3a473fd839c4676ff51a7b373822a5639e89d4b540ec1d4907074e391532418d`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions to answer, claim by claim

1. For each load-bearing claim: what exactly does it assert, and does the passage it cites support it as stated?
2. Window: is the evidence about the session above, or about a close-to-close day, an intraday slice or another window presented as if it were ours?
3. Instrument: is a claim really about EUR/USD, a basket, a futures contract or an ETF, presented under another name?
4. Mechanism against measurement: is a plausible channel being used as though the relation had been measured?
5. Already priced: does the claim count as predictive something the cutoff has already absorbed?
6. Identification: sample period, era and regime dependence, conditioning on the outcome, survivorship in the sources chosen, the base rate behind a conditional claim, and any number with no stated origin.
7. Counter-evidence: is the strongest contrary evidence in the sources the report fetched missing, or present and dismissed without a reason?
8. Internal consistency and scope: does one section contradict another, does the what-is-not-claimed section match the body, and is any true claim only too wide?
9. Coverage: does every entry in scope get an answer, and is every question the report could not answer named as unanswered?

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

- File name: `usd-economic-surprise-and-fed-bias-s2-red-team.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Header lines, above the first heading, in this form:

```
Reviewed topic: usd-topic-economic-surprise-and-fed-bias
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
  4. `## What the report gets right`
  5. `## What the report cannot support, and the sentence that breaks it`
  6. `## What you could not check, and what would settle it`
  7. `## Window, instrument and timing defects`
  8. `## Identification, sample and inference defects`
  9. `## Overlap and double counting the report leaves unaddressed`
  10. `## Questions the report should have answered and did not`
  11. `## What a corrected version of the strongest surviving claim would say`
  12. `## Sources consulted`

Keep a section that turns out to be empty, and say in one sentence why it is empty.
Do not restate these instructions, and do not add a section that summarises the prompt.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Every load-bearing claim in the document has a row in the register.
- [ ] Every verdict carries a reason and a severity, not only a label.
- [ ] The header lines record the file name and first heading you were given, and never invent a hash.
- [ ] What the report gets right is listed as such.
- [ ] What you could not check is kept separate from what you checked and found wrong.
- [ ] No rewritten report, no replacement section and no proposed implementation.
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

The operator supplies this review and the report it judges, unchanged and under their own names, to stage 3 (adjudication) for the same topic. The review does not replace the report, and no engine reads either.
