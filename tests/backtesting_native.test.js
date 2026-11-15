"use strict";

// The Backtesting tab's view models. These tests read the two committed artefacts and assert that every figure the
// tab prints comes from one of them: the fail-safe statuses, the twenty-five row ledger, the map path, the equity
// curve gate and the links (each one has to point at a file that exists in this checkout).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const native = require("../lib/backtesting_native");
const run = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json"), "utf8"));
const engine = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "usd-layer1-backtester", "engine-v1.json"), "utf8"));

function scoredDate(market) {
  return [...run.sessions]
    .reverse()
    .find((session) => {
      const result = session.results && session.results.challenger_v1 ? session.results.challenger_v1[market] : null;
      return result === "hit" || result === "miss";
    }).date;
}

function blockedDate() {
  return [...engine.morning_states].reverse().find((morning) => morning.outcome === "blocked").date;
}

test("versions and headline counts are the artefacts' own", () => {
  const versions = native.versions(run, engine);
  assert.equal(versions.engine, engine.engine_version);
  assert.equal(versions.book, engine.book_version);
  assert.equal(versions.decision, engine.decision_version);
  assert.equal(versions.run, run.run.run_version);
  assert.match(versions.label, new RegExp(engine.engine_version));
  const headline = native.headline(run, engine);
  assert.equal(headline.mornings, engine.summary.mornings);
  assert.equal(headline.allowed + headline.blocked + headline.abstained, engine.summary.mornings);
  assert.equal(headline.models.challenger_v1.calls_reconstructed, run.coverage.by_model.challenger_v1.calls_reconstructed);
});

test("a blocked morning reports the check that refused it, with the engine's own sentence", () => {
  const date = blockedDate();
  const rows = native.failSafes(engine, date);
  assert.deepEqual(rows.map((row) => row.id), ["E1", "E2", "E3", "E4", "E5", "E6"]);
  const logged = engine.fired_rule_log.find((entry) => entry.date === date);
  for (const row of rows) {
    if (row.status === "blocked" || row.status === "abstained") {
      assert.ok(row.evidence.length, `${date} ${row.id} fired and must say why`);
      const rule = logged.fired_rules.find((entry) => entry.rule_id === row.id);
      assert.ok(rule, `${date} ${row.id} is in the fired-rule log`);
      assert.equal(row.evidence[0], rule.reason);
    } else {
      assert.equal(row.passed, row.status === "passed" ? true : null);
      assert.deepEqual(row.evidence, []);
    }
  }
});

test("E6 is not applicable, not passed, when the morning made no call", () => {
  const morning = engine.morning_states.find((entry) => entry.direction === "NO_CALL" && entry.checks.E6 === null);
  assert.ok(morning, "the run must contain a no-call morning");
  const row = native.failSafes(engine, morning.date).find((entry) => entry.id === "E6");
  assert.equal(row.status, "not applicable");
  assert.equal(row.passed, null);
});

test("every one of the twenty-five rows is accounted for on a selected morning", () => {
  const date = engine.morning_states[0].date;
  const rows = native.factorLedger(engine, run, date);
  assert.equal(rows.length, engine.book_detail.rows.length);
  assert.equal(rows.length, 25);
  assert.deepEqual(rows.map((row) => row.id), engine.book_detail.rows.map((row) => row.id));
  const morning = engine.morning_states.find((entry) => entry.date === date);
  rows.forEach((row, index) => {
    assert.ok(["V", "A", "S", "N"].includes(row.state));
    assert.equal(row.state, morning.states.charAt(index));
    assert.equal(row.vote, morning.votes.charAt(index) === "+" ? 1 : morning.votes.charAt(index) === "-" ? -1 : 0);
    assert.equal(row.carried, Number(morning.ages.charAt(index)) > 0);
    assert.ok(row.state_label.length > 10, `${row.id} explains its state`);
    assert.ok(row.role_label, `${row.id} names its role`);
    assert.ok(row.treatment, `${row.id} names the treatment the adjudication allowed`);
    assert.ok(Array.isArray(row.inputs));
  });
  assert.equal(
    rows.filter((row) => row.may_vote).length,
    rows.filter((row) => row.role === "direction" && row.readable).length,
    "only a readable direction row may vote"
  );
});


