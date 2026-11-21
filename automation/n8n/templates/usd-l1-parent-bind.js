// One item per selected model and morning. The node is generated once per registered Cloud model and is
// pinned to that model. An unselected model emits a single skip marker instead of nothing: n8n stops a
// chain when a node returns zero items, so the marker keeps the next branch reachable while the child
// returns immediately without evaluating a morning.
const config = $("Run configuration").first().json;
const selected = Array.isArray(config.models) ? config.models : [];
const __pinnedModel = "__MODEL__";
if (!selected.includes(__pinnedModel)) return [{ json: { skip: true, model: __pinnedModel, requested_models: selected } }];
const sessions = $("Select one saved morning").all().map((item) => item.json).filter(Boolean);
return sessions.map((session) => ({
  json: Object.assign({}, session, {
    model: __pinnedModel,
    requested_models: selected
  })
}));
