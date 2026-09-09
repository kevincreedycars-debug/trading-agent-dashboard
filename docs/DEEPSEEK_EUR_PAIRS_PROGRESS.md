# DeepSeek EUR pair coverage progress

Assigned 2026-09-07. Implementation is isolated under `pair-coverage/eur/` and
`tests/pair-coverage/eur/`. It does not publish dashboard state or modify shared
Layer 2/backtesting code.

## Intended files

The implementation will add:

- `pair-coverage/eur/pair_inventory.js`
- `pair-coverage/eur/pair_contract.js`
- `tests/pair-coverage/eur/fixtures.js`
- `tests/pair-coverage/eur/pair_contract.test.js`

## Coverage matrix and findings

| Pair | UI/config | Contract | Price path | Historical/provider evidence | Readiness |
| --- | --- | --- | --- | --- | --- |
| EUR/USD | READY | supported | direct feed required | not established by this draft | blocked until evidence is supplied |
| EUR/GBP | ONBOARDING | supported | direct EUR/GBP or synchronized EUR/USD + GBP/USD | not established | blocked |
| XAU/EUR | ONBOARDING | supported | identified XAU/EUR feed or synchronized XAU/USD + EUR/USD | not established | blocked |
| XAG/EUR | ONBOARDING | supported | identified XAG/EUR feed or synchronized XAG/USD + EUR/USD | not established | blocked |
| WTI/EUR | ONBOARDING | supported | identified WTI/EUR feed or synchronized WTI/USD + EUR/USD | not established | blocked |
| NQ/EUR | ONBOARDING | supported | identified NQ/EUR feed or synchronized NQ/USD + EUR/USD | not established | blocked |
| BTC/EUR | ONBOARDING | supported | direct BTC/EUR or synchronized BTC/USD + EUR/USD | not established | blocked |

The dashboard route is configuration presence only. The existing shared Layer 2
path supplies `usdDirection`; this worker does not change it. The local contract
uses explicit `baseSignal` and `quoteSignal` fields so quote identity cannot be
silently inferred from a USD-specific field.

## Validation and integration

The contract fails closed for missing, stale, expired, future-available,
mismatched-horizon, wrong-asset, wrong-orientation and unsupported price inputs.
It keeps a valid `NO_CLEAR_BIAS` result distinct from blocked readiness. Synthetic
fixtures are local-only and do not establish provider availability, historical
coverage, executable routing or profitability.

## Data requirements

Every pair needs two independent Layer 1 calls with source call IDs, asset code,
24H horizon, decision/availability/expiry timestamps and conviction. Price
evidence must identify instrument/feed identity, units and orientation. A
synthetic cross must identify both synchronized legs, quote orientation, timestamp
alignment and spread/execution limitations; independent candle highs/lows are not
accepted as a tradable cross path.

## Integration handoff

1. Add a shared pair adapter that maps the explicit contract fields into the
	existing Layer 2 input shape; do not overload `usdDirection` for EUR quotes.
2. Add authoritative direct-feed identities and historical availability evidence
	per pair before changing any onboarding label.
3. Keep `NO_CLEAR_BIAS` as a valid no-trade result, while missing or invalid
	evidence remains blocked.
4. Run the pair contract tests as a unit check only; do not treat them as a
	backtest, live workflow validation or activation approval.

## Test result

Command: `node --test tests/pair-coverage/eur/*.test.js`

Result: 8/8 passed on 2026-09-09. JavaScript syntax checks and editor diagnostics
also report no errors for the four implementation/test files.
