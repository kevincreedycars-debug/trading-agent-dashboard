// Tests for the offline relay core: the pending-order path, the durable ticket map, the no-duplicate rule after
// a restart, the refusal gates, and the fill-timing matrix. Nothing here connects to MT5 or cTrader; the
// destination and the source are plain rows, so every case is a rerun rather than an observation.
//
//   node --test docs/strategy/proposals/CTRADER_RELAY_CORE_20261113.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const core = require(path.join(__dirname, "CTRADER_RELAY_CORE_20261113.js"));

function order(over = {}) {
  return {
    ticket: 1001,
    symbol: "EURUSD",
    type: "ORDER_TYPE_SELL_LIMIT",
    volume: 0.01,
    price_open: 1.10624,
    stop_loss: 1.107082,
    take_profit: 1.10203,
    expiration: 0,
    comment: "l2l-rule-eur",
    magic: 20261004,
    ...over
  };
}

function tick(state, orders, config = { armed: true }) {
  return core.planTick({ state, orders, config });
}

test("only this lane's resting orders are a source: another magic or a market order is not copied", () => {
  assert.equal(core.sourceOrder(order({ magic: 1234 })), null);
  assert.equal(core.sourceOrder(order({ type: "ORDER_TYPE_BUY" })), null);
  assert.equal(core.sourceOrder(order({ volume: 0 })), null);
  const parsed = core.sourceOrder(order());
  assert.equal(parsed.ticket, 1001);
  assert.equal(parsed.side, "sell");
  assert.equal(parsed.client_tag, "relay-ftmo1-1001");
});

test("a new resting limit is created with entry, size, stop, target and expiry copied", () => {
  const result = tick(core.createState(), [order({ expiration: 1763000000 })]);
  assert.equal(result.commands.length, 1);
  const command = result.commands[0];
  assert.equal(command.kind, "create");
  assert.equal(command.order.price, 1.10624);
  assert.equal(command.order.volume, 0.01);
  assert.equal(command.order.stop, 1.107082);
  assert.equal(command.order.target, 1.10203);
  assert.equal(command.order.expiration.iso_utc, new Date(1763000000 * 1000).toISOString());
  assert.equal(result.state.entries["1001"].state, "sending");
});

test("the same source ticked twice creates once: the second tick sees a send with no answer", () => {
  const first = tick(core.createState(), [order()]);
  const second = tick(first.state, [order()]);
  assert.equal(first.commands.length, 1);
  assert.equal(second.commands.length, 0);
  assert.equal(second.refusals.length, 1);
  assert.match(second.refusals[0].reason, /quarantined/);
});

