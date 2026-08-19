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

function buildWorkflowStatus({
  status = "success",
  startedAt,
  finishedAt,
  message = "Published",
  steps = [],
  refreshRequestId = null,
  failedStep = null,
  errorReason = null
}) {
  const resolvedFailedStep = failedStep || steps.find((step) => String(step?.status || "").toLowerCase() === "failed")?.name || null;
  const resolvedErrorReason = errorReason || steps.find((step) => String(step?.status || "").toLowerCase() === "failed")?.error || null;
  return {
    status,
    message,
    last_run_started_at: startedAt,
    last_run_finished_at: finishedAt,
    refresh_request_id: refreshRequestId,
    failed_step: resolvedFailedStep,
    steps,
    error: resolvedFailedStep ? {
      step: resolvedFailedStep,
      reason: resolvedErrorReason || "Step did not produce output."
    } : null
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

function buildPublishedLayer1(publishedAt) {
  const artifact = clone(baseLayer1);
  artifact.dashboard_meta = {
    ...(artifact.dashboard_meta || {}),
    last_updated_et: publishedAt
  };
  if (Array.isArray(artifact.agents)) {
    artifact.agents = artifact.agents.map((agent, index) => ({
      ...agent,
      status: agent?.status || "live",
      generated_at: addSeconds(publishedAt, -120 + index),
      sealed_at: addSeconds(publishedAt, -90 + index),
      last_run_et: addSeconds(publishedAt, -150 + index)
    }));
  }
  delete artifact.generated_at;
  return artifact;
}

function buildPublishedLayer2(publishedAt) {
  const artifact = clone(baseLayer2);
  artifact.dashboard_meta = {
    ...(artifact.dashboard_meta || {}),
    last_updated_et: publishedAt
  };
  if (Array.isArray(artifact.pairs)) {
    artifact.pairs = artifact.pairs.map((pair, index) => ({
      ...pair,
      generated_at: addSeconds(publishedAt, -30 + index),
      sealed_at: addSeconds(publishedAt, -20 + index),
      valid_from: addSeconds(publishedAt, -40 + index)
    }));
  }
  delete artifact.generated_at;
  return artifact;
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

async function seedStoredRefreshState(page, state) {
  await page.evaluate((value) => {
    localStorage.setItem("dashboard-workflow-refresh-state", JSON.stringify(value));
  }, state);
}

async function seedStoredRefreshStateAndReload(page, state) {
  await seedStoredRefreshState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#runWorkflowButton");
}

test("acceptance is not completion and opaque dispatch remains unverified", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    await page.waitForFunction(() => /Accepted|Delayed/.test(document.getElementById("workflowStatusBadge")?.textContent || ""));
    const ui = await readWorkflowUi(page);
    assert.match(ui.badge, /Accepted|Delayed/);
    assert.match(ui.summary, /Waiting for execution confirmation|taking longer than usual/i);
    assert.match(ui.meta, /not verified acceptance|exceeded the usual threshold/i);
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

test("fresh Layer 1 publication closes browser-local tracking even without exact association", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    harness.setLayer2(buildPublishedLayer2(addSeconds(request.stored.requested_at, 4)));
    harness.setLayer1(buildPublishedLayer1(addSeconds(request.stored.requested_at, 5)));
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
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "published");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Published");
    assert.match(ui.summary, /Dashboard updated after this refresh request/i);
    assert.equal(ui.note, "");
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
    await page.waitForFunction((requestId) => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.refresh_request_id === requestId, first.stored.refresh_request_id);
    const second = await readWorkflowUi(page);
    assert.equal(second.stored?.refresh_request_id, first.stored?.refresh_request_id);
    assert.match(second.summary, /Waiting for execution confirmation|taking longer than usual|temporarily unavailable|exact association remains unverified|lock has expired|could not send the refresh request/i);
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
    harness.setLayer2(buildPublishedLayer2(addSeconds(request.stored.requested_at, 4)));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "publishing");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Publishing");
    assert.match(ui.note, /Layer 2 artifact is visible before Layer 1 publication/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("fresh Layer 1 publication remains terminal after all fresh markers appear", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    harness.setLayer2(buildPublishedLayer2(addSeconds(request.stored.requested_at, 8)));
    harness.setLayer1(buildPublishedLayer1(addSeconds(request.stored.requested_at, 9)));
    harness.setWorkflowStatus(buildWorkflowStatus({
      status: "success",
      startedAt: addSeconds(request.stored.requested_at, 3),
      finishedAt: addSeconds(request.stored.requested_at, 10)
    }));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "published");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Published");
    assert.equal(ui.disabled, false);
    assert.equal(ui.stored?.phase, "published");
    await context.close();
  } finally {
    await harness.close();
  }
});

test("exact August 1 stranded publishing state recovers instead of remaining locked indefinitely", async () => {
  const harness = await createHarness({
    workflowStatus: buildWorkflowStatus({
      status: "success",
      startedAt: "2026-08-01T13:59:05.008Z",
      finishedAt: "2026-08-01T13:59:05.008Z",
      message: "Manual Refresh Complete"
    }),
    layer1: buildPublishedLayer1("2026-08-01T13:59:00.567Z"),
    layer2: buildPublishedLayer2("2026-08-01T13:58:49.305Z")
  });
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await seedStoredRefreshStateAndReload(page, {
      refresh_request_id: "8220b2f0-62b7-4dfb-add4-25e5cd3b6456",
      requested_at: "2026-08-01T13:53:53.039Z",
      source: "dashboard",
      phase: "publishing",
      owner_tab_id: "tab-aug1",
      baseline: {
        workflow_finished_at: "2026-07-31T08:26:54.530Z",
        workflow_started_at: "2026-07-31T08:21:36.178Z",
        layer1_generated_at: "2026-07-31T08:26:50.000Z",
        layer2_generated_at: "2026-07-31T08:26:48.000Z"
      },
      last_updated_at: "2026-08-01T13:59:10.000Z"
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "published");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Published");
    assert.equal(ui.disabled, false);
    assert.doesNotMatch(ui.summary, /Waiting for public publication to settle/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("genuinely active request remains disabled while still inside the verification window", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.disabled, true);
    assert.match(ui.badge, /Accepted|Delayed|Status unavailable/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("exact associated publication completes the tracked request normally", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    const requestId = request.stored.refresh_request_id;
    const finishedAt = addSeconds(request.stored.requested_at, 8);
    const layer2 = buildPublishedLayer2(addSeconds(request.stored.requested_at, 6));
    const layer1 = buildPublishedLayer1(addSeconds(request.stored.requested_at, 7));
    layer1.refresh_request_id = requestId;
    layer2.refresh_request_id = requestId;
    harness.setLayer2(layer2);
    harness.setLayer1(layer1);
    harness.setWorkflowStatus({
      ...buildWorkflowStatus({
        status: "success",
        startedAt: addSeconds(request.stored.requested_at, 3),
        finishedAt
      }),
      refresh_request_id: requestId
    });
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "complete");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Completed");
    assert.equal(ui.disabled, false);
    assert.match(ui.summary, /verified from fresh associated publication signals/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("exact associated artifacts with mismatched run IDs do not count as a completed refresh", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    const requestId = request.stored.refresh_request_id;
    const layer2 = buildPublishedLayer2(addSeconds(request.stored.requested_at, 6));
    const layer1 = buildPublishedLayer1(addSeconds(request.stored.requested_at, 7));
    layer1.refresh_request_id = requestId;
    layer2.refresh_request_id = requestId;
    layer1.source_run_id = "run-layer1";
    layer2.source_run_id = "run-layer2";
    harness.setLayer2(layer2);
    harness.setLayer1(layer1);
    harness.setWorkflowStatus(buildWorkflowStatus({
      status: "success",
      startedAt: addSeconds(request.stored.requested_at, 3),
      finishedAt: addSeconds(request.stored.requested_at, 8),
      refreshRequestId: requestId
    }));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "published");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Published");
    assert.equal(ui.disabled, false);
    assert.doesNotMatch(ui.badge, /Completed/i);
  } finally {
    await harness.close();
  }
});

test("unassociated post-request artifacts expire instead of creating a permanent lock", async () => {
  const runtimeProfile = {
    version: "slow-expiry-test",
    workflow_id: "X75RKU34ikiM5RMU",
    sample_count: 3,
    percentiles_seconds: {
      median: 120,
      p75: 180,
      p80: 240,
      p90: 300,
      p95: 360,
      max: 420
    }
  };
  const harness = await createHarness({
    runtimeProfile,
    workflowStatus: buildWorkflowStatus({
      status: "success",
      startedAt: "2026-07-31T08:21:36.178Z",
      finishedAt: "2026-07-31T08:26:54.530Z"
    }),
    layer1: buildPublishedLayer1("2026-07-31T08:26:50.000Z"),
    layer2: buildPublishedLayer2("2026-08-01T13:58:49.305Z")
  });
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await seedStoredRefreshStateAndReload(page, {
      refresh_request_id: "stale-unassociated",
      requested_at: "2026-08-01T13:53:53.039Z",
      source: "dashboard",
      phase: "publishing",
      owner_tab_id: "tab-stale",
      baseline: {
        workflow_finished_at: "2026-07-31T08:26:54.530Z",
        workflow_started_at: "2026-07-31T08:21:36.178Z",
        layer1_generated_at: "2026-07-31T08:26:50.000Z",
        layer2_generated_at: "2026-07-31T08:26:48.000Z"
      },
      last_updated_at: "2026-08-01T14:25:00.000Z"
    });
    await page.waitForFunction(() => document.getElementById("workflowStatusBadge")?.textContent?.includes("Incomplete"));
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Incomplete");
    assert.equal(ui.disabled, false);
    assert.match(ui.summary, /partial publication/i);
    assert.match(ui.note, /Fresh: Layer 2/i);
    assert.match(ui.note, /Missing: workflow status, Layer 1/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("fresh post-request dashboard writer failure releases the lock even without exact request association", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    harness.setLayer2(buildPublishedLayer2(addSeconds(request.stored.requested_at, 4)));
    harness.setWorkflowStatus(buildWorkflowStatus({
      status: "failed",
      startedAt: addSeconds(request.stored.requested_at, 3),
      finishedAt: addSeconds(request.stored.requested_at, 8),
      message: "Master Orchestrator finished with errors.",
      steps: [
        { name: "Layer 2 Trade Selection Agent", status: "success" },
        { name: "Dashboard Writer", status: "failed", error: "canceling statement due to statement timeout" }
      ]
    }));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "failed");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Failed");
    assert.equal(ui.disabled, false);
    assert.match(ui.note, /Exact request association remains unavailable/i);
    assert.match(ui.note, /statement timeout/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("exact associated dashboard writer failure releases the lock immediately", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    const requestId = request.stored.refresh_request_id;
    harness.setWorkflowStatus(buildWorkflowStatus({
      status: "failed",
      startedAt: addSeconds(request.stored.requested_at, 2),
      finishedAt: addSeconds(request.stored.requested_at, 7),
      refreshRequestId: requestId,
      message: "Master Orchestrator finished with errors.",
      steps: [
        { name: "Dashboard Writer", status: "failed", error: "canceling statement due to statement timeout" }
      ]
    }));
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("dashboard-workflow-refresh-state") || "null")?.phase === "failed");
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Failed");
    assert.equal(ui.disabled, false);
    assert.doesNotMatch(ui.note, /Exact request association remains unavailable/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("hard-timeout with a fresh Layer 1 ingest re-enables Run Refresh without firing another request", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await seedStoredRefreshStateAndReload(page, {
      refresh_request_id: "expired-without-dispatch",
      source: "dashboard",
      requested_at: "2026-08-01T13:53:53.039Z",
      phase: "delayed",
      owner_tab_id: "tab-expired",
      baseline: {
        workflow_finished_at: "2026-07-31T08:26:54.530Z",
        workflow_started_at: "2026-07-31T08:21:36.178Z",
        layer1_generated_at: "2026-07-31T08:26:50.000Z",
        layer2_generated_at: "2026-07-31T08:26:48.000Z"
      },
      last_updated_at: new Date().toISOString()
    });
    await page.waitForTimeout(1500);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.badge, "Published");
    assert.equal(ui.disabled, false);
    assert.equal(harness.getWebhookHits(), 0);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("stale terminal refresh state retires after a newer unrelated published run appears", async () => {
  const harness = await createHarness({
    workflowStatus: buildWorkflowStatus({
      status: "success",
      startedAt: "2026-08-18T08:35:00.000Z",
      finishedAt: "2026-08-18T08:40:00.000Z",
      message: "Manual Refresh Complete"
    }),
    layer1: buildPublishedLayer1("2026-08-18T08:39:40.000Z"),
    layer2: buildPublishedLayer2("2026-08-18T08:39:20.000Z")
  });
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await seedStoredRefreshStateAndReload(page, {
      refresh_request_id: "stale-failed-request",
      requested_at: "2026-08-18T00:10:00.000Z",
      source: "dashboard",
      phase: "failed",
      owner_tab_id: "tab-stale-failed",
      baseline: {
        workflow_finished_at: "2026-08-18T00:00:00.000Z",
        workflow_started_at: "2026-08-18T00:00:00.000Z",
        layer1_generated_at: "2026-08-18T00:00:00.000Z",
        layer2_generated_at: "2026-08-18T00:00:00.000Z"
      },
      observed_markers: {
        workflow_finished_at: "2026-08-18T00:15:00.000Z",
        workflow_started_at: "2026-08-18T00:11:00.000Z",
        workflow_status: "failed",
        workflow_failed_step: "USD Collector",
        workflow_error_reason: "Collector timeout",
        workflow_refresh_request_id: null,
        workflow_source_run_id: null,
        layer1_generated_at: "2026-08-18T00:14:00.000Z",
        layer1_refresh_request_id: null,
        layer1_source_run_id: null,
        layer2_generated_at: "2026-08-18T00:13:00.000Z",
        layer2_refresh_request_id: null,
        layer2_source_run_id: null
      },
      fresh_artifacts: ["workflow status", "Layer 1", "Layer 2"],
      missing_artifacts: [],
      workflow_failure: {
        failed_step: "USD Collector",
        reason: "Collector timeout",
        exact_association: false,
        relevant_partial_publication: true
      },
      last_updated_at: "2026-08-18T00:15:00.000Z"
    });
    await page.evaluate(async () => {
      await globalThis.__dashboardTestHooks.loadWorkflowStatusForTest();
      await globalThis.__dashboardTestHooks.loadDashboardForTest();
    });
    await page.waitForTimeout(1200);
    const ui = await readWorkflowUi(page);
    assert.equal(ui.disabled, false);
    assert.doesNotMatch(ui.badge, /Failed/i);
    assert.doesNotMatch(ui.summary, /refresh stopped/i);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("long elapsed times render as HH:MM:SS", async () => {
  const harness = await createHarness();
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await seedStoredRefreshStateAndReload(page, {
      refresh_request_id: "elapsed-clock",
      requested_at: addSeconds(new Date().toISOString(), -(41 * 3600 + 15)),
      source: "dashboard",
      phase: "delayed",
      owner_tab_id: "tab-clock",
      baseline: {
        workflow_finished_at: "2026-07-31T08:26:54.530Z",
        workflow_started_at: "2026-07-31T08:21:36.178Z",
        layer1_generated_at: "2026-07-31T08:26:50.000Z",
        layer2_generated_at: "2026-07-31T08:26:48.000Z"
      },
      last_updated_at: new Date().toISOString()
    });
    const ui = await readWorkflowUi(page);
    assert.match(ui.elapsed, /^Elapsed \d{2}:\d{2}:\d{2}$/);
    assert.match(ui.elapsed, /Elapsed 41:00:1\d/);
    await context.close();
  } finally {
    await harness.close();
  }
});

test("remaining estimate never stays at 00:00 while refresh is still locked", async () => {
  const runtimeProfile = {
    version: "overdue-estimate-test",
    workflow_id: "X75RKU34ikiM5RMU",
    sample_count: 3,
    percentiles_seconds: {
      median: 1.2,
      p75: 8,
      p80: 9,
      p90: 10,
      p95: 12,
      max: 15
    }
  };
  const harness = await createHarness({ runtimeProfile });
  try {
    const context = await harness.createContext();
    const page = await openDashboard(context, harness.origin);
    await triggerRefresh(page);
    const request = await readWorkflowUi(page);
    await seedStoredRefreshStateAndReload(page, {
      ...request.stored,
      requested_at: addSeconds(request.stored.requested_at, -5),
      phase: "accepted",
      last_updated_at: new Date().toISOString()
    });
    const ui = await readWorkflowUi(page);
    assert.doesNotMatch(ui.eta, /Estimated time remaining 00:00:00/);
    if (ui.disabled) {
      assert.equal(ui.eta, "Verification overdue");
    }
    await context.close();
  } finally {
    await harness.close();
  }
});
