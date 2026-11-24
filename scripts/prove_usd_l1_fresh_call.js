#!/usr/bin/env node
"use strict";

/**
 * Prove that the deployed n8n Cloud child path computes a call instead of reading one, and leave one
 * inspectable end-to-end call behind.
 *
 *   node scripts/prove_usd_l1_fresh_call.js [--dates 2024-01-10,2024-03-26] [--write | --check]
 *
 * The claim under test is narrow and checkable: the child receives one morning's row, and the direction,
 * conviction, eligibility and per-market result it returns are a function of that row's cutoff-time factor
 * values and the realised outcomes, not of a stored prediction. To test it the script:
 *
 *   1. runs the committed parent glue in order - `usd-l1-parent-config.js`, `usd-l1-parent-select.js`,
 *      `usd-l1-parent-bind.js` - with the HTTP node replaced by a local read of `run-v1.json`, so the child
 *      receives exactly the payload the deployed parent would bind;
 *   2. strips `models` and `results` (and, in the call case, `outcomes`) from the row, then scans the payload
 *      for any surviving prediction field and reports every path it found;
 *   3. runs the committed child wrapper `usd-l1-child-wrapper.js` against the checked-in Cloud bundle
 *      (`automation/n8n/usd-l1-cloud-runtime.js`, the file whose sha256 the manifest pins as deployed);
 *   4. compares the returned call with the published record, and re-runs the same morning with one saved
 *      input negated at a time to show the call moves when the inputs move.
 *
 * What it establishes: the child recomputes, and - when `data/usd-layer1-backtester/n8n/fresh-call-live-v1.json`
 * is present - the one Cloud execution captured by `scripts/capture_usd_l1_fresh_call.js` returned the same
 * call and the same per-market results as this recomputation. What it does not: any accuracy, edge or
 * deployment-wide claim. The rehearsal itself spends no Cloud execution; the capture script spends exactly
 * one and writes down the parent and child execution ids.
 *
 * Research only. It reads committed files; it never calls the network, n8n, a broker or an account.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const builder = require("./build_usd_l1_n8n_cloud_workflows");
const registry = require("../backtester/lib/usd_layer1_backtester/model_registry");

const ROOT = path.resolve(__dirname, "..");
const RUN_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "run-v1.json");
const OUT_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "n8n", "fresh-call-v1.json");
const TEMPLATE_DIR = path.join(ROOT, "automation", "n8n", "templates");
const MANIFEST_PATH = path.join(ROOT, "automation", "n8n", "usd-l1-cloud-workflows.manifest.json");
const BUNDLE_PATH = path.join(ROOT, "automation", "n8n", "usd-l1-cloud-runtime.js");
const LIVE_PATH = path.join(ROOT, "data", "usd-layer1-backtester", "n8n", "fresh-call-live-v1.json");

const DEFAULT_DATES = Object.freeze(["2024-01-10", "2024-03-26"]);

/**
 * Field names that would mean the row carried a call.
 *
 * `outcomes` is deliberately not in this list: it is the realised move the call is scored against, not the
 * call, and one case keeps it so that scoring can be shown to be recomputed from it. Its own `direction`
 * keys are the target's direction over the session horizon, so the scan does not walk into that block -
 * `SCORING_TARGET_KEYS` records the exception rather than loosening the list.
 */
const PREDICTION_KEYS = Object.freeze([
  "models",
  "results",
  "direction",
  "conviction",
  "conviction_raw",
  "direction_label",
  "call",
  "prediction",
  "predicted_direction",
  "eligible",
  "eligibility"
]);

const PREDICTION_KEY_SET = new Set(PREDICTION_KEYS);

/** Blocks that hold the scoring target. Their contents are the realised outcome, not a stored answer. */
const SCORING_TARGET_KEYS = Object.freeze(["outcomes"]);

const SCORING_TARGET_SET = new Set(SCORING_TARGET_KEYS);


