# Gold tabs - build brief and release checklist

Prepared 2026-09-30 in the evening by worker `strategy` (`strategy-advisory-001`), for the dashboard lane that owns the
live pages. This is Route A of `GOLD_PAGE_TABS_MERGE_REQUEST.md`: one shell page, four tabs, each framing a page that
already exists at the site root. Nothing in it re-derives a number, and nothing in it depends on a decision that is
still open.

The user's instruction the same evening was to save this for tonight and be ready to push it live in the morning, so
this brief is written as a checklist: every edit, in order, with the exact text it replaces, and one acceptance run at
the end. The shell is written, verified in a real browser and committed, so the morning's work is mechanical. This
revision also records what the coordinator's review of the release package measured, and it changes one instruction:
the bar that goes live is a different file from the bar in this checkout, so the edit in E2 belongs on the published
file, not on the checkout copy (section 3).

## 1. What is ready now

| Artifact | Where | Measured |
| --- | --- | --- |
| The shell to publish as `gold.html` | `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` (this worktree), revision 2 | 5,839 bytes, 106 CRLF lines, 0 bare LF, sha256 `de60c2b7c452aa74ac282d475707e15d2d68977c77c4cd2a505cb4d205e64da6` |
| The spec, routes and couplings | `docs/strategy/GOLD_PAGE_TABS_MERGE_REQUEST.md` | 8 sections, unchanged |
| What the user can open tonight | `tmp/preview/gold-tabs-preview.html` (ignored scratch) | frames local copies of the four published pages; not publishable and never to be published |
| The harness that proved the candidate | `tmp/site-sim/check-candidate.js` (ignored scratch) | serves the candidate as `gold.html` beside the four pages plus `styles.css` and drives it with Playwright |

One note on that hash, because it is the one step a copy can slip on: the recorded sha256 is the file **as it sits on
disk** in this worktree (CRLF, 5,839 bytes). Git stores the same page as an LF blob of 5,733 bytes, because both this
worktree and the canonical checkout set `core.autocrlf=true` - exactly as it stores the published pages, where the draft
page is a 21,281-byte LF blob on disk as 21,541 CRLF bytes and the scorecard a 143,102-byte LF blob on disk as 143,517
CRLF bytes. So copy the file from the checkout or the worktree, not the output of `git cat-file`. Both forms render
identically; only the checkout copy matches the recorded hash.

Revision 2 is the accepted revision 1 with two edits and nothing else, proved by rebuilding revision 2 from revision 1
with only those edits applied and comparing (`tmp/check-candidate-rev2.js`, identical): the header comment was replaced,
and one word in the first style comment changed from "the candidate" to "this page". Revision 1 said in its own source
that it was a build candidate not to be published and that two gold bar links would be replaced; both would have gone
live inside the published file, and the second was wrong for the file that is live (section 3). Revision 2 says what the
page is - one tab strip over four pages that already exist - and names no internal document except the brief, for the
next person reading the source. The file name keeps the word `CANDIDATE` because it lives in `docs/strategy`, which is
this worker's folder: it is a source file for the lane, not a live page (section 7).

The candidate is a normal site page: one stylesheet link to the site's own `styles.css`, a small `<style>` block of its
own so it still stands up if the shared nav is not reused, four `<iframe>` elements pointing at sibling pages, and about
forty lines of vanilla JavaScript for the tabs. It contains no data, no figure, no claim about the work.

**Verified on a served host, not on `file://`** (`node tmp/site-sim/check-candidate.js`, Playwright Chromium, 1440x900):
all four tabs select, each frame loads and reads the page's own values - 25 scored, "Gold backtesting evidence",
4,956 evaluated, and the draft banner's "40 of 50 answered" - each open frame measures 1398x750, no request returns
404, no console error, `gold.html#factor` reopens that tab, the arrow keys move the selection, and the three old
addresses plus the draft page still load at their own URLs. Result line: `CANDIDATE OK as it would run on the site`.

## 2. What the change is, and what it is not

It is **framing, not merging**. The four pages keep their own files, their own generators, their own data artifacts and
their own guards; the new page only puts them one click apart under one bar entry. That is why no measured number can
move: no generator is touched, and a frame cannot change what the framed document says.

It is **not** a rewrite of the site's navigation system, not a change to `styles.css`, `script.js` or any other page,
and not a change to the four gold pages themselves.

## 3. The five edits, in order

**E1. Add the page.** Copy `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` (revision 2) to the site root as `gold.html`,
byte for byte. Do not reword the tab labels; the draft label is deliberate. Revision 2's own header comment is written
to be published - it describes the page and names no internal note except this brief - so nothing needs stripping at
copy time. The word `CANDIDATE` in the file name is folder naming, not content.

**E2. One bar entry instead of three, on the file the site actually serves.** Two `index.html` files matter here and
they are not the same file. Measured from git objects tonight, not assumed (`tmp/check-published-bar.js`):

