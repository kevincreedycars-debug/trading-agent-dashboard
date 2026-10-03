// The L2L ladder arithmetic, shared by the dashboard and the tests that hold it.
//
// Two seed prices marked by hand on the chart are the measurement; the ladder is that same distance
// repeated above the top seed and below the bottom one. Everything here is arithmetic over a level list
// that has already been published in `data/l2l-levels.json`: it marks nothing, writes nothing, and knows
// nothing about orders, accounts or the terminal. It exists so the page, the marking tool and the tests
// cannot drift apart on what "the ladder" and "close to the out bounds" mean.
//
// Loaded as a plain script by index.html (the global `L2LLadder`) and required directly by node tests.
(function initL2lLadder(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.L2LLadder = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createL2lLadder() {
  // How many levels a duplication generates beyond each seed level. Ten each way is a ladder twenty
  // levels wide: wide enough to read a week of 1h bars against, narrow enough that the ladder does not
  // become the chart. The cap leaves room for five extensions of ten before a fresh seed reading is owed.
  const DEFAULT_STEPS = 10;
  const MAX_STEPS = 60;
  // How many levels an extension adds to the side whose bound the price has reached.
  const EXTEND_STEPS = 10;
  // "Close to the out bounds" is measured in ladder steps rather than in points or percent: one step is
  // the distance between the two seed levels, so the same rule reads the same way on EURUSD and on BTCUSD.
  const ALERT_BAND_STEPS = 1;
  const STATES = Object.freeze(["none", "approaching", "beyond"]);

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function roundPrice(value) {
    return Number(Number(value).toFixed(6));
  }

  // A level list as the file describes it: a positive price and, when it is a generated copy, the
  // measurement it came from. Anything else is ignored rather than repaired.
  function readLevels(levels) {
    return (Array.isArray(levels) ? levels : []).map(level => ({
      role: level?.role === "derived" ? "derived" : "seed",
      price: Number(level?.price),
      spacing: Number(level?.spacing_price),
      anchorHigh: Number(level?.anchor_high),
      anchorLow: Number(level?.anchor_low)
    })).filter(entry => isFiniteNumber(entry.price) && entry.price > 0);
  }

  function pointFrom(options) {
    const point = Number(options?.point);
    return isFiniteNumber(point) && point > 0 ? point : null;
  }

  // The ladder as it is published: the seed pair it was measured from, the outermost generated line each
  // way, and the step distance between neighbours. A symbol with no derived levels has no ladder, which
  // is not an error - it is a symbol whose seeds have not been duplicated yet.
  function ladderStats(levels, options) {
    const point = pointFrom(options);
    const list = readLevels(levels);
    const seeds = list.filter(entry => entry.role === "seed");
    const derived = list.filter(entry => entry.role === "derived");
    const empty = {
      available: false,
      seedCount: seeds.length,
      derivedCount: derived.length,
      seedHigh: null,
      seedLow: null,
      anchorHigh: null,
      anchorLow: null,
      outerHigh: null,
      outerLow: null,
      spacing: null,
      spacingPoints: null,
      above: 0,
      below: 0,
      point
    };
    if (!seeds.length || !derived.length) return empty;

    const seedPrices = seeds.map(entry => entry.price);
    const derivedPrices = derived.map(entry => entry.price);
    const anchorHighs = derived.map(entry => entry.anchorHigh).filter(isFiniteNumber);
    const anchorLows = derived.map(entry => entry.anchorLow).filter(isFiniteNumber);
    const seedHigh = Math.max(...seedPrices);
    const seedLow = Math.min(...seedPrices);
    // The anchors are what the ladder was drawn from; a symbol whose seeds moved since is still measured
    // against the anchors its own file records, and re-running the duplication is what moves the ladder.
    const anchorHigh = anchorHighs.length ? Math.max(...anchorHighs) : seedHigh;
    const anchorLow = anchorLows.length ? Math.min(...anchorLows) : seedLow;
    const spacings = derived.map(entry => entry.spacing).filter(value => isFiniteNumber(value) && value > 0);
    const measured = anchorHigh > anchorLow ? roundPrice(anchorHigh - anchorLow) : null;
    const spacing = spacings.length ? Math.max(...spacings) : measured;

    return {
      available: true,
      seedCount: seeds.length,
      derivedCount: derived.length,
      seedHigh: roundPrice(seedHigh),
      seedLow: roundPrice(seedLow),
      anchorHigh: roundPrice(anchorHigh),
      anchorLow: roundPrice(anchorLow),
      outerHigh: roundPrice(Math.max(...derivedPrices)),
      outerLow: roundPrice(Math.min(...derivedPrices)),
      spacing,
      spacingPoints: spacing !== null && point ? Math.round(spacing / point) : null,
      above: derivedPrices.filter(price => price > anchorHigh).length,
      below: derivedPrices.filter(price => price < anchorLow).length,
      point
    };
  }

  // The step plan for the next duplication of the same measurement: repeat it ten more times on the side
  // that ran out. `side` is what the alert reported; with no side both directions are extended.
  function ladderExtension(stats, side, options) {
    if (!stats || stats.available !== true) return null;
    const requested = Number(options?.steps);
    const add = Number.isInteger(requested) && requested > 0 ? requested : EXTEND_STEPS;
    const extendsHigh = side !== "low";
    const extendsLow = side !== "high";
    const above = Math.min(MAX_STEPS, stats.above + (extendsHigh ? add : 0));
    const below = Math.min(MAX_STEPS, stats.below + (extendsLow ? add : 0));
    const addedAbove = above - stats.above;
    const addedBelow = below - stats.below;
    if (!addedAbove && !addedBelow) return null;
    return {
      side: side === "high" || side === "low" ? side : null,
      addedAbove,
      addedBelow,
      above,
      below,
      spacing: stats.spacing
    };
  }

  // Whether the live price is still inside the ladder, within one step of its outermost line, or already
  // past it. The band is measured in the ladder's own unit rather than in points or percent, so no
  // configuration is needed: one step is the distance between the two marked seeds, and the moment the
  // ladder stops covering price is what the reader has to see.
  function ladderAlert(levels, price, options) {
    const stats = ladderStats(levels, options);
    const quiet = {
      ...stats,
      active: false,
      state: "none",
      side: null,
      level: null,
      distance: null,
      distancePoints: null,
      band: stats.spacing,
      bandSteps: ALERT_BAND_STEPS,
      price: isFiniteNumber(price) ? roundPrice(price) : null,
      nextSteps: null
    };
    if (!stats.available || !isFiniteNumber(price) || !(stats.spacing > 0)) return quiet;

    const band = stats.spacing * ALERT_BAND_STEPS;
    const judged = (side, level, state) => ({
      ...stats,
      active: true,
      state,
      side,
      level: roundPrice(level),
      distance: roundPrice(price - level),
      distancePoints: stats.point ? Math.round((price - level) / stats.point) : null,
      band: roundPrice(band),
      bandSteps: ALERT_BAND_STEPS,
      price: roundPrice(price),
      nextSteps: ladderExtension(stats, side, options)
    });

    if (price > stats.outerHigh) return judged("high", stats.outerHigh, "beyond");
    if (price >= stats.outerHigh - band) return judged("high", stats.outerHigh, "approaching");
    if (price < stats.outerLow) return judged("low", stats.outerLow, "beyond");
    if (price <= stats.outerLow + band) return judged("low", stats.outerLow, "approaching");
    return { ...quiet, band: roundPrice(band) };
  }

  return {
    DEFAULT_STEPS,
    MAX_STEPS,
    EXTEND_STEPS,
    ALERT_BAND_STEPS,
    STATES,
    readLevels,
    ladderStats,
    ladderAlert,
    ladderExtension
  };
});

