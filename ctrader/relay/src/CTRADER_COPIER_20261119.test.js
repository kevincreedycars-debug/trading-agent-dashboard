// Tests for the copier: the source read that must not confuse a failure with an empty account, the size that is
// converted through the contracts and floored, the plan that states every open, close and refusal, and one whole
// poll over a scripted broker - kill switch first, then source, then sends, then closings, then the store.
//
//   node --test CTRADER_COPIER_20261119.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const copier = require(path.join(__dirname, "CTRADER_COPIER_20261119.js"));

const {
  readSource,
  convertVolume,
  planActions,
  clientOrderId,
  pollOnce,
  acquireLock,
  createProbeReader
} = copier;

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// EURUSD on the source: 1 lot = 100,000 units. On the destination: 1 lot = 100,000 units, in 0.01 steps.
function spec(over = {}) {
  return {
    symbol: "EURUSD",
    symbolId: 7,
    digits: 5,
    lotSizeBtc: 100000,
    // The protocol's volume units per lot: 100,000 units of EURUSD is 10,000,000 cents. It is the number the
    // adapter needs to turn this contract's lots into a protocol integer and back.
    volumeScale: 10000000,
    minVolume: 0.01,
    maxVolume: 50,
    volumeStep: 0.01,
    tradeMode: "full",
    minStopDistance: 0.0002,
    ...over
  };
}

function sourceDoc(over = {}) {
  return {
    schema_version: 1,
    ok: true,
    probed_at_utc: "2026-11-19T09:00:00Z",
    account: { login: 151761888, server: "FTMO-Server3", currency: "USD" },
    contract_sizes: { EURUSD: 100000 },
    positions: [
      {
        ticket: 991,
        symbol: "EURUSD",
        side: "buy",
        volume: 0.1,
        price_open: 1.08765,
        price_current: 1.0882,
        stop_loss: 1.085,
        take_profit: 1.0925,
        magic: 20261006,
        time_utc: "2026-11-19T08:55:00Z"
      }
    ],
    orders: [],
    ...over
  };
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "copier-test-"));
}

// `orders` is the destination's working book per target symbol, `pendingOrder`/`amend`/`cancel`/`sltp` are the
// answers to the sends that only a resting copy makes, and `order` answers both lookups by client order id and reads
// of one historic order.
function fakeClient({
  specs = {},
  exposure = {},
  orders = {},
  references = {},
  send = null,
  close = null,
  find = null,
  pendingOrder = null,
  amend = null,
  cancel = null,
  sltp = null,
  order = null
} = {}) {
  const calls = {
    sends: [],
    closes: [],
    specs: [],
    exposures: [],
    finds: [],
    references: [],
    pendings: [],
    amends: [],
    cancels: [],
    sltps: [],
    orderFinds: [],
    orderGets: []
  };
  return {
    calls,
    context: () => ({ accountId: 42585819 }),
    async getSymbolSpec(name) {
      calls.specs.push(name);
      if (!specs[name]) throw codedError("symbol_not_found", `${name} is not on this broker`);
      return specs[name];
    },
    async listExposures(name) {
      calls.exposures.push(name);
      return { positions: exposure[name] || [], orders: orders[name] || [] };
    },
    async getReferencePrice(name) {
      calls.references.push(name);
      if (!references[name]) throw codedError("price_unavailable", `no price for ${name}`);
      return references[name];
    },
    async sendMarketOrder(request) {
      calls.sends.push(request);
      return send ? send(request, calls) : { outcome: "accepted", positionId: "77", sent: true };
    },
    async sendPendingOrder(request) {
      calls.pendings.push(request);
      return pendingOrder ? pendingOrder(request, calls) : { outcome: "accepted", orderId: "5001", sent: true };
    },
    async amendOrder(request) {
      calls.amends.push(request);
      return amend ? amend(request, calls) : { outcome: "accepted", orderId: String(request.orderId), sent: true };
    },
    async cancelOrder(request) {
      calls.cancels.push(request);
      return cancel ? cancel(request, calls) : { outcome: "accepted", orderId: String(request.orderId), status: 5, sent: true };
    },
    async amendPositionSltp(request) {
      calls.sltps.push(request);
      return sltp
        ? sltp(request, calls)
        : {
          outcome: "accepted",
          positionId: String(request.positionId),
          stopLoss: request.stopLoss === undefined ? null : request.stopLoss,
          takeProfit: request.takeProfit === undefined ? null : request.takeProfit,
          sent: true
        };
    },
    async closePosition(request) {
      calls.closes.push(request);
      return close ? close(request, calls) : { outcome: "accepted", positionId: request.positionId, sent: true };
    },
    async findByRequestId(requestId) {
      calls.finds.push(requestId);
      return find ? find(requestId, calls) : null;
    },
    async findOrderByRequestId(requestId) {
      calls.orderFinds.push(requestId);
      return order ? order(requestId, calls) : null;
    },
    async getOrder(orderId) {
      calls.orderGets.push(orderId);
      return order ? order(orderId, calls) : null;
    }
  };
}

function memoryStore(initial = null) {
  let value = initial;
  return {
    reads: 0,
    writes: [],
    read() {
      this.reads += 1;
      return { ok: true, value: value ? JSON.parse(JSON.stringify(value)) : null };
    },
    write(file, next) {
      value = JSON.parse(JSON.stringify(next));
      this.writes.push({ file, value });
    },
    peek() {
      return value;
    }
  };
}

// ---- the source read ----

test("a probe that failed is a failed read, never an empty account", () => {
  const failed = readSource({ ok: false, error: { message: "no terminal" }, positions: [] });
  assert.equal(failed.ok, false);
  assert.equal(failed.cause, "source_unreadable");
  assert.deepEqual(failed.positions, []);

  const missing = readSource({ ok: true, positions: [] });
  assert.equal(missing.ok, false);
  assert.equal(missing.cause, "source_incomplete");

  assert.equal(readSource(null).ok, false);
});

