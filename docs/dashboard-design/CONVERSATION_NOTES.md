# Dashboard design - conversation notes

Durable record of what was asked, what was measured and what was decided. Nothing here decides anything.

## 2026-10-15 - second working turn: the factor table's wasted half, fixed in the worktree, nothing published

### What was asked
- In chat, the user asked for the Research Library factor table on the Evidence tab to use the full width of its panel:
  as served it sat in the left half of the page with its headings and status pills broken mid-word.

### The served page read first (over HTTPS, before the change)
- `/index.html` HTTP 200, 28,856 bytes, sha256 `8c148a1f6b79…` - the live tip `4f9f77ea` is one data-file commit behind
  this checkout, and the page's bytes are unchanged from the 2026-10-14 reading. 460 lines, 18 tab buttons, the rail
  carrying a `Research Library` button; the panel body is not in the page's bytes because `script.js` injects
  `<section class="rl-shell" data-rl-shell="true">` (script.js line ~7675). The worktree copy is the same bytes with CRLF
  (29,315 bytes; identical once line endings are normalised).
- **A mis-read corrected:** a `Select-String` hit at "index.html line 7675" was first taken to mean the served page had no
  panel at all. That hit was the second pattern in the same command, run against `script.js`. Both files were then
  measured with node: 460 lines each, identical after line-ending normalisation.
- `/styles.css` HTTP 200, 229,068 bytes, sha256 `92671223f061…`, and it carries the defect as served:
  `.rl-shell { display: grid; gap: 18px; min-width: 0; }` with no `grid-template-columns`.
- Served page in a real browser (off-origin feeds aborted, page and fonts kept), clicking the Research Library tab: at
  1440px the shell is 1160px wide in **two** tracks, 553px + 589px, so the factor table's card is 553px, the narrowest of
  its nine columns is **39px**, all nine headings wrap and **75** status pills wrap. At 390px one track of 370px, narrowest
  column 31px, headings still wrap. `documentOverflow` 0 at both.

### What was changed, and how far it was checked
- `styles.css`, 14 lines: `.rl-shell` pins `grid-template-columns: minmax(0, 1fr)` and `.rl-shell > * { grid-column: 1 / -1; }`,
  with the reason written above it - `.wide-panel`'s `grid-column: span 2` belongs to the multi-column grids elsewhere on
  the dashboard, and in a grid with no explicit columns it opened a second implicit column, halving every card that does not
  span it, the factor table among them. `.rl-table th` and `.rl-table .rl-pill` gain `white-space: nowrap` so a heading or a
  pill is never broken mid-word.
- `tests/research_library.browser.test.js`, 36 lines: a guard on the factor table's layout, asserting the shell is one
  track, the table's card fills the shell to within a pixel, no column is under 50px, no heading wraps and no pill wraps.
  One line versus wrapped is told apart with `Range.getClientRects()` rather than cell heights. The measured layout is kept
  in the audit file the test already writes.
- After, from this checkout at eight widths: table 1398 / 1278 / 1118 / 958 / 867 / 867 / 867 / 867px; narrowest column
  73 / 68 / 62 / 55 / 51 / 51 / 51 / 51px; the table's own scroll takes over below 1024px (165px at 1024, 523px at 390) and
  the document never gains width (`documentOverflow` 0 at all eight). So `nowrap` costs the page nothing.
- Sensitivity: `tmp/verify-guard-before.js` re-injects the old `span 2` layout into the served-shape page and the guard
  trips - 2 tracks, card at half width, columns 41px, 8 wrapped headings, 75 wrapped pills.
- The lane's own file: `node --test tests/research_library.browser.test.js` -> 1 test, pass 1, fail 0.

### The suite's nine reds are pre-existing (proved, not argued)
- Full suite with the change in place: 63 ok / 9 not ok. The same four files re-run with `styles.css` and this lane's test
  stashed (`tmp/run-baseline.js` -> `tmp/baseline.log`): 3 ok / 9 not ok, the same nine names. No check moves because of
  this change.
- Causes, established from the tree itself:
  1. Two nav checks. `backtester/scripts/build_shared_nav.js` renders **16** rail buttons and none of them is
     `Research Library`; `index.html`'s rail carries **17**, that one inserted after `Live Trading`; the guard's pinned list
     is 17 labels (`Overview` plus the 16). So `--check` reports "index.html [dashboard]: refreshed" and the label list
     mismatches. That is the `bbb8ad25` Research Library commit hand-editing one page's rail without the partial.
  2. Five live-trade-logic checks. `live-trade-logic` exists nowhere in the rail, the partial or `script.js`; the test file
     landed ahead of its page change.
  3. Two chart checks. They assert 120 BTCUSD M5 bars; the committed `data/live-trading.json` holds **576** and is
     unmodified in `git status`, so the expectation is stale against the live feed.
- Under the hard lines none of the nine is this lane's to touch: adding or removing a rail entry is forbidden here, and no
  page outside the fix may be edited. Recorded for the coordinator instead.

### One-writer check (hard line 6)
- `node scripts/coordination.js check --worker dashboard-design`: mode `manual-file-mailbox`, **pending 1** - this lane's
  own 2026-10-14 submission, `pending_review`, no reply yet - and no other lane's page submission anywhere in the mailbox.
- `docs/orchestration/projects.json` row `dashboard-design` unchanged: `baseline def7cde`, status
  `instructions_published_awaiting_worker`. No `inbox/dashboard-design/` reply file exists.
- The page-touching commits on the live line (`bbb8ad25` the panel, `66e0b0b3` the dossier) are landed, not open. Nothing is
  mid-edit on the pages, so the work was clear to prepare.

### State at the end of the turn
- Nothing published: `git push` was not run, `origin/main` was not rebased onto, no page outside this checkout was touched,
  no data file, no credential, no register, assignment, mailbox, controller or monitor write.
- Modified and uncommitted, by design: `styles.css` (+13/-1), `tests/research_library.browser.test.js` (+36). Scratch
  scripts and screenshots live in the gitignored `tmp/` (`measure-rl-table.js`, `measure-live-table.js`, `read-live.js`,
  `live-structure.js`, `nav-diff.js`, `inspect-nav.js`, `run-baseline.js`, `verify-guard-before.js`, `browser-suite.log`,
  `baseline.log`, `live-read.json`, `rl-table-after-1440.png`, `rl-table-after-390.png`).
- Reported `paused` to the monitor, one line. What waits on the user: whether to publish this CSS-only fix now, given the
  nine pre-existing reds it neither causes nor fixes.

### Then, in the same turn, on the user's go-ahead: published

- The user answered the three questions: publish now (yes), leave the rail-label question alone for now, and this one
  change only. So the three-step order was followed.
- Preview from this checkout before committing: the lane's own server with `--serve-repo` served `index.html` at
  HTTP 200 and `styles.css` at HTTP 200, 238,736 bytes, carrying all four markers of the fix (one track pinned, child
  span cleared, headings nowrap, pills nowrap). `tmp/preview-check.js`.
- Commit `5724a170` "dashboard: give the Research Library factor table the full width of its panel": `styles.css`
  (+13/-1) and `tests/research_library.browser.test.js` (+36) only; `git diff --cached --name-only` showed exactly those
  two before committing, and no data file was staged.
- Rebase: `origin/main` had moved twice while the work was measured - `4f9f77ea` -> `887fecd4` -> `bd64dee3`, all
  data-file-only commits from the live-trading lane. Fetched, rebased onto `bd64dee3` cleanly (the changed files are not
  data files), fetched again at the tip, then pushed `bd64dee3..5724a170 HEAD -> main`. Fast-forward, no force.
  `git ls-remote origin main` = `5724a170`.

### The suite in the same change, and the two flakes it flushed out

- The assignment's command lives in the canonical project (`scripts/test-local.js`) and discovers its roots there, so
  its discovery was replicated verbatim from this checkout: three roots, two exclusions, `--test-concurrency=4`,
  15 files, 72 tests.
- With the change in place before the rebase: 63 pass, 9 fail - the known nine. Post-change run 1, on the rebased tree:
  61 pass, 11 fail - the known nine plus two overview freshness checks reading "No live publish window" where their
  fixtures publish Both layers live. Post-change run 2: 62 pass, 10 fail - the known nine plus
  "runtime-profile absence degrades to estimate unavailable", which failed with
  `page.goto: net::ERR_UNSAFE_PORT at http://127.0.0.1:2049/`.
- Control: a temporary worktree of the pre-change tree at the same rebased data (`887fecd4`), since removed, ran the
  same suite and came back 63 pass, 9 fail - the same nine names in the same order, no flake. That is one full run at
  the pre-change tree against two post-change runs; the earlier four-file baseline run at the pre-rebase data was
  flake-free too. The file that flaked passes entirely by itself with the change in place: 26 tests, 26 pass.
- Read from the harness rather than guessed: `createHarness` binds an ephemeral port (`server.listen(0, "127.0.0.1")`)
  so Chromium's blocked-port list can be hit at random, which is exactly what `ERR_UNSAFE_PORT` on port 2049 is; and the
  freshness assertions read the overview panel once `waitForFunction(/Freshness verdict/)` is satisfied, which the panel
  can satisfy before `/data/layer1.json` and `/data/layer2.json` have landed, so under load they read the
  no-publish-window wording. Neither path touches a stylesheet.
- Stated plainly rather than hidden: the lane's guard makes its own test file run a little longer, which can change how
  the four concurrent files interleave. The nine reds are the same with and without the change, at both data revisions.

### What is served, read back over HTTPS

- `/styles.css` HTTP 200, **229,980 bytes**, sha256 `9450b81ad63fbac2…` - byte for byte the committed blob
  (`git cat-file blob 5724a170:styles.css`, 229,980 bytes, same digest). The pre-publish wire copy was 229,068 bytes,
  sha256 `92671223f061…`, the defective stylesheet.
