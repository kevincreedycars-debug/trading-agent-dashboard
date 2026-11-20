// Tests for CTRADER_RUN_20261114.js: the operator command, its two modes, and the guards between them.
//
// Nothing here opens a socket. The session, the client and the harness are fakes that record what they were
// asked, so the rules that matter - read-only by default, arming only after the account is confirmed, one run -
// can be checked without a broker.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const run = require("./CTRADER_RUN_20261114.js");
const secrets = require("./CTRADER_SECRETS_20261114.js");

// A client that records everything and answers reads from fixed data. No send, no close, no arming unless asked.
function fakeClient({ accountId = "777", armed = false, onSend } = {}) {
  const calls = [];
  const client = {
    armed,
    calls,
    async getAccount() {
      calls.push("getAccount");
      return { accountId, broker: "FTMO", isLive: false, balance: 100000, currency: "USD", hedgingMode: true };
    },
    async getSymbolSpec() {
      calls.push("getSymbolSpec");
      return {
        symbol: "BTCUSD",
        symbolId: 41,
        digits: 2,
        lotSizeBtc: 1,
        minVolume: 0.01,
        volumeStep: 0.01,
        minStopDistance: 20,
        tradeMode: "full",
        distanceSetIn: "points"
      };
    },
    async listExposures() {
      calls.push("listExposures");
      return { positions: [], orders: [] };
    },
    async getReferencePrice() {
      calls.push("getReferencePrice");
      return 96000.5;
    },
    async getDealsHistory() {
      calls.push("getDealsHistory");
      return [{ dealId: "9001", commission: -0.35 }];
    },
    async setArmed(value) {
      calls.push(`setArmed:${value}`);
      client.armed = value === true;
    },
    isArmed() {
      return client.armed;
    },
    async sendMarketOrder(request) {
      calls.push("sendMarketOrder");
      if (onSend) return onSend(request);
      return { outcome: "accepted", orderId: "5001", positionId: "4242" };
    },
    async closePosition() {
      calls.push("closePosition");
      return { outcome: "accepted" };
    },
    async findByRequestId() {
      calls.push("findByRequestId");
      return null;
    },
    async getExecution() {
      calls.push("getExecution");
      return { filledVolume: 0.01, fillPrice: 96000.5, fillTimeUtc: "2026-11-14T10:00:00.000Z" };
    },
    async getPosition() {
      calls.push("getPosition");
      return { state: "open", positionId: "4242" };
    },
    async getOpenExposure() {
      calls.push("getOpenExposure");
      return { positions: [], orders: [] };
    },
    async listDeals() {
      calls.push("listDeals");
      return [];
    }
  };
  return client;
}

test("read-only is the default, and execution needs the account named", () => {
  const plain = run.readConfig({ env: {}, argv: ["--vault", "v.vault.json"] });
  assert.equal(plain.execute, false);
  assert.equal(plain.login, 7348195);
  assert.equal(plain.holdMs, 120000);
  assert.equal(plain.environment, "demo");
  assert.deepEqual(plain.refusals, []);

  const executing = run.readConfig({ env: {}, argv: ["--vault", "v.vault.json", "--execute"] });
  assert.equal(executing.execute, true);
  assert.deepEqual(executing.refusals, [
    "execute_without_confirmation:--execute also needs --confirm-account with the account id the run must find"
  ]);

  const confirmed = run.readConfig({
    env: {},
    argv: ["--vault", "v.vault.json", "--execute", "--confirm-account", "12345678", "--environment", "live", "--hold-seconds", "90"]
  });
  assert.equal(confirmed.confirmAccount, "12345678");
  assert.equal(confirmed.environment, "live");
  assert.equal(confirmed.holdMs, 90000);
  assert.deepEqual(confirmed.refusals, []);
});

