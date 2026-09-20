# Gold policy: preserve and correct the existing implementation

Assignment ID: gold-policy-002
Worker ID: gold-research
Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920

Read the canonical coordination README, DECISIONS and review:
D:/trading-agent-dashboard-codex/docs/orchestration/reviews/20260920-gold-policy-transition-001.md
Read these from the canonical absolute location, not stale worktree copies.

## Authorized sequence

1. Stop canonical implementation. Inspect both statuses; do not reset, rebase,
   stash, move or discard anything. The worker baseline is bbb7111. If unexpected
   dirty files or branch changes exist there, report blocked rather than overwrite.
2. Copy (not move) exactly these five canonical files into the matching paths in
   your clean worker checkout. Verify before AND after copy against the hashes
   below. If a source changed, stop and report it. Commit only those files as an
   experimental preservation baseline, explicitly unaccepted. Keep the existing
   worker history; do not reset to 0b0e92d. Leave canonical originals untouched.
3. Fix the review findings in a separate commit and write
   docs/GOLD_SESSION_POLICY_PROPOSAL.md. Preserve reusable work and audit lineage.
4. Submit corrected policy, tests, proposal, baseline/fix commits, hash manifest,
   changed-file list, independent example results and fresh versioned audit to
   the canonical mailbox under this assignment and a new unique submission ID.
   Stop for coordinator review before reaction-report implementation.

## Authorized file set and preservation hashes

- backtester/registries/gold_session_horizon_policy.v1.json: 073c1d0316db52aa347428aea92544b9829edeb271fe62feb9e7aee0de263dff
- backtester/lib/gold_session_policy.js: 45a5482e05f5c55bfef8f40105d2d075f4938c005fd41f73b9462fd1c9774821
- backtester/scripts/audit_gold_session_policy.js: cd909713a6b848375ca31e2389f60659708f2925341bbec9861f99103c252a8a
- backtester/tests/gold_session_policy.test.js: 55d2268d397a6185ab3380bdf9eacf2901750b9c6606f94994e6fb8a636cf687
- backtester/docs/gold_session_horizon_policy.md: a5cec2f2add1073e575dba98fd5b733b8f6050946a04d13e5a19c88d1d7ce140
- New: docs/GOLD_SESSION_POLICY_PROPOSAL.md
- If needed: synthetic fixtures only under backtester/tests/fixtures/gold-session-policy/.

The original submitted bytes are the preservation baseline; corrected policy
metadata must identify its revision and superseded hash. Frozen prior audit
artifacts must not be overwritten. Source archives remain read-only at canonical
backtester/tmp paths. Write new raw evidence in your worker's ignored tmp/ or
backtester/tmp/. The new worktree does not contain canonical ignored archives.

## Acceptance requirements

- Use candle close/availability timestamps for strict prior context. A 23:00 H1
  candle cannot supply its final close at 23:30. Test just before, at and after
  availability and disclose the strict cutoff.
- Missing or incomplete declared final bars yield no session close. Do not use
  an earlier bar or skip missing expected sessions to shorten lookbacks. Test a
  missing final bar, a wholly missing expected session and horizon endpoints.
- Source the applicable provider's session and dated holiday rules with URL,
  retrieval date, historical applicability and instrument/feed convention.
  Independently documented rules versus archive-inferred exceptions must be
  separate evidence classes. Unverified exceptions remain unknown/blocking for
  verified-continuity claims. An archive-fit diagnostic mode may remain clearly
  labelled; zero inferred gaps does not prove completeness. Current documentation
  alone does not retroactively establish every 2023-2026 holiday exception.
- Define trading-session identity across UTC midnight, Sunday open, DST,
  maintenance, Friday close and holiday exceptions. Demonstrate five sessions by
  hand without treating every nonempty UTC date as a session by default.
- Correct volatility units and handling of missing open-session intervals.
  Distinguish hourly returns from unequal-duration adjacent-observation returns.
- Preserve reported user constraints: 1h/4h are persistence diagnostics excluded
  from formula inputs; align to first complete bar at/after the anchor. Record
  decision provenance. Separately propose delay acceptance/stratification rules
  and disclose actual bar-open, price-availability and elapsed-return intervals.
- Retain all 28 declared variables, direction AND return magnitude, prior price
  and macro context, complete denominators and exclusions in the proposal for the
  first reaction report. Do not run that report, combinations or formula search yet.
- Add meaningful adversarial regressions for the demonstrated bugs and calendar
  uncertainty. Re-run focused tests and the local suite; disclose exact failures
  and compare known scanner failures rather than asserting a green suite.

Only the files listed above may be committed. Do not edit canonical state,
assignments, shared code, original coverage registry or another worker directory.
No live workflow, warehouse, credential, deployment or production change.
External read-only documentation lookup is authorized; bulk data acquisition is
not part of this assignment. Raise unresolved factual dependencies through the
mailbox instead of adapting rules just to maximize usable-window counts.
