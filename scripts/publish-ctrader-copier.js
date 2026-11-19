// Publishes the cTrader copier's document as one data file on the branch Pages serves.
//
// This is deliberately the same engine the live feed uses - `scripts/publish-live-trading-feed.js` - rather than
// a second publisher with its own gates. It contributes its own validator (the copier document is not a feed) and
// its own artifact path, and takes the engine's freshness, strictly-newer, cadence, lock, checkout reset and
// push-retry behaviour unchanged. One publisher per file, and the copier's file is this one's only target.
//
//   node scripts/publish-ctrader-copier.js --feed C:\ProgramData\ctrader-relay\copier\dashboard.json \
//     --checkout C:\live-trading\ctrader-publish --state C:\ProgramData\ctrader-relay\copier\publish-state.json
//
// The cadence gate defaults to 1200s: the LANES publisher already spends publishes on the same Pages site, and
// GitHub documents a soft limit of ten builds an hour for a branch-built site. Three an hour from here leaves
// room for that one, and the tab states the cadence it is reading.
"use strict";

const fs = require("node:fs");
const feedPublisher = require("./publish-live-trading-feed.js");
const { validateLiveCtraderCopier } = require("./validate_live_ctrader_copier.js");

const TARGET = "data/live-ctrader-copier.json";
const DEFAULT_STATE = "tmp/live-ctrader-copier-publish-state.json";
const DEFAULT_MIN_INTERVAL_SECONDS = 1200;

const USAGE = [
  "Usage: node scripts/publish-ctrader-copier.js --feed <file> [options]",
  "",
  "  --feed <path>                 the document to publish (required)",
  "  --checkout <path>             the publish checkout, reset to the remote branch each run",
  "  --remote <name>               git remote (default origin)",
  "  --branch <name>               branch Pages serves (default main)",
  "  --min-interval-seconds <n>    fastest cadence allowed between publishes (default 1200)",
  "  --state <path>                where the last publish is recorded",
  "  --lock <path>                 the lock this publisher holds (default: beside the state file)",
  "  --force                       publish now even if the interval gate says wait",
  "  --dry-run                     run every gate and every read, then stop before writing or pushing",
  "  --json                        print the result as one JSON line",
  "  --help                        print this text",
  "",
  "  Exit 0 when the document is published or already current, 1 when a gate refused or git failed."
].join("\n");

function parseArgs(argv) {
  const options = {
    remote: feedPublisher.DEFAULT_REMOTE,
    branch: feedPublisher.DEFAULT_BRANCH,
    minIntervalSeconds: DEFAULT_MIN_INTERVAL_SECONDS,
    state: DEFAULT_STATE,
    json: true,
    help: false
  };
  const queue = argv.slice();
  const take = () => (queue.length ? queue.shift() : null);
  while (queue.length) {
    const arg = queue.shift();
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--feed") options.feed = take();
    else if (arg === "--checkout") options.checkout = take();
    else if (arg === "--remote") options.remote = take();
    else if (arg === "--branch") options.branch = take();
    else if (arg === "--min-interval-seconds") options.minIntervalSeconds = Number(take());
    else if (arg === "--state") options.state = take();
    else if (arg === "--lock") options.lock = take();
    else throw Object.assign(new Error(`unknown argument ${arg}`), { code: "argument_unknown" });
  }
  return options;
}

function publish(options, deps = {}) {
  if (!options.feed) throw Object.assign(new Error("--feed is required"), { code: "feed_missing" });
  // The commit subject names this document rather than the lane feed: a reader of the history should not have to
  // open the commit to learn that it carried the copier's read.
  let subject = null;
  try {
    const document = JSON.parse(fs.readFileSync(options.feed, "utf8"));
    subject = `live-trading: publish the cTrader copier read for ${document.generated_at_utc || "<unknown>"}, data file only`;
  } catch (error) {
    subject = null;
  }
  return feedPublisher.publishFeed(
    {
      feed: options.feed,
      artifacts: [{ label: "ctrader-copier", source: options.feed, target: TARGET }],
      extras: [],
      checkout: options.checkout,
      remote: options.remote,
      branch: options.branch,
      minIntervalSeconds: options.minIntervalSeconds,
      state: options.state,
      lock: options.lock,
      force: options.force === true,
      dryRun: options.dryRun === true,
      commitSubject: subject,
      json: true,
      help: false
    },
    { ...deps, validate: deps.validate || validateLiveCtraderCopier }
  );
}

function main(argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const result = publish(options, deps);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.action === "published" || result.action === "unchanged" || result.action === "would_publish" ? 0 : 1;
}

module.exports = { TARGET, DEFAULT_STATE, DEFAULT_MIN_INTERVAL_SECONDS, USAGE, parseArgs, publish };

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`failed: ${error.code || "error"}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
