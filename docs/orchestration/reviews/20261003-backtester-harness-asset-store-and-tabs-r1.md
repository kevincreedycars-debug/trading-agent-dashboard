# Review: 20261003-backtester-harness-asset-store-and-tabs-r1

- Worker: `backtester-harness`, assignment `backtester-harness-001`, lane `design_records_accepted_awaiting_user`.
- Mailbox submission: `.local/orchestration/inbox/backtester-harness/20261003-backtester-harness-asset-store-and-tabs-r1.json`,
  9,963 bytes, sha256 `7d3563b71b0af1be53df2d243d41789182ff461fe42b093206e2190a5072c848`.
- Reply: `.local/orchestration/replies/backtester-harness/20261003-backtester-harness-asset-store-and-tabs-r1.json`,
  4,993 bytes, sha256 `f4f40e5ae6ca70f42b1d237b518004c14c09614123579a8a95206e6761040ef2`.
- Decision: **changes_requested** - documentation revision only. No Stage B, build, acquisition, import,
  warehouse, dashboard edit, integration or deployment follows from this review.
- Reviewed by the background coordinator run that owned the controller lock on 2026-10-03. No subagent, no
  controller or bridge change, no production action, no warehouse mutation, no holdout consumed.

## Inspected material

Reported HEAD `4e2cf7e` (committed 16:29:48); disclosed earlier chain `40d2546`, `79c7370`, `aea87e4`,
`31a6281`; worktree `D:/trading-agent-dashboard-codex/.local/worktrees/backtester-harness`, branch
`workers/backtester-harness-20260930`, no upstream. Changed set: `docs/backtester-harness/ASSET_DATA_AND_TABS_PLAN.md`
(added) and `docs/backtester-harness/CONVERSATION_NOTES.md` (modified). Companion files declared unchanged:
`HARNESS_ARCHITECTURE.md`, `DATA_ANALYSIS_STRATEGY.md`, `ASSET_ENGINE_CYCLE_TIME_PLAN.md`.

## Independent checks that reproduce

- The report is accurate for the head it names: `git rev-parse 4e2cf7e:<path>` returns blob `7d093c61` for
  `ASSET_DATA_AND_TABS_PLAN.md` and `e1857f49` for `CONVERSATION_NOTES.md`, exactly as declared, and the three
  companions reproduce as unchanged (`3548290a`, `fb204d49`, `b0b5061a`).
- Both declared raw-byte digests reproduce exactly: `595ee4c9...` at 20,471 bytes / 279 lines and `b1eaf455...`
  at 13,674 bytes / 208 lines.
- The production record correction is right and is now adopted centrally: `origin/main` is `f8bc80f` on
  `2f25c8c`, released `gold.html` is 5,733 bytes, `index.html` is 18,775 bytes, and the served `index.html` does
  emit the four `side-rail-group` captions.
- Section 2's substance holds on production: `.side-rail-group` is 9 px / weight 700 / letter-spacing 0.14em /
  `#697f96` and is `display: none` in the narrow-width media query.
- Sections 4 and 5's reuse claims hold: `backtester/sql/003_generic_historical_warehouse.sql` is a multi-asset
  raw layer, the OANDA and FRED importers are instrument/series parameterised, five snapshot builders and five
  snapshot tables exist, and `backtester/sql/` holds ten migrations.

## Defects that require a new submission ID

1. **Undeclared post-report commits, second cycle in a row.** The branch tip advanced to `b778c95` at 16:41:28,
   eleven minutes after the report was filed, adding 466 lines the report never mentions:
   `RAIL_ACCORDION_SPEC_20261003.md` (new, 363 lines, blob `4a3491c9`), +66 lines in `ASSET_DATA_AND_TABS_PLAN.md`
   and +37 in `CONVERSATION_NOTES.md`. The same class of gap was already recorded against the stage-A acceptance.
2. **Per-asset inventory measured from the wrong tree.** Sections 3, 5, 7 and 8 measure the worker branch - the
   orchestration control-plane lineage, which diverged from production at `125d871` on 2026-09-07 (this branch
   200 commits on, `origin/main` 297 on, of which 262 are automated data refreshes) - while sections 1, 2 and 9
   assert production facts read from `origin/main`. Measured against `origin/main`, four claims fail:
   `logic/agent_silver_direction.md` and `logic/agent_wti_direction.md` both exist (added 2026-09-12, blobs
   `40d96173`, `2a7acc88`; the Silver document is a full ten-factor contract with weights, snapshot contract and
   provider status); `origin/main:data/layer1.json` (`last_updated_et` 2026-10-02T07:29:28.874Z) carries eight
   live agents - USD, EUR, GOLD, SILVER, NQ, BTC, WTI, GBP - each with a `logic_document` pointer and a sealed
   call, so "five agents only" is a 2026-09-07 reading of this branch's 407,370-byte copy; GBP does have a
   Layer 1 output on production; and the `styles.css` line citations 8326-8333 / 8445-8447 are this branch's
   offsets, not the served page's (production 7802-7809 / 7919-7923, identical rule content).
3. **The reverse error too.** `backtester/replay/gbp/gbp_replay_core.js` and its test exist on this branch and
   nowhere on `origin/main`, so the GBP row overstates production readiness.
4. **Section 8's conclusion and user decision 2 are mis-framed.** Silver and WTI do not need a factor definition
   first; production already carries one for both. The genuinely missing piece for them is the backtester-side
   store - snapshot table, builder, checker data, price importer - and that is the real gap and the real decision.
5. **Materialisation disclosure wrong.** The plan declares both changed files LF-form with zero CRLF; both are
   CRLF-form (279 and 208 CRLF), and only the CRLF bytes reproduce the declared digests.
6. Minor: `backtester/scripts` holds 41 files whose name contains gold, not 42.

## Not a defect, and recorded as it stands

The five user decisions in section 11 remain open and remain the user's: store shape A versus B, the Silver and
WTI scope, one assignment versus seven, the ordering, and the coverage window. The lane's own later, undeclared
`RAIL_ACCORDION_SPEC_20261003.md` already re-measures from `origin/main` at `f8bc80f` and states that the
canonical checkout is stale for the rail region, which corroborates defect 2 rather than excusing it.

## Integration and deployment status

Nothing is integrated, merged, published or deployed by this review. The lane keeps design-only authority inside
`docs/backtester-harness/` plus ignored `tmp/`. Stage B stays closed. The five user decisions stay with the user.

## Opening state

A superseding filing, `20261003-backtester-harness-asset-store-and-tabs-r2` (12,820 bytes, sha256
`a727c850ca032436ce86888b9f38fc90977fa74abcd81c7c72b04dcd3f1f3d71`), arrived at 16:43:46, after this cycle's
queue read and before the reply was written. It is left untouched and pending. It is the next cycle's first
item, and it addresses defect 1 by disclosing the rail spec; defects 2 to 5 must be checked against its bytes.