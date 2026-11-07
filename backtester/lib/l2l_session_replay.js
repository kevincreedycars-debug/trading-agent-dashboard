"use strict";

/**
 * The L2L trade replay on five-minute bars.
 *
 * This is the live rule of `lib/l2l_strategy.js` at `origin/main` replayed over a tape of M5 bars, one
 * session at a time, for two variants the caller names:
 *
 *   `rMultiple: 5` on the original ladder   the deployed arithmetic: the entry is the marked line a
 *                                           five-minute close crossed, the target is the next marked line in
 *                                           the trade's direction, and the stop is one fifth of that distance;
 *   `rMultiple: 3` on the half grid         the same rule with the midpoint between adjacent marked lines
 *                                           added as an eligible line, and the stop a third of the distance.
 *
 * What is preserved from the live trader, because a replay that quietly improved any of it would not be the
 * same rule: the trigger is a *crossing* (the newest closed M5 bar finishes past a line the bar before it did
 * not), never a price that has merely been sitting beyond one; the entry is a limit back at the crossed line,
 * not the breakout candle; the limit carries no expiry of its own and ends only when it fills, when the target
 * is taken without it, or when the call that left it ends; a stopped-out trade is re-entered at the same level
 * until the target is taken or a different line is crossed; and one trade at a time per pair.
 *
 * What it does not carry: spread, commission or slippage (there is no bid/ask history to carry), and the daily
 * Layer 1 call itself. The direction is an input with its own timestamp, so the caller must state where the
 * call came from; this module never invents one.
 *
 * Where one bar cannot say which of two touches came first - a bar that both fills the limit and reaches the
 * target, or one that reaches both the stop and the target after a fill - the trade is marked ambiguous and
 * resolved pessimistically, which is the repository's own `STOP_FIRST_PESSIMISTIC` convention. Finer data is
 * not staged anywhere in this checkout, so the flag is the whole of what the replay can honestly say there.
 *
 * Nothing here places, sizes, modifies or sends an order and nothing here reads a live file: it is arithmetic
 * over arrays the caller hands in.
 */

const ORIGINAL = "original";
const MIDPOINT = "midpoint";

const EXIT = Object.freeze({
  TARGET: "target",
  STOP: "stop",
  WORKING: "working-at-end-of-tape",
  INVALIDATED: "invalidated-target-reached-before-fill"
});

const AMBIGUITY = Object.freeze({
  FILL_AND_TARGET_IN_ONE_BAR: "fill-and-target-in-one-bar",
  FILL_AND_STOP_IN_ONE_BAR: "fill-and-stop-in-one-bar",
  STOP_AND_TARGET_IN_ONE_BAR: "stop-and-target-in-one-bar",
  TARGET_AND_FILL_IN_ONE_BAR: "target-and-fill-in-one-bar"
});

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
}

/** The live files round a price to six decimal places; the replay rounds nowhere else. */
function roundPrice(value) {
  return Number(Number(value).toFixed(6));
}

/**
 * The rounding the live trader applies to a ticket: a price is stated to the instrument's own number of
 * digits, never beyond it (`scripts/run-live-trading-trader.js` rounds with `toFixed(digits)` where the digits
 * come from the terminal). A replay that kept a sixth decimal would put its stop two tenths of a point further
 * out than the order the account actually carried.
 */
function roundTo(value, digits) {
  const places = Number.isInteger(digits) && digits >= 0 && digits <= 8 ? digits : 6;
  return Number(Number(value).toFixed(places));
}

/**
 * The bars the rule reads, oldest first, with only the fields it needs. A row that is missing a price is
 * dropped rather than repaired, the same reading `readBars` makes in `lib/l2l_strategy.js`.
 *
 * @param {Array<object>} bars rows carrying `time_utc`, `open`, `high`, `low`, `close`
 * @returns {Array<object>} normalised bars, sorted by their own clock
 */
