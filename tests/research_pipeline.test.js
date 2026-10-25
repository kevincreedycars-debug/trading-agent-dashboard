"use strict";

// Research pipeline guards: which stage may run, what an envelope carries, what a return has to survive
// before it is stored, how a dead run is recovered and where the allowance stops the supervisor.
//
// Nothing here calls a model. A dispatch is a file, and a submission is bytes an operator says came back.

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createPipeline,
  verifyReturnDocument,
  stageDocumentId,
  DEFAULT_VERIFICATION,
  JOB_STATES
} = require("../lib/research_pipeline.js");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const CREATED_ROOTS = [];

function tempRoot(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `rp-${label}-`));
  CREATED_ROOTS.push(root);
  return root;
}

test.after(() => {
  CREATED_ROOTS.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
});

function writePrompt(root, relative, text) {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
  return { relative, text, sha256: sha256(Buffer.from(text, "utf8")), bytes: Buffer.byteLength(text, "utf8") };
}

const STAGE_SPECS = [
  { stage: "research", order: 1, label: "Research report", document_type: "report", parent_stage: "", prompt: "prompts/research.md" },
  { stage: "red_team", order: 2, label: "Red-team review", document_type: "review", parent_stage: "research", prompt: "prompts/red-team.md" },
  { stage: "adjudication", order: 3, label: "Adjudication", document_type: "synthesis", parent_stage: "red_team", prompt: "prompts/adjudication.md" }
];

const LETTERS = ["a", "b", "c", "d"];

// One factor id per fixture topic, because a factor in the catalogue names exactly one chain and an upload is
// resolved through that chain.
const FIXTURE_FACTOR = "fx.fixture-level";

// A catalogue of one or more topics, matching what the committed one says about a topic and its three
// stages, with prompts written into the temporary root so their hashes are real.
function buildFixture(label, options = {}) {
  const root = tempRoot(label);
  const topicCount = Number(options.topicCount) || 1;
  const topics = LETTERS.slice(0, topicCount).map(letter => {
    const topicId = `usd-topic-fixture-${letter}`;
    const stages = STAGE_SPECS.map(spec => {
      const relative = spec.prompt.replace("prompts/", `prompts/${topicId}-`);
      const prompt = writePrompt(root, relative, `# ${spec.label} prompt\n\nThis is the catalogue prompt for the ${spec.stage} stage of ${topicId}.\n\nAnswer with one Markdown file.\n`);
      return {
        stage: spec.stage,
        order: spec.order,
        label: spec.label,
        document_type: spec.document_type,
        parent_stage: spec.parent_stage,
        prompt_path: prompt.relative,
        prompt_sha256: prompt.sha256,
        prompt_bytes: prompt.bytes,
        deliverable: `${spec.document_type} of the topic, at least 2000 bytes`,
        returns: "one Markdown file"
      };
    });
    return {
      topic_id: topicId,
      asset: "USD",
      title: `Fixture topic ${letter.toUpperCase()}`,
      summary: `What the fixture topic ${letter.toUpperCase()} asks.`,
      factor_ids: [`${FIXTURE_FACTOR}-${letter}`],
      stages
    };
  });
  // The chain is what the registry resolves an upload against, and on this catalogue it is a top-level
  // `factor_chains` entry, not something derived from a topic. One chain per fixture topic, carrying that
  // topic's three stages, so a stage upload resolves exactly as it does against the committed catalogue. The
  // factor id is unique per topic because a factor names exactly one chain.
  const factor_chains = topics.map(topic => ({
    chain_id: `${topic.asset.toLowerCase()}-factor-${topic.topic_id.replace(/^usd-topic-/, "usd-")}`,
    factor_id: topic.factor_ids[0],
    asset: topic.asset,
    topic_id: topic.topic_id,
    group_title: topic.title,
    slug: topic.topic_id.replace(/^usd-topic-/, ""),
    title: `Fixture factor - ${topic.factor_ids[0]}`,
    summary: topic.summary,
    stages: topic.stages
  }));
  const catalog = {
    schema_version: "research-library-catalog-v1",
    assets: [{
      asset: "USD",
      factors: topics.map(topic => ({ factor_id: topic.factor_ids[0], label: topic.title }))
    }],
    topics,
    factor_chains,
    tasks: []
  };
  const catalogPath = path.join(root, "data", "research-library", "catalog.json");
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return {
    root,
    catalog,
    catalogPath,
    registryPath: path.join(root, "data", "research-library", "documents.json"),
    libraryRoot: path.join(root, ".local", "research-library"),
    stateRoot: path.join(root, ".local", "research-pipeline"),
    topics
  };
}