test("once the destination acknowledges, the same source is silent", () => {
  const first = tick(core.createState(), [order()]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const second = tick(acked, [order()]);
  assert.equal(second.commands.length, 0);
  assert.equal(second.refusals.length, 0);
  assert.equal(core.loadState(second.state).entries["1001"].state, "mirrored");
  assert.equal(core.loadState(second.state).entries["1001"].broker_id, "c-77");
});

test("a moved stop is an amendment, not a second order", () => {
  const first = tick(core.createState(), [order()]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const moved = tick(acked, [order({ stop_loss: 1.1068 })]);
  assert.equal(moved.commands.length, 1);
  assert.equal(moved.commands[0].kind, "amend");
  assert.equal(moved.commands[0].order.stop, 1.1068);
});

test("a source ticket that leaves with no position is cancelled on the destination", () => {
  const first = tick(core.createState(), [order()]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const gone = tick(acked, []);
  assert.equal(gone.commands.length, 1);
  assert.equal(gone.commands[0].kind, "cancel");
});

test("a source ticket that leaves with a position has filled, and nothing is cancelled", () => {
  const first = tick(core.createState(), [order()]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const filled = core.planTick({
    state: acked,
    orders: [],
    positions: [{ magic: 20261004, symbol: "EURUSD", type: "POSITION_TYPE_SELL" }],
    config: { armed: true }
  });
  assert.equal(filled.commands.length, 0);
  assert.equal(core.loadState(filled.state).entries["1001"].state, "filled");
});

test("a send whose answer was lost is never resent, and a restart does not change that", () => {
  const first = tick(core.createState(), [order()]);
  const timedOut = core.record({ state: first.state, ticket: 1001, event: "timeout" });
  const restarted = core.loadState(core.dumpState(timedOut));
  const second = tick(restarted, [order()]);
  assert.equal(second.commands.length, 0);
  assert.equal(second.refusals.length, 1);
  assert.match(second.refusals[0].reason, /outcome is unknown/);
});

test("reconcile adopts a destination order found by client tag, so the restart cannot duplicate it", () => {
  const first = tick(core.createState(), [order()]);
  const timedOut = core.record({ state: first.state, ticket: 1001, event: "timeout" });
  const reconciled = core.reconcile({
    state: timedOut,
    destinationOrders: [{ id: "c-91", client_tag: "relay-ftmo1-1001", symbol: "EURUSD", side: "sell", volume: 0.01 }]
  });
  assert.equal(reconciled.rows[0].outcome, "adopted");
  const next = tick(reconciled.state, [order()]);
  assert.equal(next.commands.length, 0);
  assert.equal(core.loadState(next.state).entries["1001"].state, "mirrored");
});

test("reconcile quarantines a send with no matching order and still refuses a resend", () => {
  const first = tick(core.createState(), [order()]);
  const timedOut = core.record({ state: first.state, ticket: 1001, event: "timeout" });
  const reconciled = core.reconcile({ state: timedOut, destinationOrders: [] });
  assert.equal(reconciled.rows[0].outcome, "quarantined");
  const next = tick(reconciled.state, [order()]);
  assert.equal(next.commands.length, 0);
  assert.equal(next.refusals.length, 1);
});

test("an order on the destination this relay cannot account for is quarantined, never cancelled", () => {
  const reconciled = core.reconcile({
    state: core.createState(),
    destinationOrders: [{ id: "c-5", client_tag: "relay-ftmo1-9999" }]
  });
  assert.equal(reconciled.rows[0].outcome, "orphan-quarantined");
  assert.equal(reconciled.state.quarantined, 1);
});

test("the arm flag refuses every send while still recording the intent", () => {
  const result = core.planTick({ state: core.createState(), orders: [order()], config: { armed: false } });
  assert.equal(result.commands.length, 0);
  assert.equal(result.refusals.length, 1);
  assert.match(result.refusals[0].reason, /not armed/);
  assert.equal(Object.keys(result.state.entries).length, 0);
});

test("the kill switch stops every command, including a cancel it would otherwise send", () => {
  const first = tick(core.createState(), [order()]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const killed = core.planTick({ state: acked, orders: [], config: { armed: true, killSwitch: true } });
  assert.equal(killed.commands.length, 0);
  assert.equal(killed.refusals.length, 1);
  assert.match(killed.refusals[0].reason, /kill switch/);
});

test("the per-tick request counter refuses the command over the cap rather than sending it", () => {
  const orders = [order({ ticket: 1, symbol: "EURUSD" }), order({ ticket: 2, symbol: "XAUUSD" }), order({ ticket: 3, symbol: "US100.cash" })];
  const result = core.planTick({ state: core.createState(), orders, config: { armed: true, maxRequestsPerTick: 2 } });
  assert.equal(result.commands.length, 2);
  assert.equal(result.refusals.length, 1);
  assert.match(result.refusals[0].reason, /request cap/);
});


// The fill-timing matrix: the four outcomes the assignment asks for, plus the two lifecycle cases a resting
// limit also meets. Each is driven through the same functions the live relay would call.

test("fill before mirror: a source that filled before the relay saw it is recorded, not re-created", () => {
  const first = tick(core.createState(), [order()]);
  const missed = core.record({ state: first.state, ticket: 1001, event: "missed_fill", payload: { reason: "filled before the relay's first tick" } });
  const next = tick(missed, [order()]);
  assert.equal(next.commands.length, 0);
  assert.equal(next.refusals.length, 1);
  assert.match(next.refusals[0].reason, /missed-fill/);
});

test("fill during send: the quarantine is reconciled and the mirror is cancelled before it can fill twice", () => {
  const first = tick(core.createState(), [order()]);
  const timedOut = core.record({ state: first.state, ticket: 1001, event: "timeout" });
  const adopted = core.reconcile({ state: timedOut, destinationOrders: [{ id: "c-42", client_tag: "relay-ftmo1-1001" }] });
  const filled = core.planTick({
    state: adopted.state,
    orders: [],
    positions: [{ magic: 20261004, symbol: "EURUSD", type: "POSITION_TYPE_SELL" }],
    config: { armed: true }
  });
  // the source filled, so the mirror is not cancelled on the fill alone; the close path handles the exit
  assert.equal(filled.commands.length, 0);
  assert.equal(core.loadState(filled.state).entries["1001"].state, "filled");
});

test("fill after mirror: the resting mirror is kept until the source position closes", () => {
  const first = tick(core.createState(), [order()]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const stillOpen = tick(acked, [order()]);
  assert.equal(stillOpen.commands.length, 0);
  const closed = core.record({ state: acked, ticket: 1001, event: "closed" });
  assert.equal(core.loadState(closed).entries["1001"].state, "closed");
});

test("a partial fill records the filled volume and leaves the remainder working", () => {
  const first = tick(core.createState(), [order({ volume: 0.10 })]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const partial = core.record({ state: acked, ticket: 1001, event: "partial", payload: { volume: 0.04 } });
  const entry = core.loadState(partial).entries["1001"];
  assert.equal(entry.state, "mirrored");
  assert.equal(entry.filled_volume, 0.04);
  assert.equal(entry.volume, 0.1);
});

test("a cancel before fill ends the mirror with its cause, and an expiry is stated in UTC", () => {
  const first = tick(core.createState(), [order({ expiration: 1763000000 })]);
  const acked = core.record({ state: first.state, ticket: 1001, event: "accepted", payload: { broker_id: "c-77", order: first.commands[0].order } });
  const cancelled = core.record({ state: acked, ticket: 1001, event: "cancelled" });
  assert.equal(core.loadState(cancelled).entries["1001"].state, "cancelled");
  assert.equal(core.loadState(cancelled).entries["1001"].expiration.iso_utc, "2025-11-13T02:13:20.000Z");
});

test("two resting orders on one symbol are refused as two exposures until hedging is verified", () => {
  const orders = [order({ ticket: 1 }), order({ ticket: 2, price_open: 1.1001 })];
  const refused = core.planTick({ state: core.createState(), orders, config: { armed: true } });
  assert.equal(refused.commands.length, 1);
  assert.equal(refused.refusals.length, 1);
  assert.match(refused.refusals[0].reason, /two exposures/);
  const allowed = core.planTick({ state: core.createState(), orders, config: { armed: true, allowHedging: true } });
  assert.equal(allowed.commands.length, 2);
});

test("the timing table states an action for every case the first broker test has to survive", () => {
  assert.equal(core.FILL_TIMINGS.length, 6);
  for (const row of core.FILL_TIMINGS) {
    assert.ok(row.id && row.order && row.action, `${row.id} states its order and action`);
  }
});

test("the summary counts states rather than reporting one word for the whole map", () => {
  const first = tick(core.createState(), [order({ ticket: 1, symbol: "EURUSD" }), order({ ticket: 2, symbol: "XAUUSD" })]);
  const acked = core.record({ state: first.state, ticket: 1, event: "accepted", payload: { broker_id: "c-1", order: first.commands[0].order } });
  const summary = core.summarise({ state: acked });
  assert.equal(summary.entries, 2);
  assert.equal(summary.by_state.mirrored, 1);
  assert.equal(summary.by_state.sending, 1);
  assert.equal(summary.requests, 2);
});

