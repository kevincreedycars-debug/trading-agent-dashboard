# Session notes

2026-09-09: Gold isolated-runtime tooling built; no remote execution performed.

Canonical folder: `D:\trading-agent-dashboard-codex`. Started clean at `acd4e73` on `review/gold-timestamped-contract`; new local task branch is `review/gold-history-isolation`. Gold v2 repairs (`730fc4c`) and the offline normalizer package (`acd4e73`) remain preserved. No production push, workflow import/activation, database mutation or frozen-report rewrite occurred.

Added `gold_history_isolation.js`, generation and capture-verification CLIs, and six focused regression tests. The generator requires unchanged reviewed source/patch parameters, emits only an inactive manual/read/capture graph, copies the Supabase node version, omits credentials, freezes the query date and hashes source bytes/objects. The checker regenerates the candidate and rejects graph, activation, pinning, execution identity, row-shape/content/order, timestamp, missing-row and duplicate-ID failures. It retains explicit unauthenticated-runtime and production-not-applied flags.

Generated candidate: ignored `tmp/gold-history-isolation-20260909/workflow.json` and `manifest.json`. This uses the checked-in export, not a fresh live export. Fixed-date query testing does not validate production `$now` or midnight behavior. The guide `GOLD_HISTORY_PATCH_VALIDATION.md` contains exact commands, expected evidence formats and remaining gates.

Focused tests pass 6/6, including empty/exact-page/overflow captures, nanosecond/offset ordering, lower date boundary, graph mutations and CLI overwrite/hash guards. `npm test` passed 297/297; after the final additional boundary test, `npm run test:unit` passed 268/268 with no failures/skips/cancellations; ignored log `tmp/gold-history-isolation-tests-20260909.log`.

Access checks: no n8n/Docker executable, no N8N_BASE_URL/N8N_API_KEY environment variables, no n8n connector in available tools, and CUA inventory returned no connected browsers/apps. No credentials were displayed or retrieved from unrelated stores. This blocks installed-node execution, not the completed local tooling.

Next immediate action: acquire a fresh Gold workflow export and establish the inactive manual-only runtime target once authenticated n8n access is available. Retain an independent reference, actual request/page-size evidence and raw execution/workflow exports before comparison. Production deployment and fresh-data collection remain separate milestones. Layer 1 stays independent; macro/optimization remain parked; separate asset-builder workspaces were not modified.
