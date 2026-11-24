/**
 * The Backtesting screen payload.
 *
 * One JSON file feeds the page: summary, the two model identities, the architecture graph with its dated
 * evidence, one row per scheduled morning per test, the decision ledger and the run audit. Nothing in the page
 * is typed by hand, and every figure here comes from the report that was just built or from the artefact named
 * beside it.
 *
 * Research only.
 */
"use strict";

const { createLedger, saveDecision, referenceDecisions, auditRecord, decisionId, snapshotValues } = require("./ledger");
const fs = require("node:fs");
const path = require("node:path");
const { hashTextFile, sha256, snapshotHash } = require("./engine");
const { sessionView } = require("./report");
const { ownerDecisions } = require("./owner_decisions");

const { buildCoverageTrace } = require("./coverage_trace");

const SCHEMA_VERSION = "backtesting-screen.v1";

const MODEL_KEYS = [
  ["control", "current"],
  ["candidate", "challenger_v1"],
];

function pct(part, whole) {
  if (!whole) return null;
  return Math.round((part / whole) * 10000) / 100;
}

function datesOf(sessions, predicate) {
  return sessions.filter(predicate).map((session) => session.date);
}

function span(dates) {
  return { count: dates.length, first: dates[0] || null, last: dates[dates.length - 1] || null };
}

function sumValues(map) {
  return Object.values(map || {}).reduce((total, value) => total + (Number(value) || 0), 0);
}

/**
 * Build the required-input set the executable trade rule needs: every field of every adjudication the book
 * enforces. Fields of non-voting rows are kept separately, because their absence is a warning, not an error.
 */
function requiredFieldsOf(requirementTable) {
  const required = new Set();
  const advisory = new Set();
  for (const row of requirementTable || []) {
    const target = row.enforced_by_implemented_book && row.treatment === "direction" ? required : advisory;
    for (const field of row.fields || []) target.add(field);
  }
  return { required: [...required].sort(), advisory: [...advisory].sort() };
}

function statusOf(record) {
  if (!record) return "missing_record";
  if (record.outcome === "blocked") return "blocked";
  if (record.outcome === "abstained") return "valid_abstention";
  if (!record.direction || record.direction === "NO_CALL") return "no_call";
  return "allowed";
}

function buildGaps({ run, requirementTable }) {
  const sessions = run.sessions || [];
  const days = (run.validity_gate && run.validity_gate.days) || [];
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  const missingDates = new Map();
  for (const session of sessions) {
    const day = dayByDate.get(session.date);
    const fields = new Set([...(session.inputs_missing || []), ...((day && day.missing) || [])]);
    for (const field of fields) {
      if (!missingDates.has(field)) missingDates.set(field, []);
      missingDates.get(field).push(session.date);
    }
  }
  const gaps = {};
  const coverage = (run.coverage && run.coverage.by_model) || {};
  const coverageTables = { control: coverage.current || {}, candidate: coverage.challenger_v1 || {} };
  for (const [field, dates] of missingDates) {
    const rows = (requirementTable || []).filter((row) => (row.fields || []).includes(field));
    const source = [...new Set(rows.map((row) => row.source).filter(Boolean))];
    const coverageCounts = Object.entries(coverageTables)
      .map(([role, table]) => ({ role, count: (table.inputs_missing_histogram || {})[field] }))
      .filter((entry) => entry.count !== undefined);
    gaps[field] = {
      field,
      affected: { ...span(dates), dates },
      factors: [...new Set(rows.map((row) => row.factor_id))],
      sources: source,
      action: rows.length ? rows[0].missing_action : "no requirement row names this field",
      candidate: rows.length ? rows[0].candidate : null,
      freshness_business_days: rows.length ? rows[0].freshness_business_days : null,
      scope: "sessions[].inputs_missing union validity_gate.days[].missing",
      coverage_missing: coverageCounts.length ? coverageCounts : null,
      coverage_note: coverageCounts.length
        ? "The coverage table counts a field as missing when the model's own read is unavailable, which can exceed the count of mornings with no stored value. Both are shown, neither is silently preferred."
        : null,
      evidence_requirement:
        "a print dated at or before 05:00 Europe/London on the morning, with a receipt proving it was in hand by 05:00; a later print cannot be carried back",
    };
  }
  return gaps;
}

function biggestGap(gaps, requirementTable) {
  const fields = new Set();
  for (const row of requirementTable || []) for (const field of row.fields || []) fields.add(field);
  const candidates = Object.values(gaps)
    .filter((gap) => fields.has(gap.field))
    .sort((a, b) => b.affected.count - a.affected.count);
  return candidates[0] || null;
}

function nextToObtain({ biggest, gaps, readiness, packageInfo, run }) {
  const items = [];
  if (biggest) items.push(`Obtain ${biggest.field}: ${biggest.sources.join("; ") || "source unnamed"}. ${biggest.candidate || biggest.action}`);
  items.push(
    "Obtain a 05:00 receipt archive: the clock rung passes on 0 mornings, so no morning is valid for either model. A receipt must prove the reading was in hand by 05:00 Europe/London."
  );
  items.push(
    "Obtain instrument identity: the identified rung passes on 0 mornings, so every saved input is unlabelled as to instrument and source."
  );
  const official = (((run.tests || {}).dxy_direction || {}).official_series) || {};
  if (official.required_series) items.push(`Obtain ${official.required_series}: ${official.blocker_owner || "owner unnamed"}.`);
  if (packageInfo && packageInfo.status !== "PRESENT")
    items.push(`Produce or locate ${packageInfo.requested}: the four H1 tests stay unscored until its 25 adjudications map to executable rules.`);
  return items;
}

