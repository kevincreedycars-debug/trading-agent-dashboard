const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { ALLOWED_ROOT, FORBIDDEN_ROOTS, assertResearchPath, REPO_ROOT } =
  require("../backtester/scripts/lib/research_path_guard");

/**
 * Isolation guard for the USD session research programme (docs/research/usd-session/v1/isolation.md).
 * A research run must be unable to write a committed production artefact, by default or by accident.
 */

test("research writes are allowed inside the research folder", () => {
  const target = path.join(ALLOWED_ROOT, "experiments", "registry.json");
  assert.equal(assertResearchPath(target, "test"), path.resolve(target));
});

test("production trees are refused even when a research folder exists", () => {
  for (const forbidden of FORBIDDEN_ROOTS) {
    const target = path.join(forbidden, "would-be-written.json");
    assert.throws(() => assertResearchPath(target, "test"), /refusing to write into production path/);
  }
});

test("every committed 24-hour study default output is refused", () => {
  const inheritedDefaults = [
    "data/usd-24h-research-dataset.json",
    "data/usd-24h-dataset-manifest.json",
    "data/usd-24h-experiment-registry.json",
    "data/usd-24h-baseline-comparison.json",
    "data/usd-24h-research-cards.json",
    "data/usd-24h-selection.json",
    "data/usd-24h-shadow-comparison.json",
    "config/usd_24h_ruleset_v2.json",
    "docs/review/usd-24h-ruleset-v1/USD_24H_RESEARCH_CARDS.md",
    "backtester/registries/gold_session_horizon_policy.v1.json"
  ];
  for (const relative of inheritedDefaults) {
    const target = path.join(REPO_ROOT, relative);
    assert.throws(
      () => assertResearchPath(target, "inherited default"),
      /refusing to write/,
      `${relative} must be refused`
    );
  }
});

test("a path outside the research folder is refused even when harmless", () => {
  assert.throws(
    () => assertResearchPath(path.join(REPO_ROOT, "backtester", "tmp", "other-research", "x.json"), "test"),
    /outside the research folder/
  );
});

test("an empty or missing path is refused rather than guessed", () => {
  assert.throws(() => assertResearchPath("", "test"), /without an explicit path/);
  assert.throws(() => assertResearchPath(undefined, "test"), /without an explicit path/);
});

test("the research folder is ignored by git, so a run cannot reach a published branch", () => {
  const ignore = fs.readFileSync(path.join(REPO_ROOT, ".gitignore"), "utf8");
  assert.match(ignore, /^backtester\/tmp\/$/m);
  assert.match(ignore, /^\/tmp\/$/m);
});

test("the guard is a fixed point: real writes land only in the research folder", () => {
  const probe = assertResearchPath(path.join(ALLOWED_ROOT, "guard-probe.txt"), "test");
  fs.mkdirSync(path.dirname(probe), { recursive: true });
  fs.writeFileSync(probe, "guard probe\n", "utf8");
  assert.equal(fs.readFileSync(probe, "utf8"), "guard probe\n");
  fs.rmSync(probe, { force: true });
  assert.equal(fs.existsSync(probe), false);
});
