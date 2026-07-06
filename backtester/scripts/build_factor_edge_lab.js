#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("../lib/historical_common");
const {
  CHECKER_PATHS,
  LAYER1_CONFIGS,
  LAYER2_CONFIGS,
  buildAlignmentStats,
  buildNeutralStats,
  buildStateStats,
  buildWeightMismatch,
  classifyOutcomeDirection,
  computeComparablePctMove,
  derivePairCallDirection,
  factorDefinitionIndex,
  invertDirection,
  normalizeDirection,
  roundNumber,
  signalFromFactorComparison,
  strongestFactorBy,
  toNumber,
  weightFromFactorComparison
} = require("../lib/factor_edge_lab");

const DEFAULT_OUTPUT = path.resolve(__dirname, "../../data/factor-edge-lab.json");
const VERSION = "phase2-factor-edge-lab-v1";
const PRIMARY_METRIC = "ex_flat_wr";
const TIMEFRAME = "24H";
const ADR_L2L_BLOCKER = "Checked-in data/adr-reach-research.json does not expose full per-prediction factor-joinable rows; only summaries and samples are exported, so factor-level ADR/L2L joins are unavailable from repo-local artifacts alone.";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function checkerRowsByAsset() {
  return Object.fromEntries(Object.entries(CHECKER_PATHS).map(([assetCode, filePath]) => [assetCode, readJson(filePath)]));
}

function minDate(values) {
  return values.length ? values.slice().sort()[0] : null;
}

function maxDate(values) {
  return values.length ? values.slice().sort()[values.length - 1] : null;
}

function comparableDirectionFromPctMove(pctMove, marketKey) {
  const direction = classifyOutcomeDirection(pctMove, marketKey);
  return direction === "BULLISH" || direction === "BEARISH" || direction === "FLAT" ? direction : null;
}

function createAdrL2lUnavailableBlock() {
  return {
    available: false,
    blocker: ADR_L2L_BLOCKER
  };
}

function buildFactorEntry({
  factorId,
  factorName,
  originalWeight,
  sourceSide,
  sourceAsset,
  observations
}) {
  const bullishObservations = observations.filter((item) => item.factorState === "BULLISH");
  const bearishObservations = observations.filter((item) => item.factorState === "BEARISH");
  const neutralObservations = observations.filter((item) => item.factorState !== "BULLISH" && item.factorState !== "BEARISH");

  const bullishState = {
    ...buildStateStats(bullishObservations, sourceSide === "usd_side" ? "BEARISH" : "BULLISH"),
    adr_l2l_opportunity: createAdrL2lUnavailableBlock()
  };
  const bearishState = {
    ...buildStateStats(bearishObservations, sourceSide === "usd_side" ? "BULLISH" : "BEARISH"),
    adr_l2l_opportunity: createAdrL2lUnavailableBlock()
  };
  const neutralState = buildNeutralStats(neutralObservations);

  const directionalSample = bullishState.directional_sample + bearishState.directional_sample;
  const combinedWins = bullishState.wins + bearishState.wins;
  const combinedLosses = bullishState.losses + bearishState.losses;
  const combinedReliabilityPct = directionalSample ? roundNumber((combinedWins / directionalSample) * 100, 1) : null;
  const alignment = buildAlignmentStats(observations);
  const weightMismatch = buildWeightMismatch({
    originalWeight,
    bullishState,
    bearishState,
    combinedReliabilityPct,
    directionalSample
  });

  return {
    factor_id: factorId,
    factor_name: factorName,
    source_side: sourceSide,
    source_asset: sourceAsset,
    original_weight: originalWeight,
    bullish_state: bullishState,
    bearish_state: bearishState,
    neutral_state: neutralState,
    alignment_with_final_call: alignment,
    weight_mismatch: weightMismatch,
    suggested_interpretation: weightMismatch.suggested_interpretation
  };
}

