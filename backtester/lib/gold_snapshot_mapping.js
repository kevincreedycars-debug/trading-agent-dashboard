const { GOLD_VARIABLES } = require('./gold_source_readiness');
const { parseTimestamp } = require('./gold_timestamped_evaluation');
const { storageTimestamp } = require('./gold_stored_call_evidence');

// Coverage audit only: mapped storage values never become publication-qualified features.
function auditSnapshotMappings(bundle) {
  if (!Array.isArray(bundle?.snapshots)) throw new Error('snapshots array required');
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const present = value => numeric(value) || (typeof value === 'string' && value.trim() !== '') || typeof value === 'boolean';
  const counts = Object.fromEntries(GOLD_VARIABLES.map(name => [name, { name, exact: 0, mapped: 0, source_paths: new Set() }]));
  const eventSources = {}, rejections = {}, releases = new Set();
  const reject = reason => { rejections[reason] = (rejections[reason] || 0) + 1; };
  for (const snapshot of bundle.snapshots) {
    const found = new Set();
    for (const name of GOLD_VARIABLES) {
      if (present(snapshot[name])) { counts[name].exact++; counts[name].source_paths.add(name); found.add(name); }
    }
    const map = (name, value, source) => {
      if (!found.has(name) && present(value)) { counts[name].mapped++; counts[name].source_paths.add(source); found.add(name); }
    };
    map('growth_regime', snapshot.global_growth_regime, 'global_growth_regime');
    const wrapper = snapshot.latest_us_event;
    const source = wrapper?.raw?.source ?? wrapper?.source ?? 'unknown_or_absent';
    eventSources[source] = (eventSources[source] || 0) + 1;
    if (!wrapper) { reject('no_event'); continue; }
    if ([wrapper.source, wrapper.raw?.source].includes('fixture')) { reject('fixture_event'); continue; }
    if (source !== 'economic_calendar_rapidapi') { reject('unreviewed_event_schema'); continue; }
    const event = wrapper.raw?.raw_json;
    const released = parseTimestamp(event?.dateUtc), stored = storageTimestamp(snapshot.created_at);
    if (!event?.id || !event.eventId || event.countryCode !== 'US' || released === null) { reject('invalid_vendor_identity_or_release'); continue; }
    if (stored === null || released > stored) { reject('invalid_storage_time_or_future_release'); continue; }
    releases.add(event.id);
    const prefix = 'latest_us_event.raw.raw_json';
    map('event_type', event.name, `${prefix}.name`);
    map('event_actual', numeric(event.actual) ? event.actual : null, `${prefix}.actual`);
    map('event_consensus', numeric(event.consensus) ? event.consensus : null, `${prefix}.consensus`);
    map('event_surprise', numeric(event.actual) && numeric(event.consensus) ? event.actual - event.consensus : null, `${prefix}.actual - ${prefix}.consensus (vendor units, within family only)`);
    map('event_age_hours', (stored - released) / 3600000, `created_at - ${prefix}.dateUtc (storage proxy hours)`);
    // Vendor previous can be revised; it is not evidence of previous-as-released.
  }
  return { version: 'gold-snapshot-mapping-v1', research_only: true, publication_timing_verified: false,
    snapshot_count: bundle.snapshots.length, event_source_counts: eventSources, event_rejections: rejections,
    unique_reviewed_vendor_releases: releases.size,
    variables: Object.values(counts).map(row => ({ ...row, source_paths: [...row.source_paths],
      absent: bundle.snapshots.length - row.exact - row.mapped })),
    unresolved: {
      inflation_signal: 'No exact field or reviewed derivation; inflation releases alone do not define this regime.',
      risk_headline_context: 'geopolitical_risk_flag is narrower than headline context and is not an equivalent alias.',
      event_previous_as_released: 'Vendor previous/revised fields do not authenticate the originally released prior value.'
    },
    limitations: ['Mapped values are storage evidence only, not historical availability evidence.',
      'Storage timestamps use the existing millisecond normalization; raw timestamps remain in the hashed source.',
      'Repeated snapshots do not add independent releases. Unknown legacy event schemas remain excluded.',
      'Numeric surprises retain event-family units; they cannot be pooled across families.'] };
}
module.exports = { auditSnapshotMappings };
