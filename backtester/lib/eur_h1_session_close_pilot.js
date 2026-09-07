"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { loadIntradayOhlc } = require("./adr_reach_research");
const { buildSessionCloseDataset } = require("./l2l_session_close_dataset_builder");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_INPUT_PATH = path.join(REPO_ROOT, "backtester/tmp/oanda_eur_usd_h1.csv");
const DEFAULT_OUTPUT_PATH = path.join(REPO_ROOT, "data/l2l-session-close-eur-h1-ta-v1.json");
const PILOT_VERSION = "l2l-session-close-eur-h1-ta-v1";
const DECISION_LEAD_MINUTES = 5;
const REQUIRED_HISTORY_HOURS = 25;

function round(value, decimals = 8) {
  return Number.isFinite(value) ? Number(value.toFixed(decimals)) : null;
}

function millis(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  return new Date(value).toISOString();
}

function isHourlyContiguous(candles) {
  return candles.every((candle, index) => index === 0 || millis(candle.timestamp) - millis(candles[index - 1].timestamp) === 60 * 60 * 1000);
}

function buildFeatureSet(history) {
  const latest = history[history.length - 1];
  const close = latest.close;
  const closeAt = iso(millis(latest.timestamp) + 60 * 60 * 1000);
  const closeAtOffset = (hours) => history[history.length - 1 - hours].close;
  const returnOver = (hours) => round(((close / closeAtOffset(hours)) - 1) * 100, 6);
  const window = history.slice(-24);
  const highs = window.map((candle) => candle.high);
  const lows = window.map((candle) => candle.low);
  const closes = window.map((candle) => candle.close);
  const meanClose = closes.reduce((sum, value) => sum + value, 0) / closes.length;

  return [
    { name: "eurusd_h1_return_1h_pct", value: returnOver(1), availableAtUtc: closeAt },
    { name: "eurusd_h1_return_4h_pct", value: returnOver(4), availableAtUtc: closeAt },
    { name: "eurusd_h1_return_12h_pct", value: returnOver(12), availableAtUtc: closeAt },
    { name: "eurusd_h1_return_24h_pct", value: returnOver(24), availableAtUtc: closeAt },
    { name: "eurusd_h1_range_24h_pct", value: round(((Math.max(...highs) - Math.min(...lows)) / close) * 100, 6), availableAtUtc: closeAt },
    { name: "eurusd_h1_close_vs_24h_mean_pct", value: round(((close / meanClose) - 1) * 100, 6), availableAtUtc: closeAt }
  ];
}

function buildRawPilotRecords(intradayContext) {
  const allCandles = intradayContext.records;
  const rawRecords = [];
  const sourceExclusions = [];

  for (const [sessionDate, sessionCandles] of intradayContext.byDate.entries()) {
    const sessionStart = sessionCandles[0];
    const sessionEnd = sessionCandles[sessionCandles.length - 1];
    const sessionStartMillis = millis(sessionStart?.timestamp);
    if (!sessionStartMillis || !sessionCandles.every((candle) => candle.complete) || !isHourlyContiguous(sessionCandles)) {
      sourceExclusions.push({ sessionDate, reason: "incomplete_or_non_contiguous_session" });
      continue;
    }

    const decisionTimeMillis = sessionStartMillis - DECISION_LEAD_MINUTES * 60 * 1000;
    const history = allCandles.filter((candle) => millis(candle.timestamp) + 60 * 60 * 1000 <= decisionTimeMillis).slice(-REQUIRED_HISTORY_HOURS);
    if (history.length !== REQUIRED_HISTORY_HOURS || !isHourlyContiguous(history)) {
      sourceExclusions.push({ sessionDate, reason: "insufficient_contiguous_pre_session_history" });
      continue;
    }

    rawRecords.push({
      recordId: `EUR-H1-TA|${sessionDate}`,
      assetCode: "EUR",
      instrument: "EUR_USD",
      sessionDate,
      sessionStartTimeUtc: iso(sessionStartMillis),
      sessionEndTimeUtc: iso(millis(sessionEnd.timestamp) + 60 * 60 * 1000),
      decisionTimeUtc: iso(decisionTimeMillis),
      sessionOpenPrice: sessionStart.open,
      sessionClosePrice: sessionEnd.close,
      features: buildFeatureSet(history)
    });
  }

  return { rawRecords, sourceExclusions };
}

function buildEurH1Pilot(inputPath = DEFAULT_INPUT_PATH) {
  const context = loadIntradayOhlc(inputPath, { instrument: "EUR_USD", source: "OANDA v20 candles" });
  const { rawRecords, sourceExclusions } = buildRawPilotRecords(context);
  const dataset = buildSessionCloseDataset(rawRecords, {
    description: "EUR/USD OANDA H1 technical-feature pilot. Every feature is computed from candles completed before the pre-session cutoff.",
    artifactPaths: [path.relative(REPO_ROOT, inputPath).replace(/\\/g, "/")]
  });

  return {
    ...dataset,
    meta: { ...dataset.meta, pilotVersion: PILOT_VERSION, pilotAsset: "EUR", modelTrained: false },
    sourceAudit: {
      inputPath: path.relative(REPO_ROOT, inputPath).replace(/\\/g, "/"),
      inputSha256: crypto.createHash("sha256").update(fs.readFileSync(inputPath)).digest("hex"),
      candleSource: context.source,
      coverageStart: context.coverageStart,
      coverageEnd: context.coverageEnd,
      sourceExcludedRecordCount: sourceExclusions.length,
      sourceExclusions
    }
  };
}

module.exports = {
  DEFAULT_INPUT_PATH,
  DEFAULT_OUTPUT_PATH,
  PILOT_VERSION,
  buildEurH1Pilot,
  buildFeatureSet,
  buildRawPilotRecords,
  isHourlyContiguous
};
