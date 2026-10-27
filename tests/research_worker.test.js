"use strict";

// The unattended worker's guards, driven end to end without a model.
//
// A stub carrier stands in for `codex exec` and a stub hosted store stands in for the project bucket, so one
// whole pass can be run against a fixture: dispatch, carrier, verification against the run's own record,
// hosted registration, local adoption and the receipt. Nothing here touches the network, a real Codex home or
// the committed research library.

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createPipeline } = require("../lib/research_pipeline.js");
const { createWorker } = require("../lib/research_worker.js");

// The pass runs at a fixed instant, thirty minutes after the reading it is given, so the provider gate is
// decided by the numbers and not by the clock the test happens to run on.
const NOW = "2026-10-26T12:00:00.000Z";
const OBSERVED = "2026-10-26T11:30:00.000Z";
const PRIMARY_RESET = "2026-10-26T17:00:00.000Z";
const SECONDARY_RESET = "2026-11-01T11:07:00.000Z";
const MODEL = "gpt-6-astra";

const CREATED_ROOTS = [];

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function tempRoot(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `rw-${label}-`));
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

// A complete-looking stage deliverable: long enough, five headings, no truncation marker. It is not good
// research and is not meant to be; only completeness is under test here.
function completeDocument(title) {
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
    paragraph
  ].join("\n") + "\n";
}

// The stub carrier. It is a real child process, started the way the worker starts `codex exec`: the envelope on
// stdin, `-o` for the answer, an event stream on stdout and a rollout under the Codex home. What it writes is
// decided by `config.json` beside it, so one fixture can answer, answer without a search, answer with a
// document that never appeared in the run, or fail.
const STUB_CARRIER = [
  '"use strict";',
  'const fs = require("node:fs");',
  'const path = require("node:path");',
  'const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));',
  'if (config.delayMs) {',
  '  const until = Date.now() + config.delayMs;',
  '  while (Date.now() < until) { /* a slow run, for the timeout guard */ }',
  '}',
  'const argv = process.argv.slice(2);',
  'const flagValue = name => {',
  '  const index = argv.indexOf(name);',
  '  return index === -1 ? null : argv[index + 1];',
  '};',
  'const answerPath = flagValue("-o");',
  'const envelope = fs.readFileSync(0, "utf8");',
  'fs.writeFileSync(path.join(__dirname, "last-envelope.md"), envelope, "utf8");',
  'const events = [{ type: "thread.started", thread_id: config.threadId }];',
  '(config.searches || []).forEach((entry, index) => {',
  '  events.push({',
  '    type: "item.completed",',
  '    item: { id: "search_" + index, type: "web_search", query: entry.query, action: { type: "search", query: entry.query }, results: (entry.sources || []).map(url => ({ type: "text_result", url })) }',
  '  });',
  '});',
  'events.push({ type: "item.completed", item: { id: "final", type: "agent_message", text: "delivered" } });',
  'process.stdout.write(events.map(event => JSON.stringify(event)).join("\\n") + "\\n");',
  'if (!config.document) {',
  '  process.exit(config.exitCode || 0);',
  '}',
  'fs.mkdirSync(path.dirname(answerPath), { recursive: true });',
  'fs.writeFileSync(answerPath, config.document, "utf8");',
  'if (config.includeRollout !== false) {',
  '  const observed = config.observedAt || "2026-10-26T11:30:00.000Z";',
  '  const assistant = config.rolloutText === undefined ? config.document : config.rolloutText;',
  '  const lines = [',
  '    { timestamp: observed, type: "session_meta", payload: { id: config.threadId, cli_version: "0.164.0", model_provider: "openai" } },',
  '    { timestamp: observed, type: "turn_context", payload: { model: config.model || "gpt-6-astra" } }',
  '  ];',
  '  if (assistant) {',
  '    lines.push({ timestamp: observed, type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: assistant }] } });',
  '  }',
  '  const sessions = path.join(config.codexHome, "sessions", "2026", "10", "26");',
  '  fs.mkdirSync(sessions, { recursive: true });',
  '  const file = path.join(sessions, "rollout-2026-10-26T11-30-00-" + config.threadId + ".jsonl");',
  '  fs.writeFileSync(file, lines.map(line => JSON.stringify(line)).join("\\n") + "\\n", "utf8");',
  '}',
  'process.exit(config.exitCode || 0);',
  ""
].join("\n");

