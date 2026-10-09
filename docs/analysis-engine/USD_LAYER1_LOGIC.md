# USD Layer 1 — complete logic dossier

**Purpose.** A single self-contained document that explains, end to end, how the Layer 1 USD
directional call is produced by this platform, so that an outside reviewer (human or frontier model)
can analyse the logic without access to the repository. It states both what the written rulebook says
and what the running code actually does, and it flags every place where those two disagree, because
that gap is the most important thing to review.

**Audience.** A frontier model asked to critique the design: factor choice, weights, thresholds,
scoring, conviction construction, isolation rules, and what the output can and cannot be used for.

**How to read it.** Two categories are kept apart throughout:
`Document` = the written rulebook (`logic/agent_usd_direction.md`, v2.1).
`Code` = the deterministic gate that actually emits the call (`Calculate USD Conviction` in
`exports/usd_layer1_agent.json`). Where the two differ, both are shown. Nothing here is a claim about
trading edge, accuracy or profitability.

---

## 1. One-paragraph summary

Once per run, a USD-only Layer 1 agent reads the newest usable market snapshot from the shared
`market_snapshots` table, fetches its own prose rulebook, and asks a language model
(`gpt-4.1-mini`) to classify ten named macro factors as `BULLISH`, `BEARISH` or `NEUTRAL`. The
model's own direction and conviction are then **discarded**: a deterministic Code node re-derives
every factor from the raw snapshot, multiplies each factor's sign by a fixed per-horizon weight,
sums the bullish and bearish weights, and publishes one direction
(`BULLISH`/`BULLISH_LEAN`/`BEARISH`/`BEARISH_LEAN`/`NO_CLEAR_BIAS`) plus a conviction number for each
of five horizons (24h, 3d, current week, next week, current month). Missing inputs score `NEUTRAL` and
never block a call. The agent is sealed from every other agent, from Layer 2, and from all trade logic.

---

## 2. Provenance and source of truth

| Item | Where it lives | Status |
| --- | --- | --- |
| Rulebook (the "logic document") | `logic/agent_usd_direction.md` | Version 2.1, "Production baseline for USD Layer 1". Fetched from GitHub at run time, no pinned ref, so an edit changes the next call's prompt. |
| Workflow (the sealed agent) | `exports/usd_layer1_agent.json` | A **manual snapshot** of the live n8n workflow. Nothing in the repo refreshes it; the live n8n workspace is what produces today's calls. |
| Deterministic gate | Code node `Calculate USD Conviction` inside that export | The only place a direction or conviction number is produced. |
| Published row | `data/layer1.json` (written by the Dashboard Writer) | Written by the live pipeline, not by this checkout. |
| Frozen worked example | `backtester/fixtures/usd_live_replay_24h_parity_fixture.json` | A 2024-01-09 snapshot with an expected 24h output, used as a live-vs-replay parity gate. |

Because the export is a snapshot, the code quoted here is the exported truth, not proof of what the
live n8n workspace runs today. Every code quotation below was also executed locally against the frozen
fixture, and the numbers in §8 are the executed output, not the documented intent.

---

## 3. The pipeline: eight steps, one snapshot, one row

The Master Orchestrator triggers the USD agent inside a chain of collectors and agents. Inside the USD
agent, the exported workflow is eight nodes:

| # | Step | Node | What it does |
| --- | --- | --- | --- |
| 01 | TRIGGER | `When Executed by Another Workflow` | The orchestrator calls the USD agent. |
| 02 | READ | `Supabase Get Many` | Pulls **every** row of `market_snapshots` (`getAll`, `returnAll: true`, no filter); sorting happens in the next node. |
| 03 | PACK | `Build USD Input Pack` | Keeps the newest snapshot that passes a 14-field USD usability test, and names the missing inputs. |
| 04 | RULEBOOK | `Get USD Logic Document` | GitHub read of `logic/agent_usd_direction.md`. |
| 05 | MODEL | `Message a model` | `gpt-4.1-mini`; system message carries the isolation rules; user message = rulebook + input pack + output requirement. |
| 06 | PARSE | `Parse USD Agent Output` | Reads the model's JSON into the row contract and flags missing inputs. |
| 07 | SCORE | `Calculate USD Conviction` | Re-derives every factor from the raw snapshot and computes the call. **The model's numbers are overwritten here.** |
| 08 | WRITE | `Create a row` | Inserts the finished call into `agent_outputs`. |

Downstream: the Dashboard Writer reads the latest row per asset and writes `data/layer1.json`. The
Layer 2 layer only assigns a pair trade when the target's and USD's 24h directions are **opposite exact
`BULLISH`/`BEARISH` calls**, and it takes `combined_confidence = min(target, USD)` — the *lower* of the
two, not an average (`backtester/lib/layer2_pair_logic.js`). The browser then re-derives the headline
"confidence" it displays from the gate's argument percentages (§9), so the number a user sees is not
the number stored in `conviction_*`.

---

## 4. Inputs: the snapshot contract

`Build USD Input Pack` keeps the newest row that carries `snapshot_date` and `run_time_et` **and** all
fourteen of these fields non-empty:

`vix_level, dxy_level, dxy_d1, dxy_d5, us_2y_yield, us_2y_d5_bps, de_2y_yield, us_de_2y_spread,
us_de_2y_spread_d5_bps, us_10y_real_yield, us_10y_real_yield_d5_bps, gold_d1_pct, nq_d1_pct, fed_bias`

Rules and fallbacks:

- **Snapshot choice.** The newest *usable* row wins; if none passes the test, the newest row of any
  kind is used (`latest_available_snapshot_fallback`). If there is no row with `snapshot_date` and
  `run_time_et` at all, the workflow throws `No valid market snapshot found` and writes nothing.
- **Gold / NQ fallbacks.** If `gold_d5_pct` is missing it falls back to `gold_d1_pct`; if `nq_d5_pct`
  is missing it falls back to `nq_d1_pct`. Each fallback is recorded as a warning.
- **The 20-day inputs are optional.** `us_2y_d20_bps`, `us_10y_real_yield_d20_bps`, `dxy_d20`,
  `gold_d20_pct`, `us_de_2y_spread_d20_bps` are carried only "if available".
