"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE_PATH = path.resolve(__dirname, "../../data/l2l-trading-day-directional-v1.json");
const OUTPUT_PATH = path.resolve(__dirname, "../../data/l2l-directional-failure-diagnostics-v1.json");

const CLASSIFICATIONS = Object.freeze({
  NO_STABLE_DIRECTIONAL_SIGNAL: "NO_STABLE_DIRECTIONAL_SIGNAL",
  BEARISH_CALL_FAILURE_DOMINATES: "BEARISH_CALL_FAILURE_DOMINATES",
  ASSET_SPECIFIC_SIGNAL_CANDIDATE: "ASSET_SPECIFIC_SIGNAL_CANDIDATE",
  CONFIDENCE_CALIBRATION_FAILURE: "CONFIDENCE_CALIBRATION_FAILURE",
  OTHER_MECHANISM_IDENTIFIED: "OTHER_MECHANISM_IDENTIFIED"
});

const MULTIPLE_TESTING_WARNING =
  "Exploratory subgroup result only. Many overlapping slices were examined; treat apparent winners or losers as unstable unless they persist prospectively.";

const ADEQUATE_SAMPLE_SIZE = 100;
const BULLISH = "BULLISH";
const BEARISH = "BEARISH";
const FLAT = "FLAT";
const CORRECT = "CORRECT";
const INCORRECT = "INCORRECT";

function loadDirectionalArtifact(sourcePath = SOURCE_PATH) {
  return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
}

function mean(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(decimals));
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

function getBaselineDistribution(rows) {
  const actualBullishCount = rows.filter((row) => row.terminalDirection === BULLISH).length;
  const actualBearishCount = rows.filter((row) => row.terminalDirection === BEARISH).length;
  const actualFlatCount = rows.filter((row) => row.terminalDirection === FLAT).length;
  const nonFlat = actualBullishCount + actualBearishCount;
  const majorityDirection = actualBullishCount >= actualBearishCount ? BULLISH : BEARISH;
  const majorityCount = Math.max(actualBullishCount, actualBearishCount);
  return {
    actualBullishCount,
    actualBearishCount,
    actualFlatCount,
    actualBullishPct: round((actualBullishCount / rows.length) * 100, 2),
    actualBearishPct: round((actualBearishCount / rows.length) * 100, 2),
    actualFlatPct: round((actualFlatCount / rows.length) * 100, 2),
    majorityDirection,
    majorityBaselinePct: nonFlat ? round((majorityCount / nonFlat) * 100, 2) : null
  };
}

function summariseRows(rows, label) {
  const correctCount = rows.filter((row) => row.classification === CORRECT).length;
  const incorrectCount = rows.filter((row) => row.classification === INCORRECT).length;
  const flatCount = rows.filter((row) => row.classification === FLAT).length;
  const evaluableCount = correctCount + incorrectCount;
  const accuracyPct = evaluableCount ? round((correctCount / evaluableCount) * 100, 2) : null;
  const inverseAccuracyPct = evaluableCount ? round((incorrectCount / evaluableCount) * 100, 2) : null;
  const callBullishCount = rows.filter((row) => row.callDirection === BULLISH).length;
  const callBearishCount = rows.filter((row) => row.callDirection === BEARISH).length;
  const signedReturnValues = rows.map((row) => row.signedReturnAdrFromCallPerspective).filter(Number.isFinite);
  const marketReturnValues = rows.map((row) => row.openToCloseReturnAdr).filter(Number.isFinite);
  const baseline = getBaselineDistribution(rows);
  const wilson = wilsonInterval(correctCount, evaluableCount);

  return {
    ...label,
    sampleSize: rows.length,
    evaluableCount,
    correctCount,
    incorrectCount,
    flatCount,
    accuracyPct,
    wilson95LowPct: wilson.lowPct,
    wilson95HighPct: wilson.highPct,
    inverseDirectionAccuracyPct: inverseAccuracyPct,
    excessAccuracyVsBaselinePct: accuracyPct == null || baseline.majorityBaselinePct == null
      ? null
      : round(accuracyPct - baseline.majorityBaselinePct, 2),
    callDistribution: {
      bullishCount: callBullishCount,
      bearishCount: callBearishCount,
      bullishPct: round((callBullishCount / rows.length) * 100, 2),
      bearishPct: round((callBearishCount / rows.length) * 100, 2)
    },
    actualDistribution: baseline,
    signedReturnAdr: {
      mean: round(mean(signedReturnValues), 6),
      median: round(median(signedReturnValues), 6)
    },
    openToCloseReturnAdr: {
      mean: round(mean(marketReturnValues), 6),
      median: round(median(marketReturnValues), 6)
    },
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  };
}

