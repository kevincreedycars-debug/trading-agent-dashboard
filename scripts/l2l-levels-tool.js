// The L2L level marking tool, and the guard for the artifact it writes.
//
// Two roles, one script, because the artifact and its writer have to agree exactly:
//
//   node scripts/l2l-levels-tool.js                 serve the dashboard locally and accept marked levels
//   node scripts/l2l-levels-tool.js --check <path>  validate data/l2l-levels.json and exit non-zero on failure
//
// The published dashboard is static and read-only, so marking cannot happen on the published page. This
// script is the only writer of `data/l2l-levels.json`: it serves the repo on 127.0.0.1, the dashboard
// notices the write endpoint, and a click on the mirrored chart posts a level back. The published page
// then reads the committed file and draws the same lines. It has no order path and touches no broker
// data: the whole artifact is prices the user marked by hand.
const fs = require("fs");
const http = require("http");
const path = require("path");

const SCHEMA_VERSION = "l2l-levels-v1";
const DEFAULT_STATE_PATH = "data/l2l-levels.json";
const DEFAULT_PORT = 8788;
const ALLOWED_KINDS = ["l2l", "half-l2l", "level"];
const ALLOWED_DIRECTIONS = ["long", "short", "both"];
const ALLOWED_ACTIONS = ["add", "remove"];
const DEFAULT_TIMEFRAME = "M5";
const MAX_BODY_BYTES = 64 * 1024;
// The four instruments the live feed publishes, in dashboard order. The file starts with all four and
// empty level lists so nothing downstream has to guess whether a symbol was never marked or was dropped.
const KNOWN_INSTRUMENTS = [
  { symbol: "EURUSD", dashboard_asset: "EUR" },
  { symbol: "XAUUSD", dashboard_asset: "GOLD" },
  { symbol: "US100.cash", dashboard_asset: "NQ" },
  { symbol: "BTCUSD", dashboard_asset: "BTC" }
];

const PRICE_TOLERANCE = 1e-9;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isTimestamp(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function roundPrice(value) {
  return Number(Number(value).toFixed(6));
}

function createEmptyState(nowIso) {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at_utc: nowIso,
    marked_by: "local marking tool (scripts/l2l-levels-tool.js)",
    note: "L2L level prices marked by the user on the local mirrored MT5 chart. The local tool is the only writer; the published dashboard only reads this file. Empty instruments mean nothing has been marked for that symbol yet, which is not an error.",
    instrument_count: KNOWN_INSTRUMENTS.length,
    instruments: KNOWN_INSTRUMENTS.map(entry => ({
      symbol: entry.symbol,
      dashboard_asset: entry.dashboard_asset,
      levels: []
    }))
  };
}

function stateInstrumentMap(state) {
  const map = {};
  (Array.isArray(state?.instruments) ? state.instruments : []).forEach(entry => {
    if (entry && typeof entry.symbol === "string") map[entry.symbol] = entry;
  });
  return map;
}

// A marking click arrives as a small JSON body. Everything is checked here rather than in the browser,
// because this is the file that ends up committed.
function normaliseEdit(body, nowIso) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Request body must be a JSON object" };
  }
  const action = body.action === undefined ? "add" : body.action;
  if (!ALLOWED_ACTIONS.includes(action)) {
    return { error: `action must be one of ${ALLOWED_ACTIONS.join(", ")}` };
  }
  const symbol = typeof body.symbol === "string" ? body.symbol.trim() : "";
  if (!symbol) return { error: "symbol is required" };
  if (!Object.prototype.hasOwnProperty.call(stateInstrumentMap(createEmptyState(nowIso)), symbol)) {
    return { error: `unknown symbol: ${symbol}` };
  }
  const price = roundPrice(Number(body.price));
  if (!isFiniteNumber(price) || price <= 0) return { error: "price must be a positive number" };

  if (action === "remove") {
    return { edit: { action, symbol, price, at: nowIso } };
  }

  const kind = body.kind === undefined || body.kind === "" ? "l2l" : String(body.kind);
  if (!ALLOWED_KINDS.includes(kind)) {
    return { error: `kind must be one of ${ALLOWED_KINDS.join(", ")}` };
  }
  const direction = body.direction === undefined || body.direction === "" ? "both" : String(body.direction);
  if (!ALLOWED_DIRECTIONS.includes(direction)) {
    return { error: `direction must be one of ${ALLOWED_DIRECTIONS.join(", ")}` };
  }
  const timeframe = body.timeframe === undefined || body.timeframe === "" ? DEFAULT_TIMEFRAME : String(body.timeframe);
  const label = body.label === undefined || body.label === "" ? `${kind} ${price}` : String(body.label);
  const note = body.note === undefined ? "" : String(body.note);

  return {
    edit: {
      action,
      symbol,
      price,
      at: nowIso,
      level: {
        label,
        price,
        kind,
        direction,
        timeframe,
        marked_at_utc: nowIso,
        marked_by: "dashboard marking tool",
        note
      }
    }
  };
}

