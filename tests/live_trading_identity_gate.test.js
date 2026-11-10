// The identity gate: what a second-account run sends when its terminal is not the account it says it is.
//
// The gate lives in the order tool and is checked twice per run - once when it attaches, and again immediately
// before every `order_send`, retries included. This file proves it with a fake bridge (`tests/fixtures/fake-mt5`)
// rather than a terminal: the fake answers the handful of calls the tool makes from a JSON state file and appends
// every order it is given to a file, so "nothing was sent" is something a test reads rather than something the
// code claims. A wrong account, a wrong server, a wrong terminal, a disconnected terminal, a missing identity file
// and an account that changes between the read and the send all have to leave that file empty.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const TOOL = path.join(ROOT, "tools", "mt5-bridge", "live-trading-order.py");
const FAKE_MT5 = path.join(__dirname, "fixtures", "fake-mt5");
const PYTHON = process.env.LIVE_TRADING_PYTHON || "python";

// The ownership numbers and the account: the second lane's magic, and a login that is plainly a fixture. Neither
// is a real number, and neither is ever written to the repository - the identity file lives in the temp folder a
// test makes and deletes itself with it.
const LANE2_MAGIC = 20261005;
const LOGIN = 7654321;
const OTHER_LOGIN = 1111111;
const TERMINAL = "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2";

function baseState(over = {}) {
  return {
    login: LOGIN,
    server: "FTMO-Server",
    connected: true,
    terminal_path: TERMINAL,
    terminal_name: "FTMO Global Markets MT5 Terminal 2",
    symbols: {
      "US100.cash": {
        name: "US100.cash",
        digits: 2,
        point: 0.01,
        volume_min: 0.1,
        volume_step: 0.1,
        trade_stops_level: 10,
        filling_mode: 2,
        trade_mode: 4
      }
    },
    ticks: { "US100.cash": { bid: 24990.0, ask: 24991.0 } },
    positions: [],
    orders: [],
    ...over
  };
}

function identity(over = {}) {
  return { login: LOGIN, server: "FTMO-Server", terminal_path: TERMINAL, ...over };
}

// One run of the tool against the fake bridge. Everything it touches lives in a temp folder: the state, the
// identity file, the journal and the file every order is appended to.
function run({ action = "open", state = baseState(), identityDocument = identity(), args = [], identityFile = true, identityPathOverride = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "identity-gate-"));
  const statePath = path.join(dir, "state.json");
  const identityPath = path.join(dir, "identity.json");
  const journalPath = path.join(dir, "orders.log");
  const sendsPath = path.join(dir, "sends.log");
  const counterPath = path.join(dir, "calls.txt");
  fs.writeFileSync(statePath, JSON.stringify(state), "utf8");
  if (identityFile) fs.writeFileSync(identityPath, JSON.stringify(identityDocument), "utf8");

  const toolArgs = [
    TOOL,
    action,
    "--symbol", "US100.cash",
    "--side", "sell",
    "--entry-price", "25010",
    "--stop-loss", "25030",
    "--take-profit", "24940",
    "--ticket", "700002",
    "--stop-loss", "25030",
    "--magic", String(LANE2_MAGIC),
    "--journal", journalPath,
    "--path", TERMINAL,
    "--confirm-live"
  ];
  if (identityFile) toolArgs.push("--expect-identity", identityPathOverride || identityPath);
  toolArgs.push(...args);

  const env = { ...process.env, FAKE_MT5_STATE: statePath, FAKE_MT5_SENDS: sendsPath, FAKE_MT5_COUNTER: counterPath };
  env.PYTHONPATH = FAKE_MT5 + (env.PYTHONPATH ? path.delimiter + env.PYTHONPATH : "");
  const result = spawnSync(PYTHON, toolArgs, { cwd: dir, encoding: "utf8", env, timeout: 60000 });
  const sends = fs.existsSync(sendsPath)
    ? fs.readFileSync(sendsPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    : [];
  const journal = fs.existsSync(journalPath)
    ? fs.readFileSync(journalPath, "utf8").trim().split(/\r?\n/).filter(Boolean)
    : [];
  const record = (() => {
    const lines = String(result.stdout || "").split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line.startsWith("{")) continue;
      try {
        return JSON.parse(line);
      } catch {
        // keep looking upwards
      }
    }
    return null;
  })();
  return { status: result.status, stdout: String(result.stdout || ""), stderr: String(result.stderr || ""), sends, journal, record, dir, identityPath };
}

test("a missing identity file refuses before anything is sent", () => {
  // The flag is there, the file is not: a lane that cannot prove its account must not trade on a guess.
  const run1 = run({ identityPathOverride: path.join(os.tmpdir(), "no-such-lane-identity.json") });
  assert.equal(run1.status, 3, "the tool exits 3 for a refusal");
  assert.equal(run1.record?.refused, true);
  assert.match(run1.record?.message || "", /identity_missing/);
  assert.equal(run1.sends.length, 0, "no order reached the bridge");
});