test("the map starts at the snapshot, ends at the date and keeps the other three tests selectable", () => {
  const date = blockedDate();
  const model = native.mapModel(run, engine, { test: "four_markets", market: "EURUSD", date });
  assert.deepEqual(
    model.nodes.filter((node) => node.kind === "test").map((node) => node.testId),
    ["dxy_direction", "four_markets", "l2l_full_5r", "l2l_half_3r"]
  );
  assert.equal(model.path[0], "snapshot");
  assert.equal(model.path[1], "decision");
  assert.ok(model.path.includes("test:four_markets"));
  assert.ok(model.path.includes("market:EURUSD"));
  assert.ok(model.path.includes("date:" + date));
  assert.ok(model.columns.length >= 5);
  assert.ok(model.nodes.every((node) => Number.isInteger(node.column)));
  for (const edge of model.edges) {
    assert.ok(model.nodes.some((node) => node.id === edge.from), `${edge.from} exists`);
    assert.ok(model.nodes.some((node) => node.id === edge.to), `${edge.to} exists`);
  }
});

test("test 2 answers with a prediction, an actual move and a scored result on a real date", () => {
  const date = scoredDate("EURUSD");
  const detail = native.pathDetail(run, engine, { test: "four_markets", market: "EURUSD", date });
  const steps = Object.fromEntries(detail.steps.map((step) => [step.key, step]));
  assert.ok(steps.prediction.value.includes("EUR/USD"));
  assert.ok(["UP", "DOWN", "FLAT"].includes(steps.actual.value.split(" ")[0]));
  assert.match(steps.actual.value, /flat band/);
  assert.ok(detail.outcome.result === "hit" || detail.outcome.result === "miss");
  assert.equal(detail.versions.engine, engine.engine_version);
});

test("test 3 stops at the morning call when no tape or ladder is staged, and says what is missing", () => {
  const date = run.sessions[100].date;
  const ladderDates = run.level_provenance.totals.sessions_eligible_for_all_four_list;
  assert.equal(ladderDates.includes(date), false, "the chosen date must sit outside the archived ladders");
  const detail = native.pathDetail(run, engine, { test: "l2l_full_5r", market: "XAUUSD", date });
  assert.ok(detail.missing.length, "the path must name what stops it");
  assert.match(detail.missing.join(" "), /no five-minute tape|no archived ladder/);
  const levels = detail.steps.find((step) => step.key === "levels");
  assert.equal(levels.status, "missing");
  const entry = detail.steps.find((step) => step.key === "entry");
  assert.equal(entry.status, "missing");
  assert.equal(native.equity(run, "l2l_full_5r").available, true, "the demo ledger still exists, in its own label");
});

test("the equity curve is published only for variants with replayed trades", () => {
  const full = native.equity(run, "l2l_full_5r");
  assert.equal(full.available, true);
  assert.equal(full.starting_balance, 100000);
  assert.equal(full.risk_per_trade_pct, 1);
  assert.match(full.reason, /execution demo/);
  assert.ok(full.accounts.every((account) => account.geometry === "full"));
  const none = native.equity({ execution_demo: null }, "l2l_full_5r");
  assert.equal(none.available, false);
  assert.match(none.reason, /no curve/);
});

test("the lane's own fail-safes separate a blocked official series from a priced broker lane", () => {
  const lane = native.laneFailSafes(run, engine, { test: "dxy_direction", market: "DXY", date: run.sessions.slice(-1)[0].date });
  const official = lane.find((row) => row.id === "official-series");
  assert.equal(official.status, "blocked");
  const price = lane.find((row) => row.id === "lane-price");
  assert.ok(["passed", "missing"].includes(price.status));
});

