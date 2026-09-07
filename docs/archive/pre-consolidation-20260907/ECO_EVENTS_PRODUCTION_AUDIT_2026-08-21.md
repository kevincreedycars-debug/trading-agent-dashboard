# Economic Events Production Audit - 2026-08-21

## Scope

Audit of the live path from the RapidAPI economic calendar through n8n, Supabase,
agent inputs, and the GitHub-published dashboard artifacts.

## Verdict

**NOT READY TO TREAT AS A TRUSTWORTHY LIVE ECONOMIC-EVENT FEED.**

The collector was configured to run and the Master reported it as successful, but
the live collector returned zero usable event rows in at least seven consecutive
runs. The agents therefore used placeholder economic-event context while the
dashboard published a green workflow status.

The live collector configuration has now been changed to request USD and EUR
separately, merge the responses, enforce a 30-second timeout, and fail on zero
usable rows. A controlled post-change run then failed at the USD request after
30 seconds with a connection-aborted error, so recovery remains blocked by the
provider connection rather than workflow configuration.

## Findings

### Critical: zero-row imports were published as successful

- Live collector workflow: `UaSliyR8qlSVIfmk`.
- Latest pre-change execution: `2800` at 2026-08-21 06:17 UTC.
- The HTTP request took approximately 115 seconds and produced an empty object.
- `Code | Normalise Forex Factory Events` emitted zero items without an error.
- The same pattern occurred in executions `2716`, `2730`, `2744`, `2758`,
  `2772`, `2786`, and `2800`.
- Master execution `2799` completed successfully even though its collector node
  returned no output. Its published `workflow-status.json` marked every step,
  including the collector, as successful.

Impact: USD, EUR, Gold, NQ, and BTC decisions can be produced without reliable
event context while the operational status appears healthy.

### Critical: published health is stale and contradicts workflow status

- `data/workflow-status.json` was published at 2026-08-21 06:23 UTC as success.
- `data/layer1.json` was published in the same run.
- `data/input-health.json` was last generated on 2026-07-22 and remains
  `CRITICAL`, with economic events marked `SOURCE_UNAVAILABLE`.
- The active Dashboard Writer only publishes `data/layer1.json`; it does not
  regenerate `input-health.json`.

Impact: the dashboard mixes current agent output, current green workflow status,
and month-old health evidence. It cannot provide a coherent live-data verdict.

### High: duplicate active collector workflows

- Two active workflows originally shared the name `Eco Events Collector`.
- The Master calls `UaSliyR8qlSVIfmk`.
- The other active workflow, `4zd3QEGWhessSGHW`, is called only by the isolated
  test Master. It has no recent executions and no schedule trigger.
- It was renamed to `TEST - Eco Events Collector - Isolated 20260727` to remove
  the production-name collision without changing its behavior.

Impact: the test path did not cause the current provider failure or consume recent
API quota, but its former name made incident response unsafe.

### High: no post-change execution evidence

- The USD/EUR collector change was saved at approximately 19:17 UTC.
- Controlled post-change collector execution `2836` started at 19:43 UTC and
  failed at 19:44 UTC.
- `HTTP Request | Forex Factory Calendar USD` returned no items and failed with
  "The connection was aborted, perhaps the server is offline" after 30 seconds.
- The active Master starts through a dashboard webhook or manual trigger; it has
  no n8n schedule trigger.

Impact: the new configuration is structurally verified and now reports provider
failure, but cannot import events until the provider endpoint responds.

### High: credentials are embedded in live workflow nodes

The RapidAPI credential is stored directly in HTTP node header JSON rather than
an n8n credential object. Its value is intentionally omitted from this report.

Impact: workflow exports and duplicated workflows can spread the credential, and
credential rotation is harder to manage safely.

## Live Changes Applied

1. Added a 30-second HTTP timeout to the active collector.
2. Added a normalisation guard that fails when no usable rows are returned.
3. Replaced the `currency=ALL` request with parallel USD and EUR requests.
4. Merged the currency-specific responses before the existing normalisation and
   Supabase write path.

## Recovery Acceptance Criteria

Do not mark the feed healthy until one post-change Master run proves all of the
following:

1. Both USD and EUR HTTP nodes return response items within 30 seconds.
2. The merge and normalisation nodes emit one or more valid event rows.
3. The collector creates or updates `economic_events` rows.
4. USD and EUR collector outputs contain named events rather than placeholder
   `{ priority: 50, impact_rank: 0 }` objects.
5. `input-health.json` is regenerated in the same publishing cycle and reports
   economic events as available with a current collection timestamp.
6. `workflow-status.json` reports collector failure when the collector returns
   zero rows or errors.

## Required Follow-up

- Trigger one controlled Master refresh and inspect the execution data against
  the acceptance criteria.
- Add current input-health generation and publishing to Dashboard Writer or
  Master.
- Make the Master status builder fail when the collector returns no output.
- Disable or rename the unreferenced duplicate collector after confirming it has
  no intentional external caller.
- Move the RapidAPI key into an n8n credential and rotate the exposed value.
