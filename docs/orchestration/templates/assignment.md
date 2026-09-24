# Assignment template

Coordinator-owned. Copy to `assignments/<worker>.md`, replace every placeholder, add the
worker row to `docs/orchestration/projects.json` with status
`instructions_published_awaiting_worker` (exactly that spelling, or the bridge will not
wake the window), and keep one active assignment per worker.

```text
# <title>

Assignment: `<assignment-id>`. Published <YYYY-MM-DD>.
Worker: `<worker-id>`. Worktree: `<absolute worktree path>`.
Branch: `<branch>`. Starting commit: `<short sha>`.
User authorization: `<the exact instruction or standing direction this rests on>`.

## Scope

1. <bounded deliverable>
2. <bounded deliverable>

## Owned scope

<exact files and paths this worker may write, plus where ignored evidence may live>.

## Accepted bindings

- <exact path and SHA-256 the work must re-verify before acting>

## Boundaries

No production, live workflow, warehouse, Layer 1, dashboard, credential, scheduler,
deployment or purchase action. One writer per worktree. Stop at the review boundary:
coherent commit, one mailbox submission, then pause.

## Evidence and validation

<focused tests, then the documented local suite variant, and what must be shown>.

## Reporting (mandatory)

Finish only by reporting. On completion, on a blocker or at a decision point:

1. write one envelope from `templates/submission.json` into your own ignored `tmp/`
   with status `ready_for_review`, `blocked` or `status_report`, the observed
   worktree/branch/base/HEAD, changed files, exact test commands and results, artifact
   hashes, blockers, questions and production disclosure;
2. submit it with `node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`;
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity <worker> paused "<what finished>"`;
4. stop. Start no further work, in any asset or checkout, until a recorded reply
   arrives; read it with `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker <worker>`.

A blocker is submitted when it is found, not at the end of the task. Reported
completion is the submission path returned by the CLI plus the monitor activity line;
a worker that goes quiet with neither is treated as unfinished and its assignment does
not advance.
```
