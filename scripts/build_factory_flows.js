#!/usr/bin/env node
// Build the sanitised n8n flow data the Architecture map draws, from the checked-in Layer 1 agent exports.
//
// The public browser must never load a raw n8n export: those carry node parameters, credential references and
// provider endpoints. This builder copies an allowlist - node names, node types, type versions, the connection
// edges between them, and the written purpose of each step - into `lib/factory-flows.js`, and writes the same
// material as prose to `docs/dashboard-design/n8n-agent-flows.md`. Everything else in the export is dropped.
//
// Usage:
//   node scripts/build_factory_flows.js           # write both files
//   node scripts/build_factory_flows.js --check   # fail if either file has drifted from the exports
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "lib", "factory-flows.js");
const docPath = path.join(repoRoot, "docs", "dashboard-design", "n8n-agent-flows.md");

const ORDER = ["USD", "EUR", "GOLD", "SILVER", "NQ", "BTC"];

// The verified dossier describes the USD pipeline node by node against the exported code, so USD is the one flow
// the repository can call verified. Every other agent is supported by its export alone.
const VERIFIED = {
  USD: {
    path: "docs/analysis-engine/USD_LAYER1_LOGIC.md",
    label: "Verified against the export and the logic dossier",
    note:
      "The dossier walks the same export node by node and executes the scoring code against a frozen fixture. Its " +
      "eight-step table omits the combine node, which the export places between the rulebook fetch and the model " +
      "call; this diagram draws all nine nodes of the export."
  }
};

const UPSTREAM = {
  direct: {
    label: "Master Orchestrator · Execute Workflow",
    purpose:
      "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and " +
      "the snapshot is read from storage by the agent's own first data node.",
    evidence: ["workflows/master_orchestrator.md", "Master Orchestrator workflow note"]
  },
  storageRead: {
    label: "market_snapshots table",
    purpose:
      "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through " +
      "storage, so the hand-off is a stored row rather than a direct workflow invocation.",
    evidence: ["docs/HISTORICAL_DATA_INVENTORY.md", "Historical data inventory"]
  },
  storageWrite: {
    label: "agent_outputs table → Dashboard Writer",
    purpose:
      "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes " +
      "data/layer1.json; nothing downstream reads this workflow directly.",
    evidence: ["workflows/WORKFLOW_INVENTORY.md", "Workflow inventory"]
  }
};

