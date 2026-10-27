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

// The provider half of the allowance. These tests never call a model: a rollout is a JSONL fixture written by
// the test, shaped like the files `codex exec` leaves in ~/.codex/sessions.
const ROLLOUT_OBSERVED = "2026-10-25T19:56:18.135Z";
const PRIMARY_RESET = "2026-10-26T00:11:46.000Z";
const SECONDARY_RESET = "2026-11-01T11:07:00.000Z";

function rolloutText(options = {}) {
  const observed = options.observedAt || ROLLOUT_OBSERVED;
  const limits = {
    limit_id: "codex",
    primary: {
      used_percent: options.primaryUsed === undefined ? 35 : options.primaryUsed,
      window_minutes: 300,
      resets_at: Math.floor(Date.parse(options.primaryReset || PRIMARY_RESET) / 1000)
    },
    secondary: {
      used_percent: options.secondaryUsed === undefined ? 8 : options.secondaryUsed,
      window_minutes: 10080,
      resets_at: Math.floor(Date.parse(options.secondaryReset || SECONDARY_RESET) / 1000)
    },
    credits: {
      has_credits: options.hasCredits === undefined ? true : options.hasCredits,
      unlimited: false,
      balance: options.creditsBalance === undefined ? "144.7441982500" : options.creditsBalance
    },
    plan_type: "plus",
    rate_limit_reached_type: options.reached || null
  };
  const events = [
    {
      timestamp: "2026-10-25T19:55:05.911Z",
      type: "session_meta",
      payload: { id: options.threadId || "thread-fixture", cli_version: "0.164.0", model_provider: "openai", cwd: "C:/scratch" }
    },
    { timestamp: observed, type: "turn_context", payload: { model: options.model || "gpt-6-astra" } },
    { timestamp: observed, type: "token_usage_record", payload: { usage: { input_tokens: 1200, output_tokens: 340, cached_input_tokens: 0 } } }
  ];
  (options.messages || []).forEach(text => events.push({
    timestamp: observed,
    type: "response_item",
    payload: { type: "message", role: "assistant", content: [{ type: "output_text", text }] }
  }));
  if (options.includeLimits !== false) {
    events.push({ timestamp: observed, type: "event_msg", payload: { type: "token_count", rate_limits: limits } });
  }
  if (options.refusalMessage) {
    events.push({ timestamp: options.refusalAt || observed, type: "turn.failed", payload: { error: { message: options.refusalMessage } } });
  }
  return `${events.map(event => JSON.stringify(event)).join("\n")}\n`;
}

function writeRollout(fixture, name, text) {
  const filePath = path.join(fixture.root, "sessions", name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
  return filePath;
}

// The carrier's captured `codex exec --json` stream, written the way PowerShell captures it on Windows:
// UTF-16LE with a byte-order mark. One completed `web_search` item is one retrieval.
function execLogText(threadId, searches = []) {
  const events = [{ type: "thread.started", thread_id: threadId }];
  searches.forEach((entry, index) => {
    events.push({ type: "item.started", item: { id: `item_${index}`, type: "web_search", query: "" } });
    events.push({
      type: "item.completed",
      item: {
        id: `item_${index}`,
        type: "web_search",
        query: entry.query,
        action: { type: "search", query: entry.query },
        results: (entry.sources || []).map(url => ({ type: "text_result", url }))
      }
    });
  });
  events.push({ type: "item.completed", item: { id: "final", type: "agent_message", text: "done" } });
  return `${events.map(event => JSON.stringify(event)).join("\r\n")}\r\n`;
}

function writeExecLog(fixture, name, text) {
  const filePath = path.join(fixture.root, "sessions", name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]));
  return filePath;
}

