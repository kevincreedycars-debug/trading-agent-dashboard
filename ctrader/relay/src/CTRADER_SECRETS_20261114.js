// Where the owner's cTrader app secret and tokens live on the Windows VPS: DPAPI, under the relay's own user.
//
// The owner's instruction for 2026-11-14 is the specification: store the app secret and the tokens under the
// relay's Windows user with Windows-protected storage such as DPAPI, because the proposed credentials.env and
// tokens.json would otherwise hold plaintext. So this module has one format and one protection:
//
//   vault file: JSON { version, scope: "dpapi-current-user", user, createdAtUtc, sealed: "<base64>" }
//   sealed:     DPAPI(utf8 JSON of {clientId, clientSecret, accessToken, refreshToken, accessTokenExpiresAtUtc})
//
// Three properties are deliberate:
//   1. The plaintext never appears on a command line or in a plaintext file. PowerShell reads it from stdin and
//      writes the ciphertext (or, on the way back, the plaintext) to stdout, so a process listing on the VPS
//      shows only the script, which carries no secret.
//   2. CurrentUser scope. Another Windows user on that VPS - and any copy of the file taken to another machine -
//      cannot decrypt it. Losing the user profile loses the vault; that is the trade the owner asked for, and the
//      app secret can be reissued at the cTrader site.
//   3. A plaintext path is refused by name. The two files the earlier proposal named are refused outright, so an
//      operator following an old note is stopped rather than silently writing a secret in the clear.
//   4. Two states, sealed the same way: "pending" is the client id and secret alone (put-app, before the owner
//      consents) and "authorised" adds the token pair (the consent command). Readers ask for the authorised set
//      by default and refuse a pending vault by name, so a partly filled vault cannot pass for a working one.
"use strict";

const crypto = require("node:crypto");

function codedError(code, message, extra) {
  const err = new Error(message);
  err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
}

// The PowerShell that does the protecting. Kept here as data so the same text is used by the module, the tests
// and the operator's own check. Protect is the only place a plaintext crosses: it arrives on stdin.
const POWERSHELL = Object.freeze({
  protect: [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$plain=[Console]::In.ReadToEnd()",
    "if([string]::IsNullOrEmpty($plain)){throw 'nothing on stdin'}",
    "$bytes=[Text.Encoding]::UTF8.GetBytes($plain)",
    "$sealed=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Convert]::ToBase64String($sealed))"
  ].join(";"),
  unprotect: [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$b64=[Console]::In.ReadToEnd()",
    "if([string]::IsNullOrEmpty($b64)){throw 'nothing on stdin'}",
    "$sealed=[Convert]::FromBase64String($b64.Trim())",
    "$plain=[Security.Cryptography.ProtectedData]::Unprotect($sealed,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))"
  ].join(";")
});

const VAULT_VERSION = 1;
const VAULT_SCOPE = "dpapi-current-user";

// One PowerShell process per call, with the secret on stdin and nothing secret in the arguments. Injected so the
// tests can run without Windows, and so the operator can see exactly what is executed.
function createPowerShellRunner({ spawnSync, powerShellPath = "powershell.exe", timeoutMs = 30000 } = {}) {
  const spawn = spawnSync || require("node:child_process").spawnSync;
  return function runPowerShell(script, input, options = {}) {
    const timeout = options.timeoutMs || timeoutMs;
    const result = spawn(powerShellPath, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], {
      input: input === undefined || input === null ? "" : String(input),
      encoding: "utf8",
      timeout,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    });
    if (result.error) {
      throw codedError("powershell_failed", `PowerShell could not be run: ${result.error.message}`, { cause: result.error });
    }
    if (result.status !== 0) {
      throw codedError("powershell_failed", `PowerShell exited ${result.status}`, {
        exitCode: result.status,
        stderr: String(result.stderr || "").trim().slice(0, 2000)
      });
    }
    return String(result.stdout || "");
  };
}

function sealValue({ value, runPowerShell }) {
  if (typeof value !== "string" || !value) throw codedError("secret_missing", "a non-empty string is required to seal");
  if (typeof runPowerShell !== "function") throw new TypeError("runPowerShell(script, input) is required");
  const sealed = String(runPowerShell(POWERSHELL.protect, value) || "").trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(sealed)) throw codedError("seal_failed", "the protection step returned no base64 ciphertext");
  return sealed;
}