function readBars(bars) {
  return (Array.isArray(bars) ? bars : [])
    .map(bar => ({
      timeUtc: typeof bar?.time_utc === "string" ? bar.time_utc : null,
      timeMs: typeof bar?.time_utc === "string" ? Date.parse(bar.time_utc) : Number.NaN,
      open: toNumber(bar?.open),
      high: toNumber(bar?.high),
      low: toNumber(bar?.low),
      close: toNumber(bar?.close)
    }))
    .filter(bar => isFiniteNumber(bar.timeMs) && isFiniteNumber(bar.open) &&
      isFiniteNumber(bar.high) && isFiniteNumber(bar.low) && isFiniteNumber(bar.close))
    .sort((a, b) => a.timeMs - b.timeMs);
}

/** A marked level list as `data/l2l-levels.json` carries it: a positive price and what kind of line it is. */
function readLevels(levels) {
  return (Array.isArray(levels) ? levels : [])
    .map(level => ({
      price: toNumber(level?.price),
      role: level?.role === "derived" ? "derived" : "seed",
      kind: typeof level?.kind === "string" ? level.kind : null,
      label: String(level?.label || level?.name || "")
    }))
    .filter(level => isFiniteNumber(level.price) && level.price > 0)
    .sort((a, b) => b.price - a.price);
}


/**
 * The lines a variant may trade from, highest first.
 *
 * `halfGrid: false` keeps the ladder exactly as it is marked. `halfGrid: true` adds, for every adjacent pair
 * of marked lines, the midpoint between them, computed here from the session's own ladder rather than stored
 * anywhere, so a re-marked ladder cannot leave a stale midpoint behind. Originals are never displaced.
 *
 * @param {Array<object>} levels marked levels as the file carries them
 * @param {{halfGrid?: boolean}} [options]
 * @returns {Array<object>} grid rows `{ price, source, role, label, between? }`, highest first
 */
function buildGrid(levels, options = {}) {
  const marked = readLevels(levels);
  const grid = marked.map(level => ({
    price: level.price,
    source: ORIGINAL,
    role: level.role,
    label: level.label
  }));
  if (options.halfGrid === true) {
    for (let index = 1; index < marked.length; index += 1) {
      const high = marked[index - 1].price;
      const low = marked[index].price;
      if (!(high > low)) continue;
      grid.push({
        price: roundPrice((high + low) / 2),
        source: MIDPOINT,
        role: MIDPOINT,
        label: `midpoint ${roundPrice(low)}-${roundPrice(high)}`,
        between: [roundPrice(low), roundPrice(high)]
      });
    }
  }
  return grid.sort((a, b) => b.price - a.price);
}

function nearestAbove(grid, price) {
  const over = grid.filter(level => level.price > price);
  return over.length ? over[over.length - 1] : null;
}

function nearestBelow(grid, price) {
  const under = grid.filter(level => level.price < price);
  return under.length ? under[0] : null;
}

/**
 * The three prices of one ticket: the target is the next line past the entry in the trade's own direction and
 * the stop is the distance that makes that target worth `rMultiple` times the risk. This is
 * `ticketGeometry` in `lib/l2l_strategy.js` with the grid handed in rather than the raw ladder, which is the
 * only difference between the 5R original variant and the 3R half-grid variant.
 *
 * @returns {{ok: boolean, cause?: string, target?: number, stop?: number, risk?: number, reward?: number, targetLevel?: object}}
 */
function ticketGeometry({ entry, side, grid, rMultiple, minBreak, digits }) {
  const targetLevel = side === "long" ? nearestAbove(grid, entry) : nearestBelow(grid, entry);
  const reward = targetLevel ? (side === "long" ? targetLevel.price - entry : entry - targetLevel.price) : null;
  if (!targetLevel || !(reward > 0)) {
    return { ok: false, cause: "no-target", targetLevel: targetLevel || null };
  }
  const risk = reward / rMultiple;
  if (!(risk > 0) || risk < minBreak) {
    return { ok: false, cause: "stop-inside-grid", targetLevel, reward: roundTo(reward, digits) };
  }
  return {
    ok: true,
    targetLevel,
    target: roundTo(targetLevel.price, digits),
    stop: roundTo(side === "long" ? entry - risk : entry + risk, digits),
    risk: roundTo(risk, digits),
    reward: roundTo(reward, digits)
  };
}

