"use strict";

/**
 * Run the L2L five-minute session replay for one instrument and write its ledger and its picture.
 *
 * The rule, the variants and the ambiguities are `backtester/lib/l2l_session_replay.js`'s; this script only
 * finds the inputs, states the provenance of every one of them, and draws the result. It reads the live feed
 * and the marked ladder - the two artefacts the live rule itself reads - and writes nothing but its own
 * outputs, every one of them through the research path guard, so no run can reach a committed production file.
 *
 * Usage:
 *   node backtester/scripts/run_l2l_m5_session_replay.js --symbol EURUSD --side short --r-multiple 5
 *   node backtester/scripts/run_l2l_m5_session_replay.js --symbol EURUSD --side short --r-multiple 3 --half-grid
 *
 * Defaults read the copies of the live artefacts extracted from `origin/main` into the ignored research folder
 * (`backtester/tmp/usd-session-research/raw/main/`), so the replay is reproducible from this branch without a
 * network read and without pretending a checkout copy of `data/live-trading.json` is today's feed.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { REPO_ROOT, assertResearchPath } = require("./lib/research_path_guard");
const { resolveSession } = require("../lib/usd_session_engine_interface");
const {
  EXIT,
  AMBIGUITY,
  replaySessions,
  normaliseSessions
} = require("../lib/l2l_session_replay");

const RAW_MAIN = path.join(REPO_ROOT, "backtester", "tmp", "usd-session-research", "raw", "main");
const DEFAULT_OUT = path.join(REPO_ROOT, "backtester", "tmp", "usd-session-research", "replays");

function parseArgs(argv) {
  const options = {
    symbol: "EURUSD",
    side: "short",
    rMultiple: 5,
    halfGrid: false,
    balance: 100000,
    riskPct: 0.01,
    feed: fs.existsSync(path.join(REPO_ROOT, "data", "live-trading.json"))
      ? path.join(REPO_ROOT, "data", "live-trading.json")
      : path.join(RAW_MAIN, "data__live-trading.json"),
    levels: fs.existsSync(path.join(REPO_ROOT, "data", "l2l-levels.json"))
      ? path.join(REPO_ROOT, "data", "l2l-levels.json")
      : path.join(RAW_MAIN, "data__l2l-levels.json"),
    out: DEFAULT_OUT,
    chartSession: null,
    callModel: null,
    callAsOf: null,
    provenance: null,
    label: null
  };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => argv[index + 1];
    switch (token) {
      case "--symbol": options.symbol = String(next()); index += 1; break;
      case "--side": options.side = String(next()).toLowerCase(); index += 1; break;
      case "--r-multiple": options.rMultiple = Number(next()); index += 1; break;
      case "--half-grid": options.halfGrid = true; break;
      case "--balance": options.balance = Number(next()); index += 1; break;
      case "--risk-pct": options.riskPct = Number(next()); index += 1; break;
      case "--feed": options.feed = path.resolve(String(next())); index += 1; break;
      case "--levels": options.levels = path.resolve(String(next())); index += 1; break;
      case "--out": options.out = path.resolve(String(next())); index += 1; break;
      case "--chart-session": options.chartSession = String(next()); index += 1; break;
      case "--call-model": options.callModel = String(next()); index += 1; break;
      case "--call-as-of": options.callAsOf = String(next()); index += 1; break;
      case "--provenance": options.provenance = String(next()); index += 1; break;
      case "--label": options.label = String(next()); index += 1; break;
      default:
        throw new Error(`unknown argument ${token}`);
    }
  }
  if (options.side !== "long" && options.side !== "short") throw new Error("--side must be long or short");
  if (!Number.isFinite(options.rMultiple) || options.rMultiple <= 0) throw new Error("--r-multiple must be a positive number");
  return options;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}


function instrumentFromFeed(feed, symbol) {
  const instrument = (feed.instruments || []).find(row => row.symbol === symbol);
  if (!instrument) throw new Error(`the feed carries no ${symbol}`);
  const bars = instrument.m5 && Array.isArray(instrument.m5.bars) ? instrument.m5.bars : [];
  if (!bars.length) throw new Error(`the feed carries no M5 bars for ${symbol}`);
  return {
    symbol,
    bars,
    digits: Number(instrument.digits),
    point: Number(instrument.point),
    contractSize: Number(instrument.contract_size),
    minLot: Number(instrument.min_lot),
    lotStep: Number(instrument.lot_step)
  };
}

function levelsFromFile(file, symbol) {
  const ladder = readJson(file);
  const instrument = (ladder.instruments || []).find(row => row.symbol === symbol);
  if (!instrument || !(instrument.levels || []).length) throw new Error(`the ladder carries no ${symbol} levels`);
  return { generatedAtUtc: ladder.generated_at_utc, levels: instrument.levels };
}

/**
 * The London sessions the tape's own bars fall into: a session is a weekday 05:00 Europe/London start and the
 * 05:00 that follows it, resolved by the programme's own contract rather than by a fixed hour count. A session
 * the tape only partly covers is kept and marked truncated by the replay, never stretched.
 */
