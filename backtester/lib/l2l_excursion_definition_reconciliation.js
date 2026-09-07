"use strict";

const fs = require("fs");
const path = require("path");

const REACH_ARTIFACT_PATH = path.resolve(__dirname, "../../data/half-l2l-reach-research.json");
const DIRECTIONAL_ARTIFACT_PATH = path.resolve(__dirname, "../../data/l2l-trading-day-directional-v1.json");
const OUTPUT_PATH = path.resolve(__dirname, "../../data/l2l-excursion-definition-reconciliation-v1.json");

const CONCLUSIONS = Object.freeze({
  EXPECTED_DEFINITION_DIFFERENCE: "EXPECTED_DEFINITION_DIFFERENCE",
  ORIGINAL_METRIC_PATH_DEPENDENT: "ORIGINAL_METRIC_PATH_DEPENDENT",
  POPULATION_OR_SESSION_MISMATCH: "POPULATION_OR_SESSION_MISMATCH",
  CALCULATION_DEFECT_FOUND: "CALCULATION_DEFECT_FOUND"
});

function round(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(decimals));
}

function pct(count, total, decimals = 2) {
  if (!total) return null;
  return round((count / total) * 100, decimals);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadArtifacts() {
  return {
    reach: loadJson(REACH_ARTIFACT_PATH),
    directional: loadJson(DIRECTIONAL_ARTIFACT_PATH)
  };
}

function deriveTransition(originalHit, sessionOpenHit) {
  if (originalHit && sessionOpenHit) return "HIT_UNDER_BOTH";
  if (originalHit && !sessionOpenHit) return "ORIGINAL_ONLY_HIT";
  if (!originalHit && sessionOpenHit) return "SESSION_OPEN_ONLY_HIT";
  return "MISS_UNDER_BOTH";
}

function compareRows(reachRow, directionalRow) {
  return {
    recordId: reachRow.recordId,
    predictionId: reachRow.predictionId,
    layer: reachRow.layer,
    entityCode: reachRow.entityCode,
    snapshotDate: reachRow.snapshotDate,
    evaluationDate: reachRow.evaluationDate,
    callDirection: reachRow.callDirection,
    sessionBoundaryMatch:
      reachRow.evaluationStartTime === directionalRow.evaluationStartTime &&
      reachRow.evaluationEndTime === directionalRow.evaluationEndTime,
    evaluationStartTime: reachRow.evaluationStartTime,
    evaluationEndTime: reachRow.evaluationEndTime,
    adr20Match: reachRow.adr20 === directionalRow.adr20,
    halfDistanceMatch: reachRow.halfL2lDistance === directionalRow.halfDistance,
    fullDistanceMatch: reachRow.currentStandardL2lDistance === directionalRow.fullDistance,
    directionMatch: reachRow.callDirection === directionalRow.callDirection,
    sessionOpenPrice: directionalRow.sessionOpenPrice,
    sessionClosePrice: directionalRow.sessionClosePrice,
    sessionOpenReference: {
      referencePrice: directionalRow.sessionOpenPrice,
      referenceTime: directionalRow.evaluationStartTime
    },
    originalHalfReference: {
      triggerSwingPrice: reachRow.outcomes.HALF_OF_STANDARD.triggerSwingPrice,
      triggerSwingTime: reachRow.outcomes.HALF_OF_STANDARD.triggerSwingTime,
      initiatingPrice: reachRow.outcomes.HALF_OF_STANDARD.initiatingPrice,
      initiatingTime: reachRow.outcomes.HALF_OF_STANDARD.initiatingTime,
      confirmingPrice: reachRow.outcomes.HALF_OF_STANDARD.confirmingPrice,
      confirmingTime: reachRow.outcomes.HALF_OF_STANDARD.confirmingTime
    },
    originalFullReference: {
      triggerSwingPrice: reachRow.outcomes.FULL_STANDARD.triggerSwingPrice,
      triggerSwingTime: reachRow.outcomes.FULL_STANDARD.triggerSwingTime,
      initiatingPrice: reachRow.outcomes.FULL_STANDARD.initiatingPrice,
      initiatingTime: reachRow.outcomes.FULL_STANDARD.initiatingTime,
      confirmingPrice: reachRow.outcomes.FULL_STANDARD.confirmingPrice,
      confirmingTime: reachRow.outcomes.FULL_STANDARD.confirmingTime
    },
    originalHalfHit: reachRow.outcomes.HALF_OF_STANDARD.outcome === "HIT",
    sessionOpenHalfHit: Boolean(directionalRow.reachedHalfAdr20),
    originalFullHit: reachRow.outcomes.FULL_STANDARD.outcome === "HIT",
    sessionOpenFullHit: Boolean(directionalRow.reachedFullAdr20),
    halfTransition: deriveTransition(
      reachRow.outcomes.HALF_OF_STANDARD.outcome === "HIT",
      Boolean(directionalRow.reachedHalfAdr20)
    ),
    fullTransition: deriveTransition(
      reachRow.outcomes.FULL_STANDARD.outcome === "HIT",
      Boolean(directionalRow.reachedFullAdr20)
    )
  };
}

function summarizeTransitions(rows, transitionField, label) {
  const counts = {
    HIT_UNDER_BOTH: 0,
    ORIGINAL_ONLY_HIT: 0,
    SESSION_OPEN_ONLY_HIT: 0,
    MISS_UNDER_BOTH: 0
  };
  for (const row of rows) {
    counts[row[transitionField]] += 1;
  }
  const total = rows.length;
  return {
    ...label,
    sampleSize: total,
    hitUnderBothCount: counts.HIT_UNDER_BOTH,
    hitUnderBothPct: pct(counts.HIT_UNDER_BOTH, total),
    originalOnlyHitCount: counts.ORIGINAL_ONLY_HIT,
    originalOnlyHitPct: pct(counts.ORIGINAL_ONLY_HIT, total),
    sessionOpenOnlyHitCount: counts.SESSION_OPEN_ONLY_HIT,
    sessionOpenOnlyHitPct: pct(counts.SESSION_OPEN_ONLY_HIT, total),
    missUnderBothCount: counts.MISS_UNDER_BOTH,
    missUnderBothPct: pct(counts.MISS_UNDER_BOTH, total)
  };
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = map.get(key);
    if (existing) {
      existing.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
}

function summarizeByGroup(rows, transitionField, groupField) {
  return [...groupBy(rows, (row) => row[groupField]).entries()]
    .map(([groupValue, groupRows]) => summarizeTransitions(groupRows, transitionField, { [groupField]: groupValue }))
    .sort((a, b) => String(a[groupField]).localeCompare(String(b[groupField])));
}

function computeReferenceDiagnostics(joinedRows, modeKey) {
  const modeLabel = modeKey === "HALF_OF_STANDARD" ? "half" : "full";
  const initiatingTimeField = modeLabel === "half" ? "originalHalfReference" : "originalFullReference";
  let laterThanSessionOpenCount = 0;
  let equalSessionStartTimeCount = 0;
  let equalSessionOpenPriceCount = 0;
  let equalSessionOpenBothCount = 0;
  for (const row of joinedRows) {
    const reference = row[initiatingTimeField];
    const initiatingTime = reference.initiatingTime;
    const initiatingPrice = reference.initiatingPrice;
    if (initiatingTime === row.evaluationStartTime) {
      equalSessionStartTimeCount += 1;
    }
    if (initiatingPrice === row.sessionOpenPrice) {
      equalSessionOpenPriceCount += 1;
    }
    if (initiatingTime === row.evaluationStartTime && initiatingPrice === row.sessionOpenPrice) {
      equalSessionOpenBothCount += 1;
    }
    if (initiatingTime && row.evaluationStartTime && Date.parse(initiatingTime) > Date.parse(row.evaluationStartTime)) {
      laterThanSessionOpenCount += 1;
    }
  }
  return {
    modeKey,
    sampleSize: joinedRows.length,
    laterThanSessionOpenCount,
    laterThanSessionOpenPct: pct(laterThanSessionOpenCount, joinedRows.length),
    equalSessionStartTimeCount,
    equalSessionStartTimePct: pct(equalSessionStartTimeCount, joinedRows.length),
    equalSessionOpenPriceCount,
    equalSessionOpenPricePct: pct(equalSessionOpenPriceCount, joinedRows.length),
    equalSessionOpenBothCount,
    equalSessionOpenBothPct: pct(equalSessionOpenBothCount, joinedRows.length)
  };
}

function computeOriginalHeadlineTotals(reachEligibleRows) {
  const byLayer = {
    LAYER_1: reachEligibleRows.filter((row) => row.layer === "LAYER_1"),
    LAYER_2: reachEligibleRows.filter((row) => row.layer === "LAYER_2")
  };
  return {
    layer1: {
      halfHits: byLayer.LAYER_1.filter((row) => row.outcomes.HALF_OF_STANDARD.outcome === "HIT").length,
      halfMisses: byLayer.LAYER_1.filter((row) => row.outcomes.HALF_OF_STANDARD.outcome === "MISS").length,
      fullHits: byLayer.LAYER_1.filter((row) => row.outcomes.FULL_STANDARD.outcome === "HIT").length,
      fullMisses: byLayer.LAYER_1.filter((row) => row.outcomes.FULL_STANDARD.outcome === "MISS").length
    },
    layer2: {
      halfHits: byLayer.LAYER_2.filter((row) => row.outcomes.HALF_OF_STANDARD.outcome === "HIT").length,
      halfMisses: byLayer.LAYER_2.filter((row) => row.outcomes.HALF_OF_STANDARD.outcome === "MISS").length,
      fullHits: byLayer.LAYER_2.filter((row) => row.outcomes.FULL_STANDARD.outcome === "HIT").length,
      fullMisses: byLayer.LAYER_2.filter((row) => row.outcomes.FULL_STANDARD.outcome === "MISS").length
    }
  };
}

function compareHeadlineTotals(independentTotals, reachArtifact) {
  const expected = {
    layer1: {
      halfHits: reachArtifact.comparisons.overall.layer1.halfOfStandard.hits,
      halfMisses: reachArtifact.comparisons.overall.layer1.halfOfStandard.misses,
      fullHits: reachArtifact.comparisons.overall.layer1.fullStandard.hits,
      fullMisses: reachArtifact.comparisons.overall.layer1.fullStandard.misses
    },
    layer2: {
      halfHits: reachArtifact.comparisons.overall.layer2.halfOfStandard.hits,
      halfMisses: reachArtifact.comparisons.overall.layer2.halfOfStandard.misses,
      fullHits: reachArtifact.comparisons.overall.layer2.fullStandard.hits,
      fullMisses: reachArtifact.comparisons.overall.layer2.fullStandard.misses
    }
  };
  return {
    exactMatch: JSON.stringify(independentTotals) === JSON.stringify(expected),
    independentTotals,
    expectedTotals: expected
  };
}

function classifyConclusion(summary) {
  if (
    summary.populationAndIdentity.missingDirectionalRows > 0 ||
    summary.populationAndIdentity.extraDirectionalRows > 0 ||
    summary.fieldComparisons.sessionBoundaryMismatchCount > 0
  ) {
    return CONCLUSIONS.POPULATION_OR_SESSION_MISMATCH;
  }
  if (!summary.originalHeadlineReproduction.exactMatch) {
    return CONCLUSIONS.CALCULATION_DEFECT_FOUND;
  }
  const halfLater = summary.referenceDiagnostics.half.laterThanSessionOpenPct;
  const fullLater = summary.referenceDiagnostics.full.laterThanSessionOpenPct;
  const halfOriginalOnly = summary.transitionMatrices.half.overall.originalOnlyHitPct;
  const fullOriginalOnly = summary.transitionMatrices.full.overall.originalOnlyHitPct;
  if (halfLater >= 50 && fullLater >= 50 && halfOriginalOnly >= 20 && fullOriginalOnly >= 20) {
    return CONCLUSIONS.ORIGINAL_METRIC_PATH_DEPENDENT;
  }
  return CONCLUSIONS.EXPECTED_DEFINITION_DIFFERENCE;
}

function buildReconciliation() {
  const { reach, directional } = loadArtifacts();
  const reachEligibleRows = reach.row_level.all.filter((row) => row.status === "ELIGIBLE");
  const directionalEligibleRows = directional.row_level.all.filter((row) => row.included);
  const directionalById = new Map(directionalEligibleRows.map((row) => [row.recordId, row]));
  const joinedRows = reachEligibleRows
    .filter((row) => directionalById.has(row.recordId))
    .map((row) => compareRows(row, directionalById.get(row.recordId)));

  const missingDirectionalRows = reachEligibleRows.filter((row) => !directionalById.has(row.recordId)).map((row) => row.recordId);
  const reachIds = new Set(reachEligibleRows.map((row) => row.recordId));
  const extraDirectionalRows = directionalEligibleRows.filter((row) => !reachIds.has(row.recordId)).map((row) => row.recordId);

  const sessionBoundaryMismatchCount = joinedRows.filter((row) => !row.sessionBoundaryMatch).length;
  const adr20MismatchCount = joinedRows.filter((row) => !row.adr20Match).length;
  const halfDistanceMismatchCount = joinedRows.filter((row) => !row.halfDistanceMatch).length;
  const fullDistanceMismatchCount = joinedRows.filter((row) => !row.fullDistanceMatch).length;
  const directionMismatchCount = joinedRows.filter((row) => !row.directionMatch).length;

  const independentTotals = computeOriginalHeadlineTotals(reachEligibleRows);
  const transitionHalfOverall = summarizeTransitions(joinedRows, "halfTransition", { scope: "OVERALL" });
  const transitionFullOverall = summarizeTransitions(joinedRows, "fullTransition", { scope: "OVERALL" });

  const summary = {
    meta: {
      generated_at: new Date().toISOString(),
      version: "l2l-excursion-definition-reconciliation-v1",
      research_only: true,
      reach_artifact_path: "data/half-l2l-reach-research.json",
      directional_artifact_path: "data/l2l-trading-day-directional-v1.json",
      frozen_artifacts_preserved: true
    },
    populationAndIdentity: {
      reachEligibleRowCount: reachEligibleRows.length,
      directionalEligibleRowCount: directionalEligibleRows.length,
      joinedEligibleRowCount: joinedRows.length,
      missingDirectionalRows: missingDirectionalRows.length,
      extraDirectionalRows: extraDirectionalRows.length,
      stableIdJoinExact: missingDirectionalRows.length === 0 && extraDirectionalRows.length === 0,
      missingDirectionalStableIdsSample: missingDirectionalRows.slice(0, 10),
      extraDirectionalStableIdsSample: extraDirectionalRows.slice(0, 10)
    },
    fieldComparisons: {
      sessionBoundaryMismatchCount,
      adr20MismatchCount,
      halfDistanceMismatchCount,
      fullDistanceMismatchCount,
      directionMismatchCount
    },
    originalHeadlineReproduction: compareHeadlineTotals(independentTotals, reach),
    originalDefinition: {
      referencePriceRule:
        "Direction-specific intraday swing. Bullish scans for the lowest low so far and then asks whether a later high reaches the target distance above that low. Bearish scans for the highest high so far and then asks whether a later low reaches the target distance below that high.",
      thresholdRule:
        "Half target uses halfL2lDistance (ADR20 * 0.25). Full target uses currentStandardL2lDistance (ADR20 * 0.5).",
      hitRule:
        "Outcome is HIT when a later confirming candle touches the target distance from the selected intraday swing. Exact equality counts as touched. There is no adverse-side stop or opposite-side sequencing rule in the original contract.",
      denominatorRule:
        "Only ELIGIBLE rows with definitive HIT or MISS outcomes are counted in the headline hit-rate denominator."
    },
    sessionOpenDefinition: {
      referencePriceRule:
        "Always the first valid 1H candle open of the designated source-defined session.",
      thresholdRule:
        "Uses the same preserved half/full ADR20 distances as the original artifact.",
      hitRule:
        "Called-side reach is measured from session open to the maximum favourable excursion inside the designated session.",
      denominatorRule:
        "All 4,085 eligible rows remain in denominator because every included session has a definitive session-open reach classification."
    },
    referenceDiagnostics: {
      half: computeReferenceDiagnostics(joinedRows, "HALF_OF_STANDARD"),
      full: computeReferenceDiagnostics(joinedRows, "FULL_STANDARD")
    },
    transitionMatrices: {
      half: {
        overall: transitionHalfOverall,
        byLayer: summarizeByGroup(joinedRows, "halfTransition", "layer"),
        byEntity: summarizeByGroup(joinedRows, "halfTransition", "entityCode"),
        byFold: summarizeByGroup(joinedRows.map((row) => {
          const directionalRow = directionalById.get(row.recordId);
          return { ...row, chronologicalFold: directionalRow.chronologicalFold };
        }), "halfTransition", "chronologicalFold")
      },
      full: {
        overall: transitionFullOverall,
        byLayer: summarizeByGroup(joinedRows, "fullTransition", "layer"),
        byEntity: summarizeByGroup(joinedRows, "fullTransition", "entityCode"),
        byFold: summarizeByGroup(joinedRows.map((row) => {
          const directionalRow = directionalById.get(row.recordId);
          return { ...row, chronologicalFold: directionalRow.chronologicalFold };
        }), "fullTransition", "chronologicalFold")
      }
    },
    pathDependenceDiagnostics: {
      originalOnlyHalfHitCount: transitionHalfOverall.originalOnlyHitCount,
      originalOnlyFullHitCount: transitionFullOverall.originalOnlyHitCount,
      originalOnlyHalfHitsWithLaterInitiatingSwingCount: joinedRows.filter((row) =>
        row.halfTransition === "ORIGINAL_ONLY_HIT" &&
        row.originalHalfReference.initiatingTime &&
        Date.parse(row.originalHalfReference.initiatingTime) > Date.parse(row.evaluationStartTime)
      ).length,
      originalOnlyFullHitsWithLaterInitiatingSwingCount: joinedRows.filter((row) =>
        row.fullTransition === "ORIGINAL_ONLY_HIT" &&
        row.originalFullReference.initiatingTime &&
        Date.parse(row.originalFullReference.initiatingTime) > Date.parse(row.evaluationStartTime)
      ).length,
      oppositeSideMirrorComparability:
        "Not directly comparable as a forecasting test. A bullish original calculation chooses the lowest low so far; a bearish mirror chooses the highest high so far. Those are direction-dependent starting swings, so the mirrored opposite side would generally not start from the same reference price or timestamp."
    },
    rowLevel: joinedRows
  };

  summary.conclusion = classifyConclusion(summary);
  return summary;
}

function validateReconciliation(output) {
  const errors = [];
  if (!Object.values(CONCLUSIONS).includes(output.conclusion)) {
    errors.push(`Unknown conclusion: ${output.conclusion}`);
  }
  if (output.populationAndIdentity.joinedEligibleRowCount !== 4085) {
    errors.push(`Expected 4085 joined eligible rows, found ${output.populationAndIdentity.joinedEligibleRowCount}`);
  }
  if (!output.originalHeadlineReproduction.exactMatch) {
    errors.push("Independent reproduction of the original four headline totals did not match exactly.");
  }
  return errors;
}

module.exports = {
  CONCLUSIONS,
  DIRECTIONAL_ARTIFACT_PATH,
  OUTPUT_PATH,
  REACH_ARTIFACT_PATH,
  buildReconciliation,
  compareHeadlineTotals,
  computeOriginalHeadlineTotals,
  deriveTransition,
  loadArtifacts,
  summarizeTransitions,
  validateReconciliation
};
