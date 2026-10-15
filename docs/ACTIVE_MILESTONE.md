# Active Milestone

Delivery note, 2026-10-15 (USD session brief-delivery cycle, interactive coordinator), prepended without changing the milestone below: the twenty-five self-contained USD research briefs the user asked for exist as files rather than as a description. `docs/research/handoff/usd/v1/` carries 34 generated files - 25 briefs under `packs/` (10 baseline audits of the deployed factors and 15 session-research briefs authored in `scripts/build_research_handoff.js`), `BRIEF_INDEX.json`, `tracker_tasks.json` with 25 rows, `START_HERE.md` with the numbered list of all twenty-five briefs and a link to each, and `usd-research-handoff-v1.zip`, a stored archive the builder writes itself and which verifies byte for byte. Every brief states 05:00 `Europe/London` to 05:00 `Europe/London` on the next local date, and the builder refuses to write unless the authored briefs cover the catalogue's non-live factors exactly. The same 25 files are published in the Research Library: each factor page offers Copy prompt and Download for its own brief, the panel reads 25 of 25, and no research status moved (22 ready, 3 blocked, nothing uploaded, accepted or scored). Tasks `USD-SESSION-A3`, `A4` and `A5` now cover all 25 factor ids. Guards: `test:research-handoff` 12 of 12, `tests/research_library.test.js` 18 of 18, `tests/research_library.browser.test.js` 1 of 1. Nothing live changed: no workflow, feed, credential or dispatcher file was touched.

## Current Feature

Architecture Mirror

## Current Milestone

Read-only Architecture Mirror implemented and deployed

## Status

Awaiting review

## Completed Work

- CLIXML-based credential continuity is complete under `%USERPROFILE%\.trading-agent-dashboard\`.
- Repository bootstrap and validation wrappers are in place for future Codex sessions.
- Eight continuity variables are present in the encrypted local store.
- `OANDA_ACCOUNT_ID` is confirmed conditional and currently absent without blocking ordinary OANDA candle downloads.
- Read-only connectivity validation passed for `n8n`, Supabase, FRED, OANDA, and Alpha Vantage.
- RapidAPI credential loading is confirmed, while external endpoint verification remains inconclusive due to timeout.
- Isolated backup/restore validation passed for the CLIXML store.
- UK-time hover/focus tooltips are deployed on every available Layer 1 `24H` expiry section.
- The visible Layer 1 expiry remains in ET.
- The tooltip converts the same expiry timestamp to UK time with automatic GMT/BST handling.
- The UK/ET live header clock, Directional Viability spacing fix, and Overview prose removal remain intact in production.
- Deployed the original Architecture Mirror implementation at commit `2c4f0cc177b6cca9ac26d72a7cfac939de84e4d2`.
- Replaced the old horizontal Architecture graph with the vertical waterfall renderer at commit `7586016d89c1e06c9f20beed3201034248d1e048`.
- Published the cache-busted waterfall deployment at commit `9407893cc668b47fc9ddddf0cfa4b9e8a6f722bc`.
- Added the top-level `Architecture` tab with lazy manifest loading and isolated failure handling.
- Added the checked-in manifest and schema with 36 nodes, 59 edges, 5 boundaries, and 13 views.
- Added deterministic manifest validation and direct validator rejection tests.
- Verified the live GitHub Pages deployment serves the Architecture tab, manifest, updated script, and updated styles.
- Reworked the Architecture renderer so Overview uses the exact 8-stage top-to-bottom order, focused views use deterministic vertical waterfalls, parallel nodes stay in contained responsive grids, and the selected-node panel sits below the canvas.
- Removed the active horizontal graph path by using no absolute node placement, no SVG bus routing, and no horizontal scrolling in the deployed Architecture renderer.
- Verified geometry checks across all 13 Architecture views and live viewport checks at `1440x900`, `1920x1080`, `1024x768`, and `390x844`.

## Remaining Work

- Await review of the deployed vertical-waterfall Architecture Mirror.
- Preserve the six explicitly unverified architecture areas until stronger repository evidence exists.
- Do not start a new milestone until a documented follow-up task is approved.

## Current Files Being Modified

- `docs/CURRENT_STATE.md`
- `docs/CURRENT_TASK.md`
- `docs/ACTIVE_MILESTONE.md`
- `docs/SESSION_NOTES.md`
- `docs/CHANGELOG.md`

## Blockers

No repository-side blocker.

## Next Immediate Action

Review the deployed Architecture Mirror and decide the next milestone.

## Last Updated

2026-07-21 17:55:00 Europe/London
