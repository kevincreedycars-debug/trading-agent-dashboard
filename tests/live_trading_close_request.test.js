// The close-request document, held to its own rules.
//
// `data/live-trading-close-request.json` is the one file the dashboard's Open positions table writes and the
// five-minute loop reads, so its rules are the ones that decide whether a hand close happens, happens twice,
// or is refused. What this file pins: a row is one ticket and one readable stamp; the same ask is one row
// however many times it is merged; an ask outside its own thirty-minute window is never handed to the loop;
// and the commit refuses a document the checker would reject, or one that would replace a published file
// that moved under it.
const test = require("node:test");
const assert = require("node:assert/strict");

const requests = require("../lib/live_trading_close_request.js");
const levelsStore = require("../lib/l2l_levels_store.js");

const NOW = Date.parse("2026-10-16T12:10:00Z");

function ask(overrides = {}) {
  const built = requests.buildRequest({
    ticket: 300456025,
    symbol: "XAUUSD",
    side: "buy",
    volume: 0.01,
    requestedAtUtc: "2026-10-16T12:05:00Z",
    requestedBy: "dashboard",
    note: "Close pressed in the Open positions table.",
    lane: "ftmo-1",
    accountLoginMasked: "***614",
    accountServer: "FTMO-Server",
    requestToken: "9f3a",
    ...overrides
  });
  assert.equal(built.ok, true, built.error);
  return built.request;
}

test("a request names the ticket, the ask, the account it was asked on, and its own expiry", () => {
  const row = ask();
  assert.deepEqual(Object.keys(row).sort(), [
    "account",
    "expires_at_utc",
    "note",
    "request_id",
    "requested_at_utc",
    "requested_by",
    "side",
    "symbol",
    "ticket",
    "volume"
  ]);
  assert.equal(row.ticket, 300456025);
  assert.equal(row.requested_at_utc, "2026-10-16T12:05:00Z");
  assert.equal(row.expires_at_utc, "2026-10-16T12:35:00Z");
  assert.equal(row.requested_by, "dashboard");
  assert.deepEqual(row.account, { lane: "ftmo-1", login_masked: "***614", server: "FTMO-Server" });
  assert.equal(row.request_id, "close-ftmo-1-300456025-20261016T120500Z-9f3a");
});

test("an ask that names no lane or no masked login is refused, because two accounts write this file", () => {
  const noLane = requests.buildRequest({
    ticket: 300456025,
    requestedAtUtc: "2026-10-16T12:05:00Z",
    accountLoginMasked: "***614"
  });
  assert.equal(noLane.ok, false);
  assert.match(noLane.error, /name the lane/);
  const noLogin = requests.buildRequest({
    ticket: 300456025,
    requestedAtUtc: "2026-10-16T12:05:00Z",
    lane: "ftmo-1"
  });
  assert.equal(noLogin.ok, false);
  assert.match(noLogin.error, /masked login/);
  const fullLogin = requests.buildRequest({
    ticket: 300456025,
    requestedAtUtc: "2026-10-16T12:05:00Z",
    lane: "ftmo-1",
    accountLoginMasked: "300456025"
  });
  assert.equal(fullLogin.ok, false, "a full login never belongs in a public repository");
  assert.match(fullLogin.error, /masked login/);
});

test("two lanes pressing on the same ticket in the same second are two rows with two ids", () => {
  const one = ask({ requestToken: "aaaa" });
  const two = ask({ requestToken: "bbbb" });
  const otherLane = ask({ lane: "ftmo-2", requestToken: "cccc" });
  assert.notEqual(one.request_id, two.request_id);
  assert.notEqual(one.request_id, otherLane.request_id);
  assert.match(one.request_id, /^close-ftmo-1-300456025-20261016T120500Z-[0-9a-f]{4}$/);
  assert.match(otherLane.request_id, /^close-ftmo-2-/);
  const state = requests.appendRequests(requests.createEmptyState("2026-10-16T12:00:00Z"), [one, two, otherLane]);
  assert.equal(state.request_count, 3, "a shared ticket and a shared second are not a shared id");
  assert.deepEqual(requests.validateRequestsState(state), []);
});

