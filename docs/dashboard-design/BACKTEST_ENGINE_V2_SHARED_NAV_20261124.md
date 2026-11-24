# Backtest Engine v2: shared navigation restored

2026-11-24, after the user approved the drawing on `backtest-engine-v2.html` and ruled that the page stays part
of the live dashboard. The drawing is unchanged. The page's own navigation was removed, on the user's
instruction, because it had replaced the shared one.

## What was wrong

Two layers had taken the bar and the rail over:

1. `body class="control-room-reference"` plus a 60-line section at the end of
   `backtester/assets/backtest-engine-v2.css` restyled them: cyan glyph and 26px brand, `topbar-meta` hidden
   (so the date and both clocks disappeared), `side-rail-head` and `side-rail-foot` hidden (so the ADM mark,
   the "Control Room" label and "Published dashboard" went), a 190px rail with 52px glowing entries, and a
   page-wide `outline-offset: 3px` focus ring that the rail's own clip cuts away.
2. `simplifyNavigation()` in `backtester/assets/backtest-engine-v2.js` renamed the brand to "Backtesting
   Control Room" and rebuilt the rail into six entries plus an "All dashboard pages" disclosure holding the
   originals. This was invisible to the byte-for-byte nav test because it happened at run time.

## What changed

- `<body>` carries no class; the `.control-room-reference` rules are gone, including the 190px rail query and
  the nav-only breakpoint.
- `simplifyNavigation()` and its call are gone. The shared block now renders as written.
- The page focus ring is scoped to `.cr-page` and drawn inside (`-2px`), so it cannot overrule or be clipped
  by the rail.
- The sheet breakpoint in the base sheet moved from 1180px to the approved layout's 1000px. At 1180 the old
  pair disagreed with the script (`innerWidth > 1000` selects a step on arrival), so the page opened with a
  backdrop over the drawing and the first click was swallowed. The approved block and the script now agree.
- At 1001-1250px the third grid column is 128px, the Outcomes card drops its icon there and node titles wrap
  at word boundaries. Before, "Outcomes data" broke mid-word once the rail took 232px instead of 190px.

## What did not change

Manifest, artefacts, numbers, states, verdicts, labels, links, routes, anchors, the ten nodes, the three
bands, the nine connections, the right-hand inspector and its evidence. No data file was touched. No node was
added for the coordinator's n8n data-gathering workflow and no workflow link or readiness figure was invented:
that integration stays distinct from Layer 1 analysis and waits for the verified workflow ID and contract.

## Evidence

- `node backtester/scripts/build_shared_nav.js --check`: 15 pages, 21 rail entries, 9 outbound, 0 change(s).
- Bar and rail measured against `standing-dashboard.html` (same shared block) at 1440 and 390: brand, meta,
  rail position/width/top/background, head, foot, group and tab type, and all 31 rail labels identical.
- `backtester/tests/backtest_engine_v2.browser.test.js`: 6/6, including a new guard that compares this page's
  rendered rail with a second served page at 1440 and 390 and fails if the brand is renamed, the head, foot,
  meta or clocks are hidden, the entries or their order change, or Backtest Engine v2 leaves its place directly
  below Evidence.
- `backtester/tests/site_nav_consistency.browser.test.js`: 7/7, including the 12px floor and inside-ring test
  that names this page, run after the cache-bust token was renamed away from `shared-nav` (the guard objects
  to any request whose URL looks like the navigation file).
- `backtester/tests/backtest_engine_v2.presentation.test.js`: 4/4 (three groups, ten nodes, nine connections).
- Rendered at 1440, 1366, 1280, 1180, 1100, 1024, 900, 768, 620, 390: no sideways scroll, no console error,
  stage never overflows, rail visible at every width, 3 bands / 10 nodes / 9 wires throughout.