test("a wired-in provider allowance refuses to dispatch until a reading establishes it, and pauses as the allowance", () => {
  const fixture = buildFixture("provider-missing");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => new Date("2026-10-25T20:00:00Z") });
  assert.equal(pipeline.budget().provider.enforced, true);
  assert.equal(pipeline.budget().provider.code, "provider_allowance_unknown");

  assert.throws(
    () => pipeline.dispatch(fixture.topics[0].topic_id, "research"),
    error => error.code === "provider_allowance_unknown" && /reading/.test(error.message)
  );
  assert.equal(pipeline.budget().used, 0, "an unknown allowance spends nothing");
  const state = pipeline.status();
  assert.equal(state.paused, true);
  assert.equal(state.paused_by, "allowance", "the queue stops on the allowance, not on an owner pause");
  assert.match(state.pause_reason, /^allowance: /);
  assert.throws(() => pipeline.resume(), error => error.code === "provider_allowance_unknown");
});

test("an imported rollout sets both windows, their reset times and the capacity kept for the owner", () => {
  const fixture = buildFixture("provider-import");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => new Date("2026-10-25T20:00:00Z") });
  const text = rolloutText();
  const file = writeRollout(fixture, "fresh.jsonl", text);

  const imported = pipeline.importProviderUsage({ file });
  assert.equal(imported.provider.ok, true);
  assert.equal(imported.provider.code, "provider_ok");
  assert.equal(imported.provider.plan_type, "plus");
  assert.equal(imported.provider.capacity_percent, 85);
  assert.equal(imported.provider.owner_reserve_percent, 15);
  assert.deepEqual(imported.provider.windows.map(window => [window.name, window.used_percent]), [["primary", 35], ["secondary", 8]]);
  assert.equal(imported.provider.windows[0].resets_at, PRIMARY_RESET);
  assert.equal(imported.provider.windows[1].resets_at, SECONDARY_RESET);
  assert.equal(imported.queue.paused, false);

  const dispatched = pipeline.dispatch(fixture.topics[0].topic_id, "research");
  assert.equal(dispatched.allowance.used, 1);
  assert.equal(dispatched.allowance.provider.code, "provider_ok");
  // The imported reading is recorded with its own hash and thread, so the numbers can be traced to a run.
  const usage = JSON.parse(fs.readFileSync(pipeline.paths.usage, "utf8"));
  assert.equal(usage.provider.enabled, true);
  assert.equal(usage.provider.snapshot.source.sha256, sha256(Buffer.from(text, "utf8")));
  assert.equal(usage.provider.snapshot.source.thread_id, "thread-fixture");
  assert.equal(usage.provider.history.length, 1);
});

test("the gate stops at the configured capacity, names the window and its reset, and spends nothing", () => {
  const fixture = buildFixture("provider-capacity");
  const pipeline = pipelineFor(fixture, {
    provider: { enabled: true, capacity_percent: 30 },
    now: () => new Date("2026-10-25T20:00:00Z")
  });
  const file = writeRollout(fixture, "busy.jsonl", rolloutText({ primaryUsed: 35 }));
  const imported = pipeline.importProviderUsage({ file });
  assert.equal(imported.provider.ok, false);
  assert.equal(imported.provider.code, "provider_allowance_exhausted");
  assert.match(imported.provider.reason, /primary window is at 35%/);
  assert.match(imported.provider.reason, /keeping 70% for the owner/);
  assert.ok(imported.provider.reason.includes(PRIMARY_RESET));
  assert.equal(imported.queue.paused, true);

  assert.throws(
    () => pipeline.dispatch(fixture.topics[0].topic_id, "research"),
    error => error.code === "pipeline_paused" && /primary window/.test(error.message)
  );
  assert.equal(pipeline.budget().used, 0);

  // The weekly window on its own can stop the run as well.
  const weekly = writeRollout(fixture, "weekly.jsonl", rolloutText({ primaryUsed: 10, secondaryUsed: 30 }));
  const second = pipeline.importProviderUsage({ file: weekly });
  assert.equal(second.provider.code, "provider_allowance_exhausted");
  assert.match(second.provider.reason, /secondary window/);
});

