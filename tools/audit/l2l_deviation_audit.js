// The deviation-sequence proof: what each *deployed* L2L trader decides for the owner's own cases.
//
// The two trees under tmp/host/lane1 and tmp/host/lane2 are the bytes on the VPS (see tmp/extract-deployed.js,
// which proves each file's sha256 against the host's own reading), each laid out the way it is on the host, so
// `require` loads the deployed trader and the deployed strategy module together and nothing is re-implemented
// here. Each case is run through `trader.runOnce` with the flags the lane's scheduled task actually passes, a
// stubbed order tool, a fixed clock and a stated run of M5 closes; what is recorded is the ticket the loop would
// have asked the terminal for, or the refusal.
//
// Run: node tools/audit/l2l_deviation_audit.js [--host-root tmp/host] [--json]
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const LEVEL = 100;
const LADDER = [
  { price: 120, role: "seed", label: "seed 120" },
  { price: 110, role: "seed", label: "seed 110" },
  { price: 100, role: "derived", label: "derived 100" },
  { price: 90, role: "seed", label: "seed 90" }
];
const START_MS = Date.parse("2026-11-13T08:00:00Z");
const BAR_MS = 5 * 60 * 1000;

const LANES = [
  {
    lane: "ftmo-1",
    tree: "lane1",
    summary: "deployed c5abd0ac, trader blob f43ac5ea (uncommitted change on the host), module 52C3FBC9",
    args: ["--lane", "ftmo-1", "--max-per-day", "4"],
    stop: 98,
    target: 110
  },
  {
    lane: "ftmo-2",
    tree: "lane2",
    summary: "deployed f14f2ac7, trader 36FDD6FE, module 416DBB58, --grid half --r-multiple 3 --reentry-crossing",
    args: ["--lane", "ftmo-2", "--grid", "half", "--r-multiple", "3", "--reentry-crossing", "--magic", "20261005",
      "--max-per-day", "4"],
    stop: 98.333333,
    target: 105
  }
];

// One row per M5 bar, oldest first, each opening where the last closed, so the only thing a "close" can be is the
// number written here. `overrides` lets a case state a wick or a close on the line for one bar.
function barsOf(closes, overrides = {}) {
  return closes.map((close, index) => {
    const open = index === 0 ? close : closes[index - 1];
    const extra = overrides[index] || {};
    return {
      time_utc: new Date(START_MS + index * BAR_MS).toISOString(),
      open,
      high: extra.high ?? Math.max(open, close),
      low: extra.low ?? Math.min(open, close),
      close
    };
  });
}

function callsFixture(direction, sealedAt) {
  return {
    dashboard_meta: { last_updated_et: sealedAt },
    agents: [{
      agent: "NQ",
      sealed_at: sealedAt,
      effective_status: "ACTIVE",
      forecast_window_end: "2026-11-14T00:00:00Z",
      expires_at: "2026-11-14T00:00:00Z",
      calls: { "24h": { direction } },
      priority_call: { direction }
    }]
  };
}

function levelsFixture() {
  return {
    schema_version: "l2l-levels-v1",
    generated_at_utc: "2026-11-13T00:00:00Z",
    instrument_count: 1,
    instruments: [{ symbol: "US100.cash", dashboard_asset: "NQ", levels: LADDER }]
  };
}

function feedFixture({ bars, closes, lane }) {
  const last = closes[closes.length - 1];
  const bid = Math.round((last - 0.1) * 100) / 100;
  const ask = Math.round((last + 0.1) * 100) / 100;
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: new Date(START_MS + bars.length * BAR_MS + 20000).toISOString(),
    stale_after_seconds: 900,
    terminal: { build: 6296, connected: true, trade_allowed: true },
    account: {
      login_masked: "***000", server: "FTMO-Server", currency: "USD", balance: 10000, equity: 10000,
      positions_open: 0, orders_open: 0
    },
    orders: [],
    positions: [],
    closed_trades: [],
    instrument_count: 1,
    instruments: [{
      symbol: "US100.cash",
      dashboard_asset: "NQ",
      available: true,
      digits: 2,
      point: 0.01,
      min_lot: 0.1,
      lot_step: 0.1,
      quote: { bid, ask, spread_points: 20, market_state: "full" },
      m5: { candle_count: bars.length, bars, stale: false }
    }],
    source: { producer: "tools/mt5-bridge/live-trading-snapshot.py", scope: "read-only snapshot" }
  };
}


