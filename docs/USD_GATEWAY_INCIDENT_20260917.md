# USD Collector gateway failure - September 17, 2026

The dashboard reported a fresh failure at USD Collector during request `52c49cc3-8951-4199-b253-6ef2366b595b`, despite a new Layer 1 ingest at 22:07:51 London time.

## Confirmed failure

USD execution 3976 failed at 21:01:19 UTC on its first HTTP request, FRED DGS2 observations, with HTTP 502 and an HTML Bad Gateway response. It failed before storing a snapshot. The September 11 `executeOnce: true` repair was intact; the node had no retry policy. This was a gateway response, not the previous demonstrated 429 request-multiplication incident. The response alone does not identify which upstream gateway failed.

Master 3974 continued through the other collectors, eight Layer 1 agents, Layer 2 and Dashboard Writer. Its n8n execution status was success even though the USD child failed. Writer 3991 completed at 21:07:53 UTC. Thus fresh publication and a collector failure coexisted; the dashboard failure was not disproved by a fresh ingest.

USD agent 3982 selected fresh shared snapshot `034c310f-8cc8-42cc-a4ba-e6912099c05c`, stored at 21:05:37 UTC by the Silver collector. Its selection rule was `latest_usd_usable_snapshot`; the row was partial and missing `latest_us_event`. It did not use another agent's output. No snapshot-selection or agent logic was changed during this repair.

## Repair

Added n8n bounded retry settings only to the USD collector's first static FRED GET: `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`. The single-run flag remains intact. Persistent failure still stops the collector; errors are not converted into values or suppressed. Other nodes, query parameters, credentials and connections are preserved.

`scripts/repair_usd_gateway.js EXECUTION_ID [--apply]` defaults to read-only. Its planner requires the matching USD 502 execution, expected FRED DGS2 GET, active/editable/executed node agreement and no existing retry policy. Application checks concurrent drift, saves a local full-workflow backup and verifies saved and active nodes/connections. The sanitized local export records the same settings; it was not imported wholesale.

Backup: ignored `tmp/n8n-backups/usd-gateway-1789679519531.json`. Original execution captures: ignored `tmp/usd-incident-execution-{3974,3976,3982}.json`.

## Recovery verification

One fresh Master request was accepted with HTTP 200 at `2026-09-17T21:12:01.940Z`, request ID `4fddc472-d9d2-4b98-9fbc-8e787ef983e2`, confirmed in Master 3992's trigger. USD 3994 succeeded, its FRED entry returned one item, and it stored one snapshot. All six market collectors 3994-3999 succeeded, each storing one snapshot. Economic Events 3993, all eight Layer 1 agents 4000-4007, Layer 2 4008 and Writer 4009 succeeded. Master 3992 finished at `21:16:18.516Z`.

Public GitHub Pages independently returned `success`, `failed_step: null`, `Manual Refresh Complete`, finished `2026-09-17T21:16:17.493Z` (22:16:17 London). The raw GitHub URL still returned the earlier failed artifact during this check; its propagation is not claimed. The public status steps omit GBP, but the authenticated execution evidence confirms GBP 4006 succeeded. No status-schema changes were made. Original browser request association remains based on the user's message and timing; only the recovery request ID was verified directly in its execution.

The provider request succeeded during this run; this does not prove a retry was exercised. The deployed bounded retry settings were verified in both saved and active workflow versions. No old partial execution was resumed.

Focused repair tests passed 2/2; the combined existing/new repair regressions passed 9/9. Full local `npm test` passed 333/333, with no failures, skips or cancellations. Log: ignored `tmp/usd-gateway-tests-20260917.log`. Raw recovery captures stay ignored under `tmp/usd-gateway-recovery-*.json`.

This repair addresses transient request resilience. It does not establish input completeness, trading performance, or guarantee provider availability. The separate Gold history repair remains unapplied.