test("the host ceiling of 75% is one number applied to both windows, not to the five-hour one alone", () => {
  const fixture = buildFixture("provider-ceiling-75");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => new Date("2026-10-25T20:00:00Z") });
  const policy = pipeline.setProviderPolicy({ enabled: true, capacity_percent: 75, max_age_minutes: 90 });
  assert.equal(policy.provider.capacity_percent, 75);
  assert.equal(policy.provider.owner_reserve_percent, 25);

  // 74% in either window is inside the budget the owner set aside; each window reports the same ceiling.
  const inside = pipeline.importProviderUsage({ file: writeRollout(fixture, "inside.jsonl", rolloutText({ primaryUsed: 74, secondaryUsed: 74 })) });
  assert.equal(inside.provider.code, "provider_ok");
  assert.deepEqual(inside.provider.windows.map(window => window.capacity_percent), [75, 75]);
  assert.deepEqual(inside.provider.windows.map(window => window.remaining_percent), [1, 1]);

  // The weekly window alone stops the pass, because 75 is the number it is measured against as well.
  const weekly = pipeline.importProviderUsage({ file: writeRollout(fixture, "weekly-75.jsonl", rolloutText({ primaryUsed: 10, secondaryUsed: 75 })) });
  assert.equal(weekly.provider.code, "provider_allowance_exhausted");
  assert.match(weekly.provider.reason, /secondary window is at 75%/);
  assert.match(weekly.provider.reason, /stops at 75%/);
  assert.equal(weekly.queue.paused, true);
});

test("a credit balance that falls stops the pass, and only the owner's re-baseline lifts it", () => {
  const fixture = buildFixture("provider-credits");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => new Date("2026-10-25T20:00:00Z") });
  const first = pipeline.importProviderUsage({ file: writeRollout(fixture, "baseline.jsonl", rolloutText()) });
  assert.equal(first.provider.code, "provider_ok");
  assert.equal(first.provider.credits.has_credits, true, "the route carries a purchased-credit balance of its own");
  assert.equal(first.provider.credits_baseline.balance, 144.74419825);
  assert.equal(first.provider.credits_baseline.set_by, "first-reading");

  // A later reading with a lower balance is the evidence that the included allowance ran out and the carrier
  // drew on purchased credits. Nothing about that is inferred from an error message.
  const spent = pipeline.importProviderUsage({ file: writeRollout(fixture, "spent.jsonl", rolloutText({ creditsBalance: "140.2441982500" })) });
  assert.equal(spent.provider.ok, false);
  assert.equal(spent.provider.code, "provider_credits_spent");
  assert.match(spent.provider.reason, /fell from 144\.74419825 to 140\.24419825/);
  assert.match(spent.provider.reason, /4\.5 spent/);
  assert.match(spent.provider.reason, /--rebaseline-credits/);
  assert.equal(spent.provider.credits_baseline.balance, 144.74419825, "a reading never lowers the baseline");
  assert.equal(spent.queue.paused, true);
  assert.throws(
    () => pipeline.dispatch(fixture.topics[0].topic_id, "research"),
    error => error.code === "pipeline_paused" && /credit balance fell/.test(error.message)
  );

  // The owner accepts the new balance deliberately; the gate then measures from it, and a further drop stops it.
  const accepted = pipeline.setProviderPolicy({ rebaseline_credits: true, owner: "operator" });
  assert.equal(accepted.provider.code, "provider_ok");
  assert.equal(accepted.provider.credits_baseline.balance, 140.24419825);
  assert.equal(accepted.provider.credits_baseline.set_by, "operator");
  const again = pipeline.importProviderUsage({ file: writeRollout(fixture, "spent-again.jsonl", rolloutText({ creditsBalance: "139.0" })) });
  assert.equal(again.provider.code, "provider_credits_spent");

  // Re-baselining is an owner act with an input: without a reading there is nothing to take a balance from.
  const empty = pipelineFor(buildFixture("provider-credits-empty"), { provider: { enabled: true } });
  assert.throws(
    () => empty.setProviderPolicy({ rebaseline_credits: true }),
    error => error.code === "provider_reading_missing"
  );
});