function sortConfidenceKeys(keys) {
  return [...keys].sort((left, right) => {
    const leftStart = Number(String(left).split("_")[0]);
    const rightStart = Number(String(right).split("_")[0]);
    return leftStart - rightStart;
  });
}

function evaluateMonotonicity(summaries, metricKey) {
  let monotonicNonDecreasing = true;
  let previous = null;
  for (const summary of summaries) {
    const current = summary[metricKey];
    if (current == null) {
      continue;
    }
    if (previous != null && current < previous) {
      monotonicNonDecreasing = false;
      break;
    }
    previous = current;
  }
  return monotonicNonDecreasing;
}

function buildConfidenceDiagnostics(rows, layer) {
  const byBucket = groupBy(rows, (row) => row.exactConfidenceBucketKey);
  const summaries = sortConfidenceKeys([...byBucket.keys()]).map((bucketKey) => {
    const bucketRows = byBucket.get(bucketKey);
    return summariseRows(bucketRows, {
      layer,
      confidenceBucketKey: bucketKey,
      confidenceBucketLabel: bucketRows[0].exactConfidenceBucketLabel
    });
  });

  const adequate = summaries.filter((summary) => summary.sampleSize >= 25);
  return {
    layer,
    bucketSummaries: summaries,
    monotonicity: {
      adequateBucketCount: adequate.length,
      accuracyMonotonicNonDecreasing: evaluateMonotonicity(adequate, "accuracyPct"),
      signedReturnMonotonicNonDecreasing: evaluateMonotonicity(
        adequate.map((summary) => ({ ...summary, signedReturnMean: summary.signedReturnAdr.mean })),
        "signedReturnMean"
      )
    },
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  };
}

function buildStrengthDiagnostics(rows, layer) {
  const order = new Map([["WEAK", 1], ["MODERATE", 2], ["STRONG", 3]]);
  const summaries = [...groupBy(rows, (row) => row.strengthBucket).entries()]
    .sort((a, b) => (order.get(a[0]) || 99) - (order.get(b[0]) || 99))
    .map(([strengthBucket, strengthRows]) => summariseRows(strengthRows, { layer, strengthBucket }));
  return {
    layer,
    strengthSummaries: summaries,
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  };
}

function buildDirectionalDiagnostics(rows, layer) {
  return {
    layer,
    directionSummaries: [BULLISH, BEARISH].map((callDirection) =>
      summariseRows(
        rows.filter((row) => row.callDirection === callDirection),
        { layer, callDirection }
      )
    ),
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  };
}

function buildEntityDiagnostics(rows, layer, entityKey) {
  const labelKey = entityKey === "entityCode" ? "entityLabel" : "entityCode";
  return [...groupBy(rows, (row) => row[entityKey]).entries()]
    .map(([entityValue, entityRows]) =>
      summariseRows(entityRows, {
        layer,
        [entityKey]: entityValue,
        label: entityRows[0][labelKey]
      })
    )
    .sort((a, b) => String(a[entityKey]).localeCompare(String(b[entityKey])));
}

function buildFoldDiagnostics(rows, layer) {
  const order = new Map([["TRAIN", 1], ["VALIDATION", 2], ["FINAL_TEST", 3]]);
  return [...groupBy(rows, (row) => row.chronologicalFold).entries()]
    .sort((a, b) => (order.get(a[0]) || 99) - (order.get(b[0]) || 99))
    .map(([chronologicalFold, foldRows]) =>
      summariseRows(foldRows, { layer, chronologicalFold })
    );
}

function buildWeekdayDiagnostics(rows, layer) {
  const order = new Map([
    ["MONDAY", 1],
    ["TUESDAY", 2],
    ["WEDNESDAY", 3],
    ["THURSDAY", 4],
    ["FRIDAY", 5],
    ["SATURDAY", 6],
    ["SUNDAY", 7]
  ]);
  return [...groupBy(rows, (row) => row.weekdayKey).entries()]
    .sort((a, b) => (order.get(a[0]) || 99) - (order.get(b[0]) || 99))
    .map(([weekdayKey, weekdayRows]) => summariseRows(weekdayRows, { layer, weekdayKey }));
}

