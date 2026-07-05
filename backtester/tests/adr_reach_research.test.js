const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildLayer1AssetResearch,
  buildLayer2PairResearch
} = require("../scripts/validate_adr_reach_research");
const {
  buildRequiredDistanceInputs,
  evaluateL2lSequence
} = require("../lib/adr_reach_research");

function createDailyContext(records) {
  const sorted = records.slice().sort((a, b) => a.date.localeCompare(b.date));
  return {
    records: sorted,
    byDate: new Map(sorted.map((record) => [record.date, record])),
    coverageStart: sorted[0]?.date || null,
    coverageEnd: sorted[sorted.length - 1]?.date || null,
    weekdayCounts: {},
    weekendRowCount: 0,
    instrument: "TEST",
    source: "test"
  };
}

function createIntradayContext(sessionByDate) {
  const entries = Object.entries(sessionByDate).sort(([left], [right]) => left.localeCompare(right));
  const records = entries.flatMap(([, rows]) => rows);
  return {
    records,
    byDate: new Map(entries),
    coverageStart: entries[0]?.[0] || null,
    coverageEnd: entries[entries.length - 1]?.[0] || null,
    sessionCount: entries.length,
    candleCount: records.length,
    weekdayCounts: {},
    weekendRowCount: 0,
    instrument: "TEST",
    source: "test"
  };
}

function createCheckerRow({
  predictionId,
  snapshotDate,
  direction,
  confidence,
  closeDate
}) {
  return {
    prediction_id: predictionId,
    snapshot_date: snapshotDate,
    stored: {
      direction,
      displayed_headline_confidence_pct: confidence,
      headline_confidence_pct: confidence,
      evaluation_result: "CORRECT"
    },
    checker: {
      direction,
      displayed_headline_confidence_pct: confidence,
      headline_confidence_pct: confidence,
      evaluation_result: "CORRECT"
    },
    evaluation_inputs: {
      open_price: 100,
      close_price: 105,
      close_date: closeDate
    }
  };
}

function createDailySeries(startDate = "2024-01-01", count = 25, base = 100, range = 10) {
  const rows = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  while (rows.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const date = cursor.toISOString().slice(0, 10);
      rows.push({
        instrument: "TEST",
        date,
        open: base,
        high: base + range,
        low: base,
        close: base + 1,
        source: "test",
        complete: true
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
}

function createInputs(sessionRowsByDate, evaluationDate = "2024-02-06") {
  const dailyContext = createDailyContext(createDailySeries());
  const intradayContext = createIntradayContext({
    [evaluationDate]: sessionRowsByDate
  });

  return buildRequiredDistanceInputs({
    instrument: "TEST",
    candleSourceLabel: "test",
    fixedReferenceL2lDistance: 5
  }, dailyContext, intradayContext, evaluationDate);
}

test("bullish low first then later high reaching low plus l2l is a win", () => {
  const inputs = createInputs([
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 105, high: 106, low: 100, close: 101, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 101, high: 106, low: 101, close: 105, source: "test", complete: true }
  ]);

  const result = evaluateL2lSequence("BULLISH", { ...inputs, requiredL2lDistance: 5 });
  assert.equal(result.reached, true);
  assert.equal(result.triggerSwingPrice, 100);
  assert.equal(result.triggerCandleTime, "2024-02-06T10:00:00Z");
  assert.equal(result.triggerPrice, 105);
});

test("bullish high first then low with no later recovery is a miss", () => {
  const inputs = createInputs([
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 104, high: 108, low: 104, close: 107, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 107, high: 107.5, low: 100, close: 101, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T11:00:00Z", date: "2024-02-06", open: 101, high: 103, low: 101, close: 102, source: "test", complete: true }
  ]);

  const result = evaluateL2lSequence("BULLISH", { ...inputs, requiredL2lDistance: 5 });
  assert.equal(result.reached, false);
  assert.ok(result.margin < 0);
});

test("bearish high first then later low reaching high minus l2l is a win", () => {
  const inputs = createInputs([
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 110, low: 108, close: 109, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 109, high: 109, low: 104, close: 105, source: "test", complete: true }
  ]);

  const result = evaluateL2lSequence("BEARISH", { ...inputs, requiredL2lDistance: 5 });
  assert.equal(result.reached, true);
  assert.equal(result.triggerSwingPrice, 110);
  assert.equal(result.triggerCandleTime, "2024-02-06T10:00:00Z");
  assert.equal(result.triggerPrice, 105);
});

test("bearish low first then high with no later selloff is a miss", () => {
  const inputs = createInputs([
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 102, high: 103, low: 98, close: 99, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 99, high: 110, low: 100, close: 109, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T11:00:00Z", date: "2024-02-06", open: 109, high: 109, low: 106, close: 107, source: "test", complete: true }
  ]);

  const result = evaluateL2lSequence("BEARISH", { ...inputs, requiredL2lDistance: 5 });
  assert.equal(result.reached, false);
  assert.ok(result.margin < 0);
});

test("close does not matter", () => {
  const inputs = createInputs([
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 150, high: 151, low: 100, close: 149, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 149, high: 105, low: 100, close: 100.01, source: "test", complete: true }
  ]);

  const result = evaluateL2lSequence("BULLISH", { ...inputs, requiredL2lDistance: 5 });
  assert.equal(result.reached, true);
});

