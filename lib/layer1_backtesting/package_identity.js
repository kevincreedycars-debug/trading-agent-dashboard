/**
 * Identity of the requested H1 package, and the review of the 25 adjudications against the executable rules.
 *
 * Two questions are answered from files, not from memory:
 *
 *   1. Is there an artefact in this checkout that calls itself USD-L1-25F-H1-v0.1.0? If not, the screen must say
 *      so, because a package that cannot be found cannot be verified or run.
 *   2. Does every one of the 25 adjudicated rows map to a rule the implemented book actually executes, and which
 *      hypotheses does that mapping introduce that the adjudications did not settle?
 *
 * Research only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { hashTextFile } = require("./engine");

const REQUESTED = "USD-L1-25F-H1-v0.1.0";
const SEARCH_TEXT = [REQUESTED, "25F-H1", "H1-v0.1.0"];

function readText(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return null;
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function digestOf(root, relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return null;
  const buffer = fs.readFileSync(file);
  return { path: relative, ...hashTextFile(buffer) };
}

/**
 * Search the places a package would have to live: the config folder, the research docs tree, the exports
 * folder, the top level of data and the engine library. The search is a real file read and the list is returned,
 * so "not found" is auditable rather than an assertion.
 */
function verifyRequestedPackage({ root, requested = REQUESTED }) {
  const roots = ["config", "docs/research/usd-session/v1", "exports", "data", "lib/layer1_backtesting"];
  const searched = [];
  const hits = [];
  for (const relative of roots) {
    const dir = path.join(root, relative);
    if (!fs.existsSync(dir)) continue;
    const stat = fs.statSync(dir);
    const files = stat.isDirectory()
      ? fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(relative, entry.name))
      : [relative];
    for (const file of files) {
      if (!/\.(json|md|js)$/.test(file)) continue;
      if (file === path.join("lib/layer1_backtesting", "package_identity.js")) continue;
      searched.push(file);
      const text = readText(path.join(root, file));
      if (text && SEARCH_TEXT.some((needle) => text.includes(needle))) hits.push(file);
    }
  }

  const nearest = {
    book: digestOf(root, "config/usd_l1_factor_rulebook_v1.json"),
    decision_rules: digestOf(root, "config/usd_l1_decision_rules_v1.json"),
    engine_interface: digestOf(root, "data/usd-layer1-backtester/engine-v1.json"),
  };

  return {
    requested: requested,
    status: hits.length ? "PRESENT" : "NOT_PRESENT_IN_CHECKOUT",
    checked_at: "2026-11-17",
    searched: searched.sort(),
    hits: hits.sort(),
    nearest,
    blockers: hits.length
      ? []
      : [
          `No file in config, docs/research/usd-session/v1, exports, data or lib/layer1_backtesting names ${requested}.`,
          "The nearest frozen package is usd-l1-factor-rulebook-v1.0.0 with usd-l1-decision-rules-v1.0.0, and its own identity is CONFIG_BLOCKED.",
          "Without the requested package there is no adjudication-to-rule mapping to verify against, so the four H1 tests stay unscored.",
        ],
    consequence: hits.length
      ? `A file naming ${requested} is present in this checkout. Presence is not an identity check: the H1 candidate tab carries the archive SHA-256 and the recomputed SHA256SUMS result, and historical H1 coverage is measured separately from the legacy book.`
      : "The candidate shown and run on this screen is the legacy implemented book, labelled as such. It is not the requested H1 package.",
  };
}

/**
 * Every hypothesis the executable mapping introduces, kept visible beside the adjudications.
 *
 * A hypothesis here is not a claim of edge. It is a choice the code had to make that the adjudications did not
 * settle, listed so a reviewer can see it rather than infer it from the implementation.
 */
function adjudicationHypotheses({ missing, sessionsEligible }) {
  const spreadAbsent = missing.us_de_2y_spread_d5_bps === undefined ? "an unstated number" : String(missing.us_de_2y_spread_d5_bps);
  const eligible = sessionsEligible === null ? "an unstated number" : String(sessionsEligible);
  return [
    {
      id: "H-1",
      text: "Each family carries one unit of weight and each usable signal inside it votes equally; the adjudications validate no weight at all.",
      evidence: "config/usd_l1_decision_rules_v1.json -> families[].weight and families[].signals[].vote_rule",
      status: "visible_not_validated",
    },
    {
      id: "H-2",
      text: "Each family votes as the arithmetic mean of its usable signals, capped to [-1, +1]; a family with fewer usable signals still votes for those it has.",
      evidence: "config/usd_l1_decision_rules_v1.json -> direction.family_vote; eligibility.min_usable_signals = 6",
      status: "visible_not_validated",
    },
    {
      id: "H-3",
      text: "A direction exists only outside the frozen 0.20 deadband; inside it, or on an exact net zero, the morning is NO_CALL.",
      evidence: "config/usd_l1_decision_rules_v1.json -> direction.deadband; engine check E5",
      status: "frozen_by_rules_not_validated",
    },
    {
      id: "H-4",
      text: "The trade floor is band 3 with all twelve signals usable and a readable event family. It is a study floor, not an edge.",
      evidence: "config/usd_l1_decision_rules_v1.json -> trade_rule; models.js candidate.policy",
      status: "provisional",
    },
    {
      id: "H-5",
      text: "A missing input makes its signal unusable; nothing is carried forward, proxied or filled from a later print.",
      evidence: "run.validity_gate.requirement_table[].missing_action",
      status: "frozen_by_rules_not_validated",
    },
    {
      id: "H-6",
      text:
        "The US-DE 2Y spread input is absent on " +
        spreadAbsent +
        " of " +
        eligible +
        " mornings, so the F3 spread rule cannot vote on those mornings even though the row is mapped.",
      evidence: "run.coverage.by_model.challenger_v1.inputs_missing_histogram",
      status: "measured_gap",
    },
    {
      id: "H-7",
      text: "Every one of the 25 adjudications is disposition Blocked: no sign, weight or threshold is validated by the adjudication that produced it.",
      evidence: "config/usd_l1_factor_rulebook_v1.json -> rows[].disposition",
      status: "measured_gap",
    },
    {
      id: "H-8",
      text: "The dollar series behind F5 is a broad trade-weighted index stand-in, not the official ICE cash DXY.",
      evidence: "docs/dashboard-design/usd-factor-sets.md; run-v1.json -> tests.dxy_direction.official_series",
      status: "visible_not_validated",
    },
    {
      id: "H-9",
      text: "The control treats a neutral Fed bias as a missing input, so a neutral statement removes F8 from the vote instead of voting neutral.",
      evidence: "backtester/replay/usd/usd_replay_core.js -> F8 block",
      status: "code_fact_requires_owner_review",
    },
    {
      id: "H-10",
      text: "The book carries no timeframe field: all 25 rows are applied to the 05:00 London session, so no row is specifically an H1 rule.",
      evidence: "config/usd_l1_factor_rulebook_v1.json -> cutoff, scope, rows[]",
      status: "identity_gap_for_H1_package",
    },
  ];
}

