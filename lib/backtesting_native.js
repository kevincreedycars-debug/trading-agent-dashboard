// Backtesting native tab: the view models behind the first screen.
//
// Pure functions over two committed artefacts: run-v1.json (the backtest run and its per-session records) and
// engine-v1.json (the frozen 25-factor book decided by one engine, with one state row per morning). Nothing here
// fetches, writes or decides. It reads what the artefacts already say, so the dashboard, the browser test and the
// unit test all see the same numbers and the same words.
//
// Research only. A rendered path is evidence that a stored morning exists, never evidence of live deployment,
// causal feature timing or trading edge.

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.BacktestingNative = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "backtesting-native-v1";

  var ORDINALS = ["\u2460", "\u2461", "\u2462", "\u2463"];

  var MARKETS = ["EURUSD", "XAUUSD", "NAS100", "BTCUSD"];

  var MARKET_LABELS = {
    EURUSD: "EUR/USD",
    XAUUSD: "XAU/USD",
    NAS100: "NAS100",
    BTCUSD: "BTC/USD",
    DXY: "DXY.cash"
  };

  // Bullish USD is the hypothesis. Each market is asked the same question in its own direction, and this table is
  // the whole of the mapping: it is printed beside the result rather than left to the reader.
  var USD_PREDICTION = {
    EURUSD: { BULLISH: "DOWN", BEARISH: "UP" },
    XAUUSD: { BULLISH: "DOWN", BEARISH: "UP" },
    NAS100: { BULLISH: "DOWN", BEARISH: "UP" },
    BTCUSD: { BULLISH: "DOWN", BEARISH: "UP" },
    DXY: { BULLISH: "UP", BEARISH: "DOWN" }
  };

  var TESTS = [
    {
      id: "dxy_direction",
      artefactKey: "dxy_direction_broker_cfd",
      ordinal: ORDINALS[0],
      title: "USD direction",
      markets: ["DXY"],
      question: "Does the 05:00 USD call match the move to the next 05:00 London endpoint on DXY.cash?",
      prediction: "USD bullish predicts DXY.cash up, USD bearish predicts it down."
    },
    {
      id: "four_markets",
      artefactKey: "four_markets",
      ordinal: ORDINALS[1],
      title: "USD call applied to four markets",
      markets: MARKETS,
      question: "Does the USD-only hypothesis hold when it is applied to each market separately?",
      prediction: "USD bullish predicts EUR/USD, XAU/USD, NAS100 and BTC/USD down; USD bearish predicts them up."
    },
    {
      id: "l2l_full_5r",
      artefactKey: "l2l_full_5r",
      ordinal: ORDINALS[2],
      title: "Original L2L",
      markets: MARKETS,
      question: "From a trade-qualified call, do the levels saved before the session produce a 5R line-to-line trade?",
      prediction: "Entry on the coded M5 trigger at the saved level, stop a fifth of the distance, target the next level."
    },
    {
      id: "l2l_half_3r",
      artefactKey: "l2l_half_3r",
      ordinal: ORDINALS[3],
      title: "Half L2L",
      markets: MARKETS,
      question: "Do both the original levels and their computed midpoints trigger, and what does the 3R version return?",
      prediction: "Original and midpoint both arm; entry, stop and 3R target are coded, not drawn by hand."
    }
  ];

  // Every link below names a file that exists in this checkout. Anything unverified is called unverified in the
  // same sentence rather than given a link that would 404.
  var LINKS = {
    shared: {
      rules: [
        { label: "Frozen 25-row factor rulebook", href: "config/usd_l1_factor_rulebook_v1.json", note: "the book the engine reads" },
        { label: "Decision arithmetic v1", href: "config/usd_l1_decision_rules_v1.json", note: "bands, deadband, eligibility" },
        { label: "The one engine", href: "backtester/lib/usd_layer1_backtester/engine_v1.js", note: "six checks, one decide()" },
        { label: "Adjudication manifest", href: "data/research/usd-session/final-adjudication-manifest.json", note: "what each factor was allowed to do" },
        { label: "Engine note", href: "docs/USD_L1_ENGINE_V1.md", note: "method, counts and open judgements" }
      ],
      data: [
        { label: "run-v1.json", href: "data/usd-layer1-backtester/run-v1.json", note: "725 sessions, calls, outcomes, demo ledger" },
        { label: "engine-v1.json", href: "data/usd-layer1-backtester/engine-v1.json", note: "one decision and one state row per morning" },
        { label: "decision-rules-v1.json", href: "data/usd-layer1-backtester/decision-rules-v1.json", note: "the published rules page artefact" },
        { label: "audit-v1.json", href: "data/usd-layer1-backtester/audit-v1.json", note: "the data audit behind the coverage counts" }
      ],
      infrastructure: [
        {
          label: "Supabase table market_snapshots",
          href: "https://eaolqbrlywczinfordvg.supabase.co/rest/v1/market_snapshots?select=*&limit=1",
          note: "live snapshot store; the backtest never writes to it",
          external: true
        },
        {
          label: "Supabase table agent_outputs",
          href: "https://eaolqbrlywczinfordvg.supabase.co/rest/v1/agent_outputs?select=*&limit=1",
          note: "live Layer 1 results; read only here",
          external: true
        },
        {
          label: "n8n shadow decision export",
          href: "automation/n8n/usd-l1-shadow-decision.workflow.json",
          note: "exported file only: not imported into n8n, and its alert and log destinations are unwired"
        }
      ]
    },
    byTest: {
      dxy_direction: {
        rules: [
          { label: "Official lane stays blocked", href: "docs/USD_L1_ENGINE_V1.md", note: "the official dollar index series is not held in this checkout" }
        ],
        data: [
          { label: "DXY.cash broker lane", href: "data/usd-layer1-backtester/run-v1.json", note: "instrument, tape span and flat band sit inside tests.dxy_direction_broker_cfd" }
        ],
        infrastructure: []
      },
      four_markets: {
        rules: [
          { label: "Outcome reads", href: "data/usd-layer1-backtester/run-v1.json", note: "close to close over the 24-hour session, with a per-market flat band" }
        ],
        data: [],
        infrastructure: []
      },
      l2l_full_5r: {
        rules: [
          { label: "Trade geometry", href: "data/usd-layer1-backtester/run-v1.json", note: "tests.l2l_full_5r.geometry: entry, stop and target statements" },
          { label: "Level provenance", href: "data/usd-layer1-backtester/run-v1.json", note: "level_provenance: who marked the ladder and when" }
        ],
        data: [],
        infrastructure: []
      },
      l2l_half_3r: {
        rules: [
          { label: "Trade geometry", href: "data/usd-layer1-backtester/run-v1.json", note: "tests.l2l_half_3r.geometry: midpoint arm and 3R target" }
        ],
        data: [],
        infrastructure: []
      }
    }
  };

  var OLDER_BACKTESTS = [
    { label: "Gold backtest outcomes", href: "gold-backtest-outcomes.html", note: "older gold programme, its own group" },
    { label: "Gold direction scorecard", href: "gold-direction-scorecard.html", note: "gold directional accuracy before this programme" },
    { label: "Backtest flow", href: "backtest-flow.html", note: "the research flow that produced the gold runs" },
    { label: "USD Layer 1 backtester (standalone)", href: "usd-layer1-backtester.html", note: "the long saved-research cards, kept in their own page" },
    { label: "USD Rules v1 (standalone)", href: "usd-l1-decision-rules-v1.html", note: "the generated rules page; it links back into this tab" }
  ];

  var PLANNED_REVIEWS = [
    { label: "Post-release review of the first shadow week", status: "planned", note: "needs the shadow workflow wired and a week of sealed mornings" },
    { label: "Post-release review of the 4-business-day FRED age", status: "planned", note: "would lift F5 and safe-haven readability; a book change, not a setting" },
    { label: "Post-release review of H.10 legs on intraday tape", status: "planned", note: "would move two rows off the daily release clock; book v1.1" }
  ];

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function testById(id) {
    return (
      TESTS.find(function (test) {
        return test.id === id;
      }) || TESTS[0]
    );
  }

  function marketLabel(key) {
    return MARKET_LABELS[key] || key;
  }


  function stateLabels(engine) {
    var legend = engine && engine.morning_state_legend ? engine.morning_state_legend.states : null;
    return (
      legend || {
        V: "valid_unchanged: every reading inside its declared age at the cutoff",
        A: "verified_absent: the clock says the source had released nothing",
        S: "missing_or_stale: at least one input absent, unclocked or older than its declared age",
        N: "not_read: the book does not read this row, or the row marks a window"
      }
    );
  }

  /** The model and rule versions behind every number on the tab. */
  function versions(run, engine) {
    var runBlock = (run && run.run) || {};
    return {
      engine: engine ? engine.engine_version : null,
      book: engine ? engine.book_version : null,
      decision: engine ? engine.decision_version : null,
      interface: engine ? engine.interface_version : null,
      run: runBlock.run_version || null,
      challenger: runBlock.challenger_version || null,
      current: runBlock.current_model_version || null,
      run_generated_at: (run && run.generated_at) || null,
      book_frozen_on: engine && engine.book_detail ? engine.book_detail.frozen_on : null,
      cutoff: engine && engine.cutoff_contract ? engine.cutoff_contract.local : "05:00 Europe/London",
      label: engine
        ? engine.engine_version + " · book " + engine.book_version + " · decision " + engine.decision_version
        : "engine artefact unavailable"
    };
  }

  /** The headline counts the centre column quotes, straight from the engine's own summary. */
  function headline(run, engine) {
    var summary = (engine && engine.summary) || {};
    var outcomes = summary.outcomes || {};
    var coverage = (run && run.coverage && run.coverage.by_model) || {};
    return {
      mornings: numberOr(summary.mornings, 0),
      first_date: summary.first_date || null,
      last_date: summary.last_date || null,
      allowed: numberOr(outcomes.allowed, 0),
      blocked: numberOr(outcomes.blocked, 0),
      abstained: numberOr(outcomes.abstained, 0),
      traded: numberOr(summary.traded, 0),
      directions: summary.directions || {},
      check_failures: summary.check_failures || {},
      run_version: run && run.run ? run.run.run_version : null,
      models: {
        current: coverage.current || null,
        challenger: coverage.challenger || null,
        challenger_v1: coverage.challenger_v1 || null
      }
    };
  }

  function morningFor(engine, date) {
    if (!date) return null;
    return (
      asArray(engine && engine.morning_states).find(function (entry) {
        return entry.date === date;
      }) || null
    );
  }

  function firedFor(engine, date) {
    return (
      asArray(engine && engine.fired_rule_log).find(function (entry) {
        return entry.date === date;
      }) || null
    );
  }

  function sessionFor(run, date) {
    return (
      asArray(run && run.sessions).find(function (entry) {
        return entry.date === date;
      }) || null
    );
  }

  /** The selected morning's decision, with the rule that refused it where one did. */
  function decisionFor(engine, date) {
    var morning = morningFor(engine, date);
    if (!morning) {
      return {
        date: date || null,
        available: false,
        outcome: null,
        direction: "NO_CALL",
        band: null,
        band_label: null,
        trade: false,
        checks: {},
        fired: [],
        note: "no state row is stored for this date"
      };
    }
    var logged = firedFor(engine, date);
    return {
      date: morning.date,
      available: true,
      outcome: morning.outcome,
      direction: morning.direction || "NO_CALL",
      band: morning.band,
      band_label: morning.band_label,
      trade: morning.trade === true,
      checks: morning.checks || {},
      fired: asArray(logged && logged.fired_rules),
      note:
        morning.outcome === "allowed"
          ? "the six checks passed and the provisional trade rule was met"
          : morning.outcome === "blocked"
            ? "a blocking check refused the morning before any trade could be staged"
            : "the book read enough to run, but the vote or the trade rule did not qualify"
    };
  }


  /**
   * The six fail-safes, each with what it checks and what it did on the selected date.
   *
   * `passed: null` is a real answer: E6 only applies once a call exists, and the engine says so rather than
   * marking it green.
   */
  function failSafes(engine, date) {
    var morning = morningFor(engine, date);
    var logged = firedFor(engine, date);
    return asArray(engine && engine.check_contract).map(function (check) {
      var passed = morning && morning.checks ? morning.checks[check.id] : null;
      var fired = asArray(logged && logged.fired_rules).filter(function (rule) {
        return rule.rule_id === check.id;
      });
      var status =
        passed === true ? "passed" : passed === false ? (check.on_fail === "blocked" ? "blocked" : "abstained") : "not applicable";
      var factorIds = [];
      fired.forEach(function (rule) {
        asArray(rule.factor_ids).forEach(function (id) {
          if (factorIds.indexOf(id) === -1) factorIds.push(id);
        });
      });
      return {
        id: check.id,
        name: check.name,
        what: check.label,
        on_fail: check.on_fail,
        status: status,
        passed: passed,
        evidence: fired.map(function (rule) {
          return rule.reason;
        }),
        factor_ids: factorIds,
        date: date || null
      };
    });
  }

  function executionDemo(run) {
    return (run && run.execution_demo) || null;
  }

  function tradeFor(run, test, market, date) {
    var demo = executionDemo(run);
    if (!demo) return null;
    var geometry = test.id === "l2l_half_3r" ? "half" : "full";
    return (
      asArray(demo.trades).find(function (entry) {
        return entry.geometry === geometry && entry.market === market && entry.sessionDate === date;
      }) || null
    );
  }


  /** The data fail-safes a lane owns: the price, the ladder, the tape and the trigger. */
  function laneFailSafes(run, engine, selection) {
    var test = testById(selection && selection.test);
    var date = (selection && selection.date) || null;
    var market = (selection && selection.market) || test.markets[0];
    if (test.id === "dxy_direction") {
      var lane = (run && run.tests && run.tests.dxy_direction_broker_cfd) || {};
      var window = (lane.instrument && lane.instrument.scored_window) || {};
      var first = window.first_session || null;
      var last = window.last_session || null;
      var priced = Boolean(date && first && last && date >= first && date <= last);
      return [
        {
          id: "lane-price",
          what: "the broker lane has a 05:00 and a next-05:00 print for the selected date",
          status: priced ? "passed" : "missing",
          evidence: priced
            ? (lane.instrument.symbol || "DXY.cash") + " covers " + date + " inside " + first + " to " + last
            : "the broker tape starts " + (first || "later") + " and ends " + (last || "earlier") + ", so " + (date || "this date") + " cannot be priced"
        },
        {
          id: "official-series",
          what: "the official dollar index series is staged",
          status: "blocked",
          evidence:
            typeof (lane.official_lane_note || "") === "string" && lane.official_lane_note
              ? lane.official_lane_note
              : "the official dollar index series is not staged, so this lane is never reported as test 1"
        }
      ];
    }
    if (test.id === "four_markets") {
      var session = sessionFor(run, date);
      var outcome = session && session.outcomes ? session.outcomes[market] : null;
      var call = decisionFor(engine, date);
      return [
        {
          id: "call",
          what: "the morning produced a USD direction to apply",
          status: call.direction !== "NO_CALL" ? "passed" : "abstained",
          evidence:
            call.direction !== "NO_CALL"
              ? call.direction + " at band " + (call.band === null ? "none" : call.band)
              : "no call, so there is no prediction to apply to a market"
        },
        {
          id: "outcome",
          what: "a 05:00 bar and a next-05:00 bar exist for the market",
          status: outcome && outcome.present ? "passed" : "missing",
          evidence:
            outcome && outcome.present
              ? marketLabel(market) + " moved " + outcome.direction + " (" + outcome.move_pct + "%) against a " + outcome.flat_band_pct + "% flat band"
              : marketLabel(market) + " has no priced session for " + (date || "this date")
        }
      ];
    }
    var levelTotals = (run && run.level_provenance && run.level_provenance.totals) || {};
    var levelDates = asArray(levelTotals.sessions_eligible_for_all_four_list);
    var demo = executionDemo(run);
    var tape = asArray(demo && demo.sessions).some(function (entry) {
      return entry.date === date;
    });
    var trade = tradeFor(run, test, market, date);
    return [
      {
        id: "levels",
        what: "a level ladder was archived before the session",
        status: levelDates.indexOf(date) !== -1 ? "passed" : "missing",
        evidence:
          levelDates.indexOf(date) !== -1
            ? "an archived ladder covers " + marketLabel(market) + " on " + date
            : "the artefact archives ladders for " + (levelDates.join(", ") || "no dates") + "; " + (date || "this date") + " is not one of them"
      },
      {
        id: "tape",
        what: "a five-minute tape covers the session",
        status: tape ? "passed" : "missing",
        evidence: tape
          ? "an M5 tape is staged for " + date
          : "no five-minute tape exists for this market and date, so no trigger can be read"
      },
      {
        id: "trigger",
        what: "the coded trigger produced a filled trade",
        status: trade ? "passed" : "missing",
        evidence: trade
          ? trade.entry + " filled at " + trade.fillTimeUtc + " and exited " + trade.exitReason + " at " + trade.exitPrice
          : "no trade is recorded for this market and date, so there is no entry, stop or target to show"
      }
    ];
  }

  /** The £100,000 curve, published only where trades actually replay. */
  function equity(run, testId) {
    var geometry = testId === "l2l_half_3r" ? "half" : "full";
    var accounts = asArray(run && run.execution_demo && run.execution_demo.accounts).filter(function (account) {
      return account.geometry === geometry;
    });
    if (!accounts.length) {
      return { available: false, accounts: [], reason: "no replayed trades exist for this variant, so no curve is shown" };
    }
    return {
      available: true,
      accounts: accounts,
      starting_balance: accounts[0].starting_balance,
      currency: accounts[0].currency,
      risk_per_trade_pct: accounts[0].risk_per_trade_pct,
      reason: "execution demo only: the curve is the staged M5 replay, not a scored L2L result"
    };
  }

  /** Challenger and current model on the same dates, each with its own coverage denominator. */
  function modelCoverage(run) {
    var models = (run && run.coverage && run.coverage.by_model) || {};
    return ["current", "challenger", "challenger_v1"].map(function (key) {
      var entry = models[key] || {};
      return {
        key: key,
        calls: numberOr(entry.calls_reconstructed, 0),
        sessions: numberOr(entry.sessions_eligible, 0),
        no_call: numberOr(entry.no_call_sessions, 0),
        coverage_pct: entry.call_coverage_pct
      };
    });
  }

  /** The per-date comparison test 2 answers: prediction, actual move, and whether it counted. */
  function marketOutcome(run, date, market) {
    var session = sessionFor(run, date);
    if (!session) {
      return { available: false, prediction: null, actual: null, result: null, note: "this date is not in the session artefact" };
    }
    var call = (session.models && session.models.challenger_v1) || null;
    var outcome = (session.outcomes && session.outcomes[market]) || null;
    var result = (session.results && session.results.challenger_v1 && session.results.challenger_v1[market]) || null;
    var prediction = call && call.direction ? (USD_PREDICTION[market] || {})[call.direction] || null : null;
    return {
      available: Boolean(outcome && outcome.present),
      direction: call ? call.direction : null,
      prediction: prediction,
      actual: outcome && outcome.present ? outcome.direction : null,
      move_pct: outcome ? outcome.move_pct : null,
      flat_band_pct: outcome ? outcome.flat_band_pct : null,
      result: result,
      note: !call
        ? "no challenger_v1 call is stored for this morning"
        : !outcome || !outcome.present
          ? "no priced outcome is stored for this market on this date"
          : result === "hit"
            ? "the market moved against the USD call, so the call counted"
            : result === "miss"
              ? "the market moved with the USD call, so the call did not count"
              : "the move stayed inside the flat band, so the call was not scored"
    };
  }

  /** The four tests as selectable nodes, with the count each one can actually stand behind. */
  function testStatus(run, testId) {
    var test = testById(testId);
    var lane = (run && run.tests && run.tests[test.artefactKey]) || {};
    var byTest = (run && run.coverage && run.coverage.by_test && run.coverage.by_test[test.artefactKey]) || {};
    var usable = numberOr(lane.usable_sessions, numberOr(byTest.usable_sessions, 0));
    if (testId === "four_markets") {
      return { usable: usable, label: usable + " priced sessions", tone: usable ? "good" : "muted" };
    }
    if (testId === "dxy_direction") {
      return usable
        ? { usable: usable, label: usable + " scored sessions", tone: "warn" }
        : { usable: 0, label: "0 scored · official series not held", tone: "muted" };
    }
    var accounts = asArray(lane.accounts);
    var geometry = testId === "l2l_half_3r" ? "half" : "full";
    var fills = asArray(run && run.execution_demo && run.execution_demo.trades).filter(function (trade) {
      return trade.geometry === geometry;
    }).length;
    if (!fills) {
      fills = accounts.reduce(function (total, account) {
        return total + numberOr(account.fills, 0);
      }, 0);
    }
    return fills
      ? { usable: fills, label: fills + " demo trades", tone: "warn" }
      : { usable: 0, label: "0 replayable trades", tone: "muted" };
  }


  var MAP_COLUMNS = [
    { index: 0, label: "05:00 snapshot and model" },
    { index: 1, label: "USD decision" },
    { index: 2, label: "Four tests" },
    { index: 3, label: "Markets" },
    { index: 4, label: "Dates" }
  ];

  /**
   * The selectable map: snapshot and model on the left, the decision in the centre, the four tests branching right,
   * then the chosen test's markets and dates. `path` is the highlighted chain, so the 3D scene and the printed list
   * agree about what the reader selected.
   */
  function mapModel(run, engine, selection) {
    var chosen = selection || {};
    var test = testById(chosen.test);
    var market = chosen.market || test.markets[0];
    var date = chosen.date || null;
    var decision = decisionFor(engine, date);
    var versionsBlock = versions(run, engine);
    var nodes = [];
    var edges = [];
    var detail = pathDetail(run, engine, chosen);

    function toneForDirection(direction) {
      return direction === "BULLISH" ? "good" : direction === "BEARISH" ? "bad" : "warn";
    }

    nodes.push({
      id: "snapshot",
      label: "05:00 London snapshot",
      status: date || "no date selected",
      tone: decision.available ? "info" : "muted",
      column: 0,
      kind: "snapshot",
      detail: {
        title: "What was knowable at 05:00",
        copy: decision.available
          ? "The snapshot closes at 05:00 Europe/London, and every morning in the run uses the same cutoff."
          : "No morning is selected yet, so the snapshot has nothing to show."
      }
    });
    nodes.push({
      id: "model",
      label: engine ? engine.engine_version + " · book " + engine.book_version : "engine artefact missing",
      status: engine ? "25 rows · " + ((run && run.run && run.run.challenger_version) || "") : "not loaded",
      tone: engine ? "navy" : "bad",
      column: 0,
      kind: "model",
      detail: {
        title: "The model that ran",
        copy: versionsBlock.label,
        rows: [
          ["Engine", versionsBlock.engine || "—"],
          ["Book", versionsBlock.book || "—"],
          ["Decision", versionsBlock.decision || "—"],
          ["Run", versionsBlock.run || "—"],
          ["Cutoff", versionsBlock.cutoff]
        ]
      }
    });
    nodes.push({
      id: "decision",
      label: "USD decision",
      status: decision.direction === "NO_CALL" ? "no call" : decision.direction,
      tone: toneForDirection(decision.direction),
      column: 1,
      kind: "decision",
      detail: {
        title: "The USD decision",
        copy: decision.note,
        rows: [
          ["Outcome", decision.outcome || "—"],
          ["Direction", decision.direction],
          ["Band", decision.band_label ? decision.band_label + " (" + decision.band + "/5)" : "no band"],
          ["Trade", decision.trade ? "qualified" : "not qualified"]
        ]
      }
    });
    nodes.push({
      id: "band",
      label: "Conviction band",
      status: decision.band_label ? decision.band + "/5 " + decision.band_label : "no band",
      tone: decision.band === null ? "muted" : "warn",
      column: 1,
      kind: "band"
    });
    nodes.push({
      id: "trade",
      label: "Trade qualification",
      status: decision.trade ? "qualified" : "not qualified",
      tone: decision.trade ? "good" : "muted",
      column: 1,
      kind: "trade"
    });

    TESTS.forEach(function (entry) {
      var status = testStatus(run, entry.id);
      nodes.push({
        id: "test:" + entry.id,
        label: entry.ordinal + " " + entry.title,
        status: status.label,
        tone: status.tone,
        column: 2,
        kind: "test",
        testId: entry.id
      });
      edges.push({ from: "trade", to: "test:" + entry.id });
    });


    test.markets.forEach(function (key) {
      var outcome = test.id === "four_markets" ? marketOutcome(run, date, key) : null;
      var trade = test.id === "l2l_full_5r" || test.id === "l2l_half_3r" ? tradeFor(run, test, key, date) : null;
      var status = test.id === "dxy_direction"
        ? "DXY.cash"
        : outcome
          ? outcome.result || (outcome.available ? "unscored" : "no outcome")
          : trade
            ? trade.exitReason
            : "no replay";
      nodes.push({
        id: "market:" + key,
        label: marketLabel(key),
        status: status,
        tone: outcome ? (outcome.result === "hit" ? "good" : outcome.result === "miss" ? "warn" : "muted") : trade ? "warn" : "muted",
        column: 3,
        kind: "market",
        market: key
      });
      edges.push({ from: "test:" + test.id, to: "market:" + key });
    });

    var dates = dateNodes(run, engine, test, market, date);
    dates.forEach(function (entry) {
      nodes.push({
        id: "date:" + entry.date,
        label: entry.label,
        status: entry.status,
        tone: entry.tone,
        column: 4,
        kind: "date",
        date: entry.date
      });
      edges.push({ from: "market:" + market, to: "date:" + entry.date });
    });

    var path = ["snapshot", "decision", "band", "trade", "test:" + test.id, "market:" + market].concat(
      dates.some(function (entry) {
        return entry.date === date;
      })
        ? ["date:" + date]
        : []
    );

    return {
      nodes: nodes,
      edges: edges,
      path: path,
      columns: MAP_COLUMNS,
      selection: { test: test.id, market: market, date: date },
      missing: detail.missing
    };
  }

  /** The date nodes each test can offer, capped at four so the map stays readable. */
  function dateNodes(run, engine, test, market, date) {
    var out = [];
    var sessions = asArray(run && run.sessions);
    var mornings = asArray(engine && engine.morning_states);
    if (test.id === "four_markets") {
      var scored = sessions
        .slice()
        .reverse()
        .find(function (session) {
          var result = session.results && session.results.challenger_v1 ? session.results.challenger_v1[market] : null;
          return result === "hit" || result === "miss";
        });
      if (scored) out.push({ date: scored.date, label: scored.date, status: "scored", tone: "good" });
      var latestBlocked = mornings
        .slice()
        .reverse()
        .find(function (morning) {
          return morning.outcome === "blocked";
        });
      if (latestBlocked && (!scored || latestBlocked.date !== scored.date)) {
        out.push({ date: latestBlocked.date, label: latestBlocked.date, status: "blocked", tone: "bad" });
      }
    } else if (test.id === "dxy_direction") {
      var lane = (run && run.tests && run.tests.dxy_direction_broker_cfd) || {};
      var window = (lane.instrument && lane.instrument.scored_window) || {};
      if (window.last_session) {
        out.push({ date: window.last_session, label: window.last_session, status: "last priced", tone: "warn" });
      }
    } else {
      var levelDates = asArray(
        run && run.level_provenance && run.level_provenance.totals && run.level_provenance.totals.sessions_eligible_for_all_four_list
      );
      levelDates.slice(-2).forEach(function (entry) {
        out.push({ date: entry, label: entry, status: "levels", tone: "warn" });
      });
      var demoDates = [];
      asArray(run && run.execution_demo && run.execution_demo.trades).forEach(function (trade) {
        if (trade.market !== market) return;
        if (demoDates.indexOf(trade.sessionDate) === -1) demoDates.push(trade.sessionDate);
      });
      demoDates.slice(-1).forEach(function (entry) {
        out.push({ date: entry, label: entry, status: "traded", tone: "good" });
      });
    }
    if (date && !out.some(function (entry) { return entry.date === date; })) {
      out.push({ date: date, label: date, status: "selected", tone: "info" });
    }
    return out.slice(0, 4);
  }


  /**
   * The selected path in words, one step at a time, ending where the evidence ends. The `missing` list is the
   * honest answer to "why does this stop here", and it is never empty when a step could not be completed.
   */
  function pathDetail(run, engine, selection) {
    var chosen = selection || {};
    var test = testById(chosen.test);
    var market = chosen.market || test.markets[0];
    var date = chosen.date || null;
    var session = sessionFor(run, date);
    var decision = decisionFor(engine, date);
    var versionsBlock = versions(run, engine);
    var steps = [];
    var missing = [];

    steps.push({
      key: "snapshot",
      label: "05:00 London snapshot",
      value: date
        ? date + " · cutoff " + ((session && session.cutoff_at_utc) || versionsBlock.cutoff)
        : "no morning selected",
      status: date ? "present" : "missing"
    });
    steps.push({
      key: "call",
      label: "USD call from " + versionsBlock.engine,
      value:
        decision.direction === "NO_CALL"
          ? "no call · " + decision.outcome
          : decision.direction + (decision.band_label ? " at band " + decision.band + "/5 " + decision.band_label : ""),
      status: decision.direction === "NO_CALL" ? "missing" : "present"
    });
    if (!date) missing.push("no morning selected");
    if (date && !decision.available) missing.push("no engine state row is stored for " + date);
    if (decision.direction === "NO_CALL") missing.push("the engine issued no direction, so no market prediction follows");

    if (test.id === "four_markets") {
      var outcome = marketOutcome(run, date, market);
      steps.push({
        key: "prediction",
        label: marketLabel(market) + " prediction",
        value: outcome.prediction ? decision.direction + " USD predicts " + marketLabel(market) + " " + outcome.prediction : "no prediction",
        status: outcome.prediction ? "present" : "missing"
      });
      steps.push({
        key: "actual",
        label: marketLabel(market) + " actual move",
        value: outcome.available
          ? outcome.actual + " (" + outcome.move_pct + "%) against a " + outcome.flat_band_pct + "% flat band"
          : "no priced session",
        status: outcome.available ? "present" : "missing"
      });
      steps.push({
        key: "scored",
        label: "Did the call count",
        value: outcome.result ? outcome.result + " · " + outcome.note : outcome.note,
        status: outcome.available && ["hit", "miss", "flat"].includes(outcome.result) ? "present" : "missing"
      });
      if (!outcome.available) missing.push(marketLabel(market) + " has no priced outcome for " + date);
      return finish(test, market, date, decision, versionsBlock, steps, missing, null, outcome);
    }

    if (test.id === "dxy_direction") {
      steps.push({
        key: "prediction",
        label: "DXY.cash prediction",
        value:
          decision.direction === "NO_CALL"
            ? "no prediction"
            : "USD " + decision.direction.toLowerCase() + " predicts DXY.cash " + (USD_PREDICTION.DXY[decision.direction] || "—"),
        status: decision.direction === "NO_CALL" ? "missing" : "present"
      });
      var lane = (run && run.tests && run.tests.dxy_direction_broker_cfd) || {};
      steps.push({
        key: "lane",
        label: "DXY.cash lane",
        value: lane.status
          ? lane.status + " · " + numberOr(lane.usable_sessions, 0) + " scored sessions · " + numberOr(lane.awaiting_prices_sessions, 0) + " awaiting prices"
          : "lane missing",
        status: lane.status ? "present" : "missing"
      });
      steps.push({
        key: "outcome",
        label: "This date's own DXY move",
        value: "not stored per date: the lane publishes aggregate accuracy and the official ICE series stays blocked",
        status: "missing"
      });
      missing.push("the per-date DXY.cash move is not in the artefact, so only the lane total can be quoted");
      return finish(test, market, date, decision, versionsBlock, steps, missing, null, null);
    }

    var trade = tradeFor(run, test, market, date);
    var levels = asArray(
      run && run.level_provenance && run.level_provenance.totals && run.level_provenance.totals.sessions_eligible_for_all_four_list
    );
    var ladder = levels.indexOf(date) !== -1;
    steps.push({
      key: "levels",
      label: "Levels saved before the session",
      value: ladder ? "an archived ladder covers " + marketLabel(market) + " on " + date : "no archived ladder for " + date,
      status: ladder ? "present" : "missing"
    });
    steps.push({
      key: "entry",
      label: "Coded entry",
      value: trade ? trade.side + " at " + trade.entry + " from the " + trade.levelSource + " level" : "no filled entry",
      status: trade ? "present" : "missing"
    });
    steps.push({
      key: "risk",
      label: "Stop and target",
      value: trade
        ? "stop " + trade.stop + " · target " + trade.target + " · risk " + trade.riskPerLot + " per lot"
        : "no stop or target without a trade",
      status: trade ? "present" : "missing"
    });
    steps.push({
      key: "outcome",
      label: "Trigger and outcome",
      value: trade
        ? "trigger " + trade.triggerTimeUtc + " · exit " + trade.exitReason + " at " + trade.exitPrice + " · " + trade.rGross + "R"
        : "no trigger candle is stored for this market and date",
      status: trade ? "present" : "missing"
    });
    if (!trade) {
      missing.push(
        "the path stops at the morning call: no five-minute tape and no archived ladder are staged for " +
          marketLabel(market) +
          " on " +
          date
      );
    }
    return finish(test, market, date, decision, versionsBlock, steps, missing, trade, null);
  }

  function finish(test, market, date, decision, versionsBlock, steps, missing, trade, outcome) {
    return {
      test: test.id,
      ordinal: test.ordinal,
      title: test.title,
      question: test.question,
      prediction: test.prediction,
      market: market,
      marketLabel: marketLabel(market),
      date: date,
      steps: steps,
      missing: missing,
      trade: trade || null,
      outcome: outcome || null,
      versions: versionsBlock,
      decision: decision
    };
  }


  /**
   * All twenty-five rows for one morning: what was available by the cutoff, what was carried forward, what the
   * adjudication allowed the row to do, and what the engine did with it. The input print dates come from the run
   * artefact's own input_meta, so nothing here is reconstructed by guesswork.
   */
  function factorLedger(engine, run, date) {
    var morning = morningFor(engine, date);
    var session = sessionFor(run, date);
    var meta = new Map();
    asArray(session && session.input_meta).forEach(function (tuple) {
      if (!Array.isArray(tuple) || !tuple.length) return;
      meta.set(tuple[0], {
        print_date: tuple[1] || null,
        staleness_business_days: Number.isFinite(tuple[2]) ? tuple[2] : null,
        max_age_business_days: Number.isFinite(tuple[3]) ? tuple[3] : null
      });
    });
    var labels = stateLabels(engine);
    var signals = asArray(engine && engine.book_detail && engine.book_detail.signals);
    return asArray(engine && engine.book_detail && engine.book_detail.rows).map(function (row, index) {
      var code = morning ? morning.states.charAt(index) : "";
      var vote = morning ? morning.votes.charAt(index) : "";
      var age = morning ? Number(morning.ages.charAt(index)) : null;
      return {
        id: row.id,
        name: row.name,
        role: row.role,
        role_label: row.role_label,
        treatment: row.treatment,
        disposition: row.disposition,
        verdict: row.verdict,
        state: code,
        state_label: labels[code] || "no state recorded for this morning",
        readable: code === "V",
        may_vote: row.role === "direction" && code === "V",
        vote: vote === "+" ? 1 : vote === "-" ? -1 : 0,
        vote_label: vote === "+" ? "bullish USD" : vote === "-" ? "bearish USD" : "no vote",
        carried: Number.isFinite(age) ? age > 0 : false,
        age: Number.isFinite(age) ? age : null,
        signals: asArray(row.signals).map(function (id) {
          var found = signals.find(function (entry) {
            return entry.id === id;
          });
          return { id: id, label: found ? found.label : id };
        }),
        inputs: asArray(row.inputs).map(function (key) {
          var entry = meta.get(key) || null;
          return {
            key: key,
            recorded: Boolean(entry),
            print_date: entry ? entry.print_date : null,
            staleness_business_days: entry ? entry.staleness_business_days : null,
            max_age_business_days: entry ? entry.max_age_business_days : null
          };
        })
      };
    });
  }

  /** Rules, data and infrastructure links for one test, shared entries included and duplicates removed. */
  function links(testId) {
    var specific = LINKS.byTest[testId] || { rules: [], data: [], infrastructure: [] };
    function merge(shared, own) {
      var seen = [];
      return asArray(shared)
        .concat(asArray(own))
        .filter(function (entry) {
          if (!entry || !entry.href || seen.indexOf(entry.href + entry.label) !== -1) return false;
          seen.push(entry.href + entry.label);
          return true;
        });
    }
    return {
      rules: merge(LINKS.shared.rules, specific.rules),
      data: merge(LINKS.shared.data, specific.data),
      infrastructure: merge(LINKS.shared.infrastructure, specific.infrastructure)
    };
  }

  /**
   * The inputs the engine refused on one morning: every row it marked missing_or_stale, with the reading that broke
   * it. A print that carries a date but no time is unclocked, which the engine treats as stale, so the reason is
   * named rather than left for the reader to infer from two numbers.
   */
  function staleInputs(engine, run, date) {
    return factorLedger(engine, run, date)
      .filter(function (row) {
        return row.state === "S" || row.state === "A";
      })
      .map(function (row) {
        var broken = asArray(row.inputs)
          .filter(function (input) {
            if (!input.recorded) return true;
            if (!input.print_date || !/T/.test(String(input.print_date))) return true;
            return (
              Number.isFinite(input.staleness_business_days) &&
              Number.isFinite(input.max_age_business_days) &&
              input.staleness_business_days > input.max_age_business_days
            );
          })
          .map(function (input) {
            var reason = !input.recorded
              ? "no reading is stored"
              : !input.print_date || !/T/.test(String(input.print_date))
                ? "unclocked: the print carries a date but no time of day"
                : "older than its declared age";
            return {
              key: input.key,
              print_date: input.print_date || null,
              staleness: input.staleness_business_days,
              max_age: input.max_age_business_days,
              reason: reason
            };
          });
        return {
          row_id: row.id,
          row_name: row.name,
          state: row.state,
          state_label: row.state_label,
          age: row.age,
          inputs: broken,
          votes: row.may_vote
        };
      });
  }

  /**
   * Who was allowed to vote on one morning and how each row voted. The artefact records one vote symbol per book
   * row; this returns those symbols with the row's state, so a reader can see the votes cancel without the tab
   * inventing a family score the artefacts do not store.
   */
  function voteRegister(engine, run, date) {
    var morning = morningFor(engine, date);
    var rows = factorLedger(engine, run, date).filter(function (row) {
      return row.role === "direction";
    });
    var tally = { bullish: 0, bearish: 0, flat: 0, silent: 0 };
    rows.forEach(function (row) {
      if (!row.may_vote) tally.silent += 1;
      else if (row.vote > 0) tally.bullish += 1;
      else if (row.vote < 0) tally.bearish += 1;
      else tally.flat += 1;
    });
    return {
      available: Boolean(morning),
      rows: rows.map(function (row) {
        return {
          id: row.id,
          name: row.name,
          state: row.state,
          state_label: row.state_label,
          vote: row.vote,
          vote_label: row.vote_label,
          counted: row.may_vote,
          age: row.age
        };
      }),
      tally: tally
    };
  }

  /**
   * How many of the artefact's mornings survive the research's own fail-safe.
   *
   * The intended candidate is not the book that ran. `validity_gate.intended_model` records
   * CONFIG_BLOCKED with `rule_defined: false`, so every morning is an undefined-rule morning for it
   * whatever the data says. The four-rung ladder then says where the implemented inputs stopped:
   * present, fresh, clocked (a receipt proves the print existed at 05:00 London) and identified (the
   * instrument the research names, not a declared proxy). The only number that counts is the
   * intersection, and this function reports it with the blockers exactly as the gate recorded them,
   * including the file each fix belongs to and a note that the rows overlap rather than add.
   */
  function verification(run, engine) {
    var gate = (run && run.validity_gate) || {};
    if (!gate.version) {
      // No gate in the artefact: say so rather than printing a zero that looks like a result.
      return {
        available: false,
        version: null,
        mornings: 0,
        verified: 0,
        headline: "0 / 0",
        rungs: [],
        blockers: [],
        tests: [],
        links: [],
        exemplars: { verified: null, verified_note: "", blocked: null }
      };
    }
    var research = gate.research_gate || {};
    var intended = gate.intended || {};
    var intendedModel = gate.intended_model || {};
    var days = asArray(gate.days);
    var mornings = numberOr(intended.sessions, days.length);
    var verified = numberOr(research.accepted, 0);
    var requirementCounts = gate.requirement_counts || {};

    function countDays(field) {
      var count = 0;
      days.forEach(function (day) {
        if (asArray(day[field]).length) count += 1;
      });
      return count;
    }

    function share(count) {
      return mornings ? Math.round((count / mornings) * 1000) / 10 : null;
    }

    function pct(value) {
      return typeof value === "number" && isFinite(value) ? value : null;
    }

    var rungLabels = {
      present: "Every required input present",
      fresh: "Inside its permitted age",
      clocked: "A receipt proves the print existed before 05:00 London",
      identified: "The instrument the research names, not a declared proxy"
    };
    var rungs = asArray(gate.ladder)
      .filter(function (row) {
        return row.scope === "sessions";
      })
      .map(function (row) {
        var passing = numberOr(row.sessions_passing, 0);
        return {
          id: row.rung,
          label: rungLabels[row.rung] || row.rung,
          passing: passing,
          mornings: numberOr(row.sessions, mornings),
          share: share(passing)
        };
      });

    var undefinedRuleDates = days.filter(function (day) {
      return day.intended === "undefined_rule";
    }).length;
    var dataBlocked = days.filter(function (day) {
      return (
        asArray(day.missing).length ||
        asArray(day.stale).length ||
        asArray(day.unclocked).length ||
        asArray(day.wrong_instrument).length
      );
    }).length;
    var missingDates = countDays("missing");
    var staleDates = countDays("stale");
    var staleEntries = days.reduce(function (sum, day) {
      return sum + asArray(day.stale).length;
    }, 0);
    var unclockedDates = countDays("unclocked");
    var proxyDates = countDays("wrong_instrument");
    var requirementBlockers = asArray(gate.intended_requirement_blockers);
    var fedBias =
      requirementBlockers.filter(function (row) {
        return row.factor_id === "live.f8-fed-bias";
      })[0] ||
      requirementBlockers[0] ||
      null;

    // The blocker text quotes per-input counts, so read them off the gate's own rows rather than
    // repeating a number that could drift from the artefact.
    function fieldCounts(field) {
      var counts = {};
      days.forEach(function (day) {
        asArray(day[field]).forEach(function (entry) {
          var key = String(entry && entry.key ? entry.key : entry);
          counts[key] = (counts[key] || 0) + 1;
        });
      });
      return Object.keys(counts)
        .map(function (key) {
          return { key: key, mornings: counts[key] };
        })
        .sort(function (a, b) {
          return b.mornings - a.mornings || (a.key < b.key ? -1 : 1);
        });
    }

    function quote(counts, label) {
      return counts
        .map(function (entry) {
          return "`" + entry.key + "` (" + entry.mornings + (label || " mornings") + ")";
        })
        .join(", ");
    }

    var unclockedCounts = fieldCounts("unclocked");
    var proxyCounts = fieldCounts("wrong_instrument");
    var missingCounts = fieldCounts("missing");

    // The book's own refusals, read off the engine's per-factor roll-up rather than repeated as prose.
    var accessRows = asArray(engine && engine.access && engine.access.by_factor);
    function refusedMornings(id) {
      var row =
        accessRows.filter(function (entry) {
          return entry.id === id;
        })[0] || null;
      return row && row.states ? numberOr(row.states.missing_or_stale, null) : null;
    }
    var f5Refused = refusedMornings("live.f5-dxy-delta");
    var havenRefused = refusedMornings("risk.usd-safe-haven-demand");
    function blocker(id, label, count, kind, fix, note) {
      return {
        id: id,
        label: label,
        mornings: count,
        share: share(count),
        kind: kind,
        fix: fix,
        note: note || null,
        overlaps_all: count === mornings
      };
    }

    var blockers = [
      blocker(
        "undefined-rule",
        "No adjudicated rule: the intended candidate is CONFIG_BLOCKED",
        undefinedRuleDates,
        "rule",
        "The final adjudication of 2026-11-04 registers 25 factor verdicts and establishes no sign, weight or threshold, so the intended agent's rule is undefined. A frozen combined rule is the input: publish it, then set `rule_defined` with that version in `backtester/lib/usd_layer1_backtester/model_identity.js`. No data fix lifts this count while it is false.",
        "the one blocker that is a rule rather than a reading"
      ),
      blocker(
        "unclocked",
        "No receipt proves the print existed at 05:00 London",
        unclockedDates,
        "archive",
        "`vix_level`, `vix_d5_chg`, `us_2y_d5_bps` and `us_10y_real_d5_bps` are daily closes with no archived receipt: " +
          quote(unclockedCounts) +
          ". Archive the provider receipt time per print in the 05:00 collection (the seal exists in `backtester/lib/usd_layer1_backtester/collection.js`; the flow is `automation/n8n/usd-l1-shadow-decision.workflow.json`), then set `clock_verified` per input in `model_identity.js` only where a receipt exists.",
        "the clocked rung is 0 while presence is 618 and freshness 617"
      ),
      blocker(
        "wrong-instrument",
        "The staged series is a declared proxy",
        proxyDates,
        "source",
        "`gold_d5_pct` and `nasdaq100_d5_pct`, `eurusd_d5_pct` and `usdjpy_d5_pct` are broker or weekly H.10 carries, not the instruments the research names: " +
          quote(proxyCounts) +
          ". Stage a bullion stream or a declared gold contract, an intraday NAS100 series, and intraday EUR/USD and JPY legs, then set `same_instrument` in `model_identity.js`.",
        "presence is not identity: a proxy that is present and fresh still fails"
      ),
      blocker(
        "missing-input",
        "A required input is absent",
        missingDates,
        "archive",
        "The five-day legs have no earlier print in the archive on these mornings: " +
          quote(missingCounts) +
          ". Historical backfill of the printed series into the run's per-morning inputs (`data/usd-layer1-backtester/run-v1.json`); no code change.",
        "a five-day change needs its previous print, and the archive starts at the first scored morning"
      ),
      blocker(
        "stale-input",
        "Older than the gate's freshness limit",
        staleDates,
        "book",
        String(staleDates) +
          (staleDates === 1 ? " morning names " : " mornings name ") +
          String(staleEntries) +
          " inputs past the gate's own age. The frozen book's stricter 4-business-day age refuses `live.f5-dxy-delta` and `risk.usd-safe-haven-demand` on " +
          String(f5Refused === null ? "310" : f5Refused) +
          " and " +
          String(havenRefused === null ? "310" : havenRefused) +
          " mornings (engine E3). Raising it is a rulebook version, not a tolerance bump: `config/usd_l1_factor_rulebook_v1.json` through `backtester/lib/usd_layer1_backtester/factor_rulebook_v1.js`.",
        "the gate and the book measure age differently and both numbers are shown"
      ),
      blocker(
        "fed-bias-no-source",
        "F8 Fed bias has no source",
        mornings - numberOr(gate.sessions_meeting_intended_requirements, 0),
        "source",
        "`live.f8-fed-bias` is a required factor with no staged input" +
          (fedBias ? " (" + String(fedBias.why || "") + ")" : "") +
          ", so the mornings meeting the intended requirements stay at " +
          String(numberOr(gate.sessions_meeting_intended_requirements, 0)) +
          " whatever the other rungs do. Acquire and register a Fed-bias source at the cutoff, or record it permanently absent as a book change in `config/usd_l1_factor_rulebook_v1.json` through `backtester/lib/usd_layer1_backtester/factor_rulebook_v1.js`.",
        "a cap in the requirement table, not in the ladder"
      )
    ];
    var summary = (engine && engine.summary) || {};
    var book = summary.outcomes || {};
    var dataGate = gate.data_gate || {};
    var dataCounts = dataGate.counts || {};
    var implemented = gate.implemented || {};

    var proofDate = (engine && engine.proof_morning && engine.proof_morning.date) || null;
    var blockedDate = proofDate;
    if (!blockedDate) {
      var dated = days.filter(function (day) {
        return day.date;
      });
      blockedDate = dated.length ? dated[dated.length - 1].date : null;
    }
    var blockedDay =
      days.filter(function (day) {
        return day.date === blockedDate;
      })[0] || null;
    var blockedMorning = morningFor(engine, blockedDate);
    var failedInputs = [];
    if (blockedDay) {
      ["missing", "stale", "unclocked", "wrong_instrument"].forEach(function (field) {
        asArray(blockedDay[field]).forEach(function (entry) {
          failedInputs.push(String(entry && entry.key ? entry.key : entry));
        });
      });
    }

    var dxyTest = (run && run.tests && run.tests.dxy_direction_broker_cfd) || {};
    var dxyModels = dxyTest.models || {};
    var fourTest = (run && run.tests && run.tests.four_markets) || {};
    var fourModels = fourTest.models || {};
    var fourMatched = (fourTest.comparisons && fourTest.comparisons.markets) || {};

    function overall(model, market) {
      var block = market ? (model && model.markets && model.markets[market]) || {} : model || {};
      var row = market ? block.overall || {} : block.overall || block;
      return {
        scored: numberOr(row.scored, 0),
        hits: numberOr(row.hits, 0),
        accuracy_pct: pct(row.accuracy_pct)
      };
    }

    var fourMarkets = MARKETS.map(function (key) {
      var matched = fourMatched[key] || {};
      return {
        market: key,
        label: marketLabel(key),
        current: overall(fourModels.current, key),
        challenger: overall(fourModels.challenger_v1, key),
        matched: {
          dates: numberOr(matched.matched, 0),
          corrected: numberOr(matched.corrected, 0),
          spoiled: numberOr(matched.spoiled, 0),
          both_right: numberOr(matched.both_right, 0),
          both_wrong: numberOr(matched.both_wrong, 0)
        }
      };
    });

    function l2lTest(testId, geometry, title) {
      var entry = (run && run.tests && run.tests[testId]) || {};
      var account =
        asArray(entry.accounts).filter(function (candidate) {
          return candidate.model === "current" && candidate.geometry === geometry;
        })[0] || null;
      return {
        id: testId,
        title: title,
        verified: 0,
        usable_sessions: numberOr(entry.usable_sessions, 0),
        status: entry.status || null,
        demo: account
          ? {
              fills: numberOr(account.fills, 0),
              wins: numberOr(account.wins, 0),
              losses: numberOr(account.losses, 0),
              flat: numberOr(account.flat_trades, 0),
              total_r: numberOr(account.total_r, 0),
              return_pct: numberOr(account.return_pct, 0)
            }
          : null
      };
    }
    return {
      available: Boolean(run && gate.version),
      version: gate.version || null,
      cutoff: gate.cutoff || null,
      mornings: mornings,
      verified: verified,
      headline: String(verified) + " / " + String(mornings),
      gate_note: research.note || null,
      intended: {
        candidate_id: intendedModel.candidate_id || null,
        specification_version: intendedModel.specification_version || null,
        name: intendedModel.name || null,
        research_status: intendedModel.research_status || null,
        config_status: intendedModel.config_status || null,
        rule_defined: intendedModel.rule_defined === true,
        unresolved: asArray(intendedModel.unresolved),
        note: intendedModel.note || null
      },
      requirements: {
        factors: numberOr(requirementCounts.factors, 25),
        required: numberOr(requirementCounts.required, 0),
        conditional: numberOr(requirementCounts.conditional, 0),
        gate: numberOr(requirementCounts.gate, 0),
        shared: numberOr(requirementCounts.shared, 0),
        excluded: numberOr(requirementCounts.excluded, 0),
        declared_inputs: asArray(gate.required_inputs_declared).length,
        never_present: asArray(gate.required_inputs_never_present),
        with_every_required_input: numberOr(gate.sessions_with_every_required_input, 0),
        meeting_intended_requirements: numberOr(gate.sessions_meeting_intended_requirements, 0)
      },
      rungs: rungs,
      outcomes: {
        verified: verified,
        directional: verified ? numberOr((intended.counts || {}).valid_directional, 0) : 0,
        abstained: verified ? numberOr((intended.counts || {}).valid_no_call, 0) : 0,
        trading: 0
      },
      experimental: {
        label: "The implemented book, labelled experimental",
        data_gate: {
          directional: numberOr(dataCounts.valid_directional, 0),
          no_call: numberOr(dataCounts.valid_no_call, 0),
          insufficient: numberOr(dataCounts.insufficient_data, 0),
          undefined_rule: numberOr(dataCounts.undefined_rule, 0)
        },
        data_gate_withdrawals: dataGate.withdrawals || { directional_calls: 0, no_calls: 0 },
        implemented_insufficient: numberOr((implemented.counts || {}).insufficient_data, 0),
        implemented_withdrawals: implemented.withdrawals || { directional_calls: 0, no_calls: 0 },
        book: {
          allowed: numberOr(book.allowed, 0),
          blocked: numberOr(book.blocked, 0),
          abstained: numberOr(book.abstained, 0),
          traded: numberOr(summary.traded, 0)
        },
        note: dataGate.note || null
      },
      blockers: blockers,
      reconciliation: {
        data_blocked: dataBlocked,
        undefined_rule: undefinedRuleDates,
        note:
          "The blockers are conditions on the same mornings, not alternatives, so the rows must not be added: " +
          String(dataBlocked) +
          " of " +
          String(mornings) +
          " mornings fail at least one data rung, " +
          String(undefinedRuleDates) +
          " are undefined-rule mornings, and only " +
          String(verified) +
          " pass every rung and the rule."
      },
      exemplars: {
        verified: null,
        verified_note:
          "No morning passes the research gate, so there is no verified morning to link. The morning below comes closest: every stored input is accounted for and it still cannot be scored, because the rule it would be scored against is undefined.",
        blocked: blockedDate
          ? {
              date: blockedDate,
              href: buildHash({ test: "four_markets", market: "EURUSD", date: blockedDate }),
              reason: (blockedDay && blockedDay.reason) || "the intended candidate is CONFIG_BLOCKED",
              outcome: blockedMorning ? blockedMorning.outcome : null,
              direction: blockedMorning ? blockedMorning.direction : null,
              band: blockedMorning ? blockedMorning.band : null,
              failed_inputs: failedInputs
            }
          : null
      },
      tests: [
        {
          id: "dxy_direction",
          title: ORDINALS[0] + " USD direction on the broker DXY.cash lane",
          verified: 0,
          current: overall(dxyModels.current, null),
          challenger: overall(dxyModels.challenger_v1, null),
          note:
            "The official ICE cash lane is still blocked, so this denominator belongs to the broker lane and is experimental."
        },
        {
          id: "four_markets",
          title: ORDINALS[1] + " The USD call applied to EUR/USD, XAU/USD, NAS100 and BTC/USD",
          verified: 0,
          markets: fourMarkets
        },
        l2lTest("l2l_full_5r", "full", ORDINALS[2] + " Original L2L at 5R"),
        l2lTest("l2l_half_3r", "half", ORDINALS[3] + " Half L2L at 3R")
      ],
      links: [
        "data/usd-layer1-backtester/run-v1.json",
        "data/usd-layer1-backtester/engine-v1.json",
        "data/research/usd-session/final-adjudication-manifest.json",
        "backtester/lib/usd_layer1_backtester/model_identity.js",
        "backtester/lib/usd_layer1_backtester/collection.js",
        "backtester/lib/usd_layer1_backtester/factor_rulebook_v1.js",
        "automation/n8n/usd-l1-shadow-decision.workflow.json",
        "config/usd_l1_factor_rulebook_v1.json"
      ]
    };
  }

  function olderBacktests() {
    return OLDER_BACKTESTS.slice();
  }

  function plannedReviews() {
    return PLANNED_REVIEWS.slice();
  }

  /** `#backtesting`, `#backtesting/<date>` or `#backtesting/<test>/<market>/<date>`. */
  function parseHash(hash) {
    var text = String(hash || "").replace(/^#/, "");
    if (!text) return { tab: null, test: null, market: null, date: null };
    if (text === "backtesting-development" || text.indexOf("backtesting-development/") === 0) {
      return { tab: "backtesting-development", test: null, market: null, date: null };
    }
    if (text !== "backtesting" && text.indexOf("backtesting/") !== 0) {
      return { tab: null, test: null, market: null, date: null };
    }
    var parts = text.split("/").filter(Boolean).slice(1);
    var test = null;
    var market = null;
    var date = null;
    parts.forEach(function (part) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) date = part;
      else if (MARKET_LABELS[part.toUpperCase()]) market = part.toUpperCase();
      else if (TESTS.some(function (entry) { return entry.id === part; })) test = part;
    });
    return { tab: "usd-layer1-backtester", test: test, market: market, date: date };
  }

  /** The shareable form of the current selection. */
  function buildHash(selection) {
    var chosen = selection || {};
    var parts = ["backtesting"];
    if (chosen.test) parts.push(testById(chosen.test).id);
    if (chosen.market) parts.push(chosen.market);
    if (chosen.date) parts.push(chosen.date);
    return "#" + parts.join("/");
  }

  return {
    VERSION: VERSION,
    ORDINALS: ORDINALS,
    MARKETS: MARKETS,
    MARKET_LABELS: MARKET_LABELS,
    USD_PREDICTION: USD_PREDICTION,
    TESTS: TESTS,
    MAP_COLUMNS: MAP_COLUMNS,
    testById: testById,
    marketLabel: marketLabel,
    versions: versions,
    headline: headline,
    morningFor: morningFor,
    firedFor: firedFor,
    sessionFor: sessionFor,
    decisionFor: decisionFor,
    failSafes: failSafes,
    laneFailSafes: laneFailSafes,
    equity: equity,
    modelCoverage: modelCoverage,
    marketOutcome: marketOutcome,
    testStatus: testStatus,
    mapModel: mapModel,
    pathDetail: pathDetail,
    factorLedger: factorLedger,
    staleInputs: staleInputs,
    voteRegister: voteRegister,
    verification: verification,
    links: links,
    olderBacktests: olderBacktests,
    plannedReviews: plannedReviews,
    parseHash: parseHash,
    buildHash: buildHash
  };
});