// Adding the same price twice replaces that level instead of stacking duplicates, so a mis-click costs
// one more click rather than a second line on the chart at the same price. Every entry is rebuilt from
// KNOWN_INSTRUMENTS, so the file always carries all four symbols in dashboard order.
function applyLevelEdit(state, edit, nowIso) {
  const base = state && typeof state === "object" ? state : createEmptyState(nowIso);
  const previous = stateInstrumentMap(base);
  const instruments = KNOWN_INSTRUMENTS.map(entry => {
    const existing = previous[entry.symbol];
    return {
      symbol: entry.symbol,
      dashboard_asset: entry.dashboard_asset,
      levels: Array.isArray(existing?.levels)
        ? existing.levels.filter(level => isFiniteNumber(level?.price) && Number(level.price) > 0)
        : []
    };
  });
  const target = instruments.find(entry => entry.symbol === edit.symbol);
  const matchIndex = target.levels.findIndex(level => Math.abs(Number(level.price) - edit.price) <= PRICE_TOLERANCE);

  if (edit.action === "remove") {
    if (matchIndex === -1) return { error: `no level marked at ${edit.price} for ${edit.symbol}` };
    target.levels.splice(matchIndex, 1);
  } else if (matchIndex === -1) {
    target.levels.push({ ...edit.level });
  } else {
    target.levels[matchIndex] = { ...edit.level };
  }
  target.levels.sort((a, b) => Number(b.price) - Number(a.price));

  return {
    state: {
      schema_version: SCHEMA_VERSION,
      generated_at_utc: nowIso,
      marked_by: "local marking tool (scripts/l2l-levels-tool.js)",
      note: base.note || createEmptyState(nowIso).note,
      instrument_count: instruments.length,
      instruments
    }
  };
}

function serialiseState(state) {
  return `${JSON.stringify(state, null, 2)}\n`;
}

function readState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

