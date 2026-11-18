# Strategy audit handoff (imported)

These files were brought in from the strategy advisory lane on 18 November 2026 as labelled audit
evidence. They are advisory: they do not change a model, a threshold, a production file or a live
path.

| File | What it is |
|---|---|
| `BACKTEST_AUDIT.md` | The legacy audit of the backtest and research artefacts, including the 0-of-725 gate and the contradictions it found. |
| `BACKTEST_HANDOFF_FOR_COORDINATOR.md` | The handoff for the central Backtesting area: reusable assets, gaps and the blank half-level view. |
| `backtest-index-v1.json` | The machine-readable index behind that handoff. |
| `V0_1_1_PROPOSALS_20261118.md` | The strategy lane's six-entry v0.1.1 proposal set (`P-01`…`P-06`). |
| `STATUS_H1_20261118.md` | The strategy lane's status snapshot at `64a96163`. |
| `proposals/H1_ICE_TIMING_20261118.js` and `.test.js` | Executable ICE timing spec and 13 tests. |
| `proposals/H1_V0_1_1_PROPOSALS_20261118.json` | Machine-readable mirror of the six proposals. |

## What the newer delivery changes

The status snapshot records two red gates at `64a96163`. Both are resolved in this delivery:

- The committed screen payload now reproduces byte for byte after the report and morning artefacts
  were rebuilt in dependency order (`npm run screen:backtesting:check`).
- `index.html` now links to `backtesting.html`, so the hosted visual dashboard is reachable from the
  Backtesting tab as well as by direct URL.

The snapshot's statement that another worker was editing `h1_coverage.js` and had added
`h1_evidence.js` describes the work that is now committed. The evidence-mode split it observed is
the implemented historical-versus-sealed policy, not a half-finished edit.

The snapshot remains useful for its audit trails and its measurement of the live/published
difference. Its v0.1.1 section is superseded by
`docs/research/usd-session/h1/v0.1.1/PROPOSAL.md`, which reconciles the earlier four edits, the
review's three behaviour findings and the handoff's six proposals.
