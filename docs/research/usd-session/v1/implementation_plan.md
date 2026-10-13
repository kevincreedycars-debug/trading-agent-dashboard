# Implementation and experiment plan (proposal, awaiting Reviewer B's approval)

Status: **proposal**. Nothing in this file is authorised, and no candidate may be scored before the frozen
evaluation design in §4–§5 is approved by the independent methodology reviewer (assignment `USD-SESSION-A4`).

## 1. Isolation mechanism

- Research branch `research/usd-session-20261013`; every run writes under `backtester/tmp/usd-session-research/`.
- `backtester/scripts/lib/research_path_guard.js` refuses any write outside that folder and refuses every
  committed production tree explicitly (`data/`, `config/`, `exports/`, `logic/`, `scripts/`,
  `backtester/registries/`, `docs/review/`, `docs/analysis-engine/`). Proven by
  `tests/usd_session_research_guard.test.js`, which also asserts the folder is git-ignored.
- The 24-hour study's scripts default their outputs to committed paths; this programme therefore never runs
  them with defaults. Where reuse is useful, the default is repointed or an explicit `--out` is passed.
- No research script calls n8n, Supabase, the dispatcher or a provider write endpoint. Read-only acquisition
  of public series into the ignored cache is the only network use.
- Shadow outputs, when they exist, go to the research folder and are labelled `SHADOW_RESEARCH_ONLY`.

## 2. Data and features

| Layer | Source today | Notes |
| --- | --- | --- |
| Label instrument, intraday | none for DXY | the blocking decision; OANDA hourly EUR/USD, XAU/USD and NAS100 exist to 2026-04-30 |
| Macro series | FRED daily (2Y, 3M, 10Y, DFII10, 5Y TIPS, 10Y breakeven, EFFR, SOFR, HY spread, VIX, S&P, NQ, WTI, EUR/USD `DEXUSEU`) | previous-close value at the 05:00 cutoff, lagged per the manifest |
| Repo cache | `backtester/tmp/usd-24h-research-cache/` with `cache-manifest.json` | reuse rather than re-download; extend only if a card requires it |
| Calendar | paid feeds only | release existence and scheduled time are usable; consensus vintages are not |

Feature construction rules (to be frozen with the dataset):

- Every feature is computed from an explicit as-of window ending at the session cutoff, enforced by
  `buildAsOfSnapshot` in `backtester/lib/usd_session_engine_interface.js`.
- A feature whose source series publishes with a lag uses the most recent value **available** at the cutoff,
  and records its observation date, so the study measures what was really knowable.
- The session calendar comes from the data (which sessions exist), not from an assumed weekday rule;
  holidays are recorded as missing sessions rather than filled.
- One versioned dataset file per build, with a manifest carrying per-series provenance and the same sha256
  discipline the 24-hour dataset used.

## 3. Three engines kept separate

## 4. Frozen evaluation design (proposal)

| Item | Proposal |
| --- | --- |
| Target | sign of the label-instrument change from the 05:00 Europe/London cutoff to the 17:00 America/New_York endpoint, same local date |
| Flat band | fitted on training sessions only, frozen before candidate comparison, reported in the contract file |
| Eligibility | weekdays only; a session is dropped if the label or a required feature is missing; the missing-quote policy is declared in `session_contract_v1.json` before scoring |
| Ties | a session whose change is inside the band is not a date tie for direction purposes; it leaves the decided-call accuracy and its share is reported |
| Splits | training 2024-01-02 → 2025-06-30; validation 2025-07-01 → 2025-12-31; **reserved** 2026-01-01 → 2026-04-30 kept sealed until final selection; prospective 2026-05-01 onward |
| Primary metric | balanced accuracy on decided sessions |
| Always reported | coverage, decided count, matched-day comparison against `original_v2_1` and `repaired`, Wilson interval, quarter-by-quarter stability, event-day versus quiet-day, and the multiple-candidate context |
| Baselines | always bullish, always bearish, trailing-move continuation, trailing-move fade, and a regularised logistic benchmark on the same features |
| Sealing | the reserved block is read once, at final selection, and the fact of reading it is recorded in `exposed_periods.md` |
| What is not claimed | a directional result is not trading profitability; any execution policy needs its own later test |

## 5. Experiment budget and discipline

- Maximum 100 logged configurations, counting baselines, removals and every threshold or lookback variant,
  as the north star requires. Each row records configuration id, parameters, the card ids it implements,
  per-period metrics, and whether it ran before or after the reserved block was opened.
- Factor removals are diagnostic, never the headline: the primary evaluation is the complete engine.
- Every attempt is kept, including failures. A rejected candidate is a row, not a deletion.
- Fitting of any transformation or parameter uses training sessions only; the selection key is validation
  balanced accuracy with a decided-count tie-break, declared before the reserved block is read.

## 6. Sequencing and current state

1. Reviewer B approves §4–§5. — **blocked**, assignment written, not run.
2. Label instrument and quote source decided. — **blocked on the user**, see `session_contract_v1.json`.
3. Dataset build with the frozen rules; no candidate scored. — **not started**; can begin once (2) is
   answered, and the macro half can begin now.
4. Card research returns; Reviewer A and Reviewer B reviews; synthesis. — **blocked on the frontier models**.
5. Engine implementation and historical harness. — **not started**; the interface and leakage guard exist.
6. Candidate comparison within budget, then final selection, then the reserved block. — not started.
7. Prospective shadow in the research folder only. — not started; deployment is out of scope.

## 7. Specific blockers

| Blocker | Kind | Who can clear it |
| --- | --- | --- |
| No verified intraday DXY instrument or quote source | substantive decision | the user |
| No book, edition or external source for the factor set | missing source material | the user |
| Consensus and first-print vintages behind paid feeds | access | the user, or an explicit decision to keep that family out of the directional budget |
| No live collector path for new inputs (German 2Y is collected; credit spreads and the local gold cache are not) | access | the user, for any shadow phase |
| Reviewer A, Reviewer B and synthesis runs | external models | the user |
| Frozen evaluation design approval | review gate | Reviewer B |


| Version | Definition | Purpose |
| --- | --- | --- |
| `original_v2_1` | `Calculate USD Conviction` reproduced as-is for the 24h timeframe, with its own weights and thresholds, applied to the new cutoff | the diagnostic arm; its horizon mismatch is stated in every table |
| `repaired` | the original plus the null-conversion repair already applied live, and plus any documented fix that changes no archived call | the honest baseline |
| `research_v1` | the synthesised specification, one rule per card, computed by the shared numerical implementation | the primary arm |

Shared numerics: one module produces the call and the trace for both historical scoring and prospective
shadow use, so the historical and live paths cannot drift. Historical runs make no LLM calls. Any rule that
cannot be expressed numerically is not implemented; it is listed as unresolved in the issue register.