- `/index.html` HTTP 200, 28,856 bytes, sha256 `8c148a1f6b79…` - unchanged, the same size and digest as the blob at
  `5724a170` and as the wire copy read before the publish. No page byte moved, as the hard lines require.
- The edge copy lagged: right after the push the plain URL still served the old bytes and only a cache-busting query got
  the new file; the plain URL was then polled until it served the committed digest (`tmp/served-plain2.log`).
- Guard against drift: the same commit carries the four layout assertions, so a page that drifts back to a two-column
  shell, a half-width card, a crushed column, or a wrapped heading or pill turns the suite red.

## 2026-10-14, 20:58Z - first working turn: the live page was measured, a proposal was put to the user, nothing was changed

### Coordination read first
- `node scripts/coordination.js check --worker dashboard-design` from the canonical project:
  mode `manual-file-mailbox`, mailbox `D:\trading-agent-dashboard-codex\.local\orchestration`, **pending 0**, errors [],
  worker row status exactly `instructions_published_awaiting_worker`, assignment `dashboard-design-001`.
- No reply and no submission existed for this lane (no `.local/orchestration/inbox/dashboard-design/` folder), so no earlier
  work was repeated. The assignment's first task stands: the five USD research briefs belong on `usd-layer1-logic.html`.
- Authority read in full by absolute path: `docs/orchestration/README.md`, the assignment file, the reference
  `Design Reference/claude dash example.txt`, and the strategy lane's `RESEARCH_BRIEFS_FOR_ASTRA_20261014.md`.

### Measured over HTTPS, before anything else (working tree drifts, served bytes are the truth)
| Object | Served | Digest | Notes |
| --- | --- | --- | --- |
| `/usd-layer1-logic.html` | HTTP 200, **86,940 bytes**, 771 lines | sha256 `a983730e3a7e02635cad56d0dc1eb2e856f0ed097dd5d256e73eec78e48421f0` | byte-identical to `origin/main:usd-layer1-logic.html` (`git cat-file -s` = 86,940) |
| `/index.html` | HTTP 200, **28,856 bytes** | sha256 `8c148a1f6b793a630549ca0bce9dd71ea79543f5f3a7a353cd322056348e0976` | identical to `origin/main:index.html` (28,856 bytes) |
| `/styles.css?v=20261013-research-library-v1` | HTTP 200, **229,068 bytes** | sha256 `92671223f06110f6c07c333fdb615988fb4bb7d5ca27bb8f03705446d9c69263` | 63 custom-property definitions, 22 `@media` blocks |

Structure of the served `usd-layer1-logic.html`, counted from the served bytes: 12 sections (1 preamble + 11 numbered
chapters), 1 `h1`, 11 `h2`, 19 `h3`, 15 tables, 46 anchors, 23 ids. Head order as served: eyebrow
("Analysis engine · USD · Layer 1"), back link ("← Back to the dashboard"), h1, lede, download row (Markdown `.txt`),
source line, 4 chips. Then `<div class="frame">` = `aside.index` (labelled "Dossier sections", 11-item TOC) beside `main.doc`.
The top bar and the side rail are the shared `site-nav` block (`aside.side-rail` + `nav.tab-bar.side-rail-tabs`),
the same ordered entries on this page as on `index.html`; the rail's outbound entries (for example "Research Proof Map" →
`index.html#research-proof-map`) carry the arrow marker.

Variance note: the checkout's own `usd-layer1-logic.html` on disk is 87,711 bytes - exactly 771 bytes more, one CR per line -
so the stored blob and the served bytes still agree; the repository stores LF and this Windows checkout materialises CRLF.

Live-line check: `origin/main` was `605a454e` when measured; this checkout is detached at `def7cde` (one live-trading
data-file commit behind). The live-trading lane publishes every few minutes, so fetch-then-rebase immediately before any push.


### One-writer check (hard line 6)
- No unreviewed page change exists against the live line: no `inbox/dashboard-design/`, and the only submissions mentioning
  the Research Library panel are the strategy lane's own window notes (067, 070), not a page change by another lane. The newest
  page-touching commit on `origin/main` is `bbb8ad2` (the Research Library panel); the coordinator workstream row for
  `dashboard` is a stale 2026-10-03 note whose two items are already on the live line.
- The central checkout is on branch `research/usd-session-20261013` at `d07af111`, with `index.html` and `styles.css` dirty
  *relative to that branch*; its `index.html` is 19,979 bytes LF against the 28,856-byte served page, so it is a checkout far
  behind the live line, not an open edit to it.
- Conclusion recorded: no open page change found, so work is clear to start once the user gives his go-ahead.

### What is missing, and the proposal put to the user (no change made)
- No list of the five Astra briefs exists on the served page (grep of the served bytes for `astra|assignments` finds nothing),
  and the root `.nojekyll` means there is no directory listing to browse to.
- Proposal 1, `usd-layer1-logic.html`: one block between `</header>` and `<div class="frame">`, about ten lines of markup,
  carrying the block heading, one short line naming what the five files are, and five rows - A1 price and risk (3,630 bytes),
  A2 rates, releases and the calendar (3,797), A3 reviewer A mechanisms (2,823), A4 reviewer B methodology (3,238),
  A5 synthesis (3,364) - each linked to its live address under `docs/research/usd-session/v1/assignments/`, with `A1`...`A5`
  as the visible label and one plain clause each from what the brief asks. No measured number on the page changes; the block
  adds links only, and the heading wording is the design surface. Guard: one browser assertion that fails if the five
  addresses stop being present and clickable. Open sub-question put to him: whether the block should also carry reading
  context - `CHECKPOINT_3.md` is **not** on `origin/main` under `v1/` (only `CHECKPOINT_1.md` and `CHECKPOINT_2.md` are),
  while `research-cards/_template.usd-session-card.json` and `docs/research/handoff/usd/v1/USD_SYSTEM_CONTEXT.md` are;
  default is the five briefs only, any context link pointed only at a file that actually exists on `main`.
- Proposal 2, site-wide look, held back until he chooses a direction: the reference
  (`Design Reference/claude dash example.txt`) declares a light editorial system - cream `#F5F3EE` ground, ink `#1A1814`,
  Playfair Display headings, Inter body, JetBrains Mono figures, small-caps eyebrows, 1px bordered cards with a 4px top rule.
  The live site is the opposite ground: near-black `#080e16` with Space Grotesk and IBM Plex and amber accents, plus a 229 KB
  shared stylesheet whose 63 tokens are dark-only. Converting the ground is a large, user-visible change, so it is a question,
  not a decision: default recommendation is to keep the dark ground and take the reference's *quality* - one type scale, one
  spacing rhythm, card and border discipline, consistent hover and focus states, and contrast checked to 4.5:1 on body text
  and 3:1 on borders - rather than its palette.

### State at the end of the turn
Nothing on the site - no page, stylesheet, script, template or guard - was touched. The only writes are this notes file, the
README measurement block beside it, and the mailbox envelope filed from `tmp/`. Reported `paused` to the monitor and filed one
envelope; the next step is the user's go-ahead in this window.

## Third working turn, 2026-10-15 evening: three asks from the user, measured before anything was touched

The user asked in chat for three things: (1) the documents that sit as bubbles in the top bar should be consolidated into the side menu,
leaving the top bar carrying only Live Trading, Overview and Research Library; (2) fix the globe animation, which does not look like the
Earth and so does not look relevant to trading; (3) remove the "Current focus" panel, which he says is obsolete. He added: do not overwrite
the other work going on with the dashboard.

### What is served, read over HTTPS before anything was touched

Saved as `tmp/live-home-1440.json`, `tmp/live-home-390.json`, `tmp/live-topbar-1440.png`, `tmp/live-globe-1440.png`, `tmp/live-hero-1440.png`
by the new scratch reader `tmp/measure-live-home.js` (writes nothing to the site):

- `header.topbar.site-nav` at 1440px: the brand string, then **eight** `.topbar-link` pills - North Star Brief, Standing Dashboard, Gold,
  Backtest Flow, Call Map, USD Call Map, USD Logic Dossier, What moves gold - then two spans, the date ("Thursday, 15 October 2026") and the
  dual clock ("UK 21:13 | ET 16:13"). One row, 61px tall. At 390px the same bar is 191px tall with the eight pills on three wrapped rows and
  the date and clock under them. This is what the user is calling the documents in bubbles.
- `aside.side-rail.site-nav`: 21 entries - 18 `data-tab` buttons in four groups (Operate, Live, Evidence, System: Overview, USD, EUR, Gold,
  Silver, NQ, BTC, WTI, GBP, Pair Analysis, Live Trading, Research Library, Backtest / Accuracy, Backtest Engine, Research Proof Map,
  Factor Edge Lab, Shadow Logic Backtest, Architecture) and three outbound links (Call Map, USD Call Map, USD Logic Dossier). 232px wide at
  1440, 53px tall as a horizontal strip at 390.
- `#marketGlobeCanvas`: 290x290 CSS box and a 290x290 bitmap at device pixel ratio 1, `aria-hidden="true"`, inside a bordered
  `.globe-column` card. It draws an ocean-coloured sphere, a latitude/longitude graticule, seven pulsing market-city nodes and nine travel
  arcs between them - and **no landmasses at all**, which is exactly why it reads as a wireframe ball rather than as the Earth.
- `aside.hero-terminal`: the "CURRENT FOCUS" eyebrow, the heading "What we are working on", an "ACTIVE" pill, four rows (Now / Why /
  North star / Guardrail) and two links (Open full brief, Open standing dashboard). 360px wide at 1440, 370px at 390.

### The live line moved under this lane's feet while measuring