// One factor id per fixture topic, because a factor in the catalogue names exactly one chain and an upload is
// resolved through that chain.
const FIXTURE_FACTOR = "fx.fixture-level";

function buildFixture(label) {
  const root = tempRoot(label);
  const topicId = "usd-topic-fixture-a";
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
  const topic = {
    topic_id: topicId,
    asset: "USD",
    title: "Fixture topic A",
    summary: "What the fixture topic asks.",
    factor_ids: [`${FIXTURE_FACTOR}-a`],
    stages
  };
  const chainId = `usd-factor-${topicId.replace(/^usd-topic-/, "usd-")}`;
  const catalog = {
    schema_version: "research-library-catalog-v1",
    assets: [{ asset: "USD", factors: [{ factor_id: topic.factor_ids[0], label: topic.title }] }],
    topics: [topic],
    factor_chains: [{
      chain_id: chainId,
      factor_id: topic.factor_ids[0],
      asset: topic.asset,
      topic_id: topic.topic_id,
      group_title: topic.title,
      slug: topic.topic_id.replace(/^usd-topic-/, ""),
      title: `Fixture factor - ${topic.factor_ids[0]}`,
      summary: topic.summary,
      stages
    }],
    tasks: []
  };
  const catalogPath = path.join(root, "data", "research-library", "catalog.json");
  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  const stubDir = path.join(root, "stub");
  fs.mkdirSync(stubDir, { recursive: true });
  const carrierPath = path.join(stubDir, "carrier.js");
  fs.writeFileSync(carrierPath, STUB_CARRIER, "utf8");

  return {
    root,
    catalog,
    catalogPath,
    topic,
    chainId,
    stages,
    registryPath: path.join(root, "data", "research-library", "documents.json"),
    libraryRoot: path.join(root, ".local", "research-library"),
    stateRoot: path.join(root, ".local", "research-pipeline"),
    codexHome: path.join(root, "codex-home"),
    stubDir,
    carrierPath,
    stubConfigPath: path.join(stubDir, "config.json"),
    envelopeCopy: path.join(stubDir, "last-envelope.md")
  };
}

// The provider reading the pass is allowed to dispatch against: 35% of the five-hour window and 8% of the
// weekly one, both resets still ahead of the pass.
function providerRolloutText(options = {}) {
  const limits = {
    limit_id: "codex",
    primary: {
      used_percent: options.primaryUsed === undefined ? 35 : options.primaryUsed,
      window_minutes: 300,
      resets_at: Math.floor(Date.parse(PRIMARY_RESET) / 1000)
    },
    secondary: {
      used_percent: options.secondaryUsed === undefined ? 8 : options.secondaryUsed,
      window_minutes: 10080,
      resets_at: Math.floor(Date.parse(SECONDARY_RESET) / 1000)
    },
    credits: { has_credits: true, unlimited: false, balance: "144.7441982500" },
    plan_type: "plus",
    rate_limit_reached_type: null
  };
  const events = [
    { timestamp: OBSERVED, type: "session_meta", payload: { id: "thread-provider", cli_version: "0.164.0", model_provider: "openai" } },
    { timestamp: OBSERVED, type: "turn_context", payload: { model: MODEL } },
    { timestamp: OBSERVED, type: "event_msg", payload: { type: "token_count", rate_limits: limits } }
  ];
  return `${events.map(event => JSON.stringify(event)).join("\n")}\n`;
}