test("bad arguments are refused, not guessed at", () => {
  const checks = [
    [["--vault", "v", "--wat"], /unknown_argument:--wat/],
    [["--vault", "v", "--login", "0"], /login_invalid/],
    [["--vault", "v", "--environment", "testnet"], /environment_invalid/],
    [["--vault", "v", "--hold-seconds", "0"], /hold_invalid/],
    [["--vault", "v", "--poll-ms", "-5"], /poll_invalid/],
    [["--vault", "v", "--max-risk-usd", "0"], /max_risk_invalid/]
  ];
  for (const [argv, pattern] of checks) {
    const config = run.readConfig({ env: {}, argv });
    assert.ok(config.refusals.some((refusal) => pattern.test(refusal)), `${argv.join(" ")}: ${config.refusals.join(",")}`);
  }
});

// The vault the credentials come from, with the same fake protection runner as the secrets tests.
function fakeStore() {
  const runPowerShell = (script, input) => {
    if (script === secrets.POWERSHELL.protect) return Buffer.from(`fake:${input}`, "utf8").toString("base64");
    const text = Buffer.from(input, "base64").toString("utf8");
    return text.slice("fake:".length);
  };
  return secrets.createDpapiStore({ runPowerShell, user: "relay-user" });
}

function withVault(tokens) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-run-"));
  const file = path.join(dir, "ctrader.vault.json");
  const store = fakeStore();
  secrets.writeVault({
    path: file,
    secrets: {
      clientId: "fixture-client-id",
      clientSecret: "fixture-client-secret",
      accessToken: "fixture-access-token",
      refreshToken: "fixture-refresh-token",
      accessTokenExpiresAtUtc: "2026-11-14T12:00:00.000Z",
      ...tokens
    },
    store,
    fs
  });
  return { dir, file, store };
}

