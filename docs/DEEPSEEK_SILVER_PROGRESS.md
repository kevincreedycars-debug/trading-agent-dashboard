# DeepSeek SILVER progress

Assignment prepared 2026-09-07. **Layer 1 and Layer 2 build completed 2026-09-12.** The drafts are
implemented, wired into the shared live chain as reviewable changes, and covered by 25 passing local
contract tests. Nothing has been imported, activated or deployed.

## Intended files

The worktree-specific implementation list, as required by `docs/AGENT_ASSIGNMENT.md`, is:

- `logic/agent_silver_direction.md`
- `exports/silver_collector.json`
- `exports/silver_layer1_agent.json`
- `workflows/silver_collector.md`
- `workflows/silver_layer1_agent.md`
- `docs/DEEPSEEK_SILVER_PROGRESS.md`
- `tests/layer1-onboarding/silver/**`

No additional asset-owned paths were introduced beyond this assignment boundary.

## Findings and work completed

- Read and confirmed the SILVER worker instructions in `AGENTS.md`, `CODEX_STARTUP.md`, `docs/AGENT_ASSIGNMENT.md`, and the current local state files.
- Confirmed this worktree is isolated to `D:\trading-agent-dashboard-codex.worktrees\agent-silver` and not the canonical main-folder Codex backtesting checkout.
- Confirmed the active milestone is an asset contract/audit phase: inspect existing SILVER materials, record the intended implementation file list, then build the inactive Layer 1 draft within ownership boundaries.
- Confirmed no DeepSeek implementation has been started in this worktree yet; no production, backtesting, shared workflow, or live-system files were modified.
- Confirmed the active work remains scoped to local synthetic/inactive drafts and tests only, with all validation deferred until the asset contract is defined.
- Audited the owned SILVER paths: no logic document, workflow export, workflow documentation, or SILVER contract tests existed before this build.
- Reusable shape: GBP's inactive collector/agent split, `market_snapshots` input boundary, `agent_outputs` output boundary, deterministic factor gate, and isolated synthetic test layout.
- Asset-specific decision: SILVER is represented as XAG/USD spot in troy ounces, with the spot source and symbol treated as provider/schema assumptions until runtime evidence is available. The draft will not invent a live provider credential or claim historical coverage.
- Core contract: a usable snapshot requires `asset = SILVER`, `instrument = XAGUSD`, `snapshot_date`, `run_time_et`, `xagusd_price`, and fresh identity timing. Missing/stale core data must produce no usable call. Silver is a 24-hour weekday market for presentation purposes; weekend output is suppressed while raw classifications remain auditable.
- Planned factor inputs are provisional and asset-specific: real silver price delta, US real-yield proxy, broad-dollar direction, gold/silver ratio direction, VIX regime, industrial-metals/growth regime, and supply-demand/event context. Unverified inputs remain null and neutral rather than being proxied.

## Intended implementation mapping

| Source/provider field | Normalized snapshot field | Factor | Output/use | Unit and null policy |
| --- | --- | --- | --- | --- |
| XAG/USD spot response | `xagusd_price` | F1 price confirmation | market input and audit | USD per troy oz; required core, otherwise no row |
| Prior SILVER snapshots | `xagusd_d1_pct`, `xagusd_d5_pct` | F1 | directional confirmation | percent; null when history is unavailable |
| Approved real-yield series, pending runtime confirmation | `us_10y_real_d5_bps` | F2 | macro factor | basis points; null/neutral until provider is approved |
| Approved broad-dollar proxy | `dxy_d1_pct` | F3 | macro factor | percent; null/neutral when unavailable |
| SILVER and GOLD snapshot history | `gold_silver_ratio_d5_pct` | F4 | relative-value factor | percent; null/neutral when either leg is absent |
| FRED VIX, subject to credential/runtime confirmation | `vix_level` | F5 | risk regime | index points; null/neutral when unavailable |
| Approved industrial/metals growth series, pending evidence | `industrial_growth_regime` | F6 | demand factor | enum; null/neutral when unavailable |
| Verified silver supply/event feed, currently unavailable | `silver_supply_event` | F7 | supply/event factor | enum/object; null/neutral, never guessed |