test("the source read carries the contract size each position will be converted through", () => {
  const read = readSource(sourceDoc());
  assert.equal(read.ok, true);
  assert.equal(read.account.login, 151761888);
  assert.equal(read.positions.length, 1);
  assert.deepEqual(read.positions[0], {
    ticket: "991",
    symbol: "EURUSD",
    side: "buy",
    volume: 0.1,
    entry: 1.08765,
    current: 1.0882,
    stop: 1.085,
    target: 1.0925,
    contractSize: 100000,
    magic: 20261006,
    openTimeUtc: "2026-11-19T08:55:00Z"
  });
});

test("the source read filters by magic and by symbol, and keeps a position whose contract is unknown", () => {
  const doc = sourceDoc({
    contract_sizes: {},
    positions: [
      sourceDoc().positions[0],
      { ...sourceDoc().positions[0], ticket: 992, magic: 1 },
      { ...sourceDoc().positions[0], ticket: 993, symbol: "XAUUSD" }
    ]
  });
  const byMagic = readSource(doc, { magic: 20261006 });
  assert.deepEqual(byMagic.positions.map((row) => row.ticket), ["991", "993"]);
  const bySymbol = readSource(doc, { symbols: ["EURUSD"], magic: 20261006 });
  assert.deepEqual(bySymbol.positions.map((row) => row.ticket), ["991"]);
  assert.ok(Number.isNaN(bySymbol.positions[0].contractSize));
});

// ---- the size ----

test("size goes through the contracts: the same units on both sides is the same trade", () => {
  const same = convertVolume({ sourceLots: 0.1, sourceContractSize: 100000, spec: spec() });
  assert.equal(same.ok, true);
  assert.equal(same.lots, 0.1);
  assert.equal(same.capped, false);

  // A destination that prices a lot at ten times the units needs a tenth of the lots for the same exposure.
  const bigger = convertVolume({ sourceLots: 0.1, sourceContractSize: 100000, spec: spec({ lotSizeBtc: 1000000 }) });
  assert.equal(bigger.ok, true);
  assert.equal(bigger.lots, 0.01);
});

test("size is floored to the destination step and refused below its minimum rather than rounded up", () => {
  const floored = convertVolume({ sourceLots: 0.37, sourceContractSize: 100000, spec: spec({ lotSizeBtc: 300000 }) });
  assert.equal(floored.ok, true);
  assert.equal(floored.lots, 0.12);

  const below = convertVolume({ sourceLots: 0.01, sourceContractSize: 100000, spec: spec({ lotSizeBtc: 1000000, minVolume: 0.1 }) });
  assert.equal(below.ok, false);
  assert.equal(below.cause, "volume_below_target_minimum");
});

test("the owner's ceiling shortens a copy and says so; a missing contract or step refuses", () => {
  const capped = convertVolume({ sourceLots: 5, sourceContractSize: 100000, spec: spec(), maxLots: 0.5 });
  assert.equal(capped.ok, true);
  assert.equal(capped.lots, 0.5);
  assert.equal(capped.capped, true);

  assert.equal(convertVolume({ sourceLots: 1, sourceContractSize: 0, spec: spec() }).cause, "source_contract_missing");
  assert.equal(convertVolume({ sourceLots: 1, sourceContractSize: 100000, spec: spec({ lotSizeBtc: 0 }) }).cause, "target_contract_missing");
  assert.equal(convertVolume({ sourceLots: 1, sourceContractSize: 100000, spec: spec({ volumeStep: 0 }) }).cause, "target_step_missing");
  assert.equal(convertVolume({ sourceLots: 0, sourceContractSize: 100000, spec: spec() }).cause, "source_volume_invalid");
});


// ---- the plan ----

test("a fresh source position plans one open, with the source stop and a client order id from the ticket", () => {
  const source = readSource(sourceDoc());
  const plan = planActions({ source, state: { mappings: {} }, config: { symbolMap: {} }, specs: { EURUSD: spec() } });
  assert.equal(plan.refusals.length, 0);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.closes.length, 0);
  const action = plan.actions[0];
  assert.equal(action.type, "open");
  assert.equal(action.ticket, "991");
  assert.equal(action.symbol, "EURUSD");
  assert.equal(action.side, "buy");
  assert.equal(action.volume, 0.1);
  assert.equal(action.stopPrice, 1.085);
  assert.equal(action.requestId, "copy-991");
  assert.equal(clientOrderId("991"), "copy-991");
  assert.ok(action.requestId.length <= 50);
});

test("a ticket already fixed in the store is not planned again", () => {
  const source = readSource(sourceDoc());
  const state = { mappings: { 991: { symbol: "EURUSD", targetPositionId: "77" } } };
  const plan = planActions({
    source,
    state,
    config: { symbolMap: {} },
    specs: { EURUSD: spec() },
    exposure: { EURUSD: { positions: [{ positionId: "77" }] } }
  });
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.refusals.length, 0);
  assert.equal(plan.closes.length, 0);
});

test("a mapped copy the destination no longer holds is reported, not re-opened", () => {
  const source = readSource(sourceDoc());
  const state = { mappings: { 991: { symbol: "EURUSD", targetPositionId: "77" } } };
  const plan = planActions({
    source,
    state,
    config: { symbolMap: {} },
    specs: { EURUSD: spec() },
    exposure: { EURUSD: { positions: [] } }
  });
  assert.equal(plan.actions.length, 0);
  assert.deepEqual(plan.refusals.map((row) => row.code), ["copy_no_longer_open"]);
});