The served `index.html` is 28,856 bytes with sha256 `604f55d11ff1...`, which is the blob at `origin/main` and at `f7fc4690` - **not** this
lane's `5724a170` (`8c148a1f6b79...`). `f7fc4690` ("research(usd): publish the twenty-five self-contained USD briefs, the handoff bundle and
the panel actions that hand them over", authored by Codex) is a page change: `index.html` one line (the stylesheet cache query moved to
`styles.css?v=20261014-research-library-v2`), `script.js` +3,034 bytes, `tests/research_library.browser.test.js` +97 lines, plus data files and
docs. It leaves `styles.css` alone: the wire and `origin/main` both still carry 229,980 bytes, sha256 `9450b81a...`, this lane's published blob.
The checkout was moved with `git fetch origin` then `git checkout --detach origin/main`, so it now sits at the live tip `195f3727` with a clean
tree, `index.html` at LF-sha `604f55d1` and `script.js` at `713ec307`, both equal to what the wire serves. This is the one-writer rule working:
the page the user wants redesigned is a page another lane published to thirteen hours ago, and it is the file this lane must not clobber.

### Remit reading of the three asks, decided before any change was made

- Ask (2), the globe, **is** this lane's work: icon and illustration choice, no label, number or route involved. Drafted, previewed from this
  checkout, not published (below).
- Ask (1), moving the bar entries into the rail, is **not** a design change. Hard line 3 fixes the bar and the rail at the same ordered labels
  and targets, and `backtester/partials/shared_nav.html` with `backtester/scripts/build_shared_nav.js` and
  `backtester/tests/site_nav_consistency.browser.test.js` hold all thirteen pages to the partial's own render, entry by entry, in two variants.
  The three names the user wants on the bar are already rail entries (Overview, Live Trading, Research Library), so the ask is a removal, an
  addition and a relabel across the contract, spanning thirteen pages and a guard. Stopped and said so, which is what the assignment's
  escalation line asks for: the coordinator's `dashboard` workstream is the lane that carries production changes of that kind.
- Ask (3), removing the focus panel, is **content**, not a design property: four statements, a status word and two routes. No guard pins it -
  grep of `tests/*.browser.test.js` and `backtester/tests/*.browser.test.js` for `hero-terminal|marketGlobe|Current focus|globe` returns
  nothing, so removal would not redden the suite - but "nothing else changes" puts it outside this lane too, so it is a question rather than a
  decision. A within-remit alternative exists if he wants the space back without the deletion: quieten the card by restyle, since the rail's own
  Overview view already carries the framing, which needs no page-content change from this lane.

### The globe draft (uncommitted, one file: `script.js`, +103/-0 in four pure-addition hunks inside `initMarketGlobe`)

- **Landmasses**: hand-simplified outlines in degrees east and north - North America, Greenland, South America, Africa, Eurasia, the British
  Isles, Ireland, Japan, Madagascar, Australia, New Zealand, New Guinea, Borneo and Sumatra - held as a drawing constant beside the `cities`
  and `routes` constants already inside `initMarketGlobe`. No file, fetch, dependency or dataset was added; the shapes are the same kind of
  constant the globe already carried. Antarctica was drafted, watched in the preview as a flat pale shelf across the bottom of the sphere, and
  removed.
- **Projection and clipping**: `drawLandmass` projects through the existing `toPoint`, densifies two extra points per edge (`densify`) so a
  coastline crossing the limb is cut where it really crosses, then clips to the visible hemisphere with a Sutherland-Hodgman pass
  (`frontFacing`, z >= 0) so an outline over the limb can never fold onto the far side of the sphere. Fill `rgba(126,178,196,0.44)`, coastline
  stroke 0.7px `rgba(196,232,240,0.5)`. Land is drawn inside the existing clip to the sphere disc, after the graticule and before the arcs, so
  the grid now reads over the ocean only.
- **Sharpness**: the bitmap is sized to the reader's device pixel ratio (capped at 2) and the drawing space is pinned to the existing 290px with
  `ctx.setTransform`, so every existing coordinate, colour and line width, and the animation loop itself, are unchanged, and the sphere is no
  longer an upscaled 290px bitmap on a dense screen.
- **Untouched**: the seven market cities, the nine routes, the travellers, the stars, the atmosphere, the ocean gradient, the limb ring and
  `aria-hidden="true"`. This canvas carries no measured number, and no other page loads `script.js`.
- **Evidence**: `tmp/preview-globe-local.js` against this checkout's own preview server - bitmap 290x290 at device pixel ratio 1 and 580x580 at
  2, CSS box 290x290 in both; frames per second ~38-44 in headless Chromium, the same band as before the change; no page errors, and console
  errors only the harness's own aborted off-origin requests. Frames were looked at, not assumed: `tmp/globe-dpr2-600ms.png` (Africa and
  Eurasia), `tmp/globe-dpr2-4000ms.png` (the Atlantic, Africa to the east), `tmp/globe-dpr2-6500ms.png` (the Americas),
  `tmp/globe-dpr1-600ms.png` (the same at the ordinary 290px size), against the pre-change wire frame `tmp/live-globe-1440.png`.

### Incident worth recording: a stray preview server on the same port

The first preview screenshotted the *unmodified* globe and reported a 290x290 bitmap at device pixel ratio 2. Cause found, not guessed: a
preview server was already listening on 8791 serving a **different** checkout (the canonical folder, i.e. the live page), so the server started
for this worktree never took the port and the browser read somebody else's bytes. Caught by a purpose-built probe, `tmp/probe-globe.js`, which
reports how many `#marketGlobeCanvas` elements the page holds, their bitmap and CSS sizes, the transform in force, how many land-coloured pixels
the canvas actually contains, and whether the loaded `window.initMarketGlobe` source contains `landmasses`. The stray process was stopped; of
the two other node processes on the machine, one is the live-trading lane's trader (`run-live-trading-trader.js --confirm-live`) and was left
alone. Every preview after that asserted what the served `script.js` contained before believing a screenshot.

Housekeeping from the same previews: running the sanctioned server in this worktree writes `.local/research-library/service-token` inside the
checkout (65 bytes, untracked). It was removed at the end of the turn; the server recreates it on the next preview, and nothing else in the
checkout references it. The only untracked entry left is this notes folder, and the only modified file is the draft `script.js`.


### Suite with the draft in place, read honestly rather than claimed green

Runner: `tmp/run-browser-suite.js`, because the canonical `scripts/test-local.js` discovers from its own project root and would therefore test
the canonical checkout; the mirror replicates its discovery verbatim (same three roots, the same two exclusions, the same
`--test-concurrency=4`) with this worktree as the root. 15 browser files, 72 tests, log `tmp/suite-globe.log`: **61 pass, 11 fail**.

- The nine names the previous turn recorded as the live line's own red set are all still red: the two nav checks (8, 10) in
  `backtester/tests/site_nav_consistency.browser.test.js` - the bar's extra Research Library button that the partial never renders, and the
  guard's pinned list of seventeen rail entries - the five Live Trade Logic checks (19 to 23) in `tests/live_trade_logic_tab.browser.test.js`,
  and the two M5 chart checks (24, 25) in `tests/live_trading_chart_pan.browser.test.js` and `..._zoom.browser.test.js`.