function pipelineFor(fixture, options = {}) {
  return createPipeline({
    root: fixture.root,
    catalogPath: fixture.catalogPath,
    registryPath: fixture.registryPath,
    libraryRoot: fixture.libraryRoot,
    stateRoot: fixture.stateRoot,
    catalog: fixture.catalog,
    provider: { enabled: true },
    now: () => new Date(NOW),
    ...options
  });
}

// The hosted store as the worker sees it: a configured project, a version per (chain, stage) and a row id per
// upload. Every call is kept so a test can assert what the pass tried to store.
function hostedStub() {
  const calls = [];
  const versions = {};
  return {
    calls,
    versions,
    status: () => ({ configured: true, needed: [], url: "https://project.example", page: "/research" }),
    register: async input => {
      const digest = sha256(input.bytes);
      const key = `${input.topicId}/${input.stage}`;
      versions[key] = (versions[key] || 0) + 1;
      const version = versions[key];
      calls.push({ ...input, bytes: undefined, bytes_length: input.bytes.length, sha256: digest, version });
      return {
        ok: true,
        code: "hosted_readback_ok",
        message: `row ${key} v${version} read back at ${digest.slice(0, 12)}`,
        duplicate: false,
        row: { id: `row-${input.topicId}-${input.stage}-${version}`, storage_path: `research/${key}/v${version}.md`, version, sha256: digest },
        row_id: `row-${input.topicId}-${input.stage}-${version}`,
        storage_path: `research/${key}/v${version}.md`,
        version,
        sha256: digest,
        bytes: input.bytes.length,
        readback: { ok: true }
      };
    }
  };
}

function writeStubConfig(fixture, config) {
  const resolved = {
    threadId: config.threadId || "thread-fixture-a",
    codexHome: fixture.codexHome,
    model: MODEL,
    observedAt: OBSERVED,
    searches: config.searches === undefined ? [{ query: "usd funding basis", sources: ["https://example.org/funding"] }] : config.searches,
    document: config.document === undefined ? completeDocument(`Fixture topic A ${config.title || "research"}`) : config.document,
    ...config
  };
  fs.writeFileSync(fixture.stubConfigPath, `${JSON.stringify(resolved, null, 2)}\n`, "utf8");
  return resolved;
}

function workerFor(fixture, pipeline, hosted, options = {}) {
  return createWorker({
    pipeline,
    hosted,
    model: MODEL,
    codexHome: fixture.codexHome,
    carrier: { command: process.execPath, prefix: [fixture.carrierPath], spec: "stub-carrier" },
    ...options
  });
}

function writeProviderRollout(fixture, name, options = {}) {
  const filePath = path.join(fixture.root, "readings", name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, providerRolloutText(options), "utf8");
  return filePath;
}

// A rollout as `codex exec` leaves it under the Codex home: this is what a pass with no imported reading finds.
function writeCodexRollout(fixture, options = {}) {
  const filePath = path.join(fixture.codexHome, "sessions", "2026", "10", "26", `rollout-2026-10-26T11-30-00-${options.threadId || "thread-provider"}.jsonl`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, providerRolloutText(options), "utf8");
  return filePath;
}

