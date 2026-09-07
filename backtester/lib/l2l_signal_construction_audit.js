"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { computeHeadlineConfidenceFromRow } = require("./headline_confidence");

const VERSION = "l2l-signal-construction-audit-v1";
const OUTPUT_PATH = path.resolve(__dirname, "../../data/l2l-signal-construction-audit-v1.json");
const EVIDENCE_PATH = path.resolve(__dirname, "../../tmp/l2l-signal-construction-audit-v1-evidence-20260815.json");

const CHECKER_CONFIGS = Object.freeze([
  {
    assetCode: "EUR",
    checkerPath: "data/backtester-checker-eur-24h-2024-2026.json",
    replaySource: "backtester/replay/eur/eur_replay_core.js",
    builderSource: "backtester/scripts/build_backtester_checker_data_eur.js"
  },
  {
    assetCode: "GOLD",
    checkerPath: "data/backtester-checker-gold-24h-2024-2026.json",
    replaySource: "backtester/replay/gold/gold_replay_core.js",
    builderSource: "backtester/scripts/build_backtester_checker_data_gold.js"
  },
  {
    assetCode: "NQ",
    checkerPath: "data/backtester-checker-nq-24h-2024-2026.json",
    replaySource: "backtester/replay/nq/nq_replay_core.js",
    builderSource: "backtester/scripts/build_backtester_checker_data_nq.js"
  },
  {
    assetCode: "BTC",
    checkerPath: "data/backtester-checker-btc-24h-2024-2026.json",
    replaySource: "backtester/replay/btc/btc_replay_core.js",
    builderSource: "backtester/scripts/build_backtester_checker_data_btc.js"
  },
  {
    assetCode: "USD",
    checkerPath: "data/backtester-checker-usd-24h-2024-01.json",
    replaySource: "backtester/replay/usd/usd_replay_core.js",
    builderSource: "backtester/scripts/check_usd_live_replay_24h_parity.js"
  }
]);

const DIAGNOSES = Object.freeze({
  IMPLEMENTATION_OR_MAPPING_DEFECT: "implementation_or_mapping_defect",
  BEARISH_AGGREGATION_ASYMMETRY: "bearish_aggregation_asymmetry",
  MACRO_FACTORS_LACKING_SAME_SESSION_PREDICTIVE_SIGNAL: "macro_factors_lacking_same_session_predictive_signal",
  CONFIDENCE_CONSTRUCTION_FAILURE: "confidence_construction_failure",
  HORIZON_MISMATCH: "horizon_mismatch",
  INSUFFICIENT_PRESERVED_EVIDENCE: "insufficient_preserved_evidence"
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", relativePath), "utf8"));
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(__dirname, "../../", relativePath)))
    .digest("hex");
}

function round(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(decimals));
}

function normalizeDirection(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text.startsWith("BULL")) return "BULLISH";
  if (text.startsWith("BEAR")) return "BEARISH";
  if (text === "BUY") return "BULLISH";
  if (text === "SELL") return "BEARISH";
  return null;
}

function oppositeDirection(direction) {
  if (direction === "BULLISH") return "BEARISH";
  if (direction === "BEARISH") return "BULLISH";
  return null;
}

function deriveDirectionFromWeightedScore(weightedScore) {
  const bull = Number(weightedScore?.bullish_weight);
  const bear = Number(weightedScore?.bearish_weight);
  if (!Number.isFinite(bull) || !Number.isFinite(bear)) {
    return null;
  }
  if (bull > bear) return "BULLISH";
  if (bear > bull) return "BEARISH";
  return null;
}

function deriveConfidenceFromStoredRow(storedRow) {
  return computeHeadlineConfidenceFromRow({
    predicted_direction: storedRow.direction,
    bull_case_pct: storedRow.bull_case_pct,
    bear_case_pct: storedRow.bear_case_pct,
    participation_pct: storedRow.participation_pct,
    net_edge_pct: storedRow.net_edge_pct,
    displayed_headline_confidence_pct: storedRow.displayed_headline_confidence_pct,
    headline_confidence_pct: storedRow.headline_confidence_pct,
    conviction_model: storedRow.conviction_model
  }).value;
}

function loadCheckerBundles() {
  return CHECKER_CONFIGS.map((config) => {
    const payload = readJson(config.checkerPath);
    return {
      ...config,
      sha256: sha256File(config.checkerPath),
      rows: payload.rows,
      summary: payload.summary
    };
  });
}

