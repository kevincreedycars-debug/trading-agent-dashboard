# US front-end rates, real yields and curve position - USD stage 1 of 3: Research

## Assignment

- Topic: `usd-topic-front-end-rates` on USD (US Dollar), chain `factor`.
- Stage: 1 of 3, research. This stage returns exactly one Markdown document (report), named `usd-front-end-rates-s1-research.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this topic has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Answer one question in one report: Do front-end rate changes, real yields, the US-DE spread and curve or credit measures carry information about the next 24-hour dollar move that is not already in the other entries of this topic, at the level or in a delta? Return a source-backed report that states what the evidence supports for the US Dollar session above, what it does not, and what would refute each claim, using the entries named below as the scope of evidence. The rules in force are the baseline to audit, not the target and not evidence. The report is evidence about this topic; it is not a trading rule, and nothing you return changes a live call.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this topic answers for

These are the catalogue entries this topic is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `live.f2-us-2y-delta` - F2 US 2Y yield delta. Role: direction. Group: live_engine. Research status: ready.
  - What the entry stands for: Change in the US 2Y yield as a policy-expectation proxy.
  - Rule in force today, the baseline to audit and never evidence: 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH.
  - Threshold: +/- 5 bps. Lookback: 5 days on the 24h timeframe.
  - Series the collector reads: FRED DGS2.
  - Published brief: `docs/research/handoff/usd/v1/packs/f2-us-2y-delta.md` (sha256 `1f6593c81175ce0ca3675d77dab14bb7397b03235df48523ffdb24ac7e785121`, 14443 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `live.f3-us-de-2y-spread-delta` - F3 US-DE 2Y spread delta. Role: direction. Group: live_engine. Research status: ready.
  - What the entry stands for: Change in the US minus German 2Y spread, derived in the collector from two series.
  - Rule in force today, the baseline to audit and never evidence: 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH.
  - Threshold: +/- 5 bps. Lookback: 5 days on the 24h timeframe.
  - Series the collector reads: FRED DGS2; Bundesbank BBSSY 2Y CSV.
  - Published brief: `docs/research/handoff/usd/v1/packs/f3-us-de-2y-spread-delta.md` (sha256 `0d2f81ba66be7a6efea703673373c106ecb4d51362d681d9acdc59f1d5f3ccb4`, 15483 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `live.f4-real-yield-delta` - F4 US 10Y real yield delta. Role: direction. Group: live_engine. Research status: ready.
  - What the entry stands for: Change in the 10Y TIPS real yield.
  - Rule in force today, the baseline to audit and never evidence: 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH.
  - Threshold: +/- 5 bps. Lookback: 5 days on the 24h timeframe.
  - Series the collector reads: FRED DFII10.
  - Published brief: `docs/research/handoff/usd/v1/packs/f4-real-yield-delta.md` (sha256 `d728e0beca019ed1dd268b1e7d49b820b2127aef5e26cada7367519c5f11aecd`, 15578 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `rates.us-front-end-delta` - US front-end delta. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: 2Y and 3M yield changes as policy-expectation proxies, with the publication lag of each series stated.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED DGS2 and DTB3 via the closed study dataset; Rates package USD-SESSION-A2.
  - Published brief: `docs/research/handoff/usd/v1/packs/rates-us-front-end-delta.md` (sha256 `5d18fd2985d28f3139e1d9440ba73e1644ab96bdb46a094737b5f734408514aa`, 13425 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `rates.relative-front-end-delta` - Relative front-end delta. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: US against German and other G10 front ends, with each euro-area and UK leg named rather than implied.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Bundesbank 2Y series; Rates package USD-SESSION-A2.
  - Published brief: `docs/research/handoff/usd/v1/packs/rates-relative-front-end-delta.md` (sha256 `63d9f1d934b160314332f6b955ef84adca0df19bdf6cdbc19af881006c82f751`, 13396 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `rates.real-yield-delta` - Real yield delta. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: 10Y and 5Y real yields and the breakeven split, separating the nominal and inflation parts of the move.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED DFII10 and T10YIE; Rates package USD-SESSION-A2.
  - Published brief: `docs/research/handoff/usd/v1/packs/rates-real-yield-delta.md` (sha256 `b39eadc79f2491816719419702cfa4aff99ac731af1ae60ffd8aac12bbf810cb`, 13543 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `rates.term-premium-and-curve` - Term premium and curve. Role: regime. Group: research_session_v1. Research status: ready.
  - What the entry stands for: 10Y minus 2Y slope, and whether the level or the change carries information across the session.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED DGS10 and DGS2; Rates package USD-SESSION-A2.
  - Published brief: `docs/research/handoff/usd/v1/packs/rates-term-premium-and-curve.md` (sha256 `2ee7eb05d33b841438982367fc253aa7662db158dcd1fa855ad24849a15ab96b`, 13337 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `rates.credit-spread-delta` - Credit spread delta. Role: regime. Group: research_session_v1. Research status: ready.
  - What the entry stands for: High-yield spread change as a growth and risk proxy, with its overlap against the cross-asset risk card bounded.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED high-yield spread series; Rates package USD-SESSION-A2.
  - Published brief: `docs/research/handoff/usd/v1/packs/rates-credit-spread-delta.md` (sha256 `9ed5e0a650fc0d974158ca15c4869a0829bc47de2d3ff2cb7380547b35941513`, 13470 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/weight_vector_discrepancy.md` - the two live weight vectors and where each is used. sha256 `2f420763193b0a032ccd38c1958563cd848c942f7cf49b53cad8de0ad98535cc`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions about this topic

