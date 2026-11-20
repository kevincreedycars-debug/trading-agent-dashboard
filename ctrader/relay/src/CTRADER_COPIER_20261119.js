// The continuous FTMO-1 -> cTrader copier. One source account, one destination account, and a mapping store that
// is the copier's own: it reads no lane's state, writes no lane's files, and shares nothing with the blind lanes
// except the relay's transport, vault and adapter, which are the parts already proven by the BTCUSD test.
//
// The shape is a poll, a plan and a send, and each of the three is separable:
//
//   source   the FTMO-1 terminal, read by `tools/mt5-bridge/live-trading-positions-probe.py` - positions and
//            working orders with the stops the terminal holds, and the contract sizes the size conversion needs.
//            Read-only by construction: the probe has no order function in it.
//   plan     a pure function of (source, destination exposure, mapping store, config). It states every action it
//            would take and every reason it refuses one, and it is the only place that decides anything.
//   send     the adapter's single market send and its single close. A send that times out is `unknown` and is
//            reconciled by client order id on the next poll, never repeated.
//
// Four rules, in the order they can bite:
//   1. The kill switch outranks every other decision: the file exists, nothing is sent, and the refusal is in the
//      health file.
//   2. A source that cannot be read is not an empty source. A failed poll opens nothing and closes nothing.
//   3. Size is converted through the contract, not through the lot number: source lots times the source contract
//      size, divided by the destination's own units per lot, floored to the destination's step, so a copy is never
//      larger than the trade it copies.
//   4. One position copies once. The mapping store is keyed by the source ticket and a ticket already mapped is
//      never sent again, whatever the broker answers to the first send.
//
// The exit is copied as an exit, not predicted: the destination carries the source's stop at entry, and when the
// source position is gone the destination position is closed. A take profit that fires at the source and a manual
// close look the same from this side, which is what makes the copy follow the account rather than the plan.
//
// A copy is kept in step while it is open, and the steps are the same three reads the open already uses:
//   volume  the destination's own position volume is compared with the proportion of the source that is still open,
//           and only the difference is closed. The difference is recomputed from the broker's read every poll, so a
//           restart, a lost answer and a repeated poll all reach the same number.
//   stop    the source's stop and target are compared with the destination's own, and only a difference is amended.
//   orders  a working source order is copied as a working destination order with its own entry, protection and
//           expiry; an amendment follows the source, and the copy leaves the book when the source order does.
// A source order that fills is followed through the position it became, not through a second market copy.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const transport = require("./CTRADER_TRANSPORT_20261114.js");

const { codedError } = transport;

const COPIER_VERSION = "copier-20261120.1";
const HEALTH_SCHEMA = 1;
const MAX_CLIENT_ORDER_ID = 50;
// A close that answered unknown is not repeated until the destination has had time to show it. Without this the
// second poll would recompute the same difference from a volume the broker has already reduced, and close twice.
const CLOSE_SETTLE_MS = 20000;
// The mapping store keeps the copies that are live. A copy that has closed leaves that store, and its row is
// kept in this bounded history instead: it is what lets a reader attribute a closed cTrader position to the
// source ticket that produced it after the position has left the reconcile response.
const HISTORY_LIMIT = 200;

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

function roundTo(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
function decimalsOf(step) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}




// ---- the source ----

// The probe's document, reduced to what the copier acts on. A document that says `ok: false`, names no account,
// or carries no positions list is a failed read rather than an empty account: the difference matters, because an
// empty account closes every copy and a failed read must not.
function readSource(document, { magic = null, symbols = null } = {}) {
  if (!document || typeof document !== "object") return { ok: false, cause: "source_unreadable", positions: [] };
  if (document.ok !== true) {
    return { ok: false, cause: "source_unreadable", message: (document.error && document.error.message) || null, positions: [] };
  }
  if (!document.account || !Array.isArray(document.positions)) {
    return { ok: false, cause: "source_incomplete", positions: [] };
  }
  const wanted = Array.isArray(symbols) && symbols.length ? new Set(symbols.map((row) => String(row))) : null;
  const contractSizes = document.contract_sizes && typeof document.contract_sizes === "object" ? document.contract_sizes : {};
  const positions = document.positions
    .filter((row) => (magic === null ? true : num(row.magic) === num(magic)))
    .filter((row) => (wanted ? wanted.has(String(row.symbol)) : true))
    .map((row) => ({
      ticket: String(row.ticket),
      symbol: String(row.symbol),
      side: row.side === "sell" ? "sell" : "buy",
      volume: num(row.volume),
      entry: num(row.price_open),
      current: num(row.price_current),
      stop: num(row.stop_loss),
      target: num(row.take_profit),
      contractSize: num(contractSizes[row.symbol]),
      magic: num(row.magic),
      openTimeUtc: row.time_utc || null
    }))
    .sort((left, right) => (left.ticket < right.ticket ? -1 : left.ticket > right.ticket ? 1 : 0));
  const orders = (Array.isArray(document.orders) ? document.orders : [])
    .filter((row) => (magic === null ? true : num(row.magic) === num(magic)))
    .filter((row) => (wanted ? wanted.has(String(row.symbol)) : true))
    .map((row) => {
      const kind = row.kind_name === "limit" || row.kind_name === "stop" || row.kind_name === "stop_limit"
        ? row.kind_name
        : (num(row.kind) === 2 || num(row.kind) === 3 ? "limit" : num(row.kind) === 4 || num(row.kind) === 5 ? "stop" : "stop_limit");
      const expiryMs = row.time_expiration_utc ? Date.parse(String(row.time_expiration_utc)) : Number.NaN;
      return {
        ticket: String(row.ticket),
        symbol: String(row.symbol),
        side: row.side === "sell" ? "sell" : "buy",
        kind,
        volume: num(row.volume),
        price: num(row.price_open),
        stop: num(row.stop_loss),
        target: num(row.take_profit),
        contractSize: num(contractSizes[row.symbol]),
        magic: num(row.magic),
        expiryMs: Number.isFinite(expiryMs) && expiryMs > 0 ? expiryMs : null,
        placedUtc: row.time_setup_utc || null
      };
    })
    .sort((left, right) => (left.ticket < right.ticket ? -1 : left.ticket > right.ticket ? 1 : 0));
  return {
    ok: true,
    account: document.account,
    probedAtUtc: document.probed_at_utc || null,
    positions,
    orders,
    // The working orders are what a pending copy follows: an order that the source accepted and still holds.
    pendingOrders: orders
  };
}

// ---- the size ----

// Source lots to destination lots, through the contracts. Both sides price one lot at a different number of
// units, so the only honest conversion goes through the units themselves; the destination's step is applied by
// flooring, which can shorten a copy and can never widen one.
function convertVolume({ sourceLots, sourceContractSize, spec, maxLots = null } = {}) {
  const lots = num(sourceLots);
  const sourceUnits = num(sourceContractSize);
  const targetUnits = num(spec && spec.lotSizeBtc);
  const step = num(spec && spec.volumeStep);
  const minimum = num(spec && spec.minVolume);
  const maximum = spec && finite(num(spec.maxVolume)) ? num(spec.maxVolume) : null;
  if (!finite(lots) || lots <= 0) return { ok: false, cause: "source_volume_invalid" };
  if (!finite(sourceUnits) || sourceUnits <= 0) return { ok: false, cause: "source_contract_missing" };
  if (!finite(targetUnits) || targetUnits <= 0) return { ok: false, cause: "target_contract_missing" };
  if (!finite(step) || step <= 0) return { ok: false, cause: "target_step_missing" };
  const wanted = (lots * sourceUnits) / targetUnits;
  const ceiling = finite(num(maxLots)) && num(maxLots) > 0 ? num(maxLots) : null;
  const capped = ceiling !== null && wanted > ceiling ? ceiling : wanted;
  const floored = Math.floor(capped / step + 1e-9) * step;
  if (finite(minimum) && floored < minimum) {
    // Refused, not rounded up: a copy bigger than the source trade is not the same trade.
    return { ok: false, cause: "volume_below_target_minimum", wanted, minimum };
  }
  if (maximum !== null && floored > maximum) return { ok: false, cause: "volume_above_target_maximum", wanted };
  return { ok: true, lots: roundTo(floored, decimalsOf(step)), capped: capped !== wanted, wanted };
}

// A ticket whose first send answered unknown gets its second request id from the attempt count, so a resend is
// never the same client order id as a send the broker might already hold.
function clientOrderId(ticket, attempt = 0) {
  const suffix = num(attempt) > 0 ? `-a${num(attempt)}` : "";
  const id = `copy-${ticket}${suffix}`;
  return id.length > MAX_CLIENT_ORDER_ID ? id.slice(0, MAX_CLIENT_ORDER_ID) : id;
}

function truncate(value, limit) {
  const text = String(value === null || value === undefined ? "" : value);
  return text.length > limit ? text.slice(0, limit) : text;
}

function mappingFor(state, ticket) {
  const rows = state && state.mappings && typeof state.mappings === "object" ? state.mappings : {};
  return rows[String(ticket)] || null;
}

// A pending row is a send whose answer never came. It is a claim on the ticket: no second send is made for it until
// the broker has been asked, by the client order id that send carried, whether it holds the order.
function pendingFor(state, ticket) {
  const rows = state && state.pending && typeof state.pending === "object" ? state.pending : {};
  return rows[String(ticket)] || null;
}

function attemptFor(state, ticket) {
  const rows = state && state.attempts && typeof state.attempts === "object" ? state.attempts : {};
  const value = num(rows[String(ticket)]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// The adapter answers `listExposures` with `{ positions, orders }`; a plan written against a bare array should
// still read. Only an absent read returns null, which is "not asked" and not the same as "flat".
function exposureRows(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.positions)) return value.positions;
  return null;
}

// The working orders beside those positions. `null` is "not asked", which is why a missing order list refuses an
// amendment or a cancel rather than treating every copy as already gone.
function exposureOrders(value) {
  if (value && Array.isArray(value.orders)) return value.orders;
  return null;
}

function targetSymbolFor(map, sourceSymbol) {
  const table = map && typeof map === "object" ? map : {};
  return Object.prototype.hasOwnProperty.call(table, sourceSymbol) ? table[sourceSymbol] : sourceSymbol;
}

// A source ticket is followed either directly or through the position an accepted order became. The alias is the
// broker's link, written only when the destination order reports the position it filled into.
function mappingForKey(state, ticket) {
  const direct = mappingFor(state, ticket);
  if (direct) return direct;
  const aliases = state && state.aliases && typeof state.aliases === "object" ? state.aliases : {};
  const key = aliases[String(ticket)];
  return key ? mappingFor(state, key) : null;
}

