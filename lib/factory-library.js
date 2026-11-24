// The document library beneath each replay chamber.
//
// A replay chamber is a test bench, so the library under it is arranged in the order a visitor would investigate the
// test: research and adjudication, the model and its decision rules, the historical inputs, the replay and validation
// checks, then the results. Each document answers one question, carries the model or test it belongs to, and links
// its committed path. `used` separates what the replay run actually reads from related research that merely
// surrounds it.
//
// Everything here is presentation data over committed files. No credentials, account detail or operator material is
// copied in, and every path is checked by tests/factory_library.test.js against the repository.
(function initFactoryLibrary() {
  "use strict";

  const GROUPS = [
    {
      id: "research",
      label: "Research and adjudication",
      note: "What was investigated, attacked and settled before a rule was written."
    },
    {
      id: "model",
      label: "Model and decision rules",
      note: "The book the engine computes and the code that applies it."
    },
    {
      id: "inputs",
      label: "Historical inputs",
      note: "What the replay feeds the model, and where those rows were built."
    },
    {
      id: "replay",
      label: "Replay and validation checks",
      note: "The runner, its scoring code and the gate that reads a result."
    },
    {
      id: "results",
      label: "Results",
      note: "The artefact a run left behind, or the gap that says there is none."
    }
  ];

  const USD_TESTS = [
    {
      id: "dxy_direction",
      code: "T1",
      title: "USD direction on DXY",
      question: "Does the 05:00 USD call match the move to the next 05:00 London endpoint on the dollar index?",
      market: "DXY. The official ICE US dollar index, cash, at its official close - the lane the question is written for.",
      logic: "USD bullish predicts the index up, USD bearish predicts it down, with a flat band stated in the artefact.",
      data: "A licensed cash DXY history carrying both 05:00 London prints. The checkout holds FRED DTWEXBGS instead, which the run records as unable to stand in: it is a weekly release carried with a publication lag.",
      status: "blocked",
      statusLabel: "Official lane blocked · broker proxy scored",
      resultPath: "data/usd-layer1-backtester/run-v1.json",
      resultNote: "The run reports the official lane as blocked and scores a named broker CFD lane instead, under tests.dxy_direction_broker_cfd.",
      artefactKey: "dxy_direction_broker_cfd"
    },
    {
      id: "four_markets",
      code: "T2",
      title: "The USD call applied to four markets",
      question: "Does the USD-only hypothesis hold when it is applied to each market separately?",
      market: "EUR/USD, XAU/USD, NAS100 and BTC/USD, each read over the same session.",
      logic: "A USD-bullish call predicts every one of the four down, and a USD-bearish call predicts them up; the artefact states the outcome read and a per-market flat band.",
      data: "A session outcome per market, from each market's own daily series, paired with the stored USD call.",
      status: "scored",
      statusLabel: "Scored · per-market counts recorded",
      resultPath: "data/usd-layer1-backtester/run-v1.json",
      resultNote: "Per-market scored, hit, miss and flat counts with confidence bands sit under tests.four_markets; the data audit behind them is audit-v1.json.",
      artefactKey: "four_markets",
      historical: {
        model: "Current model",
        modelNote: "Production baseline, replayed from agent_usd_direction.md",
        // Mirrors `generated_at` in data/usd-layer1-backtester/run-v1.json; tests/factory_library.test.js fails if
        // the two drift, which is what keeps this copy from silently describing an older build.
        generatedAt: "2026-11-23T22:10:00.000Z",
        generatedLabel: "23 Nov 2026",
        artefactPath: "data/usd-layer1-backtester/run-v1.json",
        rows: [
          { market: "EUR/USD", accuracyPct: 49.43, scored: 439 },
          { market: "XAU/USD", accuracyPct: 55.68, scored: 458 },
          { market: "BTC/USD", accuracyPct: 50.0, scored: 536 },
          { market: "NAS100", accuracyPct: 52.86, scored: 454 }
        ]
      }
    },
    {
      id: "l2l_full_5r",
      code: "T3",
      title: "Original line-to-line ladder at 5R",
      question: "From a trade-qualified call, do the levels saved before the session produce a 5R line-to-line trade?",
      market: "EUR/USD, XAU/USD, NAS100 and BTC/USD.",
      logic: "Entry on the coded M5 trigger at the saved level, stop one fifth of the entry-to-target distance, target the next original level - REWARD_R_MULTIPLE = 5 in lib/l2l_strategy.js.",
      data: "The M5 tape for each market and the level ladder archived before the setup. The run records both as missing for these dates, in every market.",
      status: "blocked",
      statusLabel: "Blocked for all four markets · demo ledger only",
      resultPath: "data/usd-layer1-backtester/run-v1.json",
      resultNote: "tests.l2l_full_5r records the two blockers per market. The execution demo is kept separate and labelled: two EUR/USD days whose call direction came from the live fill record, not from an archived Layer 1 row.",
      artefactKey: "l2l_full_5r"
    },
    {
      id: "l2l_half_3r",
      code: "T4",
      title: "Half-grid ladder at 3R",
      question: "With one midpoint inserted between adjacent originals, what does the 3R half-grid trade produce?",
      market: "EUR/USD, XAU/USD, NAS100 and BTC/USD.",
      logic: "Original levels and their computed midpoints both arm; the stop is one third of the entry-to-target distance - HALF_LANE_R_MULTIPLE = 3.",
      data: "The same M5 tape and the same archived ladder as the full-grid test, read on the combined grid.",
      status: "blocked",
      statusLabel: "Blocked for all four markets",
      resultPath: "data/usd-layer1-backtester/run-v1.json",
      resultNote: "tests.l2l_half_3r records the same two blockers per market, so the half grid is not scored either.",
      artefactKey: "l2l_half_3r"
    }
  ];

  const document = (id, group, title, belongsTo, question, path, used, note) => ({
    id,
    group,
    title,
    belongsTo,
    question,
    path,
    used: Boolean(used),
    note: note || ""
  });

  // An asset with a replay runner gets the same five-group stack, built from the files that exist for it. An asset
  // without one gets the documents it does have and a named gap in the groups it cannot fill.
  function laneLibrary(code, spec) {
    const documents = [];
    const gaps = [];
    (spec.research || []).forEach((entry, index) => {
      documents.push(
        document(`${code}.research.${index + 1}`, "research", entry[1], `${code} research notes`, entry[2], entry[0], false)
      );
    });
    documents.push(
      document(
        `${code}.model.logic`,
        "model",
        `${code} logic document`,
        `${code} Layer 1 model`,
        "Which rule text does the engine run, and which inputs does it expect?",
        spec.logic,
        true
      )
    );
    if (spec.engine) {
      documents.push(
        document(
          `${code}.model.engine`,
          "model",
          `${code} Layer 1 Agent workflow export`,
          `${code} Layer 1 model`,
          "What does the deployed agent contain, node by node, and where does its decision come from?",
          spec.engine,
          false,
          "The export is the deployed engine. The replay mirrors its rule text; it does not read the export."
        )
      );
    }
    if (spec.builder) {
      documents.push(
        document(
          `${code}.inputs.builder`,
          "inputs",
          `${code} historical snapshot builder`,
          `${code} historical inputs`,
          `How is each historical ${code} snapshot rebuilt, row by row, from the stored series?`,
          spec.builder,
          true
        )
      );
      documents.push(
        document(
          `${code}.inputs.inventory`,
          "inputs",
          "Historical data inventory",
          "Shared inputs",
          "Which historical series exist, and which are still missing?",
          "docs/HISTORICAL_DATA_INVENTORY.md",
          false
        )
      );
    } else {
      gaps.push({
        group: "inputs",
        text: `No historical ${code} builder is committed, so the replay has no rebuilt snapshot to read.`
      });
    }
    if (spec.runner && spec.core) {
      documents.push(
        document(
          `${code}.replay.runner`,
          "replay",
          `${code} replay runner`,
          `${code} replay`,
          `How is a ${code} replay started, and what does it write?`,
          spec.runner,
          true
        )
      );
      documents.push(
        document(
          `${code}.replay.core`,
          "replay",
          `${code} replay core`,
          `${code} replay`,
          "How is each session scored against the call it produced?",
          spec.core,
          true
        )
      );
    } else {
      gaps.push({
        group: "replay",
        text: `No ${code} replay runner or replay core is committed, so nothing can be replayed for this asset yet.`
      });
    }
    documents.push(
      document(
        `${code}.replay.master`,
        "replay",
        "Backtester master logic",
        "Shared replay rules",
        "Which rules apply to every replay, whichever asset it belongs to?",
        "docs/backtester_master_logic.md",
        false
      )
    );
    gaps.push({
      group: "results",
      text: spec.runner
        ? `No ${code} replay report is stored in this checkout: the runner prints a report per run and nothing is committed.`
        : `No ${code} replay result exists, because no replay can be run for this asset.`
    });
    return { code, documents, tests: [], gaps };
  }

  const USD = {
    code: "USD",
    chamber: "The USD replay chamber runs four separate tests over the historical snapshots, and the result artefact records each one on its own.",
    documents: [
      document(
        "USD.research.register",
        "research",
        "USD factor register",
        "USD · deployed book (Set A) and research programme (Set B)",
        "Which ten factors does the deployed model score, and how far has each one been researched, reviewed and replayed?",
        "docs/research/handoff/usd/v1/USD_FACTOR_REGISTER.md",
        false,
        "The register records the deployed book's weights and every factor's evidence state. The replay applies the book from the engine code, not from this page, so the register is related research with a direct bearing on the model."
      ),
      document(
        "USD.research.sets",
        "research",
        "Three factor sets, side by side",
        "USD · Sets A, B and C",
        "Which model does a number belong to: the deployed book, the research programme, or the historical challenger?",
        "docs/dashboard-design/usd-factor-sets.md",
        false,
        "A public summary written for this map. It keeps the ten-factor book, the 25-chain programme and the challenger apart."
      ),
      document(
        "USD.research.catalogue",
        "research",
        "Research library catalogue",
        "USD · research programme (Set B)",
        "What are the twenty-five registered factor chains, and what stage has each one reached?",
        "data/research-library/catalog.json",
        false,
        "Twenty-five chains over six topic labels. The programme assigns no weight and no replay uses all of them."
      ),
      document(
        "USD.research.challenger",
        "research",
        "Historical challenger",
        "USD · historical challenger (Set C)",
        "What does the comparison book compute, and how does it differ from the deployed ten-factor book?",
        "backtester/lib/usd_layer1_backtester/challenger.js",
        true,
        "Nine mechanisms over seven shared-source families, one unit of say each, built only from factors with an executable rule. It is frozen and not validated."
      ),
      document(
        "USD.research.prompt",
        "research",
        "Factor research prompt (F1)",
        "USD · research programme (Set B)",
        "What was the research question put for one factor, and what did the red team and adjudication have to answer?",
        "docs/research/factors/usd/live-f1-vix-level/01-research-prompt.md",
        false,
        "One folder exists per factor, each with a research, red-team and adjudication prompt. F1 is shown as the example."
      ),
      document(
        "USD.research.manifest",
        "research",
        "Final adjudication manifest",
        "USD · research programme (Set B)",
        "Which factor was allowed to do what, after adjudication?",
        "data/research/usd-session/final-adjudication-manifest.json",
        false
      ),
      document(
        "USD.research.start",
        "research",
        "Research handoff: start here",
        "USD · research programme (Set B)",
        "Where does a reader start, and which documents does the handoff expect them to open first?",
        "docs/research/handoff/usd/v1/START_HERE.md",
        false
      )
    ],
    tests: USD_TESTS,
    gaps: [
      {
        group: "research",
        text: "The research programme registers twenty-five chains, and no factor has reached an accepted state: every register row reads review pending."
      }
    ]
  };

  USD.documents.push(
    document(
      "USD.model.logic",
      "model",
      "USD logic document",
      "USD · deployed Layer 1 model",
      "Which rule text does the agent fetch on every run, and what does it require of each input?",
      "logic/agent_usd_direction.md",
      true,
      "The replay core reads this same file, so the document and the test use one source."
    ),
    document(
      "USD.model.dossier",
      "model",
      "USD Layer 1 logic dossier",
      "USD · deployed Layer 1 model",
      "How does the exported pipeline turn one snapshot into one call, node by node?",
      "docs/analysis-engine/USD_LAYER1_LOGIC.md",
      false,
      "The verified pipeline walk-through behind the Inspect n8n flow panel."
    ),
    document(
      "USD.model.rulebook",
      "model",
      "Frozen factor rulebook v1",
      "USD · deployed Layer 1 model",
      "Which factors, weights and bands make up the frozen book the engine applies?",
      "config/usd_l1_factor_rulebook_v1.json",
      true
    ),
    document(
      "USD.model.decisions",
      "model",
      "Decision arithmetic v1",
      "USD · deployed Layer 1 model",
      "How are the bands, the deadband and the eligibility rules combined into one call?",
      "config/usd_l1_decision_rules_v1.json",
      true
    ),
    document(
      "USD.model.engine",
      "model",
      "The one engine",
      "USD · deployed Layer 1 model",
      "Where is the call actually decided, and what does it read?",
      "backtester/lib/usd_layer1_backtester/engine_v1.js",
      true,
      "Six checks and one decide(): the backtester's implementation of the same book."
    )
  );

  USD.documents.push(
    document(
      "USD.inputs.builder",
      "inputs",
      "USD historical snapshot builder",
      "USD · historical inputs",
      "How is each historical USD snapshot rebuilt from the stored series?",
      "backtester/builders/usd/build_usd_historical_snapshots.js",
      true
    ),
    document(
      "USD.inputs.spec",
      "inputs",
      "USD import format spec",
      "USD · historical inputs",
      "What shape must an imported series have before the builder will accept it?",
      "backtester/docs/usd_import_format_spec.md",
      false
    ),
    document(
      "USD.inputs.levels",
      "inputs",
      "Marked L2L level ladder",
      "USD · L2L tests",
      "Which levels were marked before the session, and what does the ladder store hold today?",
      "data/l2l-levels.json",
      true,
      "Read by the two line-to-line tests. The run records that no ladder was archived before these setups, which is one of its two blockers."
    ),
    document(
      "USD.inputs.inventory",
      "inputs",
      "Historical data inventory",
      "Shared inputs",
      "Which historical series exist, and which are still missing?",
      "docs/HISTORICAL_DATA_INVENTORY.md",
      false
    )
  );

  USD.documents.push(
    document(
      "USD.replay.runner",
      "replay",
      "USD historical replay runner",
      "USD · replay",
      "How is the USD replay started, and what does it report?",
      "backtester/replay/usd/run_usd_historical_replay.js",
      true
    ),
    document(
      "USD.replay.core",
      "replay",
      "USD replay core",
      "USD · replay",
      "How is each session scored, and how are the four test sets kept apart?",
      "backtester/replay/usd/usd_replay_core.js",
      true
    ),
    document(
      "USD.replay.readme",
      "replay",
      "USD replay notes",
      "USD · replay",
      "What do the replay's own notes say about what it does and does not score?",
      "backtester/replay/usd/README.md",
      false
    ),
    document(
      "USD.replay.master",
      "replay",
      "Backtester master logic",
      "Shared replay rules",
      "Which rules apply to every replay, whichever asset it belongs to?",
      "docs/backtester_master_logic.md",
      false
    ),
    document(
      "USD.replay.engineNote",
      "replay",
      "Engine note v1",
      "USD · replay",
      "What method, counts and open judgements sit behind the engine run?",
      "docs/USD_L1_ENGINE_V1.md",
      false
    )
  );

  USD.documents.push(
    document(
      "USD.results.run",
      "results",
      "USD backtest run v1",
      "USD · results",
      "What did each of the four tests record: scored, blocked, or missing its data?",
      "data/usd-layer1-backtester/run-v1.json",
      true,
      "The result artefact for T1 to T4. Each test keeps its own section, its own status and its own blockers."
    ),
    document(
      "USD.results.audit",
      "results",
      "USD data audit v1",
      "USD · results",
      "Which data gaps sit behind the coverage counts in the run?",
      "data/usd-layer1-backtester/audit-v1.json",
      true
    ),
    document(
      "USD.results.engine",
      "results",
      "USD engine artefact v1",
      "USD · results",
      "What did the engine decide on each morning, and what state did it record?",
      "data/usd-layer1-backtester/engine-v1.json",
      true
    )
  );

  USD.gaps.push({
    group: "results",
    text:
      "Two tests are blocked on data rather than on logic: the official cash DXY history is not licensed in this " +
      "checkout, and no M5 tape or pre-session ladder is archived for the four line-to-line markets. The two-day " +
      "execution demo is labelled as a demo and is not a test result."
  });

  const ASSETS = {
    USD,
    EUR: laneLibrary("EUR", {
      logic: "logic/agent_eur_direction.md",
      engine: "exports/eur_layer1_agent.json",
      builder: "backtester/builders/eur/build_eur_historical_snapshots.js",
      runner: "backtester/replay/eur/run_eur_historical_replay.js",
      core: "backtester/replay/eur/eur_replay_core.js",
      research: [
        [
          "workflows/eur_layer1_agent.md",
          "EUR agent workflow note",
          "What is the EUR agent for, and which parser fault is recorded against it?"
        ]
      ]
    }),
    GOLD: laneLibrary("GOLD", {
      logic: "logic/agent_gold_direction.md",
      engine: "exports/gold_layer1_agent.json",
      builder: "backtester/builders/gold/build_gold_historical_snapshots.js",
      runner: "backtester/replay/gold/run_gold_historical_replay.js",
      core: "backtester/replay/gold/gold_replay_core.js",
      research: [
        [
          "backtester/docs/gold_source_decision.md",
          "Gold source decision",
          "Which gold price source does the replay use, and why that one?"
        ]
      ]
    }),
    SILVER: laneLibrary("SILVER", {
      logic: "logic/agent_silver_direction.md",
      engine: "exports/silver_layer1_agent.json",
      research: [
        [
          "workflows/silver_layer1_agent.md",
          "Silver agent workflow note",
          "What does the Silver agent's own note say about its rule and its parser?"
        ],
        [
          "docs/DEEPSEEK_SILVER_PROGRESS.md",
          "Silver research progress",
          "How far has the Silver onboarding draft actually been taken?"
        ]
      ]
    }),
    NQ: laneLibrary("NQ", {
      logic: "logic/agent_nq_direction.md",
      engine: "exports/nq_layer1_agent.json",
      builder: "backtester/builders/nq/build_nq_historical_snapshots.js",
      runner: "backtester/replay/nq/run_nq_historical_replay.js",
      core: "backtester/replay/nq/nq_replay_core.js"
    }),
    BTC: laneLibrary("BTC", {
      logic: "logic/agent_btc_direction.md",
      engine: "exports/btc_layer1_agent.json",
      builder: "backtester/builders/btc/build_btc_historical_snapshots.js",
      runner: "backtester/replay/btc/run_btc_historical_replay.js",
      core: "backtester/replay/btc/btc_replay_core.js",
      research: [
        [
          "docs/BTC_HANDOVER_CUMULATIVE.md",
          "BTC handover",
          "What does the Bitcoin lane's cumulative handover record about its inputs and open work?"
        ]
      ]
    }),
    WTI: laneLibrary("WTI", { logic: "logic/agent_wti_direction.md" }),
    GBP: laneLibrary("GBP", { logic: "logic/agent_gbp_direction.md" })
  };

  const CHAMBERS = {
    USD: "Runs four separate tests over the historical snapshots and reports each one on its own.",
    EUR: "Replays the EUR historical snapshots through the EUR replay core.",
    GOLD: "Replays the gold historical snapshots through the gold replay core.",
    SILVER: "Nothing is replayed yet: the chamber is empty, and the library names the missing builder and runner.",
    NQ: "Replays the NQ historical snapshots through the NQ replay core.",
    BTC: "Replays the BTC historical snapshots through the BTC replay core.",
    WTI: "Nothing is replayed for WTI: no builder, runner or result is committed.",
    GBP: "Nothing is replayed for GBP: no builder, runner or result is committed."
  };

  Object.keys(ASSETS).forEach(code => {
    ASSETS[code].chamber = CHAMBERS[code];
    ASSETS[code].documents.forEach(doc => {
      if (!GROUPS.some(group => group.id === doc.group)) {
        throw new Error(`${doc.id} names an unknown group ${doc.group}`);
      }
    });
  });

  function groupById(id) {
    return GROUPS.find(group => group.id === id) || null;
  }

  function documentsFor(code, groupId) {
    const asset = ASSETS[code];
    if (!asset) return [];
    return asset.documents.filter(doc => doc.group === groupId);
  }

  function countsFor(code) {
    const asset = ASSETS[code];
    if (!asset) return { documents: 0, used: 0, related: 0, tests: 0, gaps: 0 };
    const used = asset.documents.filter(doc => doc.used).length;
    return {
      documents: asset.documents.length,
      used,
      related: asset.documents.length - used,
      tests: asset.tests.length,
      gaps: asset.gaps.length
    };
  }

  window.FactoryLibrary = {
    schemaVersion: "factory-library-v1",
    groups: GROUPS,
    assets: ASSETS,
    groupById,
    documentsFor,
    countsFor
  };
})();
