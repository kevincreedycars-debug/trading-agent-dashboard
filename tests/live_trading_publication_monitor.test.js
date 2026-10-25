// The independent monitor, read off a served copy of the published artifacts.
//
// `scripts/check-live-trading-publication.js` is the thing a phone check or a second machine runs when nobody is
// watching the host. What it must not do is pretend: a stale snapshot, an account that is not the one the lanes
// document names, a declared heartbeat that is not there, and a lanes document that cannot be read are four
// different failures and must come back as four different answers.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const scriptPath = path.join(path.resolve(__dirname, ".."), "scripts", "check-live-trading-publication.js");

// Every stamp below is relative to this run's clock. A fixed stamp would pass on the day it was written and fail
// the next morning, which says nothing about the monitor and everything about the fixture.
function isoAgo(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function feedAt({ generatedAt = isoAgo(5), masked = "***614", windowSeconds = 900 } = {}) {
  return {
    schema_version: "live-trading-feed-v4",
    generated_at_utc: generatedAt,
    stale_after_seconds: windowSeconds,
    account: { login_masked: masked, server: "FTMO-Server", positions_open: 1 }
  };
}

function lanesDocument({ heartbeat = "data/live-trading-trader.ftmo-1.json", masked = "***614" } = {}) {
  return {
    schema_version: "live-trading-lanes-v1",
    generated_at_utc: isoAgo(5),
    lanes: [
      {
        id: "ftmo-1",
        label: "FTMO account 1",
        enabled: true,
        feed: "data/live-trading.json",
        trader_status: heartbeat,
        account_login_masked: masked,
        account_server: "FTMO-Server"
      },
      {
        id: "ftmo-2",
        label: "FTMO account 2",
        enabled: false,
        feed: "data/live-trading.account2.json",
        trader_status: null,
        account_login_masked: null,
        account_server: null
      }
    ]
  };
}

function statusAt({ writtenAt = isoAgo(5), armed = false, lane = "ftmo-1" } = {}) {
  return {
    schema_version: "live-trading-trader-status-v1",
    lane,
    at_utc: writtenAt,
    written_at_utc: writtenAt,
    armed,
    status: "planned",
    account: { login_masked: "***614", server: "FTMO-Server" },
    terminal: { positions_open: 1, orders_open: 0, ours: 1 }
  };
}

// A served copy of the published tree, with whatever the case needs in it.
async function serve(files) {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const body = files[pathname];
    if (body === undefined) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

// The monitor is run as a real child process, awaited rather than spawned synchronously: a synchronous spawn
// would block this process's event loop, and the local server these cases serve from would never answer.
function runMonitor(base, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, "--base", base, "--json", ...extraArgs], {
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("a fresh lane with a beating trader is OK, and a disabled lane is reported rather than failed", async () => {
  const server = await serve({
    "/data/live-trading-lanes.json": lanesDocument(),
    "/data/live-trading.json": feedAt(),
    "/data/live-trading-trader.ftmo-1.json": statusAt({ armed: true })
  });
  try {
    const result = await runMonitor(server.base);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout.trim());
    assert.equal(report.verdict, "ok");
    assert.equal(report.lanes.length, 2);
    const lane1 = report.lanes.find((row) => row.id === "ftmo-1");
    assert.equal(lane1.status, "ok");
    assert.equal(lane1.identity.matched, true);
    assert.equal(lane1.heartbeat.armed, true);
    const lane2 = report.lanes.find((row) => row.id === "ftmo-2");
    assert.equal(lane2.status, "disabled", "a parked lane is a decision, not a failure");
    assert.equal(lane2.heartbeat.declared, false);
  } finally {
    await server.close();
  }
});

test("a snapshot past its own window fails, and the report says by how much", async () => {
  const server = await serve({
    "/data/live-trading-lanes.json": lanesDocument(),
    "/data/live-trading.json": feedAt({ generatedAt: isoAgo(30 * 60) }),
    "/data/live-trading-trader.ftmo-1.json": statusAt()
  });
  try {
    const result = await runMonitor(server.base, ["--max-feed-age-seconds", "900"]);
    assert.equal(result.status, 1);
    const lane1 = JSON.parse(result.stdout.trim()).lanes.find((row) => row.id === "ftmo-1");
    assert.equal(lane1.status, "fail");
    assert.match(lane1.problems.join(" "), /past the 900s window it declares/);
  } finally {
    await server.close();
  }
});

test("a snapshot carrying another account fails rather than being trusted as the lane's own", async () => {
  const server = await serve({
    "/data/live-trading-lanes.json": lanesDocument(),
    "/data/live-trading.json": feedAt({ masked: "***777" }),
    "/data/live-trading-trader.ftmo-1.json": statusAt()
  });
  try {
    const result = await runMonitor(server.base);
    assert.equal(result.status, 1);
    const lane1 = JSON.parse(result.stdout.trim()).lanes.find((row) => row.id === "ftmo-1");
    assert.equal(lane1.identity.matched, false);
    assert.match(lane1.problems.join(" "), /\*\*\*777.*\*\*\*614/);
  } finally {
    await server.close();
  }
});

test("a heartbeat the lanes document declares but nothing publishes fails, and one it does not declare is only a note", async () => {
  const declaredMissing = await serve({
    "/data/live-trading-lanes.json": lanesDocument(),
    "/data/live-trading.json": feedAt()
  });
  try {
    const result = await runMonitor(declaredMissing.base);
    assert.equal(result.status, 1);
    const lane1 = JSON.parse(result.stdout.trim()).lanes.find((row) => row.id === "ftmo-1");
    assert.match(lane1.problems.join(" "), /declared in the lanes document but not published/);
  } finally {
    await declaredMissing.close();
  }

  const undeclared = await serve({
    "/data/live-trading-lanes.json": lanesDocument({ heartbeat: null }),
    "/data/live-trading.json": feedAt()
  });
  try {
    const result = await runMonitor(undeclared.base);
    assert.equal(result.status, 0, "a lane with no heartbeat declared is checked on its snapshot alone");
    const lane1 = JSON.parse(result.stdout.trim()).lanes.find((row) => row.id === "ftmo-1");
    assert.equal(lane1.heartbeat.declared, false);
    assert.match(lane1.notes.join(" "), /only the snapshot is checked/);
  } finally {
    await undeclared.close();
  }
});

test("a stale heartbeat fails, and so does a heartbeat naming another lane", async () => {
  const stale = await serve({
    "/data/live-trading-lanes.json": lanesDocument(),
    "/data/live-trading.json": feedAt(),
    "/data/live-trading-trader.ftmo-1.json": statusAt({ writtenAt: isoAgo(120 * 60) })
  });
  try {
    const result = await runMonitor(stale.base, ["--max-heartbeat-age-seconds", "900"]);
    assert.equal(result.status, 1);
    const lane1 = JSON.parse(result.stdout.trim()).lanes.find((row) => row.id === "ftmo-1");
    assert.match(lane1.problems.join(" "), /heartbeat is \d+s old/);
  } finally {
    await stale.close();
  }

  const wrongLane = await serve({
    "/data/live-trading-lanes.json": lanesDocument(),
    "/data/live-trading.json": feedAt(),
    "/data/live-trading-trader.ftmo-1.json": statusAt({ lane: "ftmo-2" })
  });
  try {
    const result = await runMonitor(wrongLane.base);
    assert.equal(result.status, 1);
    const lane1 = JSON.parse(result.stdout.trim()).lanes.find((row) => row.id === "ftmo-1");
    assert.match(lane1.problems.join(" "), /names lane ftmo-2/);
  } finally {
    await wrongLane.close();
  }
});

test("a lanes document that is not published is exit 2, which is not the same answer as a stale lane", async () => {
  const server = await serve({ "/data/live-trading.json": feedAt() });
  try {
    const result = await runMonitor(server.base);
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout.trim());
    assert.equal(report.lanes.length, 0);
    assert.match(report.lanes_document.error, /not published/);
  } finally {
    await server.close();
  }
});

test("the monitor is read-only: it issues GET requests and nothing else", async () => {
  const methods = [];
  const server = http.createServer((request, response) => {
    methods.push(request.method);
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await runMonitor(`http://127.0.0.1:${server.address().port}`);
    assert.deepEqual([...new Set(methods)], ["GET"]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
