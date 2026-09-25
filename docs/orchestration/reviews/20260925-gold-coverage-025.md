# Gold coverage-025: accepted, the plain-English verdict page is delivered

Reviewed on 2026-09-25 by the background Central Orchestrator (a controller-locked run, a session separate
from authorship; the controller lock named this submission, so no interactive pause/stop was run). Submission
`20260925-gold-coverage-025`, mailbox SHA-256
`a1543786b6feba0ebcf57ff3aca32fcb17d4d9358865a2255990dcbc26b333d6`, reproduced independently from the
submitted file and equal to the requested hash. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-025.json` (SHA-256
`bd4804c1d79255ad9d67c4a6dcb5ffefd1e7cc7c8366b63771fd08ff19ab201d`), decision `accepted`. A review decision
is not integration, merge, deployment or a trading result.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `cdd350af` (verified an ancestor), HEAD `65e8b3a4`, working tree
clean. The single new commit `65e8b3a4` adds exactly one file, `docs/GOLD_BACKTEST_VERDICT_20260925.md`
(59 lines, 518 words, additive), and `cdd350af` remains its parent, so every accepted artifact of 019
through 024 - `docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md`, `docs/GOLD_COMBINATION_ANALYSIS_023.md`, the
registries and the run directories - is byte-identical to the revisions already accepted. No registry,
harness, ledger, analysis, test or hash-bound path was edited, and no `.gitattributes` change was made.

## Independent verification (reproduced, not trusted)

- **The page itself.** `docs/GOLD_BACKTEST_VERDICT_20260925.md` reproduces byte-identical at sha256
  `7198e24e45755632e2314f09c50fe6ff3151a120f0226c87976133d97d85d765`, 59 lines and 518 words, inside the
  declared 500-700 range, and follows section 1 in order: what was asked and run; what the numbers say in
  plain terms; what cannot be concluded and why; what a real verdict would need; and one closing line naming
  where to check.
- **Every number re-checked against the accepted artifacts.** `combination-summary.json` `d594646d` carries
  `candidate_count` 4956, `status_totals` 2745 reported / 704 ineligible / 1507 empty / 0 unavailable,
  `attempt_totals` 4782540 attempts / 441781 matched anchors / 441319 n / 350283 `exact_offset_elapsed` /
  91036 `delayed_offset_endpoint` / 0 `session_close_endpoint` / 245784 positive / 195535 negative, and
  `rows` 965 anchors with 964 computed outcomes. The ledger reproduces byte-identical at `f02a88cb`
  (23,948,174 bytes), the manifest at `1ec2a382`, and `row-reconciliation.json` at `a23f65d1`, whose
  `anchors_total` check reconstructs 965 against 965 accepted. `exploratory` is true with `prediction_claimed`,
  `accuracy_claimed` and `trading_result_computed` false.
- **The five disclosed distribution figures are verified, closing the worker's stated gap.**
  `descriptive-analysis.json` carries `n_distribution.all_attempts` median 74 / q1 0 / q3 156,
  `unavailability.candidates_with_any_unavailable_anchor` 4673 with `anchors_unavailable_median` 8 and
  `anchors_unavailable_max` 51, and `matched_outcome_not_computed_totals` 462. The worker disclosed that it
  had confirmed only 4673, the 964/965 anchors and the direction counts directly and had not re-derived these
  five; the coordinator has now re-derived all five from the artifact, so the residual gap is closed rather
  than carried, and the honest disclosure is recorded rather than treated as a defect.
- **Claim discipline.** The only occurrences of ranking, winner, signal, edge, profitability or win-rate
  wording are the page's own denials; the page states plainly that the 2023-2026 archive can describe this
  space but cannot support choosing from it; it does not restate the 28 individual-variable blocks and links
  to `docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md` instead; and section 3 records the two limits that matter,
  the five declared research definitions that are not live Layer 1 fields and the ledger storing per-candidate
  anchor counts rather than anchor instants.
- **Dependency impact is nil, checked rather than assumed.** The new path is documentation only and is not one
  of the eight paths the frozen 014 qualification manifest binds (013 shortlist `ffa69b30`, 013 audit
  `e7c57773`, run-011 ledger `5cd45278`, v1 registry `7e2bcff6`, protocol `4fd1c2c2`, window lib `c5095d57`,
  manifest builder `f4a21d28` and the selector lib), and no test enumerates the `docs/` directory, so the
  accepted gate cannot move.
- **Live lane undisturbed, verified read-only.** `GoldQualificationWindowTick018` is `Ready` with one enabled
  `PT10M` trigger, `LastRun` 2026-09-25 20:46:01 local, `LastTaskResult` 0 and zero missed runs. That matches
  the worker's read-only observation one tick earlier and confirms nothing in this change touched capture.
  No task was created, modified or started, and no credential was read.

## Decisions recorded

- **Question 1 (envelope wake).** The carried 022 item A observation envelope for the
  `2026-09-28T14:00:00Z|gold|entry` identity stays due at or after the `2026-09-28T16:00:00Z` lane close. This
  reply is itself the next event that wakes the Gold bridge; the worker is instructed to read it, hold, and
  not deliver early. Because a reply or assignment notifies a bridge once per content version, that Monday
  delivery still needs an event at or after the lane close - an operator resume of the Gold window or a later
  coordinator event - and the register keeps `gold-coverage-025` published at status exactly
  `instructions_published_awaiting_worker` so the delivery trigger path stays intact.
- **Question 2 (linking the page).** The page stays standalone exactly as delivered. Acceptance is not
  integration: the file exists only in the worker worktree at `65e8b3a4`, not in the canonical checkout, so
  promotion into the canonical `docs/` path is a coordinator integration decision recorded as the next
  central action rather than taken inside this review, and no edit to the page is requested either way.
- **No successor assignment was published.** No evidence supports a further stage: revisions 1, 2 and 3 of
  the 024 run are spent and immutable and must not be re-run, and the user's standing direction after this
  deliverable is hold and take the envelope.

## Unresolved decisions (the user's, stated rather than implied)

1. Whether to authorise any further exploratory stage over the spent intervals. The undeclared
   `event_releases` cell at 40,324 would need a selection rule, and the other horizons, context fields and
   endpoint groups sit in the same already-consumed calendar, so no interval in scope can serve as a fresh
   final test.
2. Whether to promote the accepted verdict page from the worker checkout into the canonical checkout.

Until decision 1, the only paths to a real verdict remain the sealed prospective window, whose evaluation
stays sealed until `2027-03-25T15:00:00Z`, or new licensed data, neither authorised.

## Disclosure

Controller-locked background run, separate from authorship. No production change, deployment, purchase,
credential change, external message or warehouse mutation occurred. No Layer 1 input was affected, no live
workflow was edited, no outcome, holdout or prospective observation was read, and no final holdout was
consumed. Gold's checkout was read only; nothing was committed, reset, stashed or discarded on its behalf.
Coordinator activity reporting: this review runs under the controller lock that owns the background review cycle,
and the monitor's own record for `central-orchestrator` is written by that controller (`Background review running`, controller state `reviewing`, reported 2026-09-25T19:46:04Z) rather than by this session; a direct
`node scripts/monitor-state.js activity` write from here is declined by the sandbox policy, so no separate heartbeat
was published and none is claimed. `node scripts/monitor-state.js snapshot` at 2026-09-25T19:49:46Z was used
read-only instead and showed `pending` 0 with no errors, and the reply to this submission was delivered to the
Gold bridge (`Wake sent / pickup unconfirmed` for `gold-coverage-025` at 2026-09-25T19:48:18Z, which is a send
receipt and not proof of worker pickup).