/**
 * The supplied USD-L1-25F-H1-v0.1.0 acceptance package.
 *
 * The archive is committed byte for byte beside its extracted contents. Verification reads the archive, its
 * SHA-256SUMS manifest and the JSON rows it ships, and returns a deterministic record. Nothing here dates a
 * file by the clock on the machine that builds the screen: the verification date is the date the archive was
 * received, and every file hash is reproducible from the bytes in the checkout.
 *
 * Research only.
 */
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const REQUESTED = "USD-L1-25F-H1-v0.1.0";
/** The package as committed, which is the copy this checkout registers and verifies. */
const PACKAGE_ROOT = `backtester/packages/${REQUESTED}`;
/** The archive as received. Kept as the hand-off receipt; its members equal the committed package. */
const ARCHIVE = `docs/research/usd-session/h1/v0.1.0/${REQUESTED}.zip`;
const ARCHIVE_SHA256 = "1c82e9048a3cf2237ffea6873b8099389d09fccefa083cd38ccb87517e3672e0";
const PACKAGE_COMMIT = "60e695bccabd9a370cc2688a1f791d07dd94720d";
const PACKAGE_COMMIT_SUBJECT = "Add unpacked USD 25-factor H1 candidate and frozen verification fixtures";
const VERIFIED_ON = "2026-11-17";
const MANIFEST = "SHA256SUMS";
/**
 * A Windows checkout with `core.autocrlf=true` rewrites every line ending, and all 16 declared sums then
 * fail. `.gitattributes` marks `backtester/packages/**` and `docs/research/usd-session/h1/**` as `-text`,
 * so the bytes on disk are the bytes that were hashed. This constant is recorded in the identity so a
 * reader can tell a genuine mismatch from a checkout that ignored the attribute.
 */
const BYTE_POLICY = "bytes as delivered; .gitattributes marks the package and its receipt as -text";

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function hashFile(file) {
  return hashBuffer(fs.readFileSync(file));
}

function parseManifest(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
      if (!match) throw new Error(`h1 package: malformed ${MANIFEST} line: ${line}`);
      return { sha256: match[1].toLowerCase(), path: match[2].replace(/^\.\//, "") };
    });
}

/**
 * Run the package's own acceptance runner, from its own directory, exactly as the hand-off says to.
 *
 * The runner asserts its four cases against `expected.json`. A non-zero exit is not thrown: it is recorded,
 * so the screen shows a failed acceptance instead of failing to build and hiding the reason.
 */
