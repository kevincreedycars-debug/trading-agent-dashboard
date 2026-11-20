// Tests for the adapter: the account chosen by login, the contract mapped from the broker's own numbers, the
// reference price from a spot event, the single order and close payloads, the timeout-is-unknown rule, and the
// broker's deal record as the source of the fill and the exit.
//
// The end-to-end case runs the guarded BTCUSD harness itself against a scripted broker through this adapter, so
// the whole chain - preflight, one send, stop confirmed from the broker's position, 120 second clock from the
// fill, close by position id, flat check, disarm, report - is exercised without a socket.
//
//   node --test docs/strategy/proposals/CTRADER_ADAPTER_20261114.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const transport = require(path.join(__dirname, "CTRADER_TRANSPORT_20261114.js"));
const adapterModule = require(path.join(__dirname, "CTRADER_ADAPTER_20261114.js"));
const harness = require(path.join(__dirname, "CTRADER_BTCUSD_TEST_20261113.js"));

const { codedError } = transport;
const { connectAccount, createAdapter, createEventBus, ACCOUNT_TYPE } = adapterModule;

const FILL_MS = Date.parse("2026-11-14T10:00:00.000Z");
const ASK_RAW = 9600050000; // 96000.50000
const BID_RAW = 9599950000; // 95999.50000

function contract(over = {}) {
  return {
    symbolId: 41,
    symbolName: "BTCUSD",
    digits: 2,
    lotSize: 100, // cents: 1.00 BTC per lot
    minVolume: 1, // 0.01 lot
    stepVolume: 1,
    maxVolume: 500,
    slDistance: 2000, // points at 2 digits: 20.00
    distanceSetIn: 1,
    tradingMode: 0,
    guaranteedStopLoss: true,
    ...over
  };
}

function trader(over = {}) {
  return {
    ctidTraderAccountId: 777,
    balance: 1000000000000, // 10,000.00000000 with moneyDigits 8
    depositAssetId: 1,
    leverageInCents: 10000,
    traderLogin: 7348195,
    accountType: 0, // HEDGED
    brokerName: "FTMO",
    isLimitedRisk: false,
    moneyDigits: 8,
    ...over
  };
}

