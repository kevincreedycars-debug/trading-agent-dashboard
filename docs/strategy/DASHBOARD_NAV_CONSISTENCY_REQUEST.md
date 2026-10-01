# Dashboard navigation consistency request - the same header and side bar on every page

Prepared 2026-10-01 by worker `strategy` (`strategy-advisory-001`) for the coordinator's dashboard lane. The user's
instruction, verbatim: *"okay well queue up the next work for the coordinator to add to the dashboard and make sure all
pages across the dashboard have the same header and side bar menu."* Advice only: nothing here is adopted, no page is
changed by this file, and no claim of completion is made.

## 1. What is asked

Two things in one line:

1. **Queue the next dashboard work.** The items already waiting (the tabbed gold page release E1-E5 in
   `GOLD_TABS_BUILD_BRIEF.md`, and the movement-screen measurement) stay as they are; this asks for the *next* dashboard
   item to be put on the coordinator's queue, and the next item is the second sentence.
2. **Make every page share the same header and the same side-bar menu.** This is a consistency requirement over the whole
   served site, not a new feature. Today the header exists on one page out of eight and the rail on one page out of eight.

## 2. The site, and every page on it, measured

The served site is `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`, published from `origin/main`
(GitHub Pages; `.nojekyll` sits at the root). Measured read-only from git objects at `origin/main` `1f82c55`, not from the
working tree, because the two differ:

| Live page | Bytes (stored blob) | `header.topbar` | `aside.side-rail` | Links `styles.css` | Own `<style>` |
| --- | --- | --- | --- | --- | --- |
| `index.html` | 18,901 | yes | yes (11 refs) | yes | no |
| `dashboard-northstar.html` | 5,002 | no | no | yes | no |
| `standing-dashboard.html` | 8,957 | no | no | yes | no |
| `gold-direction-scorecard.html` | 143,102 | no | no | no | yes |
| `gold-backtesting.html` | 292,270 | no | no | no | yes |
| `gold-backtest-outcomes.html` | 19,186 | no | no | no | yes |
| `gold-factor-wip.html` | 21,281 | no | no | no | yes |
| `backtest-flow.html` | 18,402 | no | no | no | yes |

`gold.html` does not exist on `origin/main` yet; the pending release adds it as a ninth page.

The finding, plainly: **the header and the rail are on `index.html` and nowhere else.** The other seven pages each carry
their own `<header>` with a couple of inline links ("Related pages" / "Open the dashboard"), or - the draft page - no
header element at all. Six of the eight pages do not link the shared stylesheet; the two that do (northstar, standing) use
it for their own layout and still have no topbar or rail. So "the same header" cannot currently be said about the site.

## 3. What "the same header and side bar menu" must mean, exactly

The look is already centralised in the published `styles.css`, which carries `.topbar`, `.topbar-brand`, `.topbar-link`,
`.tab-bar`, `.side-rail`, `.side-rail-head`, `.side-rail-mark`, `.side-rail-label`, `.side-rail-group`, `.side-rail-tabs`,
`.side-rail-foot`, `.tab-button` and `.dashboard-frame`. The pages that lack the header also lack that stylesheet link, so
the work is **markup plus a stylesheet link**, not new CSS.

Two blocks must appear, identically, on every served page. Quoted as they are live on `index.html`:

**The header**, lines 14-24 of the published file:

```html
  <header class="topbar">
    <div class="topbar-brand">Asset Directional Movement Dashboard</div>
    <div class="topbar-meta">
      <a class="topbar-link" href="dashboard-northstar.html">North Star Brief</a>
      <a class="topbar-link" href="standing-dashboard.html">Standing Dashboard</a>
      <a class="topbar-link" href="gold-direction-scorecard.html">Gold Direction</a>
      <a class="topbar-link" href="backtest-flow.html">Backtest Flow</a>
      <a class="topbar-link" href="gold-factor-wip.html">Gold Factor (draft)</a>
      <span id="currentDate">Loading date...</span>
      <span id="topbarClock" class="topbar-dual-clock" role="status" aria-live="polite" title="...">UK --:-- | ET --:--</span>
    </div>
  </header>
```

