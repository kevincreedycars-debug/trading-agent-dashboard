// The cTrader Open API transport: JSON framing, the wire scalings, the auth handshake and the two order
// requests this lane sends. Written offline and exercised against a fake socket; it opens no connection by
// itself and reads no credential.
//
// The file exists because the protocol has four different integer scales and one of them (volume) is stated in
// the .proto comments in a way that is easy to read as lots and easy to read as base currency. Every crossing is
// therefore a named function with a test, and nothing multiplies by 100 or 100000 at a call site.
//
// Numbers verified against the vendored .proto files (OpenApiModelMessages.proto, OpenApiMessages.proto) on
// 2026-11-14:
//   ProtoOANewOrderReq.volume           "0.01 of a unit (e.g. 1000 in protocol means 10.00 units)"
//   ProtoOANewOrderReq.relativeStopLoss "1/100000 of unit of a price (53423782 means 534.23782)"
//   ProtoOASymbol.lotSize               "Lot size of the Symbol (in cents)"
//   ProtoOASymbol.minVolume/stepVolume  "volume in cents"
//   ProtoOASymbol.slDistance            points or percent, per ProtoOASymbolDistanceType
//
// A request that times out is reported as uncertain. It is never resent: the broker may already have acted.
"use strict";

const ENDPOINTS = Object.freeze({
  demo: Object.freeze({ environment: "demo", host: "demo.ctraderapi.com", jsonPort: 5036, protobufPort: 5035 }),
  live: Object.freeze({ environment: "live", host: "live.ctraderapi.com", jsonPort: 5036, protobufPort: 5035 })
});

const HEARTBEAT_MS = 10000;
const VOLUME_SCALE = 100;
const PRICE_SCALE = 100000;

// Payload ids as declared in the ProtoOAPayloadType enum. The names are the enum names, so a reader can check
// any of them against the vendored .proto without trusting this table.
const PAYLOAD = Object.freeze({
  errorRes: 50, // PROTO_ERROR_RES
  heartbeatEvent: 51, // PROTO_HEARTBEAT_EVENT
  applicationAuthReq: 2100,
  applicationAuthRes: 2101,
  accountAuthReq: 2102,
  accountAuthRes: 2103,
  newOrderReq: 2106,
  trailingSlChangedEvent: 2107,
  cancelOrderReq: 2108,
  amendOrderReq: 2109,
  amendPositionSltpReq: 2110,
  closePositionReq: 2111,
  symbolsListReq: 2114,
  symbolsListRes: 2115,
  symbolByIdReq: 2116,
  symbolByIdRes: 2117,
  traderReq: 2121,
  traderRes: 2122,
  traderUpdateEvent: 2123,
  reconcileReq: 2124,
  reconcileRes: 2125,
  executionEvent: 2126,
  subscribeSpotsReq: 2127,
  subscribeSpotsRes: 2128,
  spotEvent: 2131,
  dealListReq: 2133,
  dealListRes: 2134,
  oaErrorRes: 2142, // PROTO_OA_ERROR_RES
  tokenInvalidatedEvent: 2147,
  getAccountListByAccessTokenReq: 2149,
  getAccountListByAccessTokenRes: 2150,
  refreshTokenReq: 2173,
  refreshTokenRes: 2174,
  orderListReq: 2175,
  orderListRes: 2176,
  dealListByPositionIdReq: 2179,
  dealListByPositionIdRes: 2180,
  orderDetailsReq: 2181,
  orderDetailsRes: 2182
});

// ProtoOAOrderType and ProtoOATradeSide, verbatim.
const ORDER_TYPE = Object.freeze({ market: 1, limit: 2, stop: 3, stopLimit: 6 });
const TRADE_SIDE = Object.freeze({ buy: 1, sell: 2 });

// ProtoOATimeInForce, verbatim. A pending order copied from MT5 keeps its own expiry: an order with an expiry
// date becomes GOOD_TILL_DATE with that timestamp, one without becomes GOOD_TILL_CANCEL. The two are never
// swapped, because GTC on an order the source will expire leaves a live order the source no longer holds.
const TIME_IN_FORCE = Object.freeze({ goodTillDate: 1, goodTillCancel: 2, immediateOrCancel: 3, fillOrKill: 4, marketOnOpen: 5 });

// ProtoOAOrderStatus, verbatim. Only ACCEPTED is a working pending order; the other four are terminal answers the
// copier reads as "this order is no longer in the book".
const ORDER_STATUS = Object.freeze({ accepted: 1, filled: 2, rejected: 3, expired: 4, cancelled: 5 });

// ProtoOATradingMode: ENABLED is 0 and means full trading. The harness refuses anything but "full".
const TRADING_MODE = Object.freeze({ 0: "full", 1: "close-only", 2: "disallowed-with-pendings", 3: "close-only-mode" });