// One run of one deployed trader against one stated run of closes. Nothing is re-implemented: the loop reads the
// fixtures, asks its own strategy module, decides, and (because --confirm-live is on) hands the ticket to the
// stubbed order tool, whose arguments are the ticket. What is recorded is that ticket, or the refusal.
function runCase({ lane, trader, closes, direction, overrides = {}, exitAfter = null, repeats = 1 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `deviation-${lane.lane}-`));
  const bars = barsOf(closes, overrides);
  const feed = feedFixture({ bars, closes, lane });
  const nowMs = START_MS + closes.length * BAR_MS + 90 * 1000;
  const sealedAt = new Date(START_MS - 60 * 60 * 1000).toISOString();
  const magic = lane.lane === "ftmo-1" ? 20261004 : 20261005;
  const statePath = path.join(dir, "trader-state.json");

  if (exitAfter !== null) {
    const exitMs = START_MS + (exitAfter + 1) * BAR_MS;
    const placedMs = START_MS + exitAfter * BAR_MS;
    feed.closed_trades = [{
      position_id: 910201,
      symbol: "US100.cash",
      dashboard_asset: "NQ",
      side: direction === "BULLISH" ? "buy" : "sell",
      volume: 0.1,
      price_open: LEVEL,
      price_close: lane.stop,
      stop_loss: lane.stop,
      take_profit: lane.target,
      profit: -1,
      commission: 0,
      swap: 0,
      net_profit: -1,
      magic,
      comment: "l2l-rule-nq",
      deal_count: 2,
      opened: { time_utc: new Date(placedMs + 60 * 1000).toISOString() },
      closed: { time_utc: new Date(exitMs).toISOString() }
    }];
    fs.writeFileSync(statePath, JSON.stringify({
      placements: [{
        placed: true,
        symbol: "US100.cash",
        asset: "NQ",
        side: direction === "BULLISH" ? "long" : "short",
        level: LEVEL,
        entry: LEVEL,
        stop: lane.stop,
        target: lane.target,
        r_multiple: lane.lane === "ftmo-2" ? 3 : 5,
        order_ticket: 910201,
        placed_at_utc: new Date(placedMs).toISOString(),
        signal_time_utc: new Date(placedMs - BAR_MS).toISOString()
      }],
      cancellations: [],
      closes: [],
      moves: [],
      close_requests: []
    }, null, 2), "utf8");
  }

  fs.writeFileSync(path.join(dir, "layer1.json"), JSON.stringify(callsFixture(direction, sealedAt)), "utf8");
  fs.writeFileSync(path.join(dir, "l2l-levels.json"), JSON.stringify(levelsFixture()), "utf8");
  fs.writeFileSync(path.join(dir, "live-trading.json"), JSON.stringify(feed), "utf8");

  // The second lane's command line carries its own identity file, and its trader refuses to run without one, so
  // the fixture states the account the lane record states. Nothing reads the file but the gate in parseArgs.
  const extraArgs = [...lane.args, ...(lane.extraArgs || [])];
  const lanesPath = path.join(lane.treeRoot || path.join(ROOT, "tmp", "host", lane.tree), "config", "live-trading-lanes.json");
  if (lane.lane === "ftmo-2" && fs.existsSync(lanesPath)) {
    const record = (JSON.parse(fs.readFileSync(lanesPath, "utf8")).lanes || []).find(row => row.id === lane.lane);
    const login = Number(String(record?.account_login_masked || "").replace(/\*/g, "1")) || 1;
    const identityPath = path.join(dir, "lane-identity.json");
    fs.writeFileSync(identityPath, JSON.stringify({ login, server: record?.account_server || null }), "utf8");
    extraArgs.push("--expect-identity", identityPath);
  }

  const options = trader.parseArgs([
    "--once",
    "--confirm-live",
    "--close-requests", "off",
    "--published", dir,
    "--calls", path.join(dir, "layer1.json"),
    "--levels", path.join(dir, "l2l-levels.json"),
    "--feed", path.join(dir, "live-trading.json"),
    ...extraArgs
  ]);
  options.log = path.join(dir, "trader.log");
  options.lock = path.join(dir, "trader.lock");
  options.state = statePath;
  options.journal = path.join(dir, "orders.log");
  options.statusOut = path.join(dir, "trader-status.json");

  const spawns = [];
  const spawn = (command, args) => {
    const action = String(args[1] || "");
    const flags = {};
    for (let index = 0; index < args.length; index += 1) {
      const token = String(args[index]);
      if (!token.startsWith("--")) continue;
      const next = args[index + 1];
      flags[token] = index + 1 < args.length && !String(next).startsWith("--") ? next : true;
    }
    spawns.push({ action, flags });
    const record = {
      at_utc: new Date(nowMs).toISOString(),
      tool: trader.ORDER_TOOL_RELATIVE,
      action,
      account: {
        login_masked: "***000", server: "FTMO-Server", balance: 10000, equity: 10000,
        positions_open: 0, orders_open: 0
      },
      ticket_filter: null,
      positions: [],
      orders: [],
      identity: { login_masked: "***000", server: "FTMO-Server", terminal_path: "C:\\stub\\terminal64.exe" },
      answer: {
        sent: true, retcode: 10009, retcode_name: "TRADE_RETCODE_DONE", done: true,
        deal: 7000001, order: 7000002, volume: 0.1, price: null, comment: null, filling_mode: null, request_id: null
      },
      attempts: 1
    };
    if (action === "status") delete record.answer;
    return { status: 0, stdout: `${action.toUpperCase()} stub\n${JSON.stringify(record)}\n`, stderr: "" };
  };

  const runs = [];
  for (let index = 0; index < repeats; index += 1) {
    const result = trader.runOnce(options, { spawn, now: () => nowMs });
    runs.push(describe(result.record));
  }
  return { runs, spawns, dir };
}

