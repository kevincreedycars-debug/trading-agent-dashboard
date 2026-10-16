"use strict";

/**
 * Research path guard.
 *
 * The USD session research programme (2026-10-13) may write only inside its own ignored research
 * folder. This module is the single gate every research script in that programme calls before it
 * creates a directory or writes a file, so a mistyped or inherited default cannot overwrite a
 * committed production artefact.
 *
 * It is deliberately additive: existing 24-hour study scripts are untouched, and a script opts in by
 * calling `assertResearchPath()` on every path it is about to write.
 */

const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Ignored research folders this programme may write into. */
const ALLOWED_ROOT = path.resolve(REPO_ROOT, "backtester/tmp/usd-session-research");

/** Committed production trees that must never be a research write target. */
const FORBIDDEN_ROOTS = [
  path.resolve(REPO_ROOT, "data"),
  path.resolve(REPO_ROOT, "config"),
  path.resolve(REPO_ROOT, "exports"),
  path.resolve(REPO_ROOT, "logic"),
  path.resolve(REPO_ROOT, "scripts"),
  path.resolve(REPO_ROOT, "backtester/registries"),
  path.resolve(REPO_ROOT, "docs/review"),
  path.resolve(REPO_ROOT, "docs/analysis-engine")
];

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Throw unless `targetPath` resolves inside the allowed research root.
 *
 * @param {string} targetPath absolute or relative path a script intends to write.
 * @param {string} [label] caller name for the error message.
 * @returns {string} the resolved absolute path, for convenience.
 */
function assertResearchPath(targetPath, label = "research script") {
  if (!targetPath || typeof targetPath !== "string") {
    throw new Error(`${label}: refusing to write without an explicit path`);
  }
  const resolved = path.resolve(targetPath);
  for (const forbidden of FORBIDDEN_ROOTS) {
    if (isInside(resolved, forbidden)) {
      throw new Error(
        `${label}: refusing to write into production path ${path.relative(REPO_ROOT, resolved).replace(/\\/g, "/")}`
      );
    }
  }
  if (!isInside(resolved, ALLOWED_ROOT)) {
    throw new Error(
      `${label}: write target ${resolved} is outside the research folder ${ALLOWED_ROOT}`
    );
  }
  return resolved;
}

module.exports = {
  REPO_ROOT,
  ALLOWED_ROOT,
  FORBIDDEN_ROOTS,
  assertResearchPath
};