function codedError(code, message, extra) {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

function num(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value, places) {
  const scale = 10 ** (places === undefined ? 8 : places);
  return Math.round(value * scale) / scale;
}


// 1. Volume. Lots to the protocol's integer. The protocol counts volume in hundredths of the base asset, so one
// lot is the contract's own lotSize in cents: 100 for BTCUSD (1.00 BTC per lot, where the two scales coincide)
// and 10,000,000 for EURUSD (100,000 units per lot). `volumeScale` is that per-lot count, which symbolSpec
// carries; 100 is the default so a BTCUSD-shaped contract needs no argument. A number that is not a whole
// hundredth of a lot is refused rather than nudged: a rounded-up size is a larger risk than the caller asked for.
function volumeScaleOr(value) {
  const scale = num(value);
  return finite(scale) && scale > 0 ? scale : VOLUME_SCALE;
}

function toProtocolVolume(lots, volumeScale = VOLUME_SCALE) {
  const value = num(lots);
  const scale = volumeScaleOr(volumeScale);
  if (!finite(value) || value <= 0) throw codedError("volume_invalid", `volume must be a positive number of lots, got ${lots}`);
  const raw = value * scale;
  const volume = Math.round(raw);
  if (Math.abs(raw - volume) > 1e-6) {
    throw codedError("volume_not_in_hundredths", `volume ${value} lots is not a whole number of 0.01 units of a ${scale}-cent contract`);
  }
  if (volume < 1) throw codedError("volume_too_small", `volume ${value} lots rounds to 0 in the contract's ${scale}-cent scale`);
  return volume;
}

function protocolVolumeToLots(volume, volumeScale = VOLUME_SCALE) {
  const value = num(volume);
  if (!finite(value)) throw codedError("volume_invalid", `protocol volume must be a number, got ${volume}`);
  return value / volumeScaleOr(volumeScale);
}

// 2. Contract size. lotSize is in cents, so 100 is 1.00 of the base asset per lot. BTCUSD is quoted in BTC, so
// this number is BTC per lot and it is what turns a size into an exposure the broker will confirm.
function lotSizeInBtc(lotSizeCents) {
  const value = num(lotSizeCents);
  if (!finite(value) || value <= 0) throw codedError("lot_size_invalid", `lotSize must be a positive number of cents, got ${lotSizeCents}`);
  return value / VOLUME_SCALE;
}

// 3. Stop distance. slDistance is in points unless distanceSetIn says percent; one point is one step of the
// last decimal, so 2000 points at 2 digits is 20.00 of price. Percent arrives as percent * 100.
function pointsToPrice(points, digits) {
  const value = num(points);
  const places = num(digits);
  if (!finite(value) || value < 0) throw codedError("distance_invalid", `points must be zero or more, got ${points}`);
  if (!Number.isInteger(places) || places < 0 || places > 10) {
    throw codedError("digits_invalid", `digits must be a whole number from 0 to 10, got ${digits}`);
  }
  return round(value / 10 ** places, places);
}

function percentToPrice(percentScaled, price) {
  const value = num(percentScaled);
  const ref = num(price);
  if (!finite(value) || value < 0) throw codedError("distance_invalid", `percent distance must be zero or more, got ${percentScaled}`);
  if (!finite(ref) || ref <= 0) throw codedError("price_invalid", `a percent distance needs a positive price, got ${price}`);
  return round((ref * value) / 10000, 10);
}

// 4. Spot. ProtoOASpotEvent carries bid and ask as integers in 1/100000 of a price: 9600012345 is 96000.12345.
// The same scale is used for relativeStopLoss, which is why one pair of functions covers both.
function spotToPrice(raw) {
  const value = num(raw);
  if (!finite(value)) throw codedError("spot_invalid", `spot must be a number, got ${raw}`);
  return value / PRICE_SCALE;
}

function priceToSpot(price) {
  const value = num(price);
  if (!finite(value) || value <= 0) throw codedError("price_invalid", `price must be positive, got ${price}`);
  return Math.round(value * PRICE_SCALE);
}

function priceToRelativeStop(distance) {
  const value = num(distance);
  if (!finite(value) || value <= 0) throw codedError("distance_invalid", `a relative stop must be a positive price distance, got ${distance}`);
  const raw = Math.round(value * PRICE_SCALE);
  if (raw < 1) throw codedError("distance_too_small", `distance ${value} is below the protocol's 1/100000 resolution`);
  return raw;
}

function relativeStopToPrice(raw) {
  return spotToPrice(raw);
}

// Money. ProtoOATrader.balance and every commission are integers scaled by moneyDigits (8 by default).
function moneyFromProtocol(raw, moneyDigits) {
  const value = num(raw);
  const digits = num(moneyDigits);
  if (!finite(value)) throw codedError("money_invalid", `money must be a number, got ${raw}`);
  if (!Number.isInteger(digits) || digits < 0 || digits > 12) {
    throw codedError("money_digits_invalid", `moneyDigits must be a whole number from 0 to 12, got ${moneyDigits}`);
  }
  return round(value / 10 ** digits, digits);
}

// The tool contract form: names a payload carries, mapped to the units the harness and the report speak in.
// The contract is read, never assumed: a broker's BTCUSD is not another broker's, and lotSize is the field that
// decides whether a 0.01 lot order is 0.01 BTC or 0.0001 BTC.
function accountRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    accountId: String(row.ctidTraderAccountId),
    isLive: row.isLive === true,
    traderLogin: row.traderLogin === undefined ? null : Number(row.traderLogin),
    broker: row.brokerTitleShort || null
  };
}

function traderSummary(trader) {
  if (!trader || typeof trader !== "object") return null;
  const digits = trader.moneyDigits === undefined ? 8 : num(trader.moneyDigits);
  return {
    accountId: String(trader.ctidTraderAccountId),
    broker: trader.brokerName || null,
    balance: moneyFromProtocol(trader.balance, digits),
    moneyDigits: digits,
    leverage: trader.leverageInCents ? num(trader.leverageInCents) / 100 : null,
    isLimitedRisk: trader.isLimitedRisk === true,
    accessRights: num(trader.accessRights),
    traderLogin: trader.traderLogin === undefined ? null : Number(trader.traderLogin)
  };
}

