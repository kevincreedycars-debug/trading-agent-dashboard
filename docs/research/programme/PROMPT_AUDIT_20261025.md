# Prompt-generator audit, 2026-10-25

This is the review of the generated USD prompt set that the delivery order asks for at step 2: integrate the
cleaned generator, then read what it produces against the shared contract rather than trusting it because it
regenerates cleanly.

## What was audited

- `scripts/build_research_library.js` - the authored chains, the shared blocks and the emitter - as the only
  source of prompt text.
- The 78 generated files: 25 factor chains x 3 stages under `docs/research/factors/usd/<slug>/`, plus the three
  final stages under `docs/research/final/usd/final-asset-analysis/`.
- `data/research-library/catalog.json` as the recorded hash and byte count of each of those files.
- The dispatched VIX brief the stage 1 prompt reproduces in full, and the final-analysis prompt as the extreme
  cases: the longest prompt is 25,490 bytes (VIX research), the shortest 12,625, the median 13,902.

## What already held

- `chains --check` and `verify` were clean before any edit, and every prompt hash matched its catalogue entry.
- Every prompt states the session as 05:00 Europe/London to 05:00 Europe/London on the next local date, the
  Monday-to-Friday start rule, the Friday-ends-Saturday consequence and the no-fill rule for a missing endpoint.
- Every prompt states the label instrument as proposed and UNVERIFIED and forbids presenting another instrument
  under the DXY name.
- Every prompt carries the prohibitions: no invented backtest, accuracy rate or sample size; no hindsight; cite
  only sources fetched in the session; shipped effects are not predictive; the deployed weights are a baseline
  to audit, never evidence; no production, workflow, dashboard, feed or database change.
- The three-stage chain and the asset gate are enforced by the store rather than described by the prompt, and a
  factor upload cannot unlock the final chain.

## The gap that was found

Both were required by the shared contract and neither was in the text. Measured across all 78 prompts and the
generator, before the fix:

| Requirement | Occurrences |
| --- | --- |
| Separation of contemporaneous association from predictive evidence | 0 - the word did not appear in any prompt or in the generator |
| Incremental value beyond existing inputs | 0 - the word did not appear in any prompt or in the generator |
| Exclusion, regime-only use or insufficient evidence named as valid conclusions | 0 - none of the three phrases appeared in any factor prompt |

The report section asked what predictive evidence exists and the red-team attacked windows and instruments, so
a careful session could still get there. That is not the same as requiring it: a report could present a
contemporaneous correlation, or an input already inside an earlier factor, as predictive evidence for our
session and still satisfy every line of the prompt as it stood.

## What changed

1. Two authored blocks were added to the generator and emitted into the prompt text.
   - **Five kinds of evidence that must not be mixed** - economic mechanism, contemporaneous association,
     predictive evidence from other windows, evidence for our exact session, incremental value beyond existing
     inputs - with the requirement that every load-bearing claim states which kind it rests on in the sentence
     that makes the claim, and that evidence counted twice is declared. Emitted into all six stage types, so all
     78 files carry it.
   - **Conclusions this stage is allowed to reach** - exclusion, regime-only use, insufficient evidence, adding
     nothing and a potentially useful input or interaction - emitted into research, adjudication and final
     analysis, the three stages where a factor's fate is decided (51 files).
2. The two red-team stages gained one attack each: a factor red-team must ask whether a mechanism, a
   contemporaneous association, another window's measurement or an existing input is being presented as our
   session's evidence, and a final red-team must check the same at asset level.
3. A guard was added to `tests/research_library.test.js`: every one of the 78 prompts must carry the five kinds,
   and the 51 deciding prompts must name all five permitted conclusions, the positive one marked unvalidated. A
   future edit that drops either block fails the suite rather than silently weakening the programme.

The prompts were regenerated with `node scripts/build_research_library.js catalog --write`, which writes the
prompt files and the catalogue hashes in the same operation. Results after regeneration: `chains --check`
reports 25 chains and 78 prompt files matching the authored chains; `verify` reports the same chain states as
before (VIX research delivered, red team awaiting a file, adjudication not started; final chain locked at
0/25); `tests/research_library.test.js` passes 30 of 30; `npm run test:research-library` passes 37 of 37
including the browser scenario.

