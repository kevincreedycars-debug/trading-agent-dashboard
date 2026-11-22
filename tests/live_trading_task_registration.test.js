"use strict";

// What a registration would write, proved without registering anything. `-Show` builds the two command lines and the
// plan in memory and writes neither the wrapper nor the task, so these cases can run against the working tree on any
// machine with PowerShell and answer the one question that has actually been got wrong before: which caps the live
// lane carries. The owner removed the strategy-imposed daily entry limit on all three accounts on 2026-11-14, so a
// registration that names no `-MaxPerDay` has to state `--max-per-day unlimited` - the word, not an absent flag, so
// that a restart or a re-registration cannot quietly bring four a day back.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const script = path.join(root, "scripts", "register-live-trading-trader-task.ps1");
const windowsOnly = process.platform === "win32" ? test : test.skip;

function show(extraArgs, { taskName = "LiveTradingTraderTick-RegistrationProbe" } = {}) {
  const run = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-Show",
      "-TaskName",
      taskName,
      ...extraArgs
    ],
    { cwd: root, encoding: "utf8", timeout: 120000 }
  );
  return { code: run.status, out: `${run.stdout || ""}`, err: `${run.stderr || ""}` };
}

windowsOnly("a registration that names no cap writes the loop's own no-cap, and never four a day", () => {
  const run = show(["-Lane", "ftmo-1"]);

  assert.equal(run.code, 0, run.err || run.out);
  // The plan's own row, then the command line the task would actually carry.
  assert.match(run.out, /max_per_day\s+=\s+unlimited \(no strategy cap, owner 2026-11-14\)/);
  assert.match(run.out, /--max-per-day unlimited/);
  // The removed default must not survive anywhere on the line: four entries a day was a count kept beside the rule.
  assert.doesNotMatch(run.out, /--max-per-day 4(\s|")/);
});

windowsOnly("a hand cap is written only when it is asked for, and the plan states it as one", () => {
  const run = show(["-Lane", "ftmo-1", "-MaxPerDay", "2"]);

  assert.equal(run.code, 0, run.err || run.out);
  assert.match(run.out, /max_per_day\s+=\s+2/);
  assert.match(run.out, /--max-per-day 2(\s|")/);
  assert.doesNotMatch(run.out, /--max-per-day unlimited/);
});

windowsOnly("lane 3's registration keeps the blind rule, its own magic, its identity file and the publisher", () => {
  // The publisher path is this checkout and the identity file is a throwaway one, so the resolution the script performs
  // is the one a host would perform rather than a stub: both have to exist before a task may name them.
  const fs = require("node:fs");
  const os = require("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "registration-identity-"));
  const identityPath = path.join(dir, "lane-ftmo3-identity.json");
  fs.writeFileSync(identityPath, JSON.stringify({ login: 1, server: "FTMO-Server3" }), "utf8");

  const run = show([
    "-Lane",
    "ftmo-3",
    "-Blind",
    "-Magic",
    "20261006",
    "-ExpectIdentity",
    identityPath,
    "-Published",
    root,
    "-Arm"
  ]);

  assert.equal(run.code, 0, run.err || run.out);
  const loop = run.out.split(/\r?\n/).find(line => line.includes("run-live-trading-trader.js"));
  assert.ok(loop, "the plan states the loop command line it would write");
  assert.match(loop, /--lane "?ftmo-3"?/);
  assert.match(loop, /--blind /);
  assert.match(loop, /--magic 20261006/);
  const quotedIdentity = identityPath.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  assert.match(loop, new RegExp(`--expect-identity "?${quotedIdentity}"?`));
  assert.match(loop, /--published "/);
  assert.match(loop, /--max-per-day unlimited/);
  assert.match(run.out, /rule\s+=\s+blind: two watched lines, no Layer 1 call/);
});

windowsOnly("a called lane cannot be registered with the blind rule, and the refusal names the flag", () => {
  // -Blind against a lane whose row trades the Layer 1 call would write a command line its own account does not
  // describe. The plan is refused before anything is written, and the message is what tells the operator which flag.
  const run = show(["-Lane", "ftmo-1", "-Blind"]);

  assert.notEqual(run.code, 0);
  assert.match(`${run.err}${run.out}`, /-Blind/);
});

windowsOnly("-Show registers nothing and writes no wrapper", () => {
  const before = (() => {
    try {
      return require("node:fs").readFileSync(path.join(root, "tmp", "live-trading-trader-run.cmd"), "utf8");
    } catch {
      return null;
    }
  })();
  const run = show(["-Lane", "ftmo-1", "-Arm"]);

  assert.equal(run.code, 0, run.err || run.out);
  const after = (() => {
    try {
      return require("node:fs").readFileSync(path.join(root, "tmp", "live-trading-trader-run.cmd"), "utf8");
    } catch {
      return null;
    }
  })();
  assert.equal(after, before, "a read-only plan leaves the live wrapper exactly as it found it");
  // And the armed flag is stated as a plan, not applied.
  assert.match(run.out, /armed\s+=\s+true/);
});
