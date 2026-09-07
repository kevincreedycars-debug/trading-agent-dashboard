"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const VERSION = "l2l-session-close-redesign-feasibility-v1";
const OUTPUT_PATH = path.resolve(__dirname, "../../data/l2l-session-close-redesign-feasibility-v1.json");
const EVIDENCE_PATH = path.resolve(__dirname, "../../tmp/l2l-session-close-redesign-feasibility-v1-evidence-20260815.json");

const RESULTS = Object.freeze({
  REDESIGN_FEASIBLE_WITH_NEW_HOLDOUT: "REDESIGN_FEASIBLE_WITH_NEW_HOLDOUT",
  REDESIGN_FEASIBLE_BUT_NO_UNSEEN_HOLDOUT: "REDESIGN_FEASIBLE_BUT_NO_UNSEEN_HOLDOUT",
  INPUT_TIMING_NOT_DEFENSIBLE: "INPUT_TIMING_NOT_DEFENSIBLE",
  INSUFFICIENT_HISTORICAL_FEATURE_DATA: "INSUFFICIENT_HISTORICAL_FEATURE_DATA"
});

const SQL_SOURCES = Object.freeze([
  { assetCode: "EUR", path: "backtester/sql/007_eur_historical_market_snapshots.sql" },
  { assetCode: "GOLD", path: "backtester/sql/008_gold_historical_market_snapshots.sql" },
  { assetCode: "NQ", path: "backtester/sql/009_nq_historical_market_snapshots.sql" },
  { assetCode: "BTC", path: "backtester/sql/010_btc_historical_market_snapshots.sql" },
  { assetCode: "USD", path: "backtester/sql/002_usd_historical_market_snapshots.sql" }
]);

const FEATURE_EXCLUSIONS = new Set([
  "id",
  "asset_code",
  "observation_time",
  "snapshot_date",
  "snapshot_timezone",
  "snapshot_mode",
  "collector_version",
  "snapshot_schema_version",
  "reconstruction_logic_version",
  "logic_document",
  "logic_document_version",
  "prompt_version",
  "weight_model_version",
  "conviction_model_version",
  "source_bundle_version",
  "source_vendor_manifest",
  "reconstructed_at",
  "reconstruction_notes",
  "source_status",
  "collector_status",
  "event_coverage_status",
  "market_data_coverage_status",
  "pmi_coverage_status",
  "missing_inputs",
  "missing_raw_series",
  "derived_with_fallbacks",
  "history_rows_used",
  "warnings",
  "quality_notes",
  "raw_event_payload",
  "raw_market_payload",
  "created_at",
  "is_reconstructable_following_24hrs",
  "is_reconstructable_3d_from_call",
  "is_reconstructable_current_week",
  "is_reconstructable_next_week",
  "is_reconstructable_current_month"
]);

const PROSPECTIVE_PAIR_BY_ASSET = Object.freeze({
  EUR: "EUR_USD",
  GOLD: "XAU_USD",
  NQ: "NQ_USD",
  BTC: "BTC_USD"
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../", relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "../../", relativePath), "utf8");
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

function parseSqlColumns(sqlText) {
  const lines = sqlText.split(/\r?\n/);
  const columns = [];
  let insideCreate = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^create table/i.test(trimmed)) {
      insideCreate = true;
      continue;
    }
    if (!insideCreate) {
      continue;
    }
    if (/^(constraint|comment on|create index|\);)/i.test(trimmed)) {
      break;
    }
    if (!trimmed || trimmed.startsWith("--")) {
      continue;
    }
    const columnMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+/);
    if (!columnMatch) {
      continue;
    }
    const name = columnMatch[1];
    if (name === "create") {
      continue;
    }
    columns.push(name);
  }

  return columns;
}