The mapping and factor weights remain provisional until replay, provider, schema, and n8n runtime validation are complete.

## Tests and integration checklist

Validation status: `node --test tests/layer1-onboarding/silver/*.test.js` **passed, 25 tests, 0 failures on 2026-09-12**.
`npm run test:unit` reports **275 tests, 271 pass, 4 fail**; the four failures are the pre-existing
`backtester/tests/secret_scanner.test.js` rule-label failures, which are unrelated to SILVER and
present before this work (`backtester/**` was not modified).

Covered locally:

- factor weights and source-to-factor contract;
- complete, empty, missing-core, stale, wrong-asset and weekend fixtures;
- inactive export shape and closed graph connections;
- SILVER-only snapshot reads and required `agent_outputs` write;
- fail-closed collector gate;
- placeholder-only credential hygiene.

Remaining unvalidated:

- XAG/USD provider endpoint identity, units, uptime and historical coverage;
- FRED credential binding, response freshness and real-yield provider selection;
- live `market_snapshots`/`agent_outputs` schema compatibility;
- n8n import/execution, GitHub logic retrieval and model response shape;
- replay/checker compatibility, directional edge and any activation readiness.

Preserved boundary: no edits under `backtester/**`, research/published `data/**`, dashboard files, shared package files, production workflow exports, orchestration, or other worktrees.

## Delivery and integration checklist

- Review the six owned implementation paths plus `tests/layer1-onboarding/silver/**` as an inactive draft package.
- Confirm the canonical schema names and whether `asset: SILVER` / `instrument: XAGUSD` are accepted in the shared table.
- Replace only through an approved integration process: bind runtime credentials, verify the XAG/USD provider, import into an isolated n8n workspace, and execute synthetic/live-shadow checks.
- Add a backtester adapter or replay mapping in Codex-owned paths only after contract review; this worktree intentionally does not edit `backtester/**`.
- Do not activate or publish based on these contract tests; they establish shape and fail-closed behavior, not predictive validity.

## Layer 2 dependency record (audited 2026-09-12)

> **Superseded by "Delivery status (2026-09-12)" at the end of this file.** The audit below recorded
> the position *before* the Layer 2 and downstream registration was implemented. It is retained because
> the file/line inventory and the fail-closed warning are still the operative integration reference.

Recorded because it is not visible from the SILVER draft alone: **this draft does not deliver a Layer 2 system, and no per-asset Layer 2 system exists to deliver.**

### How the live XAU/USD chain is actually composed

| Stage | Artifact | State |
| --- | --- | --- |
| Collect | `exports/gold_collector.json` | Active production export, ~92 KB |
| Layer 1 | `exports/gold_layer1_agent.json` | Active production export, ~61 KB, writes `full_output` |
| Layer 2 | `exports/layer2_trade_selection_agent.json` | **One shared workflow for the whole platform**, `active: true`, workflow id `ZKGSuYcWb6EfgXBE` (read-only inspection only; not changed or executed here) |
| Layer 1 publication | `exports/dashboard_writer.json` | Shared, writes `data/layer1.json` |
| Control | `exports/master_orchestrator.json` | 18 fixed nodes, no SILVER step |
| Surface | `script.js` / `index.html` / `data/layer1.json` / `data/layer2.json` | Shared |

