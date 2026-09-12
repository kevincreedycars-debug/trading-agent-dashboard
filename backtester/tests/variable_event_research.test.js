const test = require("node:test");
const assert = require("node:assert/strict");
const { buildVariableEventResearchReport } = require("../lib/variable_event_research");

const registry = {
  version: "test-v1",
  outcome_contract_id: "following-24h-test-v1",
  features: [
    { key: "yield_delta", kind: "numeric", availability_required: true },
    { key: "cpi_surprise", kind: "event", availability_required: true }
  ],
  hypotheses: [
    { id: "yield-up", feature_key: "yield_delta", cohort: { operator: "gte", value: 5 }, expected_outcome_direction: "BULLISH" },
    { id: "hot-cpi", feature_key: "cpi_surprise", cohort: { operator: "equals", value: "HOT" }, expected_outcome_direction: "BEARISH" }
  ]
};

function observation(id, hour, outcome, features) {
  return {
    observation_id: id,
    decision_time: `2024-01-01T${String(hour).padStart(2, "0")}:00:00Z`,
    outcome_end_time: `2024-01-01T${String(hour + 1).padStart(2, "0")}:00:00Z`,
    outcome_direction: outcome,
    features
  };
}

test("predeclared numeric and event cohorts report training and validation associations", () => {
  const dataset = { data_kind: "synthetic", observations: [
    observation("one", 8, "BULLISH", { yield_delta: { value: 7, available_at: "2024-01-01T07:00:00Z" }, cpi_surprise: { value: "HOT", available_at: "2024-01-01T07:00:00Z" } }),
    observation("two", 9, "BEARISH", { yield_delta: { value: 1, available_at: "2024-01-01T07:00:00Z" }, cpi_surprise: { value: "COOL", available_at: "2024-01-01T07:00:00Z" } }),
    observation("three", 12, "BULLISH", { yield_delta: { value: 8, available_at: "2024-01-01T11:00:00Z" }, cpi_surprise: { value: "HOT", available_at: "2024-01-01T11:00:00Z" } }),
    observation("four", 13, "FLAT", { yield_delta: { value: 6, available_at: "2024-01-01T12:00:00Z" }, cpi_surprise: { value: "HOT", available_at: "2024-01-01T12:00:00Z" } })
  ] };
  const report = buildVariableEventResearchReport(dataset, registry, { split_at: "2024-01-01T11:00:00Z", embargo_ms: 0 });
  const yieldHypothesis = report.hypotheses[0];
  assert.deepEqual(report.coverage, { source_observations: 4, accepted_observations: 4, training_observations: 2, validation_observations: 2, excluded_observations: 0 });
  assert.equal(yieldHypothesis.results.training.cohort.directional_hit_rate_pct, 100);
  assert.equal(yieldHypothesis.results.validation.cohort.flat_count, 1);
  assert.equal(report.hypotheses[1].results.training.cohort.directional_hit_rate_pct, 0);
  assert.equal(report.causal_claims_permitted, false);
});

test("late, missing, invalid, duplicate and embargoed records are explicitly excluded", () => {
  const dataset = { observations: [
    observation("late", 8, "BULLISH", { yield_delta: { value: 9, available_at: "2024-01-01T09:00:00Z" } }),
    observation("missing", 9, "BULLISH", {}),
    observation("duplicate", 10, "BULLISH", { yield_delta: { value: 9, available_at: "2024-01-01T09:00:00Z" } }),
    observation("duplicate", 12, "BULLISH", { yield_delta: { value: 9, available_at: "2024-01-01T11:00:00Z" } }),
    observation("embargoed", 11, "BULLISH", { yield_delta: { value: 9, available_at: "2024-01-01T10:00:00Z" } })
  ] };
  const report = buildVariableEventResearchReport(dataset, registry, { split_at: "2024-01-01T10:00:00Z", embargo_ms: 7200000 });
  assert.equal(report.coverage.excluded_observations, 3);
  assert.equal(report.hypotheses[0].results.training.feature_exclusions.late_feature, 1);
  assert.equal(report.hypotheses[0].results.training.feature_exclusions.missing_feature, 1);
  assert.deepEqual(report.excluded_observations.map(row => row.reason).sort(), ["duplicate_observation_id", "duplicate_observation_id", "split_overlap_or_embargo"]);
});

test("registry validation prevents unknown features, invalid cohorts, and unqualified outcome directions", () => {
  assert.throws(() => buildVariableEventResearchReport({ observations: [] }, { features: [], hypotheses: [{ id: "bad", feature_key: "unknown", cohort: { operator: "equals", value: "x" }, expected_outcome_direction: "BULLISH" }] }, { split_at: "2024-01-01T00:00:00Z", embargo_ms: 0 }), /Unknown feature_key/);
  assert.throws(() => buildVariableEventResearchReport({ observations: [] }, { features: [{ key: "x" }], hypotheses: [{ id: "bad", feature_key: "x", cohort: { operator: "wat" }, expected_outcome_direction: "BULLISH" }] }, { split_at: "2024-01-01T00:00:00Z", embargo_ms: 0 }), /Invalid cohort operator/);
  assert.throws(() => buildVariableEventResearchReport({ observations: [] }, registry, { split_at: "invalid", embargo_ms: 0 }), /split_at/);
});