- Two further names were red: `tests/live_trading_rule_panel.browser.test.js` ("a call whose own window has closed is refused, and every pair
  still gets a row") and one load-dependent freshness check in `tests/refresh_progress.browser.test.js` ("overview system status makes aligned
  layer freshness explicit").
- Both were run down rather than waved away. The draft was backed up to `tmp/script-globe-draft.js` (958,743 bytes, sha256 `5230303a4d70...`)
  and `script.js` reverted to the live blob with `git checkout -- script.js`, then the rule-panel file was run alone: **2 tests, 1 pass, 1 fail,
  the same name** (`tmp/rule-panel-control.log`), so that red belongs to the live tip and not to this draft, and the draft was restored and
  verified byte for byte against the backup. With the draft in place the two files run together are **28 tests, 27 pass, 1 fail**, the one
  failure being the rule panel: the freshness file passes 26 of 26 by itself, which is the same load-dependent path characterised last turn
  (its assertions read the overview panel before the layer fixture has landed).
- Stated plainly: the draft changes no test's outcome; the suite is red before it and with it. The publish turn will carry a control at the
  pre-change tree, and the nine names will be re-checked against the tip of that moment, because the live line carries another lane's page work.

### State at the end of the turn

- Written: `script.js` uncommitted (+103/-0, the globe draft), this notes file, the README block beside it, and ignored scratch under `tmp/`
  (`measure-live-home.js`, `preview-globe-local.js`, `probe-globe.js`, `run-browser-suite.js`, the screenshots, the JSON readings, the logs,
  the draft backup). Nothing committed, nothing pushed, no page, stylesheet, template, builder, guard, data file, other lane's folder, register,
  assignment, mailbox, controller or monitor written.
- The live site is exactly as the research lane left it at `f7fc4690`; this checkout sits at the live tip `195f3727` with a clean tree apart from
  the draft and the notes.
- Put to the user rather than decided here: the top-bar consolidation into the side menu (a nav-contract change on thirteen pages, which the
  coordinator's `dashboard` workstream carries) and the removal of the Current focus panel (page content, not a design property). Recorded with
  a recommended default each, and a within-remit alternative for the panel.

### Fourth turn, 2026-10-15 late evening: his three answers, and the globe published

- His answers, given in his own window: (1) publish the globe; (2) the document-move question may go to the coordinator by mail; (3) leave the
  "Current focus" card for now. Nothing else was asked for, and nothing else was touched.
- Published one purpose in one commit: `110d0bc1` on top of `ccba7d45`, pushed as a fast-forward (`ccba7d45..110d0bc1  HEAD -> main`). The base
  was chosen by fetching and rebasing immediately before the push; the live line moved once during the turn (`70c2adf1` -> `ccba7d45`, a
  data-file-only commit from the live-trading lane), so the rebase carried the draft onto a tree whose only difference was one data file. HEAD is
  detached at the live tip and stays that way; no force-push, no branch re-point, no `main` branch touched.
- Commit contents, and nothing else: `script.js` +103/-0 (the fourteen coastline outlines, `frontFacing`, `densify`, `drawLandmass`, the
  `landmasses.forEach(drawLandmass)` call, and the device-pixel-ratio block) and the new `tests/dashboard_globe_landmasses.browser.test.js`
  (136 lines; blob `9f663038f75d1f18`, 7,776 bytes). `index.html` (blob `75e05ed638c34e70`, 28,856 bytes), `styles.css`, `templates/`,
  `backtester/partials/shared_nav.html` and every data file are byte-identical to `ccba7d45`'s; `git diff --stat ccba7d45..110d0bc1` names the
  two files and no others.
- The guard, and where its floor comes from. `tests/dashboard_globe_landmasses.browser.test.js` serves this checkout's own root over loopback,
  opens `index.html` in headless Chromium, reads the canvas pixels the page has really painted, and counts land inside the sphere's 118px radius:
  a pixel is land when it is light in all three channels and not markedly bluer than it is red (`r > 60 && g > 85 && b > 110 && b - r < 90`),
  which excludes the ocean gradient, the thin white graticule, the teal route arcs and the teal city nodes. Measured with `tmp/globe-pixels.js`,
  which serves the working tree and then the same page with `git show HEAD:script.js` swapped in as `/script.js`:
  sphere pixels that are land - working tree 0.3659 at 1440px/ratio 1, 0.3624 at ratio 2, 0.3602 at ratio 3, 0.3631/0.3672/0.3691 at 390px;
  pre-change **0.0039** at every width and ratio. Bitmaps - working tree 290x290 at ratio 1 and 580x580 at ratios 2 and 3 (the cap), pre-change
  290x290 at every ratio. The floor is set at 0.20 and the ceiling at 0.60, an order of magnitude clear of both states, so the guard fails the old
  ball and passes the Earth, and it asserts the 290x290 CSS box at 1440px and 390px as well.
- Sensitivity proved rather than argued: `git checkout -- script.js` put the pre-change page back and the guard's own two tests both failed in its
  own words - "the globe code the page loaded must carry the coastline outlines" and "the sphere must still be drawn with land at 1x: 0.4% of its
  pixels are land" - log `tmp/globe-guard-control.log` (2 tests, 0 pass, 2 fail). The draft was then restored from `tmp/script-globe-draft.js` and
  verified byte for byte (958,743 bytes, sha256 `5230303a4d70...`), and the guard run again on the restored and rebased tree: 2 tests, 2 pass.
- Suite at this turn's tip, discovered and run from this worktree exactly as last turn (`tmp/run-browser-suite.js`, the verbatim mirror of the
  canonical `scripts/test-local.js` discovery, which would otherwise test the canonical checkout): with the change **74 tests, 64 pass, 10 fail**
  (`tmp/globe-guard-suite.log`); with `script.js` reverted and the guard file set aside, at the same tip, **72 tests, 62 pass, 10 fail**
  (`tmp/pre-change-suite.log`). The same ten names, in the same order: the two nav guards, the five Live Trade Logic checks, the two M5 chart
  checks and the rule-panel check - all of them the live line's own other-lane work, none of them this lane's to touch. The change therefore adds
  two passing tests and moves nothing else, and the freshness file that flaked last turn passed in both runs.
- What is served now, read off the wire over HTTPS after the push: `script.js` 939,890 bytes, sha256 `6a1c8a817368b84bc7b98f9f3a0979f2a3fe60b7aa51f8c5b4e05d5f7ae0deb3` -
  equal byte for byte to the committed blob (`6c14315fb52c67f8`) and carrying the coastline code; `index.html` 28,856 bytes,
  sha256 `604f55d11ff1bd0bced960373b4ab77abd84b1277d8bc0b8de7aac07ab83337c`, unchanged; the guard file 7,776 bytes, sha256
  `b95b866dbfca80e5...`, the committed blob. Read again in a real browser with off-origin requests aborted (`tmp/verify-live-globe.js`): at 1440px
  and ratio 1 the bitmap is 290x290, the box 290x290 and **34.4%** of the sphere's pixels are land; at ratio 2 the bitmap is 580x580, the box
  unchanged and 37.0% land; no page errors at either. The page a reader is served is the fixed page, not the one this lane measured.
- Mail to the coordinator, as the user authorised in chat: one submission filed through the canonical `coordination.js submit` -
  `tmp/submission-2026-10-15-dashboard-design-globe-landmasses-published.json`, 11,908 bytes, written to
  `.local/orchestration/inbox/dashboard-design/2026-10-15-dashboard-design-globe-landmasses-published.json`, sha256
  `f7b01d68101c263d...`, status `ready_for_review`. It carries the publish record and two questions: the document move (recommended: the
  coordinator's `dashboard` workstream carries it, since it changes the nav contract on thirteen pages; the fallback within this lane's remit is
  quietening the top strip by restyle, without relocating, re-labelling or removing an entry) and the removal of the "Current focus" panel
  (recorded against his later word to leave it). That submit and the monitor line are the only writes outside this checkout.
- Housekeeping: no preview server was started this turn - every reading used an in-process server on an ephemeral loopback port inside a node
  script, so nothing was left listening (checked: no listener on 8791, and there is no `.local/` under this worktree, so no service token was
  created this turn). `git status` is clean apart from this notes folder: `script.js` and the guard are committed and `tmp/` is ignored.
- State at the end of the turn: `origin/main` is `110d0bc1` and the live site serves it; this checkout sits detached at that same commit with a
  clean tree apart from these notes; the guard is in the tree and green; this lane's monitor line reads `paused` with the publish in its
  description. The top bar, the side rail and the "Current focus" card are exactly as they were, and the two asks that are not design are with
  the coordinator rather than in this checkout.

### Resumption check, 2026-10-16: what is live after the live-trading lane moved the line again

- The live line moved five times after the publish, every one a data-file-only commit from the live-trading lane
  (`6575ce4a`, `5c7e9fea`, `802e6454`, `a49ff5d7`, `662820d6`); `git diff --name-only 110d0bc1 662820d6` names
  `data/live-trading.json` and nothing else, and the published commit is an ancestor of the live tip, so the publish was not
  overtaken and there is nothing to rebase.
- Served bytes still this lane's, read off the wire (`tmp/resume-check-live.js`, log `tmp/resume-check-live.log`):
  `index.html` 28,856 bytes sha256 `604f55d1...` matches the published blob; `script.js` 939,890 bytes sha256 `6a1c8a81...`
  matches; the guard file 7,776 bytes sha256 `b95b866d...` matches. All three HTTP 200 with `age` 0, so the CDN is serving the
  published copies rather than a cached older one.
- The contract is intact, counted from the served page rather than trusted from the diff: the top bar carries the same eight
  entries in the same order with the same targets and labels (North Star Brief, Standing Dashboard, Gold, Backtest Flow, Call
  Map, USD Call Map, USD Logic Dossier, What moves gold), the side rail is present, the brand string is unchanged, and the
  "Current focus" card is still on the page and untouched.
- The globe as a reader gets it, read in a real browser with off-origin requests aborted at 1440px: ratio 1 - the loaded code
  carries the coastline outlines, bitmap 290x290, CSS box 290x290, 36.8% of the sphere's own pixels are land; ratio 2 - bitmap
  580x580, box unchanged, 36.9% land; no page errors at either. The share drifts a little between readings because the globe
  animates (an earlier reading the same hour gave 35.3% and 35.7%), which is exactly why the guard's floor sits at 0.20 and not
  near the measured value.
- The guard re-run on this checkout's tree at `110d0bc1`: 2 tests, 2 pass, 0 fail, 21s (`tmp/resume-guard-rerun.log`). Nothing
  was edited this turn - `git status` is clean apart from this notes folder and the ignored `tmp/`.
- One scratch-script correction, recorded so the log is not misread: the first pass of `tmp/resume-check-live.js` printed
  "guard-bitmap FAIL" at ratio 2 because the scratch comparison string was mistyped as `290x580`; the page's bitmap was 580x580

## 2026-11-03 - "the design of the table looks rubbish ... condense it down"

His words, in one message, with two screenshots of the Research Library tab: "Can you see here how on the research
library tab the design of the table looks rubbish, you have letters moving to the line below, lots of space to the
right not being used: can you tidy this up without interfering with the actual functionality of the dashboard. I just
need it to look tidy. ALSO I don't need this big summary block at the top - condense it down."

What I read on the served page before touching anything: the status columns were 64 to 85px wide while the blocker
column took 380px to show "none recorded"; all 75 status pills were broken mid-word and four headings were too; the
head card was 385px of stacked prose in front of the table. The full numbers, and the after readings, are in README.md
under the same date.

What I changed, and what I did not: no data, no number, no label, no route, no top bar or rail entry. The table got an
explicit column model and its cells lost the licence to break a word; the head card got one heading row, the blockers in
two columns, and the long explanation folded behind a single "How this library works" disclosure that starts shut. Every
sentence the catalog carries is still in the page, in its own words, in the same order; the only wording I chose is the
four words on the disclosure's summary.

What I told him (three bullets, plain words): the columns are now sized so no word splits and the left-over space went to
the blocker sentence instead of being wasted; the tall summary is now one heading line plus a click for the detail; and
the numbers, the statuses and the upload flow are untouched, with a browser check added so the split-words defect cannot
come back.

Left open for him: whether the folded prose should stay folded (my recommendation - the detail is one click away and the
open blockers stay on screen), and whether to publish this alone. The topbar trail restyle from the previous turn is
still prepared and unpublished in the same working tree, so publishing needs his word either way, and one purpose per
commit if both go.

  and the committed guard, which builds its expectation from the box, passed in the same minute. The string was fixed, the log
  re-taken, and every line of it passes.





### 2026-10-24: the eight bar pills become one quiet document trail, with a guard that catches a relapse

- Read live over HTTPS before touching anything (`tmp/read-live-index.js`, log `tmp/read-live-index.log`): the served
  `index.html` was HTTP 200, 29,226 bytes, sha256 `683c94c0c750...`, carrying eight `class="topbar-link"` anchors and no
  group around them. So the eight blue pills are what readers get today; the change was prepared in this checkout only and
  was not published this turn.
- What the pills cost, measured on this checkout's tree with the change stashed (`tmp/measure-before-recheck.log`, script
  `tmp/measure-topbar-local.js` with `WIDTHS`): the bar was 61px at 1440, then 95px at 1024 with the pills on a second
  row and the date and clock split apart, 123px at 768 and 191px at 390. With the trail: 58px at 1920, 1600, 1440, 1180,
  1024 and 900 - the brand and the status pair keep the first row and the trail runs beneath them - 90px at 768 and 136px
  at 390 where the trail wraps to two and three lines. Overflow stays 0 at every width, rail top always equals the bar's
  height, so the rail and the first view start where they always did (`tmp/measure-final-index.log`).
