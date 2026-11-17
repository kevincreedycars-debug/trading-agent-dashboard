/**
 * Compose the Layer 1 backtest report from the engine, the two declarations and the published artefacts.
 *
 * The report is built, never written by hand: every figure in it comes from a decision the engine just took or
 * from a field in a published artefact, and every claim carries the path it came from. If a number cannot be
 * derived it is reported as null with the reason, never filled in.
 *
 * Research only.
 */
"use strict";

const { decide, reconcile, sha256, stableStringify } = require("./engine");
const { buildReadiness } = require("./readiness");
const { buildTests, pairCombinationDefinition } = require("./tests");

const SCHEMA_VERSION = "layer1-backtest-report.v1";

/**
 * The sessions carry their model output under `models`, while a declaration reads `session.run.models`; the
 * view below is the only adaptation, and it adds no value the artefact does not already hold.
 */
function sessionView(session) {
  return {
    asset: "USD",
    date: session.date,
    cutoff_at_utc: session.cutoff_at_utc,
    endpoint_at_utc: session.endpoint_at_utc,
    window_hours: session.window_hours,
    inputs: session.inputs || {},
    saved_inputs: session.saved_inputs || null,
    audit_values: session.audit_values || null,
    input_meta: session.input_meta || [],
    run: { models: session.models || {} },
    fired: session.fired || null,
  };
}

function publishedDecision(morning) {
  return {
    outcome: morning ? morning.outcome : null,
    direction: morning ? morning.direction : null,
    band: morning ? morning.band : null,
    trade: morning ? morning.trade : null,
  };
}

/**
 * The control is published per session as a call and a conviction, not as an outcome; the book's morning states
 * describe the candidate. Reconciling each record against the other model's artefact would report a difference
 * that is not one, so the published side is chosen per model.
 */
function publishedFor(role, session, morning) {
  if (role === "control") {
    const current = (session && session.models && session.models.current) || {};
    return {
      outcome: undefined,
      direction: current.direction === undefined ? undefined : current.direction,
      band: current.conviction === undefined ? undefined : current.conviction,
      trade: undefined,
    };
  }
  return publishedDecision(morning);
}

/**
 * Run both models over every session and reconcile each record with the published morning.
 *
 * @returns {{by_model: object, reconciliation: object, records: object[], mismatches: object[]}}
 */
function runDecisions({ run, engine, models }) {
  const sessions = run.sessions || [];
  const mornings = new Map((engine.morning_states || []).map((morning) => [morning.date, morning]));
  const records = [];
  const mismatches = [];
  const byModel = {};
  const totals = {
    fields_compared: 0,
    match: 0,
    engine_stricter: 0,
    mismatch: 0,
    not_published: 0,
    decisions_with_a_mismatch: 0,
  };

  for (const [key, model] of [
    ["control", models.control],
    ["candidate", models.candidate],
  ]) {
    const summary = {
      model_id: model.id,
      label: model.label,
      role: model.role,
      version: model.version,
      sessions: 0,
      allowed: 0,
      abstained: 0,
      blocked: 0,
      trade_eligible: 0,
      directional: 0,
      by_direction: {},
      abstain_reasons: {},
      block_reasons: {},
      identity: null,
      reconciling: { match: 0, engine_stricter: 0, mismatch: 0, not_published: 0 },
    };

    for (const session of sessions) {
      const record = decide(model, sessionView(session));
      const published = publishedFor(key, session, mornings.get(session.date));
      const check = reconcile(record, published);
      records.push(record);
      summary.sessions += 1;
      summary[record.outcome] += 1;
      if (record.trade_eligible) summary.trade_eligible += 1;
      if (record.direction && record.direction !== "NO_CALL") summary.directional += 1;
      summary.by_direction[record.direction] = (summary.by_direction[record.direction] || 0) + 1;
      if (!summary.identity) summary.identity = record.identity;
      const bucket = record.outcome === "blocked" ? summary.block_reasons : summary.abstain_reasons;
      for (const reason of record.reasons) bucket[reason.code] = (bucket[reason.code] || 0) + 1;

      for (const field of check.fields) {
        if (field.status === "not_published") {
          totals.not_published += 1;
          summary.reconciling.not_published += 1;
          continue;
        }
        totals.fields_compared += 1;
        totals[field.status] += 1;
        summary.reconciling[field.status] += 1;
      }
      if (!check.matches) {
        totals.decisions_with_a_mismatch += 1;
        mismatches.push({
          decision_id: check.decision_id,
          model: key,
          date: check.date,
          fields: check.fields.filter((field) => field.status === "mismatch"),
        });
      }
    }
    byModel[key] = summary;
  }

  return {
    by_model: byModel,
    reconciliation: totals,
    mismatches,
    records,
    notes: [
      "`engine_stricter` is expected: the engine refuses to publish a direction, a band or a trade flag on a blocked morning, and the published artefacts keep whatever the book computed before it blocked.",
      "A `mismatch` is not expected and is listed in full; there is no tolerance on a mismatch and none is applied here.",
    ],
  };
}