function pipelineFor(fixture, options = {}) {
  return createPipeline({
    root: fixture.root,
    catalogPath: fixture.catalogPath,
    registryPath: fixture.registryPath,
    libraryRoot: fixture.libraryRoot,
    stateRoot: fixture.stateRoot,
    catalog: fixture.catalog,
    ...options
  });
}

// A complete-looking stage deliverable: long enough, five headings, no truncation marker. It is not good
// research and is not meant to be; the checks here are about completeness, not quality.
function completeDocument(title, extra = "") {
  const paragraph = "The stage records what the committed data shows, what it does not show, and which single reading would change its mind. ".repeat(4);
  return [
    `# ${title}`,
    "",
    "## Scope",
    paragraph,
    "## Evidence",
    paragraph,
    "## Counter-case",
    paragraph,
    "## What would change this reading",
    paragraph,
    "## Open questions",
    paragraph,
    extra
  ].join("\n") + "\n";
}

function dispatchAndSubmit(pipeline, topicId, stageId, options = {}) {
  pipeline.dispatch(topicId, stageId);
  const bytes = Buffer.from(completeDocument(`${topicId} ${stageId}`, options.extra || ""), "utf8");
  return pipeline.submit(topicId, stageId, bytes, { model: "fixture-session", ...options.submit });
}


test("a later stage is not dispatchable until the exact version it judges is registered", () => {
  const fixture = buildFixture("order");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;

  const entries = pipeline.plan({ topicId });
  assert.deepEqual(entries.map(entry => entry.stage), ["research", "red_team", "adjudication"]);
  assert.equal(entries[0].runnable, true);
  assert.equal(entries[1].runnable, false);
  assert.match(entries[1].reason, /waiting for research/);
  assert.equal(entries[2].runnable, false);
  assert.match(entries[2].reason, /waiting for research and red_team/);

  assert.throws(() => pipeline.dispatch(topicId, "red_team"), error => error.code === "not_runnable");
  assert.throws(() => pipeline.dispatch(topicId, "red_team"), error => /cannot be dispatched/.test(error.message));
  assert.deepEqual(pipeline.jobs(), {});
  assert.equal(pipeline.budget().used, 0);
});

test("a dispatch writes one envelope with the catalogued prompt and spends one unit of the allowance", () => {
  const fixture = buildFixture("dispatch");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;
  const research = fixture.topics[0].stages[0];

  const dispatched = pipeline.dispatch(topicId, "research", { owner: "test-owner" });
  assert.equal(dispatched.job.state, "dispatched");
  assert.equal(dispatched.job.attempts, 1);
  assert.equal(dispatched.envelope.document_id, stageDocumentId(topicId, "research"));
  assert.equal(dispatched.envelope.prompt_sha256, research.prompt_sha256);
  assert.equal(pipeline.budget().used, 1);

  const bytes = fs.readFileSync(dispatched.envelope.outbox_path);
  assert.equal(sha256(bytes), dispatched.envelope.sha256);
  assert.equal(bytes.length, dispatched.envelope.bytes);
  const text = bytes.toString("utf8");
  assert.ok(text.includes("## Stage prompt (verbatim)"));
  assert.ok(text.includes(research.prompt_sha256));
  assert.ok(text.includes(`- topic: ${topicId} (USD)`));
  assert.ok(text.includes("document under review: none"));
  assert.ok(!text.includes("## Document under review"), "the first stage judges no parent");

  // A second live dispatch of the same stage refuses instead of spending the allowance twice.
  assert.throws(() => pipeline.dispatch(topicId, "research", { owner: "second" }), error => error.code === "already_dispatched");
  assert.equal(pipeline.budget().used, 1);
});

