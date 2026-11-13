(() => {
  const panel = document.getElementById("ftmo2Status");
  const details = document.getElementById("ftmo2StatusDetails");
  const strip = document.getElementById("liveTraderStatusFtmo2");
  const HEARTBEAT_PATH = "data/live-trading-trader.ftmo-2.json";
  const LANES_PATH = "data/live-trading-lanes.json";
  // The same two clocks the accounts strip uses: three missed five-minute ticks, and no less than fifteen minutes,
  // is a window with nothing in it; an hour without a publish is a page nobody is telling anything.
  const MIN_WINDOW_MS = 15 * 60000;
  const COPY_CEILING_MS = 60 * 60000;
  function paint(state, tone, detail) {
    panel.textContent = state;
    details.textContent = detail;
    if (strip) {
      // The corner strip leads with the model's name, which is in the markup and never rewritten here, and states
      // one of three words beside it: Active, Stale, Paused. The longer state - "Stale heartbeat", "Stale copy",
      // "Identity unverified", "Unarmed", "Entries paused" - stays in the panel and on the strip's tooltip, so the
      // shorter word is not a loss of the fact behind it.
      const word = state === "Armed"
        ? "Active"
        : state === "Stale heartbeat" || state === "Stale copy" ? "Stale" : "Paused";
      strip.className = "live-trader-status " + tone;
      strip.querySelector(".live-trader-detail").textContent = word;
      strip.title = state + " - " + detail;
    }
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
      const [tick, lanes] = await Promise.all([readJson(HEARTBEAT_PATH), readJson(LANES_PATH)]);
      if (!tick) throw new Error("Heartbeat unavailable");
      const time = Date.parse(tick.at_utc);
      if (tick.lane !== "ftmo-2" || !Number.isFinite(time) || time - Date.now() > 60000)
        throw new Error("Invalid heartbeat");
      // The heartbeat file is rewritten by the same publish that rewrites the lanes document, so the browser's own
      // clock reads the age of the commit rather than the age of the run: a loop that wrote two minutes before a
      // publish which is eighteen minutes old would otherwise look like eighteen minutes of silence, and this strip
      // would say Stale while the lane's own card, which dates the record at publish, said Active. The document's
      // `generated_at_utc` is the instant the publisher read these files, so both readers date the same record.
      const publishedMs = Date.parse(String(lanes && lanes.generated_at_utc ? lanes.generated_at_utc : ""));
      const published = Number.isFinite(publishedMs) ? publishedMs : null;
      const ageAtPublish = published === null ? Math.max(0, Date.now() - time) : Math.max(0, published - time);
      const copyAge = published === null ? 0 : Math.max(0, Date.now() - published);
      const interval = Number(tick.expected_interval_seconds);
      const windowMs = Number.isFinite(interval) && interval > 0
        ? Math.max(MIN_WINDOW_MS, Math.round(interval * 3000))
        : MIN_WINDOW_MS;
      const lastTick = new Date(time).toISOString().replace("T", " ").slice(0, 19) + " UTC";
      let state;
      if (ageAtPublish > windowMs) state = "Stale heartbeat";
      else if (copyAge > COPY_CEILING_MS) state = "Stale copy";
      else if (tick.strategy?.identity_checked !== true) state = "Identity unverified";
      else if (tick.armed !== true) state = "Unarmed";
      else if (tick.entries_paused === true) state = "Entries paused";
      else state = "Armed";

      const result = String(tick.status || "unknown").replaceAll("_", " ");
      const tone = state === "Armed" ? "live" : state === "Stale heartbeat" || state === "Stale copy" ? "stale" : "waiting";
      // Which silence it is, said in the detail line rather than folded into the one word: no run for a span is a
      // loop that stopped writing, no publish for a span is a page that stopped being told.
      const silence = state === "Stale heartbeat"
        ? "No run for " + span(ageAtPublish / 1000) + " · "
        : state === "Stale copy"
          ? "No publish for " + span(copyAge / 1000) + " · "
          : "";
      paint(state, tone, silence + "Last trader tick " + lastTick + " · Result: " + result
        + " · Open positions: " + (tick.terminal?.positions_open ?? "unknown")
        + " · Working orders: " + (tick.terminal?.orders_open ?? "unknown"));
    } catch {
      paint("Heartbeat unavailable", "unknown", "Current FTMO 2 status could not be verified.");
    } finally {
      window.setTimeout(refresh, 60000);
    }
  }
  refresh();
})();

