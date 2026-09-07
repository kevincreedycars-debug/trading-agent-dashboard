const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { loadIntradayOhlc } = require("./adr_reach_research");

const REPO_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ARTIFACT_PATH = path.join(REPO_ROOT, "data", "half-l2l-reach-research.json");
const DRAFT_CONTRACT_PATH = path.join(REPO_ROOT, "data", "half-l2l-executable-entry-v1-draft.json");
const DRAFT_CONTRACT_VERSION = "half-l2l-executable-entry-v1-draft";
const IANA_TIME_ZONE = "America/New_York";
const SOURCE_DEFINED_SESSION_OPEN_LOCAL_TIME = "09:30:00";
const PRIMARY_PROXY_LOCAL_TIME = "10:00:00";
const DELAY_PROXY_LOCAL_TIME = "12:00:00";
const EXCLUSION_REASON_NO_ENTRY_CANDLE = "no_entry_candle_at_or_after_proxy_before_same_day_session_end";
const EXCLUSION_REASON_MISSING_SESSION = "missing_snapshot_date_intraday_session";
const EXCLUSION_REASON_INCOMPLETE_SESSION = "incomplete_snapshot_date_intraday_session";

const CHRONOLOGICAL_FOLDS = Object.freeze([
  { key: "TRAIN", start: "2024-01-03", end: "2024-12-31", sealed_from_parameter_selection: false },
  { key: "VALIDATION", start: "2025-01-01", end: "2025-09-30", sealed_from_parameter_selection: false },
  { key: "FINAL_TEST", start: "2025-10-01", end: "2026-04-30", sealed_from_parameter_selection: true }
]);

const ENTRY_SCENARIOS = Object.freeze([
  {
    key: "PRIMARY_10_ET",
    label: "PRIMARY",
    executable: true,
    local_time: PRIMARY_PROXY_LOCAL_TIME,
    use_source_defined_session_open: false,
    report_separately: false
  },
  {
    key: "DELAY_12_ET",
    label: "DELAY_SENSITIVITY",
    executable: true,
    local_time: DELAY_PROXY_LOCAL_TIME,
    use_source_defined_session_open: false,
    report_separately: false
  },
  {
    key: "NON_EXECUTABLE_OPTIMISM_BOUND",
    label: "NON_EXECUTABLE_OPTIMISM_BOUND",
    executable: false,
    local_time: SOURCE_DEFINED_SESSION_OPEN_LOCAL_TIME,
    use_source_defined_session_open: true,
    report_separately: true
  }
]);

const STRATEGY_VARIANTS = Object.freeze([
  {
    key: "PRIMARY",
    target_multiplier_adr20: 0.25,
    stop_multiplier_adr20: 0.25,
    time_exit: "final_available_candle_close_within_source_defined_evaluation_window"
  },
  {
    key: "FULL_DISTANCE",
    target_multiplier_adr20: 0.5,
    stop_multiplier_adr20: 0.5,
    time_exit: "final_available_candle_close_within_source_defined_evaluation_window"
  },
  {
    key: "ASYMMETRIC_SENSITIVITY",
    target_multiplier_adr20: 0.5,
    stop_multiplier_adr20: 0.25,
    time_exit: "final_available_candle_close_within_source_defined_evaluation_window"
  }
]);

const REPORTING_DIMENSIONS = Object.freeze([
  "layer",
  "asset_or_pair",
  "direction",
  "confidence_band",
  "weekday",
  "chronological_fold"
]);

const REQUIRED_METRICS = Object.freeze([
  "trade_count",
  "target_count",
  "stop_count",
  "time_exit_count",
  "win_rate",
  "expectancy",
  "average_return_r",
  "profit_factor",
  "maximum_drawdown",
  "mfe",
  "mae",
  "exclusion_count",
  "same_bar_ambiguity_count"
]);

