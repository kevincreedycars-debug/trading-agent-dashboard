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

const REQUESTED = "USD-L1-25F-H1-v0.1.0";
const PACKAGE_DIR = "docs/research/usd-session/h1/v0.1.0";
const PACKAGE_ROOT = `${PACKAGE_DIR}/package`;
const ARCHIVE = `${PACKAGE_DIR}/${REQUESTED}.zip`;
const ARCHIVE_SHA256 = "1c82e9048a3cf2237ffea6873b8099389d09fccefa083cd38ccb87517e3672e0";
const VERIFIED_ON = "2026-11-17";
const MANIFEST = "SHA256SUMS";

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
 * Verify the archive and every file named by its internal manifest.
 *
 * @param {object} options
 * @param {string} options.root repository root
 * @returns {object} deterministic package identity
 */
function verifyPackage({ root }) {
  const packageRoot = path.join(root, PACKAGE_ROOT);
  const archivePath = path.join(root, ARCHIVE);
  const manifestPath = path.join(packageRoot, MANIFEST);

  if (!fs.existsSync(archivePath)) throw new Error(`h1 package: archive is missing at ${ARCHIVE}`);
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
  const rows = JSON.parse(fs.readFileSync(path.join(packageRoot, "rows.json"), "utf8"));
  const inputs = JSON.parse(fs.readFileSync(path.join(packageRoot, "inputs.json"), "utf8"));
  const expected = JSON.parse(fs.readFileSync(path.join(packageRoot, "expected.json"), "utf8"));

  if (archiveSha256 !== ARCHIVE_SHA256) {
    throw new Error(`h1 package: archive sha256 ${archiveSha256} does not match the supplied ${ARCHIVE_SHA256}`);
  }
  if (mismatches.length) {
    throw new Error(`h1 package: ${mismatches.length} internal checksum(s) do not match`);
  }

  return {
    requested: REQUESTED,
    status: "VERIFIED",
    verification: "archive sha256 + every SHA256SUMS entry recomputed from the committed bytes",
    verified_on: VERIFIED_ON,
    archive: {
      path: ARCHIVE,
      bytes: fs.statSync(archivePath).size,
      sha256: archiveSha256,
      sha256_expected: ARCHIVE_SHA256,
      matches: archiveSha256 === ARCHIVE_SHA256,
    },
    internal_checksums: {
      manifest: `${PACKAGE_ROOT}/${MANIFEST}`,
      manifest_sha256: hashFile(manifestPath),
      declared: files.length,
      verified: files.length - mismatches.length,
      mismatches: mismatches.map((file) => file.path),
      files,
    },
    contents: {
      rows: rows.rows.length,
      inputs: Object.keys(inputs).length,
      fixtures: Object.keys(expected).filter((key) => expected[key] && typeof expected[key] === "object"),
      candidate: rows.candidate,
      rows_status: rows.status || null,
    },
    consequence:
      "The supplied archive verifies and its frozen 25-row candidate is registered in the shared engine. Fixture reproduction is an acceptance control, not historical evidence; historical coverage and live parity remain open.",
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
  MANIFEST,
  PACKAGE_DIR,
  PACKAGE_ROOT,
  REQUESTED,
  VERIFIED_ON,
  hashFile,
  loadPackage,
  parseManifest,
  verifyPackage,
};
