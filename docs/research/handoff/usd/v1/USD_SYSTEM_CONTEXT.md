# USD system context (shared by every USD research pack)

Extracted from the repository on 2026-10-14 on branch `research/usd-session-20261013` at commit
`d07af11166ea1d39e5f4184e85a993e03bcb7137`, plus the scoped live export of 2026-10-11. This file is the
shared context half of every USD research pack: a pack carries its own factor-specific material and points
here for the engine, the target and the known defects. Nothing in this file is a research result; where a
fact is unavailable or ambiguous, that is stated rather than filled.

Two versions are kept apart throughout, because they are different facts. The **executing version** of the
USD workflow is **v155**, published on 2026-10-12T19:52:13.451Z (version id
`0fb553c2-b1f1-4afa-bfdc-1166b60a6a79`, `versionCounter` 155, `nodes_sha256`
`b2583215ca256a96dd0d7693635a66681fff42595805cdb254d48ae52960b974`) when the null-versus-unavailable guard
was applied to it live. The **audited baseline** is `exports/usd_layer1_agent.json`, a repository export
measured against v154 on 2026-10-11, and its `Calculate USD Conviction` jsCode
(`580f0aa34bc1dd5d210e0dc3391dd653414ac1f68fbc0594133dc597a29254d4`) is the same bytes the executing version
runs. Every code fact below was read from that export, so it describes the arithmetic in force; only the
version number of the running workflow has moved since.

## 1. The research objective and its horizon

Forecast the direction of the US dollar over one session: the change in the label instrument from
**05:00 Europe/London** to **05:00 Europe/London on the next local date** (05:00Z while London is on GMT,
04:00Z while London is on BST). One call per session, decided from inputs observable at the cutoff.

Horizon correction, 2026-10-14: the original statement of this target was 05:00 London to **17:00
America/New_York** on the same local date. It is withdrawn. The endpoint is now a London wall-clock time one
local date later; `America/New_York` is no longer part of the session definition (it survives only where the
timing of the Federal Reserve H.10 release is described), and the identifier
`london-0500-to-london-0500-next-day` is fixed in `session_contract_v1.json`, in
`backtester/lib/usd_session_engine_interface.js` (`usd-session-engine-interface-v2`) and in the card schema.
A fixed hour count is never used to build the window; each end is resolved from the declared London
transitions.

- **Session length.** Every eligible session is exactly 24 hours. The London spring and autumn transitions
  fall inside the excluded Saturday start, which measures 23 or 25 hours and is not a session. Held by test
  over every Monday-to-Friday start from 2023 to 2027.
- **Eligible starts.** Monday to Friday local dates only; Saturday and Sunday starts are never sessions.
- **Friday and the weekend.** The Friday session contains Friday's US close and ends on Saturday morning.
  That is intended. No session is silently extended to Monday: a session whose start or endpoint print is
  missing is never filled, forward-carried or interpolated.
- **Missing quotes.** One proposed policy, to be frozen with the dataset before any candidate is scored, and
  recorded in `session_contract_v1.json`, whose entry still reads `UNDECIDED`: a session whose start or
  endpoint print is missing, stale or later revised is a **data exclusion** - it leaves the scored sample and
  is reported as coverage, and nothing is filled, carried forward or interpolated.
  `target_source_assessment.md` §4 lists the five questions the chosen quote source must answer in writing
  first.
- **Data exclusions and model abstentions are not the same object.** They are counted and scored separately:
  an abstention is the model declining to give a direction on a session whose two ends both exist, that
  session stays in the scored sample and is scored as a no-call, and an exclusion is never reported as an
  abstention or the other way round.
- **The label's flat band and the study's own tie policy.** Undecided, and frozen with the missing-quote
  policy. The 0.1 percentage-point band of the closed 24-hour study was fitted to a daily index over a
  nominal day and may not be carried over. This is a different object from the deployed engine's exact tie of
  two weight sums, which is reachable arithmetic (below, §3.4 and §6.3).

## 2. Architecture: the complete path from inputs to the published call

