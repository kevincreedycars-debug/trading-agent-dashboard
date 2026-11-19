const __api = (typeof module === "object" && module.exports) ? module.exports : globalThis.UsdL1CloudRuntime;
const __input = $input.first().json || {};
const __pinnedModel = "__MODEL__";
if (__input.model !== __pinnedModel) {
  throw new Error("this child is pinned to " + __pinnedModel + "; received " + String(__input.model));
}
const __result = __api.evaluateOne(__input);
__result.execution_id = $execution.id;
__result.execution_url = "https://silver17.app.n8n.cloud/execution/" + $execution.id;
__result.workflow_id = $workflow.id;
__result.workflow_name = $workflow.name;
return [{ json: __result }];
