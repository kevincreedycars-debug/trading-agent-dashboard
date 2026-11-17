# USD-L1-25F-H1-v0.1.0 · registration and independent review

17 November 2026 · pre-evaluation research hypothesis · research only

This note records what was checked before the candidate was accepted into the shared Layer 1 engine, and
what remains blocked. It is the reviewer's record; the payload at
`data/usd-layer1-backtester/backtesting-screen-v1.json` and the H1 view of `backtesting.html` carry the same
figures.

## 1. Identity

| Item | Value |
|---|---|
| Candidate | `USD-L1-25F-H1-v0.1.0` |
| Committed package | `backtester/packages/USD-L1-25F-H1-v0.1.0/` |
| Package commit | `60e695bccabd9a370cc2688a1f791d07dd94720d` — "Add unpacked USD 25-factor H1 candidate and frozen verification fixtures" |
| Archive as received | `docs/research/usd-session/h1/v0.1.0/USD-L1-25F-H1-v0.1.0.zip`, sha256 `1c82e9048a3cf2237ffea6873b8099389d09fccefa083cd38ccb87517e3672e0` |
| Declared file hashes | 16 in `SHA256SUMS`; all 16 recomputed byte for byte from the committed package |
| Archive membership | the 16 extracted members match all 16 declared sums |
| Package runner | `node verify.js` from the package directory, exit code 0 |
| Rulebook sha256 | `e2e29421a95f903123d6353c8a7f7b323f418ef7392384b21bfe8b559511c80b` |
| Models sha256 | `29384c615305592389d52f76b4adc5cc662c37a0cd94b234c8389b8e9a72cba6` |
| Inputs sha256 | `144ae500af5c9d4d1f37a7be2b34b5074f8a85c89269ff699895155f2db4a77f` |

A Windows checkout with `core.autocrlf=true` rewrites every line ending, and all 16 sums then fail. The
registration commit adds `backtester/packages/** -text` and `docs/research/usd-session/h1/** -text` to
`.gitattributes`, so a checkout hands back the bytes that were hashed. That is a versioned rule change, not a
change to the candidate.

## 2. What was run

```text
cd backtester/packages/USD-L1-25F-H1-v0.1.0
node verify.js                      # exit 0: call, abstain, blocked and DST cases plus deep-equal to expected.json

node scripts/build_backtesting_screen.js        # regenerates the payload
node scripts/build_backtesting_screen.js --check
node --test tests/backtesting_screen.test.js tests/layer1_backtest_report.test.js tests/backtesting_h1.browser.test.js
```

The five supplied fixtures are reproduced through the shared engine at
`lib/layer1_backtesting/engine.js#decide`, not by a private copy: a directional call (`BULLISH`, conviction 4,
trade), the VIX-30 abstention, the blocked case with the calendar row removed, the four-input production
baseline, and the October DST session boundary. The first four compare the complete output and factor trace;
the DST case compares the resolved cutoff and endpoint only, as published.

## 3. The 25 adjudications, as the executable rule accounts for them

| Reading | Rows | What the rule does |
|---|---|---|
| Votes | 8 rows over 6 series | rates (spread + real), momentum (broad dollar + ICE), cross-market (gold + QQQ) |
| Regime gate | 3 rows, 1 input | VIX level only; at or above 30 abstains, never votes |
| Event gate | 2 rows, 1 input | release count in `[cutoff, endpoint)`; missing calendar blocks, non-empty suppresses trade only |
| Required, cannot vote | 2 rows, 1 input | the DGS2 change is admitted and never counted (`frontCounted: false`) |
| Excluded | 10 rows | no declared feed: term premium, credit, dollar smile, surprise (two rows), Fed bias, overnight range, session volatility, safe haven, and the integrity-gate row |
## 4. Findings

Recorded before acceptance. None was applied to the frozen candidate; the fixture expectations belong to
v0.1.0 and changing the rule would invalidate them.

| Id | Severity | Finding | Status |
|---|---|---|---|
| H1R-01 | assumption | The DGS2 change is required and cannot vote, so coverage is stricter than the vote set | recorded |
| H1R-02 | gap | The VIX row names level and change; only the level is read, and no VIX change is an input | recorded |
| H1R-03 | defect | ICE has a maximum age of zero hours while the engine also requires receipt by the cutoff; together they force observed = published = received = the cutoff instant, so no live morning can pass. The fixture passes only because it stamps all three clocks at 05:00 | recorded |
| H1R-04 | gap | Two calendar rows share one input; F23 distance is declared but not implemented | recorded |
| H1R-05 | assumption | No fallback for an indispensable missing input, by design | accepted |
| H1R-06 | presentation | The trace carries `votes.front` although no family reads it; a reader can double count the US leg | recorded |
| H1R-07 | assumption | The 5 bp, 0.30%, 0.15% and 1% thresholds are unvalidated noise filters | accepted |
| H1R-08 | assumption | Eight rows cast six votes; the row count is not the signal count | accepted |
| H1R-09 | presentation | The trace has 25 entries over nine measurements; ten rows carry a null value | accepted |
| H1R-10 | gap | The staged calendar holds FOMC statements only, so a zero count cannot prove no omission | recorded |

