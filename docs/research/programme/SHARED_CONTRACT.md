# The shared research contract

Every lane works to this contract. Where a lane wants to change it, the change is recorded here first and
then carried into the catalogue and the generated prompts; a prompt that disagrees with this file is a defect.

## 1. The USD session

- **Window**: 05:00 Europe/London to 05:00 Europe/London on the next local date. Both ends are London
  wall-clock times one local date apart, so every eligible session is exactly 24 hours. The contract is
  `docs/research/usd-session/v1/session_contract_v1.json`; the engine's own statement of it is
  `SESSION_CONTRACT` in `backtester/lib/usd_session_engine_interface.js`.
- **Starts**: a session starts on a Monday-to-Friday London local date only. A Saturday or Sunday start is
  never a session. The Saturday start is the only one that can contain a London daylight-saving transition,
  which is why every eligible session is exactly 24 hours.
- **Ends**: a Friday session ends at the 05:00 London endpoint on the Saturday.
- **Endpoints are resolved independently.** When an endpoint value does not exist, the session is recorded as
  not evaluable and the value stays missing. It is never filled from a Friday close, a Monday open, an
  interpolation, a later revision or another instrument, and the Friday session is never extended to Monday.
- **The deployed engine does not use this window.** Its stored calls were attached to a 09:30 America/New_York
  to 16:00 America/New_York window sliding up to three days (`getPhase1OutcomeWindow`,
  `backtester/lib/timeframe_windows.js`). That study's own measured facts - a median 30.5 elapsed hours over
  583 evaluable rows, 14.5 hours of overlap with our session on 528 rows, 15.5 hours on 55 rows, and the
  session's first 9.5 hours (8.5 in those weeks) uncovered - are properties of that study and are attributed
  to it every time they are quoted. They are not a declared property of the live engine.

## 2. The label instrument is unresolved, and stays recorded as unresolved

The outcome instrument is proposed as DXY and **UNVERIFIED**. No intraday dollar-index print exists in this
repository or in the live collector, and no quote source is committed. Therefore:

- Never substitute DXY, a broad trade-weighted index or a bilateral pair for the unresolved label, and never
  present one of them under the DXY name. If a source is about EUR/USD, a basket or a futures contract, the
  claim names that instrument and its window in the same sentence.
- The session is defined but unmeasured until the instrument and its quote source are decided. A report may
  say what is known about the dollar without a label; it may not report a measured hit rate for a label that
  does not exist.
- The decision to fix the instrument belongs to the owner. Recording it as unresolved is a complete return.

## 3. The five kinds of evidence, kept apart

Each kind answers a different question and never stands in for another. Every load-bearing claim states which
kind it rests on, in the sentence that makes the claim.

| Kind | What it is | What it may support |
| --- | --- | --- |
| Economic mechanism | Why an input could move the price inside the session | A reason to look. Not a measurement, and a plausible channel is not evidence that the channel operates |
| Contemporaneous association | What moves with the price at the same time | Nothing about direction after the cutoff. The asset may be doing the moving |
| Predictive evidence from other windows | Measured relations for a close-to-close day, another session, an event window or a longer horizon | Background. Never evidence for our session, and the window is named every time |
| Evidence for our exact session | A measurement of the declared start to the declared endpoint on the next local date | The only kind that speaks to our decision directly; where it does not exist, say so |
| Incremental value beyond existing inputs | What the factor adds to a decision already able to use the entries before it | New information only. A relation already contained in an earlier input adds nothing |

A claim that changes kind between sections - a mechanism presented as a measurement, another window presented
as ours, an existing input presented as new - is the commonest way a body of research overstates what is known.
Where the same evidence is counted twice, the document says so.

## 4. Conclusions a stage is allowed to reach

- **Exclusion** - the evidence may support leaving the factor out of the decision entirely.
- **Regime-only use** - the evidence may support using it only in a named regime, and only where that regime is
  identifiable at the cutoff.
- **Insufficient evidence** - where nothing has been measured for this session, saying so is the correct return;
  the remedy is a measurement or a supplement, never a stronger claim.
- **Adding nothing** - a factor whose information is already in the inputs before it earns no weight. More
  factors are not assumed to improve accuracy, and improved accuracy is only ever an empirical result.

## 5. Research is not validation

Research may propose a treatment; it may not claim an edge. These states are distinct, and this table is the
only reading a lane may use when describing a document:

| State | Meaning | What it may support |
| --- | --- | --- |
| Uploaded | Bytes stored, hash recorded, chain, stage and parent linkage checked by the store | That the evidence exists and is well formed |
| Reviewed | A red-team return registered against the exact version it judged | That the claims have been attacked, not that they survived |
| Adjudicated | A stage-3 decision on every material objection, registered against both parent versions | A research conclusion, still unvalidated |
| Validated | An isolated backtest measured out of sample under the frozen design | A candidate for the Layer 1 algorithm, still not a live change |
| Live | The live engine actually uses it - never authorised by any state above | A change to a live decision, made only on the owner's instruction |

An upload is evidence, a passing schema check is not a review, a reviewed hypothesis is not a tested one, and
a document that exists is not a change that was made. No lane describes a factor as validated, and no document
asserts an accuracy figure, a sample size or a performance number it did not measure.

## 6. Preserve, then supplement

Completed research is preserved. A named gap is closed by a supplement registered against the version it
extends, not by silently rerunning a stage and replacing its output. A rerun is justified only when the
artifact cannot stand at all - the wrong contract, unusable provenance, or a document that was never about the
question - and the reason is recorded before the new version exists. Version 1 of any document stays immutable;
the store refuses to overwrite a version and dedupes identical bytes.

## 7. The three-stage chain and the asset gate

Every factor carries a three-stage chain - research, red-team, adjudication - and the store refuses a stage
that does not name its chain, the right stage, and the exact version of its parent. The asset-level final chain
has its own three stages - final analysis, final red team, final adjudication - and opens only when all
twenty-five factor chains are complete against current versions. Each final stage records the exact
`input_documents` package it judged, and a changed input flags the downstream stages stale rather than
upgrading them. Final synthesis must reconcile overlapping factors, conflicting conclusions and shared
evidence before proposing a combined model and a validation plan; averaging adjudications is not a synthesis.

On 2026-10-25 the gate reads 0/25 factor chains complete and locked, with one factor chain at 1/3 (VIX research
delivered).

## 8. Asset expansion

- USD is the only asset with factors, chains, prompts and a session contract. Expansion is USD first, then
  EUR, GOLD, SILVER, NQ, BTC, WTI and GBP.
- Each asset needs its own factor catalogue, its own instrument definitions and its own declared cutoff and
  session before any of its prompts can be generated. An asset-specific factor list is not a copy of the USD
  list with the symbol changed.
- The catalogue currently declares the asset strip order `USD, EUR, GBP, GOLD, SILVER, NQ, BTC, WTI`, which
  differs from the owner's expansion order above by GBP's position. This is recorded, not silently changed:
  expansion follows the owner's order, and the strip order is a one-line catalogue change when the owner wants
  the two aligned.
- No non-USD asset may inherit a USD result, and the catalogue already refuses to let one appear to.

## 9. Change control

- No lane changes live trading logic, weights, MT5 execution, unrelated workflows or published data files.
- No paid hosting, no paid API usage, no silent model substitution. Credentials live only in the documented
  scoped runner and never in the page, a prompt or a log.
- Publication happens only through the documented routes: the page reads `data/research-library/catalog.json`
  and the generated prompts from the repository; documents are registered through the library service; the
  site publishes from `main`.

