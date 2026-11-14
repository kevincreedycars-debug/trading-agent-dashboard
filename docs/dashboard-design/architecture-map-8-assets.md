# Architecture map: eight assets, offline

2026-11-14 · branch `design/architecture-map-8-assets` · not merged, not deployed

## What changed

- The Architecture tab now mounts a self-contained eight-asset system map instead of the Architecture Mirror
  manifest panel. The host supplies the page heading (`One market. Eight calls. One execution join.`) and the
  map starts at its controls. The map does not fetch, and it has no canvas in embedded mode.
- The Overview header carries one link, `Open architecture map`, to `#architecture`. The link switches tabs and
  scrolls the map into view; opening `index.html#architecture` directly also loads the map.
- The map module is injected only when the Architecture tab is opened. The map uses no remote font, image,
  script or data file. Its hologram is omitted here and honours reduced motion when used standalone.
- The top bar and side rail were not re-labelled, re-ordered, added to or removed.

## Files

- `lib/system-map.js` (new) · `system-map.css` (new)
- `index.html` · `script.js` · `styles.css`
- `tests/system_map.browser.test.js` (new)

## Verification

- `node --test tests/system_map.browser.test.js`: 2/2 pass.
- Browser suite: 101 pass, 8 fail. The two map tests pass (109 total). The eight failures are outside this
  change: the live tip already carries an extra `USD L1 Backtester` top-bar entry that the shared-nav partial
  does not list (tests 8 and 10); the remaining six are M5 chart marking, a Layer 1 publication timeout, two
  Overview freshness fixtures, and a research-library private-store UUID expectation. The shared-nav
  `--check` reports the same pre-existing index.html refresh. The nav contract in this lane forbids changing it.
- Width sweep at 390, 768, 900, 1024, 1100, 1280, 1440 and 1600: embed true, 0 hero, 0 full-map link, 8 lanes,
  48 nodes, 6 stages, 7 pairs, 0 canvas, 0 document overflow, 68px row-label height, label hit target true,
  15 chips at least 32px high. The board scrolls and shows its hint below 1280; at 1280 and above it fits with
  no hint and no scroller focus stop. At 1100 the board scrolls by 142px, which is inside the scroller.
- All labels fit at every width; row labels stay inside the scroller at scrollLeft 0, 18, 80 and 240.
- No page errors while the map opens. The only console errors are pre-existing local 404s for
  `data/half-l2l-reach-research.json` and `/api/l2l-levels`; they are not requested by the map.

## Out of scope / open

- `has-side-rail` is not used by this page or the map. The host page already has its rail; no class was added.
- No standalone map page is published; the module keeps its standalone hero for a future host.
- The browser suite is not fully green on the live tip for the reasons above. No nav, data or data-file change
  is made here to hide them.
- Preview from the worktree with `node scripts/research-library-server.js --serve-repo`; publish only on the
  user's go-ahead, after fetching and rebasing onto the live tip.
