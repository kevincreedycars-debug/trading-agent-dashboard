// The one command the owner runs against the Challenge account, and its read-only twin.
//
//   node docs/strategy/proposals/CTRADER_RUN_20261114.js --vault <file> --login 7348195
//       Read only. Connects, authorises the login, and prints the account, the BTCUSD contract, the open exposure
//       and the last day of deals. It never arms and never sends.
//
//   node docs/strategy/proposals/CTRADER_RUN_20261114.js --vault <file> --login 7348195 --execute --confirm-account 12345678
//       The protected minimum-size buy: one market buy of the contract minimum, the contract's own minimum stop,
//       closed by position id 120 seconds after the broker's fill, then verified flat. Runs once.
//
//   node docs/strategy/proposals/CTRADER_RUN_20261114.js --vault <file> --journal <file> --recover
//       The guard's command: reads the journal, and if it still names an open test position, closes it and
//       verifies flat. It never sends an entry, and with an empty or closed journal it returns before the vault
//       is opened, so a scheduled guard costs nothing while nothing is in flight.
//
// Three rules are structural here, not comments:
//   1. Read-only is the default. A send happens only when --execute is present, and --execute is refused unless
//      the resolved account id is named with --confirm-account. The arming happens after that comparison, never
//      before, so a wrong account is stopped while the relay is still disarmed.
//   2. The credentials come from the sealed vault and are never printed or put on a command line.
//   3. Nothing is retried. The harness owns the single-use send and close; this file does not add a loop.
"use strict";

const fs = require("node:fs");
const tls = require("node:tls");
const path = require("node:path");

const adapter = require("./CTRADER_ADAPTER_20261114.js");
const transport = require("./CTRADER_TRANSPORT_20261114.js");
const secrets = require("./CTRADER_SECRETS_20261114.js");
const harness = require("./CTRADER_BTCUSD_TEST_20261113.js");
const journalModule = require("./CTRADER_JOURNAL_20261115.js");

const DEFAULT_LOGIN = 7348195;
const DEFAULT_VAULT = path.join("secrets", "ctrader.vault.json");
const JOURNAL_NAME = "btcusd-test-journal.json";
const HOLD_SECONDS = 120;

