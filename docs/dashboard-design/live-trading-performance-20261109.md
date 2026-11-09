# Live Trading view: reading order and an FTMO 1 performance panel (2026-11-09, published)

Owner's ask, in his words: move the four instrument cards below Closed Trades, put an "FTMO 1 Performance" panel
above Open Positions with three tabs (Weekday default, Strategy, Asset), make the figures traceable, keep it
compact, preview at desktop and phone widths against real FTMO 1 data, reconcile every tab to Closed Trades, and
flag any limit in the history or in strategy attribution. Publishing is a separate step after his review.

## What the view is made of

`index.html` carries one empty `<section id="liveTradingPanel">`, and `renderLiveTrading(data)` in `script.js`
fills it in this order: freshness banner, accounts strip, account chips, chart shell, L2L rule panel, the four
instrument cards, open positions, closed trades, provenance. Everything on it is drawn from
`data/live-trading.json`, which is FTMO account 1's own snapshot (login `***614`, FTMO-Server, USD) - the same
file `data/live-trading-trader.ftmo-1.json` reports for the `ftmo-1` lane, so "FTMO 1" is not a new source, it is
this file.

The closed trades block carries what the panel needs and nothing it does not: `net_profit` (profit + commission +
swap, i.e. after recorded costs), `closed.time_utc`, `dashboard_asset`, `symbol`, `magic`, `comment`. The comment
is the recorded strategy identifier (`l2l-rule-eur`, `l2l-rule-gold`, `l2l-rule-nq`, `l2l-rule-btc`); `magic` is
one lane-wide constant (20261004) and cannot separate strategies.

## What changed

- `script.js`: `liveTradingPerformancePanel(data)` renders the panel, and `renderLiveTrading` now emits it between
  the rule panel and Open positions, with the four instrument card grid moved to the very end (after Closed
  Trades). Tab state is held in `liveTradingPerformanceTab` (default `weekday`) so a five-minute refresh does not
  throw the reader back to Weekday; `applyLiveTradingPerformanceTab` swaps the visible table, and the existing
  panel click listener plus a new keydown listener drive it (arrow keys, Home, End, roving tabindex).
- `lib/live_trading_performance.js` (new): the arithmetic, shared by the page and the tests, exposed as the
  global `LiveTradingPerformance` and as a CommonJS module.
- `styles.css`: `.live-trading-performance*` rules in the panel's own visual language, a phone block, a sticky
  row label for the sideways-scrolling table and a hint line that only appears under 760px.
- `index.html`: the new module loads before `script.js`, both cache-busters bumped to `20261109-ftmo1-performance`
  (and to `...-dates` when the reporting dates were added).
- Tests: `tests/live_trading_performance.test.js` (8 node checks, including reconciliation against the committed
  artifact and the reporting-date label) and `tests/live_trading_performance.browser.test.js` (one browser check of
  order, tabs, blank rate, reconciliation and the date line in a rendered page).

## The reporting dates beside the title (owner's ask at publish time)

He asked for the snapshot's actual reporting dates beside the panel title, so the panel prints the window the
snapshot's own `history` block declares - `26 Oct 2026 - 09 Nov 2026 UTC · 14-day window` - on the same row as
`FTMO 1 Performance`, wrapping to its own line on a phone.

- `lib/live_trading_performance.js` gained `dayLabel(value)` and `periodLabel(period)`, so the line is produced by
  the module that summed the rows rather than typed into the panel. It uses the UTC calendar day, because UTC is
  the clock the history block states and the clock the Closed trades table prints; the London rule for weekdays is
  a separate statement, kept in the caption, so the window and the rows cannot disagree at a midnight boundary.
- A snapshot that states no window prints `Reporting period not stated by this snapshot`, never today's date.
- The exact stamps stay on the element's `title` (`2026-10-26 18:50Z → 2026-11-09 18:50Z UTC`), so shortening the
  line loses nothing; the browser test asserts both the visible dates and the tooltip.
- The `Closed trades` prefix was dropped from the line: the heading, the meta line (`Closed positions only`) and
  the caption already say it, and on a 390px phone the shorter line fits on one row instead of splitting
  `14-day window` across two.
- Drift-back guard: the browser test fails if the dates leave the heading's row, if the row stops being a wrapping
  flex row, or if the dates stop matching the window the fixture states.

