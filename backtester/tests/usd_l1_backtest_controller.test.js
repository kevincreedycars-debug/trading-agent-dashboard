"use strict";

/**
 * Tests for the reusable USD Layer 1 backtest controller.
 *
 * The important test is parity: the controller is only a seam if replaying the committed panel through it
 * reproduces every stored decision and every stored market result. The rest of the file holds the gates and
 * the adapter boundary to the behaviour the run artefact and the n8n workflows rely on.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const DATASET_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json");
const CLI = path.join(ROOT, "backtester", "scripts", "run_usd_l1_backtest_controller.js");
const CHILD_WORKFLOW = path.join(ROOT, "automation", "n8n", "usd-l1-layer1-decision.workflow.json");
const CONTROLLER_WORKFLOW = path.join(ROOT, "automation", "n8n", "usd-l1-backtest-controller.workflow.json");
const controller = require("../lib/usd_layer1_backtester/backtest_controller");

const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
const childWorkflow = JSON.parse(fs.readFileSync(CHILD_WORKFLOW, "utf8"));
const controllerWorkflow = JSON.parse(fs.readFileSync(CONTROLLER_WORKFLOW, "utf8"));
const sessionOn = (date) => dataset.sessions.find((session) => session.date === date);

function snapshotOf(session, overrides = {}) {
  return Object.assign(
    {
      date: session.date,
      cutoff_at_utc: session.cutoff_at_utc,
      values: session.saved_inputs,
      input_meta: session.input_meta,
      source_legend: dataset.input_source_legend
    },
    overrides
  );
}

function runCli(args) {
  return JSON.parse(execFileSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" }));
}

test("the controller replays every stored decision and every stored market result", () => {
  const parity = controller.checkParity(dataset);
  assert.equal(parity.ok, true);
  assert.equal(parity.checked, 725 * 3);
  assert.equal(parity.decision_mismatches, 0);
  assert.equal(parity.results_checked, 725 * 3 * 4);
  assert.equal(parity.result_mismatches, 0);
  for (const model of controller.MODEL_IDS) {
    const entry = parity.per_model[model];
    if (!entry) {
      // A registered model the committed panel does not carry is reported as not covered, never scored.
      assert.ok(parity.not_covered.includes(model), `${model} is either checked or explicitly not covered`);
      continue;
    }
    assert.equal(entry.checked, 725, `${model} mornings`);
    assert.equal(entry.decision_mismatches, 0, `${model} direction/conviction/raw/weight`);
    assert.equal(entry.result_mismatches, 0, `${model} market results`);
    assert.deepEqual(entry.mismatch_samples, []);
  }
  assert.deepEqual(parity.not_covered, ["fixture_constant"]);
});

test("the committed panel is structurally accepted on every morning and receipted on none", () => {
  const report = controller.runBacktest({ dataset, model: "current", includeDecisions: false });
  assert.equal(report.summary.sessions, 725);
  assert.deepEqual(report.summary.validation, {
    structural_accepted: 725,
    structural_blocked: 0,
    receipted_complete: 0,
    receipted_incomplete: 725
  });
  assert.deepEqual(report.summary.statuses, { blocked: 0, allowed: 714, abstained: 11 });
});

test("the receipted mode refuses every morning the committed panel cannot clock", () => {
  const report = controller.runBacktest({
    dataset,
    model: "current",
    validationMode: "receipted",
    includeDecisions: false
  });
  assert.deepEqual(report.summary.statuses, { blocked: 725, allowed: 0, abstained: 0 });
  assert.equal(report.summary.validation.structural_accepted, 725);
  assert.equal(report.summary.validation.receipted_complete, 0);
  assert.equal(report.summary.blocked_reasons.receipted_incomplete, 725);
  assert.equal(report.summary.pooled.scored, 0);
  assert.throws(
    () => controller.runBacktest({ dataset, model: "current", validationMode: "guessed" }),
    /unknown validation mode/
  );
});

test("an ordinary morning passes the structural gate and carries its provenance warning", () => {
  const session = sessionOn("2024-01-03");
  const validation = controller.validateSnapshot(snapshotOf(session), controller.resolveLayer1("challenger"));
  assert.equal(validation.accepted, true);
  assert.equal(validation.structural_accepted, true);
  assert.deepEqual(validation.reasons, []);
  assert.equal(validation.cutoff_at_utc, validation.contract_cutoff_at_utc);
  assert.ok(validation.warnings.some((warning) => warning.code === "unclocked_inputs"));
  assert.equal(validation.receipted.complete, false);
});

test("a weekend, a wrong cutoff, an empty snapshot and a post-cutoff print are blocked", () => {
  const session = sessionOn("2024-01-03");
  const adapter = controller.resolveLayer1("current");

  const weekend = controller.validateSnapshot(
    snapshotOf(session, { date: "2024-01-06", cutoff_at_utc: "2024-01-06T05:00:00.000Z" }),
    adapter
  );
  assert.equal(weekend.accepted, false);
  assert.ok(weekend.reasons.some((reason) => reason.code === "weekend_session"));

  const wrongCutoff = controller.validateSnapshot(snapshotOf(session, { cutoff_at_utc: "2024-01-03T06:00:00.000Z" }), adapter);
  assert.equal(wrongCutoff.accepted, false);
  assert.ok(wrongCutoff.reasons.some((reason) => reason.code === "cutoff_mismatch"));

  const empty = controller.validateSnapshot(snapshotOf(session, { values: null }), adapter);
  assert.equal(empty.accepted, false);
  assert.ok(empty.reasons.some((reason) => reason.code === "snapshot_missing"));

  const laterPrint = session.input_meta.map((entry) =>
    entry[0] === "vix_level" ? ["vix_level", "2024-01-03T05:30:00.000Z", 0, entry[3]] : entry
  );
  const afterCutoff = controller.validateSnapshot(snapshotOf(session, { input_meta: laterPrint }), adapter);
  assert.equal(afterCutoff.accepted, false);
  assert.ok(afterCutoff.reasons.some((reason) => reason.code === "input_after_cutoff"));
});

test("an unknown date is a blocked decision rather than a silently shorter run", () => {
  const report = controller.runBacktest({ dataset, model: "challenger", dates: ["2024-01-03", "1999-01-04"] });
  assert.equal(report.decisions.length, 2);
  assert.equal(report.decisions[0].date, "2024-01-03");
  assert.equal(report.decisions[1].status, "blocked");
  assert.equal(report.decisions[1].validation.reasons[0].code, "not_in_dataset");
  assert.equal(report.summary.statuses.blocked, 1);
});

test("the controller accepts a caller's own adapter and does not require a built-in model id", () => {
  const constant = {
    id: "test_constant",
    label: "Test constant",
    version: "test-constant-v0",
    source: "backtester/tests/usd_l1_backtest_controller.test.js",
    inputKeys: ["vix_level"],
    evaluate: () => ({ direction: "BULLISH", conviction: 3, raw_score: 1, reason: "synthetic" })
  };
  const report = controller.runBacktest({ dataset, adapter: constant, dates: ["2024-01-03"] });
  assert.equal(report.layer1.id, "test_constant");
  assert.equal(report.decisions[0].status, "allowed");
  // Every additional market the configured matrix declares is scored; the three with no cached series report
  // no_outcome rather than disappearing from the result.
  assert.deepEqual(report.decisions[0].results, {
    EURUSD: "hit",
    XAUUSD: "hit",
    XAGUSD: "no_outcome",
    NAS100: "hit",
    BTCUSD: "hit",
    WTIUSD: "no_outcome",
    GBPUSD: "no_outcome"
  });
  assert.throws(() => controller.resolveLayer1({ id: "broken" }), /missing label, version, evaluate\(\), inputKeys\[\]/);
});

test("scoring is contrarian, excludes flat sessions and names a missing outcome", () => {
  const outcomes = {
    EURUSD: { direction: "DOWN" },
    XAUUSD: { direction: "UP" },
    BTCUSD: { direction: "FLAT" },
    NAS100: null
  };
  assert.deepEqual(controller.scoreCall("BULLISH", outcomes), {
    EURUSD: "hit",
    XAUUSD: "miss",
    BTCUSD: "flat",
    NAS100: "no_outcome"
  });
  assert.deepEqual(controller.scoreCall("BEARISH", outcomes), {
    EURUSD: "miss",
    XAUUSD: "hit",
    BTCUSD: "flat",
    NAS100: "no_outcome"
  });
  assert.deepEqual(controller.scoreCall("NO_CALL", outcomes), {
    EURUSD: "no_call",
    XAUUSD: "no_call",
    BTCUSD: "no_call",
    NAS100: "no_call"
  });
});

test("the comparison uses the same mornings and reports deltas from the first model", () => {
  const comparison = controller.compareBacktests({
    dataset,
    models: ["current", "challenger", "challenger_v1"],
    includeDecisions: false
  });
  assert.deepEqual(comparison.models, ["current", "challenger", "challenger_v1"]);
  assert.equal(comparison.baseline, "current");
  for (const model of comparison.models) {
    assert.equal(comparison.reports[model].summary.sessions, 725, `${model} mornings`);
    assert.deepEqual(comparison.reports[model].window, comparison.window);
  }
  assert.equal(comparison.deltas.challenger.baseline, "current");
  assert.ok(comparison.deltas.challenger.pooled < 0);
  assert.ok(comparison.deltas.challenger_v1.pooled < 0);
  assert.equal(
    comparison.deltas.challenger.pooled,
    Math.round((comparison.reports.challenger.summary.pooled.accuracy - comparison.reports.current.summary.pooled.accuracy) * 10000) / 10000
  );
});

test("Wilson's lower bound keeps a small sample honest", () => {
  assert.equal(controller.wilsonLowerBound(0, 0), null);
  assert.equal(controller.wilsonLowerBound(0, 10), 0);
  assert.ok(controller.wilsonLowerBound(10, 10) < 1);
  assert.ok(controller.wilsonLowerBound(10, 10) > 0.6);
  assert.ok(controller.wilsonLowerBound(60, 100) < 0.6);
});

test("the CLI lists dates, evaluates one morning and reports a blocked missing date", () => {
  const listed = runCli(["--list-dates", "--from", "2024-01-02", "--to", "2024-01-05"]);
  assert.deepEqual(listed.dates, ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"]);

  const one = runCli(["--model", "challenger", "--date", "2024-01-03", "--decisions"]);
  assert.equal(one.summary.sessions, 1);
  assert.equal(one.decisions.length, 1);
  assert.equal(one.decisions[0].model, "challenger");
  assert.equal(one.validation_mode, "structural");
  assert.equal(one.decisions[0].validation.accepted, true);

  const missing = runCli(["--date", "1999-01-04", "--decisions"]);
  assert.equal(missing.decisions[0].status, "blocked");
  assert.equal(missing.decisions[0].validation.reasons[0].code, "not_in_dataset");
});

test("the CLI fails loudly on an unknown model and a parity mismatch would exit non-zero", () => {
  const bad = spawnSync(process.execPath, [CLI, "--model", "nope"], { cwd: ROOT, encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /unknown Layer 1 model/);

  const parity = runCli(["--parity"]);
  assert.equal(parity.ok, true);
  assert.equal(parity.decision_matches, 2175);
  assert.equal(parity.result_matches, 8700);
});

function graphOf(workflow) {
  const names = workflow.nodes.map((node) => node.name);
  assert.equal(new Set(names).size, names.length, `${workflow.name} has unique node names`);
  for (const [source, connection] of Object.entries(workflow.connections)) {
    assert.ok(names.includes(source), `${workflow.name} connects from a real node: ${source}`);
    for (const branch of connection.main || []) {
      for (const edge of branch) {
        assert.ok(names.includes(edge.node), `${workflow.name} connects to a real node: ${edge.node}`);
      }
    }
  }
  return names;
}

function nodeOf(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `${workflow.name} contains ${name}`);
  return node;
}

function runSummariseCode(decisions, config) {
  const sandbox = {
    $input: { all: () => decisions.map((json) => ({ json })) },
    $: (name) => {
      assert.equal(name, "Run configuration");
      return { first: () => ({ json: config }) };
    }
  };
  return vm.runInNewContext(`(function () {\n${nodeOf(controllerWorkflow, "Summarise decisions").parameters.jsCode}\n})()`, sandbox, {
    timeout: 2000
  })[0].json;
}

test("both workflow artifacts are inactive research graphs whose connections name real nodes", () => {
  assert.equal(childWorkflow.active, false);
  assert.equal(controllerWorkflow.active, false);
  assert.match(childWorkflow.name, /^USD Layer 1 - decision/);
  assert.match(controllerWorkflow.name, /^USD Layer 1 - backtest controller/);

  const childNames = graphOf(childWorkflow);
  assert.ok(childNames.includes("When called by a controller"));
  assert.ok(childNames.includes("Return decision"));
  assert.equal(nodeOf(childWorkflow, "When called by a controller").type, "n8n-nodes-base.executeWorkflowTrigger");

  const controllerNames = graphOf(controllerWorkflow);
  assert.ok(controllerNames.includes("Evaluate Layer 1 for each date"));
  assert.ok(controllerNames.includes("Report blocked mornings"));
  assert.ok(controllerNames.includes("Report complete"));
});

test("the child evaluates one morning through the CLI and refuses malformed calls before the shell", () => {
  const command = nodeOf(childWorkflow, "Evaluate one morning").parameters.command;
  assert.match(command, /run_usd_l1_backtest_controller\.js/);
  assert.match(command, /--date "\{\{ \$json\.date \}\}"/);
  assert.match(command, /--model "\{\{ \$json\.model \}\}"/);
  assert.match(command, /--validation "\{\{ \$json\.validation \}\}"/);
  assert.match(command, /--decisions/);

  const guard = nodeOf(childWorkflow, "Normalise call").parameters.jsCode;
  assert.match(guard, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/);
  assert.match(guard, /dataset\.includes\("\.\."\)/);
  assert.match(guard, /validation !== "structural" && validation !== "receipted"/);
});

test("the controller fans out one child call per listed date and names the child by label", () => {
  const listed = nodeOf(controllerWorkflow, "List session dates").parameters.command;
  assert.match(listed, /--list-dates/);
  assert.match(listed, /--from "\{\{ \$json\.from \}\}"/);

  const call = nodeOf(controllerWorkflow, "Evaluate Layer 1 for each date");
  assert.equal(call.type, "n8n-nodes-base.executeWorkflow");
  assert.equal(call.parameters.mode, "each");
  assert.equal(call.parameters.options.waitForSubWorkflow, true);
  assert.equal(call.parameters.workflowId.cachedResultName, childWorkflow.name);
  assert.match(call.parameters.workflowId.value, /^REPLACE_WITH_[\w]+$/);

  const split = nodeOf(controllerWorkflow, "One item per date").parameters.jsCode;
  assert.match(split, /\$\("Run configuration"\)\.first\(\)\.json/);
  assert.match(split, /listed\.dates\.length === 0/);
});


test("the n8n summary is the controller summary on allowed and blocked mornings", () => {
  const config = {
    dataset: "data/usd-layer1-backtester/run-v1.json",
    model: "challenger",
    from: "2024-01-02",
    to: "2024-01-31",
    validation: "structural",
    markets: dataset.market_matrix.additional_markets
  };
  const report = controller.runBacktest({
    dataset,
    model: config.model,
    dates: ["2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-08", "2024-01-09"],
    includeDecisions: true
  });
  console.error("DBG", report.decisions.length, JSON.stringify(report.decisions.map((d) => d.tests && d.tests.scored_markets ? d.tests.scored_markets.length : null)), JSON.stringify(Object.keys(report.summary.markets).length));
  const published = runSummariseCode(report.decisions, config);
  assert.deepEqual(JSON.parse(JSON.stringify(published.summary)), report.summary);
  assert.equal(published.summary.sessions, 6);
  assert.equal(published.window.from, "2024-01-02");
  assert.equal(published.window.to, "2024-01-09");
  assert.equal(published.layer1.id, "challenger");

  const weekend = controller.runBacktest({
    dataset,
    model: "current",
    dates: ["2024-01-06"],
    includeDecisions: true
  });
  const blocked = runSummariseCode(weekend.decisions, Object.assign({}, config, { model: "current" }));
  assert.deepEqual(JSON.parse(JSON.stringify(blocked.summary)), weekend.summary);
  assert.equal(blocked.summary.statuses.blocked, 1);
  assert.equal(blocked.summary.blocked_reasons.not_in_dataset, 1);
  assert.equal(blocked.summary.pooled.scored, 0);
});

test("the workflow surface carries no secret or provider call", () => {
  const surfaces = [];
  for (const workflow of [childWorkflow, controllerWorkflow]) {
    for (const node of workflow.nodes) {
      if (node.type === "n8n-nodes-base.stickyNote") continue;
      surfaces.push(JSON.stringify(node.parameters));
    }
  }
  const text = surfaces.join("\n");
  assert.doesNotMatch(text, /N8N_API_KEY|api[_-]?key\s*[:=]|Bearer [A-Za-z0-9]/i);
  assert.doesNotMatch(text, /https?:\/\//);
  assert.doesNotMatch(text, /warehouse|place_order|broker/i);
});

