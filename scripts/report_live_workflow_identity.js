#!/usr/bin/env node
/**
 * Deployment-identity report: which workflow is actually running versus which snapshot the
 * repository holds, plus the routing and credential-material facts that the export exposed.
 *
 * Read-only. It reads the raw local export directory (ignored), the sanitized committed copies
 * and the repository's exports/ snapshots, and writes one machine-readable evidence file.
 * Credential values are counted and grouped by host/parameter name only; they are never echoed.
 *
 * Usage:
 *   node scripts/report_live_workflow_identity.js \
 *     --raw=tmp/live/exports-<stamp> \
 *     --sanitized=docs/review/usd-24h-ruleset-v1/live-exports \
 *     --repo=exports \
 *     --out=docs/review/usd-24h-ruleset-v1/live_export_identity.json
 */

const fs = require("fs");
const path = require("path");

function argumentValue(name) {
  const hit = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const rootDir = path.resolve(__dirname, "..");
const rawDir = path.resolve(rootDir, argumentValue("raw") || "tmp/live");
const sanitizedDir = path.resolve(rootDir, argumentValue("sanitized") || "docs/review/usd-24h-ruleset-v1/live-exports");
const repoExportsDir = path.resolve(rootDir, argumentValue("repo") || "exports");
const outPath = path.resolve(rootDir, argumentValue("out") || "docs/review/usd-24h-ruleset-v1/live_export_identity.json");

const ENGINES = ["usd", "eur", "gold", "silver", "nq", "btc", "wti", "gbp"];

const QUERY_RULE = /([?&](?:apikey|api_key|api-key|key|token|access_key|secret|code|auth)=)([^&"'\s]+)/gi;
const HOST_RULE = /https?:\/\/([^/'"\s]+)/g;

function classify(name) {
  const lower = String(name || "").toLowerCase();
  const engine = ENGINES.find((candidate) => lower.includes(candidate)) || null;
  const isCollector = /collector/.test(lower);
  const isAgent = /agent/.test(lower);

  if (/orchestrat/.test(lower)) return { key: "SHARED:orchestrator", engine: null, role: "orchestrator" };
  if (/dashboard.*writ/.test(lower)) return { key: "SHARED:dashboard_writer", engine: null, role: "dashboard_writer" };
  if (/eco.*event|economic events/.test(lower)) return { key: "SHARED:events", engine: null, role: "events" };
  if (/layer ?2|trade selection/.test(lower)) return { key: "SHARED:layer2", engine: null, role: "layer2" };
  if (engine && isCollector) return { key: `${engine}:collector`, engine, role: "collector" };
  if (engine && isAgent) return { key: `${engine}:agent`, engine, role: "agent" };
  return { key: "UNCLASSIFIED:other", engine: engine || null, role: "other" };
}

function repoKeyForFile(fileName) {
  const base = fileName.replace(/\.json$/, "");
  if (/orchestrat/.test(base)) return { key: "SHARED:orchestrator", engine: null, role: "orchestrator" };
  if (/dashboard.*writ/.test(base)) return { key: "SHARED:dashboard_writer", engine: null, role: "dashboard_writer" };
  if (/eco.*event/.test(base)) return { key: "SHARED:events", engine: null, role: "events" };
  if (/layer ?2|trade_selection/.test(base)) return { key: "SHARED:layer2", engine: null, role: "layer2" };
  const engine = ENGINES.find((candidate) => base.startsWith(`${candidate}_`)) || null;
  if (!engine) return { key: "UNCLASSIFIED:other", engine: null, role: "other" };
  const role = /collector/.test(base) ? "collector" : "agent";
  return { key: `${engine}:${role}`, engine, role };
}

const DEPRIORITIZED_NAME = /backfill|historical|hit\/miss|resolution|price fetch|probe|minimal|old/i;

function candidateScore(name, active) {
  const lower = String(name || "").toLowerCase();
  let score = 0;
  if (/layer ?1 ?agent/.test(lower)) score += 50;
  if (/agent|collector/.test(lower)) score += 5;
  if (active) score += 10;
  if (/^test/i.test(lower)) score -= 30;
  if (DEPRIORITIZED_NAME.test(lower)) score -= 40;
  return score;
}

function pickPrimary(candidates) {
  if (!candidates.length) return null;
  return [...candidates].sort((left, right) => {
    const difference = candidateScore(right.name, right.active) - candidateScore(left.name, left.active);
    if (difference !== 0) return difference;
    return (right.version_counter || 0) - (left.version_counter || 0);
  })[0];
}

function codeNodes(workflow) {
  return (workflow.nodes || [])
    .filter((node) => node.parameters && typeof node.parameters.jsCode === "string")
    .map((node) => ({
      name: node.name,
      sha256: require("crypto").createHash("sha256").update(node.parameters.jsCode, "utf8").digest("hex"),
      bytes: Buffer.byteLength(node.parameters.jsCode, "utf8")
    }));
}

function routingReferences(workflow) {
  const references = [];
  for (const node of workflow.nodes || []) {
    const type = String(node.type || "");
    const parameters = node.parameters || {};
    if (type.includes("executeWorkflow")) {
      const workflowId = parameters.workflowId;
      references.push({
        node: node.name,
        kind: "executeWorkflow",
        target_workflow_id: workflowId && typeof workflowId === "object" ? workflowId.value ?? null : workflowId ?? null,
        target_workflow_name_hint: workflowId && typeof workflowId === "object" ? workflowId.cachedResultName ?? null : null
      });
    } else if (type.includes("webhook")) {
      references.push({ node: node.name, kind: "webhook", webhook_path: parameters.path ?? null, http_method: parameters.httpMethod ?? null });
    } else if (type.includes("schedule") || type.includes("cron")) {
      references.push({ node: node.name, kind: "schedule", cron_expression: parameters.rule?.interval?.[0]?.expression ?? null });
    }
  }
  return references;
}

function literalCredentialFindings(rawText) {
  const byParameter = {};
  const hosts = {};
  let literal = 0;
  let expression = 0;

  for (const match of rawText.match(new RegExp(QUERY_RULE.source, "gi")) || []) {
    const separator = match.indexOf("=");
    const parameter = match.slice(1, separator);
    const value = match.slice(separator + 1);
    const isExpression = value.startsWith("=") || value.includes("$env") || value.includes("{{");
    if (isExpression) {
      expression += 1;
      continue;
    }
    literal += 1;
    byParameter[parameter] = (byParameter[parameter] || 0) + 1;
  }

  for (const match of rawText.match(new RegExp(HOST_RULE.source, "g")) || []) {
    const host = match.replace(/^https?:\/\//, "");
    hosts[host] = (hosts[host] || 0) + 1;
  }

  return {
    literal_query_values: literal,
    expression_query_values: expression,
    parameters: byParameter,
    hosts
  };
}

function main() {
  const rawManifest = JSON.parse(fs.readFileSync(path.join(rawDir, "manifest.json"), "utf8"));
  const sanitizedManifest = JSON.parse(fs.readFileSync(path.join(sanitizedDir, "manifest.json"), "utf8"));
  const sanitizedByFile = Object.fromEntries(sanitizedManifest.workflows.map((entry) => [entry.file, entry]));

  const live = rawManifest.workflows.map((entry) => {
    const rawText = fs.readFileSync(path.join(rawDir, entry.file), "utf8");
    const workflow = JSON.parse(rawText);
    return {
      file: entry.file,
      name: workflow.name,
      id: workflow.id,
      active: Boolean(workflow.active),
      is_test_named: /^test/i.test(String(workflow.name || "")),
      version_id: workflow.versionId ?? null,
      version_counter: workflow.versionCounter ?? null,
      created_at: workflow.createdAt ?? null,
      updated_at: workflow.updatedAt ?? null,
      node_count: (workflow.nodes || []).length,
      classification: classify(workflow.name),
      code_nodes: codeNodes(workflow),
      routing: routingReferences(workflow),
      credential_bindings: (workflow.nodes || []).flatMap((node) =>
        Object.keys(node.credentials || {}).map((key) => ({
          node: node.name,
          type: key,
          name: (node.credentials[key] || {}).name ?? null
        }))
      ),
      sanitized_sha256: sanitizedByFile[entry.file]?.sha256 ?? null,
      sanitized_bytes: sanitizedByFile[entry.file]?.bytes ?? null,
      credential_literal_findings: literalCredentialFindings(rawText)
    };
  });

  const repo = fs
    .readdirSync(repoExportsDir)
    .filter((name) => name.endsWith(".json"))
    .map((fileName) => {
      const filePath = path.join(repoExportsDir, fileName);
      const text = fs.readFileSync(filePath, "utf8");
      const workflow = JSON.parse(text);
      return {
        file: `exports/${fileName}`,
        workflow_id: workflow.id ?? null,
        name: workflow.name ?? fileName,
        version_counter: workflow.versionCounter ?? null,
        updated_at: workflow.updatedAt ?? null,
        node_count: (workflow.nodes || []).length,
        classification: repoKeyForFile(fileName),
        code_nodes: codeNodes(workflow),
        credential_literal_findings: literalCredentialFindings(text)
      };
    });

  const compareCodeNodes = (liveNodes, repoNodes) => {
    const liveByName = Object.fromEntries(liveNodes.map((node) => [node.name, node.sha256]));
    const repoByName = Object.fromEntries(repoNodes.map((node) => [node.name, node.sha256]));
    const matched = [];
    const differing = [];
    for (const name of Object.keys(repoByName)) {
      if (!(name in liveByName)) continue;
      matched.push(name);
      if (liveByName[name] !== repoByName[name]) {
        differing.push({ node: name, live_sha256: liveByName[name], repo_sha256: repoByName[name] });
      }
    }
    return {
      matched_code_nodes: matched,
      differing_code_nodes: differing,
      only_in_live: Object.keys(liveByName).filter((name) => !(name in repoByName)),
      only_in_repo: Object.keys(repoByName).filter((name) => !(name in liveByName)),
      all_matched_code_nodes_identical: differing.length === 0 && matched.length > 0
    };
  };

  const keys = [...new Set([...live.map((entry) => entry.classification.key), ...repo.map((entry) => entry.classification.key)])].sort();
  const engineCoverage = keys.map((key) => {
    const liveEntries = live.filter((entry) => entry.classification.key === key);
    const primary = pickPrimary(liveEntries);
    const repoEntries = repo.filter((entry) => entry.classification.key === key);
    return {
      key,
      live_primary: primary
        ? {
            file: primary.file,
            name: primary.name,
            id: primary.id,
            active: primary.active,
            version_id: primary.version_id,
            version_counter: primary.version_counter,
            created_at: primary.created_at,
            updated_at: primary.updated_at,
            node_count: primary.node_count,
            sanitized_sha256: primary.sanitized_sha256,
            code_nodes: primary.code_nodes
          }
        : null,
      live_all_candidates: liveEntries.map((entry) => ({
        name: entry.name,
        id: entry.id,
        active: entry.active,
        is_test_named: entry.is_test_named,
        version_counter: entry.version_counter,
        updated_at: entry.updated_at
      })),
      repo_exports: repoEntries.map((entry) => ({
        file: entry.file,
        workflow_id: entry.workflow_id,
        version_counter: entry.version_counter,
        updated_at: entry.updated_at,
        code_nodes: entry.code_nodes
      })),
      code_node_comparison: primary && repoEntries.length ? compareCodeNodes(primary.code_nodes, repoEntries[0].code_nodes) : null
    };
  });

  const credentialFindings = live
    .filter((entry) => entry.credential_literal_findings.literal_query_values > 0)
    .map((entry) => ({
      file: entry.file,
      name: entry.name,
      id: entry.id,
      active: entry.active,
      literal_query_values: entry.credential_literal_findings.literal_query_values,
      expression_query_values: entry.credential_literal_findings.expression_query_values,
      parameters: entry.credential_literal_findings.parameters,
      hosts: entry.credential_literal_findings.hosts
    }));

  const liveKeys = new Set(live.map((entry) => entry.classification.key));
  const repoKeys = new Set(repo.map((entry) => entry.classification.key));
  const coverageGaps = {
    engines_with_live_agent: ENGINES.filter((engine) => liveKeys.has(`${engine}:agent`)),
    engines_with_live_collector: ENGINES.filter((engine) => liveKeys.has(`${engine}:collector`)),
    engines_with_live_agent_without_live_collector: ENGINES.filter((engine) => liveKeys.has(`${engine}:agent`) && !liveKeys.has(`${engine}:collector`)),
    engines_without_live_agent: ENGINES.filter((engine) => !liveKeys.has(`${engine}:agent`)),
    engines_without_repo_export: ENGINES.filter((engine) => !repoKeys.has(`${engine}:agent`) && !repoKeys.has(`${engine}:collector`)),
    repo_keys_without_live_counterpart: [...new Set(repo.filter((entry) => !liveKeys.has(entry.classification.key)).map((entry) => entry.classification.key))].sort()
  };

  const evidence = {
    generated_at: new Date().toISOString(),
    script: "scripts/report_live_workflow_identity.js",
    n8n_base_url: rawManifest.base_url,
    export_timestamp: rawManifest.exported_at,
    export_api: rawManifest.api,
    raw_export_dir: rawManifest.out_dir,
    sanitized_export_dir: path.relative(rootDir, sanitizedDir).split(path.sep).join("/"),
    sanitized_export_manifest_sha256_present: Boolean(sanitizedManifest.sanitized_at),
    sanitizer: "scripts/scrub_live_workflow_exports.js",
    workflow_count: live.length,
    active_workflow_count: live.filter((entry) => entry.active).length,
    live_workflows: live.map((entry) => ({
      file: entry.file,
      name: entry.name,
      id: entry.id,
      active: entry.active,
      is_test_named: entry.is_test_named,
      version_id: entry.version_id,
      version_counter: entry.version_counter,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      node_count: entry.node_count,
      key: entry.classification.key,
      sanitized_sha256: entry.sanitized_sha256,
      sanitized_bytes: entry.sanitized_bytes,
      code_nodes: entry.code_nodes,
      credential_bindings: entry.credential_bindings,
      routing: entry.routing
    })),
    repo_exports: repo.map((entry) => ({
      file: entry.file,
      workflow_id: entry.workflow_id,
      name: entry.name,
      version_counter: entry.version_counter,
      updated_at: entry.updated_at,
      node_count: entry.node_count,
      key: entry.classification.key,
      code_nodes: entry.code_nodes,
      credential_literal_query_values: entry.credential_literal_findings.literal_query_values,
      expression_query_values: entry.credential_literal_findings.expression_query_values
    })),
    engine_coverage: engineCoverage,
    credential_literal_findings: credentialFindings,
    coverage_gaps: coverageGaps
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(`Wrote ${path.relative(rootDir, outPath).split(path.sep).join("/")}`);
  console.log(`live workflows: ${live.length} (active: ${evidence.active_workflow_count}, TEST-named: ${live.filter((entry) => entry.is_test_named).length})`);
  for (const entry of engineCoverage) {
    const comparison = entry.code_node_comparison;
    const verdict = !entry.repo_exports.length
      ? "no repo export"
      : !comparison
        ? "no live workflow"
        : comparison.all_matched_code_nodes_identical
          ? "code nodes match"
          : `code nodes differ (${comparison.differing_code_nodes.length})`;
    const liveLabel = entry.live_primary
      ? `${entry.live_primary.id} v${entry.live_primary.version_counter} active=${entry.live_primary.active}`
      : "none";
    console.log(`${entry.key.padEnd(24)} live=${liveLabel.padEnd(38)} repo=${(entry.repo_exports[0]?.file || "none").padEnd(34)} ${verdict}`);
  }
  console.log(
    `workflows with literal credential query values: ${credentialFindings.length} (values: ${credentialFindings.reduce((sum, entry) => sum + entry.literal_query_values, 0)})`
  );
  console.log(`engines with agent but no collector: ${coverageGaps.engines_with_live_agent_without_live_collector.join(", ") || "none"}`);
  console.log(`engines without any repo export: ${coverageGaps.engines_without_repo_export.join(", ") || "none"}`);
}

main();