test("one pass delivers the next stage through the hosted store and writes a receipt", async () => {
  const fixture = buildFixture("deliver");
  const document = completeDocument("Fixture topic A research");
  writeStubConfig(fixture, { document, threadId: "thread-fixture-a" });
  const pipeline = pipelineFor(fixture);
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "baseline.jsonl") });
  const hosted = hostedStub();
  const worker = workerFor(fixture, pipeline, hosted);

  const summary = await worker.run();
  assert.equal(summary.ok, true, JSON.stringify(summary.stopped));
  assert.equal(summary.stopped.reason, "stage_budget");
  assert.equal(summary.stages.length, 1);

  const stage = summary.stages[0];
  assert.equal(stage.stage, "research");
  assert.equal(stage.status, "delivered");
  assert.equal(stage.answer_bytes, Buffer.byteLength(document, "utf8"));
  assert.equal(stage.answer_sha256, sha256(Buffer.from(document, "utf8")));
  assert.equal(stage.thread_id, "thread-fixture-a");
  assert.equal(stage.searches, 1, "the completed search is counted from the run's own event stream");
  assert.equal(stage.registration.version, 1);

  // The hosted store carries the same bytes the answer holds, and the local adoption followed it.
  assert.equal(hosted.calls.length, 1);
  const stored = hosted.calls[0];
  assert.equal(stored.stage, 1, "the hosted store keys a stage by its number, research being 1");
  assert.equal(stored.model, MODEL);
  assert.equal(stored.sha256, stage.answer_sha256);
  assert.equal(stored.bytes_length, Buffer.byteLength(document, "utf8"));
  assert.equal(stagedRowVersion(hosted, 1), 1);
  assert.equal(stage.hosted.version, 1);
  assert.equal(stage.stage_after, "delivered");

  const entries = pipeline.plan({ topicId: fixture.topic.topic_id });
  assert.equal(entries[0].page_state, "delivered");
  assert.equal(entries[1].runnable, true, "the red-team stage is next once research is delivered");

  // The receipt is the record of the run, and it names the thread, the search and the hosted row.
  assert.ok(fs.existsSync(stage.receipt_path), stage.receipt_path);
  const receipt = JSON.parse(fs.readFileSync(stage.receipt_path, "utf8"));
  assert.equal(receipt.execution.thread_id, "thread-fixture-a");
  assert.equal(receipt.execution.model, MODEL);
  assert.equal(receipt.execution.search.count, 1);
  assert.deepEqual(receipt.execution.search.sources, ["https://example.org/funding"]);
  assert.equal(receipt.delivery.registration.version, 1);
  assert.equal(receipt.delivery.hosted.sha256, stage.answer_sha256);
  assert.equal(receipt.answer.sha256, stage.answer_sha256);
  assert.equal(pipeline.budget().used, 1);

  // The envelope the carrier was handed is the one the pipeline wrote, prompt hash and all.
  const envelope = fs.readFileSync(fixture.envelopeCopy, "utf8");
  assert.ok(envelope.includes(fixture.stages[0].prompt_sha256), "the carrier saw the catalogued prompt");
  assert.ok(fs.existsSync(stage.exec_log), "the event stream is kept because a search is only visible there");
});

// The hosted stub keys a version per (topic, stage); a test that asserts the stage's version uses this.
function stagedRowVersion(hosted, stage) {
  return Object.entries(hosted.versions).filter(([key]) => key.endsWith(`/${stage}`)).map(([, version]) => version)[0];
}

test("a run that retrieved nothing is refused and nothing is stored", async () => {
  const fixture = buildFixture("no-search");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research"), searches: [] });
  const pipeline = pipelineFor(fixture);
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "baseline.jsonl") });
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.ok, false);
  assert.equal(summary.stopped.reason, "stage_refused");
  assert.equal(summary.stopped.code, "search_not_observed");
  assert.match(summary.stopped.message, /no completed web_search item/);
  assert.equal(summary.stages[0].status, "refused");
  assert.equal(hosted.calls.length, 0, "a document that cannot be shown to have a source is not registered");
  const entry = pipeline.plan({ topicId: fixture.topic.topic_id })[0];
  assert.equal(entry.page_state, "not_started", "a refused run registers nothing, so the page keeps the stage waiting");
  assert.equal(entry.claim_held, true, "the claim is left to expire rather than handed to the next pass");
  assert.equal(fs.existsSync(path.join(pipeline.paths.state_root, "receipts")), false);
  // The stage was claimed and the unit was spent: the claim is left to expire rather than retried in the same pass.
  assert.equal(pipeline.budget().used, 1);
});

