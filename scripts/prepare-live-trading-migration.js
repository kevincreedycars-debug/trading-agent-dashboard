#!/usr/bin/env node
"use strict";

// The copy of one lane that has to exist before a host can take over from the PC: what the loop has already
// done (its state), what it sent and was told (its journal), the append-only run log, the wrapper that is the
// effective command line, the lanes file, and the publisher's clock state. Everything is hashed, nothing is
// assumed: a restored state file that is one byte off is a different account history, and a heartbeat that is
// copied is history rather than proof of a loop running on the new host.
//
// Two modes, one schema. `--out` prepares a bundle and writes MANIFEST.json plus SHA256SUMS beside the files.
// `--verify` re-reads a bundle and refuses it if any byte, name or hash differs, so the cutover copy is
// checked rather than trusted. A bundle is never edited by hand; a second `--out` into the same directory is
// refused unless --force says the earlier one is being replaced deliberately.
//
// Credentials are not part of this and are refused if they turn up: MT5 logins live in the terminal's own
// profile (which is why the terminal has to be logged in by hand on the host), the repository holds no
// password, and an investor password copied into a bundle would outlive the migration that made it.
//
// Exit 0 when the bundle is written or verified, 1 when a gate refused or a file failed verification, 2 on a
// bad command line.

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCHEMA_VERSION = "live-trading-migration-bundle-v1";
const MANIFEST_NAME = "MANIFEST.json";
const SUMS_NAME = "SHA256SUMS";
const DEFAULT_LANES = "config/live-trading-lanes.json";
const DEFAULT_OUT_DIR = path.join(".local", "live-trading-migration");

// What a bundle must never carry. The list is deliberately about credentials rather than about file names:
// naming a file is how a credential gets copied by accident under another name, and the scan below reads the
// bytes that are about to be written rather than the path they came from.
const SECRET_PATTERNS = [
  { id: "private-key", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
  { id: "github-token", regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/ },
  { id: "bearer-token", regex: /Bearer\s+[A-Za-z0-9\-_.=]{20,}/ },
  {
    id: "assigned-password",
    regex: /\b(?:password|passwd|investor_password|master_password|secret|api[_-]?key|access[_-]?token)\b["']?\s*[:=]\s*["']?[^\s"',}]{6,}/i
  }
];

const USAGE = [
  "Usage:",
  "  node scripts/prepare-live-trading-migration.js --lane <id> [--out <dir>] [--checkout <dir>] [--force] [--dry-run]",
  "  node scripts/prepare-live-trading-migration.js --verify <dir>",
  "",
  "  --lane <id>       the lane this bundle belongs to (default: the lane whose root is this checkout)",
  "  --out <dir>       where the bundle is written (default: .local/live-trading-migration/<lane>)",
  "  --checkout <dir>  the checkout to read (default: this repository)",
  "  --force           replace a bundle directory that already exists",
  "  --dry-run         read, hash and report, write nothing",
  "  --verify <dir>    re-check an existing bundle against its manifest and SHA256SUMS",
  "",
  "Exit 0 when the bundle is written or verified, 1 when a gate refused or a file failed verification.",
  "The bundle carries no credential: MT5 is logged in by hand on the host, and a match on a password, token or",
  "key pattern refuses the run rather than copying the file."
].join("\n");

