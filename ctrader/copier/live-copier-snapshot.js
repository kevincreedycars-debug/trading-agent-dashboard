// One read of the cTrader account the copier fills, written as a file for the dashboard builder.
//
// It is deliberately a separate process from the copier: the copier's job is to send as little as possible,
// while this read is a wide, read-only statement - the balance, every open position, every working order, the
// deals of the last N days, and each symbol's own contract. Nothing here calls an order function; the relay's
// adapter validates the account identity and the transport's own helpers convert each volume through the scale
// of the symbol it belongs to, so a EURUSD deal cannot be reported as a BTCUSD-sized one.
//
//   node live-copier-snapshot.js --vault <vault.json> --login 7348195 --confirm-account 42585819 \
//     --symbols <symbols.json> --out <snapshot.json> [--days 30]
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const RELAY_DIR = process.env.CTRADER_RELAY_DIR || "C:/ctrader-relay";
const run = require(path.join(RELAY_DIR, "CTRADER_RUN_20261114.js"));
const secrets = require(path.join(RELAY_DIR, "CTRADER_SECRETS_20261114.js"));
const adapterModule = require(path.join(RELAY_DIR, "CTRADER_ADAPTER_20261114.js"));
const transport = require(path.join(RELAY_DIR, "CTRADER_TRANSPORT_20261114.js"));

const ASSET_LIST_REQ = 2112;