- The trail itself: `.topbar-docs` wraps the same eight anchors, same labels, same order, same targets, same
  `target="_top"`, still inside `.topbar-meta` so the rail and bar block keeps its shape; the anchors lost the 999px
  radius, the blue fill and the 1px border and became 10px muted mono text (rgb(139,160,183)) that underlines and
  brightens on hover and takes a 2px focus ring. The two status spans keep their pill chip so the date and clock still read
  as status rather than as one more entry (`backtester/partials/shared_nav.html`, style inside the partial because
  `bar-dashboard` and `bar-standalone` must stay byte-identical apart from the live spans).
- Responsive model, replacing the old rules: above 1520px one row, the trail hugging the status at the right; at or below
  1520px `topbar-meta` becomes `display:contents` so brand, trail and status are siblings of one wrapping flex bar, the
  first span takes `margin-left:auto` and the trail gets `order:3`, which puts it on its own second row; at or below 780px
  the bar goes static as before; at or below 700px the brand takes a row to itself. Dead rules removed from the partial and
  from `styles.css` (`topbar-center`, the old `width:100%` trio, the stale `order:-1` at 720px).
- Guard added, and proved to bite: `site_nav_consistency.browser.test.js` gains a sixth test that reads every one of the
  thirteen pages at 1440 (one trail group holding all eight, no fill, no gradient, no border, no rounding, trail size, muted
  ink), then the dashboard at 1440/1180/1024/390 (both status spans on one line, bar inside the measured ceiling, every
  entry inside the window), then hover and focus (underline and a visible ring, never a fill). With the old pill rule put
  back over the page the guard reads fill `rgba(94,161,255,0.1)`, border `1px`, radius `999px` and would fail
  (`tmp/proof-guard-fails.log`). The new test passes on its own: 6 tests, 6 pass (`tmp/nav-guard-new.log`), and inside the
  whole browser suite.
- Browser suite, before and after, same tree minus/plus this change (`tmp/browser-suite-head.log`, `tmp/browser-suite-final.log`):
  at HEAD 79 tests, 76 pass, 3 fail; with the trail 80 tests, 76 pass, 4 fail - the same three plus
  `refresh_progress.browser.test.js` "overview system status makes mixed publish windows explicit", which is unstable in
  this environment with or without the change (it failed in one HEAD run, passed when the file was run alone at HEAD, and
  failed a different test when run alone with the trail). The three standing failures are not this lane's and not caused by
  it: `the published dashboard opens the read-only Live Trading section` fails at HEAD with the change stashed and again
  with origin/main's newer data file checked out, on one button inside `#liveTradingView` whose text matches an order word;
  `a call whose own window has closed is refused, and every pair still gets a row`; and `research_library.browser.test.js`
  at file level. All three were failing before this change and are untouched by it.
- Beside the pages, four scratch files were added under the ignored `tmp/` only: the live read, the phone-width row
  reading, the probe that names the live-trading button, and the guard proof. No data file, no workflow, no other lane's folder, no monitor or register write beyond the
  activity line, and nothing committed or pushed this turn - the change sits prepared in this checkout awaiting the
  go-ahead, and `origin/main` has since moved to `470eb344` (one data-file-only commit) so it needs a fetch and rebase
  first.
- Open questions for him: whether the trail stays as links or the eight entries go altogether (his earlier word was to
  remove them, which the nav contract forbids from this lane), and who carries the commit onto `main` - the coordinator's
  dashboard workstream owns page changes on the live line.

## 2026-11-03, later: he said publish, and asked me to check the live page first

His words: publish now, no other agents are working on the live dashboard, but make sure to check the currently live one
as he had recently uploaded and saved a document to the library. All three of those were done in that order.

- Checked first: the live line had moved nine days past this checkout's base (`d001d23f`, a 2026-10-24 data commit) to
  `707fdef1`, with 1,195 changed lines across `script.js`, `styles.css`, `index.html` and the very browser test this lane
  edits. The served bytes at that moment were `index.html` 29,856 / `styles.css` 250,398 / `script.js` 1,046,200. The change
  was re-applied by hand on the new tip; the Research Library markup and its CSS were unchanged upstream, so nothing
  conflicted, and the nine-column table still matched the markup it was written for.
- The document: the served page shows the eight registered whole-engine evidence rows, newest 2026-10-13, and no row dated
  today. His saved document lives in the private store and appears only in his signed-in session, so the honest check was
  that the serving page and this preview say the same thing outside the head card - 10,301 identical characters - and that
  the evidence, stage and document markup is untouched by this change.
- Published as one purpose: `8b688b7f`, the table's columns and the folded head card, after a fetch and a rebase over two
  more data-file-only commits. Served afterwards: `script.js` 1,046,734 bytes, `styles.css` 253,568, `index.html` unchanged.
  Read back in a browser on the live page: 0 broken words at 1440, 1024 and 390, head card 241 / 319 / 476, blockers two
  columns then one, page overflow 0 everywhere. Suite 91 tests, 89 pass, 2 fail - both proved pre-existing by stashing the
  change and re-running those two files.
- Still held back, and he should know it: the top-bar trail restyle from the previous turn is parked as two patches under
  the ignored `tmp/` and is not on the live site. It needs re-doing against the pages as they now stand.


## 2026-11-07 - asked whether the mobile programme can be done from here without interfering

### What he asked, and what was checked before answering
- In chat: "are you able to make the mobile optimised dashboard from here without interfering with other work going on in
  the project?" No change was made and nothing was published; this turn is a measurement and a straight answer.
- Read live first, as the assignment requires: `/index.html` HTTP 200, 29,854 bytes, sha256 `eddb573a2033...`, and
  `/styles.css` HTTP 200, 253,568 bytes, sha256 `6899387f4007...`, both the exact `origin/main` blob sizes at `5bab74af`.
- Measured at 390x844 with touch and an iPhone user agent (`tmp/mobile-recheck-20261107.js`): page overflow 0 on
  `index.html`, `gold.html`, `usd-layer1-logic.html`, `gold-factor-wip.html` and `gold-backtesting.html`; the rail's
  scroller `nav.tab-bar.side-rail-tabs` is `scrollWidth 2143 / clientWidth 390`, `overflow-x: auto`, 22 entries, the last
  reachable only by swiping (`tmp/mobile-rail-probe2.js`); the top bar costs 154-191px of the 844px screen; the
  live-trader chip is still fixed at the bottom over the text; 9,187 text nodes under 11.5px on `index.html`. Full numbers
  are appended to `mobile-scope.md` under "Re-checked 2026-11-07".
- A mis-read, recorded so the next turn does not repeat it: the first probe read the `aside.side-rail` and showed
  `overflow-x: visible` with `scrollWidth 390` beside entries reaching 2,127px, which read as "the tail is clipped and
  unreachable". The scroller is the `nav` inside the aside, and it is a normal swipeable strip. The earlier 2026-11-03
  finding stands unaltered.

