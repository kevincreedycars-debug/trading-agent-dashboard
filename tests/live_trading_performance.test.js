// Tests for lib/live_trading_performance.js and the Live Trading panel that renders it.
//
// The panel the owner asked for is only worth having if its figures can be checked, so the arithmetic is a
// module of its own (lib/live_trading_performance.js) and this file holds it to four promises: a trade belongs
// to its London close day, a win is a positive net and a breakeven is exactly zero, a share is the row over the
// account's own total, and every tab adds back to the same count and the same money the Closed trades table
// prints. The last test reads the committed artifact, so a day the total stops adding up fails here rather than
// on the page.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const performance = require("../lib/live_trading_performance.js");

const root = path.resolve(__dirname, "..");
const feedPath = path.join(root, "data", "live-trading.json");
const scriptPath = path.join(root, "script.js");
const indexPath = path.join(root, "index.html");

// One closed trade in the shape the producer writes, with only the fields the aggregation reads.
function trade({ closedUtc, net, comment = "l2l-rule-eur", asset = "EUR", symbol = "EURUSD" }) {
  return {
    symbol,
    dashboard_asset: asset,
    net_profit: net,
    comment,
    closed: { time_server: closedUtc, time_utc: closedUtc }
  };
}

function cents(value) {
  return Math.round(Number(value) * 100);
}

function tabSums(rows) {
  return rows.reduce(
    (totals, row) => ({
      trades: totals.trades + row.trades,
      wins: totals.wins + row.wins,
      losses: totals.losses + row.losses,
      breakeven: totals.breakeven + row.breakeven,
      cents: totals.cents + cents(row.net)
    }),
    { trades: 0, wins: 0, losses: 0, breakeven: 0, cents: 0 }
  );
}

test("a trade belongs to the day its close fell on in Europe/London, not the day UTC says", () => {
  // 2026-07-01 23:30 UTC is 00:30 on Thursday 2 July in London, because London is on BST in July. A weekday
  // read from the UTC clock would put this trade on Wednesday and quietly move a night trade into the wrong
  // day, which is the one error a weekday breakdown cannot absorb.
  const summer = performance.weekdayOf("2026-07-01T23:30:00+00:00");
  assert.equal(performance.weekdayZone, "Europe/London");
  assert.equal(summer.label, "Thursday");

  // The same clock time in November is Friday in both zones, because London is back on GMT and the two agree:
  // the assertion above is about the zone, not about London always running ahead.
  const winter = performance.weekdayOf("2026-11-06T23:30:00+00:00");
  assert.equal(winter.label, "Friday");

  assert.equal(performance.weekdayOf(""), null);
  assert.equal(performance.weekdayOf("not a date"), null);
});

test("a win is a positive net, a loss a negative net and a breakeven exactly zero", () => {
  const summary = performance.summarise([
    trade({ closedUtc: "2026-11-02T10:00:00+00:00", net: 5.5 }),
    trade({ closedUtc: "2026-11-02T11:00:00+00:00", net: -2.25 }),
    trade({ closedUtc: "2026-11-02T12:00:00+00:00", net: 0 })
  ]);

  assert.equal(summary.totals.trades, 3);
  assert.equal(summary.totals.wins, 1);
  assert.equal(summary.totals.losses, 1);
  assert.equal(summary.totals.breakeven, 1);
  assert.equal(summary.totals.net, 3.25);
  // The rate is wins over every closed trade in the row, breakevens included: one of three, not one of two.
  assert.equal(Math.round(summary.totals.winRatePct * 10) / 10, 33.3);

  const monday = summary.weekday[0];
  assert.equal(monday.label, "Monday");
  assert.equal(monday.trades, 3);
  assert.equal(cents(monday.net), 325);
});

test("the weekday tab is always seven rows, Monday to Sunday, and a day with no trades keeps a blank rate", () => {
  const summary = performance.summarise([trade({ closedUtc: "2026-11-02T10:00:00+00:00", net: 1 })]);

  assert.deepEqual(summary.weekday.map(row => row.label), [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ]);
  const saturday = summary.weekday[5];
  assert.equal(saturday.trades, 0);
  assert.equal(saturday.wins, 0);
  assert.equal(saturday.net, 0);
  // Null rather than zero: a day nobody traded and a day that lost every trade must not draw the same figure.
  assert.equal(saturday.winRatePct, null);
  assert.equal(saturday.sharePct, 0);
  assert.equal(summary.weekday[0].winRatePct, 100);
});