test("a stop trailed into profit is judged against the market, not against the entry", () => {
  // A sell entered at 1.0900 whose stop has been trailed to 1.0895 sits between the entry and the market. Judged
  // against the entry it reads as the wrong side; judged against the market it is a stop a sell can carry, so the
  // copy is made rather than refused.
  const doc = sourceDoc({
    positions: [{
      ticket: 992,
      symbol: "EURUSD",
      side: "sell",
      volume: 0.1,
      price_open: 1.09,
      price_current: 1.087,
      stop_loss: 1.0895,
      take_profit: 0,
      magic: 20261006,
      time_utc: "2026-11-19T08:55:00Z"
    }]
  });
  const trailed = planActions({ source: readSource(doc), state: {}, config: {}, specs: { EURUSD: spec() } });
  assert.deepEqual(trailed.refusals, []);
  assert.equal(trailed.actions.length, 1);
  assert.equal(trailed.actions[0].side, "sell");
  assert.equal(trailed.actions[0].stopPrice, 1.0895);

  // The same test the other way: a buy whose stop has been trailed above the market cannot be copied.
  const doc2 = sourceDoc({
    positions: [{
      ticket: 993,
      symbol: "EURUSD",
      side: "buy",
      volume: 0.1,
      price_open: 1.085,
      price_current: 1.0875,
      stop_loss: 1.088,
      take_profit: 0,
      magic: 20261006,
      time_utc: "2026-11-19T08:55:00Z"
    }]
  });
  const refused = planActions({ source: readSource(doc2), state: {}, config: {}, specs: { EURUSD: spec() } });
  assert.deepEqual(refused.actions, []);
  assert.deepEqual(refused.refusals.map((row) => row.code), ["source_stop_wrong_side"]);
});

test("the destination's own price decides the stop, and the source's price stands in when it cannot be read", () => {
  const doc = sourceDoc({
    positions: [{
      ticket: 994,
      symbol: "EURUSD",
      side: "sell",
      volume: 0.1,
      price_open: 1.09,
      price_current: 1.087,
      stop_loss: 1.0895,
      take_profit: 0,
      magic: 20261006,
      time_utc: "2026-11-19T08:55:00Z"
    }]
  });
  const source = readSource(doc);

  const byDestination = planActions({ source, state: {}, config: {}, specs: { EURUSD: spec() }, references: { EURUSD: 1.09 } });
  assert.deepEqual(byDestination.actions, []);
  assert.deepEqual(byDestination.refusals.map((row) => row.code), ["source_stop_wrong_side"]);

  const bySource = planActions({ source, state: {}, config: {}, specs: { EURUSD: spec() } });
  assert.equal(bySource.actions.length, 1);
});

test("a source position without a usable stop is refused, and a stop on the wrong side with it", () => {
  const source = readSource(sourceDoc());
  source.positions[0].stop = 0;
  const noStop = planActions({ source, state: {}, config: {}, specs: { EURUSD: spec() } });
  assert.deepEqual(noStop.actions, []);
  assert.deepEqual(noStop.refusals.map((row) => row.code), ["source_stop_missing"]);

  const wrongSide = readSource(sourceDoc());
  wrongSide.positions[0].stop = 1.09;
  const refused = planActions({ source: wrongSide, state: {}, config: {}, specs: { EURUSD: spec() } });
  assert.deepEqual(refused.refusals.map((row) => row.code), ["source_stop_wrong_side"]);
});

test("a symbol mapped to null is excluded, and an unknown destination symbol is a refusal rather than a guess", () => {
  const source = readSource(sourceDoc());
  const excluded = planActions({
    source,
    state: {},
    config: { symbolMap: { EURUSD: null } },
    specs: { EURUSD: spec() }
  });
  assert.deepEqual(excluded.refusals.map((row) => row.code), ["symbol_excluded"]);

  const unknown = planActions({ source, state: {}, config: { symbolMap: {} }, specs: {} });
  assert.deepEqual(unknown.refusals.map((row) => row.code), ["target_symbol_unknown"]);
});

test("a source position the account no longer carries plans the closing of its copy", () => {
  const source = readSource(sourceDoc({ positions: [] }));
  const state = { mappings: { 991: { symbol: "EURUSD", targetPositionId: "77" } } };
  const plan = planActions({ source, state, config: {}, specs: {} });
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.closes.length, 1);
  assert.deepEqual(plan.closes[0], {
    type: "close",
    ticket: "991",
    symbol: "EURUSD",
    positionId: "77",
    volume: null,
    reason: "source_closed"
  });
});

test("an unreadable source plans nothing at all", () => {
  const plan = planActions({ source: { ok: false, cause: "source_probe_failed", positions: [] }, state: {}, config: {} });
  assert.deepEqual(plan.actions, []);
  assert.deepEqual(plan.closes, []);
  assert.deepEqual(plan.refusals.map((row) => row.code), ["source_unreadable"]);
});


// ---- one poll ----

const STATE_PATH = path.join("C:/copier-test", "mappings.json");

function pollConfig(over = {}) {
  return { statePath: STATE_PATH, symbolMap: {}, intervalSeconds: 15, ...over };
}

function pollDeps({ doc = sourceDoc(), store = memoryStore(), log = () => {} } = {}) {
  return {
    store,
    log,
    now: () => Date.parse("2026-11-19T09:00:05Z"),
    readSource: async () => readSource(doc)
  };
}

test("the kill switch outranks everything: nothing is read and nothing is sent", async () => {
  const file = path.join(tempDir(), "STOP");
  fs.writeFileSync(file, "stop\n", "utf8");
  const client = fakeClient({ specs: { EURUSD: spec() } });
  let read = false;
  const health = await pollOnce({
    client,
    config: pollConfig({ killSwitch: file }),
    deps: { ...pollDeps(), readSource: async () => { read = true; return readSource(sourceDoc()); } }
  });
  assert.equal(health.status, "killed");
  assert.equal(read, false);
  assert.deepEqual(client.calls.sends, []);
  assert.deepEqual(client.calls.specs, []);
});

