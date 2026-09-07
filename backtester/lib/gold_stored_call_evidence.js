const { parseTimestamp } = require('./gold_timestamped_evaluation');

// Postgres timestamps have microseconds. Round availability UP, never earlier.
function storageTimestampNanos(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const base = parseTimestamp(match[1] + match[3]);
  if (base === null) return null;
  const nanos = BigInt((match[2] || '').padEnd(9, '0'));
  return BigInt(base) * 1000000n + nanos;
}

function storageTimestamp(value) {
  const nanos = storageTimestampNanos(value);
  if (nanos === null) return null;
  const quotient = nanos / 1000000n, remainder = nanos % 1000000n;
  return Number(quotient + (remainder > 0n ? 1n : 0n));
}

const FACTORS = Array.from({ length: 10 }, (_, i) => `F${i + 1}`);
const SIGNALS = ['BULLISH', 'BEARISH', 'NEUTRAL'];

function prepareGoldStoredCalls(bundle, protocol) {
  if (!Array.isArray(bundle?.outputs) || !Array.isArray(bundle?.snapshots)) throw new Error('outputs and snapshots arrays required.');
  if (protocol?.entry_policy !== 'next_minute_after_storage' ||
    !Number.isSafeInteger(protocol.horizon_ms) || protocol.horizon_ms <= 0 || protocol.horizon_ms % 60000 ||
    typeof protocol.id !== 'string' || !protocol.id.trim() || parseTimestamp(protocol.frozen_at) === null ||
    typeof protocol.flat_threshold_pct !== 'number' || !Number.isFinite(protocol.flat_threshold_pct) || protocol.flat_threshold_pct < 0) {
    throw new Error('Explicit protocol id, frozen_at, next_minute_after_storage, whole-minute horizon_ms and flat_threshold_pct required.');
  }
  const snapshots = new Map();
  for (const row of bundle.snapshots) {
    if (!row?.id) throw new Error('Snapshot id required.');
    if (!snapshots.has(row.id)) snapshots.set(row.id, []);
    snapshots.get(row.id).push(row);
  }
  const calls = bundle.outputs.map(row => {
    const issues = [];
    if (row?.agent_name !== 'GOLD' || row?.layer !== 1) issues.push({reason:'not_gold_layer1'});
    const stored = storageTimestamp(row?.created_at);
    if (stored === null) issues.push({reason:'storage_timestamp_invalid'});
    const matching = snapshots.get(row?.snapshot_id) || [];
    if (matching.length !== 1) issues.push({reason:matching.length ? 'snapshot_ambiguous' : 'snapshot_missing'});
    const snapshotAt = matching.length === 1 ? storageTimestampNanos(matching[0].created_at) : null;
    const storedNanos = storageTimestampNanos(row?.created_at);
    if (matching.length === 1 && (snapshotAt === null || storedNanos === null || snapshotAt > storedNanos)) issues.push({reason:'snapshot_not_proven_stored_before_output'});
    const features = [];
    for (const name of FACTORS) {
      const factor = row?.factor_breakdown?.[name];
      if (!SIGNALS.includes(factor?.signal)) { issues.push({name,reason:'factor_signal_missing_or_invalid'}); continue; }
      if (stored !== null) features.push({ name, value:factor.signal, available_at:new Date(stored).toISOString(),
        source:'Supabase agent_outputs.factor_breakdown (storage-time upper bound)',
        source_record_id:row.id });
    }
    const entry = stored === null ? null : (Math.floor(stored / 60000) + 1) * 60000;
    const end = entry === null ? null : entry + protocol.horizon_ms;
    if (end !== null && !Number.isFinite(new Date(end).getTime())) throw new Error('Horizon outside supported date range.');
    return {prediction_id:row?.id, market:'XAUUSD', direction:row?.call_24h_direction,
      call_time:stored === null ? null : new Date(stored).toISOString(),
      entry_time:entry === null ? null : new Date(entry).toISOString(),
      horizon_end:end === null ? null : new Date(end).toISOString(),
      inputs_available_at:stored === null ? null : new Date(stored).toISOString(),
      original_storage_timestamp:row?.created_at ?? null,
      original_run_time_et:row?.run_time_et ?? null,
      source_snapshot_id:row?.snapshot_id ?? null,
      source_snapshot_created_at:matching[0]?.created_at ?? null,
      logic_document_version:row?.logic_document_version ?? null,
      features, input_rejections:issues};
  });
  const count = values => Object.fromEntries([...new Set(values)].sort().map(value => [value,values.filter(v=>v===value).length]));
  const timestamps = calls.map(row=>row.call_time).filter(Boolean).sort();
  const snapshotCounts = count(calls.map(row=>row.source_snapshot_id).filter(Boolean));
  const audit = { version:'gold-stored-call-evidence-v1', research_only:true,
    retrieved_at:bundle.retrieved_at ?? null, protocol,
    outputs:calls.length, first_stored_call:timestamps[0] ?? null, last_stored_call:timestamps.at(-1) ?? null,
    calls_with_input_rejections:calls.filter(row=>row.input_rejections.length).length,
    issue_counts:count(calls.flatMap(row=>row.input_rejections.map(issue=>issue.reason))),
    direction_counts:count(calls.map(row=>String(row.direction))),
    distinct_storage_dates:new Set(timestamps.map(t=>t.slice(0,10))).size,
    distinct_linked_snapshots:Object.keys(snapshotCounts).length,
    repeated_snapshot_groups:Object.values(snapshotCounts).filter(n=>n>1).length,
    factor_coverage:Object.fromEntries(FACTORS.map(name=>[name,calls.filter(row=>row.features.some(f=>f.name===name)).length])),
    actual_dashboard_publication_verified:false, raw_feature_release_times_verified:false,
    contemporaneous_l2l_levels_verified:false, executable_trade_validated:false,
    limitations:[
      'Database created_at is a storage-time proxy, not independently verified decision or dashboard publication time.',
      'Stored factor signals are evaluated as recorded; source release vintages and raw-input derivation are not authenticated.',
      'Current rows are not an immutable historical log; retrieval hashes establish this export only.',
      'Repeated calls and shared snapshots are dependent observations; counts are not independent trials.',
      'Next-minute entry and the explicit horizon are research assumptions; no production rule or weight is changed.'
    ] };
  return {audit,dataset:{version:'gold-stored-call-dataset-v1',data_kind:'observed_stored_gold_calls_storage_time_proxy',
    protocol, config:{candle_interval_ms:60000,price_basis:'mid',flat_threshold_pct:protocol.flat_threshold_pct,
      entry_policy:'next_interval_open_after_call',max_entry_delay_ms:60000}, calls,candles:[]}};
}

module.exports = { storageTimestamp, storageTimestampNanos, prepareGoldStoredCalls };