function auditLayer1Checkers(checkerBundles) {
  const byAsset = {};
  const rowLookup = new Map();

  for (const bundle of checkerBundles) {
    let directionMismatchCount = 0;
    let confidenceMismatchCount = 0;
    let oppositeDirectionMatchCount = 0;
    let nonDirectionalStoredRowCount = 0;
    let fallbackConfidenceCount = 0;
    let missingCoreInputsCount = 0;

    for (const row of bundle.rows) {
      const storedDirection = normalizeDirection(row.stored?.direction);
      const reproducedDirection = deriveDirectionFromWeightedScore(row.stored?.weighted_score);
      const reproducedConfidence = deriveConfidenceFromStoredRow(row.stored || {});
      const storedConfidence = Number(row.stored?.displayed_headline_confidence_pct);
      const hasCoreInputs = [
        row.stored?.bull_case_pct,
        row.stored?.bear_case_pct,
        row.stored?.participation_pct,
        row.stored?.net_edge_pct
      ].every(Number.isFinite);

      if (!hasCoreInputs) {
        missingCoreInputsCount += 1;
      }
      if (!reproducedDirection) {
        nonDirectionalStoredRowCount += 1;
      } else if (reproducedDirection !== storedDirection) {
        directionMismatchCount += 1;
      }
      if (reproducedDirection && oppositeDirection(reproducedDirection) === storedDirection) {
        oppositeDirectionMatchCount += 1;
      }
      if (reproducedConfidence !== storedConfidence) {
        confidenceMismatchCount += 1;
      }
      if (!hasCoreInputs && reproducedConfidence === storedConfidence) {
        fallbackConfidenceCount += 1;
      }

      rowLookup.set(`${bundle.assetCode}|${row.prediction_id}`, row);
      rowLookup.set(`${bundle.assetCode}|SNAPSHOT|${row.snapshot_date}`, row);
    }

    byAsset[bundle.assetCode] = {
      assetCode: bundle.assetCode,
      rowsChecked: bundle.rows.length,
      checkerSummary: bundle.summary,
      directionMismatchCount,
      confidenceMismatchCount,
      oppositeDirectionMatchCount,
      nonDirectionalStoredRowCount,
      missingCoreInputsCount,
      fallbackConfidenceCount
    };
  }

  return {
    byAsset,
    rowLookup
  };
}

function auditLayer1DirectionalRows(directionalArtifact, checkerAudit) {
  const layer1Rows = directionalArtifact.row_level.layer1.filter((row) => row.included);
  const byAsset = new Map();
  let missingJoinCount = 0;
  let directionMismatchCount = 0;
  let confidenceMismatchCount = 0;
  let snapshotDateMismatchCount = 0;

  for (const row of layer1Rows) {
    const checkerRow = checkerAudit.rowLookup.get(`${row.entityCode}|${row.predictionId}`);
    if (!checkerRow) {
      missingJoinCount += 1;
      continue;
    }
    if (row.callDirection !== normalizeDirection(checkerRow.stored.direction)) {
      directionMismatchCount += 1;
    }
    if (row.confidencePct !== checkerRow.stored.displayed_headline_confidence_pct) {
      confidenceMismatchCount += 1;
    }
    if (row.snapshotDate !== checkerRow.snapshot_date) {
      snapshotDateMismatchCount += 1;
    }
    const assetStats = byAsset.get(row.entityCode) || {
      assetCode: row.entityCode,
      rowsChecked: 0,
      directionMismatchCount: 0,
      confidenceMismatchCount: 0,
      snapshotDateMismatchCount: 0
    };
    assetStats.rowsChecked += 1;
    assetStats.directionMismatchCount += Number(row.callDirection !== normalizeDirection(checkerRow.stored.direction));
    assetStats.confidenceMismatchCount += Number(row.confidencePct !== checkerRow.stored.displayed_headline_confidence_pct);
    assetStats.snapshotDateMismatchCount += Number(row.snapshotDate !== checkerRow.snapshot_date);
    byAsset.set(row.entityCode, assetStats);
  }

  return {
    rowsChecked: layer1Rows.length,
    missingJoinCount,
    directionMismatchCount,
    confidenceMismatchCount,
    snapshotDateMismatchCount,
    byAsset: [...byAsset.values()].sort((left, right) => left.assetCode.localeCompare(right.assetCode))
  };
}

