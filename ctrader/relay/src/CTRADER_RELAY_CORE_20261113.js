// The cTrader relay core, written offline for review before any broker call exists.
//
// It follows one rule: mirror the ftmo-1 lane's own resting limits and their lifecycle, and nothing else. It
// reads no candle, computes no level, sizes nothing, and states no entry. The source is the published snapshot
// and the lane's state file; the destination is one demo account; every send is idempotent through a client tag
// derived from the MT5 ticket, and an uncertain send is quarantined rather than repeated.
//
// The module is pure over the state and the inputs it is handed - no clock, no socket, no credential - so the
// fill-timing and restart matrix can be exercised offline. The caller owns I/O and the actual cTrader call.
"use strict";

const SOURCE_MAGIC = 20261004;
const CLIENT_PREFIX = "relay-ftmo1-";
const PENDING_TYPES = new Set([
  "ORDER_TYPE_BUY_LIMIT",
  "ORDER_TYPE_SELL_LIMIT",
  "ORDER_TYPE_BUY_STOP",
  "ORDER_TYPE_SELL_STOP",
  "ORDER_TYPE_BUY_STOP_LIMIT",
  "ORDER_TYPE_SELL_STOP_LIMIT"
]);

// The four timings the first broker test has to survive, stated as facts the relay acts on rather than notes.
// `action` names what the relay does when the event arrives in that order.
const FILL_TIMINGS = Object.freeze([
  { id: "fill-before-mirror", order: "the MT5 limit fills before the relay has sent anything", action: "mirror nothing as a pending; record missed-fill; the position is followed by the position path only" },
  { id: "fill-during-send", order: "the send is in flight when the MT5 limit fills", action: "quarantine the send; reconcile by client tag; if the destination order exists it is cancelled before it can fill twice" },
  { id: "fill-after-mirror", order: "the mirrored order is resting when the MT5 limit fills", action: "keep the mirror; the fill is confirmed on the destination, and the entry is closed when the source position closes" },
  { id: "partial-fill", order: "the destination fills less than the stated volume", action: "record the filled volume and leave the remainder working; never top it up to a second order" },
  { id: "cancel-before-fill", order: "the MT5 limit is cancelled while the mirror rests", action: "cancel the mirror and record the cause; a cancel the destination refuses is quarantined" },
  { id: "expiry", order: "the MT5 limit carries an expiry", action: "copy it in UTC; an expiry the destination cannot express is refused before sending, never approximated" }
]);

function clientTagFor(ticket) {
  return `${CLIENT_PREFIX}${ticket}`;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// Only a pending order this lane placed is a source. A market order, a position, or a row carrying another
// magic is not something the relay may copy: the lane's entry is a limit at a marked level, and that shape is
// the whole of what is mirrored.
function sourceOrder(row) {
  if (!row || typeof row !== "object") return null;
  if (Number(row.magic) !== SOURCE_MAGIC) return null;
  if (!PENDING_TYPES.has(String(row.type || ""))) return null;
  const ticket = Number(row.ticket);
  const volume = toNumber(row.volume ?? row.volume_current);
  const price = toNumber(row.price_open);
  const stop = toNumber(row.stop_loss);
  const target = toNumber(row.take_profit);
  if (!Number.isFinite(ticket) || !finite(volume) || volume <= 0) return null;
  if (!finite(price) || price <= 0) return null;
  const side = String(row.type).includes("BUY") ? "buy" : "sell";
  const expiration = Number.isFinite(Number(row.expiration)) && Number(row.expiration) > 0
    ? { epoch_seconds: Number(row.expiration), iso_utc: new Date(Number(row.expiration) * 1000).toISOString() }
    : null;
  return {
    ticket,
    client_tag: clientTagFor(ticket),
    symbol: String(row.symbol || ""),
    side,
    type: String(row.type),
    volume: Number(volume.toFixed(2)),
    price: Number(price.toFixed(8)),
    stop: finite(stop) ? Number(stop.toFixed(8)) : null,
    target: finite(target) ? Number(target.toFixed(8)) : null,
    expiration,
    comment: String(row.comment || "")
  };
}

function createState() {
  return { version: 1, entries: {}, requests: 0, refusals: 0, quarantined: 0 };
}

// The map is the durable part: it is written after every tick and reloaded before the first send, so a restart
// can tell "never sent" from "sent, outcome unknown". A JSON round trip is the only shape the caller needs.
function dumpState(state) {
  return JSON.stringify(state);
}

function loadState(raw) {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== "object" || !parsed.entries) return createState();
  return { version: 1, entries: parsed.entries, requests: parsed.requests || 0, refusals: parsed.refusals || 0, quarantined: parsed.quarantined || 0 };
}

