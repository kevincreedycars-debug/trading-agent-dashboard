// The lane 1 baseline: what the rule reads and what the loop would send, held still.
//
// This file is the anchor for every change made for the second account. Twice a day a change to
// `lib/l2l_strategy.js`, to `scripts/run-live-trading-trader.js` or to the order tool can quietly move lane 1's
// behaviour - a stop a point wider, a reason reworded, a flag added to the tool's argument list - and no test
// that only exercises the new lane would notice. So the fixtures under `tests/fixtures/lane1` are a real
// snapshot of lane 1's artifacts (see `scripts/capture-lane1-baseline-fixtures.js` for exactly what was kept),
// read at one fixed instant with a stubbed order bridge, and the two goldens beside them are the whole of what
// the rule and the loop state about them.
//
// Both tests must pass unchanged before and after any second-lane work. If one of them fails, the change moved
// lane 1 and the diff is the evidence. The goldens are regenerated only on purpose:
//
//     LANE1_GOLDEN=write node --test tests/live_trading_lane1_baseline.test.js
//
// and a regenerated golden is a review item in its own right, not a fix.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");
const trader = require("../scripts/run-live-trading-trader.js");

const FIXTURES = path.join(__dirname, "fixtures", "lane1");
const REPO_ROOT = path.join(__dirname, "..");
const WRITE_GOLDEN = process.env.LANE1_GOLDEN === "write";

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

const CLOCK = fixture("clock.json");
const NOW = Date.parse(CLOCK.now_utc);
const CALLS = fixture("calls.json");
const LEVELS = fixture("levels.json");
const FEED = fixture("feed.json");