function buildMatchedLayerComparison(layer1Rows, layer2Rows) {
  const layer1ByPredictionId = new Map(layer1Rows.map((row) => [row.predictionId, row]));
  const matchedRows = [];
  for (const layer2Row of layer2Rows) {
    const layer1Row = layer1ByPredictionId.get(layer2Row.predictionId);
    if (!layer1Row) {
      continue;
    }
    matchedRows.push({
      predictionId: layer2Row.predictionId,
      underlyingAssetCode: layer2Row.underlyingAssetCode,
      pairCode: layer2Row.entityCode,
      layer1Classification: layer1Row.classification,
      layer2Classification: layer2Row.classification,
      layer1Correct: layer1Row.classification === CORRECT,
      layer2Correct: layer2Row.classification === CORRECT
    });
  }

  const improvedCount = matchedRows.filter((row) => !row.layer1Correct && row.layer2Correct).length;
  const worsenedCount = matchedRows.filter((row) => row.layer1Correct && !row.layer2Correct).length;
  const bothCorrectCount = matchedRows.filter((row) => row.layer1Correct && row.layer2Correct).length;
  const bothIncorrectCount = matchedRows.filter((row) => !row.layer1Correct && !row.layer2Correct).length;

  const byPair = [...groupBy(matchedRows, (row) => row.pairCode).entries()].map(([pairCode, pairRows]) => ({
    pairCode,
    sampleSize: pairRows.length,
    improvedCount: pairRows.filter((row) => !row.layer1Correct && row.layer2Correct).length,
    worsenedCount: pairRows.filter((row) => row.layer1Correct && !row.layer2Correct).length,
    sameOutcomeCount: pairRows.filter((row) => row.layer1Correct === row.layer2Correct).length,
    netImprovementPct: round(
      ((pairRows.filter((row) => !row.layer1Correct && row.layer2Correct).length -
        pairRows.filter((row) => row.layer1Correct && !row.layer2Correct).length) / pairRows.length) * 100,
      2
    ),
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  })).sort((a, b) => String(a.pairCode).localeCompare(String(b.pairCode)));

  return {
    matchedPredictionCount: matchedRows.length,
    improvedCount,
    worsenedCount,
    bothCorrectCount,
    bothIncorrectCount,
    netImprovementPct: matchedRows.length ? round(((improvedCount - worsenedCount) / matchedRows.length) * 100, 2) : null,
    byPair,
    multipleTestingWarning: MULTIPLE_TESTING_WARNING
  };
}

function identifyAssetSpecificCandidates(layerRows, entityKey) {
  const byEntity = [...groupBy(layerRows, (row) => row[entityKey]).entries()];
  return byEntity
    .map(([entityValue, entityRows]) => {
      const foldSummaries = buildFoldDiagnostics(entityRows, entityRows[0].layer);
      const train = foldSummaries.find((summary) => summary.chronologicalFold === "TRAIN");
      const validation = foldSummaries.find((summary) => summary.chronologicalFold === "VALIDATION");
      const passes = [train, validation].every(
        (summary) =>
          summary &&
          summary.sampleSize >= ADEQUATE_SAMPLE_SIZE &&
          summary.excessAccuracyVsBaselinePct != null &&
          summary.excessAccuracyVsBaselinePct > 0
      );
      return {
        entityValue,
        train,
        validation,
        candidate: passes
      };
    })
    .filter((item) => item.candidate);
}

function classifyMechanism(diagnostics) {
  const layer1Bearish = diagnostics.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === BEARISH);
  const layer1Bullish = diagnostics.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === BULLISH);
  const layer2Bearish = diagnostics.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === BEARISH);
  const layer2Bullish = diagnostics.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === BULLISH);

  const assetCandidates = [
    ...identifyAssetSpecificCandidates(diagnostics.rows.layer1, "entityCode"),
    ...identifyAssetSpecificCandidates(diagnostics.rows.layer2, "entityCode")
  ];
  if (assetCandidates.length > 0) {
    return CLASSIFICATIONS.ASSET_SPECIFIC_SIGNAL_CANDIDATE;
  }

  const confidenceOverall =
    !diagnostics.layers.layer1.confidence.monotonicity.accuracyMonotonicNonDecreasing &&
    !diagnostics.layers.layer2.confidence.monotonicity.accuracyMonotonicNonDecreasing;

  const bearishGapLayer1 = layer1Bullish.accuracyPct - layer1Bearish.accuracyPct;
  const bearishGapLayer2 = layer2Bullish.accuracyPct - layer2Bearish.accuracyPct;
  const bearishDominates =
    bearishGapLayer1 >= 7 &&
    bearishGapLayer2 >= 7 &&
    layer1Bearish.excessAccuracyVsBaselinePct < 0 &&
    layer2Bearish.excessAccuracyVsBaselinePct < 0;

  const broadNoSignal =
    diagnostics.layers.layer1.overall.excessAccuracyVsBaselinePct < 0 &&
    diagnostics.layers.layer2.overall.excessAccuracyVsBaselinePct < 0 &&
    diagnostics.layer2VersusLayer1.netImprovementPct <= 0;

  if (broadNoSignal && bearishDominates) {
    return CLASSIFICATIONS.BEARISH_CALL_FAILURE_DOMINATES;
  }

  if (broadNoSignal && confidenceOverall) {
    return CLASSIFICATIONS.NO_STABLE_DIRECTIONAL_SIGNAL;
  }

  if (confidenceOverall) {
    return CLASSIFICATIONS.CONFIDENCE_CALIBRATION_FAILURE;
  }

  if (broadNoSignal) {
    return CLASSIFICATIONS.NO_STABLE_DIRECTIONAL_SIGNAL;
  }

  return CLASSIFICATIONS.OTHER_MECHANISM_IDENTIFIED;
}

