const fs = require("fs");
const { parseDelimited } = require("./historical_common");

const WEEKDAY_KEYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const CONFIDENCE_BUCKETS = [
  { key: "WEAK", label: "Weak", min: 0, max: 49 },
  { key: "MODERATE", label: "Moderate", min: 50, max: 64 },
  { key: "STRONG", label: "Strong", min: 65, max: 79 },
  { key: "VERY_STRONG", label: "Very Strong", min: 80, max: 100 }
];
const REASON_LABELS = {
  missing_intraday_session: "Missing 1H session candles",
  incomplete_intraday_session: "Incomplete 1H session candles",
  missing_daily_adr20: "Missing ADR20 daily history",
  invalid_daily_adr20: "Invalid ADR20 daily history",
  invalid_required_l2l_distance: "Invalid required L2L distance",
  missing_confidence_bucket: "Missing confidence bucket",
  missing_evaluation_date: "Missing evaluation date",
  missing_usd_snapshot: "Missing USD snapshot",
  missing_combined_confidence: "Missing combined confidence",
  missing_target_asset_row: "Missing target asset evaluation row",
  no_trade_or_non_directional_rows: "No tradable directional signal",
  unsupported_weekday: "Unsupported weekday",
  unsupported_instrument_rows: "Unsupported instrument"
};

function roundNumber(value, decimals = 8) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function parseConfidenceCandidate(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeHeadlineConfidence(row) {
  const candidates = [
    row?.stored?.displayed_headline_confidence_pct,
    row?.stored?.headline_confidence_pct,
    row?.checker?.displayed_headline_confidence_pct,
    row?.checker?.headline_confidence_pct
  ];

  for (const candidate of candidates) {
    const numeric = parseConfidenceCandidate(candidate);
    if (!Number.isFinite(numeric)) continue;
    if (numeric >= 0.5 && numeric <= 1) return numeric * 100;
    if (numeric >= 0 && numeric <= 100) return numeric;
  }

  return null;
}

function bucketKeyFromConfidence(confidence) {
  const numeric = Number(confidence);
  if (!Number.isFinite(numeric)) return null;
  const clamped = Math.max(0, Math.min(100, numeric));
  return CONFIDENCE_BUCKETS.find((bucket) => clamped >= bucket.min && clamped <= bucket.max)?.key || null;
}

function bucketLabelFromKey(bucketKey) {
  return CONFIDENCE_BUCKETS.find((bucket) => bucket.key === bucketKey)?.label || bucketKey;
}

function weekdayFromDate(dateValue) {
  const value = String(dateValue || "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return WEEKDAY_KEYS[parsed.getUTCDay()] || null;
}

function createOutcomeCell() {
  return { total: 0, wins: 0, losses: 0 };
}

function addOutcome(cell, outcomeKey) {
  cell.total += 1;
  if (outcomeKey === "WIN") {
    cell.wins += 1;
  } else {
    cell.losses += 1;
  }
}

function summarizeOutcomeCell(cell = {}) {
  const total = Number(cell.total || 0);
  const wins = Number(cell.wins || 0);
  const losses = Number(cell.losses || 0);
  return {
    total,
    wins,
    losses,
    winRatePct: total ? Number(((wins / total) * 100).toFixed(1)) : null
  };
}

function sumOutcomeCells(cells = []) {
  return summarizeOutcomeCell(cells.reduce((aggregate, cell) => {
    aggregate.total += Number(cell?.total || 0);
    aggregate.wins += Number(cell?.wins || 0);
    aggregate.losses += Number(cell?.losses || 0);
    return aggregate;
  }, createOutcomeCell()));
}

function buildCellMap(keys = []) {
  return Object.fromEntries(keys.map((key) => [key, createOutcomeCell()]));
}

function normalizeLayer1Direction(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized.startsWith("BULLISH")) return "BULLISH";
  if (normalized.startsWith("BEARISH")) return "BEARISH";
  return null;
}

function normalizeExactDirectionalSignal(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "BULLISH" || normalized === "BEARISH") return normalized;
  return null;
}

