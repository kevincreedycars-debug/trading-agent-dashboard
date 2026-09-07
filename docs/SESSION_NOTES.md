# Session notes

2026-09-07: repository consolidation and main-folder cutover complete.

Use `D:\trading-agent-dashboard-codex` on local `main`. It is now the sole registered worktree. The old research worktree and all redundant worktrees were retired after verified backups. Its old directory is empty but still held open by a Windows process; no project files remain there. All branch histories remain preserved. Recovery archives and logs are under ignored `.local/consolidation-20260907/`; required raw evidence remains under ignored `backtester/tmp/` and `tmp/`.

Seven coherent integration commits start at production `125d871` and finish at `b14b63a`; the final handoff commit records cutover. Research, Gold evidence, GBP drafts, the isolated macro prototype, workflow fixes and dashboard integration are consolidated. Trial and calendar-hardening work remains parked. Historical startup/task notes are archived; current navigation is `docs/README.md`.

Validation from the original folder: `npm ci --ignore-scripts` succeeded; **280 local tests passed**. Eighteen page/viewport combinations passed layout/JavaScript checks. Recovery archives, 101 raw evidence files, six GBP draft/progress files and 34 research data artifacts were verified. The full scan of 424 tracked files found no credential findings. Details and log locations are in `CONSOLIDATION_20260907.md`.

No production push, live n8n mutation, warehouse write or credential change occurred. Existing collector exports now contain named environment references instead of old key literals and require runtime binding review before import. Historical Git commits and private archives may still contain the original literals.

Next: follow `BACKTESTING_REVIEW_PLAN.md` and write the Gold timestamped directional-evaluation contract. The Gold history-query repair is still unapplied; input timing, complete paths and MT5 execution evidence remain qualification gaps. GBP expansion, macro provisioning and optimization remain parked.
