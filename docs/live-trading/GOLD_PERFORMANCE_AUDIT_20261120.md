# Is gold actually performing well? An audit of 48 broker-confirmed XAUUSD trades

Written 20 November 2026 from the broker's own exports and the trader's own placement records - not from the
dashboard's aggregates. It answers one question - *is the recent gold result better than what came before, and if so
why* - and it says where the evidence stops. Nothing in this audit changes a rule, a size or a live order; copying
stayed running throughout and FTMO-3 stayed separate.

## What was read, and how far it reaches

| source | what it is | coverage |
| --- | --- | --- |
| `data/live-trading.json` | FTMO-1, broker deals paired into positions | 14-day window, 2026-11-06T09:50Z to 2026-11-20T09:50Z |
| `data/live-trading.account2.json` | FTMO-2, the half-grid lane | 14-day window, 2026-11-06T09:46Z to 2026-11-20T09:46Z |
| `data/live-trading.blind.json` | FTMO-3, the blind lane | 14-day window, 2026-11-06T09:50Z to 2026-11-20T09:50Z |
| `data/live-ctrader-copier.json` | the cTrader account's deals and the copier's mappings | 30-day window, 2 copies, 2 setup tests, 9 pre-copier closes |
| host `live-trading-trader-state.json` (lanes 1-3) | each lane's own placement, move and close records | 25 + 28 + 7 gold placements; every closed gold trade has one |
| host `live-trading-orders.log` and `live-trading-trader.log` | the 5-minute polls, the fills and the M5 closes the rule read | 11-13 to 11-20 13:36Z, with the gaps stated below |
| `data/l2l-levels.json` | the marked L2L levels and their spacing | marked 2026-10-04, spacing 71.48 (35.74 at midpoints) |

The window is the binding limit. It contains **eleven trading sessions** with closed gold, not twenty-five, so the
"preceding twenty" comparison is a comparison against **six**. The latest five sessions are **16, 17, 18, 19 and 20
November**; 20 November is partial, because its feeds were generated at 09:46-09:50Z and its open positions are still
open. A weekend row that is only Friday's close repeated (14 November) is not a session and is left out of the market
table; 15 November is kept because the Sunday reopen traded.

## Where the recent profit came from - and where it did not

The question behind the audit was "gold looks particularly good lately". The broker's own numbers say the opposite:
**the recent five sessions made less, per trade, than the six before them**, on a lower win rate and a much lower
profit factor (0.35R against 1.64R across the lanes). What makes the tab look strong is three trades.

