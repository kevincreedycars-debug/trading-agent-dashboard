# DeepSeek EUR pair coverage progress

Assigned 2026-09-07. Implementation is isolated under `pair-coverage/eur/` and
`tests/pair-coverage/eur/`. It does not publish dashboard state or modify shared
Layer 2/backtesting code.

## Scope (2026-09-12)

Remaining focus is the **six EUR pairs that are not EUR/USD**: EUR/GBP, XAU/EUR,
XAG/EUR, WTI/EUR, NQ/EUR and BTC/EUR. EUR/USD is already live and is retained only
as the byte-parity reference so the generalized Layer 2 cannot regress it.

The four live USD pairs produced no calls on the committed refresh because
**2026-09-12 is a Saturday**: `marketOpenForDate()` in `script.js` suppresses every
non-BTC asset at weekends (`script.js:1733`, weekday lists `script.js:71`). That is
expected market-closed behaviour, not a Layer 1 defect.

## Intended files

The implementation adds:

- `pair-coverage/eur/pair_inventory.js`
- `pair-coverage/eur/pair_contract.js`
- `pair-coverage/eur/layer2_pair_adapter.js`
- `pair-coverage/eur/layer1_call_adapter.js`
- `pair-coverage/eur/pair_session.js`
- `pair-coverage/eur/eur_pair_logic.md`
- `pair-coverage/eur/exports/eur_pair_layer2_agent.json` (inactive draft)
- `pair-coverage/eur/workflows/eur_pair_layer2_agent.md`
- `tests/pair-coverage/eur/*.test.js` (+ `fixtures.js`)

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

## Layer 1 / Layer 2 parity: confirmation and process

**Confirmation: this workstream does not build Layer 1 or Layer 2.** The draft is
a contract/readiness spec plus a pure producer mirror under `pair-coverage/eur/`.
It creates no collector, no agent, no Supabase read/write, no GitHub publish and no
dashboard wiring. Parity with the live USD pairs requires the integration steps
below, which are owned by Codex/coordinator and the peer asset workstreams.

### What the live USD-pair system actually is

- Layer 1: five n8n collectors (USD, EUR, GOLD, NQ, BTC) writing
  `market_snapshots`; five n8n Layer 1 agents writing `agent_outputs`;
  `dashboard_writer` reads `agent_outputs` and writes `data/layer1.json`.
- Layer 2: `exports/layer2_trade_selection_agent.json` is a single code node that
  reads only `agent_name` in `{USD, EUR, GOLD, NQ, BTC}`, hardcodes the pair list
  to `EUR/USD`, `XAU/USD`, `BTC/USD`, `NQ/USD`, assigns `const usd = calls.USD`,
  uses `LOW_CONVICTION_THRESHOLD = 60`, sets
  `confidence = round((base + quote) / 2)` and writes `data/layer2.json` to GitHub.
- Therefore "live" today means **four USD-quoted pairs only**. GBP/USD, XAG/USD and
  WTI/USD are onboarding in the same way the EUR crosses are.

### Layer 1 leg readiness per EUR pair

| Pair | Base leg | Quote leg | L1 status |
| --- | --- | --- | --- |
| EUR/USD | EUR (live) | USD (live) | legs exist |
| XAU/EUR | GOLD (live) | EUR (live) | legs exist |
| NQ/EUR | NQ (live) | EUR (live) | legs exist |
| BTC/EUR | BTC (live) | EUR (live) | legs exist |
| EUR/GBP | EUR (live) | GBP (draft, peer worktree) | blocked on GBP |
| XAG/EUR | SILVER (not built) | EUR (live) | blocked on Silver |
| WTI/EUR | WTI (not built) | EUR (live) | blocked on WTI |

### The missing system: quote-agnostic Layer 2

Three USD-hardwired locations must be generalized before any EUR cross can run:

1. `backtester/lib/layer2_pair_logic.js` — `usdDirection` / `usdConfidence` inputs
   and the "USD is..." wording (Codex-owned; propose, do not edit here).
2. The Layer 2 n8n code node — `const usd = calls.USD` and the literal `USD` in
   the generated reasons.
3. `script.js` `deriveLiveLayer2Dashboard()` — the `agent === "USD"` lookup and the
   `while USD is independently ...` reason at the pair loop.

`pairTradeResearchConfigs` already lists the EUR pairs as `ONBOARDING`; the
configuration entry is not the mechanism.

### Process, in order

