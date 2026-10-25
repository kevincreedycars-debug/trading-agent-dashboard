# Probe specification for the USD chains, 2026-10-25

Written by the integration lane for the owner's decision of 2026-10-25: add genuinely factor-specific probes
and an abstention-cost probe. **DeepSeek's prompt lane owns the generator.** This file specifies what to change
and how it will be accepted; it changes no prompt, no probe, no catalogue entry and no factor status by itself.

## 1. Ownership, so one lane edits the generator

- Generator and prompts: `scripts/build_research_library.js`, `lib/research_prompt_templates.js` and
  `data/research-library/catalog.json` are edited **only** by the prompt lane. The integration lane does not
  touch them, and did not touch them for this specification.
- Review and acceptance: the integration lane reads the regenerated prompts, runs `npm test`, checks the
  catalogue hashes and publishes. It does not hand-edit a prompt to make a test pass.
- The prompt lane's branch is `workstream/c-research-programme` (template work at `3ab05b17`, merged at
  `5fa87ceb`). It is behind `main`, which currently carries the deployed prompt fixes (five permitted
  conclusions, no pasted briefs, the nine superseded phrases removed, the chain stage ids). **Rebase onto
  `main` before regenerating**, and keep those guards; a template that re-renders the VIX prompt at 12,190
  characters with `USD-BASELINE-AUDIT-01` and card language is the defect that was already fixed on main.
- Catalogue and cache-buster: every prompt change is one `catalog --write`, and the cache-buster moves with it
  (`20261025-research-programme-v3` today; the probe change makes it v4).

## 2. The defect being corrected

Each chain's questions are one factor-specific chain question plus the four probes of its **topic label**
(`TOPIC_MAP[].probes`). The label groups factors that do not all read the same quantity, so seven of the
twenty-five chains ask at least two questions about something they do not measure.

| Chain | Its quantity | Probes that do not fit it |
| --- | --- | --- |
| `fx.usd-session-volatility-regime` | realised volatility of the label instrument; whether to withhold a call | range position as a state variable; session momentum against the bid-ask bounce |
| `risk.usd-safe-haven-demand` | whether the dollar is bought as insurance rather than for carry | the same two |
| `risk.risk-on-off-cross-asset-state` | one risk state built from equities, credit, gold and crypto | the same two |
| `fx.usd-session-momentum` | trailing 1-day and 5-day move, continuation or fade | range position as a state variable or a start-time artefact |
| `fx.usd-overnight-range-position` | where the dollar sits in its own recent range, as a bound | session momentum against the bid-ask bounce |
| `data.quality-gate-for-abstention` | which data states force abstention, with no as-of check and no staleness test | the scheduled-release direction question; which releases matter |
| `live.f8-fed-bias` | directional read of the bias string, level vs change | which surprise measure is defensible; whether the first print is the only honest vintage |

Recorded as adjacent rather than wrong, and **not** corrected here: `live.f6-gold-delta` carries the dollar-smile
and dollar-index probes inside an index/gold/equity label, and the three deployed rates factors carry the

## 3. The mechanism to implement

Add `factor_probes` to `TOPIC_MAP`, keyed by factor id, and compose a chain's question block as:

1. the chain question (unchanged);
2. the factor's own probes from `factor_probes`, in the order written below;
3. the group probes that the factor's own probes do not contradict, in their existing order.

A chain with no `factor_probes` entry keeps exactly today's questions, so the change is additive. Removing a
group probe from one chain is a decision recorded in `factor_probes` as `drop: [<exact probe text>]`, never a
silent edit of `probes`. No sentence of the owner's wording is rewritten.

Each added probe must be answerable from the factor's own series and brief, must not restate the chain
question, and must name what would falsify an answer. Probes that only re-ask "is it informative" without
naming a comparison are rejected in review.

## 4. The exact probes to add

### `fx.usd-session-volatility-regime`
1. What value of realised volatility at the cutoff, over which lookback, is followed by sessions whose absolute
   move is large enough that a directional call should be withheld, and what share of eligible sessions is
   above that value?
2. Is that regime identifiable from data available at 05:00 Europe/London, or only after the session it is
   meant to gate?
3. In the sessions the gate would withhold, what would the withheld directional call have scored, and is the
   gate better than always calling on a coverage-matched comparison?
4. Which instrument labels these factors, given that DXY has no verified intraday source? *(group probe, kept)*
5. Does a scheduled release inside the session change the expected direction, the expected dispersion, or only
   the confidence? *(kept: volatility is the quantity this probe asks about)*

### `risk.usd-safe-haven-demand`
1. At the cutoff, which observable separates the dollar being bought as insurance from being bought for carry,
   and does that separation survive once the VIX and the risk-on/off state are already in the decision?
2. When equities fall, what is the measured sign of the next 24-hour dollar move in this session, and in which
   conditions does the sign flip?
3. Is safe-haven demand measurable at the cutoff at all without an intraday dollar index, and if not, which
   proxy is used, on what instrument and over what window?
4. Is safe-haven demand observable at the cutoff separately from risk-on/off, or is it the same input twice?
   *(group probe, kept)*
5. Which instrument labels these factors, given that DXY has no verified intraday source? *(group probe, kept)*
6. Drop: the range-position probe and the session-momentum probe.

