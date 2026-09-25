# Messages to paste into agent windows

These messages start the assignments; no agent has been started by creating these files.
Use the correct worker window. If a worker cannot read/write the canonical mailbox, report the access error instead of silently creating a private mailbox.

## gold-research

```text
Check your inbox for the coordinator's reply, then read your current assignment from the canonical project:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research
D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md
Your previous assignment gold-coverage-021 is ACCEPTED (reply adcaaf91..., review docs/orchestration/reviews/20260925-gold-coverage-021-r1.md): item A (the versioned v2 entry-eligibility path, the task action repointed to the v2 wrapper and a verified real tick with result 0) and item B (the shortlist input binding re-accepted in LF-normalised form) are both verified. Your current assignment is gold-coverage-022, published 2026-09-25.
Item B first, immediately actionable: close the two deferred coverage-test expectations the 020 review recorded - the unavailable_no_local_source ?? 0 fallback must assert the key explicitly so an absent key fails, and the series_not_found_in_supplied_source expectation must sit beside an explicit key assertion. Test-only: disclose the exact before/after and keep every accepted report and registry byte-identical.
Item A: observe, never trigger, the repaired live entry lane at its first reachable anchor 2026-09-28T14:00:00.000Z, whose entry lane runs 15:00-16:00Z. From the observed tick.log and sealed evidence, report that the entry identity 2026-09-28T14:00:00.000Z|gold|entry is not_yet_eligible and unconsumed before the lane, captured inside the lane (or sealed blocked once with rescheduled false, stating the reason code), already_settled afterwards, and that the three sealed anchor-2 captures, the one immutable blocked attempt, the frozen 014 manifest and the frozen 013 shortlist and audit are byte-identical. If the 2026-09-28T16:00Z lane close has not yet been reached when you pick this up, do item B, report the lane state so far, and state that item A is pending the anchor rather than implying it was observed.
Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research on branch workers/gold-research-policy-20260920, starting HEAD a9bb3654. One writer only: never open a second session against this worktree.
Do not disturb the live capture lane: GoldQualificationWindowTick018 keeps running every ten minutes through the v2 wrapper as the only capture path, its action and settings stay exactly as accepted, the v1 wrapper stays byte-identical as the documented rollback, and the sealed window evidence plus the immutable blocked attempt stay byte-identical. No prospective observation read, no outcome, no research-rule change, no new source or credential, no repository-level .gitattributes fix (that belongs to backtester-spike), no exploration (opening a fresh exploratory combination stage over the 28 measured variables is not authorised), no warehouse, live workflow, Layer 1, dashboard or production change.
Validate with focused tests, then the documented suite, then submit a new immutable report:
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Report actual activity at start and at each step, pause after submitting, and report the returned submission path. Stop for coordinator review.
```

## gbp

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gbp.md from those absolute paths.
Your worker ID is gbp; assignment ID is gbp-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-gbp on branch agents/gbp-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gbp
```

## silver

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/silver.md from those absolute paths.
Your worker ID is silver; assignment ID is silver-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-silver on branch agents/silver-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker silver
```

## wti

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/wti.md from those absolute paths.
Your worker ID is wti; assignment ID is wti-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-wti on branch agents/wti-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker wti
```

## eur-pairs

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/eur-pairs.md from those absolute paths.
Your worker ID is eur-pairs; assignment ID is eur-pairs-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-eur-pairs on branch agents/eur-pair-coverage-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker eur-pairs
```

## strategy-2

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/strategy-2.md from those absolute paths.
Your worker ID is strategy-2; assignment ID is strategy-advisory-2-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2 on branch workers/strategy-advisory-2-20260924 (created 2026-09-24 from canonical 4884339).
Run this window on DeepSeek, exactly as adviser 1 does: the existing Cline extension with DeepSeek selected, no new key, credential or provider configuration.
Your lane is the live path and the multi-asset rollout: Layer 1/Layer 2 honesty and observability, the four unreconciled asset workers, the multi-asset readiness/multi-process rollout, and mailbox/background-reviewer automation. Adviser 1 (strategy) keeps the gold research engine lane; do not duplicate it and never contradict it silently.
Write only docs/strategy-2/ in your worktree plus ignored scratch. Never edit the canonical folder, the register, assignments or another worker's files, and never submit secrets.
Deliver docs/strategy-2/STRATEGY_LIVE.md and docs/strategy-2/CONVERSATION_NOTES.md, submit materially revised recommendations through the shared mailbox with a unique submission ID:
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Report real activity with monitor-state.js activity strategy-2 working|paused|blocked "task", then pause.
This window is the only Strategy window connected to the mailbox bridge; keep it connected and leave adviser 1 disconnected.
```

## Coordinator prompt

```text
Check submissions. Read the canonical orchestration protocol and register, scan the mailbox, review pending evidence and actual changes, then issue hash-bound replies and update central memory. Do not assume reported work is accepted, merged or deployed.
```

## backtester-spike

```text
This worktree is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-spike.md from those absolute paths.
Your worker ID is backtester-spike; assignment ID is multi-asset-readiness-spike-001.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-spike on branch spike/multi-asset-readiness-20260924, base 927f799.
Submission 20260924-multi-asset-readiness-spike-001-r1 is reviewed with CHANGES REQUESTED. Read the reply first:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-spike
Then do exactly two things: make the hash-bound inputs byte-stable (a .gitattributes eol=lf entry for the hash-bound registries and fixtures plus an explicit renormalisation, reconciliation and disclosure of any digest that was recorded from a CRLF copy, and a regression test that fails when a hash-bound digest drifts), proving in a fresh worktree that the accepted Gold gate binds again; then re-run the documented local suite in this worktree and disclose exact counts and failures.
Submit a new revision under a new submission ID, report activity and pause.
Preserve every accepted Gold artifact and every other worktree. No acquisition, research-rule change, warehouse, Layer 1, live workflow, dashboard, scheduler or production action.
```

## Worker follow-up prompt

```text
Check your central mailbox replies using your worker ID. Read the reply and current assignment from the canonical project. Address only the assigned feedback, submit under a new unique submission ID, and stop for review.
```
