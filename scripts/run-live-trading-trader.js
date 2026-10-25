// The one automatic order path in the Live Trading lane: one run that asks the L2L rule for every pair the
// feed publishes and places the ticket a confirmed row states, at the instrument's own minimum size.
//
//   node scripts/run-live-trading-trader.js --once                  plan only: print what it would place
//   node scripts/run-live-trading-trader.js --once --confirm-live   arm one run and place what is confirmed
//   node scripts/run-live-trading-trader.js --loop --align --confirm-live
//
// The rule is lib/l2l_strategy.js - the same module the published page loads - so the row a reader can see
// and the ticket this loop places come out of one piece of arithmetic. Nothing in this file names an order
// function: it spawns tools/mt5-bridge/live-trading-order.py, the only file in the repository that can send,
// once per confirmed row, and it reads the account back through that same tool's read-only `status` action
// before it decides anything. `tests/live_trading_order_tool.test.js` holds that boundary.
//
// What it reads, and why each one is read there:
//
//   the marked ladder   <published>/data/l2l-levels.json, the bytes the published page serves, so a level
//                       the reader can see is a level this loop can trade from
//   the sealed calls    <published>/data/layer1.json, read exactly the way the page reads them: the
//                       priority call's direction, falling back to the 24h call's, and a call whose own
//                       window has closed is not a direction at all
//   the bars            this machine's own data/live-trading.json, the freshest snapshot that exists,
//                       written by the feed cadence seconds after each M5 close
//   the account's record  the same snapshot's `closed_trades`, which is the one artifact that says how a ticket
//                       this loop left ended: at its own take-profit or at its own stop. A limit that never filled
//                       has no row there, which is the same fact as a position that is still open.
//
// Four things stand between a confirmed row and a ticket, and each one refuses rather than warns:
//
//   1. --confirm-live. Without it the run reads everything, prints the ticket it would place and sends
//      nothing; the same word the tool itself gates on, so arming is one deliberate act in two places.
//   2. a fresh feed and a live terminal read. A stale snapshot or a terminal that cannot be read is no
//      snapshot of anything, so the run stops instead of trading on what it cannot see.
//   3. one ticket per pair, one per signal bar, and --max-per-day (default 4) trades a day. A signal bar
//      already taken on a pair is never taken twice, even after its ticket closes: the crossing that produced
//      it has been spent. A ticket put back at the level an existing trade was triggered on is not a fresh
//      crossing and does not spend that cap: it is the same trade put back rather than a second one. The hold
//      that decides how many pairs may be working at once is the rule's own one ticket per pair, which the user
//      restated on 2026-10-06: "each asset can have only one pending order running at a time". --max-open is a
//      hand cap over and above that rule when a run asks for one, not a cap across pairs (default: none).
//   4. the size is the tool's own default, the symbol's volume_min. This loop passes no --lots at all, so
//      the smallest trade the instrument accepts is what is placed, and growing it takes a hand edit in
//      the tool's own words rather than a number here.
//
// Before any of those gates is asked, each run reviews what this loop already has working. An L2L entry is a
// limit left at a marked line rather than a position, and the user ruled its lifetime on 2026-10-05: "the levels
// are permanent, they are activated when a deviation happens on the 5m in line with the Layer 1 call. They stay
// active even if a SL is hit, they ractivate when a 5m candle deviates again they are only deactivated if the TP
// is hit or the daily call direction changes." So the entry carries no expiry at all - `--expire-minutes` stays a
// deliberate hand-run cap on the tool and this loop passes none. He restated the same lifetime on 2026-10-06, as
// the two ways a working limit ends: "just when the conditions are set for an entry you set the limit and wait for
// it to be hit or invalidated either by price hitting the TP without it touching the limit or if the directioncal
// call changed during the day, if it did then exit the position." So the review below takes this loop's own limit
// and its own position back out on three readings:
//
//   the call has ended or turned   the call the entry was left for is not standing as its own side any more,
//                                 read through the module's own `sideForDirection` rather than restated here.
//   the target has been taken     the account's own record shows the trade closing at its take-profit, which is
//                                 a price the market only has to touch, so no candle in this snapshot states it.
//   the target has been reached   the market has reached the take-profit this entry was left for while the entry
//                                 is still working: a limit that has not filled with its own target behind the
//                                 market is waiting on a move that has already happened without it.
//
// All three are stated with the reading that decided them, and the removal goes through the tool's `cancel`, which
// removes only a pending order carrying this lane's own magic. A position this loop holds on a pair whose call has
// turned is exited rather than left waiting on a direction that is gone - the user's own instruction in the same
// sentence - through the tool's `close`, which reaches only this lane's own magic. A ticket removed in a run frees
// its slot in that same run, so the caps and the one-ticket-per-pair hold are judged on the account as it stands
// after the review.
//
// The same run reads the trade each pair already has on, and the user ruled that on the same day: "It should
// have re-entered at the same level it originally was triggered on until price crosses the next level. Until the
// next level as crossed the trigger level is the main entry level and you re-enter on that level until either the
// direction changes or TP is hit at which point you wait for the next day." So a pair with a standing trade is not
// read for a fresh crossing at all - the level that trade was triggered on is its entry level, and a stop-out is
// answered by putting the limit back at that same level with the same next-line target and one-fifth stop. The
// trade ends, and the level is not re-entered, on exactly two readings: the call it was left for changes, or the
// account's own record shows the ticket closing at its own take-profit. A line further out being passed is *not*
// one of them - the user ruled on 2026-10-05 that the levels are permanent and only deactivate on the take-profit
// or a change of direction - so a run past the level's target leaves the level standing, waiting for price to
// come back to it. Once a trade has ended, the rule's own crossing is what opens the next one, the way it always
// was.
//
// Two things were added to that reading, and both are the user's own instruction rather than a loosening of it:
//
//   the stop's one rung         a position that has run to twice the risk it was placed with has its stop taken
//                               to breakeven - to the entry it was placed with, once, and never again. It is the
//                               only amendment this file ever makes to an open position, it goes through the
//                               tool's `modify`, and the two times are read from the trade's own placement rather
//                               than from the stop the terminal now holds: that first move is what overwrites the
//                               stop, so the risk the trade was placed with is the only number the rung can be
//                               measured from. Nothing else about the position changes - the target is carried
//                               through unchanged, the exit readings above are untouched, and a trade that never
//                               reaches two times its risk never sees its stop move at all.
//   --close-ticket <n>          a hand-run close of one ticket: this once, whatever the rule would say, and
//                               nothing else that run. The artifacts are not read and the rule is not asked,
//                               because the instruction is to be out of a named position rather than to judge it;
//                               the ticket still has to be an open position carrying this lane's own magic, and
//                               --confirm-live still gates the send.
//
// One line of JSON per run in tmp/live-trading-trader.log, one JSON line per send in the tool's own journal
// tmp/live-trading-orders.log, and what has already been placed in tmp/live-trading-trader-state.json, so
// the next run - or the next reader - can tell what this path has done without trusting this file.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const strategy = require("../lib/l2l_strategy.js");
// The publisher owns two things this loop needs and must not restate: where the published checkout lives,
// and what "this snapshot is still fresh" means. Reading them from one place is what stops the loop and the
// page drifting on either.
const feedPublisher = require("./publish-live-trading-feed.js");
// The dashboard's own close request: the one document the page's Open positions table writes, and the rules
// that decide whether a row in it may be acted on at all. The loop reads the rules rather than restating
// them, so the file the page writes and the file this tick reads cannot drift apart.
const closeRequests = require("../lib/live_trading_close_request.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const ORDER_TOOL_RELATIVE = "tools/mt5-bridge/live-trading-order.py";
// The calls and the ladder come from the published checkout - the bytes the published page serves - and that
// path is resolved by the feed publisher's own helper, so one checkout is read by both.
const CALLS_RELATIVE = "data/layer1.json";
const LEVELS_RELATIVE = "data/l2l-levels.json";
// The bars and the account read come from this machine's own snapshot: the cadence rewrites it seconds
// after each bar close, which is fresher than anything published.
const FEED_RELATIVE = "data/live-trading.json";
const DEFAULT_LOG = "tmp/live-trading-trader.log";
const DEFAULT_LOCK = "tmp/live-trading-trader.lock";
const DEFAULT_STATE = "tmp/live-trading-trader-state.json";
const DEFAULT_JOURNAL = "tmp/live-trading-orders.log";
// The one small document this loop writes for the page: which lane it is, whether it is armed, when it last
// ran and what it did. The snapshot says what the account holds; this says whether a loop is alive behind it,
// so an account with a fresh snapshot and no heartbeat is a feed that is running without a trader. It lives in
// tmp/ with every other local record, and the lanes publisher carries it to the page beside that lane's
// snapshot. It holds no credential and no full login: the masked login the page already shows, or nothing.
const DEFAULT_STATUS_OUT = "tmp/live-trading-trader-status.json";
const STATUS_SCHEMA_VERSION = "live-trading-trader-status-v1";
// Where the dashboard's close requests are read from in the published tree, and the branch they are read out
// of. The page commits the file to the published branch, so the loop asks the remote for it on each tick
// rather than waiting for the publish checkout to be refreshed under it: the ask is a hand act, and half an
// hour of publisher cadence is not a reasonable wait for one. The branch is fetched into FETCH_HEAD only, so
// the read moves no branch and no working tree the publisher is using.
const DEFAULT_CLOSE_REQUESTS = closeRequests.DEFAULT_REQUEST_PATH;
// M5: the timeframe the rule confirms on, and the cadence this loop aligns to.
const BAR_SECONDS = 300;
const DEFAULT_INTERVAL_SECONDS = BAR_SECONDS;
// Later than the feed runner's own 20 seconds on purpose: the producer samples the bar close first and this
// loop reads the snapshot it wrote, rather than racing it for the same second.
const DEFAULT_SETTLE_SECONDS = 90;
// An entry this loop leaves is a limit at a marked line, and the rule states no lifetime for it: the user
// ruled that on 2026-10-05 - the levels are permanent, active from the 5m deviation that confirmed the call,
// and deactivated only by their take-profit being taken or by the day's call changing direction - so the loop
// passes no expiry and removes the ticket itself on those two readings. The flag stays here for a deliberate
// hand run, and `null` is what "no expiry" means.
const DEFAULT_EXPIRE_MINUTES = null;
// One working ticket per pair, and four placements a day: the rule holds one trade per pair, and four is one per
// pair. The per-pair hold is the rule itself - the user's words on 2026-10-06 were "each asset can have only one
// pending order running at a time" - so this loop applies no cap of its own across pairs, and `--max-open` is a
// deliberate hand cap when a run passes one. `null` is what "no cap of its own" means, the way a `null` expiry
// means no expiry.
const DEFAULT_MAX_OPEN = null;
const DEFAULT_MAX_PER_DAY = 4;
// The one rung this loop adds to a position, and the user's own instruction for it: a trade that has run to twice
// the risk it was placed with has its stop taken to breakeven rather than left where it was placed. Twice, so that
// a trade aiming at five times its risk has paid back two fifths of its target before the stop moves, and a trade
// that never gets there never sees its stop move at all. One rung, never a trail: the state file remembers which
// tickets have been moved, so the same stop is not asked for twice.
const BREAKEVEN_R_MULTIPLE = 2;
// Mirrors MAGIC in tools/mt5-bridge/live-trading-order.py: a position or a pending order carrying it is one
// this lane placed. tests/live_trading_trader.test.js holds the two files to the same number.
const ORDER_MAGIC = 20261004;
// The deals this loop places are labelled with the pair and the rule they came from, so a reader of the
// terminal's own history can tell them from the hand-run plumbing proof.
const COMMENT_PREFIX = "l2l-rule-";
const TOOL_TIMEOUT_MS = 120000;
// A run that dies without releasing its lock must not stop the cadence for ever.
const LOCK_STALE_MS = 600000;
// How many placements the state file keeps. Enough to cover a day's worth many times over and still be
// readable by eye.
const STATE_HISTORY = 200;


const USAGE = [
  "Usage:",
  "  node scripts/run-live-trading-trader.js [--once|--loop] [options]",
  "",
  "  --once                     read the artifacts, read the terminal, place what is confirmed (default)",
  "  --loop                     the same run at every 5m bar close until stopped (Ctrl-C)",
  "  --align                    sleep to the next bar close plus the settle window before running",
  "  --interval-seconds <n>     bar width the cadence aligns to (default 300, i.e. M5)",
  "  --settle-seconds <n>       seconds after the bar close the run starts (default 90, after the feed run)",
  "  --confirm-live             required to place anything; without it the run prints the tickets it would",
  "                             send and sends nothing",
  "  --published <dir>          the published tree the calls and the ladder are read from",
  `                             (default <canonical root>/${feedPublisher.DEFAULT_CHECKOUT_RELATIVE})`,
  "  --calls <path>             Layer 1 artifact (default <published>/data/layer1.json)",
  "  --levels <path>            marked L2L ladder (default <published>/data/l2l-levels.json)",
  "  --feed <path>              snapshot holding the bars (default data/live-trading.json, this machine's own)",
  "  --expire-minutes <n>       hand cap only: make a placed limit run out on the terminal's own clock after",
  "                             n minutes. The rule's entry carries no expiry (default: none), because the level",
  "                             is permanent: it stands until the call it was left for changes direction or its",
  "                             take-profit is taken. This loop removes it on those two readings, through the",
  "                             tool's cancel",
  "  --max-open <n>             hand cap only: working tickets this loop allows at once, across all pairs. The",
  "                             rule's own hold is the cap and it is per pair - one ticket per pair at a time -",
  "                             so this is left out unless a run asks for one (default: none)",
  "  --max-per-day <n>          trades this loop opens in one Europe/Prague day (default 4): the clock FTMO's",
  "                             own day and loss limits roll on, where 00:00-02:00 Prague is still the previous",
  "                             UTC day and both clock changes are read in the named zone rather than as a",
  "                             fixed offset. This counts placements; it is not a loss-limit guard. A ticket put",
  "                             back at the level a standing trade was triggered on is that same trade rather",
  "                             than a new one, so it does not count against this",
  "  --close-ticket <n>         hand run only: close this ticket this once, whatever the rule would say, and place",
  "                             nothing else that run. The artifacts are not read and the rule is not asked, since",
  "                             the act is to be out of a named position rather than to judge it; the ticket must be",
  "                             an open position carrying this lane's own magic, and --confirm-live still gates the",
  "                             send. Needs --once: a hand act on one ticket is not a cadence",
  "  --close-requests <path>    the dashboard's own close-request log, read from the published branch at each run",
  `                             (default ${DEFAULT_CLOSE_REQUESTS}). A reader pressing Close in the page's Open`,
  "                             positions table asks for one named ticket to be taken out; the row has to name",
  "                             this loop's lane and account, the ticket still has to carry this lane's own",
  "                             magic, the ask has to be younger than thirty minutes and before its own expiry,",
  "                             and --confirm-live still gates the send. `off` stops the read",
  "  --lane <id>                the lane this checkout trades, exactly as config/live-trading-lanes.json names it",
  "                             (for example ftmo-1). Required for close requests: a row asked on one account is",
  "                             never acted on by the other account's loop",
  "  --requests-remote <name>   remote the close-request log is fetched from (default origin)",
  "  --requests-branch <name>   branch the close-request log is fetched from (default main)",
  "  --status-out <path>        the small heartbeat this run leaves for the page, carried by the lanes publisher",
  "                             beside this lane's snapshot (default tmp/live-trading-trader-status.json)",
  "  --state <path>             what has already been placed (default tmp/live-trading-trader-state.json)",
  "  --log <path>               append-only run log (default tmp/live-trading-trader.log)",
  "  --lock <path>              the guard against two runs at once (default tmp/live-trading-trader.lock)",
  "  --journal <path>           the order tool's own journal (default tmp/live-trading-orders.log)",
  "  --python <path>            the interpreter that runs the order tool (default: python on PATH)",
  "  --terminal <path>          terminal64.exe or its folder, if the package cannot find the terminal",
  "  --quiet                    print nothing; the log line is still written",
  "  --help                     print this text",
  "",
  "Automatic, and not a flag: a position that has run to twice the risk it was placed with has its stop moved to",
  "its own entry, once per trade, through the tool's modify - the target is carried through unchanged and that",
  "stop is never moved a second time. Nothing else about an open position is ever amended.",
  "",
  "Exit 0 when the run read everything and did what the rule said (which may be nothing at all), 1 when a",
  "gate refused or a ticket that was sent did not land, 2 on a bad command line."
].join("\n");

// The one error a caller is meant to see as a message rather than a stack: a bad command line.
class UsageError extends Error {}

function parseArgs(argv) {
  const options = {
    mode: "once",
    align: false,
    quiet: false,
    help: false,
    confirmLive: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    settleSeconds: DEFAULT_SETTLE_SECONDS,
    published: null,
    calls: null,
    levels: null,
    feed: FEED_RELATIVE,
    expireMinutes: DEFAULT_EXPIRE_MINUTES,
    maxOpen: DEFAULT_MAX_OPEN,
    maxPerDay: DEFAULT_MAX_PER_DAY,
    closeTicket: null,
    closeRequests: DEFAULT_CLOSE_REQUESTS,
    lane: null,
    requestsRemote: feedPublisher.DEFAULT_REMOTE,
    requestsBranch: feedPublisher.DEFAULT_BRANCH,
    state: DEFAULT_STATE,
    log: DEFAULT_LOG,
    lock: DEFAULT_LOCK,
    journal: DEFAULT_JOURNAL,
    statusOut: DEFAULT_STATUS_OUT,
    python: null,
    terminal: null
  };
  let sawOnce = false;
  let sawLoop = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new UsageError(`Argument ${token} needs a value`);
      return argv[index];
    };
    switch (token) {
      case "--once":
        sawOnce = true;
        options.mode = "once";
        break;
      case "--loop":
        sawLoop = true;
        options.mode = "loop";
        break;
      case "--align":
        options.align = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      case "--confirm-live":
        options.confirmLive = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--interval-seconds":
        options.intervalSeconds = positiveNumber(token, next());
        break;
      case "--settle-seconds":
        options.settleSeconds = nonNegativeNumber(token, next());
        break;
      case "--expire-minutes":
        options.expireMinutes = positiveInteger(token, next());
        break;
      case "--max-open":
        options.maxOpen = positiveInteger(token, next());
        break;
      case "--max-per-day":
        options.maxPerDay = positiveInteger(token, next());
        break;
      case "--close-ticket":
        options.closeTicket = positiveInteger(token, next());
        break;
      case "--close-requests":
        options.closeRequests = String(next()).trim() || DEFAULT_CLOSE_REQUESTS;
        break;
      case "--lane":
        options.lane = String(next()).trim() || null;
        break;
      case "--requests-remote":
        options.requestsRemote = String(next()).trim();
        break;
      case "--requests-branch":
        options.requestsBranch = String(next()).trim();
        break;
      case "--published":
        options.published = next();
        break;
      case "--calls":
        options.calls = next();
        break;
      case "--levels":
        options.levels = next();
        break;
      case "--feed":
        options.feed = next();
        break;
      case "--state":
        options.state = next();
        break;
      case "--log":
        options.log = next();
        break;
      case "--lock":
        options.lock = next();
        break;
      case "--journal":
        options.journal = next();
        break;
      case "--status-out":
        options.statusOut = next();
        break;
      case "--python":
        options.python = next();
        break;
      case "--terminal":
        options.terminal = next();
        break;
      default:
        throw new UsageError(`Unknown argument: ${token}`);
    }
  }

  if (sawOnce && sawLoop) throw new UsageError("--once and --loop are alternatives; pass one of them.");
  if (sawLoop && options.closeTicket !== null) {
    throw new UsageError("--close-ticket is one hand act on one ticket rather than a cadence; pass it with --once.");
  }
  if (options.settleSeconds >= options.intervalSeconds) {
    throw new UsageError("--settle-seconds must be smaller than --interval-seconds, or the cadence chases itself.");
  }
  if (options.lane !== null && !closeRequests.isLane(options.lane)) {
    throw new UsageError(
      `--lane must be a lane id from config/live-trading-lanes.json (for example ftmo-1), got ${JSON.stringify(options.lane)}.`
    );
  }
  return options;
}

function positiveNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new UsageError(`${flag} needs a positive number, got ${raw}`);
  return value;
}

function nonNegativeNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new UsageError(`${flag} needs a number of seconds, got ${raw}`);
  return value;
}

// The published checkout, resolved by the feed publisher's own helper: in the canonical root beside the other
// release checkouts, so this lane's worktree never grows an untracked copy of the published tree. A checkout
// that is not there is not an error at this point - each file is checked as it is read, and the record says
// which tree was used and when that file was written.
function resolvePublishedDir(exec = spawnSync) {
  try {
    return feedPublisher.resolveDefaultCheckout(exec);
  } catch {
    return path.join(REPO_ROOT, ...feedPublisher.DEFAULT_CHECKOUT_RELATIVE.split("/"));
  }
}

function resolveInside(base, relative) {
  return path.isAbsolute(relative) ? relative : path.resolve(base, ...String(relative).split("/"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Paths in the log are written the way the rest of the repository writes them, so a log line can be pasted
// into a shell or an issue without a Windows backslash surprise.
function relativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/") || absolutePath;
}

// The page's own reading of a Layer 1 call, mirrored from `liveTradingRuleCall` in script.js: the priority
// call's direction, falling back to the 24h call's, and a call whose own window has closed is not a
// direction at all - the artifact keeps the older call until the next run overwrites it, so handing it over
// would size a ticket on a forecast that ended days ago. The validity fields read here are the same three
// the page reads, so the published table and this loop cannot disagree about which pairs have a direction.
function layer1Validity(agent) {
  const priority = agent?.priority_call;
  const daily = agent?.calls?.["24h"];
  return {
    sealed_at: agent?.sealed_at || priority?.sealed_at || daily?.sealed_at || null,
    forecast_window_end: agent?.forecast_window_end ?? priority?.forecast_window_end ?? daily?.forecast_window_end ?? null,
    expires_at: agent?.expires_at ?? priority?.expires_at ?? daily?.expires_at ?? null,
    effective_status: agent?.effective_status || priority?.effective_status || daily?.effective_status || null,
    status_at_build: agent?.status_at_build || priority?.status_at_build || daily?.status_at_build || null
  };
}

function layer1Call(agent, nowMs) {
  const validity = layer1Validity(agent);
  const direction = agent?.priority_call?.direction || agent?.calls?.["24h"]?.direction || null;
  const expiresAt = validity.forecast_window_end || validity.expires_at || null;
  const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const status = String(validity.effective_status || validity.status_at_build || "").toUpperCase();
  const open = Boolean(direction) && Number.isFinite(expiryMs) && expiryMs > nowMs && status !== "EXPIRED";
  return {
    asset: agent?.agent || null,
    published: direction,
    direction: open ? direction : null,
    live: open,
    status: status || null,
    sealed_at: validity.sealed_at,
    expires_at: expiresAt
  };
}

// Every direction the artifact carries, keyed by the dashboard's asset code, plus the same rows for the log.
// The rule is handed the directions and refuses a pair it has none for.
function readCalls(callsJson, nowMs) {
  const agents = Array.isArray(callsJson?.agents) ? callsJson.agents : [];
  const rows = agents.map(agent => layer1Call(agent, nowMs));
  const directions = {};
  rows.forEach(row => {
    if (row.asset) directions[row.asset] = row.direction;
  });
  return { rows, directions, generated_at_utc: callsJson?.dashboard_meta?.last_updated_et ?? null };
}

// The marked levels for one symbol, filtered the way the page filters them: a level without a readable price
// is not a price, and is dropped rather than repaired.
function levelsFor(entry) {
  return Array.isArray(entry?.levels) ? entry.levels.filter(level => Number.isFinite(Number(level?.price))) : [];
}

// The feed and the ladder are two artifacts joined on the broker symbol, exactly as `applyLiveTradingLevels`
// joins them for the page. An instrument the feed does not carry is ignored rather than invented.
function joinLevels(feed, levelsJson) {
  const bySymbol = {};
  (Array.isArray(levelsJson?.instruments) ? levelsJson.instruments : []).forEach(entry => {
    if (entry && typeof entry.symbol === "string") bySymbol[entry.symbol] = entry;
  });
  const instruments = (Array.isArray(feed?.instruments) ? feed.instruments : []).map(instrument => {
    const marked = bySymbol[instrument?.symbol];
    if (!marked) return instrument;
    return { ...instrument, levels: levelsFor(marked) };
  });
  return { instruments, levels_generated_at_utc: levelsJson?.generated_at_utc ?? null };
}


// Which of the two prices a closed trade left at: the one it was placed with, or its take-profit. The exit
// price is the one price the position closed at, and the two it could have closed at are the ones placed with
// it - the exit sits nearer exactly one of them, which is the price the market reached first. A trade that
// ended away from both is a hand close if it was not the stop, and `other` is what says so.
function exitEnding(row) {
  const exit = Number(row?.price_close);
  if (!Number.isFinite(exit)) return null;
  const distance = price => {
    const value = price === null || price === undefined || price === "" ? Number.NaN : Number(price);
    return Number.isFinite(value) ? Math.abs(exit - value) : Number.POSITIVE_INFINITY;
  };
  const toTarget = distance(row?.take_profit);
  const toStop = distance(row?.stop_loss);
  if (!Number.isFinite(toTarget) && !Number.isFinite(toStop)) return null;
  if (toTarget < toStop) return "target";
  if (toStop < toTarget) return "stop";
  return "other";
}

// Whether the account's own record of a closed trade shows it leaving at its target rather than at its stop. A
// trade that ended away from both is not read as having taken its target: this reading is what ends a trade's
// life for the day at its target, and the separate hand-close reading below is what ends it when a person did.
function closedAtItsTarget(row) {
  return exitEnding(row) === "target";
}

// The trade each pair already has on: the level its newest ticket was placed at - the level it was triggered on -
// and whether the evidence says that trade is over. The user corrected this on 2026-10-05, in his own words: "It
// should have re-entered at the same level it originally was triggered on until price crosses the next level.
// Until the next level as crossed the trigger level is the main entry level and you re-enter on that level until
// either the direction changes or TP is hit at which point you wait for the next day." So a pair with a trade on is
// not read for a fresh crossing at all: the level it was triggered at is the entry level, and what this loop
// watches is the endings the user has stated.
//
// Those endings, as the account and the artifacts state them:
//
//   the direction changes   the call the ticket was left for is gone, or is the other side. This is the reading
//                           `reviewPendings` drops a working limit on, taken from the same artifact.
//   the target is taken     the account's own record of the trade shows it closed at its own take-profit, which
//                           is what `closedAtItsTarget` reads.
//   the target is reached   the market has arrived at the target this trade aims at while its entry is still a
//                           working limit rather than a position - the invalidation the user stated on
//                           2026-10-06: "wait for it to be hit or invalidated either by price hitting the TP
//                           without it touching the limit". One reading of "the target has been reached", shared
//                           with `reviewPendings` through `marketHasReached`, so the limit and the level's turn
//                           end together rather than a run apart.
//
// Nothing else ends a level, and the user ruled that in his own words: the levels are permanent, activated by the
// 5m deviation that confirmed the call, still active after a stop is hit and re-armed when a 5m candle deviates
// at them again, deactivated only by the take-profit or a change of direction. So a candle finishing beyond the
// level's own target line ends nothing: the level waits for price to come back to it, which the `resting`
// reading below is what decides can happen at all.
//
// A trade that has ended is not re-entered: the level's turn is over, and what opens the next ticket is the rule's
// own crossing again. A trade that is still the pair's own carries the ticket this loop would put back, priced from
// the level it was triggered at through the module's `reentryPlan`, plus one fact this file can see and the module
// cannot: whether a limit at that level can rest where the market is now. The comparison the tool makes when it
// refuses - a buy limit at or above the market is a buy now, a sell limit at or below it is a sell now - is stated
// here only so a doomed ticket is not sent every five minutes. The tool stays the authority on the send, and an
// unreadable quote leaves this reading null so the attempt is made and answered there.
//
// There is no candle reading left in this function: it is the state file and the account's record alone, which is
// what the permanence ruling leaves.
function tradeCycles({ state, directions = {}, joined, closedTrades = [] } = {}) {
  const instruments = Array.isArray(joined?.instruments) ? joined.instruments : [];
  const instrumentBySymbol = new Map(instruments.filter(row => row?.symbol).map(row => [row.symbol, row]));
  const ours = (Array.isArray(closedTrades) ? closedTrades : []).filter(
    row => Number(row?.magic) === ORDER_MAGIC && String(row?.comment || "").startsWith(COMMENT_PREFIX)
  );
  // Every act this lane wrote down that took a ticket out by hand: the closes and cancellations of an ask or a
  // hand run, and the answers to close requests that say one landed. They are what lets a trade a person ended
  // be recognised even when the account's own record is not in the snapshot's window.
  const manualEnds = (Array.isArray(state?.closes) ? state.closes : [])
    .concat(Array.isArray(state?.cancellations) ? state.cancellations : [])
    .concat(Array.isArray(state?.close_requests) ? state.close_requests : [])
    .filter(row => row && (row.done === true || row.outcome === "closed" || row.outcome === "cancelled"));
  // One row per pair: the newest ticket this loop placed on it. Everything older is the same trade put back, or a
  // trade that has already been answered, and the account itself is the live fact about what is still working.
  const newest = new Map();
  (Array.isArray(state?.placements) ? state.placements : [])
    .filter(row => row?.placed === true && row?.symbol)
    .forEach(row => {
      const previous = newest.get(row.symbol);
      if (previous && (Date.parse(previous?.placed_at_utc || "") || 0) > (Date.parse(row?.placed_at_utc || "") || 0)) return;
      newest.set(row.symbol, row);
    });
  const cycles = new Map();
  for (const [symbol, row] of newest) {
    cycles.set(symbol, tradeCycle(symbol, row, {
      directions,
      instrument: instrumentBySymbol.get(symbol) || null,
      closedTrades: ours,
      manualEnds
    }));
  }
  return cycles;
}

// The trade row the log carries beside a decision and in its own block: the level it was triggered at, the target
// it aims at, the ticket this loop placed for it, and which of the user's endings - if any - has happened.
function tradeSummary(cycle) {
  return {
    side: cycle.side,
    trigger_level: cycle.trigger_level,
    target: cycle.target,
    signal_time_utc: cycle.signal_time_utc,
    placed_at_utc: cycle.placed_at_utc,
    order_ticket: cycle.order_ticket,
    market: cycle.market,
    exit_price: cycle.exit_price,
    resting: cycle.resting,
    target_reached: cycle.target_reached,
    ended: cycle.ended,
    ended_by: cycle.ended_by,
    reason: cycle.reason
  };
}

// What is true of a pair's trade right now, in one sentence: either what keeps it alive, or which of the endings
// that are the user's own has happened. The words are this lane's own, so the log reads the same way when a trade
// is standing, when its call has gone, when its target has been taken and when its target has been reached by a
// market that never touched the entry.
function tradeReason({ symbol, asset, side, trigger, target, direction, endedBy, settled, exitPrice } = {}) {
  if (!endedBy) {
    return `The trade ${symbol} was triggered at ${trigger} is still the pair's own: the call it was left for reads ${direction ? `"${direction}"` : "no direction"} and stands as a ${side} call, and the level is permanent, so it goes on standing with its target at ${target} until that target is taken or the call changes direction. The entry stays at that same level.`;
  }
  if (endedBy === "call") {
    return `The call this trade was left for has ended: Layer 1 now reads ${direction ? `"${direction}"` : "no direction"} for ${asset || symbol}, which is not a ${side} call standing, so the trade at ${trigger} has nothing left to be in and the level is not re-entered.`;
  }
  if (endedBy === "target-fill") {
    return `The trade at ${trigger} has taken its target: the account's own record shows ${symbol} closing at ${settled?.price_close}, its own take-profit, so the level's turn is over and the next day is what this pair waits for.`;
  }
  if (endedBy === "hand-close") {
    return `The trade at ${trigger} was taken out by hand, not by its stop and not at its target, and a ticket a person closed is not one this loop puts back: the level waits for the rule's own crossing at a fresh bar rather than reopening the trade someone chose to end.`;
  }
  if (endedBy === "target-touched") {
    return `The trade at ${trigger} has had its target reached without its entry filling: ${side === "long" ? "the bid" : "the ask"} is ${exitPrice} and the target this ticket was left aiming at is ${target}, so what the level was waiting for has already happened without this entry, the level's turn is over for now, and a fresh crossing is what would open the next one.`;
  }
}

// One pair's trade, from the ticket this loop placed on it. Split out of `tradeCycles` only so this file keeps one
// function per idea: everything below is the arithmetic of reading the two artifacts and the account's record.
function tradeCycle(symbol, row, { directions = {}, instrument = null, closedTrades = [], manualEnds = [] } = {}) {
  const asset = row?.asset || instrument?.dashboard_asset || null;
  const side = row?.side === "short" ? "short" : "long";
  const trigger = Number(row?.level ?? row?.entry);
  const entryIsPrice = Number.isFinite(trigger);
  const placedTicket = row?.order_ticket === undefined || row?.order_ticket === null
    ? null
    : Number(row.order_ticket);
  const levels = strategy.readLevels(instrument?.levels);
  const point = instrument?.point ?? null;
  const direction = directions && typeof directions === "object" ? directions[asset] : null;
  const callSide = strategy.sideForDirection(direction);
  const placedAtMs = Date.parse(row?.placed_at_utc || "") || null;
  const level = entryIsPrice
    ? side === "long"
      ? strategy.nearestAbove(levels, trigger)
      : strategy.nearestBelow(levels, trigger)
    : null;
  const target = level ? Number(level.price) : null;
  // The trade this ticket produced, when the account has finished one: a record opened at or after the ticket was
  // placed. A ticket that never filled has no such record, which is the same fact as a position still being open -
  // and in both cases the trade is still the pair's own and the limit belongs back at the level.
  const settled = placedAtMs === null
    ? null
    : closedTrades.find(entry =>
        entry?.symbol === symbol
        && (Date.parse(entry?.opened?.time_utc || "") || 0) >= placedAtMs
        && closedAtItsTarget(entry)
      ) || null;
  // A trade that ended by a person rather than by the market, read two ways so neither the page nor the
  // account's own record has to be the only witness. The account's record says it left away from both its
  // stop and its target; this lane's own state says a close or a cancellation was written for this ticket or
  // symbol after it was placed. Either one ends the trade here, because a ticket a person took out is not one
  // this loop puts back - that is the whole difference between a stop, which the rule re-arms, and a hand.
  const closedByHand = placedAtMs === null
    ? null
    : closedTrades.find(entry =>
        entry?.symbol === symbol
        && (Date.parse(entry?.opened?.time_utc || "") || 0) >= placedAtMs
        && exitEnding(entry) === "other"
      ) || null;
  const askedByHand = (Array.isArray(manualEnds) ? manualEnds : []).find(entry => {
    if (!entry || entry.symbol !== symbol) return false;
    if (placedTicket !== null && Number.isFinite(placedTicket) && Number(entry.ticket) === placedTicket) return true;
    const when = Date.parse(entry.done_at_utc || entry.answered_at_utc || "") || 0;
    return placedAtMs !== null && when >= placedAtMs;
  }) || null;
  const quote = instrument?.quote && typeof instrument.quote === "object" ? instrument.quote : null;
  const bid = Number(quote?.bid);
  const ask = Number(quote?.ask);
  // The price a market order of this side would take, which is the reference the tool refuses a limit against.
  const market = side === "long" ? ask : bid;
  const resting = Number.isFinite(market) && entryIsPrice
    ? side === "long"
      ? trigger < market
      : trigger > market
    : null;
  // The user's endings: a call that has gone or turned, the account's own record of the take-profit being taken,
  // and - added on 2026-10-06 - a market that has reached this trade's target while its entry is still only a
  // working limit. That last one is the invalidation the user stated ("wait for it to be hit or invalidated either
  // by price hitting the TP without it touching the limit"): a limit the terminal still reports as working has not
  // filled, so a market at the target has made the move the level was left for without the entry, and the level's
  // turn is over. A candle finishing beyond the target's line is still deliberately not one of them: what is read
  // is the price the target sits at being reached, not a bar's close.
  const targetReached = marketHasReached(side, target, instrument, placedAtMs) === true;
  const exitPrice = exitPriceFor(side, instrument);
  const endedBy = !callSide || callSide !== side
    ? "call"
    : askedByHand || closedByHand
      ? "hand-close"
      : settled
        ? "target-fill"
        : targetReached
          ? "target-touched"
          : null;
  const ticket = endedBy ? null : strategy.reentryPlan({ symbol, side, entry: trigger, levels, point });
  return {
    symbol,
    asset,
    side,
    trigger_level: entryIsPrice ? trigger : null,
    target,
    target_level: level ? { ...level } : null,
    signal_time_utc: row?.signal_time_utc ?? null,
    placed_at_utc: row?.placed_at_utc ?? null,
    order_ticket: row?.order_ticket ?? null,
    ended: Boolean(endedBy),
    ended_by: endedBy,
    target_reached: targetReached,
    exit_price: exitPrice,
    reason: tradeReason({ symbol, asset, side, trigger, target, direction, endedBy, settled, exitPrice }),
    // The ticket this loop would put back, and the module's own words for why it is not a ticket at all when the
    // ladder cannot price one - no line marked beyond the level, or a stop the instrument's grid cannot hold.
    ticket: ticket && ticket.stage === "confirmed" ? ticket.plan : null,
    ticket_stage: ticket ? ticket.stage : null,
    ticket_reason: ticket ? ticket.reason : null,
    resting,
    market: Number.isFinite(market) ? market : null,
    resting_reason: resting === false
      ? `The level this trade was triggered at, ${trigger}, is on the far side of the market (${market}) for a ${side} entry: a ${side === "long" ? "buy" : "sell"} limit at that level would be a ${side === "long" ? "buy" : "sell"} now, so the retrace it waits for has already happened and this pair waits for the price to trade back to ${trigger}.`
      : null
  };
}

// The price a position of this side would close at: a long's take-profit is taken at the bid and a short's at the
// ask. `null` when the snapshot carries no readable quote, which is not a reading that may end anything.
function exitPriceFor(side, instrument) {
  const quote = instrument?.quote && typeof instrument.quote === "object" ? instrument.quote : null;
  const price = Number(side === "long" ? quote?.bid : quote?.ask);
  return Number.isFinite(price) ? price : null;
}

// Whether the market has already reached a price an entry was aimed at, asked for the side that would be exiting
// there, so the price that decides it is the one a position of that side closes at. One function, so the review of
// a working limit and the reading of the trade that limit belongs to cannot disagree about what "the target has
// been reached" means.
//
// Two readings, because a take-profit is a price the market only has to touch and this loop samples every five
// minutes: the snapshot's own quote first, and then - for a touch that happened between two runs - the extreme of
// every M5 bar the snapshot carries from the bar the ticket was placed in onwards. A long's target is reached at
// the bar's high, a short's at its low, which is the side a take-profit is taken on. The answer is `null` when
// neither reading is available, which is not a reading that may end anything.
function marketHasReached(side, price, instrument, sinceMs = null) {
  if (price === null || price === undefined || price === "") return null;
  const target = Number(price);
  if (!Number.isFinite(target)) return null;
  const exitPrice = exitPriceFor(side, instrument);
  if (exitPrice !== null && (side === "long" ? exitPrice >= target : exitPrice <= target)) return true;

  const bars = Array.isArray(instrument?.m5?.bars) ? instrument.m5.bars : [];
  const from = Number.isFinite(Number(sinceMs)) ? Number(sinceMs) : null;
  const window = bars.filter(bar => {
    if (from === null) return true;
    const at = Date.parse(bar?.time_utc || "");
    return !Number.isFinite(at) || at >= from;
  });
  if (!window.length) return exitPrice === null ? null : false;
  return window.some(bar => {
    const extreme = Number(side === "long" ? bar?.high : bar?.low);
    if (!Number.isFinite(extreme)) return false;
    return side === "long" ? extreme >= target : extreme <= target;
  });
}

// Which way a working pending order waits, read from the order type the terminal itself reports rather than
// from the state file: the account is the live fact, and a state file that was deleted or pruned must still
// leave a ticket this loop can judge.
function pendingDirection(row) {
  const type = String(row?.type || "");
  if (type.startsWith("ORDER_TYPE_BUY")) return "long";
  if (type.startsWith("ORDER_TYPE_SELL")) return "short";
  return null;
}

// The same question asked of a row the terminal read back, whether it is a working limit or a position: the side
// the account itself states is what is read, and the order's own type is the fallback for a row that states none.
function rowDirection(row) {
  const side = String(row?.side ?? "").toLowerCase();
  if (side === "buy") return "long";
  if (side === "sell") return "short";
  return pendingDirection(row);
}

// Every working pending order of this loop's own, judged against the two things the user ruled on 2026-10-05:
// the entry stands while the directional call it was left for is standing, and it comes out when that call ends or
// turns. That reading is taken from the artifact the rule itself reads - the call through the module's own
// `sideForDirection` - so "the call ended" means here what it means everywhere else in this lane, and this file
// states no rule of its own.
//
// A second reason was added with the trade reading below, because the candles cannot see it: a trade whose target
// has been taken. The account's own record of the ticket closing at its take-profit is what says so - a
// take-profit is a price the market only has to touch, so a trade can be over without any candle finishing past
// the line it sat on, and the limit left under it would then be waiting on a trade that has already been answered.
//
// A third reason was removed on 2026-10-05, and the removal is the user's own ruling rather than a bug fix: the
// levels are permanent. A marked line further out being passed is therefore *not* a reason to take the limit out,
// because the level was activated by its own 5m deviation in line with the call and it stays active until the
// take-profit is taken or the call changes direction. Nothing about a candle's close is read here.
//
// On 2026-10-06 the user stated the same lifetime as the two ways a working limit ends: "you set the limit and
// wait for it to be hit or invalidated either by price hitting the TP without it touching the limit or if the
// directioncal call changed during the day". The third reading below is that sentence's first half, and it is not
// the removed one back again: what is read is the order's own take-profit against the live quote, not a candle
// that finished past a line - a limit the terminal still reports as working has not filled, so a market at its
// target has made the move the entry was left for without the entry, and that is exactly what "invalidated" means
// here. The reading is the same one the trade below ends a level's turn on, through the same helper.
function reviewPendings({ live, joined, calls = {}, cycles = new Map() } = {}) {
  const instruments = Array.isArray(joined?.instruments) ? joined.instruments : [];
  const directions = calls?.directions && typeof calls.directions === "object" ? calls.directions : {};
  const orders = (Array.isArray(live?.orders) ? live.orders : []).filter(row => Number(row?.magic) === ORDER_MAGIC);

  return orders.map(row => {
    const side = rowDirection(row);
    const entry = Number(row?.price_open);
    const instrument = instruments.find(candidate => candidate?.symbol === row?.symbol) || null;
    const asset = instrument?.dashboard_asset ?? null;
    const base = {
      ticket: row?.ticket ?? null,
      symbol: row?.symbol ?? null,
      asset,
      side,
      order_type: row?.type ?? null,
      entry: Number.isFinite(entry) ? entry : null,
      decision: "keep",
      reason: null
    };
    const keep = reason => ({ ...base, decision: "keep", reason });
    const drop = (reason, extra = {}) => ({ ...base, decision: "cancel", reason, ...extra });

    if (!side || !Number.isFinite(entry)) {
      return keep(
        `The terminal reports ${row?.symbol} pending order ${row?.ticket} as ${row?.type}, which is not one of the four kinds this loop leaves, so nothing here knows what it waits on: it is left alone.`
      );
    }
    if (!instrument) {
      return keep(
        `The snapshot carries no ${row?.symbol} pair, so neither its call nor its ladder can be read for this entry: it is left where it is rather than removed on a reading that is missing.`
      );
    }
    const callSide = strategy.sideForDirection(directions[asset]);
    if (!callSide) {
      return drop(
        `The call this entry was left for has ended: Layer 1 now reads ${directions[asset] ? `"${directions[asset]}"` : "no direction"} for ${asset || row?.symbol}, which is not a live call, so the ${side} limit at ${entry} has nothing left to be filled by.`
      );
    }
    if (callSide !== side) {
      return drop(
        `The call this entry was left for has ended: Layer 1 now reads ${directions[asset]} for ${asset || row?.symbol}, a ${callSide} call against this ${side} limit, so it waits on a direction that is no longer standing.`
      );
    }
    // The reason the candles cannot see: the account's own record shows the trade this entry belongs to closing at
    // its target. A take-profit is a price the market only has to touch, so the trade can be over without any candle
    // finishing past the line it sat on - and the user's rule is that a trade the target has been taken on waits for
    // the next day, which leaves nothing for the limit at this level to be filled by.
    const cycle = cycles instanceof Map ? cycles.get(row?.symbol) || null : null;
    if (cycle && cycle.ended_by === "target-fill") {
      return drop(
        `The trade this entry was left for has taken its target: the account's own record shows ${row?.symbol} closing at its own take-profit, and a trade whose target has been taken waits for the next day, so the ${side} limit at ${entry} is taken back out.`,
        { target_line: cycle.target }
      );
    }
    // The user's sentence of 2026-10-06, and the reading no candle in this snapshot states: the entry is
    // invalidated "by price hitting the TP without it touching the limit". A limit the terminal still reports as
    // working has not filled, so a market that has reached the take-profit this order carries has made the move
    // the entry was left for without the entry: the deviation is behind the market now, and there is nothing left
    // for this limit to be filled by. The order's own take-profit is the price the terminal was given when the
    // ticket was left, and the trade's own target is the fallback for a row that does not state one.
    const statedTarget = Number(row?.take_profit);
    const missing = row?.take_profit === null || row?.take_profit === undefined || row?.take_profit === "";
    const targetPrice = missing || !Number.isFinite(statedTarget) ? (cycle?.target ?? null) : statedTarget;
    // The bar the ticket was last placed in is where the bar reading starts: a touch before this entry was left is
    // a different question - the far side of the market already answers that one - and a touch after it is this one.
    const leftAtMs = cycle?.placed_at_utc ? Date.parse(cycle.placed_at_utc) : null;
    if (marketHasReached(side, targetPrice, instrument, leftAtMs) === true) {
      return drop(
        `The target this entry was left for has been reached without the entry filling: ${side === "long" ? "the bid" : "the ask"} is ${exitPriceFor(side, instrument)}, at or past the take-profit ${targetPrice} this working limit carries, so the move the deviation was left for has already happened without this entry and the ${side} limit at ${entry} is taken back out.`,
        { target_line: targetPrice, target_reached: true }
      );
    }
    return keep(
      `The ${side} call for ${asset || row?.symbol} is still standing with the target at ${targetPrice ?? "no stated price"} still in front of the market, and a level only deactivates when its take-profit is taken or the call changes direction, so the entry at ${entry} stands and carries no expiry of its own.`
    );
  });
}


// The other half of the user's sentence of 2026-10-06: "or if the directioncal call changed during the day, if it
// did then exit the position." A position this loop holds - read from the account by this lane's own magic, the way
// the working limits above are - is exited when the call it was opened for has turned against it, through the
// tool's `close`, which reaches only a position carrying the same magic. A call that is simply absent is not a
// call that has turned: nothing is closed on it, because the resting limit is what the review above removes on
// that reading and the position is left to the stop and target it was placed with rather than exited at whatever
// the market happens to be. This is the only place this file takes a position out, and the module still decides
// nothing about it: which way the call stands is `sideForDirection`'s answer, as everywhere else in this lane.
function reviewPositions({ live, joined, calls = {} } = {}) {
  const instruments = Array.isArray(joined?.instruments) ? joined.instruments : [];
  const directions = calls?.directions && typeof calls.directions === "object" ? calls.directions : {};
  const positions = (Array.isArray(live?.positions) ? live.positions : []).filter(row => Number(row?.magic) === ORDER_MAGIC);

  return positions.map(row => {
    const side = rowDirection(row);
    const instrument = instruments.find(candidate => candidate?.symbol === row?.symbol) || null;
    const asset = instrument?.dashboard_asset ?? null;
    const entry = Number(row?.price_open);
    const volume = Number(row?.volume);
    const profit = Number(row?.profit);
    const base = {
      ticket: row?.ticket ?? null,
      symbol: row?.symbol ?? null,
      asset,
      side,
      volume: Number.isFinite(volume) ? volume : null,
      entry: Number.isFinite(entry) ? entry : null,
      profit: Number.isFinite(profit) ? profit : null,
      decision: "keep",
      reason: null
    };
    const keep = reason => ({ ...base, decision: "keep", reason });
    const exit = reason => ({ ...base, decision: "close", reason });

    if (!side) {
      return keep(
        `The terminal reports ${row?.symbol} position ${row?.ticket} as ${row?.type ?? "an unstated type"}, so nothing here knows which way it waits: it is left alone.`
      );
    }
    if (!instrument) {
      return keep(
        `The snapshot carries no ${row?.symbol} pair, so its call cannot be read for this position: it is left where it is rather than closed on a reading that is missing.`
      );
    }
    const callSide = strategy.sideForDirection(directions[asset]);
    if (callSide && callSide !== side) {
      return exit(
        `The call this position was opened for has turned: Layer 1 now reads ${directions[asset]} for ${asset || row?.symbol}, a ${callSide} call against this ${side} position, so the user's rule for a changed call is that the position is exited rather than left waiting on a direction that is gone.`
      );
    }
    return keep(
      callSide
        ? `The ${side} call for ${asset || row?.symbol} is still standing, so this position stays: it is exited when the call turns against it, and until then its own stop and target are what answer it.`
        : `Layer 1 states no live call for ${asset || row?.symbol} at this instant, and a call that has ended is not a call that has turned: the resting limit is reviewed on that reading, and this position is left to its own stop and target.`
    );
  });
}


// The stop levels this loop has already moved, by ticket. The rule carries one rung rather than a trail, so this is
// what stops a second run asking for the same move: the terminal's own stop is at breakeven by then, but a run that
// read the account between the send and its landing would otherwise ask for it again.
function movedTickets(state) {
  const moved = new Map();
  (Array.isArray(state?.moves) ? state.moves : []).forEach(row => {
    const ticket = Number(row?.ticket);
    if (Number.isFinite(ticket)) moved.set(ticket, row);
  });
  return moved;
}

// The risk the trade was placed with, read from its own placement rather than from the stop the terminal holds now:
// the first move this loop makes is what overwrites that stop, and a breakeven stop would read as a trade with no
// risk at all. The placement's own stated risk comes first, then the distance it placed between its entry and its
// stop, then its target divided by the multiple it was placed with. `null` when the row states none of them, which
// is not a number a stop may be moved against.
function placementRisk(placement) {
  const stated = Number(placement?.risk);
  if (Number.isFinite(stated) && stated > 0) return stated;
  const entry = Number(placement?.entry);
  const stop = Number(placement?.stop);
  if (Number.isFinite(entry) && Number.isFinite(stop) && Math.abs(entry - stop) > 0) return Math.abs(entry - stop);
  const target = Number(placement?.target);
  const multiple = Number(placement?.r_multiple);
  if (Number.isFinite(target) && Number.isFinite(multiple) && multiple > 0) {
    const placed = Math.abs(target - entry) / multiple;
    if (Number.isFinite(placed) && placed > 0) return placed;
  }
  return null;
}

// The one amendment this loop makes to an open position: a trade that has run to twice the risk it was placed with
// has its stop taken to breakeven - to the entry it was placed with - and that is the only rung it gets. Read here
// rather than acted on, so a plan-only run states the move it would send and the one reason for it, and the send
// itself stays in the one place the other sends are.
//
// Each refusal names the one fact that decided it. The trade's own numbers come from
// its placement in the state file, because the terminal's stop is the very thing this move overwrites; the market
// reading is the same `marketHasReached` a target and an invalidated entry are read through, from the bar the ticket
// was placed in onwards, so a touch between two runs is answered here the way it is answered there. A position this
// same run is already exiting is left to its own exit rather than having its stop moved on the way out, and a
// position whose state row is gone - or whose row states no risk - is left alone rather than moved against a number
// this loop does not have.
function breakevenReview({ live, joined, state, closing = [] } = {}) {
  const instruments = Array.isArray(joined?.instruments) ? joined.instruments : [];
  const placements = Array.isArray(state?.placements) ? state.placements : [];
  const alreadyMoved = movedTickets(state);
  const exiting = new Set((Array.isArray(closing) ? closing : []).map(value => Number(value)));
  const positions = (Array.isArray(live?.positions) ? live.positions : []).filter(row => Number(row?.magic) === ORDER_MAGIC);

  return positions.map(row => {
    const ticket = Number(row?.ticket);
    const side = rowDirection(row);
    const instrument = instruments.find(candidate => candidate?.symbol === row?.symbol) || null;
    const asset = instrument?.dashboard_asset ?? null;
    // The placement this ticket came from, newest first: one position is one trade, and a pair that has re-entered
    // at its own level has a newer row than the tracking entry that was stopped out.
    const placement = placements.slice().reverse().find(entry => Number(entry?.order_ticket) === ticket) || null;
    const level = price => {
      const value = Number(price);
      return Number.isFinite(value) ? value : null;
    };
    const base = {
      ticket: row?.ticket ?? null,
      symbol: row?.symbol ?? null,
      asset,
      side,
      volume: Number.isFinite(Number(row?.volume)) ? Number(row.volume) : null,
      entry: level(placement?.entry),
      target: level(placement?.target),
      held_stop: level(row?.stop_loss),
      risk: placementRisk(placement),
      trigger_price: null,
      new_stop: null,
      exit_price: null,
      decision: "keep",
      reason: null
    };
    const keep = reason => ({ ...base, decision: "keep", reason });
    const move = (reason, extra = {}) => ({ ...base, decision: "move", reason, ...extra });

    if (!Number.isFinite(ticket) || !side) {
      return keep(
        `The terminal reports ${row?.symbol} position ${row?.ticket} as ${row?.type ?? "an unstated type"}, so nothing here knows which way it waits: its stop is left where it is.`
      );
    }
    const moved = alreadyMoved.get(ticket);
    if (moved) {
      return keep(
        `This trade's stop has already been taken to breakeven: the state file records ticket ${ticket}'s move at ${moved.moved_at_utc ?? "an unrecorded instant"}, and the rule carries one rung rather than a trail, so nothing is asked for a second time.`
      );
    }
    if (exiting.has(ticket)) {
      return keep(
        `This run is already exiting ${row?.symbol} position ${ticket} on the call reading above, so its stop is left alone: that exit is what answers the trade, and a stop moved on the way out would be an amendment nothing asked for.`
      );
    }
    if (!placement) {
      return keep(
        `The state file carries no placement for ticket ${ticket}, so the risk this trade was placed with is not known here: its stop is left where it is rather than moved against a number this loop does not have.`
      );
    }
    if (base.entry === null || base.risk === null) {
      return keep(
        `The placement this trade came from states an entry of ${base.entry} and a risk of ${base.risk}, which is not a pair of numbers a stop can be measured against: it is left where it is.`
      );
    }
    if (!instrument) {
      return keep(
        `The snapshot carries no ${row?.symbol} pair, so the market cannot be read for this position: its stop is left where it was placed rather than moved on a reading that is missing.`
      );
    }
    const past = base.held_stop !== null
      && (side === "long" ? base.held_stop >= base.entry : base.held_stop <= base.entry);
    if (past) {
      return keep(
        `The position's own stop is ${base.held_stop}, at or past the entry ${base.entry} this trade was placed with, so the level this adjustment moves to is where it already stands: nothing is sent.`
      );
    }
    const distance = BREAKEVEN_R_MULTIPLE * base.risk;
    const trigger = side === "long" ? base.entry + distance : base.entry - distance;
    const placedAtMs = Date.parse(placement?.placed_at_utc || "") || null;
    if (placedAtMs === null) {
      return keep(
        `The state file's placement for ticket ${ticket} carries no readable placed_at_utc, so the window this trade's own move could have happened in cannot be read: its stop is left where it was placed rather than moved on a market this run cannot date.`
      );
    }
    const exitPrice = exitPriceFor(side, instrument);
    const reading = `${side === "long" ? "the bid" : "the ask"}${exitPrice === null ? " this snapshot does not state" : ` at ${exitPrice}`}`;
    const reached = marketHasReached(side, trigger, instrument, placedAtMs);
    if (reached === null) {
      return keep(
        `The trade's own ${BREAKEVEN_R_MULTIPLE}R level is ${trigger}, and this snapshot carries neither a quote nor a bar for ${row?.symbol} from the bar the ticket was placed in: there is no market to measure that level against, so the stop stays where it was placed.`
      );
    }
    if (reached === false) {
      return keep(
        `The stop stays where it was placed: the market has to reach ${trigger}, ${BREAKEVEN_R_MULTIPLE} times the ${base.risk} this trade was placed with, and ${reading}. The trade's own target is ${base.target}, and the level that reaches it is the one that moves the stop.`
      );
    }
    return move(
      `The trade on ${row?.symbol} has run to ${BREAKEVEN_R_MULTIPLE} times the ${base.risk} it was placed with: ${reading}, at or past ${trigger}, so the stop is taken to breakeven at the entry this trade was placed with (${base.entry}) through the tool's modify, and it stays there - the rule carries this one rung rather than a trail. The target at ${base.target} is carried through unchanged.`,
      { trigger_price: trigger, new_stop: base.entry, exit_price: exitPrice }
    );
  });
}

function positiveInteger(flag, raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new UsageError(`${flag} needs a positive integer, got ${raw}`);
  return value;
}



// Every invocation of the order tool is built here, so the one place that names the tool is one place. A read
// is the tool's own read-only `status`; a send adds the ticket's numbers and the tool's `--confirm-live`.
function toolArgs(action, options, extra = []) {
  const args = [path.resolve(REPO_ROOT, ORDER_TOOL_RELATIVE), action];
  if (options.terminal) args.push("--path", options.terminal);
  args.push("--journal", path.resolve(REPO_ROOT, options.journal));
  return args.concat(extra);
}

function tail(text, limit = 200) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(-limit).replace(/\s+/g, " ");
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// The tool prints its human lines and then one JSON record as the last line. Reading that record rather than
// the printed block is what keeps this loop on the tool's own words, refusals included.
function parseToolRecord(stdout) {
  const lines = String(stdout || "").split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // Not this line; keep looking upwards.
    }
  }
  return null;
}

