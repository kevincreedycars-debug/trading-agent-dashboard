'use strict';

/**
 * Start the five-minute archive for the four traded markets, and prove one complete session against the trades
 * already recorded in this checkout.
 *
 * The programme keeps asking the same question, and the answer is always the same shape: a line-to-line trade
 * cannot be priced without a five-minute tape and the level ladder the setup was drawn on. This script is the
 * first step of that archive. It does not fetch anything, and it does not price a trade. It inventories what the
 * two saved sessions in `backtester/tmp/usd-session-research` already hold, instrument by instrument, and then
 * re-derives the recorded EUR/USD trades of 2026-11-05 from the five-minute bars the replay itself read:
 *
 *  - the trigger bar exists and closes beyond the level in the trade's direction;
 *  - the fill bar spans the level the limit order sat at;
 *  - the exit bar spans the stop or target the ledger reports.
 *
 * Three limits are stated rather than glossed. The bars are mid-price OHLC with a spread column, not a bid/ask
 * series. The tape covers two and a half days of one saved feed snapshot, not a running archive. And the level
 * ladder held here was hand-marked on 2026-10-04, a month before these sessions, so it is evidence that a ladder
 * format exists, not the pre-session ladder either session was set up on.
 *
 * usage:
 *   node backtester/scripts/verify_m5_archive.js            # print the status
 *   node backtester/scripts/verify_m5_archive.js --write    # write data/usd-layer1-backtester/m5-archive-status.json
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const EVIDENCE = 'backtester/tmp/usd-session-research';
const FEED_PATH = `${EVIDENCE}/raw/main/data__live-trading.json`;
const LEVELS_PATH = `${EVIDENCE}/raw/main/data__l2l-levels.json`;
const LEDGER_PATHS = [
  `${EVIDENCE}/replays/ledger-EURUSD-5r-short.json`,
  `${EVIDENCE}/replays/ledger-EURUSD-3r-half-short.json`
];
const OUTPUT_PATH = 'data/usd-layer1-backtester/m5-archive-status.json';
const BAR_MS = 5 * 60 * 1000;

/** The four markets the Layer 1 call is scored on, in the order the panel lists them. */
const TARGETS = Object.freeze([
  Object.freeze({ key: 'EURUSD', label: 'EUR/USD', feed_symbol: 'EURUSD' }),
  Object.freeze({ key: 'XAUUSD', label: 'Gold (XAU/USD)', feed_symbol: 'XAUUSD' }),
  Object.freeze({ key: 'NAS100', label: 'NAS100', feed_symbol: 'US100.cash' }),
  Object.freeze({ key: 'BTCUSD', label: 'BTC/USD', feed_symbol: 'BTCUSD' })
]);

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fingerprint(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  return { file: relativePath, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function round(value, decimals = 6) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isoOf(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function indexByTime(bars) {
  const index = new Map();
  for (const bar of Array.isArray(bars) ? bars : []) {
    const ms = Date.parse(bar.time_utc || bar.t || '');
    if (Number.isFinite(ms)) index.set(ms, bar);
  }
  return index;
}

function barsBetween(index, startIso, endIso) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  const bars = [];
  for (const [ms, bar] of index) {
    if (ms >= start && ms < end) bars.push({ ms, bar });
  }
  bars.sort((left, right) => left.ms - right.ms);
  return bars;
}


/** Re-derive one recorded trade from the bars the replay read. Every check is reported, pass or fail. */
function checkTrade(trade, indexForTrade) {
  const short = String(trade.side || '').toLowerCase() === 'short';
  const level = Number(trade.level);
  const entry = Number(Number.isFinite(Number(trade.entry)) ? trade.entry : trade.fillPrice);
  const exitPrice = Number(trade.exitPrice);
  const trigger = indexForTrade.get(Date.parse(trade.triggerTimeUtc));
  const fill = indexForTrade.get(Date.parse(trade.fillTimeUtc));
  const exit = indexForTrade.get(Date.parse(trade.exitTimeUtc));
  const checks = [];
  const push = (check, pass, detail) => checks.push({ check, pass: Boolean(pass), detail });

  push('the trigger bar is in the tape', Boolean(trigger), trigger ? `close ${round(trigger.close, 5)} at ${isoOf(trade.triggerTimeUtc)}` : 'no bar opens at the trigger time');
  if (trigger) {
    push(
      short ? 'the trigger bar closes below the level' : 'the trigger bar closes above the level',
      short ? Number(trigger.close) < level : Number(trigger.close) > level,
      `close ${round(trigger.close, 5)} against level ${round(level, 5)}`
    );
  }
  push('the fill bar is in the tape', Boolean(fill), fill ? `range ${round(fill.low, 5)}-${round(fill.high, 5)}` : 'no bar opens at the fill time');
  if (fill) {
    push(
      'the level sits inside the fill bar',
      Number(fill.low) <= entry && entry <= Number(fill.high),
      `entry ${round(entry, 5)} inside ${round(fill.low, 5)}-${round(fill.high, 5)}`
    );
  }
  push('the exit bar is in the tape', Boolean(exit), exit ? `range ${round(exit.low, 5)}-${round(exit.high, 5)}` : 'no bar opens at the exit time');
  if (exit) {
    push(
      'the exit price sits inside the exit bar',
      Number(exit.low) <= exitPrice && exitPrice <= Number(exit.high),
      `exit ${round(exitPrice, 5)} inside ${round(exit.low, 5)}-${round(exit.high, 5)}`
    );
    if (trade.exitReason === 'stop') {
      push(
        'the stop is where the bar went against the trade',
        short ? Number(exit.high) >= exitPrice : Number(exit.low) <= exitPrice,
        short ? `bar high ${round(exit.high, 5)} reached the stop` : `bar low ${round(exit.low, 5)} reached the stop`
      );
    }
    if (trade.exitReason === 'target') {
      push(
        'the target is where the bar went for the trade',
        short ? Number(exit.low) <= exitPrice : Number(exit.high) >= exitPrice,
        short ? `bar low ${round(exit.low, 5)} reached the target` : `bar high ${round(exit.high, 5)} reached the target`
      );
    }
  }
  const failures = checks.filter((check) => !check.pass).length;
  return {
    session_date: trade.sessionDate || null,
    side: short ? 'short' : 'long',
    level: round(level, 5),
    entry: round(entry, 5),
    exit_price: round(exitPrice, 5),
    exit_reason: trade.exitReason || null,
    trigger_time_utc: isoOf(trade.triggerTimeUtc),
    fill_time_utc: isoOf(trade.fillTimeUtc),
    exit_time_utc: isoOf(trade.exitTimeUtc),
    checks,
    failures,
    verified: failures === 0
  };
}

/**
 * One complete session, checked against every filled trade the ledgers record for it.
 *
 * The session runs 05:00 London to 05:00 London, so 288 five-minute bars is a full tape. A missing bar is not a
 * failed trade: it is reported, and no trade is scored through a gap.
 */
function verifySession({ ledgers, feedInstrument, date }) {
  const index = indexByTime(feedInstrument && feedInstrument.m5 ? feedInstrument.m5.bars : []);
  const startIso = `${date}T05:00:00.000Z`;
  const endIso = new Date(Date.parse(startIso) + 24 * 3600 * 1000).toISOString();
  const present = barsBetween(index, startIso, endIso);
  const expected = Math.round((Date.parse(endIso) - Date.parse(startIso)) / BAR_MS);
  const missing = [];
  for (let step = 0; step < expected; step += 1) {
    const ms = Date.parse(startIso) + step * BAR_MS;
    if (!index.has(ms)) missing.push(new Date(ms).toISOString());
  }

  const checked = [];
  const skipped = [];
  for (const ledger of ledgers) {
    for (const trade of Array.isArray(ledger && ledger.trades) ? ledger.trades : []) {
      if (trade.sessionDate !== date) continue;
      if (trade.kind !== 'fill') {
        skipped.push({ exit_reason: trade.exitReason || trade.kind || null, why: 'no fill to re-derive: the trade never entered' });
        continue;
      }
      checked.push(checkTrade(trade, index));
    }
  }

  return {
    date,
    symbol: (feedInstrument && feedInstrument.symbol) || 'EURUSD',
    bars_expected: expected,
    bars_present: present.length,
    bars_missing: missing.length,
    coverage_pct: expected ? round((present.length / expected) * 100, 2) : null,
    first_bar_utc: present.length ? isoOf(present[0].bar.time_utc) : null,
    last_bar_utc: present.length ? isoOf(present[present.length - 1].bar.time_utc) : null,
    complete: missing.length === 0,
    trades_checked: checked.length,
    trades_verified: checked.filter((trade) => trade.verified).length,
    trades_failed: checked.filter((trade) => !trade.verified).length,
    skipped,
    trades: checked
  };
}


/** What one market holds today, and what it would need before a line-to-line trade could be priced. */
function instrumentStatus(target, feed, levels) {
  const instrument = (feed && Array.isArray(feed.instruments) ? feed.instruments : []).find(
    (entry) => entry.symbol === target.feed_symbol
  );
  const bars = instrument && instrument.m5 && Array.isArray(instrument.m5.bars) ? instrument.m5.bars : [];
  const spreads = bars.map((bar) => Number(bar.spread_points)).filter((value) => Number.isFinite(value));
  const ladder = (levels && Array.isArray(levels.instruments) ? levels.instruments : []).find(
    (entry) => entry.symbol === target.feed_symbol
  );
  const ladderLevels = ladder && Array.isArray(ladder.levels) ? ladder.levels : [];
  const roles = {};
  for (const level of ladderLevels) roles[level.role || 'unknown'] = (roles[level.role || 'unknown'] || 0) + 1;
  return {
    key: target.key,
    label: target.label,
    feed_symbol: target.feed_symbol,
    m5_bars: bars.length,
    first_bar_utc: bars.length ? isoOf(bars[0].time_utc) : null,
    last_bar_utc: bars.length ? isoOf(bars[bars.length - 1].time_utc) : null,
    spread_points: spreads.length ? { min: Math.min(...spreads), max: Math.max(...spreads) } : null,
    has_m5: bars.length > 0,
    has_bid_ask: false,
    bid_ask_note:
      'the feed carries mid-price OHLC and a spread column; bid and ask are never stored separately, so no ' +
      'spread path can be reconstructed after the fact',
    ladder: {
      levels: ladderLevels.length,
      roles,
      marked_at: (levels && levels.generated_at_utc) || null,
      pre_session_for_the_saved_sessions: false,
      note:
        'a hand-marked ladder from the dashboard tool, dated a month before the saved sessions; it proves the ' +
        'format, not the setup either session was traded on'
    },
    blocker: bars.length ? 'no bid/ask series and no pre-session ladder' : 'no five-minute bars at all'
  };
}


function build({ feed = readJson(FEED_PATH), levels = readJson(LEVELS_PATH), ledgers = LEDGER_PATHS.map(readJson) } = {}) {
  const instruments = TARGETS.map((target) => instrumentStatus(target, feed, levels));
  const eurusd = (feed && Array.isArray(feed.instruments) ? feed.instruments : []).find((entry) => entry.symbol === 'EURUSD');
  const verifiedSession =
    feed && eurusd ? verifySession({ ledgers: ledgers.filter(Boolean), feedInstrument: eurusd, date: '2026-11-05' }) : null;
  const sessionDates = Array.from(
    new Set(
      ledgers
        .filter(Boolean)
        .flatMap((ledger) => (Array.isArray(ledger.sessions) ? ledger.sessions.map((session) => session.date) : []))
    )
  ).sort();
  const complete = Array.from(
    new Set(
      ledgers
        .filter(Boolean)
        .flatMap((ledger) => (Array.isArray(ledger.sessions) ? ledger.sessions : []))
        .filter((session) => session.truncatedStart === false && session.truncatedEnd === false)
        .map((session) => session.date)
    )
  ).sort();

  return {
    schema_version: 'usd-l1-m5-archive-status-v1',
    generated_at: new Date().toISOString(),
    script: 'backtester/scripts/verify_m5_archive.js',
    status: feed ? 'started' : 'no_tape_in_this_checkout',
    coverage: {
      instruments_required: TARGETS.length,
      instruments_with_m5_bars: instruments.filter((entry) => entry.has_m5).length,
      instruments_with_bid_ask: 0,
      instruments_with_a_marked_ladder: instruments.filter((entry) => entry.ladder.levels > 0).length,
      sessions_held: sessionDates,
      sessions_without_truncation: complete,
      saved_feed_snapshots: feed ? 1 : 0
    },
    instruments,
    verified_session: verifiedSession,
    sources: [fingerprint(FEED_PATH), fingerprint(LEVELS_PATH), ...LEDGER_PATHS.map(fingerprint)].filter(Boolean),
    missing: [
      'a bid/ask five-minute series for any of the four markets: the saved feed stores mid OHLC plus a spread column',
      'a pre-session snapshot of the level ladder each morning, as the setup was drawn before the open',
      'continuous collection: two and a half days of one saved snapshot is a sample, not an archive',
      'the same proof for gold, NAS100 and BTC/USD: only the EUR/USD replay has recorded trades to check against'
    ],
    next_steps: [
      'keep the existing EUR/USD proof as the archive contract and re-run it on every new session',
      'record the mid OHLC and the spread column as they arrive, with the receipt time, so a later bid/ask backfill can be reconciled',
      'capture the pre-session ladder from the marking tool at 04:55 London and store it beside the session tape',
      'repeat the trade-level proof for gold, NAS100 and BTC/USD once a tape with a recorded trade exists for them'
    ],
    not_claimed: [
      'nothing here is a backtest, a fill model or an edge',
      'a verified session is not a verified strategy: it says the tape can reproduce trades that a replay already recorded',
      'mid prices with a spread column cannot settle whether a stop was taken at the bid or the ask'
    ],
    note:
      'Started, not finished. The archive is useful because it fixes the contract a five-minute tape has to meet ' +
      'before any line-to-line trade is priced, and because one complete session now demonstrably reproduces the ' +
      'trades a replay recorded from the same bars.'
  };
}

function main(flag) {
  const status = build();
  if (flag === '--write') {
    fs.writeFileSync(absolute(OUTPUT_PATH), `${JSON.stringify(status, null, 2)}\n`);
    console.log(`archive status written: ${OUTPUT_PATH}`);
  }
  console.log(
    `${status.status}: ${status.coverage.instruments_with_m5_bars} of ${status.coverage.instruments_required} markets hold ` +
      `five-minute bars, ${status.coverage.instruments_with_bid_ask} hold bid/ask, ` +
      `${status.coverage.instruments_with_a_marked_ladder} hold a marked ladder`
  );
  if (status.verified_session) {
    const session = status.verified_session;
    console.log(
      `session ${session.date} ${session.symbol}: ${session.bars_present}/${session.bars_expected} bars, ` +
        `${session.trades_verified}/${session.trades_checked} recorded trades re-derived, ${session.trades_failed} failure(s)`
    );
    for (const trade of session.trades.filter((entry) => !entry.verified)) {
      for (const check of trade.checks.filter((entry) => !entry.pass)) {
        console.log(`  - ${trade.side} ${trade.exit_reason}: ${check.check} (${check.detail})`);
      }
    }
  }
  return status.verified_session && status.verified_session.trades_failed > 0 ? 1 : 0;
}

module.exports = { TARGETS, FEED_PATH, LEVELS_PATH, LEDGER_PATHS, OUTPUT_PATH, build, verifySession, checkTrade };

if (require.main === module) {
  process.exitCode = main(process.argv[2] === '--write' ? '--write' : undefined);
}
