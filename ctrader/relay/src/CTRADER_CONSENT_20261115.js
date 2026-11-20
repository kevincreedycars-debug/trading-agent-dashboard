// Consent on the machine that holds the vault: the owner's browser is elsewhere, the listener is here.
//
//   node docs/strategy/proposals/CTRADER_CONSENT_20261115.js --vault C:\ProgramData\ctrader-relay\secrets\ctrader.vault.json
//
// The app credentials come from the vault, which the put-app command fills first, or from the session environment:
//
//   $env:CTRADER_CLIENT_ID = "<the app's client id>"
//   $env:CTRADER_CLIENT_SECRET = "<the app's client secret>"
//
// It prints the documented consent link with a fresh state value, listens on 127.0.0.1:8765/callback, exchanges
// the code it receives, and seals the token pair straight into the DPAPI vault. There is no plaintext token file
// in this path at all. The app credentials come from the session environment (never a command line) or, when the
// vault already exists, from the vault itself, so a re-consent after an expiry needs no secret typed again.
//
// The redirect is only reachable when the owner forwards the loopback port over the same SSH session:
//   ssh -L 8765:127.0.0.1:8765 <user>@<host>
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const crypto = require("node:crypto");

const oauth = require("./CTRADER_OAUTH_20261114.js");
const secrets = require("./CTRADER_SECRETS_20261114.js");

const DEFAULT_PORT = oauth.CALLBACK_PORT;
const DEFAULT_WAIT_SECONDS = 600;

function readConfig({ env = process.env, argv = [] } = {}) {
  const flags = { vaultPath: null, port: null, scope: null, waitSeconds: null, allowMissingState: false };
  const refusals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const take = () => {
      i += 1;
      return argv[i];
    };
    if (arg === "--allow-missing-state") flags.allowMissingState = true;
    else if (arg.startsWith("--vault=")) flags.vaultPath = arg.slice("--vault=".length);
    else if (arg === "--vault") flags.vaultPath = take();
    else if (arg.startsWith("--port=")) flags.port = Number(arg.slice("--port=".length));
    else if (arg === "--port") flags.port = Number(take());
    else if (arg.startsWith("--scope=")) flags.scope = arg.slice("--scope=".length);
    else if (arg === "--scope") flags.scope = take();
    else if (arg.startsWith("--wait-seconds=")) flags.waitSeconds = Number(arg.slice("--wait-seconds=".length));
    else if (arg === "--wait-seconds") flags.waitSeconds = Number(take());
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else refusals.push(`unknown_argument:${arg}`);
  }
  const vaultPath = flags.vaultPath || env.CTRADER_VAULT_FILE || null;
  const port = flags.port === null || flags.port === undefined ? DEFAULT_PORT : flags.port;
  const scope = String(flags.scope || "trading").toLowerCase();
  const waitSeconds = flags.waitSeconds === null || flags.waitSeconds === undefined ? DEFAULT_WAIT_SECONDS : flags.waitSeconds;
  const redirectUri = `http://${oauth.CALLBACK_HOST}:${port}${oauth.CALLBACK_PATH}`;
  if (!vaultPath) refusals.push("vault_missing:pass --vault with the sealed file to write");
  if (!Number.isInteger(port) || port < 1 || port > 65535) refusals.push(`port_invalid:${flags.port}`);
  if (scope !== oauth.SCOPES.trading && scope !== oauth.SCOPES.accounts) refusals.push(`scope_invalid:${scope}`);
  if (!(waitSeconds > 0)) refusals.push(`wait_invalid:${flags.waitSeconds}`);
  return {
    vaultPath,
    port,
    scope,
    waitSeconds,
    waitMs: Math.round(waitSeconds * 1000),
    redirectUri,
    allowMissingState: flags.allowMissingState === true,
    help: flags.help === true,
    refusals
  };
}