// One run of the tool. Nothing here decides anything: it spawns, waits, and hands back the tool's own record
// and exit code, so the reasons a trade did or did not happen are the sender's own words.
function runTool(spawn, options, args) {
  const result = spawn(options.python || "python", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: TOOL_TIMEOUT_MS,
    windowsHide: true
  });
  const exitCode = typeof result?.status === "number" ? result.status : null;
  if (result?.error) {
    return { exitCode, record: null, error: String(result.error.message || result.error).slice(0, 200) };
  }
  const record = parseToolRecord(result?.stdout);
  const error = record ? null : tail(result?.stderr) || tail(result?.stdout) || `the order tool exited ${exitCode}`;
  return { exitCode, record, error };
}

// The account as the terminal has it, with this lane's own tickets picked out by the magic the tool marks
// them with. A read that does not come back as a status record is null, which is a refusal: a loop that
// cannot see the account must not place anything into it.
function liveFromStatus(record) {
  if (!record || record.action !== "status") return null;
  const positions = Array.isArray(record.positions) ? record.positions : [];
  const orders = Array.isArray(record.orders) ? record.orders : [];
  const ours = positions.concat(orders).filter(row => Number(row?.magic) === ORDER_MAGIC);
  return { account: record.account || null, positions, orders, ours };
}