test("a token with time left is used as stored", async () => {
  const { dir, file, store } = withVault({});
  try {
    const prepared = await run.prepareCredentials({
      vaultPath: file,
      store,
      fsImpl: fs,
      now: () => Date.UTC(2026, 10, 14, 11, 0, 0),
      refresh: async () => {
        throw new Error("should not be called");
      }
    });
    assert.equal(prepared.refreshed, false);
    assert.equal(prepared.credentials.accessToken, "fixture-access-token");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a token near expiry is refreshed, and the vault is rewritten without the old one", async () => {
  const { dir, file, store } = withVault({});
  try {
    const prepared = await run.prepareCredentials({
      vaultPath: file,
      store,
      fsImpl: fs,
      now: () => Date.UTC(2026, 10, 14, 11, 59, 0),
      refresh: async (args) => {
        assert.equal(args.refreshToken, "fixture-refresh-token");
        assert.equal(args.clientSecret, "fixture-client-secret");
        return { accessToken: "second-access-token", refreshToken: "second-refresh-token", expiresAtMs: Date.UTC(2026, 10, 14, 13, 0, 0) };
      }
    });
    assert.equal(prepared.refreshed, true);
    assert.equal(prepared.credentials.accessToken, "second-access-token");
    const { secrets: onDisk } = secrets.readVault({ path: file, store, fs });
    assert.equal(onDisk.accessToken, "second-access-token");
    assert.equal(onDisk.accessTokenExpiresAtUtc, "2026-11-14T13:00:00.000Z");
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /second-access-token/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a vault with the app credentials but no consent yet stops with its own reason", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-run-"));
  const file = path.join(dir, "ctrader.vault.json");
  const store = fakeStore();
  try {
    secrets.putAppFromStdin({
      path: file,
      store,
      fs,
      readStdin: () => JSON.stringify({ clientId: "fixture-client-id", clientSecret: "fixture-client-secret" })
    });
    await assert.rejects(
      () => run.prepareCredentials({ vaultPath: file, store, fsImpl: fs }),
      (err) => err.code === "consent_incomplete" && /consent command/.test(err.message)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an expired token with nothing to refresh it is a stop, not a retry", async () => {
  const { dir, file, store } = withVault({ refreshToken: null });
  try {
    await assert.rejects(
      () => run.prepareCredentials({ vaultPath: file, store, fsImpl: fs, now: () => Date.UTC(2026, 11, 1) }),
      (err) => err.code === "token_expired"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("executeOnce refuses a different account, and nothing is armed or sent", async () => {
  const client = fakeClient({ accountId: "999" });
  const result = await run.executeOnce({
    client,
    config: { confirmAccount: "777", holdMs: 120000, pollMs: 2000, maxRiskUsd: 1, volumeLots: null },
    runTest: async () => {
      throw new Error("must not run");
    }
  });
  assert.equal(result.status, "refused");
  assert.match(result.refusals[0], /account_not_confirmed:999 is not 777/);
  assert.deepEqual(client.calls, ["getAccount"]);
  assert.equal(client.armed, false);
});

test("executeOnce refuses to run when no account was named at all", async () => {
  const client = fakeClient({ accountId: "777" });
  const result = await run.executeOnce({ client, config: { confirmAccount: null }, runTest: async () => { throw new Error("must not run"); } });
  assert.equal(result.status, "refused");
  assert.deepEqual(client.calls, ["getAccount"]);
  assert.equal(client.armed, false);
});

test("executeOnce arms only after the account matches, and disarms when the run returns", async () => {
  const client = fakeClient({ accountId: "777" });
  let seen = null;
  const result = await run.executeOnce({
    client,
    config: { confirmAccount: "777", holdMs: 120000, pollMs: 2000, maxRiskUsd: 1, volumeLots: 0.01 },
    now: () => Date.UTC(2026, 10, 14, 10, 0, 0),
    runTest: async (args) => {
      seen = args;
      assert.equal(client.armed, true, "the harness must see an armed relay");
      return { status: "closed_at_deadline", counters: { send: 1, close: 1, disarm: 1 }, report: { flat: true } };
    }
  });
  assert.equal(result.status, "closed_at_deadline");
  assert.equal(result.requestId, "btc-test-20261114100000");
  assert.equal(seen.config.confirmedAccountId, "777");
  assert.equal(seen.config.armed, true);
  assert.equal(seen.config.copyingEnabled, false);
  assert.equal(seen.config.killSwitch, false);
  assert.equal(seen.config.holdMs, 120000);
  assert.equal(seen.config.volume, 0.01);
  assert.equal(client.armed, false);
  assert.deepEqual(client.calls, ["getAccount", "setArmed:true", "setArmed:false"]);
});

test("executeOnce disarms even when the harness throws", async () => {
  const client = fakeClient({ accountId: "777" });
  await assert.rejects(
    () => run.executeOnce({
      client,
      config: { confirmAccount: "777" },
      runTest: async () => {
        throw new Error("boom");
      }
    }),
    /boom/
  );
  assert.equal(client.armed, false);
});

test("the read-only report reads and never arms, sends or closes", async () => {
  const client = fakeClient({ accountId: "777" });
  const report = await run.readOnlyReport({ client, login: 7348195, now: () => Date.UTC(2026, 10, 14, 10, 0, 0) });
  assert.equal(report.account.accountId, "777");
  assert.equal(report.spec.symbol, "BTCUSD");
  assert.equal(report.referencePrice, 96000.5);
  assert.equal(report.dealCount, 1);
  assert.equal(report.sent, 0);
  assert.deepEqual(client.calls, ["getAccount", "getSymbolSpec", "listExposures", "getReferencePrice", "getDealsHistory"]);
  assert.equal(client.armed, false);
});

test("main with no vault stops before opening anything", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-run-missing-"));
  const log = [];
  try {
    const result = await run.main(["--vault", path.join(dir, "absent.vault.json")], {
      env: {},
      fs,
      log: (line) => log.push(line),
      store: fakeStore(),
      openConnection: () => {
        throw new Error("no connection may be opened");
      }
    });
    assert.equal(result.ok, false);
    assert.equal(result.exitCode, 2);
    assert.equal(result.mode, "credentials");
    assert.match(log.join("\n"), /vault_missing/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("main refuses an execute run that names no account before touching the vault", async () => {
  const log = [];
  const result = await run.main(["--vault", "whatever.vault.json", "--execute"], {
    env: {},
    log: (line) => log.push(line),
    openConnection: () => {
      throw new Error("no connection may be opened");
    }
  });
  assert.equal(result.mode, "refused");
  assert.equal(result.exitCode, 2);
  assert.match(log.join("\n"), /execute_without_confirmation/);
});

// ---- the app check ----
//
// The portal can render an application that the broker then refuses, and that refusal never reaches the consent
// listener because the portal does not redirect. These tests hold the command to the same rules: a mode of its
// own, no token needed, never beside a send, and the secret never printed.

function withPendingVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-app-"));
  const file = path.join(dir, "ctrader.vault.json");
  const store = fakeStore();
  secrets.writeVault({
    path: file,
    secrets: { clientId: "48945_fixtureclientid1234567890", clientSecret: "fixture-client-secret" },
    store,
    fs,
    pending: true
  });
  return { dir, file, store };
}

function fakeConnection({ reply }) {
  const calls = [];
  return {
    calls,
    closed: false,
    session: {
      async call(payloadType, payload) {
        calls.push({ payloadType, payload });
        if (reply instanceof Error) throw reply;
        return reply || {};
      }
    },
    close() {
      this.closed = true;
    }
  };
}

test("the app check is a mode of its own and never travels with a send", () => {
  const plain = run.readConfig({ env: {}, argv: ["--vault", "v.vault.json", "--check-app"] });
  assert.equal(plain.checkApp, true);
  assert.equal(plain.execute, false);
  assert.equal(plain.recover, false);
  assert.deepEqual(plain.refusals, []);

  const withSend = run.readConfig({
    env: {},
    argv: ["--vault", "v.vault.json", "--check-app", "--execute", "--confirm-account", "12345678"]
  });
  assert.ok(withSend.refusals.some((refusal) => /check_app_with_send/.test(refusal)), withSend.refusals.join(","));

  const withRecover = run.readConfig({ env: {}, argv: ["--vault", "v.vault.json", "--check-app", "--recover"] });
  assert.ok(withRecover.refusals.some((refusal) => /check_app_with_send/.test(refusal)), withRecover.refusals.join(","));
});

test("a pending vault can be checked without a token, and an active app passes", async () => {
  const { dir, file, store } = withPendingVault();
  const log = [];
  const connection = fakeConnection({ reply: {} });
  try {
    const result = await run.main(["--vault", file, "--check-app"], {
      env: {},
      fs,
      log: (line) => log.push(line),
      store,
      openConnection: ({ config }) => {
        assert.equal(config.checkApp, true);
        return connection;
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.mode, "check-app");
    assert.equal(result.exitCode, 0);
    assert.equal(connection.calls.length, 1);
    assert.equal(connection.calls[0].payloadType, 2100);
    assert.equal(connection.calls[0].payload.clientId, "48945_fixtureclientid1234567890");
    assert.equal(connection.closed, true);
    const text = log.join("\n");
    assert.match(text, /the application is active/);
    assert.doesNotMatch(text, /fixture-client-secret/);
    assert.doesNotMatch(text, /48945_fixtureclientid1234567890/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an app the broker will not authenticate is named, and the pending vault is left alone", async () => {
  const { dir, file, store } = withPendingVault();
  const log = [];
  const refusal = Object.assign(new Error("OA client is not in active state"), {
    code: "broker_error",
    errorCode: "CH_CLIENT_AUTH_FAILURE",
    description: "OA client is not in active state"
  });
  const connection = fakeConnection({ reply: refusal });
  try {
    const result = await run.main(["--vault", file, "--check-app"], {
      env: {},
      fs,
      log: (line) => log.push(line),
      store,
      openConnection: () => connection
    });
    assert.equal(result.ok, false);
    assert.equal(result.exitCode, 2);
    assert.equal(result.errorCode, "CH_CLIENT_AUTH_FAILURE");
    assert.equal(connection.closed, true);
    const text = log.join("\n");
    assert.match(text, /CH_CLIENT_AUTH_FAILURE/);
    assert.match(text, /portal problem and not a relay one/);
    const reopened = secrets.readVault({ path: file, store, fs, pending: true });
    assert.equal(reopened.secrets.accessToken, null);
    assert.equal(reopened.secrets.clientId, "48945_fixtureclientid1234567890");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