- **Missing inputs are scored `NEUTRAL`, never guessed**, and are named in `missing_inputs` /
  `warnings`. The input pack explicitly lists which fields must be neutral-if-unavailable
  (`de_2y_yield`, the US-DE spread and its 5d delta, `latest_us_event`, `fed_bias`, `gold_d5_pct`,
  `nq_d1_pct`, `equities_regime`).

Note the read shape: the agent pulls the **entire** `market_snapshots` table and filters in
JavaScript, rather than querying the newest row.

---

## 5. The written rulebook (documented logic), v2.1

### 5.1 Role, isolation and output principle

The agent answers exactly one question: *"Based on confirmed value-driving factors available at
execution time, what is the likely direction of USD?"* It analyses USD **only** and must not output
pair calls, EUR/USD calls, Gold/NQ/BTC calls, trade entries or recommendations, consensus calls, or
Layer 2 event-adjusted calls — those are downstream responsibilities.

**Isolation rule.** It may use only (1) its own supplied logic document and (2) the supplied market
snapshot. It must not read or infer from other Layer 1 agents, Layer 2 outputs, consensus or pair
recommendations, trade recommendation systems, or previous outputs unless those are explicitly part of
the snapshot. Layer 1 output is meant to stay raw and independent.

**Division of labour.** The agent classifies each factor as `BULLISH`/`BEARISH`/`NEUTRAL` and may
explain evidence, but **must not calculate conviction percentages** — the deterministic code node does
that. Valid final directions are `BULLISH`, `BEARISH`, `BULLISH_LEAN`, `BEARISH_LEAN`,
`NO_CLEAR_BIAS`; `NEUTRAL` is allowed only at factor level, never as the final default. `NO_CLEAR_BIAS`
is reserved for "effectively no usable directional data".

### 5.2 The ten factors and the weights the rulebook states

| Factor | Documented weight |
| --- | ---: |
| F1 — VIX Level and Risk Regime | 10 |
| F2 — US 2-Year Yield Delta | 14 |
| F3 — US/Germany 2-Year Rate Differential Delta | 16 |
| F4 — US 10-Year Real Yield Delta | 14 |
| F5 — DXY 5-Day Delta | 6 |
| F6 — Gold 5-Day Delta | 5 |
| F7 — US Economic Surprise Direction | 3 |
| F8 — Fed Bias Delta | 18 |
| F9 — Dollar Smile Regime | 12 |
| F10 — Equity Direction vs USD Correlation Regime | 2 |
| **Total** | **100** |

The document names **primary drivers** as F2, F3, F4, F5, F7, F8 and **secondary drivers** as F1, F6,
F9, F10, and states that primary-driver agreement should raise conviction while primary-driver
conflict should reduce it. (The code does not implement this — see §7.)

### 5.3 The documented rule for each factor

| Factor | Inputs | Documented rule (as written) |
| --- | --- | --- |
| F1 VIX | `vix_level`, `vix_d1`, `vix_d5` | VIX > 25 → BULLISH (safe-haven demand); VIX 16–25 → NEUTRAL; VIX < 16 → BEARISH (risk-on). VIX rising sharply over 1d or 5d → BULLISH *modifier*; falling → BEARISH modifier. If level and delta conflict, score on the stronger message and explain the conflict. |
| F2 US 2Y | `us_2y_yield`, `us_2y_d5_bps`, `us_2y_d20_bps` if available | Rising ≥ +5 bps over 5 days → BULLISH; falling ≥ 5 bps → BEARISH; between −5 and +5 bps → NEUTRAL. "Use delta, not level." |
| F3 US−DE 2Y spread | `us_de_2y_spread_d5_bps` | Widening ≥ +5 bps → BULLISH; narrowing ≥ 5 bps → BEARISH; between → NEUTRAL. Reasoned as "the strongest USD driver because currencies are relative". |
| F4 US 10Y real yield | `us_10y_real_yield`, `us_10y_real_yield_d5_bps`, `us_10y_real_yield_d20_bps` if available | Rising ≥ +5 bps over 5 days → BULLISH; falling ≥ 5 bps → BEARISH; else NEUTRAL. |
| F5 DXY | `dxy_level`, `dxy_d1`, `dxy_d5`, `dxy_d20` if available | Up > 0.30% over 5 days → BULLISH; down > 0.30% → BEARISH; between → NEUTRAL. Described as confirmation, not a primary driver, and as the primary tiebreaker. |
| F6 Gold | `gold_price`, `gold_d5_pct`, `gold_d1_pct` if available | Gold falling over 5 days → BULLISH; rising → BEARISH; flat → NEUTRAL. Flag a possible safe-haven conflict if gold rises while USD strengthens. |
| F7 US surprise | `latest_us_event` (`event`, `actual`, `forecast`, `surprise`, `age_hours`) | Recent US data beat consensus → BULLISH; missed → BEARISH; no significant US data in last 72 hours → NEUTRAL. "Only count confirmed actual-vs-consensus data. Never judge a release by absolute strength." |
| F8 Fed bias | `fed_bias` (`hawkish`/`dovish`/`neutral`/`unknown`) | Fed bias **moved** more hawkish than the prior reading → BULLISH; more dovish → BEARISH; no clear change → NEUTRAL. "The market trades the change in Fed bias, not the absolute state." Highest-weight factor. |
| F9 Dollar Smile | `vix_level`, `vix_d1`, `vix_d5`, `latest_us_event`, `global_growth_context`, `fed_bias` | VIX > 25 or active crisis → BULLISH; US growth outperforming global growth **with** hawkish Fed → BULLISH; US growth moderate and global growth decent → BEARISH; insufficient evidence → NEUTRAL. Explicitly warns: "Avoid double-counting Factor 1." |
| F10 Equity regime | `equities_regime`, `nq_d1_pct`, `nq_d5_pct`, `vix_level` | Risk-on & VIX < 16 & equities rising → BEARISH; risk-on & equities falling → BULLISH; risk-off & VIX > 25 & equities falling → BULLISH; neutral regime → NEUTRAL. "Do not force this factor unless the regime is clear." |

### 5.4 The documented scoring process

