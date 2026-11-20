// Tests for the guarded BTCUSD acceptance test: the contract read, the minimum-volume arithmetic, the refusal
// gates, the single send, the reconcile-not-resend rule, the stop confirmation, the two-minute clock measured
// from the broker's fill, the close by position id, the flat check, the disarm and the report.
//
// Nothing here connects to cTrader. The destination is a plain object, so every case is a rerun.
//
//   node --test docs/strategy/proposals/CTRADER_BTCUSD_TEST_20261113.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const harness = require(path.join(__dirname, "CTRADER_BTCUSD_TEST_20261113.js"));

const FILL_ISO = "2026-11-13T10:00:00.000Z";
const FILL_MS = Date.parse(FILL_ISO);

function contract(over = {}) {
  return {
    symbol: "BTCUSD",
    digits: 2,
    lotSizeBtc: 1,
    minVolume: 0.01,
    volumeStep: 0.01,
    maxVolume: 5,
    minStopDistance: 300,
    tradeMode: "full",
    ...over
  };
}

function clock(start = FILL_MS) {
  const c = {
    t: start,
    sleeps: [],
    now() { return c.t; },
    async sleep(ms) { c.sleeps.push(ms); c.t += ms; }
  };
  return c;
}

// A destination that answers like a broker and records every call. `behaviour` switches the cases that matter:
// a refused entry, an unknown send, a missing stop, a stop that fires, a close that never confirms.
function destination(behaviour = {}) {
  const b = { sendOutcome: "accepted", stop: 99700, stopHitAtMs: null, closeConfirms: true, ...behaviour };
  const calls = { sends: [], closes: [], disarms: [], find: 0 };
  let position = null;
  const api = {
    calls,
    async getAccount() {
      return { accountId: b.accountId || "50012345", balance: 10000, currency: "USD", hedgingMode: "netting" };
    },
    async getSymbolSpec() { return b.spec || contract(); },
    async listExposures() { return b.exposures || { positions: [], orders: [] }; },
    async getReferencePrice() { return b.referencePrice || 100000; },
    async sendMarketOrder(req) {
      calls.sends.push(req);
      if (b.sendOutcome === "refused") return { outcome: "refused", message: "not enough margin" };
      position = {
        positionId: "P-1",
        state: "open",
        volume: req.volume,
        entryPrice: 100000.5,
        protectionStop: b.stop,
        closePrice: null,
        closeTimeUtc: null
      };
      if (b.sendOutcome === "unknown") return { outcome: "unknown", orderId: null, positionId: null };
      return { outcome: "accepted", orderId: "O-1", positionId: "P-1" };
    },
    async findByRequestId() {
      calls.find += 1;
      if (b.findAfterUnknown && position) return { order: { orderId: "O-1" }, position };
      return null;
    },
    async getExecution() {
      if (b.sendOutcome === "refused") return null;
      return {
        filledVolume: b.filledVolume === undefined ? 0.01 : b.filledVolume,
        fillPrice: 100000.5,
        fillTimeUtc: b.fillTimeUtc || FILL_ISO,
        commission: -0.35
      };
    },
    async getPosition() {
      if (!position) return null;
      if (b.stopHitAtMs !== null && clockRef && clockRef.t >= b.stopHitAtMs) {
        position = { ...position, state: "closed", closePrice: 99699.5, closeTimeUtc: new Date(b.stopHitAtMs).toISOString() };
      }
      return { ...position };
    },
    async closePosition(req) {
      calls.closes.push(req);
      if (b.closeConfirms) {
        position = {
          ...position,
          state: "closed",
          closePrice: 100100,
          closeTimeUtc: new Date((clockRef ? clockRef.t : FILL_MS) + 1000).toISOString()
        };
        return { outcome: "accepted" };
      }
      if (b.closeOutcome === "unknown") return { outcome: "unknown" };
      return { outcome: "refused", message: "position not found" };
    },
    async listDeals() {
      return b.deals || [
        { type: "entry", volume: 0.01, price: 100000.5, timeUtc: FILL_ISO, commission: -0.35, swap: 0, pnl: null },
        { type: "exit", volume: 0.01, price: 100100, timeUtc: new Date(FILL_MS + 121000).toISOString(), commission: -0.35, swap: 0, pnl: 0.995 }
      ];
    },
    async getOpenExposure() {
      return { positions: position && position.state === "open" ? [position] : [] };
    },
    async setArmed(value) { calls.disarms.push(value); }
  };
  let clockRef = null;
  api.attachClock = (c) => { clockRef = c; return api; };
  return api;
}

