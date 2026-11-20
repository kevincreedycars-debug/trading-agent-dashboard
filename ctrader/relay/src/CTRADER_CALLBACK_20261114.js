// Superseded on 2026-11-15, kept only so an operator who finds it in an old note is told what replaced it.
//
// This command wrote the token pair to a plaintext file. The consent path now seals the pair in the DPAPI vault,
// so this file is retired: it refuses to run and points at CTRADER_CONSENT_20261115.js instead of leaving a
// second, weaker way to hold a credential. Its loopback listener and exchange still live in
// CTRADER_OAUTH_20261114.js; only the plaintext destination is gone.
//
//   node docs/strategy/proposals/CTRADER_CONSENT_20261115.js --vault "C:\ProgramData\ctrader-relay\ctrader.vault.json"
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const crypto = require("node:crypto");

const oauth = require("./CTRADER_OAUTH_20261114.js");

const DEFAULT_PORT = oauth.CALLBACK_PORT;
const WAIT_MS = 10 * 60 * 1000;
const SUPERSEDED = "superseded_by_vault:use CTRADER_CONSENT_20261115.js, which seals the token in the DPAPI vault; this command would write a plaintext file";

function readConfig({ env = process.env, argv = [] } = {}) {
  const flags = { state: null, tokenFile: null, port: null, allowMissingState: false };
  const refusals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const take = () => {
      i += 1;
      return argv[i];
    };
    if (arg === "--allow-missing-state") flags.allowMissingState = true;
    else if (arg.startsWith("--state=")) flags.state = arg.slice("--state=".length);
    else if (arg === "--state") flags.state = take();
    else if (arg.startsWith("--token-file=")) flags.tokenFile = arg.slice("--token-file=".length);
    else if (arg === "--token-file") flags.tokenFile = take();
    else if (arg.startsWith("--port=")) flags.port = Number(arg.slice("--port=".length));
    else if (arg === "--port") flags.port = Number(take());
    else refusals.push(`unknown_argument:${arg}`);
  }
  const port = flags.port === null || flags.port === undefined ? DEFAULT_PORT : flags.port;
  if (!Number.isInteger(port) || port < 0 || port > 65535) refusals.push(`port_invalid:${flags.port}`);
  const clientId = env.CTRADER_CLIENT_ID || null;
  const clientSecret = env.CTRADER_CLIENT_SECRET || null;
  const tokenFile = flags.tokenFile || env.CTRADER_TOKEN_FILE || null;
  const redirectUri = env.CTRADER_REDIRECT_URI || `http://127.0.0.1:${port}/callback`;
  const expectedRedirect = `http://127.0.0.1:${port}/callback`;
  if (!clientId) refusals.push("client_id_missing:set CTRADER_CLIENT_ID");
  if (!clientSecret) refusals.push("client_secret_missing:set CTRADER_CLIENT_SECRET");
  if (!tokenFile) refusals.push("token_file_missing:pass --token-file");
  if (redirectUri !== expectedRedirect) {
    refusals.push(`redirect_uri_mismatch:${redirectUri} is not ${expectedRedirect}; the registered redirect must match exactly`);
  }
  const state = flags.state || env.CTRADER_STATE || crypto.randomBytes(16).toString("hex");
  if (typeof state !== "string" || state.length < 8) refusals.push("state_weak:pass a state of at least 8 characters");
  return {
    clientId,
    clientSecret,
    tokenFile,
    port,
    redirectUri,
    state,
    stateWasGenerated: !flags.state && !env.CTRADER_STATE,
    allowMissingState: flags.allowMissingState === true,
    refusals
  };
}

// Retired: the refusal is the whole behaviour. Nothing is listened for and no file is written, so an old note
// that still names this command cannot put a token on disk in plain text.
async function runConsent({ config } = {}) {
  if (!config || !Array.isArray(config.refusals)) throw new TypeError("a config from readConfig is required");
  return { ok: false, refusals: [...config.refusals, SUPERSEDED] };
}

if (require.main === module) {
  runConsent({ config: readConfig({ env: process.env, argv: process.argv.slice(2) }) })
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

module.exports = {
  DEFAULT_PORT,
  WAIT_MS,
  SUPERSEDED,
  readConfig,
  runConsent
};
