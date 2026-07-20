# Session Notes

Last updated: 2026-07-20

## Work Completed

- Confirmed the current production baseline is the deployed dashboard at commit `a15100d62f9a8a4c6ad6d8390f97f7de25ca1cdd`.
- Confirmed the visible Layer 1 `24H` ET expiry blocks, UK/ET header clock, Directional Viability spacing fix, and Overview prose removal are already deployed and validated.
- Identified `CODEX_STARTUP.md` as the instruction source causing routine `.claude/launch.json` prompts and prepared the minimum startup-rule correction.
- Identified that the current active-state project memory pointers were still aimed at the earlier shadow-backtest task and needed correction before the next startup.
- Deployed UK-time hover/focus tooltips on every available Layer 1 `24H` expiry section while preserving the visible ET expiry.
- Verified that the tooltip converts the same expiry timestamp into UK time with browser-native `Intl.DateTimeFormat` using automatic GMT/BST handling.
- Verified live GitHub Pages asset cache busting and live tooltip behavior after deployment.
- Approved the Architecture Mirror direction: top-level `Architecture` tab, checked-in `data/architecture-map.json` manifest, custom HTML/CSS/SVG renderer, overview map plus expandable module maps, and a read-only documentation surface with no effect on production or research logic.

## Unfinished Work

- Design and build the Architecture Mirror.
- Define the checked-in architecture manifest.
- Build the first overview map and expandable module maps.

## Blockers

- No repository-side blocker.

## Assumptions

- The Architecture Mirror remains read-only and must not alter production or research logic.
- The first Architecture release should be driven from a checked-in manifest rather than hand-maintained independent diagrams.
- Production versus research-only boundaries and failure/status paths must be explicit in the mirror.

## Exact Next Task

Design and build the Architecture Mirror using a checked-in manifest and custom renderer.
