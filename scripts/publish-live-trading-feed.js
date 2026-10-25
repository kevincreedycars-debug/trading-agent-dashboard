// The one step that puts the read-only Live Trading feed on the published dashboard: copy the validated
// artifact onto production `main` as a single data-file commit, and nothing else.
//
//   node scripts/publish-live-trading-feed.js --dry-run     say what it would do, write and push nothing
//   node scripts/publish-live-trading-feed.js               publish when the gates below allow it
//
// The page reads one file, `data/live-trading.json`, through `fetchLocalJson`, which fetches with
// `cache: "no-store"`, and `loadDashboard` runs on a 60-second timer. So a publish is one file and one
// commit: no cache-buster token has to move in `script.js` or `index.html`, and an open page picks the new
// bytes up on its next tick once the site has rebuilt.
//
// Four gates stand between the artifact and `main`, and each one is a refusal rather than a warning:
//
//   1. The artifact passes `scripts/validate_live_trading_feed.js`. A feed the dashboard's own guard rejects
//      is never published.
//   2. The artifact is inside its own freshness window (`stale_after_seconds` against `generated_at_utc`), so
//      a stalled cadence cannot republish the same old read as if it were live.
//   3. The feed is strictly newer than the copy `main` already carries, so a late or out-of-order run cannot
//      walk the published page backwards.
//   4. At least `--min-interval-seconds` have passed since the last publish from this machine. The default is
//      600 because GitHub documents a soft limit of 10 builds per hour for Pages sites built from a branch,
//      and a publish is a push to the branch Pages serves: five-minute publishing is 12 builds an hour, ten
//      minutes is 6. `--force` overrides this gate for one deliberate publish.
//
// Nothing here reads a credential, opens a broker connection or calls an order function. The push uses
// whatever git credential the machine already has for `origin`; `GIT_TERMINAL_PROMPT=0` makes a missing or
// rejected one fail instead of hanging a scheduled run.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const feedValidator = require("./validate_live_trading_feed.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const FEED_RELATIVE = "data/live-trading.json";
const DEFAULT_REMOTE = "origin";
const DEFAULT_BRANCH = "main";
const DEFAULT_STATE = "tmp/live-trading-publish-state.json";
const DEFAULT_CHECKOUT_RELATIVE = ".local/live-trading-feed-publish";
// A dry run gets a checkout of its own, thrown away when the run ends, so passing a test can never reset the
// checkout a live publish is working in. The path is fixed and dated rather than random, because a run that is
// killed before its own cleanup leaves a directory whose name says what it was and which run left it.
const DEFAULT_DRY_RUN_CHECKOUT_RELATIVE = ".local/live-trading-feed-publish-dryrun";
// The lock a real publish takes on the shared checkout. Fifteen minutes is longer than any push this script can
// make (every git call has a 120s ceiling and there are at most two attempts), so a lock that old belongs to a
// process that is gone.
const LOCK_TTL_SECONDS = 900;
// 10 builds an hour is GitHub's documented soft limit for Pages sites built from a branch, and a publish is one
// push to that branch: the exact limit is one publish every 360 seconds, with no headroom at all. The default is
// twice that - 600 seconds, six builds an hour - so an ordinary cadence sits well inside the limit and the
// tighter figure is something a caller has to ask for with --min-interval-seconds.
const PAGES_BUILDS_PER_HOUR = 10;
const PAGES_BUILDS_PER_HOUR_FLOOR_SECONDS = 360;
const DEFAULT_MIN_INTERVAL_SECONDS = 600;
const GIT_TIMEOUT_MS = 120000;

const USAGE = [
  "Usage:",
  "  node scripts/publish-live-trading-feed.js [options]",
  "",
  "  --feed <path>                    artifact to publish (default data/live-trading.json)",
  "  --checkout <path>                the publish checkout, reset to the remote branch each run",
  "                                   (default <canonical root>/.local/live-trading-feed-publish; a --dry-run with",
  "                                   no --checkout uses a throwaway checkout of its own and removes it)",
  "  --remote <name>                  git remote (default origin)",
  "  --branch <name>                  branch Pages serves (default main)",
  "  --min-interval-seconds <n>       fastest cadence allowed between publishes (default 600, six Pages builds",
  "                                   an hour, inside GitHub's documented soft limit of ten; the exact limit",
  "                                   is 360)",
  "  --state <path>                   where the last publish is recorded (default tmp/live-trading-publish-state.json)",
  "  --lock <path>                    the lock a real publish holds on the shared checkout",
  "                                   (default: beside the state file, live-trading-publish.lock)",
  "  --force                          publish now even if the interval gate says wait",
  "  --dry-run                        run every gate and every read, then stop before writing or pushing",
  "  --json                           print the result as one JSON line (the default is the same line)",
  "  --help                           print this text",
  "",
  "  Exit 0 when the feed is published or already current, 1 when a gate refuses, the lock is held or git fails."
].join("\n");

