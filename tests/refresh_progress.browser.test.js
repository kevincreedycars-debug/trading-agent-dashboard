const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const baseLayer1 = readJson("data/layer1.json");
const baseLayer2 = readJson("data/layer2.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "text/plain; charset=utf-8";
}

function buildLayer1(generatedAt) {
  const artifact = clone(baseLayer1);
  artifact.generated_at = generatedAt;
  artifact.source_run_id = null;
  if (artifact.agents && typeof artifact.agents === "object") {
    Object.values(artifact.agents).forEach((agent) => {
      if (agent && typeof agent === "object") {
        agent.generated_at = generatedAt;
        agent.source_run_id = null;
      }
    });
  }
  return artifact;
}

function buildLayer2(generatedAt) {
  const artifact = clone(baseLayer2);
  artifact.generated_at = generatedAt;
  artifact.source_run_id = null;
  return artifact;
}

function buildWorkflowStatus({ status = "success", startedAt, finishedAt, message = "Published", steps = [] }) {
  return {
    status,
    message,
    last_run_started_at: startedAt,
    last_run_finished_at: finishedAt,
    steps,
    error: null
  };
}

async function createHarness(options = {}) {
  const initialRuntimeProfile = options.runtimeProfile === undefined ? {
    version: "test-runtime-profile",
    workflow_id: "X75RKU34ikiM5RMU",
    sample_count: 3,
    percentiles_seconds: {
      median: 1.2,
      p75: 1.5,
      p80: 1.6,
      p90: 2.0,
      p95: 2.2,
      max: 2.5
    }
  } : options.runtimeProfile;
  let runtimeProfile = initialRuntimeProfile;
  let statusFails = false;
  let webhookHits = 0;
  let workflowStatus = options.workflowStatus || buildWorkflowStatus({
    status: "success",
    startedAt: "2026-07-31T08:21:36.178Z",
    finishedAt: "2026-07-31T08:26:54.530Z",
    message: "Last production run finished."
  });
  let layer1 = options.layer1 || buildLayer1("2026-07-31T08:26:50.000Z");
  let layer2 = options.layer2 || buildLayer2("2026-07-31T08:26:48.000Z");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;

    if (pathname === "/mock-webhook" && req.method === "POST") {
      webhookHits += 1;
      res.writeHead(202, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ accepted: true }));
      return;
    }

    if (pathname === "/data/workflow-control.json") {
      const body = {
        enabled: true,
        webhook_url: `${origin}/mock-webhook`,
        request_mode: "no-cors",
        status_url: `${origin}/data/workflow-status.json`,
        runtime_profile_url: `${origin}/data/refresh-runtime-profile.json`,
        poll_interval_ms: 100,
        poll_after_trigger_ms: 500
      };
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
      return;
    }

    if (pathname === "/data/workflow-status.json") {
      if (statusFails) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "status unavailable" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(workflowStatus));
      return;
    }

    if (pathname === "/data/refresh-runtime-profile.json") {
      if (!runtimeProfile) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "missing runtime profile" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(runtimeProfile));
      return;
    }

    if (pathname === "/data/layer1.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(layer1));
      return;
    }

    if (pathname === "/data/layer2.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(layer2));
      return;
    }

    const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const filePath = path.resolve(repoRoot, relativePath);
    if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(fs.readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });

  return {
    origin,
    browser,
    async close() {
      await browser.close();
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    },
    createContext: () => browser.newContext(),
    getWebhookHits: () => webhookHits,
    setRuntimeProfile(value) {
      runtimeProfile = value;
    },
    setStatusFailure(enabled) {
      statusFails = Boolean(enabled);
    },
    setWorkflowStatus(value) {
      workflowStatus = value;
    },
    setLayer1(value) {
      layer1 = value;
    },
    setLayer2(value) {
      layer2 = value;
    }
  };
}

async function openDashboard(context, origin) {
  const page = await context.newPage();
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#runWorkflowButton");
  return page;
}

function addSeconds(timestamp, seconds) {
  return new Date(new Date(timestamp).getTime() + (seconds * 1000)).toISOString();
}

async function readWorkflowUi(page) {
  return page.evaluate(() => ({
    badge: document.getElementById("workflowStatusBadge")?.textContent?.trim() || "",
    summary: document.getElementById("workflowStatusSummary")?.textContent?.trim() || "",
    meta: document.getElementById("workflowProgressMeta")?.textContent?.trim() || "",
    note: document.getElementById("workflowProgressNote")?.textContent?.trim() || "",
    eta: document.getElementById("workflowEta")?.textContent?.trim() || "",
    elapsed: document.getElementById("workflowElapsed")?.textContent?.trim() || "",
    disabled: Boolean(document.getElementById("runWorkflowButton")?.disabled),
    stored: JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")
  }));
}

async function triggerRefresh(page) {
  await page.click("#runWorkflowButton");
  await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")));
}