function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function parseArgs(argv) {
  const args = { dates: DEFAULT_DATES.slice(), write: false, check: false, createdAt: null };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dates") args.dates = String(argv[(index += 1)]).split(",").map((entry) => entry.trim()).filter(Boolean);
    else if (token === "--write") args.write = true;
    else if (token === "--check") args.check = true;
    else if (token === "--generated-at") args.createdAt = argv[(index += 1)];
    else throw new Error(`unknown argument ${token}`);
  }
  if (args.write && args.check) throw new Error("choose --write or --check, not both");
  return args;
}

/** The n8n node scope the templates run inside, reduced to what they actually call. */
function n8nScope({ nodes, execution, workflow }) {
  const $ = (name) => {
    if (!(name in nodes)) throw new Error(`the rehearsal has no output for node "${name}"`);
    const json = nodes[name];
    return { first: () => ({ json }), all: () => [{ json }] };
  };
  return { $, execution, workflow };
}

/**
 * Execute a committed n8n code node verbatim. The templates are plain JavaScript against `$`, `$input`,
 * `$execution` and `$workflow`; providing those four is the whole harness.
 */
function runNodeCode(code, { input, nodes = {}, execution = {}, workflow = {} }) {
  const scope = n8nScope({ nodes, execution, workflow });
  const $input = {
    first: () => ({ json: input }),
    all: () => [{ json: input }],
    last: () => ({ json: input })
  };
  // `new Function` gives the template its own function body, which is why its top-level `return` works.
  const fn = new Function("$", "$input", "$execution", "$workflow", code);
  return fn(scope.$, $input, execution, workflow);
}

/** Config -> select -> bind, exactly as the deployed parent orders them. */
function executeParent({ dataset, body, runtime, registryDoc }) {
  const nodes = {};
  const execution = { id: "local-rehearsal", mode: "rehearsal" };
  const workflow = { id: "local-rehearsal", name: "USD Layer 1 - paired controller (Cloud)" };

  const configCode = read("automation/n8n/templates/usd-l1-parent-config.js").replace(
    "__MODEL_REGISTRY__",
    JSON.stringify(registryDoc)
  );
  const config = runNodeCode(configCode, { input: { body }, execution, workflow })[0].json;
  nodes["Run configuration"] = config;

  const selectCode = read("automation/n8n/templates/usd-l1-parent-select.js");
  // The HTTP Request node is the one part of the parent a rehearsal cannot run; the dataset it would have
  // fetched is handed to the select node as that node's input instead.
  const selected = runNodeCode(selectCode, { input: { data: dataset }, nodes, execution, workflow });
  nodes["Select one saved morning"] = selected[0] ? selected[0].json : null;

  const bound = [];
  for (const model of config.models) {
    const bindCode = read("automation/n8n/templates/usd-l1-parent-bind.js").replace("__MODEL__", model);
    for (const item of runNodeCode(bindCode, { input: selected[0] ? selected[0].json : {}, nodes, execution, workflow })) {
      bound.push(item.json);
    }
  }

  const childCode = read("automation/n8n/templates/usd-l1-child-wrapper.js").replace("__MODEL__", "__MODEL_SENTINEL__");
  return { config, selected: selected.map((item) => item.json), bound, childCode, execution, workflow, runtime };
}

/** Run the child wrapper for one bound item, with the runtime it loads from `globalThis` in Cloud. */
function executeChild({ childCode, boundItem, model, execution, workflow }) {
  const code = childCode.replace("__MODEL_SENTINEL__", model);
  const output = runNodeCode(code, { input: boundItem, execution, workflow });
  const json = output[0].json;
  // A rehearsal has no Cloud execution to point at, so the wrapper's execution fields are removed rather
  // than recorded as if they were real.
  const { execution_id, execution_url, workflow_id, workflow_name, ...rest } = json;
  return { result: rest, wrapper_fields: { execution_id, execution_url, workflow_id, workflow_name } };
}

/**
 * Every path in the payload whose key would be a stored call. The scoring-target blocks are skipped whole:
 * `outcomes.EURUSD.direction` is what happened, not what the model said would happen.
 */