// A scripted broker behind the session's call(). Every payload id the adapter uses is answered, and every call
// is recorded, so a test can assert both the mapping and the order of the requests.
function scriptedBroker(over = {}) {
  const b = {
    accounts: [{ ctidTraderAccountId: 777, isLive: false, traderLogin: 7348195, brokerTitleShort: "FTMO" }],
    trader: trader(),
    symbol: contract(),
    symbols: null, // set to several contracts when a test reads more than one symbol
    position: null,
    orders: [],
    deals: [],
    orderOutcome: "filled", // filled | rejected | timeout | broker_error
    closeOutcome: "filled", // filled | timeout | broker_error
    amendOutcome: "ok", // ok | timeout | broker_error
    cancelOutcome: "ok", // ok | timeout | broker_error
    sltpOutcome: "ok", // ok | timeout | broker_error
    orderHistory: null, // set to the orders that already left the working book
    timeoutFills: true, // a timed-out entry that the broker actually filled
    closeAtMs: FILL_MS + 120000,
    entryPrice: 96000.5,
    closePrice: 96020.5,
    openStop: 95980.5,
    nextOrderId: 5001,
    nextPositionId: 4242,
    stopHitAtMs: null, // set to a timestamp to have the scripted stop take the position
    stopPrice: 95979.5,
    clock: null,
    ...over
  };
  const calls = [];

  // One exit, from either a close request or a stop the scripted broker says has fired. It mutates the broker
  // and returns the execution event the real broker would send, so both paths feed the adapter the same record.
  function exitAt({ volume, price, atMs, tradeSide = 2 }) {
    const closing = {
      dealId: 9002,
      orderId: b.nextOrderId + 1,
      positionId: b.position.positionId,
      volume,
      filledVolume: volume,
      symbolId: b.position.tradeData.symbolId,
      executionTimestamp: atMs,
      executionPrice: price,
      tradeSide,
      dealStatus: 2,
      moneyDigits: 8,
      closePositionDetail: {
        entryPrice: b.entryPrice,
        grossProfit: Math.round((price - b.entryPrice) * (volume / 100) * 1e8),
        swap: 0,
        commission: -35000000,
        balance: 1000000000000,
        closedVolume: volume,
        moneyDigits: 8
      }
    };
    b.deals = [...b.deals, closing];
    b.orders = [];
    b.position = { ...b.position, positionStatus: 2, tradeData: { ...b.position.tradeData, closeTimestamp: atMs } };
    return { executionType: 3, order: { orderId: closing.orderId }, position: b.position, deal: closing };
  }

  const session = {
    calls,
    async call(payloadType, payload = {}) {
      calls.push({ type: payloadType, payload });
      switch (payloadType) {
        case 2100:
          return {};
        case 2149:
          return { ctidTraderAccount: b.accounts };
        case 2102:
          return {};
        case 2121:
          return { ctidTraderAccountId: 777, trader: b.trader };
        case 2114:
          return { symbol: (b.symbols || [b.symbol]).map((row) => ({ symbolId: row.symbolId, symbolName: row.symbolName })) };
        case 2116: {
          const wanted = (payload.symbolId || []).map(Number);
          return { symbol: (b.symbols || [b.symbol]).filter((row) => wanted.includes(Number(row.symbolId))) };
        }
        case 2127:
          return { subscribedSymbolId: payload.symbolId || [] };
        case 2124:
          // A scripted stop: once the test clock passes stopHitAtMs the broker reports the position closed, with
          // no close request from the relay.
          if (b.stopHitAtMs && b.clock && b.clock.t >= b.stopHitAtMs && b.position && b.position.positionStatus === 1) {
            exitAt({ volume: b.position.tradeData.volume, price: b.stopPrice, atMs: b.stopHitAtMs });
          }
          return {
            position: b.position && b.position.positionStatus === 1 ? [b.position] : [],
            order: b.orders
          };
        case 2106: {
          // A pending copy is not filled by the send, so it stays in the working book with its own prices. A
          // timeout here is the interesting case: the order exists and only the answer was lost.
          if (payload.orderType === 2 || payload.orderType === 3) {
            if (b.orderOutcome === "broker_error") {
              throw codedError("broker_error", "the broker refused", { description: "MARKET_CLOSED", sent: true });
            }
            if (b.orderOutcome === "rejected") return { executionType: 7, errorCode: "TRADING_DISABLED", order: {} };
            const pending = {
              orderId: b.nextOrderId,
              tradeData: { symbolId: payload.symbolId, volume: payload.volume, tradeSide: payload.tradeSide },
              orderType: payload.orderType,
              orderStatus: 1,
              limitPrice: payload.limitPrice,
              stopPrice: payload.stopPrice,
              stopLoss: payload.stopLoss,
              takeProfit: payload.takeProfit,
              timeInForce: payload.timeInForce,
              expirationTimestamp: payload.expirationTimestamp,
              clientOrderId: payload.clientOrderId
            };
            b.orders = [...b.orders, pending];
            b.nextOrderId += 1;
            if (b.orderOutcome === "timeout") throw codedError("timeout", "no answer to the order", { sent: true });
            return { executionType: 3, order: pending };
          }
          if (b.orderOutcome === "broker_error") {
            throw codedError("broker_error", "the broker refused", { description: "INSUFFICIENT_MARGIN", sent: true });
          }
          const orderId = b.nextOrderId;
          const positionId = b.nextPositionId;
          const volume = payload.volume;
          const order = {
            orderId,
            tradeData: { symbolId: payload.symbolId, volume, tradeSide: payload.tradeSide },
            orderType: 1,
            orderStatus: 2,
            clientOrderId: payload.clientOrderId,
            positionId
          };
          if (b.orderOutcome === "rejected") {
            return { executionType: 7, errorCode: "TRADING_DISABLED", order: {}, position: {} };
          }
          b.position = {
            positionId,
            positionStatus: 1,
            tradeData: {
              symbolId: payload.symbolId,
              volume,
              tradeSide: payload.tradeSide,
              openTimestamp: FILL_MS,
              comment: payload.comment || null
            },
            price: b.entryPrice,
            stopLoss: b.openStop,
            guaranteedStopLoss: payload.guaranteedStopLoss === true,
            moneyDigits: 8,
            utcLastUpdateTimestamp: FILL_MS
          };
          b.deals = [{
            dealId: 9001,
            orderId,
            positionId,
            volume,
            filledVolume: volume,
            symbolId: payload.symbolId,
            createTimestamp: FILL_MS,
            executionTimestamp: FILL_MS,
            executionPrice: b.entryPrice,
            tradeSide: payload.tradeSide,
            dealStatus: 2,
            commission: -35000000, // -0.35
            moneyDigits: 8
          }];
          b.orders = [order];
          if (b.orderOutcome === "timeout") {
            // The order reached the broker; only the answer was lost. With timeoutFills false the broker has no
            // record of it at all, which is the other half of the unknown case.
            if (b.timeoutFills === false) {
              b.position = null;
              b.deals = [];
              b.orders = [];
            }
            throw codedError("timeout", "no answer to the order", { sent: true });
          }
          return { executionType: 3, order, position: b.position, deal: b.deals[0] };
        }
        case 2109: {
          const order = b.orders.find((row) => Number(row.orderId) === Number(payload.orderId));
          if (!order) return { executionType: 7, errorCode: "ORDER_NOT_FOUND", order: {} };
          if (b.amendOutcome === "broker_error") {
            throw codedError("broker_error", "the broker refused", { description: "ORDER_REJECTED", sent: true });
          }
          for (const field of ["limitPrice", "stopPrice", "stopLoss", "takeProfit", "expirationTimestamp", "volume"]) {
            if (payload[field] !== undefined) order[field] = payload[field];
          }
          if (b.amendOutcome === "timeout") throw codedError("timeout", "no answer to the amendment", { sent: true });
          return { executionType: 3, order };
        }
        case 2108: {
          const order = b.orders.find((row) => Number(row.orderId) === Number(payload.orderId));
          if (!order) return { executionType: 7, errorCode: "ORDER_NOT_FOUND", order: {} };
          if (b.cancelOutcome === "broker_error") {
            throw codedError("broker_error", "the broker refused", { description: "ORDER_NOT_FOUND", sent: true });
          }
          order.orderStatus = 5;
          b.orders = b.orders.filter((row) => Number(row.orderId) !== Number(payload.orderId));
          if (b.cancelOutcome === "timeout") throw codedError("timeout", "no answer to the cancel", { sent: true });
          return { executionType: 3, order };
        }
        case 2110: {
          if (!b.position || b.position.positionStatus !== 1) return { executionType: 7, errorCode: "POSITION_NOT_FOUND", position: {} };
          if (b.sltpOutcome === "broker_error") {
            throw codedError("broker_error", "the broker refused", { description: "INVALID_STOP_LOSS", sent: true });
          }
          if (payload.stopLoss !== undefined) b.position = { ...b.position, stopLoss: payload.stopLoss };
          if (payload.takeProfit !== undefined) b.position = { ...b.position, takeProfit: payload.takeProfit };
          if (b.sltpOutcome === "timeout") throw codedError("timeout", "no answer to the amendment", { sent: true });
          return { executionType: 3, order: { orderId: b.nextOrderId }, position: b.position };
        }
        case 2175: {
          const rows = b.orderHistory || b.orders;
          return { order: rows, hasMore: false };
        }
        case 2181: {
          const row = (b.orderHistory || b.orders).find((order) => Number(order.orderId) === Number(payload.orderId));
          return row ? { order: row } : { executionType: 7, errorCode: "ORDER_NOT_FOUND" };
        }
        case 2179:
          return { deal: b.deals.filter((deal) => Number(deal.positionId) === Number(payload.positionId)), hasMore: false };
        case 2111: {
          if (b.closeOutcome === "timeout") throw codedError("timeout", "no answer to the close", { sent: true });
          if (b.closeOutcome === "broker_error") {
            throw codedError("broker_error", "the broker refused", { description: "POSITION_NOT_FOUND", sent: true });
          }
          return exitAt({ volume: payload.volume, price: b.closePrice, atMs: b.closeAtMs });
        }
        case 2133:
          return { deal: b.deals };
        default:
          throw new Error(`unscripted payload ${payloadType}`);
      }
    }
  };
  return { broker: b, session, calls };
}

