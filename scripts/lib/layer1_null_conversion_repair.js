"use strict";

/**
 * Layer 1 unavailable-versus-zero conversion repair.
 *
 * The committed engine exports open their local numeric helper with
 * `function n(v) { const x = Number(v); ... }`. `Number(null)`, `Number(undefined)` and `Number("")`
 * are all finite 0, so an input that is simply not available is converted into a real zero that
 * casts a real vote: a missing `vix_level` makes the USD engine score F1 and F9 as BEARISH at active
 * weight 99 instead of reporting two missing factors. A genuine 0 or a negative reading is valid
 * evidence and must keep casting its vote.
 *
 * The repair inserts an explicit unavailable check ahead of the conversion. Every downstream factor
 * builder in these engines already branches on `=== null` and reports "Missing input", so nothing
 * else in the engine changes: unavailable stays unavailable, a real 0 stays a real 0.
 *
 * The planner is pure and offline. A repository export can be repaired as text with
 * `repairExportFileText` (minimal diff, every other byte preserved); a live workflow is repaired by
 * sending the `payload` of `planLayer1NullConversionRepair` through the runner in
 * `scripts/repair_layer1_null_conversion.js`, which is a separate, explicitly authorised operation.
 */

const LAYER1_ENGINES = {
  usd: { workflowId: "OCt1tB9yVMUgFTha", exportFile: "exports/usd_layer1_agent.json" },
  eur: { workflowId: "Px0bsH7chlRWH9ZD", exportFile: "exports/eur_layer1_agent.json" },
  gbp: { workflowId: "bMv96EPR0xCXi3bi", exportFile: "exports/gbp_layer1_agent.json" },
  gold: { workflowId: "wwBVT0EQcKu5517I", exportFile: "exports/gold_layer1_agent.json" },
  nq: { workflowId: "FOpFp3AzTJVYdLXe", exportFile: "exports/nq_layer1_agent.json" },
  btc: { workflowId: "G142Blty3sGHzuOr", exportFile: "exports/btc_layer1_agent.json" },
  silver: { workflowId: "6IGOoTZxxTPyBpEp", exportFile: null },
  wti: { workflowId: "8oUBopUWLiGcYU0d", exportFile: null }
};

const ENGINE_BY_WORKFLOW_ID = Object.fromEntries(
  Object.entries(LAYER1_ENGINES).map(([engine, entry]) => [entry.workflowId, engine])
);

const ENGINE_BY_EXPORT_FILE = Object.fromEntries(
  Object.entries(LAYER1_ENGINES)
    .filter(([, entry]) => entry.exportFile)
    .map(([engine, entry]) => [entry.exportFile, engine])
);

const HELPER_OPEN = "function n(v) {\n";
const HELPER_CLOSE = "\n}";

// Single quotes keep the inserted line byte-identical in the JSON text and in the jsCode string.
const GUARD_LINES = [
  "  if (v === null || v === undefined || v === '') return null;",
  '  if (typeof v === "string" && v.trim() === "") return null;'
];