- **Published** - `origin/main` at `599c686a`: 18,901 bytes, 0 CRLF, 360 bare LF, sha256 `eff9f91d...`, five topbar
  links - North Star Brief, Standing Dashboard, **Gold Direction (line 19)**, Backtest Flow (line 20), **Gold Factor
  (draft) (line 21)**. It carries the Silver, WTI, GBP and Live Trading work, and no `gold.html` link, so E1 is
  genuinely additive. It has **two** gold entries and no "Gold Backtest" entry at all, which is what the merge request
  originally described.
- **Checkout** - `HEAD` at `6cc608ef`: 19,332 bytes, 0 CRLF, 366 bare LF, sha256 `eeab9f47...`, six topbar links, three
  gold entries - **Gold Backtest (line 19), Gold Direction (line 20)**, Backtest Flow (line 21), **Gold Factor (draft)
  (line 22)**. It has no Silver, WTI, GBP or Live Trading section.
- `git diff origin/main -- index.html` is 39 insertions and 33 deletions; 275 commits exist only on `origin/main` and
  179 only on this branch.

**The release rule that follows: edit the published file; do not copy the checkout file over it.** Copying the checkout
`index.html` into the release would revert the live Silver, WTI, GBP and Live Trading work and the newer cache-buster
strings along with the intended one-entry change. So start the release from `origin/main` and remove its two gold lines,
replacing them with one, keeping Backtest Flow where it is:

```html
      <a class="topbar-link" href="gold-direction-scorecard.html">Gold Direction</a>   <!-- published line 19 -->
      ...
      <a class="topbar-link" href="gold-factor-wip.html">Gold Factor (draft)</a>       <!-- published line 21 -->
```

```html
      <a class="topbar-link" href="gold.html">Gold</a>
```

The published bar then reads: North Star Brief, Standing Dashboard, Gold, Backtest Flow - same order, one gold entry.
On the checkout copy the same edit is three lines (19, 20 and 22), because that copy still carries a Gold Backtest entry
the live bar does not have. One consequence to take deliberately: on the live site the outcomes page has no bar route
today, so this release gives it its first one, which is why the outcomes guard's rewrite in E4 is load-bearing rather
than cosmetic.

The draft status does not disappear: it is on the draft tab's own label inside the page, and on the page's banner. The
in-page `Gold` tab button - published `index.html` line 44, the checkout copy's line 45 - is a dashboard tab that
already existed and is unrelated; leave it alone.

**E3, E4, E5. The three hop guards.** Each guard today finds its own bar link, clicks it and lands on the page. With
one entry those links no longer exist, so each guard takes the same hop a person now takes: the bar link, then the tab.
The assertions themselves stay exactly as they are - same probe, same expected value - so the guards do not get weaker,
they get one step longer. The pattern, using the direction guard as the example:

```js
    const entry = page.locator('a.topbar-link[href="gold.html"]');
    assert.equal(await entry.count(), 1, 'the topbar must carry exactly one gold entry');
    await entry.click();
    await page.waitForURL(/gold\.html($|#)/);
    const tab = page.locator('#tab-direction');
    assert.equal(await tab.getAttribute('aria-selected'), 'true', 'the direction tab is the one that opens');
    const framed = page.frameLocator('#panel-direction iframe');
    assert.equal(await framed.locator('#c-scored').textContent(), '25');
    assert.equal(await framed.locator('#rows tr').count(), 25);
```

Per file: `gold_direction_dashboard_link.browser.test.js` keeps `#c-scored` = 25 and 25 rows, and its "links back to
the dashboard" assertion moves inside the frame (`framed.locator('a[href="index.html"]')`), since the scorecard is the
framed document now. `gold_outcomes_dashboard_link.browser.test.js` keeps `#c-evaluated` = 4,956 and its quote
assertion, inside `#panel-outcomes iframe`. `gold_factor_wip_dashboard_link.browser.test.js` keeps the draft label
check, `.draft` count 1 and the as-of line inside `#panel-factor iframe`, with the label assertion now reading the tab
label rather than the bar link. Its second test - the page rendered offline with nothing outside the document - is
untouched, because that page is still published on its own.

The three page-level guards need no edit: `gold_research_page.browser.test.js`,
`gold_backtest_outcomes_page.browser.test.js` and the direction page's own test read the pages directly.

## 4. If revision 2 of the draft page is published in the same release

One coupling, measured on the revision-2 bytes: `WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html` is 24,687 bytes, 289 CRLF
lines, sha256 `aa9e104c81b6e479ca59b05b9b31840877b4626624e54c5a0170dc202a98dd1e`, and it still has five `<h2>`
sections, one `.draft` banner and the same "As of 30 September 2026" line. The only pinned value that changes is the
answered count, so `gold_factor_wip_dashboard_link.browser.test.js` line 28 must move from
`/40 of 50 answered/` to `/50 of 50 answered/` **in the same change as the copy**, or the tree is left with a failing
guard - and because this repository has no CI, nothing else would catch it.