test("a verified return is registered under its stage id, reads back byte-identical and shows as delivered", () => {
  const fixture = buildFixture("roundtrip");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;
  const bytes = Buffer.from(completeDocument("Fixture research report"), "utf8");

  pipeline.dispatch(topicId, "research");
  const result = pipeline.submit(topicId, "research", bytes, {
    model: "fixture-session",
    title: "Fixture research report",
    open_findings: ["the fixture has no live data"],
    note: "returned from the test suite"
  });

  assert.equal(result.registration.document_id, stageDocumentId(topicId, "research"));
  assert.equal(result.registration.version, 1);
  assert.equal(result.registration.sha256, sha256(bytes));
  assert.equal(result.stage_after.state, "delivered");
  assert.equal(result.stage_after.document_id, result.registration.document_id);
  assert.equal(result.job.state, "registered");
  assert.equal(result.job.claim, null);

  const stored = pipeline.store.readObject(result.registration.document_id, 1);
  assert.equal(sha256(stored.bytes), sha256(bytes));
  assert.deepEqual(stored.bytes, bytes);

  const document = pipeline.documents().find(entry => entry.document_id === result.registration.document_id);
  assert.equal(document.topic_id, topicId);
  assert.equal(document.stage, "research");
  assert.equal(document.factor_id, `${FIXTURE_FACTOR}-a`);
  assert.equal(document.model, "fixture-session");
  assert.equal(document.versions.length, 1);
  assert.deepEqual(document.open_findings, ["the fixture has no live data"]);
  assert.ok(document.versions[0].note.includes("passed the completeness check"));
  assert.equal(fs.existsSync(pipeline.jobs()[`${topicId}/research`].envelope.path), false, "the outbox copy is removed once registered");

  // The same bytes again are recognised as already registered rather than stored as a second version.
  const again = pipeline.submit(topicId, "research", bytes, { model: "fixture-session" });
  assert.equal(again.duplicate, true);
  assert.equal(again.registration.version, 1);
  assert.equal(pipeline.documents()[0].versions.length, 1);

  // A different return for a registered stage needs a new dispatch, so the record says which brief it answered.
  assert.throws(
    () => pipeline.submit(topicId, "research", Buffer.from(completeDocument("A different report"), "utf8"), { model: "fixture-session" }),
    error => error.code === "already_registered"
  );
});

test("the review stage judges the registered research version and its envelope carries those exact bytes", () => {
  const fixture = buildFixture("chain");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;

  const research = dispatchAndSubmit(pipeline, topicId, "research");
  const researchBytes = pipeline.store.readObject(research.registration.document_id, 1).bytes;

  const dispatched = pipeline.dispatch(topicId, "red_team");
  const envelopeText = fs.readFileSync(dispatched.envelope.outbox_path, "utf8");
  assert.equal(dispatched.envelope.parent_document_id, research.registration.document_id);
  assert.equal(dispatched.envelope.parent_version, 1);
  assert.ok(envelopeText.includes(`## Document under review (verbatim, ${research.registration.document_id} version 1, sha256 ${research.registration.sha256})`));
  assert.ok(envelopeText.includes(researchBytes.toString("utf8").trimEnd()));

  const review = pipeline.submit(topicId, "red_team", Buffer.from(completeDocument("Fixture red-team review"), "utf8"), { model: "fixture-session" });
  assert.equal(review.stage_after.state, "delivered");
  const reviewDocument = pipeline.documents().find(entry => entry.document_id === review.registration.document_id);
  assert.equal(reviewDocument.parent_document_id, research.registration.document_id);
  assert.equal(reviewDocument.parent_version, 1);
  assert.equal(reviewDocument.parent_sha256, research.registration.sha256);

  const afterReview = pipeline.plan({ topicId });
  assert.equal(afterReview.find(entry => entry.stage === "adjudication").runnable, true);
  assert.equal(afterReview.find(entry => entry.stage === "research").runnable, false);
});

