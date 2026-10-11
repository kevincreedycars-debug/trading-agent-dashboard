# Discovery report — USD Layer 1 and the eight-engine contract (WP0 / WP1)

Date: 2026-10-11. Prepared by the project coordinator (Cline in VS Code) for the external reviewer of
`USD_24h_Master_Ruleset_v1.md` / `Central_Coordinator_USD_and_8_Engine_Brief.md`.

## 0. Scope and method

Read-only discovery. No production logic, workflow, dashboard or data file was changed. Evidence was taken from
the live branch `origin/main` and from this checkout; the two USD engine files this report analyses are
byte-identical on both. Live n8n was **not** queried: the exports in `exports/` are repository snapshots, and
deployment identity against the running n8n Cloud workspace remains **UNKNOWN** until a scoped live export is taken
(§7). Where a supplied dossier finding could not be reproduced, that is stated.

## 1. Source identity (WP0)

| Item | Value |
| --- | --- |
| Repository | `https://github.com/kevincreedycars-debug/trading-agent-dashboard.git` |
| Live branch | `origin/main`, tip `31fd44edc1ef95a5eb27b20e4d25dd84b3e3b349` (2026-10-11 18:35 +0100) |
| Coordinator checkout | branch `orchestration/control-plane-20260920`, tip `7e700bbdee2d873eb2e786b46abc438e77efcb59` when discovery was run (this review package is committed on top of it as `2979b14`) |
| Branch relationship | 277 commits on the coordinator branch not in main; 758 commits on main not in the coordinator branch |
| Uncommitted in the checkout | `tools/strategy-node/Strategy.code-workspace` (window colour, unrelated); untracked `backtester/*gold_session_policy*` and `docs/review/` (this package) |
| Live latest commit | `31fd44e` "live-trading: publish the M5/H1/H4 snapshot for 2026-10-11T17:35:20Z, data file only" |

The USD artefacts under review are identical on both branches, so this analysis holds for live:

| Path | Blob (HEAD and `origin/main` agree) |
| --- | --- |
| `exports/usd_layer1_agent.json` | `ccc58a6b` |
| `logic/agent_usd_direction.md` | `fafa21c9` |
| `backtester/replay/usd/usd_replay_core.js` | `f9da0d73` |
| `backtester/fixtures/usd_live_replay_24h_parity_fixture.json` | `c59ad1ba` |
| `backtester/lib/headline_confidence.js` | `af723444` |

Only GBP and SILVER differ between the branches. `origin/main` adds `exports/silver_layer1_agent.json`,
`logic/agent_silver_direction.md`, `logic/agent_wti_direction.md` and a revised `logic/agent_gbp_direction.md`,
and removes `exports/gbp_collector.json` and `exports/gbp_layer1_agent.json`, which the coordinator branch still
holds as drafts. A review that reads only one branch would miss live engines either way.

## 2. Runtime identity

n8n Cloud is still the executor, and the pipeline is running today, not historical:

- `docs/N8N_INTEGRATION.md` records the workspace `https://silver17.app.n8n.cloud` (project `ISQG9XU7TGTT6Fcu`).
- `origin/main:data/layer1.json` was refreshed at `2026-10-11T08:55:44Z`; every agent row carries today's
  `last_run_et` (`08:51`–`08:55`).
- The `live-trading` lane committed M5/H1/H4 snapshots every 15 minutes through today (`536236e` 18:05,
  `22aa37e` 18:20, `31fd44e` 18:35).
- The USD agent fetches its rulebook from GitHub at run time (`Get USD Logic Document` →
  `kevincreedycars-debug/trading-agent-dashboard`, `logic/agent_usd_direction.md`, oAuth2), so the committed
  rulebook is live input, not documentation.
- Model node `Message a model` = `gpt-4.1-mini`.

Consequence for the brief: the WP0 "live export hash" item cannot be satisfied from the repository. The repo
export and the running workflow have never been proven equal.

## 3. Eight-engine inventory (WP1)

The eight-engine premise in the brief is **correct for the live system** and **wrong for this checkout**: today's
published `data/layer1.json` has eight agents, while the repository carries six Layer 1 agent exports plus one
draft; WTI has no export at all.

Live rows, 2026-10-11T08:51–08:55Z, from `origin/main:data/layer1.json`:

