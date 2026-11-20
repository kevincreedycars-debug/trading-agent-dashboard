// Tests for the cTrader transport: the four wire scalings, the symbol contract mapping, the brace-depth frame
// reader, the request/response bookkeeping, the auth order and the two order builders. The transport is a
// string collector here, so nothing in this file opens a socket or touches a credential.
//
//   node --test docs/strategy/proposals/CTRADER_TRANSPORT_20261114.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const t = require(path.join(__dirname, "CTRADER_TRANSPORT_20261114.js"));

// A contract shaped like FTMO's BTCUSD: 1.00 BTC per lot, 0.01 lot minimum in 0.01 lot steps, digits 2, and a
// 2000 point minimum stop distance, which is 20.00 of price. Every number below is read from this object, so a
// wrong assumption shows up as a failing assertion rather than a wrong order.
const BTCUSD = {
  symbolId: 41,
  symbolName: "BTCUSD",
  digits: 2,
  lotSize: 100,
  minVolume: 1,
  maxVolume: 50000,
  stepVolume: 1,
  slDistance: 2000,
  distanceSetIn: 1,
  tradingMode: 0,
  guaranteedStopLoss: true
};

function fakeTransport({ onWrite } = {}) {
  const frames = [];
  return {
    frames,
    write(text) {
      frames.push(JSON.parse(text));
      if (onWrite) onWrite(text);
    },
    close() {}
  };
}

function clock() {
  const timers = new Map();
  let id = 0;
  return {
    setTimer(fn) {
      id += 1;
      timers.set(id, fn);
      return id;
    },
    clearTimer(handle) {
      timers.delete(handle);
    },
    tick() {
      const due = [...timers.values()];
      timers.clear();
      for (const fn of due) fn();
    },
    size() {
      return timers.size;
    }
  };
}

// 1. Volume: 0.01 of a unit per integer.
test("volume conversion: one lot is 100, the contract minimum is 1", () => {
  assert.equal(t.toProtocolVolume(0.01), 1);
  assert.equal(t.toProtocolVolume(0.8), 80);
  assert.equal(t.toProtocolVolume(1), 100);
  assert.equal(t.toProtocolVolume(0.05), 5);
  assert.equal(t.protocolVolumeToLots(80), 0.8);
  assert.equal(t.protocolVolumeToLots(1), 0.01);
  assert.equal(t.toProtocolVolume("0.25"), 25);
});

test("volume conversion refuses a size it cannot express rather than rounding it", () => {
  assert.throws(() => t.toProtocolVolume(0.001), (err) => err.code === "volume_not_in_hundredths");
  assert.throws(() => t.toProtocolVolume(1.234), (err) => err.code === "volume_not_in_hundredths");
  assert.throws(() => t.toProtocolVolume(0), (err) => err.code === "volume_invalid");
  assert.throws(() => t.toProtocolVolume(-1), (err) => err.code === "volume_invalid");
  assert.throws(() => t.toProtocolVolume("abc"), (err) => err.code === "volume_invalid");
});

// 2. Contract size: lotSize arrives in cents.
test("lot size conversion: 100 cents is 1.00 BTC per lot", () => {
  assert.equal(t.lotSizeInBtc(100), 1);
  assert.equal(t.lotSizeInBtc(1), 0.01);
  assert.equal(t.lotSizeInBtc(250000), 2500);
  assert.throws(() => t.lotSizeInBtc(0), (err) => err.code === "lot_size_invalid");
});

// 3. Stop distance: points at the symbol's digits.
test("distance conversion: 2000 points at 2 digits is 20.00 of price", () => {
  assert.equal(t.pointsToPrice(2000, 2), 20);
  assert.equal(t.pointsToPrice(2500, 1), 250);
  assert.equal(t.pointsToPrice(1, 3), 0.001);
  assert.equal(t.pointsToPrice(0, 2), 0);
  assert.throws(() => t.pointsToPrice(-1, 2), (err) => err.code === "distance_invalid");
  assert.throws(() => t.pointsToPrice(10, 2.5), (err) => err.code === "digits_invalid");
});

