# Macro Analyser Live Event Engine: Phase 0 Audit

**Audit date:** 2026-08-21 (Europe/London)  
**Scope:** read-only repository and export audit. No workflow, database, dashboard, or production changes were made.

## 1. Identity and safety status

- Repository worktree: `D:/trading-agent-dashboard-codex.worktrees/half-l2l-research-20260809`
- Branch: `research/half-l2l-reach-20260809`
- HEAD: `dd429c2` (`Clarify layer freshness status`)
- Linked Supabase project: `eaolqbrlywczinfordvg` (`Inputs Database`)
- n8n workspace documented in [workflows/WORKFLOW_INVENTORY.md](workflows/WORKFLOW_INVENTORY.md): `https://silver17.app.n8n.cloud`

This worktree is not clean. It contains existing dashboard/live-ops edits and a substantial uncommitted half-L2L research bundle across `backtester/`, `data/`, and tests. Those files are treated as frozen user work for this initiative. Phase 1 must use a separate namespace and must not overwrite `data/layer1.json`, `data/layer2.json`, existing research artifacts, or the exported production workflows.

Other worktrees exist, including `trial-foundation-m1`, `main` deployment worktrees, and `audit/backtester-accuracy-20260808`. This audit does not establish which one is the authoritative production deployment checkout.

## 2. Current architecture

```text
Dashboard browser
  -> POST Master Orchestrator webhook
  -> Master Orchestrator (manual or webhook entry)
     -> Eco Events Collector -> Supabase economic_events
     -> USD / EUR / Gold / NQ / BTC collectors -> Supabase market snapshots
     -> USD / EUR / Gold / NQ / BTC Layer 1 agents -> Supabase agent outputs
     -> Layer 2 Trade Selection Agent -> data/layer2.json in GitHub
     -> Dashboard Writer -> data/layer1.json in GitHub
     -> workflow-status.json in GitHub
  -> GitHub Pages static dashboard polls published JSON

Backtester/research (downstream-only)
  -> historical source manifests, prices, macro series, economic events
  -> historical asset snapshots
  -> observation / verdict / prediction / outcome research tables
```

The production-facing dashboard is static (`index.html`, `script.js`, `styles.css`) and reads published files. The browser polls workflow status every 10 seconds after a manual refresh request. It is not a live market-data client or event-processing runtime.

The current master workflow ID is `X75RKU34ikiM5RMU`. It has two exported entry points: manual trigger and webhook path `master-orchestrator-dashboard-refresh`. Every exported child collector/agent uses an Execute Sub-workflow Trigger. No exported schedule/cron trigger exists.

## 3. Existing capability inventory

| Capability | Present evidence | Current limitation |
| --- | --- | --- |
| Scheduled calendar events | Eco Events Collector fetches high-volatility calendar data for US, DE, FR, IT, ES, CN plus Forex Factory; collectors also query Finnhub calendar endpoints. | Runs only when the master workflow is invoked; no calendar-driven schedule, event receipt timestamp, revision lineage, or pre/post-event checkpoint state machine. |
| Unscheduled news/headlines | No dedicated headline, RSS, official release, wire, or webhook ingestion found in exported workflows. | Not implemented. |
| Market prices | Collectors request FRED, Coinbase, Alpha Vantage, CoinGecko, Farside, and Germany 2Y sources; research has daily and cached 1H importer paths. | Production cadence is invocation-driven; no demonstrated one-minute bars, tick stream, bar receipt timestamp, or price-shock detector. |
| Yields and macro context | USD-family collectors request US 2Y, US 10Y, TIPS real yield, Germany/UK/Japan proxies, VIX, DXY, oil and related FX context. | Freshness and source-leg latency are not represented as a live, fail-closed event-call contract. Some FRED series are lower-frequency/daily rather than intraday market feeds. |
| Baseline Layer 1 / Layer 2 calls | Existing independent Layer 1 output and Layer 2 derivation/publishing flow. | No immutable baseline/current-call version relationship, call lifecycle, event causality, expiry, or compatible-active-version selection. |
| Dashboard freshness | `workflow-status.json`, Layer 1/2 publish freshness, request association state, and browser refresh tests exist. | No intraday event timeline, call-version history, expiry countdown, data-health panel, or notification centre. |
| Alerts | Dashboard renders workflow failures and status only. | No material-change decision, notification record, deduplication, browser notifications, or external alert adapter. |
| Historical replay | Observation-first research schema, historical warehouse, replay scripts, parity checks, DST test coverage, and half-L2L research exist. | Existing historical events/prices are mostly daily or cached 1H. They cannot prove event-time one-minute reaction logic without a timestamp-correct source expansion. |