function symbolSpec(symbol) {
  if (!symbol || typeof symbol !== "object") throw codedError("spec_missing", "no symbol entity was returned");
  const digits = num(symbol.digits);
  if (!Number.isInteger(digits) || digits < 0) throw codedError("spec_incomplete", `symbol ${symbol.symbolId} carries no usable digits`);
  const lotSizeBtc = lotSizeInBtc(symbol.lotSize);
  // The protocol counts volume in cents of the base asset, and one lot is lotSize cents of it, so lotSize is
  // also the number of protocol volume units per lot. It is carried as volumeScale because the order builder
  // and every volume read need it, not only the exposure arithmetic.
  const volumeScale = num(symbol.lotSize);
  const minVolume = num(symbol.minVolume);
  const stepVolume = num(symbol.stepVolume);
  if (!finite(minVolume) || !finite(stepVolume)) throw codedError("spec_incomplete", `symbol ${symbol.symbolId} carries no usable volume bounds`);
  const distanceSetIn = num(symbol.distanceSetIn) === 2 ? "percentage" : "points";
  const slPoints = num(symbol.slDistance);
  return {
    symbol: symbol.symbolName || null,
    symbolId: Number(symbol.symbolId),
    digits,
    lotSizeBtc,
    volumeScale,
    minVolume: protocolVolumeToLots(minVolume, volumeScale),
    maxVolume: protocolVolumeToLots(symbol.maxVolume === undefined ? minVolume : symbol.maxVolume, volumeScale),
    volumeStep: protocolVolumeToLots(stepVolume, volumeScale),
    tradeMode: TRADING_MODE[num(symbol.tradingMode) || 0],
    distanceSetIn,
    // A point distance is a fixed price distance and can be compared before the order. A percentage distance
    // depends on the price, so it is left null and the order builder computes it from the live reference.
    minStopDistance: distanceSetIn === "points" ? pointsToPrice(slPoints, digits) : null,
    minStopPercent: distanceSetIn === "percentage" ? slPoints / 100 : null,
    guaranteedStopLossAvailable: symbol.guaranteedStopLoss === true,
    raw: {
      digits,
      lotSizeCents: num(symbol.lotSize),
      minVolume,
      stepVolume,
      slDistance: slPoints,
      distanceSetIn: num(symbol.distanceSetIn) || 1,
      tradingMode: num(symbol.tradingMode) || 0
    }
  };
}

// The name is the only thing a symbols list can be searched on. cTrader ids differ per server, so the lookup is
// by symbolName and a missing symbol is a refusal, not a fallback.
function findSymbol(symbolsRes, name) {
  const wanted = String(name || "").toUpperCase();
  const rows = (symbolsRes && symbolsRes.symbol) || [];
  return rows.find((row) => String(row.symbolName || "").toUpperCase() === wanted) || null;
}

