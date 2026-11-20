// The adapter that turns the cTrader session into the destination client the guarded BTCUSD test already expects.
//
// `CTRADER_BTCUSD_TEST_20261113.js` was written before any connection existed, against an injected client with
// twelve calls: getAccount, getSymbolSpec, listExposures, getReferencePrice, sendMarketOrder, getExecution,
// findByRequestId, getPosition, getOpenExposure, listDeals, closePosition and setArmed. This file is that
// client, over `CTRADER_TRANSPORT_20261114.js`, and nothing else: the guard state machine is not re-implemented
// here, and this file cannot read MT5, so the ftmo-1 lane stays read-only by construction.
//
// Three rules shape every method:
//   1. Every scale crossing goes through a named function in the transport. Nothing multiplies by 100 here.
//   2. A send that times out is reported as unknown and never repeated. The harness reconciles by request id.
//   3. What the broker says is what is returned. A stop the broker did not report is returned as null, so the
//      harness's own stop guard fires rather than being talked past.
//
// The one thing forced by the protocol: a closed position is not in a reconcile response, so the close price and
// close time come from the deal list for that position. The closing deal is the broker's record of the exit.
"use strict";

const transport = require("./CTRADER_TRANSPORT_20261114.js");

const {
  PAYLOAD,
  TRADE_SIDE,
  ORDER_STATUS,
  codedError,
  volumeScaleOr,
  protocolVolumeToLots,
  moneyFromProtocol,
  symbolSpec,
  findSymbol,
  orderRow,
  traderSummary,
  spotToPrice,
  buildMarketOrder,
  buildClosePosition,
  buildPendingOrder,
  buildAmendOrder,
  buildCancelOrder,
  buildAmendPositionSltp
} = transport;

// ProtoOAExecutionType, the values that decide an order or a close.
const EXECUTION = Object.freeze({
  accepted: 2,
  filled: 3,
  replaced: 4,
  cancelled: 5,
  expired: 6,
  rejected: 7,
  partialFill: 11
});

// ProtoOAAccountType: HEDGED allows several positions per symbol, NETTED only one. The owner's account is shown
// as Hedging, so the run reports this rather than assuming it.
const ACCOUNT_TYPE = Object.freeze({ 0: "hedging", 1: "netting", 2: "spread-betting" });

// ProtoOAOrderStatus, as words. `working` is the only state in which an order can still be amended or cancelled;
// every other state is the broker saying the order left the book, which the copier reads as "the copy is gone".
const ORDER_STATUS_NAME = Object.freeze({
  [ORDER_STATUS.accepted]: "accepted",
  [ORDER_STATUS.filled]: "filled",
  [ORDER_STATUS.rejected]: "rejected",
  [ORDER_STATUS.expired]: "expired",
  [ORDER_STATUS.cancelled]: "cancelled"
});

