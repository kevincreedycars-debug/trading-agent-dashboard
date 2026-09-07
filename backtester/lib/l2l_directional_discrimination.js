"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE_PATH = path.resolve(__dirname, "../../data/l2l-trading-day-directional-v1.json");
const OUTPUT_PATH = path.resolve(__dirname, "../../data/l2l-directional-discrimination-v1.json");

const CONCLUSIONS = Object.freeze({
  DIRECTIONAL_DISCRIMINATION_PRESENT: "DIRECTIONAL_DISCRIMINATION_PRESENT",
  SYMMETRIC_INTRADAY_VOLATILITY: "SYMMETRIC_INTRADAY_VOLATILITY",
  TERMINAL_CLOSE_FAILURE_DESPITE_INTRADAY_EDGE: "TERMINAL_CLOSE_FAILURE_DESPITE_INTRADAY_EDGE",
  BEARISH_ASYMMETRY_ONLY: "BEARISH_ASYMMETRY_ONLY"
});

const MULTIPLE_TESTING_WARNING =
  "Exploratory subgroup result only. Many overlapping slices were examined; apparent subgroup asymmetries may be unstable.";

const THRESHOLDS = Object.freeze([
  { key: "HALF_ADR20", label: "0.25xADR20", distanceField: "halfDistance", calledReachField: "reachedHalfAdr20" },
  { key: "FULL_ADR20", label: "0.50xADR20", distanceField: "fullDistance", calledReachField: "reachedFullAdr20" }
]);

function loadDirectionalArtifact(sourcePath = SOURCE_PATH) {
  return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
}

function round(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(decimals));
}