function runAcceptance(packageRoot) {
  const command = "node verify.js";
  try {
    execFileSync(process.execPath, ["verify.js"], {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    return {
      command,
      cwd: PACKAGE_ROOT,
      ran_on: VERIFIED_ON,
      exit_code: 0,
      status: "PASS",
      asserts: "the package's own assertions plus a deep-equal against its recorded expected.json",
    };
  } catch (error) {
    return {
      command,
      cwd: PACKAGE_ROOT,
      ran_on: VERIFIED_ON,
      exit_code: typeof error.status === "number" ? error.status : 1,
      status: "FAIL",
      asserts: "the package's own assertions plus a deep-equal against its recorded expected.json",
      stderr: String(error.stderr || error.message || "").trim().slice(0, 400) || null,
    };
  }
}

/**
 * Verify the committed package and every file named by its internal manifest.
 *
 * @param {object} options
 * @param {string} options.root repository root
 * @returns {object} deterministic package identity
 */
function verifyPackage({ root }) {
  const packageRoot = path.join(root, PACKAGE_ROOT);
  const archivePath = path.join(root, ARCHIVE);
  const manifestPath = path.join(packageRoot, MANIFEST);

  if (!fs.existsSync(packageRoot)) throw new Error(`h1 package: the committed package is missing at ${PACKAGE_ROOT}`);
  if (!fs.existsSync(archivePath)) throw new Error(`h1 package: the received archive is missing at ${ARCHIVE}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`h1 package: ${MANIFEST} is missing at ${PACKAGE_ROOT}`);

  const archiveSha256 = hashFile(archivePath);
  const declared = parseManifest(fs.readFileSync(manifestPath, "utf8"));
  const files = declared.map((entry) => {
    const file = path.join(packageRoot, entry.path);
    const present = fs.existsSync(file);
    const actual = present ? hashFile(file) : null;
    return {
      path: `${PACKAGE_ROOT}/${entry.path}`,
      sha256_expected: entry.sha256,
      sha256_actual: actual,
      present,
      match: present && actual === entry.sha256,
    };
  });
  const mismatches = files.filter((file) => !file.match);
  const hashOf = (name) => {
    const entry = files.find((file) => file.path === `${PACKAGE_ROOT}/${name}`);
    return entry ? entry.sha256_actual : null;
  };
  const rows = JSON.parse(fs.readFileSync(path.join(packageRoot, "rows.json"), "utf8"));
  const inputs = JSON.parse(fs.readFileSync(path.join(packageRoot, "inputs.json"), "utf8"));
  const expected = JSON.parse(fs.readFileSync(path.join(packageRoot, "expected.json"), "utf8"));

  if (archiveSha256 !== ARCHIVE_SHA256) {
    throw new Error(`h1 package: archive sha256 ${archiveSha256} does not match the supplied ${ARCHIVE_SHA256}`);
  }
  if (mismatches.length) {
    throw new Error(
      `h1 package: ${mismatches.length} internal checksum(s) do not match. If all 16 fail, the checkout ignored the -text attribute and rewrote line endings.`
    );
  }

  return {
    requested: REQUESTED,
    status: "VERIFIED",
    verification: "every SHA256SUMS entry recomputed byte for byte from the committed package, then its own verify.js run",
    verified_on: VERIFIED_ON,
    package: {
      root: PACKAGE_ROOT,
      commit: PACKAGE_COMMIT,
      commit_subject: PACKAGE_COMMIT_SUBJECT,
      byte_policy: BYTE_POLICY,
    },
    archive: {
      path: ARCHIVE,
      role: "the archive as received; the members it carries are the files below",
      bytes: fs.statSync(archivePath).size,
      sha256: archiveSha256,
      sha256_expected: ARCHIVE_SHA256,
      matches: archiveSha256 === ARCHIVE_SHA256,
    },
    declared_hashes: {
      rulebook_sha256: hashOf("RULEBOOK.md"),
      models_sha256: hashOf("models.js"),
      engine_sha256: hashOf("engine.js"),
      inputs_sha256: hashOf("inputs.json"),
      rows_sha256: hashOf("rows.json"),
      expected_sha256: hashOf("expected.json"),
      manifest_sha256: hashFile(manifestPath),
    },
    internal_checksums: {
      manifest: `${PACKAGE_ROOT}/${MANIFEST}`,
      declared: files.length,
      verified: files.length - mismatches.length,
      mismatches: mismatches.map((file) => file.path),
      files,
    },
    acceptance: runAcceptance(packageRoot),
    contents: {
      rows: rows.rows.length,
      inputs: Object.keys(inputs).length,
      fixtures: Object.keys(expected).filter((key) => expected[key] && typeof expected[key] === "object"),
      candidate: rows.candidate,
      rows_status: rows.status || null,
    },
    consequence:
      "The committed package verifies byte for byte, its own verify.js passes, and its frozen 25-row candidate is registered in the shared engine. Fixture reproduction is an acceptance control, not historical evidence; historical coverage and live parity remain open.",
    source: `${PACKAGE_ROOT}/RULEBOOK.md`,
  };
}

function loadPackage({ root }) {
  const packageRoot = path.join(root, PACKAGE_ROOT);
  return {
    root: packageRoot,
    inputs: JSON.parse(fs.readFileSync(path.join(packageRoot, "inputs.json"), "utf8")),
    rows: JSON.parse(fs.readFileSync(path.join(packageRoot, "rows.json"), "utf8")),
    expected: JSON.parse(fs.readFileSync(path.join(packageRoot, "expected.json"), "utf8")),
    models: require(path.join(packageRoot, "models.js")),
    contracts: require(path.join(packageRoot, "reference/backtester/lib/usd_layer1_backtester/contracts.js")),
    session: require(path.join(packageRoot, "reference/backtester/lib/usd_session_engine_interface.js")),
  };
}

module.exports = {
  ARCHIVE,
  ARCHIVE_SHA256,
  BYTE_POLICY,
  MANIFEST,
  PACKAGE_COMMIT,
  PACKAGE_COMMIT_SUBJECT,
  PACKAGE_ROOT,
  REQUESTED,
  VERIFIED_ON,
  hashFile,
  loadPackage,
  parseManifest,
  runAcceptance,
  verifyPackage,
};
