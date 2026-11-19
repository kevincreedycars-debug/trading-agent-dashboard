// The cTrader copier's data surface, held at the numbers a broker statement can be checked against.
//
// The rules under test are the ones the tab cannot re-derive: a size converted through each symbol's own
// contract rather than one scale for every instrument, a setup-test close kept in the account history and out
// of the copier's figures, a mapping that only exists while the broker still shows the position, and a
// verification state that says "tested" where only fixtures have run and "broker_observed" where the broker has
// answered.
const test = require("node:test");
const assert = require("node:assert/strict");

const lib = require("../lib/live_ctrader_copier.js");
const { validateLiveCtraderCopier } = require("../scripts/validate_live_ctrader_copier.js");
const builder = require("../scripts/build-live-ctrader-copier.js");

const NOW = new Date("2026-11-19T20:40:00.000Z");

// The contracts the demo account actually returned, plus the index at the shape its own list gives it. The
// index's name is data: this fixture uses the cTrader name the deployed symbols file carries.
const SPECS = {
  EURUSD: { symbol: "EURUSD", digits: 5, lot_units: 100000, protocol_units_per_lot: 10000000, volume_step: 0.01, min_volume: 0.01, max_volume: 1000, trade_mode: "full" },
  XAUUSD: { symbol: "XAUUSD", digits: 2, lot_units: 100, protocol_units_per_lot: 10000, volume_step: 0.01, min_volume: 0.01, max_volume: 100000, trade_mode: "full" },
  BTCUSD: { symbol: "BTCUSD", digits: 2, lot_units: 1, protocol_units_per_lot: 100, volume_step: 0.01, min_volume: 0.01, max_volume: 100, trade_mode: "full" },
  "US100.cash": { symbol: "US100.cash", digits: 1, lot_units: 1, protocol_units_per_lot: 100, volume_step: 0.1, min_volume: 0.1, max_volume: 100, trade_mode: "full" }
};

function healthFixture(overrides = {}) {
  return {
    schema: 1,
    version: "copier-20261119.1",
    status: "ok",
    started_utc: "2026-11-19T20:39:58.000Z",
    finished_utc: "2026-11-19T20:39:59.000Z",
    dry_run: false,
    refusals: [],
    actions: [],
    closes: [],
    source: {
      ok: true,
      account: { login: 511428614, server: "FTMO-Server" },
      positions: 2,
      cause: null,
      probed_at_utc: "2026-11-19T20:39:58.900Z",
      rows: [
        { ticket: "309101669", symbol: "XAUUSD", side: "sell", volume: 0.01, entry: 3667.25, stop: 3704.29 },
        { ticket: "309180633", symbol: "EURUSD", side: "sell", volume: 0.01, entry: 1.09756, stop: 1.09865 }
      ]
    },
    destination: { account_id: "42585819", symbols: ["XAUUSD", "EURUSD"], references: { XAUUSD: 3670.1, EURUSD: 1.09762 } },
    notes: [],
    reconcile: { checked: 0, mapped: 0, dropped: 0 },
    polls: 1,
    ...overrides
  };
}

function stateFixture() {
  return {
    schema: 1,
    version: "copier-20261119.1",
    mappings: {
      "309101669": {
        source_ticket: "309101669",
        source_symbol: "XAUUSD",
        symbol: "XAUUSD",
        side: "sell",
        volume: 0.01,
        stop_price: 3704.74,
        target_position_id: "62272218",
        targetPositionId: "62272218",
        request_id: "copy-309101669",
        copied_utc: "2026-11-19T20:11:00.213Z",
        reconciled: true
      },
      "309180633": {
        source_ticket: "309180633",
        source_symbol: "EURUSD",
        symbol: "EURUSD",
        side: "sell",
        volume: 0.01,
        stop_price: 1.09866,
        target_position_id: "62272219",
        targetPositionId: "62272219",
        request_id: "copy-309180633",
        copied_utc: "2026-11-19T20:11:00.224Z",
        reconciled: true
      }
    },
    pending: {},
    attempts: {},
    history: [],
    updated_utc: "2026-11-19T20:17:38.597Z"
  };
}

