// Contract tests for the publish step: the one place the lane's read-only artifact is allowed onto the branch
// Pages serves. Every gate is a refusal, and each refusal is asserted here rather than left to review, because
// publishing is the step that can put a stale or invalid feed in front of the dashboard.
//
// Nothing in this file touches the real remote, the real checkout or the real repository's history: git is a
// recorded stand-in, the clock is injected, and the artifacts are written into a temp directory.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const publisher = require("../scripts/publish-live-trading-feed.js");
const runner = require("../scripts/run-live-trading-feed.js");
const feedValidator = require("../scripts/validate_live_trading_feed.js");

const root = path.resolve(__dirname, "..");
const committedFeedPath = path.join(root, "data", "live-trading.json");
const FEED_FILE = "data/live-trading.json";

// The fixture is the committed artifact with its own clock moved, so the gates are exercised against a real
// read-only snapshot rather than a hand-built object that could pass here and fail on the page.
function committedFeed() {
  return JSON.parse(fs.readFileSync(committedFeedPath, "utf8"));
}

function feedGeneratedAt(ms, { staleAfter = 900 } = {}) {
  const feed = committedFeed();
  feed.generated_at_utc = new Date(ms).toISOString();
  if (Number.isFinite(staleAfter)) feed.stale_after_seconds = staleAfter;
  else delete feed.stale_after_seconds;
  return feed;
}

function tempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-publish-"));
  const checkout = path.join(dir, "publish-checkout");
  fs.mkdirSync(path.join(checkout, "data"), { recursive: true });
  return {
    dir,
    checkout,
    state: path.join(dir, "publish-state.json"),
    feed: path.join(dir, "feed.json")
  };
}

function optionsFor(workspace, overrides = {}) {
  return {
    feed: workspace.feed,
    checkout: workspace.checkout,
    remote: "origin",
    branch: "main",
    minIntervalSeconds: publisher.DEFAULT_MIN_INTERVAL_SECONDS,
    state: workspace.state,
    force: false,
    dryRun: false,
    json: false,
    help: false,
    ...overrides
  };
}