// The published reader trusts this file, so the same rules the tool enforces on the way in are checked
// on the way out. Nothing here is a trading rule: it is shape, provenance and duplicate protection.
function validateLevelsState(state) {
  const errors = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return ["Levels artifact must be a JSON object"];
  }
  if (state.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (!isTimestamp(state.generated_at_utc)) errors.push("generated_at_utc must be a parseable timestamp");
  if (typeof state.marked_by !== "string" || !state.marked_by) errors.push("marked_by must name the writer");
  if (typeof state.note !== "string" || !state.note) {
    errors.push("note must explain that the tool is the only writer and the dashboard only reads");
  }
  if (!Array.isArray(state.instruments)) {
    errors.push("instruments must be an array");
    return errors;
  }
  if (state.instrument_count !== state.instruments.length) {
    errors.push("instrument_count must equal the number of instrument entries");
  }

  const seenSymbols = new Set();
  state.instruments.forEach((instrument, index) => {
    const where = `instruments[${index}]`;
    if (!instrument || typeof instrument !== "object") {
      errors.push(`${where} must be an object`);
      return;
    }
    const symbol = typeof instrument.symbol === "string" ? instrument.symbol : "";
    if (!symbol) errors.push(`${where} requires a symbol`);
    if (seenSymbols.has(symbol)) errors.push(`Duplicate instrument entry: ${symbol}`);
    seenSymbols.add(symbol);
    if (typeof instrument.dashboard_asset !== "string" || !instrument.dashboard_asset) {
      errors.push(`Instrument ${symbol || where} requires dashboard_asset`);
    }
    if (!Array.isArray(instrument.levels)) {
      errors.push(`Instrument ${symbol || where} requires a levels array (empty when nothing is marked)`);
      return;
    }
    const seenPrices = new Set();
    instrument.levels.forEach((level, levelIndex) => {
      const at = `${symbol || where}.levels[${levelIndex}]`;
      if (!level || typeof level !== "object") {
        errors.push(`${at} must be an object`);
        return;
      }
      // Strictly a JSON number: the tool always writes one, so a quoted price means a hand edit.
      const price = Number(level.price);
      if (!isFiniteNumber(level.price) || price <= 0) errors.push(`${at} requires a positive numeric price`);
      if (seenPrices.has(price)) errors.push(`${at} duplicates the price ${price} already marked for ${symbol}`);
      seenPrices.add(price);
      if (!ALLOWED_KINDS.includes(level.kind)) errors.push(`${at} kind must be one of ${ALLOWED_KINDS.join(", ")}`);
      if (!ALLOWED_DIRECTIONS.includes(level.direction)) {
        errors.push(`${at} direction must be one of ${ALLOWED_DIRECTIONS.join(", ")}`);
      }
      if (typeof level.timeframe !== "string" || !level.timeframe) errors.push(`${at} requires a timeframe`);
      if (typeof level.label !== "string" || !level.label) errors.push(`${at} requires a label`);
      if (!isTimestamp(level.marked_at_utc)) errors.push(`${at} requires a parseable marked_at_utc`);
      if (typeof level.marked_by !== "string" || !level.marked_by) errors.push(`${at} requires marked_by`);
    });
  });

  return errors;
}

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8"
};

// The marker header is how the dashboard recognises a local tool rather than the published static host.
// Marking controls stay hidden everywhere else, so the published page can never look like it writes.
function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-L2L-Levels-Tool": "1"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
    });
    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });
}

function serveStatic(root, routePath, response) {
  const rootResolved = path.resolve(root);
  const relative = routePath === "/" || routePath === "" ? "index.html" : routePath.replace(/^\/+/, "");
  const resolved = path.resolve(rootResolved, relative);
  // A loopback dev server still must not serve anything outside the repo root it was pointed at.
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    sendJson(response, 403, { ok: false, error: "Path outside the served root" });
    return;
  }
  let target = resolved;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    sendJson(response, 404, { ok: false, error: `Not found: ${routePath}` });
    return;
  }
  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  response.end(fs.readFileSync(target));
}

