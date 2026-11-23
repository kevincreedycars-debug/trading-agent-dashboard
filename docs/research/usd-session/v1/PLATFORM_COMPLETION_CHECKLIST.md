# Reusable USD Layer 1 n8n backtester — completion checklist

Research only. No workflow is scheduled, no webhook is left authenticated, and no order, stop, size, feed or
runtime table is read or written by anything in this lane. This file answers "what works, what is evidenced,
and what is next" without reading the code.

Last measured: 2026-11-23, after the retrieval, independent-validation, accounting, test-selection and
coverage work. This edition corrects the previous one in a specific way: historical retrieval, independent
rule validation and costs/sizing/equity were described as "what remains" and are now **implementation work
that is done**; what remains on those axes is the historical data they need, which is a separate dependency.
Receipted refusals are no longer counted anywhere as completed structural runs. The data dependency and its
acquisition order are now written down in `backtester/docs/usd_historical_data_acquisition_plan.md`, so this
checklist points at one plan rather than restating it. The 2026-11-23 edition adds one correction of its own,
in section 5a: the session-engine interface resolved its endpoint at 17:00 `America/New_York`, so the window
it measured was 16 or 17 hours while the contract it serves declares 24. Both ends are now 05:00
`Europe/London`.

## 0. Three statuses, kept apart

| Status | Verdict | Why |
| --- | --- | --- |
| **Platform completion** | complete for the scope below | registry-driven models, durable sweep, experiment identity, declared-source retrieval, independent specification checks, configurable costs/sizing/equity, executed test-module selection, per-model/mode/configuration coverage, and a one-morning explainer are implemented and verified |
| **Historical data readiness** | not ready | there is no contemporaneous capture corpus (0 receipts), no M5 tape or level ladder for tests 3/4, no licensed ICE DXY, and H1's gold/calendar inputs are unresolved. These are missing datasets, not missing code |
| **Research validity** | not established | replay consistency is established for the stored calls; no edge, calibration or historical availability is claimed. The rules are frozen but not validated as profitable |

A reader should never trade one status for another. "Platform complete" does not mean "data ready", and
"data ready" would not mean "edge established".

## 1. Model selection is configuration, not code

| Criterion | Status | Evidence |
| --- | --- | --- |
| One registry owns the model list | **works** | `backtester/lib/usd_layer1_backtester/model_registry.js`; entries carry key, identity, label, role, kind, version, source, score field and a model-owned input contract v2 |
| Any registered set runs | **works** | controller delegates to the registry; `fixture_constant` was added by registration and labelled |
| A fixture is labelled, never pooled | **works** | record `fixture: true`, ledger `· FIXTURE`, map option, comparison row |
| The input contract declares sources and clocks | **works** | contract v2 names `lib/layer1_backtesting/input_sources.js` and the policy "a value is contemporaneous only when a capture at or before the cutoff matches it" |
| Selection is validated at the edge | **works** | unknown key, unclouded model, duplicates and over-long selections are refused with a reason |

## 2. Durable execution and recovery

| Criterion | Status | Evidence |
| --- | --- | --- |
| Execution capture is automated | **works** | `scripts/run_usd_l1_n8n_sweep.js` posts, parses, persists and reports |
| Validation and atomic persistence | **works** | merged through `lib/backtesting_n8n_run_ledger.js`, written with a temp-file rename |
| Resume from stored progress | **works** | the plan is recomputed before every request; an identical retry sends 0 |
| Failed attempts retained | **works** | 43 attempts, 4 failed, kept as evidence |
| Concurrent duplicate writes prevented | **works** | exclusive `.sweep.lock` with pid and time |
| No secret in the repository | **works** | see `CREDENTIAL_EXPOSURE_CHECK_20261121.md`: no ref, object or unreachable blob carries the value; no rotation needed |
| The webhook is not left listening | **works** | the parent is deactivated; the verification script activates it only for its two calls and deactivates it in a `finally` block |

## 3. Experiment identity and claims

| Criterion | Status | Evidence |
| --- | --- | --- |
| Each record names its code, panel, cutoff and gate | **works** | `identity` with bundle hash, controller version, registry fingerprint, snapshot digest, validation policy |
| Test selection is part of the identity | **works** | `identity.test_configuration` records the modules the controller executed, their scored markets and their simulations |
| Identical retry adds nothing | **works** | configuration fingerprint match returns `sent: 0` |
| A changed configuration coexists | **works** | `structural|2024-01-10#…` suffixed row |
| Claims are separated | **works** | replay consistency 729/729; availability, model logic and panel-live equality each carry their own status |

## 4. Historical input retrieval

