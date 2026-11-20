// Tests for the journal and the two things that read it: the wrapper the run puts around the client, and the
// guard that closes what a crash left behind. The journal is a real file in a temporary directory, the client is
// a fake that records every call, and nothing is sent to a broker.
//
//   node --test docs/strategy/proposals/CTRADER_JOURNAL_20261115.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const journalModule = require(path.join(__dirname, "CTRADER_JOURNAL_20261115.js"));
const run = require(path.join(__dirname, "CTRADER_RUN_20261114.js"));

const AT = Date.UTC(2026, 10, 14, 10, 0, 0);

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ctrader-journal-"));
}

function journalAt(dir, name = "btcusd-test-journal.json") {
  return journalModule.createJournal({ path: path.join(dir, name), fs, now: () => AT });
}

// A client that records the journal as it stood at the moment each call was made, so ordering can be asserted.
function recordingClient({ accountId = "777", send = {}, execution = null, position = null, find = null } = {}) {
  const calls = [];
  const client = {
    calls,
    armed: false,
    async getAccount() {
      calls.push("getAccount");
      return { accountId, broker: "FTMO", isLive: false, hedgingMode: true };
    },
    async setArmed(value) {
      calls.push(`setArmed:${value}`);
      client.armed = value === true;
    },
    isArmed() {
      return client.armed === true;
    },
    async sendMarketOrder(request) {
      calls.push("sendMarketOrder");
      return typeof send === "function" ? send(request) : { outcome: "accepted", orderId: "5001", positionId: "4242" };
    },
    async getExecution() {
      calls.push("getExecution");
      return execution;
    },
    async getPosition() {
      calls.push("getPosition");
      return typeof position === "function" ? position() : position;
    },
    async closePosition(request) {
      calls.push("closePosition");
      return { outcome: "accepted", requestId: request && request.requestId };
    },
    async findByRequestId() {
      calls.push("findByRequestId");
      return typeof find === "function" ? find() : find;
    }
  };
  return client;
}

