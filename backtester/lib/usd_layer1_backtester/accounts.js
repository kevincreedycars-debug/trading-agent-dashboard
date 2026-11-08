"use strict";

/**
 * The four independent accounts (research only).
 *
 * Each account starts at GBP 100,000, risks 1% of its own running balance on every filled trade and is
 * processed in fill-time order across the markets. Two things are deliberately faithful to the trader
 * rule rather than convenient: the risk is taken at the fill, not at the trigger, and the position is
 * rounded to the instrument's lot step before the money moves, so a balance cannot drift through
 * fractional lots the broker would never accept.
 */

/** Round a lot size down to the instrument's step, refusing anything under its minimum. */
function roundLots(rawLots, { lotStep = 0.01, minLot = 0.01 } = {}) {
  if (!Number.isFinite(rawLots) || rawLots <= 0) return null;
  const steps = Math.floor(rawLots / lotStep + 1e-9);
  const lots = Math.round(steps * lotStep * 100) / 100;
  if (lots < minLot) return null;
  return lots;
}

/** Maximum peak-to-trough fall of a balance curve, as an amount and a percentage of the peak. */
function maxDrawdown(equityCurve, startingBalance) {
  let peak = startingBalance;
  let worstAmount = 0;
  let worstPct = 0;
  for (const point of equityCurve) {
    if (point.balance > peak) peak = point.balance;
    const fall = peak - point.balance;
    if (fall > worstAmount) {
      worstAmount = fall;
      worstPct = peak > 0 ? (fall / peak) * 100 : 0;
    }
  }
  return {
    amount: Math.round(worstAmount * 100) / 100,
    pct: Math.round(worstPct * 10000) / 10000
  };
}

/**
 * Run one account over its trades.
 *
 * @param {object} options
 * @param {object} options.account `{ id, label, geometry, model }`.
 * @param {Array} options.trades every trade in the run; the account keeps those matching its geometry.
 * @param {number} [options.startingBalance]
 * @param {number} [options.riskPct] risk per filled trade, as a percentage of the running balance.
 * @param {object} [options.instrument] `{ lotStep, minLot }`.
 */
function runAccount({ account, trades, startingBalance = 100000, riskPct = 1, instrument = {} }) {
  const ordered = trades
    .filter((trade) => trade.geometry === account.geometry)
    .slice()
    .sort((left, right) => String(left.fillTimeUtc).localeCompare(String(right.fillTimeUtc)));

  let balance = startingBalance;
  const equityCurve = [{ time: null, balance, label: "start" }];
  const skipped = [];
  const realised = [];

  for (const trade of ordered) {
    const riskPerLot = Number.isFinite(trade.riskPerLot) ? trade.riskPerLot : null;
    const riskAmount = (balance * riskPct) / 100;
    if (!Number.isFinite(trade.rGross) || !riskPerLot) {
      skipped.push({
        id: trade.id,
        sessionDate: trade.sessionDate,
        reason: trade.rGross === null || trade.rGross === undefined
          ? "the trade was still working when the tape ended, so it is carried at its open risk and not counted"
          : "the instrument's risk-per-lot is unknown, so no position size can be honoured"
      });
      continue;
    }
    const lots = roundLots(riskAmount / riskPerLot, instrument);
    if (!lots) {
      skipped.push({
        id: trade.id,
        sessionDate: trade.sessionDate,
        reason: "1% of the running balance is below one lot at this stop distance, so the trade is skipped rather than oversized"
      });
      continue;
    }
    const pnl = Math.round(lots * riskPerLot * trade.rGross * 100) / 100;
    balance = Math.round((balance + pnl) * 100) / 100;
    equityCurve.push({
      time: trade.fillTimeUtc,
      balance,
      label: trade.id,
      sessionDate: trade.sessionDate,
      r: trade.rGross,
      pnl
    });
    realised.push({ ...trade, lots, riskAmount: Math.round(lots * riskPerLot * 100) / 100, pnl, balanceAfter: balance });
  }

  const wins = realised.filter((trade) => trade.rGross > 0).length;
  const losses = realised.filter((trade) => trade.rGross < 0).length;
  const totalR = realised.reduce((sum, trade) => sum + trade.rGross, 0);

  return {
    id: account.id,
    label: account.label,
    geometry: account.geometry,
    model: account.model,
    starting_balance: startingBalance,
    currency: "GBP",
    risk_per_trade_pct: riskPct,
    fills: realised.length,
    wins,
    losses,
    flat_trades: realised.filter((trade) => trade.rGross === 0).length,
    average_r: realised.length ? Math.round((totalR / realised.length) * 10000) / 10000 : null,
    total_r: Math.round(totalR * 10000) / 10000,
    ending_balance: balance,
    return_pct: Math.round(((balance / startingBalance) - 1) * 10000) / 100,
    max_drawdown: maxDrawdown(equityCurve, startingBalance),
    equity_curve: equityCurve,
    trades: realised,
    skipped
  };
}

/**
 * Run the four accounts the brief names: current/full, challenger/full, current/half and challenger/half.
 *
 * `callSource` travels with each account so the panel can say, in words, whose call produced the trades.
 */
function runFourAccounts({ trades, accounts, startingBalance, riskPct, instrument }) {
  return accounts.map((account) =>
    runAccount({ account, trades, startingBalance, riskPct, instrument }));
}

/** The standard four slots. */
const FOUR_ACCOUNTS = Object.freeze([
  Object.freeze({ id: "current-full", label: "Current / full 5R", geometry: "full", model: "current" }),
  Object.freeze({ id: "challenger-full", label: "Challenger / full 5R", geometry: "full", model: "challenger" }),
  Object.freeze({ id: "current-half", label: "Current / half 3R", geometry: "half", model: "current" }),
  Object.freeze({ id: "challenger-half", label: "Challenger / half 3R", geometry: "half", model: "challenger" })
]);

module.exports = { roundLots, maxDrawdown, runAccount, runFourAccounts, FOUR_ACCOUNTS };