function unsealValue({ blob, runPowerShell }) {
  if (typeof blob !== "string" || !blob) throw codedError("vault_corrupt", "the vault holds no sealed value");
  if (typeof runPowerShell !== "function") throw new TypeError("runPowerShell(script, input) is required");
  const plain = runPowerShell(POWERSHELL.unprotect, blob);
  if (!plain) throw codedError("unseal_failed", "the unprotect step returned nothing");
  return String(plain);
}

// The store the rest of the relay uses: it knows the scope and the user, and it never returns the sealed text.
function createDpapiStore({ runPowerShell, user } = {}) {
  if (typeof runPowerShell !== "function") throw new TypeError("createDpapiStore needs runPowerShell(script, input)");
  return {
    scope: VAULT_SCOPE,
    user: user || null,
    seal(secrets) {
      return sealValue({ value: JSON.stringify(secrets), runPowerShell });
    },
    unseal(blob) {
      const text = unsealValue({ blob, runPowerShell });
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw codedError("vault_corrupt", "the unsealed value is not JSON", { cause: err });
      }
      return parsed;
    }
  };
}

// The two plaintext files the earlier proposal named, plus any .env, are refused by name.
function assertVaultPath(path) {
  const name = String(path || "").split(/[\\/]/).pop().toLowerCase();
  if (!name) throw codedError("vault_path_missing", "a vault path is required");
  if (name === "credentials.env" || name === "tokens.json" || name.endsWith(".env")) {
    throw codedError("plaintext_path_refused", `"${name}" is a plaintext path; the vault must be a sealed file such as ctrader.vault.json`);
  }
  return path;
}

// A vault has two states. "pending" is the app credentials alone, sealed before the owner consents: the secret is
// stored once, so an abandoned, killed or failed consent does not ask for it again and no plaintext copy exists to
// keep. Every reader asks for the full set by default, so a pending vault can never be mistaken for an authorised
// one - it fails by name (token_missing), not by looking like a working credential.
function requireSecrets(secrets, { allowPending = false } = {}) {
  const required = allowPending ? ["clientId", "clientSecret"] : ["clientId", "clientSecret", "accessToken"];
  const missing = required.filter((key) => typeof (secrets && secrets[key]) !== "string" || !secrets[key]);
  if (!missing.length) return secrets;
  const code = missing.length === 1 && missing[0] === "accessToken" ? "token_missing" : "secret_missing";
  const message =
    code === "token_missing"
      ? "the vault holds the app credentials but no token pair yet; run the consent command to authorise it"
      : `the vault is missing ${missing.join(", ")}`;
  throw codedError(code, message, { missing });
}

