// Tests for CTRADER_SECRETS_20261114.js: the vault the owner asked for, DPAPI under the relay's own user.
//
// The fake runner stands in for PowerShell so every rule can be checked without Windows; one final test does the
// real DPAPI round trip on the machine that has it, and skips elsewhere.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const secrets = require("./CTRADER_SECRETS_20261114.js");

const SAMPLE = {
  clientId: "fixture-client-id",
  clientSecret: "fixture-client-secret",
  accessToken: "fixture-access-token",
  refreshToken: "fixture-refresh-token",
  accessTokenExpiresAtUtc: "2026-11-14T12:00:00.000Z"
};

// The same shape as DPAPI from the module's point of view: text in, base64 out, reversible only by this runner.
function fakeRunner() {
  const calls = [];
  const run = (script, input) => {
    calls.push({ script, input });
    if (script === secrets.POWERSHELL.protect) return Buffer.from(`fake:${input}`, "utf8").toString("base64");
    if (script === secrets.POWERSHELL.unprotect) {
      const text = Buffer.from(input, "base64").toString("utf8");
      if (!text.startsWith("fake:")) throw new Error("not sealed by this runner");
      return text.slice("fake:".length);
    }
    throw new Error("unexpected script");
  };
  return { run, calls };
}

function tempVaultPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-vault-"));
  return { dir, file: path.join(dir, "ctrader.vault.json") };
}

test("the vault path refuses the plaintext files the earlier proposal named", () => {
  for (const name of ["credentials.env", "tokens.json", "app.env", "C:\\relay\\credentials.env", "x/TOKENS.JSON"]) {
    assert.throws(() => secrets.assertVaultPath(name), (err) => err.code === "plaintext_path_refused", name);
  }
  assert.equal(secrets.assertVaultPath("C:\\relay\\state\\ctrader.vault.json"), "C:\\relay\\state\\ctrader.vault.json");
  assert.throws(() => secrets.assertVaultPath(""), (err) => err.code === "vault_path_missing");
});