// What has already been placed. The one thing this file must not lose between runs is which signal bars have
// been taken: without it a loop ticking every five minutes would place the same ticket again.
function readState(statePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, statePath), "utf8"));
    return {
      placements: Array.isArray(parsed?.placements) ? parsed.placements : [],
      cancellations: Array.isArray(parsed?.cancellations) ? parsed.cancellations : [],
      closes: Array.isArray(parsed?.closes) ? parsed.closes : [],
      moves: Array.isArray(parsed?.moves) ? parsed.moves : [],
      // Every ask from the dashboard's Open positions table this loop has already answered, whether it acted
      // on it or left it alone. It is what makes a request a one-shot: the page's log is append-only, so the
      // only place a request can be marked as dealt with is here.
      close_requests: Array.isArray(parsed?.close_requests) ? parsed.close_requests : []
    };
  } catch {
    // No readable state is an empty state: a fresh machine's first run is not a reason to refuse.
    return { placements: [], cancellations: [], closes: [], moves: [], close_requests: [] };
  }
}

function writeState(statePath, state) {
  const resolved = path.resolve(REPO_ROOT, statePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const placements = state.placements.slice(-STATE_HISTORY);
  const cancellations = (state.cancellations || []).slice(-STATE_HISTORY);
  const closes = (state.closes || []).slice(-STATE_HISTORY);
  const moves = (state.moves || []).slice(-STATE_HISTORY);
  const closeRequestsAnswered = (state.close_requests || []).slice(-STATE_HISTORY);
  // The cancellations, closes, moves and answered requests are written only when there is one, so a file that
  // has never had a removal, an exit, a stop moved or an ask from the page keeps the shape it has always had.
  const payload = { placements };
  if (cancellations.length) payload.cancellations = cancellations;
  if (closes.length) payload.closes = closes;
  if (moves.length) payload.moves = moves;
  if (closeRequestsAnswered.length) payload.close_requests = closeRequestsAnswered;
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return resolved;
}

// ---- Taking one ticket out by hand, from either of the two ways a person asks for it -------------------
// One act, two ways in. A ticket named on the command line and a ticket named by a row in the dashboard's
// own close-request log are the same act on the account: the terminal is read first, the ticket still has to
// carry this lane's own magic, a working limit is cancelled and a position is exited at the market, and
// --confirm-live still decides whether anything is sent. What differs is only who asked, which the row's
// comment and the run's own reason say, so a reader can tell a hand run from a press on the page.
//
// The record this fills is the one the flag has always filled: `hand` for the act, `terminal` for what was
// read, `placements` emptied, because a close is not a trade this loop placed.
function takeTicketOut({ options, record, statePath, spawn, now, ticket, comment, request, state: injectedState }) {
  const handTicket = Number(ticket);
  const read = runTool(spawn, options, toolArgs("status", options));
  const live = liveFromStatus(read.record);
  if (!live) {
    record.terminal_read = {
      exit_code: read.exitCode,
      refused: read.record?.refused === true,
      message: read.record?.message ? String(read.record.message).slice(0, 300) : null,
      error: read.error
    };
    return {
      status: "refused",
      exitCode: 1,
      outcome: "terminal_unreadable",
      reason: `the terminal could not be read, so ticket ${handTicket} could not be looked up and nothing was sent: ${read.error || record.terminal_read.message || `the order tool exited ${read.exitCode}`}`
    };
  }
  record.terminal = {
    account: live.account?.login_masked ?? null,
    server: live.account?.server ?? null,
    positions_open: live.positions.length,
    orders_open: live.orders.length,
    ours: live.ours.length
  };
  record.placements = [];
  const position = live.positions.find(row => Number(row?.ticket) === handTicket) || null;
  const order = live.orders.find(row => Number(row?.ticket) === handTicket) || null;
  const ours = live.ours.find(row => Number(row?.ticket) === handTicket) || null;
  record.hand = {
    ticket: handTicket,
    artifacts_read: false,
    kind: position ? "position" : order ? "working_limit" : null,
    symbol: position?.symbol ?? order?.symbol ?? null,
    side: rowDirection(position || order),
    ours: ours !== null,
    action: null,
    sent: false,
    done: false,
    refused: false,
    retcode_name: null,
    tool_exit: null,
    done_at_utc: null,
    tool_reason: null
  };
  // A ticket an ask from the page named carries the ask's own id, its stamp and who asked, so the state file
  // says which press produced the row rather than only that something took the ticket out.
  if (request) {
    record.hand.request_id = request.request_id;
    record.hand.requested_at_utc = request.requested_at_utc;
    record.hand.requested_by = request.requested_by;
    record.hand.account = request.account || null;
    // Defence in depth on the same fact the ask carried. The row named a lane and a masked login; the terminal
    // read a moment ago is the account those have to match. A row copied from the other lane's page, or a
    // terminal logged into the other account since the ask was written, is refused here - before the ticket is
    // looked up in this loop's own magic - so nothing can be closed on the wrong account.
    const owned = closeRequests.accountMatches(request, {
      lane: options.lane,
      loginMasked: live.account?.login_masked ?? null,
      server: live.account?.server ?? null
    });
    if (!owned.ok) {
      record.status = "nothing_to_close";
      record.reason = `${owned.reason}, so ticket ${handTicket} was not taken out: nothing was sent.`;
      return { status: "nothing_to_close", exitCode: 0, outcome: "foreign_account", reason: record.reason };
    }
  }

  // A ticket on the account that is not this loop's own is not this loop's to take out: a position opened by
  // hand or by another lane is left alone, and the reason says which of the two facts failed rather than
  // "not found".
  if (!ours) {
    record.status = "nothing_to_close";
    record.reason = position || order
      ? `ticket ${handTicket} is on this account but does not carry this loop's own magic, so it is not this loop's to take out: nothing was sent.`
      : `ticket ${handTicket} is not an open order or position on this account: there is nothing to close.`;
    return { status: "nothing_to_close", exitCode: 0, outcome: "nothing_to_close", reason: record.reason };
  }
  // The kind decides the tool's own action: a position is exited at the market and a resting limit is taken
  // back out. One flag, because from the user's side both are "be out of this ticket".
  const action = position ? "close" : "cancel";
  record.hand.action = action;
  if (!options.confirmLive) {
    record.status = "planned";
    record.reason = `not armed: --confirm-live was not passed, so ticket ${handTicket} would have been taken out as a ${action} and nothing was sent.`;
    return { status: "planned", exitCode: 0, outcome: "planned", reason: record.reason };
  }
  const result = runTool(spawn, options, toolArgs(action, options, [
    "--ticket", String(handTicket),
    "--comment", comment,
    "--confirm-live"
  ]));
  const answer = result.record?.answer || null;
  record.hand.sent = true;
  record.hand.done = answer?.done === true;
  record.hand.refused = result.record?.refused === true;
  record.hand.retcode_name = answer?.retcode_name ?? null;
  record.hand.tool_exit = result.exitCode;
  record.hand.done_at_utc = record.hand.done ? new Date(now()).toISOString() : null;
  record.hand.tool_reason = record.hand.done
    ? null
    : (result.record?.message ? String(result.record.message).slice(0, 300) : result.error);
  // Only what was sent and landed is written down, the way every other send in this file is: the state file is
  // this lane's record of what it did to the account, and one of these acts is one of those.
  if (record.hand.done) {
    const handState = injectedState || readState(statePath);
    const handRow = { ...record.hand, comment };
    if (action === "close") {
      handState.closes = (handState.closes || []).concat([handRow]);
    } else {
      handState.cancellations = (handState.cancellations || []).concat([handRow]);
    }
    writeState(statePath, handState);
  }
  if (record.hand.sent && !record.hand.done && !record.hand.refused) {
    record.status = "send_failed";
    record.reason = `ticket ${handTicket} was sent to the terminal as a ${action} and did not land; the order tool's own journal holds the terminal's answer.`;
    return { status: "send_failed", exitCode: 1, outcome: "send_failed", reason: record.reason };
  }
  if (record.hand.done) {
    const kindWord = action === "close" ? "position" : "working limit";
    record.status = action === "close" ? "closed" : "cancelled";
    record.reason = request
      ? `${kindWord} ${handTicket} was taken out in answer to the dashboard's close request asked at ${request.requested_at_utc}, and nothing else was read, reviewed or placed this run.`
      : `${kindWord} ${handTicket} was taken out by hand, and nothing else was read, reviewed or placed this run.`;
    return { status: record.status, exitCode: 0, outcome: record.status, reason: record.reason };
  }
  record.status = "refused";
  record.reason = `ticket ${handTicket} was refused before anything was sent: ${record.hand.tool_reason}`;
  return { status: "refused", exitCode: 0, outcome: "refused", reason: record.reason };
}

// ---- The dashboard's own close request, read once per run ----------------------------------------------
// The published branch is asked for the log first, because the page commits there and a request that waits
// for the checkout under this tick to be refreshed is a request answered half an hour late. The fetch moves
// FETCH_HEAD and nothing else, so it disturbs no branch and no working tree the publisher is using. The
// checkout's own copy is the fallback for a machine with no remote to ask, and every failure here is a note
// in the record rather than a refusal: a network problem must not stop the loop trading.
function parseRequestsDocument(raw) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(raw || ""));
  } catch (error) {
    return { state: null, error: `it could not be read as JSON: ${error.message}` };
  }
  const problems = closeRequests.validateRequestsState(parsed);
  if (problems.length) return { state: null, error: problems.join("; ") };
  return { state: closeRequests.normaliseState(parsed), error: null };
}

