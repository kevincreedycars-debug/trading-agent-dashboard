// Guard for the sanitised n8n flow data the Architecture map draws.
//
// The map must never load a raw n8n export. `scripts/build_factory_flows.js` copies an allowlist of fields out of the
// committed Layer 1 agent exports into `lib/factory-flows.js`; this test holds four contracts:
//   1. the committed data still matches the exports it names (run the builder with --check);
//   2. every node, type and connection in the data is the export's own, and the order is a real walk of the graph;
//   3. nothing credential-shaped, no URL and no provider endpoint survived the copy;
//   4. USD is labelled verified only because a dossier walks it, and every other agent says "documented workflow".
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "lib", "factory-flows.js");
const docPath = path.join(repoRoot, "docs", "dashboard-design", "n8n-agent-flows.md");

function loadFlows() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), sandbox, { filename: "lib/factory-flows.js" });
  // Round-tripped through JSON so the sandbox's array prototypes cannot make identical data compare unequal.
  return JSON.parse(JSON.stringify(sandbox.window.FactoryFlows));
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

test("the committed flow data matches the agent exports byte for byte", () => {
  const result = spawnSync(process.execPath, ["scripts/build_factory_flows.js", "--check"], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /factory flows current/);
});

test("every node and connection in the data is the export's own", () => {
  const flows = loadFlows();
  assert.equal(flows.schemaVersion, "factory-flows-v1");
  assert.deepEqual(Object.keys(flows.assets).sort(), ["BTC", "EUR", "GOLD", "NQ", "SILVER", "USD"]);

  for (const [code, flow] of Object.entries(flows.assets)) {
    const raw = fs.readFileSync(path.join(repoRoot, flow.exportPath));
    const exported = JSON.parse(raw.toString("utf8"));
    assert.equal(flow.source.sha256, crypto.createHash("sha256").update(raw).digest("hex"), `${code} sha256`);
    assert.equal(flow.source.bytes, raw.length, `${code} byte count`);
    assert.equal(flow.source.nodes, exported.nodes.length, `${code} node count`);
    assert.deepEqual(
      flow.nodes.map(node => node.name),
      exported.nodes.map(node => node.name),
      `${code} keeps the export's node names, in the export's order`
    );
    flow.nodes.forEach(node => {
      const source = exported.nodes.find(candidate => candidate.name === node.name);
      assert.equal(node.type, source.type, `${code} ${node.name} type`);
      assert.equal(node.typeVersion, String(source.typeVersion), `${code} ${node.name} type version`);
      assert.ok(node.purpose.length > 40, `${code} ${node.name} carries a written purpose`);
    });

    const expectedEdges = [];
    const connections = exported.connections || {};
    Object.keys(connections).forEach(from => {
      (connections[from].main || []).forEach(branch => {
        (branch || []).forEach(link => expectedEdges.push(`${slug(from)}>${slug(link.node)}`));
      });
    });
    assert.deepEqual(flow.edges.map(edge => `${edge.from}>${edge.to}`).sort(), expectedEdges.sort(), `${code} edges`);
    assert.equal(flow.edges.length, flow.source.edges, `${code} edge count`);

    // The order the panel prints is a real walk: every edge starts earlier than it ends, and the trigger is first.
    const position = new Map(flow.order.map((id, index) => [id, index]));
    assert.deepEqual(
      [...flow.order].sort(),
      flow.nodes.map(node => node.id).sort(),
      `${code} order is a permutation`
    );
    flow.edges.forEach(edge => {
      assert.ok(
        position.get(edge.from) < position.get(edge.to),
        `${code} ${edge.from} -> ${edge.to} runs forwards in the panel's order`
      );
    });
    const trigger = flow.nodes.find(node => node.role === "trigger");
    assert.equal(flow.order[0], trigger.id, `${code} starts at the trigger`);

    // Joins and branches are derived, not asserted: these exports are single chains and the data says so.
    assert.deepEqual(flow.joins, [], `${code} declares no join it cannot show`);
    assert.deepEqual(flow.branches, [], `${code} declares no branch it cannot show`);
  }
});