## 4. Sources, timestamps, and cadence

| Area | Current sources | Stored/time basis | Audit conclusion |
| --- | --- | --- | --- |
| Economic calendar | RapidAPI economic calendar, RapidAPI Forex Factory, Finnhub calendar | Live `economic_events` identity is date/currency/name/time text; historical warehouse has `event_time` and `event_timezone`. | Suitable starting context for scheduled events, but source receipt/processing timestamps and revisions are absent from the documented live contract. |
| Rates / macro | FRED; Germany 2Y source | Collector requests at master-run time; historical warehouse supports `observed_at`. | Context exists, but not sufficient proof of intraday availability or feed freshness. |
| FX / gold / crypto / risk prices | Coinbase, Alpha Vantage, CoinGecko, OANDA research cache, Binance research cache, QQQ proxy, Farside | Research supports daily and cached 1H series; live collectors run only under master. | No continuous one-minute production feed. |
| Published dashboard state | GitHub JSON and static browser polling | Layer publish timestamps and workflow run timestamps | Operational publish truth exists, but it is not market/event truth. |

The checked-in workflow exports are snapshots. Most are dated 2026-06-18 through 2026-06-21, while the dashboard artifacts contain August changes. The exports must be re-fetched from n8n before they are treated as the current live implementation.

## 5. Exact gaps against the project brief

1. No environment/workflow identity map distinguishes production, staging, and research. One linked Supabase project is visible; no staged project or schema boundary is documented.
2. No continuous scheduler, event-driven trigger, or mandatory post-event `+1/+5/+15/+30` review sequence exists in the exports.
3. No unscheduled authoritative-news ingestion, source reliability taxonomy, or `UNKNOWN_CAUSE` price-shock path exists.
4. No live one-minute market-bar ingest, receipt timestamp, staleness SLA, or shock-detection feature store exists.
5. No event record with `published_at`, `received_at`, `processed_at`, immutable source reference, dedupe key, and revision lineage exists.
6. No versioned call contract separates immutable baseline calls from event overlays/current calls; no state machine for active, weakening, invalidated, stale, or expired calls exists.
7. No persistence calculator, `next_review_at`, `expected_valid_until`, `hard_expires_at`, or machine-readable invalidation rules exist.
8. Layer 2 currently consumes existing Layer 1 outputs, but has no contract requiring compatible, active, non-stale Layer 1 call versions.
9. No alert decision engine, notification log, deduplication, severity escalation, quiet timeline, or external adapter exists.
10. The dashboard has live-ops status but none of the required event/call timeline, baseline-versus-current display, evidence-change, or feed-health surfaces.
11. Existing replay scaffolding does not yet prove strict event-time availability for a live event engine. The half-L2L feasibility work itself flags date-only/same-date data as insufficient for strict pre-session availability.

## 6. Proposed isolated design (not implemented)

Keep all candidate code and data outside current production contracts:

| Layer | Proposed isolated location | Purpose |
| --- | --- | --- |
| Deterministic core | `macro-engine/` | Event normalization, clock/calendar rules, shock detection, mechanism classification, call state machine, expiry, Layer 2 compatibility, and alert decisions. Pure functions only in Phase 1. |
| Fixtures and replay | `macro-engine/fixtures/`, `macro-engine/replay/`, `macro-engine/tests/` | Timestamp-ordered event/bar fixtures, deterministic replay runner, and no-future-leak tests. |
| Documentation | `docs/macro-engine/` | ADR, taxonomy, source/freshness contract, state machine, notification rules, environment map, runbook, and test matrix. |
| Database | new `macro_stage` schema, or a separately named staged Supabase project confirmed by the user | Append-only `event_records`, `market_observations`, `shock_candidates`, `call_versions`, `call_evidence`, `call_state_transitions`, `layer2_candidate_versions`, and `notification_records`. No writes to existing production tables in Phases 1-4. |
| n8n | new disabled/staged workflows prefixed `STAGE Macro Engine - ...` | Separate scheduled calendar ingest, observation-only market ingest, candidate calculation, and shadow publish. No edits to Master Orchestrator until a promotion proposal is approved. |
| Dashboard | later, new static staged JSON under `data/macro-stage/` or a staged site | Read-only shadow timeline first; do not change Overview, Backtest/Accuracy, or current manual-review contracts in Phase 1. |

The recommended database choice is a separate staged Supabase project if one is available. If not, use a dedicated `macro_stage` schema with a separate least-privilege credential and explicit rejection of production-table targets. This choice needs confirmation before any database work begins.

## 7. Test and replay plan

Phase 1 should add deterministic unit tests before any networked ingestion:

1. Event deduplication, revision handling, stable IDs, source reliability, and UTC timestamp ordering.
2. IANA timezone and DST tests for `Europe/London` and `America/New_York`, including the weeks when UK and US clocks differ.
3. Baseline immutability, event-overlay lineage, call lifecycle, expiry shortening/extension, and fail-closed stale-data behavior.
4. Price shock, cross-market confirmation, `UNKNOWN_CAUSE`, NewsPivot reversal, and incompatible Layer 2 source-leg cases.
5. Alert severity, cooldown/deduplication, escalation, resolution, and notification failure isolation.

Before Phase 4, build an event replay corpus with true publication/receipt times and the finest defensible bars. Run it chronologically using the same deterministic core intended for staged operation. Measure receipt, detection, classification, confirmation, and notification latency; then measure actionable price, excursion, post-cost outcome, false positives, missed events, reversal quality, alert volume, and persistence calibration. Reject runs that lack source-time evidence instead of filling gaps from later articles or end-of-day data.

Existing reusable foundations include the observation-first warehouse/replay tests, `backtester/tests/replay_smoke.test.js`, parity checks, and half-L2L IANA/DST coverage. They should remain unchanged and become comparison evidence, not a dependency to rewrite.

## 8. Required user choices before Phase 1

1. Confirm the staged data boundary: a separate Supabase project, or a `macro_stage` schema in `Inputs Database` with a new restricted credential.
2. Confirm the allowed source tier for unscheduled events and live minute bars, including licensing/budget constraints. The repository currently has no approved authoritative-news provider or intraday-feed SLA.
3. Confirm whether Phase 1 should live in this dirty research worktree or in a new clean `macro-engine` worktree. A new clean branch/worktree is safer because this one contains uncommitted half-L2L research.
4. Confirm the intended first shadow asset scope. A practical initial scope is USD plus EUR/USD, Gold, NQ, and BTC context; broad multi-asset launch should wait for source and replay coverage.

## 9. Phase 0 conclusion

The existing platform has a functioning manual/webhook orchestration and publishing path, scheduled-calendar context, broad collector coverage, strong dashboard refresh observability, and a deliberately downstream research foundation. It does not yet have the continuous, timestamp-correct, versioned, event-responsive runtime required by the brief.

The new engine can be isolated safely, but only after the environment boundary and source commitments are chosen. The appropriate next action is Phase 1 contract and deterministic-core work in a clean staged namespace; it should not begin until the four choices above are resolved.