For each run: score all ten factors; sum bullish factor weights into `bullish_weight`; sum bearish
weights into `bearish_weight`; `active_weight = bullish_weight + bearish_weight`; count bullish,
bearish, neutral and missing; identify whether primary drivers agree or conflict; produce provisional
directional verdicts for every timeframe from factor direction alone. Neutral factors contribute 0 to
both sides — **but their unused weight still lowers participation and limits conviction**.

### 5.5 The documented directional verdict rule

Step 1 — direction from weights: `bullish_weight > bearish_weight` → BULLISH(_LEAN);
`bearish_weight > bullish_weight` → BEARISH(_LEAN); equal → use tiebreakers. `weight_margin` is the
absolute difference between the two weights.

Step 2 — the document says use a `_LEAN` label when **any** of: `active_weight < 50`;
`weight_margin < 15`; primary drivers are conflicted; key inputs are missing; the direction was decided
by tiebreaker; or **conviction is below 65%**. Use a full `BULLISH`/`BEARISH` when `active_weight ≥
50`, `weight_margin ≥ 15`, primary drivers mostly agree, and conviction is ≥ 65%.

Step 3 — tiebreakers, in order: DXY 5-day delta, then US 2Y 5-day delta, then US 10Y real-yield 5-day
delta, then VIX 5-day delta (rising → BULLISH_LEAN, falling → BEARISH_LEAN). `NO_CLEAR_BIAS` only if
there is no usable directional data at all.

### 5.6 The documented conviction formula (which the code does *not* use)

The document says the **downstream code node** computes conviction as:

```text
weighted_edge   = abs(bullish_weight - bearish_weight) / 100
raw_conviction  = 50 + (weighted_edge * 50)
final_conviction = min(raw_conviction, participation_cap)
```

then, in order, a **participation cap**, a **missing-input penalty**, a **conflict penalty**, and an
**agreement boost**:

- Participation cap on `active_weight`: 0–29 → 55%; 30–49 → 62%; 50–69 → 72%; 70–84 → 82%;
  85–100 → 92%.
- Missing-input penalty: 0 → 0; 1–2 → −2 to −5; 3–4 → −5 to −10; 5+ → −10 to −15. Never below 50.
- Conflict penalty: minor primary-vs-secondary conflict → −2 to −5; DXY vs rates → −5 to −10;
  Fed bias vs rates → −5 to −10; risk regime vs domestic drivers → −5 to −10; primary drivers split
  evenly → cap at 60%. Never below 50.
- Agreement boost (only with enough participation): DXY + rates agree → min 65% if `active_weight ≥
  50`; Fed + rates + real yields agree → min 70% if `active_weight ≥ 60`; VIX crisis + DXY/rates
  confirm → min 80%; `active_weight > 85` with no major conflict → may reach 90%+.
- Final conviction rounded to the nearest integer, clamped to [50, 100]. Bands (labels only):
  50–55 Very Weak, 56–64 Weak, 65–74 Moderate, 75–84 Strong, 85–100 Very Strong.

The document also forbids the old method `winning_factor_count / non_neutral_factor_count` because it
"inflates conviction when only a small number of factors are active".

**This entire formula is documentation only — §6 shows what the code really computes.**

### 5.7 Documented per-timeframe rules

The same factor framework is used for every horizon but weighted differently. Each horizon must output
a direction, a conviction and a short reason.

- **24h:** focus VIX level/delta, US 2Y 5d, real yield 5d, DXY 1d/5d, latest surprise, Fed bias.
  Give extra weight to DXY 1d/5d and rates; DXY 5d is the tiebreaker; a pending Tier-1 event cuts
  conviction by 5–10 points without removing the call; `_LEAN` if `active_weight < 50`.
- **3d:** weight F2, F3, F4, F5, F6 more heavily; if 5d deltas disagree with 1d readings, cut
  conviction; multiple Tier-1 events within 3 days cut conviction by 5–10 points.
- **Current week:** DXY 5d vs 20d, US 2Y 5d/20d, real-yield 5d/20d, US−DE spread trend. If DXY 5d and
  20d agree, conviction improves; if they disagree, cut it. Use 20d data only when supplied.
- **Next week:** structural factors only (Dollar Smile, real-yield trend, rate-differential trend,
  Fed bias, growth-surprise direction). Ignore short-term equity noise and single prints unless
  extreme. Default to `_LEAN`; conviction usually lower than 24h/3d unless several structural drivers
  align.
- **Current month:** a structural directional read — 20d DXY, 20d US 2Y, 20d real yield, Fed bias,
  Dollar Smile, surprise trend. Use 20d where available; lower-confidence lean if only 5d is available.

### 5.8 Documented missing-input rules and output format

**Missing inputs:** never guessed. Score the factor `NEUTRAL`, add the input to `missing_inputs`,
reduce conviction via the penalty, and still produce a directional call. The document names the most
important missing inputs as `fed_bias`, `us_de_2y_spread_d5_bps`, `us_10y_real_yield_d5_bps`,
`latest_us_event`, `gold_d5_pct`, `equities_regime`.

**Output format:** the agent must return **raw JSON only** (no markdown fences, no commentary). The
JSON carries `direction_<horizon>` for all five horizons, and **every `conviction_*` field must be
`null`** — the agent must never estimate, calculate, infer or invent conviction. It also carries
`score_bullish`/`score_bearish`/`score_neutral`, a `factor_breakdown` (per factor: signal, weight,
evidence, reason), `missing_inputs`, `reasoning_summary`, `risk_flags` and a `created_at`. The
deterministic engine fills the conviction fields afterwards.

---

## 6. The deterministic gate (what actually runs)

Everything below is the exported Code node `Calculate USD Conviction`. This node ignores the model's
direction and conviction entirely and recomputes from `market_inputs`.

### 6.1 Per-horizon weights (hard-coded in the node)

| Factor | 24h | 3d | current week | next week | month |
| --- | ---: | ---: | ---: | ---: | ---: |
| F1 VIX | 10 | 8 | 5 | 4 | 3 |
| F2 US 2Y | 14 | 16 | 14 | 12 | 12 |
| F3 US−DE 2Y | 10 | 16 | 18 | 20 | 18 |
| F4 US 10Y real yield | 10 | 16 | 18 | 18 | 20 |
| F5 DXY | 14 | 14 | 15 | 6 | 8 |
| F6 Gold | 4 | 8 | 7 | 5 | 5 |
| F7 US surprise | 24 | 8 | 5 | 6 | 5 |
| F8 Fed bias | 12 | 10 | 12 | 18 | 18 |
| F9 Dollar Smile | 1 | 3 | 5 | 10 | 10 |
| F10 Equity regime | 1 | 1 | 1 | 1 | 1 |
| **Total** | **100** | **100** | **100** | **100** | **100** |

