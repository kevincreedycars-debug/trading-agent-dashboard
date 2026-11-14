// The second account is one flag away from the first, so the flags are the thing to test.
//
// Four ways to select lane 2 wrongly - `--lane ftmo-2` with no magic at all, with lane 1's magic, with no identity
// file, and with lane 1's rule - and one way to select lane 1 with the second account's magic. Every one of them
// has to stop the run before the terminal is read, which is stronger than "before an order is sent": the fake
// bridge counts every call it is given, so a run that refused at the command line leaves no count file at all, and
// a run that placed, cancelled, closed or moved anything leaves a send beside it.
//
// The fixture is the one that makes the difference visible rather than theoretical: it states a working limit whose
// call has ended (a cancel), a position whose call has turned (a close) and a position at twice its risk (a stop
// move). The first run in this file is that fixture driven by lane 1's own command line, so the three decisions are
// shown to be reachable and not a story the refusals tell about themselves.
//
// The last group is the generated task wrapper: scripts/register-live-trading-trader-task.ps1 -Show carries the
// command line it would write, so what the scheduler would run is read here rather than assumed.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const runnerPath = path.join(repoRoot, "scripts", "run-live-trading-trader.js");
const registerScript = path.join(repoRoot, "scripts", "register-live-trading-trader-task.ps1");
const fakeMt5 = path.join(__dirname, "fixtures", "fake-mt5");
const PYTHON = process.env.LIVE_TRADING_PYTHON || "python";
const windowsOnly = { skip: process.platform !== "win32" };

// Lane 1's number, the second account's own, and the instant the fixture is read at. The bars are placed relative to
// the machine's own clock rather than frozen at a date: a snapshot older than its own 900-second window is refused
// before any review is reached, so a frozen date would make this file a test of a stale fixture rather than of the
// flags. `BAR_BASE` is the newest five-minute boundary, so the newest bar in the fixture has finished.
const LANE1_MAGIC = 20261004;
const LANE2_MAGIC = 20261005;
const BAR_BASE = Math.floor(Date.now() / 300000) * 300000;
const NOW = BAR_BASE - 300000;
const TERMINAL_1 = "C:\\Program Files\\FTMO Global Markets MT5 Terminal";
const TERMINAL_2 = "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2";

// One M5 bar, named by how many minutes before the newest boundary it opened.
function bar(minutesBefore, open, high, low, close) {
  return { time_utc: new Date(BAR_BASE - minutesBefore * 60000).toISOString(), open, high, low, close };
}

function stamp(minutesOffset) {
  return new Date(BAR_BASE + minutesOffset * 60000).toISOString();
}

// The three pairs the fixture needs, each with the one reading that decides its ticket. Only the columns the loop
// reads are stated: the symbol's own digits and point, the closest three marked lines, and four M5 bars.
function instruments() {
  return [
    {
      symbol: "US100.cash",
      asset: "NQ",
      digits: 2,
      point: 0.01,
      levels: [110, 100, 90],
      bid: 99.4,
      ask: 99.6,
      bars: [
        bar(20, 99.8, 99.9, 99.3, 99.4),
        bar(15, 99.4, 99.7, 99.1, 99.2),
        bar(10, 99.2, 99.6, 99.0, 99.3),
        bar(5, 99.3, 99.7, 99.1, 99.4)
      ]
    },
    {
      symbol: "EURUSD",
      asset: "EUR",
      digits: 5,
      point: 0.00001,
      levels: [1.12, 1.1, 1.08],
      bid: 1.0949,
      ask: 1.0951,
      bars: [
        bar(20, 1.0972, 1.0976, 1.0968, 1.097),
        bar(15, 1.097, 1.0971, 1.0952, 1.0956),
        bar(10, 1.0956, 1.0959, 1.0946, 1.0952),
        bar(5, 1.0952, 1.0956, 1.0947, 1.095)
      ]
    },
    {
      symbol: "GBPUSD",
      asset: "GBP",
      digits: 5,
      point: 0.00001,
      levels: [1.28, 1.26, 1.24],
      bid: 1.2679,
      ask: 1.2681,
      bars: [
        bar(20, 1.2505, 1.2535, 1.2501, 1.2531),
        bar(15, 1.2531, 1.2572, 1.2529, 1.2568),
        bar(10, 1.2568, 1.2621, 1.2564, 1.2615),
        bar(5, 1.2615, 1.2684, 1.2611, 1.268)
      ]
    }
  ];
}

