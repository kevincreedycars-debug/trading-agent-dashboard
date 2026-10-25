# F2 US 2Y yield delta - live.f2-us-2y-delta - USD stage 2 of 3: Red-team

## Assignment

- Chain: `usd-factor-live-f2-us-2y-delta` on USD (US Dollar); chain kind `factor`.
- Factor: `live.f2-us-2y-delta` - F2 US 2Y yield delta.
- Group label: `usd-topic-front-end-rates` (US front-end rates, real yields and curve position). The label groups chains; it owns no stage and this prompt is the only stage you run for it.
- Stage: 2 of 3, red-team. This stage returns exactly one Markdown document (review), named `usd-live-f2-us-2y-delta-s2-red-team.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Attack one document: the stage 1 report for F2 US 2Y yield delta - live.f2-us-2y-delta, which the operator supplies, and return one issue register. Judge every load-bearing claim on the passage it cites and on the sources you fetch yourself, give each claim a verdict, a severity and the evidence that would settle it, and keep separate what the report gets right, what it cannot support and what you could not reach. Do not rewrite the report and do not propose an implementation; a narrower true claim is a result, not a loss.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this chain answers for

These are the catalogue entries this chain is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `live.f2-us-2y-delta` - F2 US 2Y yield delta. Role: direction. Group: live_engine. Research status: ready.
  - What the entry stands for: Change in the US 2Y yield as a policy-expectation proxy.
  - Rule in force today, the baseline to audit and never evidence: 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH.
  - Threshold: +/- 5 bps. Lookback: 5 days on the 24h timeframe.
  - Series the collector reads: FRED DGS2.
  - Published brief: `docs/research/handoff/usd/v1/packs/f2-us-2y-delta.md` (sha256 `1f6593c81175ce0ca3675d77dab14bb7397b03235df48523ffdb24ac7e785121`, 14443 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents you are given

Supplied by the operator. Record the file name and the first heading of the document you judge in the header lines your deliverable asks for. If what you were given is clearly another topic or another stage, stop and say so.

- `usd-live-f2-us-2y-delta-s1-research.md` - the stage 1 report for this chain, at the version and hash registered against its stage 1. As supplied: version `unknown`, sha256 `unknown`.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/weight_vector_discrepancy.md` - the two live weight vectors and where each is used. sha256 `2f420763193b0a032ccd38c1958563cd848c942f7cf49b53cad8de0ad98535cc`.

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

- File name: `usd-live-f2-us-2y-delta-s2-red-team.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Header lines, above the first heading, in this form:

```
Reviewed chain: usd-factor-live-f2-us-2y-delta
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

The operator supplies this review and the report it judges, unchanged and under their own names, to stage 3 (adjudication) for the same chain. The review does not replace the report, and no engine reads either.