test("a dry run states the action, sends nothing and leaves the store alone", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() } });
  const store = memoryStore();
  const health = await pollOnce({ client, config: pollConfig({ dryRun: true }), deps: pollDeps({ store }) });
  assert.equal(health.status, "ok");
  assert.equal(health.dry_run, true);
  assert.equal(health.actions.length, 1);
  assert.equal(health.actions[0].outcome, "dry_run");
  assert.deepEqual(client.calls.sends, []);
  assert.equal(store.reads, 1);
  assert.equal(store.peek().mappings["991"], undefined);
});

test("an accepted send records the mapping, and the next poll does not send it twice", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() } });
  const store = memoryStore();
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(health.status, "ok");
  assert.equal(health.actions[0].outcome, "accepted");
  assert.equal(health.actions[0].positionId, "77");
  const row = store.peek().mappings["991"];
  assert.equal(row.symbol, "EURUSD");
  assert.equal(row.side, "buy");
  assert.equal(row.volume, 0.1);
  assert.equal(row.stop_price, 1.085);
  assert.equal(row.targetPositionId, "77");
  assert.equal(row.request_id, "copy-991");
  assert.equal(row.copied_utc, "2026-11-19T09:00:05.000Z");

  const second = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(second.actions.length, 0);
  assert.equal(client.calls.sends.length, 1);
});

test("the send carries the source stop and the ticket's own client order id", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() } });
  await pollOnce({ client, config: pollConfig(), deps: pollDeps() });
  assert.deepEqual(client.calls.sends[0], {
    type: "market",
    symbol: "EURUSD",
    side: "buy",
    volume: 0.1,
    stopPrice: 1.085,
    requestId: "copy-991",
    comment: "copy-991"
  });
});

test("the destination's price is read once per target symbol and stated in the health document", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, references: { EURUSD: 1.0881 } });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps() });
  assert.deepEqual(client.calls.references, ["EURUSD"]);
  assert.deepEqual(health.destination.references, { EURUSD: 1.0881 });
  assert.equal(health.actions[0].outcome, "accepted");
});

test("the destination spec summary states the contract's own volume scale and lot units", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, references: { EURUSD: 1.0881 } });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps() });
  const summary = health.destination.spec_summary.EURUSD;
  assert.equal(summary.volumeScale, 10000000);
  assert.equal(summary.lotSizeBtc, 100000);
  // The bounds are in lots, the same unit the copy size is floored in, not in protocol units.
  assert.equal(summary.minVolume, 0.01);
  assert.equal(summary.volumeStep, 0.01);
});

test("a price that cannot be read is noted and does not refuse the copy", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() } });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps() });
  assert.deepEqual(health.destination.references, {});
  assert.equal(health.source.ok, true);
  assert.equal(health.actions[0].outcome, "accepted");
  assert.ok(health.notes.some((note) => note.includes("no reference price for EURUSD")));
});

test("an unknown answer becomes a pending claim, and the next poll asks the broker instead of sending again", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, send: () => ({ outcome: "unknown", sent: true, clientOrderId: "copy-991" }) });
  const store = memoryStore();
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(health.actions[0].outcome, "unknown");
  assert.equal(store.peek().mappings["991"], undefined);
  const claim = store.peek().pending["991"];
  assert.equal(claim.request_id, "copy-991");
  assert.equal(claim.at_ms, Date.parse("2026-11-19T09:00:05Z"));
  assert.ok(health.notes.some((note) => note.includes("copy-991")));

  const second = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(client.calls.sends.length, 1);
  assert.deepEqual(client.calls.finds, ["copy-991"]);
  assert.ok(second.refusals.some((row) => row.code === "copy_pending_reconcile"));
  assert.equal(store.peek().pending["991"].request_id, "copy-991");
});

test("a pending claim the broker answers with a position becomes the mapping, and nothing is sent", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    find: (requestId) => ({ order: null, position: { positionId: "8123", symbol: "EURUSD", volume: 0.1 } })
  });
  const store = memoryStore({
    mappings: {},
    pending: { 991: { request_id: "copy-991", at_ms: Date.parse("2026-11-19T09:00:00Z"), source_symbol: "EURUSD", symbol: "EURUSD", side: "buy", volume: 0.1, stop_price: 1.085 } },
    attempts: {}
  });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(health.reconcile.mapped, 1);
  assert.equal(store.peek().mappings["991"].targetPositionId, "8123");
  assert.equal(store.peek().mappings["991"].reconciled, true);
  assert.equal(store.peek().pending["991"], undefined);
  assert.deepEqual(client.calls.sends, []);
  assert.ok(health.notes.some((note) => note.includes("8123")));
});

test("a pending claim the source has since closed is dropped, and no copy is closed because none was made", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, find: () => null });
  const store = memoryStore({
    mappings: {},
    pending: { 991: { request_id: "copy-991", at_ms: Date.parse("2026-11-19T09:00:00Z"), symbol: "EURUSD", side: "buy", volume: 0.1 } },
    attempts: {}
  });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc: sourceDoc({ positions: [] }) }) });
  assert.equal(health.reconcile.dropped, 1);
  assert.equal(store.peek().pending["991"], undefined);
  assert.equal(store.peek().mappings["991"], undefined);
  assert.deepEqual(client.calls.sends, []);
  assert.deepEqual(client.calls.closes, []);
});

