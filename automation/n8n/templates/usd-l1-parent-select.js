const config = $("Run configuration").first().json;
const raw = $input.first().json || {};
const dataset = typeof raw.data === "string"
  ? JSON.parse(raw.data)
  : (raw.data && typeof raw.data === "object" ? raw.data : raw);
const sessions = Array.isArray(dataset.sessions) ? dataset.sessions : [];
const found = sessions.find((session) => session && session.date === config.date) || null;
const session = found ? Object.assign({}, found, { source_legend: dataset.input_source_legend || [] }) : null;
return [{
  json: {
    date: config.date,
    model_v0: "challenger",
    model_v1: "challenger_v1",
    validation: config.validation,
    session,
    session_found: Boolean(found),
    dataset_meta: {
      path: config.dataset_url,
      schema_version: dataset.schema_version || null,
      run_version: dataset.run && dataset.run.run_version ? dataset.run.run_version : null,
      generated_at: dataset.generated_at || null,
      sessions: sessions.length,
      input_source_legend: dataset.input_source_legend || []
    },
    dataset_window: {
      first: sessions.length ? sessions[0].date : null,
      last: sessions.length ? sessions[sessions.length - 1].date : null
    }
  }
}];
