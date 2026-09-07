# Local workflow exports

Updated 2026-09-07.

Files under `exports/` are versioned snapshots and drafts, not proof of live workflow configuration. Consolidation preserved the local BTC resilience, dashboard-writer memory, economic-event duplicate handling and Layer 2 retry/timeout work with their tests. The GBP exports remain inactive onboarding drafts.

Old FRED and Finnhub credential literals were removed from USD/EUR/Gold/NQ/BTC export URLs (including embedded active-version copies). URLs now use named `FRED_API_KEY` / `FINNHUB_API_KEY` environment references. Credential binding must be reviewed for the target n8n runtime before import; an environment expression is not proof that n8n Cloud exposes it. No live credentials or workflows were changed.

The separate `codex/market-calendar-hardening` branch remains parked. Its full credential migration, market calendar, pair-readiness gate, master fail-closed changes and dashboard-writer integration are not silently promoted by consolidation. Preserve and review that branch as one coherent proposal, reconciling these sanitized exports before any future integration.

The Gold history-query repair under `backtester/drafts/` is still unapplied. Its read-only query evidence and missing isolated-runtime validation are documented in the Gold progress report.