test("percentage distance is computed from the live price", () => {
  assert.equal(t.percentToPrice(50, 96000), 480); // 0.50 percent of 96000
  assert.throws(() => t.percentToPrice(50, 0), (err) => err.code === "price_invalid");
});

// 4. Spot and relative stop: 1/100000 of a price.
test("spot conversion: 9600012345 is 96000.12345", () => {
  assert.equal(t.spotToPrice(9600012345), 96000.12345);
  assert.equal(t.spotToPrice(1), 0.00001);
  assert.equal(t.priceToSpot(96000.12345), 9600012345);
  assert.equal(t.priceToRelativeStop(20), 2000000);
  assert.equal(t.priceToRelativeStop(250), 25000000);
  assert.equal(t.relativeStopToPrice(2000000), 20);
  assert.throws(() => t.priceToRelativeStop(0), (err) => err.code === "distance_invalid");
});

test("money conversion honours moneyDigits", () => {
  assert.equal(t.moneyFromProtocol(10000000000, 8), 100);
  assert.equal(t.moneyFromProtocol(12345678, 8), 0.12345678);
  assert.equal(t.moneyFromProtocol(125000, 2), 1250);
  assert.throws(() => t.moneyFromProtocol(1, 99), (err) => err.code === "money_digits_invalid");
});

test("the BTCUSD contract maps to lot units and a price distance", () => {
  const spec = t.symbolSpec(BTCUSD);
  assert.equal(spec.symbolId, 41);
  assert.equal(spec.digits, 2);
  assert.equal(spec.lotSizeBtc, 1);
  assert.equal(spec.minVolume, 0.01);
  assert.equal(spec.maxVolume, 500);
  assert.equal(spec.volumeStep, 0.01);
  assert.equal(spec.minStopDistance, 20);
  assert.equal(spec.tradeMode, "full");
  assert.equal(spec.raw.minVolume, 1);
  assert.equal(spec.raw.stepVolume, 1);
});

test("a percentage contract has no fixed minimum distance, and a missing field is a refusal", () => {
  const spec = t.symbolSpec({ ...BTCUSD, distanceSetIn: 2, slDistance: 50 });
  assert.equal(spec.distanceSetIn, "percentage");
  assert.equal(spec.minStopDistance, null);
  assert.equal(spec.minStopPercent, 0.5);
  assert.throws(() => t.symbolSpec({ ...BTCUSD, lotSize: undefined }), (err) => err.code === "lot_size_invalid");
  assert.throws(() => t.symbolSpec({ ...BTCUSD, minVolume: undefined }), (err) => err.code === "spec_incomplete");
});

test("the symbols list is searched by name, never by id", () => {
  const list = { symbol: [{ symbolId: 1, symbolName: "EURUSD" }, { symbolId: 41, symbolName: "BTCUSD" }] };
  assert.equal(t.findSymbol(list, "btcusd").symbolId, 41);
  assert.equal(t.findSymbol(list, "XAUUSD"), null);
});

test("a frame is the three documented fields, in that order", () => {
  const text = t.encodeFrame({ clientMsgId: "m-1", payloadType: 2106, payload: { volume: 1 } });
  assert.equal(text, '{"clientMsgId":"m-1","payloadType":2106,"payload":{"volume":1}}');
  assert.throws(() => t.encodeFrame({ clientMsgId: "", payloadType: 2106 }), (err) => err.code === "frame_invalid");
  assert.throws(() => t.encodeFrame({ clientMsgId: "m", payloadType: 0 }), (err) => err.code === "frame_invalid");
  assert.throws(() => t.encodeFrame({ clientMsgId: "m", payloadType: 2106, payload: [] }), (err) => err.code === "frame_invalid");
});

test("the reader cuts by brace depth, not by a separator, and survives a split inside a string", () => {
  const frame = t.encodeFrame({ clientMsgId: "m2", payloadType: 2106, payload: { comment: 'he said "}{" and left' } });
  const reader = t.createFrameReader();
  const seen = [];
  for (let i = 0; i < frame.length; i += 5) seen.push(...reader.push(frame.slice(i, i + 5)));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].payload.comment, 'he said "}{" and left');
  assert.equal(reader.buffered(), 0);
});