// A stand-in for git: it records every command and answers the handful the publisher issues. `pushResults` is a
// queue of exit codes, so a rejected-then-accepted push can be asserted without a second remote.
function fakeGit({
  remoteFeed = null,
  pushResults = [0],
  pushStderr = "! [rejected]        HEAD -> main (fetch first)\nerror: failed to push some refs",
  commit = { status: 0, stdout: "[main abc123] publish", stderr: "" },
  worktree = { status: 0, stdout: "", stderr: "" },
  fetch = { status: 0, stdout: "", stderr: "" },
  commonDir = { status: 0, stdout: "D:/canonical/.git", stderr: "" }
} = {}) {
  const calls = [];
  let pushIndex = 0;
  const exec = (command, args, options) => {
    calls.push({ command, args, options });
    if (command !== "git") return { status: 127, stdout: "", stderr: `${command} is not git` };
    const joined = args.join(" ");
    if (joined.includes("--git-common-dir")) return commonDir;
    if (args[0] === "worktree") return worktree;
    if (args.includes("fetch")) return fetch;
    if (args.includes("show")) {
      return remoteFeed === null
        ? { status: 128, stdout: "", stderr: "fatal: path 'data/live-trading.json' does not exist in 'origin/main'" }
        : { status: 0, stdout: JSON.stringify(remoteFeed, null, 2), stderr: "" };
    }
    if (args.includes("checkout") && args.includes("--detach")) return { status: 0, stdout: "", stderr: "" };
    if (args.includes("add")) return { status: 0, stdout: "", stderr: "" };
    if (args.includes("commit")) return commit;
    if (args.includes("rev-parse")) return { status: 0, stdout: "abc123def456", stderr: "" };
    if (args.includes("push")) {
      const status = pushResults[Math.min(pushIndex, pushResults.length - 1)];
      pushIndex += 1;
      return status === 0
        ? { status: 0, stdout: "", stderr: "To https://example.invalid/repo.git\n   8a976e3..abc123d  HEAD -> main" }
        : { status: 1, stdout: "", stderr: pushStderr };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  return { exec, calls, pushes: () => pushIndex };
}

function gitCalls(calls) {
  return calls.map((call) => call.args.join(" "));
}

// main() reports through stdout and stderr; the assertions below care about the exit code, so the streams are
// borrowed and put back rather than left noisy in the test log.
function captureStdio(fn) {
  const outWrite = process.stdout.write;
  const errWrite = process.stderr.write;
  let out = "";
  let err = "";
  process.stdout.write = (chunk) => {
    out += String(chunk);
    return true;
  };
  process.stderr.write = (chunk) => {
    err += String(chunk);
    return true;
  };
  try {
    return { code: fn(), out, err };
  } finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
}

const MINUTE = 60000;

test("the publish cadence defaults to six Pages builds an hour, inside the documented soft limit of ten", () => {
  const options = publisher.parseArgs([]);
  assert.equal(options.minIntervalSeconds, 600);
  assert.equal(publisher.DEFAULT_MIN_INTERVAL_SECONDS, 600);
  assert.equal(publisher.PAGES_BUILDS_PER_HOUR, 10);
  assert.equal(publisher.PAGES_BUILDS_PER_HOUR_FLOOR_SECONDS, 360);
  // The floor is the limit exactly: ten builds an hour is one every 360 seconds, so the default deliberately
  // sits above it rather than on it.
  assert.ok(publisher.DEFAULT_MIN_INTERVAL_SECONDS > publisher.PAGES_BUILDS_PER_HOUR_FLOOR_SECONDS);
  assert.ok(3600 / publisher.DEFAULT_MIN_INTERVAL_SECONDS <= publisher.PAGES_BUILDS_PER_HOUR);
  assert.equal(options.remote, "origin");
  assert.equal(options.branch, "main");
  assert.equal(options.feed, "data/live-trading.json");
  assert.equal(options.state, "tmp/live-trading-publish-state.json");
  assert.equal(options.checkout, null);
  assert.equal(options.force, false);
  assert.equal(options.dryRun, false);
});

test("the command line refuses what it cannot act on", () => {
  assert.throws(() => publisher.parseArgs(["--branch"]), publisher.UsageError);
  assert.throws(() => publisher.parseArgs(["--min-interval-seconds", "0"]), publisher.UsageError);
  assert.throws(() => publisher.parseArgs(["--push-anyway"]), publisher.UsageError);
  const forced = publisher.parseArgs(["--dry-run", "--force", "--min-interval-seconds", "120"]);
  assert.equal(forced.dryRun, true);
  assert.equal(forced.force, true);
  assert.equal(forced.minIntervalSeconds, 120);
});

test("the freshness gate measures the artifact against the window it declares", () => {
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const fresh = publisher.feedFreshnessOk(feedGeneratedAt(nowMs - 60 * 1000), nowMs);
  assert.equal(fresh.ok, true);
  assert.equal(fresh.ageSeconds, 60);
  assert.equal(fresh.reason, null);

  const stale = publisher.feedFreshnessOk(feedGeneratedAt(nowMs - 20 * MINUTE), nowMs);
  assert.equal(stale.ok, false);
  assert.match(stale.reason, /1200s old against its own 900s window/);

  const undated = publisher.feedFreshnessOk({ stale_after_seconds: 900 }, nowMs);
  assert.equal(undated.ok, false);
  assert.match(undated.reason, /no readable generated_at_utc or stale_after_seconds/);
  assert.equal(publisher.feedFreshnessOk({ generated_at_utc: new Date(nowMs).toISOString() }, nowMs).ok, false);
});

test("the publish decision never walks the published page backwards", () => {
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const newest = nowMs;
  const newer = nowMs - 5 * MINUTE;
  const older = nowMs - 10 * MINUTE;

  assert.deepEqual(
    publisher.decidePublish({
      localGeneratedAtMs: newest,
      remoteGeneratedAtMs: newer,
      lastPublishedMs: NaN,
      nowMs,
      minIntervalSeconds: 600
    }),
    { action: "publish", reason: null }
  );

  const equal = publisher.decidePublish({
    localGeneratedAtMs: newer,
    remoteGeneratedAtMs: newer,
    lastPublishedMs: NaN,
    nowMs,
    minIntervalSeconds: 600
  });
  assert.equal(equal.action, "unchanged");
  assert.match(equal.reason, /already carries this feed/);

  const behind = publisher.decidePublish({
    localGeneratedAtMs: older,
    remoteGeneratedAtMs: newer,
    lastPublishedMs: NaN,
    nowMs,
    minIntervalSeconds: 600
  });
  assert.equal(behind.action, "unchanged");
  assert.match(behind.reason, /carries a newer feed/);

  // No published copy at all - a first publish, or a reading that could not be read - is not a reason to wait.
  assert.equal(
    publisher.decidePublish({
      localGeneratedAtMs: newest,
      remoteGeneratedAtMs: null,
      lastPublishedMs: NaN,
      nowMs,
      minIntervalSeconds: 600
    }).action,
    "publish"
  );
  assert.equal(
    publisher.decidePublish({
      localGeneratedAtMs: Number.NaN,
      remoteGeneratedAtMs: null,
      lastPublishedMs: NaN,
      nowMs,
      minIntervalSeconds: 600
    }).action,
    "refuse"
  );
});

test("the interval gate holds a run back inside the cadence, and --force overrides it", () => {
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const base = {
    localGeneratedAtMs: nowMs,
    remoteGeneratedAtMs: nowMs - 5 * MINUTE,
    nowMs,
    minIntervalSeconds: 600
  };

  const tooSoon = publisher.decidePublish({ ...base, lastPublishedMs: nowMs - 5 * MINUTE });
  assert.equal(tooSoon.action, "too_soon");
  assert.match(tooSoon.reason, /inside the 600s cadence/);

  assert.equal(publisher.decidePublish({ ...base, lastPublishedMs: nowMs - 11 * MINUTE }).action, "publish");
  assert.equal(
    publisher.decidePublish({ ...base, lastPublishedMs: nowMs - 5 * MINUTE, force: true }).action,
    "publish"
  );
});

test("the published commit records the snapshot, why no cache-buster moved, and the read-only facts", () => {
  const feed = feedGeneratedAt(Date.UTC(2026, 9, 4, 13, 5, 20));
  const message = publisher.buildCommitMessage(feed, { publishedAtUtc: "2026-10-04T13:06:27.786Z" });
  const lines = message.split("\n");
  assert.match(lines[0], /^live-trading: publish the M5\/H1\/H4 snapshot for 2026-10-04T13:05:20\./);
  assert.match(lines[0], /data file only$/);
  const body = lines.slice(1).join(" ");
  assert.match(body, /fetchLocalJson with cache no-store/);
  assert.match(body, /loadDashboard runs every 60 seconds/);
  assert.match(body, /read_only true/);
  assert.match(body, /order_functions_called false/);
  assert.match(body, /positions_open/);
  assert.match(body, /account masked as/);
});

test("the publish checkout is looked for beside the canonical repository, not inside the lane worktree", () => {
  const ok = fakeGit({ commonDir: { status: 0, stdout: "D:/canonical/.git", stderr: "" } });
  assert.equal(
    publisher.resolveDefaultCheckout(ok.exec),
    path.join("D:", "canonical", ...publisher.DEFAULT_CHECKOUT_RELATIVE.split("/"))
  );

  const broken = fakeGit({ commonDir: { status: 128, stdout: "", stderr: "fatal: not a git repository" } });
  assert.equal(
    publisher.resolveDefaultCheckout(broken.exec),
    path.join(publisher.REPO_ROOT, ...publisher.DEFAULT_CHECKOUT_RELATIVE.split("/"))
  );
});

test("an artifact the dashboard's own guard rejects is never published, and git is never asked", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const git = fakeGit();

  const result = publisher.publishFeed(optionsFor(workspace), {
    exec: git.exec,
    now: () => nowMs,
    validate: () => ["instrument BTCUSD is missing", "m5 block is not the current bar"]
  });

  assert.equal(result.action, "refuse");
  assert.equal(result.published, false);
  assert.equal(result.validate_error_count, 2);
  assert.equal(result.validate_errors.length, 2);
  assert.match(result.reason, /fails the dashboard's own validator/);
  assert.deepEqual(gitCalls(git.calls), []);
  assert.equal(fs.existsSync(workspace.state), false);
});

test("the publisher asks the dashboard's guard itself, so the two can never disagree", () => {
  const workspace = tempWorkspace();
  const feed = committedFeed();
  fs.writeFileSync(workspace.feed, JSON.stringify(feed, null, 2), "utf8");
  const git = fakeGit({ remoteFeed: feed });

  const result = publisher.publishFeed(optionsFor(workspace, { dryRun: true }), {
    exec: git.exec,
    now: () => Date.parse(feed.generated_at_utc) + 60000
  });

  assert.equal(result.validate_error_count, feedValidator.validateLiveTradingFeed(feed).length);
  assert.equal(result.feed_generated_at_utc, feed.generated_at_utc);
});

test("a stale artifact is refused before the checkout is touched", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - 30 * MINUTE), null, 2), "utf8");
  const git = fakeGit();

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "refuse");
  assert.equal(result.feed_age_seconds, 1800);
  assert.equal(result.stale_after_seconds, 900);
  assert.match(result.reason, /1800s old against its own 900s window/);
  assert.deepEqual(gitCalls(git.calls), []);
});

