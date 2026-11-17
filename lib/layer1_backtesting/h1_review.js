/**
 * The independent review of how USD-L1-25F-H1-v0.1.0 accounts for its 25 adjudications.
 *
 * The package ships 25 adjudicated rows, nine declared inputs and one executable rule. This file states, row
 * by row, what the executable does with that row: votes, gates, supplies a required-but-silent operand, or is
 * deliberately excluded. It keeps the shared-evidence treatment visible — several rows read one input, so the
 * number of rows is not the number of votes — and it records every assumption and discrepancy before the
 * candidate is accepted.
 *
 * Nothing here changes the candidate. A discrepancy that would need a different rule is proposed as a versioned
 * change and left unapplied, because the package is frozen and its fixtures were recorded against it. Research
 * only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ID = "h1_adjudication_review";
const VERSION = "1.0.0";
const REVIEWED = "2026-11-17";
const REVIEWER = "VSC, independent of the package author";

/** Every executable token the review claims to have found, checked against the supplied models.js. */
const ARITHMETIC_TOKENS = [
  ["front:vote(v.front,5)", "front vote computed at 5 bp and excluded from every family"],
  ["spread:vote(v.spread,5)", "spread vote at 5 bp"],
  ["real:vote(v.real,5)", "real-yield vote at 5 bp"],
  ["broad:vote(v.broad,0.3)", "broad dollar vote at 0.30 per cent"],
  ["ice:vote(v.ice,0.15)", "ICE session vote at 0.15 per cent"],
  ["gold:-vote(v.gold,1)", "gold vote at 1 per cent, sign inverted"],
  ["qqq:-vote(v.qqq,1)", "QQQ vote at 1 per cent, sign inverted"],
  ["rates:mean([votes.spread,votes.real])", "rates family averages two votes"],
  ["momentum:mean([votes.broad,votes.ice])", "USD momentum family averages two votes"],
  ["crossMarket:mean([votes.gold,votes.qqq])", "cross-market family averages two votes"],
  ["frontCounted:false", "the front-end vote is reported and not counted"],
  ["abstain = v.vix >= 30 || magnitude < 0.20", "the two abstention conditions"],
  ["band >= 3 && v.calendar === 0", "the trade condition"],
];

/**
 * One treatment per adjudicated row, keyed by the supplied row id. The text is the review's finding, not a
 * restatement of the row's own verdict.
 */