test("a truncated return is rejected, kept out of the registry and recorded, and the stage may still answer", () => {
  const fixture = buildFixture("reject");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;

  pipeline.dispatch(topicId, "research");
  const truncated = Buffer.from("# Fixture research report\n\n## Scope\n\nThe answer stopped early. [truncated]\n", "utf8");
  assert.throws(
    () => pipeline.submit(topicId, "research", truncated, { model: "fixture-session" }),
    error => error.code === "return_rejected" && error.problems.length > 0
  );
  assert.deepEqual(pipeline.documents(), [], "a rejected return is never stored");
  assert.equal(pipeline.jobs()[`${topicId}/research`].state, "rejected");
  assert.ok(pipeline.jobs()[`${topicId}/research`].last_error.includes("truncation or placeholder marker"));
  const rejectedDir = path.join(fixture.stateRoot, "returns", "rejected");
  const rejectedFiles = fs.readdirSync(rejectedDir);
  assert.equal(rejectedFiles.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(rejectedDir, rejectedFiles[0])), truncated);
  assert.equal(pipeline.budget().used, 1, "a rejection does not spend another dispatch");

  // The same dispatch can still be answered, and a model name is not optional: the registry has to say
  // where a returned document came from.
  const good = Buffer.from(completeDocument("Fixture research report"), "utf8");
  assert.throws(() => pipeline.submit(topicId, "research", good, {}), error => error.code === "model_required");
  const registered = pipeline.submit(topicId, "research", good, { model: "fixture-session" });
  assert.equal(registered.stage_after.state, "delivered");
});

test("a prompt that drifted from the catalogue stops the dispatch before anything is claimed", () => {
  const fixture = buildFixture("drift");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;
  const promptPath = path.join(fixture.root, fixture.topics[0].stages[0].prompt_path);
  fs.writeFileSync(promptPath, `${fs.readFileSync(promptPath, "utf8")}\nOne more instruction added after the catalogue was built.\n`, "utf8");

  assert.throws(() => pipeline.dispatch(topicId, "research"), error => error.code === "prompt_drift");
  assert.deepEqual(pipeline.jobs(), {});
  assert.equal(pipeline.budget().used, 0);
  assert.equal(fs.existsSync(path.join(fixture.stateRoot, "outbox")), false, "no envelope is written for a prompt nobody catalogued");
  // The preview refuses for the same reason, so the operator sees it before a dispatch is attempted.
  assert.throws(() => pipeline.envelope(topicId, "research"), error => error.code === "prompt_drift");
});


test("a parent whose stored bytes no longer match the registry stops the dispatch before it is claimed", () => {
  const fixture = buildFixture("parenthash");
  const real = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;
  dispatchAndSubmit(real, topicId, "research");
  const usageBefore = real.budget().used;
  const jobsBefore = JSON.stringify(real.jobs());

  // A store that hands back different bytes than the registry records is what the guard is for, so the
  // check is exercised directly rather than only through a damaged object file.
  const tampered = pipelineFor(fixture, {
    store: {
      readRegistry: () => real.store.readRegistry(),
      readObject: (documentId, version) => {
        const object = real.store.readObject(documentId, version);
        return { ...object, bytes: Buffer.from(`${object.bytes.toString("utf8")}\nA paragraph nobody registered.\n`, "utf8") };
      }
    }
  });
  assert.throws(() => tampered.dispatch(topicId, "red_team"), error => error.code === "parent_hash_mismatch");
  assert.equal(real.budget().used, usageBefore, "a refused dispatch spends nothing");
  assert.equal(JSON.stringify(real.jobs()), jobsBefore);

  // And the store itself refuses an object file whose bytes were replaced after registration.
  const stored = real.store.readObject(stageDocumentId(topicId, "research"), 1);
  const objectPath = path.join(fixture.libraryRoot, "objects", stored.version.sha256.slice(0, 2), stored.version.sha256);
  fs.writeFileSync(objectPath, Buffer.from("replaced\n", "utf8"));
  assert.throws(() => real.dispatch(topicId, "red_team"), error => /integrity check/.test(error.message));
  assert.equal(real.budget().used, 1);
});