function adapterFor(session, config = {}) {
  const bus = createEventBus();
  const adapter = createAdapter({
    session,
    events: bus,
    account: { accountId: "777", isLive: false, broker: "FTMO", traderLogin: 7348195 },
    config: { now: () => FILL_MS, sleep: async () => {}, pollMs: 1000, spotMaxAgeMs: 15000, ...config }
  });
  return { adapter, bus };
}

// The two-minute clock, in the test's hands: sleeping moves time, so the whole hold can be run in an instant.
function fakeClock(start = FILL_MS) {
  const clock = {
    t: start,
    now() { return clock.t; },
    async sleep(ms) { clock.t += ms; }
  };
  return clock;
}

test("connectAccount: the account carrying the owner's login is the one authenticated", async () => {
  const { session, calls } = scriptedBroker({
    accounts: [
      { ctidTraderAccountId: 111, isLive: false, traderLogin: 9000001, brokerTitleShort: "FTMO" },
      { ctidTraderAccountId: 777, isLive: false, traderLogin: 7348195, brokerTitleShort: "FTMO" }
    ]
  });
  const out = await connectAccount({
    session,
    clientId: "cid",
    clientSecret: "secret",
    accessToken: "tok",
    traderLogin: 7348195
  });
  assert.equal(out.accountId, 777);
  assert.deepEqual(out.accounts.map((row) => row.traderLogin), [9000001, 7348195]);
  const auth = calls.find((call) => call.type === 2102);
  assert.equal(auth.payload.ctidTraderAccountId, 777);
  assert.equal(auth.payload.accessToken, "tok");
});

test("connectAccount: a login the token does not carry is refused and the other logins are named", async () => {
  const { session } = scriptedBroker();
  await assert.rejects(
    connectAccount({ session, clientId: "cid", clientSecret: "secret", accessToken: "tok", traderLogin: 1234567 }),
    (err) => err.code === "login_not_on_token" && err.logins.includes(7348195)
  );
});

test("connectAccount: a login shared by two accounts is refused rather than guessed", async () => {
  const { session } = scriptedBroker({
    accounts: [
      { ctidTraderAccountId: 777, isLive: false, traderLogin: 7348195, brokerTitleShort: "FTMO" },
      { ctidTraderAccountId: 778, isLive: false, traderLogin: 7348195, brokerTitleShort: "FTMO" }
    ]
  });
  await assert.rejects(
    connectAccount({ session, clientId: "cid", clientSecret: "secret", accessToken: "tok", traderLogin: 7348195 }),
    (err) => err.code === "login_ambiguous"
  );
});

test("connectAccount: the login is checked against the broker before account auth", async () => {
  const { session, calls } = scriptedBroker({
    accounts: [{ ctidTraderAccountId: 777, isLive: false, traderLogin: 7348195, brokerTitleShort: "IC Markets" }]
  });
  await assert.rejects(
    connectAccount({ session, clientId: "cid", clientSecret: "secret", accessToken: "tok", traderLogin: 7348195 }),
    (err) => err.code === "broker_mismatch" && err.broker === "IC Markets"
  );
  assert.equal(calls.filter((call) => call.type === 2102).length, 0);
});

test("connectAccount: a live account is not accepted where a demo account was expected", async () => {
  const { session } = scriptedBroker({
    accounts: [{ ctidTraderAccountId: 777, isLive: true, traderLogin: 7348195, brokerTitleShort: "FTMO" }]
  });
  await assert.rejects(
    connectAccount({
      session,
      clientId: "cid",
      clientSecret: "secret",
      accessToken: "tok",
      traderLogin: 7348195,
      expectLive: false
    }),
    (err) => err.code === "environment_mismatch"
  );
});