function familyIndex(rules) {
  const index = new Map();
  for (const family of (rules && rules.families) || []) {
    for (const signal of family.signals || []) {
      const entry = {
        family: family.id,
        family_label: family.label,
        family_weight: family.weight === undefined ? null : family.weight,
        signal_id: signal.id,
        signal_label: signal.label,
        vote_rule: signal.vote_rule,
        source: signal.source,
      };
      if (signal.factor_id) index.set(signal.factor_id, entry);
      for (const shared of signal.shared_factor_ids || []) index.set(shared, { ...entry, shared: true });
    }
  }
  return index;
}

/**
 * Review all 25 adjudications against the executable book.
 *
 * @param {object} options
 * @param {object} options.book config/usd_l1_factor_rulebook_v1.json
 * @param {object} options.rules config/usd_l1_decision_rules_v1.json
 * @param {object} options.requirementTable run.validity_gate.requirement_table
 * @param {object} options.coverage run.coverage.by_model
 */
function reviewAdjudications({ book, rules, requirementTable, coverage }) {
  const families = familyIndex(rules);
  const requirements = new Map((requirementTable || []).map((row) => [row.factor_id, row]));
  const rows = ((book && book.rows) || []).map((row) => {
    const family = families.get(row.id) || null;
    const requirement = requirements.get(row.id) || null;
    const enforced = Boolean(requirement && requirement.enforced_by_implemented_book);
    const treatment = (requirement && requirement.treatment) || row.treatment || row.role;
    const directionRow = treatment === "direction";
    let status = "unmapped";
    if (treatment === "missing") status = "missing_implementation";
    else if (!directionRow) status = "non_voting";
    else if (family && family.shared) status = "mapped_shared";
    else if (family && enforced) status = "mapped_and_executable";
    else if (family && !enforced) status = "mapped_not_enforced";
    else if (enforced) status = "gate_only";
    return {
      factor_id: row.id,
      name: row.name,
      treatment,
      disposition: row.disposition,
      verdict: row.verdict,
      family: family ? family.family : null,
      family_label: family ? family.family_label : null,
      family_weight: family ? family.family_weight : null,
      signal_id: family ? family.signal_id : null,
      vote_rule: family ? family.vote_rule : null,
      shared: Boolean(family && family.shared),
      fields: requirement ? requirement.fields || [] : [],
      source: requirement ? requirement.source || null : null,
      enforced_by_implemented_book: enforced,
      status,
    };
  });
  const byStatus = {};
  for (const row of rows) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  const missing = (coverage && coverage.challenger_v1 && coverage.challenger_v1.inputs_missing_histogram) || {};
  const sessionsEligible = (coverage && coverage.challenger_v1 && coverage.challenger_v1.sessions_eligible) || null;

  return {
    rows,
    summary: {
      adjudications: rows.length,
      mapped_and_executable: byStatus.mapped_and_executable || 0,
      mapped_shared: byStatus.mapped_shared || 0,
      mapped_not_enforced: byStatus.mapped_not_enforced || 0,
      missing_implementation: byStatus.missing_implementation || 0,
      non_voting: byStatus.non_voting || 0,
      gate_only: byStatus.gate_only || 0,
      unmapped: byStatus.unmapped || 0,
      by_status: byStatus,
      families: ((rules && rules.families) || []).map((family) => ({
        id: family.id,
        label: family.label,
        weight: family.weight === undefined ? null : family.weight,
        signals: (family.signals || []).length,
      })),
    },
    hypotheses: adjudicationHypotheses({ missing, sessionsEligible }),
    verdict:
      byStatus.unmapped || byStatus.mapped_not_enforced || byStatus.missing_implementation
        ? "The mapping is incomplete: at least one adjudication has no enforced executable rule."
        : "All 25 adjudications have an executable rule in the implemented book, subject to the hypotheses above.",
  };
}

module.exports = { REQUESTED, verifyRequestedPackage, reviewAdjudications };
