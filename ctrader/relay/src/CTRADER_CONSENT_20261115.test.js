// Tests for the consent command that seals the token pair into the vault. The loopback listener is real and runs
// on a free local port; the exchange runs against a fake fetch; the vault is a memory store, so no DPAPI call and
// no credential of any kind is touched.
//
//   node --test docs/strategy/proposals/CTRADER_CONSENT_20261115.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");

const consent = require(path.join(__dirname, "CTRADER_CONSENT_20261115.js"));
const oauth = require(path.join(__dirname, "CTRADER_OAUTH_20261114.js"));
const secrets = require(path.join(__dirname, "CTRADER_SECRETS_20261114.js"));

const CLIENT_ID = "12345";
const CLIENT_SECRET = "s3cret-app-value";
const ACCESS_TOKEN = "ACCESS-TOKEN-SECRET-1";
const REFRESH_TOKEN = "REFRESH-TOKEN-SECRET-1";
const CODE = "TEST-CODE-NOT-REAL";

function memoryStore({ user = "VPS\\relay" } = {}) {
  return {
    scope: "dpapi-current-user",
    user,
    sealed: null,
    seal(value) {
      this.sealed = JSON.stringify(value);
      return `sealed:${Buffer.from(this.sealed, "utf8").toString("base64")}`;
    },
    unseal(blob) {
      const text = String(blob);
      if (!text.startsWith("sealed:")) throw new Error("not a sealed value");
      return JSON.parse(Buffer.from(text.slice("sealed:".length), "base64").toString("utf8"));
    }
  };
}

function fakeFetch({ status = 200, body = {} } = {}) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body))
    };
  };
  impl.calls = calls;
  return impl;
}

const tokenBody = { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN, expiresIn: 2628000, tokenType: "bearer" };

