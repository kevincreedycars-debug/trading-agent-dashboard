"use strict";

/**
 * The Execution demo (research only).
 *
 * The two-day EUR/USD M5 replay reported at 5d488ef5 is the only place in this checkout where a real tape,
 * a real level ladder and real fills exist together, so it is the only place the panel can show a candle
 * replay with a trigger, an order, a fill, a stop, a target and an exit. Its call direction came from the
 * live fill record, not from a reconstructed 05:00 call, so it is labelled an execution demo and never
 * counted as one of the four scored tests.
 *
 * Nothing here computes a trade: the ledgers are read as written by the replay, and only the position sizing
 * is recomputed, against each account's own running balance.
 */

const fs = require("node:fs");
const path = require("node:path");

const { LABELS } = require("./contracts");
const { runFourAccounts, FOUR_ACCOUNTS } = require("./accounts");

const REPLAY_DIR = path.join("backtester", "tmp", "usd-session-research", "replays");
const FEED_PATH = path.join("backtester", "tmp", "usd-session-research", "raw", "main", "data__live-trading.json");

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function candlesForSession(bars, session) {
  const start = Date.parse(session.startUtc);
  const end = Date.parse(session.endUtc);
  return bars
    .filter((bar) => {
      const stamp = Date.parse(bar.time_utc || bar.time_server);
      return Number.isFinite(stamp) && stamp >= start && stamp < end;
    })
    .map((bar) => ({
      t: bar.time_utc || bar.time_server,
      o: bar.open,
      h: bar.high,
      l: bar.low,
      c: bar.close
    }));
}

/** Turn one replay ledger's trades into the shared trade shape the accounts read. */
function tradesFromLedger(ledger, geometry, instrument) {
  const contractSize = instrument && Number.isFinite(instrument.contract_size) ? instrument.contract_size : 100000;
  return (ledger.trades || []).map((trade, index) => ({
    id: `${geometry}-${index + 1}`,
    geometry,
    market: ledger.symbol,
    sessionDate: trade.sessionDate,
    side: trade.side,
    level: trade.level,
    levelSource: trade.levelSource,
    entry: trade.entry,
    stop: trade.stop,
    target: trade.target,
    triggerTimeUtc: trade.triggerTimeUtc,
    fillTimeUtc: trade.fillTimeUtc,
    exitTimeUtc: trade.exitTimeUtc,
    exitPrice: trade.exitPrice,
    exitReason: trade.exitReason,
    rGross: Number.isFinite(trade.rGross) ? trade.rGross : null,
    riskPerLot: Number.isFinite(trade.risk) ? Math.round(trade.risk * contractSize * 100) / 100 : null,
    ledgerLots: trade.lots,
    ledgerRiskAmount: trade.riskAmount
  }));
}


/**
 * Build the demo block from the two ledgers and the M5 feed.
 *
 * @param {object} [options]
 * @param {string} [options.rootDir] repository root, so the paths stay explicit.
 */
function buildExecutionDemo({ rootDir }) {
  const root = rootDir || path.resolve(__dirname, "../../..");
  const fullLedger = readJson(path.join(root, REPLAY_DIR, "ledger-EURUSD-5r-short.json"));
  const halfLedger = readJson(path.join(root, REPLAY_DIR, "ledger-EURUSD-3r-half-short.json"));
  const feed = readJson(path.join(root, FEED_PATH));
  if (!fullLedger || !halfLedger) {
    return {
      available: false,
      label: LABELS.execution_demo,
      reason:
        "the two replay ledgers are local evidence under backtester/tmp/usd-session-research/replays/ and are not " +
        "present in this checkout, so the demo cannot be rebuilt"
    };
  }
  const instrument = fullLedger.instrument || {};
  const bars = (() => {
    if (!feed || !Array.isArray(feed.instruments)) return [];
    const eur = feed.instruments.find((entry) => entry && entry.symbol === fullLedger.symbol);
    return eur && eur.m5 && Array.isArray(eur.m5.bars) ? eur.m5.bars : [];
  })();

  const sessions = (fullLedger.sessions || []).map((session) => ({
    date: session.date,
    startUtc: session.startUtc,
    endUtc: session.endUtc,
    bars: session.bars,
    hoursCovered: session.hoursCovered,
    truncatedStart: session.truncatedStart,
    truncatedEnd: session.truncatedEnd,
    candles: candlesForSession(bars, session)
  }));

  const trades = [
    ...tradesFromLedger(fullLedger, "full", instrument),
    ...tradesFromLedger(halfLedger, "half", instrument)
  ];

  const accounts = runFourAccounts({
    trades,
    accounts: FOUR_ACCOUNTS.map((account) => ({
      ...account,
      callSource:
        "demo call: the direction of the live fill record for these dates, identical for both model slots because " +
        "no reconstructed 05:00 call exists for 2026-11-05 or 2026-11-06"
    })),
    startingBalance: 100000,
    riskPct: 1,
    instrument: { lotStep: instrument.lot_step || 0.01, minLot: instrument.min_lot || 0.01 }
  });

  return {
    available: true,
    label: LABELS.execution_demo,
    market: fullLedger.symbol,
    call_source:
      "the live fill record of 2026-11-05/06, held constant for the session, because no Layer 1 archive for those " +
      "dates is staged in this checkout",
    variants: {
      full: { rules: fullLedger.rules, totals: fullLedger.totals, grid: fullLedger.grid, events: fullLedger.events },
      half: { rules: halfLedger.rules, totals: halfLedger.totals, grid: halfLedger.grid, events: halfLedger.events }
    },
    instrument: {
      symbol: fullLedger.symbol,
      digits: instrument.digits,
      point: instrument.point,
      contractSize: instrument.contract_size,
      minLot: instrument.min_lot,
      lotStep: instrument.lot_step
    },
    sessions,
    trades,
    accounts,
    provenance: {
      ledgers: [fullLedger.provenance, halfLedger.provenance],
      feed: fullLedger.provenance && fullLedger.provenance.feed ? fullLedger.provenance.feed : null,
      bars_carried: bars.length,
      note:
        "candles are the M5 bars the replay itself read; the levels, events and trades are the ledger's own, so the " +
        "chart cannot disagree with the tables"
    }
  };
}

module.exports = { buildExecutionDemo, REPLAY_DIR, FEED_PATH };