test("no credential, URL, provider endpoint or identifier reached the data", () => {
  // The module's own header comment names the fields it strips; the scan is over the data it exports. The one
  // deliberate long hex string is the export's own sha256, which is a content hash and is checked separately.
  const flows = loadFlows();
  for (const flow of Object.values(flows.assets)) {
    assert.match(flow.source.sha256, /^[0-9a-f]{64}$/, `${flow.code} carries the export's sha256`);
  }
  const scan = loadFlows();
  for (const flow of Object.values(scan.assets)) delete flow.source.sha256;
  const data = JSON.stringify(scan);
  const forbidden = [
    [/https?:\/\//i, "a URL"],
    [/\bapi[_-]?key\b/i, "an API key"],
    [/\btoken\b/i, "a token"],
    [/\bsecret\b/i, "a secret"],
    [/\bpassword\b/i, "a password"],
    [/\bcredential/i, "a credential"],
    [/\bwebhook\b/i, "a webhook"],
    [/[\w.+-]+@[\w-]+\.[\w.]+/, "an email address"],
    [/\bsupabase\.co\b/i, "a provider endpoint"],
    [/\b[0-9a-f]{32,}\b/i, "a credential-shaped hex string"],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, "a UUID"]
  ];
  for (const [pattern, why] of forbidden) {
    assert.doesNotMatch(data, pattern, `factory-flows.js must not carry ${why}`);
  }
  for (const flow of Object.values(flows.assets)) {
    assert.doesNotMatch(flow.exportPath, /collector/, "a collector export is never the flow's source");
    assert.ok(fs.existsSync(path.join(repoRoot, flow.exportPath)), `${flow.exportPath} is committed`);
  }
  // The generated module must also keep the raw export's parameters out: no node carries a parameters field.
  assert.doesNotMatch(data, /"parameters"/, "node parameters are dropped");
});

test("USD alone is verified, and every other agent is labelled a documented workflow", () => {
  const flows = loadFlows();
  assert.equal(flows.assets.USD.status, "verified");
  assert.equal(flows.assets.USD.statusLabel, "Verified flow");
  assert.deepEqual(flows.assets.USD.verifiedBy.map(row => row[0]), ["docs/analysis-engine/USD_LAYER1_LOGIC.md"]);
  for (const code of ["EUR", "GOLD", "SILVER", "NQ", "BTC"]) {
    assert.equal(flows.assets[code].status, "documented", `${code} is a documented workflow`);
    assert.equal(flows.assets[code].statusLabel, "Documented workflow");
    assert.deepEqual(flows.assets[code].verifiedBy, [], `${code} claims no verification`);
    assert.match(flows.assets[code].note, /checked-in export/, `${code} says what the diagram is`);
  }

  const doc = fs.readFileSync(docPath, "utf8");
  assert.match(doc, /A checked-in export is a saved snapshot/);
  assert.match(doc, /does not establish/);
  assert.match(doc, /What is deliberately absent/);
  for (const flow of Object.values(flows.assets)) {
    flow.nodes.forEach(node => {
      assert.ok(doc.includes(`\`${node.name}\``), `the written page lists ${node.name}`);
      assert.ok(doc.includes(node.purpose), `the written page carries the purpose of ${node.name}`);
    });
  }
});

test("the data names its upstream and downstream evidence, and every path resolves", () => {
  const flows = loadFlows();
  for (const [code, flow] of Object.entries(flows.assets)) {
    const rows = [flow.upstream.direct.evidence, flow.upstream.storage.evidence, flow.downstream.evidence];
    for (const [href] of rows) {
      assert.ok(fs.existsSync(path.join(repoRoot, href)), `${code} evidence ${href} is committed`);
    }
    assert.match(flow.upstream.direct.label, /Master Orchestrator/);
    assert.match(flow.upstream.storage.label, /market_snapshots/);
    assert.match(flow.downstream.label, /Dashboard Writer/);
  }
});
