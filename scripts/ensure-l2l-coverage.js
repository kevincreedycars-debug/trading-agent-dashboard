// Keep the published L2L ladder in front of price, for every instrument in the file.
//
//   node scripts/ensure-l2l-coverage.js                 report coverage, write nothing
//   node scripts/ensure-l2l-coverage.js --write         extend the file where a side is short of ten levels
//
// The rule the user set on 21 November 2026 is a floor, not a depth: at least ten full L2L lines above the
// live price and ten below, on EURUSD, XAUUSD, US100.cash and BTCUSD. The lines are the same measurement the
// hand-marked seeds define - one distance repeated above the top seed and below the bottom one - extended
// only as far as the current price requires. Existing lines are never moved, renamed or removed, so a price
// that a working order, a position or a recorded signal references stays in the file exactly as it was.
//
// The price each symbol is judged against is the freshest read the feed carries: the mid of the quote when
// both sides are there, else the bid, else the last, else the newest M5 close. That is the same reading the
// dashboard's ladder alert uses, so the page and the file cannot disagree about where price is.
//
// Nothing here reads an account, places an order or touches a terminal. It reads the feed and the levels
// artifact, extends the artifact's arithmetic, and records what it did in the log named below.
const fs = require("fs");
const path = require("path");

const coverage = require("../lib/l2l_coverage.js");
const levelsStore = require("../lib/l2l_levels_store.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_LEVELS = "data/l2l-levels.json";
const DEFAULT_FEED = "data/live-trading.json";
const DEFAULT_LOG = "tmp/l2l-coverage.log";
const RUNNER = "scripts/ensure-l2l-coverage.js";

const USAGE = [
  "Keep the published L2L ladder at least ten full levels above and below price, per instrument.",
  "",
  "  node scripts/ensure-l2l-coverage.js [options]",
  "",
  "  --levels <path>            levels artifact (default data/l2l-levels.json)",
  "  --feed <path>              snapshot the prices are read from (default data/live-trading.json)",
  "  --prices <SYMBOL=PRICE>    a price to use instead of the feed's, repeatable and comma separated",
  "  --now <iso>                the instant stamped on generated levels (default: now)",
  "  --lane <id>                lane named in the report and the log (default: none)",
  "  --log <path>               where each run is recorded (default tmp/l2l-coverage.log)",
  "  --write                    write the extended file (default: report only)",
  "  --help                     this text",
  "",
  "Exit 0 when every instrument is covered, 1 when one is not, 2 on a usage or read error."
].join("\n");

function positiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

// A hand-supplied price list: `SYMBOL=PRICE`, repeatable and comma separated, so a test or a hand run can
// judge coverage at any price without waiting for the feed to quote it.
function parsePrices(entries) {
  const prices = {};
  for (const entry of entries) {
    for (const pair of String(entry).split(",")) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const [symbol, price] = trimmed.split("=");
      const value = positiveNumber(price);
      if (!symbol || !trimmed.includes("=") || value === null) {
        throw new Error(`--prices expects SYMBOL=PRICE, not ${JSON.stringify(pair)}`);
      }
      prices[symbol.trim()] = value;
    }
  }
  return prices;
}

function parseArgs(argv) {
  const options = {
    levels: DEFAULT_LEVELS,
    feed: DEFAULT_FEED,
    prices: {},
    now: null,
    lane: null,
    log: DEFAULT_LOG,
    write: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${token} needs a value`);
      index += 1;
      return value;
    };
    switch (token) {
      case "--levels":
        options.levels = next();
        break;
      case "--feed":
        options.feed = next();
        break;
      case "--prices":
        Object.assign(options.prices, parsePrices([next()]));
        break;
      case "--now":
        options.now = next();
        break;
      case "--lane":
        options.lane = next();
        break;
      case "--log":
        options.log = next();
        break;
      case "--write":
        options.write = true;
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unrecognised argument: ${token}`);
    }
  }
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/") || absolutePath;
}

function appendLog(logPath, record) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, "utf8");
}

