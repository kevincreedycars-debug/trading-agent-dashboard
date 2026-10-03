# Coordinator work order - the same header and side bar menu on every page

Prepared 2026-10-03 by worker `strategy` (`strategy-advisory-001`) at the user's instruction, verbatim: *"yeo craft the
instructiosn to tidy up the top and side bar menu to ensure consistency site wide."* Advice only: nothing here is adopted,
no page or stylesheet is touched by this worker, and no claim of completion is made. This file is the executable form of
`DASHBOARD_NAV_CONSISTENCY_REQUEST.md` (2026-10-01); where the two disagree, this file holds the current measurement.

## Revision 2, 2026-10-03 - the gold page named, and the three open choices closed

The user returned with a direct instruction, verbatim: *"make sure the top and side bar menus of this gold page match the
homepage of the dashboard."* He also answered the three open choices, and where he declined to choose he delegated the
call to this lane's judgement. Nothing measured in revision 1 changed; what changed is that the work no longer carries
open questions:

1. **The gold page is named as the page to fix first.** `gold.html` (5,733 bytes live) carries **no** top bar and **no**
   side-bar menu today: its own `<header class="goldtabs-head">` holds a title, one sentence and a single "Back to the
   dashboard" link, beside its four tabs. The home page carries one `.topbar` (brand `Asset Directional Movement
   Dashboard`, then North Star Brief, Standing Dashboard, Gold, Backtest Flow) and one `aside.side-rail`. The instruction
   is that the gold page carries those same two blocks, above its own tabs.
2. **The rail's behaviour off the dashboard is "both"** - his word: each entry opens the dashboard *and* lands on the view
   its own label names, which is route (a) plus the plain-anchor fallback of route (b). Section 7 is rewritten.
3. **The date and clock were delegated to this lane's judgement**; the judgement is the revision-1 recommendation and is
   recorded in section 8, with the reasons written out so the call can be re-opened on facts rather than taste.
4. **Start now** - his word, "yes": the shared bar and rail are built now, on the gold page and the other seven, in one
   change. The release this work was sequenced behind landed on 2026-10-03, so nothing is waiting on it any more.

Verified live again this revision, read-only over HTTPS, and unchanged from revision 1: `index.html` HTTP 200 at 18,775
bytes, one `.topbar` and one `aside.side-rail`, `styles.css` and `script.js` loaded, bar labels exactly `North Star Brief |
Standing Dashboard | Gold | Backtest Flow`, rail head `ADM` / `Control Room` and four groups in order `Operate`, `Live`,
`Evidence`, `System`, foot `Published dashboard`; `gold.html` HTTP 200 at 5,733 bytes, **zero** `.topbar` and **zero**
`side-rail` references, `styles.css` linked, no `script.js`, tabs `Direction`, `Backtest evidence`, `28-factor outcomes`,
`Factor tables (draft)`. `origin/main` is still `f8bc80f`, so revision 1's page table stands as written.

## 1. What is asked, and what is already settled

One requirement over the whole served site: **the same top bar and the same side-bar menu on every page.** It is a
consistency requirement, not a new feature - the bar and the rail already exist and already look right on the dashboard;
eight pages simply do not have them.

Two earlier answers still govern, and one precondition has now cleared:

- **Same theme everywhere** (user, 2026-10-01): the dark bar and the dark rail are carried on every page, including the
  pale draft page, with no light variant.
- **After the release** (user, 2026-10-01): sequencing was nav-after-release, and the release landed on 2026-10-03
  (production `2f25c8c`, `gold.html` published, the bar's gold entries reduced to one). *So this work is now unblocked and
  should be built against the bar as it is served, not as the local tree remembers it - see Task 0.*

## 2. The site as it is served today, measured

Read from `origin/main` at **`f8bc80f`** on 2026-10-03 (nine root pages, no page in a subdirectory). Sizes are stored
blob bytes, which under this repository's line-ending settings are smaller than a Windows worktree copy of the same file:

| Served page | Bytes | `.topbar` | `.side-rail` | Links `styles.css` | Own `<header>` |
| --- | --- | --- | --- | --- | --- |
| `index.html` | 18,775 | 1 | 1 | yes | yes (the shared bar) |
| `gold.html` | 5,733 | 0 | 0 | yes | yes (`.goldtabs-head`) |
| `dashboard-northstar.html` | 5,002 | 0 | 0 | yes | no |
| `standing-dashboard.html` | 8,957 | 0 | 0 | yes | no |
| `backtest-flow.html` | 18,402 | 0 | 0 | no | yes |
| `gold-factor-wip.html` | 24,398 | 0 | 0 | no | no |
| `gold-direction-scorecard.html` | 143,102 | 0 | 0 | no | yes |
| `gold-backtesting.html` | 292,270 | 0 | 0 | no | yes |
| `gold-backtest-outcomes.html` | 19,186 | 0 | 0 | no | yes |

The finding in one line: **the bar and the rail are on `index.html` and on no other page.** Four of nine pages link the
shared stylesheet; five keep everything in their own inline `<style>`. The four research pages carry a bespoke `<header>`
whose only navigation is a "Related pages" row; the two north-star pages and the draft page carry no `<header>` at all.

## 3. The fingerprint that must hold on all nine pages

"Same" is defined as something a guard can compare, not as a screenshot.

**The bar** (as it is served on `index.html`, lines 14-30): brand `Asset Directional Movement Dashboard`; then, in order:

| Label | Target |
| --- | --- |
| North Star Brief | `dashboard-northstar.html` |
| Standing Dashboard | `standing-dashboard.html` |
| Gold | `gold.html` |
| Backtest Flow | `backtest-flow.html` |

**The rail** (served on `index.html`, lines 33-65): head mark `ADM`, head label `Control Room`; a grouped nav carrying four
group labels in order - `Operate`, `Live`, `Evidence`, `System` - and seventeen entries in this order: Overview, USD, EUR,
Gold, Silver, NQ, BTC, WTI, GBP, Pair Analysis, then Live Trading, then Backtest / Accuracy, Backtest Engine, Research
Proof Map, Factor Edge Lab, Shadow Logic Backtest, then Architecture; foot `Published dashboard` with its status dot. The
`data-tab` values that pair with those labels are `overview`, `USD`, `EUR`, `GOLD`, `SILVER`, `NQ`, `BTC`, `WTI`, `GBP`,
`layer2`, `live-trading`, `backtest`, `backtest-engine`, `research-proof-map`, `factor-edge-lab`,
`shadow-logic-backtest`, `architecture`.

**What may differ, named in advance - and nothing else:** on `index.html` a rail entry is a `<button data-tab="...">` that
switches the dashboard's views; on the other eight pages it is an `<a>` to the dashboard (section 7). The `index.html`
bar's live date and clock spans have no counterpart elsewhere (section 8).

## 4. Task 0 - repair the precondition the release left behind, before touching the bar

This is measured, concrete and cheap, and doing it after the nav change would mean doing it twice.

- Production `index.html` carries **four** bar entries (North Star Brief, Standing Dashboard, Gold, Backtest Flow). The
  local mirror `index.html` in the canonical checkout is clean, was last written by `561cf6b` on 2026-09-30, and still
  carries **six** - it adds `Gold Backtest`, `Gold Direction` and `Gold Factor (draft)`. The canonical branch
  (`orchestration/control-plane-20260920` at `30d853b`) does not contain the release commit `2f25c8c` at all.
- Consequence, exactly: three hop guards assert bar entries that **no longer exist in production** -
  `backtester/tests/gold_direction_dashboard_link.browser.test.js` line 15, `gold_outcomes_dashboard_link.browser.test.js`
  line 15 and `gold_factor_wip_dashboard_link.browser.test.js` line 20. They pass today only because they read the
  one-release-behind mirror; run against the published page the same assertions fail. So a green suite is currently
  describing a bar nobody is served.
- Second consequence: **no guard anywhere asserts the new single `gold.html` bar entry** (searched every
  `backtester/tests/*.js`; nothing matches `topbar-link[href="gold.html"]`). The release's most visible bar change is
  unguarded.

Required in Task 0: bring the mirror's `index.html` level with the published bar, or record why the mirror is not
maintained; re-point those three assertions at the published route - the single `gold.html` entry, plus the in-page hops
that still exist, since each research page keeps its own related-pages row; add an assertion for the `gold.html` entry;
and say in the change that the suite had been passing against a stale mirror. Nothing here needs a new user decision.

## 5. The route: inject the same bytes into every page

**Recommended (N1a).** One canonical partial, injected as bytes at build time:

1. a new partial - `backtester/partials/shared_nav.html` - holding (a) the bar bytes, (b) the rail bytes in two named
   variants (dashboard buttons / standalone anchors), and (c) the nav's CSS subset copied from the published `styles.css`
   (`.topbar`, `.topbar-brand`, `.topbar-meta`, `.topbar-link`, `.topbar-dual-clock`, `.side-rail*`, `.tab-bar`,
   `.tab-button`, plus the positioning rules of section 7);
2. a new builder - `backtester/scripts/build_shared_nav.js` - that writes the block into each page between the markers
   `<!-- SHARED-NAV:START -->` and `<!-- SHARED-NAV:END -->`, and fails loudly if a marker is missing, if a page's block
   does not match the partial, or if a page carries a second block;
3. the block carries the CSS inside `<style id="shared-nav-css">` next to the markup, so **no page needs a new
   stylesheet link** and every page still renders offline from a `file://` address.

**Not recommended (N1b: link `styles.css` on every page):** five pages load no stylesheet today and keep everything
inline; `styles.css` is a large global sheet whose body, table and link rules would restyle research pages nobody asked to
change, and it is a network dependency on pages that today render with none. It stays available as an option if the lane
wants one stylesheet site-wide - in which case the draft page still cannot take it (section 6), so the site would carry
two routes rather than one.

**Not recommended (N3: hand-paste the block):** nine copies drift, and the four generated pages lose the block at the
next build.

## 6. Page by page: where the block goes, what is replaced, what is kept

| Page | What to do | Generated? |
| --- | --- | --- |
| `index.html` | Replace the existing bar and rail with the canonical dashboard variants, keeping `id="agentTabs"` on the nav and every `data-tab` value: `script.js` binds `.tab-button` clicks and reads `dataset.tab` (lines 14,875 and 14,931-14,932), so a renamed or re-ordered entry silently stops working. Keep the `.dashboard-frame` layout. | no |
| `gold.html` | **The page the user named (revision 2).** Insert the bar and rail at the top of `<body>`, above `.goldtabs-wrap`, byte-identical to `index.html`'s two blocks. Keep the page's own title block, the "Back to the dashboard" link, the four tabs and the foot note: the shared block is added above them and nothing is removed. `.goldtabs-wrap`'s top padding becomes the content offset for the rail (section 7). This is the first page the change must fix, so a reader who opens Gold from the bar sees the same chrome as the home page. | yes (own builder) |
| `dashboard-northstar.html` | No `<header>` exists: insert the block at the top of `<body>`, before `<main class="northstar-shell">`. Keep the hero, the action row and its `index.html` link. | no |
| `standing-dashboard.html` | Same insertion as the north star page. Keep the "Now" bar and the hero. | no |
| `backtest-flow.html` | Insert the block **before `<main>`**, not inside it: that page's guard asserts `header section` and `header footer` counts of 0 and exactly three direct children of `main` (`.lane-live`, `.barrier`, `.lane-research`), so a block dropped inside `main` or an extra `section` inside a header fails it. Keep the page's own title, lede and chips. | no |
| `gold-direction-scorecard.html` | Change the template `backtester/templates/gold-direction-scorecard.html`, rebuild with `build_gold_direction_scorecard.js`, then diff to prove only the marker block moved. Keep the related-pages row and the back-to-dashboard link the page's guard asserts. | yes |
| `gold-backtest-outcomes.html` | Template `backtester/templates/gold-outcomes.html` via `build_gold_backtest_outcomes.js`. Same diff discipline. | yes |
| `gold-backtesting.html` | Template `backtester/templates/gold-research.html` via `build_gold_evidence_audit.js`. Same diff discipline; this is the 292 KB page, so the diff must be read, not assumed. | yes |
| `gold-factor-wip.html` | Keep it self-contained: the block with its inline `<style>`, no `<link>`, no `<script>`, no `<img>`, no `<iframe>`. Its guard asserts that element count is exactly 0, one `.draft` element reading `/50 of 50 answered/`, and exactly five `h2` elements - so the nav must add no heading. | no |

Do not remove a working link. The three research pages keep their related-pages rows, the north star pages keep their
action rows, and the draft page keeps its own text: the shared block is added above what is there, not instead of it.

## 7. The rail off the dashboard: anchors, the deep-link question, and the layout

**Anchors, not buttons.** On the eight non-dashboard pages each rail entry is `<a class="tab-button"
href="...">` with the same label, the same order and the same look. The dashboard keeps its `<button
data-tab="...">` and its `script.js` behaviour, and `id="agentTabs"` stays dashboard-only.

**Measured, and it changes the old plan:** `script.js` binds `.tab-button` clicks to `setTab(btn.dataset.tab)` (lines
14,875, 14,931-14,932) and never reads `location.hash` - `location.hash` appears nowhere in `script.js`. So a link to
`index.html#GOLD` today opens the dashboard on its default tab and nothing else; the earlier request's suggestion of
`index.html#gold` (its section 4.1) does not select a tab. `gold.html` does honour the hash, on load and on `hashchange`
(lines 101-102) - the pattern already exists in the site.

**Settled by the user on 2026-10-03: "both".** Every rail entry on the eight non-dashboard pages is a real `<a>` to the
dashboard *and* lands on the view its label names - that is route (a) carrying the (b) fallback, so the entry still works
if the script does not run:

- **(a) give the dashboard the hash handling `gold.html` already has**: about ten lines in `script.js`, on load and on
  `hashchange`, mapping the hash to `setTab`. Then `index.html#GOLD` lands where the label says, a rail click from any page
  means something, and a guard can pin one deep link end to end. Cost: one bounded `script.js` change, in a file the
  release already touches.
- **(b) the fallback that makes "both" true**: the same entry is a plain `index.html` link, so with no script - or if a
  hash is not recognised - the reader still lands on the dashboard rather than on nothing, and reverting (a) breaks no
  address.

The one thing not to do is the revision-1 (b) alone: seventeen labels landing on the same default view is a rail that
navigates to the dashboard rather than navigation, which is the opposite of the user's "make the pages easy to navigate
to". "Easy to navigate to" cuts both ways as well - every page reachable from every other page through the bar and the
rail - so the change is not finished until a reader can get from a research page to any other named view, and back.

**The gold entries.** On non-dashboard pages the rail's `Gold` entry should point at `gold.html#direction` (the tabs page,
whose hash handling already works), not at `index.html#GOLD`.

**Layout, and the one real risk.** Those eight pages were built as single-column documents; the rail is a left column that
does not exist in their layout. Give the block a fixed-position rail plus a content offset, scoped to the new class so
nothing else moves, and add a media query that hides the rail below the width where it crowds the content, leaving the bar
in place. Risk to guard, because `gold-backtesting.html` is 292 KB of wide tables: at the widths other page guards
already use (1440, 1180, 860, 768, 721, 390) assert that no page scrolls sideways and that the rail overlaps no table.

## 8. The one thing that cannot be identical everywhere: the live date and clock

`index.html`'s bar carries `#currentDate` and `#topbarClock`, filled by `script.js`; until it runs they read
"Loading date..." and "UK --:-- | ET --:--". No other page loads `script.js`, so a literal copy would leave eight pages
showing "Loading date..." forever, and a copy plus a script is barred on the draft page by its own guard and is an
unwanted dependency elsewhere.

**Settled on 2026-10-03: the user delegated this to the lane's judgement - "whatever is most effective relative to the
project objectives" - and the judgement is the revision-1 recommendation.** The bar on the other eight pages carries the
brand and the four entries and **omits the two live spans** - the single deliberate difference, named here and asserted by
the guard, with the rail and everything else matching exactly. The reasons, so the call can be re-opened on facts rather
than taste: the clock's only job is to show the site is live, and these eight pages are built reports whose own as-of and
updated lines already say what they are made of; loading the dashboard's ~14,900-line `script.js` onto them buys no
navigation and adds an unknown side-effect surface plus a hard failure on the draft page, which may load no script at all;
and a baked date line would be a fixed number wearing a live number's clothes, which is worse than an absent one for a
reader checking currency - the project's whole point on these pages is that what a page says about itself can be trusted.
If the user later wants a date visible on every page, the honest route stands as written: a static line baked at build
time and stated with its source like any other number. Do not fake a ticking clock.

## 9. Guard work

Three parts, and all three belong in the same change as the pages.

**One new consistency guard**, `backtester/tests/site_nav_consistency.browser.test.js`, opening all nine served files:
exactly one `.topbar` and one `.side-rail` per page; the brand string equal on all nine; the ordered bar labels and their
`href` targets equal on all nine; the ordered rail group labels equal on all nine; the ordered rail entry labels equal on
all nine; the head mark, head label and foot string equal on all nine; a rail entry is a `button` with a `data-tab`
`script.js` knows on `index.html` and an `a` whose target exists on the other eight (no dead link); each page's marker
block equals the partial byte for byte, so an edit to one page alone fails; the draft page still loads nothing outside
itself; and - if 7(a) is taken - one end-to-end deep link: click the rail's Gold entry from a research page and assert the
dashboard's active tab is Gold.

**Re-point the three stale hop guards** (Task 0): at the published bar, the hop to the scorecard, the outcomes page and
the draft page is the single `Gold` entry into `gold.html` plus the tabs inside it, so those assertions move there and the
`a[href="index.html"]` visibility assertion on the scorecard page stays valid through that page's own back-link.

**Keep the existing page guards green:** `backtest_flow_page.browser.test.js` (structure, widths, no sideways scroll),
`gold_factor_wip_dashboard_link.browser.test.js` (nothing external, draft banner at 50 of 50, five headings),
`tests/live_trading_dashboard.browser.test.js` (the rail's Live Trading tab), and the whole set under
`node scripts/test-local.js browser` (`npm run test:browser`).

## 10. Acceptance: how the reviewer knows it is done

1. All nine pages served, each HTTP 200, each carrying exactly one bar and one rail, checked against the live site - not
   only against the working tree, since that is exactly how the drift in Task 0 went unnoticed.
2. The fingerprint equal page to page, with only the two named differences (the live clock; button versus anchor).
3. No page gained a request to anything outside itself. The draft page proves it for itself, and the same request
   listener can be pointed at any other page.
4. The re-pointed hop guards pass against the *published* bar, and the new consistency guard fails if a single page drifts
   back - demonstrated once by breaking one page deliberately and watching it fail.
5. By hand: open a research page, click the rail's Gold entry and land on Gold; from the draft page click North Star in
   the bar and land there; open the dashboard and confirm the rail still switches views.
6. No measured number, figure, banner, as-of line or table cell anywhere changed. Diff each page and show that every
   change sits inside the marker block.
7. Name the served bytes after the push - size and digest per page - as the gold release did, so the result is verifiable
   from outside rather than asserted.

## 11. Rollback

Revert the marker blocks (or the pages and templates plus the one partial and builder), and the `script.js` hunk if 7(a)
was taken. No number, table, address or data artifact is in scope, so a revert costs the look and nothing else, and no old
address stops working.

## 12. Boundaries and order

- The pages, `styles.css`, `script.js`, the templates, the builders, the guards and the push are the coordinator's
  dashboard lane. This worker writes only `docs/strategy/` in its own worktree, cannot publish and holds no credentials
  for this advisory assignment. Nothing in this file is adopted by writing it.
- Order: Task 0 (mirror and stale guards) → partial + builder → the nine pages → the consistency guard → push → live
  verification (section 10).
- One change, one push. Splitting the bar and the rail into two pushes leaves the site visibly half-done in between; if it
  must be split, bar first, rail second, with the guard written to pass on both halves.
- Both of the user's open answers here were closed on 2026-10-03: the rail off the dashboard is "both" (section 7) and
  the clock is settled by delegated judgement (section 8). If he changes his mind on either, those two are the only knobs;
  everything else follows from what he already said on 2026-10-01 and 2026-10-03.
- The gold page is named, not implied (revision 2): it is the first page this change fixes, because it is the page he was
  looking at when he asked.

## 13. Provenance

- Page sizes, marker counts, bar and rail lines, stylesheet links, `data-tab` values: read from `origin/main` `f8bc80f` on
  2026-10-03 with `git ls-tree` / `git show` from this worktree, not from any working tree.
- Hash handling in `gold.html` lines 101-102; `script.js` lines 14,875 and 14,931-14,932 driving `.tab-button` by
  `dataset.tab`; `location.hash` absent from `script.js` - found with `git grep` on `origin/main` and read in place.
- Release commits as published: `2f25c8c` (gold tabs page, one bar entry, draft at 50 of 50) and `f8bc80f` (live-trading
  snapshot).
- Mirror drift: canonical checkout on `orchestration/control-plane-20260920` at `30d853b`; `git merge-base --is-ancestor
  2f25c8c HEAD` exits 1; its `index.html` is clean against its HEAD and was last written by `561cf6b` on 2026-09-30.
- Guards: `backtester/tests/gold_direction_dashboard_link.browser.test.js:15,22`,
  `gold_outcomes_dashboard_link.browser.test.js:15`, `gold_factor_wip_dashboard_link.browser.test.js:20-23,28,44-45`,
  `backtest_flow_page.browser.test.js:85-86,109-110`.
- Templates and builders: `templates/gold-direction-scorecard.html` ← `build_gold_direction_scorecard.js`;
  `templates/gold-outcomes.html` ← `build_gold_backtest_outcomes.js`; `templates/gold-research.html` ←
  `build_gold_evidence_audit.js`; `index.html`, `gold.html` and `gold-factor-wip.html` have no builder that emits them.
- Test commands: `node scripts/test-local.js browser`, and `npm run test:browser` for the same set.
- Superseded: `DASHBOARD_NAV_CONSISTENCY_REQUEST.md` (2026-10-01) - its page table is one release old and its section 4.1
  hash suggestion does not select a tab today. It remains the record of the request and of the user's two answers.

