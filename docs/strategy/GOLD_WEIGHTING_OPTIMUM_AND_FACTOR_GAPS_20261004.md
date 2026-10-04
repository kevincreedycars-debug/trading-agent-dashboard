# Gold: what the optimal weighting is, and why the factors show no reliable daily logic

Advisory read for the user's question, 2026-10-04. Read-only: no live system, weight, collector,
dashboard file, assignment or other worker was touched, no credentials were used, and the sealed
window was not read. Every figure below was computed this turn from artifacts already on disk,
with the exact commands listed in section 10.

**The short answer.** In the archive the "optimal" weighting is not a weighting at all: it is
"put all the weight on the dollar factor". Across 3,000 random weight vectors, a vector's
in-sample hit rate is 0.70-0.75 correlated with one thing only - how much weight it gives the
dollar factor. Take that factor out and the declared vector's hit rate falls to 50.0%/53.1%/51.8%
at the same coverage, worse than simply saying "up" every day. That optimum should not be adopted,
because inside this artifact the readings and the 24-hour window they are scored against are not
separated in time: each row's macro readings are that same day's closes, while the window starts
at 00:00Z on that day. The same dollar factor measured the careful way - availability lagged -
reads 50.69 percent on 2,892 rows, not 71.95 percent. The project's own timestamped-backtesting
document already warns that this legacy window is a call-date reference price to the next weekday
close and that checker parity is not proof of causal timing. The honest live record stays the one
already filed: about a coin flip.

## 1. The question, and what is actually answerable

Asked: what is the optimal weighting, why do these factors show nothing truly predictable on
gold, and are we missing factors - surely there is logic behind why gold moves every day.

Answerable today, from disk: which readings exist and how often they speak; how each one scored
against the next 24 hours of gold; whether any weight vector beats another out of sample; how much
evidence a weight choice would need to be defensible; and what the archive's own timing is.

Not answerable today: which weighting the market rewards. That needs either the sealed prospective
window (frozen until 2027-03-25T15:00:00Z) or a new licensed dataset with declared vintages, and
the project's own verdict file says exactly this.

## 2. Evidence read (hashes are sha256, first 16 hex characters)

| Artifact | Size | sha256 (16) | What it gave |
| --- | --- | --- | --- |
| `data/backtester-checker-gold-24h-2024-2026.json` | 9,091,206 | `9b4fbd4fd958c4f8` | 608 stored Gold calls, their ten factor readings and the scored 24h window |
| `data/gold-direction-scorecard-20260927.json` | 186,490 | `639bb9334cc5abee` | The project's own vintage-aware factor scorecard |
| `backtester/tmp/gold-fred-extended-20260918/DTWEXBGS.json` | 212,191 | `51064923587d8c2b` | Local dollar vintages, used to date the dollar reading |
| `backtester/tmp/gold-hourly-extended-20260918/candles.json` | 6,047,843 | `20ff2299f8c8d422` | 21,871 hourly gold bars, used to pin the window's clock |
| `logic/agent_gold_direction.md` | 7,794 | `fd6e2aac6915c7f0` | The ten declared factors, rules and weights |
| `backtester/builders/gold/build_gold_historical_snapshots.js` | 18,584 | `df4cd99c97732992` | How each snapshot's inputs are dated |

## 3. The sample, and the one thing in it that is statistically loud

608 stored calls from 2024-01-02 to 2026-04-30; 563 carry a usable window (45 are
`NOT_EVALUABLE`, 26 `NO_CALL`). Gold rose on 251 of the non-flat days, fell on 163, and sat
inside the 0.3 percent band on 149 - so **60.63 percent of non-flat days were up days**. The
average 24-hour move was **+0.167 percent with a 1.099 percent standard deviation, t = 3.61**.
That drift is the loudest single feature of the sample; everything else here is quieter than it.

The stored calls themselves: 396 have an outcome, 223 correct, **56.31 percent**, against 60.86
percent for saying "up" on the same days. Bullish calls hit 67.35 percent (196 calls), bearish
calls 45.50 percent (200 calls). The model is a passenger of the drift, not a source of edge,
which is what the live-and-shadow read filed earlier found from other artifacts.

## 4. Each factor on its own, against the next 24 hours

Only six of the ten declared factors ever speak in these 608 days. **Fed bias, inflation signal,
safe haven and liquidity/growth are neutral on every single day** - 28 of the 100 declared weight
points sit on factors that never fired.

