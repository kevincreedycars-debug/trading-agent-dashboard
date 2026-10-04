# Gold: why four of the ten factors never speak, and the honest route past 60 percent

Advisory note for the user's answers, 2026-10-04. Follow-up to
`GOLD_WEIGHTING_OPTIMUM_AND_FACTOR_GAPS_20261004.md` (filed as `-057`, corrected as `-058`).
Read-only: no live system, collector, builder, weight, register entry, dashboard file, assignment or
other worker was touched, no credentials were used, and the sealed window was not read. Every figure
below was computed this turn from artifacts already on disk; the commands are in section 7.

**The short answer.** The user is right that the data should all be there. Four of the ten declared
factors are dark, and only two of them are dark because the reading itself does not exist:

- **Two have no producer at all.** The inflation signal is hardcoded to NEUTRAL in the rule engine,
  and safe-haven has no field to read - neither is collected live, and neither exists in the
  historical snapshot, so no archive can ever score them.
- **One has a live producer that the historical rebuild throws away.** Fed bias is a real column in
  the live snapshot (145 of 147 recent snapshots carry it) but the historical builder writes `null`
  for it, so the archive is blind to it by construction.
- **One has its data present and is still dark on a word.** Liquidity/growth is fed from the
  snapshot, but the builder writes "contracting" and "expanding" while the rule engine searches for
  "contraction" and "expansion". Neither string contains the other, so the factor returns NEUTRAL no
  matter what the data says. The same factor's implemented sign also disagrees with the document.

Alongside those, five defects no weighting can repair: the dollar threshold is declared 0.30 percent
but implemented at 0.15 percent; gold's own "rising strongly" is implemented as an invented 0.3
percent; the growth rule's sign is inverted against the document; the VIX rule faithfully implements
the document but is calibrated to crisis-driven gold, so on this sample it is wrong about 60 percent
of the time; and two different 100-point weight vectors sit in the tree.

On the 60 percent target, the arithmetic is the important part, and it is in section 5. In this
sample, saying "up" every day already scores **60.63 percent** of non-flat days, so 60 percent is not
a win here. A 10-point edge needs about **196 independent days** to prove at 80 percent power; a
5-point edge needs about **784**; the live record is 47.65 percent on the designated session. The
local archive holds 905 distinct US release days (656 with both an actual and a consensus, 165 of
them high-impact), which is *nearly* enough to prove a 10-point event-day effect and nowhere near
enough to prove a 5-point one.

## 1. The user's five answers, recorded

| Question | Answer (2026-10-04) | What it changes here |
| --- | --- | --- |
| 1. Leave the weights alone for now? | **Yes**, and keep working until a genuine statistical edge better than 60 percent is found | No reweighting anywhere; the deliverable becomes an edge, not a vector |
| 2. Why are factors missing - all data needs to be there? | **Yes**, all data must be present | Sections 2 to 4: per-factor root cause and the exact missing fields |
| 3. Ask the owning worker to rebuild the history with an availability lag? | **Okay** | Section 6 item 4: the bounded job is filed as a request |
| 4. Event-day study on data already held? | **Okay** | Section 5: the feasibility arithmetic and the census |
| 5. Wait for the sealed window in March 2027? | **No** - solve it now | Section 6: everything recommended is doable now; the seal is not a dependency |

## 2. Why each silent factor is silent, at the line of code

The rule engine is `backtester/replay/gold/gold_replay_core.js` (14,794 bytes, sha256
`c5806d5d6516ad72`); the historical snapshot builder is
`backtester/builders/gold/build_gold_historical_snapshots.js` (18,584 bytes, sha256
`df4cd99c97732992`); the snapshot store evidence is
`backtester/tmp/gold-stored-20260906/snapshot-inputs.json` (139,868 bytes, sha256 `e5566d0d72538d04`,
147 live snapshots).