function relativeRepoPath(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizeTimeLiteral(timeLiteral) {
  return /^\d{2}:\d{2}$/.test(timeLiteral) ? `${timeLiteral}:00` : timeLiteral;
}

function parseDateLiteral(dateLiteral) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateLiteral || ""));
  if (!match) {
    throw new Error(`Expected YYYY-MM-DD date literal, received: ${dateLiteral}`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseTimeLiteral(timeLiteral) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(timeLiteral || ""));
  if (!match) {
    throw new Error(`Expected HH:MM or HH:MM:SS time literal, received: ${timeLiteral}`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]), second: Number(match[3] || "00") };
}

function formatUtcInZone(utcDate, timeZone = IANA_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(utcDate).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function buildEpochLikeMillis(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
}

function zonedTimeToUtc(dateLiteral, timeLiteral, timeZone = IANA_TIME_ZONE) {
  const dateParts = parseDateLiteral(dateLiteral);
  const timeParts = parseTimeLiteral(normalizeTimeLiteral(timeLiteral));
  const targetEpochLike = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    0
  );

  let guess = new Date(targetEpochLike);
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const localParts = formatUtcInZone(guess, timeZone);
    const localEpochLike = buildEpochLikeMillis(localParts);
    const diff = targetEpochLike - localEpochLike;
    if (diff === 0) {
      return guess.toISOString();
    }
    guess = new Date(guess.getTime() + diff);
  }

  const finalParts = formatUtcInZone(guess, timeZone);
  if (
    finalParts.year !== dateParts.year
    || finalParts.month !== dateParts.month
    || finalParts.day !== dateParts.day
    || finalParts.hour !== timeParts.hour
    || finalParts.minute !== timeParts.minute
    || finalParts.second !== timeParts.second
  ) {
    throw new Error(`Unable to resolve ${dateLiteral} ${timeLiteral} in ${timeZone}`);
  }
  return guess.toISOString();
}

function assignChronologicalFold(evaluationDate) {
  return CHRONOLOGICAL_FOLDS.find((fold) => evaluationDate >= fold.start && evaluationDate <= fold.end)?.key || null;
}

function loadSourceArtifact() {
  return JSON.parse(fs.readFileSync(SOURCE_ARTIFACT_PATH, "utf8"));
}

function getEligibleRows(sourceArtifact) {
  const allRows = Array.isArray(sourceArtifact?.row_level?.all) ? sourceArtifact.row_level.all : [];
  return allRows.filter((row) => row.status === "ELIGIBLE");
}

