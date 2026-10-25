# USD session momentum - fx.usd-session-momentum - USD stage 1 of 3: Research

## Assignment

- Chain: `usd-factor-fx-usd-session-momentum` on USD (US Dollar); chain kind `factor`.
- Factor: `fx.usd-session-momentum` - USD session momentum.
- Group label: `usd-topic-fx-session-structure` (Session structure, overnight range and safe-haven demand). The label groups chains; it owns no stage and this prompt is the only stage you run for it.
- Stage: 1 of 3, research. This stage returns exactly one Markdown document (report), named `usd-fx-usd-session-momentum-s1-research.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Answer one question in one report: Chain question: does `fx.usd-session-momentum` - USD session momentum - carry information about the next 24-hour dollar move, and in which quantity? Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session. Return a source-backed report that states what the evidence supports for the US Dollar session above, what it does not, and what would refute each claim, using the entries named below as the scope of evidence. The rules in force are the baseline to audit, not the target and not evidence. The report is evidence about this chain; it is not a trading rule, and nothing you return changes a live call.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this chain answers for

These are the catalogue entries this chain is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `fx.usd-session-momentum` - USD session momentum. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.
  - Published brief: `docs/research/handoff/usd/v1/packs/fx-usd-session-momentum.md` (sha256 `935d7526dd48a14efe36b0c63c2ae3e113e1e1422ef5b5be2f12151cfb422ab3`, 13922 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/session_contract_v1.json` - the session contract the cutoff and endpoint come from. sha256 `aa7c6c191e6407935b6335e941a1a66de8979f828a23e22a1f6d249b086a2757`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions about this chain

1. Chain question: does `fx.usd-session-momentum` - USD session momentum - carry information about the next 24-hour dollar move, and in which quantity? Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session.
2. Is the range position a state variable or an artefact of when the session starts, and what does the start time do to it?
3. Does session momentum survive the bid-ask bounce of a 24-hour window, and what measurement would separate them?
4. Is safe-haven demand observable at the cutoff separately from risk-on/off, or is it the same input twice?
5. Which instrument labels these factors, given that DXY has no verified intraday source?

### Questions that apply to the whole chain

6. Which entries in this chain are the same information counted twice, which one carries it, and what would tell them apart?
7. What is observable at the cutoff, what has the cutoff already absorbed, and what arrives only during the session?
8. What has actually been measured about this window with this instrument - the sample, the era, the regime and the number of independent observations - and where is the honest answer that nothing has?
9. What is the strongest contrary evidence you found, and what would refute the relation you would propose?
10. What would the test need that this repository or the collector does not have, and what sits behind a paywall?

### Questions about each entry

11. `fx.usd-session-momentum` (USD session momentum): Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (not stated), or another transform?
12. `fx.usd-session-momentum` audit: the rule in force reads No rule is in force. This is a hypothesis to be researched, not a deployed rule., with threshold none stated and lookback not stated. Is that sign, that threshold and that lookback supported for this window, and what would refute it?

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

- File name: `usd-fx-usd-session-momentum-s1-research.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Sections: exactly these, in this order, each as a `## ` heading with the exact title:

  1. `## Summary - the answer, in at most ten lines`
  2. `## What this chain asks and what this report answers`
  3. `## Evidence by entry - one subsection per entry, with its series, its publication process and the sources you read`
  4. `## What is observable at the cutoff, and what has the cutoff already absorbed`
  5. `## What the evidence supports, by entry, with the sample behind each claim`
  6. `## What the evidence does not support, and the claims it refutes`
  7. `## Overlap - which entries carry the same information twice`
  8. `## Contrary evidence, and what would refute the reading you propose`
  9. `## What could not be established, and what would establish it`
  10. `## Implications for the entries, each marked unvalidated, with the parameter that is unmeasured`
  11. `## Sources`

Keep a section that turns out to be empty, and say in one sentence why it is empty.
Do not restate these instructions, and do not add a section that summarises the prompt.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Every question in "Questions to answer" is answered, or named as unanswerable with what would settle it.
- [ ] Every entry in the inputs has a subsection in "Evidence by entry".
- [ ] Every load-bearing claim names its source and the sample behind it.
- [ ] The overlap between the entries is addressed, not assumed away.
- [ ] The report says what would refute the reading it proposes.
- [ ] Any treatment is marked unvalidated, with its unmeasured parameter named.
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

The operator supplies this file, unchanged and under the same name, to stage 2 (red-team) for the same chain. Nothing else happens to it: no engine reads it, no call changes, and the report is evidence for an adjudication, not a rule.