function num(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

function iso(value) {
  const ms = num(value);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

function round(value, places) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function parseArgs(argv) {
  const options = { days: 30, symbols: null, out: null };
  const queue = argv.slice();
  const take = () => (queue.length ? queue.shift() : null);
  while (queue.length) {
    const arg = queue.shift();
    if (arg === "--vault") options.vault = take();
    else if (arg === "--login") options.login = Number(take());
    else if (arg === "--confirm-account") options.confirm = take();
    else if (arg === "--symbols") options.symbols = take();
    else if (arg === "--out") options.out = take();
    else if (arg === "--days") options.days = Number(take());
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!options.vault || !Number.isInteger(options.login) || !options.out) {
    throw new Error("--vault, --login and --out are required");
  }
  return options;
}

function readSymbolMap(file) {
  if (!file) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return parsed && parsed.map && typeof parsed.map === "object" ? parsed.map : parsed;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  return snapshot(options).then((document) => {
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    const temporary = `${options.out}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, options.out);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      out: options.out,
      generated_at_utc: document.generated_at_utc,
      balance: document.account.balance,
      positions: document.positions.length,
      orders: document.orders.length,
      deals: document.deals.length,
      symbols: Object.keys(document.symbols)
    })}\n`);
    return 0;
  });
}

async function snapshot(options) {
  const symbolMap = readSymbolMap(options.symbols);
  const wantedNames = new Set(Object.values(symbolMap || {}).filter(Boolean));
  const store = secrets.createDpapiStore({
    runPowerShell: secrets.createPowerShellRunner(),
    user: process.env.USERNAME || null
  });
  const prepared = await run.prepareCredentials({ vaultPath: options.vault, store, fs });
  const connection = await run.openConnection({ config: { vaultPath: options.vault, login: options.login } });
  try {
    const connected = await adapterModule.connectAccount({
      session: connection.session,
      clientId: prepared.credentials.clientId,
      clientSecret: prepared.credentials.clientSecret,
      accessToken: prepared.credentials.accessToken,
      traderLogin: options.login,
      expectLive: false
    });
    if (options.confirm && String(connected.accountId) !== String(options.confirm)) {
      throw new Error(`login ${options.login} is account ${connected.accountId}, not the confirmed ${options.confirm}`);
    }
    const accountId = Number(connected.accountId);
    const client = adapterModule.createAdapter({
      session: connection.session,
      events: connection.events,
      account: connected.account,
      config: { pollMs: 1000, spotMaxAgeMs: 15000, spotTimeoutMs: 20000 }
    });
    const trader = await client.getAccount();
    const moneyDigits = Number.isInteger(trader.moneyDigits) ? trader.moneyDigits : 8;
    const money = (value) => (value === undefined || value === null ? null : transport.moneyFromProtocol(value, moneyDigits));
    const to = Date.now();
    const from = to - Math.max(1, options.days) * 24 * 3600 * 1000;

    const reconcile = await connection.session.call(transport.PAYLOAD.reconcileReq, { ctidTraderAccountId: accountId });
    const rawPositions = (reconcile && reconcile.position) || [];
    const rawOrders = (reconcile && reconcile.order) || [];
    const dealList = await connection.session.call(transport.PAYLOAD.dealListReq, {
      ctidTraderAccountId: accountId,
      fromTimestamp: from,
      toTimestamp: to,
      maxRows: 500
    });
    const rawDeals = (dealList && dealList.deal) || [];

    const symbolIds = new Set();
    for (const row of [...rawPositions, ...rawOrders, ...rawDeals]) {
      const id = num(row.symbolId ?? (row.tradeData || {}).symbolId);
      if (Number.isFinite(id)) symbolIds.add(id);
    }
    // The symbol id is the only key the market data carries; the name lives in the account's own symbol list.
    // The list is read first and the full entities after it, so a spec is always named by the broker rather than
    // by whatever a caller hoped the symbol was called.
    const names = new Map();
    try {
      const list = await connection.session.call(transport.PAYLOAD.symbolsListReq, { ctidTraderAccountId: accountId });
      for (const row of (list && list.symbol) || []) {
        names.set(Number(row.symbolId), row.symbolName || null);
      }
    } catch (error) {
      process.stderr.write(`symbol list: ${(error && error.code) || error}\n`);
    }
    const byId = new Map();
    if (symbolIds.size) {
      const entities = await connection.session.call(transport.PAYLOAD.symbolByIdReq, {
        ctidTraderAccountId: accountId,
        symbolId: [...symbolIds]
      });
      for (const entity of (entities && entities.symbol) || []) {
        const spec = transport.symbolSpec(entity);
        byId.set(Number(spec.symbolId), { ...spec, symbol: names.get(Number(spec.symbolId)) || spec.symbol });
      }
    }
    for (const name of wantedNames) {
      try {
        const spec = await client.getSymbolSpec(name);
        if (!byId.has(Number(spec.symbolId))) byId.set(Number(spec.symbolId), spec);
      } catch (error) {
        // A mapped symbol the broker will not describe is a fact the page states, not a reason to fail the read:
        // the copier refuses that copy and its own health carries the refusal.
        process.stderr.write(`symbol ${name}: ${(error && error.code) || error}\n`);
      }
    }
    const specFor = (id) => byId.get(Number(id)) || null;

    const symbols = {};
    for (const spec of byId.values()) {
      symbols[spec.symbol] = {
        symbol: spec.symbol,
        symbol_id: spec.symbolId,
        digits: spec.digits,
        lot_units: spec.lotSizeBtc,
        protocol_units_per_lot: spec.volumeScale,
        volume_step: spec.volumeStep,
        min_volume: spec.minVolume,
        max_volume: spec.maxVolume,
        trade_mode: spec.tradeMode
      };
    }

    const references = {};
    for (const name of Object.keys(symbols)) {
      try {
        const price = await client.getReferencePrice(name);
        if (Number.isFinite(Number(price))) references[name] = Number(price);
      } catch (error) {
        process.stderr.write(`reference ${name}: ${(error && error.code) || error}\n`);
      }
    }


    const positions = rawPositions.map((position) => {
      const trade = position.tradeData || {};
      const spec = specFor(trade.symbolId);
      const protocol = num(trade.volume);
      return {
        position_id: String(position.positionId),
        symbol: spec ? spec.symbol : null,
        symbol_id: num(trade.symbolId),
        side: num(trade.tradeSide) === transport.TRADE_SIDE.sell ? "sell" : "buy",
        volume_lots: spec ? round(protocol / spec.volumeScale, 8) : null,
        protocol_units: Number.isFinite(protocol) ? protocol : null,
        base_units: Number.isFinite(protocol) ? round(protocol / 100, 6) : null,
        entry_price: num(position.price),
        stop_price: position.stopLoss === undefined ? null : num(position.stopLoss),
        target_price: position.takeProfit === undefined ? null : num(position.takeProfit),
        open_time_utc: iso(trade.openTimestamp),
        comment: trade.comment || null
      };
    });

    const orders = rawOrders.map((order) => {
      const trade = order.tradeData || {};
      const spec = specFor(trade.symbolId);
      const protocol = num(trade.volume);
      return {
        order_id: String(order.orderId),
        symbol: spec ? spec.symbol : null,
        side: num(trade.tradeSide) === transport.TRADE_SIDE.sell ? "sell" : "buy",
        volume_lots: spec ? round(protocol / spec.volumeScale, 8) : null,
        order_type: num(order.orderType),
        price: num(order.limitPrice ?? order.executionPrice),
        stop_price: order.stopLoss === undefined ? null : num(order.stopLoss),
        target_price: order.takeProfit === undefined ? null : num(order.takeProfit),
        client_order_id: order.clientOrderId || null
      };
    });

    const deals = rawDeals.map((deal) => {
      const detail = deal.closePositionDetail || null;
      const spec = specFor(deal.symbolId);
      const protocol = num(deal.filledVolume ?? deal.volume);
      return {
        deal_id: String(deal.dealId),
        order_id: String(deal.orderId),
        position_id: String(deal.positionId),
        symbol: spec ? spec.symbol : null,
        side: num(deal.tradeSide) === transport.TRADE_SIDE.sell ? "sell" : "buy",
        volume_lots: spec ? round(protocol / spec.volumeScale, 8) : null,
        protocol_units: Number.isFinite(protocol) ? protocol : null,
        price: num(deal.executionPrice),
        time_utc: iso(deal.executionTimestamp),
        commission: money(detail ? detail.commission : deal.commission),
        swap: detail ? money(detail.swap) : null,
        gross_profit: detail ? money(detail.grossProfit) : null,
        balance: detail ? money(detail.balance) : null,
        closing: detail !== null,
        comment: deal.comment || null
      };
    });

    // Equity is marked, not read: cTrader's trader message carries the balance, so equity here is that balance
    // plus each open position valued at the broker's own reference price. The basis travels with the number.
    let unrealised = 0;
    let marked = 0;
    for (const position of positions) {
      const spec = position.symbol ? symbols[position.symbol] : null;
      const reference = position.symbol ? num(references[position.symbol]) : Number.NaN;
      if (!spec || !Number.isFinite(reference) || !Number.isFinite(position.entry_price) || !Number.isFinite(position.volume_lots)) continue;
      const direction = position.side === "buy" ? 1 : -1;
      unrealised += (reference - position.entry_price) * direction * position.volume_lots * spec.lot_units;
      marked += 1;
    }

    let currency = null;
    try {
      const assets = await connection.session.call(ASSET_LIST_REQ, { ctidTraderAccountId: accountId });
      const deposit = (assets && assets.asset || []).find((row) => Number(row.assetId) === Number(trader.depositAssetId));
      currency = (deposit && deposit.name) || null;
    } catch (error) {
      // The currency is cosmetic; a failure to read the asset list is stated rather than fatal.
      process.stderr.write(`asset list: ${(error && error.code) || error}\n`);
    }

    return {
      schema_version: "ctrader-account-snapshot-v1",
      generated_at_utc: new Date(to).toISOString(),
      read_only: true,
      order_functions_called: false,
      account: {
        account_id: String(accountId),
        login: options.login,
        broker: trader.broker || null,
        environment: connected.account.isLive === true ? "live" : "demo",
        is_live: connected.account.isLive === true,
        currency,
        balance: trader.balance,
        equity: Number.isFinite(trader.balance) ? round(trader.balance + unrealised, 2) : null,
        equity_basis: "broker balance plus the open positions marked at the broker's own reference price",
        equity_estimated: true,
        marked_positions: marked,
        leverage: trader.leverage,
        money_digits: moneyDigits,
        account_type: trader.accountType,
        connected: true
      },
      symbols,
      references,
      positions,
      orders,
      deals,
      deals_from_utc: new Date(from).toISOString()
    };
  } finally {
    if (typeof connection.close === "function") connection.close();
    else if (connection.session && typeof connection.session.close === "function") connection.session.close();
  }
}

module.exports = { snapshot, parseArgs };

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    process.stderr.write(`failed: ${(error && error.code) || "error"}: ${(error && error.message) || error}\n`);
    process.exitCode = 1;
  });
}