Compare this with the single documented table in §5.2 (10, 14, 16, 14, 6, 5, 3, 18, 12, 2). Only the
**24h** column is even close, and it still differs on F3, F4, F5, F6, F7, F9 and F10. The per-horizon
table exists **only inside the Code node**; the rulebook never shows it.

### 6.2 The implemented signal per factor

The gate reads one delta per factor and applies a two-threshold test. Unless stated, a delta at or
above the up-threshold is BULLISH, at or below the down-threshold is BEARISH, otherwise NEUTRAL.

| Factor | Value used | BULLISH / BEARISH thresholds | Notes vs the rulebook |
| --- | --- | --- | --- |
| F1 VIX | `vix_level` | > 25 BULLISH; < 16 BEARISH | The documented `vix_d1`/`vix_d5` modifiers and the level-vs-delta conflict rule are **not implemented**. |
| F2 US 2Y | `us_2y_d20_bps` for next-week/month if present, else `us_2y_d5_bps` | ≥ +5 / ≤ −5 bps | Matches the document in spirit; adds a 20d switch. |
| F3 US−DE 2Y | `us_de_2y_spread_d5_bps` **always** | ≥ +5 / ≤ −5 bps | The 20d switch the document implies for longer horizons is **not** applied — F3 stays 5d on every horizon. |
| F4 US 10Y real | `us_10y_real_yield_d20_bps` for next-week/month if present, else `_d5_bps` | ≥ +5 / ≤ −5 bps | Adds a 20d switch. |
| F5 DXY | `dxy_d20` (next-week/month), `dxy_d1` (24h), else `dxy_d5` | 24h: ±0.15%; other horizons: ±0.3% | The document states only ±0.30% over 5 days; the ±0.15% 24h band and the 1d/20d switches are code-only. |
| F6 Gold | `gold_d20_pct` (next-week/month), else `gold_d5_pct` | < −0.1 BULLISH; > +0.1 BEARISH | The document says "falling/rising/flat" with no number; the ±0.1% band is code-only. Note 24h also uses the 5d value, never `gold_d1_pct`. |
| F7 US surprise | `latest_us_event.usd_signal` string | `"BULLISH"` → BULLISH; `"BEARISH"` → BEARISH; anything else NEUTRAL | Implemented as a **string test on the event payload**, not an actual-vs-consensus comparison, and with **no 72-hour age check** — the documented "only confirmed actual-vs-consensus" rule is not enforced. |
| F8 Fed bias | `fed_bias` string, lowercased | contains `"hawkish"` → BULLISH; contains `"dovish"` → BEARISH; else/unknown NEUTRAL | Implemented as the **absolute state**, not the documented **change** in bias. There is no prior-reading comparison. |
| F9 Dollar Smile | `vix_level` and `fed_bias` | > 25 BULLISH; < 16 **and not hawkish** BEARISH; else NEUTRAL | Only the VIX legs are implemented; the growth-context and hawkish-Fed-with-growth legs of the document are absent. |
| F10 Equity regime | `vix_level` and `nq_d1_pct` (24h) else `nq_d5_pct` | VIX<16 & NQ>0 BEARISH; VIX<16 & NQ<0 BULLISH; VIX>25 & NQ<0 BULLISH; else NEUTRAL | Matches the document's shape; VIX 16–25 is always NEUTRAL. |

Two structural points a reviewer should note:

1. **F1 and F9 are near-duplicates in code.** When VIX > 25 both fire BULLISH; when VIX < 16 and the
   Fed is not hawkish both fire BEARISH. The document explicitly warns against double-counting Factor
   1, but the code double-counts it on the VIX legs (it carries 10 + 1 = 11 points on 24h, rising to
   3 + 10 = 13 on the month horizon).
2. **F8 is the highest weight (12–18) but is a single categorical string.** Whether the call is
   hawkish, dovish or "neutral/unknown" swings a large share of the score, and the documented
   "change vs prior reading" (which is what the rulebook argues the market trades) is not computed.

### 6.3 Implemented scoring, direction, conviction and strength

For each of the five horizons the node runs the same routine:

```text
bullish, bearish, neutral = Σ weights of factors voting each way   (per-horizon table)
active            = bullish + bearish
bullish_argument  = round(bullish / active * 100)      (0 if active == 0)
bearish_argument  = round(bearish / active * 100)
net_edge          = bullish_argument - bearish_argument
base_direction    = BULLISH if bullish > bearish, BEARISH if bearish > bullish, else NO_CLEAR_BIAS
direction         = NO_CLEAR_BIAS if tie
                    else (base_direction + "_LEAN") if abs(net_edge) < 20
                    else base_direction
conviction        = winning side's argument %   (0 for NO_CLEAR_BIAS)
strength          = VERY_STRONG if abs(net_edge) >= 40
                    STRONG if >= 25, MODERATE if >= 15, else WEAK
```

The conviction is therefore **the winning side's share of active weight, uncapped and un-penalised**.
It is a share of the weight that was active, not a probability, and not a share of the full 100.
Every documented cap, penalty and boost in §5.6 is replaced by three constant fields that are always
zero (`conflict_penalty: 0`, `missing_input_penalty: 0`, `agreement_boost: 0`), and a
`participation_cap` field that is set equal to `active` (i.e. it never caps). The node keeps the
legacy field names `weighted_edge`, `raw_conviction` and `base_conviction` for the dashboard, but fills
them with the argument share and its arithmetic neighbour `abs(net_edge)/100`, not the documented
`abs(bullish_weight - bearish_weight)/100`.

Note the strength ladder here (`abs(net_edge)` at 40/25/15) is a **fourth** labelling scheme,
different from both the documented conviction bands (§5.6) and the dashboard's own strength word (§9).