// The vault wins when it exists, because it is already sealed for this user and the app credentials in it are
// known good. Otherwise the session environment supplies them. A pending vault - the credentials stored ahead of
// consent - is enough here, which is why this reads with pending allowed. Nothing is ever read from a plaintext file.
function resolveAppCredentials({ vaultPath, env = process.env, store, fsImpl = fs } = {}) {
  let existing = null;
  try {
    existing = secrets.readVault({ path: vaultPath, store, fs: fsImpl, pending: true });
  } catch (err) {
    if (!err || (err.code !== "vault_missing" && err.code !== "vault_corrupt" && err.code !== "vault_version_unsupported")) throw err;
    existing = null;
  }
  const fromVault = existing ? existing.secrets : null;
  const clientId = (fromVault && fromVault.clientId) || env.CTRADER_CLIENT_ID || null;
  const clientSecret = (fromVault && fromVault.clientSecret) || env.CTRADER_CLIENT_SECRET || null;
  const missing = [];
  if (!clientId) missing.push("client_id_missing:set CTRADER_CLIENT_ID in this session");
  if (!clientSecret) missing.push("client_secret_missing:set CTRADER_CLIENT_SECRET in this session");
  return {
    clientId,
    clientSecret,
    previous: fromVault,
    meta: existing ? existing.meta : null,
    source: fromVault ? "vault" : "environment",
    missing
  };
}

// Refusals that mean the attempt is over. A stray request for another path or another method is noise from
// whatever else is on the port, and the listener stays open for the redirect that matters.
const TERMINAL_REFUSALS = new Set([
  "state_missing",
  "state_mismatch",
  "consent_error",
  "no_code",
  "code_too_old",
  "already_used",
  "exchange_failed"
]);

function explain(refusal) {
  const reason = refusal && refusal.reason;
  if (reason === "state_missing") {
    return "the redirect arrived without a state value, so the code was dropped before any exchange. If the portal cannot return one, rerun with --allow-missing-state; that downgrade is deliberate and is printed when it is on.";
  }
  if (reason === "state_mismatch") return "the redirect carried a state this listener did not issue; the code was dropped.";
  if (reason === "consent_error") return "cTrader reported that consent was not granted; nothing was stored.";
  if (reason === "exchange_failed") return "the code arrived but the exchange failed; nothing was stored and the code is spent.";
  if (reason === "code_too_old") return "the redirect arrived after the code's one-minute life; start consent again.";
  if (reason === "already_used") return "this callback was already consumed once; start consent again.";
  return `the redirect was refused (${reason || "unknown"}); nothing was stored.`;
}