1. **No Layer 1 work is needed for EUR/USD, XAU/EUR, NQ/EUR or BTC/EUR** — both
   legs already run live. XAU/EUR, NQ/EUR and BTC/EUR are usable as soon as the
   Layer 2 generalization lands and their price evidence is recorded.
2. **Land the missing Layer 1 legs** for GBP (peer GBP worktree) and Silver/WTI
   (peer asset worktrees); those block EUR/GBP, XAG/EUR and WTI/EUR only.
3. **Generalize the shared Layer 2** at the three locations above, keeping USD as
   the backward-compatible default so EUR/USD stays byte-identical.
4. **Add quote-row Supabase nodes** (`Get latest GBP/SILVER/WTI rows`) as those
   Layer 1 agents go live, and expand the code node's `assets`/`pairs` lists.
5. **Supply per-pair evidence** (direct feed identity or documented synchronized
   legs) before any onboarding label changes.
6. **Activate** through n8n/operator + Codex merge. This is a separate integration
   step; it is not performed from this worktree.

### Delivered today: quote-agnostic Layer 2 producer draft

`pair-coverage/eur/layer2_pair_adapter.js` mirrors the live workflow semantics
exactly (sentinel handling, conviction clamp, threshold 60, rounded-average
confidence, avoid reasons, ranking, `dashboard_meta`/`trade_opportunities`/
`avoid_today` shape) with the quote asset taken per pair instead of the literal
`USD`. USD-quoted pairs reproduce the live strings byte-for-byte. It is pure, does
no I/O and is the drop-in Codex can lift into the shared producer.

## Draft package status (completion criteria)

Implemented and locally tested:

- Pair identity/orientation inventory and the fail-closed readiness contract.
- Quote-agnostic Layer 2 producer with live-shape parity for USD quotes.
- Session rule (`pair_session.js`) mirroring `isWeekendDate`/`marketOpenForDate`.
- Layer 1 adapters for both live shapes (`agent_outputs` rows and `layer1.json`).
- Dashboard-consumer view with `pairCode` and strength buckets.
- Inactive, secret-free n8n draft (`exports/eur_pair_layer2_agent.json`).

Missing provider/schema evidence:

- Direct-feed identity, units and availability per cross are still unrecorded.
- `market_snapshots` has no repo migration; the live column set is unconfirmed.

n8n runtime validation still required:

- Draft import, credential binding (Supabase + GitHub nodes), and execution.
- The `SILVER`/`WTI` Layer 1 agents must exist before those legs can feed in.

Historical/backtesting validation still required:

- No replay or outcome evaluation has been run for any EUR cross.

Activation/integration not performed:

- No onboarding label changed, no workflow activated, no `data/layer2.json` write.

## Source and availability matrix

| Pair | Base feed source | Quote feed source | Availability recorded |
| --- | --- | --- | --- |
| EUR/GBP | EUR (live) | GBP (peer draft) | not established |
| XAU/EUR | GOLD (live) | EUR (live) | not established |
| XAG/EUR | SILVER (not built) | EUR (live) | not established |
| WTI/EUR | WTI (not built) | EUR (live) | not established |
| NQ/EUR | NQ (live) | EUR (live) | not established |
| BTC/EUR | BTC (live) | EUR (live) | not established |

## Integration field mapping

| Source field | Normalized | Used by | Output field |
| --- | --- | --- | --- |
| `agent_outputs.call_24h_direction` / `full_output.today_call.direction` | `BULLISH`/`BEARISH`/`NO_CLEAR_BIAS` | pair legs | `trade_opportunities[].direction` |
| `agent_outputs.call_24h_conviction` / `conviction_24h`  | integer 0-100, null preserved | pair legs | `trade_opportunities[].confidence` |
| `layer1.json` `calls["24h"].direction/conviction` | same as above | dashboard view | `tradeOpportunities[].confidence` |
| pair base asset | `OPEN`/`CLOSED` session | suppression | `avoidToday[].marketStatus` |
| lower leg conviction | rounded average with quote leg | ranking | `rank`, `strengthBucket` |

## Test result

Command: `node --test tests/pair-coverage/eur/*.test.js` (quote the glob in PowerShell).

Result: 36/36 passed on 2026-09-12 (contract, producer, session, adapter, dashboard
view and workflow-draft suites across the six non-EUR/USD crosses).
JavaScript syntax checks and editor diagnostics also report no errors. The quoted
glob is required in PowerShell; an unquoted `*.test.js` is passed through literally
and can report a spurious non-zero exit while truncating pipes.