### 6.4 The row the gate writes

The node's returned row has three layers:

- **Top level:** `direction_*` and `conviction_*` for all five horizons, the legacy
  `call_<h>_direction` / `call_<h>_conviction` / `call_<h>_reason` mirrors, the 24h
  `factor_breakdown`, `reasoning_summary`, and the three factor **counts** `score_bullish` /
  `score_bearish` / `score_neutral`.
- **`full_output` (identical to `raw_agent_output`):** all of the above plus `weighted_score` (the
  **weight sums** `bullish_weight` / `bearish_weight` / `neutral_weight` / `active_weight` /
  `weight_margin`), `conviction_model`, and a `timeframe_models` object holding every per-horizon
  model. `weighted_score` and `conviction_model` exist **only** here, not at the top level.
- **Stripped before write:** `market_inputs`, `snapshot_selection`, `input_validation_warnings` and
  `model_reported_warnings` are removed, so the inserted row keeps no raw inputs.

Two naming traps. First, the top-level `score_bullish` / `score_bearish` / `score_neutral` are **factor
counts** (6 / 3 / 1 on the worked example), while `weighted_score` holds the **weights** (84 / 15 / 1)
— the same names meaning different things in two places. Second, `conviction_*` is the gate's raw
argument share, **not** the headline confidence the dashboard displays (§9).

---

## 7. Document vs code: the differences that matter

| # | Area | Document says | Code does | Impact |
| --- | --- | --- | --- | --- |
| 1 | Weights | One 100-point table for all horizons | Five different per-horizon tables (F7 is 24 on 24h but 5 on the month; F9 is 1 on 24h but 10 on the month) | The same factor can flip the verdict depending on horizon; the rulebook cannot be used to predict the number. |
| 2 | Conviction | `50 + edge×50`, then caps, penalties, boosts | Winning side's share of active weight, no caps or penalties | Conviction is systematically different from the documented number and is not comparable to the documented bands. |
| 3 | Primary/secondary driver agreement | Explicitly raises or lowers conviction | Not implemented at all | A documented conviction lever is silently absent. |
| 4 | `_LEAN` rule | Lean if active<50, margin<15, conflict, missing inputs, tiebreaker, or conviction<65 | Lean **only** if `abs(net_edge) < 20` | Code produces full BULLISH/BEARISH in cases the document calls a lean, and vice versa. |
| 5 | F1 | Level + 1d/5d modifiers + conflict handling | Level only | Two documented sub-rules dropped. |
| 6 | F8 | Change in Fed bias vs prior reading | Absolute `fed_bias` string | The rulebook's own headline argument ("the market trades the change") is not implemented; a static hawkish regime scores BULLISH forever. |
| 7 | F7 | Confirmed actual-vs-consensus within 72h | A `usd_signal` string, no age check | Stale or unconfirmed events can still carry 24 points on the 24h horizon. |
| 8 | F9 | Four legs incl. growth context | VIX + Fed only | Duplicates F1 rather than measuring the smile. |
| 9 | Missing-input penalty | Documented ladder, never below 50 | Neutral factor simply contributes 0 | Letting missing inputs go NEUTRAL *lowers* the argument share, but there is no explicit floor other than 50 implied by the maths. |
| 10 | Warning/anomaly checks | Documented rules to ignore, down-weight or warn on outliers and stale prints | None of these checks exist in the gate | Bad-but-present inputs are scored as if normal. |
| 11 | What `conviction_*` means | The published conviction is the number the user sees | `conviction_*` is the raw argument share; the published headline confidence is computed downstream from the same arguments and is a different number (85 vs 87 on the worked example) | Comparing a stored `conviction_*` with the dashboard badge shows a mismatch that is not an error. Shown in §8 and §9. |

Nothing in this table is a bug claim: it is a statement that the two artefacts describe different
systems. Which one is "the logic" is exactly the question a reviewer should settle.

---

## 8. Worked example: the frozen 2024-01-09 snapshot

`backtester/fixtures/usd_live_replay_24h_parity_fixture.json` stores a snapshot and an expected 24h
call. Running the extracted `Calculate USD Conviction` code against that snapshot (harness
`tmp/usd-logic-doc/run-gate.cjs`) produced:

- **24h direction `BULLISH`, gate `conviction_24h` 85, strength `VERY_STRONG`.**
- The frozen fixture's `expected_live_24h.conviction_24h` is **87**.

Those two numbers look like a parity failure. They are not; §8.3 shows they are the same call measured
two different ways, and that the harness reproduces the fixture exactly once the right field is
compared.

### 8.1 The 24h factor votes the gate produced (verbatim)

| Factor | Signal | Weight (24h) | Evidence the gate read | Reason the gate attached |
| --- | --- | ---: | --- | --- |
| F1 VIX | BEARISH | 10 | VIX 13 | Risk-on rotation away from USD |
| F2 US 2Y | BULLISH | 14 | US 2Y 5d bps 6 | US front-end yields support USD |
| F3 US−DE 2Y | BULLISH | 10 | US-DE 2Y spread 5d bps 6 | Relative rates support USD |
| F4 US 10Y real | BULLISH | 10 | Real yield 5d bps 7 | Rising real yields support USD |
| F5 DXY | BULLISH | 14 | DXY 1d % 0.2 | DXY confirms USD strength |
| F6 Gold | BEARISH | 4 | Gold 0.2% | Gold strength pressures USD |
| F7 US surprise | BULLISH | 24 | US CPI | Positive US surprise supports USD |
| F8 Fed bias | BULLISH | 12 | Fed bias hawkish | Hawkish Fed supports USD |
| F9 Dollar Smile | NEUTRAL | 1 | No clear Dollar Smile edge | Insufficient regime evidence |
| F10 Equity regime | BEARISH | 1 | NQ 0.5% risk-on | Risk appetite reduces USD demand |

Summing: `bullish_weight = 84`, `bearish_weight = 15`, `neutral_weight = 1`, so `active = 99` and
`weight_margin = 69`. Then `bullish_argument = round(84 / 99 × 100) = 85`, `bearish_argument = 15`,
`net_edge = +70`, `conviction = 85`, `strength = VERY_STRONG` (≥ 40). The whole conviction number is
`84 / 99` — the share of the **15 points of opposing weight plus 84** that voted bullish, with the
single neutral point (F9) excluded from the denominator entirely.

