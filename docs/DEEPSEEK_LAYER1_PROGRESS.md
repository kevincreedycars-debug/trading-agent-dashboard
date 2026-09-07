# DeepSeek / Cline Layer 1 Onboarding Progress

Coordination owner: DeepSeek/Cline workstream.
Coordination document: `docs/PARALLEL_AGENT_HANDOFF.md` (read this file at the start of every DeepSeek session).
Repository: `trading-agent-dashboard` (worktree `half-l2l-research-20260809`, branch `research/half-l2l-reach-20260809`).
First session: 2026-09-05.

## File ownership

### DeepSeek-owned (may create / edit)

- `logic/agent_gbp_direction.md` (GBP Layer 1 draft logic document).
- `workflows/gbp_collector.md`, `workflows/gbp_layer1_agent.md` (draft workflow documentation).
- `exports/gbp_collector.json`, `exports/gbp_layer1_agent.json` (reviewable n8n-export-shaped draft workflows).
- `tests/layer1-onboarding/**` (isolated contract tests, helpers, fixtures).
- `docs/DEEPSEEK_LAYER1_PROGRESS.md` (this file).
- Future asset drafts for confirmed additional assets (Silver/WTI remain candidates only until ordered).

### Codex-owned (read-only for DeepSeek)

- `backtester/**` (engine, replay, dataset construction, research evaluation, backtesting UI/tests).
- Research outputs in `data/`.
- Backtesting-related tests and UI changes.

### Shared integration files (one editor at a time; DeepSeek proposes changes in this file instead of editing)

- `index.html`, `script.js`, `styles.css`, `package.json`, lockfiles, `data/layer1.json`, `data/layer2.json`.
- Existing production workflow exports and `exports/master_orchestrator.json`, `exports/dashboard_writer.json`.
- Live workflow activation/deployment, credentials, orchestration triggers.

## 2026-09-05 session - intended file list (recorded before editing)

Task (from `docs/PARALLEL_AGENT_HANDOFF.md` first task): audit the existing GBP draft, then build its collector and Layer 1 agent drafts with isolated contract tests.

Intended changes:

1. `logic/agent_gbp_direction.md` - extend the GBP draft logic document (append-only; existing weights, Version and Status lines preserved) with an explicit 24H output contract, required snapshot inputs, missing/stale handling, provider availability evidence, and fail-closed rules.
2. `workflows/gbp_collector.md` - new draft workflow doc for the GBP collector.
3. `workflows/gbp_layer1_agent.md` - new draft workflow doc for the GBP Layer 1 agent.
4. `exports/gbp_collector.json` - new reviewable n8n-shaped draft workflow (collector).
5. `exports/gbp_layer1_agent.json` - new reviewable n8n-shaped draft workflow (Layer 1 agent).
6. `tests/layer1-onboarding/helpers/gbpSnapshotContract.js` - isolated helper (input contract, provider availability, missing/stale assessment).
7. `tests/layer1-onboarding/gbp_snapshot_contract.test.js` - missing/stale input handling, asset independence, weekend rule.
8. `tests/layer1-onboarding/gbp_workflow_drafts.test.js` - schema compatibility, Layer 1 isolation, secret hygiene, logic-doc <-> draft weight consistency, field contract.
9. `tests/layer1-onboarding/fixtures/*.json` - local snapshot fixtures.
10. `docs/DEEPSEEK_LAYER1_PROGRESS.md` - ownership and progress (this file).

Out of scope this session: backtester engine/replay edits (Codex), live n8n changes, workflow activation, dashboard integration, data/layer1.json publication, other asset drafts.

## GBP draft audit (2026-09-05)

### Existing GBP draft assets

- `logic/agent_gbp_direction.md` - 24H-only research-baseline factor draft. Weights F1..F10: 20/16/20/12/8/10/6/4/2/2 (sum 100). Status: research onboarding only.
- `backtester/replay/gbp/gbp_replay_core.js` + `backtester/tests/gbp_replay_core.test.js` (Codex-owned, uncommitted). Deterministic 24H scoring uses `LIVE_24H_FACTOR_WEIGHTS` matching the logic doc and consumes snapshot fields: `boe_bias`, `uk_2y_d5_bps`, `us_uk_2y_spread_d5_bps`, `latest_uk_event`, `uk_composite_pmi`, `uk_composite_pmi_direction`, `gbpusd_d1_pct`, `dxy_d1_pct`, `vix_level`, `global_growth_regime`, `uk_stress_flag`.
- No GBP collector/agent exports, no GBP workflow docs, no `tests/layer1-onboarding/` yet.