async function runConsent({ config, deps = {} } = {}) {
  const httpImpl = deps.http || http;
  const fsImpl = deps.fs || fs;
  const log = deps.log || ((line) => process.stdout.write(`${line}\n`));
  const now = deps.now || (() => Date.now());
  if (!config || !Array.isArray(config.refusals)) throw new TypeError("a config from readConfig is required");
  if (config.refusals.length) return { ok: false, refusals: config.refusals };

  const store = deps.store || secrets.createDpapiStore({
    runPowerShell: deps.runPowerShell || secrets.createPowerShellRunner(),
    user: deps.user || null
  });
  const app = resolveAppCredentials({ vaultPath: config.vaultPath, env: deps.env || process.env, store, fsImpl });
  if (app.missing.length) return { ok: false, refusals: app.missing };

  const state = crypto.randomBytes(16).toString("hex");
  const consentUrl = oauth.buildConsentUrl({
    clientId: app.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope,
    product: "web",
    state
  });

  let tokens = null;
  let written = null;
  let exchangeError = null;
  let refusal = null;
  let announce;
  const settled = new Promise((resolve) => {
    announce = resolve;
  });
  const listener = oauth.startCallbackListener({
    http: httpImpl,
    port: config.port,
    state,
    allowMissingState: config.allowMissingState,
    onRefusal: (info) => {
      if (!TERMINAL_REFUSALS.has(info && info.reason)) return;
      refusal = info;
      announce("refused");
    },
    onCode: async (code) => {
      try {
        tokens = await oauth.exchangeCode({
          clientId: app.clientId,
          clientSecret: app.clientSecret,
          code,
          redirectUri: config.redirectUri,
          fetchImpl: deps.fetchImpl,
          now
        });
        written = secrets.writeVault({
          path: config.vaultPath,
          secrets: {
            clientId: app.clientId,
            clientSecret: app.clientSecret,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || null,
            accessTokenExpiresAtUtc: tokens.expiresAtMs ? new Date(tokens.expiresAtMs).toISOString() : null
          },
          store,
          fs: fsImpl,
          now,
          user: (app.meta && app.meta.user) || deps.user || null
        });
        announce("received");
      } catch (err) {
        exchangeError = err;
        announce("failed");
        throw err;
      }
    }
  });


  const ready = await listener.ready;
  log(`listening on ${ready.url}`);
  log(`redirect: ${config.redirectUri}`);
  log(`client id: ${secrets.mask(app.clientId)} (app credentials from the ${app.source})`);
  log(`scope: ${config.scope}, product web, one use`);
  log(`vault: ${config.vaultPath}`);
  if (config.allowMissingState) log("warning: --allow-missing-state is on; a redirect without a state value will be accepted once");
  log(`state: ${state}`);
  log(`consent link: ${consentUrl}`);
  log(`waiting up to ${config.waitSeconds} seconds for the callback...`);

  let timer = null;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve("timeout"), config.waitMs);
  });
  const outcome = await Promise.race([settled, deadline]);
  if (timer) clearTimeout(timer);
  // The browser still has to receive its page, so the listener closes a moment after the handler returns.
  await new Promise((resolve) => setTimeout(resolve, 250));
  await listener.close();

  if (outcome === "received") {
    log(`sealed ${written.path} (${written.scope}, user ${written.user || "unknown"})`);
    log(`summary: ${JSON.stringify(oauth.tokenSummary(tokens))}`);
    log("the token pair is in the vault; no plaintext token file was written by this command");
    return { ok: true, state, vaultPath: written.path, summary: oauth.tokenSummary(tokens), scope: config.scope };
  }
  if (outcome === "refused") {
    log(`refused: ${explain(refusal)}`);
    return { ok: false, refusals: [`refused:${refusal && refusal.reason ? refusal.reason : "unknown"}`], state, vaultPath: config.vaultPath };
  }
  if (outcome === "failed") {
    log(`token exchange failed: ${exchangeError && exchangeError.code ? exchangeError.code : "error"}; nothing was stored`);
    return { ok: false, refusals: ["token_exchange_failed"], state, vaultPath: config.vaultPath };
  }
  log("no callback arrived in time; nothing was stored");
  return { ok: false, refusals: ["callback_timeout"], state, vaultPath: config.vaultPath };
}

if (require.main === module) {
  const config = readConfig({ env: process.env, argv: process.argv.slice(2) });
  if (config.help) {
    process.stdout.write("usage: node CTRADER_CONSENT_20261115.js --vault <file> [--port 8765] [--scope trading|accounts] [--wait-seconds 600] [--allow-missing-state]\n");
  } else {
    runConsent({ config })
      .then((result) => {
        if (!result.ok) {
          for (const refusal of result.refusals) process.stderr.write(`refused: ${refusal}\n`);
          process.exitCode = 2;
        }
      })
      .catch((err) => {
        process.stderr.write(`failed: ${err && err.code ? err.code : "error"}: ${err && err.message ? err.message : err}\n`);
        process.exitCode = 1;
      });
  }
}

module.exports = {
  DEFAULT_PORT,
  DEFAULT_WAIT_SECONDS,
  TERMINAL_REFUSALS,
  readConfig,
  resolveAppCredentials,
  runConsent
};

