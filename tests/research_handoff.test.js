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


// The first pilot package: the VIX brief with the two files its section 7 only points at. The brief lists
// the card's field names, so the package is not runnable without the schema; these checks hold that the
// three travel together, that the copies are the bundle's own bytes and that nothing else is in the archive.
test("the VIX pilot package carries the brief, the template and the full schema as one archive", () => {
  const row = builder.pilotBriefRow();
  assert.equal(row.factor_id, builder.PILOT_FACTOR_ID);
  assert.ok(row.live, "the pilot audits deployed code, so its brief is a baseline audit");

  const bundle = builder.buildBundle();
  const packageFiles = builder.buildPilot(bundle).files;
  const noteFile = packageFiles.find(file => file.path === builder.PILOT_START_HERE_PATH);
  const zipFile = packageFiles.find(file => file.path === builder.PILOT_ZIP_PATH);
  assert.ok(noteFile && zipFile, "the package is one note and one archive");
  assert.equal(packageFiles.length, 2, "the package adds the note and the archive to the bundle and nothing else");

  const note = Buffer.from(noteFile.content, "utf8").toString("utf8");
  for (const named of ["f1-vix-level.md", "RESEARCH_OUTPUT_TEMPLATE.md", "research_card.schema.json", builder.CARD_SCHEMA_VERSION, row.task_id]) {
    assert.ok(note.includes(named), `the note must name ${named}`);
  }
  assert.ok(note.includes("the field list alone"), "the note says why the schema travels with the brief");
  assert.ok(note.includes("baseline audit"), "the note says what the pilot audits");

  const expected = [
    { name: "VIX_PILOT_START_HERE.md", path: builder.PILOT_START_HERE_PATH },
    { name: "f1-vix-level.md", path: row.pack_path },
    { name: "RESEARCH_OUTPUT_TEMPLATE.md", path: builder.TEMPLATE_PATH },
    { name: "research_card.schema.json", path: builder.CARD_SCHEMA_PATH }
  ];
  const byPath = new Map(bundle.map(file => [file.path, Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8")]));
  const zip = zipFile.content;
  const members = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const dataStart = offset + 30 + nameLength + extraLength;
    assert.equal(method, 0, "the pilot archive stores its members rather than compressing them");
    members.push({ name: name.replace(`${builder.PILOT_ZIP_ROOT}/`, ""), content: zip.subarray(dataStart, dataStart + size) });
    offset = dataStart + size;
  }
  assert.deepEqual(
    members.map(member => member.name).slice().sort(),
    expected.map(entry => entry.name).slice().sort(),
    "the archive holds the brief, the template, the schema and the note, and nothing else"
  );
  for (const entry of expected) {
    const member = members.find(item => item.name === entry.name);
    assert.deepEqual(member.content, byPath.get(entry.path), `${entry.name} must be the bundle's own bytes`);
  }
  assert.equal(manifest.counts.pilot_packages, 1);
  assert.equal(manifest.pilot.package, builder.PILOT_ZIP_PATH);
  assert.equal(manifest.pilot.factor_id, builder.PILOT_FACTOR_ID);
  assert.equal(manifest.pilot.brief, row.pack_path);
  assert.equal(manifest.pilot.card_schema, builder.CARD_SCHEMA_PATH);
  assert.ok(read(builder.START_HERE_PATH).includes(`(${builder.PILOT_ZIP_PATH.replace(`${builder.OUT_DIR}/`, "")})`), "the start-here note links the pilot archive");
});

// The corrections this bundle carries, asserted on every brief because the shared text is what drifted:
// one proposed missing-quote policy with data exclusions kept apart from model abstentions, the engine's
// exact tie stated as reachable arithmetic rather than unreachable, and the executing version named beside
// the audited baseline instead of being called v154.
test("every brief carries the corrected shared facts", () => {
  for (const row of briefRows) {
    const pack = read(row.pack_path);
    assert.ok(!pack.includes("unreachable with the deployed weights"), `${row.factor_id}: the exact tie is not unreachable`);
    assert.ok(!pack.includes("exact tie and is unreachable"), `${row.factor_id}: the exact tie is not unreachable`);
    assert.ok(pack.includes("reachable arithmetic"), `${row.factor_id}: the exact tie is reachable arithmetic`);
    assert.ok(!pack.includes("missing-quote policy are still undecided"), `${row.factor_id}: the missing-quote policy is not undecided`);
    assert.ok(pack.includes("The one proposed missing-quote policy"), `${row.factor_id}: one proposed missing-quote policy is stated`);
    assert.ok(pack.includes("data exclusion"), `${row.factor_id}: a missing print is a data exclusion`);
    assert.ok(pack.includes("model abstention"), `${row.factor_id}: an abstention is named as a different object`);
    assert.ok(pack.includes("executing") && pack.includes("v155"), `${row.factor_id}: the executing version is named`);
    assert.ok(pack.includes("v154"), `${row.factor_id}: the audited baseline version is named`);
  }
  assert.ok(contextDocument.includes("One proposed policy"), "the shared context states the one proposed policy");
  assert.ok(!contextDocument.includes("The missing-quote policy is still `UNDECIDED`"), "the shared context no longer calls the missing-quote policy undecided");
  assert.ok(contextDocument.includes("executing version"), "the shared context keeps the executing version apart from the baseline");
  const f1 = read(builder.pilotBriefRow().pack_path);
  assert.ok(f1.includes("repaired in the repository on 2026-10-11 and applied to the live workflow on 2026-10-12"), "the null-versus-unavailable repair carries both dates");
});
// The deep-research tier: the primary deliverable of the handoff and the three steps after it. The packs
// are the card step, so these checks hold that the report is asked for first, that the sequence is in the
// owner's order, and that the one sentence about the two-hypothesis limit says where that limit applies.
test("the deep-research tier asks for the report first and states the four steps in order", () => {
  const startHere = read(builder.DEEP_RESEARCH_START_HERE_PATH);
  const reportBrief = read(builder.REPORT_BRIEF_PATH);
  const docs = builder.deepResearchDocuments();
  assert.equal(docs.length, manifest.counts.deep_research_documents);
  assert.ok(manifest.counts.deep_research_documents >= 6, "the tier publishes its six documents");
  for (const doc of docs) {
    assert.ok(fs.existsSync(path.join(root, doc.path)), `${doc.path} must exist`);
    assert.ok(read(doc.path).length > 4000, `${doc.path} is too thin to carry an assignment`);
  }

  assert.ok(manifest.deep_research.primary_deliverable === builder.PRIMARY_DELIVERABLE, "the manifest and the tier state one primary deliverable");
  assert.ok(startHere.includes(builder.PRIMARY_DELIVERABLE), "the tier states the primary deliverable in full");
  assert.ok(reportBrief.includes(builder.PRIMARY_DELIVERABLE), "the report brief asks for that deliverable in full");
  assert.ok(startHere.includes("05:00 Europe/London") && reportBrief.includes(builder.HORIZON.end), "both state the session this programme is written for");

  let cursor = -1;
  for (const step of builder.DEEP_RESEARCH_STEPS) {
    const at = startHere.indexOf(`${step.step}. ${step.name}`);
    assert.ok(at > cursor, `step ${step.step} (${step.name}) must follow the step before it`);
    cursor = at;
  }
  assert.equal(builder.DEEP_RESEARCH_STEPS.length, 4);

  for (const path of [builder.REPORT_BRIEF_PATH, builder.NEUTRAL_CONTEXT_PACK_PATH, builder.RED_TEAM_BRIEF_PATH, builder.SYNTHESIS_BRIEF_PATH, builder.BACKTEST_BRIEF_PATH]) {
    assert.ok(startHere.includes(path.replace(`${builder.OUT_DIR}/`, "")), `${path} must be named by the tier's start-here note`);
  }
  assert.ok(reportBrief.includes("Not a research card"), "the report brief keeps the card out of step 1");
  assert.ok(reportBrief.includes(builder.pilotBriefRow().task_id), "the report registers against the task that covers the factor");
  assert.ok(reportBrief.includes("## 3. What the report must cover"), "the report brief lists what the report has to cover");
  assert.ok(/11\. Candidate relations, unranked/.test(reportBrief), "the discovery phase is asked for as many candidates as the sources support");
  assert.ok(!reportBrief.includes("At most two programmable hypotheses per returned report"), "the two-hypothesis limit is not put on the report");
});

test("the two-hypothesis limit is stated once and scoped to the individual card", () => {
  assert.ok(builder.HYPOTHESIS_LIMIT_SCOPE.includes("At most two programmable hypotheses per returned card"));
  assert.ok(builder.HYPOTHESIS_LIMIT_SCOPE.includes("does not apply to the discovery phase"));
  for (const key of ["start_here", "report_brief", "red_team_brief", "synthesis_brief"]) {
    const path = manifest.deep_research[key];
    assert.ok(read(path).includes(builder.HYPOTHESIS_LIMIT_SCOPE), `${path} must carry the same sentence about the limit`);
  }
  assert.ok(manifest.deep_research.hypothesis_limit_scope === builder.HYPOTHESIS_LIMIT_SCOPE, "the manifest repeats that sentence rather than paraphrasing it");
  assert.ok(read(builder.START_HERE_PATH).includes(builder.PRIMARY_DELIVERABLE), "the bundle's own start-here note leads with the primary deliverable");
});



// The context pack is deliberately thin in argument and thick in facts. These checks hold both halves:
// every fact it is allowed to carry is generated from the contract, the catalogue and the register, and
// none of the fields written to steer a card answer appears in it - the whole point of the pack.
test("the neutral context pack carries the facts and none of the steering fields", () => {
  const pack = read(builder.NEUTRAL_CONTEXT_PACK_PATH);
  const contract = builder.sessionContract();
  assert.deepEqual(builder.contractAgreementProblems(), [], "the bundle and the session contract must agree");

  assert.ok(pack.includes(builder.SESSION_CONTRACT_PATH), "the pack names the contract it is read from");
  assert.ok(pack.includes(builder.HORIZON.start) && pack.includes(builder.HORIZON.end), "the pack states the session at both ends");
  assert.ok(pack.includes(contract.cutoff.asof_rule), "the pack states the as-of rule");
  assert.ok(pack.includes("## 0. Why this pack exists and what it deliberately leaves out"), "the pack states its own exclusions");
  assert.ok(pack.includes("It deliberately excludes"), "the pack says what it left out rather than leaving the omission to be guessed");
  for (const row of builder.unresolvedDecisionRows(contract)) {
    assert.ok(pack.includes(row.detail), `the open decision ${row.decision} reaches the pack with the contract's own words`);
    assert.ok(pack.includes(row.state), `the open decision ${row.decision} reaches the pack with its state`);
  }

  for (const factor of builder.LIVE_FACTORS) {
    assert.ok(pack.includes(factor.factor_id), `${factor.factor_id} must appear in the factor table`);
    assert.ok(pack.includes(factor.rule), `${factor.factor_id}: the deployed rule is stated as the code reads it`);
    assert.ok(pack.includes(`24h weight ${codedWeights24h[`F${factor.order}`]} coded`), `${factor.factor_id}: the coded 24h weight is stated`);
  }
  assert.ok(pack.includes("| rulebook v2.1 |"), "the rulebook vector is stated");
  assert.ok(pack.includes(builder.AVAILABILITY_BLOCK.split("\n")[0]), "the availability facts reach the pack");

  // The steering fields: every one of them is a question, a prompt or a proposed answer written for a card,
  // and the pack may not carry any of them.
  const steering = [];
  for (const row of briefRows) {
    steering.push(...row.questions);
    if (row.register && row.register.pack) {
      const hints = row.register.pack;
      for (const field of ["questions", "counterarguments", "hypothesis_seed", "falsification", "gap", "timing"]) {
        if (Array.isArray(hints[field])) steering.push(...hints[field]);
        else if (typeof hints[field] === "string") steering.push(hints[field]);
      }
    }
    if (row.brief) {
      for (const [field, value] of Object.entries(row.brief)) {
        if (field === "factor_id" || field === "card_family") continue;
        if (Array.isArray(value)) steering.push(...value);
        else if (typeof value === "string" && value.length > 30) steering.push(value);
      }
    }
  }
  assert.ok(steering.length > 60, "there is steering text to leave out");
  for (const text of steering) {
    assert.ok(!pack.includes(text), `the pack must not carry steering text: ${text.slice(0, 60)}...`);
  }
  for (const phrase of ["hypothesis_seed", "## Hypothesis", "### Hypothesis", "rejection_test", "falsification_test"]) {
    assert.ok(!pack.includes(phrase), `the pack must not carry ${phrase}`);
  }
});

// Correcting the programme may not move a dispatched byte, and the two hand-written records beside the
// pilot package are the half of that the generator cannot check by itself. These checks tie them to the
// bytes on disk: the package and its members still hash to what the dispatch record pins, and the return
// of pilot 1 is recorded as preliminary, unreviewed and not backtested rather than as a result.
const crypto = require("node:crypto");
const PILOT_DISPATCH_RECORD_PATH = `${builder.PILOT_DIR}/PILOT_DISPATCH_RECORD.md`;
const PILOT_RETURN_STATUS_PATH = `${builder.PILOT_DIR}/PILOT_1_RETURN_STATUS.md`;

test("the deep-research tier is versioned apart from the packs and from the frozen pilot package", () => {
  assert.equal(manifest.pack_version, builder.PACK_VERSION);
  assert.equal(manifest.pilot.package_version, builder.PILOT_VERSION);
  assert.equal(manifest.deep_research.version, builder.DEEP_RESEARCH_VERSION);
  assert.notEqual(manifest.deep_research.version, manifest.pack_version, "the tier is versioned apart from the packs");

  const sha256 = content => crypto.createHash("sha256").update(content).digest("hex");
  const dispatch = read(PILOT_DISPATCH_RECORD_PATH);
  assert.ok(dispatch.includes(sha256(fs.readFileSync(path.join(root, builder.PILOT_ZIP_PATH)))), "the dispatched archive still hashes to the value the record pins");
  for (const filePath of [builder.pilotBriefRow().pack_path, builder.TEMPLATE_PATH, builder.CARD_SCHEMA_PATH, builder.PILOT_START_HERE_PATH]) {
    assert.ok(dispatch.includes(sha256(fs.readFileSync(path.join(root, filePath)))), `${filePath} still hashes to the value the record pins`);
  }
  assert.equal(manifest.files.find(file => file.path === builder.PILOT_ZIP_PATH).sha256, sha256(fs.readFileSync(path.join(root, builder.PILOT_ZIP_PATH))), "the manifest pins the same archive bytes");
});

test("the return of pilot 1 is recorded as preliminary, unreviewed and not backtested", () => {
  const status = read(PILOT_RETURN_STATUS_PATH);
  for (const phrase of ["preliminary", "unreviewed", "not backtested", builder.pilotBriefRow().task_id, "not advanced", "deep-research/START_HERE.md"]) {
    assert.ok(status.includes(phrase), `the return status record must say ${phrase}`);
  }
  assert.ok(status.includes("does not complete it"), "the record says the return is not the completion of the task");
  assert.ok(status.includes("22 ready and 3 blocked"), "the record states that no factor status moved");
  assert.ok(/no hash is claimed/.test(status), "the record claims no hash for bytes it does not hold");
  const dispatch = read(PILOT_DISPATCH_RECORD_PATH);
  assert.ok(dispatch.includes(PILOT_RETURN_STATUS_PATH.replace(`${builder.OUT_DIR}/`, "")), "the dispatch record points at the return status record");
});
