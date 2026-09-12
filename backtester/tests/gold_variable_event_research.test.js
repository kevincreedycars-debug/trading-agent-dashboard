const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("../fixtures/gold_timestamped.synthetic.json");
const registry = require("../registries/gold_24h_factor_hypotheses.v1.json");
const { buildGoldVariableEventDataset, buildGoldVariableEventResearchReport } = require("../lib/gold_variable_event_research");

test("Gold adapter only forwards timestamp-evaluable calls and retains upstream rejections", () => {
  const data = structuredClone(fixture);
  data.calls.push({ ...data.calls[0], prediction_id: "rejected", features: [] });
  const adapted = buildGoldVariableEventDataset(data);
  assert.equal(adapted.observations.length, 2);
  assert.equal(adapted.upstream_evaluation.exclusions[0].reason, "features_missing");
  assert.deepEqual(adapted.observations[0].features.F1, { value: "BULLISH", available_at: "2024-01-08T13:58:00Z" });
});

test("Gold registry uses the shared framework and keeps synthetic results labelled", () => {
  const report = buildGoldVariableEventResearchReport(structuredClone(fixture), registry, {
    split_at: "2024-01-08T15:00:00Z", embargo_ms: 0
  });
  assert.equal(report.adapter, "gold-timestamped-variable-event-v1");
  assert.equal(report.data_kind, "synthetic_contract_example_not_market_evidence");
  assert.equal(report.hypotheses.length, 20);
  assert.equal(report.hypotheses.find(row => row.id === "F1-bullish").results.training.cohort.directional_hit_rate_pct, 100);
  assert.equal(report.upstream_evaluation.evaluable_calls, 2);
});
