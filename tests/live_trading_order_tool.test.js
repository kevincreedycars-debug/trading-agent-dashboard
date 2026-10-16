// Contract tests for the live-trading order tool, and for the boundary that keeps it the only file that can
// place a trade.
//
// The lane gained one deliberate order path on 2026-10-04, so that a trade could be opened, closed and read
// back through the dashboard rather than taken on trust. That changes the read-only boundary the other live
// trading suites assert, so the boundary is restated here in the terms that now hold: exactly one file in
// this lane names an order call and it is this tool, the producer and the runner beside it name none, the
// tool sends nothing without --confirm-live, and its default size is the smallest the instrument accepts.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const orderToolPath = path.join(root, "tools", "mt5-bridge", "live-trading-order.py");
const producerPath = path.join(root, "tools", "mt5-bridge", "live-trading-snapshot.py");
const runnerPath = path.join(root, "scripts", "run-live-trading-feed.js");
const orderToolSource = fs.readFileSync(orderToolPath, "utf8");

// Every call that could place, change or close a trade. `order_send` alone is not the whole family: a
// reversal written with `positions_close` is an order path too.
const ORDER_CALL = /\b(order_send|order_check|order_calc|positions_modify|positions_close|order_close|order_cancel)\s*\(/;

// The files a browser can reach, plus the producer, the runner and the trader loop that feed it. Each one
// must stay clean: the trader loop calls the tool, and calling is not sending.
const READ_ONLY_FILES = [
  "script.js",
  "index.html",
  "scripts/run-live-trading-feed.js",
  "scripts/run-live-trading-trader.js",
  "scripts/publish-live-trading-feed.js",
  "scripts/validate_live_trading_feed.js",
  "scripts/register-live-trading-feed-task.ps1",
  "scripts/register-live-trading-trader-task.ps1",
  "tools/mt5-bridge/live-trading-snapshot.py"
];

const PYTHON = process.env.LIVE_TRADING_PYTHON || "python";
// The guard paths are the whole point of the tool's shape, so they are exercised for real where a Python is
// available and skipped with a reason where there is none. Neither path attaches to a terminal or imports
// the broker package, so this runs anywhere.
const PYTHON_AVAILABLE = (() => {
  const probe = spawnSync(PYTHON, ["--version"], { encoding: "utf8" });
  return !probe.error && probe.status === 0;
})();
const SKIP_WITHOUT_PYTHON = PYTHON_AVAILABLE ? false : `${PYTHON} is not on PATH`;

function runTool(args) {
  return spawnSync(PYTHON, [orderToolPath, ...args], { cwd: root, encoding: "utf8" });
}

function tempJournal() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-order-")), "orders.log");
}

test("exactly one file in this lane names an order call, and it is this tool", () => {
  const candidates = [
    ...READ_ONLY_FILES.map((relative) => path.join(root, ...relative.split("/"))),
    orderToolPath
  ];
  const senders = candidates.filter((file) => ORDER_CALL.test(fs.readFileSync(file, "utf8")));
  assert.deepEqual(
    senders.map((file) => path.relative(root, file).replace(/\\/g, "/")),
    ["tools/mt5-bridge/live-trading-order.py"],
    "the order path must exist in exactly one file: a second one is a second thing that can send"
  );

  // A directory-level sweep as well, so a new file beside these cannot quietly become a sender.
  const laneFiles = [
    ...fs.readdirSync(path.join(root, "scripts")).filter((name) => /\.(js|ps1)$/.test(name)).map((name) => path.join(root, "scripts", name)),
    ...fs.readdirSync(path.join(root, "tools", "mt5-bridge")).filter((name) => name.endsWith(".py")).map((name) => path.join(root, "tools", "mt5-bridge", name))
  ];
  const laneSenders = laneFiles
    .filter((file) => ORDER_CALL.test(fs.readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file).replace(/\\/g, "/"));
  assert.deepEqual(laneSenders, ["tools/mt5-bridge/live-trading-order.py"]);
});

