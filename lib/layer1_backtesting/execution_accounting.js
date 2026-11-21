"use strict";

/**
 * Configurable costs, sizing, equity and drawdown for the execution simulations (research only).
 *
 * The North Star already fixes the account rule: both trade simulations start at GBP 100,000 and risk 1% of
 * the running balance at the moment the order fills. This module implements that rule from
 * `contracts.ACCOUNT` rather than restating it, and it keeps the three things a trade simulation must expose
 * separate:
 *   - sizing: lots from the risk budget and the stop distance, with the clamp reported, never hidden;
 *   - costs: a declared, named schedule (spread, slippage and round-turn commission per lot) that is either
 *     the explicit zero schedule or a labelled fixture, because no broker schedule is committed here;
 *   - the account: equity after each trade, peak, max drawdown, expectancy in R and cost drag.
 *
 * A trade that cannot be sized (no stop, zero equity) is skipped with its reason. A trade that takes the
 * account below zero stops the simulation and is reported as blown: the remaining trades are not silently
 * compounded from a negative balance.
 *
 * Nothing here reads a broker, a live account or a production path.
 */

const contracts = require("../../backtester/lib/usd_layer1_backtester/contracts");

const ACCOUNTING_VERSION = "usd-l1-execution-accounting-v1";

const SIZING = Object.freeze({
  starting_balance: contracts.ACCOUNT.starting_balance,
  currency: contracts.ACCOUNT.currency,
  risk_per_trade_pct: contracts.ACCOUNT.risk_per_trade_pct,
  rule: contracts.ACCOUNT.sizing_rule,
  chronological: contracts.ACCOUNT.chronological,
  position_limits: contracts.ACCOUNT.position_limits,
  lot_step: 0.01,
  minimum_lot: 0.01,
  maximum_lot: 100
});

/**
 * The declared cost schedules.
 *
 * `zero` is a gross replay and says so. `fixture_costs` is a labelled demonstration schedule: it makes the
 * arithmetic visible without pretending to be a broker's schedule, which is not part of this checkout.
 */
const COST_MODELS = Object.freeze({
  zero: Object.freeze({
    id: "zero",
    label: "Gross, no cost applied",
    label_statement: "a gross figure; it is not a net result and is never published as one",
    per_market: Object.freeze({
      EURUSD: Object.freeze({ spread_price: 0, slippage_price: 0, commission_per_lot: 0 }),
      XAUUSD: Object.freeze({ spread_price: 0, slippage_price: 0, commission_per_lot: 0 }),
      BTCUSD: Object.freeze({ spread_price: 0, slippage_price: 0, commission_per_lot: 0 }),
      NAS100: Object.freeze({ spread_price: 0, slippage_price: 0, commission_per_lot: 0 })
    })
  }),
  fixture_costs: Object.freeze({
    id: "fixture_costs",
    label: "Labelled fixture cost schedule",
    label_statement:
      "a fixture used to demonstrate cost, sizing and drawdown; it is not a broker schedule and no performance figure may quote it as one",
    per_market: Object.freeze({
      EURUSD: Object.freeze({ spread_price: 0.00012, slippage_price: 0.00002, commission_per_lot: 4 }),
      XAUUSD: Object.freeze({ spread_price: 0.3, slippage_price: 0.05, commission_per_lot: 7 }),
      BTCUSD: Object.freeze({ spread_price: 8, slippage_price: 2, commission_per_lot: 0 }),
      NAS100: Object.freeze({ spread_price: 1, slippage_price: 0.2, commission_per_lot: 2 })
    })
  })
});

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function costSchedule(name) {
  const model = COST_MODELS[name];
  if (!model) throw new Error(`unknown cost model ${JSON.stringify(name)}; declared models are ${Object.keys(COST_MODELS).join(", ")}`);
  return model;
}

function costsFor(model, market) {
  const schedule = model && model.per_market ? model.per_market[market] : null;
  return schedule || { spread_price: 0, slippage_price: 0, commission_per_lot: 0 };
}

