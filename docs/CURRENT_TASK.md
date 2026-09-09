# Current task

Updated 2026-09-09.

Live dashboard incident detour: the BTC CoinGecko HTTP 429 repair is deployed and verified by successful collector retry `3490`. Full refresh `3491` exposed separate FRED HTTP 403 Access Denied errors across collectors. Resolve authenticated FRED access from the n8n runtime before claiming dashboard recovery; do not hide failures or substitute stale data as fresh.

See `BTC_RATE_LIMIT_INCIDENT_20260909.md`. Authenticated n8n/provider access is available through the encrypted credential runner documented in `CREDENTIAL_CONTINUITY.md`; empty shell environment variables are intentional. Preserve secrets and raw evidence locally.

Gold history isolation work is paused for this user-requested detour. Its local tooling remains complete on prior commits; resume `GOLD_HISTORY_PATCH_VALIDATION.md` after the live incident. Layer 1 remains independent and backtesting downstream-only. Separate asset builders retain their ownership.
