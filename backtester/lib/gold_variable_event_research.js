const { buildGoldTimestampedReport } = require("./gold_timestamped_evaluation");
const { buildVariableEventResearchReport } = require("./variable_event_research");

function buildGoldVariableEventDataset(dataset) {
  const evaluation = buildGoldTimestampedReport(dataset);
  const observations = [];
  const upstream_exclusions = [];
  evaluation.rows.forEach((result, source_index) => {
    const call = dataset.calls[source_index];
    if (!result.evaluable) {
      upstream_exclusions.push({
        observation_id: call?.prediction_id ?? null,
        source_index,
        reason: result.result_reason || "timestamped_outcome_not_evaluable"
      });
      return;
    }
    const features = {};
    for (const feature of call.features) {
      features[feature.name] = { value: feature.value, available_at: feature.available_at };
    }
    observations.push({
      observation_id: call.prediction_id,
      decision_time: result.call_time,
      entry_time: result.entry_time,
      outcome_end_time: result.horizon_end,
      outcome_direction: result.market_outcome_direction,
      return_pct: result.pct_change,
      features
    });
  });
  return {
    data_kind: dataset.data_kind || "unspecified",
    outcome_contract: evaluation.evaluation_contract,
    observations,
    upstream_evaluation: {
      version: evaluation.version,
      source_calls: evaluation.calls,
      evaluable_calls: evaluation.evaluable_calls,
      result_counts: evaluation.result_counts,
      reason_counts: evaluation.reason_counts,
      exclusions: upstream_exclusions
    }
  };
}

function buildGoldVariableEventResearchReport(dataset, registry, options) {
  const adapted = buildGoldVariableEventDataset(dataset);
  const report = buildVariableEventResearchReport(adapted, registry, options);
  return {
    ...report,
    adapter: "gold-timestamped-variable-event-v1",
    upstream_evaluation: adapted.upstream_evaluation,
    evaluation_contract: adapted.outcome_contract,
    protocol: dataset.protocol ?? null,
    entry_semantics: dataset.entry_semantics ?? null,
    limitations: [
      ...report.limitations,
      "Gold input/query lineage limitations from the timestamped evaluator remain inherited by this report."
    ]
  };
}

module.exports = { buildGoldVariableEventDataset, buildGoldVariableEventResearchReport };
