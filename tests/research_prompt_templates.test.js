"use strict";

// Prompt-template guards: one versioned skeleton, three stages, two chain shapes.
//
// These tests hold the boundary the template exists for: every stage prompt is rendered from one
// versioned source, states its own session and deliverable, names the files it is given, and refuses to
// ship a contradiction. They render in memory and touch no file, so they hold for any chain that later
// uses the template.

const test = require("node:test");
const assert = require("node:assert/strict");

const Prompts = require("../lib/research_prompt_templates.js");

function entry(overrides = {}) {
  return {
    factor_id: "fx.test-entry",
    label: "Test entry",
    role: "test role",
    group: "test group",
    brief: "a test entry that stands for something measurable",
    current_rules: [],
    threshold: "",
    lookback: "level",
    sources: ["a named series"],
    blockers: [],
    research_status: "ready",
    ...overrides
  };
}

function context(kind, stage, overrides = {}) {
  const slug = kind === "asset_synthesis" ? "candidate-model" : "test-topic";
  const topic = {
    topic_id: kind === "asset_synthesis" ? "usd-asset-synthesis" : "usd-topic-test",
    slug,
    title: "Test topic",
    question: "Does the test entry carry information about the next session?",
    probes: ["Is the test entry the same input twice?"]
  };
  return {
    kind,
    stage,
    profile: Prompts.assetProfile("USD"),
    date: "2026-10-25",
    topic,
    entries: [
      entry(),
      entry({ factor_id: "fx.test-entry-two", label: "Second entry", current_rules: ["reads BULLISH above 25"], threshold: "25" })
    ],
    companions: [{
      repo_path: "docs/research/usd-session/v1/session_contract_v1.json",
      role: "the session contract the cutoff comes from",
      anchor: "the cutoff and the endpoint",
      sha256: "c".repeat(64)
    }],
    given: stage === "research"
      ? []
      : [{ file_name: Prompts.deliverableFileName({ asset: "USD", slug, kind, stage: "research" }), note: "the stage 1 document for this topic, supplied by the operator" }],
    programme: { dispatched: false, superseded: [] },
    deliverable: { file_name: Prompts.deliverableFileName({ asset: "USD", slug, kind, stage }) },
    ...overrides
  };
}

const KINDS = Prompts.CHAIN_KINDS.slice();

test("the template is versioned and every prompt carries the same sections in the same order", () => {
  assert.match(Prompts.TEMPLATE_VERSION, /^research-prompt-v\d+\.\d+\.\d+$/);
  assert.deepEqual(Prompts.CHAIN_KINDS, ["factor", "asset_synthesis"]);
  assert.deepEqual(Prompts.STAGE_ORDER, ["research", "red_team", "adjudication"]);
  assert.equal(Prompts.SECTION_TITLES.length, 10, "the skeleton is ten sections");
  assert.equal(new Set(Prompts.SECTION_TITLES).size, 10, "no section is listed twice");
  Prompts.SECTION_TITLES.forEach(title => assert.ok(title.startsWith("## "), `${title} must be a level-two heading`));
  KINDS.forEach(kind => {
    assert.deepEqual(Prompts.STAGE_ORDER.map(stage => Prompts.stageMeta(kind, stage).order), [1, 2, 3]);
    assert.equal(Prompts.stageMeta(kind, "unknown"), null, "an unknown stage has no metadata");
  });
});

test("the deliverable file name is derived once per chain, topic and stage", () => {
  const factor = Prompts.STAGE_ORDER.map(stage => Prompts.deliverableFileName({ asset: "USD", slug: "test-topic", kind: "factor", stage }));
  assert.deepEqual(factor, [
    "usd-test-topic-s1-research.md",
    "usd-test-topic-s2-red-team.md",
    "usd-test-topic-s3-adjudication.md"
  ]);
  // The synthesis chain proposes a model at stage 1, so its first document is a proposal, not a report.
  assert.equal(Prompts.stageMeta("asset_synthesis", "research").deliverable_kind, "final-analysis");
  assert.equal(
    Prompts.deliverableFileName({ asset: "USD", slug: "candidate-model", kind: "asset_synthesis", stage: "research" }),
    "usd-candidate-model-s1-proposal.md"
  );
  [...factor, "usd-candidate-model-s1-proposal.md"].forEach(name => assert.ok(Prompts.FILE_NAME_RE.test(name), `${name} must match the library naming rule`));
  assert.equal(Prompts.deliverableFileName({ asset: "USD", slug: "test-topic", kind: "factor", stage: "unknown" }), "");
  assert.equal(Prompts.FILE_NAME_RE.test("usd-test-topic-s1-report.md"), false, "a hand-typed name is not a deliverable name");
});


