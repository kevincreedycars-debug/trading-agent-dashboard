/**
 * The USD Layer 1 Backtester panel, published as a page of its own so the research dashboard can link to it.
 *
 * The renderers below are the dashboard's own code, moved here unchanged, plus the five small helpers they
 * call and a boot hook. Rules live in lib/usd_l1_votes.js, the candle replay in lib/usd_l1_replay.js, and the
 * numbers in data/usd-layer1-backtester/run-v1.json, so the page shows a saved run and never computes a new
 * one. Research only: no figure here is an edge claim and neither model is published as a live call.
 */

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch (e) {
      return [value];
    }
  }

  return [];
}

function formatDashboardTime(value) {
  if (!value || value === "pending") return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(date);
}

function renderBacktestKpiMetric(label, primary, secondary = "", detail = "") {
  return `
    <article class="backtest-metric-card backtest-kpi-card">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <h3>${escapeHtml(primary)}</h3>
      ${secondary ? `<strong class="backtest-kpi-secondary">${escapeHtml(secondary)}</strong>` : ""}
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
    </article>
  `;
}

async function fetchLocalJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} ${response.status}`);
  }
  return response.json();
}

const usdLayer1BacktesterUrl = "./data/usd-layer1-backtester/run-v1.json?v=20261109-usd-l1-call-trace";
let usdLayer1Data = null;
let usdLayer1LoadError = null;
let usdLayer1Request = null;
let usdL1ReplayController = null;
const usdLayer1State = {
  tab: "dxy_direction",
  selectedDate: null,
  sessionFilter: "all",
  demoSession: null,
  workedDate: null,
  reRun: null,
  evidence: null
};

function usdL1Text(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(String(value));
}

function usdL1Number(value, decimals = 2) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(decimals);
}

function usdL1Signed(value, decimals = 2, suffix = "") {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toFixed(decimals)}${suffix}`;
}

function usdL1Percent(value, decimals = 2) {
  return Number.isFinite(value) ? `${Number(value).toFixed(decimals)}%` : "—";
}

function usdL1DashboardDirection(direction) {
  const text = String(direction || "").toUpperCase();
  if (text === "BULLISH") return { label: "USD bullish", tone: "bull" };
  if (text === "BEARISH") return { label: "USD bearish", tone: "bear" };
  if (text === "NO_CALL") return { label: "No call", tone: "flat" };
  return { label: direction ? String(direction) : "No call", tone: "flat" };
}

function usdL1ConvictionPips(conviction) {
  if (!Number.isFinite(conviction)) return `<span class="usd-l1-conviction empty">no band</span>`;
  const pips = [1, 2, 3, 4, 5]
    .map((level) => `<span class="usd-l1-pip${level <= conviction ? " on" : ""}"></span>`)
    .join("");
  return `<span class="usd-l1-conviction" title="Conviction ${conviction} of 5">${pips}<b>${conviction}/5</b></span>`;
}

function usdL1ResultChip(result) {
  const tone = result === "hit" ? "hit" : result === "miss" ? "miss" : result === "flat" ? "flat" : "none";
  const label = result === "hit" ? "opposite" : result === "miss" ? "same way" : result === "flat" ? "flat" : "—";
  return `<span class="usd-l1-chip ${tone}" title="${escapeHtml(result || "unscored")}">${label}</span>`;
}

