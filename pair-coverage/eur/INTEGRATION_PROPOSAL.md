# EUR pair Layer 2 integration proposal (for Codex)

Prepared 2026-09-12 by the EUR pair-coverage workstream.

**STATUS: APPLIED 2026-09-12** (user-authorised). Gates 1 and 3 are resolved for
the shared/dashboard code; the n8n producer upgrade remains a pending live-system
step. See `DEEPSEEK_EUR_PAIRS_PROGRESS.md` for the current status table.

## What was applied

- `backtester/lib/layer2_pair_logic.js`: `quoteDirection` / `quoteConfidence` /
  `quoteLabel` supported; `usdDirection` / `usdConfidence` kept as aliases;
  `reasonKey` values unchanged.
- `script.js`: explicit `quoteAssetCode` on every EUR cross and on the READY USD
  pairs; `deriveLiveLayer2Dashboard()` resolves the quote per pair; quote-aware
  reference-unavailable and reason strings.
- `pairTradeResearchConfigs`: `XAU/EUR`, `NQ/EUR`, `BTC/EUR` flipped to `READY`
  (both legs already live). `EUR/GBP`, `XAG/EUR`, `WTI/EUR` stay `ONBOARDING`.
- Verified by `tests/pair-coverage/eur/shared_layer2_and_wiring.test.js` plus the
  pre-existing `backtester/tests/layer2_pair_logic.test.js`.

## Still pending

- n8n producer activation: import `pair-coverage/eur/exports/eur_pair_layer2_agent.json`,
  bind Supabase/GitHub credentials, add `Get latest GBP/SILVER/WTI rows` when those
  Layer 1 agents exist.
- Per-pair price evidence; then flip the remaining three labels.
- `data/layer2.json` is unchanged (dashboard re-derives live pairs from
  `data/layer1.json`, so the board is already correct without it).

---

# Original proposal (kept for review history)

Prepared 2026-09-12 by the EUR pair-coverage workstream.

**Answer to "can the Signal Board show the EUR pair calls now?" — no, not yet.**
Everything in `pair-coverage/eur/**` is an isolated, tested draft. Nothing is
published, and three gates currently hide the six crosses. This file lists the
exact edits that unblock them. All anchors are from local `main` at the time of
writing; re-check line numbers before applying.

## Gate 1 — the board only renders Layer 2 cards, gated on READY

`script.js` `renderOverviewSignalBoard()` builds cards from
`buildOverviewLayer2SummaryRows()`, which returns `signal: "RESEARCH"`,
`state: "Onboarding"` for every config whose `liveEligibility !== "READY"`
(`script.js:2362`, footer at `2424`). `deriveLiveLayer2Dashboard()` does the same
at `script.js:6153`.

`pairTradeResearchConfigs` (`script.js:81-222`) currently marks all six crosses
`ONBOARDING`. EUR/USD is the only EUR entry marked `READY`.

Required:

1. Add an explicit quote to each config, e.g.
   `{ targetAssetCode: "GOLD", pairCode: "XAU_EUR", pairLabel: "XAU/EUR", quoteAssetCode: "EUR", ... }`
   Default `quoteAssetCode: "USD"` keeps every existing USD pair unchanged.
2. Flip `EUR/GBP`, `XAU/EUR`, `XAG/EUR`, `WTI/EUR`, `NQ/EUR`, `BTC/EUR` to
   `liveEligibility: "READY"` **only after** Gate 2 and per-pair evidence land.

## Gate 2 — the shared Layer 2 combination is hardwired to USD

Three USD-specific points must become quote-aware. The tested draft in
`pair-coverage/eur/layer2_pair_adapter.js` is the reference implementation
(USD output stays byte-identical).

### 2a. `backtester/lib/layer2_pair_logic.js`

`deriveLayer2PairSignal()` reads `input.usdDirection` / `input.usdConfidence` and
writes "USD" into its reason text (`:35-37`, `:45-53`, `:81`).

Proposed, backward-compatible:

```js
const quoteDirection = normalizeDirectionalSignalKey(input.quoteDirection ?? input.usdDirection);
const quoteConfidence = numberOrNull(input.quoteConfidence ?? input.usdConfidence);
const quoteLabel = input.quoteLabel || "USD"; // used in reason strings
```

Keep the returned keys unchanged so existing callers are unaffected.

### 2b. `script.js` `deriveLiveLayer2Dashboard()`

Today it resolves a single USD agent for every pair:

```js
const usdAgent = layer1Data.agents.find((agent) => agent?.agent === "USD") || null; // :6148
const usdCall = getCall(usdAgent, "24h");                                           // :6176
```

and hardcodes USD in the produced reason (`:6205`).

Proposed: move the quote lookup inside the `forEach`, using the new
`config.quoteAssetCode`, and pass `quoteDirection` / `quoteConfidence` /
`quoteLabel` into `layer2PairLogicLib.deriveLayer2PairSignal({...})`.
`REFERENCE_UNAVAILABLE` logic (`:6177`) then refers to the quote asset session,
which is correct for EUR/GBP (GBP) and the EUR-quoted crosses (EUR).

### 2c. n8n `layer2_trade_selection_agent` code node

Live node hardwires `const usd = calls.USD;` and a 4-pair USD list, and reads only
`USD`/`EUR` rows. The reviewable replacement is
`pair-coverage/eur/exports/eur_pair_layer2_agent.json`: quote per pair, seven
leg reads (EUR, GBP, GOLD, SILVER, WTI, NQ, BTC), same avoid reasons and ranking.

## Gate 3 — nothing is published

`data/layer2.json` is the board's Layer 2 source (`script.js:2`). It currently
contains only `EUR/USD`, `XAU/USD`, `BTC/USD`, `NQ/USD` and no EUR crosses. The
board also recomputes L2 from `data/layer1.json` for READY pairs, so a READY flip
without a correct producer would surface wrong or empty EUR pair rows.

## Prerequisites before flipping any label

- `XAG/EUR` and `WTI/EUR` need `SILVER` / `WTI` Layer 1 agents (peer worktrees).
- `EUR/GBP` needs the GBP Layer 1 agent live (peer worktree).
- Per-pair price evidence (direct feed identity or documented synchronized legs)
  must be recorded; see the availability matrix in `DEEPSEEK_EUR_PAIRS_PROGRESS.md`.
- A weekday validation run is required — on a weekend only `BTC/EUR` can trade.

## What is already done and test-verified

- Quote-agnostic producer with live-shape parity (`layer2_pair_adapter.js`).
- Session rule, Layer 1 adapters, dashboard-consumer view.
- Inactive, secret-free n8n draft with closed connections and matching pair list.
- 36/36 local tests: `node --test 'tests/pair-coverage/eur/*.test.js'`.