function deriveLayer2PairDirection(targetDirection, usdDirection) {
  if (targetDirection === "BULLISH" && usdDirection === "BEARISH") return "BULLISH";
  if (targetDirection === "BEARISH" && usdDirection === "BULLISH") return "BEARISH";
  return null;
}

function auditLayer2DirectionalRows(directionalArtifact, checkerAudit) {
  const layer2Rows = directionalArtifact.row_level.layer2.filter((row) => row.included);
  const byPair = new Map();
  let missingJoinCount = 0;
  let targetMissingCount = 0;
  let usdMissingCount = 0;
  let directionMismatchCount = 0;
  let confidenceMismatchCount = 0;
  let duplicateTargetJoinCount = 0;
  let reusedUsdSnapshotJoinCount = 0;

  const targetPredictionCounts = new Map();
  const usdSnapshotCounts = new Map();
  for (const row of layer2Rows) {
    targetPredictionCounts.set(row.predictionId, (targetPredictionCounts.get(row.predictionId) || 0) + 1);
    usdSnapshotCounts.set(row.snapshotDate, (usdSnapshotCounts.get(row.snapshotDate) || 0) + 1);
  }

  for (const row of layer2Rows) {
    const targetRow = checkerAudit.rowLookup.get(`${row.underlyingAssetCode}|${row.predictionId}`);
    const usdRow = checkerAudit.rowLookup.get(`USD|SNAPSHOT|${row.snapshotDate}`);
    if (!targetRow || !usdRow) {
      missingJoinCount += 1;
      targetMissingCount += Number(!targetRow);
      usdMissingCount += Number(!usdRow);
      continue;
    }
    if ((targetPredictionCounts.get(row.predictionId) || 0) > 1) {
      duplicateTargetJoinCount += 1;
    }
    if ((usdSnapshotCounts.get(row.snapshotDate) || 0) > 1) {
      reusedUsdSnapshotJoinCount += 1;
    }
    const expectedDirection = deriveLayer2PairDirection(
      normalizeDirection(targetRow.stored.direction),
      normalizeDirection(usdRow.stored.direction)
    );
    const expectedConfidence = Math.min(
      Number(targetRow.stored.displayed_headline_confidence_pct),
      Number(usdRow.stored.displayed_headline_confidence_pct)
    );
    const directionMismatch = row.callDirection !== expectedDirection;
    const confidenceMismatch = row.confidencePct !== expectedConfidence;

    directionMismatchCount += Number(directionMismatch);
    confidenceMismatchCount += Number(confidenceMismatch);

    const pairStats = byPair.get(row.entityCode) || {
      pairCode: row.entityCode,
      rowsChecked: 0,
      directionMismatchCount: 0,
      confidenceMismatchCount: 0
    };
    pairStats.rowsChecked += 1;
    pairStats.directionMismatchCount += Number(directionMismatch);
    pairStats.confidenceMismatchCount += Number(confidenceMismatch);
    byPair.set(row.entityCode, pairStats);
  }

  return {
    rowsChecked: layer2Rows.length,
    missingJoinCount,
    targetMissingCount,
    usdMissingCount,
    directionMismatchCount,
    confidenceMismatchCount,
    duplicateTargetJoinCount,
    reusedUsdSnapshotJoinCount,
    byPair: [...byPair.values()].sort((left, right) => left.pairCode.localeCompare(right.pairCode))
  };
}