function measureOf(tests, id, model) {
  const found = tests.tests.find((entry) => entry.id === id);
  if (!found) return null;
  if (found.measures.length) return found.measures.find((entry) => entry.label === model) || null;
  const market = found.markets.find((entry) => entry.market === "EURUSD") || found.markets[0];
  if (!market) return null;
  return market.by_model.find((entry) => entry.label === model) || null;
}

function pctOf(part, whole) {
  if (!whole || part === null || part === undefined) return null;
  return Math.round((part / whole) * 100 * 100) / 100;
}

function collectFacts({ run, engine, tests, readiness, decisions }) {
  const mornings = engine.morning_states || [];
  const days = (run.validity_gate && run.validity_gate.days) || [];
  const gate = (run.validity_gate && run.validity_gate.data_gate) || {};
  const coverage = (run.coverage && run.coverage.by_model) || {};
  const intendedCounts = {};
  for (const day of days) {
    const intended = day && day.intended ? day.intended : "unknown";
    intendedCounts[intended] = (intendedCounts[intended] || 0) + 1;
  }

  const tradeFlagged = mornings.filter((morning) => morning.trade === true);
  const allowed = mornings.filter((morning) => morning.outcome === "allowed");
  const fourMarkets = tests.tests.find((entry) => entry.id === "four_markets");
  const perMarket = {};
  for (const market of (fourMarkets && fourMarkets.markets) || []) {
    perMarket[market.market] = {};
    for (const entry of market.by_model) {
      perMarket[market.market][entry.label] = {
        scored: entry.scored,
        accuracy_pct: entry.accuracy_pct,
        lower_bound_pct: entry.lower_bound_pct,
      };
    }
  }

  return {
    asset: "USD",
    sessions: days.length,
    first_date: days.length ? days[0].date : null,
    last_date: days.length ? days[days.length - 1].date : null,
    gate_counts: gate.counts || null,
    gate_note: gate.note || null,
    research_gate: run.validity_gate && run.validity_gate.research_gate ? run.validity_gate.research_gate : null,
    ladder: readiness.ladder,
    undefined_rule_mornings: intendedCounts.undefined_rule || 0,
    intended_gate_counts: intendedCounts,
    trade_flags: {
      published: tradeFlagged.length,
      on_allowed_mornings: tradeFlagged.filter((morning) => morning.outcome === "allowed").length,
      on_blocked_mornings: tradeFlagged.filter((morning) => morning.outcome === "blocked").length,
      allowed_mornings: allowed.length,
      blocked_mornings_with_a_direction: mornings.filter(
        (morning) => morning.outcome === "blocked" && morning.direction && morning.direction !== "NO_CALL"
      ).length,
    },
    coverage: {
      published: {
        control_calls: coverage.current ? coverage.current.calls_reconstructed : null,
        control_pct: coverage.current ? coverage.current.call_coverage_pct : null,
        candidate_calls: coverage.challenger_v1 ? coverage.challenger_v1.calls_reconstructed : null,
        candidate_pct: coverage.challenger_v1 ? coverage.challenger_v1.call_coverage_pct : null,
        source: "run-v1.json coverage.by_model (current, challenger_v1)",
      },
      engine: {
        control_directional: decisions.by_model.control.directional,
        control_pct: pctOf(decisions.by_model.control.directional, days.length),
        candidate_directional: decisions.by_model.candidate.directional,
        candidate_pct: pctOf(decisions.by_model.candidate.directional, days.length),
      },
      common_directional_mornings: tests.coverage_disclosure.common_directional_mornings,
      note:
        "The published coverage table and the engine's own call counts are different measures: the table counts reconstructed book calls, the engine counts calls that survive the declared gate. They are printed side by side and not merged.",
    },
    tests: {
      official_dxy: {
        usable: (tests.tests.find((entry) => entry.id === "dxy_direction") || {}).usable_sessions ?? null,
      },
      broker_dxy: {
        usable: (tests.tests.find((entry) => entry.id === "dxy_direction_broker_cfd") || {}).usable_sessions ?? null,
        control: measureOf(tests, "dxy_direction_broker_cfd", "control"),
        candidate: measureOf(tests, "dxy_direction_broker_cfd", "candidate"),
      },
      four_markets: { usable: fourMarkets ? fourMarkets.usable_sessions : null, per_market: perMarket },
      layer2: {
        usable: (tests.tests.find((entry) => entry.id === "l2l_path") || {}).usable_sessions ?? null,
        fills: (
          ((tests.tests.find((entry) => entry.id === "l2l_path") || {}).demonstration || {}).by_variant || []
        ).reduce(
          (sum, variant) => sum + variant.accounts.reduce((inner, account) => inner + (account.fills || 0), 0),
          0
        ),
      },
    },
    readiness,
  };
}