function readCloseRequests({ options, published, exec = spawnSync }) {
  const relative = options.closeRequests;
  if (relative === "off") return { enabled: false, source: null, state: null, error: null };
  const fetched = feedPublisher.git(
    ["-C", published, "fetch", "--quiet", options.requestsRemote, options.requestsBranch],
    { exec }
  );
  if (fetched.ok) {
    const shown = feedPublisher.git(["-C", published, "show", `FETCH_HEAD:${relative}`], { exec });
    if (shown.ok) {
      const parsed = parseRequestsDocument(shown.stdout);
      if (parsed.state) return { enabled: true, source: `FETCH_HEAD:${relative}`, state: parsed.state, error: null };
      return { enabled: true, source: null, state: null, error: `the published ${relative} is not a close-request document this loop can act on: ${parsed.error}` };
    }
  }
  const local = resolveInside(published, relative);
  try {
    const parsed = parseRequestsDocument(fs.readFileSync(local, "utf8"));
    if (parsed.state) return { enabled: true, source: relativePath(local), state: parsed.state, error: null };
    return { enabled: true, source: null, state: null, error: parsed.error };
  } catch (error) {
    const why = fetched.ok ? relativePath(local) : (fetched.stderr || fetched.error?.message || "git could not be run");
    return { enabled: true, source: null, state: null, error: `the close-request log could not be read (${why}): ${error.message}` };
  }
}