| Criterion | Status | Evidence |
| --- | --- | --- |
| Retrieval runs through the declared contract | **works** | `lib/layer1_backtesting/input_retrieval.js`; each key resolves provider, series, transform and publication lag |
| Source, vintage and clock are preserved | **works** | per key: observed date, clock (`timestamp`/`date_only`/`none`), staleness, panel legend and the declared publication rule |
| Retrieval evidence is recorded | **works** | a capture receipt only when a capture at or before the cutoff matches the replayed value and carries a receipt id; otherwise a reconstruction digest with `receipt: null` |
| Reconstructed availability is distinguished | **works** | `mode: reconstructed_panel` against `mode: contemporaneous_capture`; conflicts and late captures are named, never resolved silently |
| No receipt is fabricated | **works** | the committed corpus is empty, so the artefact reports 0 receipts and `availability_claim: not_established` for every model |
| Coverage of the retrieval artefact | **works** | current: 30 keys, 20,775 values; challenger and challenger_v1: 9 keys, 6,224 values each; fixture: 1 key, 717 values; all reconstructed, 0 conflicts |

The implementation is complete; the historical data is not. Archiving a 05:00 capture set is the dependency
that would turn any of those rows into `contemporaneous_capture`.

## 5. Independent rule validation

| Criterion | Status | Evidence |
| --- | --- | --- |
| A second transcription of the approved specification | **works** | `lib/layer1_backtesting/spec_check.js#SPEC`, written as `above`/`below` rules, not a copy of the model's `vote_spec` |
| Hand-calculated examples | **works** | 5 cases with the arithmetic written out; 5/5 reproduced, including the deadband, the six-mechanism minimum and the participation boundary between conviction 4 and 5 |
| Corrupted calculations are caught | **works** | 5/5: flipped direction, inflated conviction, dropped vote, inflated usable count, removed abstention |
| Corrupted rule tables are caught | **works** | 3/3: threshold moved 25→20, VIX family double-counted, weight sum not equal to 7 |
| Corrupted inputs are refused or named | **works** | 3/3: NaN is missing not zero, a numeric string is not coerced, a value exactly on a threshold casts no vote |
| Bad clocks and dropped inputs are gated | **works** | 3/3: post-cutoff print blocks, date-only clock is not receipted, a removed value is named as missing |
| The model's table still matches the transcription | **works** | `compareModelTable()` has no differences |

The verdict is `pass` for implementation fidelity. That is not a statement that the rules predict anything.

## 5a. Session horizon: 05:00 London to 05:00 London

The session every test is defined on is one local day in London: it starts at the 05:00 research cutoff on
local date D and ends at 05:00 on D+1. `contracts.SESSION_CONTRACT` said so - `cutoff_local` 05:00
`Europe/London`, `endpoint_day_offset` 1, `nominal_hours` 24, `start_weekdays` Monday to Friday - and all four
test definitions read "from 05:00 London to 05:00 the next local calendar day".

`backtester/lib/usd_session_engine_interface.js` did not. It resolved the endpoint at 17:00
`America/New_York` on the same local date, so the window it measured and returned was 16 or 17 hours, while
the block it built called itself `usd-session-engine-interface-v1`. The endpoints had drifted apart without
anything failing: the artefact, the panel and the tests all read the contract, and the one module whose job is
to resolve the two instants for a later implementation resolved something else.

| Criterion | Status | Evidence |
| --- | --- | --- |
| Both endpoints are the contract's own | **works** | `SESSION_CONTRACT` is `cutoff_local` 05:00 `Europe/London` and `endpoint_local` 05:00 `Europe/London` with `endpoint_day_offset: 1`; `America/New_York` stays in `ZONE_TRANSITIONS` only because the macro as-of builder times the Fed's H.10 release in that zone |
| The measured window is the declared one | **works** | 261 Monday-to-Friday starts in 2026, every one exactly 24 hours. Under the old endpoint the same 261 measured 17 hours on 241 of them and 16 hours on the 20 that fall in the two weeks a year when London and New York are on different offsets |
| A transition cannot shorten an eligible session | **works** | the EU change at 01:00 UTC on the last Sunday of March and October always falls inside the session that starts on the preceding Saturday; the 2026 Saturday starts measure 23 hours (2026-03-28) and 25 (2026-10-24), and `isSessionStart()` refuses both, because only Monday to Friday start a session |
| The rule is stated, not just obeyed | **works** | `resolveSession()` returns `nominal_hours`, `window_hours` and `session_starts_weekday`; `SESSION_CONTRACT.session_start_rule` writes the rule out in words and carries it into the bundle |
| The version records the correction | **works** | `engine_version` is `usd-session-engine-interface-v2` |
| The bundled Cloud runtime carries it | **works** | `node scripts/build_usd_l1_n8n_cloud_workflows.js` rewrote all six files to identical bytes at `bundle_sha256` `73215c1e…d787`, 119,268 bytes, with the interface source at `73ba4fc1…c808`, the three child ids and the header-auth credential preserved |