function findPredictionFields(value, prefix = "", hits = []) {
  if (!value || typeof value !== "object") return hits;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findPredictionFields(entry, `${prefix}[${index}]`, hits));
    return hits;
  }
  for (const [key, child] of Object.entries(value)) {
    const here = prefix ? `${prefix}.${key}` : key;
    if (SCORING_TARGET_SET.has(key)) continue;
    if (PREDICTION_KEY_SET.has(key)) hits.push(here);
    else findPredictionFields(child, here, hits);
  }
  return hits;
}
/** A row reduced to what a decision may read: factor values, their stamps, the cutoff and the outcomes. */
function stripSession(session, { keepOutcomes }) {
  const copy = JSON.parse(JSON.stringify(session));
  delete copy.models;
  delete copy.results;
  delete copy.outcomes;
  if (keepOutcomes) copy.outcomes = JSON.parse(JSON.stringify(session.outcomes || {}));
  return copy;
}

function datasetFor({ run, sessions }) {
  return {
    schema_version: run.schema_version,
    generated_at: run.generated_at,
    run: { run_version: run.run.run_version, markets: run.run.markets },
    market_matrix: run.market_matrix,
    input_source_legend: run.input_source_legend || [],
    sessions
  };
}

function callOf(decision) {
  const call = decision.call || {};
  return {
    direction: call.direction === undefined ? null : call.direction,
    direction_label: call.direction_label === undefined ? null : call.direction_label,
    conviction: call.conviction === undefined ? null : call.conviction,
    reason: call.reason === undefined ? null : call.reason
  };
}

function sortedMap(value) {
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
}

function parentDatasetUrl() {
  return "https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/data/usd-layer1-backtester/run-v1.json";
}

/** Negate one saved value and re-run the child runtime; a call that never moves is not derived from inputs. */
function sensitivity({ run, session, date, model, baseline, keys, runtime }) {
  const probes = [];
  const saved = session.saved_inputs || {};
  for (const key of keys) {
    const original = saved[key];
    if (typeof original !== "number" || !Number.isFinite(original)) continue;
    const mutated = JSON.parse(JSON.stringify(stripSession(session, { keepOutcomes: false })));
    mutated.saved_inputs[key] = original === 0 ? 1 : -original;
    const dataset = datasetFor({ run, sessions: [mutated] });
    const result = runtime.evaluateOne({
      date,
      model,
      validation: "structural",
      session: dataset.sessions[0],
      dataset_meta: {
        path: "run-v1.json",
        schema_version: dataset.schema_version,
        run_version: dataset.run.run_version,
        generated_at: dataset.generated_at,
        markets: dataset.run.markets,
        market_matrix: dataset.market_matrix,
        input_source_legend: dataset.input_source_legend
      }
    });
    const call = callOf(result.decision);
    const changed = call.direction !== baseline.direction || call.conviction !== baseline.conviction;
    probes.push({ input: key, was: original, now: mutated.saved_inputs[key], direction: call.direction, conviction: call.conviction, changed });
  }
  return probes;
}

/**
 * The one call the deployed pair actually made, matched against the same morning recomputed here. A live
 * capture that disagrees is a blocking finding rather than a note: it would mean the deployed child is not
 * the code this record pins.
 */
function liveBlock({ live, cases }) {
  if (!live) {
    return {
      status: "not_captured",
      note: "no Cloud execution is recorded; run node scripts/capture_usd_l1_fresh_call.js --date <YYYY-MM-DD> to spend one"
    };
  }
  const index = new Map(cases.filter((entry) => entry.case === "call_and_scoring").map((entry) => [`${entry.date}|${entry.model}`, entry]));
  const calls = (live.calls || []).map((seen) => {
    const matching = index.get(`${seen.date}|${seen.model}`) || null;
    const agrees = Boolean(matching)
      && matching.recomputed.direction === seen.direction
      && matching.recomputed.conviction === seen.conviction
      && JSON.stringify(sortedMap(matching.results || {})) === JSON.stringify(sortedMap(seen.results || {}));
    return {
      date: seen.date,
      model: seen.model,
      live: { direction: seen.direction, conviction: seen.conviction, status: seen.status, results: seen.results },
      recomputed: matching
        ? { direction: matching.recomputed.direction, conviction: matching.recomputed.conviction, status: matching.status, results: matching.results }
        : null,
      agrees
    };
  });
  return {
    status: "captured",
    captured_at: live.captured_at,
    instance_base_url: live.instance.base_url,
    workflow: live.workflow,
    execution: live.execution,
    request: live.request,
    capture_file: live.capture_file,
    capture_sha256: live.capture_sha256,
    child_executions: (live.calls || []).map((entry) => ({
      model: entry.model,
      workflow_id: entry.child_workflow_id,
      execution_id: entry.child_execution_id,
      execution_url: entry.child_execution_url
    })),
    calls,
    agrees_with_recomputation: calls.length > 0 && calls.every((entry) => entry.agrees)
  };
}