function normalizeCandleRow(rawRow = {}, fallbackInstrument = null, fallbackSource = null) {
  const timestamp = String(
    rawRow.timestamp
    || rawRow.datetime
    || rawRow.time
    || rawRow.open_time
    || rawRow.openTime
    || ""
  ).trim();
  const date = String(rawRow.date || (timestamp ? timestamp.slice(0, 10) : "")).trim();
  const instrument = String(
    rawRow.instrument
    || rawRow.source_symbol
    || rawRow.symbol
    || fallbackInstrument
    || ""
  ).trim();
  const source = String(rawRow.source || fallbackSource || "").trim();
  const completeRaw = String(rawRow.complete || "").trim().toLowerCase();
  const complete = completeRaw
    ? !["false", "0", "no", "n", "incomplete"].includes(completeRaw)
    : true;

  return {
    instrument: instrument || null,
    timestamp: timestamp || (date ? `${date}T00:00:00Z` : null),
    date,
    open: Number(rawRow.open),
    high: Number(rawRow.high),
    low: Number(rawRow.low),
    close: Number(rawRow.close),
    source: source || null,
    complete
  };
}

function normalizeCandleRows(filePath, options = {}) {
  return parseDelimited(fs.readFileSync(filePath, "utf8"))
    .map((row) => normalizeCandleRow(row, options.instrument, options.source))
    .filter((row) =>
      row.date
      && row.timestamp
      && Number.isFinite(row.open)
      && Number.isFinite(row.high)
      && Number.isFinite(row.low)
      && Number.isFinite(row.close)
    )
    .sort((a, b) => {
      const left = `${a.date}|${a.timestamp}`;
      const right = `${b.date}|${b.timestamp}`;
      return left.localeCompare(right);
    });
}

function loadDailyOhlc(filePath, options = {}) {
  const records = normalizeCandleRows(filePath, options);
  const byDate = new Map();
  records.forEach((record) => {
    byDate.set(record.date, record);
  });

  const collapsed = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const weekdayCounts = collapsed.reduce((counts, record) => {
    const weekdayKey = weekdayFromDate(record.date);
    if (weekdayKey) counts[weekdayKey] = (counts[weekdayKey] || 0) + 1;
    return counts;
  }, {});
  const weekendRowCount = Number(weekdayCounts.SATURDAY || 0) + Number(weekdayCounts.SUNDAY || 0);

  return {
    records: collapsed,
    byDate,
    coverageStart: collapsed[0]?.date || null,
    coverageEnd: collapsed[collapsed.length - 1]?.date || null,
    weekdayCounts,
    weekendRowCount,
    instrument: collapsed[0]?.instrument || options.instrument || null,
    source: collapsed[0]?.source || options.source || null
  };
}

function loadIntradayOhlc(filePath, options = {}) {
  const records = normalizeCandleRows(filePath, options);
  const byDate = new Map();
  records.forEach((record) => {
    const existing = byDate.get(record.date) || [];
    existing.push(record);
    byDate.set(record.date, existing);
  });

  byDate.forEach((session) => {
    session.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  });

  const weekdayCounts = Array.from(byDate.keys()).reduce((counts, date) => {
    const weekdayKey = weekdayFromDate(date);
    if (weekdayKey) counts[weekdayKey] = (counts[weekdayKey] || 0) + 1;
    return counts;
  }, {});
  const weekendRowCount = Number(weekdayCounts.SATURDAY || 0) + Number(weekdayCounts.SUNDAY || 0);

  return {
    records,
    byDate,
    coverageStart: records[0]?.date || null,
    coverageEnd: records[records.length - 1]?.date || null,
    sessionCount: byDate.size,
    candleCount: records.length,
    weekdayCounts,
    weekendRowCount,
    instrument: records[0]?.instrument || options.instrument || null,
    source: records[0]?.source || options.source || null
  };
}

function computeAdr20(dailyContext, evaluationDate) {
  const priorRecords = dailyContext.records.filter((record) => record.date < evaluationDate);
  if (priorRecords.length < 20) {
    return {
      ok: false,
      reason: "missing_daily_adr20"
    };
  }

  const window = priorRecords.slice(-20);
  const ranges = window.map((record) => record.high - record.low).filter((value) => Number.isFinite(value) && value > 0);
  if (ranges.length !== 20) {
    return {
      ok: false,
      reason: "invalid_daily_adr20"
    };
  }

  const adr20 = ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
  if (!(adr20 > 0)) {
    return {
      ok: false,
      reason: "invalid_daily_adr20"
    };
  }

  return {
    ok: true,
    adr20,
    windowStartDate: window[0]?.date || null,
    windowEndDate: window[window.length - 1]?.date || null,
    sessionCount: window.length
  };
}

