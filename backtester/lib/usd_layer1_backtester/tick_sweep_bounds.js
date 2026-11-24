"use strict";

/**
 * Re-price the published L2L tick sweep inside the corrected 05:00 London session (research only).
 *
 * The sweep in `l2l-tick-sweep-v1.json` walked one continuous tape: a limit that was not touched kept
 * working into the next session, and a position that was still open when a session ended was carried
 * until a stop, a target or the end of the six-session tape. The session horizon the programme actually
 * trades (05:00 London to the next 05:00 London) forbids both, so the same ladder hash does not establish
 * the same execution outcomes.
 *
 * This module re-prices the sweep's own decisions under that horizon instead of re-deriving them:
 *
 *   * a fill stamped outside the window of the session it belongs to is cancelled at that window's
 *     endpoint and reported as `cancelled_at_session_end` - it is not silently deleted, and it is not
 *     counted as a trade;
 *   * a position with no exit inside its window is closed at the last bar inside the window, on the side
 *     of the book that would have paid it (a long sells the bid, a short buys the ask);
 *   * every other trade is carried through untouched, at the price and instant the sweep recorded.
 *
 * Keeping the decision set and changing only the horizon is the point: the audit trail stays one record
 * per decision, and the difference between v1 and v2 is exactly the horizon. It also bounds the claim -
 * a freed slot is not re-filled, because the sweep never recorded the orders it did not fill. That limit
 * is printed in the artefact rather than implied away.
 *
 * `rebuildSweep` proves itself before it changes anything: it first replays the recorded trades with no
 * horizon at all and refuses to continue unless the reproduction matches v1's own totals and its sixteen
 * account blocks to the penny. Only then does it apply the bound.
 *
 * Nothing here reads the network or a production path, and nothing here places an order.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { resolveSession } = require("../usd_session_engine_interface");
const { runAccount } = require("./accounts");

const SCHEMA_V2 = "l2l-tick-sweep-v2";

/** The rule the artefact prints for every reader who has to reconcile v1 with v2. */
const HORIZON_RULE = Object.freeze({
  cutoff: "05:00 Europe/London",
  endpoint: "the next 05:00 Europe/London",
  tape: "[cutoff, endpoint): a bar stamped at or after the endpoint belongs to the next session",
  positions:
    "closed at the last bar inside the window, on the side of the book that would have paid the exit: a long sells the bid, a short buys the ask",
  orders: "a fill stamped outside its own session window is cancelled at that endpoint, not carried",
  unchanged:
    "the sweep's own decisions are held; a slot freed by an earlier close is not re-filled, because the unfilled orders were never recorded",
  moved_a_print:
    "a target or stop that printed after the endpoint is not counted; the position is closed at the endpoint instead"
});

/** The geometry each frozen path uses, in the sweep's own rule vocabulary. */
const RULE_GEOMETRY = Object.freeze({ full_5r: "full", half_3r: "half" });

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(file) {
  return sha256(fs.readFileSync(file));
}

function roundTo(value, places) {
  const factor = 10 ** places;
  const tidy = Number(value.toFixed(10));
  return (Math.sign(tidy) * Math.round(Math.abs(tidy) * factor)) / factor;
}

/** The session window a date belongs to, resolved by the repository's own session contract. */
function sessionWindow(date) {
  const dayMs = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(dayMs)) throw new Error(`not a session date: ${date}`);
  const resolved = resolveSession(dayMs);
  const second = (iso) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    date,
    cutoff_at_utc: second(resolved.cutoff_at_utc),
    endpoint_at_utc: second(resolved.endpoint_at_utc),
    window_hours: resolved.window_hours,
    session_starts_weekday: resolved.session_starts_weekday
  };
}

/**
 * Read one streamed session tape and check it is the session it claims to be.
 *
 * The tape was streamed by the Python side and the window here is resolved by the JavaScript session
 * contract, so agreement between them is a real cross-check rather than a restatement. A tape whose
 * status is not `ok`, whose window disagrees, or whose last bar is not strictly before its endpoint is
 * refused: a missing session must not read as a session that had nothing in it.
 */
