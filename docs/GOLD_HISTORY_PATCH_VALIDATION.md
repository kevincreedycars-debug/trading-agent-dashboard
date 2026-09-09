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

## Isolation workflow generator and capture checker

The local generator now builds the three-node manual/read/capture graph directly from a supplied Gold export and the reviewed patch. It refuses source-parameter or patch drift, copies the Supabase node type/version, and omits all credentials and production connections. The source export must be freshly acquired before a runtime validation; the checked-in export only establishes a local candidate.

```powershell
node backtester/scripts/build_gold_history_isolation.js exports/gold_collector.json backtester/drafts/gold_collector_history_query_patch.json 2026-09-09 tmp/gold-history-isolation-NEW
```

The new directory contains `workflow.json` and `manifest.json`, with both input-byte and object hashes. Existing directories are refused. The read uses a fixed-date expression resolving to the exact reviewed query for the specified UTC date. This isolates pagination and ordering from wall-clock changes; it deliberately does not close the production `$now`/midnight gate. The generated workflow reads `market_snapshots` only and never creates fixtures. Use a captured independent reference from that source; provisioning any synthetic table is outside this generator.

After an authenticated manual execution, retain the exported inactive runtime workflow, an independent reference row array (exact projected fields), the capture node's n8n items array (`[{"json": {...}}]`), and an execution metadata file:

```json
{
  "id": "ACTUAL_EXECUTION_ID",
  "workflow_id": "ACTUAL_ISOLATED_WORKFLOW_ID",
  "runtime_version": "OBSERVED_INSTALLED_VERSION",
  "mode": "manual",
  "status": "success",
  "observed_page_size": 1000
}
```

The page size above is an example; obtain the real value from installed-node/request evidence. This metadata is a supplied assertion until authenticated against the runtime. Do not substitute synthetic test IDs or infer pagination merely from output length.

```powershell
node backtester/scripts/verify_gold_history_capture.js SOURCE.json PATCH.json MANIFEST.json RUNTIME_WORKFLOW.json REFERENCE_ROWS.json CAPTURED_ITEMS.json EXECUTION.json tmp/gold-history-comparison-NEW.json
```

The checker regenerates the candidate from the hashed source/patch and compares the runtime graph exactly. Only a Supabase credential reference on the read node and workflow-level server metadata are permitted; activation, node/settings/connection drift, pinning and static data are rejected. It reconciles every captured row against the independently sorted reference, rejecting missing/duplicate IDs, differing field values, field-shape drift, invalid timestamps, out-of-window dates and page-boundary ordering errors. IDs are compared in code-unit order; timestamp ordering retains nanosecond precision. The report exposes selected per-date IDs, exact-page-multiple/overflow coverage and all source hashes.

A passing comparison sets `supplied_capture_matches_reference: true`, while `installed_runtime_authenticated` remains false. Authentication, independent reference completeness, actual page requests and midnight/normalizer checks remain explicit operational gates. The checker does not automatically authorize deployment.

Local regression coverage includes empty, 1,000-, 1,001- and 2,000-row synthetic captures, equal-time IDs across page boundaries, data/graph mutations and command overwrite/hash guards. These validate the tools, not a real Supabase execution.