// One ask per run, the oldest this loop has not already answered. The ask is taken before the artifacts and
// before the freshness gate for the same reason a hand-run close is: the instruction is to be out of a named
// ticket rather than to read the market. What comes back is the act itself - its status, its reason and the
// code the run exits with - or null when there was nothing to act on, in which case the run carries on and
// judges the market as it always did.
//
// The ask is written into the state whatever the outcome was, including "there was nothing to close",
// because it is this file and not the page's log that makes an ask a one-shot: the page's log is append-only
// and cannot mark anything as dealt with.
function closeRequestStep({ options, record, published, statePath, spawn, now, state: injectedState, exec = spawnSync }) {
  const read = readCloseRequests({ options, published, exec });
  record.close_requests = {
    enabled: read.enabled,
    lane: options.lane ?? null,
    source: read.source,
    error: read.error,
    published: read.state ? read.state.requests.length : null,
    asked: null,
    taken: null,
    answered: []
  };
  if (!read.enabled || !read.state) return null;
  const state = injectedState || readState(statePath);
  // Every ask now names the account it was asked on. A loop that was not told its own lane cannot claim one,
  // and saying so once per run is better than acting on a row that might belong to the other account.
  if (!options.lane) {
    record.close_requests.error =
      "this loop was not told which lane it is (--lane), so it cannot claim a close request: every ask names its account now, and a loop without a lane must not act on one.";
    return null;
  }
  // What this lane has already dealt with: its own answers, and the closes and cancellations it wrote when an
  // ask turned into an act. Both make an id answered, and an answered id is a replay rather than a close.
  const answered = new Set((state.close_requests || []).map(row => row?.request_id).filter(Boolean));
  (state.closes || []).concat(state.cancellations || []).forEach(row => {
    if (row?.request_id) answered.add(row.request_id);
  });
  const answeredRows = new Set((state.close_requests || []).map(row => row?.request_id).filter(Boolean));
  const askedAtMs = now();
  const acks = [];
  const answer = (request, fields) => {
    const row = closeRequests.answerFor(request, {
      answeredAtUtc: new Date(askedAtMs).toISOString(),
      source: read.source,
      ...fields
    });
    acks.push(row);
    record.close_requests.answered.push({
      request_id: row.request_id,
      ticket: row.ticket,
      outcome: row.outcome,
      reason: row.reason
    });
    return row;
  };

  // Walk the log once, oldest ask first. A row is refused for exactly one reason and that reason is written
  // down: it was already answered, it has expired, it names another account, or it is this lane's and waits.
  // Only the waiting rows are candidates, and only the oldest of them is taken this run.
  const mine = [];
  for (const request of read.state.requests) {
    if (answered.has(request.request_id)) {
      if (!answeredRows.has(request.request_id)) {
        answer(request, {
          outcome: closeRequests.ANSWER_OUTCOMES.replay,
          reason: `ask ${request.request_id} was already answered by this lane, so it is not acted on again.`
        });
      }
      continue;
    }
    if (!closeRequests.isOpenRequest(request, askedAtMs)) {
      answer(request, {
        outcome: closeRequests.ANSWER_OUTCOMES.expired,
        reason: `ask ${request.request_id} expired at ${request.expires_at_utc || "the end of its window"} without being acted on: nothing was sent.`
      });
      continue;
    }
    const ownership = closeRequests.accountMatches(request, { lane: options.lane });
    if (!ownership.ok) {
      answer(request, {
        outcome: closeRequests.ANSWER_OUTCOMES.foreign_account,
        reason: `${ownership.reason}: this lane left it alone, and nothing was sent.`
      });
      continue;
    }
    mine.push(request);
  }

  if (acks.length) {
    state.close_requests = (state.close_requests || []).concat(acks);
    writeState(statePath, state);
  }
  if (!mine.length) return null;

  const ask = mine[0];
  record.close_requests.asked = {
    request_id: ask.request_id,
    ticket: ask.ticket,
    symbol: ask.symbol,
    requested_at_utc: ask.requested_at_utc,
    expires_at_utc: ask.expires_at_utc,
    requested_by: ask.requested_by,
    account: ask.account
  };
  const act = takeTicketOut({
    options,
    record,
    statePath,
    spawn,
    now,
    ticket: ask.ticket,
    comment: `${COMMENT_PREFIX}asked`,
    request: ask
  });
  const after = injectedState || readState(statePath);
  after.close_requests = (after.close_requests || []).concat([closeRequests.answerFor(ask, {
    answeredAtUtc: new Date(now()).toISOString(),
    outcome: act.outcome,
    source: read.source,
    action: record.hand?.action ?? null,
    done: record.hand?.done === true,
    reason: act.reason
  })]);
  writeState(statePath, after);
  record.close_requests.taken = {
    request_id: ask.request_id,
    ticket: ask.ticket,
    action: record.hand?.action ?? null,
    outcome: act.outcome,
    done: record.hand?.done === true,
    code: act.exitCode,
    reason: act.reason
  };
  return act;
}


function signalKey(symbol, timeUtc) {
  return `${symbol}|${timeUtc || "unknown"}`;
}

function takenSignals(state) {
  const taken = new Set();
  state.placements.forEach(row => taken.add(signalKey(row?.symbol, row?.signal_time_utc)));
  return taken;
}

// Placements, not attempts: a ticket the tool refused never became a trade and does not spend the day's cap. A
// re-entry does not spend it either: it is the same trade put back at the level it was triggered on rather than a
// second trade, and the user's rule is that the level is re-entered until the call changes or the target is taken,
// which is not something a daily count of trades should be able to stop.
function placementsToday(state, nowMs) {
  return todayPlacements(state, nowMs).filter(row => row?.reentry !== true).length;
}

// The re-entries a day carries, stated beside the trades it opened so a reader can tell the two apart in the log.
function reentriesToday(state, nowMs) {
  return todayPlacements(state, nowMs).filter(row => row?.reentry === true).length;
}

// The day `--max-per-day` counts in. The counter used to cut at 00:00 UTC, which is 01:00 or 02:00 in Prague -
// the clock the FTMO account's own day and loss limits roll on - so between midnight and 01:00/02:00 local the
// loop could spend a whole second daily cap while the account still read it as the same trading day. The zone is
// named rather than expressed as an offset, so both clock changes are the platform's arithmetic and not a table
// kept here. This is a placement counter, not a loss-limit guard.
const TRADE_DAY_TIMEZONE = "Europe/Prague";
const TRADE_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: TRADE_DAY_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

// A calendar day in the trading zone, as YYYY-MM-DD, from an instant or an ISO string. A stamp that cannot be read
// is `null` rather than today: a placement whose time is broken must never be counted as one of today's.
function tradeDayKey(value) {
  const ms = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  if (!Number.isFinite(ms)) return null;
  const parts = TRADE_DAY_FORMAT.formatToParts(new Date(ms));
  const pick = type => (parts.find(part => part.type === type) || {}).value || "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function todayPlacements(state, nowMs) {
  const day = tradeDayKey(nowMs);
  if (!day) return [];
  return (Array.isArray(state?.placements) ? state.placements : []).filter(
    row => row?.placed === true && tradeDayKey(row?.placed_at_utc) === day
  );
}

// One reading per pair, and for a confirmed row one decision. The module's stages come back unchanged -
// `blocked` is its one-trade-per-pair, `no-call` a call with no live direction, `waiting` a live reading that
// has crossed nothing - and only `confirmed` can become a ticket. Every other row is kept with the reason it
// is not one, so the log says what the loop saw rather than only what it did.
//
// A pair that already has a trade on is the one exception, and it is the user's correction of 2026-10-05: the
// level that trade was triggered on is its entry level, so a fresh crossing is not what is waited for. `cycles`
// carries what each pair's trade is - already read from the account and the artifacts - and a pair whose trade is
// still its own states that trade's own ticket whatever the candles are doing. The day's cap counts trades opened,
// so a ticket put back at that level is not one of those; the module's stage and close stay on the row beside it,
// because they are what the page says about the pair and a reader comparing the two should see both.
function decide({ readings, state, live, options, nowMs, cycles = new Map() }) {
  const taken = takenSignals(state);
  const oursBySymbol = new Set((live?.ours || []).map(row => row?.symbol).filter(Boolean));
  const openTickets = (live?.ours || []).length;
  const placedToday = placementsToday(state, nowMs);
  const reentries = reentriesToday(state, nowMs);
  let working = openTickets;
  let used = placedToday;

  const rows = readings.map(reading => {
    const cycle = cycles instanceof Map ? cycles.get(reading.symbol) || null : null;
    const trade = cycle && !cycle.ended ? cycle : null;
    const ticket = trade ? trade.ticket : reading.stage === "confirmed" ? reading.plan : null;
    const signalTime = trade ? trade.signal_time_utc : reading.confirmation?.time_utc || null;
    const base = {
      symbol: reading.symbol,
      asset: reading.asset ?? null,
      stage: reading.stage,
      side: trade ? trade.side : reading.side,
      level: trade ? trade.trigger_level : reading.level?.price ?? reading.watch?.level?.price ?? null,
      confirmation_time_utc: signalTime,
      close: reading.confirmation?.close ?? null,
      beyond_points: reading.confirmation?.beyond?.points ?? null,
      entry: ticket?.entry ?? null,
      stop: ticket?.stop ?? null,
      target: ticket?.target ?? null,
      risk: ticket?.risk ?? null,
      r_multiple: ticket?.r_multiple ?? null,
      trade: cycle ? tradeSummary(cycle) : null,
      decision: "none",
      reason: reading.reason
    };
    if (trade) {
      // The trade this pair is in, put back at the level it was triggered on. None of the reading's own gates are
      // asked: the crossing that opened this trade has already happened, so there is no bar left to spend, and a
      // ticket put back at that level is the same trade rather than a second one, so it does not spend the day's
      // count of trades. What can still refuse it is the account and the market: a pair already carrying a ticket,
      // a hand cap --max-open when a run asked for one, a ladder with no line past the level to aim the target at,
      // or a market on the far side of it.
      const row = { ...base, reentry: true, reason: trade.ticket_reason || trade.reason };
      if (!trade.ticket) return { ...row, decision: "skip" };
      if (trade.resting === false) return { ...row, decision: "skip", reason: trade.resting_reason };
      if (oursBySymbol.has(reading.symbol)) {
        return {
          ...row,
          decision: "skip",
          reason: `${reading.symbol} already carries a ticket from this loop, and the rule holds one trade at a time on a pair.`
        };
      }
      if (options.maxOpen !== null && working >= options.maxOpen) {
        return {
          ...row,
          decision: "skip",
          reason: `${openTickets} ticket(s) from this loop are already working and the hand cap --max-open is ${options.maxOpen}.`
        };
      }
      working += 1;
      return { ...row, decision: "place" };
    }
    if (!ticket) return base;
    if (taken.has(signalKey(reading.symbol, signalTime))) {
      return {
        ...base,
        decision: "skip",
        reason: `the M5 candle at ${signalTime} has already been taken on ${reading.symbol}: a signal bar is spent once, whether or not that ticket filled.`
      };
    }
    if (oursBySymbol.has(reading.symbol)) {
      return {
        ...base,
        decision: "skip",
        reason: `${reading.symbol} already carries a ticket from this loop, and the rule holds one trade at a time on a pair.`
      };
    }
    if (options.maxOpen !== null && working >= options.maxOpen) {
      return {
        ...base,
        decision: "skip",
        reason: `${openTickets} ticket(s) from this loop are already working and the hand cap --max-open is ${options.maxOpen}.`
      };
    }
    if (used >= options.maxPerDay) {
      return {
        ...base,
        decision: "skip",
        reason: `${placedToday} trade(s) have already been opened today and --max-per-day is ${options.maxPerDay}.`
      };
    }
    working += 1;
    used += 1;
    return { ...base, decision: "place" };
  });

  return {
    rows,
    candidates: rows.filter(row => row.decision === "place"),
    taken_today: placedToday,
    reentries_today: reentries,
    open_tickets: openTickets,
    ours: (live?.ours || []).map(row => ({ ticket: row?.ticket ?? null, symbol: row?.symbol ?? null, type: row?.type ?? null }))
  };
}