function classifyFeatureField(fieldName) {
  if (FEATURE_EXCLUSIONS.has(fieldName)) {
    return {
      include: false,
      timingClass: "EXCLUDED_NON_FEATURE",
      lookaheadAssessment: "EXCLUDED_NON_FEATURE"
    };
  }

  if (
    fieldName.startsWith("next_tier1_") ||
    fieldName.startsWith("upcoming_events") ||
    fieldName === "tier1_event_due_next_24h" ||
    fieldName === "tier1_events_due_next_3d_count"
  ) {
    return {
      include: true,
      timingClass: "KNOWN_SCHEDULE_BEFORE_SESSION",
      lookaheadAssessment: "DEFENSIBLE_IF_SCHEDULE_TIMESTAMPED"
    };
  }

  if (fieldName.startsWith("latest_") && fieldName.endsWith("_time")) {
    return {
      include: true,
      timingClass: "PAST_EVENT_EXACT_TIMESTAMP",
      lookaheadAssessment: "DEFENSIBLE_IF_FILTERED_STRICTLY_BEFORE_SESSION_START"
    };
  }

  if (
    fieldName.startsWith("latest_") ||
    fieldName === "surprise_score" ||
    fieldName === "recent_us_event_within_72h"
  ) {
    return {
      include: true,
      timingClass: "PAST_EVENT_AS_OF_STATE",
      lookaheadAssessment: "DEFENSIBLE_IF_FILTERED_STRICTLY_BEFORE_SESSION_START"
    };
  }

  if (
    fieldName === "fed_bias" ||
    fieldName === "fed_bias_score" ||
    fieldName === "fed_bias_reasons" ||
    fieldName === "ecb_bias" ||
    fieldName === "ecb_bias_score" ||
    fieldName === "ecb_bias_reasons" ||
    fieldName === "equities_regime" ||
    fieldName === "global_growth_regime" ||
    fieldName === "global_growth_context" ||
    fieldName === "china_growth_signal" ||
    fieldName === "ez_stress_flag" ||
    fieldName === "ez_composite_pmi" ||
    fieldName === "ez_composite_pmi_direction" ||
    fieldName === "latest_ez_pmi_event" ||
    fieldName === "crypto_fear_greed" ||
    fieldName === "geopolitical_risk_flag" ||
    fieldName.endsWith("_trend_alignment_5d_20d")
  ) {
    return {
      include: true,
      timingClass: "AS_OF_SNAPSHOT_DERIVED_STATE",
      lookaheadAssessment: "AMBIGUOUS_IF_UPSTREAM_SERIES_ARE_ONLY_DATE_STAMPED"
    };
  }

  if (
    fieldName.startsWith("raw_") ||
    fieldName.includes("_yield") ||
    fieldName.includes("_spread") ||
    fieldName.includes("_price") ||
    fieldName.includes("_level") ||
    fieldName.includes("_d1") ||
    fieldName.includes("_d5") ||
    fieldName.includes("_d20") ||
    fieldName.includes("_flow_")
  ) {
    return {
      include: true,
      timingClass: "DATE_STAMPED_MARKET_SERIES_OR_DERIVED_DELTA",
      lookaheadAssessment: "AMBIGUOUS_DATE_ONLY_BEFORE_SESSION"
    };
  }

  return {
    include: true,
    timingClass: "UNCATEGORIZED_REVIEW_REQUIRED",
    lookaheadAssessment: "MANUAL_REVIEW_REQUIRED"
  };
}

function getDirectionalRows() {
  const artifact = readJson("data/l2l-trading-day-directional-v1.json");
  return artifact.row_level.all.filter((row) => row.included);
}

function summariseLabels(rows) {
  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.terminalDirection] = (accumulator[row.terminalDirection] || 0) + 1;
    return accumulator;
  }, {});
  return {
    bullishCount: counts.BULLISH || 0,
    bearishCount: counts.BEARISH || 0,
    flatCount: counts.FLAT || 0,
    bullishPct: round(((counts.BULLISH || 0) / rows.length) * 100, 2),
    bearishPct: round(((counts.BEARISH || 0) / rows.length) * 100, 2),
    flatPct: round(((counts.FLAT || 0) / rows.length) * 100, 2)
  };
}

