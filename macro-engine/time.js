"use strict";

function formatInZone(timestamp, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short", timeStyle: "medium", hourCycle: "h23" }).format(new Date(timestamp));
}

function assertUtcTimestamp(label, timestamp) {
  if (!timestamp || Number.isNaN(Date.parse(timestamp)) || !/Z$|[+-]\d\d:\d\d$/.test(timestamp)) throw new Error(`${label} must be a timezone-qualified ISO timestamp`);
  return new Date(timestamp).toISOString();
}

module.exports = { assertUtcTimestamp, formatInZone };
