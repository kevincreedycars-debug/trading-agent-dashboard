"use strict";

/**
 * The frozen USD Layer 1 factor rulebook, version 1 (research only).
 *
 * The research names twenty-five factors and the 2026-11-04 adjudication judges each one, but neither fixes what
 * a morning may do with a reading. This module loads the book that does: one row per factor with its usability
 * clock, its interaction rules and the one choice frozen for it, plus the ten interaction rules that stop a
 * single print from voting twice.
 *
 * Three properties are enforced at load time rather than promised in prose:
 *   - the rows are the same twenty-five the audit plan names, with the same role and the same inputs, so the book
 *     cannot describe a different factor set than the one the replay scores;
 *   - every row input carries an age profile, so no reading becomes usable without a declared staleness rule;
 *   - the decision signals each belong to a direction row, so no vote is cast by a row the book calls silent and
 *     no signal arrives from nowhere.
 *
 * The adjudication text is joined from `adjudication_review` by factor id and never copied into the config, so a
 * row cites the registered verdict rather than a paraphrase that could drift from it.
 *
 * Nothing here reads the network, a warehouse or a live workflow, and nothing scores an outcome. A valid rulebook
 * is not evidence of edge, and a row that fires is not a validated sign.
 */

const fs = require("node:fs");
const path = require("node:path");

const audit = require("./daily_audit_v1");
const adjudication = require("./adjudication_review");
const decision = require("./decision_rules_v1");

const CONFIG_RELATIVE = "config/usd_l1_factor_rulebook_v1.json";
const CONFIG_PATH = path.join(__dirname, "..", "..", "..", CONFIG_RELATIVE);
const DECISION_RELATIVE = "config/usd_l1_decision_rules_v1.json";

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

const VERSION = CONFIG.version;
const FROZEN_ON = CONFIG.frozen_on;
const STATUS = CONFIG.status;
const EXPECTED_ROWS = 25;
const EXPECTED_INTERACTIONS = 10;

const ROLE_LABELS = Object.freeze({
  direction: "Direction",
  counted_elsewhere: "Counted elsewhere",
  excluded: "Deliberately excluded",
  event_missing: "Missing data",
  inactive: "Inactive",
  calendar_window: "Calendar window",
  gate: "Non-voting gate"
});

/** The treatments the adjudication review may assign, as the review module writes them. */
const TREATMENTS = Object.freeze(["direction", "counted_elsewhere", "no_call", "excluded", "missing"]);

const USABILITY_FIELDS = Object.freeze(["becomes_usable", "carried_unchanged", "expires", "evidence"]);
const EFFECT_FIELDS = Object.freeze(["direction", "conviction", "trade"]);

function unique(values) {
  return Array.from(new Set(values));
}