// One instrument's row: what the file held, what the price asked of it, what was added, and the two facts a
// reader needs if it failed - the asset and the reason. `lane` is carried on every row because a failure is
// reported per lane on the page and in the trader's log, and the same instrument can be covered on one
// account and short on another.
function coverageRow(instrument, feedInstrument, price, options) {
  const symbol = instrument?.symbol ?? null;
  const result = coverage.ensureCoverage({
    levels: instrument?.levels,
    price,
    point: positiveNumber(feedInstrument?.point),
    symbol,
    nowUtc: options.nowUtc,
    retainPrices: options.retainPrices
  });
  const status = !result.ok ? "failed" : result.changed ? "extended" : "covered";
  return {
    symbol,
    asset: instrument?.dashboard_asset ?? feedInstrument?.dashboard_asset ?? null,
    lane: options.lane ?? null,
    status,
    price: result.price,
    anchor_high: result.anchorHigh,
    anchor_low: result.anchorLow,
    anchor_source: result.anchorSource,
    spacing: result.spacing,
    above: result.after ? result.after.above : (result.before ? result.before.above : null),
    below: result.after ? result.after.below : (result.before ? result.before.below : null),
    min_per_side: coverage.MIN_LEVELS_PER_SIDE,
    covered: result.ok === true && result.after ? result.after.covered : false,
    added_above: result.addedAbove,
    added_below: result.addedBelow,
    next_above: result.after ? result.after.nextAbove : null,
    next_below: result.after ? result.after.nextBelow : null,
    range: result.range,
    available_at_utc: result.changed ? result.generatedAtUtc : null,
    reason: result.reason,
    result
  };
}

// The whole run over a levels document and a feed. Pure apart from the clock: it returns the document it
// would write rather than writing it, so the trader can judge coverage in memory on a tick and the feed
// cadence can write the same answer to the file.
function planCoverage({ state, feed, prices = {}, nowUtc, lane = null, retainPrices = null } = {}) {
  const levelsState = state && typeof state === "object" ? state : null;
  if (!levelsState || !Array.isArray(levelsState.instruments)) {
    return {
      ok: false,
      rows: [],
      failures: [{ symbol: null, asset: null, lane, reason: "the levels document carries no instruments" }],
      changed: false,
      state
    };
  }
  const feedBySymbol = {};
  (Array.isArray(feed?.instruments) ? feed.instruments : []).forEach(instrument => {
    if (instrument && typeof instrument.symbol === "string") feedBySymbol[instrument.symbol] = instrument;
  });

  const rows = [];
  const nextState = {
    ...levelsState,
    instruments: levelsState.instruments.map(instrument => ({
      ...instrument,
      levels: Array.isArray(instrument.levels) ? instrument.levels.slice() : []
    }))
  };
  let changed = false;

  nextState.instruments.forEach((instrument, index) => {
    const feedInstrument = feedBySymbol[instrument.symbol] || null;
    const price = prices[instrument.symbol] !== undefined
      ? positiveNumber(prices[instrument.symbol])
      : coverage.priceFromInstrument(feedInstrument);
    const row = coverageRow(instrument, feedInstrument, price, {
      nowUtc,
      lane,
      retainPrices: Array.isArray(retainPrices) ? retainPrices : null
    });
    if (price === null && !row.reason) {
      row.reason = `no ${instrument.symbol} price is readable from the feed, so coverage cannot be judged`;
      row.status = "failed";
    }
    const { result, ...published } = row;
    rows.push(published);
    if (result.ok && result.changed) {
      nextState.instruments[index].levels = result.levels;
      nextState.instruments[index].coverage = {
        checked_at_utc: result.generatedAtUtc,
        price: result.price,
        anchor_high: result.anchorHigh,
        anchor_low: result.anchorLow,
        spacing: result.spacing,
        above: result.after.above,
        below: result.after.below,
        added_above: result.addedAbove,
        added_below: result.addedBelow,
        range: result.range,
        source: RUNNER
      };
      changed = true;
    }
    if (result.ok && (result.retained.missing || []).length) {
      nextState.instruments[index].coverage = {
        ...(nextState.instruments[index].coverage || {}),
        retained_missing: result.retained.missing,
        source: RUNNER
      };
      changed = true;
    }
  });

  if (changed) {
    nextState.generated_at_utc = nowUtc;
    nextState.marked_by = coverage.GENERATED_MARKED_BY;
  }
  const failures = rows.filter(row => row.status === "failed").map(row => ({
    symbol: row.symbol,
    asset: row.asset,
    lane: row.lane,
    reason: row.reason
  }));
  return { ok: failures.length === 0, rows, failures, changed, state: changed ? nextState : levelsState };
}


