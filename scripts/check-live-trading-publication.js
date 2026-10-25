#!/usr/bin/env node
// Independent monitoring for the live lanes: reads what the page is actually served, not what the host thinks it
// wrote. The dashboard shows results, so a publisher that stopped and a terminal that died look the same there.
// This asks the published URLs and answers three questions per enabled lane:
//
//   identity   does the served snapshot carry the masked login the lanes document says it should?
//   freshness  how old is that snapshot, against the window the snapshot itself declares?
//   heartbeat  is a trader beating behind it, how old is that beat, and is it armed?
//
//   node scripts/check-live-trading-publication.js [--base <url>] [--json]
//
// Read-only. It issues GET requests and writes nothing; nothing here reads a credential, opens a broker
// connection or can send anything. Exit 0 when every enabled lane is fresh and identity-matched and every declared
// heartbeat is fresh, 1 when one is not, 2 when the lanes document itself cannot be read - which is a different
// failure from a lane being stale, and worth telling apart when a phone alert fires at 03:00.
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_BASE = "https://kevincreedycars-debug.github.io/trading-agent-dashboard";
const DEFAULT_LANES = "data/live-trading-lanes.json";
const DEFAULT_MAX_FEED_AGE_SECONDS = 900;
const DEFAULT_MAX_HEARTBEAT_AGE_SECONDS = 900;
const TIMEOUT_MS = 20000;

const USAGE = [
  "Usage:",
  "  node scripts/check-live-trading-publication.js [options]",
  "",
  `  --base <url>                     where the page is served (default ${DEFAULT_BASE})`,
  `  --lanes <path>                   the lanes document, relative to the base (default ${DEFAULT_LANES})`,
  "  --max-feed-age-seconds <n>       how old an enabled lane's snapshot may be (default 900)",
  "  --max-heartbeat-age-seconds <n>  how old a published heartbeat may be (default 900)",
  "  --json                           print one JSON line instead of the human report",
  "  --help                           print this text",
  "",
  "Exit 0 when every enabled lane is fresh and matched, 1 when one is not, 2 when the lanes document is unreadable."
].join("\n");

class UsageError extends Error {}