function readTape({ file, symbol, date }) {
  const raw = fs.readFileSync(file);
  const record = JSON.parse(raw.toString("utf8"));
  if (record.status !== "ok" || !Array.isArray(record.m5) || record.m5.length === 0) {
    throw new Error(`${symbol} ${date}: the tape is not a usable session (status ${record.status})`);
  }
  const window = sessionWindow(date);
  if (record.window_start_utc !== window.cutoff_at_utc || record.window_end_utc !== window.endpoint_at_utc) {
    throw new Error(
      `${symbol} ${date}: the tape window ${record.window_start_utc}..${record.window_end_utc} is not the ` +
        `session contract's ${window.cutoff_at_utc}..${window.endpoint_at_utc}`
    );
  }
  const endpointMs = Date.parse(window.endpoint_at_utc);
  const bars = record.m5
    .filter((bar) => {
      const stamp = Date.parse(bar.time_utc);
      if (!Number.isFinite(stamp)) throw new Error(`${symbol} ${date}: a bar carries no parseable time`);
      return stamp < endpointMs;
    })
    .sort((left, right) => Date.parse(left.time_utc) - Date.parse(right.time_utc));
  if (!bars.length) throw new Error(`${symbol} ${date}: the tape carries no bar inside the session`);
  const last = bars[bars.length - 1];
  return {
    key: `${symbol}|${date}`,
    symbol,
    date,
    file,
    sha256: sha256(raw),
    bytes: raw.length,
    window,
    bars: bars.length,
    bars_in_file: record.m5.length,
    gaps: Array.isArray(record.gaps) ? record.gaps.length : 0,
    tick_count: Number.isFinite(record.tick_count) ? record.tick_count : null,
    contract: {
      contractSize: record.contract_size,
      minLot: record.volume_min,
      lotStep: record.volume_step,
      digits: record.digits,
      point: record.point
    },
    endpoint_bar: {
      time_utc: last.time_utc,
      bid_close: last.bid.close,
      ask_close: last.ask.close,
      spread_last: Number.isFinite(last.spread_last) ? last.spread_last : roundTo(last.ask.close - last.bid.close, 8)
    }
  };
}

/** Every tape a sweep names, keyed `<symbol>|<date>`. A missing tape is an error, never a skip. */
function loadTapes({ sweep, tapeRoot }) {
  const tapes = {};
  for (const symbolBlock of sweep.per_symbol || []) {
    for (const date of symbolBlock.usable_sessions || []) {
      const file = path.join(tapeRoot, symbolBlock.symbol, `${date}.json`);
      if (!fs.existsSync(file)) throw new Error(`no tape for ${symbolBlock.symbol} ${date} at ${file}`);
      const tape = readTape({ file, symbol: symbolBlock.symbol, date });
      tapes[tape.key] = tape;
    }
  }
  return tapes;
}

/** The price a position would have been paid at the last instant of its session. */
function endpointPrice({ side, tape }) {
  if (side === "long") return tape.endpoint_bar.bid_close;
  if (side === "short") return tape.endpoint_bar.ask_close;
  throw new Error(`a trade side must be long or short, not ${JSON.stringify(side)}`);
}

/** `r_gross` for a bounded exit, to four places, so the artefact is stable across runs. */
function rMultipleOf({ side, entry, stop, exit }) {
  const risk = side === "long" ? entry - stop : stop - entry;
  if (!(risk > 0)) throw new Error(`a ${side} trade needs its stop on the losing side of the entry`);
  const reward = side === "long" ? exit - entry : entry - exit;
  return roundTo(reward / risk, 4);
}

function inWindow(stamp, window) {
  return stamp >= window.cutoff_at_utc && stamp < window.endpoint_at_utc;
}

/**
 * Apply the session horizon to one sweep's decisions.
 *
 * @param {object} input
 * @param {Array<object>} input.trades the sweep's trade audit rows.
 * @param {object} input.tapes `<symbol>|<date>` -> tape from `loadTapes`.
 * @returns {{trades: Array<object>, counts: object}} the bounded audit rows and what the bound moved.
 */