// A pending copy carries its own request id prefix, so a working order and a market copy of the same ticket can never
// collide in the broker's client order id space.
function pendingClientOrderId(ticket, attempt = 0) {
  const suffix = num(attempt) > 0 ? `-a${num(attempt)}` : "";
  const id = `lim-${ticket}${suffix}`;
  return id.length > MAX_CLIENT_ORDER_ID ? id.slice(0, MAX_CLIENT_ORDER_ID) : id;
}

function samePrice(left, right, digits = 5) {
  const a = left === null || left === undefined || left === "" ? null : num(left);
  const b = right === null || right === undefined || right === "" ? null : num(right);
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(roundTo(a, digits) - roundTo(b, digits)) < 1e-9;
}

function sameExpiry(leftMs, rightMs) {
  const a = Number.isFinite(num(leftMs)) && num(leftMs) > 0 ? Math.round(num(leftMs) / 1000) : null;
  const b = Number.isFinite(num(rightMs)) && num(rightMs) > 0 ? Math.round(num(rightMs) / 1000) : null;
  return a === b;
}

// The exchange a stop or a target must make with the entry. A source that has already trailed its stop past the
// entry sends nothing that would be reversed here, so this is the same rule the open already applies.
function protectionBeyondEntry(side, stop, entry) {
  if (!Number.isFinite(stop) || !Number.isFinite(entry)) return true;
  return side === "buy" ? stop < entry : stop > entry;
}

// A source position that has already been copied: keep the destination's volume, stop and target in step with what
// the source still holds. Every difference is recomputed from the two broker reads, so an unknown answer, a restart
// or a repeated poll converges on the same number instead of repeating the last action.
function planMappedCopy({ position, mapped, targetSymbol, exposure, references, specs, config, state, refusals, closes, stops, nowMs }) {
  const targetPositionId = mapped.targetPositionId || mapped.target_position_id || null;
  const rows = exposureRows(exposure[targetSymbol]);
  let dest = null;
  if (rows) {
    dest = rows.find((row) => String(row.positionId) === String(targetPositionId)) || null;
    if (!dest) {
      refusals.push({ code: "copy_no_longer_open", ticket: position.ticket, detail: targetPositionId });
      return;
    }
  }
  const spec = specs[targetSymbol] || null;
  const digits = finite(num(spec && spec.digits)) ? num(spec.digits) : 5;

  if (dest) {
    // ---- the stop and the target ----
    const knowsProtection = Object.prototype.hasOwnProperty.call(dest, "protectionStop")
      || Object.prototype.hasOwnProperty.call(dest, "targetPrice");
    if (config.syncSlTp !== false && knowsProtection) {
      const desiredStop = finite(num(position.stop)) && num(position.stop) > 0 ? roundTo(num(position.stop), digits) : null;
      const desiredTarget = finite(num(position.target)) && num(position.target) > 0 ? roundTo(num(position.target), digits) : null;
      const currentStop = dest.protectionStop === null || dest.protectionStop === undefined ? null : roundTo(num(dest.protectionStop), digits);
      const currentTarget = dest.targetPrice === null || dest.targetPrice === undefined ? null : roundTo(num(dest.targetPrice), digits);
      const stopChanged = !samePrice(currentStop, desiredStop, digits);
      const targetChanged = !samePrice(currentTarget, desiredTarget, digits);
      if (stopChanged || targetChanged) {
        if (desiredStop === null && currentStop !== null) {
          // Amending a stop away is not a copy of anything the source said; the source simply stopped carrying one.
          refusals.push({ code: "source_stop_removed", ticket: position.ticket, detail: currentStop });
        } else if (desiredStop !== null && !protectionBeyondEntry(position.side, desiredStop, referenceFor(targetSymbol, position, references))) {
          refusals.push({ code: "source_stop_wrong_side", ticket: position.ticket, detail: desiredStop });
        } else {
          if (desiredTarget === null && currentTarget !== null) {
            refusals.push({ code: "source_target_removed", ticket: position.ticket, detail: currentTarget });
          }
          stops.push({
            type: "amend_sltp",
            ticket: position.ticket,
            symbol: targetSymbol,
            positionId: String(dest.positionId),
            stopLoss: desiredStop,
            takeProfit: desiredTarget !== null ? desiredTarget : currentTarget,
            source_stop: desiredStop,
            source_target: desiredTarget,
            destination_stop: currentStop,
            destination_target: currentTarget
          });
        }
      }
    }

    // ---- the volume still open at the source ----
    const lastSourceVolume = finite(num(mapped.source_volume)) ? num(mapped.source_volume) : null;
    if (dest.volume !== undefined && dest.volume !== null) {
      const size = convertVolume({ sourceLots: position.volume, sourceContractSize: position.contractSize, spec, maxLots: null });
      const destVolume = num(dest.volume);
      if (!size.ok) {
        refusals.push({ code: size.cause, ticket: position.ticket, detail: size.wanted || null });
      } else if (lastSourceVolume === null) {
        // No baseline was recorded when the copy opened. This poll states it rather than guessing a difference.
        refusals.push({ code: "source_volume_baseline_missing", ticket: position.ticket, detail: roundTo(size.lots, 6) });
      } else if (Math.abs(num(position.volume) - lastSourceVolume) > 1e-9) {
        const step = num(spec && spec.volumeStep);
        const delta = roundTo(destVolume - size.lots, 6);
        if (!(step > 0)) {
          refusals.push({ code: "volume_step_missing", ticket: position.ticket, detail: null });
        } else if (delta < -1e-9 && mapped.capped === true) {
          // The copy was opened short under the owner's ceiling. The destination holding less than the proportion is
          // the ceiling at work, not a shortfall to correct upward.
        } else if (delta < -1e-9) {
          refusals.push({ code: "source_volume_increased", ticket: position.ticket, detail: roundTo(Math.abs(delta), 6) });
        } else if (delta >= step - 1e-9 || (delta > 1e-9 && Math.abs(destVolume - size.lots) <= step / 2)) {
          const settling = state && state.close_unknown && state.close_unknown[String(dest.positionId)];
          if (settling && nowMs !== null && num(nowMs) - num(settling.at_ms) < CLOSE_SETTLE_MS) {
            refusals.push({ code: "close_settling", ticket: position.ticket, detail: roundTo(delta, 6) });
          } else if (delta > 1e-9) {
            closes.push({
              type: "close",
              ticket: position.ticket,
              symbol: targetSymbol,
              positionId: String(dest.positionId),
              volume: roundTo(Math.min(delta, destVolume), decimalsOf(step)),
              partial: true,
              source_volume: num(position.volume),
              destination_volume: destVolume,
              target_volume: roundTo(size.lots, 6),
              reason: "source_partial_close"
            });
          }
        }
      }
    }
  }
}


// A working order that is already copied: compare the destination's own order with the source's, field by field, and
// ask for an amendment only where they differ. The entry price is only sent when it is the field the source changed;
// the expiry follows the source's date exactly, including a date that was added or removed.
function planMappedOrder({ order, mapped, targetSymbol, exposure, refusals, amends, orderChecks, digits }) {
  const rows = exposureOrders(exposure[targetSymbol]);
  if (rows === null) {
    refusals.push({ code: "destination_orders_unreadable", ticket: order.ticket, detail: targetSymbol });
    return;
  }
  const dest = rows.find((row) => String(row.orderId) === String(mapped.target_order_id || ""));
  if (!dest) {
    // The copy left the destination book. Whether it filled or was cancelled decides what happens next, and only the
    // broker's historic orders answer that; the check is asked for and the next poll acts on the answer.
    orderChecks.push({ ticket: order.ticket, orderId: String(mapped.target_order_id || ""), symbol: targetSymbol, reason: "order_left_book" });
    return;
  }
  if (dest.working !== true) {
    orderChecks.push({ ticket: order.ticket, orderId: String(dest.orderId), symbol: targetSymbol, reason: `order_${dest.statusName || "not_working"}` });
    return;
  }
  const changes = {};
  const desiredEntry = roundTo(order.price, digits);
  if (order.kind === "limit" && !samePrice(dest.price, desiredEntry, digits)) changes.limitPrice = desiredEntry;
  if (order.kind === "stop" && !samePrice(dest.stopPrice, desiredEntry, digits)) changes.stopPrice = desiredEntry;
  const desiredStop = finite(order.stop) && order.stop > 0 ? roundTo(order.stop, digits) : null;
  const desiredTarget = finite(order.target) && order.target > 0 ? roundTo(order.target, digits) : null;
  if (!samePrice(dest.stopLoss, desiredStop, digits)) {
    if (desiredStop === null) refusals.push({ code: "source_stop_removed", ticket: order.ticket, detail: dest.stopLoss === undefined ? null : dest.stopLoss });
    else changes.stopLoss = desiredStop;
  }
  if (!samePrice(dest.targetPrice, desiredTarget, digits)) {
    if (desiredTarget === null) refusals.push({ code: "source_target_removed", ticket: order.ticket, detail: dest.targetPrice === undefined ? null : dest.targetPrice });
    else changes.takeProfit = desiredTarget;
  }
  if (!sameExpiry(dest.expirationTimestampMs, order.expiryMs)) changes.expiryMs = order.expiryMs;
  if (!Object.keys(changes).length) return;
  amends.push({
    type: "amend_order",
    ticket: order.ticket,
    symbol: targetSymbol,
    orderId: String(dest.orderId),
    changes,
    source_entry: order.price,
    source_stop: desiredStop,
    source_target: desiredTarget
  });
}

// The price a copy's stop must make sense against. The destination's reference is preferred because that is the side
// the order is placed into; the source's current price is the next best reading; the entry is the last resort, and it
// is the one that behaves like the older rule for a position that has not moved.
function referenceFor(targetSymbol, position, references) {
  const map = references && typeof references === "object" ? references : {};
  const fromDestination = num(map[targetSymbol]);
  if (finite(fromDestination) && fromDestination > 0) return fromDestination;
  if (finite(num(position.current)) && num(position.current) > 0) return num(position.current);
  return num(position.entry);
}