test("an ask carries its own expiry, and one that asks for longer than the window is refused or cut to it", () => {
  const short = ask({ expiresAtUtc: "2026-10-16T12:10:00Z" });
  assert.equal(short.expires_at_utc, "2026-10-16T12:10:00Z");
  assert.equal(requests.isOpenRequest(short, Date.parse("2026-10-16T12:09:59Z")), true);
  assert.equal(requests.isOpenRequest(short, Date.parse("2026-10-16T12:10:01Z")), false, "its own expiry ends it early");
  const long = ask({ expiresAtUtc: "2026-10-16T18:00:00Z" });
  assert.equal(long.expires_at_utc, "2026-10-16T12:35:00Z", "a row cannot extend its life past the window");
  const backwards = requests.buildRequest({
    ticket: 300456025,
    requestedAtUtc: "2026-10-16T12:05:00Z",
    lane: "ftmo-1",
    accountLoginMasked: "***614",
    expiresAtUtc: "2026-10-16T12:04:00Z"
  });
  assert.equal(backwards.ok, false);
  assert.match(backwards.error, /expiry/);
});

test("a row is only this loop's to take out when the lane and the account are its own", () => {
  const row = ask();
  assert.deepEqual(requests.accountMatches(row, { lane: "ftmo-1" }), { ok: true, reason: null });
  assert.deepEqual(
    requests.accountMatches(row, { lane: "ftmo-1", loginMasked: "***614", server: "FTMO-Server" }),
    { ok: true, reason: null }
  );
  const otherLane = requests.accountMatches(row, { lane: "ftmo-2" });
  assert.equal(otherLane.ok, false);
  assert.match(otherLane.reason, /asked on lane ftmo-1/);
  const otherAccount = requests.accountMatches(row, { lane: "ftmo-1", loginMasked: "***777" });
  assert.equal(otherAccount.ok, false);
  assert.match(otherAccount.reason, /\*\*\*614.*\*\*\*777/);
  const otherServer = requests.accountMatches(row, { lane: "ftmo-1", loginMasked: "***614", server: "Other-Server" });
  assert.equal(otherServer.ok, false);
  assert.match(otherServer.reason, /Other-Server/);
  assert.equal(requests.accountMatches(row, { lane: null }).ok, false, "a loop with no lane cannot claim an ask");
  assert.equal(requests.accountMatches({ ticket: 1, requested_at_utc: "2026-10-16T12:05:00Z" }, { lane: "ftmo-1" }).ok, false);
});

test("a request without a whole ticket, or without a stamp it can be aged by, is refused with words", () => {
  const base = { requestedAtUtc: "2026-10-16T12:05:00Z", lane: "ftmo-1", accountLoginMasked: "***614" };
  assert.equal(requests.buildRequest({ ...base, ticket: "300456025" }).ok, true);
  const noTicket = requests.buildRequest({ ...base, ticket: 3004560.25 });
  assert.equal(noTicket.ok, false);
  assert.match(noTicket.error, /whole ticket number/);
  const noStamp = requests.buildRequest({ ...base, ticket: 300456025, requestedAtUtc: "not a time" });
  assert.equal(noStamp.ok, false);
  assert.match(noStamp.error, /aged by/);
});

test("the stamp is written the way the rest of the artifacts write one", () => {
  assert.equal(requests.isoStamp(new Date("2026-10-16T12:05:00.482Z")), "2026-10-16T12:05:00Z");
  assert.equal(requests.isoStamp("nonsense"), null);
});

test("an ask stays live for thirty minutes and is not handed over after that", () => {
  const row = ask();
  assert.equal(requests.isOpenRequest(row, NOW), true);
  assert.equal(requests.isOpenRequest(row, Date.parse("2026-10-16T12:34:59Z")), true);
  assert.equal(requests.isOpenRequest(row, Date.parse("2026-10-16T12:35:01Z")), false);
  const described = requests.describeRequest(row, Date.parse("2026-10-16T13:00:00Z"));
  assert.equal(described.tone, "stale");
  assert.match(described.text, /outside the 30 minutes the loop acts within/);
});

test("a stamp a few minutes in the future is clock skew and still counts, an unreadable one does not", () => {
  const ahead = ask({ requestedAtUtc: "2026-10-16T12:12:00Z" });
  assert.equal(requests.isOpenRequest(ahead, NOW), true);
  const farAhead = ask({ requestedAtUtc: "2026-10-16T13:30:00Z" });
  assert.equal(requests.isOpenRequest(farAhead, NOW), false);
  assert.equal(requests.isOpenRequest({ ticket: 1, requested_at_utc: "nonsense" }, NOW), false);
});

test("the same ask merged twice is one row, and two asks are two rows in the order they were made", () => {
  const first = ask();
  const later = ask({ requestedAtUtc: "2026-10-16T12:07:00Z" });
  const once = requests.appendRequests(requests.createEmptyState("2026-10-16T12:05:00Z"), [first]);
  const twice = requests.appendRequests(once, [first]);
  assert.equal(twice.request_count, 1);
  const both = requests.appendRequests(twice, [later]);
  assert.equal(both.request_count, 2);
  assert.deepEqual(both.requests.map(row => row.requested_at_utc), ["2026-10-16T12:05:00Z", "2026-10-16T12:07:00Z"]);
  assert.deepEqual(requests.pendingRequests(both, NOW).map(row => row.ticket), [300456025, 300456025]);
});

