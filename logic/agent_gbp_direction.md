# GBP Layer 1 Direction Agent

Version: 0.1_research_baseline
Status: Research onboarding only. Do not use for live calls until historical replay and checker validation pass.

## Scope

The agent analyses GBP as an independent Layer 1 asset. It must not produce GBP/USD or other pair calls, trade recommendations, or use another agent's output.

## 24H Factor Contract

| Factor | Weight | Input | GBP interpretation |
| --- | ---: | --- | --- |
| F1 BoE policy bias | 20 | `boe_bias` | Hawkish bullish, dovish bearish. |
| F2 UK 2Y yield delta | 16 | `uk_2y_d5_bps` | Rising at least 5 bps bullish; falling at least 5 bps bearish. |
| F3 US-UK 2Y spread delta | 20 | `us_uk_2y_spread_d5_bps` | Narrowing at least 5 bps bullish; widening at least 5 bps bearish. |
| F4 UK economic surprise | 12 | `latest_uk_event` | Positive surprise bullish; negative surprise bearish. |
| F5 UK PMI trend | 8 | `uk_composite_pmi`, `uk_composite_pmi_direction` | Above 50 and improving bullish; below 50 or deteriorating bearish. |
| F6 GBP own-price delta | 10 | `gbpusd_d1_pct` | Move of at least 0.2% confirms the matching direction. |
| F7 DXY confirmation | 6 | `dxy_d1_pct` | A weaker dollar supports GBP; a stronger dollar pressures GBP. |
| F8 Risk appetite | 4 | `vix_level` | VIX below 16 bullish; above 25 bearish. |
| F9 Global growth | 2 | `global_growth_regime` | Expanding bullish; contracting bearish. |
| F10 UK stress | 2 | `uk_stress_flag` | Active stress is bearish only. |

Missing inputs are neutral. The engine may produce a full directional result only from the available weighted evidence; it must never infer a missing input.

## Market Calendar

GBP is closed on Saturday and Sunday. The live presentation layer must suppress the 24H call whenever the GBP/USD market is closed, while retaining the raw research classification for auditing.

---

## Draft Extension: Agent Role, Output Contract, and Input Handling (2026-09-05)

Added by the DeepSeek/Cline onboarding workstream (see `docs/DEEPSEEK_LAYER1_PROGRESS.md` and `docs/PARALLEL_AGENT_HANDOFF.md`). The Version, Status, weights, and all factor rows above are preserved unchanged. Sections below are onboarding-contract guidance for the collector/agent workflow drafts.

### Draft: Agent Role and Isolation

- This agent analyses GBP only as an independent Layer 1 asset.
- It must read only: this logic document and the latest usable GBP market snapshot (shared `market_snapshots` context).
- It must never read other Layer 1 agent outputs, Layer 2 outputs, dashboard outputs, or pair engines.
- It must never output pair calls (for example GBP/USD is the price reference, not a call), trade entries, or trade recommendations.
- Weights in the factor table above are research hypotheses until historical replay/checker validation passes. They are not calibrated live weights.

### Draft: Required Snapshot Inputs

The GBP market snapshot row is expected to expose at least the following keys (same names used by `backtester/replay/gbp/gbp_replay_core.js`):

| Key | Factor | Draft status |
| --- | --- | --- |
| `gbpusd_price`, `gbpusd_d1_pct` | F6 | expected; price from Coinbase GBP-USD spot, deltas from prior snapshots |
| `dxy_d1_pct` (repo convention `dxy_d1`) | F7 | expected; FRED DTWEXBGS broad-dollar proxy |
| `vix_level` | F8 | expected; FRED VIXCLS |
| `boe_bias` | F1 | unavailable until UK economic events coverage exists |
| `uk_2y_d5_bps` | F2 | unavailable until a UK 2Y daily provider is approved |
| `us_uk_2y_spread_d5_bps` | F3 | unavailable until UK 2Y exists |
| `latest_uk_event` | F4 | unavailable until UK events coverage exists |
| `uk_composite_pmi`, `uk_composite_pmi_direction` | F5 | unavailable until a verified UK PMI source exists |
| `global_growth_regime` | F9 | expected when shared snapshot NQ history exists |
| `uk_stress_flag` | F10 | unavailable; no repo-verified GBP stress proxy |

Never fabricate the unavailable inputs. Write them as absent/null in the snapshot and record them in `data_quality.missing` so the agent scores the affected factors NEUTRAL.

### Draft: Missing and Stale Input Handling

- Missing factor input: factor signal is NEUTRAL, missing input is named in the output, and conviction is reduced by the inactive weight.
- No usable snapshot: if no snapshot has the required minimum market data (GBP/USD spot price and a fresh `run_time_et`), the agent must not produce a call (`NO_CLEAR_BIAS` / no insert).
- Stale snapshot: a snapshot is stale when its `run_time_et` is older than 26 hours and its `snapshot_date` is older than the latest GBP trading weekday. The dashboard suppresses the 24H call on Saturday/Sunday closure regardless of snapshot age.

### Draft: 24H Output Contract

