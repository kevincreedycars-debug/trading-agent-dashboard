const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGoldHistoryPatch } = require('../lib/gold_history_patch_validation');
const workflow = require('../../exports/gold_collector.json');
const patch = require('../drafts/gold_collector_history_query_patch.json');

test('exported Gold normalization satisfies the offline history patch contract', () => {
  const result = validateGoldHistoryPatch(workflow, patch);
  assert.equal(result.checks.length, 6);
  assert.equal(result.synthetic_rows, 600);
  assert.equal(result.installed_n8n_validated, false);
});

test('offline history validation detects query truncation and consumer drift', () => {
  const truncated = structuredClone(patch); truncated.replacement_parameters.limit = 25;
  assert.throws(() => validateGoldHistoryPatch(workflow, truncated));
  const changed = structuredClone(workflow);
  const node = changed.nodes.find(node => node.name === 'Normalise Market Snapshot');
  node.parameters.jsCode = node.parameters.jsCode.replace('historyPct(goldPrice, "gold_price", 19)', 'historyPct(goldPrice, "gold_price", 4)');
  assert.throws(() => validateGoldHistoryPatch(changed, patch));
});
