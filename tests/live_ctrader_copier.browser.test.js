// Browser test for the Live cTrader Copier tab.
//
// The numbers themselves are held by tests/live_ctrader_copier.test.js. What this test adds is what that one
// cannot see: that the tab exists in the rail, that it draws the copier's own document (not the FTMO feed), that
// the mapping row states lots, wire units and asset units separately, that the verification matrix separates
// "broker observed" from "awaiting live proof", that a setup-test close is labelled in the account history and
// left out of the performance totals, and that the page holds its width on a phone.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function spec(symbol, digits, units, wire) {
  return { symbol, digits, lot_units: units, protocol_units_per_lot: wire, volume_step: 0.01, min_volume: 0.01, max_volume: 1000, trade_mode: "full" };
}

function copierDocument() {
  const now = Date.now();
  const at = (offsetMinutes) => new Date(now - offsetMinutes * 60000).toISOString();
  return {
    schema_version: "live-ctrader-copier-v1",
    generated_at_utc: at(1),
    stale_after_seconds: 1800,
    publisher: "scripts/publish-ctrader-copier.js",
    read_only: true,
    order_functions_called: false,
    source: { lane: "ftmo-1", label: "FTMO account 1", account_login_masked: "***614", account_server: "FTMO-Server", probe: "probe.py", probed_at_utc: at(1), positions_seen: 2 },
    destination: { login: 7348195, account_id: "42585819", broker: "FTMO Platform", environment: "demo", demo: true },
    connection: { connected: true, read_at_utc: at(1), account_id: "42585819", broker: "FTMO Platform", environment: "demo", currency: "USD", leverage: 100, account_type: "hedging" },
    copier: {
      version: "copier-20261119.1",
      mode: "live",
      schedule: { cadence_seconds: 60, description: "one --once poll every 60s, run by Task Scheduler", overlap_prevention: "the copier's own lock file plus Task Scheduler's IgnoreNew policy", restart_recovery: "a lock left by a dead pid is taken over" },
      heartbeat: { state: "ok", label: "OK", age_seconds: 42, last_poll_utc: at(1), last_success_utc: at(1), detail: "the last poll finished 42s ago and reported ok" },
      last_poll_utc: at(1),
      last_success_utc: at(1),
      health: { status: "ok", started_utc: at(1), finished_utc: at(1), polls: 1, dry_run: false, source: { ok: true, positions: 2, probed_at_utc: at(1) }, destination: { account_id: "42585819", symbols: ["XAUUSD", "EURUSD"] }, reconcile: { checked: 0, mapped: 0, dropped: 0 }, refusals: [], actions: [], closes: [], notes: [] }
    },
    account: { balance: 23654.16, equity: 23662.67, equity_basis: "balance plus open positions marked at the reference price", equity_estimated: true, currency: "USD", leverage: 100, money_digits: 2, open_positions: 2, pending_orders: 0, closed_trades: 2, read_at_utc: at(1) },
    horizon: { window_days: 30, from_utc: at(43200), to_utc: at(1) },
    closed_trades: [
      {
        position_id: "62272218", symbol: "XAUUSD", side: "sell", volume_lots: 0.01, price_open: 3667.25, price_close: 3661.25,
        opened: { time_utc: at(120) }, closed: { time_utc: at(30) }, duration_seconds: 5400,
        profit: 6, commission: -0.02, swap: 0, net_profit: 5.98, deal_count: 2, comment: "copy-309101669",
        copy_kind: "copy", copy_label: "Copied from FTMO-1", source_ticket: "309101669", digits: 2
      },
      {
        position_id: "62201529", symbol: "BTCUSD", side: "buy", volume_lots: 0.01, price_open: 62463.39, price_close: 62462.93,
        opened: { time_utc: at(3000) }, closed: { time_utc: at(2990) }, duration_seconds: 2,
        profit: -0.01, commission: -0.6, swap: 0, net_profit: -0.61, deal_count: 2, comment: "btc-test-120s",
        copy_kind: "setup-test", copy_label: "Standalone setup test", source_ticket: null, digits: 2
      }
    ],
    setup_tests: { trades: 1, net: -0.61, position_ids: ["62201529"] },
    pre_copier: { trades: 0, net: 0, position_ids: [] },
    unattributed: { trades: 0, net: 0, position_ids: [] },
    mappings: [
      { source_ticket: "309101669", target_position_id: "62272218", source_symbol: "XAUUSD", symbol: "XAUUSD", side: "sell", status: "open", status_detail: null, volume_lots: 0.01, protocol_units: 100, base_units: 1, entry_price: 3667.25, stop_price: 3704.29, target_price: null, expiry_utc: null, expiry_note: "market order", request_id: "copy-309101669", copied_utc: at(120), reconciled: true },
      { source_ticket: "309180633", target_position_id: "62272219", source_symbol: "EURUSD", symbol: "EURUSD", side: "sell", status: "open", status_detail: null, volume_lots: 0.01, protocol_units: 100000, base_units: 1000, entry_price: 1.09756, stop_price: 1.09865, target_price: null, expiry_utc: null, expiry_note: "market order", request_id: "copy-309180633", copied_utc: at(120), reconciled: true }
    ],
    differences: { count: 0, missing_copies: [], orphaned_mappings: [], unresolved_pending: [], unattributed_closes: [] },
    rejections: [],
    verification: [
      { behaviour: "Copying a filled FTMO-1 position", state: "broker_observed", detail: "broker read: #62272218 XAUUSD sell 0.01 lot" },
      { behaviour: "Size conversion through the destination contract", state: "broker_observed", detail: "the adapter regression sends 0.01 lot of EURUSD as 100,000 protocol units" },
      { behaviour: "Amending a stop or target after the copy", state: "not_sent", detail: "the copier has no amendment path" },
      { behaviour: "Full close after a source exit", state: "awaiting_live_proof", detail: "tested on fixtures; no copier close has been observed yet" }
    ],
    symbols: [
      { source_symbol: "EURUSD", target_symbol: "EURUSD", mapped: true, excluded: false, held: true, ...spec("EURUSD", 5, 100000, 10000000) },
      { source_symbol: "XAUUSD", target_symbol: "XAUUSD", mapped: true, excluded: false, held: true, ...spec("XAUUSD", 2, 100, 10000) },
      { source_symbol: "BTCUSD", target_symbol: "BTCUSD", mapped: true, excluded: false, held: false, ...spec("BTCUSD", 2, 1, 100) },
      { source_symbol: "US100.cash", target_symbol: "US100.cash", mapped: true, excluded: false, held: false, ...spec("US100.cash", 1, 1, 100) }
    ]
  };
}