## 5. The acceptance run

There is no CI in this repository; the guards are run by hand. After E1-E5 (and, if taken, the revision-2 copy and its
one-line assertion), run:

```
node --test backtester/tests/gold_direction_dashboard_link.browser.test.js
node --test backtester/tests/gold_outcomes_dashboard_link.browser.test.js
node --test backtester/tests/gold_factor_wip_dashboard_link.browser.test.js
node --test backtester/tests/gold_research_page.browser.test.js
node --test backtester/tests/gold_backtest_outcomes_page.browser.test.js
```

or the whole set at once with `node scripts/test-local.js browser` (or `npm run test:browser`). All five pass with the
four pages otherwise untouched. Then, by hand in a browser on the published copy: the bar shows one gold entry; it opens
`gold.html`; the four tabs each show the right page; `gold.html#outcomes` opens on the outcomes tab after a reload; the
arrow keys move between tabs; and the three old addresses plus the draft page still load exactly as before. Measured
today as a baseline, the guards pass in their present form (2 tests, 2 pass, on the draft guard when run against the
canonical root), so any failure after the change belongs to the change.

**One thing to settle before the guards are run, because they do not read the published file.** Each hop guard opens
`path.resolve(__dirname, '../../index.html')` - the `index.html` beside the guards, in whichever tree they are run from -
over `file://` (`gold_outcomes_dashboard_link.browser.test.js` line 14 is the pattern). So a guard that asserts exactly
one `a.topbar-link[href="gold.html"]` passes only in a tree whose `index.html` carries that entry. Two workable routes,
the lane's choice: run the guards in the release worktree built from `origin/main`, whose `index.html` is the edited
published file; or bring the checkout copy's bar to the same one-entry state in the same change. What would not work is
editing only the checkout copy and calling the result live - the guards would be green about a file the site does not
serve - or pushing the checkout file over the published one, which section 3 rules out.

## 6. Rollback

Undo E2 (restore the bar lines - two on the published file, the three on the checkout copy), delete `gold.html`, and
revert the three guard hops. That is the whole of it: the four gold pages, the generators, the artifacts, the shared
stylesheet and every other page were never touched, so there is nothing else to put back. The old addresses never
stopped working, so a rollback costs no broken link.

## 7. Boundaries the lane should keep

- Do not edit the four gold pages, their generators, their templates or their data artifacts for this change.
- Do not copy the checkout `index.html` over the published one. They are different files (section 3) and copying would
  revert live work; make the bar edit on the file the site serves.
- Do not publish the candidate from `docs/strategy/`; it is a source file for this lane, not a live page. In
  particular do not publish the scratch preview: it frames local files and would break the rule that a published page
  stands on its own.
- Do not reword the draft page's banner, as-of line or "what this page is not" section while copying revision 2. Those
  are the page's own honesty mechanism and its guard asserts them.
- Do not remove the side-rail `Gold` button, and do not add a fifth tab: the user asked for the named pages, one entry,
  nothing more than one click away.

## 8. What is still the user's to decide

Three things were waiting before this brief and are still waiting, none of which blocks the build above: the route
(route A as briefed, or route B's single generated document later); whether to publish revision 2 in the same release
(the one-line guard move in section 4 is ready either way); and whether to open the movement-screen measurement lane,
which is the only thing that can put real factor numbers in the Factor tables tab. The user's "be ready to push this
live tomorrow morning" is read as route A, ready as briefed, with the revision-2 copy taken only on a second word.

Two further questions were raised by the review of the release package and are answered rather than left open. The
candidate's header comment said it was a build candidate and to replace two gold bar links: revision 2 removes both
statements, so there is nothing to strip at copy time (section 1). And the fourth tab - the outcomes page, the one the
user did not name, which this release also gives its first bar route - is kept, because it is where the site's own
"Gold Backtest" entry points in the checkout copy; if the user would rather have three tabs than four, dropping it is
one `<section>`, one button and one `<iframe>` in the shell and nothing else.

## 9. Coupling added 2026-10-01: the shared header and side bar

The user's instruction on 2026-10-01 - *"make sure all pages across the dashboard have the same header and side bar
menu"* - lands directly on this release, because `gold.html` as written carries its own bespoke header (`.goldtabs-head`
with a "Back to the dashboard" link) and **no side rail**, which is the exact inconsistency the user is asking to remove.
The full requirement, the measured state of every served page and the couplings are in
`docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md`; this section is only the note that the release cannot ignore it. Two
clean orders: publish this release first and bring `gold.html` into line with the other pages in the nav change (simplest
- the fingerprint then already holds the single `gold.html` entry), or do the nav change first and ship the shell as
candidate revision 3, already carrying the shared header and rail. Either way E1-E5 are otherwise unchanged; what changes
is whether the copied shell keeps its own header or arrives with the shared one. Do not publish `gold.html` with its
bespoke header and treat the other seven pages as a separate job the user did not ask for.

