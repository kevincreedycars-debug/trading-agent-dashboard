const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

// The lamp in the corner is the only live-trading fact on the page readable without opening the Live Trading
// tab, which makes it the one most likely to be believed and the one worth guarding hardest. These checks hold
// it to the accounts strip's own rule rather than to a friendlier one: a fresh, armed heartbeat is the only
// state that reads as active; an old armed record, a missing record, a parked lane and an unreadable lanes
// document each say what they are. They also pin it to the top right, which is the whole point of it, and assert
// it carries no control, because a corner that could be pressed is an order path waiting to happen.
const repoRoot = path.resolve(__dirname, "..");
const shippedSnapshot = readJson("data/live-trading.json");
const LANES_PATH = "/data/live-trading-lanes.json";
const TRADER_PATH = "/data/live-trading-trader.ftmo-1.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

// One heartbeat the page reads twice: as the lane's own artifact and as the summary the lanes publisher copied
// into the row. Both say the same thing here, so a disagreement between the two readers cannot hide behind the
// fixture. The document's own `generated_at_utc` is the publish instant, which is a separate fact from when the
// loop wrote: the publisher puts out a commit every twenty minutes or so, and the heartbeat rides in it, so the
// age of the record on the page is the age it had when that commit was made plus the age of the commit itself.
function heartbeatFixture({
  armed = true,
  status = "nothing_to_place",
  ageSeconds = 20,
  publishedAgeSeconds = 15,
  host = "vmi3697641"
} = {}) {
  const writtenAt = new Date(Date.now() - ageSeconds * 1000).toISOString();
  const publishedAt = new Date(Date.now() - publishedAgeSeconds * 1000).toISOString();
  const artifact = {
    schema_version: "live-trading-trader-v1",
    at_utc: writtenAt,
    written_at_utc: writtenAt,
    armed,
    status,
    reason: "no pair was left a ticket this run",
    expected_interval_seconds: 300,
    host: { computer: host, platform: "win32", checkout: "C:\\live-trading\\runtime" }
  };
  const lanes = {
    schema_version: "live-trading-lanes-v1",
    generated_at_utc: publishedAt,
    publisher: "scripts/publish-live-trading-lanes.js",
    lanes: [{
      id: "ftmo-1",
      label: "FTMO account 1",
      enabled: true,
      feed: "data/live-trading.json",
      trader_status: "data/live-trading-trader.ftmo-1.json",
      account_login_masked: "***614",
      account_server: "FTMO-Server",
      generated_at_utc: shippedSnapshot.generated_at_utc,
      status: "published",
      trader: {
        published: "data/live-trading-trader.ftmo-1.json",
        written_at_utc: writtenAt,
        at_utc: writtenAt,
        armed,
        status,
        host,
        expected_interval_seconds: 300
      }
    }]
  };
  return { artifact, lanes };
}

function parkedLanes() {
  return {
    schema_version: "live-trading-lanes-v1",
    generated_at_utc: new Date(Date.now() - 20000).toISOString(),
    lanes: [{
      id: "ftmo-1",
      label: "FTMO account 1",
      enabled: false,
      feed: "data/live-trading.json",
      trader_status: null,
      account_login_masked: "***614",
      account_server: "FTMO-Server",
      status: "disabled",
      trader: { published: null, reason: "the lane is disabled, so no trader runs it" }
    }]
  };
}


// Serves the published dashboard from this checkout. Only the two live-trading documents the lamp reads are
// overridable, and null means "this file is absent from the deployment" - a state the lamp must survive, because
// the lanes document arrives in the publisher's next commit after the page does.
async function createHarness() {
  const overrides = new Map();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (overrides.has(pathname)) {
      const body = overrides.get(pathname);
      if (body === null) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true });

  return {
    origin,
    async open() {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
      // The lamp is hidden until the lane read settles, so the guard waits for its first paint rather than for
      // the element, which is in the markup from the first byte.
      await page.waitForFunction(() => {
        const node = document.getElementById("liveTraderStatus");
        return Boolean(node && !node.hidden && node.textContent.trim());
      });
      return { page, errors };
    },
    setFile(pathname, body) { overrides.set(pathname, body); },
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  };
}

async function lamp(page) {
  const node = page.locator("#liveTraderStatus");
  return {
    text: (await node.textContent()).replace(/\s+/g, " ").trim(),
    className: (await node.getAttribute("class")) || "",
    title: (await node.getAttribute("title")) || "",
    box: await node.boundingBox()
  };
}

test("a fresh armed heartbeat reads as a live trader in the top right", async () => {
  const harness = await createHarness();
  try {
    const fixture = heartbeatFixture({ armed: true, ageSeconds: 20 });
    harness.setFile(LANES_PATH, fixture.lanes);
    harness.setFile(TRADER_PATH, fixture.artifact);
    const { page, errors } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\blive\b/, `an armed loop with a 20 second heartbeat must read as live, saw "${state.className}"`);
    assert.match(state.text, /^Live trader active/, `the lamp must lead with the state, saw "${state.text}"`);
    assert.match(state.text, /ftmo-1/, "the lamp must name the lane it speaks for");
    assert.match(state.text, /nothing to place/, "the lamp must carry the loop's last result rather than only a colour");
    assert.match(state.title, /armed/, "the tooltip must say what the colour stands for");

    // Top right, and only there: inside the right edge and above the fold of a 1440x1000 window.
    assert.ok(state.box, "the lamp must be painted");
    assert.ok(state.box.x + state.box.width > 1440 - 60, `the lamp must sit at the right edge, saw ${state.box.x + state.box.width}`);
    assert.ok(state.box.y < 120, `the lamp must sit at the top, saw ${state.box.y}`);
    assert.equal(
      await page.locator("#liveTraderStatus button, #liveTraderStatus a, #liveTraderStatus input, #liveTraderStatus form").count(),
      0,
      "the lamp is a readout, not a control"
    );
    assert.deepEqual(errors, [], "the lamp must paint without a page error");
  } finally {
    await harness.close();
  }
});