// The one error a caller is meant to see as a message rather than a stack: a bad command line.
class UsageError extends Error {}

function parseArgs(argv) {
  const options = {
    feed: FEED_RELATIVE,
    checkout: null,
    remote: DEFAULT_REMOTE,
    branch: DEFAULT_BRANCH,
    minIntervalSeconds: DEFAULT_MIN_INTERVAL_SECONDS,
    state: DEFAULT_STATE,
    lock: null,
    force: false,
    dryRun: false,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new UsageError(`Argument ${token} needs a value`);
      return argv[index];
    };
    switch (token) {
      case "--feed":
        options.feed = next();
        break;
      case "--checkout":
        options.checkout = next();
        break;
      case "--remote":
        options.remote = next();
        break;
      case "--branch":
        options.branch = next();
        break;
      case "--min-interval-seconds":
        options.minIntervalSeconds = positiveNumber(token, next());
        break;
      case "--state":
        options.state = next();
        break;
      case "--lock":
        options.lock = next();
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new UsageError(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function positiveNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new UsageError(`${flag} needs a positive number, got ${raw}`);
  return value;
}

// Git, run with the working directory the caller gave, and with the two settings this script depends on made
// explicit: no interactive credential prompt, and no pager.
function git(args, { cwd = REPO_ROOT, exec = spawnSync } = {}) {
  const result = exec("git", args, {
    cwd,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_PAGER: "cat" }
  });
  const stdout = typeof result?.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result?.stderr === "string" ? result.stderr.trim() : "";
  const status = typeof result?.status === "number" ? result.status : null;
  return { status, ok: result?.error === undefined && status === 0, stdout, stderr, error: result?.error || null };
}

// The publish checkout lives beside the other release checkouts, in the canonical root rather than inside the
// lane worktree, so publishing never adds an untracked directory to the tree this lane commits from.
function resolveDefaultCheckout(exec = spawnSync) {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], { exec });
  if (common.ok && common.stdout) {
    const canonicalRoot = path.dirname(path.resolve(common.stdout));
    return path.join(canonicalRoot, ...DEFAULT_CHECKOUT_RELATIVE.split("/"));
  }
  return path.join(REPO_ROOT, ...DEFAULT_CHECKOUT_RELATIVE.split("/"));
}

// A dry run's own checkout: a fresh worktree beside the live one, named for the run, removed when the run ends.
// The live checkout is deliberately not reused, because `ensureCheckout` fetches and force-checks-out, and a test
// doing that to the checkout a scheduled publish is mid-way through is how a publish and a test corrupt each
// other. The namestamp is the run's own start, so a directory left behind by a killed run can be aged out by hand.
function resolveIsolatedCheckout({ nowMs = Date.now(), pid = process.pid, exec = spawnSync } = {}) {
  const live = resolveDefaultCheckout(exec);
  const root = path.dirname(live);
  const stamp = new Date(nowMs).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return path.join(root, `${path.basename(live)}-run-${stamp}-${pid}`);
}

// The lock a real publish holds. It lives beside the state file rather than in the checkout, so it survives the
// checkout being reset and so a run with a different state file (a test) cannot block the scheduled publisher.
function resolveLockPath(statePath) {
  const resolved = path.resolve(statePath || DEFAULT_STATE);
  return path.join(path.dirname(resolved), "live-trading-publish.lock");
}

function describeLockHolder(holder) {
  if (!holder || typeof holder !== "object") return "an unreadable lock file";
  const pid = Number.isFinite(Number(holder.pid)) ? `pid ${holder.pid}` : "an unknown process";
  const at = typeof holder.started_at_utc === "string" ? ` since ${holder.started_at_utc}` : "";
  return `${pid}${at}`;
}