function golden(name, actual) {
  const file = path.join(FIXTURES, name);
  if (WRITE_GOLDEN) {
    fs.writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`, "utf8");
    return actual;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// The rule's readings as the page and the loop both ask for them: the four instruments joined to the ladder,
// the published calls, the account's own positions, and one instant for all of it. Only the fields a change
// could move are kept - every stage, every ticket number and every sentence the panel prints.
function readings() {
  const levelsBySymbol = new Map(LEVELS.instruments.map(row => [row.symbol, row.levels]));
  const calls = {};
  CALLS.agents.forEach(agent => {
    calls[agent.agent] = agent.priority_call?.direction ?? agent.calls?.["24h"]?.direction ?? null;
  });
  const rows = strategy.strategyReadings({
    instruments: FEED.instruments.map(instrument => ({
      symbol: instrument.symbol,
      dashboard_asset: instrument.dashboard_asset,
      levels: levelsBySymbol.get(instrument.symbol) || [],
      m5: instrument.m5,
      point: instrument.point
    })),
    positions: FEED.positions,
    calls,
    nowMs: NOW
  });
  return rows.map(row => ({
    symbol: row.symbol,
    stage: row.stage,
    side: row.side,
    direction: row.direction,
    r_multiple: row.r_multiple,
    level: row.level ? { price: row.level.price, role: row.level.role } : null,
    plan: row.plan
      ? {
        side: row.plan.side,
        entry: row.plan.entry,
        stop: row.plan.stop,
        target: row.plan.target,
        target_level: row.plan.target_level ? row.plan.target_level.price : null,
        risk: row.plan.risk,
        reward: row.plan.reward,
        r_multiple: row.plan.r_multiple,
        risk_points: row.plan.risk_points,
        reward_points: row.plan.reward_points,
        entry_type: row.plan.entry_type
      }
      : null,
    confirmation: row.confirmation
      ? { time_utc: row.confirmation.time_utc, close: row.confirmation.close, beyond: row.confirmation.beyond }
      : null,
    reason: row.reason
  }));
}


// The account as the order tool's read-only `status` prints it, built from the same feed fixture so the loop is
// reading the case the rule was read against: two positions, both carrying lane 1's own magic.
function statusStdout() {
  const positions = FEED.positions.map(position => ({
    ticket: position.ticket,
    symbol: position.symbol,
    side: position.side,
    type: "POSITION_TYPE_SELL",
    volume: position.volume,
    price_open: position.price_open,
    stop_loss: position.stop_loss,
    take_profit: position.take_profit,
    magic: position.magic,
    comment: position.comment
  }));
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: trader.ORDER_TOOL_RELATIVE,
    action: "status",
    account: {
      login_masked: FEED.account.login_masked,
      server: FEED.account.server,
      balance: FEED.account.balance,
      equity: FEED.account.equity,
      positions_open: positions.length,
      orders_open: 0
    },
    ticket_filter: null,
    positions,
    orders: []
  };
  return `STATUS ${positions.length} position(s), 0 pending order(s)\n${JSON.stringify(record)}\n`;
}

// The tool's answer to a send. Nothing here is a decision: the stub answers as the terminal would, and every
// spawn is recorded so the golden states the exact argument list lane 1 asks the tool for.
function sentStdout(action) {
  const record = {
    at_utc: new Date(NOW).toISOString(),
    tool: trader.ORDER_TOOL_RELATIVE,
    action,
    answer: {
      sent: true,
      retcode: 10009,
      retcode_name: "TRADE_RETCODE_DONE",
      done: true,
      deal: 5000001,
      order: 5000002,
      volume: 0.01,
      price: null,
      comment: null,
      filling_mode: null,
      request_id: null
    },
    attempts: 1
  };
  return `${action.toUpperCase()} stub answer\n${JSON.stringify(record)}\n`;
}

function flagMap(args) {
  const map = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!String(token).startsWith("--")) continue;
    const next = args[index + 1];
    map[token] = index + 1 < args.length && !String(next).startsWith("--") ? next : true;
  }
  return map;
}

// One run of the loop against the fixtures, with the bridge stubbed: same artifact reads, same gates, same
// decisions, and the tool's own answers replaced by a record that says "done".
function runBaseline() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane1-baseline-"));
  for (const name of ["calls.json", "levels.json", "feed.json"]) {
    fs.copyFileSync(path.join(FIXTURES, name), path.join(dir, name));
  }
  const options = trader.parseArgs([
    "--once",
    "--confirm-live",
    "--published",
    FIXTURES,
    "--calls",
    path.join(dir, "calls.json"),
    "--levels",
    path.join(dir, "levels.json"),
    "--feed",
    path.join(dir, "feed.json")
  ]);
  options.log = path.join(dir, "trader.log");
  options.lock = path.join(dir, "trader.lock");
  options.state = path.join(dir, "trader-state.json");
  options.journal = path.join(dir, "orders.log");
  options.statusOut = path.join(dir, "trader-status.json");
  options.closeRequests = "off";

  const spawns = [];
  const spawn = (command, args) => {
    const action = String(args[1] || "");
    spawns.push({ command, action, flags: flagMap(args) });
    return {
      status: 0,
      stdout: action === "status" ? statusStdout() : sentStdout(action),
      stderr: ""
    };
  };
  const result = trader.runOnce(options, { spawn, now: () => NOW });
  return { ...result, spawns, options, dir };
}

// A row as the golden states it: the keys named here and only the ones the row actually carries, so a field
// added to a row later is a deliberate addition to this list rather than a golden that fails for a reason
// nobody reads.
function pick(row, keys) {
  const out = {};
  keys.forEach(key => {
    if (row && Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  });
  return out;
}

const ROW_KEYS = ["symbol", "asset", "stage", "decision", "side", "level", "entry", "stop", "target", "risk", "r_multiple", "confirmation_time_utc", "close", "beyond_points", "reason"];
const DECISION_KEYS = ["symbol", "asset", "ticket", "decision", "rung", "new_stop", "current_stop", "entry", "risk", "multiple", "reason"];
const PLACEMENT_KEYS = ["symbol", "asset", "side", "signal_time_utc", "level", "entry", "stop", "target", "risk", "r_multiple", "sent", "placed", "planned", "refused", "retcode_name", "order_ticket", "reentry"];

function runShape({ code, record, spawns, dir }) {
  // The run's own temp directory is a name the machine invents per run, so it is stated as <workdir> in the
  // golden: what lane 1 asks the tool for is the flag and the file, not which scratch folder held it.
  const settle = value => (typeof value === "string" && dir && value.startsWith(dir)
    ? value.replace(dir, "<workdir>")
    : value);
  return {
    code,
    status: record.status,
    reason: record.reason,
    lane: record.lane,
    armed: record.armed,
    interval_seconds: record.interval_seconds,
    snapshot: pick(record.snapshot, ["generated_at_utc", "age_seconds", "stale_after_seconds", "instruments"]),
    terminal: pick(record.terminal, ["account", "server", "positions_open", "orders_open", "ours"]),
    rule: {
      summary: pick(record.rule, ["instruments", "confirmed", "waiting", "inTrade", "blocked", "noCall", "noLevels", "unavailable"]),
      taken_today: record.rule.taken_today,
      reentries_today: record.rule.reentries_today,
      open_tickets: record.rule.open_tickets,
      rows: record.rule.rows.map(row => pick(row, ROW_KEYS))
    },
    trades: pick(record.trades, ["count"]),
    placements: record.placements.map(row => pick(row, PLACEMENT_KEYS)),
    pendings: record.pendings.rows.map(row => pick(row, DECISION_KEYS)),
    positions: record.positions.rows.map(row => pick(row, DECISION_KEYS)),
    stops: record.stops.rows.map(row => pick(row, DECISION_KEYS)),
    tool: spawns.map(spawn => ({
      action: spawn.action,
      flags: Object.fromEntries(Object.entries(spawn.flags).map(([flag, value]) => [flag, settle(value)]))
    }))
  };
}

test("lane 1: the rule reads the captured artifacts exactly as the golden states", () => {
  // One instant, taken from the fixture's own clock: a baseline that moved with the wall clock would fail every
  // five minutes and hold nothing still.
  assert.equal(new Date(NOW).toISOString(), CLOCK.now_utc);
  assert.deepEqual(readings(), golden("readings.golden.json", readings()));
});

test("lane 1: the loop's decisions, tickets and tool arguments are the golden's", () => {
  const run = runBaseline();
  const shape = runShape(run);
  assert.deepEqual(shape, golden("run.golden.json", shape));
});