function renderUsdL1Progress(payload = {}) {
  const run = payload.run || {};
  const progress = payload.progress || {};
  const stages = asArray(progress.stages);
  const eligible = Number.isFinite(run.sessions_eligible) ? run.sessions_eligible : 0;
  const processed = Number.isFinite(run.sessions_processed) ? run.sessions_processed : 0;
  return `
    <section class="usd-l1-progress" data-usd-l1-progress="true">
      <div class="usd-l1-progress-head">
        <div>
          <p class="eyebrow">Progress</p>
          <h3>${usdL1Text(progress.current_stage_label || "Not started")}</h3>
        </div>
        <p class="usd-l1-progress-detail">${usdL1Text(progress.current_stage_detail || "")}</p>
      </div>
      <div class="usd-l1-progress-metrics">
        ${renderBacktestKpiMetric("Run version", usdL1Text(run.run_version), usdL1Text(run.challenger_version, ""), "Frozen parameter set and challenger version this artefact was built with")}
        ${renderBacktestKpiMetric("Date range", `${usdL1Text(run.date_range?.start)} → ${usdL1Text(run.date_range?.end)}`, "05:00 London sessions", "Every session runs from 05:00 London to 05:00 London the next local date")}
        ${renderBacktestKpiMetric("Dates processed", `${usdL1Number(payload.results?.dates_processed ?? processed, 0)} dates`, "05:00 London sessions", "Every eligible weekday 05:00 session was processed; a processed date is not a scored call, and each test carries its own scored count below")}
        ${renderBacktestKpiMetric("Last update", usdL1Text(formatDashboardTime(run.last_update)), "", "Timestamp stamped into the saved research artefact")}
      </div>
      <ol class="usd-l1-stage-list">
        ${stages.map((stage) => `
          <li class="usd-l1-stage ${escapeHtml(stage.state || "")}" data-usd-l1-stage="${escapeHtml(stage.key || "")}">
            <span class="usd-l1-stage-state">${usdL1Text(stage.state)}</span>
            <div>
              <strong>${usdL1Text(stage.label)}</strong>
              <p>${usdL1Text(stage.detail)}</p>
            </div>
          </li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderUsdL1Coverage(payload = {}) {
  const coverage = payload.coverage || {};
  const byModel = coverage.by_model || {};
  const byTest = coverage.by_test || {};
  const modelCard = (key, label) => {
    const entry = byModel[key] || {};
    return `
      <article class="usd-l1-coverage-card" data-usd-l1-model="${escapeHtml(key)}">
        <p class="eyebrow">${escapeHtml(label)}</p>
        <p class="usd-l1-coverage-number">${usdL1Number(entry.calls_reconstructed, 0)}<span> of ${usdL1Number(entry.sessions_eligible, 0)} sessions called</span></p>
        <p class="usd-l1-coverage-sub">${usdL1Percent(entry.call_coverage_pct)} coverage · ${usdL1Number(entry.no_call_sessions, 0)} no-call sessions</p>
        <ul class="usd-l1-conviction-split">
          ${[1, 2, 3, 4, 5].map((level) => `<li><span>conviction ${level}</span><b>${usdL1Number(entry.convictions?.[level], 0)}</b></li>`).join("")}
        </ul>
      </article>
    `;
  };
  const testRow = (id, label) => {
    const entry = byTest[id] || {};
    return `
      <tr data-usd-l1-test-coverage="${escapeHtml(id)}">
        <th scope="row">${escapeHtml(label)}</th>
        <td>${usdL1Number(entry.usable_sessions, 0)}</td>
        <td>${asArray(entry.holding_it_up).map((item) => `<span class="usd-l1-blocker">${escapeHtml(item)}</span>`).join("")}</td>
      </tr>
    `;
  };
  return `
    <section class="usd-l1-coverage" data-usd-l1-coverage="true">
      <div class="usd-l1-coverage-models">
        ${modelCard("current", "Current model - call reconstruction")}
        ${modelCard("challenger", "Challenger - call reconstruction")}
      </div>
      <div class="usd-l1-coverage-tests">
        <table class="usd-l1-table">
          <caption>Usable sessions per test, and what is holding each one up</caption>
          <thead>
            <tr><th scope="col">Test</th><th scope="col">Usable sessions</th><th scope="col">What is holding it up</th></tr>
          </thead>
          <tbody>
            ${testRow("dxy_direction", "① DXY direction")}
            ${testRow("four_markets", "② Four markets")}
            ${testRow("l2l_full_5r", "③ Full L2L 5R")}
            ${testRow("l2l_half_3r", "④ Half L2L 3R")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

const USD_L1_TABS = [
  { id: "dxy_direction", label: "① DXY direction" },
  { id: "four_markets", label: "② Four markets" },
  { id: "l2l_full_5r", label: "③ Full L2L 5R" },
  { id: "l2l_half_3r", label: "④ Half L2L 3R" }
];

function renderUsdL1TabStrip() {
  return `
    <nav class="usd-l1-tabs" role="tablist" aria-label="The four tests" data-usd-l1-tabs="true">
      ${USD_L1_TABS.map((tab) => `
        <button
          type="button"
          role="tab"
          class="usd-l1-tab${usdLayer1State.tab === tab.id ? " active" : ""}"
          aria-selected="${usdLayer1State.tab === tab.id ? "true" : "false"}"
          data-usd-l1-tab="${tab.id}"
        >${escapeHtml(tab.label)}</button>
      `).join("")}
    </nav>
  `;
}

function usdL1ConvictionTable(byConviction = {}, label, context = null) {
  const levels = [1, 2, 3, 4, 5];
  // Where the table belongs to one market and one model, every figure opens the dates behind it.
  const cell = (level, key, value, render, decimals = 0) => {
    if (!context || !context.market || !context.model) return render;
    return usdL1EvidenceButton(
      `conviction|${context.market}|${context.model}|${level}`,
      render,
      `Conviction ${level} ${key} for ${context.model} on ${context.market}`
    );
  };
  return `
    <table class="usd-l1-table usd-l1-conviction-table">
      <caption>${escapeHtml(label)}</caption>
      <thead>
        <tr>
          <th scope="col">Conviction</th>
          <th scope="col">Scored</th>
          <th scope="col">Right</th>
          <th scope="col">Wrong</th>
          <th scope="col">Flat</th>
          <th scope="col">Accuracy</th>
          <th scope="col">95% lower bound</th>
        </tr>
      </thead>
      <tbody>
        ${levels.map((level) => {
          const entry = byConviction[level] || {};
          return `
            <tr data-usd-l1-conviction-row="${level}">
              <th scope="row">${level}</th>
              <td>${cell(level, "scored", entry.scored, usdL1Number(entry.scored, 0))}</td>
              <td>${cell(level, "right", entry.hits, usdL1Number(entry.hits, 0))}</td>
              <td>${cell(level, "wrong", entry.misses, usdL1Number(entry.misses, 0))}</td>
              <td>${cell(level, "flat", entry.flat, usdL1Number(entry.flat, 0))}</td>
              <td>${context && context.market && context.model
                ? usdL1EvidenceButton(
                    `conviction|${context.market}|${context.model}|${level}`,
                    usdL1Percent(entry.accuracy_pct),
                    `Conviction ${level} accuracy for ${context.model} on ${context.market}`
                  )
                : usdL1Percent(entry.accuracy_pct)}</td>
              <td>${usdL1Percent(entry.lower_bound_pct)}</td>
            </tr>
          `;
        }).join("")}
        <tr class="usd-l1-uncalled-row">
          <th scope="row">no call</th>
          <td colspan="5">${
            context && context.model
              ? usdL1EvidenceButton(
                  `nocall|${context.model}|any`,
                  `${usdL1Number(byConviction.uncalled?.no_call, 0)} sessions`,
                  `${context.model}: every no-call date`
                )
              : `${usdL1Number(byConviction.uncalled?.no_call, 0)} sessions`
          }</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderUsdL1DxyTab(test = {}, payload = {}) {
  const official = test.official_series || {};
  const models = test.models || {};
  const header = payload.results?.tests?.find((entry) => entry.id === "dxy_direction") || {};
  const card = (key, label) => `
    <article class="usd-l1-test-card" data-usd-l1-dxy-model="${escapeHtml(key)}">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <p class="usd-l1-test-headline">${usdL1EvidenceButton(
        `calls|${key}`,
        `${usdL1Number(models[key]?.awaiting_prices_sessions ?? models[key]?.calls_made, 0)} calls ready to score`
      )}</p>
      <p class="usd-l1-test-copy">${usdL1Number(models[key]?.overall?.scored, 0)} scored ·
        ${usdL1Number(models[key]?.overall?.flat, 0)} flat · ${usdL1Percent(
          models[key]?.overall?.accuracy_pct
        )} accuracy — none of these can be filled until the official series exists</p>
      ${usdL1ConvictionTable(models[key]?.by_conviction, `${label} by conviction`)}
    </article>
  `;
  return `
    <section class="usd-l1-test-body" data-usd-l1-test-body="dxy_direction">
      <article class="usd-l1-blocker-card" data-usd-l1-dxy-status="${escapeHtml(header.status || "blocked")}">
        <p class="eyebrow">Status</p>
        <h3>${escapeHtml(header.status_label || "0 scored · awaiting DXY prices")}</h3>
        <p class="usd-l1-test-copy">${usdL1Text(official.required_series)} is not in this checkout, so no session can be
          priced at either 05:00 endpoint. The calls exist and are counted; the accuracy column is empty because the
          outcome does not.</p>
        <p class="usd-l1-test-copy">${usdL1Text(test.blocker?.reason || official.why_it_cannot_stand_in)}</p>
        <p class="usd-l1-test-copy muted">What exists instead: ${usdL1Text(official.what_exists_instead)}. It carries
          the challenger's dollar-momentum mechanism and is labelled as a substitution there; it is refused for this
          test.</p>
        <p class="usd-l1-test-copy muted">Missing input: ${escapeHtml(header.missing_input || official.unblock_condition || "")}
          — owner: ${usdL1Text(official.blocker_owner)}</p>
      </article>
      <div class="usd-l1-test-grid">
        ${card("current", "Current model")}
        ${card("challenger", "Challenger")}
      </div>
    </section>
  `;
}

function renderUsdL1FourMarketTab(test = {}, payload = {}) {
  const models = test.models || {};
  const comparisons = (test.comparisons && test.comparisons.markets) || {};
  const marketKeys = Object.keys(models.challenger?.markets || models.current?.markets || {});
  const header = payload.results?.tests?.find((entry) => entry.id === "four_markets") || {};
  const row = (key) => {
    const current = models.current?.markets?.[key];
    const challenger = models.challenger?.markets?.[key];
    const compare = comparisons[key] || {};
    return `
      <tr data-usd-l1-market="${escapeHtml(key)}">
        <th scope="row">${escapeHtml(current?.label || challenger?.label || key)}</th>
        <td>${usdL1EvidenceButton(`result|${key}|current|hit`, `${usdL1Number(current?.overall?.hits, 0)}`)} /
          ${usdL1EvidenceButton(`result|${key}|current|scored`, `${usdL1Number(current?.overall?.scored, 0)}`)}
          · ${usdL1PercentButton(`result|${key}|current|scored`, current?.overall?.accuracy_pct)}</td>
        <td>${usdL1EvidenceButton(`result|${key}|current|flat`, `${usdL1Number(current?.overall?.flat, 0)}`)}</td>
        <td>${usdL1EvidenceButton(`result|${key}|challenger|hit`, `${usdL1Number(challenger?.overall?.hits, 0)}`)} /
          ${usdL1EvidenceButton(`result|${key}|challenger|scored`, `${usdL1Number(challenger?.overall?.scored, 0)}`)}
          · ${usdL1PercentButton(`result|${key}|challenger|scored`, challenger?.overall?.accuracy_pct)}</td>
        <td>${usdL1EvidenceButton(`result|${key}|challenger|flat`, `${usdL1Number(challenger?.overall?.flat, 0)}`)}</td>
        <td>${usdL1EvidenceButton(`comparison|${key}|corrected`, `+${usdL1Number(compare.corrected, 0)}`)} /
          ${usdL1EvidenceButton(`comparison|${key}|spoiled`, `−${usdL1Number(compare.spoiled, 0)}`)}</td>
        <td>${usdL1EvidenceButton(`comparison|${key}|matched`, `${usdL1Number(compare.matched, 0)}`)}</td>
        <td><span class="usd-l1-chip none">pending test ①</span></td>
      </tr>
    `;
  };
  const firstMarket = marketKeys[0];
  const currentNoCall = usdL1NoCallSessions(payload, "current", "any").length;
  const challengerThin = usdL1NoCallSessions(payload, "challenger", "min_usable").length;
  const challengerSplit = usdL1NoCallSessions(payload, "challenger", "deadband").length;
  return `
    <section class="usd-l1-test-body" data-usd-l1-test-body="four_markets">
      <p class="usd-l1-test-intro">${usdL1Text(test.question)}</p>
      <p class="usd-l1-test-copy muted">${usdL1Text(test.outcome_reads)} Accuracy counts only sessions with a call and a
        move outside the frozen flat band, and the flat count sits beside it so noise is never counted as a hit.
        ${usdL1Text(header.scoring_note || "")}</p>
      <table class="usd-l1-table usd-l1-four-market-table">
        <caption>Direction across four markets — ${usdL1Number(test.usable_sessions, 0)} sessions with a scorable move</caption>
        <thead>
          <tr>
            <th scope="col">Market</th>
            <th scope="col">Current correct / scored</th>
            <th scope="col">Current flat</th>
            <th scope="col">Challenger correct / scored</th>
            <th scope="col">Challenger flat</th>
            <th scope="col">Corrected / spoiled</th>
            <th scope="col">Matched dates</th>
            <th scope="col">When DXY proved the call</th>
          </tr>
        </thead>
        <tbody>
          ${marketKeys.map(row).join("")}
        </tbody>
      </table>
      <article class="usd-l1-test-card usd-l1-call-difference" data-usd-l1-call-difference="true">
        <p class="eyebrow">Why the challenger called ${usdL1Number(header.calls_ready?.challenger ?? payload.results?.calls?.challenger, 0)}
          dates and the current model called ${usdL1Number(payload.results?.calls?.current, 0)}</p>
        <p class="usd-l1-test-copy">The current model abstained on
          ${usdL1EvidenceButton("nocall|current|any", `${usdL1Number(currentNoCall, 0)} dates`)} because it returned
          NO_CLEAR_BIAS. The challenger abstained on
          ${usdL1EvidenceButton("nocall|challenger|min_usable", `${usdL1Number(challengerThin, 0)} dates`)} for thin data
          (fewer than ${usdL1Number(payload.run?.challenger_rules?.min_usable_mechanisms, 0)} of
          ${usdL1Number(asArray(payload.run?.challenger_mechanisms).length, 0)} mechanisms had a value) and on
          ${usdL1EvidenceButton("nocall|challenger|deadband", `${usdL1Number(challengerSplit, 0)} dates`)} because the
          mechanisms split inside the ${usdL1Number(rules_agreement_deadband_pct(payload), 0)}% deadband. Two different
          definitions of silence, not two different data sets.</p>
        <p class="usd-l1-test-copy muted">${usdL1Text(header.comparison_note || "")}</p>
      </article>
      <p class="usd-l1-test-copy muted">The final column is the second view the brief asks for: accuracy restricted to
        calls DXY later proved right. It needs the same licensed series test ① is waiting for, so it is reported as
        pending rather than quietly dropped.</p>
      <div class="usd-l1-test-grid">
        <article class="usd-l1-test-card">${usdL1ConvictionTable(
          models.current?.markets?.[firstMarket]?.by_conviction,
          `Current model by conviction — ${models.current?.markets?.[firstMarket]?.label || firstMarket}`,
          { market: firstMarket, model: "current" }
        )}</article>
        <article class="usd-l1-test-card">${usdL1ConvictionTable(
          models.challenger?.markets?.[firstMarket]?.by_conviction,
          `Challenger by conviction — ${models.challenger?.markets?.[firstMarket]?.label || firstMarket}`,
          { market: firstMarket, model: "challenger" }
        )}</article>
      </div>
    </section>
  `;
}

function usdL1EquityCurveSvg(account = {}, label = "") {
  const points = asArray(account.equity_curve);
  const start = Number.isFinite(account.starting_balance) ? account.starting_balance : 100000;
  if (points.length < 2) {
    return `<div class="usd-l1-empty">No equity curve: this account has no fills yet.</div>`;
  }
  const balances = points.map((point) => point.balance);
  const low = Math.min(start, ...balances);
  const high = Math.max(start, ...balances);
  const span = high - low || 1;
  const width = 520;
  const height = 150;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * (width - 8) + 4;
    const y = height - 8 - ((point.balance - low) / span) * (height - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = points[points.length - 1].balance;
  const tone = last >= start ? "up" : "down";
  const startY = height - 8 - ((start - low) / span) * (height - 16);
  return `
    <figure class="usd-l1-equity" data-usd-l1-equity="${escapeHtml(account.id || "")}">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)} equity curve">
        <line x1="0" y1="${startY.toFixed(1)}" x2="${width}" y2="${startY.toFixed(1)}" class="usd-l1-equity-start"></line>
        <polyline points="${coords.join(" ")}" class="usd-l1-equity-line ${tone}"></polyline>
      </svg>
      <figcaption>${escapeHtml(label)} · start £${usdL1Number(start, 2)} · end £${usdL1Number(last, 2)} · peak-to-trough £${usdL1Number(account.max_drawdown?.amount, 2)} (${usdL1Percent(account.max_drawdown?.pct)})</figcaption>
    </figure>
  `;
}

function usdL1AccountTable(accounts = []) {
  if (!accounts.length) return `<div class="usd-l1-empty">No accounts were run.</div>`;
  return `
    <table class="usd-l1-table usd-l1-account-table">
      <caption>Four independent £100,000 accounts, 1% of each account's own running balance per filled trade</caption>
      <thead>
        <tr>
          <th scope="col">Account</th>
          <th scope="col">Fills</th>
          <th scope="col">Wins</th>
          <th scope="col">Losses</th>
          <th scope="col">Average R</th>
          <th scope="col">Ending balance</th>
          <th scope="col">Max drawdown</th>
          <th scope="col">Call source</th>
        </tr>
      </thead>
      <tbody>
        ${accounts.map((account) => `
          <tr data-usd-l1-account="${escapeHtml(account.id || "")}">
            <th scope="row">${escapeHtml(account.label || account.id || "")}</th>
            <td>${usdL1Number(account.fills, 0)}</td>
            <td>${usdL1Number(account.wins, 0)}</td>
            <td>${usdL1Number(account.losses, 0)}</td>
            <td>${usdL1Signed(account.average_r, 2, "R")}</td>
            <td>£${usdL1Number(account.ending_balance, 2)}</td>
            <td>£${usdL1Number(account.max_drawdown?.amount, 2)} (${usdL1Percent(account.max_drawdown?.pct)})</td>
            <td class="usd-l1-call-source">demo call shared by both model slots</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderUsdL1DemoBlock(demo = {}) {
  if (!demo || !demo.available) {
    return `
      <article class="usd-l1-blocker-card">
        <p class="eyebrow">Execution demo</p>
        <h3>Not available in this checkout</h3>
        <p class="usd-l1-test-copy">${usdL1Text(demo?.reason)}</p>
      </article>
    `;
  }
  const sessions = asArray(demo.sessions).filter((session) => asArray(session.candles).length);
  const selected = usdLayer1State.demoSession || (sessions[sessions.length - 1] || {}).date || null;
  const session = sessions.find((entry) => entry.date === selected) || sessions[sessions.length - 1];
  const trades = asArray(demo.trades).filter((trade) => trade.sessionDate === (session && session.date));
  return `
    <article class="usd-l1-demo" data-usd-l1-demo="true">
      <div class="usd-l1-demo-head">
        <div>
          <p class="eyebrow">Execution demo</p>
          <h3>${escapeHtml(demo.market)} · ${escapeHtml(session ? session.date : "no session")} · M5 replay</h3>
        </div>
        <p class="usd-l1-test-copy muted">${usdL1Text(demo.label)}</p>
      </div>
      <p class="usd-l1-test-copy muted">Call source: ${usdL1Text(demo.call_source)}</p>
      <div class="usd-l1-demo-controls">
        <div class="usd-l1-demo-sessions" role="group" aria-label="Demo session">
          ${sessions.map((entry) => `
            <button type="button" class="usd-l1-demo-session${entry.date === (session && session.date) ? " active" : ""}" data-usd-l1-demo-session="${escapeHtml(entry.date)}">
              ${escapeHtml(entry.date)}<span>${asArray(entry.candles).length} bars</span>
            </button>
          `).join("")}
        </div>
        <div class="usd-l1-replay-buttons" role="group" aria-label="Replay step">
          <button type="button" data-usd-l1-replay-action="first">⏮ First</button>
          <button type="button" data-usd-l1-replay-action="prev">◀ Back</button>
          <button type="button" data-usd-l1-replay-action="next">Next ▶</button>
          <button type="button" data-usd-l1-replay-action="last">Last ⏭</button>
        </div>
      </div>
      <div class="usd-l1-replay-frame" data-usd-l1-replay="true" data-usd-l1-replay-session="${escapeHtml(session ? session.date : "")}" aria-label="Candle replay of the demo session"></div>
      <p class="usd-l1-replay-caption" data-usd-l1-replay-caption="true">Step 0 of 0</p>
      <p class="usd-l1-test-copy muted">${escapeHtml(demo.provenance?.note || "")}</p>
      <p class="usd-l1-test-copy muted">${trades.length} trades belong to this session; the stepper walks their qualifying close, order, fill, stop, target and exit in fill-time order.</p>
    </article>
  `;
}

function renderUsdL1LineToLineTab(payload = {}, test = {}) {
  const accounts = asArray(test.accounts);
  const geometry = test.geometry || {};
  const blockerList = asArray(test.blockers);
  const variantKey = test.id === "l2l_half_3r" ? "half" : "full";
  const variant = (payload.execution_demo?.variants || {})[variantKey] || {};
  const totals = variant.totals || {};
  const header = payload.results?.tests?.find((entry) => entry.id === test.id) || {};
  const accountRows = accounts.filter((account) => account.geometry === variantKey);
  return `
    <section class="usd-l1-test-body" data-usd-l1-test-body="${escapeHtml(test.id || "")}">
      <p class="usd-l1-test-intro">${usdL1Text(test.question)}</p>
      <article class="usd-l1-blocker-card">
        <p class="eyebrow">Scored grid blocked — ${escapeHtml(header.status_label || "")}</p>
        <h3>No session can be executed line-to-line across the four markets yet</h3>
        <ul class="usd-l1-blocker-list">
          ${blockerList.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <p class="usd-l1-test-copy muted">Missing input: ${escapeHtml(header.missing_input || "")} ·
          usable dates: ${escapeHtml(header.usable_dates || `${usdL1Number(test.usable_sessions, 0)} of 725 sessions`)}</p>
        <p class="usd-l1-test-copy muted">Geometry this lane will use when the data arrives: ${usdL1Text(geometry.grid)};
          target ${usdL1Text(geometry.target)}; ${usdL1Text(geometry.stop)}.</p>
      </article>
      <div class="usd-l1-test-grid usd-l1-l2l-grid">
        <article class="usd-l1-test-card">
          <p class="eyebrow">Demo ledger totals</p>
          <p class="usd-l1-test-copy">${usdL1Number(totals.fills, 0)} fills · ${usdL1Number(totals.targets, 0)} targets ·
            ${usdL1Number(totals.stops, 0)} stops · ${usdL1Number(totals.working, 0)} still working ·
            ${usdL1Signed(totals.rGross, 2, "R")} gross</p>
          <p class="usd-l1-test-copy muted">Execution demo: gross of spread, commission and slippage, two sessions, one
            pair, one call direction. Not a scored result.</p>
        </article>
        <article class="usd-l1-test-card">
          <p class="eyebrow">Win rate, net R, balance and drawdown per account</p>
          <ul class="usd-l1-method-list">
            ${accountRows
              .map(
                (account) => `
                <li><b>${escapeHtml(account.label || account.id)}</b><span>
                  ${usdL1EvidenceButton(
                    `trades|${variantKey}|${account.id}`,
                    `${usdL1Number(account.wins, 0)} winning / ${usdL1Number(
                      (account.wins || 0) + (account.losses || 0),
                      0
                    )} closed`
                  )} ·
                  ${usdL1Percent(
                    (account.wins || 0) + (account.losses || 0)
                      ? ((account.wins || 0) / ((account.wins || 0) + (account.losses || 0))) * 100
                      : null
                  )} win rate · net ${usdL1Signed(account.total_r, 2, "R")} ·
                  £${usdL1Number(account.ending_balance, 2)} from £${usdL1Number(account.starting_balance, 2)} at
                  ${usdL1Number(account.risk_per_trade_pct, 0)}% risk per fill · max drawdown
                  £${usdL1Number(account.max_drawdown, 2)}</span></li>
              `
              )
              .join("") || `<li><span>no account belongs to this geometry yet</span></li>`}
          </ul>
          <p class="usd-l1-test-copy muted">Each figure opens its trade ledger; the replay below walks the same trades
            bar by bar.</p>
        </article>
        <article class="usd-l1-test-card">
          <p class="eyebrow">What would make this scored</p>
          <p class="usd-l1-test-copy">An archived 5-minute tape and a pre-session level ladder for each market, plus a
            reconstructed 05:00 call for those dates. The four accounts would then run on the same dates for both models.</p>
        </article>
      </div>
      ${usdL1AccountTable(accounts)}
      <div class="usd-l1-equity-grid">
        ${accounts.map((account) => usdL1EquityCurveSvg(account, account.label || account.id || "")).join("")}
      </div>
      ${renderUsdL1DemoBlock(payload.execution_demo)}
    </section>
  `;
}

function renderUsdL1TestBody(payload = {}) {
  const tests = payload.tests || {};
  if (usdLayer1State.tab === "dxy_direction") return renderUsdL1DxyTab(tests.dxy_direction, payload);
  if (usdLayer1State.tab === "four_markets") return renderUsdL1FourMarketTab(tests.four_markets, payload);
  if (usdLayer1State.tab === "l2l_full_5r") return renderUsdL1LineToLineTab(payload, tests.l2l_full_5r);
  return renderUsdL1LineToLineTab(payload, tests.l2l_half_3r);
}

const USD_L1_SESSION_LIMIT = 150;

function usdL1SessionsForFilter(payload = {}) {
  const sessions = asArray(payload.sessions);
  const filter = usdLayer1State.sessionFilter;
  return sessions.filter((session) => {
    if (filter === "development") return session.split_key === "development";
    if (filter === "unseen") return session.split_key !== "development";
    if (filter === "scored") {
      return Object.values(session.results?.challenger || {}).some((result) => result === "hit" || result === "miss");
    }
    return true;
  });
}

function renderUsdL1SessionList(payload = {}) {
  const filtered = usdL1SessionsForFilter(payload);
  const shown = filtered.slice(-USD_L1_SESSION_LIMIT).reverse();
  // The newest session is often the one whose tape has not been cached yet, so the first view opens on the
  // newest session that actually has a scored result rather than on an empty one.
  const firstScored = shown.find((session) =>
    Object.values(session.results?.challenger || {}).some((result) => result === "hit" || result === "miss"));
  const selected = usdLayer1State.selectedDate || (firstScored || shown[0] || {}).date || null;
  return `
    <section class="usd-l1-session-block" data-usd-l1-sessions="true">
      <div class="usd-l1-session-head">
        <div>
          <p class="eyebrow">Daily drill-down</p>
          <h3>Click a date: what we knew, what each model called, what happened next</h3>
        </div>
        <div class="usd-l1-session-filters" role="group" aria-label="Filter sessions">
          ${[["all", "All"], ["development", "Development"], ["unseen", "Unseen dates"], ["scored", "Scored only"]]
            .map(([key, label]) => `
              <button type="button" class="usd-l1-filter${usdLayer1State.sessionFilter === key ? " active" : ""}" data-usd-l1-session-filter="${key}">${label}</button>
            `).join("")}
        </div>
      </div>
      <p class="usd-l1-test-copy muted">${filtered.length} sessions match this filter; the most recent ${shown.length} are listed — the artefact keeps every one.</p>
      <div class="usd-l1-session-list" role="list">
        ${shown.map((session) => {
          const current = session.models?.current || {};
          const challenger = session.models?.challenger || {};
          const currentTone = usdL1DashboardDirection(current.direction).tone;
          const challengerTone = usdL1DashboardDirection(challenger.direction).tone;
          return `
            <button type="button" role="listitem" class="usd-l1-session-row${session.date === selected ? " active" : ""}" data-usd-l1-session="${escapeHtml(session.date)}">
              <span class="usd-l1-session-date">${escapeHtml(session.date)}<span class="usd-l1-session-split">${escapeHtml(session.split || "")}</span></span>
              <span class="usd-l1-session-call ${currentTone}">current ${escapeHtml(current.conviction ? `${current.direction} ${current.conviction}` : current.direction || "—")}</span>
              <span class="usd-l1-session-call ${challengerTone}">challenger ${escapeHtml(challenger.conviction ? `${challenger.direction} ${challenger.conviction}` : challenger.direction || "—")}</span>
              <span class="usd-l1-session-results">
                ${["EURUSD", "XAUUSD", "BTCUSD", "NAS100"].map((key) => `
                  <span class="usd-l1-dot ${escapeHtml(session.results?.challenger?.[key] || "none")}" title="${escapeHtml(key)}: ${escapeHtml(session.results?.challenger?.[key] || "unscored")}"></span>
                `).join("")}
              </span>
            </button>
          `;
        }).join("")}
      </div>
      <div class="usd-l1-drilldown" data-usd-l1-drilldown="true">
        ${renderUsdL1Drilldown(payload, selected)}
      </div>
    </section>
  `;
}

function usdL1InputRows(session = {}) {
  const inputs = session.inputs || {};
  const rows = [
    ["VIX level", inputs.vix_level, ""],
    ["VIX 5-day change", inputs.vix_d5_chg, "points"],
    ["US 2-year 5-day change", inputs.us_2y_d5_bps, "bp"],
    ["US 10-year real 5-day change", inputs.us_10y_real_d5_bps, "bp"],
    ["Broad dollar 5-day change (DXY stand-in)", inputs.broad_dollar_d5_pct, "%"],
    ["Gold 5-day change", inputs.gold_d5_pct, "%"],
    ["NAS100 5-day change", inputs.nasdaq100_d5_pct, "%"],
    ["EUR/USD 5-day change", inputs.eurusd_d5_pct, "%"],
    ["USD/JPY 5-day change", inputs.usdjpy_d5_pct, "%"],
    ["Gold price at 05:00", inputs.gold_price, ""],
    ["NAS100 price at 05:00", inputs.nasdaq100_price, ""],
    ["EUR/USD at 05:00", inputs.eurusd, ""]
  ];
  return rows.map(([label, value, suffix]) => `
    <tr>
      <th scope="row">${escapeHtml(label)}</th>
      <td>${Number.isFinite(value) ? escapeHtml(`${value}${suffix ? ` ${suffix}` : ""}`) : `<span class="usd-l1-missing">missing</span>`}</td>
    </tr>
  `).join("");
}

function renderUsdL1Drilldown(payload = {}, date) {
  const session = asArray(payload.sessions).find((entry) => entry.date === date);
  if (!session) {
    return `<div class="usd-l1-empty">Select a date to see what was known, what each model called and what happened next.</div>`;
  }
  const current = session.models?.current || {};
  const challenger = session.models?.challenger || {};
  const modelCard = (key, label, call) => `
    <article class="usd-l1-drill-card" data-usd-l1-drill-model="${key}">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <p class="usd-l1-drill-direction ${usdL1DashboardDirection(call.direction).tone}">${usdL1Text(call.direction_label || call.direction)}</p>
      ${usdL1ConvictionPips(call.conviction)}
      <p class="usd-l1-drill-score">${key === "current"
        ? `raw conviction ${usdL1Text(call.conviction_raw)} / 100 · net weight ${usdL1Signed(call.net_weight, 2)} · ${usdL1Number(call.factors_live, 0)} factors live`
        : `raw score ${usdL1Signed(call.raw_score, 0)} · ${usdL1Number(call.usable_mechanisms, 0)} mechanisms · agreement ${usdL1Percent(Number.isFinite(call.agreement) ? call.agreement * 100 : null, 0)}`}</p>
      <p class="usd-l1-drill-reason">${usdL1Text(call.reason)}</p>
      ${asArray(call.missing_inputs).length
        ? `<p class="usd-l1-drill-missing">Missing: ${asArray(call.missing_inputs).map((item) => `<span>${escapeHtml(item)}</span>`).join(" ")}</p>`
        : ""}
    </article>
  `;
  const markets = asArray(payload.run?.markets);
  const outcomeRow = (market) => {
    const outcome = (session.outcomes || {})[market.key] || {};
    const actual = outcome.direction
      ? `${outcome.direction}${Number.isFinite(outcome.move_pct) ? ` (${usdL1Signed(outcome.move_pct, 2, "%")})` : ""}`
      : (outcome.present ? "no direction" : "no 05:00 bar");
    return `
      <tr data-usd-l1-outcome="${escapeHtml(market.key)}">
        <th scope="row">${escapeHtml(market.label)}</th>
        <td>${usdL1ResultChip(session.results?.current?.[market.key])}</td>
        <td>${usdL1ResultChip(session.results?.challenger?.[market.key])}</td>
        <td title="${escapeHtml(outcome.reason || "")}">${usdL1Text(actual)}</td>
        <td>${Number.isFinite(outcome.flat_band_pct) ? usdL1Percent(outcome.flat_band_pct) : "—"}</td>
      </tr>
    `;
  };
  return `
    <div class="usd-l1-drill-head">
      <div>
        <p class="eyebrow">Selected date</p>
        <h3>${escapeHtml(session.date)} · ${escapeHtml(session.split)}</h3>
      </div>
      <p class="usd-l1-test-copy muted">Cutoff ${escapeHtml(session.cutoff_at_utc)} (${escapeHtml(session.cutoff_offset_abbrev)}) → endpoint ${escapeHtml(session.endpoint_at_utc)} · ${usdL1Number(session.window_hours, 0)}h</p>
    </div>
    <div class="usd-l1-drill-grid">
      <section class="usd-l1-drill-section">
        <h4>What did we know at 05:00?</h4>
        <table class="usd-l1-table usd-l1-input-table">
          <caption>Inputs as they stood at the cutoff</caption>
          <tbody>${usdL1InputRows(session)}</tbody>
        </table>
        ${asArray(session.inputs_missing).length
          ? `<p class="usd-l1-drill-missing">Not available at this cutoff: ${asArray(session.inputs_missing).map((item) => `<span>${escapeHtml(item)}</span>`).join(" ")}</p>`
          : ""}
      </section>
      <section class="usd-l1-drill-section">
        <h4>What did each model call?</h4>
        ${modelCard("current", "Current model", current)}
        ${modelCard("challenger", "Challenger", challenger)}
      </section>
      <section class="usd-l1-drill-section">
        <h4>What happened next?</h4>
        <table class="usd-l1-table usd-l1-outcome-table">
          <caption>A USD-bullish call predicts down for all four markets</caption>
          <thead>
            <tr><th scope="col">Market</th><th scope="col">Current</th><th scope="col">Challenger</th><th scope="col">Session move</th><th scope="col">Flat band</th></tr>
          </thead>
          <tbody>${markets.map(outcomeRow).join("")}</tbody>
        </table>
        <p class="usd-l1-test-copy muted">Test ① is unscored on every date until licensed cash DXY prices exist; this view uses each market's own one-hour tape instead.</p>
      </section>
    </div>
  `;
}

function usdL1ReplayCaptionStep(step, index, total, accountTrades) {
  const trade = step.trade;
  if (!trade) return `Step ${index + 1} of ${total}: ${step.label}`;
  const settled = accountTrades.find((entry) => entry.id === trade.id);
  const parts = [`Step ${index + 1} of ${total}: ${step.label}`];
  if (step.time) parts.push(`${new Date(step.time).toISOString().slice(11, 16)}Z`);
  parts.push(`level ${trade.level} · target ${trade.target} · stop ${trade.stop}`);
  if (settled && Number.isFinite(settled.rGross)) {
    parts.push(`${settled.rGross > 0 ? "+" : ""}${settled.rGross}R`);
    if (Number.isFinite(settled.pnl)) parts.push(`£${settled.pnl > 0 ? "+" : ""}${settled.pnl.toFixed(2)}`);
  }
  return parts.join(" · ");
}

function mountUsdL1Replay() {
  if (usdL1ReplayController && typeof usdL1ReplayController.destroy === "function") {
    usdL1ReplayController.destroy();
  }
  usdL1ReplayController = null;
  const host = document.querySelector("[data-usd-l1-replay='true']");
  if (!host || !usdLayer1Data || !window.UsdL1Replay) return;
  const demo = usdLayer1Data.execution_demo || {};
  const sessionDate = host.getAttribute("data-usd-l1-replay-session");
  const session = asArray(demo.sessions).find((entry) => entry.date === sessionDate);
  if (!session) return;
  const variantKey = usdLayer1State.tab === "l2l_half_3r" ? "half" : "full";
  const variant = (demo.variants || {})[variantKey] || {};
  const trades = asArray(demo.trades).filter(
    (trade) => trade.geometry === variantKey && (!sessionDate || trade.sessionDate === sessionDate)
  );
  const accountTrades = asArray(demo.accounts)
    .filter((account) => account.geometry === variantKey)
    .flatMap((account) => asArray(account.trades));
  const caption = document.querySelector("[data-usd-l1-replay-caption='true']");
  usdL1ReplayController = window.UsdL1Replay.create(host, {
    candles: asArray(session.candles),
    levels: asArray(variant.grid),
    trades,
    onStep: (index, step) => {
      const total = usdL1ReplayController && usdL1ReplayController.steps
        ? usdL1ReplayController.steps.length
        : 1;
      host.setAttribute("data-usd-l1-replay-step", String(index));
      if (!caption) return;
      caption.setAttribute("data-usd-l1-replay-step", String(index));
      caption.textContent = usdL1ReplayCaptionStep(step, index, total, accountTrades);
    }
  });
  if (caption && usdL1ReplayController) {
    caption.setAttribute("data-usd-l1-replay-mode", usdL1ReplayController.mode);
  }
}

/**
 * Evidence behind every percentage.
 *
 * A percentage on this panel is a button. Clicking it opens the list of dates (or trades) that produced the
 * numerator and denominator, computed here from the same session rows the tables were built from, so the
 * reader can recount them. The arithmetic is printed as `hits / scored = pct` rather than as a bare figure.
 */
function usdL1EvidenceButton(spec, label, title = "") {
  const shown = label === null || label === undefined || label === "" ? "—" : String(label);
  return `<button type="button" class="usd-l1-pct" data-usd-l1-evidence="${escapeHtml(spec)}" title="${escapeHtml(
    title || `Show the dates behind ${shown}`
  )}">${escapeHtml(shown)}</button>`;
}

function usdL1PercentButton(spec, value, decimals = 2, title = "") {
  if (!Number.isFinite(value)) return usdL1EvidenceButton(spec, "—", title);
  return usdL1EvidenceButton(spec, usdL1Percent(value, decimals), title);
}

/** The session-level sentence shown beside a date in the evidence list. */
function usdL1EvidenceDetail(session, marketKey, model) {
  const call = (session.models || {})[model] || {};
  const outcome = (session.outcomes || {})[marketKey] || {};
  const result = ((session.results || {})[model] || {})[marketKey] || "unscored";
  const callText = call.direction === "NO_CALL"
    ? "no call"
    : `${call.direction}${Number.isFinite(call.conviction) ? ` c${call.conviction}` : ""}`;
  const moveText = outcome.direction
    ? `${outcome.direction}${Number.isFinite(outcome.move_pct) ? ` ${usdL1Signed(outcome.move_pct, 2, "%")}` : ""}`
    : "no outcome";
  return `${model} ${callText} · ${marketKey} ${moveText} · ${result}`;
}

/** Every session that produced a given result for one model and market. */
function usdL1SessionsByResult(payload, marketKey, model, wanted) {
  return asArray(payload.sessions)
    .filter((session) => {
      const result = ((session.results || {})[model] || {})[marketKey];
      if (wanted === "scored") return result === "hit" || result === "miss";
      return result === wanted;
    })
    .map((session) => ({ date: session.date, detail: usdL1EvidenceDetail(session, marketKey, model) }));
}

/** The same-date comparison: challenger right where the current model was wrong, and the reverse. */
function usdL1ComparisonSessions(payload, marketKey, kind) {
  const sessions = asArray(payload.sessions);
  const pick = (session, model) => ((session.results || {})[model] || {})[marketKey];
  return sessions
    .filter((session) => {
      const current = pick(session, "current");
      const challenger = pick(session, "challenger");
      const currentScored = current === "hit" || current === "miss";
      const challengerScored = challenger === "hit" || challenger === "miss";
      if (!currentScored || !challengerScored) return false;
      if (kind === "corrected") return challenger === "hit" && current === "miss";
      if (kind === "spoiled") return challenger === "miss" && current === "hit";
      return current === challenger;
    })
    .map((session) => ({
      date: session.date,
      detail: `${usdL1EvidenceDetail(session, marketKey, "current")} vs ${pick(session, "challenger")} for the challenger`
    }));
}

/** Sessions where one model called at a given conviction, with the result beside it. */
function usdL1ConvictionSessions(payload, marketKey, model, level) {
  return asArray(payload.sessions)
    .filter((session) => {
      const call = (session.models || {})[model] || {};
      if (call.direction === "NO_CALL") return false;
      return call.conviction === Number(level);
    })
    .map((session) => ({ date: session.date, detail: usdL1EvidenceDetail(session, marketKey, model) }));
}

/** Every date one model made a call at all, which is what test 1 is waiting to score. */
function usdL1CallSessions(payload, model) {
  return asArray(payload.sessions)
    .filter((session) => {
      const call = (session.models || {})[model] || {};
      return call.direction && call.direction !== "NO_CALL";
    })
    .map((session) => ({
      date: session.date,
      detail: `${session.models[model].direction}${
        Number.isFinite(session.models[model].conviction) ? ` c${session.models[model].conviction}` : ""
      } · ${session.models[model].reason || ""}`
    }));
}

/** The no-call days, split by the gate that stopped them, for the 697-against-490 explanation. */
function usdL1NoCallSessions(payload, model, gate) {
  const rules = payload.run?.challenger_rules || {};
  const minimum = Number.isFinite(rules.min_usable_mechanisms) ? rules.min_usable_mechanisms : 6;
  return asArray(payload.sessions)
    .filter((session) => {
      const call = (session.models || {})[model] || {};
      if (call.direction && call.direction !== "NO_CALL") return false;
      if (model === "current") return gate === "any";
      const usable = Number.isFinite(call.usable_mechanisms) ? call.usable_mechanisms : 0;
      if (gate === "min_usable") return usable < minimum;
      if (gate === "deadband") return usable >= minimum;
      return true;
    })
    .map((session) => ({ date: session.date, detail: `${model} no call · ${((session.models || {})[model] || {}).reason || ""}` }));
}
/**
 * Resolve one evidence spec into the dates or trades behind a figure, with its arithmetic.
 *
 * Specs are written by the render code beside the number they belong to, so a percentage cannot appear on
 * the panel without a way to recount it.
 */
function usdL1Resolution(payload, spec) {
  const parts = String(spec || "").split("|");
  const kind = parts[0] || "";
  const sessions = asArray(payload.sessions);
  const labels = {};
  asArray(payload.run?.markets).forEach((market) => {
    labels[market.key] = market.label;
  });

  if (kind === "result") {
    const market = parts[1];
    const model = parts[2];
    const wanted = parts[3] || "scored";
    const rows = usdL1SessionsByResult(payload, market, model, wanted);
    const scored = usdL1SessionsByResult(payload, market, model, "scored");
    const hits = usdL1SessionsByResult(payload, market, model, "hit");
    return {
      title: `${labels[market] || market} · ${model} · ${wanted.replace("_", " ")}`,
      arithmetic: `${hits.length} correct / ${scored.length} scored = ${usdL1Percent(
        scored.length ? (hits.length / scored.length) * 100 : null
      )} — every date below is one row of the four-market table`,
      rows,
      empty: `${model} has no ${wanted.replace("_", " ")} sessions for ${market}`
    };
  }

  if (kind === "comparison") {
    const market = parts[1];
    const which = parts[2] || "corrected";
    const rows = usdL1ComparisonSessions(payload, market, which);
    const corrected = usdL1ComparisonSessions(payload, market, "corrected").length;
    const spoiled = usdL1ComparisonSessions(payload, market, "spoiled").length;
    const matched = usdL1ComparisonSessions(payload, market, "matched").length;
    return {
      title: `${labels[market] || market} · same-date comparison · ${which}`,
      arithmetic:
        `corrected ${corrected} · spoiled ${spoiled} · matched ${matched} · net ${usdL1Signed(
          corrected - spoiled,
          0
        )} on ${corrected + spoiled + matched} sessions where both models were scoreable`,
      rows,
      empty: `no ${which} session for ${market}`
    };
  }

  if (kind === "conviction") {
    const market = parts[1];
    const model = parts[2];
    const level = parts[3];
    const rows = usdL1ConvictionSessions(payload, market, model, level);
    const scored = rows.filter((row) => /· hit$/.test(row.detail) || /· miss$/.test(row.detail));
    const hits = rows.filter((row) => /· hit$/.test(row.detail));
    return {
      title: `${labels[market] || market} · ${model} · conviction ${level}`,
      arithmetic: `${rows.length} sessions called at conviction ${level} · ${hits.length} correct / ${
        scored.length
      } scored = ${usdL1Percent(scored.length ? (hits.length / scored.length) * 100 : null)}`,
      rows,
      empty: `no conviction-${level} calls for ${model} on ${market}`
    };
  }

  if (kind === "calls") {
    const model = parts[1];
    const rows = usdL1CallSessions(payload, model);
    return {
      title: `${model} · every date with a call`,
      arithmetic: `${rows.length} calls made of ${sessions.length} dates processed · ${usdL1Percent(
        sessions.length ? (rows.length / sessions.length) * 100 : null
      )} coverage`,
      rows,
      empty: "no calls"
    };
  }


  if (kind === "nocall") {
    const model = parts[1];
    const gate = parts[2] || "any";
    const rows = usdL1NoCallSessions(payload, model, gate);
    const rules = payload.run?.challenger_rules || {};
    const arithmetic = model === "current"
      ? `${rows.length} no-call dates of ${sessions.length} — the current model returned NO_CLEAR_BIAS`
      : gate === "min_usable"
        ? `${rows.length} dates had fewer than ${rules.min_usable_mechanisms ?? 6} mechanisms with a value, so the minimum-data gate stopped the call`
        : `${rows.length} dates had enough data but the mechanisms split inside the ${rules.agreement_deadband_pct ?? 20}% deadband, so the day was recorded as no call`;
    return {
      title: `${model} · no-call dates · ${gate}`,
      arithmetic,
      rows,
      empty: "no no-call dates in this bucket"
    };
  }

  if (kind === "trades") {
    const variantKey = parts[1] || "full";
    const accountId = parts[2];
    const accounts = asArray(payload.execution_demo?.accounts);
    const account = accounts.find((entry) => entry.id === accountId) || accounts[0] || {};
    const trades = asArray(account.trades);
    const rows = trades.map((trade) => ({
      date: trade.sessionDate || trade.id,
      detail: `${trade.id} · ${trade.side} ${trade.market} from ${trade.level} · stop ${trade.stop} · target ${trade.target} · exit ${trade.exitPrice} (${trade.exitReason}) · ${usdL1Signed(trade.rGross, 2, "R")} · £${usdL1Signed(trade.pnl, 2)}`
    }));
    const closed = (account.wins || 0) + (account.losses || 0);
    return {
      title: `${account.label || accountId || variantKey} · trade ledger`,
      arithmetic:
        `${usdL1Number(account.wins, 0)} winning / ${usdL1Number(closed, 0)} closed = win rate ${usdL1Percent(
          closed ? ((account.wins || 0) / closed) * 100 : null
        )} · net ${usdL1Signed(account.total_r, 2, "R")} · ending balance £${usdL1Number(account.ending_balance, 2)} ` +
        `from £${usdL1Number(account.starting_balance, 2)} at ${usdL1Number(account.risk_per_trade_pct, 0)}% risk per fill · ` +
        `max drawdown £${usdL1Number(account.max_drawdown, 2)}`,
      rows,
      empty: "this account has no trades"
    };
  }

  return { title: "Nothing to show", arithmetic: "unknown evidence spec", rows: [], empty: "unknown evidence spec" };
}

/** The drawer that lists the dates or trades behind the number that was clicked. */
function renderUsdL1Evidence(payload, spec) {
  if (!spec) return "";
  const resolution = usdL1Resolution(payload, spec);
  return `
    <section class="usd-l1-evidence" data-usd-l1-evidence-panel="${escapeHtml(spec)}">
      <div class="usd-l1-evidence-head">
        <div>
          <p class="eyebrow">Behind this number</p>
          <h4>${escapeHtml(resolution.title)}</h4>
        </div>
        <button type="button" class="usd-l1-evidence-close" data-usd-l1-evidence-close="true" aria-label="Close">Close</button>
      </div>
      <p class="usd-l1-evidence-arithmetic"><code>${escapeHtml(resolution.arithmetic)}</code></p>
      ${resolution.rows.length
        ? `<ol class="usd-l1-evidence-list" data-usd-l1-evidence-count="${resolution.rows.length}">
            ${resolution.rows
              .map((row) => `<li><b>${escapeHtml(row.date)}</b><span>${escapeHtml(row.detail)}</span></li>`)
              .join("")}
          </ol>`
        : `<p class="usd-l1-test-copy muted">${escapeHtml(resolution.empty)}</p>`}
    </section>
  `;
}

/**
 * The results at the top of the panel.
 *
 * "dates processed" is stated on its own, and each test carries its own scored count beside it, so a
 * processed date is never mistaken for a scored call.
 */
function renderUsdL1Results(payload = {}) {
  const results = payload.results || {};
  const tests = asArray(results.tests);
  const calls = results.calls || {};
  const four = tests.find((test) => test.id === "four_markets") || {};
  const row = (test) => {
    const summary = test.id === "four_markets"
      ? `current ${usdL1Number(test.scored?.current, 0)} · challenger ${usdL1Number(
          test.scored?.challenger,
          0
        )} scored sessions`
      : test.id === "dxy_direction"
        ? `current ${usdL1Number(test.calls_ready?.current, 0)} · challenger ${usdL1Number(
            test.calls_ready?.challenger,
            0
          )} calls waiting`
        : `current ${usdL1Number(test.scored?.current, 0)} · challenger ${usdL1Number(
            test.scored?.challenger,
            0
          )} closed trades`;
    return `
      <tr data-usd-l1-results-test="${escapeHtml(test.id)}" class="usd-l1-results-${escapeHtml(test.status || "")}">
        <th scope="row">${test.ordinal ? `${test.ordinal}. ` : ""}${escapeHtml(test.label || test.id)}</th>
        <td><span class="usd-l1-status ${escapeHtml(test.status || "")}">${escapeHtml(
          test.status_label || test.status || ""
        )}</span></td>
        <td>${escapeHtml(summary)}</td>
        <td>${test.missing_input ? escapeHtml(test.missing_input) : "—"}</td>
      </tr>
    `;
  };
  const demoLedgerLink = (test) => {
    const variantKey = test.id === "l2l_half_3r" ? "half" : "full";
    const account = asArray(payload.execution_demo?.accounts).find((entry) => entry.geometry === variantKey);
    if (!account) return "—";
    const label = `${usdL1Number(account.wins, 0)} winning / ${usdL1Number(
      (account.wins || 0) + (account.losses || 0),
      0
    )} closed · £${usdL1Number(account.ending_balance, 2)}`;
    return usdL1EvidenceButton(
      `trades|${variantKey}|${account.id}`,
      label,
      "Show the demo trade ledger and its arithmetic"
    );
  };
  return `
    <section class="usd-l1-results" data-usd-l1-results="true">
      <div class="usd-l1-results-head">
        <div>
          <p class="eyebrow">Results</p>
          <h3><span data-usd-l1-dates-processed="${results.dates_processed || 0}">${escapeHtml(
            results.headline_dates || `${usdL1Number(results.dates_processed, 0)} dates processed`
          )}</span></h3>
          <p class="usd-l1-test-copy muted">A processed date is a 05:00 London session both models were asked about.
            A scored call is a date where the model called and the outcome was outside the frozen flat band. They are
            counted separately below, per test, and every number opens the dates behind it.</p>
        </div>
        <ul class="usd-l1-results-calls">
          <li>${usdL1EvidenceButton(
            "calls|current",
            `${usdL1Number(calls.current, 0)} calls`,
            "Current model: every date with a call"
          )}<span>current model</span></li>
          <li>${usdL1EvidenceButton(
            "calls|challenger",
            `${usdL1Number(calls.challenger, 0)} calls`,
            "Challenger: every date with a call"
          )}<span>challenger</span></li>
        </ul>
      </div>
      <table class="usd-l1-table usd-l1-results-table">
        <caption>Four tests, four separate scored counts</caption>
        <thead>
          <tr>
            <th scope="col">Test</th>
            <th scope="col">Status</th>
            <th scope="col">Scored</th>
            <th scope="col">What is missing</th>
          </tr>
        </thead>
        <tbody>
          ${tests.map(row).join("")}
        </tbody>
      </table>
      <table class="usd-l1-table usd-l1-results-detail">
        <caption>Test 2 by market, with the same-date comparison</caption>
        <thead>
          <tr>
            <th scope="col">Market</th>
            <th scope="col">Current correct / scored</th>
            <th scope="col">Challenger correct / scored</th>
            <th scope="col">Corrected / spoiled</th>
            <th scope="col">DXY was correct</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(four.markets || {})
            .map(
              ([key, entry]) => `
              <tr data-usd-l1-results-market="${escapeHtml(key)}">
                <th scope="row">${escapeHtml(entry.label || key)}</th>
                <td>${usdL1EvidenceButton(
                  `result|${key}|current|hit`,
                  `${usdL1Number(entry.current?.hits, 0)}`
                )} / ${usdL1EvidenceButton(`result|${key}|current|scored`, `${usdL1Number(entry.current?.scored, 0)}`)}
                  · ${usdL1PercentButton(`result|${key}|current|scored`, entry.current?.accuracy_pct)}</td>
                <td>${usdL1EvidenceButton(
                  `result|${key}|challenger|hit`,
                  `${usdL1Number(entry.challenger?.hits, 0)}`
                )} / ${usdL1EvidenceButton(
                  `result|${key}|challenger|scored`,
                  `${usdL1Number(entry.challenger?.scored, 0)}`
                )} · ${usdL1PercentButton(`result|${key}|challenger|scored`, entry.challenger?.accuracy_pct)}</td>
                <td>${usdL1EvidenceButton(
                  `comparison|${key}|corrected`,
                  `+${usdL1Number(entry.comparison?.corrected, 0)}`
                )} / ${usdL1EvidenceButton(
                  `comparison|${key}|spoiled`,
                  `−${usdL1Number(entry.comparison?.spoiled, 0)}`
                )}</td>
                <td><span class="usd-l1-chip none">pending DXY</span></td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
      <p class="usd-l1-test-copy muted" data-usd-l1-demo-ledger="true">Tests 3 and 4 have no scored trade yet. The
        two-day demo ledger is labelled separately:
        ${asArray(results.tests)
          .filter((test) => test.id === "l2l_full_5r" || test.id === "l2l_half_3r")
          .map(
            (test) =>
              ` <span class="usd-l1-demo-line">${escapeHtml(test.label)}: ${demoLedgerLink(test)} · net ${usdL1Signed(
                test.demo?.r_gross,
                2,
                "R"
              )} gross over ${usdL1Number(test.demo?.closed, 0)} closed of ${usdL1Number(test.demo?.fills, 0)} fills</span>`
          )
          .join("")}</p>
    </section>
  `;
}

/**
 * "How this call was made": every factor accounted for, the rule that implements it, and where each frozen
 * parameter came from.
 *
 * The three tables answer the three questions a reader has to be able to ask of a research model: what does it
 * read, what does it do with what it reads, and who decided that.
 */
function renderUsdL1CallMethod(payload = {}) {
  const run = payload.run || {};
  const rules = run.challenger_rules || {};
  const mechanisms = asArray(run.challenger_mechanisms);
  const accounting = payload.factor_accounting || {};
  const ledger = payload.assumption_ledger || {};
  const status = payload.challenger_status || {};
  const currentRules = run.current_model_rules || {};
  const counts = accounting.counts || {};
  const treatmentTone = (treatment) =>
    treatment === "used" ? "hit" : treatment === "combined" ? "flat" : treatment === "abstain" ? "none" : "miss";
  const classTone = (klass) => (klass === "research" ? "hit" : klass === "fitted" ? "miss" : "flat");

  return `
    <section class="usd-l1-method" data-usd-l1-call-method="true">
      <div class="usd-l1-method-head">
        <div>
          <p class="eyebrow">How this call was made</p>
          <h3>${escapeHtml(run.challenger_version || "challenger")}: ${usdL1Number(mechanisms.length, 0)} mechanisms,
            ${usdL1Number(accounting.factor_count, 0)} registered factors, one rule table</h3>
          <p class="usd-l1-test-copy muted">${escapeHtml(status.label || "")}</p>
        </div>
        <div class="usd-l1-method-badges">
          <span class="usd-l1-chip ${status.preliminary ? "flat" : "hit"}">${status.preliminary ? "preliminary" : "final"}</span>
          <span class="usd-l1-chip none">frozen ${escapeHtml(run.challenger_frozen_on || "")}</span>
          <span class="usd-l1-chip none">${escapeHtml(rules.interpreter || "")}</span>
        </div>
      </div>

      <div class="usd-l1-method-grid">
        <article class="usd-l1-method-card">
          <h4>Why it is labelled preliminary</h4>
          <ul class="usd-l1-method-list">
            ${asArray(status.why_preliminary).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
        <article class="usd-l1-method-card">
          <h4>What would complete the challenger</h4>
          <ul class="usd-l1-method-list">
            ${asArray(status.completing_work).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
          <p class="usd-l1-test-copy muted">${escapeHtml(status.guardrail || "")}</p>
        </article>
      </div>

      <h4 class="usd-l1-method-title">The ${usdL1Number(mechanisms.length, 0)} mechanisms, as implemented</h4>
      <table class="usd-l1-table usd-l1-method-table">
        <caption>Each row is one input, one cut-off and one declared USD direction; every weight is ${usdL1Number(
          rules.equal_weight,
          0
        )}</caption>
        <thead>
          <tr>
            <th scope="col">Mechanism</th>
            <th scope="col">Factor it implements</th>
            <th scope="col">Input at 05:00</th>
            <th scope="col">Cut-off</th>
            <th scope="col">Vote rule</th>
            <th scope="col">Weight</th>
          </tr>
        </thead>
        <tbody>
          ${mechanisms
            .map(
              (mechanism) => `
              <tr data-usd-l1-mechanism="${escapeHtml(mechanism.id)}">
                <th scope="row">${escapeHtml(mechanism.label)}<span class="usd-l1-sample">${escapeHtml(
                  mechanism.id
                )}</span></th>
                <td><code>${escapeHtml(mechanism.factor)}</code></td>
                <td><code>${escapeHtml(mechanism.input)}</code></td>
                <td>${escapeHtml(mechanism.threshold)}</td>
                <td>${escapeHtml(mechanism.rule)}${asArray(mechanism.vote_spec).length
                  ? `<span class="usd-l1-vote-spec">${mechanism.vote_spec
                      .map((branch) => `${branch.when} ${branch.value} → ${branch.usd > 0 ? "+1" : "−1"}`)
                      .join(" · ")} · otherwise 0</span>`
                  : ""}</td>
                <td>${usdL1Number(mechanism.weight, 0)}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      <h4 class="usd-l1-method-title">The rule that turns votes into a call</h4>
      <div class="usd-l1-method-grid">
        <article class="usd-l1-method-card">
          <h5>Abstention gates</h5>
          <ul class="usd-l1-method-list">
            ${asArray(rules.gates)
              .map((gate) => `<li><b>${escapeHtml(gate.rule)}</b><span>${escapeHtml(gate.why)}</span></li>`)
              .join("")}
          </ul>
        </article>
        <article class="usd-l1-method-card">
          <h5>Missing-data rules</h5>
          <ul class="usd-l1-method-list">
            ${asArray(rules.missing_data_rules).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </div>
      <table class="usd-l1-table usd-l1-band-table">
        <caption>Five conviction bands: agreement is how one-sided the live mechanisms were, participation is how
          many of them had a value</caption>
        <thead>
          <tr><th scope="col">Conviction</th><th scope="col">Needs agreement</th><th scope="col">Needs participation</th><th scope="col">Meaning</th></tr>
        </thead>
        <tbody>
          ${asArray(rules.conviction_bands)
            .map(
              (band) => `
              <tr data-usd-l1-band="${band.conviction}">
                <th scope="row">${usdL1ConvictionPips(band.conviction)}</th>
                <td>≥ ${usdL1Number(band.min_agreement * 100, 0)}%</td>
                <td>≥ ${usdL1Number(band.min_participation * 100, 0)}%</td>
                <td>${escapeHtml((run.conviction && run.conviction.band_meanings?.[band.conviction]) || "")}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      <h4 class="usd-l1-method-title">All ${usdL1Number(accounting.factor_count, 0)} registered factors, and what this
        model does with each</h4>
      <p class="usd-l1-test-copy muted">${escapeHtml(accounting.note || "")} Joined to
        <code>${escapeHtml(accounting.source?.path || "the registered catalogue")}</code> by factor id, so the research
        decision and the implemented rule sit in the same row. ${usdL1Number(counts.used, 0)} used ·
        ${usdL1Number(counts.combined, 0)} combined · ${usdL1Number(counts.abstain, 0)} abstain ·
        ${usdL1Number(counts.excluded, 0)} excluded.</p>
      <table class="usd-l1-table usd-l1-factor-table">
        <caption>Every factor, its treatment, the rule that implements it and why</caption>
        <thead>
          <tr>
            <th scope="col">Factor</th>
            <th scope="col">Treatment</th>
            <th scope="col">Implemented by</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          ${asArray(accounting.rows)
            .map(
              (row) => `
              <tr data-usd-l1-factor="${escapeHtml(row.factor_id)}" class="usd-l1-factor-${escapeHtml(row.treatment)}">
                <th scope="row">${escapeHtml(row.factor_label)}<span class="usd-l1-sample">${escapeHtml(row.factor_id)}</span></th>
                <td><span class="usd-l1-chip ${treatmentTone(row.treatment)}">${escapeHtml(row.treatment_label)}</span></td>
                <td>${row.mechanisms?.length
                  ? `<code>${row.mechanisms.map((id) => escapeHtml(id)).join("</code> <code>")}</code>${
                      row.weight_total ? ` · weight ${usdL1Number(row.weight_total, 0)}` : ""
                    }<span class="usd-l1-factor-rule">${escapeHtml(row.implemented_rule || "")}</span>`
                  : `<span class="usd-l1-missing">no rule reads it</span>`}</td>
                <td>${escapeHtml(row.reason)}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      <h4 class="usd-l1-method-title">Where every frozen parameter came from</h4>
      <p class="usd-l1-test-copy muted">${usdL1Number(ledger.counts?.research, 0)} from research ·
        ${usdL1Number(ledger.counts?.assumption, 0)} developer assumptions · ${usdL1Number(ledger.counts?.fitted, 0)} fitted
        on data. A fitted parameter is only ever measured on development dates, and the dates are named.</p>
      <table class="usd-l1-table usd-l1-ledger-table">
        <caption>Parameter, class, source and the date it was fixed</caption>
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col">Value</th>
            <th scope="col">Class</th>
            <th scope="col">Source and dates</th>
          </tr>
        </thead>
        <tbody>
          ${asArray(ledger.rows)
            .map(
              (row) => `
              <tr data-usd-l1-ledger="${escapeHtml(row.parameter)}" class="usd-l1-ledger-${escapeHtml(row.class)}">
                <th scope="row">${escapeHtml(row.parameter)}</th>
                <td>${escapeHtml(row.value)}</td>
                <td><span class="usd-l1-chip ${classTone(row.class)}">${escapeHtml(
                  ledger.classes?.[row.class] || row.class
                )}</span></td>
                <td>${escapeHtml(row.source)}<span class="usd-l1-ledger-dates">${escapeHtml(row.dates)}${
                  row.note ? ` · ${escapeHtml(row.note)}` : ""
                }</span></td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>

      <h4 class="usd-l1-method-title">What the current model does, for comparison</h4>
      <article class="usd-l1-method-card usd-l1-current-rules" data-usd-l1-current-rules="true">
        <p class="usd-l1-test-copy">${escapeHtml(currentRules.version || "")} · ${escapeHtml(currentRules.scale || "")}</p>
        <ul class="usd-l1-method-list">
          ${asArray(currentRules.missing_data_rules).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          ${asArray(currentRules.substitutions)
            .map(
              (entry) =>
                `<li><b>${escapeHtml(entry.factor)}:</b> ${escapeHtml(entry.stands_in)} — ${escapeHtml(entry.why)}</li>`
            )
            .join("")}
        </ul>
        <p class="usd-l1-test-copy muted">Its 0-100 conviction is banded onto the shared 1-5 scale for comparison only:
          ${asArray(currentRules.conviction_mapping?.bands)
            .map((band) => `${band.conviction} at ${band.min}+`)
            .join(" · ")}. ${escapeHtml(currentRules.factor_source || "")}</p>
      </article>
    </section>
  `;
}

/** Dates where the two models disagreed, with the case where the challenger was right first. */
function usdL1WorkedCandidates(payload = {}) {
  const sessions = asArray(payload.sessions);
  const results = (session, model) => Object.values((session.results || {})[model] || {});
  const opposite = sessions.filter((session) => {
    const current = session.models?.current?.direction;
    const challenger = session.models?.challenger?.direction;
    return current && challenger && current !== "NO_CALL" && challenger !== "NO_CALL" && current !== challenger;
  });
  const best =
    opposite.find(
      (session) =>
        results(session, "challenger").includes("hit") && results(session, "current").includes("miss")
    ) || opposite[0] || null;
  const noCalls = sessions.filter((session) => (session.models?.challenger?.direction || "NO_CALL") === "NO_CALL");
  const minimum = payload.run?.challenger_rules?.min_usable_mechanisms ?? 6;
  return {
    opposite,
    best,
    noCallDeadband:
      noCalls.find((session) => (session.models?.challenger?.usable_mechanisms ?? 0) >= minimum) || null,
    noCallThin: noCalls.find((session) => (session.models?.challenger?.usable_mechanisms ?? 0) < minimum) || null,
    noCallCount: noCalls.length
  };
}

/**
 * Re-run the challenger's call from the values saved beside the session, with the interpreter the engine uses.
 *
 * This is the panel's half of the reproduction promise: the rules come from the artefact, the values come from
 * the row, and the only code involved is `lib/usd_l1_votes.js`.
 */
function usdL1Recompute(payload = {}, date) {
  const session = asArray(payload.sessions).find((entry) => entry.date === date);
  const rules = payload.run?.challenger_rules || {};
  const mechanisms = asArray(payload.run?.challenger_mechanisms);
  if (!session || !window.UsdL1Votes || !mechanisms.length) {
    return { ok: false, reason: "the rules or the saved inputs are unavailable, so nothing was re-run" };
  }
  let fresh;
  try {
    fresh = window.UsdL1Votes.evaluateFromSpecs({
      mechanisms,
      rules: { ...rules, conviction_bands: asArray(rules.conviction_bands) },
      values: session.saved_inputs || {}
    });
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) };
  }
  const stored = session.models?.challenger || {};
  const fields = [];
  if (fresh.direction !== stored.direction) fields.push("direction");
  if ((fresh.conviction ?? null) !== (stored.conviction ?? null)) fields.push("conviction");
  if (fresh.raw_score !== stored.raw_score) fields.push("raw score");
  return {
    ok: fields.length === 0,
    fields,
    date,
    inputs_used: asArray(fresh.inputs_used),
    fresh: {
      direction: fresh.direction,
      conviction: fresh.conviction,
      raw_score: fresh.raw_score,
      agreement: fresh.agreement,
      participation: fresh.participation,
      usable_mechanisms: fresh.usable_mechanisms,
      reason: fresh.reason
    },
    stored: {
      direction: stored.direction,
      conviction: stored.conviction,
      raw_score: stored.raw_score,
      agreement: stored.agreement,
      participation: stored.participation,
      usable_mechanisms: stored.usable_mechanisms,
      reason: stored.reason
    }
  };
}

/**
 * "Prove a historical call end to end": the values, their source and print date, each mechanism's contribution,
 * the arithmetic, and what the other model read that morning.
 *
 * The day is chosen from dates where the two models disagreed, and the panel re-runs the challenger's call from
 * the saved values on request, so the call is demonstrated rather than narrated.
 */
function renderUsdL1WorkedCall(payload = {}) {
  const candidates = usdL1WorkedCandidates(payload);
  const selected = usdLayer1State.workedDate || (candidates.best || {}).date || null;
  const session = asArray(payload.sessions).find((entry) => entry.date === selected);
  const legend = asArray(payload.input_source_legend);
  const definitions = new Map(asArray(payload.run?.challenger_mechanisms).map((entry) => [entry.id, entry]));
  const picker = `
    <div class="usd-l1-worked-picker" role="group" aria-label="Pick a disagreeing day">
      ${candidates.opposite
        .slice(0, 8)
        .map(
          (entry) => `
          <button type="button" class="usd-l1-filter${entry.date === selected ? " active" : ""}"
            data-usd-l1-worked-date="${escapeHtml(entry.date)}">${escapeHtml(entry.date)}
            <span>${escapeHtml(entry.models.current.direction)} vs ${escapeHtml(entry.models.challenger.direction)}</span>
          </button>
        `
        )
        .join("")}
    </div>
  `;

  if (!session) {
    return `
      <section class="usd-l1-worked" data-usd-l1-worked="true">
        <p class="eyebrow">Prove a historical call end to end</p>
        <div class="usd-l1-empty">No date where both models called in opposite directions exists in this run, so no
          worked call can be shown. ${usdL1Number(candidates.opposite.length, 0)} dates carry a disagreement of any kind.</div>
      </section>
    `;
  }

  const current = session.models?.current || {};
  const challenger = session.models?.challenger || {};
  const metaByKey = new Map(asArray(session.input_meta).map((row) => [row[0], row]));
  const inputRows = () => {
    const keys = [
      ...new Set(
        asArray(challenger.mechanisms)
          .map((entry) => (definitions.get(entry[0]) || {}).input)
          .filter(Boolean)
          .concat(["gold_price", "nasdaq100_price"])
      )
    ];
    return keys
      .map((key) => {
        const meta = metaByKey.get(key);
        const value = session.saved_inputs ? session.saved_inputs[key] : null;
        return `
          <tr data-usd-l1-worked-input="${escapeHtml(key)}">
            <th scope="row"><code>${escapeHtml(key)}</code></th>
            <td>${Number.isFinite(value) ? escapeHtml(String(value)) : `<span class="usd-l1-missing">missing</span>`}</td>
            <td>${meta ? escapeHtml(String(meta[1] || "")) : "—"}</td>
            <td>${meta && Number.isFinite(meta[2]) ? `${usdL1Number(meta[2], 0)} business days` : "—"}</td>
            <td>${meta && Number.isFinite(meta[3]) ? escapeHtml(legend[meta[3]] || "") : "—"}</td>
          </tr>
        `;
      })
      .join("");
  };
  const mechanismRows = () => {
    let running = 0;
    const stored = new Map(asArray(challenger.mechanisms).map((entry) => [entry[0], entry]));
    return asArray(payload.run?.challenger_mechanisms)
      .map((definition) => {
        const entry = stored.get(definition.id) || [definition.id, null, null];
        if (Number.isFinite(entry[2])) running += entry[2];
        const vote = !Number.isFinite(entry[2])
          ? "no vote"
          : entry[2] > 0
            ? "+1 USD"
            : entry[2] < 0
              ? "−1 USD"
              : "0 (inside cut-off)";
        return `
          <tr data-usd-l1-worked-mechanism="${escapeHtml(definition.id)}">
            <th scope="row">${escapeHtml(definition.label)}<span class="usd-l1-sample">${escapeHtml(
              definition.input
            )}</span></th>
            <td>${Number.isFinite(entry[1]) ? escapeHtml(String(entry[1])) : `<span class="usd-l1-missing">missing</span>`}</td>
            <td>${escapeHtml(definition.threshold)}</td>
            <td>${vote}</td>
            <td>${Number.isFinite(entry[2]) ? usdL1Number(definition.weight, 0) : "—"}</td>
            <td>${usdL1Signed(running, 0)}</td>
          </tr>
        `;
      })
      .join("");
  };
  const band = rules_conviction_bands(payload).find(
    (entry) =>
      (challenger.agreement || 0) >= entry.min_agreement &&
      (challenger.participation || 0) >= entry.min_participation
  );
  const reRun = usdLayer1State.reRun && usdLayer1State.reRun.date === session.date ? usdLayer1State.reRun : null;
  const currentFactors = asArray(current.factors).filter((entry) => entry[1] && entry[1] !== "NEUTRAL");
  const liveMechanisms = asArray(challenger.mechanisms).filter((entry) => Number.isFinite(entry[2]) && entry[2] !== 0);
  const outcomeRows = asArray(payload.run?.markets)
    .map((market) => {
      const outcome = (session.outcomes || {})[market.key] || {};
      return `
        <tr data-usd-l1-worked-outcome="${escapeHtml(market.key)}">
          <th scope="row">${escapeHtml(market.label)}</th>
          <td>${outcome.direction
            ? `${escapeHtml(outcome.direction)}${
                Number.isFinite(outcome.move_pct) ? ` (${usdL1Signed(outcome.move_pct, 2, "%")})` : ""
              }`
            : "no 05:00 bar"}</td>
          <td>${Number.isFinite(outcome.flat_band_pct) ? usdL1Percent(outcome.flat_band_pct) : "—"}</td>
          <td>${usdL1ResultChip((session.results?.current || {})[market.key])}</td>
          <td>${usdL1ResultChip((session.results?.challenger || {})[market.key])}</td>
        </tr>
      `;
    })
    .join("");
  const workedTop = `
    <div class="usd-l1-worked-head">
      <div>
        <p class="eyebrow">Prove a historical call end to end</p>
        <h3>${escapeHtml(session.date)} · ${escapeHtml(session.split)} · current called
          ${escapeHtml(current.direction || "no call")}, challenger called ${escapeHtml(challenger.direction || "no call")}</h3>
        <p class="usd-l1-test-copy muted">Cutoff ${escapeHtml(session.cutoff_at_utc)} (${escapeHtml(
          session.cutoff_offset_abbrev
        )}) → endpoint ${escapeHtml(session.endpoint_at_utc)}. Every value below is read from this session row.</p>
      </div>
      <button type="button" class="usd-l1-rerun" data-usd-l1-rerun="${escapeHtml(session.date)}">Re-run from the saved inputs</button>
    </div>
    ${picker}
    ${reRun
      ? `<p class="usd-l1-rerun-result ${reRun.ok ? "ok" : "fail"}" data-usd-l1-rerun-result="${escapeHtml(session.date)}">${
          reRun.ok
            ? `Re-ran from the saved inputs: ${escapeHtml(reRun.fresh.direction)} at conviction ${usdL1Text(
                reRun.fresh.conviction
              )}, raw score ${usdL1Signed(reRun.fresh.raw_score, 0)} — identical to the stored call.`
            : `Re-ran from the saved inputs and did not reproduce: ${escapeHtml(
                asArray(reRun.fields).join(", ") || reRun.reason || "unknown"
              )}`
        }</p>`
      : ""}
  `;
  const workedInputs = `
    <div class="usd-l1-worked-grid">
      <section class="usd-l1-worked-section">
        <h4>1. What was available by 05:00 London</h4>
        <table class="usd-l1-table usd-l1-worked-inputs">
          <caption>Value, print date, staleness and source for every input the mechanisms read</caption>
          <thead>
            <tr><th scope="col">Input</th><th scope="col">Value</th><th scope="col">Print date</th><th scope="col">Staleness</th><th scope="col">Source</th></tr>
          </thead>
          <tbody>${inputRows()}</tbody>
        </table>
        <p class="usd-l1-test-copy muted">Missing at this cutoff:
          ${asArray(challenger.missing_inputs).length
            ? asArray(challenger.missing_inputs).map((item) => `<code>${escapeHtml(item)}</code>`).join(" ")
            : "nothing the challenger reads"}</p>
      </section>
      <section class="usd-l1-worked-section">
        <h4>2. Each mechanism's contribution</h4>
        <table class="usd-l1-table usd-l1-worked-mechanisms">
          <caption>Value, cut-off, vote, weight and the running total</caption>
          <thead>
            <tr><th scope="col">Mechanism</th><th scope="col">Value</th><th scope="col">Cut-off</th><th scope="col">Vote</th><th scope="col">Weight</th><th scope="col">Running total</th></tr>
          </thead>
          <tbody>${mechanismRows()}</tbody>
        </table>
      </section>
    </div>
  `;
  const workedCalc = `
    <div class="usd-l1-worked-grid">
      <section class="usd-l1-worked-section">
        <h4>3. The calculation</h4>
        <ul class="usd-l1-method-list usd-l1-worked-calc">
          <li><b>Net score</b><span>${usdL1Signed(challenger.raw_score, 0)} from ${usdL1Number(
            challenger.usable_mechanisms,
            0
          )} live mechanisms of ${usdL1Number(
            asArray(payload.run?.challenger_mechanisms).length,
            0
          )}; a positive net is a bullish USD reading</span></li>
          <li><b>Agreement</b><span>${usdL1Percent(
            Number.isFinite(challenger.agreement) ? challenger.agreement * 100 : null,
            0
          )} — |net| ÷ live mechanisms, against a ${usdL1Number(
            rules_agreement_deadband_pct(payload),
            0
          )}% deadband floor</span></li>
          <li><b>Participation</b><span>${usdL1Percent(
            Number.isFinite(challenger.participation) ? challenger.participation * 100 : null,
            0
          )} — live mechanisms ÷ all mechanisms, against a minimum of ${usdL1Number(
            payload.run?.challenger_rules?.min_usable_mechanisms,
            0
          )} live</span></li>
          <li><b>Conviction</b><span>${
            band
              ? `band ${band.conviction} needs ${usdL1Number(band.min_agreement * 100, 0)}% agreement and ${usdL1Number(
                  band.min_participation * 100,
                  0
                )}% participation`
              : "no band matched, so no call"
          } → ${usdL1ConvictionPips(challenger.conviction)}</span></li>
          <li><b>Result</b><span>${escapeHtml(challenger.direction || "no call")}${
            Number.isFinite(challenger.conviction) ? ` at conviction ${challenger.conviction}` : ""
          } · ${escapeHtml(challenger.reason || "")}</span></li>
        </ul>
      </section>
      <section class="usd-l1-worked-section">
        <h4>4. Why the current model read it differently</h4>
        <p class="usd-l1-test-copy">The current model called
          <b>${escapeHtml(current.direction_label || current.direction || "no call")}</b> at raw conviction
          ${usdL1Text(current.conviction_raw)} on its own 0-100 scale (banded to ${usdL1Text(current.conviction)}),
          with a net weight of ${usdL1Signed(current.net_weight, 2)} across ${usdL1Number(
            current.factors_live,
            0
          )} non-neutral factors. ${escapeHtml(current.reason || "")}</p>
        <ul class="usd-l1-method-list">
          ${currentFactors
            .map(
              (factor) =>
                `<li><b>${escapeHtml(factor[0])}</b><span>${escapeHtml(factor[1])} · weight ${usdL1Number(
                  factor[2],
                  0
                )}</span></li>`
            )
            .join("") || `<li><span>every factor in the current model's book was neutral this morning</span></li>`}
        </ul>
        <p class="usd-l1-test-copy muted">The challenger's live mechanisms were
          ${
            liveMechanisms.length
              ? liveMechanisms.map((entry) => `${escapeHtml(entry[0])} ${entry[2] > 0 ? "+1" : "−1"}`).join(", ")
              : "none"
          }. The two models disagreed because they read different books: the challenger gives every mechanism one
          equal vote and abstains on thin or split mornings, while the current model weights its own factors and still
          labels a lean when its book is unbalanced.</p>
      </section>
    </div>
  `;
  const workedOutcomes = `
    <section class="usd-l1-worked-section">
      <h4>5. What happened next</h4>
      <table class="usd-l1-table usd-l1-worked-outcomes">
        <caption>A USD-bullish call predicts down for all four markets; a flat session is never a hit</caption>
        <thead>
          <tr><th scope="col">Market</th><th scope="col">Session move</th><th scope="col">Flat band</th><th scope="col">Current</th><th scope="col">Challenger</th></tr>
        </thead>
        <tbody>${outcomeRows}</tbody>
      </table>
    </section>
    <p class="usd-l1-test-copy muted" data-usd-l1-no-call-example="true">A no-call example from the same run:
      ${
        candidates.noCallDeadband
          ? `${escapeHtml(candidates.noCallDeadband.date)} — ${escapeHtml(
              candidates.noCallDeadband.models.challenger.reason || ""
            )}`
          : "no deadband no-call date is present"
      }${
        candidates.noCallThin
          ? ` · ${escapeHtml(candidates.noCallThin.date)} — ${escapeHtml(
              candidates.noCallThin.models.challenger.reason || ""
            )}`
          : ""
      }</p>
  `;
  return `
    <section class="usd-l1-worked" data-usd-l1-worked="true" data-usd-l1-worked-date="${escapeHtml(session.date)}">
      ${workedTop}
      ${workedInputs}
      ${workedCalc}
      ${workedOutcomes}
    </section>
  `;
}

/** The five conviction bands, in the order the artefact declares them. */
function rules_conviction_bands(payload = {}) {
  return asArray(payload.run?.challenger_rules?.conviction_bands);
}

/** The agreement deadband as a whole percentage, whichever form the artefact carries. */
function rules_agreement_deadband_pct(payload = {}) {
  const rules = payload.run?.challenger_rules || {};
  if (Number.isFinite(rules.agreement_deadband_pct)) return rules.agreement_deadband_pct;
  return Number.isFinite(rules.agreement_deadband) ? Math.round(rules.agreement_deadband * 100) : null;
}

function renderUsdL1Backtester(payload = null) {
  const updated = document.getElementById("usdLayer1Updated");
  if (updated) {
    updated.textContent = usdLayer1LoadError
      ? `Saved research results unavailable: ${usdLayer1LoadError}`
      : payload
        ? `Last update: ${formatDashboardTime(payload.generated_at)} · research only`
        : "Loading saved research results...";
  }
  const panel = document.getElementById("usdLayer1Panel");
  if (!panel) return;

  if (usdLayer1LoadError) {
    panel.innerHTML = `
      <article class="detail-panel wide-panel research-status-card">
        <p class="eyebrow">USD Layer 1 Backtester</p>
        <h3>Saved research results unavailable</h3>
        <div class="empty-state">${escapeHtml(usdLayer1LoadError)}</div>
        <p class="usd-l1-test-copy muted">The panel renders <code>data/usd-layer1-backtester/run-v1.json</code>. Rebuild it with <code>node backtester/scripts/run_usd_layer1_backtest.js --publish</code>.</p>
      </article>
    `;
    return;
  }

  if (!payload) {
    panel.innerHTML = `<div class="empty-state">Loading the saved run artefact...</div>`;
    return;
  }

  panel.innerHTML = `
    ${renderUsdL1Results(payload)}
    ${renderUsdL1Progress(payload)}
    ${renderUsdL1CallMethod(payload)}
    ${renderUsdL1WorkedCall(payload)}
    ${renderUsdL1Coverage(payload)}
    ${renderUsdL1TabStrip()}
    ${renderUsdL1TestBody(payload)}
    ${renderUsdL1SessionList(payload)}
    ${renderUsdL1Evidence(payload, usdLayer1State.evidence)}
  `;
  mountUsdL1Replay();
}

function ensureUsdLayer1Loaded() {
  if (usdLayer1Request) return usdLayer1Request;
  usdLayer1Request = fetchLocalJson(usdLayer1BacktesterUrl)
    .then((payload) => {
      usdLayer1Data = payload;
      usdLayer1LoadError = null;
      return payload;
    })
    .catch((error) => {
      usdLayer1LoadError = error?.message || String(error);
      usdLayer1Data = null;
      console.error("USD Layer 1 backtester artefact unavailable", error);
      return null;
    })
    .finally(() => {
      renderUsdL1Backtester(usdLayer1Data);
    });
  return usdLayer1Request;
}

function setupUsdL1Controls() {
  const panel = document.getElementById("usdLayer1Panel");
  if (!panel || panel.dataset.usdL1Bound === "true") return;
  panel.dataset.usdL1Bound = "true";

  panel.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-usd-l1-tab]");
    if (tabButton) {
      usdLayer1State.tab = tabButton.dataset.usdL1Tab || "dxy_direction";
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }

    const filterButton = event.target.closest("[data-usd-l1-session-filter]");
    if (filterButton) {
      usdLayer1State.sessionFilter = filterButton.dataset.usdL1SessionFilter || "all";
      usdLayer1State.selectedDate = null;
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }

    const sessionButton = event.target.closest("[data-usd-l1-session]");
    if (sessionButton) {
      usdLayer1State.selectedDate = sessionButton.dataset.usdL1Session || null;
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }

    const demoSessionButton = event.target.closest("[data-usd-l1-demo-session]");
    if (demoSessionButton) {
      usdLayer1State.demoSession = demoSessionButton.dataset.usdL1DemoSession || null;
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }

    const replayAction = event.target.closest("[data-usd-l1-replay-action]");
    if (replayAction && usdL1ReplayController) {
      const action = replayAction.dataset.usdL1ReplayAction;
      const last = usdL1ReplayController.steps.length - 1;
      if (action === "first") usdL1ReplayController.setStep(0);
      else if (action === "prev") usdL1ReplayController.previous();
      else if (action === "next") usdL1ReplayController.next();
      else if (action === "last") usdL1ReplayController.setStep(last);
      return;
    }

    if (event.target.closest("[data-usd-l1-evidence-close]")) {
      usdLayer1State.evidence = null;
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }

    const evidenceButton = event.target.closest("button[data-usd-l1-evidence]");
    if (evidenceButton) {
      const spec = evidenceButton.dataset.usdL1Evidence || "";
      usdLayer1State.evidence = usdLayer1State.evidence === spec ? null : spec;
      renderUsdL1Backtester(usdLayer1Data);
      const drawer = document.querySelector("[data-usd-l1-evidence-panel]");
      if (drawer && typeof drawer.scrollIntoView === "function") drawer.scrollIntoView({ block: "nearest" });
      return;
    }

    const workedButton = event.target.closest("button[data-usd-l1-worked-date]");
    if (workedButton) {
      usdLayer1State.workedDate = workedButton.dataset.usdL1WorkedDate || null;
      usdLayer1State.reRun = null;
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }

    const reRunButton = event.target.closest("[data-usd-l1-rerun]");
    if (reRunButton) {
      usdLayer1State.reRun = usdL1Recompute(usdLayer1Data || {}, reRunButton.dataset.usdL1Rerun || null);
      renderUsdL1Backtester(usdLayer1Data);
      return;
    }
  });
}


function bootUsdL1Panel() {
  setupUsdL1Controls();
  renderUsdL1Backtester(usdLayer1Data);
  ensureUsdLayer1Loaded();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootUsdL1Panel);
} else {
  bootUsdL1Panel();
}