test("a dry run passes every gate, then writes nothing and pushes nothing", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const local = feedGeneratedAt(nowMs - MINUTE);
  const published = feedGeneratedAt(nowMs - 6 * MINUTE);
  fs.writeFileSync(workspace.feed, JSON.stringify(local, null, 2), "utf8");
  fs.writeFileSync(path.join(workspace.checkout, ...FEED_FILE.split("/")), JSON.stringify(published), "utf8");
  const git = fakeGit({ remoteFeed: published });

  const result = publisher.publishFeed(optionsFor(workspace, { dryRun: true }), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "would_publish");
  assert.equal(result.published, false);
  assert.equal(result.decision, "publish");
  assert.equal(result.dry_run, true);
  assert.equal(result.published_generated_at_utc, published.generated_at_utc);
  assert.equal(result.feed_age_seconds, 60);
  assert.match(result.reason, /--dry-run was asked for/);
  const calls = gitCalls(git.calls);
  assert.ok(calls.some((call) => call.includes(`show origin/main:${FEED_FILE}`)), "the published copy is read");
  assert.equal(calls.filter((call) => call.includes("push")).length, 0);
  assert.equal(calls.filter((call) => call.includes("commit")).length, 0);
  assert.equal(calls.filter((call) => call.includes(`add ${FEED_FILE}`)).length, 0);
  assert.equal(fs.existsSync(workspace.state), false);
  // The working file in the checkout is left exactly as it was: a dry run does not even stage bytes.
  assert.equal(JSON.parse(fs.readFileSync(path.join(workspace.checkout, ...FEED_FILE.split("/")), "utf8")).generated_at_utc, published.generated_at_utc);
});