test("the producer and the runner still name no order call", () => {
  assert.equal(ORDER_CALL.test(fs.readFileSync(producerPath, "utf8")), false, "the producer must stay read-only");
  assert.equal(ORDER_CALL.test(fs.readFileSync(runnerPath, "utf8")), false, "the runner must stay read-only");
});

test("the tool refuses before it can reach a broker, and says what it would have sent", () => {
  const source = orderToolSource;
  // The confirm flag is the gate every send sits behind, and the guards run before the package is imported.
  assert.match(source, /--confirm-live/);
  assert.match(source, /if args\.action in \("open", "close", "modify", "cancel"\) and not args\.confirm_live:/);
  assert.match(source, /def guard_before_broker\(args\):/);
  const guardIndex = source.indexOf("reason, code = guard_before_broker(args)");
  const attachIndex = source.indexOf("mt5 = attach(args.path)");
  assert.ok(guardIndex > 0 && attachIndex > guardIndex, "the guards must come before the terminal is attached");
  // And the package itself is imported inside attach, so a refusal needs no MT5 install at all.
  assert.match(source, /def attach\(path\):[\s\S]*?import MetaTrader5 as mt5/);
  assert.equal(/^import MetaTrader5/m.test(source), false, "the broker package must not be imported at the top of the file");
});

test("the tool's default size is the smallest the instrument accepts, and a larger one takes two arguments", () => {
  const source = orderToolSource;
  // No --lots means the symbol's own minimum: the default trade is the smallest that exists.
  assert.match(source, /def resolve_volume\(requested, info, max_lots, position_volume=None\):/);
  assert.match(source, /base = float\(position_volume\) if position_volume else minimum/);
  assert.match(source, /cap = float\(max_lots\) if max_lots else max\(minimum, base\)/);
  assert.match(source, /volume = round_to_step\(base if requested is None else requested, step\)/);
  assert.match(source, /is above the cap this run allows/);
  // The symbols are an allowlist, not a suggestion.
  assert.match(source, /ALLOWED_SYMBOLS = \("EURUSD", "XAUUSD", "US100\.cash", "BTCUSD"\)/);
  assert.match(source, /is not one of the four instruments this lane trades/);
  // Every trade it places is marked, and every invocation is journalled outside the tracked files.
  assert.match(source, /^MAGIC = \d+$/m);
  assert.match(source, /DEFAULT_JOURNAL = "tmp\/live-trading-orders\.log"/);
  assert.match(source, /def append_journal\(path, record\):/);
  // It reads no bars and publishes nothing: it is a sender, not a second read path, and it does no git work.
  assert.equal(/history_deals_get/.test(source), false);
  assert.equal(/copy_rates_from_pos/.test(source), false);
  assert.equal(/git |push|commit/i.test(source), false, "the tool must not touch git");
});