test("a reading taken before a window reset is stale, and only a fresh reading lifts the allowance pause", () => {
  const fixture = buildFixture("provider-stale");
  let clock = new Date("2026-10-25T20:00:00Z");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true, max_age_minutes: 600 }, now: () => clock });
  assert.equal(pipeline.importProviderUsage({ file: writeRollout(fixture, "evening.jsonl", rolloutText()) }).provider.ok, true);

  clock = new Date("2026-10-26T00:20:00Z");
  const stale = pipeline.budget().provider;
  assert.equal(stale.code, "provider_allowance_stale");
  assert.ok(stale.reason.includes(PRIMARY_RESET), "the reason names the window that reset");
  assert.throws(() => pipeline.dispatch(fixture.topics[0].topic_id, "research"), error => error.code === "provider_allowance_stale");
  assert.equal(pipeline.status().paused_by, "allowance");

  // A run after the reset writes a new rollout; importing it is the documented resume path.
  const fresh = writeRollout(fixture, "morning.jsonl", rolloutText({
    observedAt: "2026-10-26T00:21:00.000Z",
    primaryUsed: 4,
    primaryReset: "2026-10-26T05:21:00.000Z"
  }));
  const refreshed = pipeline.importProviderUsage({ file: fresh });
  assert.equal(refreshed.provider.ok, true);
  assert.equal(refreshed.queue.paused, false, "the allowance pause is lifted by the new reading");
  assert.equal(refreshed.budget.used, 0, "a pause and its lift spend nothing");
  assert.equal(pipeline.dispatch(fixture.topics[0].topic_id, "research").allowance.used, 1);
});

test("a reading that is merely old is unknown permission, not permission", () => {
  const fixture = buildFixture("provider-age");
  let clock = new Date("2026-10-25T20:00:00Z");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true, max_age_minutes: 45 }, now: () => clock });
  pipeline.importProviderUsage({ file: writeRollout(fixture, "old.jsonl", rolloutText()) });
  clock = new Date("2026-10-25T21:30:00Z");
  const gate = pipeline.budget().provider;
  assert.equal(gate.code, "provider_allowance_stale");
  assert.match(gate.reason, /minutes old and the limit is 45/);
  assert.throws(() => pipeline.dispatch(fixture.topics[0].topic_id, "research"), error => error.code === "provider_allowance_stale");
});

test("a provider refusal stops the queue, blocks resume, and is cleared by a later reading", () => {
  const fixture = buildFixture("provider-refusal");
  let clock = new Date("2026-10-25T20:00:00Z");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => clock });
  pipeline.importProviderUsage({ file: writeRollout(fixture, "before.jsonl", rolloutText()) });

  const refused = pipeline.recordProviderRefusal({
    message: "You've hit your usage limit. Try again at 3pm.",
    resets_at: PRIMARY_RESET
  });
  assert.equal(refused.provider.code, "provider_refused");
  assert.equal(refused.queue.paused, true);
  assert.match(refused.provider.reason, /Try again at 3pm/);
  assert.ok(refused.provider.reason.includes(PRIMARY_RESET));
  assert.throws(() => pipeline.dispatch(fixture.topics[0].topic_id, "research"), error => error.code === "pipeline_paused");
  assert.throws(() => pipeline.resume(), error => error.code === "provider_refused");
  assert.equal(pipeline.budget().used, 0, "a refusal spends nothing");

  clock = new Date("2026-10-26T00:30:00Z");
  const after = writeRollout(fixture, "after.jsonl", rolloutText({
    observedAt: "2026-10-26T00:29:00.000Z",
    primaryUsed: 2,
    primaryReset: "2026-10-26T05:29:00.000Z"
  }));
  const cleared = pipeline.importProviderUsage({ file: after });
  assert.equal(cleared.provider.code, "provider_ok");
  assert.equal(cleared.queue.paused, false);
  assert.equal(pipeline.dispatch(fixture.topics[0].topic_id, "research").allowance.used, 1);
});

test("a refusal recorded inside the rollout is read, not inferred", () => {
  const fixture = buildFixture("provider-rollout-refusal");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => new Date("2026-10-25T20:00:00Z") });
  const file = writeRollout(fixture, "refused.jsonl", rolloutText({
    reached: "primary",
    refusalMessage: "You've hit your usage limit.",
    refusalAt: "2026-10-25T19:57:00.000Z"
  }));
  const imported = pipeline.importProviderUsage({ file });
  assert.equal(imported.provider.code, "provider_refused");
  assert.match(imported.provider.refusal.message, /usage limit/);
  assert.equal(imported.queue.paused, true);
});

