const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EXCLUSION_REASONS,
  assignChronologicalFold,
  classifyTerminalDirection,
  computeExcursionMetrics,
  evaluateRow,
  selectTradingSessionCandles
} = require("../lib/l2l_trading_day_directional");

function createIntradayContext(sessionRowsByDate) {
  return {
    byDate: new Map(Object.entries(sessionRowsByDate))
  };
}

function createCandle(timestamp, values = {}) {
  return {
    timestamp,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    complete: true,
    ...values
  };
}

function createRow(overrides = {}) {
  return {
    recordId: "row-1",
    predictionId: "pred-1",
    layer: "LAYER_1",
    entityCode: "EUR",
    entityLabel: "EUR",
    targetAssetCode: null,
    snapshotDate: "2024-01-05",
    evaluationDate: "2024-01-05",
    weekdayKey: "FRIDAY",
    callDirection: "BULLISH",
    confidencePct: 70,
    strengthBucket: "STRONG",
    exactConfidenceBucketKey: "70_79",
    exactConfidenceBucketLabel: "70-79",
    adr20: 4,
    halfL2lDistance: 1,
    currentStandardL2lDistance: 2,
    evaluationStartTime: "2024-01-05T14:00:00.000Z",
    evaluationEndTime: "2024-01-05T16:00:00.000Z",
    ...overrides
  };
}

test("session selection requires the exact designated source-defined session shape", () => {
  const row = createRow();
  const okContext = createIntradayContext({
    "2024-01-05": [
      createCandle("2024-01-05T14:00:00.000Z"),
      createCandle("2024-01-05T15:00:00.000Z"),
      createCandle("2024-01-05T16:00:00.000Z")
    ]
  });
  assert.equal(selectTradingSessionCandles(row, okContext).ok, true);

  const shortenedContext = createIntradayContext({
    "2024-01-05": [
      createCandle("2024-01-05T14:00:00.000Z"),
      createCandle("2024-01-05T16:00:00.000Z")
    ]
  });
  assert.equal(selectTradingSessionCandles(row, shortenedContext).reason, EXCLUSION_REASONS.SHORTENED_SESSION);

  const duplicateContext = createIntradayContext({
    "2024-01-05": [
      createCandle("2024-01-05T14:00:00.000Z"),
      createCandle("2024-01-05T14:00:00.000Z"),
      createCandle("2024-01-05T16:00:00.000Z")
    ]
  });
  assert.equal(selectTradingSessionCandles(row, duplicateContext).reason, EXCLUSION_REASONS.AMBIGUOUS_SESSION);
});

test("bullish and bearish correctness depend only on session open to close", () => {
  assert.deepEqual(
    classifyTerminalDirection(100, 101, "BULLISH"),
    { terminalDirection: "BULLISH", classification: "CORRECT" }
  );
  assert.deepEqual(
    classifyTerminalDirection(100, 99, "BULLISH"),
    { terminalDirection: "BEARISH", classification: "INCORRECT" }
  );
  assert.deepEqual(
    classifyTerminalDirection(100, 99, "BEARISH"),
    { terminalDirection: "BEARISH", classification: "CORRECT" }
  );
});

test("flat classification is explicit", () => {
  assert.deepEqual(
    classifyTerminalDirection(100, 100, "BULLISH"),
    { terminalDirection: "FLAT", classification: "FLAT" }
  );
});

test("ADR normalisation and reversal detection use session-open excursion only", () => {
  const row = createRow();
  const contextByAsset = {
    EUR: createIntradayContext({
      "2024-01-05": [
        createCandle("2024-01-05T14:00:00.000Z", { open: 100, high: 100.5, low: 99.5, close: 100.25 }),
        createCandle("2024-01-05T15:00:00.000Z", { open: 100.25, high: 101.5, low: 99.8, close: 99.9 }),
        createCandle("2024-01-05T16:00:00.000Z", { open: 99.9, high: 100.2, low: 98.5, close: 99 })
      ]
    })
  };

  const result = evaluateRow(row, contextByAsset);
  assert.equal(result.included, true);
  assert.equal(result.classification, "INCORRECT");
  assert.equal(result.openToCloseMove, -1);
  assert.equal(result.openToCloseReturnAdr, -0.25);
  assert.equal(result.signedReturnAdrFromCallPerspective, -0.25);
  assert.equal(result.reachedHalfAdr20, true);
  assert.equal(result.reachedFullAdr20, false);
  assert.equal(result.halfReachButTerminalReversal, true);
});

test("bearish ADR normalisation flips sign from the call perspective", () => {
  const row = createRow({ callDirection: "BEARISH" });
  const contextByAsset = {
    EUR: createIntradayContext({
      "2024-01-05": [
        createCandle("2024-01-05T14:00:00.000Z", { open: 100, high: 100.2, low: 99.5, close: 99.7 }),
        createCandle("2024-01-05T15:00:00.000Z", { open: 99.7, high: 100.1, low: 98.4, close: 99.1 }),
        createCandle("2024-01-05T16:00:00.000Z", { open: 99.1, high: 99.3, low: 98.2, close: 98.5 })
      ]
    })
  };
  const result = evaluateRow(row, contextByAsset);
  assert.equal(result.classification, "CORRECT");
  assert.equal(result.openToCloseReturnAdr, -0.375);
  assert.equal(result.signedReturnAdrFromCallPerspective, 0.375);
});

test("missing sessions are excluded explicitly", () => {
  const row = createRow();
  const result = evaluateRow(row, {});
  assert.equal(result.included, false);
  assert.equal(result.exclusionReason, EXCLUSION_REASONS.MISSING_SESSION);
});

test("chronological folds remain frozen", () => {
  assert.equal(assignChronologicalFold("2024-01-03"), "TRAIN");
  assert.equal(assignChronologicalFold("2025-09-30"), "VALIDATION");
  assert.equal(assignChronologicalFold("2026-04-30"), "FINAL_TEST");
  assert.equal(assignChronologicalFold("2026-05-01"), null);
});

test("excursion metrics are anchored at the session open", () => {
  const sessionCandles = [
    createCandle("2024-01-05T14:00:00.000Z", { open: 100, high: 101, low: 99.2, close: 100.5 }),
    createCandle("2024-01-05T15:00:00.000Z", { open: 100.5, high: 102.5, low: 100.1, close: 102 }),
    createCandle("2024-01-05T16:00:00.000Z", { open: 102, high: 102.2, low: 98.8, close: 99.5 })
  ];
  const bullish = computeExcursionMetrics(sessionCandles, 100, "BULLISH", 4, 1, 2);
  assert.equal(bullish.maxFavourableExcursion, 2.5);
  assert.equal(bullish.maxAdverseExcursion, 1.2);
  assert.equal(bullish.reachedHalfAdr20, true);
  assert.equal(bullish.reachedFullAdr20, true);
});