function summariseRowsByKey(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key];
    const bucket = grouped.get(value);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(value, [row]);
    }
  }
  return [...grouped.entries()].map(([value, bucketRows]) => ({
    [key]: value,
    count: bucketRows.length,
    labelBalance: summariseLabels(bucketRows)
  }));
}

function buildFeatureProfiles() {
  return SQL_SOURCES.map((source) => {
    const columns = parseSqlColumns(readText(source.path));
    const featureFields = columns
      .map((fieldName) => ({ fieldName, ...classifyFeatureField(fieldName) }))
      .filter((field) => field.include);

    const ambiguousFields = featureFields.filter(
      (field) =>
        field.lookaheadAssessment === "AMBIGUOUS_DATE_ONLY_BEFORE_SESSION" ||
        field.lookaheadAssessment === "AMBIGUOUS_IF_UPSTREAM_SERIES_ARE_ONLY_DATE_STAMPED" ||
        field.lookaheadAssessment === "MANUAL_REVIEW_REQUIRED"
    );

    return {
      assetCode: source.assetCode,
      sourceSqlPath: source.path,
      sourceSqlSha256: sha256File(source.path),
      totalIncludedFeatureCount: featureFields.length,
      ambiguousTimingFieldCount: ambiguousFields.length,
      fields: featureFields.map((field) => ({
        fieldName: field.fieldName,
        timingClass: field.timingClass,
        lookaheadAssessment: field.lookaheadAssessment,
        directlyPreservedInFrozenLocalArtifacts: false,
        frozenLocalValueAvailabilityStatus: "NOT_PRESERVED_IN_DIRECTIONAL_OR_CHECKER_ARTIFACTS"
      }))
    };
  });
}

function buildMatrixRows(rows, featureProfiles) {
  const profileByAsset = new Map(featureProfiles.map((profile) => [profile.assetCode, profile]));
  return rows.map((row) => {
    const profile = profileByAsset.get(row.underlyingAssetCode);
    return {
      recordId: row.recordId,
      predictionId: row.predictionId,
      snapshotDate: row.snapshotDate,
      designatedEvaluationSession: {
        evaluationDate: row.evaluationDate,
        startTimeUtc: row.evaluationStartTime,
        endTimeUtc: row.evaluationEndTime
      },
      sessionOpenPrice: row.sessionOpenPrice,
      sessionClosePrice: row.sessionClosePrice,
      sessionCloseLabel: row.terminalDirection,
      signedOpenToCloseReturnAdr20: row.openToCloseReturnAdr,
      layer: row.layer,
      layer1AssetCode: row.underlyingAssetCode,
      prospectiveLayer2PairCode:
        row.layer === "LAYER_2" ? row.entityCode : (PROSPECTIVE_PAIR_BY_ASSET[row.underlyingAssetCode] || null),
      featureProfileAssetCode: row.underlyingAssetCode,
      featureValueAvailabilityStatus: "RAW_PRE_SESSION_FEATURE_VALUES_NOT_PRESERVED_LOCALLY",
      timingRiskStatus:
        profile && profile.ambiguousTimingFieldCount > 0
          ? "AMBIGUOUS_DATE_ONLY_OR_END_OF_DAY_RECONSTRUCTION"
          : "NO_PROFILE"
    };
  });
}