| Engine | Logic document / version | 24h weights (live factor_breakdown) | Calendar | Live bull/bear → conviction | Repo export |
| --- | --- | --- | --- | --- | --- |
| USD | `agent_usd_direction.md` / `2.1_weighted_engine` | 10,14,10,10,14,4,24,12,1,1 | WEEKDAY_ACTIVE_TIME_V1 | 10/90 → 90 | yes (both branches) |
| EUR | `agent_eur_direction.md` / `2.0_weighted_engine` | 20,18,20,14,4,12,4,4,2,2 | WEEKDAY_ACTIVE_TIME_V1 | 93/7 → 93 | yes |
| GOLD | `agent_gold_direction.md` / `2.0_weighted_engine` | 26,22,12,10,10,8,8,2,1,1 | WEEKDAY_ACTIVE_TIME_V1 | 54/46 → 22 | yes |
| SILVER | `agent_silver_direction.md` / `1.0_weighted_engine` | 24,18,10,12,12,8,6,5,4,1 | WEEKDAY_ACTIVE_TIME_V1 | 100/0 → 35 | `origin/main` only |
| NQ | `agent_nq_direction.md` / `2.0_weighted_engine` | 20,14,12,6,14,12,8,10,2,2 | WEEKDAY_ACTIVE_TIME_V1 | 100/0 → 100 | yes |
| BTC | `agent_btc_direction.md` / `2.0_weighted_engine` | descriptive ids, not F1–F10 | CRYPTO_24_7 | 100/0 → 100 | yes |
| WTI | `agent_wti_direction.md` / `0.2_research_conviction_engine` | 20,14,14,10,10,8,8,6,5,5 | WEEKDAY_ACTIVE_TIME_V1 | 74/26 → 59 | rulebook on main only; no agent or collector export |
| GBP | `agent_gbp_direction.md` / `0.1_research_baseline` | 20,16,20,12,8,10,6,4,2,2 | WEEKDAY_ACTIVE_TIME_V1 | 78/22 → 28 | draft on the coordinator branch; deleted on main |

Findings that change the shape of the brief:

1. There is no single conviction meaning across the eight engines. Taken from the published numbers, four live rows
   publish the winning share of active weight (USD 10/90 → 90, EUR 93/7 → 93, NQ 100/0 → 100, BTC 100/0 → 100),
   while the other four do not equal that share and match the blended headline formula instead (GOLD 54/46 → 22,
   SILVER 100/0 → 35, WTI 74/26 → 59, GBP 78/22 → 28). Both quantities are published as `conviction` /
   `display_metrics.conviction`. This is a reading of the two published values, not a re-execution of the four
   engines; the per-engine code path for each convention is part of the WP1 follow-up.
2. No engine shares a 24h weight vector with another; three engine versions (2.1, 2.0, 1.0) plus two research
   stage strings (0.2, 0.1) coexist. BTC's factor namespace is descriptive, so "F7" is not a shared identifier
   across engines.
3. Calendars differ: BTC is CRYPTO_24_7, the other seven are WEEKDAY_ACTIVE_TIME_V1, and published
   `dashboard_meta` states exchange holidays and intraday maintenance breaks are not modelled.
4. Parity fixtures cover five assets (`usd`, `eur`, `gold`, `nq`, `btc`) and none exist for GBP, SILVER or WTI,
   although all three run live.
5. Repo/live drift is structural: two live engines have no agent export on one of the two branches, and WTI has no
   version-controlled collector export on either.

## 4. USD claim-by-claim reproduction

References are to the export `exports/usd_layer1_agent.json` (blob `ccc58a6b`) unless stated. Verdicts use the
brief's vocabulary: CONFIRMED, NOT_REPRODUCED, UNKNOWN.

