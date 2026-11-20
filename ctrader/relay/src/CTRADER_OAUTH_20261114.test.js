// Tests for the consent callback and the token exchange. The handler is called with fake request/response objects,
// the listener is exercised on an ephemeral loopback port with a synthetic code, and the exchange runs against a
// fake fetch. No real account, credential or browser is involved.
//
//   node --test docs/strategy/proposals/CTRADER_OAUTH_20261114.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");

const oauth = require(path.join(__dirname, "CTRADER_OAUTH_20261114.js"));

const STATE = "state-20261114-abcdef";
const CODE = "TEST-CODE-NOT-REAL";

function fakeRes() {
  const res = {
    status: null,
    headers: null,
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = String(body || "");
    }
  };
  return res;
}

function fakeReq(url, method = "GET") {
  return { method, url };
}

test("the callback url is read as three parameters", () => {
  const parsed = oauth.parseCallback(`/callback?code=${CODE}&state=${STATE}`);
  assert.equal(parsed.path, "/callback");
  assert.equal(parsed.code, CODE);
  assert.equal(parsed.state, STATE);
  assert.equal(oauth.parseCallback("/callback?error=access_denied&state=s").error, "access_denied");
});

test("the handler refuses anything but the registered path, method and state", async () => {
  const received = [];
  const refusals = [];
  const handler = oauth.createCallbackHandler({
    state: STATE,
    onCode: async (code) => received.push(code),
    onRefusal: (info) => refusals.push(info.reason)
  });
  assert.equal((await handler(fakeReq("/other?code=x&state=y"), fakeRes())).status, 404);
  assert.equal((await handler(fakeReq("/callback?code=x&state=y", "POST"), fakeRes())).status, 405);
  assert.equal((await handler(fakeReq(`/callback?error=access_denied&state=${STATE}`), fakeRes())).status, 400);
  assert.equal((await handler(fakeReq(`/callback?code=${CODE}&state=wrong-state-x`), fakeRes())).status, 403);
  assert.equal((await handler(fakeReq(`/callback?state=${STATE}`), fakeRes())).status, 400);
  assert.deepEqual(received, []);
  // Every refusal is named, so the command that is waiting can stop instead of sitting out its timeout. The two
  // that are not a consent attempt at all - another path, another method - are reported too; the command ignores
  // those and keeps listening.
  assert.deepEqual(refusals, ["path_mismatch", "method_not_allowed", "consent_error", "state_mismatch", "no_code"]);
  assert.equal(handler.stats().refusals, 5);
});

test("one good callback is accepted once and the code is never echoed", async () => {
  const received = [];
  const handler = oauth.createCallbackHandler({ state: STATE, onCode: async (code, meta) => received.push({ code, meta }) });
  const first = fakeRes();
  const firstResult = await handler(fakeReq(`/callback?code=${CODE}&state=${STATE}`), first);
  assert.equal(firstResult.status, 200);
  assert.equal(received.length, 1);
  assert.equal(received[0].code, CODE);
  assert.equal(received[0].meta.state, STATE);
  assert.equal(first.body.includes(CODE), false);
  assert.equal(first.headers["cache-control"], "no-store");
  const second = fakeRes();
  assert.equal((await handler(fakeReq(`/callback?code=${CODE}&state=${STATE}`), second)).status, 410);
  assert.equal(received.length, 1);
});

test("a code that arrives after the one-minute window is refused", async () => {
  let now = 1000;
  const handler = oauth.createCallbackHandler({ state: STATE, now: () => now, onCode: async () => {} });
  now += 60001;
  assert.equal((await handler(fakeReq(`/callback?code=${CODE}&state=${STATE}`), fakeRes())).status, 400);
  assert.equal(handler.stats().consumed, false);
});

test("a failed exchange answers 500 without repeating the code", async () => {
  const handler = oauth.createCallbackHandler({
    state: STATE,
    onCode: async () => {
      throw new Error(`boom ${CODE}`);
    }
  });
  const res = fakeRes();
  assert.equal((await handler(fakeReq(`/callback?code=${CODE}&state=${STATE}`), res)).status, 500);
  assert.equal(res.body.includes(CODE), false);
});

test("the listener binds loopback only and answers a real request", async () => {
  const received = [];
  const listener = oauth.startCallbackListener({
    http,
    port: 0,
    state: STATE,
    onCode: async (code) => received.push(code)
  });
  const ready = await listener.ready;
  try {
    assert.equal(ready.host, "127.0.0.1");
    assert.equal(ready.url, `http://127.0.0.1:${ready.port}/callback`);
    const first = await fetch(`${ready.url}?code=${CODE}&state=${STATE}`);
    assert.equal(first.status, 200);
    assert.deepEqual(received, [CODE]);
    const second = await fetch(`${ready.url}?code=${CODE}&state=${STATE}`);
    assert.equal(second.status, 410);
    assert.throws(() => oauth.startCallbackListener({ http, port: 0, host: "0.0.0.0", state: STATE, onCode: async () => {} }), (err) => err.code === "host_refused");
  } finally {
    await listener.close();
  }
});

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

