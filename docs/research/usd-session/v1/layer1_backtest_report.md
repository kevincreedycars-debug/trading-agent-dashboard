# Layer 1 backtesting: first evidence report

Schema `layer1-backtest-report.v1`, research only, generated from the stored artefacts on `2026-11-14T00:00:00.000Z`.

> One engine now takes both models over the same 725 mornings. No morning is valid for the intended model, the only scored directional test is a broker proxy and sits at a coin flip, and the published artefacts flag more trades than they allow.

Every figure below is built by `lib/layer1_backtesting/` from the artefacts named in the provenance block;
none is typed in by hand. A figure that could not be derived is printed as a dash, never filled in.

## 1. Scope

| Item | Value |
| --- | --- |
| Sessions replayed | 725 |
| First morning | 2024-01-02 |
| Last morning | 2026-10-12 |
| Session window | 05:00 Europe/London, window ends 05:00 the next local day |
| Gate counts (published) | {"valid_directional":450,"valid_no_call":167,"insufficient_data":108,"undefined_rule":0} |
| Gate note | presence and freshness only: these are the calls a data-completeness gate accepts, and they are what the published provisional numbers rest on; they are not calls on the research's inputs |
| Research gate | {"accepted":0,"note":"presence, freshness, a verified clock and the named instrument: no replayed morning passes all four rungs, so the strict gate accepts no call and no accuracy denominator survives unqualified"} |

## 2. The engine and the two models

Both models are declarations read by one engine (`lib/layer1_backtesting/engine.js`); the engine owns the
session contract, the gate, the ordered check chain, the outcome and the policy arithmetic. A model supplies
the declarations and nothing else, so the two rows below differ only where the declarations differ.

| Model | Role | Version | Rulebook | Identity | Gate basis |
| --- | --- | --- | --- | --- | --- |
| Production control (current USD model, replayed) (`usd_control_v1`) | control | agent_usd_direction.md (production baseline, replayed by backtester/replay/usd/usd_replay_core.js) | agent_usd_direction.md | PROVISIONAL_BASELINE | presence and freshness (declared narrow gate) |
| Legacy USD 25-factor book v1.0.0 (usd_candidate_25f_v1, not H1) (`usd_candidate_25f_v1`) | candidate | usd-l1-factor-rulebook-v1.0.0 / usd-l1-decision-rules-v1.0.0 | usd-l1-factor-rulebook-v1.0.0 | CONFIG_BLOCKED | the book's own six checks (E1-E4 block, E5-E6 abstain) |

### control: check chain

| Check | Name | On fail |
| --- | --- | --- |
| C1 | session contract: a 24-hour window that closes at the next 05:00 London | block |
| C2 | snapshot: at least one model input was present at the cutoff | block |
| C3 | no future print: every input was printed at or before the cutoff | block |
| C4 | version stamped: the decision names the model and rulebook it came from | block |

### candidate: check chain

| Check | Name | On fail |
| --- | --- | --- |
| E1 | cutoff: the session is the 05:00-London window and no reading is stamped after its cutoff | block |
| E2 | gate: the RG-4 volatility gate is defined and open at the cutoff | block |
| E3 | provenance: every vote belongs to exactly one direction row that may vote this morning | block |
| E4 | coverage: enough of the book is readable for the decision file's eligibility rule | block |
| E5 | call: the family vote leaves the 0.20 deadband and nets away from zero | abstain |
| E6 | trade: the provisional trade rule is met (event family readable, all twelve signals usable) | abstain |

## 3. Decisions

Every record below was produced by the engine on the stored morning, then reconciled against the side of the
published artefact that describes that model: the control against `sessions[].models.current`, the candidate
against `engine-v1.json morning_states[]`. A field the artefact never published is counted as `not_published`
and excluded from the comparison, so a model is never marked wrong for a figure it never claimed.

| Model | Sessions | Allowed | Abstained | Blocked | Trade eligible | Directional | By direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| control | 725 | 617 | 0 | 108 | 194 | 609 | {"NO_CALL":116,"BULLISH":241,"BEARISH":368} |
| candidate | 725 | 41 | 143 | 541 | 41 | 121 | {"NO_CALL":604,"BULLISH":54,"BEARISH":67} |