test("an expired lease is requeued by recover and the next dispatch keeps the attempt count", () => {
  const fixture = buildFixture("lease");
  const pipeline = pipelineFor(fixture);
  const topicId = fixture.topics[0].topic_id;
  const key = `${topicId}/research`;

  const first = pipeline.dispatch(topicId, "research", { owner: "first-owner" });
  assert.equal(first.job.attempts, 1);
  assert.equal(first.job.claim.owner, "first-owner");

  // A claim whose lease has run out is not a claim any more: the stage goes back to the queue, history intact.
  const queue = JSON.parse(fs.readFileSync(pipeline.paths.queue, "utf8"));
  queue.jobs[key].claim.expires_at = new Date(Date.now() - 60 * 1000).toISOString();
  fs.writeFileSync(pipeline.paths.queue, `${JSON.stringify(queue, null, 2)}\n`, "utf8");

  assert.throws(() => pipeline.dispatch(topicId, "research"), error => error.code === "stale_claim");
  assert.equal(pipeline.plan({ topicId })[0].claim_held, true, "the stage reads as blocked until the run is recovered");
  const recovered = pipeline.recover();
  assert.deepEqual(recovered.released, [key]);
  assert.equal(pipeline.jobs()[key].state, "queued");
  assert.equal(pipeline.jobs()[key].claim, null);

  const second = pipeline.dispatch(topicId, "research", { owner: "second-owner" });
  assert.equal(second.job.attempts, 2);
  assert.equal(second.job.claim.owner, "second-owner");
  assert.ok(second.job.notes.some(note => note.includes("lease expired")));
  assert.equal(pipeline.budget().used, 2);
});


test("the allowance stops the supervisor short of the reserve, and only an explicit reset clears the count", () => {
  const fixture = buildFixture("allowance", { topicCount: 2 });
  const pipeline = pipelineFor(fixture, { allowance: { limit: 2, reserve: 1 } });
  assert.equal(pipeline.budget().usable, 1);
  assert.equal(pipeline.budget().remaining, 1);

  pipeline.dispatch(fixture.topics[0].topic_id, "research");
  assert.equal(pipeline.budget().remaining, 0);
  assert.equal(pipeline.budget().exhausted, true);

  // The reserve belongs to the owner, so the second dispatch is refused rather than eating into it.
  assert.throws(
    () => pipeline.dispatch(fixture.topics[1].topic_id, "research"),
    error => error.code === "allowance_exhausted" && /held in reserve/.test(error.message)
  );
  assert.equal(pipeline.budget().used, 1);
  assert.equal(pipeline.status().counts.runnable, 1);

  // Clearing the count is a decision, not something the supervisor infers from a clock.
  const reset = pipeline.setAllowance({ limit: 4, reset: true });
  assert.equal(reset.used, 0);
  assert.equal(reset.usable, 3);
  assert.equal(reset.reset_cadence, "manual");
  assert.ok(reset.reset_at);

  pipeline.pause("the owner needs the plan for an hour");
  assert.throws(() => pipeline.dispatch(fixture.topics[1].topic_id, "research"), error => error.code === "pipeline_paused");
  assert.equal(pipeline.status().paused, true);
  assert.match(pipeline.status().pause_reason, /owner needs the plan/);

  pipeline.resume();
  const dispatched = pipeline.dispatch(fixture.topics[1].topic_id, "research");
  assert.equal(dispatched.job.state, "dispatched");
  assert.equal(pipeline.budget().used, 1);
});