function assessTiming(rows, featureProfiles) {
  const profileByAsset = new Map(featureProfiles.map((profile) => [profile.assetCode, profile]));
  const sessionStartByAsset = {};
  for (const row of rows) {
    if (!sessionStartByAsset[row.underlyingAssetCode]) {
      sessionStartByAsset[row.underlyingAssetCode] = row.evaluationStartTime;
    }
  }

  const timingConcerns = featureProfiles.map((profile) => ({
    assetCode: profile.assetCode,
    evaluationSessionStartExampleUtc: sessionStartByAsset[profile.assetCode] || null,
    ambiguousTimingFieldCount: profile.ambiguousTimingFieldCount,
    dateOnlyOrDerivedStateFields: profile.fields
      .filter((field) =>
        field.lookaheadAssessment === "AMBIGUOUS_DATE_ONLY_BEFORE_SESSION" ||
        field.lookaheadAssessment === "AMBIGUOUS_IF_UPSTREAM_SERIES_ARE_ONLY_DATE_STAMPED"
      )
      .map((field) => field.fieldName)
  }));

  const problematicAssets = timingConcerns.filter((item) => item.ambiguousTimingFieldCount > 0);
  return {
    observationTimePolicy:
      "Historical snapshot builders stamp observation_time at snapshotDate 00:00:00Z but derive many market fields from same-date daily series and same-date as-of event rollups.",
    sameDateSessionBoundaryRisk:
      "Eligible EUR, GOLD, and NQ sessions begin at 22:00Z or 23:00Z on snapshotDate, while BTC begins at 00:00Z on evaluationDate. Date-only daily series and same-date event cutoffs do not prove strict pre-session availability.",
    problematicAssets,
    timingDefensible: problematicAssets.length === 0
  };
}

function assessHoldoutAndSourceCoverage(featureProfiles) {
  const reach = readJson("data/half-l2l-reach-research.json");
  const sourceAudit = reach.source_audit;
  const envAvailability = {
    supabaseUrlPresent: Boolean(process.env.SUPABASE_URL),
    supabaseServiceRoleKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  };

  const localStopsAtOrBeforeFinalDate = sourceAudit.every((item) => {
    if (!item.available || !item.sourceCoverage?.intraday?.endDate) {
      return true;
    }
    return item.sourceCoverage.intraday.endDate <= "2026-04-30";
  });

  const usdLocalUnavailable = sourceAudit.find((item) => item.assetCode === "USD")?.available === false;

  return {
    localSourceAudit: sourceAudit,
    localSourceStopAtOrBefore2026_04_30: localStopsAtOrBeforeFinalDate,
    usdLocalSnapshotSourceUnavailable: usdLocalUnavailable,
    configuredReadOnlyEnvironmentAvailable: envAvailability.supabaseUrlPresent && envAvailability.supabaseServiceRoleKeyPresent,
    remoteReadOnlyBlocker:
      envAvailability.supabaseUrlPresent && envAvailability.supabaseServiceRoleKeyPresent
        ? null
        : "Existing configured read-only environment variables are not present in this authorised research shell, so post-2026-04-30 snapshot rows cannot be enumerated here."
  };
}

function classifyResult(timingAudit, sourceCoverage) {
  if (!timingAudit.timingDefensible) {
    return RESULTS.INPUT_TIMING_NOT_DEFENSIBLE;
  }
  if (!sourceCoverage.configuredReadOnlyEnvironmentAvailable && sourceCoverage.usdLocalSnapshotSourceUnavailable) {
    return RESULTS.INSUFFICIENT_HISTORICAL_FEATURE_DATA;
  }
  if (sourceCoverage.localSourceStopAtOrBefore2026_04_30) {
    return RESULTS.REDESIGN_FEASIBLE_BUT_NO_UNSEEN_HOLDOUT;
  }
  return RESULTS.REDESIGN_FEASIBLE_WITH_NEW_HOLDOUT;
}

