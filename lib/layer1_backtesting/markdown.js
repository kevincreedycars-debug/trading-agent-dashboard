/**
 * Render the Layer 1 backtest report as the committed markdown artefact.
 *
 * The markdown is rendered from the same object the JSON report is built from, so a figure in the prose is a
 * figure in the report and never a transcription. Nothing here computes a number: it only formats one.
 *
 * Research only.
 */
"use strict";

const { SCHEMA_VERSION } = require("./report");

const REPRODUCTION_COMMAND = "node scripts/build_layer1_backtest_report.js --check";

function text(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function percent(value) {
  return typeof value === "number" ? `${value}%` : "—";
}

function table(headers, rows) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) lines.push(`| ${row.map((cell) => text(cell)).join(" | ")} |`);
  return lines;
}

function bullets(items, indent = "") {
  return (items || []).filter(Boolean).map((item) => `${indent}- ${item}`);
}

/** Flatten a nested numbers block into `key: value` lines, so a nested cell table cannot be quietly dropped. */
function numberLines(numbers, prefix = "") {
  const lines = [];
  for (const [key, value] of Object.entries(numbers || {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      lines.push(...numberLines(value, name));
      continue;
    }
    lines.push(`${name}: ${text(value)}`);
  }
  return lines;
}

function scopeSection(report) {
  const scope = report.scope || {};
  const gate = scope.gate_counts || {};
  return [
    "## 1. Scope",
    "",
    ...table(
      ["Item", "Value"],
      [
        ["Sessions replayed", scope.sessions],
        ["First morning", scope.first_date],
        ["Last morning", scope.last_date],
        ["Session window", scope.cutoff],
        ["Gate counts (published)", Object.keys(gate).length ? JSON.stringify(gate) : null],
        ["Gate note", scope.gate_note],
        ["Research gate", scope.research_gate ? JSON.stringify(scope.research_gate) : null],
      ]
    ),
    "",
  ];
}

function modelsSection(report) {
  const lines = ["## 2. The engine and the two models", ""];
  lines.push(
    "Both models are declarations read by one engine (`lib/layer1_backtesting/engine.js`); the engine owns the",
    "session contract, the gate, the ordered check chain, the outcome and the policy arithmetic. A model supplies",
    "the declarations and nothing else, so the two rows below differ only where the declarations differ.",
    ""
  );
  lines.push(
    ...table(
      ["Model", "Role", "Version", "Rulebook", "Identity", "Gate basis"],
      (report.models || []).map((model) => [
        `${model.label} (\`${model.id}\`)`,
        model.role,
        model.version,
        model.rulebook_version,
        model.identity ? model.identity.status : null,
        model.gate_basis,
      ])
    ),
    ""
  );
  for (const model of report.models || []) {
    lines.push(`### ${model.role}: check chain`, "");
    lines.push(
      ...table(
        ["Check", "Name", "On fail"],
        (model.check_chain || []).map((check) => [check.id, check.name, check.on_fail])
      ),
      ""
    );
  }
  return lines;
}

/** A decision's reasons are printed as `code (source)`: enough to trace each one, short enough to read inline. */
function reasonCodes(reasons) {
  const coded = (reasons || []).map((reason) => `${reason.code} (${reason.source})`);
  return coded.length ? coded.join(", ") : "none";
}

function decisionsSection(report) {
  const decisions = report.decisions || {};
  const byModel = decisions.by_model || {};
  const lines = ["## 3. Decisions", ""];
  lines.push(
    "Every record below was produced by the engine on the stored morning, then reconciled against the side of the",
    "published artefact that describes that model: the control against `sessions[].models.current`, the candidate",
    "against `engine-v1.json morning_states[]`. A field the artefact never published is counted as `not_published`",
    "and excluded from the comparison, so a model is never marked wrong for a figure it never claimed.",
    ""
  );
  lines.push(
    ...table(
      ["Model", "Sessions", "Allowed", "Abstained", "Blocked", "Trade eligible", "Directional", "By direction"],
      Object.entries(byModel).map(([role, summary]) => [
        role,
        summary.sessions,
        summary.allowed,
        summary.abstained,
        summary.blocked,
        summary.trade_eligible,
        summary.directional,
        JSON.stringify(summary.by_direction || {}),
      ])
    ),
    ""
  );
  lines.push("### Reconciliation", "");
  lines.push(
    ...table(
      ["Model", "Match", "Engine stricter", "Mismatch", "Not published"],
      Object.entries(byModel).map(([role, summary]) => [
        role,
        (summary.reconciling || {}).match,
        (summary.reconciling || {}).engine_stricter,
        (summary.reconciling || {}).mismatch,
        (summary.reconciling || {}).not_published,
      ])
    ),
    ""
  );
  const totals = decisions.reconciliation || {};
  lines.push(`Totals: ${numberLines(totals).join("; ")}.`, "");
  lines.push(...bullets(decisions.notes), "");

  const samples = decisions.samples || {};
  if (samples.blocked) {
    lines.push(
      `Worked blocked morning (${samples.blocked.date}): outcome \`${samples.blocked.outcome}\`, reasons ` +
        `${reasonCodes(samples.blocked.reasons)}.`,
      ""
    );
  }
  if (samples.abstained) {
    lines.push(
      `Worked abstention (${samples.abstained.date}): outcome \`${samples.abstained.outcome}\`, direction ` +
        `${samples.abstained.direction}, band ${text(samples.abstained.band)}, reasons ` +
        `${reasonCodes(samples.abstained.reasons)}.`,
      ""
    );
  }
  return lines;
}

function findingsSection(report) {
  const lines = ["## 4. Findings", ""];
  for (const finding of report.findings || []) {
    lines.push(`### ${finding.id}`, "", finding.claim, "", "Numbers:", "");
    lines.push(...bullets(numberLines(finding.numbers)), "");
    if ((finding.evidence || []).length) {
      lines.push("Evidence:", "");
      lines.push(
        ...bullets(finding.evidence.map((entry) => `\`${entry.path}\`${entry.field ? ` → ${entry.field}` : ""}`))
      );
      lines.push("");
    }
  }
  return lines;
}

function readinessSection(report) {
  const readiness = report.readiness || {};
  const lines = ["## 5. Readiness", ""];
  lines.push(
    "Readiness is whether the declared inputs were present, fresh, clocked and named at the cutoff. It is not the",
    "model's opinion. A blocked morning is a gap in the evidence; an abstention is a book that had the evidence and",
    "declined to call. The two are never merged, here or anywhere above.",
    ""
  );
  lines.push(
    ...table(
      ["Rung", "Passing", "Sessions", "Meaning"],
      (readiness.ladder || []).map((rung) => [rung.rung, rung.passing, rung.sessions, rung.meaning])
    ),
    ""
  );
  lines.push(
    ...table(
      ["Model", "Ready", "Blocked", "Gate", "Note"],
      Object.entries(readiness.by_model || {}).map(([role, entry]) => [
        role,
        entry.ready,
        entry.blocked,
        entry.gate,
        entry.note,
      ])
    ),
    ""
  );
  const codes = readiness.reasons || [];
  if (codes.length) {
    lines.push("Candidate readiness codes:", "");
    lines.push(...bullets(codes.map((entry) => `${entry.value}: ${entry.count} mornings`)), "");
  }
  if ((readiness.datasets || []).length) {
    lines.push("Missing inputs, counted across mornings:", "");
    lines.push(
      ...table(
        ["Field", "Mornings", "Factors that read it"],
        readiness.datasets.map((entry) => [entry.field, entry.mornings, entry.factors])
      ),
      ""
    );
  }
  const worked = readiness.worked_morning;
  if (worked) {
    lines.push(`### Worked blocked morning: ${worked.date}`, "");
    lines.push(`Status \`${worked.status}\` (${worked.code}): ${worked.reason}`, "");
    lines.push(
      `Engine outcome: \`${text(worked.engine_outcome)}\`; blocking checks: ${text(worked.blocked_checks)}.`,
      ""
    );
    lines.push(`Rungs: ${JSON.stringify(worked.rungs)}.`, "");
    lines.push(`Missing fields: ${text(worked.missing)}.`, "");
    lines.push(...bullets(worked.explain), "");
  }
  const contrast = readiness.contrast;
  if (contrast) {
    lines.push(`### Contrast: an abstention on ${contrast.date}`, "");
    lines.push(
      `Direction ${contrast.direction}, band ${contrast.band} (${text(contrast.band_label)}), trade flag ` +
        `${text(contrast.trade)}; checks ${JSON.stringify(contrast.checks)}.`,
      ""
    );
    if (contrast.readiness) {
      lines.push(`Control readiness on the same morning: \`${contrast.readiness.status}\`.`, "");
    }
    if (contrast.explain) lines.push(contrast.explain, "");
  }
  return lines;
}

function exclusions(entry) {
  return (entry.exclusions || []).map((exclusion) => `${exclusion.reason}: ${exclusion.count}`).join("; ");
}

/**
 * A per-model test carries one denominator row per model. A per-market test carries its denominators per market
 * instead, and those are printed beside that market's measures rather than in a second block above them.
 */
function denominatorsLines(denominators) {
  const perModel = denominators.filter((entry) => entry.model);
  if (!perModel.length) return [];
  return [
    ...table(
      ["Model", "Denominator", "Scored", "Exclusions"],
      perModel.map((entry) => [entry.model, entry.definition, entry.scored, exclusions(entry)])
    ),
    "",
  ];
}

/** Index the per-market exclusions so a market's measure row can carry its own exclusion counts. */
function exclusionLookup(denominators) {
  const lookup = new Map();
  for (const entry of denominators || []) {
    if ((entry.by_model || []).length) {
      lookup.set(entry.market, new Map(entry.by_model.map((item) => [item.model, exclusions(item)])));
    }
  }
  return (market, model) => {
    const byModel = lookup.get(market);
    const value = byModel ? byModel.get(model) : null;
    return value === undefined || value === null ? "—" : value;
  };
}

function testDetail(test) {
  const lines = [`### ${test.ordinal}. ${test.label}`, ""];
  lines.push(`Type: ${test.type}. Outcome source: ${test.outcome_source}. Status: ${test.status_label}.`, "");
  lines.push(`Question: ${test.question}`, "");
  lines.push(`Usable sessions: ${text(test.usable_sessions)} of ${text(test.sessions_available)}.`, "");
  if ((test.denominators || []).length) lines.push(...denominatorsLines(test.denominators));
  if ((test.measures || []).length) {
    lines.push(
      ...table(
        ["Model", "Scored", "Hits", "Misses", "Flat", "Accuracy", "Lower bound"],
        test.measures.map((measure) => [
          measure.label,
          measure.scored,
          measure.hits,
          measure.misses,
          measure.flat,
          percent(measure.accuracy_pct),
          percent(measure.lower_bound_pct),
        ])
      ),
      ""
    );
  }
  const exclusionFor = exclusionLookup(test.denominators);
  for (const market of test.markets || []) {
    lines.push(`Market ${market.market}:`, "");
    lines.push(
      ...table(
        ["Model", "Scored", "Hits", "Misses", "Accuracy", "Lower bound", "Exclusions"],
        (market.by_model || []).map((measure) => [
          measure.label,
          measure.scored,
          measure.hits,
          measure.misses,
          percent(measure.accuracy_pct),
          percent(measure.lower_bound_pct),
          exclusionFor(market.market, measure.label),
        ])
      ),
      ""
    );
  }
  if (test.demonstration) {
    const window = test.demonstration.window || {};
    lines.push(`Demonstration only, window ${text(window.first)} to ${text(window.last)}:`, "");
    lines.push(test.demonstration.why_blocked, "");
    const rows = [];
    for (const variant of test.demonstration.by_variant || []) {
      for (const account of variant.accounts || []) {
        rows.push([
          variant.key,
          account.label,
          account.model,
          account.fills,
          account.wins,
          account.losses,
          account.total_r,
        ]);
      }
    }
    if (rows.length) {
      lines.push(...table(["Variant", "Account", "Model", "Fills", "Wins", "Losses", "Total R"], rows), "");
    }
  }
  lines.push(...bullets(test.notes), "");
  return lines;
}

function testsSection(report) {
  const tests = report.tests || {};
  const lines = ["## 6. The four tests", ""];
  lines.push(
    "One question, one denominator, one exclusion list and one measure per model. Every measure prints its",
    "coverage beside it, because a candidate that called on far fewer mornings is not comparable to one that called",
    "on nearly all of them.",
    ""
  );
  lines.push(
    ...table(
      ["#", "Test", "Type", "Status", "Usable", "Available"],
      (tests.tests || []).map((test) => [
        test.ordinal,
        test.label,
        test.type,
        test.status_label,
        test.usable_sessions,
        test.sessions_available,
      ])
    ),
    ""
  );
  for (const test of tests.tests || []) lines.push(...testDetail(test));

  const pair = tests.pair_combination || {};
  lines.push(`### Pair combination: \`${text(pair.status)}\``, "");
  lines.push(pair.definition || "—", "");
  lines.push(`Rejected reading: ${pair.rejected_reading || "—"}`, "");
  lines.push("Why it is not scored:", "");
  lines.push(...bullets(pair.why_unscored), "");
  lines.push("What it needs before scoring:", "");
  lines.push(...bullets(pair.needs_before_scoring), "");
  lines.push(`Owner decision: ${text(pair.owner_decision)}.`, "");
  return lines;
}

function blockersSection(report) {
  const lines = ["## 7. Blockers", ""];
  lines.push(
    ...table(
      ["#", "Blocker", "Detail", "Effect"],
      (report.blockers || []).map((entry) => [entry.id, entry.blocker, entry.detail, entry.effect])
    ),
    ""
  );
  return lines;
}

function openDecisionsSection(report) {
  const lines = ["## 8. Owner decisions", ""];
  lines.push(
    "Five questions were reserved for the decision owner. They are answered here; the answer changes the wording of the",
    "report and the screen, and never changes a stored figure.",
    ""
  );
  for (const entry of report.owner_decisions || []) {
    lines.push(`### ${entry.id} · ${entry.status}`, "", entry.question, "");
    lines.push(`Decision: ${entry.decision}`, "");
    if (entry.effect && entry.effect.length) lines.push(...bullets(entry.effect), "");
    lines.push(`Does not license: ${entry.does_not_license}`, "");
  }
  return lines;
}

function claimsSection(report) {
  return [
    "## 9. What this report does not claim",
    "",
    ...bullets(report.not_claimed),
    "",
    "## 10. Limitations",
    "",
    ...bullets(report.limitations),
    "",
  ];
}

function provenanceSection(report) {
  const provenance = report.provenance || {};
  const lines = ["## Provenance", ""];
  lines.push(
    ...table(
      ["Input", "Bytes", "sha256"],
      (provenance.inputs || []).map((input) => [`\`${input.path}\``, input.bytes, `\`${input.sha256}\``])
    ),
    ""
  );
  lines.push(`Report digest: \`${text(provenance.report_sha256)}\`.`, "");
  lines.push(provenance.note || "", "");
  lines.push(`Reproduce: \`${REPRODUCTION_COMMAND}\`.`, "");
  return lines;
}

/**
 * Render the whole report. The section order is the reading order: what was replayed, who decided, what was
 * found, what the data allowed, what was tested, what blocks the work and what remains undecided.
 */
function renderMarkdown(report) {
  if (!report || report.schema_version !== SCHEMA_VERSION) {
    throw new Error(`markdown: expected a ${SCHEMA_VERSION} report`);
  }
  const lines = [
    `# ${report.title}`,
    "",
    `Schema \`${report.schema_version}\`, research only, generated from the stored artefacts on ` +
      `\`${text(report.generated_at)}\`.`,
    "",
    `> ${report.claim}`,
    "",
    "Every figure below is built by `lib/layer1_backtesting/` from the artefacts named in the provenance block;",
    "none is typed in by hand. A figure that could not be derived is printed as a dash, never filled in.",
    "",
    ...scopeSection(report),
    ...modelsSection(report),
    ...decisionsSection(report),
    ...findingsSection(report),
    ...readinessSection(report),
    ...testsSection(report),
    ...blockersSection(report),
    ...openDecisionsSection(report),
    ...claimsSection(report),
    ...provenanceSection(report),
  ];
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

module.exports = { renderMarkdown, REPRODUCTION_COMMAND };