function buildFalseBearishFactorDiagnostics(directionalArtifact, checkerAudit) {
  const layer1Rows = directionalArtifact.row_level.layer1.filter(
    (row) => row.included && row.callDirection === "BEARISH"
  );
  const byAsset = new Map();

  for (const row of layer1Rows) {
    const checkerRow = checkerAudit.rowLookup.get(`${row.entityCode}|${row.predictionId}`);
    if (!checkerRow) {
      continue;
    }
    const assetStats = byAsset.get(row.entityCode) || {
      assetCode: row.entityCode,
      bearishRows: [],
      factorStats: new Map()
    };
    assetStats.bearishRows.push({ row, checkerRow });
    byAsset.set(row.entityCode, assetStats);
  }

  return [...byAsset.values()].map((assetStats) => {
    const incorrectRows = assetStats.bearishRows.filter((item) => item.row.classification === "INCORRECT");
    const correctRows = assetStats.bearishRows.filter((item) => item.row.classification === "CORRECT");
    for (const item of assetStats.bearishRows) {
      const factorEntries = Object.values(item.checkerRow.factor_comparisons || {});
      for (const factorEntry of factorEntries) {
        const key = factorEntry.factor_key;
        const signal = normalizeDirection(factorEntry.signal?.stored);
        const stats = assetStats.factorStats.get(key) || {
          factorKey: key,
          bearishSignalIncorrectCount: 0,
          bearishSignalCorrectCount: 0
        };
        if (signal === "BEARISH") {
          if (item.row.classification === "INCORRECT") {
            stats.bearishSignalIncorrectCount += 1;
          } else if (item.row.classification === "CORRECT") {
            stats.bearishSignalCorrectCount += 1;
          }
        }
        assetStats.factorStats.set(key, stats);
      }
    }

    const rankedFactors = [...assetStats.factorStats.values()]
      .map((factor) => {
        const incorrectPct = incorrectRows.length ? (factor.bearishSignalIncorrectCount / incorrectRows.length) * 100 : 0;
        const correctPct = correctRows.length ? (factor.bearishSignalCorrectCount / correctRows.length) * 100 : 0;
        return {
          factorKey: factor.factorKey,
          wrongBearishPct: round(incorrectPct, 2),
          correctBearishPct: round(correctPct, 2),
          wrongMinusCorrectPct: round(incorrectPct - correctPct, 2)
        };
      })
      .sort((left, right) => right.wrongMinusCorrectPct - left.wrongMinusCorrectPct)
      .slice(0, 5);

    return {
      assetCode: assetStats.assetCode,
      bearishCallCount: assetStats.bearishRows.length,
      incorrectBearishCount: incorrectRows.length,
      correctBearishCount: correctRows.length,
      topExploratoryFactors: rankedFactors,
      warning:
        "Exploratory only. Preserved factor labels associated with false bearish calls are not a basis for changing weights or thresholds."
    };
  }).sort((left, right) => left.assetCode.localeCompare(right.assetCode));
}

function buildCodePathTrace(checkerBundles) {
  const sharedSources = [
    "backtester/lib/headline_confidence.js",
    "backtester/lib/layer2_pair_logic.js",
    "backtester/lib/adr_reach_research.js",
    "backtester/lib/l2l_trading_day_directional.js"
  ];
  return {
    sharedSources: sharedSources.map((relativePath) => ({
      path: relativePath,
      sha256: sha256File(relativePath)
    })),
    assetPipelines: checkerBundles.map((bundle) => ({
      assetCode: bundle.assetCode,
      replaySource: {
        path: bundle.replaySource,
        sha256: sha256File(bundle.replaySource)
      },
      checkerBuilderSource: {
        path: bundle.builderSource,
        sha256: sha256File(bundle.builderSource)
      },
      checkerArtifact: {
        path: bundle.checkerPath,
        sha256: bundle.sha256
      }
    })),
    layer1Explanation:
      "Historical market snapshots are replayed into a following-24hrs signal, persisted into checker artifacts, then normalized into half-L2L research rows.",
    layer2Explanation:
      "Layer 2 pair calls are composed from the target asset Layer 1 direction and the USD Layer 1 direction, with confidence equal to the lower of the two Layer 1 headline confidences."
  };
}