test("the pass does not dispatch against a provider budget nobody read", async () => {
  const fixture = buildFixture("provider-off");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research") });
  const pipeline = pipelineFor(fixture, { provider: { enabled: false } });
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.ok, false);
  assert.equal(summary.stopped.reason, "stage_refused");
  assert.equal(summary.stopped.code, "provider_disabled");
  assert.equal(summary.allowance.provider.enforced, false);
  assert.equal(summary.provider_reading.skipped, true, "a pass does not switch the provider half on itself");
  assert.equal(summary.provider_reading.code, "provider_disabled");
  assert.equal(pipeline.budget().used, 0, "no dispatch was authorised, so nothing was spent");
  assert.equal(hosted.calls.length, 0);
  assert.equal(pipeline.status().paused, true);
  assert.equal(pipeline.status().paused_by, "allowance");
  assert.equal(fs.existsSync(fixture.envelopeCopy), false, "the carrier was never started");
});

test("a pass with no imported reading reads the newest rollout under its own Codex home", async () => {
  const fixture = buildFixture("provider-latest");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research") });
  const pipeline = pipelineFor(fixture);
  const rollout = writeCodexRollout(fixture, { primaryUsed: 42, secondaryUsed: 11 });
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.ok, true, JSON.stringify(summary.stopped));
  assert.equal(summary.provider_reading.ok, true, JSON.stringify(summary.provider_reading));
  assert.equal(summary.provider_reading.path, rollout);
  assert.equal(summary.allowance.provider.ok, true, "the gate was decided on the rollout the pass read");
  const primary = summary.allowance.provider.windows.find(window => window.name === "primary");
  assert.equal(primary.used_percent, 42);
  assert.equal(summary.stages[0].status, "delivered");
});

test("a rollout with no rate-limit event is reported and does not become a reading", async () => {
  const fixture = buildFixture("provider-incomplete");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research") });
  const pipeline = pipelineFor(fixture);
  // A run started with --ephemeral writes a rollout with no limit numbers, and a pass must not invent them.
  const rollout = path.join(fixture.codexHome, "sessions", "2026", "10", "26", "rollout-2026-10-26T11-40-00-thread-quiet.jsonl");
  fs.mkdirSync(path.dirname(rollout), { recursive: true });
  fs.writeFileSync(rollout, `${JSON.stringify({ timestamp: OBSERVED, type: "session_meta", payload: { id: "thread-quiet", cli_version: "0.164.0", model_provider: "openai" } })}\n`, "utf8");
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.provider_reading.ok, false);
  assert.equal(summary.provider_reading.code, "provider_reading_incomplete");
  assert.equal(summary.provider_reading.path, rollout);
  assert.equal(summary.ok, false);
  assert.equal(summary.stopped.code, "provider_allowance_unknown", "with no usable reading the gate cannot authorise a dispatch");
  assert.equal(hosted.calls.length, 0);
  assert.equal(fs.existsSync(fixture.envelopeCopy), false);
});

test("the pass stops at the provider capacity without dispatching or storing", async () => {
  const fixture = buildFixture("provider-busy");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research") });
  const pipeline = pipelineFor(fixture);
  // 86% of the five-hour window is past the 85% ceiling that keeps 15% for the owner.
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "busy.jsonl", { primaryUsed: 86 }) });
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.ok, false);
  assert.equal(summary.stopped.reason, "provider_gate");
  assert.equal(summary.stopped.code, "provider_allowance_exhausted");
  assert.match(summary.stopped.message, /primary window is at 86%/);
  assert.match(summary.stopped.message, /stops at 85%/);
  assert.equal(summary.allowance.provider.ok, false);
  assert.equal(summary.stages.length, 0, "the gate stops the pass before a stage is chosen");
  assert.equal(pipeline.budget().used, 0);
  assert.equal(hosted.calls.length, 0);
  assert.equal(pipeline.status().paused_by, "allowance");
});