function buildEntitySummary(factors, totalObservations) {
  return {
    total_observations: totalObservations,
    factor_count: factors.length,
    strongest_bullish_factor: strongestFactorBy(factors, (factor) => factor.bullish_state.ex_flat_wr_pct),
    strongest_bearish_factor: strongestFactorBy(factors, (factor) => factor.bearish_state.ex_flat_wr_pct),
    weakest_factor: strongestFactorBy(factors, (factor) => {
      const value = factor.weight_mismatch?.combined_factor_reliability_pct;
      return Number.isFinite(value) ? -value : Number.NEGATIVE_INFINITY;
    }),
    highest_sample_reliable_factor: strongestFactorBy(factors, (factor) => {
      const sample = factor.weight_mismatch?.directional_sample || 0;
      const reliability = factor.weight_mismatch?.combined_factor_reliability_pct;
      return sample >= 30 && Number.isFinite(reliability) && reliability >= 58 ? sample : Number.NEGATIVE_INFINITY;
    }),
    biggest_weight_mismatch: strongestFactorBy(factors, (factor) => {
      const mismatch = factor.weight_mismatch?.mismatch_vs_weight_points;
      return Number.isFinite(mismatch) ? Math.abs(mismatch) : Number.NEGATIVE_INFINITY;
    })
  };
}

function buildLayer1Entity(config, checker) {
  const factorDefinitions = factorDefinitionIndex(config.assetCode);
  const factorObservationMap = new Map();
  const dateRange = [];

  for (const row of checker.rows || []) {
    const snapshotDate = String(row.snapshot_date || "").trim();
    if (snapshotDate) dateRange.push(snapshotDate);

    const predictedDirection = normalizeDirection(row?.stored?.direction || row?.checker?.direction || "");
    const finalCallDirection = predictedDirection;
    const pctMove = computeComparablePctMove(row?.evaluation_inputs?.open_price, row?.evaluation_inputs?.close_price);
    const outcomeDirection = comparableDirectionFromPctMove(pctMove, config.marketKey);
    if (!outcomeDirection) continue;

    for (const factorComparison of row.factor_comparisons || []) {
      const factorId = String(factorComparison.factor_key || "").trim();
      if (!factorId) continue;

      const definition = factorDefinitions.get(factorId) || {};
      const factorName = definition.factorName || factorId;
      const originalWeight = toNumber(definition.originalWeight) ?? weightFromFactorComparison(factorComparison);
      const factorState = signalFromFactorComparison(factorComparison);
      const expectedDirection = factorState === "BULLISH" || factorState === "BEARISH" ? factorState : null;
      const alignment = !expectedDirection || !finalCallDirection
        ? "unavailable"
        : expectedDirection === finalCallDirection ? "aligned" : "contradicted";
      const alignmentOutcome = !expectedDirection || !finalCallDirection || outcomeDirection === "FLAT"
        ? outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
        : expectedDirection === outcomeDirection ? "WIN" : "LOSS";

      const key = `${factorId}`;
      if (!factorObservationMap.has(key)) {
        factorObservationMap.set(key, {
          factorId,
          factorName,
          originalWeight,
          sourceSide: "asset",
          sourceAsset: config.assetLabel,
          observations: []
        });
      }

      factorObservationMap.get(key).observations.push({
        snapshotDate,
        factorState,
        finalCallDirection,
        alignment,
        alignmentOutcome,
        outcomeDirection,
        realisedMovePct: pctMove
      });
    }
  }

  const factors = Array.from(factorObservationMap.values())
    .sort((a, b) => String(a.factorId).localeCompare(String(b.factorId)))
    .map((entry) => buildFactorEntry(entry));

  return {
    summary: buildEntitySummary(factors, checker.rows?.length || 0),
    date_range: {
      start: minDate(dateRange),
      end: maxDate(dateRange)
    },
    outcome_market: config.marketKey,
    adr_l2l_factor_join: createAdrL2lUnavailableBlock(),
    factors
  };
}