// Taken with `wx`, which is one atomic create-or-fail, so two runs starting in the same millisecond cannot both
// win. A lock left by a process that died is broken after the TTL rather than blocking publishing for ever;
// breaking it is recorded in the result so a reader can see it happened rather than wonder why a run proceeded.
function acquirePublishLock({ lockPath, nowMs = Date.now(), ttlSeconds = LOCK_TTL_SECONDS, checkout = null } = {}) {
  const holder = { pid: process.pid, started_at_utc: new Date(nowMs).toISOString(), checkout };
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeSync(fd, `${JSON.stringify(holder)}\n`);
    fs.closeSync(fd);
    return { ok: true, held: true, holder, stale_broken: false, reason: null };
  } catch (error) {
    if (error?.code !== "EEXIST") {
      return {
        ok: false,
        held: false,
        holder: null,
        stale_broken: false,
        reason: `the publish lock could not be created (${error?.code || error?.message || "unknown error"})`
      };
    }
  }
  let existing = null;
  let ageMs = null;
  try {
    existing = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch {
    existing = null;
  }
  try {
    ageMs = nowMs - fs.statSync(lockPath).mtimeMs;
  } catch {
    ageMs = null;
  }
  if (Number.isFinite(ageMs) && ageMs > ttlSeconds * 1000) {
    fs.writeFileSync(lockPath, `${JSON.stringify({ ...holder, broke_stale_lock_from: existing })}\n`, "utf8");
    return {
      ok: true,
      held: true,
      holder,
      stale_broken: true,
      stale_age_seconds: Math.round(ageMs / 1000),
      reason: null
    };
  }
  return {
    ok: false,
    held: false,
    holder: existing,
    stale_broken: false,
    reason: `another publish holds the lock (${describeLockHolder(existing)})`
  };
}