test("acceptance is not completion and opaque dispatch remains unverified", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    await page.waitForFunction(() => document.getElementById("workflowStatusBadge")?.textContent?.includes("Accepted"));
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Accepted");
    assert.match(ui.summary, /Waiting for execution confirmation/i);
    assert.match(ui.meta, /not verified acceptance/i);
    assert.match(ui.note, /completion guarantee/i);
    assert.doesNotMatch(ui.badge, /Complete/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("stale previous success does not satisfy a new request", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    const before = await readWorkflowUi(page);
    assert.match(before.badge, /SUCCESS|Success/i);
    await triggerRefresh(page);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Accepted");
    assert.match(ui.summary, /Waiting for execution confirmation/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("fresh unrelated success becomes Association unverified instead of Complete", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    harness.setLayer2(buildLayer2(addSeconds(request.stored.requested_at, 4)));
    harness.setLayer1(buildLayer1(addSeconds(request.stored.requested_at, 5)));
    harness.setWorkflowStatus(buildWorkflowStatus({
      status: "success",
      startedAt: addSeconds(request.stored.requested_at, 3),
      finishedAt: addSeconds(request.stored.requested_at, 6),
      message: "A newer run finished."
    }));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => document.getElementById("workflowStatusBadge")?.textContent?.includes("Association unverified"));
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Association unverified");
    assert.match(ui.summary, /exact association remains unverified/i);
    assert.match(ui.note, /will not label this request Complete/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("countdown expiry without success becomes Delayed", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    await page.waitForTimeout(1800);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Delayed");
    assert.match(ui.summary, /taking longer than usual/i);
    assert.match(ui.note, /does not mean success/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("runtime-profile absence degrades to estimate unavailable", async () => {
  const harness = await createHarness({ runtimeProfile: null });
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.eta, "Estimate unavailable");
    await context.close();
  } finally {
    await harness.close();
  }
});

test("duplicate click protection sends only one local webhook request", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    await page.click("#runWorkflowButton", { timeout: 250 }).catch(() => null);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.disabled, true);
    assert.equal(harness.getWebhookHits(), 1);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("two tabs coordinate through localStorage and block the second trigger", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const pageOne = await openDashboard(context, harness.origin);
    const pageTwo = await openDashboard(context, harness.origin);
    await triggerRefresh(pageOne);
    await pageTwo.waitForFunction(() => document.getElementById("runWorkflowButton")?.disabled);
    const uiTwo = await readWorkflowUi(pageTwo);
    assert.equal(uiTwo.disabled, true);
    assert.equal(uiTwo.badge, "Accepted");
    assert.equal(uiTwo.stored?.refresh_request_id, (await readWorkflowUi(pageOne)).stored?.refresh_request_id);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("reload while running restores the active request from localStorage", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const first = await readWorkflowUi(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("runWorkflowButton")?.disabled);
    const second = await readWorkflowUi(page);
    assert.equal(second.stored?.refresh_request_id, first.stored?.refresh_request_id);
    assert.equal(second.disabled, true);
    assert.match(second.summary, /Waiting for execution confirmation|taking longer than usual|temporarily unavailable/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("closing and reopening the page restores browser-local refresh tracking", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const first = await readWorkflowUi(page);
    await page.close();
    const reopened = await openDashboard(context, harness.origin);
    await reopened.waitForFunction(() => document.getElementById("runWorkflowButton")?.disabled);
    const second = await readWorkflowUi(reopened);
    assert.equal(second.stored?.refresh_request_id, first.stored?.refresh_request_id);
    assert.equal(second.disabled, true);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("polling failure surfaces Status unavailable while a request is active", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    harness.setStatusFailure(true);
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
    });
    await page.waitForFunction(() => document.getElementById("workflowStatusBadge")?.textContent?.includes("Status unavailable"));
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Status unavailable");
    assert.match(ui.note, /cannot confirm progress/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("delayed public visibility shows Publishing before final workflow status catches up", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    harness.setLayer2(buildLayer2(addSeconds(request.stored.requested_at, 4)));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => document.getElementById("workflowStatusBadge")?.textContent?.includes("Publishing"));
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Publishing");
    assert.match(ui.note, /Layer 2 artifact is visible before Layer 1 publication/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("Association unverified remains the browser-only terminal state after all fresh markers appear", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    harness.setLayer2(buildLayer2(addSeconds(request.stored.requested_at, 8)));
    harness.setLayer1(buildLayer1(addSeconds(request.stored.requested_at, 9)));
    harness.setWorkflowStatus(buildWorkflowStatus({
      status: "success",
      startedAt: addSeconds(request.stored.requested_at, 3),
      finishedAt: addSeconds(request.stored.requested_at, 10)
    }));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => document.getElementById("workflowStatusBadge")?.textContent?.includes("Association unverified"));
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Association unverified");
    assert.equal(ui.disabled, false);
    assert.equal(ui.stored?.phase, "association_unverified");
    await context.close();
  } finally {
    await harness.close();
  }
});