### The interference question, answered from the surface rather than from memory
- **The CSS surface has not moved.** `git diff 8b688b7f origin/main` shows 330 commits, but `styles.css` is byte-identical
  (`git cat-file -s origin/main:styles.css` = 253,568, the live size). Of the files this lane owns, only `index.html` (one
  `script.js?v=` query) and `script.js` (+67/-12, the live-trading lane's lamp, 3R trail and card version) differ, plus
  `tests/live_trade*.test.js` and `tests/orchestrator_*.test.js` which are not mine. So a fetch-and-rebase is one small
  commit of drift, not the 1,195-line re-apply the 2026-11-03 publish needed.
- **One writer**: `node scripts/coordination.js check --worker dashboard-design` returns pending 3, all three this lane's own
  submissions in `pending_review` with no reply, `errors []`, and no other lane's page submission. `origin/main`'s newest
  page-touching commits are live-trading's (`9c2d3048`, `90c9b08f`, `e3b04fcd`) and the corpora freeze (`f5b0b8ae`) - all
  landed, none mid-edit.
- **The one real collision risk is queued, not running**: the coordinator's `dashboard` workstream still carries
  `status gold_release_published_nav_n1_next`, whose remaining item is the navigation-consistency change on route N1 - one
  canonical nav fragment injected on every page. That is the same surface a mobile shell restyle touches, so whichever runs
  first, the other re-does its nav work. It is user-goahead-gated and not started; he should pick the order.
- **The second risk is the live-trading lane's pace, not its intent**: it pushes data-file-only commits to `main` every few
  minutes, and it owns `script.js` and the Live Trading surface. Mobile work that stays inside `styles.css`, the shared nav
  partial and the guards avoids it; the two Live Trading sessions in the scope must be told to that lane first.
- What this lane cannot fix from here, unchanged: the ~2.5MB first load at phone width was a data-file question and the
  corpora freeze `f5b0b8ae` has since taken the tree from 80.4MB to 23.7MB - worth re-measuring before quoting a figure to
  him again.
- State at the end of the turn: nothing published, no rebase, no page, data, workflow, register, mailbox or other lane's
  folder touched; the only writes are this file, `mobile-scope.md` and three ignored scratch scripts under `tmp/`.

## 2026-11-07, second turn - an Astra briefing written, and the link question

- He asked for a complete explanation of the project and of this lane to feed his ChatGPT "Astra" instance so he can plan
  prompts in there, and for the full link to the Markdown written for it.
- Written: `docs/dashboard-design/ASTRA_BRIEFING_20261107.md`, 289 lines, 20,880 bytes, thirteen sections - the project,
  what is served (13 pages, 19 views, the 22-entry rail and the eight-link bar), where this lane sits, what it may and may
  not change, how it proves a change, how a change reaches the live site, the measured mobile state, the plan and its
  honest size (16-19 turns), the five decisions only he can make, how to write prompts back to this lane with two
  templates, what the lane refuses and why, a glossary, and a "facts that drift" section that tells Astra not to restate
  figures from memory.
- Deliberately publish-safe: no credential, no private store name, no absolute local path, no mailbox detail. The lane's
  three older note files in the same folder are **not** publish-safe (they carry mailbox state, commit digests and route
  names), so any publish of the briefing must stage that one path only, never the folder.
- Verification: served from this checkout by `node scripts/research-library-server.js --serve-repo` on
  `http://127.0.0.1:8791`, HTTP 200, `text/plain; charset=utf-8`, **20,880 bytes served against 20,880 on disk, byte-for-byte
  identical** (sequence comparison over the response body). Server left running (pid 25544) so his local link works; the
  process is a loopback-only preview and can be stopped with `Stop-Process -Id 25544`.
- Nothing published: no commit, no push, no rebase, no page or data touched. The public link he asked for does not exist
  until one docs-only commit goes onto the live line, and that needs his word - so the turn ends with that as the one open
  question, default yes.


## 2026-11-09, third turn - tidying the Live Trading view and an FTMO 1 performance panel

- He asked for the four instrument cards to move below Closed Trades, for an "FTMO 1 Performance" panel with three
  tabs (Weekday default, Strategy, Asset) to sit above Open Positions, and for every figure to be traceable and to
  reconcile with Closed Trades. He added the standing instruction: design changes only, and do not break anything.
- I read the view as published first: `renderLiveTrading` in `script.js` builds the whole section in one template -
  banner, accounts strip, chips, chart, L2L rule panel, four cards, open positions, closed trades, provenance - and
  every number on it comes from `data/live-trading.json`, which is FTMO account 1's own snapshot (login `***614`,
  USD), the file the `ftmo-1` lane heartbeat names. So the panel needs no new data file and no new source.
- Prepared, not published: the card grid moved to the end, the new panel above Open positions, the arithmetic in a
  new `lib/live_trading_performance.js` (shared by the page and the tests), the styles and the module load added to
  `index.html` with both cache-busters bumped. The panel avoids the `.live-trading-table-panel` class on purpose:
  the read-back and close-control suites count exactly two of those and select them by index.
- Preview against the real snapshot (2026-11-09T18:50Z, fourteen-day window): 38 closed trades, net +167.11 USD,
  win rate 28.9%. Weekday, strategy and asset each sum to 38 trades and 167.11 USD, which is what the Closed
  trades table states in the same render. Screenshots at 1440 and 390 wide in `tmp/perf-*.png`, the reconciled text
  in `tmp/perf-preview.json`, the full record in `docs/dashboard-design/live-trading-performance-20261109.md`.
- Limits told to him rather than hidden: the window is fourteen days; one close (`loop-proof-close`) names no rule
  and sits under Unknown strategy while staying in the totals; there are no breakevens in this window, so that
  column reads zero on every row even though the classification is tested.
- The honest boundary: the card move is design, the panel computes figures in `script.js`, which the live-trading
  lane owns for this very section. Nothing outside the checkout was touched, no data file changed, no existing
  number moved. He reviews the preview; publishing is a separate single-purpose commit and waits for his word.


## Fourth turn (2026-11-09 evening): published, with the dates he asked for

He approved publishing and asked for one addition - the snapshot's actual reporting dates beside the panel title -
and made one decision: the live-trading lane owns the performance calculations from here.

- The dates are printed by the aggregation module (`dayLabel`, `periodLabel`), not typed into the page, from the
  window the snapshot's own history block states: `26 Oct 2026 - 09 Nov 2026 UTC · 14-day window`. They sit on the
  heading's row (a wrapping flex row), wrap to their own line at 390px without splitting `14-day`, and keep the exact
  stamps in the tooltip. A snapshot that states no window says so rather than showing today.
- The `Closed trades` prefix was dropped from that line: heading, meta line and caption already say it, and the
  shorter line fits one phone row.
- Published as one code commit rebased on the live tip and fast-forwarded to main; a second docs commit records what
  is served. The live page was then read back over HTTPS at desktop and phone: order chart / rule panel / performance
  / open positions / closed trades / cards, dates beside the title, and all three tabs summing to the Closed trades
  line (38 closed, net +167.11 USD, 16,711 cents) for the snapshot then served.
- Caught on the way: rewriting `index.html` through PowerShell left a UTF-8 BOM, which broke HTML sniffing on a
  content-type-less test server and failed the Backtest Engine browser test. Stripped, proved, re-run green. Also
  re-proved that the levels-visibility and research-library failures, and the two load-sensitive refresh_progress
  ones, are not from this change - all reproduced (or their absence) on a pristine archive of main.

## 2026-11-17 - two-floor factory: lower labels fit, desktop and phone, nothing published

### What was checked
- Branch `design/architecture-factory-multilevel` at `9d920969`, local only. No push, no merge, no live readback and no
  data file touched. The live-trading lane's cTrader relay status is still "Not evidenced" and was not changed.
- The lower floor was measured in a local server with every non-local request aborted. At 1440x1000 the lower view showed
  21 dependency labels: none clipped by the stage edge, no label overlap, no sideways document overflow, and the floor
  switch fully inside the stage. The selected state showed the USD replay path and its support labels in the amber active
  state, all inside the stage.
- At 390x844 the lower view showed 8 labels (the visible slice of the orbit), none clipped, no overlap, no sideways
  overflow, and the floor switch inside the stage. The lower floor hides the upper station labels; the station index still
  reaches every station.
- Active label style is a dark ink on the amber fill: `rgb(26, 18, 6)` on `rgb(255, 184, 77)`, with the evidence word at
  `rgba(26, 18, 6, 0.72)`. This stays legible and no longer leaves dark text on a dark fill.
- Screenshots: `factory-final-lower-1440.png`, `factory-final-selected-stage.png` and
  `factory-final-lower-390.png` in `%TEMP%`; harness `%TEMP%\factory-final-check.js`, result JSON in
  `%TEMP%\factory-final-check.log` (UTF-16LE).

### What changed in the checkout
- `lib/system-factory.js`: the lower floor's dependency nodes and labels; evidence is a node property (`runtime`,
  `replay`, `documented`, `research`, `planned`) with short words for compact labels; lower labels are clamped by their
  own measured width so the row edge does not cut them. `syncFloorUi()` no longer writes a stray `factoryFloor` data
  attribute; the floor state lives on the scene host.
- `system-map.css`: dependency label grid (code | name, then sub), compact/far rules, and the active-state code colour.
  On narrow screens the illustrative-flow note now sits below the floor switch instead of on top of it; the phone test
  asserts the two boxes do not intersect.
- Cache-busters are `20261117-factory-lower-floor` for `system-map.css`, `lib/system-map.js` and `lib/system-factory.js`.
  `system_map.browser.test.js` now asserts all three, including the factory script request from the map host.
- `tests/system_factory.browser.test.js`: the lower-floor test asserts zero stage-edge clipping; the phone test switches
  to the lower floor and asserts labels are present, unclipped, the floor switch stays inside the stage, and the page has
  no sideways overflow.

### Test evidence
- `node --test --test-concurrency=1 --test-reporter=spec tests/system_factory.browser.test.js`: 12 tests, 12 pass,
  0 fail (49.6 s).
- `tests/system_map.browser.test.js`: 2 tests, 2 pass, 0 fail (7.3 s) after the third cache-buster assertion.
- `node --check` clean on `lib/system-factory.js`, `lib/system-map.js`, `script.js`, the factory harness and both edited
  test files.
- No full `node scripts/test-local.js browser` run in this turn. The known live-line reds are not claimed fixed.

### Remaining
- The page's fixed live-status pills still sit over the lower-right of the phone stage (and the top-right panel on
  desktop). They belong to the live page outside this factory markup, were not changed, and did not intercept the click
  test; the coordinator should decide whether they belong over a 3D stage at all.
- Review the three screenshots with the user, then one purpose per commit on his go-ahead. Fetch and rebase immediately
  before pushing; never force-push and never commit a data file.
## 2026-11-17 - review handover: three journeys, captured from the local preview

### State
- Branch `design/architecture-factory-multilevel`, HEAD `9d920969`, with the review changes still uncommitted.
  Nothing pushed, merged, deployed or published. No data file touched. Preview served from this checkout by
  `node scripts/research-library-server.js --serve-repo --port 8791` at `http://127.0.0.1:8791/index.html#architecture`.
