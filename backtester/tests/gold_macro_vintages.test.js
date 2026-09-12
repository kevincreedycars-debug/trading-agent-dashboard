const test = require('node:test');
const assert = require('node:assert/strict');
const { vintageSeries, asOfHistory } = require('../lib/gold_macro_vintage_dataset');
const { attachEventVintages } = require('../lib/gold_event_vintages');
test('revised macro history cannot enter earlier decisions and becomes available only after the declared lag', () => {
  const records = vintageSeries({ observations: [
    { date: '2024-01-01', realtime_start: '2024-01-03', value: '1' },
    { date: '2024-01-01', realtime_start: '2025-01-03', value: '9' }
  ] });
  assert.equal(asOfHistory(records, Date.parse('2024-01-04T11:59:59Z')).length, 0);
  assert.equal(asOfHistory(records, Date.parse('2024-01-04T12:00:00Z'))[0].value, 1);
  assert.equal(asOfHistory(records, Date.parse('2025-01-04T12:00:00Z'))[0].value, 9);
});
test('withdrawn vintages cannot fall back to earlier values of the same observation', () => {
  const records = vintageSeries({ observations: [
    { date: '2024-01-01', realtime_start: '2024-01-02', value: '1' },
    { date: '2024-01-01', realtime_start: '2024-01-03', value: '.' }
  ] });
  assert.equal(asOfHistory(records, Date.parse('2024-01-05T00:00:00Z')).length, 0);
  assert.throws(() => vintageSeries({ observations: [{ date: '2024-02-30', realtime_start: '2024-03-01', value: '1' }] }), /Invalid/);
});
test('event revisions after decision are excluded; simultaneous event families retain separate states', () => {
  const data = { calls: [{ prediction_id: 'a', call_time: '2024-01-02T14:00:00Z', features: [] }] };
  const event = { id: 'a', eventId: 'cpi', name: 'CPI', dateUtc: '2024-01-02T13:30:00Z',
    lastUpdated: Date.parse('2024-01-02T13:31:00Z') / 1000, actual: 3, consensus: 2 };
  const late = { ...event, id: 'b', eventId: 'payrolls', lastUpdated: Date.parse('2024-02-01T00:00:00Z') / 1000 };
  const other = { ...event, id: 'c', eventId: 'unemployment', actual: 1 };
  const result = attachEventVintages(data, [event, late, other]);
  assert.equal(result.calls[0].features.length, 4);
  assert.equal(result.calls[0].features.some(row => row.name.includes('payrolls')), false);
  assert.equal(result.event_vintage_audit.pre_release_consensus_verified, false);
});

test('retrospective events retain real update timestamps outside causal features and exclude future releases', () => {
  const data = { calls: [{ prediction_id: 'a', call_time: '2024-01-02T14:00:00Z', features: [] }] };
  const event = { id: 'a', eventId: 'cpi', name: 'CPI', dateUtc: '2024-01-02T13:30:00Z',
    lastUpdated: Date.parse('2025-01-02T13:31:00Z') / 1000, actual: 3, consensus: 2 };
  const future = { ...event, id: 'b', eventId: 'future', dateUtc: '2024-01-02T15:00:00Z' };
  const strict = attachEventVintages(data, [event, future]);
  assert.equal(strict.calls[0].features.length, 0);
  const result = attachEventVintages(data, [event, future], { mode: 'retrospective' });
  assert.equal(result.calls[0].features.length, 0);
  assert.equal(result.calls[0].retrospective_event_features.length, 2);
  assert.equal(result.calls[0].retrospective_event_features[0].available_at, '2025-01-02T13:31:00.000Z');
  assert.equal(result.event_vintage_audit.calls_with_eligible_event, 1);
  assert.equal(result.event_vintage_audit.historical_availability_verified, false);
  assert.deepEqual(data.calls[0].features, []);
  assert.throws(() => attachEventVintages(data, [], { mode: 'unknown' }), /Unknown/);
});

test('event coverage distinguishes missing measurements from late versions and reconciles every decision', () => {
  const calls = ['01', '05', '09', '13'].map(day => ({ prediction_id: day, call_time: `2024-01-${day}T14:00:00Z`, features: [] }));
  const event = { id: 'a', eventId: 'cpi', dateUtc: '2024-01-01T13:30:00Z', actual: 3, consensus: 2,
    lastUpdated: Date.parse('2024-01-01T13:31:00Z') / 1000 };
  const result = attachEventVintages({ calls }, [event,
    { ...event, id: 'b', dateUtc: '2024-01-05T13:30:00Z', lastUpdated: Date.parse('2025-01-01T00:00:00Z') / 1000 },
    { ...event, id: 'c', dateUtc: '2024-01-09T13:30:00Z', actual: null }]);
  const audit = result.event_vintage_audit;
  assert.equal(audit.calls_with_eligible_event, 1);
  assert.equal(audit.calls_with_only_later_or_unknown_vintages, 1);
  assert.equal(audit.calls_with_recent_release_but_missing_values, 1);
  assert.equal(audit.calls_without_recent_release, 1);
});