function buildRequiredDistanceInputs(config, dailyContext, intradayContext, evaluationDate) {
  const sessionCandles = intradayContext.byDate.get(evaluationDate) || [];
  if (!sessionCandles.length) {
    return {
      ok: false,
      reason: "missing_intraday_session",
      numberOf1hCandlesLoaded: 0,
      fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
    };
  }

  if (sessionCandles.some((candle) => !candle.complete)) {
    return {
      ok: false,
      reason: "incomplete_intraday_session",
      numberOf1hCandlesLoaded: sessionCandles.length,
      fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
    };
  }

  const adrResult = computeAdr20(dailyContext, evaluationDate);
  if (!adrResult.ok) {
    return {
      ok: false,
      reason: adrResult.reason,
      numberOf1hCandlesLoaded: sessionCandles.length,
      fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
    };
  }

  const requiredL2lDistance = adrResult.adr20 * 0.5;
  if (!(requiredL2lDistance > 0)) {
    return {
      ok: false,
      reason: "invalid_required_l2l_distance",
      numberOf1hCandlesLoaded: sessionCandles.length,
      adr20: adrResult.adr20,
      fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null
    };
  }

  return {
    ok: true,
    sessionCandles,
    numberOf1hCandlesLoaded: sessionCandles.length,
    adr20: adrResult.adr20,
    adr20WindowStartDate: adrResult.windowStartDate,
    adr20WindowEndDate: adrResult.windowEndDate,
    requiredL2lDistance,
    fixedReferenceL2lDistance: config.fixedReferenceL2lDistance ?? null,
    candleSource: config.candleSourceLabel,
    instrumentSymbol: intradayContext.instrument || dailyContext.instrument || config.instrument || null
  };
}

function evaluateL2lSequence(directionKey, inputs) {
  const sessionCandles = Array.isArray(inputs?.sessionCandles) ? inputs.sessionCandles : [];
  if (!sessionCandles.length) {
    return {
      reached: null,
      margin: null,
      triggerSwingPrice: null,
      triggerCandleTime: null,
      triggerPrice: null
    };
  }

  if (directionKey === "BULLISH") {
    let lowestLowSoFar = null;
    let bestMargin = Number.NEGATIVE_INFINITY;

    for (const candle of sessionCandles) {
      if (Number.isFinite(lowestLowSoFar)) {
        const threshold = lowestLowSoFar + inputs.requiredL2lDistance;
        const margin = candle.high - threshold;
        if (margin > bestMargin) bestMargin = margin;
        if (margin >= 0) {
          return {
            reached: true,
            margin: roundNumber(margin),
            triggerSwingPrice: roundNumber(lowestLowSoFar),
            triggerCandleTime: candle.timestamp,
            triggerPrice: roundNumber(threshold)
          };
        }
      }

      if (!Number.isFinite(lowestLowSoFar) || candle.low < lowestLowSoFar) {
        lowestLowSoFar = candle.low;
      }
    }

    return {
      reached: false,
      margin: Number.isFinite(bestMargin) ? roundNumber(bestMargin) : null,
      triggerSwingPrice: null,
      triggerCandleTime: null,
      triggerPrice: null
    };
  }

  let highestHighSoFar = null;
  let bestMargin = Number.NEGATIVE_INFINITY;

  for (const candle of sessionCandles) {
    if (Number.isFinite(highestHighSoFar)) {
      const threshold = highestHighSoFar - inputs.requiredL2lDistance;
      const margin = threshold - candle.low;
      if (margin > bestMargin) bestMargin = margin;
      if (margin >= 0) {
        return {
          reached: true,
          margin: roundNumber(margin),
          triggerSwingPrice: roundNumber(highestHighSoFar),
          triggerCandleTime: candle.timestamp,
          triggerPrice: roundNumber(threshold)
        };
      }
    }

    if (!Number.isFinite(highestHighSoFar) || candle.high > highestHighSoFar) {
      highestHighSoFar = candle.high;
    }
  }

  return {
    reached: false,
    margin: Number.isFinite(bestMargin) ? roundNumber(bestMargin) : null,
    triggerSwingPrice: null,
    triggerCandleTime: null,
    triggerPrice: null
  };
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || null;
}

module.exports = {
  CONFIDENCE_BUCKETS,
  WEEKDAY_KEYS,
  addOutcome,
  bucketKeyFromConfidence,
  bucketLabelFromKey,
  buildCellMap,
  buildRequiredDistanceInputs,
  computeAdr20,
  createOutcomeCell,
  evaluateL2lSequence,
  loadDailyOhlc,
  loadIntradayOhlc,
  normalizeExactDirectionalSignal,
  normalizeHeadlineConfidence,
  normalizeLayer1Direction,
  normalizeCandleRow,
  reasonLabel,
  roundNumber,
  summarizeOutcomeCell,
  sumOutcomeCells,
  weekdayFromDate
};
