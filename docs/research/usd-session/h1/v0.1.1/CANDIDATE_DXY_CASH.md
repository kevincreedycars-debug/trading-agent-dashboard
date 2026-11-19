# `USD-L1-25F-H1-v0.1.1-dxy-cash` · test 1 on the broker tape

19 November 2026 · research only · separately versioned candidate · **not** a replacement for the frozen package

`USD-L1-25F-H1-v0.1.0` is untouched: this candidate re-declares only test 1's DXY input lane, publishes it as
its own version, and states its own numbers. It differs from run-v1's `dxy_direction_broker_cfd` lane in one
respect that is a correction and not a preference: **the 05:00 London value is read from the bar that closes
at 05:00, not from the bar stamped 05:00.**

Artefact: `data/usd-layer1-backtester/h1-v1/candidate-dxy-cash.json`
Code: `lib/layer1_backtesting/h1_candidate_dxy_cash.js`
Builder: `scripts/build_h1_candidate.js`
Lineage: `H1-A01` (the `ice` source amendment) · Test ordinal 1 · `dxy_direction_broker_cfd`

## 1. Why the one-hour shift is a defect, not a convention

The exporter writes the tape's bars under their **opening** instant. That is proved on the tape itself, not
assumed: same-hour log-returns against the open-labelled OANDA EUR/USD H1 correlate at **r = −0.9698** over
9,152 hours (−0.9710 April–September, −0.9685 October–March), while every other shift (−2, −1, +1, +2) sits
at **|r| < 0.02**. A close-labelled tape would peak at shift +1 instead.

So the bar stamped `05:00` covers 05:00–06:00 and its close is only knowable at 06:00. run-v1's
`inputs.priceAtHour(series, cutoff)` returns exactly that close, which means every boundary it priced carried
a one-hour lookahead.

| Read rule | What it returns | Observable at | Status |
|---|---|---|---|
| `close_of_the_bar_ending_at_the_boundary` (shift 1) | close of the bar stamped 04:00 | the boundary itself | **adopted** |
| `close_of_the_bar_opening_at_the_boundary` (shift 0) | close of the bar stamped 05:00 | one hour after the boundary | published for reproduction only; **not admissible** |

Both lanes are scored and published. The shift-0 lane reproduces run-v1's published block field for field —
the builder **refuses to emit** the artefact if it does not (`reproduction.matches` must be `true`) — so the
difference between the two lanes is the leak and nothing else.

## 2. Published figures

Window: `2024-12-10` to the last resolved session — 480 sessions. The tape's first bar is `2024-12-10T13:00Z`,
so the lane starts where the instrument starts, not where the week starts.

| Figure | Admissible (adopted) | As published (run-v1) |
|---|---|---|
| priced sessions | 360 | 360 |
| directional (scored) | 284 | 284 |
| hits | **139** | 141 |
| misses | **145** | 143 |
| accuracy | **48.94 %** | 49.65 % |
| 95 % Wilson lower bound | **43.18 %** | 43.88 % |
| flat (move within 0.086 %) | 70 | 70 |
| no call | 7 | 7 |
| no admissible price | 119 | 119 |

The correction does **not** change how many sessions are priced or scored. It changes **which** of them are
scored, and the frozen flat band turns part of that change into `flat` rather than into the opposite verdict:

| Transition | Sessions |
|---|---|
| `flat_to_miss` | 12 |
| `miss_to_flat` | 11 |
| `hit_to_flat` | 8 |
| `flat_to_hit` | 7 |
| `hit_to_miss` | 1 |

39 of 480 sessions are reclassified and the net effect is 2 hits becoming misses. The leak is measured, not
asserted: of the 960 boundary reads the lane attempts, 823 are priced and **every one of them completes an hour
after its boundary** (`leakage.as_published.violations`), while `leakage.admissible.violations` is 0 and
`assertNoLookahead` throws rather than warns if that ever stops being true.

The flat band is **not** re-frozen on the corrected lane. It stays at 0.086 % (run-v1's 20th percentile of the
absolute move over 59 development dates) so that the comparison isolates the input rule.