test("a distinct magic without an identity file refuses before importing the package", () => {
  // No PYTHONPATH to the fake: if the tool got as far as importing MetaTrader5 this run would fail with an import
  // error instead of a refusal, which is the point of checking here rather than after attaching.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "identity-gate-"));
  const args = [
    TOOL, "open", "--symbol", "US100.cash", "--side", "buy",
    "--magic", String(LANE2_MAGIC), "--journal", path.join(dir, "orders.log"), "--confirm-live"
  ];
  const env = { ...process.env };
  delete env.PYTHONPATH;
  const result = spawnSync(PYTHON, args, { cwd: dir, encoding: "utf8", env, timeout: 60000 });
  assert.equal(result.status, 3);
  assert.match(String(result.stdout), /--expect-identity/);
  assert.equal(fs.existsSync(path.join(dir, "sends.log")), false);
});

test("the wrong account on the terminal refuses and sends nothing", () => {
  const wrong = run({ state: baseState({ login: OTHER_LOGIN }) });
  assert.equal(wrong.status, 3);
  assert.match(wrong.record?.message || "", /identity_mismatch/);
  assert.equal(wrong.sends.length, 0);
  // The reason names both accounts only as masks: the full login is never written by the tool.
  assert.equal(wrong.stdout.includes(String(LOGIN)), false, "the expected login is not printed");
  assert.equal(wrong.stdout.includes(String(OTHER_LOGIN)), false, "the terminal's login is not printed");
  assert.match(wrong.stdout, /\*\*\*321/);
});

test("the wrong server refuses even when the login matches", () => {
  const wrong = run({ state: baseState({ server: "FTMO-Server-Demo" }) });
  assert.equal(wrong.status, 3);
  assert.match(wrong.record?.message || "", /identity_mismatch/);
  assert.equal(wrong.sends.length, 0);
});

test("a different terminal binary refuses even when the account matches", () => {
  const wrong = run({ identityDocument: identity({ terminal_path: "C:\\Program Files\\Other Terminal" }) });
  assert.equal(wrong.status, 3);
  assert.match(wrong.record?.message || "", /identity_mismatch/);
  assert.equal(wrong.sends.length, 0);
});

test("a disconnected terminal refuses rather than sending where no answer can come back", () => {
  const wrong = run({ state: baseState({ connected: false }) });
  assert.equal(wrong.status, 3);
  assert.match(wrong.record?.message || "", /identity_disconnected/);
  assert.equal(wrong.sends.length, 0);
});

test("a matching identity sends exactly one order, carrying the lane's own magic", () => {
  const good = run({});
  assert.equal(good.status, 0, good.stderr || good.stdout);
  assert.equal(good.sends.length, 1);
  assert.equal(good.sends[0].magic, LANE2_MAGIC);
  assert.equal(good.sends[0].symbol, "US100.cash");
  assert.equal(good.record?.answer?.done, true);
  assert.deepEqual(good.record?.identity, { login_masked: "***321", server: "FTMO-Server", terminal_path: TERMINAL });
  // The published evidence is the journal: it carries the mask, never the number.
  assert.equal(good.journal.join("\n").includes(String(LOGIN)), false);
});

test("an account that changes between the check and the send sends nothing", () => {
  // The first read (at attach) sees the lane's account; the check immediately before the send sees another one.
  const changed = run({ state: baseState({ login_after: { calls: 1, login: OTHER_LOGIN } }) });
  assert.equal(changed.status, 3);
  assert.match(changed.record?.message || "", /identity_mismatch/);
  assert.equal(changed.sends.length, 0, "the gate fired before the order reached the bridge");
});

test("a ticket carrying another lane's magic is refused before it is changed or closed", () => {
  const foreign = baseState({
    positions: [{
      ticket: 700002,
      symbol: "US100.cash",
      magic: 20261004,
      type: 1,
      volume: 0.1,
      price_open: 25000.0,
      sl: 25020.0,
      tp: 24940.0
    }]
  });
  for (const action of ["close", "modify", "cancel"]) {
    const outcome = run({
      action,
      state: action === "cancel"
        ? { ...foreign, positions: [], orders: [{ ticket: 700002, symbol: "US100.cash", magic: 20261004, type: 3, volume: 0.1, price_open: 25000.0 }] }
        : foreign
    });
    assert.equal(outcome.status, 3, `${action} refuses`);
    assert.equal(outcome.sends.length, 0, `${action} sent nothing`);
    assert.match(outcome.record?.message || "", /magic 20261004/);
  }
});

test("lane 1's own run is unchanged: no identity file, no magic flag, its own number", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "identity-gate-"));
  const statePath = path.join(dir, "state.json");
  const sendsPath = path.join(dir, "sends.log");
  fs.writeFileSync(statePath, JSON.stringify(baseState()), "utf8");
  const env = { ...process.env, FAKE_MT5_STATE: statePath, FAKE_MT5_SENDS: sendsPath, FAKE_MT5_COUNTER: path.join(dir, "calls.txt") };
  env.PYTHONPATH = FAKE_MT5 + (env.PYTHONPATH ? path.delimiter + env.PYTHONPATH : "");
  const result = spawnSync(PYTHON, [
    TOOL, "open", "--symbol", "US100.cash", "--side", "buy",
    "--journal", path.join(dir, "orders.log"), "--path", TERMINAL, "--confirm-live"
  ], { cwd: dir, encoding: "utf8", env, timeout: 60000 });
  assert.equal(result.status, 0, result.stderr);
  const sends = fs.readFileSync(sendsPath, "utf8").trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(sends.length, 1);
  assert.equal(sends[0].magic, 20261004, "the tool's own default magic is lane 1's");
});