### 8.2 All five horizons from the same snapshot (verbatim)

| Horizon | Direction | Conviction |
| --- | --- | ---: |
| 24h | BULLISH | 85 |
| 3 day | BULLISH | 80 |
| current week | BULLISH | 84 |
| next week | BULLISH | 89 |
| current month | BULLISH | 90 |

The spread 80→90 across one snapshot is the clearest illustration of §7 row 1: the five horizons are
not five estimates of one probability, they are five different weight tables applied to a few shared
signals, so the numbers are not independent evidence and should not be averaged or compared as if they
were.

### 8.3 The 85-vs-87 question, resolved

Both numbers are correct. They are **different quantities stored under the same field name**, and
resolving the question needed three artifacts rather than two: the exported gate, the replay core the
fixture is locked to, and the dashboard confidence contract.

```text
winning-side argument share   85   raw share of active weight, 84/99          gate + replay core
headline confidence           87   blended score of the gate's arguments      headline_confidence.js
```

Only the second is what the dashboard publishes. Neither is wrong; they are not interchangeable.

The repository's browser/dashboard confidence contract
(`backtester/lib/headline_confidence.js`, `computeHeadlineConfidenceData`) computes:

```text
confidence = (max(bull_case, bear_case)/100) * 0.45
           + (participation/100)            * 0.35
           + (abs(net_edge)/100)            * 0.20
           then subtract penalties (participation < 40 or < 25, |net_edge| < 20,
           >= 3 or >= 6 missing inputs, event-risk / consolidation / audit warnings)
           final = round(clamp(confidence, 0, 1) * 100)
```

Feeding in **the gate's own numbers** from §8.1 — `bull_case 85`, `bear_case 15`, `participation 99`,
`net_edge 70`, no warnings, no missing inputs:

```text
0.85*0.45 + 0.99*0.35 + 0.70*0.20 = 0.869   ->  87
```

Exactly the fixture's value. All penalties are inactive here (participation 99 ≥ 40, |net_edge| 70 ≥ 20,
0 missing inputs, no warnings), so nothing is subtracted. The harness prints this reconciliation and
reports `match: YES - fixture stores headline confidence`.

Where each artifact puts which number:

| Artifact | `conviction_24h` holds | Raw share lives in | Headline lives in |
| --- | --- | --- | --- |
| Exported gate `Calculate USD Conviction` | **85** (raw share) | `conviction_model.raw_conviction`, `base_conviction`, `final_conviction` | *nowhere — the export never computes it* |
| Replay core `usd_replay_core.js` | **87** (headline) | `conviction_model.raw_conviction`, `base_conviction`, `legacy_winning_side_conviction` | `predicted_conviction`, `conviction_model.final_confidence` |
| Fixture `expected_live_24h` (USD) | **87** (headline) | `conviction_model.bullish_argument_pct` (85) | `conviction_model.final_conviction` (87) |
| Jan-2024 checker rows | **headline** | `predicted_conviction` (raw) | `displayed_headline_confidence_pct`, `conviction_model.final_conviction` |

**The five asset parity fixtures do not agree with each other.** Reading all five
`*_live_replay_24h_parity_fixture.json` files the same way, and recomputing each headline from its own
arguments:

| Fixture `expected_live_24h` | `conviction_24h` | equals | headline stored where | strength label(s) |
| --- | ---: | --- | --- | --- |
| `btc_...` | 73 | **raw share** (73) | `displayed_headline_confidence_pct` = 60 | `raw_strength_bucket` VERY_STRONG vs `headline_strength_bucket` MODERATE |
| `nq_...` | 86 | **raw share** (86) | `displayed_headline_confidence_pct` = 28 | VERY_STRONG vs WEAK |
| `eur_...` | 89 | **raw share** (89) | *no field at all* — the headline (59) is unrecoverable from the fixture | `strength_bucket` VERY_STRONG |
| `usd_...` | 87 | **headline** (raw share 85) | *no field at all* | `strength_bucket` VERY_STRONG |
| `gold_...` | 0 | **headline** (raw share 50) | `headline_confidence_pct` = 0 | `strength_bucket` WEAK |

Three separate problems are visible in that one table:

1. **The same field name carries two different quantities.** `conviction_24h` is the raw winning-side
   share in the BTC, NQ and EUR fixtures and the headline in the USD and GOLD fixtures. NQ is the
   sharpest case: the identical call is `86`/VERY_STRONG by the raw convention and `28`/WEAK by the
   headline convention — a 58-point and three-bucket divergence on one snapshot. Anything comparing
   `conviction_24h` across assets without knowing which convention produced it is comparing two
   different quantities.
2. **The fixtures use three different key schemas.** BTC/NQ use `displayed_headline_confidence_pct` plus
   two bucket fields; GOLD uses `headline_confidence_pct`; EUR, USD and the GOLD `conviction_model` mix
   in others again. Code written against one fixture will not find the headline in another.
3. **Some fixtures cannot yield the headline at all.** The EUR fixture stores only the raw share and no
   headline field, so the published number that the dashboard would have shown for that call cannot be
   reconstructed from the parity artifact.

This is the strongest evidence that §8.3 is a schema/semantics defect rather than a one-off naming slip:
the ambiguity reproduces independently across five assets, and in a different direction each time.

The replay core stamps the model it implements into its own output:
`conviction_model.confidence_model_source = "live_dashboard_confidence_v1"`. So the substitution is
**deliberate and self-declared**, not drift — the replay's author moved the raw share out of
`conviction_24h` and put the headline in its place. The fixture itself says so, in its `meta` block:

```json
"purpose": "One-snapshot live-vs-replay parity gate for USD 24H before any January/full-year expansion.",
"live_source_of_truth": "exports/usd_layer1_agent.json",
"replay_source_under_test": "backtester/replay/usd/usd_replay_core.js",
"notes": [
  "The expected output is frozen from the current live USD deterministic workflow logic.",
  "This fixture intentionally uses a snapshot that exposes known live-vs-replay mismatches for 24H.",
  "Reason text and timestamps are not parity-gated."
]
```

