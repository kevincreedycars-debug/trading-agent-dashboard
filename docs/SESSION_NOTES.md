# Session notes

2026-09-11: recurring live refresh failure traced to collector item multiplication.

Branch `fix/btc-collector-rate-limit`. User authorized fixing the live failure. USD 3549 received 16 economic-event rows and requested each FRED series 16 times, exhausting the rate limit; EUR/Gold/NQ/BTC then failed immediately with 429. This is distinct from September 9's FRED 403 and earlier CoinGecko 429. The CoinGecko repair remains intact.

Commit `3ec4488` recorded the repair intent, guarded command, five sanitized export changes and tests, and was pushed before production changes. Each active collector now sets executeOnce on its initial static DGS2 HTTP request. No credential/source/history/normalization/connection changes, no error suppression, no cross-agent dependencies. Every workflow was backed up under ignored `tmp/n8n-backups/` and its saved/active nodes and connections verified.

Local `npm test` passed 305/305. USD retry 3561 succeeded but reused earlier cached 16-item outputs; EUR retry 3562 succeeded from the first HTTP node. Full Master refresh accepted at 07:52:33.775 UTC. Fresh USD 3565 took 16 trigger items and returned one item per HTTP node, storing one snapshot. EUR 3566, Gold 3567, NQ 3568 and BTC 3569 all succeeded with one item per HTTP node and one stored snapshot. Layer 1 agents 3570-3574, Layer 2 3575 and Writer 3576 succeeded. Master 3563 completed at 07:56:08.664 UTC. Public Pages and raw production status both report success at 07:56:07.390 UTC, no failed step, Manual Refresh Complete. Raw evidence: ignored `tmp/single-run-execution-ID.json`, `tmp/single-run-refresh-request.json`, `tmp/single-run-public-*.json` and local test log.

Existing input incompleteness stays explicit: missing historical metrics and latest economic-event fields leave snapshots partial. Workflow recovery does not establish complete inputs, causal timing or trading edge. The live incident is closed; Gold history isolation is the next objective and its prepared repair is not deployed. Separate asset-builder worktrees were untouched.

Authenticated runtime access works through the scoped encrypted credential runner in `CREDENTIAL_CONTINUITY.md`. Empty environment variables outside the runner are intentional. Do not print secrets. Next action: resume Gold history isolation as the single active milestone.
