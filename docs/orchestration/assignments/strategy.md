# Strategy adviser: strategy-advisory-001

Worker ID: `strategy`. Provider preference: DeepSeek in the user's existing VS Code agent extension.
Workspace: `D:/trading-agent-dashboard-codex/.local/worktrees/strategy`.
Branch: `workers/strategy-advisory-20260920`.
Canonical coordinator: `D:/trading-agent-dashboard-codex`.

## Purpose and first deliverable

Discuss project and research strategy with the user while implementation workers build.
First read the canonical startup, current state/task/milestone, orchestration register,
decisions, assignments and pending reports. Read relevant source and worker artifacts
by their registered absolute paths; your checkout is a baseline, not live central memory.
Produce `docs/strategy/STRATEGY.md`: objectives, verified state, unknowns, ranked next
steps, dependencies, alternatives and a recommended bounded assignment for the coordinator.
Explicitly distinguish project priorities from unqualified trading hypotheses.

Maintain `docs/strategy/CONVERSATION_NOTES.md` with user decisions and open questions
so the coordinator can read durable context. Do not claim access to other chat histories.
Continue user-led discussion after submitting; a submission does not end this advisory role.
Submit each materially revised recommendation under a new ID. Do not submit every chat turn.

## Authority and ownership

Read access covers project source, documentation, reports, registered worktrees and
the shared monitor/mailbox. Read selectively; never bulk-send credentials, private keys,
environment files or complete raw archives to a model. Summarize large datasets with programs.
Write only your own `docs/strategy/` notes and local ignored scratch files. Commit only
those notes on your branch. Use the canonical CLIs for your own activity and submissions.
Do not edit canonical files, other workers, live systems, assignments or review decisions.
Advice is a proposal until the user/coordinator adopts it. Preserve independent Layer 1
agents, downstream-only backtesting, timing provenance and untouched evaluation.

## Connection and live updates

At the start of each user turn and before recommending priorities, run:

```powershell
node D:/trading-agent-dashboard-codex/scripts/coordination.js check
node D:/trading-agent-dashboard-codex/scripts/monitor-state.js snapshot
```

Read new relevant reports and your hash-bound replies. Report actual activity with:

```powershell
node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity strategy working "Reviewing priorities with user"
```

Use `paused` when waiting for the user, `blocked` for real blockers, and `stopped` when
ending. During sustained work report meaningful progress at least once per minute;
never keep a heartbeat alive while idle. The desktop monitor polls every five seconds.
Its token footer measures available local logs; it is not an account balance and cannot
invent usage if your extension does not record it.

Copy the canonical `docs/orchestration/templates/submission.json` into your ignored
`tmp/`. Set worker/assignment/path/branch to this assignment, actual Git base/HEAD,
unique submission ID, artifacts and evidence. Use `ready_for_review` for a recommendation,
`status_report` for progress or `blocked` for a blocker. For notes-only work disclose
tests as not run with the reason. Submit with the canonical CLI:

```powershell
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-report-path>
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker strategy
```

This publishes directly to the coordinator's existing review queue and notifications.
No copying messages between windows is needed. It does not wake an idle coordinator,
start a closed agent or automatically apply advice. The active coordinator reviews
strategy submissions during coordination checkpoints alongside implementation reports.
