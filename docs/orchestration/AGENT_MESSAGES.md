# Messages to paste into agent windows

These messages start the assignments; no agent has been started by creating these files.
Use the correct worker window. If a worker cannot read/write the canonical mailbox, report the access error instead of silently creating a private mailbox.

## gold-research

```text
The coordinator has reviewed your transition submission and written a changes_requested reply.
Run: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research
Read the returned reply and the current canonical assignment:
D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md
Your new assignment is gold-policy-002. Preserve the hash-verified implementation in the isolated worktree and complete the corrections/provenance work specified there. Leave canonical originals untouched. Submit a new report when complete, then stop for review.
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

## Coordinator prompt

```text
Check submissions. Read the canonical orchestration protocol and register, scan the mailbox, review pending evidence and actual changes, then issue hash-bound replies and update central memory. Do not assume reported work is accepted, merged or deployed.
```

## Worker follow-up prompt

```text
Check your central mailbox replies using your worker ID. Read the reply and current assignment from the canonical project. Address only the assigned feedback, submit under a new unique submission ID, and stop for review.
```
