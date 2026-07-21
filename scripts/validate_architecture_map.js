const fs = require("fs");
const path = require("path");

const allowedStatuses = new Set(["verified", "partially_verified", "unverified"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message, errors = []) {
  const lines = [message, ...errors.map((error) => `- ${error}`)];
  throw new Error(lines.join("\n"));
}

function validateManifest(manifest) {
  const errors = [];

  const requiredTopLevel = ["metadata", "nodes", "edges", "views", "legends", "boundaries"];
  for (const key of requiredTopLevel) {
    if (!(key in manifest)) errors.push(`Missing top-level field: ${key}`);
  }

  if (!Array.isArray(manifest.nodes)) errors.push("nodes must be an array");
  if (!Array.isArray(manifest.edges)) errors.push("edges must be an array");
  if (!Array.isArray(manifest.views)) errors.push("views must be an array");
  if (!Array.isArray(manifest.legends)) errors.push("legends must be an array");
  if (!Array.isArray(manifest.boundaries)) errors.push("boundaries must be an array");

  if (errors.length) return errors;

  const nodeIds = new Set();
  const edgeIds = new Set();
  const boundaryIds = new Set();

  for (const node of manifest.nodes) {
    if (!node?.id) errors.push("Every node requires an id");
    if (!node?.label) errors.push(`Node ${node?.id || "<missing>"} requires a label`);
    if (!node?.kind) errors.push(`Node ${node?.id || "<missing>"} requires a kind`);
    if (!node?.summary) errors.push(`Node ${node?.id || "<missing>"} requires a summary`);
    if (!node?.verification?.status) errors.push(`Node ${node?.id || "<missing>"} requires verification.status`);
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    if (node?.verification?.status && !allowedStatuses.has(node.verification.status)) {
      errors.push(`Node ${node.id} has invalid verification status: ${node.verification.status}`);
    }
    nodeIds.add(node.id);
  }

  for (const edge of manifest.edges) {
    if (!edge?.id) errors.push("Every edge requires an id");
    if (!edge?.source) errors.push(`Edge ${edge?.id || "<missing>"} requires a source`);
    if (!edge?.target) errors.push(`Edge ${edge?.id || "<missing>"} requires a target`);
    if (!edge?.label) errors.push(`Edge ${edge?.id || "<missing>"} requires a label`);
    if (!edge?.verification?.status) errors.push(`Edge ${edge?.id || "<missing>"} requires verification.status`);
    if (edgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
    if (edge?.verification?.status && !allowedStatuses.has(edge.verification.status)) {
      errors.push(`Edge ${edge.id} has invalid verification status: ${edge.verification.status}`);
    }
    if (edge?.source && !nodeIds.has(edge.source)) errors.push(`Edge ${edge.id} references missing source node: ${edge.source}`);
    if (edge?.target && !nodeIds.has(edge.target)) errors.push(`Edge ${edge.id} references missing target node: ${edge.target}`);
    edgeIds.add(edge.id);
  }

  for (const boundary of manifest.boundaries) {
    if (!boundary?.id) errors.push("Every boundary requires an id");
    if (!boundary?.label) errors.push(`Boundary ${boundary?.id || "<missing>"} requires a label`);
    if (!boundary?.description) errors.push(`Boundary ${boundary?.id || "<missing>"} requires a description`);
    if (boundaryIds.has(boundary.id)) errors.push(`Duplicate boundary id: ${boundary.id}`);
    boundaryIds.add(boundary.id);
  }

  for (const legend of manifest.legends) {
    if (!legend?.id) errors.push("Every legend requires an id");
    if (!legend?.title) errors.push(`Legend ${legend?.id || "<missing>"} requires a title`);
    if (!Array.isArray(legend?.items)) errors.push(`Legend ${legend?.id || "<missing>"} requires an items array`);
  }

  for (const view of manifest.views) {
    if (!view?.id) {
      errors.push("Every view requires an id");
      continue;
    }
    if (!view?.label) errors.push(`View ${view.id} requires a label`);
    if (!view?.description) errors.push(`View ${view.id} requires a description`);
    if (!Array.isArray(view?.node_ids)) errors.push(`View ${view.id} requires node_ids`);
    if (!Array.isArray(view?.edge_ids)) errors.push(`View ${view.id} requires edge_ids`);
    if (!Array.isArray(view?.boundary_ids)) errors.push(`View ${view.id} requires boundary_ids`);
    if (!view?.layout || typeof view.layout !== "object") {
      errors.push(`View ${view.id} requires a layout object`);
      continue;
    }

    const viewNodeSet = new Set(view.node_ids || []);
    const viewBoundarySet = new Set(view.boundary_ids || []);

    for (const nodeId of view.node_ids || []) {
      if (!nodeIds.has(nodeId)) errors.push(`View ${view.id} references missing node ${nodeId}`);
      if (!view.layout.nodes || !view.layout.nodes[nodeId]) errors.push(`View ${view.id} is missing layout coordinates for node ${nodeId}`);
    }

    for (const edgeId of view.edge_ids || []) {
      const edge = manifest.edges.find((entry) => entry.id === edgeId);
      if (!edge) {
        errors.push(`View ${view.id} references missing edge ${edgeId}`);
        continue;
      }
      if (!viewNodeSet.has(edge.source) || !viewNodeSet.has(edge.target)) {
        errors.push(`View ${view.id} includes edge ${edgeId} without including both endpoint nodes`);
      }
    }

    for (const boundaryId of view.boundary_ids || []) {
      if (!boundaryIds.has(boundaryId)) errors.push(`View ${view.id} references missing boundary ${boundaryId}`);
      if (!view.layout.boundaries || !view.layout.boundaries[boundaryId]) {
        errors.push(`View ${view.id} is missing layout coordinates for boundary ${boundaryId}`);
      }
    }

    for (const layoutNodeId of Object.keys(view.layout.nodes || {})) {
      if (!viewNodeSet.has(layoutNodeId)) errors.push(`View ${view.id} layout.nodes contains undeclared node ${layoutNodeId}`);
    }

    for (const layoutBoundaryId of Object.keys(view.layout.boundaries || {})) {
      if (!viewBoundarySet.has(layoutBoundaryId)) errors.push(`View ${view.id} layout.boundaries contains undeclared boundary ${layoutBoundaryId}`);
    }
  }

  return errors;
}

module.exports = {
  validateManifest
};

function main() {
  const manifestPath = path.resolve(process.cwd(), process.argv[2] || "data/architecture-map.json");
  const schemaPath = path.resolve(process.cwd(), process.argv[3] || "data/architecture-map.schema.json");

  if (!fs.existsSync(manifestPath)) fail(`Manifest file not found: ${manifestPath}`);
  if (!fs.existsSync(schemaPath)) fail(`Schema file not found: ${schemaPath}`);

  const manifest = readJson(manifestPath);
  const schema = readJson(schemaPath);

  if (!schema?.$id || !schema?.title) {
    fail("Schema file is missing required identity fields.", [
      `Schema path: ${schemaPath}`
    ]);
  }

  const errors = validateManifest(manifest);
  if (errors.length) fail("Architecture manifest validation failed.", errors);

  console.log(JSON.stringify({
    status: "PASS",
    manifest: path.relative(process.cwd(), manifestPath),
    schema: path.relative(process.cwd(), schemaPath),
    node_count: manifest.nodes.length,
    edge_count: manifest.edges.length,
    boundary_count: manifest.boundaries.length,
    view_ids: manifest.views.map((view) => view.id)
  }, null, 2));
}

if (require.main === module) {
  main();
}
