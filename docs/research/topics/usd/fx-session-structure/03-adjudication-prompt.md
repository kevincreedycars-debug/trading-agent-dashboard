# Session structure, overnight range and safe-haven demand - USD stage 3 of 3: Adjudication

## Assignment

- Topic: `usd-topic-fx-session-structure` on USD (US Dollar), chain `factor`.
- Stage: 3 of 3, adjudication. This stage returns exactly one Markdown document (synthesis), named `usd-fx-session-structure-s3-adjudication.md`.
- Prompt template: `research-prompt-v3.0.0`, written 2026-10-13. The template is versioned: if a newer `research-prompt` template exists, that one governs and this file is superseded.
- This prompt is self-contained. Paste it as one message into a fresh session; nothing is sent to a model from the dashboard and no credential is attached to it.
- Asset status: active. The session is defined below and the data reachable from this repository is named with each input.
- Programme record: this topic has not been dispatched. Nothing has been returned for it, and this prompt is its first assignment.

## Objective

Decide one topic: settle every material objection against the stage 1 report and the stage 2 review for Session structure, overnight range and safe-haven demand, and return the corrected, best-supported conclusion. State what the topic rules out, what stays unresolved and what would settle it, and state a treatment of the entries only where the evidence supports one, naming every parameter that has not been measured. This stage decides on the evidence available when it is run; it does not fit, score, deploy or change a live call.

## The session and the instrument

- Session: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is `docs/research/usd-session/v1/session_contract_v1.json`.
- Label instrument: DXY, and UNVERIFIED. No intraday dollar-index print exists in this repository or in the live collector, and no quote source is committed. If a claim is really about EUR/USD, a basket, the broad trade-weighted index or a futures contract, name that instrument in the same sentence and say what its window is.
- The deployed engine is not this window: it cuts off at 09:30 America/New_York and ends at the next 16:00 ET close, a median 30.5 elapsed hours. It overlaps this session for about 14.5 nominal hours and leaves the session's first 9.5 hours unmeasured. Say which window every number belongs to.
- The window is closed to later information: a value published after 05:00 London, or a revision published later, may not be used as what was known at the cutoff.

## Inputs

### The factor entries this topic answers for

These are the catalogue entries this topic is evidence for. They are context to audit, never evidence for a claim, and never the scope limit of the assignment.