const TREATMENTS = {
  "live.f1-vix-level": {
    treatment: "Regime gate only",
    effect: "the level abstains at or above 30 and never votes on direction",
    vote: "none",
    family: null,
    assumption:
      "Three rows read VIX and none may vote, so a single market signal cannot be outvoted by duplicated volatility evidence.",
    discrepancies: [],
  },
  "risk.vix-level-and-change-at-cutoff": {
    treatment: "Shared F1: level only",
    effect: "consolidated onto the same VIX level as live.f1; no second reading and no second vote",
    vote: "none",
    family: null,
    assumption: "The row is treated as a duplicate of the regime gate rather than as an independent signal.",
    discrepancies: ["H1R-02"],
  },
  "live.f2-us-2y-delta": {
    treatment: "Required operand, never a vote",
    effect: "the five-interval DGS2 change must be present and fresh, but it is excluded from every family",
    vote: "required_not_voting",
    family: null,
    assumption:
      "The row says DGS2 is counted inside F19. Requiring the raw change as well makes the evidence gate stricter than the vote set without changing a call.",
    discrepancies: ["H1R-01"],
  },
  "live.f3-us-de-2y-spread-delta": {
    treatment: "Rates vote, shared with rates.relative-front-end-delta",
    effect: "one vote from the US minus Germany 2Y spread at a 5 bp threshold",
    vote: "shared",
    family: "rates",
    assumption: "Two adjudications of the same relative policy channel cast one vote, not two.",
    discrepancies: ["H1R-08"],
  },
  "live.f4-real-yield-delta": {
    treatment: "Rates vote, shared with rates.real-yield-delta",
    effect: "one vote from the DFII10 five-interval change at 5 bp",
    vote: "shared",
    family: "rates",
    assumption: "Two adjudications of the real-rate channel cast one vote.",
    discrepancies: ["H1R-08"],
  },
  "rates.us-front-end-delta": {
    treatment: "Shared F2: no independent vote",
    effect: "the front-end innovation is read only through DGS2 inside the spread",
    vote: "required_not_voting",
    family: null,
    assumption: "The standalone front-end change cannot vote even though its input is required.",
    discrepancies: ["H1R-01"],
  },
  "rates.relative-front-end-delta": {
    treatment: "The rates vote named in rule 3",
    effect: "reads the same spread series as live.f3 and adds no second vote",
    vote: "shared",
    family: "rates",
    assumption: "This row and live.f3 are one vote.",
    discrepancies: ["H1R-08"],
  },
  "rates.real-yield-delta": {
    treatment: "The real-yield vote named in rule 3",
    effect: "reads the same DFII10 series as live.f4 and adds no second vote",
    vote: "shared",
    family: "rates",
    assumption: "This row and live.f4 are one vote.",
    discrepancies: ["H1R-08"],
  },
  "rates.term-premium-and-curve": {
    treatment: "Excluded: no feed",
    effect: "no input, no vote, no gate",
    vote: "none",
    family: null,
    assumption: "The exclusion is deliberate and recorded in the rulebook, not an omission discovered here.",
    discrepancies: [],
  },
  "rates.credit-spread-delta": {
    treatment: "Excluded: no feed",
    effect: "no input, no vote, no gate",
    vote: "none",
    family: null,
    assumption: "The exclusion is deliberate.",
    discrepancies: [],
  },
  "live.f5-dxy-delta": {
    treatment: "USD momentum vote",
    effect: "five-interval DTWEXBGS return at a 0.30 per cent threshold",
    vote: "one",
    family: "momentum",
    assumption: "The broad trade-weighted dollar stands in for dollar momentum; the official ICE series is the separate ICE vote.",
    discrepancies: [],
  },
  "live.f6-gold-delta": {
    treatment: "Cross-market vote",
    effect: "five PM fixings of LBMA Gold Price PM USD at 1 per cent, sign inverted",
    vote: "one",
    family: "cross_market",
    assumption: "A stronger gold price is read as dollar weakness, a mechanism the row's verdict calls unmeasured.",
    discrepancies: [],
  },
  "live.f9-dollar-smile": {
    treatment: "Excluded: context only",
    effect: "no input and no executable context field",
    vote: "none",
    family: null,
    assumption: "Context that is not executable is not counted as implemented.",
    discrepancies: [],
  },
  "live.f10-equity-versus-usd": {
    treatment: "Cross-market vote",
    effect: "five official QQQ closes at 1 per cent, sign inverted",
    vote: "one",
    family: "cross_market",
    assumption: "The QQQ ETF close is the declared instrument; the Nasdaq-100 index is not a substitute.",
    discrepancies: [],
  },
  "live.f7-economic-surprise": {
    treatment: "Excluded from the score and the gates",
    effect: "no input and no surprise score",
    vote: "none",
    family: null,
    assumption: "No fallback surprise measure is invented.",
    discrepancies: [],
  },
  "live.f8-fed-bias": {
    treatment: "Excluded",
    effect: "no input; its absence imposes no requirement, as rule 5 states",
    vote: "none",
    family: null,
    assumption: "The exclusion changes the model relative to the original specification and cannot change its audit.",
    discrepancies: [],
  },
  "macro.release-surprise-at-first-print": {
    treatment: "Excluded from the score and the gates",
    effect: "no input",
    vote: "none",
    family: null,
    assumption: "The first-print vintage is not approximated by a revised series.",
    discrepancies: [],
  },
  "fx.usd-session-momentum": {
    treatment: "USD momentum vote",
    effect: "previous eligible 05:00 fixing to the current one at 0.15 per cent",
    vote: "one",
    family: "momentum",
    assumption: "The row is the only input whose maximum age is zero hours.",
    discrepancies: ["H1R-03"],
  },
  "fx.usd-overnight-range-position": {
    treatment: "Excluded",
    effect: "no input",
    vote: "none",
    family: null,
    assumption: "A state that the row's verdict rejects as a hard bound is not implemented.",
    discrepancies: [],
  },
  "fx.usd-session-volatility-regime": {
    treatment: "Excluded",
    effect: "no input",
    vote: "none",
    family: null,
    assumption: "Dispersion evidence is not treated as a no-call rule.",
    discrepancies: [],
  },
  "risk.usd-safe-haven-demand": {
    treatment: "Excluded",
    effect: "no input",
    vote: "none",
    family: null,
    assumption: "No universal sign is assumed.",
    discrepancies: [],
  },
  "risk.risk-on-off-cross-asset-state": {
    treatment: "Shared F1: level only",
    effect: "reads the same VIX level as the regime gate; no second vote",
    vote: "none",
    family: null,
    assumption: "Cross-asset risk state is represented by VIX alone.",
    discrepancies: ["H1R-02"],
  },
  "calendar.known-releases-between-cutoff-and-endpoint": {
    treatment: "Event gate",
    effect: "a missing calendar blocks; a verified non-empty count suppresses trade but not the direction",
    vote: "gate",
    family: null,
    assumption: "A zero count is only meaningful once all five release families are archived.",
    discrepancies: ["H1R-04"],
  },
  "calendar.days-since-and-until-high-impact-events": {
    treatment: "Shared F23: no executable feature",
    effect: "the count in the window does not encode distance to an event",
    vote: "none",
    family: null,
    assumption: "Distance is declared but not implemented; the row's input is required only through the count.",
    discrepancies: ["H1R-04"],
  },
  "data.quality-gate-for-abstention": {
    treatment: "Integrity gate",
    effect: "the nine-row admission check is the integrity gate; an invalid or missing row blocks",
    vote: "gate",
    family: null,
    assumption: "There is no prespecified fallback, which matches rule 1's 'No fallback'.",
    discrepancies: [],
  },
};

