# Research lane report, 2026-10-25 - the twenty-five stage-1 prompts read as questions

Lane `research-coordinator`, deliverable 1. This is a reading of the questions the prompts ask, not a rewrite.
Nothing here changes a prompt, the catalogue or a factor status: the owner's questions are reported on, and
where a question is attached to the wrong factor the proposal is a mechanism for the owner to accept or refuse.

## Method

1. Read the question block of all twenty-five stage-1 prompts, the two prompts that carried a dispatched brief in
   full (VIX stages 1 and 2), and the stage-2 and stage-3 texts where a claim about them is made. The structure is
   identical across the six stage types, so the reading concentrates on the part that differs per factor: the
   `## Questions for this factor` block, which is the chain question plus the four probes of the factor's topic
   label.
2. Compared each chain's questions against its own factor entry - label, role, brief, rule in force, series -
   and against `SHARED_CONTRACT.md` sections 3 and 4.
3. Read the two prompts that were carrying a dispatched brief (VIX stage 1 and stage 2) against the three-stage
   contract. That reading found defects and they are fixed on main; section 1 records what they were, because the
   same class of defect is what this lane exists to catch.

## 1. Brief duplication - found, fixed, and now guarded

The stage-1 prompt carried the dispatched brief verbatim and the stage-2 prompt carried the step-2 brief
verbatim. Inside those copies survived a four-step workflow ("step 1 of four", the step-2/3/4 paragraph naming
`RED_TEAM_REVIEW_BRIEF.md`, `SYNTHESIS_AND_CARDS_BRIEF.md` and `BACKTEST_HANDOFF_BRIEF.md`), card instructions
("a research card is step 3's output", a per-card limit of two programmable hypotheses), a deliverable that named
`USD-BASELINE-AUDIT-01` instead of the chain stage, and one sentence - none of this "may be proposed as part of
the deliverable" - that contradicted the required content in the same prompt. Both prompts now cite their brief by
path and sha256 and say its step language belongs to a workflow this chain does not use. Stage 1: 25,290 to
16,156 characters. Stage 2: 19,048 to 13,473. No requirement removed; the two requirements only the brief carried
(primary sources with disagreement handling, cross-asset carriers with calendar conditioning) are explicit.
Guards: `tests/research_library.test.js` fails if any of nine superseded phrases returns to any of the 78 prompts,
and the browser scenario fails if the copied prompt pastes the brief instead of citing it.

## 2. Probes are attached per topic label, so they do not always belong to the factor

The generator gives every chain one chain question plus the four probes of its topic label
(`TOPIC_MAP[].probes` in `scripts/build_research_library.js`). The chain question is factor-specific; the four
probes are not. Seven of the twenty-five chains therefore carry at least two questions about a quantity they do
not read:

| Chain | Probes that do not fit the factor | Why |
| --- | --- | --- |
| `fx.usd-session-volatility-regime` | "Is the range position a state variable...", "Does session momentum survive the bid-ask bounce..." | Its quantity is realised volatility of the label instrument and whether a call should be withheld; neither probe mentions volatility |
| `risk.usd-safe-haven-demand` | the same two | Its quantity is whether the dollar is bought as insurance rather than for carry |
| `risk.risk-on-off-cross-asset-state` | the same two | Its quantity is one risk state built from equities, credit, gold and crypto |
| `fx.usd-session-momentum` | "Is the range position a state variable or an artefact of when the session starts..." | Its quantity is the trailing 1-day and 5-day move, not its position in the range |
| `fx.usd-overnight-range-position` | "Does session momentum survive the bid-ask bounce..." | Partly relevant - the bounce matters - but momentum is not the quantity |
| `data.quality-gate-for-abstention` | "Does a scheduled release inside the session change the expected direction...", "Which releases matter for the dollar over this window..." | Its quantity is which data states should force abstention, given no as-of check and no staleness test; release selection is a different factor's question |
| `live.f8-fed-bias` | "Which surprise measure is defensible...", "Is the first print the only honest vintage..." | Bias is not a surprise print; the vintage question belongs to the surprise factor |

Two more are adjacent rather than wrong, and are recorded as such: `live.f6-gold-delta` carries the dollar-smile
and "which dollar index" probes inside the index/gold/equity label, and the three deployed rates factors carry the
"which of the eight entries" probe alongside five research entries - true of the group, not of the chain.

None of the owner's wording is rewritten. The proposal, for the owner to accept or refuse, is a `factor_probes`
override in `TOPIC_MAP` that appends factor-specific probes without removing the group's: a chain would get its
chain question, its own probes, then the group probes it does not contradict. That is a generator change with a
guard, not an edit to the questions.

## 3. What is missing rather than wrong

- **The cost of abstaining is never asked.** `data.quality-gate-for-abstention` and
  `fx.usd-session-volatility-regime` are both abstention gates, and both prompts ask when to abstain but neither
  asks what abstaining costs when the withheld call would have been right. An abstention rule that is never
  scored that way cannot be justified by research.
- **Five chains cannot answer their own instrument question.** Every chain in the FX session-structure label
  carries "Which instrument labels these factors, given that DXY has no verified intraday source?", and the
  answer is that the label instrument is unresolved. That is correct behaviour, not a defect: the prompt says so,
  and `LABEL_INSTRUMENT_OPTIONS.md` in this folder records the candidate instruments and what each can and cannot
  label. No chain claims to have measured the session until that is decided.
- **The two VIX chains overlap by construction.** `live.f1-vix-level` and `risk.vix-level-and-change-at-cutoff`
  sit in the same label and share all four probes, and the sibling's chain question already fixes the quantity as
  "level and change read as regime" while probe 1 asks which quantity is informative. That is a wording tension,
  not a contradiction: the report can answer probe 1 and override the chain question's assumption, and the
  evidence kind block requires it to say which kind it is doing.

## 4. What is sound

- Every chain question asks "in which quantity" and names the factor's own series, so a report cannot answer a
  different factor's question by accident.
- The five evidence kinds and the five permitted conclusions are in all 78 prompts, and a positive finding is
  one of them, marked unvalidated.
- The deployed rules are present as context to audit in every prompt that has one, with the instruction not to
  defend them, and the unresolved label is stated in the same prompt rather than in a document the reader may
  not open.
- The VIX stage-1 prompt names the report that already exists under its own chain, so that report's status
  (delivered, v1) cannot be mistaken for the sibling chain's.

## What this report does not do

No prompt was rewritten, no probe added or removed, no factor status moved and no catalogue regenerated. The two
proposals above - per-factor probes, and an abstention-cost question - are for the owner to accept or refuse, and
if accepted they are a generator change with a guard test, in this lane, on this branch.