// NQ states no direction: a call that has ended is what takes a working limit back out. EUR has turned bearish
// against a long position, which is the one reading that exits one. GBP is still bullish, so its position stays and
// its own stop is what this run has to say something about.
function callsFixture() {
  const agent = (name, direction) => ({
    agent: name,
    sealed_at: stamp(-480),
    effective_status: "ACTIVE",
    forecast_window_end: stamp(1440),
    expires_at: stamp(1440),
    calls: { "24h": { direction } },
    priority_call: { direction }
  });
  return {
    dashboard_meta: { last_updated_et: stamp(-60) },
    agents: [agent("EUR", "BEARISH"), agent("GBP", "BULLISH")]
  };
}

function levelsFixture() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: stamp(-180),
    instrument_count: 3,
    instruments: instruments().map(entry => ({
      symbol: entry.symbol,
      dashboard_asset: entry.asset,
      levels: entry.levels.map(price => ({ price, role: "seed", label: `seed ${price}` }))
    }))
  };
}

function feedFixture() {
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(Date.now() - 30000).toISOString(),
    stale_after_seconds: 900,
    terminal: { build: 6296, connected: true, trade_allowed: true },
    account: { login_masked: "***614", server: "FTMO-Server", currency: "USD", balance: 10000, equity: 10000 },
    orders: [],
    positions: [],
    closed_trades: [],
    instrument_count: 3,
    instruments: instruments().map(entry => ({
      symbol: entry.symbol,
      dashboard_asset: entry.asset,
      available: true,
      digits: entry.digits,
      point: entry.point,
      min_lot: 0.01,
      lot_step: 0.01,
      contract_size: 1,
      stops_level: 0,
      quote: { bid: entry.bid, ask: entry.ask, spread_points: 2, time_utc: new Date(Date.now() - 30000).toISOString(), market_state: "open" },
      m5: { candle_count: entry.bars.length, bars: entry.bars, stale: false }
    })),
    source: { producer: "tools/mt5-bridge/live-trading-snapshot.py", scope: "read-only snapshot" }
  };
}

// The terminal as the fake bridge reports it: three tickets, all carrying whichever ownership number is passed. The
// default is lane 1's, which is the fixture that makes a lane-2 run carrying lane 1's number dangerous rather than
// merely wrong - every filter in the loop would find these rows and act on them.
function fakeState({ magic = LANE1_MAGIC, terminal = TERMINAL_1 } = {}) {
  return {
    login: 1234567,
    server: "FTMO-Server",
    connected: true,
    terminal_path: terminal,
    terminal_name: path.basename(terminal),
    symbols: Object.fromEntries(instruments().map(entry => [entry.symbol, {
      name: entry.symbol,
      digits: entry.digits,
      point: entry.point,
      volume_min: 0.01,
      volume_step: 0.01,
      trade_stops_level: 10,
      filling_mode: 2,
      trade_mode: 4
    }])),
    ticks: Object.fromEntries(instruments().map(entry => [entry.symbol, { bid: entry.bid, ask: entry.ask }])),
    positions: [
      { ticket: 500002, symbol: "EURUSD", magic, type: 0, volume: 0.01, price_open: 1.09, price_current: 1.095, sl: 1.085, tp: 1.1, profit: 5, comment: "l2l-rule-eur", time: 1793600000 },
      { ticket: 500003, symbol: "GBPUSD", magic, type: 0, volume: 0.01, price_open: 1.25, price_current: 1.268, sl: 1.245, tp: 1.28, profit: 18, comment: "l2l-rule-gbp", time: 1793600000 }
    ],
    orders: [
      { ticket: 500001, symbol: "US100.cash", magic, type: 2, volume: 0.01, price_open: 100, price_current: 99.4, sl: 95, tp: 110, comment: "l2l-rule-nq", time: 1793600000 }
    ]
  };
}

