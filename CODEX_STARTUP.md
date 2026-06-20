# Codex Startup

This file is the first document Codex must read at the beginning of every session in this repository.

## Purpose

Define the permanent working-memory and session-management sequence for Codex so every session starts from the repository's documented state before making changes.

Canonical project memory lives in `docs/`, except this startup file which stays at the repository root.

## Startup Sequence

1. Read this file first.
2. Read the project memory documents:
   - `docs/CURRENT_STATE.md`
   - `docs/CURRENT_TASK.md`
   - `docs/NEXT_STEPS.md`
   - `docs/DECISIONS.md`
   - `docs/CHANGELOG.md`
   - `docs/SESSION_NOTES.md`
   - `docs/PROJECT_HISTORY.md`
   - `docs/ARCHITECTURE.md`
   - `docs/N8N_INTEGRATION.md`
   - `workflows/WORKFLOW_INVENTORY.md`
3. Read the latest entry in `docs/CHANGELOG.md`.
4. Read `docs/SESSION_NOTES.md` carefully enough to determine:
   - where the previous session stopped
   - what was completed
   - what remains unfinished
   - the exact next task
5. Perform the Repository Health Check.
6. Inspect the repository before making assumptions:
   - relevant source, workflow, data, and documentation files for the task
7. Present the startup summary before editing files.
8. Do not modify files until the startup summary is complete and the user has confirmed the task for the session.
9. Preserve user changes already present in the working tree.

### Startup Recovery

At the beginning of every new session, recover the project state entirely from repository documentation instead of relying on previous chat history.

After reading all project memory files, the latest changelog entry, and `docs/SESSION_NOTES.md`, determine:

- where the previous session stopped
- what was completed
- what remains unfinished
- the exact next task

Summarise this before making any edits.

### Repository Health Check

After reading the project memory files, but before making any code changes, perform a repository health check.

Run:

```bash
git status --short --untracked-files=all
git branch --show-current
```

Then include the results in your startup summary.

The startup summary must always contain:

### Repository Status

- Current branch
- Whether the working tree is clean
- Any modified files
- Any untracked files
- Whether there are uncommitted changes that should be reviewed before editing

If the working tree is not clean, ask whether the existing changes should be:

- committed
- stashed
- discarded
- left untouched

Do not assume the correct action. Do not make additional edits until the user has answered.

### Project Summary

- Current platform status
- Current active task
- Recently completed work
- Highest-priority next task
- Files or workflows likely to be modified during this session

### Recommendations

Based on the project documentation and current repository state:

- Recommend the most logical next task.
- Highlight any potential conflicts or unfinished work.
- Warn if multiple changes may overlap.
- Suggest whether documentation should be updated before continuing.

Do not begin editing any files until this startup summary has been presented and the user has confirmed the task for the session.

This repository health check must be performed at the start of every new Codex session.

## End-Of-Session Sequence

Before ending a Codex session, update only the documents that actually changed:

- `docs/CHANGELOG.md` for completed work
- `docs/CURRENT_STATE.md` if platform status changed
- `docs/CURRENT_TASK.md` if the active task changed
- `docs/NEXT_STEPS.md` if priorities changed
- `docs/DECISIONS.md` if architectural decisions were made
- `docs/SESSION_NOTES.md` with the latest session handoff
- `docs/PROJECT_HISTORY.md` if a high-level milestone changed
- relevant workflow, issue, or architecture docs if the work changed them

Commit documentation updates with the related code changes whenever practical, then push the commits to GitHub when repository access is available.

## Continuous Documentation Updates

Project documentation is the permanent memory of this repository.

Do not wait until the end of a session to update it.

Whenever a meaningful piece of work is completed, immediately update the relevant documentation before continuing.

A meaningful piece of work includes, for example:

- completing a new dashboard component
- completing a workflow
- completing a database schema
- completing a UI redesign section
- completing a bug fix
- completing a refactor
- making an architectural decision
- changing project priorities

For each milestone:

1. Update `docs/CHANGELOG.md`.
2. Update `docs/CURRENT_STATE.md` if platform status changed.
3. Update `docs/CURRENT_TASK.md` if the active task changed.
4. Update `docs/NEXT_STEPS.md` if priorities changed.
5. Update `docs/DECISIONS.md` if an architectural decision was made.
6. Update `docs/SESSION_NOTES.md` with the current stopping point.
7. Create a Git commit for that milestone.

This should happen throughout long sessions rather than only once at the end.

## Commit Frequency

Avoid extremely large commits.

Prefer multiple logical milestone commits.

Examples:

- Dashboard header redesign complete
- Asset cards redesigned
- Navigation updated
- Backtesting tab scaffold complete

Each milestone should have:

- updated code
- updated documentation
- a Git commit

This ensures that if a Codex session ends unexpectedly, very little project memory is lost.

## Milestone Update Rule

For meaningful milestones, update memory immediately instead of waiting until the end of a long session.

Meaningful milestones include:

- dashboard redesigns or new dashboard sections
- new or completed workflows
- database schema changes
- collectors or agents completed
- backtesting UI or engine milestones
- major bug fixes
- architectural decisions

Do not update project memory for trivial edits.

## Working Rules

- Think first.
- Inspect second.
- Plan third.
- Code fourth.
- Validate fifth.
- Document sixth.
- Commit seventh.
- Push eighth.
- Reuse existing implementations wherever possible.
- Never duplicate functionality before checking whether it already exists.
- Prefer extending existing code over replacing it.
- Keep changes as small and isolated as practical.
- Preserve existing functionality unless explicitly instructed otherwise.

## Memory Rules

- Treat the project memory documents as the authoritative source of project context between sessions.
- Inspect existing memory before creating new memory files.
- Preserve existing information unless there is a documented reason to change it.
- Never commit secrets, API keys, or credentials.
- Keep memory updates factual, dated, and scoped to completed or active work.
- `docs/SESSION_NOTES.md` is temporary working memory and should be replaced each session with the most recent handoff.
