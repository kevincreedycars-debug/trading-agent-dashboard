# Gold tabs - build brief and release checklist

Prepared 2026-09-30 in the evening by worker `strategy` (`strategy-advisory-001`), for the dashboard lane that owns the
live pages. This is Route A of `GOLD_PAGE_TABS_MERGE_REQUEST.md`: one shell page, four tabs, each framing a page that
already exists at the site root. Nothing in it re-derives a number, and nothing in it depends on a decision that is
still open.

The user's instruction the same evening was to save this for tonight and be ready to push it live in the morning, so
this brief is written as a checklist: every edit, in order, with the exact text it replaces, and one acceptance run at
the end. The shell is written, verified in a real browser and committed, so the morning's work is mechanical.

## 1. What is ready now

| Artifact | Where | Measured |
| --- | --- | --- |
| The shell to publish as `gold.html` | `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` (this worktree) | 6,199 bytes, 109 CRLF lines, 0 bare LF, sha256 `74dd93c8fe6daa179718322d1fb6f339dcdb95f1acb752d534af3af832446eea` |
| The spec, routes and couplings | `docs/strategy/GOLD_PAGE_TABS_MERGE_REQUEST.md` | 8 sections, unchanged |
| What the user can open tonight | `tmp/preview/gold-tabs-preview.html` (ignored scratch) | frames local copies of the four published pages; not publishable and never to be published |
| The harness that proved the candidate | `tmp/site-sim/check-candidate.js` (ignored scratch) | serves the candidate as `gold.html` beside the four pages plus `styles.css` and drives it with Playwright |

One note on that hash, because it is the one step a copy can slip on: the recorded sha256 is the file **as it sits on
disk** in this worktree (CRLF, 6,199 bytes). Git stores the same page as an LF blob of 6,090 bytes, because both this
worktree and the canonical checkout set `core.autocrlf=true` - exactly as it stores the published pages, where
`index.html` is a 19,332-byte LF blob on disk as 19,698 CRLF bytes, the draft page a 21,281-byte LF blob on disk as
21,541 CRLF bytes, and the scorecard a 143,102-byte LF blob on disk as 143,517 CRLF bytes. So copy the file from the
checkout or the worktree, not the output of `git cat-file`. Both forms render identically; only the checkout copy
matches the recorded hash.

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

**E1. Add the page.** Copy `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` to the site root as `gold.html`, byte for
byte. Do not reword the tab labels; the draft label is deliberate.

**E2. One bar entry instead of three.** `index.html` carries three gold bar links today, at lines 19, 20 and 22 - the
merge request above assumed two, because the third was added after it was written:

```html
      <a class="topbar-link" href="gold-backtest-outcomes.html">Gold Backtest</a>
      <a class="topbar-link" href="gold-direction-scorecard.html">Gold Direction</a>
      ...line 21 (Backtest Flow) stays where it is...
      <a class="topbar-link" href="gold-factor-wip.html">Gold Factor (draft)</a>
```

Replace those three lines with one, leaving the rest of the bar in its present order:

```html
      <a class="topbar-link" href="gold.html">Gold</a>
```

The draft status does not disappear: it is on the draft tab's own label inside the page, and on the page's banner. The
side-rail `Gold` button at `index.html` line 45 is an in-page dashboard tab that already existed and is unrelated;
leave it alone.

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

## 6. Rollback

Undo E2 (restore the three bar links), delete `gold.html`, and revert the three guard hops. That is the whole of it:
the four gold pages, the generators, the artifacts, the shared stylesheet and every other page were never touched, so
there is nothing else to put back. The old addresses never stopped working, so a rollback costs no broken link.

## 7. Boundaries the lane should keep

- Do not edit the four gold pages, their generators, their templates or their data artifacts for this change.
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