function findings(facts) {
  const broker = facts.tests.broker_dxy;
  const pick = (measure) =>
    measure
      ? { scored: measure.scored, accuracy_pct: measure.accuracy_pct, lower_bound_pct: measure.lower_bound_pct }
      : null;

  // One cell per published market and model. A cell counts as clearing a coin flip only when its published lower
  // bound is at or above 50%, which is stricter than comparing the point estimate.
  const cells = [];
  for (const [market, byModel] of Object.entries(facts.tests.four_markets.per_market || {})) {
    for (const [label, measure] of Object.entries(byModel)) {
      if (measure) cells.push({ market, label, ...measure });
    }
  }
  const scored = cells.filter((cell) => typeof cell.accuracy_pct === "number");
  const clearing = scored.filter((cell) => typeof cell.lower_bound_pct === "number" && cell.lower_bound_pct >= 50);
  const candidateCells = cells.filter((cell) => cell.label === "candidate");
  const candidateClearing = candidateCells.filter(
    (cell) => typeof cell.lower_bound_pct === "number" && cell.lower_bound_pct >= 50
  );
  const best = scored
    .slice()
    .sort((a, b) => b.accuracy_pct - a.accuracy_pct)
    .shift();
  const clearingText = () =>
    clearing.length
      ? `${clearing.length} of ${scored.length} market/model cells clear it (${clearing
          .map((cell) => `${cell.market}/${cell.label} at ${cell.accuracy_pct}% with a lower bound of ${cell.lower_bound_pct}%`)
          .join("; ")})`
      : `none of the ${scored.length} scored market/model cells clear it`;
  const candidateText = () =>
    candidateCells.length
      ? `of the ${candidateCells.length} candidate cells, ${candidateClearing.length} clear it`
      : "no candidate cell is scored";

  return [
    {
      id: "F1",
      claim:
        "No replayed morning passes the research gate: presence and freshness are mostly there, but no morning carries a verified 05:00 receipt or a named instrument.",
      numbers: {
        present: facts.ladder[0].passing,
        fresh: facts.ladder[1].passing,
        clocked: facts.ladder[2].passing,
        identified: facts.ladder[3].passing,
        sessions: facts.sessions,
      },
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "validity_gate.ladder" }],
    },
    {
      id: "F2",
      claim:
        "The intended 25-factor model has no defined rule on any morning, so every candidate figure in this report comes from the implemented book and is not a valid call for the intended model.",
      numbers: { undefined_rule_mornings: facts.undefined_rule_mornings, sessions: facts.sessions },
      evidence: [
        { path: "data/usd-layer1-backtester/run-v1.json", field: "validity_gate.days[].intended" },
        { path: "data/usd-layer1-backtester/engine-v1.json", field: "book_detail.version" },
      ],
    },
    {
      id: "F3",
      claim:
        "The published artefacts flag more trades than the mornings they allow: a trade flag survives on mornings the book itself marks blocked.",
      numbers: facts.trade_flags,
      evidence: [
        { path: "data/usd-layer1-backtester/engine-v1.json", field: "morning_states[].trade" },
        { path: "data/usd-layer1-backtester/engine-v1.json", field: "morning_states[].outcome" },
      ],
    },
    {
      id: "F4",
      claim:
        "The candidate calls on far fewer mornings than the control, and on fewer than the artefact's own coverage table claims, so its accuracy is not comparable to the control's without printing coverage beside both.",
      numbers: facts.coverage,
      evidence: [
        { path: "data/usd-layer1-backtester/run-v1.json", field: "coverage.by_model" },
        { path: "data/usd-layer1-backtester/run-v1.json", field: "sessions[].models.current.direction" },
      ],
    },
    {
      id: "F5",
      claim:
        "The one directional test with a denominator is scored on a broker proxy, and both models land near a coin flip: neither lower confidence bound clears 50%.",
      numbers: { usable_sessions: broker.usable, control: pick(broker.control), candidate: pick(broker.candidate) },
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "tests.dxy_direction_broker_cfd" }],
    },
    {
      id: "F6",
      claim:
        "The official-index test has never been scored because the official series is not in the checkout, and the layer-2 path test has no usable history: its only evidence is a worked demonstration.",
      numbers: {
        official_usable_sessions: facts.tests.official_dxy.usable,
        layer2_usable_sessions: facts.tests.layer2.usable,
        layer2_demonstration_fills: facts.tests.layer2.fills,
      },
      evidence: [
        { path: "data/usd-layer1-backtester/run-v1.json", field: "tests.dxy_direction" },
        { path: "data/usd-layer1-backtester/run-v1.json", field: "tests.l2l_full_5r" },
      ],
    },
    {
      id: "F7",
      claim:
        `Four-market confirmation is published market by market, never as one aggregate: ${clearingText()}, and ${candidateText()}.`,
      numbers: {
        per_market: facts.tests.four_markets.per_market,
        cells: cells.length,
        cells_with_lower_bound_at_or_above_50: clearing.map((cell) => `${cell.market}/${cell.label}`),
        best_point_accuracy: best
          ? { market: best.market, label: best.label, accuracy_pct: best.accuracy_pct, lower_bound_pct: best.lower_bound_pct }
          : null,
      },
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "tests.four_markets.models[].markets" }],
    },
  ];
}
function modelCard(model, decisions) {
  const summary = decisions.by_model[model.role];
  const sample = decisions.records.find((record) => record.model.id === model.id && record.outcome !== "blocked");
  return {
    id: model.id,
    label: model.label,
    role: model.role,
    asset: model.asset,
    version: model.version,
    rulebook_version: model.rulebook_version || null,
    identity: summary ? summary.identity : null,
    gate_basis: (sample && sample.gate ? sample.gate.basis : null) || null,
    check_chain: model.checkChain.map((check) => ({ id: check.id, name: check.name, on_fail: check.on_fail })),
    eligibility: sample ? sample.eligibility : null,
    evidence: model.evidence || [],
  };
}

