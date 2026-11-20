const first = $input.first().json || {};
const body = first.body && typeof first.body === "object" ? first.body : first;
const rawDates = body.dates !== undefined && body.dates !== null
  ? body.dates
  : (body.date !== undefined && body.date !== null ? [body.date] : []);
const supplied = (Array.isArray(rawDates) ? rawDates : String(rawDates).split(","))
  .map((entry) => String(entry).trim())
  .filter((entry) => entry.length > 0);
const dates = Array.from(new Set(supplied)).sort();
if (dates.length === 0) dates.push("2024-01-10");
if (dates.length > 40) {
  throw new Error("at most 40 mornings per controlled run; split the range so one execution stays inspectable");
}
for (const date of dates) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD, received " + date);
  const ms = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new Error("date is not a real calendar day: " + date);
  }
}
const validation = body.validation || "structural";
if (validation !== "structural" && validation !== "receipted") {
  throw new Error("validation must be structural or receipted");
}
const dataset_url = body.dataset_url || "https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/data/usd-layer1-backtester/run-v1.json";
if (!/^https:\/\//.test(dataset_url)) {
  throw new Error("dataset_url must be an https URL");
}
return [{
  json: {
    dataset_url,
    date: dates.length === 1 ? dates[0] : null,
    dates,
    batch: dates.length > 1,
    validation,
    instance_url: body.instance_url || "https://silver17.app.n8n.cloud"
  }
}];