function boundTrades({ trades, tapes }) {
  const counts = {
    fills_recorded: 0,
    fills_inside_window: 0,
    fills_cancelled_at_session_end: 0,
    exits_already_inside_window: 0,
    exits_closed_at_session_end: 0,
    sessions_with_a_cancelled_fill: []
  };
  const sessionsWithCancellation = new Set();

  const bounded = trades.map((trade) => {
    const key = `${trade.symbol}|${trade.session_date}`;
    const tape = tapes[key];
    if (!tape) throw new Error(`no tape for the trade's session ${key}`);
    const window = tape.window;
    counts.fills_recorded += 1;

    if (!inWindow(trade.fill.time_utc, window)) {
      counts.fills_cancelled_at_session_end += 1;
      sessionsWithCancellation.add(key);
      return {
        ...trade,
        kind: "cancelled_at_session_end",
        r_gross: null,
        exit: null,
        cancelled: {
          at_utc: window.endpoint_at_utc,
          why:
            "the limit filled after the session it was placed in had ended; the corrected horizon ends the " +
            "session at 05:00 London and an unfilled order does not survive it",
          superseded_fill: {
            time_utc: trade.fill.time_utc,
            price: trade.fill.price,
            quote: trade.fill.quote
          },
          superseded_exit: trade.exit
            ? { time_utc: trade.exit.time_utc, price: trade.exit.price, reason: trade.exit.reason }
            : null
        }
      };
    }
    counts.fills_inside_window += 1;

    const exitInside = trade.exit && inWindow(trade.exit.time_utc, window);
    if (exitInside) {
      counts.exits_already_inside_window += 1;
      return { ...trade, kind: "fill" };
    }

    counts.exits_closed_at_session_end += 1;
    const price = endpointPrice({ side: trade.side, tape });
    const rGross = rMultipleOf({ side: trade.side, entry: trade.order.entry, stop: trade.order.stop, exit: price });
    return {
      ...trade,
      kind: "fill",
      r_gross: rGross,
      exit: {
        time_utc: tape.endpoint_bar.time_utc,
        price,
        quote: {
          time_utc: tape.endpoint_bar.time_utc,
          bid: { close: tape.endpoint_bar.bid_close },
          ask: { close: tape.endpoint_bar.ask_close },
          spread_at_close: tape.endpoint_bar.spread_last
        },
        reason: "session_end",
        gap_flag: false,
        bounded: {
          endpoint_at_utc: window.endpoint_at_utc,
          priced_from: `last M5 bar inside the session (${tape.endpoint_bar.time_utc})`,
          side_of_book: trade.side === "long" ? "bid" : "ask",
          superseded_exit: trade.exit
            ? { time_utc: trade.exit.time_utc, price: trade.exit.price, reason: trade.exit.reason, r_gross: trade.r_gross }
            : null
        }
      }
    };
  });

  counts.sessions_with_a_cancelled_fill = [...sessionsWithCancellation].sort();
  return { trades: bounded, counts };
}

/** The closing counts the sweep reports, by exit reason. A cancelled fill is not a trade. */
function summariseTrades(trades) {
  const fills = trades.filter((trade) => trade.kind === "fill");
  const isClosed = (trade) => Boolean(trade.exit) && trade.exit.reason !== "working-at-end-of-tape";
  const closed = fills.filter(isClosed);
  const count = (list, reason) => list.filter((trade) => trade.exit && trade.exit.reason === reason).length;
  return {
    fills: closed.length,
    targets: count(closed, "target"),
    stops: count(closed, "stop"),
    session_end: count(closed, "session_end"),
    working: fills.length - closed.length,
    r_gross: roundTo(closed.reduce((sum, trade) => sum + (Number.isFinite(trade.r_gross) ? trade.r_gross : 0), 0), 4)
  };
}

/**
 * The gross percentage return 1% of a running balance produces over a list of R multiples.
 *
 * This is the sweep's own reported figure, so it is reproduced the same way: one percent of the running
 * balance risked per closed trade, the balance carried to two places after each one, and no compounding
 * short-cut that would drift from the trade chain the panel prints.
 */
