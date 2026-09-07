const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CONCLUSIONS,
  classifyConclusion,
  deriveThresholdRow,
  mcnemarTest,
  pairedDifferenceStats,
  summariseThreshold
} = require("../lib/l2l_directional_discrimination");

function createRow(overrides = {}) {
  return {
    entityLabel: "EUR",
    entityCode: "EUR",
    layer: "LAYER_1",
    callDirection: "BULLISH",
    terminalDirection: "BULLISH",
    halfDistance: 1,
    fullDistance: 2,
    reachedHalfAdr20: true,
    reachedFullAdr20: false,
    maxFavourableExcursion: 1.2,
    maxAdverseExcursion: 0.8,
    maxFavourableExcursionAdr: 0.3,
    maxAdverseExcursionAdr: 0.2,
    ...overrides
  };
}

test("opposite-side reach is derived from adverse excursion versus the frozen threshold distance", () => {
  const row = createRow({ maxAdverseExcursion: 1.1 });
  const result = deriveThresholdRow(row, {
    key: "HALF_ADR20",
    label: "0.25xADR20",
    distanceField: "halfDistance",
    calledReachField: "reachedHalfAdr20"
  });
  assert.equal(result.calledReach, true);
  assert.equal(result.oppositeReach, true);
  assert.equal(result.bothSides, true);
});

test("paired difference stats produce a bounded confidence interval", () => {
  const stats = pairedDifferenceStats([1, 1, 0, -1, 0]);
  assert.equal(stats.meanDiffPct, 20);
  assert.equal(stats.ciLowPct < stats.ciHighPct, true);
});

test("mcnemar test returns unit p-value with no discordant rows", () => {
  const result = mcnemarTest(0, 0);
  assert.equal(result.discordantCount, 0);
  assert.equal(result.approximatePValue, 1);
});

test("threshold summary separates called-only, opposite-only, both and neither", () => {
  const rows = [
    createRow({ reachedHalfAdr20: true, maxAdverseExcursion: 0.5 }),
    createRow({ reachedHalfAdr20: false, maxAdverseExcursion: 1.1, maxFavourableExcursionAdr: 0.1, maxAdverseExcursionAdr: 0.35 }),
    createRow({ reachedHalfAdr20: true, maxAdverseExcursion: 1.2 }),
    createRow({ reachedHalfAdr20: false, maxAdverseExcursion: 0.4, maxFavourableExcursionAdr: 0.05, maxAdverseExcursionAdr: 0.04 })
  ];
  const summary = summariseThreshold(rows, {
    key: "HALF_ADR20",
    label: "0.25xADR20",
    distanceField: "halfDistance",
    calledReachField: "reachedHalfAdr20"
  }, { layer: "LAYER_1" });
  assert.equal(summary.calledOnlyCount, 1);
  assert.equal(summary.oppositeOnlyCount, 1);
  assert.equal(summary.bothSidesCount, 1);
  assert.equal(summary.neitherSideCount, 1);
});

test("classification prefers symmetric volatility when paired reach differences stay near zero", () => {
  const discrimination = {
    preservedDirectionalResult: { layer1AccuracyPct: 47.65, layer2AccuracyPct: 47.99 },
    layers: {
      layer1: {
        overall: [
          { thresholdKey: "HALF_ADR20", pairedCalledMinusOppositeReachPct: 1.1, pairedCalledMinusOppositeReach95LowPct: -1.5, pairedCalledMinusOppositeReach95HighPct: 3.7 },
          { thresholdKey: "FULL_ADR20", pairedCalledMinusOppositeReachPct: -0.8, pairedCalledMinusOppositeReach95LowPct: -3.2, pairedCalledMinusOppositeReach95HighPct: 1.6 }
        ],
        byDirection: [
          { callDirection: "BEARISH", thresholdKey: "HALF_ADR20", pairedCalledMinusOppositeReach95HighPct: 0.5 },
          { callDirection: "BULLISH", thresholdKey: "HALF_ADR20", pairedCalledMinusOppositeReach95LowPct: -0.5 }
        ]
      },
      layer2: {
        overall: [
          { thresholdKey: "HALF_ADR20", pairedCalledMinusOppositeReachPct: 2.2, pairedCalledMinusOppositeReach95LowPct: -0.7, pairedCalledMinusOppositeReach95HighPct: 5.1 },
          { thresholdKey: "FULL_ADR20", pairedCalledMinusOppositeReachPct: 1.4, pairedCalledMinusOppositeReach95LowPct: -1.8, pairedCalledMinusOppositeReach95HighPct: 4.6 }
        ],
        byDirection: [
          { callDirection: "BEARISH", thresholdKey: "HALF_ADR20", pairedCalledMinusOppositeReach95HighPct: 0.2 },
          { callDirection: "BULLISH", thresholdKey: "HALF_ADR20", pairedCalledMinusOppositeReach95LowPct: -0.4 }
        ]
      }
    }
  };
  assert.equal(classifyConclusion(discrimination), CONCLUSIONS.SYMMETRIC_INTRADAY_VOLATILITY);
});