test("a run without --confirm-live plans the trade, exits 3, and sends nothing", { skip: SKIP_WITHOUT_PYTHON }, () => {
  const journal = tempJournal();
  const result = runTool(["open", "--symbol", "BTCUSD", "--side", "buy", "--journal", journal]);
  assert.equal(result.status, 3, `expected the refused exit code, got ${result.status}: ${result.stderr}`);
  assert.match(result.stdout, /refused: --confirm-live is required to send anything/);
  const lines = fs.readFileSync(journal, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const record = JSON.parse(lines[0]);
  assert.equal(record.refused, true);
  assert.equal(record.action, "open");
  assert.equal(record.plan.symbol, "BTCUSD");
  // The plan states the size it would send and the cap that allows it, in words rather than as a guess.
  assert.match(String(record.plan.requested_lots), /volume_min/);
  assert.equal(record.request, undefined, "a refused run must not carry a request it built");
});

test("a run on a symbol outside the allowlist refuses without a terminal", { skip: SKIP_WITHOUT_PYTHON }, () => {
  const journal = tempJournal();
  const result = runTool(["open", "--symbol", "GBPUSD", "--confirm-live", "--journal", journal]);
  assert.equal(result.status, 3);
  assert.match(result.stdout, /refused: GBPUSD is not one of the four instruments this lane trades/);
  assert.equal(JSON.parse(fs.readFileSync(journal, "utf8").trim()).refused, true);
});

test("--help documents the gate, the default size and the journal", { skip: SKIP_WITHOUT_PYTHON }, () => {
  const result = runTool(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--confirm-live/);
  assert.match(result.stdout, /volume_min, the smallest size it accepts/);
  assert.match(result.stdout, /tmp\/live-trading-orders\.log/);
  assert.match(result.stdout, /--entry-price <price>/);
  assert.match(result.stdout, /--expire-minutes <n>/);
  assert.match(result.stdout, /modify --ticket N --stop-loss P \[--take-profit P\] --confirm-live/);
  assert.match(result.stdout, /the position's levels to move \(modify\)/);
});

test("the pending entry the rule states is sent as a limit, refused by name when it cannot be", { skip: SKIP_WITHOUT_PYTHON }, () => {
  // An expiry says when a pending entry runs out, so it needs a pending entry to be about.
  const withoutEntry = runTool(["open", "--symbol", "EURUSD", "--side", "buy", "--expire-minutes", "30", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(withoutEntry.status, 3);
  assert.match(withoutEntry.stdout, /it needs an --entry-price as well/);

  // A price or an expiry that is not a length of anything is refused before the package is imported.
  const zeroPrice = runTool(["open", "--symbol", "EURUSD", "--entry-price", "0", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(zeroPrice.status, 3);
  assert.match(zeroPrice.stdout, /--entry-price must be positive/);
  const negativeExpiry = runTool(["open", "--symbol", "EURUSD", "--entry-price", "1.1", "--expire-minutes", "-5", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(negativeExpiry.status, 3);
  assert.match(negativeExpiry.stdout, /--expire-minutes must be positive/);

  // The plan a refused run prints states the entry it would leave, and carries no request it built.
  const journal = tempJournal();
  const planned = runTool([
    "open", "--symbol", "EURUSD", "--side", "sell", "--entry-price", "1.17025",
    "--stop-loss", "1.1713", "--take-profit", "1.165", "--expire-minutes", "30", "--journal", journal
  ]);
  assert.equal(planned.status, 3);
  const record = JSON.parse(fs.readFileSync(journal, "utf8").trim());
  assert.equal(record.plan.entry, "pending limit at --entry-price");
  assert.equal(record.plan.entry_price, 1.17025);
  assert.equal(record.plan.expire_minutes, 30);
  assert.equal(record.request, undefined, "a refused run must not carry a request it built");
});

test("the removal the loop needs exists, and takes out only this path's own working orders", { skip: SKIP_WITHOUT_PYTHON }, () => {
  const source = orderToolSource;
  // A pending entry is a limit left at a marked line rather than a position, so it comes back out with a
  // removal: a closing deal would be a different thing and would need a position to exist first.
  assert.match(source, /^ACTIONS = \("open", "close", "modify", "cancel", "status", "help"\)$/m);
  assert.match(source, /def plan_cancel\(args\):/);
  assert.match(source, /def cancel_order\(mt5, args, journal\):/);
  assert.match(source, /"action": mt5\.TRADE_ACTION_REMOVE,/);
  // Only something still working, and only something this path left: a tool that removes what it did not
  // place is a tool that can remove anything.
  assert.match(source, /orders = mt5\.orders_get\(ticket=args\.ticket\)/);
  assert.match(source, /is not a working pending order on this account/);
  assert.match(source, /A position is closed with the close action rather than this one/);
  assert.match(source, /carries magic \{int\(order\.magic\)\}, not this tool's \{MAGIC\}/);
  // One attempt, deliberately: a removal carries no price, so a requote cannot be the answer and a second
  // send would be asking to remove two things.
  assert.match(source, /result = mt5\.order_send\(request\)/);
  assert.equal(/send_with_retries\(mt5, request/.test(source.slice(source.indexOf("def cancel_order"))), false);
  // The expiry is this tool's own hand-run cap rather than the rule's lifetime for an entry.
  assert.match(source, /this tool's own cap rather than the rule's/);
  assert.match(source, /the loop passes no expiry at all/);

  // A run without --confirm-live plans the removal and sends nothing.
  const journal = tempJournal();
  const planned = runTool(["cancel", "--ticket", "297744810", "--journal", journal]);
  assert.equal(planned.status, 3, `expected the refused exit code, got ${planned.status}: ${planned.stderr}`);
  assert.match(planned.stdout, /refused: --confirm-live is required to send anything/);
  const record = JSON.parse(fs.readFileSync(journal, "utf8").trim());
  assert.equal(record.action, "cancel");
  assert.equal(record.refused, true);
  assert.equal(record.plan.action, "cancel");
  assert.equal(record.plan.ticket, 297744810);
  assert.equal(record.request, undefined, "a refused run must not carry a request it built");

  // A removal needs a ticket to remove, and says so rather than guessing one.
  const noTicket = runTool(["cancel", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(noTicket.status, 3);
  assert.match(noTicket.stdout, /--ticket must be the positive ticket of the working pending order to remove/);
});

test("the tool holds the pending entry, its guards, the expiry anchor and the read-back of open orders", () => {
  const source = orderToolSource;
  assert.match(source, /def pending_entry_refusal\(info, args, price\):/);
  assert.match(source, /"action": mt5\.TRADE_ACTION_PENDING,/);
  assert.match(source, /mt5\.ORDER_TYPE_BUY_LIMIT if args\.side == "buy" else mt5\.ORDER_TYPE_SELL_LIMIT/);
  // A limit at or through the market is the retrace already having happened, and is refused by name.
  assert.match(source, /is at or above the market/);
  assert.match(source, /is at or below the market/);
  // The expiry is anchored to the terminal's own server clock rather than to this process's clock.
  assert.match(source, /request\["type_time"\] = mt5\.ORDER_TIME_SPECIFIED/);
  assert.match(source, /int\(tick\.time\) \+ int\(args\.expire_minutes\) \* 60/);
  // The stop and the target are judged against the entry a pending order would open at, not against the tick.
  assert.match(source, /reference = float\(args\.entry_price\) if args\.entry_price else price/);
  assert.match(source, /prices_are_ordered\(args\.side, args\.stop_loss, args\.take_profit, reference\)/);
  // A limit stays where the rule put it: only a market entry follows the tick.
  assert.match(source, /if args\.entry_price:\r?\n            return/);
  // A server that will not take an expiry gets one further attempt without it, and the record says so, rather
  // than the ticket costing the signal over a guard the rule never asked for.
  assert.match(source, /^EXPIRY_RETCODES = \($/m);
  assert.match(source, /and retcode_name\(mt5, result\.retcode\) in EXPIRY_RETCODES/);
  assert.match(source, /request\["type_time"\] = mt5\.ORDER_TIME_GTC\r?\n        expiry_fallback = True/);
  assert.match(source, /"expiry_fallback": expiry_fallback,/);
  // The read-only status now states the pending orders, which is how the loop knows its own ticket is still
  // working rather than already gone.
  assert.match(source, /"orders": order_rows/);
  assert.match(source, /def order_type_name\(mt5, value\):/);
  assert.match(source, /order\.type in \(\r?\n                mt5\.ORDER_TYPE_BUY, mt5\.ORDER_TYPE_BUY_LIMIT, mt5\.ORDER_TYPE_BUY_STOP\r?\n            \)/);
  // The size rule is untouched: the default is still the smallest size the instrument accepts.
  assert.match(source, /cap = float\(max_lots\) if max_lots else max\(minimum, base\)/);

test("the level change the breakeven rule needs exists, and reaches only this path's own position", { skip: SKIP_WITHOUT_PYTHON }, () => {
  const source = orderToolSource;
  // The rule's adjustment is a level change on a position that already exists, so it is the one action here that
  // carries no size, no entry and no exit: `TRADE_ACTION_SLTP` on the position's own ticket, which is not an order
  // and not a deal.
  assert.match(source, /def plan_modify\(args\):/);
  assert.match(source, /def modify_order\(mt5, args, journal\):/);
  assert.match(source, /"action": mt5\.TRADE_ACTION_SLTP,/);
  // Only a position this path placed, and only a position at all: the other two actions are named so a caller that
  // reached for the wrong one is told which to use.
  assert.match(source, /positions = mt5\.positions_get\(ticket=args\.ticket\)/);
  assert.match(source, /is not an open position on this account; nothing was sent/);
  assert.match(source, /pending order is removed with the cancel action rather than this one/);
  assert.match(source, /this tool moves only what it placed/);
  // Moving the stop alone must not clear the target: the terminal reads an `SlTp` request with no target in it as a
  // request to clear it, so the position's own target is carried through when the caller names none.
  assert.match(source, /take_profit = float\(args\.take_profit\) if args\.take_profit else \(float\(position\.tp\) or None\)/);
  assert.match(source, /request\["tp"\] = take_profit/);
  // The new stop is judged against the price a position of this side would actually close at - the same price
  // `close` sends to - and against the terminal's own minimum stop distance, so a stop the market is already
  // through is refused here rather than left to the terminal, which could only answer it by closing the position.
  assert.match(source, /closing_price_side = "sell" if side == "buy" else "buy"/);
  assert.match(source, /the new stop sits \{abs\(stop_loss - price\)\} from the market/);
  assert.match(source, /trade_stops_level/);
  // One attempt, deliberately: an `SlTp` request carries no price of its own, so a requote cannot be its answer and
  // a second send would ask the same question twice.
  const modifySource = source.slice(source.indexOf("def modify_order"), source.indexOf("def cancel_order"));
  assert.match(modifySource, /result = mt5\.order_send\(request\)/);
  assert.equal(/send_with_retries\(mt5, request/.test(modifySource), false);
  assert.match(source, /"attempts": 1,/);

  // A run without --confirm-live plans the move, exits 3 and sends nothing.
  const journal = tempJournal();
  const planned = runTool(["modify", "--ticket", "278466300", "--stop-loss", "84500", "--journal", journal]);
  assert.equal(planned.status, 3, `expected the refused exit code, got ${planned.status}: ${planned.stderr}`);
  assert.match(planned.stdout, /refused: --confirm-live is required to send anything/);
  const record = JSON.parse(fs.readFileSync(journal, "utf8").trim());
  assert.equal(record.action, "modify");
  assert.equal(record.refused, true);
  assert.equal(record.plan.ticket, 278466300);
  assert.equal(record.plan.stop_loss, 84500);
  assert.match(String(record.plan.take_profit), /the position's own target, carried through unchanged/);
  assert.equal(record.plan.trader_action, "TRADE_ACTION_SLTP on an open position");
  assert.equal(record.request, undefined, "a refused run must not carry a request it built");

  // A level change needs both the position and the level, and says so rather than guessing either.
  const noTicket = runTool(["modify", "--stop-loss", "84500", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(noTicket.status, 3);
  assert.match(noTicket.stdout, /--ticket must be the positive ticket of the open position whose levels are moved/);
  const noLevel = runTool(["modify", "--ticket", "278466300", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(noLevel.status, 3);
  assert.match(noLevel.stdout, /--stop-loss is the level the modify action moves/);
  const zeroLevel = runTool(["modify", "--ticket", "278466300", "--stop-loss", "0", "--confirm-live", "--journal", tempJournal()]);
  assert.equal(zeroLevel.status, 3);
  assert.match(zeroLevel.stdout, /--stop-loss must be positive/);
});

});
