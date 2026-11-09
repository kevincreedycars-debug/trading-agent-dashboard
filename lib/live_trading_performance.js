// FTMO account 1's performance, read off the closed trades the snapshot already carries.
//
// The Live Trading view states what is open, what has closed and what each instrument is doing. It does not
// state whether the fortnight was a good one, and that answer is not visible by reading thirty-eight rows: the
// same trades have to be added up by weekday, by strategy and by instrument first. That addition is all this
// file does. It reads the `closed_trades` block of `data/live-trading.json` - the block the Closed trades table
// renders, row for row - and returns the same total sliced three ways, so the panel and the table cannot
// disagree about either the count or the money.
//
// Four rules are fixed here rather than chosen per call, because a figure that moves with its presentation is
// not a figure:
//
// 1. A trade belongs to the day its **close** fell on, read in Europe/London, because the account is traded
//    from London and a trade closed at 23:30 UTC still belongs to the London evening that opened it. The
//    snapshot stores the broker clock and UTC; London is derived from UTC here, never guessed.
// 2. A win is a **positive net** - profit plus commission plus swap - and nothing else. A loss is negative, a
//    breakeven is exactly zero, so a trade that only covered its costs is not silently counted as a winner.
// 3. The win rate of a row is its wins over **all** of that row's closed trades, breakevens included, so the
//    three counts always add up to the row's own total and the percentage cannot be inflated by dropping the
//    flat ones.
// 4. A share is the row's trades over the account's total, so the weekday and asset tabs each sum to 100%
//    including a weekend that carries no trades, and Unknown strategy stays in the totals rather than being
//    dropped.
//
// A trade with no recorded strategy identifier is attributed to `Unknown strategy` and kept, because the total
// is the account's own number and it would be a lie to make it add up by losing a trade. A trade whose close
// time cannot be placed on a day is counted in the total and reported as unplaced rather than assigned to an
// arbitrary day. A trade whose net is not a number is counted in its row but in none of the three outcomes, and
// the caller is told so.
//
// Loaded as a plain script by index.html (the global `LiveTradingPerformance`) and required by the node tests,
// so the panel and the checker cannot drift on what a win rate means.
(function initLiveTradingPerformance(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.LiveTradingPerformance = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createLiveTradingPerformance() {
  const LONDON_TIME_ZONE = "Europe/London";
  const UTC_FALLBACK_ZONE = "UTC";
  const WEEKDAY_LABELS = Object.freeze([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]);
  const WEEKDAY_SHORT = Object.freeze({ Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 });
  // The lane stamps the rule that placed a trade into the comment field, `l2l-rule-<asset>`. Anything else in
  // that field is recorded text rather than a strategy - a hand close, a proof close - so it is attributed to
  // Unknown strategy and named in the panel's caption instead of being invented into a rule of its own.
  const STRATEGY_ID = /^l2l-rule-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const UNKNOWN_STRATEGY = "Unknown strategy";
  const UNKNOWN_ASSET = "Unknown instrument";
  const UNATTRIBUTED_KEY = "__unattributed__";
  const MONTHS_SHORT = Object.freeze([
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ]);

  // The reporting dates, printed as dates. A reader's question beside the title is "which fortnight is this?",
  // and it is answered by "26 Oct 2026 - 09 Nov 2026", not by two clock stamps. The UTC calendar day is used
  // because UTC is the clock the history block states and the clock the Closed trades table prints; the weekday
  // breakdown's London rule is a separate statement, made in the caption, and folding it into these dates would
  // make the window and the rows disagree at a midnight boundary.
  function dayLabel(value) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return `${String(parsed.getUTCDate()).padStart(2, "0")} ${MONTHS_SHORT[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
  }

  // The withheld case is deliberate: a snapshot that states no window gets no dates rather than today's.
  function periodLabel(period) {
    const from = dayLabel(period && period.fromUtc);
    const to = dayLabel(period && period.toUtc);
    if (!from || !to) return "";
    const days = Number(period && period.windowDays);
    return `${from} \u2013 ${to} UTC${Number.isFinite(days) && days > 0 ? ` \u00b7 ${days}-day window` : ""}`;
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return Number.NaN;
    return Number(value);
  }

  function readWeekdayFormatter(timeZone) {
    if (typeof Intl !== "object" || typeof Intl.DateTimeFormat !== "function") return null;
    try {
      return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" });
    } catch (error) {
      return null;
    }
  }

  // Europe/London is asked for first. A runtime without the zone database falls back to UTC and says so in the
  // summary, because a day boundary that quietly moves by an hour is the kind of error nobody notices until a
  // Sunday's total looks wrong.
  const londonFormatter = readWeekdayFormatter(LONDON_TIME_ZONE);
  const utcFormatter = readWeekdayFormatter(UTC_FALLBACK_ZONE);
  const weekdayZone = londonFormatter ? LONDON_TIME_ZONE : utcFormatter ? UTC_FALLBACK_ZONE : "";
  const weekdayFormatter = londonFormatter || utcFormatter;


  function weekdayOf(value) {
    if (!value || !weekdayFormatter) return null;
    const at = Date.parse(value);
    if (Number.isNaN(at)) return null;
    const parts = weekdayFormatter.formatToParts(new Date(at));
    const part = parts.find(entry => entry.type === "weekday");
    const short = part ? String(part.value).slice(0, 3) : "";
    if (!Object.prototype.hasOwnProperty.call(WEEKDAY_SHORT, short)) return null;
    const index = WEEKDAY_SHORT[short];
    return { index, label: WEEKDAY_LABELS[index] };
  }

  function closedStamp(trade) {
    return trade?.closed?.time_utc || trade?.closed?.time_server || "";
  }

  function blankRow(key, label) {
    return { key, label, trades: 0, wins: 0, losses: 0, breakeven: 0, unclassified: 0, net: 0 };
  }

  function addTrade(row, net) {
    row.trades += 1;
    if (!Number.isFinite(net)) {
      row.unclassified += 1;
      return;
    }
    row.net += net;
    if (net > 0) row.wins += 1;
    else if (net < 0) row.losses += 1;
    else row.breakeven += 1;
  }

  function ratePercent(numerator, denominator) {
    if (!denominator) return null;
    return (numerator / denominator) * 100;
  }

  function finishRow(row, totalTrades) {
    return {
      ...row,
      net: Math.round(row.net * 100) / 100,
      sharePct: ratePercent(row.trades, totalTrades),
      winRatePct: ratePercent(row.wins, row.trades)
    };
  }

  // Rows are ordered by weight, then by money, then by name: the question is "where did the trades happen",
  // and a row with three trades should not sit beside a row with none by accident.
  function orderRows(rows) {
    return rows.slice().sort((left, right) => {
      if (right.trades !== left.trades) return right.trades - left.trades;
      if (right.net !== left.net) return right.net - left.net;
      return left.label.localeCompare(right.label);
    });
  }

  function summarise(trades, options = {}) {
    const list = Array.isArray(trades) ? trades : [];
    const totals = blankRow("total", "FTMO account 1");
    const weekday = WEEKDAY_LABELS.map((label, index) => blankRow(`weekday-${index}`, label));
    const strategies = new Map();
    const assets = new Map();
    const unattributedComments = new Map();
    let unplaced = 0;

    list.forEach(trade => {
      const net = toNumber(trade?.net_profit);
      const day = weekdayOf(closedStamp(trade));
      if (day) addTrade(weekday[day.index], net);
      else unplaced += 1;
      addTrade(totals, net);

      const comment = String(trade?.comment || "").trim();
      const strategyKey = comment && STRATEGY_ID.test(comment.toLowerCase()) ? comment.toLowerCase() : UNATTRIBUTED_KEY;
      if (strategyKey === UNATTRIBUTED_KEY && comment) {
        unattributedComments.set(comment, (unattributedComments.get(comment) || 0) + 1);
      }
      if (!strategies.has(strategyKey)) {
        strategies.set(strategyKey, blankRow(
          strategyKey,
          strategyKey === UNATTRIBUTED_KEY ? UNKNOWN_STRATEGY : comment.toLowerCase()
        ));
      }
      addTrade(strategies.get(strategyKey), net);

      const assetLabel = String(trade?.dashboard_asset || trade?.symbol || "").trim() || UNKNOWN_ASSET;
      const assetKey = assetLabel.toLowerCase();
      if (!assets.has(assetKey)) assets.set(assetKey, blankRow(assetKey, assetLabel));
      addTrade(assets.get(assetKey), net);
    });

    const history = options.history && typeof options.history === "object" ? options.history : {};
    const windowDays = Number.isInteger(Number(history.window_days)) ? Number(history.window_days) : null;
    const closes = list.map(trade => closedStamp(trade)).filter(Boolean).sort();

    return {
      trades: list.length,
      totals: finishRow(totals, list.length),
      weekday: weekday.map(row => finishRow(row, list.length)),
      strategy: orderRows([...strategies.values()]).map(row => finishRow(row, list.length)),
      asset: orderRows([...assets.values()]).map(row => finishRow(row, list.length)),
      unattributed: [...unattributedComments.entries()]
        .map(([comment, count]) => ({ comment, trades: count }))
        .sort((left, right) => right.trades - left.trades || left.comment.localeCompare(right.comment)),
      unplaced,
      weekdayZone,
      period: {
        fromUtc: history.from_utc || (closes.length ? closes[0] : ""),
        toUtc: history.to_utc || (closes.length ? closes[closes.length - 1] : ""),
        windowDays
      }
    };
  }

  return {
    LONDON_TIME_ZONE,
    WEEKDAY_LABELS,
    UNKNOWN_STRATEGY,
    UNKNOWN_ASSET,
    UNATTRIBUTED_KEY,
    weekdayZone,
    weekdayOf,
    dayLabel,
    periodLabel,
    summarise
  };
});