async function startServer(document) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    if (pathname === "/data/live-ctrader-copier.json") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify(document));
      return;
    }
    const filePath = path.resolve(repoRoot, pathname.replace(/^\/+/, ""));
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
    response.end(fs.readFileSync(filePath));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  };
}

test("the copier tab draws the mapping, the verification states and the labelled setup test", async () => {
  const server = await startServer(copierDocument());
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-ctrader-copier"]');
    await page.waitForSelector("#liveCtraderCopierPanel .live-trading-banner", { timeout: 20000 });
    await page.waitForFunction(() => (document.querySelector("#liveCtraderCopierPanel .live-trading-chips")?.textContent || "").includes("42585819"), null, { timeout: 20000 });
    await page.waitForSelector("#liveCtraderCopierPanel table", { timeout: 20000 });

    const chips = await page.locator("#liveCtraderCopierPanel .live-trading-chips").innerText();
    assert.match(chips, /42585819/);
    assert.match(chips, /23,?654\.16|23654\.16/);
    assert.match(chips, /every 60s/);

    // Lots, wire units and asset units are three columns, not one number called "volume".
    const mappingRow = await page.locator("#liveCtraderCopierPanel table tbody tr", { hasText: "309180633" }).innerText();
    assert.match(mappingRow, /0\.01/);
    assert.match(mappingRow, /100000/);
    assert.match(mappingRow, /1000/);
    assert.match(mappingRow, /OPEN/);

    const verification = await page.locator("#liveCtraderCopierPanel .live-trading-table-panel", { hasText: "What is proved" }).innerText();
    assert.match(verification, /Broker observed/);
    assert.match(verification, /Awaiting live proof/);
    assert.match(verification, /Not sent/);

    const history = await page.locator("#liveCtraderCopierPanel .live-trading-table-panel", { hasText: "Account history" }).innerText();
    assert.match(history, /Copied from FTMO-1/);
    assert.match(history, /Standalone setup test/);

    const instruments = await page.locator("#liveCtraderCopierPanel .live-trading-table-panel", { hasText: "Instruments the copier maps" }).innerText();
    assert.match(instruments, /US100\.cash/);
    assert.match(instruments, /full/);

    // The performance totals count the copy and leave the setup test out, and say where it went.
    const performancePanel = page.locator("#liveCtraderCopierPanel .live-trading-performance");
    const totals = await performancePanel.innerText();
    assert.match(totals, /5\.98/);
    assert.match(totals, /worth -0\.61 USD/);
    await page.click('[data-live-ctrader-performance-tab="strategy"]');
    assert.equal(await page.locator("#liveCtraderCopierPerformanceBody-strategy").isVisible(), true);
    assert.match(await page.locator("#liveCtraderCopierPerformanceBody-strategy").innerText(), /Copied from FTMO-1/);
    assert.equal(await page.locator("#liveCtraderCopierPerformanceBody-weekday").isVisible(), false);
  } finally {
    await browser.close();
    await server.close();
  }
});

test("the copier tab fits a phone without a page-wide scrollbar", async () => {
  const server = await startServer(copierDocument());
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await page.goto(`${server.origin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.click('.tab-button[data-tab="live-ctrader-copier"]');
    await page.waitForSelector("#liveCtraderCopierPanel .live-trading-banner", { timeout: 20000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 2, `the page should not scroll sideways on a phone, overflowed by ${overflow}px`);
    // The wide tables scroll inside their own boxes rather than stretching the page.
    const scrollable = await page.evaluate(() => [...document.querySelectorAll("#liveCtraderCopierPanel .live-trading-table-scroll")]
      .some((node) => node.scrollWidth > node.clientWidth));
    assert.equal(scrollable, true);
  } finally {
    await browser.close();
    await server.close();
  }
});

