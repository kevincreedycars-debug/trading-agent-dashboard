const { parseTimestamp } = require('./gold_timestamped_evaluation');

function buildGoldAsOfDataset(input) {
  if (!input || !Array.isArray(input.calls) || !Array.isArray(input.candles) ||
    !Array.isArray(input.feature_records) || !Array.isArray(input.feature_contract) || !input.feature_contract.length) {
    throw new Error('calls, candles, feature_records and a non-empty feature_contract are required.');
  }
  const fields = new Map();
  for (const field of input.feature_contract) {
    if (!field || typeof field.name !== 'string' || !field.name.trim() || fields.has(field.name) ||
      typeof field.required !== 'boolean' || !Number.isSafeInteger(field.max_age_ms) || field.max_age_ms < 0) {
      throw new Error('Feature contract needs unique names, required booleans, and non-negative integer max_age_ms.');
    }
    fields.set(field.name, field);
  }
  const records = new Map([...fields.keys()].map(name => [name, []]));
  for (const record of input.feature_records) {
    if (!record || !fields.has(record.name)) throw new Error('Feature record has an unknown name.');
    const observed = parseTimestamp(record.observed_at), available = parseTimestamp(record.available_at);
    if (observed === null || available === null || available < observed ||
      typeof record.source !== 'string' || !record.source.trim() ||
      !['string', 'number', 'boolean'].includes(typeof record.value) ||
      (typeof record.value === 'number' && !Number.isFinite(record.value)) ||
      (typeof record.value === 'string' && !record.value.trim())) throw new Error('Invalid feature record timestamp, value, or source.');
    records.get(record.name).push({ ...record, observed, available });
  }
  for (const series of records.values()) series.sort((a, b) => b.observed - a.observed || b.available - a.available);
  const calls = input.calls.map(call => {
    if (call?.market !== 'XAUUSD') throw new Error('Scheduled call market must be XAUUSD; no implicit relabelling.');
    const decision = parseTimestamp(call?.call_time);
    if (decision === null) throw new Error('Every scheduled call needs a valid call_time.');
    const selectionCutoff = call.inputs_available_at === undefined ? decision : parseTimestamp(call.inputs_available_at);
    if (selectionCutoff === null || selectionCutoff > decision) throw new Error('Input cutoff must be a valid timestamp at or before the call.');
    if (call.input_rejections !== undefined && !Array.isArray(call.input_rejections)) throw new Error('Upstream input_rejections must be an array.');
    const features = [], rejections = [...(call.input_rejections || [])], missing = [];
    for (const [name, field] of fields) {
      const candidates = records.get(name).filter(row => row.observed <= selectionCutoff && row.available <= selectionCutoff);
      const latest = candidates[0];
      let reason = !latest ? 'unavailable_at_call' :
        decision - latest.observed > field.max_age_ms ? 'stale_at_call' : null;
      if (latest && candidates.filter(row => row.observed === latest.observed && row.available === latest.available).length > 1) reason = 'ambiguous_record';
      if (reason) {
        const item = { name, reason, required: field.required };
        missing.push(item);
        if (field.required || reason === 'ambiguous_record') rejections.push(item);
        continue;
      }
      features.push({ name, value: latest.value, observed_at: latest.observed_at,
        available_at: latest.available_at, source: latest.source,
        ...(latest.source_record_id === undefined ? {} : { source_record_id: latest.source_record_id }) });
    }
    const cutoff = features.length ? Math.max(...features.map(row => parseTimestamp(row.available_at))) : selectionCutoff;
    return { ...call, market: 'XAUUSD', features, inputs_available_at: new Date(cutoff).toISOString(),
      feature_selection_cutoff: new Date(selectionCutoff).toISOString(),
      input_rejections: rejections, missing_features: missing };
  });
  return { version: 'gold-asof-dataset-v2', data_kind: input.data_kind || 'unspecified',
    protocol: input.protocol ?? null,
    entry_semantics: input.entry_semantics ?? null,
    config: input.config, calls, candles: input.candles,
    input_methodology: 'Latest observed feature available by the explicit input cutoff (default: decision); latest available revision of that observation. Age measured from observed_at to decision. Upstream rejections preserved.',
    feature_contract: input.feature_contract,
    readiness: { calls: calls.length, calls_with_required_or_ambiguous_input_failures: calls.filter(row => row.input_rejections.length).length } };
}

module.exports = { buildGoldAsOfDataset };