test("the feed the site already serves is not republished", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const same = feedGeneratedAt(nowMs - MINUTE);
  fs.writeFileSync(workspace.feed, JSON.stringify(same, null, 2), "utf8");
  const git = fakeGit({ remoteFeed: same });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "unchanged");
  assert.equal(result.published, false);
  assert.match(result.reason, /already carries this feed/);
  const calls = gitCalls(git.calls);
  assert.equal(calls.filter((call) => call.includes("push")).length, 0);
  assert.equal(fs.existsSync(workspace.state), false);
});

test("a feed behind the published copy is refused rather than walked backwards", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const local = feedGeneratedAt(nowMs - 4 * MINUTE);
  const published = feedGeneratedAt(nowMs - MINUTE);
  fs.writeFileSync(workspace.feed, JSON.stringify(local, null, 2), "utf8");
  const git = fakeGit({ remoteFeed: published });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "unchanged");
  assert.match(result.reason, /carries a newer feed/);
  assert.equal(gitCalls(git.calls).filter((call) => call.includes("push")).length, 0);
});

test("the interval gate holds the next publish back until the cadence has passed", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  fs.writeFileSync(
    workspace.state,
    JSON.stringify({ last_published_at_utc: new Date(nowMs - 5 * MINUTE).toISOString(), publish_count: 1 }),
    "utf8"
  );
  const git = fakeGit({ remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE) });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "too_soon");
  assert.equal(result.published, false);
  assert.match(result.reason, /inside the 600s cadence/);
  // The hold is answered from the state file alone, so a held-back run does no git work and opens no checkout.
  assert.deepEqual(gitCalls(git.calls), []);
  assert.equal(result.decision, "too_soon");
  assert.equal(
    publisher.intervalGate({ lastPublishedMs: nowMs - 5 * MINUTE, nowMs, minIntervalSeconds: 600 }).action,
    "too_soon"
  );
  assert.equal(
    publisher.intervalGate({ lastPublishedMs: nowMs - 5 * MINUTE, nowMs, minIntervalSeconds: 600, force: true }).action,
    "ok"
  );
  assert.equal(publisher.intervalGate({ lastPublishedMs: NaN, nowMs, minIntervalSeconds: 600 }).action, "ok");
  // The record is left as the last real publish wrote it, so the cadence is not restarted by a skipped run.
  assert.equal(JSON.parse(fs.readFileSync(workspace.state, "utf8")).publish_count, 1);
});