test("the journal reads back what was written, and an empty document is no entry", () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    assert.equal(journal.read(), null, "no file is no entry, not an error");
    journal.clear();
    assert.equal(journal.read(), null, "a cleared journal reads as nothing owed");
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    const entry = journal.read();
    assert.equal(entry.version, journalModule.JOURNAL_VERSION);
    assert.equal(entry.state, "intent");
    assert.equal(entry.login, 7348195);
    assert.equal(entry.accountId, "777");
    assert.equal(entry.clientOrderId, "req-1");
    assert.equal(entry.holdMs, 120000);
    assert.equal(entry.updatedAtUtc, new Date(AT).toISOString());
    assert.deepEqual(entry.events.map((e) => e.kind), ["intent"]);
    const leftovers = fs.readdirSync(dir).filter((name) => name.endsWith(".tmp"));
    assert.deepEqual(leftovers, [], "the write is a temp file and a rename, never a half-written journal");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the journal refuses a credential file name, a corrupt file and an unknown version", () => {
  const dir = tempDir();
  try {
    assert.throws(
      () => journalModule.createJournal({ path: path.join(dir, "tokens.json"), fs }),
      (err) => err.code === "plaintext_path_refused"
    );
    assert.throws(
      () => journalModule.createJournal({ path: path.join(dir, "relay.env"), fs }),
      (err) => err.code === "plaintext_path_refused"
    );
    const corrupt = path.join(dir, "corrupt.json");
    fs.writeFileSync(corrupt, "{not json", "utf8");
    assert.throws(() => journalModule.readJournal({ path: corrupt, fs }), (err) => err.code === "journal_corrupt");
    const wrong = path.join(dir, "wrong.json");
    fs.writeFileSync(wrong, JSON.stringify({ version: 99, state: "open" }), "utf8");
    assert.throws(() => journalModule.readJournal({ path: wrong, fs }), (err) => err.code === "journal_version_unsupported");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a fill sets the deadline from the broker's own fill time, and a close ends the entry", () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    journal.recordSent({ orderId: "5001", positionId: "4242" });
    journal.recordFill({
      positionId: "4242",
      orderId: "5001",
      fillPrice: 96000.5,
      fillVolume: 0.01,
      fillTimeUtc: "2026-11-14T10:00:00.000Z"
    });
    const filled = journal.read();
    assert.equal(filled.state, "open");
    assert.equal(filled.positionId, "4242");
    assert.equal(filled.deadlineUtc, "2026-11-14T10:02:00.000Z", "the hold starts at the fill, not at the send");
    journal.recordCloseRequest({ reason: "deadline" });
    assert.equal(journal.read().closeRequestedAtUtc, new Date(AT).toISOString());
    journal.recordClosed({ status: "closed_at_deadline", positionId: "4242", closePrice: 95990.25, closeTimeUtc: "2026-11-14T10:02:02.000Z" });
    const closed = journal.read();
    assert.equal(closed.state, "closed");
    assert.equal(closed.status, "closed_at_deadline");
    assert.equal(closed.closePrice, 95990.25);
    assert.deepEqual(closed.events.map((e) => e.kind), ["intent", "sent", "fill", "close_requested", "closed"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("planRecovery says what a fresh process should do with what it finds", () => {
  const now = () => AT;
  assert.deepEqual(journalModule.planRecovery(null, now), { action: "none", reason: "empty" });
  assert.deepEqual(
    journalModule.planRecovery({ state: "closed", positionId: "4242" }, now),
    { action: "none", reason: "already_closed", positionId: "4242" }
  );
  const closing = journalModule.planRecovery(
    { state: "open", positionId: "4242", deadlineUtc: new Date(AT - 5000).toISOString() },
    now
  );
  assert.equal(closing.action, "close");
  assert.equal(closing.positionId, "4242");
  assert.equal(closing.reason, "state_open");
  assert.equal(closing.overdueMs, 5000, "a guard that comes back late knows by how much");
  const early = journalModule.planRecovery(
    { state: "open", positionId: "4242", deadlineUtc: new Date(AT + 60000).toISOString() },
    now
  );
  assert.equal(early.action, "close");
  assert.equal(early.overdueMs, 0, "not yet due is still a close, the position is live either way");
  const adopt = journalModule.planRecovery({ state: "intent", clientOrderId: "req-1" }, now);
  assert.deepEqual(adopt, { action: "adopt", reason: "state_intent", clientOrderId: "req-1" });
  const escalate = journalModule.planRecovery({ state: "intent" }, now);
  assert.deepEqual(escalate, { action: "escalate", reason: "no_identifier", state: "intent" });
});

test("the wrapper writes the intent before the send reaches the broker", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    let atSend = null;
    const client = recordingClient({
      send: () => {
        atSend = journal.read();
        return { outcome: "accepted", orderId: "5001", positionId: "4242" };
      }
    });
    const wrapped = run.withJournal({ client, journal, login: 7348195, holdMs: 120000 });
    await wrapped.getAccount();
    await wrapped.sendMarketOrder({ requestId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD" });
    assert.equal(atSend && atSend.state, "intent", "the record exists before the broker can answer");
    assert.equal(atSend.clientOrderId, "req-1");
    assert.equal(atSend.accountId, "777", "the id learned from getAccount is on the record");
    assert.equal(atSend.holdMs, 120000);
    const after = journal.read();
    assert.equal(after.state, "sent");
    assert.equal(after.orderId, "5001");
    assert.equal(after.positionId, "4242");
    assert.deepEqual(client.calls, ["getAccount", "sendMarketOrder"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a rejected send is left as an intent, and an unknown answer is recorded as sent", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    const rejected = run.withJournal({
      client: recordingClient({ send: () => ({ outcome: "rejected", reason: "market_closed" }) }),
      journal,
      login: 7348195,
      holdMs: 120000
    });
    await rejected.sendMarketOrder({ requestId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD" });
    assert.equal(journal.read().state, "intent", "a rejection still leaves the attempt on record");
    journal.clear();
    const unknown = run.withJournal({
      client: recordingClient({ send: () => ({ outcome: "unknown", reason: "timeout" }) }),
      journal,
      login: 7348195,
      holdMs: 120000
    });
    await unknown.sendMarketOrder({ requestId: "req-2", side: "buy", volume: 0.01, symbol: "BTCUSD" });
    const entry = journal.read();
    assert.equal(entry.state, "sent", "an unanswered send is the case the journal exists for");
    assert.equal(entry.clientOrderId, "req-2");
    assert.equal(entry.positionId, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});



test("the wrapper records the fill, the close request and the closed position it sees", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    const client = recordingClient({
      execution: {
        positionId: "4242",
        orderId: "5001",
        fillPrice: 96000.5,
        filledVolume: 0.01,
        fillTimeUtc: "2026-11-14T10:00:00.000Z"
      },
      position: () => ({ state: "closed", positionId: "4242", closePrice: 95990.25, closeTimeUtc: "2026-11-14T10:02:02.000Z" })
    });
    const wrapped = run.withJournal({ client, journal, login: 7348195, holdMs: 120000 });
    await wrapped.getExecution({ positionId: "4242" });
    const filled = journal.read();
    assert.equal(filled.state, "open");
    assert.equal(filled.fillPrice, 96000.5);
    assert.equal(filled.deadlineUtc, "2026-11-14T10:02:00.000Z");

    let atClose = null;
    client.closePosition = async (request) => {
      atClose = journal.read();
      client.calls.push("closePosition");
      return { outcome: "accepted", requestId: request && request.requestId };
    };
    await wrapped.closePosition({ positionId: "4242", volume: 0.01, requestId: "req-close-1", reason: "deadline" });
    assert.equal(atClose && atClose.closeRequestedAtUtc, new Date(AT).toISOString(), "the request is on record before it is sent");

    await wrapped.getPosition("4242");
    const closed = journal.read();
    assert.equal(closed.state, "closed");
    assert.equal(closed.status, "closed_seen");
    assert.equal(closed.closePrice, 95990.25);
    assert.deepEqual(closed.events.map((e) => e.kind), ["fill", "close_requested", "closed"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test("the guard does nothing when the journal has nothing in flight", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    const client = recordingClient();
    const nothing = await run.recoverOnce({ client, journal, plan: journalModule.planRecovery(journal.read()), log: () => {} });
    assert.equal(nothing.ok, true);
    assert.equal(nothing.status, "nothing_to_do");
    assert.deepEqual(client.calls, [], "an empty journal never reaches the broker");
    const escalated = await run.recoverOnce({ client, journal, plan: { action: "escalate", reason: "no_identifier" } });
    assert.equal(escalated.ok, false);
    assert.equal(escalated.status, "escalated");
    assert.deepEqual(client.calls, [], "an entry with no identifier is a person's job, not a guess");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a position the broker has already closed is recorded, not closed again", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    journal.recordFill({ positionId: "4242", orderId: "5001", fillPrice: 96000.5, fillVolume: 0.01, fillTimeUtc: "2026-11-14T10:00:00.000Z" });
    const client = recordingClient({
      position: { state: "closed", positionId: "4242", closePrice: 95990.25, closeTimeUtc: "2026-11-14T10:02:02.000Z" }
    });
    const result = await run.recoverOnce({
      client,
      journal,
      plan: journalModule.planRecovery(journal.read(), () => AT),
      log: () => {}
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, "already_closed");
    assert.deepEqual(client.calls, ["getPosition"]);
    assert.equal(journal.read().status, "closed_before_recovery");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the guard adopts an order by the id that was sent and closes it, never resending", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    let reads = 0;
    const client = recordingClient({
      find: { order: { orderId: "5001" }, position: { positionId: "4242" } },
      position: () => {
        reads += 1;
        return reads === 1
          ? { state: "open", positionId: "4242", volume: 0.01 }
          : { state: "closed", positionId: "4242", closePrice: 95990.25, closeTimeUtc: "2026-11-14T10:02:02.000Z" };
      }
    });
    const plan = journalModule.planRecovery(journal.read(), () => AT);
    assert.equal(plan.action, "adopt");
    const result = await run.recoverOnce({ client, journal, plan, log: () => {}, now: () => AT, sleep: async () => {} });
    assert.equal(result.ok, true);
    assert.equal(result.status, "closed_at_recovery");
    assert.equal(result.positionId, "4242");
    assert.deepEqual(client.calls, ["findByRequestId", "getPosition", "closePosition", "getPosition"]);
    assert.equal(client.calls.includes("sendMarketOrder"), false, "the guard never opens a position");
    const entry = journal.read();
    assert.equal(entry.state, "closed");
    assert.equal(entry.status, "closed_at_recovery");
    assert.equal(entry.positionId, "4242");
    assert.equal(entry.events.filter((e) => e.kind === "sent").length, 1, "adoption is recorded as the sent it never received");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an order the broker cannot find is recorded as absent and nothing is sent", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    const client = recordingClient({ find: null });
    const result = await run.recoverOnce({
      client,
      journal,
      plan: journalModule.planRecovery(journal.read(), () => AT),
      log: () => {}
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, "absent");
    assert.deepEqual(client.calls, ["findByRequestId"]);
    const entry = journal.read();
    assert.equal(entry.state, "closed");
    assert.equal(entry.status, "absent_at_recovery");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a close that does not confirm is left uncertain for a person, not retried", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    journal.recordFill({ positionId: "4242", orderId: "5001", fillPrice: 96000.5, fillVolume: 0.01, fillTimeUtc: "2026-11-14T10:00:00.000Z" });
    const client = recordingClient({ position: { state: "open", positionId: "4242", volume: 0.01 } });
    let clock = AT;
    const result = await run.recoverOnce({
      client,
      journal,
      plan: journalModule.planRecovery(journal.read(), () => AT),
      log: () => {},
      now: () => (clock += 10000),
      sleep: async () => {},
      closeTimeoutMs: 45000
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, "close_unconfirmed");
    assert.equal(client.calls.filter((call) => call === "closePosition").length, 1, "one close, never a second");
    const entry = journal.read();
    assert.equal(entry.state, "uncertain");
    assert.equal(entry.status, "close_unconfirmed_at_recovery");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an execute run refuses while the journal still names an open plan", async () => {
  const dir = tempDir();
  const log = [];
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", clientOrderId: "req-1", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    const result = await run.main(
      ["--vault", path.join(dir, "v.vault.json"), "--journal", journal.path, "--execute", "--confirm-account", "777"],
      {
        env: {},
        fs,
        log: (line) => log.push(line),
        openConnection: () => {
          throw new Error("no connection may be opened");
        }
      }
    );
    assert.equal(result.mode, "execute");
    assert.equal(result.exitCode, 2);
    assert.equal(result.sent, 0);
    assert.match(log.join("\n"), /run --recover first/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a guard with nothing owed returns before the vault is opened", async () => {
  const dir = tempDir();
  const log = [];
  try {
    const result = await run.main(
      ["--vault", path.join(dir, "v.vault.json"), "--journal", path.join(dir, "btcusd-test-journal.json"), "--recover"],
      {
        env: {},
        fs,
        log: (line) => log.push(line),
        openConnection: () => {
          throw new Error("no connection may be opened");
        }
      }
    );
    assert.equal(result.ok, true);
    assert.equal(result.mode, "recover");
    assert.equal(result.plan.action, "none");
    assert.equal(result.sent, 0);
    assert.equal(result.exitCode, 0);
    assert.match(log.join("\n"), /nothing is owed; the vault was not opened/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a guard that cannot identify the position stops and asks for a person", async () => {
  const dir = tempDir();
  const log = [];
  try {
    const journal = journalAt(dir);
    journal.beginIntent({ login: 7348195, accountId: "777", side: "buy", volume: 0.01, symbol: "BTCUSD", holdMs: 120000 });
    const result = await run.main(
      ["--vault", path.join(dir, "v.vault.json"), "--journal", journal.path, "--recover"],
      {
        env: {},
        fs,
        log: (line) => log.push(line),
        openConnection: () => {
          throw new Error("no connection may be opened");
        }
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.exitCode, 2);
    assert.equal(result.plan.action, "escalate");
    assert.equal(result.sent, 0);
    assert.match(log.join("\n"), /look at cTrader by hand/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("--execute with --recover, and a journal beside the vault, are decided in the config", () => {
  const both = run.readConfig({ env: {}, argv: ["--vault", "secrets\\v.vault.json", "--execute", "--confirm-account", "777", "--recover"] });
  assert.ok(both.refusals.some((r) => r.startsWith("execute_and_recover")));
  const plain = run.readConfig({ env: {}, argv: ["--vault", "secrets\\v.vault.json"] });
  assert.equal(plain.journalPath, path.join("secrets", run.JOURNAL_NAME), "the journal sits beside the vault by default");
  assert.equal(plain.recover, false);
  const named = run.readConfig({ env: { CTRADER_JOURNAL_FILE: "D:\\relay\\guard.json" }, argv: ["--vault", "v.vault.json"] });
  assert.equal(named.journalPath, "D:\\relay\\guard.json");
  const flagged = run.readConfig({ env: {}, argv: ["--vault", "v.vault.json", "--journal", "guard.json"] });
  assert.equal(flagged.journalPath, "guard.json");
});


test("executeOnce journals the send the harness makes, by the request id it generated", async () => {
  const dir = tempDir();
  try {
    const journal = journalAt(dir);
    const client = recordingClient({
      accountId: "777",
      execution: {
        positionId: "4242",
        orderId: "5001",
        fillPrice: 96000.5,
        filledVolume: 0.01,
        fillTimeUtc: "2026-11-14T10:00:00.000Z"
      }
    });
    let journalAtSend = null;
    let harnessClient = null;
    const result = await run.executeOnce({
      client,
      journal,
      config: { login: 7348195, confirmAccount: "777", holdMs: 120000, pollMs: 2000, maxRiskUsd: 1, volumeLots: 0.01 },
      now: () => AT,
      runTest: async ({ client: target, config }) => {
        harnessClient = target;
        assert.equal(target.isArmed(), true, "the journal wrapper must not hide the arming flag");
        journalAtSend = journal.read();
        await target.sendMarketOrder({ requestId: config.requestId, side: "buy", volume: config.volume, symbol: "BTCUSD" });
        await target.getExecution({ positionId: "4242" });
        return { status: "closed_at_deadline", counters: { send: 1, close: 1, disarm: 1 }, report: { flat: true } };
      }
    });
    assert.equal(result.status, "closed_at_deadline");
    assert.notEqual(harnessClient, client, "the harness sees the wrapper, not the raw client");
    assert.equal(harnessClient.getAccount instanceof Function, true, "every other method passes straight through");
    assert.equal(journalAtSend, null, "the harness starts with an empty journal, so the intent below is its own");
    const entry = journal.read();
    assert.equal(entry.state, "open", "the fill opened the entry");
    assert.equal(entry.clientOrderId, result.requestId);
    assert.equal(entry.positionId, "4242");
    assert.equal(entry.deadlineUtc, "2026-11-14T10:02:00.000Z");
    assert.equal(client.armed, false, "the run still disarms through the wrapper");
    assert.deepEqual(entry.events.map((e) => e.kind), ["intent", "sent", "fill"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

