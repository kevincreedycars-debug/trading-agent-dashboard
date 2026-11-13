(() => {
  const panel = document.getElementById("ftmo2Status");
  const details = document.getElementById("ftmo2StatusDetails");
  const strip = document.getElementById("liveTraderStatusFtmo2");
  function paint(state, tone, detail) {
    panel.textContent = state;
    details.textContent = detail;
    if (strip) {
      // The corner strip leads with the model's name, which is in the markup and never rewritten here, and states
      // one of three words beside it: Active, Stale, Paused. The longer state - "Entries paused", "Identity
      // unverified", "Heartbeat unavailable" - stays in the panel and on the strip's tooltip, so the shorter word
      // is not a loss of the fact behind it.
      const word = state === "Armed" ? "Active" : state === "Stale heartbeat" ? "Stale" : "Paused";
      strip.className = "live-trader-status " + tone;
      strip.querySelector(".live-trader-detail").textContent = word;
      strip.title = state + " - " + detail;
    }
  }
  async function refresh() {
    try {
      const response = await fetch("data/live-trading-trader.ftmo-2.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Heartbeat unavailable");
      const tick = await response.json();
      const time = Date.parse(tick.at_utc);
      const age = Date.now() - time;
      if (tick.lane !== "ftmo-2" || !Number.isFinite(time) || age < -60000)
        throw new Error("Invalid heartbeat");
      const lastTick = new Date(time).toISOString().replace("T", " ").slice(0, 19) + " UTC";
      let state;
      if (age > 15 * 60000) state = "Stale heartbeat";
      else if (tick.strategy?.identity_checked !== true) state = "Identity unverified";
      else if (tick.armed !== true) state = "Unarmed";
      else if (tick.entries_paused === true) state = "Entries paused";
      else state = "Armed";

      const result = String(tick.status || "unknown").replaceAll("_", " ");
      const tone = state === "Armed" ? "live" : state === "Stale heartbeat" ? "stale" : "waiting";
      paint(state, tone, "Last trader tick " + lastTick + " · Result: " + result
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