// One row per node shape the Layer 1 agents contain. A node whose shape is not listed here fails the build, so a
// new node type cannot reach the page without somebody writing its purpose first.
const ROLES = [
  {
    test: node => node.type === "n8n-nodes-base.executeWorkflowTrigger",
    role: "trigger",
    step: "01 TRIGGER",
    purpose:
      "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data " +
      "arrives through this node.",
    inputs: "A workflow invocation from the Master Orchestrator.",
    outputs: "One empty item that starts the chain."
  },
  {
    test: node => node.type === "n8n-nodes-base.supabase" && /get|read|many/i.test(node.name),
    role: "storage-read",
    step: "02 READ",
    purpose:
      "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test " +
      "happen in the next Code node, which keeps the rule readable in one place.",
    inputs: "The market_snapshots table, through the stored Supabase connection.",
    outputs: "Every snapshot row, sorted only by the next node."
  },
  {
    test: node => node.type === "n8n-nodes-base.code" && /^Build .* Input Pack$/.test(node.name),
    role: "pack",
    step: "03 PACK",
    purpose:
      "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the " +
      "inputs that are missing. A row that fails the test is dropped rather than partially scored.",
    inputs: "The snapshot rows from the read step.",
    outputs: "One input pack: the chosen snapshot, its missing-input list and the run date."
  },
  {
    test: node => node.type === "n8n-nodes-base.github",
    role: "rulebook",
    step: "04 RULEBOOK",
    purpose:
      "Reads the agent's logic document from the repository. The rule text is fetched on every run, so the document " +
      "is an input to the call rather than a copy of it.",
    inputs: "The repository path of the agent's logic document.",
    outputs: "The rule text, as a file the next node can combine."
  },
  {
    // The Silver export fetches the same document from a Code node instead of a GitHub node. The hand-off is the
    // same; only the node type differs, and the panel prints the type the export carries.
    test: node => node.type === "n8n-nodes-base.code" && /Logic Document/i.test(node.name),
    role: "rulebook",
    step: "04 RULEBOOK",
    purpose:
      "Reads the agent's logic document inside a Code node rather than a GitHub node. The rule text is still fetched " +
      "on every run, so the document is an input to the call rather than a copy of it.",
    inputs: "The repository path of the agent's logic document.",
    outputs: "The rule text, as a file the next node can combine."
  },
  {
    test: node => node.type === "n8n-nodes-base.code" && /^Combine /i.test(node.name),
    role: "combine",
    step: "05 COMBINE",
    purpose:
      "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: " +
      "it only assembles what the two earlier branches produced.",
    inputs: "The logic document and the input pack.",
    outputs: "One prompt payload carrying the rules and the snapshot."
  },
  {
    test: node => node.type === "@n8n/n8n-nodes-langchain.openAi",
    role: "model",
    step: "06 MODEL",
    purpose:
      "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: " +
      "the scoring node re-derives every number afterwards.",
    inputs: "The combined payload: rule text, snapshot and the output contract.",
    outputs: "A drafted factor reading in the row contract."
  },
  {
    test: node => node.type === "n8n-nodes-base.code" && /^Parse /i.test(node.name),
    role: "parse",
    step: "07 PARSE",
    purpose:
      "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial " +
      "reading cannot pass as a complete one.",
    inputs: "The model's drafted reading.",
    outputs: "A structured set of factor readings plus the missing-input flags."
  },
  {
    test: node => node.type === "n8n-nodes-base.code" && /^Calculate .* Conviction$/.test(node.name),
    role: "score",
    step: "08 SCORE",
    purpose:
      "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. " +
      "The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
    inputs: "The raw snapshot and the parsed reading.",
    outputs: "The call: direction, conviction, the factor signals and the missing inputs."
  },
  {
    test: node => node.type === "n8n-nodes-base.supabase" && /create|insert|write/i.test(node.name),
    role: "storage-write",
    step: "09 WRITE",
    purpose:
      "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later " +
      "stage is invoked from inside this workflow.",
    inputs: "The finished call row.",
    outputs: "One row in agent_outputs, which the Dashboard Writer publishes."
  }
];

const FORBIDDEN = [
  { pattern: /https?:\/\//i, why: "a URL" },
  { pattern: /\bapi[_-]?key\b/i, why: "an API key reference" },
  { pattern: /\btoken\b/i, why: "a token reference" },
  { pattern: /\bsecret\b/i, why: "a secret reference" },
  { pattern: /\bpassword\b/i, why: "a password reference" },
  { pattern: /\bcredential/i, why: "a credential reference" },
  { pattern: /\bwebhook\b/i, why: "a webhook reference" },
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/, why: "an email address" },
  { pattern: /\bsupabase\.co\b/i, why: "a provider endpoint" },
  { pattern: /\b[0-9a-f]{32,}\b/i, why: "a credential-shaped hex string" },
  { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, why: "an identifier-shaped UUID" }
];

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertClean(text, where) {
  const value = String(text == null ? "" : text);
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(value)) {
      throw new Error(`${where} carries ${rule.why}: ${value.slice(0, 120)}`);
    }
  }
  return value;
}

function assertPath(relative, where) {
  if (!fs.existsSync(path.join(repoRoot, relative))) {
    throw new Error(`${where} points at ${relative}, which is not committed`);
  }
  return relative;
}

function roleFor(node, where) {
  const match = ROLES.find(entry => entry.test(node));
  if (!match) throw new Error(`${where}: no written purpose for node "${node.name}" of type ${node.type}`);
  return match;
}