| Factor | Weight | What the archive shows | Root cause, with the line | Class |
| --- | ---: | --- | --- | --- |
| F3 Fed bias | 14 | Neutral on every day of the rebuilt archive | Builder writes `fed_bias: null` (`build_gold_historical_snapshots.js:285-287`); the engine reads a blank as "Missing input" (`gold_replay_core.js:106-108`). The live collector *does* produce it: 145 of 147 snapshots carry a value (132 neutral, 12 hawkish, 1 dovish) | Thrown away in reconstruction, not missing |
| F8 Inflation signal | 6 | Never scored at all | Hardcoded: `makeFactor("NEUTRAL", ..., "Collector does not currently provide a top-level inflation_signal column")` (`gold_replay_core.js:178-183`); the field is absent from all 147 live snapshots and from all 801 rows of `snapshot-history.json` | No producer anywhere |
| F9 Safe haven | 6 | Never scored at all | Reads `risk_headline_context` or `geopolitical_risk_flag === true` (`gold_replay_core.js:72-73, 185-195`); `risk_headline_context` is absent from every snapshot, `geopolitical_risk_flag` is `null` on 143 of 147 and `false` on the other 4, and the builder writes it `null` too (`:294`) | No producer, though 5,115 event rows are on disk to classify |
| F10 Liquidity/growth | 2 | Never fires even where the data exists | Builder emits `"expanding" / "contracting" / "neutral"` (`:290-293`); the engine matches `"weakening"/"contraction"` and `"supportive"/"expansion"` (`gold_replay_core.js:197-204`). `"contracting".includes("contraction")` is **false** and `"expanding".includes("expansion")` is **false**, so both legs fall through to NEUTRAL | Wiring: vocabulary mismatch |

The F10 proof is mechanical, not interpretive:

```text
value            source                engine verdict
expanding        historical builder    NEUTRAL     <- should be BEARISH (or BULLISH per code)
contracting      historical builder    NEUTRAL     <- should be BULLISH per code
growth_weakening live collector        BULLISH     <- live vocabulary happens to match
liquidity_expansion live collector      BEARISH     <- live vocabulary happens to match
```

So the live path speaks twice in 147 days (both times through the collector's own vocabulary,
`growth_weakening` / `liquidity_expansion`) and the *rebuilt* path - the one every backtest uses -
can never speak at all. This also explains the apparent contradiction recorded in `-057`: F10 is
"never scored" in the archive and yet the factor exists and has data. It is the same factor, wired
twice, with two different vocabularies.

## 3. Five defects a weighting cannot repair

All five are declaration-versus-implementation disagreements, each cheap to fix and each invisible
to any reweighting, because no weight applied to a wrong or dead rule can make it right.

1. **F2's threshold is half the declared one.** The document says "DXY rising >0.30% = BEARISH";
   the engine uses `>= 0.15` (`gold_replay_core.js:96-100`). The factor therefore fires about twice
   as often, on moves the document calls neutral. The dollar factor is the one carrying the
   archive's whole apparent edge, so its threshold is exactly where precision matters most.
2. **F10's sign is inverted against the document.** Declared: "Liquidity expansion = BULLISH;
   liquidity contraction = BEARISH". Implemented (`:197-204`): weakening or contraction = BULLISH,
   expansion = BEARISH - the opposite on both legs.
3. **F5's threshold is invented.** The document says only "gold rising strongly / falling strongly";
   the engine supplies `+/-0.3%` (`:135-141`). This is the project's own pattern of an
   "assumption the document does not contain" being implemented silently, and F5 measures 50.74
   percent, i.e. nothing.
4. **Two different 100-point weight vectors are in the tree.** The logic document declares
   22/18/14/8/8/10/6/6/6/2. The rule engine (`gold_replay_core.js:9-20`) and the factor lab
   (`backtester/lib/factor_edge_lab.js:142-153`) both use 26/22/12/10/10/8/8/2/1/1. Both sum to
   100, so neither looks broken, and no document states which one the live call uses. Until that is
   settled there is no single "current weighting" for anyone to leave alone or to judge.
5. **F6's rule is regime-specific, and this sample is the other regime.** Declared and implemented
   identically (`gold_replay_core.js:148-154`): VIX above 25 = BULLISH, VIX below 16 = BEARISH. The
   engine matches the document, so this is not a wiring bug - it is a rule calibrated to
   crisis-driven gold. Gold rose through 2024-2026 while VIX sat mostly below 16, so the factor
   called gold bearish and was right 39.71 percent of the time on its 204 non-flat days (39.1 /
   42.4 / 30.0 by year). No weight repairs a rule on the wrong side of the regime; either re-derive
   it as a change or interaction, or set its weight to zero until it is re-derived.

## 4. "All data must be there": the exact fields, and where each one comes from

