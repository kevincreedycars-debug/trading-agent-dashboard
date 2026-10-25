#!/usr/bin/env node
// The one publisher for every Live Trading lane.
//
// Two FTMO accounts run on two terminals, in two checkouts, with two sets of artifacts. What they must not have
// is two publishers: two runs pushing two commits a few seconds apart would serve a page whose account #1 block
// and account #2 block come from different reads, and two runs racing the same remote is where a rejected push
// and a cached 404 come from. This script reads each lane's artifact, checks it is still the account that lane
// says it is, and hands the whole set to scripts/publish-live-trading-feed.js as one commit - every gate that
// file already applies still applies, per artifact, and a lane that fails any of them refuses the run before
// anything is written.
//
//   node scripts/publish-live-trading-lanes.js [--config config/live-trading-lanes.json] [--dry-run]
//
// Nothing here reads a password or a token. The lanes file carries account labels and paths, never a credential.
// A lane may carry `"enabled": false` while its terminal is not deployed yet: it is reported as disabled and skipped,
// so one account publishing is not stopped by the other being absent. Enabled is the default.
//
// Exit 0 when the artifacts are published or already current, 1 when a gate refused or git failed, 2 on a bad
// command line or an unreadable lanes file.
const fs = require("node:fs");
const path = require("node:path");

const publisher = require("./publish-live-trading-feed.js");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = "config/live-trading-lanes.json";
// The document the page reads: one row per account, written here and published beside the snapshots. Its shape
// is versioned because the page decides from it which lanes exist and which are deployed.
const LANES_SCHEMA_VERSION = "live-trading-lanes-v1";

const USAGE = [
  "Usage:",
  "  node scripts/publish-live-trading-lanes.js [options]",
  "",
  "  --config <path>                 the lanes file (default config/live-trading-lanes.json)",
  "  --checkout <path>               the publish checkout, reset to the remote branch each run",
  "  --remote <name>                 git remote (default origin)",
  "  --branch <name>                 branch Pages serves (default main)",
  "  --min-interval-seconds <n>      fastest cadence allowed between publishes (default: the lanes file's own,",
  "                                  or 600)",
  "  --state <path>                  where the last publish is recorded (default: the lanes file's own)",
  "  --force                         publish now even if the interval gate says wait",
  "  --dry-run                       run every gate and every read, then stop before writing or pushing",
  "  --json                          print the result as one JSON line (the default is the same line)",
  "  --help                          print this text",
  "",
  "  Exit 0 when the artifacts are published or already current, 1 when a gate refused or git failed."
].join("\n");

// The one error a caller is meant to see as a message rather than a stack: a bad command line or lanes file.
class UsageError extends Error {}

