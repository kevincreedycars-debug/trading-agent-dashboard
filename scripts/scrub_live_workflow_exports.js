#!/usr/bin/env node
/**
 * Produce sanitized, committable copies of a raw n8n workflow export directory.
 *
 * Input: the raw directory written by scripts/export_live_workflows.js (ignored local folder).
 * Output: the same workflows with credential material removed, plus a scrub report that names
 * every redaction rule and the JSON path it applied to. Values are never echoed into the report.
 *
 * Read-only with respect to n8n. It only reads local files and writes local files.
 *
 * Usage:
 *   node scripts/scrub_live_workflow_exports.js --in=tmp/live/exports-<stamp> \
 *     --out=docs/review/usd-24h-ruleset-v1/live-exports
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function argumentValue(prefix, fallback) {
  const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const inDir = path.resolve(__dirname, "..", argumentValue("--in=", ""));
const outDir = path.resolve(__dirname, "..", argumentValue("--out=", ""));

if (!argumentValue("--in=", "") || !argumentValue("--out=", "")) {
  throw new Error("Both --in=<raw export dir> and --out=<sanitized dir> are required.");
}
if (!fs.existsSync(path.join(inDir, "manifest.json"))) {
  throw new Error(`No manifest.json in ${inDir}; run scripts/export_live_workflows.js first.`);
}

const SENSITIVE_QUERY_PARAM = /([?&](?:apikey|api_key|api-key|key|token|access_key|secret|code|auth)=)(?!\{\{)([^&"'\\\s]+)/gi;
const AUTHORIZATION_HEADER = /(bearer\s+)([A-Za-z0-9._~+/=-]{12,})/gi;
// sk-ant-* covers Anthropic keys, which are shaped sk-ant-api03-<opaque> and therefore escaped the
// original alphanumeric-only sk- pattern; sb_secret_/sb_publishable_/sbp_ cover Supabase keys.
const TOKEN_LIKE = /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|sb_publishable_[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g;
const SENSITIVE_HEADER_NAME = /^(authorization|api[-_]?key|x-api-key|x-n8n-api-key|token|secret)$/i;
// Named parameter objects ({ name, value } inside headerParameters/queryParameters) are the shape
// that carried literal keys past the URL-string rule, so the name list matches that rule's list.
const SENSITIVE_PARAMETER_NAME = /^(?:authorization|x-api-key|x-n8n-api-key|apikey|api[_-]?key|key|token|access[_-]?key|secret|code|auth)$/i;
const EXPRESSION_VALUE = /^\s*\{\{/;
// FRED-style nodes carry the key inside a JSON query body string ("jsonQuery"), which no
// parameter-object or URL rule reaches: {"series_id": "DGS2", "api_key": "<literal>"}.
const JSON_BODY_CREDENTIAL = /("(?:apikey|api_key|api-key|key|token|access_key|secret|code|auth)"\s*:\s*")(?!\{\{|<redacted>)([A-Za-z0-9_.\-]{8,})(")/g;

const report = {
  generated_at: new Date().toISOString(),
  raw_dir: path.relative(path.resolve(__dirname, ".."), inDir).split(path.sep).join("/"),
  sanitized_dir: path.relative(path.resolve(__dirname, ".."), outDir).split(path.sep).join("/"),
  rules: [
    "credential bindings (id + name) are kept verbatim because the repository's existing exports/ snapshots already record them; only secret-shaped ids longer than 32 characters are replaced",
    "URL query parameters named apikey/api_key/api-key/key/token/access_key/secret/code/auth are replaced with <redacted>",
    "Authorization/Bearer header values and header parameters named authorization/api key/token/secret are replaced with <redacted>",
    "provider-shaped token literals (ghp_, github_pat_, sk-ant-, sk-, sb_secret_, sb_publishable_, sbp_, AIza, xox*, JWT) are replaced with <redacted>",
    "named parameter objects ({ name, value } in headerParameters/queryParameters) whose name is a credential parameter have their value replaced with <redacted>; {{ ... }} credential references are kept because they name a credential instead of carrying one",
    "pinData and staticData are emptied because pinned payloads can embed provider responses",
    "credential names inside JSON query/body strings (\"api_key\": \"...\") are replaced with <redacted>, which is how the FRED nodes in the backtest workflows carry their key"
  ],
  files: []
};

function record(file, rule, jsonPath, detail) {
  const entry = { rule, json_path: jsonPath };
  if (detail) entry.detail = detail;
  report.files[report.files.length - 1].redactions.push(entry);
}

function redactString(value, jsonPath, file) {
  let output = String(value);

  output = output.replace(SENSITIVE_QUERY_PARAM, (match, prefix, current) => {
    // re-running the scrubber over its own output must not re-record a value that is already masked
    if (current.includes("<redacted>")) return match;
    record(file, "sensitive_url_query_parameter", jsonPath, `parameter=${prefix.slice(1, -1)}`);
    return `${prefix}<redacted>`;
  });

  output = output.replace(JSON_BODY_CREDENTIAL, (match, prefix, value, suffix) => {
    record(file, "json_body_credential_literal", jsonPath, `value_length=${value.length}`);
    return `${prefix}<redacted>${suffix}`;
  });

  output = output.replace(TOKEN_LIKE, (match) => {
    record(file, "provider_token_literal", jsonPath, `length=${match.length}`);
    return "<redacted>";
  });

  output = output.replace(AUTHORIZATION_HEADER, (match, prefix) => {
    record(file, "authorization_header_value", jsonPath, `length=${match.length - prefix.length}`);
    return `${prefix}<redacted>`;
  });

  return output;
}

function scrubCredentials(workflow, file) {
  // Credential bindings are kept verbatim: the repository's own exports/ snapshots already
  // record binding ids and names, and the ids are workspace references, not secrets.
  for (const [index, node] of (workflow.nodes || []).entries()) {
    if (!node.credentials || typeof node.credentials !== "object") continue;
    for (const [key, entry] of Object.entries(node.credentials)) {
      if (entry && typeof entry === "object" && typeof entry.id === "string" && entry.id.length > 32) {
        entry.id = "<redacted>";
        record(file, "credential_id_secret_shaped", `nodes[${index}].credentials.${key}`);
      }
    }
  }
}

function isNamedSensitiveParameter(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.name === "string" &&
    typeof value.value === "string" &&
    SENSITIVE_PARAMETER_NAME.test(value.name)
  );
}

function walk(value, jsonPath, file) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${jsonPath}[${index}]`, file));
    return;
  }
  if (!value || typeof value !== "object") return;

  if (isNamedSensitiveParameter(value)) {
    // parameter objects look like { name: "api_key", value: "..." }; credential references
    // ({{ ... }} expressions) are kept because they name a credential instead of carrying one.
    if (value.value.includes("<redacted>")) {
      // already sanitized: re-running the scrubber over its own output records nothing
    } else if (EXPRESSION_VALUE.test(value.value)) {
      record(file, "sensitive_parameter_expression_kept", `${jsonPath}.value`, `parameter=${value.name}`);
    } else {
      value.value = "<redacted>";
      record(file, "sensitive_parameter_literal", `${jsonPath}.value`, `parameter=${value.name}`);
    }
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${jsonPath}.${key}`;

    if (key === "credentials") continue;

    if (typeof entry === "string") {
      value[key] = redactString(entry, entryPath, file);
      continue;
    }

    if (entry !== null && typeof entry === "object" && !Array.isArray(entry) && SENSITIVE_HEADER_NAME.test(key)) {
      // header parameter objects look like { name: "Authorization", value: "..." }
      const headerName = typeof entry.name === "string" ? entry.name : key;
      if (SENSITIVE_HEADER_NAME.test(headerName) && typeof entry.value === "string" && !entry.value.includes("<redacted>")) {
        entry.value = "<redacted>";
        record(file, "sensitive_header_parameter", `${entryPath}.value`);
      }
      walk(entry, entryPath, file);
      continue;
    }

    if (SENSITIVE_HEADER_NAME.test(key) && typeof entry !== "object" && !String(entry).includes("<redacted>")) {
      value[key] = "<redacted>";
      record(file, "sensitive_header_parameter", entryPath);
      continue;
    }

    walk(entry, entryPath, file);
  }
}

function sha256(text) {
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

function residualFindings(text) {
  const findings = [];
  const patterns = [
    { rule: "sensitive_url_query_parameter", pattern: new RegExp(SENSITIVE_QUERY_PARAM.source, "gi"), ignore: "<redacted>" },
    { rule: "provider_token_literal", pattern: new RegExp(TOKEN_LIKE.source, "g") },
    { rule: "json_body_credential_literal", pattern: new RegExp(JSON_BODY_CREDENTIAL.source, "g"), ignore: "<redacted>" },
    { rule: "authorization_header_value", pattern: new RegExp(AUTHORIZATION_HEADER.source, "gi"), ignore: "<redacted>" }
  ];
  for (const { rule, pattern, ignore } of patterns) {
    for (const match of text.match(pattern) || []) {
      if (ignore && match.includes(ignore)) continue;
      const detail = rule === "sensitive_url_query_parameter"
        ? `parameter=${match.split("=")[0].replace(/^[?&]/, "")}`
        : `length=${match.length}`;
      findings.push({ rule, detail });
    }
  }
  return findings;
}

function residualParameterFindings(workflow) {
  const findings = [];
  const visit = (value, jsonPath) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${jsonPath}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    if (
      typeof value.name === "string" &&
      typeof value.value === "string" &&
      SENSITIVE_PARAMETER_NAME.test(value.name) &&
      !EXPRESSION_VALUE.test(value.value) &&
      !value.value.includes("<redacted>")
    ) {
      findings.push({ rule: "sensitive_parameter_literal", json_path: `${jsonPath}.value`, detail: `parameter=${value.name}` });
    }
    for (const [key, entry] of Object.entries(value)) visit(entry, `${jsonPath}.${key}`);
  };
  visit(workflow, "workflow");
  return findings;
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(inDir, "manifest.json"), "utf8"));
  const sanitizedManifest = JSON.parse(JSON.stringify(manifest));
  sanitizedManifest.sanitized_at = new Date().toISOString();
  sanitizedManifest.sanitizer = "scripts/scrub_live_workflow_exports.js";
  sanitizedManifest.raw_export_sha256 = {};

  for (const entry of manifest.workflows) {
    const rawPath = path.join(inDir, entry.file);
    const rawText = fs.readFileSync(rawPath, "utf8");
    sanitizedManifest.raw_export_sha256[entry.file] = sha256(rawText);

    const workflow = JSON.parse(rawText);
    report.files.push({ file: entry.file, workflow_id: entry.id, name: entry.name, redactions: [] });
    scrubCredentials(workflow, entry.file);
    walk(workflow, "workflow", entry.file);
    if (workflow.pinData && typeof workflow.pinData === "object" && Object.keys(workflow.pinData).length) {
      // pinned data can embed provider payloads; keep only the fact that it exists
      workflow.pinData = {};
      record(entry.file, "pinned_data_removed", "pinData");
    }
    if (workflow.staticData && typeof workflow.staticData === "object" && Object.keys(workflow.staticData).length) {
      workflow.staticData = {};
      record(entry.file, "static_data_removed", "staticData");
    }

    const sanitizedText = `${JSON.stringify(workflow, null, 2)}\n`;
    const residuals = residualFindings(sanitizedText).concat(residualParameterFindings(workflow));
    const fileReport = report.files[report.files.length - 1];
    fileReport.residual_findings = residuals;
    fileReport.sanitized_sha256 = sha256(sanitizedText);
    fileReport.raw_sha256 = sanitizedManifest.raw_export_sha256[entry.file];
    fileReport.sanitized_bytes = Buffer.byteLength(sanitizedText, "utf8");

    fs.writeFileSync(path.join(outDir, entry.file), sanitizedText);

    const sanitizedEntry = sanitizedManifest.workflows.find((candidate) => candidate.file === entry.file);
    sanitizedEntry.sha256 = fileReport.sanitized_sha256;
    sanitizedEntry.bytes = fileReport.sanitized_bytes;
    sanitizedEntry.raw_sha256 = fileReport.raw_sha256;
    sanitizedEntry.redaction_count = fileReport.redactions.length + residuals.length;
  }

  report.total_redactions = report.files.reduce((sum, file) => sum + file.redactions.length, 0);
  report.total_residual_findings = report.files.reduce((sum, file) => sum + file.residual_findings.length, 0);
  report.files_with_redactions = report.files.filter((file) => file.redactions.length).map((file) => file.file);

  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(sanitizedManifest, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outDir, "scrub_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Sanitized ${report.files.length} workflows -> ${report.sanitized_dir}`);
  console.log(`Total redactions: ${report.total_redactions} in ${report.files_with_redactions.length} files`);
  console.log(`Residual findings: ${report.total_residual_findings}`);
  for (const file of report.files) {
    if (file.redactions.length || file.residual_findings.length) {
      const rules = [...new Set(file.redactions.map((entry) => entry.rule))].join(",");
      console.log(`  ${file.file}: ${file.redactions.length} redactions [${rules}] residuals=${file.residual_findings.length}`);
    }
  }

  if (report.total_residual_findings > 0) {
    console.error("Residual secret-shaped values remain; do not commit.");
    process.exitCode = 1;
  }
}

main();

