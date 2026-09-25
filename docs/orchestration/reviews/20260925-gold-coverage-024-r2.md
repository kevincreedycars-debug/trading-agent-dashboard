# Gold coverage-024 revision 2: accepted, the 28-factor exploratory circuit closes as exploratory

Reviewed on 2026-09-25 by the background Central Orchestrator (a controller-locked run, a session separate
from authorship; the controller lock named this submission, so no interactive pause/stop was run). Submission
`20260925-gold-coverage-024-r2`, mailbox SHA-256
`5dcfaf796a7685a18b6df423d7eb9cf11290fda0b81d5afc39c45fc16b64838e`, reproduced independently from the
submitted file and equal to the requested hash. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-024-r2.json` (SHA-256
`40eaccc4a2734f80e1d83945bac19d5565397cc6748736abe43e5ef5e48cec99`), decision `accepted`. A review decision
is not integration, merge, deployment or a trading result. This review is a separate session from authorship.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `6fd501a7` (verified an ancestor), HEAD `cdd350af`, working
tree clean. The single new commit `cdd350af` adds exactly one file,
`backtester/tests/gold_combination_engine_024.test.js` (132 lines, additive), and
`2c3606dd984f5cefc6a630c9a18402703fcb001b` is still its parent, so the repaired adapter and ledger and
`docs/GOLD_COMBINATION_ANALYSIS_023.md` are byte-identical to the revisions verified in
`20260925-gold-coverage-024-r1`. No accepted artifact was modified, and nothing outside the two evidence
items the revision-1 reply required changed.

## Independent verification (reproduced, not trusted)

- **Focused tests.** `node --test backtester/tests/gold_combination_engine_024.test.js` run by the
  coordinator in the worker checkout: 6 of 6 pass. The assertions are substantive rather than tautological:
  the four-argument `loadMacroHistories` call carrying `prospectiveBoundary(registry)` and the carried
  `parts.seriesRules` are matched against the adapter source; `declaredSeriesRules` maps `SF_FED_DNSI` to
  168 h / 14 d and `PHILLY_FED_ADS` to 36 h / 14 d and is asserted to differ from the module defaults
  36 h / 7 d, so the defect cannot return silently; a same-variable pair is refused; an undeclared registry
  and an approved digest moved to another file are refused; the version and status gates accept the declared
  v1 and v2 versions and the two pre-execution statuses and refuse a v3 version and `after_outcomes` before a
  record is written; the reconciliation guard is asserted by source plus its retained firing evidence
  (revision 2 `failure.json`, phase `prepare_or_reconstruction`,
  `atom_n:risk_headline_context:above_own_median is 0, not 471`, `ledger_present` false); and the declared
  counts, the candidate-list hash `db96c728` and nine preserved artifacts reproduce.
- **Documented local suite.** `node scripts/test-local.js` in the worker checkout: 545 tests, 539 pass,
  6 fail, with no new failure attributable to this work. The worker's 9 do not reproduce exactly and the
  difference is environmental, not a defect: the five CRLF-materialisation cases (97, 98, 101, 102, 103)
  reproduce identically, and this coordinator's sixth is 210, the in-lane entry-identity capture test
  failing closed because this shell exports `DEEPSEEK_API_KEY` (already recorded in
  `20260925-gold-coverage-022-r1`), not the four console-width secret-scanner cases (430, 431, 432, 434)
  the worker's shell reported. Both runs agree the CRLF five are unchanged pre-existing work owned by the
  `backtester-spike` change request.
- **Ledger re-derived, not inferred from the hash.** `combination-ledger.jsonl` reproduces byte-identical
  at `f02a88cb` (23,948,174 bytes) and its contents were re-summed from the artifact: 4,956 records;
  statuses 2,745 `reported` / 704 `ineligible` / 1,507 `empty` / 0 `unavailable`; every record
  `reconciliation_ok` true with `all_computed` 441,319 = `exact_offset_elapsed` 350,283 +
  `delayed_offset_endpoint` 91,036 + `session_close_endpoint` 0; and 4,673 candidates carrying at least one
  unavailable anchor. Summary `d594646d`, manifest `1ec2a382`, row reconciliation `a23f65d1`. The batch was
  correctly not re-run.
- **Dependency impact is nil, checked rather than assumed.** The only cross-module consumer of the edited
  libraries is `parseCandidateId`, imported by `backtester/lib/gold_qualification_gate.js` and
  `backtester/lib/gold_qualification_selector.js`; the diff touches only `APPROVED_REGISTRY_VERSIONS`,
  `APPROVED_REGISTRY_STATUSES` and `assertRegistryIntegrity`, so `parseCandidateId` is unchanged. The frozen
  014 manifest binds eight paths (013 shortlist `ffa69b30`, 013 audit `e7c57773`, run-011 ledger
  `5cd45278`, v1 registry `7e2bcff6`, protocol `4fd1c2c2`, window lib `c5095d57`, manifest builder
  `f4a21d28` and the selector lib) and every one still matches on disk, none being an edited file, so the
  accepted gate cannot move.
- **Preserved artifacts byte-identical.** v2 registry `c19315e6`, v1 registry `7e2bcff6`, run-011 ledger
  `5cd45278`, frozen 014 manifest `15cd0606`, report registry revision 8 `2be6701c`, revised inventory
  `863c4e02`, audit v2 `1a6af31d`, coverage declaration `c8b41e55` and the 28-block individual-variable
  digest `d2307a74` all reproduce.

## Residual limitations recorded rather than hidden

- The ledger stores per-candidate attempt and anchor counts, not anchor instants, so pre-boundary
  compliance rests on the accepted engine plus the declared prospective boundary passed into the loader
  rather than on a per-anchor audit. The worker asked whether to add the line to
  `docs/GOLD_COMBINATION_ANALYSIS_023.md`; the review answer is that recording it in the envelope and here
  is sufficient, and no documentation cycle should be opened for it.
- The frozen 014 manifest records the pre-amendment selector digest `8f3a3896` while the file on disk is
  `771e844e`. That is the accepted `gold-coverage-021` amendment, declared explicitly by
  `backtester/tests/gold_qualification_window.test.js`, not drift.
- The local-suite failure set is environment-dependent in its non-CRLF members (ambient credential and
  console width). Exact counts are reported above rather than normalised to a single figure.
- The live capture lane state quoted by the submission (one Gold task on the v2 wrapper, zero missed runs) was not re-queried in this cycle; the lane was neither touched nor read, and its last independent verification is in `20260925-gold-coverage-022-r1`.

## Decision

Accepted. The declaration, the repaired adapter and ledger, the executed run, the ledger, the denominators,
the analysis document and both required evidence items are verified, and the 28-factor exploratory circuit
is closed as exploratory. Honest reading: the 28 measured factors are declared, evaluated over 4,956
candidates and reported descriptively; nothing in this stage is accuracy, ranking, timing or edge evidence,
and none is possible from spent intervals. The batch must not be re-run - rev1, rev2 and rev3 are spent and
immutable.

No new assignment is published. The register keeps `gold-coverage-024` at status exactly
`instructions_published_awaiting_worker`, whose section 0 governs the one outstanding obligation: the 022
item A observation envelope for the `2026-09-28T14:00:00Z|gold|entry` identity, due at or after
`2026-09-28T16:00:00Z`. The precise unresolved decision remains the user's: whether to authorise any further
exploratory stage over the spent intervals - the undeclared `event_releases` cell at 40,324 would need a
selection rule, and the other horizons, context fields and endpoint groups sit in the same already-consumed
calendar. Until that decision the only paths to a real verdict are the sealed prospective window, whose
evaluation stays sealed until `2027-03-25T15:00:00Z`, or new licensed data. Operational note for the
handoff: a reply or assignment notifies a worker bridge once per content version, so the Monday envelope
needs a fresh wake at or after the lane close - an operator resume of the Gold window or a later coordinator
event.

No outcome, holdout, acquisition, credential, production, warehouse, Layer 1, live workflow or deployment
action occurred in this review, and the live v2 capture lane was neither touched nor read.