### Reconciliation

| Model | Match | Engine stricter | Mismatch | Not published |
| --- | --- | --- | --- | --- |
| control | 1237 | 213 | 0 | 1450 |
| candidate | 2729 | 171 | 0 | 0 |

Totals: fields_compared: 4350; match: 3966; engine_stricter: 384; mismatch: 0; not_published: 1450; decisions_with_a_mismatch: 0.

- `engine_stricter` is expected: the engine refuses to publish a direction, a band or a trade flag on a blocked morning, and the published artefacts keep whatever the book computed before it blocked.
- A `mismatch` is not expected and is listed in full; there is no tolerance on a mismatch and none is applied here.

Worked blocked morning (2024-01-02): outcome `blocked`, reasons E2 (check), E4 (check), E5 (check).

Worked abstention (2024-02-06): outcome `abstained`, direction BULLISH, band 2, reasons E6 (check), trade_rule_not_met (policy).

## 4. Findings

### F1

No replayed morning passes the research gate: presence and freshness are mostly there, but no morning carries a verified 05:00 receipt or a named instrument.

Numbers:

- present: 618
- fresh: 617
- clocked: 0
- identified: 0
- sessions: 725

Evidence:

- `data/usd-layer1-backtester/run-v1.json` → validity_gate.ladder

### F2

The intended 25-factor model has no defined rule on any morning, so every candidate figure in this report comes from the implemented book and is not a valid call for the intended model.

Numbers:

- undefined_rule_mornings: 725
- sessions: 725

Evidence:

- `data/usd-layer1-backtester/run-v1.json` → validity_gate.days[].intended
- `data/usd-layer1-backtester/engine-v1.json` → book_detail.version

### F3

The published artefacts flag more trades than the mornings they allow: a trade flag survives on mornings the book itself marks blocked.

Numbers:

- published: 62
- on_allowed_mornings: 41
- on_blocked_mornings: 21
- allowed_mornings: 41
- blocked_mornings_with_a_direction: 75

Evidence:

- `data/usd-layer1-backtester/engine-v1.json` → morning_states[].trade
- `data/usd-layer1-backtester/engine-v1.json` → morning_states[].outcome

### F4

The candidate calls on far fewer mornings than the control, and on fewer than the artefact's own coverage table claims, so its accuracy is not comparable to the control's without printing coverage beside both.

Numbers:

- published.control_calls: 714
- published.control_pct: 98.48
- published.candidate_calls: 515
- published.candidate_pct: 71.03
- published.source: run-v1.json coverage.by_model (current, challenger_v1)
- engine.control_directional: 609
- engine.control_pct: 84
- engine.candidate_directional: 121
- engine.candidate_pct: 16.69
- common_directional_mornings: 510
- note: The published coverage table and the engine's own call counts are different measures: the table counts reconstructed book calls, the engine counts calls that survive the declared gate. They are printed side by side and not merged.

Evidence:

- `data/usd-layer1-backtester/run-v1.json` → coverage.by_model
- `data/usd-layer1-backtester/run-v1.json` → sessions[].models.current.direction

### F5

The one directional test with a denominator is scored on a broker proxy, and both models land near a coin flip: neither lower confidence bound clears 50%.

Numbers:

- usable_sessions: 360
- control.scored: 284
- control.accuracy_pct: 49.65
- control.lower_bound_pct: 43.88
- candidate.scored: 209
- candidate.accuracy_pct: 43.54
- candidate.lower_bound_pct: 37

Evidence:

- `data/usd-layer1-backtester/run-v1.json` → tests.dxy_direction_broker_cfd

### F6

The official-index test has never been scored because the official series is not in the checkout, and the layer-2 path test has no usable history: its only evidence is a worked demonstration.

Numbers:

- official_usable_sessions: —
- layer2_usable_sessions: 0
- layer2_demonstration_fills: 16

