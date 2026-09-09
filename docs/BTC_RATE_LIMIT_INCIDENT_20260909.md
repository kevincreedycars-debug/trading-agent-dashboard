# BTC collector rate-limit incident, 2026-09-09

## Confirmed cause

Authenticated n8n inspection identifies BTC collector execution `3482` (09:03:53-09:03:58 UTC) as failed at `HTTP Request | BTC Market Data - CoinGecko`, endpoint `/api/v3/global`, HTTP 429. That node had no retries and default stop-on-error behavior. Normalization and snapshot storage therefore did not run in that collector execution. Downstream success in the Master summary does not establish fresh BTC source data.

## Authorized repair intent

User requested fixing the live incident. Change only the confirmed CoinGecko node in workflow `AE3Vv7ILPPiZwZHN`: three tries, five-second wait, then continue with error output. Existing normalization converts unavailable CoinGecko data to null, records missing `btc_dominance` and marks the snapshot partial. Preserve all live credentials, connections, other nodes, weights and source values. This tolerates an unavailable optional provider; it does not fix CoinGecko's quota or fabricate data.

`scripts/repair_btc_rate_limit.js FAILED_EXECUTION_ID` defaults to a read-only plan. `--apply` checks execution identity, HTTP 429, execution/current/active-node agreement, provider endpoint and drift, then saves a local backup before updating. HTTP-node defaults expanded by n8n execution capture are normalized for comparison. Explicit long/date-based Retry-After values require provider-specific review instead of the generic short retry. Verify saved and active versions and run the smallest affected workflow before the Master.

Raw workflow/execution evidence and backups remain under ignored `tmp/`. Checked-in exports receive only the four CoinGecko resilience settings in both represented versions. Tests verify error-to-null/partial behavior using the exact normalizer, and guards against unrelated failures and concurrent edits.

## Credential continuity correction

The project already has authenticated access through `%USERPROFILE%\.trading-agent-dashboard\scripts\run-with-credentials.ps1`, scope `n8n`. Empty process environment variables and absent connectors do not establish missing access. See `CREDENTIAL_CONTINUITY.md`. Earlier session claims of unavailable n8n access were incomplete; the encrypted store was verified and successfully used without printing credentials.

## Deployment evidence

Pending application and runtime verification; update this section after the live checks. This intent is recorded before modifying production.