| Missing thing | Factor | Producer today | What must exist | Where the data comes from | Cost |
| --- | --- | --- | --- | --- | --- |
| `fed_bias` in history | F3 | live collector writes it (132 neutral / 12 hawkish / 1 dovish of 147 snapshots); the historical builder writes `null` | one declared historical derivation, run by the builder, so the archive can score the factor | local: US 2Y, 10Y nominal and real yields, plus the FOMC rows already in the event archive | code only |
| `inflation_signal` | F8 | none - hardcoded NEUTRAL stub | a declared rule and a field to hold it | local: CPI 179 usable releases plus PCE and PPI rows in the same archive (actual versus consensus); optional breakevens (`T10YIE`/`T5YIFR`) if a licence-free FRED series is acceptable | code, plus one small series |
| `risk_headline_context` (or a real `geopolitical_risk_flag`) | F9 | none, on any path | one declared classifier over event names | local: 5,115 event rows with names and a HIGH/MEDIUM importance field; VIX is local too | code only |
| One growth vocabulary | F10 | builder says `expanding`/`contracting`; collector says `growth_weakening`/`liquidity_expansion`; the engine matches only the second | one canonical vocabulary plus the agreed sign, used by both producers | none | code only |
| `equities_regime` | F10 input | builder derives it from VIX; live snapshots never carry the field | the same canonical wiring as above | local | code only |
| One declared weight vector | all | two different 100-point vectors in the tree | a statement of which one the live call uses | none | code only |
| A fast, gold-specific reading - official-sector buying, ETF tonnage, CFTC positioning, physical premiums, global dollar liquidity | new factors | none | a data-acquisition decision | external (WGC/IMF, fund filings, CFTC, exchange data); listed in `-057` section 8 | acquisition |

Six of those seven rows need no new data at all. The four silent factors are silent because nobody
wired or reconstructed them, not because the readings are unavailable - which is the user's point
exactly, and the cheapest part of this whole programme.

## 5. The route past 60 percent, with the arithmetic

### 5a. Sixty percent is not the win it sounds like

In the 608-call artifact, gold rose on **60.63 percent of non-flat days**, so in that sample "always
say up" already scores about 61 percent. The live record is 47.65 percent on the designated session
(2,493 calls) and 54.39 percent on the next-24-hour panel (3,920 calls). A model that reaches 60
percent in a rising window is therefore still losing to the drift; the honest target is 60 percent
*with the down days captured*, which is an edge over the best constant answer on the same days.

### 5b. How many days a directional claim needs

Same method the `-057` note already used (50 percent baseline, 80 percent power, two-sided 5 percent):

| True edge worth proving | Independent days needed |
| ---: | ---: |
| 1pp | about 19,600 |
| 2pp | about 4,900 |
| 3pp | about 2,178 |
| 5pp | about 784 |
| 10pp | about 196 |

For scale: the 608 stored calls carry 563 usable windows, which is why the project's own detectable
floor is 5.9pp. Daily macro effects in this project are 0-3pp wide, so no daily-data reweighting
decision can ever be evidenced.

### 5c. What the local event archive can actually support

Census of `backtester/tmp/gold-calendar-extended-20260918/events.json` (3,455,350 bytes, sha256
`eb23079944e1c5a6`): 5,115 rows from 2022-12-01 to 2026-09-11, every row carries a release time,
2,370 rows carry both an actual and a consensus.

| Event family | Rows | Usable (actual + consensus) | Distinct release days |
| --- | ---: | ---: | ---: |
| ISM | 368 | 198 | 92 |
| Initial Jobless Claims | 225 | 191 | 192 |
| FOMC | 199 | 80 | 121 |
| CPI | 185 | 179 | 45 |
| PPI | 163 | 159 | 45 |
| Retail sales | 135 | 103 | 45 |
| Non-farm payrolls | 81 | 74 | 79 |
| Unemployment rate | 45 | 45 | 45 |
| Everything else | 3,714 | 1,341 | 853 |
| **Union of all release days** | **5,115** | **2,370** | **905** distinct, **656** usable, 303 high-impact of which **165** usable |

Release clock (UTC): 12:00Z 1,377 rows, 13:00Z 1,041, 14:00Z 948, 15:00Z 496 - most releases sit on
or just after an hourly boundary, which is what a 1-hour or 4-hour post-event window needs.

### 5d. What that means, plainly

1. **A large event effect is provable now.** 656 usable release days is well past the 196 a 10pp
   claim needs, and even the 165 usable high-impact days fall only slightly short of it. A 5pp event
   effect is *not* provable on this archive (656 is below 784) however it is sliced.
2. **Horizons do not multiply the sample.** The 1h, 4h and 24h windows after the same release are
   one observation, not three, and the project's own coverage audit still records alignment as
   pending for the 13:30Z and 15:00Z releases. The independent count is the number of release days.
3. **One lead already exists and is the right shape.** Initial Jobless Claims below consensus, then
   bullish gold: 43/58 training, 12/16 validation (75 percent, Wilson 95 percent about 50.5-89.8),
   i.e. a hint that cannot yet be separated from luck, on 21 matched validation days.
