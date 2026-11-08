"use strict";

/**
 * Run the USD Layer 1 backtester and write the panel artefact (research only, 2026-11-08).
 *
 * Two separate operations, on purpose:
 *
 *   1. `node backtester/scripts/run_usd_layer1_backtest.js`
 *      rebuilds the artefact and writes it into the ignored research folder. Nothing outside
 *      `backtester/tmp/usd-session-research/` can be written by this mode; the path guard refuses.
 *
 *   2. the same command with `--publish`
 *      copies that verified artefact to `data/usd-layer1-backtester/run-v1.json`, which is the file the
 *      dashboard panel reads. Publishing is an explicit act, it prints both hashes, and it never touches a
 *      live trader, an order-routing workflow, a workflow control file or a published Layer 1/2 snapshot.
 *
 * Nothing here reads the network, the warehouse or the dispatcher.
 */

const fs = require("node:fs");
const path = require("node:path");

const { assertResearchPath, REPO_ROOT, ALLOWED_ROOT } =
  require("./lib/research_path_guard");
const { sha256 } = require("../lib/usd_layer1_backtester/inputs");
const { buildArtefact } = require("../lib/usd_layer1_backtester/run");
const contracts = require("../lib/usd_layer1_backtester/contracts");

const DEFAULT_OUT = path.join(ALLOWED_ROOT, "layer1-backtester", "run-v1.json");
const PUBLISH_PATH = path.join(REPO_ROOT, "data", "usd-layer1-backtester", "run-v1.json");

function parseArgs(argv) {
  const options = { out: DEFAULT_OUT, publish: false, generatedAt: null, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${token} needs a value`);
      return argv[index];
    };
    if (token === "--out") options.out = path.resolve(next());
    else if (token === "--publish") options.publish = true;
    else if (token === "--generated-at") options.generatedAt = next();
    else if (token === "--quiet") options.quiet = true;
    else throw new Error(`unknown argument ${token}`);
  }
  return options;
}

/** Refuse to publish an artefact that is not the shape the panel renders. */
function assertPublishable(artefact) {
  const problems = [];
  if (artefact.schema_version !== contracts.SCHEMA_VERSION) problems.push("schema_version");
  if (artefact.north_star !== contracts.NORTH_STAR_TEXT) problems.push("north_star");
  if (!Array.isArray(artefact.sessions) || !artefact.sessions.length) problems.push("sessions");
  for (const test of contracts.TESTS) {
    if (!artefact.tests || !artefact.tests[test.id]) problems.push(`tests.${test.id}`);
  }
  if (!artefact.progress || !artefact.coverage) problems.push("progress/coverage");
  if (!artefact.provenance || !Array.isArray(artefact.provenance.inputs)) problems.push("provenance");
  if (problems.length) {
    throw new Error(`refusing to publish: the artefact is missing or wrong in ${problems.join(", ")}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const artefact = buildArtefact({ rootDir: REPO_ROOT, generatedAt: options.generatedAt || undefined });

  const outPath = assertResearchPath(options.out, "run_usd_layer1_backtest");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const text = `${JSON.stringify(artefact)}\n`;
  fs.writeFileSync(outPath, text, "utf8");

  const research = { path: outPath, bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text, "utf8")) };
  const summary = {
    research_copy: research,
    sessions: artefact.sessions.length,
    date_range: artefact.run.date_range,
    stage: artefact.progress.current_stage_detail,
    calls: {
      current: artefact.coverage.by_model.current.calls_reconstructed,
      challenger: artefact.coverage.by_model.challenger.calls_reconstructed
    },
    test2_challenger_eurusd: artefact.tests.four_markets.models.challenger.markets.EURUSD.overall,
    published: null
  };

  if (options.publish) {
    assertPublishable(artefact);
    fs.mkdirSync(path.dirname(PUBLISH_PATH), { recursive: true });
    fs.writeFileSync(PUBLISH_PATH, text, "utf8");
    const publishedText = fs.readFileSync(PUBLISH_PATH, "utf8");
    const publishedHash = sha256(Buffer.from(publishedText, "utf8"));
    if (publishedHash !== research.sha256) {
      throw new Error("the published copy does not hash to the research copy; the publish step is not trusted");
    }
    summary.published = {
      path: path.relative(REPO_ROOT, PUBLISH_PATH).replace(/\\/g, "/"),
      bytes: Buffer.byteLength(publishedText, "utf8"),
      sha256: publishedHash
    };
  }

  if (!options.quiet) {
    console.log(JSON.stringify(summary, null, 2));
  }
  return summary;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs, assertPublishable, DEFAULT_OUT, PUBLISH_PATH };