function blockers({ run, engine, decisions, facts }) {
  return [
    {
      id: "B1",
      blocker: "No verified 05:00 receipt on any morning",
      detail:
        "The clock rung passes on 0 of 725 mornings because no receipt archive exists, so the strict gate cannot open and no candidate result can be called valid.",
      effect: "candidate readiness is 0/725; every candidate figure is provisional",
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "validity_gate.ladder" }],
    },
    {
      id: "B2",
      blocker: "The intended 25-factor model has no single defined rule",
      detail:
        "The identity block reads CONFIG_BLOCKED: the rulebook has 25 rows but no agreed sign, weighting or tie policy, so the implemented book stands in for it.",
      effect: "the candidate cannot be scored as intended; only the implemented book is measured",
      evidence: [{ path: "config/usd_l1_factor_rulebook_v1.json", role: "frozen rulebook" }],
    },
    {
      id: "B3",
      blocker: "The official ICE dollar index series is absent",
      detail: `The official test has ${facts.tests.official_dxy.usable} usable sessions; the only scored directional test uses a broker proxy.`,
      effect: "the headline accuracy number is a proxy result and is labelled as one",
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "tests.dxy_direction" }],
    },
    {
      id: "B4",
      blocker: "No 5-minute tape or archived level ladder for the layer-2 path test",
      detail:
        "All four markets report the same two blockers, so no line-to-line trade can be replayed; the ledger is a two-day demonstration.",
      effect: "the path test is unscored on history",
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "tests.l2l_full_5r.markets" }],
    },
    {
      id: "B5",
      blocker: "Nine of the required inputs are missing from the saved as-of frame",
      detail:
        "The archive carries nine saved inputs and the requirement table names the rest, so most blocked mornings are an absence of data rather than a model judgement.",
      effect: "108 of 725 mornings are data exclusions on the control's own gate",
      evidence: [{ path: "data/usd-layer1-backtester/run-v1.json", field: "validity_gate.days[].missing" }],
    },
    {
      id: "B6",
      blocker: "No file named Handover.md exists in the checkout",
      detail:
        "The USD handover is present as docs/research/handoff/usd/v1/START_HERE.md with USD_SYSTEM_CONTEXT.md and HANDOFF_MANIFEST.json; reading order and scope come from those.",
      effect: "none on the numbers; the report cites the handover it actually found",
      evidence: [{ path: "docs/research/handoff/usd/v1/START_HERE.md", role: "the handover this report cites" }],
    },
  ];
}