test("the code exchange is the documented GET with every parameter in the query", async () => {
  const fetchImpl = fakeFetch({ body: { accessToken: "AT-1", refreshToken: "RT-1", expiresIn: 2628000, tokenType: "bearer" } });
  const tokens = await oauth.exchangeCode({
    clientId: "12345",
    clientSecret: "s3cret",
    code: CODE,
    redirectUri: "http://127.0.0.1:8765/callback",
    fetchImpl,
    now: () => 1000
  });
  assert.equal(fetchImpl.calls.length, 1);
  const { url, options } = fetchImpl.calls[0];
  assert.ok(url.startsWith(`${oauth.TOKEN_ENDPOINT}?`));
  assert.ok(url.includes("grant_type=authorization_code"));
  assert.ok(url.includes(`code=${CODE}`));
  assert.ok(url.includes("redirect_uri=http%3A%2F%2F127.0.0.1%3A8765%2Fcallback"));
  assert.ok(url.includes("client_id=12345"));
  assert.ok(url.includes("client_secret=s3cret"));
  assert.equal(options.method, "GET");
  assert.equal(options.body, undefined, "the documented call carries no body");
  assert.equal(options.headers.accept, "application/json");
  assert.equal(tokens.accessToken, "AT-1");
  assert.equal(tokens.refreshToken, "RT-1");
  assert.equal(tokens.expiresIn, 2628000);
  assert.equal(tokens.expiresAtMs, 1000 + 2628000000);
});

test("a refused exchange reports the status and keeps the code out of the error", async () => {
  const fetchImpl = fakeFetch({ status: 400, body: { errorCode: "INVALID_REQUEST", description: "code expired" } });
  await assert.rejects(
    oauth.exchangeCode({ clientId: "1", clientSecret: "2", code: CODE, redirectUri: "http://127.0.0.1:8765/callback", fetchImpl }),
    (err) => {
      assert.equal(err.code, "token_exchange_failed");
      assert.equal(err.status, 400);
      assert.equal(err.errorCode, "INVALID_REQUEST");
      assert.equal(String(err.message).includes(CODE), false);
      assert.equal(JSON.stringify(err).includes(CODE), false);
      assert.equal(String(err.message).includes("s3cret"), false);
      return true;
    }
  );
});

test("an unreachable endpoint is its own code, and a refresh uses the other grant type", async () => {
  const dead = async () => {
    throw new Error("getaddrinfo ENOTFOUND");
  };
  await assert.rejects(
    oauth.exchangeCode({ clientId: "1", clientSecret: "2", code: CODE, redirectUri: "http://127.0.0.1:8765/callback", fetchImpl: dead }),
    (err) => err.code === "token_endpoint_unreachable"
  );
  const fetchImpl = fakeFetch({ body: { accessToken: "AT-2", refreshToken: "RT-2", expiresIn: 2628000 } });
  const tokens = await oauth.refreshAccessToken({ clientId: "1", clientSecret: "2", refreshToken: "RT-1", fetchImpl });
  const url = fetchImpl.calls[0].url;
  assert.ok(url.includes("grant_type=refresh_token"));
  assert.ok(url.includes("refresh_token=RT-1"));
  assert.equal(url.includes("code="), false);
  assert.equal(tokens.accessToken, "AT-2");
});

test("a summary says whether a token exists without repeating it", async () => {
  const tokens = { accessToken: "AT-SECRET", refreshToken: "RT-SECRET", expiresAtMs: 5, tokenType: "bearer" };
  const summary = oauth.tokenSummary(tokens);
  assert.deepEqual(summary, { hasAccessToken: true, hasRefreshToken: true, expiresAtMs: 5, tokenType: "bearer" });
  assert.equal(JSON.stringify(summary).includes("SECRET"), false);
});

