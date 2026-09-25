# Gold coverage-020 revision 1: blocker upheld, changes requested

Reviewed on 2026-09-25 by the interactive Central Orchestrator. Submission
`20260925-gold-coverage-020-r1`, mailbox SHA-256
`b6c28b7229ce0433f74c24f36c02fce964c5ef588c1cb9f9989e22dc609f203e`. Reply published at
`.local/orchestration/replies/gold-research/20260925-gold-coverage-020-r1.json` (SHA-256
`a69516cc4ab317b8e903bbb6e5f15e36d9dc5bad2b653da216fd7bdc87721851`). This review is a separate session
from authorship; a review decision is not integration, merge, deployment or a trading result.

## Why this was an interactive review

The background dispatcher picked the submission up automatically at `15:15:42Z` and its run **timed
out** at `15:35:42Z` (receipt `b6c28b72...`, state `needs_attention`, `timedOut` true). That path
disables automatic dispatch, which is why `config.enabled` was false and no review had run. No partial
review, reply, commit or file was left behind: the canonical checkout was clean apart from the
pre-existing unrelated changes and the run lock was released.

## Scope checked

Worker `gold-research`, worktree `.local/worktrees/gold-research`, branch
`workers/gold-research-policy-20260920`, base `3240f598` (accepted 019), HEAD `35ad4bb5`, working tree
clean, one commit. Seven changed files, exactly the disclosed set. No accepted or frozen artifact is
modified: no 014/015/016/017/018 file, no manifest, execution contract, scheduler package, collection
protocol or consumed-data manifest.

## Independent verification

- Coordinates as delivered: `gold_remaining_source_audit.v1.json` still
  `a025f587b08d1c54150f712f2a4549ca03b336e3e7808c2863e4a6dc3c0ac3e4` (byte-identical), audit v2
  `1a6af31dbb60e1d408f1e6c1723366471b13e96fbb7802a1510fa58767bc5846`, coverage declaration
  `c8b41e5549bb1c876e45fe5be27f3f988fe99dfb5844505746a6fd25028ac837`, revision-8 report registry
  `2be6701ccbc169d8e12e6933c234bb185b48523161ff60364663d71209ccb497` (unchanged from 019).
- Tests reproduced by the coordinator: `gold_coverage_020.test.js` 6/6;
  `gold_qualification_protocol.test.js` + `gold_variable_coverage.test.js` +
  `gold_remaining_source_audit.test.js` 32/32; `gold_qualification_window.test.js` 8/8;
  `gold_qualification_shortlist.test.js` 5/7 with exactly the two reported drift failures.
- The two updated expectations strengthen rather than weaken the checks (revision 8 is read and the four
  retired ids are additionally asserted; the coverage audit now asserts zero unsourced declarations).
  Two honest weaknesses noted for the next touch: the `unavailable_no_local_source ?? 0` fallback would
  also pass if the key were absent, and the new `series_not_found_in_supplied_source` expectation is
  fixture-correct but should sit beside an explicit key assertion.

## The blocker, verified and explained

The accepted input binding for the 013 shortlist selection is stale, exactly as reported:
`run_gold_shortlist_selection.js` pins `ACCEPTED_DIGESTS.inventory = c9cc0def...`, and
`gold_qualification_selector.bindInputs` refuses drift before reading anything, so the two
reproduction checks fail closed on the revised inventory. The coordinator added the missing root
cause: `c9cc0def...` is the **CRLF materialisation** of the pre-revision file, whose git-blob LF
digest is `c1a5c305...`; the revised file is `863c4e02...` raw and `b7687622...` normalised. A binding
recorded from a CRLF copy can therefore never be stable across worktrees. Blast radius verified: the
frozen 014 manifest's provenance roles are shortlist, audit, ledger, registry, protocol, selector and
code, so it does **not** bind the live-input inventory, and the live-window binding suite passes 8/8 -
the revision cannot reach the running capture path. The worker was right to stop instead of editing
accepted artifacts, and the resolution was authorised by the user as a normalised re-acceptance after
an outcome-identity proof.

**That proof now exists and was reproduced by the coordinator.** The accepted selection was re-run
against the **revised** inventory into `tmp/coordinator-verify-shortlist-020-20260925` at
`15:31:42Z` with `--expected-inventory 863c4e02...` (`selection-run.json`), and it returned the
identical four candidate ids in identical order, pool 2548 declared / 255 eligible, counts 255
entries / 4 selected / 251 skipped, an `entries` array byte-identical to the frozen audit,
`reconciliation_ok` true, and the frozen artifact still `ffa69b30...` on disk. The declaration-only
revision therefore provably does not change the accepted selection, and only the embedded
expected-digest provenance differs between the two artifacts - which is why the re-run file hash
differs while every selection field is identical.

## Urgent live-lane defect found during this review (not an 020 defect)

`2026-09-25T14:00:00.000Z|gold|entry` is sealed `blocked` at `2026-09-25T14:06:03.033Z`, reason
`provider_error`, detail `HTTP 400`, `rescheduled` false, no same-identity retry; later ticks report it
`already_settled`, and the directory `2026-09-25T14-00-00-000Z-gold-entry` holds the immutable
`blocked-attempt.json`. Cause reproduced with a read-only probe through the documented credential
runner (`tmp/probe-oanda-range.js`, metadata only, no candle value printed): a pre-window range returns
HTTP 200 with three candles, while any future-dated range returns HTTP 400 with the provider message
`Invalid value specified for 'from'. Time is in the future`. `requestWindowForItem` builds the entry
request as `[anchor_utc, anchor_utc + 1h]` while the entry lane opens at the anchor, so the first tick
after every anchor asks for a range ending up to an hour in the future, the provider refuses it, and
`sealBlockedAttempt` consumes the identity permanently. Anchor 2's entry is unrecoverable (lane closed
`16:00:00Z`; a capture outside the lane is not evidence) and every remaining anchor is exposed, the
first being `2026-09-28T14:00:00.000Z`. A second, structural limitation was recorded: a Friday anchor's
24-hour target falls on a closed-market Saturday, so its exact and delayed endpoint identities cannot
be filled and must be reported as expected misses rather than worked around.

## Decision

Changes requested. The reconciliation content of items 1-5 is verified and correct, the disclosure of
the two test-expectation updates is accepted, and the blocker is upheld: the binding cannot be
re-accepted inside 020's boundaries, and the live entry-lane defect is urgent. Both are published as
`gold-coverage-021` (entry eligibility through a versioned v2 path; normalised binding re-acceptance
after an outcome-identity proof). Answers given to the three questions: re-accept in normalised form
with the historical values retained, after proving the frozen four ids and the 2548/255/4 pool
reproduce; do not change the gate vocabulary; no further re-verification against the frozen window's
declaration of record is needed because it does not bind the inventory. No outcome, holdout, production,
warehouse, Layer 1, live workflow, credential or deployment action occurred, and evaluation stays
sealed until `2027-03-25T15:00:00Z`.

