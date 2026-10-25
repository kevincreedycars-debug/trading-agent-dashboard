# F9 Dollar Smile regime - live.f9-dollar-smile - stage 1 of 3: Research

## Assignment

- Chain: `usd-factor-live-f9-dollar-smile` on USD (US Dollar); chain kind `factor`.
- Factor: `live.f9-dollar-smile` - F9 Dollar Smile regime.
- Group label: `usd-topic-dollar-index-gold-and-equities` (Dollar index, gold and equity-against-USD relations). The label groups chains; it owns no stage and this prompt is the only stage you run for it.
- Stage: 1 of 3, research. This stage returns exactly one Markdown document (report), named `usd-live-f9-dollar-smile-s1-research.md`.
- Prompt template: `research-prompt-v3.1.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this chain has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Answer one question in one report: Chain question: does `live.f9-dollar-smile` - F9 Dollar Smile regime - carry information about the next 24-hour dollar move, and in which quantity? The smile regime read from the VIX level and the bias string. Return a source-backed report that states what the evidence supports for the US Dollar session above, what it does not, and what would refute each claim, using the entries named below as the scope of evidence. The rules in force are the baseline to audit, not the target and not evidence. The report is evidence about this chain; it is not a trading rule, and nothing you return changes a live call.

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

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/target_source_assessment.md` - DXY and intraday source coverage, access and cost. sha256 `078f8951777b782643b0aa4d1a87ba82b1beede0128f2e43cf2b5faeed1277da`.

## What the report must cover

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions about this chain

1. Chain question: does `live.f9-dollar-smile` - F9 Dollar Smile regime - carry information about the next 24-hour dollar move, and in which quantity? The smile regime read from the VIX level and the bias string.
2. Is the dollar smile a measured relation in this window or a descriptive story, and what observation would falsify it?
3. The deployed reading uses the VIX 25/16 pair and the bias string: are those the right variables, and does the smile need a third state such as global growth or funding stress that neither captures?
4. Is the smile a regime variable that should switch other factors signs, or a separate directional factor, and can those two roles be told apart with session data?
5. Does the smile add anything to the VIX level and the cross-asset risk state it is computed from, and is the rulebook weight of 12 defensible against the coded 1?
6. Which dollar index is a claim actually about, and does the answer change with the index construction?
7. Are gold and equities independent evidence for the dollar, or the same risk factor counted twice?

### Questions that apply to the whole chain

8. Which entries in this chain are the same information counted twice, which one carries it, and what would tell them apart?
9. What is observable at the cutoff, what has the cutoff already absorbed, and what arrives only during the session?
10. What has actually been measured about this window with this instrument - the sample, the era, the regime and the number of independent observations - and where is the honest answer that nothing has?
11. What is the strongest contrary evidence you found, and what would refute the relation you would propose?
12. What would the test need that this repository or the collector does not have, and what sits behind a paywall?

### Questions about each entry

13. `live.f9-dollar-smile` (F9 Dollar Smile regime): The smile regime read from the VIX level and the bias string. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (level), or another transform?
14. `live.f9-dollar-smile` audit: the rule in force reads VIX above 25 reads BULLISH; VIX below 16 and not hawkish reads BEARISH, with threshold 25 / 16 and lookback level. Is that sign, that threshold and that lookback supported for this window, and what would refute it?

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

## Conclusions this stage is allowed to reach

- **Exclusion** - the evidence may support leaving this factor out of the decision entirely.
- **Regime-only use** - the evidence may support using it only in a named regime, and only where that regime is identifiable at the cutoff.
- **Insufficient evidence** - where nothing has been measured for this session, saying so is the correct return; the remedy is a measurement or a supplement, never a stronger claim.
- **Adding nothing** - a factor whose information is already in the inputs before it earns no weight. More factors are not assumed to improve accuracy, and improved accuracy is only ever an empirical result.
- **A potentially useful input or interaction** - the evidence may support a directional input, or a pair whose interaction carries information, as worth testing further. State the sign, the condition, the window it was evidenced on and the measurement that would validate it, and mark it unvalidated: this stage can support a candidate, never a confirmation.

## What the report must contain

The file must contain exactly these sections, in this order, each as a `## ` heading with the exact title:

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

## What to return

Return exactly one Markdown file and nothing else.

- File name: `usd-live-f9-dollar-smile-s1-research.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Every question in the questions section is answered, or named as unanswerable with what would settle it.
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