function describe(record) {
  const placed = (record.placements || []).filter(row => row.sent === true);
  const rule = (record.rule?.rows || [])[0] || {};
  const trade = (record.trades?.rows || [])[0] || {};
  if (placed.length) {
    const row = placed[0];
    return {
      decision: "place",
      ticket: `${row.side}@${row.entry} sl ${row.stop} tp ${row.target}`,
      level: Number(row.entry),
      side: row.side,
      reentry: row.reentry === true,
      status: record.status,
      reason: row.reentry === true ? (trade.reason || null) : (rule.reason || null),
      trade: { ended: trade.ended ?? null, ended_by: trade.ended_by ?? null, ticket_stage: trade.ticket_stage ?? null },
      rule_stage: rule.stage ?? null
    };
  }
  return {
    decision: "none",
    ticket: null,
    level: null,
    side: null,
    reentry: false,
    status: record.status,
    reason: rule.reason || record.reason || null,
    trade: { ended: trade.ended ?? null, ended_by: trade.ended_by ?? null, ticket_stage: trade.ticket_stage ?? null },
    rule_stage: rule.stage ?? null
  };
}


// The owner's cases, in his own numbers: level 100, closes stated in order, "must" or "must not".
const CASES = [
  {
    id: "bull reclaim: 102, 99, 98, 101",
    direction: "BULLISH",
    closes: [102, 99, 98, 101],
    exitAfter: 1,
    expect: { fresh: "long@100", afterExit: "long@100" },
    note: "above, two closes below, close back above: one buy limit at 100"
  },
  {
    id: "bull reclaim, the excursion bar then a close on the line: 102, 99, 100, 101",
    direction: "BULLISH",
    closes: [102, 99, 100, 101],
    exitAfter: 1,
    expect: { fresh: "long@100", afterExit: "long@100" },
    note: "held above, one close below, a close on the line, then back above: the excursion is still one close"
  },
  {
    id: "bull touch with no excursion: 102, 100, 101",
    direction: "BULLISH",
    closes: [102, 100, 101],
    exitAfter: 0,
    expect: { fresh: "none", afterExit: "none" },
    note: "a close exactly on 100 leaves nothing behind, so the next close above reclaims nothing"
  },
  {
    id: "bull reclaim, several closes beyond first: 102, 103, 99, 98, 101",
    direction: "BULLISH",
    closes: [102, 103, 99, 98, 101],
    exitAfter: 2,
    expect: { fresh: "long@100", afterExit: "long@100" },
    note: "two closes above before the deviation are still the one reclaim"
  },
  {
    id: "bull, first approach from below: 99, 98, 101",
    direction: "BULLISH",
    closes: [99, 98, 101],
    exitAfter: 0,
    expect: { fresh: "none", afterExit: "none" },
    note: "no earlier close above 100 in the session, so nothing was reclaimed"
  },
  {
    id: "bear reclaim: 98, 101, 102, 99",
    direction: "BEARISH",
    closes: [98, 101, 102, 99],
    exitAfter: 1,
    expect: { fresh: "short@100", afterExit: "short@100" },
    note: "the mirror: below, two closes above, close back below"
  },
  {
    id: "bear, first approach from above: 101, 102, 99",
    direction: "BEARISH",
    closes: [101, 102, 99],
    exitAfter: 0,
    expect: { fresh: "none", afterExit: "none" },
    note: "the mirror: no earlier close below 100"
  },
  {
    id: "wick only: 102, 99, 98, high 101.5 closing 99.4",
    direction: "BULLISH",
    closes: [102, 99, 98, 99.4],
    overrides: { 3: { high: 101.5 } },
    exitAfter: 1,
    expect: { fresh: "none", afterExit: "none" },
    note: "a wick through 100 with the close on the near side is not a close beyond"
  },
  {
    id: "close on the line: 102, 99, 98, 100",
    direction: "BULLISH",
    closes: [102, 99, 98, 100],
    exitAfter: 1,
    expect: { fresh: "none", afterExit: "none" },
    note: "a close at 100 is not a close beyond 100"
  },
  {
    id: "return across a different level: 102, 99, 98, 111",
    direction: "BULLISH",
    closes: [102, 99, 98, 111],
    exitAfter: 1,
    expect: { fresh: "not@100", afterExit: "not@100" },
    note: "the newest close crossed 110 and not 100, so no ticket may sit at 100"
  },
  {
    id: "replay of the confirming candle: 102, 99, 98, 101, then the same bar again",
    direction: "BULLISH",
    closes: [102, 99, 98, 101],
    exitAfter: null,
    repeats: 2,
    expect: { fresh: "long@100", afterExit: "none" },
    note: "the second run on the same confirming bar must place nothing"
  }
];

