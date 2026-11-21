const config = $("Run configuration").first().json;
const raw = $input.first().json || {};
const dataset = typeof raw.data === "string"
  ? JSON.parse(raw.data)
  : (raw.data && typeof raw.data === "object" ? raw.data : raw);
const sessions = Array.isArray(dataset.sessions) ? dataset.sessions : [];
const byDate = new Map(sessions.filter((session) => session && session.date).map((session) => [session.date, session]));
const wanted = Array.isArray(config.dates) && config.dates.length > 0 ? config.dates : [config.date];
const selected = Array.isArray(config.models) ? config.models : [];
const dataset_meta = {
  path: config.dataset_url,
  schema_version: dataset.schema_version || null,
  run_version: dataset.run && dataset.run.run_version ? dataset.run.run_version : null,
  generated_at: dataset.generated_at || null,
  sessions: sessions.length,
  input_source_legend: dataset.input_source_legend || []
};
const dataset_window = {
  first: sessions.length ? sessions[0].date : null,
  last: sessions.length ? sessions[sessions.length - 1].date : null
};
// One item per requested morning, in the order the run configuration sorted them. An absent morning is
// passed as a null session so every selected model returns an explicit refusal instead of a filled value.
return wanted.map((date) => {
  const found = byDate.get(date) || null;
  const session = found ? Object.assign({}, found, { source_legend: dataset.input_source_legend || [] }) : null;
  return {
    json: {
      date,
      requested_models: selected,
      tests: config.tests || null,
      validation: config.validation,
      registry_version: config.registry_version,
      registry_fingerprint: config.registry_fingerprint,
      session,
      session_found: Boolean(found),
      batch: wanted.length > 1,
      batch_total: wanted.length,
      dataset_meta,
      dataset_window
    }
  };
});
