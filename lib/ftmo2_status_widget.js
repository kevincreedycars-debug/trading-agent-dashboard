(() => {
  const panel = document.getElementById("ftmo2Status");
  const details = document.getElementById("ftmo2StatusDetails");
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
      panel.textContent = state;
      const result = String(tick.status || "unknown").replaceAll("_", " ");
      details.textContent = "Last trader tick " + lastTick + " · Result: " + result
        + " · Open positions: " + (tick.terminal?.positions_open ?? "unknown")
        + " · Working orders: " + (tick.terminal?.orders_open ?? "unknown");
    } catch {
      panel.textContent = "Heartbeat unavailable";
      details.textContent = "Current FTMO 2 status could not be verified.";
    } finally {
      window.setTimeout(refresh, 60000);
    }
  }
  refresh();
})();