| # | Dossier claim | Verdict | Evidence |
| --- | --- | --- | --- |
| C1 | gpt-4.1-mini classifications are overwritten by a deterministic node | CONFIRMED | `Parse USD Agent Output` writes `direction_24h`/`conviction_24h` from the model JSON; `Calculate USD Conviction` then returns `direction_24h: output.direction_24h` and `conviction_24h: output.conviction_24h` computed from raw inputs, after spreading `...(item.full_output || {})`. The model verdict survives only inside `full_output` / `raw_agent_output`. Non-JSON model output throws, so the model can abort a run but cannot author one. |
| C2 | rulebook and export use different weights/formulas | CONFIRMED | `logic/agent_usd_direction.md` §4: F1 10, F2 14, F3 16, F4 14, F5 6, F6 5, F7 3, F8 18, F9 12, F10 2. Export `TIMEFRAME_WEIGHTS["24h"]`: 10,14,10,10,14,4,24,12,1,1. The rulebook also lists missing-input penalty, conflict penalty and agreement boost as part of the call; the export sets `conflict_penalty`, `missing_input_penalty` and `agreement_boost` to constant `0`. |
| C3 | F7 uses `latest_us_event.usd_signal` without the written age / actual-versus-consensus enforcement | CONFIRMED | Export F7 is `if (ev.usd_signal === "BULLISH") …` with no timestamp, no age bound, no actual/consensus comparison and no revision handling. Absent event and absent data both return the same NEUTRAL. |
| C4 | F8 scores absolute hawkish/dovish state rather than change | CONFIRMED | Export F8: `fed.includes("hawkish")` → BULLISH, `fed.includes("dovish")` → BEARISH, from the static `fed_bias` string. The rulebook names the factor "Fed Bias Delta" (weight 18); the code scores level. |
| C5 | missing inputs shrink the score denominator and inflate the winning share | CONFIRMED | `conviction = Math.round((bullish / active) * 100)`, `active = bullish + bearish`. Live USD row today: `bullish_argument_pct 10`, `bearish_argument_pct 90`, `neutral_pct 60`, `final_conviction 90`, `verdict_strength VERY_STRONG` — 90% conviction from 40 points of a 100-point budget. `participation` is the raw active weight (40), not a percentage. |
| C6 | F1/F9 repeat VIX evidence | CONFIRMED | F1: `vix > 25` → BULLISH, `vix < 16` → BEARISH. F9 repeats both branches with the same sign as "Dollar Smile"; F10 also keys on `vix < 16` / `vix > 25`. VIX thus drives three factors (weights 10 + 1 + 1 today) with no dependency handling. |
| C7 | exported, replayed and displayed confidence use different meanings | CONFIRMED | Export `verdict_strength` buckets at net edge 40/25/15; `backtester/lib/headline_confidence.js` `deriveConfidenceStrength` buckets at 80/65/50 and computes a separate value `0.45*max(bull,bear) + 0.35*participation + 0.20*abs(net edge)`, with penalties applied by matching warning text (`event risk`, `weekly consolidation`, `audit flag`, `adr warning`, `o layer`). Live rows publish both meanings (§3). |
| C8 | the replay parity check does not execute the exported workflow | CONFIRMED | `backtester/scripts/check_usd_live_replay_24h_parity.js` requires `../replay/usd/usd_replay_core` and compares it with the frozen `fixture.expected_live_24h`. The fixture's `meta.live_source_of_truth` is the string `exports/usd_layer1_agent.json`; no workflow JSON is parsed or run and no n8n call is made. Parity proves replay-against-a-frozen-expectation, not engine-against-replay. |
| C9 | five asset fixtures use incompatible confidence conventions | CONFIRMED | Expected-block key sets: `usd` and `eur` = direction/conviction/strength/bull/bear/net edge/participation/counts/weights/factor breakdown/conviction model/missing inputs/warnings; `gold` = the same minus `missing_inputs` plus `headline_confidence_pct`; `nq` and `btc` = `raw_strength_bucket` + `displayed_headline_confidence_pct` + `headline_strength_bucket`. All five also carry `conviction_24h`, so one field name carries at least three meanings. No GBP/SILVER/WTI fixture exists. |
| C10 | raw inputs and selection details are stripped before the output write | CONFIRMED | `Calculate USD Conviction` destructures `market_inputs`, `input_validation_warnings`, `model_reported_warnings` and `snapshot_selection` out of the returned row; only derived fields survive. `Create a row` writes to `agent_outputs` with `dataToSend: autoMapInputData`. |
| C11 | silent 1d→5d (and 5d→20d) substitution | CONFIRMED | `Build USD Input Pack`: `gold_d5_pct` falls back to `gold_d1_pct`, recorded only as the display string "using gold_d1_pct fallback". F2/F4 switch to the 20d series whenever the 20d field is present; F5 selects `dxy_d20` / `dxy_d1` / `dxy_d5` by timeframe; NQ falls back one step likewise. The substitution is invisible in the numeric payload. |
| C12 | no as-of / freshness discipline on the snapshot | CONFIRMED | `Supabase Get Many` is `operation: getAll`, table `market_snapshots`, `returnAll: true`, `filterType: none` — the full table is fetched. `Build USD Input Pack` then takes `sortedRows.find(isUsableUsdSnapshot) || sortedRows[0]`: the newest row containing all 14 required fields, else simply the newest row. There is no cutoff-at-t bound, no per-field age, no FUTURE/STALE state and no exclusion of revised data. |

No supplied USD dossier claim tested here came back NOT_REPRODUCED. Two items stay UNKNOWN:

- **Deployment identity** — whether the running n8n USD workflow equals `exports/usd_layer1_agent.json`
  (needs a live export; §7).