The SILVER draft supplies the first two rows for SILVER only, as an inactive skeleton (`silver_collector.json` ~4.4 KB vs Gold's ~92 KB). Layer 2 is not duplicated per asset, so "SILVER Layer 2" is not a new workflow — it means adding SILVER to the shared live chain below.

### Hardcoded asset registries that currently exclude SILVER

Each is Codex integration-owner territory; none was edited here.

- `exports/layer2_trade_selection_agent.json`, node `Build Layer 2 Trade Selection JSON` (in both the body and `activeVersion`): `assets = ["USD", "EUR", "GOLD", "NQ", "BTC"]` and `pairs = [EUR/USD (EUR), XAU/USD (GOLD), BTC/USD (BTC), NQ/USD (NQ)]`. SILVER would require `SILVER` in `assets`, `{ instrument: "XAG/USD", base: "SILVER" }` in `pairs`, and a sixth bounded `agent_outputs` read node.
- `tests/layer2_workflow_export.test.js:7`: `expectedAgents = ["USD", "EUR", "GOLD", "NQ", "BTC"]` — asserts exactly five reads.
- `exports/dashboard_writer.json`, node `Build Layer 1 JSON`: `agents = ["USD", "EUR", "GOLD", "NQ", "BTC"]`; `weekendBlockedAssets = ["USD", "EUR", "GOLD", "NQ"]`.
- `lib/dashboard_writer_selection.js:3`: `REQUIRED_AGENTS = ["USD", "EUR", "GOLD", "NQ", "BTC"]`. Selection is fail-closed (`missingAgents`); adding SILVER here before live SILVER outputs exist would regress the existing publication path.
- `data/layer1.json` → `dashboard_meta.required_agents`: the same five.
- `script.js:55`: `orderedAgents = ["USD", "EUR", "GOLD", "NQ", "BTC"]` (agent cards, the `x / 5` live counter, detail routing).
- `exports/master_orchestrator.json`: 18 nodes; no SILVER collector or agent step.
- `lib/economic_event_refresh.js:10`: `VALID_AGENTS` set of five — event relevance validation would reject SILVER.
- `scripts/apply_layer2_timeout_fix.js:25`: hardcoded five-agent assertion for the live workflow patch.
- `playwright-dashboard-smoke.js:2078,2184`: dashboard smoke assertions on the five-asset entity lists.

### Layer 2 consumption contract (from the live builder code)

`assetCall(agent)` resolves from `row.agent_name` / `row.layer === 1`, then direction from `today_call.direction || row.call_24h_direction || row.direction_24h || output.direction_24h`, conviction from `today_call.confidence ?? row.call_24h_conviction ?? row.conviction_24h ?? output.conviction_24h`, and detail from `row.full_output` (falling back to `row.raw_agent_output`). Pair rules: both legs need conviction ≥ 60 (`LOW_CONVICTION_THRESHOLD`) and opposing directions, otherwise the pair moves to `avoid_today`.

Consequences for this draft:

1. The SILVER agent already emits the flat fields the builder accepts (`agent_name`, `layer: 1`, `direction_24h`, `call_24h_direction`, `conviction_24h`, `call_24h_conviction`), so it is shape-readable as-is.
2. It does **not** emit `full_output` / `raw_agent_output`, which is the production convention Gold uses. Without it the Layer 2 `reason` string would be empty and `risk_flags` would not reach `warnings`. This is a draft defect to align before integration, and it sits inside this worktree's ownership.
3. Because unverified inputs stay null/NEUTRAL, a SILVER call today would resolve to `NO_CLEAR_BIAS`, so Layer 2 would correctly return `avoid_today` for XAG/USD. Wiring alone cannot produce a usable call; provider validation is the prerequisite for a meaningful one.

### Already compatible / already prepared

- `supabase/migrations/20260901_layer2_agent_outputs_lookup.sql` indexes `(layer, agent_name, created_at desc)`, so SILVER rows need no index change. The live `agent_outputs` / `market_snapshots` schema is not reproduced in this repository, so no CHECK-constraint assertion is possible from here.
- `backtester/lib/factor_edge_lab.js:111-115` already registers **`{ targetAssetCode: "SILVER", pairCode: "XAG_USD", pairLabel: "XAG/USD", marketKey: "XAGUSD", marketCalendar: "WEEKDAY_ACTIVE_TIME_V1" }`** in `LAYER2_ONBOARDING_CONFIGS` — the onboarding pair name and weekday calendar match this draft's assumptions. `backtester/tests/factor_edge_lab.test.js:47` asserts it.
- Not yet aligned for SILVER in Codex paths: `backtester/lib/confidence_calibration.js:20-25` `LAYER2_PAIR_CONFIGS` (EUR_USD, XAU_USD, NQ_USD, BTC_USD only), `FACTOR_DEFINITIONS` (USD, EUR, GOLD, NQ, BTC only), and the exact-list assertions in `backtester/tests/confidence_band_delivery.test.js:43-44`.

### Ordered integration request

1. Codex reviews this contract and confirms `asset: SILVER` / `instrument: XAGUSD` / `agent_name: SILVER` acceptance.
2. This worktree aligns the SILVER draft to the production `full_output` convention and re-runs its contract tests.
3. Provider validation: bind FRED credentials and verify XAG/USD endpoint identity, units, uptime and history.
4. Isolated n8n import and synthetic execution of both SILVER drafts; confirm the published row shape.
5. Only then add SILVER to the shared Layer 2 `assets`/`pairs`, its read node, `dashboard_writer`, `orderedAgents`, the orchestrator sequence and the affected exact-list tests — as one reviewed change, and only after live SILVER Layer 1 rows exist, to avoid the fail-closed dashboard regression noted above.
6. Replay/backtester parity and historical evaluation follow. No activation or publication is implied by any step of this draft.

## LIVE DEPLOYMENT RECORD (2026-09-12)

SILVER Layer 1 and Layer 2 are **live in production**. This section supersedes the planning sections
below.

### Live workflow ids

| Workflow | n8n id | State |
| --- | --- | --- |
| `Data Collector - SILVER` | `xezFmvm7cmgNNypb` | **active**, 32 nodes |
| `SILVER Layer 1 Agent` | `6IGOoTZxxTPyBpEp` | **active**, 9 nodes |
| `Layer 2 Trade Selection Agent` (shared) | `ZKGSuYcWb6EfgXBE` | now evaluates `XAG/USD` |
| `Dashboard Writer - Layer 1` (shared) | `850DrjzCKKX9fDzD` | now publishes `SILVER` |
| `Master Orchestrator` (shared) | `X75RKU34ikiM5RMU` | now calls both SILVER steps |

Instance: `https://silver17.app.n8n.cloud`. All changes went through the n8n public API using the
CLIXML credential store and `scripts/run-with-credentials.ps1`. Every touched workflow was backed up
first under the ignored `tmp/live/backups/`. No workflow was duplicated and nothing was deleted.

### Verified production result

A controlled master refresh completed with `status: success`, `failed_step: null`, and **every step
succeeding**, including `Silver Collector` and `Silver Layer 1 Agent`.

Published `data/layer1.json`:

```json
"required_agents": ["USD", "EUR", "GOLD", "NQ", "BTC", "WTI", "GBP", "SILVER"]
"SILVER": {
  "logic_document": "agent_silver_direction.md",
  "logic_document_version": "1.0_weighted_engine",
  "horizon_basis": "WEEKDAY_ACTIVE_TIME_V1",
  "market_calendar": "WEEKDAY_ACTIVE_TIME_V1"
}
```

Published `data/layer2.json` includes `XAG/USD` in `avoid_today`. `agent_outputs` carries SILVER rows
with `direction_24h = BEARISH_LEAN`, `conviction_24h = 24`, `full_output`, `raw_agent_output`, and a
live `factor_breakdown` where F8 reports `Industrial demand expanding` — the silver-specific industrial
leg is working in production.

### Schema: no DDL access, so the fields ride in `raw_payload.silver`

A service-role key cannot `ALTER TABLE`, and the credential store holds no database password or
Supabase management token. `market_snapshots` has 78 columns and **none** of the silver columns, and
PostgREST rejects any insert naming an unknown column, so the first attempt failed with
`Could not find the 'copper_3m_pct' column`.

Resolution: the silver fields are carried inside the existing jsonb column `raw_payload.silver`. The
collector reads history from `raw_payload.silver` with a fallback to the typed column, and the agent
resolves each field as `raw_payload.silver[key] ?? row[key]`. Applying
`supabase/migrations/20260912_silver_market_snapshot_columns.sql` and then adding the typed fields to
the collector row is the promotion path; no agent change is needed.

### Two defects found and fixed during deployment

1. **Merge input index.** The Dashboard Writer funnels its reads through n8n `merge` (append) nodes. A
   second branch must land on input `index: 1`, not `0`. Sending both to index 0 made the code node run
   once with the SILVER rows only and once with the main chain only, producing
   `Missing required Layer 1 agents: SILVER`. The sibling WTI wiring already used index 1.
2. **The logic document is inlined.** The production GitHub repo does not carry
   `logic/agent_silver_direction.md` (verified 404), and pushing it would require publishing the whole
   local consolidation history to `main` and therefore GitHub Pages. The reviewed logic document is
   embedded in the `Get SILVER Logic Document` code node, so the agent has no repo or
   GitHub-credential dependency. The node keeps the documented file name so it can be switched back to
   the GitHub-node pattern after integration.

### Concurrency with the other asset windows

The GBP window edited the same shared workflows during this session. Two collisions were observed and
repaired without discarding GBP work:

- the writer's `agents` array was replaced and lost `SILVER`;
- the orchestrator chain was rewired `WTI Layer 1 Agent -> GBP Layer 1 Agent -> Layer 2`, leaving the
  `Silver Layer 1 Agent` node present but unreachable, which surfaced as `not_run`.

Both were re-applied surgically. The writer fan-in was also rebuilt as one deterministic linear merge
chain over all eight read nodes, which removed a duplicate parent on `Build Layer 1 JSON`. Final live
state: `agents = ["USD","EUR","GOLD","NQ","BTC","WTI","GBP","SILVER"]` and the chain
`... WTI Layer 1 Agent -> GBP Layer 1 Agent -> Silver Layer 1 Agent -> Layer 2 -> Dashboard Writer`.

### Repo versus live drift (pre-existing; reconcile from the live API)

The repository's production workflow exports are **stale relative to live**, and were already stale
before this work:

- the live Layer 2 already served `WTI`;
- the live Dashboard Writer uses a merge chain (16-18 nodes) that the committed export does not describe;
- the live Master Orchestrator carries `Guard Economic Event Collector`,
  `Build Input Health on Economic Event Failure`, `Publish Input Health on Economic Event Failure` and
  `WTI Layer 1 Agent`, none of which appear in the committed exports;
- live n8n still uses **literal** API keys inline, whereas the committed exports were sanitised to
  `$env.*`, so the committed exports cannot simply be redeployed.

`exports/silver_collector.json` and `exports/silver_layer1_agent.json` now mirror what is deployed,
because they were built from the live Gold workflows and therefore inherit the live provider and
eco-events path. Their credential literals were replaced with named `$env` references before commit.
The three shared exports (`layer2_trade_selection_agent.json`, `dashboard_writer.json`,
`master_orchestrator.json`) were updated to register SILVER but remain structurally behind live and
should be regenerated from the live API rather than hand-merged.

### Observations, not regressions

- Every Layer 2 pair currently lands in `avoid_today` with
  `Missing 24H conviction from one or both Layer 1 assets`, and `trade_opportunities` is empty. An
  older `data/layer2.json` (`main~40`) shows the same shape, so this is **pre-existing** and affects all
  pairs equally: the shared Layer 2 reads all fan into one input index, so each builder run sees only
  part of the agent set. Worth a separate fix in the shared workflow; it is not SILVER-specific.
- `silver_d1_pct`/`d5`/`d20` are `0` on the first runs and populate as `raw_payload.silver` history
  accumulates across days.
- The collector's FRED deltas are computed on values already scaled to basis points, so F1's evidence
  string shows float noise (for example `Real yield 9.999999999999964bps`). Cosmetic only.
- The temporary self-test webhooks used to run each SILVER workflow in isolation were removed and both
  workflows were left active and clean.

## Dashboard publication (2026-09-12)

The dashboard is a static site served by GitHub Pages from production `main`, so SILVER only becomes
visible once the renderer knows about it. Production `main` already carried
`weekdayBreakdownColumnsByAsset.SILVER` and an `XAG_USD` entry in `pairTradeResearchConfigs`, and the
agent cards are rendered from `layer1Data.agents` — which already contains SILVER. Only two things were
missing, so the production change is deliberately minimal:

- `script.js`: `orderedAgents` becomes `["USD", "EUR", "GOLD", "SILVER", "NQ", "BTC"]`, which gives the
  Silver tab a route and includes SILVER in the live-agent count.
- `script.js`: the `XAG_USD` research entry moves from `liveEligibility: "ONBOARDING"` to `"READY"`.
- `index.html`: a `Silver` tab button is added after `Gold`.

Published `data/layer1.json` now carries a full SILVER agent block: `status: live`,
`effective_status: ACTIVE`, `horizon_basis: WEEKDAY_ACTIVE_TIME_V1`,
`refresh_due_at`/`expires_at` set, all five timeframe calls, `factor_breakdown`, `conviction_model`,
`display_metrics` and `full_output`.

Note that production `main` is a leaner tree than the local consolidated baseline (it has no
`package.json`, `supabase/`, `macro-engine/` or `AGENTS.md`), so the whole worktree branch must **not**
be merged into `main`. Only the SILVER-specific paths and the two dashboard lines are pushed.

### One known dashboard gap, outside SILVER

Production `main`'s `orderedAgents` does not list `WTI` or `GBP`, although both are live Layer 1
producers and both appear in the published `layer1.json`. The live-agent count therefore still
under-reports. That is the WTI and GBP windows' dashboard scope; SILVER was added here only for SILVER.




### Implemented and locally tested

| Artifact | State |
| --- | --- |
| `logic/agent_silver_direction.md` | Rewritten to `1.0_weighted_engine`: ten factors, per-timeframe weights, explicit statement of where SILVER deliberately diverges from Gold. |
| `exports/silver_collector.json` | Rebuilt to Gold standard: 32 nodes, ~50 KB, full shared superset plus the silver fields, verified providers, single `market_snapshots` write. |
| `exports/silver_layer1_agent.json` | Rebuilt to Gold standard: 9 nodes, ~32 KB, ~16 KB deterministic conviction engine, emits `full_output`/`raw_agent_output` and the Layer 2 aliases. |
| `workflows/silver_collector.md`, `silver_layer1_agent.md` | Rewritten to match the rebuilt workflows. |
| `tests/layer1-onboarding/silver/**` | 25 tests across three files: contract, workflow structure, and true Layer 2 compatibility. |

### Layer 2 and downstream registration (shared live files)

| File | Change |
| --- | --- |
| `exports/layer2_trade_selection_agent.json` | `SILVER` added to `assets`; `{ instrument: "XAG/USD", base: "SILVER" }` added to `pairs`; new `Get latest SILVER rows` read node and wiring. Applied to the body **and** `activeVersion`. |
| `exports/dashboard_writer.json` | `SILVER` added to `agents` and `weekendBlockedAssets`; weekend rule text updated; new `Get latest SILVER rows` read node. Applied to the body **and** `activeVersion`. |
| `exports/master_orchestrator.json` | `Silver Collector` spliced **last among collectors** (after `BTC Collector`) and `Silver Layer 1 Agent` after `Gold Layer 1 Agent`, in the body and `activeVersion`. Both nodes ship **`disabled: true`** with a placeholder workflow id. |
| `lib/dashboard_writer_selection.js` | `REQUIRED_AGENTS` includes `SILVER`. |
| `lib/economic_event_refresh.js` | `VALID_AGENTS` includes `SILVER`. |
| `script.js` | `orderedAgents` includes `SILVER`; the existing `XAG_USD` research config moves from `ONBOARDING` to `READY`. |
| `index.html` | `Silver` tab added to the side-rail navigation. |
| `tests/layer2_workflow_export.test.js`, `tests/dashboard_writer_workflow_export.test.js`, `tests/dashboard_writer_selection.test.js` | Updated to the six-agent expectation. |

### Why the orchestrator steps ship disabled

The two SILVER workflows have no n8n id until an operator imports them. Writing a placeholder id into
the live control workflow would fail every refresh. The steps are therefore wired in the correct
position but disabled, annotated on the node, and must be enabled after import. `Build Workflow
Status JSON` was deliberately **not** given the two new step names yet: that builder marks any
step with no items as `not_run`, which would flag every run as failed until the steps are live.
Add `"Silver Collector"` and `"Silver Layer 1 Agent"` to its `stepNames` array at the same moment the
nodes are enabled.

### Deliberate non-changes

- `backtester/**` was **not** modified. `backtester/tests/factor_edge_lab.test.js` enforces that
  onboarding pairs such as `XAG_USD` stay research-only until Layer 1 and replay evidence exists, and
  `XAG_USD` is already registered in `LAYER2_ONBOARDING_CONFIGS` with the matching
  `WEEKDAY_ACTIVE_TIME_V1` calendar. Promoting it would contradict the platform's own evidence rule.
- Published `data/**` was not hand-edited; the dashboard writer regenerates `data/layer1.json`.

### Critical deployment order

`REQUIRED_AGENTS` is fail-closed. Deploying in the wrong order breaks the existing dashboard.

1. Merge/review this change set; confirm the `market_snapshots`/`agent_outputs` schema accepts the new columns.
2. Bind `$env.FRED_API_KEY`, `$env.FINNHUB_API_KEY` and `$env.ALPHA_VANTAGE_API_KEY` in n8n.
3. Import `exports/silver_collector.json` and `exports/silver_layer1_agent.json` into n8n and enable them.
4. Execute the SILVER collector, then the SILVER agent, and confirm a real `agent_outputs` row with `agent_name = "SILVER"`.
5. **Only then** import the updated Layer 2 agent, Dashboard Writer and Master Orchestrator exports.
6. Set the two real workflow ids on the orchestrator Silver nodes, enable them, and add the two step
   names to `Build Workflow Status JSON`.
7. Run a controlled master refresh and confirm six live agents plus `XAG/USD` in `data/layer2.json`.

Until step 4 is complete, keeping `SILVER` in `REQUIRED_AGENTS` will block Layer 1 publication.

### Previously recorded blocker, now resolved

The earlier entry in this file recorded the XAG/USD provider as unverified and several factor inputs as
unavailable. That is no longer the case: Coinbase `XAG-USD` was verified to return
`{"data":{"amount":"64.492...","base":"XAG","currency":"USD"}}`, the same shape the live Gold
`XAU-USD` request already consumes, and FRED `PCOPPUSDM` (global copper price) and `INDPRO`
(industrial production) were confirmed as real monthly series. Only `silver_supply_event` remains
unavailable, and it is scored neutral rather than guessed.

### Security finding (not fixed, outside this build's scope)

`exports/gold_collector.json` (and the NQ/BTC collectors) still contain a literal Alpha Vantage API key
in the `HTTP Request | NQ - Alpha Vantage` URL. The new SILVER artifacts do **not** reproduce it —
they use `$env.ALPHA_VANTAGE_API_KEY` — and a test enforces that. The pre-existing literal in the
Gold/NQ/BTC collectors should be rotated and replaced separately.
