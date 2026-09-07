# Staged Data and Freshness Contract

## Scope

This contract applies to the separate staged Supabase project selected for the macro engine. It is not a migration for `Inputs Database` and it does not authorize a production connection.

## Event records

Every event must include a stable ID, source, immutable raw reference, dedupe key, and all three UTC timestamps:

- `published_at`: when the source says the information became public.
- `received_at`: when the staged collector received it.
- `processed_at`: when deterministic normalization completed.

An exact duplicate is retained only as an admission decision, not a second event record. A later corrected source becomes a revision linked by `revision_of_event_id`. An event older than the latest admitted version for the same dedupe key is rejected as out of order.

## Market observations

Market observations must have `observed_at`, `received_at`, source, instrument, interval, and a freshness state. A one-minute signal is eligible only when its source interval and receipt time are both recorded. Missing or stale required legs must prevent an active revised call or Layer 2 candidate.

## Call versions

Every call version requires:

- immutable `call_id`, `baseline_call_id`, and optional `supersedes_call_id`
- `call_kind` of `BASELINE` or `EVENT_OVERLAY`
- direction, action status, call status, evidence strength, persistence class, and source run ID
- `generated_at`, `sealed_at`, `next_review_at`, `expected_valid_until`, and `hard_expires_at`
- trigger event IDs, machine-readable invalidation rules, and data freshness

`next_review_at` may be brought forward by weak confirmation or a new event. `hard_expires_at` may be shortened at any time; an extension requires a new sealed reassessment with explicit lineage.

## Notifications

Notifications are derived records. Their failure cannot alter a call version. Store the severity, dedupe key, delivery state, event/call lineage, and resolution status. Suppress exact repeated transitions during the configured cooldown, but permit escalation from `WATCH` to a higher severity.

## Source policy before Phase 2

- Scheduled calendar sources are observation-only until their publication and receipt timestamp quality is demonstrated.
- No unscheduled-news source is approved yet.
- No live one-minute price source is approved yet.
- Unattributed price shocks remain `UNKNOWN_CAUSE`; the engine must not invent a headline.