## 3. Fridays: unpriced, named, and left in the population

A Friday session runs from Friday 05:00 to **Saturday 05:00** London, when the broker prints nothing. 96 of the
480 window sessions are Fridays; all 96 are unpriced and stay in the denominator as `no_outcome`.

The obvious alternative — score Friday to Friday 23:00 London, the broker's own week close — is recorded as
`friday_endpoint_proposal` and **not applied**. It answers a different question (an 18-hour window where every
other weekday uses 24), so it cannot enter the same denominator; it would need its own version, its own
re-frozen band and the same leakage proof.

## 4. DST is carried by the resolved rows, not by arithmetic

Every scheduled weekday window in this population is exactly 24 hours, because the UK change happens at 01:00
on a Sunday, inside the gap between a Friday session's Saturday 05:00 close and Monday's open. The change
therefore appears as the cutoff moving between `05:00Z` (GMT) and `04:00Z` (BST) — three transitions inside
this window — and the admissible read shifts with it (a `04:00Z` cutoff reads the `03:00Z` bar). No session is
scored by adding 24 hours to a wall clock.
## 5. Denominators, and the figure that does not reproduce

| Figure | Value | What it is |
|---|---|---|
| scheduled sessions | 725 | 145 per weekday, Mon–Fri |
| control rows with a non-flat market outcome | **675** | a *control* count: neither a price count nor any market's denominator |
| mornings with all four markets priced | 566 | |
| mornings with at least three markets priced | 568 | |
| mornings with at least one market priced | 725 | every morning priced BTC/USD |
| `four_markets.usable_sessions`, **as published** | **685** | **not reproducible** from the sessions; flagged and unusable as a denominator |
| this lane's directional denominator | 284 | taken from the DXY block itself, not re-derived |
| Friday rows in the population | 145 | BTC/USD only |

725, 675, 566 and 568 all reconcile directly from `run-v1.json`, as do the per-market denominators: EUR/USD is
priced on 570 mornings and directional on 439, XAU/USD and NAS100 on 567 each, BTC/USD on all 725, and this lane
is priced on 360 with 284 directional. **685 does not**, under any definition tried (all-four priced, at least
three priced, any outcome, control rows, ±1 day join). It is therefore carried as a published label with
`reproduces: false` rather than re-derived into a number that would look like a reconciliation. Full working:
`data/usd-layer1-backtester/h1-v1/population.json`.

## 6. Coverage is unchanged, and stays honest

This candidate scores **one input on one instrument**. It does not make any historical morning eligible for the
25-factor model: `inputs.fully_eligible_mornings` is **0** and `earliest_eligible` is `null`, because eight of
the nine amended inputs have no evidence bundle at all (`ice` supplies 455 of 725 mornings). Per-input readiness
is published separately from that figure so the two are never confused, and 675 is never substituted for a
coverage count.

## 7. Reproduction

```text
node scripts/build_h1_candidate.js            # write the artefact
node scripts/build_h1_candidate.js --check    # reproduces, exit 0
node scripts/build_h1_population.js --check   # denominators reproduce, exit 0
node --test tests/h1_population.test.js tests/h1_candidate_dxy_cash.test.js
```

The tape itself lives in the git-ignored local cache (`backtester/tmp/`); the committed `ice.json` bundle pins
its sha256, bar count and first/last bar, so a figure here can be audited against any future export.

## 8. What this candidate does not do

- It does not report this figure as test 1's official answer. `DXY.cash` is a broker spot CFD
  (`is_official_cash_dxy: false`), not the ICE cash index; the official lane stays blocked, and ICE
  procurement is dropped from this line rather than left as an open request.
- It does not edit `USD-L1-25F-H1-v0.1.0`, its hashes, its fixtures or its `RULEBOOK.md`.
- It does not fill a Friday, a missing hour or a holiday from a neighbouring bar.
- It does not change a threshold, sign, weight or trade rule, and it does not make a blocked morning scored.
- It does not resolve 685. That label stays flagged until its provenance is found.

scored by adding 24 hours to a wall clock.