test("the verifier rejects what a stopped or damaged answer looks like and passes a complete document", () => {
  assert.ok(DEFAULT_VERIFICATION.min_bytes >= 2000);
  assert.ok(DEFAULT_VERIFICATION.min_headings >= 5);
  assert.deepEqual(JOB_STATES.slice(), ["queued", "dispatched", "registered", "rejected"]);

  const good = verifyReturnDocument(Buffer.from(completeDocument("Complete report"), "utf8"));
  assert.equal(good.ok, true);
  assert.equal(good.problems.length, 0);
  assert.ok(good.headings >= 5);

  const short = verifyReturnDocument(Buffer.from("# Short\n\nIt stopped.\n", "utf8"));
  assert.equal(short.ok, false);
  assert.ok(short.problems.some(problem => problem.includes("at least")));

  const truncated = verifyReturnDocument(Buffer.from(completeDocument("Truncated report", "The rest is [truncated]"), "utf8"));
  assert.equal(truncated.ok, false);
  assert.ok(truncated.problems.some(problem => problem.includes("truncation or placeholder marker")));

  const fenced = verifyReturnDocument(Buffer.from(completeDocument("Fenced report", "```js\nconst a = 1;\n"), "utf8"));
  assert.equal(fenced.ok, false);
  assert.ok(fenced.problems.some(problem => problem.includes("unclosed code fence")));

  const damaged = verifyReturnDocument(Buffer.from(completeDocument("Damaged report").replace("## Scope", "## Sc\uFFFDope"), "utf8"));
  assert.equal(damaged.ok, false);
  assert.ok(damaged.problems.some(problem => problem.includes("not valid UTF-8")));

  const nul = verifyReturnDocument(Buffer.from(completeDocument("Nul report").replace("## Scope", "## Sc\u0000ope"), "utf8"));
  assert.equal(nul.ok, false);
  assert.ok(nul.problems.some(problem => problem.includes("NUL")));

  assert.equal(verifyReturnDocument("a string, not bytes").ok, false);
  assert.equal(verifyReturnDocument(Buffer.alloc(0)).ok, false);
});

// The operator front end is guarded the same way as the library it drives: a status read, a preview and a
// refusal are checked through the CLI, not only through the module, because the CLI is what an unattended
// run and a human at the keyboard both actually call.
const { main: runCli, parseArguments } = require("../scripts/research-pipeline.js");