4. **The 2026 validation interval is consumed** by the September search, in the project's own words,
   so a new claim must not reuse it. Two honest ways forward, both available now: a declared
   walk-forward over the 656 usable release days with a *capped* hypothesis count (one family, one
   rule, one threshold, declared before the run) can prove a 10pp-or-bigger effect on data already
   held; and a prospective paper record started now accumulates roughly 50 weekly claims days a
   year, so it is a slow but clean complement. Neither waits for March 2027.
5. **The durable edge is in data the model does not hold.** Official-sector buying, ETF tonnage,
   CFTC positioning, physical premia and dollar liquidity are what can make a daily call better than
   the drift. Fixing the five defects and wiring the three missing producers makes the model
   *testable*; buying the fast data is what makes it likely to *win*. The first is free and can start
   this week.

## 6. Recommendations

1. **Fix the five defects first** - code only, no new data, no live-logic change: F10's vocabulary
   and sign, F2's threshold to the declared 0.30 percent, F5's threshold declared or removed, one
   canonical weight vector, and F6 re-derived or zeroed. Add a build guard that fails when the
   builder's vocabulary and the engine's matcher disagree, so this class of bug cannot recur.
2. **Wire the three missing producers from data already on disk**: `inflation_signal` (CPI/PCE/PPI
   actual-versus-consensus from the 5,115-row archive), `risk_headline_context` (a declared name
   classifier plus VIX - the F9 rebuild already approved as answer 32), and a declared historical
   `fed_bias`. Then re-run the archive and see whether the four dark factors carry anything.
3. **Accept the arithmetic**: prove only large effects on local event data. Declare one family, one
   rule, one threshold and a holdout before the run; treat 10pp-or-bigger candidates as provable and
   stop treating 1-3pp as measurable on daily data.
4. **File the availability-lag rebuild** as a bounded job for the gold worker (approved as answer
   3): the same snapshots, with each input the last value actually available at decision time, then
   re-run the same six factors. If the dollar factor collapses there, this artifact is retired for
   calibration purposes.
5. **Do not reweight.** The user's instruction stands, and `-057` shows why: the only in-sample
   optimum is the timing artifact.
6. **Buy the fast data next** (positioning, flows, official sector, physical premia). That is where a
   durable edge over the drift plausibly lives.

## 7. Limits, provenance and reproduction

Limits. The 24-hour window used throughout is the artifact's legacy definition, not a tradeable fill,
and no entry, stop, spread, slippage or sizing is modelled - nothing here speaks about money. The
defect findings are code-level and verifiable by reading the lines cited; the census is from the local
archive only, and a release is not an independent market event. Observations are dependent across
overlapping windows, so every interval quoted is the optimistic version. The database-backed snapshot
build is still not readable in this checkout, so the owning worker should confirm the builder-side
findings. Nothing here is a claim of accuracy, prediction or edge, and no weight, live file or other
worker's work was touched.

Artifacts read this turn (size in bytes, sha256 first 16 hex characters):

| Artifact | Size | sha256 (16) |
| --- | ---: | --- |
| `logic/agent_gold_direction.md` | 7,794 | `fd6e2aac6915c7f0` |
| `backtester/replay/gold/gold_replay_core.js` | 14,794 | `c5806d5d6516ad72` |
| `backtester/builders/gold/build_gold_historical_snapshots.js` | 18,584 | `df4cd99c97732992` |
| `backtester/lib/factor_edge_lab.js` | 22,558 | `2488990fb71335f4` |
| `backtester/lib/gold_snapshot_mapping.js` | 4,253 | `05b945c6d4c8bcd6` |
| `backtester/registries/gold_variable_horizon_context.v1.json` | 55,438 | `4075f110ee29cc38` |
| `backtester/tmp/gold-calendar-extended-20260918/events.json` | 3,455,350 | `eb23079944e1c5a6` |
| `backtester/tmp/gold-stored-20260906/snapshot-inputs.json` | 139,868 | `e5566d0d72538d04` |
| `backtester/tmp/gold-hourly-extended-20260918/candles.json` | 6,047,843 | `20ff2299f8c8d422` |

Reproduction (read-only, from the strategy worktree; scripts are ignored scratch under `tmp/`):

```powershell
node tmp/probe-factors.js         # section 2: what the stored snapshots actually carry per field
node tmp/probe-f10-vocabulary.js  # sections 2 and 3: the builder/engine vocabulary mismatch
node tmp/probe-events.js          # section 5c: the event-family census
node tmp/probe-event-days.js      # section 5c: distinct, usable and high-impact release days
```

Files written this turn: this document; `tmp/probe-factors.js`, `tmp/probe-f10-vocabulary.js`,
`tmp/probe-events.js`, `tmp/probe-event-days.js`; a companion entry appended to
`docs/strategy/CONVERSATION_NOTES.md`.