function readConfig({ env = process.env, argv = [] } = {}) {
  const flags = {
    vaultPath: null,
    journalPath: null,
    login: null,
    execute: false,
    recover: false,
    confirmAccount: null,
    environment: null,
    holdSeconds: null,
    maxRiskUsd: null,
    volumeLots: null,
    pollMs: null
  };
  const refusals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const take = () => {
      i += 1;
      return argv[i];
    };
    if (arg === "--execute") flags.execute = true;
    else if (arg === "--recover") flags.recover = true;
    else if (arg === "--check-app") flags.checkApp = true;
    else if (arg === "--read-only") flags.execute = false;
    else if (arg.startsWith("--vault=")) flags.vaultPath = arg.slice("--vault=".length);
    else if (arg === "--vault") flags.vaultPath = take();
    else if (arg.startsWith("--journal=")) flags.journalPath = arg.slice("--journal=".length);
    else if (arg === "--journal") flags.journalPath = take();
    else if (arg.startsWith("--login=")) flags.login = arg.slice("--login=".length);
    else if (arg === "--login") flags.login = take();
    else if (arg.startsWith("--confirm-account=")) flags.confirmAccount = arg.slice("--confirm-account=".length);
    else if (arg === "--confirm-account") flags.confirmAccount = take();
    else if (arg.startsWith("--environment=")) flags.environment = arg.slice("--environment=".length);
    else if (arg === "--environment") flags.environment = take();
    else if (arg.startsWith("--hold-seconds=")) flags.holdSeconds = Number(arg.slice("--hold-seconds=".length));
    else if (arg === "--hold-seconds") flags.holdSeconds = Number(take());
    else if (arg.startsWith("--max-risk-usd=")) flags.maxRiskUsd = Number(arg.slice("--max-risk-usd=".length));
    else if (arg === "--max-risk-usd") flags.maxRiskUsd = Number(take());
    else if (arg.startsWith("--volume=")) flags.volumeLots = Number(arg.slice("--volume=".length));
    else if (arg === "--volume") flags.volumeLots = Number(take());
    else if (arg.startsWith("--poll-ms=")) flags.pollMs = Number(arg.slice("--poll-ms=".length));
    else if (arg === "--poll-ms") flags.pollMs = Number(take());
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else refusals.push(`unknown_argument:${arg}`);
  }

  const vaultPath = flags.vaultPath || env.CTRADER_VAULT_FILE || DEFAULT_VAULT;
  // The journal sits beside the vault unless it is named, so the guard's scheduled task and the run command
  // cannot drift apart on which file records the exposure.
  const journalPath = flags.journalPath || env.CTRADER_JOURNAL_FILE
    || path.join(path.dirname(vaultPath || "."), JOURNAL_NAME);
  const login = flags.login === null || flags.login === undefined
    ? Number(env.CTRADER_TRADER_LOGIN || DEFAULT_LOGIN)
    : Number(flags.login);
  const environment = String(flags.environment || env.CTRADER_ENVIRONMENT || "demo").toLowerCase();
  const holdSeconds = flags.holdSeconds === null ? HOLD_SECONDS : flags.holdSeconds;
  const maxRiskUsd = flags.maxRiskUsd === null ? 1 : flags.maxRiskUsd;
  const pollMs = flags.pollMs === null ? 5000 : flags.pollMs;

  if (!vaultPath) refusals.push("vault_missing:pass --vault");
  if (!Number.isInteger(login) || login <= 0) refusals.push(`login_invalid:${flags.login}`);
  if (environment !== "demo" && environment !== "live") refusals.push(`environment_invalid:${environment}`);
  if (!(holdSeconds > 0)) refusals.push(`hold_invalid:${holdSeconds}`);
  if (!(maxRiskUsd > 0)) refusals.push(`max_risk_invalid:${maxRiskUsd}`);
  if (!(pollMs > 0)) refusals.push(`poll_invalid:${pollMs}`);
  if (flags.execute && flags.recover) {
    refusals.push("execute_and_recover:one invocation either sends the test or recovers it, never both");
  }
  if (flags.checkApp && (flags.execute || flags.recover)) {
    refusals.push("check_app_with_send:--check-app only asks whether the app is active, so it never travels with --execute or --recover");
  }
  const confirmAccount = flags.confirmAccount === null ? null : String(flags.confirmAccount).trim();
  if (flags.execute && !confirmAccount) {
    refusals.push("execute_without_confirmation:--execute also needs --confirm-account with the account id the run must find");
  }

  return {
    vaultPath,
    journalPath,
    login,
    execute: flags.execute === true,
    recover: flags.recover === true,
    checkApp: flags.checkApp === true,
    confirmAccount,
    environment,
    holdMs: Math.round(holdSeconds * 1000),
    maxRiskUsd,
    volumeLots: flags.volumeLots === null ? null : flags.volumeLots,
    pollMs,
    help: flags.help === true,
    refusals
  };
}


