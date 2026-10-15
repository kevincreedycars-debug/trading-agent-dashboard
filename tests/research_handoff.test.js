"use strict";

// Guards for the USD research handoff bundle under docs/research/handoff/usd/v1/.
//
// The bundle is generated, so these tests hold two boundaries: the files on disk are exactly what the
// builder produces (a stale artefact fails), and the context document, the register, the packs, the schema
// and the tracker carry one consistent set of facts that never contradicts the committed Research Library
// catalogue. Nothing here approves a factor or asserts a performance number.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const builder = require("../scripts/build_research_handoff.js");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const contextDocument = read(`${builder.OUT_DIR}/USD_SYSTEM_CONTEXT.md`);
const register = JSON.parse(read(builder.REGISTER_JSON_PATH));
const tracker = JSON.parse(read(builder.TRACKER_PATH));
const manifest = JSON.parse(read(builder.MANIFEST_PATH));
const cardSchema = JSON.parse(read(builder.CARD_SCHEMA_PATH));
const catalogue = JSON.parse(read(builder.CATALOG_PATH));
const catalogueUsdFactors = catalogue.assets.find(asset => asset.asset === "USD").factors;
const catalogueLive = catalogueUsdFactors.filter(factor => String(factor.factor_id).startsWith("live."));
// One row per USD factor in catalogue order: the ten deployed factors and the fifteen session factors, each
// with the brief the bundle publishes for it.
const briefRows = builder.factorBriefRows();

const codedWeights24h = builder.CODED_WEIGHTS["24h"];
const documentLines = contextDocument.split("\n");
const timeframes = Object.keys(builder.CODED_WEIGHTS);

test("every generated file on disk is exactly what the builder produces", () => {
  const files = builder.buildBundle();
  const mismatched = [];
  for (const file of files) {
    const absolute = path.join(root, file.path);
    const expected = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    if (!fs.existsSync(absolute) || !fs.readFileSync(absolute).equals(expected)) mismatched.push(file.path);
  }
  assert.deepEqual(mismatched, [], "a stale file is a wrong fact: run node scripts/build_research_handoff.js write");
});