function startServer(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, ".."));
  const statePath = path.resolve(options.statePath || path.join(root, DEFAULT_STATE_PATH));
  const host = options.host || "127.0.0.1";
  // Port 0 is a real request (let the OS choose) and is how the tests avoid colliding with a running tool.
  const port = Number.isFinite(Number(options.port)) ? Number(options.port) : DEFAULT_PORT;
  const now = options.now || (() => new Date().toISOString());

  if (!fs.existsSync(statePath)) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, serialiseState(createEmptyState(now())));
  }

  const server = http.createServer(async (request, response) => {
    let route;
    try {
      route = new URL(request.url, `http://${host}`).pathname;
    } catch (error) {
      sendJson(response, 400, { ok: false, error: "Unparseable request URL" });
      return;
    }

    if (route === "/api/l2l-levels") {
      if (request.method === "GET") {
        try {
          sendJson(response, 200, {
            ok: true,
            tool: "l2l-levels-tool",
            state_path: path.relative(root, statePath).replace(/\\/g, "/"),
            state: readState(statePath)
          });
        } catch (error) {
          sendJson(response, 500, { ok: false, error: `Cannot read the levels file: ${error.message}` });
        }
        return;
      }
      if (request.method === "POST") {
        let body;
        try {
          body = JSON.parse((await readBody(request)) || "{}");
        } catch (error) {
          sendJson(response, 400, { ok: false, error: "Request body must be JSON" });
          return;
        }
        const stamp = now();
        const parsed = normaliseEdit(body, stamp);
        if (parsed.error) {
          sendJson(response, 400, { ok: false, error: parsed.error });
          return;
        }
        let current;
        try {
          current = readState(statePath);
        } catch (error) {
          sendJson(response, 500, { ok: false, error: `Cannot read the levels file: ${error.message}` });
          return;
        }
        const applied = applyLevelEdit(current, parsed.edit, stamp);
        if (applied.error) {
          sendJson(response, 404, { ok: false, error: applied.error });
          return;
        }
        // The tool never writes a file its own checker would reject, so --check on the committed
        // artifact cannot fail because of something this endpoint did.
        const problems = validateLevelsState(applied.state);
        if (problems.length) {
          sendJson(response, 422, {
            ok: false,
            error: `Refusing to write a levels file that would not validate: ${problems.join("; ")}`
          });
          return;
        }
        try {
          fs.writeFileSync(statePath, serialiseState(applied.state));
        } catch (error) {
          sendJson(response, 500, { ok: false, error: `Cannot write the levels file: ${error.message}` });
          return;
        }
        sendJson(response, 200, {
          ok: true,
          saved_at_utc: stamp,
          state_path: path.relative(root, statePath).replace(/\\/g, "/"),
          state: applied.state
        });
        return;
      }
      sendJson(response, 405, { ok: false, error: "The levels endpoint answers GET and POST only" });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { ok: false, error: "This local server serves files read-only" });
      return;
    }
    let decoded = route;
    try {
      decoded = decodeURIComponent(route);
    } catch (error) {
      sendJson(response, 400, { ok: false, error: "Unparseable request path" });
      return;
    }
    serveStatic(root, decoded, response);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

function parseArgs(argv) {
  const parsed = { check: false, statePath: null, port: null, root: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") {
      parsed.check = true;
      continue;
    }
    if (token === "--state" || token === "--port" || token === "--root") {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${token} needs a value`);
      if (token === "--state") parsed.statePath = value;
      if (token === "--port") parsed.port = value;
      if (token === "--root") parsed.root = value;
      index += 1;
      continue;
    }
    if (!token.startsWith("--") && !parsed.statePath) {
      parsed.statePath = token;
      continue;
    }
    throw new Error(`Unrecognised argument: ${token}`);
  }
  return parsed;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const statePath = path.resolve(process.cwd(), args.statePath || DEFAULT_STATE_PATH);

  if (args.check) {
    if (!fs.existsSync(statePath)) {
      console.error(`Levels file not found: ${statePath}`);
      process.exitCode = 1;
      return;
    }
    let state;
    try {
      state = readState(statePath);
    } catch (error) {
      console.error(`Cannot parse ${statePath}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    const errors = validateLevelsState(state);
    if (errors.length) {
      console.error(["L2L levels validation failed.", ...errors.map(error => `- ${error}`)].join("\n"));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({
      status: "PASS",
      file: path.relative(process.cwd(), statePath).replace(/\\/g, "/"),
      schema_version: state.schema_version,
      generated_at_utc: state.generated_at_utc,
      marked_by: state.marked_by,
      instruments: state.instruments.map(instrument => ({ symbol: instrument.symbol, levels: instrument.levels.length }))
    }, null, 2));
    return;
  }

  const root = path.resolve(args.root || path.resolve(__dirname, ".."));
  const port = Number(args.port || DEFAULT_PORT);
  let server;
  try {
    server = await startServer({ root, statePath, port });
  } catch (error) {
    console.error(`Could not start the marking tool on 127.0.0.1:${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const address = server.address();
  console.log("L2L level marking tool (loopback only)");
  console.log(`  dashboard  http://127.0.0.1:${address.port}/`);
  console.log(`  levels     ${path.relative(root, statePath).replace(/\\/g, "/")}`);
  console.log("  Open the dashboard from that URL, pick a symbol, switch on Mark levels, then click the price.");
  console.log("  This tool is the only writer of the levels file; the published dashboard only reads it.");
  console.log("  Nothing here touches the broker, the terminal, or any order path.");
  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = {
  SCHEMA_VERSION,
  DEFAULT_STATE_PATH,
  DEFAULT_PORT,
  ALLOWED_KINDS,
  ALLOWED_DIRECTIONS,
  KNOWN_INSTRUMENTS,
  createEmptyState,
  normaliseEdit,
  applyLevelEdit,
  serialiseState,
  readState,
  validateLevelsState,
  startServer,
  parseArgs
};

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}