const UNAVAILABLE_CHECK = /v === null|v == null|hasValue\(/;

function inspectHelper(source) {
  const openAt = source.indexOf(HELPER_OPEN);
  if (openAt < 0) return { present: false, guarded: false, body: null, bodyStart: -1, bodyEnd: -1 };
  const bodyStart = openAt + HELPER_OPEN.length;
  const bodyEnd = source.indexOf(HELPER_CLOSE, bodyStart);
  if (bodyEnd < 0) throw new Error("Malformed n(v) helper: no closing brace.");
  const body = source.slice(bodyStart, bodyEnd);
  return {
    present: true,
    guarded: body.split("\n").some((line) => UNAVAILABLE_CHECK.test(line)),
    body,
    bodyStart,
    bodyEnd
  };
}

function repairLayer1Source(source) {
  if (typeof source !== "string") throw new Error("Engine source must be a string.");
  const helper = inspectHelper(source);
  if (!helper.present) {
    return { source, changed: false, status: "no_helper", reason: "no local n(v) helper in this code node" };
  }
  if (helper.guarded) {
    return {
      source,
      changed: false,
      status: "already_guarded",
      reason: "helper already refuses null, undefined and empty-string inputs"
    };
  }
  const guard = GUARD_LINES.join("\n") + "\n";
  return {
    source: source.slice(0, helper.bodyStart) + guard + source.slice(helper.bodyStart),
    changed: true,
    status: "repaired",
    reason: "Number(null), Number(undefined) and Number('') are finite 0, so an unavailable input could vote"
  };
}

function codeNodes(workflow) {
  return (workflow.nodes || []).filter(
    (node) => node.parameters && typeof node.parameters.jsCode === "string"
  );
}

function planLayer1NullConversionRepair(workflow) {
  if (!workflow || typeof workflow !== "object") throw new Error("A layer 1 workflow object is required.");
  const scanned = codeNodes(workflow);
  const nodes = scanned.map((node) => {
    const outcome = repairLayer1Source(node.parameters.jsCode);
    return {
      id: node.id,
      name: node.name,
      status: outcome.status,
      reason: outcome.reason,
      before: node.parameters.jsCode,
      after: outcome.source
    };
  });
  const repaired = nodes.filter((node) => node.status === "repaired");
  const payloadNodes = scanned.map((node) => {
    const replacement = repaired.find((entry) => entry.id === node.id);
    return replacement ? { ...node, parameters: { ...node.parameters, jsCode: replacement.after } } : node;
  });
  return {
    payload: {
      name: workflow.name,
      nodes: payloadNodes,
      connections: workflow.connections,
      settings: workflow.settings || {}
    },
    nodes,
    summary: {
      workflowId: workflow.id ?? null,
      workflowName: workflow.name ?? null,
      engine: ENGINE_BY_WORKFLOW_ID[workflow.id] ?? null,
      codeNodes: nodes.length,
      repaired: repaired.map((node) => node.name),
      alreadyGuarded: nodes.filter((node) => node.status === "already_guarded").map((node) => node.name),
      withoutHelper: nodes.filter((node) => node.status === "no_helper").map((node) => node.name),
      alreadyApplied: repaired.length === 0
    }
  };
}

function repairExportFileText(fileText) {
  const workflow = JSON.parse(fileText);
  const plan = planLayer1NullConversionRepair(workflow);
  const occurrences = (haystack, needle) => {
    let count = 0;
    let at = haystack.indexOf(needle);
    while (at >= 0) {
      count += 1;
      at = haystack.indexOf(needle, at + 1);
    }
    return count;
  };
  let text = fileText;
  const applied = [];
  for (const entry of plan.nodes.filter((node) => node.status === "repaired")) {
    const beforeLiteral = JSON.stringify(entry.before);
    const afterLiteral = JSON.stringify(entry.after);
    const beforeCount = occurrences(text, beforeLiteral);
    if (beforeCount < 1) throw new Error(`jsCode literal of "${entry.name}" not found in the export text.`);
    // The import carries the editable draft in `nodes` and the published copy in `activeVersion`.
    // Only the draft is rewritten: the published copy is the record of what the live workflow runs,
    // and it stays byte-identical until the live update is applied and re-exported.
    const at = text.indexOf(beforeLiteral);
    text = text.slice(0, at) + afterLiteral + text.slice(at + beforeLiteral.length);
    if (occurrences(text, beforeLiteral) !== beforeCount - 1) {
      throw new Error(`Unexpected jsCode literal count for "${entry.name}" after the repair.`);
    }
    applied.push(entry.name);
  }
  const reparsed = JSON.parse(text);
  const before = new Map(workflow.nodes.map((node) => [node.id, node.parameters?.jsCode]));
  for (const node of workflow.nodes) {
    const patched = reparsed.nodes.find((candidate) => candidate.id === node.id);
    const expected = plan.nodes.find((candidate) => candidate.id === node.id);
    const now = patched?.parameters?.jsCode;
    if (now !== before.get(node.id) && now !== expected.after) {
      throw new Error(`Unexpected code-node change outside the repair: ${node.name}`);
    }
  }
  if (workflow.activeVersion && JSON.stringify(reparsed.activeVersion) !== JSON.stringify(workflow.activeVersion)) {
    throw new Error("The published (activeVersion) copy changed during an export-text repair.");
  }
  if (JSON.stringify(reparsed.connections) !== JSON.stringify(workflow.connections)) {
    throw new Error("Connections changed during an export-text repair.");
  }
  const metadata = (nodes) => JSON.stringify(nodes.map((node) => ({ ...node, parameters: undefined })));
  if (metadata(reparsed.nodes) !== metadata(workflow.nodes)) {
    throw new Error("Node metadata changed during an export-text repair.");
  }
  return {
    text,
    applied,
    summary: { ...plan.summary, recordedActiveVersionUntouched: Boolean(workflow.activeVersion) }
  };
}

module.exports = {
  ENGINE_BY_EXPORT_FILE,
  ENGINE_BY_WORKFLOW_ID,
  GUARD_LINES,
  LAYER1_ENGINES,
  inspectHelper,
  planLayer1NullConversionRepair,
  repairExportFileText,
  repairLayer1Source
};
