# Gold coverage expansion - September 17, 2026

Expanded the January 2024 to September 12, 2026 US calendar archive from HIGH to HIGH plus MEDIUM impact. The acquisition now accepts explicit dates and filters, validates returned country/impact/date bounds, rejects truncation and conflicts, retains raw hashes, and refuses existing output directories. Sixty-six read-only requests captured 3,829 events: 841 HIGH and 2,988 MEDIUM.

All original HIGH identities are preserved. Eight records have changed `lastUpdated` values since September 12; all other fields match. This is a new source version, not an overwrite. Output SHA-256: `cb6ec9997429856303e9ccc9bc3bf7d10270e510fb1cfc5d04f3c20f19fba584`.

## Results

Both evidence modes were executed with the existing hashed FRED/OANDA inputs. Schedule, split, embargo, 0.3% flat band and minimum 50 directional training observations remain unchanged. These are exploratory observations, not production calls or an untouched final test.

| Measurement | Prior retrospective | Expanded retrospective | Expanded as-of proxy |
| --- | ---: | ---: | ---: |
| Archive records | 841 | 3,829 | 3,829 |
| Scheduled decisions | 681 | 681 | 681 |
| Decisions with events before price filtering | 395 | 572 | 48 |
| Evaluable decisions with events | 285 | 426 | 35 |
| Event families attached | 21 | 62 | 36 |
| All single/pair candidates | 7,678 | 44,367 | 1,566 |
| Event-conditioned candidates | 6,878 | 43,567 | 766 |
| Event candidates meeting training floor | 0 | 1 | 0 |

Each expanded run retains 390 training observations, 143 validation observations and 148 exclusions. Retrospective mode has 89 decisions with recent releases but missing values and 20 without a recent release. As-of mode additionally rejects 524 decisions for late/unknown versions. Proxies do not authenticate original release or pre-release consensus values.

The training-selected overall candidate remains the VIX one-day/five-day change pair: 44/58 training (75.86%), 15/28 validation (53.57%), or 15/33 (45.45%) including flat outcomes. Candidate IDs change with the inventory; the selected conditions and outcomes do not.

The sole event candidate meeting the floor is a bullish condition within 1.5 hours of Initial Jobless Claims: 43/64 training (67.19%) and 16/27 validation (59.26%). Including eight flat outcomes, validation is 16/35 (45.71%). It matches all 35 feature-usable validation observations and exactly matches the always-bullish baseline on that cohort: no demonstrated incremental benefit. This is an event-age condition, not evidence of a surprise-direction effect. Mean validation Gold return is -0.0300% before costs.

Initial Jobless Claims appears at 266 scheduled decisions: 95 training, 35 validation and 136 exclusions. Daily observations are not independent releases. No 24-hour rule, Friday closure exclusion or sample floor was relaxed. More candidates increase multiple-testing risk; greater-than-60% qualification remains unestablished.

## Variable mapping

The separate provenance-aware audit covers the existing 154 full snapshots, source SHA-256 `990d656d768b4f2461d39576a4d83a6c98318eb10ef51f2d0c02a624c74568d0`. The exact-name readiness audit remains available.

- Nineteen variables have exact top-level fields.
- `growth_regime` maps to `global_growth_regime` in 149 snapshots, following the existing Gold replay input. The source name is retained; this does not authenticate the regime model.
- Five event fields map through `latest_us_event.raw.raw_json`: type, actual, consensus, numeric surprise and age at storage. They occur in three snapshots of one unique vendor release. Surprises retain family-specific vendor units.
- Ten stored events identify their source as `fixture` and are rejected. Six legacy event schemas remain unreviewed; 135 snapshots have no event.
- Inflation signal, headline-risk context and previous-as-released remain unresolved. A geopolitical flag is narrower than headline context; vendor `previous` cannot authenticate an unrevised prior value.

Thus 25/28 variables have some exact or mapped storage values, with uneven coverage. None is publication-qualified. The audit uses existing millisecond storage-time normalization and preserves the raw hash. Mapped fields are not fed into live logic or the macro experiment dataset.

## Reproduction

Ignored local evidence:

- `backtester/tmp/gold-calendar-expanded-20260917/`: raw responses, events and manifest.
- `backtester/tmp/gold-expanded-retrospective-20260917/`: retrospective bundle.
- `backtester/tmp/gold-expanded-asof-20260917/`: conservative comparison.
- `backtester/tmp/gold-source-refresh-20260912/full-source/mapping-review-v2-20260917.json`: final mapping audit. The earlier mapping-review artifact is superseded: it rejected microsecond storage timestamps before the existing normalizer was wired in.

Acquisition through the documented credential runner with `-Name RAPIDAPI_KEY`:

```powershell
node backtester/scripts/acquire_gold_event_archive.js NEW_DIRECTORY 2024-01-01 2026-09-12 HIGH,MEDIUM
```

Offline reproduction, each with a new output path:

```powershell
node backtester/scripts/run_gold_research_bundle.js backtester/tmp/gold-fred-vintages-20260912 backtester/tmp/gold-hourly-history-20260912 backtester/tmp/gold-calendar-expanded-20260917 NEW_DIRECTORY retrospective
node backtester/scripts/run_gold_research_bundle.js backtester/tmp/gold-fred-vintages-20260912 backtester/tmp/gold-hourly-history-20260912 backtester/tmp/gold-calendar-expanded-20260917 NEW_DIRECTORY as_of_proxy
node backtester/scripts/audit_gold_snapshot_mappings.js backtester/tmp/gold-source-refresh-20260912/full-source/snapshots.json NEW_REPORT.json
```

Validation: four new focused tests and full `npm test` 331/331 passed, with no failures/skips/cancellations. Tests cover partial/leap-month bounds, filter mismatch, incomplete manifests, hashes, overwrite refusal, fixture/future-release rejection, zero values, microsecond storage time, alias precedence and unique-release counting. Full log: ignored `tmp/gold-coverage-tests-20260917.log`.

Next: check aligned pre-2024 event, OANDA price and FRED vintage coverage before extending the schedule. Original vintages, independent final evaluation, session coverage and Layer 2 history remain separate qualification requirements. No production workflow, database or formula changed.
