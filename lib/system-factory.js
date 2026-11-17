// The interactive factory: the eight-asset trading system drawn as a Three.js scene.
//
// Loaded by lib/system-map.js, and only when the Architecture tab is opened in a browser that reports WebGL.
// The scene takes its asset names, status labels and engine copy from window.SystemMapModel - the same data the
// flat board draws - and adds the geometry, the two guided journeys and the station inspector. Nothing here asks
// the network for anything: three.js is vendored at lib/vendor/three.min.js, and every inspector link points at a
// committed path, which is what GitHub Pages serves from the repository root.
//
// The inspector links code, logic documents, research documents and the two public summaries under
// docs/dashboard-design/. It does not link the operator material - the VPS access handoff, the host specification,
// the lane runbook and the account-terms guide - nor the collector exports, because those carry a host, an address,
// login references, deployment steps, provider endpoints and credential references. Those files stay in the
// repository for the operator; the map does not send a visitor into them.
//
// The factory is an illustration of the repository's documented architecture. It carries no live call, order,
// balance or account data, and the dotted payout step is conditional and not automated.
(function initSystemFactory() {
  "use strict";

  // ---------------------------------------------------------------- geometry
  // X runs with the flow: data on the left, execution on the right. Z is one lane per asset. No lane may meet
  // another before the Layer 2 junction, which is the only place in this geometry where two lanes join.
  const X = Object.freeze({
    feed: -40,
    research: -24,
    replay: -8,
    gate: 2,
    core: 12,
    join: 26,
    vps: 38,
    lane: 48,
    payout: 58,
    bank: 66
  });
  const LANE_GAP = 9.4;
  const laneZ = index => (index - 3.5) * LANE_GAP;
  const PORT_Y = 2.4;
  const LOWER_Y = -26;
  const LOWER_X = Object.freeze({
    inputs: -42,
    research: -26,
    replay: -10,
    workflow: 10,
    join: 18,
    vps: 32,
    payout: 52,
    lane: 58
  });
  const ORDER = ["USD", "EUR", "GOLD", "SILVER", "NQ", "BTC", "WTI", "GBP"];

  // The lower floor sorts every node by what the repository shows about it, not by whether it is finished.
  // Runtime: a committed file is read at run time. Replay: a committed run artefact exists. Research: a
  // committed research document, not a deployed input. Planned: no implementation is committed.
  const EVIDENCE = Object.freeze({
    runtime: { color: 0x39d6a8, label: "Runs today", short: "Runs today", note: "a committed file is read at run time" },
    replay: { color: 0x8fb8ff, label: "Replay evidence", short: "Replay", note: "a committed replay runner or result exists" },
    documented: { color: 0xffc46b, label: "Documented only", short: "Documented", note: "a checked-in document or export, not a runtime trace" },
    research: { color: 0xb18cff, label: "Research only", short: "Research", note: "a research paper, not an operational input" },
    planned: { color: 0x8a97a8, label: "Planned or missing", short: "Planned", note: "no implementation is committed" }
  });
  const FLOOR_NOTES = Object.freeze({
    whole: "Both floors · upper analysis above, lower inputs and evidence below",
    upper: "Upper floor · the analysis, decision and execution lane",
    lower: "Lower floor · inputs, rules, replays and workflows · select a node"
  });

  // ---------------------------------------------------------------- evidence
  // One row per asset. A missing key means the artefact is not in this checkout, and the inspector says so
  // instead of pointing at a folder that does not hold it. Every path below is a committed file.
  const ARTEFACTS = {
    USD: {
      collector: "exports/usd_collector.json",
      engine: "exports/usd_layer1_agent.json",
      logic: "logic/agent_usd_direction.md",
      engineDoc: "docs/analysis-engine/USD_LAYER1_LOGIC.md",
      builder: "backtester/builders/usd/build_usd_historical_snapshots.js",
      replay: "backtester/replay/usd/run_usd_historical_replay.js",
      replayCore: "backtester/replay/usd/usd_replay_core.js",
      replayReadme: "backtester/replay/usd/README.md",
      importSpec: "backtester/docs/usd_import_format_spec.md",
      register: "docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md",
      registerJson: "docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.json",
      researchStart: "docs/research/handoff/usd/v1/START_HERE.md",
      systemContext: "docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md",
      library: "data/research-library/catalog.json"
    },
    EUR: {
      collector: "exports/eur_collector.json",
      engine: "exports/eur_layer1_agent.json",
      logic: "logic/agent_eur_direction.md",
      builder: "backtester/builders/eur/build_eur_historical_snapshots.js",
      replay: "backtester/replay/eur/run_eur_historical_replay.js",
      replayCore: "backtester/replay/eur/eur_replay_core.js",
      workflow: "workflows/eur_layer1_agent.md"
    },
    GOLD: {
      collector: "exports/gold_collector.json",
      engine: "exports/gold_layer1_agent.json",
      logic: "logic/agent_gold_direction.md",
      builder: "backtester/builders/gold/build_gold_historical_snapshots.js",
      replay: "backtester/replay/gold/run_gold_historical_replay.js",
      replayCore: "backtester/replay/gold/gold_replay_core.js",
      decision: "backtester/docs/gold_source_decision.md"
    },
    SILVER: {
      collector: "exports/silver_collector.json",
      engine: "exports/silver_layer1_agent.json",
      logic: "logic/agent_silver_direction.md",
      workflow: "workflows/silver_layer1_agent.md",
      progress: "docs/DEEPSEEK_SILVER_PROGRESS.md"
    },
    NQ: {
      collector: "exports/nq_collector.json",
      engine: "exports/nq_layer1_agent.json",
      logic: "logic/agent_nq_direction.md",
      builder: "backtester/builders/nq/build_nq_historical_snapshots.js",
      replay: "backtester/replay/nq/run_nq_historical_replay.js",
      replayCore: "backtester/replay/nq/nq_replay_core.js"
    },
    BTC: {
      collector: "exports/btc_collector.json",
      engine: "exports/btc_layer1_agent.json",
      logic: "logic/agent_btc_direction.md",
      builder: "backtester/builders/btc/build_btc_historical_snapshots.js",
      replay: "backtester/replay/btc/run_btc_historical_replay.js",
      replayCore: "backtester/replay/btc/btc_replay_core.js",
      handover: "docs/BTC_HANDOVER_CUMULATIVE.md"
    },
    WTI: {
      logic: "logic/agent_wti_direction.md"
    },
    GBP: {
      logic: "logic/agent_gbp_direction.md"
    }
  };

  // The two public summaries this lane added under docs/dashboard-design/. Both are written for a visitor: they
  // keep the three USD factor sets apart, and they describe the execution path without a host, an account or a
  // deployment step.
  const SUMMARIES = {
    factorSets: "docs/dashboard-design/usd-factor-sets.md",
    executionPath: "docs/dashboard-design/execution-path-summary.md",
    executionFloor: "docs/dashboard-design/execution-floor.md",
    flows: "docs/dashboard-design/n8n-agent-flows.md",
    libraries: "docs/dashboard-design/replay-libraries.md"
  };

  // ---------------------------------------------------------------- factors
  // Set A: the ten factors the deployed USD engine computes, transcribed from the baseline audit in the factor
  // register. Each row keeps the register's own status words so a visitor can see that research, review and
  // backtest are three separate states - and that none of the ten has been tested by a replay.
  //
  // `weight` is the deployed book's own pair of numbers (coded 24h / rulebook). `challenger` is a separate field
  // because the historical challenger does not use the same scale: it gives each shared-source family one unit of
  // say. Set B, the 25-factor research programme, is the research-library catalogue; the inspector links it rather
  // than inventing rows for it here.
  const FACTORS = [
    {
      id: "live.f1-vix-level",
      folder: "live-f1-vix-level",
      code: "F1",
      name: "VIX level and risk regime",
      status: "research ready · review pending · backtest not tested",
      weight: "10 coded / 10 rulebook",
      rule: "VIX above 25 reads BULLISH, 16 to 25 NEUTRAL, below 16 BEARISH. Level only, thresholds 25 and 16.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F1",
      challenger: "One unit of say in the challenger's risk family, split 0.5 for the level and 0.5 for the five-day change."
    },
    {
      id: "live.f2-us-2y-delta",
      folder: "live-f2-us-2y-delta",
      code: "F2",
      name: "US 2Y yield delta",
      status: "research ready · review pending · backtest not tested",
      weight: "14 coded / 14 rulebook",
      rule: "At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, otherwise NEUTRAL.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F2",
      challenger: "One unit of say in the challenger's US front-end family."
    },
    {
      id: "live.f3-us-de-2y-spread-delta",
      folder: "live-f3-us-de-2y-spread-delta",
      code: "F3",
      name: "US-DE 2Y spread delta",
      status: "research ready · review pending · backtest not tested",
      weight: "10 coded / 16 rulebook",
      rule: "At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, on one fixed five-day window.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F3",
      challenger: "Not scored: the German leg is missing data, and the pairs are accounted under the FX-session factor instead."
    },
    {
      id: "live.f4-real-yield-delta",
      folder: "live-f4-real-yield-delta",
      code: "F4",
      name: "US 10Y real yield delta",
      status: "research ready · review pending · backtest not tested",
      weight: "10 coded / 14 rulebook",
      rule: "At or above +5 bps reads BULLISH, at or below -5 bps BEARISH, on the lookback the timeframe selects.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F4",
      challenger: "One unit of say in the challenger's US real-yield family."
    },
    {
      id: "live.f5-dxy-delta",
      folder: "live-f5-dxy-delta",
      code: "F5",
      name: "DXY delta",
      status: "research ready · review pending · backtest not tested",
      weight: "14 coded / 6 rulebook",
      rule: "On 24h: at or above +0.15 per cent BULLISH, at or below -0.15 per cent BEARISH. On every other timeframe the band is +/- 0.30 per cent.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F5 = signalFromDelta(dxyDelta, tf === '24h' ? 0.15 : 0.3, ...)",
      challenger: "One unit of say in the challenger's broad-dollar family: a five-day move of a broad dollar index at a 0.15 per cent band, with FRED DTWEXBGS declared as the stand-in for ICE DXY. The challenger never uses the 14 or the 6."
    },
    {
      id: "live.f6-gold-delta",
      folder: "live-f6-gold-delta",
      code: "F6",
      name: "Gold delta",
      status: "research ready · review pending · backtest not tested",
      weight: "4 coded / 5 rulebook",
      rule: "Gold below -0.1 per cent reads BULLISH, above +0.1 per cent BEARISH, inside the band NEUTRAL.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F6",
      challenger: "One unit of say in the challenger's gold family."
    },
    {
      id: "live.f7-economic-surprise",
      folder: "live-f7-economic-surprise",
      code: "F7",
      name: "US economic surprise",
      status: "research blocked · review pending · backtest not tested",
      weight: "24 coded / 3 rulebook",
      rule: "The stored event string is read unexamined: BULLISH reads BULLISH, BEARISH reads BEARISH, anything else NEUTRAL. No threshold, no magnitude.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F7",
      challenger: "Not scored: the challenger was built only from factors that have an executable rule, and F7's research is blocked."
    },
    {
      id: "live.f8-fed-bias",
      folder: "live-f8-fed-bias",
      code: "F8",
      name: "Fed bias",
      status: "research blocked · review pending · backtest not tested",
      weight: "12 coded / 18 rulebook",
      rule: "A string containing hawkish reads BULLISH, dovish BEARISH, neutral NEUTRAL; unknown scores NEUTRAL as a missing input.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F8",
      challenger: "Not scored: the challenger was built only from factors that have an executable rule, and F8's research is blocked."
    },
    {
      id: "live.f9-dollar-smile",
      folder: "live-f9-dollar-smile",
      code: "F9",
      name: "Dollar Smile regime",
      status: "research ready · review pending · backtest not tested",
      weight: "1 coded / 12 rulebook",
      rule: "VIX above 25 reads BULLISH; VIX below 16 without a hawkish bias string reads BEARISH; every other case NEUTRAL.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F9",
      challenger: "Not scored: the USD/JPY mirror is attributed to FX session momentum instead of the Dollar Smile."
    },
    {
      id: "live.f10-equity-versus-usd",
      folder: "live-f10-equity-versus-usd",
      code: "F10",
      name: "Equity versus USD",
      status: "research ready · review pending · backtest not tested",
      weight: "1 coded / 2 rulebook",
      rule: "VIX below 16 with NQ up reads BEARISH; VIX below 16 with NQ down BULLISH; VIX above 25 with NQ down BULLISH; every other case NEUTRAL.",
      codePath: "exports/usd_layer1_agent.json → Calculate USD Conviction → signals.F10",
      challenger: "One unit of say in the challenger's equities family."
    }
  ];

  // ---------------------------------------------------------------- tests
  // The four test sets the USD replay is asked for. The scene exposes them one at a time so a visitor can see
  // what each one measures instead of reading a single combined score.
  const TESTS = [
    {
      id: "dxy",
      code: "T1",
      name: "DXY directional accuracy",
      measures: "How often the USD call agrees with the next-move direction of the broad dollar index.",
      inputs: "dxy_level, dxy_d1, dxy_d5 and dxy_d20 from the USD collector snapshot, read through F5 DXY Delta inside the ten-factor book.",
      evidence: [
        ["backtester/replay/usd/usd_replay_core.js", "backtester/replay/usd/usd_replay_core.js"],
        ["backtester/replay/usd/README.md", "backtester/replay/usd/README.md"]
      ],
      open: "The replay prints the comparison; no stored result is committed in this checkout."
    },
    {
      id: "four-market",
      code: "T2",
      name: "Four-market performance",
      measures: "The opposite-move rate on EUR/USD, gold, BTC/USD and NAS100 when the USD call is directional.",
      inputs: "The USD snapshot plus each market's own daily series from the historical builders.",
      evidence: [
        ["backtester/lib/outcome_direction.js", "backtester/lib/outcome_direction.js"],
        ["backtester/docs/historical_outcome_evaluation.md", "backtester/docs/historical_outcome_evaluation.md"]
      ],
      open: "The evaluation rules are documented; no per-market result is committed in this checkout."
    },
    {
      id: "full-5r",
      code: "T3",
      name: "Full-level L2L results at 5R",
      measures: "The trading result of the marked ladder at a five-to-one reward, the geometry lib/l2l_strategy.js calls REWARD_R_MULTIPLE.",
      inputs: "Marked levels from data/l2l-levels.json, M5 bars from data/live-trading.json, and the USD book as the directional filter.",
      evidence: [
        ["lib/l2l_strategy.js", "lib/l2l_strategy.js"],
        ["lib/l2l_sizing.js", "lib/l2l_sizing.js"],
        [SUMMARIES.executionPath, "Execution path summary"]
      ],
      open: "The ladder rule is implemented; the replay result at 5R is not committed in this checkout."
    },
    {
      id: "half-3r",
      code: "T4",
      name: "Half-level L2L results at 3R",
      measures: "The same rule on the half grid, one midpoint inserted between every pair of marked levels, at three to one - HALF_LANE_R_MULTIPLE.",
      inputs: "The same levels and bars, read through the half grid in lib/l2l_strategy.js.",
      evidence: [
        ["lib/l2l_strategy.js", "lib/l2l_strategy.js"],
        ["lib/l2l_ladder.js", "lib/l2l_ladder.js"],
        [SUMMARIES.executionPath, "Execution path summary"]
      ],
      open: "The half lane is described and reviewed; the replay result at 3R is not committed in this checkout."
    }
  ];

  // ---------------------------------------------------------------- journeys
  // Two journeys must run end to end. Each step names the station the camera moves to, the copy the stepper
  // shows, and an optional panel the step opens (the factor register, the four tests, the pair output, the lanes).
  const JOURNEYS = [
    {
      id: "usd-research",
      label: "USD research journey",
      note: "Inputs → research → red team → adjudication → factor register → the four replay tests → the L1 core.",
      steps: [
        {
          station: "usd.feed",
          title: "Start where the USD inputs arrive",
          body: "The USD collector writes one normalised snapshot per pipeline run: VIX, US 2Y, the US-DE 2Y spread, the US 10Y real yield, DXY, gold, NQ, the stored event string and the Fed bias string. Every later USD number is built from that row, so this station is the only place the model touches the outside world."
        },
        {
          station: "usd.research",
          title: "Research writes the brief for each factor",
          body: "Each of the ten factors has a research prompt that states what the factor claims, which series it reads and what would falsify it. The research card is written from that prompt, not from the deployed weight."
        },
        {
          station: "usd.research",
          title: "Red team attacks the brief",
          body: "A second prompt asks a reviewer to attack the same factor: overlap with the other nine, stale or vintage-blind inputs, and every place the code and the rulebook disagree. The red-team pass is committed beside the brief."
        },
        {
          station: "usd.research",
          title: "Adjudication settles the rule",
          body: "A third prompt adjudicates between the brief and the attack. The outcome is one of three states per factor - research ready, research blocked, review pending - and the register records them exactly as they stand today."
        },
        {
          station: "usd.research",
          title: "Open the factor register and pick a documented factor",
          panel: "factors",
          body: "The register is the catalogue of what the deployed engine computes. Choose a factor to follow its rule into the engine code, its status words, and the three prompts that produced its evidence. The research programme registers 25 chains in its own catalogue, and the panel links both."
        },
        {
          station: "usd.replay",
          title: "The replay chamber runs four separate tests",
          panel: "tests",
          body: "The replay does not report one score. DXY direction, four-market performance, the full ladder at 5R and the half ladder at 3R are asked separately, because a rule can pass one and fail another. The replay compares the current ten-factor book with the implemented challenger: nine mechanisms over seven shared-source families, one unit of say each, built only from factors that have an executable rule."
        },
        {
          station: "usd.core",
          title: "The L1 core turns the book into one call",
          body: "The engine weights the ten factors, sums the bullish and the bearish weight, and publishes one raw USD call per timeframe with a conviction number. It makes no pair call and no trade call: its only output is a direction."
        },
        {
          station: "gate",
          title: "Validation stands between a rule and a live engine",
          body: "A replay result is evidence, not deployment. A rule that changes the live engine has to be reviewed, shadowed and accepted, and this is the station where that happens. Nothing on this map claims a rule has passed it."
        },
        {
          station: "join",
          title: "Only Layer 2 is allowed to join two assets",
          body: "The USD call leaves its own lane at the junction. Layer 2 pairs it with a target asset only when the two 24H calls point in opposite directions. USD is the quote leg of every pair, so it is the one lane every pair reads."
        }
      ]
    },
    {
      id: "eurusd-execution",
      label: "EUR/USD execution journey",
      note: "Two independent calls → the Layer 2 join → the pair output → the VPS → two live FTMO lanes → the conditional payout step.",
      steps: [
        {
          station: "eur.core",
          title: "EUR produces its own call, with no knowledge of USD",
          body: "The EUR engine reads ECB bias, the German 2Y, the US-DE spread, the eurozone surprise, PMI, its own price and four risk inputs. It publishes one raw EUR call per timeframe and never reads the USD lane."
        },
        {
          station: "usd.core",
          title: "USD produces its own call in a separate lane",
          body: "The USD engine is unchanged by this pairing. Its ten factors produce one raw USD call per timeframe from its own inputs, and it never reads the EUR lane."
        },
        {
          station: "join",
          title: "Layer 2 compares the two 24H calls",
          body: "The join reads the target call and the quote call. It acts only when the target is BULLISH and USD BEARISH, or the reverse. Same direction is not a trade, and neither is a non-directional call: the pair is skipped, not forced."
        },
        {
          station: "join",
          title: "The pair output is a direction and a confidence",
          panel: "pair",
          body: "When the calls disagree, Layer 2 emits BUY or SELL on the pair. The combined confidence is the lower of the two Layer 1 confidences, so a strong EUR call cannot lift a weak USD call. This is the only join in the architecture."
        },
        {
          station: "vps",
          title: "The VPS turns one pair output into orders",
          body: "The execution terminal reads the pair output, the marked levels and the M5 bars, and places the bracket on the account. It runs on the VPS, not in this browser, and this page never touches it."
        },
        {
          station: "lane.full",
          title: "Lane 1 trades the marked ladder at 5R",
          panel: "lanes",
          body: "The first live account trades the marked levels as they stand: the target is the next marked level, and the stop is set so the reward is five times the risk. REWARD_R_MULTIPLE in lib/l2l_strategy.js is that number."
        },
        {
          station: "lane.half",
          title: "Lane 2 trades a half grid at 3R",
          body: "The second account trades the same rule on a half grid, with one midpoint inserted between every pair of marked levels. The target is nearer, so the geometry is three to one - HALF_LANE_R_MULTIPLE - and the two lanes hold different tickets on the same idea."
        },
        {
          station: "payout",
          title: "Profit can only leave through an approved payout",
          body: "The dotted route is conditional. Money leaves a trading account only through an approved payout, and that step is not automated by this repository: no payout workflow, transfer rule or bank instruction is committed here."
        },
        {
          station: "bank",
          title: "The illustration ends outside the trading loop",
          body: "A personal bank account is the end of the illustration, not a component of the system. Nothing on this map is connected to it, and the dashboard holds no account or banking detail."
        }
      ]
    },
    {
      id: "execution-floor",
      label: "VPS floor journey",
      note: "The VPS → three FTMO traders → the blind trader's own data and M5 path → the separate cTrader component and its evidenced state.",
      steps: [
        {
          station: "vps",
          title: "One host, three traders",
          body: "The VPS hosts the live floor: two traders read the pair output and the marked ladder, and a third trades without either. The cTrader robot is drawn beside them because it is not an MT5 loop."
        },
        {
          station: "lane.full",
          title: "FTMO 1 trades the original ladder at 5R",
          panel: "lanes",
          body: "Live L2L Directional on the original levels. The target is the next marked level and the stop is one fifth of that distance, so the reward is five times the risk."
        },
        {
          station: "lane.half",
          title: "FTMO 2 trades a half grid at 3R",
          body: "Live 0.5L2L Directional on half levels: one midpoint is inserted between every pair of originals, the target is nearer and the geometry is three to one."
        },
        {
          station: "lane.blind.feed",
          title: "The blind trader brings its own market data",
          body: "FTMO 3 reads the M5 bars from its own terminal. That feed is not the snapshot store, and no Layer 1 agent reads it, which is the first reason this lane can trade without a directional call."
        },
        {
          station: "lane.blind.deviation",
          title: "Its entry is an M5 deviation, not a Layer 1 call",
          body: "The robot brackets the bid with the nearest original levels, then takes the direction of a completed M5 candle that crosses one boundary by a tick. The target is the next level and the risk is one fifth of that distance."
        },
        {
          station: "lane.blind",
          title: "FTMO 3 holds a 5R ticket no junction produced",
          body: "The third trader is connected but unarmed: no strategy heartbeat is published for it and its trader task is disabled. One closed trade is labelled a connection test and kept out of the lane's figures."
        },
        {
          station: "relay.ctrader",
          title: "The cTrader component is separate, and its authorisation is pending",
          body: "The repository commits an independent line-to-line robot for cTrader, with orders disabled until a simulated fill verifies entry, stop and target. No relay that copies another lane's accepted orders is documented here, so the map draws none."
        }
      ]
    }
  ];

  // ---------------------------------------------------------------- stations
  // Every station answers the same five questions. The copy is built from the model the flat board already
  // carries (reads, writes, gate, backtest, note) plus the artefact table, so the two views cannot drift.
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function assetStations(model) {
    const stations = [];
    model.assets.forEach((asset, index) => {
      const art = ARTEFACTS[asset.code] || {};
      const code = asset.code;
      const prefix = code.toLowerCase();
      const lane = laneZ(index);
      const onboarding = asset.status === "onboarding";
      const researched = code === "USD";

      stations.push({
        id: `${prefix}.feed`,
        kind: "feed",
        asset: code,
        label: `${code} feed`,
        sub: "incoming data",
        status: asset.status,
        statusLabel: asset.statusLabel,
        pos: [X.feed, 3.4, lane],
        port: [X.feed, PORT_Y, lane],
        does: `Writes one normalised ${asset.name} snapshot per pipeline run. Every later ${code} number is built from this row, so this is the only station in the lane that touches the outside world.`,
        receives: `The public series and market quotes the collector reads: ${asset.reads}.`,
        receivesFrom: art.collector
          ? "The collector workflow, as exported to the repository, and the historical importers behind it."
          : "No collector export for this asset is committed in this checkout, so the input list is taken from the logic document only.",
        tools: [
          art.builder && [art.builder, "Historical snapshot builder"],
          art.workflow && [art.workflow, "Collector webhook document"],
          art.importSpec && [art.importSpec, "USD import format spec"]
        ].filter(Boolean),
        governs: [
          ["docs/HISTORICAL_DATA_INVENTORY.md", "Historical data inventory"]
        ],
        rules: art.collector
          ? [
              "One row per pipeline run. The snapshot is a stored observation, not a streaming tick, and it carries no live market data.",
              `The collector export ${art.collector} is committed to the repository but not linked here: it carries provider endpoints and credential references, so operator detail stays out of the inspector.`
            ]
          : ["One row per pipeline run. The snapshot is a stored observation, not a streaming tick, and it carries no live market data."],
        produces: `The ${code} input pack: one stored row holding every input above plus the missing-input list.`,
        consumer: `The ${code} research desk quotes it, the ${code} replay chamber replays it, and the ${code} L1 core reads it at run time.`,
        undocumented: art.collector
          ? []
          : [`No collector export, historical builder or import format for ${code} is committed in this checkout.`]
      });

      stations.push({
        id: `${prefix}.research`,
        kind: "research",
        asset: code,
        label: `${code} research desk`,
        sub: researched ? "brief · red team · adjudication" : "logic document",
        status: asset.status,
        statusLabel: asset.statusLabel,
        pos: [X.research, 3.1, lane],
        port: [X.research, PORT_Y, lane],
        does: researched
          ? "Writes the research brief, the red-team attack and the adjudication for each of the ten factors the deployed engine computes."
          : `Holds the ${code} logic document the engine runs from. ${onboarding ? "The document is a research draft, not a validated rule." : "The document is a production baseline candidate."}`,
        receives: researched
          ? "The deployed baseline weights, the historical snapshots, and the open questions recorded against each factor."
          : "The deployed baseline and the published input pack.",
        receivesFrom: researched
          ? "The factor register and the USD research handoff pack."
          : "The collector row and the logic document itself.",
        tools: researched
          ? [
              [SUMMARIES.factorSets, "Three factor sets: deployed, programme, challenger"],
              ["docs/research/factors/usd/live-f1-vix-level/01-research-prompt.md", "Factor research packs (one folder per factor; F1 shown)"],
              ["docs/research/handoff/usd/v1/START_HERE.md", "Research handoff: start here"],
              ["docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md", "USD system context"],
              ["data/research-library/catalog.json", "Research library catalogue: the 25 registered chains"]
            ]
          : [
              art.logic && [art.logic, `${code} logic document`],
              art.workflow && [art.workflow, "Workflow document"]
            ].filter(Boolean),
        governs: researched
          ? [
              ["docs/CORE_RESEARCH_PHILOSOPHY.md", "Core research philosophy"],
              ["backtester/schema/observation-first-research-schema.md", "Observation-first research schema"]
            ]
          : [[art.logic, `${code} logic document`]].filter(row => row[0]),
        rules: researched
          ? [
              "A factor is researched, reviewed and adjudicated as three separate passes; readiness in one does not imply the others.",
              "Three factor sets meet at this desk and are kept apart: the deployed book computes ten factors, the research programme registers twenty-five chains, and the historical challenger scores nine mechanisms over seven shared-source families."
            ]
          : [`The ${code} weights are ${onboarding ? "hypotheses in a draft" : "a baseline"}, and no factor-level review of them is committed.`],
        produces: researched
          ? "Ten research cards with their red-team reviews and adjudications, plus the 25-chain research library catalogue."
          : `The ${code} logic document: the rule text the engine follows.`,
        consumer: researched
          ? "The factor register records each outcome, and the replay chamber quotes the same evidence."
          : `The ${code} L1 core, which fetches the document on every run.`,
        undocumented: researched
          ? ["No replay has been run against any of the ten factors: every register row reads backtest not tested."]
          : [`No research prompt, red-team prompt or adjudication for ${code} is committed in this checkout.`]
      });

      const hasReplay = Boolean(art.replay);
      stations.push({
        id: `${prefix}.replay`,
        kind: "replay",
        asset: code,
        label: `${code} replay chamber`,
        sub: code === "USD" ? "four tests" : hasReplay ? "runner only" : "not built",
        status: asset.status,
        statusLabel: asset.statusLabel,
        pos: [X.replay, 3.0, lane],
        port: [X.replay, PORT_Y, lane],
        does: code === "USD"
          ? "Replays the USD historical snapshots and reports four separate test sets instead of one score."
          : hasReplay
            ? `Replays the ${code} historical snapshots through the ${code} replay core.`
            : `Nothing is replayed for ${code} yet: the chamber is empty.`,
        receives: `The historical ${code} snapshots, rebuilt row by row, and the current factor weights.`,
        receivesFrom: hasReplay
          ? "The historical builders and the market importers under backtester/."
          : "No builder exists for this asset.",
        tools: [
          art.replay && [art.replay, `${code} replay runner`],
          art.replayCore && [art.replayCore, `${code} replay core`],
          art.replayReadme && [art.replayReadme, "USD replay notes"],
          art.builder && [art.builder, "Historical snapshot builder"],
          ["docs/backtester_master_logic.md", "Backtester master logic"]
        ].filter(Boolean),
        governs: [
          ["docs/backtester_master_logic.md", "Backtester master logic"],
          art.replayReadme && [art.replayReadme, "Replay readme"]
        ].filter(Boolean),
        rules: code === "USD"
          ? [
              "The replay compares the deployed ten-factor book with the implemented challenger: nine mechanisms over seven shared-source families, one unit of say each, built only from factors that have an executable rule.",
              "No replay uses all 25 registered factors. The programme registered 25; the deployed model scores ten; the challenger scores six of those ten plus one research factor."
            ]
          : [`No ${code} replay rule is documented beyond the shared backtester master logic.`],
        produces: code === "USD"
          ? "One replay report per run: DXY direction, four-market performance, full L2L at 5R and half L2L at 3R."
          : hasReplay
            ? `A ${code} replay report per run.`
            : `Nothing: no ${code} replay runner exists.`,
        consumer: "The validation gate, which decides whether anything downstream may change.",
        undocumented: code === "USD"
          ? ["The replay prints its comparison, but no stored replay result is committed in this checkout."]
          : hasReplay
            ? [`A ${code} replay runner is committed, but no ${code} replay result is documented in this checkout.`]
            : [`No historical builder, replay runner or replay result for ${code} is committed in this checkout.`]
      });

      stations.push({
        id: `${prefix}.core`,
        kind: "core",
        asset: code,
        label: `${code} L1 core`,
        sub: onboarding ? "planned engine" : "independent engine",
        status: asset.status,
        statusLabel: asset.statusLabel,
        pos: [X.core, 3.8, lane],
        port: [X.core, PORT_Y, lane],
        does: `Computes one raw ${code} directional call per timeframe from its own inputs. It reads no other asset and makes no pair call.`,
        receives: asset.reads,
        receivesFrom: `Its own ${code} input pack. Nothing from another lane reaches this station.`,
        tools: [
          art.engine && [art.engine, `${code} Layer 1 Agent workflow`],
          art.logic && [art.logic, `${code} logic document`],
          art.engineDoc && [art.engineDoc, "USD Layer 1 logic dossier"]
        ].filter(Boolean),
        governs: [
          art.logic && [art.logic, `${code} decision rules`],
          art.register && [art.register, "USD factor register"],
          art.engineDoc && [art.engineDoc, "USD Layer 1 logic dossier"]
        ].filter(Boolean),
        rules: [asset.gate],
        produces: asset.writes,
        consumer: "The Layer 2 junction, and nothing else. A raw call is never a trade.",
        undocumented: []
          .concat(art.engine ? [] : [`No ${code} Layer 1 Agent export is committed in this checkout; the logic document is the only artefact.`])
          .concat(onboarding ? [`The ${code} weights are research-stage: no replay and no checker validation is recorded.`] : [])
      });
    });
    return stations;
  }

  // ---------------------------------------------------------------- lower floor
  // The lower floor answers the question the upper floor cannot: what does each station stand on? A node is
  // drawn once per asset for its stored input, its rulebook, its replay evidence and its documented workflow,
  // plus the shared paths and the USD research archive. Evidence is a property of the node, not a colour that
  // implies health, so a documented-only workflow is never shown as a live run.
  function dependencyStations(model) {
    const deps = [];
    const add = fields => {
      const evidence = fields.evidence || "documented";
      const info = EVIDENCE[evidence] || EVIDENCE.documented;
      deps.push(Object.assign({
        kind: "dependency",
        status: "shared",
        statusLabel: "Dependency",
        sub: "lower floor",
        height: 2.0,
        depKind: "document",
        depStage: "platform",
        evidence,
        evidenceLabel: info.label,
        evidenceShort: info.short || info.label,
        evidenceNote: info.note,
        facts: [["Evidence", fields.evidenceLabel || info.label], ["Floor", "Lower"]]
      }, fields));
    };

    model.assets.forEach((asset, index) => {
      const code = asset.code;
      const prefix = code.toLowerCase();
      const lane = laneZ(index);
      const art = ARTEFACTS[code] || {};
      const hasReplay = Boolean(art.replay);
      const hasWorkflow = Boolean(art.workflow || art.engine);
      const hasCollector = Boolean(art.collector);
      const onboarding = asset.status === "onboarding";
      const isUsd = code === "USD";
      add({
        id: `dep.${prefix}.inputs`,
        asset: code,
        depStage: "inputs",
        depKind: "storage",
        label: `${code} input store`,
        short: "Inputs",
        pos: [LOWER_X.inputs, LOWER_Y, lane],
        height: hasCollector ? 2.2 : 1.7,
        evidence: hasCollector ? "runtime" : "planned",
        evidenceLabel: hasCollector ? "Stored input" : "No stored input",
        supports: [`${prefix}.feed`],
        does: `Holds the ${code} snapshot rows the lane reads: one observation per run, with the inputs it could not supply.`,
        receives: `The collector's ${code} row${hasCollector ? ", as the committed collector export describes it" : " (no collector export is committed)"} and the historical importer where one exists.`,
        receivesFrom: `The ${code} collector workflow and the historical snapshot builder.`,
        tools: [
          art.collector && [art.collector, "Collector export"],
          art.builder && [art.builder, "Historical snapshot builder"],
          art.importSpec && [art.importSpec, "Import format"]
        ].filter(Boolean),
        governs: [
          ["docs/HISTORICAL_DATA_INVENTORY.md", "Historical data inventory"],
          art.importSpec && [art.importSpec, "Import format"]
        ].filter(Boolean),
        rules: [
          "One observation per pipeline run: a row with a missing input is dropped, never partially scored.",
          `The ${code} lane reads only its own stored inputs and never another asset's.`
        ],
        produces: `A stored ${code} observation for the feed to expose, or an explicit missing-input list.`,
        consumer: `${code} feed, then every station above it.`,
        undocumented: []
          .concat(hasCollector ? [] : [`No ${code} collector export is committed in this checkout.`])
          .concat(onboarding ? [`The ${code} input pack is research-stage; no historical import exists for it.`] : [])
      });

      add({
        id: `dep.${prefix}.rules`,
        asset: code,
        depStage: "research",
        depKind: "document",
        label: `${code} rulebook`,
        short: "Rules",
        pos: [LOWER_X.research, LOWER_Y, lane],
        height: 2.3,
        evidence: "documented",
        evidenceLabel: "Documented rule",
        supports: [`${prefix}.core`, `${prefix}.research`],
        does: `Holds the ${code} rule text the engine fetches at run time: the factors, thresholds, invalidation and review gates.`,
        receives: `The reviewed ${code} logic and, for USD, the factor register and research handoff.`,
        receivesFrom: "Research and review, never the live feed.",
        tools: [
          art.logic && [art.logic, `${code} logic document`],
          art.engineDoc && [art.engineDoc, "Layer 1 logic dossier"],
          isUsd && [SUMMARIES.factorSets, "Three USD factor sets"],
          isUsd && [art.register, "USD factor register"]
        ].filter(Boolean),
        governs: [
          art.logic && [art.logic, `${code} decision rules`],
          isUsd && ["docs/CORE_RESEARCH_PHILOSOPHY.md", "Core research philosophy"],
          isUsd && [art.register, "USD factor register"]
        ].filter(Boolean),
        rules: isUsd
          ? [
              "Three factor sets share this lane and stay apart: the deployed book, the 25-chain research programme, and the historical challenger.",
              "The research programme is not an operational input: no factor in it is scored by the live USD engine."
            ]
          : [`The ${code} weights and gates are documented, and the engine reads this text on every run.`],
        produces: isUsd
          ? "The deployed ten-factor rule set, plus a register that marks every research outcome separately."
          : `The ${code} rule text the L1 core follows.`,
        consumer: `${code} L1 core; the research desk reads the same text for review.`,
        undocumented: isUsd
          ? ["No factor in the register has a replay result: every row reads backtest, not tested."]
          : [`No red-team review or adjudication for the ${code} rulebook is committed.`]
      });

      add({
        id: `dep.${prefix}.replay`,
        asset: code,
        depStage: "replay",
        depKind: "result",
        label: `${code} replay evidence`,
        short: isUsd ? "4 tests" : hasReplay ? "Replay" : "No replay",
        pos: [LOWER_X.replay, LOWER_Y, lane],
        height: hasReplay ? 1.9 : 1.5,
        evidence: hasReplay ? "replay" : "planned",
        evidenceLabel: hasReplay ? "Runner committed" : "No replay",
        supports: [`${prefix}.replay`],
        does: hasReplay
          ? `Scores the ${code} rules on stored historical snapshots and writes the run report the chamber above reads.`
          : `Nothing is scored for ${code}: the chamber above names the missing replay rather than a result.`,
        receives: `The rebuilt ${code} historical snapshots and the current factor weights.`,
        receivesFrom: "The historical builders and the market importers under backtester/.",
        tools: [
          art.replay && [art.replay, `${code} replay runner`],
          art.replayCore && [art.replayCore, `${code} replay core`],
          art.replayReadme && [art.replayReadme, "USD replay notes"],
          art.builder && [art.builder, "Historical snapshot builder"]
        ].filter(Boolean),
        governs: [
          [SUMMARIES.libraries, "Replay library design"],
          art.importSpec && [art.importSpec, "Import format"],
          art.replayReadme && [art.replayReadme, "Replay readme"]
        ].filter(Boolean),
        rules: isUsd
          ? [
              "Four USD tests are reported separately: DXY direction, the four-market call, the original L2L at 5R, and half L2L at 3R.",
              "The historical challenger is a frozen research experiment, not a validated candidate and not part of the deployed book."
            ]
          : hasReplay
            ? [`The ${code} replay runs the documented rule text, never a live call.`]
            : [`No ${code} replay rule is implemented beyond the shared replay logic.`],
        produces: isUsd
          ? "Four separate report lines, one per test. No single blended score is produced."
          : hasReplay
            ? `A ${code} replay report per run.`
            : `No ${code} replay report: the runner is missing.`,
        consumer: `${code} replay chamber and the validation gate.`,
        undocumented: []
          .concat(hasReplay ? ["No stored replay result is committed, so the runner is evidence of method, not of outcome."] : [])
          .concat(hasReplay ? [] : [`No historical builder, replay runner or replay result for ${code} is committed.`])
      });

      add({
        id: `dep.${prefix}.workflow`,
        asset: code,
        depStage: "workflow",
        depKind: "workflow",
        label: `${code} n8n workflow`,
        short: hasWorkflow ? "Workflow" : "No export",
        pos: [LOWER_X.workflow, LOWER_Y, lane],
        height: 2.1,
        evidence: hasWorkflow ? "documented" : "planned",
        evidenceLabel: hasWorkflow ? "Documented workflow" : "No workflow",
        supports: [`${prefix}.core`],
        does: hasWorkflow
          ? `Reads a stored snapshot, fetches the ${code} rulebook and writes one ${code} call row to agent_outputs.`
          : `No exported ${code} workflow is committed, so the core's run path is not drawn here.`,
        receives: `The ${code} input row and the rule text, with the run settings.`,
        receivesFrom: "The master orchestrator, or a manual run of the same flow.",
        tools: [
          [ "workflows/WORKFLOW_INVENTORY.md", "Workflow inventory" ],
          hasWorkflow && [art.workflow || art.engine, `${code} workflow export`],
          [SUMMARIES.flows, "Agent flow design"]
        ].filter(Boolean),
        governs: [
          [SUMMARIES.flows, "Agent flow design"],
          art.logic && [art.logic, `${code} rule text`],
          code === "USD" && ["workflows/master_orchestrator.md", "Master orchestrator (USD two-pass)"]
        ].filter(Boolean),
        rules: [
          "A checked-in export is a saved snapshot of a workflow, not proof that the live workspace runs it.",
          "One call row per run: the dashboard writer publishes what the run wrote, and the export is not a runtime trace."
        ],
        produces: hasWorkflow
          ? "One agent_outputs row per run, with the call, confidence and input snapshot reference."
          : "No exported run path for this lane.",
        consumer: "The Dashboard Writer, which publishes the row; the call is never an order.",
        undocumented: hasWorkflow
          ? ["No execution log is committed, so this is a documented workflow, not evidence of a live run."]
          : [`No ${code} workflow export is committed in this checkout.`]
      });
    });

    add({
      id: "dep.shared.pair",
      depStage: "platform",
      depKind: "rule",
      label: "Layer 2 pair rule",
      short: "Pair rule",
      pos: [LOWER_X.join, LOWER_Y, 0],
      height: 2.5,
      evidence: "documented",
      evidenceLabel: "Documented rule",
      supports: ["join"],
      does: "Turns the eight independent L1 calls into at most one pair call, by comparing a target asset with USD.",
      receives: "The target 24H call and the USD 24H call, each with its confidence.",
      receivesFrom: "The junction above, and no third lane.",
      tools: [
        ["backtester/lib/layer2_pair_logic.js", "Layer 2 pair logic"],
        ["exports/layer2_trade_selection_agent.json", "Layer 2 selection export"],
        ["lib/l2l_strategy.js", "L2L strategy"],
        ["docs/CALL_MAP_LAYER2_20261004.md", "Layer 2 call map"]
      ],
      governs: [
        ["docs/CALL_MAP_LAYER2_20261004.md", "Layer 2 call map"],
        ["docs/dashboard-design/architecture-factory-drilldowns.md", "Factory drill-down design"]
      ],
      rules: [
        "The junction is the only place where two lanes meet, and it reads exactly two calls.",
        "The original lane trades 5R and the second lane trades 3R; they are separate tests, never one blended score."
      ],
      produces: "One pair call, or no trade. A pair call is still not an order.",
      consumer: "Both L2L lanes and the execution floor.",
      undocumented: ["No pair-level replay result is committed: the pair logic is documented and tested, not proven live."],
      facts: [["Evidence", "Documented rule"], ["Output", "One pair call"]]
    });

    add({
      id: "dep.shared.exec",
      depStage: "platform",
      depKind: "rule",
      label: "L2L ladder & level store",
      short: "Ladder",
      pos: [LOWER_X.vps, LOWER_Y, 0],
      height: 2.7,
      evidence: "documented",
      evidenceLabel: "Documented path",
      supports: ["vps", "lane.full", "lane.half"],
      does: "Holds the marked L2L levels and the 5R and 3R ladder rules the execution lanes read before a bracket is placed.",
      receives: "The pair call, the marked levels and the M5 bars.",
      receivesFrom: "The level store and the market snapshot files; the half lane halves the original levels.",
      tools: [
        ["lib/l2l_strategy.js", "L2L strategy"],
        ["lib/l2l_ladder.js", "L2L ladder"],
        ["lib/l2l_levels_store.js", "Level store"],
        ["lib/l2l_sizing.js", "L2L sizing"],
        ["data/l2l-levels.json", "Marked level data"],
        ["docs/dashboard-design/execution-floor.md", "Execution floor design"],
        ["docs/dashboard-design/execution-path-summary.md", "Execution path summary"],
        ["docs/live-trading/SECOND_LANE_HALF_L2L.md", "Half L2L lane"]
      ],
      governs: [
        ["docs/research/pipeline/EXECUTION_ROUTE.md", "Execution route"],
        ["docs/dashboard-design/execution-floor.md", "Execution floor design"]
      ],
      rules: [
        "The full lane takes the original levels at 5R; the half lane takes half the level distance at 3R.",
        "A bracket is managed by the execution loop after entry; the dashboard never places or manages one."
      ],
      produces: "An entry, stop and target set for the full and half lanes, or no bracket.",
      consumer: "The VPS execution terminal and its two L2L traders.",
      undocumented: [
        "No execution log is committed, so this is a documented path, not a trace of a live order.",
        "How a level set reaches a running terminal by hand is not recorded in this checkout."
      ],
      facts: [["Evidence", "Documented path"], ["Lanes", "Full 5R · half 3R"]]
    });

    add({
      id: "dep.shared.payout",
      depStage: "platform",
      depKind: "rule",
      label: "Payout route",
      short: "Payout",
      pos: [LOWER_X.payout, LOWER_Y, 0],
      height: 2.0,
      evidence: "planned",
      evidenceLabel: "Not automated",
      supports: ["payout"],
      does: "Describes the conditional step where approved profit would leave the trading account.",
      receives: "Eligible profit from either lane, after FTMO approval.",
      receivesFrom: "The account, not a workflow.",
      tools: [["docs/dashboard-design/execution-path-summary.md", "Execution path summary"]],
      governs: [["docs/dashboard-design/execution-path-summary.md", "Execution path summary"]],
      rules: [
        "A payout is conditional and is never drawn as completed profit.",
        "No payout workflow is committed, so the step stays a plan."
      ],
      produces: "No automated transfer: the step is named, not executed.",
      consumer: "The FTMO account holder.",
      undocumented: ["No payout workflow, schedule or completion record is committed in this checkout."],
      facts: [["Evidence", "Not automated"], ["State", "Conditional"]]
    });

    add({
      id: "dep.shared.relay",
      depStage: "platform",
      depKind: "relay",
      label: "cTrader relay evidence",
      short: "cTrader",
      pos: [LOWER_X.lane, LOWER_Y, 15],
      height: 2.2,
      evidence: "planned",
      evidenceLabel: "Not evidenced",
      supports: ["relay.ctrader"],
      does: "Records what the repository can and cannot show about the cTrader robot that would copy a lane into a cTrader account.",
      receives: "A lane's calls and levels, if a relay were connected.",
      receivesFrom: "No connection is evidenced in this checkout.",
      tools: [
        ["ctrader/Ftmo3L2L/README.md", "cTrader project readme"],
        ["ctrader/Ftmo3L2L/Ftmo3L2L.cs", "cTrader robot source"],
        ["docs/live-trading/SECOND_LANE_HALF_L2L.md", "Half L2L lane"]
      ],
      governs: [["ctrader/Ftmo3L2L/README.md", "cTrader project readme"]],
      rules: [
        "Installed, connected, authorised and actively copying are four different states; this checkout evidences none of them.",
        "A built robot project is not proof that a robot is running or that a trade was copied."
      ],
      produces: "No copying evidence: the node marks an unproven link.",
      consumer: "The cTrader lane, which stays separate from the MT5 loop.",
      undocumented: [
        "The cTrader project is committed, but no install, connection, authorisation or copy log is committed.",
        "Do not read this node as a live cTrader lane."
      ],
      facts: [["Evidence", "Project committed"], ["Connection", "Not evidenced"]]
    });

    add({
      id: "dep.usd.programme",
      depStage: "archive",
      depKind: "document",
      label: "25-factor research programme",
      short: "25-factor",
      pos: [-58, LOWER_Y, -38],
      height: 2.5,
      evidence: "research",
      evidenceLabel: "Research only",
      supports: ["usd.research"],
      does: "Registers twenty-five research chains. None of them is an input to the deployed ten-factor USD engine.",
      receives: "Research prompts, red-team reviews and adjudications.",
      receivesFrom: "The research library, not the live feed.",
      tools: [
        ["docs/research/handoff/usd/v1/START_HERE.md", "Research handoff"],
        ["docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md", "USD system context"],
        ["docs/dashboard-design/usd-factor-sets.md", "Three factor sets"],
        ["data/research-library/catalog.json", "Research library catalogue"]
      ],
      governs: [
        ["docs/CORE_RESEARCH_PHILOSOPHY.md", "Core research philosophy"],
        ["docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md", "USD factor register"]
      ],
      rules: [
        "A research chain is not an operational factor: the deployed book scores ten factors, not twenty-five.",
        "Research, review and adjudication are three separate passes; passing one does not imply another."
      ],
      produces: "A register of research outcomes, most of which are not implemented.",
      consumer: "The USD research desk above, for review and prioritisation.",
      undocumented: ["No weight and no replay result exists for any of the 25 registered chains."],
      facts: [["Evidence", "Research only"], ["Operational", "No"]]
    });

    add({
      id: "dep.usd.challenger",
      depStage: "archive",
      depKind: "result",
      label: "Historical challenger",
      short: "Challenger",
      pos: [-58, LOWER_Y, -34],
      height: 2.2,
      evidence: "research",
      evidenceLabel: "Research only",
      supports: ["usd.replay"],
      does: "Scores nine mechanisms over seven shared-source families as a frozen historical experiment.",
      receives: "Factors with an executable rule, one unit of say each.",
      receivesFrom: "The research programme, at the time the experiment was frozen.",
      tools: [
        ["backtester/replay/usd/run_usd_historical_replay.js", "USD replay runner"],
        ["docs/dashboard-design/usd-factor-sets.md", "Three factor sets"],
        ["docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md", "USD factor register"]
      ],
      governs: [["backtester/replay/usd/README.md", "USD replay notes"]],
      rules: [
        "A frozen experiment is not a candidate for the live engine and not a validated result.",
        "The challenger uses six of the deployed ten factors plus one research factor; it does not use all 25."
      ],
      produces: "One comparison line inside the USD replay report, kept apart from the deployed book.",
      consumer: "The USD replay chamber, for comparison only.",
      undocumented: ["No stored challenger result is committed; the experiment can be re-run but not quoted as an outcome."],
      facts: [["Evidence", "Research only"], ["Status", "Frozen experiment"]]
    });

    add({
      id: "dep.usd.tests",
      depStage: "archive",
      depKind: "result",
      label: "Four USD tests",
      short: "4 tests",
      pos: [-58, LOWER_Y, -30],
      height: 2.0,
      evidence: "replay",
      evidenceLabel: "Replay method",
      supports: ["usd.replay"],
      does: "Reports DXY direction, the four-market call, the original 5R ladder and the half 3R ladder as four separate tests.",
      receives: "The rebuilt USD snapshots and the deployed and challenger rule sets.",
      receivesFrom: "The USD historical replay runner.",
      tools: [
        ["backtester/replay/usd/run_usd_historical_replay.js", "USD replay runner"],
        ["backtester/replay/usd/usd_replay_core.js", "USD replay core"],
        ["backtester/docs/usd_import_format_spec.md", "USD import format"]
      ],
      governs: [["backtester/replay/usd/README.md", "USD replay notes"]],
      rules: [
        "The four tests are never blended into one score.",
        "The ladders are separate: full L2L at 5R and half L2L at 3R are different tests, not two views of one result."
      ],
      produces: "Four report lines with no combined verdict.",
      consumer: "The USD replay chamber and the validation gate.",
      undocumented: ["No stored run output is committed, so the four tests are a method, not a quoted result."],
      facts: [["Evidence", "Replay method"], ["Tests", "4 separate"]]
    });

    return deps;
  }

  // ---------------------------------------------------------------- shared stations
  // These stand once, after the eight lanes. The gate is the only barrier all eight lanes cross before their
  // cores, which is why a rule change is a whole-system event and a lane is not.
  function gateStation() {
    return {
      id: "gate",
      kind: "gate",
      label: "Validation gate",
      sub: "rule → engine",
      status: "shared",
      statusLabel: "Review step",
      pos: [X.gate, 4.6, 0],
      port: [X.gate, PORT_Y, 0],
      does: "The checkpoint every rule change passes before it may alter a live engine: review, shadow run, then acceptance.",
      receives: "A replay report from any of the eight chambers, together with the proposed rule change.",
      receivesFrom: "The replay chambers. Each lane crosses this gate separately, so the gate holds a queue, not a merge.",
      tools: [
        ["backtester/lib/phase2_shadow_backtest.js", "Phase 2 shadow backtest"],
        ["backtester/tests/factor_edge_lab.test.js", "Factor edge lab guard"]
      ],
      governs: [
        ["docs/DECISIONS.md", "Decision log"],
        ["docs/live-trading/TEST_SUITE_666_VS_758.md", "Test suite comparison"]
      ],
      rules: [
        "A passing replay is not proof of live deployment, of causal feature timing or of a trading edge. The gate is where that distinction is held.",
        "No factor in the USD register has reached an accepted state: every row reads review pending."
      ],
      produces: "An accepted rule change with its review record, or a rejection with its reason.",
      consumer: "The L1 cores and the execution terminal, which change only after the gate.",
      undocumented: ["The gate has no automated implementation in this checkout: it is a review step recorded in the decision log, not a service."]
    };
  }

  function joinStation() {
    return {
      id: "join",
      kind: "join",
      label: "Layer 2 junction",
      sub: "the only join",
      status: "shared",
      statusLabel: "Layer 2",
      pos: [X.join, 4.8, 0],
      port: [X.join, PORT_Y, 0],
      does: "Reads all eight L1 calls and decides whether one pair is tradable. This is the only station where two asset paths are allowed to meet.",
      receives: "The target asset's 24H call and the USD 24H call, each with its confidence.",
      receivesFrom: "Two independent L1 cores. No other pair of lanes is read, and the junction never reads a third.",
      tools: [
        ["backtester/lib/layer2_pair_logic.js", "Layer 2 pair logic"],
        ["exports/layer2_trade_selection_agent.json", "Layer 2 trade selection agent"]
      ],
      governs: [
        ["docs/CALL_MAP_LAYER2_20261004.md", "Layer 2 call map"],
        ["backtester/lib/layer2_pair_logic.js", "The join rule as code"]
      ],
      rules: [
        "Act only when the target and USD 24H directions are opposite: BULLISH with BEARISH reads BUY, BEARISH with BULLISH reads SELL.",
        "Same direction is skipped as same_direction_conflict; a non-directional call or a missing confidence also skips the pair.",
        "Combined confidence is the lower of the two legs, never an average."
      ],
      produces: "BUY or SELL on one pair, or no trade at all.",
      consumer: "The VPS execution terminal.",
      undocumented: ["No pair-level replay result is documented for any of the seven pairings in this checkout."]
    };
  }

  function vpsStation() {
    return {
      id: "vps",
      kind: "vps",
      label: "VPS execution terminal",
      sub: "one host · three traders",
      status: "shared",
      statusLabel: "Live",
      pos: [X.vps, 5.2, 0],
      port: [X.vps, PORT_Y, 0],
      does: "Hosts the live floor on the VPS: the trading loop reads the pair output, the marked levels and the M5 bars, and places and manages brackets through the MT5 bridge. Three FTMO traders run on this host, and a fourth component - the cTrader robot - is drawn separately because it is not an MT5 loop.",
      receives: "The Layer 2 pair output, the marked level ladder and the M5 bars.",
      receivesFrom: "The junction, plus the level store and the market snapshot files the loop reads directly. The third trader reads none of the junction's output, and the cTrader robot reads neither the junction nor this loop.",
      tools: [
        ["lib/l2l_strategy.js", "L2L strategy"],
        ["lib/l2l_sizing.js", "L2L sizing"],
        ["lib/l2l_ladder.js", "L2L ladder"],
        ["lib/l2l_levels_store.js", "Level store"],
        ["scripts/l2l-levels-tool.js", "Levels tool"]
      ],
      governs: [
        [SUMMARIES.executionPath, "Execution path summary"],
        [SUMMARIES.executionFloor, "Execution floor summary"],
        ["docs/CALL_MAP_LAYER2_20261004.md", "Layer 2 call map"]
      ],
      rules: [
        "One shared bridge, two independent directional accounts: each lane carries its own magic number and never reads the other account's position.",
        "The third trader is on this host but not on the pair output: it takes its own M5 signal, so a trader can exist without a Layer 1 or a Layer 2 call.",
        "The host specification, the lane runbooks and the access handoff are committed for the operator and are not linked here: they name a host, an address, login references and deployment steps."
      ],
      facts: [
        ["FTMO 1", "Live L2L Directional - original levels, 5R"],
        ["FTMO 2", "Live 0.5L2L Directional - half levels, 3R"],
        ["FTMO 3", "Live L2L Blind - original levels, 5R, no directional call"],
        ["cTrader", "A fourth component, drawn apart: an independent robot, not an MT5 loop"]
      ],
      produces: "Live order streams: two from the pair output, one from its own M5 rule, and a separate cTrader component.",
      consumer: "The three FTMO execution lanes, and the cTrader connection drawn beside them.",
      undocumented: [
        "This page is not connected to the VPS and holds no account, balance or order data.",
        "No relay that mirrors one lane's accepted orders into cTrader is documented in this checkout."
      ]
    };
  }

  function laneStations() {
    return [
      {
        id: "lane.full",
        kind: "lane",
        label: "FTMO lane 1 · full L2L 5R",
        sub: "live L2L directional",
        status: "shared",
        statusLabel: "Live",
        pos: [X.lane, 4.2, -4.4],
        port: [X.lane, PORT_Y, -4.4],
        does: "Trades the marked ladder as it stands on the first live account: the next marked level is the target, and the stop is placed so the reward is five times the risk.",
        receives: "The pair output and the full marked ladder.",
        receivesFrom: "The execution terminal, which reads the level store.",
        tools: [
          ["lib/l2l_strategy.js", "REWARD_R_MULTIPLE, the full-lane geometry"],
          ["lib/l2l_sizing.js", "Position sizing"],
          [SUMMARIES.executionPath, "Execution path summary"]
        ],
        governs: [
          ["docs/live-trading/TEST_SUITE_666_VS_758.md", "Test suite comparison"]
        ],
        rules: ["REWARD_R_MULTIPLE = 5. Risk is one fifth of the entry-to-target distance, and the lane holds one ticket per market."],
        produces: "Filled or unfilled tickets and, when a trade wins, account profit.",
        consumer: "Nothing automatic. Profit leaves the account only through an approved payout.",
        undocumented: ["No stored performance figure is shown here: this page never reads the live result."]
      },
      {
        id: "lane.half",
        kind: "lane",
        label: "FTMO lane 2 · half L2L 3R",
        sub: "live 0.5L2L directional",
        status: "shared",
        statusLabel: "Live",
        pos: [X.lane, 2.9, 4.4],
        port: [X.lane, PORT_Y, 4.4],
        does: "Trades the same rule on a half grid on the second live account: one midpoint is inserted between every pair of marked levels, so the target sits nearer.",
        receives: "The pair output and the half grid built from the marked ladder.",
        receivesFrom: "The execution terminal, which builds the half grid from the level store.",
        tools: [
          ["lib/l2l_strategy.js", "HALF_LANE_R_MULTIPLE, the half-lane geometry"],
          ["lib/l2l_ladder.js", "Half-grid construction"]
        ],
        governs: [
          [SUMMARIES.executionPath, "Execution path summary"]
        ],
        rules: ["HALF_LANE_R_MULTIPLE = 3. The geometry is three to one, not five, and the two lanes can hold different tickets on the same idea."],
        produces: "Filled or unfilled tickets and, when a trade wins, account profit.",
        consumer: "Nothing automatic. Profit leaves the account only through an approved payout.",
        undocumented: ["No stored performance figure is shown here: this page never reads the live result."]
      }
    ];
  }

  // The third trader takes its own signal, so it gets its own small chain drawn below the directional lanes: a market
  // feed the loop does not read, its M5 deviation rule, then the account. Nothing here touches the junction.
  function blindLaneStations() {
    return [
      {
        id: "lane.blind.feed",
        kind: "blind-feed",
        label: "Blind market data",
        sub: "independent M5 feed",
        status: "blind",
        statusLabel: "Own feed",
        pos: [X.lane - 15, 1.4, 12.4],
        port: [X.lane - 15, 1.9, 12.4],
        does: "Carries the M5 bars the blind trader reads from its own terminal. It is not the snapshot store, and no Layer 1 agent reads it.",
        receives: "The broker's M5 chart for the mapped symbol.",
        receivesFrom: "The third account's own terminal. Nothing from the junction or from the other two lanes reaches this feed.",
        tools: [["ctrader/Ftmo3L2L/Ftmo3L2L.cs", "The robot's M5 handling"]],
        governs: [[SUMMARIES.executionFloor, "Execution floor summary"]],
        rules: [
          "A completed M5 candle is the only trigger. An unfinished candle never confirms a direction.",
          "Each symbol is independent: one instance per mapped symbol, and an instance waits while any position or pending order exists on that symbol."
        ],
        produces: "Completed M5 bars for one symbol.",
        consumer: "The blind trader's M5 deviation rule, on the same sub-level.",
        undocumented: [
          "No archived M5 tape for this lane is committed: the map shows the rule, not a replay of it."
        ]
      },
      {
        id: "lane.blind.deviation",
        kind: "blind-rule",
        label: "M5 deviation rule",
        sub: "completed candle · one tick",
        status: "blind",
        statusLabel: "Own rule",
        pos: [X.lane - 7.5, 1.6, 12.4],
        port: [X.lane - 7.5, 2.1, 12.4],
        does: "Brackets the current bid with the nearest original level above and below, then takes the direction of a completed M5 candle that crosses one boundary by a tick from the other side.",
        receives: "The M5 bars and the original marked ladder for that symbol.",
        receivesFrom: "Its own feed and the marked ladder. It reads no Layer 1 call and no Layer 2 output, which is what makes the lane blind rather than directional.",
        tools: [
          ["ctrader/Ftmo3L2L/Ftmo3L2L.cs", "The rule in code"],
          ["lib/l2l_strategy.js", "The shared ladder geometry"]
        ],
        governs: [
          ["ctrader/Ftmo3L2L/README.md", "The robot's written rule"],
          [SUMMARIES.executionFloor, "Execution floor summary"]
        ],
        rules: [
          "Entry is a limit back at the crossed boundary; the target is the next original level and the stop is one fifth of that distance, rounded to the tradable tick.",
          "A cancelled pending order resets the bracket, and on restart the instance checks broker orders and positions before acting.",
          "Size is the minimum volume in units for the symbol. There is no directional filter, so the lane can take a setup the other two lanes would refuse."
        ],
        produces: "One bracketed order per symbol, or nothing.",
        consumer: "The third FTMO account, which is the only place these orders are sent.",
        undocumented: [
          "No replay of this rule is committed: the robot's README records that account verification still needs the target cTrader environment."
        ]
      },
      {
        id: "lane.blind",
        kind: "lane",
        label: "FTMO 3 · L2L blind 5R",
        sub: "live L2L blind · unarmed",
        status: "blind",
        statusLabel: "Connected · unarmed",
        pos: [X.lane, 3.6, 12.4],
        port: [X.lane, PORT_Y, 12.4],
        does: "Trades the original marked ladder at five to one without any directional call. It is the only trader on the floor that can open a trade the junction did not produce.",
        receives: "Its own M5 signal and the original marked ladder.",
        receivesFrom: "The M5 deviation rule on this sub-level. Nothing from Layer 1 or Layer 2 reaches it.",
        tools: [
          ["ctrader/Ftmo3L2L/Ftmo3L2L.cs", "The blind robot"],
          ["lib/l2l_strategy.js", "REWARD_R_MULTIPLE, the full-lane geometry"],
          ["lib/l2l_sizing.js", "Position sizing"]
        ],
        governs: [
          [SUMMARIES.executionFloor, "Execution floor summary"],
          [SUMMARIES.executionPath, "Execution path summary"]
        ],
        rules: ["REWARD_R_MULTIPLE = 5 on the original ladder, with no daily entry cap and the minimum tradable volume."],
        facts: [
          ["Recorded state", "Connected, strategy unarmed: no strategy heartbeat has been published for this lane"],
          ["Connection test", "One closed trade is labelled a connection test and kept out of the lane's win rate, count and expectancy"],
          ["Orders", "None sent by this lane while it is parked; the robot's orders default to disabled"]
        ],
        produces: "Bracketed orders on the third account once the lane is armed; nothing while it is parked.",
        consumer: "Nothing automatic. No payout route is drawn from this lane, because it is unarmed.",
        undocumented: [
          "No performance figure is shown here: this page reads no account and no trade history.",
          "No stored replay of the blind rule is committed in this checkout."
        ]
      }
    ];
  }

  // The cTrader component is drawn as its own object after the lanes, not as a fourth lane: it is not an MT5 loop and
  // the repository records no order-copying relay. Its four states are written out so a visitor can see exactly which
  // part is installed, which is pending, and which is simply not documented.
  function relayStation() {
    return {
      id: "relay.ctrader",
      kind: "relay",
      label: "cTrader connection",
      sub: "independent robot · authorisation pending",
      status: "relay",
      statusLabel: "Authorisation pending",
      pos: [X.lane + 9, 2.8, -12.6],
      port: [X.lane + 9, 3.2, -12.6],
      does: "Hosts the cTrader side of the floor: an independent line-to-line robot built from the committed source at ctrader/Ftmo3L2L. It places its own orders from its own M5 rule; it is not a copy of another lane.",
      receives: "The broker's M5 chart, the original marked ladder for the mapped symbol, and the per-instance symbol and account settings.",
      receivesFrom: "The cTrader chart and the committed ladder - not the junction, not the VPS loop and not another lane's order stream.",
      tools: [
        ["ctrader/Ftmo3L2L/Ftmo3L2L.cs", "The robot source"],
        ["ctrader/Ftmo3L2L/Ftmo3L2L.csproj", "Build project"],
        ["ctrader/Ftmo3L2L/README.md", "Installation and verification notes"]
      ],
      governs: [
        ["ctrader/Ftmo3L2L/README.md", "The robot's own rule and verification steps"],
        [SUMMARIES.executionFloor, "Execution floor summary"]
      ],
      rules: [
        "One instance per mapped symbol on its M5 chart, with the expected account and symbol set from the account and the chart.",
        "Orders default to disabled. Entry, absolute stop and target have to be confirmed in a simulated fill before any account is enabled.",
        "The instance refuses off-tick marks, and a preview run logs its signals without publishing any dashboard heartbeat."
      ],
      facts: [
        ["Installation", "Documented in source: the robot and its build project are committed. Not evidenced: that it is installed on the VPS."],
        ["Account connection", "Documented: one instance per symbol, pointed at the third FTMO account. Not evidenced: a verified connection - account verification still needs the target cTrader environment."],
        ["Trading authorisation", "Pending: orders default to disabled and stay that way until a simulated fill verifies entry, stop and target."],
        ["Active copying", "None documented: the repository records no relay that mirrors another lane's accepted orders. This component places only its own line-to-line orders."]
      ],
      produces: "Its own bracketed orders on the third account, once an operator enables the account.",
      consumer: "The cTrader terminal. No dashboard station reads it, and it publishes no heartbeat.",
      undocumented: [
        "No order-copying relay is described anywhere in this checkout, so none is drawn.",
        "No runtime status exists for this component: the repository holds its source and its verification steps, not a live state."
      ]
    };
  }

  function payoutStations() {
    return [
      {
        id: "payout",
        kind: "payout",
        label: "Approved payout",
        sub: "conditional · illustrative",
        status: "conditional",
        statusLabel: "Conditional",
        pos: [X.payout, 3.2, 0],
        port: [X.payout, PORT_Y, 0],
        does: "The conditional step where account profit would leave the trading account, after FTMO approves a payout.",
        receives: "Eligible profit from either lane.",
        receivesFrom: "The two live FTMO accounts.",
        tools: [],
        governs: [[SUMMARIES.executionPath, "Execution path summary"]],
        rules: ["Conditional and illustrative: the step is not part of the live trading loop, and it is not a promise of a payout."],
        produces: "An approved withdrawal, in the illustration only.",
        consumer: "The personal bank account marker, which sits outside the system.",
        undocumented: ["No payout workflow, transfer rule, payout schedule or bank instruction is committed in this checkout."]
      },
      {
        id: "bank",
        kind: "bank",
        label: "Personal bank account",
        sub: "outside the system",
        status: "conditional",
        statusLabel: "Illustrative",
        pos: [X.bank, 2.6, 0],
        port: [X.bank, PORT_Y, 0],
        does: "Marks the end of the illustration, outside the trading system.",
        receives: "An approved payout, in the illustration only.",
        receivesFrom: "The conditional payout step.",
        tools: [],
        governs: [],
        rules: ["No banking integration exists in this repository, and the dashboard stores no account detail."],
        produces: "Nothing the system reads.",
        consumer: "None: the illustration stops here.",
        undocumented: ["No bank account, IBAN, statement or transfer record is stored in this repository."]
      }
    ];
  }

  // One socket per pair, arranged around the junction. The geometry shows seven possible joins and one junction
  // that performs them, so a visitor can select a pairing without leaving the scene.
  function pairStations(model) {
    return model.pairs.map((pair, index) => {
      const angle = (index / model.pairs.length) * Math.PI * 2 - Math.PI / 2;
      const radius = 5.4;
      const target = model.assets.find(asset => asset.code === pair.target);
      const planned = Boolean(target && target.status === "onboarding");
      return {
        id: `pair.${pair.code}`,
        kind: "pair",
        pair: pair.code,
        label: pair.label,
        sub: planned ? "planned pairing" : "pair socket",
        status: planned ? "onboarding" : "established",
        statusLabel: planned ? "Planned pairing" : "Pair socket",
        pos: [X.join, 4.8 + Math.sin(angle) * radius * 0.45, Math.cos(angle) * radius],
        port: [X.join, PORT_Y, 0],
        does: `The ${pair.label} socket: the ${pair.target} target call joined with the ${pair.quote} quote call, and nothing else.`,
        receives: `The ${pair.target} 24H call and the ${pair.quote} 24H call.`,
        receivesFrom: "Two independent L1 cores, one from each lane.",
        tools: [
          ["backtester/lib/layer2_pair_logic.js", "Layer 2 pair logic"],
          ["exports/layer2_trade_selection_agent.json", "Layer 2 trade selection agent"]
        ],
        governs: [["docs/CALL_MAP_LAYER2_20261004.md", "Layer 2 call map"]],
        rules: [
          `BUY when ${pair.target} is BULLISH and ${pair.quote} is BEARISH; SELL when the two are the other way round.`,
          "Any other combination, including a non-directional leg, produces no trade."
        ],
        produces: `BUY or SELL on ${pair.label}, with the lower of the two confidences.`,
        consumer: "The VPS execution terminal.",
        undocumented: [planned
          ? `The ${pair.target} engine is onboarding, so this pairing is planned rather than verified.`
          : "No pair-level replay result is documented for this pairing in this checkout."]
      };
    });
  }

  function buildStations(model) {
    return assetStations(model)
      .concat([gateStation(), joinStation()])
      .concat(pairStations(model))
      .concat([vpsStation()])
      .concat(laneStations())
      .concat(blindLaneStations())
      .concat([relayStation()])
      .concat(payoutStations());
  }

  // ---------------------------------------------------------------- inspector
  // The five questions, in the same order for every station. A link carries its repository path in
  // data-evidence-path so the guard can check that every target resolves.
  const QUESTIONS = [
    "What does this station do?",
    "What inputs does it receive, and where do they come from?",
    "Which tools, workflows or code implement it?",
    "Which documents and decision rules govern it?",
    "What does it produce, and which station consumes that output?"
  ];

  function linkRows(rows) {
    return `<ul class="factory-evidence">${rows.map(row => `
      <li>
        <a class="factory-link" href="${esc(row[0])}" data-evidence-path="${esc(row[0])}">${esc(row[1])}</a>
        <span class="factory-link-path">${esc(row[0])}</span>
      </li>`).join("")}</ul>`;
  }

  function stationInspector(station, actions) {
    const tools = station.tools.length
      ? linkRows(station.tools)
      : `<p class="factory-missing">No tool, workflow export or source file is committed for this station.</p>`;
    const governs = station.governs.length
      ? linkRows(station.governs)
      : `<p class="factory-missing">No document is committed that governs this station; it is a marker, not a component.</p>`;
    const rules = station.rules.map(rule => `<li>${esc(rule)}</li>`).join("");
    const facts = (station.facts || []).length
      ? `<div class="factory-states">
           <h4>State, as the repository records it</h4>
           <dl>${station.facts
             .map(fact => `<div class="factory-state"><dt>${esc(fact[0])}</dt> <dd>${esc(fact[1])}</dd></div>`)
             .join("")}</dl>
         </div>`
      : "";
    const actionHtml = (actions || []).length
      ? `<div class="factory-actions">${actions
          .map(action => `<button type="button" class="factory-action" ${action.dataset}>${esc(action.label)}</button>`)
          .join("")}</div>`
      : "";
    const undocumented = station.undocumented.length
      ? `<div class="factory-undocumented">
           <h4>What is undocumented</h4>
           <ul>${station.undocumented.map(note => `<li>${esc(note)}</li>`).join("")}</ul>
         </div>`
      : "";
    const kicker = station.kind === "pair"
      ? "Layer 2 socket"
      : station.kind === "dependency"
        ? "Lower-floor dependency"
        : "Station";
    const badge = station.kind === "dependency"
      ? `<p class="factory-evidence-badge is-${esc(station.evidence)}">
           <span>${esc(station.evidenceLabel)}</span> ${esc(station.evidenceNote)}
         </p>`
      : "";
    return `
      <article class="factory-inspector-card" data-inspector-for="${esc(station.id)}" data-inspector-status="${esc(station.status)}" data-inspector-kind="${esc(station.kind)}">
        <header class="factory-inspector-head">
          <p class="factory-inspector-kicker">${esc(kicker)} · read-only</p>
          <h3>${esc(station.label)}</h3>
          <p class="factory-inspector-sub">${esc(station.sub || "Dependency")} · ${esc(station.statusLabel)}</p>
          ${badge}
        </header>
        <ol class="factory-answers">
          <li>
            <h4>1. ${esc(QUESTIONS[0])}</h4>
            <p>${esc(station.does)}</p>
          </li>
          <li>
            <h4>2. ${esc(QUESTIONS[1])}</h4>
            <p>${esc(station.receives)}</p>
            <p class="factory-answer-note">${esc(station.receivesFrom)}</p>
          </li>
          <li>
            <h4>3. ${esc(QUESTIONS[2])}</h4>
            ${tools}
          </li>
          <li>
            <h4>4. ${esc(QUESTIONS[3])}</h4>
            ${governs}
            <ul class="factory-rules">${rules}</ul>
          </li>
          <li>
            <h4>5. ${esc(QUESTIONS[4])}</h4>
            <p>${esc(station.produces)}</p>
            <p class="factory-answer-note"><strong>Next:</strong> ${esc(station.consumer)}</p>
          </li>
        </ol>
        ${facts}
        ${actionHtml}
        ${undocumented}
      </article>`;
  }

  function emptyInspector() {
    return `
      <article class="factory-inspector-card is-empty" data-inspector-for="">
        <header class="factory-inspector-head">
          <p class="factory-inspector-kicker">Inspector · read-only</p>
          <h3>Choose a station</h3>
          <p class="factory-inspector-sub">Orbit the factory, then select any station to read what it does.</p>
        </header>
        <p class="factory-empty-copy">Every station answers the same five questions: what it does, what it receives and from where, which tools implement it, which documents govern it, and what it produces. Entries link to the committed document, export or source file, and anything the repository does not record is named as undocumented.</p>
        <p class="factory-empty-copy">Start with <strong>Trace an asset</strong> for a guided route, or select one of the eight lanes and follow it to the junction.</p>
      </article>`;
  }

  // ---------------------------------------------------------------- drill-downs
  // Two second-level views open from a station: the document library beneath a replay chamber, and the n8n flow
  // behind a Layer 1 core. Both are drawn over the same data the flat board uses, and both end with a control that
  // puts the visitor back on the station they came from, at the camera position they left.
  function libraryInspector(view) {
    const library = window.FactoryLibrary;
    const asset = library && library.assets[view.asset];
    const closable = `<button type="button" class="factory-action" data-factory-drilldown-close>Return to the ${esc(
      view.asset
    )} replay chamber</button>`;
    if (!asset) {
      return `
        <article class="factory-inspector-card is-empty" data-inspector-for="${esc(view.asset.toLowerCase())}.replay">
          <header class="factory-inspector-head">
            <p class="factory-inspector-kicker">Document library · read-only</p>
            <h3>No library data</h3>
          </header>
          <p class="factory-empty-copy">No document library is committed for ${esc(view.asset)}.</p>
          ${closable}
        </article>`;
    }
    const counts = library.countsFor(view.asset);
    const group = library.groupById(view.group) || library.groups[0];
    const documents = library.documentsFor(view.asset, group.id);
    const gaps = (asset.gaps || []).filter(gap => gap.group === group.id);
    const chosen = documents.find(item => item.id === view.doc) || documents[0] || null;
    const chosenTest = (asset.tests || []).find(item => item.id === view.test) || null;

    const groupButtons = library.groups
      .map(item => {
        const count = library.documentsFor(view.asset, item.id).length;
        const gap = (asset.gaps || []).some(entry => entry.group === item.id);
        return `<button type="button" class="factory-choice${item.id === group.id ? " is-active" : ""}"
                 data-factory-library-group="${esc(item.id)}" aria-pressed="${item.id === group.id}">
          <span class="factory-choice-code">${esc(item.label)}</span>
          <span class="factory-choice-name">${count} ${count === 1 ? "document" : "documents"}${
            gap ? " · a named gap" : ""
          }</span>
        </button>`;
      })
      .join("");

    const docButtons = documents
      .map(
        item => `<button type="button" class="factory-library-doc${item.id === (chosen && chosen.id) ? " is-active" : ""}"
          data-factory-library-doc="${esc(item.id)}" aria-pressed="${item.id === (chosen && chosen.id)}">
          <span class="factory-library-doc-title">${esc(item.title)}</span>
          <span class="factory-library-tag${item.used ? " is-used" : ""}">${
            item.used ? "used by the replay" : "related research"
          }</span>
        </button>`
      )
      .join("");

    const detail = chosen
      ? `<div class="factory-library-detail" data-factory-library-detail="${esc(chosen.id)}">
           <h4>${esc(chosen.title)}</h4>
           <dl class="factory-library-meta">
             <div><dt>Belongs to</dt><dd>${esc(chosen.belongsTo)}</dd></div>
             <div><dt>Question it answers</dt><dd>${esc(chosen.question)}</dd></div>
             <div><dt>The replay</dt><dd>${
               chosen.used ? "This document is read by the replay run." : "Related research: the replay does not read it."
             }</dd></div>
           </dl>
           ${chosen.note ? `<p class="factory-library-note">${esc(chosen.note)}</p>` : ""}
           ${linkRows([[chosen.path, `Open ${chosen.title}`]])}
         </div>`
      : `<p class="factory-missing">This group has no committed document for ${esc(view.asset)}.</p>`;

    const gapList = gaps.length
      ? `<div class="factory-undocumented"><h4>The gap this group records</h4><ul>${gaps
          .map(gap => `<li>${esc(gap.text)}</li>`)
          .join("")}</ul></div>`
      : "";

    const tests = (asset.tests || []).length
      ? `<div class="factory-library-tests" data-factory-library-tests>
           <h4 class="factory-panel-title">Choose a test</h4>
           <div class="factory-choices" role="group" aria-label="Tests in this chamber">${asset.tests
             .map(
               item => `<button type="button" class="factory-choice${
                 item.id === (chosenTest && chosenTest.id) ? " is-active" : ""
               }" data-factory-library-test="${esc(item.id)}" aria-pressed="${item.id === (chosenTest && chosenTest.id)}">
                 <span class="factory-choice-code">${esc(item.code)}</span>
                 <span class="factory-choice-name">${esc(item.title)}</span>
                 <span class="factory-choice-tag${item.status === "blocked" ? " is-blocked" : ""}">${esc(
                   item.status === "blocked" ? "blocked" : "scored"
                 )}</span>
               </button>`
             )
             .join("")}</div>
           ${
             chosenTest
               ? `<div class="factory-test-detail" data-factory-library-test-detail="${esc(chosenTest.id)}">
                    <h4>${esc(chosenTest.code)} · ${esc(chosenTest.title)}</h4>
                    <p class="factory-test-status">${esc(chosenTest.statusLabel)}</p>
                    <p><strong>Market.</strong> ${esc(chosenTest.market)}</p>
                    <p><strong>Logic.</strong> ${esc(chosenTest.logic)}</p>
                    <p><strong>Required data.</strong> ${esc(chosenTest.data)}</p>
                    <p><strong>Result artefact.</strong> ${esc(chosenTest.resultNote)}</p>
                    ${linkRows([[chosenTest.resultPath, "The artefact this test writes"]])}
                  </div>`
               : `<p class="factory-missing">Choose one of the four tests to read its market, its logic, the data it needs and the artefact it writes.</p>`
           }
         </div>`
      : `<div class="factory-library-tests"><p class="factory-missing">No ${esc(
          view.asset
        )} replay is documented in this checkout, so the chamber has no test to choose. The groups above name the evidence that does exist and the gap that stops the replay.</p></div>`;

    return `
      <article class="factory-inspector-card factory-library" data-inspector-for="${esc(
        view.asset.toLowerCase()
      )}.replay" data-library-asset="${esc(view.asset)}" data-library-group="${esc(group.id)}"
        data-library-doc="${esc(chosen ? chosen.id : "")}" data-library-test="${esc(chosenTest ? chosenTest.id : "")}">
        <header class="factory-inspector-head">
          <p class="factory-inspector-kicker">Document library · beneath the ${esc(view.asset)} replay chamber · read-only</p>
          <h3>${esc(view.asset)} test library</h3>
          <p class="factory-inspector-sub">${counts.documents} documents · ${counts.used} used by the replay · ${
            counts.tests
          } tests · ${counts.gaps} named ${counts.gaps === 1 ? "gap" : "gaps"}</p>
        </header>
        <p class="factory-empty-copy">${esc(asset.chamber)}</p>
        <div class="factory-choices" role="group" aria-label="Document groups, in investigation order">${groupButtons}</div>
        <p class="factory-panel-note">${esc(group.note)}</p>
        <div class="factory-library-docs" role="group" aria-label="Documents in ${esc(group.label)}">${docButtons}</div>
        ${detail}
        ${gapList}
        ${tests}
        ${linkRows([[SUMMARIES.libraries, "How these libraries are ordered, and what they leave out"]])}
        ${closable}
      </article>`;
  }

  // ---------------------------------------------------------------- journey panels

  function flowInspector(view) {
    const flows = window.FactoryFlows;
    const flow = flows && flows.assets[view.asset];
    const closable = `<button type="button" class="factory-action" data-factory-drilldown-close>Return to the ${esc(
      view.asset
    )} L1 core</button>`;
    if (!flow) {
      return `
        <article class="factory-inspector-card factory-flow is-empty" data-inspector-for="${esc(
          view.asset.toLowerCase()
        )}.core" data-factory-flow="">
          <header class="factory-inspector-head">
            <p class="factory-inspector-kicker">n8n flow · read-only</p>
            <h3>No workflow export</h3>
          </header>
          <p class="factory-empty-copy">No ${esc(
            view.asset
          )} Layer 1 Agent export is committed in this checkout, so there is no flow to draw. The logic document is the only committed artefact for this agent.</p>
          ${closable}
        </article>`;
    }
    const nodes = flow.order.map(id => flow.nodes.find(node => node.id === id)).filter(Boolean);
    const chosen = nodes.find(node => node.id === view.node) || null;
    const joins = flow.joins || [];
    const branches = flow.branches || [];

    const chain = nodes
      .map(node => {
        const join = joins.find(entry => entry.node === node.id);
        const branch = branches.find(entry => entry.node === node.id);
        return `<li class="factory-flow-node${join ? " has-join" : ""}${branch ? " has-branch" : ""}">
          <button type="button" class="factory-flow-node-button${
            node.id === (chosen && chosen.id) ? " is-active" : ""
          }" data-factory-flow-node="${esc(node.id)}" aria-pressed="${node.id === (chosen && chosen.id)}">
            <span class="factory-flow-step">${esc(node.step)}</span>
            <span class="factory-flow-name">${esc(node.name)}</span>
            <span class="factory-flow-type">${esc(node.typeLabel)}</span>
          </button>
          ${join ? `<span class="factory-flow-marker">join · reads ${join.from.length} connections</span>` : ""}
          ${branch ? `<span class="factory-flow-marker">branch · writes ${branch.to.length} connections</span>` : ""}
        </li>`;
      })
      .join("");

    const sourceBand = `
      <div class="factory-flow-sources">
        <div class="factory-flow-source is-direct">
          <h4>Direct invocation</h4>
          <p class="factory-flow-source-name">${esc(flow.upstream.direct.label)}</p>
          <p>${esc(flow.upstream.direct.purpose)}</p>
          ${linkRows([flow.upstream.direct.evidence])}
        </div>
        <div class="factory-flow-source is-storage">
          <h4>Storage hand-off</h4>
          <p class="factory-flow-source-name">${esc(flow.upstream.storage.label)}</p>
          <p>${esc(flow.upstream.storage.purpose)}</p>
          ${linkRows([flow.upstream.storage.evidence])}
        </div>
      </div>`;

    const detail = chosen
      ? `<div class="factory-flow-detail" data-factory-flow-detail="${esc(chosen.id)}">
           <h4>${esc(chosen.name)}</h4>
           <p class="factory-flow-role">${esc(chosen.step)} · ${esc(chosen.typeLabel)}${
             chosen.typeVersion ? ` · type version ${esc(chosen.typeVersion)}` : ""
           }</p>
           <p><strong>Purpose.</strong> ${esc(chosen.purpose)}</p>
           <p><strong>Receives.</strong> ${esc(chosen.inputs)}</p>
           <p><strong>Passes on.</strong> ${esc(chosen.outputs)}</p>
           ${
             chosen.evidence.length
               ? linkRows(chosen.evidence)
               : linkRows([[SUMMARIES.flows, "This flow, written out with every node"]])
           }
         </div>`
      : `<p class="factory-missing">Select a node in the chain to read its purpose, what it receives, what it passes on and the evidence behind it.</p>`;

    return `
      <article class="factory-inspector-card factory-flow" data-inspector-for="${esc(
        view.asset.toLowerCase()
      )}.core" data-factory-flow="${esc(flow.code)}" data-factory-flow-status="${esc(flow.status)}">
        <header class="factory-inspector-head">
          <p class="factory-inspector-kicker">n8n flow · read-only · ${esc(flow.statusLabel)}</p>
          <h3>${esc(flow.workflow)}</h3>
          <p class="factory-inspector-sub">${flow.source.nodes} nodes · ${flow.source.edges} connections · drawn from the checked-in export</p>
        </header>
        <p class="factory-empty-copy">${esc(flow.note)}</p>
        <p class="factory-panel-note">A saved export is a snapshot, not a runtime status: the map does not claim that the live workspace runs this version today.</p>
        ${sourceBand}
        <ol class="factory-flow-chain" aria-label="The agent's nodes, in the order the export connects them">${chain}</ol>
        <div class="factory-flow-sink">
          <h4>Storage write</h4>
          <p class="factory-flow-source-name">${esc(flow.downstream.label)}</p>
          <p>${esc(flow.downstream.purpose)}</p>
          ${linkRows([flow.downstream.evidence])}
        </div>
        ${detail}
        ${flow.verifiedBy.length ? linkRows(flow.verifiedBy) : ""}
        ${linkRows([[SUMMARIES.flows, "Every agent's flow, written out"]])}
        ${closable}
      </article>`;
  }

  // The two journeys open four panels: the factor register, the four replay tests, the pair output and the two
  // live lanes. Each panel is rebuilt from the state above, so panel and scene cannot disagree.
  function factorsPanel(activeId) {
    const chosen = FACTORS.find(item => item.id === activeId) || null;
    const choices = FACTORS.map(item => `
      <button class="factory-choice" type="button" data-factory-factor="${esc(item.id)}" aria-pressed="${item.id === activeId}">
        <span class="factory-choice-code">${esc(item.code)}</span>
        <span class="factory-choice-name">${esc(item.name)}</span>
        <span class="factory-choice-tag${item.status.indexOf("blocked") >= 0 ? " is-blocked" : ""}">${item.status.indexOf("blocked") >= 0 ? "blocked" : "ready"}</span>
      </button>`).join("");
    const detail = chosen
      ? `
        <div class="factory-factor-detail" data-factory-factor-detail="${esc(chosen.id)}">
          <h4>${esc(chosen.code)} ${esc(chosen.name)}</h4>
          <p class="factory-factor-status">${esc(chosen.status)}</p>
          <p><strong>Rule.</strong> ${esc(chosen.rule)}</p>
          <p><strong>Weight.</strong> Deployed book · ${esc(chosen.weight)}</p>
          <p><strong>Challenger book.</strong> ${esc(chosen.challenger)}</p>
          <p><strong>Where the rule lives.</strong> <span class="factory-mono">${esc(chosen.codePath)}</span></p>
          ${linkRows([
            ["docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md", "Factor register (this row)"],
            [SUMMARIES.factorSets, "Three factor sets, side by side"],
            [`docs/research/factors/usd/${chosen.folder}/01-research-prompt.md`, "Research prompt"],
            [`docs/research/factors/usd/${chosen.folder}/02-red-team-prompt.md`, "Red-team prompt"],
            [`docs/research/factors/usd/${chosen.folder}/03-adjudication-prompt.md`, "Adjudication prompt"],
            ["exports/usd_layer1_agent.json", "USD Layer 1 Agent workflow"]
          ])}
        </div>`
      : `<p class="factory-missing">Choose a factor to see its rule, its deployed weight, its place in the challenger's book, the engine code that applies it and the three prompts behind its evidence.</p>`;
    return `
      <div class="factory-panel" data-factory-panel="factors" data-factory-factor-active="${esc(activeId || "")}">
        <h4 class="factory-panel-title">USD factor register · the deployed book's ten factors</h4>
        <p class="factory-panel-note">This panel is Set A, the book the deployed engine computes. The research programme registers 25 factor chains, and the historical challenger scores nine mechanisms over seven shared-source families; the three sets are kept apart below.</p>
        <div class="factory-choices" role="group" aria-label="USD factor register">${choices}</div>
        ${detail}
        ${linkRows([
          [SUMMARIES.factorSets, "Three factor sets, side by side"],
          ["data/research-library/catalog.json", "The 25-factor register (research library catalogue)"],
          ["docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md", "The deployed book's register"]
        ])}
      </div>`;
  }

  function testsPanel(activeId) {
    const chosen = TESTS.find(item => item.id === activeId) || TESTS[0];
    const choices = TESTS.map(item => `
      <button class="factory-choice" type="button" data-factory-test="${esc(item.id)}" aria-pressed="${item.id === chosen.id}">
        <span class="factory-choice-code">${esc(item.code)}</span>
        <span class="factory-choice-name">${esc(item.name)}</span>
      </button>`).join("");
    return `
      <div class="factory-panel" data-factory-panel="tests" data-factory-test-active="${esc(chosen.id)}">
        <h4 class="factory-panel-title">USD replay · four tests, reported separately</h4>
        <div class="factory-choices" role="group" aria-label="The four USD replay tests">${choices}</div>
        <div class="factory-test-detail" data-factory-test-detail="${esc(chosen.id)}">
          <h4>${esc(chosen.code)} · ${esc(chosen.name)}</h4>
          <p><strong>What it measures.</strong> ${esc(chosen.measures)}</p>
          <p><strong>Inputs and model used.</strong> ${esc(chosen.inputs)}</p>
          ${linkRows(chosen.evidence)}
          <p class="factory-missing">${esc(chosen.open)}</p>
        </div>
        <p class="factory-panel-note">The book under test is the deployed ten-factor model. The comparison book is the implemented challenger: nine mechanisms over seven shared-source families, one unit of say each, built only from factors that have an executable rule. No replay uses all 25 registered factors, and a result here is evidence for the validation gate, not permission for a live engine to change.</p>
        ${linkRows([
          [SUMMARIES.factorSets, "Three factor sets, side by side"],
          ["backtester/replay/usd/README.md", "How the replay scores both books"]
        ])}
      </div>`;
  }

  function pairPanel(activeCode, model) {
    const pair = model.pairs.find(item => item.code === activeCode) || model.pairs[0];
    const target = model.assets.find(asset => asset.code === pair.target);
    const planned = Boolean(target && target.status === "onboarding");
    const choices = model.pairs.map(item => {
      const itemTarget = model.assets.find(asset => asset.code === item.target);
      const itemPlanned = Boolean(itemTarget && itemTarget.status === "onboarding");
      return `
      <button class="factory-choice" type="button" data-factory-pair="${esc(item.code)}" aria-pressed="${item.code === pair.code}">
        <span class="factory-choice-name">${esc(item.label)}</span>
        ${itemPlanned ? '<span class="factory-choice-tag is-blocked">planned</span>' : ""}
      </button>`;
    }).join("");
    return `
      <div class="factory-panel" data-factory-panel="pair" data-factory-pair-active="${esc(pair.code)}">
        <h4 class="factory-panel-title">Layer 2 output · ${esc(pair.label)}</h4>
        <div class="factory-choices" role="group" aria-label="Layer 2 pairs">${choices}</div>
        <div class="factory-pair-detail">
          <p><strong>Target leg.</strong> ${esc(pair.target)} 24H call, from the ${esc(pair.target)} L1 core.</p>
          <p><strong>Quote leg.</strong> ${esc(pair.quote)} 24H call, from the USD L1 core.</p>
          <p><strong>Decision.</strong> BUY when ${esc(pair.target)} is BULLISH and USD is BEARISH; SELL when ${esc(pair.target)} is BEARISH and USD is BULLISH. Same direction, a non-directional leg or a missing confidence produces no trade.</p>
          <p><strong>Output.</strong> One direction on ${esc(pair.label)} with the lower of the two confidences${planned ? ", flagged as a planned pairing" : ""}.</p>
          <p><strong>Next.</strong> The VPS execution terminal, which reads no other pair.</p>
          ${planned ? `<p class="factory-missing">The ${esc(pair.target)} engine is onboarding, so this pairing is planned rather than verified: no replay result is documented for it.</p>` : ""}
          ${linkRows([
            ["backtester/lib/layer2_pair_logic.js", "Layer 2 pair logic"],
            ["docs/CALL_MAP_LAYER2_20261004.md", "Layer 2 call map"],
            ["exports/layer2_trade_selection_agent.json", "Layer 2 trade selection agent"]
          ])}
        </div>
      </div>`;
  }

  function lanesPanel(activeLane) {
    const lanes = [
      ["lane.full", "FTMO 1", "Live L2L Directional", "5R", "REWARD_R_MULTIPLE = 5", "Trades the original marked ladder. The target is the next marked level, and the stop is one fifth of that distance."],
      ["lane.half", "FTMO 2", "Live 0.5L2L Directional", "3R", "HALF_LANE_R_MULTIPLE = 3", "Trades the half grid: one midpoint between every pair of marked levels, so the target is nearer and the geometry is three to one."],
      ["lane.blind", "FTMO 3", "Live L2L Blind", "5R", "No directional call", "Trades the original ladder at five to one on its own M5 signal. It reads no Layer 1 call and no Layer 2 output, and it is connected but unarmed."]
    ];
    return `
      <div class="factory-panel" data-factory-panel="lanes" data-factory-lane-active="${esc(activeLane || "")}">
        <h4 class="factory-panel-title">Three traders on one VPS host</h4>
        <div class="factory-lanes">
          ${lanes.map(lane => `
            <button class="factory-lane${lane[0] === activeLane ? " is-active" : ""}${lane[0] === "lane.blind" ? " is-blind" : ""}" type="button" data-factory-lane="${esc(lane[0])}" aria-pressed="${lane[0] === activeLane}">
              <span class="factory-lane-head"><span>${esc(lane[1])}</span><span class="factory-lane-r">${esc(lane[3])}</span></span>
              <span class="factory-lane-name">${esc(lane[2])}</span>
              <span class="factory-lane-rule">${esc(lane[4])}</span>
              <span class="factory-lane-copy">${esc(lane[5])}</span>
            </button>`).join("")}
        </div>
        <p class="factory-panel-note">The first two lanes read the same pair output and hold their own tickets: the geometry differs, the idea does not. The third takes its own signal, which is what makes it blind. Profit leaves an account only through the conditional payout step, and this page reads none of the three accounts.</p>
        <p class="factory-panel-note">The cTrader robot is not a fourth lane: it is a separate component with its own rule, and the repository records no relay that copies one lane's orders into it.</p>
      </div>`;
  }

  // ---------------------------------------------------------------- shell
  // The zones are the only labels the overview shows. Everything else appears as the camera moves closer, which
  // is what keeps the composed view readable.
  const ZONES = [
    { x: X.feed, label: "Incoming feeds", row: 0 },
    { x: X.research, label: "Research", row: 1 },
    { x: X.replay, label: "Replay", row: 0 },
    { x: X.gate, label: "Gate", row: 1 },
    { x: X.core, label: "L1 cores", row: 0 },
    { x: X.join, label: "L2 join", row: 1 },
    { x: X.vps, label: "Execution", row: 0 },
    { x: X.payout, label: "Payout", row: 1 }
  ];

  function factoryShell() {
    return `
      <div class="factory-stage" data-factory-stage>
        <div class="factory-canvas-host" data-factory-scene data-scene-state="loading" tabindex="0"
             role="application" aria-label="Interactive architecture factory with an upper analysis floor and a lower dependency floor. Arrow keys choose, Enter opens, Escape clears the selection.">
          <p class="factory-loading" data-factory-loading>Building the factory…</p>
        </div>
        <div class="factory-labels" data-factory-labels aria-hidden="true"></div>
        <div class="factory-floorbar" role="group" aria-label="Floor view">
          <span class="factory-floorbar-label">Floor</span>
          <button type="button" data-factory-floor="whole" aria-pressed="true">Both</button>
          <button type="button" data-factory-floor="upper" aria-pressed="false">Upper</button>
          <button type="button" data-factory-floor="lower" aria-pressed="false">Lower</button>
        </div>
        <div class="factory-hud">
          <div class="factory-hud-group" role="group" aria-label="Camera controls">
            <button type="button" data-factory-reset>Reset view</button>
            <button type="button" data-factory-zoom="in" aria-label="Zoom in">+</button>
            <button type="button" data-factory-zoom="out" aria-label="Zoom out">−</button>
            <button type="button" data-factory-pause aria-pressed="false">Pause flow</button>
          </div>
          <p class="factory-hud-detail" data-factory-detail>Overview · drag to orbit, scroll to zoom</p>
        </div>
        <p class="factory-illustrative">Illustrative flow · no live data · packets mark documented direction only</p>
      </div>
      <div class="factory-side">
        <div class="factory-journey" data-factory-journey></div>
        <div class="factory-inspector" data-factory-inspector aria-live="polite"></div>
      </div>
      <div class="factory-index" data-factory-index>
        <ol class="factory-legend" aria-label="Column order, left to right">
          ${ZONES.map(zone => `<li>${esc(zone.label)}</li>`).join("")}
        </ol>
        <p class="factory-index-label" id="factoryIndexLabel">Stations · arrow keys choose, Enter opens, Escape clears</p>
        <div class="factory-index-row" role="group" aria-labelledby="factoryIndexLabel"></div>
      </div>
      <div class="factory-dep-index" data-factory-dep-index>
        <p class="factory-index-label" id="factoryDepIndexLabel">Lower floor · inputs, rules, replays and workflows · arrow keys choose, Enter opens</p>
        <div class="factory-dep-index-row" role="group" aria-labelledby="factoryDepIndexLabel"></div>
      </div>`;
  }

  function journeyPanelHtml(state, model) {
    if (!state.journey) {
      return `
        <div class="factory-journey-idle">
          <label class="factory-journey-label" for="factoryJourneySelect">Trace an asset</label>
          <div class="factory-journey-row">
            <select id="factoryJourneySelect" data-factory-journey-select>
              ${JOURNEYS.map(journey => `<option value="${journey.id}">${esc(journey.label)}</option>`).join("")}
            </select>
            <button type="button" class="factory-journey-start" data-factory-journey-start>Start journey</button>
          </div>
          <ul class="factory-journey-options">
            ${JOURNEYS.map(journey => `<li><strong>${esc(journey.label)}.</strong> ${esc(journey.note)}</li>`).join("")}
          </ul>
          <p class="factory-journey-hint">Or orbit the factory and select any station to read its five answers.</p>
        </div>`;
    }
    const journey = JOURNEYS.find(item => item.id === state.journey);
    if (!journey) return "";
    const total = journey.steps.length;
    const index = Math.max(0, Math.min(state.step, total - 1));
    const step = journey.steps[index];
    const station = state.stations.find(item => item.id === step.station);
    let panel = "";
    if (step.panel === "factors") panel = factorsPanel(state.factor);
    else if (step.panel === "tests") panel = testsPanel(state.test);
    else if (step.panel === "pair") panel = pairPanel(state.pair || "EUR_USD", model);
    else if (step.panel === "lanes") panel = lanesPanel(state.lane);
    return `
      <div class="factory-journey-active" data-factory-journey-active="${esc(journey.id)}">
        <div class="factory-journey-head">
          <span class="factory-journey-index" data-factory-journey-index>Step ${index + 1} of ${total}</span>
          <span class="factory-journey-name">${esc(journey.label)}</span>
          <button type="button" data-factory-journey-stop>Exit</button>
        </div>
        <h3 data-factory-journey-title>${esc(step.title)}</h3>
        <p class="factory-journey-body">${esc(step.body)}</p>
        ${station ? `<p class="factory-journey-station">Station: <button type="button" data-factory-station-jump="${esc(station.id)}">${esc(station.label)}</button></p>` : ""}
        <div data-factory-journey-panel>${panel}</div>
        <div class="factory-journey-actions">
          <button type="button" data-factory-journey-back${index === 0 ? " disabled" : ""}>Back</button>
          <button type="button" data-factory-journey-next>${index === total - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>`;
  }

  function indexHtml(stations) {
    return stations.map(station => `
      <button class="factory-index-chip${station.asset ? "" : " is-shared"}" type="button"
              data-factory-station="${esc(station.id)}" id="factory-station-${esc(station.id.replace(/\./g, "-"))}"
              aria-pressed="false">${esc(station.label)}</button>`).join("");
  }

  const DEP_STAGES = [
    ["inputs", "Inputs"],
    ["research", "Research & rules"],
    ["replay", "Replay evidence"],
    ["workflow", "Workflows"],
    ["platform", "Platform"],
    ["archive", "USD archive"]
  ];

  function depIndexHtml(dependencies) {
    return DEP_STAGES.map(([stage, label]) => {
      const items = dependencies.filter(dep => dep.depStage === stage);
      if (!items.length) return "";
      return `<div class="factory-dep-group">
        <p class="factory-dep-group-label">${esc(label)}</p>
        ${items.map(dep => `
          <button class="factory-dep-chip is-${esc(dep.evidence)}" type="button"
                  data-factory-dependency="${esc(dep.id)}" id="factory-dependency-${esc(dep.id.replace(/\./g, "-"))}"
                  aria-pressed="false">${esc(dep.asset || "Shared")} · ${esc(dep.short)}</button>`).join("")}
      </div>`;
    }).join("");
  }

  // ---------------------------------------------------------------- mount
  // One mount per page load. The scene, the inspector, the journeys and the station index share a single state
  // object, so a click in the scene, a chip in the index and a journey step all land on the same selection.
  function mount(options) {
    const THREE = window.THREE;
    const root = options.root;
    const model = options.model;
    const host = root.querySelector("[data-map-factory]");
    if (!host || !THREE || !model) return null;

    // The renderer is created before the shell is built: if the context cannot be made, mount returns null and
    // the host keeps the flat board instead of a half-built scene.
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (error) {
      return null;
    }

    host.innerHTML = factoryShell();

    const sceneHost = host.querySelector("[data-factory-scene]");
    const labelsHost = host.querySelector("[data-factory-labels]");
    const hudDetail = host.querySelector("[data-factory-detail]");
    const inspectorHost = host.querySelector("[data-factory-inspector]");
    const journeyHost = host.querySelector("[data-factory-journey]");
    const indexRow = host.querySelector("[data-factory-index] .factory-index-row");
    const depIndex = host.querySelector("[data-factory-dep-index]");
    const depRow = host.querySelector("[data-factory-dep-index] .factory-dep-index-row");
    const floorButtons = Array.from(host.querySelectorAll("[data-factory-floor]"));

    const stations = buildStations(model);
    const byId = new Map(stations.map(station => [station.id, station]));
    const flowOrder = stations.map(station => station.id);
    const dependencies = dependencyStations(model);
    const depById = new Map(dependencies.map(dep => [dep.id, dep]));
    const depOrder = dependencies.map(dep => dep.id);
    const depsByStation = new Map();
    dependencies.forEach(dep => dep.supports.forEach(id => {
      if (!depsByStation.has(id)) depsByStation.set(id, []);
      depsByStation.get(id).push(dep);
    }));
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 720px)");

    const state = {
      stations,
      dependencies,
      selection: null,
      focusIndex: 0,
      journey: null,
      step: 0,
      factor: null,
      test: "dxy",
      pair: "EUR_USD",
      lane: null,
      paused: false,
      detail: "far",
      floor: narrow.matches ? "upper" : "whole",
      dependencyOrigin: null,
      dependencyReturn: null,
      library: { open: false, asset: null, group: null, doc: null, test: null },
      flow: { open: false, asset: null, node: null },
      drill: null
    };

    indexRow.innerHTML = indexHtml(stations);
    depRow.innerHTML = depIndexHtml(dependencies);
    renderInspector();
    renderJourney();

    function reduced() {
      return motion.matches;
    }

    function selectedStation() {
      if (!state.selection) return null;
      if (state.selection.type === "station") return byId.get(state.selection.id) || null;
      if (state.selection.type === "asset") return byId.get(`${state.selection.id.toLowerCase()}.core`) || null;
      if (state.selection.type === "pair") return byId.get(`pair.${state.selection.id}`) || null;
      return null;
    }

    function selectedDependency() {
      if (!state.selection || state.selection.type !== "dependency") return null;
      return depById.get(state.selection.id) || null;
    }

    // The two drill-downs are offered from the two stations that have a second level: a replay chamber holds a
    // document library, and a Layer 1 core holds an n8n flow. Every station also offers the floor below it, which
    // is where its inputs, rules and evidence sit.
    function actionsFor(station) {
      if (!station) return [];
      if (station.kind === "dependency") {
        const actions = [];
        const origin = state.dependencyOrigin && byId.get(state.dependencyOrigin);
        if (origin) actions.push({ label: `Return to ${origin.label}`, dataset: "data-factory-dependency-return" });
        station.supports.forEach(id => {
          const target = byId.get(id);
          if (target) actions.push({ label: `Open ${target.label}`, dataset: `data-factory-station-jump="${esc(id)}"` });
        });
        actions.push({ label: "Return to the upper floor", dataset: 'data-factory-floor-set="upper"' });
        return actions;
      }
      const floorAction = depsByStation.has(station.id)
        ? [{ label: "Explore dependencies", dataset: `data-factory-dependencies-open="${esc(station.id)}"` }]
        : [];
      if (station.kind === "replay") {
        return floorAction.concat([{ label: "Explore test library", dataset: `data-factory-library-open="${esc(station.asset)}"` }]);
      }
      if (station.kind === "core") {
        return floorAction.concat([{ label: "Inspect n8n flow", dataset: `data-factory-flow-open="${esc(station.asset)}"` }]);
      }
      return floorAction;
    }

    function renderInspector() {
      if (state.library.open) {
        inspectorHost.innerHTML = libraryInspector(state.library);
        return;
      }
      if (state.flow.open) {
        inspectorHost.innerHTML = flowInspector(state.flow);
        return;
      }
      const dependency = selectedDependency();
      if (dependency) {
        inspectorHost.innerHTML = stationInspector(dependency, actionsFor(dependency));
        return;
      }
      const station = selectedStation();
      inspectorHost.innerHTML = station ? stationInspector(station, actionsFor(station)) : emptyInspector();
    }

    function renderJourney() {
      journeyHost.innerHTML = journeyPanelHtml(state, model);
    }

    function syncIndex() {
      const station = selectedStation();
      const dependency = selectedDependency();
      indexRow.querySelectorAll("[data-factory-station]").forEach(button => {
        const on = Boolean(station && button.dataset.factoryStation === station.id);
        button.setAttribute("aria-pressed", String(on));
      });
      depRow.querySelectorAll("[data-factory-dependency]").forEach(button => {
        const on = Boolean(dependency && button.dataset.factoryDependency === dependency.id);
        button.setAttribute("aria-pressed", String(on));
      });
    }

    function setSelection(selection, opts) {
      state.selection = selection;
      if (selection && selection.type === "station") {
        const index = flowOrder.indexOf(selection.id);
        if (index >= 0) state.focusIndex = index;
      } else if (selection && selection.type === "dependency") {
        const index = depOrder.indexOf(selection.id);
        if (index >= 0) state.focusIndex = index;
      }
      applyHighlight(highlightIds(selection));
      renderInspector();
      syncIndex();
      if (!opts || opts.sync !== false) {
        if (typeof options.onSelect === "function") options.onSelect(selection);
      }
    }

    // The ids the scene paints amber. An asset lights its four stations, the junction and its own floor nodes;
    // a pair lights both legs and everything downstream; a station lights itself, its neighbours and the lower
    // nodes it stands on; a dependency lights its supports and the nodes that share them.
    const allConnections = [];

    function highlightIds(selection) {
      const active = new Set();
      if (!selection) return active;
      if (selection.type === "asset") {
        const prefix = selection.id.toLowerCase();
        ["feed", "research", "replay", "core"].forEach(kind => active.add(`${prefix}.${kind}`));
        active.add("join");
        dependencies.forEach(dep => {
          if (dep.asset === selection.id) active.add(dep.id);
        });
      } else if (selection.type === "pair") {
        const pair = model.pairs.find(item => item.code === selection.id);
        if (pair) {
          [pair.target, pair.quote].forEach(code => {
            ["feed", "research", "replay", "core"].forEach(kind => active.add(`${code.toLowerCase()}.${kind}`));
          });
          active.add(`pair.${pair.code}`);
          dependencies.forEach(dep => {
            if (dep.asset === pair.target || dep.asset === pair.quote) active.add(dep.id);
          });
        }
        ["join", "vps", "lane.full", "lane.half", "payout"].forEach(id => active.add(id));
      } else if (selection.type === "station") {
        active.add(selection.id);
        allConnections.forEach(link => {
          if (link.from === selection.id) active.add(link.to);
          if (link.to === selection.id) active.add(link.from);
        });
        (depsByStation.get(selection.id) || []).forEach(dep => active.add(dep.id));
      } else if (selection.type === "dependency") {
        const dep = depById.get(selection.id);
        if (dep) {
          active.add(dep.id);
          dep.supports.forEach(id => active.add(id));
          dependencies.forEach(other => {
            if (other.id !== dep.id && other.supports.some(id => dep.supports.indexOf(id) >= 0)) active.add(other.id);
          });
        }
      }
      return active;
    }

    function journeySelection(step, station) {
      if (!station) return null;
      // The execution journey is about one pair's route, so the junction, the terminal and both lanes keep the
      // whole downstream route lit: the visitor reads a lane's detail without losing the lanes it belongs to.
      const execution = state.journey === "eurusd-execution";
      const downstream = ["join", "vps", "lane", "pair"].indexOf(station.kind) >= 0;
      if (execution && downstream) return { type: "pair", id: state.pair };
      if (station.asset) return { type: "asset", id: station.asset };
      return { type: "station", id: station.id };
    }

    function goToStep(index) {
      const journey = JOURNEYS.find(item => item.id === state.journey);
      if (!journey) return;
      state.step = Math.max(0, Math.min(index, journey.steps.length - 1));
      const step = journey.steps[state.step];
      renderJourney();
      const station = byId.get(step.station);
      setSelection(journeySelection(step, station));
      if (station) focusStation(station.id);
    }

    function startJourney(id) {
      state.journey = id;
      state.step = 0;
      goToStep(0);
    }

    function stopJourney() {
      state.journey = null;
      state.step = 0;
      renderJourney();
      setSelection(null);
      resetView();
    }

    function activeOrder() {
      return state.floor === "lower" ? depOrder : flowOrder;
    }

    function dependencyDomId(id) {
      return `factory-dependency-${id.replace(/\./g, "-")}`;
    }

    function dependencyLabelDomId(id) {
      return `factory-dependency-label-${id.replace(/\./g, "-")}`;
    }

    function activeDomId(id) {
      return state.floor === "lower"
        ? dependencyDomId(id)
        : `factory-station-${id.replace(/\./g, "-")}`;
    }

    function updateActiveDescendant() {
      const order = activeOrder();
      const id = order[state.focusIndex];
      if (id) sceneHost.setAttribute("aria-activedescendant", activeDomId(id));
      else sceneHost.removeAttribute("aria-activedescendant");
    }

    function syncFloorUi() {
      sceneHost.dataset.floor = state.floor;
      depIndex.hidden = state.floor === "upper";
      floorButtons.forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.factoryFloor === state.floor));
      });
    }

    // The floor switch only moves the camera and the floor dressing. It never changes a station, a number or
    // the evidence a page carries; the same scene is read from above or from the lower deck.
    function applyFloor(mode) {
      if (!overviews[mode]) return;
      state.floor = mode;
      overview = overviews[mode];
      syncFloorUi();
      applyFloorScene();
      applyFog();
    }

    function setFloor(mode, opts) {
      if (!overviews[mode]) return;
      if (state.library.open || state.flow.open) closeDrilldown();
      applyFloor(mode);
      if (mode === "upper" && selectedDependency()) {
        state.dependencyOrigin = null;
        state.dependencyReturn = null;
        setSelection(null, { sync: false });
      }
      state.focusIndex = 0;
      updateActiveDescendant();
      hudDetail.textContent = FLOOR_NOTES[mode];
      if (!opts || opts.animate !== false) tweenTo(overview, 860);
      else assignView(overview);
    }

    function pickDependency(id, opts) {
      const dep = depById.get(id);
      if (!dep) return;
      if (state.floor === "upper") applyFloor("lower");
      const index = depOrder.indexOf(id);
      if (index >= 0) state.focusIndex = index;
      updateActiveDescendant();
      setSelection({ type: "dependency", id }, { sync: opts && opts.sync });
      focusDependency(id);
    }

    function enterLowerForStation(id) {
      const origin = byId.get(id);
      if (!origin) return;
      state.dependencyOrigin = id;
      state.dependencyReturn = { floor: state.floor, selection: state.selection };
      applyFloor("lower");
      const deps = depsByStation.get(id) || [];
      if (deps.length) {
        state.focusIndex = depOrder.indexOf(deps[0].id);
        updateActiveDescendant();
        setSelection({ type: "dependency", id: deps[0].id }, { sync: false });
        focusDependency(deps[0].id);
      } else {
        setSelection({ type: "station", id }, { sync: false });
        focusStation(id);
      }
      hudDetail.textContent = `Dependencies · ${origin.label} · the lower floor is filtered by what this station stands on`;
    }

    function returnFromDependency() {
      const back = state.dependencyReturn;
      state.dependencyOrigin = null;
      state.dependencyReturn = null;
      if (back && back.selection) {
        applyFloor(back.floor || "upper");
        setSelection(back.selection, { sync: false });
        const station = selectedStation();
        if (station) focusStation(station.id);
        else if (selectedDependency()) focusDependency(state.selection.id);
        else resetView();
        return;
      }
      setFloor("upper");
    }

    function pickStation(id) {
      if (state.floor === "lower") applyFloor("upper");
      state.dependencyOrigin = null;
      state.dependencyReturn = null;
      setSelection({ type: "station", id });
      focusStation(id);
    }

    function moveFocus(delta) {
      const order = activeOrder();
      const next = (state.focusIndex + delta + order.length) % order.length;
      state.focusIndex = next;
      const id = order[next];
      sceneHost.setAttribute("aria-activedescendant", activeDomId(id));
      if (state.floor === "lower") {
        const dep = depById.get(id);
        if (dep) {
          hudDetail.textContent = `Focused: ${dep.label} · Enter opens it`;
          focusDependency(id);
        }
      } else {
        const station = byId.get(id);
        if (station) {
          hudDetail.textContent = `Focused: ${station.label} · Enter opens it`;
          focusStation(id);
        }
      }
    }

    // ---------------------------------------------------------------- drill-downs
    // Opening a drill-down keeps the station selected and remembers the camera, so closing it returns to the same
    // asset and the same view instead of resetting the visitor to the overview.
    function openLibrary(asset) {
      const library = window.FactoryLibrary;
      const data = library && library.assets[asset];
      if (!data) return;
      state.drill = { selection: state.selection, view: snapshotView(), station: `${asset.toLowerCase()}.replay` };
      state.library = {
        open: true,
        asset,
        group: library.groups[0].id,
        doc: null,
        test: data.tests.length ? data.tests[0].id : null
      };
      state.flow = { open: false, asset: null, node: null };
      setSelection({ type: "station", id: state.drill.station }, { sync: false });
      focusLibrary(state.drill.station);
      hudDetail.textContent = "Library view · the shelf sits under the chamber, the chamber stays above";
      renderInspector();
      requestRender();
    }

    function openFlow(asset) {
      const flows = window.FactoryFlows;
      const data = flows && flows.assets[asset];
      state.drill = { selection: state.selection, view: snapshotView(), station: `${asset.toLowerCase()}.core` };
      state.flow = { open: true, asset, node: data && data.order.length ? data.order[0] : null };
      state.library = { open: false, asset: null, group: null, doc: null, test: null };
      setSelection({ type: "station", id: state.drill.station }, { sync: false });
      focusStation(state.drill.station);
      hudDetail.textContent = "Flow view · the node chain, drawn from the checked-in export";
      renderInspector();
      requestRender();
    }

    function closeDrilldown() {
      if (!state.library.open && !state.flow.open) return;
      const drill = state.drill;
      state.library = { open: false, asset: null, group: null, doc: null, test: null };
      state.flow = { open: false, asset: null, node: null };
      state.drill = null;
      clearLibraryScene();
      if (drill) {
        setSelection(drill.selection, { sync: false });
        hudDetail.textContent = "Overview · drag to orbit, scroll to zoom";
        if (drill.view) tweenTo(drill.view, 620);
        else resetView();
      } else {
        renderInspector();
      }
      requestRender();
    }

    // ---------------------------------------------------------------- DOM wiring
    host.addEventListener("click", event => {
      const target = event.target.closest(
        "[data-factory-station], [data-factory-journey-start], [data-factory-journey-next], [data-factory-journey-back], " +
        "[data-factory-journey-stop], [data-factory-factor], [data-factory-test], [data-factory-pair], [data-factory-lane], " +
        "[data-factory-station-jump], [data-factory-reset], [data-factory-zoom], [data-factory-pause], " +
        "[data-factory-library-open], [data-factory-flow-open], [data-factory-drilldown-close], " +
        "[data-factory-library-group], [data-factory-library-doc], [data-factory-library-test], [data-factory-flow-node], " +
        "[data-factory-floor], [data-factory-floor-set], [data-factory-dependency], [data-factory-dependencies-open], " +
        "[data-factory-dependency-return]"
      );
      if (!target || !host.contains(target)) return;

      const floor = target.dataset.factoryFloor || target.dataset.factoryFloorSet;
      if (floor) {
        setFloor(floor);
        return;
      }
      if (target.dataset.factoryDependency) {
        pickDependency(target.dataset.factoryDependency);
        return;
      }
      if (target.dataset.factoryDependenciesOpen) {
        enterLowerForStation(target.dataset.factoryDependenciesOpen);
        return;
      }
      if (target.hasAttribute("data-factory-dependency-return")) {
        returnFromDependency();
        return;
      }
      if (target.dataset.factoryLibraryOpen) {
        openLibrary(target.dataset.factoryLibraryOpen);
        return;
      }
      if (target.dataset.factoryFlowOpen) {
        openFlow(target.dataset.factoryFlowOpen);
        return;
      }
      if (target.hasAttribute("data-factory-drilldown-close")) {
        closeDrilldown();
        return;
      }
      if (target.dataset.factoryLibraryGroup) {
        state.library = { ...state.library, group: target.dataset.factoryLibraryGroup, doc: null };
        renderInspector();
        syncLibraryScene();
        return;
      }
      if (target.dataset.factoryLibraryDoc) {
        state.library = { ...state.library, doc: target.dataset.factoryLibraryDoc };
        renderInspector();
        return;
      }
      if (target.dataset.factoryLibraryTest) {
        state.library = { ...state.library, test: target.dataset.factoryLibraryTest };
        renderInspector();
        return;
      }
      if (target.dataset.factoryFlowNode) {
        state.flow = { ...state.flow, node: target.dataset.factoryFlowNode };
        renderInspector();
        return;
      }

      if (target.hasAttribute("data-factory-reset")) {
        resetView();
        return;
      }
      if (target.hasAttribute("data-factory-pause")) {
        togglePause();
        return;
      }
      const zoom = target.dataset.factoryZoom;
      if (zoom) {
        zoomBy(zoom === "in" ? -1 : 1);
        return;
      }
      const stationId = target.dataset.factoryStation || target.dataset.factoryStationJump;
      if (stationId) {
        pickStation(stationId);
        return;
      }
      if (target.hasAttribute("data-factory-journey-start")) {
        const select = journeyHost.querySelector("[data-factory-journey-select]");
        startJourney(select ? select.value : JOURNEYS[0].id);
        return;
      }
      if (target.hasAttribute("data-factory-journey-next")) {
        const journey = JOURNEYS.find(item => item.id === state.journey);
        if (journey && state.step >= journey.steps.length - 1) stopJourney();
        else goToStep(state.step + 1);
        return;
      }
      if (target.hasAttribute("data-factory-journey-back")) {
        goToStep(state.step - 1);
        return;
      }
      if (target.hasAttribute("data-factory-journey-stop")) {
        stopJourney();
        return;
      }
      if (target.dataset.factoryFactor) {
        state.factor = target.dataset.factoryFactor;
        renderJourney();
        return;
      }
      if (target.dataset.factoryTest) {
        state.test = target.dataset.factoryTest;
        renderJourney();
        return;
      }
      if (target.dataset.factoryPair) {
        state.pair = target.dataset.factoryPair;
        renderJourney();
        setSelection({ type: "pair", id: state.pair });
        focusStation(`pair.${state.pair}`);
        return;
      }
      if (target.dataset.factoryLane) {
        state.lane = target.dataset.factoryLane;
        renderJourney();
        pickStation(state.lane);
      }
    });

    host.addEventListener("change", event => {
      const select = event.target.closest("[data-factory-journey-select]");
      if (select) startJourney(select.value);
    });

    sceneHost.addEventListener("keydown", event => {
      const key = event.key;
      const drilled = state.library.open || state.flow.open;
      if (drilled && key !== "Escape" && key !== "0" && key !== "p" && key !== "P") return;
      if (key === "ArrowRight" || key === "ArrowDown") moveFocus(1);
      else if (key === "ArrowLeft" || key === "ArrowUp") moveFocus(-1);
      else if (key === "Enter" || key === " " || key === "Spacebar") {
        const id = activeOrder()[state.focusIndex];
        if (!id) return;
        if (state.floor === "lower") pickDependency(id);
        else pickStation(id);
      } else if (key === "Escape") {
        if (drilled) {
          // The drill-down owns this Escape: stop it before the board's own handler clears the whole selection.
          closeDrilldown();
          event.stopPropagation();
        } else if (selectedDependency() && state.dependencyOrigin) {
          returnFromDependency();
        } else {
          setSelection(null);
        }
      }
      else if (key === "+" || key === "=") zoomBy(-1);
      else if (key === "-" || key === "_") zoomBy(1);
      else if (key === "0") resetView();
      else if (key === "p" || key === "P") togglePause();
      else return;
      event.preventDefault();
    });

    motion.addEventListener("change", () => {
      if (reduced()) {
        stopLoop();
        renderOnce();
      } else {
        startLoop();
      }
    });

    // ---------------------------------------------------------------- three.js scene
    const BG = 0x040a12;
    const AMBER = 0xffb84d;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.4, 1400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if ("outputEncoding" in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
    }
    const canvas = renderer.domElement;
    canvas.setAttribute("data-factory-canvas", "");
    canvas.setAttribute("aria-hidden", "true");
    sceneHost.textContent = "";
    sceneHost.appendChild(canvas);

    scene.add(new THREE.HemisphereLight(0x8fe9ff, 0x04101a, 0.9));
    const keyLight = new THREE.DirectionalLight(0xb6f4ff, 0.95);
    keyLight.position.set(38, 74, 42);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffb84d, 0.32);
    rimLight.position.set(-48, 26, -52);
    scene.add(rimLight);
    const floorLight = new THREE.DirectionalLight(0x2f8fb0, 0.4);
    floorLight.position.set(10, -30, 10);
    scene.add(floorLight);

    const world = new THREE.Group();
    scene.add(world);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(210, 130),
      new THREE.MeshStandardMaterial({ color: 0x061422, roughness: 0.92, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(19, -0.02, 0);
    world.add(floor);

    const gridPoints = [];
    for (let x = -84; x <= 124; x += 8) gridPoints.push(x, 0.01, -64, x, 0.01, 64);
    for (let z = -64; z <= 64; z += 8) gridPoints.push(-84, 0.01, z, 124, 0.01, z);
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPoints, 3));
    const grid = new THREE.LineSegments(
      gridGeometry,
      new THREE.LineBasicMaterial({ color: 0x1d6784, transparent: true, opacity: 0.2 })
    );
    world.add(grid);

    // One rail per asset on the floor: the eye reads eight tracks that never touch until the junction.
    const railMaterial = new THREE.LineBasicMaterial({ color: 0x2f9fbe, transparent: true, opacity: 0.16 });
    stations.filter(station => station.asset).forEach(station => {
      const lane = station.pos[2];
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(X.feed - 6, 0.02, lane),
        new THREE.Vector3(X.join - 6, 0.02, lane)
      ]);
      world.add(new THREE.Line(geometry, railMaterial));
    });

    const HEIGHTS = {
      feed: 4.6, research: 3.4, replay: 3.6, core: 5.8, gate: 6.4, join: 6.6,
      pair: 1.6, vps: 7.4, lane: 3.8, payout: 2.4, bank: 3.2,
      "blind-feed": 2.6, "blind-rule": 2.8, relay: 3.6
    };
    const stationHeight = station => (station.id === "lane.half" ? 2.7 : HEIGHTS[station.kind] || 3.2);
    const stationNodes = new Map();
    const spinners = [];
    const pickable = [];

    function makeBody(status) {
      const onboarding = status === "onboarding";
      const blind = status === "blind";
      const relay = status === "relay";
      return new THREE.MeshStandardMaterial({
        color: onboarding ? 0x2a2416 : blind ? 0x0d2b2a : relay ? 0x1d1636 : 0x0f2839,
        emissive: onboarding ? 0x2a1d08 : blind ? 0x0a2b28 : relay ? 0x1a1140 : 0x0a2230,
        emissiveIntensity: 0.9,
        roughness: 0.55,
        metalness: 0.35
      });
    }

    function makeAccent(status) {
      const onboarding = status === "onboarding";
      const conditional = status === "conditional";
      const blind = status === "blind";
      const relay = status === "relay";
      const material = new THREE.MeshStandardMaterial({
        color: onboarding ? 0x8a5a12 : blind ? 0x2f9f7a : relay ? 0x7a5cff : conditional ? 0x3a3520 : 0x2f9fbe,
        emissive: onboarding ? AMBER : blind ? 0x2f9f7a : relay ? 0x6b4dff : conditional ? 0x8a7a3a : 0x33b3d6,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.2
      });
      material.userData.baseEmissive = material.emissive.getHex();
      material.userData.baseIntensity = material.emissiveIntensity;
      return material;
    }

    function addMesh(group, geometry, material, position, rotation) {
      const mesh = new THREE.Mesh(geometry, material);
      if (position) mesh.position.set(position[0], position[1], position[2]);
      if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      group.add(mesh);
      return mesh;
    }

    function buildStationNode(station) {
      const height = stationHeight(station);
      const floating = station.kind === "pair";
      const group = new THREE.Group();
      group.position.set(station.pos[0], floating ? station.pos[1] : 0, station.pos[2]);
      group.userData.stationId = station.id;

      const body = makeBody(station.status);
      const accent = makeAccent(station.status);
      const glass = new THREE.MeshStandardMaterial({
        color: 0x1a4f66, emissive: 0x113b4d, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.3, roughness: 0.18, metalness: 0.1
      });

      switch (station.kind) {
        case "feed": {
          addMesh(group, new THREE.CylinderGeometry(1.2, 1.5, height * 0.68, 18), body, [0, height * 0.34, 0]);
          addMesh(group, new THREE.CylinderGeometry(1.26, 1.26, 0.18, 18), accent, [0, height * 0.7, 0]);
          addMesh(group, new THREE.CylinderGeometry(0.14, 0.14, height * 0.5, 8), accent, [0, height * 0.95, 0]);
          break;
        }
        case "research": {
          addMesh(group, new THREE.BoxGeometry(3.6, 0.36, 2.6), body, [0, 1.5, 0]);
          addMesh(group, new THREE.BoxGeometry(0.28, 1.5, 0.28), body, [-1.5, 0.75, 1.1]);
          addMesh(group, new THREE.BoxGeometry(0.28, 1.5, 0.28), body, [1.5, 0.75, 1.1]);
          addMesh(group, new THREE.BoxGeometry(2.6, 1.5, 0.1), accent, [0, 2.3, -0.9], [-0.34, 0, 0]);
          addMesh(group, new THREE.BoxGeometry(1.5, 0.9, 0.1), accent, [1.0, 2.1, 0.2], [-0.2, -0.6, 0]);
          break;
        }
        case "replay": {
          addMesh(group, new THREE.BoxGeometry(3.2, 2.4, 3.2), glass, [0, 1.3, 0]);
          const ring = addMesh(group, new THREE.TorusGeometry(1.05, 0.1, 8, 32), accent, [0, 1.5, 0], [0, Math.PI / 2, 0]);
          spinners.push({ mesh: ring, speed: 0.9 });
          addMesh(group, new THREE.BoxGeometry(3.4, 0.16, 3.4), body, [0, 2.6, 0]);
          break;
        }
        case "core": {
          addMesh(group, new THREE.CylinderGeometry(1.25, 1.35, 1.2, 16), body, [0, 0.6, 0]);
          const crystal = addMesh(group, new THREE.OctahedronGeometry(1.35, 0), accent, [0, height * 0.52, 0]);
          spinners.push({ mesh: crystal, speed: 0.55 });
          addMesh(group, new THREE.TorusGeometry(1.75, 0.06, 8, 40), accent, [0, 0.06, 0], [Math.PI / 2, 0, 0]);
          break;
        }
        case "gate": {
          const gateSpan = (ORDER.length - 1) * LANE_GAP + 9;
          addMesh(group, new THREE.BoxGeometry(0.5, 4.2, gateSpan), glass, [0, 2.1, 0]);
          addMesh(group, new THREE.BoxGeometry(0.7, 0.3, gateSpan), accent, [0, 4.35, 0]);
          ORDER.forEach((code, index) => {
            addMesh(group, new THREE.BoxGeometry(1.0, 4.2, 0.5), body, [0, 2.1, laneZ(index)]);
            addMesh(group, new THREE.BoxGeometry(1.1, 0.22, 0.6), accent, [0, 4.2, laneZ(index)]);
          });
          break;
        }
        case "join": {
          addMesh(group, new THREE.CylinderGeometry(1.7, 1.9, 3.4, 20), body, [0, 1.7, 0]);
          addMesh(group, new THREE.CylinderGeometry(1.72, 1.72, 0.2, 20), accent, [0, 3.5, 0]);
          const halo = addMesh(group, new THREE.TorusGeometry(4.15, 0.22, 10, 48), accent, [0, 3.7, 0], [Math.PI / 2, 0, 0]);
          spinners.push({ mesh: halo, speed: 0.18 });
          break;
        }
        case "pair": {
          const ring = addMesh(group, new THREE.TorusGeometry(0.78, 0.09, 8, 28), accent, [0, 0, 0], [Math.PI / 2, 0, 0]);
          spinners.push({ mesh: ring, speed: 0.6 });
          break;
        }
        case "vps": {
          addMesh(group, new THREE.BoxGeometry(3.0, 5.4, 3.0), body, [0, 2.7, 0]);
          [1.7, 2.9, 4.1].forEach(y => addMesh(group, new THREE.BoxGeometry(3.7, 0.16, 3.7), accent, [0, y, 0]));
          addMesh(group, new THREE.BoxGeometry(2.2, 0.6, 2.2), accent, [0, 5.7, 0]);
          break;
        }
        case "lane": {
          addMesh(group, new THREE.BoxGeometry(6.2, height, 2.6), body, [0, height / 2, 0]);
          [-2.0, 0, 2.0].forEach(x => addMesh(group, new THREE.BoxGeometry(0.9, 0.16, 2.2), accent, [x, height + 0.1, 0]));
          break;
        }
        case "blind-feed": {
          addMesh(group, new THREE.CylinderGeometry(0.9, 1.15, height * 0.7, 14), body, [0, height * 0.35, 0]);
          addMesh(group, new THREE.CylinderGeometry(0.95, 0.95, 0.16, 14), accent, [0, height * 0.72, 0]);
          addMesh(group, new THREE.CylinderGeometry(0.1, 0.1, height * 0.4, 8), accent, [0, height * 0.95, 0]);
          break;
        }
        case "blind-rule": {
          addMesh(group, new THREE.BoxGeometry(2.8, 0.3, 2.2), body, [0, 0.85, 0]);
          addMesh(group, new THREE.BoxGeometry(2.2, 1.2, 0.12), accent, [0, 1.7, -0.6], [-0.5, 0, 0]);
          addMesh(group, new THREE.BoxGeometry(0.9, 0.08, 1.4), accent, [0.95, 1.05, 0.3], [0, 0.4, 0]);
          break;
        }
        case "relay": {
          addMesh(group, new THREE.CylinderGeometry(0.42, 0.42, 2.6, 12), body, [0, 1.3, 0]);
          addMesh(group, new THREE.TorusGeometry(1.65, 0.15, 10, 40), accent, [0, 2.0, 0], [Math.PI / 2, 0, 0]);
          const node = addMesh(group, new THREE.OctahedronGeometry(0.8, 0), accent, [0, 3.5, 0]);
          spinners.push({ mesh: node, speed: 0.7 });
          break;
        }
        case "payout": {
          addMesh(group, new THREE.CylinderGeometry(1.7, 1.7, 0.4, 20), body, [0, 1.3, 0]);
          addMesh(group, new THREE.TorusGeometry(1.2, 0.1, 8, 32), accent, [0, 1.55, 0], [Math.PI / 2, 0, 0]);
          break;
        }
        default: {
          addMesh(group, new THREE.BoxGeometry(2.6, 2.6, 2.6), body, [0, 1.3, 0]);
          addMesh(group, new THREE.BoxGeometry(3.0, 0.24, 3.0), accent, [0, 2.7, 0]);
          break;
        }
      }

      group.traverse(child => {
        if (child.isMesh) {
          child.userData.stationId = station.id;
          pickable.push(child);
        }
      });
      world.add(group);
      return { group, body, accent, glass, height };
    }

    stations.forEach(station => stationNodes.set(station.id, buildStationNode(station)));

    // ---------------------------------------------------------------- document library
    // The shelf under a chamber is built only while that library is open, so the overview keeps its composed shape.
    // Five plaques stand in investigation order, each carrying one group, and the selected group is painted amber.
    const libraryRoot = new THREE.Group();
    world.add(libraryRoot);
    const libraryPickable = [];
    const libraryLabels = [];
    let libraryAsset = null;

    function clearLibraryScene() {
      libraryPickable.length = 0;
      libraryLabels.forEach(entry => {
        if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
      });
      libraryLabels.length = 0;
      while (libraryRoot.children.length) {
        const child = libraryRoot.children.pop();
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      }
      libraryAsset = null;
    }

    function buildLibraryScene(assetCode) {
      if (libraryAsset === assetCode) return;
      clearLibraryScene();
      const library = window.FactoryLibrary;
      const station = byId.get(`${assetCode.toLowerCase()}.replay`);
      if (!library || !station) return;
      libraryAsset = assetCode;
      const body = new THREE.MeshStandardMaterial({
        color: 0x11324a, emissive: 0x0d2c40, emissiveIntensity: 1.0, roughness: 0.55, metalness: 0.32
      });
      const accentBase = new THREE.MeshStandardMaterial({
        color: 0x2f9fbe, emissive: 0x33b3d6, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2
      });
      const floorY = -3.6;
      const shortNames = ["Research", "Model", "Inputs", "Replay", "Results"];
      library.groups.forEach((group, index) => {
        const x = station.pos[0] + (index - 2) * 4.5;
        const accent = accentBase.clone();
        accent.userData.baseEmissive = accent.emissive.getHex();
        const slab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.42, 2.8), body.clone());
        slab.position.set(x, floorY + index * 0.22, station.pos[2]);
        slab.userData.stationId = `${assetCode.toLowerCase()}.replay`;
        slab.userData.libraryGroup = group.id;
        libraryRoot.add(slab);
        libraryPickable.push(slab);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.1, 3.1), accent);
        cap.position.set(x, floorY + index * 0.22 + 0.3, station.pos[2]);
        cap.userData.stationId = slab.userData.stationId;
        cap.userData.libraryGroup = group.id;
        cap.userData.libraryAccent = accent;
        libraryRoot.add(cap);
        libraryPickable.push(cap);
        const count = library.documentsFor(assetCode, group.id).length;
        const el = document.createElement("span");
        el.className = "factory-library-label";
        el.dataset.factoryLibraryLabel = group.id;
        el.innerHTML = `<span class="factory-library-label-name">${esc(shortNames[index] || group.label)}</span> <span class="factory-library-label-count">${
          count ? `${count} ${count === 1 ? "doc" : "docs"}` : "gap"
        }</span>`;
        labelsHost.appendChild(el);
        libraryLabels.push({
          el,
          group: group.id,
          accent,
          cap,
          position: new THREE.Vector3(x, floorY + index * 0.22 + (index % 2 ? 1.9 : 1.1), station.pos[2])
        });
      });
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 3.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x2f9fbe, emissive: 0x33b3d6, emissiveIntensity: 0.5, transparent: true, opacity: 0.5 })
      );
      shaft.position.set(station.pos[0], floorY + 1.6, station.pos[2]);
      libraryRoot.add(shaft);
      syncLibraryScene();
    }

    function syncLibraryScene() {
      const active = state.library.open ? state.library.group : null;
      libraryLabels.forEach(entry => {
        const on = entry.group === active;
        entry.accent.emissive.setHex(on ? AMBER : entry.accent.userData.baseEmissive);
        entry.accent.emissiveIntensity = on ? 1.9 : 0.6;
        entry.el.classList.toggle("is-active", on);
      });
      requestRender();
    }


    // ---------------------------------------------------------------- labels
    // Labels live in the DOM, not on a texture: they stay crisp at any zoom, they carry real text for assistive
    // technology, and the overview can show a handful while the close view shows all of them.
    const labelSpans = new Map();
    const zoneLabels = [];

    stations.forEach(station => {
      const el = document.createElement("span");
      el.className = "factory-label";
      el.dataset.factoryLabel = station.id;
      const code = stationCode(station);
      el.innerHTML = `<span class="factory-label-code">${esc(code)}</span><span class="factory-label-name">${esc(station.label)}</span><span class="factory-label-sub">${esc(station.sub)}</span>`;
      labelsHost.appendChild(el);
      labelSpans.set(station.id, el);
    });

    ZONES.forEach(zone => {
      const el = document.createElement("span");
      el.className = "factory-zone";
      el.textContent = zone.label;
      labelsHost.appendChild(el);
      // The zone row is the column header, laid on the near edge of the floor in two staggered rows so the short
      // column names never collide: the overview reads as named columns without labelling every station.
      zoneLabels.push({ el, position: new THREE.Vector3(zone.x, zone.row ? 1.4 : 5.4, 34) });
    });

    function stationCode(station) {
      if (station.asset) return station.asset;
      if (station.kind === "pair") return station.pair.replace("_", "/");
      if (station.kind === "lane") {
        if (station.id === "lane.half") return "3R";
        if (station.id === "lane.blind") return "5R·B";
        return "5R";
      }
      if (station.kind === "join") return "L2";
      if (station.kind === "vps") return "VPS";
      if (station.kind === "gate") return "GATE";
      if (station.kind === "payout") return "PAY";
      if (station.kind === "relay") return "cT";
      if (station.kind === "blind-feed") return "M5";
      if (station.kind === "blind-rule") return "RULE";
      return "BANK";
    }

    function labelAnchor(station) {
      const y = station.kind === "pair" ? station.pos[1] + 1.5 : stationHeight(station) + 1.7;
      return new THREE.Vector3(station.pos[0], y, station.pos[2]);
    }

    // ---------------------------------------------------------------- lower floor scene
    // The lower deck is a single slab with one small node per stored input, rulebook, replay evidence and
    // documented workflow. Each node carries its evidence colour on the cap only, so a documented workflow can
    // never be mistaken for a live run. The verticals are faint: they show what a node supports, not traffic.
    const lowerRoot = new THREE.Group();
    world.add(lowerRoot);
    const dependencyNodes = new Map();
    const dependencyPickable = [];
    const dependencyLabels = [];
    const dependencyConnections = [];
    let dependencyDeck = null;

    function makeEvidenceAccent(evidence) {
      const info = EVIDENCE[evidence] || EVIDENCE.documented;
      const material = new THREE.MeshStandardMaterial({
        color: info.color, emissive: info.color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.2
      });
      material.userData.baseEmissive = material.emissive.getHex();
      material.userData.baseIntensity = material.emissiveIntensity;
      return material;
    }

    function buildDependencyNode(dep) {
      const height = dep.height || 2.0;
      const group = new THREE.Group();
      group.position.set(dep.pos[0], LOWER_Y, dep.pos[2]);
      group.userData.dependencyId = dep.id;
      const body = makeBody("shared");
      const accent = makeEvidenceAccent(dep.evidence);

      const plinth = addMesh(group, new THREE.BoxGeometry(3.2, 0.3, 3.2), body, [0, 0.15, 0]);
      plinth.userData.dependencyId = dep.id;
      if (dep.depKind === "storage") {
        addMesh(group, new THREE.CylinderGeometry(1.15, 1.3, height * 0.8, 14), body, [0, height * 0.4 + 0.2, 0]);
        addMesh(group, new THREE.CylinderGeometry(1.18, 1.18, 0.18, 14), accent, [0, height * 0.82 + 0.2, 0]);
      } else if (dep.depKind === "workflow") {
        addMesh(group, new THREE.BoxGeometry(2.8, height * 0.8, 0.5), body, [0, height * 0.4 + 0.2, 0]);
        [0.34, 0.62].forEach((ratio, index) => {
          addMesh(group, new THREE.BoxGeometry(2.2 - index * 0.4, 0.22, 0.62), accent, [0, height * ratio + 0.2, 0]);
        });
      } else if (dep.depKind === "result") {
        addMesh(group, new THREE.BoxGeometry(2.4, height * 0.55, 2.2), body, [0, height * 0.28 + 0.2, 0]);
        addMesh(group, new THREE.OctahedronGeometry(0.8, 0), accent, [0, height * 0.72 + 0.2, 0]);
      } else if (dep.depKind === "relay") {
        addMesh(group, new THREE.CylinderGeometry(0.4, 0.4, height * 0.6, 10), body, [0, height * 0.3 + 0.2, 0]);
        const ring = addMesh(group, new THREE.TorusGeometry(1.3, 0.12, 8, 28), accent, [0, height * 0.68 + 0.2, 0], [Math.PI / 2, 0, 0]);
        spinners.push({ mesh: ring, speed: 0.35 });
      } else {
        addMesh(group, new THREE.BoxGeometry(2.6, height * 0.75, 1.9), body, [0, height * 0.38 + 0.2, 0]);
        addMesh(group, new THREE.BoxGeometry(2.75, 0.16, 2.05), accent, [0, height * 0.78 + 0.2, 0]);
      }

      group.traverse(child => {
        if (child.isMesh) {
          child.userData.dependencyId = dep.id;
          dependencyPickable.push(child);
        }
      });
      lowerRoot.add(group);
      return { group, body, accent, height };
    }

    function buildLowerFloor() {
      dependencyDeck = new THREE.Mesh(
        new THREE.BoxGeometry(160, 0.5, 140),
        new THREE.MeshStandardMaterial({ color: 0x061524, emissive: 0x04101c, emissiveIntensity: 0.5, roughness: 0.92, metalness: 0.08 })
      );
      dependencyDeck.position.set(2, LOWER_Y - 0.35, 0);
      lowerRoot.add(dependencyDeck);
      const gridPoints = [];
      for (let x = -76; x <= 80; x += 8) gridPoints.push(x, LOWER_Y - 0.08, -68, x, LOWER_Y - 0.08, 68);
      for (let z = -68; z <= 68; z += 8) gridPoints.push(-76, LOWER_Y - 0.08, z, 80, LOWER_Y - 0.08, z);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPoints, 3));
      lowerRoot.add(new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x2f6f8a, transparent: true, opacity: 0.16 })
      ));

      dependencies.forEach(dep => {
        dependencyNodes.set(dep.id, buildDependencyNode(dep));
        dep.supports.forEach(stationId => {
          const station = byId.get(stationId);
          if (!station) return;
          const start = new THREE.Vector3(dep.pos[0], LOWER_Y + dep.height + 0.35, dep.pos[2]);
          const end = new THREE.Vector3(station.pos[0], station.pos[1] || 0.2, station.pos[2]);
          const material = new THREE.LineDashedMaterial({
            color: 0x5f93a8, dashSize: 0.8, gapSize: 1.6, transparent: true, opacity: 0.14
          });
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material);
          if (line.computeLineDistances) line.computeLineDistances();
          lowerRoot.add(line);
          dependencyConnections.push({ from: dep.id, to: stationId, line, material, baseOpacity: material.opacity });
        });
        const el = document.createElement("span");
        el.className = `factory-label is-dependency is-${dep.evidence}`;
        el.dataset.factoryDependencyLabel = dep.id;
        el.id = dependencyLabelDomId(dep.id);
        el.innerHTML = `<span class="factory-label-code">${esc(dep.asset || "Shared")}</span><span class="factory-label-name">${esc(dep.short)}</span><span class="factory-label-sub">${esc(dep.evidenceShort)}</span>`;
        labelsHost.appendChild(el);
        dependencyLabels.push({ dep, el });
      });
    }

    function applyFloorScene() {
      const lower = state.floor === "lower";
      const upper = state.floor === "upper";
      lowerRoot.visible = !upper;
      dependencyConnections.forEach(link => { link.line.visible = state.floor === "whole"; });
      stationNodes.forEach(node => { node.group.visible = !lower; });
      allConnections.forEach(link => { link.line.visible = !lower; });
      packetPoints.visible = !lower;
      floor.visible = !lower;
      grid.visible = !lower;
    }

    function applyFog() {
      scene.fog = new THREE.Fog(BG, overview.distance * 1.05, overview.distance * 2.6);
    }

    buildLowerFloor();

    // ---------------------------------------------------------------- connections
    // Every link is a polyline so the converging corners read as a bus rather than a web. The junction is the
    // only place where a lane's z changes before the execution split.
    function polyline(fromId, toId) {
      const from = byId.get(fromId);
      const to = byId.get(toId);
      if (!from || !to) return null;
      const a = new THREE.Vector3(from.port[0], from.port[1], from.port[2]);
      const b = new THREE.Vector3(to.port[0], to.port[1], to.port[2]);
      const points = [a];
      if (Math.abs(a.z - b.z) > 0.05) {
        const turn = b.x > a.x ? Math.max(a.x + 2, b.x - 6) : b.x + 6;
        points.push(new THREE.Vector3(turn, a.y, a.z));
        points.push(new THREE.Vector3(turn, b.y, b.z));
      }
      points.push(b);
      return points;
    }

    const connectionDefs = [];
    model.assets.forEach(asset => {
      const prefix = asset.code.toLowerCase();
      connectionDefs.push([`${prefix}.feed`, `${prefix}.research`]);
      connectionDefs.push([`${prefix}.research`, `${prefix}.replay`]);
      connectionDefs.push([`${prefix}.replay`, `${prefix}.core`]);
      connectionDefs.push([`${prefix}.core`, "join"]);
    });
    connectionDefs.push(["join", "vps"]);
    connectionDefs.push(["vps", "lane.full"]);
    connectionDefs.push(["vps", "lane.half"]);
    connectionDefs.push(["lane.full", "payout"]);
    connectionDefs.push(["lane.half", "payout"]);
    connectionDefs.push(["payout", "bank"]);

    // The blind trader's own chain, and the two hosting links. A hosting link says only that the component runs on the
    // same host; it is dotted and grey, and it is never counted as data flowing between two stations.
    connectionDefs.push(["lane.blind.feed", "lane.blind.deviation"]);
    connectionDefs.push(["lane.blind.deviation", "lane.blind"]);
    const hostingDefs = [
      ["vps", "lane.blind"],
      ["vps", "relay.ctrader"]
    ];

    function buildConnection(fromId, toId, style) {
      const points = polyline(fromId, toId);
      if (!points) return;
      const hosting = style === "hosting";
      const conditional = fromId === "payout" || toId === "payout" || fromId === "bank";
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = hosting
        ? new THREE.LineDashedMaterial({ color: 0x6f8fa2, dashSize: 0.7, gapSize: 1.4, transparent: true, opacity: 0.34 })
        : conditional
          ? new THREE.LineDashedMaterial({ color: 0x6f8fa2, dashSize: 1.3, gapSize: 1.1, transparent: true, opacity: 0.5 })
          : new THREE.LineBasicMaterial({ color: 0x2f9fbe, transparent: true, opacity: 0.42 });
      const line = new THREE.Line(geometry, material);
      if (hosting || conditional) {
        if (line.computeLineDistances) line.computeLineDistances();
      }
      world.add(line);
      let length = 0;
      for (let i = 1; i < points.length; i += 1) length += points[i].distanceTo(points[i - 1]);
      allConnections.push({
        from: fromId,
        to: toId,
        hosting,
        conditional,
        points,
        length: Math.max(length, 0.001),
        line,
        material,
        baseColor: material.color.getHex(),
        baseOpacity: material.opacity
      });
    }

    connectionDefs.forEach(([fromId, toId]) => buildConnection(fromId, toId));
    hostingDefs.forEach(([fromId, toId]) => buildConnection(fromId, toId, "hosting"));

    // ---------------------------------------------------------------- packets
    // Small points travel along each link in the documented direction. They are illustration only: a packet does
    // not mean a message was sent, and the HUD says so.
    const packetRecords = [];
    allConnections.forEach(link => {
      const count = link.conditional ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        packetRecords.push({ link, t: (i + 0.5) / count, speed: link.conditional ? 3.0 : 6.2 });
      }
    });

    const packetPositions = new Float32Array(packetRecords.length * 3);
    const packetColors = new Float32Array(packetRecords.length * 3);
    const packetGeometry = new THREE.BufferGeometry();
    packetGeometry.setAttribute("position", new THREE.BufferAttribute(packetPositions, 3));
    packetGeometry.setAttribute("color", new THREE.BufferAttribute(packetColors, 3));
    const packetMaterial = new THREE.PointsMaterial({
      size: 0.6, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false
    });
    const packetPoints = new THREE.Points(packetGeometry, packetMaterial);
    world.add(packetPoints);

    function pointAlong(points, t) {
      const lengths = [];
      let total = 0;
      for (let i = 1; i < points.length; i += 1) {
        const segment = points[i].distanceTo(points[i - 1]);
        lengths.push(segment);
        total += segment;
      }
      if (total <= 0) return points[0].clone();
      let travelled = t * total;
      for (let i = 0; i < lengths.length; i += 1) {
        if (travelled <= lengths[i]) {
          const ratio = lengths[i] === 0 ? 0 : travelled / lengths[i];
          return points[i].clone().lerp(points[i + 1], ratio);
        }
        travelled -= lengths[i];
      }
      return points[points.length - 1].clone();
    }

    const amber = new THREE.Color(AMBER);
    const packetCyan = new THREE.Color(0x7fe8ff);

    function updatePackets(dt) {
      packetRecords.forEach((packet, index) => {
        if (!state.paused) {
          packet.t += (dt * packet.speed) / packet.link.length;
          if (packet.t > 1) packet.t -= 1;
        }
        const point = pointAlong(packet.link.points, packet.t);
        packetPositions[index * 3] = point.x;
        packetPositions[index * 3 + 1] = point.y;
        packetPositions[index * 3 + 2] = point.z;
        const on = activeSet.has(packet.link.from) && activeSet.has(packet.link.to);
        const color = on ? amber : packetCyan;
        packetColors[index * 3] = color.r;
        packetColors[index * 3 + 1] = color.g;
        packetColors[index * 3 + 2] = color.b;
      });
      packetGeometry.attributes.position.needsUpdate = true;
      packetGeometry.attributes.color.needsUpdate = true;
    }

    let activeSet = new Set();

    function applyHighlight(active) {
      activeSet = active;
      const has = active.size > 0;
      stationNodes.forEach((node, id) => {
        const on = active.has(id);
        const dim = has && !on;
        node.accent.emissive.setHex(on ? AMBER : node.accent.userData.baseEmissive);
        node.accent.emissiveIntensity = on ? 2.1 : dim ? 0.45 : node.accent.userData.baseIntensity;
        node.body.emissiveIntensity = dim ? 0.28 : 0.9;
        const label = labelSpans.get(id);
        if (label) {
          label.classList.toggle("is-active", on);
          label.classList.toggle("is-dim", dim);
        }
      });
      allConnections.forEach(link => {
        const on = active.has(link.from) && active.has(link.to);
        const dim = has && !on;
        link.material.color.setHex(on ? AMBER : link.baseColor);
        link.material.opacity = on ? 0.95 : dim ? 0.1 : link.baseOpacity;
      });
      dependencyNodes.forEach((node, id) => {
        const on = active.has(id);
        const dim = has && !on;
        node.accent.emissive.setHex(on ? AMBER : node.accent.userData.baseEmissive);
        node.accent.emissiveIntensity = on ? 2.0 : dim ? 0.4 : node.accent.userData.baseIntensity;
        node.body.emissiveIntensity = dim ? 0.28 : 0.9;
        const label = dependencyLabels.find(entry => entry.dep.id === id);
        if (label) {
          label.el.classList.toggle("is-active", on);
          label.el.classList.toggle("is-dim", dim);
        }
      });
      dependencyConnections.forEach(link => {
        const on = active.has(link.from) && active.has(link.to);
        const dim = has && !on;
        link.material.color.setHex(on ? AMBER : 0x5f93a8);
        link.material.opacity = on ? 0.9 : dim ? 0.04 : link.baseOpacity;
      });
      requestRender();
    }

    // ---------------------------------------------------------------- camera
    // The view is a target, an azimuth, a polar angle and a distance. Everything - orbit, zoom, focus, reset -
    // moves those four numbers, so no control can leave the camera somewhere the others cannot describe.
    const view = { target: new THREE.Vector3(19, 3, 0), theta: 0.42, phi: 1.0, distance: 170 };
    const overviews = { whole: null, upper: null, lower: null };
    let overview = { target: view.target.clone(), theta: view.theta, phi: view.phi, distance: view.distance };
    let tween = null;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    function applyView() {
      camera.position.setFromSphericalCoords(view.distance, view.phi, view.theta).add(view.target);
      camera.lookAt(view.target);
    }

    function frameFor(framePoints, theta, phi) {
      // Frame what is drawn, not an empty box: the station bodies and their tops are the only things a visitor
      // needs to see, and framing a padded box would push the camera back into empty space.
      const box = new THREE.Box3();
      framePoints.forEach(point => box.expandByPoint(point));
      const center = box.getCenter(new THREE.Vector3());
      const probe = new THREE.PerspectiveCamera(camera.fov, Math.max(camera.aspect, 0.2), 0.1, 6000);
      let distance = 150;
      for (let pass = 0; pass < 10; pass += 1) {
        probe.position.setFromSphericalCoords(distance, phi, theta).add(center);
        probe.lookAt(center);
        probe.updateMatrixWorld();
        probe.updateProjectionMatrix();
        let spread = 0;
        framePoints.forEach(point => {
          const projected = point.clone().project(probe);
          spread = Math.max(spread, Math.abs(projected.x), Math.abs(projected.y));
        });
        const ratio = spread / 0.9;
        if (Math.abs(ratio - 1) < 0.015) break;
        distance *= ratio;
      }
      return { target: center, theta, phi, distance: Math.max(40, Math.min(distance, 420)) };
    }

    function computeOverview() {
      const upperPoints = [];
      stations.forEach(station => {
        upperPoints.push(new THREE.Vector3(station.pos[0], 0, station.pos[2]));
        upperPoints.push(new THREE.Vector3(station.pos[0], stationHeight(station), station.pos[2]));
      });
      const lowerPoints = [];
      dependencies.forEach(dep => {
        lowerPoints.push(new THREE.Vector3(dep.pos[0], LOWER_Y, dep.pos[2]));
        lowerPoints.push(new THREE.Vector3(dep.pos[0], LOWER_Y + dep.height, dep.pos[2]));
      });
      overviews.upper = frameFor(upperPoints, 0.16, 0.76);
      overviews.lower = frameFor(lowerPoints, 0.14, 0.64);
      overviews.whole = frameFor(upperPoints.concat(lowerPoints), 0.18, 0.92);
      overview = overviews[state.floor] || overviews.whole;
      applyFog();
    }

    function snapshotView() {
      return { target: view.target.clone(), theta: view.theta, phi: view.phi, distance: view.distance };
    }

    function assignView(goal) {
      view.target.copy(goal.target);
      view.theta = goal.theta;
      view.phi = goal.phi;
      view.distance = goal.distance;
      tween = null;
      applyView();
      requestRender();
    }

    function tweenTo(goal, ms) {
      if (reduced()) {
        assignView(goal);
        return;
      }
      tween = { from: snapshotView(), to: goal, start: performance.now(), ms: ms || 720 };
      startLoop();
    }

    function updateTween(now) {
      if (!tween) return;
      const progress = clamp((now - tween.start) / tween.ms, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      view.target.lerpVectors(tween.from.target, tween.to.target, eased);
      view.theta = tween.from.theta + (tween.to.theta - tween.from.theta) * eased;
      view.phi = tween.from.phi + (tween.to.phi - tween.from.phi) * eased;
      view.distance = tween.from.distance + (tween.to.distance - tween.from.distance) * eased;
      applyView();
      if (progress >= 1) tween = null;
    }

    function resetView(animate) {
      const goal = {
        target: overview.target.clone(), theta: overview.theta, phi: overview.phi, distance: overview.distance
      };
      if (animate === false || reduced()) assignView(goal);
      else tweenTo(goal);
    }

    function zoomBy(direction) {
      const distance = clamp(view.distance * (direction < 0 ? 0.82 : 1.22), 16, overview.distance * 2.2);
      tweenTo({ target: view.target.clone(), theta: view.theta, phi: view.phi, distance }, 420);
    }

    function focusStation(id) {
      const station = byId.get(id);
      if (!station) return;
      // A lane station is a detail stop: get close. A shared station is where the lanes meet or leave, so keep
      // its neighbours in the frame - that is the point of the stop.
      const shared = !station.asset;
      tweenTo({
        target: new THREE.Vector3(station.pos[0], station.pos[1] * 0.6 + 1.6, station.pos[2]),
        theta: view.theta,
        phi: clamp(view.phi, 0.62, 1.2),
        distance: clamp(overview.distance * (shared ? 0.94 : 0.72), 52, 140)
      }, 760);
    }

    function focusDependency(id) {
      const dep = depById.get(id);
      if (!dep) return;
      const base = overviews.lower || overview;
      tweenTo({
        target: new THREE.Vector3(dep.pos[0], LOWER_Y + (dep.height || 2) * 0.6, dep.pos[2]),
        theta: view.theta,
        phi: clamp(view.phi, 0.52, 1.24),
        distance: clamp(base.distance * 0.34, 26, 96)
      }, 720);
    }

    // The library view goes under the chamber: the target drops below the floor and the polar angle passes 90
    // degrees, so the camera looks up at the shelf with the chamber above it in the same frame. The floor plane is
    // single-sided, so it does not block the view from below.
    function focusLibrary(stationId) {
      const station = byId.get(stationId);
      if (!station || !station.asset) return;
      buildLibraryScene(station.asset);
      tweenTo({
        target: new THREE.Vector3(station.pos[0], -2.2, station.pos[2]),
        theta: view.theta,
        phi: 1.9,
        distance: clamp(overview.distance * 0.26, 28, 46)
      }, 820);
    }

    // ---------------------------------------------------------------- label placement
    function detailFor(distance) {
      if (distance <= overview.distance * 0.45) return "near";
      if (distance <= overview.distance * 0.75) return "mid";
      return "far";
    }

    function visibleAt(station, detail) {
      if (detail === "near") return true;
      if (detail === "mid") return ["feed", "core", "join", "vps", "lane", "gate"].indexOf(station.kind) >= 0;
      return station.kind === "feed";
    }

    function projectLabel(position, rect) {
      const projected = position.clone().project(camera);
      if (projected.z > 1) return null;
      return {
        x: clamp((projected.x * 0.5 + 0.5) * rect.width, 46, rect.width - 46),
        y: clamp((-projected.y * 0.5 + 0.5) * rect.height, 24, rect.height - 24)
      };
    }

    // Labels are placed greedily: the active route first, then the opened station, then the rest of the frame.
    // A label that would land on one already placed stays hidden, which is what keeps a close view readable
    // instead of stacking forty boxes on top of each other.
    function updateLabels() {
      camera.updateMatrixWorld();
      const rect = sceneHost.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const detail = detailFor(view.distance);
      if (labelsHost.dataset.detail !== detail) labelsHost.dataset.detail = detail;
      if (detail !== state.detail) {
        state.detail = detail;
        hudDetail.textContent = state.library.open
          ? "Library view · the shelf sits under the chamber, the chamber stays above"
          : state.floor === "lower"
            ? detail === "far"
              ? "Lower floor · every node names the evidence it stands on"
              : "Lower floor · select a node to read what it holds and what it feeds"
            : detail === "far"
              ? "Overview · drag to orbit, scroll to zoom"
              : detail === "mid"
                ? "Closer view · select a station to open its inspector"
                : "Detail view · every station carries its five answers";
      }

      const opened = selectedStation();
      const openedDependency = selectedDependency();
      const ordered = stations.map(station => ({
        station,
        priority: activeSet.has(station.id) ? 0 : opened && opened.id === station.id ? 1 : 2
      }));
      ordered.sort((a, b) => a.priority - b.priority);

      const placed = [];
      const libraryOpen = state.library.open;
      const chamberId = libraryOpen ? `${String(state.library.asset).toLowerCase()}.replay` : null;
      ordered.forEach(entry => {
        const station = entry.station;
        const el = labelSpans.get(station.id);
        if (!el) return;
        if (state.floor === "lower") {
          el.classList.add("is-hidden");
          return;
        }
        // With a library open, the shelf is the subject: only the chamber above it keeps its label.
        if (libraryOpen && station.id !== chamberId) {
          el.classList.add("is-hidden");
          return;
        }
        const show = entry.priority < 2 || visibleAt(station, detail);
        if (!show) {
          el.classList.add("is-hidden");
          return;
        }
        const point = projectLabel(labelAnchor(station), rect);
        if (!point) {
          el.classList.add("is-behind");
          return;
        }
        const compact = detail !== "near";
        const width = station.label.length * 7.2 + 20;
        const height = detail === "far" ? 18 : compact ? 20 : 32;
        const box = { left: point.x - width / 2, right: point.x + width / 2, top: point.y - height, bottom: point.y };
        const collides = placed.some(other => !(box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom));
        const underHud = point.y > rect.height - 56 && entry.priority === 2;
        if (collides || underHud) {
          el.classList.add("is-hidden");
          return;
        }
        placed.push(box);
        el.classList.remove("is-hidden");
        el.classList.remove("is-behind");
        el.classList.toggle("is-compact", compact);
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
      });

      // Lower-floor labels are drawn on their own pass. In the both-floor view only the selected node and its
      // supports are named; on the lower deck the near view names every node, and collision still hides the rest.
      const lowerVisible = state.floor !== "upper";
      const dependencyOrdered = dependencyLabels.slice().sort((a, b) => {
        const priority = entry => activeSet.has(entry.dep.id) ? 0 : openedDependency && openedDependency.id === entry.dep.id ? 1 : 2;
        return priority(a) - priority(b);
      });
      dependencyOrdered.forEach(entry => {
        const dep = entry.dep;
        const el = entry.el;
        if (!lowerVisible) {
          el.classList.add("is-hidden");
          return;
        }
        const priority = activeSet.has(dep.id) ? 0 : openedDependency && openedDependency.id === dep.id ? 1 : 2;
        // The lower deck is where the evidence lives, so every node there is a candidate for a label. The
        // composed and upper views name only the selected node and the supports it stands on. Collision below
        // still trims the deck when the camera is far away, and priority keeps the selected node readable.
        const show = state.floor === "lower" || priority < 2;
        if (!show) {
          el.classList.add("is-hidden");
          return;
        }
        const identity = `${dep.asset || "Shared"} ${dep.short}`;
        const width = Math.max(identity.length, dep.evidenceShort.length) * 7.2 + 24;
        const height = 32;
        const point = projectLabel(new THREE.Vector3(dep.pos[0], LOWER_Y + (dep.height || 2) + 1.2, dep.pos[2]), rect);
        if (!point) {
          el.classList.add("is-behind");
          return;
        }
        // A dependency label carries two short lines, so its own width, not the 46px station gutter, decides where
        // its edge may sit. Keeping the box inside the frame stops the last node on a row being cut by the stage.
        point.x = clamp(point.x, width / 2 + 4, rect.width - width / 2 - 4);
        point.y = Math.max(point.y, height + 4);
        const compact = detail !== "near";
        const box = { left: point.x - width / 2, right: point.x + width / 2, top: point.y - height, bottom: point.y };
        const collides = placed.some(other => !(box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom));
        const underHud = point.y > rect.height - 56 && priority === 2;
        if (collides || underHud) {
          el.classList.add("is-hidden");
          return;
        }
        placed.push(box);
        el.classList.remove("is-hidden");
        el.classList.remove("is-behind");
        el.classList.toggle("is-compact", compact);
        el.style.left = `${point.x}px`;
        el.style.top = `${point.y}px`;
      });

      zoneLabels.forEach(zone => {
        const show = detail === "mid" && !state.library.open && state.floor !== "lower";
        zone.el.classList.toggle("is-hidden", !show);
        zone.el.classList.toggle("is-dim", detail === "mid");
        if (!show) return;
        const point = projectLabel(zone.position, rect);
        if (!point || point.y > rect.height - 80) {
          zone.el.classList.add("is-hidden");
          return;
        }
        zone.el.style.left = `${point.x}px`;
        zone.el.style.top = `${point.y}px`;
      });

      // The library shelf carries its own five labels, and they are only drawn while the shelf is open.
      libraryLabels.forEach(entry => {
        const point = projectLabel(entry.position, rect);
        if (!point) {
          entry.el.classList.add("is-hidden");
          return;
        }
        entry.el.classList.remove("is-hidden");
        entry.el.style.left = `${point.x}px`;
        entry.el.style.top = `${point.y}px`;
      });
    }

    // ---------------------------------------------------------------- render loop
    // The loop runs only while something moves. Reduced motion snaps the camera and stops the packets, and a
    // paused flow still lets the visitor orbit, because pause is about the flow, not about the camera.
    let frameHandle = 0;
    let running = false;
    let lastTime = 0;
    let inView = true;

    function shouldAnimate() {
      return inView && !document.hidden && !reduced() && (!state.paused || Boolean(tween));
    }

    function renderOnce() {
      updateLabels();
      renderer.render(scene, camera);
    }

    function requestRender() {
      if (!running) renderOnce();
    }

    function startLoop() {
      if (running) return;
      if (!shouldAnimate()) {
        renderOnce();
        return;
      }
      running = true;
      lastTime = performance.now();
      frameHandle = requestAnimationFrame(tick);
    }

    function stopLoop() {
      running = false;
      if (frameHandle) cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }

    function tick(now) {
      frameHandle = 0;
      if (!running) return;
      const delta = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
      lastTime = now;
      updateTween(now);
      spinners.forEach(spinner => {
        spinner.mesh.rotation.y += delta * spinner.speed;
      });
      updatePackets(delta);
      updateLabels();
      renderer.render(scene, camera);
      if (shouldAnimate()) frameHandle = requestAnimationFrame(tick);
      else running = false;
    }

    function togglePause() {
      state.paused = !state.paused;
      const button = host.querySelector("[data-factory-pause]");
      if (button) {
        button.setAttribute("aria-pressed", String(state.paused));
        button.textContent = state.paused ? "Resume flow" : "Pause flow";
      }
      host.dataset.factoryFlow = state.paused ? "paused" : "running";
      if (state.paused) {
        stopLoop();
        renderOnce();
      } else {
        startLoop();
      }
    }

    // ---------------------------------------------------------------- pointer controls
    const raycaster = new THREE.Raycaster();
    const pointerVector = new THREE.Vector2();
    const activePointers = new Map();
    let drag = null;

    function shownInScene(object) {
      let node = object;
      while (node) {
        if (!node.visible) return false;
        node = node.parent;
      }
      return true;
    }

    function pickAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      pointerVector.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerVector.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVector, camera);
      const targets = pickable.concat(dependencyPickable, libraryPickable).filter(shownInScene);
      const hits = raycaster.intersectObjects(targets, false);
      if (!hits.length) return null;
      const data = hits[0].object.userData;
      return {
        stationId: data.stationId || null,
        dependencyId: data.dependencyId || null,
        libraryGroup: data.libraryGroup || null
      };
    }

    canvas.addEventListener("pointerdown", event => {
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      drag = { moved: 0, at: performance.now(), pinch: null };
      if (activePointers.size === 2) {
        const points = Array.from(activePointers.values());
        drag.pinch = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      }
      tween = null;
      if (sceneHost.focus) sceneHost.focus({ preventScroll: true });
    });

    canvas.addEventListener("pointermove", event => {
      if (!activePointers.has(event.pointerId) || !drag) return;
      const previous = activePointers.get(event.pointerId);
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (activePointers.size >= 2) {
        const points = Array.from(activePointers.values());
        const span = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (drag.pinch && span > 0) {
          view.distance = clamp(view.distance * (drag.pinch / span), 16, overview.distance * 2.2);
          applyView();
          requestRender();
        }
        drag.pinch = span;
        return;
      }
      view.theta -= dx * 0.0055;
      const phiMin = state.library.open ? 1.2 : 0.22;
      const phiMax = state.library.open ? 2.35 : 1.45;
      view.phi = clamp(view.phi - dy * 0.0042, phiMin, phiMax);
      applyView();
      requestRender();
    });

    function endPointer(event) {
      const wasDrag = drag;
      activePointers.delete(event.pointerId);
      if (!wasDrag) return;
      if (event.type === "pointerup" && wasDrag.moved < 9 && performance.now() - wasDrag.at < 700) {
        const hit = pickAt(event.clientX, event.clientY);
        if (hit && hit.libraryGroup) {
          state.library = { ...state.library, group: hit.libraryGroup, doc: null };
          renderInspector();
          syncLibraryScene();
        } else if (hit && hit.dependencyId) {
          pickDependency(hit.dependencyId);
        } else if (hit && hit.stationId && !state.library.open) {
          pickStation(hit.stationId);
        } else if (!state.library.open) {
          setSelection(null);
        }
      }
      if (activePointers.size === 0) drag = null;
    }

    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      tween = null;
      view.distance = clamp(view.distance * Math.exp(event.deltaY * 0.0012), 16, overview.distance * 2.2);
      applyView();
      requestRender();
    }, { passive: false });

    // ---------------------------------------------------------------- resize and lifecycle
    function resize() {
      const rect = sceneHost.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const wasOverview = Math.abs(view.distance - overview.distance) < 0.5;
      computeOverview();
      if (wasOverview) resetView(false);
      else applyView();
      renderOnce();
    }

    function projectStation(id) {
      const node = stationNodes.get(id);
      if (!node) return null;
      const station = byId.get(id);
      const vector = new THREE.Vector3();
      node.group.getWorldPosition(vector);
      vector.y += stationHeight(station) * 0.5;
      vector.project(camera);
      const rect = sceneHost.getBoundingClientRect();
      return {
        x: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-vector.y * 0.5 + 0.5) * rect.height,
        visible: vector.z < 1
      };
    }

    const api = {
      select(selection) {
        setSelection(selection, { sync: false });
        if (!selection) {
          resetView();
        } else if (selection.type === "station") {
          focusStation(selection.id);
        } else if (selection.type === "asset") {
          focusStation(`${selection.id.toLowerCase()}.core`);
        } else if (selection.type === "pair") {
          focusStation(`pair.${selection.id}`);
        } else if (selection.type === "dependency") {
          if (state.floor === "upper") applyFloor("lower");
          focusDependency(selection.id);
        }
      },
      pause(paused) {
        if (Boolean(paused) !== state.paused) togglePause();
      },
      reset() {
        resetView();
      },
      project: id => projectStation(id),
      state: () => ({
        mode: "factory",
        detail: state.detail,
        selection: state.selection,
        journey: state.journey ? { id: state.journey, step: state.step } : null,
        paused: state.paused,
        reduced: reduced(),
        floor: state.floor,
        dependencyOrigin: state.dependencyOrigin,
        stations: stations.length,
        dependencies: dependencies.length,
        connections: allConnections.length,
        conditional: allConnections.filter(link => link.conditional).length,
        hosting: allConnections.filter(link => link.hosting).length,
        library: state.library.open
          ? { asset: state.library.asset, group: state.library.group, doc: state.library.doc, test: state.library.test }
          : null,
        flow: state.flow.open ? { asset: state.flow.asset, node: state.flow.node } : null,
        view: {
          theta: view.theta,
          phi: view.phi,
          distance: view.distance,
          target: [view.target.x, view.target.y, view.target.z]
        },
        overviewDistance: overview.distance,
        packet: packetRecords.length
          ? [packetPositions[0], packetPositions[1], packetPositions[2]]
          : null
      }),
      destroy() {
        stopLoop();
        clearLibraryScene();
        renderer.dispose();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        host.textContent = "";
      }
    };

    // ---------------------------------------------------------------- first frame
    camera.aspect = (sceneHost.clientWidth || 960) / (sceneHost.clientHeight || 560);
    camera.updateProjectionMatrix();
    computeOverview();
    applyFloorScene();
    syncFloorUi();
    applyView();
    resize();
    resetView(false);
    applyHighlight(new Set());
    updateActiveDescendant();
    sceneHost.dataset.sceneState = "ready";
    sceneHost.dataset.sceneStations = String(stations.length);
    root.dataset.mapScene = "ready";
    host.dataset.factoryFlow = "running";
    if (typeof options.onReady === "function") options.onReady(api);
    startLoop();

    if (typeof ResizeObserver === "function") new ResizeObserver(() => resize()).observe(sceneHost);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopLoop();
      else startLoop();
    });
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(entries => {
        inView = entries.some(entry => entry.isIntersecting);
        if (inView) startLoop();
        else stopLoop();
      }, { threshold: 0 }).observe(sceneHost);
    }

    return api;
  }

  window.SystemFactory = { mount };
})();