function sameSet(left, right) {
  const a = unique(left.map(String)).sort();
  const b = unique(right.map(String)).sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Check one rulebook document. Every failure is reported rather than the first, because a book that is wrong in
 * several places is more useful to see whole than to fix one line at a time.
 */
function validateRulebook(config = CONFIG, deps = {}) {
  const plan = deps.factorPlan || audit.FACTOR_PLAN;
  const review = deps.review || adjudication.REVIEW;
  const signals = deps.signals || decision.SIGNALS;
  const rulesVersion = deps.rulesVersion || decision.VERSION;
  const configPath = deps.configPath || CONFIG_RELATIVE;

  const checks = [];
  const record = (name, offenders, detail) => {
    checks.push({ name, ok: offenders.length === 0, detail, offenders: offenders.slice(0, 10) });
  };

  const rows = Array.isArray(config.rows) ? config.rows : [];
  const ids = rows.map((row) => row && row.id);
  const planIds = plan.map((entry) => entry.id);
  const planById = new Map(plan.map((entry) => [entry.id, entry]));
  const signalIds = signals.map((signal) => signal.id);
  const interactions = Array.isArray(config.interaction_rules) ? config.interaction_rules : [];
  const interactionIds = interactions.map((entry) => entry && entry.id);
  const interactionById = new Map(interactions.map((entry) => [entry.id, entry]));
  const inputAges = config.input_ages || {};
  const ageProfiles = config.age_profiles || {};
  const openJudgements = config.open_judgements || {};

  record(
    "row count",
    rows.length === EXPECTED_ROWS ? [] : [`${rows.length} rows, expected ${EXPECTED_ROWS}`],
    "the plan names twenty-five factors"
  );

  record(
    "row ids",
    ids.filter((id) => !id).concat(ids.filter((id, index) => ids.indexOf(id) !== index)),
    "every row needs an id and no id may repeat"
  );

  record(
    "plan coverage",
    planIds
      .filter((id) => !ids.includes(id))
      .map((id) => `missing ${id}`)
      .concat(ids.filter((id) => !planIds.includes(id)).map((id) => `unknown ${id}`)),
    "the book must describe exactly the audit plan's factors"
  );

  const roleOffenders = [];
  const signalOffenders = [];
  const inputOffenders = [];
  const proseOffenders = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
    const entry = planById.get(row.id);
    if (!entry) continue;
    if (entry.role !== row.role) roleOffenders.push(`${row.id}: ${row.role} vs plan ${entry.role}`);
    if (!ROLE_LABELS[row.role]) roleOffenders.push(`${row.id}: unlabelled role ${row.role}`);
    const rowSignals = Array.isArray(row.signals) ? row.signals : [];
    for (const signal of entry.signals) {
      if (!rowSignals.includes(signal)) signalOffenders.push(`${row.id}: plan signal ${signal} dropped`);
    }
    for (const signal of rowSignals) {
      if (!signalIds.includes(signal)) signalOffenders.push(`${row.id}: unknown decision signal ${signal}`);
    }
    const rowInputs = Array.isArray(row.inputs) ? row.inputs : [];
    if (!sameSet(entry.inputs, rowInputs)) inputOffenders.push(`${row.id}: inputs differ from the plan`);
    for (const input of rowInputs) {
      if (!inputAges[input]) inputOffenders.push(`${row.id}: ${input} has no age profile`);
    }
    if (typeof row.applies_when !== "string" || !row.applies_when.trim()) proseOffenders.push(`${row.id}: no applies_when`);
    if (typeof row.frozen_choice !== "string" || !row.frozen_choice.trim()) proseOffenders.push(`${row.id}: no frozen_choice`);
    for (const field of USABILITY_FIELDS) {
      if (!row.usability || typeof row.usability[field] !== "string" || !row.usability[field].trim()) {
        proseOffenders.push(`${row.id}: usability.${field} is empty`);
      }
    }
    for (const field of EFFECT_FIELDS) {
      if (!row.effect || typeof row.effect[field] !== "string" || !row.effect[field].trim()) {
        proseOffenders.push(`${row.id}: effect.${field} is empty`);
      }
    }
    if (row.open_judgement && !openJudgements[row.open_judgement]) {
      proseOffenders.push(`${row.id}: open judgement ${row.open_judgement} is undefined`);
    }
    for (const interaction of Array.isArray(row.interactions) ? row.interactions : []) {
      if (!interactionById.has(interaction)) proseOffenders.push(`${row.id}: unknown interaction ${interaction}`);
    }
  }
  record("role parity", roleOffenders, "a row's role is the role the audit plan gives the factor");
  record("signal ownership", signalOffenders, "rows may add signals they own but may not drop the plan's");
  record("row inputs", inputOffenders, "inputs match the plan and every input has an age profile");
  record("row prose and references", proseOffenders, "each row states its clock, its effect and its open questions");

  const ageOffenders = Object.keys(inputAges)
    .filter((key) => !ageProfiles[inputAges[key]])
    .map((key) => `${key} -> ${inputAges[key]}`);
  const clockFrom = (ageProfiles.derived_spread && ageProfiles.derived_spread.clock_from) || [];
  for (const key of clockFrom) {
    if (!inputAges[key]) ageOffenders.push(`derived_spread clock leg ${key} has no age profile`);
  }
  for (const [id, profile] of Object.entries(ageProfiles)) {
    if (!Number.isFinite(profile.max_age_business_days) || profile.max_age_business_days < 0) {
      ageOffenders.push(`${id}: max_age_business_days must be a non-negative number`);
    }
  }
  record("age profiles", ageOffenders, "every staged input resolves to a declared staleness profile");

  record(
    "decision pointer",
    config.decision_rules && config.decision_rules.path === DECISION_RELATIVE && config.decision_rules.version === rulesVersion
      ? []
      : ["the decision pointer does not name the loaded decision rules"],
    "the book defers its arithmetic to one versioned decision file"
  );

  const directionSignalList = rows
    .filter((row) => row && row.role === "direction")
    .flatMap((row) => (Array.isArray(row.signals) ? row.signals : []));
  const directionSignals = unique(directionSignalList);
  const voteOffenders = signalIds
    .filter((signal) => !directionSignals.includes(signal))
    .map((signal) => `unowned signal ${signal}`);
  for (const signal of directionSignals) {
    const owners = directionSignalList.filter((entry) => entry === signal).length;
    if (owners > 1) voteOffenders.push(`${signal} has ${owners} direction owners, so its vote would have no single source`);
  }
  record("vote coverage", voteOffenders, "every decision signal belongs to exactly one direction row");

  const interactionOffenders = [];
  if (interactions.length !== EXPECTED_INTERACTIONS) {
    interactionOffenders.push(`${interactions.length} interaction rules, expected ${EXPECTED_INTERACTIONS}`);
  }
  for (const interaction of interactions) {
    if (!interaction || !/^IR-\d+$/.test(String(interaction.id))) {
      interactionOffenders.push(`bad interaction id ${interaction && interaction.id}`);
      continue;
    }
    if (interactionIds.filter((id) => id === interaction.id).length > 1) interactionOffenders.push(`duplicate interaction ${interaction.id}`);
    if (!interaction.rule || !interaction.detail) interactionOffenders.push(`${interaction.id}: rule or detail is empty`);
    const bound = Array.isArray(interaction.bound_rows) ? interaction.bound_rows : [];
    if (!bound.length) interactionOffenders.push(`${interaction.id}: binds no rows`);
    for (const id of bound) {
      if (!ids.includes(id)) interactionOffenders.push(`${interaction.id}: binds unknown row ${id}`);
    }
  }
  for (const row of rows) {
    if (!row || !row.id) continue;
    const declared = Array.isArray(row.interactions) ? row.interactions : [];
    if (!declared.length) interactionOffenders.push(`${row.id}: no interaction rule names it`);
    for (const id of declared) {
      const interaction = interactionById.get(id);
      if (interaction && !(Array.isArray(interaction.bound_rows) ? interaction.bound_rows : []).includes(row.id)) {
        interactionOffenders.push(`${row.id}: declares ${id}, which does not bind it`);
      }
    }
  }
  for (const interaction of interactions) {
    for (const id of Array.isArray(interaction.bound_rows) ? interaction.bound_rows : []) {
      const row = rows.find((entry) => entry && entry.id === id);
      if (row && !(Array.isArray(row.interactions) ? row.interactions : []).includes(interaction.id)) {
        interactionOffenders.push(`${interaction.id}: binds ${id}, which does not declare it`);
      }
    }
  }
  record("interaction rules", interactionOffenders, "ten rules, each bound both ways");

  const reviewIds = review.map((entry) => entry && entry.factor_id);
  const joinOffenders = [];
  for (const id of ids) {
    const matches = reviewIds.filter((entry) => entry === id).length;
    if (matches !== 1) joinOffenders.push(`${id}: ${matches} adjudication records`);
  }
  for (const entry of review) {
    if (entry && !TREATMENTS.includes(entry.treatment)) joinOffenders.push(`${entry.factor_id}: unknown treatment ${entry.treatment}`);
  }
  record("adjudication join", joinOffenders, "each row joins exactly one registered verdict");

  const judgementOffenders = [];
  const judgementRows = (judgement) =>
    [judgement.row].concat(Array.isArray(judgement.also_rows) ? judgement.also_rows : []).filter(Boolean);
  for (const [id, judgement] of Object.entries(openJudgements)) {
    if (!judgement.question || !judgement.resolved_by) judgementOffenders.push(`${id}: question or resolved_by is empty`);
    for (const id2 of judgementRows(judgement)) {
      if (!ids.includes(id2)) judgementOffenders.push(`${id}: names unknown row ${id2}`);
    }
    for (const id2 of judgementRows(judgement)) {
      const row = rows.find((entry) => entry && entry.id === id2);
      if (row && row.open_judgement !== id) judgementOffenders.push(`${id}: names ${id2}, which cites ${row.open_judgement || "nothing"}`);
    }
  }
  for (const row of rows) {
    const judgement = row && row.open_judgement ? openJudgements[row.open_judgement] : null;
    if (judgement && !judgementRows(judgement).includes(row.id)) {
      judgementOffenders.push(`${row.id}: ${row.open_judgement} does not name it`);
    }
  }
  record("open judgements", judgementOffenders, "every open question is defined and names the rows that carry it");

  const errors = checks.filter((check) => !check.ok).map((check) => `${check.name}: ${check.detail} [${check.offenders.join(", ")}]`);
  return {
    ok: errors.length === 0,
    version: config.version,
    frozen_on: config.frozen_on,
    config_path: configPath,
    checks,
    errors
  };
}

