# Shared baseline, 2026-11-24 (both lanes)

This is the one baseline both lanes read before their next edit. It is written by the coordinator
lane and describes `main`, the live page and the evidence behind them at the close of the 2026-11-24
release; where this file and a lane's memory disagree, this file is the record. The design lane's
own tip (`7ba4fc82`) is **not** part of this baseline and is not to be merged wholesale.

## 1. The commit both lanes start from

`origin/main` is `34c62426` - the accessibility pass (PR #36) - plus this publication's merge commit
for `release/bev2-deployed-dim` (PR #37). The exact merge commit and the live read-back are recorded
in `docs/PUBLICATION_20261124.md`; the artefacts below are byte-identical to the committed blobs at
that commit.

## 2. What the page is

`backtest-engine-v2.html` reads `backtester/assets/backtest-engine-v2.manifest.json` and the ten
artefacts its `sources` block names. It draws twelve steps in four bands (`inputs`, `decision`,
`measurement`, `proof`) and prints a sources panel whose timestamps come from each artefact's own
field. Nothing on the page is typed in by hand.

A step's chip is the worst of **four** dimensions, declared in the manifest's `dimensions` block:

| Dimension | What it means | Where it is read |
| --- | --- | --- |
| `software` | the code exists in this checkout and its own checks pass | evidence, spec, coverage, retrieval |
| `deployed` | that exact build ran in Cloud, and an execution shows it answering | `fresh-call-v1.json` only |
| `data` | the morning values and outcomes the step consumes are present and scored | coverage, spec, readiness |
| `research` | the claim has been independently adjudicated, not merely reproduced | `evidence.claims` |

`deployed` is complete for the paired controller, both challengers, the fixture and the fresh-call
step, and `inactive` (from `defaults.readiness.deployed`) for the seven steps that are not Cloud
workflows. The evidence is: parent `89uk5JnPbWPL5lGD`, bundle `usd-l1-cloud-runtime-v3`
(`9c722a0e...`, 124,084 bytes), parent execution `7260`, children `7261` (challenger) and `7262`
(challenger v1), captured `2026-11-24T06:43:03Z`. The two challenger pips are read from their own
child execution (`child_executions[model=challenger]` and `[model=challenger_v1]`), not from an
array index.

## 3. The numbers, and what they do not claim

- Published readiness: **4 scored, 1 proxy-scored, 8 measured by tick replay, 11 blocked**, over 24
  combinations. The 4/1/8/11 block is the only published readiness.
- The scratch run with the H1 series present reads **7/1/8/8**. It is `unpublished_research` with
  `published: false` and the page prints it only as "unpublished research evidence, not live
  readiness".
- XAG/WTI/GBP direction cells read `pending_data_distribution`; their L2L cells name both missing
  datasets (bid/ask 5-minute tape, pre-session level ladder). The acquired rows stay in
  `backtester/tmp/` (gitignored, licensed quote history): 17,149 / 17,139 / 18,026 H1 rows, 569 / 568
  / 572 sessions with both 05:00 London endpoints of 725. No published count uses them.
- `advantage.status` is `not_established`; historical input availability across the 725 mornings is
  `not_established`; one captured execution is one morning, not a sample.
- WTI is the provider's `WTICO_USD`, not the execution venue's `USOIL`; the acquisition record says so
  and readiness keeps `broker_symbol_confirmed: false`.

## 4. Rules for the next design branch

1. Do not merge `7ba4fc82` wholesale; it rewrites the manifest, reader and guards that `main` has
   since moved. Start from this baseline and re-apply only what still adds something.
2. Keep one `Fresh-call proof` step bound to `fresh-call-v1.json`; no second capture source or second
   step for the same evidence.
3. Keep one `sources` list with `verified_at` per artefact, one readiness source, and one rail entry
   (`Evidence -> Backtest Engine v2`). Nav, copy and the four-band diagram are not duplicated.
4. Deployment is a **dimension**, not a node: add evidence to `readiness.deployed` or the manifest's
   defaults, never a new step for it.
5. A status may only come from an artefact the page reads. A sentence with a hole in it is not
   printed: every `{{path}}` in a note must resolve or the note is omitted.

## 5. Refresh and guards

Refreshing the map is an artefact rebuild, never a UI edit:

```
node scripts/build_backtesting_screen.js --write
npm run build:usd-l1-market-readiness
npm run check:usd-l1-market-readiness
npm run prove:usd-l1-fresh-call
npm run check:usd-l1-fresh-call
```

Guards at this baseline: `backtester/tests/backtest_engine_v2.browser.test.js` 11/11 (includes the
deployment dimension, the 12px label floor and the inside focus ring),
`backtester/tests/site_nav_consistency.browser.test.js` 7/7,
`tests/usd_l1_market_readiness.test.js` 8/8, `tests/h1_oanda_acquisition.test.js` 4/4 (new),
`npm run screen:backtesting:check` reproduces, and
`node backtester/scripts/build_shared_nav.js --check` reports 15 pages / 21 rail entries / 9 outbound
/ 0 changes.

## 6. What moved in this publication

- PR #36 (`34c62426`, design lane): keyboard focus drawn inside the shared rail entry, and a 12px
  floor on every word in the block and on the control-room page.
- PR #37 (this release): `deployed` separated out as its own readiness dimension, read from the
  captured execution; a dimension key and an accessible name for the pips; the fresh-call and
  controller notes no longer claim a deployment inside `software`.
- Readiness now carries the licence position ("the rows are a licensed quote history") instead of
  `null` in each held market's `direction.acquisition.licence`; the artefact rebuilds to
  `readiness_sha256` `d3e3778b...`. The guard binds the record, the readiness copy and the published
  counts, and refuses a committed CSV.

## 7. Open blockers (unchanged unless a decision lands)

- The XAG/WTI/GBP **data-distribution decision** (commit the licensed rows, or document the download
  step). Counts stay 4/1/8/11 until it lands.
- L2L for those three markets: no pre-session ladder and no bid/ask tape.
- Historical input availability across 725 mornings: `not_established`.
- WTI `WTICO_USD` vs `USOIL`: unreconciled.
- `.local/wt/bev2-release` is gitignored and not a registered worktree; remove it once its holding
  process exits.
