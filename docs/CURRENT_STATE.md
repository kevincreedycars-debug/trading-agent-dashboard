# Current state

Updated 2026-09-07. This is the current repository summary; dated workstream reports provide supporting evidence.

- Canonical working folder: `D:\trading-agent-dashboard-codex`, branch `main`; consolidation cutover is complete and this is the sole registered worktree.
- Consolidation starts from production `origin/main` at `125d871` (fetched 2026-09-07), preserving its current dashboard and published data. Local commits add the recovered work. This is a local baseline, not a new production deployment.
- Production architecture: independent Layer 1 agents -> Supabase -> Layer 2 trade selection/dashboard publication -> GitHub Pages. Local exported workflows do not establish live runtime health.
- Existing USD, EUR, Gold, NQ and BTC replay/checker paths remain preserved. Replay agreement is implementation parity, not evidence of predictive or trading performance.
- Gold contract review is documented in `GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md`: direct candle completion is permissive, normalized storage rounding can advance entry an extra minute, and as-of selection drops the protocol envelope. Six offline review tests reproduce measurement rules and gaps; engine behavior is unchanged.
- Timestamped Gold evaluation, input lineage audits, chronological diagnostics and local reports are consolidated. The confirmed unordered 25-row Gold history query remains a production input defect. The prepared repair is unapplied and requires isolated n8n validation.
- GBP collector/agent drafts and replay code are retained. They remain research onboarding drafts; contract tests do not authorize production activation.
- The macro prototype is retained in `macro-engine/`, with no production imports or database provisioning. The trial and calendar-hardening experiments remain parked in their preserved branches.
- Raw research evidence stays local under ignored `backtester/tmp/` and `tmp/`; recovery archives stay under ignored `.local/consolidation-20260907/`. Git stores source, synthetic fixtures and selected reports.
- Collector export credential literals have been replaced with named environment references. These sanitized exports require credential binding review before import; live n8n credentials and workflows were not changed. Historical commits and private recovery archives may still contain old literals.

## Evidence limitations

Gold's September stored-call pilot is descriptive: storage timestamps are proxies, source vintages are unverified, repeated snapshots create dependence, and no evaluated call had a complete strict 24-hour path. The June 9 reference defect affects 143 of 147 linked snapshots. See [Gold progress](CODEX_GOLD_BACKTEST_PROGRESS.md).

The older L2L final-test period (2025-10-01 to 2026-04-30) is consumed. Intraday reach rates are not directional accuracy or executable win rates. A fresh timestamp-defensible dataset is required before new model qualification.

## Read next

- [Current task](CURRENT_TASK.md): one active objective.
- [Backtesting review plan](BACKTESTING_REVIEW_PLAN.md): engine inventory, priorities and acceptance criteria.
- [Consolidation record](CONSOLIDATION_20260907.md): preservation, branch dispositions and validation.
- [Documentation index](README.md): current versus historical sources.
