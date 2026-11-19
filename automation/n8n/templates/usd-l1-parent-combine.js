const v0 = $("Run Challenger v0").first().json;
const v1 = $("Run Challenger v1").first().json;
const d0 = v0 && v0.decision;
const d1 = v1 && v1.decision;
if (!d0 || !d1) {
  throw new Error("one of the versioned Layer 1 children returned no decision");
}
function availability(decision) {
  const validation = decision.validation || {};
  const inputs = validation.inputs || {};
  const receipted = validation.receipted || {};
  return {
    cutoff_at_utc: validation.cutoff_at_utc || null,
    contract_cutoff_at_utc: validation.contract_cutoff_at_utc || null,
    structural_accepted: validation.structural_accepted === undefined ? validation.accepted : validation.structural_accepted,
    accepted: validation.accepted === true,
    reasons: (validation.reasons || []).map((reason) => reason.code),
    declared_inputs: inputs.declared === undefined ? null : inputs.declared,
    present_inputs: inputs.present === undefined ? null : inputs.present,
    missing_inputs: inputs.missing === undefined ? null : inputs.missing,
    missing_keys: inputs.missing_keys || [],
    stamped_before_cutoff: inputs.stamped_before_cutoff === undefined ? null : inputs.stamped_before_cutoff,
    receipted_complete: receipted.complete === true,
    unclocked_keys: receipted.unclocked_keys || []
  };
}
const sameDirection = d0.call.direction === d1.call.direction;
const result = {
  schema_version: "usd-l1-n8n-cloud-execution-v1",
  generated_at: new Date().toISOString(),
  date: v0.date,
  validation_mode: v0.validation_mode,
  dataset: v0.dataset,
  models: {
    challenger: {
      identity: "usd-layer1-challenger-v0",
      workflow_id: v0.workflow_id,
      workflow_name: v0.workflow_name,
      execution_id: v0.execution_id,
      execution_url: v0.execution_url,
      decision: d0
    },
    challenger_v1: {
      identity: "usd-layer1-challenger-v1",
      workflow_id: v1.workflow_id,
      workflow_name: v1.workflow_name,
      execution_id: v1.execution_id,
      execution_url: v1.execution_url,
      decision: d1
    }
  },
  input_availability: availability(d0),
  input_availability_by_model: {
    challenger: availability(d0),
    challenger_v1: availability(d1)
  },
  comparison: {
    same_direction: sameDirection,
    challenger: d0.call.direction,
    challenger_v1: d1.call.direction,
    challenger_conviction: d0.call.conviction,
    challenger_v1_conviction: d1.call.conviction,
    note: "Version 0 and version 1 share the same scoring code but not the same frozen weighting; a same-direction result is not a performance claim."
  },
  n8n: {
    execution_id: $execution.id,
    execution_url: "https://silver17.app.n8n.cloud/execution/" + $execution.id,
    workflow_id: $workflow.id,
    workflow_name: $workflow.name
  },
  labels: {
    research_only: "Research only. This is a replayed historical morning, not a live call.",
    replay_not_performance: "Agreement between the two versions or with a stored call is reproduction evidence. It is not accuracy, edge, or historical validity beyond the validation gate named here.",
    h1_not_invoked: "USD-L1-25F-H1-v0.1.0 is a separate, unscored model identity and is not one of these two children."
  }
};
return [{ json: result }];