test("a share is the row over the account's own total, and the three tabs each add back to it", () => {
  const summary = performance.summarise([
    trade({ closedUtc: "2026-11-02T10:00:00+00:00", net: 10, comment: "l2l-rule-gold", asset: "GOLD", symbol: "XAUUSD" }),
    trade({ closedUtc: "2026-11-03T10:00:00+00:00", net: -10, comment: "l2l-rule-gold", asset: "GOLD", symbol: "XAUUSD" }),
    trade({ closedUtc: "2026-11-04T10:00:00+00:00", net: 5, comment: "l2l-rule-nq", asset: "NQ", symbol: "US100.cash" }),
    trade({ closedUtc: "2026-11-05T10:00:00+00:00", net: -5, comment: "l2l-rule-nq", asset: "NQ", symbol: "US100.cash" })
  ]);

  const gold = summary.strategy.find(row => row.label === "l2l-rule-gold");
  assert.equal(gold.trades, 2);
  assert.equal(gold.sharePct, 50);
  assert.equal(gold.winRatePct, 50);
  assert.equal(gold.net, 0);

  [summary.weekday, summary.strategy, summary.asset].forEach(rows => {
    const sums = tabSums(rows);
    assert.equal(sums.trades, summary.totals.trades);
    assert.equal(sums.cents, cents(summary.totals.net));
  });
  assert.equal(summary.asset.length, 2);
});

test("a trade with no strategy identifier is kept under Unknown strategy and named in the note", () => {
  const summary = performance.summarise([
    trade({ closedUtc: "2026-11-02T10:00:00+00:00", net: 4, comment: "l2l-rule-eur" }),
    trade({ closedUtc: "2026-11-02T11:00:00+00:00", net: -0.06, comment: "loop-proof-close" }),
    trade({ closedUtc: "2026-11-02T12:00:00+00:00", net: 2, comment: "" })
  ]);

  const unknown = summary.strategy.find(row => row.label === performance.UNKNOWN_STRATEGY);
  assert.equal(unknown.trades, 2);
  assert.equal(cents(unknown.net), 194);
  // Two trades, two different reasons, one row: the totals stay whole and the caption names the recorded text
  // that could not be read as a rule.
  assert.deepEqual(summary.unattributed, [{ comment: "loop-proof-close", trades: 1 }]);
  assert.equal(summary.strategy.length, 2);
  assert.equal(tabSums(summary.strategy).trades, 3);
  assert.equal(summary.totals.net, 5.94);
});


test("the committed snapshot's three tabs add back to the Closed trades table's own count and money", () => {
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const summary = performance.summarise(feed.closed_trades, { history: feed.history });

  // What the Closed trades table prints is the length of this same array and the sum of the same net column,
  // so holding the three tabs to those two facts is the reconciliation the owner asked for rather than a
  // number copied from today's artifact.
  const tableCount = feed.closed_trades.length;
  const tableCents = feed.closed_trades.reduce((total, entry) => total + cents(entry.net_profit), 0);
  assert.equal(summary.trades, tableCount);
  assert.equal(cents(summary.totals.net), tableCents);

  [summary.weekday, summary.strategy, summary.asset].forEach(rows => {
    const sums = tabSums(rows);
    assert.equal(sums.trades, tableCount);
    assert.equal(sums.wins + sums.losses + sums.breakeven, tableCount);
    assert.equal(sums.cents, tableCents);
  });

  // Seven weekday rows, and a share column that adds up to the whole account even when a day carries nothing.
  assert.equal(summary.weekday.length, 7);
  const share = summary.weekday.reduce((total, row) => total + row.sharePct, 0);
  assert.ok(Math.abs(share - 100) < 0.2, `weekday shares sum to ${share}`);
  summary.weekday.forEach(row => {
    assert.equal(row.winRatePct === null, row.trades === 0);
  });

  // The history the snapshot reports is the period the panel states, and a trade older than the window is not
  // in these figures - which is the one limit the panel has to say out loud.
  assert.equal(summary.period.windowDays, Number(feed.history.window_days));
  assert.ok(summary.period.fromUtc && summary.period.toUtc);
});