// Released only when the file still holds this run's own holder line, so a run that broke a stale lock can never
// delete the lock a later run has since taken.
function releasePublishLock({ lockPath, holder } = {}) {
  try {
    const current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (!holder || current?.pid !== holder.pid || current?.started_at_utc !== holder.started_at_utc) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

// A dry run removes its own checkout when it ends, pass or fail. If git will not remove it (a run killed before
// this point, a directory git no longer knows), the directory is deleted and the worktree list pruned, because
// leaving it behind would make the next run fail on the same path.
function removeIsolatedCheckout(checkout, exec = spawnSync) {
  const removed = git(["worktree", "remove", "--force", checkout], { exec });
  if (removed.ok) return { removed: true, step: "worktree remove" };
  try {
    fs.rmSync(checkout, { recursive: true, force: true });
    git(["worktree", "prune"], { exec });
    return { removed: true, step: "rm + prune" };
  } catch (error) {
    return { removed: false, step: "cleanup failed", error: String(error?.message || error) };
  }
}

function parseGeneratedAt(text) {
  try {
    const parsed = JSON.parse(text);
    const ms = Date.parse(parsed?.generated_at_utc ?? "");
    return { generatedAtMs: Number.isFinite(ms) ? ms : null, generatedAtUtc: parsed?.generated_at_utc ?? null };
  } catch {
    return { generatedAtMs: null, generatedAtUtc: null };
  }
}

// Gate 2, on its own: the artifact has to be inside the freshness window it declares, measured against the
// snapshot's own `generated_at_utc`. A null answer means the artifact did not say, which is a refusal.
function feedFreshnessOk(feed, nowMs = Date.now()) {
  const generatedMs = Date.parse(feed?.generated_at_utc ?? "");
  const staleAfter = feed?.stale_after_seconds;
  if (!Number.isFinite(generatedMs) || !Number.isFinite(staleAfter)) {
    return {
      ok: false,
      reason: "the artifact carries no readable generated_at_utc or stale_after_seconds",
      ageSeconds: null
    };
  }
  const ageSeconds = Math.round((nowMs - generatedMs) / 1000);
  if (ageSeconds > staleAfter) {
    return { ok: false, reason: `the artifact is ${ageSeconds}s old against its own ${staleAfter}s window`, ageSeconds };
  }
  return { ok: true, reason: null, ageSeconds };
}

// Gate 4 on its own, because it is the only gate that can be answered from the state file alone: a run inside
// the cadence is held back before the checkout is even opened, so a skipped run costs no git work at all.
function intervalGate({ lastPublishedMs, nowMs, minIntervalSeconds, force = false }) {
  if (force || !Number.isFinite(lastPublishedMs)) return { action: "ok", reason: null };
  const sinceSeconds = Math.round((nowMs - lastPublishedMs) / 1000);
  if (nowMs - lastPublishedMs < minIntervalSeconds * 1000) {
    return {
      action: "too_soon",
      reason: `the last publish was ${sinceSeconds}s ago, inside the ${minIntervalSeconds}s cadence`
    };
  }
  return { action: "ok", reason: null };
}

// Gates 3 and 4 together, as one pure decision, so the refusals can be asserted without a repository. The
// comparison is on the snapshots' own `generated_at_utc` rather than on raw bytes, because the committed copy
// is line-ending normalised by git and a byte compare would republish the same read as a change.
function decidePublish({
  localGeneratedAtMs,
  remoteGeneratedAtMs,
  lastPublishedMs,
  nowMs,
  minIntervalSeconds,
  force = false
}) {
  if (!Number.isFinite(localGeneratedAtMs)) {
    return { action: "refuse", reason: "the artifact carries no readable generated_at_utc" };
  }
  if (Number.isFinite(remoteGeneratedAtMs) && localGeneratedAtMs <= remoteGeneratedAtMs) {
    return {
      action: "unchanged",
      reason:
        localGeneratedAtMs === remoteGeneratedAtMs
          ? "the published copy already carries this feed"
          : "the published copy carries a newer feed"
    };
  }
  const interval = intervalGate({ lastPublishedMs, nowMs, minIntervalSeconds, force });
  if (interval.action !== "ok") return interval;
  return { action: "publish", reason: null };
}

// The published commit says what it carries and what it is not. The body is the part a later reader needs:
// why no cache-buster moved, and which read-only facts the bytes hold.
function buildCommitMessage(feed, { publishedAtUtc, targets = [FEED_RELATIVE], extras = [] }) {
  const generatedAt = feed?.generated_at_utc ?? "<unknown>";
  const subject = `live-trading: publish the M5/H1/H4 snapshot for ${generatedAt}, data file only`;
  const body = [
    `The cadence on the machine holding the terminal last wrote data/live-trading.json at ${generatedAt}; ` +
      `this commit carries that validated snapshot and nothing else, published ${publishedAtUtc}.`,
    "No cache-buster token is bumped: the panel reads this file through fetchLocalJson with cache no-store " +
      "and loadDashboard runs every 60 seconds, so a reload and the next tick both fetch the new bytes.",
    `Read-only feed bytes: schema ${feed?.schema_version ?? "<unknown>"}, read_only ${feed?.read_only === true}, ` +
      `order_functions_called ${feed?.order_functions_called === true}, ` +
      `positions_open ${feed?.account?.positions_open ?? "<unknown>"}, ` +
      `account masked as ${feed?.account?.login_masked ?? "<unknown>"}.`
  ];
  if (targets.length > 1) {
    body.push(
      `This commit carries ${targets.length} lane artifacts in one read: ${targets.join(", ")}, each validated ` +
        "and settled on its own account before the commit was made, so the page never serves one lane newer than another."
    );
  }
  if (extras.length) {
    body.push(
      `It also carries the lanes document and each lane's trader heartbeat (${extras.join(", ")}), copied beside ` +
        "the snapshots so the page can say which accounts exist, which of them are deployed, and whether a loop is " +
        "alive behind each account it draws."
    );
  }
  return `${subject}\n\n${body.join("\n")}\n`;
}
function readState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function writeState(statePath, payload) {
  const resolved = path.resolve(statePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return resolved;
}

// The publish checkout is reset to the remote branch every run rather than merged, so it can never carry a
// half-finished local state into a publish. It is created once, at the commit the served branch is on.
function ensureCheckout({ checkout, remote, branch, exec = spawnSync }) {
  const steps = fs.existsSync(path.join(checkout, ".git"))
    ? [["-C", checkout, "fetch", remote, branch]]
    : [["worktree", "add", "--detach", checkout, `${remote}/${branch}`]];
  for (const args of steps) {
    const result = git(args, { exec });
    if (!result.ok) {
      return {
        ok: false,
        step: args.join(" "),
        error: result.stderr || result.error?.message || `git exited ${result.status}`
      };
    }
  }
  const detached = git(["-C", checkout, "checkout", "--detach", "--force", `${remote}/${branch}`], { exec });
  if (!detached.ok) {
    return { ok: false, step: "checkout --detach", error: detached.stderr || `git exited ${detached.status}` };
  }
  return { ok: true, step: null, error: null };
}

// The published copy's own `generated_at_utc`, read straight out of the commit rather than from the checkout's
// working file, so gate 3 compares against what the site is actually being served.
function readRemoteGeneratedAt({ checkout, remote, branch, relative = FEED_RELATIVE, exec = spawnSync }) {
  const result = git(["-C", checkout, "show", `${remote}/${branch}:${relative}`], { exec });
  if (!result.ok) {
    return { generatedAtMs: null, generatedAtUtc: null, error: result.stderr || `git exited ${result.status}` };
  }
  return { ...parseGeneratedAt(result.stdout), error: null };
}

// The publish itself: read the artifact, run the four gates, then copy one file into the publish checkout,
// commit it and push it. Every dependency a test needs to replace - the clock, git, the validator - is
// injectable, so the refusals and the push can both be exercised without touching the real remote.
function publishFeed(options, deps = {}) {
  const exec = deps.exec || spawnSync;
  const now = deps.now || (() => Date.now());
  const validate = deps.validate || ((feed) => feedValidator.validateLiveTradingFeed(feed));
  const nowMs = now();
  const startedMs = nowMs;
  const feedPath = path.resolve(REPO_ROOT, options.feed);
  const statePath = path.resolve(options.state || DEFAULT_STATE);
  // A dry run that was not given a checkout of its own gets one that lasts only as long as the run: the shared
  // checkout is what a scheduled publish works in, and a test must never reset it. A caller that names
  // --checkout keeps exactly the path it named, which is how the tests assert on the checkout they built.
  const isolatedCheckout = options.dryRun === true && !options.checkout;
  const checkout = options.checkout
    ? path.resolve(options.checkout)
    : isolatedCheckout
      ? resolveIsolatedCheckout({ nowMs, exec })
      : resolveDefaultCheckout(exec);
  const lockPath = options.lock ? path.resolve(options.lock) : resolveLockPath(statePath);
  let lock = null;
  const result = {
    at_utc: new Date(nowMs).toISOString(),
    action: "refuse",
    reason: null,
    feed: path.relative(REPO_ROOT, feedPath).replace(/\\/g, "/") || feedPath,
    checkout,
    checkout_is_isolated: isolatedCheckout,
    lock: null,
    remote: options.remote,
    branch: options.branch,
    dry_run: options.dryRun === true,
    force: options.force === true,
    min_interval_seconds: options.minIntervalSeconds,
    published: false
  };

  // Every exit goes through here, so the lock and a dry run's own checkout are released on every path that
  // returns - a refusal, a held lock, an unchanged feed, a publish. A run that throws instead leaves its lock
  // file behind, which is what the lock's own TTL is for: the next run breaks it and records that it did.
  function finish(action, reason) {
    result.action = action;
    result.reason = reason;
    if (lock?.held) {
      result.lock_released = releasePublishLock({ lockPath, holder: lock.holder });
      lock.held = false;
    }
    if (isolatedCheckout) {
      result.checkout_cleanup = removeIsolatedCheckout(checkout, exec);
    }
    result.duration_seconds = Math.round((now() - startedMs) / 10) / 100;
    return result;
  }

  // The artifacts this run carries. One published file is the shape every existing caller and test uses; the
  // lanes publisher passes one entry per account instead, all landing in a single commit and a single pages
  // build, so two accounts are never served from two different commits of the same page. Each entry names the
  // bytes to read and the published path they belong at, and an artifact that cannot be read or validated
  // refuses the whole run rather than publishing half the picture.
  const artifacts = Array.isArray(options.artifacts) && options.artifacts.length
    ? options.artifacts.map((entry) => ({
        label: entry.label ?? null,
        source: path.resolve(REPO_ROOT, entry.source),
        target: String(entry.target || FEED_RELATIVE)
      }))
    : [{ label: null, source: feedPath, target: FEED_RELATIVE }];
  result.artifacts = [];
  // Files carried in the same commit that are not feed snapshots: the lanes document, and each lane's trader
  // heartbeat. They are copied rather than validated as feeds, because they are not feeds - but they still have
  // to be there and has to parse, so a commit can never carry half of the page's picture or a truncated JSON file.
  const extras = Array.isArray(options.extras) && options.extras.length
    ? options.extras.map((entry) => ({
        label: entry.label ?? null,
        source: path.resolve(REPO_ROOT, entry.source),
        target: String(entry.target || "")
      }))
    : [];
  result.extras = [];
  for (const extra of extras) {
    if (!extra.target) return finish("refuse", "an extra file was named with no published path");
    if (!fs.existsSync(extra.source)) {
      return finish("refuse", `no file at ${extra.source} for ${extra.target}`);
    }
    try {
      JSON.parse(fs.readFileSync(extra.source, "utf8"));
    } catch (error) {
      return finish(
        "refuse",
        `${extra.target} is not readable JSON: ${String(error.message || error).slice(0, 120)}`
      );
    }
    result.extras.push({ target: extra.target, label: extra.label });
  }

  let feed = null;
  for (const artifact of artifacts) {
    const where = artifact.label ? `${artifact.target} (${artifact.label})` : artifact.source;
    if (!fs.existsSync(artifact.source)) return finish("refuse", `no artifact at ${artifact.source} for ${where}`);
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(artifact.source, "utf8"));
    } catch (error) {
      return finish(
        "refuse",
        `the artifact at ${where} is not readable JSON: ${String(error.message || error).slice(0, 120)}`
      );
    }
    // Gate 1: the dashboard's own guard, not a second opinion written here.
    const problems = validate(parsed) || [];
    result.validate_error_count = problems.length;
    if (problems.length) {
      result.validate_errors = problems.slice(0, 5);
      return finish(
        "refuse",
        `the artifact at ${where} fails the dashboard's own validator (${problems.length} problem(s))`
      );
    }
    // Gate 2, artifact by artifact: each lane declares its own freshness window.
    const freshness = feedFreshnessOk(parsed, nowMs);
    result.feed_generated_at_utc = result.feed_generated_at_utc ?? (parsed.generated_at_utc ?? null);
    result.feed_age_seconds = result.feed_age_seconds ?? freshness.ageSeconds;
    result.stale_after_seconds =
      result.stale_after_seconds ?? (Number.isFinite(parsed.stale_after_seconds) ? parsed.stale_after_seconds : null);
    result.artifacts.push({
      label: artifact.label,
      target: artifact.target,
      generated_at_utc: parsed.generated_at_utc ?? null,
      age_seconds: freshness.ageSeconds
    });
    if (!freshness.ok) return finish("refuse", `${where}: ${freshness.reason}`);
    if (!feed) feed = parsed;
  }

  // Gate 4 early: it is the only gate that needs nothing but the state file, so a run inside the cadence is held
  // back before any git work at all. `--force` is what a deliberate out-of-cadence publish passes.
  const state = readState(statePath);
  const lastPublishedMs = Date.parse(state?.last_published_at_utc ?? "");
  const interval = intervalGate({
    lastPublishedMs: Number.isFinite(lastPublishedMs) ? lastPublishedMs : NaN,
    nowMs,
    minIntervalSeconds: options.minIntervalSeconds,
    force: options.force === true
  });
  if (interval.action !== "ok") {
    result.decision = interval.action;
    return finish(interval.action, interval.reason);
  }

  // A real publish takes the lock before it resets anything: the checkout is shared, and two runs resetting it
  // at once is how one publish commits the other's half-copied bytes. A dry run never takes the lock, because it
  // never touches the shared checkout, so a test cannot hold the scheduled publisher up.
  if (options.dryRun !== true) {
    lock = acquirePublishLock({ lockPath, nowMs, checkout });
    result.lock = {
      path: lockPath,
      held: lock.held === true,
      stale_broken: lock.stale_broken === true,
      holder: lock.holder || null
    };
    if (lock.stale_broken) result.lock.stale_age_seconds = lock.stale_age_seconds;
    if (!lock.ok) return finish("locked", lock.reason);
  }

  const checkoutState = ensureCheckout({ checkout, remote: options.remote, branch: options.branch, exec });
  if (!checkoutState.ok) {
    result.checkout_step = checkoutState.step;
    return finish("refuse", `the publish checkout is not usable: ${checkoutState.error}`);
  }

  // Gate 3, artifact by artifact: an artifact the served branch already carries at this reading or newer needs
  // no publish, and the run publishes when at least one artifact is genuinely newer. `decidePublish` stays the
  // one decision function; it is asked once per artifact, so a lane cannot be walked backwards and a lane that
  // is merely current does not hold the other back.
  const pending = [];
  for (let index = 0; index < artifacts.length; index += 1) {
    const artifact = artifacts[index];
    const remoteFeed = readRemoteGeneratedAt({
      checkout,
      remote: options.remote,
      branch: options.branch,
      relative: artifact.target,
      exec
    });
    result.artifacts[index].published_generated_at_utc = remoteFeed.generatedAtUtc;
    if (remoteFeed.error) result.artifacts[index].published_read_error = remoteFeed.error.slice(0, 200);
    if (index === 0) {
      result.published_generated_at_utc = remoteFeed.generatedAtUtc;
      if (remoteFeed.error) result.published_read_error = remoteFeed.error.slice(0, 200);
    }

    const decision = decidePublish({
      localGeneratedAtMs: Date.parse(result.artifacts[index].generated_at_utc ?? ""),
      remoteGeneratedAtMs: remoteFeed.generatedAtMs,
      lastPublishedMs: Number.isFinite(lastPublishedMs) ? lastPublishedMs : NaN,
      nowMs,
      minIntervalSeconds: options.minIntervalSeconds,
      force: options.force === true
    });
    result.artifacts[index].decision = decision.action;
    if (decision.action === "refuse") {
      result.decision = "refuse";
      return finish("refuse", `${artifact.target}: ${decision.reason}`);
    }
    if (decision.action !== "publish") {
      result.artifacts[index].reason = decision.reason;
      continue;
    }
    pending.push(artifact.target);
  }
  if (!pending.length) {
    result.decision = "unchanged";
    return finish(
      "unchanged",
      artifacts.length === 1
        ? result.artifacts[0].reason || "the published copy already carries this feed"
        : "the published copies already carry every lane's feed"
    );
  }
  result.decision = "publish";
  result.pending_targets = pending;

  const commitMessage = buildCommitMessage(feed, {
    publishedAtUtc: result.at_utc,
    targets: artifacts.map((artifact) => artifact.target),
    extras: extras.map((extra) => extra.target)
  });
  result.commit_message_subject = commitMessage.split("\n")[0];
  if (options.dryRun === true) {
    return finish("would_publish", "every gate passed and --dry-run was asked for, so nothing was written or pushed");
  }

  return commitAndPush({
    result,
    finish,
    feed,
    feedPath,
    feedFile: FEED_RELATIVE,
    artifacts,
    extras,
    checkout,
    remote: options.remote,
    branch: options.branch,
    commitMessage,
    state,
    statePath,
    exec,
    now,
    minIntervalSeconds: options.minIntervalSeconds
  });
}

// One data file, one commit, one push, and one retry if the branch moved under the run. A publish that lands
// is recorded in the state file so the interval gate can hold the next run back.
function commitAndPush(context) {
  const {
    result,
    finish,
    feed,
    feedPath,
    feedFile,
    artifacts = null,
    extras = null,
    checkout,
    remote,
    branch,
    commitMessage,
    state,
    statePath,
    exec,
    now,
    minIntervalSeconds
  } = context;

  for (let attempts = 1; attempts <= 2; attempts += 1) {
    result.attempts = attempts;
    if (attempts > 1) {
      const again = ensureCheckout({ checkout, remote, branch, exec });
      if (!again.ok) return finish("refuse", `the publish checkout could not be reset for a retry: ${again.error}`);
    }

    // Every artifact this run carries is copied and staged in the same commit: one publish, one pages build,
    // and no window in which the page serves one account's new read beside the other's old one.
    const carried = Array.isArray(artifacts) && artifacts.length
      ? artifacts
      : [{ source: feedPath, target: feedFile }];
    const carriedExtras = Array.isArray(extras) ? extras : [];
    for (const artifact of carried) {
      fs.copyFileSync(artifact.source, path.join(checkout, ...artifact.target.split("/")));
    }
    // The lanes document and the trader heartbeats ride in the same commit as the snapshots. Each is copied
    // after the directory that will hold it exists, so a first publish cannot fail on a missing folder.
    for (const extra of carriedExtras) {
      const resolved = path.join(checkout, ...extra.target.split("/"));
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
      fs.copyFileSync(extra.source, resolved);
    }

    const staged = carried.map((artifact) => artifact.target).concat(carriedExtras.map((extra) => extra.target));
    const add = git(["-C", checkout, "add", ...staged], { exec });
    if (!add.ok) return finish("refuse", `git add failed: ${add.stderr || `git exited ${add.status}`}`);

    const commit = git(["-C", checkout, "commit", "-m", commitMessage], { exec });
    if (!commit.ok) {
      const nothingToCommit = /nothing to commit|no changes added/i.test(`${commit.stdout} ${commit.stderr}`);
      if (nothingToCommit) return finish("unchanged", "the checkout already carries these exact bytes");
      return finish("refuse", `git commit failed: ${commit.stderr || commit.stdout || `git exited ${commit.status}`}`);
    }
    result.commit = git(["-C", checkout, "rev-parse", "HEAD"], { exec }).stdout || null;

    const push = git(["-C", checkout, "push", remote, `HEAD:${branch}`], { exec });
    if (push.ok) {
      result.published = true;
      result.push_summary = `${push.stdout} ${push.stderr}`.trim().split("\n").slice(-1)[0].slice(0, 200);
      result.state = writeState(statePath, {
        last_published_at_utc: new Date(now()).toISOString(),
        last_published_generated_at_utc: feed.generated_at_utc ?? null,
        // One entry per lane artifact in the commit, so a reader of the state file can tell which account's
        // read the last publish actually carried.
        last_published_artifacts: Array.isArray(result.artifacts)
          ? result.artifacts.map((artifact) => ({
              target: artifact.target,
              label: artifact.label,
              generated_at_utc: artifact.generated_at_utc
            }))
          : [],
        last_published_extras: Array.isArray(result.extras) ? result.extras.map((extra) => extra.target) : [],
        last_published_commit: result.commit,
        publish_count: Number.isInteger(state?.publish_count) ? state.publish_count + 1 : 1,
        min_interval_seconds: minIntervalSeconds,
        pages_builds_per_hour_limit: PAGES_BUILDS_PER_HOUR
      });
      return finish("published", null);
    }

    const rejected = /rejected|non-fast-forward|fetch first|stale info/i.test(`${push.stdout} ${push.stderr}`);
    if (!rejected) return finish("refuse", `git push failed: ${push.stderr || push.stdout || `git exited ${push.status}`}`);
    result.retried_after_rejected_push = true;
  }

  return finish("refuse", "the push was rejected twice; the served branch kept moving");
}

function main(argv = process.argv.slice(2), deps = {}) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const result = publishFeed(options, deps);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.published || ["unchanged", "too_soon", "would_publish"].includes(result.action) ? 0 : 1;
}

module.exports = {
  REPO_ROOT,
  FEED_RELATIVE,
  DEFAULT_REMOTE,
  DEFAULT_BRANCH,
  DEFAULT_STATE,
  DEFAULT_CHECKOUT_RELATIVE,
  DEFAULT_DRY_RUN_CHECKOUT_RELATIVE,
  LOCK_TTL_SECONDS,
  DEFAULT_MIN_INTERVAL_SECONDS,
  PAGES_BUILDS_PER_HOUR,
  PAGES_BUILDS_PER_HOUR_FLOOR_SECONDS,
  USAGE,
  UsageError,
  parseArgs,
  feedFreshnessOk,
  intervalGate,
  decidePublish,
  buildCommitMessage,
  parseGeneratedAt,
  git,
  resolveDefaultCheckout,
  resolveIsolatedCheckout,
  resolveLockPath,
  acquirePublishLock,
  releasePublishLock,
  removeIsolatedCheckout,
  ensureCheckout,
  readRemoteGeneratedAt,
  readState,
  writeState,
  publishFeed,
  main
};

if (require.main === module) {
  process.exit(main());
}