// One tick of the relay: what to send, what to refuse, and the new state. Three gates stand in front of every
// command - the kill switch, the arm flag and the request counter - and each refusal is recorded with the ticket
// it refused, so the log is a fact rather than an intention.
function planTick({ state, orders = [], positions = [], config = {} } = {}) {
  const next = loadState(state);
  const commands = [];
  const refusals = [];
  const armed = config.armed === true;
  const killed = config.killSwitch === true;
  const cap = Number.isFinite(config.maxRequestsPerTick) ? config.maxRequestsPerTick : 10;
  const allowHedging = config.allowHedging === true;
  const sources = (orders || []).map(sourceOrder).filter(Boolean);
  const seenSymbols = new Map();

  const refuse = (kind, order, reason) => {
    next.refusals += 1;
    refusals.push({ kind, ticket: order ? order.ticket : null, symbol: order ? order.symbol : null, reason });
  };

  for (const order of sources) {
    const key = String(order.ticket);
    const entry = next.entries[key] || null;
    // A second resting order on the same symbol is the two-exposure case: refused unless the destination's
    // hedging mode is a verified fact (config.allowHedging), which M0 does not yet supply.
    const other = seenSymbols.get(order.symbol);
    if (other && other !== order.ticket && !allowHedging) {
      refuse("create", order, `ticket ${order.ticket} is a second resting ${order.side} on ${order.symbol} beside ticket ${other}; two exposures on one symbol are refused until the account's hedging mode is verified`);
      continue;
    }
    seenSymbols.set(order.symbol, order.ticket);

    if (killed) {
      refuse(entry ? "review" : "create", order, `the relay kill switch is on, so ticket ${order.ticket} is not copied`);
      continue;
    }

    if (!entry) {
      if (!armed) {
        refuse("create", order, `the relay is not armed, so ticket ${order.ticket} would be created but nothing is sent`);
        continue;
      }
      if (commands.length >= cap) {
        refuse("create", order, `ticket ${order.ticket} waits: the per-tick request cap of ${cap} is spent`);
        continue;
      }
      next.entries[key] = {
        ticket: order.ticket,
        client_tag: order.client_tag,
        symbol: order.symbol,
        side: order.side,
        volume: order.volume,
        price: order.price,
        stop: order.stop,
        target: order.target,
        expiration: order.expiration,
        state: "sending",
        broker_id: null,
        attempts: 1,
        filled_volume: 0,
        quarantine_reason: null
      };
      commands.push({ kind: "create", ticket: order.ticket, client_tag: order.client_tag, order, reason: `new resting ${order.side} ${order.volume} ${order.symbol} at ${order.price}` });
      continue;
    }

    // A send whose answer never arrived must not be repeated: the destination may already hold the order, and a
    // resend is the duplicate this relay exists to avoid. Reconcile by client tag first.
    if (entry.state === "sending" || entry.state === "uncertain" || entry.state === "amending") {
      refuse("create", order, `ticket ${order.ticket} was sent and its outcome is unknown; it is quarantined until a reconcile matches it by client tag ${entry.client_tag}`);
      continue;
    }
    if (entry.state === "refused" || entry.state === "missed-fill") {
      refuse("create", order, `ticket ${order.ticket} ended as ${entry.state} and is not resent automatically`);
      continue;
    }
    if (entry.state === "filled" || entry.state === "closed" || entry.state === "cancelled" || entry.state === "expired") {
      refuse("create", order, `ticket ${order.ticket} is already ${entry.state}; a new order needs a new ticket, never a resend of this one`);
      continue;
    }
    if (entry.state === "mirrored") {
      const moved = entry.volume !== order.volume || entry.stop !== order.stop || entry.target !== order.target || entry.price !== order.price;
      if (!moved) continue;
      if (!armed) {
        refuse("amend", order, `the relay is not armed, so the amendment to ticket ${order.ticket} is not sent`);
        continue;
      }
      if (commands.length >= cap) {
        refuse("amend", order, `the amendment to ticket ${order.ticket} waits: the per-tick request cap of ${cap} is spent`);
        continue;
      }
      commands.push({ kind: "amend", ticket: order.ticket, client_tag: entry.client_tag, broker_id: entry.broker_id, order, reason: `ticket ${order.ticket} moved to ${order.price} sl ${order.stop} tp ${order.target}` });
      entry.state = "amending";
      entry.attempts += 1;
    }
  }

  // A source ticket that has gone: either it filled or it was cancelled. The account's positions answer which.
  const openTickets = new Set(sources.map(order => String(order.ticket)));
  for (const [key, entry] of Object.entries(next.entries)) {
    if (openTickets.has(key)) continue;
    if (entry.state !== "mirrored") continue;
    const held = (positions || []).some(row => Number(row.magic) === SOURCE_MAGIC && String(row.symbol) === entry.symbol && (row.type === "POSITION_TYPE_BUY" ? "buy" : "sell") === entry.side);
    if (held) {
      entry.state = "filled";
      continue;
    }
    if (killed) {
      refuse("cancel", entry, `the relay kill switch is on, so the mirror of cancelled ticket ${entry.ticket} is left working`);
      continue;
    }
    commands.push({ kind: "cancel", ticket: entry.ticket, client_tag: entry.client_tag, broker_id: entry.broker_id, order: entry, reason: `ticket ${entry.ticket} left the terminal with no position: the mirror is cancelled` });
    entry.state = "closing";
  }

  next.requests += commands.length;
  return { commands, refusals, state: next };
}

