// The L2L deviation rule, shared by the live dashboard and the tests that hold it.
//
// The rule, in the user's own words, is four steps: take the direction Layer 1 published for the asset,
// wait for a five-minute candle to *close* beyond a marked L2L level, put a limit order back at that level,
// and aim the 5R target at the *next* marked level, with the stop then set to match that target at five to
// one - one fifth of that distance behind the entry. The user corrected the last two steps on 2026-10-05: the
// target is a line he marked on the chart, so it comes off the ladder rather than out of a multiple, and the
// stop follows the target rather than the target following a stop, on every pair. "Close beyond" means the crossing candle itself: the newest closed M5 bar
// has to finish past a level that the bar before it did not finish past, because a price that has simply
// been sitting above a line for hours has crossed nothing. Everything here is arithmetic over the artifacts
// that already exist - the sealed calls in `data/layer1.json`, the marked ladder in
// `data/l2l-levels.json` and the M5 bars in `data/live-trading.json` - and, for a pair the lane already has a
// trade on, one more that says which trade that is: the feed's own `orders` and `positions` blocks, filtered
// to this lane's magic. That fourth artifact is what lets a live trade be read at the level it was triggered
// on - the `in-trade` stage - rather than at a fresh crossing elsewhere on the ladder, which is the reading
// the user corrected on 2026-10-05. Nothing here places, sizes,
// modifies or sends an order. It answers one question: given what is published now, what would the rule be
// watching, and what would the ticket be if it fired.
//
// Two things it deliberately does not decide, because the artifacts it reads do not carry the answer: when
// a call expires (it reads the newest call it is handed, and the caller decides what to hand it), and how
// much money is at risk (size stays where it already is, at the instrument's own minimum, until the user
// scales it - the rule states prices only).
//
// Loaded as a plain script by index.html (the global `L2LStrategy`) and required by the tests, so the page
// and the checker cannot drift on what "confirmed", "waiting" and "blocked" mean.
(function initL2lStrategy(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.L2LStrategy = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createL2lStrategy() {
  // The timeframe the entry is confirmed on: a five-minute close beyond the level, never a wick and never a
  // faster timeframe.
  const DEVIATION_TIMEFRAME = "M5";
  // The stop matches the target at five to one: one fifth of the entry-to-target distance, the number the
  // user set. It scales the target down into the risk rather than the risk up into a target, because the
  // target is a price the user marked on the chart and the stop is the distance that makes it worth five.
  const REWARD_R_MULTIPLE = 5;
  // Fewer bars than this and no close can be judged at all: the rule refuses rather than reading one bar.
  const MIN_BARS = 3;
  // Where a reading can stand. `confirmed` is the only stage that carries a ticket; `waiting` is a live
  // reading, not a refusal; `blocked` is the one-trade-per-pair cap doing its work.
  const STAGES = Object.freeze(["unavailable", "no-call", "no-levels", "waiting", "confirmed", "in-trade", "blocked"]);
  const SIDES = Object.freeze(["long", "short"]);

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function roundPrice(value) {
    return Number(Number(value).toFixed(6));
  }

  function positiveNumber(value) {
    const numeric = toNumber(value);
    return isFiniteNumber(numeric) && numeric > 0 ? numeric : null;
  }

  // A missing number is not zero: a row carrying `null` for a price must be dropped rather than read as a
  // price of nothing, which is the one reading that would silently invent a level.
  function toNumber(value) {
    if (value === null || value === undefined || value === "") return Number.NaN;
    return Number(value);
  }

  // The dashboard's own words for a direction. A call the artifacts do not carry, or one that says the
  // asset is flat, is no direction: this rule takes no trade from a missing call.
  function normaliseDirection(value) {
    const normalised = String(value === null || value === undefined ? "" : value).trim().toUpperCase();
    if (normalised.startsWith("BULLISH")) return "BULLISH";
    if (normalised.startsWith("BEARISH")) return "BEARISH";
    return null;
  }

  function sideForDirection(value) {
    const direction = normaliseDirection(value);
    if (direction === "BULLISH") return "long";
    if (direction === "BEARISH") return "short";
    return null;
  }


  // A level list as the marked file describes it: the price, who it belongs to (a seed marked by hand or a
  // line a duplication generated), and what it was called. Anything without a positive price is dropped
  // rather than repaired, which is the same rule the chart applies.
  function readLevels(levels) {
    return (Array.isArray(levels) ? levels : [])
      .map(level => ({
        role: level?.role === "derived" ? "derived" : "seed",
        price: toNumber(level?.price),
        kind: typeof level?.kind === "string" ? level.kind : null,
        timeframe: typeof level?.timeframe === "string" ? level.timeframe : null,
        label: String(level?.label || level?.name || "")
      }))
      .filter(level => isFiniteNumber(level.price) && level.price > 0)
      .sort((a, b) => b.price - a.price);
  }

  // The bars the rule reads, oldest first, with only the fields it needs and only the rows that could be a
  // candle. Bars are ordered by their own clock when the clocks are readable, so a block published in any
  // order still ends at the newest bar rather than at whichever row happened to be last.
  function readBars(bars) {
    const rows = (Array.isArray(bars) ? bars : [])
      .map(bar => ({
        time_utc: typeof bar?.time_utc === "string" ? bar.time_utc : null,
        open: toNumber(bar?.open),
        high: toNumber(bar?.high),
        low: toNumber(bar?.low),
        close: toNumber(bar?.close)
      }))
      .filter(bar => isFiniteNumber(bar.open) && isFiniteNumber(bar.high) && isFiniteNumber(bar.low) && isFiniteNumber(bar.close));
    const stamp = bar => (bar.time_utc ? Date.parse(bar.time_utc) : Number.NaN);
    if (rows.every(bar => Number.isFinite(stamp(bar)))) rows.sort((a, b) => stamp(a) - stamp(b));
    return rows;
  }

  // The two lines a price sits between, which is all this rule ever needs from the ladder: the highest
  // marked price under it and the lowest marked price over it.
  function nearestBelow(levels, price) {
    const under = levels.filter(level => level.price < price);
    return under.length ? under[0] : null;
  }

  function nearestAbove(levels, price) {
    const over = levels.filter(level => level.price > price);
    return over.length ? over[over.length - 1] : null;
  }

  function priceDelta(from, to, point) {
    const delta = Math.abs(to - from);
    return {
      price: roundPrice(delta),
      points: point ? Math.round(delta / point) : null
    };
  }

  // A bar whose own five minutes have not elapsed has not closed, and a rule that fires on a close must not
  // read one: the forming candle's close is the price now, not the price at the close. The instant is handed
  // in rather than read from the clock, so the same input always gives the same answer.
  const MINUTE_MS = 60000;
  const DEVIATION_BAR_MS = 5 * MINUTE_MS;

  function closedBars(bars, nowMs) {
    const rows = readBars(bars);
    const now = Number(nowMs);
    if (!rows.length || !isFiniteNumber(now)) return rows;
    const newest = rows[rows.length - 1];
    const opened = newest.time_utc ? Date.parse(newest.time_utc) : Number.NaN;
    if (!Number.isFinite(opened)) return rows;
    return opened + DEVIATION_BAR_MS <= now ? rows : rows.slice(0, -1);
  }

  // The three prices of one ticket, from one entry price and the marked ladder: the target is the next marked
  // line past the entry in the trade's own direction, and the stop is the distance that makes that target worth
  // five times the risk - one fifth of the entry-to-target distance, behind the entry. The ladder sets the target
  // and the target sets the stop, which is the order the user stated, and it is the same arithmetic on all four
  // pairs: no leg, no swing and no multiple of the instrument's own range enters it.
  //
  // Two callers state a ticket - the reading below, whose entry is a line a fresh candle crossed, and the trade's
  // own re-entry, whose entry is the level that trade was triggered on - so the arithmetic is stated once here and
  // each caller writes its own words around it. The two refusals it can reach are named rather than worded, so a
  // caller says which one it met in the terms of its own reading.
  function ticketGeometry({ entry, side, levels, point, rMultiple, minBreak }) {
    const targetLevel = side === "long" ? nearestAbove(levels, entry) : nearestBelow(levels, entry);
    const reward = targetLevel ? (side === "long" ? targetLevel.price - entry : entry - targetLevel.price) : null;
    if (!targetLevel || !(reward > 0)) {
      return { ok: false, cause: "no-target", target_level: targetLevel ? { ...targetLevel } : null, reward: null };
    }
    const risk = reward / rMultiple;
    if (!(risk > 0) || risk < minBreak) {
      return { ok: false, cause: "stop-inside-grid", target_level: { ...targetLevel }, reward: roundPrice(reward) };
    }
    return {
      ok: true,
      target_level: { ...targetLevel },
      target: roundPrice(targetLevel.price),
      stop: roundPrice(side === "long" ? entry - risk : entry + risk),
      risk: roundPrice(risk),
      reward: roundPrice(reward)
    };
  }

  // The reading for one instrument. The stages, in the order they are checked:
  //
  //   blocked      an open position already sits on this pair, and the rule holds one at a time;
  //   no-call      Layer 1 published no direction for the asset, so there is nothing to trade with;
  //   no-levels    no L2L price is marked for the symbol, so there is nothing to deviate from;
  //   unavailable  too few M5 bars are published to judge a close;
  //   waiting      a live reading: the newest close has not cleared a marked level in the call's direction;
  //   confirmed    the newest close is beyond a level, and the ticket is the limit back at that level.
  function buildPlan(options = {}) {
    const symbol = String(options.symbol || "").trim() || null;
    const direction = normaliseDirection(options.direction);
    const side = sideForDirection(options.direction);
    const levels = readLevels(options.levels);
    // The confirming candle is the newest *closed* five-minute bar: with an instant handed in, a bar whose
    // own five minutes have not elapsed is dropped, so the rule never fires on a close that is still moving.
    const bars = isFiniteNumber(Number(options.nowMs)) ? closedBars(options.bars, Number(options.nowMs)) : readBars(options.bars);
    const point = positiveNumber(options.point);
    const rMultiple = positiveNumber(options.rMultiple) || REWARD_R_MULTIPLE;
    // The margin a close must clear a level by before it counts as having closed beyond it: one point of
    // the instrument's own grid by default, the smallest distance that is a price at all.
    const minBreak = positiveNumber(options.minBreakPoints) || 1;

    const base = {
      available: false,
      stage: "unavailable",
      symbol,
      side,
      direction,
      timeframe: DEVIATION_TIMEFRAME,
      r_multiple: rMultiple,
      level: null,
      watch: null,
      confirmation: null,
      plan: null,
      reason: ""
    };

    if (options.position) {
      return {
        ...base,
        stage: "blocked",
        reason: `${symbol || "This pair"} already holds an open position, and the rule keeps one trade at a time on a pair.`
      };
    }
    if (!side) {
      return {
        ...base,
        stage: "no-call",
        reason: `Layer 1 published ${direction || "no"} direction for this asset, and the rule takes no trade without one.`
      };
    }
    if (!levels.length) {
      return {
        ...base,
        stage: "no-levels",
        reason: "No L2L level is marked for this pair, so there is no line for price to deviate from."
      };
    }
    if (bars.length < MIN_BARS) {
      return {
        ...base,
        stage: "unavailable",
        reason: `Fewer than ${MIN_BARS} ${DEVIATION_TIMEFRAME} bars are published for this pair, so no close can be judged.`
      };
    }

    const confirming = bars[bars.length - 1];
    const previous = bars.length > 1 ? bars[bars.length - 2] : null;
    const breakMargin = point ? minBreak * point : 0;
    // What the rule is waiting for is a *crossing*, not a position: the newest closed candle has to finish
    // beyond a level that the candle before it had not finished beyond. A price that has simply been sitting
    // above a line for hours has crossed nothing, and firing there would put a limit on a stale distance.
    // The line a long crossed is the highest one below the confirming close, a short the lowest one above it.
    // That is a tie-break and not a reading of the rule: the user ruled the case out on 2026-10-05 - a five-minute
    // candle is never wide enough to finish past two marked lines at once - so it stands only as a guard against a
    // ladder marked tighter than one M5 candle can travel, not as the rule's own choice of entry.
    const crossed = levels.filter(level => {
      if (side === "long") return confirming.close > level.price && (!previous || previous.close <= level.price);
      return confirming.close < level.price && (!previous || previous.close >= level.price);
    });
    const cleared = crossed.length ? (side === "long" ? crossed[0] : crossed[crossed.length - 1]) : null;
    const beyond = cleared
      ? (side === "long" ? confirming.close - cleared.price : cleared.price - confirming.close)
      : null;

    if (!cleared || !(beyond > 0) || beyond < breakMargin) {
      const next = side === "long" ? nearestAbove(levels, confirming.close) : nearestBelow(levels, confirming.close);
      const distance = next ? priceDelta(confirming.close, next.price, point) : null;
      const words = distance
        ? ` the nearest line is ${next.price}${distance.points === null ? "" : ` (${distance.points} points)`} away`
        : " no marked line is left in that direction";
      return {
        ...base,
        stage: "waiting",
        watch: next ? { level: { ...next }, distance } : null,
        confirmation: {
          time_utc: confirming.time_utc,
          close: roundPrice(confirming.close),
          beyond: null
        },
        reason: `Waiting for a ${DEVIATION_TIMEFRAME} close ${side === "long" ? "above" : "below"} a marked level: the newest closed candle at ${confirming.close} has not crossed one, and${words}.`
      };
    }

    // The ticket, in the user's own four steps, and none of it is invented here. The entry is the line the
    // candle deviated - the limit that is left at it, because the rule buys the retrace back to that line rather
    // than the breakout candle - and the three prices below it are `ticketGeometry`'s, stated once for both this
    // reading and the trade's own re-entry.
    const entry = roundPrice(cleared.price);
    const geometry = ticketGeometry({ entry, side, levels, point, rMultiple, minBreak: breakMargin });
    const confirmation = {
      time_utc: confirming.time_utc,
      close: roundPrice(confirming.close),
      beyond: priceDelta(cleared.price, confirming.close, point)
    };

    if (!geometry.ok && geometry.cause === "no-target") {
      return {
        ...base,
        stage: "waiting",
        level: { ...cleared },
        confirmation,
        reason: `${entry} is the last marked line on that side: no L2L line is marked ${side === "long" ? "above" : "below"} the level that was deviated, so there is no next line for the ${rMultiple}R target to sit at and the rule states no ticket.`
      };
    }

    if (!geometry.ok) {
      return {
        ...base,
        stage: "waiting",
        level: { ...cleared },
        confirmation,
        reason: `The next marked line at ${roundPrice(geometry.target_level.price)} is ${geometry.reward} from the level, so five to one puts the stop inside the level's own tick: the rule states no ticket rather than a stop the instrument's grid cannot express.`
      };
    }

    const { stop, target } = geometry;
    return {
      ...base,
      available: true,
      stage: "confirmed",
      level: { ...cleared },
      watch: null,
      confirmation,
      plan: {
        side,
        entry,
        stop,
        target,
        target_level: geometry.target_level,
        risk: geometry.risk,
        reward: geometry.reward,
        r_multiple: rMultiple,
        risk_points: point ? Math.round(geometry.risk / point) : null,
        reward_points: point ? Math.round(geometry.reward / point) : null,
        // Where the ticket goes first: back to the level, which is why the entry is a limit rather than a
        // market order - the rule buys the retrace, not the breakout candle.
        entry_type: "limit"
      },
      reason: `${symbol || "The instrument"} closed ${side === "long" ? "above" : "below"} ${entry} on the newest ${DEVIATION_TIMEFRAME} candle, so the rule sits a limit at that line and aims the ${rMultiple}R target at the next marked line ${target}: the stop is one fifth of that distance behind the entry, at ${stop}.`
    };
  }

  // The ticket for a trade the pair already has on, priced from the level that trade was triggered on rather
  // than from a fresh crossing. The user corrected this on 2026-10-05, in his own words: "It should have re-entered
  // at the same level it originally was triggered on until price crosses the next level. Until the next level as
  // crossed the trigger level is the main entry level and you re-enter on that level until either the direction
  // changes or TP is hit". So the entry is handed in, the target and the stop are `ticketGeometry`'s same
  // arithmetic on the same ladder - the next marked line past that level and a fifth of the distance behind it -
  // and no candle is asked for a crossing at all: the crossing that opened this trade has already happened, and
  // this is still that same trade.
  //
  // It answers the arithmetic and nothing else. Whether the trade is still the pair's own - the call it was left
  // for, and whether its target has been reached - is a question about the account and the account's history, and
  // it is decided where those are read.
  function reentryPlan(options = {}) {
    const symbol = String(options.symbol || "").trim() || null;
    const side = options.side === "long" || options.side === "short" ? options.side : null;
    const entry = positiveNumber(options.entry);
    const levels = readLevels(options.levels);
    const point = positiveNumber(options.point);
    const rMultiple = positiveNumber(options.rMultiple) || REWARD_R_MULTIPLE;
    const minBreak = positiveNumber(options.minBreakPoints) || 1;
    const base = {
      available: false,
      stage: "unavailable",
      symbol,
      side,
      direction: side === "long" ? "BULLISH" : side === "short" ? "BEARISH" : null,
      timeframe: DEVIATION_TIMEFRAME,
      r_multiple: rMultiple,
      level: entry === null ? null : { price: entry, role: "trade", label: `trade entry ${entry}` },
      watch: null,
      confirmation: null,
      plan: null,
      reason: ""
    };

    if (!side) {
      return {
        ...base,
        stage: "no-call",
        reason: `${symbol || "This pair"} carries a trade whose own side cannot be read, so the level it was triggered on states no ticket.`
      };
    }
    if (entry === null) {
      return {
        ...base,
        stage: "unavailable",
        reason: `The level ${symbol || "this pair"} was triggered on is not a price, so the entry it goes back to cannot be stated.`
      };
    }
    if (!levels.length) {
      return {
        ...base,
        stage: "no-levels",
        reason: `No L2L line is marked for ${symbol || "this pair"}, so the next marked line the ${rMultiple}R target sits on cannot be read for the trade at ${entry}.`
      };
    }

    const geometry = ticketGeometry({
      entry,
      side,
      levels,
      point,
      rMultiple,
      minBreak: point ? minBreak * point : 0
    });

    if (!geometry.ok && geometry.cause === "no-target") {
      return {
        ...base,
        stage: "waiting",
        reason: `${entry} is the last marked line on that side: no L2L line is marked ${side === "long" ? "above" : "below"} the level this trade was triggered on, so there is no next line for the ${rMultiple}R target to sit at and the trade states no ticket to put back.`
      };
    }
    if (!geometry.ok) {
      return {
        ...base,
        stage: "waiting",
        reason: `The next marked line at ${roundPrice(geometry.target_level.price)} is ${geometry.reward} from the level this trade was triggered on, so five to one puts the stop inside the level's own tick: the trade states no ticket to put back rather than a stop the instrument's grid cannot express.`
      };
    }

    return {
      ...base,
      available: true,
      stage: "confirmed",
      plan: {
        side,
        entry,
        stop: geometry.stop,
        target: geometry.target,
        target_level: geometry.target_level,
        risk: geometry.risk,
        reward: geometry.reward,
        r_multiple: rMultiple,
        risk_points: point ? Math.round(geometry.risk / point) : null,
        reward_points: point ? Math.round(geometry.reward / point) : null,
        // The same limit as any other ticket: the rule buys the retrace back to the line, so the entry is a
        // limit at the level the trade was triggered on rather than a market order at the price now.
        entry_type: "limit"
      },
      reason: `${symbol || "This pair"} is still in the trade it was triggered at ${entry}: the limit goes back to that same level, the ${rMultiple}R target stays on the next marked line ${geometry.target} and the stop one fifth of that distance behind the entry, at ${geometry.stop}.`
    };
  }

  // The magic number every ticket this lane places carries: `ORDER_MAGIC` in
  // scripts/run-live-trading-trader.js and `MAGIC` in tools/mt5-bridge/live-trading-order.py, held to the
  // same number by the tests. A pending order or an open position carrying it is a trade this lane is in;
  // a row carrying anything else was placed by another path, and is not read here as this lane's trade.
  const LANE_MAGIC = 20261004;

  // The instant a holding was placed on, as an epoch, so one pair's rows can be ordered newest-last
  // whichever of the two shapes they came from: an order carries `placed`, a position `opened`.
  function holdingStampMs(holding) {
    const value = holding?.placed?.time_utc ?? holding?.opened?.time_utc ?? holding?.placed ?? holding?.opened;
    const parsed = typeof value === "string" ? Date.parse(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // The account's own trades, one per pair: every pending order and open position the feed publishes that
  // carries this lane's magic, reduced to the fields a reading is about - which ticket, which side, the
  // level it sits at or was filled at, and the stop and the target it carries. Rows of another magic are
  // dropped rather than shown as this lane's, and a row with no readable level is dropped whole: a ticket
  // whose price cannot be read states no level to trade back to.
  function laneHoldings(input = {}) {
    const magic = positiveNumber(input.magic) ?? LANE_MAGIC;
    const rows = [];
    const collect = (source, kind) => {
      (Array.isArray(source) ? source : []).forEach(row => {
        if (!row || typeof row !== "object") return;
        if (Number(row.magic) !== magic) return;
        const entry = positiveNumber(row.price_open);
        if (!entry) return;
        rows.push({
          symbol: typeof row.symbol === "string" ? row.symbol : null,
          dashboard_asset: typeof row.dashboard_asset === "string" ? row.dashboard_asset : null,
          ticket: toNumber(row.ticket),
          kind,
          side: row.side ?? null,
          type: typeof row.type === "string" ? row.type : null,
          entry,
          stop: positiveNumber(row.stop_loss),
          target: positiveNumber(row.take_profit),
          volume: positiveNumber(row.volume),
          comment: typeof row.comment === "string" ? row.comment : "",
          magic: Number(row.magic),
          placed: row.placed ?? row.opened ?? null,
          stamp: holdingStampMs(row)
        });
      });
    };
    // A position and a leftover order can both exist on one pair after a fill; the newest row is the trade.
    collect(input.positions, "position");
    collect(input.orders, "order");
    const newest = new Map();
    rows.forEach(row => {
      if (!row.symbol) return;
      const seen = newest.get(row.symbol);
      const better = !seen
        || (row.stamp ?? -1) > (seen.stamp ?? -1)
        || ((row.stamp ?? -1) === (seen.stamp ?? -1) && row.ticket > seen.ticket);
      if (better) newest.set(row.symbol, row);
    });
    return [...newest.values()].sort((a, b) => a.ticket - b.ticket);
  }

  // The price a holding's own level, stop and target are compared on: the instrument's own precision,
  // because the terminal stores the level it was sent rounded to the symbol's digits while the arithmetic
  // here is stated to six. A ticket that agrees to the grid it was sent on is the rule's ticket; one that
  // disagrees is stated as what the account carries rather than quietly read as the rule's.
  function decimalsFor(point) {
    const numeric = positiveNumber(point);
    if (!numeric) return 6;
    return Math.max(0, Math.min(8, Math.round(-Math.log10(numeric))));
  }

  function sameToGrid(value, expected, decimals) {
    if (!isFiniteNumber(value) || !isFiniteNumber(expected)) return null;
    return Number(value.toFixed(decimals)) === Number(expected.toFixed(decimals));
  }

  // The reading for a pair this lane already has a trade on - the correction the user made on 2026-10-05,
  // stated on the page: the trade's own level is the entry until the call for the asset changes or the
  // target is taken, not a fresh crossing somewhere else on the ladder. The ticket is priced by the same
  // `reentryPlan` arithmetic the loop places from - the next marked line past that level and a fifth of
  // that distance behind it - and the account's own copy of the ticket is stated beside it, compared at the
  // instrument's own precision, so a reader can see whether what is working is what the rule reads.
  //
  // It decides nothing: whether the trade is still the pair's own is the loop's, decided where the account
  // and its history are read. This states what the published artifacts say about a ticket already there.
  function holdingPlan(options = {}) {
    const symbol = String(options.symbol || "").trim() || null;
    const holding = options.holding && typeof options.holding === "object" ? options.holding : null;
    const kind = holding?.kind === "position" ? "position" : "order";
    const side = holding?.side === "long" || holding?.side === "buy"
      ? "long"
      : holding?.side === "short" || holding?.side === "sell" ? "short" : null;
    const entry = positiveNumber(holding?.entry ?? holding?.price_open);
    const levels = readLevels(options.levels);
    const point = positiveNumber(options.point);
    const rMultiple = positiveNumber(options.rMultiple) || REWARD_R_MULTIPLE;
    const minBreak = positiveNumber(options.minBreakPoints) || 1;
    const ticket = toNumber(holding?.ticket);
    const ownStop = positiveNumber(holding?.stop);
    const ownTarget = positiveNumber(holding?.target);
    const base = {
      available: true,
      stage: "in-trade",
      symbol,
      side,
      direction: side === "long" ? "BULLISH" : side === "short" ? "BEARISH" : null,
      timeframe: DEVIATION_TIMEFRAME,
      r_multiple: rMultiple,
      level: entry === null ? null : { price: entry, role: "trade", label: `trade entry ${entry}` },
      watch: null,
      confirmation: null,
      plan: null,
      holding: null,
      reason: ""
    };
    if (!holding || entry === null) {
      return {
        ...base,
        available: false,
        stage: "unavailable",
        reason: `${symbol || "This pair"} has no readable ticket on the account, so no trade's own level can be stated.`
      };
    }

    // The newest closed five-minute bar, stated beside the trade rather than as a crossing: the crossing
    // that opened this trade has already happened, and what the bar says now is the market it is in. It is
    // also what the panel's "newest closed M5" column reads, so the row is not blank where the trade is on.
    const bars = isFiniteNumber(Number(options.nowMs))
      ? closedBars(options.bars, Number(options.nowMs))
      : readBars(options.bars);
    const newest = bars.length ? bars[bars.length - 1] : null;
    const confirmation = newest ? { time_utc: newest.time_utc, close: roundPrice(newest.close), beyond: null } : null;
    const placed = holding?.placed ?? holding?.opened ?? null;
    const accountRow = (stopMatches, targetMatches) => ({
      ticket,
      kind,
      entry,
      stop: ownStop,
      target: ownTarget,
      placed,
      magic: Number.isFinite(Number(holding?.magic)) ? Number(holding.magic) : null,
      comment: typeof holding?.comment === "string" ? holding.comment : "",
      type: typeof holding?.type === "string" ? holding.type : null,
      volume: positiveNumber(holding?.volume),
      stop_matches: stopMatches,
      target_matches: targetMatches
    });
    const placedText = placed?.time_utc ? ` placed ${String(placed.time_utc)}` : "";
    const ticketText = `${Number.isFinite(ticket) ? `ticket ${ticket}` : "ticket unstated"}, ${
      kind === "position"
        ? "filled position"
        : `working ${String(holding?.type || "pending order").replace(/^ORDER_TYPE_/, "").toLowerCase().replace(/_/g, " ")}`
    }`;
    const ownLevels = ownStop === null && ownTarget === null
      ? " The account's own copy of it carries no stop and no target."
      : ` The account's own copy of it carries stop ${ownStop === null ? "unstated" : ownStop} and target ${ownTarget === null ? "unstated" : ownTarget}.`;
    const endings = `${symbol || "This pair"} stays in the trade it was triggered on at ${entry}${placedText} (${ticketText}): ${
      kind === "position" ? "the position it was filled into sits there" : "the limit still sits at that level"
    }, and that level is its entry until the call for ${holding?.dashboard_asset || symbol || "the asset"} changes or the target is taken - not a fresh crossing elsewhere on the ladder.`;

    if (!side) {
      return {
        ...base,
        confirmation,
        holding: accountRow(null, null),
        reason: `${endings} The side the ticket faces cannot be read from the feed, so no ticket arithmetic is stated with it.${ownLevels}`
      };
    }

    const inner = reentryPlan({ symbol, side, entry, levels, point, rMultiple, minBreakPoints: minBreak });
    const plan = inner?.plan || null;
    if (!plan) {
      return {
        ...base,
        confirmation,
        holding: accountRow(null, null),
        reason: `${endings} The ladder states no ticket back at that level: ${inner?.reason || "no next marked line is readable"}.${ownLevels}`
      };
    }

    const decimals = decimalsFor(point);
    const stopMatches = sameToGrid(ownStop, plan.stop, decimals);
    const targetMatches = sameToGrid(ownTarget, plan.target, decimals);
    const agreement = stopMatches === true && targetMatches === true
      ? ` The account's own copy agrees with that arithmetic at the instrument's own precision: stop ${plan.stop} and target ${plan.target}.`
      : ` The account's own copy carries stop ${ownStop === null ? "unstated" : ownStop} and target ${ownTarget === null ? "unstated" : ownTarget} against that arithmetic, which reads ${plan.stop} and ${plan.target}.`;
    return {
      ...base,
      level: { price: plan.entry, role: "trade", label: `trade entry ${plan.entry}` },
      watch: plan.target_level
        ? { level: { ...plan.target_level }, distance: { price: plan.reward, points: plan.reward_points } }
        : null,
      confirmation,
      plan,
      holding: accountRow(stopMatches, targetMatches),
      reason: `${endings} The next marked line past it is ${plan.target}, held as ${plan.reward} (${
        plan.reward_points
      } points) away, and the stop is one fifth of that distance behind the entry, at ${plan.stop} - the same arithmetic the loop itself places from, so the ticket is a limit back at ${plan.entry}.${agreement}`
    };
  }

  // One reading per instrument, in the order the caller gives them, so the dashboard can state every pair's
  // stage rather than only the pair on screen. `calls` is keyed by the dashboard's asset code (EUR, GOLD,
  // NQ, BTC), which is the same code the marked file and the feed both carry. An instant handed in as
  // `nowMs` is handed straight through to every reading, so a caller that knows the clock gets one answer
  // to "has this five-minute bar closed yet" for all four pairs rather than one answer per pair.
  function strategyReadings(input = {}) {
    const instruments = Array.isArray(input.instruments) ? input.instruments : [];
    const positions = Array.isArray(input.positions) ? input.positions : [];
    // The account's own tickets for this lane, already reduced to one row per pair: a pair carrying one is
    // read as the trade it is in rather than as a fresh crossing, which is the reading the user corrected.
    const holdings = Array.isArray(input.holdings) ? input.holdings : [];
    const calls = input.calls && typeof input.calls === "object" ? input.calls : {};
    return instruments.map(instrument => {
      const holding = holdings.find(row => row?.symbol && row.symbol === instrument?.symbol) || null;
      if (holding) {
        return holdingPlan({
          symbol: instrument?.symbol,
          holding,
          levels: instrument?.levels,
          bars: instrument?.m5?.bars,
          point: instrument?.point,
          nowMs: input.nowMs,
          rMultiple: input.rMultiple,
          minBreakPoints: input.minBreakPoints
        });
      }
      return buildPlan({
        symbol: instrument?.symbol,
        direction: calls[instrument?.dashboard_asset],
        levels: instrument?.levels,
        bars: instrument?.m5?.bars,
        point: instrument?.point,
        nowMs: input.nowMs,
        position: positions.find(position => position?.symbol === instrument?.symbol) || null,
        rMultiple: input.rMultiple,
        minBreakPoints: input.minBreakPoints
      });
    });
  }

  // How many of the readings carry a ticket, how many are live readings rather than refusals, and how many
  // pairs are already in a trade of this lane's: the numbers the section states above the list.
  function strategySummary(readings) {
    const rows = Array.isArray(readings) ? readings : [];
    return {
      instruments: rows.length,
      confirmed: rows.filter(row => row.stage === "confirmed").length,
      waiting: rows.filter(row => row.stage === "waiting").length,
      inTrade: rows.filter(row => row.stage === "in-trade").length,
      blocked: rows.filter(row => row.stage === "blocked").length,
      noCall: rows.filter(row => row.stage === "no-call").length,
      noLevels: rows.filter(row => row.stage === "no-levels").length,
      unavailable: rows.filter(row => row.stage === "unavailable").length
    };
  }

  // The three prices a ticket is drawn from, in the order a chart stacks them, so the page draws the lines
  // without working any of them out itself. A pair already in a trade carries a ticket too - the trade's
  // own level and the stop and target that follow from it - and it is drawn the same way, with the entry
  // labelled as the trade's own rather than as a fresh L2L crossing.
  function planMarkerPrices(plan) {
    if (!plan || !plan.plan) return [];
    if (plan.stage !== "confirmed" && plan.stage !== "in-trade") return [];
    const ticket = plan.plan;
    const own = plan.stage === "in-trade";
    return [
      { key: "entry", price: ticket.entry, label: own ? `trade entry ${ticket.entry}` : `limit at L2L ${ticket.entry}` },
      { key: "stop", price: ticket.stop, label: `stop ${ticket.stop}` },
      { key: "target", price: ticket.target, label: `${ticket.r_multiple}R target ${ticket.target}` }
    ];
  }

  return {
    DEVIATION_TIMEFRAME,
    REWARD_R_MULTIPLE,
    MIN_BARS,
    LANE_MAGIC,
    STAGES,
    SIDES,
    normaliseDirection,
    sideForDirection,
    readLevels,
    readBars,
    closedBars,
    nearestBelow,
    nearestAbove,
    buildPlan,
    reentryPlan,
    laneHoldings,
    holdingPlan,
    strategyReadings,
    strategySummary,
    planMarkerPrices
  };
});


