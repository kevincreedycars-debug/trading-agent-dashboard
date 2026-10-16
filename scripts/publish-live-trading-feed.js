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
  "                                   (default <canonical root>/.local/live-trading-feed-publish)",
  "  --remote <name>                  git remote (default origin)",
  "  --branch <name>                  branch Pages serves (default main)",
  "  --min-interval-seconds <n>       fastest cadence allowed between publishes (default 600, six Pages builds",
  "                                   an hour, inside GitHub's documented soft limit of ten; the exact limit",
  "                                   is 360)",
  "  --state <path>                   where the last publish is recorded (default tmp/live-trading-publish-state.json)",
  "  --force                          publish now even if the interval gate says wait",
  "  --dry-run                        run every gate and every read, then stop before writing or pushing",
  "  --json                           print the result as one JSON line (the default is the same line)",
  "  --help                           print this text",
  "",
  "  Exit 0 when the feed is published or already current, 1 when a gate refuses or git fails."
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
function buildCommitMessage(feed, { publishedAtUtc }) {
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
function readRemoteGeneratedAt({ checkout, remote, branch, exec = spawnSync }) {
  const result = git(["-C", checkout, "show", `${remote}/${branch}:${FEED_RELATIVE}`], { exec });
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
  const checkout = options.checkout ? path.resolve(options.checkout) : resolveDefaultCheckout(exec);
  const result = {
    at_utc: new Date(nowMs).toISOString(),
    action: "refuse",
    reason: null,
    feed: path.relative(REPO_ROOT, feedPath).replace(/\\/g, "/") || feedPath,
    checkout,
    remote: options.remote,
    branch: options.branch,
    dry_run: options.dryRun === true,
    force: options.force === true,
    min_interval_seconds: options.minIntervalSeconds,
    published: false
  };

  function finish(action, reason) {
    result.action = action;
    result.reason = reason;
    result.duration_seconds = Math.round((now() - startedMs) / 10) / 100;
    return result;
  }

  if (!fs.existsSync(feedPath)) return finish("refuse", `no artifact at ${feedPath}`);

  let feed = null;
  try {
    feed = JSON.parse(fs.readFileSync(feedPath, "utf8"));
  } catch (error) {
    return finish("refuse", `the artifact is not readable JSON: ${String(error.message || error).slice(0, 120)}`);
  }

  // Gate 1: the dashboard's own guard, not a second opinion written here.
  const problems = validate(feed) || [];
  result.feed_generated_at_utc = feed.generated_at_utc ?? null;
  result.validate_error_count = problems.length;
  if (problems.length) {
    result.validate_errors = problems.slice(0, 5);
    return finish("refuse", `the artifact fails the dashboard's own validator (${problems.length} problem(s))`);
  }

  // Gate 2.
  const freshness = feedFreshnessOk(feed, nowMs);
  result.feed_age_seconds = freshness.ageSeconds;
  result.stale_after_seconds = Number.isFinite(feed.stale_after_seconds) ? feed.stale_after_seconds : null;
  if (!freshness.ok) return finish("refuse", freshness.reason);

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

  const checkoutState = ensureCheckout({ checkout, remote: options.remote, branch: options.branch, exec });
  if (!checkoutState.ok) {
    result.checkout_step = checkoutState.step;
    return finish("refuse", `the publish checkout is not usable: ${checkoutState.error}`);
  }

  const remoteFeed = readRemoteGeneratedAt({ checkout, remote: options.remote, branch: options.branch, exec });
  result.published_generated_at_utc = remoteFeed.generatedAtUtc;
  if (remoteFeed.error) result.published_read_error = remoteFeed.error.slice(0, 200);

  // Gate 3, with gate 4 re-checked against the same state the early hold read.
  const decision = decidePublish({
    localGeneratedAtMs: Date.parse(feed.generated_at_utc ?? ""),
    remoteGeneratedAtMs: remoteFeed.generatedAtMs,
    lastPublishedMs: Number.isFinite(lastPublishedMs) ? lastPublishedMs : NaN,
    nowMs,
    minIntervalSeconds: options.minIntervalSeconds,
    force: options.force === true
  });
  result.decision = decision.action;
  if (decision.action !== "publish") return finish(decision.action, decision.reason);

  const commitMessage = buildCommitMessage(feed, { publishedAtUtc: result.at_utc });
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

    fs.copyFileSync(feedPath, path.join(checkout, ...feedFile.split("/")));

    const add = git(["-C", checkout, "add", feedFile], { exec });
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
  resolveDefaultCheckout,
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


