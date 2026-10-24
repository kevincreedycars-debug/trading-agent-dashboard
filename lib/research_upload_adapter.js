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

  function isConfigured() {
    return configured && !!client();
  }

  function status() {
    return { configured: isConfigured(), signedIn: signedIn(), blocked: blockedReason };
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
    const result = lib.configure({ url: credentials.url, key: credentials.key, fetch: input.fetch, storage: input.storage });
    configured = !!result.ok;
    blockedReason = result.ok ? "" : String(result.message || "The upload service could not be configured.");
    if (configured && signedIn() && !account.message) {
      account.message = "Signed in. Upload and download are available on this page.";
      account.tone = "ok";
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
          <label class="rl-account-label" for="researchUploadEmail">Email address</label>
          <input class="rl-account-input" id="researchUploadEmail" type="email" autocomplete="username"
                 placeholder="the research library account" data-rl-account-email="true" value="${escape(account.email)}" />
          <label class="rl-account-label" for="researchUploadPassword">Password</label>
          <input class="rl-account-input" id="researchUploadPassword" type="password" autocomplete="current-password"
                 data-rl-account-password="true" value="" />
          <button type="button" class="ghost-button" data-rl-account-password-signin="true">Sign in</button>
        </div>
        <p class="rl-account-copy">${escape(account.message || "Sign in once in this browser with the research library account. After that, choosing a file is the whole upload: this page records the file name, the time, the factor, the stage and the version for you, and it links the earlier stage it follows.")}</p>
      </div>`;
  }

  async function handleAccountAction(target) {
    const lib = client();
    if (!lib) return false;
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
    return {
      topicId: ownerIdOf(input),
      stage: STAGE_ORDER[stage.stage],
      title: String((input && input.title) || "").trim() || `${topic.title} - ${stage.label || stage.stage}`,
      // Factor stages store their document type, as before. Final stages carry their stage name because
      // the hosted table's three stage numbers cannot distinguish the two chains on their own.
      kind: finalStage ? String(stage.stage) : String(stage.document_type || stage.stage || ""),
      notes: note,
      file: input && input.file,
      parents: (input && input.parents) || {}
    };
  }

  // Upload one stage document. The caller has already checked the file, the model label and the parents,
  // so this function only has to store the bytes and record them.
  async function uploadStage(input) {
    const lib = client();
    if (!isConfigured() || !lib) return plainFailure(null, "The private upload service is not available in this page");
    if (!signedIn()) return plainFailure(null, "Sign in with your email and password, or the email link, before uploading a research document");
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
    if (!isConfigured() || !lib || !signedIn()) return 0;
    const listed = await lib.listByTopic(topicId);
    if (!listed.ok) return 0;
    return mergeRows(listed.rows, getDocuments, setDocuments);
  }

  function storageFor(document, version) {
    const wanted = version ? Number(version) : null;
    const versions = Array.isArray(document && document.versions) ? document.versions : [];
    if (!wanted) return versions.length ? versions[versions.length - 1] : null;
    return versions.find(entry => Number(entry.version) === wanted) || null;
  }

  // Open or download a hosted document: signed link, bytes read back, fingerprint checked against the
  // record before anything is shown or saved.
  async function openDocument(document, version, mode) {
    const lib = client();
    if (!isConfigured() || !lib) return plainFailure(null, "The private upload service is not available in this page");
    if (!signedIn()) return plainFailure(null, "Sign in with your email and password, or the email link, before opening a research document");
    const record = storageFor(document, version);
    if (!record || !record.storage_path) return plainFailure(null, "This document has no file location, so it cannot be opened");
    const link = await lib.signedUrl({ storage_path: record.storage_path }, mode === "view" ? 300 : 600);
    if (!link.ok) return plainFailure(link, "A private download link could not be created");
    const doFetch = fetchImpl || root.fetch;
    let response;
    try {
      response = await doFetch(link.url, { cache: "no-store" });
    } catch (_) {
      return plainFailure(null, "The stored file could not be reached. Check the connection and try again");
    }
    if (!response.ok) return plainFailure(null, `The stored file could not be read (status ${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let verification = "fingerprint not checked in this browser";
    if (lib.sha256Hex && root.crypto && root.crypto.subtle) {
      const actual = await lib.sha256Hex(bytes);
      if (record.sha256 && actual !== record.sha256) {
        return plainFailure(null, `The stored file failed its fingerprint check (${actual.slice(0, 12)} vs ${String(record.sha256).slice(0, 12)}), so it was not opened`);
      }
      verification = `fingerprint checked ${actual.slice(0, 12)}`;
    }
    // The stored object is named by stage, version and fingerprint; the file the reader gets keeps the name
    // they uploaded, so it is recognisable outside the page.
    const name = String(record.original_filename || "").trim() || String(record.storage_path).split("/").pop() || "research-document.md";
    if (mode === "view") {
      const url = URL.createObjectURL(new Blob([bytes], { type: "text/markdown;charset=utf-8" }));
      root.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { ok: true, message: `${document.title} opened from the private store (${verification}). The link is temporary.` };
    }
    if (typeof root.researchLibraryDownloadBytes === "function") {
      root.researchLibraryDownloadBytes(name, bytes);
    } else {
      const url = URL.createObjectURL(new Blob([bytes], { type: "text/markdown;charset=utf-8" }));
      const anchor = root.document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    return { ok: true, message: `${document.title} downloaded (${verification}).` };
  }

  return {
    configure: configure,
    isConfigured: isConfigured,
    status: status,
    session: session,
    signedIn: signedIn,
    accountBarHtml: accountBarHtml,
    handleAccountAction: handleAccountAction,
    uploadStage: uploadStage,
    retryRegistration: retryRegistration,
    refresh: refresh,
    mergeRows: mergeRows,
    openDocument: openDocument,
    nextVersion: nextVersion
  };
});