test("getAccount: the trader's own numbers, with hedging reported rather than assumed", async () => {
  const { session } = scriptedBroker();
  const { adapter } = adapterFor(session);
  const account = await adapter.getAccount();
  assert.equal(account.accountId, "777");
  assert.equal(account.traderAccountId, "777");
  assert.equal(account.balance, 10000);
  assert.equal(account.broker, "FTMO");
  assert.equal(account.traderLogin, 7348195);
  assert.equal(account.accountType, "hedging");
  assert.equal(ACCOUNT_TYPE[1], "netting");
  assert.equal(account.moneyDigits, 8);
  assert.equal(account.leverage, 100);
  assert.equal(account.isLive, false);
});

test("getSymbolSpec: the contract is read in the units the size and the stop depend on", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  const spec = await adapter.getSymbolSpec("btcusd");
  assert.equal(spec.symbol, "BTCUSD");
  assert.equal(spec.symbolId, 41);
  assert.equal(spec.digits, 2);
  assert.equal(spec.lotSizeBtc, 1);
  assert.equal(spec.minVolume, 0.01);
  assert.equal(spec.maxVolume, 5);
  assert.equal(spec.volumeStep, 0.01);
  assert.equal(spec.minStopDistance, 20);
  assert.equal(spec.distanceSetIn, "points");
  assert.equal(spec.tradeMode, "full");
  assert.equal(spec.guaranteedStopLossAvailable, true);
  // The contract is fetched once and then remembered; a second read must not re-request it.
  await adapter.getSymbolSpec("BTCUSD");
  assert.equal(calls.filter((call) => call.type === 2116).length, 1);
});

test("getSymbolSpec: a symbol the account does not offer is refused, not substituted", async () => {
  const { session } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await assert.rejects(adapter.getSymbolSpec("ETHUSD"), (err) => err.code === "symbol_not_found");
});

test("getReferencePrice: one subscription, and the ask from the next spot event", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter, bus } = adapterFor(session);
  const pending = adapter.getReferencePrice("BTCUSD");
  await new Promise((resolve) => setImmediate(resolve));
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 41, ask: ASK_RAW, bid: BID_RAW } });
  assert.equal(await pending, 96000.5);
  assert.equal(calls.filter((call) => call.type === 2127).length, 1);
  // The tick just used is still fresh, so the next read costs no request at all.
  const before = calls.length;
  assert.equal(await adapter.getReferencePrice("BTCUSD"), 96000.5);
  assert.equal(calls.length, before);
});

test("getReferencePrice: a tick older than the limit is not used for a stop distance", async () => {
  let clockMs = FILL_MS;
  const { session } = scriptedBroker();
  const { adapter, bus } = adapterFor(session, { now: () => clockMs });
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 41, ask: ASK_RAW, bid: BID_RAW } });
  clockMs = FILL_MS + 20000;
  const pending = adapter.getReferencePrice("BTCUSD");
  await new Promise((resolve) => setImmediate(resolve));
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 41, ask: ASK_RAW + 500000, bid: BID_RAW } });
  assert.equal(await pending, 96005.5);
});

// FTMO's EURUSD contract: 100,000 units per lot, so one lot is 10,000,000 protocol volume units and the 0.01
// lot minimum arrives as 100,000.
const FX = contract({
  symbolId: 7,
  symbolName: "EURUSD",
  digits: 5,
  lotSize: 10000000,
  minVolume: 100000,
  maxVolume: 100000000,
  stepVolume: 100000,
  slDistance: 20
});

test("getReferencePrice: each symbol is subscribed to once and keeps its own tick", async () => {
  const { session, calls } = scriptedBroker({ symbols: [contract(), FX] });
  const { adapter, bus } = adapterFor(session);

  const btc = adapter.getReferencePrice("BTCUSD");
  await new Promise((resolve) => setImmediate(resolve));
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 41, ask: ASK_RAW, bid: BID_RAW } });
  assert.equal(await btc, 96000.5);

  const fx = adapter.getReferencePrice("EURUSD");
  await new Promise((resolve) => setImmediate(resolve));
  // The BTCUSD tick is still fresh, and it is not EURUSD's price: the read waits for EURUSD's own tick.
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 7, ask: 108812, bid: 108810 } });
  assert.equal(await fx, 1.08812);

  // Both caches are kept, so neither read has to wait again.
  assert.equal(await adapter.getReferencePrice("BTCUSD"), 96000.5);
  assert.equal(await adapter.getReferencePrice("EURUSD"), 1.08812);
  assert.deepEqual(calls.filter((call) => call.type === 2127).map((call) => call.payload.symbolId), [[41], [7]]);
});

test("a position's volume is read in its own contract's lots, not the BTCUSD scale", async () => {
  const { session } = scriptedBroker({
    symbols: [FX],
    position: {
      positionId: 4242,
      positionStatus: 1,
      tradeData: { symbolId: 7, tradeSide: 1, volume: 100000, openTimestamp: FILL_MS },
      price: 1.0881,
      stopLoss: 1.0831,
      moneyDigits: 2
    }
  });
  const { adapter } = adapterFor(session);
  const { positions } = await adapter.listExposures("EURUSD");
  assert.equal(positions[0].volume, 0.01);
});

test("a close is built with the closed symbol's own volume scale", async () => {
  const { session, calls } = scriptedBroker({
    symbols: [FX],
    position: {
      positionId: 4242,
      positionStatus: 1,
      tradeData: { symbolId: 7, tradeSide: 1, volume: 100000, openTimestamp: FILL_MS },
      price: 1.0881,
      stopLoss: 1.0831,
      moneyDigits: 2
    },
    closePrice: 1.0800
  });
  const { adapter } = adapterFor(session);
  const closed = await adapter.closePosition({ positionId: "4242", symbol: "EURUSD", volume: 0.01 });
  const request = calls.find((call) => call.type === 2111);
  assert.equal(request.payload.volume, 100000);
  assert.equal(closed.outcome, "accepted");
  assert.equal(closed.volumeLots, 0.01);
});

