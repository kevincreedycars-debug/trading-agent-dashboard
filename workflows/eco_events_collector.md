# Eco Events Collector

## Purpose

Collect relevant economic events and write them into Supabase for later event-risk and Layer 2 processing.

## Current Status

The duplicate-insert failure has been fixed in the live workflow.

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
