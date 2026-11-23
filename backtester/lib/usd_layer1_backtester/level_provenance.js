"use strict";

/**
 * Where the L2L ladder came from, and which sessions it can honestly price (research only, 2026-11-23).
 *
 * Both line-to-line tests replay trades off a level ladder. The question this module answers is not "does
 * the file parse" but "did those lines exist before the session was traded", because a ladder marked once
 * and reused across years would turn every replay into a worked tape.
 *
 * The answer, from the artefact and from every surviving copy of it:
 *
 *   * it is our strategy's own saved price ladder, not an MT5 depth-of-market snapshot;
 *   * every price in it was hand-marked on the live dashboard, or is arithmetic on two hand-marked seeds -
 *     the marking tool's README says so and the artefact carries `marked_by` to say which writer wrote it;
 *   * it is one grid per instrument, stamped once (2026-10-04T16:14:19Z; BTCUSD first at 2026-10-03T20:57:49Z)
 *     and never re-marked, so the original marks survive on exactly those dates and on no others.
 *
 * Since 2026-11-23 the live file is re-marked automatically, so it no longer describes any old session.
 * Eligibility is therefore resolved against the committed archive of dated snapshots
 * (`data/usd-layer1-backtester/level-snapshots/`): a session may be priced only by the latest snapshot whose
 * own stamp - and, where recorded, whose git commit - is earlier than that session's 05:00 London start. The
 * live file is accepted as a candidate for future sessions only, which is what the same rule produces on its
 * own: its stamp is later than every historical session start, so it prices none of them.
 *
 * This is what stops a re-mark from back-dating history. A newly marked ladder cannot establish historical
 * eligibility, no matter who approves it, because the comparison is against the session start and not
 * against a claim about the past.
 */

const fs = require("node:fs");
const snapshotsModule = require("./level_snapshots");

/** The lane's labels, in dashboard order, each with the broker's own symbol for the same instrument. */
const LANES = Object.freeze([
  { key: "EURUSD", label: "EUR/USD", broker_symbol: "EURUSD" },
  { key: "XAUUSD", label: "Gold", broker_symbol: "XAUUSD" },
  { key: "NAS100", label: "NAS100", broker_symbol: "US100.cash" },
  { key: "BTCUSD", label: "BTC/USD", broker_symbol: "BTCUSD" }
]);

/** Europe/London is BST from 01:00 UTC on the last Sunday of March to 01:00 UTC on the last Sunday of October. */
function londonOffsetHours(instantMs) {
  const date = new Date(instantMs);
  const year = date.getUTCFullYear();
  const lastSunday = (month) => {
    const end = Date.UTC(year, month, 1) - 24 * 60 * 60 * 1000;
    return end - new Date(end).getUTCDay() * 24 * 60 * 60 * 1000;
  };
  const start = lastSunday(3) + 60 * 60 * 1000;
  const end = lastSunday(10) + 60 * 60 * 1000;
  return instantMs >= start && instantMs < end ? 1 : 0;
}

/** The UTC instant of 05:00 Europe/London on a `YYYY-MM-DD` session date. */
function sessionStartMs(date) {
  const naive = Date.parse(`${date}T05:00:00.000Z`);
  if (!Number.isFinite(naive)) return null;
  return naive - londonOffsetHours(naive + 60 * 60 * 1000) * 60 * 60 * 1000;
}

function findInstrument(ladder, keys) {
  const wanted = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  for (const instrument of (ladder && ladder.instruments) || []) {
    if (wanted.includes(instrument.symbol)) return instrument;
  }
  return null;
}

function readLadder(file) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
}
/** The instrument a lane reads from a snapshot: the broker symbol first, then the lane key. */
function laneInstrument(snapshot, lane) {
  if (!snapshot || !snapshot.ladder) return null;
  return findInstrument(snapshot.ladder, [lane.broker_symbol, lane.key]);
}

/**
 * One lane's usable sessions, resolved snapshot by snapshot.
 *
 * @param {object} options
 * @param {object} options.lane a LANES entry.
 * @param {Array} options.ordered the ordered snapshots (archived copies and any live candidate).
 * @param {string[]} options.dates the session dates the run processed.
 * @returns {object} usable dates, the snapshots that priced them, and what was excluded.
 */
