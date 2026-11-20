// The one-time OAuth callback for the cTrader Open API, and the code-for-token exchange that follows it.
//
// The consent redirect is the only moment a credential arrives from a browser, so the listener is deliberately
// narrow: loopback only, one path, one state value, one use, GET only, and a response that never repeats the code
// back. The exchange is the documented HTTP call: GET /apps/token with grant_type=authorization_code and the
// same redirect_uri that was registered.
//
// Nothing here reads a stored credential. The caller passes the app's client id and secret in, and the tokens
// leave through the caller's own store.
"use strict";

const TOKEN_ENDPOINT = "https://openapi.ctrader.com/apps/token";
// The page the owner is sent to. Its documented parameters are client_id, redirect_uri, scope and product; the
// scope is "accounts" (view only) or "trading". State is not in the table, so it is appended as well and the
// listener still refuses a redirect without one unless that refusal is explicitly waived.
const CONSENT_ENDPOINT = "https://id.ctrader.com/my/settings/openapi/grantingaccess/";
const SCOPES = Object.freeze({ accounts: "accounts", trading: "trading" });
const CALLBACK_PATH = "/callback";
const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PORT = 8765;
const CODE_LIFETIME_MS = 60000; // the docs state one minute; a stale arrival is refused rather than exchanged

function codedError(code, message, extra) {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

function parseCallback(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ""), `http://${CALLBACK_HOST}`);
  } catch (err) {
    return { path: null, code: null, state: null, error: "unparsable_url" };
  }
  return {
    path: url.pathname,
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    error: url.searchParams.get("error"),
    errorDescription: url.searchParams.get("error_description")
  };
}

