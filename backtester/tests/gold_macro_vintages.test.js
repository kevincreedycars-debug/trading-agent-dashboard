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
