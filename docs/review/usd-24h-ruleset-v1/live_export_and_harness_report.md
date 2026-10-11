# Live export and live-versus-replay comparison (WP0b)

Authorised by the user on 2026-10-11: scoped, read-only n8n exports first, then the export-versus-replay
harness. No production change, no workflow activation, no live execution. The dispatcher was left exactly
as found (`enabled false`, `paused`, `activeRun false`).

Compared with the earlier discovery pass, three things are new: deployment identity is now measured
instead of unknown, the live collectors are shown to still carry credential literals in their URLs, and
the USD deterministic code is executable locally so the live node can be diffed against the replay and
dashboard calculations on identical frozen inputs.

## 1. What was exported

| item | value |
| --- | --- |
| instance | `https://silver17.app.n8n.cloud` (n8n public API v1, GET only) |
| export timestamp | `2026-10-11T18:59:54.307Z` |
| workflows | 45 (33 active, 18 named `TEST - ...`) |
| tooling | `scripts/export_live_workflows.js` (export), `scripts/scrub_live_workflow_exports.js` (sanitize), `scripts/report_live_workflow_identity.js` (identity report) |
| raw copy (not committed) | `tmp/live/exports-2026-10-11T18-59-53-817Z/` (ignored local folder) |
| sanitized copy (committed) | `docs/review/usd-24h-ruleset-v1/live-exports/` |
| evidence | `docs/review/usd-24h-ruleset-v1/live_export_identity.json`, `live-exports/manifest.json`, `live-exports/scrub_report.json` |

Every workflow record in `live_export_identity.json` carries workflow id, name, active flag, `versionId`,
`versionCounter`, `createdAt`, `updatedAt`, node count, code-node sha256 per node, credential binding
names, routing references and the sha256 of the sanitized file.

### Credential material

The sanitizer made 430 replacements across 24 files; a second pass over the sanitized text plus a walk of
every named credential parameter found 0 residual secret-shaped values. Rules and every redaction path are in
`live-exports/scrub_report.json`. The committed set is a fixed point of the tool that produced it: re-running
`scripts/scrub_live_workflow_exports.js` over `live-exports/` reports 0 redactions and 0 residual findings, and
every code node in the sanitized copies is byte-identical to the raw export (45 workflows checked node by node).

- 355 literal API-key query values are embedded in the **live** workflow URLs of 17 workflows, including
  all six active engine collectors (`Data Collector - USD/EUR/GOLD/NQ/BTC/SILVER`), `GBP Layer 1 Agent`
  and `WTI Layer 1 Agent`. Hosts involved: `api.stlouisfed.org`, `finnhub.io`, `www.alphavantage.co`,
  `api.coinbase.com`, `api.statistics.bundesbank.de`, `api.alternative.me`, `api.coingecko.com`,
  `farside.co.uk`, `economic-calendar-api.p.rapidapi.com`.
- The repository's `exports/*_collector.json` use `{{ $env.FRED_API_KEY }}` / `{{ $env.FINNHUB_API_KEY }}`
  in the same positions. The repo-side sanitization recorded in `docs/LOCAL_WORKFLOW_EXPORTS.md` therefore
  does not describe the live workflows: the live URLs still hold literals.
- 66 named credential parameters held literals in seven files and now read `<redacted>`: `Backtest Processor`
  (31), `Backtest Resolver` (13), `USD Agent` (10), `USD Agent HIT/MISS Resolution` (4), `Price fetch (old)`
  (4), `Backtest Queue Initialiser` (2) and `Gold Agent` (2). The parameter names are `api_key` (22),
  `apikey` (21), `Authorization` (17, inside `{ name, value }` header parameters rather than URL strings) and
  `x-api-key` (6). Several values are provider-shaped (`sk-ant-*`) or 32-character FRED keys, so a URL rule
  alone never saw them; the URLs themselves are separate strings and were already covered.
