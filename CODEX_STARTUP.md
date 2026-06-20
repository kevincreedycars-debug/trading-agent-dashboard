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
3. Inspect the repository before making assumptions:
   - `git status --short`
   - relevant source, workflow, data, and documentation files for the task
4. Summarise the following before editing files:
   - current project state
   - current active task
   - recently completed work
   - planned next steps
   - files likely to be edited
5. Do not modify files until the summary is complete.
6. Preserve user changes already present in the working tree.

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