async function freePort() {
  const server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function baseEnv(over = {}) {
  return { CTRADER_CLIENT_ID: CLIENT_ID, CTRADER_CLIENT_SECRET: CLIENT_SECRET, ...over };
}

function vaultFile(dir) {
  return path.join(dir, "ctrader.vault.json");
}

async function until(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("condition was not met in time");
}

test("the command defaults to the registered loopback redirect and the trading scope", () => {
  const config = consent.readConfig({ env: baseEnv(), argv: ["--vault", "C:\\ProgramData\\ctrader-relay\\secrets\\ctrader.vault.json"] });
  assert.deepEqual(config.refusals, []);
  assert.equal(config.port, oauth.CALLBACK_PORT);
  assert.equal(config.redirectUri, "http://127.0.0.1:8765/callback");
  assert.equal(config.scope, "trading");
  assert.equal(config.waitSeconds, consent.DEFAULT_WAIT_SECONDS);
  assert.equal(config.allowMissingState, false);
});

test("the command refuses a missing vault, a bad port, a bad scope, a bad wait and an unknown flag", () => {
  const bare = consent.readConfig({ env: {}, argv: [] });
  assert.ok(bare.refusals.some((r) => r.startsWith("vault_missing")));
  const badPort = consent.readConfig({ env: {}, argv: ["--vault=x", "--port=70000"] });
  assert.ok(badPort.refusals.some((r) => r.startsWith("port_invalid")));
  const badScope = consent.readConfig({ env: {}, argv: ["--vault=x", "--scope=admin"] });
  assert.ok(badScope.refusals.some((r) => r.startsWith("scope_invalid")));
  const badWait = consent.readConfig({ env: {}, argv: ["--vault=x", "--wait-seconds=0"] });
  assert.ok(badWait.refusals.some((r) => r.startsWith("wait_invalid")));
  const unknown = consent.readConfig({ env: {}, argv: ["--nonsense"] });
  assert.ok(unknown.refusals.some((r) => r.startsWith("unknown_argument")));
});

test("app credentials come from the session when there is no vault yet", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  try {
    const app = consent.resolveAppCredentials({ vaultPath: vaultFile(dir), env: baseEnv(), store: memoryStore(), fsImpl: fs });
    assert.equal(app.clientId, CLIENT_ID);
    assert.equal(app.clientSecret, CLIENT_SECRET);
    assert.equal(app.source, "environment");
    assert.equal(app.previous, null);
    assert.equal(app.meta, null);
    assert.deepEqual(app.missing, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an existing vault wins over the session and keeps its owner", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  try {
    const store = memoryStore({ user: "VPS\\relay" });
    const file = vaultFile(dir);
    secrets.writeVault({
      path: file,
      secrets: { clientId: "99999", clientSecret: "vault-secret", accessToken: "vault-token", refreshToken: "vault-refresh" },
      store,
      fs
    });
    const app = consent.resolveAppCredentials({ vaultPath: file, env: baseEnv(), store, fsImpl: fs });
    assert.equal(app.source, "vault");
    assert.equal(app.clientId, "99999");
    assert.equal(app.clientSecret, "vault-secret");
    assert.equal(app.meta.user, "VPS\\relay");
    assert.deepEqual(app.missing, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a pending vault supplies the app credentials, so consent needs no environment", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore({ user: "VPS\\relay" });
  const fetchImpl = fakeFetch({ body: tokenBody });
  try {
    const file = vaultFile(dir);
    secrets.putAppFromStdin({
      path: file,
      store,
      fs,
      readStdin: () => JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET })
    });
    assert.throws(
      () => secrets.readVault({ path: file, store, fs }),
      (err) => err.code === "token_missing",
      "before consent the vault must not pass for an authorised one"
    );

    const app = consent.resolveAppCredentials({ vaultPath: file, env: {}, store, fsImpl: fs });
    assert.equal(app.source, "vault");
    assert.equal(app.clientId, CLIENT_ID);
    assert.equal(app.clientSecret, CLIENT_SECRET);
    assert.deepEqual(app.missing, []);

    const { port, state, lines, running } = await startConsent({ dir, store, fetchImpl, env: {} });
    assert.equal(await callback(port, `code=${CODE}&state=${state}`), 200);
    const result = await running;
    assert.equal(result.ok, true, JSON.stringify(result));

    const opened = await readVaultOrNull(dir, store);
    assert.equal(opened.secrets.clientId, CLIENT_ID);
    assert.equal(opened.secrets.clientSecret, CLIENT_SECRET);
    assert.equal(opened.secrets.accessToken, ACCESS_TOKEN);
    assert.equal(opened.secrets.refreshToken, REFRESH_TOKEN);
    const printed = lines.join("\n");
    for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_SECRET]) {
      assert.equal(printed.includes(secret), false, "a secret must never reach the log");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a vault that cannot be read is treated as absent, not as a credential", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  try {
    const file = vaultFile(dir);
    fs.writeFileSync(file, "{}\n", "utf8");
    const app = consent.resolveAppCredentials({ vaultPath: file, env: baseEnv(), store: memoryStore(), fsImpl: fs });
    assert.equal(app.source, "environment");
    assert.equal(app.meta, null);
    const bare = consent.resolveAppCredentials({ vaultPath: path.join(dir, "nope.json"), env: {}, store: memoryStore(), fsImpl: fs });
    assert.deepEqual(bare.missing.map((m) => m.split(":")[0]), ["client_id_missing", "client_secret_missing"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Reads the link the command printed and follows it as the browser would, without a browser.
async function startConsent({ dir, store, fetchImpl, env = baseEnv(), extraArgv = [] }) {
  const lines = [];
  const port = await freePort();
  const config = consent.readConfig({ env, argv: ["--vault", vaultFile(dir), `--port=${port}`, ...extraArgv] });
  assert.deepEqual(config.refusals, [], `config refused: ${config.refusals.join(",")}`);
  const running = consent.runConsent({ config, deps: { store, fetchImpl, fs, env, log: (line) => lines.push(line) } });
  const link = await until(() => {
    const found = lines.find((line) => line.startsWith("consent link: "));
    return found ? found.slice("consent link: ".length) : null;
  });
  const state = new URL(link).searchParams.get("state");
  return { port, state, link, lines, running };
}

async function callback(port, query) {
  const response = await fetch(`http://127.0.0.1:${port}/callback?${query}`);
  return response.status;
}

async function readVaultOrNull(dir, store) {
  const file = vaultFile(dir);
  if (!fs.existsSync(file)) return null;
  return secrets.readVault({ path: file, store, fs });
}

test("a consent over loopback seals the token pair and prints no secret", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore();
  const fetchImpl = fakeFetch({ body: tokenBody });
  try {
    const { port, state, link, lines, running } = await startConsent({ dir, store, fetchImpl });
    const url = new URL(link);
    assert.equal(`${url.origin}${url.pathname}`, oauth.CONSENT_ENDPOINT);
    assert.equal(url.searchParams.get("client_id"), CLIENT_ID);
    assert.equal(url.searchParams.get("redirect_uri"), `http://127.0.0.1:${port}/callback`);
    assert.equal(url.searchParams.get("scope"), "trading");
    assert.match(state, /^[0-9a-f]{32}$/, "the state is generated here, not reused");

    assert.equal(await callback(port, `code=${CODE}&state=${state}`), 200);
    const result = await running;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.scope, "trading");
    assert.equal(result.vaultPath, vaultFile(dir));
    assert.equal(fetchImpl.calls.length, 1);
    assert.equal(new URL(fetchImpl.calls[0].url).searchParams.get("code"), CODE);

    const opened = await readVaultOrNull(dir, store);
    assert.equal(opened.secrets.clientId, CLIENT_ID);
    assert.equal(opened.secrets.clientSecret, CLIENT_SECRET);
    assert.equal(opened.secrets.accessToken, ACCESS_TOKEN);
    assert.equal(opened.secrets.refreshToken, REFRESH_TOKEN);
    assert.match(opened.secrets.accessTokenExpiresAtUtc, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(opened.meta.user, "VPS\\relay");

    const printed = lines.join("\n");
    for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, CLIENT_SECRET]) {
      assert.equal(printed.includes(secret), false, "a secret must never reach the log");
    }
    assert.ok(printed.includes(secrets.mask(CLIENT_ID)), "the client id is also printed masked, so logs pair up");
    assert.equal(fs.existsSync(path.join(dir, "tokens.json")), false, "the plaintext path is never touched");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a consent that is not granted ends the wait and seals nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore();
  const fetchImpl = fakeFetch({ body: tokenBody });
  try {
    const { port, state, lines, running } = await startConsent({ dir, store, fetchImpl });
    assert.equal(await callback(port, `error=access_denied&state=${state}`), 400);
    const result = await running;
    assert.equal(result.ok, false);
    assert.deepEqual(result.refusals, ["refused:consent_error"]);
    assert.equal(fetchImpl.calls.length, 0, "no code was exchanged");
    assert.equal(await readVaultOrNull(dir, store), null);
    assert.ok(lines.some((line) => line.startsWith("refused: cTrader reported")), lines.join("\n"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a redirect with the wrong state ends the wait and seals nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore();
  const fetchImpl = fakeFetch({ body: tokenBody });
  try {
    const { port, running } = await startConsent({ dir, store, fetchImpl });
    assert.equal(await callback(port, `code=${CODE}&state=not-our-state`), 403);
    const result = await running;
    assert.equal(result.ok, false);
    assert.deepEqual(result.refusals, ["refused:state_mismatch"]);
    assert.equal(fetchImpl.calls.length, 0);
    assert.equal(await readVaultOrNull(dir, store), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an exchange that fails leaves no vault behind", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore();
  const fetchImpl = fakeFetch({ status: 400, body: { error: "invalid_grant", errorDescription: "code expired" } });
  try {
    const { port, state, running } = await startConsent({ dir, store, fetchImpl });
    await callback(port, `code=${CODE}&state=${state}`);
    const result = await running;
    assert.equal(result.ok, false);
    assert.deepEqual(result.refusals, ["token_exchange_failed"]);
    assert.equal(await readVaultOrNull(dir, store), null, "a failed exchange must not overwrite an existing vault");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no callback inside the wait window ends the command and stores nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore();
  const fetchImpl = fakeFetch({ body: tokenBody });
  try {
    const { lines, running } = await startConsent({ dir, store, fetchImpl, extraArgv: ["--wait-seconds=0.3"] });
    const result = await running;
    assert.equal(result.ok, false);
    assert.deepEqual(result.refusals, ["callback_timeout"]);
    assert.ok(lines.some((line) => line.startsWith("no callback arrived in time")));
    assert.equal(await readVaultOrNull(dir, store), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("missing app credentials are reported before anything listens", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-consent-"));
  const store = memoryStore();
  const lines = [];
  try {
    const port = await freePort();
    const config = consent.readConfig({ env: {}, argv: ["--vault", vaultFile(dir), `--port=${port}`] });
    const result = await consent.runConsent({ config, deps: { store, fs, env: {}, log: (line) => lines.push(line) } });
    assert.equal(result.ok, false);
    assert.deepEqual(result.refusals.map((r) => r.split(":")[0]), ["client_id_missing", "client_secret_missing"]);
    assert.deepEqual(lines, [], "nothing is printed and no port is opened");
    assert.equal(await readVaultOrNull(dir, store), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a config that already refused never opens a listener", async () => {
  const store = memoryStore();
  const result = await consent.runConsent({ config: { refusals: ["vault_missing:pass --vault"] }, deps: { store } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.refusals, ["vault_missing:pass --vault"]);
});