test("a pending claim the broker never answers expires into a retry under a new client order id", async () => {
  const start = Date.parse("2026-11-19T09:00:00Z");
  const client = fakeClient({ specs: { EURUSD: spec() }, find: () => null });
  const store = memoryStore({
    mappings: {},
    pending: { 991: { request_id: "copy-991", at_ms: start, symbol: "EURUSD", side: "buy", volume: 0.1, stop_price: 1.085 } },
    attempts: {}
  });

  const early = await pollOnce({ client, config: pollConfig({ pendingTtlMs: 600000 }), deps: pollDeps({ store }) });
  assert.equal(early.reconcile.dropped, 0);
  assert.equal(store.peek().pending["991"].request_id, "copy-991");
  assert.deepEqual(client.calls.sends, []);

  const later = await pollOnce({
    client,
    config: pollConfig({ pendingTtlMs: 600000 }),
    deps: { ...pollDeps({ store }), now: () => start + 660000 }
  });
  assert.equal(later.reconcile.dropped, 1);
  assert.equal(store.peek().attempts["991"], 1);
  assert.equal(client.calls.sends.length, 1);
  assert.equal(client.calls.sends[0].requestId, "copy-991-a1");
});

test("a broker that cannot answer leaves the claim exactly where it was", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    find: () => { throw codedError("timeout", "the transport did not answer"); }
  });
  const store = memoryStore({
    mappings: {},
    pending: { 991: { request_id: "copy-991", at_ms: Date.parse("2026-11-19T09:00:00Z"), symbol: "EURUSD", side: "buy", volume: 0.1 } },
    attempts: {}
  });
  const health = await pollOnce({ client, config: pollConfig({ pendingTtlMs: 1000 }), deps: { ...pollDeps({ store }), now: () => Date.parse("2026-11-19T10:00:00Z") } });
  assert.equal(health.reconcile.dropped, 0);
  assert.equal(store.peek().pending["991"].request_id, "copy-991");
  assert.deepEqual(client.calls.sends, []);
  assert.ok(health.notes.some((note) => note.includes("could not be asked")));
});

test("a refused send is reported and remembered as nothing", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, send: () => ({ outcome: "refused", sent: true, message: "MARKET_CLOSED" }) });
  const store = memoryStore();
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(health.actions[0].outcome, "refused");
  assert.equal(store.peek().mappings["991"], undefined);
});

test("a source position that is gone closes its copy and clears the mapping", async () => {
  const store = memoryStore({ mappings: { 991: { symbol: "EURUSD", targetPositionId: "77", side: "buy", volume: 0.1 } } });
  const client = fakeClient({ specs: { EURUSD: spec() } });
  const health = await pollOnce({
    client,
    config: pollConfig(),
    deps: pollDeps({ store, doc: sourceDoc({ positions: [] }) })
  });
  assert.equal(health.status, "ok");
  assert.equal(client.calls.closes.length, 1);
  // The close names the symbol it takes out, so the adapter can resolve that contract's own protocol volume
  // scale instead of assuming the BTCUSD one, and states the size the copy was opened at.
  assert.deepEqual(client.calls.closes[0], { positionId: "77", symbol: "EURUSD", volume: 0.1, reason: "source_closed" });
  assert.deepEqual(store.peek().mappings, {});
});

test("a close moves the row into a bounded history so the ticket survives after the mapping has gone", async () => {
  const store = memoryStore({
    mappings: {
      991: { source_ticket: "991", source_symbol: "EURUSD", symbol: "EURUSD", targetPositionId: "77", side: "buy", volume: 0.1, stop_price: 1.085, request_id: "copy-991", copied_utc: "2026-11-19T09:00:05.000Z" }
    }
  });
  const client = fakeClient({ specs: { EURUSD: spec() } });
  await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc: sourceDoc({ positions: [] }) }) });
  const history = store.peek().history;
  assert.equal(history.length, 1);
  assert.equal(history[0].source_ticket, "991");
  assert.equal(history[0].target_position_id, "77");
  assert.equal(history[0].symbol, "EURUSD");
  assert.equal(history[0].volume, 0.1);
  assert.equal(history[0].close_outcome, "accepted");
  assert.equal(history[0].closed_utc, "2026-11-19T09:00:05.000Z");

  // The history is not a live claim: the next poll plans no second close and sends nothing.
  const second = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc: sourceDoc({ positions: [] }) }) });
  assert.equal(second.closes.length, 0);
  assert.equal(client.calls.closes.length, 1);

  // It is bounded: a store that already carries the limit keeps the newest row and drops the oldest.
  const full = memoryStore({
    mappings: { 991: { symbol: "EURUSD", targetPositionId: "77" } },
    history: Array.from({ length: 200 }, (_, index) => ({ source_ticket: String(900000 + index) }))
  });
  await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store: full, doc: sourceDoc({ positions: [] }) }) });
  assert.equal(full.peek().history.length, 200);
  assert.equal(full.peek().history[0].source_ticket, "991");
  assert.equal(full.peek().history[199].source_ticket, "900198");
});

test("the health document states the source tickets it read, not only how many", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() } });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps() });
  assert.equal(health.source.positions, 1);
  assert.deepEqual(health.source.rows.map((row) => row.ticket), ["991"]);
  assert.equal(health.source.rows[0].symbol, "EURUSD");
  assert.equal(health.source.rows[0].stop, 1.085);
});

test("a failed source read opens nothing and closes nothing, even with mappings in the store", async () => {
  const store = memoryStore({ mappings: { 991: { symbol: "EURUSD", targetPositionId: "77" } } });
  const client = fakeClient({ specs: { EURUSD: spec() } });
  const health = await pollOnce({
    client,
    config: pollConfig(),
    deps: { ...pollDeps({ store }), readSource: async () => ({ ok: false, cause: "source_probe_failed", positions: [] }) }
  });
  assert.equal(health.status, "source_unreadable");
  assert.equal(health.source.ok, false);
  assert.deepEqual(client.calls.closes, []);
  assert.deepEqual(client.calls.sends, []);
  assert.equal(store.peek().mappings["991"].targetPositionId, "77");
});