- 4 FRED keys sat inside the `jsonQuery` JSON body of the four `Gold Agent` FRED request nodes
  (`{"series_id": ..., "api_key": "<literal>"}`). A body string is not a URL parameter or a named parameter
  object, so only the JSON-body rule reaches that position.
- `staticData` payloads were emptied in five files (`USD Agent`, `USD Agent HIT/MISS Resolution`,
  `GBP Layer 1 Agent`, `Layer 2 Trade Selection Agent`, `TEST - Master Orchestrator - ISOLATED - 20260723`).
  Every export's `pinData` key was already empty in the raw copy, so no pinned payload had to be removed and
  the report records no `pinned_data_removed` entry; the rule stays because a pinned payload can embed a
  provider response, and it fires only when `pinData` is non-empty.
- Credential bindings (id + name) were kept verbatim, matching the existing `exports/` snapshots.

No value was copied into any committed file; only counts, hosts and parameter names are recorded.

### Outgoing-range verification

The session scanner (`tmp/live/scan_outgoing_history.js`, gitignored tooling) replays the added lines of every
commit in `origin/main..HEAD` — 279 commits — so historical versions of the exports are scanned, not only the
current tip. Its first run found 32 credential-shaped literals in seven `live-exports/*.json` copies plus two
candidates outside the review folder. The seven export copies are exactly the files the final sanitizer
rewrote, and their older blobs existed only in the tip commit, so the corrected set was folded into that commit
(amend) rather than added as a follow-up commit. The review branch is local-only — 279 commits ahead of
`origin/main` with no matching remote ref — so no published history was rewritten and no force-push is needed.

Two candidates remain in the range and both were reviewed as non-secret:

- `exports/gbp_collector.json` — a 47-character all-uppercase placeholder inside a FRED URL of the GBP draft
  collector, unrelated to any value in the raw export.
- `tests/collector_single_run_repair.test.js` — a 9-character lowercase fixture value.

Neither value occurs anywhere in the raw export, and raw exports stay in the ignored `tmp/live/` tree: no `tmp/`
path is tracked or staged. Rotation is still outstanding. Redacting the copies does not invalidate the keys
that were exported from the live instance; the three observed shapes (URL literals, named parameters, JSON-body
keys) all have to be replaced with credential references and rotated in n8n.

## 2. Deployment identity (repository snapshot versus running workflow)

Code-node comparison is by node name and jsCode sha256 between the running workflow and the repository
snapshot. Full detail: `live_export_identity.json` → `engine_coverage`.

- Identical code nodes: `usd:agent` (`USD Layer 1 Agent` `OCt1tB9yVMUgFTha` v154, active),
  `usd:collector` (`P1E4ZWtbDetYz1P5` v139), `eur:agent`/`eur:collector`, `gold:agent`/`gold:collector`,
  `nq:agent`/`nq:collector`, `btc:agent`/`btc:collector`, `SHARED:events` (`UaSliyR8qlSVIfmk` v153).
  This closes the earlier open question for USD: `exports/usd_layer1_agent.json` carries exactly the
  deterministic code that the active USD workflow runs.
- Live only, no repository export: `SILVER Layer 1 Agent` (`6IGOoTZxxTPyBpEp` v9),
  `Data Collector - SILVER` (`xezFmvm7cmgNNypb` v10), `WTI Layer 1 Agent` (`8oUBopUWLiGcYU0d` v5).
- Same key, different code: `GBP Layer 1 Agent` (`bMv96EPR0xCXi3bi` v18, active) differs from
  `exports/gbp_layer1_agent.json` in `Code | Build GBP Input Pack`, `Code | Parse GBP Agent Output` and
  `Code | Deterministic GBP 24H Verdict Gate`, and the live workflow replaced
  `Combine GBP logic & market snapshot` with `Combine GBP Logic and Inputs`.
- `Master Orchestrator` (`X75RKU34ikiM5RMU` v62, active) differs in `Build Workflow Status JSON` and adds
  two code nodes the repository snapshot does not have: `Guard Economic Event Collector` and
  `Build Input Health on Economic Event Failure`.