function mean(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function wilsonInterval(successes, total, z = 1.96) {
  if (!total) {
    return { lowPct: null, highPct: null };
  }
  const p = successes / total;
  const z2 = z ** 2;
  const denominator = 1 + z2 / total;
  const center = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return {
    lowPct: round(((center - margin) / denominator) * 100, 2),
    highPct: round(((center + margin) / denominator) * 100, 2)
  };
}

function normalCdf(value) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const array = map.get(key);
    if (array) {
      array.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}

function deriveThresholdRow(row, thresholdSpec) {
  const distance = row[thresholdSpec.distanceField];
  const calledReach = Boolean(row[thresholdSpec.calledReachField]);
  const oppositeReach = Number.isFinite(row.maxAdverseExcursion) && Number.isFinite(distance)
    ? row.maxAdverseExcursion >= distance
    : false;
  const calledOnly = calledReach && !oppositeReach;
  const oppositeOnly = !calledReach && oppositeReach;
  const bothSides = calledReach && oppositeReach;
  const neitherSide = !calledReach && !oppositeReach;
  const largerExcursion = row.maxFavourableExcursionAdr > row.maxAdverseExcursionAdr
    ? "CALLED_SIDE"
    : row.maxFavourableExcursionAdr < row.maxAdverseExcursionAdr
      ? "OPPOSITE_SIDE"
      : "TIE";
  return {
    thresholdKey: thresholdSpec.key,
    thresholdLabel: thresholdSpec.label,
    calledReach,
    oppositeReach,
    calledOnly,
    oppositeOnly,
    bothSides,
    neitherSide,
    calledMfeAdr: row.maxFavourableExcursionAdr,
    oppositeExcursionAdr: row.maxAdverseExcursionAdr,
    calledMinusOppositeExcursionAdr: round(row.maxFavourableExcursionAdr - row.maxAdverseExcursionAdr, 6),
    largerExcursion,
    terminalDirection: row.terminalDirection
  };
}

function pairedDifferenceStats(values) {
  const n = values.length;
  if (!n) {
    return {
      meanDiffPct: null,
      ciLowPct: null,
      ciHighPct: null
    };
  }
  const meanValue = mean(values);
  const variance = mean(values.map((value) => (value - meanValue) ** 2));
  const standardError = Math.sqrt(variance / n);
  const margin = 1.96 * standardError;
  return {
    meanDiffPct: round(meanValue * 100, 2),
    ciLowPct: round((meanValue - margin) * 100, 2),
    ciHighPct: round((meanValue + margin) * 100, 2)
  };
}

function mcnemarTest(calledOnlyCount, oppositeOnlyCount) {
  const discordant = calledOnlyCount + oppositeOnlyCount;
  if (!discordant) {
    return {
      discordantCount: 0,
      continuityCorrectedChiSquare: 0,
      approximatePValue: 1
    };
  }
  const absoluteDiff = Math.abs(calledOnlyCount - oppositeOnlyCount);
  const chiSquare = ((Math.max(absoluteDiff - 1, 0)) ** 2) / discordant;
  const pValue = round(2 * (1 - normalCdf(Math.sqrt(chiSquare))), 6);
  return {
    discordantCount: discordant,
    continuityCorrectedChiSquare: round(chiSquare, 6),
    approximatePValue: pValue
  };
}

function summariseThreshold(rows, thresholdSpec, label) {
  const derivedRows = rows.map((row) => deriveThresholdRow(row, thresholdSpec));
  const calledReachCount = derivedRows.filter((row) => row.calledReach).length;
  const oppositeReachCount = derivedRows.filter((row) => row.oppositeReach).length;
  const calledOnlyCount = derivedRows.filter((row) => row.calledOnly).length;
  const oppositeOnlyCount = derivedRows.filter((row) => row.oppositeOnly).length;
  const bothSidesCount = derivedRows.filter((row) => row.bothSides).length;
  const neitherSideCount = derivedRows.filter((row) => row.neitherSide).length;
  const largerCalledCount = derivedRows.filter((row) => row.largerExcursion === "CALLED_SIDE").length;
  const largerOppositeCount = derivedRows.filter((row) => row.largerExcursion === "OPPOSITE_SIDE").length;
  const largerTieCount = derivedRows.filter((row) => row.largerExcursion === "TIE").length;
  const differenceValues = derivedRows.map((row) => Number(row.calledReach) - Number(row.oppositeReach));
  const calledWilson = wilsonInterval(calledReachCount, rows.length);
  const oppositeWilson = wilsonInterval(oppositeReachCount, rows.length);
  const pairedCi = pairedDifferenceStats(differenceValues);
  const mcnemar = mcnemarTest(calledOnlyCount, oppositeOnlyCount);

  return {
    ...label,
    thresholdKey: thresholdSpec.key,
    thresholdLabel: thresholdSpec.label,
    sampleSize: rows.length,
    calledReachCount,
    calledReachPct: round((calledReachCount / rows.length) * 100, 2),
    calledReachWilson95LowPct: calledWilson.lowPct,
    calledReachWilson95HighPct: calledWilson.highPct,
    oppositeReachCount,
    oppositeReachPct: round((oppositeReachCount / rows.length) * 100, 2),
    oppositeReachWilson95LowPct: oppositeWilson.lowPct,
    oppositeReachWilson95HighPct: oppositeWilson.highPct,
    calledOnlyCount,
    calledOnlyPct: round((calledOnlyCount / rows.length) * 100, 2),
    oppositeOnlyCount,
    oppositeOnlyPct: round((oppositeOnlyCount / rows.length) * 100, 2),
    bothSidesCount,
    bothSidesPct: round((bothSidesCount / rows.length) * 100, 2),
    neitherSideCount,
    neitherSidePct: round((neitherSideCount / rows.length) * 100, 2),
    pairedCalledMinusOppositeReachPct: pairedCi.meanDiffPct,
    pairedCalledMinusOppositeReach95LowPct: pairedCi.ciLowPct,
    pairedCalledMinusOppositeReach95HighPct: pairedCi.ciHighPct,
    mcnemar,
    averageCalledMinusOppositeExcursionAdr: round(
      mean(derivedRows.map((row) => row.calledMinusOppositeExcursionAdr)),
      6
    ),
    largerExcursionCounts: {
      calledSide: largerCalledCount,
      oppositeSide: largerOppositeCount,
      tie: largerTieCount
    },
    terminalDirectionCounts: {
      bullish: derivedRows.filter((row) => row.terminalDirection === "BULLISH").length,
      bearish: derivedRows.filter((row) => row.terminalDirection === "BEARISH").length,
      flat: derivedRows.filter((row) => row.terminalDirection === "FLAT").length
    },
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  };
}

function buildGroupedThresholdSummaries(rows, labelKey, extraLabel = {}) {
  return THRESHOLDS.map((thresholdSpec) =>
    summariseThreshold(rows, thresholdSpec, { ...extraLabel, [labelKey]: extraLabel[labelKey] })
  );
}

function buildLayerBreakdown(rows, layerName, entityField) {
  const overall = THRESHOLDS.map((thresholdSpec) => summariseThreshold(rows, thresholdSpec, { layer: layerName }));
  const byEntity = [...groupBy(rows, (row) => row[entityField]).entries()]
    .map(([entityValue, entityRows]) => THRESHOLDS.map((thresholdSpec) =>
      summariseThreshold(entityRows, thresholdSpec, {
        layer: layerName,
        [entityField]: entityValue,
        label: entityRows[0].entityLabel
      })
    ))
    .flat()
    .sort((a, b) => String(a[entityField]).localeCompare(String(b[entityField])) || String(a.thresholdKey).localeCompare(String(b.thresholdKey)));

  const byDirection = [...groupBy(rows, (row) => row.callDirection).entries()]
    .map(([callDirection, directionRows]) => THRESHOLDS.map((thresholdSpec) =>
      summariseThreshold(directionRows, thresholdSpec, { layer: layerName, callDirection })
    ))
    .flat()
    .sort((a, b) => String(a.callDirection).localeCompare(String(b.callDirection)) || String(a.thresholdKey).localeCompare(String(b.thresholdKey)));

  const byFold = [...groupBy(rows, (row) => row.chronologicalFold).entries()]
    .map(([chronologicalFold, foldRows]) => THRESHOLDS.map((thresholdSpec) =>
      summariseThreshold(foldRows, thresholdSpec, { layer: layerName, chronologicalFold })
    ))
    .flat()
    .sort((a, b) => String(a.chronologicalFold).localeCompare(String(b.chronologicalFold)) || String(a.thresholdKey).localeCompare(String(b.thresholdKey)));

  return { overall, byEntity, byDirection, byFold };
}

function selectThresholdSummary(summaries, thresholdKey) {
  return summaries.find((summary) => summary.thresholdKey === thresholdKey);
}

function classifyConclusion(discrimination) {
  const layer1Half = selectThresholdSummary(discrimination.layers.layer1.overall, "HALF_ADR20");
  const layer2Half = selectThresholdSummary(discrimination.layers.layer2.overall, "HALF_ADR20");
  const layer1Full = selectThresholdSummary(discrimination.layers.layer1.overall, "FULL_ADR20");
  const layer2Full = selectThresholdSummary(discrimination.layers.layer2.overall, "FULL_ADR20");
  const layer1BearHalf = selectThresholdSummary(
    discrimination.layers.layer1.byDirection.filter((row) => row.callDirection === "BEARISH"),
    "HALF_ADR20"
  );
  const layer2BearHalf = selectThresholdSummary(
    discrimination.layers.layer2.byDirection.filter((row) => row.callDirection === "BEARISH"),
    "HALF_ADR20"
  );
  const layer1BullHalf = selectThresholdSummary(
    discrimination.layers.layer1.byDirection.filter((row) => row.callDirection === "BULLISH"),
    "HALF_ADR20"
  );
  const layer2BullHalf = selectThresholdSummary(
    discrimination.layers.layer2.byDirection.filter((row) => row.callDirection === "BULLISH"),
    "HALF_ADR20"
  );

  const positiveOverallHalf =
    layer1Half.pairedCalledMinusOppositeReach95LowPct > 0 &&
    layer2Half.pairedCalledMinusOppositeReach95LowPct > 0;
  const positiveOverallFull =
    layer1Full.pairedCalledMinusOppositeReach95LowPct > 0 &&
    layer2Full.pairedCalledMinusOppositeReach95LowPct > 0;

  const nearSymmetric =
    Math.abs(layer1Half.pairedCalledMinusOppositeReachPct) <= 3 &&
    Math.abs(layer2Half.pairedCalledMinusOppositeReachPct) <= 3 &&
    Math.abs(layer1Full.pairedCalledMinusOppositeReachPct) <= 3 &&
    Math.abs(layer2Full.pairedCalledMinusOppositeReachPct) <= 3;

  const bearishOnly =
    layer1BearHalf.pairedCalledMinusOppositeReach95HighPct < 0 &&
    layer2BearHalf.pairedCalledMinusOppositeReach95HighPct < 0 &&
    layer1BullHalf.pairedCalledMinusOppositeReach95LowPct <= 0 &&
    layer2BullHalf.pairedCalledMinusOppositeReach95LowPct <= 0;

  const closeStillFails =
    discrimination.preservedDirectionalResult.layer1AccuracyPct < 50 &&
    discrimination.preservedDirectionalResult.layer2AccuracyPct < 50;

  if (nearSymmetric) {
    return CONCLUSIONS.SYMMETRIC_INTRADAY_VOLATILITY;
  }
  if (bearishOnly) {
    return CONCLUSIONS.BEARISH_ASYMMETRY_ONLY;
  }
  if ((positiveOverallHalf || positiveOverallFull) && closeStillFails) {
    return CONCLUSIONS.TERMINAL_CLOSE_FAILURE_DESPITE_INTRADAY_EDGE;
  }
  if (positiveOverallHalf || positiveOverallFull) {
    return CONCLUSIONS.DIRECTIONAL_DISCRIMINATION_PRESENT;
  }
  return CONCLUSIONS.SYMMETRIC_INTRADAY_VOLATILITY;
}

function buildDiscrimination(artifact) {
  const rows = artifact.row_level.all.filter((row) => row.included);
  const layer1Rows = rows.filter((row) => row.layer === "LAYER_1");
  const layer2Rows = rows.filter((row) => row.layer === "LAYER_2");

  const discrimination = {
    meta: {
      generated_at: new Date().toISOString(),
      version: "l2l-directional-discrimination-v1",
      research_only: true,
      source_artifact: "data/l2l-trading-day-directional-v1.json",
      preserved_validated_artifacts: true,
      final_test_consumed: true,
      future_evaluation_constraint:
        "FINAL_TEST is consumed. All subgroup findings here are exploratory and cannot validate future logic changes.",
      multiple_testing_global_warning: MULTIPLE_TESTING_WARNING
    },
    preservedDirectionalResult: {
      layer1AccuracyPct: artifact.comparisons.overall.layer1.directionalAccuracyPct,
      layer2AccuracyPct: artifact.comparisons.overall.layer2.directionalAccuracyPct,
      alwaysBullishBaselineLayer1Pct: artifact.comparisons.overall.layer1.unconditionalDirectionalDistribution.majorityDirectionalBaselinePct,
      alwaysBullishBaselineLayer2Pct: artifact.comparisons.overall.layer2.unconditionalDirectionalDistribution.majorityDirectionalBaselinePct
    },
    population: {
      eligibleRows: rows.length,
      layer1Rows: layer1Rows.length,
      layer2Rows: layer2Rows.length
    },
    layers: {
      layer1: buildLayerBreakdown(layer1Rows, "LAYER_1", "entityCode"),
      layer2: buildLayerBreakdown(layer2Rows, "LAYER_2", "entityCode")
    }
  };

  discrimination.findings = buildFindings(discrimination);
  discrimination.conclusion = classifyConclusion(discrimination);
  return discrimination;
}

function buildFindings(discrimination) {
  const overallHalfLayer1 = selectThresholdSummary(discrimination.layers.layer1.overall, "HALF_ADR20");
  const overallHalfLayer2 = selectThresholdSummary(discrimination.layers.layer2.overall, "HALF_ADR20");
  const overallFullLayer1 = selectThresholdSummary(discrimination.layers.layer1.overall, "FULL_ADR20");
  const overallFullLayer2 = selectThresholdSummary(discrimination.layers.layer2.overall, "FULL_ADR20");
  return {
    headline: {
      halfAdr20: {
        layer1CalledMinusOppositeReachPct: overallHalfLayer1.pairedCalledMinusOppositeReachPct,
        layer2CalledMinusOppositeReachPct: overallHalfLayer2.pairedCalledMinusOppositeReachPct
      },
      fullAdr20: {
        layer1CalledMinusOppositeReachPct: overallFullLayer1.pairedCalledMinusOppositeReachPct,
        layer2CalledMinusOppositeReachPct: overallFullLayer2.pairedCalledMinusOppositeReachPct
      }
    },
    bearishDiagnostic: {
      layer1: discrimination.layers.layer1.byDirection.filter((row) => row.callDirection === "BEARISH"),
      layer2: discrimination.layers.layer2.byDirection.filter((row) => row.callDirection === "BEARISH")
    }
  };
}

function validateDiscrimination(discrimination) {
  const errors = [];
  if (!Object.values(CONCLUSIONS).includes(discrimination.conclusion)) {
    errors.push(`Unknown conclusion: ${discrimination.conclusion}`);
  }
  if (discrimination.population.eligibleRows !== 4085) {
    errors.push(`Expected 4085 eligible rows, got ${discrimination.population.eligibleRows}`);
  }
  if (!discrimination.meta.final_test_consumed) {
    errors.push("FINAL_TEST must be marked consumed.");
  }
  return errors;
}

module.exports = {
  CONCLUSIONS,
  OUTPUT_PATH,
  SOURCE_PATH,
  THRESHOLDS,
  buildDiscrimination,
  classifyConclusion,
  deriveThresholdRow,
  loadDirectionalArtifact,
  mcnemarTest,
  pairedDifferenceStats,
  summariseThreshold,
  validateDiscrimination
};
