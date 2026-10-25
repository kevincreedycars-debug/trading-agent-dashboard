#!/usr/bin/env node
"use strict";

// Drive the published Research Library the way a reader does, on a desktop-sized page or on a
// phone-sized one, and report PASS or FAIL at every step that matters.
//
//   node scripts/research_library_page_check.js
//   node scripts/research_library_page_check.js --mobile
//   node scripts/research_library_page_check.js --mobile --provision
//
// Steps: open the published page, sign in from the account block, open one factor chain, confirm the
// upload form asks for one file and no model or session label, upload the registered test document,
// read the stage pill, reload and read it again (the session has to survive that), open View and
// Download, then read the next stage's attach block and download the parent document it names.
//
// Test data is isolated and removed again. The script reads the rows for the chain before it starts,
// uploads once, and in a finally block deletes only the rows that appeared during the run, their
// objects, and â€” when it created one â€” the check account and its membership row. Rows that were
// already in the store are never touched.
//
// Accounts: set CHECK_EMAIL and CHECK_PASSWORD, or pass --provision with SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY so the run creates and removes its own member. The browser run itself uses
// only the publishable key the published page already carries.

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, devices } = require("playwright");

const SITE = process.env.CHECK_URL || "https://kevincreedycars-debug.github.io/trading-agent-dashboard/";
const CHAIN = process.env.CHECK_CHAIN || "live.f8-fed-bias";
const CHAIN_ID = process.env.CHECK_CHAIN_ID || "usd-factor-live-f8-fed-bias";
const FIXTURE = path.resolve(__dirname, "..", "docs", "research-library", "test-uploads", "TEST-RESEARCH-LIBRARY-UPLOAD-20261024.md");
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const provision = args.includes("--provision");
const keepRows = args.includes("--keep-rows");

let failed = false;
const results = {};
function report(label, passed, detail) {
  results[label] = { passed: Boolean(passed), detail: detail === undefined ? "" : detail };
  console.log(`${label}: ${passed ? "PASS" : "FAIL"}${detail ? ` - ${detail}` : ""}`);
  if (!passed) failed = true;
}

function summarise(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function serviceBase() {
  return String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
}

async function rowsForChain() {
  const base = serviceBase();
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const response = await fetch(`${base}/rest/v1/research_documents?topic_id=eq.${encodeURIComponent(CHAIN_ID)}&select=id,storage_path`, { headers: serviceHeaders() });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

async function provisionAccount() {
  const base = serviceBase();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("--provision needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const email = `page-check-${stamp}@example.com`;
  const password = crypto.randomBytes(18).toString("base64url");
  const created = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST", headers: serviceHeaders(), body: JSON.stringify({ email, password, email_confirm: true })
  });
  if (!created.ok) throw new Error(`the check account could not be created (${created.status})`);
  const user = await created.json();
  const member = await fetch(`${base}/rest/v1/research_members`, {
    method: "POST", headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: user.id, note: "page check, removed by the same run" })
  });
  if (!member.ok) throw new Error(`the check member row could not be added (${member.status})`);
  return { email, password, userId: user.id };
}

async function removeAccount(account) {
  const base = serviceBase();
  const removedMember = await fetch(`${base}/rest/v1/research_members?user_id=eq.${account.userId}`, { method: "DELETE", headers: serviceHeaders() });
  const removedUser = await fetch(`${base}/auth/v1/admin/users/${account.userId}`, { method: "DELETE", headers: serviceHeaders() });
  return { member: removedMember.status, user: removedUser.status };
}

async function removeRows(created) {
  const base = serviceBase();
  if (!created.length) return { rows: 0, objects: null };
  const paths = created.map(row => row.storage_path).filter(Boolean);
  let objects = null;
  if (paths.length) {
    const removed = await fetch(`${base}/storage/v1/object/research-documents`, {
      method: "DELETE", headers: serviceHeaders(), body: JSON.stringify({ prefixes: paths })
    });
    objects = removed.status;
  }
  const ids = created.map(row => row.id).join(",");
  const removedRows = await fetch(`${base}/rest/v1/research_documents?id=in.(${encodeURIComponent(ids)})`, { method: "DELETE", headers: serviceHeaders() });
  return { rows: created.length, objects, status: removedRows.status };
}


