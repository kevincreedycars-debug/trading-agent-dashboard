# Gold prospective shortlist freeze

Assignment: gold-qualification-shortlist-013. Published 2026-09-23.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: 67fcc09.
The user chose the coordinator recommendation to narrow the eligible pool before
opening any prospective qualification window.

Assignment 012 is accepted. It froze a declaration-only eligibility gate with 255
eligible candidates and a later selector capped at 20 hypotheses. This assignment
executes that selector exactly once on already-consumed run-011 evidence and freezes
the resulting shortlist. It does not open the prospective window and must not read
or acquire any outcome after the consumed boundary.

1. Bind the run to the accepted inputs before selection and fail closed on any
   mismatch:
   - frozen registry `backtester/registries/gold_combination_batch_daily_h24_and.v1.json`,
     SHA-256 `7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2`;
   - live-input inventory `backtester/registries/gold_live_input_inventory.v1.json`,
     SHA-256 `c9cc0defef750508639281b3d8bf307b745c8b388f24bb7734def2dfcce1edfb`;
   - gate `backtester/lib/gold_qualification_gate.js`, SHA-256
     `969cb76053ec8572969d7f9b2ed7ccf73719f00f012c78347637779d6b731c5b`;
   - accepted run-011 revision-2 ledger
     `backtester/tmp/combination-run-011-20260923-rev2/combination-ledger.jsonl`,
     SHA-256 `5cd452780e75af3f992bafd2618786fe1b0363ae1dd92e34810f1e6c3bee4f75`.
   The ignored ledger is an accepted local input, not a file to regenerate or edit.
2. Implement a deterministic offline selector that first reproduces exactly 255
   gate-eligible candidates, joins them one-to-one to the 2,548-record accepted
   ledger by `candidate_id`, and reads only the fields authorized by protocol 012
   for selection: `status`, `year_support.supported_years`, `n`,
   `unavailable.anchors`, and `candidate_id`. Reject missing, duplicate, malformed,
   extra or provenance-mismatched inputs.
3. Apply the frozen order without adaptation: `status = reported` first, then
   higher supported-year count, larger `n`, smaller unavailable-anchor count, and
   ascending `candidate_id`. Apply the frozen diversity rule in that order: at most
   one selected hypothesis per unordered variable pair and at most one per
   individual variable; skipped candidates never re-enter. Stop at 20, or report a
   smaller set if the diversity rule exhausts the pool.
4. Write a new immutable machine-readable shortlist artifact plus an exhaustive
   selection audit covering all 255 eligible candidates. Record each candidate's
   ordered position, selected/skipped disposition and exact reason; reconcile the
   selected and skipped counts to 255 and prove every selected id belongs to the
   frozen registry and passes the accepted gate. Record input/code/output hashes
   and the exact command. Do not overwrite any accepted artifact.
5. Add focused tests for input hashes and one-to-one joins, the exact sort and tie
   breaker, status precedence, both diversity constraints, skipped-candidate
   non-reentry, the cap, deterministic repeat output, and rejection of any selector
   attempt to use prospective outcomes or undeclared ranking fields. Document the
   frozen shortlist and limitations, run focused tests and `npm test`, submit one
   unique 013 envelope, and pause for coordinator review.

Owned scope: new offline selector/CLI, focused tests, new shortlist/audit artifacts
and scoped documentation. Preserve protocol 012, the gate, inventory, frozen
registry and all run-011 inputs/results byte-for-byte. The shortlist is a fixed set
of candidate ids, not a leaderboard, winner, formula or trading rule. Do not attach
or inspect any post-boundary outcome, do not open/start/backfill the prospective
window, and do not reserve or consume a holdout. No acquisition, network, live
workflow, warehouse, credential, Layer 1, dashboard, integration, deployment,
purchase, weight or production change. If any accepted input or frozen selector
rule is inconsistent, stop and submit the blocker rather than repairing or adapting
it inside this assignment.
