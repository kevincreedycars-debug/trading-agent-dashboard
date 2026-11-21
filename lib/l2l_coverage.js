// The L2L coverage arithmetic: how far the ladder has to reach to keep lines around the live price.
//
// The ladder is a measurement, not a list somebody maintains: two seed prices marked by hand define one
// distance, and every other line is that distance repeated above the top seed and below the bottom one. A
// fixed number of repeats therefore stops being useful the moment price walks past them, which is what
// happened on BTCUSD before 21 November 2026 - price sat below the lowest generated line and there was no
// next line for a target. Everything here extends that same measurement until at least ten full lines sit
// strictly above the price and ten strictly below it, and keeps every existing line exactly where it is.
//
// What this module does not do: it marks nothing by hand, it never moves or renames an existing level, it
// knows nothing about orders, and it never deletes a level - a line referenced by a working order, a
// position or a recorded signal stays in the file because nothing here removes levels at all. It is
// arithmetic over the artifact plus a price, so the generator, the publisher and the tests cannot disagree
// about what "covered" means.
//
// Loaded as a plain script where an L2L module is needed and required by node scripts and tests.
(function initL2lCoverage(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.L2LCoverage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createL2lCoverage() {
  // Ten full lines each way is the coverage floor the user asked for: enough ladder to read a day of 1h
  // bars against and to put a target on, without the grid becoming the chart. FTMO 2 inserts a midpoint
  // between each adjacent pair afterwards, so its minimum is judged on the full lines, never the midpoints.
  const MIN_LEVELS_PER_SIDE = 10;
  // The same cap the marking tool applies to a duplication. Sixty steps each way is far more than any of
  // the four instruments needs; a price that still has no coverage at the cap is a seed reading that is
  // owed rather than something a generator should invent.
  const MAX_GENERATED_STEPS = 60;
  // Who wrote a generated line, as the levels file records it. The hand-marked path says
  // "dashboard marking tool"; this one names the cadence that keeps the grid in front of price.
  const GENERATED_MARKED_BY = "automatic L2L coverage";
  const NOTE_PREFIX = "Automatic coverage";

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") return Number.NaN;
    return Number(value);
  }

  function positive(value) {
    const numeric = toNumber(value);
    return isFiniteNumber(numeric) && numeric > 0 ? numeric : null;
  }

  function roundPrice(value) {
    return Number(Number(value).toFixed(6));
  }

  function isTimestamp(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  // A generated price is snapped onto the instrument's own point grid, so every line is a price that can be
  // typed into MT5 rather than a floating-point remainder.
  function snapPrice(value, point) {
    if (!(point > 0)) return roundPrice(value);
    return Number((Math.round(value / point) * point).toFixed(6));
  }

  // A level list as the file describes it. `midpoint` is the half-grid line FTMO 2 inserts at read time; it
  // is carried here so a caller can draw the second lane's grid, and it is excluded wherever full-line
  // coverage is counted, because the user's floor is stated on the full lines.
  function readLevels(levels) {
    return (Array.isArray(levels) ? levels : [])
      .map(level => ({
        raw: level,
        role: level?.role === "derived" ? "derived" : level?.role === "midpoint" ? "midpoint" : "seed",
        price: toNumber(level?.price)
      }))
      .filter(entry => isFiniteNumber(entry.price) && entry.price > 0)
      .sort((a, b) => b.price - a.price);
  }

  // The measurement the ladder repeats: the two seed prices and the distance between them. When the file
  // already carries derived lines, their recorded anchors are preferred, because those are the numbers that
  // produced the prices already published - regenerating from anything else would move lines that orders
  // may already reference. A file whose derived lines disagree with each other is refused rather than
  // silently re-measured.
  function measureLadder(levels) {
    const list = readLevels(levels);
    const full = list.filter(entry => entry.role !== "midpoint");
    const seeds = full.filter(entry => entry.role === "seed");
    const derived = full.filter(entry => entry.role === "derived");
    const anchors = derived
      .map(entry => ({
        high: positive(entry.raw?.anchor_high),
        low: positive(entry.raw?.anchor_low),
        spacing: positive(entry.raw?.spacing_price)
      }))
      .filter(anchor => anchor.high !== null && anchor.low !== null && anchor.spacing !== null
        && anchor.high > anchor.low);

    let anchorHigh = null;
    let anchorLow = null;
    let spacing = null;
    let anchorSource = null;

    if (anchors.length) {
      const first = anchors[0];
      const same = anchor => Math.abs(anchor.high - first.high) <= 1e-6
        && Math.abs(anchor.low - first.low) <= 1e-6
        && Math.abs(anchor.spacing - first.spacing) <= 1e-6;
      if (!anchors.every(same)) {
        return {
          ok: false,
          reason: "the generated lines record different anchors, so the ladder has no single measurement to repeat"
        };
      }
      anchorHigh = first.high;
      anchorLow = first.low;
      spacing = first.spacing;
      anchorSource = "derived provenance";
    } else if (seeds.length >= 2) {
      const prices = seeds.map(entry => entry.price);
      anchorHigh = roundPrice(Math.max(...prices));
      anchorLow = roundPrice(Math.min(...prices));
      spacing = roundPrice(anchorHigh - anchorLow);
      anchorSource = "seed pair";
    } else {
      return {
        ok: false,
        reason: `the ladder needs the two seed levels marked first; ${seeds.length} is not enough to measure a distance`
      };
    }

    if (!(spacing > 0)) {
      return { ok: false, reason: `the measured distance is ${spacing}, so there is no step to repeat` };
    }
    return {
      ok: true,
      anchorHigh: roundPrice(anchorHigh),
      anchorLow: roundPrice(anchorLow),
      spacing: roundPrice(spacing),
      anchorSource,
      seeds: seeds.length,
      derived: derived.length
    };
  }

  // The price a reading is judged against: the live mid when the quote carries both sides, else the bid,
  // else the last, else the newest M5 close. A snapshot with none of those yields null, which is no reading
  // rather than a made-up price.
  function priceFromInstrument(instrument) {
    const quote = instrument?.quote || {};
    const bid = toNumber(quote.bid);
    const ask = toNumber(quote.ask);
    if (isFiniteNumber(bid) && isFiniteNumber(ask)) return roundPrice((bid + ask) / 2);
    if (isFiniteNumber(bid)) return roundPrice(bid);
    const last = toNumber(quote.last);
    if (isFiniteNumber(last)) return roundPrice(last);
    const bars = Array.isArray(instrument?.m5?.bars) ? instrument.m5.bars : [];
    const newest = bars[bars.length - 1];
    const close = toNumber(newest?.close);
    return isFiniteNumber(close) ? roundPrice(close) : null;
  }


  // Coverage of one price: how many full lines sit strictly above it and strictly below it, and which line
  // is the next one each way. The next line is where the 5R target sits, so "no next line" is the fact that
  // turns a crossing into a reading with no ticket rather than a trade.
  function coverageOf(levels, price, options = {}) {
    const includeMidpoints = options.includeMidpoints === true;
    const list = readLevels(levels).filter(entry => includeMidpoints || entry.role !== "midpoint");
    const at = positive(price);
    const above = list.filter(entry => entry.price > at);
    const below = list.filter(entry => entry.price < at);
    return {
      price: at === null ? null : roundPrice(at),
      levels: list.length,
      above: above.length,
      below: below.length,
      minPerSide: MIN_LEVELS_PER_SIDE,
      covered: above.length >= MIN_LEVELS_PER_SIDE && below.length >= MIN_LEVELS_PER_SIDE,
      nextAbove: above.length ? roundPrice(above[above.length - 1].price) : null,
      nextBelow: below.length ? roundPrice(below[0].price) : null,
      midpoints: includeMidpoints ? list.filter(entry => entry.role === "midpoint").length : 0
    };
  }

  // The template a generated line inherits: the kind of level this file already carries, so a BTCUSD ladder
  // stays an l2l/both/M5 ladder rather than inheriting another symbol's conventions.
  function templateFor(list) {
    const source = list.find(entry => entry.role === "derived") || list.find(entry => entry.role === "seed");
    const raw = source?.raw || {};
    return {
      kind: typeof raw.kind === "string" && raw.kind ? raw.kind : "l2l",
      direction: typeof raw.direction === "string" && raw.direction ? raw.direction : "both",
      timeframe: typeof raw.timeframe === "string" && raw.timeframe ? raw.timeframe : "M5"
    };
  }


  // The automatic extension. It is deliberately additive and idempotent: every existing level object is
  // carried through untouched (same price, label, provenance and marked_at_utc), new lines are placed on
  // the same grid beyond the outermost one on the side that is short, and a second run over its own output
  // adds nothing. `nowUtc` is stamped on the new lines only, which is what records when they became
  // available and what the freshness rule uses to refuse a signal that happened before they existed.
  function ensureCoverage(options = {}) {
    const levels = Array.isArray(options.levels) ? options.levels : [];
    const symbol = typeof options.symbol === "string" && options.symbol ? options.symbol : null;
    const price = positive(options.price);
    const point = positive(options.point);
    const nowUtc = isTimestamp(options.nowUtc) ? options.nowUtc : new Date().toISOString();
    const retainPrices = (Array.isArray(options.retainPrices) ? options.retainPrices : [])
      .map(entry => positive(entry))
      .filter(entry => entry !== null);

    const measure = measureLadder(levels);
    const base = {
      ok: false,
      symbol,
      price: price === null ? null : roundPrice(price),
      changed: false,
      addedAbove: 0,
      addedBelow: 0,
      added: [],
      before: null,
      after: null,
      range: null,
      spacing: measure.ok ? measure.spacing : null,
      anchorHigh: measure.ok ? measure.anchorHigh : null,
      anchorLow: measure.ok ? measure.anchorLow : null,
      anchorSource: measure.ok ? measure.anchorSource : null,
      retained: { prices: retainPrices, missing: [] },
      generatedAtUtc: nowUtc,
      reason: null
    };
    if (!measure.ok) return { ...base, levels, reason: measure.reason };
    if (price === null) {
      return { ...base, levels, reason: "the reading carries no price, so coverage cannot be judged" };
    }

    const list = readLevels(levels);
    const template = templateFor(list);
    const taken = new Set(list.map(entry => entry.price));
    const before = coverageOf(levels, price);

    // Where the existing grid already reaches on each side, in whole steps from the anchor. A file with no
    // generated line on a side starts one step out from the anchor on that side.
    const stepOf = value => Math.round((value - measure.anchorHigh) / measure.spacing);
    const onHighGrid = list
      .filter(entry => entry.price > measure.anchorHigh)
      .map(entry => stepOf(entry.price))
      .filter(step => step >= 1);
    const onLowGrid = list
      .filter(entry => entry.price < measure.anchorLow)
      .map(entry => -stepOf(entry.price))
      .filter(step => step >= 1);
    let nextHighStep = onHighGrid.length ? Math.max(...onHighGrid) + 1 : 1;
    let nextLowStep = onLowGrid.length ? Math.max(...onLowGrid) + 1 : 1;

    const generated = [];
    const add = (step, side) => {
      const raw = side === "high"
        ? measure.anchorHigh + step * measure.spacing
        : measure.anchorLow - step * measure.spacing;
      const snapped = snapPrice(raw, point);
      if (!(snapped > 0)) return false;
      // A generated line must still be a step, not a price snapped onto its neighbour: if the instrument's
      // grid is too coarse for the spacing, the ladder would stack duplicates, so the step is skipped.
      if (taken.has(snapped) || list.some(entry => Math.abs(entry.price - snapped) <= 1e-9)
        || generated.some(entry => Math.abs(entry.price - snapped) <= 1e-9)) {
        return false;
      }
      taken.add(snapped);
      const signed = side === "high" ? step : -step;
      generated.push({
        label: `derived ${snapped}`,
        price: snapped,
        kind: template.kind,
        direction: template.direction,
        role: "derived",
        timeframe: template.timeframe,
        marked_at_utc: nowUtc,
        available_at_utc: nowUtc,
        marked_by: GENERATED_MARKED_BY,
        spacing_price: measure.spacing,
        spacing_points: point ? Math.round(measure.spacing / point) : null,
        anchor_high: measure.anchorHigh,
        anchor_low: measure.anchorLow,
        note: `${NOTE_PREFIX}: step ${signed > 0 ? `+${signed}` : signed} of the L2L distance ${measure.spacing} `
          + `between the seed levels ${measure.anchorLow} and ${measure.anchorHigh}, generated at ${nowUtc} `
          + `because ${symbol || "the asset"} had fewer than ${MIN_LEVELS_PER_SIDE} full levels on that side.`
      });
      return true;
    };

    let guard = 0;
    let counts = before;
    while (counts.above < MIN_LEVELS_PER_SIDE || counts.below < MIN_LEVELS_PER_SIDE) {
      guard += 1;
      if (guard > MAX_GENERATED_STEPS * 2) {
        return {
          ...base,
          levels,
          before,
          after: counts,
          reason: `coverage could not reach ${MIN_LEVELS_PER_SIDE} levels each side within `
            + `${MAX_GENERATED_STEPS} steps; the seed pair needs re-reading`
        };
      }
      let progressed = false;
      if (counts.above < MIN_LEVELS_PER_SIDE) {
        while (!progressed && nextHighStep <= MAX_GENERATED_STEPS) {
          progressed = add(nextHighStep, "high");
          nextHighStep += 1;
        }
      }
      if (counts.below < MIN_LEVELS_PER_SIDE) {
        while (!progressed && nextLowStep <= MAX_GENERATED_STEPS) {
          progressed = add(nextLowStep, "low");
          nextLowStep += 1;
        }
      }
      if (!progressed) {
        return {
          ...base,
          levels,
          before,
          after: counts,
          reason: `coverage stopped at ${counts.above} above and ${counts.below} below: the ladder is at its `
            + `${MAX_GENERATED_STEPS}-step cap and the seed pair needs re-reading`
        };
      }
      counts = coverageOf(levels.concat(generated), price);
    }


    // Rooted at the existing levels, so a caller can prove nothing was dropped, and sorted the way the file
    // stores levels, highest first.
    const merged = levels.concat(generated).sort((a, b) => Number(b.price) - Number(a.price));
    const missingRetained = retainPrices
      .filter(value => !merged.some(level => Math.abs(Number(level.price) - value) <= 1e-9));
    const after = coverageOf(merged, price);
    const prices = merged.map(level => Number(level.price)).filter(isFiniteNumber);
    return {
      ...base,
      ok: true,
      changed: generated.length > 0,
      levels: merged,
      addedAbove: generated.filter(entry => entry.price > measure.anchorHigh).length,
      addedBelow: generated.filter(entry => entry.price < measure.anchorLow).length,
      added: generated.map(entry => entry.price),
      before,
      after,
      range: prices.length ? { low: roundPrice(Math.min(...prices)), high: roundPrice(Math.max(...prices)) } : null,
      retained: { prices: retainPrices, missing: missingRetained }
    };
  }

  // The half grid the second FTMO lane trades: one midpoint between every adjacent pair of full lines. It is
  // computed at read time from the published full ladder and never stored, which is what keeps FTMO 2's
  // coverage requirement the same as the other two accounts': the floor is judged on the full lines.
  function midpointGrid(levels) {
    const list = readLevels(levels).filter(entry => entry.role !== "midpoint");
    const withMidpoints = [];
    for (let index = 0; index < list.length; index += 1) {
      withMidpoints.push(list[index].raw);
      const next = list[index + 1];
      if (!next) continue;
      const midpoint = roundPrice((list[index].price + next.price) / 2);
      if (!(midpoint > next.price) || !(midpoint < list[index].price)) continue;
      withMidpoints.push({
        role: "midpoint",
        price: midpoint,
        label: `midpoint ${midpoint} between ${roundPrice(list[index].price)} and ${roundPrice(next.price)}`
      });
    }
    return withMidpoints;
  }

  // When a line became available to trade from. A generated line carries `available_at_utc`; hand-marked and
  // older generated lines carry `marked_at_utc`, which is the same fact for them.
  function availableAt(level) {
    const stamp = level?.available_at_utc || level?.marked_at_utc || null;
    const ms = stamp ? Date.parse(stamp) : Number.NaN;
    return Number.isFinite(ms) ? ms : null;
  }

  // Whether a confirmation happened before the line existed. A five-minute candle that closed before a line
  // was generated cannot be a crossing of that line: acting on it would place an order from a reclaim that
  // happened while the line was not there, which is exactly what the freshness rule refuses.
  function isRetrospective(level, confirmationTimeUtc) {
    const availableMs = availableAt(level);
    const barMs = confirmationTimeUtc ? Date.parse(confirmationTimeUtc) : Number.NaN;
    if (availableMs === null || !Number.isFinite(barMs)) return false;
    return barMs < availableMs;
  }

  return {
    MIN_LEVELS_PER_SIDE,
    MAX_GENERATED_STEPS,
    GENERATED_MARKED_BY,
    readLevels,
    measureLadder,
    priceFromInstrument,
    coverageOf,
    ensureCoverage,
    midpointGrid,
    availableAt,
    isRetrospective
  };
});