test("open does not matter", () => {
  const inputs = createInputs([
    { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 999, high: 110, low: 108, close: 109, source: "test", complete: true },
    { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 998, high: 109, low: 104, close: 105, source: "test", complete: true }
  ]);

  const result = evaluateL2lSequence("BEARISH", { ...inputs, requiredL2lDistance: 5 });
  assert.equal(result.reached, true);
});

test("missing candles are not evaluated", () => {
  const dailyContext = createDailyContext(createDailySeries());
  const intradayContext = createIntradayContext({});
  const inputs = buildRequiredDistanceInputs({
    instrument: "TEST",
    candleSourceLabel: "test",
    fixedReferenceL2lDistance: 5
  }, dailyContext, intradayContext, "2024-02-06");

  assert.equal(inputs.ok, false);
  assert.equal(inputs.reason, "missing_intraday_session");
});

test("sequence research groups layer1 assets and layer2 strength buckets", () => {
  const checker = {
    rows: [
      createCheckerRow({
        predictionId: "eur-1",
        snapshotDate: "2024-02-06",
        direction: "BULLISH",
        confidence: 42,
        closeDate: "2024-02-06"
      }),
      createCheckerRow({
        predictionId: "eur-2",
        snapshotDate: "2024-02-07",
        direction: "BEARISH",
        confidence: 72,
        closeDate: "2024-02-07"
      })
    ],
    summary: { rows_checked: 2 }
  };
  const usdChecker = {
    rows: [
      createCheckerRow({
        predictionId: "usd-1",
        snapshotDate: "2024-02-06",
        direction: "BEARISH",
        confidence: 86,
        closeDate: "2024-02-06"
      }),
      createCheckerRow({
        predictionId: "usd-2",
        snapshotDate: "2024-02-07",
        direction: "BULLISH",
        confidence: 90,
        closeDate: "2024-02-07"
      })
    ],
    summary: { rows_checked: 2 }
  };

  const dailyContext = createDailyContext(createDailySeries());
  const intradayContext = createIntradayContext({
    "2024-02-06": [
      { instrument: "TEST", timestamp: "2024-02-06T09:00:00Z", date: "2024-02-06", open: 105, high: 106, low: 100, close: 101, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-06T10:00:00Z", date: "2024-02-06", open: 101, high: 106, low: 101, close: 105, source: "test", complete: true }
    ],
    "2024-02-07": [
      { instrument: "TEST", timestamp: "2024-02-07T09:00:00Z", date: "2024-02-07", open: 102, high: 110, low: 108, close: 109, source: "test", complete: true },
      { instrument: "TEST", timestamp: "2024-02-07T10:00:00Z", date: "2024-02-07", open: 109, high: 109, low: 104, close: 105, source: "test", complete: true }
    ]
  });

  const asset = buildLayer1AssetResearch({
    assetCode: "EUR",
    assetLabel: "EUR",
    weekdayKeys: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    instrument: "EUR_USD",
    sourceVendor: "test",
    candleSourceLabel: "test",
    dailySourceLabel: "daily",
    intradaySourceLabel: "intraday",
    dailySourcePath: "daily.csv",
    intradaySourcePath: "intraday.csv",
    fixedReferenceL2lDistance: 5
  }, checker, {
    contexts: {
      daily: dailyContext,
      intraday: intradayContext
    },
    rollingWindowStart: "2024-01-01"
  });

  const pair = buildLayer2PairResearch({
    targetAssetCode: "EUR",
    pairCode: "EUR_USD",
    pairLabel: "EUR/USD",
    weekdayKeys: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    fixedReferenceL2lDistance: 5
  }, { EUR: asset }, { USD: usdChecker, EUR: checker });

  assert.equal(asset.summary.evaluatedCalls, 2);
  assert.equal(asset.summary.l2lRangeAvailableWins, 2);
  assert.equal(asset.bucketTotals.WEAK.total, 1);
  assert.equal(asset.bucketTotals.STRONG.total, 1);
  assert.equal(pair.summary.tradableSignals, 2);
  assert.equal(pair.summary.l2lRangeAvailableWins, 2);
});