function sessionsForBars(bars) {
  const stamps = bars.map(bar => Date.parse(bar.time_utc)).filter(Number.isFinite).sort((a, b) => a - b);
  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  const sessions = [];
  const firstDay = new Date(first);
  const startDayMs = Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate()) - 24 * 3600 * 1000;
  for (let dayMs = startDayMs; dayMs <= last; dayMs += 24 * 3600 * 1000) {
    let session;
    try {
      session = resolveSession(dayMs);
    } catch (error) {
      continue;
    }
    if (!session.session_starts_weekday) continue;
    const startMs = Date.parse(session.cutoff_at_utc);
    const endMs = Date.parse(session.endpoint_at_utc);
    if (endMs <= first || startMs >= last) continue;
    sessions.push({ date: new Date(dayMs).toISOString().slice(0, 10), startMs, endMs });
  }
  return normaliseSessions(sessions);
}

function esc(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(value) {
  return Number(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * One session as a picture: the candles, the ladder the rule reads, and the trade that session produced - the
 * crossed line, the limit left at it, the fill, the stop, the target and the result in R. The frame is the one
 * `docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md` asks for: a dark wide plot, thin teal level lines with
 * right-edge value tags, and execution markers on the candles with short labels.
 */
function renderReplayHtml(context) {
  const { result, session, coverage, options, provenance, trades, bars } = context;
  const inside = bars.filter(bar => {
    const stamp = Date.parse(bar.time_utc);
    return stamp >= session.startMs && stamp < session.endMs;
  });
  const width = 1180;
  const height = 620;
  const plot = { left: 64, right: width - 132, top: 28, bottom: height - 44 };
  const anchors = trades.flatMap(trade => [trade.entry, trade.stop, trade.target]).filter(Number.isFinite);
  const lows = inside.map(bar => Number(bar.low));
  const highs = inside.map(bar => Number(bar.high));
  const low = Math.min(...lows, ...anchors);
  const high = Math.max(...highs, ...anchors);
  const pad = (high - low) * 0.08 || 0.0005;
  const yMin = low - pad;
  const yMax = high + pad;
  const digits = Number.isFinite(options.digits) ? options.digits : 5;
  const slot = inside.length ? (plot.right - plot.left) / inside.length : 1;
  const yFor = price => plot.bottom - ((price - yMin) / (yMax - yMin)) * (plot.bottom - plot.top);
  const xForTime = (utc) => {
    const stamp = Date.parse(utc);
    const index = inside.findIndex(bar => Date.parse(bar.time_utc) >= stamp);
    if (index < 0) return plot.right;
    return plot.left + index * slot + slot / 2;
  };

  const candleWidth = Math.max(1.5, slot * 0.62);
  const candles = inside.map((bar, index) => {
    const x = plot.left + index * slot + slot / 2;
    const colour = Number(bar.close) >= Number(bar.open) ? "#26a69a" : "#ef5350";
    const bodyTop = yFor(Math.max(Number(bar.open), Number(bar.close)));
    const bodyBottom = yFor(Math.min(Number(bar.open), Number(bar.close)));
    return `<line x1="${x.toFixed(2)}" y1="${yFor(Number(bar.high)).toFixed(2)}" x2="${x.toFixed(2)}" y2="${yFor(Number(bar.low)).toFixed(2)}" stroke="${colour}" stroke-width="1"/>` +
      `<rect x="${(x - candleWidth / 2).toFixed(2)}" y="${bodyTop.toFixed(2)}" width="${candleWidth.toFixed(2)}" height="${Math.max(1, bodyBottom - bodyTop).toFixed(2)}" fill="${colour}"/>`;
  }).join("");

  const levelLines = result.grid
    .filter(level => level.price >= yMin && level.price <= yMax)
    .map(level => {
      const y = yFor(level.price).toFixed(2);
      const dash = level.source === "midpoint" ? ` stroke-dasharray="3 5"` : "";
      const opacity = level.source === "midpoint" ? 0.45 : 0.75;
      return `<line x1="${plot.left}" y1="${y}" x2="${plot.right}" y2="${y}" stroke="#2dd4bf" stroke-width="1" opacity="${opacity}"${dash}/>` +
        `<text x="${plot.right + 6}" y="${Number(y) + 3.5}" fill="#7fe7dc" font-size="10" font-family="ui-monospace,monospace">${level.price.toFixed(digits)}${level.source === "midpoint" ? " m" : ""}</text>`;
    }).join("");

  const ticks = inside.map((bar, index) => ({ bar, index }))
    .filter(entry => {
      const stamp = new Date(entry.bar.time_utc);
      return stamp.getUTCMinutes() === 0 && stamp.getUTCHours() % 3 === 0;
    })
    .map(entry => {
      const x = plot.left + entry.index * slot + slot / 2;
      return `<line x1="${x.toFixed(2)}" y1="${plot.top}" x2="${x.toFixed(2)}" y2="${plot.bottom}" stroke="#1f2733" stroke-width="1"/>` +
        `<text x="${x.toFixed(2)}" y="${plot.bottom + 16}" fill="#8b949e" font-size="10" text-anchor="middle" font-family="ui-monospace,monospace">${new Date(entry.bar.time_utc).toISOString().slice(11, 16)}</text>`;
    }).join("");

  const annotations = trades.map(trade => {
    const parts = [];
    const xTrigger = xForTime(trade.triggerTimeUtc);
    const xFill = trade.fillTimeUtc ? xForTime(trade.fillTimeUtc) : null;
    const xExit = trade.exitTimeUtc ? xForTime(trade.exitTimeUtc) : plot.right;
    const yEntry = yFor(trade.entry);
    const yStop = yFor(trade.stop);
    const yTarget = yFor(trade.target);
    parts.push(`<line x1="${xTrigger.toFixed(2)}" y1="${plot.top}" x2="${xTrigger.toFixed(2)}" y2="${plot.bottom}" stroke="#e6edf3" stroke-width="1" stroke-dasharray="2 4" opacity="0.55"/>`);
    parts.push(`<text x="${(xTrigger + 4).toFixed(2)}" y="${plot.top + 12}" fill="#e6edf3" font-size="10" font-family="ui-monospace,monospace">crossing close ${trade.triggerClose}</text>`);
    parts.push(`<line x1="${xTrigger.toFixed(2)}" y1="${yEntry.toFixed(2)}" x2="${xExit.toFixed(2)}" y2="${yEntry.toFixed(2)}" stroke="#e6edf3" stroke-width="1.6" stroke-dasharray="6 4"/>`);
    parts.push(`<line x1="${xTrigger.toFixed(2)}" y1="${yStop.toFixed(2)}" x2="${xExit.toFixed(2)}" y2="${yStop.toFixed(2)}" stroke="#f85149" stroke-width="1.6"/>`);
    parts.push(`<line x1="${xTrigger.toFixed(2)}" y1="${yTarget.toFixed(2)}" x2="${xExit.toFixed(2)}" y2="${yTarget.toFixed(2)}" stroke="#3fb950" stroke-width="1.6"/>`);
    parts.push(`<text x="${plot.left + 6}" y="${(yStop - 4).toFixed(2)}" fill="#f85149" font-size="10" font-family="ui-monospace,monospace">stop ${trade.stop} (target distance / ${trade.rMultiple})</text>`);
    parts.push(`<text x="${plot.left + 6}" y="${(yTarget - 4).toFixed(2)}" fill="#3fb950" font-size="10" font-family="ui-monospace,monospace">target ${trade.target}</text>`);
    parts.push(`<text x="${plot.left + 6}" y="${(yEntry + 12).toFixed(2)}" fill="#e6edf3" font-size="10" font-family="ui-monospace,monospace">limit back at ${trade.entry}</text>`);
    if (xFill !== null) {
      parts.push(`<rect x="${(xFill - 5).toFixed(2)}" y="${(yEntry - 5).toFixed(2)}" width="10" height="10" fill="none" stroke="#e6edf3" stroke-width="2"/>`);
      parts.push(`<text x="${(xFill + 8).toFixed(2)}" y="${(yEntry - 9).toFixed(2)}" fill="#e6edf3" font-size="10" font-family="ui-monospace,monospace">fill ${trade.fillTimeUtc.slice(11, 16)}</text>`);
    }
    const exitLabel = trade.exitReason === EXIT.TARGET
      ? `target hit ${trade.exitTimeUtc ? trade.exitTimeUtc.slice(11, 16) : ""}`
      : trade.exitReason === EXIT.STOP
        ? `stop hit ${trade.exitTimeUtc ? trade.exitTimeUtc.slice(11, 16) : ""}`
        : trade.exitReason === EXIT.INVALIDATED
          ? `order removed ${trade.exitTimeUtc.slice(11, 16)}`
          : "still working at the end of the tape";
    const yExit = trade.exitReason === EXIT.TARGET ? yTarget : trade.exitReason === EXIT.STOP ? yStop : yEntry;
    const colour = trade.rGross > 0 ? "#3fb950" : trade.rGross < 0 ? "#f85149" : "#8b949e";
    parts.push(`<circle cx="${xExit.toFixed(2)}" cy="${yExit.toFixed(2)}" r="4" fill="${colour}"/>`);
    parts.push(`<text x="${(xExit - 6).toFixed(2)}" y="${(yExit + (trade.rGross > 0 ? -10 : 16)).toFixed(2)}" fill="${colour}" font-size="11" text-anchor="end" font-family="ui-monospace,monospace">${exitLabel} ${trade.rGross > 0 ? "+" : ""}${trade.rGross.toFixed(2)}R</text>`);
    if ((trade.ambiguity || []).length) {
      parts.push(`<text x="${(xExit - 6).toFixed(2)}" y="${(yExit + 30).toFixed(2)}" fill="#d29922" font-size="10" text-anchor="end" font-family="ui-monospace,monospace">ambiguous: ${trade.ambiguity.join(", ")}</text>`);
    }
    return parts.join("");
  }).join("");

  const rows = trades.map(trade => `<tr>
      <td>${esc(trade.kind === "fill" ? "filled" : "not filled")}</td>
      <td>${esc(trade.level)}</td>
      <td>${esc(trade.entry)}</td>
      <td>${esc(trade.stop)}</td>
      <td>${esc(trade.target)}</td>
      <td>${esc((trade.triggerTimeUtc || "").slice(11, 16))}</td>
      <td>${esc(trade.fillTimeUtc ? trade.fillTimeUtc.slice(11, 16) : "-")}</td>
      <td>${esc(trade.exitReason)}</td>
      <td>${trade.rGross > 0 ? "+" : ""}${trade.rGross.toFixed(2)}R</td>
      <td>${money(trade.grossAccountCcy)}</td>
    </tr>`).join("");


  const variant = options.halfGrid
    ? "0.5L2L (3R) - eligible lines: originals and the midpoint between adjacent originals; target: next adjacent line on the combined grid; stop: entry-to-target / 3"
    : "Full L2L (5R) - eligible lines: original marked levels only; target: next original level in the trade's direction; stop: entry-to-target / 5";
  const execution = "entry: limit back at the crossed line, no expiry of its own; it ends when it fills, when the target is taken without it, or when the call ends; a stopped-out trade re-enters at the same line until the target is taken or another line is crossed; one trade at a time per pair";
  const ambiguityNote = result.totals.ambiguous
    ? `${result.totals.ambiguous} trade(s) could not be ordered inside one M5 bar and were resolved pessimistically (STOP_FIRST_PESSIMISTIC); no finer data is staged in this checkout.`
    : "no trade needed an M5 tie-break: every fill, stop and target sits in its own bar.";
  const totals = `${result.totals.fills} filled (${result.totals.targets} target, ${result.totals.stops} stop), ${result.totals.unfilled} removed without a fill, ${result.totals.working} still working; gross ${result.totals.rGross > 0 ? "+" : ""}${result.totals.rGross.toFixed(2)}R over the whole tape.`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>L2L session replay ${esc(options.symbol)} ${esc(session.date)}</title>
<style>
  :root { colour-scheme: dark; }
  body { margin: 0; background: #0d1117; color: #c9d1d9; font: 13px/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .wrap { max-width: 1220px; margin: 0 auto; padding: 18px 20px 40px; }
  h1 { font-size: 16px; margin: 0 0 2px; font-weight: 600; letter-spacing: .01em; }
  .sub { color: #8b949e; font-size: 12px; margin-bottom: 12px; }
  .strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .chip { background: #161b22; border: 1px solid #30363d; border-radius: 999px; padding: 3px 10px; font-size: 11px; color: #adbac7; }
  .chip strong { color: #e6edf3; font-weight: 600; }
  .plot { background: #0b0f14; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
  .notes { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
  @media (max-width: 860px) { .notes { grid-template-columns: 1fr; } }
  .table-wrap { overflow-x: auto; }
  .card { background: #0f141a; border: 1px solid #21262d; border-radius: 8px; padding: 10px 12px; }
  .card h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8b949e; margin: 0 0 6px; font-weight: 600; }
  .card p { margin: 0 0 6px; font-size: 12px; color: #adbac7; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #21262d; font-variant-numeric: tabular-nums; }
  th { color: #8b949e; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; }
  .warn { color: #d29922; }
  .muted { color: #6e7681; font-size: 11px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>L2L session replay - ${esc(options.symbol)} - session ${esc(session.date)} (05:00 to 05:00 Europe/London)</h1>
  <div class="sub">${esc(variant)}</div>
  <div class="strip">
    <span class="chip">call model <strong>${esc(options.callModel || "not stated")}</strong></span>
    <span class="chip">call timestamp <strong>${esc(options.callAsOf || "not stated")}</strong></span>
    <span class="chip">side <strong>${esc(options.side)}</strong></span>
    <span class="chip">risk <strong>${(options.riskPct * 100).toFixed(2)}% of balance</strong></span>
    <span class="chip">balance <strong>${money(options.balance)} start</strong></span>
    <span class="chip">result <strong>${totals}</strong></span>
  </div>
  <div class="plot">
  <svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="EURUSD session replay">
    <rect x="0" y="0" width="${width}" height="${height}" fill="#0b0f14"/>
    ${ticks}
    ${levelLines}
    ${candles}
    ${annotations}
  </svg>
  </div>
  <div class="notes">
    <div class="card">
      <h2>Execution rules preserved from the live trader</h2>
      <p>${esc(execution)}</p>
      <p class="warn">${esc(ambiguityNote)}</p>
      <p class="muted">Gross of spread, commission and slippage: no bid/ask history is staged, so no number here is a net result or a claim of edge.</p>
    </div>
    <div class="card">
      <h2>Provenance</h2>
      <p>${esc(provenance.summary)}</p>
      <p class="muted">Feed ${esc(provenance.feed.sha256.slice(0, 16))} (${esc(provenance.feed.bytes)} bytes, ${esc(provenance.feed.first)} to ${esc(provenance.feed.last)})</p>
      <p class="muted">Ladder ${esc(provenance.levels.sha256.slice(0, 16))}, generated ${esc(provenance.levels.generatedAtUtc)}, ${esc(provenance.levels.count)} levels, ${esc(provenance.levels.firstMarked)}</p>
      <p class="muted">Tape coverage ${esc(coverage.firstBarUtc)} to ${esc(coverage.lastBarUtc)} (${esc(coverage.hoursCovered)}h of ${esc(coverage.date)})</p>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>state</th><th>line</th><th>entry</th><th>stop</th><th>target</th><th>crossing</th><th>fill</th><th>exit</th><th>R</th><th>gross</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="muted">One session, one instrument, one call: this is a picture of the rule executing, not a result.</p>
</div>
</body>
</html>`;
  return html;
}


function pickChartSession(result, requested) {
  if (requested) {
    const found = result.coverage.find(entry => entry.date === requested);
    if (found) return found;
    throw new Error(`the tape covers no session on ${requested}`);
  }
  const scored = result.coverage
    .map(entry => ({
      entry,
      fills: result.trades.filter(trade => trade.sessionDate === entry.date && trade.kind === "fill").length,
      rows: result.trades.filter(trade => trade.sessionDate === entry.date).length
    }))
    .sort((a, b) => (b.fills - a.fills) || (b.rows - a.rows) || a.entry.date.localeCompare(b.entry.date));
  return scored.length ? scored[0].entry : null;
}

function main() {
  const options = parseArgs(process.argv);
  const feed = readJson(options.feed);
  const instrument = instrumentFromFeed(feed, options.symbol);
  const ladder = levelsFromFile(options.levels, options.symbol);
  const sessions = sessionsForBars(instrument.bars);
  const result = replaySessions({
    bars: instrument.bars,
    levels: ladder.levels,
    side: options.side,
    rMultiple: options.rMultiple,
    halfGrid: options.halfGrid,
    point: instrument.point,
    digits: instrument.digits,
    sessions,
    balanceStart: options.balance,
    riskPct: options.riskPct,
    contract: { contractSize: instrument.contractSize, minLot: instrument.minLot, lotStep: instrument.lotStep },
    callModel: options.callModel,
    callAsOfUtc: options.callAsOf
  });

  const stamps = instrument.bars.map(bar => bar.time_utc).filter(Boolean).sort();
  const marked = ladder.levels.map(level => level.marked_at_utc).filter(Boolean).sort();
  const provenance = {
    summary: options.provenance ||
      "feed and ladder read from the copies of origin/main's data/live-trading.json and data/l2l-levels.json held in the ignored research folder",
    feed: {
      file: path.relative(REPO_ROOT, options.feed).replace(/\\/g, "/"),
      sha256: sha256(options.feed),
      bytes: fs.statSync(options.feed).size,
      first: stamps[0] || null,
      last: stamps[stamps.length - 1] || null,
      bars: instrument.bars.length
    },
    levels: {
      file: path.relative(REPO_ROOT, options.levels).replace(/\\/g, "/"),
      sha256: sha256(options.levels),
      generatedAtUtc: ladder.generatedAtUtc || null,
      count: ladder.levels.length,
      firstMarked: marked[0] || null,
      lastMarked: marked[marked.length - 1] || null
    }
  };

  const chartCoverage = pickChartSession(result, options.chartSession);
  const slug = `${options.symbol}-${options.rMultiple}r${options.halfGrid ? "-half" : ""}-${options.side}`
    .replace(/[^a-zA-Z0-9.\-_]/g, "");
  const outDir = assertResearchPath(options.out, "run_l2l_m5_session_replay");
  fs.mkdirSync(outDir, { recursive: true });


  const ledgerPath = assertResearchPath(path.join(outDir, `ledger-${slug}.json`), "run_l2l_m5_session_replay");
  const ledger = {
    schema_version: "l2l-m5-session-replay-v1",
    generated_at_utc: new Date().toISOString(),
    research_only: true,
    symbol: options.symbol,
    variant: options.halfGrid ? "half-l2l-3r" : "full-l2l-5r",
    rules: {
      eligible_trigger: options.halfGrid
        ? "any original marked level or the midpoint between adjacent originals"
        : "any original marked level",
      entry: "M5 close beyond the line in the permitted direction, then a limit order back at that line",
      target: options.halfGrid
        ? "next adjacent level on the combined grid"
        : "next original level in the trade direction",
      stop: options.halfGrid ? "entry-to-target distance divided by 3" : "entry-to-target distance divided by 5",
      size: `${(options.riskPct * 100).toFixed(2)}% of the running simulated balance per filled trade`,
      order_lifetime: "no expiry of its own: ends when filled, when the target is taken without a fill, or when the call ends",
      stopping_out: "re-enter at the same line until the target is taken or another line is crossed",
      costs: "gross: spread, commission and slippage are not modelled"
    },
    instrument: {
      point: instrument.point,
      digits: instrument.digits,
      contract_size: instrument.contractSize,
      min_lot: instrument.minLot,
      lot_step: instrument.lotStep
    },
    provenance,
    inputs: result.inputs,
    sessions: result.coverage,
    totals: result.totals,
    trades: result.trades,
    events: result.events,
    grid: result.grid.map(level => ({ price: level.price, source: level.source, role: level.role, label: level.label })),
    notes: [
      "A replay of the rule executing on staged bars, not a claim of edge: one instrument, one call, gross of costs.",
      "The call is an input with its own timestamp; no archived Layer 1 file for this tape is staged in this checkout unless provenance says otherwise.",
      "Ambiguous bars are resolved pessimistically and flagged; finer data is not staged."
    ]
  };
  fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 1)}\n`, "utf8");

  const sessionWindow = sessions.find(session => session.date === chartCoverage.date) || sessions[sessions.length - 1];
  const htmlPath = assertResearchPath(
    path.join(outDir, `replay-${slug}-${chartCoverage.date}.html`),
    "run_l2l_m5_session_replay"
  );
  fs.writeFileSync(htmlPath, renderReplayHtml({
    result,
    session: sessionWindow,
    coverage: chartCoverage,
    options: { ...options, digits: instrument.digits },
    provenance,
    trades: result.trades.filter(trade => trade.sessionDate === chartCoverage.date),
    bars: instrument.bars
  }), "utf8");

  console.log(JSON.stringify({
    ledger: path.relative(REPO_ROOT, ledgerPath).replace(/\\/g, "/"),
    chart: path.relative(REPO_ROOT, htmlPath).replace(/\\/g, "/"),
    chartSession: chartCoverage.date,
    totals: result.totals,
    sessions: result.coverage.map(entry =>
      `${entry.date} bars=${entry.bars}${entry.truncatedStart ? " truncated-start" : ""}${entry.truncatedEnd ? " truncated-end" : ""}`)
  }, null, 1));
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  sessionsForBars,
  instrumentFromFeed,
  levelsFromFile,
  renderReplayHtml,
  pickChartSession
};