function parseArgs(argv) {
  const options = {
    config: DEFAULT_CONFIG,
    checkout: null,
    remote: publisher.DEFAULT_REMOTE,
    branch: publisher.DEFAULT_BRANCH,
    minIntervalSeconds: null,
    state: null,
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
      case "--config":
        options.config = next();
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
      case "--min-interval-seconds": {
        const raw = next();
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
          throw new UsageError(`--min-interval-seconds needs a positive number, got ${raw}`);
        }
        options.minIntervalSeconds = value;
        break;
      }
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

// The lanes file, read and checked before any artifact is opened: a lane with no id, a path that is not a path,
// or two lanes publishing to the same file is a configuration fault, and a fault here would either publish one
// account's read under another's name or overwrite a lane silently.
function loadLanes(configPath) {
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new UsageError(`the lanes file ${configPath} could not be read: ${String(error.message || error)}`);
  }
  const lanes = Array.isArray(parsed?.lanes) ? parsed.lanes : [];
  if (!lanes.length) throw new UsageError(`the lanes file ${configPath} names no lanes`);

  const ids = new Set();
  const targets = new Set();
  const checked = lanes.map((lane, index) => {
    const id = typeof lane?.id === "string" ? lane.id.trim() : "";
    if (!id) throw new UsageError(`lane ${index + 1} in ${configPath} has no id`);
    if (ids.has(id)) throw new UsageError(`two lanes share the id ${id} in ${configPath}`);
    ids.add(id);
    const feed = typeof lane.feed === "string" && lane.feed.trim() ? lane.feed.trim() : "data/live-trading.json";
    const published = typeof lane.published === "string" && lane.published.trim() ? lane.published.trim() : feed;
    if (targets.has(published)) {
      throw new UsageError(`two lanes publish to ${published} in ${configPath}; each lane needs its own file`);
    }
    targets.add(published);
    return {
      id,
      label: typeof lane.label === "string" && lane.label.trim() ? lane.label.trim() : id,
      root: typeof lane.root === "string" && lane.root.trim() ? lane.root.trim() : ".",
      feed,
      published,
      // The loop's own heartbeat, written by that lane's trader on every run and carried to the page beside the
      // snapshot. It is optional on purpose - a lane whose trader has never run has no heartbeat, and saying that
      // is better than refusing to publish the account's snapshot - but a heartbeat that is there and names
      // another account is a refusal, the way a snapshot from another account is.
      trader_status:
        typeof lane.trader_status === "string" && lane.trader_status.trim()
          ? lane.trader_status.trim()
          : "tmp/live-trading-trader-status.json",
      status_published:
        typeof lane.status_published === "string" && lane.status_published.trim()
          ? lane.status_published.trim()
          : `data/live-trading-trader.${id}.json`,
      // A lane that is not deployed yet is disabled explicitly rather than left to fail as a missing snapshot: the
      // publisher then serves the lanes that exist and says so, instead of stopping the account that does. The
      // default is enabled, so the flag has to be written to switch a lane off.
      enabled: lane?.enabled !== false,
      account_login_masked: typeof lane.account_login_masked === "string" ? lane.account_login_masked : null,
      account_server:
        typeof lane.account_server === "string" && lane.account_server.trim() ? lane.account_server.trim() : null
    };
  });

  return {
    minIntervalSeconds: Number.isFinite(parsed?.publish?.min_interval_seconds)
      ? parsed.publish.min_interval_seconds
      : null,
    state:
      typeof parsed?.publish?.state === "string" && parsed.publish.state.trim() ? parsed.publish.state.trim() : null,
    // The lanes document the page reads: which accounts exist, which of them are deployed, and where each one's
    // snapshot and heartbeat are published. It travels in the same commit as the snapshots, so the page can never
    // be told about a lane before it is served, and a lane that is switched off says so on the page rather than
    // vanishing from it.
    summary:
      typeof parsed?.publish?.summary === "string" && parsed.publish.summary.trim()
        ? parsed.publish.summary.trim()
        : "data/live-trading-lanes.json",
    lanes: checked
  };
}

// Where a lane's artifact lives on this machine. `root` is the checkout that lane's own cadence writes in, so a
// lane on another drive is one line in the lanes file and no change here.
function laneArtifactPath(lane) {
  return path.resolve(REPO_ROOT, lane.root, lane.feed);
}

// The lane's identity, read from its own snapshot rather than from the plan. A snapshot that carries a different
// masked login or server than the lane says is the one mistake that makes the page lie about which account is
// which, so it refuses instead of publishing. A lane whose identity is not yet configured has nothing to compare
// and says so in the result: that is a fact the reader is told, not a check that passed.
function identityCheck(lane, feed) {
  const masked = feed?.account?.login_masked ?? null;
  const server = feed?.account?.server ?? null;
  if (!lane.account_login_masked) {
    return { ok: true, configured: false, account_login_masked: masked, account_server: server, reason: null };
  }
  if (masked !== lane.account_login_masked) {
    return {
      ok: false,
      configured: true,
      account_login_masked: masked,
      account_server: server,
      reason: `${lane.label} publishes the snapshot carrying account ${masked}, where the lanes file says ${lane.account_login_masked}`
    };
  }
  if (lane.account_server && server && server !== lane.account_server) {
    return {
      ok: false,
      configured: true,
      account_login_masked: masked,
      account_server: server,
      reason: `${lane.label} publishes a snapshot from server ${server}, where the lanes file says ${lane.account_server}`
    };
  }
  return { ok: true, configured: true, account_login_masked: masked, account_server: server, reason: null };
}