test("a sealed vault round trips, and the file holds no plaintext", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run, user: "relay-user" });
    const written = secrets.writeVault({ path: file, secrets: SAMPLE, store, fs, now: () => Date.UTC(2026, 10, 14, 9, 0, 0) });
    assert.equal(written.scope, "dpapi-current-user");
    assert.equal(written.user, "relay-user");
    assert.equal(written.createdAtUtc, "2026-11-14T09:00:00.000Z");

    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(text, /fixture-client-secret/);
    assert.doesNotMatch(text, /fixture-access-token/);
    const record = JSON.parse(text);
    assert.equal(record.version, 1);
    assert.equal(record.scope, "dpapi-current-user");
    assert.ok(record.sealed.length > 20);

    const { secrets: read, meta } = secrets.readVault({ path: file, store, fs });
    assert.deepEqual(read, SAMPLE);
    assert.equal(meta.user, "relay-user");
    assert.equal(meta.createdAtUtc, "2026-11-14T09:00:00.000Z");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the vault is written by rename, so no temporary file is left behind", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run });
    secrets.writeVault({ path: file, secrets: SAMPLE, store, fs });
    assert.deepEqual(fs.readdirSync(dir), ["ctrader.vault.json"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing vault says so, rather than looking like a corrupt one", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run });
    assert.throws(() => secrets.readVault({ path: file, store, fs }), (err) => err.code === "vault_missing");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a vault sealed for another scope, or in another version, is refused", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run });
    fs.writeFileSync(file, JSON.stringify({ version: 1, scope: "local-machine", sealed: "ZmFrZTp7fQ==" }));
    assert.throws(() => secrets.readVault({ path: file, store, fs }), (err) => err.code === "vault_scope_unsupported");
    fs.writeFileSync(file, JSON.stringify({ version: 2, scope: "dpapi-current-user", sealed: "ZmFrZTp7fQ==" }));
    assert.throws(() => secrets.readVault({ path: file, store, fs }), (err) => err.code === "vault_version_unsupported");
    fs.writeFileSync(file, "not json at all");
    assert.throws(() => secrets.readVault({ path: file, store, fs }), (err) => err.code === "vault_corrupt");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("incomplete secrets are not written at all", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run });
    const partial = { clientId: "only-this" };
    assert.throws(() => secrets.writeVault({ path: file, secrets: partial, store, fs }), (err) => {
      assert.equal(err.code, "secret_missing");
      assert.deepEqual(err.missing, ["clientSecret", "accessToken"]);
      return true;
    });
    assert.equal(fs.existsSync(file), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test("the entry point reads one JSON document from stdin and answers with a summary, never a secret", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run });
    const summary = secrets.putFromStdin({ path: file, store, fs, readStdin: () => JSON.stringify(SAMPLE) });
    assert.equal(summary.path, file);
    assert.equal(Object.keys(summary).sort().join(","), "createdAtUtc,path,scope,sealedLength,user");
    assert.doesNotMatch(JSON.stringify(summary), /fixture-client-secret/);
    assert.throws(
      () => secrets.putFromStdin({ path: file, store, fs, readStdin: () => "clientSecret=oops" }),
      (err) => err.code === "stdin_not_json"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the app credentials can be sealed before consent, and a pending vault is refused by every reader", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run, user: "relay-user" });
    const app = { clientId: "fixture-client-id", clientSecret: "fixture-client-secret" };
    const summary = secrets.putAppFromStdin({ path: file, store, fs, readStdin: () => JSON.stringify(app) });
    assert.equal(summary.pending, true);
    assert.equal(summary.path, file);
    assert.equal(summary.clientId, secrets.mask("fixture-client-id"));
    assert.ok(!JSON.stringify(summary).includes("fixture-client-secret"), "the summary carries no secret");
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /fixture-client-secret/, "the file carries no plaintext");

    assert.throws(
      () => secrets.readVault({ path: file, store, fs }),
      (err) => {
        assert.equal(err.code, "token_missing");
        assert.deepEqual(err.missing, ["accessToken"]);
        return true;
      }
    );
    const opened = secrets.readVault({ path: file, store, fs, pending: true });
    assert.deepEqual(opened.secrets, {
      clientId: "fixture-client-id",
      clientSecret: "fixture-client-secret",
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAtUtc: null
    });
    assert.equal(opened.meta.user, "relay-user");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("put-app refuses anything but one client id and one secret, and writes nothing when it does", () => {
  const { dir, file } = tempVaultPath();
  try {
    const { run } = fakeRunner();
    const store = secrets.createDpapiStore({ runPowerShell: run });
    const attempt = (document) => () => secrets.putAppFromStdin({ path: file, store, fs, readStdin: () => document });
    assert.throws(attempt("clientSecret=oops"), (err) => err.code === "stdin_not_json");
    assert.throws(attempt("[]"), (err) => err.code === "stdin_not_json");
    assert.throws(attempt(JSON.stringify({ clientId: "only-this" })), (err) => {
      assert.equal(err.code, "secret_missing");
      assert.deepEqual(err.missing, ["clientSecret"]);
      return true;
    });
    assert.throws(
      attempt(JSON.stringify({ clientId: "a", clientSecret: "b", accessToken: "c" })),
      (err) => err.code === "unknown_field" && err.fields.includes("accessToken")
    );
    assert.equal(fs.existsSync(file), false, "a refused document leaves no vault behind");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a PowerShell that fails is reported as such, with its own words", () => {
  const runner = secrets.createPowerShellRunner({
    spawnSync: () => ({ status: 1, stdout: "", stderr: "Cannot find type [Security.Cryptography.ProtectedData]" })
  });
  assert.throws(() => runner(secrets.POWERSHELL.protect, "x"), (err) => {
    assert.equal(err.code, "powershell_failed");
    assert.equal(err.exitCode, 1);
    assert.match(err.stderr, /ProtectedData/);
    return true;
  });
});

test("PowerShell is given the script, and the secret only on stdin", () => {
  let seen = null;
  const runner = secrets.createPowerShellRunner({
    spawnSync: (file, args, options) => {
      seen = { file, args, options };
      return { status: 0, stdout: "Y2lwaGVy", stderr: "" };
    }
  });
  const blob = runner(secrets.POWERSHELL.protect, "a-secret-value");
  assert.equal(blob.trim(), "Y2lwaGVy");
  assert.equal(seen.file, "powershell.exe");
  assert.ok(seen.args.includes("-NoProfile"));
  assert.ok(seen.args.includes("-NonInteractive"));
  assert.equal(seen.options.input, "a-secret-value");
  assert.ok(!seen.args.join(" ").includes("a-secret-value"), "the secret must not be on the command line");
  assert.ok(seen.args.join(" ").includes("CurrentUser"), "the scope must be current-user");
});

test("mask never shows more than the last four characters", () => {
  assert.equal(secrets.mask(""), "");
  assert.equal(secrets.mask("ab"), "**");
  assert.equal(secrets.mask("app-secret-abcd"), "***********abcd");
  assert.equal(secrets.mask(null), "");
});

test("the real DPAPI protects and unprotects on this machine, and skips where it is absent", (t) => {
  if (process.platform !== "win32") {
    t.skip("DPAPI is a Windows feature");
    return;
  }
  let run;
  try {
    run = secrets.createPowerShellRunner({ timeoutMs: 60000 });
  } catch (err) {
    t.skip(`PowerShell is not available here: ${err.message}`);
    return;
  }
  const value = `synthetic-round-trip-${Date.now()}`;
  let sealed;
  try {
    sealed = secrets.sealValue({ value, runPowerShell: run });
  } catch (err) {
    t.skip(`DPAPI is not available to this user: ${err.message}`);
    return;
  }
  assert.match(sealed, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(!sealed.includes("synthetic"), "the ciphertext must not contain the plaintext");
  assert.equal(secrets.unsealValue({ blob: sealed, runPowerShell: run }), value);

  // And the store the relay uses round trips the vault's own document too.
  const store = secrets.createDpapiStore({ runPowerShell: run });
  assert.deepEqual(store.unseal(store.seal(SAMPLE)), SAMPLE);
});

// The operator entry point: client id and secret from the session, the token pair from the consent file, and the
// plaintext file gone once the sealed copy exists.
function writeConsentFile(dir, tokens) {
  const file = path.join(dir, "tokens.json");
  fs.writeFileSync(file, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  return file;
}

test("the operator command refuses an incomplete invocation before reading anything", () => {
  const bare = secrets.readCliConfig({ env: {}, argv: [] });
  assert.equal(bare.vaultPath, null);
  assert.ok(bare.refusals.some((refusal) => refusal.startsWith("vault_missing")));
  assert.ok(bare.refusals.some((refusal) => refusal.startsWith("source_missing")));
  assert.ok(bare.refusals.some((refusal) => refusal.startsWith("client_id_missing")));
  assert.ok(bare.refusals.some((refusal) => refusal.startsWith("client_secret_missing")));

  const unknown = secrets.readCliConfig({ env: { CTRADER_CLIENT_ID: "a", CTRADER_CLIENT_SECRET: "b" }, argv: ["put", "--vault", "v.vault.json", "--from", "tokens.json", "--wat"] });
  assert.deepEqual(unknown.refusals, ["unknown_argument:--wat"]);

  const result = secrets.importVault({ config: bare, store: secrets.createDpapiStore({ runPowerShell: fakeRunner().run }), fs });
  assert.equal(result.ok, false);
  assert.match(result.refusals.join(","), /vault_missing/);
});

test("put-app needs no environment and no token file, only a vault path", () => {
  const config = secrets.readCliConfig({ env: {}, argv: ["put-app", "--vault", "C:\\ProgramData\\ctrader-relay\\secrets\\ctrader.vault.json"] });
  assert.equal(config.mode, "put-app");
  assert.deepEqual(config.refusals, [], "put-app must not ask for the environment or --from");
  assert.equal(config.from, null);

  const bare = secrets.readCliConfig({ env: {}, argv: ["put-app"] });
  assert.equal(bare.mode, "put-app");
  assert.deepEqual(bare.refusals, ["vault_missing:pass --vault, ending in .vault.json"]);

  const plaintext = secrets.readCliConfig({ env: {}, argv: ["put-app", "--vault", "C:\\relay\\credentials.env"] });
  assert.deepEqual(plaintext.refusals, [], "the path rule is enforced when the vault is written, not before");
  assert.throws(
    () => secrets.putAppFromStdin({
      path: plaintext.vaultPath,
      store: secrets.createDpapiStore({ runPowerShell: fakeRunner().run }),
      fs,
      readStdin: () => JSON.stringify({ clientId: "a", clientSecret: "b" })
    }),
    (err) => err.code === "plaintext_path_refused"
  );

  const put = secrets.readCliConfig({ env: {}, argv: ["put"] });
  assert.equal(put.mode, "put");
  assert.ok(put.refusals.some((refusal) => refusal.startsWith("source_missing")), "put keeps its own rules");
});

test("the consent file is sealed into the vault, summarised without secrets, and then removed", () => {
  const { dir, file } = tempVaultPath();
  try {
    const consent = writeConsentFile(dir, {
      accessToken: "fixture-access-token",
      refreshToken: "fixture-refresh-token",
      expiresAtMs: Date.UTC(2026, 10, 14, 12, 0, 0),
      tokenType: "bearer"
    });
    const store = secrets.createDpapiStore({ runPowerShell: fakeRunner().run, user: "relay-user" });
    const config = secrets.readCliConfig({
      env: { CTRADER_CLIENT_ID: "fixture-client-id", CTRADER_CLIENT_SECRET: "fixture-client-secret" },
      argv: ["put", "--vault", file, "--from", consent, "--delete-source"]
    });
    const result = secrets.importVault({ config, store, fs, now: () => Date.UTC(2026, 10, 14, 11, 0, 0) });
    assert.equal(result.ok, true);
    assert.equal(result.scope, secrets.VAULT_SCOPE);
    assert.equal(result.user, "relay-user");
    assert.equal(result.accessTokenExpiresAtUtc, "2026-11-14T12:00:00.000Z");
    assert.equal(result.hasRefreshToken, true);
    assert.equal(result.sourceDeleted, true);
    assert.equal(fs.existsSync(consent), false, "the plaintext token file must be gone");
    assert.equal(result.accessToken, secrets.mask("fixture-access-token"), "the summary carries only the mask");
    assert.ok(!JSON.stringify(result).includes("fixture-access-token"));

    const onDisk = fs.readFileSync(file, "utf8");
    assert.ok(!onDisk.includes("fixture-access-token"));
    assert.ok(!onDisk.includes("fixture-client-secret"));
    const { secrets: stored, meta } = secrets.readVault({ path: file, store, fs });
    assert.deepEqual(stored, {
      clientId: "fixture-client-id",
      clientSecret: "fixture-client-secret",
      accessToken: "fixture-access-token",
      refreshToken: "fixture-refresh-token",
      accessTokenExpiresAtUtc: "2026-11-14T12:00:00.000Z"
    });
    assert.equal(meta.user, "relay-user");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("without --delete-source the consent file is left alone, and a bad vault name is refused", () => {
  const { dir, file } = tempVaultPath();
  try {
    const consent = writeConsentFile(dir, { accessToken: "a-token", refreshToken: "r-token", expiresAtMs: Date.UTC(2026, 11, 1) });
    const store = secrets.createDpapiStore({ runPowerShell: fakeRunner().run });
    const kept = secrets.importVault({
      config: secrets.readCliConfig({
        env: { CTRADER_CLIENT_ID: "id", CTRADER_CLIENT_SECRET: "secret" },
        argv: ["put", "--vault", file, "--from", consent]
      }),
      store,
      fs
    });
    assert.equal(kept.sourceDeleted, false);
    assert.equal(fs.existsSync(consent), true);

    assert.throws(
      () => secrets.importVault({
        config: secrets.readCliConfig({
          env: { CTRADER_CLIENT_ID: "id", CTRADER_CLIENT_SECRET: "secret" },
          argv: ["put", "--vault", path.join(dir, "tokens.json"), "--from", consent]
        }),
        store,
        fs
      }),
      (err) => err.code === "plaintext_path_refused"
    );

    assert.throws(
      () => secrets.importVault({
        config: secrets.readCliConfig({
          env: { CTRADER_CLIENT_ID: "id", CTRADER_CLIENT_SECRET: "secret" },
          argv: ["put", "--vault", file, "--from", path.join(dir, "absent.json")]
        }),
        store,
        fs
      }),
      (err) => err.code === "token_file_unreadable"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

