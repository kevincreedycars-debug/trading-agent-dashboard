// Explicit local suite: warehouse-writing integration tests require a separate run.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['evaluation_pipeline.test.js', 'replay_smoke.test.js']);
const mode = process.argv[2] || 'all';
if (!['all', 'unit', 'browser'].includes(mode)) throw new Error(`Unknown test mode: ${mode}`);
function discover(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return discover(full);
    if (!entry.name.endsWith('.test.js') || excluded.has(entry.name)) return [];
    const browser = entry.name.includes('.browser.');
    return mode === 'all' || (mode === 'browser') === browser ? [full] : [];
  });
}
const files = ['backtester/tests', 'tests', 'macro-engine/tests'].flatMap(dir => discover(path.join(root, dir))).sort();
console.log(`Running ${files.length} local test files (${mode}); linked warehouse suites excluded.`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