// Written to a temporary file in the same directory and renamed, with the owner's mode, so a crash never leaves a
// half-written vault.
function writeVault({ path, secrets, store, fs, now = () => Date.now(), user, pending = false } = {}) {
  assertVaultPath(path);
  if (!fs || typeof fs.writeFileSync !== "function") throw new TypeError("writeVault needs fs");
  if (!store || typeof store.seal !== "function") throw new TypeError("writeVault needs a store");
  const checked = requireSecrets(secrets, { allowPending: pending });
  // A pending record carries the same keys with nothing in the token slots, so the shape never depends on state.
  const value = pending
    ? { clientId: checked.clientId, clientSecret: checked.clientSecret, accessToken: null, refreshToken: null, accessTokenExpiresAtUtc: null }
    : checked;
  const record = {
    version: VAULT_VERSION,
    scope: store.scope || VAULT_SCOPE,
    user: user || store.user || null,
    createdAtUtc: new Date(now()).toISOString(),
    sealed: store.seal(value)
  };
  const temporary = `${path}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, path);
  if (typeof fs.chmodSync === "function") fs.chmodSync(path, 0o600);
  return { path, scope: record.scope, user: record.user, createdAtUtc: record.createdAtUtc, sealedLength: record.sealed.length };
}

function readVault({ path, store, fs, pending = false } = {}) {
  assertVaultPath(path);
  if (!fs || typeof fs.readFileSync !== "function") throw new TypeError("readVault needs fs");
  if (!store || typeof store.unseal !== "function") throw new TypeError("readVault needs a store");
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      throw codedError("vault_missing", `no sealed vault at ${path}; put the app secret and tokens there first`, { path });
    }
    throw err;
  }
  let record;
  try {
    record = JSON.parse(text);
  } catch (err) {
    throw codedError("vault_corrupt", `the vault at ${path} is not JSON`, { cause: err });
  }
  if (!record || record.version !== VAULT_VERSION) {
    throw codedError("vault_version_unsupported", `the vault at ${path} is version ${record && record.version}`);
  }
  if (record.scope !== VAULT_SCOPE) {
    throw codedError("vault_scope_unsupported", `the vault at ${path} is sealed for ${record.scope}, not ${VAULT_SCOPE}`);
  }
  const secrets = requireSecrets(store.unseal(record.sealed), { allowPending: pending });
  return { secrets, meta: { path, user: record.user || null, createdAtUtc: record.createdAtUtc || null, scope: record.scope } };
}

// Logs and reports never carry a secret. Kept here so a caller has no reason to print one.
function mask(value, keep = 4) {
  const text = String(value === undefined || value === null ? "" : value);
  if (!text) return "";
  if (text.length <= keep) return "*".repeat(text.length);
  return `${"*".repeat(Math.min(12, text.length - keep))}${text.slice(-keep)}`;
}

// The operator commands that write the vault, and the two are deliberately different:
//
//   put      the token pair from the file the consent command wrote, with the app credentials from the session
//            environment (typed in the session, never on a command line) - the older one-off import
//   put-app  the client id and secret alone, read from stdin as JSON, sealed before consent so the secret is
//            stored once and a killed or abandoned consent costs nothing
function readCliConfig({ env = process.env, argv = [] } = {}) {
  const flags = { mode: null, vaultPath: null, from: null, deleteSource: false };
  const refusals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    const take = () => {
      i += 1;
      return argv[i];
    };
    if (arg === "put" || arg === "put-app") {
      flags.mode = arg;
      continue;
    }
    if (arg === "--delete-source") flags.deleteSource = true;
    else if (arg.startsWith("--vault=")) flags.vaultPath = arg.slice("--vault=".length);
    else if (arg === "--vault") flags.vaultPath = take();
    else if (arg.startsWith("--from=")) flags.from = arg.slice("--from=".length);
    else if (arg === "--from") flags.from = take();
    else refusals.push(`unknown_argument:${arg}`);
  }
  const mode = flags.mode || "put";
  const clientId = env.CTRADER_CLIENT_ID || null;
  const clientSecret = env.CTRADER_CLIENT_SECRET || null;
  if (!flags.vaultPath) refusals.push("vault_missing:pass --vault, ending in .vault.json");
  // put-app reads both values from stdin, so its refusals must not name the environment or a token file.
  if (mode === "put") {
    if (!flags.from) refusals.push("source_missing:pass --from with the token file the consent command wrote");
    if (!clientId) refusals.push("client_id_missing:set CTRADER_CLIENT_ID in this session");
    if (!clientSecret) refusals.push("client_secret_missing:set CTRADER_CLIENT_SECRET in this session");
  }
  return { mode, vaultPath: flags.vaultPath, from: flags.from, deleteSource: flags.deleteSource, clientId, clientSecret, refusals };
}

// The vault record is one flat object whatever shape the two sources arrived in, and a token file that carries
// expiresAtMs in milliseconds is normalised to the ISO string the refresh check reads.
function mergeVaultSecrets({ config, tokens } = {}) {
  if (!tokens || typeof tokens !== "object") throw codedError("tokens_missing", "the token file did not produce an object");
  const expiresAtMs = Number.isFinite(tokens.expiresAtMs) ? tokens.expiresAtMs : Date.parse(tokens.accessTokenExpiresAtUtc || "");
  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || null,
    accessTokenExpiresAtUtc: Number.isFinite(expiresAtMs) && expiresAtMs > 0 ? new Date(expiresAtMs).toISOString() : null
  };
}

function importVault({ config, store, fs, now = () => Date.now() } = {}) {
  if (!config || !Array.isArray(config.refusals)) throw new TypeError("a config from readCliConfig is required");
  if (config.refusals.length) return { ok: false, refusals: config.refusals };
  if (!fs || typeof fs.readFileSync !== "function") throw new TypeError("importVault needs fs");
  let tokens;
  try {
    tokens = JSON.parse(fs.readFileSync(config.from, "utf8"));
  } catch (err) {
    throw codedError("token_file_unreadable", `cannot read ${config.from} as JSON; run the consent command first`, { cause: err });
  }
  const secrets = mergeVaultSecrets({ config, tokens });
  const written = writeVault({ path: config.vaultPath, secrets, store, fs, now });
  let sourceDeleted = false;
  if (config.deleteSource) {
    fs.rmSync(config.from, { force: true });
    sourceDeleted = true;
  }
  return {
    ok: true,
    path: written.path,
    scope: written.scope,
    user: written.user,
    createdAtUtc: written.createdAtUtc,
    clientId: mask(secrets.clientId),
    accessToken: mask(secrets.accessToken),
    hasRefreshToken: Boolean(secrets.refreshToken),
    accessTokenExpiresAtUtc: secrets.accessTokenExpiresAtUtc,
    sourceDeleted
  };
}

// The one-off entry point: a JSON document on stdin, sealed into the vault, with only a summary returned.
function putFromStdin({ path, store, fs, readStdin, now, user }) {
  if (typeof readStdin !== "function") throw new TypeError("putFromStdin needs readStdin()");
  const text = readStdin();
  let secrets;
  try {
    secrets = JSON.parse(text);
  } catch (err) {
    throw codedError("stdin_not_json", "the secret document on stdin is not JSON", { cause: err });
  }
  return writeVault({ path, secrets, store, fs, now, user });
}

// The step before consent, and the command the owner asked for: the client id and secret alone, sealed, with no
// token file and no secret on a command line. The document arrives on stdin as {"clientId":..,"clientSecret":..};
// nothing else is accepted, so a copy of a full token file cannot be used to replace a good vault by accident.
const APP_FIELDS = Object.freeze(["clientId", "clientSecret"]);

function putAppFromStdin({ path, store, fs, readStdin, now = () => Date.now(), user } = {}) {
  if (typeof readStdin !== "function") throw new TypeError("putAppFromStdin needs readStdin()");
  const text = readStdin();
  let document;
  try {
    document = JSON.parse(text);
  } catch (err) {
    throw codedError("stdin_not_json", "the secret document on stdin is not JSON", { cause: err });
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw codedError("stdin_not_json", "the secret document on stdin must be a JSON object");
  }
  const unknown = Object.keys(document).filter((key) => !APP_FIELDS.includes(key));
  if (unknown.length) {
    throw codedError("unknown_field", `the document carries ${unknown.join(", ")}; put-app seals only clientId and clientSecret`, {
      fields: unknown
    });
  }
  const missing = APP_FIELDS.filter((key) => typeof document[key] !== "string" || !document[key]);
  if (missing.length) throw codedError("secret_missing", `the document is missing ${missing.join(", ")}`, { missing });
  const written = writeVault({ path, secrets: document, store, fs, now, user, pending: true });
  return { ...written, clientId: mask(document.clientId), pending: true };
}

if (require.main === module) {
  const fsImpl = require("node:fs");
  const config = readCliConfig({ env: process.env, argv: process.argv.slice(2) });
  const store = createDpapiStore({ runPowerShell: createPowerShellRunner({}) });
  try {
    if (config.mode === "put-app" && !config.refusals.length) {
      // Both values come from stdin; fs.readFileSync(0) is the whole document the operator piped in.
      const written = putAppFromStdin({
        path: config.vaultPath,
        store,
        fs: fsImpl,
        readStdin: () => fsImpl.readFileSync(0, "utf8")
      });
      process.stdout.write(`sealed ${written.path} (${written.scope}, user ${written.user})\n`);
      process.stdout.write(`client id ${written.clientId}, token pair pending; run the consent command to authorise it\n`);
    } else {
      const result = importVault({ config, store, fs: fsImpl });
      if (!result.ok) {
        for (const refusal of result.refusals) process.stderr.write(`refused: ${refusal}\n`);
        process.exitCode = 2;
      } else {
        process.stdout.write(`sealed ${result.path} (${result.scope}, user ${result.user})\n`);
        process.stdout.write(
          `client id ${result.clientId}, access token ${result.accessToken}, refresh token ${result.hasRefreshToken ? "stored" : "absent"}, expires ${result.accessTokenExpiresAtUtc || "unknown"}\n`
        );
        if (result.sourceDeleted) process.stdout.write("the plaintext token file was removed\n");
      }
    }
  } catch (err) {
    process.stderr.write(`failed: ${err && err.code ? err.code : "error"}: ${err && err.message ? err.message : err}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  POWERSHELL,
  VAULT_SCOPE,
  VAULT_VERSION,
  createPowerShellRunner,
  createDpapiStore,
  assertVaultPath,
  sealValue,
  unsealValue,
  writeVault,
  readVault,
  putFromStdin,
  putAppFromStdin,
  readCliConfig,
  mergeVaultSecrets,
  importVault,
  requireSecrets,
  mask
};

