"use strict";

/**
 * The five-minute archive has started, and one complete session proves itself against recorded trades.
 *
 * These tests defend three claims and refuse a fourth: the four traded markets have five-minute bars in the
 * saved feed, none of them has a bid/ask series, the marked ladder is not a pre-session ladder, and no trade is
 * ever priced from this evidence. The fourth claim is the important one: a session that reproduces recorded
 * trades is not a backtest.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const archive = require("../scripts/verify_m5_archive.js");

const REPO_ROOT = path.resolve(__dirname, "../..");
const STATUS_PATH = path.join(REPO_ROOT, "data", "usd-layer1-backtester", "m5-archive-status.json");

function status() {
  return JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
}

test("the archive records one feed snapshot for all four traded markets", () => {
  const published = status();
  assert.equal(published.schema_version, "usd-l1-m5-archive-status-v1");
  assert.equal(published.status, "started");
  assert.equal(published.coverage.instruments_required, 4);
  assert.equal(published.coverage.instruments_with_m5_bars, 4);
  assert.equal(published.coverage.saved_feed_snapshots, 1);
  assert.deepEqual(
    published.instruments.map((entry) => entry.key),
    ["EURUSD", "XAUUSD", "NAS100", "BTCUSD"]
  );
  for (const entry of published.instruments) {
    assert.ok(entry.m5_bars > 0, `${entry.key} must carry five-minute bars`);
    assert.equal(entry.has_bid_ask, false, `${entry.key} has no bid/ask series and must say so`);
    assert.ok(entry.ladder.levels > 0, `${entry.key} keeps a marked ladder`);
    assert.equal(entry.ladder.pre_session_for_the_saved_sessions, false);
    assert.ok(entry.blocker.length > 10);
  }
});

test("the archive admits what it does not hold", () => {
  const published = status();
  assert.equal(published.coverage.instruments_with_bid_ask, 0);
  assert.ok(published.missing.some((line) => line.includes("bid/ask")));
  assert.ok(published.missing.some((line) => line.includes("pre-session")));
  assert.ok(published.next_steps.length >= 3);
  assert.ok(published.not_claimed.some((line) => line.includes("is not a backtest") || line.includes("nothing here is a backtest")));
  assert.equal(published.not_claimed.some((line) => /priced trade|fill model/i.test(line)), true);
});

test("one complete session reproduces every recorded trade it carries", () => {
  const session = status().verified_session;
  assert.equal(session.date, "2026-11-05");
  assert.equal(session.symbol, "EURUSD");
  assert.equal(session.bars_expected, 288, "a 05:00 to 05:00 session is 288 five-minute bars");
  assert.ok(session.bars_present >= 280, "the tape has to be effectively complete");
  assert.equal(session.bars_missing, session.bars_expected - session.bars_present);
  assert.ok(session.trades_checked >= 4, "the session carries recorded trades to re-derive");
  assert.equal(session.trades_verified, session.trades_checked);
  assert.equal(session.trades_failed, 0);
  for (const trade of session.trades) {
    assert.ok(trade.checks.length >= 5, "each trade reports every check");
    assert.ok(trade.checks.every((check) => check.pass), `${trade.side} ${trade.exit_reason} must re-derive`);
  }
});

test("without a tape the archive reports nothing rather than inventing it", () => {
  const empty = archive.build({ feed: null, levels: null, ledgers: [] });
  assert.equal(empty.status, "no_tape_in_this_checkout");
  assert.equal(empty.coverage.instruments_with_m5_bars, 0);
  assert.equal(empty.verified_session, null);
  for (const entry of empty.instruments) {
    assert.equal(entry.has_m5, false);
    assert.equal(entry.m5_bars, 0);
    assert.equal(entry.ladder.levels, 0);
  }
});

test("the committed status matches what the script derives from the saved evidence", (t) => {
  const feedPath = path.join(REPO_ROOT, archive.FEED_PATH);
  if (!fs.existsSync(feedPath)) {
    t.skip("the saved five-minute feed is ignored local evidence, absent on a bare checkout");
    return;
  }
  const derived = archive.build();
  const published = status();
  assert.equal(derived.coverage.instruments_with_m5_bars, published.coverage.instruments_with_m5_bars);
  assert.equal(derived.verified_session.bars_present, published.verified_session.bars_present);
  assert.equal(derived.verified_session.trades_checked, published.verified_session.trades_checked);
  assert.equal(derived.verified_session.trades_failed, 0);
});