function groupCount(rows, keyBuilder) {
  return rows.reduce((acc, row) => {
    const key = keyBuilder(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildDraftContract(sourceArtifact) {
  const eligibleRows = getEligibleRows(sourceArtifact);
  const eligibleLayer1Rows = eligibleRows.filter((row) => row.layer === "LAYER_1");
  const eligibleLayer2Rows = eligibleRows.filter((row) => row.layer === "LAYER_2");
  const uniquePredictionIds = new Set(eligibleRows.map((row) => String(row.predictionId || "")).filter(Boolean));
  const sourceAudit = Array.isArray(sourceArtifact?.source_audit) ? sourceArtifact.source_audit : [];

  return {
    meta: {
      version: DRAFT_CONTRACT_VERSION,
      generated_at: new Date().toISOString(),
      source: "backtester/scripts/validate_half_l2l_executable_entry_draft.js",
      research_only: true,
      status: "DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION",
      time_zone: IANA_TIME_ZONE,
      profitability_execution_blocked_until_costs_approved: true,
      prohibits_parameter_selection_using_final_test: true
    },
    lineage: {
      source_artifact_path: relativeRepoPath(SOURCE_ARTIFACT_PATH),
      source_artifact_version: sourceArtifact?.meta?.version || null,
      source_artifact_sha256: hashFile(SOURCE_ARTIFACT_PATH),
      publication_time_recovery_decision: "PROXY_REQUIRED",
      publication_time_recovery_evidence: "tmp/half-l2l-publication-time-recovery-followup-20260815.json",
      preserved_candle_source_hashes: sourceAudit.map((row) => ({
        assetCode: row.assetCode,
        dailySourcePath: row.dailySourcePath,
        intradaySourcePath: row.intradaySourcePath,
        dailySourceHash: row.dailySourceHash?.sha256 || null,
        intradaySourceHash: row.intradaySourceHash?.sha256 || null
      }))
    },
    source_population: {
      eligible_row_count: eligibleRows.length,
      eligible_layer1_row_count: eligibleLayer1Rows.length,
      eligible_layer2_row_count: eligibleLayer2Rows.length,
      unique_prediction_id_count_across_layers: uniquePredictionIds.size,
      duplicated_prediction_ids_not_independent_evidence: eligibleRows.length - uniquePredictionIds.size,
      populations_must_remain_separate: true,
      use_existing_prior_20_bar_adr20_without_future_information: true,
      layer1_asset_counts: groupCount(eligibleLayer1Rows, (row) => row.entityCode),
      layer2_pair_counts: groupCount(eligibleLayer2Rows, (row) => row.entityCode)
    },
    entry_scenarios: {
      executable_proxy_selection_rule: "Enter at the open of the first available 1H candle whose opening timestamp is at or after the proxy timestamp. Exclude all earlier candles.",
      no_later_trading_day_roll_rule: true,
      exclusion_reason_if_no_entry_candle_exists: EXCLUSION_REASON_NO_ENTRY_CANDLE,
      scenarios: ENTRY_SCENARIOS.map((scenario) => ({
        ...scenario,
        time_zone: IANA_TIME_ZONE,
        source_defined_session_open_lineage: scenario.use_source_defined_session_open
          ? "following-24hrs source window open at 09:30 America/New_York, handled by date using IANA timezone"
          : null
      }))
    },
    strategy_variants: {
      frozen_before_outcome_calculation: true,
      variants: STRATEGY_VARIANTS
    },
    ohlc_sequencing: {
      entry_price_rule: "selected_candle_open",
      ignore_pre_entry_movement: true,
      start_target_stop_evaluation_after_entry_only: true,
      same_bar_target_and_stop_resolution: "STOP_FIRST_PESSIMISTIC",
      apply_same_convention_to_entry_candle: true,
      record_same_bar_ambiguity_explicitly: true
    },
    evaluation_design: {
      folds: CHRONOLOGICAL_FOLDS,
      final_test_must_remain_sealed_for_parameter_decisions: true,
      required_reporting_dimensions: REPORTING_DIMENSIONS,
      required_metrics: REQUIRED_METRICS
    },
    costs: {
      approved_for_profitability_execution: false,
      fields_must_be_configured_separately_by_asset: {
        EUR: { spread: null, commission: null, slippage: null },
        GOLD: { spread: null, commission: null, slippage: null },
        NQ: { spread: null, commission: null, slippage: null },
        BTC: { spread: null, commission: null, slippage: null }
      },
      gross_result_baselines_required: true
    },
    implementation_scope: {
      this_draft_only: true,
      no_changes_to_existing_half_l2l_excursion_contract: true,
      no_trade_ledger_or_profitability_backtest_in_this_phase: true
    }
  };
}

function validateDraftContract(contract, sourceArtifact) {
  const errors = [];
  const eligibleRows = getEligibleRows(sourceArtifact);
  const eligibleLayer1Rows = eligibleRows.filter((row) => row.layer === "LAYER_1");
  const eligibleLayer2Rows = eligibleRows.filter((row) => row.layer === "LAYER_2");
  const uniquePredictionIds = new Set(eligibleRows.map((row) => String(row.predictionId || "")).filter(Boolean));

  if (contract?.meta?.version !== DRAFT_CONTRACT_VERSION) {
    errors.push(`Draft contract version must be ${DRAFT_CONTRACT_VERSION}`);
  }
  if (contract?.source_population?.eligible_row_count !== eligibleRows.length) {
    errors.push(`Expected ${eligibleRows.length} eligible rows, found ${contract?.source_population?.eligible_row_count}`);
  }
  if (contract?.source_population?.eligible_layer1_row_count !== eligibleLayer1Rows.length) {
    errors.push(`Expected ${eligibleLayer1Rows.length} Layer 1 rows, found ${contract?.source_population?.eligible_layer1_row_count}`);
  }
  if (contract?.source_population?.eligible_layer2_row_count !== eligibleLayer2Rows.length) {
    errors.push(`Expected ${eligibleLayer2Rows.length} Layer 2 rows, found ${contract?.source_population?.eligible_layer2_row_count}`);
  }
  if (contract?.source_population?.unique_prediction_id_count_across_layers !== uniquePredictionIds.size) {
    errors.push(`Expected ${uniquePredictionIds.size} unique prediction IDs, found ${contract?.source_population?.unique_prediction_id_count_across_layers}`);
  }
  if (!Array.isArray(contract?.entry_scenarios?.scenarios) || contract.entry_scenarios.scenarios.length !== 3) {
    errors.push("Draft contract must freeze exactly three entry scenarios.");
  }
  if (!Array.isArray(contract?.strategy_variants?.variants) || contract.strategy_variants.variants.length !== 3) {
    errors.push("Draft contract must freeze exactly three strategy variants.");
  }
  if (JSON.stringify(contract?.evaluation_design?.folds || []) !== JSON.stringify(CHRONOLOGICAL_FOLDS)) {
    errors.push("Chronological folds did not match the frozen train/validation/final-test ranges.");
  }
  if (contract?.costs?.approved_for_profitability_execution !== false) {
    errors.push("Draft contract must remain blocked from profitability execution until costs are approved.");
  }
  return errors;
}

function getScenarioProxyUtc(row, scenario) {
  const localTime = scenario.use_source_defined_session_open
    ? SOURCE_DEFINED_SESSION_OPEN_LOCAL_TIME
    : scenario.local_time;
  return zonedTimeToUtc(row.snapshotDate, localTime, IANA_TIME_ZONE);
}

function selectEntryCandle(sessionCandles, proxyUtcIso, evaluationEndTimeUtcIso) {
  if (!sessionCandles.length) {
    return {
      entryCandle: null,
      exclusionReason: EXCLUSION_REASON_MISSING_SESSION
    };
  }
  if (sessionCandles.some((candle) => !candle.complete)) {
    return {
      entryCandle: null,
      exclusionReason: EXCLUSION_REASON_INCOMPLETE_SESSION
    };
  }

  const proxyMillis = Date.parse(proxyUtcIso);
  const evaluationEndMillis = Date.parse(evaluationEndTimeUtcIso);
  const entryCandle = sessionCandles.find((candle) => {
    const candleMillis = Date.parse(candle.timestamp);
    return candleMillis >= proxyMillis && candleMillis < evaluationEndMillis;
  }) || null;

  if (!entryCandle) {
    return {
      entryCandle: null,
      exclusionReason: EXCLUSION_REASON_NO_ENTRY_CANDLE
    };
  }

  return {
    entryCandle,
    exclusionReason: null
  };
}

function loadIntradayContextsFromSourceArtifact(sourceArtifact) {
  const sourceAudit = Array.isArray(sourceArtifact?.source_audit) ? sourceArtifact.source_audit : [];
  return Object.fromEntries(sourceAudit
    .filter((row) => row.available && row.intradaySourcePath)
    .map((row) => {
      const filePath = path.join(REPO_ROOT, row.intradaySourcePath);
      return [
        row.assetCode,
        loadIntradayOhlc(filePath, {
          instrument: row.instrument,
          source: row.candleSourceLabel
        })
      ];
    }));
}

function resolveUnderlyingAssetCode(row) {
  return row.layer === "LAYER_2" ? row.targetAssetCode : row.entityCode;
}

function summarizeCounts(rows, fieldName) {
  const counts = {};
  rows.forEach((row) => {
    const key = String(row[fieldName] || "UNKNOWN");
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function buildDryRunCoverageReport(sourceArtifact, contract) {
  const eligibleRows = getEligibleRows(sourceArtifact);
  const intradayContexts = loadIntradayContextsFromSourceArtifact(sourceArtifact);
  const scenarioReports = ENTRY_SCENARIOS.map((scenario) => {
    const perRow = eligibleRows.map((row) => {
      const assetCode = resolveUnderlyingAssetCode(row);
      const sessionCandles = intradayContexts[assetCode]?.byDate?.get(row.snapshotDate) || [];
      const proxyUtcIso = getScenarioProxyUtc(row, scenario);
      const selection = selectEntryCandle(sessionCandles, proxyUtcIso, row.evaluationEndTime);
      return {
        recordId: row.recordId,
        predictionId: row.predictionId,
        layer: row.layer,
        entityCode: row.entityCode,
        assetCode,
        snapshotDate: row.snapshotDate,
        evaluationDate: row.evaluationDate,
        fold: assignChronologicalFold(row.evaluationDate),
        direction: row.callDirection,
        confidenceBand: row.strengthBucket,
        weekday: row.weekdayKey,
        proxyUtcIso,
        entryCandleTime: selection.entryCandle?.timestamp || null,
        entryPrice: Number.isFinite(selection.entryCandle?.open) ? selection.entryCandle.open : null,
        exclusionReason: selection.exclusionReason
      };
    });

    const includedRows = perRow.filter((row) => !row.exclusionReason);
    const excludedRows = perRow.filter((row) => row.exclusionReason);

    return {
      scenario_key: scenario.key,
      executable: scenario.executable,
      included_row_count: includedRows.length,
      excluded_row_count: excludedRows.length,
      included_pct: eligibleRows.length ? Number(((includedRows.length / eligibleRows.length) * 100).toFixed(2)) : 0,
      exclusion_reasons: summarizeCounts(excludedRows, "exclusionReason"),
      by_layer: summarizeCounts(includedRows, "layer"),
      by_asset_code: summarizeCounts(includedRows, "assetCode"),
      by_fold: summarizeCounts(includedRows, "fold"),
      sample_rows: perRow.slice(0, 12)
    };
  });

  return {
    generated_at: new Date().toISOString(),
    contract_version: contract.meta.version,
    source_artifact_path: relativeRepoPath(SOURCE_ARTIFACT_PATH),
    eligible_rows: eligibleRows.length,
    unique_prediction_ids: new Set(eligibleRows.map((row) => String(row.predictionId || "")).filter(Boolean)).size,
    scenarios: scenarioReports
  };
}

module.exports = {
  CHRONOLOGICAL_FOLDS,
  DRAFT_CONTRACT_PATH,
  DRAFT_CONTRACT_VERSION,
  ENTRY_SCENARIOS,
  EXCLUSION_REASON_INCOMPLETE_SESSION,
  EXCLUSION_REASON_MISSING_SESSION,
  EXCLUSION_REASON_NO_ENTRY_CANDLE,
  IANA_TIME_ZONE,
  PRIMARY_PROXY_LOCAL_TIME,
  DELAY_PROXY_LOCAL_TIME,
  SOURCE_ARTIFACT_PATH,
  SOURCE_DEFINED_SESSION_OPEN_LOCAL_TIME,
  STRATEGY_VARIANTS,
  assignChronologicalFold,
  buildDryRunCoverageReport,
  buildDraftContract,
  getEligibleRows,
  getScenarioProxyUtc,
  loadSourceArtifact,
  selectEntryCandle,
  validateDraftContract,
  zonedTimeToUtc
};