function laneCoverage({ lane, ordered, dates }) {
  const usable = [];
  const used = new Map();
  let noSnapshot = 0;
  let noInstrument = 0;
  let levels = 0;
  let seeds = 0;
  let seedPrices = [];
  let markedAt = [];
  let describingSnapshot = null;

  for (const date of dates) {
    const start = sessionStartMs(date);
    if (!Number.isFinite(start)) continue;
    const snapshot = snapshotsModule.snapshotInForce(ordered, start);
    if (!snapshot) {
      noSnapshot += 1;
      continue;
    }
    const instrument = laneInstrument(snapshot, lane);
    const instrumentLevels = instrument && Array.isArray(instrument.levels) ? instrument.levels : [];
    if (!instrumentLevels.length) {
      noInstrument += 1;
      continue;
    }
    usable.push(date);
    if (!used.has(snapshot.file)) {
      used.set(snapshot.file, {
        file: snapshot.file,
        sha256: snapshot.verified_sha256,
        stamp_utc: snapshot.generated_at_utc,
        git_commit: snapshot.git_commit || null,
        origin: snapshot.origin,
        sessions: []
      });
    }
    used.get(snapshot.file).sessions.push(date);
    if (!describingSnapshot) describingSnapshot = snapshot;
    levels = instrumentLevels.length;
    seeds = instrumentLevels.filter((level) => level.role === "seed").length;
    seedPrices = instrumentLevels.filter((level) => level.role === "seed").map((level) => level.price);
    markedAt = [...new Set(instrumentLevels.map((level) => level.marked_at_utc).filter(Boolean))].sort();
  }

  return {
    usable,
    used: [...used.values()],
    levels,
    seeds,
    derived: Math.max(0, levels - seeds),
    seed_prices: seedPrices,
    marked_at_utc: markedAt,
    describing_snapshot: describingSnapshot ? describingSnapshot.file : null,
    excluded: { no_snapshot_before_the_session: noSnapshot, snapshot_without_this_instrument: noInstrument }
  };
}
/**
 * Per instrument: the levels, the marking dates that survive, and the sessions the ladder can price.
 *
 * @param {object} options
 * @param {object|null} options.ladder the live ladder document, used as a future-session candidate.
 * @param {string[]} options.dates the session dates the run processed.
 * @param {string} [options.source] the path the live ladder came from, for the artefact.
 * @param {object|null} [options.archive] the `level_snapshots.loadArchive` result.
 * @returns {object} the provenance block.
 */