function snapshotFixture() {
  return {
    schema_version: "ctrader-account-snapshot-v1",
    generated_at_utc: "2026-11-19T20:39:57.000Z",
    read_only: true,
    order_functions_called: false,
    account: {
      account_id: "42585819",
      login: 7348195,
      broker: "FTMO Global Markets",
      environment: "demo",
      is_live: false,
      currency: "USD",
      balance: 100000,
      equity: 99996.4,
      equity_basis: "balance plus open positions marked at the broker's reference price",
      equity_estimated: true,
      leverage: 100,
      money_digits: 8,
      account_type: "hedging",
      connected: true
    },
    symbols: SPECS,
    references: { XAUUSD: 3670.1, EURUSD: 1.09762 },
    positions: [
      { position_id: "62272218", symbol: "XAUUSD", side: "sell", volume_lots: 0.01, entry_price: 3667.25, stop_price: 3704.74, target_price: null, open_time_utc: "2026-11-19T20:11:00.000Z", comment: "copy-309101669" },
      { position_id: "62272219", symbol: "EURUSD", side: "sell", volume_lots: 0.01, entry_price: 1.09756, stop_price: 1.09866, target_price: null, open_time_utc: "2026-11-19T20:11:00.000Z", comment: "copy-309180633" }
    ],
    orders: [],
    deals: [
      { deal_id: "1", position_id: "62272218", symbol: "XAUUSD", side: "sell", volume_lots: 0.01, price: 3667.25, time_utc: "2026-11-19T20:11:00.000Z", commission: -0.1, swap: 0, gross_profit: null, closing: false, comment: "copy-309101669" },
      { deal_id: "2", position_id: "62272219", symbol: "EURUSD", side: "sell", volume_lots: 0.01, price: 1.09756, time_utc: "2026-11-19T20:11:00.100Z", commission: -0.12, swap: 0, gross_profit: null, closing: false, comment: "copy-309180633" },
      { deal_id: "3", position_id: "62271001", symbol: "BTCUSD", side: "buy", volume_lots: 0.01, price: 90000, time_utc: "2026-11-13T12:00:00.000Z", commission: -0.01, swap: 0, gross_profit: null, closing: false, comment: "tech-conn-test-ctrader" },
      { deal_id: "4", position_id: "62271001", symbol: "BTCUSD", side: "buy", volume_lots: 0.01, price: 90010, time_utc: "2026-11-13T12:02:31.000Z", commission: 0, swap: 0, gross_profit: 0.32, closing: true, comment: "tech-conn-test-ctrader" }
    ],
    deals_from_utc: "2026-10-20T20:39:57.000Z"
  };
}

test("a lot is converted through the symbol's own contract, not one scale for every instrument", () => {
  // The defect this rule exists for: EURUSD 0.01 lot read through the BTCUSD scale is 1,000, not 0.01. Each
  // instrument states its own three numbers, and the same 0.01 lot lands on a different wire volume for each.
  const eur = lib.lotsToNative({ lots: 0.01, spec: SPECS.EURUSD });
  const gold = lib.lotsToNative({ lots: 0.01, spec: SPECS.XAUUSD });
  const btc = lib.lotsToNative({ lots: 0.01, spec: SPECS.BTCUSD });
  const index = lib.lotsToNative({ lots: 0.1, spec: SPECS["US100.cash"] });
  assert.deepEqual(eur, { volume_lots: 0.01, protocol_units: 100000, base_units: 1000 });
  assert.deepEqual(gold, { volume_lots: 0.01, protocol_units: 100, base_units: 1 });
  assert.deepEqual(btc, { volume_lots: 0.01, protocol_units: 1, base_units: 0.01 });
  assert.deepEqual(index, { volume_lots: 0.1, protocol_units: 10, base_units: 0.1 });
  assert.equal(lib.protocolUnitsToLots({ protocolUnits: 100000, spec: SPECS.EURUSD }), 0.01);
  // A contract that was never read is not a size: the conversion says so instead of falling back to BTCUSD.
  assert.deepEqual(lib.lotsToNative({ lots: 0.01, spec: {} }), { volume_lots: null, protocol_units: null, base_units: null });
});