function num(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function iso(timestampMs) {
  const ms = num(timestampMs);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

function stringId(value) {
  return value === undefined || value === null ? null : String(value);
}

// An event bus, because the session takes one handler at construction and the spot and execution events are
// server-initiated. A handler that throws is recorded, never allowed to break the reader.
function createEventBus() {
  const handlers = new Set();
  const errors = [];
  return {
    errors,
    subscribe(fn) {
      if (typeof fn !== "function") throw new TypeError("subscribe(fn) needs a function");
      handlers.add(fn);
      return () => handlers.delete(fn);
    },
    send(message) {
      for (const fn of [...handlers]) {
        try {
          fn(message);
        } catch (err) {
          errors.push(err);
        }
      }
    }
  };
}

// The account is chosen by the owner's trading login, not by position in the list: the token may carry several
// accounts, and picking the wrong one is the mistake this relay can least afford. The broker name is checked
// against the expected brand before account auth, so an FTMO login on another broker is refused early.
async function connectAccount({
  session,
  clientId,
  clientSecret,
  accessToken,
  traderLogin,
  brokerPattern = /FTMO/i,
  expectLive,
  requireBroker = true
} = {}) {
  if (!session || typeof session.call !== "function") throw new TypeError("a session is required");
  if (!clientId || !clientSecret) throw codedError("app_credentials_missing", "clientId and clientSecret are required");
  if (!accessToken) throw codedError("token_missing", "an access token is required");
  const login = num(traderLogin);
  if (!Number.isFinite(login) || login <= 0) throw codedError("login_invalid", `a positive trading login is required, got ${traderLogin}`);

  await session.call(PAYLOAD.applicationAuthReq, { clientId: String(clientId), clientSecret: String(clientSecret) });
  const list = await session.call(PAYLOAD.getAccountListByAccessTokenReq, { accessToken: String(accessToken) });
  const rows = ((list && list.ctidTraderAccount) || []).map((row) => ({
    accountId: stringId(row.ctidTraderAccountId),
    isLive: row.isLive === true,
    traderLogin: row.traderLogin === undefined ? null : Number(row.traderLogin),
    broker: row.brokerTitleShort || null
  }));
  if (!rows.length) throw codedError("no_account_on_token", "the access token is not attached to any cTrader account");

  const matches = rows.filter((row) => row.traderLogin === login);
  if (!matches.length) {
    throw codedError("login_not_on_token", `no account on this token has login ${login}`, {
      logins: rows.map((row) => row.traderLogin)
    });
  }
  if (matches.length > 1) {
    throw codedError("login_ambiguous", `${matches.length} accounts share login ${login}; the intended one must be named by id`);
  }
  const account = matches[0];
  if (requireBroker && brokerPattern && !brokerPattern.test(String(account.broker || ""))) {
    throw codedError("broker_mismatch", `login ${login} is offered by "${account.broker}", which does not match the expected broker`, {
      broker: account.broker
    });
  }
  if (expectLive !== undefined && account.isLive !== expectLive) {
    throw codedError("environment_mismatch", `login ${login} isLive=${account.isLive}, expected ${expectLive}`);
  }
  const authRes = await session.call(PAYLOAD.accountAuthReq, {
    ctidTraderAccountId: Number(account.accountId),
    accessToken: String(accessToken)
  });
  return { accounts: rows, account, accountId: Number(account.accountId), authRes };
}

// The destination client. `account` is what connectAccount returned for the single authorised account.
function createAdapter({ session, events, account = {}, config = {} } = {}) {
  if (!session || typeof session.call !== "function") throw codedError("session_missing", "a session is required");
  if (!account || account.accountId === undefined || account.accountId === null) {
    throw codedError("account_missing", "an authorised account is required");
  }
  const accountId = Number(account.accountId);
  const now = typeof config.now === "function" ? config.now : () => Date.now();
  const wait = typeof config.sleep === "function" ? config.sleep : (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pollMs = num(config.pollMs) > 0 ? num(config.pollMs) : 1000;
  const spotMaxAgeMs = num(config.spotMaxAgeMs) > 0 ? num(config.spotMaxAgeMs) : 15000;
  const spotTimeoutMs = num(config.spotTimeoutMs) > 0 ? num(config.spotTimeoutMs) : 10000;
  const requestTimeoutMs = num(config.requestTimeoutMs) > 0 ? num(config.requestTimeoutMs) : 20000;

  const state = {
    accountId: String(account.accountId),
    isLive: account.isLive === true,
    broker: account.broker || null,
    symbol: null,
    spec: null,
    spot: null,
    subscribed: false,
    lastPosition: null
  };
  const counters = { calls: 0, spots: 0, submits: 0, closes: 0, pending: 0, amendments: 0, cancels: 0, armed: false, reconciles: 0 };
  const pending = { spots: new Map() };
  // A copy run reads and trades more than one symbol, so every cache here is keyed: a spec by requested name, a
  // spot by symbol id, and the protocol volume scale by symbol id, because one lot is lotSize cents of the base
  // asset and that number differs per contract (100 for 1.00 BTC, 10,000,000 for 100,000 units of EURUSD).
  const specs = new Map();
  const spots = new Map();
  const subscribed = new Set();
  const scales = new Map();

  function call(payloadType, payload = {}, options = {}) {
    counters.calls += 1;
    return session.call(payloadType, payload, { timeoutMs: requestTimeoutMs, ...options });
  }

  function rememberPosition(entity) {
    if (entity && entity.positionId !== undefined && num(entity.positionStatus) === 1) state.lastPosition = entity;
  }

  // The scale learned from any spec this adapter has loaded; a symbol whose contract was never read falls back to
  // the transport's default, which is the BTCUSD-shaped 100.
  function lotsFor(volume, symbolId) {
    const scale = scales.get(Number(symbolId));
    return protocolVolumeToLots(volume, scale);
  }

  // Server-initiated events: spot ticks feed the reference price, and an execution event is kept because it is
  // the only message that reports the position's stop at the moment of the fill. A tick is filed under its own
  // symbol, so one symbol's price can never be read as another's.
  function onEvent(message) {
    if (!message || typeof message !== "object") return;
    const type = num(message.payloadType);
    const payload = message.payload || {};
    if (type === PAYLOAD.spotEvent) {
      const ask = payload.ask === undefined ? null : spotToPrice(payload.ask);
      const bid = payload.bid === undefined ? null : spotToPrice(payload.bid);
      if (ask === null && bid === null) return;
      const symbolId = num(payload.symbolId);
      const spot = { symbolId: Number.isFinite(symbolId) ? Number(symbolId) : null, ask, bid, at: now(), timestampMs: num(payload.timestamp) || null };
      spots.set(spot.symbolId, spot);
      state.spot = spot;
      counters.spots += 1;
      const waiting = spot.symbolId === null
        ? [...pending.spots.values()].flat()
        : (pending.spots.get(spot.symbolId) || []);
      for (const key of [...pending.spots.keys()]) {
        if (spot.symbolId !== null && key !== spot.symbolId) continue;
        pending.spots.delete(key);
      }
      for (const waiter of waiting) waiter.resolve(spot);
      return;
    }
    if (type === PAYLOAD.executionEvent) rememberPosition(payload.position);
  }
  if (events && typeof events.subscribe === "function") events.subscribe(onEvent);

  // ---- contract ----

  function rememberSpec(spec) {
    state.spec = spec;
    state.symbol = spec.symbol;
    scales.set(Number(spec.symbolId), volumeScaleOr(spec.volumeScale));
    return spec;
  }

  async function loadSpec(name) {
    const wanted = String(name || "").toUpperCase();
    const cached = specs.get(wanted);
    if (cached) return rememberSpec(cached);
    const list = await call(PAYLOAD.symbolsListReq, { ctidTraderAccountId: accountId });
    const light = findSymbol(list, wanted);
    if (!light) throw codedError("symbol_not_found", `${wanted} is not in the account's symbol list`);
    const byId = await call(PAYLOAD.symbolByIdReq, { ctidTraderAccountId: accountId, symbolId: [Number(light.symbolId)] });
    const entity = ((byId && byId.symbol) || [])[0];
    if (!entity) throw codedError("symbol_not_found", `${wanted} was listed but its full contract was not returned`);
    // The light symbol names it; the full entity carries the scales. Both are kept for the report.
    const spec = { ...symbolSpec(entity), symbol: entity.symbolName || wanted };
    specs.set(wanted, spec);
    specs.set(String(spec.symbol || "").toUpperCase(), spec);
    return rememberSpec(spec);
  }

  async function ensureSubscribed(spec) {
    const symbolId = Number(spec.symbolId);
    if (subscribed.has(symbolId)) return;
    await call(PAYLOAD.subscribeSpotsReq, { ctidTraderAccountId: accountId, symbolId: [symbolId] });
    subscribed.add(symbolId);
    state.subscribed = true;
  }

  function waitForSpot(symbolId) {
    return new Promise((resolve, reject) => {
      const key = Number(symbolId);
      const waiter = { resolve };
      const list = pending.spots.get(key) || [];
      list.push(waiter);
      pending.spots.set(key, list);
      const timer = setTimeout(() => {
        const current = pending.spots.get(key) || [];
        const index = current.indexOf(waiter);
        if (index >= 0) current.splice(index, 1);
        if (!current.length) pending.spots.delete(key);
        reject(codedError("spot_timeout", `no spot event for symbol ${key} arrived within ${spotTimeoutMs} ms`));
      }, spotTimeoutMs);
      const done = waiter.resolve;
      waiter.resolve = (value) => {
        clearTimeout(timer);
        done(value);
      };
    });
  }

  async function getReferencePrice(name) {
    const spec = await loadSpec(name);
    await ensureSubscribed(spec);
    const symbolId = Number(spec.symbolId);
    const cached = spots.get(symbolId);
    if (cached && cached.at && now() - cached.at <= spotMaxAgeMs) return cached.ask ?? cached.bid;
    const spot = await waitForSpot(symbolId);
    return spot.ask ?? spot.bid;
  }

  // ---- reads ----

  async function reconcile() {
    counters.reconciles += 1;
    const res = await call(PAYLOAD.reconcileReq, { ctidTraderAccountId: accountId });
    return {
      positions: (res && res.position) || [],
      orders: (res && res.order) || []
    };
  }

  function openShape(position) {
    const trade = position.tradeData || {};
    return {
      positionId: stringId(position.positionId),
      symbolId: Number(trade.symbolId),
      side: num(trade.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
      state: "open",
      volume: lotsFor(trade.volume, trade.symbolId),
      entryPrice: position.price === undefined ? null : num(position.price),
      protectionStop: position.stopLoss === undefined ? null : num(position.stopLoss),
      targetPrice: position.takeProfit === undefined ? null : num(position.takeProfit),
      guaranteedStopLoss: position.guaranteedStopLoss === true,
      openTimeUtc: iso(trade.openTimestamp),
      closePrice: null,
      closeTimeUtc: null
    };
  }

  // A pending order as the copier reads it. `volume` and `volumeLots` are the same number under both names the two
  // callers already use, and `working` is the single field that decides whether an amend or a cancel is allowed.
  function orderShape(order) {
    const row = orderRow(order, scales.get(Number((order.tradeData || {}).symbolId)));
    if (!row) return null;
    return {
      ...row,
      symbolId: row.symbolId,
      volume: row.volumeLots,
      orderType: row.type,
      statusName: ORDER_STATUS_NAME[row.status] || "unknown",
      working: row.status === ORDER_STATUS.accepted
    };
  }

  function closedShape(deal) {
    const detail = deal.closePositionDetail || {};
    return {
      positionId: stringId(deal.positionId),
      symbolId: Number(deal.symbolId),
      side: num(deal.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
      state: "closed",
      volume: lotsFor(detail.closedVolume !== undefined ? detail.closedVolume : deal.filledVolume, deal.symbolId),
      entryPrice: detail.entryPrice === undefined ? null : num(detail.entryPrice),
      protectionStop: null,
      targetPrice: null,
      guaranteedStopLoss: false,
      openTimeUtc: null,
      closePrice: deal.executionPrice === undefined ? null : num(deal.executionPrice),
      closeTimeUtc: iso(deal.executionTimestamp)
    };
  }

  async function dealEntities(positionId) {
    const res = await call(PAYLOAD.dealListByPositionIdReq, {
      ctidTraderAccountId: accountId,
      positionId: Number(positionId)
    });
    return (res && res.deal) || [];
  }

  async function getAccount() {
    const res = await call(PAYLOAD.traderReq, { ctidTraderAccountId: accountId });
    const trader = (res && res.trader) || res || {};
    const summary = traderSummary(trader) || {};
    const type = ACCOUNT_TYPE[num(trader.accountType)];
    return {
      accountId: String(account.accountId),
      // The harness compares this string with the confirmed id, so it comes from the authorised row, and the
      // trader payload's own id is carried beside it so the two can be compared in the report.
      traderAccountId: summary.accountId || null,
      balance: summary.balance === undefined ? null : summary.balance,
      broker: summary.broker || account.broker || null,
      traderLogin: summary.traderLogin === undefined ? (account.traderLogin === undefined ? null : account.traderLogin) : summary.traderLogin,
      isLive: account.isLive === true,
      isLimitedRisk: summary.isLimitedRisk === true,
      accountType: type || "unknown",
      moneyDigits: summary.moneyDigits === undefined ? null : summary.moneyDigits,
      leverage: summary.leverage === undefined ? null : summary.leverage,
      depositAssetId: trader.depositAssetId === undefined ? null : Number(trader.depositAssetId),
      // The deposit currency code needs the asset list; it is not guessed from the id.
      currency: null
    };
  }

  async function getSymbolSpec(name) {
    return loadSpec(name);
  }

  async function listExposures(name) {
    const spec = await loadSpec(name);
    const { positions, orders } = await reconcile();
    const mine = positions.filter((position) => Number((position.tradeData || {}).symbolId) === Number(spec.symbolId));
    const openOrders = orders.filter((order) => Number((order.tradeData || {}).symbolId) === Number(spec.symbolId));
    for (const position of mine) rememberPosition(position);
    return {
      positions: mine.map(openShape),
      orders: openOrders.map(orderShape)
    };
  }

  // Every working order on one symbol, or on the whole account when no symbol is named. This is the read the
  // copier's pending-order pass is built on: an order is copied only while the destination book shows it working.
  async function listOpenOrders(name) {
    const spec = name ? await loadSpec(name) : null;
    const { orders } = await reconcile();
    return orders
      .filter((order) => !spec || Number((order.tradeData || {}).symbolId) === Number(spec.symbolId))
      .map(orderShape)
      .filter(Boolean);
  }

  // Orders that already left the working book. A cancel and a fill look the same from the working list, so this
  // history is how the copier learns which one happened before it decides to re-place or to stop copying.
  async function getHistoricOrders({ fromTimestampMs, toTimestampMs, maxRows = 100 } = {}) {
    const to = num(toTimestampMs) > 0 ? num(toTimestampMs) : now();
    const from = num(fromTimestampMs) > 0 ? num(fromTimestampMs) : to - 7 * 24 * 3600 * 1000;
    const res = await call(PAYLOAD.orderListReq, {
      ctidTraderAccountId: accountId,
      fromTimestamp: from,
      toTimestamp: to,
      maxRows: num(maxRows) > 0 ? num(maxRows) : 100
    });
    return ((res && res.order) || []).map(orderShape).filter(Boolean);
  }

  async function getOrder(orderId, { lookbackDays = 7 } = {}) {
    if (orderId === undefined || orderId === null || orderId === "") return null;
    const wanted = String(orderId);
    const { orders } = await reconcile();
    const live = orders.find((order) => stringId(order.orderId) === wanted);
    if (live) return orderShape(live);
    const to = now();
    const from = to - (num(lookbackDays) > 0 ? num(lookbackDays) : 7) * 24 * 3600 * 1000;
    const history = await getHistoricOrders({ fromTimestampMs: from, toTimestampMs: to });
    return history.find((order) => order.orderId === wanted) || null;
  }

  // The id we chose before the send is the only handle on a request whose answer was lost, so both the working
  // book and the history are searched before the copier concludes the order was never created.
  async function findOrderByRequestId(clientOrderId) {
    const wanted = String(clientOrderId || "");
    if (!wanted) return null;
    const { orders } = await reconcile();
    const live = orders.find((order) => String(order.clientOrderId || "") === wanted);
    if (live) return orderShape(live);
    const history = await getHistoricOrders({ fromTimestampMs: now() - 7 * 24 * 3600 * 1000 });
    return history.find((order) => String(order.clientOrderId || "") === wanted) || null;
  }

  async function getOpenExposure(name) {
    const spec = await loadSpec(name);
    const { positions } = await reconcile();
    return {
      positions: positions
        .filter((position) => Number((position.tradeData || {}).symbolId) === Number(spec.symbolId))
        .map(openShape)
    };
  }

  function shapeDeal(deal) {
    const detail = deal.closePositionDetail || null;
    const digits = deal.moneyDigits === undefined
      ? (detail && detail.moneyDigits !== undefined ? num(detail.moneyDigits) : 8)
      : num(deal.moneyDigits);
    const money = (value) => (value === undefined || value === null ? null : moneyFromProtocol(value, digits));
    return {
      dealId: stringId(deal.dealId),
      orderId: stringId(deal.orderId),
      positionId: stringId(deal.positionId),
      side: num(deal.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
      volumeLots: lotsFor(deal.filledVolume !== undefined ? deal.filledVolume : deal.volume, deal.symbolId),
      price: deal.executionPrice === undefined ? null : num(deal.executionPrice),
      timeUtc: iso(deal.executionTimestamp),
      // The harness sums commission and swap, so these keep those names and carry the sign the broker sent.
      commission: detail ? money(detail.commission) : money(deal.commission),
      swap: detail ? money(detail.swap) : null,
      grossProfit: detail ? money(detail.grossProfit) : null,
      balance: detail ? money(detail.balance) : null,
      closing: detail !== null,
      moneyDigits: digits
    };
  }

  async function getDealsHistory({ fromTimestampMs, toTimestampMs, maxRows = 50 } = {}) {
    const to = num(toTimestampMs) > 0 ? num(toTimestampMs) : now();
    const from = num(fromTimestampMs) > 0 ? num(fromTimestampMs) : to - 30 * 24 * 3600 * 1000;
    const res = await call(PAYLOAD.dealListReq, {
      ctidTraderAccountId: accountId,
      fromTimestamp: from,
      toTimestamp: to,
      maxRows
    });
    return ((res && res.deal) || []).map((deal) => shapeDeal(deal));
  }

  // A closed position is not in the reconcile response, so its exit comes from the closing deal. When the
  // reconcile response has not caught up with a fresh fill, the execution event's own position is used, because
  // that message is the broker's statement of the position it opened - including its stop.
  async function getPosition(positionId) {
    if (positionId === undefined || positionId === null || positionId === "") return null;
    const { positions } = await reconcile();
    const found = positions.find((position) => stringId(position.positionId) === stringId(positionId));
    if (found && num(found.positionStatus) === 1) {
      rememberPosition(found);
      return openShape(found);
    }
    const deals = await dealEntities(positionId);
    const closing = deals.find((deal) => deal.closePositionDetail);
    if (closing) return closedShape(closing);
    const cached = state.lastPosition && stringId(state.lastPosition.positionId) === stringId(positionId) ? state.lastPosition : null;
    if (cached) return openShape(cached);
    const opening = deals.find((deal) => !deal.closePositionDetail);
    if (opening) {
      // Nothing that has arrived reports a stop, so protectionStop stays null and the harness closes the
      // position at once. That is the intended outcome: an unproven stop is not a protection.
      return {
        positionId: stringId(positionId),
        symbolId: Number(opening.symbolId),
        side: num(opening.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
        state: "open",
        volume: lotsFor(opening.filledVolume !== undefined ? opening.filledVolume : opening.volume, opening.symbolId),
        entryPrice: opening.executionPrice === undefined ? null : num(opening.executionPrice),
        protectionStop: null,
        targetPrice: null,
        guaranteedStopLoss: false,
        openTimeUtc: iso(opening.executionTimestamp),
        closePrice: null,
        closeTimeUtc: null
      };
    }
    return null;
  }

  // ---- the single send ----

  async function sendMarketOrder(request = {}) {
    if (String(request.type || "market").toLowerCase() !== "market") {
      throw codedError("order_type_unsupported", `this adapter sends market orders only, got ${request.type}`);
    }
    const spec = await loadSpec(request.symbol);
    const referencePrice = num(request.referencePrice) > 0 ? num(request.referencePrice) : await getReferencePrice(request.symbol);
    const builder = buildMarketOrder({
      accountId,
      spec,
      side: request.side,
      volumeLots: request.volume,
      referencePrice,
      stopPrice: request.stopPrice,
      isLimitedRisk: account.isLimitedRisk === true,
      clientOrderId: String(request.requestId || ""),
      comment: request.comment
    });
    counters.submits += 1;
    let response;
    try {
      response = await call(PAYLOAD.newOrderReq, builder.payload, { timeoutMs: num(config.orderTimeoutMs) || requestTimeoutMs });
    } catch (err) {
      if (err && err.code === "timeout") {
        // Sent, and the broker may already have acted. Reported as unknown so the harness reconciles by id.
        return { outcome: "unknown", orderId: null, positionId: null, clientOrderId: builder.payload.clientOrderId, sent: true };
      }
      if (err && err.code === "broker_error") {
        return { outcome: "refused", message: err.description || err.errorCode || "the broker refused the order", sent: true };
      }
      throw err;
    }
    const execution = response || {};
    rememberPosition(execution.position);
    if (execution.errorCode || num(execution.executionType) === EXECUTION.rejected) {
      return { outcome: "refused", message: execution.errorCode || "ORDER_REJECTED", sent: true };
    }
    const order = execution.order || {};
    const position = execution.position || {};
    return {
      outcome: "accepted",
      orderId: stringId(order.orderId),
      positionId: stringId(position.positionId !== undefined ? position.positionId : order.positionId),
      executionType: num(execution.executionType),
      clientOrderId: builder.payload.clientOrderId,
      sent: true,
      request: builder.payload,
      numbers: builder.numbers
    };
  }

  // The fill, from the broker's deal record rather than from the request: the opening deal carries the executed
  // volume, price and time, and its timestamp is what the two-minute clock is measured from.
  async function getExecution({ orderId, positionId, timeoutMs = 15000 } = {}) {
    if (positionId === undefined || positionId === null || positionId === "") return null;
    const deadline = now() + (num(timeoutMs) > 0 ? num(timeoutMs) : 15000);
    for (;;) {
      const deals = await dealEntities(positionId);
      const opening = deals.find((deal) => !deal.closePositionDetail);
      if (opening) {
        const digits = opening.moneyDigits === undefined ? 8 : num(opening.moneyDigits);
        return {
          dealId: stringId(opening.dealId),
          orderId: stringId(opening.orderId !== undefined ? opening.orderId : orderId),
          positionId: stringId(positionId),
          filledVolume: lotsFor(opening.filledVolume !== undefined ? opening.filledVolume : opening.volume, opening.symbolId),
          fillPrice: opening.executionPrice === undefined ? null : num(opening.executionPrice),
          fillTimeUtc: iso(opening.executionTimestamp),
          commission: opening.commission === undefined ? null : moneyFromProtocol(opening.commission, digits),
          dealStatus: num(opening.dealStatus)
        };
      }
      if (now() >= deadline) return null;
      await wait(pollMs);
    }
  }

  // Reconciliation by request id: the order carries the clientOrderId we sent and the id of its position.
  async function findByRequestId(requestId) {
    const wanted = String(requestId || "");
    if (!wanted) return null;
    const { positions, orders } = await reconcile();
    const order = orders.find((row) => String(row.clientOrderId || "") === wanted) || null;
    if (!order) {
      // A filled market order leaves the pending list, so the position's own comment is the fallback record.
      const position = positions.find((row) => String(((row.tradeData || {}).comment) || "") === wanted) || null;
      return position ? { order: null, position: openShape(position) } : null;
    }
    const positionId = order.positionId === undefined ? null : order.positionId;
    const position = positionId === null ? null : await getPosition(positionId);
    // The row is reported in that order's own units, so a reconciled FX order does not read as a mass of lots.
    return { order: orderRow(order, scales.get(Number((order.tradeData || {}).symbolId))), position };
  }

  // ---- the single close ----

  async function closePosition(request = {}) {
    if (!request.positionId) throw codedError("position_missing", "a position id is required");
    // The close volume is the position's own, so it needs that symbol's scale: the caller passes the symbol it
    // opened, and the spec read for it decides how many protocol units one lot is. A caller that names no volume
    // means "close it", which is the whole position: the position's own volume is read rather than guessed, so a
    // close can never be built from an undefined size (the first natural exit found exactly that on 2026-11-19).
    const spec = request.symbol ? await loadSpec(request.symbol) : null;
    let volumeLots = request.volume;
    if (!(num(volumeLots) > 0)) {
      const position = await getPosition(request.positionId);
      volumeLots = position && num(position.volume) > 0 ? num(position.volume) : null;
      if (!(num(volumeLots) > 0)) {
        throw codedError("close_volume_missing", `position ${request.positionId} was named with no volume and its own volume could not be read`);
      }
    }
    const builder = buildClosePosition({
      accountId,
      positionId: request.positionId,
      volumeLots,
      volumeScale: spec ? spec.volumeScale : request.volumeScale
    });
    counters.closes += 1;
    let response;
    try {
      response = await call(PAYLOAD.closePositionReq, builder.payload, { timeoutMs: num(config.orderTimeoutMs) || requestTimeoutMs });
    } catch (err) {
      if (err && err.code === "timeout") {
        return { outcome: "unknown", positionId: stringId(request.positionId), sent: true, reason: request.reason || null };
      }
      if (err && err.code === "broker_error") {
        return {
          outcome: "refused",
          positionId: stringId(request.positionId),
          message: err.description || err.errorCode || "the broker refused the close",
          sent: true,
          reason: request.reason || null
        };
      }
      throw err;
    }
    const execution = response || {};
    rememberPosition(execution.position);
    if (execution.errorCode || num(execution.executionType) === EXECUTION.rejected) {
      return {
        outcome: "refused",
        positionId: stringId(request.positionId),
        message: execution.errorCode || "ORDER_REJECTED",
        sent: true,
        reason: request.reason || null
      };
    }
    const deal = execution.deal || {};
    const position = execution.position || {};
    return {
      outcome: "accepted",
      positionId: stringId(request.positionId),
      executionType: num(execution.executionType),
      closePrice: deal.executionPrice === undefined ? null : num(deal.executionPrice),
      closeTimeUtc: iso(deal.executionTimestamp),
      positionStatus: num(position.positionStatus),
      volumeLots: builder.numbers.lots,
      reason: request.reason || null
    };
  }

  // ---- pending orders, amendments and cancels ----
  //
  // These four sends follow the same three rules as the market send: the scales cross inside the transport, a
  // timeout is reported as unknown and never retried here, and the answer that is returned is the broker's own.

  async function sendPendingOrder(request = {}) {
    const type = String(request.type || "limit").toLowerCase();
    if (type !== "limit" && type !== "stop") {
      throw codedError("order_type_unsupported", `a pending copy is a limit or a stop, got ${request.type}`);
    }
    const spec = await loadSpec(request.symbol);
    const referencePrice = num(request.referencePrice) > 0 ? num(request.referencePrice) : await getReferencePrice(request.symbol);
    const builder = buildPendingOrder({
      accountId,
      spec,
      side: request.side,
      volumeLots: request.volume,
      orderType: type,
      limitPrice: request.price,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      expiryMs: request.expiryMs,
      referencePrice,
      clientOrderId: String(request.requestId || ""),
      comment: request.comment
    });
    counters.pending += 1;
    let response;
    try {
      response = await call(PAYLOAD.newOrderReq, builder.payload, { timeoutMs: num(config.orderTimeoutMs) || requestTimeoutMs });
    } catch (err) {
      if (err && err.code === "timeout") {
        return { outcome: "unknown", orderId: null, clientOrderId: builder.payload.clientOrderId, sent: true };
      }
      if (err && err.code === "broker_error") {
        return { outcome: "refused", message: err.description || err.errorCode || "the broker refused the order", sent: true, clientOrderId: builder.payload.clientOrderId };
      }
      throw err;
    }
    const execution = response || {};
    if (execution.errorCode || num(execution.executionType) === EXECUTION.rejected) {
      return { outcome: "refused", message: execution.errorCode || "ORDER_REJECTED", sent: true, clientOrderId: builder.payload.clientOrderId };
    }
    const order = execution.order || {};
    return {
      outcome: "accepted",
      orderId: stringId(order.orderId),
      positionId: stringId(order.positionId),
      status: num(order.orderStatus),
      executionType: num(execution.executionType),
      clientOrderId: builder.payload.clientOrderId,
      sent: true,
      request: builder.payload,
      numbers: builder.numbers
    };
  }

  async function amendOrder(request = {}) {
    if (!request.orderId) throw codedError("order_missing", "an order id is required");
    const spec = request.symbol ? await loadSpec(request.symbol) : null;
    const builder = buildAmendOrder({
      accountId,
      orderId: request.orderId,
      volumeLots: request.volume,
      volumeScale: spec ? spec.volumeScale : undefined,
      limitPrice: request.limitPrice,
      stopPrice: request.stopPrice,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
      expiryMs: request.expiryMs
    });
    counters.amendments += 1;
    let response;
    try {
      response = await call(PAYLOAD.amendOrderReq, builder.payload, { timeoutMs: num(config.orderTimeoutMs) || requestTimeoutMs });
    } catch (err) {
      if (err && err.code === "timeout") return { outcome: "unknown", orderId: stringId(request.orderId), sent: true };
      if (err && err.code === "broker_error") {
        return { outcome: "refused", orderId: stringId(request.orderId), message: err.description || err.errorCode || "the broker refused the amendment", sent: true };
      }
      throw err;
    }
    const execution = response || {};
    if (execution.errorCode || num(execution.executionType) === EXECUTION.rejected) {
      return { outcome: "refused", orderId: stringId(request.orderId), message: execution.errorCode || "ORDER_REJECTED", sent: true };
    }
    const order = execution.order || {};
    return {
      outcome: "accepted",
      orderId: stringId(order.orderId !== undefined ? order.orderId : request.orderId),
      status: num(order.orderStatus),
      executionType: num(execution.executionType),
      sent: true,
      request: builder.payload
    };
  }

  async function cancelOrder(request = {}) {
    if (!request.orderId) throw codedError("order_missing", "an order id is required");
    const builder = buildCancelOrder({ accountId, orderId: request.orderId });
    counters.cancels += 1;
    let response;
    try {
      response = await call(PAYLOAD.cancelOrderReq, builder.payload, { timeoutMs: num(config.orderTimeoutMs) || requestTimeoutMs });
    } catch (err) {
      if (err && err.code === "timeout") return { outcome: "unknown", orderId: stringId(request.orderId), sent: true };
      if (err && err.code === "broker_error") {
        return { outcome: "refused", orderId: stringId(request.orderId), message: err.description || err.errorCode || "the broker refused the cancel", sent: true };
      }
      throw err;
    }
    const execution = response || {};
    if (execution.errorCode || num(execution.executionType) === EXECUTION.rejected) {
      return { outcome: "refused", orderId: stringId(request.orderId), message: execution.errorCode || "ORDER_REJECTED", sent: true };
    }
    const order = execution.order || {};
    return {
      outcome: "accepted",
      orderId: stringId(order.orderId !== undefined ? order.orderId : request.orderId),
      status: num(order.orderStatus),
      executionType: num(execution.executionType),
      sent: true
    };
  }

  // The stop and target of an open position. The broker's position is returned rather than the request, so the
  // caller records the price that is actually held: a stop the broker moved or refused must not read as applied.
  async function amendPositionSltp(request = {}) {
    if (!request.positionId) throw codedError("position_missing", "a position id is required");
    const builder = buildAmendPositionSltp({
      accountId,
      positionId: request.positionId,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit
    });
    counters.amendments += 1;
    let response;
    try {
      response = await call(PAYLOAD.amendPositionSltpReq, builder.payload, { timeoutMs: num(config.orderTimeoutMs) || requestTimeoutMs });
    } catch (err) {
      if (err && err.code === "timeout") return { outcome: "unknown", positionId: stringId(request.positionId), sent: true };
      if (err && err.code === "broker_error") {
        return { outcome: "refused", positionId: stringId(request.positionId), message: err.description || err.errorCode || "the broker refused the amendment", sent: true };
      }
      throw err;
    }
    const execution = response || {};
    rememberPosition(execution.position);
    if (execution.errorCode || num(execution.executionType) === EXECUTION.rejected) {
      return { outcome: "refused", positionId: stringId(request.positionId), message: execution.errorCode || "ORDER_REJECTED", sent: true };
    }
    const position = execution.position || {};
    return {
      outcome: "accepted",
      positionId: stringId(position.positionId !== undefined ? position.positionId : request.positionId),
      positionStatus: num(position.positionStatus),
      stopLoss: position.stopLoss === undefined ? null : num(position.stopLoss),
      takeProfit: position.takeProfit === undefined ? null : num(position.takeProfit),
      executionType: num(execution.executionType),
      sent: true,
      request: builder.payload
    };
  }

  // The relay's own switch. It holds no broker state: it exists so the harness's preflight cannot pass unless
  // the run command armed the adapter for this one test.
  function setArmed(value) {
    counters.armed = value === true;
    return counters.armed;
  }

  function isArmed() {
    return counters.armed === true;
  }

  return {
    getAccount,
    getSymbolSpec,
    listExposures,
    getReferencePrice,
    sendMarketOrder,
    getExecution,
    findByRequestId,
    getPosition,
    getOpenExposure,
    listDeals: async (positionId) => (positionId === undefined || positionId === null
      ? getDealsHistory({})
      : dealEntities(positionId).then((deals) => deals.map((deal) => shapeDeal(deal)))),
    getDealsHistory,
    closePosition,
    listOpenOrders,
    getHistoricOrders,
    getOrder,
    findOrderByRequestId,
    sendPendingOrder,
    amendOrder,
    cancelOrder,
    amendPositionSltp,
    setArmed,
    isArmed,
    // For the report only: what the run actually read and sent.
    context() {
      return {
        accountId: state.accountId,
        isLive: state.isLive,
        broker: state.broker,
        symbol: state.symbol,
        spec: state.spec,
        spot: state.spot,
        counters: { ...counters }
      };
    }
  };
}

module.exports = {
  EXECUTION,
  ACCOUNT_TYPE,
  createEventBus,
  connectAccount,
  createAdapter
};