Evidence:

- `data/usd-layer1-backtester/run-v1.json` → tests.dxy_direction
- `data/usd-layer1-backtester/run-v1.json` → tests.l2l_full_5r

### F7

Four-market confirmation is published market by market, never as one aggregate: 1 of 8 market/model cells clear it (XAUUSD/control at 55.68% with a lower bound of 51.1%), and of the 4 candidate cells, 0 clear it.

Numbers:

- per_market.EURUSD.control.scored: 439
- per_market.EURUSD.control.accuracy_pct: 49.43
- per_market.EURUSD.control.lower_bound_pct: 44.78
- per_market.EURUSD.candidate.scored: 322
- per_market.EURUSD.candidate.accuracy_pct: 48.14
- per_market.EURUSD.candidate.lower_bound_pct: 42.73
- per_market.XAUUSD.control.scored: 458
- per_market.XAUUSD.control.accuracy_pct: 55.68
- per_market.XAUUSD.control.lower_bound_pct: 51.1
- per_market.XAUUSD.candidate.scored: 344
- per_market.XAUUSD.candidate.accuracy_pct: 51.16
- per_market.XAUUSD.candidate.lower_bound_pct: 45.9
- per_market.BTCUSD.control.scored: 536
- per_market.BTCUSD.control.accuracy_pct: 50
- per_market.BTCUSD.control.lower_bound_pct: 45.78
- per_market.BTCUSD.candidate.scored: 385
- per_market.BTCUSD.candidate.accuracy_pct: 48.57
- per_market.BTCUSD.candidate.lower_bound_pct: 43.62
- per_market.NAS100.control.scored: 454
- per_market.NAS100.control.accuracy_pct: 52.86
- per_market.NAS100.control.lower_bound_pct: 48.27
- per_market.NAS100.candidate.scored: 331
- per_market.NAS100.candidate.accuracy_pct: 51.96
- per_market.NAS100.candidate.lower_bound_pct: 46.59
- cells: 8
- cells_with_lower_bound_at_or_above_50: XAUUSD/control
- best_point_accuracy.market: XAUUSD
- best_point_accuracy.label: control
- best_point_accuracy.accuracy_pct: 55.68
- best_point_accuracy.lower_bound_pct: 51.1

Evidence:

- `data/usd-layer1-backtester/run-v1.json` → tests.four_markets.models[].markets

## 5. Readiness

Readiness is whether the declared inputs were present, fresh, clocked and named at the cutoff. It is not the
model's opinion. A blocked morning is a gap in the evidence; an abstention is a book that had the evidence and
declined to call. The two are never merged, here or anywhere above.

| Rung | Passing | Sessions | Meaning |
| --- | --- | --- | --- |
| present | 618 | 725 | the field exists on the morning |
| fresh | 617 | 725 | the print is inside the freshness its release allows |
| clocked | 0 | 725 | a receipt proves the value was in hand at 05:00 |
| identified | 0 | 725 | the print names the instrument and the source |

| Model | Ready | Blocked | Gate | Note |
| --- | --- | --- | --- | --- |
| control | 617 | 108 | presence and freshness | the narrow gate the published provisional numbers rest on |
| candidate | 0 | 725 | present + fresh + clocked + identified | the strict gate the research requires; no morning passes it |

Candidate readiness codes:

- undefined_rule: 725 mornings

Missing inputs, counted across mornings:

| Field | Mornings | Factors that read it |
| --- | --- | --- |
| us_2y_d5_bps | 64 | live.f2-us-2y-delta |
| us_10y_real_d5_bps | 64 | live.f4-real-yield-delta, rates.real-yield-delta |
| broad_dollar_d5_pct | 35 | live.f5-dxy-delta |
| eurusd_d5_pct | 35 | fx.usd-session-momentum |
| usdjpy_d5_pct | 35 | fx.usd-session-momentum |
| gold_d5_pct | 21 | live.f6-gold-delta |
| nasdaq100_d5_pct | 21 | live.f10-equity-versus-usd |
| vix_d5_chg | 18 | live.f1-vix-level, risk.vix-level-and-change-at-cutoff, live.f9-dollar-smile |
| vix_level | 8 | live.f1-vix-level, risk.vix-level-and-change-at-cutoff, live.f9-dollar-smile, risk.risk-on-off-cross-asset-state, data.quality-gate-for-abstention |

