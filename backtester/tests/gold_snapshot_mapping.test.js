const test = require('node:test');
const assert = require('node:assert/strict');
const { auditSnapshotMappings } = require('../lib/gold_snapshot_mapping');
const snapshot = () => ({ created_at: '2024-01-02T14:00:00.123456+00:00', global_growth_regime: 'neutral',
  geopolitical_risk_flag: 'false', latest_us_event: { raw: { source: 'economic_calendar_rapidapi', raw_json: {
    id: 'release-1', eventId: 'family-1', countryCode: 'US', name: 'PMI', dateUtc: '2024-01-02T13:00:00Z',
    actual: 0, consensus: 1, previous: 2, revised: 3 } } } });
test('reviewed aliases retain provenance, zero values and unique release counts without authenticating timing', () => {
  const report = auditSnapshotMappings({ snapshots: [snapshot(), snapshot()] });
  const byName = Object.fromEntries(report.variables.map(row => [row.name, row]));
  assert.equal(byName.growth_regime.mapped, 2);
  assert.equal(byName.event_actual.mapped, 2);
  assert.equal(byName.event_surprise.mapped, 2);
  assert.equal(byName.event_previous_as_released.absent, 2);
  assert.equal(byName.risk_headline_context.absent, 2);
  assert.equal(report.unique_reviewed_vendor_releases, 1);
  assert.equal(report.publication_timing_verified, false);
});
test('fixtures, future releases and unreviewed schemas cannot populate nested research mappings', () => {
  const fixture = snapshot(), future = snapshot(), legacy = snapshot();
  fixture.latest_us_event.source = 'fixture';
  future.created_at = '2024-01-02T12:00:00Z';
  legacy.latest_us_event.raw.source = 'surprises';
  const report = auditSnapshotMappings({ snapshots: [fixture, future, legacy] });
  assert.equal(report.variables.find(row => row.name === 'event_actual').absent, 3);
  assert.equal(report.event_rejections.fixture_event, 1);
  assert.equal(report.event_rejections.invalid_storage_time_or_future_release, 1);
  assert.equal(report.event_rejections.unreviewed_event_schema, 1);
});
test('exact fields take precedence and string measurements are not silently coerced', () => {
  const row = snapshot(); row.growth_regime = 'exact'; row.latest_us_event.raw.raw_json.actual = '0';
  const report = auditSnapshotMappings({ snapshots: [row] });
  assert.equal(report.variables.find(item => item.name === 'growth_regime').mapped, 0);
  assert.equal(report.variables.find(item => item.name === 'event_actual').absent, 1);
  assert.equal(report.variables.find(item => item.name === 'event_surprise').absent, 1);
});
