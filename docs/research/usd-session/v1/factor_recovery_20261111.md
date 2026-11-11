# Factor recovery, 2026-11-11

## What this answers

Ten of the twenty-five registered factor chains had no staged input at the 05:00 cutoff. This note records what
could be recovered from the archives already in this checkout, what remains blocked and why, how many mornings
gained a usable value, and whether any directional or trade decision moved as a result.

Three numbers first:

| Question | Answer |
|---|---|
| Factors that previously had no input and now carry a measured value at the cutoff | **2 of 10** (plus one chain that already had daily proxies, now measured intraday) |
| Mornings that gained at least one usable recovered input | **601 of 725 (82.9%)** |
| Directional or trade decisions changed by the recovery | **0 of 725** |

The zero is measured, not asserted: challenger v1 is evaluated twice on every session, once with the recovered
values attached and once with them stripped, and the two directions compared. No frozen mechanism declares a
recovered key, so the count is the proof.

## The tape

| Property | Value |
|---|---|
| File | `backtester/tmp/oanda_eur_usd_h1.csv` |
| Instrument | EUR/USD one-hour mid |
| Bars | 14,428 |
| First bar opens | 2024-01-01T22:00Z |
| Last bar closes | 2026-04-30T00:00Z |
| sha256 | `edaf6016466e75ef892b34eda86287cbd299ac0afa21ea4b9baf907042633f8f` |

Every measurement reads only bars whose close is at or before the 05:00 London cutoff, and a bar older than
sixty minutes is treated as missing rather than borrowed. The build counts the violations it finds:
`lookahead_violations = 0` over 78,108 bars read.

This is the only intraday tape in the checkout with a verified cut-off read. There is no hourly GBP/USD,
USD/JPY, USD/CAD or USD/CHF history here, so the dollar path is measured on one pair and every value is labelled
as a proxy for the dollar index, never as the index.

## What was measured

| Chain | Feature | Sessions | Coverage | Window |
|---|---|---|---|---|
| `fx.usd-overnight-range-position` | where the cutoff price sits in the overnight range (0 = low, 1 = high) | 601 | 82.9% | the 12 hours before the cutoff |
| | width of that range, in pips | 601 | 82.9% | the same 12 hours |
| `fx.usd-session-volatility-regime` | standard deviation of the last 120 hourly log returns | 596 | 82.2% | the last 120 hourly bars |
| | that deviation against its own 60-session median | 576 | 79.5% | the previous 60 cutoffs |
| `fx.usd-session-momentum` | EUR/USD change since the previous cutoff | 594 | 81.9% | one session |
| | change over five sessions | 592 | 81.7% | five sessions |

The 12-hour overnight window, the 120-bar volatility window and the 1.25 / 0.8 regime ratios are declared
conventions. No research document fixes them, so they are recorded as developer assumptions and nothing
downstream reads them as a threshold.

Distribution of the volatility regime over the 576 mornings with a ratio: 124 high, 351 normal, 101 low.

## What the research says about each recovered chain

A recovered input is not a licence to vote. The 2026-11-04 adjudication blocks all three chains, and each value
is shipped with its blocker attached:

| Chain | Disposition | Sign | Why it still cannot vote |
|---|---|---|---|
| `fx.usd-session-momentum` | Blocked | unresolved | needs a verified DXY endpoint and a frozen lookback; other-window FX momentum does not establish the session's dollar direction |
| `fx.usd-overnight-range-position` | Blocked | unresolved | the candidate state survives, but treating a historical range as a hard bound on the next session is rejected |
| `fx.usd-session-volatility-regime` | Blocked | unresolved | it is an abstention gate, and no abstention accuracy can be scored without an evaluable target observation |

## The seven that are still blocked

None of these is a coding gap. Each one needs data that does not exist in this checkout, and the artefact carries
the blocker, the evidence and the condition that would unblock it.