**The rail**, lines 31-57 of the published file: `<aside class="side-rail">` with a head (`ADM` / "Control Room"), a
grouped `<nav class="tab-bar side-rail-tabs">` (groups "Operate", "Live", "Evidence", "System") and a foot ("Published
dashboard").

"Same" is defined as something a guard can hold: the same brand string; the same topbar entry labels in the same order;
the same rail group labels in the same order; the same rail entry labels in the same order; the same head mark, head
label and foot string. The one deliberate variation is the topbar's gold entry set, which the pending release reduces
from three gold entries to one (`gold.html`), and the draft label, which the release moves onto the tab and the page
banner.

## 4. Why it is not a copy-paste - the couplings, each measured

**4.1 The rail entries are buttons, not links.** On `index.html` each rail entry is
`<button class="tab-button" data-tab="...">` and `script.js` switches the dashboard's views when one is clicked. A
standalone page has no `script.js` and no such views, so the same-looking rail must degrade to real anchors -
`<a class="tab-button" href="index.html#gold">` and so on - or the entries do nothing. "Same rail" off the dashboard
honestly means "same labels, same order, same look, links instead of buttons".

**4.2 The draft page is deliberately self-contained, and its guard enforces it.**
`backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` line 44 asserts the `script, link, img, iframe` count is
exactly 0: "a self-contained page loads no script, stylesheet, image or frame". So putting a shared `nav.js <script>` or a
`styles.css <link>` on that page **fails its own guard**. Whatever route is chosen, that page's header and rail must be
inline markup, or its guard must be revised deliberately and named in the change - not silently.

**4.3 Four pages are generated.** The scorecard, the evidence page and the outcomes page come from
`backtester/templates/gold-direction-scorecard.html`, `gold-research.html` and `gold-outcomes.html` through their
builders. Those templates and builders live in the working tree, not on the published bar. Editing the served `.html`
directly would be overwritten by the next build, so the change must go into the template (and, where the nav is composed
there, the builder).

**4.4 The theme split is real.** Seven live pages are dark (navy); `gold-factor-wip.html` is a light paper theme by
design. Dropping the dark topbar onto the light page will show a seam. The lane should decide which it is - carry the dark
bar as the site's header on every page including the light one, or give the draft page a light variant of the same bar -
and say so; this file does not decide it.

**4.5 The existing hop guards read the "link back" on the gold pages.**
`gold_direction_dashboard_link.browser.test.js` line 22 asserts a visible `a[href="index.html"]`; the outcomes and draft
guards assert the topbar entry and the page's own markers. If the bespoke headers are replaced by the shared bar, the
"link back" moves into the bar, so those assertions must be re-pointed at the bar (and at the rail's `Gold` entry) rather
than assumed to still pass.

## 5. Routes, and the recommendation

- **N1 (recommended) - one canonical fragment, injected as bytes at build time.** Write the header and rail once, in one
  place (a small partial, or a builder such as `backtester/scripts/build_shared_nav.js`), and have the templates/builders
  and the four hand-written pages inject that exact bytes into each served page. No runtime script and no extra stylesheet
  link on the draft page, so every page stays standalone and the draft guard stays green. Add one guard that every served
  page contains the same fingerprint.
- **N2 - a shared `nav.js` plus a `styles.css` link on every page.** Smallest to write, but it breaks the draft page's
  self-containment guard and its "stands alone" property, and adds a script to pages that today have none. Not
  recommended as the default; acceptable only with the guard revision made explicit.
- **N3 - hand-paste the same block into each page.** Fast and needs no tooling, but eight or nine copies drift, and the
  four generated pages would lose it on the next build unless the templates are also edited - at which point it is N1 for
  those pages anyway. Acceptable only with a byte-fingerprint guard on every served page.

Recommendation: **N1 for the generated pages** (edit the templates/builders) and **N1-or-N3 for the four hand-written
pages** (`dashboard-northstar.html`, `standing-dashboard.html`, `backtest-flow.html`, `gold-factor-wip.html`), with the
rail degraded to anchors (4.1) and one fingerprint guard across all served pages.

## 6. The fingerprint a reviewer compares

The acceptance object is a fingerprint, not a screenshot: the brand string; the ordered topbar entry labels and hrefs;
the ordered rail group labels; the ordered rail entry labels; the head mark, head label and foot string. Two pages match
when the fingerprint matches. The one known variation is the gold entry set, which becomes a single `gold.html` entry
when the pending release ships.

## 7. Acceptance checks

1. **One new browser test over every served page**: exactly one `.topbar` and one `.side-rail` per page; the brand string
   matches; the topbar entries match the fingerprint; the rail groups and entries match the fingerprint; every rail entry
   is a link whose target file exists (no dead `href`).
2. **The draft page's self-containment test still passes unchanged** - or its revision is named in the change (4.2).
3. **By hand on the published copy**: open all eight pages (nine with `gold.html`) and confirm the same header and the
   same rail; from a standalone page, click a rail entry and confirm it lands on the dashboard.
4. `node scripts/test-local.js browser` (the whole browser set) green.

## 8. Boundaries

- No measured number, generator output, data artifact or gold page figure, banner or as-of line changes.
- No runtime script and no new stylesheet link on the draft page unless its guard is revised in the same change (4.2).
- Header and rail text identical across pages; no per-page variants of the labels, groups or order.
- This worker writes only `docs/strategy/`; the pages, `styles.css`, `script.js`, the templates, the builders and the
  guards are the coordinator's dashboard lane.

## 9. Sequencing against the pending `gold.html` release

The pending E1-E5 release adds a ninth page and reduces the topbar's gold entries from three to one, which changes the
fingerprint. Two clean orders:

- **Release first, then nav:** the fingerprint already includes the single `gold.html` entry, and the nav change brings
  `gold.html` - which today carries its own bespoke header and no rail - into line with the rest in one pass. Simplest.
- **Nav first, then release:** the shell must ship already carrying the shared header and rail, so the candidate needs a
  revision 3 before E1, and the fingerprint's gold entry is set inside the nav change.

Either order is fine; doing both in one change is cleanest. What is not fine is the release shipping `gold.html` with its
own bespoke header while the other seven pages look different - that is exactly the inconsistency the user asked to
remove. Section 9 of `GOLD_TABS_BUILD_BRIEF.md` records this coupling.

## 10. Rollback

Revert the pages and the templates. The change adds markup and (for six pages) a stylesheet link and changes no number, so
a revert has no data consequence and no old address stops working.

## 11. Measured facts behind this request (provenance)

- Served site and publisher: `README.md` line 8 and `docs/CURRENT_STATE.md` line 188 name the GitHub Pages URL;
  `.nojekyll` sits at the root of `origin/main`.
- Page sizes and marker counts: read from `origin/main` blobs at `1f82c55` with `git cat-file -s` / `git show` on
  2026-10-01 (table in section 2).
- Shared style classes present in `origin/main:styles.css`: `.topbar*`, `.tab-bar`, `.side-rail*`, `.tab-button`,
  `.dashboard-frame`.
- Self-containment guard: `backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` line 44.
- Hop guard pattern: `backtester/tests/gold_direction_dashboard_link.browser.test.js` line 14 and line 22.
- Templates and builders for the generated gold pages (`backtester/templates/*`) live in the working tree, not on
  `origin/main`.
