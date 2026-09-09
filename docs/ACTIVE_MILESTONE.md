# Active milestone

## Current Feature
Live dashboard refresh reliability.

## Current Milestone
Resolve provider failures and verify one complete refresh.

## Status
CoinGecko repair deployed; FRED access remains unresolved.

## Completed Work
Confirmed HTTP 429 in BTC execution 3482, added bounded retries and explicit partial-data continuation only to CoinGecko, preserved a live backup, verified the active version and successful retry 3490. Full local suite passes 302/302. Full refresh 3491 exposed separate FRED 403 Access Denied failures; the public status correctly reports failed.

## Remaining Work
Establish why FRED is denying the n8n runtime, restore authorized provider access, then validate the smallest collector before another complete refresh. Preserve failure visibility. Resume Gold isolation after this incident.

## Current Files Being Modified
BTC export, guarded repair command/tests and incident/handoff documentation. No FRED workflow or credential changes.

## Blockers
FRED returned HTML Access Denied across multiple collectors. Requests use HTTPS and the configured key matches the encrypted store. This is an upstream access failure; no configuration mismatch has been demonstrated.

## Next Immediate Action
Review FRED access recovery using the captured n8n 403 evidence before attempting another full refresh.

## Last Updated
2026-09-09.