| Factor | Weight | Days it spoke | Hit rate | 95% interval | Information coefficient | Edge vs best constant on the same days | By year |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 Real yield | 22 | 307 | 53.39% | 47.0-59.6 | +0.041 | **-6.36pp** | 59.1 / 48.6 / 41.7 |
| F2 Dollar (DXY) | 18 | 288 | 71.95% | 65.7-77.5 | +0.444 | **+13.57pp** | 67.7 / 74.3 / 85.7 |
| F4 US 2Y | 8 | 323 | 56.67% | 50.3-62.8 | +0.104 | -4.17pp | - |
| F5 Gold's own price | 8 | 363 | 50.74% | 44.8-56.7 | -0.021 | -7.41pp | 47.0 / 53.0 / 56.5 |
| F6 Risk / VIX | 10 | 278 | 39.71% | 33.2-46.6 | -0.048 | **-21.57pp** | 39.1 / 42.4 / 30.0 |
| F7 Economic surprise | 6 | 12 | 71.43% | 35.9-91.8 | +0.548 | +14.29pp | - |
| F3, F8, F9, F10 | 28 | 0 | - | - | - | - | - |

Three readings of that table matter:

1. **The dollar factor is the only factor with a large, year-stable number.** 67.7, 74.3 and 85.7
   percent in 2024, 2025 and 2026. Section 6 explains why that number should not be believed.
2. **The risk/VIX factor is reliably wrong, not noisy.** 39.71 percent on 278 days, stable across
   years (39.1 / 42.4 / 30.0). Its declared rule is "VIX above 25 is bullish gold". A factor that
   is wrong with that consistency is a candidate sign error or a stale proxy, and no weight can
   repair it - setting it near zero is the only defensible treatment until it is re-derived.
3. **Gold's own price carries nothing here** (50.74 percent), and the real-yield factor - the
   highest-weight factor in the design - does worse than the drift (-6.36pp), degrading year by
   year (59.1 to 48.6 to 41.7 percent).

The other careful cut of the same ten factors (companion `WEIGHT_BALANCE_CHECK_20261004.md`) finds
82 of 100 weight points testable and 18 not scoreable at all, with every testable factor inside
the noise band. The two cuts do not even agree on which factors can be read - risk/VIX speaks here
on 278 days and cannot be scored at all there, because its declared rule is an absolute band -
which is itself evidence that the readings, the archive and the rules are not yet one system.

## 5. The weighting question, answered at equal coverage

Comparing weight vectors is only fair if they cover the same days, so every vector below is scored
on the same *number* of days - the days carrying its strongest composite score - and its hit rate
is printed beside the best constant answer on exactly those days.

| Weighting | 30% coverage | 50% coverage | 100% coverage |
| --- | --- | --- | --- |
| Declared 22/18/14/8/8/10/6/6/6/2 | 65.25%, +11.02pp | 62.44%, +3.05pp | 55.47%, -5.34pp |
| Equal weight (10 each) | 58.25%, +0.00pp | 56.73%, -2.92pp | 56.14%, -6.14pp |
| All weight on the dollar factor | **69.70%, +16.67pp** | **66.67%, +6.31pp** | **71.95%, +13.57pp** |
| Everything except the dollar factor | 50.00%, -11.21pp | 53.09%, -5.15pp | 51.80%, -9.02pp |

(The edge is against the best constant call on the same days; a negative edge means the weighting
did worse than saying "up" throughout.)

The declared vector's apparent 11-to-16pp advantage exists only while the dollar factor is in it.
Remove that one factor and the same weights lose to "always up". The best of 3,000 random vectors
reaches 76.23 percent at 30 percent coverage - but its score is 0.747 correlated with how much
dollar weight it carries (0.736 at 50 percent, 0.696 on all days). In this archive "finding the
optimal weighting" and "finding the vector most exposed to the dollar factor" are the same
exercise.

Two further tests:

- **Shuffle test.** Re-deal the outcomes 300 times, with the same pool of 3,000 vectors each time:
  the best shuffled vector reaches 69.67 / 64.04 / 61.48 percent (median 58.20 / 56.65 / 54.07)
  against the observed 76.23 / 72.91 / 62.72, so the observed best sits above the shuffled
  distribution in every case (p = 0.003). The dollar factor is not noise *inside this artifact*;
  section 6 is why it should still not be adopted.