function buildRecord({ run, dates, createdAt }) {
  const registryDoc = builder.registryDocument();
  const runtime = require(BUNDLE_PATH);
  globalThis.UsdL1CloudRuntime = runtime;
  const manifest = readJson(MANIFEST_PATH);
  const parentWorkflow = readJson(path.join(ROOT, manifest.parent.file));
  const live = fs.existsSync(LIVE_PATH) ? readJson(LIVE_PATH) : null;
  const byDate = new Map((run.sessions || []).map((session) => [session.date, session]));
  const models = registry.DEFAULT_SELECTION.filter((key) => {
    const entry = registry.getModel(key);
    return entry && entry.cloud;
  });
  const cases = [];
  const sensitivityBlock = [];
  const payloads = [];

  for (const date of dates) {
    const session = byDate.get(date);
    if (!session) throw new Error(`run-v1.json has no session for ${date}`);
    for (const caseId of ["call_only", "call_and_scoring"]) {
      const keepOutcomes = caseId === "call_and_scoring";
      const stripped = stripSession(session, { keepOutcomes });
      for (const model of models) {
        const dataset = datasetFor({ run, sessions: [stripped] });
        const parent = executeParent({
          dataset,
          body: { dates: [date], models: [model], validation: "structural", dataset_url: parentDatasetUrl() },
          runtime,
          registryDoc
        });
        const boundItem = parent.bound.find((item) => item.model === model);
        if (!boundItem) throw new Error(`the bind node produced no item for ${model}`);
        const child = executeChild({
          childCode: parent.childCode,
          boundItem,
          model,
          execution: parent.execution,
          workflow: parent.workflow
        });
        const decision = child.result.decision || {};
        const recomputed = callOf(decision);
        const published = session.models[model] || {};
        const publishedCall = {
          direction: published.direction === undefined ? null : published.direction,
          direction_label: published.direction_label === undefined ? null : published.direction_label,
          conviction: published.conviction === undefined ? null : published.conviction
        };
        const publishedResults = keepOutcomes ? (session.results || {})[model] || null : null;
        const recomputedResults = decision.results || null;
        const scoringMatches = keepOutcomes
          ? JSON.stringify(sortedMap(publishedResults)) === JSON.stringify(sortedMap(recomputedResults))
          : null;
        const payload = boundItem.session || {};
        const forbidden = findPredictionFields(payload);
        if (payloads.length < models.length) {
          payloads.push({
            date,
            model,
            case: caseId,
            child_input_keys: Object.keys(boundItem).sort(),
            session_keys: Object.keys(payload).sort(),
            dataset_meta_keys: Object.keys(boundItem.dataset_meta || {}).sort(),
            prediction_fields_present: forbidden,
            not_scanned: SCORING_TARGET_KEYS.slice()
          });
        }
        cases.push({
          date,
          model,
          case: caseId,
          cutoff_at_utc: payload.cutoff_at_utc || null,
          published: publishedCall,
          recomputed,
          status: decision.status || null,
          validation_accepted: decision.validation ? decision.validation.accepted : null,
          results: recomputedResults,
          published_results: publishedResults,
          matches_published_call:
            publishedCall.direction === recomputed.direction && publishedCall.conviction === recomputed.conviction,
          scoring_recomputed_from_outcomes: scoringMatches,
          prediction_fields_present: forbidden,
          bundle_version: child.result.bundle_version,
          bundle_sha256: child.result.bundle_sha256
        });
        if (caseId === "call_only") {
          sensitivityBlock.push({
            date,
            model,
            baseline: { direction: recomputed.direction, conviction: recomputed.conviction },
            probes: sensitivity({
              run,
              session,
              date,
              model,
              baseline: recomputed,
              keys: Object.keys(session.saved_inputs || {}),
              runtime
            })
          });
        }
      }
    }
  }
  return assemble({ run, createdAt, manifest, parentWorkflow, cases, sensitivityBlock, payloads, live });
}