- `Dashboard Writer - Layer 1` (`850DrjzCKKX9fDzD` v56, active) differs in `Build Layer 1 JSON`;
  `Layer 2 Trade Selection Agent` (`ZKGSuYcWb6EfgXBE` v24, active) differs in
  `Build Layer 2 Trade Selection JSON`.
- Active duplicates: the live project holds active `TEST - ... - ISOLATED` copies of several engines and
  of the orchestrator, writer and Layer 2. They are listed per key in `live_export_identity.json` and are
  not used by the main orchestrator.

## 3. Routing references needed to trace SILVER and WTI

From the live `Master Orchestrator` (`X75RKU34ikiM5RMU` v62) `executeWorkflow` nodes, target ids are
resolved in `live_export_identity.json` → `live_workflows[].routing`:

- `USD Collector` → `P1E4ZWtbDetYz1P5`, `EUR Collector` → `Z3v9kQNIM22THi2O`,
  `Gold Collector` → `0z71FpOfKdL72hgW`, `NQ Collector` → `nYMDUSVQwEFNaH0U`,
  `BTC Collector` → `AE3Vv7ILPPiZwZHN`, `Silver Collector` → `xezFmvm7cmgNNypb`.
- `USD Layer 1 Agent` → `OCt1tB9yVMUgFTha`, `EUR Layer 1 Agent` → `Px0bsH7chlRWH9ZD`,
  `Gold Layer 1 Agent` → `wwBVT0EQcKu5517I`, `NQ Layer 1 Agent` → `FOpFp3AzTJVYdLXe`,
  `BTC Layer 1 Agent` → `G142Blty3sGHzuOr`, `Silver Layer 1 Agent` → `6IGOoTZxxTPyBpEp`,
  `GBP Layer 1 Agent` → `bMv96EPR0xCXi3bi`, `WTI Layer 1 Agent` → `8oUBopUWLiGcYU0d`.
- `Dashboard Writer` → `850DrjzCKKX9fDzD`, `Layer 2 Trade Selection Agent` → `ZKGSuYcWb6EfgXBE`,
  `Call '1. Economic Events Collector'` → `UaSliyR8qlSVIfmk`, webhook
  `master-orchestrator-dashboard-refresh` (POST).

Coverage gaps recorded in `live_export_identity.json` → `coverage_gaps`:

- Live agents exist for all eight engines; live collectors exist for USD, EUR, GOLD, SILVER, NQ, BTC only.
- `wti` and `gbp` have a live agent but **no live collector**, so the source of their inputs is not
  identifiable from the export alone — status UNKNOWN, not "missing".
- `silver` and `wti` have no repository export at all; `gbp:collector` has a repository draft but no live
  workflow, consistent with the GBP exports being inactive onboarding drafts.

## 4. The comparison harness

`backtester/scripts/compare_usd_live_vs_replay.js` runs eight frozen snapshots through three arms and
compares five dimensions separately. It is read-only: no warehouse read, no n8n call, no production logic
change.

- arm `live_code` — executes the exported `Build USD Input Pack` and `Calculate USD Conviction` code nodes
  in a sandbox (`backtester/lib/usd_live_code_harness.js`). The export is the source of truth; no logic is
  copied into the harness. The model node is not executed, and that claim is tested, not assumed.
- arm `replay_live_path` — `buildReplayOutput` from `backtester/replay/usd/usd_replay_core.js`.
- arm `dashboard` — `computeHeadlineConfidenceFromRow` from `backtester/lib/headline_confidence.js`, run
  twice: on the row the live workflow actually inserts (`autoMapInputData`) and on the same row with
  `conviction_model` lifted out of `full_output`.
- dimensions — direction, factor contributions (signal and weight per F1..F10), coverage (active/neutral
  weight, active/neutral factor counts, factors flagged as missing evidence), participation and each
  confidence quantity on its own (bull case, bear case, net edge, winning-side conviction, headline
  confidence, strength from net edge, strength from headline).
