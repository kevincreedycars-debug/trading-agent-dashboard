# Dollar index, gold and equity-against-USD relations - USD stage 1 of 3: Research

## Assignment

- Topic: `usd-topic-dollar-index-gold-and-equities` on USD (US Dollar), chain `factor`.
- Stage: 1 of 3, research. This stage returns exactly one Markdown document (report), named `usd-dollar-index-gold-and-equities-s1-research.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this topic has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Answer one question in one report: Do the dollar index delta, gold and equity moves carry information about the next 24-hour dollar move that is independent of the risk appetite the other topics measure, or do they restate it? Return a source-backed report that states what the evidence supports for the US Dollar session above, what it does not, and what would refute each claim, using the entries named below as the scope of evidence. The rules in force are the baseline to audit, not the target and not evidence. The report is evidence about this topic; it is not a trading rule, and nothing you return changes a live call.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this topic answers for

These are the catalogue entries this topic is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `live.f5-dxy-delta` - F5 DXY delta. Role: direction. Group: live_engine. Research status: ready.
  - What the entry stands for: Trailing change in the dollar index the collector stores as dxy_level (FRED DTWEXBGS), with a d1 to d5 to d20 substitution ladder.
  - Rule in force today, the baseline to audit and never evidence: 1-day change at or above +0.15% reads BULLISH, at or below -0.15% BEARISH; falls back d1 then d5 then d20 and records only a warning string.
  - Threshold: +/- 0.15%. Lookback: 1 day on the 24h timeframe.
  - Series the collector reads: FRED DTWEXBGS.
  - Published brief: `docs/research/handoff/usd/v1/packs/f5-dxy-delta.md` (sha256 `d7cb348a11a4eb5c60b703e42e5c5f09c5ec4b48e3fecee56036d9d08394fc8f`, 16687 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `live.f6-gold-delta` - F6 Gold delta. Role: direction. Group: live_engine. Research status: ready.
  - What the entry stands for: Gold move as an inverse dollar-risk read.
  - Rule in force today, the baseline to audit and never evidence: at or below -0.1% reads BULLISH, above +0.1% BEARISH; falls back from 5-day to 1-day and records only a warning string.
  - Threshold: +/- 0.1%. Lookback: 5 days, 1-day fallback.
  - Series the collector reads: Coinbase XAU-USD spot.
  - Published brief: `docs/research/handoff/usd/v1/packs/f6-gold-delta.md` (sha256 `a52d73415b8684085e4b8d4642615409f759bc34059364e178b0e37c8e3b177a`, 16529 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `live.f9-dollar-smile` - F9 Dollar Smile regime. Role: regime context. Group: live_engine. Research status: ready.
  - What the entry stands for: The smile regime read from the VIX level and the bias string.
  - Rule in force today, the baseline to audit and never evidence: VIX above 25 reads BULLISH; VIX below 16 and not hawkish reads BEARISH.
  - Threshold: 25 / 16. Lookback: level.
  - Series the collector reads: FRED VIXCLS; the collector bias string.
  - Published brief: `docs/research/handoff/usd/v1/packs/f9-dollar-smile.md` (sha256 `e90bdc5b62bfb8b736b3329d029c39ef4e79056cb7043b6ea1545ec8d7460102`, 16586 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `live.f10-equity-versus-usd` - F10 Equity versus USD. Role: regime context. Group: live_engine. Research status: ready.
  - What the entry stands for: Cross-asset read of equities against the dollar, gated by the VIX regime.
  - Rule in force today, the baseline to audit and never evidence: VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH.
  - Threshold: 16 / 25. Lookback: NQ 1 day.
  - Series the collector reads: Alpha Vantage GLOBAL_QUOTE on QQQ.
  - Published brief: `docs/research/handoff/usd/v1/packs/f10-equity-versus-usd.md` (sha256 `d3dadf1c7ee18b656a7a955148364ed9dd953840c599c0907591d53eaadddb55`, 16835 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/target_source_assessment.md` - DXY and intraday source coverage, access and cost. sha256 `078f8951777b782643b0aa4d1a87ba82b1beede0128f2e43cf2b5faeed1277da`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions about this topic

1. Is the dollar smile a measured relation for this window, or a descriptive convenience: what would falsify it?
2. Which dollar index is a claim actually about, and does the answer change with the index construction?
3. Does a same-day dollar move followed by a session direction suggest mean reversion or continuation, and on what evidence?
4. Are gold and equities independent evidence for the dollar, or the same risk factor counted twice?

### Questions that apply to the whole topic

5. Which entries in this topic are the same information counted twice, which one carries it, and what would tell them apart?
6. What is observable at the cutoff, what has the cutoff already absorbed, and what arrives only during the session?
7. What has actually been measured about this window with this instrument - the sample, the era, the regime and the number of independent observations - and where is the honest answer that nothing has?
8. What is the strongest contrary evidence you found, and what would refute the relation you would propose?
9. What would the test need that this repository or the collector does not have, and what sits behind a paywall?

### Questions about each entry

10. `live.f5-dxy-delta` (F5 DXY delta): Trailing change in the dollar index the collector stores as dxy_level (FRED DTWEXBGS), with a d1 to d5 to d20 substitution ladder. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (1 day on the 24h timeframe), or another transform?
11. `live.f5-dxy-delta` audit: the rule in force reads 1-day change at or above +0.15% reads BULLISH, at or below -0.15% BEARISH; falls back d1 then d5 then d20 and records only a warning string, with threshold +/- 0.15% and lookback 1 day on the 24h timeframe. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
12. `live.f6-gold-delta` (F6 Gold delta): Gold move as an inverse dollar-risk read. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (5 days, 1-day fallback), or another transform?
13. `live.f6-gold-delta` audit: the rule in force reads at or below -0.1% reads BULLISH, above +0.1% BEARISH; falls back from 5-day to 1-day and records only a warning string, with threshold +/- 0.1% and lookback 5 days, 1-day fallback. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
14. `live.f9-dollar-smile` (F9 Dollar Smile regime): The smile regime read from the VIX level and the bias string. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (level), or another transform?
15. `live.f9-dollar-smile` audit: the rule in force reads VIX above 25 reads BULLISH; VIX below 16 and not hawkish reads BEARISH, with threshold 25 / 16 and lookback level. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
16. `live.f10-equity-versus-usd` (F10 Equity versus USD): Cross-asset read of equities against the dollar, gated by the VIX regime. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (NQ 1 day), or another transform?
17. `live.f10-equity-versus-usd` audit: the rule in force reads VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH, with threshold 16 / 25 and lookback NQ 1 day. Is that sign, that threshold and that lookback supported for this window, and what would refute it?

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

- File name: `usd-dollar-index-gold-and-equities-s1-research.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Sections: exactly these, in this order, each as a `## ` heading with the exact title:

  1. `## Summary - the answer, in at most ten lines`
  2. `## What this topic asks and what this report answers`
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

The operator supplies this file, unchanged and under the same name, to stage 2 (red-team) for the same topic. Nothing else happens to it: no engine reads it, no call changes, and the report is evidence for an adjudication, not a rule.
