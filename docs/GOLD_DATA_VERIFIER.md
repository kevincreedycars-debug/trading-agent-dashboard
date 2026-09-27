# Gold data verifier

An independent, seeded random re-verification of Gold data the backtester already gathered. It samples
recorded units, re-derives the values it checks from the artefact itself, and fails loudly on any
disagreement. It adds no measurement, gathers no new data, re-runs no evaluation and touches no live lane.

- Logic: `backtester/lib/gold_data_verifier.js`
- Runner: `backtester/scripts/run_gold_data_verifier.js`
- Declared sampling policy: `backtester/registries/gold_data_verifier_sampling.v1.json`
- Tests: `backtester/tests/gold_data_verifier.test.js`

## Why it exists

The accepted Gold census, the stored-versus-recomputed checker dataset, the single-variable report and the
sealed capture envelopes are all large, and until now each was trusted as written. This sub-project makes
the numbers falsifiable at random: the sampler picks units by seeded lottery, the verifier recomputes what
it can from the source, and any unit whose recorded value cannot be reproduced is reported with the exact
key, so a finding can be replayed by hand.

## How to run

```powershell
# Stored-versus-recomputed prediction rows only (the default target)
node backtester/scripts/run_gold_data_verifier.js

# Everything available, sampling 150 units per target and writing local evidence
node --max-old-space-size=4096 backtester/scripts/run_gold_data_verifier.js `
  --ledger '.local/worktrees/gold-research/backtester/tmp/combination-run-024-20260926-rev3/combination-ledger.jsonl' `
  --report '.local/worktrees/gold-research/backtester/tmp/ivr-coverage-019-20260925-r2/individual-variable-report.json' `
  --captures '.local/worktrees/gold-research/backtester/tmp' `
  --sample 150 --seed 424242 --out 'tmp/gold-data-verifier-20260927.json'

# One real capture lane, every envelope, judged strictly
node backtester/scripts/run_gold_data_verifier.js `
  --captures '.local/worktrees/gold-research/backtester/tmp/gold-qualification-window-018' --sample 50
```

`--help` lists every flag, including `--ledger-root` to follow the newest run directory, `--strict` to fail
instead of skipping a missing source, `--fixture-pattern` and `--strict-fixtures` to control fixture-lane
classification, and `--quiet` for a one-line status. Exit code 1 means at least one re-checked value disagreed
with its source, so the runner is safe to schedule. Reports are written only where you point `--out`, and they
belong in an ignored local folder (`tmp/`, `.local/`).

## What is re-derived, per target

**checker_rows** (`data/backtester-checker-gold-24h-2024-2026.json`, 608 rows). Every compared field present
on both sides must be equal, every nested block present on both sides must be equal, every difference entry
and factor comparison must carry a PASS status and a zero difference, net edge must equal bull case minus
bear case, participation must equal active directional weight, active weight must equal the bull plus bear
weighted totals, and the case split must be 100 or explicitly absent. The stored evaluation label is then
recomputed from the recorded prices alone: a missing price means `NOT_EVALUABLE`, a `NO_CLEAR_BIAS` call means
`NO_CALL`, a move inside `flat_threshold_used` means `FLAT`, otherwise `CORRECT` or `WRONG` by the sign of the
24-hour move. Finally the declared row summary is recounted over the whole file, not the sample.

**combination_ledger** (`combination-ledger.jsonl`, 4,956 candidate records). Per sampled record: direction
counts must sum to `n`, magnitude observations must equal `n`, `n` must not exceed matched anchors, the four
exclusion reasons must partition `attempts`, the endpoint denominators must sum to all computed, the year
breakdown must sum to `n` with each year's directions summing to that year's `n`, `eligibility.min_n` must be
the declared 20, and the reported or ineligible status must agree with it. Over the whole file the census is
recounted and reconciled against the accepted 28-factor census (status totals, observations, matched anchors,
direction split, denominator parts).

**report_cells** (`individual-variable-report.json`, 4,129 cells across 28 variables). Per sampled
variable/cohort/horizon/group/state cell: direction counts must sum to the cell `n`, magnitude observations
must equal the cell `n`, a year breakdown must never sum to more than its own cell `n` (below it is allowed
and recorded, because some observations carry no attributable year), each year's directions must sum to that
year's `n`, and the `small_sample` flag must match the declared minimum observations.

**capture_envelopes** (every `capture.envelope.json` under the given root). The decoded payload must hash to
the declared raw hash, the index payload hash must equal the envelope metadata raw hash, the envelope file
hash must equal the index envelope hash, index metadata and bindings must match the envelope metadata and
bindings, the state must be `complete_sealed`, and when the payload exposes an observation array its length
must equal the declared observation count.

## Fixture lanes

The collector test lanes (`gold-016-drift-`, `gold-016-recovery-`, `gold-016-seal-`, `gold-017-t-seal-`,
`gold-017-t-smoke-`, `coord-016-review-`, listed in the registry) exist to prove that drift, recovery and
sealing detection works, and some of them store an index hash that is deliberately stale. A lane counts as a
fixture when its envelope metadata declares `synthetic: true` or its path matches a declared pattern. Fixture
disagreements are counted and reported as `fixture_lanes` observations instead of live faults; every other
## First results, 2026-09-27

Two runs against the accepted artefacts, seeds `20260927` (40 units per target) and `424242` (150 units per
target): 160 and 600 units re-checked, zero mismatches, status `pass`. The whole-file reconciliations matched
exactly - the ledger recount reproduces 4,956 records (2,745 reported / 704 ineligible / 1,507 empty), 441,319
observations, 441,781 matched anchors and the 245,784 / 195,535 / 0 direction split, and the checker summary
recounts 608 of 608 pass with 608 exact matches. The `2026-09-28` feature envelopes in
`gold-qualification-window-018` verify 6 of 6 with no disagreement, which is the lane the Monday anchor depends
on. Local evidence: `tmp/gold-data-verifier-20260927-r4.json`,
`tmp/gold-data-verifier-20260927-seed424242.json`, `tmp/gold-data-verifier-window018.json`.

Four properties of the recorded data were surfaced by the first run and are recorded here because they are
observation-layer facts rather than defects:

- The accepted census declares a status class `unavailable` of 0 while no ledger record carries that status;
  the check now treats an absent class as zero.
- In the report's event cohort a state's year breakdown can sum below its own cell `n` (12 of 40 sampled cells,
  80 unattributed observations in total) because some observations carry no attributable year. The check now
  forbids exceeding the cell `n` and records the shortfall instead.
- The `gold-017-t-seal-*` test lanes carry index hashes that do not cover the envelope bytes on disk, while the
  real `window-018` captures hash exactly. They are classified as fixtures by declared pattern.
- The checker's `conviction_model` carries three keys the stored block omits (`final_confidence`,
  `headline_confidence_pct`, `confidence_strength`); one-sided keys are recorded as composition notes, and every
  key present on both sides is compared.

## Limits

- It re-checks recorded output. It cannot confirm anything the sources never recorded, and it cannot confirm
  that a provider sent what an envelope claims.
- Random sampling bounds effort, not error. A clean sample is consistent with, not proof of, a clean
  population. Seed, sample size and every sampled unit key are written into the report, so coverage is known.
- No new measurement, no new data collection, no Layer 1 logic change, no warehouse, workflow, credential or
  deployment action, and the sealed prospective window is not read. Evaluation stays sealed until
  `2027-03-25T15:00:00Z`.
- A passing verification run is not evidence of predictive accuracy, timing, profitability or trading edge.