- cases — `frozen_parity_snapshot`, `model_verdict_overridden`, `stale_event`, `unchanged_hawkish_bias`,
  `sparse_inputs`, `conflicting_factors`, `missing_vix_level`, `lookback_substitution`
  (`backtester/fixtures/usd_live_replay_harness_cases.json`).
- frozen baseline — `backtester/fixtures/usd_live_replay_harness_baseline.json` records, per case, the
  live-row sha256, the replay-output sha256 (excluding its own `created_at` stamp), the difference
  fingerprint and all three projections. `npm test` fails if any of them moves. Re-freezing is deliberate:
  `node backtester/scripts/compare_usd_live_vs_replay.js --write-baseline`.
- results — `docs/review/usd-24h-ruleset-v1/usd_live_replay_comparison.json`;
  tests — `backtester/tests/usd_live_replay_harness.test.js` (13 tests, all passing).

## 5. Comparison results

Parity where it matters: on six of the eight cases the live code and the replay 24h path agree on
direction, on every factor signal, on every factor weight, on coverage, on participation and on the
winning-side conviction. The only recorded differences there are quantities the live node never publishes
(headline confidence and strength-from-headline), which the replay computes and the dashboard computes
separately.

Confirmed by execution, not by reading:

- The live code's 24h weight vector is `10, 14, 10, 10, 14, 4, 24, 12, 1, 1`, identical to
  `LIVE_24H_FACTOR_WEIGHTS`, and differs from the rulebook `FACTOR_WEIGHTS` (`10, 14, 16, 14, 6, 5, 3, 18,
  12, 2`) on eight of ten factors. The rulebook vector is declared in the replay module and is not
  reachable for 24h through `buildReplayOutput`.
- A model report claiming `BEARISH 10` changes no verdict field: direction, conviction, factor breakdown
  and all projections are identical to the frozen case; only `full_output` keeps the model payload.
- `stale_event` (200 h old bullish label): both arms keep F7 BULLISH at weight 24. No arm ages the event
  input on the 24h path.
- `unchanged_hawkish_bias`: only F8 is active (12 of 100 points), direction is still BULLISH and the
  winning-side conviction is 100 while the replay headline is 39. No arm requires a change in the bias.
- `missing_vix_level` is the sharpest divergence: the live node's local `n()` maps `null` to `0`
  (`Number(null) === 0`), so a **missing** VIX level becomes `vix = 0`, F1 scores BEARISH at weight 10 and
  F10 also flips to BEARISH, giving an active weight of 99. Replay reports F1 and F10 NEUTRAL with
  `missing_evidence_factor_count = 2` and an active weight of 88. The live row does list `vix_level` in
  `snapshot_selection.missing_required_inputs_for_usd` while still casting the votes, so the gap is silent.
  15 differences across all five dimensions.
- `sparse_inputs`: the same zero-substitution effect on deltas (live F3 keeps the "move below threshold"
  reading, replay flags "missing input"), and the two confidence calculations disagree: replay headline
  60 versus dashboard headline 65.
- `lookback_substitution`: both arms fall back to `dxy_d1` for F5, but the missing-input bookkeeping
  differs (live `["dxy_d5"]`, replay `["dxy_d20", "gold_d20_pct", "nq_d20_pct"]`).
- Published dashboard row (`data/layer1.json`, USD, `2026-09-07T06:13:13.593+00:00`): the row stores final
  conviction 70 with `verdict_strength = VERY_STRONG`, while the same function that produces the dashboard
  headline returns 58 with a derived strength of MODERATE. The stored strength is the node's net-edge
  bucket, not the headline's bucket, and the row field overrides the derived value, so the two numbers
  answer different questions.