test("the source conversion floors to the destination step and refuses below its minimum", () => {
  // 0.30 lots of a 100-unit contract is 30 units of gold; cTrader's 0.01 step carries that exactly.
  const gold = lib.convertSourceVolume({ sourceLots: 0.3, sourceContractSize: 100, spec: SPECS.XAUUSD });
  assert.equal(gold.ok, true);
  assert.equal(gold.lots, 0.3);
  // One lot of a 100,000-unit contract is one lot of EURUSD; a 0.005 lot copy would be refused rather than
  // rounded up, because a copy larger than the source trade is a different trade.
  const eur = lib.convertSourceVolume({ sourceLots: 0.005, sourceContractSize: 100000, spec: SPECS.EURUSD });
  assert.equal(eur.ok, false);
  assert.equal(eur.cause, "volume_below_target_minimum");
  // A destination whose step is coarser than the wanted size floors down, never up.
  const coarse = lib.convertSourceVolume({ sourceLots: 0.15, sourceContractSize: 1, spec: { lot_units: 1, protocol_units_per_lot: 100, volume_step: 0.1, min_volume: 0.1 } });
  assert.equal(coarse.ok, true);
  assert.equal(coarse.lots, 0.1);
  // 0.055 lots floors to nothing on that step, so it is refused rather than sent as a zero-size order.
  assert.equal(lib.convertSourceVolume({ sourceLots: 0.055, sourceContractSize: 1, spec: { lot_units: 1, protocol_units_per_lot: 100, volume_step: 0.1, min_volume: 0.1 } }).ok, false);
});

test("the symbol table states the index mapping and each mapped contract", () => {
  const rows = lib.symbolRows({ symbolMap: lib.DEFAULT_SYMBOL_MAP, symbols: SPECS, positions: [{ symbol: "EURUSD" }] });
  assert.equal(rows.length, 4);
  const index = rows.find((row) => row.source_symbol === "US100.cash");
  assert.equal(index.target_symbol, "US100.cash");
  assert.equal(index.mapped, true);
  assert.equal(index.protocol_units_per_lot, 100);
  assert.equal(index.held, false);
  assert.equal(rows.find((row) => row.source_symbol === "EURUSD").held, true);
  // A symbol mapped to null is a deliberate exclusion, not a missing rule.
  const excluded = lib.symbolRows({ symbolMap: { ...lib.DEFAULT_SYMBOL_MAP, BTCUSD: null }, symbols: SPECS });
  assert.equal(excluded.find((row) => row.source_symbol === "BTCUSD").excluded, true);
  assert.equal(excluded.find((row) => row.source_symbol === "BTCUSD").mapped, false);
});

test("a setup test stays in the account history and out of the copier's figures", () => {
  const closed = lib.closedTradeRows(snapshotFixture().deals, { mappings: stateFixture().mappings });
  assert.equal(closed.length, 1);
  const trade = closed[0];
  assert.equal(trade.copy_kind, "setup-test");
  assert.equal(trade.copy_label, "Standalone setup test");
  assert.equal(trade.net_profit, 0.31, "profit 0.32 plus commission -0.01 is the account's own net");
  assert.equal(trade.duration_seconds, 151);
  const performance = lib.performanceTrades(closed);
  assert.equal(performance.copies.length, 0);
  assert.deepEqual(performance.setup_tests, { trades: 1, net: 0.31, position_ids: ["62271001"] });

  // The account's own proof trades are commented `btc-test-120s`; they are setup tests too, not unattributed
  // closes, which is the difference between "the copier did this" and "somebody proved the order path".
  const proof = lib.attributeTrade({ position_id: "62201543", comment: "btc-test-120s" }, {});
  assert.equal(proof.kind, "setup-test");

  // A close that predates the copier's first copy is the account's own earlier trading: it keeps its place in
  // the history, is labelled, and is not counted as an unexplained difference or as a copier trade.
  const before = lib.attributeTrade(
    { position_id: "61000000", comment: "", closed: { time_utc: "2026-10-01T10:00:00Z" } },
    { copierStartUtc: "2026-11-19T20:11:00Z" }
  );
  assert.equal(before.kind, "pre-copier");
  assert.equal(before.label, "Before the copier");
});


