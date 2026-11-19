const first = $input.first().json || {};
const body = first.body && typeof first.body === "object" ? first.body : first;
const config = {
  dataset_url: body.dataset_url || "https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/main/data/usd-layer1-backtester/run-v1.json",
  date: body.date || "2024-01-10",
  validation: body.validation || "structural",
  instance_url: body.instance_url || "https://silver17.app.n8n.cloud"
};
if (!/^\d{4}-\d{2}-\d{2}$/.test(config.date)) {
  throw new Error("date must be YYYY-MM-DD");
}
if (config.validation !== "structural" && config.validation !== "receipted") {
  throw new Error("validation must be structural or receipted");
}
if (!/^https:\/\//.test(config.dataset_url)) {
  throw new Error("dataset_url must be an https URL");
}
return [{ json: config }];
