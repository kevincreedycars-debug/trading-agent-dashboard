const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });

test('local Gold commands preserve source hashes and label synthetic results', () => {
  const directory = fs.mkdtempSync(path.join(root, 'tmp/gold-cli-'));
  const source = path.join(root, 'backtester/fixtures/gold_timestamped.synthetic.json');
  const expectedHash = crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
  for (const [script, extra] of [
    ['evaluate_gold_timestamped.js', []],
    ['build_gold_chronological_factors.js', ['2024-01-08T15:00:00Z', '0']]
  ]) {
    const output = path.join(directory, `${script}.json`);
    execFileSync(process.execPath, [path.join(root, 'backtester/scripts', script), source, output, ...extra]);
    const report = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(report.source_sha256, expectedHash);
    assert.equal(report.data_kind, 'synthetic_contract_example_not_market_evidence');
    assert.equal(report.research_only, true);
    const rejected = spawnSync(process.execPath, [path.join(root, 'backtester/scripts', script), source, source, ...extra]);
    assert.notEqual(rejected.status, 0);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), expectedHash);
  }
});

test('audit HTML embeds data safely and rejects colliding outputs before writing', () => {
  const directory = fs.mkdtempSync(path.join(root, 'tmp/gold-page-cli-'));
  const input = path.join(directory, 'source.json'), output = path.join(directory, 'audit.json'), html = path.join(directory, 'page.html');
  fs.writeFileSync(input, JSON.stringify({ meta: { asset: 'GOLD', generated_at: '</script><script>throw Error(1)</script>' }, rows: [] }));
  const command = path.join(root, 'backtester/scripts/build_gold_evidence_audit.js');
  execFileSync(process.execPath, [command, input, output, html]);
  const page = fs.readFileSync(html, 'utf8');
  assert.equal(page.includes('</script><script>throw Error(1)</script>'), false);
  assert.ok(page.includes('\\u003c/script>'));
  const previous = fs.readFileSync(output, 'utf8');
  const rejected = spawnSync(process.execPath, [command, input, output, output]);
  assert.notEqual(rejected.status, 0);
  assert.equal(fs.readFileSync(output, 'utf8'), previous);
});

test('as-of command output runs directly through the timestamped command', () => {
  const directory = fs.mkdtempSync(path.join(root, 'tmp/gold-asof-cli-'));
  const input = structuredClone(require('../fixtures/gold_timestamped.synthetic.json'));
  input.feature_contract = ['F1', 'F2'].map(name => ({ name, required: true, max_age_ms: 3600000 }));
  input.feature_records = input.calls.flatMap(call => call.features.map(feature => ({ ...feature,
    observed_at: feature.available_at, source: 'synthetic-only' })));
  const source = path.join(directory, 'source.json'), prepared = path.join(directory, 'prepared.json'), output = path.join(directory, 'results.json');
  fs.writeFileSync(source, JSON.stringify(input));
  execFileSync(process.execPath, [path.join(root, 'backtester/scripts/build_gold_asof_dataset.js'), source, prepared]);
  execFileSync(process.execPath, [path.join(root, 'backtester/scripts/evaluate_gold_timestamped.js'), prepared, output]);
  const report = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(report.evaluable_calls, 2);
  assert.equal(report.data_kind, 'synthetic_contract_example_not_market_evidence');
});