// A working source order that is not copied yet: state the destination order it becomes, or the refusal that stops it.
// The entry is judged against the destination's own price, because a limit on the market side of the book fills at
// once and would be a market copy of an order the source placed as a limit.
function planOrderPlacement({ order, targetSymbol, spec, config, state, references, maxOpen, mappedCount, places }) {
  if (!spec) return { code: "target_symbol_unknown", ticket: order.ticket, detail: targetSymbol };
  if (spec.tradeMode && String(spec.tradeMode).toLowerCase() !== "full") {
    return { code: "target_symbol_not_tradeable", ticket: order.ticket, detail: spec.tradeMode };
  }
  if (order.kind !== "limit" && order.kind !== "stop") {
    // A stop-limit or a market-if-touched has no one-to-one shape on the destination this copier can state honestly.
    return { code: "order_kind_unsupported", ticket: order.ticket, detail: order.kind };
  }
  if (!(order.volume > 0) || !(order.price > 0)) {
    return { code: "source_order_incomplete", ticket: order.ticket, detail: { volume: order.volume, price: order.price } };
  }
  const size = convertVolume({ sourceLots: order.volume, sourceContractSize: order.contractSize, spec, maxLots: config.maxLots });
  if (!size.ok) {
    return {
      code: size.cause,
      ticket: order.ticket,
      detail: finite(size.minimum) ? size.minimum : size.wanted,
      wanted: finite(size.wanted) ? size.wanted : null,
      minimum: finite(size.minimum) ? size.minimum : null
    };
  }
  if (maxOpen !== null && mappedCount + places.length >= maxOpen) return { code: "max_open_reached", ticket: order.ticket, detail: maxOpen };
  const digits = finite(num(spec.digits)) ? num(spec.digits) : 5;
  const entry = roundTo(order.price, digits);
  const reference = num(references[targetSymbol]);
  if (finite(reference) && reference > 0) {
    const fillsAtOnce = order.kind === "limit"
      ? (order.side === "buy" ? entry >= reference : entry <= reference)
      : (order.side === "buy" ? entry <= reference : entry >= reference);
    if (fillsAtOnce) return { code: order.kind === "limit" ? "limit_on_wrong_side" : "stop_on_wrong_side", ticket: order.ticket, detail: { entry, reference } };
  }
  const stopPrice = finite(order.stop) && order.stop > 0 ? roundTo(order.stop, digits) : null;
  if (stopPrice !== null && !protectionBeyondEntry(order.side, stopPrice, entry)) {
    return { code: "source_stop_wrong_side", ticket: order.ticket, detail: stopPrice };
  }
  const targetPrice = finite(order.target) && order.target > 0 ? roundTo(order.target, digits) : null;
  if (targetPrice !== null && !(order.side === "buy" ? targetPrice > entry : targetPrice < entry)) {
    return { code: "source_target_wrong_side", ticket: order.ticket, detail: targetPrice };
  }
  const requestId = pendingClientOrderId(order.ticket, attemptFor(state, order.ticket));
  return {
    type: "place_order",
    ticket: order.ticket,
    symbol: targetSymbol,
    source_symbol: order.symbol,
    side: order.side,
    orderType: order.kind,
    volume: size.lots,
    price: entry,
    stopPrice,
    takeProfit: targetPrice,
    // An expiry date is carried as the date the source stated; no date is good-till-cancelled. The two are never
    // swapped, because a copy that outlives its order is a trade the source no longer has.
    expiryMs: order.expiryMs === null || order.expiryMs === undefined ? null : num(order.expiryMs),
    requestId,
    comment: truncate(requestId, 512),
    source_entry: order.price,
    source_volume: order.volume,
    capped: size.capped === true
  };
}

// The whole decision, over the source read and the destination's own exposure. Every action names the source
// ticket it came from and the client order id it will carry, so a journal line can be traced back to a ticket.
// Nothing here sends: `pollOnce` is what turns an action into a send, and a dry run stops before it.
//
// `exposure` is the destination read per target symbol: `{ EURUSD: { positions: [...], orders: [...] } }`, and
// `references` is the destination's own price per target symbol, which is where the stop has to make sense.
// `nowMs` is only used to hold a repeated close while a previous unknown close settles; a plan built without it
// behaves exactly as before.
function planActions({ source, exposure = {}, references = {}, state = {}, config = {}, specs = {}, nowMs = null } = {}) {
  const actions = [];
  const refusals = [];
  const closes = [];
  const stops = [];
  const places = [];
  const amends = [];
  const cancels = [];
  const orderChecks = [];
  const empty = { actions, refusals, closes, stops, places, amends, cancels, orderChecks };
  if (!source || source.ok !== true) {
    return { ...empty, refusals: [{ code: "source_unreadable", detail: (source && source.cause) || null }] };
  }
  const map = config.symbolMap || {};
  const maxOpen = finite(num(config.maxOpen)) ? num(config.maxOpen) : null;
  const mappedCount = Object.keys(state.mappings || {}).length;
  const seen = new Set();
  for (const position of source.positions) {
    seen.add(position.ticket);
    const targetSymbol = targetSymbolFor(map, position.symbol);
    if (!targetSymbol) {
      // A symbol mapped to null is a deliberate exclusion, not a missing rule.
      refusals.push({ code: "symbol_excluded", ticket: position.ticket, detail: position.symbol });
      continue;
    }
    const mapped = mappingForKey(state, position.ticket);
    if (mapped) {
      // The source ticket is followed: either directly, or through the position an accepted order filled into. Its
      // alignment is judged from the source read and the destination's own read, never from what was last sent.
      seen.add(String(mapped.source_ticket || position.ticket));
      planMappedCopy({ position, mapped, targetSymbol, exposure, references, specs, config, state, refusals, closes, stops, nowMs });
      continue;
    }
    const pending = pendingFor(state, position.ticket);
    if (pending) {
      // Sent once, and the answer never arrived. Until the broker is asked whether it holds that client order id,
      // a second send would risk a duplicate, so the ticket waits and says so.
      refusals.push({ code: "copy_pending_reconcile", ticket: position.ticket, detail: pending.request_id || null });
      continue;
    }
    const spec = specs[targetSymbol] || null;
    if (!spec) {
      refusals.push({ code: "target_symbol_unknown", ticket: position.ticket, detail: targetSymbol });
      continue;
    }
    if (spec.tradeMode && String(spec.tradeMode).toLowerCase() !== "full") {
      refusals.push({ code: "target_symbol_not_tradeable", ticket: position.ticket, detail: spec.tradeMode });
      continue;
    }
    if (!finite(position.stop) || position.stop <= 0) {
      refusals.push({ code: "source_stop_missing", ticket: position.ticket, detail: position.symbol });
      continue;
    }
    // The stop is judged against the market it will be placed into, not against the source's entry: a source that
    // trailed its stop into profit holds a stop a buy cannot carry - above the market - so that copy is refused
    // rather than sent as a stop the destination would reject or fill at once. The destination's own reference price
    // is the arbiter the broker will use; the source's current price stands in when the reference cannot be read.
    const reference = referenceFor(targetSymbol, position, references);
    if (position.side === "buy" && !(position.stop < reference)) {
      refusals.push({ code: "source_stop_wrong_side", ticket: position.ticket, detail: position.stop });
      continue;
    }
    if (position.side === "sell" && !(position.stop > reference)) {
      refusals.push({ code: "source_stop_wrong_side", ticket: position.ticket, detail: position.stop });
      continue;
    }
    const size = convertVolume({
      sourceLots: position.volume,
      sourceContractSize: position.contractSize,
      spec,
      maxLots: config.maxLots
    });
    if (!size.ok) {
      // The numbers travel with the refusal: a size that was refused is a question about the two contracts, and the
      // answer has to be readable without re-reading the broker's own spec.
      refusals.push({
        code: size.cause,
        ticket: position.ticket,
        detail: finite(size.minimum) ? size.minimum : size.wanted,
        wanted: finite(size.wanted) ? size.wanted : null,
        minimum: finite(size.minimum) ? size.minimum : null
      });
      continue;
    }
    if (maxOpen !== null && Object.keys(state.mappings || {}).length + actions.length >= maxOpen) {
      refusals.push({ code: "max_open_reached", ticket: position.ticket, detail: maxOpen });
      continue;
    }
    actions.push({
      type: "open",
      ticket: position.ticket,
      symbol: targetSymbol,
      sourceSymbol: position.symbol,
      side: position.side,
      volume: size.lots,
      stopPrice: roundTo(position.stop, finite(num(spec.digits)) ? num(spec.digits) : 5),
      requestId: clientOrderId(position.ticket, attemptFor(state, position.ticket)),
      entry: position.entry,
      // The volume the source held when the copy was opened. The next partial close is measured against this, not
      // against the destination's own size, because the destination's size may already be capped.
      sourceVolume: num(position.volume),
      capped: size.capped === true,
      // The comment repeats the client order id: a filled market order leaves the pending list, so the position's
      // own comment is what the adapter's reconciliation falls back to when no order carries the id any more.
      comment: truncate(clientOrderId(position.ticket, attemptFor(state, position.ticket)), 512)
    });
  }
  // The closings, stated from the store: a mapped ticket the source no longer carries is an exit that happened,
  // whether it was a stop, a target or a hand. An order copy that filled is followed through the position it became,
  // so a filled order's mapping is closed here only when no source position could be bound to it: an unmanaged
  // destination position would be worse than a closed one.
  for (const [ticket, mapped] of Object.entries(state.mappings || {})) {
    if (seen.has(String(ticket))) continue;
    if (mapped && mapped.kind === "order" && !(mapped.targetPositionId || mapped.target_position_id)) continue;
    const positionId = mapped && (mapped.targetPositionId || mapped.target_position_id);
    if (!positionId) {
      refusals.push({ code: "mapping_without_target", ticket: String(ticket), detail: null });
      continue;
    }
    if (mapped && mapped.kind === "order" && mapped.unlinked !== true) {
      // The order copy filled and its source position was bound under this key by the alias; reaching here means the
      // alias was dropped, which the reconcile step states in the notes before this close is planned.
      refusals.push({ code: "order_copy_unlinked", ticket: String(ticket), detail: String(positionId) });
      continue;
    }
    closes.push({
      type: "close",
      ticket: String(ticket),
      symbol: mapped.symbol || null,
      positionId: String(positionId),
      // The size the copy was opened at, so the close is built from a stated number rather than from whatever
      // the adapter can find. A close with no volume means "all of it" at the adapter, but a run that knows the
      // size it opened states it.
      volume: finite(num(mapped.volume)) ? num(mapped.volume) : null,
      reason: "source_closed"
    });
  }

  // ---- the working orders ----
  // A pending copy waits in the book, so the destination carries the same order the source does: the entry, the
  // protection and the expiry, in absolute prices. `working` is status ACCEPTED and nothing else: any other status
  // means the copy has left the book, and only the broker's history says whether it filled or was cancelled.
  const pendingOrders = Array.isArray(source.pendingOrders) ? source.pendingOrders : [];
  const sourceOrderTickets = new Set();
  for (const order of pendingOrders) {
    sourceOrderTickets.add(order.ticket);
    const targetSymbol = targetSymbolFor(map, order.symbol);
    if (!targetSymbol) {
      refusals.push({ code: "symbol_excluded", ticket: order.ticket, detail: order.symbol });
      continue;
    }
    const mapped = mappingFor(state, order.ticket);
    if (mapped && mapped.kind === "position") {
      // The source order filled and its copy is already followed as a position. The source's own order list can show
      // the order again only after it was re-placed, which is a different copy.
      refusals.push({ code: "order_copy_already_filled", ticket: order.ticket, detail: mapped.target_position_id || null });
      continue;
    }
    const spec = specs[targetSymbol] || null;
    const digits = finite(num(spec && spec.digits)) ? num(spec.digits) : 5;
    if (mapped) {
      planMappedOrder({ order, mapped, targetSymbol, exposure, specs, refusals, amends, orderChecks, digits });
      continue;
    }
    const pending = pendingFor(state, order.ticket);
    if (pending) {
      refusals.push({ code: "copy_pending_reconcile", ticket: order.ticket, detail: pending.request_id || null });
      continue;
    }
    const place = planOrderPlacement({ order, targetSymbol, spec, config, state, references, maxOpen, mappedCount, places });
    if (place) {
      if (place.code) refusals.push(place);
      else places.push(place);
    }
  }

  // A working destination order whose source order is gone: the source cancelled it, or it expired. Either way the
  // copy must leave the book too, and if it is already gone the broker's history says what it became.
  for (const [ticket, mapped] of Object.entries(state.mappings || {})) {
    if (!mapped || mapped.kind !== "order") continue;
    if (sourceOrderTickets.has(String(ticket))) continue;
    const targetSymbol = mapped.symbol || null;
    if (!targetSymbol) continue;
    const rows = exposureOrders(exposure[targetSymbol]);
    if (rows === null) continue;
    const orderId = String(mapped.target_order_id || "");
    const dest = orderId ? rows.find((row) => String(row.orderId) === orderId) : null;
    if (dest && dest.working === true) {
      cancels.push({ type: "cancel_order", ticket: String(ticket), symbol: targetSymbol, orderId, reason: "source_order_gone" });
    } else if (!(mapped.targetPositionId || mapped.target_position_id)) {
      // Not in the destination's working list and not a position: history decides between filled and never filled.
      orderChecks.push({ ticket: String(ticket), orderId, symbol: targetSymbol, reason: "source_order_gone" });
    }
  }
  return { actions, refusals, closes, stops, places, amends, cancels, orderChecks };
}