### Worked blocked morning: 2024-01-02

Status `blocked` (undefined_rule): the intended 25-factor model has no defined rule on this morning, so no reading can make it valid

Engine outcome: `blocked`; blocking checks: E2, E4.

Rungs: {"present":false,"fresh":true,"clocked":false,"identified":false}.

Missing fields: vix_level, vix_d5_chg, us_2y_d5_bps, us_10y_real_d5_bps, broad_dollar_d5_pct, gold_d5_pct, nasdaq100_d5_pct, eurusd_d5_pct, usdjpy_d5_pct.

- The morning is blocked because the value the model would have read was not in hand at the cutoff, not because the model disliked the answer.
- The nine saved inputs are all the as-of frame carried; the rest of the required set is absent from the archive entirely.
- Closing the gap needs the prints listed against each field, dated before the cutoff, with a receipt that proves the 05:00 arrival.

### Contrast: an abstention on 2024-02-06

Direction BULLISH, band 2 (Weak), trade flag no; checks {"E1":true,"E2":true,"E3":true,"E4":true,"E5":true,"E6":false}.

Control readiness on the same morning: `ready`.

Every blocking check passed and the book still did not trade: the vote was directional but the band sat under the trade floor. This is an abstention, not a blocked morning, and it counts as evidence rather than as a gap.

## 6. The four tests

One question, one denominator, one exclusion list and one measure per model. Every measure prints its
coverage beside it, because a candidate that called on far fewer mornings is not comparable to one that called
on nearly all of them.

| # | Test | Type | Status | Usable | Available |
| --- | --- | --- | --- | --- | --- |
| 1 | USD direction on the broker DXY.cash series | historical_coverage | scored on a broker proxy series, not on the official index | 360 | 725 |
| 2 | USD-only opposite-direction mapping in four markets | historical_coverage | scored market by market; no cross-market aggregate is published or reported | 685 | 725 |
| 3 | Original Layer 2 levels with the frozen 5R rules | historical_coverage | blocked on history: the simulation is implemented and unit-tested, but no 5-minute tape or level ladder exists | 0 | 725 |
| 4 | Original levels plus midpoints with the frozen 3R rules | historical_coverage | blocked on history: the simulation is implemented and unit-tested, but no 5-minute tape or level ladder exists | 0 | 725 |

### 1. USD direction on the broker DXY.cash series

Type: historical_coverage. Outcome source: broker DXY.cash one-hour candles. Status: scored on a broker proxy series, not on the official index.

Question: On mornings where the model made a directional call, did the broker's DXY.cash series close the 05:00-to-05:00 window in that direction, using one candle per 05:00 boundary?

Usable sessions: 360 of 725.

| Model | Denominator | Scored | Exclusions |
| --- | --- | --- | --- |
| control | mornings with a directional call, a readable outcome and a move outside the flat band | 284 | flat window inside the flat band: 70; the model made no call: 7; no readable outcome: 119 |
| candidate | mornings with a directional call, a readable outcome and a move outside the flat band | 209 | flat window inside the flat band: 47; the model made no call: 145; no readable outcome: 79 |

| Model | Scored | Hits | Misses | Flat | Accuracy | Lower bound |
| --- | --- | --- | --- | --- | --- | --- |
| control | 284 | 141 | 143 | 70 | 49.65% | 43.88% |
| candidate | 209 | 91 | 118 | 47 | 43.54% | 37% |

- This is the agreed test 1. The broker series is a proxy for the official index and is labelled as a proxy everywhere it appears.
- A flat window inside the flat band is excluded from the accuracy denominator and counted separately.

### 2. USD-only opposite-direction mapping in four markets

Type: historical_coverage. Outcome source: OANDA one-hour closes per market. Status: scored market by market; no cross-market aggregate is published or reported.