### Ownership from here

The owner's decision at publish time: the live-trading lane owns the performance calculations going forward. The
arithmetic lives in `lib/live_trading_performance.js`, one file, with no dashboard-only rule inside it, so that lane
can take it over without touching the page markup; the page only renders what the module returns.

The panel deliberately does **not** use the `.live-trading-table-panel` class: the read-back and close-control
browser suites select exactly two elements with it (positions, then closed trades), and a third would have moved
their indices without failing loudly.

## The rules, fixed in the module

1. A trade sits on the day its close fell on in `Europe/London`, derived from `time_utc`. The page states the zone
   it actually got: if a runtime lacks the zone database it falls back to UTC and says so.
2. Wins, losses and breakevens are realised `net_profit` above zero, below zero and exactly zero. Breakevens stay
   in the win-rate denominator: win rate is wins over all of the row's closed trades.
3. Share is the row's trades over the account's total, so the weekday tab adds to 100% and Unknown strategy stays
   in the totals.
4. Strategy is the comment when it matches `l2l-rule-*`; anything else recorded there is shown as
   `Unknown strategy` and named in the panel's caption rather than invented into a rule.
5. A zero-trade weekday draws `0` and an empty win-rate cell, not `0.0%`, which is a day that lost everything.

## The figures in the preview (snapshot 2026-11-09T18:50Z, 14-day window)

38 closed trades, net `+167.11 USD`, win rate `28.9%` (11 wins, 27 losses, 0 breakevens).

- Weekday: Mon 5 / +19.57, Tue 4 / +21.43, Wed 9 / +158.41, Thu 8 / -4.38, Fri 7 / -2.74, Sat 1 / -5.32,
  Sun 4 / -19.86.
- Strategy: `l2l-rule-eur` 16 / +5.16, `l2l-rule-btc` 10 / -8.28, `l2l-rule-nq` 6 / -2.72, `l2l-rule-gold` 5 /
  +173.01, `Unknown strategy` 1 / -0.06.
- Asset: EUR 17 / +5.10, BTC 10 / -8.28, NQ 6 / -2.72, GOLD 5 / +173.01.
- Reconciliation: all three tabs sum to 38 trades and 16711 cents, and the Closed trades table states
  "38 closed in the last 14 days - net +167.11 USD" in the same render. Checked twice: in the node check against
  the committed artifact, and in the browser against the served page.

## Limits this window carries (and the panel says so)

- The snapshot reads a 14-day window ending at the publish time; a trade that closed before it is not in any of
  these figures, and the panel states the window beside its title.
- One of the 38 closes carries `loop-proof-close`, which names no rule: it sits under Unknown strategy, is named
  in the caption, and remains in the totals (EUR therefore shows 17 while `l2l-rule-eur` shows 16).
- There are no breakeven trades in this window, so the Breakeven column reads 0 on every row: the classification
  path is exercised by tests, not by today's data.
- Strategy attribution is only as good as the comment the lane stamps at entry. A future rule that does not write
  `l2l-rule-*` will appear as Unknown strategy rather than disappear.
- Net is the terminal's own `net_profit` in USD; the panel does not re-derive costs, and it does not convert.

## Preview and suite state, 2026-11-09

Desktop (1440 wide) and phone (390 wide) screenshots were taken against the served page with the real snapshot:
`tmp/perf-desktop-weekday.png`, `-strategy.png`, `-asset.png`, `perf-phone-weekday.png`, `perf-phone-strategy.png`;
the reconciled text is in `tmp/perf-preview.json`. At phone width the table scrolls sideways with the row label
stuck to the left edge and a one-line hint above the caption, because eight columns do not fit 390px.

Existing checks still green after the change: `tests/live_trading_feed.test.js` 55/55,
`tests/live_trading_readback.browser.test.js` and `tests/live_trading_close_control.browser.test.js` 8/8.

Full local suite on this tree: **unit 694 files-worth of checks, 690 pass, 0 fail, 4 skipped**; browser 93 checks,
90 pass, 3 fail. The three browser failures are not from this change and were measured against a pristine
`git archive origin/main` unpacked in `%TEMP%`:

- `live_trading_levels_visibility.browser.test.js` "NQ draws 0 marked lines below its bars" - fails on the
  pristine archive too (the published ladder and NQ's price have drifted apart). Data drift, not layout.
- `research_library.browser.test.js` "all three stages must read Uploaded from the private store" - fails on the
  pristine archive too, same file, same exit.
- `refresh_progress.browser.test.js` - intermittent here: 3 failures in one full run, 0 on the immediate rerun
  (26/26), and the pristine archive also passed it 26/26 in isolation. Timing-sensitive under load, not
  live-trading code.

`tests/live_trading_performance.browser.test.js` (the new one) passes in the full run and alone.

## Lane note (for me, not for the reply)

The card move is pure design. The panel is a renderer addition: it computes new figures from the published
snapshot in `script.js`, which the live-trading lane owns and edits for the same section. Nothing outside this
checkout was read or written, no data file changed, no existing number moved, and the figures are derived only
from the block the Closed trades table already prints. If the owner wants this to be a permanent reporting
surface with its own guarantees, it belongs to that lane as a documented rule rather than to a design commit.
Publishing stays a separate, single-purpose commit on his go-ahead.

## Published, and what the live site serves

Owner's go-ahead came on 2026-11-09 with one addition (the reporting dates beside the title) and one decision
(the live-trading lane owns the performance calculations from here). Published as one commit,
`7caae161` "live-trading: read FTMO 1's performance above the individual trades", rebased onto the live tip
`8ecb08fb` and fast-forwarded to `main` without force; the live lane kept publishing data files around it.

Two things went wrong on the way and were fixed before the push:

- The first browser run after the change failed `backtesting_development_release.browser.test.js` ("Backtest
  Engine" button never appeared) and it reproduced on an archive of my own commit, not on a pristine
  `origin/main` archive. Cause: I had rewritten `index.html` through PowerShell, which put a UTF-8 BOM in front
  of `<!DOCTYPE html>`; a server that sends no content type (as that test's server does not) then renders the
  page as plain text. The BOM was stripped, `index.html` is now a 3-line diff against `main`, and the test
  passes. Worth remembering: a BOM is invisible in review and breaks sniffing.
- `refresh_progress.browser.test.js` threw 2 failures in one full run; 26/26 in isolation on both my commit and
  a pristine archive. Load-sensitive, as it was in the earlier run.

### Served, read back over HTTPS at 2026-11-09T21:33Z (snapshot 2026-11-09T21:30Z)

| page | bytes | git blob | sha256 (16) |
| --- | --- | --- | --- |
| `index.html` | 30,151 | `cdcb16713e37` | `0e3abdeaf23a0866` |
| `styles.css` | 277,290 | `c7811491fa44` | `bba07f5247702ac8` |
| `script.js` | 1,063,764 | `8173bac71a37` | `063980a191a01ddc` |
| `lib/live_trading_performance.js` | 10,724 | `920943ee7752` | `a796732e5dfd8b01` |

Each live blob equals the blob on `main` at that moment, so the site is serving the pushed bytes and not an
older build. (The page grew by one `<script>` and a longer cache-buster; the later backtester-page commit from
another lane is why the live `index.html` is not byte-identical to the file I pushed.)

Live read, headless, at 1440x900 and 390x844 on `#live-trading`:

- Section order in `#liveTradingPanel`: chart, rule panel, performance panel (index 5), Open positions (6),
  Closed trades (7), instrument cards (8); exactly two `.live-trading-table-panel` elements, so the read-back
  and close-control suites still find their tables.
- Dates beside the title: `26 Oct 2026 - 09 Nov 2026 UTC · 14-day window`, same row as the heading, tooltip
  `2026-10-26 21:30Z → 2026-11-09 21:30Z UTC` for the live snapshot; no horizontal overflow at 390px.
- Reconciliation against the live Closed trades line `38 closed in the last 14 days · net +167.11 USD`: totals
  `+167.11 USD / 28.9% / 38`, and every tab sums to 38 trades and 16,711 cents (weekday, strategy, asset).

The drift-back guard lives in `tests/live_trading_performance.browser.test.js`: it fails if the dates leave the
heading's row, if that row stops being a wrapping flex row, if the tooltip loses the exact stamps, if the panel
drops below Open positions, if the instrument cards climb back above Closed trades, or if any tab stops adding
up to the Closed trades figures.