function typeLabel(type) {
  if (type === "n8n-nodes-base.code") return "Code";
  if (type === "n8n-nodes-base.supabase") return "Supabase";
  if (type === "n8n-nodes-base.github") return "GitHub";
  if (type === "n8n-nodes-base.executeWorkflowTrigger") return "Execute Workflow trigger";
  if (type === "@n8n/n8n-nodes-langchain.openAi") return "OpenAI model";
  return type;
}

// The order the diagram reads in: the export's own layout is a grid, so the chain is walked from the node with no
// incoming connection. A node the walk cannot reach is appended in export order rather than dropped.
function flowOrder(flowNodes, edges) {
  const indegree = new Map(flowNodes.map(node => [node.id, 0]));
  edges.forEach(edge => indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1));
  const queue = flowNodes.filter(node => !indegree.get(node.id)).map(node => node.id);
  const seen = new Set();
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    edges.filter(edge => edge.from === id).forEach(edge => {
      indegree.set(edge.to, indegree.get(edge.to) - 1);
      if (indegree.get(edge.to) === 0) queue.push(edge.to);
    });
  }
  flowNodes.forEach(node => {
    if (!seen.has(node.id)) order.push(node.id);
  });
  return order;
}

function readExport(code) {
  const relative = `exports/${code.toLowerCase()}_layer1_agent.json`;
  const file = path.join(repoRoot, relative);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file);
  const doc = JSON.parse(raw.toString("utf8"));
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
  if (!nodes.length) throw new Error(`${relative} has no nodes`);

  const ids = new Map();
  nodes.forEach(node => {
    const id = slug(node.name);
    if (!id) throw new Error(`${relative}: node "${node.name}" has no usable slug`);
    if (ids.has(id)) throw new Error(`${relative}: node "${node.name}" collides with another node`);
    ids.set(id, node);
  });

  const edges = [];
  const connections = doc.connections || {};
  Object.keys(connections).forEach(fromName => {
    const outputs = connections[fromName] && connections[fromName].main;
    if (!Array.isArray(outputs)) return;
    outputs.forEach((branch, branchIndex) => {
      (branch || []).forEach(link => {
        if (!link || !link.node) return;
        if (!ids.has(slug(fromName)) || !ids.has(slug(link.node))) {
          throw new Error(`${relative}: connection ${fromName} -> ${link.node} names a node the export does not carry`);
        }
        edges.push({
          from: slug(fromName),
          to: slug(link.node),
          branch: branchIndex,
          input: Number.isInteger(link.index) ? link.index : 0
        });
      });
    });
  });

  const incoming = new Map();
  const outgoing = new Map();
  edges.forEach(edge => {
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1);
  });

  const flowNodes = nodes.map(node => {
    const role = roleFor(node, relative);
    const name = assertClean(node.name, `${relative}:node name`);
    return {
      id: slug(name),
      name,
      type: assertClean(node.type, `${relative}:node type`),
      typeLabel: typeLabel(node.type),
      typeVersion: String(node.typeVersion == null ? "" : node.typeVersion),
      role: role.role,
      step: role.step,
      purpose: assertClean(role.purpose, `${relative}:${node.name}`),
      inputs: assertClean(role.inputs, `${relative}:${node.name}`),
      outputs: assertClean(role.outputs, `${relative}:${node.name}`),
      evidence: VERIFIED[code]
        ? [[assertPath(VERIFIED[code].path, "verified dossier"), "The verified pipeline dossier"]]
        : [],
      incoming: incoming.get(slug(name)) || 0,
      outgoing: outgoing.get(slug(name)) || 0
    };
  });

  const verified = VERIFIED[code] || null;
  return {
    code,
    workflow: assertClean(doc.name || `${code} Layer 1 Agent`, `${relative}:workflow name`),
    exportPath: relative,
    order: flowOrder(flowNodes, edges),
    status: verified ? "verified" : "documented",
    statusLabel: verified ? "Verified flow" : "Documented workflow",
    note: verified
      ? verified.note
      : "The flow is drawn from the checked-in export. No document walks this agent's pipeline node by node, so " +
        "the diagram is the export and the written purpose of each step, nothing more.",
    source: {
      sha256: crypto.createHash("sha256").update(raw).digest("hex"),
      bytes: raw.length,
      activeInExport: Boolean(doc.active),
      nodes: nodes.length,
      edges: edges.length
    },
    verifiedBy: verified ? [[verified.path, verified.label]] : [],
    upstream: { direct: UPSTREAM.direct, storage: UPSTREAM.storageRead },
    downstream: UPSTREAM.storageWrite,
    nodes: flowNodes,
    edges,
    joins: flowNodes
      .filter(node => node.incoming > 1)
      .map(node => ({ node: node.id, from: edges.filter(edge => edge.to === node.id).map(edge => edge.from) })),
    branches: flowNodes
      .filter(node => node.outgoing > 1)
      .map(node => ({ node: node.id, to: edges.filter(edge => edge.from === node.id).map(edge => edge.to) }))
  };
}