test("an armed heartbeat that stopped writing may not read as active", async () => {
  const harness = await createHarness();
  try {
    const fixture = heartbeatFixture({ armed: true, ageSeconds: 8100 });
    harness.setFile(LANES_PATH, fixture.lanes);
    harness.setFile(TRADER_PATH, fixture.artifact);
    const { page } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\bstale\b/, `an armed record 2h 15m old must read as stale, saw "${state.className}"`);
    assert.doesNotMatch(state.text, /active/i, `a stale record must not wear the active word, saw "${state.text}"`);
    assert.match(state.text, /no run for 2h/, `the lamp must say how long the silence is, saw "${state.text}"`);
    assert.match(state.title, /nothing here shows a loop running now/, "the tooltip must not leave the arming reading as a state");
  } finally {
    await harness.close();
  }
});

test("a fresh heartbeat that is not armed says so instead of looking active", async () => {
  const harness = await createHarness();
  try {
    const fixture = heartbeatFixture({ armed: false, status: "refused", ageSeconds: 30 });
    harness.setFile(LANES_PATH, fixture.lanes);
    harness.setFile(TRADER_PATH, fixture.artifact);
    const { page } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\bwaiting\b/, `an unarmed loop must read as waiting, saw "${state.className}"`);
    assert.match(state.text, /not armed/, `the lamp must say the loop is not armed, saw "${state.text}"`);
    assert.doesNotMatch(state.text, /active/i, "an unarmed loop must never read as active");
  } finally {
    await harness.close();
  }
});

test("a heartbeat that was fresh when it was published stays active while the copy ages", async () => {
  const harness = await createHarness();
  try {
    // The state the lamp spent its first afternoon in: the loop ran at 16:36, the publisher read it at 16:40 and
    // put the commit out, and this page looked at 17:00. The record is 24 minutes old and the copy 20, but at
    // publish the loop was four minutes inside its window - a running trader, drawn amber, is a false alarm the
    // lamp cannot afford.
    const fixture = heartbeatFixture({ armed: true, ageSeconds: 1440, publishedAgeSeconds: 1200 });
    harness.setFile(LANES_PATH, fixture.lanes);
    harness.setFile(TRADER_PATH, fixture.artifact);
    const { page } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\blive\b/, `a record fresh at publish must read as live, saw "${state.className}"`);
    assert.match(state.text, /^Live trader active/, `the lamp must lead with the state, saw "${state.text}"`);
    assert.match(state.text, /as of \d{2}:\d{2}Z/, `the lamp must date the record rather than imply it is current, saw "${state.text}"`);
    assert.equal(/no run for/i.test(state.text), false, "a record inside its window at publish must not read as silence");
    assert.match(state.title, /4m before the publisher read it/, `the tooltip must say the record was fresh when it was copied, saw "${state.title}"`);
  } finally {
    await harness.close();
  }
});

test("a copy nobody has republished for an hour says so instead of reading as active", async () => {
  const harness = await createHarness();
  try {
    // Publishing stopping is not the same failure as the loop stopping, and it is the one the reader can act on:
    // the record was two minutes old when the last commit was made, and that commit is now an hour and a bit old.
    const fixture = heartbeatFixture({ armed: true, ageSeconds: 4000, publishedAgeSeconds: 3900 });
    harness.setFile(LANES_PATH, fixture.lanes);
    harness.setFile(TRADER_PATH, fixture.artifact);
    const { page } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\bstale\b/, `a copy past the publish ceiling must read as stale, saw "${state.className}"`);
    assert.doesNotMatch(state.text, /active/i, `a copy nobody is refreshing must not wear the active word, saw "${state.text}"`);
    assert.match(state.text, /no publish for 1h/, `the lamp must say the silence is in publishing, saw "${state.text}"`);
    assert.equal(/no run for/i.test(state.text), false, "publishing silence must not be blamed on the loop");
    assert.match(state.title, /nothing on this page says what the loop is doing now/, "the tooltip must not present the old copy as a report on now");
  } finally {
    await harness.close();
  }
});

test("a lanes document that is not published yet leaves the lamp saying it does not know", async () => {
  const harness = await createHarness();
  try {
    harness.setFile(LANES_PATH, null);
    harness.setFile(TRADER_PATH, null);
    const { page } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\bunknown\b/, `a missing lanes document must read as unknown, saw "${state.className}"`);
    assert.match(state.text, /status unknown/, `the lamp must say it cannot tell, saw "${state.text}"`);
    assert.doesNotMatch(state.text, /active/i, "nothing may read as active when the lane document is missing");
    assert.match(state.title, /not published yet/, "the tooltip must say why the lamp cannot tell");
  } finally {
    await harness.close();
  }
});

test("a parked lane is named as disabled rather than left blank", async () => {
  const harness = await createHarness();
  try {
    harness.setFile(LANES_PATH, parkedLanes());
    harness.setFile(TRADER_PATH, null);
    const { page } = await harness.open();
    const state = await lamp(page);

    assert.match(state.className, /\bdisabled\b/, `a parked lane must read as disabled, saw "${state.className}"`);
    assert.match(state.text, /disabled/, `the lamp must name the parked lane, saw "${state.text}"`);
    assert.doesNotMatch(state.text, /active/i, "a parked lane must never read as active");
  } finally {
    await harness.close();
  }
});