/**
 * The line a bar crossed, if it crossed one: the newest close finished past a line the previous close had not
 * finished past, by at least the instrument's own minimum break. A long takes the highest such line and a
 * short the lowest, exactly the tie-break `buildPlan` states.
 *
 * @returns {object|null} the cleared grid row
 */
function crossingFor({ bar, previous, side, grid, minBreak }) {
  const crossed = grid.filter(level => {
    if (side === "long") return bar.close > level.price && (!previous || previous.close <= level.price);
    return bar.close < level.price && (!previous || previous.close >= level.price);
  });
  const cleared = crossed.length ? (side === "long" ? crossed[0] : crossed[crossed.length - 1]) : null;
  if (!cleared) return null;
  // A crossing is two consecutive bars, so a bar that follows a hole in the tape has nothing to cross from:
  // the first bar after a weekend or an outage is not a candle that finished past a line the one before it
  // did not. Ten minutes is the tolerance, because one missing M5 bar is a hole, not a session.
  if (previous && bar.timeMs - previous.timeMs > 10 * 60000) return null;
  const beyond = side === "long" ? bar.close - cleared.price : cleared.price - bar.close;
  if (!(beyond > 0) || beyond < minBreak) return null;
  return cleared;
}

/**
 * Whether a limit at `level` can rest where the market is now: a sell limit has to sit above the market and a
 * buy limit below it, or it is a market order wearing a limit's clothes. This is the refusal the live trader
 * makes before it places anything (`scripts/run-live-trading-trader.js`: "a buy limit at or above the market
 * is a buy now, a sell limit at or below it is a sell now"), and a replay that skipped it would take fills the
 * live account could never be given.
 */
function canPlace({ side, level, market }) {
  if (!isFiniteNumber(level) || !isFiniteNumber(market)) return false;
  return side === "short" ? level > market : level < market;
}

/**
 * The position size the replay states: a fixed fraction of the running simulated balance is risked on the
 * stop, rounded down to the instrument's own lot step and never below its minimum lot. The live trader sizes
 * at the instrument minimum and says so; this is the study's own sizing rule, kept in one place so a change
 * is a visible change and not a silent one.
 */
function sizePosition({ balance, riskPct, stopDistance, contractSize, minLot, lotStep }) {
  const riskAmount = balance * riskPct;
  const lossPerLot = stopDistance * contractSize;
  const rawLots = lossPerLot > 0 ? riskAmount / lossPerLot : 0;
  const step = lotStep > 0 ? lotStep : 0.01;
  const stepped = Math.floor(rawLots / step) * step;
  const lots = Math.max(minLot > 0 ? minLot : step, Number(stepped.toFixed(8)));
  return { riskAmount, rawLots, lots, lotStep: step };
}


function positiveNumber(value) {
  const numeric = toNumber(value);
  return isFiniteNumber(numeric) && numeric > 0 ? numeric : null;
}

