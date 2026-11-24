"use strict";

// Guards the readiness artefact behind the Backtest Engine v2 page, and the two claims the page must
// keep apart: what the published matrix says (4 scored, 1 proxy-scored, 8 measured, 11 blocked) and
// what an unpublished scratch run saw (7/1/8/8). Every published number is copied from
// backtesting-screen-v1.json, so a rebuild cannot quietly publish a different readiness. The page's
// view manifest is read here too, because its fresh-call and readiness bindings are what turn the
// artefact into a status.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { build, OUT_PATH } = require("../scripts/build_usd_l1_market_readiness");

const ROOT = path.resolve(__dirname, "..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8").replace(/^\uFEFF/, ""));
const record = readJson(OUT_PATH);
const screen = readJson("data/usd-layer1-backtester/backtesting-screen-v1.json");
const acquisition = readJson("data/usd-layer1-backtester/h1-v1/oanda-h1-acquisition-latest.json");
const manifest = readJson("backtester/assets/backtest-engine-v2.manifest.json");
const pkg = readJson("package.json");

test("the committed readiness artefact is what the published screen states", () => {
  assert.deepEqual(record, build(), `${OUT_PATH} is stale - run npm run build:usd-l1-market-readiness`);
  assert.equal(record.schema_version, "usd-l1-market-readiness-v1");
  assert.equal(record.published.matrix_id, screen.market_matrix.id);
  assert.equal(record.published.fingerprint, screen.market_matrix.fingerprint);
  assert.deepEqual(record.published.counts, {
    scored: screen.market_matrix.counts.scored,
    proxy_scored: screen.market_matrix.counts.proxy_scored,
    measured_tick_replay: screen.market_matrix.counts.measured_tick_replay,
    blocked: screen.market_matrix.counts.blocked,
    ready: screen.market_matrix.counts.ready,
    proxy_ready: screen.market_matrix.counts.proxy_ready
  });
});

test("the published readiness is 4 scored, 1 proxy-scored, 8 measured and 11 blocked over 24 cells", () => {
  const counts = record.published.counts;
  assert.equal(counts.scored, 4);
  assert.equal(counts.proxy_scored, 1);
  assert.equal(counts.measured_tick_replay, 8);
  assert.equal(counts.blocked, 11);
  assert.equal(record.published.markets * record.published.tests, 24);
  assert.equal(counts.scored + counts.proxy_scored + counts.measured_tick_replay + counts.blocked, 24);
});

test("the scratch 7/1/8/8 is research evidence and no published count includes it", () => {
  const scratch = record.unpublished_research;
  assert.equal(scratch.published, false);
  assert.equal(scratch.status, "scratch_measurement");
  assert.deepEqual(scratch.counts, { scored: 7, proxy_scored: 1, measured_tick_replay: 8, blocked: 8 });
  assert.match(scratch.note, /not live readiness/i);
  assert.notEqual(record.published.counts.scored, scratch.counts.scored);
});

test("XAG/WTI/GBP direction waits on the distribution route and their L2L cells name both datasets", () => {
  for (const key of ["XAGUSD", "WTIUSD", "GBPUSD"]) {
    const market = record.markets.find((entry) => entry.key === key);
    const held = acquisition.markets.find((entry) => entry.market === key);
    assert.ok(market, `${key} must be in the readiness artefact`);
    assert.equal(market.direction.status, "blocked", `${key} direction is not scored`);
    assert.equal(market.direction.publication, "pending_data_distribution", `${key} waits on the distribution route`);
    assert.equal(market.direction.acquisition.rows, held.rows, `${key} must cite the acquired row count`);
    for (const testId of ["l2l_full_5r", "l2l_half_3r"]) {
      assert.equal(market[testId].status, "blocked");
      assert.deepEqual(market[testId].missing.sort(), ["bid/ask 5-minute tape", "pre-session level ladder"]);
    }
  }
});

test("no cell claims a predictive advantage", () => {
  assert.equal(record.advantage.status, "not_established");
  assert.match(record.advantage.statement, /not accuracy or edge/i);
});

test("a coordinator build refreshes the artefact with commands that exist", () => {
  assert.equal(typeof pkg.scripts[record.refresh.build.replace("npm run ", "")], "string");
  assert.equal(typeof pkg.scripts[record.refresh.check.replace("npm run ", "")], "string");
  for (const input of record.refresh.inputs) {
    assert.ok(fs.existsSync(path.join(ROOT, input)), `${input} must exist for a rebuild`);
  }
  assert.match(record.refresh.contract, /no UI edit/i);
});

test("the page manifest reads the fresh-call proof and the readiness artefact", () => {
  const sources = manifest.sources;
  assert.equal(sources.freshcall.url, "data/usd-layer1-backtester/n8n/fresh-call-v1.json");
  assert.equal(sources.readiness.url, OUT_PATH);
  for (const [key, source] of Object.entries(sources)) {
    assert.ok(source.label, `${key} must carry a label`);
    assert.ok("verified_at" in source, `${key} must declare the field its verification time is read from, or null`);
  }
  const freshcall = manifest.nodes.find((node) => node.id === "freshcall");
  assert.ok(freshcall, "the flow must show the fresh-call proof as its own step");
  const rule = freshcall.readiness.software.rules[0];
  assert.deepEqual(rule.if, { path: "freshcall.verdict.status", op: "eq", value: "recomputed_from_cutoff_inputs" });
  const outcomes = manifest.nodes.find((node) => node.id === "outcomes");
  assert.equal(outcomes.readiness.data.rules[0].if.path, "readiness.published.counts.blocked");
  assert.equal(outcomes.readiness.data.rules[0].if.op, "gt");
});

test("historical availability stays a separate claim from the fresh-call proof", () => {
  const freshcall = manifest.nodes.find((node) => node.id === "freshcall");
  assert.match(freshcall.summary, /does not establish contemporaneous availability/i);
  const sourcesNode = manifest.nodes.find((node) => node.id === "sources");
  assert.equal(sourcesNode.readiness.research.rules[0].if.path, "evidence.claims.historical_availability.status");
  assert.equal(sourcesNode.readiness.research.rules[0].if.value, "not_established");
});
