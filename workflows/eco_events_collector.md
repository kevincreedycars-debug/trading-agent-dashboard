# Eco Events Collector

## Purpose

Collect relevant economic events and write them into Supabase for later event-risk and Layer 2 processing.

## Current Status

The duplicate-insert failure has been fixed in the live workflow.

### Data availability incident: 2026-08-21

The active production collector (`UaSliyR8qlSVIfmk`) had been reporting successful
executions while the Forex Factory RapidAPI request returned an empty payload. The
normalisation node consequently emitted zero event rows. This left the dashboard
with no trustworthy published economic-event data despite a green workflow status.

The live workflow now has a 30-second HTTP timeout and explicitly fails when the
provider returns no usable event rows. A successful execution is therefore no
longer treated as evidence that economic events were imported.

The former `currency=ALL` request was replaced with separate `currency=USD` and
`currency=EUR` requests. Their responses are appended before normalisation, so
the dashboard's USD, EUR, Gold, NQ, and BTC context retains the required US and
Euro-area event coverage without relying on the ambiguous all-currency response.

At the time of the repair, both configured RapidAPI calendar sources were
unavailable: the primary provider returned an empty payload after roughly 115
seconds, and the alternate provider returned HTTP 403. Restoring live imports
still requires a working, entitled calendar source.

The collector now behaves idempotently by:

- deduping incoming calendar rows in `Code | Normalise Forex Factory Events`
- fetching existing `economic_events` rows for the run date
- routing matched rows to `Supabase | Update Economic Events`
- routing unmatched rows to `Supabase | Create Economic Events`

Matching identity:

- `event_date`
- `currency`
- `event_name`
- `event_time_text`

## Previous Failure

Observed error:

```text
duplicate key value violates unique constraint

economic_events_event_date_currency_event_name_event_time_t_key
```

## Diagnosis

The built-in `n8n-nodes-base.supabase` row node in this workspace does not expose a true composite-key upsert or `ON CONFLICT` setting.

Because of that limitation, the supported live fix uses:

1. Deduplicate incoming events.
2. Read existing rows for the target date.
3. Update existing matches.
4. Create only unmatched rows.

## Validation

Validation was performed against the live workflow on 2026-06-21.

- First run succeeded: execution `1081`
- Second immediate rerun succeeded: execution `1082`
- No duplicate-key error appeared on either run
- The rerun went through the update branch rather than create, confirming existing rows were updated instead of duplicated

## Export Status

The current live workflow has been re-exported to `exports/eco_events_collector.json`.