// The state the loop starts from: one placement, because a stop move is judged on the risk the trade was placed
// with and that number lives in this file rather than in the terminal. Nothing else has happened yet today.
function stateDocument() {
  return {
    placements: [{
      symbol: "GBPUSD",
      asset: "GBP",
      side: "long",
      order_ticket: 500003,
      entry: 1.25,
      stop: 1.245,
      target: 1.28,
      risk: 0.005,
      r_multiple: 5,
      signal_time_utc: stamp(-25),
      placed_at_utc: stamp(-20),
      placed: true,
      sent: true
    }],
    cancellations: [],
    closes: [],
    moves: []
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

// One run of the real runner, against the fake bridge, with every file it may touch under one temp folder. The
// counter the fake bridge keeps is what makes "the terminal was never read" a fact rather than a reading of the log.
function runTrader({ args = [], state = fakeState() } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane-isolation-"));
  const paths = {
    calls: writeJson(path.join(dir, "layer1.json"), callsFixture()),
    levels: writeJson(path.join(dir, "l2l-levels.json"), levelsFixture()),
    feed: writeJson(path.join(dir, "live-trading.json"), feedFixture()),
    mt5: writeJson(path.join(dir, "mt5-state.json"), state),
    trader: writeJson(path.join(dir, "trader-state.json"), stateDocument()),
    sends: path.join(dir, "sends.log"),
    counter: path.join(dir, "calls.txt"),
    journal: path.join(dir, "orders.log"),
    state: path.join(dir, "trader-state.json"),
    log: path.join(dir, "trader.log"),
    lock: path.join(dir, "trader.lock"),
    status: path.join(dir, "trader-status.json")
  };
  const env = {
    ...process.env,
    FAKE_MT5_STATE: paths.mt5,
    FAKE_MT5_SENDS: paths.sends,
    FAKE_MT5_COUNTER: paths.counter
  };
  env.PYTHONPATH = fakeMt5 + (env.PYTHONPATH ? path.delimiter + env.PYTHONPATH : "");
  const result = spawnSync(process.execPath, [
    runnerPath,
    "--once",
    "--quiet",
    "--python", PYTHON,
    "--published", repoRoot,
    "--calls", paths.calls,
    "--levels", paths.levels,
    "--feed", paths.feed,
    "--close-requests", "off",
    "--state", paths.state,
    "--log", paths.log,
    "--lock", paths.lock,
    "--journal", paths.journal,
    "--status-out", paths.status,
    ...args
  ], { cwd: dir, encoding: "utf8", env, timeout: 120000 });
  const sends = () => (fs.existsSync(paths.sends)
    ? fs.readFileSync(paths.sends, "utf8").trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    : []);
  const record = () => {
    if (!fs.existsSync(paths.log)) return null;
    const lines = fs.readFileSync(paths.log, "utf8").trim().split(/\r?\n/).filter(Boolean);
    return lines.length ? JSON.parse(lines[lines.length - 1]) : null;
  };
  const counter = () => (fs.existsSync(paths.counter) ? fs.readFileSync(paths.counter, "utf8").trim() : null);
  const journal = () => (fs.existsSync(paths.journal) ? fs.readFileSync(paths.journal, "utf8") : null);
  return { result, paths, sends, record, counter, journal };
}

// The three decisions the fixture states, read out of one run's own log line rather than out of a comment.
function decisionsOf(run) {
  const record = run.record() || {};
  return {
    record,
    cancels: (record?.pendings?.cancellations || []).map(row => ({ ticket: row.ticket, planned: row.planned === true, sent: row.sent === true })),
    closes: (record?.positions?.closes || []).map(row => ({ ticket: row.ticket, planned: row.planned === true, sent: row.sent === true })),
    moves: (record?.stops?.moves || []).map(row => ({ ticket: row.ticket, new_stop: row.new_stop, planned: row.planned === true, sent: row.sent === true }))
  };
}


test("lane 1's own command line on this fixture reaches a cancel, a close and a stop move", () => {
  const run = runTrader({ args: ["--lane", "ftmo-1"] });
  assert.equal(run.result.status, 0, `${run.result.stderr || run.result.stdout} ${JSON.stringify(run.record())}`);
  const decisions = decisionsOf(run);
  assert.deepEqual(decisions.cancels, [{ ticket: 500001, planned: true, sent: false }], "the working limit whose call ended is taken back out");
  assert.deepEqual(decisions.closes, [{ ticket: 500002, planned: true, sent: false }], "the position whose call turned is exited");
  assert.equal(decisions.moves.length, 1, "the position at twice its risk has its stop moved");
  assert.equal(decisions.moves[0].ticket, 500003);
  assert.equal(decisions.moves[0].new_stop, 1.25);
  assert.equal(decisions.moves[0].planned, true);
  assert.equal(run.sends().length, 0, "an unarmed run states them and sends nothing");
  assert.ok(Number(run.counter()) > 0, "the terminal was read, so the fixture is a live read rather than a refusal");
  assert.equal(run.record()?.lane, "ftmo-1");
});

// The five command lines. Each one is checked against the lane's own row in config/live-trading-lanes.json before the
// lock is taken, so what is asserted is not "it complained" but "it stopped before anything could be read or sent":
// no send, no count of a tool call, no journal, no state, no log line.
function assertRefusedBeforeAnySend(args, expected) {
  const run = runTrader({ args });
  assert.equal(run.result.status, 2, `a bad command line exits 2, not ${run.result.status}: ${run.result.stderr}`);
  assert.match(run.result.stderr, expected, "the refusal names the flag and the lane's own number");
  assert.deepEqual(run.sends(), [], "nothing reached the bridge");
  assert.equal(run.counter(), null, "the terminal was never even read");
  assert.equal(run.journal(), null, "no journal line was written");
  assert.equal(fs.existsSync(run.paths.state), true, "the state file is the one the test wrote, and no run touched it");
  assert.equal(fs.existsSync(run.paths.log), false, "no run record was written: the run never started");
  assert.equal(fs.readFileSync(run.paths.state, "utf8"), `${JSON.stringify(stateDocument(), null, 2)}\n`, "the state is exactly as the test wrote it");
  return run;
}

test("ftmo-2 selected with no magic refuses: lane 1's number is not the lane's own", () => {
  assertRefusedBeforeAnySend(["--lane", "ftmo-2"], /--lane ftmo-2 carries magic 20261005/);
});

test("ftmo-2 selected with lane 1's magic refuses rather than trading lane 1's number on account 2", () => {
  assertRefusedBeforeAnySend(["--lane", "ftmo-2", "--magic", String(LANE1_MAGIC)], /carries magic 20261005 .* carrying 20261004/);
});

test("ftmo-2 selected without the identity file refuses before the terminal is read", () => {
  assertRefusedBeforeAnySend(["--lane", "ftmo-2", "--magic", String(LANE2_MAGIC)], /declares an identity file .* --expect-identity/);
});

test("ftmo-2 selected with lane 1's rule refuses: the grid and the multiple are the lane's, not the defaults", () => {
  assertRefusedBeforeAnySend(
    ["--lane", "ftmo-2", "--magic", String(LANE2_MAGIC), "--expect-identity", path.join(repoRoot, "package.json")],
    /trades the half grid/
  );
  assertRefusedBeforeAnySend(
    ["--lane", "ftmo-2", "--magic", String(LANE2_MAGIC), "--expect-identity", path.join(repoRoot, "package.json"), "--grid", "half"],
    /trades 3 to one/
  );
});

test("ftmo-1 selected with the second account's magic refuses, so a lane cannot borrow another's tickets", () => {
  assertRefusedBeforeAnySend(
    ["--lane", "ftmo-1", "--magic", String(LANE2_MAGIC), "--expect-identity", path.join(repoRoot, "package.json")],
    /--lane ftmo-1 carries magic 20261004/
  );
});

test("a lane the lanes file does not carry is refused instead of guessed", () => {
  assertRefusedBeforeAnySend(["--lane", "ftmo-4"], /is not one of the lanes config\/live-trading-lanes\.json carries/);
});


// The other half of the same fixture: armed, those three decisions are three sends. The refusal above is worth
// stating against this run and not against a blank account - the point of the fixture is that a lane-2 command line
// carrying lane 1's number would have found these rows and acted on this account's terminal.
test("armed, the same three readings are the three sends a misconfigured lane-2 run must never make", () => {
  const run = runTrader({ args: ["--lane", "ftmo-1", "--confirm-live"] });
  assert.equal(run.result.status, 0, run.result.stderr || run.result.stdout);
  const actions = run.sends().map(row => Number(row.action));
  assert.ok(actions.includes(8), "the working limit whose call ended is removed (TRADE_ACTION_REMOVE)");
  assert.ok(actions.includes(1), "the position whose call turned is closed at the market (TRADE_ACTION_DEAL)");
  assert.ok(actions.includes(6), "the stop at twice the risk is moved (TRADE_ACTION_SLTP)");
  assert.ok(String(run.journal() || "").includes("\"action\""), "the acts are journalled");
});

// A correctly flagged lane-2 run attached to lane 1's terminal: the flags are right, the terminal is not, and the
// identity gate is what stops it - through the runner, with nothing sent.
test("a correctly flagged lane-2 run refuses when the terminal it is attached to is lane 1's", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane-isolation-identity-"));
  const identity = writeJson(path.join(dir, "identity.json"), {
    login: 2222222,
    server: "FTMO-Server",
    terminal_path: TERMINAL_2
  });
  const run = runTrader({
    args: [
      "--lane", "ftmo-2",
      "--grid", "half",
      "--r-multiple", "3",
      "--magic", String(LANE2_MAGIC),
      "--expect-identity", identity,
      "--confirm-live"
    ]
  });
  assert.equal(run.result.status, 1, `the run fails loudly rather than trading an account it cannot name: ${run.result.stderr || run.result.stdout} ${JSON.stringify(run.record())}`);
  assert.deepEqual(run.sends(), [], "the identity gate fired before the order reached the bridge");
  const journal = String(run.journal() || "");
  assert.equal(journal.includes("\"answer\""), false, "no order was answered, so none was sent");
  assert.match(journal, /identity_mismatch/, "the journal carries the refusal, which is the evidence a reader keeps");
  const record = run.record();
  assert.equal(record?.status, "refused");
  assert.match(record?.reason || "", /identity/i);
});


// ---- The generated task wrapper ---------------------------------------------------------------------------------
// `-Show` is read-only: it writes no wrapper and registers no task. What it now also carries is the command line the
// registration would write, which is the thing a scheduler actually stores - so a missing flag is read here rather
// than discovered on the host at the first tick.
function showRegistration(args) {
  const result = spawnSync("powershell", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", registerScript, "-Show", ...args
  ], { encoding: "utf8", timeout: 120000 });
  // PowerShell wraps an uncaught throw at the console width, so a message read here is first put back on one line:
  // the words are the assertion, not the column the console happened to break them at.
  const flatten = value => String(value || "").replace(/\s+/g, " ").trim();
  return { status: result.status, stdout: result.stdout || "", stderr: flatten(result.stderr) };
}

function identityFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lane-identity-"));
  return writeJson(path.join(dir, "lane-ftmo2-identity.json"), {
    login: 2222222,
    server: "FTMO-Server",
    terminal_path: TERMINAL_2
  });
}

function loopCommand(registration) {
  const line = (registration.stdout || "").split(/\r?\n/).find(row => row.startsWith("loop_command"));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

test("the wrapper for ftmo-2 is refused unless it says the lane's own number, identity and rule", windowsOnly, () => {
  const wrapperPath = path.join(repoRoot, "tmp", "live-trading-trader-run.cmd");
  const before = fs.existsSync(wrapperPath) ? fs.readFileSync(wrapperPath, "utf8") : null;
  const id = identityFile();
  const cases = [
    { args: ["-Lane", "ftmo-2"], expected: /carries magic 20261005/ },
    { args: ["-Lane", "ftmo-2", "-Magic", String(LANE1_MAGIC)], expected: /carries magic 20261005/ },
    { args: ["-Lane", "ftmo-2", "-Magic", String(LANE2_MAGIC)], expected: /declares an identity file/ },
    { args: ["-Lane", "ftmo-2", "-Magic", String(LANE2_MAGIC), "-ExpectIdentity", id], expected: /trades the half grid/ },
    { args: ["-Lane", "ftmo-2", "-Magic", String(LANE2_MAGIC), "-ExpectIdentity", id, "-Grid", "half"], expected: /trades 3 to one/ },
    { args: ["-Lane", "ftmo-1", "-Magic", String(LANE2_MAGIC), "-ExpectIdentity", id], expected: /Lane ftmo-1 carries magic 20261004/ }
  ];
  for (const entry of cases) {
    const registration = showRegistration(entry.args);
    assert.notEqual(registration.status, 0, `refused: ${entry.args.join(" ")}`);
    assert.match(registration.stderr, entry.expected, `the refusal names the flag: ${entry.args.join(" ")}`);
    assert.equal(loopCommand(registration), "", "a refused registration writes no command line");
  }
  const after = fs.existsSync(wrapperPath) ? fs.readFileSync(wrapperPath, "utf8") : null;
  assert.equal(after, before, "none of those registrations wrote the wrapper");
});

test("the generated lane-2 command line carries the lane's own magic, identity, grid and multiple", windowsOnly, () => {
  const id = identityFile();
  const registration = showRegistration([
    "-Lane", "ftmo-2", "-Magic", String(LANE2_MAGIC), "-Grid", "half", "-RMultiple", "3", "-ExpectIdentity", id
  ]);
  assert.equal(registration.status, 0, registration.stderr);
  const command = loopCommand(registration);
  assert.match(command, /--lane "ftmo-2"/);
  assert.match(command, new RegExp(`--magic ${LANE2_MAGIC}`));
  assert.match(command, /--grid half/);
  assert.match(command, /--r-multiple 3/);
  assert.ok(command.includes(`--expect-identity "${id}"`), "the identity file the tool checks before every send");
  assert.equal(command.includes("--confirm-live"), false, "an unarmed registration carries no arming flag");
});

test("lane 1's generated command line carries no magic, grid, multiple or identity, and states the owner's no-cap answer", windowsOnly, () => {
  // The lane is named here even though lane 1 is the default. A checkout whose own folder is named after a lane's
  // root - the deploy layout's `C:\ftmo3`, where `../ftmo3` and `.` are the same directory - makes "one lane by
  // construction" ambiguous, and the registration refuses rather than guessing. Naming the lane is what every
  // runbook does and what the deploy host needs.
  const registration = showRegistration(["-Lane", "ftmo-1"]);
  assert.equal(registration.status, 0, registration.stderr);
  const command = loopCommand(registration);
  assert.match(command, /--lane "ftmo-1"/);
  assert.equal(command.includes("--magic"), false);
  assert.equal(command.includes("--grid"), false);
  assert.equal(command.includes("--r-multiple"), false);
  assert.equal(command.includes("--expect-identity"), false);
  // The one flag that did change, and the owner's own decision: the daily limit is gone, and the registration says
  // so in a word rather than by leaving the old four in place or by writing no flag at all.
  assert.match(command, /--max-per-day unlimited/);
  assert.equal(command.includes("--blind"), false);
});

test("the blind lane's generated command line carries its own number, identity and rule, and is refused without the rule", windowsOnly, () => {
  const id = identityFile();
  const refused = showRegistration(["-Lane", "ftmo-3", "-Magic", String(LANE2_MAGIC), "-ExpectIdentity", id]);
  assert.notEqual(refused.status, 0, "lane 3's magic is its own");
  assert.match(refused.stderr, /carries magic 20261006/);

  const registration = showRegistration([
    "-Lane", "ftmo-3", "-Magic", "20261006", "-ExpectIdentity", id, "-Blind"
  ]);
  assert.equal(registration.status, 0, registration.stderr);
  const command = loopCommand(registration);
  assert.match(command, /--lane "ftmo-3"/);
  assert.match(command, /--magic 20261006/);
  assert.match(command, /--blind/);
  assert.ok(command.includes(`--expect-identity "${id}"`));
  assert.match(command, /--max-per-day unlimited/);
  assert.equal(command.includes("--reentry-crossing"), false, "the blind lane re-arms through its own deviation rule");
  assert.equal(command.includes("--confirm-live"), false, "an unarmed registration carries no arming flag");
});

