// The L2L deviation rule, shared by the live dashboard and the tests that hold it.
//
// The rule, in the user's own words, is four steps: take the direction Layer 1 published for the asset,
// wait for a five-minute candle to *close* beyond a marked L2L level, put a limit order back at that level,
// and aim at five times the risk. "Close beyond" means the crossing candle itself: the newest closed M5 bar
// has to finish past a level that the bar before it did not finish past, because a price that has simply
// been sitting above a line for hours has crossed nothing. Everything here is arithmetic over three
// artifacts that already exist - the sealed calls in `data/layer1.json`, the marked ladder in
// `data/l2l-levels.json` and the M5 bars in `data/live-trading.json` - and nothing here places, sizes,
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
  // faster timeframe. It is also the timeframe the deviation leg is measured in, so one rule is read.
  const DEVIATION_TIMEFRAME = "M5";
  // The target, in multiples of the risk the stop defines: five.
  const REWARD_R_MULTIPLE = 5;
  // How far back the deviation leg may reach for its extreme. Twelve M5 bars is an hour: long enough to
  // hold the swing a re-entry is measured against, short enough that a stale range cannot define the stop.
  const DEVIATION_LOOKBACK_BARS = 12;
  // Fewer bars than this and no close can be judged at all: the rule refuses rather than reading one bar.
  const MIN_BARS = 3;
  // Where a reading can stand. `confirmed` is the only stage that carries a ticket; `waiting` is a live
  // reading, not a refusal; `blocked` is the one-trade-per-pair cap doing its work.
  const STAGES = Object.freeze(["unavailable", "no-call", "no-levels", "waiting", "confirmed", "blocked"]);
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

  // The leg that made the deviation: the run of closed bars ending at the confirming candle whose own closes
  // are all beyond the level, plus the one bar just before the run when that bar really is the previous five
  // minutes - the last price the rule saw at the level. A bar older than the previous bucket (a weekend, a
  // dropped row) cannot define the stop, so the leg is then the run alone, and the run itself is capped so a
  // stale range can never be what the stop is measured from.
  function bucketGapMs(from, to) {
    const start = from ? Date.parse(from) : Number.NaN;
    const end = to ? Date.parse(to) : Number.NaN;
    return Number.isFinite(start) && Number.isFinite(end) ? end - start : null;
  }

  function deviationLeg(bars, levelPrice, side) {
    const beyond = bar => (side === "long" ? bar.close > levelPrice : bar.close < levelPrice);
    let runStart = bars.length - 1;
    while (runStart > 0 && beyond(bars[runStart - 1])) runStart -= 1;
    const start = Math.max(runStart, Math.max(0, bars.length - 1 - DEVIATION_LOOKBACK_BARS));
    const anchor = start > 0 ? bars[start - 1] : null;
    const gap = anchor ? bucketGapMs(anchor.time_utc, bars[start].time_utc) : null;
    const adjacent = anchor && gap !== null && gap > 0 && gap <= DEVIATION_BAR_MS;
    return bars.slice(adjacent ? start - 1 : start);
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

    // The stop goes behind the extreme of the leg that made the deviation: the lowest low of the run that
    // carried price away from the level for a long, the highest high of it for a short. The entry is the
    // level itself - the limit the re-entry is placed at - so the risk is entry to that extreme.
    const leg = deviationLeg(bars, cleared.price, side);
    const extreme = side === "long"
      ? Math.min(...leg.map(bar => bar.low))
      : Math.max(...leg.map(bar => bar.high));
    const entry = roundPrice(cleared.price);
    const stop = roundPrice(extreme);
    const risk = side === "long" ? entry - stop : stop - entry;

    if (!(risk > 0) || risk < breakMargin) {
      return {
        ...base,
        stage: "waiting",
        level: { ...cleared },
        confirmation: {
          time_utc: confirming.time_utc,
          close: roundPrice(confirming.close),
          beyond: priceDelta(cleared.price, confirming.close, point)
        },
        reason: "The deviation leg has no measurable risk: its extreme sits at or through the level, so there is no distance to put a stop behind and a target in front of it."
      };
    }

    const target = side === "long" ? entry + rMultiple * risk : entry - rMultiple * risk;
    return {
      ...base,
      available: true,
      stage: "confirmed",
      level: { ...cleared },
      watch: null,
      confirmation: {
        time_utc: confirming.time_utc,
        close: roundPrice(confirming.close),
        beyond: priceDelta(cleared.price, confirming.close, point)
      },
      plan: {
        side,
        entry,
        stop,
        target: roundPrice(target),
        risk: roundPrice(risk),
        reward: roundPrice(rMultiple * risk),
        r_multiple: rMultiple,
        risk_points: point ? Math.round(risk / point) : null,
        reward_points: point ? Math.round((rMultiple * risk) / point) : null,
        // Where the ticket goes first: back to the level, which is why the entry is a limit rather than a
        // market order - the rule buys the retrace, not the breakout candle.
        entry_type: "limit",
        bars_in_leg: leg.length
      },
      reason: `${symbol || "The instrument"} closed ${side === "long" ? "above" : "below"} ${entry} on the newest ${DEVIATION_TIMEFRAME} candle, so the rule sits a limit at the level with the stop at ${stop} and ${rMultiple}R at ${roundPrice(target)}.`
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
    const calls = input.calls && typeof input.calls === "object" ? input.calls : {};
    return instruments.map(instrument => buildPlan({
      symbol: instrument?.symbol,
      direction: calls[instrument?.dashboard_asset],
      levels: instrument?.levels,
      bars: instrument?.m5?.bars,
      point: instrument?.point,
      nowMs: input.nowMs,
      position: positions.find(position => position?.symbol === instrument?.symbol) || null,
      rMultiple: input.rMultiple,
      minBreakPoints: input.minBreakPoints
    }));
  }

  // How many of the readings carry a ticket, and how many are live readings rather than refusals: the two
  // numbers the section states above the list.
  function strategySummary(readings) {
    const rows = Array.isArray(readings) ? readings : [];
    return {
      instruments: rows.length,
      confirmed: rows.filter(row => row.stage === "confirmed").length,
      waiting: rows.filter(row => row.stage === "waiting").length,
      blocked: rows.filter(row => row.stage === "blocked").length,
      noCall: rows.filter(row => row.stage === "no-call").length,
      noLevels: rows.filter(row => row.stage === "no-levels").length,
      unavailable: rows.filter(row => row.stage === "unavailable").length
    };
  }

  // The three prices a confirmed ticket is drawn from, in the order a chart stacks them, so the page draws
  // the lines without working any of them out itself.
  function planMarkerPrices(plan) {
    if (!plan || plan.stage !== "confirmed" || !plan.plan) return [];
    const ticket = plan.plan;
    return [
      { key: "entry", price: ticket.entry, label: `limit at L2L ${ticket.entry}` },
      { key: "stop", price: ticket.stop, label: `stop ${ticket.stop}` },
      { key: "target", price: ticket.target, label: `${ticket.r_multiple}R target ${ticket.target}` }
    ];
  }

  return {
    DEVIATION_TIMEFRAME,
    REWARD_R_MULTIPLE,
    DEVIATION_LOOKBACK_BARS,
    MIN_BARS,
    STAGES,
    SIDES,
    normaliseDirection,
    sideForDirection,
    readLevels,
    readBars,
    closedBars,
    nearestBelow,
    nearestAbove,
    deviationLeg,
    buildPlan,
    strategyReadings,
    strategySummary,
    planMarkerPrices
  };
});