test("an answer the run never produced is refused before it can be stored", async () => {
  const fixture = buildFixture("not-in-rollout");
  writeStubConfig(fixture, {
    document: completeDocument("Fixture topic A research"),
    rolloutText: "A short note the run never actually wrote.\n"
  });
  const pipeline = pipelineFor(fixture);
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "baseline.jsonl") });
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.ok, false);
  assert.equal(summary.stopped.code, "return_not_in_rollout");
  assert.match(summary.stopped.message, /does not appear in/);
  assert.equal(hosted.calls.length, 0);
  assert.equal(pipeline.plan({ topicId: fixture.topic.topic_id })[0].page_state, "not_started");
});

test("a carrier that fails or never finishes is refused and leaves the stage undelivered", async () => {
  const failing = buildFixture("carrier-failed");
  writeStubConfig(failing, { document: null, exitCode: 2 });
  const failPipeline = pipelineFor(failing);
  failPipeline.importProviderUsage({ file: writeProviderRollout(failing, "baseline.jsonl") });
  const failedSummary = await workerFor(failing, failPipeline, hostedStub()).run();
  assert.equal(failedSummary.stopped.code, "carrier_failed");
  assert.match(failedSummary.stopped.message, /exited 2/);

  const slow = buildFixture("carrier-timeout");
  writeStubConfig(slow, { document: completeDocument("Fixture topic A research"), delayMs: 5000 });
  const slowPipeline = pipelineFor(slow);
  slowPipeline.importProviderUsage({ file: writeProviderRollout(slow, "baseline.jsonl") });
  const slowHosted = hostedStub();
  const timedOut = await workerFor(slow, slowPipeline, slowHosted, { timeoutMs: 150 }).run();
  assert.equal(timedOut.stopped.code, "carrier_timeout");
  assert.equal(timedOut.stages[0].carrier.timed_out, true);
  assert.equal(slowHosted.calls.length, 0);
});

test("a pass whose hosted store is not configured does not adopt the document locally", async () => {
  const fixture = buildFixture("hosted-off");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research") });
  const pipeline = pipelineFor(fixture);
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "baseline.jsonl") });
  const hosted = hostedStub();
  hosted.status = () => ({ configured: false, needed: ["RESEARCH_STORE_URL", "RESEARCH_STORE_TOKEN"] });

  const summary = await workerFor(fixture, pipeline, hosted).run();
  assert.equal(summary.ok, false);
  assert.equal(summary.stopped.code, "hosted_not_configured");
  assert.match(summary.stopped.message, /RESEARCH_STORE_URL/);
  assert.equal(fs.existsSync(summary.stages[0].answer), true, "the run did answer; it simply was not delivered");
  assert.equal(pipeline.plan({ topicId: fixture.topic.topic_id })[0].page_state, "not_started");
  const registry = fs.existsSync(pipeline.paths.registry)
    ? JSON.parse(fs.readFileSync(pipeline.paths.registry, "utf8"))
    : {};
  assert.deepEqual(registry.documents || [], [], "nothing is recorded locally that the dashboard cannot serve");
});

