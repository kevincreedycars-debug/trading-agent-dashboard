(function initPairReadiness(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  const globalRoot = root || (typeof globalThis !== "undefined" ? globalThis : this);
  globalRoot.PairReadiness = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createPairReadiness() {
  const REQUIRED_EVIDENCE = Object.freeze([
    "layer1_contract",
    "historical_replay",
    "checker",
    "live_parity",
    "production_collector",
    "layer2_pair"
  ]);

  const ready = Object.freeze(Object.fromEntries(REQUIRED_EVIDENCE.map((key) => [key, true])));
  const onboarding = Object.freeze({
    layer1_contract: false,
    historical_replay: false,
    checker: false,
    live_parity: false,
    production_collector: false,
    layer2_pair: false
  });

  const PAIR_EVIDENCE = Object.freeze({
    "EUR/USD": ready,
    "XAU/USD": ready,
    "NQ/USD": ready,
    "BTC/USD": ready,
    "GBP/USD": Object.freeze({ ...onboarding, layer1_contract: true }),
    "EUR/GBP": onboarding,
    "XAU/EUR": onboarding,
    "XAU/GBP": onboarding,
    "XAG/USD": onboarding,
    "XAG/EUR": onboarding,
    "XAG/GBP": onboarding,
    "WTI/USD": onboarding,
    "WTI/EUR": onboarding,
    "WTI/GBP": onboarding,
    "NQ/EUR": onboarding,
    "NQ/GBP": onboarding,
    "BTC/EUR": onboarding,
    "BTC/GBP": onboarding
  });

  function getPairReadiness(pairLabel) {
    const evidence = PAIR_EVIDENCE[pairLabel];
    if (!evidence) {
      return {
        liveEligibility: "ONBOARDING",
        onboardingReason: "Pair is not in the evidence registry.",
        missingEvidence: REQUIRED_EVIDENCE,
        evidence: null
      };
    }

    const missingEvidence = REQUIRED_EVIDENCE.filter((key) => !evidence[key]);
    return {
      liveEligibility: missingEvidence.length ? "ONBOARDING" : "READY",
      onboardingReason: missingEvidence.length
        ? `Evidence required: ${missingEvidence.join(", ")}.`
        : "Validated live pair.",
      missingEvidence,
      evidence
    };
  }

  return {
    PAIR_EVIDENCE,
    REQUIRED_EVIDENCE,
    getPairReadiness
  };
});