### `risk.risk-on-off-cross-asset-state`
1. Which of equities, credit, gold and crypto carries the risk state at the cutoff, and do they disagree often

### `fx.usd-session-momentum`
1. Is the informative quantity the trailing 1-day or the 5-day move, and does the sign of the relation differ
   between them?
2. Does the continuation or fade survive the session boundary, that is, is it a London-to-London effect or an
   artefact of the 05:00 cutoff?
3. When the trailing move is small relative to the session's own recent range, is momentum still informative,
   or is the range position doing the work?
4. Does session momentum survive the bid-ask bounce of a 24-hour window, and what measurement would separate
   them? *(group probe, kept)*
5. Which instrument labels these factors, given that DXY has no verified intraday source? *(group probe, kept)*
6. Drop: the range-position probe.

### `fx.usd-overnight-range-position`
1. Is the range position informative about the size of the session move, about its direction, or about neither?
2. Which window defines the range at the cutoff, and how much does the answer change with that choice?
3. Does the range position add anything once trailing 1-day and 5-day momentum are already in the decision?
4. Is the range position a state variable or an artefact of when the session starts, and what does the start
   time do to it? *(group probe, kept)*
5. Which instrument labels these factors, given that DXY has no verified intraday source? *(group probe, kept)*
6. Drop: the session-momentum probe.

### `data.quality-gate-for-abstention`
1. Which specific collector states, missing, stale, duplicated or revised, should force abstention rather than
   a shrunk or neutral call, and what is the evidence for each threshold?
2. Without an as-of check and without a staleness test, what can be measured now about the cost of a stale
   read, and what would have to be built before the gate could be scored at all?
3. Abstention cost, stated as four numbers reported together: the share of eligible sessions that keep a call
   (coverage), the directional accuracy of those calls, what the withheld calls would have scored had they
   been made, and the accuracy and coverage of a coverage-matched comparison rule on comparable sessions, where
   comparable means the same volatility regime, calendar state and label instrument. A higher accuracy obtained
   by making fewer calls is not an improvement unless it also beats that comparison on the sessions it dropped.
4. Can an abstention rule be evaluated at all without a frozen label instrument, and what would it take?
   *(group probe, kept)*
5. Drop: the scheduled-release direction question and the "which releases matter" probe. Those belong to the
   two calendar chains, which keep them.

### `live.f8-fed-bias`
1. Is the bias string a level or a change, and which reading survives when the same words appear in two
   consecutive statements?
2. Does a hawkish-bias read at the cutoff move the dollar beyond what the front-end rate change already
   carries?
3. What would distinguish a bias read that is already priced from one that is not, at 05:00 Europe/London?
4. Drop: which surprise measure is defensible, and whether the first print is the only honest vintage. Those
   belong to `macro.release-surprise-at-first-print`, which keeps them.

   enough that one composite state hides the disagreement?
2. How much of this state is already the VIX level and change recorded by the sibling chain, and what remains
   once that is removed?
3. Does the state read at the cutoff predict the direction of the next 24-hour dollar move, or only its
   dispersion?
4. Is safe-haven demand observable at the cutoff separately from risk-on/off, or is the same input counted
   twice? *(group probe, kept)*
5. Which instrument labels these factors, given that DXY has no verified intraday source? *(group probe, kept)*
6. Drop: the range-position probe and the session-momentum probe.

"which of the eight entries" probe beside five research entries. Those prompts keep their group probes.

## 5. The abstention rule, stated once in the contract

The abstention requirement is a contract change, so `docs/research/programme/SHARED_CONTRACT.md` gains it as a
subsection of section 4, and every prompt that may conclude "withhold the call"
(`data.quality-gate-for-abstention`, `fx.usd-session-volatility-regime`, and any later chain whose stage-1
prompt offers a withholding conclusion) carries it verbatim. The rule in one sentence: **coverage, the accuracy
of the calls made, the score of the withheld calls, and a coverage-matched comparison on comparable sessions are
reported together; higher accuracy reached by skipping sessions is not an improvement unless it beats that
comparison on the sessions it skipped.**

Two further requirements for acceptance:

- the stage must say which sessions it treats as comparable, by naming the regime, calendar state and
  instrument that define them;
- a rule that cannot be scored because the label instrument is unresolved says so, and is reported as
  insufficient evidence rather than as a finding.

## 6. Guards the prompt lane adds with the change

In `tests/research_library.test.js`, alongside the guards already there:

1. every chain prompt contains every probe declared for its factor, in the declared order;
2. the seven chains above no longer contain the probes listed as dropped, and still contain the group probes
   marked kept;
3. both abstention prompts contain the four-number sentence and the definition of comparable sessions;
4. no prompt contains a claim of improved accuracy without the paired coverage statement;
5. the existing guards still pass unchanged: five permitted conclusions, nine superseded phrases absent, no
   pasted brief, prompt length inside the reviewed range.

## 7. What acceptance looks like

The prompt lane regenerates with `catalog --write`, bumps the cache-buster to v4, commits on its own branch and
hands back the new `prompt_sha256`/`prompt_bytes` for the two abstention chains and one untouched control
chain. The integration lane then runs `npm test`, diffs the regenerated prompts, confirms the catalogue hashes,
verifies the live page carries v4, and records the result. Until that happens the seven chains keep the
questions they have; nothing in this file has changed a prompt.