function config(over = {}) {
  return {
    confirmedAccountId: "50012345",
    armed: true,
    killSwitch: false,
    copyingEnabled: false,
    ...over
  };
}

async function run(behaviour = {}, cfg = {}) {
  const dest = destination(behaviour);
  const clk = clock();
  dest.attachClock(clk);
  const result = await harness.runTest({
    client: dest,
    config: { ...config(cfg), now: clk.now },
    sleep: clk.sleep
  });
  return { dest, clk, result };
}

test("the plan takes the contract minimum and states the BTC exposure, not a lot count", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  assert.equal(planned.ok, true);
  assert.equal(planned.plan.volume, 0.01);
  assert.equal(planned.plan.exposure_btc, 0.01);
  assert.equal(planned.plan.notional_usd, 1000);
  assert.equal(planned.plan.stop_price, 99700);
  assert.equal(planned.plan.stop_distance, 300);
});

test("the exposure follows the contract's own lot size: a 0.1 BTC lot is a tenth of the size", () => {
  const planned = harness.planTest({ spec: contract({ lotSizeBtc: 0.1 }), referencePrice: 100000 });
  assert.equal(planned.ok, true);
  assert.equal(planned.plan.exposure_btc, 0.001);
  assert.equal(planned.plan.notional_usd, 100);
});

test("a volume below the contract minimum is refused before anything is sent", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000, volume: 0.001 });
  assert.equal(planned.ok, false);
  assert.ok(planned.refusals.includes("volume_below_min"));
});

test("a volume off the contract's step is refused", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000, volume: 0.015 });
  assert.equal(planned.ok, false);
  assert.ok(planned.refusals.includes("volume_off_step"));
});

test("rounding the stop never shortens it below the contract's minimum distance", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000.019 });
  assert.equal(planned.plan.stop_price, 99700.01);
  assert.ok(planned.plan.stop_distance >= planned.plan.stop_distance_min);
});

test("a contract missing the fields the size or the stop needs is refused", () => {
  const planned = harness.planTest({ spec: contract({ lotSizeBtc: null }), referencePrice: 100000 });
  assert.equal(planned.ok, false);
  assert.ok(planned.refusals.some((code) => code.startsWith("spec_incomplete:lotSizeBtc")));
});


test("preflight refuses an unconfirmed account, and a destination reporting another account", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  const base = { account: { accountId: "50012345", balance: 10000 }, spec: contract(), exposures: { positions: [], orders: [] }, planResult: planned };
  const unconfirmed = harness.preflight({ ...base, config: { armed: true, now: () => 0 } });
  assert.ok(unconfirmed.refusals.includes("account_unconfirmed"));
  const mismatch = harness.preflight({ ...base, config: { confirmedAccountId: "999", armed: true, now: () => 0 } });
  assert.ok(mismatch.refusals.includes("account_mismatch"));
});

test("an existing position on BTCUSD stops the run and is named", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  const result = harness.preflight({
    config: { confirmedAccountId: "50012345", armed: true, now: () => 0 },
    account: { accountId: "50012345", balance: 10000 },
    spec: contract(),
    exposures: { positions: [{ positionId: "P-OLD" }], orders: [] },
    planResult: planned
  });
  assert.equal(result.ok, false);
  assert.ok(result.refusals.includes("exposure_present:P-OLD"));
});