test("a merge keeps the other writer's asks as well as this browser's", () => {
  const mine = requests.appendRequests(requests.createEmptyState("2026-10-16T12:00:00Z"), ask());
  const published = requests.appendRequests(
    requests.createEmptyState("2026-10-16T12:00:00Z"),
    ask({ ticket: 111111111, requestedAtUtc: "2026-10-16T12:06:00Z", requestedBy: "loop" })
  );
  const merged = requests.mergeStates(mine, published, { nowIso: "2026-10-16T12:08:00Z" });
  assert.deepEqual(merged.requests.map(row => row.ticket), [300456025, 111111111]);
  assert.equal(merged.updated_at_utc, "2026-10-16T12:08:00Z");
});

test("the log keeps its newest fifty asks and drops the rest", () => {
  let state = requests.createEmptyState("2026-10-16T00:00:00Z");
  for (let index = 0; index < 60; index += 1) {
    const stamp = `2026-10-16T00:${String(index).padStart(2, "0")}:00Z`;
    state = requests.appendRequests(state, [ask({ ticket: 100000000 + index, requestedAtUtc: stamp })]);
  }
  assert.equal(state.request_count, requests.MAX_REQUESTS);
  assert.equal(state.requests[state.requests.length - 1].ticket, 100000059);
  assert.equal(requests.validateRequestsState(state).length, 0);
});

test("the checker refuses a document the loop could misread, and accepts the one the page writes", () => {
  const good = requests.appendRequests(requests.createEmptyState("2026-10-16T12:00:00Z"), ask());
  assert.deepEqual(requests.validateRequestsState(good), []);
  assert.match(requests.validateRequestsState({ schema_version: "something-else", requests: [] })[0], /schema_version/);
  assert.match(
    requests.validateRequestsState({ schema_version: requests.LEGACY_SCHEMA_VERSION, requests: [] })[0],
    /name no account/
  );
  assert.match(requests.validateRequestsState({ schema_version: requests.SCHEMA_VERSION })[0], /requests must be an array/);
  const noAccount = requests.validateRequestsState({
    schema_version: requests.SCHEMA_VERSION,
    requests: [{ ticket: 12, requested_at_utc: "2026-10-16T12:00:00Z" }]
  });
  assert.match(noAccount[0], /names no account/);
  const badRow = requests.validateRequestsState({
    schema_version: requests.SCHEMA_VERSION,
    requests: [{ ticket: 0, requested_at_utc: "2026-10-16T12:00:00Z", account: { lane: "ftmo-1", login_masked: "***614" } }]
  });
  assert.match(badRow[0], /whole ticket number/);
  const badSide = requests.validateRequestsState({
    schema_version: requests.SCHEMA_VERSION,
    requests: [{ ...ask(), side: "sideways" }]
  });
  assert.match(badSide[0], /side must be buy or sell/);
  const tooLong = requests.validateRequestsState({
    schema_version: requests.SCHEMA_VERSION,
    requests: [{ ...ask(), expires_at_utc: "2026-10-16T23:00:00Z" }]
  });
  assert.match(tooLong[0], /later than the 30 minutes/);
  const duplicate = ask();
  assert.match(
    requests.validateRequestsState({ schema_version: requests.SCHEMA_VERSION, requests: [duplicate, { ...duplicate }] })[0],
    /is the same as requests\[0\]/
  );
});

test("a document with unreadable rows keeps the rows it can read rather than guessing at the others", () => {
  const raw = {
    schema_version: requests.SCHEMA_VERSION,
    updated_at_utc: "2026-10-16T12:00:00Z",
    requests: [
      ask(),
      { ticket: "no" },
      null,
      { ticket: 222222222, requested_at_utc: "not a time" },
      { ticket: 333333333, requested_at_utc: "2026-10-16T12:06:00Z" }
    ]
  };
  const state = requests.normaliseState(raw);
  assert.equal(state.request_count, 1, "a row with no account is not an ask this loop may act on");
  assert.equal(state.requests[0].ticket, 300456025);
  const text = requests.serialiseState(state);
  assert.match(text, /"schema_version": "live-trading-close-request-v2"/);
  assert.match(text, /"ticket": 300456025/);
  assert.match(text, /request, not an order/);
  assert.equal(text.endsWith("}\n"), true);
  const parsed = JSON.parse(text);
  assert.deepEqual(requests.validateRequestsState(parsed), []);
  assert.equal(requests.latestRequest(parsed).ticket, 300456025);
  assert.equal(requests.validateRequestsState(raw).length, 4, "the checker names every row it cannot read");
  assert.match(requests.validateRequestsState(raw)[0], /names no account/);
});