test("every stage renders one self-contained prompt for both chain shapes", () => {
  KINDS.forEach(kind => {
    Prompts.STAGE_ORDER.forEach(stage => {
      const ctx = context(kind, stage);
      const prompt = Prompts.buildStagePrompt(ctx);
      const file = ctx.deliverable.file_name;
      assert.ok(prompt.startsWith("# "), `${kind}/${stage} needs a title line`);
      assert.ok(prompt.endsWith("\n") && !prompt.endsWith("\n\n"), `${kind}/${stage} must end with exactly one newline`);
      assert.ok(prompt.includes(ctx.topic.topic_id), `${kind}/${stage} must name its topic`);
      assert.ok(prompt.includes(Prompts.TEMPLATE_VERSION), `${kind}/${stage} must name the template version it came from`);
      assert.ok(prompt.includes(`\`${file}\``), `${kind}/${stage} must name its deliverable`);
      let cursor = -1;
      Prompts.SECTION_TITLES.forEach(title => {
        const at = prompt.indexOf(`${title}\n`);
        assert.ok(at > cursor, `${kind}/${stage} must carry ${title} in order`);
        cursor = at;
      });
      ctx.entries.forEach(item => assert.ok(prompt.includes(`\`${item.factor_id}\``), `${kind}/${stage} must name ${item.factor_id}`));
      // No instruction from an older workflow, and no placeholder for a value the reader may not have. A
      // fenced block is a form the operator fills with what they were given, so it is read as one too.
      Prompts.FORBIDDEN_PHRASES.forEach(phrase => assert.equal(prompt.toLowerCase().includes(phrase.toLowerCase()), false, `${kind}/${stage} must not mention ${phrase}`));
      assert.equal(/<[a-z][a-z0-9 _-]{0,48}>/i.test(prompt.replace(/```[\s\S]*?```/g, "")), false, `${kind}/${stage} must carry no angle-bracket placeholder`);
      // Stage 1 is given nothing but the checkout; stages 2 and 3 name the files the operator supplies.
      if (stage === "research") {
        assert.equal(prompt.includes("### Documents you are given"), false, `${kind}/research must not claim an upstream document`);
      } else {
        assert.ok(prompt.includes("### Documents you are given"), `${kind}/${stage} must say what it is given`);
        assert.ok(prompt.includes(`\`${ctx.given[0].file_name}\``), `${kind}/${stage} must name the document it judges`);
      }
      assert.deepEqual(Prompts.auditPrompt(prompt, ctx), [], `${kind}/${stage} must pass its own audit`);
    });
  });
  // The three stages of one topic are three different documents, not three copies of one.
  const rendered = Prompts.STAGE_ORDER.map(stage => Prompts.buildStagePrompt(context("factor", stage)));
  assert.equal(new Set(rendered).size, 3);
});

test("a draft asset profile states its open decisions instead of assuming a session", () => {
  const profile = Prompts.assetProfile("eur");
  assert.equal(profile.status, "draft");
  const prompt = Prompts.buildStagePrompt(context("factor", "research", { profile }));
  assert.ok(prompt.includes("Asset status: draft"));
  assert.ok(prompt.includes("Session: not decided for this asset"));
  assert.ok(prompt.includes("EUR-Q1"), "the open decisions are carried into the prompt");
  assert.equal(prompt.includes("05:00 Europe/London"), false, "a draft asset must not be given the USD session");
  assert.equal(Prompts.assetProfile("ZZZ"), null);
  assert.deepEqual(Prompts.ASSET_ORDER.slice(0, 2), ["USD", "EUR"]);
});

test("the context validator refuses a prompt that could not be answered", () => {
  assert.ok(Prompts.validateContext({}).length > 0);
  const noQuestion = Prompts.validateContext(context("factor", "research", { topic: { topic_id: "t", slug: "s", title: "T", question: "", probes: ["p"] } }));
  assert.deepEqual(noQuestion, ["topic.question is required"]);
  const noProbes = Prompts.validateContext(context("factor", "research", { topic: { topic_id: "t", slug: "s", title: "T", question: "q?", probes: [] } }));
  assert.deepEqual(noProbes, ["a factor research prompt needs at least one topic question"]);
  const badName = Prompts.validateContext(context("factor", "research", { deliverable: { file_name: "report.md" } }));
  assert.equal(badName.length, 1);
  assert.match(badName[0], /naming rule/);
  assert.ok(Prompts.validateContext(context("factor", "review")).includes("unknown stage: review"));
  assert.throws(
    () => Prompts.buildStagePrompt(context("factor", "research", { topic: { topic_id: "t", slug: "s", title: "T", question: "", probes: ["p"] } })),
    /research prompt context is incomplete: topic\.question is required/
  );
});

test("the audit catches a prompt that drifted from the template", () => {
  const ctx = context("factor", "research");
  const prompt = Prompts.buildStagePrompt(ctx);
  const file = ctx.deliverable.file_name;

  const withOldWorkflow = `${prompt}Open the stage card to see the four-step list.\n`;
  assert.ok(Prompts.auditPrompt(withOldWorkflow, ctx).some(problem => problem.startsWith("phrase from the older workflow survived")));

  const withPlaceholder = prompt.replace("## Deliverable", "## Deliverable\n\nPut the file in <folder> when you are done.");
  assert.ok(Prompts.auditPrompt(withPlaceholder, ctx).some(problem => problem.includes("angle-bracket placeholder")));

  const withoutChecklist = prompt.replace(/^## Completion checklist\n[\s\S]*?(?=^## Prohibitions)/m, "");
  assert.ok(Prompts.auditPrompt(withoutChecklist, ctx).some(problem => problem.includes("missing section ## Completion checklist")));

  const swapped = prompt
    .replace("## Objective", "## __MOVE__")
    .replace("## Assignment", "## Objective")
    .replace("## __MOVE__", "## Assignment");
  assert.ok(Prompts.auditPrompt(swapped, ctx).length > 0, "a reordered skeleton is refused");

  const onceOnly = prompt.replace(`\`${file}\``, "the file");
  assert.ok(Prompts.auditPrompt(onceOnly, ctx).some(problem => problem.includes("named less than twice")));

  const unnamedEntry = prompt.split("fx.test-entry-two").join("another entry");
  assert.ok(Prompts.auditPrompt(unnamedEntry, ctx).some(problem => problem.includes("entry not named in the prompt")));

  assert.deepEqual(Prompts.auditPrompt(`${prompt}\n`, ctx), ["the prompt must end with exactly one newline"]);
});