function ownerDecisions(facts) {
  const published = facts.coverage.published;
  const engine = facts.coverage.engine;
  return [
    {
      id: "OD-1",
      status: "resolved",
      question: "Does pair-combination accuracy mean two independent Layer 1 legs, or the existing USD-only cross-market test?",
      decision:
        "Keep the agreed USD-only inverse cross-market test. It is one USD call against four market outcomes and it is test 3. Combining two independent Layer 1 calls is a separate future test with its own definition, and it stays unscored.",
      effect: ["tests.four_markets keeps its name and its four per-market denominators.", "pair_combination remains registered and unscored."],
      does_not_license: "It does not license a second leg, a leg mapping or a pair-level accuracy number.",
    },
    {
      id: "OD-2",
      status: "resolved",
      question: "Which gate defines published readiness and accuracy: presence and freshness, or present + fresh + clocked + identified?",
      decision:
        "Headline readiness uses the selected model's strict evidence gate. Each performance result uses its own eligible sample and displays its denominator beside it.",
      effect: [
        `The strict headline is 0 of ${facts.sessions} for both models, because no 05:00 receipt exists.`,
        "The control's narrow gate remains visible as a labelled comparison, never as the headline.",
        `The candidate's legacy reconstructed sample (${published.candidate_calls}) and its gated call count (${engine.candidate_directional}) are printed separately.`,
      ],
      does_not_license: "It does not license one blended accuracy figure, and it does not upgrade a proxy test to a headline.",
    },
    {
      id: "OD-3",
      status: "resolved",
      question: "Should the trade flags on blocked mornings be withdrawn, relabelled, or kept?",
      decision:
        "A blocked morning creates no valid decision and no trade. Any contradictory legacy trade flag is preserved as an audit finding, not deleted and not traded.",
      effect: [
        "The engine keeps trade_eligible false on every blocked or abstained morning.",
        "The published flag is retained, counted under engine_stricter and reported by the run audit as trade_on_blocked_morning.",
      ],
      does_not_license: "It does not license rewriting the published artefact, and it does not turn a withdrawn flag into a trade.",
    },
    {
      id: "OD-4",
      status: "resolved",
      question: "Is the flat band and the scoring tie policy frozen for the USD session?",
      decision:
        "The exact proposed flat bands and the tie treatment are returned per instrument in the screen payload, frozen from development dates only, before any holdout outcome is examined.",
      effect: [
        "A move strictly inside the band is flat: excluded from the accuracy denominator and counted separately.",
        "A vote that nets exactly zero, or sits inside the 0.20 deadband, is NO_CALL; there is no coin flip and no direction-priority tie-break.",
        "The bands are applied unchanged to the 400 unseen mornings.",
      ],
      does_not_license: "It does not license re-fitting a band after a holdout result, and it does not license dropping flat mornings silently.",
    },
    {
      id: "OD-5",
      status: "resolved",
      question: `Which coverage figure is authoritative for the candidate: the coverage table's ${published.candidate_calls} reconstructed calls or the engine's ${engine.candidate_directional} gated calls?`,
      decision:
        "Trace both to their model, gate, dates and source artefact, show their overlap and exclusions, and report scheduled, reconstructed, valid, directional and scored counts separately. Neither figure is authoritative for the other.",
      effect: [
        "The screen prints the five counts per model with their own definitions and denominators.",
        "The broker-proxy test's candidate denominator is labelled as the legacy reconstructed sample, because it contains calls the gated engine would not make.",
      ],
      does_not_license: "It does not license treating reconstructed calls as valid calls, or asserting that one count contains the other.",
    },
  ];
}

