# Handoff - Eco Events - 2026-08-21

## Current State

The economic-events feed is not healthy enough for live decision support. The
production RapidAPI call fails from both n8n Cloud and this Windows PC.

## Live Changes Already Applied

- Active collector: `UaSliyR8qlSVIfmk`.
- Replaced the previous `currency=ALL` request with USD and EUR requests merged
  before the existing normalisation path.
- Added a 30-second HTTP timeout.
- Added a guard that fails on zero usable event rows.
- Updated the Master collector call to emit an error output on collector failure.
- Renamed the unrelated duplicate collector to
  `TEST - Eco Events Collector - Isolated 20260727`.

## Confirmed Evidence

- Post-change collector execution `2836` failed at the USD request after 30
  seconds with: `The connection was aborted, perhaps the server is offline`.
- Earlier production runs took about 115 seconds, emitted zero normalised rows,
  and were incorrectly published as successful.
- The isolated test workflow had no recent executions and no schedule trigger;
  it did not cause the live outage or consume recent API quota.
- `workflow-status.json` is current and green from the old path, while
  `input-health.json` is stale from 2026-07-22 and remains critical.

## Resume From Here

Obtain the RapidAPI page's working request/code snippet and one successful
response shape, with the API key redacted. Compare it with the active n8n node
and correct the exact endpoint/request contract. Then run one controlled Master
refresh and require non-zero USD/EUR normalised rows before treating the feed as
healthy.

## Reference

See `ECO_EVENTS_PRODUCTION_AUDIT_2026-08-21.md` for the detailed audit.
