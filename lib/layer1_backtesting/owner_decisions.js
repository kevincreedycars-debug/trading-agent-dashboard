/**
 * The five owner decisions, answered.
 *
 * Each entry records the decision, who it came from, what it changes in this checkout and what it does not
 * license. The report and the Backtesting screen render this file, so an answer cannot be reworded in one place
 * and left stale in the other.
 *
 * Research only.
 */
"use strict";

const OWNER = "decision owner, 2026-11-17";

/**
 * @param {object} context
 * @param {object} context.coverageTrace the scheduled/reconstructed/valid/directional/scored trace
 * @param {object} context.flatBands the frozen flat-band proposal
 * @returns {object[]}
 */
function ownerDecisions({ coverageTrace, flatBands } = {}) {
  const candidate = coverageTrace && coverageTrace.by_model ? coverageTrace.by_model.candidate : null;
  return [
    {
      id: "OD-1",
      status: "resolved",
      owner: OWNER,
      question: "Does pair-combination accuracy mean two independent Layer 1 legs, or the existing USD-only cross-market test?",
      decision:
        "Keep the agreed USD-only inverse cross-market test. It is one USD call against four market outcomes and it is test 3. Combining two independent Layer 1 calls is a separate future test with its own definition.",
      previous_recommendation:
        "Define it as two independent legs and leave it unscored until a non-USD leg has a frozen rulebook; the four-market test already answers a different question.",
      effect: [
        "tests.four_markets keeps its name, its four per-market denominators and its USD-only reading.",
        "pair_combination is registered as a future test and remains unscored; it is not renamed onto test 3.",
      ],
      does_not_license: "It does not license a second leg, a long/short leg mapping or a pair-level accuracy number.",
      evidence: [
        { path: "lib/layer1_backtesting/tests.js", field: "pairCombinationDefinition" },
        { path: "data/usd-layer1-backtester/run-v1.json", field: "tests.four_markets" },
      ],
    },
    {
      id: "OD-2",
      status: "resolved",
      owner: OWNER,
      question: "Which gate defines published readiness and accuracy: presence and freshness, or present + fresh + clocked + identified?",
      decision:
        "Headline readiness uses the selected model's strict evidence gate. Each performance result uses its own eligible sample and displays its denominator beside it.",
      previous_recommendation:
        "Publish both, labelled; the narrow gate keeps today's numbers comparable and the strict gate keeps the research honest.",
      effect: [
        "Headline ready mornings for either model are the strict-gate count, which is 0 of 725 because no 05:00 receipt exists.",
        "The narrow-gate count stays visible as a labelled comparison, never as the headline.",
        "Every test row prints the sample that produced it; the legacy reconstructed sample is never presented as the strict-gate sample.",
      ],
      does_not_license: "It does not license a single blended accuracy figure, and it does not upgrade a proxy test to a headline.",
      numbers: {
        strict_ready_control: 0,
        strict_ready_candidate: 0,
        narrow_ready_control: coverageTrace ? coverageTrace.narrow_ready_control : null,
        legacy_reconstructed_candidate: candidate ? candidate.reconstructed : null,
        engine_directional_candidate: candidate ? candidate.directional : null,
      },
      evidence: [
        { path: "data/usd-layer1-backtester/run-v1.json", field: "validity_gate.ladder" },
        { path: "lib/layer1_backtesting/readiness.js", field: "by_model" },
      ],
    },
    {
      id: "OD-3",
      status: "resolved",
      owner: OWNER,
      question: "Should the trade flags on blocked mornings be withdrawn, relabelled, or kept?",
      decision:
        "A blocked morning creates no valid decision and no trade. Any contradictory legacy trade flag is preserved as an audit finding, not deleted and not traded.",
      previous_recommendation:
        "Yes, or relabel them as conditional; the engine already refuses to publish them and the difference is counted under reconciliation.",
      effect: [
        "The engine keeps trade_eligible false on every blocked or abstained morning.",
        "The published flag is retained and counted under engine_stricter and in the run audit as trade_on_blocked_morning.",
        "The screen shows those flags as audit findings with their dates, never as eligible trades.",
      ],
      does_not_license: "It does not license rewriting the published artefact, and it does not turn a withdrawn flag into a trade.",
      evidence: [
        { path: "lib/layer1_backtesting/engine.js", field: "decide.trade_eligible" },
        { path: "data/usd-layer1-backtester/engine-v1.json", field: "morning_states[].trade" },
      ],
    },
    {
      id: "OD-4",
      status: "resolved",
      owner: OWNER,
      question: "Is the flat band and the scoring tie policy frozen for the USD session?",
      decision:
        "The exact proposed flat bands and the tie treatment are returned per instrument below. They are frozen from development dates only, before any holdout outcome is examined.",
      previous_recommendation: "Freeze both before any candidate is scored, as the handover requires.",
      effect: [
        "Each instrument carries one band, its development sample and its rule; the band is applied unchanged to the 400 unseen mornings.",
        "A move strictly inside the band is flat: excluded from the accuracy denominator and counted separately.",
        "A vote that nets exactly zero, or sits inside the 0.20 deadband, is NO_CALL; there is no coin flip and no direction-priority tie-break.",
      ],
      does_not_license: "It does not license re-fitting a band after seeing a holdout result, and it does not license dropping flat mornings silently.",
      frozen_bands: flatBands || null,
      evidence: [
        { path: "data/usd-layer1-backtester/run-v1.json", field: "run.flat_bands" },
        { path: "data/usd-layer1-backtester/run-v1.json", field: "results.dxy_broker_cfd.instrument.flat_band_rule" },
        { path: "lib/layer1_backtesting/flat_bands.js", field: "proposedFlatBands" },
      ],
    },
    {
      id: "OD-5",
      status: "resolved",
      owner: OWNER,
      question: "Which coverage figure is authoritative for the candidate: the coverage table's reconstructed calls or the engine's gated calls?",
      decision:
        "Trace both to their model, gate, dates and source artefact, show their overlap and exclusions, and report scheduled, reconstructed, valid, directional and scored counts separately. Neither figure is authoritative for the other.",
      previous_recommendation:
        "State the coverage rule beside every accuracy figure and treat the table as a reconstruction, not as the model's published call count.",
      effect: [
        "The report and the screen print five counts per model with their own definitions and denominators.",
        "The scored denominator of the broker-proxy test is labelled as the legacy reconstructed sample, because it contains calls the gated engine would not make.",
        "No claim is made that one count is a subset of another; the overlap and the exclusions are printed.",
      ],
      does_not_license: "It does not license treating 515 reconstructed calls as 515 valid calls, or treating 121 gate-passing calls as a scored sample of that size.",
      coverage_trace: coverageTrace || null,
      evidence: [
        { path: "data/usd-layer1-backtester/run-v1.json", field: "coverage.by_model" },
        { path: "data/usd-layer1-backtester/run-v1.json", field: "tests.dxy_direction_broker_cfd" },
        { path: "lib/layer1_backtesting/screen.js", field: "buildCoverageTrace" },
      ],
    },
  ];
}

module.exports = { ownerDecisions, OWNER };