Question: Did the same USD call point the right way in EUR/USD, gold, bitcoin and the NAS100 over the same window?

Usable sessions: 685 of 725.

Market EURUSD:

| Model | Scored | Hits | Misses | Accuracy | Lower bound | Exclusions |
| --- | --- | --- | --- | --- | --- | --- |
| control | 439 | 217 | 222 | 49.43% | 44.78% | flat window inside the flat band: 122; the model made no call: 11; no readable outcome: 153 |
| candidate | 322 | 155 | 167 | 48.14% | 42.73% | flat window inside the flat band: 91; the model made no call: 210; no readable outcome: 102 |

Market XAUUSD:

| Model | Scored | Hits | Misses | Accuracy | Lower bound | Exclusions |
| --- | --- | --- | --- | --- | --- | --- |
| control | 458 | 255 | 203 | 55.68% | 51.1% | flat window inside the flat band: 100; the model made no call: 11; no readable outcome: 156 |
| candidate | 344 | 176 | 168 | 51.16% | 45.9% | flat window inside the flat band: 67; the model made no call: 210; no readable outcome: 104 |

Market BTCUSD:

| Model | Scored | Hits | Misses | Accuracy | Lower bound | Exclusions |
| --- | --- | --- | --- | --- | --- | --- |
| control | 536 | 268 | 268 | 50% | 45.78% | flat window inside the flat band: 178; the model made no call: 11; no readable outcome: 0 |
| candidate | 385 | 187 | 198 | 48.57% | 43.62% | flat window inside the flat band: 130; the model made no call: 210; no readable outcome: 0 |

Market NAS100:

| Model | Scored | Hits | Misses | Accuracy | Lower bound | Exclusions |
| --- | --- | --- | --- | --- | --- | --- |
| control | 454 | 240 | 214 | 52.86% | 48.27% | flat window inside the flat band: 104; the model made no call: 11; no readable outcome: 156 |
| candidate | 331 | 172 | 159 | 51.96% | 46.59% | flat window inside the flat band: 80; the model made no call: 210; no readable outcome: 104 |

- This is the agreed test 2: one model call against four market outcomes, not a pair-combination measure.
- Each market carries its own denominator; an aggregate across markets is not reported.

### 3. Original Layer 2 levels with the frozen 5R rules

Type: historical_coverage. Outcome source: one-hour closes with the original layer-2 level grid and 5R management. Status: blocked on history: the simulation is implemented and unit-tested, but no 5-minute tape or level ladder exists.

Question: When a Layer 1 call was handed to the original Layer 2 levels, did the frozen 5R path reach its target before its stop?

Usable sessions: 0 of 725.

Demonstration only, window 2026-11-05 to 2026-11-06:

The path test needs a 5-minute tape and a level ladder archived before the setup; neither exists for these dates, and nothing is estimated in place of a tape.

| Variant | Account | Model | Fills | Wins | Losses | Total R |
| --- | --- | --- | --- | --- | --- | --- |
| l2l_full_5r | Current / full 5R | control | 6 | 2 | 3 | 7 |
| l2l_full_5r | Current / half 3R | control | 10 | 4 | 4 | 8 |

- This is the agreed test 3. It needs a trade-qualified call, contemporaneous levels and an actionable bid/ask M5 replay.
- The path rule engine is implemented and unit-tested on synthetic tapes (lib/layer1_backtesting/l2l_simulation.js). That is a statement about the simulator, not a measured result.
- The grid does not yet exist for these markets, so the test is blocked on history, not scored at zero.

### 4. Original levels plus midpoints with the frozen 3R rules

Type: historical_coverage. Outcome source: one-hour closes with the levels-plus-midpoints grid and 3R management. Status: blocked on history: the simulation is implemented and unit-tested, but no 5-minute tape or level ladder exists.

Question: With midpoints added to the original levels, did the frozen 3R path reach its target before its stop?

Usable sessions: 0 of 725.

Demonstration only, window 2026-11-05 to 2026-11-06:

The path test needs a 5-minute tape and a level ladder archived before the setup; neither exists for these dates, and nothing is estimated in place of a tape.

| Variant | Account | Model | Fills | Wins | Losses | Total R |
| --- | --- | --- | --- | --- | --- | --- |
| l2l_half_3r | Current / full 5R | control | 6 | 2 | 3 | 7 |
| l2l_half_3r | Current / half 3R | control | 10 | 4 | 4 | 8 |

- This is the agreed test 4, a separately frozen geometry and management rule, not a sensitivity check on test 3.
- It needs the same tape and ladder evidence as test 3 plus the midpoint geometry.
- The midpoint ladder and the 3R path are implemented and unit-tested on synthetic tapes; the historical inputs are absent.

### Pair combination: `definition_recorded_not_scored`

Combine two independent Layer 1 calls, one per leg, into one pair view: the pair direction is the long leg's call against the short leg's call, and a pair is scored only when both legs made a directional call on the same morning.

Rejected reading: The existing four-market test is USD-only: one model call, four market outcomes. It answers a different question and is already test 3, so it is not reused under this name.

Why it is not scored:

- Only USD has a frozen Layer 1 rulebook with a per-morning decision record. The EUR, gold, NAS100 and BTC Layer 1 agents exist as exports but have no frozen rulebook version, so a second independent leg cannot be formed without inventing one.
- Scoring a pair from a USD call plus a price series would measure the same thing as test 3 under a new name.

What it needs before scoring:

- A frozen, versioned rulebook and decision record for at least one non-USD leg.
- A declared leg mapping (which call is long, which is short) and a declared conflict rule for two same-direction calls.
- A denominator that counts only mornings where both legs called.

Owner decision: OD-1.

## 7. Blockers

| # | Blocker | Detail | Effect |
| --- | --- | --- | --- |
| B1 | No verified 05:00 receipt on any morning | The clock rung passes on 0 of 725 mornings because no receipt archive exists, so the strict gate cannot open and no candidate result can be called valid. | candidate readiness is 0/725; every candidate figure is provisional |
| B2 | The intended 25-factor model has no single defined rule | The identity block reads CONFIG_BLOCKED: the rulebook has 25 rows but no agreed sign, weighting or tie policy, so the implemented book stands in for it. | the candidate cannot be scored as intended; only the implemented book is measured |
| B3 | The official ICE dollar index series is absent | The official test has null usable sessions; the only scored directional test uses a broker proxy. | the headline accuracy number is a proxy result and is labelled as one |
| B4 | No 5-minute tape or archived level ladder for the layer-2 path test | All four markets report the same two blockers, so no line-to-line trade can be replayed; the ledger is a two-day demonstration. | the path test is unscored on history |
| B5 | Nine of the required inputs are missing from the saved as-of frame | The archive carries nine saved inputs and the requirement table names the rest, so most blocked mornings are an absence of data rather than a model judgement. | 108 of 725 mornings are data exclusions on the control's own gate |
| B6 | No file named Handover.md exists in the checkout | The USD handover is present as docs/research/handoff/usd/v1/START_HERE.md with USD_SYSTEM_CONTEXT.md and HANDOFF_MANIFEST.json; reading order and scope come from those. | none on the numbers; the report cites the handover it actually found |

## 8. Owner decisions

Five questions were reserved for the decision owner. They are answered here; the answer changes the wording of the
report and the screen, and never changes a stored figure.

### OD-1 · resolved

Does pair-combination accuracy mean two independent Layer 1 legs, or the existing USD-only cross-market test?

Decision: Keep the agreed USD-only inverse cross-market test. It is one USD call against four market outcomes and it is test 3. Combining two independent Layer 1 calls is a separate future test with its own definition, and it stays unscored.

- tests.four_markets keeps its name and its four per-market denominators.
- pair_combination remains registered and unscored.

Does not license: It does not license a second leg, a leg mapping or a pair-level accuracy number.

### OD-2 · resolved

Which gate defines published readiness and accuracy: presence and freshness, or present + fresh + clocked + identified?