test("a pending order on BTCUSD stops the run and is named", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  const result = harness.preflight({
    config: { confirmedAccountId: "50012345", armed: true, now: () => 0 },
    account: { accountId: "50012345", balance: 10000 },
    spec: contract(),
    exposures: { positions: [], orders: [{ orderId: "O-OLD" }] },
    planResult: planned
  });
  assert.equal(result.ok, false);
  assert.ok(result.refusals.includes("pending_present:O-OLD"));
});

test("copying switched on, an unarmed relay and a live kill switch each stop the run", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  const base = {
    account: { accountId: "50012345", balance: 10000 },
    spec: contract(),
    exposures: { positions: [], orders: [] },
    planResult: planned
  };
  const copying = harness.preflight({ ...base, config: { confirmedAccountId: "50012345", armed: true, copyingEnabled: true, now: () => 0 } });
  assert.ok(copying.refusals.includes("copying_enabled"));
  const unarmed = harness.preflight({ ...base, config: { confirmedAccountId: "50012345", armed: false, now: () => 0 } });
  assert.ok(unarmed.refusals.includes("not_armed"));
  const killed = harness.preflight({ ...base, config: { confirmedAccountId: "50012345", armed: true, killSwitch: true, now: () => 0 } });
  assert.ok(killed.refusals.includes("kill_switch"));
});

test("a run with no clock is refused, because the two-minute deadline would not be honest", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  const result = harness.preflight({
    config: { confirmedAccountId: "50012345", armed: true },
    account: { accountId: "50012345", balance: 10000 },
    spec: contract(),
    exposures: { positions: [], orders: [] },
    planResult: planned
  });
  assert.ok(result.refusals.includes("clock_missing"));
});

test("the risk is priced in dollars and an explicit limit refuses a stop that is too wide", () => {
  const planned = harness.planTest({ spec: contract(), referencePrice: 100000 });
  const result = harness.preflight({
    config: { confirmedAccountId: "50012345", armed: true, now: () => 0, maxRiskUsd: 1 },
    account: { accountId: "50012345", balance: 10000 },
    spec: contract(),
    exposures: { positions: [], orders: [] },
    planResult: planned
  });
  assert.equal(result.risk.risk_usd, 3);
  assert.equal(result.risk.balance_usd, 10000);
  assert.ok(result.refusals.some((code) => code.startsWith("risk_above_limit")));
});


test("the run sends one buy at the contract minimum with a stop, then closes by position id at 120 seconds", async () => {
  const { dest, clk, result } = await run();
  assert.equal(result.status, "closed_at_deadline");
  assert.equal(dest.calls.sends.length, 1);
  const sent = dest.calls.sends[0];
  assert.equal(sent.side, "buy");
  assert.equal(sent.type, "market");
  assert.equal(sent.volume, 0.01);
  assert.equal(sent.stopPrice, 99700);
  assert.equal(dest.calls.closes.length, 1);
  assert.equal(dest.calls.closes[0].positionId, "P-1");
  assert.equal(dest.calls.closes[0].volume, 0.01);
  // The close is not requested before the broker's own fill time plus two minutes.
  assert.ok(clk.t >= FILL_MS + 120000);
  assert.ok(clk.t < FILL_MS + 125000);
});

test("the report carries the entry and exit times, holding time, size, prices, fees and net", async () => {
  const { result } = await run();
  const report = result.report;
  assert.equal(report.entry_time_utc, FILL_ISO);
  assert.equal(report.hold_seconds, 121);
  assert.equal(report.volume, 0.01);
  assert.equal(report.exposure_btc, 0.01);
  assert.equal(report.entry_price, 100000.5);
  assert.equal(report.exit_price, 100100);
  assert.equal(report.stop_price, 99700);
  assert.equal(report.gross_usd, 0.995);
  assert.equal(report.commission_usd, -0.7);
  assert.equal(report.swap_usd, 0);
  assert.equal(report.net_usd, 0.295);
  assert.equal(report.flat, true);
  assert.deepEqual(report.remaining_positions, []);
  assert.equal(report.exit_reason, "deadline_close");
});

