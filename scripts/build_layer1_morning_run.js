#!/usr/bin/env node
/**
 * Build and verify the dated Layer 1 morning-run report.
 *
 * The report is one morning through the shared engine: current adapter, legacy 25-row book and H1 candidate.
 * It always blocks H1 when its nine-input evidence contract is unmet and never substitutes a legacy count.
 *
 * Usage:
 *   node scripts/build_layer1_morning_run.js
 *   node scripts/build_layer1_morning_run.js --check
 *   node scripts/build_layer1_morning_run.js --print
 *   node scripts/build_layer1_morning_run.js --markdown
 *
 * Research only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { buildMorningRun, DEFAULT_DATE, SCHEMA_VERSION } = require("../lib/layer1_backtesting/morning_run");

const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = "data/usd-layer1-backtester/morning-run-v1.json";
const DOC_PATH = `docs/research/usd-session/v1/layer1_morning_run_${DEFAULT_DATE}.md`;

function cell(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function pct(value) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

function clockText(clock) {
  if (!clock || !clock.stamp) return "missing; no clock";
  const observed = clock.observed_at_utc || clock.observed ? "timestamp" : "date only";
  return `${clock.stamp} (${observed}); published —; received —`;
}

function contributionText(row) {
  if (row.contribution === null || row.contribution === undefined) return "not applied";
  if (!row.contribution.length) return "no published current factor reads it";
  return row.contribution
    .map((item) => `${item.factor_id} ${item.signal} ${item.signed_weight > 0 ? "+" : ""}${item.signed_weight}`)
    .join("; ");
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Layer 1 historical morning run — ${report.date}`);
  lines.push("");
  lines.push(
    `Schema \`${SCHEMA_VERSION}\`, research only, built on ${report.built_on} from the committed artefacts. ` +
      `Session: ${report.session.cutoff_at_utc} to ${report.session.endpoint_at_utc} (${report.session.window_hours} hours).`
  );
  lines.push("");
  lines.push(
    `> Strict evidence: **${report.strict_evidence.ready ? "ready" : "not ready"}**. ${report.strict_evidence.reason}`
  );
  lines.push("");
  lines.push("## 1. Decisions");
  lines.push("");
  lines.push("| Model | Outcome | Direction | Conviction | Trade | Gate / evidence grade |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const [key, label] of [
    ["current", "Current USD model"],
    ["legacy_candidate", "Legacy 25-row book"],
    ["h1", "USD-L1-25F-H1-v0.1.0"],
  ]) {
    const model = report.models[key];
    const grade =
      key === "current" ? `${model.gate.code} (${report.strict_evidence.current_model_evidence_grade})` : model.gate.code;
    lines.push(
      `| ${label} (\`${model.id}\` ${model.version}) | ${model.outcome} | ${model.direction} | ${cell(
        model.conviction
      )} | ${model.trade_eligible ? "yes" : "no"} | ${cell(grade)} |`
    );
  }
  lines.push("");
  lines.push(
    `The current adapter is allowed under its declared narrow gate, but that gate does not prove a 05:00 receipt. ` +
      `H1 is blocked, so its direction is \`NO_CALL\`, conviction is null and trade is \`no\`.`
  );
  lines.push("");
  lines.push("## 2. Current-model inputs");
  lines.push("");
  lines.push("| Field | Value | Source | Availability | Freshness | Applied rule | Contribution |");
  lines.push("| --- | ---: | --- | --- | --- | --- | --- |");
  for (const row of report.inputs.current) {
    lines.push(
      `| \`${row.key}\` | ${cell(row.value)} | ${cell(row.source)} | ${cell(clockText(row.availability))} | ${
        row.freshness.status
      } (lag ${cell(row.freshness.lag_business_days)} business days) | ${cell(
        row.applied_rule.factor_ids.join(", ")
      )} | ${cell(contributionText(row))} |`
    );
  }
  lines.push("");
  lines.push(
    "Input-level contribution lists are references to the factor rows; they are not additive. The factor table in §4 is the additive view."
  );
  lines.push("");
  lines.push("## 3. H1 inputs");
  lines.push("");
  lines.push(
    "| Input | Required source / instrument | Archived value | Availability | Freshness | Applied rule | Contribution | First blocker |"
  );
  lines.push("| --- | --- | ---: | --- | --- | --- | --- | --- |");
  for (const row of report.inputs.h1) {
    lines.push(
      `| ${row.label} | ${cell(row.required.source)} / ${cell(row.required.instrument)} | ${cell(
        row.value
      )} | ${cell(clockText(row.availability))} | ${row.freshness.status} (max ${
        row.freshness.max_age_hours
      }h) | ${row.applied_rule.applied ? cell(row.applied_rule.factor_ids.join(", ")) : "not applied (gate closed)"} | ${cell(
        contributionText(row)
      )} | ${cell(row.gate ? row.gate.code : null)} |`
    );
  }
  lines.push("");
  lines.push(
    "H1 arithmetic is not run on a closed gate. A blocked row therefore has no contribution, no direction and no trade, and no legacy value is relabelled as H1 evidence."
  );
  lines.push("");
  lines.push("## 4. Current-model factor contributions");
  lines.push("");
  lines.push("| Factor | Signal | Weight | Signed contribution |");
  lines.push("| --- | --- | ---: | ---: |");
  for (const row of report.factors.current.rows) {
    lines.push(
      `| ${row.factor_id || row.label} | ${row.signal} | ${cell(row.weight)} | ${
        row.signed_weight > 0 ? "+" : ""
      }${row.signed_weight} |`
    );
  }
  lines.push("");
  lines.push(
    `Sum of signed weights: **${report.factors.current.net_signed_weight}**. Published conviction: **${cell(
      report.factors.current.published_conviction
    )}**. ${report.factors.current.note}`
  );
  lines.push("");
  lines.push("## 5. Sample reconciliation before scoring");
  lines.push("");
  lines.push(
    "| Model | Scheduled | Blocked | Valid abstentions | Allowed | Directional calls | Allowed NO_CALL | Trades | Performance |"
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const [key, label] of [
    ["control", "Current model (narrow gate)"],
    ["candidate", "Legacy 25-row book"],
    ["h1", "H1 candidate"],
  ]) {
    const row = report.sample_reconciliation[key];
    lines.push(
      `| ${label} | ${row.scheduled} | ${row.blocked} | ${row.abstained} | ${row.allowed} | ${row.directional} | ${row.no_call_allowed} | ${row.trade_eligible} | ${row.performance.status} (${row.performance.scored}/${row.performance.denominator}) |`
    );
  }
  lines.push("");
  lines.push(report.sample_reconciliation.classification);
  lines.push("");
  lines.push("## 6. Legacy input-clock audit and reach benchmark");
  lines.push("");
  lines.push(
    `**0 of 725** — ${report.legacy_input_clock_audit.label}: present ${report.legacy_input_clock_audit.sessions.present}, fresh ${report.legacy_input_clock_audit.sessions.fresh}, clocked ${report.legacy_input_clock_audit.sessions.clocked}, identified ${report.legacy_input_clock_audit.sessions.identified} of ${report.legacy_input_clock_audit.sessions.total}. It belongs to \`${report.legacy_input_clock_audit.source}\` and ${report.legacy_input_clock_audit.path} §${report.legacy_input_clock_audit.section}; it is not H1 coverage.`
  );
  lines.push("");
  if (report.reach_benchmark) {
    const one = (layer) => report.reach_benchmark[layer];
    lines.push(
      `**97% — half-distance reach, not accuracy.** Layer 1: ${one("layer1").hits} of ${one("layer1").denominator} (${pct(
        one("layer1").rate_pct
      )}, 95% CI ${one("layer1").wilson95[0]}–${one("layer1").wilson95[1]}). Layer 2: ${one("layer2").hits} of ${
        one("layer2").denominator
      } (${pct(one("layer2").rate_pct)}, 95% CI ${one("layer2").wilson95[0]}–${one("layer2").wilson95[1]}). ` +
        `Half distance is ADR20 × 0.25. There is no entry, stop, sequence or adverse boundary, so this is not a win rate or directional accuracy. Source: ${report.reach_benchmark.source}.`
    );
  } else {
    lines.push("**97%** — the half-distance reach summary is not present in this checkout, so no reach figure is printed.");
  }
  lines.push("");
  lines.push("## 7. H1 missing evidence");
  lines.push("");
  lines.push("| Input | Code | Failed rungs | Reason |");
  lines.push("| --- | --- | --- | --- |");
  for (const blocker of report.h1_blockers) {
    lines.push(
      `| ${blocker.label} | \`${blocker.code}\` | ${cell(blocker.failed_rungs.join(", "))} | ${cell(blocker.reason)} |`
    );
  }
  lines.push("");
  lines.push("## 8. Recoverable gaps and what to acquire");
  lines.push("");
  lines.push("| Input | Archived value | What is recoverable | Acquisition |");
  lines.push("| --- | ---: | --- | --- |");
  for (const gap of report.recoverable_gaps) {
    lines.push(`| ${gap.label} | ${cell(gap.value)} | ${cell(gap.recoverable)} | ${cell(gap.acquisition)} |`);
  }
  lines.push("");
  lines.push("## 9. Remaining work towards the four backtests");
  lines.push("");
  lines.push("| Test | State | Input still needed | Blocker |");
  lines.push("| --- | --- | --- | --- |");
  for (const item of report.remaining_work) {
    lines.push(`| ${item.label} | ${item.state} | ${cell(item.need)} | ${cell(item.blocker)} |`);
  }
  lines.push("");
  lines.push("## 10. External state verified where access allowed");
  lines.push("");
  const external = report.external_state;
  lines.push(
    `- Supabase (${external.supabase.project}): ${external.supabase.infrastructure_status}. Newest primary snapshot ${external.supabase.newest_primary_snapshot}. ${external.supabase.blocker}.`
  );
  lines.push(`- n8n (${external.n8n.host}): health ${external.n8n.healthz}; ${external.n8n.history_api}. ${external.n8n.blocker}.`);
  lines.push(
    `- \`usd-24h-research-dataset.json\`: ${external.usd_24h_research_dataset.rows} rows, ${external.usd_24h_research_dataset.evaluable_rows} evaluable, ${external.usd_24h_research_dataset.window}, call ${external.usd_24h_research_dataset.call_time_et} ET, outcome ${external.usd_24h_research_dataset.outcome_instrument}. ${external.usd_24h_research_dataset.blocker}.`
  );
  lines.push("");
  lines.push("## 11. Provenance");
  lines.push("");
  lines.push(`Report digest: \`${report.provenance.artifact_sha256}\``);
  lines.push("");
  lines.push("| Input | Bytes | sha256 |");
  lines.push("| --- | ---: | --- |");
  for (const source of report.provenance.sources) {
    lines.push(`| \`${source.path}\` | ${source.bytes} | \`${source.sha256}\` |`);
  }
  lines.push("");
  lines.push(report.provenance.note);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function build() {
  const report = buildMorningRun({ root: ROOT });
  return { report, text: `${JSON.stringify(report, null, 2)}\n`, markdown: renderMarkdown(report) };
}

function main(argv) {
  const check = argv.includes("--check");
  const printOnly = argv.includes("--print");
  const markdownOnly = argv.includes("--markdown");
  const built = build();
  if (printOnly) {
    const current = built.report.models.current;
    const h1 = built.report.models.h1;
    process.stdout.write(
      [
        `morning ${built.report.date}: ${built.report.strict_evidence.ready ? "strict ready" : "strict blocked"}`,
        `current: ${current.outcome} ${current.direction} conviction ${current.conviction} trade ${current.trade_eligible}`,
        `h1: ${h1.outcome} ${h1.direction} conviction ${h1.conviction} trade ${h1.trade_eligible}`,
        `h1 blockers: ${built.report.h1_blockers.length}`,
        `artifact: ${built.report.provenance.artifact_sha256}`,
      ].join("\n") + "\n"
    );
    return 0;
  }
  if (markdownOnly) {
    process.stdout.write(built.markdown);
    return 0;
  }
  const jsonTarget = path.join(ROOT, OUT_PATH);
  const docTarget = path.join(ROOT, DOC_PATH);
  if (check) {
    for (const target of [jsonTarget, docTarget]) {
      if (!fs.existsSync(target)) throw new Error(`missing ${path.relative(ROOT, target)}; run the builder`);
    }
    if (fs.readFileSync(jsonTarget, "utf8") !== built.text) throw new Error(`${OUT_PATH} differs from a fresh build`);
    if (fs.readFileSync(docTarget, "utf8") !== built.markdown) throw new Error(`${DOC_PATH} differs from a fresh render`);
    process.stdout.write(`morning report reproduces: ${built.report.provenance.artifact_sha256}\n`);
    return 0;
  }
  fs.mkdirSync(path.dirname(jsonTarget), { recursive: true });
  fs.mkdirSync(path.dirname(docTarget), { recursive: true });
  fs.writeFileSync(jsonTarget, built.text, "utf8");
  fs.writeFileSync(docTarget, built.markdown, "utf8");
  process.stdout.write(`wrote ${OUT_PATH} (${built.report.provenance.artifact_sha256})\n`);
  process.stdout.write(`wrote ${DOC_PATH}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { ROOT, OUT_PATH, DOC_PATH, build, main, renderMarkdown };

