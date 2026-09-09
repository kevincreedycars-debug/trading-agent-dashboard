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

Intent commit `9f73a50` was pushed to `fix/btc-collector-rate-limit` before the production edit. The guarded command applied the four settings and verified that the active version contains the patch. Backup: ignored `tmp/n8n-backups/btc-rate-limit-1788947012291-4898e422-a039-4523-a199-4d799617ab1e.json`.

Retry execution `3490` used the current workflow and succeeded. CoinGecko returned data, normalization retained BTC price and dominance, and one snapshot was stored. Remaining history/economic-event inputs were explicitly marked partial. This establishes repaired collector operation, not complete market inputs.

One full dashboard refresh was triggered at `2026-09-09T09:44:53.278Z`. Master `3491` finished at `09:46:53.643Z` and published a failed workflow status because separate FRED requests returned HTTP 403 HTML Access Denied. USD `3493` failed at VIX; Gold `3495` and BTC `3497` failed at US 2Y. EUR/NQ also failed in the same refresh. These requests use HTTPS and the same correctly formatted FRED key as the documented encrypted store. No key was changed, no FRED error was suppressed, and no access-control workaround was attempted. Earlier BTC execution `3482` had successfully retrieved FRED observations before failing at CoinGecko.

Public status now reports USD Collector / Forbidden, dated `09:46:52.691Z`; the original CoinGecko 429 is no longer the latest published failure. Resolving FRED access from the n8n runtime remains necessary before claiming end-to-end recovery. Preserve the Akamai reference IDs and raw error evidence under ignored `tmp/refresh-execution-3493.json`, `3495`, `3497`; do not print request URLs containing keys.

Validation: focused tests 5/5; final `npm test` 302/302. An initial full run had one timing-sensitive browser assertion (Accepted versus Delayed); its isolated rerun passed and the full rerun passed. Logs remain ignored.
