# The USD Layer 1 logic dossier published, reachable from the bar and the rail

Date: 2026-10-09. Branch: `release/usd-logic-dossier-20261009`, cut from `origin/main` at `5cfe742` (`origin/main`
moved to `7d242c6` and then `c441ba4` by live-trading snapshots, which this branch does not touch). Released to
production: rebased onto `c441ba4` and pushed as `66e0b0b` (`c441ba4..66e0b0b`, fast-forward) to `origin/main`, so
GitHub Pages serves this tree.

## What changed

`usd-layer1-logic.html` is the reading copy of `docs/analysis-engine/USD_LAYER1_LOGIC.md`: the dossier itself rather
than a summary of it - 11 sections rendered from 713 source lines, with the tables and code blocks the document
carries - plus a plain-text download of the same text (`docs/analysis-engine/USD_LAYER1_LOGIC.md.txt`, 48,307 bytes).
It was published with no route to it on the dashboard, and with a shared navigation block that had no matching
entry, so a reader could only arrive by typing the URL. This release adds the entry, and the one thing the generated
page needed so the entry stays:

```html
<a class="topbar-link" href="usd-layer1-logic.html" target="_top">USD Logic Dossier</a>
<a class="side-rail-link" href="usd-layer1-logic.html" target="_top">USD Logic Dossier</a>
```

The block is the only source, so both entries landed on all thirteen published pages in one write:
`node backtester/scripts/build_shared_nav.js --write` placed the block into the dossier page and refreshed the other
twelve, and `--check` then reads `13 pages, 17 rail entries, 3 outbound, 0 change(s)`.

## Facts that make this entry different from the seventeen tabs

- The entry is a link with **no `data-tab`**, written identically in both rail variants, so the dashboard's tab
  binder never sees it and no page's view table changes.
- The rail still holds the same **seventeen** dashboard views in the same four groups; the outbound entries sit
  under them, after `Architecture`, and there are now **three** of them: `Call Map`, `USD Call Map` and
  `USD Logic Dossier`.
- The label is `USD Logic Dossier`, the words the USD call map's footer already uses for the same page, so both
  routes to it read alike.
- The entry is on every page including the dossier's own: the block is rendered from the partial, and only the
  partial decides what it says.

## Why the builder had to be taught to keep the block

The dossier page is generated, not hand-written: `backtester/scripts/build_usd_layer1_logic_page.js` renders
`docs/analysis-engine/USD_LAYER1_LOGIC.md` through `backtester/lib/markdown_document.js` into the page and its
`.md.txt` download. It rewrote the page whole, so the next run would have taken the shared navigation block back
off the published page, and the link added here would have survived exactly until someone rebuilt the dossier. The
builder now reads any `SHARED-NAV:START` .. `SHARED-NAV:END` region from the page it is about to replace, keeps it
byte for byte and splices it back in on the line after the body tag, which is where the nav builder places it. A
tree whose page carries no block - a first build anywhere - is written exactly as before, and `--check` still
compares whole bytes rather than shapes, so a hand-edited page or a hand-edited block still fails there.

The block never hides itself, because on a dashboard view it is the navigation. The dossier template's print block
therefore names the bar and the rail with both of their classes and takes them off the sheet, and gives the content
margin the rail asked for back, so the printed dossier still starts at the left edge of the paper.

## The guards

- `backtester/tests/site_nav_consistency.browser.test.js` - 5/5. `BAR_LABELS` / `BAR_HREFS` gained the eighth entry,
  `RAIL_OUTBOUND_HREFS` / `RAIL_OUTBOUND_LABELS` the third outbound pair, the `--check` report pin reads
  `13 pages, 17 rail entries, 3 outbound`, and the click-through test makes a third hop from inside `gold.html`'s
  gold-direction frame, landing on the dossier's own heading `USD Layer 1 — complete logic dossier`.
- `tests/usd_layer1_logic_page.browser.test.js` - 6/6. The page's own guard: the route in from the dashboard and the
  route back out, the page carrying the dossier's own sentences rather than a summary, the download being the
  dossier, the builder's `--check` as a second opinion, and the printed sheet.
- `backtester/tests/markdown_document.test.js` - 6/6. The renderer's own tests, unchanged by this release.
- `tests/usd_layer1_call_flow.browser.test.js` - 6/6. The USD call map's footer gained one link to the dossier
  (`usd-layer1-logic.html · the full logic dossier`); that guard already checks every footer link resolves to a file
  which ships with the page, and the check still passes.

## What was run, and what it does not prove

Green on this tree, with no npm runner on the release branch: the navigation guard 5/5, the dossier page's guard
6/6, the renderer's unit tests 6/6, the USD call map's guard 6/6, and both page generators' `--check` - the nav
builder `13 pages, 17 rail entries, 3 outbound, 0 change(s)`, the dossier builder `0 change(s) in 2 generated
file(s)` with the page at 86,940 bytes and the download at 48,307 bytes.

## The live read-back

The release is published, not just committed. Read back from the live site with `tmp/usd-logic-verify-live.cjs`, both
delivery paths returning HTTP 200 and bytes identical to the committed blobs:

- `usd-layer1-logic.html` - 86,940 bytes, sha256 `a983730e3a7e02635cad56d0dc1eb2e856f0ed097dd5d256e73eec78e48421f0`
- `index.html` - 28,217 bytes, sha256 `8c1655f62775b4d91ceb6edbebf11599be9db43bb564a2bdb049b3d93b6cbb68`
- `usd-layer1-call-flow.html` - 34,345 bytes, sha256 `2721fdecc689ba570023c0336bacfa5c86f0c394a07516b058c5731bd740a0f1`
- `docs/analysis-engine/USD_LAYER1_LOGIC.md.txt` - 48,307 bytes, sha256 `f2b2fd244cd42be2f7ca617f26139daace8b67728c756e981a5c5bd05ccfebd8`

The same bytes arrive from `raw.githubusercontent.com` (`.../main/<file>`) and from the GitHub Pages copy. On the live
dashboard a headless reader at 1440px finds exactly one bar entry and one rail entry for the dossier, beside the
seventeen `data-tab` rail views that a cross-check of the served `index.html` still counts unchanged. The bar hop, the
rail hop and the footer link on the live `usd-layer1-call-flow.html` each land on the live dossier carrying the heading
`USD Layer 1 - complete logic dossier`, 11 `section.chapter` chapters, 15 tables, its own bar and rail entries and one
download link, with zero script errors across the walk.

What that does not prove: a link on the bar is a route, not evidence. The dossier describes how the USD Layer 1 call is
made and settles the 85-versus-87 question from the code, and reaching it says nothing about whether the call is right.
No number, section, table or code block of the dossier changed here, and nothing in this release reads a warehouse, a
workflow or a live Layer 1 output.
