"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const normalize = text => String(text).replace(/\r\n/g, "\n");
const baseline = normalize(execFileSync("git", ["show", "origin/main:script.js"], { cwd: root, encoding: "utf8" }));
const candidate = normalize(fs.readFileSync(path.join(root, "script.js"), "utf8"));

const regions = [
  {
    name: "research-library state",
    start: "const researchLibraryState = {",
    end: "let phase2ShadowBacktestData = null;"
  },
  {
    name: "research-library implementation",
    start: "const researchLibraryLocalKeys = {",
    end: "function renderFactorEdgeLab(payload = {}) {"
  }
];

function locate(text, marker, from, label) {
  const index = text.indexOf(marker, from);
  if (index < 0) throw new Error(`${label}: marker not found: ${marker}`);
  if (text.indexOf(marker, index + marker.length) >= 0) throw new Error(`${label}: marker is not unique: ${marker}`);
  return index;
}

function partition(text, label) {
  const outside = [];
  const inside = [];
  let cursor = 0;
  for (const region of regions) {
    const start = locate(text, region.start, cursor, label);
    const end = locate(text, region.end, start + region.start.length, label);
    outside.push(text.slice(cursor, start));
    inside.push(text.slice(start, end));
    cursor = end;
  }
  outside.push(text.slice(cursor));
  return { outside, inside };
}

function firstLineMismatch(left, right) {
  const a = left.split("\n");
  const b = right.split("\n");
  const count = Math.max(a.length, b.length);
  for (let index = 0; index < count; index += 1) {
    if (a[index] !== b[index]) return { line: index + 1, baseline: a[index], candidate: b[index] };
  }
  return null;
}

const baseParts = partition(baseline, "origin/main");
const workParts = partition(candidate, "working script.js");
for (let index = 0; index < baseParts.outside.length; index += 1) {
  const mismatch = firstLineMismatch(baseParts.outside[index], workParts.outside[index]);
  if (mismatch) {
    console.error(`outside regions: FAIL segment ${index + 1}, line ${mismatch.line}`);
    console.error(`  origin/main: ${JSON.stringify(mismatch.baseline)}`);
    console.error(`  working:     ${JSON.stringify(mismatch.candidate)}`);
    process.exit(1);
  }
}
console.log("outside regions: PASS (line-identical to origin/main)");

const implementation = workParts.inside[1];
const sourceChecks = [
  ["three ordered stage cards", [
    'stage.stage === "red_team"',
    'stage.stage === "adjudication"',
    "progress.stages.map(stage => researchLibraryTopicStageCard(lib, topic, stage))"
  ]],
  ["copy instruction", ["data-rl-copy-stage-prompt", "Copy instruction"]],
  ["download input", ["data-rl-stage-input", "Download input"]],
  ["upload result", ["data-rl-upload-toggle", "Upload result"]],
  ["view result", ["data-rl-view", "View result"]],
  ["stage 3 names both inputs", ["Stage 1 research report", "Stage 2 red-team finding"]],
  ["VIX priority and next action", ["is-priority", "is-next-action", "Next action"]],
  ["archive separated", ["Archive", "Not the workflow"]],
  ["programme labels remain separate", ["setup completed", "research delivered", "adjudication completed", "empirically validated"]]
];

for (const [name, needles] of sourceChecks) {
  const missing = needles.filter(needle => !implementation.includes(needle));
  if (missing.length) {
    console.error(`${name}: FAIL (missing ${missing.join(", ")})`);
    process.exit(1);
  }
  console.log(`${name}: PASS`);
}

const library = normalize(fs.readFileSync(path.join(root, "lib", "research_library.js"), "utf8"));
for (const word of ["Not started", "Ready to run", "Uploaded", "Needs review"]) {
  if (!library.includes(word)) {
    console.error(`plain stage statuses: FAIL (missing ${word})`);
    process.exit(1);
  }
}
console.log("plain stage statuses: PASS");

const catalog = JSON.parse(fs.readFileSync(path.join(root, "data", "research-library", "catalog.json"), "utf8"));
const expectedStages = ["research", "red_team", "adjudication"];
const malformed = (catalog.topics || []).filter(topic =>
  JSON.stringify((topic.stages || []).map(stage => stage.stage)) !== JSON.stringify(expectedStages)
);
if (!catalog.topics?.length || malformed.length) {
  console.error(`all factors get three ordered stage cards: FAIL (${malformed.map(topic => topic.topic_id).join(", ") || "no topics"})`);
  process.exit(1);
}
console.log(`all factors get three ordered stage cards: PASS (${catalog.topics.length} topics)`);