/** Size one trade from the running balance, the stop distance and the contract size. */
function sizeTrade({ equity, entry, stop, contract_size, sizing = SIZING } = {}) {
  if (!Number.isFinite(equity) || equity <= 0) return { lots: 0, reason: "the running balance is not positive", risk_amount: 0 };
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || entry === stop) {
    return { lots: 0, reason: "the trade has no stop distance to size against", risk_amount: 0 };
  }
  if (!Number.isFinite(contract_size) || contract_size <= 0) {
    return { lots: 0, reason: "the market has no declared contract size", risk_amount: 0 };
  }
  const riskAmount = equity * (sizing.risk_per_trade_pct / 100);
  const stopDistance = Math.abs(entry - stop);
  const riskPerLot = stopDistance * contract_size;
  const rawLots = riskAmount / riskPerLot;
  const stepped = Math.floor((rawLots + 1e-12) / sizing.lot_step) * sizing.lot_step;
  const lots = Math.min(sizing.maximum_lot, Math.max(0, round(stepped, 2)));
  const clamp = lots < sizing.minimum_lot
    ? "below_minimum_lot"
    : (rawLots > sizing.maximum_lot ? "above_maximum_lot" : (rawLots - lots >= sizing.lot_step ? "stepped_down" : null));
  return {
    lots: lots < sizing.minimum_lot ? 0 : lots,
    raw_lots: round(rawLots, 4),
    risk_per_lot: round(riskPerLot, 2),
    risk_amount: lots < sizing.minimum_lot ? 0 : round(lots * riskPerLot, 2),
    clamp,
    reason: lots < sizing.minimum_lot ? "the 1% risk budget is smaller than the minimum lot at this stop distance" : null
  };
}

/**
 * Run one set of trades through the account.
 *
 * Each trade is `{ id, market, direction, entry, stop, exit, contract_size }`, in fill order. The module
 * returns the per-trade arithmetic and the account path, so a reader can recompute any row.
 */