// The file is replaced by a rename of a fully written neighbour, so a crash mid-write cannot leave the
// published ladder half extended.
function writeStateAtomic(filePath, state) {
  const resolved = path.resolve(filePath);
  const text = levelsStore.serialiseState(state);
  const temporary = `${resolved}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(temporary, text, "utf8");
  fs.renameSync(temporary, resolved);
}

function writePlan(filePath, plan) {
  if (!plan || plan.changed !== true) return { written: false, errors: [] };
  const errors = levelsStore.validateLevelsState(plan.state);
  if (errors.length) return { written: false, errors };
  writeStateAtomic(filePath, plan.state);
  return { written: true, errors: [] };
}

function main(argv = process.argv.slice(2), deps = {}) {
  const now = deps.now || (() => Date.now());
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const levelsPath = path.resolve(REPO_ROOT, options.levels);
  const feedPath = path.resolve(REPO_ROOT, options.feed);
  const logPath = path.resolve(REPO_ROOT, options.log);
  let state;
  let feed;
  try {
    state = readJson(levelsPath);
  } catch (error) {
    process.stderr.write(`the levels file could not be read from ${relativePath(levelsPath)}: ${error.message}\n`);
    return 2;
  }
  try {
    feed = readJson(feedPath);
  } catch (error) {
    // A missing feed is not a reason to invent prices: without one there is nothing to judge coverage against.
    process.stderr.write(`the snapshot could not be read from ${relativePath(feedPath)}: ${error.message}\n`);
    return 2;
  }

  const requestedNow = options.now ? Date.parse(options.now) : Number.NaN;
  const nowUtc = Number.isFinite(requestedNow) ? new Date(requestedNow).toISOString() : new Date(now()).toISOString();
  const plan = planCoverage({
    state,
    feed,
    prices: options.prices,
    nowUtc,
    lane: options.lane
  });

  let written = false;
  let validationErrors = [];
  if (options.write && plan.changed) {
    const write = writePlan(levelsPath, plan);
    written = write.written;
    validationErrors = write.errors;
  }

  const record = {
    at_utc: nowUtc,
    runner: RUNNER,
    lane: options.lane,
    levels: relativePath(levelsPath),
    feed: relativePath(feedPath),
    write: options.write === true,
    written,
    changed: plan.changed,
    ok: plan.ok && validationErrors.length === 0,
    rows: plan.rows,
    failures: plan.failures,
    validation_errors: validationErrors
  };
  try {
    appendLog(logPath, record);
  } catch (error) {
    process.stderr.write(`the coverage log could not be written to ${relativePath(logPath)}: ${error.message}\n`);
  }

  const printable = {
    ...record,
    rows: record.rows.map(({ result, ...row }) => row)
  };
  process.stdout.write(`${JSON.stringify(printable, null, 2)}\n`);
  return record.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  REPO_ROOT,
  DEFAULT_LEVELS,
  DEFAULT_FEED,
  DEFAULT_LOG,
  RUNNER,
  MIN_LEVELS_PER_SIDE: coverage.MIN_LEVELS_PER_SIDE,
  USAGE,
  parsePrices,
  parseArgs,
  coverageRow,
  planCoverage,
  writeStateAtomic,
  writePlan,
  main
};

