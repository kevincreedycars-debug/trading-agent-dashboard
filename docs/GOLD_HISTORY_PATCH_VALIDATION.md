# Gold history patch validation package

Prepared 2026-09-09. Status: offline consumer checks passed; installed n8n validation and production application remain outstanding.

The unchanged patch is `backtester/drafts/gold_collector_history_query_patch.json`. It replaces the unordered 25-row read with a bounded 60-calendar-day, prior-UTC-date query ordered by snapshot date, run time and ID descending. `returnAll: true` requests all pages. This does not itself prove the installed node executes that query or paginates correctly.

## Reproduce the offline evidence

```powershell
node --test backtester/tests/gold_history_patch_validation.test.js
node backtester/scripts/validate_gold_history_patch_offline.js tmp/gold-history-validation-NEW.json
```

Use a new report path. The command refuses replacement, reads only the checked-in workflow and patch, executes the exported `Normalise Market Snapshot` code with synthetic node responses, and records hashes of both input files and the exact normalization code. It has no network or workflow API operations. Raw reports stay ignored.

Six checks exercise UTC bounds across spring/autumn DST dates and year rollover; 600 rows across 30 dates; independent 1/5/20-observation percentage expectations; truncated history; same-day/future-date exclusion; duplicate-date selection; and the existing empty/short-history fallback. Query serialization and node-item access are mocked. The row count exceeds a typical page but no actual n8n pagination claim follows from it.

## Findings to retain

- The normalizer sorts by parsed `run_time_et`, then retains the first row per snapshot date. Equal run timestamps retain incoming order. Server ID-descending order must therefore survive pagination and item delivery.
- An empty history produces zero Gold changes; short history substitutes shorter lookbacks. This is preserved behavior, not proof that those features are adequately observed.
- The patch filters snapshot dates, not `created_at` availability. Historical replay needs an independent availability cutoff; this query is an operational collector repair.
- The query uses `$now` and the normalizer creates its own clock. A run crossing UTC midnight needs explicit installed-runtime evidence before claiming one consistent retrieval cutoff.
- Sixty calendar days do not guarantee twenty valid trading observations. Provider gaps, invalid prices and source vintages remain separate concerns.

## Isolated runtime acceptance

Prepare a new inactive validation workflow with a manual-only trigger, the same installed Supabase node type/version, the candidate query and a terminal inspection output. It must contain no database-write, production subworkflow, publish or notification nodes and no links from normal or TEST orchestration. Use a synthetic fixture table/schema or a read-only source with a captured immutable reference result; do not create fixtures in the production market table. Credential binding and runtime version evidence belong in the ignored local evidence directory, with secrets omitted.

Capture and hash the fresh source workflow export and patch before constructing the candidate. Verify the original target node parameters match the expected patch parameters; any drift requires a fresh diff. Keep production node identity/connections intact in the proposed diff, but do not import the whole production graph into the isolation harness.

The runtime evidence must demonstrate:

1. Resolved query bounds at a fixed UTC date, strict exclusion of that date/future dates and inclusion of the lower bound.
2. More rows than one installed-node page, including boundary rows and an exact-page-size case; no lost or duplicated IDs and no hidden cap.
3. Global snapshot-date/run-time/ID descending order, including equal timestamps straddling pages.
4. Complete projected field names and n8n item shape compatible with the exact exported normalizer.
5. Per-date selection and independently calculated 1/5/20-observation values, with empty/short-history fallbacks disclosed.
6. UTC-midnight behavior, runtime execution ID, inactive/manual-only graph evidence and no side-effect nodes.

Record installed node/runtime versions, execution IDs, source/candidate hashes, row counts, selected IDs and discrepancies. A passing local harness cannot close these checks. Production deployment remains a separate milestone after reviewing the isolated result and current live drift. Fresh source-quality collection follows deployment; old inspected outcomes remain consumed evidence.