function classifyDiagnosis(audit) {
  const layer1 = audit.reproduction.layer1DirectionalArtifact;
  const layer2 = audit.reproduction.layer2DirectionalArtifact;
  const anyMechanicalMismatch =
    layer1.missingJoinCount > 0 ||
    layer1.directionMismatchCount > 0 ||
    layer1.confidenceMismatchCount > 0 ||
    layer2.missingJoinCount > 0 ||
    layer2.directionMismatchCount > 0 ||
    layer2.confidenceMismatchCount > 0 ||
    Object.values(audit.reproduction.layer1Checkers.byAsset).some((item) =>
      item.directionMismatchCount > 0 || item.confidenceMismatchCount > 0
    );

  if (anyMechanicalMismatch) {
    return DIAGNOSES.IMPLEMENTATION_OR_MAPPING_DEFECT;
  }

  if (
    audit.validatedDirectionalOutcome.pathDependenceConclusion === "ORIGINAL_METRIC_PATH_DEPENDENT" &&
    audit.validatedDirectionalOutcome.sessionOpenDiscriminationConclusion === "BEARISH_ASYMMETRY_ONLY" &&
    audit.validatedDirectionalOutcome.layer1DirectionalAccuracyPct < audit.validatedDirectionalOutcome.layer1BaselinePct &&
    audit.validatedDirectionalOutcome.layer2DirectionalAccuracyPct < audit.validatedDirectionalOutcome.layer2BaselinePct
  ) {
    return DIAGNOSES.HORIZON_MISMATCH;
  }

  if (
    audit.validatedDirectionalOutcome.layer1BearishAccuracyPct + 5 < audit.validatedDirectionalOutcome.layer1BullishAccuracyPct &&
    audit.validatedDirectionalOutcome.layer2BearishAccuracyPct + 5 < audit.validatedDirectionalOutcome.layer2BullishAccuracyPct
  ) {
    return DIAGNOSES.BEARISH_AGGREGATION_ASYMMETRY;
  }

  if (
    audit.validatedDirectionalOutcome.layer1ConfidenceMonotonicity === false &&
    audit.validatedDirectionalOutcome.layer2ConfidenceMonotonicity === false
  ) {
    return DIAGNOSES.CONFIDENCE_CONSTRUCTION_FAILURE;
  }

  return DIAGNOSES.MACRO_FACTORS_LACKING_SAME_SESSION_PREDICTIVE_SIGNAL;
}

function buildAudit() {
  const directional = readJson("data/l2l-trading-day-directional-v1.json");
  const failure = readJson("data/l2l-directional-failure-diagnostics-v1.json");
  const discrimination = readJson("data/l2l-directional-discrimination-v1.json");
  const reconciliation = readJson("data/l2l-excursion-definition-reconciliation-v1.json");
  const checkerBundles = loadCheckerBundles();
  const checkerAudit = auditLayer1Checkers(checkerBundles);
  const layer1DirectionalArtifact = auditLayer1DirectionalRows(directional, checkerAudit);
  const layer2DirectionalArtifact = auditLayer2DirectionalRows(directional, checkerAudit);
  const falseBearishFactors = buildFalseBearishFactorDiagnostics(directional, checkerAudit);

  const layer1Bullish = failure.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === "BULLISH");
  const layer1Bearish = failure.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === "BEARISH");
  const layer2Bullish = failure.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === "BULLISH");
  const layer2Bearish = failure.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === "BEARISH");

  const audit = {
    meta: {
      generated_at: new Date().toISOString(),
      version: VERSION,
      research_only: true,
      preserved_frozen_artifacts: true,
      final_test_consumed: true,
      no_call_logic_changes: true
    },
    codePathTrace: buildCodePathTrace(checkerBundles),
    validatedDirectionalOutcome: {
      layer1DirectionalAccuracyPct: directional.comparisons.overall.layer1.directionalAccuracyPct,
      layer2DirectionalAccuracyPct: directional.comparisons.overall.layer2.directionalAccuracyPct,
      layer1BaselinePct: directional.comparisons.overall.layer1.unconditionalDirectionalDistribution.majorityDirectionalBaselinePct,
      layer2BaselinePct: directional.comparisons.overall.layer2.unconditionalDirectionalDistribution.majorityDirectionalBaselinePct,
      layer1BullishAccuracyPct: layer1Bullish.accuracyPct,
      layer1BearishAccuracyPct: layer1Bearish.accuracyPct,
      layer2BullishAccuracyPct: layer2Bullish.accuracyPct,
      layer2BearishAccuracyPct: layer2Bearish.accuracyPct,
      layer1ConfidenceMonotonicity: failure.layers.layer1.confidence.monotonicity.accuracyMonotonicNonDecreasing,
      layer2ConfidenceMonotonicity: failure.layers.layer2.confidence.monotonicity.accuracyMonotonicNonDecreasing,
      layer2NetImprovementPct: failure.layer2VersusLayer1.netImprovementPct,
      sessionOpenDiscriminationConclusion: discrimination.conclusion,
      pathDependenceConclusion: reconciliation.conclusion
    },
    reproduction: {
      layer1Checkers: {
        byAsset: checkerAudit.byAsset
      },
      layer1DirectionalArtifact,
      layer2DirectionalArtifact
    },
    exploratoryFalseBearishFactorDiagnostics: falseBearishFactors
  };

  audit.bestExplainedBy = classifyDiagnosis(audit);
  audit.interpretation = buildInterpretation(audit);
  return audit;
}