function returnPctGross({ trades, riskPct = 1, startingBalance = 100000 }) {
  let balance = startingBalance;
  for (const trade of trades) {
    if (!Number.isFinite(trade.r_gross) || trade.r_gross === 0) continue;
    // The risk is taken from the running balance before it is rounded: only the balance the panel shows is
    // carried to two places, which is how the published figure was produced.
    const risk = (balance * riskPct) / 100;
    balance = roundTo(balance + trade.r_gross * risk, 2);
  }
  return roundTo(((balance / startingBalance) - 1) * 100, 4);
}

/** Trades in the order the money moves: first fill, then the audit's own order for a tie. */
function moneyOrder(trades) {
  return trades
    .map((trade, index) => ({ trade, index }))
    .sort((left, right) => {
      const byTime = String(left.trade.fill.time_utc).localeCompare(String(right.trade.fill.time_utc));
      return byTime !== 0 ? byTime : left.index - right.index;
    })
    .map((entry) => entry.trade);
}

function riskPerLotOf(trade, contractSize) {
  return Math.abs(trade.order.entry - trade.order.stop) * contractSize;
}

/** The four accounts of one symbol, run exactly as `accounts.runAccount` runs them. */
function accountsFor({ symbol, trades, tape, startingBalance, riskPct }) {
  const instrument = {
    lotStep: tape.contract.lotStep,
    minLot: tape.contract.minLot,
    contractSize: tape.contract.contractSize,
    digits: tape.contract.digits,
    point: tape.contract.point
  };
  const slots = [
    { id: "current-full", label: "Current / full 5R", geometry: "full", model: "current", rule: "full_5r" },
    { id: "current-half", label: "Current / half 3R", geometry: "half", model: "current", rule: "half_3r" },
    { id: "challenger-full", label: "Challenger / full 5R", geometry: "full", model: "challenger", rule: "full_5r" },
    { id: "challenger-half", label: "Challenger / half 3R", geometry: "half", model: "challenger", rule: "half_3r" }
  ];
  return slots.map((slot) => {
    const forSlot = trades.filter(
      (trade) => trade.symbol === symbol && trade.model === slot.model && trade.rule === slot.rule
    );
    const accountTrades = forSlot.map((trade, index) => ({
      id: `${symbol}-${slot.model}-${slot.rule}-${index}`,
      geometry: slot.geometry,
      model: slot.model,
      sessionDate: trade.session_date,
      fillTimeUtc: trade.fill.time_utc,
      exitTimeUtc: trade.exit ? trade.exit.time_utc : null,
      exitReason: trade.exit ? trade.exit.reason : null,
      // A trade still working when the tape ended is carried at its open risk and never counted as a close,
      // which is what the sweep's own account walk did.
      rGross:
        trade.kind === "fill" && trade.exit && trade.exit.reason !== "working-at-end-of-tape" ? trade.r_gross : null,
      riskPerLot: riskPerLotOf(trade, instrument.contractSize)
    }));
    const run = runAccount({ account: slot, trades: accountTrades, startingBalance, riskPct, instrument });
    return {
      symbol,
      account: slot.id,
      model: slot.model,
      geometry: slot.geometry,
      fills: run.fills,
      wins: run.wins,
      losses: run.losses,
      session_end_closes: forSlot.filter((trade) => trade.exit && trade.exit.reason === "session_end").length,
      cancelled_at_session_end: forSlot.filter((trade) => trade.kind === "cancelled_at_session_end").length,
      ending_balance: run.ending_balance,
      return_pct: run.return_pct,
      max_drawdown_pct: run.max_drawdown
    };
  });
}

/** Per model and geometry, the counts the panel prints, from the bounded decisions. */
function geometrySummaries({ trades, previous, riskPct, startingBalance }) {
  const out = {};
  for (const [rule, geometry] of Object.entries(RULE_GEOMETRY)) {
    const list = trades.filter((trade) => trade.rule === rule);
    const closed = list.filter((trade) => trade.kind === "fill");
    const prior = (previous && previous[geometry]) || {};
    out[geometry] = {
      label: prior.label || null,
      r_multiple: prior.r_multiple === undefined ? null : prior.r_multiple,
      ...summariseTrades(list),
      session_end_closes: closed.filter((trade) => trade.exit && trade.exit.reason === "session_end").length,
      cancelled_at_session_end: list.filter((trade) => trade.kind === "cancelled_at_session_end").length,
      return_pct_gross: returnPctGross({ trades: moneyOrder(closed), riskPct, startingBalance })
    };
  }
  return out;
}

