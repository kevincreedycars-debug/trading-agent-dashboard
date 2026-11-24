/**
 * The frozen flat-band proposal (OD-4).
 *
 * A flat band decides which 05:00-to-05:00 moves are too small to score. It is the one scoring choice that can
 * be tuned to a holdout without touching a model, so it is frozen here from development dates only and applied
 * unchanged everywhere.
 *
 * The numbers are read from the published run, never retyped: one band per configured market that has a cached
 * series, plus the broker DXY band from the test that used it. A configured market with no cached series is
 * listed under `without_band` with the reason, not given a zero band.
 *
 * Research only.
 */
"use strict";

const { sha256, stableStringify } = require("./engine");

const TIE_TREATMENT = {
  flat_inside_band: "a move whose absolute value is strictly below the band is flat: excluded from the accuracy denominator and counted separately as flat",
  boundary: "a move whose absolute value equals the band is directional, not flat; the band is a strict lower bound",
  zero_move: "a zero move is flat, never a hit or a miss",
  vote_tie: "a family vote that nets exactly zero is NO_CALL; opposing families cancel and no direction is chosen",
  deadband: "a vote inside the frozen 0.20 deadband is NO_CALL; there is no coin flip, no direction priority and no tie-break by conviction",
  missing_move: "a missing or unreadable price is an exclusion, not a flat and not a miss; it never enters the denominator",
  applied_to_holdout: "the same band is applied unchanged to the 400 unseen mornings; no band is re-fitted after a holdout result",
};

/**
 * @param {object} options
 * @param {object} options.run the published run-v1 artefact
 * @param {string} options.frozen_at the date the bands are frozen on
 * @returns {object}
 */
function proposedFlatBands({ run, frozen_at }) {
  const bands = (run && run.run && run.run.flat_bands) || {};
  const dxy = (((run || {}).results || {}).dxy_broker_cfd || {}).instrument || {};
  const sessions = (run && run.sessions) || [];
  const development = sessions.filter((session) => session.split === "development");
  const unseen = sessions.filter((session) => session.split === "unseen");

  const instruments = [];
  const without_band = [];
  for (const market of Object.keys(bands)) {
    const band = bands[market];
    if (!Number.isFinite(band.flat_band_pct) || !band.sample) {
      without_band.push({
        instrument: market,
        label: market,
        band_pct: band.flat_band_pct === undefined ? null : band.flat_band_pct,
        sample: band.sample || 0,
        reason:
          "no session outcome series for this market is cached in this checkout, so no development window exists " +
          "to measure a band on; the market is reported as having no band rather than a zero band",
        source: "data/usd-layer1-backtester/run-v1.json → run.flat_bands",
      });
      continue;
    }
    instruments.push({
      instrument: market,
      symbol: market,
      band_pct: band.flat_band_pct,
      sample: band.sample,
      rule: band.rule,
      frozen: band.frozen,
      treated_as_flat: `an absolute move below ${band.flat_band_pct} per cent`,
      tie_treatment: TIE_TREATMENT.boundary,
      source: "data/usd-layer1-backtester/run-v1.json → run.flat_bands",
    });
  }
  if (dxy.flat_band_pct !== undefined) {
    instruments.unshift({
      instrument: "DXY.cash",
      symbol: dxy.symbol || "DXY.cash",
      band_pct: dxy.flat_band_pct,
      sample: dxy.flat_band_sample,
      rule: dxy.flat_band_rule,
      frozen: "computed from development dates only and applied unchanged to every later date in this run",
      treated_as_flat: `an absolute move below ${dxy.flat_band_pct} per cent`,
      tie_treatment: TIE_TREATMENT.boundary,
      source: "data/usd-layer1-backtester/run-v1.json → results.dxy_broker_cfd.instrument",
      proxy_note: dxy.is_official_cash_dxy === false ? "broker CFD, not the official ICE cash index" : null,
    });
  }

  const body = {
    status: "FROZEN_BEFORE_HOLDOUT_SCORING",
    frozen_at: frozen_at || null,
    instruments,
    without_band,
    tie_treatment: TIE_TREATMENT,
    development: {
      first: development.length ? development[0].date : null,
      last: development.length ? development[development.length - 1].date : null,
      sessions: development.length,
    },
    holdout: {
      first: unseen.length ? unseen[0].date : null,
      last: unseen.length ? unseen[unseen.length - 1].date : null,
      sessions: unseen.length,
      examined_for_band_selection: false,
    },
    note:
      "Every band is derived from development dates only. The holdout was not used to choose, widen or narrow any band, and a later change to a band is a new frozen version, not an edit.",
  };
  return { ...body, digest: sha256(stableStringify(body)) };
}

module.exports = { proposedFlatBands, TIE_TREATMENT };
