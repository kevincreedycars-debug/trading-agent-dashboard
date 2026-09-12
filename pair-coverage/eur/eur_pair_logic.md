# EUR pair layer logic and contract

Version: 1.0
Status: local draft / contract-tested, not deployed
Owner: EUR pair-coverage workstream (`pair-coverage/eur/**`)
Scope: the six EUR pairs that are not EUR/USD — EUR/GBP, XAU/EUR, XAG/EUR, WTI/EUR,
NQ/EUR, BTC/EUR. EUR/USD is already live and is used only as the parity reference.

## 1. Pair identity and orientation

Orientation is fixed by the dashboard universe and is never inferred at runtime:

| Pair | Base | Quote |
| --- | --- | --- |
| EUR/GBP | EUR | GBP |
| XAU/EUR | GOLD | EUR |
| XAG/EUR | SILVER | EUR |
| WTI/EUR | WTI | EUR |
| NQ/EUR | NQ | EUR |
| BTC/EUR | BTC | EUR |

`XAU/EUR` is GOLD-per-EUR, not EUR-per-GOLD. A price or signal supplied in the
inverse orientation is rejected (`wrong_price_orientation`), not silently inverted.

## 2. Inputs

Each pair needs two independent Layer 1 calls, one per leg:

- `assetCode`, `sourceCallId`, `direction`, `conviction`, `horizonHours`
- `decisionAt`, `availableAt`, `expiresAt`

Accepted directions are `BULLISH`, `BEARISH`, `NO_CLEAR_BIAS`. Layer 1 lean
suffixes (`BULLISH_LEAN`, `BEARISH_LEAN`) normalize to their base direction for
pair combination; the live Layer 1 published value remains untouched.

## 3. Combination rule

- Either leg `NO_CLEAR_BIAS` → `NO_CLEAR_BIAS` (a valid no-trade result).
- Same direction on both legs → `NO_CLEAR_BIAS` (no relative edge).
- Base `BULLISH` and quote `BEARISH` → `BUY`.
- Base `BEARISH` and quote `BULLISH` → `SELL`.
- Combined conviction is the lower of the two leg convictions, never an invented
  weight or a bullish/bearish vote count.
- A `NO_CLEAR_BIAS` decision is a valid no-trade outcome and must stay distinct from
  blocked/missing evidence.

## 4. Fail-closed conditions

Readiness is blocked (`ready: false`) for: unsupported pair, invalid `asOf`, wrong
asset on a leg, missing source-call id, unsupported direction, invalid conviction,
non-24H horizon, decision time in the future, availability time in the future,
expired call, missing price identity, wrong price orientation, invalid price time,
synthetic price without both legs / aligned timestamps / execution limits, and any
unsupported price source. Readiness is never granted from a static `READY` label.

## 5. Session rule

The pair's **base asset** session governs live eligibility, mirroring
`marketOpenForDate()` in `script.js`:

- `BTC` trades 24/7, so `BTC/EUR` can produce a pair call at a weekend.
- All other base assets are weekday-only in Europe/London terms.
- A closed base market yields a session suppression, which is a distinct outcome
  from a missing-conviction block.

## 6. Price and source requirements

- Preferred: an identified direct feed for the quoted pair.
- Permitted fallback: two synchronized legs with explicit quote orientation,
  timestamp alignment and documented spread/execution limitations.
- Prohibited: subtracting returns or combining independent candle highs/lows as
  though they produced a tradable cross path.
- Unsupported pricing is recorded as unavailable, never approximated silently.

## 7. Output contract

- Producer (`layer2_pair_adapter.js`): the live `dashboard_meta` /
  `trade_opportunities` / `avoid_today` shape, byte-identical for USD quotes.
- Dashboard view (`buildDashboardLayer2View`): the consumer shape used by
  `deriveLiveLayer2Dashboard()` — `pairCode`, `instrument`, `direction`,
  `confidence`, `strengthBucket`, `reason`, `rank`.
- Strength buckets mirror `backtester/lib/layer2_pair_logic.js`
  (`VERY_STRONG >= 80`, `STRONG >= 65`, `MODERATE >= 50`, `WEAK >= 0`).

## 8. Key rules

- Quote identity is never carried by a USD-specific field.
- Every one of the six crosses is represented; none is dropped silently.
- Synthetic fixtures prove contract behaviour only, never provider coverage or edge.
- Layer 1 agents stay sealed; pair combination is strictly downstream.
