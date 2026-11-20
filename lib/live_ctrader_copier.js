// The cTrader copier's read surface, as data rather than as markup.
//
// The Live cTrader Copier tab answers a question the FTMO tabs cannot: what did the copier do with the FTMO-1
// orders it followed, on the cTrader account, in that account's own units? Three things have to be true for the
// answer to be checkable rather than decorative:
//
// 1. A displayed lot and a broker-native volume are different numbers for every contract. One lot of EURUSD is
//    100,000 units and 10,000,000 protocol units; one lot of BTCUSD is 1 unit and 100 protocol units. Every size
//    row here carries `volume_lots` (the order the copier sent), `protocol_units` (what the wire carries) and
//    `base_units` (the asset itself), each derived from that symbol's own contract.
// 2. A closed cTrader position is not automatically a copy. The account also carries the connection tests that
//    proved the order path, and those are real closes whose money moved the balance. They stay in the account
//    history with a label and are left out of the copier's figures, the same rule the FTMO tabs apply.
// 3. A mapping is a claim about a live broker position. Where the claim and the broker disagree - a source
//    ticket with no mapping, a mapping with no position, a pending send the broker never answered - the page
//    states the difference instead of drawing a mapping that no longer exists.
//
// Loaded as a plain script (the global `LiveCtraderCopier`) and required by the node scripts and tests, so the
// builder on the trading host, the tab in the browser and the tests cannot drift on any of these rules.
(function initLiveCtraderCopier(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.LiveCtraderCopier = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiveCtraderCopier() {
  const SCHEMA_VERSION = "live-ctrader-copier-v1";
  const DOCUMENT_STALE_AFTER_SECONDS = 1800;
  const HEARTBEAT_STALE_AFTER_SECONDS = 1500;
  const DEFAULT_WINDOW_DAYS = 30;

  // The source instruments the copier follows and the destination each lands on. A destination name is a fact
  // about the broker's own symbol list, so the deployed map is a file the builder reads; this default is the
  // identity map for the names known to match. `US100.cash` is FTMO's index name and cTrader may list it
  // differently, which is exactly why the mapping is data.
  const SOURCE_SYMBOLS = Object.freeze(["EURUSD", "XAUUSD", "BTCUSD", "US100.cash"]);
  const DEFAULT_SYMBOL_MAP = Object.freeze({ EURUSD: "EURUSD", XAUUSD: "XAUUSD", BTCUSD: "BTCUSD", "US100.cash": "US100.cash" });

  // A copy carries the client order id it was sent with, `copy-<source ticket>`; a connection test carries a
  // marker. Both are read from the comment because the comment is what survives a position closing. The
  // cTrader account's own proof trades are commented `btc-test-120s`, which is the marker this account uses.
  const COPY_COMMENT = /^copy-\d+/i;
  const SETUP_TEST_COMMENT = /tech-conn-test|setup[-_ ]test|conn[-_ ]test|btc[-_ ]test/i;

  function num(value) {
    if (value === null || value === undefined || value === "") return Number.NaN;
    return Number(value);
  }

  function finite(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  // A file field that is meant to be a list is read as one: an absent block and an empty block mean the same to a
  // reader, and neither is allowed to become an object or a string downstream.
  function arrayOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function roundTo(value, digits) {
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
  }

  function iso(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function dateStamp(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // ---- the size ---------------------------------------------------------------------------------------

  // A spec is the broker's own statement of one contract: `lot_units` is the base asset per lot (100,000 for
  // EURUSD), `protocol_units_per_lot` is what the wire counts (10,000,000, i.e. lotSize), and the bounds are in
  // lots. Everything below is derived from those, never from a symbol's name.
  function normaliseSpec(spec = {}) {
    const lotUnits = num(spec.lot_units ?? spec.lotSizeBtc);
    const protocolUnitsPerLot = num(spec.protocol_units_per_lot ?? spec.volumeScale);
    const step = num(spec.volume_step ?? spec.volumeStep);
    const minimum = num(spec.min_volume ?? spec.minVolume);
    const maximum = num(spec.max_volume ?? spec.maxVolume);
    return {
      symbol: spec.symbol || null,
      digits: Number.isInteger(num(spec.digits)) ? num(spec.digits) : null,
      lot_units: finite(lotUnits) && lotUnits > 0 ? lotUnits : null,
      protocol_units_per_lot: finite(protocolUnitsPerLot) && protocolUnitsPerLot > 0 ? protocolUnitsPerLot : null,
      volume_step: finite(step) && step > 0 ? step : null,
      min_volume: finite(minimum) && minimum > 0 ? minimum : null,
      max_volume: finite(maximum) && maximum > 0 ? maximum : null,
      trade_mode: spec.trade_mode ?? spec.tradeMode ?? null
    };
  }

  // Lots to the two native readings. A protocol volume is a whole number of cents of the base asset, so it is
  // rounded to the nearest integer; base units are that quantity over 100. With no contract the caller gets
  // nulls rather than a number that looks like a size.
  function lotsToNative({ lots, spec } = {}) {
    const normalised = normaliseSpec(spec);
    const value = num(lots);
    if (!finite(value) || value < 0 || normalised.protocol_units_per_lot === null) {
      return { volume_lots: null, protocol_units: null, base_units: null };
    }
    const protocol = Math.round(value * normalised.protocol_units_per_lot);
    return { volume_lots: roundTo(value, 4), protocol_units: protocol, base_units: roundTo(protocol / 100, 6) };
  }

  function protocolUnitsToLots({ protocolUnits, spec } = {}) {
    const normalised = normaliseSpec(spec);
    const units = num(protocolUnits);
    if (!finite(units) || normalised.protocol_units_per_lot === null) return null;
    return roundTo(units / normalised.protocol_units_per_lot, 8);
  }

  // The copier's own conversion in the same terms: source lots times the source contract is the quantity of the
  // asset, over the destination's units per lot, floored to the destination's step so a copy is never wider than
  // the trade it copies. Below the minimum it is refused, not rounded up.
  function convertSourceVolume({ sourceLots, sourceContractSize, spec, maxLots = null } = {}) {
    const normalised = normaliseSpec(spec);
    const lots = num(sourceLots);
    const sourceUnits = num(sourceContractSize);
    if (!finite(lots) || lots <= 0) return { ok: false, cause: "source_volume_invalid" };
    if (!finite(sourceUnits) || sourceUnits <= 0) return { ok: false, cause: "source_contract_missing" };
    if (normalised.lot_units === null) return { ok: false, cause: "target_contract_missing" };
    if (normalised.volume_step === null) return { ok: false, cause: "target_step_missing" };
    const wanted = (lots * sourceUnits) / normalised.lot_units;
    const ceiling = finite(num(maxLots)) && num(maxLots) > 0 ? num(maxLots) : null;
    const capped = ceiling !== null && wanted > ceiling ? ceiling : wanted;
    const floored = Math.floor(capped / normalised.volume_step + 1e-9) * normalised.volume_step;
    if (normalised.min_volume !== null && floored < normalised.min_volume) {
      return { ok: false, cause: "volume_below_target_minimum", wanted, minimum: normalised.min_volume };
    }
    if (normalised.max_volume !== null && floored > normalised.max_volume) {
      return { ok: false, cause: "volume_above_target_maximum", wanted };
    }
    return { ok: true, lots: roundTo(floored, 4), wanted, capped: capped !== wanted };
  }

  // One row per source instrument the copier may meet, held or not. The map is evidence in its own right:
  // `US100.cash -> <name>` is the line that says which cTrader contract the index is.
  function symbolRows({ symbolMap = DEFAULT_SYMBOL_MAP, symbols = {}, sourceSymbols = SOURCE_SYMBOLS, positions = [] } = {}) {
    const held = new Set((Array.isArray(positions) ? positions : []).filter((row) => row && row.symbol).map((row) => String(row.symbol)));
    return sourceSymbols.map((source) => {
      const has = Object.prototype.hasOwnProperty.call(symbolMap, source);
      const target = has ? symbolMap[source] : null;
      const spec = target ? normaliseSpec(symbols[target] || {}) : null;
      return {
        source_symbol: source,
        target_symbol: target,
        mapped: Boolean(target),
        excluded: has && !target,
        held: held.has(target),
        digits: spec ? spec.digits : null,
        lot_units: spec ? spec.lot_units : null,
        protocol_units_per_lot: spec ? spec.protocol_units_per_lot : null,
        volume_step: spec ? spec.volume_step : null,
        min_volume: spec ? spec.min_volume : null,
        trade_mode: spec ? spec.trade_mode : null
      };
    });
  }


  // ---- the trades ----------------------------------------------------------------------------------------

  // The adapter's deal shape, paired by position into a trade. A closing deal is the one carrying
  // `closePositionDetail` (the adapter states it as `closing`); its gross profit, commission and swap are the
  // money of the exit, and the opening deal's own commission is the entry cost.
  function pairDeals(deals = []) {
    const byPosition = new Map();
    for (const deal of Array.isArray(deals) ? deals : []) {
      if (!deal || deal.position_id === null || deal.position_id === undefined) continue;
      const key = String(deal.position_id);
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(deal);
    }
    const trades = [];
    for (const [positionId, rows] of byPosition) {
      const ordered = rows
        .slice()
        .sort((left, right) => String(left.time_utc || "").localeCompare(String(right.time_utc || "")));
      const opening = ordered.find((row) => row.closing !== true) || ordered[0];
      const closing = ordered.filter((row) => row.closing === true).slice(-1)[0] || null;
      if (!closing) continue;
      const commission = ordered.reduce((total, row) => total + (finite(num(row.commission)) ? num(row.commission) : 0), 0);
      const swap = ordered.reduce((total, row) => total + (finite(num(row.swap)) ? num(row.swap) : 0), 0);
      const profit = finite(num(closing.gross_profit)) ? num(closing.gross_profit) : null;
      const openedAt = dateStamp(opening.time_utc);
      const closedAt = dateStamp(closing.time_utc);
      trades.push({
        position_id: positionId,
        symbol: closing.symbol || opening.symbol || null,
        side: opening.side || closing.side || "buy",
        volume_lots: finite(num(opening.volume_lots)) ? num(opening.volume_lots) : (finite(num(closing.volume_lots)) ? num(closing.volume_lots) : null),
        price_open: finite(num(opening.price)) ? num(opening.price) : null,
        price_close: finite(num(closing.price)) ? num(closing.price) : null,
        opened: { time_utc: iso(opening.time_utc) },
        closed: { time_utc: iso(closing.time_utc) },
        duration_seconds: openedAt && closedAt ? Math.max(0, Math.round((closedAt.getTime() - openedAt.getTime()) / 1000)) : null,
        profit,
        commission: roundTo(commission, 8),
        swap: roundTo(swap, 8),
        net_profit: profit === null ? null : roundTo(profit + commission + swap, 8),
        deal_count: ordered.length,
        comment: opening.comment ?? closing.comment ?? null,
        order_id: opening.order_id ?? null
      });
    }
    return trades.sort((left, right) => String(left.closed.time_utc || "").localeCompare(String(right.closed.time_utc || "")));
  }


  // A close is a copy, a setup test, or unattributed. The mapping store is the first witness because it is the
  // copier's own record of the ticket it opened; a comment naming `copy-<ticket>` is the second, because the
  // store forgets a row once the destination is flat. A close that predates the copier's first copy is neither:
  // it is the account's own earlier trading, kept in the history and labelled as what it is rather than counted
  // as a difference the copier is failing to explain. Anything else is stated as unattributed rather than
  // dropped: a close nobody can attribute is a question about the account, not a row to hide.
  function attributeTrade(trade, { mappings = {}, history = [], setupTestIds = [], copierStartUtc = null } = {}) {
    const positionId = String(trade?.position_id ?? "");
    const known = [
      ...Object.values(mappings || {}),
      ...(Array.isArray(history) ? history : [])
    ].find((row) => row && String(row.target_position_id ?? row.targetPositionId ?? "") === positionId);
    if (known) {
      return {
        kind: "copy",
        label: "Copied from FTMO-1",
        source_ticket: known.source_ticket ? String(known.source_ticket) : null,
        source_symbol: known.source_symbol || null
      };
    }
    const ids = new Set((Array.isArray(setupTestIds) ? setupTestIds : []).map((value) => String(value)));
    if (ids.has(positionId) || SETUP_TEST_COMMENT.test(String(trade?.comment || ""))) {
      return { kind: "setup-test", label: "Standalone setup test", source_ticket: null, source_symbol: null };
    }
    if (COPY_COMMENT.test(String(trade?.comment || ""))) {
      return {
        kind: "copy",
        label: "Copied from FTMO-1",
        source_ticket: String(trade.comment).replace(COPY_COMMENT, "").replace(/-a\d+$/, ""),
        source_symbol: null
      };
    }
    const closedAt = dateStamp(trade?.closed?.time_utc);
    const startAt = dateStamp(copierStartUtc);
    if (closedAt && startAt && closedAt.getTime() < startAt.getTime()) {
      return { kind: "pre-copier", label: "Before the copier", source_ticket: null, source_symbol: null };
    }
    return { kind: "unattributed", label: "Not a copy", source_ticket: null, source_symbol: null };
  }

  // Closed trades in the shape the performance module already reads, plus the label and the reason. The
  // `comment` the performance module keys its strategy row on is left as the broker's own text, so a trade that
  // does not carry a copy marker cannot be mistaken for one.
  function closedTradeRows(deals, context = {}) {
    return pairDeals(deals).map((trade) => {
      const attribution = attributeTrade(trade, context);
      return {
        ...trade,
        dashboard_asset: trade.symbol || null,
        copy_kind: attribution.kind,
        copy_label: attribution.label,
        source_ticket: attribution.source_ticket,
        source_symbol: attribution.source_symbol
      };
    });
  }

  // The copier's figures describe copied trades only. Setup tests are counted and netted separately so the tab
  // can say what they were worth without folding them into a win rate, and unattributed closes are named.
  function performanceTrades(closedTrades = []) {
    const copies = [];
    const setupTests = [];
    const unattributed = [];
    const preCopier = [];
    for (const trade of Array.isArray(closedTrades) ? closedTrades : []) {
      if (trade.copy_kind === "copy") copies.push(trade);
      else if (trade.copy_kind === "setup-test") setupTests.push(trade);
      else if (trade.copy_kind === "pre-copier") preCopier.push(trade);
      else unattributed.push(trade);
    }
    const netOf = (rows) => roundTo(rows.reduce((total, trade) => total + (finite(num(trade.net_profit)) ? num(trade.net_profit) : 0), 0), 2);
    return {
      copies,
      setup_tests: { trades: setupTests.length, net: netOf(setupTests), position_ids: setupTests.map((trade) => trade.position_id) },
      pre_copier: { trades: preCopier.length, net: netOf(preCopier), position_ids: preCopier.map((trade) => trade.position_id) },
      unattributed: { trades: unattributed.length, net: netOf(unattributed), position_ids: unattributed.map((trade) => trade.position_id) }
    };
  }


  // ---- the mapping rows ---------------------------------------------------------------------------------

  // One row per copy, stated three ways: the source ticket, the cTrader position, and the size in lots, wire
  // units and asset units. The broker's own position is the witness for entry, stop and target while it is
  // open; a copy whose position has closed keeps the store's numbers and says so. A market order has no expiry,
  // which is a fact about the order type rather than missing data.
  function mappingRows({ mappings = {}, history = [], pending = {}, positions = [], symbols = {} } = {}) {
    const byPosition = new Map();
    for (const position of Array.isArray(positions) ? positions : []) {
      byPosition.set(String(position.position_id ?? position.positionId ?? ""), position);
    }
    const rows = [];
    for (const [ticket, mapped] of Object.entries(mappings || {})) {
      const positionId = String(mapped?.target_position_id ?? mapped?.targetPositionId ?? "");
      const position = byPosition.get(positionId) || null;
      const symbol = position?.symbol || mapped.symbol || null;
      const native = lotsToNative({ lots: mapped.volume, spec: symbols[symbol] || {} });
      rows.push({
        source_ticket: String(ticket),
        target_position_id: positionId || null,
        source_symbol: mapped.source_symbol || null,
        symbol,
        side: position?.side || mapped.side || null,
        status: position ? "open" : "not_open",
        status_detail: position ? null : "the mapping store holds this copy but the broker read no open position for it",
        volume_lots: native.volume_lots,
        protocol_units: native.protocol_units,
        base_units: native.base_units,
        entry_price: finite(num(position?.entry_price)) ? num(position.entry_price) : (finite(num(mapped.entry_price)) ? num(mapped.entry_price) : null),
        stop_price: finite(num(position?.stop_price)) ? num(position.stop_price) : (finite(num(mapped.stop_price)) ? num(mapped.stop_price) : null),
        target_price: finite(num(position?.target_price)) ? num(position.target_price) : null,
        expiry_utc: null,
        expiry_note: "market order: a filled source position is copied at the market, so there is no expiry to carry",
        // The lifecycle the store kept for this copy: an order kind says a resting order was placed, `sltp_utc` an
        // amendment the broker accepted, `last_partial_utc` a partial close it accepted. They are what lets the
        // verification matrix stay "broker observed" after the poll that carried the answer has been overwritten.
        order_kind: mapped.order_kind || null,
        target_order_id: mapped.target_order_id ? String(mapped.target_order_id) : null,
        sltp_utc: mapped.sltp_utc || null,
        last_partial_utc: mapped.last_partial_utc || null,
        request_id: mapped.request_id || null,
        copied_utc: mapped.copied_utc || null,
        reconciled: mapped.reconciled === true
      });
    }
    for (const [ticket, claim] of Object.entries(pending || {})) {
      const symbol = claim?.symbol || null;
      const native = lotsToNative({ lots: claim?.volume, spec: symbols[symbol] || {} });
      rows.push({
        source_ticket: String(ticket),
        target_position_id: null,
        source_symbol: claim?.source_symbol || null,
        symbol,
        side: claim?.side || null,
        status: "pending",
        status_detail: "the send answered unknown; the broker is asked by this client order id before anything else is sent",
        volume_lots: native.volume_lots,
        protocol_units: native.protocol_units,
        base_units: native.base_units,
        entry_price: null,
        stop_price: finite(num(claim?.stop_price)) ? num(claim.stop_price) : null,
        target_price: null,
        expiry_utc: null,
        expiry_note: "claim only: no position is known to exist yet",
        order_kind: null,
        sltp_utc: null,
        last_partial_utc: null,
        request_id: claim?.request_id || null,
        copied_utc: claim?.at_utc || null,
        reconciled: false
      });
    }
    for (const row of Array.isArray(history) ? history : []) {
      const ticket = String(row?.source_ticket ?? "");
      if (!ticket || Object.prototype.hasOwnProperty.call(mappings || {}, ticket)) continue;
      const symbol = row.symbol || null;
      const native = lotsToNative({ lots: row.volume, spec: symbols[symbol] || {} });
      rows.push({
        source_ticket: ticket,
        target_position_id: row.target_position_id ? String(row.target_position_id) : null,
        source_symbol: row.source_symbol || null,
        symbol,
        side: row.side || null,
        status: "closed",
        status_detail: row.close_outcome ? `closed on the destination: ${row.close_outcome}` : "closed on the destination",
        volume_lots: native.volume_lots,
        protocol_units: native.protocol_units,
        base_units: native.base_units,
        entry_price: null,
        stop_price: finite(num(row.stop_price)) ? num(row.stop_price) : null,
        target_price: null,
        expiry_utc: null,
        expiry_note: "market order: there was no expiry",
        order_kind: row.order_kind || null,
        target_order_id: row.target_order_id ? String(row.target_order_id) : null,
        sltp_utc: row.sltp_utc || null,
        last_partial_utc: row.last_partial_utc || null,
        request_id: row.request_id || null,
        copied_utc: row.copied_utc || null,
        closed_utc: row.closed_utc || null,
        reconciled: row.reconciled === true
      });
    }
    return rows.sort((left, right) => String(left.copied_utc || "").localeCompare(String(right.copied_utc || "")));
  }


  // ---- what does not add up -----------------------------------------------------------------------------

  // The differences are stated from the reads the copier already makes: the source tickets its last poll saw
  // (`health.source.rows`), the destination positions the snapshot read, and the store's own claims. A ticket
  // refused for a stated reason is not a missing copy - the refusal is the answer - so refusals are carried
  // beside these rather than inside them.
  function differences({ health = {}, state = {}, positions = [], closedTrades = [], symbolMap = {} } = {}) {
    const healthBlock = health && typeof health === "object" ? health : {};
    const sourceRows = Array.isArray(healthBlock?.source?.rows) ? healthBlock.source.rows : [];
    const mappings = state && typeof state === "object" ? state.mappings || {} : {};
    const pending = state.pending || {};
    const refusals = Array.isArray(healthBlock.refusals) ? healthBlock.refusals : [];
    const refusedTickets = new Set(refusals.map((row) => String(row.ticket ?? "")));
    const openIds = new Set((Array.isArray(positions) ? positions : []).map((row) => String(row.position_id ?? row.positionId ?? "")));
    const missing = [];
    for (const row of sourceRows) {
      const ticket = String(row.ticket ?? "");
      if (!ticket || mappings[ticket] || pending[ticket] || refusedTickets.has(ticket)) continue;
      const target = Object.prototype.hasOwnProperty.call(symbolMap, row.symbol) ? symbolMap[row.symbol] : row.symbol;
      if (!target) continue;
      missing.push({
        source_ticket: ticket,
        source_symbol: row.symbol || null,
        target_symbol: target,
        side: row.side || null,
        volume_lots: finite(num(row.volume)) ? num(row.volume) : null,
        detail: "the source holds this position and the copier has no mapping for it"
      });
    }
    const orphaned = [];
    for (const [ticket, mapped] of Object.entries(mappings || {})) {
      const positionId = String(mapped?.target_position_id ?? mapped?.targetPositionId ?? "");
      if (positionId && openIds.has(positionId)) continue;
      const sourceStillHeld = sourceRows.some((row) => String(row.ticket ?? "") === String(ticket));
      orphaned.push({
        source_ticket: String(ticket),
        target_position_id: positionId || null,
        symbol: mapped?.symbol || null,
        detail: sourceStillHeld
          ? "the source still holds the ticket, the mapping exists and the broker read no open position: the copy is not on the account"
          : "the source no longer holds the ticket; the close is due on the next poll"
      });
    }
    const unresolvedPending = Object.entries(pending || {}).map(([ticket, claim]) => ({
      source_ticket: String(ticket),
      request_id: claim?.request_id || null,
      at_utc: claim?.at_utc || null,
      detail: "a send answered unknown and has not been reconciled with the broker yet"
    }));
    const unattributed = (Array.isArray(closedTrades) ? closedTrades : [])
      .filter((trade) => trade.copy_kind === "unattributed")
      .map((trade) => ({
        target_position_id: trade.position_id,
        symbol: trade.symbol,
        closed_utc: trade.closed?.time_utc || null,
        net: trade.net_profit,
        detail: "a closed position that is neither a copy nor a labelled setup test"
      }));
    return {
      count: missing.length + orphaned.length + unresolvedPending.length + unattributed.length,
      missing_copies: missing,
      orphaned_mappings: orphaned,
      unresolved_pending: unresolvedPending,
      unattributed_closes: unattributed
    };
  }


  // ---- the verification matrix --------------------------------------------------------------------------

  // What has actually been proved about each behaviour, and how. The distinction the page must keep is between
  // a path exercised on fixtures through the adapter ("tested"), a path the broker itself has confirmed
  // ("broker_observed"), and a behaviour the copier does not attempt ("not_sent"). A full close stays
  // `awaiting_live_proof` until a natural source exit has produced a broker-confirmed close; a fixture cannot
  // stand in for that, and no trade is forced to make it happen.
  //
  // The lifecycle paths - amendment, resting orders, cancellation and partial close - are promoted only on the
  // broker's own answer: a row in the copier's health for the poll that says `accepted`, or the record the store
  // kept after that answer. A planned row, a dry run, a refusal, or a counter such as
  // `reconcile_orders.filled` is not that answer, and none of them moves a row off `tested`.
  function verification({ health = {}, mappings = [], snapshot = {}, closedTrades = [] } = {}) {
    const healthBlock = health && typeof health === "object" ? health : {};
    const rows = Array.isArray(mappings) ? mappings : [];
    const openCopies = rows.filter((row) => row.status === "open");
    const closedCopies = rows.filter((row) => row.status === "closed");
    const observedCloses = arrayOf(healthBlock.closes).filter((row) => row.outcome === "accepted");
    const readAt = snapshot.generated_at_utc || null;
    const lot = (row) => (finite(num(row.volume_lots)) ? `${num(row.volume_lots)} lot` : "the planned size");
    const identity = (row) => `#${row.target_position_id || "?"} ${row.symbol || ""} ${row.side || ""} ${lot(row)}`.trim();
    const copyEvidence = openCopies.length
      ? `broker read ${readAt || "at the last snapshot"}: ${openCopies.map(identity).join(", ")} from source ${openCopies.map((row) => row.source_ticket).join(", ")}`
      : "no copy is open on the destination in this read";
    // A close is observed in one of two ways, and both are the broker's own answer: the copier's health for the
    // poll that closed it, or the trade that appears in the account's deals after the mapping moved to history.
    const closedTradeFor = (row) => (Array.isArray(closedTrades) ? closedTrades : []).find((trade) => String(trade.position_id) === String(row.target_position_id) && trade.copy_kind === "copy") || null;
    const closeEvidence = observedCloses.length
      ? `copier health ${healthBlock.finished_utc || ""}: close ${observedCloses.map((row) => `#${row.positionId || row.position_id || "?"}`).join(", ")} accepted by the broker`
      : closedCopies.length
        ? closedCopies.map((row) => {
          const trade = closedTradeFor(row);
          const exit = trade && finite(num(trade.price_close)) ? ` at ${trade.price_close}` : "";
          const when = trade?.closed?.time_utc ? ` on ${trade.closed.time_utc}` : "";
          const net = trade && finite(num(trade.net_profit)) ? `, net ${trade.net_profit}` : "";
          return `#${row.target_position_id} ${row.symbol || ""} closed${exit}${when}${net} in the account's own deals, from source ${row.source_ticket}`;
        }).join("; ")
        : "no copier close has been observed on this account yet";
    const closeObserved = observedCloses.length > 0 || closedCopies.length > 0;

    // The lifecycle rows the last poll wrote, and the records the store kept from an earlier accepted answer. Each
    // item states its provenance, because "the broker accepted this at this time" and "a mapping remembers it"
    // are different strengths of evidence and the page must not blur them.
    const pending = healthBlock.pending_orders && typeof healthBlock.pending_orders === "object" ? healthBlock.pending_orders : {};
    const accepted = (row) => Boolean(row) && row.outcome === "accepted";
    const observedAt = healthBlock.finished_utc ? `copier health ${healthBlock.finished_utc}` : "the last copier read";
    const priceText = (value) => (value === null || value === undefined || !finite(num(value)) ? null : String(num(value)));
    const pricePair = (stop, target) => [stop !== null ? `stop ${stop}` : null, target !== null ? `target ${target}` : null].filter(Boolean).join(" and ") || "no price";
    const amendedStops = arrayOf(healthBlock.stops)
      .filter((row) => accepted(row) && (priceText(row.applied_stop) !== null || priceText(row.applied_target) !== null));
    const amendmentEvidence = [
      ...amendedStops.map((row) => `${observedAt}: #${row.positionId || "?"} ${row.symbol || ""} amended at the broker to ${pricePair(priceText(row.applied_stop), priceText(row.applied_target))}, asked for ${pricePair(priceText(row.stopLoss), priceText(row.takeProfit))}, from source stop ${priceText(row.source_stop) || "none"}`),
      ...arrayOf(pending.amended).filter(accepted).map((row) => `${observedAt}: order ${row.orderId || "?"} ${row.symbol || ""} amended at the broker`),
      ...rows.filter((row) => row.sltp_utc).map((row) => `the mapping for #${row.target_position_id || "?"} ${row.symbol || ""} records the amendment the broker accepted at ${row.sltp_utc}`)
    ];
    const placedOrders = arrayOf(pending.placed).filter((row) => accepted(row) && row.orderId);
    const restingEvidence = [
      ...placedOrders.map((row) => `${observedAt}: order ${row.orderId} ${row.symbol || ""} ${row.side || ""} ${row.volume ?? "?"} at ${priceText(row.price) || "?"} with ${pricePair(priceText(row.stopPrice), priceText(row.takeProfit))}${row.expiryMs ? `, expiring ${iso(row.expiryMs)}` : ""}, accepted by the broker`),
      ...rows.filter((row) => row.order_kind).map((row) => `the mapping for order ${row.target_order_id || row.target_position_id || "?"} ${row.symbol || ""} ${row.order_kind} records a broker order the copier placed, ${row.status === "open" ? "still working" : "no longer working"}`)
    ];
    const cancelledOrders = arrayOf(pending.cancelled).filter(accepted);
    const cancelEvidence = [
      ...cancelledOrders.map((row) => `${observedAt}: order ${row.orderId || "?"} ${row.symbol || ""} withdrawn and the broker accepted the cancel`),
      ...closedCopies.filter((row) => /cancelled/i.test(String(row.status_detail || ""))).map((row) => `order ${row.target_order_id || "?"} ${row.symbol || ""} was cancelled in the copier's own history for the source ticket`)
    ];
    const partialCloses = arrayOf(healthBlock.closes).filter((row) => accepted(row) && row.partial === true);
    const partialEvidence = [
      ...partialCloses.map((row) => `${observedAt}: #${row.positionId || "?"} ${row.symbol || ""} closed ${row.volume ?? "?"} of ${row.target_volume ?? "?"} lots and the broker accepted it while the source still held ${row.source_volume ?? "?"}`),
      ...rows.filter((row) => row.last_partial_utc).map((row) => `the mapping for #${row.target_position_id || "?"} ${row.symbol || ""} records a partial close the broker accepted at ${row.last_partial_utc}`)
    ];

    return [
      {
        behaviour: "Copying a filled FTMO-1 position",
        state: openCopies.length ? "broker_observed" : "awaiting_live_proof",
        detail: copyEvidence
      },
      {
        behaviour: "Size conversion through the destination contract",
        state: openCopies.length ? "broker_observed" : "tested",
        detail: openCopies.length
          ? "the adapter regression sends 0.01 lot of EURUSD as 100,000 protocol units, XAUUSD as 100, BTCUSD as 1 and the index as 1 on this account; the open copies above read back at 0.01 lot"
          : "the adapter regression sends 0.01 lot of EURUSD as 100,000 protocol units, XAUUSD as 100, BTCUSD as 1 and the index as 1 on this account"
      },
      {
        behaviour: "Stop carried at entry",
        state: openCopies.length ? "broker_observed" : "tested",
        detail: openCopies.length
          ? "the broker holds the stop the copier sent, placed as a distance from the destination's own reference price, so it differs from the source stop by the fill"
          : "the market send carries a stop derived from the destination reference; no open copy proves it on this read"
      },
      {
        behaviour: "Amending a stop or target after the copy",
        state: amendmentEvidence.length ? "broker_observed" : "tested",
        detail: amendmentEvidence.length
          ? amendmentEvidence.join("; ")
          : "the copier compares the source's own stop and target with the destination's on every poll and amends only a difference, sending the protection as a stop-loss rather than as an entry; exercised on fixtures through the adapter, and no source trail has moved a copy on this account yet"
      },
      {
        behaviour: "Copying a resting source order",
        state: restingEvidence.length ? "broker_observed" : "tested",
        detail: restingEvidence.length
          ? restingEvidence.join("; ")
          : "a working source order is copied as a working destination order at the source's own entry, carrying its protection as a stop-loss and its expiry under a client order id the copier can claim on the next poll; exercised on fixtures through the adapter, and no resting source order has been placed on this account yet"
      },
      {
        behaviour: "Cancelling a resting source order",
        state: cancelEvidence.length ? "broker_observed" : "tested",
        detail: cancelEvidence.length
          ? cancelEvidence.join("; ")
          : "a source cancellation withdraws the copy with a cancel, and a copy the destination cancels while the source still holds is re-placed once under a new client order id and recorded; exercised on fixtures through the adapter, and no cancellation has happened on this account yet"
      },
      {
        behaviour: "Partial close on the source",
        state: partialEvidence.length ? "broker_observed" : "tested",
        detail: partialEvidence.length
          ? partialEvidence.join("; ")
          : "the destination's own volume is compared with the share of the source still open and only the difference is closed, with the new baseline held while the broker's answer settles so the next poll does not close twice; exercised on fixtures through the adapter, and no partial close has happened at the source yet"
      },
      {
        behaviour: "Full close after a source exit",
        state: closeObserved ? "broker_observed" : "awaiting_live_proof",
        detail: closeObserved
          ? closeEvidence
          : `tested on fixtures through the adapter's own close path, with the closed symbol's own volume scale; ${closeEvidence}. It stays unproved until a natural source exit closes the copy`
      }
    ];
  }


  // The heartbeat, reduced to the one word the page can defend: the copier's last poll file says what it did,
  // and its age says whether the loop is still beating. `killed` is its own state, because a deliberate stop is
  // not a failure, and an unreadable source is not the same as an empty account.
  function healthState({ health = null, now = new Date(), staleAfterSeconds = HEARTBEAT_STALE_AFTER_SECONDS } = {}) {
    if (!health || typeof health !== "object") {
      return {
        state: "missing",
        label: "NO HEARTBEAT",
        age_seconds: null,
        last_poll_utc: null,
        last_success_utc: null,
        detail: "no health file has been published: the copier has not run on this account yet"
      };
    }
    const finished = dateStamp(health.finished_utc || health.started_utc);
    const ageSeconds = finished ? Math.max(0, Math.round((now.getTime() - finished.getTime()) / 1000)) : null;
    const status = String(health.status || "unknown");
    if (status === "killed") {
      return { state: "killed", label: "KILLED", age_seconds: ageSeconds, last_poll_utc: iso(health.finished_utc), last_success_utc: null, detail: "the kill switch file exists; the copier read and sent nothing" };
    }
    const failed = status === "failed" || status === "source_unreadable";
    const stale = ageSeconds !== null && ageSeconds > staleAfterSeconds;
    return {
      state: failed ? "error" : stale ? "stale" : "ok",
      label: failed ? "ERROR" : stale ? "STALE" : "OK",
      age_seconds: ageSeconds,
      last_poll_utc: iso(health.finished_utc),
      last_success_utc: status === "ok" || status === "partial" ? iso(health.finished_utc) : null,
      detail: failed
        ? `the last poll finished ${status}: ${(health.notes || [])[0] || "no note"}`
        : stale
          ? `the last poll finished ${ageSeconds}s ago, outside the ${staleAfterSeconds}s a heartbeat may age between publishes`
          : `the last poll finished ${ageSeconds}s ago and reported ${status}`
    };
  }

  // ---- the whole document -------------------------------------------------------------------------------

  // The builder, over the three files the trading host already writes: the copier's health, its mapping store,
  // and one read of the destination account. Everything is optional except the snapshot - a missing health file
  // is a copier that has not run, not a reason to publish nothing - and every absence is stated rather than
  // filled in with a zero.
  function buildDocument({ health = null, state = null, snapshot = null, config = {}, now = new Date() } = {}) {
    if (!snapshot || typeof snapshot !== "object" || !snapshot.account) {
      const error = new Error("a destination snapshot with an account block is required");
      error.code = "snapshot_missing";
      throw error;
    }
    const buildNow = dateStamp(now) || new Date();
    const store = state && typeof state === "object" ? state : {};
    const mappingsState = store.mappings && typeof store.mappings === "object" ? store.mappings : {};
    const pendingState = store.pending && typeof store.pending === "object" ? store.pending : {};
    const history = Array.isArray(store.history) ? store.history : [];
    const healthBlock = health && typeof health === "object" ? health : null;
    const pendingBlock = healthBlock && healthBlock.pending_orders && typeof healthBlock.pending_orders === "object" ? healthBlock.pending_orders : {};
    const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
    const orders = Array.isArray(snapshot.orders) ? snapshot.orders : [];
    const symbols = snapshot.symbols && typeof snapshot.symbols === "object" ? snapshot.symbols : {};
    const symbolMap = config.symbolMap && typeof config.symbolMap === "object" ? config.symbolMap : DEFAULT_SYMBOL_MAP;
    const setupTestIds = Array.isArray(config.setupTestIds) ? config.setupTestIds : [];
    const windowDays = Number.isInteger(num(config.windowDays)) && num(config.windowDays) > 0 ? num(config.windowDays) : DEFAULT_WINDOW_DAYS;
    const heartbeat = healthState({
      health: healthBlock,
      now: buildNow,
      staleAfterSeconds: finite(num(config.heartbeatStaleAfterSeconds)) && num(config.heartbeatStaleAfterSeconds) > 0
        ? num(config.heartbeatStaleAfterSeconds)
        : HEARTBEAT_STALE_AFTER_SECONDS
    });
    const copyTimes = [
      ...Object.values(mappingsState).map((row) => row && row.copied_utc),
      ...history.map((row) => row && row.copied_utc)
    ].filter(Boolean).sort();
    const copierStartUtc = config.copierStartUtc || copyTimes[0] || null;
    const closedTrades = closedTradeRows(Array.isArray(snapshot.deals) ? snapshot.deals : [], {
      mappings: mappingsState,
      history,
      setupTestIds,
      copierStartUtc
    }).map((trade) => ({
      // The digits travel with the row so the page can print a 5-decimal FX exit and a 2-decimal gold exit on the
      // same table without guessing one from the other.
      ...trade,
      digits: Number.isInteger(num(symbols[trade.symbol]?.digits)) ? num(symbols[trade.symbol].digits) : null
    }));
    const trades = performanceTrades(closedTrades);
    const mappings = mappingRows({ mappings: mappingsState, history, pending: pendingState, positions, symbols });
    const account = snapshot.account || {};
    const closes = Array.isArray(healthBlock?.closes) ? healthBlock.closes : [];
    const actions = Array.isArray(healthBlock?.actions) ? healthBlock.actions : [];
    const refusals = Array.isArray(healthBlock?.refusals) ? healthBlock.refusals : [];
    const rejections = [
      ...refusals.map((row) => ({ kind: "refusal", code: row.code || null, ticket: row.ticket || null, detail: row.detail === undefined ? null : row.detail, at_utc: healthBlock?.finished_utc || null })),
      ...actions.filter((row) => row.outcome === "refused").map((row) => ({ kind: "action", code: row.code || null, ticket: row.ticket || null, detail: row.message || null, at_utc: healthBlock?.finished_utc || null })),
      ...closes.filter((row) => row.outcome === "refused").map((row) => ({ kind: "close", code: row.code || null, ticket: row.ticket || null, detail: row.message || null, at_utc: healthBlock?.finished_utc || null }))
    ];


    return {
      schema_version: SCHEMA_VERSION,
      generated_at_utc: buildNow.toISOString(),
      stale_after_seconds: finite(num(config.documentStaleAfterSeconds)) && num(config.documentStaleAfterSeconds) > 0
        ? num(config.documentStaleAfterSeconds)
        : DOCUMENT_STALE_AFTER_SECONDS,
      publisher: config.publisher || "scripts/publish-ctrader-copier.js",
      note: "Read-only. One destination read plus the copier's own files; no order function is called to build this document, and nothing on the tab can trade.",
      read_only: true,
      order_functions_called: false,
      source: {
        lane: config.lane || "ftmo-1",
        label: config.laneLabel || "FTMO account 1",
        account_login_masked: config.accountLoginMasked || null,
        account_server: config.accountServer || null,
        probe: config.probe || null,
        probed_at_utc: healthBlock?.source?.probed_at_utc || null,
        positions_seen: Array.isArray(healthBlock?.source?.rows) ? healthBlock.source.rows.length : null
      },
      destination: {
        login: finite(num(config.login)) ? num(config.login) : null,
        account_id: account.account_id ? String(account.account_id) : null,
        broker: account.broker || null,
        environment: account.environment || (account.is_live ? "live" : "demo"),
        demo: account.is_live !== true
      },
      connection: {
        connected: account.connected !== false,
        read_at_utc: snapshot.generated_at_utc || null,
        account_id: account.account_id ? String(account.account_id) : null,
        broker: account.broker || null,
        environment: account.environment || (account.is_live ? "live" : "demo"),
        currency: account.currency || null,
        leverage: finite(num(account.leverage)) ? num(account.leverage) : null,
        account_type: account.account_type || null
      },
      copier: {
        version: healthBlock?.version || config.copierVersion || null,
        mode: healthBlock?.dry_run === true ? "dry run" : "live",
        schedule: config.schedule || null,
        heartbeat,
        last_poll_utc: heartbeat.last_poll_utc,
        last_success_utc: heartbeat.last_success_utc,
        health: healthBlock ? {
          status: healthBlock.status || "unknown",
          started_utc: iso(healthBlock.started_utc),
          finished_utc: iso(healthBlock.finished_utc),
          polls: finite(num(healthBlock.polls)) ? num(healthBlock.polls) : null,
          dry_run: healthBlock.dry_run === true,
          source: healthBlock.source || null,
          destination: healthBlock.destination || null,
          reconcile: healthBlock.reconcile || null,
          refusals,
          actions,
          closes,
          // The lifecycle the poll planned and sent, kept whole rather than reduced to counts. A reader can see the
          // broker's own answer on each row, and the verification matrix promotes a behaviour only from a row that
          // says `accepted` - never from a counter that could be incremented by a dry run or a refusal.
          stops: arrayOf(healthBlock.stops),
          pending_orders: {
            placed: arrayOf(pendingBlock.placed),
            amended: arrayOf(pendingBlock.amended),
            cancelled: arrayOf(pendingBlock.cancelled),
            checked: arrayOf(pendingBlock.checked)
          },
          order_checks: arrayOf(healthBlock.order_checks),
          reconcile_orders: healthBlock.reconcile_orders && typeof healthBlock.reconcile_orders === "object" ? healthBlock.reconcile_orders : null,
          notes: Array.isArray(healthBlock.notes) ? healthBlock.notes : []
        } : null
      },
      account: {
        balance: finite(num(account.balance)) ? num(account.balance) : null,
        equity: finite(num(account.equity)) ? num(account.equity) : null,
        equity_basis: account.equity_basis || null,
        equity_estimated: account.equity_estimated === true,
        currency: account.currency || null,
        leverage: finite(num(account.leverage)) ? num(account.leverage) : null,
        money_digits: Number.isInteger(num(account.money_digits)) ? num(account.money_digits) : null,
        open_positions: positions.length,
        pending_orders: orders.length,
        closed_trades: closedTrades.length,
        read_at_utc: snapshot.generated_at_utc || null
      },
      horizon: {
        window_days: windowDays,
        from_utc: snapshot.deals_from_utc || null,
        to_utc: snapshot.generated_at_utc || null
      },
      closed_trades: closedTrades,
      setup_tests: trades.setup_tests,
      pre_copier: trades.pre_copier,
      unattributed: trades.unattributed,
      mappings,
      differences: differences({ health: healthBlock, state: store, positions, closedTrades, symbolMap }),
      rejections,
      verification: verification({ health: healthBlock, mappings, snapshot, closedTrades }),
      symbols: symbolRows({ symbolMap, symbols, positions })
    };
  }

  return {
    SCHEMA_VERSION,
    DOCUMENT_STALE_AFTER_SECONDS,
    HEARTBEAT_STALE_AFTER_SECONDS,
    DEFAULT_WINDOW_DAYS,
    SOURCE_SYMBOLS,
    DEFAULT_SYMBOL_MAP,
    COPY_COMMENT,
    SETUP_TEST_COMMENT,
    normaliseSpec,
    lotsToNative,
    protocolUnitsToLots,
    convertSourceVolume,
    symbolRows,
    pairDeals,
    attributeTrade,
    closedTradeRows,
    performanceTrades,
    mappingRows,
    differences,
    verification,
    healthState,
    buildDocument
  };
});