/**
 * Reproduce the published sweep from its own trade audit, with no horizon at all.
 *
 * This is the guard that makes a horizon change honest: if the recorded trades, the lot sizing and the
 * money walk cannot reproduce v1's totals, its sixteen account blocks and its sixteen model summaries to
 * the recorded precision, then this module does not know what v1 measured and must not claim to have
 * corrected it.
 */
function reproduceBaseline({ sweep, tapes, startingBalance, riskPct }) {
  const trades = (sweep.trade_audit || []).map((trade) => ({ ...trade, kind: "fill" }));
  const totals = summariseTrades(trades);
  const problems = [];
  const compare = (label, actual, expected, tolerance = 0.00005) => {
    if (typeof actual !== "number" || typeof expected !== "number") {
      if (actual !== expected) problems.push(`${label}: reproduced ${JSON.stringify(actual)}, v1 says ${JSON.stringify(expected)}`);
      return;
    }
    if (Math.abs(actual - expected) > tolerance) problems.push(`${label}: reproduced ${actual}, v1 says ${expected}`);
  };
  for (const key of ["fills", "targets", "stops", "working"]) compare(`totals.${key}`, totals[key], sweep.totals[key]);
  compare("totals.r_gross", totals.r_gross, roundTo(sweep.rules.reduce((sum, rule) => sum + rule.r_gross, 0), 4));

  const perModel = [];
  for (const symbolBlock of sweep.per_symbol || []) {
    const symbol = symbolBlock.symbol;
    const tape = tapes[`${symbol}|${symbolBlock.usable_sessions[0]}`];
    for (const modelBlock of symbolBlock.models || []) {
      const forSymbolModel = trades.filter((trade) => trade.symbol === symbol && trade.model === modelBlock.model);
      const summary = geometrySummaries({
        trades: forSymbolModel,
        previous: modelBlock.geometries,
        riskPct,
        startingBalance
      });
      for (const [geometry, expected] of Object.entries(modelBlock.geometries || {})) {
        const actual = summary[geometry] || {};
        for (const key of ["fills", "targets", "stops", "working"]) {
          compare(`${symbol}.${modelBlock.model}.${geometry}.${key}`, actual[key], expected[key]);
        }
        compare(`${symbol}.${modelBlock.model}.${geometry}.r_gross`, actual.r_gross, expected.r_gross);
        compare(
          `${symbol}.${modelBlock.model}.${geometry}.return_pct_gross`,
          actual.return_pct_gross,
          expected.return_pct_gross
        );
      }
      perModel.push({ symbol, model: modelBlock.model, summary });
    }
    const accounts = tape ? accountsFor({ symbol, trades, tape, startingBalance, riskPct }) : [];
    for (const account of accounts) {
      const expected = (sweep.accounts || []).find((row) => row.symbol === symbol && row.account === account.account);
      if (!expected) {
        problems.push(`${symbol}.${account.account}: v1 carries no account block to reproduce`);
        continue;
      }
      compare(`${symbol}.${account.account}.ending_balance`, account.ending_balance, expected.ending_balance);
      compare(`${symbol}.${account.account}.fills`, account.fills, expected.fills);
      compare(`${symbol}.${account.account}.wins`, account.wins, expected.wins);
      compare(`${symbol}.${account.account}.losses`, account.losses, expected.losses);
      compare(
        `${symbol}.${account.account}.max_drawdown.amount`,
        account.max_drawdown_pct.amount,
        expected.max_drawdown_pct.amount
      );
    }
  }
  return { trades, totals, perModel, problems };
}

/**
 * The bounded sweep: v1's decisions, priced inside their own 05:00 London sessions.
 *
 * @param {object} input
 * @param {object} input.sweep the published v1 artefact.
 * @param {object} input.tapes `<symbol>|<date>` -> tape from `loadTapes`.
 * @param {string} input.v1Sha256 the hash of the file this replaces, carried so the supersession is verifiable.
 * @param {string} [input.source] the repository path v1 was read from.
 * @param {string} [input.now] the stamp to write; defaults to the clock.
 * @returns {object} the v2 artefact.
 */
