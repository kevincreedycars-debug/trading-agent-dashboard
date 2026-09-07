"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VERSION = "l2l-directional-research-verdict-v1";
const OUTPUT_PATH = path.resolve(__dirname, "../../data/l2l-directional-research-verdict-v1.json");
const EVIDENCE_PATH = path.resolve(__dirname, "../../tmp/l2l-directional-research-verdict-v1-evidence-20260815.json");

const SOURCE_ARTIFACTS = Object.freeze([
  "data/half-l2l-reach-research.json",
  "data/half-l2l-executable-entry-v1-draft.json",
  "data/l2l-trading-day-directional-v1.json",
  "data/l2l-directional-failure-diagnostics-v1.json",
  "data/l2l-directional-discrimination-v1.json",
  "data/l2l-excursion-definition-reconciliation-v1.json"
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", relativePath), "utf8"));
}

function sha256File(relativePath) {
  const absolutePath = path.resolve(__dirname, "../../", relativePath);
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function round(value, decimals = 2) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Number(value.toFixed(decimals));
}

function buildVerdict() {
  const directional = readJson("data/l2l-trading-day-directional-v1.json");
  const failure = readJson("data/l2l-directional-failure-diagnostics-v1.json");
  const discrimination = readJson("data/l2l-directional-discrimination-v1.json");
  const reconciliation = readJson("data/l2l-excursion-definition-reconciliation-v1.json");
  const executableDraft = readJson("data/half-l2l-executable-entry-v1-draft.json");

  const layer1Bullish = failure.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === "BULLISH");
  const layer1Bearish = failure.layers.layer1.direction.directionSummaries.find((row) => row.callDirection === "BEARISH");
  const layer2Bullish = failure.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === "BULLISH");
  const layer2Bearish = failure.layers.layer2.direction.directionSummaries.find((row) => row.callDirection === "BEARISH");
  const discriminationHalfLayer1 = discrimination.layers.layer1.overall.find((row) => row.thresholdKey === "HALF_ADR20");
  const discriminationHalfLayer2 = discrimination.layers.layer2.overall.find((row) => row.thresholdKey === "HALF_ADR20");
  const discriminationFullLayer1 = discrimination.layers.layer1.overall.find((row) => row.thresholdKey === "FULL_ADR20");
  const discriminationFullLayer2 = discrimination.layers.layer2.overall.find((row) => row.thresholdKey === "FULL_ADR20");

  const sourceHashes = SOURCE_ARTIFACTS.map((relativePath) => ({
    path: relativePath,
    sha256: sha256File(relativePath)
  }));

  const layer1EligibleRows = directional.row_level.layer1.filter((row) => row.included).length;
  const layer2EligibleRows = directional.row_level.layer2.filter((row) => row.included).length;
  const eligibleRows = layer1EligibleRows + layer2EligibleRows;

  return {
    meta: {
      generated_at: new Date().toISOString(),
      version: VERSION,
      research_only: true,
      immutable_summary: true,
      preserved_frozen_artifacts: true,
      final_test_consumed: true,
      current_core_scope: "trading-day directional outcome research closed",
      executable_entry_draft_status: "outside_current_core_scope_preserved_without_modification"
    },
    sourceArtifacts: sourceHashes,
    frozenPopulation: {
      eligibleRows,
      layer1Rows: layer1EligibleRows,
      layer2Rows: layer2EligibleRows,
      duplicatePredictionIdsAcrossLayersNotIndependentEvidence: true,
      preservedArtifactHash: sourceHashes.find((item) => item.path === "data/half-l2l-reach-research.json").sha256,
      preservedExecutableEntryDraftHash:
        sourceHashes.find((item) => item.path === "data/half-l2l-executable-entry-v1-draft.json").sha256
    },
    findings: {
      originalExcursionMetric: {
        label: "path_dependent_intraday_excursion_only",
        conclusion: reconciliation.conclusion,
        layer1HalfAdr20ReachPct: round((reconciliation.originalHeadlineReproduction.independentTotals.layer1.halfHits / 2493) * 100, 2),
        layer1FullAdr20ReachPct: round((reconciliation.originalHeadlineReproduction.independentTotals.layer1.fullHits / 2493) * 100, 2),
        layer2HalfAdr20ReachPct: round((reconciliation.originalHeadlineReproduction.independentTotals.layer2.halfHits / 1592) * 100, 2),
        layer2FullAdr20ReachPct: round((reconciliation.originalHeadlineReproduction.independentTotals.layer2.fullHits / 1592) * 100, 2),
        pathDependenceEvidence: {
          originalOnlyHalfHits: reconciliation.pathDependenceDiagnostics.originalOnlyHalfHitCount,
          originalOnlyFullHits: reconciliation.pathDependenceDiagnostics.originalOnlyFullHitCount,
          originalOnlyHalfHitsWithLaterInitiatingSwing:
            reconciliation.pathDependenceDiagnostics.originalOnlyHalfHitsWithLaterInitiatingSwingCount,
          originalOnlyFullHitsWithLaterInitiatingSwing:
            reconciliation.pathDependenceDiagnostics.originalOnlyFullHitsWithLaterInitiatingSwingCount
        }
      },
      sessionOpenDiscrimination: {
        conclusion: discrimination.conclusion,
        halfAdr20CalledMinusOppositeReachPct: {
          layer1: discriminationHalfLayer1.pairedCalledMinusOppositeReachPct,
          layer2: discriminationHalfLayer2.pairedCalledMinusOppositeReachPct
        },
        fullAdr20CalledMinusOppositeReachPct: {
          layer1: discriminationFullLayer1.pairedCalledMinusOppositeReachPct,
          layer2: discriminationFullLayer2.pairedCalledMinusOppositeReachPct
        }
      },
      sessionCloseDirectionalAccuracy: {
        layer1AccuracyPct: directional.comparisons.overall.layer1.directionalAccuracyPct,
        layer2AccuracyPct: directional.comparisons.overall.layer2.directionalAccuracyPct,
        layer1AlwaysBullishBaselinePct:
          directional.comparisons.overall.layer1.unconditionalDirectionalDistribution.majorityDirectionalBaselinePct,
        layer2AlwaysBullishBaselinePct:
          directional.comparisons.overall.layer2.unconditionalDirectionalDistribution.majorityDirectionalBaselinePct
      },
      bearishCallUnderperformance: {
        layer1BullishAccuracyPct: layer1Bullish.accuracyPct,
        layer1BearishAccuracyPct: layer1Bearish.accuracyPct,
        layer2BullishAccuracyPct: layer2Bullish.accuracyPct,
        layer2BearishAccuracyPct: layer2Bearish.accuracyPct
      },
      confidenceMonotonicityAbsent: {
        layer1AccuracyMonotonicNonDecreasing: failure.layers.layer1.confidence.monotonicity.accuracyMonotonicNonDecreasing,
        layer2AccuracyMonotonicNonDecreasing: failure.layers.layer2.confidence.monotonicity.accuracyMonotonicNonDecreasing
      },
      stableSubgroupCandidatesAbsent: {
        classification: failure.classification,
        weakestEntities: failure.findings.weakestEntities
      },
      layer2ImprovementAbsent: {
        matchedPredictionCount: failure.layer2VersusLayer1.matchedPredictionCount,
        netImprovementPct: failure.layer2VersusLayer1.netImprovementPct,
        improvedCount: failure.layer2VersusLayer1.improvedCount,
        worsenedCount: failure.layer2VersusLayer1.worsenedCount
      }
    },
    finalConclusion: {
      validatedPredictorOfDesignatedSessionDirection: false,
      plainEnglish:
        "The current Layer 1 and Layer 2 calls are not validated predictors of the designated trading session's closing direction.",
      prohibitedFutureClaims: [
        "Do not describe the original 97% or 70-72% excursion rates as directional accuracy.",
        "Do not describe the original excursion rates as win rate.",
        "Do not describe the original excursion rates as evidence that the call can be relied upon for the trading day.",
        "Do not describe the original excursion metric as an executable forecasting result."
      ]
    }
  };
}

