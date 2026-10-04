// The position tool: the arithmetic behind the box a charting terminal draws under an executed trade.
//
// The picture the user asked for is TradingView's own position tool - a red box from the entry down to the
// stop, a green box from the entry up to the target, the money each of those two distances is worth at the
// size that was traded, and the ratio between the two. Everything here is that arithmetic over numbers the
// snapshot already carries: the entry, the stop and the target the terminal reported for the trade, the
// volume it was traded in, and the instrument's own contract size and digits. It reads no account, holds no
// credential and places nothing. It turns one read-back row into the numbers and the three label lines the
// chart prints.
//
// Loaded as a plain script by index.html (the global `L2LSizing`) and required by the tests, so the page and
// the checker cannot drift on what a sizer says.
(function initL2lSizing(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.L2LSizing = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createL2lSizing() {
  // What a sizer with nothing to measure says. Each reason names the fact that is missing rather than
  // printing a zero: a trade with no stop and a trade stopped at its entry are different trades, and only
  // one of them has a box to draw.
  const REASONS = Object.freeze({
    noSide: "the trade carries no side",
    noEntry: "the trade carries no entry price",
    noStop: "no stop was attached to this trade",
    noTarget: "no target was attached to this trade",
    inverted: "the stop and the target sit on the same side of the entry"
  });

  // A missing number is not zero: a row carrying `null` for a price must be dropped rather than read as a
  // price of nothing, which is the one reading that would draw a box around a price nobody chose.
  function toNumber(value) {
    if (value === null || value === undefined || value === "") return Number.NaN;
    return Number(value);
  }

  function positive(value) {
    const numeric = toNumber(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  function round(value, places) {
    return Number(Number(value).toFixed(places));
  }

  // A price move is stated on the instrument's own scale, so a five-digit FX pair and a two-digit index do
  // not print the same sentence.
  function digitsFor(instrument) {
    const digits = Number(instrument?.digits);
    return Number.isInteger(digits) && digits >= 0 && digits <= 8 ? digits : 2;
  }

  // How much of the quoted price one lot is worth: 100,000 for an FX pair, the contract's own size for an
  // index or a metal, one unit for a coin. A snapshot that does not carry it is read as one unit per lot,
  // which makes the money at risk the price move itself rather than a number invented from nothing.
  function contractSizeFor(instrument) {
    const size = positive(instrument?.contract_size);
    return size === null ? 1 : size;
  }

  function currencyFor(account) {
    const currency = account?.currency;
    return typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : null;
  }

  // The price of the row as the chart prints it: on the instrument's own digits, never rounded to a scale the
  // instrument does not use.
  function formatPrice(value, digits) {
    return Number(value).toFixed(digits);
  }

  // Five, not 5.00: a ratio the plan set to five reads as the five it is, while 4.99 keeps its two places.
  function formatRatio(value) {
    return round(value, 2).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  // A percentage is stated to three places at most and never padded: 0.17% and 0.847% are both exact.
  function formatPercent(value) {
    return round(value, 3).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  // The distance to one edge, as the tool prints it: the price, how far it is, and what that is in percent.
  function formatEdge(price, move, percent, digits) {
    return `${formatPrice(price, digits)} \u00b7 ${move.toFixed(digits)} (${formatPercent(percent)}%)`;
  }

  // Money, in the account's own currency, two places: a stop worth one dollar forty-five says so.
  function formatMoney(amount, currency) {
    if (amount === null || amount === undefined) return null;
    return `${amount.toFixed(2)}${currency ? ` ${currency}` : ""}`;
  }


  // The three lines the tool prints, in the order the picture reads: the target above, the stop below, the
  // entry between them carrying the size and the ratio. A trade whose size was not read back drops the size
  // clause rather than printing `Qty null`, and one edge's money clause follows the same rule.
  function positionToolLines(sizer) {
    const stopAmount = formatMoney(sizer.riskAmount, sizer.currency);
    const rewardAmount = formatMoney(sizer.rewardAmount, sizer.currency);
    const entryClauses = [];
    if (sizer.quantity !== null) entryClauses.push(`Qty ${sizer.quantity}`);
    if (sizer.ratio !== null) entryClauses.push(`Risk/reward ratio ${formatRatio(sizer.ratio)}`);
    return {
      target: `Target: ${formatEdge(sizer.target, sizer.targetMove, sizer.targetPct, sizer.digits)}`
        + (rewardAmount ? ` \u00b7 ${rewardAmount} reward` : ""),
      stop: `Stop: ${formatEdge(sizer.stop, sizer.stopMove, sizer.stopPct, sizer.digits)}`
        + (stopAmount ? ` \u00b7 ${stopAmount} risk` : ""),
      entry: `Entry: ${formatPrice(sizer.entry, sizer.digits)}`
        + (entryClauses.length ? ` \u00b7 ${entryClauses.join(" \u00b7 ")}` : "")
    };
  }

  // The sizer for one executed trade, read from that row's own numbers. `available: false` with a reason when
  // the row cannot be measured: a trade with no stop, no target or no entry has no box, and saying so is the
  // honest answer rather than drawing one at a price nobody set. An edge on the wrong side of the entry is
  // refused for the same reason - the money at risk and the money at target would otherwise trade places.
  function tradePositionSizer(trade, instrument, account) {
    const side = trade?.side === "sell" ? "sell" : (trade?.side === "buy" ? "buy" : null);
    if (!side) return { available: false, reason: REASONS.noSide };
    const entry = positive(trade?.price_open);
    if (entry === null) return { available: false, reason: REASONS.noEntry };
    const stop = positive(trade?.stop_loss);
    if (stop === null) return { available: false, reason: REASONS.noStop };
    const target = positive(trade?.take_profit);
    if (target === null) return { available: false, reason: REASONS.noTarget };
    const ordered = side === "buy" ? stop < entry && entry < target : stop > entry && entry > target;
    if (!ordered) return { available: false, reason: REASONS.inverted };

    const digits = digitsFor(instrument);
    const contractSize = contractSizeFor(instrument);
    // A size the snapshot did not carry leaves the two amounts unstated, while the two prices and their
    // distances are still exact - they are properties of the trade, not of how big it was.
    const quantity = positive(trade?.volume);
    const stopDistance = Math.abs(entry - stop);
    const targetDistance = Math.abs(target - entry);
    const stopMove = round(stopDistance, digits);
    const targetMove = round(targetDistance, digits);
    const riskAmount = quantity === null ? null : round(stopMove * quantity * contractSize, 2);
    const rewardAmount = quantity === null ? null : round(targetMove * quantity * contractSize, 2);
    const ratio = riskAmount && rewardAmount ? rewardAmount / riskAmount : null;

    const sizer = {
      available: true,
      side,
      entry,
      stop,
      target,
      quantity,
      currency: currencyFor(account),
      digits,
      contractSize,
      stopMove,
      targetMove,
      stopPct: round((stopDistance / entry) * 100, 3),
      targetPct: round((targetDistance / entry) * 100, 3),
      riskAmount,
      rewardAmount,
      // The ratio the two amounts actually came to, in two places, so a reader can multiply it back out.
      ratio: ratio === null ? null : round(ratio, 2)
    };
    sizer.lines = positionToolLines(sizer);
    return sizer;
  }

  // One sentence for the chart's caption: how many executed trades the page could size, and what the ones it
  // could not are missing. A trade with no box is named rather than left as a silent absence.
  function positionToolNote(sizers) {
    const rows = Array.isArray(sizers) ? sizers : [];
    const sized = rows.filter(row => row?.available).length;
    if (!rows.length) return "";
    if (!sized) {
      const reasons = [...new Set(rows.map(row => row?.reason).filter(Boolean))];
      return `${rows.length} executed trade${rows.length === 1 ? "" : "s"} with no position tool (${reasons.join("; ")})`;
    }
    const unsized = rows.length - sized;
    return `${sized} executed trade${sized === 1 ? "" : "s"} with the position tool drawn`
      + (unsized ? `, ${unsized} without (no stop or target read back)` : "");
  }

  return {
    REASONS,
    digitsFor,
    contractSizeFor,
    formatPrice,
    formatRatio,
    formatPercent,
    positionToolLines,
    tradePositionSizer,
    positionToolNote
  };
});