function buildLayer2Entity(config, allCheckers) {
  const targetChecker = allCheckers[config.targetAssetCode];
  const usdChecker = allCheckers.USD;
  const targetFactorDefinitions = factorDefinitionIndex(config.targetAssetCode);
  const usdFactorDefinitions = factorDefinitionIndex("USD");
  const targetRowsByDate = new Map((targetChecker.rows || []).map((row) => [String(row.snapshot_date || "").trim(), row]));
  const usdRowsByDate = new Map((usdChecker.rows || []).map((row) => [String(row.snapshot_date || "").trim(), row]));
  const matchedDates = Array.from(targetRowsByDate.keys()).filter((date) => usdRowsByDate.has(date)).sort();
  const factorObservationMap = new Map();

  for (const snapshotDate of matchedDates) {
    const targetRow = targetRowsByDate.get(snapshotDate);
    const usdRow = usdRowsByDate.get(snapshotDate);
    const targetDirection = normalizeDirection(targetRow?.stored?.direction || targetRow?.checker?.direction || "");
    const usdDirection = normalizeDirection(usdRow?.stored?.direction || usdRow?.checker?.direction || "");
    const finalPairCallDirection = derivePairCallDirection(targetDirection, usdDirection);
    const pctMove = computeComparablePctMove(targetRow?.evaluation_inputs?.open_price, targetRow?.evaluation_inputs?.close_price);
    const outcomeDirection = comparableDirectionFromPctMove(pctMove, config.marketKey);
    if (!outcomeDirection) continue;

    for (const factorComparison of targetRow.factor_comparisons || []) {
      const factorId = String(factorComparison.factor_key || "").trim();
      if (!factorId) continue;

      const definition = targetFactorDefinitions.get(factorId) || {};
      const factorName = definition.factorName || factorId;
      const originalWeight = toNumber(definition.originalWeight) ?? weightFromFactorComparison(factorComparison);
      const factorState = signalFromFactorComparison(factorComparison);
      const expectedDirection = factorState === "BULLISH" || factorState === "BEARISH" ? factorState : null;
      const alignment = !expectedDirection || !finalPairCallDirection
        ? "unavailable"
        : expectedDirection === finalPairCallDirection ? "aligned" : "contradicted";
      const alignmentOutcome = !expectedDirection || !finalPairCallDirection || outcomeDirection === "FLAT"
        ? outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
        : expectedDirection === outcomeDirection ? "WIN" : "LOSS";

      const key = `target_asset::${factorId}`;
      if (!factorObservationMap.has(key)) {
        factorObservationMap.set(key, {
          factorId,
          factorName,
          originalWeight,
          sourceSide: "target_asset",
          sourceAsset: config.targetAssetCode === "GOLD" ? "Gold" : config.targetAssetCode,
          observations: []
        });
      }

      factorObservationMap.get(key).observations.push({
        snapshotDate,
        factorState,
        finalCallDirection: finalPairCallDirection,
        alignment,
        alignmentOutcome,
        outcomeDirection,
        realisedMovePct: pctMove
      });
    }

    for (const factorComparison of usdRow.factor_comparisons || []) {
      const factorId = String(factorComparison.factor_key || "").trim();
      if (!factorId) continue;

      const definition = usdFactorDefinitions.get(factorId) || {};
      const factorName = definition.factorName || factorId;
      const originalWeight = toNumber(definition.originalWeight) ?? weightFromFactorComparison(factorComparison);
      const factorState = signalFromFactorComparison(factorComparison);
      const expectedDirection = factorState === "BULLISH" || factorState === "BEARISH"
        ? invertDirection(factorState)
        : null;
      const alignment = !expectedDirection || !finalPairCallDirection
        ? "unavailable"
        : expectedDirection === finalPairCallDirection ? "aligned" : "contradicted";
      const alignmentOutcome = !expectedDirection || !finalPairCallDirection || outcomeDirection === "FLAT"
        ? outcomeDirection === "FLAT" ? "FLAT" : "UNAVAILABLE"
        : expectedDirection === outcomeDirection ? "WIN" : "LOSS";

      const key = `usd_side::${factorId}`;
      if (!factorObservationMap.has(key)) {
        factorObservationMap.set(key, {
          factorId,
          factorName,
          originalWeight,
          sourceSide: "usd_side",
          sourceAsset: "USD",
          observations: []
        });
      }

      factorObservationMap.get(key).observations.push({
        snapshotDate,
        factorState,
        finalCallDirection: finalPairCallDirection,
        alignment,
        alignmentOutcome,
        outcomeDirection,
        realisedMovePct: pctMove
      });
    }
  }

  const factors = Array.from(factorObservationMap.values())
    .sort((a, b) => (
      String(a.sourceSide).localeCompare(String(b.sourceSide))
      || String(a.factorId).localeCompare(String(b.factorId))
    ))
    .map((entry) => buildFactorEntry(entry));

  const methodologyNote = config.pairCode === "NQ_USD"
    ? "Pair directional outcomes reuse the repo's existing NQ Phase 1 proxy semantics (QQQ_NQ_PROXY) because the checked-in directional checker does not expose a separate NQ/USD close-to-close evaluator."
    : "Pair directional outcomes reuse the checked-in target-side 24H evaluation market and invert USD-side factor expectations locally for research only.";

  return {
    summary: buildEntitySummary(factors, matchedDates.length),
    date_range: {
      start: minDate(matchedDates),
      end: maxDate(matchedDates)
    },
    outcome_market: config.marketKey,
    matched_date_observations: matchedDates.length,
    methodology_note: methodologyNote,
    adr_l2l_factor_join: createAdrL2lUnavailableBlock(),
    factors
  };
}

