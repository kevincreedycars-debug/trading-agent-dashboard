const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CONCLUSIONS,
  compareHeadlineTotals,
  computeOriginalHeadlineTotals,
  deriveTransition,
  summarizeTransitions
} = require("../lib/l2l_excursion_definition_reconciliation");

function createReachRow(overrides = {}) {
  return {
    recordId: "row-1",
    layer: "LAYER_1",
    outcomes: {
      HALF_OF_STANDARD: { outcome: "HIT" },
      FULL_STANDARD: { outcome: "MISS" }
    },
    ...overrides
  };
}

test("transition labels cover all four reconciliation states", () => {
  assert.equal(deriveTransition(true, true), "HIT_UNDER_BOTH");
  assert.equal(deriveTransition(true, false), "ORIGINAL_ONLY_HIT");
  assert.equal(deriveTransition(false, true), "SESSION_OPEN_ONLY_HIT");
  assert.equal(deriveTransition(false, false), "MISS_UNDER_BOTH");
});

test("independent headline totals are reproduced from row-level outcomes", () => {
  const rows = [
    createReachRow(),
    createReachRow({ recordId: "row-2", layer: "LAYER_1", outcomes: { HALF_OF_STANDARD: { outcome: "MISS" }, FULL_STANDARD: { outcome: "MISS" } } }),
    createReachRow({ recordId: "row-3", layer: "LAYER_2", outcomes: { HALF_OF_STANDARD: { outcome: "HIT" }, FULL_STANDARD: { outcome: "HIT" } } })
  ];
  const totals = computeOriginalHeadlineTotals(rows);
  assert.deepEqual(totals, {
    layer1: { halfHits: 1, halfMisses: 1, fullHits: 0, fullMisses: 2 },
    layer2: { halfHits: 1, halfMisses: 0, fullHits: 1, fullMisses: 0 }
  });
});

test("headline comparison detects exact matches", () => {
  const independent = {
    layer1: { halfHits: 1, halfMisses: 2, fullHits: 3, fullMisses: 4 },
    layer2: { halfHits: 5, halfMisses: 6, fullHits: 7, fullMisses: 8 }
  };
  const artifact = {
    comparisons: {
      overall: {
        layer1: {
          halfOfStandard: { hits: 1, misses: 2 },
          fullStandard: { hits: 3, misses: 4 }
        },
        layer2: {
          halfOfStandard: { hits: 5, misses: 6 },
          fullStandard: { hits: 7, misses: 8 }
        }
      }
    }
  };
  const result = compareHeadlineTotals(independent, artifact);
  assert.equal(result.exactMatch, true);
});

test("transition summaries count original-only and session-open-only rows", () => {
  const rows = [
    { halfTransition: "HIT_UNDER_BOTH" },
    { halfTransition: "ORIGINAL_ONLY_HIT" },
    { halfTransition: "SESSION_OPEN_ONLY_HIT" },
    { halfTransition: "MISS_UNDER_BOTH" }
  ];
  const summary = summarizeTransitions(rows, "halfTransition", { scope: "OVERALL" });
  assert.equal(summary.hitUnderBothCount, 1);
  assert.equal(summary.originalOnlyHitCount, 1);
  assert.equal(summary.sessionOpenOnlyHitCount, 1);
  assert.equal(summary.missUnderBothCount, 1);
});

test("path-dependent conclusion enum is exposed", () => {
  assert.equal(CONCLUSIONS.ORIGINAL_METRIC_PATH_DEPENDENT, "ORIGINAL_METRIC_PATH_DEPENDENT");
});
