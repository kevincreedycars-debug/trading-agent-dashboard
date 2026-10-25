# F9 Dollar Smile regime - live.f9-dollar-smile - stage 2 of 3: Red-team

## Assignment

- Chain: `usd-factor-live-f9-dollar-smile` on USD (US Dollar); chain kind `factor`.
- Factor: `live.f9-dollar-smile` - F9 Dollar Smile regime.
- Group label: `usd-topic-dollar-index-gold-and-equities` (Dollar index, gold and equity-against-USD relations). The label groups chains; it owns no stage and this prompt is the only stage you run for it.
- Stage: 2 of 3, red-team. This stage returns exactly one Markdown document (review), named `usd-live-f9-dollar-smile-s2-red-team.md`.
- Prompt template: `research-prompt-v3.1.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Attack one document: the stage 1 report for F9 Dollar Smile regime - live.f9-dollar-smile, which the operator supplies, and return one issue register. Judge every load-bearing claim on the passage it cites and on the sources you fetch yourself, give each claim a verdict, a severity and the evidence that would settle it, and keep separate what the report gets right, what it cannot support and what you could not reach. Do not rewrite the report and do not propose an implementation; a narrower true claim is a result, not a loss.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this chain answers for

These are the catalogue entries this chain is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `live.f9-dollar-smile` - F9 Dollar Smile regime. Role: regime context. Group: live_engine. Research status: ready.
  - What the entry stands for: The smile regime read from the VIX level and the bias string.
  - Rule in force today, the baseline to audit and never evidence: VIX above 25 reads BULLISH; VIX below 16 and not hawkish reads BEARISH.
  - Threshold: 25 / 16. Lookback: level.
  - Series the collector reads: FRED VIXCLS; the collector bias string.
  - Published brief: `docs/research/handoff/usd/v1/packs/f9-dollar-smile.md` (sha256 `e90bdc5b62bfb8b736b3329d029c39ef4e79056cb7043b6ea1545ec8d7460102`, 16586 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents you are given

Supplied by the operator. Record the file name and the first heading of the document you judge in the header lines your deliverable asks for. If what you were given is clearly another topic or another stage, stop and say so.

- `usd-live-f9-dollar-smile-s1-research.md` - the stage 1 report for this chain, at the version and hash registered against its stage 1. As supplied: version `unknown`, sha256 `unknown`.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/target_source_assessment.md` - DXY and intraday source coverage, access and cost. sha256 `078f8951777b782643b0aa4d1a87ba82b1beede0128f2e43cf2b5faeed1277da`.

## Independence rules

- You are not the author's session and you did not write the report; do not ask it what it meant. The report must stand on the words it contains.
- Open the sources yourself wherever they are reachable, and say which ones you could re-fetch. Where a source is behind a login or a paywall, judge only on the quotation given and mark the claim status accordingly.
- Judge claims, not style, and attack the strongest version of a claim rather than a weakened one.
- Say when a claim is right and only its scope is too wide: a narrower true claim is a result, not a loss.

## What to attack, claim by claim

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

### Questions this chain asks, which the report had to answer

10. Is the dollar smile a measured relation in this window or a descriptive story, and what observation would falsify it? Did the report answer it, and on what source?
11. The deployed reading uses the VIX 25/16 pair and the bias string: are those the right variables, and does the smile need a third state such as global growth or funding stress that neither captures? Did the report answer it, and on what source?
12. Is the smile a regime variable that should switch other factors signs, or a separate directional factor, and can those two roles be told apart with session data? Did the report answer it, and on what source?
13. Does the smile add anything to the VIX level and the cross-asset risk state it is computed from, and is the rulebook weight of 12 defensible against the coded 1? Did the report answer it, and on what source?
14. Which dollar index is a claim actually about, and does the answer change with the index construction? Did the report answer it, and on what source?
15. Are gold and equities independent evidence for the dollar, or the same risk factor counted twice? Did the report answer it, and on what source?

## Evidence standard

- Name the source for every load-bearing claim: publication, series id, table or section, and the date you read it. A claim with no source is written as your reading, not as a finding.
- Cite the passage you rely on. Where a source only partly supports a claim, write what it does support and what it leaves out.
- Separate measurement from mechanism. A channel is a hypothesis; say which part of a claim has been measured and which part has not.
- State the sample behind any relation: instrument, window, era and the number of non-overlapping observations. A number with no sample is not evidence.
- Prefer the primary source to a summary, and the series documentation to a post about the series.
- Report what you could not reach: paywalls, undated pages, dead links, series with no documented vintage. Do not fill the gap with a plausible number.
- Where two sources disagree, say so and say which you would trust and why.
- Every claim about timing is about this session and this cutoff, not about a general close-to-close convention.

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

## What the review must contain

The file must contain exactly these sections, in this order, each as a `## ` heading with the exact title:

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

## What to return

Return exactly one Markdown file and nothing else.

- File name: `usd-live-f9-dollar-smile-s2-red-team.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Header lines, above the first heading, in this form:

```
Reviewed chain: usd-factor-live-f9-dollar-smile
Reviewed document: <the file name you were given>
Reviewed version: <the version you were given, or unknown>
Reviewed sha256: <the hash you were given, or unknown>
Reviewed first heading: <the first heading of that document, verbatim>
```

Write `unknown` where a version or a hash was not supplied. Do not invent one, and do not stop because it is missing.

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
