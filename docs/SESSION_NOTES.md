# Session notes

2026-09-09: user-requested live refresh repair detour.

Branch `fix/btc-collector-rate-limit`. CoinGecko repair intent/source/tests committed as `9f73a50` and pushed before the production edit. The live BTC node alone now retries three times with five-second waits and continues to existing missing-data handling after exhaustion. Raw backups stay in ignored `tmp/n8n-backups/`. The active version was verified. Successful retry 3490 retrieved CoinGecko data and stored a snapshot; unrelated missing inputs remain partial.

One complete refresh (3491, requested 09:44:53 UTC) finished at 09:46:53 UTC but published a failed status because FRED returned 403 Access Denied across collectors. USD 3493 failed at VIX; Gold 3495/BTC 3497 at US 2Y. HTTPS and live/stored FRED-key agreement were checked without displaying secrets. Do not claim the dashboard is recovered or conceal these upstream failures. Public status now reports USD Collector / Forbidden. No FRED node/credential changes, repeat refresh loop or access-control workaround was performed.

Read `BTC_RATE_LIMIT_INCIDENT_20260909.md` for evidence and exact changes. Final `npm test` passed 302/302; focused tests 5/5. An initial browser timing failure passed isolated and full reruns. Final ignored log: `tmp/btc-rate-limit-final-tests-20260909.log`.

Credential correction: the encrypted CLIXML store and scoped `run-with-credentials.ps1` provide working n8n, Supabase and provider access. The user was correct to challenge the prior unavailable-access statement. Read `CREDENTIAL_CONTINUITY.md` and use that runner; sandbox escalation may be required to read/decrypt the user-owned store. Startup now explicitly requires this check. Do not print credential values or persist them into global environment variables.

Next action: resolve FRED access from n8n using the recorded 403 evidence before another full verification refresh. Gold isolation work remains paused for this detour, preserved at prior commits. Its operational connection blocker is removed. Separate asset-builder folders and research artifacts were untouched.