function cellFor({ role, session, record, testId, gaps, publishedKey }) {
  const status = statusOf(record);
  const missing = record && record.gate ? [...(record.gate.missing || []), ...(record.gate.stale || [])] : [];
  const cells = {
    status,
    outcome: record ? record.outcome : null,
    direction: record ? record.direction : null,
    band: record ? record.band : null,
    trade_eligible: record ? record.trade_eligible : null,
    decision_id: record ? decisionId(record) : null,
    gaps: missing.filter((field) => gaps[field]),
    missing_fields: missing,
    reasons: record ? (record.reasons || []).map((reason) => `${reason.code}: ${reason.text}`) : [],
    checks: record ? record.checks : null,
  };
  if (testId === "dxy_direction") {
    cells.model_status = status;
    cells.status = "blocked";
    cells.gaps = ["ICE_cash_dxy_official_close"];
    cells.note = "the official series is absent, so this morning cannot be scored for either model";
  } else if (testId === "dxy_direction_broker_cfd") {
    const published = (session.models && session.models[publishedKey]) || {};
    const legacy = published.direction && published.direction !== "NO_CALL";
    cells.legacy_reconstructed_call = Boolean(legacy);
    if (status === "allowed" && legacy) {
      cells.status = "scored_in_legacy_aggregate";
      cells.note = "scored in the published aggregate on the reconstructed call; the per-morning outcome is not stored in the artefact";
    } else if (status === "allowed") {
      cells.status = "not_in_legacy_sample";
      cells.note = "the engine allows this morning but the published reconstructed call set does not contain it";
    } else if (status === "valid_abstention") {
      cells.status = "valid_abstention";
      cells.note = "the book chose not to call; not a data gap and not scored";
    }
  } else if (testId === "four_markets") {
    cells.markets = (session.results && session.results[publishedKey]) || null;
    const scored = cells.markets && Object.values(cells.markets).some((value) => value === "hit" || value === "miss");
    if (scored) {
      cells.status = "scored";
      cells.note = "per-market outcomes are stored per morning; each market keeps its own denominator";
    }
  } else if (testId === "l2l_full_5r" || testId === "l2l_half_3r") {
    cells.model_status = status;
    cells.status = "blocked";
    cells.gaps = ["five_minute_tape", "level_ladder"];
    cells.note =
      testId === "l2l_half_3r"
        ? "no 5-minute tape and no archived level ladder, plus the midpoint geometry"
        : "no 5-minute tape and no level ladder archived before the setup";
  }
  return cells;
}