function parseArgs(argv) {
  const options = {
    mode: "prepare",
    lane: null,
    out: null,
    checkout: path.resolve(__dirname, ".."),
    lanes: null,
    force: false,
    dryRun: false,
    help: false
  };
  const args = [...argv];
  const next = (token) => {
    if (!args.length) throw new Error(`${token} needs a value`);
    return args.shift();
  };
  while (args.length) {
    const token = args.shift();
    if (token === "--help" || token === "-h") options.help = true;
    else if (token === "--lane") options.lane = next(token);
    else if (token === "--out") options.out = next(token);
    else if (token === "--checkout") options.checkout = path.resolve(next(token));
    else if (token === "--lanes") options.lanes = next(token);
    else if (token === "--force") options.force = true;
    else if (token === "--dry-run") options.dryRun = true;
    else if (token === "--verify") {
      options.mode = "verify";
      options.out = next(token);
    } else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function sha256OfBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256OfFile(filePath) {
  return sha256OfBuffer(fs.readFileSync(filePath));
}

function utcNow(nowMs) {
  return new Date(Number.isFinite(nowMs) ? nowMs : Date.now()).toISOString();
}

// The files a bundle is made of, in the order they are restored. `required` marks the ones whose absence is
// fatal: a migration without the state file is a fresh start wearing the name of a migration, and the journal
// is the only record of what was sent. The wrapper, log, heartbeat and publish state are recorded as missing
// instead of stopping the run - a lane whose trader was just registered has no log yet - because a bundle that
// says "there was no heartbeat" is more useful than no bundle at all.
function planFiles({ checkoutRoot, lane, lanesRelative, publishStateRelative }) {
  const resolve = (relative) => path.resolve(checkoutRoot, relative);
  const statusRelative = lane.trader_status || "tmp/live-trading-trader-status.json";
  const publishRelative = publishStateRelative || "tmp/live-trading-publish-state.json";
  return [
    { role: "state", bundle: "state/live-trading-trader-state.json", source: resolve("tmp/live-trading-trader-state.json"), required: true },
    { role: "journal", bundle: "journal/live-trading-orders.log", source: resolve("tmp/live-trading-orders.log"), required: true },
    { role: "run_log", bundle: "log/live-trading-trader.log", source: resolve("tmp/live-trading-trader.log"), required: false },
    { role: "heartbeat", bundle: "heartbeat/live-trading-trader-status.json", source: resolve(statusRelative), required: false },
    { role: "wrapper", bundle: "config/live-trading-trader-run.cmd", source: resolve("tmp/live-trading-trader-run.cmd"), required: false },
    { role: "lanes_config", bundle: "config/live-trading-lanes.json", source: resolve(lanesRelative), required: true },
    { role: "publish_state", bundle: "publish/live-trading-publish-state.json", source: resolve(publishRelative), required: false }
  ];
}

// A credential scan over the bytes about to be bundled. It looks for the shapes credentials take rather than
// for words in prose, and it runs before anything is written: the bundle is refused, not redacted, because a
// redacted state file is a state file that lies about the account. The report names the file and the line and
// deliberately never echoes the match, so the refusal cannot leak the thing it refused.
function findSecretMatch(buffer) {
  const text = buffer.toString("utf8");
  if (text.includes("\u0000")) return null;
  for (const pattern of SECRET_PATTERNS) {
    const match = pattern.regex.exec(text);
    if (match) {
      const line = text.slice(0, match.index).split("\n").length;
      return { id: pattern.id, line };
    }
  }
  return null;
}

function gitFacts(checkoutRoot, deps = {}) {
  const exec = deps.exec || ((command, args) => spawnSync(command, args, { encoding: "utf8" }));
  const run = (args) => {
    const result = exec("git", ["-C", checkoutRoot, ...args]);
    if (!result || result.status !== 0) return null;
    return String(result.stdout || "").trim();
  };
  const status = run(["status", "--porcelain"]);
  return {
    commit: run(["rev-parse", "HEAD"]),
    branch: run(["rev-parse", "--abbrev-ref", "HEAD"]),
    dirty: status === null ? null : status.length > 0
  };
}

function loadLane({ checkoutRoot, lanesPath, laneId }) {
  if (!fs.existsSync(lanesPath)) throw new Error(`No lanes file at ${lanesPath}`);
  const document = JSON.parse(fs.readFileSync(lanesPath, "utf8").replace(/^\uFEFF/, ""));
  const lanes = Array.isArray(document?.lanes) ? document.lanes : [];
  if (laneId) {
    const found = lanes.find((lane) => lane && lane.id === laneId);
    if (!found) throw new Error(`No lane ${laneId} in ${lanesPath}`);
    return { document, lane: found };
  }
  const matches = lanes.filter((lane) => {
    if (!lane || !lane.id) return false;
    return path.resolve(checkoutRoot, String(lane.root || ".")) === checkoutRoot;
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one lane rooted at ${checkoutRoot}; found ${matches.length}. Pass --lane <id>.`);
  }
  return { document, lane: matches[0] };
}

// The restore order is part of the bundle rather than a paragraph someone remembers: the heartbeat is last
// because the host must write its own, and the publish state is last of all because publishing is the step
// that makes the account visible, not the step that starts it trading.
const RESTORE_ORDER = [
  "config/live-trading-lanes.json",
  "config/live-trading-trader-run.cmd",
  "state/live-trading-trader-state.json",
  "journal/live-trading-orders.log",
  "log/live-trading-trader.log",
  "publish/live-trading-publish-state.json",
  "heartbeat/live-trading-trader-status.json"
];

function prepare(options, deps = {}) {
  const nowMs = deps.now ? deps.now() : Date.now();
  const checkoutRoot = path.resolve(options.checkout);
  const lanesRelative = options.lanes || DEFAULT_LANES;
  const lanesPath = path.resolve(checkoutRoot, lanesRelative);
  const { document: lanesDocument, lane } = loadLane({ checkoutRoot, lanesPath, laneId: options.lane });
  const publishStateRelative = lanesDocument?.publish?.state || null;
  const plan = planFiles({ checkoutRoot, lane, lanesRelative, publishStateRelative });

  const missingRequired = plan.filter((file) => file.required && !fs.existsSync(file.source));
  if (missingRequired.length) {
    return {
      code: 1,
      reason: `nothing to migrate: ${missingRequired.map((file) => file.source).join(", ")} ${missingRequired.length === 1 ? "is" : "are"} missing`
    };
  }

  const outDir = options.out
    ? path.resolve(options.out)
    : path.join(checkoutRoot, DEFAULT_OUT_DIR, lane.id);
  if (fs.existsSync(outDir)) {
    const isABundle = fs.existsSync(path.join(outDir, MANIFEST_NAME));
    if (!isABundle) {
      return { code: 1, reason: `${outDir} exists and does not hold a bundle; refusing to write into it` };
    }
    if (!options.force) {
      return { code: 1, reason: `${outDir} already holds a bundle; pass --force to replace it deliberately` };
    }
    if (!options.dryRun) fs.rmSync(outDir, { recursive: true, force: true });
  }

  const files = [];
  const missing = [];
  for (const entry of plan) {
    if (!fs.existsSync(entry.source)) {
      missing.push({
        role: entry.role,
        bundle_path: entry.bundle,
        source_path: entry.source,
        required: entry.required === true,
        reason: "not present in the checkout at the time this bundle was made"
      });
      continue;
    }
    const buffer = fs.readFileSync(entry.source);
    const secret = findSecretMatch(buffer);
    if (secret) {
      return {
        code: 1,
        reason: `refusing to bundle ${entry.source}: it matches the ${secret.id} credential pattern at line ${secret.line}`
      };
    }
    const stat = fs.statSync(entry.source);
    if (!options.dryRun) {
      const target = path.join(outDir, entry.bundle);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buffer);
    }
    files.push({
      role: entry.role,
      bundle_path: entry.bundle.split(path.sep).join("/"),
      source_path: entry.source,
      bytes: buffer.length,
      sha256: sha256OfBuffer(buffer),
      mtime_utc: stat.mtime.toISOString()
    });
  }
  return { code: 0, laneId: lane.id, checkoutRoot, lanesPath, outDir, files, missing, nowMs };
}

function packageVersion(checkoutRoot) {
  try {
    const document = JSON.parse(fs.readFileSync(path.join(checkoutRoot, "package.json"), "utf8").replace(/^\uFEFF/, ""));
    return typeof document.version === "string" ? document.version : null;
  } catch {
    return null;
  }
}

// The heartbeat, read out of the bundle after it was copied and described as what it is: a record that a loop
// ran once on the host named inside it. It is the one file in the bundle that a reader might mistake for
// evidence about now, so the manifest says in words that it is not.
function heartbeatFacts(outDir, entry) {
  if (!entry) {
    return {
      present: false,
      is_historical_evidence: true,
      note: "no heartbeat existed when this bundle was made; the host's own heartbeat will be the first one"
    };
  }
  // The copy and its source are the same bytes; reading the source keeps a dry run honest, because a dry run
  // writes nothing to read back.
  const readablePath = fs.existsSync(path.join(outDir, entry.bundle_path))
    ? path.join(outDir, entry.bundle_path)
    : entry.source_path;
  try {
    const document = JSON.parse(fs.readFileSync(readablePath, "utf8").replace(/^\uFEFF/, ""));
    return {
      present: true,
      bundle_path: entry.bundle_path,
      is_historical_evidence: true,
      written_at_utc: document.written_at_utc ?? document.at_utc ?? null,
      armed: document.armed === true,
      status: document.status ?? null,
      host: typeof document.host?.computer === "string" ? document.host.computer : null,
      note: "Copied as history: it says a loop ran on that host at written_at_utc. It is not evidence that a loop is running now, on that host or this one, and the page must be re-read after the host writes its own."
    };
  } catch {
    return {
      present: true,
      bundle_path: entry.bundle_path,
      is_historical_evidence: true,
      readable: false,
      note: "Copied but not readable as JSON; kept as bytes rather than silently dropped."
    };
  }
}

function snapshotFacts(checkoutRoot) {
  const snapshotPath = path.resolve(checkoutRoot, "data/live-trading.json");
  if (!fs.existsSync(snapshotPath)) {
    return { path: snapshotPath, present: false, copied: false };
  }
  const buffer = fs.readFileSync(snapshotPath);
  let generated = null;
  try {
    generated = JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/, "")).generated_at_utc ?? null;
  } catch {
    generated = null;
  }
  return {
    path: snapshotPath,
    present: true,
    copied: false,
    bytes: buffer.length,
    sha256: sha256OfBuffer(buffer),
    generated_at_utc: generated,
    note: "Not copied: the host's own producer writes this file, and restoring an old snapshot would hand the loop bars from another machine."
  };
}

function writeBundle(prepared, options, deps = {}) {
  const { outDir, files, missing, checkoutRoot, laneId } = prepared;
  const repo = gitFacts(checkoutRoot, deps);
  const manifest = {
    schema_version: SCHEMA_VERSION,
    lane: laneId,
    generated_at_utc: utcNow(prepared.nowMs),
    generated_on_host: os.hostname(),
    generated_by: "scripts/prepare-live-trading-migration.js",
    source_checkout: checkoutRoot,
    // The commit that produced the state and journal being copied. A dirty tree is recorded rather than
    // refused: the cutover copy is meant to be taken from the running PC, and refusing on a local edit would
    // push the operator into committing work they have not reviewed.
    repo,
    deployed_commit: repo.commit,
    version: { package: packageVersion(checkoutRoot), node: process.version, platform: process.platform },
    files,
    missing,
    restore_order: RESTORE_ORDER,
    heartbeat: heartbeatFacts(outDir, files.find((file) => file.role === "heartbeat")),
    snapshot: snapshotFacts(checkoutRoot),
    credentials: {
      included: false,
      note: "No credential is in this bundle. The MT5 login lives in the terminal's own profile on each host and is entered by hand; this file names the pattern types that were checked for.",
      checked_with: SECRET_PATTERNS.map((pattern) => pattern.id)
    },
    provisional: {
      is_provisional: true,
      note: "Made before the move. At cutover the PC trader must be stopped and this bundle remade from the final state, or the host restores a history the PC has since added to."
    }
  };
  if (!options.dryRun) {
    const sums = files.map((file) => `${file.sha256}  ${file.bundle_path}`).join("\n");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(outDir, SUMS_NAME), `${sums}\n`, "utf8");
  }
  return manifest;
}

function walkFiles(directory, base = directory) {
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkFiles(full, base));
    else found.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return found;
}

// Verifying is a re-derivation, not a second opinion: every byte is hashed again, every name is compared to
// the manifest, and anything in the directory the manifest does not name is reported. A bundle that passes is
// the same bundle that was written; a bundle that fails says which file and which way.
function verify(options) {
  const bundleDir = path.resolve(options.out || "");
  const manifestPath = path.join(bundleDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) {
    return { code: 1, problems: [`no ${MANIFEST_NAME} at ${bundleDir}`], bundleDir };
  }
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    return { code: 1, problems: [`${MANIFEST_NAME} is not readable JSON: ${error.message}`], bundleDir };
  }
  if (manifest.schema_version !== SCHEMA_VERSION) {
    return { code: 1, problems: [`${MANIFEST_NAME} is schema ${manifest.schema_version}, expected ${SCHEMA_VERSION}`], bundleDir, manifest };
  }

  const problems = [];
  const expected = new Set([MANIFEST_NAME, SUMS_NAME]);
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  for (const file of files) {
    expected.add(file.bundle_path);
    const filePath = path.join(bundleDir, file.bundle_path);
    if (!fs.existsSync(filePath)) {
      problems.push(`${file.bundle_path}: missing`);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    if (buffer.length !== file.bytes) {
      problems.push(`${file.bundle_path}: ${buffer.length} bytes, manifest says ${file.bytes}`);
    }
    const digest = sha256OfBuffer(buffer);
    if (digest !== file.sha256) {
      problems.push(`${file.bundle_path}: sha256 ${digest}, manifest says ${file.sha256}`);
    }
    const secret = findSecretMatch(buffer);
    if (secret) {
      problems.push(`${file.bundle_path}: matches the ${secret.id} credential pattern at line ${secret.line}`);
    }
  }

  const sumsPath = path.join(bundleDir, SUMS_NAME);
  if (!fs.existsSync(sumsPath)) {
    problems.push(`${SUMS_NAME}: missing`);
  } else {
    const listed = new Map();
    for (const line of fs.readFileSync(sumsPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line.trim());
      if (match) listed.set(match[2], match[1]);
    }
    for (const file of files) {
      if (listed.get(file.bundle_path) !== file.sha256) {
        problems.push(`${SUMS_NAME}: ${file.bundle_path} is not listed with the manifest's hash`);
      }
    }
    for (const listedPath of listed.keys()) {
      if (!files.some((file) => file.bundle_path === listedPath)) {
        problems.push(`${SUMS_NAME}: lists ${listedPath}, which the manifest does not`);
      }
    }
  }

  for (const relative of walkFiles(bundleDir)) {
    if (!expected.has(relative)) problems.push(`${relative}: not in the manifest`);
  }

  if (manifest.credentials?.included !== false) {
    problems.push(`${MANIFEST_NAME}: credentials.included is not false`);
  }

  return { code: problems.length ? 1 : 0, problems, bundleDir, manifest };
}

function main(argv = process.argv.slice(2), deps = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  try {
    if (options.mode === "verify") {
      if (!options.out) {
        process.stderr.write(`--verify needs a bundle directory\n\n${USAGE}\n`);
        return 2;
      }
      const result = verify(options);
      if (result.code !== 0) {
        process.stdout.write(`result   = FAILED\nbundle   = ${result.bundleDir}\n`);
        for (const problem of result.problems) process.stdout.write(`problem  = ${problem}\n`);
        return 1;
      }
      const manifest = result.manifest;
      process.stdout.write(
        [
          "result   = verified",
          `bundle   = ${result.bundleDir}`,
          `lane     = ${manifest.lane}`,
          `files    = ${manifest.files.length} checked against ${MANIFEST_NAME} and ${SUMS_NAME}`,
          `made_on  = ${manifest.generated_on_host} at ${manifest.generated_at_utc}`,
          `heartbeat= ${manifest.heartbeat?.present ? `historical evidence, ${manifest.heartbeat.written_at_utc || "undated"}` : "none in this bundle"}`
        ].join("\n") + "\n"
      );
      return 0;
    }

    const prepared = prepare(options, deps);
    if (prepared.code !== 0) {
      process.stdout.write(`result   = REFUSED\nreason   = ${prepared.reason}\n`);
      return 1;
    }
    const manifest = writeBundle(prepared, options, deps);
    process.stdout.write(
      [
        `result   = ${options.dryRun ? "dry run, nothing written" : "bundle written"}`,
        `bundle   = ${prepared.outDir}`,
        `lane     = ${manifest.lane}`,
        `files    = ${manifest.files.length} ${options.dryRun ? "found" : "written"}, ${manifest.missing.length} missing`,
        `commit   = ${manifest.repo.commit || "unknown"}${manifest.repo.dirty ? " (working tree has local edits)" : ""}`,
        `heartbeat= ${manifest.heartbeat.present ? `historical evidence, ${manifest.heartbeat.written_at_utc || "undated"}, host ${manifest.heartbeat.host || "not named"}` : "none existed"}`,
        `manifest = ${path.join(prepared.outDir, MANIFEST_NAME)}`,
        options.dryRun
          ? "next     = run again without --dry-run to write it"
          : `next     = copy the directory, then: node scripts/prepare-live-trading-migration.js --verify ${prepared.outDir}`
      ].join("\n") + "\n"
    );
    return 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  main,
  prepare,
  writeBundle,
  verify,
  planFiles,
  findSecretMatch,
  parseArgs,
  loadLane,
  gitFacts,
  SCHEMA_VERSION,
  RESTORE_ORDER
};