- The row the deterministic node inserts carries `conviction_model` only inside `full_output`, so a
  headline confidence computed from the inserted row alone is null/PENDING. Any dashboard number needs a
  mapping step (the writer's `Build Layer 1 JSON`, which differs between live and repository); that
  contract is the next thing to pin down, not something this harness may assume.

Baseline caveat: the previously reported 11/11 parity passes remain a useful regression baseline, but they
exercise the replay implementation against a frozen expectation, not the exported live code, and they say
nothing about predictive accuracy. `npm test` currently reports 461 passing of 466 tests; the five failures
are pre-existing and environmental (three `secret_scanner` output-format assertions reproduce at
`1ab243c` in a clean worktree, two Playwright `refresh_progress` tests time out at 30 s).

## 6. Blocked inputs for the candidate rules

Kept inactive or explicitly unknown, because there is no input source in the current collectors:

- F8 change-based bias — the collectors publish a static `fed_bias` string; nothing in the export records
  a previous bias, so "unchanged hawkish" cannot be detected. Only the static rule exists.
- Catalyst calendar — no collector in the export writes a forward event calendar; `latest_us_event` is a
  single most-recent event record.
- Market-closure / state classification — no collector publishes session or closure state; the dashboard
  row's `market_status` is null and `market_calendar` is a constant string.
- SILVER and WTI inputs — SILVER has a live collector but no repository export to review; WTI has no live
  collector at all.

## 7. Exact source references

- Export and identity: `scripts/export_live_workflows.js`, `scripts/scrub_live_workflow_exports.js`,
  `scripts/report_live_workflow_identity.js`, `live_export_identity.json`, `live-exports/manifest.json`,
  `live-exports/scrub_report.json`.
- Live workflow files: `live-exports/USD_Layer_1_Agent.json` (id `OCt1tB9yVMUgFTha` v154),
  `live-exports/Data_Collector_-_USD.json`, `live-exports/Master_Orchestrator.json`,
  `live-exports/SILVER_Layer_1_Agent.json`, `live-exports/WTI_Layer_1_Agent.json`.
- Harness: `backtester/lib/usd_live_code_harness.js`, `backtester/lib/usd_decision_projections.js`,
  `backtester/scripts/compare_usd_live_vs_replay.js`,
  `backtester/fixtures/usd_live_replay_harness_cases.json`,
  `backtester/fixtures/usd_live_replay_harness_baseline.json`,
  `backtester/tests/usd_live_replay_harness.test.js`.
- Repository side compared against: `exports/*.json`, `backtester/replay/usd/usd_replay_core.js`,
  `backtester/lib/headline_confidence.js`, `data/layer1.json`.
- Additive change for the comparison: `usd_replay_core.js` now also exports `FACTOR_WEIGHTS` and
  `LIVE_24H_FACTOR_WEIGHTS` so the declared vectors can be asserted; no behaviour changed.

## 8. Limits

- The harness proves agreement or disagreement of arithmetic and bookkeeping on eight frozen snapshots.
  It is not evidence of live/replay equivalence across history and not evidence of trading edge.
- Deployment identity is established for the USD deterministic code nodes only, at the export timestamp.
  Every other difference listed in section 2 remains unreviewed in this pass.
- The n8n export is a point-in-time read; later edits to any workflow are not covered.

## 9. Unavailable-versus-zero repair in the repository engines (2026-10-11, second action)

The sharpest harness finding is repaired on the repository side. The local helper in the USD, GOLD and NQ
calculate nodes was `function n(v) { const x = Number(v); ... }`, and `Number(null)`, `Number(undefined)`
and `Number("")` are all finite `0`, so an input that was simply not available was converted into a real
zero that cast a real vote at full weight. The repair inserts two checks ahead of the conversion:

```js
function n(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
```

Every downstream factor builder already branched on `=== null` and reported "Missing input", so no other
line of engine logic changed: unavailable stays unavailable, a real `0` and a negative reading keep casting
their vote. Measured on the frozen `missing_vix_level` snapshot, running the recorded live engine with the
repair applied in memory: F1, F9 and F10 stop voting (F1 was BEARISH at weight 10, F9 BEARISH at weight 1,
F10 BEARISH at weight 1), directional participation falls from 99 to 88 and now equals the replay engine's
88, missing-evidence factors rise from 0 to 2 and now equal the replay engine's 2, and the 24h conviction
changes with them. On every case where each input is present the repaired engine returns the recorded
verdicts unchanged, factor by factor, across all five timeframes.

- `scripts/lib/layer1_null_conversion_repair.js` - pure planner (`planLayer1NullConversionRepair`,
  `repairLayer1Source`, `repairExportFileText`) for the eight engines by name: usd `OCt1tB9yVMUgFTha`,
  eur `Px0bsH7chlRWH9ZD`, gbp `bMv96EPR0xCXi3bi`, gold `wwBVT0EQcKu5517I`, nq `FOpFp3AzTJVYdLXe`,
  btc `G142Blty3sGHzuOr`, silver `6IGOoTZxxTPyBpEp`, wti `8oUBopUWLiGcYU0d`.
- `scripts/repair_layer1_null_conversion.js` - offline report (default), `--apply` for the repository
  exports, and `--live <engine> [--apply]` for the live workflows through the scoped credential runner
  with backup and saved/active verification. The live operation has not been run.
- Repository drafts repaired: `exports/usd_layer1_agent.json`, `exports/gold_layer1_agent.json`,
  `exports/nq_layer1_agent.json` - one JSON line changed each, +129 bytes, exactly the two guard lines
  with every other byte identical. `eur` and `btc` were already guarded and are untouched. The `gbp`
  repository file is a draft whose four code nodes have no `n(v)` helper; silver and wti still have a live
  agent and no repository export to repair.
- The published copy (`activeVersion.nodes`) inside each export is deliberately left exactly as the live
  workflow wrote it, so the export still records that the deployed engine converts unavailable to zero
  until the live update is applied and re-exported. `backtester/fixtures/usd_live_replay_harness_baseline.json`
  and the live-export evidence are unchanged, so the frozen legacy harness stays a record of current live
  behaviour.
- Tests: `tests/layer1_null_conversion_repair.test.js` (planner, applier, committed draft state) and
  `backtester/tests/layer1_null_conversion_profile.test.js` (repaired profile over the frozen cases:
  missing, null, empty, whitespace-only, unparsable, real zero, negative, missing key).

## 10. Confidence-mapping contract for the JSON behind `Build Layer 1 JSON`

Three quantities were sharing names. In `backtester/lib/usd_decision_projections.js` the replay arm
publishes its heuristic `conviction_24h` in a field named `headline_confidence_pct` while the live arm
publishes `null` there and its conviction in `winning_side_conviction_pct`, so one field means different
things per arm. On the published USD row the node verdict is stored as 70/`VERY_STRONG` while
`backtester/lib/headline_confidence.js` computes 58/`MODERATE` from the same shares, and the ruleset states
that no percentage is a probability until a calibration model exists.

`backtester/lib/layer1_confidence_mapping.js` (version `layer1-confidence-map-v1`) maps a published row into
three explicit, disjoint blocks with declared bases: `evidence_shares` (bull/bear/neutral share of the
active weight, directional participation, net edge), `heuristic_strength` (node conviction, stored call
conviction, headline blend, strength label, `is_probability: false`), and `calibrated_probability`
(`p_up_24h: null`, `calibration_version: null`, `status: uncalibrated`). `assertLayer1ConfidenceMapping`
rejects a number in the calibrated block without a named calibration version, a heuristic published under a
probability name, a share published as a strength, and a `0` share of no active evidence (it must be null).
The mapping is attached to the published-row check and to every case in
`docs/review/usd-24h-ruleset-v1/usd_live_replay_comparison.json`, and the comparison script now fails rather
than writes an invalid mapping. The frozen legacy projections are untouched: the legacy conflation is
recorded in `backtester/fixtures/usd_live_replay_harness_baseline.json` and superseded by the new contract
rather than silently rewritten. Tests: `backtester/tests/layer1_confidence_mapping.test.js`.

Remaining, and not claimed here: the live engine still converts unavailable inputs to zero until the live
update is applied, no calibration model exists so no calibrated percentage is published for any horizon,
and none of this is evidence of predictive accuracy or trading edge.

