# Gold coverage-023 revision 1: declaration accepted, blocker upheld, continuation published

Reviewed on 2026-09-25 by the background Central Orchestrator (a controller-locked run, a session separate
from authorship). Submission `20260925-gold-coverage-023-r1`, status `blocked`, mailbox SHA-256
`fae926bb9305277f75764885dd0a47d91cb5bdeffa5747adbadf9713434f5bbb`, reproduced independently from the
submitted file and equal to the requested hash. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-023-r1.json` (SHA-256
`bd2caf4f6cab73863baf9518e1fba595dfcb9887486390ebc7ce8bbdb6516253`). Acceptance here is a
checkpoint for the delivered declaration, not integration, merge, deployment or a trading result. This
review is a separate session from authorship.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `134e8148` (accepted 022 delivery, verified an ancestor),
HEAD `6fd501a7`, working tree clean, exactly two commits between base and HEAD in the declared order:
`5fe48767` (the declaration, committed before any candidate was evaluated) then `6fd501a7` (the additive
harness repair). Exactly the four disclosed files changed, and no other file in the worktree is modified:

- `backtester/registries/gold_combination_batch_daily_h24_and.v2.json` (new declaration, 5548 lines)
- `backtester/scripts/run_gold_combination_batch.js` (additive)
- `backtester/tests/gold_combination_batch_v2.test.js` (new focused tests)
- `backtester/lib/gold_combination_rows.js` (repair of the series-rules argument)

## Independent verification of the delivered declaration

- Registry digest reproduced: raw = LF = `c19315e696e9e1a7ef6dd35725b949f6037e2d3c47d566093f1eb83e7b6d058a`
  with zero CR bytes, which is also the second key of the runner's `APPROVED_REGISTRIES` map.
- Candidate list digest re-derived by the harness convention (`sha256(candidates.join('\n'))`):
  `db96c728d597b59f274f0e2b2b2d64f105f029a4e8508fb3ada1e946923c7c15`, equal to the declaration.
- Counts re-derived independently from the declared atom table and the candidate list, not from the report
  text: 51 eligible atoms, 36 excluded same-variable pairs (equal to the summed C(k,2) of the per-variable
  atom counts), 1239 distinct cross-variable atom pairs, 4 context options, 4956 = 1239 x 4, inside the
  declared cap 20000. All 4956 candidate strings are unique, every candidate carries exactly two atoms from
  two different variables and exactly one context atom, and no same-variable candidate exists.
- The counter was re-run by the coordinator with the pinned inputs and cap 20000: the declared cell
  (`daily_snapshot_anchors` / `and` / `all_computed` / `prior_5session_return_sign`) returns
  `complete_enumeration` at 51 atoms, 1239 pairs, 4 context options. The undeclared `event_releases` cell
  returns 197 atoms, 10081 pairs, 40324 and `balanced_selection` at the same cap. So the stop-and-report
  branch was handled correctly: that cell is reported for transparency and is not declared, not truncated
  and not selected by a rotation rule. The declared list carries no ranking and sets
  `selection: complete_enumeration`, `ranking: none`, `truncation: none`.
- Declaration content is a declaration only: 28 per-variable rows (22 contributing, the 6 `event_*`
  variables contributing none with the cohort reason), the accepted cell shape, atom rules, denominators,
  ledger schema, consumed claims and limits. Its `accepted_timing_rules` block is byte-for-byte identical
  to the frozen v1 registry's, so `min_n` 20 and the accepted session/horizon/endpoint/availability
  semantics are reused rather than restated. The bound inputs resolve on disk and reproduce: 019 report
  artifact `ffcd9cbc` with content hash `a7aba34b`, report registry revision 8 `2be6701c`, consumed manifest
  `84b71765`, session-horizon policy `08cf9e3f`, coverage registry raw `c8b41e55` / LF `578166e6`.
- No candidate was evaluated and no ledger exists. Both attempts stopped in `prepare_or_reconstruction`
  before candidate aggregation, both run directories are retained and spent (each refuses re-entry), and
  each holds only `execute-stdout.txt`, `execution-manifest.json`, `failure.json` and `run.log`. The
  manifests reproduce at `5da36782a4e29b445709166f83da1c563ac9c7ad7a033836642ef0ba8236a484` (rev1) and
  `97b3309383f7791daaf340fc9b1157210eb8c27beed9d1564576b086f89eaeb5` (rev2), both pinning registry
  `c19315e6`, 4956 candidates and a 14-entry module closure. The declared-before-evaluation ordering holds.

## The blocker is upheld, and its mechanism is verified

Both failures are genuine and fail-closed, and the guard behaved correctly. The coordinator reproduced the
mechanism read-only through the adapter's own `buildBatchRows` export rather than accepting the report's
explanation:

- `buildAcceptedParts` never sets `parts.seriesRules` (zero occurrences of `seriesRules` in the adapter),
  while the accepted builder sets it at `gold_individual_variable_report.js:813` and `buildContext` copies
  it into every context at `:634`. `seriesLevelAt`, `seriesChangeAt` and `policyStepDirectionAt` read
  `context.seriesRules`; with `undefined` they fall back to `MAX_AGE_DAYS[seriesId] ?? DEFAULT_MAX_AGE_DAYS`
  (7 days) and `DEFAULT_AVAILABILITY_LAG_HOURS` (36 hours).
- The coverage-019 provider series declare different rules: `SF_FED_DNSI` 168 h / 14 d, `PHILLY_FED_ADS`
  36 h / 14 d, `SP500` 36 h / 7 d. Observed: `parts.seriesRules` `undefined`, `contexts[0].seriesRules`
  `undefined`, `risk_headline_context` with 0 available states of 965 and the single reason
  `observation_stale_beyond_declared_age`, `levelMedian` `null`, 965 rebuilt rows with 964 computed
  outcomes. That is precisely the refused reconciliation `atom_n:risk_headline_context:above_own_median is
  0, not 471`, and it is why the older FRED module series (whose declared rule coincides with the default)
  reconciled while the provider series did not.
- Second divergence: the adapter calls `loadMacroHistories` with three arguments where the accepted builder
  passes a fourth, `prospectiveBoundary(registry)` (`:805`). The repair already applied (passing
  `declaredSeriesRules(registry)` as the rules argument) is correct and matches the real signature
  `loadMacroHistories(fredDirectory, rules, extraSeriesIds = [], boundary = null)`.

So the blocker is bounded, in scope for the stage, and the exact remaining work is to assemble the accepted
parts exactly as the accepted builder does, with one implementation of the declared availability, vintage,
staleness and boundary rules, rather than a private reimplementation. That is published as
`gold-coverage-024`.

## Test evidence

Re-run by the coordinator in the gold worktree:

- `node --test backtester/tests/gold_combination_batch_v2.test.js`: 6 of 6 pass, matching the submission.
  The six cases cover the counter-derived declared counts and list hash, two-atoms/cross-variable/one-
  context shape, refusal of arithmetic, weighted, three-atom, multi-context and unavailable-state rules,
  refusal of `balanced_selection` as undeclared for this cell, approval of only approved registries with the
  v1 defaults unchanged, and byte-identity of the preserved artifacts.
- `node --test backtester/tests/gold_combination_run.test.js`: 2 of 7 pass with 5 failures, matching the
  disclosure. Every failure is
  `Accepted input drifted: report_registry is 48161ff9..., not the declared 714a5410...`, i.e. the known CRLF
  materialisation of the hash-bound revision-7 report registry (raw `48161ff9` on disk, LF `714a5410` with
  732 CR bytes), owned by the `backtester-spike` change request. Not caused by this submission, and not
  claimed as fixed.
- The documented local suite was not re-run by the worker because its session budget was exhausted; that
  remains an open obligation for the continuation, and it is stated as such in the assignment.

## Dependency impact

No gate moves. The frozen 014 window manifest reproduces at `15cd0606` and binds eight distinct paths, of
which the only combination artifact is the v1 batch registry `7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2`,
byte-identical on disk and untouched. Neither edited module (`run_gold_combination_batch.js`,
`gold_combination_rows.js`) nor the new test file is bound by that manifest, so the accepted qualification
gate cannot move. The runner's default registry path, its `EXPECTED_REGISTRY_SHA256`, its
`EXPECTED_CANDIDATES` 2548 and the accepted run-011 authorization text and scope are preserved verbatim;
the v2 registry is reachable only through the explicit `--registry` flag and a new map entry. Preserved
artifacts reproduce byte-identical: 013 shortlist `ffa69b30`, 013 audit `e7c57773`, run-011 ledger
`5cd45278`, v1 registry `7e2bcff6`, report registry revision 8 `2be6701c`, revised inventory `863c4e02`,
audit v2 `1a6af31d`, coverage declaration `c8b41e55`, 019 report `ffcd9cbc`, consumed manifest `84b71765`,
session policy `08cf9e3f`.

One pre-existing condition is re-confirmed, not newly caused and already dispositioned by the 021 review:
the frozen 014 manifest's `gold_qualification_selector.js` binding records `8f3a3896`, while the working
tree is raw `771e844e` / LF `55a4d292`. The selector was last changed by the accepted `a9bb365`, and the
021 review records the amendment-aware comparison as the only resolution available under the hard rules.
It is unchanged by this submission.

## Live lane, read-only and untouched

`GoldQualificationWindowTick018` read back from the host: `Ready`, `LastTaskResult` `0`, `NextRunTime`
`20:06:00` local, zero missed runs. The evidence root holds exactly four directories, and the sealed
anchor-2 captures reproduce (`302e4a26` dfii10, `58ece552` dgs2, `c51ad9b9` vixcls) together with the
immutable blocked attempt `e7c197f0` for the `2026-09-25T14:00:00.000Z` entry identity. No action was
taken against the capture path.

## Decision

`changes_requested` in the protocol's sense only: nothing delivered needs revision, but the assignment's
objective is not complete, so the worker must continue under a new assignment id rather than revise 023 in
place. The delivered declaration and its additive harness changes are accepted and verified as above; the
blocker is upheld; the continuation is published as `gold-coverage-024` with the register at exactly
`instructions_published_awaiting_worker`. The worker's three questions are answered: the repair belongs to
the stage under the same additive allowance; yes, call the same loader the accepted builder uses, with the
boundary argument, and add the 28-variable reconciliation test; and if the continuation and the 022 anchor
obligation fall on the same wake, the 022 item A envelope is delivered first.

## Unresolved limitations and integration status

The stage has not executed: no ledger, no evaluated candidate and no `docs/GOLD_COMBINATION_ANALYSIS_023.md`
exists yet, and the 28-factor exploratory work therefore remains unfinished. The 022 item A obligation
remains open, observation-only, with its envelope due at or after the `2026-09-28T16:00:00Z` lane close for
the `2026-09-28T14:00:00Z` anchor. The undeclared `event_releases` cell stays undeclared at 40324 over the
cap. Nothing here is a finding about the market: no outcome, return, direction, sign, aggregate,
qualification, accuracy or edge value was read, computed or reported, no holdout was reserved or consumed,
no interval is fresh, and the prospective evaluation stays sealed until `2027-03-25T15:00:00Z`. No
production, live workflow, warehouse, Layer 1, dashboard, credential, purchase, deployment or scheduler
action occurred, and no final holdout was touched.