Until a multi-timeframe review is approved, the GBP agent emits a 24H-only verdict. Field names follow the production `agent_outputs` conventions used by the EUR agent:

```json
{
  "asset": "GBP",
  "agent_name": "GBP",
  "layer": 1,
  "logic_document": "agent_gbp_direction.md",
  "logic_document_version": "0.1_research_baseline",
  "direction_24h": "BULLISH",
  "conviction_24h": null,
  "call_24h_direction": "BULLISH",
  "call_24h_conviction": null,
  "reason_24h": "",
  "factor_breakdown": {},
  "weighted_score": null,
  "missing_inputs": [],
  "reasoning_summary": "",
  "risk_flags": []
}
```

`conviction_24h` and `call_24h_conviction` are filled by the deterministic 24H gate in the agent workflow using the factor table weights and thresholds above.

### Draft: Validation Status

- Status remains research onboarding only. No live calls, no historical validation claim, no production readiness.
- Contract tests for this draft live in `tests/layer1-onboarding/` and are isolated from the backtesting engine.
- Integration requests for Codex/operator are recorded in `docs/DEEPSEEK_LAYER1_PROGRESS.md`.

---

## Draft Extension: UK Input Coverage Revision (2026-09-12)

Added by the DeepSeek/Cline GBP workstream. The factor table, weights, Version and Status above are preserved unchanged; this section only records provider evidence and the collection changes that followed from it.

### Provider evidence revision

| Factor input | Previous draft status | Revised status (2026-09-12) |
| --- | --- | --- |
| `boe_bias` (F1) | unavailable | **derivable** from the UK economic calendar (RapidAPI `economic-calendar-api`, `countryCode=GB`): beat/miss vs forecast, weighted by impact, mirroring the USD/EUR bias derivation. Null when the provider does not respond. |
| `latest_uk_event` (F4) | unavailable | **derivable** from the same UK calendar (most recent completed high/medium-impact event). |
| `uk_composite_pmi`, `uk_composite_pmi_direction` (F5) | unavailable | **derivable** from UK PMI calendar events (`actual` vs `previous`), mirroring the EUR PMI derivation. |
| `uk_2y_yield`, `uk_2y_d5_bps`, `us_uk_2y_spread_d5_bps` (F2/F3) | unavailable | **still unavailable**. Verified 2026-09-12: FRED has no UK 2Y series, and the Bank of England IADB publishes yield-curve series only for 5, 10 and 20 year maturities (`IUDSNPY`, `IUDMNPY`, `IUDLNPY`); no 1/2/3/4-year nominal or spot series exists. |
| `uk_stress_flag` (F10) | unavailable | **still unavailable**; no repo-verified UK stress proxy. No proxy is inferred. |

### Collection consequences

- The GBP collector now requests the UK economic calendar and derives `boe_bias`, `boe_bias_score`, `boe_bias_reasons`, `latest_uk_event`, `upcoming_uk_events`, `uk_composite_pmi`, `uk_composite_pmi_direction` and `latest_uk_pmi_event`.
- Those fields are only ever copied from provider data. When the calendar node fails (for example an expired RapidAPI key or missing entitlement), the node is marked `onError: continueRegularOutput` and every UK event field is written as null and listed in `data_quality.missing`; the snapshot is not blocked and the affected factors score NEUTRAL.
- F2/F3 therefore remain the only permanently neutral weights (36 of 100) until a UK 2Y provider is approved by the operator. F10 (weight 2) also remains neutral.
- Coverage status: 62 of 100 weight is collectable today (F1, F4, F5, F6, F7, F8, F9); 36 of 100 requires a UK 2Y provider decision; 2 of 100 requires a UK stress proxy decision.

---

## Live Status (2026-09-12)

- The **GBP Layer 1 agent is live** in n8n (`GBP Layer 1 Agent`, id `bMv96EPR0xCXi3bi`, active). The Master Orchestrator runs it between `WTI Layer 1 Agent` and `Layer 2 Trade Selection Agent`.
- Onboarding follows the **WTI precedent**: because the shared `market_snapshots` table has no GBP columns, the sealed agent reads its providers at run time and writes only its own `agent_outputs` row. The collector draft in `exports/gbp_collector.json` stays unimported until that schema gains GBP columns.
- Providers read at run time: Coinbase GBP/USD spot; FRED `DGS2`, `DGS10`, `IRLTLT01GBM156N`, `VIXCLS`, `DTWEXBGS`; and the UK economic calendar (RapidAPI `economic-calendar-api`).
- **`countryCode=UK` is required**: the provider returns zero events for `GB` (verified live 2026-09-12). It reports `currencyCode` as `GBP`.
- `Layer 2 Trade Selection Agent` now publishes `GBP/USD` (alongside `EUR/USD`, `XAU/USD`, `BTC/USD`, `NQ/USD`, `WTI/USD`, `XAG/USD`) and `Dashboard Writer - Layer 1` includes `GBP` in its asset list.
- The deterministic gate remains the only conviction source. Weights above are unchanged and remain provisional hypotheses pending historical replay.