test("a destination symbol the broker will not describe refuses the copy and says why", async () => {
  const store = memoryStore();
  const client = fakeClient({ specs: {} });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(health.destination.spec_refusals.length, 1);
  assert.deepEqual(health.refusals.map((row) => row.code), ["target_symbol_unknown"]);
  assert.deepEqual(client.calls.sends, []);
  assert.deepEqual(store.peek().mappings, {});
});


// ---- the lock ----

test("the second copier on the machine is refused while the first is alive, and a stale lock is taken over", () => {
  const dir = tempDir();
  const file = path.join(dir, "copier.lock");

  const first = acquireLock(file, { now: () => Date.parse("2026-11-19T09:00:00Z") });
  assert.equal(first.ok, true);
  const held = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(held.pid, process.pid);

  // The same process asking twice is not a second copier.
  const again = acquireLock(file);
  assert.equal(again.ok, true);
  again.release();
  assert.equal(fs.existsSync(file), false);

  // A pid that is not running is stale, and takes no hand to clear.
  fs.writeFileSync(file, JSON.stringify({ pid: 999999, started_utc: "2026-11-19T08:00:00Z" }), "utf8");
  const taken = acquireLock(file);
  assert.equal(taken.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).pid, process.pid);
  taken.release();
  assert.equal(fs.existsSync(file), false);
});

// ---- the probe call ----

test("the probe reader reads the document it is given and calls a silent probe a failed read", () => {
  const dir = tempDir();
  const good = path.join(dir, "good.js");
  fs.writeFileSync(good, `process.stdout.write(${JSON.stringify(JSON.stringify(sourceDoc()))});\n`, "utf8");
  const silent = path.join(dir, "silent.js");
  fs.writeFileSync(silent, "process.exit(1);\n", "utf8");
  const garbage = path.join(dir, "garbage.js");
  fs.writeFileSync(garbage, 'process.stdout.write("not json");\n', "utf8");

  const read = createProbeReader({ python: process.execPath, script: good });
  return read().then((result) => {
    assert.equal(result.ok, true);
    assert.equal(result.positions.length, 1);

    const empty = createProbeReader({ python: process.execPath, script: silent })();
    return empty.then((value) => {
      assert.equal(value.ok, false);
      assert.equal(value.cause, "source_probe_failed");
      const broken = createProbeReader({ python: process.execPath, script: garbage })();
      return broken.then((row) => {
        assert.equal(row.ok, false);
        assert.equal(row.cause, "source_probe_unparsable");
      });
    });
  });
});

test("the probe reader will not be built without the executable and the script", () => {
  assert.throws(() => createProbeReader({}), /python executable and the probe script/);
});


test("a copier that sends needs the account named; a dry run does not", () => {
  const base = ["--vault", "C:/v.vault", "--login", "7348195", "--state", "C:/s.json", "--probe", "C:/p.py"];
  const sending = copier.parseArgs(base);
  assert.ok(sending.refusals.some((row) => row.startsWith("confirm_missing")));

  const dry = copier.parseArgs([...base, "--dry-run"]);
  assert.deepEqual(dry.refusals, []);
  assert.equal(dry.dryRun, true);
  assert.equal(dry.expectLive, false);
  assert.equal(dry.intervalSeconds, 15);

  const live = copier.parseArgs([...base, "--confirm-account", "42585819", "--expect-live", "--interval-seconds=5", "--max-lots=0.5"]);
  assert.deepEqual(live.refusals, []);
  assert.equal(live.confirmAccount, "42585819");
  assert.equal(live.expectLive, true);
  assert.equal(live.intervalSeconds, 5);
  assert.equal(live.maxLots, 0.5);

  const missing = copier.parseArgs([]);
  assert.ok(missing.refusals.some((row) => row.startsWith("vault_missing")));
  assert.ok(missing.refusals.some((row) => row.startsWith("login_missing")));
  assert.ok(missing.refusals.some((row) => row.startsWith("state_missing")));
  assert.ok(missing.refusals.some((row) => row.startsWith("probe_missing")));
});


// ---- the resting copies ----
//
// A working source order is a different thing from a position: it waits, so the copy waits too, and every one of its
// four lives - placed, amended, cancelled, filled - is decided from the two books rather than from what was last sent.

// A working source order: a buy limit below the market, protected, with the date the source gave it.
function sourceOrder(over = {}) {
  return {
    ticket: 992,
    symbol: "EURUSD",
    side: "buy",
    kind_name: "limit",
    volume: 0.1,
    price_open: 1.085,
    stop_loss: 1.0835,
    take_profit: 1.0925,
    magic: 20261006,
    time_expiration_utc: "2026-11-20T17:00:00Z",
    ...over
  };
}

// The destination's own view of that order's copy, in the shape the adapter returns its working rows in.
function destOrder(over = {}) {
  return {
    orderId: "5001",
    side: "buy",
    volume: 0.1,
    orderType: "limit",
    statusName: "accepted",
    working: true,
    price: 1.085,
    stopPrice: null,
    stopLoss: 1.0835,
    targetPrice: 1.0925,
    expirationTimestampMs: Date.parse("2026-11-20T17:00:00Z"),
    clientOrderId: "lim-992",
    positionId: null,
    ...over
  };
}

function orderState(over = {}) {
  return {
    kind: "order",
    source_ticket: "992",
    source_symbol: "EURUSD",
    symbol: "EURUSD",
    side: "buy",
    order_kind: "limit",
    volume: 0.1,
    source_volume: 0.1,
    price: 1.085,
    stop_price: 1.0835,
    target_price: 1.0925,
    expiry_ms: Date.parse("2026-11-20T17:00:00Z"),
    target_order_id: "5001",
    request_id: "lim-992",
    copied_utc: "2026-11-19T09:00:05.000Z",
    ...over
  };
}