| Chain | Blocker | Evidence |
|---|---|---|
| `live.f3-us-de-2y-spread-delta` | no German 2-year series: the macro inventory carries twenty-two FRED series and not one euro-area rate; the only German 2-year file is a 500-byte test fixture; the warehouse is not reachable from a backtest | `data/research/usd-session/macro-data-inventory.json` |
| `rates.relative-front-end-delta` | the same missing German 2-year leg | same |
| `live.f7-economic-surprise` | no consensus, first actual or prior revision archive at the cutoff | `data/economic-events-source.json` (zero events, generated 2026-07-22) |
| `live.f8-fed-bias` | no historical Fed-bias snapshots; the warehouse builder leaves the field null for every row | `inputs.ABSENT_INPUTS` |
| `macro.release-surprise-at-first-print` | the same missing release archive as F7 | as F7 |
| `calendar.known-releases-between-cutoff-and-endpoint` | no event calendar is staged, so no release can be placed between 05:00 and the endpoint | as F7 |
| `calendar.days-since-and-until-high-impact-events` | the same empty calendar | as F7 |

The tenth, `risk.usd-safe-haven-demand`, has no input of its own because it is read through three carriers that do
have values (the VIX regime, gold and the USD/JPY mirror). Its zero coverage in the data path is a labelling gap
in the review row, not missing data, and it is recorded as such rather than counted as recovered.

## The gold and NAS100 cache boundary

The two price mechanisms read one-hour bars that stop on 2026-04-30, five and a half months before the last
session the run scores (2026-10-12). That boundary is now measured instead of glossed:

| Measure | Gold | NAS100 |
|---|---|---|
| Bars | 13,715 | 13,675 |
| Last bar closes | 2026-04-30T00:00Z | 2026-04-30T00:00Z |
| Sessions scored after the last bar | 117 | 117 |
| Sessions without a price (includes venue holidays inside the range) | 127 | 127 |
| Sessions where the gate blocked the call with a price missing | 56 | 56 |
| Sessions where the missing price was the shortfall — the call would have been available | 48 | 48 |
| …of those, after the cache boundary | 42 | 42 |

So the cache stop is not cosmetic: on 42 mornings the book had enough live mechanisms to call once the price was
there, and the gate blocked the call because two of nine mechanisms had no value. Extending the collector is the
only way those mornings become callable, and that is a collection change, not a modelling one.

## One morning to click

2024-04-16 is a high-volatility morning with a full book: EUR/USD had fallen 0.38% since the previous cutoff, the
overnight range was 41.4 pips wide and the cutoff price sat at 0.13 of it (near the low), and the 120-bar
volatility was 1.45 times its own 60-session median. The frozen challenger called BULLISH at conviction 4 from
nine live mechanisms. Every recovered value was available at 05:00 and none of them was read.

For contrast, 2026-04-29 is the last morning the tape covers: a 15.7-pip overnight range, the price at 0.06 of it,
and a volatility ratio of 0.68 — a low-volatility morning. The call was BULLISH at conviction 2 and would have
been identical with or without the recovered values.

## What this does not prove

- No sign, weight or threshold is validated here. All three recovered chains remain blocked and no rule reads them.
- The measurements are EUR/USD, not the dollar index. Cross-pair breadth is unmeasured because the tapes are absent.
- The regime thresholds are conventions, not fitted values, and they are not used to abstain.
- Recovering an input is not the same as recovering the gold and NAS100 mornings: those need new bars from 2026-05-01.
- Nothing here changes a published call, a workflow, a threshold or a live lane.

## Next

1. Register the collection gap: the gold and NAS100 hourly collectors must write past 2026-04-30, and the German
   2-year and release-calendar collectors must exist at all, before any of the seven blockers can move.
2. If a candidate is to use a recovered chain, freeze its rule, band and gate on a date and evaluate it only on
   mornings that were not used to choose them; the 725 scored dates are already informed, so that means a dated
   forward test rather than a re-score.
3. Keep the recovered values audit-only until then: they are visible on every morning's row and carry no vote.