test("the check mode passes on the committed bundle", () => {
  const result = spawnSync(process.execPath, ["scripts/build_research_handoff.js", "check"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /all current/);
});

test("the register repeats the committed catalogue and never contradicts it", () => {
  assert.deepEqual(builder.catalogueAgreementProblems(), []);
  assert.equal(builder.LIVE_FACTORS.length, 10);
  assert.equal(catalogueLive.length, 10);
  assert.equal(register.factors.length, 10);
  assert.equal(new Set(builder.LIVE_FACTORS.map(factor => factor.factor_id)).size, 10);
  assert.deepEqual(
    builder.LIVE_FACTORS.map(factor => factor.factor_id).slice().sort(),
    catalogueLive.map(factor => factor.factor_id).slice().sort()
  );
  for (const factor of builder.LIVE_FACTORS) {
    const catalogueRow = catalogueLive.find(row => row.factor_id === factor.factor_id);
    assert.equal(catalogueRow.label, factor.label);
    assert.equal(catalogueRow.role, factor.role);
    assert.equal(catalogueRow.research_status || "ready", factor.status.research);
    assert.equal(catalogueRow.live_weight_coded, codedWeights24h[`F${factor.order}`]);
    assert.equal(catalogueRow.live_weight_rulebook, builder.RULEBOOK_WEIGHTS[`F${factor.order}`]);
  }
});

test("the context document and the register carry the same weights", () => {
  assert.ok(contextDocument.includes(builder.CONTEXT_VERSION), "the context document states its own version");
  assert.ok(contextDocument.includes(`| Pack version | \`${builder.PACK_VERSION}\` |`), "the pack version is stated");
  assert.ok(contextDocument.includes("they disagree, and nothing reconciles them"), "the document says both vectors are live and unreconciled");
  assert.ok(contextDocument.includes("The coded literal also carries `3d`, `current_week`, `next_week` and `current_month`"), "the document says the coded literal has five vectors and the rulebook one");

  // The context table is the human rendering of the same two vectors the register and the packs carry.
  for (const factor of builder.LIVE_FACTORS) {
    const coded = codedWeights24h[`F${factor.order}`];
    const rulebook = builder.RULEBOOK_WEIGHTS[`F${factor.order}`];
    const row = documentLines.find(line =>
      line.startsWith(`| F${factor.order} | `) && line.includes(`| ${coded} | ${rulebook} |`)
    );
    assert.ok(row, `the context table must carry F${factor.order} with coded ${coded} and rulebook ${rulebook}`);
  }

  const sumCoded = builder.LIVE_FACTORS.reduce((total, factor) => total + codedWeights24h[`F${factor.order}`], 0);
  assert.equal(sumCoded, 100, "the coded 24h vector sums to 100");
  const disagreeing = builder.LIVE_FACTORS
    .filter(factor => codedWeights24h[`F${factor.order}`] !== builder.RULEBOOK_WEIGHTS[`F${factor.order}`])
    .map(factor => `F${factor.order}`);
  assert.deepEqual(disagreeing, ["F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"], "eight of the ten factors carry different weights in the two live vectors");
  assert.ok(contextDocument.includes("eight of ten factors on the 24h vector"), "the document states how many factors disagree");

  for (const factor of register.factors) {
    for (const timeframe of timeframes) {
      assert.equal(factor.weights.coded_by_timeframe[timeframe], builder.CODED_WEIGHTS[timeframe][`F${factor.order}`]);
    }
    assert.equal(factor.weights.rulebook, builder.RULEBOOK_WEIGHTS[`F${factor.order}`]);
  }
  assert.deepEqual(register.weights.coded_by_timeframe, builder.CODED_WEIGHTS);
  assert.deepEqual(register.weights.rulebook, builder.RULEBOOK_WEIGHTS);
});

test("one pack exists per factor and states its own audit facts", () => {
  for (const factor of builder.LIVE_FACTORS) {
    const packPath = builder.packPathFor(factor);
    assert.ok(fs.existsSync(path.join(root, packPath)), `${packPath} must exist`);
    const pack = read(packPath);
    assert.ok(pack.includes(factor.factor_id), "the pack names its factor id");
    assert.ok(pack.includes(factor.task_id), "the pack names its task id");
    assert.ok(pack.includes(builder.cardFamilyFor(factor.family)), "the pack names the card family the schema accepts");
    assert.ok(pack.includes(`rulebook ${builder.RULEBOOK_WEIGHTS[`F${factor.order}`]}`), "the pack names the rulebook weight");
    assert.ok(pack.includes(`"24h":${codedWeights24h[`F${factor.order}`]}`), "the pack names the coded 24h weight");
    assert.ok(pack.includes("No production, workflow, dashboard, feed, dispatcher, database or configuration change"), "the pack carries the prohibitions");
    for (const question of factor.pack.questions) assert.ok(pack.includes(question), "every open question reaches the pack");
  }
});

test("the tracker is a projection of the catalogue, not a second source of truth", () => {
  assert.equal(tracker.authority.path, builder.CATALOG_PATH);
  assert.equal(tracker.tasks.length, briefRows.length);
  assert.equal(tracker.totals.tasks, briefRows.length);
  assert.equal(tracker.totals.live_tasks, builder.LIVE_FACTORS.length);
  assert.equal(tracker.totals.session_tasks, builder.SESSION_FACTOR_BRIEFS.length);
  assert.deepEqual(
    tracker.tasks.map(task => task.factor_id).slice().sort(),
    catalogueUsdFactors.map(factor => factor.factor_id).slice().sort()
  );
  for (const task of tracker.tasks) {
    const catalogueRow = catalogueUsdFactors.find(row => row.factor_id === task.factor_id);
    assert.equal(task.research_status, catalogueRow.research_status || "ready");
    assert.equal(task.review_status, catalogueRow.review_status || "pending");
    assert.equal(task.backtest_status, catalogueRow.backtest_status || "not_tested");
    assert.deepEqual(task.blockers, catalogueRow.blockers || []);
    assert.equal(task.card_schema_version, builder.CARD_SCHEMA_VERSION);
    assert.ok(builder.CARD_FAMILIES.includes(task.card_family), `${task.factor_id}: ${task.card_family} is not a schema family`);
    assert.equal(task.card_role, builder.cardRoleFor(catalogueRow.role));
    assert.ok(fs.existsSync(path.join(root, task.pack_path)), `${task.pack_path} must exist for ${task.factor_id}`);
  }
  assert.equal(tracker.totals.blocked, catalogueUsdFactors.filter(row => row.research_status === "blocked").length);
  assert.deepEqual(
    tracker.tasks.filter(task => task.research_status === "blocked").map(task => task.factor_id).sort(),
    catalogueUsdFactors.filter(row => row.research_status === "blocked").map(row => row.factor_id).sort()
  );
});

test("the schema, the template and the register describe one card", () => {
  assert.equal(cardSchema.$id, builder.CARD_SCHEMA_VERSION);
  assert.deepEqual(cardSchema.required, builder.CARD_FIELDS);
  assert.equal(cardSchema.properties.schema_version.const, builder.CARD_SCHEMA_VERSION);
  assert.deepEqual(cardSchema.properties.family.enum, builder.CARD_FAMILIES);
  assert.equal(cardSchema.properties.session_horizon.properties.horizon_id.const, builder.HORIZON.horizon_id);
  assert.equal(cardSchema.properties.session_horizon.properties.nominal_hours.const, builder.HORIZON.nominal_hours);
  assert.equal(cardSchema.properties.card_version.type, "integer");
  const template = read(`${builder.OUT_DIR}/RESEARCH_OUTPUT_TEMPLATE.md`);
  for (const field of builder.CARD_FIELDS) assert.ok(template.includes(field), `${field} must appear in the template`);
  for (const factor of register.factors) {
    assert.ok(builder.CARD_FAMILIES.includes(factor.card_family), `${factor.card_family} is not a schema family`);
    assert.equal(factor.card_role, builder.cardRoleFor(factor.role));
    assert.ok(cardSchema.properties.session_role.enum.includes(factor.card_role), `${factor.card_role} is not a schema role`);
  }
});

test("the manifest counts the bundle and states what it does not claim", () => {
  assert.equal(manifest.counts.factors, 10);
  assert.equal(manifest.counts.packs, briefRows.length);
  assert.equal(manifest.counts.live_packs, builder.LIVE_FACTORS.length);
  assert.equal(manifest.counts.session_packs, builder.SESSION_FACTOR_BRIEFS.length);
  assert.equal(manifest.counts.packs, manifest.counts.live_packs + manifest.counts.session_packs);
  assert.equal(manifest.counts.defects, register.defects.length);
  assert.equal(manifest.counts.open_questions, briefRows.reduce((total, row) => total + row.questions.length, 0));
  assert.equal(manifest.card_schema.version, builder.CARD_SCHEMA_VERSION);
  assert.equal(manifest.brief_index, builder.BRIEF_INDEX_PATH);
  assert.equal(manifest.download.path, builder.ZIP_PATH);
  assert.equal(manifest.files.length, builder.buildBundle().length - 1, "every file except the manifest itself is hashed");
  assert.ok(manifest.files.every(file => /^[0-9a-f]{64}$/.test(file.sha256)));
  for (const file of manifest.files) {
    assert.equal(file.bytes, fs.statSync(path.join(root, file.path)).size, `${file.path} must be the size the manifest states`);
  }
  assert.ok(manifest.not_claimed.some(claim => /No backtest was run/.test(claim)));
  assert.ok(manifest.not_claimed.some(claim => /No live deployment/.test(claim)));
});

// The completeness check the brief asks for: "seventeen files current" says nothing about coverage, so
// coverage is counted factor by factor. Every USD factor in the committed catalogue must have its own pack
// on disk, and that pack must be self-contained: its own title, its own context, the session it is written
// for, the research prompt and the output instructions. Nothing here approves a factor or asserts a result.
test("every one of the twenty-five catalogue factors maps to a self-contained brief", () => {
  const catalogueIds = catalogueUsdFactors.map(factor => factor.factor_id);
  assert.equal(catalogueIds.length, 25, "the catalogue carries twenty-five USD factors");
  assert.equal(briefRows.length, catalogueIds.length);
  assert.equal(builder.LIVE_FACTORS.length, 10);
  assert.equal(builder.SESSION_FACTOR_BRIEFS.length, 15);
  assert.deepEqual(briefRows.map(row => row.factor_id), catalogueIds, "the briefs follow catalogue order");
  assert.deepEqual(builder.catalogueBriefProblems(), [], "the authored briefs must cover the catalogue exactly");

  const paths = new Set();
  for (const row of briefRows) {
    const packPath = builder.packPathFor(row);
    assert.equal(packPath, row.pack_path);
    assert.ok(!paths.has(packPath), `${row.factor_id} shares a brief path with another factor`);
    paths.add(packPath);
    assert.ok(fs.existsSync(path.join(root, packPath)), `${row.factor_id} has no brief at ${packPath}`);
    const pack = read(packPath);
    const catalogueRow = catalogueUsdFactors.find(factor => factor.factor_id === row.factor_id);

    // Self-contained means the reader never has to open another file to know what is being asked.
    assert.ok(pack.length > 4000, `${packPath} is too thin to be a self-contained brief`);
    assert.ok(pack.includes(`(${row.factor_id})`), "the brief names its factor id in its title");
    assert.ok(pack.includes(row.label), "the brief carries the catalogue's label");
    assert.ok(pack.includes(builder.HORIZON.start) && pack.includes(builder.HORIZON.end), "the brief states the session at both ends");
    assert.ok(pack.includes(row.research_status), "the brief carries the catalogue's research status for the factor");
    assert.ok(pack.includes("## 1. What is asked"), "the brief carries the objective");
    assert.ok(pack.includes("## 3."), "the brief carries its own factor section");
    assert.ok(pack.includes("## 7. What to return"), "the brief carries the output instructions");
    assert.ok(pack.includes("## 8. What to answer"), "the brief carries its research prompt");
    assert.ok(pack.includes(builder.CARD_SCHEMA_PATH), "the brief names the schema the return must follow");
    for (const field of builder.CARD_FIELDS) assert.ok(pack.includes(`\`${field}\``), `${field} must appear in the brief's return format`);
    for (const question of row.questions) assert.ok(pack.includes(question), `${row.factor_id}: every question reaches the brief`);
    assert.ok(row.card_family && builder.CARD_FAMILIES.includes(row.card_family), `${row.factor_id} carries no schema family`);
    assert.equal(row.card_role, builder.cardRoleFor(catalogueRow.role));

    if (row.live) {
      // A deployed factor's brief audits code that runs, so it quotes the executed weights.
      assert.ok(pack.includes(`rulebook ${builder.RULEBOOK_WEIGHTS[`F${row.register.order}`]}`), "the brief names the rulebook weight");
      assert.ok(pack.includes(`"24h":${builder.CODED_WEIGHTS["24h"][`F${row.register.order}`]}`), "the brief names the coded 24h weight");
      assert.ok(pack.includes("baseline audit pack"), "a deployed factor's brief says it is a baseline audit");
    } else {
      // A session factor has no rule in force, so its brief has to say so and ask the question instead.
      assert.ok(pack.includes("no rule is in force"), "a session brief must say no rule is in force");
      assert.ok(pack.includes(builder.CATALOG_PATH), "a session brief names the catalogue its status is read from");
      assert.ok(pack.includes(catalogueRow.brief), "a session brief carries the catalogue's brief for the factor");
      assert.ok(pack.includes(row.brief.context), "a session brief carries its own context");
      assert.ok(pack.includes(row.brief.hypothesis_seed), "a session brief carries its hypothesis seed");
      if (row.research_status === "blocked") assert.ok(pack.includes(row.blockers[0]), "a blocked brief carries its blocker");
    }
  }
  assert.equal(paths.size, 25, "twenty-five distinct briefs, one per factor");

  const index = JSON.parse(read(builder.BRIEF_INDEX_PATH));
  assert.equal(index.briefs.length, 25);
  assert.deepEqual(index.briefs.map(brief => brief.factor_id), catalogueIds);
  assert.equal(index.scope.live_engine_audits, 10);
  assert.equal(index.scope.session_research, 15);
  assert.equal(index.scope.total, 25);
  assert.equal(index.download.path, builder.ZIP_PATH);
});

test("the start-here note hands over all twenty-five briefs and the archive", () => {
  const startHere = read(builder.START_HERE_PATH);
  const zipName = builder.ZIP_PATH.replace(`${builder.OUT_DIR}/`, "");
  for (const row of briefRows) {
    assert.ok(startHere.includes(`| ${row.position} | \`${row.factor_id}\` |`), `${row.factor_id} must be numbered in the list`);
    assert.ok(startHere.includes(`](${row.pack_path.replace(`${builder.OUT_DIR}/`, "")})`), `the list must link the brief for ${row.factor_id}`);
    assert.ok(startHere.includes(row.task_id || "no task"), `${row.factor_id} must name the task that covers it`);
  }
  assert.ok(startHere.includes("| 25 | "), "the list is numbered to twenty-five");
  assert.ok(startHere.includes(`](${zipName})`), "the note links the downloadable archive");
  assert.ok(startHere.includes(`](${builder.BRIEF_INDEX_PATH.replace(`${builder.OUT_DIR}/`, "")})`), "the note links the brief index");
  assert.ok(startHere.includes("05:00 Europe/London"), "the note states the session it uses throughout");
  assert.ok(startHere.includes("A brief is an assignment"), "the note states that coverage is not progress");
});

test("the downloadable archive holds every brief and is reproducible", () => {
  const zip = fs.readFileSync(path.join(root, builder.ZIP_PATH));
  assert.equal(zip.readUInt32LE(0), 0x04034b50, "the archive starts with a local file header");
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd > 0, "the archive carries an end-of-central-directory record");
  assert.equal(zip.readUInt16LE(eocd + 4), 0, "the archive is written to one disk");

  const expected = builder.buildBundle().filter(file => ![builder.ZIP_PATH, builder.MANIFEST_PATH].includes(file.path));
  assert.equal(
    zip.readUInt16LE(eocd + 10),
    expected.length,
    "the archive holds every generated file except the manifest and the archive itself"
  );

  let offset = zip.readUInt32LE(eocd + 16);
  const names = [];
  for (let index = 0; index < expected.length; index += 1) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50, "central directory header");
    const method = zip.readUInt16LE(offset + 10);
    const checksum = zip.readUInt32LE(offset + 16);
    const size = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const content = zip.subarray(dataStart, dataStart + size);
    const relative = name.replace(`${builder.ZIP_ROOT}/`, "");
    const file = expected.find(entry => entry.path === `${builder.OUT_DIR}/${relative}`);
    assert.ok(file, `${name} must be a generated file of the bundle`);
    assert.equal(method, 0, "members are stored rather than compressed");
    assert.equal(checksum, builder.crc32(content), `${name}: the header checksum must match the bytes`);
    assert.deepEqual(content, Buffer.from(file.content, "utf8"), `${name} must match the file on disk byte for byte`);
    names.push(relative);
    offset += 46 + nameLength + extraLength + commentLength;
  }

  assert.equal(names.filter(name => name.startsWith("packs/")).length, 25, "twenty-five briefs must be inside the archive");
  for (const row of briefRows) {
    assert.ok(names.includes(row.pack_path.replace(`${builder.OUT_DIR}/`, "")), `${row.factor_id} is missing from the archive`);
  }
  assert.deepEqual(
    builder.buildBundle().find(file => file.path === builder.ZIP_PATH).content,
    zip,
    "the archive is reproducible byte for byte"
  );
});

test("a family or role the schema cannot accept is refused rather than guessed", () => {
  assert.throws(() => builder.cardFamilyFor("not_a_family"), /no card family is mapped/);
  assert.throws(() => builder.cardRoleFor("chief wizard"), /is not a card session_role/);
  for (const factor of builder.LIVE_FACTORS) {
    assert.ok(builder.CARD_FAMILIES.includes(builder.cardFamilyFor(factor.family)));
  }
});