test("the commit builds the page's own contents API call for the one path this capability may touch", async () => {
  const target = requests.normaliseTarget({
    repo: "kevincreedycars-debug/trading-agent-dashboard",
    branch: "main",
    github: levelsStore
  });
  assert.equal(target.ok, true);
  assert.equal(target.path, "data/live-trading-close-request.json");
  const state = requests.appendRequests(requests.createEmptyState("2026-10-16T12:00:00Z"), ask());
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init: init || {} });
    if ((init?.method || "GET") === "GET") return { ok: false, status: 404 };
    return { ok: true, status: 201, json: async () => ({ content: { sha: "new-sha" }, commit: { sha: "commit-sha" } }) };
  };
  const result = await requests.commitRequests({
    fetchImpl,
    github: levelsStore,
    owner: target.owner,
    repo: target.repo,
    branch: target.branch,
    token: "ghp_example",
    path: target.path,
    state,
    message: "Ask the live loop to close a ticket (2026-10-16T12:05:01Z)",
    expectedSha: null
  });
  assert.equal(result.ok, true);
  assert.equal(result.sha, "new-sha");
  assert.equal(
    seen[0].url,
    "https://api.github.com/repos/kevincreedycars-debug/trading-agent-dashboard/contents/data/live-trading-close-request.json?ref=main"
  );
  const write = seen[1];
  assert.equal(write.init.method, "PUT");
  assert.match(write.init.headers.Authorization, /^Bearer /);
  const body = JSON.parse(write.init.body);
  assert.match(Buffer.from(body.content, "base64").toString("utf8"), /"ticket": 300456025/);
  assert.equal(body.sha, undefined);
});

test("the commit refuses without a token, and on a conflict hands back the sha it saw", async () => {
  const state = requests.appendRequests(requests.createEmptyState("2026-10-16T12:00:00Z"), ask());
  const base = {
    github: levelsStore,
    owner: "kevincreedycars-debug",
    repo: "trading-agent-dashboard",
    branch: "main",
    path: "data/live-trading-close-request.json",
    state,
    message: "Ask the live loop to close a ticket"
  };
  const noToken = await requests.commitRequests({
    ...base,
    fetchImpl: async () => ({ ok: false, status: 404 }),
    token: ""
  });
  assert.equal(noToken.ok, false);
  assert.match(noToken.error, /token/);

  const remoteDocument = requests.serialiseState(state);
  const conflict = await requests.commitRequests({
    ...base,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sha: "published-sha", content: Buffer.from(remoteDocument, "utf8").toString("base64") })
    }),
    token: "ghp_example",
    expectedSha: "sha-the-page-read"
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.sha, "published-sha");
  assert.match(conflict.error, /merged into the newest version/);
});

test("a mine-versus-published merge is what makes the conflict retry safe", () => {
  const theirs = requests.appendRequests(
    requests.createEmptyState("2026-10-16T12:00:00Z"),
    ask({ ticket: 999999999, requestedAtUtc: "2026-10-16T12:04:00Z" })
  );
  const mine = requests.appendRequests(requests.createEmptyState("2026-10-16T12:00:00Z"), ask());
  const merged = requests.mergeStates(mine, theirs, { nowIso: "2026-10-16T12:06:00Z" });
  assert.deepEqual(merged.requests.map(row => row.ticket), [999999999, 300456025]);
  assert.equal(requests.validateRequestsState(merged).length, 0);
});

test("a published document that is not this document is refused rather than replaced", async () => {
  const remote = await requests.readRemoteRequests({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sha: "s", content: Buffer.from("{\"schema_version\":\"l2l-levels-v1\"}", "utf8").toString("base64") })
    }),
    github: levelsStore,
    owner: "kevincreedycars-debug",
    repo: "trading-agent-dashboard",
    branch: "main",
    token: "ghp_example",
    path: "data/live-trading-close-request.json"
  });
  assert.equal(remote.ok, false);
  assert.match(remote.error, /not a close-request document/);
});

test("a read with no token still works, and a file that is not there yet is an empty log rather than an error", async () => {
  const missing = await requests.readRemoteRequests({
    fetchImpl: async () => ({ ok: false, status: 404 }),
    github: levelsStore,
    owner: "kevincreedycars-debug",
    repo: "trading-agent-dashboard",
    branch: "main",
    token: "",
    path: "data/live-trading-close-request.json"
  });
  assert.equal(missing.ok, true);
  assert.equal(missing.missing, true);
  assert.equal(missing.state.request_count, 0);
});
