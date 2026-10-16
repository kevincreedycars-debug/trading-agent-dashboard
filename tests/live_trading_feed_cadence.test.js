// Contract tests for the Live Trading feed cadence: the runner that keeps the M5 snapshot current, and the
// scheduled task that calls it. The runner is the one process that decides whether the dashboard's live section
// shows a fresh read or a stale one, so its refusals are asserted here rather than left to review.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const runner = require("../scripts/run-live-trading-feed.js");
// The schema the artifact must carry is the validator's own constant, so a bump is one edit rather than a
// literal in two files that can drift apart.
const { SCHEMA_VERSION: FEED_SCHEMA_VERSION } = require("../scripts/validate_live_trading_feed.js");

const root = path.resolve(__dirname, "..");
const runnerPath = path.join(root, "scripts", "run-live-trading-feed.js");
const registerPath = path.join(root, "scripts", "register-live-trading-feed-task.ps1");
const feedPath = path.join(root, "data", "live-trading.json");
const runnerSource = fs.readFileSync(runnerPath, "utf8");
const registerSource = fs.readFileSync(registerPath, "utf8");

// The committed artifact is the only complete, validator-passing snapshot in the repository, so the runs below
// are driven with it rather than with a hand-built fixture that could pass here and fail the page.
function committedFeed() {
  return JSON.parse(fs.readFileSync(feedPath, "utf8"));
}

function tempWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "live-trading-cadence-"));
  return {
    dir,
    out: path.join(dir, "feed.json"),
    log: path.join(dir, "feed.log"),
    lock: path.join(dir, "feed.lock")
  };
}

// A stand-in for the producer process: it writes whatever this run is meant to have produced, and reports the
// exit code the real one would have. Nothing else in the runner is stubbed, so the validation path is real.
function fakeProducer({ feed, exit = 0, stderr = "", error = null } = {}) {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    if (exit === 0 && feed !== undefined) {
      const outIndex = args.indexOf("--out");
      const outPath = outIndex === -1 ? null : args[outIndex + 1];
      if (outPath) fs.writeFileSync(outPath, JSON.stringify(feed, null, 2), "utf8");
    }
    return { status: error ? null : exit, stdout: "", stderr, error };
  };
  spawn.calls = calls;
  return spawn;
}

function optionsFor(workspace, extra = {}) {
  return { ...runner.parseArgs([]), out: workspace.out, log: workspace.log, lock: workspace.lock, ...extra };
}

test("the runner's defaults are one M5 run, the artifact the page reads, and an ignored log", () => {
  const options = runner.parseArgs([]);
  assert.equal(options.mode, "once");
  assert.equal(options.intervalSeconds, 300);
  assert.equal(runner.BAR_SECONDS, 300);
  assert.equal(runner.DEFAULT_INTERVAL_SECONDS, 300);
  assert.equal(options.settleSeconds, 20);
  assert.equal(options.out, "data/live-trading.json");
  assert.equal(runner.DEFAULT_OUT, "data/live-trading.json");
  assert.equal(options.log, "tmp/live-trading-feed.log");
  assert.equal(options.lock, "tmp/live-trading-feed.lock");
  assert.equal(options.align, false);
  assert.equal(options.quiet, false);
  assert.equal(options.python, null);
  assert.equal(options.terminal, null);
});

test("the runner writes the same path the dashboard reads", () => {
  const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
  assert.match(script, /\.\/data\/live-trading\.json/);
  assert.equal(runner.DEFAULT_OUT, "data/live-trading.json");
});

test("--once and --loop are alternatives, and an unknown flag is refused", () => {
  assert.throws(() => runner.parseArgs(["--once", "--loop"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--loop", "--once"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--tick"]), /Unknown argument: --tick/);
  assert.equal(runner.parseArgs(["--loop"]).mode, "loop");
});