Nothing else moved. The 725 panel mornings, the four test definitions, the ledger, the coverage table and the
published `run-v1.json` are unchanged, because they were already built on the contract's 05:00-to-05:00 day:
this correction changes what a future implementation resolves, not any recorded result.

## 6. Costs, sizing, equity and drawdown

| Criterion | Status | Evidence |
| --- | --- | --- |
| Sizing is the contract's own rule | **works** | `contracts.ACCOUNT` is the only machine-readable source for starting balance, currency and risk: `execution_accounting.js#SIZING`, `usd_layer1_backtester/accounts.js#runAccount` defaults, the demo call, the published panel and the panel's account note all read it, and the accounting test asserts they agree on GBP 100,000, 1% of the running balance at fill |
| Costs are configurable and labelled | **works** | `zero` (gross, labelled) and `fixture_costs` (spread, slippage, round-turn commission per market; labelled a fixture, not a broker schedule) |
| Equity and drawdown are computed | **works** | per-trade equity, running peak, drawdown amount and percentage, expectancy in R, profit factor and cost drag |
| A trade that cannot be sized is skipped with its reason | **works** | no stop, non-positive balance or below-minimum lot each produce a reason, not a forced minimum |
| A blown account stops | **works** | remaining trades are not compounded from a negative balance |
| Demonstrated on a labelled fixture | **works** | `data/usd-layer1-backtester/fixtures/execution-accounting-v1.json`; final GBP 108,961.62, max drawdown GBP 1,139.60 (1.04%), expectancy 2.948R, costs GBP 163.38 (1.79% of gross), every row hand-checked |

The path simulator still has no historical tape to consume. The accounting is demonstrated on the fixture; a
historical equity curve needs the missing data, not more code.

## 7. Test-module selection changes execution

| Criterion | Status | Evidence |
| --- | --- | --- |
| The selection is applied by the controller | **works** | only the markets the selected modules consume are scored; a module the record cannot carry is recorded `not_run` or `blocked_on_history` |
| The children execute the selection | **works** | the Cloud bundle (`usd-l1-cloud-runtime-v3`) passes `tests` into `runBacktest` |
| The parent records what executed | **works** | `identity.test_configuration` carries modules, scored markets, simulations and `applied_by: the controller` |
| Remote proof, same morning, two selections | **works** | executions `7138`/`7140` (four markets: EURUSD, XAUUSD, BTCUSD, NAS100) and `7142`/`7144` (tests 3 and 4: 0 market results, both modules `blocked_on_history`), recorded in `data/usd-layer1-backtester/n8n/test-selection-verification-20261121.json` |
| The ledger verifies the selection on replay | **works** | `test_selection_<model>` check compares modules, scored markets and per-module states |

## 8. Coverage, per model, mode and configuration

| Model | Panel mornings | Covered | Completed rows | Completed mornings | Refused | Receipted refusals | Scored mornings | Scored market results |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current | 725 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| challenger | 725 | 725 | 726 | 725 | 3 | 2 | 508 | 1,726 |
| challenger_v1 | 725 | 725 | 726 | 725 | 3 | 2 | 508 | 1,726 |
| fixture_constant | 725 | 1 | 1 | 1 | 0 | 0 | 1 | 4 |

- The 726 completed rows against 725 mornings are the coexisting configuration on 2024-01-10, not a duplicate
  morning.
- The three refusals are one structural refusal on an absent date and two receipted refusals. Neither is
  counted as a completed structural run.
- The sweep is grouped into four configuration signatures: 719 rows in the main sweep, 7 in the earlier
  configuration, 2 absent-date refusals and 1 coexisting row. The full per-mode and per-configuration table is
  in `data/usd-layer1-backtester/coverage-v1.json` and on the dashboard.
- 508 of the 725 mornings produced at least one scored market result; the rest abstained or were refused, so
  1,726 is a count of market results, not of mornings.

## 9. Product surface