test("a working source order is copied as a working order at its own entry, protected and dated as the source has it", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, references: { EURUSD: 1.09 } });
  const store = memoryStore();
  const health = await pollOnce({
    client,
    config: pollConfig(),
    deps: pollDeps({ store, doc: sourceDoc({ positions: [], orders: [sourceOrder()] }) })
  });
  assert.equal(health.status, "ok");
  assert.deepEqual(client.calls.sends, []); // an order that waits is never sent as a market copy
  assert.equal(client.calls.pendings.length, 1);
  const sent = client.calls.pendings[0];
  assert.equal(sent.type, "limit");
  assert.equal(sent.symbol, "EURUSD");
  assert.equal(sent.side, "buy");
  assert.equal(sent.volume, 0.1);
  assert.equal(sent.price, 1.085);
  assert.equal(sent.stopLoss, 1.0835); // the protection, never the entry
  assert.equal(sent.takeProfit, 1.0925);
  assert.equal(sent.expiryMs, Date.parse("2026-11-20T17:00:00Z"));
  assert.equal(sent.requestId, "lim-992");

  const placed = health.pending_orders.placed[0];
  assert.equal(placed.outcome, "accepted");
  assert.equal(placed.orderId, "5001");
  const row = store.peek().mappings["992"];
  assert.equal(row.kind, "order");
  assert.equal(row.target_order_id, "5001");
  assert.equal(row.order_kind, "limit");
  assert.equal(row.volume, 0.1);
  assert.equal(row.source_volume, 0.1); // the baseline a partial close would be measured against
  assert.equal(row.price, 1.085);
  assert.equal(row.stop_price, 1.0835);
  assert.equal(row.target_price, 1.0925);
  assert.equal(row.expiry_ms, Date.parse("2026-11-20T17:00:00Z"));
  assert.equal(row.request_id, "lim-992");
  assert.equal(row.reconciled, false); // recorded from the send, not yet from a destination read
});

test("a source order kind the destination cannot mirror is refused, and an entry on the market side with it", async () => {
  const client = fakeClient({ specs: { EURUSD: spec() }, references: { EURUSD: 1.09 } });
  const health = await pollOnce({
    client,
    config: pollConfig(),
    deps: pollDeps({
      doc: sourceDoc({
        positions: [],
        orders: [sourceOrder({ kind_name: "stop_limit" }), sourceOrder({ ticket: 993, price_open: 1.095 })]
      })
    })
  });
  assert.deepEqual(client.calls.pendings, []);
  assert.ok(health.refusals.some((row) => row.code === "order_kind_unsupported" && row.ticket === "992"));
  assert.ok(health.refusals.some((row) => row.code === "limit_on_wrong_side" && row.ticket === "993"));
});

test("a place the broker answers unknown is a claim, and the next poll records the order it holds under our client order id", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.09 },
    pendingOrder: () => ({ outcome: "unknown", orderId: null, sent: true }),
    order: (id) => (id === "lim-992" ? destOrder({ clientOrderId: "lim-992" }) : destOrder())
  });
  const store = memoryStore();
  const doc = sourceDoc({ positions: [], orders: [sourceOrder()] });

  const first = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.equal(first.pending_orders.placed[0].outcome, "unknown");
  assert.equal(store.peek().mappings["992"], undefined);
  const claim = store.peek().pending["992"];
  assert.equal(claim.kind, "order");
  assert.equal(claim.request_id, "lim-992");
  assert.equal(claim.order_type, "limit");
  assert.equal(claim.price, 1.085);

  // The broker was asked by our own id and holds the order: it is recorded, and nothing is sent again.
  const second = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.deepEqual(client.calls.orderFinds, ["lim-992"]);
  assert.equal(client.calls.pendings.length, 1);
  assert.equal(second.reconcile.mapped, 1);
  assert.equal(store.peek().mappings["992"].target_order_id, "5001");
  assert.equal(store.peek().pending["992"], undefined);
});

test("an order the broker accepted without naming it is claimed by its client order id, and the claim survives a restart", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.09 },
    pendingOrder: () => ({ outcome: "accepted", orderId: null, sent: true })
  });
  const store = memoryStore();
  const doc = sourceDoc({ positions: [], orders: [sourceOrder()] });
  await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.equal(store.peek().mappings["992"], undefined);
  assert.equal(store.peek().pending["992"].request_id, "lim-992");

  // A new run reads the store rather than its own memory: the claim is what stops a second order being placed.
  const restarted = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.09 },
    order: () => destOrder()
  });
  const after = await pollOnce({ client: restarted, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.deepEqual(restarted.calls.pendings, []);
  assert.equal(after.reconcile.mapped, 1);
  assert.equal(store.peek().mappings["992"].target_order_id, "5001");
});

test("a source that moves its order's entry and stop amends the copy in place, and the next destination read confirms it", async () => {
  const orders = { EURUSD: [destOrder()] };
  const client = fakeClient({ specs: { EURUSD: spec() }, references: { EURUSD: 1.09 }, orders });
  const store = memoryStore({ mappings: { 992: orderState() }, pending: {}, attempts: {} });
  const doc = sourceDoc({ positions: [], orders: [sourceOrder({ price_open: 1.086, stop_loss: 1.085 })] });

  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.equal(client.calls.amends.length, 1);
  const amend = client.calls.amends[0];
  assert.equal(amend.orderId, "5001");
  assert.equal(amend.symbol, "EURUSD");
  assert.equal(amend.limitPrice, 1.086); // the entry keeps the entry field
  assert.equal(amend.stopLoss, 1.085); // the protection is sent as stopLoss, never as the entry's stopPrice
  assert.equal(amend.stopPrice, undefined);
  assert.equal(amend.takeProfit, undefined); // the target did not move, so it is not restated
  assert.equal(amend.expiryMs, undefined);
  assert.equal(health.pending_orders.amended[0].outcome, "accepted");
  const row = store.peek().mappings["992"];
  assert.equal(row.price, 1.086);
  assert.equal(row.stop_price, 1.085);
  assert.equal(row.amend_confirmed, false); // asked for, not yet seen in a destination read

  // The destination now states the order as amended, so nothing is amended twice.
  orders.EURUSD = [destOrder({ price: 1.086, stopLoss: 1.085 })];
  await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.equal(client.calls.amends.length, 1);
});

