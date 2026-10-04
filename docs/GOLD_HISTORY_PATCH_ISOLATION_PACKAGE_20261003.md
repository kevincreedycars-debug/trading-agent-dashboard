# Gold collector history patch - isolated validation package

Prepared 2026-10-03. Status: the offline evidence and the isolated workflow bundle are built and their
hashes recorded; the installed-runtime acceptance is **not** run, the live `Data Collector - GOLD`
node is untouched, and the draft patch keeps its own status, `LOCAL_REVIEW_ONLY_NOT_APPLIED`.

This note is the package's index. It adds nothing to the requirements in
`docs/GOLD_HISTORY_PATCH_VALIDATION.md`, which stays the authority for what the isolated run must
demonstrate; it records what was produced today, where it is, what to do with it and what is still
outstanding.

## What was produced today, and where

| Artifact | Path | Hashes and result |
| --- | --- | --- |
| Offline regression test | `backtester/tests/gold_history_patch_validation.test.js` | 2 tests, 2 pass, 0 fail |
| Offline validation report | `tmp/gold-history-validation-20261003.json` (ignored) | 6 checks, 0 failed, 600 synthetic rows; `workflow_export_sha256` `7a7d5b7f…`, `patch_sha256` `e7f4ee74…` |
| Isolated workflow bundle | `tmp/gold-history-isolation-20261003/` (ignored) | `workflow.json` + `manifest.json`; `candidate_object_sha256` `f76d25ad…`, `credentials_included: false`, `runtime_executed: false`, `production_applied: false` |

The bundle's manifest fixes the read to one UTC date rather than the wall clock:
`cutoff_date` `2026-10-03`, `lower_date` `2026-08-04`, and the resolved query

```
and=(snapshot_date.lt.2026-10-03,snapshot_date.gte.2026-08-04)&order=snapshot_date.desc,run_time_et.desc,id.desc&select=id,snapshot_date,run_time_et,gold_price,btc_price,nq_price,btc_dominance,total_crypto_market_cap,stablecoin_supply
```

with `source_node_type_version` 1 and the nine projected field names. Its stated limitation is the one
that matters for the acceptance: a fixed-date harness does not validate the production `$now`
evaluation or a midnight-crossing normalization.

Reproduce all three, from the canonical checkout:

```powershell
node --test backtester/tests/gold_history_patch_validation.test.js
node backtester/scripts/validate_gold_history_patch_offline.js tmp/gold-history-validation-<NEW>.json
node backtester/scripts/build_gold_history_isolation.js exports/gold_collector.json backtester/drafts/gold_collector_history_query_patch.json 2026-10-03 tmp/gold-history-isolation-<NEW>
```

Both writers refuse an existing destination, so a fresh path is required for each run and no earlier
evidence is overwritten. The inputs used were `exports/gold_collector.json` (the checked-in export,
90,759 bytes) and `backtester/drafts/gold_collector_history_query_patch.json` (1,878 bytes, unchanged).
The generator refuses source-parameter or patch drift, so a stale source fails loudly rather than building a candidate against the wrong node.

## What the isolated run has to be

Per `docs/GOLD_HISTORY_PATCH_VALIDATION.md`, and nothing weaker:

1. A **new inactive** validation workflow with a **manual-only** trigger, carrying the same installed
   Supabase node type/version, the candidate query and a terminal inspection output.
2. No database-write, production subworkflow, publish or notification node, and no link from normal or
   TEST orchestration. The bundle satisfies this by construction: three nodes and two connections, no
   credential value and no credential reference at all (`credentials_included: false`), `active: false`,
   with the read node's credential to be bound by hand inside the isolated instance.
3. A synthetic fixture table/schema or a read-only source with a captured immutable reference result.
   **Do not create fixtures in the production market table** - the generated workflow only reads
   `market_snapshots` and never provisions or writes anything.
4. A **freshly acquired** source export before a runtime validation: import into the isolated instance
   from the export captured for that run, not from the checked-in one. Re-acquire and re-hash if the
   export differs; any source-parameter or patch drift means a fresh diff, not a reused bundle.
5. The original target node's parameters verified against the patch's `expected_parameters`
   (`getAll`, `market_snapshots`, limit 25) before the candidate is built; the production node's id,
   name, position, credentials and connections kept intact in the proposed diff, and the whole
   production graph **not** imported into the harness.
6. Credential binding and runtime-version evidence kept in the ignored local evidence directory with
   secrets omitted.

Then, after an authenticated manual execution, retain: the exported **inactive** runtime workflow, an
independent reference row array with the exact projected fields, the capture node's n8n items array
(`[{"json": {...}}]`), and an execution metadata file:

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

`observed_page_size` is the real value from installed-node/request evidence, never an inference from
output length.

## Verifying the capture

```powershell
node backtester/scripts/verify_gold_history_capture.js SOURCE.json PATCH.json MANIFEST.json RUNTIME_WORKFLOW.json REFERENCE_ROWS.json CAPTURED_ITEMS.json EXECUTION.json tmp/gold-history-comparison-<NEW>.json
```

A passing report sets `supplied_capture_matches_reference: true` and still leaves
`installed_runtime_authenticated` false. It reconciles every captured row against the independently
sorted reference, rejecting missing or duplicated IDs, differing field values, field-shape drift,
invalid timestamps, out-of-window dates and page-boundary ordering errors, and rejects activation,
node/settings/connection drift, pinning and static data in the runtime graph. The checker does not
authorise deployment.

## The acceptance checklist the isolated run must close

1. Resolved query bounds at a fixed UTC date, with strict exclusion of that date and future dates and
   inclusion of the lower bound.
2. More rows than one installed-node page, including boundary rows and an exact-page-size case; no
   lost or duplicated IDs and no hidden cap.
3. Global snapshot-date / run-time / ID descending order, including equal timestamps straddling pages.
4. Complete projected field names and an n8n item shape compatible with the exact exported normalizer.
5. Per-date selection and independently calculated 1/5/20-observation values, with the empty and
   short-history fallbacks disclosed.
6. UTC-midnight behaviour, the runtime execution ID, inactive/manual-only graph evidence and no
   side-effect nodes.

## What this package is not, and what still gates the live node

- It is not a production change. No workflow was imported, activated, edited or executed; no
  credential was read, stored or moved; no warehouse or database write occurred; nothing was
  published.
- The collector fault is **still live**. The Gold history read behind it remains the unordered
  limit-25 query until the patch is applied, so the June 6-9 anchoring the patch describes is
  unchanged in production.
- A passing local harness cannot close the runtime checks, and the checked-in export only establishes
  a local candidate - the isolated run needs a fresh export for its own run.
- Before the live node is patched, still owed: the isolated acceptance above, a drift re-check against
  the live workflow immediately before applying, page-size evidence from the installed node, explicit
  evidence for the `$now` / UTC-midnight cutoff, and the user's own authorisation to change a live
  production workflow. Applying it is its own milestone, separate from this package.
- Independent of all of the above: 60 calendar days is an operational retrieval bound and not a
  guarantee of twenty valid trading observations, and provider gaps, invalid prices and source
  vintages stay separate concerns.