function verdictOf(expected, actual) {
  if (expected === "none") return actual.decision === "none" ? "ok" : "MISS";
  if (expected === "not@100") return actual.decision === "none" || actual.level !== 100 ? "ok" : "MISS";
  const [side, level] = expected.split("@");
  return actual.decision === "place" && actual.side === side && actual.level === Number(level) ? "ok" : "MISS";
}

function actualWords(actual) {
  if (actual.decision === "none") return "no order";
  return `${actual.side}@${actual.level}`;
}

function main() {
  const argv = process.argv.slice(2);
  // Two trees can answer the same cases: the bytes on the host (default), and this checkout's own scripts and
  // lib with the lane asking for the reclaim rule. The second one is the review branch, which is why the flag is
  // added here rather than in the lane's recorded command line.
  const useRepo = argv.includes("--repo");
  const rows = [];
  for (const lane of LANES) {
    lane.treeRoot = useRepo ? ROOT : path.join(ROOT, "tmp", "host", lane.tree);
    // The review branch asks both lanes for the reclaim rule, and lane 1 for the crossing gate it has never had:
    // the two are the whole of the execution change this branch carries, and neither is named by the host today.
    lane.extraArgs = useRepo
      ? lane.lane === "ftmo-1"
        ? ["--reentry-crossing", "--require-deviation"]
        : ["--require-deviation"]
      : [];
    const trader = require(path.join(lane.treeRoot, "scripts", "run-live-trading-trader.js"));
    for (const testCase of CASES) {
      const fresh = runCase({ lane, trader, ...testCase, exitAfter: null });
      const freshDecision = fresh.runs[0];
      const second = testCase.exitAfter === null
        ? fresh.runs[1] || null
        : runCase({ lane, trader, ...testCase }).runs[0];
      rows.push({
        lane: lane.lane,
        case: testCase.id,
        mode: "fresh entry",
        expected: testCase.expect.fresh,
        actual: actualWords(freshDecision),
        verdict: verdictOf(testCase.expect.fresh, freshDecision),
        detail: freshDecision.reason,
        stage: freshDecision.rule_stage
      });
      rows.push({
        lane: lane.lane,
        case: testCase.id,
        mode: testCase.exitAfter === null ? "replay of the same bar" : "post-exit re-entry",
        expected: testCase.expect.afterExit,
        actual: second ? actualWords(second) : "not run",
        verdict: second ? verdictOf(testCase.expect.afterExit, second) : "MISS",
        detail: second ? second.reason : null,
        stage: second ? second.rule_stage : null
      });
    }
  }

  for (const row of rows) {
    console.log(`${row.verdict === "ok" ? "ok  " : "MISS"} ${row.lane} ${row.mode.padEnd(22)} ${row.case}`);
    console.log(`       expected ${row.expected.padEnd(9)} actual ${row.actual}${row.stage ? `  (stage ${row.stage})` : ""}`);
  }
  console.log("");
  for (const lane of LANES) {
    const mine = rows.filter(row => row.lane === lane.lane);
    const misses = mine.filter(row => row.verdict === "MISS").length;
    console.log(`${lane.lane}: ${mine.length - misses}/${mine.length} as the owner states it, ${misses} deviation(s)`);
  }
  fs.writeFileSync(
    path.join(ROOT, "tmp", useRepo ? "deviation-audit-after.json" : "deviation-audit.json"),
    JSON.stringify(rows, null, 2)
  );
}

if (require.main === module) main();

module.exports = { runCase, CASES, LANES, LEVEL, barsOf };
