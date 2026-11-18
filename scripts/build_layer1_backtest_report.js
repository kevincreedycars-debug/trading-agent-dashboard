#!/usr/bin/env node
/**
 * Build the Layer 1 backtest report from the published artefacts.
 *
 * Usage:
 *   node scripts/build_layer1_backtest_report.js                write the JSON and the markdown report
 *   node scripts/build_layer1_backtest_report.js --check        rebuild and compare both with what is stored
 *   node scripts/build_layer1_backtest_report.js --print        print the summary only, write nothing
 *   node scripts/build_layer1_backtest_report.js --markdown     print the markdown report only, write nothing
 *
 * Research only: the script reads committed artefacts and writes the ignored JSON report plus the committed
 * markdown report. Both are rendered from one in-memory report, so the prose cannot drift from the numbers.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { createModels } = require("../lib/layer1_backtesting/models");
const { buildReport } = require("../lib/layer1_backtesting/report");
const { renderMarkdown } = require("../lib/layer1_backtesting/markdown");
const { hashTextFile, sha256, stableStringify } = require("../lib/layer1_backtesting/engine");
const { assertResearchPath } = require("../backtester/scripts/lib/research_path_guard");

const ROOT = path.resolve(__dirname, "..");
const RUN_PATH = "data/usd-layer1-backtester/run-v1.json";
const ENGINE_PATH = "data/usd-layer1-backtester/engine-v1.json";
const DOC_PATH = "docs/research/usd-session/v1/layer1_backtest_report.md";
// The programme's isolation rule (docs/research/usd-session/v1/isolation.md) allows research writes inside the
// ignored research folder only, so the generated report lives there and the committed report is the markdown.
const OUT_PATH = "backtester/tmp/usd-session-research/layer1-backtest-report.json";

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function sourceEntry(relative) {
  const buffer = fs.readFileSync(path.join(ROOT, relative));
  return { path: relative, ...hashTextFile(buffer) };
}

function build() {
  const run = readJson(RUN_PATH);
  const engine = readJson(ENGINE_PATH);
  const models = createModels({ run, engine });
  const generatedAt =
    (run.run && run.run.generated_at) || (run.generated_at ? run.generated_at : null) || engine.source_generated_at || null;
  const sources = [RUN_PATH, ENGINE_PATH, "config/usd_l1_factor_rulebook_v1.json", "config/usd_l1_decision_rules_v1.json"]
    .filter((relative) => fs.existsSync(path.join(ROOT, relative)))
    .map(sourceEntry);
  return buildReport({ run, engine, models, generated_at: generatedAt, sources });
}

function summary(report) {
  const control = report.decisions.by_model.control;
  const candidate = report.decisions.by_model.candidate;
  const lines = [];
  lines.push(`${report.title} (${report.schema_version})`);
  lines.push(
    `sessions ${report.scope.sessions} | ${report.scope.first_date} to ${report.scope.last_date} | gate: ${JSON.stringify(
      report.scope.gate_counts
    )}`
  );
  lines.push(
    `control: allowed ${control.allowed} abstained ${control.abstained} blocked ${control.blocked} trades ${control.trade_eligible}`
  );
  lines.push(
    `candidate: allowed ${candidate.allowed} abstained ${candidate.abstained} blocked ${candidate.blocked} trades ${candidate.trade_eligible}`
  );
  lines.push(`reconciliation: ${JSON.stringify(report.decisions.reconciliation)}`);
  for (const finding of report.findings) lines.push(`${finding.id} ${finding.claim}`);
  return `${lines.join("\n")}\n`;
}

/**
 * The markdown report is the committed artefact, so it lives in the research docs tree rather than the ignored
 * run folder. The target is a fixed constant and is checked against that exact folder before any write.
 */
function docsTarget() {
  const target = path.resolve(ROOT, DOC_PATH);
  const allowed = `${path.resolve(ROOT, "docs/research/usd-session/v1")}${path.sep}`;
  if (!target.startsWith(allowed)) throw new Error(`refusing to write ${DOC_PATH}: outside docs/research/usd-session/v1`);
  return target;
}

function main(argv) {
  const check = argv.includes("--check");
  const printOnly = argv.includes("--print");
  const markdownOnly = argv.includes("--markdown");
  const report = build();
  const text = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);
  const target = assertResearchPath(path.join(ROOT, OUT_PATH), "layer1 backtest report");
  const docTarget = docsTarget();

  if (printOnly) {
    process.stdout.write(summary(report));
    return 0;
  }
  if (markdownOnly) {
    process.stdout.write(markdown);
    return 0;
  }
  if (check) {
    if (!fs.existsSync(target)) {
      process.stderr.write(`missing ${OUT_PATH}; run node scripts/build_layer1_backtest_report.js\n`);
      return 1;
    }
    if (!fs.existsSync(docTarget)) {
      process.stderr.write(`missing ${DOC_PATH}; run node scripts/build_layer1_backtest_report.js\n`);
      return 1;
    }
    const committedBody = JSON.parse(fs.readFileSync(target, "utf8"));
    const { provenance, ...body } = report;
    const digest = sha256(stableStringify(body));
    if (committedBody.provenance && committedBody.provenance.report_sha256 !== digest) {
      process.stderr.write(`report is stale: committed ${committedBody.provenance.report_sha256}, rebuilt ${digest}\n`);
      return 1;
    }
    if (fs.readFileSync(target, "utf8") !== text) {
      process.stderr.write(`${OUT_PATH} differs from a fresh build; rerun the builder\n`);
      return 1;
    }
    if (fs.readFileSync(docTarget, "utf8") !== markdown) {
      process.stderr.write(`${DOC_PATH} differs from a fresh render; rerun the builder\n`);
      return 1;
    }
    process.stdout.write(`report reproduces: ${digest}\nmarkdown reproduces: ${DOC_PATH}\n`);
    return 0;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, "utf8");
  fs.mkdirSync(path.dirname(docTarget), { recursive: true });
  fs.writeFileSync(docTarget, markdown, "utf8");
  process.stdout.write(summary(report));
  process.stdout.write(`wrote ${OUT_PATH} (${report.provenance.report_sha256})\n`);
  process.stdout.write(`wrote ${DOC_PATH}\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { build, summary, docsTarget, OUT_PATH, DOC_PATH, RUN_PATH, ENGINE_PATH };