function buildDiagnostics(artifact) {
  const allRows = artifact.row_level.all.filter((row) => row.included);
  const layer1Rows = artifact.row_level.layer1.filter((row) => row.included);
  const layer2Rows = artifact.row_level.layer2.filter((row) => row.included);
  const layer1ValidationFold = artifact.comparisons.fold_consistency.layer1.find(
    (row) => row.chronologicalFold === "VALIDATION"
  );
  const layer2ValidationFold = artifact.comparisons.fold_consistency.layer2.find(
    (row) => row.chronologicalFold === "VALIDATION"
  );
  const layer1FinalTestFold = artifact.comparisons.fold_consistency.layer1.find(
    (row) => row.chronologicalFold === "FINAL_TEST"
  );
  const layer2FinalTestFold = artifact.comparisons.fold_consistency.layer2.find(
    (row) => row.chronologicalFold === "FINAL_TEST"
  );

  const diagnostics = {
    meta: {
      generated_at: new Date().toISOString(),
      version: "l2l-directional-failure-diagnostics-v1",
      research_only: true,
      source_artifact: "data/l2l-trading-day-directional-v1.json",
      mechanically_validated_result_preserved: true,
      final_test_consumed: true,
      future_evaluation_constraint:
        "FINAL_TEST is consumed. Future call-logic redesign must use walk-forward evaluation or a genuinely new chronological holdout.",
      multiple_testing_global_warning: MULTIPLE_TESTING_WARNING
    },
    preserved_result: {
      layer1AccuracyPct: artifact.comparisons.overall.layer1.directionalAccuracyPct,
      layer2AccuracyPct: artifact.comparisons.overall.layer2.directionalAccuracyPct,
      validationLayer1AccuracyPct: layer1ValidationFold.directionalAccuracyPct,
      validationLayer2AccuracyPct: layer2ValidationFold.directionalAccuracyPct,
      finalTestLayer1AccuracyPct: layer1FinalTestFold.directionalAccuracyPct,
      finalTestLayer2AccuracyPct: layer2FinalTestFold.directionalAccuracyPct,
      mechanicalMismatches: 0,
      reliableDailyCloseSignal: false
    },
    population: {
      eligibleRows: allRows.length,
      layer1Rows: layer1Rows.length,
      layer2Rows: layer2Rows.length,
      uniquePredictionIdsAcrossLayers: artifact.source_population.uniquePredictionIdsAcrossLayers,
      duplicatedCrossLayerPredictionIdsNotIndependentEvidence:
        artifact.source_population.duplicatedCrossLayerPredictionIdsNotIndependentEvidence
    },
    rows: {
      layer1: layer1Rows,
      layer2: layer2Rows
    },
    layers: {
      layer1: {
        overall: summariseRows(layer1Rows, { layer: "LAYER_1" }),
        direction: buildDirectionalDiagnostics(layer1Rows, "LAYER_1"),
        entities: buildEntityDiagnostics(layer1Rows, "LAYER_1", "entityCode"),
        strength: buildStrengthDiagnostics(layer1Rows, "LAYER_1"),
        confidence: buildConfidenceDiagnostics(layer1Rows, "LAYER_1"),
        weekdays: buildWeekdayDiagnostics(layer1Rows, "LAYER_1"),
        folds: buildFoldDiagnostics(layer1Rows, "LAYER_1")
      },
      layer2: {
        overall: summariseRows(layer2Rows, { layer: "LAYER_2" }),
        direction: buildDirectionalDiagnostics(layer2Rows, "LAYER_2"),
        entities: buildEntityDiagnostics(layer2Rows, "LAYER_2", "entityCode"),
        strength: buildStrengthDiagnostics(layer2Rows, "LAYER_2"),
        confidence: buildConfidenceDiagnostics(layer2Rows, "LAYER_2"),
        weekdays: buildWeekdayDiagnostics(layer2Rows, "LAYER_2"),
        folds: buildFoldDiagnostics(layer2Rows, "LAYER_2")
      }
    },
    layer2VersusLayer1: buildMatchedLayerComparison(layer1Rows, layer2Rows)
  };

  diagnostics.classification = classifyMechanism(diagnostics);
  diagnostics.findings = buildFindings(diagnostics);
  delete diagnostics.rows;
  return diagnostics;
}

