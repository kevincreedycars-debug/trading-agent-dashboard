const test = require("node:test");
const assert = require("node:assert/strict");
const { validateManifest } = require("../scripts/validate_architecture_map.js");

function buildValidManifest() {
  return {
    metadata: {
      title: "Fixture",
      version: "1",
      generated_from: ["test"],
      last_verified_at: "2026-07-21"
    },
    legends: [
      {
        id: "legend-1",
        title: "Legend",
        items: [
          { label: "Verified", description: "Description" }
        ]
      }
    ],
    boundaries: [
      {
        id: "boundary-1",
        label: "Boundary",
        description: "Boundary description"
      }
    ],
    nodes: [
      {
        id: "node-1",
        label: "Node 1",
        kind: "Fixture",
        summary: "Summary",
        verification: {
          status: "verified",
          evidence: "Evidence"
        }
      },
      {
        id: "node-2",
        label: "Node 2",
        kind: "Fixture",
        summary: "Summary",
        verification: {
          status: "unverified",
          evidence: "Evidence"
        }
      }
    ],
    edges: [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        label: "Flow",
        verification: {
          status: "partially_verified",
          evidence: "Evidence"
        }
      }
    ],
    views: [
      {
        id: "view-1",
        label: "View",
        description: "Description",
        node_ids: ["node-1", "node-2"],
        edge_ids: ["edge-1"],
        boundary_ids: ["boundary-1"],
        layout: {
          width: 1000,
          height: 600,
          nodes: {
            "node-1": { x: 100, y: 100 },
            "node-2": { x: 300, y: 100 }
          },
          boundaries: {
            "boundary-1": { x: 20, y: 20, width: 400, height: 220 }
          }
        }
      }
    ]
  };
}

test("validateManifest accepts a valid manifest", () => {
  assert.deepEqual(validateManifest(buildValidManifest()), []);
});

test("validateManifest rejects duplicate node ids", () => {
  const manifest = buildValidManifest();
  manifest.nodes.push({
    id: "node-1",
    label: "Duplicate",
    kind: "Fixture",
    summary: "Summary",
    verification: {
      status: "verified",
      evidence: "Evidence"
    }
  });
  const errors = validateManifest(manifest);
  assert.ok(errors.some((error) => error.includes("Duplicate node id: node-1")));
});

test("validateManifest rejects duplicate edge ids", () => {
  const manifest = buildValidManifest();
  manifest.edges.push({
    id: "edge-1",
    source: "node-1",
    target: "node-2",
    label: "Flow 2",
    verification: {
      status: "verified",
      evidence: "Evidence"
    }
  });
  const errors = validateManifest(manifest);
  assert.ok(errors.some((error) => error.includes("Duplicate edge id: edge-1")));
});

test("validateManifest rejects missing edge targets", () => {
  const manifest = buildValidManifest();
  manifest.edges[0].target = "missing-node";
  const errors = validateManifest(manifest);
  assert.ok(errors.some((error) => error.includes("references missing target node: missing-node")));
});

test("validateManifest rejects invalid view node membership", () => {
  const manifest = buildValidManifest();
  manifest.views[0].node_ids = ["node-1"];
  delete manifest.views[0].layout.nodes["node-2"];
  const errors = validateManifest(manifest);
  assert.ok(errors.some((error) => error.includes("includes edge edge-1 without including both endpoint nodes")));
});

test("validateManifest rejects invalid boundary references", () => {
  const manifest = buildValidManifest();
  manifest.views[0].boundary_ids = ["missing-boundary"];
  manifest.views[0].layout.boundaries = {};
  const errors = validateManifest(manifest);
  assert.ok(errors.some((error) => error.includes("references missing boundary missing-boundary")));
});

test("validateManifest rejects unsupported verification statuses", () => {
  const manifest = buildValidManifest();
  manifest.nodes[0].verification.status = "unsupported";
  const errors = validateManifest(manifest);
  assert.ok(errors.some((error) => error.includes("invalid verification status: unsupported")));
});