test("recording a refusal switches the provider half on, because a refusal proves the limit applies", () => {
  const fixture = buildFixture("provider-refusal-enables");
  const pipeline = pipelineFor(fixture, { now: () => new Date("2026-10-25T20:00:00Z") });
  assert.equal(pipeline.budget().provider.enforced, false);
  const refused = pipeline.recordProviderRefusal({ message: "Usage limit reached for this account.", resets_at: PRIMARY_RESET });
  assert.equal(refused.provider.enforced, true);
  assert.equal(refused.provider.code, "provider_refused");
  assert.equal(refused.queue.paused, true);
});



test("a return is registered only when the rollout records the same model, the same bytes and the dispatched envelope", () => {
  const fixture = buildFixture("provider-receipt");
  const pipeline = pipelineFor(fixture, { provider: { enabled: true }, now: () => new Date("2026-10-25T20:00:00Z") });
  pipeline.importProviderUsage({ file: writeRollout(fixture, "baseline.jsonl", rolloutText()) });
  const topicId = fixture.topics[0].topic_id;
  const dispatched = pipeline.dispatch(topicId, "research");
  const envelope = dispatched.envelope.sha256;
  const document = completeDocument("Receipt report");
  const bytes = Buffer.from(document, "utf8");

  assert.throws(
    () => pipeline.submit(topicId, "research", bytes, { model: "gpt-6-astra", envelope_sha256: "0".repeat(64) }),
    error => error.code === "envelope_mismatch"
  );
  const wrongModel = writeRollout(fixture, "wrong-model.jsonl", rolloutText({ messages: [document] }));
  assert.throws(
    () => pipeline.submit(topicId, "research", bytes, { model: "gpt-5-codex", rollout: wrongModel, envelope_sha256: envelope }),
    error => error.code === "model_mismatch" && /records gpt-6-astra/.test(error.message)
  );
  const otherAnswer = writeRollout(fixture, "other-answer.jsonl", rolloutText({ messages: ["A different document entirely."] }));
  assert.throws(
    () => pipeline.submit(topicId, "research", bytes, { model: "gpt-6-astra", rollout: otherAnswer, envelope_sha256: envelope }),
    error => error.code === "return_not_in_rollout"
  );
  assert.equal(pipeline.documents().length, 0, "nothing refused by a receipt reaches the registry");

  // The answer was emitted after a short preamble, which is how a real run writes it; the document is the
  // second assistant message, and the receipt proves it came from this thread and model.
  const real = writeRollout(fixture, "real.jsonl", rolloutText({
    observedAt: "2026-10-25T20:05:00.000Z",
    messages: ["I checked the sources before writing this up.", document]
  }));
  const registered = pipeline.submit(topicId, "research", bytes, {
    model: "gpt-6-astra",
    rollout: real,
    envelope_sha256: envelope
  });
  assert.equal(registered.duplicate, false);
  assert.equal(registered.registration.version, 1);
  assert.equal(registered.execution.model, "gpt-6-astra");
  assert.equal(registered.execution.thread_id, "thread-fixture");
  assert.equal(registered.execution.envelope_sha256, envelope);
  assert.equal(registered.execution.usage.input_tokens, 1200);
  assert.ok(fs.existsSync(registered.execution.receipt_path));

  const queue = JSON.parse(fs.readFileSync(pipeline.paths.queue, "utf8"));
  assert.equal(queue.jobs[`${topicId}/research`].execution.model, "gpt-6-astra");
  assert.equal(queue.jobs[`${topicId}/research`].execution.rollout.sha256, sha256(Buffer.from(fs.readFileSync(real))));
  // The same run is also the freshest provider reading, so the allowance moves with the work.
  assert.equal(pipeline.budget().provider.observed_at, "2026-10-25T20:05:00.000Z");
  assert.equal(pipeline.budget().provider.code, "provider_ok");

  // A retry of the same bytes is idempotent and does not spend or duplicate anything.
  const retried = pipeline.submit(topicId, "research", bytes, { model: "gpt-6-astra", rollout: real });
  assert.equal(retried.duplicate, true);
  assert.equal(retried.registration.version, 1);
  assert.equal(pipeline.budget().used, 1);
});

