# Asset Onboarding Gates

The Signal Board displays both validated and planned pairs. Displaying a card is
not permission to publish a call.

`lib/pair_readiness.js` is the source of truth for pair eligibility. A pair is
`READY` only when all of these evidence gates are true:

1. A sealed independent Layer 1 contract exists.
2. Historical replay exists for the target asset.
3. A deterministic checker validates the replay.
4. A live-versus-replay parity check passes.
5. A production collector supplies the required inputs.
6. Layer 2 pair construction is implemented and tested.

At the current baseline, only `EUR/USD`, `XAU/USD`, `NQ/USD`, and `BTC/USD`
meet every gate. GBP, Silver, WTI, EUR/GBP, and all EUR/GBP quote variants must
remain `RESEARCH / Onboarding` until their own evidence is complete; readiness
cannot be inherited from a related USD pair.