function assertRulebook(config = CONFIG, deps = {}) {
  const validation = validateRulebook(config, deps);
  if (!validation.ok) {
    throw new Error(`factor rulebook ${validation.version} failed its load-time checks: ${validation.errors.join("; ")}`);
  }
  return validation;
}

/** Join the plan's names and the registered verdicts onto each row. The config keeps only what the book decides. */
function joinRows(config, planById, reviewById) {
  return (config.rows || []).map((row) => {
    const entry = planById.get(row.id) || {};
    const verdict = reviewById.get(row.id) || null;
    return Object.freeze({
      ...row,
      name: entry.name || row.id,
      role_label: ROLE_LABELS[row.role] || row.role,
      adjudication: verdict ? Object.freeze({ ...verdict }) : null
    });
  });
}

/** Read, check and join a rulebook document. Used for the load below and by drift tests against a staged copy. */
function loadRulebook(options = {}) {
  const configPath = options.configPath || CONFIG_PATH;
  const config = options.config || JSON.parse(fs.readFileSync(configPath, "utf8"));
  const deps = { ...(options.deps || {}), configPath: CONFIG_RELATIVE };
  const validation = validateRulebook(config, deps);
  if (!validation.ok) {
    throw new Error(`factor rulebook ${validation.version} failed its load-time checks: ${validation.errors.join("; ")}`);
  }
  const plan = deps.factorPlan || audit.FACTOR_PLAN;
  const review = deps.review || adjudication.REVIEW;
  return {
    config,
    validation,
    rows: Object.freeze(joinRows(config, new Map(plan.map((entry) => [entry.id, entry])), new Map(review.map((entry) => [entry.factor_id, entry])))),
    interactions: Object.freeze(config.interaction_rules.map((entry) => Object.freeze({ ...entry }))),
    open_judgements: config.open_judgements,
    age_profiles: config.age_profiles,
    input_ages: config.input_ages
  };
}

