(function initSystemMap() {
  "use strict";

  const ASSETS = [
    {
      code: "USD",
      name: "US dollar",
      icon: "dollar",
      status: "established",
      statusLabel: "Established",
      pairRole: "Quote leg for every pair",
      reads: "VIX, US 2Y, real yield, DXY, gold, economic surprises, Fed bias, dollar smile, equity correlation",
      writes: "One raw USD call per timeframe. No pair or trade call.",
      gate: "Ten weighted factors. Missing inputs are neutral; conviction is computed downstream.",
      backtest: [
        "DXY directional accuracy",
        "EUR/USD, gold, BTC/USD and NAS100 opposite-move rate",
        "Full-level L2L trading results at 5R",
        "Half-level L2L trading results at 3R"
      ],
      note: "The backtester page compares the current 10-factor model with a 25-factor challenger. This map shows the test set, not the results."
    },
    {
      code: "EUR",
      name: "Euro",
      icon: "euro",
      status: "established",
      statusLabel: "Established",
      pairRole: "Target leg for EUR/USD",
      reads: "ECB bias, German 2Y, US-DE spread, eurozone surprise, PMI, own price, gold, stress, growth, VIX",
      writes: "One raw EUR call per timeframe. No EUR/USD pair call.",
      gate: "Ten weighted factors. ECB bias and the US-DE spread carry the most weight.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is a production baseline candidate. The map does not imply a published backtest result."
    },
    {
      code: "GOLD",
      name: "Gold",
      icon: "bar",
      status: "established",
      statusLabel: "Established",
      pairRole: "Target leg for XAU/USD",
      reads: "Real yield, DXY, Fed bias, US 2Y, own price, VIX, economic surprise, inflation, safe haven, liquidity",
      writes: "One raw gold call per timeframe. No XAU/USD pair call.",
      gate: "Ten weighted factors. Real yield and DXY are the primary drivers.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is a production baseline. The map does not imply a published backtest result."
    },
    {
      code: "SILVER",
      name: "Silver",
      icon: "sparkle",
      status: "onboarding",
      statusLabel: "Onboarding",
      pairRole: "Target leg for XAG/USD",
      reads: "Real yield, broad dollar, Fed bias, own price, gold/silver ratio, VIX, surprise, industrial demand, growth, supply context",
      writes: "One raw silver call per timeframe. No XAG/USD pair call.",
      gate: "Weights are hypotheses. Provider, schema, replay and checker validation are still pending.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is an inactive draft. The published feed can already carry a silver row; the onboarding label describes the document, not a missing lane."
    },
    {
      code: "NQ",
      name: "Nasdaq 100",
      icon: "chart",
      status: "established",
      statusLabel: "Established",
      pairRole: "Target leg for NQ/USD",
      reads: "VIX level and delta, DXY, 10Y nominal and real yield, Fed bias, surprise, own price, BTC, gold",
      writes: "One raw NQ call per timeframe. No NQ/USD pair call.",
      gate: "Ten weighted factors. Volatility and real-yield blocks carry the most weight.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is a production baseline candidate. The map does not imply a published backtest result."
    },
    {
      code: "BTC",
      name: "Bitcoin",
      icon: "coin",
      status: "established",
      statusLabel: "Established",
      pairRole: "Target leg for BTC/USD",
      reads: "Own price, DXY, real yield, Fed bias, VIX, NQ, surprise, ETF flow, stablecoin liquidity, dominance",
      writes: "One raw BTC call per timeframe. No BTC/USD pair call.",
      gate: "Ten weighted factors. Dollar pressure, real yield and risk regime lead.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is a production baseline candidate. The map does not imply a published backtest result."
    },
    {
      code: "WTI",
      name: "Crude oil",
      icon: "drop",
      status: "onboarding",
      statusLabel: "Onboarding",
      pairRole: "Target leg for WTI/USD",
      reads: "Own price and trend, DXY, VIX, S&P 500, US 2Y, price-vs-dollar confirmation, curve regime, inventories, OPEC bias",
      writes: "One raw WTI call per timeframe. No WTI/USD pair call.",
      gate: "Weights are provisional. Inventory, OPEC and curve inputs remain unavailable in the draft.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is research onboarding only. The published feed can already carry a WTI row; the label describes the document status."
    },
    {
      code: "GBP",
      name: "Sterling",
      icon: "pound",
      status: "onboarding",
      statusLabel: "Onboarding",
      pairRole: "Target leg for GBP/USD",
      reads: "BoE bias, UK gilt impulse, US-UK spread, UK surprise, PMI, own price, DXY, VIX, growth, UK stress",
      writes: "One raw GBP call per timeframe. No GBP/USD pair call.",
      gate: "Weights are research-stage. Historical replay and checker validation are pending.",
      backtest: ["No replay documented in this checkout."],
      note: "The logic document is research onboarding only. The published feed can already carry a GBP row; the label describes the document status."
    }
  ];

  const PAIRS = [
    { code: "EUR_USD", label: "EUR/USD", target: "EUR", quote: "USD" },
    { code: "XAU_USD", label: "XAU/USD", target: "GOLD", quote: "USD" },
    { code: "XAG_USD", label: "XAG/USD", target: "SILVER", quote: "USD" },
    { code: "NQ_USD", label: "NQ/USD", target: "NQ", quote: "USD" },
    { code: "BTC_USD", label: "BTC/USD", target: "BTC", quote: "USD" },
    { code: "WTI_USD", label: "WTI/USD", target: "WTI", quote: "USD" },
    { code: "GBP_USD", label: "GBP/USD", target: "GBP", quote: "USD" }
  ];

  const STAGES = [
    { index: "01", title: "L1 call", sub: "One verdict per asset" },
    { index: "02", title: "Gate", sub: "Weights and thresholds" },
    { index: "03", title: "Backtest", sub: "What was replayed" },
    { index: "04", title: "Research", sub: "Where inputs come from" },
    { index: "05", title: "L2 read", sub: "Every call is visible" },
    { index: "06", title: "Pair", sub: "The only join" }
  ];

  const STAGE_ICONS = ["signal", "gate", "flask", "book", "network", "link"];

  const ICONS = {
    dollar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 2v12"/><path d="M11 5.2c0-1.1-1.3-1.9-3-1.9s-3 .8-3 2 1.2 1.7 3 2.1 3 1 3 2.2-1.3 2.1-3 2.1-3-.9-3-2"/></svg>',
    euro: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M12 4.4A4.6 4.6 0 0 0 5.7 6.1a5.2 5.2 0 0 0 0 3.8A4.6 4.6 0 0 0 12 11.6"/><path d="M3.2 6.6h6.4M3.2 9.4h6.4"/></svg>',
    bar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M3 6.2 8 3l5 3.2-5 3.2z"/><path d="M3 9.2 8 12.4l5-3.2M3 7.7l5 3.2 5-3.2"/></svg>',
    sparkle: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 2.4 9.5 6.5 13.6 8 9.5 9.5 8 13.6 6.5 9.5 2.4 8 6.5 6.5z"/></svg>',
    chart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 12.8h11.2"/><path d="M3.4 10.2 6 7.4l2.2 1.8 4.4-5"/><path d="M10.4 4.2h2.2v2.2"/></svg>',
    coin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5.4"/><path d="M6.2 10.4V5.6h2.2a1.5 1.5 0 1 1 0 3H6.2m0 0h2.5a1.5 1.5 0 1 1 0 3H6.2"/></svg>',
    drop: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 2.2c2.1 2.4 3.6 4.2 3.6 6.3A3.6 3.6 0 0 1 8 12.2a3.6 3.6 0 0 1-3.6-3.7C4.4 6.4 5.9 4.6 8 2.2z"/></svg>',
    pound: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M9.6 3.2H8.2A2.4 2.4 0 0 0 5.8 5.6v5.2"/><path d="M4.4 8.2h4.8"/><path d="M4.4 10.8h6"/></svg>',
    signal: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 11.4V9.2M6.3 11.4V6.4M9.7 11.4V7.8M13 11.4V3.8"/></svg>',
    gate: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M3 4.4h10M3 8h10M3 11.6h10"/><circle cx="6" cy="4.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="10.4" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="7.4" cy="11.6" r="1.3" fill="currentColor" stroke="none"/></svg>',
    flask: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 2.4h3.2M7 2.4v4.1l-3.2 5.2a1.3 1.3 0 0 0 1.1 1.9h6.2a1.3 1.3 0 0 0 1.1-1.9L9 6.5V2.4"/><path d="M5.4 9.2h5.2"/></svg>',
    book: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2.8 3.2h4a2 2 0 0 1 2 2v7.6a1.6 1.6 0 0 0-1.6-1.6H2.8z"/><path d="M13.2 3.2h-4a2 2 0 0 0-2 2v7.6a1.6 1.6 0 0 1 1.6-1.6h4.4z"/></svg>',
    network: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="4" cy="4" r="1.6"/><circle cx="12" cy="4" r="1.6"/><circle cx="8" cy="12" r="1.6"/><path d="M5.3 4h5.4M4.8 5.3l2.4 5.4M11.2 5.3 8.8 10.7"/></svg>',
    link: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6.4 9.6 9.6 6.4"/><path d="M5.1 10.9 3.8 12.2a2.5 2.5 0 0 1-3.5-3.5l2.5-2.5a2.5 2.5 0 0 1 3.5 0"/><path d="m10.9 5.1 1.3-1.3a2.5 2.5 0 0 1 3.5 3.5l-2.5 2.5a2.5 2.5 0 0 1-3.5 0"/></svg>'
  };


  function icon(name) {
    return `<span class="map-node-icon" aria-hidden="true">${ICONS[name] || ""}</span>`;
  }

  function laneTemplate(asset) {
    const onboarding = asset.status === "onboarding";
    const statusClass = onboarding ? " onboarding" : "";
    const backtestTitle = asset.code === "USD" ? "Four tests" : "No replay";
    const backtestSub = asset.code === "USD" ? "25-factor challenger" : "Not documented";
    return `
      <article class="map-lane" data-asset="${asset.code}" data-tier="${asset.status}" role="listitem">
        <button class="map-row-label" type="button" data-map-lane="${asset.code}" aria-pressed="false" aria-label="${asset.name}: highlight this path">
          <span class="map-row-code"><span class="map-row-dot${statusClass}" aria-hidden="true"></span>${asset.code}</span>
          <span class="map-row-name">${asset.name}</span>
        </button>
        <div class="map-node is-call">
          ${icon("signal")}
          <span class="map-node-copy"><span class="map-node-title">${asset.code} call</span><span class="map-node-sub">24h to month</span></span>
        </div>
        <div class="map-node">
          ${icon("gate")}
          <span class="map-node-copy"><span class="map-node-title">Weighted gate</span><span class="map-node-sub">Deterministic</span></span>
        </div>
        <div class="map-node${asset.code === "USD" ? "" : " is-unverified"}">
          ${icon("flask")}
          <span class="map-node-copy"><span class="map-node-title">${backtestTitle}</span><span class="map-node-sub">${backtestSub}</span></span>
        </div>
        <div class="map-node">
          ${icon("book")}
          <span class="map-node-copy"><span class="map-node-title">10-factor model</span><span class="map-node-sub">Snapshot inputs</span></span>
        </div>
        <div class="map-node">
          ${icon("network")}
          <span class="map-node-copy"><span class="map-node-title">L2 row</span><span class="map-node-sub">Read by pair gate</span></span>
        </div>
        <div class="map-node">
          ${icon("link")}
          <span class="map-node-copy"><span class="map-node-title">Pair input</span><span class="map-node-sub">${asset.code === "USD" ? "Quote leg" : "Target leg"}</span></span>
        </div>
      </article>`;
  }

  function controlsTemplate() {
    const assetButtons = ASSETS.map((asset) => {
      const onboarding = asset.status === "onboarding";
      return `<button class="map-chip" type="button" data-map-asset="${asset.code}" aria-pressed="false">
        <span class="map-chip-tier${onboarding ? " onboarding" : ""}" aria-hidden="true"></span>
        <span class="map-chip-code">${asset.code}</span>
        <span class="map-chip-sub">${onboarding ? "onboarding" : "established"}</span>
      </button>`;
    }).join("");
    const pairButtons = PAIRS.map((pair) =>
      `<button class="map-chip map-chip--pair" type="button" data-map-pair="${pair.code}" aria-pressed="false" title="${pair.label}: ${pair.target} plus ${pair.quote}">${pair.label}</button>`
    ).join("");
    return `
      <section class="map-controls" aria-label="Highlight a path">
        <div class="map-control-row">
          <span class="map-control-label">Asset</span>
          <div class="map-chip-row" role="group" aria-label="Highlight one asset">${assetButtons}</div>
        </div>
        <div class="map-control-row">
          <span class="map-control-label">Pair</span>
          <div class="map-chip-row" role="group" aria-label="Highlight the inputs to one Layer 2 pair">${pairButtons}</div>
          <button class="map-reset" type="button" data-map-reset>Show all</button>
        </div>
      </section>`;
  }

  function boardTemplate() {
    const head = STAGES.map((stage) => `
      <div class="map-stage-head">
        <span class="map-stage-index">${stage.index}</span>
        <span class="map-stage-title">${stage.title}</span>
        <span class="map-stage-sub">${stage.sub}</span>
      </div>`).join("");

    return `
      <div class="map-board-shell">
        <div class="map-board" data-map-board>
          <div class="map-scroller">
            <div class="map-board-grid">
              <div class="map-board-head" aria-hidden="true">
                <div class="map-head-spacer"></div>
                ${head}
              </div>
              <div class="map-lanes" role="list" aria-label="Eight asset paths, one lane per asset">
                ${ASSETS.map(laneTemplate).join("")}
              </div>
            </div>
          </div>
          <div class="map-flow">
              <div class="map-flow-label"><span>All eight calls converge</span></div>
              <div class="map-layer2" data-map-join>
                <span class="map-layer2-badge">Layer 2 · join</span>
                <h2>Pair selection and execution</h2>
                <p>Layer 2 reads all eight calls. It only acts when the target and USD 24H calls point opposite ways.</p>
                <span class="map-join-state" data-map-join-state>Eight calls in · one pair out</span>
              </div>
              <div class="map-execution">
                <div class="map-vps">
                  <span class="map-vps-label">Execution</span>
                  <strong>VPS execution layer</strong>
                  <span class="map-vps-sub">Two live branches · one shared bridge</span>
                </div>
                <div class="map-branches">
                  <div class="map-branch">
                    <span class="map-branch-label">Branch 1</span>
                    <strong>Live L2L directional</strong>
                    <span class="map-branch-target">FTMO 1</span>
                  </div>
                  <div class="map-branch">
                    <span class="map-branch-label">Branch 2</span>
                    <strong>Live 0.5L2L directional</strong>
                    <span class="map-branch-target">FTMO 2</span>
                  </div>
                </div>
                <div class="map-outcome">
                  <span class="map-outcome-label">Conditional · after an approved payout</span>
                  <div class="map-outcome-grid">
                    <div class="map-outcome-node">
                      <strong>Approved FTMO payout</strong>
                      <span>Withdrawal approval</span>
                    </div>
                    <span class="map-outcome-arrow" aria-hidden="true">→</span>
                    <div class="map-outcome-node">
                      <strong>Personal bank account</strong>
                      <span>Illustrative only</span>
                    </div>
                  </div>
                </div>
              </div>
              <p class="map-flow-note">The dotted step is conditional and illustrative. It is not a promise of a payout and not part of the live trading loop.</p>
            </div>
            <svg class="map-connectors" data-map-connectors aria-hidden="true" focusable="false">
              <defs>
                <filter id="sm-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <g data-map-routes></g>
            </svg>
        </div>
      </div>`;
  }

  function factsTemplate(facts) {
    return `<dl class="map-facts">${facts.map((fact) => `
      <div class="map-fact">
        <dt>${fact.label}</dt>
        <dd>${fact.list
          ? `<ul class="map-evidence-list">${fact.list.map((item) => `<li>${item}</li>`).join("")}</ul>`
          : fact.value}</dd>
      </div>`).join("")}</dl>`;
  }

  function badgesTemplate(badges) {
    return `<div class="map-readout-badges">${badges.map((badge) => {
      const tone = badge.tone === "warn" ? " is-onboarding" : badge.tone === "accent" ? " is-amber" : "";
      return `<span class="map-tier${tone}">${badge.label}</span>`;
    }).join("")}</div>`;
  }

  function readoutShell(stateLabel, title, lede, badges, facts, note) {
    return `
      <div class="map-readout-head">
        <span class="map-readout-state">${stateLabel}</span>
        <span>Read-only</span>
      </div>
      <h2>${title}</h2>
      <p class="map-readout-lede">${lede}</p>
      ${badgesTemplate(badges)}
      ${factsTemplate(facts)}
      <p class="map-readout-note">${note}</p>`;
  }

  function readoutForAll() {
    return readoutShell(
      "All paths",
      "One join, eight inputs",
      "Every asset keeps its own L1 call. Layer 2 is the only place where the paths meet.",
      [
        { label: "Architecture", tone: "accent" },
        { label: "Static illustration" },
        { label: "No live data" }
      ],
      [
        { label: "Inputs", value: "USD · EUR · Gold · Silver · NQ · BTC · WTI · GBP" },
        { label: "Join", value: "Layer 2 pair selection, one pair at a time." },
        { label: "Rule", value: "The target and USD 24H calls must point opposite ways." },
        { label: "Output", value: "BUY or SELL on the pair, or no trade." },
        { label: "Execution", value: "VPS bridge, then two live FTMO branches." },
        { label: "Payout path", value: "Approved payout to a personal bank account, conditional and illustrative." }
      ],
      "Select an asset or a pair to light its path. The map changes only the illustration."
    );
  }

  function readoutForAsset(asset) {
    const onboarding = asset.status === "onboarding";
    const pair = PAIRS.find((item) => item.target === asset.code);
    const pairLabel = pair ? pair.label : null;
    const lede = onboarding
      ? `${asset.name} has a published row and a draft logic document. The map shows where it sits, not a live call.`
      : `${asset.name} produces its own directional call before Layer 2 sees it.`;
    const facts = [
      { label: "L1 call", value: `One ${asset.code} directional verdict per timeframe.` },
      { label: "Reads", value: asset.reads },
      { label: "Writes", value: asset.writes },
      { label: "Gate", value: asset.gate },
      { label: "Backtest", list: asset.backtest },
      { label: "At Layer 2", value: asset.code === "USD" ? "Acts as the quote leg for every pair." : `Acts as the target leg for ${pairLabel}.` }
    ];
    const badges = [
      { label: asset.statusLabel, tone: onboarding ? "warn" : "good" },
      { label: asset.pairRole },
      { label: "L1 call only" }
    ];
    return readoutShell(`${asset.code} path`, asset.name, lede, badges, facts, asset.note);
  }

  function readoutForPair(pair) {
    const target = ASSETS.find((asset) => asset.code === pair.target);
    const onboarding = target && target.status === "onboarding";
    const badges = [
      { label: `Target: ${pair.target}`, tone: onboarding ? "warn" : "good" },
      { label: `Quote: ${pair.quote}` },
      { label: "Layer 2 pair", tone: "accent" }
    ];
    return readoutShell(
      `${pair.label} pair`,
      pair.label,
      "Layer 2 combines the target's call with the USD call. It only acts when the two 24H directions are opposite.",
      badges,
      [
        { label: "Target call", value: `${pair.target} L1 directional.` },
        { label: "Quote call", value: "USD L1 directional." },
        { label: "Rule", value: "Opposite exact directions; combined confidence is the lower leg." },
        { label: "Output", value: "BUY or SELL on the pair, or no trade." },
        { label: "Next", value: "VPS execution layer, then both live branches." }
      ],
      "The map highlights both input lanes. It does not show a live verdict or confidence."
    );
  }

  function pageTemplate(embedded) {
    // The host supplies the page heading, so the embedded map starts at the hint and the controls. That also keeps the
    // hologram canvas - and the standalone page's old "open full map" link - out of a page that has no full map to open.
    const hero = embedded ? "" : `
        <header class="map-hero">
          <div class="map-hologram" data-map-hologram aria-hidden="true"><canvas></canvas></div>
          <div class="map-hero-copy">
            <p class="map-kicker">Architecture · static map</p>
            <h1>One market.<br><em>Eight calls.</em><br>One execution join.</h1>
            <p class="map-lede">Each asset makes its own directional call. The shared backtester scores every lane. Layer 2 is the only place where the eight paths meet, and only one pair leaves for execution.</p>
          </div>
          <div class="map-hero-side">
            <span class="map-status"><span class="map-status-dot" aria-hidden="true"></span>Offline illustration</span>
          </div>
        </header>`;
    return `
      <div class="system-map-inner">
        ${hero}
        <p class="map-hint">Scroll the board sideways to see all six stages.</p>
        <div data-map-controls-host></div>
        <div data-map-board-host></div>
        <div class="map-readout-grid">
          <section class="map-readout" data-map-readout aria-live="polite"></section>
          <aside class="map-legend" aria-label="Legend and scope">
            <p class="map-legend-title">Legend</p>
            <div class="map-legend-item">
              <span class="map-legend-swatch" aria-hidden="true"></span>
              <div><strong>Established L1 path</strong><span>Published logic with a documented baseline.</span></div>
            </div>
            <div class="map-legend-item">
              <span class="map-legend-swatch is-onboarding" aria-hidden="true"></span>
              <div><strong>Onboarding logic</strong><span>Published row, draft logic document.</span></div>
            </div>
            <div class="map-legend-item">
              <span class="map-legend-swatch is-amber" aria-hidden="true"></span>
              <div><strong>Selected path</strong><span>The lane or pair you are reading.</span></div>
            </div>
            <div class="map-legend-item">
              <span class="map-legend-swatch is-conditional" aria-hidden="true"></span>
              <div><strong>Conditional payout step</strong><span>After an approved payout, illustrative only.</span></div>
            </div>
            <p class="map-scope">This is an offline architecture illustration. It shows no live call, confidence, verdict, balance or execution state, and requests no market data.</p>
          </aside>
        </div>
      </div>`;
  }

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { type: "all", id: null };
  const SVG_NS = "http://www.w3.org/2000/svg";
  const root = document.querySelector("[data-system-map]");
  if (!root) return;
  let hologramDraw = null;

  function focusedCodes() {
    if (state.type === "asset" && state.id) return new Set([state.id]);
    if (state.type === "pair" && state.id) {
      const pair = PAIRS.find((item) => item.code === state.id);
      if (pair) return new Set([pair.target, pair.quote]);
    }
    return new Set();
  }

  function setState(type, id) {
    state.type = type;
    state.id = id;
    const focused = focusedCodes();
    const hasFocus = focused.size > 0;
    root.classList.toggle("has-focus", hasFocus);
    root.dataset.focus = type;

    root.querySelectorAll("[data-map-asset]").forEach((button) => {
      button.setAttribute("aria-pressed", String(type === "asset" && button.dataset.mapAsset === id));
    });
    root.querySelectorAll("[data-map-pair]").forEach((button) => {
      button.setAttribute("aria-pressed", String(type === "pair" && button.dataset.mapPair === id));
    });
    root.querySelectorAll("[data-map-lane]").forEach((button) => {
      button.setAttribute("aria-pressed", String(type === "asset" && button.dataset.mapLane === id));
    });
    root.querySelectorAll(".map-lane").forEach((lane) => {
      const on = focused.has(lane.dataset.asset);
      lane.classList.toggle("is-focus", on);
      lane.classList.toggle("is-muted", hasFocus && !on);
    });

    const join = root.querySelector("[data-map-join]");
    if (join) join.classList.toggle("is-focus", hasFocus);

    const joinState = root.querySelector("[data-map-join-state]");
    if (joinState) {
      joinState.classList.toggle("is-active", hasFocus);
      if (type === "asset" && state.id) joinState.textContent = `${state.id} call in · Layer 2 reads all eight`;
      else if (type === "pair" && state.id) {
        const pair = PAIRS.find((item) => item.code === state.id);
        joinState.textContent = pair ? `${pair.label} · target + USD` : "Eight calls in · one pair out";
      } else joinState.textContent = "Eight calls in · one pair out";
    }

    root.querySelectorAll(".map-route").forEach((route) => {
      const isAssetRoute = route.dataset.route === "asset";
      const on = hasFocus && (!isAssetRoute || focused.has(route.dataset.asset));
      route.classList.toggle("is-active", on);
      route.classList.toggle("is-idle", hasFocus && !on);
    });
    const routeGroup = root.querySelector("[data-map-routes]");
    if (routeGroup) {
      root.querySelectorAll(".map-route.is-active").forEach((route) => routeGroup.appendChild(route));
    }

    const readout = root.querySelector("[data-map-readout]");
    if (!readout) return;
    if (type === "asset") {
      const asset = ASSETS.find((item) => item.code === id);
      readout.innerHTML = asset ? readoutForAsset(asset) : readoutForAll();
    } else if (type === "pair") {
      const pair = PAIRS.find((item) => item.code === id);
      readout.innerHTML = pair ? readoutForPair(pair) : readoutForAll();
    } else {
      readout.innerHTML = readoutForAll();
    }
    if (REDUCED_MOTION && hologramDraw) hologramDraw(performance.now());
  }

  function addRoute(group, d, routeType, assetCode, extraClass) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", `map-route${extraClass ? ` ${extraClass}` : ""}`);
    path.dataset.route = routeType;
    if (assetCode) path.dataset.asset = assetCode;
    group.appendChild(path);
    return path;
  }

  function drawConnectors() {
    const board = root.querySelector("[data-map-board]");
    const svg = root.querySelector("[data-map-connectors]");
    const group = root.querySelector("[data-map-routes]");
    const join = root.querySelector("[data-map-join]");
    if (!board || !svg || !group || !join) return;

    const boardRect = board.getBoundingClientRect();
    if (boardRect.width < 40 || boardRect.height < 40) return;
    const width = Math.round(boardRect.width);
    const height = Math.round(boardRect.height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    group.textContent = "";

    const joinRect = join.getBoundingClientRect();
    const joinTop = joinRect.top - boardRect.top;
    const joinBottom = joinRect.bottom - boardRect.top;
    const joinCenter = joinRect.left - boardRect.left + joinRect.width / 2;
    const busY = joinTop - 34;
    const railX = width - 10;

    const lanes = Array.from(root.querySelectorAll(".map-lane"));
    const lastLane = lanes[lanes.length - 1];
    const railBottom = lastLane
      ? lastLane.getBoundingClientRect().bottom - boardRect.top - 6
      : busY - 60;

    lanes.forEach((lane) => {
      const nodes = lane.querySelectorAll(".map-node");
      const last = nodes[nodes.length - 1];
      if (!last) return;
      const rect = last.getBoundingClientRect();
      const startX = rect.right - boardRect.left + 1;
      const startY = rect.top - boardRect.top + rect.height / 2;
      const d = `M ${startX} ${startY} L ${railX} ${startY} L ${railX} ${railBottom} C ${railX} ${railBottom + 26}, ${joinCenter} ${busY - 34}, ${joinCenter} ${busY} L ${joinCenter} ${joinTop}`;
      const asset = ASSETS.find((item) => item.code === lane.dataset.asset);
      addRoute(group, d, "asset", lane.dataset.asset, asset && asset.status === "onboarding" ? "is-onboarding" : "");
    });

    const vps = root.querySelector(".map-vps");
    if (!vps) return;
    const vpsRect = vps.getBoundingClientRect();
    const vpsTop = vpsRect.top - boardRect.top;
    const vpsBottom = vpsRect.bottom - boardRect.top;
    const vpsCenter = vpsRect.left - boardRect.left + vpsRect.width / 2;
    addRoute(
      group,
      `M ${joinCenter} ${joinBottom} C ${joinCenter} ${joinBottom + 16}, ${vpsCenter} ${vpsTop - 16}, ${vpsCenter} ${vpsTop}`,
      "execution",
      null,
      "is-stem"
    );

    const branches = Array.from(root.querySelectorAll(".map-branch"));
    branches.forEach((branch) => {
      const rect = branch.getBoundingClientRect();
      const x = rect.left - boardRect.left + rect.width / 2;
      const y = rect.top - boardRect.top;
      addRoute(
        group,
        `M ${vpsCenter} ${vpsBottom} C ${vpsCenter} ${vpsBottom + 18}, ${x} ${y - 18}, ${x} ${y}`,
        "execution"
      );
    });

    const outcome = root.querySelector(".map-outcome");
    if (!outcome) return;
    const outcomeRect = outcome.getBoundingClientRect();
    const outcomeX = outcomeRect.left - boardRect.left + outcomeRect.width / 2;
    const outcomeY = outcomeRect.top - boardRect.top;
    branches.forEach((branch) => {
      const rect = branch.getBoundingClientRect();
      const x = rect.left - boardRect.left + rect.width / 2;
      const y = rect.bottom - boardRect.top;
      addRoute(
        group,
        `M ${x} ${y} C ${x} ${y + 18}, ${outcomeX} ${outcomeY - 18}, ${outcomeX} ${outcomeY}`,
        "execution",
        null,
        "is-conditional"
      );
    });
  }

  let drawFrame = 0;
  function scheduleDraw() {
    if (drawFrame) return;
    drawFrame = requestAnimationFrame(() => {
      drawFrame = 0;
      const scroller = root.querySelector(".map-scroller");
      if (scroller) {
        const scrollable = scroller.scrollWidth - scroller.clientWidth > 2;
        root.classList.toggle("is-scrollable", scrollable);
        if (scrollable) {
          scroller.setAttribute("tabindex", "0");
          scroller.setAttribute("role", "region");
          scroller.setAttribute("aria-label", "Architecture board. Scroll sideways to see all six stages.");
        } else {
          scroller.removeAttribute("tabindex");
          scroller.removeAttribute("role");
          scroller.removeAttribute("aria-label");
        }
      }
      const board = root.querySelector("[data-map-board]");
      const connectors = root.querySelector("[data-map-connectors]");
      if (board && connectors) connectors.classList.toggle("is-hidden", board.clientWidth < 900);
      drawConnectors();
      setState(state.type, state.id);
    });
  }

  function initHologram() {
    const host = root.querySelector("[data-map-hologram]");
    const canvas = host ? host.querySelector("canvas") : null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let inView = true;
    const started = performance.now();

    function start() {
      if (REDUCED_MOTION || raf || document.hidden || !inView) return;
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host.clientWidth;
      height = host.clientHeight;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (REDUCED_MOTION) draw(performance.now());
    }

    function draw(now) {
      if (!width || !height) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.68;
      const cy = height * 0.53;
      const radius = Math.min(width, height) * 0.34;
      if (radius < 8) return;
      const spin = REDUCED_MOTION ? 0.45 : (now - started) / 14000;
      const focused = focusedCodes();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.16);
      ctx.lineWidth = 1;

      ctx.strokeStyle = "rgba(95, 228, 255, 0.18)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      for (let lat = -60; lat <= 60; lat += 30) {
        const rad = (lat * Math.PI) / 180;
        const y = Math.sin(rad) * radius;
        const rx = Math.max(3, Math.cos(rad) * radius);
        ctx.strokeStyle = "rgba(95, 228, 255, 0.12)";
        ctx.beginPath();
        ctx.ellipse(0, y, rx, Math.max(2, rx * 0.22), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let lon = 0; lon < 180; lon += 30) {
        const rx = Math.max(2, Math.abs(Math.sin((lon * Math.PI) / 180)) * radius);
        ctx.strokeStyle = "rgba(95, 228, 255, 0.11)";
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < 8; i += 1) {
        const angle = spin * Math.PI * 2 + (i * Math.PI * 2) / 8;
        const x1 = Math.cos(angle) * radius * 0.2;
        const y1 = Math.sin(angle) * radius * 0.2;
        const x2 = Math.cos(angle) * radius;
        const y2 = Math.sin(angle) * radius;
        ctx.strokeStyle = "rgba(95, 228, 255, 0.07)";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(95, 228, 255, 0.26)";
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.16, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(255, 184, 77, 0.34)";
      ctx.beginPath();
      ctx.arc(0, 0, radius, spin * Math.PI * 2, spin * Math.PI * 2 + 0.9);
      ctx.stroke();

      for (let i = 0; i < 8; i += 1) {
        const code = ASSETS[i].code;
        const on = focused.has(code);
        const angle = spin * Math.PI * 2 + (i * Math.PI * 2) / 8;
        const x = Math.cos(angle) * radius * 1.16;
        const y = Math.sin(angle) * radius * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, on ? 3.2 : 1.9, 0, Math.PI * 2);
        ctx.fillStyle = on ? "rgba(255, 184, 77, 0.98)" : "rgba(95, 228, 255, 0.82)";
        ctx.shadowColor = on ? "rgba(255, 184, 77, 0.9)" : "rgba(95, 228, 255, 0.8)";
        ctx.shadowBlur = on ? 10 : 5;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function loop(now) {
      if (document.hidden || !inView) {
        raf = 0;
        return;
      }
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    hologramDraw = draw;
    resize();
    draw(performance.now());
    start();

    if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(host);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    if (root.dataset.embed === "true" && typeof IntersectionObserver === "function") {
      new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (inView) start();
        else stop();
      }, { threshold: 0 }).observe(root);
    }
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const embedded = root.dataset.embed === "true" || params.get("embed") === "1";
    root.dataset.embed = embedded ? "true" : "false";
    root.innerHTML = pageTemplate(embedded);

    const controlsHost = root.querySelector("[data-map-controls-host]");
    const boardHost = root.querySelector("[data-map-board-host]");
    if (!controlsHost || !boardHost) return;
    controlsHost.innerHTML = controlsTemplate();
    boardHost.innerHTML = boardTemplate();

    setState("all", null);
    if (root.dataset.embed !== "true") initHologram();
    scheduleDraw();

    root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-map-asset], [data-map-pair], [data-map-lane], [data-map-reset]");
      if (!target || !root.contains(target)) return;
      if (target.hasAttribute("data-map-reset")) {
        setState("all", null);
        return;
      }
      const pairCode = target.dataset.mapPair;
      if (pairCode) {
        if (state.type === "pair" && state.id === pairCode) setState("all", null);
        else setState("pair", pairCode);
        return;
      }
      const assetCode = target.dataset.mapAsset || target.dataset.mapLane;
      if (!assetCode) return;
      if (state.type === "asset" && state.id === assetCode) setState("all", null);
      else setState("asset", assetCode);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.type !== "all") setState("all", null);
    });

    const board = root.querySelector("[data-map-board]");
    if (board && typeof ResizeObserver === "function") {
      new ResizeObserver(scheduleDraw).observe(board);
    }
    window.addEventListener("resize", scheduleDraw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDraw).catch(() => {});
  }

  init();
})();