### Reference contracts used

- EUR collector export (`exports/eur_collector.json`) shows the `market_snapshots` row conventions (snapshot_date, run_time_et, source_status, collector_version, FRED/Coinbase price+delta columns, data_quality, raw_payload), plus grounded provider endpoints:
  - FRED series used: DGS2 (US 2Y), VIXCLS, DTWEXBGS (broad dollar proxy used as DXY), IRLTLT01GBM156N (UK 10Y benchmark, already fetched by the EUR collector), IRLTLT01DEM156N (DE 10Y).
  - Coinbase spot: `https://api.coinbase.com/v2/prices/GBP-USD/spot` (already fetched by the EUR collector).
  - Germany 2Y via Bundesbank CSV (EUR-specific, not reusable for UK 2Y).
- EUR Layer 1 agent export (`exports/eur_layer1_agent.json`) shows the agent flow and the `agent_outputs` row contract (`agent_name`, `layer`, `call_24h_direction`, `call_24h_conviction`, `market_inputs`, `snapshot_selection`, factor scores, logic document metadata).
- Deterministic gate semantics are mirrored from `gbp_replay_core.js` scoring rules (argument pct of active weight; LEAN when |net edge| < 20 pct; NO_CLEAR_BIAS on tie/zero active).

### Data availability evidence (provider-grounded)

| GBP factor input | Repo-verified provider | Availability for the draft |
| --- | --- | --- |
| `gbpusd_d1_pct` (F6) | Coinbase GBP-USD spot + previous market_snapshots history | AVAILABLE (price); d1/d5/d20 deltas need prior GBP rows |
| `vix_level` (F8) | FRED VIXCLS | AVAILABLE |
| `dxy_d1_pct` (F7) | FRED DTWEXBGS (broad-dollar proxy used as DXY) | AVAILABLE (column-naming reconciliation required; see open items) |
| `us_2y_yield` context | FRED DGS2 | AVAILABLE |
| `uk_10y_yield` context | FRED IRLTLT01GBM156N | AVAILABLE (10Y only; proxy context, not the front-end input) |
| `uk_2y_yield`, `uk_2y_d5_bps` (F2) | none found in this repo | UNAVAILABLE -> null + flagged missing |
| `us_uk_2y_spread_d5_bps` (F3) | depends on UK 2Y | UNAVAILABLE -> null + flagged missing |
| `boe_bias` (F1) | derived from UK economic events (repo Eco Events coverage is USD/EUR only per 2026-08-30 handoff) | UNAVAILABLE -> null + flagged missing |
| `latest_uk_event` (F4) | depends on UK events coverage | UNAVAILABLE -> null + flagged missing |
| `uk_composite_pmi`, `uk_composite_pmi_direction` (F5) | none found in this repo | UNAVAILABLE -> null + flagged missing |
| `global_growth_regime` (F9) | derivable from shared snapshot NQ 20d history (EUR collector derivation) | AVAILABLE when NQ history exists, else null |
| `uk_stress_flag` (F10) | no GBP-specific stress proxy in this repo | UNAVAILABLE -> null + flagged missing (no invented proxy) |

## Session progress

Completed on 2026-09-05:

1. Audited the existing GBP draft: `logic/agent_gbp_direction.md` (24H-only factor baseline) and Codex-owned `backtester/replay/gbp/gbp_replay_core.js` + its test. Confirmed no GBP collector/agent exports, workflow docs, or onboarding tests existed.
2. Recorded intended file list (above) before editing.
3. Extended `logic/agent_gbp_direction.md` (append-only; original Version/Status/factor table preserved byte-for-byte) with draft agent role/isolation, required snapshot inputs, missing/stale handling, 24H output contract, and validation-status sections.
4. Created `workflows/gbp_collector.md` and `workflows/gbp_layer1_agent.md` (draft workflow docs per `workflows/README.md` template).
5. Created reviewable n8n-export-shaped draft workflows:
   - `exports/gbp_collector.json` (10 nodes; DGS2/VIXCLS/DTWEXBGS/IRLTLT01GBM156N FRED requests with placeholder keys, Coinbase GBP-USD spot, previous-snapshot read, build+usability-gate code, single `market_snapshots` insert; `active: false`).
   - `exports/gbp_layer1_agent.json` (9 nodes; market_snapshots read -> GBP input pack -> GitHub logic doc -> combine -> OpenAI JSON-object -> tolerant parser -> deterministic 24H gate -> `agent_outputs` insert; `active: false`).
   - Both are secret-free (FRED `api_key` uses an explicit placeholder) and reference existing project credentials by the same ids/names already used in the EUR exports (no invented workflow ids/credentials; per-node ids intentionally omitted because these are drafts).
6. Added isolated contract layer and tests under `tests/layer1-onboarding/`:
   - `helpers/gbpSnapshotContract.js` (pure; does not import backtester code)
   - `gbp_snapshot_contract.test.js` (missing/stale/weekend handling, fail-closed core, asset independence, availability matrix)
   - `gbp_workflow_drafts.test.js` (draft shape/closed connections, collector/agent node contracts, Layer 1 isolation, secret hygiene, logic-doc <-> gate weight parity, field contracts, tolerant parser object|string)
   - `fixtures/` (complete / stale / missing-core / empty GBP snapshot rows)
7. Did NOT modify any Codex-owned files or shared integration files.

## Test commands and results

Run (onboarding contract tests):

```powershell
node --test tests/layer1-onboarding/gbp_snapshot_contract.test.js tests/layer1-onboarding/gbp_workflow_drafts.test.js
```

Result: 18/18 pass (2026-09-05), 0 fail.

Regression check (pre-existing pure unit/export tests, unchanged files):

```powershell
node --test tests/refresh_workflow_harness.test.js tests/btc_collector_workflow_export.test.js tests/dashboard_writer_workflow_export.test.js tests/layer2_workflow_export.test.js tests/eco_events_workflow_export.test.js tests/validate_architecture_map.test.js
```

Result: 17/17 pass (2026-09-05), 0 fail.

Syntax checks: all six draft code-node payloads passed `node --check` before embedding; both export JSONs parse; both new test files execute under the node test runner.

Not validated this session (explicitly out of scope): n8n import/execution, live provider responses, historical replay/backtest validation, workflow activation, and dashboard publication.

## Unresolved questions / integration checklist (for Codex + operator)

1. `market_snapshots` live table has no repo migration; confirm the live column set and add/migrate GBP columns (`gbpusd_price`, `gbpusd_d1_pct`, `us_2y_yield` reuse, `uk_10y_yield`, `uk_2y_yield`, `uk_2y_d5_bps`, `us_uk_2y_spread_d5_bps`, `boe_bias`, `latest_uk_event`, `uk_composite_pmi`, `uk_composite_pmi_direction`, `uk_stress_flag`, `equities_regime` reuse) or agree a JSONB home.
2. Column-naming reconciliation: research fixture/`gbp_replay_core.js` reads `dxy_d1_pct` while the EUR-collector convention stores the broad-dollar 1-day percent change as `dxy_d1`. Choose one canonical name (alias column or fixture change) so production snapshot and research replay share the exact same keys.
3. When Eco Events Collector gains GBP/UK coverage, wire UK events/PMI + BoE bias derivation and re-enable the corresponding collector draft nodes.
4. Decide the UK 2Y daily provider (or keep F2/F3 as permanently-neutral hypotheses) before treating F2/F3 as live.
5. Confirm whether the GBP Layer 1 output stays 24H-only or adopts the EUR multi-timeframe contract before dashboard/backtester integration.
6. FRED `api_key` handling: existing exports embed query-string keys. The GBP drafts use an explicit `FRED_API_KEY_PLACEHOLDER_DO_NOT_COMMIT_REAL_KEY`; recommend migrating FRED auth to Header Auth credentials across collectors.
7. Keep the agent workflow deterministic 24H gate and `backtester/replay/gbp/gbp_replay_core.js` in sync when one side changes.
