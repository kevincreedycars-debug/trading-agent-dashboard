# DeepSeek EUR pair-coverage build

Authorized 2026-09-07. This is a fourth DeepSeek workstream alongside GBP, Silver and WTI asset builds. Codex continues the backtesting engine review.

## Scope

Audit and implement an isolated, locally tested pair-contract/readiness draft for the existing EUR-related dashboard universe:

| Pair | Base asset | Quote asset | Current dashboard configuration |
| --- | --- | --- | --- |
| EUR/USD | EUR | USD | READY label; validation claims still require evidence |
| EUR/GBP | EUR | GBP | ONBOARDING |
| XAU/EUR | GOLD | EUR | ONBOARDING |
| XAG/EUR | SILVER | EUR | ONBOARDING |
| WTI/EUR | WTI | EUR | ONBOARDING |
| NQ/EUR | NQ | EUR | ONBOARDING |
| BTC/EUR | BTC | EUR | ONBOARDING |

This is the bounded initial universe found in `script.js`, not a claim to cover every possible EUR cross. Preserve the listed orientation: XAU/EUR is not EUR/XAU. Confirm exact tradable instrument/feed identity for commodity/index pairs rather than assuming the display label identifies a broker instrument.

## Starting evidence

- `script.js`: `pairTradeResearchConfigs` lists these pairs and onboarding states. Inspect `buildDerivedLayer2Data` and the actual call path rather than treating a navigation entry as implemented coverage.
- `backtester/lib/layer2_pair_logic.js`: existing helper uses `usdDirection` and `usdConfidence`. Trace how these fields are supplied before deciding how to support a non-USD quote. Do not change this Codex-owned module in this workstream.
- Existing EUR/USD replay, source builders and checker artifacts provide compatibility references, not evidence for a new cross.
- Read `docs/DEEPSEEK_LAYER1_PROGRESS.md` for GBP's unresolved input/contract gaps and `docs/LOCAL_WORKFLOW_EXPORTS.md` before considering workflow imports.
- Read the latest `docs/PARALLEL_AGENT_HANDOFF.md` in the canonical folder for worker locations; other workers' uncommitted changes are not present automatically in this checkout.

## Ownership

Work in `D:\trading-agent-dashboard-codex.worktrees\agent-eur-pairs` on `agents/eur-pair-coverage-20260907`.

Own only:

- `pair-coverage/eur/**`: pair inventory, explicit contracts, isolated pure adapter/readiness implementation and source requirements.
- `tests/pair-coverage/eur/**`: synthetic fixtures and isolated contract tests.
- `docs/DEEPSEEK_EUR_PAIRS_PROGRESS.md`: findings, progress, validation and integration handoff.

Do not modify existing EUR/GBP/Silver/WTI agents, production exports, shared pair logic, backtester code, dashboard files, package files, published data or another worktree. Propose exact integration edits in the handoff for Codex. New shared capabilities need coordinator review, not a silent expansion of ownership.

## Build sequence

1. Record intended files, inspect current code and audit the seven pair routes. For each, distinguish UI/config presence, base/quote agent readiness, pair-signal handling, price-source availability, historical coverage and executable evidence.
2. Define a versioned pair contract with explicit base/quote identities, source call IDs, independent directions/convictions, horizons, decision/availability/expiry timestamps, units, instrument/feed identity and rejection reasons. Avoid a USD-specific field silently standing in for a different quote currency.
3. Implement a pure local adapter/readiness draft under the owned directory, reusing existing rules where their semantics apply. Document any proposed extension. Do not invent scoring weights or claim qualification from a bullish/bearish combination alone.
4. Fail closed on missing, stale, expired, mismatched-horizon, wrong-asset, future-available or unsupported inputs. A static READY label alone must not satisfy the readiness contract. Keep a valid no-trade decision distinct from missing evidence.
5. Write price/data requirements for each pair. Prefer an identified direct feed. Any synthetic conversion must identify both synchronized legs, quote orientation, timestamp alignment, availability and spread/execution limitations. Never subtract returns or combine independent candle highs/lows as though they produced a real tradable cross path. Keep unsupported pricing explicitly unavailable.
6. Add hand-calculated tests for EUR/USD compatibility, EUR/GBP orientation, opposing/same/no-clear-bias calls, quote inversion where explicitly supported, missing/expired/as-of-invalid evidence and synthetic-source limitations. Test all seven inventory entries and block readiness where dependencies are absent.
7. Produce a coverage report separating implemented contract behavior from historical/provider/runtime validation. No model tuning, live activation or warehouse writes are required.

EUR's Layer 1 agent remains independent. Pair combination belongs downstream; do not put another asset's verdict into EUR's raw inputs.

## Delivery

Deliver source and tests, a per-pair gap matrix, explicit input/output examples, data requirements and an integration checklist identifying exact shared-module changes for Codex. State which pairs remain blocked and why. Contract-test success is not predictive validation or executable profitability.

Run `node --test tests/pair-coverage/eur/*.test.js` after creating tests and record exact commands/results. Use synthetic fixtures for local validation; obtain authoritative source evidence before asserting real provider coverage.

Make scoped local implementation commits on this branch. The setup commit contains worktree-specific task documents and must not be merged into the main project's task files. Deliver subsequent implementation commit IDs for review. Retire this worktree after integration and preservation of remaining evidence.
