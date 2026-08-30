(function initMarketCalendar(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.MarketCalendar = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createMarketCalendar() {
  const TIME_ZONE = "Europe/London";
  const WEEKDAY_ASSETS = new Set(["USD", "EUR", "GBP", "GOLD", "SILVER", "WTI", "NQ"]);
  const CONTINUOUS_ASSETS = new Set(["BTC"]);
  const ASSET_ALIASES = Object.freeze({
    XAU: "GOLD",
    XAG: "SILVER"
  });

  function normalizeAssetCode(value) {
    const normalized = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return ASSET_ALIASES[normalized] || normalized;
  }

  function londonDateParts(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      weekday: lookup.weekday,
      dateKey: `${lookup.year}-${lookup.month}-${lookup.day}`
    };
  }

  function configuredClosure(assetCode, dateKey, closures = {}) {
    const assetClosures = Array.isArray(closures[assetCode]) ? closures[assetCode] : [];
    const globalClosures = Array.isArray(closures.ALL) ? closures.ALL : [];
    return [...assetClosures, ...globalClosures].find((entry) => {
      if (typeof entry === "string") return entry === dateKey;
      return entry && entry.date === dateKey;
    }) || null;
  }

  function resolveMarketSession(asset, value = new Date(), options = {}) {
    const assetCode = normalizeAssetCode(asset);
    const date = londonDateParts(value);
    if (!date) {
      return { assetCode, status: "CLOSED", reason: "INVALID_TIMESTAMP", dateKey: null, timezone: TIME_ZONE };
    }

    if (!WEEKDAY_ASSETS.has(assetCode) && !CONTINUOUS_ASSETS.has(assetCode)) {
      return { assetCode, status: "CLOSED", reason: "UNKNOWN_ASSET", dateKey: date.dateKey, timezone: TIME_ZONE };
    }

    const closure = configuredClosure(assetCode, date.dateKey, options.closures || {});
    if (closure) {
      return {
        assetCode,
        status: "CLOSED",
        reason: typeof closure === "object" && closure.reason ? String(closure.reason) : "CALENDAR_OVERRIDE",
        dateKey: date.dateKey,
        timezone: TIME_ZONE
      };
    }

    if (CONTINUOUS_ASSETS.has(assetCode)) {
      return { assetCode, status: "OPEN", reason: "CONTINUOUS_SESSION", dateKey: date.dateKey, timezone: TIME_ZONE };
    }

    if (date.weekday === "Saturday" || date.weekday === "Sunday") {
      return { assetCode, status: "CLOSED", reason: "WEEKEND", dateKey: date.dateKey, timezone: TIME_ZONE };
    }

    return { assetCode, status: "OPEN", reason: "WEEKDAY_SESSION", dateKey: date.dateKey, timezone: TIME_ZONE };
  }

  function isMarketOpen(asset, value, options) {
    return resolveMarketSession(asset, value, options).status === "OPEN";
  }

  return {
    TIME_ZONE,
    normalizeAssetCode,
    resolveMarketSession,
    isMarketOpen
  };
});