function buildFindings(diagnostics) {
  const layer1Bearish = diagnostics.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === BEARISH);
  const layer1Bullish = diagnostics.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === BULLISH);
  const layer2Bearish = diagnostics.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === BEARISH);
  const layer2Bullish = diagnostics.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === BULLISH);

  const worstEntities = [...diagnostics.layers.layer1.entities, ...diagnostics.layers.layer2.entities]
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, 4);

  return {
    broadSignalAssessment: {
      layer1ExcessVsBaselinePct: diagnostics.layers.layer1.overall.excessAccuracyVsBaselinePct,
      layer2ExcessVsBaselinePct: diagnostics.layers.layer2.overall.excessAccuracyVsBaselinePct,
      layer2NetImprovementVsMatchedLayer1Pct: diagnostics.layer2VersusLayer1.netImprovementPct
    },
    bullishVsBearish: {
      layer1BullishAccuracyPct: layer1Bullish.accuracyPct,
      layer1BearishAccuracyPct: layer1Bearish.accuracyPct,
      layer2BullishAccuracyPct: layer2Bullish.accuracyPct,
      layer2BearishAccuracyPct: layer2Bearish.accuracyPct
    },
    confidenceMonotonicity: {
      layer1AccuracyMonotonicNonDecreasing: diagnostics.layers.layer1.confidence.monotonicity.accuracyMonotonicNonDecreasing,
      layer2AccuracyMonotonicNonDecreasing: diagnostics.layers.layer2.confidence.monotonicity.accuracyMonotonicNonDecreasing,
      layer1SignedReturnMonotonicNonDecreasing: diagnostics.layers.layer1.confidence.monotonicity.signedReturnMonotonicNonDecreasing,
      layer2SignedReturnMonotonicNonDecreasing: diagnostics.layers.layer2.confidence.monotonicity.signedReturnMonotonicNonDecreasing
    },
    weakestEntities: worstEntities.map((entity) => ({
      code: entity.entityCode,
      sampleSize: entity.sampleSize,
      accuracyPct: entity.accuracyPct,
      excessAccuracyVsBaselinePct: entity.excessAccuracyVsBaselinePct,
      multipleTestingWarning: MULTIPLE_TESTING_WARNING
    }))
  };
}

function validateDiagnostics(diagnostics) {
  const errors = [];
  if (!Object.values(CLASSIFICATIONS).includes(diagnostics.classification)) {
    errors.push(`Unknown classification: ${diagnostics.classification}`);
  }
  if (diagnostics.population.eligibleRows !== 4085) {
    errors.push(`Expected 4085 eligible rows, received ${diagnostics.population.eligibleRows}`);
  }
  if (diagnostics.population.layer1Rows !== 2493) {
    errors.push(`Expected 2493 Layer 1 rows, received ${diagnostics.population.layer1Rows}`);
  }
  if (diagnostics.population.layer2Rows !== 1592) {
    errors.push(`Expected 1592 Layer 2 rows, received ${diagnostics.population.layer2Rows}`);
  }
  if (!diagnostics.meta.final_test_consumed) {
    errors.push("FINAL_TEST must be marked consumed.");
  }
  return errors;
}

module.exports = {
  ADEQUATE_SAMPLE_SIZE,
  CLASSIFICATIONS,
  MULTIPLE_TESTING_WARNING,
  OUTPUT_PATH,
  SOURCE_PATH,
  buildConfidenceDiagnostics,
  buildDiagnostics,
  buildMatchedLayerComparison,
  classifyMechanism,
  loadDirectionalArtifact,
  summariseRows,
  validateDiagnostics,
  wilsonInterval
};