test("the token file round-trips and is replaced, not appended", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-oauth-"));
  const file = path.join(dir, "tokens.json");
  try {
    oauth.writeTokenFile({ path: file, tokens: { accessToken: "AT", refreshToken: "RT", expiresAtMs: 1 }, fs });
    assert.deepEqual(oauth.readTokenFile({ path: file, fs }), { accessToken: "AT", refreshToken: "RT", expiresAtMs: 1 });
    assert.ok(fs.readFileSync(file, "utf8").endsWith("\n"));
    oauth.writeTokenFile({ path: file, tokens: { accessToken: "AT2", refreshToken: "RT2", expiresAtMs: 2 }, fs });
    assert.equal(oauth.readTokenFile({ path: file, fs }).accessToken, "AT2");
    fs.writeFileSync(file, "not json");
    assert.throws(() => oauth.readTokenFile({ path: file, fs }), (err) => err.code === "token_file_not_json");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const callback = require(path.join(__dirname, "CTRADER_CALLBACK_20261114.js"));

function baseEnv(over = {}) {
  return {
    CTRADER_CLIENT_ID: "12345",
    CTRADER_CLIENT_SECRET: "s3cret",
    CTRADER_TOKEN_FILE: "C:\\ProgramData\\ctrader-relay\\tokens.json",
    ...over
  };
}

test("the consent command refuses to start without the app credentials or a token file", () => {
  const bare = callback.readConfig({ env: {}, argv: [] });
  assert.deepEqual(
    bare.refusals.map((r) => r.split(":")[0]).sort(),
    ["client_id_missing", "client_secret_missing", "token_file_missing"]
  );
  const badPort = callback.readConfig({ env: baseEnv(), argv: ["--port=70000"] });
  assert.ok(badPort.refusals.some((r) => r.startsWith("port_invalid")));
  const badRedirect = callback.readConfig({ env: baseEnv({ CTRADER_REDIRECT_URI: "http://localhost:8765/callback" }), argv: [] });
  assert.ok(badRedirect.refusals.some((r) => r.startsWith("redirect_uri_mismatch")));
  const unknown = callback.readConfig({ env: baseEnv(), argv: ["--nonsense"] });
  assert.ok(unknown.refusals.some((r) => r.startsWith("unknown_argument")));
});

test("the consent command defaults the redirect to loopback and generates a state", () => {
  const config = callback.readConfig({ env: baseEnv(), argv: ["--allow-missing-state"] });
  assert.deepEqual(config.refusals, []);
  assert.equal(config.port, 8765);
  assert.equal(config.redirectUri, "http://127.0.0.1:8765/callback");
  assert.equal(config.stateWasGenerated, true);
  assert.match(config.state, /^[0-9a-f]{32}$/);
  assert.equal(config.allowMissingState, true);
  const fixed = callback.readConfig({ env: baseEnv({ CTRADER_STATE: "state-20261114" }), argv: [] });
  assert.equal(fixed.state, "state-20261114");
  assert.equal(fixed.stateWasGenerated, false);
  assert.equal(fixed.allowMissingState, false);
});

async function until(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("condition was not met in time");
}

test("the consent link carries the documented parameters and, when it can, the state", () => {
  const url = new URL(oauth.buildConsentUrl({
    clientId: "12345",
    redirectUri: "http://127.0.0.1:8765/callback",
    scope: oauth.SCOPES.trading,
    state: STATE
  }));
  assert.equal(`${url.origin}${url.pathname}`, oauth.CONSENT_ENDPOINT);
  assert.equal(url.searchParams.get("client_id"), "12345");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:8765/callback");
  assert.equal(url.searchParams.get("scope"), "trading");
  assert.equal(url.searchParams.get("product"), "web");
  assert.equal(url.searchParams.get("state"), STATE);
  const accounts = new URL(oauth.buildConsentUrl({ clientId: "1", redirectUri: "http://127.0.0.1:8765/callback", scope: "accounts" }));
  assert.equal(accounts.searchParams.get("scope"), "accounts");
  assert.equal(accounts.searchParams.get("state"), null, "a caller that has no state does not get a fake one");
  assert.throws(
    () => oauth.buildConsentUrl({ redirectUri: "http://127.0.0.1:8765/callback" }),
    (err) => err.code === "client_id_missing"
  );
  assert.throws(
    () => oauth.buildConsentUrl({ clientId: "1", redirectUri: "http://127.0.0.1:8765/callback", scope: "admin" }),
    (err) => err.code === "scope_invalid"
  );
});

test("the retired consent command refuses and writes no token file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-retired-"));
  const tokenFile = path.join(dir, "tokens.json");
  try {
    const config = callback.readConfig({ env: baseEnv({ CTRADER_TOKEN_FILE: tokenFile }), argv: [] });
    const result = await callback.runConsent({ config });
    assert.equal(result.ok, false);
    assert.ok(result.refusals.some((r) => r.startsWith("superseded_by_vault")), result.refusals.join(","));
    assert.equal(fs.existsSync(tokenFile), false, "the plaintext path must stay closed once the vault exists");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