## What did not change

No registered document, version, hash or parent link changed. The stored VIX report is still
`usd-baseline-audit-01-vix-usd-report` version 1, 84,056 bytes, sha256
`e4151937411eb1e9235c21e4942327b2d24486e405887d70a90a8f5367eb381d`. No factor status moved: 22 research ready,
3 blocked, review pending everywhere, backtest not tested everywhere. No weight, threshold, sign, live call,
workflow or data file was touched.

One consequence is worth stating plainly: the delivered VIX report was written against the pre-clean stage 1
prompt. It is not re-run for this. The cleaned stage 2 prompt now requires the red-team to test the report
against the five kinds, and if it fails that test the remedy is a supplement registered as a new version
against the report, not a silent rerun that replaces it.

## Second round, 2026-10-25: the dispatched brief inside the prompt

The owner asked for the 25,490-character VIX stage-1 prompt to be inspected for an obsolete four-step workflow,
card instructions, conflicting deliverables, contradictory recommendation restrictions and duplicated historical
material. Length alone was not treated as a fault. The inspection found five real defects, all in the two
verbatim briefs the VIX prompts embedded rather than in the authored blocks:

1. **Duplicated historical material.** The prompt restated the session, the mechanisms, the prohibited moves and
   the required return, then reproduced the whole dispatched brief - 130 lines - which restated the same things
   again. The red-team prompt did the same with its 19,048-character step-2 brief.
2. **Obsolete four-step workflow.** "This brief is step 1 of four", "the same four steps apply to them when their
   turns come", and a step-2/3/4 paragraph naming `RED_TEAM_REVIEW_BRIEF.md`,
   `SYNTHESIS_AND_CARDS_BRIEF.md` and `BACKTEST_HANDOFF_BRIEF.md` survived inside the embedded text after the
   three-stage chain had replaced that programme.
3. **Card instructions.** "A research card is step 3's output", "not a research card", and a per-card limit of
   at most two programmable hypotheses: instructions for a document this stage does not produce, and a limit the
   stage-1 report does not have.
4. **Conflicting deliverable.** The embedded brief told the reader to "upload against `USD-BASELINE-AUDIT-01`",
   a legacy task id, while the prompt's own return section says the dashboard records the chain and stage.
5. **Contradictory recommendation restriction.** The embedded brief said no change "may be proposed as part of
   the deliverable", while the outer prompt's required content includes recommending data the collector should
   record and a treatment a future engine should apply. A reader following the brief could not have returned the
   required content.

What changed: the generator now cites both briefs by path and sha256 and states that their step and card language
belongs to a workflow this chain does not use; the two requirements the outer prompt did not already carry -
primary sources and disagreement handling, and cross-asset carriers with calendar conditioning - are kept as
explicit bullets. The VIX stage-1 prompt falls from 25,290 to 16,156 characters and the stage-2 prompt from
19,048 to 13,473, with no requirement removed. A second guard now fails the suite if any of the superseded phrases
reappears in any of the 78 prompts, and the browser scenario asserts that the copied prompt cites the brief rather
than pasting it.

The briefs themselves are unchanged and still hold those sentences: they are the record of what was dispatched,
and rewriting a sent brief would falsify the record. What changed is that a prompt no longer carries one.

## What this audit does not close

- Only USD has a factor catalogue, chains and an instrument definition. EUR, GOLD, SILVER, NQ, BTC, WTI and GBP
  have nothing yet, and the prompt generator is USD-only by construction.
- The label instrument is unresolved, so no prompt can yet produce evidence for our exact session. Every stage
  prompt says so, and none of them can fix it.
- The prompts ask for incremental value; the test design that would measure it - which existing inputs it is
  incremental to, on what sample, with what decision rule - is not written anywhere in the repository.
- The flat band, the tie policy and the missing-quote policy are still unfrozen, so no candidate can be scored
  even if its prompt is answered perfectly.
- The three factors blocked on data access have no data plan in this change.