// The read-only report rows. Each takes the volume scale of the symbol it describes, because a row that converted
// every contract with the BTCUSD scale would report an FX deal as a hundred-thousand-lot trade. The default is the
// BTCUSD-shaped 100, which is what the original report was written against.
function positionRow(position, volumeScale = VOLUME_SCALE) {
  if (!position || typeof position !== "object") return null;
  const trade = position.tradeData || {};
  return {
    positionId: String(position.positionId),
    symbolId: Number(trade.symbolId),
    side: num(trade.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
    volumeLots: protocolVolumeToLots(trade.volume, volumeScale),
    state: num(position.positionStatus) === 1 ? "open" : "closed",
    price: position.price === undefined ? null : num(position.price),
    stopPrice: position.stopLoss === undefined ? null : num(position.stopLoss),
    targetPrice: position.takeProfit === undefined ? null : num(position.takeProfit),
    guaranteedStopLoss: position.guaranteedStopLoss === true,
    updateTimeMs: position.utcLastUpdateTimestamp === undefined ? null : Number(position.utcLastUpdateTimestamp)
  };
}

function orderRow(order, volumeScale = VOLUME_SCALE) {
  if (!order || typeof order !== "object") return null;
  const trade = order.tradeData || {};
  return {
    orderId: String(order.orderId),
    symbolId: Number(trade.symbolId),
    side: num(trade.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
    volumeLots: protocolVolumeToLots(trade.volume, volumeScale),
    executedLots: protocolVolumeToLots(order.executedVolume || 0, volumeScale),
    type: num(order.orderType),
    status: num(order.orderStatus),
    // A filled order names the position it became. That id is the one link between a copied pending order and the
    // copy that replaced it, and it is the broker's own statement rather than a guess from the symbol and side.
    positionId: order.positionId === undefined ? null : String(order.positionId),
    price: order.limitPrice === undefined
      ? (order.executionPrice === undefined ? null : num(order.executionPrice))
      : num(order.limitPrice),
    stopPrice: order.stopPrice === undefined ? null : num(order.stopPrice),
    stopLoss: order.stopLoss === undefined ? null : num(order.stopLoss),
    targetPrice: order.takeProfit === undefined ? null : num(order.takeProfit),
    timeInForce: order.timeInForce === undefined ? null : num(order.timeInForce),
    expirationTimestampMs: order.expirationTimestamp === undefined ? null : Number(order.expirationTimestamp),
    clientOrderId: order.clientOrderId || null,
    isStopOut: order.isStopOut === true
  };
}

function dealRow(deal, moneyDigits, volumeScale = VOLUME_SCALE) {
  if (!deal || typeof deal !== "object") return null;
  const digits = moneyDigits === undefined ? 8 : moneyDigits;
  const close = deal.closePositionDetail || {};
  return {
    dealId: String(deal.dealId),
    orderId: String(deal.orderId),
    positionId: String(deal.positionId),
    symbolId: Number(deal.symbolId),
    side: num(deal.tradeSide) === TRADE_SIDE.buy ? "buy" : "sell",
    volumeLots: protocolVolumeToLots(deal.volume, volumeScale),
    filledLots: protocolVolumeToLots(deal.filledVolume, volumeScale),
    price: num(deal.executionPrice),
    timeMs: Number(deal.executionTimestamp),
    status: num(deal.dealStatus),
    commission: deal.commission === undefined ? null : moneyFromProtocol(deal.commission, digits),
    grossProfit: close.grossProfit === undefined ? null : moneyFromProtocol(close.grossProfit, digits),
    swap: deal.swap === undefined ? null : moneyFromProtocol(deal.swap, digits)
  };
}

// ---- framing ----

// The JSON envelope has three fields and no length prefix: {clientMsgId, payloadType, payload}. Docs show one
// object per message, nothing between them, so the reader cannot count bytes; it counts brace depth while
// ignoring braces inside strings. That is the only place a separator is assumed, and it is tested against
// chunks that split mid-string and mid-escape.
function encodeFrame({ clientMsgId, payloadType, payload }) {
  if (typeof clientMsgId !== "string" || !clientMsgId) throw codedError("frame_invalid", "a frame needs a non-empty clientMsgId string");
  const type = num(payloadType);
  if (!Number.isInteger(type) || type <= 0) throw codedError("frame_invalid", `payloadType must be a positive integer, got ${payloadType}`);
  const body = payload === undefined ? {} : payload;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw codedError("frame_invalid", "payload must be a plain object");
  }
  return JSON.stringify({ clientMsgId, payloadType: type, payload: body });
}

// Returns the complete objects found, and how much of the buffer they consumed. A trailing partial object is
// left for the next chunk; leading junk before the first brace is consumed with the frame that follows it.
function scanFrames(buffer) {
  const messages = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  let consumed = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const ch = buffer[i];
    if (start < 0) {
      if (ch === "{") {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        messages.push(buffer.slice(start, i + 1));
        consumed = i + 1;
        start = -1;
      }
    }
  }
  return { messages, consumed };
}

function createFrameReader({ maxBuffer = 8 * 1024 * 1024 } = {}) {
  let buffer = "";
  return {
    push(chunk) {
      if (chunk === undefined || chunk === null) return [];
      buffer += String(chunk);
      if (buffer.length > maxBuffer) throw codedError("frame_too_large", `more than ${maxBuffer} characters are buffered without a complete frame`);
      const { messages, consumed } = scanFrames(buffer);
      if (consumed > 0) buffer = buffer.slice(consumed);
      return messages.map((text) => {
        try {
          return JSON.parse(text);
        } catch (err) {
          throw codedError("frame_not_json", "a complete frame did not parse; the connection must be treated as suspect", { frame: text.slice(0, 200) });
        }
      });
    },
    buffered() {
      return buffer.length;
    },
    reset() {
      buffer = "";
    }
  };
}

// ---- session ----