function buildEvidence(verdict) {
  return {
    meta: {
      generated_at: verdict.meta.generated_at,
      version: `${VERSION}-evidence`,
      research_only: true
    },
    sourceArtifacts: verdict.sourceArtifacts,
    preservedSummary: verdict.findings,
    finalConclusion: verdict.finalConclusion
  };
}

function validateVerdict(verdict) {
  const errors = [];
  if (verdict.frozenPopulation.eligibleRows !== 4085) {
    errors.push(`Expected 4085 eligible rows, got ${verdict.frozenPopulation.eligibleRows}`);
  }
  if (verdict.frozenPopulation.layer1Rows !== 2493) {
    errors.push(`Expected 2493 Layer 1 rows, got ${verdict.frozenPopulation.layer1Rows}`);
  }
  if (verdict.frozenPopulation.layer2Rows !== 1592) {
    errors.push(`Expected 1592 Layer 2 rows, got ${verdict.frozenPopulation.layer2Rows}`);
  }
  if (verdict.findings.sessionCloseDirectionalAccuracy.layer1AccuracyPct >= 50) {
    errors.push("Layer 1 directional accuracy should remain below 50% in the frozen verdict.");
  }
  if (verdict.findings.sessionCloseDirectionalAccuracy.layer2AccuracyPct >= 50) {
    errors.push("Layer 2 directional accuracy should remain below 50% in the frozen verdict.");
  }
  if (verdict.findings.originalExcursionMetric.conclusion !== "ORIGINAL_METRIC_PATH_DEPENDENT") {
    errors.push(`Unexpected excursion reconciliation conclusion: ${verdict.findings.originalExcursionMetric.conclusion}`);
  }
  return errors;
}

module.exports = {
  EVIDENCE_PATH,
  OUTPUT_PATH,
  SOURCE_ARTIFACTS,
  VERSION,
  buildEvidence,
  buildVerdict,
  validateVerdict
};
