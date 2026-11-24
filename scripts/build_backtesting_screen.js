#!/usr/bin/env node
/**
 * Build the Backtesting screen payload from the published artefacts.
 *
 * Usage:
 *   node scripts/build_backtesting_screen.js           write data/usd-layer1-backtester/backtesting-screen-v1.json
 *   node scripts/build_backtesting_screen.js --check   rebuild and compare with the committed payload
 *   node scripts/build_backtesting_screen.js --print   print the summary only, write nothing
 *
 * The page renders this file and nothing else, so a figure on screen is a figure in the payload. Research only.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { createModels } = require("../lib/layer1_backtesting/models");
const { buildReport, runDecisions } = require("../lib/layer1_backtesting/report");
const { buildReadiness } = require("../lib/layer1_backtesting/readiness");
const { buildScreen } = require("../lib/layer1_backtesting/screen");
const { proposedFlatBands } = require("../lib/layer1_backtesting/flat_bands");
const { verifyRequestedPackage, reviewAdjudications } = require("../lib/layer1_backtesting/package_identity");
const { loadPackage, verifyPackage, PACKAGE_ROOT } = require("../lib/layer1_backtesting/h1_package");
const { buildH1Coverage } = require("../lib/layer1_backtesting/h1_coverage");
const {
  buildH1Model,
  buildFixtureControl,
  runH1Fixtures,
  decideH1Historical,
  auditH1,
} = require("../lib/layer1_backtesting/h1_candidate");
const { buildH1Review } = require("../lib/layer1_backtesting/h1_review");
const { h1ScoringContract } = require("../lib/layer1_backtesting/scoring_contract");
const { buildMorningRun, REACH_SUMMARY_PATH } = require("../lib/layer1_backtesting/morning_run");
const { canonicalText, hashTextFile, sha256, stableStringify } = require("../lib/layer1_backtesting/engine");

const ROOT = path.resolve(__dirname, "..");
const RUN_PATH = "data/usd-layer1-backtester/run-v1.json";
const ENGINE_PATH = "data/usd-layer1-backtester/engine-v1.json";
const OUT_PATH = "data/usd-layer1-backtester/backtesting-screen-v1.json";

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}

function sourceEntry(relative) {
  const buffer = fs.readFileSync(path.join(ROOT, relative));
  return { path: relative, ...hashTextFile(buffer) };
}

function build() {
  const run = readJson(RUN_PATH);
  const engine = readJson(ENGINE_PATH);
  const book = readJson("config/usd_l1_factor_rulebook_v1.json");
  const rules = readJson("config/usd_l1_decision_rules_v1.json");
  const h1Package = loadPackage({ root: ROOT });
  const h1PackageInfo = verifyPackage({ root: ROOT });
  const h1Model = buildH1Model({ packageModel: h1Package.models });
  const h1Control = buildFixtureControl({ packageModel: h1Package.models });
  const h1Coverage = buildH1Coverage({
    run,
    packageInputs: h1Package.inputs,
    calendar: readJson("data/usd-layer1-backtester/event-calendar-v1.json"),
    packageInfo: h1PackageInfo,
    rows: h1Package.rows,
    root: ROOT,
  });
  const h1Fixtures = runH1Fixtures({ root: ROOT, models: { h1: h1Model, fixtureControl: h1Control } });
  const h1Historical = decideH1Historical({
    run,
    coverage: h1Coverage,
    model: h1Model,
    rulebookDigest: h1PackageInfo.declared_hashes.rulebook_sha256,
  });
  const h1Audit = auditH1({
    records: h1Historical.records,
    ledger: h1Historical.ledger,
    coverage: h1Coverage,
    model: h1Model,
    sessions: (run.sessions || []).length,
  });
  const h1Review = buildH1Review({
    packageRoot: path.join(ROOT, PACKAGE_ROOT),
    rows: h1Package.rows,
    inputs: h1Package.inputs,
  });
  const morningRun = buildMorningRun({ root: ROOT, run, engine, coverage: h1Coverage });
  const models = createModels({ run, engine, h1: h1Model });
  const generatedAt = (run.run && run.run.generated_at) || run.generated_at || engine.source_generated_at || null;
  const sources = [
    RUN_PATH,
    ENGINE_PATH,
    "config/usd_l1_factor_rulebook_v1.json",
    "config/usd_l1_decision_rules_v1.json",
    "data/research-library/catalog.json",
    "data/usd-layer1-backtester/event-calendar-v1.json",
    REACH_SUMMARY_PATH,
    `${PACKAGE_ROOT}/RULEBOOK.md`,
    `${PACKAGE_ROOT}/inputs.json`,
    `${PACKAGE_ROOT}/expected.json`,
    `${PACKAGE_ROOT}/models.js`,
    `${PACKAGE_ROOT}/rows.json`,
    `${PACKAGE_ROOT}/SHA256SUMS`,
  ]
    .filter((relative) => fs.existsSync(path.join(ROOT, relative)))
    .map(sourceEntry);

  const report = buildReport({ run, engine, models, generated_at: generatedAt, sources });
  const decisions = runDecisions({ run, engine, models });
  const readiness = buildReadiness({ run, engine });
  const flatBands = proposedFlatBands({ run, frozen_at: engine.book_detail && engine.book_detail.frozen_on });
  // The market x test matrix as the page shows it: the selection, its fingerprint and one row per market per
  // test, with each blocked combination naming the dataset it is missing. Read from the artefact, never
  // recomputed here, so the dashboard cannot disagree with the run.
  const matrixBlock = run.market_matrix && run.market_matrix.readiness
    ? {
        id: run.market_matrix.id,
        fingerprint: run.market_matrix.fingerprint,
        primary_market: run.market_matrix.primary_market,
        additional_markets: run.market_matrix.additional_markets,
        market_count: run.market_matrix.market_count,
        test_count: run.market_matrix.test_count,
        combination_count: run.market_matrix.combination_count,
        tests: (run.market_matrix.tests || []).map((test) => ({ id: test.id, label: test.label, ordinal: test.ordinal })),
        counts: run.market_matrix.readiness.run_counts || run.market_matrix.readiness.counts,
        rows: (run.market_matrix.readiness.rows || []).map((row) => ({
          market: row.market,
          label: row.label,
          role: row.role,
          broker_symbol: row.broker_symbol,
          broker_symbol_confirmed: row.broker_symbol_confirmed,
          tests: Object.fromEntries(
            Object.entries(row.tests || {}).map(([id, entry]) => [
              id,
              {
                status: entry.status,
                reason: entry.reason || null,
                scored: entry.scored === undefined ? null : entry.scored,
                sessions_with_tape_and_ladder: entry.sessions_with_tape_and_ladder === undefined ? null : entry.sessions_with_tape_and_ladder,
                // The three data axes kept apart: the levels, the tape and the sessions they share. A blocked
                // cell can then say which of the three is missing instead of the page guessing at one.
                sessions: entry.sessions || null,
                blockers: entry.blockers || null
              }
            ])
          )
        })),
        note:
          "every selected market receives the same three tests; a blocked combination names the missing dataset " +
          "and is never shown as a scored zero"
      }
    : null;
  const packageInfo = verifyRequestedPackage({ root: ROOT });
  const mapping = reviewAdjudications({
    book,
    rules,
    requirementTable: (run.validity_gate && run.validity_gate.requirement_table) || [],
    coverage: run.coverage && run.coverage.by_model,
  });
  const h1 = {
    model: {
      id: h1Model.id,
      label: h1Model.label,
      role: h1Model.role,
      version: h1Model.version,
      rulebook_version: h1Model.rulebook_version,
      session: h1Model.session,
      identity: h1Model.identity(),
      input_spec: h1Model.input_spec,
      evidence: h1Model.evidence,
      executable_entry_points: [
        "lib/layer1_backtesting/engine.js#decide",
        "lib/layer1_backtesting/h1_candidate.js#buildH1Model",
        "lib/layer1_backtesting/h1_coverage.js#buildH1Coverage",
      ],
    },
    package: {
      requested: h1PackageInfo.requested,
      status: h1PackageInfo.status,
      verification: h1PackageInfo.verification,
      verified_on: h1PackageInfo.verified_on,
      package: h1PackageInfo.package,
      archive: h1PackageInfo.archive,
      declared_hashes: h1PackageInfo.declared_hashes,
      internal_checksums: {
        manifest: h1PackageInfo.internal_checksums.manifest,
        declared: h1PackageInfo.internal_checksums.declared,
        verified: h1PackageInfo.internal_checksums.verified,
        mismatches: h1PackageInfo.internal_checksums.mismatches,
      },
      acceptance: h1PackageInfo.acceptance,
      contents: h1PackageInfo.contents,
      consequence: h1PackageInfo.consequence,
      source: h1PackageInfo.source,
    },
    fixtures: h1Fixtures,
    review: h1Review,
    coverage: h1Coverage,
    historical: {
      ...h1Historical.summary,
      rows: h1Historical.rows,
      ledger: h1Historical.ledger_view,
    },
    audit: h1Audit,
    scoring_contract: h1ScoringContract({ h1Review, h1Coverage, flatBands, h1PackageInfo }),
  };

  const body = buildScreen({
    report,
    run,
    engine,
    models,
    decisions,
    readiness,
    tests: report.tests,
    generatedAt,
    flatBands,
    marketMatrix: matrixBlock,
    packageInfo,
    mapping,
    h1,
    morningRun,
    root: ROOT,
  });
  const digest = sha256(stableStringify(body));
  return {
    ...body,
    provenance: {
      inputs: sources,
      report_sha256: report.provenance ? report.provenance.report_sha256 : null,
      screen_sha256: digest,
      note: "The digest is taken over the body before this block. Rebuilding the screen from the same artefacts reproduces it.",
    },
  };
}

function summary(screen) {
  const lines = [];
  lines.push(`${screen.title} (${screen.schema_version})`);
  lines.push(`${screen.summary.sessions} mornings · ${screen.summary.first_date} to ${screen.summary.last_date}`);
  lines.push(
    `strict ready: control ${screen.summary.readiness.strict_ready_control} · candidate ${screen.summary.readiness.strict_ready_candidate} · narrow control ${screen.summary.readiness.narrow_ready_control}`
  );
  lines.push(
    `book: allowed ${screen.summary.readiness.book_allowed_candidate} · abstained ${screen.summary.readiness.book_abstained_candidate} · blocked ${screen.summary.readiness.book_blocked_candidate}`
  );
  lines.push(`package: ${screen.package_identity.requested} ${screen.package_identity.status}`);
  if (screen.h1) {
    lines.push(`h1: ${screen.h1.model.version} · coverage ready ${screen.h1.coverage.ready}/${screen.h1.coverage.scheduled} · fixtures ${screen.h1.fixtures.status}`);
  }
  if (screen.morning_run) {
    const morning = screen.morning_run;
    lines.push(
      `morning ${morning.date}: strict ${morning.strict_evidence.ready ? "ready" : "blocked"} | current ${morning.models.current.direction} ${morning.models.current.conviction} | H1 ${morning.models.h1.outcome}`
    );
  }
  lines.push(`mapping: ${screen.mapping_review.verdict}`);
  lines.push(
    `gap: ${screen.summary.biggest_gap ? `${screen.summary.biggest_gap.field} ${screen.summary.biggest_gap.mornings}/${screen.summary.biggest_gap.sessions}` : "none"}`
  );
  lines.push(`ledger: ${screen.ledger.saves} saves · ${screen.ledger.duplicates} references · ${screen.ledger.conflicts} conflicts`);
  lines.push(`audit missing input: ${screen.audit.missing_input ? screen.audit.missing_input.caught : false}`);
  lines.push(`audit wrong version: ${screen.audit.wrong_version ? screen.audit.wrong_version.caught : false}`);
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const check = argv.includes("--check");
  const printOnly = argv.includes("--print");
  const screen = build();
  const text = `${JSON.stringify(screen, null, 2)}\n`;
  const target = path.join(ROOT, OUT_PATH);

  if (printOnly) {
    process.stdout.write(summary(screen));
    return 0;
  }
  if (check) {
    if (!fs.existsSync(target)) {
      process.stderr.write(`missing ${OUT_PATH}; run node scripts/build_backtesting_screen.js\n`);
      return 1;
    }
    if (canonicalText(fs.readFileSync(target, "utf8")) !== canonicalText(text)) {
      process.stderr.write(`${OUT_PATH} differs from a fresh build; rerun the builder\n`);
      return 1;
    }
    process.stdout.write(`screen reproduces: ${screen.provenance.screen_sha256}\n`);
    return 0;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, "utf8");
  process.stdout.write(summary(screen));
  process.stdout.write(`wrote ${OUT_PATH} (${screen.provenance.screen_sha256})\n`);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { build, summary, OUT_PATH };