- `fx.usd-session-momentum` - USD session momentum. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: Trailing 1-day and 5-day move in the label instrument, read at the cutoff: continuation or fade inside the 24-hour London-to-London session.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.
  - Published brief: `docs/research/handoff/usd/v1/packs/fx-usd-session-momentum.md` (sha256 `935d7526dd48a14efe36b0c63c2ae3e113e1e1422ef5b5be2f12151cfb422ab3`, 13922 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `fx.usd-overnight-range-position` - USD overnight range position. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: Where the dollar sits in its own recent range at the cutoff, as a bound on the session move rather than a directional call.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.
  - Published brief: `docs/research/handoff/usd/v1/packs/fx-usd-overnight-range-position.md` (sha256 `d32df302f92a09668870532962d0a5158c32ad677102b0a12c330abe251546f6`, 13747 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `fx.usd-session-volatility-regime` - USD session volatility regime. Role: abstention gate. Group: research_session_v1. Research status: ready.
  - What the entry stands for: Realised volatility of the label instrument and the effect of that regime on the expected move and on whether a call should be withheld.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.
  - Published brief: `docs/research/handoff/usd/v1/packs/fx-usd-session-volatility-regime.md` (sha256 `7dfbdad10c7123852faa60d1782c458039aa5d34cff219c9d068d17fd1e268fc`, 13667 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `risk.usd-safe-haven-demand` - USD safe-haven demand. Role: direction. Group: research_session_v1. Research status: ready.
  - What the entry stands for: Whether the dollar is being bought as insurance rather than for carry, which changes the sign of the same risk move.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: Price and risk package USD-SESSION-A1.
  - Published brief: `docs/research/handoff/usd/v1/packs/risk-usd-safe-haven-demand.md` (sha256 `27973f50f27a6f4a23dd6fe555b1e99b7da479c3530355953a0beccf2192ab95`, 13567 bytes). Read it with this prompt if it is attached; the questions below stand without it.
- `risk.risk-on-off-cross-asset-state` - Risk-on and risk-off cross-asset state. Role: regime. Group: research_session_v1. Research status: ready.
  - What the entry stands for: Equities, credit, gold and crypto at the cutoff as one risk state, with the double-counting risk against the VIX card named explicitly.
  - Rule in force today, the baseline to audit and never evidence: No rule is in force. This is a hypothesis to be researched, not a deployed rule..
  - Series the collector reads: FRED credit and equity series in the closed study dataset; Coinbase spot quotes; Price and risk package USD-SESSION-A1.
  - Published brief: `docs/research/handoff/usd/v1/packs/risk-risk-on-off-cross-asset-state.md` (sha256 `628dd20a05d23d1901fd4728e5fbaf0a9b607efac31e6537c51bb0b78be83a46`, 13829 bytes). Read it with this prompt if it is attached; the questions below stand without it.

### Documents you are given

Supplied by the operator. Record the file name and the first heading of each document you judge in the header lines your deliverable asks for. If either is clearly another topic or another stage, stop and say so.

- `usd-fx-session-structure-s1-research.md` - the stage 1 research report for this topic, supplied by the operator. As supplied: version `unknown`, sha256 `unknown`.
- `usd-fx-session-structure-s2-red-team.md` - the stage 2 red-team review of that report, supplied by the operator. As supplied: version `unknown`, sha256 `unknown`.

### Documents in this checkout

Each line names a file, the part of it that matters, its hash and what it is for. If a file is not attached to this message, answer from this prompt and say which files you could not open.

- `docs/research/usd-session/v1/session_contract_v1.json` - the session contract the cutoff and endpoint come from. sha256 `aa7c6c191e6407935b6335e941a1a66de8979f828a23e22a1f6d249b086a2757`.

## Questions to answer

Answer every question below, in order. Where the evidence does not exist, write that and what would settle it: an honest "not answerable from the sources I can reach" is a complete answer, a guess is not.

### Questions to decide, finding by finding

1. For each material objection: do the two documents and the sources you fetch decide it, or does it stay open?
2. Where the report and the review agree, do they rest on the same source - and if so, is that agreement evidence, or one source counted twice?
3. Which conclusion survives in corrected form, and exactly what changed in it?
4. Which objection is rejected, and what is wrong with it?
5. Which claim stays unresolved, and what measurement would settle it?
6. Is any proposed treatment computable from the data named in this prompt, and which of its parameters have not been measured?
7. Does the proposed treatment count one input twice across entries or topics, and if so, which topic owns it?
8. What must the asset synthesis decide that this topic cannot?

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

- File name: `usd-fx-session-structure-s3-adjudication.md`. Copy it exactly: the library records the name it receives and matches it to the prompt that asked for it.
- Format: one Markdown file. No JSON, no zip, no PDF, no spreadsheet, no second file, no separate sources note, no filled-in card.
- Length: as long as the material needs, and no longer. A short file that answers every question beats a long one that answers some.
- Header lines, above the first heading, in this form:

```
Reviewed topic: usd-topic-fx-session-structure
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
  4. `## The conclusion for this topic, in corrected form`
  5. `## What the evidence supports, by entry, with the sample behind each claim`
  6. `## What this topic rules out`
  7. `## Unresolved items, and the measurement that would settle each`
  8. `## Proposed treatment, if the evidence supports one, with every unvalidated parameter named`
  9. `## Ownership of inputs that overlap another topic`
  10. `## What the asset synthesis must decide that this topic cannot`
  11. `## Sources`

Keep a section that turns out to be empty, and say in one sentence why it is empty.
Do not restate these instructions, and do not add a section that summarises the prompt.

## Completion checklist

Walk this list before you return the file. A "no" means the file is not ready.

- [ ] Every material objection from the review has a decision.
- [ ] Every decision names the evidence it rests on.
- [ ] Agreement between the two documents that rests on one source is identified as such.
- [ ] The corrected conclusion can be used without reading either input document.
- [ ] Every unresolved item carries the measurement that would settle it.
- [ ] Any treatment names its unmeasured parameters and the topic that owns each overlapping input.
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

The adjudication becomes the record for this topic. It is the input to the asset synthesis chain, which reconciles the topics into one candidate model and one validation plan. Nothing is fitted or deployed at this step, and a treatment named here stays unvalidated until that plan runs and is itself reviewed.
