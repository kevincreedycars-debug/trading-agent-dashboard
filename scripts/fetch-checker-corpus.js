#!/usr/bin/env node
// Fetch the five Backtest Checker corpora into the ignored local cache.
//
// They are 56.7MB of an 80.4MB published tree, and Pages republishes the whole tree on every push rather than the
// files a publish changed, so they are frozen on `frozen/backtester-checker-20261107` and off `main`
// (docs/live-trading/DAILY_ALERT_EMAILS_20261107.md, section 3). The Backtest Checker sub-tab on the published page
// reads them from that branch directly and needs nothing from here. This is for the local work that reads them from
// disk - the confidence-calibration tests and the builders - which look in `.local/checker-corpus` first.
//
//   node scripts/fetch-checker-corpus.js [--force]
//
// Present files are left alone unless --force is given, so a second run costs five HEAD-free checks and no download.
// Each file is parsed before it is written: a truncated download would otherwise be cached as if it were a corpus.
const fs = require("node:fs");
const path = require("node:path");

const REPOSITORY = "kevincreedycars-debug/trading-agent-dashboard";
const FROZEN_BRANCH = "frozen/backtester-checker-20261107";
const FILES = Object.freeze([
  "backtester-checker-usd-24h-2024-01.json",
  "backtester-checker-eur-24h-2024-2026.json",
  "backtester-checker-gold-24h-2024-2026.json",
  "backtester-checker-nq-24h-2024-2026.json",
  "backtester-checker-btc-24h-2024-2026.json"
]);
const CACHE_DIR = path.resolve(__dirname, "../.local/checker-corpus");

async function main() {
  const force = process.argv.includes("--force");
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  let fetched = 0;
  for (const file of FILES) {
    const target = path.join(CACHE_DIR, file);
    if (!force && fs.existsSync(target)) {
      console.log(`present  ${file} (${fs.statSync(target).size} bytes)`);
      continue;
    }
    const url = `https://raw.githubusercontent.com/${REPOSITORY}/${FROZEN_BRANCH}/data/${file}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${file}: ${response.status} ${response.statusText} from ${url}`);
    }
    const body = await response.text();
    JSON.parse(body);
    fs.writeFileSync(target, body);
    fetched += 1;
    console.log(`fetched  ${file} (${Buffer.byteLength(body)} bytes)`);
  }
  console.log(`cache ${CACHE_DIR}: ${fetched} fetched, ${FILES.length - fetched} already present`);
}

main().catch((error) => {
  console.error(`fetch-checker-corpus: ${error.message}`);
  process.exitCode = 1;
});