test("a missing artifact is a refusal, not a crash", () => {
  const workspace = tempWorkspace();
  const git = fakeGit();
  const result = publisher.publishFeed(optionsFor(workspace), {
    exec: git.exec,
    now: () => Date.UTC(2026, 9, 4, 13, 6, 0)
  });
  assert.equal(result.action, "refuse");
  assert.match(result.reason, /no artifact at/);
  assert.deepEqual(gitCalls(git.calls), []);
});

test("a feed that passes every gate is published as one data-file commit, and the publish is recorded", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const local = feedGeneratedAt(nowMs - MINUTE);
  const published = feedGeneratedAt(nowMs - 6 * MINUTE);
  fs.writeFileSync(workspace.feed, JSON.stringify(local, null, 2), "utf8");
  const git = fakeGit({ remoteFeed: published });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "published");
  assert.equal(result.published, true);
  assert.equal(result.attempts, 1);
  assert.equal(result.commit, "abc123def456");
  assert.equal(result.reason, null);
  const calls = gitCalls(git.calls);
  // The checkout is created at the served branch, then one file is added, committed and pushed onto it.
  assert.equal(calls.filter((call) => call.startsWith("worktree add --detach")).length, 1);
  assert.ok(calls.includes(`-C ${workspace.checkout} checkout --detach --force origin/main`));
  assert.ok(calls.includes(`-C ${workspace.checkout} add ${FEED_FILE}`));
  assert.ok(calls.includes(`-C ${workspace.checkout} push origin HEAD:main`));
  const commitCall = git.calls.find((call) => call.args.includes("commit"));
  assert.match(commitCall.args.join(" "), /publish the M5\/H1\/H4 snapshot/);
  // The bytes that would be committed are the artifact's, not a re-render of them.
  const staged = JSON.parse(fs.readFileSync(path.join(workspace.checkout, ...FEED_FILE.split("/")), "utf8"));
  assert.equal(staged.generated_at_utc, local.generated_at_utc);
  const state = JSON.parse(fs.readFileSync(workspace.state, "utf8"));
  assert.equal(state.publish_count, 1);
  assert.equal(state.last_published_generated_at_utc, local.generated_at_utc);
  assert.equal(state.last_published_commit, "abc123def456");
  assert.equal(state.last_published_at_utc, new Date(nowMs).toISOString());
  assert.equal(state.pages_builds_per_hour_limit, 10);
});