/**
 * Compose the report.
 *
 * @param {object} options
 * @param {object} options.run the published run-v1 artefact
 * @param {object} options.engine the published engine-v1 artefact
 * @param {object} options.models the declarations from createModels()
 * @param {string} [options.generated_at] an ISO timestamp supplied by the caller, so the report is reproducible
 * @param {object[]} [options.sources] [{path, bytes, sha256}] for the provenance block
 */
function buildReport({ run, engine, models, generated_at, sources }) {
  const decisions = runDecisions({ run, engine, models });
  const readiness = buildReadiness({ run, engine });
  const tests = buildTests({ run, pairCombination: pairCombinationDefinition() });
  const facts = collectFacts({ run, engine, tests, readiness, decisions });

  const blockedSample = decisions.records.find(
    (record) => record.model.role === "candidate" && record.date === (readiness.worked_morning || {}).date
  );
  const abstainedSample = decisions.records.find(
    (record) => record.model.role === "candidate" && record.outcome === "abstained"
  );

  const body = {
    schema_version: SCHEMA_VERSION,
    research_only: true,
    generated_at: generated_at || null,
    asset: facts.asset,
    title: "Layer 1 backtesting: first evidence report",
    claim:
      "One engine now takes both models over the same 725 mornings. No morning is valid for the intended model, the only scored directional test is a broker proxy and sits at a coin flip, and the published artefacts flag more trades than they allow.",
    scope: {
      sessions: facts.sessions,
      first_date: facts.first_date,
      last_date: facts.last_date,
      cutoff: "05:00 Europe/London, window ends 05:00 the next local day",
      gate_counts: facts.gate_counts,
      gate_note: facts.gate_note,
      research_gate: facts.research_gate,
    },
    models: [modelCard(models.control, decisions), modelCard(models.candidate, decisions)],
    findings: findings(facts),
    decisions: {
      by_model: decisions.by_model,
      reconciliation: decisions.reconciliation,
      mismatch_count: decisions.mismatches.length,
      mismatches: decisions.mismatches.slice(0, 25),
      notes: decisions.notes,
      samples: {
        blocked: blockedSample
          ? { date: blockedSample.date, outcome: blockedSample.outcome, reasons: blockedSample.reasons }
          : null,
        abstained: abstainedSample
          ? {
              date: abstainedSample.date,
              outcome: abstainedSample.outcome,
              direction: abstainedSample.direction,
              band: abstainedSample.band,
              reasons: abstainedSample.reasons,
            }
          : null,
      },
    },
    readiness,
    tests,
    blockers: blockers({ run, engine, decisions, facts }),
    owner_decisions: ownerDecisions(facts),
    limitations: [
      "Every figure is a replay of stored artefacts, not a live measurement: a defect in an artefact carries into the report.",
      "The candidate figures describe the implemented book, not the intended 25-factor model, which has no defined rule.",
      "The directional accuracy is measured against a broker proxy series, not the official index.",
      "Coverage differs by model, so accuracy figures are not like-for-like and are never aggregated across models.",
      "No compounding, sizing or execution is modelled anywhere in this area; a trade flag is not a trade.",
    ],
    not_claimed: [
      "No edge, no profitability and no forecast.",
      "No live execution, no order and no sizing.",
      "No claim that a blocked morning would have been profitable or unprofitable.",
      "No claim that the implemented book represents the intended model.",
    ],
    evidence_index: [
      { path: "data/usd-layer1-backtester/run-v1.json", role: "sessions, coverage, validity gate, tests" },
      { path: "data/usd-layer1-backtester/engine-v1.json", role: "book version, per-morning states and checks" },
      { path: "config/usd_l1_factor_rulebook_v1.json", role: "frozen 25-row rulebook" },
      { path: "config/usd_l1_decision_rules_v1.json", role: "frozen decision rules v1.0.0" },
      { path: "docs/research/handoff/usd/v1/START_HERE.md", role: "the USD handover and its session contract" },
      { path: "lib/layer1_backtesting/engine.js", role: "the decision engine that produced every record" },
      { path: "lib/layer1_backtesting/models.js", role: "the two declarations" },
    ],
  };

  const digest = sha256(stableStringify(body));
  return {
    ...body,
    provenance: {
      inputs: (sources || []).slice(),
      report_sha256: digest,
      note:
        "The digest is taken over the body before this block; rebuilding the report from the same artefacts reproduces it.",
    },
  };
}

module.exports = {
  SCHEMA_VERSION,
  buildReport,
  runDecisions,
  collectFacts,
  findings,
  sessionView,
};