test("a copy is attributed by the store first, then by its own comment, and an unknown close is named", () => {
  const deals = [
    { position_id: "900", symbol: "EURUSD", side: "sell", volume_lots: 0.01, price: 1.1, time_utc: "2026-11-19T10:00:00Z", commission: -0.1, closing: false, comment: "copy-111" },
    { position_id: "900", symbol: "EURUSD", side: "sell", volume_lots: 0.01, price: 1.099, time_utc: "2026-11-19T10:30:00Z", commission: 0, gross_profit: 1.0, closing: true, comment: "copy-111" },
    { position_id: "901", symbol: "XAUUSD", side: "buy", volume_lots: 0.01, price: 3600, time_utc: "2026-11-19T11:00:00Z", commission: 0, closing: false, comment: "copy-222" },
    { position_id: "901", symbol: "XAUUSD", side: "buy", volume_lots: 0.01, price: 3590, time_utc: "2026-11-19T12:00:00Z", commission: 0, gross_profit: -10, closing: true, comment: "copy-222" },
    { position_id: "902", symbol: "BTCUSD", side: "buy", volume_lots: 0.01, price: 90000, time_utc: "2026-11-19T09:00:00Z", commission: 0, closing: false, comment: "hand close" },
    { position_id: "902", symbol: "BTCUSD", side: "buy", volume_lots: 0.01, price: 90000, time_utc: "2026-11-19T09:10:00Z", commission: 0, gross_profit: 0, closing: true, comment: "hand close" }
  ];
  const closed = lib.closedTradeRows(deals, {
    mappings: { "309180633": { source_ticket: "309180633", target_position_id: "900" } },
    history: [{ source_ticket: "309101669", target_position_id: "901", symbol: "XAUUSD" }]
  });
  assert.deepEqual(closed.map((row) => row.copy_kind), ["unattributed", "copy", "copy"], "the rows are in close order, so the earliest close is first");
  assert.equal(closed[1].source_ticket, "309180633");
  assert.equal(closed[2].source_ticket, "309101669");
  assert.equal(closed[0].copy_label, "Not a copy");
  const performance = lib.performanceTrades(closed);
  assert.equal(performance.copies.length, 2);
  assert.equal(performance.copies[0].net_profit, 0.9, "profit 1.0 plus commission -0.1");
  assert.equal(closed[0].net_profit, 0, "a flat close is neither a win nor a loss, and is kept");
  assert.equal(performance.setup_tests.trades, 0);
  assert.equal(performance.unattributed.trades, 1);
});

test("the mapping table states lots, wire units and asset units, and only claims an open copy when the broker shows it", () => {
  const rows = lib.mappingRows({
    mappings: stateFixture().mappings,
    pending: { "309999999": { request_id: "copy-309999999", at_utc: "2026-11-19T20:30:00Z", source_symbol: "EURUSD", symbol: "EURUSD", side: "buy", volume: 0.01, stop_price: 1.1 } },
    positions: [snapshotFixture().positions[1]],
    symbols: SPECS
  });
  const open = rows.find((row) => row.source_ticket === "309180633");
  assert.equal(open.status, "open");
  assert.equal(open.target_position_id, "62272219");
  assert.equal(open.volume_lots, 0.01);
  assert.equal(open.protocol_units, 100000);
  assert.equal(open.base_units, 1000);
  assert.equal(open.expiry_utc, null, "a market order carries no expiry, and the field says so explicitly");
  const lost = rows.find((row) => row.source_ticket === "309101669");
  assert.equal(lost.status, "not_open");
  assert.match(lost.status_detail, /broker read no open position/);
  assert.equal(lost.protocol_units, 100);
  const pending = rows.find((row) => row.source_ticket === "309999999");
  assert.equal(pending.status, "pending");
  assert.equal(pending.protocol_units, 100000);
});

test("the differences are the disagreements between the source, the store and the broker", () => {
  const state = stateFixture();
  state.mappings["309101669"].target_position_id = "62279999";
  const result = lib.differences({
    health: healthFixture({ source: { ...healthFixture().source, rows: [
      { ticket: "309180633", symbol: "EURUSD", side: "sell", volume: 0.01 },
      { ticket: "309101669", symbol: "XAUUSD", side: "sell", volume: 0.01 },
      { ticket: "309555555", symbol: "EURUSD", side: "buy", volume: 0.01 }
    ] } }),
    state,
    positions: [snapshotFixture().positions[1]],
    closedTrades: [{ position_id: "902", symbol: "BTCUSD", copy_kind: "unattributed", closed: { time_utc: "2026-11-19T09:00:00Z" }, net_profit: 0 }],
    symbolMap: lib.DEFAULT_SYMBOL_MAP
  });
  assert.equal(result.missing_copies.length, 1);
  assert.equal(result.missing_copies[0].source_ticket, "309555555");
  assert.equal(result.orphaned_mappings.length, 1);
  assert.equal(result.orphaned_mappings[0].source_ticket, "309101669");
  assert.equal(result.unattributed_closes.length, 1);
  assert.equal(result.count, 3);
});