/** The book is checked when it is required, not when someone remembers to run a test. */
const VALIDATION = assertRulebook(CONFIG);

const PLAN_BY_ID = new Map(audit.FACTOR_PLAN.map((entry) => [entry.id, entry]));
const REVIEW_BY_ID = new Map(adjudication.REVIEW.map((entry) => [entry.factor_id, entry]));

const ROWS = Object.freeze(joinRows(CONFIG, PLAN_BY_ID, REVIEW_BY_ID));
const ROW_BY_ID = new Map(ROWS.map((row) => [row.id, row]));
const INTERACTIONS = Object.freeze(CONFIG.interaction_rules.map((entry) => Object.freeze({ ...entry })));
const INTERACTION_BY_ID = new Map(INTERACTIONS.map((entry) => [entry.id, entry]));
const OPEN_JUDGEMENTS = Object.freeze({ ...CONFIG.open_judgements });
const AGE_PROFILES = Object.freeze({ ...CONFIG.age_profiles });
const INPUT_AGES = Object.freeze({ ...CONFIG.input_ages });

function rowFor(factorId) {
  return ROW_BY_ID.get(factorId) || null;
}

function rowsForRole(role) {
  return ROWS.filter((row) => row.role === role);
}

/** The rows that may vote: the direction rows, in the audit plan's order. */
function voteRows() {
  return rowsForRole("direction");
}