Decision: Headline readiness uses the selected model's strict evidence gate. Each performance result uses its own eligible sample and displays its denominator beside it.

- The strict headline is 0 of 725 for both models, because no 05:00 receipt exists.
- The control's narrow gate remains visible as a labelled comparison, never as the headline.
- The candidate's legacy reconstructed sample (515) and its gated call count (121) are printed separately.

Does not license: It does not license one blended accuracy figure, and it does not upgrade a proxy test to a headline.

### OD-3 · resolved

Should the trade flags on blocked mornings be withdrawn, relabelled, or kept?

Decision: A blocked morning creates no valid decision and no trade. Any contradictory legacy trade flag is preserved as an audit finding, not deleted and not traded.

- The engine keeps trade_eligible false on every blocked or abstained morning.
- The published flag is retained, counted under engine_stricter and reported by the run audit as trade_on_blocked_morning.

Does not license: It does not license rewriting the published artefact, and it does not turn a withdrawn flag into a trade.

### OD-4 · resolved

Is the flat band and the scoring tie policy frozen for the USD session?

Decision: The exact proposed flat bands and the tie treatment are returned per instrument in the screen payload, frozen from development dates only, before any holdout outcome is examined.

- A move strictly inside the band is flat: excluded from the accuracy denominator and counted separately.
- A vote that nets exactly zero, or sits inside the 0.20 deadband, is NO_CALL; there is no coin flip and no direction-priority tie-break.
- The bands are applied unchanged to the 400 unseen mornings.

Does not license: It does not license re-fitting a band after a holdout result, and it does not license dropping flat mornings silently.

### OD-5 · resolved

Which coverage figure is authoritative for the candidate: the coverage table's 515 reconstructed calls or the engine's 121 gated calls?

Decision: Trace both to their model, gate, dates and source artefact, show their overlap and exclusions, and report scheduled, reconstructed, valid, directional and scored counts separately. Neither figure is authoritative for the other.

- The screen prints the five counts per model with their own definitions and denominators.
- The broker-proxy test's candidate denominator is labelled as the legacy reconstructed sample, because it contains calls the gated engine would not make.

Does not license: It does not license treating reconstructed calls as valid calls, or asserting that one count contains the other.

## 9. What this report does not claim

- No edge, no profitability and no forecast.
- No live execution, no order and no sizing.
- No claim that a blocked morning would have been profitable or unprofitable.
- No claim that the implemented book represents the intended model.

## 10. Limitations

- Every figure is a replay of stored artefacts, not a live measurement: a defect in an artefact carries into the report.
- The candidate figures describe the implemented book, not the intended 25-factor model, which has no defined rule.
- The directional accuracy is measured against a broker proxy series, not the official index.
- Coverage differs by model, so accuracy figures are not like-for-like and are never aggregated across models.
- No compounding, sizing or execution is modelled anywhere in this area; a trade flag is not a trade.

## Provenance

| Input | Bytes | sha256 |
| --- | --- | --- |
| `data/usd-layer1-backtester/run-v1.json` | 6583957 | `0fea034745c343610c441ffa3a0e35304222a73ea8034f9c78055ea9e1e861f3` |
| `data/usd-layer1-backtester/engine-v1.json` | 927740 | `f4290bae4ff91a41727f717f0f7138dffedbf8b3e2a3dc824dcdceeb7aeab6c8` |
| `config/usd_l1_factor_rulebook_v1.json` | 38281 | `1f12c64f019e38056330a8beb3ffb85314e2ff5a25c46af91c18bf078cf9f6a0` |
| `config/usd_l1_decision_rules_v1.json` | 10240 | `015155d3092d8a6786ce5ce18c2150155bf13c01a37328cfb19336484b974cc8` |

Report digest: `e73fb5c62b20e9fbc1fba2c11a8d215ad48e009233eec0101dd11cf323448f76`.

The digest is taken over the body before this block; rebuilding the report from the same artefacts reproduces it.

Reproduce: `node scripts/build_layer1_backtest_report.js --check`.
