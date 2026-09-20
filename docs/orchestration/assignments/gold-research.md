# Gold research: policy proposal

Assignment ID: `gold-policy-001`  
Worker ID: `gold-research`  
Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`  
Branch: `workers/gold-research-policy-20260920`

Read the canonical `docs/orchestration/README.md`, `projects.json`, `DECISIONS.md`,
then the accepted `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md` and existing coverage
registry. This assignment supersedes the old handoff's shared-checkout setup.
The first milestone is already accepted; do not redo its checkpoint or commit it again.

Transition observation: an untracked `backtester/registries/gold_session_horizon_policy.v1.json`
appeared in the canonical checkout during setup. It has not been reviewed, moved
or included in the coordinator commit. If this is your work (or more files have
appeared), stop shared-checkout edits and first submit a blocked/status-transition
report identifying every dirty file and prior authorization. Do not start a
duplicate policy implementation or silently copy/commit those files. The
coordinator will reconcile the existing work before the proposal proceeds.

Deliver one proposal at `docs/GOLD_SESSION_POLICY_PROPOSAL.md` in your own worktree:

1. Propose a source-backed XAU/USD calendar with timezone, DST, maintenance,
   weekends, holidays and dated exceptions. Distinguish verified provider facts
   from assumptions and unresolved source access. Cite the source and retrieval date.
2. Specify expected trading closures versus missing open-session bars, exact
   anchor/endpoint matching and treatment of incomplete/conflicting bars. Keep
   endpoint returns separate from continuous-path claims. Do not fill missing bars.
3. Define prior five-trading-day return and volatility estimators, strict prior
   cutoffs, minimum observations, session counting and missing-context handling.
4. Give hand-worked boundary examples: normal day, maintenance, weekend, DST,
   holiday, missing open-session hour, off-hour event and insufficient prior history.
5. Specify the first automated individual-variable direction/return-magnitude
   report: usable variables/horizons, denominators/exclusions, event surprise and
   prior context, source-vintage limitations and per-year breakdowns. Keep all
   28 declared variables visible, including unavailable entries.
6. List decisions requiring coordinator resolution, with recommendation and impact.

Owned tracked file: only `docs/GOLD_SESSION_POLICY_PROPOSAL.md`. Compact temporary
calculations are allowed in your ignored `tmp/`; existing archives may be read by
absolute path from canonical `backtester/tmp/` without modifying them. The new
worktree does not duplicate ignored data. No bulk acquisition, model search,
implementation module changes, live workflow/database edits or deployment.

Inspect branch/status before writing. If the path, branch or clean baseline does
not match, submit a blocked report rather than resetting/moving work. Commit only
your proposal on this worker branch. Submit via the canonical CLI using the
template, exact commit/diff paths and any calculation/check results. Stop after
submission. Implementation follows a reviewed policy and a new assignment.