function buildInterpretation(audit) {
  const mechanicalExact =
    audit.reproduction.layer1DirectionalArtifact.missingJoinCount === 0 &&
    audit.reproduction.layer1DirectionalArtifact.directionMismatchCount === 0 &&
    audit.reproduction.layer1DirectionalArtifact.confidenceMismatchCount === 0 &&
    audit.reproduction.layer2DirectionalArtifact.missingJoinCount === 0 &&
    audit.reproduction.layer2DirectionalArtifact.directionMismatchCount === 0 &&
    audit.reproduction.layer2DirectionalArtifact.confidenceMismatchCount === 0 &&
    Object.values(audit.reproduction.layer1Checkers.byAsset).every((item) =>
      item.directionMismatchCount === 0 &&
      item.confidenceMismatchCount === 0
    );

  return {
    implementationDefectEvidence: mechanicalExact
      ? "No preserved implementation or mapping defect was found. Stored Layer 1 and Layer 2 directions/confidences reproduced exactly from preserved checker inputs."
      : "A mechanical mismatch remains and must be treated as a defect candidate.",
    nonDirectionalCheckerRowsObservation:
      "Checker artifacts include some preserved non-directional 24-hour rows outside the eligible half-L2L directional population. Those rows explain the non-directional checker counts and do not create mismatches inside the 4,085 eligible rows.",
    usdReuseObservation:
      "USD snapshot joins are reused across multiple Layer 2 pairs on the same date by design. Reuse is expected and is not a duplicate-join defect.",
    bearishAsymmetryObservation:
      "Bearish calls underperform bullish calls in both layers, but bullish calls still trail the unconditional always-bullish baseline.",
    horizonMismatchObservation:
      "The traced signal path explicitly produces a following-24hrs call, while the validated research question is the direction in which the designated trading session closes.",
    confidenceObservation:
      "Headline confidence is mechanically reproducible from preserved conviction inputs, but it is not monotonic with realized directional accuracy.",
    exploratoryConstraint:
      "False-bearish factor associations are exploratory only and do not justify changing weights or thresholds."
  };
}

function buildEvidence(audit) {
  return {
    meta: {
      generated_at: audit.meta.generated_at,
      version: `${VERSION}-evidence`,
      research_only: true
    },
    reproduction: audit.reproduction,
    bestExplainedBy: audit.bestExplainedBy,
    interpretation: audit.interpretation
  };
}

function validateAudit(audit) {
  const errors = [];
  if (audit.validatedDirectionalOutcome.layer1DirectionalAccuracyPct !== 47.65) {
    errors.push(`Unexpected Layer 1 directional accuracy: ${audit.validatedDirectionalOutcome.layer1DirectionalAccuracyPct}`);
  }
  if (audit.validatedDirectionalOutcome.layer2DirectionalAccuracyPct !== 47.99) {
    errors.push(`Unexpected Layer 2 directional accuracy: ${audit.validatedDirectionalOutcome.layer2DirectionalAccuracyPct}`);
  }
  if (audit.bestExplainedBy !== DIAGNOSES.HORIZON_MISMATCH) {
    errors.push(`Expected best explanation to be horizon_mismatch, got ${audit.bestExplainedBy}`);
  }
  if (audit.reproduction.layer1DirectionalArtifact.rowsChecked !== 2493) {
    errors.push(`Expected 2493 Layer 1 directional rows, got ${audit.reproduction.layer1DirectionalArtifact.rowsChecked}`);
  }
  if (audit.reproduction.layer2DirectionalArtifact.rowsChecked !== 1592) {
    errors.push(`Expected 1592 Layer 2 directional rows, got ${audit.reproduction.layer2DirectionalArtifact.rowsChecked}`);
  }
  return errors;
}

module.exports = {
  CHECKER_CONFIGS,
  DIAGNOSES,
  EVIDENCE_PATH,
  OUTPUT_PATH,
  VERSION,
  buildAudit,
  buildEvidence,
  classifyDiagnosis,
  deriveDirectionFromWeightedScore,
  deriveLayer2PairDirection,
  normalizeDirection,
  validateAudit
};