function accountFor({ trades = [], sizing = SIZING, costs = COST_MODELS.zero } = {}) {
  const schedule = typeof costs === "string" ? costSchedule(costs) : costs;
  let equity = sizing.starting_balance;
  let peak = equity;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  let blown = false;
  let grossTotal = 0;
  let costTotal = 0;
  let commissionTotal = 0;
  let riskedTotal = 0;
  const rows = [];
  const curve = [{ index: 0, equity: round(equity), drawdown_pct: 0 }];
  for (const [index, trade] of trades.entries()) {
    if (blown) {
      rows.push({ index, id: trade.id || null, market: trade.market || null, skipped: true, reason: "the account is already below zero; no further trade is compounded" });
      continue;
    }
    const direction = trade.direction === "short" || trade.direction === -1 ? -1 : 1;
    const contractSize = Number.isFinite(trade.contract_size) ? trade.contract_size : 1;
    const sizingResult = sizeTrade({ equity, entry: trade.entry, stop: trade.stop, contract_size: contractSize, sizing });
    if (!sizingResult.lots) {
      rows.push({ index, id: trade.id || null, market: trade.market || null, skipped: true, reason: sizingResult.reason, sizing: sizingResult });
      continue;
    }
    const marketCosts = costsFor(schedule, trade.market);
    const gross = (trade.exit - trade.entry) * direction * contractSize * sizingResult.lots;
    const spreadCost = (marketCosts.spread_price + marketCosts.slippage_price) * contractSize * sizingResult.lots;
    const commission = marketCosts.commission_per_lot * sizingResult.lots;
    const cost = spreadCost + commission;
    const net = gross - cost;
    riskedTotal += sizingResult.risk_amount;
    grossTotal += gross;
    costTotal += cost;
    commissionTotal += commission;
    equity += net;
    peak = Math.max(peak, equity);
    const drawdown = peak - equity;
    const drawdownPct = peak > 0 ? (drawdown / peak) * 100 : 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;
    const row = {
      index,
      id: trade.id || null,
      market: trade.market || null,
      direction: direction === 1 ? "long" : "short",
      lots: sizingResult.lots,
      raw_lots: sizingResult.raw_lots,
      clamp: sizingResult.clamp,
      risk_amount: sizingResult.risk_amount,
      entry: trade.entry,
      stop: trade.stop,
      exit: trade.exit,
      gross: round(gross),
      spread_cost: round(spreadCost),
      commission: round(commission),
      cost: round(cost),
      net: round(net),
      r_net: sizingResult.risk_amount > 0 ? round(net / sizingResult.risk_amount, 4) : null,
      equity_after: round(equity),
      drawdown: round(drawdown),
      drawdown_pct: round(drawdownPct, 3)
    };
    rows.push(row);
    curve.push({ index: index + 1, id: row.id, equity: row.equity_after, drawdown_pct: row.drawdown_pct });
    if (equity <= 0) blown = true;
  }
  const taken = rows.filter((row) => !row.skipped);
  const wins = taken.filter((row) => row.net > 0);
  const losses = taken.filter((row) => row.net < 0);
  const grossWins = wins.reduce((total, row) => total + row.net, 0);
  const grossLosses = Math.abs(losses.reduce((total, row) => total + row.net, 0));
  return {
    version: ACCOUNTING_VERSION,
    currency: sizing.currency,
    sizing: {
      starting_balance: sizing.starting_balance,
      risk_per_trade_pct: sizing.risk_per_trade_pct,
      lot_step: sizing.lot_step,
      minimum_lot: sizing.minimum_lot,
      maximum_lot: sizing.maximum_lot,
      rule: sizing.rule
    },
    cost_model: {
      id: schedule.id,
      label: schedule.label,
      label_statement: schedule.label_statement || null
    },
    starting_balance: sizing.starting_balance,
    final_equity: round(equity),
    return_pct: round(((equity - sizing.starting_balance) / sizing.starting_balance) * 100, 2),
    peak_equity: round(peak),
    max_drawdown: round(maxDrawdown),
    max_drawdown_pct: round(maxDrawdownPct, 2),
    blown,
    trades: rows.length,
    taken: taken.length,
    skipped: rows.length - taken.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: taken.length ? round((wins.length / taken.length) * 100, 1) : null,
    gross_total: round(grossTotal),
    cost_total: round(costTotal),
    commission_total: round(commissionTotal),
    net_total: round(grossTotal - costTotal),
    cost_drag_pct: grossTotal !== 0 ? round((costTotal / Math.abs(grossTotal)) * 100, 2) : null,
    risked_total: round(riskedTotal),
    expectancy_r: taken.length ? round(taken.reduce((total, row) => total + (row.r_net || 0), 0) / taken.length, 4) : null,
    profit_factor: grossLosses > 0 ? round(grossWins / grossLosses, 2) : null,
    rows,
    equity_curve: curve,
    statement:
      "Equity moves after each filled trade in fill order; drawdown is measured from the running peak, and a trade the risk budget cannot size is skipped with its reason rather than forced to a minimum lot."
  };
}

/** Adapt frozen path simulations (tests 3 and 4) into the trade rows the account consumes. */
function tradesFromPaths(paths, { market } = {}) {
  const contractSizeFor = (key) => {
    if (key === "XAUUSD") return 100;
    if (key === "BTCUSD") return 1;
    if (key === "NAS100") return 1;
    return 100000;
  };
  return (paths || [])
    .filter((path) => path && path.filled === true && Number.isFinite(path.entry) && Number.isFinite(path.exit))
    .map((path, index) => ({
      id: `${market || path.rule || "path"}-${index + 1}`,
      market,
      direction: path.direction === "short" ? "short" : "long",
      entry: path.entry,
      stop: path.stop,
      exit: path.exit,
      contract_size: contractSizeFor(market)
    }));
}

module.exports = {
  ACCOUNTING_VERSION,
  SIZING,
  COST_MODELS,
  costSchedule,
  costsFor,
  sizeTrade,
  accountFor,
  tradesFromPaths
};
