// The corner lamp for the blind lane, beside the one FTMO 2 has had since 2026-11-13.
//
// It is a lamp, not a control: it reads the lanes document, that lane's broker snapshot and its heartbeat (when
// there is one) and states one word. `Active` is reserved for a fresh, armed heartbeat. `Connected` is a lane whose
// broker feed is fresh while the strategy is parked - which is the blind lane's normal state, because its trader is
// registered and disabled until the owner arms it. `Stale` is a feed or a heartbeat the page can no longer date, and
// `Paused` is a lane parked in the lanes file. The two ages are stated apart on the detail line, because a fresh
// broker snapshot and a silent strategy are different facts and the whole point of this lane is to tell them apart.
(() => {
  const panel = document.getElementById("ftmo3Status");
  const details = document.getElementById("ftmo3StatusDetails");
  const strip = document.getElementById("liveTraderStatusFtmo3");
  const LANE = "ftmo-3";
  const LANES_PATH = "data/live-trading-lanes.json";
  const SNAPSHOT_FALLBACK = "data/live-trading.blind.json";
  const HEARTBEAT_FALLBACK = "data/live-trading-trader.ftmo-3.json";
  const MIN_WINDOW_MS = 15 * 60000;
  const COPY_CEILING_MS = 60 * 60000;

  function paint(word, tone, detail, stripWord) {
    if (panel) panel.textContent = word;
    if (details) details.textContent = detail;
    if (!strip) return;
    strip.className = "live-trader-status " + tone;
    const slot = strip.querySelector(".live-trader-detail");
    if (slot) slot.textContent = stripWord || word;
    strip.title = word + " - " + detail;
  }

  function span(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 60) return total + "s";
    const minutes = Math.round(total / 60);
    if (minutes < 60) return minutes + "m";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? hours + "h " + rest + "m" : hours + "h";
  }

  function clock(value) {
    const at = Date.parse(String(value || ""));
    if (!Number.isFinite(at)) return "never";
    return new Date(at).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }

  async function readJson(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async function refresh() {
    try {
      const lanes = await readJson(LANES_PATH);
      const rows = Array.isArray(lanes?.lanes) ? lanes.lanes : [];
      const row = rows.find(entry => entry && entry.id === LANE) || null;
      if (!row) {
        paint("Status unavailable", "unknown", "The lanes document names no " + LANE + " lane yet, so nothing here can be dated.", "Unknown");
        return;
      }
      if (row.enabled === false) {
        paint("Paused", "parked", "Parked in the lanes file: nothing is published for this lane and no loop trades it.", "Paused");
        return;
      }
      const [snapshot, heartbeat] = await Promise.all([
        readJson(row.feed || SNAPSHOT_FALLBACK),
        readJson(row.trader_status || HEARTBEAT_FALLBACK)
      ]);
      const publishedMs = Date.parse(String(lanes.generated_at_utc || ""));
      const copyAge = Number.isFinite(publishedMs) ? Math.max(0, Date.now() - publishedMs) : null;
      const feedMs = Date.parse(String(snapshot?.generated_at_utc || ""));
      const feedWindowMs = Number(snapshot?.stale_after_seconds) > 0 ? Number(snapshot.stale_after_seconds) * 1000 : MIN_WINDOW_MS;
      const feedAge = Number.isFinite(feedMs) ? Math.max(0, Date.now() - feedMs) : null;
      const account = snapshot?.account || {};
      const positions = account.positions_open ?? "unknown";
      const orders = account.orders_open ?? "unknown";
      const feedLine = feedAge === null
        ? "no broker snapshot"
        : "Last broker update " + clock(snapshot.generated_at_utc) + " (" + span(feedAge / 1000) + " ago)";

      if (heartbeat && typeof heartbeat === "object" && heartbeat.lane === LANE) {
        const tickMs = Date.parse(String(heartbeat.at_utc || heartbeat.written_at_utc || ""));
        const tickAge = Number.isFinite(tickMs) ? Math.max(0, Date.now() - tickMs) : null;
        const interval = Number(heartbeat.expected_interval_seconds);
        const windowMs = Number.isFinite(interval) && interval > 0
          ? Math.max(MIN_WINDOW_MS, Math.round(interval * 3000))
          : MIN_WINDOW_MS;
        const tickLine = "Last strategy tick " + clock(heartbeat.at_utc || heartbeat.written_at_utc)
          + " (" + (tickAge === null ? "no readable time" : span(tickAge / 1000) + " ago") + ")";
        const result = String(heartbeat.status || "unknown").replaceAll("_", " ");
        const tail = " · Result: " + result + " · Open positions: " + positions + " · Working orders: " + orders;
        if (tickAge === null || tickAge > windowMs || (copyAge !== null && copyAge > COPY_CEILING_MS)) {
          paint("Stale", "stale", feedLine + " · " + tickLine + tail, "Stale");
          return;
        }
        if (heartbeat.armed === true) {
          paint("Active", "live", feedLine + " · " + tickLine + " · armed" + tail, "Active");
          return;
        }
        paint("Connected · strategy unarmed", "connected", feedLine + " · " + tickLine + " · unarmed, so no entry can be sent" + tail, "Connected");
        return;
      }

      // No heartbeat at all: normal for this lane while its trader is parked. The broker side is still a fact.
      if (feedAge === null || feedAge > feedWindowMs) {
        paint("Stale", "stale", (feedAge === null
          ? "No broker snapshot is published"
          : feedLine + ", outside its " + span(feedWindowMs / 1000) + " window") + " · no strategy heartbeat has ever been published", "Stale");
        return;
      }
      paint("Connected · strategy unarmed", "connected", feedLine + " · no strategy heartbeat has ever been published, so the strategy is parked · Open positions: " + positions + " · Working orders: " + orders, "Connected");
    } catch {
      paint("Status unavailable", "unknown", "The blind lane's status could not be read from the published files.", "Unknown");
    } finally {
      window.setTimeout(refresh, 60000);
    }
  }

  refresh();
})();
