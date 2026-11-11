/**
 * The challenger's rule interpreter, shared by the research engine and the dashboard panel.
 *
 * The rules themselves are data, not code: a mechanism is an input, a declared USD direction for each
 * threshold and a weight. This file only interprets those declarations. The engine scores a session with
 * it, the panel re-scores a session from the values saved in the artefact with the same file, so "re-run
 * from the saved inputs" is one implementation rather than a second opinion.
 *
 * Research only. Nothing here reads a file, the network, the warehouse or a production path.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.UsdL1Votes = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VOTES_VERSION = "usd-l1-votes-v1";

  /** Ordering used by a vote spec: `gt` is "above", `lt` is "below", `gte`/`lte` are inclusive. */
  function compare(spec, value) {
    if (spec.when === "gt") return value > spec.value;
    if (spec.when === "gte") return value >= spec.value;
    if (spec.when === "lt") return value < spec.value;
    if (spec.when === "lte") return value <= spec.value;
    if (spec.when === "abs_gt") return Math.abs(value) > spec.value;
    throw new Error(`unknown vote comparator ${spec.when}`);
  }

  /**
   * Interpret one mechanism's vote.
   *
   * @param {object[]} spec ordered branches; the first branch that matches decides the vote.
   * @param {number} value the input as it stood at the cutoff.
   * @returns {number} +1 for a bullish USD reading, -1 for bearish, 0 for no reading.
   */
  function interpretVote(spec, value) {
    if (!Number.isFinite(value)) return null;
    for (const branch of spec) {
      if (compare(branch, value)) return branch.usd;
    }
    return 0;
  }

  /** Band one call from its agreement and participation, exactly as the frozen table declares. */
  function convictionFor(rules, agreement, participation) {
    for (const band of rules.conviction_bands) {
      if (agreement >= band.min_agreement && participation >= band.min_participation) return band.conviction;
    }
    return 1;
  }

  /**
   * Score one snapshot from the declared mechanisms and rules.
   *
   * @param {object} options
   * @param {object[]} options.mechanisms the frozen mechanism list, each with `id`, `input`, `vote_spec`, `weight`.
   * @param {object} options.rules equal weight, minimum usable mechanisms, agreement deadband, conviction bands.
   * @param {object} options.values the input values at the cutoff.
   * @returns {object} the call record: direction, conviction, raw score, votes and the reason for no call.
   */
  function evaluateFromSpecs({ mechanisms, rules, values }) {
    const inputs = values || {};
    const votes = mechanisms.map((mechanism) => {
      const raw = inputs[mechanism.input];
      const hasValue = Number.isFinite(raw);
      return {
        id: mechanism.id,
        label: mechanism.label,
        factor: mechanism.factor,
        input: mechanism.input,
        rule: mechanism.rule,
        threshold: mechanism.threshold,
        weight: Number.isFinite(mechanism.weight) ? mechanism.weight : rules.equal_weight,
        vote_spec: mechanism.vote_spec,
        value: hasValue ? raw : null,
        vote: hasValue ? interpretVote(mechanism.vote_spec, raw) : null,
        state: hasValue ? "usable" : "missing"
      };
    });

    const usable = votes.filter((entry) => entry.state === "usable");
    const missing = votes.filter((entry) => entry.state === "missing").map((entry) => entry.input);
    const totalWeight = votes.reduce((total, entry) => total + entry.weight, 0);
    const usableWeight = usable.reduce((total, entry) => total + entry.weight, 0);
    const participation = totalWeight > 0 ? usableWeight / totalWeight : 0;
    // Weight-aware since 2026-11-10: a family of two mechanisms can share one unit of say. Every equal-weight
    // spec (challenger v0, all weights 1) reduces exactly to the integer count it scored before.
    const net = Math.round(usable.reduce((total, entry) => total + entry.vote * entry.weight, 0) * 10000) / 10000;
    const agreement = usableWeight > 0 ? Math.abs(net) / usableWeight : 0;

    const base = {
      mechanisms: votes,
      usable_mechanisms: usable.length,
      mechanism_count: mechanisms.length,
      usable_weight: Math.round(usableWeight * 10000) / 10000,
      total_weight: Math.round(totalWeight * 10000) / 10000,
      participation: Math.round(participation * 10000) / 10000,
      agreement: Math.round(agreement * 10000) / 10000,
      raw_score: net,
      missing_inputs: missing,
      inputs_used: usable.map((entry) => entry.input)
    };

    if (usable.length < rules.min_usable_mechanisms) {
      return {
        ...base,
        direction: "NO_CALL",
        conviction: null,
        reason:
          `only ${usable.length} of ${mechanisms.length} mechanisms had a value at this cutoff and the frozen ` +
          `minimum is ${rules.min_usable_mechanisms}, so no call is made and the missing inputs are named`
      };
    }

    if (agreement < rules.agreement_deadband) {
      return {
        ...base,
        direction: "NO_CALL",
        conviction: null,
        reason:
          `the mechanisms split ${net > 0 ? "+" : ""}${net} across ${usable.length} live inputs, inside the frozen ` +
          `${rules.agreement_deadband} agreement deadband, so the day is recorded as no call rather than a coin toss`
      };
    }

    return {
      ...base,
      direction: net > 0 ? "BULLISH" : "BEARISH",
      conviction: convictionFor(rules, agreement, participation),
      reason:
        `${usable.length} of ${mechanisms.length} mechanisms live, net ${net > 0 ? "+" : ""}${net} ` +
        `(${Math.round(agreement * 100)}% agreement, ${Math.round(participation * 100)}% participation)`
    };
  }

  return { VOTES_VERSION, compare, interpretVote, convictionFor, evaluateFromSpecs };
});