function parseArgs(argv) {
  const options = {
    base: DEFAULT_BASE,
    lanes: DEFAULT_LANES,
    maxFeedAgeSeconds: DEFAULT_MAX_FEED_AGE_SECONDS,
    maxHeartbeatAgeSeconds: DEFAULT_MAX_HEARTBEAT_AGE_SECONDS,
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
      case "--base":
        options.base = String(next()).trim().replace(/\/+$/, "");
        break;
      case "--lanes":
        options.lanes = String(next()).trim() || DEFAULT_LANES;
        break;
      case "--max-feed-age-seconds": {
        const value = Number(next());
        if (!Number.isFinite(value) || value <= 0) throw new UsageError("--max-feed-age-seconds needs a positive number");
        options.maxFeedAgeSeconds = value;
        break;
      }
      case "--max-heartbeat-age-seconds": {
        const value = Number(next());
        if (!Number.isFinite(value) || value <= 0) throw new UsageError("--max-heartbeat-age-seconds needs a positive number");
        options.maxHeartbeatAgeSeconds = value;
        break;
      }
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

// One read, of one published file. A 404 is `missing` rather than an error: a lane that is parked publishes
// nothing, and a heartbeat that is not there yet is a fact to report, not a crash.
async function readJson(url, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return { ok: false, status: 0, missing: false, error: String(error.message || error), body: null, url };
  }
  if (response.status === 404) return { ok: false, status: 404, missing: true, error: null, body: null, url };
  if (!response.ok) {
    return { ok: false, status: response.status, missing: false, error: `HTTP ${response.status}`, body: null, url };
  }
  try {
    return { ok: true, status: response.status, missing: false, error: null, body: await response.json(), url };
  } catch (error) {
    return { ok: false, status: response.status, missing: false, error: `not JSON: ${error.message}`, body: null, url };
  }
}

function ageSecondsOf(stamp, nowMs) {
  const at = Date.parse(stamp || "");
  if (Number.isNaN(at)) return null;
  return Math.round((nowMs - at) / 1000);
}

async function checkLane(lane, options, deps) {
  const fetchImpl = deps.fetch || fetch;
  const nowMs = (deps.now || Date.now)();
  const enabled = lane?.enabled !== false;
  const row = {
    id: lane?.id ?? null,
    label: lane?.label ?? lane?.id ?? null,
    enabled,
    status: "ok",
    problems: [],
    notes: [],
    identity: { expected: lane?.account_login_masked ?? null, served: null, matched: null },
    feed: { age_seconds: null, window_seconds: null },
    heartbeat: { declared: Boolean(lane?.trader_status), age_seconds: null, armed: null, status: null }
  };
  if (!enabled) {
    row.status = "disabled";
    row.notes.push("parked in the lanes document: nothing is published for it and no loop trades it");
    return row;
  }

  const feedPath = String(lane?.feed || "").replace(/^\.?\//, "");
  if (!feedPath) {
    row.status = "fail";
    row.problems.push("the lane names no snapshot to read");
    return row;
  }
  const feedRead = await readJson(`${options.base}/${feedPath}`, fetchImpl);
  if (!feedRead.ok) {
    row.status = "fail";
    row.problems.push(feedRead.missing ? `${feedPath} is not published` : `${feedPath} could not be read: ${feedRead.error}`);
    return row;
  }
  const feed = feedRead.body || {};
  row.identity.served = feed?.account?.login_masked ?? null;
  row.feed.age_seconds = ageSecondsOf(feed?.generated_at_utc, nowMs);
  row.feed.window_seconds = Number.isFinite(Number(feed?.stale_after_seconds))
    ? Number(feed.stale_after_seconds)
    : options.maxFeedAgeSeconds;
  if (!row.identity.expected) {
    row.notes.push("the lanes document names no masked login, so the served identity cannot be checked");
  } else {
    row.identity.matched = row.identity.served === row.identity.expected;
    if (!row.identity.matched) {
      row.problems.push(
        `the served snapshot carries account ${row.identity.served ?? "(none)"}, where the lanes document says ${row.identity.expected}`
      );
    }
  }
  if (row.feed.age_seconds === null) {
    row.problems.push("the snapshot states no readable generated_at_utc");
  } else if (row.feed.age_seconds > row.feed.window_seconds) {
    row.problems.push(
      `the snapshot is ${row.feed.age_seconds}s old, past the ${row.feed.window_seconds}s window it declares`
    );
  }

  if (row.heartbeat.declared) {
    const statusPath = String(lane.trader_status).replace(/^\.?\//, "");
    const statusRead = await readJson(`${options.base}/${statusPath}`, fetchImpl);
    if (!statusRead.ok) {
      row.problems.push(
        statusRead.missing
          ? `${statusPath} is declared in the lanes document but not published`
          : `${statusPath} could not be read: ${statusRead.error}`
      );
    } else {
      const status = statusRead.body || {};
      row.heartbeat.age_seconds = ageSecondsOf(status?.written_at_utc || status?.at_utc, nowMs);
      row.heartbeat.armed = status?.armed === true;
      row.heartbeat.status = status?.status ?? null;
      if (status?.lane && status.lane !== row.id) {
        row.problems.push(`the heartbeat names lane ${status.lane}, where this lane is ${row.id}`);
      }
      if (row.heartbeat.age_seconds === null) {
        row.problems.push("the heartbeat states no readable written_at_utc");
      } else if (row.heartbeat.age_seconds > options.maxHeartbeatAgeSeconds) {
        row.problems.push(
          `the heartbeat is ${row.heartbeat.age_seconds}s old, past the ${options.maxHeartbeatAgeSeconds}s this check allows`
        );
      }
    }
  } else {
    row.notes.push("no trader heartbeat is declared for this lane, so only the snapshot is checked");
  }

  if (row.problems.length) row.status = "fail";
  return row;
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
  const documentUrl = `${options.base}/${String(options.lanes).replace(/^\.?\//, "")}`;
  const documentRead = await readJson(documentUrl, deps.fetch || fetch);
  const nowMs = (deps.now || Date.now)();
  if (!documentRead.ok) {
    const error = documentRead.error || (documentRead.missing ? "not published" : "unreadable");
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({ at_utc: new Date(nowMs).toISOString(), base: options.base, lanes_document: { url: documentUrl, error }, lanes: [] })}\n`
      );
    } else {
      process.stdout.write(
        `The lanes document could not be read (${error}), so nothing can be checked: ${documentUrl}\n`
      );
    }
    return 2;
  }
  const lanes = Array.isArray(documentRead.body?.lanes) ? documentRead.body.lanes : [];
  const rows = [];
  for (const lane of lanes) rows.push(await checkLane(lane, options, deps));
  const failures = rows.filter((row) => row.status === "fail");
  const report = {
    at_utc: new Date(nowMs).toISOString(),
    base: options.base,
    lanes_document: { url: documentUrl, generated_at_utc: documentRead.body?.generated_at_utc ?? null },
    lanes: rows,
    verdict: failures.length ? "attention" : "ok"
  };
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } else {
    for (const row of rows) {
      const parts = [row.id || "(no id)", row.status, row.enabled ? "enabled" : "disabled"];
      if (row.enabled) {
        const matched = row.identity.matched === null
          ? ""
          : row.identity.matched
            ? " (matched)"
            : ` (expected ${row.identity.expected})`;
        parts.push(`identity ${row.identity.served ?? "-"}${matched}`);
        parts.push(`snapshot ${row.feed.age_seconds === null ? "age unknown" : `${row.feed.age_seconds}s`} of ${row.feed.window_seconds}s`);
        parts.push(
          row.heartbeat.declared
            ? `heartbeat ${row.heartbeat.age_seconds === null ? "unreadable" : `${row.heartbeat.age_seconds}s`}, ${row.heartbeat.armed ? "armed" : "not armed"}`
            : "heartbeat not declared"
        );
      }
      process.stdout.write(`${parts.join(" | ")}\n`);
      for (const problem of row.problems) process.stdout.write(`    problem: ${problem}\n`);
      for (const note of row.notes) process.stdout.write(`    note:    ${note}\n`);
    }
    process.stdout.write(`\nlanes ${rows.length}, failing ${failures.length}, base ${options.base}\n`);
    process.stdout.write(
      failures.length
        ? "ATTENTION: one or more enabled lanes is stale, mismatched or missing a heartbeat.\n"
        : "OK: every enabled lane is published, fresh and the account the lanes document names.\n"
    );
  }
  return failures.length ? 1 : 0;
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
      process.exitCode = 2;
    }
  );
}

module.exports = {
  REPO_ROOT,
  DEFAULT_BASE,
  DEFAULT_LANES,
  USAGE,
  UsageError,
  parseArgs,
  readJson,
  ageSecondsOf,
  checkLane,
  main
};