// The outcome of a command, applied to the map. Every branch is a fact the caller observed on the destination,
// never an assumption: a send that timed out is `uncertain`, not `failed`, because the order may exist.
function record({ state, ticket, event, payload = {} } = {}) {
  const next = loadState(state);
  const entry = next.entries[String(ticket)];
  if (!entry) return next;
  switch (event) {
    case "accepted":
      entry.state = "mirrored";
      entry.broker_id = payload.broker_id ?? entry.broker_id;
      entry.quarantine_reason = null;
      if (payload.order) {
        entry.price = payload.order.price;
        entry.stop = payload.order.stop;
        entry.target = payload.order.target;
        entry.volume = payload.order.volume;
        entry.expiration = payload.order.expiration ?? null;
      }
      break;
    case "amend_ack":
      entry.state = "mirrored";
      if (payload.order) {
        entry.price = payload.order.price;
        entry.stop = payload.order.stop;
        entry.target = payload.order.target;
        entry.volume = payload.order.volume;
      }
      break;
    case "rejected":
      entry.state = "refused";
      entry.quarantine_reason = payload.reason || "the destination refused the request";
      break;
    case "timeout":
      entry.state = "uncertain";
      entry.quarantine_reason = "no answer arrived; the order may exist on the destination";
      next.quarantined += 1;
      break;
    case "partial":
      entry.filled_volume = Number(((entry.filled_volume || 0) + Number(payload.volume || 0)).toFixed(2));
      entry.state = "mirrored";
      break;
    case "filled":
      entry.filled_volume = payload.volume ?? entry.volume;
      entry.state = "filled";
      break;
    case "cancelled":
      entry.state = "cancelled";
      break;
    case "expired":
      entry.state = "expired";
      break;
    case "closed":
      entry.state = "closed";
      break;
    case "missed_fill":
      entry.state = "missed-fill";
      entry.quarantine_reason = payload.reason || "the source filled before it was mirrored";
      break;
    default:
      break;
  }
  return next;
}

// After a restart, before the first send: what does the destination already hold? A send whose outcome was
// unknown is adopted when its client tag is found there, and quarantined when it is not. Nothing is resent, and
// an order on the destination this relay cannot account for is quarantined rather than cancelled.
function reconcile({ state, destinationOrders = [] } = {}) {
  const next = loadState(state);
  const rows = [];
  const byTag = new Map();
  for (const order of destinationOrders) {
    if (order && order.client_tag) byTag.set(String(order.client_tag), order);
  }
  for (const entry of Object.values(next.entries)) {
    if (entry.state !== "sending" && entry.state !== "uncertain" && entry.state !== "amending") continue;
    const found = byTag.get(entry.client_tag);
    if (found) {
      entry.state = "mirrored";
      entry.broker_id = found.id ?? entry.broker_id;
      entry.quarantine_reason = null;
      rows.push({ ticket: entry.ticket, client_tag: entry.client_tag, outcome: "adopted", broker_id: entry.broker_id });
    } else {
      entry.state = "uncertain";
      entry.quarantine_reason = "no order carrying this client tag is on the destination; the send is not repeated";
      next.quarantined += 1;
      rows.push({ ticket: entry.ticket, client_tag: entry.client_tag, outcome: "quarantined", broker_id: null });
    }
  }
  for (const order of destinationOrders) {
    const tag = order && order.client_tag ? String(order.client_tag) : null;
    if (!tag) continue;
    const known = Object.values(next.entries).some(entry => entry.client_tag === tag);
    if (!known) {
      next.quarantined += 1;
      rows.push({ ticket: null, client_tag: tag, outcome: "orphan-quarantined", broker_id: order.id ?? null });
    }
  }
  return { rows, state: next };
}

function summarise({ state } = {}) {
  const counts = {};
  for (const entry of Object.values(loadState(state).entries)) {
    counts[entry.state] = (counts[entry.state] || 0) + 1;
  }
  return { entries: Object.keys(loadState(state).entries).length, by_state: counts, requests: loadState(state).requests, refusals: loadState(state).refusals, quarantined: loadState(state).quarantined };
}

module.exports = {
  SOURCE_MAGIC,
  CLIENT_PREFIX,
  PENDING_TYPES,
  FILL_TIMINGS,
  clientTagFor,
  sourceOrder,
  createState,
  dumpState,
  loadState,
  planTick,
  record,
  reconcile,
  summarise
};