function codedError(code, message, extra) {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

// A token that is close to expiring is refreshed before the socket opens, so an authorisation cannot fail
// halfway through a two-minute hold. The refreshed pair is written back through the same sealed vault.
//
// A vault that holds the app credentials but no token pair yet is the normal state between put-app and consent.
// It stops here with its own code, so the operator is told to run the consent command rather than to look for a
// broken vault.
async function prepareCredentials({
  vaultPath,
  store,
  fsImpl = fs,
  now = () => Date.now(),
  refresh,
  marginMs = 120000
} = {}) {
  let opened;
  try {
    opened = secrets.readVault({ path: vaultPath, store, fs: fsImpl });
  } catch (err) {
    if (err && err.code === "token_missing") {
      throw codedError(
        "consent_incomplete",
        "the vault holds the app credentials but no token pair yet; run the consent command to authorise it"
      );
    }
    throw err;
  }
  const { secrets: stored, meta } = opened;
  const expiresAtMs = Date.parse(stored.accessTokenExpiresAtUtc || "") || null;
  const fresh = expiresAtMs === null || expiresAtMs - marginMs > now();
  if (fresh) return { credentials: stored, meta, refreshed: false };
  if (!stored.refreshToken) {
    throw codedError("token_expired", "the stored access token has expired and no refresh token was kept; run the consent command again");
  }
  if (typeof refresh !== "function") {
    throw codedError("refresh_missing", "the access token has expired and no refresh function was supplied");
  }
  const tokens = await refresh({
    clientId: stored.clientId,
    clientSecret: stored.clientSecret,
    refreshToken: stored.refreshToken
  });
  const next = {
    ...stored,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || stored.refreshToken,
    accessTokenExpiresAtUtc: tokens.expiresAtMs ? new Date(tokens.expiresAtMs).toISOString() : null
  };
  secrets.writeVault({ path: vaultPath, secrets: next, store, fs: fsImpl, now, user: meta.user });
  return { credentials: next, meta, refreshed: true };
}

// The socket and the session it feeds. The session is created after the transport because the transport needs a
// handler for the bytes it reads; the small holder is what breaks that knot without a second connection.
async function openConnection({ config, deps = {} }) {
  const tlsImpl = deps.tls || tls;
  const now = deps.now || (() => Date.now());
  const log = deps.log || ((line) => process.stdout.write(`${line}\n`));
  const events = adapter.createEventBus();
  let session = null;
  let transportError = null;
  const raw = transport.createTlsTransport({
    environment: config.environment,
    tls: tlsImpl,
    onData: (text) => {
      if (session) session.handleChunk(text);
    },
    onClose: (reason) => log(`connection closed: ${reason || "by peer"}`),
    onError: (err) => {
      transportError = err;
      log(`connection error: ${err && err.message ? err.message : err}`);
    }
  });
  await raw.ready;
  session = transport.createSession({
    transport: raw,
    now,
    requestTimeoutMs: deps.requestTimeoutMs || 20000,
    onEvent: (message) => events.send(message),
    onError: (err) => log(`session error: ${err && err.message ? err.message : err}`)
  });
  session.startHeartbeat();
  return {
    session,
    raw,
    events,
    getTransportError: () => transportError,
    close() {
      session.close("run_finished");
    }
  };
}

// Read-only: the account, the contract, the exposure and the recent deals. No arming, no order.
async function readOnlyReport({ client, login, now = () => Date.now(), days = 1 } = {}) {
  const account = await client.getAccount();
  const spec = await client.getSymbolSpec("BTCUSD");
  const exposures = await client.listExposures("BTCUSD");
  const referencePrice = await client.getReferencePrice("BTCUSD");
  const toTimestampMs = now();
  const deals = await client.getDealsHistory({ fromTimestampMs: toTimestampMs - days * 24 * 3600 * 1000, maxRows: 20 });
  return {
    login,
    account,
    spec,
    exposures,
    referencePrice,
    dealCount: deals.length,
    recentDeals: deals.slice(-5),
    sent: 0
  };
}

// The journal sees the same calls the harness makes, so it learns the position id and the deadline from the broker's
// own answers. Everything else passes straight through: the wrapper adds writes, not behaviour.
function withJournal({ client, journal, login, holdMs }) {
  let accountId = null;
  return {
    ...client,
    async getAccount() {
      const account = await client.getAccount();
      accountId = account && account.accountId !== undefined ? String(account.accountId) : accountId;
      return account;
    },
    async sendMarketOrder(request = {}) {
      // Before the send, not after: an order whose answer never arrives still leaves a record behind.
      journal.beginIntent({
        login,
        accountId,
        clientOrderId: request.requestId,
        side: request.side,
        volume: request.volume,
        symbol: request.symbol,
        holdMs
      });
      const result = await client.sendMarketOrder(request);
      if (result && (result.outcome === "accepted" || result.outcome === "unknown")) {
        journal.recordSent({ orderId: result.orderId || null, positionId: result.positionId || null });
      }
      return result;
    },
    async getExecution(args) {
      const execution = await client.getExecution(args);
      if (execution && execution.positionId) {
        journal.recordFill({
          positionId: execution.positionId,
          orderId: execution.orderId,
          fillPrice: execution.fillPrice,
          fillVolume: execution.filledVolume,
          fillTimeUtc: execution.fillTimeUtc
        });
      }
      return execution;
    },
    async getPosition(positionId) {
      const position = await client.getPosition(positionId);
      if (positionId && position && position.state === "closed") {
        journal.recordClosed({
          status: "closed_seen",
          positionId,
          closePrice: position.closePrice,
          closeTimeUtc: position.closeTimeUtc
        });
      }
      return position;
    },
    async closePosition(request = {}) {
      journal.recordCloseRequest({ reason: request.reason || null });
      return client.closePosition(request);
    }
  };
}

// The guard's one action: close what the journal names and verify it. It never opens a position, never resends and
// never reads an exchange rate; an entry whose identifier cannot be established is escalated, not guessed at.
async function recoverOnce({
  client,
  journal,
  plan,
  log = () => {},
  now = () => Date.now(),
  sleep,
  closeTimeoutMs = 45000
} = {}) {
  if (!client) throw new TypeError("recoverOnce needs a client");
  if (!journal) throw new TypeError("recoverOnce needs a journal");
  const wait = typeof sleep === "function" ? sleep : (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  if (!plan || plan.action === "none") return { ok: true, status: "nothing_to_do", reason: plan ? plan.reason : "no_plan" };
  if (plan.action === "escalate") return { ok: false, status: "escalated", reason: plan.reason };

  let positionId = plan.positionId || null;
  if (!positionId) {
    const adopted = await client.findByRequestId(plan.clientOrderId);
    positionId = adopted && adopted.position ? adopted.position.positionId : null;
    if (!positionId) {
      journal.recordClosed({ status: "absent_at_recovery" });
      log(`recover: no position carries order ${plan.clientOrderId}; recorded as absent, nothing was sent`);
      return { ok: true, status: "absent", clientOrderId: plan.clientOrderId };
    }
    // Adopted, never resent: the id that was sent is the id the order is found by.
    journal.recordSent({ orderId: adopted.order ? adopted.order.orderId : null, positionId });
    log(`recover: order ${plan.clientOrderId} is position ${positionId}, adopted`);
  }

  const position = await client.getPosition(positionId);
  if (!position) {
    journal.recordClosed({ status: "absent_at_recovery", positionId });
    log(`recover: position ${positionId} is not at the broker any more; recorded as absent`);
    return { ok: true, status: "absent", positionId };
  }
  if (position.state === "closed") {
    journal.recordClosed({
      status: "closed_before_recovery",
      positionId,
      closePrice: position.closePrice,
      closeTimeUtc: position.closeTimeUtc
    });
    log(`recover: position ${positionId} was already closed at ${position.closeTimeUtc || "an unrecorded time"}`);
    return { ok: true, status: "already_closed", positionId };
  }

  journal.recordCloseRequest({ reason: "recovery" });
  const close = await client.closePosition({ positionId, volume: position.volume, requestId: `${positionId}-recover`, reason: "recovery" });
  log(`recover: close sent for position ${positionId} (${close && close.outcome ? close.outcome : "unknown"})`);
  const deadline = now() + closeTimeoutMs;
  let last = position;
  while (last && last.state === "open" && now() < deadline) {
    await wait(Math.min(5000, Math.max(0, deadline - now())));
    last = await client.getPosition(positionId);
  }
  if (last && last.state === "open") {
    journal.recordUncertain({ reason: "close_unconfirmed_at_recovery", positionId });
    log(`recover: position ${positionId} is still open after the close; a person has to look at cTrader`);
    return { ok: false, status: "close_unconfirmed", positionId };
  }
  journal.recordClosed({
    status: "closed_at_recovery",
    positionId,
    closePrice: last ? last.closePrice : null,
    closeTimeUtc: last ? last.closeTimeUtc : null
  });
  log(`recover: position ${positionId} is closed`);
  return { ok: true, status: "closed_at_recovery", positionId, closePrice: last ? last.closePrice : null };
}

// The one execution path. The arming comes after the account comparison, so a mismatch leaves the relay as it was
// found, and a throw during the run still disarms.
async function executeOnce({ client, config, now = () => Date.now(), sleep, journal, runTest = harness.runTest } = {}) {
  const target = journal ? withJournal({ client, journal, login: config.login, holdMs: config.holdMs }) : client;
  const account = await target.getAccount();
  const resolved = String(account && account.accountId);
  if (!config.confirmAccount || resolved !== String(config.confirmAccount)) {
    return {
      status: "refused",
      refusals: [`account_not_confirmed:${resolved} is not ${config.confirmAccount || "(none named)"}`],
      armed: typeof target.isArmed === "function" ? target.isArmed() : null
    };
  }
  await target.setArmed(true);
  const requestId = `btc-test-${new Date(now()).toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
  try {
    const result = await runTest({
      client: target,
      config: {
        confirmedAccountId: String(config.confirmAccount),
        armed: target.isArmed(),
        copyingEnabled: false,
        killSwitch: false,
        now,
        holdMs: config.holdMs,
        pollMs: config.pollMs,
        maxRiskUsd: config.maxRiskUsd,
        volume: config.volumeLots === null ? undefined : config.volumeLots,
        requestId
      },
      sleep
    });
    return { ...result, requestId };
  } finally {
    // The harness disarms on every terminal path; this is only the belt for a throw.
    if (typeof target.isArmed === "function" && target.isArmed()) {
      try {
        await target.setArmed(false);
      } catch (err) {
        // Nothing else to do: the run is over and the relay is a local flag.
      }
    }
  }
}

function printReadOnly({ report, log }) {
  const { account, spec, exposures, referencePrice } = report;
  log(`login ${report.login} -> account ${account.accountId} (${account.broker || "broker unnamed"}, ${account.isLive ? "live" : "demo"})`);
  log(`balance ${account.balance} ${account.currency || ""}, hedging ${account.hedgingMode}`);
  log(`BTCUSD lots ${spec.lotSizeBtc} BTC, min ${spec.minVolume}, step ${spec.volumeStep}, digits ${spec.digits}`);
  log(`BTCUSD min stop ${spec.minStopDistance} in price, trade mode ${spec.tradeMode}`);
  log(`reference ask ${referencePrice}`);
  log(`open positions ${(exposures.positions || []).length}, pending orders ${(exposures.orders || []).length}`);
  log(`deals in the last day: ${report.dealCount}`);
}

// The application, before any token exists.
//
// A consent page can render an application that the broker will then refuse, and that refusal never reaches the
// listener because the portal does not redirect at all. The application handshake answers the same question
// directly: it needs no token, it authorises no account and it touches no money, so it is safe to run at any point,
// including between put-app and consent. The client id is masked and the secret is never printed.
function maskClientId(clientId) {
  const text = String(clientId || "");
  return text.length > 10 ? `${"*".repeat(8)}${text.slice(-4)}` : "*".repeat(text.length);
}

async function checkApp({ config, deps = {} }) {
  const log = deps.log || ((line) => process.stdout.write(`${line}\n`));
  const env = deps.env || process.env;
  const fsImpl = deps.fs || fs;
  const store = deps.store || secrets.createDpapiStore({
    runPowerShell: deps.runPowerShell || secrets.createPowerShellRunner(),
    user: deps.user || env.USERNAME || null
  });
  // Pending is allowed here on purpose: this is the check an operator runs *because* there is no token yet.
  let opened;
  try {
    opened = secrets.readVault({ path: config.vaultPath, store, fs: fsImpl, pending: true });
  } catch (err) {
    log(`refused: ${err && err.code ? err.code : "vault_error"}: ${err && err.message ? err.message : err}`);
    return { ok: false, mode: "check-app", exitCode: 2 };
  }
  const { clientId, clientSecret } = opened.secrets;
  if (!clientId || !clientSecret) {
    log("refused: secret_missing: the vault holds no client id and secret pair; run put-app first");
    return { ok: false, mode: "check-app", exitCode: 2 };
  }
  log(`app: client id ${maskClientId(clientId)}, vault ${opened.secrets.accessToken ? "authorised" : "pending"}`);

  const connection = await (deps.openConnection || openConnection)({ config, deps: { ...deps, env, log } });
  try {
    try {
      await connection.session.call(
        transport.PAYLOAD.applicationAuthReq,
        { clientId: String(clientId), clientSecret: String(clientSecret) },
        { timeoutMs: deps.requestTimeoutMs || 20000 }
      );
      log(`app: ${config.environment} accepted the credentials; the application is active`);
      return { ok: true, mode: "check-app", exitCode: 0 };
    } catch (err) {
      const code = err && err.code ? err.code : "unknown";
      const errorCode = err && err.errorCode ? err.errorCode : "none";
      const description = err && (err.description || err.message) ? err.description || err.message : "none";
      log(`app: ${config.environment} refused the credentials: ${code} ${errorCode}: ${description}`);
      if (errorCode === "CH_CLIENT_AUTH_FAILURE") {
        log("app: the application itself is not usable, so this is a portal problem and not a relay one; activate or re-create the app, store the new pair with put-app, and check again");
      }
      return { ok: false, mode: "check-app", code, errorCode, description, exitCode: 2 };
    }
  } finally {
    connection.close();
  }
}


async function main(argv = process.argv.slice(2), deps = {}) {
  const env = deps.env || process.env;
  const log = deps.log || ((line) => process.stdout.write(`${line}\n`));
  const now = deps.now || (() => Date.now());
  const config = readConfig({ env, argv });
  if (config.help) {
    log("node CTRADER_RUN_20261114.js --vault <file> [--login <n>]                     read-only verification");
    log("node CTRADER_RUN_20261114.js --vault <file> --execute --confirm-account <id>  the one protected test");
    log("node CTRADER_RUN_20261114.js --vault <file> --recover                         close what the journal still names");
    log("node CTRADER_RUN_20261114.js --vault <file> --check-app                       ask the broker whether the app is active");
    return { ok: true, mode: "help", exitCode: 0 };
  }
  if (config.refusals.length) {
    for (const refusal of config.refusals) log(`refused: ${refusal}`);
    return { ok: false, mode: "refused", refusals: config.refusals, exitCode: 2 };
  }

  if (config.checkApp) return checkApp({ config, deps: { ...deps, env, log } });

  const fsImpl = deps.fs || fs;
  const journal = (deps.createJournal || journalModule.createJournal)({ path: config.journalPath, fs: fsImpl, now });
  let plan = null;
  if (config.recover || config.execute) {
    // Read the journal before anything expensive: a guard with nothing to do must cost nothing, and a send must
    // not start while an earlier entry is still open.
    try {
      plan = journalModule.planRecovery(journal.read(), now);
    } catch (err) {
      log(`refused: ${err && err.code ? err.code : "journal_error"}: ${err && err.message ? err.message : err}`);
      return { ok: false, mode: "journal", exitCode: 2 };
    }
    log(`journal ${config.journalPath} -> ${plan.action} (${plan.reason})`);
    if (config.recover) {
      if (plan.action === "none") {
        log("recover: nothing is owed; the vault was not opened and nothing was sent");
        return { ok: true, mode: "recover", plan, sent: 0, exitCode: 0 };
      }
      if (plan.action === "escalate") {
        log("recover: the journal names neither a position nor an order id, so nothing can be closed safely; look at cTrader by hand");
        return { ok: false, mode: "recover", plan, sent: 0, exitCode: 2 };
      }
    } else if (plan.action !== "none") {
      log(`refused: the journal still records ${plan.reason}; run --recover first, because a second entry must not overlap the first`);
      return { ok: false, mode: "execute", plan, sent: 0, exitCode: 2 };
    }
  }

  const store = deps.store || secrets.createDpapiStore({
    runPowerShell: deps.runPowerShell || secrets.createPowerShellRunner(),
    user: deps.user || env.USERNAME || null
  });
  let prepared;
  try {
    prepared = await prepareCredentials({ vaultPath: config.vaultPath, store, fsImpl, now, refresh: deps.refresh });
  } catch (err) {
    log(`refused: ${err && err.code ? err.code : "vault_error"}: ${err && err.message ? err.message : err}`);
    return { ok: false, mode: "credentials", exitCode: 2 };
  }
  if (prepared.refreshed) log("the access token was refreshed and the vault rewritten");

  const connection = await (deps.openConnection || openConnection)({ config, deps: { ...deps, now, log } });
  try {
    const connected = await adapter.connectAccount({
      session: connection.session,
      clientId: prepared.credentials.clientId,
      clientSecret: prepared.credentials.clientSecret,
      accessToken: prepared.credentials.accessToken,
      traderLogin: config.login,
      expectLive: config.environment === "live"
    });
    log(`authorised: login ${config.login} is account ${connected.accountId} on "${connected.account.broker}" (${connected.account.isLive ? "live" : "demo"})`);
    const client = adapter.createAdapter({
      session: connection.session,
      events: connection.events,
      account: connected.account,
      config: { now, pollMs: 1000, spotMaxAgeMs: 15000, spotTimeoutMs: 20000 }
    });
    if (config.recover) {
      const recovery = await recoverOnce({ client, journal, plan, log, now, sleep: deps.sleep });
      return { ok: recovery.ok, mode: "recover", plan, recovery, exitCode: recovery.ok ? 0 : 2 };
    }
    if (!config.execute) {
      const report = await readOnlyReport({ client, login: config.login, now });
      printReadOnly({ report, log });
      return { ok: true, mode: "read-only", report, exitCode: 0 };
    }
    log("execute: one protected minimum-size BTCUSD buy, then close at the deadline");
    const result = await executeOnce({ client, config, now, sleep: deps.sleep, journal, runTest: deps.runTest });
    if (result.status === "refused") {
      for (const refusal of result.refusals || []) log(`refused: ${refusal}`);
      log("nothing was armed and nothing was sent");
      return { ok: false, mode: "execute", result, exitCode: 2 };
    }
    log(`status ${result.status}`);
    if (result.report) log(`report ${JSON.stringify(result.report)}`);
    for (const alert of result.alerts || []) log(`alert: ${alert}`);
    const flat = Boolean(result.report && result.report.flat === true);
    return { ok: flat, mode: "execute", result, exitCode: flat ? 0 : 2 };
  } finally {
    connection.close();
  }
}

if (require.main === module) {
  let oauth = null;
  try {
    oauth = require("./CTRADER_OAUTH_20261114.js");
  } catch (err) {
    oauth = null;
  }
  main(process.argv.slice(2), {
    fs,
    refresh: oauth && typeof oauth.refreshAccessToken === "function"
      ? (args) => oauth.refreshAccessToken({ ...args, fetchImpl: globalThis.fetch })
      : undefined
  })
    .then((result) => {
      process.exitCode = result && Number.isInteger(result.exitCode) ? result.exitCode : 0;
    })
    .catch((err) => {
      process.stderr.write(`failed: ${err && err.code ? err.code : "error"}: ${err && err.message ? err.message : err}\n`);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_LOGIN,
  DEFAULT_VAULT,
  JOURNAL_NAME,
  HOLD_SECONDS,
  readConfig,
  prepareCredentials,
  openConnection,
  readOnlyReport,
  withJournal,
  recoverOnce,
  executeOnce,
  printReadOnly,
  maskClientId,
  checkApp,
  main
};