test("findByRequestId: a reconciled FX order reports its volume in that contract's lots", async () => {
  const { session, calls } = scriptedBroker({ symbols: [FX], orderOutcome: "timeout" });
  const { adapter } = adapterFor(session);
  const sent = await adapter.sendMarketOrder({
    requestId: "copy-7",
    symbol: "EURUSD",
    side: "sell",
    volume: 0.01,
    stopPrice: 1.0931,
    referencePrice: 1.08812
  });
  assert.equal(sent.outcome, "unknown");
  assert.equal(calls.filter((call) => call.type === 2106).length, 1);
  // The broker records 100,000 protocol units; the reconciled row must not read that with the BTCUSD scale.
  const found = await adapter.findByRequestId("copy-7");
  assert.equal(found.order.clientOrderId, "copy-7");
  assert.equal(found.order.volumeLots, 0.01);
});

test("sendMarketOrder: one market buy, the stop as a distance the broker can check", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  const result = await adapter.sendMarketOrder({
    requestId: "btc-test-1",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5,
    comment: "btc-test-120s",
    type: "market"
  });
  const sent = calls.find((call) => call.type === 2106).payload;
  assert.equal(sent.ctidTraderAccountId, 777);
  assert.equal(sent.symbolId, 41);
  assert.equal(sent.orderType, 1);
  assert.equal(sent.tradeSide, 1);
  assert.equal(sent.volume, 1); // 0.01 lots in the protocol's hundredths
  assert.equal(sent.relativeStopLoss, 2000000); // 20.00 in the protocol's 1/100000 price scale
  assert.equal(sent.clientOrderId, "btc-test-1");
  assert.equal(sent.comment, "btc-test-120s");
  assert.equal(sent.guaranteedStopLoss, undefined); // only a limited-risk account asks for one
  assert.equal(result.outcome, "accepted");
  assert.equal(result.orderId, "5001");
  assert.equal(result.positionId, "4242");
  assert.equal(result.numbers.exposureBtc, 0.01);
  assert.equal(result.numbers.riskUsd, 0.2);
});

