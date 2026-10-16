// One cadence runner for the read-only Live Trading feed, and the log of what every run saw.
//
//   node scripts/run-live-trading-feed.js --once      one producer run, then validate it and log the result
//   node scripts/run-live-trading-feed.js --loop      the same run at every 5m bar close, until stopped
//
// The runner adds no broker call of its own. It spawns tools/mt5-bridge/live-trading-snapshot.py - the only
// process in the repository that attaches to the terminal, and read-only by construction - and then requires the
// same validator the dashboard's guard uses, so a run that writes an artifact the page must not show as a live
// feed exits non-zero and says so in the log. There is no order function here, no credential and no account read
// of its own.
//
// A run produces a local artifact and stops there unless --publish is passed. With --publish the run hands the
// validated artifact to scripts/publish-live-trading-feed.js, which is the only step in this lane that writes to
// the branch Pages serves; it is off by default because publishing is a production change, and its own gates
// (validator, artifact freshness, never behind the published copy, and a minimum interval) each refuse rather
// than warn. A publish that refuses is a failed run: the artifact is still written, and the exit code says the
// dashboard did not get it.
//
//   node scripts/run-live-trading-feed.js --once --out tmp/live-trading-check.json    write somewhere else
//   node scripts/run-live-trading-feed.js --once --terminal "C:\Program Files\FTMO Global Markets MT5 Terminal"
//
// --align exists because the model reads M5 closes. It sleeps to the next 5m boundary plus the settle window
// before running, so a scheduled task whose repetition has drifted still samples just after the bar close. One
// run per bar, one line of evidence per run, in a log the next reader can check without trusting this file.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const feedValidator = require("./validate_live_trading_feed.js");
const feedPublisher = require("./publish-live-trading-feed.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const PRODUCER_RELATIVE = "tools/mt5-bridge/live-trading-snapshot.py";
// M5: the timeframe the entry rule and the L2L levels are read on, and the cadence the runner aligns to.
const BAR_SECONDS = 300;
const DEFAULT_INTERVAL_SECONDS = BAR_SECONDS;
// How far after a bar close a run starts, so the bar it reads has actually closed.
const DEFAULT_SETTLE_SECONDS = 20;
const DEFAULT_OUT = "data/live-trading.json";
const DEFAULT_LOG = "tmp/live-trading-feed.log";
const DEFAULT_LOCK = "tmp/live-trading-feed.lock";
// A one-minute run of this producer is already slow; this is a hung terminal, not a slow one.
const PRODUCER_TIMEOUT_MS = 120000;
// A run that dies without releasing its lock must not stop the cadence forever.
const LOCK_STALE_MS = 600000;

const USAGE = [
  "Usage:",
  "  node scripts/run-live-trading-feed.js [--once|--loop] [options]",
  "",
  "  --once                     run the producer once, validate the artifact, log one line, exit 0/1 (default)",
  "  --loop                     run at every 5m bar close until stopped (Ctrl-C)",
  "  --align                    sleep to the next bar close plus the settle window before running",
  "  --interval-seconds <n>     bar width the cadence aligns to (default 300, i.e. M5)",
  "  --settle-seconds <n>       seconds after the bar close the run starts (default 20)",
  "  --out <path>               snapshot path, relative to the repository root (default data/live-trading.json)",
  "  --log <path>               append-only run log (default tmp/live-trading-feed.log)",
  "  --lock <path>              overlap guard (default tmp/live-trading-feed.lock)",
  "                             Every path is resolved against the repository root, never against the working",
  "                             directory, so a scheduled task started in C:\\Windows\\System32 writes where the",
  "                             dashboard reads.",
  "  --python <exe>             Python interpreter holding MetaTrader5 (default python on PATH)",
  "  --terminal <path>          terminal64.exe or terminal folder; omitted means the producer's own discovery",
  "  --candles <n>              M5 bars the producer keeps per instrument (default: producer's own)",
  "  --publish                  publish the validated artifact to the branch Pages serves; this is the one step",
  "                             in this lane that writes to production, and it is off unless asked for",
  "  --publish-min-interval-seconds <n>  fastest publish cadence allowed (default 600, six Pages builds an hour,",
  "                             inside GitHub's documented soft limit of ten)",
  "  --publish-checkout <path>  the publish checkout the publisher resets each run (default beside the canonical",
  "                             repository, .local/live-trading-feed-publish)",
  "  --publish-state <path>     where the last publish is recorded (default tmp/live-trading-publish-state.json)",
  "  --publish-dry-run          run the publisher's gates, then stop before anything is written or pushed",
  "  --quiet                    log to the log file only, print nothing",
  "  --help                     print this text"
].join("\n");

// The one error a caller is meant to see as a message rather than a stack: a bad command line.
class UsageError extends Error {}

function parseArgs(argv) {
  const options = {
    mode: "once",
    align: false,
    quiet: false,
    help: false,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    settleSeconds: DEFAULT_SETTLE_SECONDS,
    out: DEFAULT_OUT,
    log: DEFAULT_LOG,
    lock: DEFAULT_LOCK,
    python: null,
    terminal: null,
    candles: null,
    publish: false,
    publishMinIntervalSeconds: feedPublisher.DEFAULT_MIN_INTERVAL_SECONDS,
    publishCheckout: null,
    publishState: null,
    publishDryRun: false
  };
  let sawOnce = false;
  let sawLoop = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new UsageError(`Argument ${token} needs a value`);
      return argv[index];
    };
    switch (token) {
      case "--once":
        sawOnce = true;
        options.mode = "once";
        break;
      case "--loop":
        sawLoop = true;
        options.mode = "loop";
        break;
      case "--align":
        options.align = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--interval-seconds":
        options.intervalSeconds = positiveNumber(token, next());
        break;
      case "--settle-seconds":
        options.settleSeconds = nonNegativeNumber(token, next());
        break;
      case "--out":
        options.out = next();
        break;
      case "--log":
        options.log = next();
        break;
      case "--lock":
        options.lock = next();
        break;
      case "--python":
        options.python = next();
        break;
      case "--terminal":
        options.terminal = next();
        break;
      case "--candles":
        options.candles = positiveInteger(token, next());
        break;
      case "--publish":
        options.publish = true;
        break;
      case "--publish-min-interval-seconds":
        options.publishMinIntervalSeconds = positiveNumber(token, next());
        break;
      case "--publish-checkout":
        options.publishCheckout = next();
        break;
      case "--publish-state":
        options.publishState = next();
        break;
      case "--publish-dry-run":
        options.publish = true;
        options.publishDryRun = true;
        break;
      default:
        throw new UsageError(`Unknown argument: ${token}`);
    }
  }

  if (sawOnce && sawLoop) throw new UsageError("--once and --loop are alternatives; pass one of them.");
  if (options.settleSeconds >= options.intervalSeconds) {
    throw new UsageError("--settle-seconds must be smaller than --interval-seconds, or the cadence chases itself.");
  }
  return options;
}

function positiveNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new UsageError(`${flag} needs a positive number, got ${raw}`);
  return value;
}

function nonNegativeNumber(flag, raw) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new UsageError(`${flag} needs a number of seconds, got ${raw}`);
  return value;
}

function positiveInteger(flag, raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new UsageError(`${flag} needs a positive integer, got ${raw}`);
  return value;
}

// The instant a run should start: the next bar close plus the settle window, strictly after `fromMs`, so a run
// that has just finished inside the settle window waits for the following bar instead of running twice.
function nextRunAt(fromMs, intervalSeconds = DEFAULT_INTERVAL_SECONDS, settleSeconds = DEFAULT_SETTLE_SECONDS) {
  const stepMs = intervalSeconds * 1000;
  const boundaryMs = Math.floor(fromMs / stepMs) * stepMs;
  const target = boundaryMs + settleSeconds * 1000;
  return target > fromMs ? target : target + stepMs;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// The broker facts every run logs, read back out of the artifact the producer wrote. Nothing here is inferred: a
// null means the field was not in the snapshot, which is itself worth seeing in the log.
//
// Two different freshness facts are reported, because on a weekend they disagree and only one of them is
// liveness. The producer's own `m5.bar_age_seconds` measures the newest bar against that instrument's last tick,
// so a market shut since Friday reads "current" - its closing bar IS the newest bar it has. `tick_age_seconds`
// measures the instrument's last tick against the snapshot's own clock, which is the fact that says whether the
// instrument is streaming bars right now, and `live_tick` is that comparison against one M5 bar width.
function summariseFeed(feed, nowMs = Date.now()) {
  const generatedMs = Date.parse(feed?.generated_at_utc ?? "");
  const feedAgeSeconds = Number.isFinite(generatedMs) ? Math.round((nowMs - generatedMs) / 1000) : null;
  const staleAfterSeconds = Number.isFinite(feed?.stale_after_seconds) ? feed.stale_after_seconds : null;
  const snapshotServerMs = Date.parse(feed?.time_server ?? "");
  const instruments = Array.isArray(feed?.instruments)
    ? feed.instruments.map((instrument) => {
        const m5 = instrument?.m5 || {};
        const quote = instrument?.quote || {};
        const quoteServerMs = Date.parse(quote.time_server ?? "");
        const tickAgeSeconds =
          Number.isFinite(quoteServerMs) && Number.isFinite(snapshotServerMs)
            ? Math.round((snapshotServerMs - quoteServerMs) / 1000)
            : null;
        return {
          symbol: instrument?.symbol ?? "<unknown>",
          bid: Number.isFinite(quote.bid) ? quote.bid : null,
          ask: Number.isFinite(quote.ask) ? quote.ask : null,
          tick_age_seconds: tickAgeSeconds,
          live_tick: tickAgeSeconds === null ? null : tickAgeSeconds <= BAR_SECONDS,
          m5_candle_count: Number.isInteger(m5.candle_count) ? m5.candle_count : null,
          m5_bar_age_seconds: Number.isFinite(m5.bar_age_seconds) ? m5.bar_age_seconds : null,
          m5_stale: m5.stale === true
        };
      })
    : [];

  return {
    schema_version: feed?.schema_version ?? null,
    generated_at_utc: feed?.generated_at_utc ?? null,
    feed_age_seconds: feedAgeSeconds,
    stale_after_seconds: staleAfterSeconds,
    snapshot_stale: feedAgeSeconds === null || staleAfterSeconds === null ? null : feedAgeSeconds > staleAfterSeconds,
    terminal: feed?.terminal?.name ?? null,
    account: feed?.account ? `${feed.account.login_masked ?? "?"} ${feed.account.server ?? "?"}` : null,
    positions_open: feed?.account?.positions_open ?? null,
    // The read-back counts, so every log line says whether the account held anything and whether anything
    // closed inside the snapshot's own window. Null means the snapshot predates the read-back.
    closed_trades: Array.isArray(feed?.closed_trades) ? feed.closed_trades.length : null,
    closed_trade_window_days: feed?.history?.window_days ?? null,
    instruments,
    m5_current: instruments.filter((instrument) => instrument.m5_stale !== true).length,
    m5_stale: instruments.filter((instrument) => instrument.m5_stale === true).length,
    live_ticks: instruments.filter((instrument) => instrument.live_tick === true).length,
    quiet_ticks: instruments.filter((instrument) => instrument.live_tick === false).length
  };
}

// One line, always: the log is read by eye and by grep, and a run with nothing to say still has to say when.
function formatRunRecord(record) {
  return JSON.stringify(record);
}

function appendLog(logPath, record) {
  const resolved = path.resolve(logPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.appendFileSync(resolved, `${formatRunRecord(record)}\n`, "utf8");
  return resolved;
}

// Two processes must not attach to the terminal at once and write the same artifact half-and-half. The lock is a
// file, so the guard also holds between a foreground run and the scheduled task.
function acquireLock(lockPath, nowMs) {
  const resolved = path.resolve(lockPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const payload = `${JSON.stringify({ pid: process.pid, at_utc: new Date(nowMs).toISOString() })}\n`;
  try {
    fs.writeFileSync(resolved, payload, { flag: "wx" });
    return { acquired: true, path: resolved, stoleStaleLock: false, ageMs: 0 };
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }

  let ageMs = null;
  try {
    ageMs = nowMs - fs.statSync(resolved).mtimeMs;
  } catch {
    ageMs = null;
  }
  if (ageMs !== null && ageMs > LOCK_STALE_MS) {
    fs.writeFileSync(resolved, payload);
    return { acquired: true, path: resolved, stoleStaleLock: true, ageMs };
  }
  return { acquired: false, path: resolved, ageMs };
}

function releaseLock(lock) {
  // Only ever remove the lock this run took: a run that stepped aside must not delete the other run's guard.
  if (!lock?.acquired) return;
  try {
    fs.unlinkSync(lock.path);
  } catch {
    // A lock already gone is the state we want; nothing to report.
  }
}

function tail(text, limit = 200) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(-limit).replace(/\s+/g, " ");
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Paths in the log are written the way the rest of the repository writes them, so a log line can be pasted into
// a shell or an issue without a Windows backslash surprise.
function relativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/") || absolutePath;
}

// The publish result, trimmed to the fields a reader of the log needs: what was decided, whether it landed, and
// the commit that carries it. The publisher reports far more on its own line in tmp/live-trading-publish-state.json
// and on stdout; the run log keeps only what tells a reader whether the dashboard got this snapshot.
function summarisePublish(result) {
  if (!result) return null;
  return {
    action: result.action ?? null,
    published: result.published === true,
    decision: result.decision ?? null,
    reason: result.reason ? String(result.reason).slice(0, 200) : null,
    commit: result.commit ?? null,
    attempts: result.attempts ?? null,
    min_interval_seconds: result.min_interval_seconds ?? null
  };
}

// One run: guard, producer, validate, log. Returns the exit code the scheduled task will record and the record
// itself, so a caller - or a test - can see exactly what was written to the log.
//
// Every path is resolved against the repository root rather than the process working directory. A scheduled task
// starts in C:\Windows\System32, where the relative default `tmp/live-trading-feed.lock` made the run try to create
// C:\Windows\System32\tmp, throw EPERM and exit 1 without writing a log line at all (observed 2026-10-04: the task
// looked alive, wrote nothing, and left no evidence of why).
function runOnce(options, deps = {}) {
  const spawn = deps.spawn || spawnSync;
  const now = deps.now || (() => Date.now());
  const validate = deps.validate || ((feed) => feedValidator.validateLiveTradingFeed(feed));
  const writeLog = deps.writeLog || appendLog;
  const startedMs = now();
  const outPath = path.resolve(REPO_ROOT, options.out);
  const logPath = path.resolve(REPO_ROOT, options.log);
  const lockPath = path.resolve(REPO_ROOT, options.lock);
  const record = {
    at_utc: new Date(startedMs).toISOString(),
    status: "unknown",
    out: path.relative(REPO_ROOT, outPath).replace(/\\/g, "/") || outPath
  };
  let lock = null;

  try {
    lock = acquireLock(lockPath, startedMs);
    if (!lock.acquired) {
      record.status = "skipped";
      record.reason = "another run holds the lock";
      record.lock_age_seconds = lock.ageMs === null ? null : Math.round(lock.ageMs / 1000);
      record.duration_seconds = round2((now() - startedMs) / 1000);
      writeLog(logPath, record);
      return { code: 0, record };
    }
    record.stole_stale_lock = lock.stoleStaleLock === true;

    const producerArgs = [path.join(REPO_ROOT, PRODUCER_RELATIVE), "--out", outPath];
    if (options.terminal) producerArgs.push("--path", options.terminal);
    if (options.candles) producerArgs.push("--candles", String(options.candles));

    const result = spawn(options.python || "python", producerArgs, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: PRODUCER_TIMEOUT_MS,
      windowsHide: true
    });

    record.producer_exit = typeof result?.status === "number" ? result.status : null;
    if (result?.error) {
      record.status = "producer_failed";
      record.error = String(result.error.message || result.error).slice(0, 200);
    } else if (result.status !== 0) {
      record.status = "producer_failed";
      record.error = tail(result.stderr) || tail(result.stdout) || `producer exited ${result.status}`;
    } else {
      let feed = null;
      try {
        feed = JSON.parse(fs.readFileSync(outPath, "utf8"));
      } catch (error) {
        record.status = "unreadable";
        record.error = String(error.message || error).slice(0, 200);
      }
      if (feed) {
        const errors = validate(feed);
        if (errors.length) {
          record.status = "invalid";
          record.error_count = errors.length;
          record.errors = errors.slice(0, 5);
        } else {
          record.status = "ok";
          Object.assign(record, summariseFeed(feed, now()));
          // The artifact is valid, so the only remaining question is whether this run was asked to put it on the
          // branch the dashboard reads. The publisher's own gates decide; this records what they decided.
          if (options.publish === true) {
            const publish = deps.publish || ((publishOptions) => feedPublisher.publishFeed(publishOptions, {}));
            record.publish = summarisePublish(
              publish({
                feed: relativePath(outPath),
                checkout: options.publishCheckout,
                remote: feedPublisher.DEFAULT_REMOTE,
                branch: feedPublisher.DEFAULT_BRANCH,
                minIntervalSeconds: options.publishMinIntervalSeconds,
                state: options.publishState,
                force: false,
                dryRun: options.publishDryRun === true,
                json: false,
                help: false
              })
            );
          }
        }
      }
    }
  } catch (error) {
    // Whatever went wrong, the log is the evidence: a run that dies quietly is worse than a run that fails loudly.
    record.status = "error";
    record.error = String(error?.message || error).slice(0, 200);
  } finally {
    releaseLock(lock);
  }

  record.duration_seconds = round2((now() - startedMs) / 1000);
  writeLog(logPath, record);
  // A run that was asked to publish and did not is a failed run even though the artifact is fine: the task's exit
  // code is the only thing a scheduler surfaces, and "the dashboard did not get this snapshot" has to show there.
  const publishRefused = record.publish ? record.publish.action === "refuse" : false;
  return { code: record.status === "ok" && !publishRefused ? 0 : 1, record };
}

async function runLoop(options, deps = {}) {
  const now = deps.now || (() => Date.now());
  const wait = deps.sleep || sleep;
  // One run now, then one per bar close: a cadence that starts by waiting five minutes is a cadence nobody sees
  // working on the day it is switched on.
  for (;;) {
    const { record } = runOnce(options, deps);
    if (!options.quiet) process.stdout.write(`${formatRunRecord(record)}\n`);
    const target = nextRunAt(now(), options.intervalSeconds, options.settleSeconds);
    if (!options.quiet) process.stdout.write(`${JSON.stringify({ next_run_at_utc: new Date(target).toISOString() })}\n`);
    await wait(target - now());
  }
}

async function main(argv = process.argv.slice(2), deps = {}) {
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

  if (options.mode === "loop") return runLoop(options, deps);

  if (options.align) {
    const now = deps.now || (() => Date.now());
    const wait = deps.sleep || sleep;
    await wait(nextRunAt(now(), options.intervalSeconds, options.settleSeconds) - now());
  }

  const { code, record } = runOnce(options, deps);
  if (!options.quiet) process.stdout.write(`${formatRunRecord(record)}\n`);
  return code;
}

module.exports = {
  BAR_SECONDS,
  DEFAULT_INTERVAL_SECONDS,
  DEFAULT_SETTLE_SECONDS,
  DEFAULT_OUT,
  DEFAULT_LOG,
  DEFAULT_LOCK,
  PRODUCER_RELATIVE,
  REPO_ROOT,
  USAGE,
  UsageError,
  parseArgs,
  nextRunAt,
  summariseFeed,
  formatRunRecord,
  appendLog,
  acquireLock,
  runOnce,
  main
};

if (require.main === module) {
  main().then(
    (code) => {
      process.exit(code);
    },
    (error) => {
      process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
      process.exit(1);
    }
  );
}