- The two factory browser stats for this turn: `tests/system_factory.browser.test.js` 12/12 pass in 57.4 s;
  `tests/system_map.browser.test.js` 2/2 pass in 7.2 s. Both suites use the local page with non-local requests blocked.

### Three review views
- Whole factory: `%TEMP%\factory-review-view1-whole.png`. It carries the default Both view, a side view with the USD
  input store selected, and the 390 px phone overlap. Individual frames: `final-whole-default.png`,
  `final-whole-input-both.png`, `factory-review-phone-overlap-390.png`.
- USD dependencies: `%TEMP%\factory-review-view2-usd.png`. It carries the USD L1 core upstairs, the lower input store,
  the n8n `Supabase Get Many` node, the `Message a model` node and the T2 replay panel. Individual frames:
  `final-usd-core-upper.png`, `final-usd-input-lower.png`, `final-flow-top.png`, `final-flow-supabase.png`,
  `final-flow-model.png`, `final-t2-panel.png`.
- VPS execution: `%TEMP%\factory-review-view3-vps.png`. It carries the upper execution floor, each FTMO lane selected,
  the blind M5 rule, the separate cTrader station, and the VPS facts. Individual frames:
  `final-vps-upper-zoom.png`, `final-vps-focus.png`, `final-vps-ftmo1-selected.png`,
  `final-vps-ftmo2-selected.png`, `final-vps-ftmo3-selected.png`, `final-blind-rule-selected.png`,
  `final-ctrader-upper.png`, `final-vps-panel-facts.png`.

### Phone pill overlap: correction to the previous entry
- The earlier claim that the fixed live-status pills "did not intercept the click test" was measured with the stage
  centred. When the stage bottom is brought to the viewport bottom at 390x844, the fixed stack at `y=737..832` covers
  the camera row at `y=794..824`. At that scroll position it intercepts pointer hits on **Reset view, +, - and
  Pause flow**; the floor switch at `y=412..438` remains clickable. It is a real control-blocking overlap, not only a
  visual one. The pills were left untouched as instructed; this is recorded for the coordinator.

### What was verified
- Whole view: both floors render together. Idle support links are faint; selecting `dep.usd.inputs` lights its support
  toward `usd.feed`. The active lower label reads `USD Inputs · Runs today`.
- USD path: `Overview → Open architecture map → Upper → USD L1 core → Explore dependencies` shows lower rules/workflow,
  while `USD input store` is the actual stored input and its support is `usd.feed`. `Inspect n8n flow` shows the
  nine-node USD export; `Supabase Get Many` reads every row of `market_snapshots` with no filter, and `Message a model`
  receives the combined rulebook + input pack. The scoring node overwrites the model's numbers.
- USD backtest T2: `USD replay chamber → Explore test library → T2`. Rule: a USD-bullish call predicts EUR/USD, XAU/USD,
  NAS100 and BTC/USD down; bearish predicts them up; each market has its own flat band. Inputs are session outcomes from
  each market's daily series paired with the stored USD call. The panel names `data/usd-layer1-backtester/run-v1.json`
  but does not render the scores; the artifact's `tests.four_markets.models.current` overall rows are EUR/USD 217/439
  (49.43%), XAU/USD 255/458 (55.68%), BTC/USD 268/536 (50.00%), NAS100 240/454 (52.86%), with 122/100/178/104 flat.
- VPS path: the upper floor shows the VPS, the three FTMO groups and the separate violet cTrader component. Selecting each
  lane reveals its label; at the overview angle one lane label is collision-hidden. FTMO 3's path is own M5 feed →
  M5 deviation rule → account, not the junction. The rule is a completed M5 candle crossing a boundary by one tick,
  limit back at the boundary, next original level as target, stop at one fifth, minimum volume.
- cTrader: the station is an independent robot, not an order copier. The VPS facts name FTMO 1, FTMO 2, FTMO 3 and
  cTrader together. The station says installation in source only, account connection documented but **not verified**,
  trading authorisation **pending**, active copying **none**, and no runtime status or heartbeat. The lower
  `cTrader relay evidence` node says `Connection · Not evidenced`. **No source lane for a relay is documented**, so none
  can be named; the map correctly draws no relay. The fixed pills show MT5 lane heartbeats, not cTrader.

### Gaps to decide
- Fixed pill overlap on phone blocks four camera controls at one scroll position; left untouched for the coordinator.
- Stage label collision hides the FTMO 1 label at the overview; selecting the lane reveals it. No measured number or
  station was changed.
- The factory panel names the T2 result artefact but does not display its scores; the values above were read from the
  committed artifact, not claimed as rendered numbers.
- No cTrader runtime status, connection log, authorisation timestamp or relay exists in this checkout. `Not evidenced`
  is the last evidenced state, not a recent connection time.



## 2026-11-17 - review fixes: phone controls, VPS names, T2 rows, relay states

### Checkpoint and scope
- Reviewed factory and handover committed locally as `735e8dc1` on `design/architecture-factory-multilevel`. The commit
  holds the factory source, shell, stylesheet, cache-busters, both browser guards and this notes file; the three other
  untracked design documents were left out. No push, no publication, no data-file change.
- Final review-fix commit follows this entry. Publication remains pending the user's review.

### What changed
- Phone camera controls: below 720 px the HUD sits at `top: 48px` instead of the stage bottom, and the illustrative
  note moves to `top: 92px`. The fixed trader lamps stay at the bottom right. No control label, scene action or lamp
  changed.
- VPS names: the shared-station focus for `vps` is now 0.72 of overview distance, inside the named-label band. The
  collision box now matches the text CSS actually draws (code at far, name at mid, name plus sub at near). FTMO 1
  carries a `-62px` screen-space label offset; FTMO 3 carries `+20px`; FTMO 2 stays in the middle. The opened station
  is named before the rest of the active route. The blind M5 chain remains on its own lower row, separate from the two
  directional lanes and the violet cTrader object.
- T2: the USD test library now carries a static historical block copied from
  `data/usd-layer1-backtester/run-v1.json` (generated 2026-11-14). The inspector and the flat fallback show Model,
  Market, Accuracy and Scored sessions for EUR/USD 49.43% / 439, XAU/USD 55.68% / 458, BTC/USD 50.00% / 536 and
  NAS100 52.86% / 454, headed "Historical results" with a note that the view reads no live data. The evidence link
  points at the committed artefact.
- cTrader relay wording: the intended source is FTMO 1, sourced from the sanitised strategy record. Configured source
  is "Not evidenced"; observed copying is "Not evidenced". The page does not claim "inactive" or "zero copied orders".
  Installation, connection and authorisation retain their earlier states.

### Verification
- Desktop 1440x1000, VPS selected: VPS label and all three FTMO lane names visible, no pairwise overlap, all inside
  the stage. Phone 390x844, same check passes; FTMO 3 sits below the directional pair.
- Phone 390x844, stage bottom at viewport bottom: Reset view, +, - and Pause flow all hit-test to their own buttons;
  none intersects a fixed trader lamp. Each control was tapped and checked: zoom in shortens distance, zoom out
  lengthens it, Reset returns to overview, Pause sets `paused` and `aria-pressed`.
- T2 at both widths: four rendered rows match the artefact exactly; the panel reports zero sideways overflow.
- `node --test --test-concurrency=1 --test-reporter=spec tests/system_factory.browser.test.js`: 15 tests, 15 pass,
  0 fail (71.0 s). `tests/system_map.browser.test.js`: 2 tests, 2 pass, 0 fail (8.0 s).
  `tests/factory_library.test.js`: 7 tests, 7 pass, 0 fail.
- Screenshots in `tmp/factory-review-20261117/`: `final-vps-labels-1440.png`, `final-vps-labels-390.png`,
  `final-t2-results-1440.png`, `final-t2-results-390.png`, `final-phone-controls-390.png`.

### Remaining
- No cTrader runtime status, configured source, copy log or dated copied-order count is committed. `Not evidenced`
  remains the correct state for configuration and observation; FTMO 1 is design intent only.


## 2026-11-18 - release preparation and live-tip integration

- Rebased the review build onto live tip `38f87d08`. The rewritten checkpoint is `a70676cf`; the rewritten final
  review-fix commit is `08cedd55`. The live tip added the header/navigation tidy, so the stylesheet link resolved to
  `styles.css?v=20261117-header-tidy` while the factory kept `system-map.css?v=20261117-factory-review-fixes`; both
  sides of the header and navigation contract were preserved. The three untracked design documents were left untouched.
- Focused checks: factory 15/15, map 2/2, library 7/7.
- Full browser suite on the merged tree: 134 tests, 122 pass, 12 fail. A clean detached worktree at live tip
  `1fdf59b6` produced 12 failures too (48 tests, 36 pass, 12 fail), with the same locations for 11 of them: both globe
  checks, four shared-navigation/call-map checks, two USD dossier checks, both M5 chart gestures and the research library
  file. The twelfth is in `refresh_progress.browser.test.js` in both runs but on a different test; that file is unchanged
  from `1fdf59b6` and its isolated run on this tree is 26/26. No failure was introduced by this branch.
- Local release verifier, direct `#architecture` and Overview -> Open architecture map, at 1440x1000 and 390x844:
  50 stations, 39 dependency connections, 21 lower-floor labels on desktop and 8 on phone, nine USD n8n nodes, the four
  T2 rows exactly matching `run-v1.json`, all three FTMO lane names readable and non-overlapping, relay wording
  "FTMO 1 intent; configured and observed not evidenced", and four working phone camera controls clear of three fixed
  trader lamps. Screenshots and JSON in `tmp/factory-release-20261118/`.
