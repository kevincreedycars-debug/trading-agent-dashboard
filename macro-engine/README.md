# Macro Engine Phase 1

This directory is a local-only deterministic core for the staged macro event engine. It has no network calls, database client, n8n client, dashboard import, or production output path.

The initial USD-led basket is `USD`, `EURUSD`, `GOLD`, `NQ`, and `BTC`. A Layer 1 baseline call is immutable; later calls retain its `baselineCallId` and are evaluated for freshness before Layer 2 can use them. Event admission is append-only: exact duplicates are ignored, later versions retain revision lineage, and out-of-order publications are rejected.

`replay.js` runs chronological fixture inputs only. It never reads system time, calls a network source, or mutates a database. This is the shared deterministic path that later staged ingestion must call.

Run the Phase 1 tests with:

```powershell
node --test macro-engine/tests/*.test.js
```

Database provisioning is intentionally deferred. When a separate staged Supabase project is available, add only append-only tables there; do not use the live `Inputs Database` project for Phase 1 writes.

The unexecuted SQL contract is [sql/001_macro_stage_contract.sql](sql/001_macro_stage_contract.sql). Supporting decisions and operational contracts are in `docs/macro-engine/`.