test("a push rejected because the branch moved is retried once, after resetting the checkout", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const git = fakeGit({ remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE), pushResults: [1, 0] });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "published");
  assert.equal(result.published, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.retried_after_rejected_push, true);
  const calls = gitCalls(git.calls);
  assert.equal(calls.filter((call) => call.includes("push origin HEAD:main")).length, 2);
  assert.equal(calls.filter((call) => call.startsWith("worktree add --detach")).length, 2);
  assert.equal(JSON.parse(fs.readFileSync(workspace.state, "utf8")).publish_count, 1);
});

test("two rejected pushes are a refusal, not an endless loop", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const git = fakeGit({ remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE), pushResults: [1, 1] });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "refuse");
  assert.equal(result.published, false);
  assert.equal(result.attempts, 2);
  assert.match(result.reason, /rejected twice/);
  assert.equal(fs.existsSync(workspace.state), false);
});

test("a push that fails for any other reason is reported as it came back", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const git = fakeGit({
    remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE),
    pushResults: [1],
    pushStderr: "fatal: Authentication failed for 'https://example.invalid/repo.git/'"
  });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "refuse");
  assert.equal(result.published, false);
  assert.equal(result.attempts, 1);
  assert.match(result.reason, /git push failed: fatal: Authentication failed/);
  assert.equal(gitCalls(git.calls).filter((call) => call.includes("push")).length, 1);
  assert.equal(fs.existsSync(workspace.state), false);
});

test("a checkout that cannot be prepared is a refusal that names the step", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const git = fakeGit({
    remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE),
    worktree: { status: 128, stdout: "", stderr: "fatal: '<path>' is already a worktree" }
  });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "refuse");
  assert.equal(result.published, false);
  assert.equal(result.checkout_step, `worktree add --detach ${workspace.checkout} origin/main`);
  assert.match(result.reason, /the publish checkout is not usable/);
  assert.equal(fs.existsSync(workspace.state), false);
});

test("the exit code separates a refusal from a feed that is simply already current", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const args = ["--feed", workspace.feed, "--checkout", workspace.checkout, "--state", workspace.state];

  // No artifact yet: a run that cannot publish is the one a scheduler has to be able to see as a failure.
  const missing = captureStdio(() => publisher.main(args, { exec: fakeGit().exec, now: () => nowMs }));
  assert.equal(missing.code, 1);
  assert.match(missing.out, /"action":"refuse"/);

  // The site already carries this snapshot, so there is nothing to do and nothing wrong.
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const current = captureStdio(() =>
    publisher.main(args, { exec: fakeGit({ remoteFeed: feedGeneratedAt(nowMs - MINUTE) }).exec, now: () => nowMs })
  );
  assert.equal(current.code, 0);
  assert.match(current.out, /"action":"unchanged"/);

  const bad = captureStdio(() => publisher.main(["--nonsense"]));
  assert.equal(bad.code, 2);
  assert.match(bad.err, /Unknown argument: --nonsense/);

  const help = captureStdio(() => publisher.main(["--help"]));
  assert.equal(help.code, 0);
  assert.match(help.out, /--min-interval-seconds/);
});

// --- the shared checkout and the lock that guards it --------------------------------------------------------
// The publish checkout is shared with whatever real publish is running, so a dry run builds one of its own and
// deletes it, and a real publish holds a lock for the length of the run. Both are asserted here, because both
// are the reason a test can no longer reset a checkout a publish is mid-way through.