// Every lane read, checked, then handed to the one publisher as a set. Returning the publisher's own result
// rather than a second summary keeps one set of gates: this script adds the lane identity check and nothing that
// could disagree with the publisher about freshness, cadence or what the served branch already carries.
function publishLanes(options, deps = {}) {
  const configPath = path.resolve(REPO_ROOT, options.config);
  const lanesFile = loadLanes(configPath);
  const artifacts = [];
  const extras = [];
  const lanes = [];

  for (const lane of lanesFile.lanes) {
    const source = laneArtifactPath(lane);
    if (!lane.enabled) {
      lanes.push({
        id: lane.id,
        label: lane.label,
        artifact: source,
        published: lane.published,
        status: "disabled",
        reason: "the lanes file marks this lane disabled, so it is not read and not published"
      });
      continue;
    }
    if (!fs.existsSync(source)) {
      return {
        action: "refuse",
        reason: `${lane.label} has no snapshot at ${source}`,
        lanes: lanes.concat([
          { id: lane.id, label: lane.label, artifact: source, published: lane.published, status: "missing" }
        ])
      };
    }
    let feed = null;
    try {
      feed = JSON.parse(fs.readFileSync(source, "utf8"));
    } catch (error) {
      return {
        action: "refuse",
        reason: `${lane.label} has a snapshot at ${source} that is not readable JSON: ${String(
          error.message || error
        ).slice(0, 120)}`,
        lanes: lanes.concat([
          { id: lane.id, label: lane.label, artifact: source, published: lane.published, status: "unreadable" }
        ])
      };
    }
    const identity = identityCheck(lane, feed);
    if (!identity.ok) {
      return {
        action: "refuse",
        reason: identity.reason,
        lanes: lanes.concat([
          {
            id: lane.id,
            label: lane.label,
            artifact: source,
            published: lane.published,
            status: "identity_mismatch",
            identity
          }
        ])
      };
    }
    lanes.push({
      id: lane.id,
      label: lane.label,
      artifact: source,
      published: lane.published,
      generated_at_utc: feed.generated_at_utc ?? null,
      identity,
      status: "published"
    });
    artifacts.push({ label: lane.id, source, target: lane.published });

    // The lane's own heartbeat, when its trader has written one. It is carried in the same commit as the
    // snapshot, so the page can say whether a loop is alive behind the account it draws. It is held to the same
    // identity as the snapshot: a heartbeat naming another account would be as misleading as a snapshot from one.
    const statusSource = path.resolve(REPO_ROOT, lane.root, lane.trader_status);
    if (!fs.existsSync(statusSource)) {
      lanes[lanes.length - 1].trader_status = {
        published: null,
        reason: `no heartbeat at ${statusSource}: the trader has not run in this checkout yet`
      };
      continue;
    }
    let status = null;
    try {
      status = JSON.parse(fs.readFileSync(statusSource, "utf8"));
    } catch (error) {
      return {
        action: "refuse",
        reason: `${lane.label} has a trader heartbeat at ${statusSource} that is not readable JSON: ${String(
          error.message || error
        ).slice(0, 120)}`,
        lanes
      };
    }
    if (typeof status?.lane !== "string" || status.lane !== lane.id) {
      return {
        action: "refuse",
        reason: `${lane.label} has a trader heartbeat that names lane ${JSON.stringify(
          status?.lane ?? null
        )}, where this lane is ${lane.id}`,
        lanes
      };
    }
    const statusMasked = status?.account?.login_masked ?? null;
    if (lane.account_login_masked && statusMasked && statusMasked !== lane.account_login_masked) {
      return {
        action: "refuse",
        reason: `${lane.label} has a trader heartbeat from account ${statusMasked}, where the lanes file says ${lane.account_login_masked}`,
        lanes
      };
    }
    const statusServer = status?.account?.server ?? null;
    if (lane.account_server && statusServer && statusServer !== lane.account_server) {
      return {
        action: "refuse",
        reason: `${lane.label} has a trader heartbeat from server ${statusServer}, where the lanes file says ${lane.account_server}`,
        lanes
      };
    }
    lanes[lanes.length - 1].trader_status = {
      published: lane.status_published,
      written_at_utc: status.written_at_utc ?? status.at_utc ?? null,
      at_utc: status.at_utc ?? null,
      armed: status.armed === true,
      status: status.status ?? null,
      // The machine that wrote the heartbeat, as the heartbeat itself names it. The publisher does not stamp its
      // own name here: during a cutover the publisher and the loop can be on different hosts, and the page has
      // to see the host of the loop rather than the host of the commit.
      host: typeof status?.host?.computer === "string" ? status.host.computer : null,
      expected_interval_seconds:
        status?.expected_interval_seconds !== null &&
        status?.expected_interval_seconds !== undefined &&
        Number.isFinite(Number(status.expected_interval_seconds)) &&
        Number(status.expected_interval_seconds) > 0
          ? Number(status.expected_interval_seconds)
          : null
    };
    extras.push({ label: lane.id, source: statusSource, target: lane.status_published });
  }

  if (!artifacts.length) {
    return {
      action: "refuse",
      reason: `every lane in ${configPath} is disabled, so there is nothing to publish`,
      lanes
    };
  }

  // The lanes document the page reads: which accounts exist, which of them are deployed, where each one's
  // snapshot and heartbeat live, and what each lane's own publisher run made of it. It is written to tmp/ and
  // copied into the publish checkout by the one publisher, so the page is told about a lane in the same commit
  // that first serves it.
  const generatedAt = new Date((deps.now || Date.now)()).toISOString();
  const summary = {
    schema_version: LANES_SCHEMA_VERSION,
    generated_at_utc: generatedAt,
    publisher: "scripts/publish-live-trading-lanes.js",
    note: "One row per FTMO account, as the lanes publisher read the file on this run. `enabled: false` is a lane that is parked rather than broken: nothing is published for it and no loop trades it. A lane's snapshot and trader heartbeat are files on the machine holding that lane's terminal; this document and those files travel together in one commit.",
    lanes: lanesFile.lanes.map((lane) => {
      const row = lanes.find((entry) => entry.id === lane.id) || {};
      return {
        id: lane.id,
        label: lane.label,
        enabled: lane.enabled,
        feed: lane.published,
        trader_status: row.trader_status?.published ?? null,
        account_login_masked: row.identity?.account_login_masked ?? lane.account_login_masked ?? null,
        account_server: row.identity?.account_server ?? lane.account_server ?? null,
        generated_at_utc: row.generated_at_utc ?? null,
        status: row.status ?? "disabled",
        trader: row.trader_status ?? { published: null, reason: "the lane is disabled, so no trader runs it" }
      };
    })
  };
  const summaryPath = path.join(REPO_ROOT, "tmp", "live-trading-lanes-summary.json");
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  extras.push({ label: null, source: summaryPath, target: lanesFile.summary });

  const result = publisher.publishFeed(
    {
      feed: artifacts[0].source,
      artifacts,
      extras,
      checkout: options.checkout,
      remote: options.remote,
      branch: options.branch,
      minIntervalSeconds:
        options.minIntervalSeconds ?? lanesFile.minIntervalSeconds ?? publisher.DEFAULT_MIN_INTERVAL_SECONDS,
      state: options.state ?? lanesFile.state ?? publisher.DEFAULT_STATE,
      force: options.force === true,
      dryRun: options.dryRun === true,
      json: options.json === true,
      help: false
    },
    deps
  );

  return { ...result, lanes };
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
  let result = null;
  try {
    result = publishLanes(options, deps);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${error.message}\n\n${USAGE}\n`);
      return 2;
    }
    throw error;
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.published || ["unchanged", "too_soon", "would_publish"].includes(result.action) ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  REPO_ROOT,
  DEFAULT_CONFIG,
  USAGE,
  UsageError,
  parseArgs,
  loadLanes,
  laneArtifactPath,
  identityCheck,
  publishLanes,
  main
};