/** The record the proof writes: the verdict, every case, the payload inspection and the probes. */
function assemble({ run, createdAt, manifest, parentWorkflow, cases, sensitivityBlock, payloads, live }) {
  const everyCallMatches = cases.every((entry) => entry.matches_published_call === true);
  const everyPayloadClean = cases.every((entry) => entry.prediction_fields_present.length === 0);
  const scoringCases = cases.filter((entry) => entry.case === "call_and_scoring");
  const everyScoreMatches = scoringCases.every((entry) => entry.scoring_recomputed_from_outcomes === true);
  const probes = sensitivityBlock.flatMap((entry) => entry.probes);
  const moved = probes.filter((probe) => probe.changed);
  const callMovedWithInputs = moved.length > 0;
  const liveCall = liveBlock({ live, cases });
  const liveAgrees = liveCall.status === "captured" ? liveCall.agrees_with_recomputation : null;
  const blocking = [];
  if (!everyCallMatches) blocking.push("a recomputed call disagreed with the published record");
  if (!everyPayloadClean) blocking.push("the child payload still carried a prediction field");
  if (!everyScoreMatches) blocking.push("a recomputed per-market result disagreed with the published record");
  if (!callMovedWithInputs) blocking.push("no single input change moved the call, so the call is not shown to be derived");
  if (liveAgrees === false) blocking.push("the deployed pair returned a call or a per-market result that the same morning does not reproduce here");

  return {
    schema_version: "usd-l1-fresh-call-proof-v1",
    created_at: createdAt,
    research_only: true,
    question:
      "does the n8n Cloud child compute direction, conviction, eligibility and the per-market result from the morning's cutoff inputs, or read a stored prediction?",
    answer:
      blocking.length === 0
        ? "it computes them: the child returns the same call and the same per-market results with `models` and `results` removed from the row, and the call moves when one saved input is negated"
          + (liveAgrees
            ? `; the one captured Cloud execution (${liveCall.execution.id}) returned the same call and the same per-market results`
            : "")
        : `not established: ${blocking.join("; ")}`,
    verdict: {
      status: blocking.length === 0 ? "recomputed_from_cutoff_inputs" : "unverified",
      child_computes_call: everyCallMatches,
      payload_carried_no_prediction: everyPayloadClean,
      scoring_recomputed_from_outcomes: everyScoreMatches,
      call_changed_when_an_input_changed: callMovedWithInputs,
      live_call_agrees_with_recomputation: liveAgrees,
      blocking
    },
    source: {
      file: rel(RUN_PATH),
      sha256: sha256(fs.readFileSync(RUN_PATH)),
      generated_at: run.generated_at,
      run_version: run.run.run_version,
      market_matrix_fingerprint: run.run.market_matrix_fingerprint || null,
      sessions_in_dataset: (run.sessions || []).length
    },
    deployed_identity: {
      bundle_version: manifest.bundle_version,
      bundle_sha256: manifest.bundle_sha256,
      bundle_bytes: manifest.bundle_bytes,
      source_files: manifest.source_files.map((entry) => entry.path || entry),
      parent_workflow_id: parentWorkflow.id || (live && live.workflow ? live.workflow.id : null),
      parent_workflow_id_source: parentWorkflow.id
        ? "the committed workflow file"
        : live && live.workflow
          ? `the captured execution ${live.execution.id}`
          : null,
      parent_workflow_name: manifest.parent.name,
      parent_webhook_path: manifest.parent.webhook_path,
      child_workflows: manifest.children.map((child) => ({
        model: child.model,
        workflow_id: child.workflow_id,
        name: child.name
      }))
    },
    rehearsal: {
      execution_context: "local: the committed parent nodes and child wrapper were executed in this checkout",
      http_node:
        "replaced by a local read of run-v1.json; the child received the payload the select and bind nodes produce from a dataset document",
      execution_fields:
        "the child wrapper's execution_id and execution_url are omitted because a rehearsal spends no Cloud execution",
      child_inputs_are_production_shaped: true
    },
    cases,
    payload_inspection: payloads,
    live_call: liveCall,
    sensitivity: sensitivityBlock,
    totals: {
      cases: cases.length,
      calls_matching_published: cases.filter((entry) => entry.matches_published_call).length,
      scoring_cases_matching: scoringCases.filter((entry) => entry.scoring_recomputed_from_outcomes === true).length,
      input_probes: probes.length,
      probes_that_moved_the_call: moved.length,
      inputs_that_moved_a_call: Array.from(new Set(moved.map((probe) => probe.input))).sort()
    },
    reproduce: [
      "node scripts/capture_usd_l1_fresh_call.js --date 2024-01-10   # spend one Cloud execution and keep it",
      "node scripts/prove_usd_l1_fresh_call.js --write    # recompute and write this record",
      "node scripts/prove_usd_l1_fresh_call.js --check    # prove the committed record follows from run-v1.json, the bundle and the capture",
      "node --test tests/usd_l1_fresh_call.test.js        # the same claims as assertions"
    ],
    not_claimed: [
      "no accuracy, hit rate, edge or predictive advantage",
      "no claim that one captured execution is a survey: it is one morning, kept because it is inspectable",
      "no claim that the parent's HTTP fetch was exercised by the rehearsal: that dataset was read from the checkout",
      "no claim that a saved input was known before the cutoff: that is the receipted validation mode's question, not this one"
    ]
  };
}