1. Which of the eight entries is measuring something the others do not, and which pairs are the same information counted twice?
2. Is the informative quantity the level, a five-day change or a same-session change, and does the answer depend on the policy cycle?
3. Does a real-yield change add information beyond the nominal front end, and does that survive the inflation-expectation measurement problem?
4. Are these relations already in the dollar by 05:00 Europe/London, given that the US cash market is closed at the cutoff?

### Questions that apply to the whole topic

5. Which entries in this topic are the same information counted twice, which one carries it, and what would tell them apart?
6. What is observable at the cutoff, what has the cutoff already absorbed, and what arrives only during the session?
7. What has actually been measured about this window with this instrument - the sample, the era, the regime and the number of independent observations - and where is the honest answer that nothing has?
8. What is the strongest contrary evidence you found, and what would refute the relation you would propose?
9. What would the test need that this repository or the collector does not have, and what sits behind a paywall?

### Questions about each entry

10. `live.f2-us-2y-delta` (F2 US 2Y yield delta): Change in the US 2Y yield as a policy-expectation proxy. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (5 days on the 24h timeframe), or another transform?
11. `live.f2-us-2y-delta` audit: the rule in force reads 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH, with threshold +/- 5 bps and lookback 5 days on the 24h timeframe. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
12. `live.f3-us-de-2y-spread-delta` (F3 US-DE 2Y spread delta): Change in the US minus German 2Y spread, derived in the collector from two series. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (5 days on the 24h timeframe), or another transform?
13. `live.f3-us-de-2y-spread-delta` audit: the rule in force reads 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH, with threshold +/- 5 bps and lookback 5 days on the 24h timeframe. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
14. `live.f4-real-yield-delta` (F4 US 10Y real yield delta): Change in the 10Y TIPS real yield. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (5 days on the 24h timeframe), or another transform?
15. `live.f4-real-yield-delta` audit: the rule in force reads 5-day change at or above +5 bps reads BULLISH, at or below -5 bps BEARISH, with threshold +/- 5 bps and lookback 5 days on the 24h timeframe. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
16. `rates.us-front-end-delta` (US front-end delta): 2Y and 3M yield changes as policy-expectation proxies, with the publication lag of each series stated. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (not stated), or another transform?
17. `rates.us-front-end-delta` audit: the rule in force reads No rule is in force. This is a hypothesis to be researched, not a deployed rule., with threshold none stated and lookback not stated. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
18. `rates.relative-front-end-delta` (Relative front-end delta): US against German and other G10 front ends, with each euro-area and UK leg named rather than implied. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (not stated), or another transform?
19. `rates.relative-front-end-delta` audit: the rule in force reads No rule is in force. This is a hypothesis to be researched, not a deployed rule., with threshold none stated and lookback not stated. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
20. `rates.real-yield-delta` (Real yield delta): 10Y and 5Y real yields and the breakeven split, separating the nominal and inflation parts of the move. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (not stated), or another transform?
21. `rates.real-yield-delta` audit: the rule in force reads No rule is in force. This is a hypothesis to be researched, not a deployed rule., with threshold none stated and lookback not stated. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
22. `rates.term-premium-and-curve` (Term premium and curve): 10Y minus 2Y slope, and whether the level or the change carries information across the session. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (not stated), or another transform?
23. `rates.term-premium-and-curve` audit: the rule in force reads No rule is in force. This is a hypothesis to be researched, not a deployed rule., with threshold none stated and lookback not stated. Is that sign, that threshold and that lookback supported for this window, and what would refute it?
24. `rates.credit-spread-delta` (Credit spread delta): High-yield spread change as a growth and risk proxy, with its overlap against the cross-asset risk card bounded. What does it measure, from which series and which publication process, with what lag and revision practice - and is the informative quantity the level, the recorded lookback measure (not stated), or another transform?
25. `rates.credit-spread-delta` audit: the rule in force reads No rule is in force. This is a hypothesis to be researched, not a deployed rule., with threshold none stated and lookback not stated. Is that sign, that threshold and that lookback supported for this window, and what would refute it?

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

- File name: `usd-front-end-rates-s1-research.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
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