// Compared without early exit so a wrong state cannot be discovered byte by byte from timing. The values are
// short and the window is a minute, so this is belt and braces rather than the main defence.
function sameValue(a, b) {
  const left = String(a === undefined || a === null ? "" : a);
  const right = String(b === undefined || b === null ? "" : b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function html(title, line) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>`
    + `<body style="font-family:system-ui;margin:4rem auto;max-width:32rem">`
    + `<h1>${title}</h1><p>${line}</p></body>`;
}

// The handler is a plain (req, res) function so a test can call it with two fake objects and no socket. It
// answers 200 once and refuses everything else: another path, another method, another state, a repeated code, a
// stale arrival, or an authorisation error from cTrader. The code is never written to the response. Every
// refusal is reported to onRefusal, so a caller that is waiting can stop at once instead of waiting out its
// timeout for a redirect that will never be accepted.
function createCallbackHandler({ path = CALLBACK_PATH, state, onCode, onRefusal, now = () => Date.now(), codeLifetimeMs = CODE_LIFETIME_MS, allowMissingState = false } = {}) {
  if (typeof state !== "string" || state.length < 8) throw codedError("state_weak", "a state value of at least 8 characters is required");
  if (typeof onCode !== "function") throw codedError("handler_missing", "onCode(code, meta) is required");
  const issuedAt = now();
  let consumed = false;
  let refusals = 0;

  const handler = async function handle(req, res) {
    const send = (status, title, line) => {
      const body = html(title, line);
      if (res && typeof res.writeHead === "function") {
        res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      }
      if (res && typeof res.end === "function") res.end(body);
      return { status, title };
    };
    const refuse = (status, reason, title, line) => {
      refusals += 1;
      if (typeof onRefusal === "function") {
        try {
          onRefusal({ status, reason, atMs: now() });
        } catch (err) {
          // A reporting callback must not change what the browser is told.
        }
      }
      return send(status, title, line);
    };
    const method = String((req && req.method) || "GET").toUpperCase();
    if (method !== "GET") return refuse(405, "method_not_allowed", "Method not allowed", "The callback only answers a browser redirect.");
    const parsed = parseCallback(req && req.url);
    if (parsed.path !== path) return refuse(404, "path_mismatch", "Not found", "This address is not the callback path.");
    if (parsed.error) {
      return refuse(400, "consent_error", "Consent was not granted", `cTrader returned ${String(parsed.error).replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 40)}. Nothing was stored.`);
    }
    // State is the default defence against a redirect this listener did not start. A portal link that cannot carry
    // a state parameter is handled by an explicit allowMissingState, never by silently weakening every arrival.
    const stateArrived = parsed.state !== null && parsed.state !== undefined && parsed.state !== "";
    if (!stateArrived && !allowMissingState) {
      return refuse(403, "state_missing", "State missing", "The redirect carried no state value, so the code was dropped. Rerun with --allow-missing-state only if the portal cannot echo it.");
    }
    if (stateArrived && !sameValue(parsed.state, state)) {
      return refuse(403, "state_mismatch", "State did not match", "This redirect was not started by this listener, so the code was dropped.");
    }
    if (now() - issuedAt > codeLifetimeMs) {
      return refuse(400, "code_too_old", "Code too old", "An authorisation code expires after one minute. Start consent again.");
    }
    if (!parsed.code) {
      return refuse(400, "no_code", "No code", "The redirect carried no code parameter.");
    }
    if (consumed) {
      return refuse(410, "already_used", "Already used", "This callback has already been consumed once.");
    }
    consumed = true;
    try {
      await onCode(parsed.code, { state: parsed.state, receivedAtMs: now() });
      return send(200, "Consent received", "The code was exchanged by the relay. You can close this tab.");
    } catch (err) {
      // The code is spent either way. The exchange failure belongs in the relay's own record, without the secret.
      return refuse(500, "exchange_failed", "Exchange failed", "The code arrived but the token exchange failed. Check the relay's own record.");
    }
  };
  handler.stats = () => ({ consumed, refusals });
  return handler;
}

// Loopback only, on the exact path registered with the application. Binding 0.0.0.0 would let anything on the
// network race the browser to the code, so the host is refused rather than parameterised.
function startCallbackListener({
  http,
  port = CALLBACK_PORT,
  host = CALLBACK_HOST,
  path = CALLBACK_PATH,
  state,
  onCode,
  onRefusal,
  now = () => Date.now(),
  codeLifetimeMs = CODE_LIFETIME_MS,
  allowMissingState = false
} = {}) {
  if (!http || typeof http.createServer !== "function") throw new TypeError("pass require(\"node:http\") as http");
  if (host !== CALLBACK_HOST) throw codedError("host_refused", `the callback must bind ${CALLBACK_HOST}, not ${host}`);
  const handler = createCallbackHandler({ path, state, onCode, onRefusal, now, codeLifetimeMs, allowMissingState });
  const server = http.createServer((req, res) => {
    handler(req, res).catch(() => {
      try {
        res.writeHead(500, { "content-type": "text/plain" });
        res.end("callback failed");
      } catch (err) {
        // the socket is already gone; there is nothing left to say to the browser
      }
    });
  });
  const ready = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({ port: address.port, host, url: `http://${host}:${address.port}${path}` });
    });
  });
  return {
    server,
    ready,
    handler,
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    }
  };
}

// ---- the consent link ----

// The documented page, with the four documented parameters. State is appended as well: the table does not list
// it, and the listener refuses a redirect that returns without it unless that is waived, so the link carries it
// and the outcome is observed rather than assumed.
function buildConsentUrl({ clientId, redirectUri, scope = SCOPES.trading, product = "web", state } = {}) {
  if (!clientId) throw codedError("client_id_missing", "the application's client id is required");
  if (!redirectUri) throw codedError("redirect_uri_missing", "the registered redirect uri is required");
  if (scope !== SCOPES.accounts && scope !== SCOPES.trading) {
    throw codedError("scope_invalid", `scope is accounts or trading, got ${scope}`);
  }
  const url = new URL(CONSENT_ENDPOINT);
  url.searchParams.set("client_id", String(clientId));
  url.searchParams.set("redirect_uri", String(redirectUri));
  url.searchParams.set("scope", scope);
  if (product) url.searchParams.set("product", String(product));
  if (state) url.searchParams.set("state", String(state));
  return url.toString();
}

// ---- the token exchange ----

// The documented call: the parameters travel in the query string, the body is empty, Accept and Content-Type are
// both application/json. The response is {accessToken, refreshToken, expiresIn, tokenType}; expiresIn is a
// lifetime in seconds, so the absolute expiry is computed once, here, and stored alongside.
function tokenUrl({ grantType, code, refreshToken, redirectUri, clientId, clientSecret }, endpoint = TOKEN_ENDPOINT) {
  const query = new URLSearchParams();
  query.set("grant_type", grantType);
  if (code) query.set("code", code);
  if (refreshToken) query.set("refresh_token", refreshToken);
  if (redirectUri) query.set("redirect_uri", redirectUri);
  query.set("client_id", String(clientId));
  query.set("client_secret", String(clientSecret));
  return `${endpoint}?${query.toString()}`;
}