function buildData() {
  assertPath("workflows/master_orchestrator.md", "direct upstream");
  assertPath("docs/HISTORICAL_DATA_INVENTORY.md", "storage upstream");
  assertPath("workflows/WORKFLOW_INVENTORY.md", "storage downstream");
  const assets = {};
  ORDER.forEach(code => {
    const flow = readExport(code);
    if (!flow) throw new Error(`exports/${code.toLowerCase()}_layer1_agent.json is missing`);
    assets[code] = flow;
  });
  return {
    schemaVersion: "factory-flows-v1",
    builtBy: "scripts/build_factory_flows.js",
    note:
      "Allowlisted presentation data only: node names, node types, connection edges and written purposes. The raw " +
      "n8n exports are not loaded by the browser and are not copied here.",
    assets
  };
}

function renderDataModule(data) {
  return [
    "// GENERATED FILE - do not edit by hand.",
    "// Written by `node scripts/build_factory_flows.js` from the Layer 1 agent exports in `exports/`.",
    "//",
    "// Only an allowlist of fields is copied out of each export: node names, node types, type versions, the",
    "// connection edges between them and the purpose written for each step. Node parameters, credential references,",
    "// provider endpoints and workflow URLs never reach this file, so the browser cannot load a raw n8n export.",
    "// Run `node scripts/build_factory_flows.js --check` to prove this file still matches the exports it names.",
    "window.FactoryFlows = " + JSON.stringify(data, null, 2) + ";",
    ""
  ].join("\n");
}

