# Gold coverage-022 revision 1: accepted (item B closed, item A pending its anchor)

Reviewed on 2026-09-25 by the background Central Orchestrator (a controller-locked run, a
session separate from authorship). Submission `20260925-gold-coverage-022-r1`, mailbox
SHA-256 `82b96efb17c630394f31262977d2f6ba507c9b51a7318f6bab3f207cdd80f444`, reproduced
independently from the submitted file and matching the requested hash. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-022-r1.json` (SHA-256
`44467da1ed6b6e229ca32b154f763ebc97348d17aa4632dcc1bb4f54b97c2567`). This review is a
separate session from authorship; acceptance is a checkpoint, not integration, merge,
deployment or a trading result.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `a9bb3654` (accepted 021 delivery, an
ancestor), HEAD `134e8148`, working tree clean, exactly one commit between base and HEAD.
Exactly the two disclosed changed files: `backtester/tests/gold_variable_coverage.test.js`
and the assignment-022 section of `docs/GOLD_INDIVIDUAL_VARIABLE_REPORT_PROGRESS.md`. This
is a test-and-documentation delivery; no measurement, source, rule, threshold, band,
tercile, horizon or formula changed. No accepted 005/006/008 report or registry and no
014/015/016/017/018/019/020/021 artifact is modified.

## Independent verification

- Changed file reproduces: raw `269f290d`, LF-normalised `9e6406d0`, committed blob
  `68fdfbd` carrying the LF digest with zero CR bytes; base blob `1679627d`, base raw
  `280622bd` (the base copy is already LF-only, so raw and LF coincide there). All
  disclosed values matched.
- The two deferred expectations from the 020 review are genuinely closed. Gap 1: the
  `unavailable_no_local_source ?? 0` nullish fallback is replaced by an explicit
  `hasOwnProperty === false` assertion on the class's absence, an assertion that the
  reconciled class is present, and a tally reconciliation to `declared_inventory_total`, in
  both the fixture run and the absent-source run - a dropped key can no longer pass by
  defaulting, and a dropped count fails the sum. Gap 2: the `fed_bias`
  `series_not_found_in_supplied_source` verdict now sits beside explicit key assertions on
  `registry_coverage_status`, `reason` and `series_id`, with `DFEDTARU` pinned, before the
  value comparisons.
- Focused suite re-run by the coordinator: `gold_variable_coverage.test.js` 24 of 24.
- No dependency impact: the frozen 014 manifest binds exactly eight paths (combination
  ledger, selector lib, window lib, batch registry, manifest builder, 013 audit, 013
  shortlist, protocol doc). No test file is bound, so a coverage-test change cannot move
  the accepted gate. No hash-bound registry references the changed test.
- Preserved artifacts reproduce byte-identical: frozen 013 shortlist `ffa69b30`, 013 audit
  `e7c57773`, 014 window manifest `15cd0606`, coverage declaration `c8b41e55`, revision-8
  report registry `2be6701c`, revised inventory `863c4e02`, audit v2 `1a6af31d`, the three
  sealed anchor-2 envelopes `302e4a26` / `58ece552` / `c51ad9b9` and the one immutable
  blocked attempt `e7c197f0`.
- Item A, observed only, never triggered: exactly one Gold task,
  `GoldQualificationWindowTick018`, `Ready`, action the v2 wrapper (unchanged), one `PT10M`
  trigger, `MultipleInstances` `IgnoreNew`, `StartWhenAvailable` true, both battery flags
  false, `Last Result` `0` at `19:06:01` local, zero missed runs. `tick.log` holds 72
  metadata-only blocks with `attempted 0` and an empty open set, four of them v2; the extra
  block over the reported 71 is the `19:06Z` tick that fired after the envelope, which is
  expected and consistent. Every block is metadata-only with no value words - the only
  `sign` matches are inside the word `assignment`. The evidence root still holds exactly
  four directories, and no directory exists for `2026-09-28T14:00:00.000Z|gold|entry`, so
  nothing consumed it and no provider request was made for it.
- Environment, not work: the worker's 7/7 v2 figure reproduces - with `DEEPSEEK_API_KEY`
  cleared the v2 suite is 7 of 7 - and this coordinator shell does export
  `DEEPSEEK_API_KEY`, so the in-lane capture test fails closed here with `Credential
  overbreadth refused`. The coordinator's full-suite mix therefore differs from the
  worker's: 533 tests with the five known CRLF cases (85, 86, 89, 90, 91), the
  ambient-credential fail-closed 198, and two flaky browser cases (500 `ERR_UNSAFE_PORT` on
  a random local port, 506 dashboard data-state). All are disclosed environment classes;
  none is caused by this submission. The worker worktree stayed clean after the
  coordinator's test runs.

## Decision

Accepted. Item B is closed and verified. Item A is correctly deferred: it is observation
only, its first reachable anchor is `2026-09-28T14:00:00Z` with the entry lane
`[15:00Z, 16:00Z)`, and no live entry proof can exist before that. The assignment's timing
clause covers exactly this case and the reply reopens item A at the anchor.

The coordinator answered the worker's question: deliver item A as one fresh envelope at or
after the lane close `2026-09-28T16:00:00Z`, not at `15:xxZ`, because only the post-close
envelope can show the settled state, the post-close `already_settled` tick and the final
block count, and the pre-15:00Z evidence lives in `tick.log` either way.

No new assignment is published. Item B is closed and item A is blocked only on wall-clock,
so there is nothing new to assign before the anchor, and the register status stays exactly
`instructions_published_awaiting_worker`. The precise unresolved decision remains the
user's and remains unauthorised: whether to open a fresh exploratory combination stage over
the 28 measured variables.

## Boundaries

No production, live workflow, warehouse, Layer 1, dashboard, credential, purchase,
deployment or scheduler action occurred; the installed task was read, never started,
stopped, modified or rescheduled. No hand capture, sealing, backfill, reschedule, re-attempt
or reconstruction, and no provider request for any observation at or after a closed lane.
No outcome, return, direction, sign, aggregate, qualification, accuracy or edge value was
read or computed, and evaluation stays sealed until `2027-03-25T15:00:00Z`. No research
rule, threshold, band, tercile, horizon or formula changed, no source or provider added, no
candidate space opened, no selector run and no exploratory combination stage started. The
CRLF materialisation defect was not fixed globally and no accepted file was renormalised:
that remains the assigned `backtester-spike` change request.