- **Fit on one half, score the other.** Splitting at 2025-10-01 (332 train days, 82 test days) at
  50 percent coverage: the vector fitted on the train half scores 72.50 percent on the test half
  against 62.50 percent for the constant; the declared vector scores 64.10 against 66.67; equal
  weights 69.70 against 60.61; the dollar-only vector 72.22 against 72.22. With only 33-40 test
  calls these differences cannot separate anything.

## 6. Why no weighting can be chosen from this archive

**6a. The readings and the window overlap in time.** Four measurements, all from disk:

- The scored window for a call dated *t* runs from the price at 00:00Z on *t* to the price at
  00:00Z on the next weekday. The hourly gold bars reproduce the stored returns with a 0.969
  correlation and a 0.130 percent median difference when the window is anchored at 00:00Z, and
  monotonically worse at every other hour of the day (01:00Z: 0.908 and 0.233 percent).
- The windows are contiguous, so no day is double-counted: 565 of 565 consecutive open and
  previous-close prices are equal to the cent.
- Inside one row, the macro side is that same day's close. The snapshot builder derives every input
  as `previousValue(series, snapshotDate, n)` - the value *on the snapshot date* minus the value n
  observations earlier - with no availability lag; and the stored dollar factor's direction equals
  the negation of that day's dollar change on 101 of 101 days where the change exceeds 0.3 percent
  (138 of 138 on the looser filter). It agrees with the *previous* day's dollar change only 48.1
  percent of the time, so this is the same day's close, not a lagged reading. Which series supplies
  it is a separate question: no licensed ICE DXY series exists locally, the project's own registry
  refuses any presentation of the broad trade-weighted index (FRED `DTWEXBGS`) under a `dxy_*` name,
  and the stored reading lines up with `DTWEXBGS`'s same-day change exactly. Either way, FRED
  publishes a day's macro value in the evening (about 20:15Z for this family) - roughly 20 hours
  into a window that began at 00:00Z on the same day.
- The consequence is visible: on the 98 such days with a vote and a non-flat outcome, the window's
  gold return correlates **-0.514** with the same-day dollar move (still -0.547 winsorised at 1
  percent, and -0.504 after dropping the ten largest days), and the factor hits 76.53 percent
  against 54.08 percent for the best constant. The previous day's dollar move correlates -0.055
  with the window and the following day's -0.041.

The project already wrote the warning this illustrates, in
`backtester/docs/gold_timestamped_backtesting.md`: the legacy "following 24hrs" window is a
call-date reference price to the next weekday close; "Do not treat numerical checker parity as
proof of causal timing, directional edge, or executable profit"; and the feature contract requires
availability at the check - "actual availability, not the economic observation date". The strict
protocol path enforces that per feature; this legacy artifact cannot.

**6b. The careful measurement of the same factor says "no information".** Two careful paths, both
measuring the dollar factor over overlapping eras, both rating it as nothing:

- The vintage-aware scorecard over 2023-2026 (965 daily anchors, 964 with an outcome, availability
  lagged) scores 25 factor states and concludes *no information* for all 25 on the session horizon,
  and 24 of 25 weekly with the 25th "unstable across years". Only 1 state reaches the 60 percent
  threshold; 13 of 25 are at or above 50 percent; 20 of 25 sit on the right side of their own
  drift. Baselines there: gold up 55.81 percent of 964 session observations, 58.23 percent of 960
  weekly ones.
- The accepted single-variable report, re-run read-only for the companion weight-balance check,
  measures the dollar factor at **50.69 percent on 2,892 rows, +0.35pp against the drift**, and the
  real-yield factor at 50.80 percent on 1,864 rows (+1.17pp).

So the same factor reads **71.95 percent here and 50.69 percent there**, on thousands of rows in
each case. The two paths differ in the respect that matters: this artifact dates each macro reading
to the same calendar day as the window it is scored against (6a), while the careful path applies
the availability lag and the audit. The disagreement is about timing, not about the idea behind
the factor - and the timing side is the one with the written rule.

**6c. The archive cannot resolve a 1-3pp question at all.** With 563 scored windows the standard
error of a 50 percent hit rate is 2.11pp, so the smallest edge this archive can detect at 80
percent power is 5.9pp. Proving a true 1pp edge would need about 19,600 days (some 75 years), 2pp
about 4,900 days, 3pp about 2,178. Every honest factor effect in this project is 0-3pp wide. Weight
differences of the size the user is rightly asking about are not measurable on daily data - which
is why the sealed window exists, and why "which weighting is optimal" has to be answered by a
frozen prospective test rather than by more searching.

