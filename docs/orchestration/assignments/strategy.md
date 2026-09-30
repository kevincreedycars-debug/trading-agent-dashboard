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

## Reply style (user instruction, adopted canonically 2026-09-30)

Replies to the user obey the rule recorded in `docs/strategy/REPLY_STYLE.md`, reproduced here so later strategy
windows inherit it without editing any canonical file. At most three bullets of about fifty words each in plain
words; no tables, no hashes, no file paths, no provenance and no jargon in a reply to the user. Each question one
to two lines with a short reason, at most seven, and the stated default stands if the user does not reply.
Everything long goes in a file in `docs/strategy/` and in the mailbox submission, never in the chat reply; if it
will not fit, keep the headline and name the file. Use the user's own words for the user's things - the questions,
the work, the numbers, the dashboard - and never expect the user to hold worker shorthand such as round, batch,
lane, envelope, submission or artifact. A request to see something is a live request: lead with what the user will
see, where they will see it, and who has to do it, and say in the first line if it cannot be done from the worker
window. The coordinator owns the canonical copy of this rule; workers keep their own per-worktree copy only.

## Live copy of the draft page (coordinator record, 2026-09-30)

The user answered the publish question in one line - "yes show it live" - and the coordinator published the frozen
draft page on 2026-09-30 as a coordinator production action under the existing `dashboard` workstream; the provisional
lane id `dashboard-gold-factor-wip-page-001` was never registered. Live identity: commit `a2b0e13` on production `main`,
pushed `9b20360..a2b0e13` (`refs/heads/main` = `a2b0e134cf722212cc85baecf7d8f08c7941d4e0`), page at
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/gold-factor-wip.html`, one added topbar line
`<a class="topbar-link" href="gold-factor-wip.html">Gold Factor (draft)</a>` in the live `index.html`, and the live site
verified rather than assumed: HTTP 200, 21,281 bytes, sha256 `5dbe1364...`, byte-identical to the committed blob, with
the draft link present on the live dashboard. The banner and the as-of line were left exactly as written, and no other
site file changed.

Line endings, so the worker's hash check stays meaningful: the worker's file is 21,541 bytes, 260 CRLF lines, no bare
LF, sha256 `675fc9da...`, while the commit stored the LF form at 21,281 bytes, sha256 `5dbe1364...`, because this
repository runs `core.autocrlf=true` with no `.gitattributes` (the earlier published pages were stored the same way).
The blob is exactly the frozen file with CRLF-to-LF applied, proved byte for byte rather than inferred from sizes. A
refresh therefore compares the CRLF-to-LF conversion, or the content, and reports the outcome with the new hash as each
batch of answers lands. Single writer, unchanged: the worker owns its file in `docs/strategy/`, the coordinator owns the
live copy and the nav entry.


