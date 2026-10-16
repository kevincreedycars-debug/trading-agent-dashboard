#!/usr/bin/env node
"use strict";

const path = require("node:path");

const PROJECT_URL = "https://eaolqbrlywczinfordvg.supabase.co";
const BUCKET = "research-documents";
const sqlPath = path.resolve(__dirname, "..", "supabase", "research-uploads.sql");

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_KEY is missing. Set it for this command only, then run this helper again.");
    process.exitCode = 1;
    return;
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  let lookup;
  try {
    lookup = await fetch(`${PROJECT_URL}/storage/v1/bucket`, { headers });
  } catch (_) {
    console.error("Supabase could not be reached. Check the network and run this helper again.");
    process.exitCode = 1;
    return;
  }

  if (!lookup.ok) {
    console.error("The bucket list could not be inspected. Check the project and service key, then retry.");
    process.exitCode = 1;
    return;
  }

  const buckets = await lookup.json();
  const bucket = Array.isArray(buckets) ? buckets.find(entry => entry && entry.id === BUCKET) : null;
  if (bucket) {
    if (bucket.public) {
      console.error("The research-documents bucket already exists and is public. Make it private before continuing.");
      process.exitCode = 1;
      return;
    }
    console.log("The private research-documents bucket already exists.");
  } else {
    const created = await fetch(`${PROJECT_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, headers),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
    });
    if (!created.ok) {
      console.error("The private research-documents bucket could not be created. Check the project and service key, then retry.");
      process.exitCode = 1;
      return;
    }
    console.log("Created the private research-documents bucket.");
  }

  console.log(`Paste this file into the Supabase SQL editor: ${sqlPath}`);
}

main().catch(() => {
  console.error("Provisioning stopped unexpectedly. Check the network and try again.");
  process.exitCode = 1;
});