function comparable(record) {
  const { created_at, ...rest } = record;
  return JSON.stringify(rest, null, 1);
}

function usage() {
  return [
    "Usage: node scripts/prove_usd_l1_fresh_call.js [options]",
    "",
    "  --dates <a,b>        mornings to prove (default 2024-01-10,2024-03-26)",
    "  --write              recompute and write data/usd-layer1-backtester/n8n/fresh-call-v1.json",
    "  --check              recompute and compare with the committed record",
    "  --generated-at <ts>  stamp for the written record (default: now)"
  ].join("\n");
}

function main(argv) {
  const args = parseArgs(argv);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return;
  }
  const run = readJson(RUN_PATH);
  const createdAt = args.createdAt || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const record = buildRecord({ run, dates: args.dates, createdAt });

  if (args.check) {
    if (!fs.existsSync(OUT_PATH)) throw new Error(`${rel(OUT_PATH)} is not present; run with --write first`);
    const committed = readJson(OUT_PATH);
    const reproduces = comparable(record) === comparable(committed);
    console.log(JSON.stringify({
      check: reproduces ? "reproduces" : "drift",
      record: rel(OUT_PATH),
      verdict: record.verdict.status,
      cases: record.totals.cases,
      probes_that_moved_the_call: record.totals.probes_that_moved_the_call
    }, null, 1));
    if (!reproduces) process.exitCode = 1;
    return;
  }

  if (args.write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(record, null, 1)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    record: args.write ? rel(OUT_PATH) : "not written (pass --write)",
    verdict: record.verdict,
    totals: record.totals,
    answer: record.answer
  }, null, 1));
  if (record.verdict.status !== "recomputed_from_cutoff_inputs") process.exitCode = 1;
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(String(error && error.message ? error.message : error));
    process.exit(1);
  }
}

module.exports = {
  PREDICTION_KEYS,
  SCORING_TARGET_KEYS,
  parseArgs,
  stripSession,
  findPredictionFields,
  executeParent,
  executeChild,
  buildRecord,
  liveBlock,
  comparable,
  OUT_PATH,
  RUN_PATH,
  LIVE_PATH,
  DEFAULT_DATES
};