test("if the stop takes the position first, the run records that outcome and sends no close", async () => {
  const { dest, result } = await run({ stopHitAtMs: FILL_MS + 90000 });
  assert.equal(result.status, "closed_by_stop");
  assert.equal(dest.calls.closes.length, 0);
  assert.equal(dest.calls.sends.length, 1);
  assert.equal(result.report.exit_reason, "stop");
  assert.equal(result.report.hold_seconds, 90);
  assert.equal(result.report.exit_price, 99699.5);
});

test("an unknown send is adopted from the destination by request id, never resent", async () => {
  const { dest, result } = await run({ sendOutcome: "unknown", findAfterUnknown: true });
  assert.equal(dest.calls.sends.length, 1);
  assert.equal(dest.calls.find, 1);
  assert.equal(result.entry.position_id, "P-1");
  assert.equal(result.status, "closed_at_deadline");
});

test("an unknown send with nothing at the destination escalates with the request id and sends nothing", async () => {
  const { dest, result } = await run({ sendOutcome: "unknown" });
  assert.equal(dest.calls.sends.length, 1);
  assert.equal(dest.calls.closes.length, 0);
  assert.equal(result.status, "uncertain_escalate");
  assert.match(result.alerts[0], /reconcile on cTrader/);
  assert.ok(result.requestId.startsWith("btc-test-"));
});

test("a stop that cannot be confirmed after entry closes the position at once", async () => {
  const { dest, result } = await run({ stop: null });
  assert.equal(result.status, "closed_stop_unconfirmed");
  assert.equal(dest.calls.closes.length, 1);
  assert.equal(dest.calls.closes[0].reason, "stop_unconfirmed");
  assert.ok(result.alerts.some((line) => line.includes("no_stop")));
  assert.equal(dest.calls.disarms.length, 1);
});

test("a stop the broker holds shorter than the contract minimum is not a protection, so the run closes", async () => {
  const { dest, result } = await run({ stop: 99900 });
  assert.equal(result.status, "closed_stop_unconfirmed");
  assert.equal(dest.calls.closes.length, 1);
  assert.ok(result.alerts.some((line) => line.includes("stop_short")));
});

test("a close that never confirms ends in a close_failed alert naming the position", async () => {
  const { dest, result } = await run({ closeConfirms: false });
  assert.equal(result.status, "close_failed");
  assert.equal(dest.calls.closes.length, 1);
  assert.ok(result.alerts.some((line) => /closure not confirmed for position P-1/.test(line)));
  assert.equal(dest.calls.disarms.length, 1);
});

test("a destination that refuses the entry sends no close and still disarms", async () => {
  const { dest, result } = await run({ sendOutcome: "refused" });
  assert.equal(result.status, "refused_by_destination");
  assert.equal(dest.calls.sends.length, 1);
  assert.equal(dest.calls.closes.length, 0);
  assert.equal(dest.calls.disarms.length, 1);
});

test("a position with no fill execution is reported as unconfirmed, with no second send", async () => {
  const { dest, result } = await run({ filledVolume: 0, findAfterUnknown: true });
  assert.equal(result.status, "unconfirmed_fill");
  assert.equal(dest.calls.sends.length, 1);
  assert.ok(result.alerts.some((line) => line.includes("no fill execution")));
});

test("a refused preflight disarms and touches neither the send nor the close", async () => {
  const { dest, result } = await run({}, { copyingEnabled: true });
  assert.equal(result.status, "refused");
  assert.ok(result.preflight.refusals.includes("copying_enabled"));
  assert.equal(dest.calls.sends.length, 0);
  assert.equal(dest.calls.closes.length, 0);
  assert.deepEqual(dest.calls.disarms, [false]);
});

test("the module offers no MT5 path: its whole surface is the cTrader test", () => {
  assert.deepEqual(Object.keys(harness).sort(), [
    "HOLD_MS", "REFUSALS", "TEST_SIDE", "TEST_SYMBOL",
    "buildReport", "exposureFor", "planTest", "preflight", "runTest", "stopConfirmed"
  ]);
});