**6d. The weights are not identifiable even in principle here.** F1 and F4 move together on 175
days (correlation 0.94), so the archive cannot separate 22/8 from 15/15 between them; two or more
factors speak on 349 of 414 days and disagree in sign on 224 of them; only 138 distinct vote
patterns ever occur out of 59,049 possible; and on 51 days exactly one factor speaks (F5 on 25 of
them, F6 on 15, F4 on 8, F2 on 5, F1 on 3). Many different weight vectors give the same daily
answers, so any "optimum" is a flat ridge, not a point.

## 7. Why these factors show nothing truly predictable on gold

The user's instinct is right that there must be logic behind gold's daily move. There is - but
almost none of it is *in this model, at this horizon, with these inputs*. Six reasons, each with a
number from the sections above:

1. **The horizon is the hard part, not the logic.** Gold's 24-hour move has a 1.099 percent
   standard deviation while the drift is 0.167 percent. The systematic content of a single day is a
   small fraction of the noise, so a daily direction call can only ever be a small edge. The
   economic drivers (real yields, the dollar, policy expectations, official-sector buying,
   positioning) work over weeks to quarters; asking them for tomorrow's direction is asking the
   wrong question of the wrong tool.
2. **Half the design never speaks.** Four of ten factors - Fed bias, inflation signal, safe haven,
   liquidity/growth, carrying 28 of 100 weight points - are neutral on all 608 days. The project's
   own registry records nine declared variables with no verified local source, and the local archive
   holds exactly five macro series (10-year real yield, 10-year and 2-year nominal yields, broad
   dollar index, VIX). Those four factors are decoration.
3. **Two of the six that do speak are wired backwards or stale.** Risk/VIX is wrong with
   three-quarters consistency (-21.57pp, stable across years) and the real-yield factor - the
   heaviest in the design at 22 - does worse than the drift and decays year by year. A weighting
   scheme cannot fix a wrong sign or an empty input.
4. **A trend-following factor on gold itself cannot work at this horizon.** Gold's own price factor
   agrees with the *previous* 24 hours 98.5 percent of the time and with the *next* 24 hours no
   better than a coin (50.74 percent). There is no daily autocorrelation to harvest.
5. **The only factor that looks good is the one whose input is dated inside the window** (6a). That
   is the signature of a timing artifact: one factor dominant, year-stable, invisible to the
   careful measurement of the same driver, and the sole source of every apparent weighting gain.
6. **The live record is the honest one, and it says coin flip.** Filed earlier: 47.65 percent on the
   designated session (2,493 calls, against 53.19 percent for calling "up" every day) and 54.39
   percent on the next-24-hour panel (3,920 calls, about +1.2pp against a standard error of about
   0.8pp). Both artifacts agree with the archive: no demonstrated daily direction edge, and the one
   large number sits where the timing is wrong.

## 8. What is missing - candidate additional factors, and what each would cost

Everything in this section is a *hypothesis to be declared and pre-registered*, not a finding. The
lists are ordered by what can be done with data already on disk, then small acquisitions, then
licence-scale work.

**Already on disk** (five FRED series, one hourly gold archive, a 5,115-row event archive):

| Candidate reading | Logic for gold | Status |
| --- | --- | --- |
| Real-yield *surprise* against its own recent range, not the level | Gold tracks the direction of real yields, but the level is priced; surprises are the tradeable part | DFII10 is local; no new data needed |
| Real-yield and dollar *co-movement regime* (do they confirm or fight?) | When the dollar and real yields move against each other, the macro signal is muted | Local; testable today |
| Event-conditional moves (CPI, NFP, FOMC windows) | Gold's largest daily moves cluster on release days; the event archive holds 5,115 rows | Local; needs a declared plan and window definitions |
| Intraday session structure (Asia / London / New York) | Most of a day's move happens in one session; a 24-hour call hides that | 21,871 hourly bars are local |
| Curve shape (10-year minus 2-year) | The policy-expectation channel behind F3 and F4, which never speak | DGS10 and DGS2 are local |

**Small, bounded acquisition** (one series each, no licence change):

| Candidate reading | Logic for gold |
| --- | --- |
| Inflation breakevens (T10YIE) | The missing input behind the inert inflation factor |
| Equity index level and realised volatility (SPX) | The growth/equities readings that never speak; risk-on versus risk-off |
| Gold implied volatility or options skew (GVZ or equivalent) | Demand for protection and the event risk already priced into gold |
| Gold lease rate or GOFO proxy, and the gold-silver ratio | Physical tightness and the monetary-metals channel; slow but genuine |

