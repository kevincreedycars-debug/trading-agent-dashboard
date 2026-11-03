(function initResearchUploadDashboard(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ResearchUploadDashboard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createResearchUploadDashboard(root) {
  "use strict";

  // The bridge between the dashboard's research library and the private hosted store. Every hosted
  // decision lives here, so the page calls in at three points only: draw the account bar, upload one
  // stage document, and open or download one. Nothing here approves anything: an upload records
  // evidence and moves no status, weight, threshold or live call.

  const STAGE_ORDER = Object.freeze({
    research: 1,
    red_team: 2,
    adjudication: 3,
    final_analysis: 1,
    final_red_team: 2,
    final_adjudication: 3
  });
  const credentials = { url: "", key: "" };
  const account = { email: "", password: "", message: "", tone: "idle" };
  let configured = false;
  let blockedReason = "";
  let fetchImpl = null;
  let lastRetry = null;

  function client() {
    return root.ResearchUpload || null;
  }

  function say(text) {
    if (typeof root.researchLibraryMessage === "function") root.researchLibraryMessage(text);
  }

  function redraw() {
    if (typeof root.renderResearchLibrary === "function") root.renderResearchLibrary();
  }

  // The address is remembered so a returning reader types only the password. Nothing secret is stored:
  // the session token is the client's own record, kept by the browser.
  const EMAIL_KEY = "research-upload-last-email";

  function rememberEmail(email) {
    if (!email) return;
    try {
      if (root.localStorage) root.localStorage.setItem(EMAIL_KEY, String(email));
    } catch (_) {
      // A browser that refuses storage simply does not remember the address.
    }
  }

  function rememberedEmail() {
    try {
      return root.localStorage ? String(root.localStorage.getItem(EMAIL_KEY) || "") : "";
    } catch (_) {
      return "";
    }
  }

  function session() {
    const lib = client();
    return lib ? lib.session() : null;
  }

  function signedIn() {
    return !!session();
  }

  // The hosted access gateway: when the page has it, the store is reachable without a session, and neither
  // an upload nor a download asks the reader to sign in. The gateway is the only holder of the service key.
  function openAccess() {
    const lib = client();
    return Boolean(lib && typeof lib.openAccess === "function" && lib.openAccess());
  }

  // One question for every gate below: can this page reach the store at all?
  function available() {
    return isConfigured() && (signedIn() || openAccess());
  }

  function isConfigured() {
    return configured && !!client();
  }

  function status() {
    return { configured: isConfigured(), signedIn: signedIn(), openAccess: openAccess(), available: available(), blocked: blockedReason };
  }

  function configure(options) {
    const input = options || {};
    credentials.url = String(input.url || "").replace(/\/+$/, "");
    credentials.key = String(input.key || "");
    fetchImpl = typeof input.fetch === "function" ? input.fetch : null;
    if (!account.email) account.email = rememberedEmail();
    const lib = client();
    if (!lib) {
      configured = false;
      blockedReason = "The upload helper lib/research_upload_client.js did not load, so uploads and downloads fall back to the local service.";
      return { ok: false, message: blockedReason };
    }
    if (!credentials.url || !credentials.key) {
      configured = false;
      blockedReason = "The upload service has no address or key in this page, so uploads fall back to the local service.";
      return { ok: false, message: blockedReason };
    }
    const result = lib.configure({
      url: credentials.url,
      key: credentials.key,
      gateway: input.gateway,
      accessKey: input.accessKey,
      fetch: input.fetch,
      storage: input.storage
    });
    credentials.gateway = String(input.gateway || "").replace(/\/+$/, "");
    configured = !!result.ok;
    blockedReason = result.ok ? "" : String(result.message || "The upload service could not be configured.");
    if (configured && signedIn() && !account.message) {
      account.message = "Signed in. Upload and download are available on this page.";
      account.tone = "ok";
    } else if (configured && openAccess()) {
      account.message = "Open access. No sign-in is needed to upload or download.";
      account.tone = "ok";
    } else if (configured && !signedIn() && typeof lib.authError === "function" && lib.authError()) {
      // A provider sign-in that came back refused: the reader needs to know why, not see a blank block.
      account.message = String(lib.authError());
      account.tone = "blocked";
    }
    return result;
  }

  function escape(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // One small block the library header renders: plain words, one field, one button.
  function accountBarHtml() {
    if (!isConfigured()) {
      return `
        <div class="rl-account rl-account-blocked" data-rl-account="blocked">
          <p class="rl-account-copy">${escape(blockedReason || "The private upload service is not available in this page.")}</p>
        </div>`;
    }
    // Nothing to sign in to: the page reaches the store through the access gateway, so the block says that
    // in one line instead of offering a form the reader does not need.
    if (openAccess()) {
      return `
        <div class="rl-account rl-account-open" data-rl-account="open">
          <span class="rl-pill rl-tone-ok">Open access</span>
          <p class="rl-account-copy">No sign-in. Upload, View and Download use the private store directly, and nothing here approves anything.</p>
        </div>`;
    }
    if (signedIn()) {
      return `
        <div class="rl-account rl-account-signed-in" data-rl-account="signed-in">
          <span class="rl-pill rl-tone-ok">Signed in</span>
          <p class="rl-account-copy">Upload, View and Download use the private store. They keep working when this page is reopened in this browser.</p>
          <button type="button" class="ghost-button" data-rl-account-signout="true">Sign out</button>
        </div>`;
    }
    return `
      <div class="rl-account rl-account-signed-out" data-rl-account="signed-out">
        <div class="rl-account-row">
          <button type="button" class="ghost-button" data-rl-account-github-signin="true">Sign in with GitHub</button>
        </div>
        <p class="rl-account-copy">${escape(account.message || "Sign in once in this browser with GitHub. After that, choosing a file is the whole upload: this page records the file name, the time, the factor, the stage and the version for you, and it links the earlier stage it follows.")}</p>
        <div class="rl-account-row">
          <label class="rl-account-label" for="researchUploadEmail">Or the account email</label>
          <input class="rl-account-input" id="researchUploadEmail" type="email" autocomplete="username"
                 placeholder="the research library account" data-rl-account-email="true" value="${escape(account.email)}" />
          <label class="rl-account-label" for="researchUploadPassword">Password</label>
          <input class="rl-account-input" id="researchUploadPassword" type="password" autocomplete="current-password"
                 data-rl-account-password="true" value="" />
          <button type="button" class="ghost-button" data-rl-account-password-signin="true">Sign in</button>
        </div>
      </div>`;
  }

  async function handleAccountAction(target) {
    const lib = client();
    if (!lib) return false;
    if (target.closest("[data-rl-account-github-signin]")) {
      // The page leaves for GitHub; the reader returns to this same page with a session in the fragment.
      account.message = "Opening GitHub...";
      account.tone = "idle";
      redraw();
      const result = typeof lib.signInWithGitHub === "function"
        ? await lib.signInWithGitHub()
        : { ok: false, message: "This page cannot sign in with GitHub. Use the account email and password instead" };
      account.message = String(result.message || (result.ok ? "Opening GitHub..." : "GitHub sign-in could not start."));
      account.tone = result.ok ? "idle" : "blocked";
      redraw();
      return true;
    }
    if (target.closest("[data-rl-account-password-signin]")) {
      const scope = target.closest("[data-rl-account]");
      const emailInput = scope ? scope.querySelector("[data-rl-account-email]") : null;
      const passwordInput = scope ? scope.querySelector("[data-rl-account-password]") : null;
      account.email = String((emailInput && emailInput.value) || "").trim();
      account.password = String((passwordInput && passwordInput.value) || "");
      account.message = "Signing in...";
      account.tone = "idle";
      redraw();
      const result = typeof lib.signInWithPassword === "function"
        ? await lib.signInWithPassword(account.email, account.password)
        : { ok: false, message: "This page cannot sign in with a password. Use the email link instead" };
      account.password = "";
      account.message = String(result.message || (result.ok ? "Signed in." : "That email address and password were not accepted."));
      account.tone = result.ok ? "ok" : "blocked";
      if (result.ok) rememberEmail(account.email);
      redraw();
      return true;
    }
    if (target.closest("[data-rl-account-signout]")) {
      const result = await lib.signOut();
      account.message = String(result.message || "You are signed out.");
      account.tone = result.ok ? "idle" : "blocked";
      redraw();
      return true;
    }
    return false;
  }

  function nextVersion(rows, topicId, stageNumber) {
    const seen = (Array.isArray(rows) ? rows : [])
      .filter(row => String(row.topic_id) === String(topicId) && Number(row.stage) === Number(stageNumber))
      .map(row => Number(row.version) || 0);
    return seen.length ? Math.max.apply(null, seen) + 1 : 1;
  }

  function plainFailure(result, fallback) {
    return { ok: false, message: String((result && result.message) || fallback) };
  }

  // A factor chain and the asset-level final chain both use the hosted table's topic_id column as their
  // owner key. The page passes chainId explicitly because the group topic in the catalogue is only a
  // display grouping: two chains under one topic must never share a version sequence.
  function ownerIdOf(input) {
    const topic = (input && input.topic) || {};
    const chain = (input && input.chain) || {};
    return String((input && input.chainId) || chain.chain_id || topic.topic_id || "").trim();
  }

  function inputPayload(input) {
    const stage = (input && input.stage) || {};
    const topic = (input && input.topic) || {};
    // The file and the stage are the whole form. The model or session that produced the document used to
    // be asked for and is no longer recorded: the record carries the file name, the time, the factor, the
    // stage and the version, which is what the register needs.
    const note = String((input && input.note) || "").trim();
    const finalStage = /^final_/.test(String(stage.stage || ""));
    // The final chain records the exact factor input package it judged. The hosted table has no column for
    // it, so the client carries it inside the notes column and restores it when the row is read back.
    const inputPackage = (input && (input.inputPackage || input.package)) || null;
    return {
      topicId: ownerIdOf(input),
      stage: STAGE_ORDER[stage.stage],
      title: String((input && input.title) || "").trim() || `${topic.title} - ${stage.label || stage.stage}`,
      // Factor stages store their document type, as before. Final stages carry their stage name because
      // the hosted table's three stage numbers cannot distinguish the two chains on their own.
      kind: finalStage ? String(stage.stage) : String(stage.document_type || stage.stage || ""),
      notes: note,
      inputPackage: inputPackage && finalStage
        ? {
          chain_id: ownerIdOf(input),
          stage: String(stage.stage || ""),
          recorded_at: String(inputPackage.recorded_at || new Date().toISOString()),
          documents: inputPackage.documents
        }
        : null,
      file: input && input.file,
      parents: (input && input.parents) || {}
    };
  }

  // Upload one stage document. The caller has already checked the file, the model label and the parents,
  // so this function only has to store the bytes and record them.
  async function uploadStage(input) {
    const lib = client();
    if (!isConfigured() || !lib) return plainFailure(null, "The private upload service is not available in this page");
    if (!available()) return plainFailure(null, "Sign in with your email and password, or the email link, before uploading a research document");
    const topic = (input && input.topic) || {};
    const stage = (input && input.stage) || {};
    const stageNumber = STAGE_ORDER[stage.stage];
    if (!stageNumber) return plainFailure(null, `The stage ${String(stage.stage || "")} cannot be stored in the hosted backend`);
    const ownerId = ownerIdOf(input);
    if (!ownerId) return plainFailure(null, "This chain has no id, so a hosted document cannot be attached to it");
    const file = input && input.file;
    if (!file) return plainFailure(null, "Choose the Markdown file the stage returned");

    const listed = await lib.listByTopic(ownerId);
    const rows = listed.ok ? listed.rows : [];
    const version = nextVersion(rows, ownerId, stageNumber);

    say(`Uploading ${file.name} as stage ${stageNumber} of ${topic.title}...`);
    const result = await lib.upload(inputPayload(input));
    if (!result.ok) {
      if (result.retry) {
        lastRetry = { input: input, retry: result.retry };
        say(`${result.message} Use Retry registration to finish without uploading the file again.`);
        return { ok: false, message: result.message, retryable: true };
      }
      say(result.message);
      return { ok: false, message: result.message };
    }

    say(String(result.message || `${file.name} stored as stage ${stageNumber} version ${version} of ${topic.title}. The stage now reads Uploaded; use View or Download on the stage card. Evidence only: no factor status, weight or live call moved.`));
    if (typeof (input && input.onStored) === "function") await input.onStored(result);
    return { ok: true, message: String(result.message || ""), row: result.row || null };
  }

  async function retryRegistration() {
    const lib = client();
    if (!lastRetry || !lib) return plainFailure(null, "There is nothing waiting to be registered");
    const waiting = lastRetry;
    const result = await lib.upload(Object.assign({}, inputPayload(waiting.input), { retry: waiting.retry }));
    if (!result.ok) return plainFailure(result, "The library record still could not be saved");
    lastRetry = null;
    say(String(result.message || "The library record was saved."));
    if (typeof (waiting.input && waiting.input.onStored) === "function") await waiting.input.onStored(result);
    return { ok: true };
  }

  // Fold hosted rows into the page's own registry so the stage card shows what has been stored.
  function mergeRows(rows, getDocuments, setDocuments) {
    const lib = client();
    if (!lib || typeof getDocuments !== "function" || typeof setDocuments !== "function") return 0;
    const current = getDocuments() || {};
    const list = Array.isArray(current.documents) ? current.documents : [];
    const versionsOf = document => (Array.isArray(document && document.versions) ? document.versions : []);
    const hosted = lib.rowsToDocuments(rows).map(document => Object.assign({}, document, {
      chain_id: String(document.topic_id || ""),
      hosted: true,
      hosted_path: String((versionsOf(document)[versionsOf(document).length - 1] || {}).storage_path || ""),
      origin: "hosted_upload"
    }));
    const hostedTopics = new Set(hosted.map(document => String(document.topic_id)));
    // Drop every hosted record for the topics just read, then append the fresh set: that keeps the merge
    // idempotent and leaves hosted records for other topics untouched.
    const kept = list.filter(document => !(document.hosted && hostedTopics.has(String(document.topic_id))));
    setDocuments(Object.assign({}, current, { documents: kept.concat(hosted) }));
    return hosted.length;
  }

  async function refresh(topicId, getDocuments, setDocuments) {
    const lib = client();
    if (!isConfigured() || !lib || !available()) return 0;
    const listed = await lib.listByTopic(topicId);
    if (!listed.ok) return 0;
    return mergeRows(listed.rows, getDocuments, setDocuments);
  }

  // One read of every stored row, so a chain card, the asset-level final chain and its gate all see what
  // has been stored without each chain being opened first. A chain with no stored document is left alone,
  // which is what keeps a chain that has never been uploaded reading as awaiting, not as delivered.
  // Returns the number of hosted records merged, or -1 when the store could not be read at all.
  async function refreshAll(getDocuments, setDocuments) {
    const lib = client();
    if (!isConfigured() || !lib || !available()) return -1;
    if (typeof lib.listAll !== "function") return -1;
    const listed = await lib.listAll();
    if (!listed.ok) return -1;
    return mergeRows(listed.rows, getDocuments, setDocuments);
  }

  function storageFor(document, version) {
    const wanted = version ? Number(version) : null;
    const versions = Array.isArray(document && document.versions) ? document.versions : [];
    if (!wanted) return versions.length ? versions[versions.length - 1] : null;
    return versions.find(entry => Number(entry.version) === wanted) || null;
  }

  // A record registered before the private store existed names the same file as a stored record when the
  // bytes hash the same. Resolving one to the other is what makes those records downloadable from the
  // published page: the stored record is the one that can name a private object. The registry version
  // number is only a label, so the version that is handed back is the stored version holding those bytes.
  function mirrorOf(entry, documents, version) {
    if (!entry) return null;
    const wanted = version === undefined || version === null || version === "" ? null : Number(version);
    const hashes = new Set(
      (Array.isArray(entry.versions) ? entry.versions : [])
        .filter(item => wanted === null || Number(item.version) === wanted)
        .map(item => String(item.sha256 || "").toLowerCase())
        .filter(Boolean)
    );
    if (!hashes.size) return null;
    for (const candidate of Array.isArray(documents) ? documents : []) {
      if (!candidate || !candidate.hosted) continue;
      const match = (Array.isArray(candidate.versions) ? candidate.versions : [])
        .find(item => hashes.has(String(item.sha256 || "").toLowerCase()));
      if (match) return { document: candidate, version: Number(match.version) };
    }
    return null;
  }

  // Open or download a hosted document: signed link, bytes read back, fingerprint checked against the
  // record before anything is shown or saved. A download is then handed to the browser as the private
  // link itself, so the file is streamed by the browser under the name the reader uploaded. Holding the
  // bytes in page memory and clicking a blob link works on a desktop but is the part that fails on a phone
  // and on a slow connection, where the blob is refused or cut short once the page lets go of it.
  async function openDocument(document, version, mode) {
    const lib = client();
    if (!isConfigured() || !lib) return plainFailure(null, "The private upload service is not available in this page");
    if (!available()) return plainFailure(null, "Sign in with your email and password, or the email link, before opening a research document");
    const record = storageFor(document, version);
    if (!record || !record.storage_path) return plainFailure(null, "This document has no file location, so it cannot be opened");
    // The stored object is named by stage, version and fingerprint; the file the reader gets keeps the name
    // they uploaded, so it is recognisable outside the page.
    const name = String(record.original_filename || "").trim() || String(record.storage_path).split("/").pop() || "research-document.md";
    const link = await lib.signedUrl(
      { storage_path: record.storage_path },
      mode === "view" ? 300 : 600,
      mode === "view" ? null : { download: name }
    );
    if (!link.ok) return plainFailure(link, "A private download link could not be created");
    const doFetch = fetchImpl || root.fetch;
    let response = null;
    try {
      response = await doFetch(link.url, { cache: "no-store" });
    } catch (_) {
      response = null;
    }
    if (!response || !response.ok) {
      // A download does not need this page to hold the bytes: the private link carries the file with a
      // download disposition, so the browser streams it itself. If only the page's own read-back failed
      // (a blocked read, a proxy, a slow link) the reader still gets the file instead of an error, and the
      // message says the fingerprint could not be re-checked here. Viewing keeps the strict path, because
      // nothing may be shown that was not read and checked.
      if (mode !== "view" && typeof root.researchLibraryDownloadLink === "function") {
        root.researchLibraryDownloadLink(name, link.url);
        return { ok: true, message: `${document.title} downloaded from the private store. The fingerprint could not be re-checked in this browser.` };
      }
      return plainFailure(null, response ? `The stored file could not be read (status ${response.status})` : "The stored file could not be reached. Check the connection and try again");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    let verification = "fingerprint not checked in this browser";
    if (lib.sha256Hex && root.crypto && root.crypto.subtle) {
      const actual = await lib.sha256Hex(bytes);
      if (record.sha256 && actual !== record.sha256) {
        return plainFailure(null, `The stored file failed its fingerprint check (${actual.slice(0, 12)} vs ${String(record.sha256).slice(0, 12)}), so it was not opened`);
      }
      verification = `fingerprint checked ${actual.slice(0, 12)}`;
    }
    if (mode === "view") {
      const url = URL.createObjectURL(new Blob([bytes], { type: "text/markdown;charset=utf-8" }));
      root.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { ok: true, message: `${document.title} opened from the private store (${verification}). The link is temporary.` };
    }
    // The bytes are known to be the recorded ones by this point, so the browser can fetch the same private
    // link itself. The page hands over the link, not a blob, and keeps nothing alive after the click.
    if (typeof root.researchLibraryDownloadLink === "function") {
      root.researchLibraryDownloadLink(name, link.url);
    } else if (typeof root.researchLibraryDownloadBytes === "function") {
      root.researchLibraryDownloadBytes(name, bytes);
    } else {
      const anchor = root.document.createElement("a");
      anchor.href = link.url;
      anchor.download = name;
      anchor.rel = "noopener";
      root.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
    return { ok: true, message: `${document.title} downloaded (${verification}).` };
  }

  return {
    configure: configure,
    isConfigured: isConfigured,
    status: status,
    session: session,
    signedIn: signedIn,
    openAccess: openAccess,
    available: available,
    accountBarHtml: accountBarHtml,
    handleAccountAction: handleAccountAction,
    uploadStage: uploadStage,
    retryRegistration: retryRegistration,
    refresh: refresh,
    refreshAll: refreshAll,
    mergeRows: mergeRows,
    openDocument: openDocument,
    mirrorOf: mirrorOf,
    nextVersion: nextVersion
  };
});