- Publication remains subject to the push and public-page check in this release turn.


### Published 2026-11-18

- Pushed `dcde1b8b` to `main`; the factory presentation commit is `08cedd55`, with checkpoint `a70676cf`. The GitHub
  Pages build for `dcde1b8b` completed successfully at 11:30:07 UTC.
- Public read at `https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html#architecture`, and through
  Overview -> Open architecture map, at 1440x1000 and 390x844: both floors (50 stations, 39 dependency connections, 21
  lower labels on desktop and 8 on phone), nine USD n8n nodes, all four T2 rows matching the artefact, all three FTMO
  names readable and non-overlapping, relay intent separated from configuration and observation, and four tap-working
  phone camera controls clear of three fixed trader lamps. Screenshots and the JSON result are under
  `tmp/factory-release-20261118/public-*`.
- Served `index.html` is 36,002 bytes, sha256 `0d085a92b4b5839d6ded573c1c569c686457c9cc491618dc53dff1a6c17e5939`.
  `system-map.css` is 63,472 bytes; `lib/system-factory.js` 200,732; `lib/factory-library.js` 23,379;
  `lib/factory-flows.js` 61,070. Full digests in `tmp/live-digests.json`.
- The drift guards remain in `tests/system_factory.browser.test.js`: three FTMO labels, phone controls and hit-tests,
  T2 rows against the committed artefact, relay wording, and both n8n/document-link paths. No data file was committed.


## 2026-11-24 - the Backtest Engine v2 control room: the wire no longer strikes through a caption, nothing published

### What was asked
- Build and finish the manifest-driven control room page `backtest-engine-v2.html` (the whole evidence path on one
  page, every state read from a published artefact when the page opens), then polish the flow drawing: the wires ran
  over the band captions, the columns were cramped vertically, and a path end carried a port with nothing after it.

### Read first, and what it showed
- The page is not published yet: it is an untracked file in this checkout, so there is no live HTTPS read to make and
  none was claimed. Everything below was measured from this checkout over `http://127.0.0.1`, which is what the preview
  serves, at 1440 and 390, and at 1180 / 860 / 768 for the fit guard.
- Before the polish the wires were cubic beziers drawn in scaled page coordinates, which left them off their ports
  after a zoom, and they crossed the band caption row with no break, so a line struck through the sentence that
  describes the band.

### What was changed
- `backtester/assets/backtest-engine-v2.css`: the band head is lifted above the drawing (`position: relative; z-index: 1`)
  and its label and caption carry a dark multi-layer text shadow, so a wire breaks around the words instead of crossing
  them; the node grid gap became `22px 12px` for vertical breathing room; `.is-terminal` / `.is-origin` nodes hide the
  port that has nothing attached; the narrow sheet and its backdrop now show at once on open and hide only after they
  have slid away (`visibility 0s` on open, `visibility 0s linear 220ms` on close) - before this the sheet spent the first
  half of its own entrance invisible.
- `backtester/assets/backtest-engine-v2.js`: `drawWires` draws a rounded elbow (down, across the mid-gap, down) with the
  radius clamped to 2-6px, a straight line when the columns match or the gap is too tight, in scaler-local coordinates so
  the drawing survives zoom; the edge loop marks `is-terminal` / `is-origin` from the manifest edges rather than node ids;
  Escape now returns the wide panel to its empty state (the choice cleared, the dimmed lines restored) and still closes the
  phone sheet first.
- `backtester/tests/backtest_engine_v2.browser.test.js`, new, seven guards: the manifest drawn as written (bands, order,
  titles, legend words), no step claiming more than its own dimensions, every wire on the two ports it joins and no port
  without a wire, the caption above the drawing with its halo, no sideways scroll at five widths, choosing a step / dimming
  / Escape at both layouts, and zoom keeping every wire on its port.
- `backtester/scripts/build_shared_nav.js`, `backtester/partials/shared_nav.html`,
  `backtester/tests/site_nav_consistency.browser.test.js`: the page is registered as the fifteenth published page, so the
  four places that spelled "fourteen" now say fifteen. No rail label, target, order or brand string moved.

### Measured after the change (1440 unless stated)
- 11 steps, 4 bands, 6 legend states; 22 wire paths for 11 edges (a rule and a dot each); a chosen step dims 5 of the 11
  rules, all of them rules that do not touch it; zoom 100% -> 90% -> 100% keeps every wire within 1.5px of its port.
- No horizontal overflow at 1440, 1180, 860, 768, 390 (0px at each); node 742px wide at 1440, 352px at 390; the phone
  sheet is 675px tall, visible the moment it is asked for, gone once it has slid out; zero console or page errors.
- Sizes and digests of what this change would serve: `backtest-engine-v2.html` 21,005 bytes `bdd45c72861b3677`;
  `backtester/assets/backtest-engine-v2.css` 22,267 `23b7d0c49ae96e28`; `backtester/assets/backtest-engine-v2.js` 30,914
  `f8216fa463801d53`; `backtester/assets/backtest-engine-v2.manifest.json` 33,969 `353d963c614f9533`;
  the new guard 19,328 `1ded91573f076bd5`.

### Two reds in the browser suite that are not this page
- `tests/dashboard_globe_landmasses.browser.test.js` fails on the live tip: the sphere measures 135x135 where the guard
  asks 290x290. `styles.css` line 10876 (`.globe-column { width: clamp(80px, 15vh, 20vh) }`, added 2026-11-19 by the
  live-trading header compaction, `c9fd4df6`) supersedes the 290px box the guard and the older stylesheet carry, and at a
  900px-tall viewport 15vh is 135px. Removing this page's new rail link changes nothing (135x135 either way), so the
  navigation is not the cause and this lane did not touch the home page.
- `tests/backtesting_h1.browser.test.js` fails on the live tip: the 2024-01-02 blocked card shows 4 blocker rows where the
  guard asks 9. `backtesting.html` was rewritten on 2026-11-24 by the usd-l1 lane (`4aa97638`), so the guard is behind the
  page it guards. Both are other lanes pages; recorded here rather than edited.

### State
- Not pushed. One commit is ready for the user go-ahead: fetch, rebase on the live tip, run the browser suite again, fetch
  once more, then `git push origin HEAD:main`. No data file is part of it.
- The brief's state report could not be filed: `monitor-state.js` is not in this checkout or in the main checkout
  (`D:/trading-agent-dashboard-codex/scripts`), and no script in `scripts/` mentions `monitor-state`. Nothing was invented
  to stand in for it, and nothing outside this checkout was written.


## 2026-11-24 (later) - coordinator: the control room integrated, published, and bound to the evidence

### What was merged, in order
- The fresh-call lane landed first: `backtesting/usd-l1-fresh-call-20261124` at `4ad274e5`, PR #32,
  squash-merged to `main` as `a591a245`. It committed the proof record, the one captured execution
  (parent 7260, children 7261/7262), the H1 coverage wording and the screen's new document path.
- The design commit `13e091d0` was then merged onto that revision on
  `release/backtest-engine-v2-20261124` (merge commit `84b96641`). Nothing in your files was
  rewritten; the coordinator's changes are additive and listed in the handoff.

### What the page now reads
- `freshcall` - `data/usd-layer1-backtester/n8n/fresh-call-v1.json`: `recomputed_from_cutoff_inputs`,
  8 cases, 8/8 calls, 4/4 scored, 27/110 probes, `blocking: []`; the live block names 7260/7261/7262.
- `readiness` - `data/usd-layer1-backtester/market-readiness-v1.json`, built by
  `scripts/build_usd_l1_market_readiness.js` from `backtesting-screen-v1.json`'s `market_matrix.counts`.
  Published counts stay 4 scored / 1 proxy-scored / 8 measured_tick_replay / 11 blocked over 24 cells;
  the scratch 7/1/8/8 sits under `unpublished_research` with `published: false`.
- Every source declares `verified_at`; the page prints that field from inside the artefact, says
  "read - no timestamp published" for `parity-v1.json`, and "unavailable" when a fetch fails.

### What changed on your page
- A twelfth step, `Fresh-call proof`, between the controller and the evidence, with a claims block on
  `outcomes` for the three distribution-pending markets and the "not established" advantage row.
- The challenger notes no longer say the child merely replays a stored call.
- `#crSources` prints the source stamps; links may name a source instead of spelling a path.
- `Backtest Engine v2` is the first outbound entry under the rail's `Evidence` heading on all fifteen
  pages, from the shared partial and builder (21 rail entries, 9 outbound, 0 changes).

### The state-report question, answered
- `monitor-state.js` is confirmed absent from the repository and from `scripts/`; the brief's name
  was the only place it existed.
- `scripts/coordination.js` is real but cannot run from `main`: `docs/orchestration/projects.json`
  is not committed there, and the tool refuses to run without its registry.
- The mechanism every lane actually writes is `.local/orchestration/activity/<worker>.json`.
  `scripts/report_design_state.js` (`npm run report:design-state`) now writes that record atomically
  and refuses an unknown state; it touches no page, artefact or workflow. The contract is
  `docs/dashboard-design/BACKTEST_ENGINE_V2_STATUS_CONTRACT.md`.

### Checks, and the two reds that are not this page
- Control-room guard 9/9 (the two new guards read the source stamps from the files and the
  fresh-call/readiness text from the artefacts).
- Shared-nav guard 6/6; builder `--check` 15 pages, 21 rail entries, 9 outbound, 0 changes.
- Readiness artefact reproduces (`4b4d2aa7...`); readiness suite 8/8 inside `test:usd-l1-platform`.
- The globe guard (2/2) and the H1 inspector guard (1/1) fail on the release tree **and identically
  at `origin/main`** (`a591a245`), run from a detached worktree: same names, same assertions. They are
  the live line's own reds, recorded rather than edited here.
