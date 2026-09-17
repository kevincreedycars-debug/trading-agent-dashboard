const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { run } = require('../scripts/acquire_gold_event_archive');

test('calendar acquisition bounds partial months, separates filters and hashes complete evidence', async () => {
  const root = fs.mkdtempSync(path.resolve(__dirname, '../tmp/event-acquisition-'));
  const output = path.join(root, 'archive');
  const oldFetch = global.fetch, oldKey = process.env.RAPIDAPI_KEY;
  process.env.RAPIDAPI_KEY = 'test-only';
  const requests = [];
  global.fetch = async url => {
    const params = new URL(url).searchParams; requests.push(params);
    return { ok: true, text: async () => JSON.stringify({ success: true, totalEvents: 1, data: [{
      id: params.get('volatility'), countryCode: 'US', volatility: params.get('volatility'), dateUtc: '2024-02-29T12:00:00Z'
    }] }) };
  };
  try {
    await run([output, '2024-02-15', '2024-02-29', 'HIGH,MEDIUM']);
    const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json')));
    assert.equal(manifest.complete, true); assert.equal(manifest.rows, 2);
    assert.deepEqual(requests.map(p => p.get('volatility')), ['HIGH', 'MEDIUM']);
    assert.ok(requests.every(p => p.get('startDate') === '2024-02-15' && p.get('endDate') === '2024-02-29'));
    const raw = fs.readFileSync(path.join(output, 'events.json'));
    assert.equal(manifest.output_sha256, crypto.createHash('sha256').update(raw).digest('hex'));
    await assert.rejects(run([output, '2024-02-15', '2024-02-29', 'HIGH']), /EEXIST/);
    await assert.rejects(run([path.join(root, 'bad-date'), '2024-02-30', '2024-03-01', 'HIGH']), /Invalid/);
    global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ success: true, totalEvents: 1,
      data: [{ id: 'wrong-filter', countryCode: 'US', volatility: 'LOW', dateUtc: '2024-02-20T12:00:00Z' }] }) });
    const bad = path.join(root, 'mismatch');
    await assert.rejects(run([bad, '2024-02-15', '2024-02-29', 'HIGH']), /filter-mismatched/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(bad, 'manifest.json'))).complete, false);
    assert.equal(fs.existsSync(path.join(bad, 'events.json')), false);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.RAPIDAPI_KEY; else process.env.RAPIDAPI_KEY = oldKey;
  }
});