Note the fixture's own scope limit: **reason text and timestamps are not parity-gated**, so `PASS` covers
the numeric fields only.

**What the parity gate therefore proves, and does not prove.** Running the repository's own check
(`node backtester/scripts/check_usd_live_replay_24h_parity.js`) prints `Parity result: PASS`. It compares
replay-core output against the fixture, field by field, including `conviction_24h`. That is a real result
and it is the reason the fixture is trustworthy as a *replay* gate. It does **not** prove the exported
gate agrees, because the check never runs the export: on the same snapshot the export yields
`conviction_24h 85` and `conviction_model.final_conviction 85`, the replay yields `87` and `87`. Four
consequences follow:

1. **Two artifacts both called "live" disagree on `conviction_24h` for the same snapshot** — 85 from the
   export named in `meta.live_source_of_truth`, 87 from the replay that `Parity result: PASS` certifies.
   The parity gate cannot catch this because it holds only one side of the comparison.
2. **The disagreement is confined to the conviction fields.** Direction, `weighted_score`
   (84/15/1/99/69), the factor votes (6/3/1) and `factor_breakdown` are identical across export, replay
   and fixture. The gate's arithmetic is not in question; the naming is.
3. **A reader cannot tell the two apart from the field name.** `conviction_24h = 87` looks exactly as
   authoritative as `conviction_24h = 85`. Anything downstream that reads a "conviction" and compares it
   across assets (BTC's `conviction_24h` is its raw share, per its own fixture) is mixing two scales.
4. **The strength labels are likewise different rules.** The export labels from |net edge| alone
   (≥40 VERY_STRONG, ≥25 STRONG, ≥15 MODERATE); the headline contract labels from confidence **and** edge
   **and** participation together. They happen to agree here (`VERY_STRONG` either way) and pointedly do
   not on the BTC fixture (raw `VERY_STRONG` vs headline `MODERATE`).

This is the single most consequential ambiguity in the USD layer. It is a **reporting/semantics** problem,
not a maths bug — but it means any "is the replay faithful to live?" claim must name which field, which
artifact, and which of the two numbers it is asserting.

---

## 9. Downstream of the gate: headline confidence and Layer 2

The gate is not the last step. Two downstream contracts consume its numbers, and both are the reason the
"conviction" a user sees is not the number the gate computes.

### 9.1 The headline confidence contract

`backtester/lib/headline_confidence.js` is the repository's single published confidence rule. It is a
UMD-style module usable in both the browser and Node, exposing `computeHeadlineConfidenceData(input)`.

```text
input : bullCase, bearCase, participation, netEdge, direction, missingInputs,
        warnings, weeklyCandleStatus, fallbackConfidence, strengthOverride
    confidence = (max(bullCase, bearCase)/100) * 0.45      // evidence dominance
               + (participation/100)          * 0.35      // how much of the book engaged
               + (abs(netEdge)/100)           * 0.20      // size of the disagreement
    if participation <  40 -> -0.10
    if participation <  25 -> -0.20          // stacks with the above
    if |netEdge|     <  20 -> -0.10
    if missingInputs >=  3 -> -0.05
    if missingInputs >=  6 -> -0.10          // stacks with the above
    if warnings mention event risk / high impact event / tier 1 event        -> -0.10
    if weekly candle status is "consolidating" or warnings mention weekly
       consolidation                                                         -> -0.05
    if warnings mention conviction audit / audit flag / audit warning        -> -0.05
    if warnings mention "o layer"                                            -> -0.05
    if warnings mention adr warning / session warning                        -> -0.05
    value = round(clamp(confidence, 0, 1) * 100)
```

It returns `{ value, strength, evidenceDominance, participation, netEdge, missingInputsCount }`, where
`strength` comes from a *joint* test rather than from `value` alone:

```text
VERY_STRONG : value >= 80 AND |netEdge| >= 25 AND participation >= 50
STRONG      : value >= 65 AND |netEdge| >= 18 AND participation >= 35
MODERATE    : value >= 50 AND |netEdge| >= 10 AND participation >= 25
WEAK        : value > 0
PENDING / NO_CALL otherwise
```

That joint test is why a very high headline can still print as WEAK: a 100% one-sided argument share with
`participation 16` and `netEdge 100` yields `round(1.00*0.45 + 0.16*0.35 + 1.00*0.20) = 36` and the label
WEAK, because participation 16 < 25. This appears repeatedly in the BTC checker corpus and is intended
behaviour, not a rounding artefact.

If any of the four core inputs is missing the function does not compute a score at all — it returns
`value: fallbackConfidence` (normally `null`). A missing input degrades the published number to a
fallback instead of silently scoring a partial book.

### 9.2 Verification: the formula reproduces every stored USD headline

The strongest available check is the historical USD checker,
`data/backtester-checker-usd-24h-2024-01.json` (604 evaluated 24h rows), which stores both the arguments
and the published headline. Recomputing the headline from each row's own `bull_case_pct`,
`bear_case_pct`, `participation_pct`, `net_edge_pct`, `missing_inputs` and `warnings` reproduces the
stored `displayed_headline_confidence_pct`:

| Check over 604 USD 24h checker rows | Result |
| --- | ---: |
| exact matches | **604** |
| mismatches | 0 |
| rows where the headline could not be computed | 0 |

So the headline contract is not a one-off reinterpretation of the 2024-01-09 snapshot; it is stable
across a full month of USD calls. The same corpus makes the two-number split visible in its own
structure: `predicted_conviction` holds the raw winning-side share while
`displayed_headline_confidence_pct` holds the published score, and on 584 of 604 rows
`conviction_model.final_conviction` agrees with the *headline* rather than with `predicted_conviction`.
The historical artifact therefore carried the same ambiguity §8.3 describes.

The same formula also reproduces the **BTC** (60, MODERATE) and **NQ** (28, WEAK) parity fixtures' stored
headlines and strength buckets from their own arguments, so the headline contract is cross-asset rather
than a USD-only convention. What is *not* consistent across assets is which field the headline is written
into, and that is the §8.3 finding.

### 9.3 Layer 2 combines the two Layer 1 numbers with `min()`, not an average

`backtester/lib/layer2_pair_logic.js#deriveLayer2PairSignal` is the pair contract. It takes a target
asset's Layer 1 call and the USD Layer 1 call, and returns a pair decision. It fires only when all four
gates below are satisfied:

| Gate | Outcome when not met |
| --- | --- |
| target direction is exactly `BULLISH` or `BEARISH` | `unsupported_target_direction`, not tradable |
| USD direction is exactly `BULLISH` or `BEARISH` | `unsupported_usd_direction`, not tradable |
| both confidences are numeric | `missing_combined_confidence`, not tradable |
| the two directions are **opposite** | `same_direction_conflict`, not tradable |

When all four hold:

```text
direction          = target BULLISH + USD BEARISH -> BUY
                     target BEARISH + USD BULLISH -> SELL
combinedConfidence = min(targetConfidence, usdConfidence)
strengthBucket     = VERY_STRONG >= 80, STRONG >= 65, MODERATE >= 50, WEAK >= 0
```

Three properties matter for anyone reasoning about USD:

1. **`min()` means the weaker leg sets the pair's confidence.** A 90-confidence target against a
   55-confidence USD call produces a 55 pair. Averaging would give 72.5 and overstate the trade, so the
   repository deliberately takes the pessimistic bound.
2. **`_LEAN` directions are excluded.** The USD gate emits `BULLISH_LEAN`/`BEARISH_LEAN` whenever
   |net edge| < 20 (see §6.3). Layer 2's `normalizeDirectionalSignalKey` returns `null` for anything
   other than the two exact strings, so every lean call removes USD as a pair leg entirely. The
   |net edge| < 20 boundary in the gate is therefore a **Layer 2 gate too**, not merely a display choice.
3. **The pair inherits the §8.3 ambiguity.** `min()` is taken over whichever number each Layer 1 artifact
   puts in its confidence field — raw share on the export, headline on the replay and the checkers. The
   pair result is only as well-defined as §8.3 is resolved.

### 9.4 The realised outcome Layer 2 is scored against

Layer 2 has no independent price series of its own: the pair outcome recorded by the calibration layer is
the **target-side stored checker outcome on the pair market**
(`backtester/lib/confidence_calibration.js`, `buildLayer2Observations`). USD contributes the confidence
leg; it does not contribute the outcome. That is a deliberate design choice and also a limit — a USD-only
error cannot appear as a pair loss unless it changed whether the pair fired at all.

---

## 10. What a reviewer should scrutinise

Ordered by how much a wrong answer would cost:

| # | Question | Where the answer lives | Why it matters |
| ---: | --- | --- | --- |
| 1 | Is `conviction_24h` the raw share or the headline? | §8.3; export vs `usd_replay_core.js` vs the five parity fixtures | Every cross-asset comparison and every calibration bucket depends on it, and the fixtures do not agree: BTC/NQ/EUR store the raw share, USD/GOLD the headline. |
| 2 | Does the rulebook the analyst reads match the code that runs? | §7 diff table (11 rows) | Only the 24h weight column is close; weights, thresholds and several factors are code-only. |
| 3 | Are the ten factors independent? | §6.2, §7 | F2/F3/F4 are three rates signals and F5 is DXY; correlated votes are summed as if independent. |
| 4 | Is the gate reading causal, correctly-timed inputs? | §4 input contract | A `latest_us_event` with `age_hours 120` still votes at weight 24 on the 24h horizon. |
| 5 | Does the fixture prove live behaviour? | §8.3 | `Parity result: PASS` compares replay to fixture; it never runs the export. |
| 6 | What does the gate do when inputs are missing? | §6.3 missing-input penalty | Missing inputs are scored NEUTRAL, which *reduces* the denominator and can raise the winning share. |

---

## 11. How this dossier was built and how to re-check it

| Artifact | Role |
| --- | --- |
| `logic/agent_usd_direction.md` (rulebook v2.1) | The documented intent, quoted in §5. |
| `exports/usd_layer1_agent.json` -> `Calculate USD Conviction` | The implemented gate, quoted in §6; extracted verbatim to `tmp/usd-logic-doc/Calculate_USD_Conviction.js`. |
| `backtester/fixtures/usd_live_replay_24h_parity_fixture.json` | The frozen 2024-01-09 worked example in §8. |
| `backtester/replay/usd/usd_replay_core.js` | The replay the fixture is locked to; origin of the headline-in-`conviction_24h` convention. |
| `backtester/scripts/check_usd_live_replay_24h_parity.js` | The parity gate; prints `Parity result: PASS`. |
| `backtester/lib/headline_confidence.js` | The published confidence contract in §9.1. |
| `backtester/lib/layer2_pair_logic.js` | The `min()` pair contract in §9.3. |
| `backtester/lib/confidence_calibration.js` | The observation builder in §9.4. |
| `data/backtester-checker-usd-24h-2024-01.json` | 604 evaluated USD 24h rows; the corpus behind §9.2. |
| `tmp/usd-logic-doc/run-gate.cjs` | Local harness: runs the extracted gate on the fixture snapshot and prints the §8.1-8.3 comparison. |
| `tmp/usd-logic-doc/verify-headline-corpus.cjs` | Recomputes the headline over all 604 USD checker rows and counts matches (§9.2). |
| `tmp/usd-logic-doc/verify-fixture-conventions.cjs` | Prints, per asset fixture, whether `conviction_24h` is the raw share or the headline (§8.3). |

Re-running the checks quoted in this dossier:

```powershell
node tmp/usd-logic-doc/run-gate.cjs                             # gate output vs fixture + headline reconciliation
node tmp/usd-logic-doc/verify-headline-corpus.cjs               # 604/604 headline reproduction
node tmp/usd-logic-doc/verify-fixture-conventions.cjs           # which of the five fixtures store which number
node backtester/scripts/check_usd_live_replay_24h_parity.js     # replay vs fixture -> Parity result: PASS
```

All four are read-only, local and deterministic. None touches the linked warehouse, the live workflow
nor the published dashboard, so none is evidence of live deployment.

**Standing limits.** This dossier describes the logic of one agent from a frozen export and a frozen
fixture. It is not proof that the pipeline runs these inputs in this order live, that the inputs were
available at call time, or that any of it has trading edge. Per the repository's own discipline, a
passing replay is a parity result, not an edge result.

---