test("the reader returns every complete object and keeps the partial one for the next chunk", () => {
  const a = t.encodeFrame({ clientMsgId: "a", payloadType: 2122, payload: { n: 1 } });
  const b = t.encodeFrame({ clientMsgId: "b", payloadType: 2122, payload: { n: 2, inner: { deep: [1, 2] } } });
  const reader = t.createFrameReader();
  const seen = reader.push(`garbage before ${a}${b}{"clientMsgId":"c"`);
  assert.equal(seen.length, 2);
  assert.equal(seen[1].payload.inner.deep.length, 2);
  assert.equal(reader.buffered(), '{"clientMsgId":"c"'.length);
  const rest = reader.push(',"payloadType":50,"payload":{}}');
  assert.equal(rest.length, 1);
  assert.equal(rest[0].clientMsgId, "c");
});

test("an oversized buffer is refused rather than grown", () => {
  const reader = t.createFrameReader({ maxBuffer: 20 });
  assert.throws(() => reader.push("x".repeat(21)), (err) => err.code === "frame_too_large");
});

test("a call resolves on its own clientMsgId and leaves no timer behind", async () => {
  const transport = fakeTransport();
  const timers = clock();
  const session = t.createSession({ transport, now: () => 1000, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const pending = session.call(t.PAYLOAD.traderReq, { ctidTraderAccountId: 7 });
  const sent = transport.frames[0];
  assert.equal(sent.payloadType, 2121);
  session.handleChunk(JSON.stringify({ clientMsgId: sent.clientMsgId, payloadType: 2122, payload: { ctidTraderAccountId: 7 } }));
  const res = await pending;
  assert.equal(res.ctidTraderAccountId, 7);
  assert.equal(timers.size(), 0);
  assert.equal(session.stats().pending, 0);
});

test("an unexpected message becomes an event, not a reply", () => {
  const events = [];
  const transport = fakeTransport();
  const session = t.createSession({ transport, onEvent: (msg) => events.push(msg.payloadType) });
  session.handleChunk(JSON.stringify({ payloadType: 2131, payload: { symbolId: 41, bid: 1 } }));
  assert.deepEqual(events, [2131]);
  assert.equal(session.stats().pending, 0);
});

test("a broker error rejects the call with its error code", async () => {
  const transport = fakeTransport();
  const session = t.createSession({ transport });
  const pending = session.call(t.PAYLOAD.newOrderReq, { ctidTraderAccountId: 7 });
  const sent = transport.frames[0];
  session.handleChunk(JSON.stringify({
    clientMsgId: sent.clientMsgId,
    payloadType: 2142,
    payload: { errorCode: "ORDER_REJECTED", description: "not enough money" }
  }));
  await assert.rejects(pending, (err) => err.code === "broker_error" && err.errorCode === "ORDER_REJECTED" && err.sent === true);
});

test("a timeout is reported as uncertain and nothing is sent again", async () => {
  const transport = fakeTransport();
  const timers = clock();
  const session = t.createSession({ transport, setTimer: timers.setTimer, clearTimer: timers.clearTimer, requestTimeoutMs: 5000 });
  const pending = session.call(t.PAYLOAD.newOrderReq, { ctidTraderAccountId: 7 });
  assert.equal(transport.frames.length, 1);
  timers.tick();
  await assert.rejects(pending, (err) => err.code === "timeout" && err.sent === true);
  assert.equal(transport.frames.length, 1, "a timed-out request is never resent");
  assert.equal(session.stats().timeouts, 1);
});

test("closing the session rejects what is still in flight and refuses new writes", async () => {
  const transport = fakeTransport();
  const session = t.createSession({ transport });
  const pending = session.call(t.PAYLOAD.traderReq, { ctidTraderAccountId: 7 });
  session.close("test");
  await assert.rejects(pending, (err) => err.code === "session_closed");
  await assert.rejects(session.call(t.PAYLOAD.traderReq, {}), (err) => err.code === "session_closed");
  assert.throws(() => session.notify(t.PAYLOAD.heartbeatEvent, {}), (err) => err.code === "session_closed");
});

test("the heartbeat is payloadType 51 on the session's own clock", () => {
  const transport = fakeTransport();
  const timers = clock();
  const session = t.createSession({ transport, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  session.startHeartbeat(10000);
  timers.tick();
  assert.equal(transport.frames[0].payloadType, 51);
  assert.deepEqual(transport.frames[0].payload, {});
  timers.tick();
  assert.equal(transport.frames.length, 2);
  session.stopHeartbeat();
  assert.equal(timers.size(), 0);
});

function scriptedSession(accounts, extra = {}) {
  const calls = [];
  const session = {
    calls,
    call(payloadType, payload) {
      calls.push({ payloadType, payload });
      if (payloadType === 2100) return Promise.resolve({});
      if (payloadType === 2149) return Promise.resolve({ ctidTraderAccount: accounts });
      if (payloadType === 2102) return Promise.resolve({ ctidTraderAccountId: payload.ctidTraderAccountId });
      return Promise.resolve(extra[payloadType] || {});
    }
  };
  return session;
}

test("authorisation runs application auth, then the account list, then account auth", async () => {
  const session = scriptedSession([{ ctidTraderAccountId: 777, isLive: false, brokerTitleShort: "FTMO" }]);
  const result = await t.authorize({ session, clientId: "12345", clientSecret: "s3cret", accessToken: "tok", expectLive: false });
  assert.deepEqual(session.calls.map((c) => c.payloadType), [2100, 2149, 2102]);
  assert.equal(session.calls[0].payload.clientId, "12345");
  assert.equal(session.calls[1].payload.accessToken, "tok");
  assert.equal(session.calls[2].payload.ctidTraderAccountId, 777);
  assert.equal(result.accountId, 777);
  assert.equal(result.account.broker, "FTMO");
  assert.equal(result.account.isLive, false);
});

test("two accounts on one token are never guessed between", async () => {
  const accounts = [
    { ctidTraderAccountId: 111, isLive: true },
    { ctidTraderAccountId: 222, isLive: false }
  ];
  await assert.rejects(
    t.authorize({ session: scriptedSession(accounts), clientId: "1", clientSecret: "2", accessToken: "t" }),
    (err) => err.code === "account_not_on_token"
  );
  const chosen = await t.authorize({ session: scriptedSession(accounts), clientId: "1", clientSecret: "2", accessToken: "t", accountId: 222 });
  assert.equal(chosen.accountId, 222);
  await assert.rejects(
    t.authorize({ session: scriptedSession(accounts), clientId: "1", clientSecret: "2", accessToken: "t", accountId: 999 }),
    (err) => err.code === "account_not_on_token"
  );
});

test("a live flag that does not match the intent stops before account auth", async () => {
  const session = scriptedSession([{ ctidTraderAccountId: 777, isLive: true }]);
  await assert.rejects(
    t.authorize({ session, clientId: "1", clientSecret: "2", accessToken: "t", expectLive: false }),
    (err) => err.code === "environment_mismatch"
  );
  assert.deepEqual(session.calls.map((c) => c.payloadType), [2100, 2149]);
});

// The exact numbers the client would send for the two cases in the recovery notes: the minimum-size protected
// buy at the contract's own minimum stop, and a risk-sized 0.8 lot order with a 250.00 stop.
test("the minimum-size BTCUSD buy sends volume 1 and relativeStopLoss 2000000", () => {
  const spec = t.symbolSpec(BTCUSD);
  const order = t.buildMarketOrder({
    accountId: 777,
    spec,
    side: "buy",
    volumeLots: 0.01,
    referencePrice: 96000.5,
    stopPrice: 95980.5,
    clientOrderId: "relay-btc-test-1"
  });
  assert.deepEqual(order.payload, {
    ctidTraderAccountId: 777,
    symbolId: 41,
    orderType: 1,
    tradeSide: 1,
    volume: 1,
    relativeStopLoss: 2000000,
    clientOrderId: "relay-btc-test-1"
  });
  assert.equal(order.numbers.lots, 0.01);
  assert.equal(order.numbers.exposureBtc, 0.01);
  assert.equal(order.numbers.stopDistance, 20);
  assert.equal(order.numbers.riskUsd, 0.2);
  assert.equal(order.numbers.stopPriceImplied, 95980.5);
});

test("a risk-sized 0.8 lot buy with a 250.00 stop sends volume 80 and relativeStopLoss 25000000", () => {
  const spec = t.symbolSpec(BTCUSD);
  const order = t.buildMarketOrder({
    accountId: 777,
    spec,
    volumeLots: 0.8,
    referencePrice: 96000.5,
    stopPrice: 95750.5,
    clientOrderId: "relay-btc-risk-1",
    comment: "btc-test-120s"
  });
  assert.equal(order.payload.volume, 80);
  assert.equal(order.payload.relativeStopLoss, 25000000);
  assert.equal(order.payload.comment, "btc-test-120s");
  assert.equal(order.numbers.exposureBtc, 0.8);
  assert.equal(order.numbers.riskUsd, 200);
  assert.equal(order.numbers.stopDistance, 250);
  assert.equal(order.numbers.stopPriceImplied, 95750.5);
});

test("a stop inside the contract's minimum distance is refused before the send", () => {
  const spec = t.symbolSpec(BTCUSD);
  assert.throws(() => t.buildMarketOrder({
    accountId: 777,
    spec,
    volumeLots: 0.01,
    referencePrice: 96000.5,
    stopPrice: 95980.51,
    clientOrderId: "relay-btc-test-1"
  }), (err) => err.code === "stop_too_close" && err.minimum === 20);
});

test("the other pre-send refusals hold", () => {
  const spec = t.symbolSpec(BTCUSD);
  const base = { accountId: 777, spec, volumeLots: 0.01, referencePrice: 96000.5, stopPrice: 95980.5, clientOrderId: "relay-btc-test-1" };
  assert.throws(() => t.buildMarketOrder({ ...base, side: "buy", stopPrice: 96001 }), (err) => err.code === "stop_on_wrong_side");
  assert.throws(() => t.buildMarketOrder({ ...base, volumeLots: 0.01, spec: t.symbolSpec({ ...BTCUSD, minVolume: 5 }) }), (err) => err.code === "volume_below_min");
  assert.throws(() => t.buildMarketOrder({ ...base, volumeLots: 0.1, spec: t.symbolSpec({ ...BTCUSD, stepVolume: 25 }) }), (err) => err.code === "volume_off_step");
  assert.throws(() => t.buildMarketOrder({ ...base, clientOrderId: "" }), (err) => err.code === "client_order_id_missing");
  assert.throws(() => t.buildMarketOrder({ ...base, clientOrderId: "x".repeat(51) }), (err) => err.code === "client_order_id_too_long");
  assert.throws(() => t.buildMarketOrder({ ...base, comment: "c".repeat(513) }), (err) => err.code === "comment_too_long");
});

test("a limited-risk account gets a guaranteed stop or no order at all", () => {
  const withoutGsl = t.symbolSpec({ ...BTCUSD, guaranteedStopLoss: false });
  assert.throws(() => t.buildMarketOrder({
    accountId: 777,
    spec: withoutGsl,
    volumeLots: 0.01,
    referencePrice: 96000.5,
    stopPrice: 95980.5,
    clientOrderId: "relay-btc-test-1",
    isLimitedRisk: true
  }), (err) => err.code === "guaranteed_stop_unavailable");
  const order = t.buildMarketOrder({
    accountId: 777,
    spec: t.symbolSpec(BTCUSD),
    volumeLots: 0.01,
    referencePrice: 96000.5,
    stopPrice: 95980.5,
    clientOrderId: "relay-btc-test-1",
    isLimitedRisk: true
  });
  assert.equal(order.payload.guaranteedStopLoss, true);
});

test("a close carries the recorded volume in the same 0.01 units", () => {
  const close = t.buildClosePosition({ accountId: 777, positionId: 4242, volumeLots: 0.01 });
  assert.deepEqual(close.payload, { ctidTraderAccountId: 777, positionId: 4242, volume: 1 });
  assert.equal(close.numbers.lots, 0.01);
  assert.throws(() => t.buildClosePosition({ accountId: 777, volumeLots: 0.01 }), (err) => err.code === "position_missing");
});

// A contract whose lot is 100,000 units, like EURUSD: the protocol counts cents of the base asset, so one lot is
// 10,000,000 and the 0.01 lot minimum arrives as 100,000. Every number below is FTMO-shaped, not invented.
const EURUSD = {
  symbolId: 7,
  symbolName: "EURUSD",
  digits: 5,
  lotSize: 10000000,
  minVolume: 100000,
  maxVolume: 100000000,
  stepVolume: 100000,
  slDistance: 20,
  distanceSetIn: 1,
  tradingMode: 0,
  guaranteedStopLoss: false
};

test("a 100,000-unit contract: one lot is 10,000,000 protocol units, and its bounds are lots", () => {
  const spec = t.symbolSpec(EURUSD);
  assert.equal(spec.lotSizeBtc, 100000);
  assert.equal(spec.volumeScale, 10000000);
  assert.equal(spec.minVolume, 0.01);
  assert.equal(spec.volumeStep, 0.01);
  assert.equal(spec.maxVolume, 10);
  assert.equal(spec.minStopDistance, 0.0002);
  assert.equal(t.toProtocolVolume(0.01, spec.volumeScale), 100000);
  assert.equal(t.toProtocolVolume(0.5, spec.volumeScale), 5000000);
  assert.equal(t.protocolVolumeToLots(100000, spec.volumeScale), 0.01);
  // The BTCUSD scale is still the default, so the contract that was proven first needs no argument.
  assert.equal(t.toProtocolVolume(0.01), 1);
  assert.equal(t.volumeScaleOr(undefined), 100);
});

test("a market order on an FX contract is sent in that contract's own integer volume", () => {
  const spec = t.symbolSpec(EURUSD);
  const built = t.buildMarketOrder({
    accountId: 777,
    spec,
    side: "buy",
    volumeLots: 0.01,
    referencePrice: 1.0881,
    stopPrice: 1.0831,
    clientOrderId: "copy-1"
  });
  assert.equal(built.payload.volume, 100000);
  assert.equal(built.numbers.lots, 0.01);
  assert.equal(built.numbers.exposureBtc, 1000); // 0.01 lot of 100,000 units
  assert.equal(built.numbers.stopDistance, 0.005);
  assert.equal(built.numbers.relativeStopLoss, 500);
});

test("a close on an FX contract uses the scale it was given, not the BTCUSD one", () => {
  const close = t.buildClosePosition({ accountId: 777, positionId: 4242, volumeLots: 0.02, volumeScale: 10000000 });
  assert.deepEqual(close.payload, { ctidTraderAccountId: 777, positionId: 4242, volume: 200000 });
  assert.equal(close.numbers.lots, 0.02);
});

test("a reported row converts with the scale of the symbol it describes", () => {
  // The same protocol volume means different sizes on different contracts, so a row carries the scale of its own.
  const fx = t.positionRow(
    { positionId: 4242, tradeData: { symbolId: 7, tradeSide: 2, volume: 100000 }, positionStatus: 1, price: 1.0881 },
    10000000
  );
  assert.equal(fx.volumeLots, 0.01);
  assert.equal(fx.side, "sell");
  const fxOrder = t.orderRow({ orderId: 5001, tradeData: { symbolId: 7, tradeSide: 2, volume: 100000 } }, 10000000);
  assert.equal(fxOrder.volumeLots, 0.01);
  const fxDeal = t.dealRow({ dealId: 9, orderId: 8, positionId: 4242, symbolId: 7, tradeSide: 2, volume: 100000, filledVolume: 100000, executionPrice: 1.0881, executionTimestamp: 1763000000000, dealStatus: 2 }, 8, 10000000);
  assert.equal(fxDeal.volumeLots, 0.01);
  assert.equal(fxDeal.filledLots, 0.01);
  // With no scale given the BTCUSD default still holds, which is what the original report was written against.
  assert.equal(t.positionRow({ positionId: 1, tradeData: { symbolId: 41, volume: 1 }, positionStatus: 1 }).volumeLots, 0.01);
});

test("a position and a deal arrive in protocol units and leave in lots and deposit currency", () => {
  const position = t.positionRow({
    positionId: 4242,
    tradeData: { symbolId: 41, tradeSide: 1, volume: 1 },
    positionStatus: 1,
    price: 96001.2,
    stopLoss: 95980.5,
    guaranteedStopLoss: true
  });
  assert.equal(position.volumeLots, 0.01);
  assert.equal(position.side, "buy");
  assert.equal(position.state, "open");
  assert.equal(position.stopPrice, 95980.5);
  const deal = t.dealRow({ dealId: 9, orderId: 8, positionId: 4242, symbolId: 41, tradeSide: 1, volume: 1, filledVolume: 1, executionPrice: 96001.2, executionTimestamp: 1763000000000, dealStatus: 2, commission: 100000000 }, 8);
  assert.equal(deal.filledLots, 0.01);
  assert.equal(deal.commission, 1);
});

// ---- the pending-order builders ----

test("a limit copy is sent at the source's own entry, with the stop and target as absolute prices", () => {
  const spec = t.symbolSpec(EURUSD);
  const built = t.buildPendingOrder({
    accountId: 777,
    spec,
    side: "buy",
    volumeLots: 0.1,
    orderType: "limit",
    limitPrice: 1.08,
    stopLoss: 1.075,
    takeProfit: 1.09,
    expiryMs: Date.parse("2026-11-21T12:00:00Z"),
    clientOrderId: "lim-501"
  });
  assert.equal(built.payload.ctidTraderAccountId, 777);
  assert.equal(built.payload.volume, 1000000); // 0.1 lot of 100,000 units
  assert.equal(built.payload.orderType, t.ORDER_TYPE.limit);
  assert.equal(built.payload.limitPrice, 1.08);
  assert.equal(built.payload.stopLoss, 1.075);
  assert.equal(built.payload.takeProfit, 1.09);
  assert.equal(built.payload.clientOrderId, "lim-501");
  assert.equal(built.numbers.lots, 0.1);
});

test("the expiry decides the time in force: a source date is good till date, no date is good till cancel", () => {
  const spec = t.symbolSpec(EURUSD);
  const dated = t.buildPendingOrder({
    accountId: 777,
    spec,
    side: "buy",
    volumeLots: 0.1,
    orderType: "limit",
    limitPrice: 1.08,
    expiryMs: Date.parse("2026-11-21T12:00:00Z"),
    clientOrderId: "lim-501"
  });
  assert.equal(dated.payload.timeInForce, t.TIME_IN_FORCE.goodTillDate);
  assert.equal(dated.payload.expirationTimestamp, Date.parse("2026-11-21T12:00:00Z"));

  const open = t.buildPendingOrder({ accountId: 777, spec, side: "buy", volumeLots: 0.1, orderType: "limit", limitPrice: 1.08, clientOrderId: "lim-501" });
  assert.equal(open.payload.timeInForce, t.TIME_IN_FORCE.goodTillCancel);
  assert.equal(open.payload.expirationTimestamp, undefined);
});

test("a pending copy on the market side of the book is refused before it is sent", () => {
  const spec = t.symbolSpec(EURUSD);
  // A buy limit at or above the market fills at once, and so does a buy stop below it: neither is the trade the
  // source placed, so each is refused rather than sent as something the broker would take immediately.
  assert.throws(() => t.buildPendingOrder({ accountId: 777, spec, side: "buy", volumeLots: 0.1, orderType: "limit", limitPrice: 1.09, referencePrice: 1.08 }), (err) => err.code === "limit_on_wrong_side");
  assert.throws(() => t.buildPendingOrder({ accountId: 777, spec, side: "buy", volumeLots: 0.1, orderType: "stop", limitPrice: 1.07, referencePrice: 1.08 }), (err) => err.code === "stop_on_wrong_side");
  assert.throws(() => t.buildPendingOrder({ accountId: 777, spec, side: "buy", volumeLots: 0.1, orderType: "stop_limit", limitPrice: 1.09 }), (err) => err.code === "order_type_unsupported");
  assert.throws(() => t.buildPendingOrder({ accountId: 777, spec, side: "buy", volumeLots: 0.001, orderType: "limit", limitPrice: 1.08 }), (err) => err.code === "volume_below_min");
});

test("an amendment carries only the fields that changed, and an empty one is refused", () => {
  const onlyStop = t.buildAmendOrder({ accountId: 777, orderId: 5001, stopPrice: 1.075 });
  assert.deepEqual(onlyStop.payload, { ctidTraderAccountId: 777, orderId: 5001, stopPrice: 1.075 });
  assert.equal(onlyStop.numbers.changed, 1);

  const expiry = t.buildAmendOrder({ accountId: 777, orderId: 5001, expiryMs: Date.parse("2026-11-22T00:00:00Z") });
  assert.equal(expiry.payload.expirationTimestamp, Date.parse("2026-11-22T00:00:00Z"));
  assert.equal(expiry.payload.limitPrice, undefined);

  // The protective stop of a resting order is `stopLoss`, not `stopPrice`: the latter moves a stop order's entry.
  const protection = t.buildAmendOrder({ accountId: 777, orderId: 5001, stopLoss: 1.0835 });
  assert.deepEqual(protection.payload, { ctidTraderAccountId: 777, orderId: 5001, stopLoss: 1.0835 });
  assert.equal(protection.payload.stopPrice, undefined);
  assert.equal(protection.numbers.changed, 1);

  assert.throws(() => t.buildAmendOrder({ accountId: 777, orderId: 5001 }), (err) => err.code === "amendment_empty");
  assert.throws(() => t.buildCancelOrder({ accountId: 777 }), (err) => err.code === "order_missing");
});

test("a cancel names the broker's order id and nothing of our own", () => {
  const cancel = t.buildCancelOrder({ accountId: 777, orderId: "5001" });
  assert.deepEqual(cancel.payload, { ctidTraderAccountId: 777, orderId: 5001 });
});

test("a position's stop and target amendment sends absolute prices, and only the side given", () => {
  const built = t.buildAmendPositionSltp({ accountId: 777, positionId: 4242, stopLoss: 1.075, takeProfit: null });
  assert.deepEqual(built.payload, { ctidTraderAccountId: 777, positionId: 4242, stopLoss: 1.075 });
  assert.equal(built.numbers.changed, 1);
  assert.throws(() => t.buildAmendPositionSltp({ accountId: 777, positionId: 4242 }), (err) => err.code === "amendment_empty");
});

test("a pending copy the broker cannot name a client order id for is not sent", () => {
  // The client order id is the only handle an uncertain send leaves behind, so the builder refuses without one.
  const spec = t.symbolSpec(EURUSD);
  assert.throws(
    () => t.buildPendingOrder({ accountId: 777, spec, side: "buy", volumeLots: 0.1, orderType: "limit", limitPrice: 1.08 }),
    (err) => err.code === "client_order_id_missing"
  );
});

test("an order row carries the link a filled pending copy is followed through", () => {
  const row = t.orderRow({
    orderId: 5001,
    orderType: 2,
    orderStatus: 1,
    limitPrice: 1.08,
    stopLoss: 1.075,
    takeProfit: 1.09,
    timeInForce: 1,
    expirationTimestamp: Date.parse("2026-11-21T12:00:00Z"),
    clientOrderId: "lim-501",
    positionId: 4242,
    tradeData: { symbolId: 7, tradeSide: 1, volume: 1000000 }
  }, 10000000);
  assert.equal(row.orderId, "5001");
  assert.equal(row.positionId, "4242");
  assert.equal(row.volumeLots, 0.1);
  assert.equal(row.price, 1.08);
  assert.equal(row.stopLoss, 1.075);
  assert.equal(row.targetPrice, 1.09);
  assert.equal(row.timeInForce, t.TIME_IN_FORCE.goodTillDate);
  assert.equal(row.expirationTimestampMs, Date.parse("2026-11-21T12:00:00Z"));
  assert.equal(row.clientOrderId, "lim-501");
});