// ---- the store ----

// The mapping store is the copier's memory and its idempotency key: one row per source ticket, written after the
// broker accepts an order and deleted when the destination position is closed. It is written whole and renamed
// into place, so a crash mid-write leaves the previous file rather than a truncated one.
function readJson(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (err) {
    if (err && err.code === "ENOENT") return { ok: true, value: null };
    return { ok: false, error: err };
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

function emptyState() {
  return {
    schema: HEALTH_SCHEMA,
    version: COPIER_VERSION,
    mappings: {},
    pending: {},
    attempts: {},
    history: [],
    // A source order ticket and the position it filled into are different tickets. The alias is the broker's own link
    // between them, and it is what keeps a filled order copy from being read as a source position that closed.
    aliases: {},
    // A close whose answer was unknown, by destination position: the time it was sent, so the next poll can let the
    // destination settle before measuring the same difference again.
    close_unknown: {},
    updated_utc: null
  };
}


// ---- the store ----


// One unknown answer, resolved before anything else is sent. Three outcomes: the broker holds the position (record
// it as a mapping), the source has since closed the ticket (drop the claim, nothing to copy), or the claim is older
// than the patience window and the broker still answers nothing (drop it and let the next send use a new client
// order id, which the attempt count names). A broker that cannot be asked leaves the row exactly where it was.
async function reconcilePending({ client, state, source, config = {}, now = () => Date.now(), health = { notes: [] } } = {}) {
  const rows = Object.entries(state.pending || {});
  if (!rows.length) return { checked: 0, mapped: 0, dropped: 0, filled: 0 };
  const sourcePositions = source && Array.isArray(source.positions) ? source.positions : [];
  const sourceTickets = new Set(sourcePositions.map((row) => String(row.ticket)));
  const sourceOrderTickets = new Set((source && Array.isArray(source.pendingOrders) ? source.pendingOrders : []).map((row) => String(row.ticket)));
  const patienceMs = finite(num(config.pendingTtlMs)) && num(config.pendingTtlMs) > 0 ? num(config.pendingTtlMs) : 10 * 60 * 1000;
  let mapped = 0;
  let dropped = 0;
  let checked = 0;
  let filled = 0;
  for (const [ticket, row] of rows) {
    checked += 1;
    const requestId = row && row.request_id ? String(row.request_id) : "";
    if (row && row.kind === "order") {
      // A pending copy's claim. The broker is asked for the client order id the send carried: a working order means
      // the copy is recorded, a filled order means it is followed through the position it became, and neither means
      // the order was never created - the source decides whether that is a retry or the end of the copy.
      if (typeof client.findOrderByRequestId !== "function") {
        health.notes.push(`reconcile ${ticket}: the adapter cannot search working and historic orders; the claim stays pending`);
        continue;
      }
      let found = null;
      try {
        found = await client.findOrderByRequestId(requestId);
      } catch (err) {
        health.notes.push(`reconcile ${ticket}: the broker could not be asked about ${requestId} (${(err && err.code) || (err && err.message) || err}); the claim stays pending`);
        continue;
      }
      if (found && found.statusName === "accepted" && found.orderId) {
        const orderId = String(found.orderId);
        state.mappings[ticket] = orderMappingFrom({ ticket, row, orderId, now });
        delete state.pending[ticket];
        mapped += 1;
        health.notes.push(`reconcile ${ticket}: the broker holds working order ${orderId} for ${requestId}; the copy is recorded`);
        continue;
      }
      if (found && found.statusName === "filled" && found.positionId) {
        const record = orderMappingFrom({ ticket, row, orderId: found.orderId ? String(found.orderId) : null, now });
        const bound = bindFilledOrderCopy({
          state,
          ticket,
          mapped: record,
          positionId: String(found.positionId),
          map: config.symbolMap || {},
          positions: sourcePositions,
          now,
          health
        });
        state.mappings[ticket] = record;
        delete state.pending[ticket];
        if (bound === "bound") filled += 1;
        else dropped += 1;
        continue;
      }
      const ageMs = num(now()) - num(row.at_ms);
      if (!sourceOrderTickets.has(String(ticket))) {
        delete state.pending[ticket];
        dropped += 1;
        health.notes.push(`reconcile ${ticket}: the broker holds neither a working order nor a position for ${requestId}, and the source no longer holds the order; the claim is dropped`);
        continue;
      }
      if (Number.isFinite(ageMs) && ageMs > patienceMs) {
        const attempt = attemptFor(state, ticket);
        state.attempts[ticket] = attempt + 1;
        delete state.pending[ticket];
        dropped += 1;
        health.notes.push(`reconcile ${ticket}: no order or position for ${requestId} after ${Math.round(ageMs / 1000)}s; the claim is dropped and the next send carries attempt ${attempt + 1}`);
      }
      continue;
    }
    let found = null;
    if (requestId && typeof client.findByRequestId === "function") {
      try {
        found = await client.findByRequestId(requestId);
      } catch (err) {
        health.notes.push(`reconcile ${ticket}: the broker could not be asked (${(err && err.code) || (err && err.message) || err}); the row stays pending`);
        continue;
      }
    }
    const positionId = found && found.position ? String(found.position.positionId || "") : "";
    if (positionId) {
      state.mappings[ticket] = {
        source_ticket: String(ticket),
        source_symbol: row.source_symbol || null,
        symbol: row.symbol || null,
        side: row.side || null,
        volume: num(row.volume),
        stop_price: num(row.stop_price),
        target_position_id: positionId,
        targetPositionId: positionId,
        request_id: requestId,
        copied_utc: iso(now()),
        reconciled: true
      };
      delete state.pending[ticket];
      mapped += 1;
      health.notes.push(`reconcile ${ticket}: the broker holds position ${positionId} for ${requestId}; the copy is recorded`);
      continue;
    }
    const ageMs = num(now()) - num(row.at_ms);
    if (!sourceTickets.has(String(ticket))) {
      delete state.pending[ticket];
      dropped += 1;
      health.notes.push(`reconcile ${ticket}: the source no longer holds the ticket and the broker answers no position for ${requestId}; the claim is dropped`);
      continue;
    }
    if (Number.isFinite(ageMs) && ageMs > patienceMs) {
      const attempt = attemptFor(state, ticket);
      state.attempts[ticket] = attempt + 1;
      delete state.pending[ticket];
      dropped += 1;
      health.notes.push(`reconcile ${ticket}: no position for ${requestId} after ${Math.round(ageMs / 1000)}s; the claim is dropped and the next send carries attempt ${attempt + 1}`);
    }
  }
  return { checked, mapped, dropped, filled };
}

// One copy of a pending order, as the store keeps it. `target_order_id` is the destination's own id: it is what any
// later read, amendment or cancel is addressed by, because the broker's client order id is ours and can be lost.
function orderMappingFrom({ ticket, row, orderId, now }) {
  return {
    kind: "order",
    source_ticket: String(ticket),
    source_symbol: row.source_symbol || null,
    symbol: row.symbol || null,
    side: row.side || null,
    order_kind: row.order_type || null,
    volume: num(row.volume),
    source_volume: num(row.source_volume),
    price: num(row.price),
    stop_price: row.stop_price === undefined ? null : num(row.stop_price),
    target_price: row.target_price === undefined ? null : num(row.target_price),
    expiry_ms: row.expiry_ms === undefined ? null : row.expiry_ms,
    target_order_id: orderId ? String(orderId) : null,
    request_id: row.request_id || null,
    copied_utc: iso(now()),
    reconciled: true
  };
}

// A pending copy that filled. The destination order reports the position it became, which is the broker's own link;
// the source position that filled is then matched by symbol, side and volume, because the two tickets are different
// numbers on the two platforms. A fill with no matching source position is recorded as unlinked, and the closings
// close it rather than leave a position nothing is following.
function bindFilledOrderCopy({ state, ticket, mapped, positionId, map, positions, now, health }) {
  mapped.kind = "position";
  mapped.target_position_id = String(positionId);
  mapped.targetPositionId = String(positionId);
  mapped.filled_utc = iso(now());
  const targetSymbol = mapped.symbol || null;
  const volume = num(mapped.source_volume);
  const candidate = (Array.isArray(positions) ? positions : []).find((row) => {
    if (mappingForKey(state, row.ticket) || String(row.ticket) === String(ticket)) return false;
    if (row.side !== mapped.side) return false;
    if (targetSymbol && targetSymbolFor(map, row.symbol) !== targetSymbol) return false;
    return finite(num(row.volume)) && finite(volume) && Math.abs(num(row.volume) - volume) < 1e-6;
  });
  if (candidate) {
    state.aliases = state.aliases && typeof state.aliases === "object" ? state.aliases : {};
    state.aliases[String(candidate.ticket)] = String(ticket);
    mapped.source_position_ticket = String(candidate.ticket);
    mapped.source_volume = num(candidate.volume);
    health.notes.push(`order ${ticket}: the broker filled it as position ${positionId}; the copy follows source position ${candidate.ticket}`);
    return "bound";
  }
  mapped.unlinked = true;
  health.notes.push(`order ${ticket}: the broker filled it as position ${positionId} and no unmapped source position matches its side and volume; the copy is closed rather than left unmanaged`);
  return "unlinked";
}


// The questions the plan could not answer from the working book: a destination order that left it. The broker's
// history is the only thing that distinguishes a fill from a cancel, and the answer decides whether the mapping
// becomes a position to follow, is re-placed, or is dropped because the source no longer holds the order.
async function reconcileOrderChecks({ client, state, source, config = {}, checks = [], now = () => Date.now(), health = { notes: [] } } = {}) {
  if (!checks.length) return { checked: 0, filled: 0, gone: 0 };
  const sourceOrderTickets = new Set((source && Array.isArray(source.pendingOrders) ? source.pendingOrders : []).map((row) => String(row.ticket)));
  const positions = source && Array.isArray(source.positions) ? source.positions : [];
  const map = config.symbolMap || {};
  let checked = 0;
  let filled = 0;
  let gone = 0;
  for (const check of checks) {
    const ticket = String(check.ticket);
    const record = mappingFor(state, ticket);
    if (!record || record.kind !== "order") continue;
    if (typeof client.getOrder !== "function") {
      health.notes.push(`order ${ticket}: the adapter cannot read a historic order; ${check.reason} stays unexplained`);
      continue;
    }
    checked += 1;
    let answered = null;
    try {
      answered = await client.getOrder(check.orderId || record.target_order_id);
    } catch (err) {
      health.notes.push(`order ${ticket}: the broker could not be asked about ${check.orderId || record.target_order_id} (${(err && err.code) || (err && err.message) || err}); nothing changed`);
      continue;
    }
    if (!answered) {
      health.notes.push(`order ${ticket}: the broker has no record of ${check.orderId || record.target_order_id}; the mapping is kept until the source says otherwise`);
      continue;
    }
    if (answered.working === true || answered.statusName === "accepted") {
      // Back in the working book between the plan and this question: nothing to decide.
      continue;
    }
    if (answered.statusName === "filled" && answered.positionId) {
      const bound = bindFilledOrderCopy({
        state,
        ticket,
        mapped: record,
        positionId: String(answered.positionId),
        map,
        positions,
        now,
        health
      });
      if (bound === "bound") filled += 1;
      else gone += 1;
      continue;
    }
    if (answered.statusName === "filled") {
      // A fill the broker did not attribute to a position. It cannot be followed and it must not be re-placed.
      record.unlinked_without_position = true;
      health.notes.push(`order ${ticket}: the broker reports it filled but names no position; the copy is not re-placed and nothing is followed`);
      continue;
    }
    gone += 1;
    const outcome = answered.statusName || "unknown";
    state.history.unshift({
      source_ticket: ticket,
      target_order_id: record.target_order_id || null,
      source_symbol: record.source_symbol || null,
      symbol: record.symbol || null,
      side: record.side || null,
      order_kind: record.order_kind || null,
      volume: num(record.volume),
      source_volume: num(record.source_volume),
      request_id: record.request_id || null,
      copied_utc: record.copied_utc || null,
      closed_utc: iso(now()),
      close_outcome: outcome,
      close_reason: "order_left_book"
    });
    if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
    delete state.mappings[ticket];
    if (sourceOrderTickets.has(ticket)) {
      // The source still holds the order and the destination does not: the copy has to be placed again, under a new
      // client order id, which the attempt count names.
      state.attempts[ticket] = attemptFor(state, ticket) + 1;
      health.notes.push(`order ${ticket}: the destination order ${record.target_order_id} left the book as ${outcome} while the source still holds it; it is re-placed under attempt ${state.attempts[ticket]}`);
    } else {
      health.notes.push(`order ${ticket}: the destination order ${record.target_order_id} left the book as ${outcome} and the source no longer holds it; the mapping is dropped`);
    }
  }
  return { checked, filled, gone };
}


// One poll of the whole loop, over injected dependencies: `deps.readSource` reads the account, `client` is the
// adapter, `deps.store` reads and writes the mapping file, `deps.now` and `deps.log` belong to the run. The order
// of the work is the order of the rules: kill switch, source, plans, sends, closings, health.
async function pollOnce({ client, config = {}, deps = {} } = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const store = deps.store || { read: readJson, write: writeJson };
  const startedMs = now();
  const health = {
    schema: HEALTH_SCHEMA,
    version: COPIER_VERSION,
    status: "ok",
    started_utc: iso(startedMs),
    finished_utc: null,
    dry_run: config.dryRun === true,
    refusals: [],
    actions: [],
    closes: [],
    // A stop or a target that was amended, per destination position. The broker's own returned prices are recorded,
    // not the ones that were asked for.
    stops: [],
    // A pending copy, in the three things that can happen to it: it was placed, amended in place, or taken out of the
    // book. Each row carries the source ticket and the destination order id, so the two books can be compared.
    pending_orders: { placed: [], amended: [], cancelled: [], checked: [] },
    source: null,
    destination: null,
    notes: []
  };
  const finish = (status, note) => {
    health.status = status;
    if (note) health.notes.push(note);
    health.finished_utc = iso(now());
    return health;
  };

  if (config.killSwitch && fs.existsSync(config.killSwitch)) {
    return finish("killed", "the kill switch file exists; nothing was read and nothing was sent");
  }

  const opened = store.read(config.statePath);
  if (!opened.ok) {
    return finish("failed", `the mapping store could not be read: ${(opened.error && opened.error.message) || "unknown"}`);
  }
  const state = opened.value && typeof opened.value === "object" ? { ...emptyState(), ...opened.value } : emptyState();
  state.mappings = state.mappings && typeof state.mappings === "object" ? state.mappings : {};
  state.pending = state.pending && typeof state.pending === "object" ? state.pending : {};
  state.attempts = state.attempts && typeof state.attempts === "object" ? state.attempts : {};
  state.history = Array.isArray(state.history) ? state.history : [];
  state.aliases = state.aliases && typeof state.aliases === "object" ? state.aliases : {};
  state.close_unknown = state.close_unknown && typeof state.close_unknown === "object" ? state.close_unknown : {};

  let source;
  try {
    source = await deps.readSource({ config, now });
  } catch (err) {
    return finish("failed", `the source read threw: ${(err && err.message) || err}`);
  }
  health.source = {
    ok: source && source.ok === true,
    account: source && source.account ? { login: source.account.login, server: source.account.server } : null,
    positions: source && Array.isArray(source.positions) ? source.positions.length : 0,
    // The tickets themselves, so a reader comparing the source against the destination does not have to guess
    // which position a mapping is missing. Read-only: this is the probe's own statement, not a second read.
    rows: source && Array.isArray(source.positions)
      ? source.positions.map((row) => ({
        ticket: String(row.ticket),
        symbol: row.symbol,
        side: row.side,
        volume: row.volume,
        entry: row.entry,
        current: row.current,
        stop: row.stop,
        target: row.target,
        open_time_utc: row.openTimeUtc || null
      }))
      : [],
    cause: source && source.ok !== true ? source.cause || null : null,
    probed_at_utc: (source && source.probedAtUtc) || null,
    // The working orders the source holds, beside the positions: a pending copy is followed from this list, and an
    // order that leaves it is an exit the destination has to match.
    orders: source && Array.isArray(source.pendingOrders)
      ? source.pendingOrders.map((row) => ({
        ticket: String(row.ticket),
        symbol: row.symbol,
        side: row.side,
        kind: row.kind,
        volume: row.volume,
        price: row.price,
        stop: row.stop,
        target: row.target,
        expiry_utc: row.expiryMs ? iso(row.expiryMs) : null
      }))
      : []
  };
  if (!source || source.ok !== true) {
    return finish("source_unreadable", "the source could not be read; nothing was opened and nothing was closed");
  }

  health.reconcile = await reconcilePending({ client, state, source, config, now, health });
  const map = config.symbolMap || {};
  // The symbols the destination has to be read for: every source position, every source order, and every order the
  // store still holds, because an order whose source is gone still has to be cancelled in the destination book.
  const orderSymbols = (source && Array.isArray(source.pendingOrders) ? source.pendingOrders : []).map((row) => row.symbol);
  const mappedOrderSymbols = Object.values(state.mappings || {})
    .filter((row) => row && row.kind === "order" && row.source_symbol)
    .map((row) => row.source_symbol);
  const targetSymbols = [...new Set([...source.positions.map((row) => row.symbol), ...orderSymbols, ...mappedOrderSymbols]
    .map((symbol) => targetSymbolFor(map, symbol)))].filter(Boolean);
  const specs = {};
  const exposure = {};
  const references = {};
  const specRefusals = [];
  for (const name of targetSymbols) {
    try {
      specs[name] = await client.getSymbolSpec(name);
      exposure[name] = await client.listExposures(name);
    } catch (err) {
      specRefusals.push({ symbol: name, code: (err && err.code) || "spec_unreadable", message: (err && err.message) || null });
      continue;
    }
    // A price that cannot be read is not a refusal: the stop is then judged against the source's own current price,
    // and the note says the destination's was not used.
    if (typeof client.getReferencePrice === "function") {
      try {
        const price = num(await client.getReferencePrice(name));
        if (finite(price) && price > 0) references[name] = price;
      } catch (err) {
        health.notes.push(`no reference price for ${name}: ${(err && err.code) || "unreadable"}; the source's own price decides the stop`);
      }
    }
  }
  health.destination = {
    account_id: typeof client.context === "function" ? client.context().accountId : null,
    symbols: Object.keys(specs),
    references,
    // What the destination book held when the plan was made: the positions and the working orders every decision was
    // measured against, so a reader can compare those counts with the source's own.
    exposure: Object.fromEntries(Object.entries(exposure).map(([name, value]) => [
      name,
      {
        positions: (exposureRows(value) || []).length,
        orders: (exposureOrders(value) || []).length
      }
    ])),
    // The conversion's inputs, stated: a size that was refused, or a copy that was capped, is only readable against
    // the two contract sizes and the destination's own step.
    spec_summary: Object.fromEntries(Object.entries(specs).map(([name, spec]) => [name, {
      digits: num(spec.digits),
      lotSizeBtc: num(spec.lotSizeBtc),
      // The protocol's volume units per lot: one lot is this many cents of the base asset, and it is what the
      // destination integer volume is computed from.
      volumeScale: finite(num(spec.volumeScale)) ? num(spec.volumeScale) : null,
      minVolume: num(spec.minVolume),
      maxVolume: num(spec.maxVolume),
      volumeStep: num(spec.volumeStep),
      tradeMode: spec.tradeMode || null,
      minStopDistance: finite(num(spec.minStopDistance)) ? num(spec.minStopDistance) : null,
      minStopPercent: finite(num(spec.minStopPercent)) ? num(spec.minStopPercent) : null
    }])),
    spec_refusals: specRefusals
  };

  const plan = planActions({ source, state, config, specs, exposure, references, nowMs: now() });
  health.refusals.push(...plan.refusals);
  health.order_checks = plan.orderChecks;
  // A destination order that left the working book is decided before anything is sent: a fill becomes a position to
  // follow, a cancel is either re-placed or dropped, and the answer is the broker's, not an inference from silence.
  health.reconcile_orders = await reconcileOrderChecks({ client, state, source, config, checks: plan.orderChecks, now, health });

  for (const action of plan.actions) {
    if (config.dryRun === true) {
      health.actions.push({ ...action, sent: false, outcome: "dry_run" });
      continue;
    }
    let result;
    try {
      result = await client.sendMarketOrder({
        type: "market",
        symbol: action.symbol,
        side: action.side,
        volume: action.volume,
        stopPrice: action.stopPrice,
        requestId: action.requestId,
        comment: action.comment
      });
    } catch (err) {
      health.actions.push({ ...action, sent: false, outcome: "refused", code: (err && err.code) || null, message: (err && err.message) || String(err) });
      continue;
    }
    health.actions.push({ ...action, sent: result.sent === true, outcome: result.outcome || null, positionId: result.positionId || null });
    if (result.outcome === "accepted" && result.positionId) {
      delete state.pending[action.ticket];
      state.mappings[action.ticket] = {
        source_ticket: action.ticket,
        source_symbol: action.sourceSymbol,
        symbol: action.symbol,
        side: action.side,
        volume: action.volume,
        stop_price: action.stopPrice,
        target_position_id: String(result.positionId),
        targetPositionId: String(result.positionId),
        request_id: action.requestId,
        // The baseline a partial close is measured against, and the flag that tells the plan the destination may hold
        // less than the exact proportion without that being a shortfall.
        source_volume: num(action.sourceVolume),
        capped: action.capped === true,
        copied_utc: iso(now())
      };
    } else if (result.outcome === "unknown") {
      // Sent, and the broker may already hold it. Not repeated: the ticket becomes a pending claim, and the next
      // poll asks the broker by this client order id before anything else is sent for the ticket.
      state.pending[action.ticket] = {
        request_id: action.requestId,
        at_ms: now(),
        at_utc: iso(now()),
        source_symbol: action.sourceSymbol,
        symbol: action.symbol,
        side: action.side,
        volume: action.volume,
        source_volume: num(action.sourceVolume),
        stop_price: action.stopPrice
      };
      health.notes.push(`ticket ${action.ticket} answered unknown; reconcile ${action.requestId} before anything else`);
    }
  }


  // The copy leaves the book in the order the risk does: an order that should not stand is cancelled first, the
  // protection of an open copy is aligned next, and only then is volume taken off. A refused answer is stated and
  // nothing is retried inside the same poll; the next poll reads the destination again and decides from that read.
  for (const cancel of plan.cancels) {
    if (config.dryRun === true) {
      health.pending_orders.cancelled.push({ ...cancel, sent: false, outcome: "dry_run" });
      continue;
    }
    if (typeof client.cancelOrder !== "function") {
      health.refusals.push({ code: "cancel_unsupported", ticket: cancel.ticket, detail: cancel.orderId });
      continue;
    }
    try {
      const result = await client.cancelOrder({ orderId: cancel.orderId, symbol: cancel.symbol });
      health.pending_orders.cancelled.push({ ...cancel, sent: result.sent === true, outcome: result.outcome || null });
      if (result.outcome === "accepted") {
        const record = state.mappings[cancel.ticket] || {};
        state.history.unshift({
          source_ticket: String(cancel.ticket),
          target_order_id: cancel.orderId ? String(cancel.orderId) : null,
          source_symbol: record.source_symbol || cancel.symbol || null,
          symbol: cancel.symbol || record.symbol || null,
          side: record.side || null,
          order_kind: record.order_kind || null,
          volume: num(record.volume),
          source_volume: num(record.source_volume),
          request_id: record.request_id || null,
          copied_utc: record.copied_utc || null,
          closed_utc: iso(now()),
          close_outcome: "cancelled",
          close_reason: cancel.reason || null
        });
        if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
        delete state.mappings[cancel.ticket];
      } else if (result.outcome === "unknown") {
        // The order may or may not still stand. The mapping stays, and the next poll's working read is what decides:
        // a second cancel of an order the broker already took out is answered as refused and changes nothing.
        health.notes.push(`order ${cancel.ticket}: the cancel of ${cancel.orderId} answered unknown; the next poll reads the working book before anything else is sent`);
      }
    } catch (err) {
      health.pending_orders.cancelled.push({ ...cancel, sent: false, outcome: "refused", code: (err && err.code) || null, message: (err && err.message) || String(err) });
    }
  }

  for (const amend of plan.amends) {
    if (config.dryRun === true) {
      health.pending_orders.amended.push({ ...amend, sent: false, outcome: "dry_run" });
      continue;
    }
    if (typeof client.amendOrder !== "function") {
      health.refusals.push({ code: "amend_unsupported", ticket: amend.ticket, detail: amend.orderId });
      continue;
    }
    const changes = amend.changes || {};
    try {
      const result = await client.amendOrder({
        orderId: amend.orderId,
        symbol: amend.symbol,
        limitPrice: changes.limitPrice,
        stopPrice: changes.stopPrice,
        stopLoss: changes.stopLoss,
        takeProfit: changes.takeProfit,
        expiryMs: changes.expiryMs
      });
      health.pending_orders.amended.push({ ...amend, sent: result.sent === true, outcome: result.outcome || null });
      // The amendment carries no prices back, so the mapping records what was asked for and marks it unconfirmed: the
      // destination read on the next poll is what states the order as it actually stands.
      if (result.outcome === "accepted") {
        const record = state.mappings[amend.ticket];
        if (record) {
          record.amended_utc = iso(now());
          record.amend_requested = changes;
          record.amend_confirmed = false;
          if (changes.limitPrice !== undefined) record.price = num(changes.limitPrice);
          if (changes.stopLoss !== undefined) record.stop_price = num(changes.stopLoss);
          if (changes.takeProfit !== undefined) record.target_price = num(changes.takeProfit);
          if (changes.expiryMs !== undefined) record.expiry_ms = changes.expiryMs;
        }
      } else if (result.outcome === "unknown") {
        health.notes.push(`order ${amend.ticket}: the amendment of ${amend.orderId} answered unknown; the next poll reads the order before amending again`);
      }
    } catch (err) {
      health.pending_orders.amended.push({ ...amend, sent: false, outcome: "refused", code: (err && err.code) || null, message: (err && err.message) || String(err) });
    }
  }

  // A stop or a target the source moved is amended on the copy, and only the broker's own returned prices are
  // recorded: an amendment the broker adjusted or refused must not read as applied. The next poll compares the two
  // broker reads again, so an unknown answer converges rather than repeats.
  for (const stop of plan.stops) {
    if (config.dryRun === true) {
      health.stops.push({ ...stop, sent: false, outcome: "dry_run" });
      continue;
    }
    if (typeof client.amendPositionSltp !== "function") {
      health.refusals.push({ code: "sltp_unsupported", ticket: stop.ticket, detail: stop.positionId });
      continue;
    }
    try {
      const result = await client.amendPositionSltp({ positionId: stop.positionId, stopLoss: stop.stopLoss, takeProfit: stop.takeProfit });
      health.stops.push({
        ...stop,
        sent: result.sent === true,
        outcome: result.outcome || null,
        applied_stop: result.stopLoss === undefined ? null : result.stopLoss,
        applied_target: result.takeProfit === undefined ? null : result.takeProfit,
        message: result.message || null
      });
      if (result.outcome === "accepted") {
        const record = state.mappings[stop.ticket];
        if (record) {
          record.stop_price = result.stopLoss === null || result.stopLoss === undefined ? record.stop_price : num(result.stopLoss);
          record.target_price = result.takeProfit === null || result.takeProfit === undefined ? record.target_price : num(result.takeProfit);
          record.sltp_utc = iso(now());
        }
      } else if (result.outcome === "unknown") {
        health.notes.push(`ticket ${stop.ticket}: the stop amendment on ${stop.positionId} answered unknown; the next poll reads the position before amending again`);
      }
    } catch (err) {
      health.stops.push({ ...stop, sent: false, outcome: "refused", code: (err && err.code) || null, message: (err && err.message) || String(err) });
    }
  }

  // A working source order becomes a working destination order: the same side, the same entry, the same protection
  // and the same expiry, in absolute prices. An accepted place records the broker's own order id, which is what every
  // later amendment and cancel is addressed by; an unknown place becomes a claim the next poll resolves by our own
  // client order id, never a second order.
  for (const place of plan.places) {
    if (config.dryRun === true) {
      health.pending_orders.placed.push({ ...place, sent: false, outcome: "dry_run" });
      continue;
    }
    if (typeof client.sendPendingOrder !== "function") {
      health.refusals.push({ code: "pending_unsupported", ticket: place.ticket, detail: place.symbol });
      continue;
    }
    let result;
    try {
      result = await client.sendPendingOrder({
        type: place.orderType,
        symbol: place.symbol,
        side: place.side,
        volume: place.volume,
        price: place.price,
        // The protection is the source's own stop and target as absolute prices. The adapter decides the field shape;
        // the copier never sends a distance, and the entry is `price`, never a stop field.
        stopLoss: place.stopPrice,
        takeProfit: place.takeProfit,
        expiryMs: place.expiryMs,
        requestId: place.requestId,
        comment: place.comment
      });
    } catch (err) {
      health.pending_orders.placed.push({ ...place, sent: false, outcome: "refused", code: (err && err.code) || null, message: (err && err.message) || String(err) });
      continue;
    }
    health.pending_orders.placed.push({
      ...place,
      sent: result.sent === true,
      outcome: result.outcome || null,
      orderId: result.orderId || null,
      message: result.message || null
    });
    const claim = {
      kind: "order",
      request_id: place.requestId,
      at_ms: now(),
      at_utc: iso(now()),
      source_symbol: place.source_symbol,
      symbol: place.symbol,
      side: place.side,
      order_type: place.orderType,
      volume: place.volume,
      source_volume: place.source_volume,
      price: place.price,
      stop_price: place.stopPrice,
      target_price: place.takeProfit,
      expiry_ms: place.expiryMs
    };
    if (result.outcome === "accepted" && result.orderId) {
      delete state.pending[place.ticket];
      state.mappings[place.ticket] = {
        ...orderMappingFrom({ ticket: place.ticket, row: claim, orderId: String(result.orderId), now }),
        reconciled: false
      };
    } else if (result.outcome === "accepted" || result.outcome === "unknown") {
      // Accepted with no order id, or an answer that never arrived: the claim is the only handle, and the next poll
      // asks the broker by the client order id before this ticket is sent again.
      state.pending[place.ticket] = claim;
      health.notes.push(`order ${place.ticket}: ${result.outcome === "unknown" ? "the place answered unknown" : "no order id came back"}; reconcile ${place.requestId} before anything else is sent`);
    } else {
      health.refusals.push({ code: "order_refused", ticket: place.ticket, detail: result.message || null });
    }
  }

  for (const close of plan.closes) {
    if (config.dryRun === true) {
      health.closes.push({ ...close, sent: false, outcome: "dry_run" });
      continue;
    }
    try {
      const result = await client.closePosition({ positionId: close.positionId, symbol: close.symbol, volume: close.volume, reason: close.reason });
      health.closes.push({ ...close, sent: result.sent === true, outcome: result.outcome || null });
      const mapped = state.mappings[close.ticket] || {};
      if (close.partial === true) {
        // A partial close leaves the copy open: the mapping stays, and the destination read is what states the new
        // size. The source volume that was asked for becomes the baseline, and the settling window keeps a second
        // close off the same position until that read can have moved.
        state.close_unknown[String(close.positionId)] = {
          at_ms: now(),
          at_utc: iso(now()),
          volume: close.volume,
          source_volume: close.source_volume,
          outcome: result.outcome || null
        };
        if (result.outcome === "accepted") {
          const record = state.mappings[close.ticket];
          if (record) {
            record.source_volume = num(close.source_volume);
            record.last_partial_utc = iso(now());
          }
        } else if (result.outcome === "unknown") {
          health.notes.push(`ticket ${close.ticket}: the partial close of ${close.volume} on ${close.positionId} answered unknown; it is not repeated for ${Math.round(CLOSE_SETTLE_MS / 1000)}s, and the destination read decides`);
        }
        continue;
      }
      // An accepted close, or one the broker answered unknown, both mean the mapping is no longer a live claim:
      // an unknown close is verified by the destination read on the next poll, which would find it flat. The row
      // moves to the bounded history first, so the source ticket that produced a closed position is still
      // readable after the live mapping has gone.
      if (result.outcome !== "refused") {
        state.history.unshift({
          source_ticket: String(close.ticket),
          target_position_id: close.positionId ? String(close.positionId) : null,
          source_symbol: mapped.source_symbol || null,
          symbol: close.symbol || mapped.symbol || null,
          side: mapped.side || null,
          volume: num(mapped.volume),
          stop_price: num(mapped.stop_price),
          request_id: mapped.request_id || null,
          copied_utc: mapped.copied_utc || null,
          closed_utc: iso(now()),
          close_outcome: result.outcome || null
        });
        if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
        delete state.mappings[close.ticket];
        delete state.close_unknown[String(close.positionId)];
      }
    } catch (err) {
      health.closes.push({ ...close, sent: false, outcome: "refused", code: (err && err.code) || null, message: (err && err.message) || String(err) });
    }
  }

  // The baseline every later partial close is measured against. A copy that opened before the baseline was recorded,
  // or one bound from a filled order, gets it from this read rather than from a guess about what it once was.
  for (const position of source.positions) {
    const record = mappingForKey(state, position.ticket);
    if (!record) continue;
    if (record.source_volume === undefined || record.source_volume === null || !finite(num(record.source_volume))) {
      if (finite(num(position.volume))) record.source_volume = num(position.volume);
    }
  }
  // A settling window that outlived its purpose is dropped: the destination read is the truth from then on.
  const staleSettle = num(now()) - CLOSE_SETTLE_MS * 10;
  for (const [positionId, entry] of Object.entries(state.close_unknown)) {
    if (!entry || !finite(num(entry.at_ms)) || num(entry.at_ms) < staleSettle) delete state.close_unknown[positionId];
  }

  state.updated_utc = iso(now());
  try {
    store.write(config.statePath, state);
  } catch (err) {
    health.notes.push(`the mapping store could not be written: ${(err && err.message) || err}`);
    return finish("failed");
  }
  const sent = [...health.actions, ...health.closes, ...health.stops, ...health.pending_orders.placed, ...health.pending_orders.amended, ...health.pending_orders.cancelled]
    .some((row) => row.sent === true && row.outcome !== "dry_run");
  const refusedSomething = [...health.actions, ...health.closes, ...health.stops, ...health.pending_orders.placed, ...health.pending_orders.amended, ...health.pending_orders.cancelled]
    .some((row) => row.outcome === "refused");
  if (refusedSomething && !sent) return finish("partial", "something was refused; see the refusals");
  return finish("ok");
}

// ---- the probe call ----

// The source read the copier uses in production: one python process against one terminal, no order function in
// the script it runs. A probe that exits non-zero but prints a document is read as the document says; a probe that
// prints nothing is a failed read, and a failed read opens and closes nothing.
function createProbeReader({ python, script, terminal, log = () => {}, timeoutMs = 60000 } = {}) {
  if (!python || !script) throw codedError("probe_config_missing", "the source read needs the python executable and the probe script");
  return async function readSourceFromTerminal() {
    const args = [script];
    if (terminal) args.push("--path", terminal);
    const run = spawnSync(python, args, { encoding: "utf8", timeout: timeoutMs, windowsHide: true });
    const stdout = String(run.stdout || "");
    if (!stdout.trim()) {
      log(`source read: the probe printed no document (status ${run.status}): ${String(run.stderr || "").trim().slice(0, 400)}`);
      return { ok: false, cause: "source_probe_failed", positions: [] };
    }
    try {
      return { ...readSource(JSON.parse(stdout)), probeStatus: run.status };
    } catch (err) {
      log(`source read: the probe printed something that is not JSON: ${(err && err.message) || err}`);
      return { ok: false, cause: "source_probe_unparsable", positions: [] };
    }
  };
}


// ---- the run ----

function parseArgs(argv = []) {
  const config = {
    vaultPath: null,
    login: null,
    confirmAccount: null,
    statePath: null,
    healthPath: null,
    lockPath: null,
    killSwitch: null,
    journalPath: null,
    sourceTerminal: null,
    python: "python",
    probe: null,
    symbolsFile: null,
    symbolMap: null,
    maxLots: null,
    maxOpen: null,
    magic: null,
    intervalSeconds: 15,
    pendingTtlMs: null,
    once: false,
    dryRun: false,
    expectLive: false,
    help: false,
    refusals: []
  };
  const queue = argv.slice();
  const take = () => (queue.length ? queue.shift() : null);
  const valueOf = (arg, name) => (arg.startsWith(`${name}=`) ? arg.slice(name.length + 1) : null);
  while (queue.length) {
    const arg = queue.shift();
    const asBool = (name, key) => {
      if (arg === name) {
        config[key] = true;
        return true;
      }
      const value = valueOf(arg, name);
      if (value === null) return null;
      config[key] = value === "true" || value === "1";
      return true;
    };
    if (arg === "--help" || arg === "-h") config.help = true;
    else if (asBool("--once", "once")) continue;
    else if (asBool("--dry-run", "dryRun")) continue;
    else if (asBool("--expect-live", "expectLive")) continue;
    else if (arg === "--vault") config.vaultPath = take();
    else if (valueOf(arg, "--vault") !== null) config.vaultPath = valueOf(arg, "--vault");
    else if (arg === "--login") config.login = Number(take());
    else if (valueOf(arg, "--login") !== null) config.login = Number(valueOf(arg, "--login"));
    else if (arg === "--confirm-account") config.confirmAccount = take();
    else if (valueOf(arg, "--confirm-account") !== null) config.confirmAccount = valueOf(arg, "--confirm-account");
    else if (arg === "--state") config.statePath = take();
    else if (valueOf(arg, "--state") !== null) config.statePath = valueOf(arg, "--state");
    else if (arg === "--health") config.healthPath = take();
    else if (valueOf(arg, "--health") !== null) config.healthPath = valueOf(arg, "--health");
    else if (arg === "--lock") config.lockPath = take();
    else if (valueOf(arg, "--lock") !== null) config.lockPath = valueOf(arg, "--lock");
    else if (arg === "--kill-switch") config.killSwitch = take();
    else if (valueOf(arg, "--kill-switch") !== null) config.killSwitch = valueOf(arg, "--kill-switch");
    else if (arg === "--journal") config.journalPath = take();
    else if (valueOf(arg, "--journal") !== null) config.journalPath = valueOf(arg, "--journal");
    else if (arg === "--source-terminal") config.sourceTerminal = take();
    else if (valueOf(arg, "--source-terminal") !== null) config.sourceTerminal = valueOf(arg, "--source-terminal");
    else if (arg === "--python") config.python = take();
    else if (valueOf(arg, "--python") !== null) config.python = valueOf(arg, "--python");
    else if (arg === "--probe") config.probe = take();
    else if (valueOf(arg, "--probe") !== null) config.probe = valueOf(arg, "--probe");
    else if (arg === "--symbols") config.symbolsFile = take();
    else if (valueOf(arg, "--symbols") !== null) config.symbolsFile = valueOf(arg, "--symbols");
    else if (arg === "--max-lots") config.maxLots = Number(take());
    else if (valueOf(arg, "--max-lots") !== null) config.maxLots = Number(valueOf(arg, "--max-lots"));
    else if (arg === "--max-open") config.maxOpen = Number(take());
    else if (valueOf(arg, "--max-open") !== null) config.maxOpen = Number(valueOf(arg, "--max-open"));
    else if (arg === "--magic") config.magic = Number(take());
    else if (valueOf(arg, "--magic") !== null) config.magic = Number(valueOf(arg, "--magic"));
    else if (arg === "--interval-seconds") config.intervalSeconds = Number(take());
    else if (valueOf(arg, "--interval-seconds") !== null) config.intervalSeconds = Number(valueOf(arg, "--interval-seconds"));
    else if (arg === "--pending-ttl-seconds") config.pendingTtlMs = Number(take()) * 1000;
    else if (valueOf(arg, "--pending-ttl-seconds") !== null) config.pendingTtlMs = Number(valueOf(arg, "--pending-ttl-seconds")) * 1000;
    else config.refusals.push(`unknown_argument:${arg}`);
  }
  if (!config.vaultPath) config.refusals.push("vault_missing:pass --vault");
  if (!Number.isInteger(config.login) || config.login <= 0) config.refusals.push("login_missing:pass --login with the trader login");
  if (!config.statePath) config.refusals.push("state_missing:pass --state with the mapping file to keep");
  if (!config.probe) config.refusals.push("probe_missing:pass --probe with the path to live-trading-positions-probe.py");
  if (!config.dryRun && !config.confirmAccount) {
    // The same rule the run command holds: a send needs the account it will land on, named in the command line.
    config.refusals.push("confirm_missing:copying sends real orders, so --confirm-account <ctrader account id> is required (use --dry-run to plan only)");
  }
  if (!Number.isFinite(config.intervalSeconds) || config.intervalSeconds <= 0) config.refusals.push("interval_invalid:--interval-seconds must be positive");
  if (config.symbolsFile) {
    const loaded = readJson(config.symbolsFile);
    if (!loaded.ok || !loaded.value || typeof loaded.value !== "object") {
      config.refusals.push(`symbols_unreadable:${config.symbolsFile}`);
    } else {
      config.symbolMap = loaded.value.map && typeof loaded.value.map === "object" ? loaded.value.map : loaded.value;
    }
  }
  return config;
}


// One copier per machine. The lock is a file with this process's id in it: a second copier that finds a live id
// refuses to start, and one that finds a stale id (the process is gone) takes the lock over rather than needing a
// hand to delete a file.
function acquireLock(file, { now = () => Date.now() } = {}) {
  if (!file) return { ok: true, release: () => {} };
  const existing = readJson(file);
  if (existing.ok && existing.value && Number.isInteger(existing.value.pid)) {
    if (existing.value.pid !== process.pid && isProcessAlive(existing.value.pid)) {
      return { ok: false, cause: "lock_held", pid: existing.value.pid, since: existing.value.started_utc || null };
    }
  }
  writeJson(file, { pid: process.pid, started_utc: iso(now()) });
  return {
    ok: true,
    release: () => {
      const current = readJson(file);
      if (current.ok && current.value && current.value.pid === process.pid) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          if (!err || err.code !== "ENOENT") throw err;
        }
      }
    }
  };
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return Boolean(err && err.code === "EPERM");
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



// The loop. One connection, one adapter, then poll after poll until the process is stopped. A poll that throws is
// written to the health file and retried on the next tick; a connection that dies ends the run so the supervisor
// restarts it, because a copier that cannot reach the broker must not look healthy.
async function runCopier({ config, deps = {} } = {}) {
  const log = typeof deps.log === "function" ? deps.log : (line) => process.stdout.write(`${line}\n`);
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const sleep = typeof deps.sleep === "function" ? deps.sleep : (ms) => sleepMs(ms);
  const fsImpl = deps.fs || fs;
  const lock = acquireLock(config.lockPath, { now });
  if (!lock.ok) {
    log(`refused: another copier is running as pid ${lock.pid} (since ${lock.since}); this one will not start`);
    return { ok: false, mode: "locked", exitCode: 3 };
  }
  let connection = null;
  try {
    const runner = deps.runnerModule || require("./CTRADER_RUN_20261114.js");
    const secrets = deps.secretsModule || require("./CTRADER_SECRETS_20261114.js");
    const adapterModule = deps.adapterModule || require("./CTRADER_ADAPTER_20261114.js");
    const store = deps.store || secrets.createDpapiStore({
      runPowerShell: deps.runPowerShell || secrets.createPowerShellRunner(),
      user: deps.user || process.env.USERNAME || null
    });
    const prepared = await runner.prepareCredentials({ vaultPath: config.vaultPath, store, fsImpl, now, refresh: deps.refresh });
    connection = await runner.openConnection({ config, deps: { ...deps, now, log } });
    const connected = await adapterModule.connectAccount({
      session: connection.session,
      clientId: prepared.credentials.clientId,
      clientSecret: prepared.credentials.clientSecret,
      accessToken: prepared.credentials.accessToken,
      traderLogin: config.login,
      expectLive: config.expectLive === true
    });
    if (config.confirmAccount && String(connected.accountId) !== String(config.confirmAccount)) {
      log(`refused: login ${config.login} is account ${connected.accountId}, not the confirmed ${config.confirmAccount}`);
      return { ok: false, mode: "account_mismatch", exitCode: 2 };
    }
    log(`destination: account ${connected.accountId} on "${connected.account.broker}" (${connected.account.isLive ? "live" : "demo"})`);
    const client = (deps.createAdapter || adapterModule.createAdapter)({
      session: connection.session,
      events: connection.events,
      account: connected.account,
      config: { now, pollMs: 1000, spotMaxAgeMs: 15000, spotTimeoutMs: 20000 }
    });
    const readSource = deps.readSource || createProbeReader({
      python: config.python,
      script: config.probe,
      terminal: config.sourceTerminal,
      log
    });
    log(`copier ${COPIER_VERSION}: poll ${config.intervalSeconds}s, ${config.dryRun ? "dry run" : "LIVE sends"}, source read by ${config.probe}`);
    let polls = 0;
    for (;;) {
      let health;
      try {
        health = await pollOnce({
          client,
          config: { ...config, symbolMap: config.symbolMap || {} },
          deps: { readSource, now, log, store: { read: readJson, write: writeJson } }
        });
      } catch (err) {
        health = {
          schema: HEALTH_SCHEMA,
          version: COPIER_VERSION,
          status: "failed",
          finished_utc: iso(now()),
          notes: [`the poll threw: ${(err && err.message) || err}`]
        };
        if (err && (err.code === "socket_closed" || err.code === "session_closed")) {
          if (config.healthPath) {
            try {
              writeJson(config.healthPath, health);
            } catch (writeErr) {
              log(`health could not be written: ${(writeErr && writeErr.message) || writeErr}`);
            }
          }
          log("the connection is gone; ending the run so the supervisor restarts it");
          return { ok: false, mode: "connection_lost", exitCode: 4 };
        }
      }
      polls += 1;
      health.polls = polls;
      if (config.healthPath) {
        try {
          writeJson(config.healthPath, health);
        } catch (err) {
          log(`health could not be written: ${(err && err.message) || err}`);
        }
      }
      log(
        `poll ${polls}: ${health.status}` +
          ` source ${health.source ? health.source.positions : "?"} position(s)` +
          ` open ${health.actions ? health.actions.length : 0}` +
          ` close ${health.closes ? health.closes.length : 0}` +
          ` refused ${health.refusals ? health.refusals.length : 0}` +
          ` note ${health.notes && health.notes.length ? health.notes[health.notes.length - 1] : "-"}`
      );
      if (config.once) return { ok: health.status !== "failed", mode: "once", health, exitCode: health.status === "failed" ? 2 : 0 };
      await sleep(config.intervalSeconds * 1000);
    }
  } finally {
    if (connection) connection.close();
    lock.release();
  }
}

async function main(argv = process.argv.slice(2), deps = {}) {
  const log = typeof deps.log === "function" ? deps.log : (line) => process.stdout.write(`${line}\n`);
  const config = (deps.parseArgs || parseArgs)(argv);
  if (config.help) {
    log("node CTRADER_COPIER_20261119.js --vault <file> --login <n> --state <file> --probe <py> [options]");
    log("  --source-terminal <folder>  the FTMO-1 terminal this copier reads (read-only)");
    log("  --confirm-account <id>      required for sends; refused when the login resolves elsewhere");
    log("  --health <file>             where the last poll's health is written");
    log("  --lock <file>               one copier per machine");
    log("  --kill-switch <file>        exists means: read and send nothing");
    log("  --symbols <json>            source symbol to destination symbol; a null value excludes one");
    log("  --max-lots <n> --max-open <n> --magic <n> --interval-seconds <n> --once --dry-run --expect-live");
    log("  --pending-ttl-seconds <n>   how long an unknown answer stays a claim before a retry under a new id");
    return { ok: true, mode: "help", exitCode: 0 };
  }
  if (config.refusals.length) {
    for (const refusal of config.refusals) log(`refused: ${refusal}`);
    return { ok: false, mode: "refused", refusals: config.refusals, exitCode: 2 };
  }
  return runCopier({ config, deps });
}

module.exports = {
  COPIER_VERSION,
  HEALTH_SCHEMA,
  readSource,
  convertVolume,
  planActions,
  clientOrderId,
  emptyState,
  pendingFor,
  reconcilePending,
  pollOnce,
  createProbeReader,
  acquireLock,
  isProcessAlive,
  parseArgs,
  runCopier,
  main,
  readJson,
  writeJson
};

if (require.main === module) {
  main(process.argv.slice(2))
    .then((result) => {
      process.exitCode = result && Number.isInteger(result.exitCode) ? result.exitCode : 0;
    })
    .catch((err) => {
      process.stderr.write(`failed: ${(err && err.message) || err}\n`);
      process.exitCode = 1;
    });
}