// The session owns correlation, the heartbeat and the promise bookkeeping, and nothing else. The transport is
// injected: in production a TLS socket, in a test a collector that answers by calling handleChunk. A reply that
// never comes rejects with code "timeout" and sent:true; the caller must reconcile by client id, never resend.
function createSession({
  transport,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
  requestTimeoutMs = 20000,
  heartbeatMs = HEARTBEAT_MS,
  onEvent = () => {},
  onError = () => {}
} = {}) {
  if (!transport || typeof transport.write !== "function") throw new TypeError("a transport with write(text) is required");
  const pending = new Map();
  const reader = createFrameReader();
  const counters = { sent: 0, received: 0, events: 0, timeouts: 0, heartbeats: 0 };
  let closed = false;
  let heartbeatTimer = null;
  let seq = 0;

  function nextId(prefix) {
    seq += 1;
    return `${prefix || "m"}-${now().toString(36)}-${seq}`;
  }

  function write(frame) {
    if (closed) throw codedError("session_closed", "the session is closed and nothing else may be written");
    transport.write(encodeFrame(frame));
    counters.sent += 1;
  }

  function settleAll(err) {
    for (const entry of pending.values()) {
      clearTimer(entry.timer);
      entry.reject(err);
    }
    pending.clear();
  }

  function handleMessage(message) {
    if (!message || typeof message !== "object") return;
    const type = num(message.payloadType);
    if (type === PAYLOAD.heartbeatEvent) return;
    counters.received += 1;
    const id = message.clientMsgId === undefined ? null : String(message.clientMsgId);
    const entry = id ? pending.get(id) : null;
    if (!entry) {
      counters.events += 1;
      onEvent(message);
      return;
    }
    clearTimer(entry.timer);
    pending.delete(id);
    if (type === PAYLOAD.oaErrorRes || type === PAYLOAD.errorRes) {
      const payload = message.payload || {};
      entry.reject(codedError("broker_error", payload.description || payload.errorCode || "the broker returned an error", {
        errorCode: payload.errorCode || null,
        description: payload.description || null,
        payloadType: type,
        sent: true
      }));
      return;
    }
    entry.resolve(message.payload || {});
  }

  return {
    nextId,
    write,
    stats() {
      return { ...counters, pending: pending.size };
    },
    isClosed() {
      return closed;
    },
    notify(payloadType, payload = {}, prefix = "n") {
      write({ clientMsgId: nextId(prefix), payloadType, payload });
    },
    call(payloadType, payload = {}, { timeoutMs = requestTimeoutMs, id, prefix = "m" } = {}) {
      if (closed) return Promise.reject(codedError("session_closed", "the session is closed"));
      const clientMsgId = id || nextId(prefix);
      return new Promise((resolve, reject) => {
        const timer = setTimer(() => {
          pending.delete(clientMsgId);
          counters.timeouts += 1;
          reject(codedError("timeout", `no answer to ${clientMsgId} within ${timeoutMs} ms`, { sent: true, clientMsgId }));
        }, timeoutMs);
        pending.set(clientMsgId, { resolve, reject, timer, payloadType });
        try {
          write({ clientMsgId, payloadType, payload });
        } catch (err) {
          clearTimer(timer);
          pending.delete(clientMsgId);
          reject(err);
        }
      });
    },
    handleChunk(chunk) {
      for (const message of reader.push(chunk)) {
        try {
          handleMessage(message);
        } catch (err) {
          onError(err);
        }
      }
    },
    startHeartbeat(ms = heartbeatMs) {
      if (heartbeatTimer !== null || closed) return;
      const beat = () => {
        heartbeatTimer = null;
        if (closed) return;
        try {
          write({ clientMsgId: nextId("hb"), payloadType: PAYLOAD.heartbeatEvent, payload: {} });
          counters.heartbeats += 1;
        } catch (err) {
          onError(err);
          return;
        }
        if (!closed) heartbeatTimer = setTimer(beat, ms);
      };
      heartbeatTimer = setTimer(beat, ms);
    },
    stopHeartbeat() {
      if (heartbeatTimer !== null) {
        clearTimer(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
    close(reason = "closed_by_caller") {
      if (closed) return;
      closed = true;
      if (heartbeatTimer !== null) {
        clearTimer(heartbeatTimer);
        heartbeatTimer = null;
      }
      settleAll(codedError("session_closed", `the session closed: ${reason}`, { sent: true }));
      try {
        if (typeof transport.close === "function") transport.close(reason);
      } catch (err) {
        onError(err);
      }
    }
  };
}

// ---- auth ----

// The documented sequence, in order: application auth, then the account list for the token, then account auth
// on exactly one account. The account is chosen by id, never by "the first one" when more than one is offered:
// picking the wrong account is the failure this relay can least afford.
async function authorize({ session, clientId, clientSecret, accessToken, accountId, expectLive } = {}) {
  if (!session || typeof session.call !== "function") throw new TypeError("a session is required");
  if (!clientId || !clientSecret) throw codedError("app_credentials_missing", "clientId and clientSecret are required");
  if (!accessToken) throw codedError("token_missing", "an access token is required");
  await session.call(PAYLOAD.applicationAuthReq, { clientId: String(clientId), clientSecret: String(clientSecret) });
  const list = await session.call(PAYLOAD.getAccountListByAccessTokenReq, { accessToken: String(accessToken) });
  const rows = ((list && list.ctidTraderAccount) || []).map(accountRow).filter(Boolean);
  if (!rows.length) throw codedError("no_account_on_token", "the access token is not attached to any cTrader account");
  let chosen = null;
  if (accountId) chosen = rows.find((row) => row.accountId === String(accountId)) || null;
  else if (rows.length === 1) chosen = rows[0];
  if (!chosen) {
    throw codedError("account_not_on_token", accountId
      ? `account ${accountId} is not on this token`
      : `the token names ${rows.length} accounts; the intended one must be passed`);
  }
  if (expectLive !== undefined && chosen.isLive !== expectLive) {
    throw codedError("environment_mismatch", `account ${chosen.accountId} isLive=${chosen.isLive}, expected ${expectLive}`);
  }
  const authRes = await session.call(PAYLOAD.accountAuthReq, {
    ctidTraderAccountId: Number(chosen.accountId),
    accessToken: String(accessToken)
  });
  return { accounts: rows, account: chosen, accountId: Number(chosen.accountId), authRes };
}

function assertStopDistance({ spec, referencePrice, distance }) {
  const minimum = spec.distanceSetIn === "percentage"
    ? percentToPrice(spec.raw.slDistance, referencePrice)
    : num(spec.minStopDistance);
  if (!finite(minimum)) return null;
  if (distance + 1e-9 < minimum) {
    throw codedError("stop_too_close", `a ${distance} stop is inside the contract's ${minimum} minimum`, { minimum, distance });
  }
  return minimum;
}

// One market order with a relative stop. The stop travels as relativeStopLoss because the absolute field is
// documented as unsupported for market orders; the absolute price is kept in the numbers so the report can say
// where the broker should have placed it.
function buildMarketOrder({
  accountId,
  spec,
  side = "buy",
  volumeLots,
  referencePrice,
  stopPrice,
  isLimitedRisk = false,
  clientOrderId,
  comment,
  label
} = {}) {
  if (!spec || !finite(num(spec.symbolId))) throw codedError("spec_missing", "a symbol contract is required");
  const direction = String(side).toLowerCase();
  if (!TRADE_SIDE[direction]) throw codedError("side_invalid", `side must be buy or sell, got ${side}`);
  const volumeScale = volumeScaleOr(spec.volumeScale);
  const volume = toProtocolVolume(volumeLots, volumeScale);
  const minVolume = num(spec.raw && spec.raw.minVolume);
  const stepVolume = num(spec.raw && spec.raw.stepVolume);
  if (finite(minVolume) && volume < minVolume) {
    throw codedError("volume_below_min", `${volume} is below the contract minimum of ${minVolume}`);
  }
  if (finite(stepVolume) && stepVolume > 0 && volume % stepVolume !== 0) {
    throw codedError("volume_off_step", `${volume} is not a multiple of the contract step of ${stepVolume}`);
  }
  const ref = num(referencePrice);
  const stop = num(stopPrice);
  if (!finite(ref) || ref <= 0) throw codedError("price_missing", "a positive reference price is required");
  if (!finite(stop) || stop <= 0) throw codedError("stop_missing", "a positive stop price is required");
  if (direction === "buy" && stop >= ref) throw codedError("stop_on_wrong_side", `a buy needs a stop below ${ref}, got ${stop}`);
  if (direction === "sell" && stop <= ref) throw codedError("stop_on_wrong_side", `a sell needs a stop above ${ref}, got ${stop}`);
  const distance = round(Math.abs(ref - stop), 10);
  const minimum = assertStopDistance({ spec, referencePrice: ref, distance });
  const relativeStopLoss = priceToRelativeStop(distance);
  if (typeof clientOrderId !== "string" || !clientOrderId) {
    throw codedError("client_order_id_missing", "a clientOrderId is required so an uncertain send can be reconciled");
  }
  if (clientOrderId.length > 50) {
    throw codedError("client_order_id_too_long", `clientOrderId is ${clientOrderId.length} characters, the protocol allows 50`);
  }
  if (comment !== undefined && typeof comment === "string" && comment.length > 512) {
    throw codedError("comment_too_long", `comment is ${comment.length} characters, the protocol allows 512`);
  }
  if (label !== undefined && typeof label === "string" && label.length > 100) {
    throw codedError("label_too_long", `label is ${label.length} characters, the protocol allows 100`);
  }
  if (isLimitedRisk && !spec.guaranteedStopLossAvailable) {
    // A limited-risk account must carry a guaranteed stop, so an order it would refuse is not sent at all.
    throw codedError("guaranteed_stop_unavailable", "the account is limited-risk and the contract offers no guaranteed stop");
  }
  const payload = {
    ctidTraderAccountId: Number(accountId),
    symbolId: Number(spec.symbolId),
    orderType: ORDER_TYPE.market,
    tradeSide: TRADE_SIDE[direction],
    volume,
    relativeStopLoss,
    clientOrderId
  };
  if (isLimitedRisk) payload.guaranteedStopLoss = true;
  if (comment) payload.comment = comment;
  if (label) payload.label = label;
  const lots = protocolVolumeToLots(volume, volumeScale);
  return {
    payload,
    numbers: {
      side: direction,
      volume,
      lots,
      exposureBtc: round(lots * num(spec.lotSizeBtc), 8),
      referencePrice: ref,
      stopPrice: stop,
      stopDistance: distance,
      stopDistanceMinimum: minimum,
      relativeStopLoss,
      stopPriceImplied: round(direction === "buy" ? ref - relativeStopLoss / PRICE_SCALE : ref + relativeStopLoss / PRICE_SCALE, 10),
      riskUsd: round(lots * num(spec.lotSizeBtc) * distance, 8),
      digits: num(spec.digits)
    }
  };
}

// Closing a position is always the full recorded volume: this lane never scales out, and a partial close is a
// different decision than the one the owner approved. `volumeScale` must be the closed symbol's own, or the
// protocol integer would be in another contract's units.
function buildClosePosition({ accountId, positionId, volumeLots, volumeScale } = {}) {
  if (!positionId) throw codedError("position_missing", "a position id is required");
  const scale = volumeScaleOr(volumeScale);
  const volume = toProtocolVolume(volumeLots, scale);
  return {
    payload: {
      ctidTraderAccountId: Number(accountId),
      positionId: Number(positionId),
      volume
    },
    numbers: { volume, lots: protocolVolumeToLots(volume, scale) }
  };
}

// ---- the pending-order and protection requests ----

// A pending order copied from the source. Its entry, stop and target are absolute prices, because a pending order
// is protected as it is placed and the protocol documents the absolute fields for it. The expiry decides the time
// in force: a source order with a date is GOOD_TILL_DATE at that millisecond, one without is GOOD_TILL_CANCEL.
// `referencePrice` is optional and, when given, is used only to refuse an entry that would fill at once.
//
// `limitPrice` is the entry whatever the kind (a stop order's entry is that same price, written to the payload's
// own `stopPrice` field below), and `stopLoss` is the protection the order carries once it fills. The two are not
// interchangeable: reading the protection as an entry price would place the copy somewhere the source never put it.
function buildPendingOrder({
  accountId,
  spec,
  side = "buy",
  volumeLots,
  orderType = "limit",
  limitPrice,
  stopLoss,
  takeProfit,
  expiryMs = null,
  referencePrice = null,
  clientOrderId,
  comment,
  label
} = {}) {
  if (!spec || !finite(num(spec.symbolId))) throw codedError("spec_missing", "a symbol contract is required");
  const direction = String(side).toLowerCase();
  if (!TRADE_SIDE[direction]) throw codedError("side_invalid", `side must be buy or sell, got ${side}`);
  const kind = String(orderType || "limit").toLowerCase();
  const type = kind === "limit" ? ORDER_TYPE.limit : kind === "stop" ? ORDER_TYPE.stop : null;
  if (type === null) throw codedError("order_type_unsupported", `a pending copy is a limit or a stop, got ${orderType}`);
  const volumeScale = volumeScaleOr(spec.volumeScale);
  const volume = toProtocolVolume(volumeLots, volumeScale);
  const minVolume = num(spec.raw && spec.raw.minVolume);
  const stepVolume = num(spec.raw && spec.raw.stepVolume);
  if (finite(minVolume) && volume < minVolume) {
    throw codedError("volume_below_min", `${volume} is below the contract minimum of ${minVolume}`);
  }
  if (finite(stepVolume) && stepVolume > 0 && volume % stepVolume !== 0) {
    throw codedError("volume_off_step", `${volume} is not a multiple of the contract step of ${stepVolume}`);
  }
  const entry = num(limitPrice);
  if (!finite(entry) || entry <= 0) throw codedError("price_missing", "a positive entry price is required");
  const ref = num(referencePrice);
  if (finite(ref) && ref > 0) {
    if (kind === "limit" && direction === "buy" && entry >= ref) {
      throw codedError("limit_on_wrong_side", `a buy limit must sit below ${ref}, got ${entry}`);
    }
    if (kind === "limit" && direction === "sell" && entry <= ref) {
      throw codedError("limit_on_wrong_side", `a sell limit must sit above ${ref}, got ${entry}`);
    }
    if (kind === "stop" && direction === "buy" && entry <= ref) {
      throw codedError("stop_on_wrong_side", `a buy stop must sit above ${ref}, got ${entry}`);
    }
    if (kind === "stop" && direction === "sell" && entry >= ref) {
      throw codedError("stop_on_wrong_side", `a sell stop must sit below ${ref}, got ${entry}`);
    }
  }
  const stop = num(stopLoss);
  const target = num(takeProfit);
  if (finite(stop) && stop > 0) {
    if (direction === "buy" && stop >= entry) throw codedError("stop_on_wrong_side", `a buy needs a stop below its entry ${entry}, got ${stop}`);
    if (direction === "sell" && stop <= entry) throw codedError("stop_on_wrong_side", `a sell needs a stop above its entry ${entry}, got ${stop}`);
  }
  if (typeof clientOrderId !== "string" || !clientOrderId) {
    throw codedError("client_order_id_missing", "a clientOrderId is required so an uncertain send can be reconciled");
  }
  if (clientOrderId.length > 50) {
    throw codedError("client_order_id_too_long", `clientOrderId is ${clientOrderId.length} characters, the protocol allows 50`);
  }
  if (comment !== undefined && typeof comment === "string" && comment.length > 512) {
    throw codedError("comment_too_long", `comment is ${comment.length} characters, the protocol allows 512`);
  }
  if (label !== undefined && typeof label === "string" && label.length > 100) {
    throw codedError("label_too_long", `label is ${label.length} characters, the protocol allows 100`);
  }
  const expiry = num(expiryMs);
  const hasExpiry = Number.isFinite(expiry) && expiry > 0;
  const payload = {
    ctidTraderAccountId: Number(accountId),
    symbolId: Number(spec.symbolId),
    orderType: type,
    tradeSide: TRADE_SIDE[direction],
    volume,
    timeInForce: hasExpiry ? TIME_IN_FORCE.goodTillDate : TIME_IN_FORCE.goodTillCancel,
    clientOrderId
  };
  if (kind === "limit") payload.limitPrice = entry;
  else payload.stopPrice = entry;
  if (hasExpiry) payload.expirationTimestamp = Math.round(expiry);
  if (finite(stop) && stop > 0) payload.stopLoss = stop;
  if (finite(target) && target > 0) payload.takeProfit = target;
  if (comment) payload.comment = comment;
  if (label) payload.label = label;
  return {
    payload,
    numbers: {
      side: direction,
      orderType: kind,
      volume,
      lots: protocolVolumeToLots(volume, volumeScale),
      entryPrice: entry,
      stopPrice: finite(stop) && stop > 0 ? stop : null,
      targetPrice: finite(target) && target > 0 ? target : null,
      expiryMs: hasExpiry ? Math.round(expiry) : null,
      digits: num(spec.digits)
    }
  };
}

// An amendment says only what changed: the protocol treats every price field as optional, and sending the entry
// again on an expiry-only change would rewrite a price the source has not moved. An empty amendment is refused,
// because a request that changes nothing is a request whose answer cannot be checked.
//
// The two prices the protocol separates are kept separate here too, because they mean different things on a
// resting order: `stopPrice` (ProtoOAAmendOrderReq.stopPrice, field 6) is the entry price of a STOP order, while
// `stopLoss` (field 8, "the absolute Stop Loss price") is the protection the order will carry once it fills. A
// copier that sent the source's moved stop as `stopPrice` would rewrite the entry level instead of the protection.
function buildAmendOrder({
  accountId,
  orderId,
  volumeLots = null,
  volumeScale,
  limitPrice = null,
  stopPrice = null,
  stopLoss = null,
  takeProfit = null,
  expiryMs = null
} = {}) {
  if (!orderId) throw codedError("order_missing", "an order id is required");
  const payload = { ctidTraderAccountId: Number(accountId), orderId: Number(orderId) };
  let changed = 0;
  if (finite(num(volumeLots)) && num(volumeLots) > 0) {
    payload.volume = toProtocolVolume(volumeLots, volumeScaleOr(volumeScale));
    changed += 1;
  }
  if (finite(num(limitPrice)) && num(limitPrice) > 0) {
    payload.limitPrice = num(limitPrice);
    changed += 1;
  }
  if (finite(num(stopPrice)) && num(stopPrice) > 0) {
    payload.stopPrice = num(stopPrice);
    changed += 1;
  }
  if (finite(num(stopLoss)) && num(stopLoss) > 0) {
    payload.stopLoss = num(stopLoss);
    changed += 1;
  }
  if (finite(num(takeProfit)) && num(takeProfit) > 0) {
    payload.takeProfit = num(takeProfit);
    changed += 1;
  }
  if (Number.isFinite(num(expiryMs)) && num(expiryMs) > 0) {
    payload.expirationTimestamp = Math.round(num(expiryMs));
    changed += 1;
  }
  if (!changed) throw codedError("amendment_empty", "an amendment must change at least one field");
  return { payload, numbers: { changed } };
}

function buildCancelOrder({ accountId, orderId } = {}) {
  if (!orderId) throw codedError("order_missing", "an order id is required");
  return { payload: { ctidTraderAccountId: Number(accountId), orderId: Number(orderId) }, numbers: { orderId: String(orderId) } };
}

// The stop and target of an open position. Absolute prices, and only the side given: an amendment that repeats an
// unchanged target is a second write of a number the broker already holds.
function buildAmendPositionSltp({ accountId, positionId, stopLoss = null, takeProfit = null } = {}) {
  if (!positionId) throw codedError("position_missing", "a position id is required");
  const payload = { ctidTraderAccountId: Number(accountId), positionId: Number(positionId) };
  let changed = 0;
  if (finite(num(stopLoss)) && num(stopLoss) > 0) {
    payload.stopLoss = num(stopLoss);
    changed += 1;
  }
  if (finite(num(takeProfit)) && num(takeProfit) > 0) {
    payload.takeProfit = num(takeProfit);
    changed += 1;
  }
  if (!changed) throw codedError("amendment_empty", "a stop/target amendment must carry at least one price");
  return { payload, numbers: { changed } };
}

// ---- TLS transport ----

// The JSON protocol shares port 5036 with the protobuf one and requires TLS. A plain TLS socket is enough: the
// docs state JSON over TCP on 5036, so no WebSocket framing library is needed. This function is deliberately
// thin and is the one piece the offline tests do not exercise, because it can only be exercised against the
// broker. Callers pass require("node:tls") so the module never opens a socket on import.
function createTlsTransport({ environment = "demo", tls, host, port, timeoutMs = 15000, onData, onClose, onError } = {}) {
  const endpoint = ENDPOINTS[environment];
  if (!endpoint) throw codedError("environment_invalid", `environment must be demo or live, got ${environment}`);
  if (!tls || typeof tls.connect !== "function") throw new TypeError("pass require(\"node:tls\") as tls");
  if (typeof onData !== "function") throw new TypeError("onData(text) is required");
  const target = host || endpoint.host;
  const socket = tls.connect({ host: target, port: port || endpoint.jsonPort, servername: target, rejectUnauthorized: true });
  socket.setEncoding("utf8");
  socket.setNoDelay(true);
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(codedError("connect_timeout", `no TLS handshake with ${target}:${port || endpoint.jsonPort} within ${timeoutMs} ms`)), timeoutMs);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  socket.on("data", (text) => onData(text));
  socket.on("error", (err) => { if (typeof onError === "function") onError(err); });
  socket.on("close", () => { if (typeof onClose === "function") onClose(); });
  return {
    endpoint,
    socket,
    ready,
    write(text) {
      socket.write(text);
    },
    close(reason) {
      socket.end();
      socket.destroy();
      if (typeof onClose === "function") onClose(reason);
    }
  };
}

module.exports = {
  ENDPOINTS,
  HEARTBEAT_MS,
  VOLUME_SCALE,
  PRICE_SCALE,
  PAYLOAD,
  ORDER_TYPE,
  TRADE_SIDE,
  TRADING_MODE,
  TIME_IN_FORCE,
  ORDER_STATUS,
  codedError,
  volumeScaleOr,
  toProtocolVolume,
  protocolVolumeToLots,
  lotSizeInBtc,
  pointsToPrice,
  percentToPrice,
  spotToPrice,
  priceToSpot,
  priceToRelativeStop,
  relativeStopToPrice,
  moneyFromProtocol,
  accountRow,
  traderSummary,
  symbolSpec,
  findSymbol,
  positionRow,
  orderRow,
  dealRow,
  encodeFrame,
  scanFrames,
  createFrameReader,
  createSession,
  authorize,
  buildMarketOrder,
  buildClosePosition,
  buildPendingOrder,
  buildAmendOrder,
  buildCancelOrder,
  buildAmendPositionSltp,
  createTlsTransport
};
