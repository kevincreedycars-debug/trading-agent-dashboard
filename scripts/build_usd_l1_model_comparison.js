#!/usr/bin/env node
"use strict";

/**
 * Build the aggregate model comparison (research only).
 *
 * Every registered research model is replayed over the same committed mornings, so the aggregate is one
 * table with one denominator rule. A registered fixture is included only as a labelled reference row and
 * is excluded from every research delta and from the agreement figures: it is a test double, not a book.
 *
 *   node scripts/build_usd_l1_model_comparison.js
 *   node scripts/build_usd_l1_model_comparison.js --check
 */

const fs = require("node:fs");
const path = require("node:path");

const controller = require("../backtester/lib/usd_layer1_backtester/backtest_controller");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

const ROOT = path.resolve(__dirname, "..");
const OUT = "data/usd-layer1-backtester/model-comparison-v1.json";
const DATASET = "data/usd-layer1-backtester/run-v1.json";

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8").replace(/^\uFEFF/, ""));
}

function build() {
  const dataset = readJson(DATASET);
  const models = registry.ENTRIES.slice();
  const reports = {};
  const decisions = {};
  for (const entry of models) {
    const run = controller.runBacktest({
      dataset,
      datasetPath: DATASET,
      model: entry.key,
      validationMode: "structural",
      includeDecisions: true
    });
    reports[entry.key] = run.summary;
    decisions[entry.key] = run.decisions;
  }
  const research = models.filter((entry) => entry.kind === "research" && entry.cloud);
  const fixtures = models.filter((entry) => entry.kind === "fixture");

  const agreement = [];
  for (let left = 0; left < research.length; left += 1) {
    for (let right = left + 1; right < research.length; right += 1) {
      const a = research[left].key;
      const b = research[right].key;
      let bothCalled = 0;
      let same = 0;
      const dates = decisions[a].map((decision) => decision.date);
      for (const date of dates) {
        const first = decisions[a].find((decision) => decision.date === date);
        const second = decisions[b].find((decision) => decision.date === date);
        if (!first || !second) continue;
        const firstCalled = first.call.direction === "BULLISH" || first.call.direction === "BEARISH";
        const secondCalled = second.call.direction === "BULLISH" || second.call.direction === "BEARISH";
        if (!firstCalled || !secondCalled) continue;
        bothCalled += 1;
        if (first.call.direction === second.call.direction) same += 1;
      }
      agreement.push({
        left: a,
        right: b,
        common_directional_mornings: bothCalled,
        same_direction: same,
        share: bothCalled === 0 ? null : same / bothCalled,
        note: "Agreement between two books is a reproduction observation, not an accuracy or an edge claim."
      });
    }
  }

  const rows = models.map((entry) => {
    const summary = reports[entry.key];
    return {
      model: entry.key,
      identity: entry.identity,
      label: entry.label,
      role: entry.role,
      kind: entry.kind,
      fixture: entry.kind === "fixture",
      pooled: summary.pooled,
      markets: summary.markets,
      coverage: summary.validation,
      included_in_research_comparison: entry.kind === "research" && entry.cloud,
      note: entry.kind === "fixture"
        ? "FIXTURE - a constant test double. Reported so a reader can see the plumbing, excluded from every research delta and agreement figure."
        : null
    };
  });

  const body = {
    schema_version: "usd-l1-model-comparison-v1",
    generated_from: {
      dataset: DATASET,
      run_version: dataset.run && dataset.run.run_version,
      sessions: dataset.sessions.length,
      controller_version: controller.CONTROLLER_VERSION,
      registry_version: registry.REGISTRY_VERSION
    },
    validation_mode: "structural",
    models: rows,
    research_models: research.map((entry) => entry.key),
    fixtures: fixtures.map((entry) => entry.key),
    agreement,
    labels: {
      research_only: "Research only. Gross directional replay with no costs, no slippage and no execution.",
      fixture_policy: "A fixture is a registered test double. It is labelled a fixture, excluded from research deltas, and never described as a book.",
      validation: "Structural validity only: internal consistency and the declared 05:00 London cutoff. Receipted validity is reported separately and is zero on this panel."
    }
  };
  return body;
}

function main(argv = process.argv) {
  const check = argv.includes("--check");
  const text = `${JSON.stringify(build(), null, 2)}\n`;
  const file = path.join(ROOT, OUT);
  if (check) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "") : null;
    const ok = current === text;
    console.log(JSON.stringify({ out: OUT, reproduces: ok }, null, 2));
    return ok ? 0 : 1;
  }
  fs.writeFileSync(file, text, "utf8");
  console.log(JSON.stringify({ out: OUT, bytes: Buffer.byteLength(text) }, null, 2));
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = { build };