const DISCREPANCIES = [
  {
    id: "H1R-01",
    code: "required_input_cannot_vote",
    severity: "assumption",
    rows: ["live.f2-us-2y-delta", "rates.us-front-end-delta"],
    finding:
      "The DGS2 five-interval change is required by the evidence gate and excluded from every family. A morning can be blocked by an input that cannot change the call.",
    consequence: "Coverage is stricter than the vote set: eight of the nine inputs can block and only six can vote.",
    status: "recorded_not_applied",
    proposed_change: "v0.1.1: state the requirement as an operand of the spread rather than a ninth standalone gate.",
  },
  {
    id: "H1R-02",
    code: "adjudication_partly_unimplemented",
    severity: "gap",
    rows: ["risk.vix-level-and-change-at-cutoff", "risk.risk-on-off-cross-asset-state"],
    finding:
      "The row names VIX level and change at the cutoff. The executable reads the level only; no VIX change is among the nine inputs.",
    consequence: "The regime gate cannot react to a VIX move, only to its level.",
    status: "recorded_not_applied",
    proposed_change: "v0.1.1: add a VIX one-day change to the gate, or retitle the row as level-only.",
  },
  {
    id: "H1R-03",
    code: "zero_age_contradicts_receipt",
    severity: "defect",
    rows: ["fx.usd-session-momentum"],
    finding:
      "inputs.json gives the ICE row a maximum age of zero hours, and engine.js also requires observed <= published <= received <= cutoff. Together those force observed = published = received = the cutoff instant, so a live morning can only pass with a zero-latency receipt stamped at 05:00:00.000. The supplied fixture passes because it stamps all three clocks at the cutoff.",
    consequence:
      "Sealed live proof for the ICE vote is impossible under v0.1.0 as written, and every historical morning stays blocked even if licensed fixings are acquired.",
    status: "recorded_not_applied",
    proposed_change:
      "v0.1.1: let the ICE row read the previous eligible 05:00 fixing with a maximum age of 24 hours, and require the receipt by the cutoff rather than at it.",
  },
  {
    id: "H1R-04",
    code: "shared_evidence_one_gate",
    severity: "gap",
    rows: ["calendar.known-releases-between-cutoff-and-endpoint", "calendar.days-since-and-until-high-impact-events"],
    finding:
      "Two calendar rows share one input. The event gate counts releases in [cutoff, endpoint); distance since or until an event has no executable representation.",
    consequence: "The count is the only calendar feature, so 'shared F23' is a declaration rather than an implemented rule.",
    status: "recorded_not_applied",
    proposed_change:
      "v0.1.1: either implement distance as a separate context field or record F23 as unimplemented in the rulebook table.",
  },
  {
    id: "H1R-05",
    code: "no_fallback_is_a_choice",
    severity: "assumption",
    rows: ["data.quality-gate-for-abstention"],
    finding:
      "The integrity gate has no fallback by design, so an input that is missing, stale, unclocked or substituted blocks the whole morning.",
    consequence: "One absent series blocks a morning even when the remaining votes are complete.",
    status: "accepted",
    proposed_change: null,
  },
  {
    id: "H1R-06",
    code: "trace_can_be_double_counted",
    severity: "presentation",
    rows: ["live.f2-us-2y-delta"],
    finding:
      "The trace carries votes.front even though frontCounted is false and no family reads it. A reader adding the trace's votes would double count the US leg.",
    consequence: "The fixture trace is complete, but the front vote must be read as reported-only.",
    status: "recorded_not_applied",
    proposed_change: "v0.1.1: rename the trace field to frontReportedOnly and publish the counted vote set beside it.",
  },
  {
    id: "H1R-07",
    code: "thresholds_unvalidated",
    severity: "assumption",
    rows: ["live.f5-dxy-delta", "fx.usd-session-momentum", "live.f6-gold-delta", "live.f10-equity-versus-usd"],
    finding:
      "The 0.30 per cent broad-dollar, 0.15 per cent ICE and 1 per cent gold and QQQ thresholds are proposed noise filters with no measured sign.",
    consequence: "The bands are hypotheses; they are not calibrated and carry no probability.",
    status: "accepted",
    proposed_change: null,
  },
  {
    id: "H1R-08",
    code: "shared_evidence_reduces_votes",
    severity: "assumption",
    rows: [
      "live.f3-us-de-2y-spread-delta",
      "rates.relative-front-end-delta",
      "live.f4-real-yield-delta",
      "rates.real-yield-delta",
    ],
    finding:
      "Eleven rows read five inputs. Eight rows across spread, real yield, broad dollar, ICE, gold and QQQ produce six votes; two rows each on spread and real yield produce one vote each.",
    consequence: "The 25-row book yields six votes in three equal-weight families, not 25 signals.",
    status: "accepted",
    proposed_change: null,
  },
  {
    id: "H1R-09",
    code: "trace_rows_are_not_measurements",
    severity: "presentation",
    rows: ["rates.term-premium-and-curve", "live.f7-economic-surprise", "live.f8-fed-bias"],
    finding:
      "The candidate's trace lists all 25 rows, and the ten rows with no feed carry a null value. The trace therefore shows 25 entries over nine measurements.",
    consequence: "A complete factor trace means every row is present and labelled, not that every row was measured.",
    status: "accepted",
    proposed_change: null,
  },
  {
    id: "H1R-10",
    code: "calendar_completeness_unproven",
    severity: "gap",
    rows: ["calendar.known-releases-between-cutoff-and-endpoint"],
    finding:
      "The event gate is only as good as the archived schedule. The staged calendar carries FOMC statements and none of the four other required release families.",
    consequence: "A zero count cannot be read as 'no release occurred' until the omitted schedules are archived.",
    status: "recorded_not_applied",
    proposed_change: null,
  },
];
function roleOf(row) {
  return String(row.prescribed_role || "").replace(/^HYPOTHESIS:\s*/, "");
}