async function requestTokens({ url, fetchImpl, now }) {
  if (typeof fetchImpl !== "function") throw new TypeError("pass a fetch implementation as fetchImpl");
  let response;
  try {
    // The documented call is a GET with the parameters in the query string and no body.
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" }
    });
  } catch (err) {
    throw codedError("token_endpoint_unreachable", "the token endpoint could not be reached", { cause: err && err.message });
  }
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (err) {
    throw codedError("token_response_not_json", `the token endpoint answered ${response.status} with something that is not JSON`, { status: response.status });
  }
  if (!response.ok || !body || !body.accessToken) {
    // Deliberately no URL and no body in the error: both carry the secret.
    throw codedError("token_exchange_failed", `the token endpoint answered ${response.status}`, {
      status: response.status,
      errorCode: (body && (body.errorCode || body.error)) || null,
      description: (body && body.description) || null
    });
  }
  const expiresIn = Number(body.expiresIn);
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken || null,
    tokenType: body.tokenType || null,
    scope: body.scope || null,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
    expiresAtMs: Number.isFinite(expiresIn) ? now() + expiresIn * 1000 : null
  };
}

async function exchangeCode({ clientId, clientSecret, code, redirectUri, fetchImpl = globalThis.fetch, now = () => Date.now(), endpoint } = {}) {
  if (!clientId || !clientSecret) throw codedError("app_credentials_missing", "clientId and clientSecret are required");
  if (!code) throw codedError("code_missing", "an authorisation code is required");
  if (!redirectUri) throw codedError("redirect_uri_missing", "the redirect_uri must match the registered one exactly");
  const url = tokenUrl({ grantType: "authorization_code", code, redirectUri, clientId, clientSecret }, endpoint);
  return requestTokens({ url, fetchImpl, now });
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken, fetchImpl = globalThis.fetch, now = () => Date.now(), endpoint } = {}) {
  if (!clientId || !clientSecret) throw codedError("app_credentials_missing", "clientId and clientSecret are required");
  if (!refreshToken) throw codedError("refresh_token_missing", "a refresh token is required");
  const url = tokenUrl({ grantType: "refresh_token", refreshToken, clientId, clientSecret }, endpoint);
  return requestTokens({ url, fetchImpl, now });
}

// What may be written to a log or a report. Never the tokens themselves.
function tokenSummary(tokens) {
  if (!tokens || typeof tokens !== "object") return null;
  return {
    hasAccessToken: typeof tokens.accessToken === "string" && tokens.accessToken.length > 0,
    hasRefreshToken: typeof tokens.refreshToken === "string" && tokens.refreshToken.length > 0,
    expiresAtMs: tokens.expiresAtMs || null,
    tokenType: tokens.tokenType || null
  };
}

// The token file is written 0600 and replaced atomically, so a half-written file cannot be mistaken for a token.
// On Windows the mode is advisory; the directory ACL is what protects it there.
function writeTokenFile({ path: filePath, tokens, fs } = {}) {
  if (!fs || typeof fs.writeFileSync !== "function") throw new TypeError("pass require(\"node:fs\") as fs");
  if (!filePath) throw codedError("path_missing", "a token file path is required");
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, filePath);
  return { path: filePath, summary: tokenSummary(tokens) };
}

function readTokenFile({ path: filePath, fs } = {}) {
  if (!fs || typeof fs.readFileSync !== "function") throw new TypeError("pass require(\"node:fs\") as fs");
  const text = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw codedError("token_file_not_json", `${filePath} does not contain JSON`);
  }
}

module.exports = {
  TOKEN_ENDPOINT,
  CONSENT_ENDPOINT,
  SCOPES,
  CALLBACK_PATH,
  CALLBACK_HOST,
  CALLBACK_PORT,
  CODE_LIFETIME_MS,
  codedError,
  parseCallback,
  sameValue,
  createCallbackHandler,
  startCallbackListener,
  buildConsentUrl,
  tokenUrl,
  exchangeCode,
  refreshAccessToken,
  tokenSummary,
  writeTokenFile,
  readTokenFile
};
