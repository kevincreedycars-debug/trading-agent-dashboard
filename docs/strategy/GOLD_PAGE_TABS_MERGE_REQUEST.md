# Request: one gold page with tabs, so the gold work can be navigated

Prepared 2026-09-30 by worker `strategy` (`strategy-advisory-001`), on the user's own instruction the same evening:
*"all of these pages need to be merged but into tabs so I can nivagate it easiy"*. The user named three live pages:
`gold-backtesting.html`, `gold-direction-scorecard.html` and `gold-factor-wip.html`. This document is the request for
that work, with everything the building lane needs so it does not have to re-derive any of it.

## 1. What is asked for

1. **One page with tabs**, in place of three separate destinations, so the gold work is reached by one click and then
   navigated inside one page.
2. **One top-bar entry.** Today the bar carries three gold-ish links ("Gold Backtest", "Gold Direction", "Gold Factor
   (draft)") and the backtesting page the user named has no bar entry at all. After the merge: one link, labelled
   **Gold**, opening the tabbed page.
3. **One tab per page the user named**, each tab showing exactly what that page shows today, unchanged:
   | Tab (suggested label) | Holds |
   | --- | --- |
   | Direction | `gold-direction-scorecard.html` - the ten declared factors scored, with drift edges |
   | Backtest evidence | `gold-backtesting.html` - the historical factor diagnostics / evidence audit |
   | 28-factor outcomes | `gold-backtest-outcomes.html` - the 28-factor outcomes census |
   | Factor tables (draft) | `gold-factor-wip.html` - the work-in-progress draft page |
   The lane owns the exact wording and order; the requirement is one bar entry, four destinations, nothing more than
   one click away, and the draft status visible on the draft tab's label.
4. **Reload- and share-safe.** The open tab is reflected in the address (for example `#direction`) so a reload or a
   shared link reopens the same tab, and the tab strip is keyboard-operable with `aria-selected` set on the open tab.
5. **The three existing addresses keep working.** The old pages stay reachable at their current URLs, so no bookmark,
   no document and no guard test breaks silently.

## 2. Why the strategy worker is asking rather than building it

Write authority is the reason, not interest. This worker writes only `docs/strategy/` in its own worktree and never
touches the live pages, the top bar or the shared stylesheet: the coordinator and its dashboard lane own those, and the
single-writer rule is what has kept the published numbers stable. So this file is a request with acceptance criteria,
not a change.

## 3. The pages as they stand, measured 2026-09-30 from the canonical checkout

| Live page | Size and shape | Built by | Data behind it | Guarded by |
| --- | --- | --- | --- | --- |
| `gold-direction-scorecard.html` | 143,517 bytes, 415 CRLF lines, sha256 `0caf0559...` | `backtester/scripts/build_gold_direction_scorecard.js`, template `backtester/templates/gold-direction-scorecard.html` | `data/gold-direction-scorecard-20260927.json` | `backtester/tests/gold_direction_scorecard_page.browser.test.js`, `gold_direction_dashboard_link.browser.test.js` |
| `gold-backtesting.html` | 292,270 bytes, LF lines, sha256 `60dca907...` | `backtester/scripts/build_gold_evidence_audit.js`, template `backtester/templates/gold-research.html` | `data/backtester-checker-gold-24h-2024-2026.json`, `data/gold-evidence-audit.json` | `backtester/tests/gold_research_page.browser.test.js` |
| `gold-backtest-outcomes.html` | 19,420 bytes, 234 CRLF lines, sha256 `a72a25eb...` | `backtester/scripts/build_gold_backtest_outcomes.js`, template `backtester/templates/gold-outcomes.html` | `data/gold-28-factor-outcomes-20260925.json` | `backtester/tests/gold_backtest_outcomes_page.browser.test.js`, `gold_outcomes_dashboard_link.browser.test.js` |
| `gold-factor-wip.html` | 21,541 bytes, 260 CRLF lines, sha256 `675fc9da...` | Not generated: this worker's `docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html` (live = revision 1, published as `a2b0e13`) | The closed question round; base rates read from the spent gold record | `backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` |

Two facts this table makes plain, both worth the lane knowing before it starts:

- **All three of the older pages are generated.** A merge that copies their markup into one file creates a second
  place for those numbers to live, and the generators will not know about it. That is the main argument for the
  recommended route below.
- **The backtesting page has no top-bar entry today**, which is why the user listed it: they can reach it only by
  direct address or from the backtest-flow map.


## 4. Two routes, and which one this worker recommends

**Route A - a tab shell around the three pages that already exist (recommended).** One new file, for example
`gold.html`, holding a tab strip and one frame per tab, each frame pointing at the existing address of that page.
Nothing is copied, so nothing can drift: the generators, the data artifacts and the three page guards stay exactly as
they are, and the only new risk is a shell that fails to render. New weight is about ten kilobytes of markup and CSS,
and the tab strip can reuse the site's own button styling so it looks like the rest of the dashboard. Cost: the three
old files stay live (which the user's own bookmarks want anyway), and the framed page keeps its own scrollbar unless
the lane decides to size the frame to its content.

**Route B - one generated document containing all three bodies.** Nicer in the end: one file, one title, no frames,
nothing to size. But it needs a new composition step that runs the three generators together and fails closed when one
of them is stale, it produces a document of roughly 450,000 bytes, and it forces the three page guards to be
repointed at one file. **Recommendation: Route A now**, so the user has the navigation tonight, and Route B later only
if the user asks for a single file or the frames prove awkward.

**Either route has to update the three hop guards in the same change.** They assert the current bar links and, in one
case, the current live numbers:

- `gold_direction_dashboard_link.browser.test.js` - exactly one top-bar link to `gold-direction-scorecard.html`, then
  the scored count reads 25 and 25 rows render.
- `gold_outcomes_dashboard_link.browser.test.js` - exactly one top-bar link to `gold-backtest-outcomes.html`, then the
  evaluated count reads 4,956.
- `gold_factor_wip_dashboard_link.browser.test.js` - exactly one top-bar link to `gold-factor-wip.html` whose label
  matches "draft", then the banner reads **"40 of 50 answered"** and the as-of line reads "As of 30 September 2026".

With one Gold link and tabs, each hop becomes link-then-tab-click. The draft label has a natural home in the draft
tab's label. **The published draft and that third guard move together:** the guard pins the live answered count at
40 of 50, so publishing revision 2 (50 of 50) without updating the assertion in the same commit leaves a failing test
in the tree. Once revision 2 is live the assertion should read 50 of 50. These are local tests run by hand
(`node scripts/test-local.js browser`); there is no CI workflow in this repository, so nothing will catch the
mismatch for the lane.

## 5. What the merge must not change

- **No number is re-derived, re-cut or re-rendered.** The three older pages are copied or framed as they are; the
  factor tables tab stays the draft it is.
- **The draft honesty mechanism survives:** the draft banner, the answered count, the as-of line and the "what this
  page is not" section all stay, and the tab label says "draft".
- **The three addresses keep working**, and the pages keep linking back to the dashboard.
- **No new data source, no fetch, no network call** beyond what the framed pages already load today, and no credential,
  path into a live system, sealed-window value or broker reference appears anywhere in the shell.
- **Nothing on the merged page is presented as a result, a signal or a ranking.**

## 6. Checks the lane can run, so "merged" is provably navigation-only

1. `backtester/tests/gold_research_page.browser.test.js`, `gold_direction_scorecard_page.browser.test.js` and
   `gold_backtest_outcomes_page.browser.test.js` still pass **unchanged**.
2. The three hop guards pass in their updated form, including the tab click.
3. Each destination still hashes to the value in the table in section 3, which proves no number moved.
4. The shell renders offline from `file://` as well as from the live host, with no script errors and nothing loaded
   from outside the site.
5. Tab behaviour: keyboard focus and arrow keys move between tabs, `aria-selected` follows the open tab, a reload on
   `#direction` reopens the Direction tab, and the first paint is usable at 1440 wide and at narrow phone width.

## 7. What the merge does not fix, stated so no one is surprised

The user's second sentence the same evening was *"I am still not seeing what we have been asking for"*. Merging pages
is navigation; it produces no number. The factor numbers the user wants to see come from the movement-screen
measurement run over the already-spent gold record - the run the answered questions define - and the coordinator's own
record keeps that lane closed because it runs into the user's standing hold on the gold lane. Until that run is
authorised and opened, the "Factor tables (draft)" tab shows a draft with a closed question round, base rates and
nothing measured for this work, exactly as it does now.

## 8. Suggested lane, and the single writer

Suggested lane id `dashboard-gold-tabs-001` (registered this time, unlike the draft page's provisional id). Single
writer: the dashboard lane owns the merged page, the bar entry and the guards. The strategy worker keeps editing only
its own file in `docs/strategy/`, reports every change with its new hash, and does not touch the merged page once it
exists.

## 9. Build candidate ready, and how it was verified (added 2026-09-30, later the same evening)

The shell described in section 2 is no longer only described. `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` holds it -
6,199 bytes, 109 CRLF lines, no bare LF, sha256 `74dd93c8fe6daa179718322d1fb6f339dcdb95f1acb752d534af3af832446eea` -
and `docs/strategy/GOLD_TABS_BUILD_BRIEF.md` is the release checklist: the five edits with the exact text they replace,
the acceptance run, the rollback, and the one coupling if revision 2 of the draft page is published in the same
release. The user's instruction was to save this for tonight and be ready to push it live in the morning, so the route
is read as **route A** and the candidate is committed ready to copy in as `gold.html`.

Two things the work turned up that amend this request, both from measuring the live tree rather than trusting an
earlier note:

1. `index.html` carries **three** gold bar links today - lines 19, 20 and 22, "Gold Backtest" to the outcomes page,
   "Gold Direction" to the scorecard and "Gold Factor (draft)" to the draft - not the two this document assumed. The
   change is to replace all three with one. The draft label's meaning moves to the tab label and the page banner, so
   no status is lost.
2. The candidate was verified on a served host with the four pages and `styles.css` as siblings, not only on `file://`
   (Playwright Chromium, 1440x900): four tabs select, all four frames load and read the pages' own values, no 404, no
   console error, hashes reopen the right tab, arrow keys move the selection. Harness: `tmp/site-sim/check-candidate.js`
   in this worker's ignored scratch. The verification is a script result recorded in this worker's notes, not a claim.