/**
 * Check the review's arithmetic claims against the supplied package source.
 *
 * If the candidate's models.js is edited, the claim list stops matching and the review says so instead of
 * describing a rule that is no longer there.
 */
function checkArithmetic(packageRoot) {
  const source = fs.readFileSync(path.join(packageRoot, "models.js"), "utf8");
  const mismatches = ARITHMETIC_TOKENS.filter(([token]) => !source.includes(token)).map(([token, meaning]) => ({
    token,
    meaning,
  }));
  return {
    checked: true,
    file: "backtester/packages/USD-L1-25F-H1-v0.1.0/models.js",
    tokens: ARITHMETIC_TOKENS.length,
    matched: ARITHMETIC_TOKENS.length - mismatches.length,
    mismatches,
    verdict: mismatches.length
      ? "The supplied models.js no longer contains every claimed token; the review is stale."
      : "Every claimed executable token is present in the supplied models.js.",
  };
}

/**
 * Build the review.
 *
 * @param {object} options
 * @param {string} options.packageRoot absolute path to the committed package
 * @param {object} options.rows the supplied rows.json
 * @param {object} options.inputs the supplied inputs.json
 * @returns {object} the review record
 */
function buildH1Review({ packageRoot, rows, inputs }) {
  if (!rows || !Array.isArray(rows.rows) || rows.rows.length !== 25) {
    throw new Error("h1 review: the supplied rows.json must carry 25 adjudications");
  }
  const missing = rows.rows.filter((row) => !TREATMENTS[row.id]);
  if (missing.length) throw new Error(`h1 review: no treatment recorded for ${missing.map((row) => row.id).join(", ")}`);
  const unknown = Object.keys(TREATMENTS).filter((id) => !rows.rows.some((row) => row.id === id));
  if (unknown.length) {
    throw new Error(`h1 review: the treatment list names rows that are not in the package: ${unknown.join(", ")}`);
  }

  const reviewed = rows.rows.map((row) => {
    const treatment = TREATMENTS[row.id];
    return {
      id: row.id,
      name: row.name,
      declared_role: roleOf(row),
      source_key: row.source_key,
      registered_verdict: row.registered_verdict,
      treatment: treatment.treatment,
      effect: treatment.effect,
      vote: treatment.vote,
      family: treatment.family,
      assumption: treatment.assumption,
      discrepancies: treatment.discrepancies,
    };
  });

  const voteRows = reviewed.filter((row) => row.vote === "one" || row.vote === "shared");
  const byId = new Map(reviewed.map((row) => [row.id, row]));
  const sharedInputs = new Map();
  for (const row of reviewed) {
    if (!row.source_key) continue;
    if (!sharedInputs.has(row.source_key)) sharedInputs.set(row.source_key, []);
    sharedInputs.get(row.source_key).push(row.id);
  }
  const sharedEvidence = [...sharedInputs.entries()]
    .map(([input, rowIds]) => ({
      input,
      rows: rowIds,
      reads: rowIds.length,
      votes: new Set(rowIds.map((id) => byId.get(id).family).filter(Boolean)).size,
      non_voting: new Set(rowIds.map((id) => byId.get(id).family).filter(Boolean)).size === 0,
      treatment: TREATMENTS[rowIds[0]].treatment,
    }))
    .sort((a, b) => b.reads - a.reads || a.input.localeCompare(b.input));
  const byFamily = {};
  const seriesByFamily = {};
  for (const row of voteRows) {
    const family = row.family || "unassigned";
    byFamily[family] = (byFamily[family] || 0) + 1;
    if (!seriesByFamily[family]) seriesByFamily[family] = new Set();
    seriesByFamily[family].add(row.source_key);
  }
  const noFeed = reviewed.filter((row) => !row.source_key);
  const gates = reviewed.filter((row) => row.vote === "gate");
  const requiredNotVoting = reviewed.filter((row) => row.vote === "required_not_voting");

  const summary = {
    adjudications: reviewed.length,
    with_declared_input: reviewed.length - noFeed.length,
    no_declared_input: noFeed.length,
    inputs: Object.keys(inputs).length,
    votes: voteRows.length,
    votes_by_family: byFamily,
    votes_by_family_series: Object.fromEntries(
      Object.entries(seriesByFamily).map(([family, series]) => [family, series.size])
    ),
    distinct_vote_series: new Set(voteRows.map((row) => row.source_key)).size,
    gate_rows: gates.length,
    gate_inputs: new Set(gates.map((row) => row.source_key)).size,
    required_not_voting_rows: requiredNotVoting.length,
    discrepant_rows: reviewed.filter((row) => row.discrepancies.length).length,
    discrepancy_count: DISCREPANCIES.length,
    assumptions: reviewed.filter((row) => row.assumption).length,
  };

  const checks = [
    { check: "25 adjudications are reviewed", pass: summary.adjudications === 25 },
    {
      check: "15 rows name an input and 10 name none",
      pass: summary.with_declared_input === 15 && summary.no_declared_input === 10,
    },
    { check: "the package declares nine inputs", pass: summary.inputs === 9 },
    { check: "eight rows cast six votes", pass: voteRows.length === 8 && summary.distinct_vote_series === 6 },
    {
      check: "three equal-weight families of two distinct series each",
      pass:
        Object.keys(seriesByFamily).length === 3 &&
        Object.values(seriesByFamily).every((series) => series.size === 2),
    },
    {
      check: "the front-end input is required and cannot vote",
      pass: requiredNotVoting.length === 2 && new Set(requiredNotVoting.map((row) => row.source_key)).size === 1,
    },
    { check: "two inputs are gates", pass: summary.gate_inputs === 2 },
  ];

  return {
    id: ID,
    version: VERSION,
    reviewed_on: REVIEWED,
    reviewer: REVIEWER,
    candidate: rows.candidate,
    basis:
      "the supplied rows.json, inputs.json and models.js, read against the executable rule and re-checked for every claimed token",
    rows: reviewed,
    shared_evidence: sharedEvidence,
    exclusions: noFeed.map((row) => ({ id: row.id, name: row.name, reason: row.effect })),
    discrepancies: DISCREPANCIES,
    summary,
    accounting: { checks, all_pass: checks.every((check) => check.pass) },
    arithmetic: checkArithmetic(packageRoot),
    verdict:
      "The executable rule accounts for all 25 adjudications: six votes in three families, two gate inputs, one required-but-silent operand and ten explicit exclusions. Three findings could change behaviour and are recorded for v0.1.1 rather than applied to the frozen candidate; the ICE zero-age rule is the one that prevents any sealed live proof.",
  };
}

module.exports = { ID, VERSION, REVIEWED, DISCREPANCIES, TREATMENTS, ARITHMETIC_TOKENS, buildH1Review, checkArithmetic, roleOf };
