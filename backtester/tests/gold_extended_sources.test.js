const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { run } = require('../scripts/merge_gold_event_archives');
const { buildMacroDataset, SERIES } = require('../lib/gold_macro_vintage_dataset');
const { score, blockDiagnostic } = require('../scripts/summarize_gold_research');

test('calendar union requires complete adjacent hashed sources and preserves version timestamps', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gold-merge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const make = (name, day) => {
    const dir = path.join(root, name); fs.mkdirSync(dir);
    const raw = JSON.stringify([{ id: name, dateUtc: `${day}T13:30:00Z`, lastUpdated: 999, countryCode: 'US', volatility: 'HIGH' }]);
    fs.writeFileSync(path.join(dir, 'events.json'), raw);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ complete: true, start_date: day, end_date: day, rows: 1, impacts: ['HIGH'], output_sha256: crypto.createHash('sha256').update(raw).digest('hex') }));
    return dir;
  };
  const a = make('a', '2023-01-01'), b = make('b', '2023-01-02'), c = make('c', '2023-01-04');
  const output = path.join(root, 'merged');
  assert.equal(run([output, b, a]).rows, 2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'events.json')))[0].lastUpdated, 999);
  assert.throws(() => run([output, a, b]), /exists/);
  assert.throws(() => run([path.join(root, 'gap'), a, c]), /adjacent/);
  assert.throws(() => run([path.join(root, 'overlap'), a, a]), /adjacent/);
  fs.appendFileSync(path.join(b, 'events.json'), ' ');
  assert.throws(() => run([path.join(root, 'tampered'), a, b]), /changed/);
});

test('extended schedule retains exact 24h windows and vintage availability before 2024', () => {
  const payloads = Object.fromEntries(Object.keys(SERIES).map(id => [id, { observations: [
    { date: '2022-12-30', realtime_start: '2022-12-30', value: '1' },
    { date: '2022-12-30', realtime_start: '2023-02-01', value: '9' }
  ] }]));
  const { dataset } = buildMacroDataset(payloads, { instrument: 'XAU_USD', granularity: 'H1', candles: [] }, { start_date: '2023-01-02', end_date: '2023-01-03' });
  assert.equal(dataset.calls.length, 2);
  for (const call of dataset.calls) {
    assert.equal(Date.parse(call.horizon_end) - Date.parse(call.call_time), 86400000);
    assert.equal(call.features.find(row => row.name === 'vix_level').value, 1);
  }
});

test('diagnostic denominators retain flats and paired block comparison uses feature-usable days', () => {
  const rows = ['01', '02', '03'].flatMap(month => [
    { decision_time: `2026-${month}-01T14:00:00Z`, sign: 1, values: { x: 1 } },
    { decision_time: `2026-${month}-02T14:00:00Z`, sign: -1, values: { x: 0 } },
    { decision_time: `2026-${month}-03T14:00:00Z`, sign: 0, values: { x: 1 } },
    { decision_time: `2026-${month}-04T14:00:00Z`, sign: -1, values: {} }
  ]);
  assert.deepEqual(score(rows.slice(0, 3), 1), { observations: 3, correct: 1, wrong: 1, flat: 1, directional_accuracy_pct: 50, accuracy_including_flat_pct: 100 / 3 });
  const conditions = [{ feature: 'x', operator: 'eq', value: 1 }];
  const result = blockDiagnostic(rows, conditions, 1, 50);
  assert.equal(result.accuracy_pct.lower, 100);
  assert.equal(result.matched_minus_usable_pp.lower, 50);
  assert.deepEqual(result, blockDiagnostic(rows, conditions, 1, 50));
  assert.equal(blockDiagnostic(rows, [{ feature: 'absent', operator: 'eq', value: 1 }], 1, 50).accuracy_pct, null);
});
