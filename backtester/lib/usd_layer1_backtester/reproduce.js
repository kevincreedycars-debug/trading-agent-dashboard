"use strict";

/**
 * Reproduction check for the run artefact (research only).
 *
 * The panel claims a reader can re-run a day from the values saved beside it. This module proves that claim
 * before the artefact is written: it takes the session rows exactly as they will be committed, feeds the saved
 * inputs back through both models, and compares the fresh call with the stored one. It then re-derives each
 * test's numerator and denominator from the stored per-market results and compares those with the published
 * totals.
 *
 * Nothing here reads a file or the network: the only inputs are the rows the run is about to write, so a
 * passing check means the artefact is self-contained rather than merely self-consistent in memory.
 */

const challenger = require("./challenger");
const currentModel = require("./current_model");
const contracts = require("./contracts");

/** The saved row as JSON would round-trip it, so the check never sees an in-memory object. */
function asSaved(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function sameCall(stored, fresh) {
  const fields = [];
  if ((stored && stored.direction) !== fresh.direction) fields.push("direction");
  if ((stored && stored.conviction) !== fresh.conviction) fields.push("conviction");
  return fields;
}

/** Re-run the challenger for every row from the values saved in that row. */
function checkChallenger(rows) {
  let matches = 0;
  const mismatches = [];
  for (const row of rows) {
    const fresh = challenger.evaluate({ values: asSaved(row.saved_inputs) });
    const fields = sameCall(row.models.challenger, fresh);
    if (fields.length === 0) matches += 1;
    else if (mismatches.length < 10) {
      mismatches.push({ date: row.date, fields, stored: row.models.challenger.direction, fresh: fresh.direction });
    }
  }
  return { model: challenger.VERSION, checked: rows.length, matches, mismatches, reproduced: mismatches.length === 0 };
}

/**
 * Re-run the current model for every row.
 *
 * The current model's own replay core is engine-only, so this is where its daily call is proved to survive
 * the round trip; the panel re-runs the challenger alone and says so.
 */
function checkCurrentModel(rows) {
  let matches = 0;
  const mismatches = [];
  for (const row of rows) {
    const values = asSaved(row.saved_inputs);
    const fresh = currentModel.evaluate({ date: row.date, values });
    const fields = sameCall(row.models.current, fresh);
    if ((row.models.current.net_weight || null) !== (fresh.raw_score.net_weight || null)) fields.push("net_weight");
    if (fields.length === 0) matches += 1;
    else if (mismatches.length < 10) {
      mismatches.push({ date: row.date, fields, stored: row.models.current.direction, fresh: fresh.direction });
    }
  }
  return {
    model: contracts.CURRENT_MODEL_VERSION,
    checked: rows.length,
    matches,
    mismatches,
    reproduced: mismatches.length === 0
  };
}

/** Re-derive each market's hits and scored count from the stored per-market results. */
function checkTotals(rows, tests) {
  const markets = {};
  const published = (tests && tests.four_markets && tests.four_markets.models) || {};
  let allMatch = true;
  for (const model of ["current", "challenger"]) {
    markets[model] = {};
    for (const market of contracts.MARKETS) {
      let hits = 0;
      let scored = 0;
      for (const row of rows) {
        const result = row.results && row.results[model] ? row.results[model][market.key] : null;
        if (result === "hit") {
          hits += 1;
          scored += 1;
        } else if (result === "miss") {
          scored += 1;
        }
      }
      const storedOverall = published[model] && published[model].markets && published[model].markets[market.key]
        ? published[model].markets[market.key].overall
        : null;
      const storedHits = storedOverall ? storedOverall.hits : null;
      const storedScored = storedOverall ? storedOverall.scored : null;
      const match = storedHits === hits && storedScored === scored;
      if (!match) allMatch = false;
      markets[model][market.key] = {
        recomputed: { hits, scored, accuracy_pct: scored ? Math.round((hits / scored) * 10000) / 100 : null },
        published: { hits: storedHits, scored: storedScored },
        match
      };
    }
  }
  return { markets, match: allMatch };
}

/**
 * Build the reproduction block for the artefact.
 *
 * @param {object} options
 * @param {object[]} options.rows the session rows exactly as they will be written.
 * @param {object} options.tests the four test blocks already built.
 * @returns {object} what was re-run, what matched, and the arithmetic behind every total.
 */
function buildReproduction({ rows, tests }) {
  const challenge = checkChallenger(rows);
  const current = checkCurrentModel(rows);
  const totals = checkTotals(rows, tests);
  const verdict = challenge.reproduced && current.reproduced && totals.match
    ? "every saved call and every published total was recomputed from the artefact's own values and matched"
    : "at least one saved call or published total did not reproduce; the artefact must not be published";
  return {
    checked_sessions: rows.length,
    method:
      "each session row is round-tripped through JSON, the saved inputs are fed back through both models' own " +
      "code, and each market total is re-derived from the stored per-market results",
    challenger: challenge,
    current,
    totals,
    browser_note:
      "the panel re-runs the challenger from the same saved inputs with lib/usd_l1_votes.js, the interpreter the " +
      "engine itself uses; the current model's re-run is engine-only and is reported here",
    verdict
  };
}

module.exports = { asSaved, buildReproduction, checkChallenger, checkCurrentModel, checkTotals };