test("the reporting dates beside the title are the snapshot's own window, printed as dates", () => {
  // Fixed stamps, so the label's shape is held still: the UTC calendar day of each end of the window the
  // snapshot states, and the day count it declares.
  assert.equal(performance.dayLabel("2026-10-26T18:50:25.189059+00:00"), "26 Oct 2026");
  assert.equal(performance.dayLabel("2026-11-09T18:50:25.189059+00:00"), "09 Nov 2026");
  assert.equal(
    performance.periodLabel({
      fromUtc: "2026-10-26T18:50:25.189059+00:00",
      toUtc: "2026-11-09T18:50:25.189059+00:00",
      windowDays: 14
    }),
    "26 Oct 2026 \u2013 09 Nov 2026 UTC \u00b7 14-day window"
  );

  // A snapshot that states no window states no dates: the panel must not fall back to today's date, because a
  // date the snapshot did not state is a figure the page invented.
  assert.equal(performance.periodLabel({ fromUtc: "", toUtc: "", windowDays: null }), "");
  assert.equal(performance.periodLabel(null), "");
  assert.equal(performance.dayLabel("not a date"), "");

  // The committed snapshot: its own stamps come out as its own dates, and the label states the window it declares
  // rather than a number chosen here.
  const feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  const summary = performance.summarise(feed.closed_trades, { history: feed.history });
  const label = performance.periodLabel(summary.period);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const from = new Date(feed.history.from_utc);
  const expectedFrom = `${String(from.getUTCDate()).padStart(2, "0")} ${months[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
  assert.ok(label.startsWith(expectedFrom), `the label starts with the window's opening date: ${label}`);
  assert.match(label, /\d{4} UTC/);
  assert.match(label, new RegExp(`${Number(feed.history.window_days)}-day window`));
});

test("the Live Trading view keeps its reading order and loads the aggregation before the page script", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const html = fs.readFileSync(indexPath, "utf8");
  const render = script.slice(script.indexOf("function renderLiveTrading(passedData) {"));

  const order = [
    "liveTradingChartShell(data, ruleState)",
    "liveTradingPerformancePanel(data, laneView)",
    "liveTradingPositions(data)",
    "liveTradingClosedTrades(data)",
    "<div class=\"live-trading-grid\">${cards}</div>"
  ].map(entry => {
    const at = render.indexOf(entry);
    assert.ok(at >= 0, `${entry} is not rendered by renderLiveTrading`);
    return at;
  });
  order.slice(1).forEach((at, index) => {
    assert.ok(at > order[index], "the Live Trading blocks are rendered out of order");
  });

  // The panel is real markup with one tab per breakdown, defaulting to Weekday, and one table per tab so the
  // swap shows a single breakdown at a time.
  assert.match(script, /key: "weekday", label: "Weekday", column: "Close day \\u00b7 London time"/);
  assert.match(script, /let liveTradingPerformanceTab = "weekday";/);
  // The panel draws whichever lane the selector is on, so its heading and its tab strip name that lane from the
  // view rather than a typed account: FTMO 1's own page reads "FTMO 1 Performance" and lane 2's reads "FTMO 2".
  assert.match(
    script,
    /<h3 id="liveTradingPerformanceHeading">\$\{escapeHtml\(laneAccount\)\} Performance<\/h3>\s*<p class="live-trading-performance-period"/
  );

  // The dates are printed by the aggregation module rather than typed into the panel, so the line beside the
  // title cannot disagree with the window the rows were summed over.
  assert.match(script, /return performance\.periodLabel\(summary\.period\);/);
  assert.match(script, /role="tablist" aria-label="\$\{escapeHtml\(laneAccount\)\} performance breakdown"/);

  assert.match(script, /Share of trades %/);
  assert.match(script, /Win rate %/);

  const lib = html.indexOf("lib/live_trading_performance.js");
  const page = html.indexOf("script.js?v=");
  assert.ok(lib >= 0, "index.html must load the performance module");
  assert.ok(lib < page, "the performance module must load before script.js");
});