| Requirement | Status | Evidence |
| --- | --- | --- |
| Selectable test modules | **works** | the Tests tab filters the committed definitions; a run's selection is executed and recorded (section 7) |
| Aggregate model comparisons | **works** | `model-comparison-v1.json`; challenger/challenger_v1 agreement 481 of 481 common directional mornings |
| Evidence-linked map | **works** | Three.js execution map, one node per recorded morning and model call, click-through to parent and child executions |
| One morning explained end to end | **works** | "One morning, end to end" on the map tab: sources → inputs → rules → validation → call → execution → outcome, with a selector over traced mornings and execution links |
| Coverage and checks on the dashboard | **works** | coverage tables, the specification-check verdict and the retrieval table are rendered from the committed artefacts |
| Fixture is excluded from research figures | **works** | comparison row and coverage row are labelled and excluded |

## 10. Reproduce

```
npm run build:usd-l1-n8n                    # regenerate bundle + children + parent from the registry
npm run build:usd-l1-platform               # rewrite the four platform artefacts
npm run check:usd-l1-platform               # recompute them and compare without writing
npm run test:usd-l1-n8n                     # bundle, wiring, map, ledger, sweep planner
npm run test:usd-l1-platform                # modules, retrieval, spec check, accounting, morning traces
npm run test:l2l-simulation                 # the frozen path engine + the aggregate comparison
npm run check:usd-l1-ledger                 # re-merge every record capture and compare with the ledger
node backtester/scripts/verify_m5_archive.js            # re-derive the recorded EUR/USD trades from the M5 tape
node --test backtester/tests/usd_layer1_m5_archive.test.js
node scripts/verify_usd_l1_test_selection.js --upload   # upload, run both selections, deactivate
```

On 2026-11-23, measured on this branch: `npm run check:usd-l1-platform` reported `reproduces` for all four
artefacts, `npm run check:usd-l1-ledger` reported `ledger reproduces` with 0 verification failures, and
`node backtester/scripts/verify_m5_archive.js` re-derived 6 of 6 recorded EUR/USD trades with 0 failures
(`node --test backtester/tests/usd_layer1_m5_archive.test.js`, 5 of 5). The M5 sample itself is four markets,
two and a half days, **0 bid/ask series and 0 pre-session ladders**: it proves the tape can reproduce a
recorded execution, not that tests 3 or 4 have historical inputs.

The artefact builder is the one step whose output depends on an input outside this commit, and it moved on
2026-11-23. `node backtester/scripts/run_usd_layer1_backtest.js --generated-at 2026-11-14T00:00:00.000Z`
reproduced `run-v1.json` byte for byte on 2026-11-22 (SHA-256 `0fea0347…61f3`); on 2026-11-23 the same command
produces SHA-256 `390b6118…1af7`, and every one of the 51 differing leaves is inside
`results.lead_numbers[1]` or `level_provenance`. The cause is upstream: `origin/main` published a re-marked
L2L ladder (`a04cc73a`, stamped `2026-11-23T16:20:57Z`, marked by automatic coverage) over the 2026-10-04
ladder the published artefact was built from, so the rebuild prices 6 sessions with original levels where the
committed artefact records 0. The artefact was not republished here: moving the panel's lead number from 0 to
6 is a statement about the new ladder, and it needs to be read before it is published.

## 11. What remains

| Item | Kind | Why it is not done | Next step |
| --- | --- | --- | --- |
| Contemporaneous input captures | **data dependency** | the retrieval path is implemented, but no capture corpus exists, so every value is a reconstruction | archive a 05:00 receipt set for each declared key; the code already accepts it. The document shape and acquisition order are in `backtester/docs/usd_historical_data_acquisition_plan.md` |
| Tests 3 and 4 on history | **data dependency** | the simulator and the account are implemented and tested; there is no contemporaneous level ladder and no actionable bid/ask M5 tape | acquire the ladder and tape; do not relax the readiness rule |
| ICE DXY for test 1 | **data dependency** | the official series is not licensed in this checkout | ICE sample/licence; the broker proxy stays labelled |
| H1 eligibility | **owner decision** | 0 of 725; gold identity/licence and calendar vintage are the movable inputs | D5 and D6 in `H1_RULE_RESOLUTIONS_20261120.md` |
| Broker cost schedule | **data dependency** | the accounting runs on a labelled fixture schedule | commit a broker schedule with a source and date |
| Republish `run-v1.json` from the re-marked ladder | **owner decision** | the committed artefact records 0 sessions with original levels, built from the 2026-10-04 ladder; `data/l2l-levels.json` now carries a ladder stamped `2026-11-23T16:20:57Z` that prices 6 | decide whether the new ladder is accepted, then republish and re-read the 5R/3R line-to-line figures |
| Rule validation as edge | **research work** | the specification check proves fidelity, not profitability | pre-registered tests on unseen mornings |

Nothing in the first column is blocked by the platform. The platform can consume each of them unchanged.