test("a dry run with no checkout of its own builds one beside the live checkout and removes it", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const git = fakeGit({ remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE) });
  const options = optionsFor(workspace, { dryRun: true });
  delete options.checkout;

  const result = publisher.publishFeed(options, { exec: git.exec, now: () => nowMs });

  const live = path.join("D:", "canonical", ...publisher.DEFAULT_CHECKOUT_RELATIVE.split("/"));
  assert.equal(result.checkout_is_isolated, true);
  assert.notEqual(result.checkout, live);
  assert.equal(path.dirname(result.checkout), path.dirname(live));
  assert.ok(path.basename(result.checkout).startsWith(`${path.basename(live)}-run-`), "the run's own checkout is named for it");
  assert.equal(result.action, "would_publish");
  assert.equal(result.checkout_cleanup.removed, true);
  const calls = gitCalls(git.calls);
  assert.equal(calls.filter((call) => call.includes(`-C ${live} `)).length, 0, "the live checkout is never used");
  assert.equal(calls.filter((call) => call.includes("worktree add")).length, 1);
  assert.equal(calls.filter((call) => call.includes("worktree remove")).length, 1);
});

test("a lock held by another publish is a refusal, and that lock is left where it is", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.now();
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const lockPath = publisher.resolveLockPath(workspace.state);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({ pid: 9999, started_at_utc: new Date(nowMs - 5000).toISOString(), checkout: "elsewhere" })}\n`);
  const git = fakeGit({ remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE) });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "locked");
  assert.equal(result.published, false);
  assert.equal(result.lock.held, false);
  assert.match(result.reason, /pid 9999/);
  assert.equal(gitCalls(git.calls).filter((call) => call.includes("push")).length, 0);
  assert.equal(gitCalls(git.calls).filter((call) => call.includes("commit")).length, 0);
  assert.equal(fs.existsSync(lockPath), true, "another run's lock is never deleted by a refusal");
  assert.equal(fs.existsSync(workspace.state), false, "a refusal records no publish");
});

test("a lock older than its TTL is broken, recorded, and the publish proceeds", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.now();
  fs.writeFileSync(workspace.feed, JSON.stringify(feedGeneratedAt(nowMs - MINUTE), null, 2), "utf8");
  const lockPath = publisher.resolveLockPath(workspace.state);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({ pid: 4242, started_at_utc: "2026-10-04T13:00:00.000Z" })}\n`);
  const old = new Date(nowMs - 20 * MINUTE);
  fs.utimesSync(lockPath, old, old);
  const git = fakeGit({ remoteFeed: feedGeneratedAt(nowMs - 6 * MINUTE) });

  const result = publisher.publishFeed(optionsFor(workspace), { exec: git.exec, now: () => nowMs });

  assert.equal(result.action, "published");
  assert.equal(result.lock.stale_broken, true);
  assert.equal(result.lock.stale_age_seconds, 1200);
  assert.equal(result.lock_released, true);
  assert.equal(fs.existsSync(lockPath), false, "the run's own lock is released when it ends");
});

test("the lock is one file per publish, taken once, and released only by the run that holds it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-lock-"));
  const statePath = path.join(dir, "state", "publish-state.json");
  const lockPath = publisher.resolveLockPath(statePath);
  assert.equal(lockPath, path.join(dir, "state", "live-trading-publish.lock"));

  const mine = publisher.acquirePublishLock({ lockPath, nowMs: Date.now(), checkout: "checkout" });
  assert.equal(mine.ok, true);
  const second = publisher.acquirePublishLock({ lockPath, nowMs: Date.now(), checkout: "checkout" });
  assert.equal(second.ok, false);
  assert.match(second.reason, /holds the lock/);

  // A lock file that has since been replaced belongs to someone else, and this run no longer owns it.
  fs.writeFileSync(lockPath, `${JSON.stringify({ pid: 1, started_at_utc: "2026-01-01T00:00:00.000Z" })}\n`);
  assert.equal(publisher.releasePublishLock({ lockPath, holder: mine.holder }), false);
  assert.equal(fs.existsSync(lockPath), true);
});