// The instant a run should start: the next bar close plus the settle window, strictly after `fromMs`, so a run
// that has just finished inside the settle window waits for the following bar instead of running twice.
function nextRunAt(fromMs, intervalSeconds = DEFAULT_INTERVAL_SECONDS, settleSeconds = DEFAULT_SETTLE_SECONDS) {
  const stepMs = intervalSeconds * 1000;
  const boundaryMs = Math.floor(fromMs / stepMs) * stepMs;
  const target = boundaryMs + settleSeconds * 1000;
  return target > fromMs ? target : target + stepMs;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// The heartbeat the page reads for one lane: the smallest set of facts that says whether a loop is alive
// behind a snapshot, whether that loop may send, and what it last did. It is derived from the run's own
// record rather than gathered here, so the page and the log cannot disagree about a run.
function traderStatus(record, { nowMs } = {}) {
  const at = record?.at_utc ?? null;
  const closeRequests = record?.close_requests && typeof record.close_requests === "object"
    ? record.close_requests
    : null;
  return {
    schema_version: STATUS_SCHEMA_VERSION,
    lane: record?.lane ?? null,
    at_utc: at,
    written_at_utc: new Date(Number.isFinite(nowMs) ? nowMs : Date.now()).toISOString(),
    armed: record?.armed === true,
    status: record?.status ?? "unknown",
    reason: record?.reason ? String(record.reason).slice(0, 400) : null,
    account: {
      login_masked: record?.terminal?.account ?? null,
      server: record?.terminal?.server ?? null
    },
    terminal: record?.terminal
      ? {
          positions_open: record.terminal.positions_open ?? null,
          orders_open: record.terminal.orders_open ?? null,
          ours: record.terminal.ours ?? null
        }
      : null,
    close_requests: closeRequests
      ? {
          enabled: closeRequests.enabled === true,
          error: closeRequests.error ?? null,
          taken: closeRequests.taken
            ? {
                request_id: closeRequests.taken.request_id ?? null,
                ticket: closeRequests.taken.ticket ?? null,
                outcome: closeRequests.taken.outcome ?? null
              }
            : null
        }
      : null,
    duration_seconds: record?.duration_seconds ?? null
  };
}

// One line, always: the log is read by eye and by grep, and a run with nothing to say still has to say when.
function formatRunRecord(record) {
  return JSON.stringify(record);
}

function appendLog(logPath, record) {
  const resolved = path.resolve(logPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.appendFileSync(resolved, `${formatRunRecord(record)}\n`, "utf8");
  return resolved;
}

// Two processes must not read the terminal and decide from the same state at once. The lock is a file, so the
// guard also holds between a foreground run and the scheduled task.
function acquireLock(lockPath, nowMs) {
  const resolved = path.resolve(lockPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const payload = `${JSON.stringify({ pid: process.pid, at_utc: new Date(nowMs).toISOString() })}\n`;
  try {
    fs.writeFileSync(resolved, payload, { flag: "wx" });
    return { acquired: true, path: resolved, stoleStaleLock: false, ageMs: 0 };
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }

  let ageMs = null;
  try {
    ageMs = nowMs - fs.statSync(resolved).mtimeMs;
  } catch {
    ageMs = null;
  }
  if (ageMs !== null && ageMs > LOCK_STALE_MS) {
    fs.writeFileSync(resolved, payload);
    return { acquired: true, path: resolved, stoleStaleLock: true, ageMs };
  }
  return { acquired: false, path: resolved, ageMs };
}

function releaseLock(lock) {
  // Only ever remove the lock this run took: a run that stepped aside must not delete the other run's guard.
  if (!lock?.acquired) return;
  try {
    fs.unlinkSync(lock.path);
  } catch {
    // A lock already gone is the state we want; nothing to report.
  }
}


// One run: guard, read the artifacts, read the terminal, decide, place, log. Returns the exit code the
// scheduled task will record and the record itself, so a caller - or a test - can see what was written.
//
// Every path is resolved against the repository root rather than the process working directory: a scheduled
// task starts in C:\Windows\System32, where a relative lock path made an earlier run of the feed try to create
// C:\Windows\System32\tmp, throw EPERM, and exit without a log line at all.
function runOnce(options, deps = {}) {
  const spawn = deps.spawn || spawnSync;
  const now = deps.now || (() => Date.now());
  const writeLog = deps.writeLog || appendLog;
  const startedMs = now();
  const logPath = path.resolve(REPO_ROOT, options.log);
  const lockPath = path.resolve(REPO_ROOT, options.lock);
  const statePath = path.resolve(REPO_ROOT, options.state);
  const published = options.published ? path.resolve(options.published) : resolvePublishedDir(deps.exec || spawnSync);
  const callsPath = resolveInside(published, options.calls || CALLS_RELATIVE);
  const levelsPath = resolveInside(published, options.levels || LEVELS_RELATIVE);
  const feedPath = path.resolve(REPO_ROOT, options.feed);
  const record = {
    at_utc: new Date(startedMs).toISOString(),
    status: "unknown",
    // The lane this checkout trades, as the lanes file names it. It is what makes a close request on this
    // account this loop's to answer, and it is in every line of the log so a reader with two lanes open
    // cannot mistake one log for the other.
    lane: options.lane ?? null,
    armed: options.confirmLive === true,
    sources: {
      published: relativePath(published),
      calls: relativePath(callsPath),
      levels: relativePath(levelsPath),
      feed: relativePath(feedPath)
    },
    caps: {
      expire_minutes: options.expireMinutes,
      max_open: options.maxOpen,
      max_per_day: options.maxPerDay,
      // Which day the count above belongs to, and on whose clock, so a reader of the log can tell a fresh
      // Prague day from a run that simply has not placed anything yet.
      trade_day: tradeDayKey(startedMs),
      trade_day_timezone: TRADE_DAY_TIMEZONE
    }
  };
  let lock = null;

  // The document the page reads to tell a live lane from a snapshot with nothing behind it. It is written on
  // every run that reaches the log - a refusal included, because "the loop ran and refused" is a heartbeat -
  // and a write that fails is noted in the run rather than failing a run that has already done its work.
  const writeStatus = deps.writeStatus
    || ((statusPath, payload) => {
      const resolved = path.resolve(REPO_ROOT, statusPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      const temporary = `${resolved}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      fs.renameSync(temporary, resolved);
      return resolved;
    });

  const finish = (code) => {
    record.duration_seconds = round2((now() - startedMs) / 1000);
    writeLog(logPath, record);
    try {
      writeStatus(options.statusOut, traderStatus(record, { nowMs: now() }));
    } catch (error) {
      record.status_write_error = String(error.message || error).slice(0, 200);
    }
    return { code, record };
  };
  // A gate that refused: nothing could be read, so nothing was sent. The run fails loudly, because a loop
  // that cannot see the market is the one thing a reader has to be told about.
  const refuse = (status, reason) => {
    record.status = status;
    record.reason = reason;
    record.placements = [];
    return finish(1);
  };

  try {
    lock = acquireLock(lockPath, startedMs);
    if (!lock.acquired) {
      record.status = "skipped";
      record.reason = "another run holds the lock";
      record.lock_age_seconds = lock.ageMs === null ? null : Math.round(lock.ageMs / 1000);
      return finish(0);
    }
    record.stole_stale_lock = lock.stoleStaleLock === true;

    // A close is its own act, taken before the three artifacts and before the snapshot's freshness gate: the
    // instruction is to be out of a named ticket rather than to read the market, so a Layer 1 file that has
    // not refreshed or a snapshot a few minutes old is not a reason to refuse it. What is read either way is
    // the terminal's own account, and the ticket still has to be one of this loop's own: a working limit is
    // cancelled and a position is exited at the market, whichever the ticket turns out to be. Nothing else
    // happens this run - no review, no removal, no ticket - and --confirm-live still decides whether anything
    // is sent, so a run without it states the act and leaves the account alone.
    //
    // Two ways a person asks for that act. --close-ticket names the ticket on the command line; a row in the
    // dashboard's close-request log names it from the page's Open positions table. A run told which ticket to
    // take does not read the log, because it was given its instruction already; a run asked for neither reads
    // the log, and when a request is waiting it is answered instead of the market being judged.
    if (options.closeTicket !== null) {
      record.close_requests = {
        enabled: false,
        reason: "a hand run takes the ticket it names and reads no request log"
      };
      const act = takeTicketOut({
        options,
        record,
        statePath,
        state: deps.state,
        spawn,
        now,
        ticket: options.closeTicket,
        comment: `${COMMENT_PREFIX}hand`,
        request: null
      });
      // An unreadable terminal is the one outcome that fails the run loudly, the way it always has: a loop
      // that cannot see the account must not be quiet about it.
      if (act.outcome === "terminal_unreadable") return refuse("refused", act.reason);
      return finish(act.exitCode);
    }
    const asked = closeRequestStep({
      options,
      record,
      published,
      statePath,
      state: deps.state,
      spawn,
      now,
      exec: deps.exec || spawnSync
    });
    if (asked) {
      if (asked.outcome === "terminal_unreadable") return refuse("refused", asked.reason);
      return finish(asked.exitCode);
    }



    // Gate 1: the three artifacts, each read by name. A file that is not there or does not parse is a
    // refusal, and the reason names the path rather than saying "an artifact".
    let callsJson = null;
    let levelsJson = null;
    let feed = null;
    try {
      callsJson = readJson(callsPath);
    } catch (error) {
      return refuse("refused", `the Layer 1 calls could not be read from ${relativePath(callsPath)}: ${error.message}`);
    }
    try {
      levelsJson = readJson(levelsPath);
    } catch (error) {
      return refuse("refused", `the marked ladder could not be read from ${relativePath(levelsPath)}: ${error.message}`);
    }
    try {
      feed = readJson(feedPath);
    } catch (error) {
      return refuse("refused", `the snapshot could not be read from ${relativePath(feedPath)}: ${error.message}`);
    }

    // Gate 2: the snapshot has to be inside the freshness window it declares - the publisher's own gate, read
    // from the publisher rather than restated here. A stale snapshot is not a reading of the market, so
    // nothing is placed from it.
    const freshness = feedPublisher.feedFreshnessOk(feed, startedMs);
    const calls = readCalls(callsJson, startedMs);
    const joined = joinLevels(feed, levelsJson);
    record.snapshot = {
      generated_at_utc: feed?.generated_at_utc ?? null,
      age_seconds: freshness.ageSeconds,
      stale_after_seconds: feed?.stale_after_seconds ?? null,
      instruments: joined.instruments.length
    };
    record.levels_generated_at_utc = joined.levels_generated_at_utc;
    record.calls_generated_at_utc = calls.generated_at_utc;
    record.calls = calls.rows;
    if (!freshness.ok) return refuse("refused", `the snapshot is not fresh: ${freshness.reason}`);

    // Gate 3: the terminal itself, read read-only through the tool before anything is decided. This is where
    // the one-trade-per-pair and one-ticket-per-pair facts come from, read live rather than from a snapshot
    // that may be minutes old.
    const read = runTool(spawn, options, toolArgs("status", options));
    const live = liveFromStatus(read.record);
    if (!live) {
      record.terminal_read = {
        exit_code: read.exitCode,
        refused: read.record?.refused === true,
        message: read.record?.message ? String(read.record.message).slice(0, 300) : null,
        error: read.error
      };
      return refuse(
        "refused",
        `the terminal could not be read, so the account is unknown and nothing was sent: ${read.error || record.terminal_read.message || `the order tool exited ${read.exitCode}`}`
      );
    }
    record.terminal = {
      account: live.account?.login_masked ?? null,
      server: live.account?.server ?? null,
      positions_open: live.positions.length,
      orders_open: live.orders.length,
      ours: live.ours.length
    };

    // The rule, on the joined artifacts, with one instant handed to every pair so a bar that is still forming
    // is still forming for all four: the reading the page prints, from the module the page loads.
    const assetBySymbol = {};
    joined.instruments.forEach(instrument => {
      if (instrument?.symbol) assetBySymbol[instrument.symbol] = instrument.dashboard_asset || null;
    });
    const readings = strategy
      .strategyReadings({
        instruments: joined.instruments
          .filter(instrument => instrument?.available === true)
          .map(instrument => ({
            symbol: instrument.symbol,
            dashboard_asset: instrument.dashboard_asset,
            levels: instrument.levels,
            m5: instrument.m5,
            point: instrument.point
          })),
        positions: live.positions,
        calls: calls.directions,
        nowMs: startedMs
      })
      .map(row => ({ ...row, asset: assetBySymbol[row.symbol] ?? null }));

    const state = deps.state || readState(statePath);

    // The trade each pair already has on, read before anything is reviewed or placed: a working limit is judged
    // against the trade it was left for, and a trade still standing is what a ticket is put back at the level of,
    // rather than found by a fresh crossing. The account's own record of its closed trades is part of the read,
    // because a take-profit the market only had to touch is a fact no candle in this snapshot can state.
    const cycles = tradeCycles({
      state,
      directions: calls.directions,
      joined,
      closedTrades: Array.isArray(feed?.closed_trades) ? feed.closed_trades : []
    });

    // What this loop already has working, judged before anything new is placed: the entry stands while the call it
    // was left for stands and its target is still in front of the market, and a call that has ended or turned, a
    // target the account has answered, or a target the market has already reached with the entry still working are
    // the reasons to take it back out rather than leave it waiting on something that is gone. A plan-only run
    // reviews them too and sends nothing, so looking still cannot spend a signal bar.
    const pendings = reviewPendings({ live, joined, calls, cycles });
    const cancellations = [];
    for (const row of pendings.filter(entry => entry.decision === "cancel")) {
      const comment = `${COMMENT_PREFIX}${String(row.asset || row.symbol).toLowerCase()}`;
      if (!options.confirmLive) {
        cancellations.push({
          ...row,
          sent: false,
          cancelled: false,
          refused: false,
          planned: true,
          retcode_name: null,
          tool_exit: null,
          cancelled_at_utc: null,
          tool_reason: null
        });
        continue;
      }
      const args = toolArgs("cancel", options, [
        "--ticket", String(row.ticket),
        "--comment", comment,
        "--confirm-live"
      ]);
      const result = runTool(spawn, options, args);
      const answer = result.record?.answer || null;
      const cancelled = answer?.done === true;
      cancellations.push({
        ...row,
        sent: true,
        cancelled,
        refused: result.record?.refused === true,
        planned: false,
        retcode_name: answer?.retcode_name ?? null,
        tool_exit: result.exitCode,
        cancelled_at_utc: cancelled ? new Date(now()).toISOString() : null,
        tool_reason: cancelled ? null : (result.record?.message ? String(result.record.message).slice(0, 300) : result.error)
      });
    }
    // The positions this loop holds, judged on the same artifact and before anything new is placed: a position
    // whose pair's call has turned against it is exited at the market rather than left waiting on a direction
    // that is gone, which is the user's own instruction of 2026-10-06. This is the second kind of send this file
    // makes, and it goes through the tool's `close` with the same gates, the same journal and the same "only what
    // was sent is written down" rule as the removals above.
    const positionReview = reviewPositions({ live, joined, calls });
    const closes = [];
    for (const row of positionReview.filter(entry => entry.decision === "close")) {
      const comment = `${COMMENT_PREFIX}${String(row.asset || row.symbol).toLowerCase()}`;
      if (!options.confirmLive) {
        closes.push({
          ...row,
          sent: false,
          closed: false,
          refused: false,
          planned: true,
          retcode_name: null,
          tool_exit: null,
          closed_at_utc: null,
          tool_reason: null
        });
        continue;
      }
      const args = toolArgs("close", options, [
        "--ticket", String(row.ticket),
        "--comment", comment,
        "--confirm-live"
      ]);
      const result = runTool(spawn, options, args);
      const answer = result.record?.answer || null;
      const closed = answer?.done === true;
      closes.push({
        ...row,
        sent: true,
        closed,
        refused: result.record?.refused === true,
        planned: false,
        retcode_name: answer?.retcode_name ?? null,
        tool_exit: result.exitCode,
        closed_at_utc: closed ? new Date(now()).toISOString() : null,
        tool_reason: closed ? null : (result.record?.message ? String(result.record.message).slice(0, 300) : result.error)
      });
    }
    // The one amendment this loop makes to an open position, reviewed after the exits and before anything new is
    // placed: a trade that has run to twice the risk it was placed with has its stop taken to breakeven, once and
    // never again. A position this same run is already exiting is left to that exit rather than having its stop
    // moved on the way out, which is why the closing tickets are handed to the review rather than left to the
    // market to settle. This is the third kind of send this file makes, and it goes through the tool's `modify`
    // with the same gates, the same journal and the same "only what was sent is written down" rule as the two
    // above. A plan-only run states the move it would send and leaves the account and the state file alone.
    const breakeven = breakevenReview({
      live,
      joined,
      state,
      closing: positionReview.filter(row => row.decision === "close").map(row => row.ticket)
    });
    const moves = [];
    for (const row of breakeven.filter(entry => entry.decision === "move")) {
      const comment = `${COMMENT_PREFIX}${String(row.asset || row.symbol).toLowerCase()}`;
      if (!options.confirmLive) {
        moves.push({
          ...row,
          comment,
          sent: false,
          moved: false,
          refused: false,
          planned: true,
          retcode_name: null,
          tool_exit: null,
          moved_at_utc: null,
          tool_reason: null
        });
        continue;
      }
      const args = toolArgs("modify", options, [
        "--ticket", String(row.ticket),
        "--stop-loss", String(row.new_stop),
        "--comment", comment,
        "--confirm-live"
      ]);
      const result = runTool(spawn, options, args);
      const answer = result.record?.answer || null;
      const moved = answer?.done === true;
      moves.push({
        ...row,
        comment,
        sent: true,
        moved,
        refused: result.record?.refused === true,
        planned: false,
        retcode_name: answer?.retcode_name ?? null,
        tool_exit: result.exitCode,
        moved_at_utc: moved ? new Date(now()).toISOString() : null,
        tool_reason: moved ? null : (result.record?.message ? String(result.record.message).slice(0, 300) : result.error)
      });
    }

    // A ticket just taken out of the market is not working any more, so the caps and the one-ticket-per-pair
    // hold are judged on the account without it - in this same run, so the slot it held is free for a fresh
    // signal rather than a bar later. A position being exited is left in that read on purpose: the pair's own
    // trade has ended on the call reading, so nothing is put back at its level, and the account itself is what
    // says the position has gone on the next run rather than a send this run that may not have landed yet.
    const removed = new Set(cancellations.filter(row => row.cancelled).map(row => row.ticket));
    const liveAfterReview = { ...live, ours: live.ours.filter(row => !removed.has(row?.ticket)) };
    const decision = decide({ readings, state, live: liveAfterReview, options, nowMs: startedMs, cycles });
    record.rule = {
      ...strategy.strategySummary(readings),
      taken_today: decision.taken_today,
      reentries_today: decision.reentries_today,
      open_tickets: decision.open_tickets,
      ours: decision.ours,
      rows: decision.rows
    };
    // The trades themselves, stated once per pair rather than only inside the rows: what each pair was triggered
    // at, what it is aiming at, and which of the endings the user stated has answered it or not.
    record.trades = {
      count: cycles.size,
      rows: Array.from(cycles.values()).map(tradeSummary)
    };

    // The review of what was already working, stated in the log rather than left as only an effect: every
    // working limit this loop owns carries the decision it got and the reason for it, and every removal carries
    // the tool's own answer. The positions it holds are stated the same way beside them.
    record.pendings = {
      reviewed: pendings.length,
      rows: pendings,
      cancellations
    };
    record.positions = {
      reviewed: positionReview.length,
      rows: positionReview,
      closes
    };
    // The stop adjustments this same review produced: every open position this loop holds carries the decision it
    // got and the reason for it, and every move carries the tool's own answer beside the level it asked for.
    record.breakeven = {
      reviewed: breakeven.length,
      rows: breakeven,
      moves
    };



    // One ticket per candidate, in the order the page lists the pairs, and nothing else. A plan-only run
    // states the ticket it would send and leaves the state file untouched, so that looking cannot spend a
    // signal bar.
    const placements = [];
    const attempted = [];

    for (const row of decision.candidates) {
      const comment = `${COMMENT_PREFIX}${String(row.asset || row.symbol).toLowerCase()}`;
      const ticket = {
        symbol: row.symbol,
        asset: row.asset,
        side: row.side,
        signal_time_utc: row.confirmation_time_utc,
        level: row.level,
        entry: row.entry,
        stop: row.stop,
        target: row.target,
        risk: row.risk,
        r_multiple: row.r_multiple,
        expire_minutes: options.expireMinutes,
        comment
      };
      // A re-entry is the same trade put back at the level it was triggered on rather than a trade of its own, so
      // it is written down as one: the day's count of trades leaves it out, and a reader of the state file can tell
      // the two apart. Nothing is written when it is not one, the way this file writes only what is new.
      if (row.reentry === true) ticket.reentry = true;
      if (!options.confirmLive) {
        placements.push({ ...ticket, sent: false, placed: false, refused: false, planned: true });
        continue;
      }
      // No --lots and no --max-lots: the tool's own default is the symbol's volume_min, so the smallest size
      // the instrument accepts is what is placed. No --expire-minutes either unless a hand run asked for one:
      // the level is permanent, so the entry stands until its take-profit is taken or the call changes
      // direction, and the review above is what removes it on those readings.
      const openArgs = [
        "--symbol", row.symbol,
        "--side", row.side === "short" ? "sell" : "buy",
        "--entry-price", String(row.entry),
        "--stop-loss", String(row.stop),
        "--take-profit", String(row.target)
      ];
      if (options.expireMinutes) openArgs.push("--expire-minutes", String(options.expireMinutes));
      openArgs.push("--comment", comment, "--confirm-live");
      const args = toolArgs("open", options, openArgs);
      const result = runTool(spawn, options, args);
      const answer = result.record?.answer || null;
      const placed = answer?.done === true;
      const attempt = {
        ...ticket,
        sent: true,
        placed,
        refused: result.record?.refused === true,
        retcode_name: answer?.retcode_name ?? null,
        order_ticket: answer?.order ?? null,
        deal: answer?.deal ?? null,
        tool_exit: result.exitCode,
        placed_at_utc: placed ? new Date(now()).toISOString() : null,
        reason: placed ? null : (result.record?.message ? String(result.record.message).slice(0, 300) : result.error)
      };
      placements.push(attempt);
      // Every attempt is written down, placed or not, so that the signal bar is spent once and the next run
      // cannot place the same ticket a second time.
      attempted.push(attempt);
    }

    // Only a removal or an exit that was actually sent is written down: a plan-only run's review is a statement
    // about what it would do, and looking must not leave a mark on the state any more than it spends a signal bar.
    // A stop move is written down on a stricter rule again - only when the terminal answered that it landed - because
    // that row is what spends the rule's one rung: a request the terminal rejected must not read on the next run as
    // a stop that has already been taken to breakeven, or the trade would keep the stop it was placed with for good.
    const sentCancellations = cancellations.filter(row => row.sent);
    const sentCloses = closes.filter(row => row.sent);
    const landedMoves = moves.filter(row => row.moved);
    if (attempted.length || sentCancellations.length || sentCloses.length || landedMoves.length) {
      state.placements = state.placements.concat(attempted);
      state.cancellations = (state.cancellations || []).concat(sentCancellations);
      state.closes = (state.closes || []).concat(sentCloses);
      state.moves = (state.moves || []).concat(landedMoves);
      writeState(statePath, state);
    }
    record.state = {
      path: relativePath(statePath),
      written: attempted.length > 0 || sentCancellations.length > 0 || sentCloses.length > 0 || landedMoves.length > 0,
      held: state.placements.length,
      cancellations_held: (state.cancellations || []).length,
      closes_held: (state.closes || []).length,
      moves_held: (state.moves || []).length
    };
    record.placements = placements;

    const sent = attempted.filter(row => row.sent);
    const landed = sent.filter(row => row.placed);
    const failed = sent.filter(row => !row.placed && !row.refused);
    const removedNow = cancellations.filter(row => row.cancelled);
    // A removal that was sent and did not land leaves the limit working on nothing, which is worth failing
    // loudly for rather than reporting as a quiet no-op.
    const removeFailed = cancellations.filter(row => row.sent && !row.cancelled && !row.refused);
    const closedNow = closes.filter(row => row.closed);
    // An exit that was sent and did not land leaves a position this loop meant to be out of, which is worth
    // failing as loudly for as a removal that did not land.
    const closeFailed = closes.filter(row => row.sent && !row.closed && !row.refused);
    // A stop move that was sent and did not land leaves a trade carrying the stop it was placed with after this
    // loop told the terminal to move it, which is the same kind of silence and fails the same way.
    const moveFailed = moves.filter(row => row.sent && !row.moved && !row.refused);
    const movedNow = moves.filter(row => row.moved);
    // A move the tool refused is the market saying no rather than a cadence that has broken, the way a refused
    // placement is: the row states the tool's own reason, nothing was changed on the account, and the rung is not
    // spent - the trade keeps the stop it was placed with and the next run asks again.
    const refusedMoves = moves.filter(row => row.refused);

    if (!options.confirmLive) {
      record.status = "planned";
      record.reason = "not armed: --confirm-live was not passed, so nothing was sent and no signal bar was spent.";
      return finish(0);
    }
    if (failed.length || removeFailed.length || closeFailed.length || moveFailed.length) {
      record.status = "send_failed";
      record.reason = `${failed.length} ticket(s) were sent and did not land, ${removeFailed.length} removal(s) did not land, ${closeFailed.length} exit(s) did not land and ${moveFailed.length} stop move(s) did not land; the order tool's own journal holds the terminal's answers.`;
      return finish(1);
    }
    if (landed.length) {
      record.status = "placed";
      return finish(0);
    }
    if (removedNow.length) {
      record.status = "cancelled";
      record.reason = `${removedNow.length} working limit(s) were taken back out because the reason for them had gone, and nothing was placed this run.`;
      return finish(0);
    }
    if (closedNow.length) {
      record.status = "closed";
      record.reason = `${closedNow.length} position(s) were exited because the call they were opened for had turned against them, and nothing was placed this run.`;
      return finish(0);
    }
    if (movedNow.length) {
      record.status = "stop_moved";
      record.reason = `${movedNow.length} position(s) had their stop taken to breakeven at twice the risk they were placed with, and nothing was placed or taken out this run.`;
      return finish(0);
    }
    if (refusedMoves.length) {
      record.status = "refused";
      record.reason = `${refusedMoves.length} stop move(s) were refused before anything was sent, so no stop was moved and no rung was spent; the row states the tool's own reason, and nothing was placed or taken out this run.`;
      return finish(0);
    }
    if (attempted.length) {
      // A guard's refusal is the market saying no rather than a broken cadence: each row carries the tool's
      // own reason, and reading the market and refusing to trade it is the loop doing its job.
      record.status = "refused";
      record.reason = "every ticket this run would have placed was refused before anything was sent.";
      return finish(0);
    }
    record.status = "nothing_to_place";
    record.reason = "no pair was left a ticket this run: every row states why, whether that is the rule, the account or the market.";
    return finish(0);
  } catch (error) {
    // Whatever went wrong, the log is the evidence: a run that dies quietly is worse than a run that fails
    // loudly.
    record.status = "error";
    record.error = String(error?.message || error).slice(0, 200);
    return finish(1);
  } finally {
    releaseLock(lock);
  }
}

async function runLoop(options, deps = {}) {
  const now = deps.now || (() => Date.now());
  const wait = deps.sleep || sleep;
  // One run now, then one per bar close: a cadence that starts by waiting five minutes is a cadence nobody
  // sees working on the day it is switched on.
  for (;;) {
    const { record } = runOnce(options, deps);
    if (!options.quiet) process.stdout.write(`${formatRunRecord(record)}\n`);
    const target = nextRunAt(now(), options.intervalSeconds, options.settleSeconds);
    if (!options.quiet) process.stdout.write(`${JSON.stringify({ next_run_at_utc: new Date(target).toISOString() })}\n`);
    await wait(target - now());
  }
}

async function main(argv = process.argv.slice(2), deps = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  if (options.mode === "loop") return runLoop(options, deps);

  if (options.align) {
    const now = deps.now || (() => Date.now());
    const wait = deps.sleep || sleep;
    await wait(nextRunAt(now(), options.intervalSeconds, options.settleSeconds) - now());
  }

  const { code, record } = runOnce(options, deps);
  if (!options.quiet) process.stdout.write(`${formatRunRecord(record)}\n`);
  return code;
}

module.exports = {
  REPO_ROOT,
  ORDER_TOOL_RELATIVE,
  CALLS_RELATIVE,
  LEVELS_RELATIVE,
  FEED_RELATIVE,
  DEFAULT_LOG,
  DEFAULT_LOCK,
  DEFAULT_STATE,
  DEFAULT_JOURNAL,
  DEFAULT_INTERVAL_SECONDS,
  DEFAULT_SETTLE_SECONDS,
  DEFAULT_EXPIRE_MINUTES,
  DEFAULT_MAX_OPEN,
  DEFAULT_MAX_PER_DAY,
  BREAKEVEN_R_MULTIPLE,
  ORDER_MAGIC,
  COMMENT_PREFIX,
  USAGE,
  UsageError,
  parseArgs,
  nextRunAt,
  resolvePublishedDir,
  layer1Validity,
  layer1Call,
  readCalls,
  levelsFor,
  joinLevels,
  pendingDirection,
  rowDirection,
  exitPriceFor,
  marketHasReached,
  closedAtItsTarget,
  exitEnding,
  traderStatus,
  tradeCycles,
  reviewPendings,
  reviewPositions,
  movedTickets,
  placementRisk,
  breakevenReview,
  parseToolRecord,
  liveFromStatus,
  readState,
  writeState,
  signalKey,
  takenSignals,
  TRADE_DAY_TIMEZONE,
  tradeDayKey,
  placementsToday,
  reentriesToday,
  decide,
  formatRunRecord,
  appendLog,
  acquireLock,
  runOnce,
  main
};

if (require.main === module) {
  main().then(
    (code) => {
      process.exit(code);
    },
    (error) => {
      process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
      process.exit(1);
    }
  );
}
