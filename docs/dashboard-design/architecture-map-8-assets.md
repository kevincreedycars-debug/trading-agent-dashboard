# Architecture map: eight assets, interactive

2026-11-15 · branch `design/architecture-map-8-assets-integration` · not merged, not deployed

## What changed

- The Architecture tab still opens `lib/system-map.js`, but its default view is now an interactive factory: eight
  asset lanes drawn in Three.js with the vendored bundle at `lib/vendor/three.min.js`. Each lane runs from its
  incoming feed through a research desk, a replay chamber and an independent Layer 1 core to the single Layer 2
  junction, then to the VPS terminal, the two live FTMO lanes and the conditional payout. No lane meets another
  before the junction.
- The flat board is unchanged and stays mounted. It is the alternative view, and it is what a browser without
  WebGL gets automatically: the mode switch disables its factory button and the board is shown with a note.
  `?map=flat` pins the board.
- Every station answers the same five questions in a side inspector, with links to the committed document,
  workflow export, table or source file, and an explicit "what is undocumented" block when the repository does
  not record something.
- Two journeys run end to end: the USD research journey (inputs → research → red team → adjudication → the ten-row
  factor register → one documented factor → four separate replay tests → the core → the validation gate) and the
  EUR/USD execution journey (two independent cores → the junction → the pair output → the VPS → both FTMO lanes →
  the conditional payout).
- The scene supports orbit, wheel and pinch zoom, reset, pause, keyboard selection, reduced motion (a still frame,
  no packets, no camera tween) and a phone layout where the panel sits under the scene.
- Nothing on the page reads live data. The HUD labels the flow as illustrative, the packet motion is decoration,
  and the payout step is dotted because it is conditional and not automated.

## Files

- `lib/system-factory.js` (new) · `lib/system-map.js` · `system-map.css` · `index.html` · `script.js`
- `tests/system_factory.browser.test.js` (new) · `tests/system_map.browser.test.js`
- The factory is loaded from `lib/system-map.js` only when the Architecture tab is opened, only after the WebGL
  probe passes, and only from this origin: `lib/vendor/three.min.js` then `lib/system-factory.js?v=20261115-factory-3d`.

## Verification

- `node scripts/test-local.js`: 884 tests, 875 pass, 5 fail. The eight map tests pass - six new factory tests and
  the two existing map tests (`ok 850`-`ok 857`). The five failures are outside this lane: two shared-navigation
  contract tests that already fail on the live tip, two M5 chart pan/zoom tests, and the research-library browser
  file. No navigation, data or data-file change is made here to hide them.
- The new guard checks: the scene mounts at Overview → Architecture with one canvas and 46 stations; a station
  selected through the index, through the scene (a raycast click on the projected mesh) and through the keyboard
  (arrow keys plus Enter) opens the same five questions; every evidence link returns 200 from the preview root;
  both journeys produce their documented step titles; the four replay tests and the ten register rows are
  individually selectable; the pair route lights both lanes; the payout step reports what is undocumented; a
  context that reports no WebGL lands on the flat board with the factory switch disabled; reduced motion holds the
  packet and camera still; the phone layout keeps the scene, the panel and all 46 index buttons usable and adds no
  horizontal overflow.
- Evidence links were checked with `fetch` from the page against the local server: the USD core's five links, the
  F5 factor's five links, and every journey panel link resolve. Nothing points at a folder where a specific
  artefact exists, and no link points outside the repository.
- Local captures (ignored by git, in `tmp/preview/`): `shot-1-whole-factory.png`, `shot-2-usd-factor.png`,
  `shot-3-eurusd-lanes.png`, and `journey-eurusd.webm`, a recording of the execution journey.
- Preview: `node scripts/research-library-server.js --serve-repo`, then open `index.html` and follow
  `Open architecture map`.

## Out of scope / open

- The factory adds no data: every fact in the inspector is transcribed from a committed document, export or source
  file. Where the repository is silent - WTI and GBP have only a logic document, no pair has a replay result, the
  payout route has no workflow - the inspector says exactly that.
- No local preview of a station, no animation of a specific replay, and no comparison chart: the four tests are
  described, not graphed, because no replay result is committed to graph.
- Public publication of `docs/` is a separate decision. The evidence links resolve from a preview served at the
  repository root; publishing the dashboard alone would leave them pointing at paths the public site does not
  serve. That is why this lane stays local pending publication approval.
- Preview from the worktree with `node scripts/research-library-server.js --serve-repo`; publish only on the
  user's go-ahead, after fetching and rebasing onto the live tip.
