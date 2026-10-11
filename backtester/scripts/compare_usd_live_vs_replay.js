#!/usr/bin/env node

"use strict";

/**
 * WP0b comparison harness: one identical frozen snapshot per case, three implementations.
 *
 *   live code  - the deterministic code nodes of the exported live USD workflow, executed locally
 *   replay     - backtester/replay/usd/usd_replay_core.js
 *   dashboard  - backtester/lib/headline_confidence.js applied to the live code row
 *
 * Read-only with respect to n8n and the warehouse. No live workflow is touched and no production
 * logic is changed: the script reports differences and can freeze them as the current baseline.
 *
 * Usage:
 *   node backtester/scripts/compare_usd_live_vs_replay.js
 *   node backtester/scripts/compare_usd_live_vs_replay.js --write-baseline
 *   node backtester/scripts/compare_usd_live_vs_replay.js --out=<path> --cases=<path> --workflow=<export path>
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { loadExportedWorkflow, runUsdDeterministicChain } = require("../lib/usd_live_code_harness");
const {
  compareArms,
  dashboardContractCheck,
  projectDashboard,
  projectLiveCodeRow,
  projectReplayOutput,
  replayHashPayload
} = require("../lib/usd_decision_projections");
const {
  FACTOR_WEIGHTS,
  LIVE_24H_FACTOR_WEIGHTS,
  buildReplayOutput,
  parseLogicVersion
} = require("../replay/usd/usd_replay_core");
const { assertLayer1ConfidenceMapping, mapLayer1Confidence, publishedCallFromRow } = require("../lib/layer1_confidence_mapping");

const rootDir = path.resolve(__dirname, "../..");
const DEFAULT_CASES = path.join(__dirname, "../fixtures/usd_live_replay_harness_cases.json");
const DEFAULT_OUT = path.join(rootDir, "docs/review/usd-24h-ruleset-v1/usd_live_replay_comparison.json");
const DEFAULT_BASELINE = path.join(__dirname, "../fixtures/usd_live_replay_harness_baseline.json");

function argumentValue(name) {
  const hit = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function resolveCaseSnapshot(caseEntry, byId) {
  const baseId = caseEntry.based_on;
  const base = baseId ? byId.get(baseId) : caseEntry;
  if (!base || !base.snapshot) throw new Error(`Case "${caseEntry.id}" has no resolvable snapshot`);
  const snapshot = JSON.parse(JSON.stringify(base.snapshot));
  for (const [key, value] of Object.entries(caseEntry.snapshot_patch || {})) snapshot[key] = value;
  for (const key of caseEntry.snapshot_remove || []) delete snapshot[key];
  return snapshot;
}

function runCase(caseEntry, snapshot, workflow, logicDocumentVersion) {
  const live = runUsdDeterministicChain(workflow, snapshot, { modelReport: caseEntry.model_report || {} });
  const replayOutput = buildReplayOutput(snapshot, logicDocumentVersion);
  const liveProjection = projectLiveCodeRow(live.row, live.inputPack);
  const replayProjection = projectReplayOutput(replayOutput);
  const dashboardProjection = projectDashboard(live.row);
  const comparison = compareArms(
    { live_code: liveProjection, replay_live_path: replayProjection },
    { live_24h: LIVE_24H_FACTOR_WEIGHTS, rulebook: FACTOR_WEIGHTS }
  );

  return {
    id: caseEntry.id,
    description: caseEntry.description,
    model_report_supplied: Boolean(caseEntry.model_report),
    live_code: liveProjection,
    replay_live_path: replayProjection,
    dashboard: dashboardProjection,
    confidence_mapping: mapLayer1Confidence({ agent: "USD", calls: { "24h": publishedCallFromRow(live.row) } }),
    comparison,
    difference_fields: comparison.differences.map((difference) => `${difference.dimension}.${difference.field}`),
    hashes: {
      live_code_row_sha256: sha256(live.row),
      replay_output_sha256: sha256(replayHashPayload(replayOutput)),
      live_code_row_bytes: Buffer.byteLength(JSON.stringify(live.row), "utf8")
    },
    snapshot_selection_warnings: live.inputPack?.snapshot_selection?.warnings ?? [],
    live_deterministic_overrides: {
      direction_24h: live.row.direction_24h,
      conviction_24h: live.row.conviction_24h,
      model_direction_24h: caseEntry.model_report?.direction_24h ?? null,
      model_conviction_24h: caseEntry.model_report?.conviction_24h ?? null
    }
  };
}

function writeBaseline(cases, logicDocumentVersion) {
  const baseline = {
    frozen_at: new Date().toISOString(),
    frozen_by: "backtester/scripts/compare_usd_live_vs_replay.js --write-baseline",
    note: "Current behaviour is the frozen baseline. Re-freeze only deliberately, with the reason recorded in docs/.",
    logic_document_version: logicDocumentVersion,
    cases: cases.map((entry) => ({
      id: entry.id,
      live_code_row_sha256: entry.hashes.live_code_row_sha256,
      replay_output_sha256: entry.hashes.replay_output_sha256,
      difference_count: entry.comparison.differences.length,
      difference_fields: entry.difference_fields,
      live_code: entry.live_code,
      replay_live_path: entry.replay_live_path,
      dashboard: entry.dashboard
    }))
  };
  fs.writeFileSync(DEFAULT_BASELINE, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  return DEFAULT_BASELINE;
}

function main() {
  const casesPath = path.resolve(rootDir, argumentValue("cases") || DEFAULT_CASES);
  const outPath = path.resolve(rootDir, argumentValue("out") || DEFAULT_OUT);
  const casesFixture = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  const byId = new Map(casesFixture.cases.map((entry) => [entry.id, entry]));
  const loaded = loadExportedWorkflow(argumentValue("workflow"));
  const logicDocumentVersion = parseLogicVersion();
  const publishedPath = path.resolve(rootDir, argumentValue("published") || "data/layer1.json");
  const publishedRow = fs.existsSync(publishedPath)
    ? (JSON.parse(fs.readFileSync(publishedPath, "utf8")).agents || []).find((entry) => String(entry.agent).toUpperCase() === "USD") || null
    : null;

  const cases = casesFixture.cases.map((entry) => runCase(entry, resolveCaseSnapshot(entry, byId), loaded.workflow, logicDocumentVersion));

  const publishedConfidenceMapping = publishedRow ? mapLayer1Confidence(publishedRow) : null;
  if (publishedConfidenceMapping) assertLayer1ConfidenceMapping(publishedConfidenceMapping);
  for (const entry of cases) assertLayer1ConfidenceMapping(entry.confidence_mapping);

  const result = {
    generated_at: new Date().toISOString(),
    script: "backtester/scripts/compare_usd_live_vs_replay.js",
    live_code_workflow_path: path.relative(rootDir, loaded.path).split(path.sep).join("/"),
    live_code_source: loaded.source,
    live_code_workflow_name: loaded.workflow.name,
    live_code_workflow_id: loaded.workflow.id,
    harness_scope: [
      "Build USD Input Pack and Calculate USD Conviction only; the model step is not executed because the deterministic node overwrites the model verdict",
      "No warehouse read, no n8n write; inputs are the frozen case snapshots"
    ],
    logic_document_version: logicDocumentVersion,
    published_dashboard_row_check: publishedRow
      ? {
          source: path.relative(rootDir, publishedPath).split(path.sep).join("/"),
          contract: dashboardContractCheck(publishedRow, {
            note: "The published row nests the 24h model under calls['24h']; the writer maps it from the same deterministic fields."
          }),
          confidence_mapping: publishedConfidenceMapping
        }
      : { available: false, reason: "no published USD row found" },
    cases
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Live code source: ${result.live_code_workflow_path} (${loaded.source})`);
  console.log(`Cases: ${cases.length}; comparison written to ${path.relative(rootDir, outPath).split(path.sep).join("/")}`);
  for (const entry of cases) {
    const confidence = entry.live_code.confidence_quantities;
    const dashboard = entry.dashboard.with_conviction_model_lifted;
    console.log(
      `${entry.id.padEnd(26)} dir=${String(entry.live_code.direction.direction_24h).padEnd(14)} ` +
      `winning=${confidence.winning_side_conviction_pct} netEdge=${confidence.net_edge_pct} ` +
      `replayHeadline=${entry.replay_live_path.confidence_quantities.headline_confidence_pct} ` +
      `dashboardHeadline=${dashboard.headline_confidence_pct} differences=${entry.comparison.differences.length}`
    );
  }
  if (result.published_dashboard_row_check.contract?.available) {
    const contract = result.published_dashboard_row_check.contract;
    console.log(
      `published USD row ${contract.observed_at}: stored=${contract.stored_final_conviction} (${contract.stored_verdict_strength}) ` +
      `dashboardHeadline=${contract.displayed_headline_confidence_pct} derivedStrength=${contract.derived_strength_from_headline} ` +
      `overrideMatchesDerived=${contract.strength_override_matches_derived}`
    );
  }

  if (hasFlag("write-baseline")) {
    const baselinePath = writeBaseline(cases, logicDocumentVersion);
    console.log(`Baseline frozen at ${path.relative(rootDir, baselinePath).split(path.sep).join("/")}`);
  }
}

main();