function buildFeasibilityStudy() {
  const directional = readJson("data/l2l-trading-day-directional-v1.json");
  const rows = directional.row_level.all.filter((row) => row.included);
  const featureProfiles = buildFeatureProfiles();
  const timingAudit = assessTiming(rows, featureProfiles);
  const sourceCoverage = assessHoldoutAndSourceCoverage(featureProfiles);
  const result = classifyResult(timingAudit, sourceCoverage);

  return {
    meta: {
      generated_at: new Date().toISOString(),
      version: VERSION,
      research_only: true,
      preserves_existing_artifacts: true,
      final_test_consumed: true,
      intended_product_contract:
        "Using only macro information available before the designated trading session, predict whether that session will close above or below its open."
    },
    sourceArtifacts: [
      "data/l2l-trading-day-directional-v1.json",
      "data/l2l-directional-research-verdict-v1.json",
      "data/l2l-signal-construction-audit-v1.json",
      "data/half-l2l-reach-research.json",
      ...SQL_SOURCES.map((source) => source.path)
    ].map((relativePath) => ({
      path: relativePath,
      sha256: sha256File(relativePath)
    })),
    population: {
      eligibleRows: rows.length,
      layer1Rows: directional.row_level.layer1.filter((row) => row.included).length,
      layer2Rows: directional.row_level.layer2.filter((row) => row.included).length,
      dateRange: {
        snapshotStart: rows.map((row) => row.snapshotDate).sort()[0],
        snapshotEnd: rows.map((row) => row.snapshotDate).sort().slice(-1)[0]
      },
      labelBalance: summariseLabels(rows),
      byLayer: summariseRowsByKey(rows, "layer"),
      byFold: summariseRowsByKey(rows, "chronologicalFold")
    },
    immutableResearchMatrix: buildMatrixRows(rows, featureProfiles),
    featureProfiles,
    lookaheadAudit: timingAudit,
    sourceCoverage,
    conclusions: {
      result,
      holdoutAssessment:
        sourceCoverage.configuredReadOnlyEnvironmentAvailable
          ? "Read-only environment is present, but this study still requires a separate post-2026-04-30 source enumeration before claiming a new untouched holdout."
          : "No configured read-only environment is present in this authorised shell, and repo-local sources stop at 2026-04-30, so no new untouched holdout can be demonstrated here.",
      plainEnglish:
        result === RESULTS.INPUT_TIMING_NOT_DEFENSIBLE
          ? "The preserved historical snapshot design is not defensible for a pre-session session-close redesign because many candidate inputs are only date-stamped or are rolled forward to end-of-day on snapshotDate, while the target sessions begin later that same date."
          : result === RESULTS.INSUFFICIENT_HISTORICAL_FEATURE_DATA
            ? "The redesign cannot be evaluated from currently preserved local evidence because the raw pre-session feature values are not preserved locally and the configured read-only snapshot route is unavailable in this shell."
            : result === RESULTS.REDESIGN_FEASIBLE_BUT_NO_UNSEEN_HOLDOUT
              ? "A redesign feature matrix is conceptually feasible, but no untouched post-2026-04-30 holdout is currently available from the preserved safe read-only sources."
              : "A redesign appears feasible and a new untouched holdout appears available, subject to a separate read-only source enumeration."
    }
  };
}

function buildEvidence(study) {
  return {
    meta: {
      generated_at: study.meta.generated_at,
      version: `${VERSION}-evidence`,
      research_only: true
    },
    population: study.population,
    lookaheadAudit: study.lookaheadAudit,
    sourceCoverage: study.sourceCoverage,
    conclusions: study.conclusions
  };
}

function validateStudy(study) {
  const errors = [];
  if (study.population.eligibleRows !== 4085) {
    errors.push(`Expected 4085 eligible rows, got ${study.population.eligibleRows}`);
  }
  if (study.population.layer1Rows !== 2493) {
    errors.push(`Expected 2493 Layer 1 rows, got ${study.population.layer1Rows}`);
  }
  if (study.population.layer2Rows !== 1592) {
    errors.push(`Expected 1592 Layer 2 rows, got ${study.population.layer2Rows}`);
  }
  if (study.conclusions.result !== RESULTS.INPUT_TIMING_NOT_DEFENSIBLE) {
    errors.push(`Expected result INPUT_TIMING_NOT_DEFENSIBLE, got ${study.conclusions.result}`);
  }
  if (study.lookaheadAudit.timingDefensible !== false) {
    errors.push("Timing audit should remain non-defensible under the preserved date-based snapshot design.");
  }
  return errors;
}

module.exports = {
  EVIDENCE_PATH,
  OUTPUT_PATH,
  RESULTS,
  SQL_SOURCES,
  VERSION,
  buildEvidence,
  buildFeasibilityStudy,
  classifyFeatureField,
  classifyResult,
  parseSqlColumns,
  validateStudy
};