**Needs a real acquisition decision** (positioning, flows, official sector):

| Candidate reading | Logic for gold | Why it matters most |
| --- | --- | --- |
| Official-sector buying (central bank net purchases, IMF/IFS or World Gold Council) | The dominant structural bid of this era; explains gold rising while the dollar and real yields also rise | The one driver that can explain the 2024-2026 drift the model merely rides |
| ETF tonnage and flows (GLD/IAU holdings) | Flow-driven price pressure, observable daily | Real daily-frequency demand data, absent today |
| Futures positioning (CFTC COMEX net positioning, managed money) | Crowding and forced liquidation, the source of gold's fast moves | Explains the fat tails the model treats as noise |
| Physical demand (China and India premiums, Shanghai-London spread) | Retail and central-bank-linked demand, partly observable daily | Regional demand is a genuine daily-frequency input |
| Global dollar liquidity (Fed balance sheet, RRP, cross-currency basis) | Funding stress is when gold and the dollar rise together | Explains the regime where the model's sign conventions break |

The honest summary: the ten factors cover the *slow* macro story with five series, and none of the
*fast*, gold-specific story - positioning, flows, official buying, physical demand, event windows -
that plausibly explains why gold moves on any given day. That is the gap the user senses.

## 9. Recommendations

Ranked, and deliberately small:

1. **Do not reweight now, and do not adopt any vector from this artifact.** The in-sample optimum
   is "all on the dollar", and the dollar reading is dated inside the window it is scored against.
   Adopting it would be adopting a timing artifact.
2. **Get the timing question settled by the owning worker before any calibration.** One bounded
   job: rebuild the same snapshots so each input is the last value actually available at the
   decision time (the project's own conservative lag), then re-run the same six factors. If the
   dollar factor collapses to nothing, the overlap is confirmed and this artifact is retired for
   calibration purposes. Highest-value next step, and it touches no live logic.
3. **Fix or mute the two defective factors instead of tuning weights.** Risk/VIX is wrong with
   consistency (candidate sign error or stale proxy); four factors never speak (empty inputs).
   Setting the defective ones to zero is safer than reweighting around them, and it is a design
   change the user can approve in one line.
4. **If a real edge is wanted, change the question rather than the weights.** An event-conditional
   study on the existing 5,115-row event archive - declared in advance, with an edge threshold and
   a holdout - is where a daily-horizon effect could plausibly be large enough to measure. "Which
   weighting is best" cannot be answered by this archive; "does gold behave differently inside
   declared event windows" can.
5. **Freeze one candidate weighting for the sealed window** only after 1 to 3 are done, and accept
   that the seal opens at 2027-03-25T15:00:00Z.

## 10. Limits, provenance and reproduction

Limits. The 24-hour window here is the artifact's legacy definition, not a tradeable fill, and no
entry, stop, spread, slippage or sizing is modelled - nothing in this document speaks about money.
The timing finding is established from the stored artifact plus local archives; the
database-backed snapshot build itself is not readable in this checkout (and needs no credentials
for this advisory role), so the owning worker should confirm it. Every hit rate and edge is quoted
against the best constant answer on the same days, because in a 60 percent up-drift sample raw hit
rates overstate everything. Observations are dependent across overlapping regime stretches, so the
intervals quoted are the optimistic version. Nothing here is a verdict on accuracy, prediction,
timing or edge, and no weight was changed anywhere.

Reproduction (read-only, from the strategy worktree; scripts are ignored scratch under `tmp/`):

```powershell
node tmp/gold-weights-final.js 3000 300      # sections 3 to 6 above
node tmp/probe-f2-dollar-timing.js           # the dollar reading's own date
node tmp/probe-f2-concentration.js           # the -0.514 co-movement and its robustness
node tmp/probe-window-hour.js                # the 00:00Z window anchor
node tmp/probe-gold-window-leak.js           # contiguity, momentum, stretches
```

Files written this turn: this document; `tmp/gold-weights-final.js`,
`tmp/gold-weights-final-out.txt`, `tmp/probe-f2-dollar-timing.js`, `tmp/probe-f2-buckets.js`,
`tmp/probe-f2-concentration.js`, `tmp/probe-window-hour.js`, `tmp/probe-window-split.js`,
`tmp/probe-gold-window-leak.js`. Companion entry appended to
`docs/strategy/CONVERSATION_NOTES.md`.