function buildPayload() {
  const checkers = checkerRowsByAsset();
  const layer1 = Object.fromEntries(LAYER1_CONFIGS.map((config) => [config.assetLabel, buildLayer1Entity(config, checkers[config.assetCode])]));
  const layer2 = Object.fromEntries(LAYER2_CONFIGS.map((config) => [config.pairLabel, buildLayer2Entity(config, checkers)]));

  const layer1Dates = Object.values(layer1).flatMap((entity) => [entity.date_range.start, entity.date_range.end].filter(Boolean));
  const layer2Dates = Object.values(layer2).flatMap((entity) => [entity.date_range.start, entity.date_range.end].filter(Boolean));

  return {
    generated_at: new Date().toISOString(),
    version: VERSION,
    timeframe: TIMEFRAME,
    primary_metric: PRIMARY_METRIC,
    date_range: {
      start: minDate([...layer1Dates, ...layer2Dates]),
      end: maxDate([...layer1Dates, ...layer2Dates])
    },
    methodology: {
      directional_outcome: "wins exclude flats from the primary ex-flat win-rate calculation",
      adr_l2l: "factor-level ADR/L2L opportunity reliability is marked unavailable unless a full per-prediction joinable export exists locally",
      layer2_mapping: {
        target_asset_factors: "target bullish -> pair bullish, target bearish -> pair bearish",
        usd_side_factors: "USD bullish -> pair bearish, USD bearish -> pair bullish",
        pair_call_alignment: "final pair call exists only when target and USD 24H calls are both directional and opposite"
      },
      outcome_markets: {
        USD: "DXY",
        EUR: "EURUSD",
        Gold: "XAUUSD",
        NQ: "QQQ_NQ_PROXY",
        BTC: "BTCUSD",
        "EUR/USD": "EURUSD",
        "XAU/USD": "XAUUSD",
        "NQ/USD": "QQQ_NQ_PROXY",
        "BTC/USD": "BTCUSD"
      },
      known_limitations: [
        ADR_L2L_BLOCKER,
        "NQ/USD pair directional outcomes inherit the existing NQ proxy semantics because the repo's checked-in directional research does not expose a separate NQ/USD close-to-close evaluator."
      ]
    },
    layer1,
    layer2
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(args.output || DEFAULT_OUTPUT);
  const payload = buildPayload();
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const layer1FactorCount = Object.values(payload.layer1).reduce((sum, entity) => sum + entity.factors.length, 0);
  const layer2FactorCount = Object.values(payload.layer2).reduce((sum, entity) => sum + entity.factors.length, 0);

  console.log(JSON.stringify({
    output_path: outputPath,
    version: payload.version,
    timeframe: payload.timeframe,
    layer1_entities: Object.keys(payload.layer1).length,
    layer2_entities: Object.keys(payload.layer2).length,
    layer1_factor_entries: layer1FactorCount,
    layer2_factor_entries: layer2FactorCount,
    adr_l2l_factor_join_available: false
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error("Factor Edge Lab build failed.");
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  }
}