- **Winner concentration.** The recent five sessions totalled +171.40 across the lanes. The single best trade
  (FTMO-1's 5.06R short, 309101669) is +72.20; remove it and the five sessions are +99.20. Remove the top three - all
  FTMO-1 5R shorts that reached their target - and the same five sessions are **-43.90**. Three trades carry the
  result; this is a small sample with a long right tail, not a broad improvement.
- **Entries did not improve.** The entry is the level, and the level geometry is fixed by the rule: every full-grid
  trade's stop is 14.296 price units and its target 5 x that; every half-grid trade's stop is 11.91 and its target 3 x
  that. All 48 trades reproduce that geometry exactly (checked trade by trade), so there is no "better entry" on
  offer - the rule places the same distance behind the same level every time. What changed is what the market did
  after the entry.
- **Sizing did not change.** Every gold trade on every lane is 0.01 lot - the symbol's minimum - throughout the
  window. No trade is bigger than another, so no part of the change is sizing.
- **Stop management did not create the winners.** The winning FTMO-1 trades each took 8-12 stop moves: breakeven at
  2R, then a trail from 3R. The three best exits are at or just past the target (3639.66 against 3640.15, 3783.03
  against 3783.11, 3711.66 against 3711.63), so the trail never had to carry them; the losers are 1R stops. Stop
  management protected the winners but did not produce the extra R.
- **Market conditions did.** The sampled M5 closes show a directional collapse: 3900 on 16 November to 3519 by
  20 November, with 11-19 alone ranging 147.91 points (2.07 full L2L steps of 71.48) and drifting -102.24, and 11-20
  ranging 104.69 by 13:36Z. A short-biased rule in a market that falls two levels a day is the demonstrated cause of
  the three target hits. The prior period's money came the same way - three ~71-dollar target hits on 10 and 12
  November - while the recent losses clustered on 17 November, and the blind lane's long on 20 November is the same
  market read the other way round.

## Direction, session, grid and the deviation rule

| cut | n | net $ | win% | PF | expectancy R |
| --- | --- | --- | --- | --- | --- |
| short | 39 | +442.83 | 43.6 | 2.61 | +0.835 |
| long | 9 | -41.13 | 44.4 | 0.35 | -0.305 |
| Asia (00-07Z entries) | 19 | +145.43 | 47.4 | 2.13 | +0.567 |
| London (07-12Z) | 4 | -38.40 | 25.0 | n/a | -0.751 |
| London/NY overlap (12-17Z) | 11 | +259.14 | 54.5 | 5.03 | +1.746 |
| NY (17-21Z) | 8 | +100.36 | 50.0 | 3.31 | +0.974 |
| late (21-24Z) | 6 | -64.83 | 16.7 | n/a | -0.827 |
| full grid (FTMO-1 + FTMO-3) | 23 | +303.50 | 52.2 | 3.03 | +0.932 |
| half grid (FTMO-2) | 25 | +98.20 | 36.0 | 1.52 | +0.335 |

Direction is the largest single split: the short side made +442.83 over 39 trades while the long side lost 41.13 over
9. The half-grid lane earned about a third of the full grid's expectancy per trade for the same signals, which is what
its 3R geometry implies; it is not evidence of a worse rule. One point hides in the "wins": all three of FTMO-3's
wins are breakeven-stop exits of +0.01 to +0.12, so its 50% win rate is not three winning trades, it is three
risk-free scratches and three full stops.

**The deviation sequence.** Every ticket on every lane was placed only after the rule's own two-close test: the newest
completed M5 close crossed the level by at least one point of the instrument's grid, and the close before it was on the
near side. Eleven placements were refused, all for a different rule - the limit would have been at or through the
market when the poll ran ("a sell limit at 3568.67 is at or below the market (3569.52)") - so they are late entries,
not deviation failures. No trade exists that failed the deviation test: the gate blocks before a ticket is written, so
there is no refused-by-deviation set to compare against. That is a structural limit of the evidence, not a gap in the
audit.

## Did Layer 1 help? The comparable test

Raw totals across strategies cannot answer this, because the lanes differ in geometry and in how many signals they
take. The comparable test is FTMO-1 against FTMO-3: both are **full grid at 5R**, both read the same levels, and one
is directional while the other is blind. The overlap window is 16-20 November, because FTMO-3's first gold close is
16 November.

| same window, same grid, same R | n | net $ | R sum | W/L/BE |
| --- | --- | --- | --- | --- |
| FTMO-1 directional | 10 | +129.59 | +9.12 | 4/6/0 |
| FTMO-3 blind | 6 | -43.64 | -2.99 | 3/3/0 |

The directional lane came out 12.1R ahead on six more trades, and **all six blind trades were longs** in a market that
fell every session from 16 to 20 November (its closes: three 1R stops of -14.57, -14.41 and -14.84, and three
breakeven scratches of +0.01, +0.05 and +0.12). The two lanes were on opposite sides of the same price on 20 November
(FTMO-1 short 309464502 at 3568.92, FTMO-3 long 202248308 at 3568.63). That is the strongest evidence in this audit
that the Layer-1 direction filter helps. It is also thin: ten trades against six, the blind lane's three "wins" are
scratches, and the two lanes do not hold the identical six signals, so a run of six blind longs in a two-day collapse
is exactly the outcome a direction filter is meant to avoid - which is the point, but it is still one regime and six
trades. Six trades cannot rank two rules; they can only say the blind lane's losses are not offset by the directional
lane's losses.


## The numbers, per strategy, recent five against what came before

Closed gold only, net after the broker's commission and swap, R measured from **the placement's own initial stop and
size** (never from a later trailed stop). BE = |net| < $0.005.

| lane | period | n | W/L/BE | net $ | win% | avg win | avg loss | PF | expectancy R | R sum | max DD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FTMO-1 full 5R, directional | latest 5 (16-20) | 10 | 4/6/0 | +129.59 | 40.0 | +53.86 | -14.31 | 2.51 | +0.912 | +9.12 | -57.01 |
| FTMO-1 | preceding 6 (08-13) | 7 | 5/2/0 | +217.55 | 71.4 | +47.42 | -9.77 | 12.13 | +2.185 | +15.30 | -14.55 |
| FTMO-1 | all 11 sessions | 17 | 9/8/0 | +347.14 | 52.9 | +50.28 | -13.17 | 4.29 | +1.436 | +24.42 | -57.01 |
| FTMO-2 half 3R, directional | latest 5 | 22 | 8/14/0 | +85.45 | 36.4 | +31.56 | -11.93 | 1.51 | +0.331 | +7.29 | -59.98 |
| FTMO-2 | preceding 6 | 3 | 1/2/0 | +12.75 | 33.3 | +35.77 | -11.51 | 1.55 | +0.362 | +1.09 | -12.22 |
| FTMO-2 | all 11 sessions | 25 | 9/16/0 | +98.20 | 36.0 | +32.02 | -11.88 | 1.52 | +0.335 | +8.38 | -59.98 |
| FTMO-3 full 5R, blind | latest 5 (its whole life) | 6 | 3/3/0 | -43.64 | 50.0 | +0.06 | -14.61 | n/a | -0.498 | -2.99 | -43.64 |
| FTMO-3 | preceding 6 | 0 | - | - | - | - | - | - | - | - | - |
| all three lanes, summed | latest 5 | 38 | 15/23/0 | +171.40 | 39.5 | +31.21 | -12.90 | 1.58 | +0.353 | +13.43 | -160.63 |
| all three lanes, summed | preceding 6 | 10 | 6/4/0 | +230.30 | 60.0 | +45.48 | -10.64 | 6.41 | +1.638 | +16.38 | -14.55 |

The summed row is not independent evidence: the lanes repeat each other's levels. The 48 closed trades resolve to
**29 signal clusters** (same side, same level within 0.5, signals within 90 minutes), of which 3 were carried by more
than one lane; the rest are separate re-entries at the same or adjacent levels, which the strategy counts as separate
signals by its own re-entry rule. Of the 29, 22 are shorts and 7 are longs.

**Open, unrealised, kept separate from all of the above:**

| account | position | entry | stop | target | mark at the read | unrealised |
| --- | --- | --- | --- | --- | --- | --- |
| FTMO-1 | 309464502 XAUUSD short 0.01 | 3568.92 | 3582.97 | 3497.19 | 3555.90 at 13:36Z | +13.02 |
| FTMO-3 | 202248308 XAUUSD long 0.01 | 3568.63 | 3554.37 | 3640.15 | 3572.69 at 09:50Z | +4.06 |
| cTrader | 62309024 XAUUSD short 0.01 (copy of 309464502) | 3568.92 | 3582.97 | 3497.19 | account marked total +9.11 at 13:40Z (both open copies) | ~ +13 at the source's 13:36 mark |

FTMO-3's open long is the direct mirror of FTMO-1's open short at almost the same price: the blind lane is on the
other side of the same market, which is the cleanest live example of what the direction filter does.

## The strongest recent gold trades, ticket by ticket

R uses the placement's own initial stop and 0.01-lot size; the exit is the broker's deal price. The M5 columns are
the two closes the rule judged: the one before the confirming bar had to be on the near side, and the confirming bar
had to cross the level by at least one grid point (0.01).

| ticket | lane | level | M5 previous close | M5 confirming close | entry | initial stop | target | actual exit | R | net $ | closed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 309101669 | FTMO-1 | 3711.63 | not in the sampled log (blocked stage writes no close) | 3709.21 at 19 Nov 02:55Z, 2.42 below | 3711.92 | 3725.93 | 3640.15 | 3639.66 | **5.06** | +72.20 | 19 Nov 21:26Z |
| 308512252 | FTMO-1 | 3854.59 | 3866.71 at 16 Nov 05:40Z, 12.12 above | 3844.97 at 16 Nov 05:45Z, 9.62 below | 3854.72 | 3868.89 | 3783.11 | 3783.03 | **5.02** | +71.59 | 18 Nov 04:07Z |
| 308745855 | FTMO-1 | 3783.11 | 3786.15 at 18 Nov 04:55Z, 3.04 above | 3781.90 at 18 Nov 05:00Z, 1.21 below | 3783.36 | 3797.41 | 3711.63 | 3711.66 | **5.02** | +71.51 | 19 Nov 02:57Z |
| 202071432 | FTMO-2 | 3675.89 (midpoint) | not reconstructed - the half grid's entry is a midpoint and the row is keyed to its parent level | - | 3676.07 | 3687.80 | 3640.15 | 3639.66 | **3.06** | +36.35 | 19 Nov 21:26Z |
| 200364072 | FTMO-2 | 3890.33 | 3896.75 at 13 Nov 13:35Z, 6.42 above | 3887.79 at 13 Nov 13:40Z, 2.54 below | 3890.31 | 3902.24 | 3854.59 | 3853.97 | **3.05** | +36.24 | 18 Nov 04:07Z |

Two of the three strongest full-grid trades have both closes visible, and both qualify exactly as the rule states. The
third (309101669) has its confirming bar visible - the 02:55Z M5 close at 3709.21, 2.42 below the level - but the
journal's blocked rows do not carry the close of the bar before it, so the near-side limb cannot be shown from the
pulled data; the ticket's existence says the rule accepted it. For 309101669 the entry came about eleven hours after
the confirming close: the rule waits for the retrace to the level and fills the limit when price returns (placed
14:16Z, filled 14:30Z at 3711.92 against a limit at 3711.63 - 0.29 of adverse fill on a 14.296 stop, 0.02R).

## Trend, volatility and movement between the L2L levels

The trader's own 5-minute reads are the only recorded market series in this repository; there is no M5 bar archive, so
these are sampled closes, not bars (a wick between polls is invisible). Weekends are removed.

| session | sampled closes | first | last | high | low | range | drift |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 13 Nov | 211 | 3899.99 | 3880.53 | 3904.91 | 3870.95 | 33.96 | -19.46 |
| 15 Nov (pre-open) | 287 | 3880.53 | 3900.65 | 3900.65 | 3878.20 | 22.45 | +20.12 |
| 16 Nov | 171 | 3900.16 | 3848.82 | 3900.16 | 3837.03 | 63.13 | -51.34 |
| 17 Nov | 185 | 3868.19 | 3854.99 | 3885.93 | 3853.71 | 32.22 | -13.20 |
| 18 Nov | 29 (journal gap) | 3783.25 | 3779.29 | 3791.99 | 3776.40 | 15.59 | -3.96 |
| 19 Nov | 155 | 3709.21 | 3606.97 | 3740.68 | 3592.77 | 147.91 | -102.24 |
| 20 Nov to 13:36Z | 154 | 3607.29 | 3568.60 | 3623.56 | 3518.87 | 104.69 | -38.69 |

The L2L spacing is 71.48 price units (35.74 at midpoints); the levels the trades used run 3532.93, 3604.41, 3675.89,

## Execution and reporting distortions, and what they would change

- **Duplicate signals.** The same underlying setup is counted once per lane. 48 trades reduce to 29 clusters; the
  summed "all three lanes" row is inflated by that repetition and is not used for any conclusion above.
- **Test trades.** None in gold. The cTrader account's 2 setup-test closes (`tech-conn-test-ctrader`) and FTMO-3's
  BTCUSD connection test are excluded by the account's own labels, and the copier's performance panel excludes them.
- **Conversion errors.** None found. Every gold trade's gross profit equals price move x 0.01 lot x 100 within $0.11
  (commission rounding), all 48 trades; the R geometry reproduces the declared 5R/3R exactly; no duplicate ticket
  exists inside a lane.
- **The one copier distortion that matters.** The closed cTrader gold copy (`62272218`, source 309101669) was
  **adopted mid-trade**: the source filled at 3711.92 on 19 Nov 14:30Z, the copier's first poll took it at 3667.25 on
  19 Nov 20:11Z - 5h41m later and 44.67 price units (3.1R on the source's 14.296 stop) below the source entry. The
  copy still made +40.77, but the source made +72.20; the copy gave up 0.68R to the delay. This is not a defect to
  fix - it is what "start following a position that already exists" means - but any comparison of copy net against
  source net must use it as an entry-slippage case, not as a like-for-like copy. The two copies opened today (limit
  orders, `62308557` EURUSD and `62309024` XAUUSD) filled at their source entries (3568.92 for gold), so the copier's
  steady-state entry is level-for-level.
- **Copy latency.** The two working-order copies were placed in the copier's poll about 48-49 seconds after the source
  order was accepted; the fill followed the source fill, because the copied order sits at the same level.

## Did a recent fix or deployment explain the difference?

No strategy rule changed inside the five-session window. The only lane-code change in the 14-day window is
`f14f2ac7` on 12 November (lane 2's two-close gate and withdrawal handling), which sits in the *prior* period and
affects the half-grid lane's selection, not the full-grid target hits. The copier's lifecycle deploy at 09:10Z on
20 November changes what the cTrader tab can *show*, not what the lanes trade; the 540-second publish gate at 13:40Z
changes how often the page updates, not the trades. So the recent result is not a deployment effect: it is three full

## What is demonstrated, what is plausible, and what is still uncertain

**Demonstrated by the broker's records:**

- Gold was short-biased and the market fell 3900 -> 3519 between 16 and 20 November, with the two widest sampled
  ranges on 19 and 20 November.
- Three FTMO-1 shorts reached 5R targets and account for the entire recent net: without them the five sessions are
  negative.
- The short side made +442.83 across 39 trades and the long side lost 41.13 across 9.
- Every trade carried the rule's fixed 5R/3R geometry, 0.01 lot, and an initial stop recorded at placement.
- The blind full-grid lane lost 43.64 over the same window the directional full-grid lane made 129.59, with one lane
  long and the other short at the same price on 20 November.

**Plausible but not proved:**

- That the direction filter is the cause of the directional lane's advantage: the lanes did not take the same six
  signals and six blind trades is too few to separate a rule from a market.
- That the short bias "worked" because of the trend: the same bias lost on 17 November (-93.78 across lanes) and made
  its money on 18-19 November. Direction agreement with a regime is plausible; the sample is one regime.
- That the half-grid lane's lower expectancy is geometry rather than selection: it has 25 trades against 17, but only
  three in the prior period, so its own recent-versus-prior comparison is mostly one period.

**Uncertain or unavailable:**

- The preceding twenty sessions do not exist in a 14-day broker window; the comparison is against six.
- No per-trade Layer-1 call history is committed, so the call *at entry* is known only through the lane's own
  direction (and the current calls, all BEARISH_LEAN for gold on 20 November).
- The M5 series is a sampled close, not bars; 18 November has 29 samples against 150+ on other days, and the sampled
  log has gaps (the 13-14 November weekend, and 16-18 November).
- The half-grid confirmation sequence is not reconstructible from the pulled rows because its entry is a midpoint.
- Whether the same three target hits would have happened without the trail cannot be tested from closed trades: the
  trades exited at target, so trailing was not binding.

## Plain-English conclusion

Gold is **not** broadly improving. It made 171.40 across the lanes in the last five sessions, but that number comes from
three FTMO-1 shorts that ran to their 5R targets while gold fell two L2L steps a day; strip those three and the five
sessions lose 43.90. Per trade the recent period is weaker than the six sessions before it (0.35R against 1.64R, win
rate 39.5% against 60%), and the half-grid lane's 3R geometry explains its lower expectancy rather than a fault. The
clearest positive signal is the directional filter: on the same full-grid geometry over the same window the
directional lane made 129.59 while the blind lane lost 43.64 - but that is ten trades against six and one market
regime, so it is a reason to keep observing, not a reason to change anything.

What to monitor next: whether the remaining lifecycle paths (cancel, partial close, re-place after a destination
cancel, and a stop amendment that came from a trail rather than a first placement) are exercised by a natural source
event; whether the short-side edge survives a range week rather than a trend week; whether the half-grid lane's
expectancy stays near 0.33R once it has twenty trades; and whether the copier's steady-state copies keep filling at
the source entry now that both open copies are working orders rather than an adopted position.

## Reproducing it

The evidence tooling and the pulled host files live in the ignored local folder `.local/gold-audit/`
(`audit.js`, `checks.js`, `extras.js`, the three lane state files and order logs, and the gold confirmation CSV
extracted read-only from the lane-1 trader log). Running the three scripts in order rewrites `audit-summary.json`,
`trade-detail.json` and `extras.json` from `data/` plus that folder; nothing in them writes to the host or to the
repository.

target hits in a falling market, plus a loss rate that rose from 2 in 7 to 6 in 10 on FTMO-1.

3711.63, 3747.37, 3783.11, 3818.85, 3854.59, 3890.33, 3926.07, 3997.55, 4033.29, 4069.03, 4140.51. The 19th ranged
2.07 full steps and closed 1.43 steps lower; the 20th covered 1.46 steps by lunchtime. That is a trend day followed by
a continuation, not a quiet range: the stop at 14.296 is one fifth of a step, so a two-step move is ten stops of room.

