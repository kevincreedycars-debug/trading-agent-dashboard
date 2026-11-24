"use strict";

/**
 * Dated level-ladder snapshots (research only, 2026-11-23).
 *
 * The lineage tests replay `data/l2l-levels.json`, but that file is a live marking tool document: it is
 * re-marked in place, so it describes the ladder *now*, not the ladder that existed before an old
 * session. Dating a session against today's file therefore cannot do anything but refuse it.
 *
 * This module loads the committed archive of dated copies instead. Each snapshot is verified against the
 * sha256 recorded in the index, so a snapshot that has been edited after the fact is refused rather than
 * silently used. The eligibility rule itself lives in `level_provenance.js`, next to the lane map and the
 * 05:00 London session-start resolver.
 *
 * The archive is evidence, not a generator: nothing here writes a level, moves a mark or infers a
 * snapshot that was never captured.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const INDEX_PATH = path.join("data", "usd-layer1-backtester", "level-snapshots", "index.json");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function levelCounts(ladder) {
  const counts = {};
  for (const instrument of (ladder && ladder.instruments) || []) {
    counts[instrument.symbol] = Array.isArray(instrument.levels) ? instrument.levels.length : 0;
  }
  return counts;
}

/**
 * Load and verify the archive.
 *
 * @param {object} [options]
 * @param {string} [options.rootDir] repository root.
 * @param {string} [options.indexFile] another index, for a future archive location.
 * @returns {object} `{ available, index_path, rule, snapshots, problems, live_file_notice }`
 */
function loadArchive({ rootDir, indexFile } = {}) {
  const root = rootDir || path.resolve(__dirname, "../../..");
  const absolute = indexFile ? path.resolve(indexFile) : path.join(root, INDEX_PATH);
  const relativeIndex = path.relative(root, absolute).replace(/\\/g, "/");
  if (!fs.existsSync(absolute)) {
    return {
      available: false,
      index_path: relativeIndex,
      rule: null,
      snapshots: [],
      problems: [{ file: relativeIndex, reason: "the level-snapshot index is not present in this checkout" }],
      live_file_notice: null
    };
  }
  const index = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const problems = [];
  const snapshots = [];
  for (const entry of Array.isArray(index.snapshots) ? index.snapshots : []) {
    const file = path.join(path.dirname(absolute), entry.file);
    const relative = path.relative(root, file).replace(/\\/g, "/");
    if (!fs.existsSync(file)) {
      problems.push({ file: relative, reason: "the snapshot file named by the index is absent" });
      continue;
    }
    const buffer = fs.readFileSync(file);
    const hash = sha256(buffer);
    if (entry.sha256 && hash !== entry.sha256) {
      problems.push({
        file: relative,
        reason: `sha256 ${hash.slice(0, 12)} does not match the indexed ${String(entry.sha256).slice(0, 12)}; ` +
          "an edited snapshot is refused rather than used"
      });
      continue;
    }
    let ladder = null;
    try {
      ladder = JSON.parse(buffer.toString("utf8"));
    } catch (error) {
      problems.push({ file: relative, reason: `unparseable JSON: ${error.message}` });
      continue;
    }
    const counts = levelCounts(ladder);
    const declared = entry.levels_per_instrument || {};
    const mismatch = Object.keys(declared).filter((symbol) => declared[symbol] !== counts[symbol]);
    if (mismatch.length) {
      problems.push({
        file: relative,
        reason: `levels per instrument disagree with the index for ${mismatch.join(", ")}`
      });
      continue;
    }
    snapshots.push(
      Object.freeze({
        ...entry,
        path: relative,
        verified_sha256: hash,
        ladder,
        levels_per_instrument: counts,
        origin: "archived snapshot"
      })
    );
  }
  return {
    available: true,
    index_path: relativeIndex,
    rule: index.rule || null,
    why_this_exists: index.why_this_exists || null,
    snapshots,
    problems,
    live_file_notice: index.not_a_snapshot || null
  };
}
/**
 * A live ladder is a candidate for future sessions only.
 *
 * `data/l2l-levels.json` is included so the rule can price a session that starts after the file was last
 * written, which is what a forward run needs. It carries no commit evidence, and because the eligibility
 * rule compares its stamp with the session start it can never price a historical session.
 */
function liveLadderCandidate({ ladder, source }) {
  if (!ladder) return null;
  return Object.freeze({
    file: source,
    path: source,
    sha256: null,
    generated_at_utc: ladder.generated_at_utc || null,
    marked_by: ladder.marked_by || null,
    levels_per_instrument: levelCounts(ladder),
    marking_dates: null,
    git_commit: null,
    git_commit_at_utc: null,
    origin: "working file",
    verified_sha256: null,
    ladder
  });
}

/**
 * The snapshots in the order the rule reads them: oldest stamp first, then oldest commit.
 *
 * @param {Array} snapshots archived snapshots and any live candidate.
 * @returns {Array} a sorted copy.
 */
function orderSnapshots(snapshots) {
  return (Array.isArray(snapshots) ? snapshots.slice() : [])
    .filter((snapshot) => snapshot && Number.isFinite(Date.parse(snapshot.generated_at_utc || "")))
    .sort((left, right) => {
      const byStamp = Date.parse(left.generated_at_utc) - Date.parse(right.generated_at_utc);
      if (byStamp !== 0) return byStamp;
      return Date.parse(left.git_commit_at_utc || left.generated_at_utc) - Date.parse(right.git_commit_at_utc || right.generated_at_utc);
    });
}

/**
 * The snapshot in force at a session start: the latest one whose stamp, and whose commit where recorded,
 * are both earlier than the session.
 *
 * @param {Array} ordered the `orderSnapshots` result.
 * @param {number} sessionStartMs the session's 05:00 London start in ms.
 * @returns {object|null} the snapshot, or null when no snapshot existed yet.
 */
function snapshotInForce(ordered, sessionStartMs) {
  let chosen = null;
  for (const snapshot of ordered) {
    const stampMs = Date.parse(snapshot.generated_at_utc || "");
    if (!Number.isFinite(stampMs) || stampMs >= sessionStartMs) continue;
    if (snapshot.git_commit_at_utc) {
      const commitMs = Date.parse(snapshot.git_commit_at_utc);
      if (Number.isFinite(commitMs) && commitMs >= sessionStartMs) continue;
    }
    chosen = snapshot;
  }
  return chosen;
}

module.exports = { INDEX_PATH, sha256, levelCounts, loadArchive, liveLadderCandidate, orderSnapshots, snapshotInForce };