test("a scheduled pass refuses to start a carrier whose answer it could not deliver", async () => {
  // The guard the scheduled task relies on: with the hosted store unconfigured, the CLI must stop before the
  // pipeline takes a claim or a unit of allowance, because the answer would be paid for and then have nowhere to
  // go. The web-search and carrier stubs are not reached at all.
  const { deliverabilityGuard } = require("../scripts/research-worker.js");

  const refused = deliverabilityGuard({
    storeStatus: () => ({ configured: false, needed: ["RESEARCH_WORKER_EMAIL", "RESEARCH_WORKER_PASSWORD"] })
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "hosted_not_configured");
  assert.match(refused.message, /RESEARCH_WORKER_EMAIL, RESEARCH_WORKER_PASSWORD/);

  const ready = deliverabilityGuard({
    storeStatus: () => ({ configured: true, needed: [], host: "project.example", bucket: "research-documents" })
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.host, "project.example");

  // A store that cannot be asked at all is a refusal rather than an assumption that it is fine.
  const unreadable = deliverabilityGuard({
    storeStatus: () => { throw new Error("script.js is unreadable"); }
  });
  assert.equal(unreadable.ok, false);
  assert.match(unreadable.message, /script\.js is unreadable/);

  // A dry run delivers nothing, so it is not asked to; and the deliberate escape hatch lets a report be produced
  // for a store that is not configured yet, without ever being what a scheduled task carries.
  assert.deepEqual(deliverabilityGuard({ dryRun: true, storeStatus: () => { throw new Error("must not be asked"); } }), { ok: true, skipped: "dry_run" });
  assert.deepEqual(
    deliverabilityGuard({ allowUnconfigured: true, storeStatus: () => ({ configured: false, needed: ["x"] }) }),
    { ok: true, skipped: "allow_unconfigured_store" }
  );
});

test("a dry run plans the next stage and starts nothing", async () => {
  const fixture = buildFixture("dry-run");
  writeStubConfig(fixture, { document: completeDocument("Fixture topic A research") });
  const pipeline = pipelineFor(fixture);
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "baseline.jsonl") });
  const hosted = hostedStub();

  const summary = await workerFor(fixture, pipeline, hosted, { dryRun: true }).run();
  assert.equal(summary.ok, true);
  assert.equal(summary.stopped.reason, "dry_run");
  assert.equal(summary.stages.length, 1);
  assert.equal(summary.stages[0].status, "planned");
  assert.equal(summary.stages[0].stage, "research");
  assert.equal(summary.stages[0].prompt_sha256, fixture.stages[0].prompt_sha256);
  assert.equal(pipeline.budget().used, 0);
  assert.equal(hosted.calls.length, 0);
  assert.equal(fs.existsSync(fixture.envelopeCopy), false);
  assert.equal(pipeline.plan({ topicId: fixture.topic.topic_id })[0].page_state, "not_started");
});

test("a second pass takes the red-team stage and registers it against the researched version", async () => {
  const fixture = buildFixture("two-passes");
  const research = completeDocument("Fixture topic A research");
  writeStubConfig(fixture, { document: research, threadId: "thread-fixture-a" });
  const pipeline = pipelineFor(fixture);
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "baseline.jsonl") });
  const hosted = hostedStub();
  const worker = workerFor(fixture, pipeline, hosted);

  const first = await worker.run();
  assert.equal(first.stages[0].stage, "research");
  assert.equal(first.stages[0].status, "delivered");

  const redTeam = completeDocument("Fixture topic A red-team");
  writeStubConfig(fixture, { document: redTeam, threadId: "thread-fixture-b", title: "red-team" });
  // A fresh reading arrives with the second run, as it would from the run that just finished.
  pipeline.importProviderUsage({ file: writeProviderRollout(fixture, "second.jsonl", { observedAt: NOW, primaryUsed: 41 }) });

  const second = await worker.run();
  assert.equal(second.ok, true, JSON.stringify(second.stopped));
  assert.equal(second.stages[0].stage, "red_team");
  assert.equal(second.stages[0].status, "delivered");
  assert.equal(second.stages[0].thread_id, "thread-fixture-b");
  assert.equal(pipeline.budget().used, 2);

  assert.equal(hosted.calls.length, 2);
  assert.equal(hosted.calls[1].parent.version, 1);
  assert.equal(hosted.calls[1].parent.sha256, sha256(Buffer.from(research, "utf8")), "the review is registered against the report it judges");
  assert.equal(hosted.calls[1].sha256, sha256(Buffer.from(redTeam, "utf8")));

  const entries = pipeline.plan({ topicId: fixture.topic.topic_id });
  assert.deepEqual(entries.map(entry => entry.page_state), ["delivered", "delivered", "awaiting_upload"]);
  assert.equal(entries[2].runnable, true, "adjudication is next once the review is delivered");
});