function buildLevelProvenance({ ladder, dates = [], source = null, archive = null }) {
  const archived = archive && Array.isArray(archive.snapshots) ? archive.snapshots : [];
  const live = snapshotsModule.liveLadderCandidate({ ladder, source });
  const ordered = snapshotsModule.orderSnapshots(archived.concat(live ? [live] : []));
  const mode = archived.length ? "snapshot_pinned" : "single_ladder";

  if (!ladder && !archived.length) {
    return {
      available: false,
      mode,
      source,
      reason:
        "no level ladder and no archived snapshot are present in this checkout, so the line-to-line tests " +
        "have no ladder to replay and no level can be traced to a marking date",
      snapshots: [],
      instruments: [],
      totals: {
        sessions_with_usable_levels: { EURUSD: 0, XAUUSD: 0, NAS100: 0, BTCUSD: 0 },
        sessions_eligible_for_all_four: 0,
        sessions_eligible_for_all_four_list: []
      }
    };
  }

  const instruments = LANES.map((lane) => {
    if (mode === "snapshot_pinned") {
      const coverage = laneCoverage({ lane, ordered, dates });
      const describing = coverage.describing_snapshot
        ? ordered.find((snapshot) => snapshot.file === coverage.describing_snapshot)
        : null;
      const instrument = laneInstrument(describing, lane);
      const markedAt = coverage.marked_at_utc;
      return {
        key: lane.key,
        label: lane.label,
        broker_symbol: instrument ? instrument.symbol : lane.broker_symbol,
        levels: coverage.levels,
        seeds: coverage.seeds,
        derived: coverage.derived,
        seed_prices: coverage.seed_prices,
        marked_at_utc: markedAt,
        marking_dates: [...new Set(markedAt.map((stamp) => stamp.slice(0, 10)))].sort(),
        ladder_stamp_utc: describing ? describing.generated_at_utc : null,
        snapshot_file: coverage.describing_snapshot,
        snapshots_used: coverage.used,
        first_eligible_session: coverage.usable.length ? coverage.usable[0] : null,
        usable_sessions: coverage.usable,
        sessions_before_the_marks: dates.length - coverage.usable.length,
        sessions_eligible: coverage.usable.length,
        excluded: coverage.excluded
      };
    }

    const instrument = findInstrument(ladder, [lane.broker_symbol, lane.key]);
    const levels = instrument && Array.isArray(instrument.levels) ? instrument.levels : [];
    const seeds = levels.filter((level) => level.role === "seed");
    const markedAt = [...new Set(levels.map((level) => level.marked_at_utc).filter(Boolean))].sort();
    const markedMs = Date.parse(ladder.generated_at_utc || "") || null;
    const usable = levels.length
      ? dates.filter((date) => {
          const start = sessionStartMs(date);
          return Number.isFinite(start) && Number.isFinite(markedMs) && markedMs < start;
        })
      : [];
    return {
      key: lane.key,
      label: lane.label,
      broker_symbol: instrument ? instrument.symbol : lane.broker_symbol,
      levels: levels.length,
      seeds: seeds.length,
      derived: levels.filter((level) => level.role === "derived").length,
      seed_prices: seeds.map((level) => level.price),
      marked_at_utc: markedAt,
      marking_dates: [...new Set(markedAt.map((stamp) => stamp.slice(0, 10)))].sort(),
      ladder_stamp_utc: ladder.generated_at_utc || null,
      snapshot_file: source,
      snapshots_used: [],
      first_eligible_session: usable.length ? usable[0] : null,
      usable_sessions: usable,
      sessions_before_the_marks: dates.length - usable.length,
      sessions_eligible: usable.length
    };
  });
  const keyed = Object.fromEntries(instruments.map((instrument) => [instrument.key, instrument]));
  const allFour = dates.filter((date) => LANES.every((lane) => keyed[lane.key].usable_sessions.includes(date)));

  const snapshotRows = ordered.map((snapshot) => {
    const used = instruments
      .flatMap((instrument) => instrument.snapshots_used || [])
      .filter((entry) => entry.file === snapshot.file);
    const sessions = [...new Set(used.flatMap((entry) => entry.sessions))].sort();
    return {
      file: snapshot.file,
      sha256: snapshot.verified_sha256 || null,
      stamp_utc: snapshot.generated_at_utc,
      marked_by: snapshot.marked_by || null,
      git_commit: snapshot.git_commit || null,
      git_commit_at_utc: snapshot.git_commit_at_utc || null,
      origin: snapshot.origin,
      levels_per_instrument: snapshot.levels_per_instrument || null,
      sessions_used: sessions,
      sessions_used_per_lane: Object.fromEntries(
        LANES.map((lane) => [
          lane.key,
          sessions.filter((date) => keyed[lane.key].usable_sessions.includes(date) && keyed[lane.key].snapshot_file === snapshot.file)
        ])
      )
    };
  });

  const liveStampMs = ladder ? Date.parse(ladder.generated_at_utc || "") : null;
  const liveEligible = ladder
    ? dates.filter((date) => {
        const start = sessionStartMs(date);
        return Number.isFinite(start) && Number.isFinite(liveStampMs) && liveStampMs < start;
      })
    : [];

  return {
    available: true,
    mode,
    source,
    archive: archive
      ? {
          index_path: archive.index_path,
          rule: archive.rule,
          problems: archive.problems,
          snapshots_verified: archived.length
        }
      : null,
    marked_by: ladder ? ladder.marked_by || null : null,
    ladder_stamp_utc: snapshotRows.length ? snapshotRows[snapshotRows.length - 1].stamp_utc : null,
    what_it_is:
      "our strategy's own saved price ladder, hand-marked on the live dashboard - not an MT5 depth-of-market " +
      "snapshot (the terminal serves no historical depth)",
    reproduction:
      "every seed price was marked by hand; every other level is arithmetic on two hand-marked prices, so the " +
      "derived levels reproduce from the seeds alone and the seeds reproduce from nothing - which is why the " +
      "marking dates, not a generator, are what a replay has to be dated against",
    eligibility_rule:
      "a session may be priced only by the latest archived snapshot whose stamp (and, where recorded, whose git " +
      "commit) is earlier than that session's 05:00 London start; a snapshot marked after a session can never " +
      "price it, so re-marking the live file cannot back-date history",
    live_file_cannot_establish_history: {
      source,
      stamp_utc: ladder ? ladder.generated_at_utc || null : null,
      marked_by: ladder ? ladder.marked_by || null : null,
      sessions_it_can_price_in_this_run: liveEligible.length,
      note:
        "the live file is re-marked in place; it is a candidate for future sessions only and is never used to " +
        "re-date a session that started before its stamp"
    },
    snapshots: snapshotRows,
    instruments,
    totals: {
      sessions_with_usable_levels: Object.fromEntries(
        instruments.map((instrument) => [instrument.key, instrument.sessions_eligible])
      ),
      sessions_eligible_for_all_four: allFour.length,
      sessions_eligible_for_all_four_list: allFour
    }
  };
}

module.exports = {
  LANES,
  londonOffsetHours,
  sessionStartMs,
  findInstrument,
  readLadder,
  laneInstrument,
  laneCoverage,
  buildLevelProvenance
};
