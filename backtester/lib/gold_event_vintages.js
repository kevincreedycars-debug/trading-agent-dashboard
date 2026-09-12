const { parseTimestamp } = require('./gold_timestamped_evaluation');
function attachEventVintages(dataset, events, options = {}) {
  if (!Array.isArray(events) || !Array.isArray(dataset?.calls)) throw new Error('Event array and dataset calls required');
  const mode = options.mode ?? 'as_of_proxy';
  if (!['as_of_proxy', 'retrospective'].includes(mode)) throw new Error('Unknown event evidence mode');
  const parsed = events.map(event => {
    const released = parseTimestamp(event.dateUtc);
    const updated = typeof event.lastUpdated === 'number' && Number.isSafeInteger(event.lastUpdated * 1000) ? event.lastUpdated * 1000 : null;
    return { event, released, updated };
  });
  const audit = { mode, historical_availability_verified: false,
    scheduled_calls: dataset.calls.length, calls_with_eligible_event: 0, calls_with_only_later_or_unknown_vintages: 0,
    calls_with_recent_release_but_missing_values: 0,
    calls_without_recent_release: 0, recent_window_hours: 72, source_events: events.length,
    pre_release_consensus_verified: false, decision_details: [] };
  const calls = dataset.calls.map(call => {
    const cutoff = parseTimestamp(call.call_time);
    const recent = parsed.filter(row => row.released !== null && row.released <= cutoff && cutoff - row.released <= 72 * 3600000);
    const numericEvents = recent.filter(row =>
      typeof row.event.actual === 'number' && Number.isFinite(row.event.actual) &&
      typeof row.event.consensus === 'number' && Number.isFinite(row.event.consensus) && row.event.eventId);
    const eligible = numericEvents.filter(row => mode === 'retrospective' || (row.updated !== null && row.updated >= row.released && row.updated <= cutoff));
    const status = eligible.length ? (mode === 'retrospective' ? 'retrospective_archive_association' : 'eligible_current_archive_proxy') :
      numericEvents.length ? 'later_or_unknown_vintages' : recent.length ? 'recent_release_missing_values' : 'no_recent_release';
    if (eligible.length) audit.calls_with_eligible_event++;
    else if (numericEvents.length) audit.calls_with_only_later_or_unknown_vintages++;
    else if (recent.length) audit.calls_with_recent_release_but_missing_values++;
    else audit.calls_without_recent_release++;
    audit.decision_details.push({ prediction_id: call.prediction_id, status, recent_releases: recent.length, eligible_events: eligible.length });
    const latest = new Map();
    for (const row of eligible.sort((a, b) => a.released - b.released || a.updated - b.updated)) {
      const previous = latest.get(row.event.eventId);
      if (previous && previous.released === row.released && previous.updated === row.updated) throw new Error('Ambiguous event vintage');
      latest.set(row.event.eventId, row);
    }
    const features = [];
    for (const { event, released, updated } of latest.values()) {
      const metadata = { available_at: updated === null ? null : new Date(updated).toISOString(), observed_at: new Date(released).toISOString(),
        source: 'economic-calendar-api current historical archive', source_record_id: `${event.id}:${event.lastUpdated}`,
        timing_basis: mode === 'retrospective' ? 'retrospective_availability_not_established' : 'vendor_lastUpdated_proxy',
        event_name: event.name, units: event.unit ?? 'vendor_unspecified' };
      features.push({ ...metadata, name: `event_${event.eventId}_surprise`,
        value: event.actual > event.consensus ? 'above_consensus' : event.actual < event.consensus ? 'below_consensus' : 'at_consensus' });
      features.push({ ...metadata, name: `event_${event.eventId}_age_hours`, value: (cutoff - released) / 3600000 });
    }
    // Retrospective values must never masquerade as timestamp-validated model inputs.
    return mode === 'retrospective' ? { ...call, retrospective_event_features: features } :
      { ...call, features: [...(call.features || []), ...features] };
  });
  return { ...dataset, calls, event_vintage_audit: audit };
}
module.exports = { attachEventVintages };
