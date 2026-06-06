const layer1Url = "./data/layer1.json";
const layer2Url = "./data/layer2.json";

const labels = {
  "24h": "24H",
  "3d": "3-Day",
  "current_week": "This Week",
  "next_week": "Next Week",
  "current_month": "Month"
};

function updateClock() {
  const el = document.getElementById("currentTime");
  const now = new Date();
  el.textContent = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short"
  }).format(now);
}

function directionClass(direction = "") {
  const d = direction.toLowerCase();
  if (d.includes("bullish") || d.includes("long")) return "bullish";
  if (d.includes("bearish") || d.includes("short")) return "bearish";
  if (d.includes("lean")) return "lean";
  if (d.includes("pending")) return "pending";
  if (d.includes("neutral") || d.includes("no clear")) return "neutral";
  return "neutral";
}

function formatConviction(value) {
  return value === null || value === undefined ? "--" : `${value}%`;
}

function renderLayer1(data) {
  document.getElementById("layer1Updated").textContent =
    `Last updated: ${data.dashboard_meta?.last_updated_et || "pending"}`;

  const grid = document.getElementById("layer1Grid");
  grid.innerHTML = "";

  data.agents.forEach(agent => {
    const card = document.createElement("article");
    card.className = "agent-card";

    const calls = Object.entries(agent.calls || {}).map(([tf, call]) => {
      const direction = call.direction || "PENDING";
      return `
        <div class="call-row">
          <div class="call-row-head">
            <span class="timeframe">${labels[tf] || tf}</span>
            <span class="direction ${directionClass(direction)}">${direction} ${formatConviction(call.conviction)}</span>
          </div>
          <div class="reason">${call.reason || ""}</div>
        </div>
      `;
    }).join("");

    const factors = (agent.key_factors || []).slice(0, 6).map(f => `<span class="factor-pill">${f}</span>`).join("");
    const warnings = (agent.warnings || []).map(w => `<div class="warning">⚠ ${w}</div>`).join("");

    card.innerHTML = `
      <div class="agent-top">
        <div>
          <p class="eyebrow">Layer 1</p>
          <h3>${agent.agent}</h3>
        </div>
        <span class="badge">${agent.status || "pending"}</span>
      </div>
      <p class="summary">${agent.summary || ""}</p>
      <div class="call-list">${calls}</div>
      <div class="factors">${factors}</div>
      ${warnings}
    `;
    grid.appendChild(card);
  });
}

function renderLayer2(data) {
  document.getElementById("layer2Updated").textContent =
    `Last updated: ${data.dashboard_meta?.last_updated_et || "pending"}`;

  const panel = document.getElementById("layer2Panel");
  const agent = data.eco_events_agent || {};
  const adjusted = agent.adjusted_calls || {};

  const cards = Object.entries(adjusted).map(([asset, call]) => {
    const direction = call.direction || "PENDING";
    return `
      <div class="adjusted-card">
        <p class="eyebrow">${asset}</p>
        <h3 class="direction ${directionClass(direction)}">${direction}</h3>
        <p class="summary">${formatConviction(call.conviction)} conviction</p>
        <p class="reason">${call.adjustment || ""}</p>
      </div>
    `;
  }).join("");

  panel.innerHTML = `
    <div class="layer2-summary">
      <div>
        <p class="eyebrow">Eco Events Agent</p>
        <h3>${agent.event_risk || "PENDING"} event risk</h3>
      </div>
      <p class="summary">${agent.summary || "Awaiting event layer."}</p>
    </div>
    <div class="adjusted-grid">${cards}</div>
  `;
}

async function loadDashboard() {
  try {
    const [layer1Res, layer2Res] = await Promise.all([
      fetch(layer1Url, { cache: "no-store" }),
      fetch(layer2Url, { cache: "no-store" })
    ]);

    renderLayer1(await layer1Res.json());
    renderLayer2(await layer2Res.json());
  } catch (err) {
    console.error(err);
    document.getElementById("layer1Grid").innerHTML = `<p class="warning">Could not load dashboard JSON.</p>`;
  }
}

updateClock();
setInterval(updateClock, 1000);
loadDashboard();
setInterval(loadDashboard, 60000);