/** A session list as the caller states it: London-day label plus both ends, however they were resolved. */
function normaliseSessions(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .map(session => {
      const startMs = isFiniteNumber(session?.startMs) ? session.startMs : Date.parse(session?.cutoff_at_utc || "");
      const endMs = isFiniteNumber(session?.endMs) ? session.endMs : Date.parse(session?.endpoint_at_utc || "");
      return {
        date: String(session?.date || (isFiniteNumber(startMs) ? new Date(startMs).toISOString().slice(0, 10) : "")),
        startMs,
        endMs
      };
    })
    .filter(session => isFiniteNumber(session.startMs) && isFiniteNumber(session.endMs) && session.endMs > session.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

function sessionContaining(sessions, instantMs) {
  return sessions.find(session => instantMs >= session.startMs && instantMs < session.endMs) || null;
}


/**
 * Replay the rule over one tape of bars and one call direction.
 *
 * The direction is the daily Layer 1 call and is held constant for the whole tape, which is what a single
 * published call does inside its own forecast window: `callAsOfUtc` is the caller's evidence for it, and the
 * result repeats it so no reader has to trust a caption.
 *
 * @param {object} options
 * @param {Array<object>} options.bars M5 bars for one instrument
 * @param {Array<object>} options.levels marked levels for that instrument
 * @param {"long"|"short"} options.side the call's side
 * @param {number} [options.rMultiple] 5 for the original ladder, 3 for the half grid
 * @param {boolean} [options.halfGrid] add midpoints between adjacent marked lines
 * @param {number} [options.point] instrument point, for the one-point minimum break
 * @param {Array<object>} [options.sessions] London sessions `{date, startMs, endMs}`
 * @param {number} [options.balanceStart] simulated balance the sizing compounds from
 * @param {number} [options.riskPct] fraction of the running balance risked per fill
 * @param {object} [options.contract] `{contractSize, minLot, lotStep}`
 * @param {string} [options.callAsOfUtc] when the call this tape trades was published
 * @param {string} [options.callModel] which call this is, in the caller's own words
 * @returns {object} `{ trades, events, grid, sessions, coverage, totals, inputs }`
 */
function replaySessions(options = {}) {
  const side = options.side === "long" || options.side === "short" ? options.side : null;
  if (!side) throw new Error("replaySessions: the call's side (long or short) is required");
  const bars = readBars(options.bars);
  if (!bars.length) throw new Error("replaySessions: no usable M5 bars were handed in");
  const grid = buildGrid(options.levels, { halfGrid: options.halfGrid === true });
  if (!grid.length) throw new Error("replaySessions: the instrument carries no marked level");
  const rMultiple = positiveNumber(options.rMultiple) || 5;
  const point = positiveNumber(options.point) || 0;
  const minBreak = (positiveNumber(options.minBreakPoints) || 1) * point;
  const digits = Number.isInteger(options.digits) && options.digits >= 0 && options.digits <= 8 ? options.digits : 6;
  const sessions = normaliseSessions(options.sessions);
  if (!sessions.length) throw new Error("replaySessions: at least one session window is required");
  const riskPct = positiveNumber(options.riskPct) || 0.01;
  const contractSize = positiveNumber(options.contract?.contractSize) || 100000;
  const minLot = positiveNumber(options.contract?.minLot) || 0.01;
  const lotStep = positiveNumber(options.contract?.lotStep) || 0.01;
  let balance = positiveNumber(options.balanceStart) || 100000;
  const balanceStart = balance;

  const trades = [];
  const events = [];
  let ticket = null;
  let pending = null;
  let open = null;
  let dayDate = null;

  const record = (fields) => {
    const row = { sessionDate: dayDate, side, rMultiple, ...fields };
    trades.push(row);
    return row;
  };

  // A crossing (or a re-entry after a stop) states the ticket and nothing else: the limit is left at the
  // crossed line, at the next line's distance divided by the variant's R, and it waits without a clock.
  const arm = (level, bar, type) => {
    const entry = roundTo(level.price, digits);
    const geometry = ticketGeometry({ entry, side, grid, rMultiple, minBreak, digits });
    if (!geometry.ok) {
      ticket = null;
      events.push({
        type: "no-ticket",
        cause: geometry.cause,
        level: entry,
        levelSource: level.source,
        atUtc: bar.timeUtc,
        close: roundPrice(bar.close)
      });
      return false;
    }
    if (!canPlace({ side, level: entry, market: bar.close })) {
      ticket = null;
      events.push({
        type: "level-behind-market",
        atUtc: bar.timeUtc,
        close: roundPrice(bar.close),
        level: entry,
        note: `a ${side === "short" ? "sell" : "buy"} limit at ${entry} would be a ${side === "short" ? "sell" : "buy"} now, so the order waits for price to trade back to the line`
      });
      return false;
    }
    ticket = {
      level,
      entry,
      target: geometry.target,
      stop: geometry.stop,
      risk: geometry.risk,
      reward: geometry.reward,
      sessionDate: dayDate,
      triggerTimeUtc: bar.timeUtc,
      triggerClose: roundPrice(bar.close),
      triggerMs: bar.timeMs,
      targetSource: geometry.targetLevel ? geometry.targetLevel.source : null
    };
    events.push({
      type,
      atUtc: bar.timeUtc,
      close: roundPrice(bar.close),
      level: entry,
      levelSource: level.source,
      target: geometry.target,
      stop: geometry.stop,
      risk: geometry.risk,
      reward: geometry.reward
    });
    return true;
  };

  const settle = ({ exitReason, exitPrice, exitTimeUtc, ambiguity }) => {
    const size = sizePosition({
      balance,
      riskPct,
      stopDistance: open.entryToStop,
      contractSize,
      minLot,
      lotStep
    });
    const rGross = exitReason === EXIT.TARGET ? rMultiple : exitReason === EXIT.STOP ? -1 : 0;
    const gross = Number((rGross * size.riskAmount).toFixed(2));
    const balanceBefore = balance;
    balance = Number((balance + gross).toFixed(2));
    record({
      kind: "fill",
      sessionDate: open.sessionDate || dayDate,
      level: open.level.price,
      levelSource: open.level.source,
      entry: open.entry,
      stop: open.stop,
      target: open.target,
      risk: open.risk,
      reward: open.reward,
      triggerTimeUtc: open.triggerTimeUtc,
      triggerClose: open.triggerClose,
      fillTimeUtc: open.fillTimeUtc,
      fillPrice: open.fillPrice,
      exitTimeUtc,
      exitPrice: roundPrice(exitPrice),
      exitReason,
      rGross,
      lots: size.lots,
      riskAmount: Number(size.riskAmount.toFixed(2)),
      grossAccountCcy: gross,
      balanceBefore,
      balanceAfter: balance,
      ambiguity: ambiguity || []
    });
  };

  const unfilled = ({ exitReason, exitTimeUtc, ambiguity, reason }) => {
    record({
      kind: "no-fill",
      sessionDate: ticket.sessionDate || dayDate,
      level: ticket.level.price,
      levelSource: ticket.level.source,
      entry: ticket.entry,
      stop: ticket.stop,
      target: ticket.target,
      risk: ticket.risk,
      reward: ticket.reward,
      triggerTimeUtc: ticket.triggerTimeUtc,
      triggerClose: ticket.triggerClose,
      fillTimeUtc: null,
      fillPrice: null,
      exitTimeUtc,
      exitPrice: null,
      exitReason,
      rGross: 0,
      lots: 0,
      riskAmount: 0,
      grossAccountCcy: 0,
      balanceBefore: balance,
      balanceAfter: balance,
      ambiguity: ambiguity || [],
      reason
    });
  };

  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index];
    const previous = bars[index - 1];
    const session = sessionContaining(sessions, bar.timeMs);
    if (!session) continue;
    if (session.date !== dayDate) {
      dayDate = session.date;
      if (ticket) {
        events.push({
          type: "limit-carried-over",
          atUtc: bar.timeUtc,
          level: ticket.entry,
          note: "the limit carries no expiry of its own, so a call that still stands carries it into the next session"
        });
      }
    }

    // 1. A filled trade is managed first: its own stop and target are the only two prices that end it.
    if (open) {
      const stopped = side === "long" ? bar.low <= open.stop : bar.high >= open.stop;
      const targeted = side === "long" ? bar.high >= open.target : bar.low <= open.target;
      if (targeted && stopped) {
        settle({ exitReason: EXIT.STOP, exitPrice: open.stop, exitTimeUtc: bar.timeUtc, ambiguity: [AMBIGUITY.STOP_AND_TARGET_IN_ONE_BAR] });
        ticket = null;
        open = null;
      } else if (stopped) {
        settle({ exitReason: EXIT.STOP, exitPrice: open.stop, exitTimeUtc: bar.timeUtc });
        pending = { level: open.ticketRef.level, sinceUtc: bar.timeUtc };
        open = null;
        events.push({
          type: "re-entry-waiting",
          atUtc: bar.timeUtc,
          level: pending.level.price,
          note: "a stopped-out trade goes back to the same level until the target is taken or another line is crossed; the order is placed only once the market is back on the right side of the line"
        });
      } else if (targeted) {
        settle({ exitReason: EXIT.TARGET, exitPrice: open.target, exitTimeUtc: bar.timeUtc });
        ticket = null;
        open = null;
      }
      continue;
    }

    // 2. A trade that has just been stopped out waits at its own line: the order is placed only once the
    //    market is back on the right side of it, and another crossing replaces the level it waits on.
    if (pending) {
      if (canPlace({ side, level: roundTo(pending.level.price, digits), market: bar.close })) {
        const placed = arm(pending.level, bar, "re-entry-armed");
        pending = null;
        if (placed) continue;
        continue;
      }
      const moved = crossingFor({ bar, previous, side, grid, minBreak });
      if (moved) pending = { level: moved, sinceUtc: bar.timeUtc };
      continue;
    }

    // 3. A resting limit ends one of three ways: it fills, the target is taken without it, or another line is
    //    crossed and the ticket moves there. It does not end on a clock.
    if (ticket) {
      const touched = side === "long" ? bar.low <= ticket.entry : bar.high >= ticket.entry;
      const targeted = side === "long" ? bar.high >= ticket.target : bar.low <= ticket.target;
      if (targeted) {
        unfilled({
          exitReason: EXIT.INVALIDATED,
          exitTimeUtc: bar.timeUtc,
          ambiguity: touched ? [AMBIGUITY.TARGET_AND_FILL_IN_ONE_BAR] : [],
          reason: touched
            ? "one bar carries both the target and a retrace to the limit, so which came first cannot be read from M5: resolved pessimistically as never filled"
            : "the target was reached without the retrace, so the move this limit was left for has already happened"
        });
        ticket = null;
        continue;
      }
      if (touched) {
        open = {
          level: ticket.level,
          entry: ticket.entry,
          stop: ticket.stop,
          target: ticket.target,
          risk: ticket.risk,
          reward: ticket.reward,
          sessionDate: ticket.sessionDate,
          entryToStop: Math.abs(ticket.entry - ticket.stop),
          triggerTimeUtc: ticket.reEntryTimeUtc || ticket.triggerTimeUtc,
          triggerClose: ticket.triggerClose,
          fillTimeUtc: bar.timeUtc,
          fillPrice: ticket.entry,
          ticketRef: ticket
        };
        ticket = null;
        const stoppedSameBar = side === "long" ? bar.low <= open.stop : bar.high >= open.stop;
        const targetedSameBar = side === "long" ? bar.high >= open.target : bar.low <= open.target;
        if (targetedSameBar && stoppedSameBar) {
          settle({ exitReason: EXIT.STOP, exitPrice: open.stop, exitTimeUtc: bar.timeUtc, ambiguity: [AMBIGUITY.STOP_AND_TARGET_IN_ONE_BAR] });
          ticket = null;
          open = null;
        } else if (targetedSameBar) {
          settle({ exitReason: EXIT.TARGET, exitPrice: open.target, exitTimeUtc: bar.timeUtc, ambiguity: [AMBIGUITY.FILL_AND_TARGET_IN_ONE_BAR] });
          ticket = null;
          open = null;
        } else if (stoppedSameBar) {
          settle({ exitReason: EXIT.STOP, exitPrice: open.stop, exitTimeUtc: bar.timeUtc, ambiguity: [AMBIGUITY.FILL_AND_STOP_IN_ONE_BAR] });
          pending = { level: open.ticketRef.level, sinceUtc: bar.timeUtc };
          open = null;
        }
        continue;
      }
      const moved = crossingFor({ bar, previous, side, grid, minBreak });
      if (moved && roundTo(moved.price, digits) !== ticket.entry) arm(moved, bar, "re-trigger");
      continue;
    }

    // 4. Nothing working: only a crossing states a ticket, never a price that has merely been sitting there.
    const crossed = crossingFor({ bar, previous, side, grid, minBreak });
    if (crossed) arm(crossed, bar, "trigger");
  }

  // Whatever is still working when the tape runs out is reported as working, not guessed at: an unrealised
  // ticket is not a result and this module will not turn it into one.
  const lastBar = bars[bars.length - 1];
  if (open) {
    record({
      kind: "fill",
      level: open.level.price,
      levelSource: open.level.source,
      entry: open.entry,
      stop: open.stop,
      target: open.target,
      risk: open.risk,
      reward: open.reward,
      triggerTimeUtc: open.triggerTimeUtc,
      triggerClose: open.triggerClose,
      fillTimeUtc: open.fillTimeUtc,
      fillPrice: open.fillPrice,
      exitTimeUtc: null,
      exitPrice: roundPrice(lastBar.close),
      exitReason: EXIT.WORKING,
      rGross: 0,
      lots: 0,
      riskAmount: 0,
      grossAccountCcy: 0,
      balanceBefore: balance,
      balanceAfter: balance,
      ambiguity: [],
      reason: "still open when the tape ends, so it carries no result"
    });
  }
  if (ticket) {
    unfilled({
      exitReason: EXIT.WORKING,
      exitTimeUtc: null,
      ambiguity: [],
      reason: "the limit was still resting when the tape ends; it carries no expiry and no result"
    });
  }

  const coverage = sessions.map(session => {
    const inside = bars.filter(bar => bar.timeMs >= session.startMs && bar.timeMs < session.endMs);
    const first = inside.length ? inside[0] : null;
    const last = inside.length ? inside[inside.length - 1] : null;
    return {
      date: session.date,
      startUtc: new Date(session.startMs).toISOString(),
      endUtc: new Date(session.endMs).toISOString(),
      bars: inside.length,
      firstBarUtc: first ? first.timeUtc : null,
      lastBarUtc: last ? last.timeUtc : null,
      hoursCovered: inside.length ? Number(((last.timeMs + 300000 - first.timeMs) / 3600000).toFixed(2)) : 0,
      truncatedStart: Boolean(first) && first.timeMs > session.startMs,
      truncatedEnd: Boolean(last) && last.timeMs + 300000 < session.endMs
    };
  });

  const fills = trades.filter(trade => trade.kind === "fill");
  const totals = {
    trades: trades.length,
    fills: fills.length,
    targets: fills.filter(trade => trade.exitReason === EXIT.TARGET).length,
    stops: fills.filter(trade => trade.exitReason === EXIT.STOP).length,
    unfilled: trades.filter(trade => trade.kind === "no-fill" && trade.exitReason === EXIT.INVALIDATED).length,
    working: trades.filter(trade => trade.exitReason === EXIT.WORKING).length,
    ambiguous: trades.filter(trade => (trade.ambiguity || []).length > 0).length,
    rGross: Number(trades.reduce((sum, trade) => sum + (trade.rGross || 0), 0).toFixed(4)),
    balanceStart,
    balanceEnd: balance,
    returnPctGross: Number(((balance / balanceStart - 1) * 100).toFixed(4))
  };

  return {
    trades,
    events,
    grid,
    sessions,
    coverage,
    totals,
    inputs: {
      side,
      rMultiple,
      halfGrid: options.halfGrid === true,
      point,
      minBreak,
      riskPct,
      contract: { contractSize, minLot, lotStep },
      balanceStart,
      callModel: typeof options.callModel === "string" ? options.callModel : null,
      callAsOfUtc: typeof options.callAsOfUtc === "string" ? options.callAsOfUtc : null,
      executionNote: "gross of spread, commission and slippage: no bid/ask history is staged, so these numbers are not a net result"
    }
  };
}

module.exports = {
  ORIGINAL,
  MIDPOINT,
  EXIT,
  AMBIGUITY,
  roundPrice,
  roundTo,
  readBars,
  readLevels,
  buildGrid,
  nearestAbove,
  nearestBelow,
  ticketGeometry,
  crossingFor,
  canPlace,
  sizePosition,
  normaliseSessions,
  sessionContaining,
  replaySessions
};

