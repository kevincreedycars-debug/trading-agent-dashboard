'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const catalog = require('../data/research-library/catalog.json');
const baseline = require('../docs/research-library/PROMPT_V310_BASELINE.json');
const { createPipeline } = require('../lib/research_pipeline.js');
const { createStore } = require('../lib/research_library_store.js');
const Library = require('../lib/research_library.js');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const chains = [...catalog.factor_chains, catalog.final_chain];

test('North Star revision preserves all 78 identities and existing document bytes', () => {
  assert.equal(catalog.prompt_template.version, 'research-prompt-v3.2.0');
  assert.equal(chains.flatMap(c => c.stages).length, 78);
  assert.equal(sha(fs.readFileSync(path.join(root, 'data/research-library/documents.json'))), baseline.registry_sha256);
  assert.equal(sha(fs.readFileSync(path.join(root, 'docs/research-library/USD_North_Star_Model_Contract_v2.md'))), 'e39e13098829fd2f61e53a8430277bcbf04ba103b8ef9f93b914847c19e8369f');
  assert.deepEqual(Library.validateCatalog(catalog), []);
  for (const prior of baseline.chains) {
    const chain = chains.find(c => c.chain_id === prior.chain_id);
    assert.ok(chain);
    assert.equal(chain.factor_id || null, prior.factor_id);
    assert.equal(chain.topic_id || null, prior.topic_id);
    for (const old of prior.stages) {
      const stage = chain.stages.find(s => s.stage === old.stage);
      for (const key of ['stage', 'document_type', 'prompt_path']) assert.equal(stage[key], old[key]);
      assert.equal(stage.parent_stage || '', old.parent_stage);
      const bytes = fs.readFileSync(path.join(root, stage.prompt_path));
      assert.equal(sha(bytes), stage.prompt_sha256);
      assert.equal(bytes.length, stage.prompt_bytes);
      assert.notEqual(stage.prompt_sha256, old.prompt_sha256);
      assert.match(bytes.toString(), /research-prompt-v3\.2\.0/);
      assert.match(bytes.toString(), /USD_North_Star_Model_Contract_v2\.md/);
    }
  }
});

test('all 75 factor prompts retrieve through unchanged dispatcher using isolated fixture parents', () => {
  // Synthetic transport fixtures only; no report generation, real registration, dispatch or model call.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'usd-prompt-retrieval-'));
  const registryPath = path.join(scratch, 'documents.json');
  const libraryRoot = path.join(scratch, 'objects');
  const stateRoot = path.join(scratch, 'queue');
  const store = createStore({ root: libraryRoot, registryPath });
  const pipeline = createPipeline({ root, catalog, registryPath, libraryRoot, stateRoot, store });
  let retrieved = 0;
  for (const chain of catalog.factor_chains) {
    let parent = null;
    for (const stage of chain.stages) {
      const envelope = pipeline.envelope(chain.topic_id, stage.stage, { chain: chain.chain_id });
      assert.equal(envelope.prompt.sha256, stage.prompt_sha256);
      assert.equal(envelope.prompt.text, fs.readFileSync(path.join(root, stage.prompt_path), 'utf8'));
      retrieved++;
      const documentId = `fixture-${chain.chain_id}-${stage.stage}`;
      store.registerUpload({ document_id: documentId, asset: 'USD', chain_id: chain.chain_id,
        factor_id: chain.factor_id, topic_id: chain.topic_id, stage: stage.stage,
        document_type: stage.document_type, title: 'TRANSPORT FIXTURE - NOT RESEARCH', model: 'no-model-fixture',
        parent_document_id: parent || '', parent_version: parent ? 1 : null,
        content_text: `# TRANSPORT FIXTURE ONLY\n${documentId}\nNo economic findings or research were generated.\n` }, catalog);
      parent = documentId;
    }
  }
  assert.equal(retrieved, 75);
  assert.equal(fs.existsSync(path.join(stateRoot, 'queue.json')), false);
  // The existing planner excludes final stages even after fixture parents are complete. Do not bypass its gate.
  assert.equal(pipeline.plan().length, 75);
  assert.equal(Library.finalChainStatus(catalog, store.readRegistry()).unlocked, true);
  for (const stage of catalog.final_chain.stages) {
    assert.equal(sha(fs.readFileSync(path.join(root, stage.prompt_path))), stage.prompt_sha256);
  }
  // Retain fixtures in the OS temporary directory for inspection; no recursive deletion is needed.
});