test("sendMarketOrder: a refusal from the broker is an outcome, not an exception", async () => {
  const { session } = scriptedBroker({ orderOutcome: "rejected" });
  const { adapter } = adapterFor(session);
  const refused = await adapter.sendMarketOrder({
    requestId: "btc-test-2",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  assert.equal(refused.outcome, "refused");
  assert.match(String(refused.message), /TRADING_DISABLED/);

  const { session: other } = scriptedBroker({ orderOutcome: "broker_error" });
  const { adapter: adapter2 } = adapterFor(other);
  const errored = await adapter2.sendMarketOrder({
    requestId: "btc-test-3",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });

  assert.equal(errored.outcome, "refused");
  assert.match(String(errored.message), /INSUFFICIENT_MARGIN/);
});

test("sendMarketOrder: a lost answer is unknown, and the request is reconciled rather than resent", async () => {
  const { session, calls } = scriptedBroker({ orderOutcome: "timeout" });
  const { adapter } = adapterFor(session);
  const sent = await adapter.sendMarketOrder({
    requestId: "btc-test-4",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5,
    comment: "btc-test-120s"
  });
  assert.equal(sent.outcome, "unknown");
  assert.equal(sent.positionId, null);
  assert.equal(calls.filter((call) => call.type === 2106).length, 1);

  const found = await adapter.findByRequestId("btc-test-4");
  assert.equal(found.order.clientOrderId, "btc-test-4");
  assert.equal(found.position.positionId, "4242");
  assert.equal(found.position.protectionStop, 95980.5);
  const exec = await adapter.getExecution({ orderId: found.order.orderId, positionId: "4242" });
  assert.equal(exec.filledVolume, 0.01);
});

test("sendMarketOrder: unknown and nothing at the broker stays unknown", async () => {
  const { session, calls } = scriptedBroker({ orderOutcome: "timeout", timeoutFills: false });
  const { adapter } = adapterFor(session);
  const sent = await adapter.sendMarketOrder({
    requestId: "btc-test-5",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  assert.equal(sent.outcome, "unknown");
  assert.equal(await adapter.findByRequestId("btc-test-5"), null);
  assert.equal(calls.filter((call) => call.type === 2106).length, 1);
});

test("getExecution: the opening deal is the fill, in lots, at the broker's own time", async () => {
  const { session } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await adapter.sendMarketOrder({
    requestId: "btc-test-6",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  const exec = await adapter.getExecution({ positionId: "4242", orderId: "5001", timeoutMs: 1 });
  assert.equal(exec.positionId, "4242");
  assert.equal(exec.orderId, "5001");
  assert.equal(exec.filledVolume, 0.01);
  assert.equal(exec.fillPrice, 96000.5);
  assert.equal(exec.fillTimeUtc, "2026-11-14T10:00:00.000Z");
  assert.equal(exec.commission, -0.35);
});

test("getPosition: open from the reconcile response, closed from the broker's closing deal", async () => {
  const { session, broker } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await adapter.sendMarketOrder({
    requestId: "btc-test-7",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  const open = await adapter.getPosition("4242");
  assert.equal(open.state, "open");
  assert.equal(open.volume, 0.01);
  assert.equal(open.entryPrice, 96000.5);
  assert.equal(open.protectionStop, 95980.5);

  const closed = await adapter.closePosition({ positionId: "4242", volume: 0.01, reason: "deadline" });
  assert.equal(closed.outcome, "accepted");
  assert.equal(broker.position.positionStatus, 2);
  const after = await adapter.getPosition("4242");
  assert.equal(after.state, "closed");
  assert.equal(after.closePrice, 96020.5);
  assert.equal(after.closeTimeUtc, "2026-11-14T10:02:00.000Z");
  assert.equal(after.entryPrice, 96000.5);
  assert.equal(after.volume, 0.01);
});

test("closePosition: the full recorded volume, by position id, with no side or price of our own", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await adapter.sendMarketOrder({
    requestId: "btc-test-8",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  const closed = await adapter.closePosition({ positionId: "4242", volume: 0.01, requestId: "btc-test-8-x", reason: "deadline" });
  const sent = calls.find((call) => call.type === 2111).payload;
  assert.deepEqual(sent, { ctidTraderAccountId: 777, positionId: 4242, volume: 1 });
  assert.equal(closed.positionStatus, 2);
  assert.equal(closed.closePrice, 96020.5);
  assert.equal(closed.volumeLots, 0.01);
});

test("closePosition: a close that names no volume closes the position's own size", async () => {
  // The first natural source exit on 2026-11-19 built a close from an undefined size and the transport refused
  // it. A close with no volume means "all of it", so the adapter now reads the position's own volume instead of
  // handing the transport an undefined number.
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await adapter.sendMarketOrder({
    requestId: "btc-test-9",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  const closed = await adapter.closePosition({ positionId: "4242", symbol: "BTCUSD", reason: "source_closed" });
  const sent = calls.filter((call) => call.type === 2111).pop().payload;
  assert.deepEqual(sent, { ctidTraderAccountId: 777, positionId: 4242, volume: 1 });
  assert.equal(closed.outcome, "accepted");
  assert.equal(closed.volumeLots, 0.01);
});

test("closePosition: a position whose own volume cannot be read is refused, not sent", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await assert.rejects(
    () => adapter.closePosition({ positionId: "4242", symbol: "BTCUSD" }),
    (error) => error.code === "close_volume_missing"
  );
  assert.equal(calls.filter((call) => call.type === 2111).length, 0);
});

test("closePosition: a lost close answer is reported as unknown, not as a close", async () => {
  const { session } = scriptedBroker({ closeOutcome: "timeout" });
  const { adapter } = adapterFor(session);
  const closed = await adapter.closePosition({ positionId: "4242", volume: 0.01 });
  assert.equal(closed.outcome, "unknown");
});

test("listDeals: commission, swap and gross profit from the broker's deal detail", async () => {
  const { session } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await adapter.sendMarketOrder({
    requestId: "btc-test-10",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.01,
    stopPrice: 95980.5,
    referencePrice: 96000.5
  });
  await adapter.closePosition({ positionId: "4242", volume: 0.01 });
  const deals = await adapter.listDeals("4242");
  assert.equal(deals.length, 2);
  assert.equal(deals[0].commission, -0.35);
  assert.equal(deals[0].closing, false);
  assert.equal(deals[1].closing, true);
  assert.equal(deals[1].commission, -0.35);
  assert.equal(deals[1].swap, 0);
  assert.equal(deals[1].grossProfit, 0.2);
  assert.equal(deals[1].volumeLots, 0.01);
});

test("end to end: the guarded test over this adapter, closed at the deadline and flat", async () => {
  const clock = fakeClock();
  const { session, broker, calls } = scriptedBroker({ clock });
  const { adapter, bus } = adapterFor(session, { now: clock.now, sleep: clock.sleep, pollMs: 1000 });
  // One spot tick before the run: the reference price the plan and the stop distance are built from.
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 41, ask: ASK_RAW, bid: BID_RAW } });

  const result = await harness.runTest({
    client: adapter,
    config: {
      confirmedAccountId: "777",
      armed: true,
      copyingEnabled: false,
      killSwitch: false,
      now: clock.now,
      holdMs: 120000,
      pollMs: 2000,
      maxRiskUsd: 1
    },
    sleep: clock.sleep
  });

  assert.equal(result.status, "closed_at_deadline");
  assert.deepEqual(result.counters, { send: 1, close: 1, disarm: 1 });
  assert.equal(result.report.volume, 0.01);
  assert.equal(result.report.exposure_btc, 0.01);
  assert.equal(result.report.hold_seconds, 120);
  assert.equal(result.report.entry_price, 96000.5);
  assert.equal(result.report.exit_price, 96020.5);
  assert.equal(result.report.gross_usd, 0.2);
  assert.equal(result.report.commission_usd, -0.7);
  assert.equal(result.report.swap_usd, 0);
  assert.equal(result.report.net_usd, -0.5);
  assert.equal(result.report.flat, true);
  assert.deepEqual(result.report.remaining_positions, []);
  assert.equal(adapter.isArmed(), false);
  assert.equal(broker.position.positionStatus, 2);
  // One entry and one close, for the whole run.
  assert.equal(calls.filter((call) => call.type === 2106).length, 1);
  assert.equal(calls.filter((call) => call.type === 2111).length, 1);
  // The order carried the minimum the contract allows and the stop the plan placed.
  const entry = calls.find((call) => call.type === 2106).payload;
  assert.equal(entry.volume, 1);
  assert.equal(entry.relativeStopLoss, 2000000);
  assert.equal(entry.comment, "btc-test-120s");
});

test("end to end: when the stop takes it early, the broker's own exit is the record", async () => {
  const clock = fakeClock();
  const { session, calls } = scriptedBroker({ clock, stopHitAtMs: FILL_MS + 90000 });
  const { adapter, bus } = adapterFor(session, { now: clock.now, sleep: clock.sleep, pollMs: 1000 });
  bus.send({ payloadType: transport.PAYLOAD.spotEvent, payload: { symbolId: 41, ask: ASK_RAW, bid: BID_RAW } });

  const result = await harness.runTest({
    client: adapter,
    config: {
      confirmedAccountId: "777",
      armed: true,
      copyingEnabled: false,
      killSwitch: false,
      now: clock.now,
      holdMs: 120000,
      pollMs: 2000,
      maxRiskUsd: 1
    },
    sleep: clock.sleep
  });

  assert.equal(result.status, "closed_by_stop");
  assert.equal(result.counters.send, 1);
  assert.equal(result.counters.close, 0);
  assert.equal(result.report.exit_reason, "stop");
  assert.equal(result.report.hold_seconds, 90);
  assert.equal(result.report.exit_price, 95979.5);
  assert.equal(result.report.gross_usd, -0.21);
  assert.equal(result.report.net_usd, -0.91);
  assert.equal(result.report.flat, true);
  // No close request was needed: the position was already closed when the poll saw it.
  assert.equal(calls.filter((call) => call.type === 2111).length, 0);
  assert.equal(adapter.isArmed(), false);
});


// ---- pending copies, amendments and cancels ----

// A working pending order as the broker reports it: absolute prices, an order status of one, and our client order
// id as the only handle on a send whose answer was lost.
function pendingOrder(over = {}) {
  return {
    orderId: 5001,
    tradeData: { symbolId: 41, volume: 10, tradeSide: 1 },
    orderType: 2,
    orderStatus: 1,
    limitPrice: 95900.5,
    stopLoss: 95880.5,
    takeProfit: 96000.5,
    timeInForce: 1,
    expirationTimestamp: Date.parse("2026-11-21T12:00:00Z"),
    clientOrderId: "lim-5001",
    ...over
  };
}

test("sendPendingOrder: one limit copy, absolute prices and the source order's own expiry", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  const placed = await adapter.sendPendingOrder({
    requestId: "lim-5001",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.1,
    type: "limit",
    price: 95900.5,
    stopLoss: 95880.5,
    takeProfit: 96000.5,
    referencePrice: 96000.5,
    expiryMs: Date.parse("2026-11-21T12:00:00Z"),
    comment: "copy-lim"
  });
  const sent = calls.find((call) => call.type === 2106).payload;
  assert.equal(sent.orderType, 2);
  assert.equal(sent.tradeSide, 1);
  assert.equal(sent.volume, 10); // 0.1 lots in the protocol's hundredths
  assert.equal(sent.limitPrice, 95900.5);
  assert.equal(sent.stopPrice, undefined); // a limit names limitPrice, never stopPrice
  assert.equal(sent.stopLoss, 95880.5);
  assert.equal(sent.takeProfit, 96000.5);
  assert.equal(sent.timeInForce, 1); // GOOD_TILL_DATE, because the source order carries a date
  assert.equal(sent.expirationTimestamp, Date.parse("2026-11-21T12:00:00Z"));
  assert.equal(sent.clientOrderId, "lim-5001");
  assert.equal(placed.outcome, "accepted");
  assert.equal(placed.orderId, "5001");
  assert.equal(placed.status, 1);
});

test("sendPendingOrder: an order without an expiry is good till cancel, never the dated form", async () => {
  const { session, calls } = scriptedBroker();
  const { adapter } = adapterFor(session);
  await adapter.sendPendingOrder({
    requestId: "lim-5002",
    symbol: "BTCUSD",
    side: "sell",
    volume: 0.01,
    type: "limit",
    price: 96100.5,
    referencePrice: 96000.5
  });
  const sent = calls.find((call) => call.type === 2106).payload;
  assert.equal(sent.timeInForce, 2); // GOOD_TILL_CANCEL
  assert.equal(sent.expirationTimestamp, undefined);
  assert.equal(sent.tradeSide, 2);
  assert.equal(sent.stopLoss, undefined);
});

test("sendPendingOrder: a lost answer leaves the client order id as the only way to the order", async () => {
  const { session, calls } = scriptedBroker({ orderOutcome: "timeout" });
  const { adapter } = adapterFor(session);
  const sent = await adapter.sendPendingOrder({
    requestId: "lim-5003",
    symbol: "BTCUSD",
    side: "buy",
    volume: 0.1,
    type: "limit",
    price: 95900.5,
    referencePrice: 96000.5
  });
  assert.equal(sent.outcome, "unknown");
  assert.equal(sent.orderId, null);
  assert.equal(sent.clientOrderId, "lim-5003");
  assert.equal(calls.filter((call) => call.type === 2106).length, 1); // never retried in-thread
  const found = await adapter.findOrderByRequestId("lim-5003");
  assert.equal(found.orderId, "5001");
  assert.equal(found.working, true);
  assert.equal(found.statusName, "accepted");
  assert.equal(found.volumeLots, 0.1);
  assert.equal((await adapter.listOpenOrders("BTCUSD")).length, 1);
});

test("amendOrder: only the field that moved is sent, and the working book is the proof", async () => {
  const { session, calls, broker } = scriptedBroker({ orders: [pendingOrder()] });
  const { adapter } = adapterFor(session);
  const amended = await adapter.amendOrder({ orderId: "5001", symbol: "BTCUSD", limitPrice: 95920.5 });
  const sent = calls.find((call) => call.type === 2109).payload;
  assert.deepEqual(sent, { ctidTraderAccountId: 777, orderId: 5001, limitPrice: 95920.5 });
  assert.equal(amended.outcome, "accepted");
  assert.equal(amended.orderId, "5001");
  const [working] = await adapter.listOpenOrders("BTCUSD");
  assert.equal(working.price, 95920.5);
  assert.equal(working.stopLoss, 95880.5);
  assert.equal(broker.orders.length, 1);
});

test("amendOrder: a moved protective stop is sent as stopLoss, leaving the resting entry where it is", async () => {
  const { session, calls } = scriptedBroker({ orders: [pendingOrder()] });
  const { adapter } = adapterFor(session);
  const amended = await adapter.amendOrder({ orderId: "5001", symbol: "BTCUSD", stopLoss: 95910.5 });
  const sent = calls.find((call) => call.type === 2109).payload;
  // The order's entry is `limitPrice`; `stopPrice` would move the entry of a stop order. Only the protection is sent.
  assert.deepEqual(sent, { ctidTraderAccountId: 777, orderId: 5001, stopLoss: 95910.5 });
  assert.equal(amended.outcome, "accepted");
  const [working] = await adapter.listOpenOrders("BTCUSD");
  assert.equal(working.stopLoss, 95910.5);
  assert.equal(working.price, 95900.5);
});

test("amendOrder: an uncertain amendment is unknown, and the next read shows what the broker holds", async () => {
  const { session } = scriptedBroker({ orders: [pendingOrder()], amendOutcome: "timeout" });
  const { adapter } = adapterFor(session);
  const amended = await adapter.amendOrder({ orderId: "5001", symbol: "BTCUSD", stopPrice: 95930.5 });
  assert.equal(amended.outcome, "unknown");
  // The broker applied it; only the answer was lost. The convergence is the read, not a second send.
  const [working] = await adapter.listOpenOrders("BTCUSD");
  assert.equal(working.stopPrice, 95930.5);
});

test("cancelOrder: a cancelled order leaves the working book and the history names it cancelled", async () => {
  const row = pendingOrder();
  const { session, broker } = scriptedBroker({ orders: [row] });
  broker.orderHistory = [row];
  const { adapter } = adapterFor(session);
  const cancelled = await adapter.cancelOrder({ orderId: "5001" });
  assert.equal(cancelled.outcome, "accepted");
  assert.equal(cancelled.status, 5);
  assert.deepEqual(await adapter.listOpenOrders("BTCUSD"), []);
  const history = await adapter.getOrder("5001");
  assert.equal(history.statusName, "cancelled");
  assert.equal(history.working, false);
});

test("getOrder and findOrderByRequestId: a filled pending copy names the position it became", async () => {
  const filled = pendingOrder({ orderStatus: 2, positionId: 4242, executionPrice: 95900.5 });
  const { session } = scriptedBroker({ orderHistory: [filled] });
  const { adapter } = adapterFor(session);
  const order = await adapter.getOrder("5001");
  assert.equal(order.statusName, "filled");
  assert.equal(order.working, false);
  assert.equal(order.positionId, "4242"); // the broker's own link from the order to the copy
  const found = await adapter.findOrderByRequestId("lim-5001");
  assert.equal(found.orderId, "5001");
  assert.equal(found.positionId, "4242");
});

test("amendPositionSltp: the broker's held prices are returned, not the ones asked for", async () => {
  const { session, calls } = scriptedBroker({
    position: {
      positionId: 4242,
      positionStatus: 1,
      tradeData: { symbolId: 41, tradeSide: 1, volume: 10, openTimestamp: FILL_MS },
      price: 96000.5,
      stopLoss: 95980.5,
      takeProfit: 96100.5,
      moneyDigits: 8
    }
  });
  const { adapter } = adapterFor(session);
  const amended = await adapter.amendPositionSltp({ positionId: "4242", stopLoss: 96010.5 });
  const sent = calls.find((call) => call.type === 2110).payload;
  assert.deepEqual(sent, { ctidTraderAccountId: 777, positionId: 4242, stopLoss: 96010.5 });
  assert.equal(amended.outcome, "accepted");
  assert.equal(amended.stopLoss, 96010.5);
  assert.equal(amended.takeProfit, 96100.5); // the target the broker still holds
  const { positions } = await adapter.listExposures("BTCUSD");
  assert.equal(positions[0].protectionStop, 96010.5);
});

test("amendPositionSltp: a refused stop is an outcome the caller records as not applied", async () => {
  const { session } = scriptedBroker({
    sltpOutcome: "broker_error",
    position: {
      positionId: 4242,
      positionStatus: 1,
      tradeData: { symbolId: 41, tradeSide: 1, volume: 10, openTimestamp: FILL_MS },
      price: 96000.5,
      stopLoss: 95980.5,
      moneyDigits: 8
    }
  });
  const { adapter } = adapterFor(session);
  const refused = await adapter.amendPositionSltp({ positionId: "4242", takeProfit: 96200.5 });
  assert.equal(refused.outcome, "refused");
  assert.equal(refused.message, "INVALID_STOP_LOSS");
});