function readJsonOrNull(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function cliHarness() {
  const stdout = [];
  const stderr = [];
  const io = {
    stdout: { write: chunk => { stdout.push(String(chunk)); return true; } },
    stderr: { write: chunk => { stderr.push(String(chunk)); return true; } }
  };
  return (...argv) => {
    stdout.length = 0;
    stderr.length = 0;
    const code = runCli(argv, io);
    const out = stdout.join("");
    const err = stderr.join("");
    return { code, out, err, json: readJsonOrNull(out), error: readJsonOrNull(err) };
  };
}

test("the CLI reports the plan, previews an envelope and writes no state for either", () => {
  const fixture = buildFixture("cli-read");
  const cli = cliHarness();
  const root = ["--root", fixture.root];
  const topicId = fixture.topics[0].topic_id;

  const status = cli("status", ...root);
  assert.equal(status.code, 0);
  assert.equal(status.json.ok, true);
  assert.equal(status.json.paused, false);
  assert.equal(status.json.counts.stages, 3);
  assert.equal(status.json.counts.runnable, 1);
  assert.equal(status.json.counts.delivered, 0);
  assert.deepEqual(status.json.next.map(entry => entry.stage), ["research"]);
  assert.equal(status.json.allowance.used, 0);
  assert.equal(status.json.paths.state_root, fixture.stateRoot);
  assert.equal(status.json.stages, undefined, "the stage list is only printed when --stages is asked for");

  const plan = cli("plan", "--runnable", ...root);
  assert.equal(plan.code, 0);
  assert.equal(plan.json.count, 1);
  assert.equal(plan.json.stages[0].job_key, `${topicId}/research`);

  const preview = cli("preview", topicId, "research", ...root);
  assert.equal(preview.code, 0);
  assert.match(preview.out, /^# Unattended stage dispatch:/);
  assert.match(preview.out, /## Stage prompt \(verbatim\)/);
  assert.ok(preview.out.includes(fixture.topics[0].stages[0].prompt_sha256));

  const summary = cli("preview", topicId, "research", "--json", ...root);
  assert.equal(summary.json.ok, true);
  assert.equal(summary.json.document_id, stageDocumentId(topicId, "research"));
  assert.equal(summary.json.parent_document_id, null);
  assert.ok(summary.json.bytes > 0);
  assert.equal(summary.json.written_to, null);
  assert.equal(fs.existsSync(fixture.stateRoot), false, "reading the plan and previewing an envelope write nothing");
  assert.equal(fs.existsSync(fixture.registryPath), false, "a preview registers nothing");

  const unknown = cli("frobnicate", ...root);
  assert.equal(unknown.code, 1);
  assert.equal(unknown.error.ok, false);
  assert.equal(unknown.error.code, "cli_error");
  assert.match(unknown.error.message, /unknown command frobnicate/);
});

test("the CLI dispatches, accepts a named return, and refuses the next stage until it is registered", () => {
  const fixture = buildFixture("cli-cycle");
  const cli = cliHarness();
  const root = ["--root", fixture.root];
  const topicId = fixture.topics[0].topic_id;

  const dispatched = cli("dispatch", topicId, "research", "--owner", "cli-test", ...root);
  assert.equal(dispatched.code, 0);
  assert.equal(dispatched.json.job_key, `${topicId}/research`);
  assert.equal(dispatched.json.attempt, 1);
  assert.equal(dispatched.json.allowance.used, 1);
  const outboxPath = dispatched.json.envelope.outbox_path;
  assert.ok(fs.existsSync(outboxPath));

  // The stage that follows cannot start while the return is outstanding.
  const early = cli("dispatch", topicId, "red_team", ...root);
  assert.equal(early.code, 1);
  assert.equal(early.error.code, "not_runnable");
  assert.equal(cli("allowance", ...root).json.allowance.used, 1, "a refused dispatch spends nothing");

  const returned = path.join(fixture.root, "returns", "research.md");
  fs.mkdirSync(path.dirname(returned), { recursive: true });
  fs.writeFileSync(returned, completeDocument("CLI research report"), "utf8");

  const submitted = cli(
    "submit", topicId, "research",
    "--file", returned,
    "--model", "fixture-session",
    "--open-finding", "the fixture has no live data",
    "--open-finding", "the sample is one session",
    ...root
  );
  assert.equal(submitted.code, 0);
  assert.equal(submitted.json.duplicate, false);
  assert.equal(submitted.json.registration.version, 1);
  assert.equal(submitted.json.stage_after.state, "delivered");
  assert.equal(submitted.json.topic_ready, false);
  assert.equal(fs.existsSync(outboxPath), false, "the answered envelope is removed once the return is registered");

  const registry = readJsonOrNull(fs.readFileSync(fixture.registryPath, "utf8"));
  const registered = registry.documents.find(entry => entry.document_id === submitted.json.registration.document_id);
  assert.deepEqual(registered.open_findings, ["the fixture has no live data", "the sample is one session"]);
  assert.equal(registered.model, "fixture-session");
  assert.equal(registered.versions[0].sha256, submitted.json.registration.sha256);

  const after = cli("status", ...root);
  assert.equal(after.json.counts.delivered, 1);
  assert.deepEqual(after.json.next.map(entry => entry.stage), ["red_team"]);

  // A return for a stage that was never dispatched is refused before the registry changes.
  fs.writeFileSync(returned, completeDocument("CLI red-team review"), "utf8");
  const undispatched = cli("submit", topicId, "red_team", "--file", returned, "--model", "fixture-session", ...root);
  assert.equal(undispatched.code, 1);
  assert.equal(undispatched.error.code, "not_dispatched");
  assert.equal(cli("status", ...root).json.counts.delivered, 1);
});

test("the CLI pause, allowance and recover commands are the only way the supervisor is stopped or refilled", () => {
  const fixture = buildFixture("cli-control", { topicCount: 2 });
  const cli = cliHarness();
  const root = ["--root", fixture.root];

  assert.deepEqual(cli("recover", ...root).json.released, [], "a clean queue releases nothing");

  const paused = cli("pause", "--reason", "the owner is reading the plan", ...root);
  assert.equal(paused.code, 0);
  assert.equal(paused.json.paused, true);
  const refused = cli("dispatch", fixture.topics[0].topic_id, "research", ...root);
  assert.equal(refused.code, 1);
  assert.equal(refused.error.code, "pipeline_paused");
  assert.match(refused.error.message, /owner is reading the plan/);

  assert.equal(cli("resume", ...root).json.paused, false);
  const limited = cli("allowance", "--limit", "2", "--reserve", "1", ...root);
  assert.equal(limited.json.changed, true);
  assert.equal(limited.json.allowance.usable, 1);
  assert.equal(cli("allowance", ...root).json.allowance.used, 0);

  assert.equal(cli("dispatch", fixture.topics[0].topic_id, "research", ...root).code, 0);
  const exhausted = cli("dispatch", fixture.topics[1].topic_id, "research", ...root);
  assert.equal(exhausted.code, 1);
  assert.equal(exhausted.error.code, "allowance_exhausted");

  const reset = cli("allowance", "--reset", ...root);
  assert.equal(reset.json.allowance.used, 0);
  assert.equal(reset.json.allowance.usable, 1);
  assert.equal(cli("dispatch", fixture.topics[1].topic_id, "research", ...root).code, 0);

  const recovered = cli("recover", ...root);
  assert.deepEqual(recovered.json.released, [], "a live lease is left to its owner");
  assert.equal(recovered.json.checked, 2);

  // A malformed allowance is refused rather than coerced into a number nobody wrote down.
  const bad = cli("allowance", "--limit", "lots", ...root);
  assert.equal(bad.code, 1);
  assert.match(bad.error.message, /--limit must be a non-negative number/);
});

test("a topic that groups two factor chains refuses an unnamed chain and runs the chain that is named", () => {
  const fixture = buildFixture("chains");
  const topic = fixture.topics[0];
  const secondFactorId = `${FIXTURE_FACTOR}-b`;
  const chainId = `${topic.topic_id}-second`;
  // The committed catalogue keeps the stages on the factor chain and leaves the topic as a grouping label.
  const catalog = {
    ...fixture.catalog,
    topics: [{ ...topic, stages: undefined, factor_ids: [topic.factor_ids[0], secondFactorId] }],
    assets: [{
      asset: "USD",
      factors: [...fixture.catalog.assets[0].factors, { factor_id: secondFactorId, label: "Second fixture factor" }]
    }],
    factor_chains: [
      ...fixture.catalog.factor_chains,
      { ...fixture.catalog.factor_chains[0], chain_id: chainId, factor_id: secondFactorId, title: "Second fixture chain" }
    ]
  };
  fs.writeFileSync(fixture.catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const pipeline = pipelineFor(fixture, { catalog });

  // Two chains, two sets of stages: the supervisor does not guess which one the operator meant.
  const plan = pipeline.plan();
  assert.equal(plan.length, 6, "each of the two chains contributes its three stages");
  const ambiguous = (() => {
    try {
      pipeline.dispatch(topic.topic_id, "research");
      return null;
    } catch (error) {
      return error;
    }
  })();
  assert.ok(ambiguous, "a topic with two chains refuses an unnamed stage");
  assert.equal(ambiguous.code, "chain_required");
  assert.match(ambiguous.message, new RegExp(chainId));

  const dispatched = pipeline.dispatch(topic.topic_id, "research", { chain: chainId });
  assert.equal(dispatched.job.job_key, `${chainId}/research`);
  assert.equal(dispatched.envelope.document_id, stageDocumentId(chainId, "research"));

  const bytes = Buffer.from(completeDocument("Chained research"), "utf8");
  const submitted = pipeline.submit(topic.topic_id, "research", bytes, { chain: chainId, model: "fixture-session" });
  assert.equal(submitted.registration.document_id, stageDocumentId(chainId, "research"));
  const document = pipeline.documents().find(entry => entry.document_id === submitted.registration.document_id);
  assert.equal(document.factor_id, secondFactorId);
  assert.equal(document.topic_id, topic.topic_id);
});

test("the CLI argument parser keeps repeated findings and refuses a flag given twice", () => {
  const parsed = parseArguments(["submit", "topic", "research", "--file", "a.md", "--open-finding", "one", "--open-finding", "two", "--json"]);
  assert.deepEqual(parsed.positionals, ["submit", "topic", "research"]);
  assert.equal(parsed.flags.file, "a.md");
  assert.deepEqual(parsed.flags["open-finding"], ["one", "two"]);
  assert.equal(parsed.flags.json, true);
  assert.throws(() => parseArguments(["status", "--file", "a.md", "--file", "b.md"]), /--file was given more than once/);
});
