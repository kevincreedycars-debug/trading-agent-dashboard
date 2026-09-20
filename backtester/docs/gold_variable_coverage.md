# Gold variable, horizon and prior-context coverage audit

## Purpose

This is the machine-readable scope declaration and deterministic coverage audit for the Gold
individual-variable research assignment. It answers one question only:

> Which declared Gold explanatory variables, horizons and prior-context fields can actually be
> measured from the local versioned sources, and where is the evidence missing or unverifiable?

It computes no correlation, no accuracy, no combination result and no trading outcome. Coverage is
availability evidence; it can never establish that a variable is related to the Gold price.

## Artifacts

| Artifact | Purpose |
| --- | --- |
| `backtester/registries/gold_variable_horizon_context.v1.json` | Scope declaration: 28 variables, 5 candidate horizons, 8 prior-context fields, forbidden context, unresolved policies and known gaps. |
| `backtester/lib/gold_variable_coverage.js` | Deterministic readers (`readFredDirectory`, `readHourlyDirectory`, `readEventDirectory`) and the audit builder plus Markdown renderer. |
| `backtester/scripts/audit_gold_variable_coverage.js` | CLI wrapper that writes `coverage.json` and `COVERAGE.md` and refuses to overwrite them. |
| `backtester/tests/gold_variable_coverage.test.js` | 24 tests covering readers, boundaries, horizons, prior context, deduplication, denominators, determinism and the CLI. |
| `backtester/tests/fixtures/gold-variable-coverage/` | Synthetic FRED, H1 candle and event-archive fixtures with expected counts recorded in `_fixture` blocks. |

## Usage

```powershell
node backtester/scripts/audit_gold_variable_coverage.js FRED_DIRECTORY HOURLY_DIRECTORY EVENTS_DIRECTORY NEW_OUTPUT_DIRECTORY [REGISTRY_JSON]
```

- Every directory argument is an explicit path; nothing machine-specific is hard-coded. The optional
  registry argument defaults to the checked-in repository path.
- Pass the literal token `none` for a source you are intentionally not supplying. That source's
  checks are reported as `unknown` with reason `source_not_supplied`; they are never reported as
  passed, and no substitute value is invented.
- The command refuses to write into a directory that already holds `coverage.json` or `COVERAGE.md`,
  and both files are also written with the exclusive `wx` flag as a second guard.

## Registry vocabulary

`coverage_status_values` separates verified facts from proposals and from missing coverage:

- `verified_local_source` — the value exists in a named local archive.
- `verified_derived_from_local_source` — the value is computed by a named existing module.
- `proposed_mapping` — intended transformation with no local implementation yet.
- `unavailable_no_local_source` — required by the inventory but not present locally; retained
  explicitly rather than dropped.
- `not_in_declared_inventory` — a local series that exists but is outside the declared 28.

`audit_status_values` describe whether a declared item could be measured at all. Unsupported or
policy-dependent items stay `pending_*` or `unsupported_*`; they are never silently upgraded.

## Horizons

| Horizon | Declared offset | Local resolution | Meaning of the audit status |
| --- | --- | --- | --- |
| `immediate_event_window` | undeclared sub-hourly | H1 only | `unsupported_by_local_resolution`. No minute-level reaction is measured or inferred from H1 bars. |
| `h1_post_event` | 3,600,000 ms | H1 | Endpoint availability is measured, but alignment stays pending because most US releases (13:30Z, 15:00Z) are not hourly boundaries. |
| `h4_post_event` | 14,400,000 ms | H1 | Same pending alignment rule; continuity is measured separately from endpoint existence. |
| `h24_post_event` | 86,400,000 ms | H1 | Endpoint and continuity availability are audited. The existing strict 24-hour evaluator is not modified or reused for the other horizons. |
| `d5_trading_days_post_event` | 5 trading days, no elapsed value | pending calendar | `session_calendar_policy_pending`. Five trading days is never treated as 120 elapsed hours. |

Endpoint matching requires an exact candle open time; no partial bar is substituted. Anchors are
audited in two separate cohorts, `event_releases` and `daily_snapshot_anchors` (weekdays 14:00Z), and
the two cohorts are never summed into one denominator.

## Prior context

Each declared context field records a `strictly_before_observation_time` cutoff rule and a leakage
guard. An observation counts only when its calendar date and its declared availability are both
strictly before the anchor, and only when it has a usable non-null value. The audit also reports how
many anchors would change if the cutoff were inclusive, so the effect of the strict rule is visible
rather than assumed.

FRED availability uses the earliest non-null vintage for an observation date plus the same
conservative 36-hour lag as `backtester/lib/gold_macro_vintage_dataset.js`. The earliest non-null
vintage is used because the newest revision may postdate the anchor, and using it would understate
availability for heavily revised series such as DTWEXBGS.

Non-calendar lookbacks are labelled `observation_index_based_not_calendar_trading_days`, so a
five-observation lookback is never described as five trading days.

## Event releases

`readEventDirectory` deduplicates on `eventId|dateUtc|name` as the declared primary release key, and
keeps the broader `dateUtc|name` grouping as a retained overlap flag rather than a deletion. Rows
with unparsable release timestamps are counted as exclusions, and `lastUpdated` is treated as
archive-update evidence only, never as a release or consensus vintage.

## Determinism

`content_sha256` covers the report content with only `run.generated_at`, `run.output_directory` and
`run.command` excluded. Two runs over identical inputs and an identical registry therefore produce
an identical hash regardless of where they were written, and any input change changes the hash.

## Evidence and fixtures

Real-source run (recorded 2026-09-19) writes into the ignored directory
`backtester/tmp/gold-variable-coverage-20260919/`:

```powershell
node backtester/scripts/audit_gold_variable_coverage.js backtester/tmp/gold-fred-extended-20260918 backtester/tmp/gold-hourly-extended-20260918 backtester/tmp/gold-calendar-extended-20260918 backtester/tmp/gold-variable-coverage-20260919
```

Synthetic fixtures were generated once and are tracked; their intended defects and expected counts
are recorded in each file's `_fixture` block:

- `fred/DFII10.json`: eight hand-written rows with one withdrawn value and one revision.
- `fred/DGS2.json`: forty generated business-day rows from 2023-12-01.
- `hourly/candles.json`: 120 hourly bars from 2024-01-01T00:00Z to 2024-01-05T23:00Z, with
  2024-01-01T18:00Z omitted, 2024-01-02T15:00Z marked incomplete, plus one duplicate open time and
  one unparsable time.
- `events/events.json`: ten hand-written rows covering a duplicate release, an overlap group, missing
  actual/consensus/previous values, an all-day row, a non-US row and an invalid release time.

## Limits

- Availability is not association, causation, accuracy or profitability.
- Archived consensus values remain retrospective; no pre-release vintage exists in these sources.
- No XAU/USD session calendar is declared, so session gaps stay unclassified.
- The strict exact-24-hour evaluator and all frozen reports are unchanged.
- This milestone performs no combination search and no daily-direction qualification.