test("a source order cancelled leaves the destination book by cancel, and the mapping moves to history", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.09 },
    orders: { EURUSD: [destOrder()] }
  });
  const store = memoryStore({ mappings: { 992: orderState() }, pending: {}, attempts: {} });
  const health = await pollOnce({
    client,
    config: pollConfig(),
    deps: pollDeps({ store, doc: sourceDoc({ positions: [], orders: [] }) })
  });
  assert.deepEqual(client.calls.cancels, [{ orderId: "5001", symbol: "EURUSD" }]);
  assert.equal(health.pending_orders.cancelled[0].outcome, "accepted");
  assert.equal(store.peek().mappings["992"], undefined);
  const entry = store.peek().history[0];
  assert.equal(entry.source_ticket, "992");
  assert.equal(entry.target_order_id, "5001");
  assert.equal(entry.close_outcome, "cancelled");
  assert.equal(entry.close_reason, "source_order_gone");
  assert.equal(entry.request_id, "lim-992");
});

test("a claim the broker answers as filled becomes the position it filled into, and the source position follows it by alias", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.09 },
    order: () => ({ orderId: "5001", statusName: "filled", working: false, positionId: "4242" })
  });
  const store = memoryStore({
    mappings: {},
    pending: {
      992: {
        kind: "order",
        request_id: "lim-992",
        at_ms: Date.parse("2026-11-19T08:59:00Z"),
        at_utc: "2026-11-19T08:59:00.000Z",
        source_symbol: "EURUSD",
        symbol: "EURUSD",
        side: "buy",
        order_type: "limit",
        volume: 0.1,
        source_volume: 0.1,
        price: 1.085,
        stop_price: 1.085,
        target_price: 1.0925,
        expiry_ms: null
      }
    },
    attempts: {}
  });
  const health = await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store }) });
  assert.equal(health.reconcile.filled, 1);
  const state = store.peek();
  assert.equal(state.mappings["992"].kind, "position");
  assert.equal(state.mappings["992"].target_position_id, "4242");
  assert.equal(state.mappings["992"].source_position_ticket, "991");
  assert.equal(state.aliases["991"], "992");
  assert.equal(state.pending["992"], undefined);
  // The copy is followed through the position the order became, so the source position is not opened a second time.
  assert.deepEqual(client.calls.sends, []);
});

test("a copy the destination cancelled while the source still holds the order is re-placed under a new client order id", async () => {
  const client = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.09 },
    orders: { EURUSD: [] },
    order: () => ({ orderId: "5001", statusName: "cancelled", working: false, positionId: null })
  });
  const store = memoryStore({ mappings: { 992: orderState() }, pending: {}, attempts: {} });
  const doc = sourceDoc({ positions: [], orders: [sourceOrder()] });

  await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.deepEqual(client.calls.orderGets, ["5001"]);
  assert.equal(store.peek().mappings["992"], undefined);
  assert.equal(store.peek().history[0].close_outcome, "cancelled");
  assert.equal(store.peek().history[0].close_reason, "order_left_book");
  assert.equal(store.peek().attempts["992"], 1); // the next send must not reuse an id the broker may have held

  await pollOnce({ client, config: pollConfig(), deps: pollDeps({ store, doc }) });
  assert.equal(client.calls.pendings.length, 1);
  assert.equal(client.calls.pendings[0].requestId, "lim-992-a1");
  assert.equal(store.peek().mappings["992"].request_id, "lim-992-a1");
});

test("a partial close at the source takes the same volume off the copy, once, and states the new baseline", async () => {
  const store = memoryStore({
    mappings: {
      991: {
        source_ticket: "991",
        source_symbol: "EURUSD",
        symbol: "EURUSD",
        side: "buy",
        volume: 0.2,
        source_volume: 0.2,
        stop_price: 1.085,
        target_position_id: "77",
        targetPositionId: "77",
        request_id: "copy-991",
        copied_utc: "2026-11-19T08:55:05.000Z"
      }
    },
    pending: {},
    attempts: {}
  });
  const client = fakeClient({
    specs: { EURUSD: spec() },
    references: { EURUSD: 1.0885 },
    exposure: {
      EURUSD: [{ positionId: "77", side: "buy", volume: 0.2, protectionStop: 1.085, targetPrice: 1.0925, price: 1.08765 }]
    }
  });
  // The source closed half of its position and still holds the rest, with the same protection.
  const doc = sourceDoc({
    positions: [{
      ticket: 991,
      symbol: "EURUSD",
      side: "buy",
      volume: 0.1,
      price_open: 1.08765,
      price_current: 1.0882,
      stop_loss: 1.085,
      take_profit: 1.0925,
      magic: 20261006,
      time_utc: "2026-11-19T08:55:00Z"
    }],
    orders: []
  });
  const deps = pollDeps({ store, doc });

  const health = await pollOnce({ client, config: pollConfig(), deps });
  assert.deepEqual(client.calls.closes, [{ positionId: "77", symbol: "EURUSD", volume: 0.1, reason: "source_partial_close" }]);
  assert.equal(health.closes[0].partial, true);
  const row = store.peek().mappings["991"];
  assert.ok(row, "a partial close leaves the copy open and followed");
  assert.equal(row.source_volume, 0.1);
  assert.equal(store.peek().close_unknown["77"].volume, 0.1);

  // The same source volume is not closed twice: the baseline moved with the close.
  await pollOnce({ client, config: pollConfig(), deps });
  assert.equal(client.calls.closes.length, 1);
});