async function openLibrary(page) {
  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button[data-tab="research-library"]', { timeout: 60000 });
  await page.locator('button[data-tab="research-library"]').click();
  await page.waitForSelector("[data-rl-shell]", { timeout: 60000 });
  await page.waitForTimeout(1500);
}

async function openChain(page) {
  const row = page.locator(`tr[data-rl-factor="${CHAIN}"]`);
  await row.waitFor({ timeout: 30000 });
  if ((await row.getAttribute("aria-expanded")) !== "true") await row.click();
  await page.waitForSelector(`[data-rl-factor-expansion="${CHAIN}"]`, { timeout: 30000 });
  await page.waitForTimeout(900);
}

function stageCard(page, stage) {
  return page.locator(`article[data-rl-chain-stage="${CHAIN_ID}:${stage}"]`);
}

async function waitForPill(card, wanted, timeoutMs) {
  const pill = card.locator("[data-rl-stage-pill]");
  const deadline = Date.now() + timeoutMs;
  let text = "";
  while (Date.now() < deadline) {
    text = summarise(await pill.innerText().catch(() => ""));
    if (wanted.test(text)) return text;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return text;
}

async function main() {
  if (!fs.existsSync(FIXTURE)) throw new Error(`the test document is missing: ${FIXTURE}`);

  let account = null;
  let created = [];
  const before = await rowsForChain();
  const beforeIds = new Set((before || []).map(row => row.id));

  let email = process.env.CHECK_EMAIL || "";
  let password = process.env.CHECK_PASSWORD || "";
  if (provision) {
    account = await provisionAccount();
    email = account.email;
    password = account.password;
  }
  if (!email || !password) throw new Error("set CHECK_EMAIL and CHECK_PASSWORD, or pass --provision");

  console.log(`checking ${SITE}`);
  console.log(`chain ${CHAIN} (${CHAIN_ID}), ${mobile ? "phone-sized emulation" : "desktop"}`);

  const browser = await chromium.launch();
  const context = await browser.newContext(mobile
    ? { ...devices["iPhone 13"], acceptDownloads: true }
    : { viewport: { width: 1500, height: 1200 }, acceptDownloads: true });
  const page = await context.newPage();
  const hosts = new Set();
  const pageErrors = [];
  page.on("request", request => {
    try { hosts.add(new URL(request.url()).hostname); } catch (_) { /* no host to record */ }
  });
  page.on("pageerror", error => pageErrors.push(String(error && error.message)));

  try {
    await openLibrary(page);
    report("published page loaded", true, summarise(await page.locator("[data-rl-head]").first().innerText().catch(() => "")).slice(0, 60));
    const signedInBefore = (await page.locator('[data-rl-account="signed-in"]').count()) > 0;
    if (!signedInBefore) {
      await page.fill("#researchUploadEmail", email);
      await page.fill("#researchUploadPassword", password);
      await page.locator("[data-rl-account-password-signin]").click();
    }
    await page.waitForSelector('[data-rl-account="signed-in"]', { timeout: 45000 });
    report("signed in", true, signedInBefore ? "session already remembered" : "email and password");

    if (mobile) {
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        phone: /iPhone|Android/i.test(navigator.userAgent)
      }));
      report("no sideways overflow on a phone-sized screen", layout.document <= layout.viewport + 1,
        `viewport ${layout.viewport}px, page ${layout.document}px, phone user agent ${layout.phone}`);
    }

    await openChain(page);
    let card = stageCard(page, "research");
    await card.waitFor({ timeout: 30000 });
    report("stage 1 opened", true, summarise(await card.locator("[data-rl-stage-pill]").innerText()));

    await card.locator("[data-rl-upload-toggle]").click();
    const form = card.locator("[data-rl-upload-form]");
    await form.waitFor({ timeout: 30000 });
    const fileInputs = await form.locator('input[type="file"]').count();
    const modelField = await form.locator("[data-rl-upload-model]").count();
    report("the form asks for one file", fileInputs === 1, `${fileInputs} file input`);
    report("no model or session field", modelField === 0, `${modelField} model inputs`);

    if (mobile) {
      await card.scrollIntoViewIfNeeded();
      await form.locator("[data-rl-stage-upload]").scrollIntoViewIfNeeded();
      const bounds = await form.locator("[data-rl-stage-upload]").boundingBox();
      const viewport = await page.evaluate(() => window.innerWidth);
      report("the upload button is on screen and in reach",
        Boolean(bounds) && bounds.x >= 0 && bounds.x + bounds.width <= viewport + 1,
        bounds ? `button at ${Math.round(bounds.x)}-${Math.round(bounds.x + bounds.width)}px of ${viewport}px` : "no button");
    }

    await form.locator("[data-rl-upload-file]").setInputFiles(FIXTURE);
    await form.locator("[data-rl-stage-upload]").click();
    const uploadedPill = await waitForPill(card, /^uploaded$/i, 60000);
    report("the stage reads Uploaded after the click", /^uploaded$/i.test(uploadedPill), uploadedPill);

    const documentBlock = card.locator(".rl-factor-stage-actions");
    await card.locator("[data-rl-view]:not([disabled])").waitFor({ timeout: 30000 });
    const stageOneId = await card.locator("[data-rl-view]").first().getAttribute("data-rl-view");
    const stageOneEvidence = summarise(await card.locator(".rl-factor-stage-evidence").innerText());
    report("the stage shows the stored file, version and hash",
      Boolean(stageOneId) && /sha256 [0-9a-f]{12}/i.test(stageOneEvidence) && /TEST-RESEARCH-LIBRARY-UPLOAD/i.test(stageOneEvidence),
      stageOneEvidence);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('button[data-tab="research-library"]', { timeout: 60000 });
    await page.locator('button[data-tab="research-library"]').click();
    await page.waitForSelector("[data-rl-shell]", { timeout: 60000 });
    await page.waitForTimeout(1500);
    report("the session survives a reload",
      (await page.locator('[data-rl-account="signed-in"]').count()) > 0, "no second sign-in needed");
    await openChain(page);
    card = stageCard(page, "research");
    await card.waitFor({ timeout: 30000 });
    await card.locator("[data-rl-view]:not([disabled])").waitFor({ timeout: 30000 });
    const reloadedPill = await waitForPill(card, /^uploaded$/i, 30000);
    const reloadedId = await card.locator("[data-rl-view]").first().getAttribute("data-rl-view");
    report("the stage still reads Uploaded after a reload", /^uploaded$/i.test(reloadedPill), reloadedPill);
    report("the same document is shown after a reload", reloadedId === stageOneId, String(reloadedId));

    // The next stage has to name the version it judges, and hand that file back for attaching.
    const nextCard = stageCard(page, "red_team");
    await nextCard.waitFor({ timeout: 30000 });
    const parentButton = nextCard.locator(".rl-factor-stage-actions button[data-rl-download]").first();
    const parentId = await parentButton.getAttribute("data-rl-download");
    const nextEvidence = summarise(await nextCard.locator(".rl-factor-stage-evidence").innerText());
    report("stage 2 names the stage 1 document it follows",
      parentId === stageOneId && !(await parentButton.isDisabled()),
      `${parentId} vs ${stageOneId} - ${nextEvidence.slice(0, 120)}`);

    const parentDownload = page.waitForEvent("download", { timeout: 45000 }).catch(() => null);
    await parentButton.click();
    const parentSaved = await parentDownload;
    if (parentSaved) {
      const savedPath = path.join(os.tmpdir(), `page-check-parent-${Date.now()}.md`);
      await parentSaved.saveAs(savedPath);
      const saved = fs.readFileSync(savedPath);
      report("stage 2 hands back the parent file byte for byte",
        Buffer.compare(saved, fs.readFileSync(FIXTURE)) === 0,
        `${parentSaved.suggestedFilename()}, ${saved.length} bytes`);
      fs.rmSync(savedPath, { force: true });
    } else {
      report("stage 2 hands back the parent file byte for byte", false, "no download event");
    }

    // View: the private link is minted and the bytes open in a new tab.
    const popupPromise = page.waitForEvent("popup", { timeout: 45000 }).catch(() => null);
    await card.locator("[data-rl-view]").first().click();
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      const text = summarise(await popup.evaluate(() => document.body.innerText).catch(() => ""));
      report("View opens the stored bytes", /TEST document/i.test(text), text.slice(0, 80));
      await popup.close();
      await page.waitForTimeout(1200);
    } else {
      report("View opens the stored bytes", false, "no new tab");
    }

    // Download: the saved file has to match the file that was chosen.
    const downloadPromise = page.waitForEvent("download", { timeout: 45000 }).catch(() => null);
    await card.locator(".rl-factor-stage-actions button[data-rl-download]").last().click();
    const download = await downloadPromise;
    if (download) {
      const savedPath = path.join(os.tmpdir(), `page-check-download-${Date.now()}.md`);
      await download.saveAs(savedPath);
      const saved = fs.readFileSync(savedPath);
      report("Download saves the same bytes under the uploaded name",
        Buffer.compare(saved, fs.readFileSync(FIXTURE)) === 0 && /TEST-RESEARCH-LIBRARY-UPLOAD/i.test(download.suggestedFilename()),
        `${download.suggestedFilename()}, ${saved.length} bytes`);
      fs.rmSync(savedPath, { force: true });
    } else {
      report("Download saves the same bytes under the uploaded name", false, "no download event");
    }

    // The final chain is gated by the registry, so a factor upload must not move its gate. This reads the card
    // the way a reader does: the count it shows, whether it is unlocked, and whether an upload form is offered.
    const finalCard = page.locator("[data-rl-final-chain]").first();
    const finalPresent = (await finalCard.count()) > 0;
    const gateCount = finalPresent ? String(await finalCard.getAttribute("data-rl-final-gate")) : "";
    const gateUnlocked = finalPresent ? String(await finalCard.getAttribute("data-rl-final-unlocked")) : "";
    const gateText = finalPresent
      ? summarise(await finalCard.locator("[data-rl-final-gate-text]").first().innerText().catch(() => ""))
      : "";
    report("the final chain still reads its factor count",
      finalPresent && /^\d+\/\d+$/.test(gateCount), gateCount);
    report("a factor upload leaves the final chain gate closed",
      gateUnlocked === "false", `unlocked=${gateUnlocked}; ${gateText.slice(0, 120)}`);
    const finalInputs = finalPresent ? await finalCard.locator('input[type="file"], textarea').count() : 0;
    report("no final-chain upload form is offered while the gate is closed",
      gateUnlocked !== "false" || finalInputs === 0, `${finalInputs} input(s)`);

    const loopback = Array.from(hosts).filter(host => LOOPBACK.test(host));
    report("nothing asked the local service for anything", loopback.length === 0,
      `hosts contacted: ${Array.from(hosts).sort().join(", ")}`);
    report("no page errors", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 200));
  } finally {
    await browser.close();
    // Whatever happened above, remove only the rows that appeared during this run.
    const after = await rowsForChain().catch(() => null);
    if (after) created = after.filter(row => !beforeIds.has(row.id));
    if (!keepRows) {
      const removed = await removeRows(created).catch(error => ({ error: String(error && error.message) }));
      console.log(`cleanup rows: ${JSON.stringify(removed)}`);
    } else if (created.length) {
      console.log(`kept ${created.length} row(s) because --keep-rows was passed`);
    }
    if (account) {
      const removedAccount = await removeAccount(account).catch(error => ({ error: String(error && error.message) }));
      console.log(`cleanup account: ${JSON.stringify(removedAccount)}`);
    }
  }

  console.log(JSON.stringify({ passed: !failed, formFactor: mobile ? "phone-sized emulation" : "desktop", site: SITE, chain: CHAIN_ID, results }, null, 2));
  if (failed) process.exitCode = 1;
}

module.exports = { summarise };

if (require.main === module) {
  main().catch(error => {
    console.error(`PAGE CHECK FAILED: ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  });
}


