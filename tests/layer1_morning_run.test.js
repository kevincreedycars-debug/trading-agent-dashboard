"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { buildMorningRun, DEFAULT_DATE } = require("../lib/layer1_backtesting/morning_run");
const { build, DOC_PATH, OUT_PATH } = require("../scripts/build_layer1_morning_run");

const ROOT = path.resolve(__dirname, "..");
const report = buildMorningRun({ root: ROOT });

test("the dated morning runs both models through one engine and blocks H1 on evidence", () => {
  assert.equal(report.schema_version, "layer1-morning-run.v1");
  assert.equal(report.date, DEFAULT_DATE);
  assert.equal(report.research_only, true);
  assert.equal(report.strict_evidence.ready, false);

  assert.equal(report.models.current.outcome, "allowed");
  assert.equal(report.models.current.direction, "BEARISH");
  assert.equal(report.models.current.conviction, 3);
  assert.equal(report.models.current.trade_eligible, true);
  assert.equal(report.models.current.gate.code, "data_present_and_fresh");
  assert.equal(report.strict_evidence.current_model_evidence_grade, "narrow_presence_and_freshness_only");

  assert.equal(report.models.h1.outcome, "blocked");
  assert.equal(report.models.h1.direction, "NO_CALL");
  assert.equal(report.models.h1.conviction, null);
  assert.equal(report.models.h1.trade_eligible, false);
  assert.equal(report.models.h1.gate.code, "h1_historical_evidence_blocked");
  assert.equal(report.models.h1.reasons.length, 9);
  assert.ok(report.models.h1.reasons.every((reason) => reason.source === "gate"));
});

test("every current input exposes source, availability, freshness, rule and factor reference", () => {
  assert.equal(report.inputs.current.length, 12);
  for (const row of report.inputs.current) {
    assert.ok(row.key, "input key");
    assert.ok(row.source, `${row.key} source`);
    assert.ok(row.availability && row.availability.note, `${row.key} availability`);
    assert.ok(["fresh", "stale"].includes(row.freshness.status), `${row.key} freshness`);
    assert.ok(row.applied_rule && typeof row.applied_rule.applied === "boolean", `${row.key} rule`);
    assert.ok(Array.isArray(row.contribution), `${row.key} contribution references`);
  }
  const vix = report.inputs.current.find((row) => row.key === "vix_level");
  assert.equal(vix.availability.precision, "date");
  assert.match(vix.availability.note, /no observation, publication or receipt clock/);
  const gold = report.inputs.current.find((row) => row.key === "gold_price");
  assert.equal(gold.availability.precision, "timestamp");
  assert.equal(gold.availability.age_hours, 0);
});

test("all nine H1 inputs are present, each with a blocker and a recoverable action", () => {
  assert.equal(report.inputs.h1.length, 9);
  assert.equal(report.h1_blockers.length, 9);
  assert.equal(report.h1_missing_evidence.length, 9);
  for (const row of report.inputs.h1) {
    assert.ok(row.required.source && row.required.instrument && row.required.transform, `${row.key} contract`);
    assert.equal(row.freshness.status, "not_demonstrated");
    assert.equal(row.applied_rule.applied, false);
    assert.equal(row.contribution, null);
    assert.ok(row.gate && row.gate.code, `${row.key} blocker`);
    assert.ok(row.recoverable && row.acquisition, `${row.key} recovery path`);
  }
  assert.deepEqual(
    report.event_calendar.missing_types,
    ["CPI", "Employment Situation", "advance GDP", "Personal Income and Outlays"]
  );
  assert.equal(report.event_calendar.calendar_count_for_morning, 0);
});

test("the full sample is reconciled before any performance is scored", () => {
  const sample = report.sample_reconciliation;
  assert.deepEqual(
    {
      scheduled: sample.control.scheduled,
      blocked: sample.control.blocked,
      abstained: sample.control.abstained,
      directional: sample.control.directional,
      trades: sample.control.trade_eligible,
      performance: sample.control.performance.status,
    },
    { scheduled: 725, blocked: 108, abstained: 0, directional: 609, trades: 194, performance: "UNSCORED" }
  );
  assert.deepEqual(
    {
      blocked: sample.candidate.blocked,
      abstained: sample.candidate.abstained,
      directional: sample.candidate.directional,
      trades: sample.candidate.trade_eligible,
    },
    { blocked: 541, abstained: 143, directional: 41, trades: 41 }
  );
  assert.deepEqual(
    {
      blocked: sample.h1.blocked,
      abstained: sample.h1.abstained,
      directional: sample.h1.directional,
      trades: sample.h1.trade_eligible,
      performance: sample.h1.performance.status,
    },
    { blocked: 725, abstained: 0, directional: 0, trades: 0, performance: "NO_DENOMINATOR" }
  );
  for (const value of Object.values(sample)) {
    if (typeof value === "object" && value && value.performance) {
      assert.equal(value.performance.scored, 0);
      assert.equal(value.performance.denominator, 0);
    }
  }
});

test("the legacy 0/725 and the 97% reach figures keep their original labels and denominators", () => {
  assert.equal(report.legacy_input_clock_audit.sessions.clocked, 0);
  assert.equal(report.legacy_input_clock_audit.sessions.total, 725);
  assert.match(report.legacy_input_clock_audit.source, /validity_gate\.ladder/);
  assert.match(report.legacy_input_clock_audit.path, /layer1_backtest_report\.md/);
  assert.equal(report.legacy_input_clock_audit.label, "legacy run-v1 input-clock gate");

  assert.equal(report.reach_benchmark.metric, "half-distance reach rate");
  assert.match(report.reach_benchmark.not, /not directional accuracy/);
  assert.equal(report.reach_benchmark.layer1.hits, 2418);
  assert.equal(report.reach_benchmark.layer1.denominator, 2493);
  assert.equal(report.reach_benchmark.layer2.hits, 1549);
  assert.equal(report.reach_benchmark.layer2.denominator, 1592);
  assert.equal(report.external_state.n8n.healthz, "HTTP 200");
  assert.match(report.external_state.n8n.history_api, /401/);
  assert.equal(report.external_state.usd_24h_research_dataset.rows, 584);
  assert.equal(report.external_state.usd_24h_research_dataset.call_time_et, "09:30:00");
});

test("the committed JSON and markdown reproduce from the committed artefacts", () => {
  const fresh = build();
  assert.equal(fs.readFileSync(path.join(ROOT, OUT_PATH), "utf8"), fresh.text);
  assert.equal(fs.readFileSync(path.join(ROOT, DOC_PATH), "utf8"), fresh.markdown);
  assert.equal(fresh.report.provenance.artifact_sha256.length, 64);
  assert.equal(JSON.stringify(fresh.report).includes("[object Object]"), false);
  assert.equal(/\bNaN\b/.test(JSON.stringify(fresh.report)), false);
});