```
Data Collector - USD (exports/usd_collector.json, ~29 nodes)
  -> Supabase table market_snapshots, one row appended per run (in practice one row per day)
USD Layer 1 Agent (workflow OCt1tB9yVMUgFTha, executing version v155 since 2026-10-12, 9 nodes)
  Supabase Get Many                getAll, no filter: the whole table is fetched
  -> Build USD Input Pack          selects one snapshot, builds available_inputs and warnings
  -> Get USD Logic Document        fetches logic/agent_usd_direction.md live from GitHub on every run
  -> Combine md & market snapshot  joins rulebook text and the day's inputs
  -> Message a model               gpt-4.1-mini, returns raw JSON only
  -> Parse USD Agent Output        reads per-factor verdicts and the model's own direction/conviction
  -> Calculate USD Conviction      deterministic weighted scoring; the published numbers are computed here
  -> Create a row                  Supabase agent_outputs
  -> Build Layer 1 JSON            (Dashboard Writer) -> data/layer1.json
  -> data/layer2.json              (Layer 2 pair logic, confidence = min(target, USD))
  -> dashboard 24H tiles, conviction, confidence, strength band, Pair Analysis
```

The model writes **verdict strings per factor**; the code computes every number that is published, and where
they disagree the published number is the code's. The model's own direction and conviction survive only
inside `full_output` / `raw_agent_output` (claim C1 in `discovery_report.md`). Non-JSON model output throws,
so the model can abort a run but cannot author one.

Runtime identity: n8n Cloud, workspace `https://silver17.app.n8n.cloud`, project `ISQG9XU7TGTT6Fcu`. Live
workflow: `USD Layer 1 Agent`, id `OCt1tB9yVMUgFTha`, executing version v155 since 2026-10-12 (the applied
null-versus-unavailable guard); the code facts here were measured against v154 on 2026-10-11, when its code
nodes were byte-identical to `exports/usd_layer1_agent.json` in the scoped export of
2026-10-11T18:59:54.307Z, and `Calculate USD Conviction` is byte-equal between that export and v155. The
collector is `exports/usd_collector.json`, a repository snapshot; the collector's live identity was not
re-measured in that export.

## 3. Current prompt, rules, weights, thresholds and overrides

### 3.1 The prompt that runs live

Two parts, both in `exports/usd_layer1_agent.json`, node `Message a model`, model `gpt-4.1-mini`:

- **System message.** "You are the USD Layer 1 Direction Agent. You must follow the supplied USD logic
  document exactly. You analyse USD only. You must not produce pair calls, trade recommendations,
  cross-asset calls, consensus calls, or Layer 2 event-adjusted calls. Use only the supplied market snapshot
  and supplied logic document. If required inputs are missing, score the affected factor as NEUTRAL and
  clearly state the missing input. Return valid JSON only. Do not wrap the JSON in markdown fences. Do not
  include ```json. Return raw JSON only."
- **User message.** An expression node serialising `{ logic_document, market_snapshot, output_requirement:
  { asset: "USD", layer: "Layer 1 Raw", format: "valid_json_only" } }`, where `logic_document` is the
  rulebook fetched live from GitHub in that run. The committed rulebook is therefore live input on every run.

### 3.2 The rulebook that is fetched from GitHub

`logic/agent_usd_direction.md`, **version 2.1**, "Production baseline for USD Layer 1", 16 sections: agent
role; core output principle; Layer 1 isolation; weighted factor model; the ten factors; the weighted scoring
process; the directional verdict rule; the weighted conviction reference; timeframe rules; missing input
rules; direction naming; output format; dashboard-friendly output rules; an example; "key rules — do not
violate"; development note. It is documented guidance **and** live input. It is not the arithmetic.

### 3.3 The ten factors, the two weight vectors and the thresholds

Coded weights (`Calculate USD Conviction`, literal `TIMEFRAME_WEIGHTS`, timeframe `24h`) against the
rulebook's own table (§4). Both are live, they disagree, and nothing reconciles them.

| # | Factor | Rule as coded (24h) | Lookback used | Threshold | Coded | Rulebook |
| --- | --- | --- | --- | --- | ---: | ---: |
| F1 | VIX level and risk regime | >25 BULLISH, 16–25 NEUTRAL, <16 BEARISH | level only | 25 / 16 | 10 | 10 |
| F2 | US 2Y yield delta | ≥ +5 bps BULLISH, ≤ −5 bps BEARISH | 5d (20d on longer timeframes) | ±5 bps | 14 | 14 |
| F3 | US–DE 2Y spread delta | ≥ +5 BULLISH, ≤ −5 BEARISH | 5d for 24h | ±5 bps | 10 | 16 |
| F4 | US 10Y real yield delta | ≥ +5 BULLISH, ≤ −5 BEARISH | 5d (20d on longer timeframes) | ±5 bps | 10 | 14 |
| F5 | DXY delta | ≥ +0.15% BULLISH, ≤ −0.15% BEARISH | **1 day** on 24h (5d/20d elsewhere) | ±0.15% | 14 | 6 |
| F6 | Gold delta | ≤ −0.1% BULLISH, > +0.1% BEARISH | 5d, 1d fallback | ±0.1% | 4 | 5 |
| F7 | US economic surprise | `latest_us_event.usd_signal` copied straight through | whatever the collector stored | none | 24 | 3 |
| F8 | Fed bias | string contains "hawkish" / "dovish" | current string only | none | 12 | 18 |
| F9 | Dollar Smile regime | VIX>25 BULLISH; VIX<16 and not hawkish BEARISH | level only | 25 / 16 | 1 | 12 |
| F10 | Equity versus USD | VIX<16 with NQ up BEARISH; VIX<16 with NQ down BULLISH; VIX>25 with NQ down BULLISH | NQ 1d | 16 / 25 | 1 | 2 |

The coded literal also carries `3d`, `current_week`, `next_week` and `current_month` vectors; the rulebook
publishes one table. A third file, `config/usd_24h_ruleset_v2.json`, is `CANDIDATE_SHADOW_ONLY` with
`production_enabled: false` and has never run in n8n: an alternative configuration, not executing code.

### 3.4 Aggregation, overrides and confidence

From `Calculate USD Conviction`, the only path that produces the published number:

1. Each factor is `BULLISH`, `BEARISH` or `NEUTRAL`, chosen by the thresholds above; a missing input becomes
   `NEUTRAL` with a reason string naming the missing input.
2. `bullish` and `bearish` are the sums of the weights of the bullish and bearish factors;
   `active = bullish + bearish`.
3. `bullishArgument = round(bullish / active * 100)`; `netEdge = bullishArgument − bearishArgument`.
4. Direction is the larger side, suffixed `_LEAN` when `|netEdge| < 20`; `NO_CLEAR_BIAS` only on an exact
   tie of the two weight sums. The deployed 24h vector can produce one (F2 + F3 + F4 + F6 + F8 = 50 against
   F1 + F5 + F7 + F9 + F10 = 50), so abstention is reachable arithmetic rather than a designed gate, and the
   rulebook's own tiebreaker hierarchy is never read by any code path.
5. `conviction` is the winning argument percentage — a **share of active evidence**, not a probability. It
   can read 100% while half the weight is missing, because missing inputs fall into the neutral pile rather
   than into `active`.
6. Strength bands in the deployed pipeline are 40 / 25 / 15. The dashboard derives a second bucket from the
   shares, the participation and the net edge (`VERY_STRONG` if confidence ≥ 80 and |netEdge| ≥ 25 and
   active ≥ 50; `STRONG` if ≥ 65 / ≥ 18 / ≥ 35; `MODERATE` if ≥ 50 / ≥ 10 / ≥ 25; else `WEAK`). The
   mapping contract `layer1-confidence-map-v2` (`backtester/lib/layer1_confidence_mapping.js`, working-tree
   copy carrying uncommitted edits from a separate workstream) keeps an evidence share, a heuristic strength
   and a calibrated probability in three separate blocks, publishes both strength labels with the
   calculation each came from, records whether they agree, and keeps `p_up_24h` null until a calibration
   model exists. No calibrated probability is published today.

Overrides and fallbacks, all inside the code path:

- The model's own `direction_24h` / `conviction_24h` are overwritten by the deterministic node.
- The substitution ladder, read from the two deployed nodes: inside `Build USD Input Pack` `gold_d5_pct` falls
  back to `gold_d1_pct` and `nq_d5_pct` to `nq_d1_pct`, each recorded only as a warning string; inside
  `Calculate USD Conviction` F2, F4, F5 and F6 prefer the 20-day delta on `next_week` and `current_month`,
  F5 takes `dxy_d1` on 24h and otherwise `dxy_d5` (no `d20` arm on 24h), and F10 takes `nq_d1_pct` on 24h,
  else `nq_d5_pct`, with no `d20` arm. The substitution is invisible in the numeric payload (C11).
- Snapshot selection takes the newest row containing all 14 required fields, else simply the newest row,
  with `selected_by` recording which. There is **no** cutoff-at-t bound, no per-field age, no FUTURE/STALE
  state and no way to exclude revised data (C12).
- Rulebook machinery that does not execute: the VIX 1d/5d modifiers and the "stronger message wins"
  conflict rule, F8 as a *delta*, and the participation cap, missing-input penalty, conflict penalty and
  agreement boost of §8.2–8.5 (the code hard-codes those legacy aliases to 0 or to `active`).
- Implemented but not documented in the rulebook: the 1-day DXY and 1-day NQ reads on the 24h timeframe, the
  substitution ladder, and the tiebreak-free return: an exact tie of the two weight sums yields a
  `NO_CLEAR_BIAS` verdict with conviction 0, the coded 24h vector can in fact produce such a tie (F2 + F3 +
  F4 + F6 + F8 = 50), and the rulebook's tiebreaker hierarchy is never read by any code path.

## 4. Executing code, alternative configuration, rulebook guidance

| Class | Examples | Authority |
| --- | --- | --- |
| **Executing code** | `exports/usd_layer1_agent.json` (the audited baseline, measured at v154 on 2026-10-11; byte-equal to the executing v155 code nodes): the `TIMEFRAME_WEIGHTS` literal, the thresholds, the missing→NEUTRAL rule, the substitution ladder, the snapshot selection, the conviction formula; `Build Layer 1 JSON`; `backtester/lib/layer2_pair_logic.js` (`combinedConfidence = min(targetConfidence, usdConfidence)`) | produces the published call |
| **Alternative configuration** | `config/usd_24h_ruleset_v2.json` (`CANDIDATE_SHADOW_ONLY`, `production_enabled: false`, never run in n8n); the closed study's `original_v2_1` and `repaired` arms; the research arms in `implementation_plan.md` §3 | none in production |
| **Rulebook guidance** | `logic/agent_usd_direction.md` v2.1: the weight table, the `_LEAN` conditions (active weight < 50, margin < 15, conflict, missing inputs, tiebreaker, conviction < 65%), the tiebreaker hierarchy (DXY 5d, US 2Y 5d, real yield 5d, VIX 5d), the participation cap, the missing-input and conflict penalties, the agreement boosts, the conviction bands (50–55 Very Weak … 85–100 Very Strong), the sixteen "key rules" | fetched and read by the model on every run; shapes verdicts, not numbers |
| **Research artefacts** | this folder, `docs/research/usd-session/v1/`, the assignment packages A1–A5, the card schema, `data/research/usd-session/*` | no production effect |

Rulebook instructions a researcher will meet and must not treat as implemented: "always use delta, not
level" (F1 and F9 read the VIX level and F7 and F8 read strings, so four of the ten factors are not delta
reads), "missing inputs reduce conviction but do not block a directional call" (true as coded, because the
penalties are hard-coded to zero), and the tiebreaker hierarchy (no code path reads it).

## 5. Which document owns which fact

Four descriptions of the same engine are in circulation and they do not have equal authority. A researcher
who mixes them will produce a card about a system that does not exist.

| Question | The authority | Why |
| --- | --- | --- |
| What number was published, and for which timeframe | `exports/usd_layer1_agent.json`, nodes `Build USD Input Pack` and `Calculate USD Conviction` | this is the code that produced the call; the model's own text is overwritten by it |
| Which factors exist, with which id, label, group, role and status | `data/research-library/catalog.json` (`assets` → `USD` → the ten `live.` rows) | it is the committed, reviewed catalogue; the register in this bundle is checked against it and is refused if it contradicts it |
| What the model was told to look for | `logic/agent_usd_direction.md` v2.1, fetched from GitHub on every run | it shapes the verdict strings and the reasons, never the arithmetic |
| What was actually collected, and how stale it is | `exports/usd_collector.json` plus the stored snapshot row | the row is the only record of what the cutoff could see |

Named disagreements between the rulebook the model reads and the code that scores, all live at once:

| Factor | Rulebook | Code |
| --- | --- | --- |
| F3 | listed as `US/Germany 2-Year Rate Differential Delta` with 1-day, 5-day and 20-day arms | one fixed 5-day change at every timeframe, titled `US-DE 2Y spread delta` in the catalogue |
| F5 | `DXY 5-Day Delta` | `dxy_d1` on 24h, `dxy_d5` otherwise, `dxy_d20` only on the two long timeframes |
| F6 | `Gold 5-Day Delta`, no numeric band, plus a safe-haven conflict flag | 5-day or 20-day change against a hard-coded ±0.1 per cent band, no conflict flag |
| F7 | weight 3, a 72-hour window and an `age_hours` field | weight 24, whatever string and whatever age the stored row holds |
| F8 | weight 18, the *change* in Fed bias, "the market trades the change" | weight 12, a substring test on the current string |
| F9 | three arms including US growth outperforming global growth | high VIX, or calm VIX with a bias string that is not hawkish |
| F10 | a neutral regime row and an `equities_regime` input | sign test on the quote inside the two VIX bands, `equities_regime` unread |

The rulebook is fetched by URL on every run and no code compares its version, contents or weight table with
anything. A rulebook edit therefore changes the model's wording, and possibly its verdict strings, on the
next run with no deployment at all, while every published number stays exactly where the code puts it.
This document describes the code and the stored data; where it and the rulebook disagree, the code is what
happened.


## 6. Defects and limits a reader must know

### 6.1 Provenance: what cannot be reproduced from this repository

- **F7's signal is produced outside the workflow.** `latest_us_event.usd_signal` arrives on the stored event
  row. Every node in the collector export that could compute a surprise from a calendar
  (`HTTP Request | Eco Calendar Recent - Finnhub`, `HTTP Request | Eco Calendar Upcoming - Finnhub`,
  `Code | Process Eco Data`, `Code | Derive Fed Bias`) is an entry point with no consumer, so 24 of the 100
  coded points cannot be traced to any computation the repository contains.
- **Two implementations of the Fed-bias score exist and one is orphaned.** `Code | Derive Fed Bias` scores
  the same events at ±1 with no consumer; the live string is built by `Code | Derive USD Eco Inputs` at ±1
  and ±2 by impact rank. The collector's own `data_quality` note names the orphaned node as the source.
- **The collector's notes contradict its own code.** The same note says `latest_us_event` "is selected from
  Finnhub economic calendar" and that `fed_bias` is derived "via Code | Derive Fed Bias"; the live row reads
  the stored Supabase event row and the live bias from `Code | Derive USD Eco Inputs`.
- **Two helpers that would have checked the event signal are dead code.** `latestUsEventFromEcoData` would
  recompute the signal from actual against forecast — inverting the sign for Unemployment Rate and Initial
  Jobless Claims — and `upcomingEventsFromEcoData` would summarise the forward calendar. Neither is called.
- **Two weight vectors are live.** The coded `TIMEFRAME_WEIGHTS` literal and the fetched rulebook differ in
  eight of ten factors on the 24h vector (F3, F4, F5, F6, F7, F8, F9, F10; only F1 and F2 agree) and nothing
  reconciles them.

### 6.2 Rulebook machinery that does not execute

- The VIX 1-day and 5-day modifiers, and the "stronger message wins" conflict rule.
- F8 as a delta: no prior reading is stored, so the rule the rulebook calls the highest-weight factor cannot
  be implemented from the collected data.
- F7's 72-hour window and its `age_hours` field: the stored row carries a date and a time and nothing reads
  either for age.
- F9's growth arms and F10's neutral-regime row: the inputs they need (`global_growth_regime`,
  `ez_stress_flag`, `spx_d1_pct`) are declared in the row and written as null on every run.
- The four §8 modifiers: participation, participation_cap, conflict_penalty, missing_input_penalty and
  agreement_boost are returned as `active`, `active`, 0, 0 and 0.
- The rulebook's instruction to always read deltas rather than levels: F1 and F9 read the VIX level, F7 and
  F8 read strings, so four of ten factors are not delta reads.


### 6.3 Arithmetic a reader will misread

- **Conviction cannot be lowered by missing data.** Its denominator is active weight only, so a factor that
  never arrived is simply absent; conviction can read 100 per cent with half the coded weight missing.
- **`neutral_pct` is not a percentage.** It is `round(neutral)`, a sum of weight points, and the reason string
  prints it with a per-cent sign.
- **`NO_CLEAR_BIAS` is arithmetic, not a gate.** It needs an exact tie of the two weight sums, which the 24h
  vector can produce, and no minimum-participation or data-quality condition is checked before a call.
- **Two strength labels can disagree on one row.** The pipeline's bands (40 / 25 / 15 on the net edge) and the
  dashboard's separately derived bucket are computed from different quantities and published side by side.
- **`weighted_edge` is `|netEdge| / 100`**, a share of active evidence, not an expected return.

### 6.4 Data, timing and staleness

- **Snapshot selection has no as-of bound.** It takes the newest row holding all 14 required fields, else the
  newest row whatever it contains, and records which. There is no per-field age, no revision exclusion and no
  stale state, so a row from days earlier is indistinguishable from a fresh one (C12).
- **The label instrument is 2 to 6 business days old at the cutoff.** `dxy_level` is FRED `DTWEXBGS`, the
  broad H.10 index published on Mondays at 16:15 ET for the previous business week. It is a feature, and it
  cannot be the session label; no intraday dollar-index print exists in the repository or the collector.
- **Gold, BTC and NQ windows count stored rows, not sessions.** `gold_d5_pct` is
  `historyPct(gold_price, "gold_price", 4)` and the 20-day arms use 19 — so the window's length depends on the
  pipeline's run history, and a missed run silently changes it.
- **Oil, the FX crosses and the two long spreads are only inside `raw_payload`.** WTI, Brent, EUR/USD,
  USD/JPY, GBP/USD, USD/CAD, AUD/USD and the US-DE 10Y and US-JP 10Y spreads are fetched and transformed and
  never become snapshot fields, so no factor reads them and no review can audit them.
- **Stored but unread.** `btc_price` and its windows, `equities_regime`, `vix_d1`, `vix_d5`,
  `us_10y_yield`, the `d20` arms at the 24h horizon, the US-DE 2Y spread level and its 1-day and 20-day legs,
  and `upcoming_events` are all collected and read by no factor.
- **Nothing has a vintage.** The H.15 families are 1 to 2 business days old and unpublished-time-verified
  only for the H.10 family; no series is stored with its revision history, and the paid calendar keeps no
  consensus snapshot, so no first print can be recovered.
- **The declared-null fields are the rulebook's missing input.** `spx_d1_pct`, `btc_dominance`,
  `latest_ez_event`, `ecb_bias`, `global_growth_regime`, `ez_stress_flag` and `geopolitical_risk_flag` are in
  every row as null, which is where whole rulebook factors stop.


## 7. Sources and identifiers

| Artefact | Identifier | What it is |
| --- | --- | --- |
| Branch | `research/usd-session-20261013` | the research branch this bundle was extracted on |
| Commit | `d07af11166ea1d39e5f4184e85a993e03bcb7137` | the commit the extraction was taken from |
| Live workflow | `USD Layer 1 Agent`, id `OCt1tB9yVMUgFTha`, executing version v155 from 2026-10-12T19:52:13.451Z (the applied null-versus-unavailable guard) | produces the published call |
| Live code nodes | `Build USD Input Pack`, `Calculate USD Conviction`, `Build Layer 1 JSON` | input pack, scoring, payload assembly |
| Scoped export | `exports/usd_layer1_agent.json`, measured against v154 on 2026-10-11 (export 2026-10-11T18:59:54.307Z) | the copy the code facts were read from; byte-identical to the live nodes at that time, and `Calculate USD Conviction` is the same bytes v155 executes |
| Collector | `Data Collector - USD`, `exports/usd_collector.json` | repository snapshot; the live collector id was not in the scoped identity file |
| Collector nodes | `Normalise Market Snapshot`, `Code | Derive USD Eco Inputs`, `Code | Derive Fed Bias` (orphaned) | where each stored field is built |
| Runtime | n8n Cloud, `https://silver17.app.n8n.cloud`, project `ISQG9XU7TGTT6Fcu` | where both workflows execute |
| Rulebook | `logic/agent_usd_direction.md` v2.1 | fetched from GitHub on every run; shapes verdicts, not numbers |
| Catalogue | `data/research-library/catalog.json` | authority for the ten live factors' identity and status, and for the fifteen session factors the briefs beside this document cover |
| Context version | `usd-session-context-20261014.1` | the version of this document |
| Pack version | `2.0.0` | the version of the packs generated alongside it: ten baseline audits and fifteen session briefs |
| Card schema | `usd-session-research-card-v3` | this bundle's output schema; extends the candidate schema `usd-session-research-card-v2` |
| Evidence frames | closed study cache from 2023-04-03; 22-series macro frame from 2024-01-02 | what a historical claim can be built on, with times unchanged |
| Weight discrepancy record | `docs/research/usd-session/v1/weight_vector_discrepancy.md` | both vectors, factor by factor |
| Inventory | `docs/research/usd-session/v1/inventory.md` | the earlier extraction this document supersedes only in presentation |

Every fact in this document is traceable to one of these rows. Nothing here was inferred from a screenshot,
a memory of a run, or a model's own account of what it did.


## 8. Why the closed 24-hour study is not comparable

The closed study measured a different question and its numbers may not be borrowed.

- **Its endpoint was the next session close, 30.5 hours at the median** — not a 24-elapsed-hour window and
  not 05:00 London. Its rule setups, thresholds and weights were selected against that endpoint.
- **Its best configuration is not in force.** `config/usd_24h_ruleset_v2.json` is `CANDIDATE_SHADOW_ONLY`
  with `production_enabled: false` and has never run in n8n.
- **Its exposed periods are spent.** What has already been read is recorded in
  `docs/research/usd-session/v1/exposed_periods.md`; no period listed there can be called unseen again.
- **Its flat band, its own tie policy and its missing-quote handling may not be inherited** for the
  London-to-London session: none of the three was frozen there, and the briefs now carry one proposed
  missing-quote policy (a missing print is a data exclusion, above, §1) which is still to be frozen with the
  dataset.
- **Its 93-configuration registry is an in-sample search.** A winning configuration from it is a starting
  hypothesis, not evidence, and the new study's evaluation design has not been approved yet.

Consequence for a pack: the only history a card may claim as unseen is history the exposed-periods record
does not list, and any historical statement must name the series, its cache start and its timing rule.


## 9. How the register, the packs and this file fit together

- **One context version, one pack version.** All twenty-five packs carry this document's version and the pack
  version in their header, so a returned card can always be read against the exact context it was written for;
  the ten deployed factors' packs audit code that runs and the fifteen session briefs are assignments with no
  rule in force. A change to any fact here, in the register, in an authored brief or in the catalogue forces a
  version bump and a regeneration, not a silent edit.
- **Precedence when two artefacts disagree.** The code in `exports/usd_layer1_agent.json` and
  `exports/usd_collector.json` wins on what happens. `data/research-library/catalog.json` wins on a factor's
  identity and status; the register is refused at build time if it contradicts the catalogue. This document
  wins on the description of the path, the defects and the source list. The rulebook wins on nothing except
  what the model was told.
- **What each artefact is for.** This file answers "what is the system". The register and
  `USD_FACTOR_REGISTER.json` answer "what does each factor do today, with what inputs and what open
  questions". A pack answers "what must one researcher decide about one factor, and in what form". The
  template and schema answer "what does a returned card look like". `tracker_tasks.json` answers "what is
  still open", and `HANDOFF_MANIFEST.json` answers "what was generated and has it changed".
- **How to cite it.** Cite this document by its version and the file path, and cite a fact to the source row
  in §7 where that is possible. A pack's own text may be quoted; a rulebook sentence may not be presented as
  something the code does.
- **What it is not.** This document is not evidence of an edge, not a performance record, and not an
  authorisation. It records a system, its defects and its gaps; every number that would say whether the
  system works is still unmeasured.




