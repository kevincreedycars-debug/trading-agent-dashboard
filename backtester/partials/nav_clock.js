// The date and dual clock carried by every standalone shared header.
//
// This file is not served. backtester/scripts/build_shared_nav.js inlines it immediately below the
// SHARED-NAV block on each standalone page, so a page such as gold-factor-wip.html can keep its promise
// to load nothing outside itself while still showing the same live date and UK/ET times as index.html.
// The dashboard does not receive this copy: script.js already drives both nodes there.
(() => {
  const dateNode = document.getElementById("currentDate");
  const clockNode = document.getElementById("topbarClock");
  if (!dateNode && !clockNode) return;

  const ukClockFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const etClockFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const ukZoneFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
  const etZoneFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  });
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  function zoneAbbreviation(formatter, date) {
    const parts = formatter.formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  }

  function render() {
    const now = new Date();
    const ukTime = ukClockFormatter.format(now);
    const etTime = etClockFormatter.format(now);
    const ukZone = zoneAbbreviation(ukZoneFormatter, now);
    const etZone = zoneAbbreviation(etZoneFormatter, now);

    if (clockNode) {
      clockNode.textContent = `UK ${ukTime} | ET ${etTime}`;
      clockNode.setAttribute("aria-label", `UK time ${ukTime} ${ukZone}. Eastern Time ${etTime} ${etZone}.`);
      clockNode.setAttribute("title", `UK time automatically switches between GMT and BST. ET automatically switches between EST and EDT. Currently ${ukZone} and ${etZone}.`);
    }
    if (dateNode) dateNode.textContent = dateFormatter.format(now);
  }

  render();
  window.setInterval(render, 1000);
})();
