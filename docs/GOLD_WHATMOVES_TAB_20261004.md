# What moves gold as the Gold page's first tab - one framed view added, no number touched

Date: 2026-10-04. Branch: `release/gold-whatmoves-tab-20261004`, cut from `origin/main` at `0a64ec5`.
Order: the user's word - the page published on 2026-10-04, `what-moves-gold.html`, was to open the gold page as
its first tab, on the strip `gold.html` already ran.

## What changed

`gold.html` 34,423 -> 36,310 bytes (+1,887, CRLF kept, sha256 `B0753DC4CB3C1943CEBA3A2DD237DF53D3259753A6B494B9FBA2136416908BB2`):

- The strip gains a first tab, `#tab-whatmoves`, labelled `What moves gold`, with
  `aria-controls="panel-whatmoves"` and `aria-selected="true"`. `#tab-start` keeps its id, its label and its
  panel, and only gives up the `aria-selected="true"` it used to hold.
- The panels gain `#panel-whatmoves` (`class="goldtabs-panel is-open"`), holding one short note and the frame
  `<iframe id="frame-whatmoves" title="What moves the gold price" src="what-moves-gold.html" loading="lazy">`.
  `#panel-start` keeps everything it had and only gives up `is-open`.
- The strip's order array becomes `['whatmoves', 'start', 'direction', 'movement', 'factor', 'archive']`, and the
  fallback for a hash the strip does not name changes from the literal `'start'` to `order[0]`, so a reader
  arriving with no hash, or with a stale one, lands on What moves gold. `#start` still opens Start here, the
  rail's gold entry still opens Direction, and the two census hashes still open Archive and scroll to the page
  they name.
- The description meta, the page's head comment, the header sentence and the foot line ("The four framed pages")
  were brought up to six views and five framed pages.

No other file changed: `what-moves-gold.html` is untouched at 26,395 bytes and sha256
`9C74807D6B58655C7F6225E0892952A5CC4B812930E48BA48CDA79F54E001D23`, the bar and rail block is byte-identical to
`backtester/partials/shared_nav.html`, `styles.css` is untouched, and no CSS rule was needed because the framed
panel's height already comes from the class-scoped rule
`.goldtabs-panel iframe{display:block;width:100%;height:calc(100vh - 150px);min-height:520px;border:0;background:#fff}`.

## The two guards that pin the strip

- `backtester/tests/gold_view_tidy.browser.test.js` 13,357 -> 14,691 (+1,334, sha256
  `5E3AC5FF02BC1ABDB89EB12E213C3F02992984C3D01A5BA711D037BEADB27117`): `VIEWS`, `LABELS` and `FRAMES` carry the
  six views and the five pages in document order, the landing checks move to What moves gold while `#start` keeps
  its own, `what-moves-gold.html` joins `FRAMED_MARKERS` with the three lines the page declares (`declared
  expectations`, `no usable direction`, `noise floor`), and its layout test now also proves the frame a reader
  lands on renders. 7/7 green.
- `backtester/tests/site_nav_consistency.browser.test.js` 27,340 -> 27,481 (+141, sha256
  `89AE935446632853E76A235597718465788CD7DCE75078E076536CD0CBA25119`): the strip's six ids and the five framed
  pages, and the bar's no-hash gold entry now waits for `#tab-whatmoves` / `#panel-whatmoves` rather than for
  Start here; three comments that named the old landing view were corrected. 5/5 green.

The first pass of the edit script missed that last landing assertion, and the navigation guard failed on it with a
30-second `waitForFunction` timeout - which is that guard doing its job, because it is the one place that pinned
the landing view in a browser rather than in the source. The script was completed with that pair, and re-run
against a pristine `0a64ec5` worktree: it reproduces all three files byte for byte (the three sha256 values above
match the committed files exactly).

## Evidence

- Both page guards run green from `.local/gold-whatmoves-tab-release` against the worktree's own files, with no
  npm runner: `node backtester/tests/gold_view_tidy.browser.test.js` 7/7 (2.1s) and
  `node backtester/tests/site_nav_consistency.browser.test.js` 5/5 (15.1s).
- Neighbouring guards on the same tree, all exit 0: `tests/live_trading_dashboard.browser.test.js`,
  `tests/backtesting_development_release.browser.test.js`, `tests/validate_architecture_map.test.js`,
  `tests/dashboard_writer_selection.test.js` and `tests/refresh_progress.browser.test.js`.
- The layout assertions cover the new view at every width the other page guards check, with at most 1px of
  sideways slack, so framing the published page did not widen the gold page.
- The edit script (`.local/tmp/apply-gold-whatmoves-tab.js`, ignored) prints a byte delta per file, refuses to
  write unless every anchor matches exactly once, and keeps each file's own line ending.

## What was not done

- Nothing on `what-moves-gold.html` was copied, rewritten, re-measured or re-styled: it is only framed, it still
  stands alone at its own address, and it is still reached by the bar's own entry on every page.
- No figure was added or recalculated, no rail or bar entry changed and no page count changed. The frame is
  `loading="lazy"`, so the gold page does not pay for the new view until a reader opens or reaches it.
- Publication is a single fast-forward push of this branch onto `origin/main`. A local export is not proof of
  live deployment, and the live page is to be re-read after the push.