test("the verification matrix separates what the broker answered from what only fixtures have exercised", () => {
  const open = lib.verification({ health: healthFixture(), mappings: lib.mappingRows({ mappings: stateFixture().mappings, positions: snapshotFixture().positions, symbols: SPECS }), snapshot: snapshotFixture() });
  const byName = Object.fromEntries(open.map((row) => [row.behaviour, row.state]));
  assert.equal(byName["Copying a filled FTMO-1 position"], "broker_observed");
  assert.equal(byName["Size conversion through the destination contract"], "broker_observed");
  assert.equal(byName["Stop carried at entry"], "broker_observed");
  assert.equal(byName["Amending a stop or target after the copy"], "not_sent");
  assert.equal(byName["Cancelling a resting source order"], "not_sent");
  assert.equal(byName["Partial close on the source"], "not_sent");
  assert.equal(byName["Full close after a source exit"], "awaiting_live_proof", "no close has been observed, so the live path stays unproved");
  assert.match(open.find((row) => row.behaviour === "Copying a filled FTMO-1 position").detail, /#62272218 XAUUSD sell 0.01 lot/);
  // The size row quotes the wire numbers the regression actually reads, not a rounded story about them.
  const sizeRow = open.find((row) => row.behaviour === "Size conversion through the destination contract");
  assert.match(sizeRow.detail, /EURUSD as 100,000/);
  assert.match(sizeRow.detail, /XAUUSD as 100,/);
  assert.match(sizeRow.detail, /BTCUSD as 1 /);

  const closed = lib.verification({
    health: healthFixture({ closes: [{ type: "close", ticket: "309101669", symbol: "XAUUSD", positionId: "62272218", outcome: "accepted", sent: true }] }),
    mappings: [{ source_ticket: "309101669", target_position_id: "62272218", symbol: "XAUUSD", status: "closed", volume_lots: 0.01 }],
    snapshot: snapshotFixture()
  });
  assert.equal(closed.find((row) => row.behaviour === "Full close after a source exit").state, "broker_observed");

  // A close is also proved by the account's own deals once the mapping has moved to history: the health file only
  // covers the poll that did it, and the next poll overwrites it.
  const fromDeals = lib.verification({
    health: healthFixture({ closes: [] }),
    mappings: [{ source_ticket: "309101669", target_position_id: "62272218", symbol: "XAUUSD", status: "closed", volume_lots: 0.01 }],
    snapshot: snapshotFixture(),
    closedTrades: [{ position_id: "62272218", symbol: "XAUUSD", copy_kind: "copy", price_close: 3661.05, net_profit: 5.98, closed: { time_utc: "2026-11-19T21:42:34.000Z" } }]
  });
  const fullClose = fromDeals.find((row) => row.behaviour === "Full close after a source exit");
  assert.equal(fullClose.state, "broker_observed");
  assert.match(fullClose.detail, /#62272218 XAUUSD closed at 3661\.05 on 2026-11-19T21:42:34\.000Z, net 5\.98/);
});

test("the heartbeat is one word the file can defend", () => {
  assert.equal(lib.healthState({ health: healthFixture(), now: NOW }).state, "ok");
  const stale = lib.healthState({ health: healthFixture({ finished_utc: "2026-11-19T20:00:00.000Z" }), now: NOW });
  assert.equal(stale.state, "stale");
  assert.match(stale.detail, /outside the 1500s/);
  assert.equal(lib.healthState({ health: healthFixture({ status: "failed", notes: ["the probe printed no document"] }), now: NOW }).state, "error");
  assert.equal(lib.healthState({ health: healthFixture({ status: "killed" }), now: NOW }).state, "killed");
  assert.equal(lib.healthState({ health: null, now: NOW }).state, "missing");
  // A failed poll is not a success even if it happened a second ago.
  assert.equal(lib.healthState({ health: healthFixture({ status: "failed" }), now: NOW }).last_success_utc, null);
});


test("the built document passes its own validator and states the account, the copies and the unproved close", () => {
  const document = lib.buildDocument({
    health: healthFixture(),
    state: stateFixture(),
    snapshot: snapshotFixture(),
    now: NOW,
    config: {
      login: 7348195,
      lane: "ftmo-1",
      laneLabel: "FTMO account 1",
      accountLoginMasked: "***614",
      accountServer: "FTMO-Server",
      symbolMap: lib.DEFAULT_SYMBOL_MAP,
      schedule: { cadence_seconds: 60, description: "one --once poll every 60s" }
    }
  });
  assert.deepEqual(validateLiveCtraderCopier(document), []);
  assert.equal(document.schema_version, "live-ctrader-copier-v1");
  assert.equal(document.generated_at_utc, NOW.toISOString());
  assert.equal(document.account.balance, 100000);
  assert.equal(document.account.equity, 99996.4);
  assert.equal(document.account.open_positions, 2);
  assert.equal(document.account.pending_orders, 0);
  assert.equal(document.account.closed_trades, 1);
  assert.equal(document.copier.heartbeat.state, "ok");
  assert.equal(document.copier.schedule.cadence_seconds, 60);
  assert.equal(document.mappings.length, 2);
  assert.equal(document.mappings[0].protocol_units, 100, "XAUUSD 0.01 lot on its own 100-unit contract");
  assert.equal(document.mappings[1].protocol_units, 100000, "EURUSD 0.01 lot on its own 100,000-unit contract");
  assert.equal(document.setup_tests.trades, 1);
  assert.equal(document.differences.count, 0);
  assert.equal(document.symbols.find((row) => row.source_symbol === "US100.cash").mapped, true);
  assert.equal(document.verification.find((row) => row.behaviour === "Full close after a source exit").state, "awaiting_live_proof");
  // A copied close is attributed from the store's history once the ticket has left the source.
  const withHistory = lib.buildDocument({
    health: healthFixture({ closes: [{ type: "close", ticket: "309101669", positionId: "62272218", outcome: "accepted" }] }),
    state: { ...stateFixture(), mappings: { "309180633": stateFixture().mappings["309180633"] }, history: [{ source_ticket: "309101669", target_position_id: "62272218", symbol: "XAUUSD", volume: 0.01, closed_utc: "2026-11-19T20:32:00.000Z", close_outcome: "accepted" }] },
    snapshot: { ...snapshotFixture(), positions: [snapshotFixture().positions[1]] },
    now: NOW
  });
  assert.equal(withHistory.mappings.find((row) => row.source_ticket === "309101669").status, "closed");
  assert.equal(withHistory.verification.find((row) => row.behaviour === "Full close after a source exit").state, "broker_observed");
});

test("a document missing an instrument or a heartbeat state is refused rather than published", () => {
  const document = lib.buildDocument({ health: healthFixture(), state: stateFixture(), snapshot: snapshotFixture(), now: NOW });
  const noIndex = { ...document, symbols: document.symbols.filter((row) => row.source_symbol !== "US100.cash") };
  assert.match(validateLiveCtraderCopier(noIndex).join(";"), /no row for US100\.cash/);
  const badHeartbeat = { ...document, copier: { ...document.copier, heartbeat: { state: "banana" } } };
  assert.match(validateLiveCtraderCopier(badHeartbeat).join(";"), /copier\.heartbeat\.state/);
  const badSize = { ...document, mappings: [{ ...document.mappings[0], protocol_units: "100" }] };
  assert.match(validateLiveCtraderCopier(badSize).join(";"), /protocol_units must be a whole number/);
  assert.match(validateLiveCtraderCopier({ ...document, read_only: false }).join(";"), /read_only must be true/);
});

test("the file builder reads the three files and refuses to write a document it would not publish", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-copier-"));
  const write = (name, value) => {
    const file = path.join(directory, name);
    fs.writeFileSync(file, JSON.stringify(value), "utf8");
    return file;
  };
  const out = path.join(directory, "dashboard.json");
  const options = builder.parseArgs([
    "--snapshot", write("snapshot.json", snapshotFixture()),
    "--health", write("health.json", healthFixture()),
    "--state", write("mappings.json", stateFixture()),
    "--symbol-map", write("symbols.json", { map: lib.DEFAULT_SYMBOL_MAP }),
    "--out", out,
    "--now", NOW.toISOString()
  ]);
  const document = builder.buildFromFiles(options, { now: NOW });
  assert.deepEqual(validateLiveCtraderCopier(document), []);
  builder.writeAtomically(out, document);
  assert.equal(JSON.parse(fs.readFileSync(out, "utf8")).schema_version, "live-ctrader-copier-v1");

  // A snapshot with no account block is not an empty account; the builder throws instead of drawing zeroes.
  assert.throws(() => builder.buildFromFiles({ ...options, snapshot: write("empty.json", { positions: [] }) }, { now: NOW }), /snapshot/);
  // A missing optional health file is stated as no heartbeat, not as a build failure.
  const withoutHealth = builder.buildFromFiles({ ...options, health: path.join(directory, "absent.json") }, { now: NOW });
  assert.equal(withoutHealth.copier.heartbeat.state, "missing");
});

