# External state verification — 17 November 2026

Read-only verification from the canonical checkout. No Supabase write, n8n execution or repository data change was made. Every result below is a response from the named endpoint or a hash of the named local file.

## 1. Supabase

Project: `eaolqbrlywczinfordvg.supabase.co`, reached through the publishable key already committed in `script.js`. Only public REST reads were issued.

`research_dashboard_infrastructure_status` (one row):

| Field | Value |
| --- | --- |
| historical warehouse / snapshot builder / replay engine / outcome evaluation / research SQL | Complete / Complete / Complete / Complete / Complete |
| macro / price / economic-event rows | 8,004 / 7,895 / 107 |
| snapshot rows | 604 |
| first → last replay date | 2024-01-02 → 2026-04-30 |
| predictions / evaluation rows / realised outcomes | 2,416 / 12,080 / 2,416 |

Public view row counts, with `Prefer: count=exact`:

| View | Rows |
| --- | ---: |
| `research_prediction_primary_summary` | 5,304 |
| `research_prediction_usd_benchmark_summary` | 2,416 |
| `research_usd_24h_direction_accuracy` | 1 |
| `research_accuracy_by_confidence_bucket` | 29 |
| `research_overall_win_rate` | 1 |
| `research_factor_reliability` | 69 |
| `research_dashboard_infrastructure_status` | 1 |

The newest primary row returned is `snapshot_date=2026-04-30`; its `following 24hrs` USD row is `NOT_EVALUABLE`. The 24-hour accuracy view returns one aggregate row (`evaluated_calls=542`, `overall_accuracy_pct=36.35`), but its own definition is not the candidate's 05:00 contract and it must not be attached to H1. A direct anonymous read of the base tables `market_snapshots`, `agent_outputs` and `economic_events` returns 0 rows, even though the infrastructure view reports 107 economic-event rows. This is a row-visibility/RLS difference, not evidence that the underlying table is empty.

Not verified: runtime view definitions, grants and table DDL. Those require a database/service-role connection that is not present in this checkout. The dashboard's published key cannot read `pg_catalog`.

## 2. n8n

Host: `silver17.app.n8n.cloud`. `GET /healthz` returned HTTP 200, so the instance is reachable. `GET /rest/executions?limit=1` and `GET /rest/workflows?limit=1` both returned HTTP 401 `{"status":"error","message":"Unauthorized"}`. No n8n API key, session cookie or login is present in the environment or the repository exports. Run history, schedule state and credential status remain unverified. The 16 exported workflow JSON files are snapshots, not execution records.

## 3. `usd-24h-research-dataset.json`

Absent from `HEAD` in both the canonical checkout and the strategy worktree, and from the published tree. It is present, byte-identical, in two local worktrees:

| Path | Bytes | SHA-256 |
| --- | ---: | --- |
| `D:/trading-agent-dashboard-codex/.local/worktrees/citation-registry/data/usd-24h-research-dataset.json` | 2,133,936 | `03ad563748a72ece6dab41e1915c1d91d37888266c16a5e65fa944afa4664442` |
| `D:/trading-agent-dashboard-codex.worktrees/ws-c-research/data/usd-24h-research-dataset.json` | 2,133,936 | `03ad563748a72ece6dab41e1915c1d91d37888266c16a5e65fa944afa4664442` |

Its source commit is `c1ea8ab2` (`usd: complete the USD 24-hour improvement project and record that improvement is not demonstrated`). Schema `usd-24h-research-dataset-v1`; window `2024-01-02` to `2026-04-30` after `2023-04-03` warm-up; 584 rows, 583 evaluable, 1 unavailable; endpoint statuses 559 exact next-session close, 24 delayed offset, 1 unavailable. The call time is `09:30:00` ET and the outcome is DXY, so this recovers the 24-hour study's input population but **cannot** be used as a 05:00 London H1 input or to make a morning H1-eligible.

## 4. Access blockers and effect on this work

- Supabase: public views reachable; DDL, grants, service-role reads and write-path audit blocked without database credentials.
- n8n: instance reachable; execution history blocked without an API key or authenticated session.
- 24-hour dataset: recovered from two local worktrees; not on any published/current branch and not a 05:00 source.
- H1: unchanged. The public warehouse's newest replay row is 2026-04-30 and no endpoint supplies the nine 05:00 receipts, ICE fixings or complete BLS/BEA schedules. The H1 morning remains blocked.
