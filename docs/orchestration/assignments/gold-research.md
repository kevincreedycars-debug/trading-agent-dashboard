# Gold policy correction batch

Assignment ID: gold-policy-003. User confirmed 2026-09-20.
Worker ID: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research.
Branch: workers/gold-research-policy-20260920. Starting HEAD: ccd4c37.
Read canonical orchestration instructions and the hash-bound revision-2 reply.

1. Correct the prior five-session return to use six boundary closes spanning
   five consecutive trading-session intervals. Preserve strict availability and
   refuse missing boundary/intermediate closes or missing expected sessions.
   Add an independently hand-calculated six-close example and a regression showing
   that five closes are insufficient. Define the volatility window separately so
   an extra return boundary does not silently add a sixth session of hourly data.
2. Reconcile policy registry, code, docs and audit labels. Separate exact 24h
   elapsed returns from delayed endpoints; report entry and endpoint delay strata
   independently. Do not set formula eligibility or hide delayed observations.
3. Make a bounded read-only attempt to obtain applicable OANDA session and dated
   holiday evidence. Record feed applicability, source URL, retrieval date and
   historical coverage. CME evidence is not automatically OANDA feed evidence;
   second-hand sources remain explicitly secondary. If inaccessible, retain the
   verified-mode blocker and disclose it without fitting new exceptions to gaps.
4. Keep all 28 declared variables visible. Do not retire missing variables. Propose
   remaining outcome/flat-band and report-policy decisions for coordinator review;
   no reaction report, combination search or formula work in this batch.
5. Commit scoped corrections, rerun focused tests and the documented local suite,
   produce a new immutable audit with hashes, and submit through the canonical
   mailbox. Report activity to the monitor and stop for review after delivery.

File scope remains the prior assignment's six policy/proposal files and synthetic
fixtures. New raw evidence belongs only in worker ignored scratch. No canonical
edits, production operations, integration, bulk acquisition or credential changes.

Authorized files: backtester/registries/gold_session_horizon_policy.v1.json; backtester/lib/gold_session_policy.js; backtester/scripts/audit_gold_session_policy.js; backtester/tests/gold_session_policy.test.js; backtester/docs/gold_session_horizon_policy.md; docs/GOLD_SESSION_POLICY_PROPOSAL.md; synthetic fixtures under backtester/tests/fixtures/gold-session-policy/.