function renderDoc(data) {
  const lines = [];
  lines.push("# n8n agent flows, as the Architecture map draws them");
  lines.push("");
  lines.push("2026-11-15 · public summary · generated by `node scripts/build_factory_flows.js` from the committed");
  lines.push("Layer 1 agent exports · presentation only");
  lines.push("");
  lines.push("The Architecture map gives every Layer 1 core an *Inspect n8n flow* control. This page is the public-safe");
  lines.push("record behind that diagram. It lists the nodes, the connections between them and what each step is for; it");
  lines.push("does not reproduce node parameters, credential references, provider endpoints or workflow URLs.");
  lines.push("");
  lines.push("A checked-in export is a saved snapshot. It establishes what the workflow looked like when it was exported.");
  lines.push("It does not establish that the live n8n workspace runs this version today, so every flow here is labelled");
  lines.push("either **verified** or **documented workflow**, and never \"live\".");
  lines.push("");
  lines.push("## How the map reads a flow");
  lines.push("");
  lines.push("- **Direct invocation** - the Master Orchestrator calls the agent as a workflow. That call carries no market");
  lines.push("  data.");
  lines.push("- **Storage hand-off** - the asset collector writes a snapshot row, and the agent reads the");
  lines.push("  `market_snapshots` table. The row travels through storage, not through a workflow invocation.");
  lines.push("- **The agent's own chain** - the nodes below, in the order the export connects them.");
  lines.push("- **Storage write** - the finished call is inserted into `agent_outputs`; the Dashboard Writer publishes");
  lines.push("  `data/layer1.json` from the newest row per asset.");
  lines.push("");
  lines.push("## The flows");
  lines.push("");
  ORDER.forEach(code => {
    const flow = data.assets[code];
    lines.push(`### ${code} · ${flow.workflow}`);
    lines.push("");
    lines.push(`- Status: **${flow.statusLabel}**. ${flow.note}`);
    lines.push(
      `- Export: \`${flow.exportPath}\` - ${flow.source.nodes} nodes, ${flow.source.edges} connections, ` +
        `sha256 \`${flow.source.sha256.slice(0, 12)}…\`.`
    );
    flow.verifiedBy.forEach(row => lines.push(`- Verified by: \`${row[0]}\` - ${row[1]}.`));
    if (flow.joins.length) {
      lines.push(`- Joins: ${flow.joins.map(join => `\`${join.node}\` reads ${join.from.length} inputs`).join("; ")}.`);
    } else {
      lines.push("- Joins: none. No node in this export receives more than one connection.");
    }
    if (flow.branches.length) {
      lines.push(
        `- Branches: ${flow.branches.map(branch => `\`${branch.node}\` writes ${branch.to.length} outputs`).join("; ")}.`
      );
    } else {
      lines.push("- Branches: none. The export connects this agent as a single chain.");
    }
    lines.push("");
    lines.push("| Step | Node | Type | What it is for | Inputs | Outputs |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    flow.nodes.forEach(node => {
      lines.push(
        `| ${node.step} | \`${node.name}\` | ${node.typeLabel} | ${node.purpose} | ${node.inputs} | ${node.outputs} |`
      );
    });
    lines.push("");
    lines.push("Connections, in the export's own order:");
    lines.push("");
    lines.push("```");
    flow.edges.forEach(edge => {
      const from = flow.nodes.find(node => node.id === edge.from);
      const to = flow.nodes.find(node => node.id === edge.to);
      lines.push(`${from.name} -> ${to.name}`);
    });
    lines.push("```");
    lines.push("");
  });
  lines.push("## What is deliberately absent");
  lines.push("");
  lines.push("- Node parameters, including the code nodes' source, the model settings and the table identifiers.");
  lines.push("- Credential references and any provider endpoint. The builder rejects a URL, a key, a token, a secret, a");
  lines.push("  webhook and a credential-shaped string before it writes either file.");
  lines.push("- A claim of live runtime status. The export's own `active` flag describes the saved document, not the");
  lines.push("  workspace, and the map shows it only as a property of the export.");
  lines.push("");
  lines.push("## Regenerating this page");
  lines.push("");
  lines.push("```sh");
  lines.push("node scripts/build_factory_flows.js           # rewrite lib/factory-flows.js and this page");
  lines.push("node scripts/build_factory_flows.js --check   # fail if either has drifted from the exports");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const check = process.argv.includes("--check");
  const normalise = text => text.replace(/\r\n/g, "\n");
  const data = buildData();
  const module = renderDataModule(data);
  const doc = renderDoc(data);
  if (check) {
    const problems = [];
    if (!fs.existsSync(dataPath) || normalise(fs.readFileSync(dataPath, "utf8")) !== module) {
      problems.push("lib/factory-flows.js");
    }
    if (!fs.existsSync(docPath) || normalise(fs.readFileSync(docPath, "utf8")) !== doc) {
      problems.push("docs/dashboard-design/n8n-agent-flows.md");
    }
    if (problems.length) {
      console.error(`drifted from the exports: ${problems.join(", ")}. Run node scripts/build_factory_flows.js`);
      process.exitCode = 1;
      return;
    }
    console.log(`factory flows current: ${Object.keys(data.assets).length} agents`);
    return;
  }
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, module);
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, doc);
  const nodes = Object.values(data.assets).reduce((total, flow) => total + flow.nodes.length, 0);
  console.log(
    `wrote lib/factory-flows.js and docs/dashboard-design/n8n-agent-flows.md ` +
      `(${Object.keys(data.assets).length} agents, ${nodes} nodes)`
  );
}

main();