test("deep links round-trip through the hash", () => {
  const selection = { test: "l2l_half_3r", market: "NAS100", date: "2026-10-12" };
  const hash = native.buildHash(selection);
  assert.equal(hash, "#backtesting/l2l_half_3r/NAS100/2026-10-12");
  assert.deepEqual(native.parseHash(hash), { tab: "usd-layer1-backtester", ...selection });
  assert.deepEqual(native.parseHash("#backtesting"), { tab: "usd-layer1-backtester", test: null, market: null, date: null });
  assert.equal(native.parseHash("#backtesting-development").tab, "backtesting-development");
  assert.equal(native.parseHash("#overview").tab, null);
});

test("every link the tab prints points at a file in this checkout", () => {
  for (const entry of native.TESTS) {
    const links = native.links(entry.id);
    assert.ok(links.rules.length && links.data.length, `${entry.id} has rules and data links`);
    for (const link of [...links.rules, ...links.data, ...links.infrastructure]) {
      if (link.external || link.href.startsWith("#")) continue;
      assert.ok(fs.existsSync(path.join(ROOT, link.href)), `${entry.id}: ${link.href} exists`);
    }
  }
  for (const entry of native.olderBacktests()) {
    if (entry.href.startsWith("#")) continue;
    assert.ok(fs.existsSync(path.join(ROOT, entry.href)), `${entry.href} exists`);
  }
  assert.ok(native.plannedReviews().every((review) => review.status === "planned"));
});

test("the refused inputs on a morning are the ones the engine's own E3 sentence names", () => {
  const date = "2026-10-09";
  const refused = native.staleInputs(engine, run, date);
  const logged = engine.fired_rule_log.find((entry) => entry.date === date).fired_rules.find((entry) => entry.rule_id === "E3");
  const named = [...logged.reason.matchAll(/\(stale: ([^)]+)\)/g)].flatMap((match) => match[1].split(",").map((key) => key.trim()));
  assert.ok(named.length, "the E3 sentence names the stale inputs");
  assert.deepEqual(
    refused.flatMap((row) => row.inputs.map((input) => input.key)).sort(),
    named.slice().sort(),
    "the tab lists exactly the inputs the engine refused"
  );
  for (const row of refused) {
    assert.equal(row.state, "S");
    assert.ok(row.inputs.every((input) => input.reason), `${row.row_id} says why each input was refused`);
    assert.ok(row.inputs.every((input) => !/T/.test(String(input.print_date)) || input.reason === "older than its declared age"));
  }
});

test("the vote register shows who could vote and how, without inventing a family score", () => {
  const date = "2026-10-09";
  const directionRows = engine.book_detail.rows.filter((row) => row.role === "direction");
  const votes = native.voteRegister(engine, run, date);
  assert.equal(votes.available, true);
  assert.equal(votes.rows.length, directionRows.length);
  const tally = votes.tally;
  assert.equal(tally.bullish + tally.bearish + tally.flat + tally.silent, votes.rows.length);
  assert.equal(tally.silent, native.staleInputs(engine, run, date).length, "a refused row cannot vote");
  assert.equal(votes.rows.filter((row) => row.counted).length, votes.rows.length - tally.silent);
  for (const row of votes.rows) {
    assert.ok(["bullish USD", "bearish USD", "no vote"].includes(row.vote_label), `${row.id} has a recorded vote label`);
    assert.equal(row.counted, row.state === "V");
  }
  assert.equal(votes.net_score, undefined, "the artefacts store row votes, not the engine's family score");
  const other = native.voteRegister(engine, run, "2026-10-12").tally;
  assert.notDeepEqual(other, tally, "a different morning has a different vote tally");
  assert.equal(native.voteRegister(engine, run, "1999-01-01").available, false);
});