function buildSweepV2({ sweep, tapes, v1Sha256, source = null, now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z") }) {
  const startingBalance = sweep.inputs && Number.isFinite(sweep.inputs.starting_balance) ? sweep.inputs.starting_balance : 100000;
  const riskPct = sweep.inputs && Number.isFinite(sweep.inputs.risk_per_trade_pct) ? sweep.inputs.risk_per_trade_pct : 1;

  const baseline = reproduceBaseline({ sweep, tapes, startingBalance, riskPct });
  if (baseline.problems.length) {
    throw new Error(
      "the published sweep cannot be reproduced from its own audit, so it cannot be corrected here:\n" +
        baseline.problems.map((problem) => `  - ${problem}`).join("\n")
    );
  }

  const { trades } = boundTrades({ trades: baseline.trades, tapes });
  const totals = summariseTrades(trades);
  const cancelCounts = {
    fills_cancelled_at_session_end: trades.filter((trade) => trade.kind === "cancelled_at_session_end").length,
    exits_closed_at_session_end: trades.filter((trade) => trade.kind === "fill" && trade.exit && trade.exit.reason === "session_end").length,
    exits_already_inside_window: trades.filter(
      (trade) => trade.kind === "fill" && trade.exit && trade.exit.reason !== "session_end"
    ).length
  };

  const tapeKeys = Object.keys(tapes).sort();
  const tapesManifest = tapeKeys.map((key) => {
    const tape = tapes[key];
    return {
      symbol: tape.symbol,
      date: tape.date,
      window_start_utc: tape.window.cutoff_at_utc,
      window_end_utc: tape.window.endpoint_at_utc,
      window_hours: tape.window.window_hours,
      bars_in_session: tape.bars,
      gaps: tape.gaps,
      sha256: tape.sha256,
      bytes: tape.bytes,
      endpoint_bar_utc: tape.endpoint_bar.time_utc,
      endpoint_close: { bid: tape.endpoint_bar.bid_close, ask: tape.endpoint_bar.ask_close },
      held_in_repository: false
    };
  });

  const rules = (sweep.rules || []).map((rule) => {
    const forRule = trades.filter((trade) => trade.rule === rule.rule);
    const summary = summariseTrades(forRule);
    return {
      rule: rule.rule,
      label: rule.label,
      geometry: rule.geometry,
      r_multiple: rule.r_multiple,
      fills: summary.fills,
      targets: summary.targets,
      stops: summary.stops,
      session_end: summary.session_end,
      working: summary.working,
      r_gross: summary.r_gross,
      by_model: (rule.by_model || []).map((modelBlock) => {
        const forModel = forRule.filter((trade) => trade.model === modelBlock.model);
        const modelSummary = summariseTrades(forModel);
        const cancelled = forModel.filter((trade) => trade.kind === "cancelled_at_session_end").length;
        return {
          model: modelBlock.model,
          sessions_with_a_call: modelBlock.sessions_with_a_call,
          fills: modelSummary.fills,
          targets: modelSummary.targets,
          stops: modelSummary.stops,
          session_end: modelSummary.session_end,
          working: modelSummary.working,
          unfilled: (modelBlock.unfilled || 0) + cancelled,
          cancelled_at_session_end: cancelled,
          r_gross: modelSummary.r_gross
        };
      })
    };
  });

  const perSymbol = (sweep.per_symbol || []).map((block) => {
    const forSymbol = trades.filter((trade) => trade.symbol === block.symbol);
    const tape = tapes[`${block.symbol}|${block.usable_sessions[0]}`];
    return {
      symbol: block.symbol,
      label: block.label,
      sessions_eligible: block.sessions_eligible,
      usable_sessions: block.usable_sessions.slice(),
      streamed_files_held: block.streamed_files_held,
      ladder: block.ladder,
      bars_check: block.bars_check,
      sessions: (block.sessions || []).map((session) => ({
        ...session,
        endpoint_at_utc: sessionWindow(session.date).endpoint_at_utc
      })),
      sessions_with_a_cancelled_fill: [
        ...new Set(
          forSymbol.filter((trade) => trade.kind === "cancelled_at_session_end").map((trade) => trade.session_date)
        )
      ].sort(),
      models: (block.models || []).map((modelBlock) => {
        const forModel = forSymbol.filter((trade) => trade.model === modelBlock.model);
        const summary = geometrySummaries({
          trades: forModel,
          previous: modelBlock.geometries,
          riskPct,
          startingBalance
        });
        const geometries = {};
        for (const [geometry, prior] of Object.entries(modelBlock.geometries || {})) {
          const next = summary[geometry] || {};
          geometries[geometry] = {
            ...prior,
            fills: next.fills,
            targets: next.targets,
            stops: next.stops,
            session_end: next.session_end,
            working: next.working,
            unfilled: (prior.unfilled || 0) + (next.cancelled_at_session_end || 0),
            cancelled_at_session_end: next.cancelled_at_session_end || 0,
            r_gross: next.r_gross,
            return_pct_gross: next.return_pct_gross
          };
        }
        return {
          model: modelBlock.model,
          calls_by_session: modelBlock.calls_by_session,
          sessions_without_a_call: modelBlock.sessions_without_a_call,
          geometries
        };
      }),
      accounts: accountsFor({ symbol: block.symbol, trades: forSymbol, tape, startingBalance, riskPct })
    };
  });

  return {
    schema: SCHEMA_V2,
    generated_at_utc: now,
    supersedes: {
      schema: sweep.schema,
      path: source,
      sha256: v1Sha256,
      why:
        "v1 walked one continuous tape: limits survived the session they belonged to and open positions were " +
        "carried past 05:00 London. v2 keeps v1's decisions and re-prices them inside their own session, so " +
        "the difference between the two files is the horizon and nothing else. v1 is preserved byte for byte."
    },
    horizon: {
      rule: HORIZON_RULE,
      sessions: tapeKeys.map((key) => {
        const tape = tapes[key];
        return {
          symbol: tape.symbol,
          date: tape.date,
          cutoff_at_utc: tape.window.cutoff_at_utc,
          endpoint_at_utc: tape.window.endpoint_at_utc,
          window_hours: tape.window.window_hours,
          session_starts_weekday: tape.window.session_starts_weekday
        };
      }),
      tapes: tapesManifest,
      moved: cancelCounts
    },
    inputs: sweep.inputs,
    eligibility: {
      ...sweep.eligibility,
      session_horizon: HORIZON_RULE.positions
    },
    totals: {
      ...sweep.totals,
      fills: totals.fills,
      targets: totals.targets,
      stops: totals.stops,
      session_end: totals.session_end,
      working: totals.working,
      r_gross: totals.r_gross,
      fills_cancelled_at_session_end: cancelCounts.fills_cancelled_at_session_end
    },
    bars_check: sweep.bars_check,
    failures: sweep.failures,
    rules,
    accounts: perSymbol.flatMap((block) => block.accounts),
    per_symbol: perSymbol,
    trade_audit: trades,
    limits: [
      ...(sweep.limits || []),
      "the correction holds v1's decisions: a limit that never filled is not re-placed, and a slot freed by a 05:00 close is not re-filled, because the sweep recorded only the orders it filled",
      "a session-end close is priced at the last M5 bar inside the window, so it carries the spread and the close of that bar rather than a tick-level exit",
      "the tapes the closes are priced from are held outside the repository; each one's sha256, window and endpoint close travel in this file so the price can be re-derived from the streamed session"
    ]
  };
}

module.exports = {
  SCHEMA_V2,
  HORIZON_RULE,
  RULE_GEOMETRY,
  sha256,
  sha256File,
  roundTo,
  sessionWindow,
  readTape,
  loadTapes,
  endpointPrice,
  rMultipleOf,
  inWindow,
  boundTrades,
  summariseTrades,
  returnPctGross,
  moneyOrder,
  accountsFor,
  geometrySummaries,
  reproduceBaseline,
  buildSweepV2
};