function inputsFor(factorId) {
  const row = rowFor(factorId);
  return row ? row.inputs.slice() : [];
}

function signalsFor(factorId) {
  const row = rowFor(factorId);
  return row ? row.signals.slice() : [];
}

/**
 * The single direction row that owns a decision signal. The load-time vote check already refuses a signal with no
 * owner or with two, so a non-null answer here is the row a vote must be attributable to.
 */
function ownerOfSignal(signalId) {
  const rows = voteRows().filter((row) => row.signals.includes(signalId));
  return rows.length === 1 ? rows[0].id : null;
}

function adjudicationFor(factorId) {
  const row = rowFor(factorId);
  return row ? row.adjudication : null;
}

function interactionFor(interactionId) {
  return INTERACTION_BY_ID.get(interactionId) || null;
}

function interactionsForRow(factorId) {
  const row = rowFor(factorId);
  if (!row) return [];
  return row.interactions.map((id) => INTERACTION_BY_ID.get(id)).filter(Boolean);
}

/** The declared age profile for one staged input, or null when the input is not in the book. */
function ageProfileFor(inputKey) {
  const profileId = INPUT_AGES[inputKey];
  const profile = profileId ? AGE_PROFILES[profileId] : null;
  if (!profile) return null;
  return { input: inputKey, profile_id: profileId, ...profile };
}

/** The maximum age, in business days, a reading of this input may reach before it expires. */
function maxAgeBusinessDays(inputKey) {
  const profile = ageProfileFor(inputKey);
  return profile ? profile.max_age_business_days : null;
}

function counts() {
  const byRole = {};
  for (const role of Object.keys(ROLE_LABELS)) byRole[role] = rowsForRole(role).length;
  return {
    version: VERSION,
    frozen_on: FROZEN_ON,
    rows: ROWS.length,
    by_role: byRole,
    vote_rows: voteRows().length,
    interactions: INTERACTIONS.length,
    open_judgements: Object.keys(OPEN_JUDGEMENTS).length,
    inputs: Object.keys(INPUT_AGES).length,
    age_profiles: Object.keys(AGE_PROFILES).length,
    joined_adjudications: ROWS.filter((row) => row.adjudication).length
  };
}

module.exports = {
  CONFIG,
  CONFIG_PATH,
  CONFIG_RELATIVE,
  DECISION_RELATIVE,
  VERSION,
  FROZEN_ON,
  STATUS,
  EXPECTED_ROWS,
  EXPECTED_INTERACTIONS,
  ROLE_LABELS,
  TREATMENTS,
  ROWS,
  INTERACTIONS,
  OPEN_JUDGEMENTS,
  AGE_PROFILES,
  INPUT_AGES,
  VALIDATION,
  validateRulebook,
  assertRulebook,
  loadRulebook,
  rowFor,
  rowsForRole,
  voteRows,
  inputsFor,
  signalsFor,
  ownerOfSignal,
  adjudicationFor,
  interactionFor,
  interactionsForRow,
  ageProfileFor,
  maxAgeBusinessDays,
  counts
};