function countStatuses(rows, pick) {
  const counts = {};
  for (const row of rows) {
    const value = pick(row).status;
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function buildTestSection({ run, decisions, tests, gaps, h1 = null }) {
  const sessions = run.sessions || [];
  const records = {
    control: new Map(decisions.records.filter((record) => record.model.role === "control").map((record) => [record.date, record])),
    candidate: new Map(decisions.records.filter((record) => record.model.role === "candidate").map((record) => [record.date, record])),
  };
  const rowsByTest = {};
  for (const test of tests.tests) {
    rowsByTest[test.id] = sessions.map((session) => {
      const control = cellFor({ role: "control", session, record: records.control.get(session.date), testId: test.id, gaps, publishedKey: "current" });
      const candidate = cellFor({ role: "candidate", session, record: records.candidate.get(session.date), testId: test.id, gaps, publishedKey: "challenger_v1" });
      return { date: session.date, status: candidate.status, control_status: control.status, control, candidate };
    });
  }
  if (h1) {
    const byDate = h1.coverage && h1.coverage.byDate ? h1.coverage.byDate : null;
    for (const rows of Object.values(rowsByTest)) {
      for (const row of rows) {
        const coverage = byDate ? byDate.get(row.date) : null;
        row.h1 = {
          model_id: h1.model.id,
          model_version: h1.model.version,
          status: "unscored",
          coverage: coverage && coverage.ready ? "ready" : "blocked",
          decision_id: `${h1.model.id}@${row.date}`,
          direction: "NO_CALL",
          trade_eligible: false,
          scored: false,
          note: "H1 is unscored; this cell reports its nine-input coverage state, not a result.",
        };
      }
    }
  }
  const definitions = tests.tests.map((test) => ({
    id: test.id,
    ordinal: test.ordinal,
    label: test.label,
    question: test.question,
    type: test.type,
    status: test.status,
    status_label: test.status_label || null,
    usable_sessions: test.usable_sessions === undefined ? test.usable : test.usable_sessions,
    available_sessions: test.available,
    outcome_source: test.outcome_source,
    notes: test.notes || [],
    evidence: test.evidence || [],
    // A blocked path test says two separate things: the simulator exists and is tested, and the history
    // it needs is absent. Both travel with the definition so no reader can read one as the other.
    simulation: test.simulation || null,
    blocked_on: test.blocked_on || null,
    counts: {
      rows: rowsByTest[test.id].length,
      candidate: countStatuses(rowsByTest[test.id], (row) => row.candidate),
      control: countStatuses(rowsByTest[test.id], (row) => row.control),
    },
  }));
  const supplementary = (tests.supplementary || []).map((test) => ({
    id: test.id,
    label: test.label,
    question: test.question,
    status: test.status,
    usable_sessions: test.usable_sessions === undefined ? test.usable : test.usable_sessions,
    outcome_source: test.outcome_source,
    notes: test.notes || [],
    evidence: test.evidence || [],
    agreed_four: false,
  }));
  return { definitions, rows: rowsByTest, supplementary };
}

function evidenceOf({ root, relative, note, date }) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return { path: relative, present: false, date: date || null, note };
  const buffer = fs.readFileSync(file);
  return {
    path: relative,
    present: true,
    ...hashTextFile(buffer),
    date: date || null,
    note,
  };
}

function buildArchitecture({ root, run, engine, tests, coverageTrace, mapping, packageInfo, biggest, generatedAt, h1 }) {
  const dates = {
    report: generatedAt || null,
    frozen: (engine.book_detail && engine.book_detail.frozen_on) || null,
    run: run.generated_at || null,
  };
  const evidence = (relative, note, date) => evidenceOf({ root, relative, note, date });
  const candidateTrace = coverageTrace.by_model.candidate;

  const nodes = [
    {
      id: "research",
      label: "Research",
      kind: "stage",
      status: "verified",
      summary: "25 registered factor chains, five assignment files and the frozen session contract.",
      detail: [
        "The programme registers 25 factor chains in data/research-library/catalog.json; ten carry deployed factor ids and fifteen are research-named.",
        "The USD session contract is frozen at 05:00 Europe/London with a 24-hour window and DST following.",
        "The four H1 tests are defined in lib/layer1_backtesting/tests.js and are not scored by this node.",
      ],
      evidence: [
        evidence("data/research-library/catalog.json", "25 chains, their topics and prompt hashes", dates.frozen),
        evidence("docs/research/usd-session/v1/session_contract_v1.json", "the frozen 05:00 London session contract", dates.frozen),
        evidence("lib/layer1_backtesting/tests.js", "the four test definitions and the pair-combination definition", dates.report),
      ],
      links: ["rulebook"],
    },
    {
      id: "rulebook",
      label: "Rulebook",
      kind: "stage",
      status: "verified",
      summary: "The frozen 25-row rulebook and the decision rules, both version stamped and hashed.",
      detail: [
        `Rulebook version ${(engine.book_detail && engine.book_detail.version) || "unstated"}, frozen ${dates.frozen || "undated"}.`,
        "Every row is disposition Blocked: the adjudication validates no sign, weight or threshold.",
        packageInfo.status === "PRESENT"
          ? `${packageInfo.requested} is present in this checkout.`
          : `${packageInfo.requested} is absent from this checkout; the nearest frozen package is the v1.0.0 book.`,
      ],
      evidence: [
        evidence("config/usd_l1_factor_rulebook_v1.json", "25 adjudicated rows", dates.frozen),
        evidence("config/usd_l1_decision_rules_v1.json", "families, deadband, bands and trade rule", dates.frozen),
      ],
      links: ["candidate_package"],
    },
    {
      id: "candidate_package",
      label: "Supplied candidate package",
      kind: "stage",
      status:
        h1 && h1.package.status === "VERIFIED" && h1.package.acceptance && h1.package.acceptance.status === "PASS" && h1.review.accounting.all_pass
          ? "verified"
          : "verified_with_gap",
      summary: h1
        ? `${h1.package.requested} · ${h1.package.internal_checksums.verified}/${h1.package.internal_checksums.declared} file sums, its own verify.js ${h1.package.acceptance.status.toLowerCase()}, ${h1.review.summary.discrepancy_count} recorded findings.`
        : "No supplied candidate package is registered in this checkout.",
      detail: h1
        ? [
            `Committed at ${h1.package.package.commit} (${h1.package.package.commit_subject}).`,
            `Rulebook ${h1.package.declared_hashes.rulebook_sha256.slice(0, 16)}… · models ${h1.package.declared_hashes.models_sha256.slice(0, 16)}… · inputs ${h1.package.declared_hashes.inputs_sha256.slice(0, 16)}…`,
            `25 adjudications: ${h1.review.summary.votes} votes across ${Object.keys(h1.review.summary.votes_by_family).length} families, ${h1.review.summary.gate_inputs} gate inputs, ${h1.review.summary.required_not_voting_rows} required rows that cannot vote, ${h1.review.summary.no_declared_input} explicit exclusions.`,
            `Open findings recorded for v0.1.1, not applied to the frozen candidate: ${h1.review.discrepancies
              .filter((item) => item.status === "recorded_not_applied")
              .map((item) => item.id)
              .join(", ")}.`,
            h1.review.verdict,
          ]
        : [],
      evidence: h1
        ? [
            evidence(`${h1.package.package.root}/SHA256SUMS`, "the 16 declared file hashes, recomputed byte for byte", h1.package.verified_on),
            evidence(`${h1.package.package.root}/RULEBOOK.md`, "the supplied rule and its evidence register", h1.package.verified_on),
            evidence(`${h1.package.package.root}/rows.json`, "the 25 adjudications and their registered verdicts", h1.package.verified_on),
            evidence("lib/layer1_backtesting/h1_review.js", "the independent row-by-row review", dates.report),
            evidence("lib/layer1_backtesting/h1_package.js", "the checksum and verify.js runner", dates.report),
          ]
        : [],
      links: ["adjudications"],
    },
    {
      id: "adjudications",
      label: "25 adjudications to rules",
      kind: "stage",
      status: mapping.summary.unmapped || mapping.summary.mapped_not_enforced || mapping.summary.missing_implementation ? "verified_with_gap" : "verified",
      summary: `${mapping.summary.mapped_and_executable} of ${mapping.summary.adjudications} rows have an enforced executable vote; ${mapping.summary.mapped_shared} share a vote; ${mapping.summary.missing_implementation} are declared but not implemented; ${mapping.hypotheses.length} hypotheses are visible.`,
      detail: [
        mapping.verdict,
        `Families: ${mapping.summary.families.map((family) => `${family.label} (${family.signals} signals)`).join(", ")}.`,
        "Every hypothesis the mapping introduces is listed in the inspector, including the ones the adjudications did not settle.",
      ],
      evidence: [
        evidence("lib/layer1_backtesting/package_identity.js", "the independent mapping review and its hypotheses", dates.report),
        evidence("data/usd-layer1-backtester/run-v1.json", "requirement_table: one row per adjudication with its fields and source", dates.run),
      ],
      links: ["factor_combination"],
    },
    {
      id: "factor_combination",
      label: "Factor combination",
      kind: "stage",
      status: "verified_with_gap",
      summary: "Six families, twelve voting signals, one vote per morning, capped and deadbanded.",
      detail: [
        "A family votes as the arithmetic mean of its usable signals, capped to [-1, +1]; the net score is the sum of usable family votes.",
        "A direction exists only outside the frozen 0.20 deadband; an exact net zero is NO_CALL.",
        "The trade floor is band 3 with all twelve signals usable and a readable event family; it is provisional.",
      ],
      evidence: [
        evidence("lib/layer1_backtesting/models.js", "the candidate declaration and its six checks", dates.report),
        evidence("config/usd_l1_decision_rules_v1.json", "direction, bands, eligibility and trade rule", dates.frozen),
      ],
      links: ["datasets"],
    },
    {
      id: "datasets",
      label: "Required datasets",
      kind: "stage",
      status: "partial",
      summary: biggest
        ? `Biggest gap: ${biggest.field}, absent on ${biggest.affected.count} of ${run.sessions.length} mornings.`
        : "No requirement table is present.",
      detail: [
        "The requirement table names 25 adjudications, their fields, their sources and what to obtain when a field is absent.",
        "The saved as-of frame carries nine inputs; the rest of the required set is absent from the archive.",
        "No morning carries a 05:00 receipt or a named instrument, so the strict gate never opens.",
      ],
      evidence: [
        evidence("data/usd-layer1-backtester/run-v1.json", "requirement_table, validity gate and per-session missing inputs", dates.run),
        evidence("lib/layer1_backtesting/readiness.js", "the four-rung ladder and the per-morning gap explanation", dates.report),
      ],
      links: ["supabase", "n8n"],
    },
    {
      id: "supabase",
      label: "Supabase connection",
      kind: "connection",
      status: "unverified",
      summary: "Schema and migrations exist; no dated read or write from this checkout is evidenced.",
      detail: [
        "docs/ARCHITECTURE.md names the market_snapshots and agent_outputs tables; supabase/migrations carries the schema.",
        "No snapshot read, write or row count from the hosted project is recorded in this checkout, so the connection is unverified here.",
        "To verify it, record one dated read and one dated write against the named tables, with the project reference and the row count.",
      ],
      evidence: [
        evidence("docs/ARCHITECTURE.md", "table references only; not a connection record", null),
        evidence("supabase/migrations/20260912_silver_market_snapshots.sql", "schema migration dated by filename; not a connection record", "2026-09-12"),
      ],
      links: ["validation"],
    },
    {
      id: "n8n",
      label: "n8n connection",
      kind: "connection",
      status: "unverified",
      summary: "The workflow export exists; activation and the first scheduled receipt are not evidenced.",
      detail: [
        "exports/master_orchestrator.json is present as an export, not as a run record.",
        "No activation timestamp, hosted URL or first scheduled receipt is recorded in this checkout.",
        "To verify it, record one dated scheduled execution and the receipt it produced, with the workflow id and the execution id.",
      ],
      evidence: [
        evidence("exports/master_orchestrator.json", "workflow export only; not an execution record", null),
      ],
      links: ["validation"],
    },
    {
      id: "validation",
      label: "Validation",
      kind: "stage",
      status: "verified_with_gap",
      summary: "The engine and report reproduce; H1 fixtures pass and its historical tests are blocked on coverage.",
      detail: [
        "The report and the screen are rebuilt from stored artefacts and checked byte for byte, so a figure cannot drift from its source.",
        "The legacy run audit catches a missing required input, a trade flag on a blocked morning and a wrong model version.",
        "The H1 audit catches the same three failures plus a test row that names another morning's saved decision.",
        "The H1 package's own verify.js passes, but no H1 morning is eligible, so the four tests remain unscored.",
      ],
      evidence: [
        evidence("lib/layer1_backtesting/ledger.js", "the independent run audit", dates.report),
        evidence("docs/research/usd-session/v1/layer1_backtest_report.md", "the committed evidence report", dates.report),
      ],
      links: ["test_dxy_broker", "test_four_markets", "test_l2l_5r", "test_l2l_3r", "test_dxy_official_series"],
    },
    {
      id: "test_dxy_broker",
      label: "Test 1 · broker DXY.cash",
      kind: "test",
      status: "scored_legacy",
      test_id: "dxy_direction_broker_cfd",
      summary: (tests.tests.find((test) => test.id === "dxy_direction_broker_cfd") || {}).status || "scored on a proxy",
      detail: [
        "The agreed test 1. Scored on one-hour broker candles, not the official index, and labelled as a proxy everywhere it appears.",
        "The candidate denominator is the legacy reconstructed call set; it is not the 121 gated calls.",
        "Flat windows are excluded from the accuracy denominator and counted separately.",
      ],
      evidence: [evidence("data/usd-layer1-backtester/run-v1.json", "tests.dxy_direction_broker_cfd", dates.run)],
      links: [],
    },
    {
      id: "test_four_markets",
      label: "Test 2 · four markets",
      kind: "test",
      status: "scored_legacy",
      test_id: "four_markets",
      summary: (tests.tests.find((test) => test.id === "four_markets") || {}).status || "scored market by market",
      detail: [
        "The agreed test 2: USD-only, one model call against EUR/USD, XAU/USD, BTC/USD and NAS100.",
        "Each market keeps its own denominator; no cross-market aggregate is published.",
        "Combining two independent Layer 1 calls remains a separately defined future test (OD-1).",
      ],
      evidence: [evidence("data/usd-layer1-backtester/run-v1.json", "tests.four_markets", dates.run)],
      links: [],
    },
    {
      id: "test_l2l_5r",
      label: "Test 3 · original levels, 5R",
      kind: "test",
      status: "blocked",
      test_id: "l2l_full_5r",
      summary: (tests.tests.find((test) => test.id === "l2l_full_5r") || {}).status || "blocked on history",
      detail: [
        "The agreed test 3: the original Layer 2 levels with the frozen 5R rules.",
        "No 5-minute tape and no level ladder exist for these dates, so nothing is estimated in place of a tape.",
        "The only evidence is a two-day worked demonstration, which is not a measured result.",
      ],
      evidence: [evidence("data/usd-layer1-backtester/run-v1.json", "tests.l2l_full_5r", dates.run)],
      links: [],
    },
    {
      id: "test_l2l_3r",
      label: "Test 4 · levels plus midpoints, 3R",
      kind: "test",
      status: "blocked",
      test_id: "l2l_half_3r",
      summary: (tests.tests.find((test) => test.id === "l2l_half_3r") || {}).status || "blocked on history",
      detail: [
        "The agreed test 4: original levels plus midpoints with the separately frozen 3R rules.",
        "It needs the same tape and ladder evidence as test 3 plus the midpoint geometry.",
        "It is not a sensitivity check on test 3; it is its own frozen rule.",
      ],
      evidence: [evidence("data/usd-layer1-backtester/run-v1.json", "tests.l2l_half_3r", dates.run)],
      links: [],
    },
    {
      id: "test_dxy_official_series",
      label: "Supplementary · official ICE DXY",
      kind: "test",
      status: "blocked",
      test_id: "dxy_direction",
      summary:
        (tests.supplementary.find((test) => test.id === "dxy_direction") || {}).status || "blocked: no licensed series",
      detail: [
        "Registered outside the agreed four. The official series is not in this checkout.",
        "No proxy is substituted under this test; the broker proxy is test 1, with its own label.",
      ],
      evidence: [evidence("data/usd-layer1-backtester/run-v1.json", "tests.dxy_direction", dates.run)],
      links: [],
    },
  ];

  return {
    nodes,
    edges: nodes.flatMap((node) => node.links.map((target) => [node.id, target])),
    candidate_trace: candidateTrace || null,
  };
}

function buildLedger({ decisions, models, sessions, tests }) {
  const ledger = createLedger();
  for (const record of decisions.records) saveDecision(ledger, record);
  const sessionsByDate = new Map(sessions.map((session) => [session.date, session]));
  const referenceSummary = {};
  for (const test of tests.tests) {
    referenceSummary[test.id] = {};
    for (const role of ["control", "candidate"]) {
      const model = role === "control" ? models.control : models.candidate;
      const refs = referenceDecisions(ledger, { testId: test.id, modelId: model.id, dates: sessions.map((session) => session.date) });
      // A test re-references the stored record; it never writes a second one. Counting the reference as a
      // duplicate save is how the screen proves the save-once rule.
      for (const row of refs.rows) {
        const stored = ledger.entries.get(row.decision_id);
        if (stored) saveDecision(ledger, stored);
      }
      referenceSummary[test.id][role] = {
        total: refs.rows.length,
        missing: refs.missing.length,
        sample: refs.rows.slice(0, 3).concat(refs.rows.slice(-2)),
      };
    }
  }
  const sampleRecord = decisions.records.find((record) => record.model.role === "candidate" && record.outcome === "abstained") || decisions.records[0];
  return {
    entries: ledger.entries.size,
    saves: ledger.saves,
    duplicates: ledger.duplicates,
    conflicts: ledger.conflicts,
    rule: "one decision per model per morning; the first save is immutable; a second identical save is a reference, a disagreeing save is rejected",
    sample: sampleRecord
      ? {
          decision_id: decisionId(sampleRecord),
          date: sampleRecord.date,
          model: sampleRecord.model,
          outcome: sampleRecord.outcome,
          direction: sampleRecord.direction,
          band: sampleRecord.band,
          trade_eligible: sampleRecord.trade_eligible,
          snapshot_sha256: sampleRecord.snapshot_sha256,
        }
      : null,
    references: referenceSummary,
    sessions_by_date: sessionsByDate.size,
  };
}

/**
 * Artefact integrity: the gated records must never let a blocked morning contribute a direction,
 * a trade or a scored outcome. The legacy engine-v1 contradictions are preserved, not repaired in
 * place, and are displayed beside the gated zeroes under their own label.
 */
function buildIntegrity({ decisions, engine, h1 }) {
  const gated = decisions.records.filter((record) => record.model.role === "candidate");
  const gatedBlocked = gated.filter((record) => record.outcome === "blocked");
  const gatedWithDirection = gatedBlocked.filter((record) => record.direction && record.direction !== "NO_CALL");
  const gatedWithTrade = gatedBlocked.filter((record) => record.trade_eligible === true);
  const legacyStates = engine.morning_states || [];
  const legacyBlocked = legacyStates.filter((morning) =>
    ["E1", "E2", "E3", "E4"].some((check) => morning.checks && morning.checks[check] === false)
  );
  const legacyWithDirection = legacyBlocked.filter((morning) => morning.direction && morning.direction !== "NO_CALL");
  const legacyWithTrade = legacyBlocked.filter((morning) => morning.trade === true);
  return {
    gated: {
      model_id: "usd_candidate_25f_v1",
      source: "the immutable decision records rendered by this screen",
      records: gated.length,
      blocked: gatedBlocked.length,
      blocked_with_direction: gatedWithDirection.length,
      blocked_with_trade: gatedWithTrade.length,
      blocked_scored: 0,
      note: "A blocked gated record carries NO_CALL, band null, trade_eligible false and no scored outcome.",
    },
    legacy: {
      model_id: "usd_candidate_25f_v1",
      source: "data/usd-layer1-backtester/engine-v1.json -> morning_states[]",
      blocked: legacyBlocked.length,
      blocked_with_direction: legacyWithDirection.length,
      blocked_with_trade: legacyWithTrade.length,
      sample_dates: {
        direction: legacyWithDirection.slice(0, 5).map((morning) => morning.date),
        trade: legacyWithTrade.slice(0, 5).map((morning) => morning.date),
      },
      preserved: true,
      note: "These contradictory legacy records are preserved byte for byte as labelled audit evidence. They are not gated decisions and are never counted as directions, trades or scored outcomes.",
    },
    h1: h1
      ? {
          model_id: h1.model.id,
          model_version: h1.model.version,
          scheduled: h1.coverage.scheduled,
          ready: h1.coverage.ready,
          blocked: h1.coverage.blocked,
          directional: 0,
          trades: 0,
          scored: 0,
          note: "H1 is unscored. A blocked H1 morning has no direction, trade or outcome; coverage is not performance.",
        }
      : null,
    assertion:
      "Gated blocked mornings contribute zero directions, zero trades and zero scored outcomes. The 75 directions and 21 trade flags in engine-v1 remain visible only as legacy audit evidence.",
  };
}

function buildAudit({ decisions, models, sessions, requiredFields, engine }) {
  const sessionsByDate = new Map(sessions.map((session) => [session.date, session]));
  const candidateRecords = decisions.records.filter((record) => record.model.role === "candidate");

  // 1. A published morning that claims a trade while its own outcome is blocked, against the required-input set.
  const published = (engine.morning_states || []).find((morning) => morning.trade === true && morning.outcome !== "allowed");
  let missingInput = null;
  if (published) {
    const session = sessionsByDate.get(published.date);
    const pseudo = {
      decision_id: `${models.candidate.id}@${published.date}`,
      date: published.date,
      model: {
        id: models.candidate.id,
        label: models.candidate.label,
        role: models.candidate.role,
        version: models.candidate.version,
        rulebook_version: models.candidate.rulebook_version,
      },
      outcome: published.outcome,
      direction: published.direction,
      band: published.band,
      trade_eligible: published.trade,
      snapshot_sha256: session ? snapshotHash(sessionView(session)) : null,
    };
    const result = auditRecord({ record: pseudo, model: models.candidate, session: sessionView(session), requiredFields });
    missingInput = {
      caught: result.findings.some((finding) => finding.code === "missing_required_input"),
      date: published.date,
      source: "data/usd-layer1-backtester/engine-v1.json -> morning_states[]",
      findings: result.findings,
      decision_id: pseudo.decision_id,
      explain:
        "The published morning carries a trade flag on a blocked morning, and the snapshot is missing a field the mapped rule needs. The audit reports both; neither is a valid decision.",
    };
  }

  // 2. A stored record whose model version has been altered.
  const original = candidateRecords.find((record) => record.outcome === "abstained") || candidateRecords[0];
  let wrongVersion = null;
  if (original) {
    const tampered = { ...original, model: { ...original.model, version: `${original.model.version}-tampered` } };
    const result = auditRecord({ record: tampered, model: models.candidate, session: sessionView(sessionsByDate.get(original.date)), requiredFields });
    let ledgerRejected = false;
    try {
      const ledger = createLedger();
      saveDecision(ledger, original);
      saveDecision(ledger, tampered);
    } catch {
      ledgerRejected = true;
    }
    wrongVersion = {
      caught: result.findings.some((finding) => finding.code === "model_version_mismatch"),
      date: original.date,
      expected: models.candidate.version,
      found: tampered.model.version,
      findings: result.findings,
      decision_id: decisionId(original),
      ledger_rejected: ledgerRejected,
      explain:
        "The audit compares the record's version stamp with the registered model. The ledger also refuses to store the altered record under the original decision id.",
    };
  }

  // 3. A record that passes, so the audit is shown not to fail everything.
  const cleanSource = candidateRecords.find((record) => record.outcome === "blocked");
  const clean = cleanSource
    ? auditRecord({ record: cleanSource, model: models.candidate, session: sessionView(sessionsByDate.get(cleanSource.date)), requiredFields })
    : null;

  return {
    missing_input: missingInput,
    wrong_version: wrongVersion,
    clean: clean ? { decision_id: clean.decision_id, date: clean.date, findings: clean.findings, clean: clean.clean } : null,
    required_fields: requiredFields,
    note:
      "The audit is independent of the engine: it re-reads the stored record, the snapshot hash, the registration and the required-input set.",
  };
}

function buildControlParity({ run }) {
  const coverage = (run.coverage && run.coverage.by_model && run.coverage.by_model.current) || {};
  const missing = coverage.inputs_missing_histogram || {};
  const sessions = coverage.sessions_eligible || (run.sessions || []).length;
  const factor = (id, name, input, mapping, weight, finding, status) => ({
    id,
    factor: name,
    input,
    mapping,
    mornings_with_value: missing[input] === undefined ? null : sessions - missing[input],
    sessions,
    weight,
    finding,
    status,
  });
  return {
    verdict: "NOT_ESTABLISHED",
    claim: "No production parity is claimed for the control: three of the four checked mappings are absent from the saved archive on most mornings, and the fourth uses a broad-index stand-in.",
    factors: [
      factor(
        "F3",
        "US-DE 2Y spread delta",
        "us_de_2y_spread_d5_bps",
        "a single stored spread delta scored against a fixed +/-5 bps band",
        { coded_24h: 10, rulebook: 16 },
        "The input is absent on 714 of 725 mornings, so the rule cannot vote; the German leg is the missing series, not a model judgement.",
        "blocked_input"
      ),
      factor(
        "F5",
        "DXY delta",
        "dxy_d1",
        "selects dxy_d1/dxy_d5/dxy_d20 and scores +/-0.15 per cent on 24h, +/-0.30 per cent elsewhere",
        { coded_24h: 14, rulebook: 6 },
        "The series is FRED DTWEXBGS, a broad trade-weighted index stand-in, not the official ICE cash DXY; the two weight vectors disagree.",
        "proxy_instrument"
      ),
      factor(
        "F7",
        "US economic surprise",
        "latest_us_event",
        "reads the stored event string's surprise field ('positive'/'negative') when its age is at most 72 hours",
        { coded_24h: 24, rulebook: 3 },
        "The event string is taken unexamined and is absent on 714 of 725 mornings; no surprise score is computed or validated.",
        "blocked_input"
      ),
      factor(
        "F8",
        "Fed bias",
        "fed_bias",
        "a hawkish string scores BULLISH, a dovish string BEARISH, and a neutral string is counted as missing",
        { coded_24h: 12, rulebook: 18 },
        "Neutral is a valid observation but the code removes F8 from the vote instead of voting neutral; the input is absent on 714 of 725 mornings.",
        "mapping_defect"
      ),
    ],
    evidence: [
      { path: "backtester/replay/usd/usd_replay_core.js", field: "factorSignal: F3, F5, F7, F8 blocks" },
      { path: "data/usd-layer1-backtester/run-v1.json", field: "coverage.by_model.current.inputs_missing_histogram" },
      { path: "docs/dashboard-design/usd-factor-sets.md", field: "the two weight vectors and the DTWEXBGS stand-in" },
      { path: "docs/research/usd-session/v1/weight_vector_discrepancy.md", field: "every coded-versus-rulebook weight disagreement" },
    ],
  };
}

function buildScreen(context) {
  const { report, run, engine, models, decisions, readiness, tests, generatedAt, flatBands, packageInfo, mapping, h1, morningRun, root, marketMatrix = null } = context;
  const sessions = run.sessions || [];
  const requirementTable = (run.validity_gate && run.validity_gate.requirement_table) || [];
  const gaps = buildGaps({ run, requirementTable });
  const allDates = sessions.map((session) => session.date);
  for (const [field, source, action] of [
    ["ICE_cash_dxy_official_close", "ICE US Dollar Index, cash, official close, USDX", "license the cash history with a 05:00 and next-05:00 London print"],
    ["five_minute_tape", "5-minute bid/ask tape per market", "archive the tape before the setup; nothing is estimated in place of a tape"],
    ["level_ladder", "archived layer-2 level grid", "archive the level ladder before the setup"],
  ]) {
    gaps[field] = {
      field,
      affected: { ...span(allDates), dates: allDates },
      factors: [],
      sources: [source],
      action,
      candidate: null,
      freshness_business_days: null,
      scope: "required by the test definition",
      evidence_requirement: "the artefact must exist at or before 05:00 Europe/London and be dated; a reconstruction after the fact is not evidence",
    };
  }
  const biggest = biggestGap(gaps, requirementTable);
  const fields = requiredFieldsOf(requirementTable);
  const coverageTrace = buildCoverageTrace({ run, decisions, readiness, tests });
  const testSection = buildTestSection({ run, decisions, tests, gaps, h1 });
  // Each of the agreed four tests carries its own H1 readiness, so a legacy score is never read as H1 evidence.
  if (h1) {
    for (const definition of [...testSection.definitions, ...testSection.supplementary]) {
      definition.h1_readiness = {
        model_id: h1.model.id,
        model_version: h1.model.version,
        eligible_mornings: h1.coverage.ready,
        scheduled_mornings: h1.coverage.scheduled,
        earliest_eligible: h1.coverage.earliest_eligible,
        status: h1.coverage.ready > 0 ? "ready" : "blocked on the H1.1 evidence contract",
        blocked_by: h1.coverage.gaps.map((gap) => gap.input),
      };
    }
  }
  const architecture = buildArchitecture({ root, run, engine, tests, coverageTrace, mapping, packageInfo, biggest, generatedAt, h1 });
  const ledger = buildLedger({ decisions, models, sessions, tests });
  const audit = buildAudit({ decisions, models, sessions, requiredFields: fields.required, engine });
  const integrity = buildIntegrity({ decisions, engine, h1 });
  const summary = summaryOf({ models, decisions, readiness, sessions, coverageTrace, biggest, gaps, packageInfo, run, h1 });
  return {
    schema_version: SCHEMA_VERSION,
    research_only: true,
    generated_at: generatedAt || null,
    title: "Backtesting · 05:00 London USD call",
    subtitle:
      "One engine, two legacy models and the supplied H1 candidate. Every figure is built from a stored artefact; H1 historical coverage is measured against its own nine-input contract.",
    summary,
    models: report.models,
    h1: h1 || null,
    morning_run: morningRun || null,
    architecture,
    tests: { ...testSection, gaps },
    ledger,
    audit,
    integrity,
    model_identity: {
      control: {
        id: models.control.id,
        label: models.control.label,
        status: ((decisions.by_model || {}).control || {}).identity ? decisions.by_model.control.identity.status : null,
      },
      legacy_candidate: {
        id: models.candidate.id,
        label: models.candidate.label,
        status: ((decisions.by_model || {}).candidate || {}).identity ? decisions.by_model.candidate.identity.status : null,
      },
      h1: h1
        ? {
            id: h1.model.id,
            label: h1.model.label,
            version: h1.model.version,
            status: h1.model.identity ? h1.model.identity.status : null,
            scored: false,
          }
        : null,
      statement:
        "CONFIG_BLOCKED applies to usd_candidate_25f_v1 only: the intended 25-factor agent has no adjudicated sign, weight or threshold, so its rule is undefined. USD-L1-25F-H1-v0.1.0 is a separate frozen hypothesis, not CONFIG_BLOCKED, and it is unscored. Test 1 is scored on the broker DXY.cash series; official ICE is a separate evaluation lane.",
    },
    coverage_trace: coverageTrace,
    flat_bands: flatBands,
    market_matrix: marketMatrix,
    package_identity: packageInfo,
    mapping_review: mapping,
    decisions: ownerDecisions({ coverageTrace, flatBands }),
    legend: {
      blocked: "a data gap: a required input, an instrument or a receipt was not in hand at 05:00",
      valid_abstention: "the book had the evidence and chose not to call: every blocking check passed and no trade is implied",
      no_call: "the book was eligible but the vote sat inside the deadband or netted exactly zero",
      allowed: "the implemented book produced a direction; it is not a valid call for the intended H1 package",
      scored: "the morning's outcome is stored and entered a denominator",
      scored_in_legacy_aggregate: "scored in the published aggregate on a reconstructed call, not in the gated sample",
      not_in_legacy_sample: "the engine allows the morning but the published reconstructed call set does not contain it",
      unmapped: "no decision record exists for the morning",
    },
  };
}

module.exports = { SCHEMA_VERSION, buildScreen, statusOf, requiredFieldsOf, buildGaps, buildControlParity };

function summaryOf({ models, decisions, readiness, sessions, coverageTrace, biggest, gaps, packageInfo, run, h1 }) {
  const candidate = decisions.by_model.candidate;
  return {
    selected_models: [models.control, models.candidate].map((model) => ({
      id: model.id,
      label: model.label,
      role: model.role,
      version: model.version,
      rulebook_version: model.rulebook_version,
      identity: (decisions.by_model[model.role] || {}).identity || null,
      gate_basis: model.gate.basis || null,
      evidence: model.evidence || [],
      executable_entry_points:
        model.role === "control"
          ? [
              "lib/layer1_backtesting/engine.js#decide",
              "lib/layer1_backtesting/models.js#createModels().control",
              "backtester/replay/usd/usd_replay_core.js#buildReplayOutput",
            ]
          : [
              "lib/layer1_backtesting/engine.js#decide",
              "lib/layer1_backtesting/models.js#createModels().candidate",
              "config/usd_l1_decision_rules_v1.json",
            ],
    })),
    session: "05:00 Europe/London to 05:00 the next local day (24 hours, DST following)",
    first_date: sessions.length ? sessions[0].date : null,
    last_date: sessions.length ? sessions[sessions.length - 1].date : null,
    sessions: sessions.length,
    readiness: {
      headline_gate: "strict evidence gate: present + fresh + clocked + identified",
      strict_ready_control: coverageTrace.by_model.control.valid_strict,
      strict_ready_candidate: coverageTrace.by_model.candidate.valid_strict,
      narrow_ready_control: readiness.by_model.control.ready,
      narrow_blocked_control: readiness.by_model.control.blocked,
      book_allowed_candidate: candidate.allowed,
      book_abstained_candidate: candidate.abstained,
      book_blocked_candidate: candidate.blocked,
      note: "The strict headline is 0 of 725 for the production control and the legacy book. The control's narrow gate accepts 617 mornings; that is shown as a labelled comparison, not as readiness. H1 has its own nine-input coverage count and is not included here.",
    },
    biggest_gap: biggest
      ? {
          field: biggest.field,
          mornings: biggest.affected.count,
          sessions: sessions.length,
          share_pct: pct(biggest.affected.count, sessions.length),
          first: biggest.affected.first,
          last: biggest.affected.last,
          sources: biggest.sources,
          candidate_action: biggest.candidate,
          action: biggest.action,
          factors: biggest.factors,
        }
      : null,
    next_to_obtain: nextToObtain({ biggest, gaps, readiness, packageInfo, run }),
    package_identity: packageInfo,
    parity: buildControlParity({ run }),
    h1: h1
      ? {
          model_id: h1.model.id,
          model_version: h1.model.version,
          label: h1.coverage.label,
          scheduled: h1.coverage.scheduled,
          ready: h1.coverage.ready,
          blocked: h1.coverage.blocked,
          sealed_ready: h1.coverage.sealed_ready,
          sealed_blocked: h1.coverage.sealed_blocked,
          evidence_policy: h1.coverage.evidence_policy,
          earliest_eligible: h1.coverage.earliest_eligible,
          fixture_status: h1.fixtures.status,
          fixture_label: h1.fixtures.label,
          legacy_replacement: h1.coverage.legacy_replacement,
          binding: h1.coverage.binding,
          package: {
            requested: h1.package.requested,
            status: h1.package.status,
            commit: h1.package.package.commit,
            sums: `${h1.package.internal_checksums.verified}/${h1.package.internal_checksums.declared}`,
            acceptance: h1.package.acceptance.status,
          },
          review: {
            adjudications: h1.review.summary.adjudications,
            votes: h1.review.summary.votes,
            votes_by_family: h1.review.summary.votes_by_family_series,
            gate_inputs: h1.review.summary.gate_inputs,
            required_not_voting: h1.review.summary.required_not_voting_rows,
            excluded: h1.review.summary.no_declared_input,
            discrepancies: h1.review.summary.discrepancy_count,
            open: h1.review.discrepancies.filter((item) => item.status === "recorded_not_applied").length,
            accounting_pass: h1.review.accounting.all_pass,
            arithmetic_matched: `${h1.review.arithmetic.matched}/${h1.review.arithmetic.tokens}`,
          },
          audit: {
            reconciled: h1.audit.reconciliation.reconciled,
            missing_input_caught: h1.audit.missing_input ? h1.audit.missing_input.caught : false,
            wrong_version_caught: h1.audit.wrong_version ? h1.audit.wrong_version.caught : false,
            wrong_saved_decision_caught: h1.audit.wrong_saved_decision ? h1.audit.wrong_saved_decision.clean === false : false,
            saved_decisions: h1.historical.ledger.entries,
          },
          scoring_contract: {
            status: h1.scoring_contract.status,
            frozen_on: h1.scoring_contract.frozen_on,
            digest: h1.scoring_contract.digest,
            directional_target_pct: h1.scoring_contract.success_measures.directional_target_pct,
          },
        }
      : null,
  };
}