Proposed for v0.1.1 (not applied): give ICE a non-zero age and read the previous eligible fixing; add or
retitle the VIX change; implement or retire F23; rename the reported-only front vote. H1R-03 is the one that
prevents any sealed live proof.

## 5. Historical coverage

The audit reads the nine declared inputs against every one of the 725 scheduled mornings.

- 0 ready, 725 blocked, earliest eligible morning: none established.
- Every input is blocked on every morning: present is not eligible, because no morning carries an original
  observation, a five-interval lookback, freshness and the observed / published / received clocks.
- Two legacy fields fail on identity before any clock is considered: the gold return is an OANDA XAU/USD
  quote rather than the LBMA PM auction, and the equity return is the Nasdaq-100 index rather than the QQQ
  close.
- The event calendar is incomplete: FOMC statements are staged; CPI, Employment Situation, advance GDP and
  Personal Income and Outlays are absent.
- No collector receipt exists anywhere in the archive. Official publication times can be reconstructed;
  recipient receipt cannot.

Each gap in the payload names the dataset and source, the factors it blocks, the affected mornings, the
missing evidence, what to obtain and the file each record must be imported into
(`data/usd-layer1-backtester/h1-v1/<input>.json`, with observed / published / received clocks and the
original operands).

## 6. Saved decisions and the fairness audit

Every morning's H1 decision is saved once, keyed `usd_l1_25f_h1@<date>`, with the session snapshot hash, the
model version and the rulebook digest (`screen.h1.historical.ledger`). Tests reference those ids; none
re-derives a decision.

| Check | Result |
|---|---|
| Missing required data | caught: the first blocked morning names every failed input |
| Wrong model version | caught: the audit reports the mismatch and the ledger refuses the overwrite |
| Wrong saved decision | caught: a row naming another morning's id fails the date check even though the id exists |
| Clean record | passes, so the audit is not failing everything |
| Reconciliation | 725 scheduled = 725 saved = 725 blocked + 0 abstained + 0 directional |

## 7. The four tests, and what is separate

| Test | Benchmark | Readiness |
|---|---|---|
| 1 · USD direction | broker DXY.cash, one candle per 05:00 boundary | scored on the legacy reconstructed set, labelled a proxy; 0 H1 mornings |
| 2 · USD-only opposite mapping | EUR/USD, XAU/USD, BTC/USD, NAS100, each with its own denominator | scored market by market on the legacy set; 0 H1 mornings |
| 3 · original levels, frozen 5R | M5 bid/ask tape and the archived level ladder | blocked on history: no tape, no ladder |
| 4 · levels plus midpoints, frozen 3R | same evidence plus midpoint geometry | blocked on history |

Sealed live replay is a separate status and is empty: 0 H1 sealed decisions have been supplied or replayed.
Synthetic acceptance cases do not enter that count, and no sealed receipt exists for any morning.

The evaluation contract is frozen before scoring (`screen.h1.scoring_contract`, digest recorded): eligible
dates, the four benchmarks, entry and management rules, costs, 1 per cent sizing on GBP 100,000, the 60%
directional target, a lower bound with every accuracy figure, per-model coverage disclosure, and comparison
only on common eligible dates. Combining two independent Layer 1 calls remains a separate future test.

## 8. Preview and navigation

```text
npm run preview:backtesting          # http://127.0.0.1:4173
```

Path: **Dashboard → Backtesting** (`backtesting.html`), then the **H1** tab. The page opens on Overview, which
shows the two selected models, the session, the date range, strict ready / blocked counts, the largest data
gap and the next action. The Architecture tab carries the interactive 3D map: Research → Rulebook → Supplied
candidate package → 25 adjudications → Factor combination → Datasets → Supabase / n8n → Validation → the four
tests plus the supplementary official-ICE entry. Clicking a node opens its status, detail and dated evidence.
The H1 tab opens the coverage audit, the blocked-morning inspector, the fixture replay, the package identity,
the 25-row review, the saved decisions and audit, the missing-data register and the frozen contract.


Shared-evidence treatment: eleven rows read five inputs. `vix` is read by three rows and casts no vote;
`spread` and `real` are each read twice and cast one vote each; `front` is read twice and casts none;
`calendar` is read twice and gates once. Six votes in three equal-weight families is the whole arithmetic.