// A stand-in for the producer process, so the runner's own path - lock, validator, publish step - is exercised
// without a terminal. Only the process boundary is replaced; everything after it is the real code.
function fakeProducer(feed) {
  return (command, args) => {
    const outIndex = args.indexOf("--out");
    if (outIndex !== -1) fs.writeFileSync(args[outIndex + 1], JSON.stringify(feed, null, 2), "utf8");
    return { status: 0, stdout: "", stderr: "" };
  };
}

function runnerOptions(workspace, extra = []) {
  return runner.parseArgs([
    "--once",
    "--out",
    workspace.feed,
    "--log",
    path.join(workspace.dir, "run.log"),
    "--lock",
    path.join(workspace.dir, "run.lock"),
    ...extra
  ]);
}

test("a run only hands the artifact to the publisher when it was asked to", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const options = runnerOptions(workspace);

  assert.equal(options.publish, false);
  assert.equal(options.publishMinIntervalSeconds, 600);
  assert.equal(options.publishDryRun, false);
  assert.match(runner.USAGE, /--publish-min-interval-seconds/);

  const { code, record } = runner.runOnce(options, {
    spawn: fakeProducer(committedFeed()),
    now: () => nowMs,
    publish: () => {
      throw new Error("the publisher must not be reached without --publish");
    }
  });

  assert.equal(code, 0);
  assert.equal(record.status, "ok");
  assert.equal(Object.prototype.hasOwnProperty.call(record, "publish"), false);
});

test("a run asked to publish hands over the artifact it just validated and records the outcome", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const options = runnerOptions(workspace, ["--publish", "--publish-min-interval-seconds", "900"]);
  const asked = [];

  assert.equal(options.publish, true);
  assert.equal(options.publishMinIntervalSeconds, 900);

  const { code, record } = runner.runOnce(options, {
    spawn: fakeProducer(committedFeed()),
    now: () => nowMs,
    publish: (publishOptions) => {
      asked.push(publishOptions);
      return {
        action: "published",
        published: true,
        decision: "publish",
        commit: "0a64ec5",
        attempts: 1,
        min_interval_seconds: publishOptions.minIntervalSeconds,
        reason: null
      };
    }
  });

  assert.equal(code, 0);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].feed, path.relative(root, workspace.feed).replace(/\\/g, "/"));
  assert.equal(asked[0].remote, "origin");
  assert.equal(asked[0].branch, "main");
  assert.equal(asked[0].minIntervalSeconds, 900);
  assert.equal(asked[0].dryRun, false);
  assert.deepEqual(record.publish, {
    action: "published",
    published: true,
    decision: "publish",
    reason: null,
    commit: "0a64ec5",
    attempts: 1,
    min_interval_seconds: 900
  });
});

test("a run whose publish was refused fails, while its artifact stays valid and logged", () => {
  const workspace = tempWorkspace();
  const nowMs = Date.UTC(2026, 9, 4, 13, 6, 0);
  const options = runnerOptions(workspace, ["--publish", "--publish-dry-run"]);

  assert.equal(options.publish, true);
  assert.equal(options.publishDryRun, true);

  const { code, record } = runner.runOnce(options, {
    spawn: fakeProducer(committedFeed()),
    now: () => nowMs,
    publish: () => ({
      action: "refuse",
      published: false,
      decision: "publish",
      reason: "git push failed: fatal: Authentication failed for 'https://example.invalid/repo.git/'",
      commit: "abc123def456",
      attempts: 1,
      min_interval_seconds: 600
    })
  });

  assert.equal(code, 1, "a publish that did not land is a failed run");
  assert.equal(record.status, "ok", "the artifact itself is still a valid read");
  assert.equal(record.publish.published, false);
  assert.match(record.publish.reason, /Authentication failed/);
  // The run's own evidence is still written: the dashboard can be behind, but the log is not.
  const logLines = fs.readFileSync(path.join(workspace.dir, "run.log"), "utf8").trim().split("\n");
  assert.equal(logLines.length, 1);
  assert.equal(JSON.parse(logLines[0]).publish.action, "refuse");
});