test("a receipt records the search the run actually made, and a required search is refused when it made none", () => {
  const fixture = buildFixture("provider-search");
  const pipeline = pipelineFor(fixture, { now: () => new Date("2026-10-25T20:00:00Z") });
  const topicId = fixture.topics[0].topic_id;
  const dispatched = pipeline.dispatch(topicId, "research");
  const document = completeDocument("Search report");
  const bytes = Buffer.from(document, "utf8");
  const rollout = writeRollout(fixture, "run.jsonl", rolloutText({
    observedAt: "2026-10-25T20:05:00.000Z",
    messages: [document]
  }));

  const silent = writeExecLog(fixture, "silent.jsonl", execLogText("thread-fixture", []));
  assert.throws(
    () => pipeline.submit(topicId, "research", bytes, { model: "gpt-6-astra", rollout, exec_log: silent, require_search: true }),
    error => error.code === "search_not_observed"
  );

  const otherThread = writeExecLog(fixture, "other-thread.jsonl", execLogText("thread-elsewhere", [
    { query: "VIX and USD", sources: ["https://www.cboe.com/vix"] }
  ]));
  assert.throws(
    () => pipeline.submit(topicId, "research", bytes, { model: "gpt-6-astra", rollout, exec_log: otherThread }),
    error => error.code === "exec_log_mismatch"
  );

  const log = writeExecLog(fixture, "search.jsonl", execLogText("thread-fixture", [{
    query: "VIX and USD direction",
    sources: ["https://www.cboe.com/vix", "https://fred.stlouisfed.org/series/VIXCLS"]
  }]));
  const registered = pipeline.submit(topicId, "research", bytes, {
    model: "gpt-6-astra",
    rollout,
    exec_log: log,
    require_search: true,
    envelope_sha256: dispatched.envelope.sha256
  });
  assert.equal(registered.registration.version, 1);
  assert.equal(registered.execution.search.searches, 1);
  assert.equal(registered.execution.search.thread_id, "thread-fixture");
  assert.deepEqual(registered.execution.search.queries, ["VIX and USD direction"]);
  assert.deepEqual(registered.execution.search.sources, ["https://www.cboe.com/vix", "https://fred.stlouisfed.org/series/VIXCLS"]);
  assert.ok(fs.existsSync(registered.execution.receipt_path));
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
    // These guards are about claims, envelopes and the registry. The allowance gate that needs a provider
    // reading is exercised on its own below, so a dispatch here says --provider-optional out loud rather than
    // leaning on the operational default.
    const args = String(argv[0]) === "dispatch" && !argv.includes("--provider-required")
      ? [...argv, "--provider-optional"]
      : [...argv];
    const code = runCli(args, io);
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

test("the CLI establishes the provider allowance from a rollout, records a refusal, and verifies a submit against the run", () => {
  const fixture = buildFixture("cli-provider");
  const cli = cliHarness();
  const root = ["--root", fixture.root];
  const topicId = fixture.topics[0].topic_id;
  const observedAt = new Date().toISOString();
  const primaryReset = new Date(Date.now() + 3600 * 1000).toISOString();
  const secondaryReset = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const freshRollout = options => rolloutText({ observedAt, primaryReset, secondaryReset, ...options });

  assert.equal(cli("allowance", ...root).json.allowance.provider.enforced, false, "the provider half stays off until the owner turns it on");
  const enabled = cli("allowance", "--provider", "on", ...root);
  assert.equal(enabled.code, 0);
  assert.equal(enabled.json.provider.enforced, true);
  const refused = cli("dispatch", topicId, "research", ...root);
  assert.equal(refused.code, 1);
  assert.equal(refused.error.code, "pipeline_paused");
  assert.match(refused.error.message, /no provider reading has been imported/);
  assert.equal(refused.json, null);

  const reading = writeRollout(fixture, "cli.jsonl", freshRollout());
  const imported = cli("allowance", "--from-rollout", reading, ...root);
  assert.equal(imported.code, 0);
  assert.equal(imported.json.provider.code, "provider_ok");
  assert.match(imported.json.provider.reason, /primary window is at 35%/);
  assert.equal(imported.json.queue.paused, false);

  const dispatched = cli("dispatch", topicId, "research", ...root);
  assert.equal(dispatched.code, 0);
  const envelope = dispatched.json.envelope.sha256;

  const document = completeDocument("CLI receipt report");
  const file = path.join(fixture.root, "returns", "cli.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, document, "utf8");

  const wrongModel = writeRollout(fixture, "cli-wrong.jsonl", freshRollout({ messages: [document] }));
  const mismatch = cli("submit", topicId, "research", "--file", file, "--model", "gpt-5-codex", "--rollout", wrongModel, ...root);
  assert.equal(mismatch.code, 1);
  assert.equal(mismatch.error.code, "model_mismatch");

  const good = writeRollout(fixture, "cli-good.jsonl", freshRollout({ messages: [document] }));
  const submitted = cli("submit", topicId, "research", "--file", file, "--model", "gpt-6-astra", "--rollout", good, "--envelope", envelope, ...root);
  assert.equal(submitted.code, 0);
  assert.equal(submitted.json.registration.version, 1);
  assert.equal(submitted.json.execution.model, "gpt-6-astra");
  assert.equal(submitted.json.execution.envelope_sha256, envelope);

  const refusal = cli("allowance", "--refusal", "You've hit your usage limit.", "--resets-at", primaryReset, ...root);
  assert.equal(refusal.code, 0);
  assert.equal(refusal.json.provider.code, "provider_refused");
  assert.equal(refusal.json.queue.paused, true);
  assert.equal(cli("dispatch", topicId, "red_team", ...root).error.code, "pipeline_paused");
  assert.equal(cli("resume", ...root).error.code, "provider_refused");
});

test("the delivery plan names the hosted owner, the stage number and the catalogued prompt provenance", () => {
  const fixture = buildFixture("delivery-plan");
  const pipeline = pipelineFor(fixture);
  const topic = fixture.topics[0];

  // On this fixture the topic carries its own stages, so the owner id is the topic. On the committed catalogue
  // a topic is a display group and the owner is the factor chain id, which is the same value the page uploads
  // under; either way it is derived from the catalogue, never typed.
  const plan = pipeline.deliveryPlan(topic.topic_id, "research");
  assert.equal(plan.topicId, topic.topic_id);
  assert.equal(plan.group_topic_id, topic.topic_id);
  assert.equal(plan.stage, 1);
  assert.equal(plan.stage_id, "research");
  assert.equal(plan.kind, "report");
  assert.equal(plan.parent, null);
  assert.equal(plan.provenance.prompt_path, topic.stages[0].prompt_path);
  assert.equal(plan.provenance.prompt_sha256, topic.stages[0].prompt_sha256);

  assert.throws(
    () => pipeline.deliveryPlan(topic.topic_id, "red_team"),
    error => error.code === "parent_missing"
  );
});

test("a document produced elsewhere is adopted, read back and shown as the delivered stage", () => {
  const fixture = buildFixture("adopt");
  const pipeline = pipelineFor(fixture);
  const topic = fixture.topics[0];
  const chain = fixture.catalog.factor_chains[0];
  const bytes = Buffer.from(completeDocument("adopted research report"), "utf8");
  const hostedPath = `${topic.topic_id}/1/v1-${sha256(bytes)}.md`;

  const result = pipeline.adopt(topic.topic_id, "research", bytes, {
    model: "gpt-6-astra",
    source: "D:/trading-agent-dashboard-pilot/runs/20261025-dxy/research.md",
    provenance: {
      prompt_path: "prompts/earlier-research.md",
      prompt_sha256: "a".repeat(64),
      prompt_bytes: 9109,
      catalog_version: "research-prompt-v3.1.0"
    },
    hosted: {
      ok: true,
      sha256: sha256(bytes),
      row_id: "row-1",
      storage_path: hostedPath,
      version: 1,
      duplicate: false,
      readback: { ok: true, sha256: sha256(bytes), bytes: bytes.length }
    }
  });

  assert.equal(result.registration.document_id, stageDocumentId(topic.topic_id, "research"));
  assert.equal(result.registration.sha256, sha256(bytes));
  assert.equal(result.hosted.row_id, "row-1");
  assert.equal(result.hosted.storage_path, hostedPath);
  assert.equal(pipeline.budget().used, 0, "an adoption spends no allowance unit");
  assert.deepEqual(pipeline.jobs(), {}, "an adoption claims no dispatch");

  const stored = pipeline.store.readObject(result.registration.document_id, 1);
  assert.equal(sha256(stored.bytes), sha256(bytes));
  const document = pipeline.documents().find(entry => entry.document_id === result.registration.document_id);
  assert.match(document.versions[0].note, /no dispatch in this queue is claimed and no allowance unit was spent/);
  assert.match(document.versions[0].note, /prompts\/earlier-research\.md sha256 a{64} \(9109 bytes\)/);
  assert.match(document.versions[0].note, /row-1/);

  const entry = pipeline.plan({ topicId: topic.topic_id }).find(candidate => candidate.stage === "research");
  assert.equal(entry.page_state, "delivered");
  assert.equal(entry.runnable, false);

  // With the research stage delivered, the hosted plan for the review names the exact version it judges.
  const review = pipeline.deliveryPlan(topic.topic_id, "red_team");
  assert.equal(review.stage, 2);
  assert.deepEqual(review.parent, { stage_number: 1, version: 1, sha256: sha256(bytes), research_version: 1 });
});

test("an adoption is refused when the hosted row does not carry the bytes it would record", () => {
  const fixture = buildFixture("adopt-mismatch");
  const pipeline = pipelineFor(fixture);
  const topic = fixture.topics[0];
  const bytes = Buffer.from(completeDocument("adopted research report"), "utf8");

  assert.throws(
    () => pipeline.adopt(topic.topic_id, "research", bytes, {
      model: "gpt-6-astra",
      hosted: { ok: true, sha256: "b".repeat(64), row_id: "row-2", storage_path: "x/1/v1-b.md", version: 1 }
    }),
    error => error.code === "hosted_readback_mismatch"
  );
  assert.throws(
    () => pipeline.adopt(topic.topic_id, "research", bytes, {
      model: "gpt-6-astra",
      hosted_required: true
    }),
    error => error.code === "hosted_not_configured"
  );
  assert.equal(fs.existsSync(fixture.registryPath), false, "a refused adoption records nothing");
});

test("a dispatch without a provider reading is paused instead of spending an allowance unit", () => {
  const fixture = buildFixture("provider-gate");
  const topicId = fixture.topics[0].topic_id;
  const off = pipelineFor(fixture);
  assert.throws(() => off.dispatch(topicId, "research", { require_provider: true }), error => error.code === "provider_disabled");
  assert.equal(off.budget().used, 0);
  assert.equal(off.status().paused, true, "a missing reading pauses the queue");
  assert.throws(() => off.dispatch(topicId, "research", { require_provider: true }), error => error.code === "pipeline_paused");

  const unknownFixture = buildFixture("provider-gate-unknown");
  const enabled = pipelineFor(unknownFixture, { provider: { enabled: true } });
  assert.throws(
    () => enabled.dispatch(unknownFixture.topics[0].topic_id, "research", { require_provider: true }),
    error => error.code === "provider_allowance_unknown"
  );
  assert.equal(enabled.budget().used, 0);
});

test("the CLI dispatch refuses a missing provider reading, and still refuses once the provider half is on", () => {
  const fixture = buildFixture("cli-provider");
  const cli = cliHarness();
  const root = ["--root", fixture.root];
  const topicId = fixture.topics[0].topic_id;

  const refused = cli("dispatch", topicId, "research", "--provider-required", ...root);
  assert.equal(refused.code, 1);
  assert.equal(refused.error.code, "provider_disabled");
  assert.equal(cli("allowance", ...root).json.allowance.used, 0);

  assert.equal(cli("allowance", "--provider", "on", ...root).code, 0);
  const stillRefused = cli("dispatch", topicId, "research", "--provider-required", ...root);
  assert.equal(stillRefused.code, 1, "switching the provider half on without a reading still pauses dispatch");
  assert.ok(["provider_allowance_unknown", "pipeline_paused"].includes(stillRefused.error.code), stillRefused.error.code);
});

