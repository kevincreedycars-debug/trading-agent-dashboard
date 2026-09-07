# Project startup

Read this file first, then:

1. `docs/CURRENT_STATE.md`
2. `docs/CURRENT_TASK.md`
3. `docs/ACTIVE_MILESTONE.md`
4. `docs/SESSION_NOTES.md`

Use `docs/README.md` to find additional sources only when relevant. Historical handoffs are provenance, not competing active plans.

Inspect the current branch, `git status --short --untracked-files=all`, relevant files and test commands. Summarize the current task, meaningful existing changes and next action before editing. Existing user authorization persists; proceed with work already authorized. Ask only when an unresolved choice or action outside that scope requires input.

Preserve unrelated changes. Keep credentials out of Git and logs. Ignore `.claude/launch.json` as unrelated local state unless the task actually affects it. Local evidence belongs under ignored `backtester/tmp/` or `tmp/`; recovery archives belong under `.local/`.

The canonical project folder is `D:\trading-agent-dashboard-codex`. Local `main` is the consolidated baseline. Use short-lived task branches for subsequent changes and reconcile them promptly. Do not leave months of unrelated work in one research checkout.

Keep production and research boundaries explicit: backtesting never drives live Layer 1 inputs; parity does not establish edge; local export edits do not apply themselves to n8n. A push to production `main` may publish GitHub Pages, so do not use it as an incidental backup operation.

Run appropriate local tests (`npm test`, `npm run test:unit`, `npm run test:browser`). The local runner excludes linked-warehouse mutation suites. Review dashboard changes at desktop and narrow widths using the repository visual skills.

At meaningful milestones, make coherent commits and update only the affected memory documents. `CURRENT_STATE.md` describes current facts; `CURRENT_TASK.md` is one objective; `ACTIVE_MILESTONE.md` contains exactly one next immediate action; `SESSION_NOTES.md` is the latest handoff; `CHANGELOG.md` records completed work. Preserve superseded material in history rather than appending incompatible priorities to the active files.
