const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const sourceScannerPath = path.join(repoRoot, "scripts", "check-repo-for-secrets.ps1");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8"
  });

  if (options.expectStatus !== undefined) {
    assert.equal(
      result.status,
      options.expectStatus,
      `Expected ${command} ${args.join(" ")} to exit ${options.expectStatus}, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  assert.equal(result.error, undefined, result.error && result.error.message);
  return result;
}

function writeFile(root, relativePath, contents) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, "utf8");
}

function createScannerRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "secret-scanner-"));
  fs.mkdirSync(path.join(tempRoot, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "config"), { recursive: true });
  fs.copyFileSync(sourceScannerPath, path.join(tempRoot, "scripts", "check-repo-for-secrets.ps1"));
  fs.writeFileSync(
    path.join(tempRoot, "config", "secret-scan-allowlist.json"),
    JSON.stringify({
      version: "1.0.0",
      rules: [
        {
          path_regex: "^script\\.js$",
          line_regex: "researchSupabaseKey"
        }
      ]
    }, null, 2),
    "utf8"
  );
  run("git", ["init"], { cwd: tempRoot, expectStatus: 0 });
  run("git", ["config", "user.email", "scanner-tests@example.invalid"], { cwd: tempRoot, expectStatus: 0 });
  run("git", ["config", "user.name", "Scanner Tests"], { cwd: tempRoot, expectStatus: 0 });
  return tempRoot;
}

function runScanner(repoPath, args = [], options = {}) {
  return run(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(repoPath, "scripts", "check-repo-for-secrets.ps1"),
      ...args
    ],
    {
      cwd: repoPath,
      expectStatus: options.expectStatus
    }
  );
}

test("scanner detects placeholder secret patterns and ignores allowlisted publishable config", () => {
  const repoPath = createScannerRepo();
  writeFile(repoPath, "keys.txt", "-----BEGIN PRIVATE KEY-----\n");
  writeFile(repoPath, "github.txt", "ghp_FAKEPLACEHOLDERTOKENVALUE1234567890\n");
  writeFile(repoPath, "app.js", 'const N8N_API_KEY = "PLACEHOLDERSECRET123456";\n');
  writeFile(repoPath, "auth.txt", "Authorization: Bearer PLACEHOLDERBEARERTOKEN1234567890\n");
  writeFile(repoPath, ".env", "FRED_API_KEY=PLACEHOLDERENVVALUE123456\n");
  writeFile(repoPath, "script.js", 'const researchSupabaseKey = "sb_publishable_PLACEHOLDER123456";\n');
  writeFile(repoPath, "config.txt", "REQUEST_TIMEOUT_MS=30000\n");
  run("git", ["add", "."], { cwd: repoPath, expectStatus: 0 });

  const result = runScanner(repoPath, ["-Mode", "full"], { expectStatus: 1 });
  const stdout = result.stdout;

  assert.match(stdout, /private-key-header/);
  assert.match(stdout, /github-pat/);
  assert.match(stdout, /assignment-known-secret/);
  assert.match(stdout, /bearer-literal/);
  assert.match(stdout, /env-file-secret/);
  assert.doesNotMatch(stdout, /researchSupabaseKey/);
  assert.doesNotMatch(stdout, /sb_publishable_PLACEHOLDER123456/);
  assert.doesNotMatch(stdout, /REQUEST_TIMEOUT_MS/);
});

test("scanner full mode ignores untracked files unless explicit paths are supplied", () => {
  const repoPath = createScannerRepo();
  writeFile(repoPath, "tracked.txt", "SAFE_VALUE=1\n");
  run("git", ["add", "tracked.txt"], { cwd: repoPath, expectStatus: 0 });

  writeFile(repoPath, "untracked.env", "API_KEY=UNTRACKEDPLACEHOLDER123456\n");

  const fullResult = runScanner(repoPath, ["-Mode", "full"], { expectStatus: 0 });
  assert.match(fullResult.stdout, /No likely private secrets detected/);

  const explicitResult = runScanner(repoPath, ["-Mode", "full", "-Path", "untracked.env"], { expectStatus: 1 });
  assert.match(explicitResult.stdout, /assignment-known-secret|env-file-secret/);
});

test("scanner staged mode reads staged blob content rather than unstaged working tree content", () => {
  const repoPath = createScannerRepo();
  writeFile(repoPath, "staged.txt", "MODE=clean\n");
  run("git", ["add", "staged.txt"], { cwd: repoPath, expectStatus: 0 });
  run("git", ["commit", "-m", "baseline"], { cwd: repoPath, expectStatus: 0 });

  writeFile(repoPath, "staged.txt", 'const N8N_API_KEY = "STAGEDPLACEHOLDER123456";\n');
  run("git", ["add", "staged.txt"], { cwd: repoPath, expectStatus: 0 });
  writeFile(repoPath, "staged.txt", "MODE=working-tree-clean\n");

  const stagedResult = runScanner(repoPath, ["-Mode", "staged"], { expectStatus: 1 });
  assert.match(stagedResult.stdout, /staged\.txt/);
  assert.match(stagedResult.stdout, /assignment-known-secret/);

  const fullResult = runScanner(repoPath, ["-Mode", "full"], { expectStatus: 0 });
  assert.match(fullResult.stdout, /No likely private secrets detected/);
});

test("scanner quiet mode preserves exit status and suppresses normal output", () => {
  const repoPath = createScannerRepo();
  writeFile(repoPath, ".env", "API_KEY=QUIETPLACEHOLDER123456\n");
  run("git", ["add", ".env"], { cwd: repoPath, expectStatus: 0 });

  const failingQuiet = runScanner(repoPath, ["-Mode", "full", "-Quiet"], { expectStatus: 1 });
  assert.equal(failingQuiet.stdout.trim(), "");
  assert.equal(failingQuiet.stderr.trim(), "");

  writeFile(repoPath, ".env", "SAFE_VALUE=1\n");
  run("git", ["add", ".env"], { cwd: repoPath, expectStatus: 0 });

  const passingQuiet = runScanner(repoPath, ["-Mode", "full", "-Quiet"], { expectStatus: 0 });
  assert.equal(passingQuiet.stdout.trim(), "");
  assert.equal(passingQuiet.stderr.trim(), "");
});

test("scanner output never includes the matched placeholder value", () => {
  const repoPath = createScannerRepo();
  const fakeValue = "ghp_SHOULDNOTAPPEARINOUTPUT1234567890";
  writeFile(repoPath, "token.txt", `${fakeValue}\n`);
  run("git", ["add", "token.txt"], { cwd: repoPath, expectStatus: 0 });

  const result = runScanner(repoPath, ["-Mode", "full"], { expectStatus: 1 });
  assert.match(result.stdout, /github-pat/);
  assert.doesNotMatch(result.stdout, new RegExp(fakeValue));
  assert.equal(result.stderr.trim(), "");
});