- **Outcome contract** — which series and endpoint define the USD 24h label used by
  `data/backtester-checker-usd-24h-2024-01.json`; not verified in this pass.

## 5. How the supplied proposal lines up with the live system

Points where the ruleset is already consistent with this project, and points where it is not yet wired to reality:

1. The proposed factor budget (10,14,10,10,14,4,24,12,1,1; sum 100) equals the **export's** 24h vector exactly, not
   the rulebook's. So the proposal's "inherited 24h comparison parameters" are the code's settings. Anyone
   adopting the proposal must also decide which authority the committed rulebook represents (`2.1_weighted_engine`
   is fetched live from GitHub on every run).
2. F7's proposed 72h TTL has no counterpart in code: the export has no age logic at all, and the input contract
   only offers `latest_us_event` with a pre-computed `usd_signal`. Enforcing the TTL requires either a richer
   event payload (released_at, actual, consensus, revision) or a separate validated event source.
3. F8's proposed change-based rule requires an input the collectors do not currently produce: the USD input pack
   carries `fed_bias` (a categorical string), not a policy-path or OIS series. As specified, `candidate_v1` F8 is
   data-blocked, not merely unimplemented.
4. The proposed catalyst calendar and typed risk flags have no source in the observed input contract, and
   `dashboard_meta` states that exchange holidays and maintenance breaks are not modelled. Market-closure states
   (`SKIPPED_MARKET_CLOSED`) cannot be produced from what the engine sees today.
5. The proposal's `min(target, USD)` warning matches reality: `backtester/lib/layer2_pair_logic.js` line 69 sets
   `combinedConfidence = Math.min(targetConfidence, usdConfidence)` and reports it as pair confidence.
6. The proposal's direction vocabulary (BULLISH/BEARISH/LEAN/NO_CLEAR_BIAS) already matches the exported strings,
   so an adapter layer is feasible without changing dashboard consumers first.
7. The proposal's target (DXY) is already an input (`dxy_level`, `dxy_d1`, `dxy_d5`), but the evaluation series
   behind the archived checker was not verified here, so the label contract stays open.

## 6. WP0 remainder and what it needs

Completed in this pass: source identity, engine inventory, static reproduction of every USD defect (C1–C12),
runtime liveness, and the divergence map between branches.

Not completed, with the reason:

- **Live workflow export and hash** — requires a scoped read of the n8n Cloud API. Not run; credentials live in the
  local CLIXML store described by `docs/CREDENTIAL_CONTINUITY.md` and live reads are outside incidental
  validation. This is the one item that blocks a true engine-vs-replay difference report.
- **Executing the export's deterministic gate against a replayed snapshot** — feasible locally and the natural
  next step: lift the two code nodes (`Build USD Input Pack`, `Calculate USD Conviction`) into a local harness and
  compare their output with `backtester/replay/usd/usd_replay_core.js` on one identical snapshot. This is the
  first numeric WP0 artefact and needs no live access.
- **Snapshot fixtures for the four diagnostic cases** (complete, missing-field, stale-event, conflicting) — no
  such fixtures exist in the repository for USD; `backtester/fixtures/usd_live_replay_24h_parity_fixture.json`
  holds one frozen happy-path snapshot only.

## 7. Blockers

1. Deployment identity unproven: repository exports versus running n8n workflows.
2. Two of the eight live engines (SILVER, WTI) have no complete version-controlled chain; WTI has no collector
   export on either branch. A shared-contract migration cannot be validated against those engines from the repo.
3. Engine family is not uniform (versions 2.1/2.0/1.0/0.2/0.1, two calendars, two confidence conventions, BTC's
   descriptive factor ids), so the brief's "common infrastructure can share schema" item is a larger change than
   an USD-only repair.
4. F8, the catalyst calendar and typed market-closure states need collector/schema work before any candidate rule
   can be evaluated.

## 8. Open decisions for the user

1. Authorise a scoped, read-only n8n export of the eight live Layer 1 workflows (and the collectors) so deployment
   identity can be proven and the missing SILVER/WTI chain can be version-controlled.
2. Confirm priority: local WP0 export-vs-replay difference harness first, or the two unreviewed strategy filings
   (`-065` layer 2 provenance, `-066` gold pack) that are still waiting on a reviewer.
3. Confirm whether the coordinator branch should keep the superseded GBP draft exports, or adopt `origin/main`'s
   engine set (GBP rulebook revised, GBP exports dropped, SILVER added).

This report is discovery only. It makes no claim about live deployment identity, causal feature timing or trading
edge, and no production logic was modified.

