# Working instructions

Read `CODEX_STARTUP.md`, then the current state, task, milestone and session notes in `docs/`.

The canonical working folder is `D:\trading-agent-dashboard-codex`. This is the consolidated project, not the old isolated trial dashboard. Historical trial instructions are preserved on `trial-foundation-m1`.

Preserve unrelated work. Inspect branch and status before edits. Follow the user's existing authorization without repeatedly asking for the same approval.

Keep Layer 1 agents independent and backtesting downstream-only. A local workflow export or passing replay test is not proof of live deployment, causal feature timing or trading edge.

Run `npm test` for the local suite, or its documented focused variants. Linked-warehouse integration suites, live workflow changes and production publication are separate operations; do not run them as incidental validation.

Use the repository layout/aesthetic skills for dashboard-facing changes. Keep one active milestone, coherent commits, and current handoff notes. Store raw evidence and backups only in ignored local folders.
