# Messages to paste into agent windows

These messages start the assignments; no agent has been started by creating these files.
Use the correct worker window. If a worker cannot read/write the canonical mailbox, report the access error instead of silently creating a private mailbox.

## gold-research

```text
Check your inbox for the coordinator's reply, then read your current assignment from the canonical project:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research
D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md
Your current assignment is `gold-coverage-021`, published 2026-09-25 under explicit user authority. 020 is closed as changes-requested with its blocker upheld: its verified items 1-5 stand, do not repeat them. Two items, in this order. Item A, urgent and before 2026-09-28T14:00:00Z: the live entry lane is broken - requestWindowForItem builds the entry request as [anchor, anchor+1h] while the entry lane opens at the anchor, so the first tick after every anchor asks OANDA for a range ending up to an hour in the future, the provider refuses any future-dated range with HTTP 400, and sealBlockedAttempt permanently consumed 2026-09-25T14:00:00.000Z|gold|entry at 14:06:03.033Z. Add the missing eligibility guard through a versioned v2 activation path: never call the provider with a future-dated interval, refuse such a request before any provider call without consuming the identity, keep every accepted v1 file byte-identical, repoint the existing task action to the v2 wrapper only after the focused tests and a dry verification that consumes no identity, prove one real tick with task result 0, and restore the v1 wrapper and report if anything cannot be verified. Item B: re-accept ACCEPTED_DIGESTS.inventory in LF-normalised form (b7687622...) after reproducing the outcome-identity proof the coordinator established in tmp/coordinator-verify-shortlist-020-20260925, where the accepted selection against the revised inventory returned the identical four ids in identical order, pool 2548 declared / 255 eligible, counts 255/4/251 and byte-identical audit entries, with the frozen artifact ffa69b30... unchanged; then make the inventory binding compare the normalised digest with the historical c9cc0def.../c1a5c305... values retained and disclosed, and drive the shortlist suite to 7/7 without touching any frozen artifact.
Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research on branch workers/gold-research-policy-20260920, starting HEAD 35ad4bb5 (020 delivered). One writer only: never open a second session against this worktree.
Do not disturb the live capture lane: GoldQualificationWindowTick018 keeps running every ten minutes as the only capture path, and the sealed window evidence plus the immutable blocked attempt stay byte-identical. No prospective observation read, no outcome, no research-rule change, no new source or credential, no credential for the keyless sources, no repository-level .gitattributes fix (that belongs to backtester-spike), no warehouse, live workflow, Layer 1, dashboard or production change.
Validate the v2 path with focused tests, then the documented suite, then submit a new immutable report:
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
