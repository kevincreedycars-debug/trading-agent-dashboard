// The L2L level marking tool, and the guard for the artifact it writes.
//
// Two roles, one script, because the artifact and its writer have to agree exactly:
//
//   node scripts/l2l-levels-tool.js                 serve the dashboard locally and accept marked levels
//   node scripts/l2l-levels-tool.js --check <path>  validate data/l2l-levels.json and exit non-zero on failure
//
// The published dashboard draws the same lines from the committed file, and can also add a level through the
// reader's own GitHub account, using lib/l2l_levels_store.js. This script is the local path: it serves the
// repo on 127.0.0.1, the dashboard notices the write endpoint, and a click on the mirrored chart posts a
// level back into the file on this machine. Neither path has an order path or touches any broker data: the
// whole artifact is prices the user marked by hand.
const fs = require("fs");
const http = require("http");
const path = require("path");

// The document itself - the constants, the edit rules, the ladder arithmetic and the checker - lives in
// lib/l2l_levels_store.js, because the published dashboard writes the same file through the reader's own
// GitHub account and the two writers must not drift. This script keeps the parts only a local program
// can do: serving the repo on loopback, and validating the committed artifact from a command line.
const levels = require("../lib/l2l_levels_store.js");

const {
  SCHEMA_VERSION,
  DEFAULT_STATE_PATH,
  DEFAULT_PORT,
  ALLOWED_KINDS,
  ALLOWED_DIRECTIONS,
  ALLOWED_ROLES,
  ALLOWED_ACTIONS,
  DERIVED_MARKED_BY,
  DEFAULT_DUPLICATE_STEPS,
  MAX_DUPLICATE_STEPS,
  KNOWN_INSTRUMENTS,
  MARKED_BY,
  createEmptyState,
  normaliseEdit,
  normaliseStepCount,
  buildLadder,
  applyLevelEdit,
  serialiseState,
  validateLevelsState
} = levels;

const MAX_BODY_BYTES = 64 * 1024;

function readState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
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

// The marker header is how the dashboard tells this loopback tool from the published static host, so it can
// offer the local save path only where that path exists. The published page writes through GitHub instead,
// which needs no marker and no local endpoint.
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
        const applied = applyLevelEdit(current, parsed.edit, stamp, MARKED_BY.tool);
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
          generated: applied.generated || null,
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
      instruments: state.instruments.map(instrument => ({
        symbol: instrument.symbol,
        levels: instrument.levels.length,
        seeds: instrument.levels.filter(level => level.role !== "derived").length,
        derived: instrument.levels.filter(level => level.role === "derived").length
      }))
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
  console.log("  This writes the levels file on this machine; the published dashboard writes it through GitHub.");
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
  ALLOWED_ROLES,
  ALLOWED_ACTIONS,
  DERIVED_MARKED_BY,
  DEFAULT_DUPLICATE_STEPS,
  MAX_DUPLICATE_STEPS,
  KNOWN_INSTRUMENTS,
  createEmptyState,
  normaliseEdit,
  normaliseStepCount,
  buildLadder,
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