test("intervals are validated rather than guessed", () => {
  assert.throws(() => runner.parseArgs(["--interval-seconds", "0"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--interval-seconds", "abc"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--settle-seconds", "-1"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--settle-seconds", "300", "--interval-seconds", "300"]), /chases itself/);
  assert.throws(() => runner.parseArgs(["--candles", "0"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--candles", "1.5"]), runner.UsageError);
  assert.throws(() => runner.parseArgs(["--out"]), /needs a value/);
  const options = runner.parseArgs(["--candles", "12", "--quiet", "--align"]);
  assert.equal(options.candles, 12);
  assert.equal(options.quiet, true);
  assert.equal(options.align, true);
});

test("--python and --terminal are passed through to the producer run", () => {
  const options = runner.parseArgs(["--python", "C:\\Python313\\python.exe", "--terminal", "C:\\Terminal"]);
  assert.equal(options.python, "C:\\Python313\\python.exe");
  assert.equal(options.terminal, "C:\\Terminal");
});


test("the cadence aligns to the next bar close plus the settle window", () => {
  const boundary = Date.parse("2026-10-04T12:00:00Z");
  // A moment after a boundary: the bar that just closed settles seconds away, and that is the run to make.
  assert.equal(runner.nextRunAt(boundary + 1000, 300, 20), boundary + 20000);
  // Past this bar's settle instant: the following close, never a second run on the bar just read.
  assert.equal(runner.nextRunAt(boundary + 21000, 300, 20), boundary + 300000 + 20000);
  // Exactly on the settle instant: the run that just happened must not repeat itself.
  assert.equal(runner.nextRunAt(boundary + 20000, 300, 20), boundary + 300000 + 20000);
  // Exactly on the boundary: settle first, then run.
  assert.equal(runner.nextRunAt(boundary, 300, 20), boundary + 20000);
  // The target is always in the future, whatever the floor arithmetic does.
  for (const offset of [0, 1, 19999, 20000, 20001, 299999, 300000, 300001]) {
    assert.ok(runner.nextRunAt(boundary + offset, 300, 20) > boundary + offset, `offset ${offset}`);
  }
  assert.equal(runner.DEFAULT_SETTLE_SECONDS, 20);
});

test("a summary reports the snapshot's own age and each instrument's M5 state", () => {
  const feed = committedFeed();
  assert.equal(feed.schema_version, FEED_SCHEMA_VERSION);
  const generatedMs = Date.parse(feed.generated_at_utc);
  const summary = runner.summariseFeed(feed, generatedMs + 42000);
  assert.equal(summary.schema_version, FEED_SCHEMA_VERSION);
  assert.equal(summary.generated_at_utc, feed.generated_at_utc);
  assert.equal(summary.feed_age_seconds, 42);
  assert.equal(summary.stale_after_seconds, feed.stale_after_seconds);
  assert.equal(summary.snapshot_stale, 42 > feed.stale_after_seconds);
  // The read-back counts ride along on every log line: a run that shows a position opening or a trade
  // closing has to say so in its own line, not only in the artifact.
  assert.equal(summary.positions_open, feed.account.positions_open);
  assert.equal(summary.closed_trades, feed.closed_trades.length);
  assert.equal(summary.closed_trade_window_days, feed.history.window_days);
  assert.equal(summary.instruments.length, feed.instruments.length);
  assert.equal(summary.m5_current + summary.m5_stale, feed.instruments.length);
  assert.equal(typeof summary.terminal, "string");
  assert.equal(typeof summary.account, "string");
  const first = summary.instruments[0];
  assert.equal(first.symbol, feed.instruments[0].symbol);
  assert.equal(typeof first.m5_stale, "boolean");
  // Liveness is reported per instrument as a tick age against the snapshot's own clock, and it is the one fact
  // the M5 flags cannot give: a shut market's closing bar is still "the newest bar" on that instrument.
  assert.equal(summary.live_ticks + summary.quiet_ticks, summary.instruments.length);
  for (const instrument of summary.instruments) {
    assert.ok(Number.isInteger(instrument.tick_age_seconds), `${instrument.symbol} tick age`);
    assert.equal(typeof instrument.live_tick, "boolean");
    assert.equal(instrument.live_tick, instrument.tick_age_seconds <= runner.BAR_SECONDS);
  }
});

test("a shut market and a ticking one are told apart in the same snapshot", () => {
  const snapshotClock = "2026-10-04T11:35:00+00:00";
  const summary = runner.summariseFeed({
    time_server: snapshotClock,
    instruments: [
      { symbol: "BTCUSD", quote: { time_server: "2026-10-04T11:34:40+00:00", bid: 1, ask: 2 }, m5: { stale: false } },
      { symbol: "EURUSD", quote: { time_server: "2026-10-02T23:54:59+00:00", bid: 1, ask: 2 }, m5: { stale: false } },
      { symbol: "US100.cash", quote: {}, m5: { stale: true } }
    ]
  }, Date.now());
  assert.equal(summary.instruments[0].tick_age_seconds, 20);
  assert.equal(summary.instruments[0].live_tick, true);
  assert.equal(summary.instruments[1].tick_age_seconds, 128401);
  assert.equal(summary.instruments[1].live_tick, false);
  assert.equal(summary.instruments[1].m5_stale, false, "the frozen instrument's own M5 flag says nothing about liveness");
  assert.equal(summary.instruments[2].tick_age_seconds, null);
  assert.equal(summary.instruments[2].live_tick, null);
  assert.equal(summary.live_ticks, 1);
  assert.equal(summary.quiet_ticks, 1);
});

test("a summary says null rather than guessing when the snapshot has no clock", () => {
  const feed = {
    instruments: [
      { symbol: "AAA", m5: { candle_count: 2, bar_age_seconds: 30, stale: false }, quote: { bid: 1, ask: 1.5 } },
      { symbol: "BBB", m5: { candle_count: 2, bar_age_seconds: 4000, stale: true }, quote: {} }
    ]
  };
  const summary = runner.summariseFeed(feed, Date.now());
  assert.equal(summary.feed_age_seconds, null);
  assert.equal(summary.snapshot_stale, null);
  assert.equal(summary.stale_after_seconds, null);
  assert.equal(summary.m5_current, 1);
  assert.equal(summary.m5_stale, 1);
  assert.equal(summary.instruments[1].bid, null);
  assert.equal(summary.instruments[1].m5_bar_age_seconds, 4000);
  assert.equal(summary.terminal, null);
  assert.equal(summary.account, null);
  // A snapshot with no read-back says so rather than claiming nothing closed.
  assert.equal(summary.positions_open, null);
  assert.equal(summary.closed_trades, null);
  assert.equal(summary.closed_trade_window_days, null);
  assert.equal(summary.instruments[1].tick_age_seconds, null);
  assert.equal(summary.instruments[1].live_tick, null);
  assert.equal(summary.live_ticks, 0);
  assert.equal(summary.quiet_ticks, 0);
});

test("one run is one line of the log, and the log is append-only", () => {
  const workspace = tempWorkspace();
  const line = runner.formatRunRecord({ at_utc: "2026-10-04T12:00:20.000Z", status: "ok" });
  assert.equal(line.includes("\n"), false);
  assert.deepEqual(JSON.parse(line), { at_utc: "2026-10-04T12:00:20.000Z", status: "ok" });
  runner.appendLog(workspace.log, { at_utc: "2026-10-04T12:00:20.000Z", status: "ok" });
  runner.appendLog(workspace.log, { at_utc: "2026-10-04T12:05:20.000Z", status: "ok" });
  const lines = fs.readFileSync(workspace.log, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[1]).at_utc, "2026-10-04T12:05:20.000Z");
});

test("the lock keeps two runs from attaching to the terminal at once, and ages out", () => {
  const workspace = tempWorkspace();
  // Anchored to the real clock, because the guard compares the file's own mtime with the run's clock.
  const now = Date.now();
  const first = runner.acquireLock(workspace.lock, now);
  assert.equal(first.acquired, true);
  assert.equal(first.stoleStaleLock, false);
  assert.match(fs.readFileSync(workspace.lock, "utf8"), /"pid":\d+/);

  const second = runner.acquireLock(workspace.lock, now + 1000);
  assert.equal(second.acquired, false);
  assert.ok(second.ageMs !== null && second.ageMs <= 2000);

  // A run that died without releasing its lock must not stop the cadence forever.
  const old = new Date(now - 20 * 60 * 1000);
  fs.utimesSync(workspace.lock, old, old);
  const third = runner.acquireLock(workspace.lock, now);
  assert.equal(third.acquired, true);
  assert.equal(third.stoleStaleLock, true);
  assert.ok(third.ageMs >= 19 * 60 * 1000);
});

test("a run that the validator accepts is status ok, exit 0, one log line, lock released", () => {
  const workspace = tempWorkspace();
  const feed = committedFeed();
  const spawn = fakeProducer({ feed });
  const nowMs = Date.parse(feed.generated_at_utc) + 5000;
  const { code, record } = runner.runOnce(optionsFor(workspace), { spawn, now: () => nowMs });

  assert.equal(code, 0);
  assert.equal(record.status, "ok");
  assert.equal(record.producer_exit, 0);
  assert.equal(record.feed_age_seconds, 5);
  assert.equal(record.schema_version, FEED_SCHEMA_VERSION);
  assert.equal(record.m5_current + record.m5_stale, 4);
  assert.equal(record.stole_stale_lock, false);
  assert.equal(fs.existsSync(workspace.lock), false, "the lock must not outlive the run");

  const args = spawn.calls[0].args;
  assert.equal(path.resolve(args[0]), path.join(runner.REPO_ROOT, runner.PRODUCER_RELATIVE));
  assert.equal(args[1], "--out");
  assert.equal(path.resolve(args[2]), workspace.out);
  assert.equal(spawn.calls[0].command, "python");
  assert.equal(spawn.calls[0].options.cwd, runner.REPO_ROOT);

  const lines = fs.readFileSync(workspace.log, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).status, "ok");
});

test("--terminal and --candles reach the producer, and only when they were asked for", () => {
  const workspace = tempWorkspace();
  const spawn = fakeProducer({ feed: committedFeed() });
  runner.runOnce(optionsFor(workspace, { terminal: "C:\\Terminal", candles: 12 }), { spawn });
  const args = spawn.calls[0].args;
  assert.deepEqual(args.slice(3), ["--path", "C:\\Terminal", "--candles", "12"]);

  const workspace2 = tempWorkspace();
  const spawn2 = fakeProducer({ feed: committedFeed() });
  runner.runOnce(optionsFor(workspace2), { spawn: spawn2 });
  assert.deepEqual(spawn2.calls[0].args.slice(3), [], "no terminal and no candle count means no extra flag");
});

test("a producer that fails is recorded as a failure, not dressed as a run", () => {
  const workspace = tempWorkspace();
  const spawn = fakeProducer({ feed: committedFeed(), exit: 1, stderr: "No terminal reachable.\nTry again\n" });
  const { code, record } = runner.runOnce(optionsFor(workspace), { spawn });
  assert.equal(code, 1);
  assert.equal(record.status, "producer_failed");
  assert.equal(record.producer_exit, 1);
  assert.equal(record.error, "No terminal reachable. Try again");
  const lines = fs.readFileSync(workspace.log, "utf8").trim().split("\n");
  assert.equal(JSON.parse(lines[0]).status, "producer_failed");
});

test("a producer that cannot even start is a failure with the reason attached", () => {
  const workspace = tempWorkspace();
  const spawn = fakeProducer({ error: new Error("spawn python ENOENT") });
  const { code, record } = runner.runOnce(optionsFor(workspace), { spawn });
  assert.equal(code, 1);
  assert.equal(record.status, "producer_failed");
  assert.equal(record.producer_exit, null);
  assert.match(record.error, /ENOENT/);
});

test("a run that wrote nothing, or something the dashboard must not show, exits non-zero", () => {
  const silent = tempWorkspace();
  const nothing = runner.runOnce(optionsFor(silent), { spawn: fakeProducer({ exit: 0 }) });
  assert.equal(nothing.code, 1);
  assert.equal(nothing.record.status, "unreadable");
  assert.match(nothing.record.error, /ENOENT|no such file/i);

  const incomplete = tempWorkspace();
  const feed = committedFeed();
  feed.instruments.pop();
  const bad = runner.runOnce(optionsFor(incomplete), { spawn: fakeProducer({ feed }) });
  assert.equal(bad.code, 1);
  assert.equal(bad.record.status, "invalid");
  assert.ok(bad.record.error_count >= 1);
  assert.ok(bad.record.errors.length >= 1);
  assert.equal(bad.record.generated_at_utc, undefined, "an invalid feed contributes no broker facts");
});

test("a run that finds the lock held steps aside instead of attaching to the terminal", () => {
  const workspace = tempWorkspace();
  runner.acquireLock(workspace.lock, Date.now());
  const spawn = fakeProducer({ feed: committedFeed() });
  const { code, record } = runner.runOnce(optionsFor(workspace), { spawn });
  assert.equal(code, 0);
  assert.equal(record.status, "skipped");
  assert.equal(spawn.calls.length, 0, "a skipped run must not call the producer");
  assert.ok(record.lock_age_seconds !== null);
  assert.equal(fs.existsSync(workspace.lock), true, "the other run's lock is not ours to remove");
  fs.unlinkSync(workspace.lock);
});

test("a relative path lands in the repository, not in whatever directory the run was started from", () => {
  const original = process.cwd();
  const relativeDirectory = path.join("tmp", `live-trading-cadence-${process.pid}`);
  const feed = committedFeed();
  const spawn = fakeProducer({ feed });
  try {
    // A scheduled task starts in C:\Windows\System32, which is where a relative lock path used to send the run.
    process.chdir(os.tmpdir());
    const { code, record } = runner.runOnce(
      {
        ...runner.parseArgs([]),
        out: path.join(relativeDirectory, "feed.json"),
        log: path.join(relativeDirectory, "feed.log"),
        lock: path.join(relativeDirectory, "feed.lock")
      },
      { spawn }
    );
    assert.equal(code, 0);
    assert.equal(record.out, `${relativeDirectory.replace(/\\/g, "/")}/feed.json`);
    assert.ok(fs.existsSync(path.join(root, relativeDirectory, "feed.json")));
    assert.ok(fs.existsSync(path.join(root, relativeDirectory, "feed.log")));
    assert.equal(fs.existsSync(path.join(relativeDirectory, "feed.json")), false, "nothing is written beside the cwd");
  } finally {
    process.chdir(original);
    fs.rmSync(path.join(root, relativeDirectory), { recursive: true, force: true });
  }
});

test("an unexpected failure is logged as an error instead of dying quietly", () => {
  const workspace = tempWorkspace();
  // A file where the lock needs a directory: the guard throws before the producer is ever reached, which is the
  // shape of the fault that made a scheduled run exit 1 with no log line at all.
  fs.writeFileSync(workspace.out, "{}", "utf8");
  const { code, record } = runner.runOnce(
    optionsFor(workspace, { lock: path.join(workspace.out, "nested", "feed.lock") }),
    { spawn: fakeProducer({ feed: committedFeed() }) }
  );
  assert.equal(code, 1);
  assert.equal(record.status, "error");
  assert.ok(record.error);
  const lines = fs.readFileSync(workspace.log, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).status, "error");
});

test("main runs once, quietly, and returns the run's exit code", async () => {
  const workspace = tempWorkspace();
  const spawn = fakeProducer({ feed: committedFeed() });
  const argv = [
    "--once",
    "--out", workspace.out,
    "--log", workspace.log,
    "--lock", workspace.lock,
    "--quiet"
  ];
  const code = await runner.main(argv, { spawn });
  assert.equal(code, 0);
  const lines = fs.readFileSync(workspace.log, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).status, "ok");
});

test("--align waits for the next bar close before the run, which is what a drifted task needs", async () => {
  const workspace = tempWorkspace();
  const boundary = Date.parse("2026-10-04T12:00:00Z");
  const startedMs = boundary + 1000;
  const waits = [];
  const code = await runner.main(
    ["--once", "--align", "--quiet", "--out", workspace.out, "--log", workspace.log, "--lock", workspace.lock],
    {
      spawn: fakeProducer({ feed: committedFeed() }),
      now: () => startedMs,
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      }
    }
  );
  assert.equal(code, 0);
  assert.deepEqual(waits, [20000 - 1000], "the wait lands on this bar's settle instant, not five minutes from now");
});

test("the usage text is the contract a reader is handed, so it names every switch", () => {
  for (const flag of ["--once", "--loop", "--align", "--interval-seconds", "--settle-seconds", "--out", "--log", "--lock", "--python", "--terminal", "--candles", "--quiet", "--publish", "--publish-min-interval-seconds", "--publish-checkout", "--publish-state", "--publish-dry-run", "--help"]) {
    assert.ok(runner.USAGE.includes(flag), `usage must document ${flag}`);
  }
});

test("the cadence fits inside the freshness window the dashboard badge reads", () => {
  const feed = committedFeed();
  // A run per bar is the whole design: if one bar of cadence were longer than stale_after_seconds, the section
  // would badge a cadence that is working exactly as intended as STALE.
  assert.ok(feed.stale_after_seconds >= runner.BAR_SECONDS, "one bar of cadence must fit in the freshness window");
  assert.ok(runner.DEFAULT_SETTLE_SECONDS < runner.BAR_SECONDS);
});

test("the runner carries no order path, no broker import, and does no git work of its own", () => {
  const forbidden = /order_send|order_check|order_calc|positions_modify|positions_close|order_close|order_cancel/;
  assert.equal(forbidden.test(runnerSource), false, "the runner must not name any order function");
  assert.equal(
    /git\s+push|git\s+commit/i.test(runnerSource),
    false,
    "the runner commits and pushes nothing: it hands the artifact to the publisher, which does the git work in its own checkout"
  );

  // The broker package is reached only by the producer process; the runner must not import it, and the modules it
  // loads are the standard library, the shared validator, and the one publisher whose gates decide publication.
  const requires = [...runnerSource.matchAll(/require\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.deepEqual(requires.slice().sort(), [
    "./publish-live-trading-feed.js",
    "./validate_live_trading_feed.js",
    "node:child_process",
    "node:fs",
    "node:path"
  ]);
  assert.equal(/^\s*import\s/m.test(runnerSource), false);
  assert.equal(runner.PRODUCER_RELATIVE, "tools/mt5-bridge/live-trading-snapshot.py");

  // Publication is behind the flag and off by default: a cadence that began writing to the branch Pages serves
  // because a default changed is the failure this asserts against, so the flag is read, never assumed.
  assert.match(runnerSource, /if \(options\.publish === true\)/, "the publish step must sit behind --publish");
  assert.match(runnerSource, /publish: false/, "publishing must be off unless asked for");
  assert.ok(runner.USAGE.includes("--publish"), "usage must document --publish");
});

test("the scheduled task calls that runner, hides it, and schedules nothing else", () => {
  assert.match(registerSource, /run-live-trading-feed\.js/);
  assert.match(registerSource, /--once/);
  assert.match(registerSource, /--align/);
  assert.match(registerSource, /--quiet/);
  assert.match(registerSource, /data\\live-trading\.json/);
  assert.match(registerSource, /tmp\\live-trading-feed\.log/);
  assert.match(registerSource, /Register-ScheduledTask/);
  assert.match(registerSource, /Unregister-ScheduledTask/);
  // Replacing a registration must stop and remove the old one first: registering over a live run left the
  // scheduler refusing every repetition, which is a cadence that looks broken while the code looks fine.
  assert.match(registerSource, /Stop-ScheduledTask/);
  assert.match(registerSource, /RepetitionInterval/);
  assert.match(registerSource, /order_path\s+=\s+"none"/);
  // Publication is a switch on this script and nowhere else, so re-registering for any other reason cannot start
  // writing to the branch Pages serves; the interval it passes is the publisher's own gate value.
  assert.match(registerSource, /\[switch\] \$Publish/);
  assert.match(registerSource, /--publish --publish-min-interval-seconds \$PublishMinIntervalSeconds/);
  assert.match(registerSource, /publishes_anything = \[bool\]\$Publish/);
  assert.match(registerSource, /publish-live-trading-feed\.js/);
  assert.equal(/order_send|order_check|positions_modify|MetaTrader5/i.test(registerSource), false);
  assert.equal(/git\s+push|git\s+commit/i.test(registerSource), false);
  // The task lives beside the Gold window's own task, and must not disturb it.
  assert.match(registerSource, /LiveTradingFeedTick019/);
  assert.equal(/GoldQualificationWindowTick018/.test(registerSource), false);
});
