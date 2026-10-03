# Gold on one page: show direction, full L2L and half L2L together - and fix the fault first

Prepared 2026-10-03 by worker `strategy` (`strategy-advisory-001`), on the user's instruction this turn. Advisory request
to the coordinator and its dashboard lane under the single-writer rule, not an applied change: this worker writes only
`docs/strategy/` in its own worktree, holds no credentials for this assignment, and cannot publish a page or apply a
production patch. Nothing here re-derives a number, publishes anything, touches the collector, or reads the window sealed
until `2027-03-25T15:00:00Z`.

## 1. What the user said, and how it is read

Verbatim, this turn: *"Yes this thread was interrupted we want to see and analyse all the gold data as per above."* /
*"fix the fault."* / *"The current display of data isnt enough we need it tidying up and simplified preferrably all on one
page with tabs."* / *"what choices again?"* And on the earlier question set: *"Yes start here, make it very visually easy to
find where this data is and how to interpret it. Remeber we want to see direction, l2l and 0.5l2l data always"*, then
"yes", "yes", *"why do we need a forward record this is just analysing histrotical data to find patterns/correlations"*,
"yes", "not sure yet". The link he asked for is in section 2.

| # | What the answer settles | Where it lands |
| --- | --- | --- |
| This turn 1 | The gold work is wanted in full, not parked | The movement measurement (R1 in `-040`) is to be opened |
| This turn 2 | "fix the fault" | The Gold collector input fix is first, ahead of the display work |
| This turn 3 | The tabbed page as it stands is not enough; tidy and simplify it, one page | Section 4, the order |
| This turn 4 | The three navigation choices need restating | Section 6, restated in plain words |
| Earlier 1 | Yes - start here, make the data easy to find and to read, and always show direction with L2L and 0.5 L2L | Section 4, the "always together" rule |
| Earlier 2, 3, 5 | Yes to the presentation routes and to applying the collector patch | Sections 4 and 5 |
| Earlier 4 | The forward record is questioned: this is pattern-finding on history | R4 withdrawn, section 5, with the one consequence stated |
| Earlier 6 | "not sure yet" on re-deriving the four day-size numbers | Default stands: they stay as the marked 2026-09-28 measurement |

## 2. Where the data is, live, measured today

Measured read-only over HTTPS today, not remembered - every page answers **HTTP 200**:

| Address | Bytes | Title |
| --- | --- | --- |
| `https://kevincreedycars-debug.github.io/trading-agent-dashboard/` | 18,775 | Asset Directional Movement Dashboard |
| `.../gold.html` | 5,733 | **Gold - one page with tabs** |
| `.../gold-direction-scorecard.html` | 143,102 | Gold factor direction scorecard - Research only |
| `.../gold-backtesting.html` | 292,270 | Gold Backtesting - Evidence Review |
| `.../gold-backtest-outcomes.html` | 19,186 | Gold 28-Factor Outcomes - Research only |
| `.../gold-factor-wip.html` | 24,398 | Gold factor work in progress (draft) |

The top bar on the live dashboard carries exactly one gold entry - `gold.html`, labelled **Gold** - alongside "North Star
Brief", "Standing Dashboard" and "Backtest Flow"; there is no longer a scattered Gold Backtest / Gold Direction / Gold
Factor set of links. `gold.html` is the tabbed page built from `GOLD_PAGE_TABS_MERGE_REQUEST.md` route A: one tab strip
over four frames, in this order - Direction (`gold-direction-scorecard.html`), Backtest evidence
(`gold-backtesting.html`), 28-factor outcomes (`gold-backtest-outcomes.html`), Factor tables (draft)
(`gold-factor-wip.html`) - with its own words "Everything the gold work holds, on one page. Each tab is the page it always
was, with its own numbers and its own warnings; nothing here is recalculated." The live draft tab is the refreshed
revision, reading **50 of 50** answered, "As of 30 September 2026 - advisory work".

**So the one-page-with-tabs half of the request is already live.** What the user is missing is inside it, and that is the
point of this filing: two of the four tabs are archive censuses whose own verdict is that the archive cannot support
choosing from it, the direction tab is 25 of 25 `no_information` at a 60% bar, and no tab shows the direction read
together with the two movement ranges the user named. The shell is right; the content is not yet the data he asked for.

## 3. What the user is owed, in his own units

All measured, all on spent intervals, already re-verified today in `-040` and its addendum (four day-size figures are the
lane's own 2026-09-28 measurement of the same 570 sessions, and are marked as such):

- **The three sizes, in plain words:** a usual day travels 1.4472% of the session open; the full L2L range is 0.7236%; half
  of it is 0.3618%; the median close-to-close move is 0.6701%.
- **Movement:** 97.89% of days clear half L2L either way and 75.26% clear full L2L, so "does it move" is nearly always
  yes; the full-range day is one-sided 51.52% up-only / 40.09% down-only / 8.39% both; 55.20% of day-one floor-reachers are
  still on side at five sessions.
- **Direction:** the call names the moved side 45.63% of one-sided days against 61.13% for always saying "up"; the call's
  own direction reaches half L2L on 64.04% of days and full L2L on 38.42%; at the close it is right 46.32% while gold
  closed up 56.84% of the same days, and the loss sits in the bearish half - 300 bearish calls 40.00%, 270 bullish 53.33%.
- **The unused data that makes R1 cheap:** the accepted individual-variable report (95,842,994 bytes) already stores
  147,465 each of `median`, `q1` and `q3` per state and horizon plus 148,920 `exact_zero` fields, and no accepted cut has
  ever used them.
- **The fault:** the live Gold collector still reads 25 unordered history rows; the offline-validated patch
  `backtester/drafts/gold_collector_history_query_patch.json` has been unchanged since 2026-09-09;
  `docs/GOLD_HISTORY_PATCH_VALIDATION.md` still reads "installed n8n validation and production application remain
  outstanding"; `docs/CURRENT_STATE.md` still lists the 25-row read as a live production input defect.

## 4. The order: one page, tabs, and the three reads always together

**The rule the user set, stated once so a builder cannot miss it:** wherever a rate is printed on the gold page, the
direction read, the full-L2L movement share and the half-L2L movement share are printed together, each with its own
sample count and its own one-line plain explanation. Nothing on the page shows a direction number without the two ranges
beside it, and nothing shows a range share without the direction read beside it.

Recommended tab set (the dashboard lane owns exact wording and order; this is the requirement, not a template):

1. **Start here** (new, deliberately small). Six lines: what the page is; the as-of date; the three sizes in plain words
   with their numbers; where the numbers come from, in plain words; and what the page is not (not a signal, not a
   forecast, not a trading result).
2. **Direction.** The calls scoreboard (route R2 of `-040`), which is presentation of numbers already measured: up calls
   against down calls by year, at the close and at both ranges, with the two honest headlines the user has not yet seen in
   one place - 46.32% right at the close against gold's own 56.84% up-days, and the bearish half at 40.00% against the
   bullish half's 53.33%.
3. **Movement - L2L and half L2L.** This is the user's own first stage, and the tab the tidy-up must create. When the
   measurement lane runs (R1) it carries the per-factor movement table: every declared state, at half L2L and full L2L, on
   the 1/2/3/5-session ladder, nothing dropped, every row with its own day count. Until that run exists, the tab carries
   the base rates above and one plain line saying the per-factor columns arrive with that measurement - not a blank tab,
   and not a promise dressed as a number.
4. **Factor tables (draft).** Unchanged, banner, answered count, as-of line and "what this page is not" all intact.
5. **Archive census.** The outcomes census and the evidence page, kept reachable and plainly labelled as being about the
   archive, not about gold. Two census tabs leading the page is a large part of why the user reads the gold work as
   useless; demoting them is the "tidy and simplify" he asked for, and deleting nothing keeps every old address, bookmark
   and guard working.

**Not negotiable, from the existing briefs:** no number is re-derived, re-cut or re-rendered; the four framed pages and
their generators, templates and data artifacts are not edited for this change; the old addresses keep working; the draft
tab's honesty mechanism survives; and the language stays descriptive - no edge, signal, forecast or trading-result claim
anywhere.

**Coupling, so two writers do not fight:** `gold.html` today carries its own bespoke header and no side rail, which is the
inconsistency the user asked to remove on 2026-10-01. The nav tidy
(`docs/strategy/COORDINATOR_NAV_TIDY_HANDOVER_20261003.md`, `docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md`) and this
content change both edit that page, and Task 0 (the served bar versus the tree's bar) still has to land before either, or
the same three guards get re-pointed twice.

## 5. The sequencing the user chose, and the one route he withdrew

1. **Fix the fault first.** Apply the validated Gold history patch and close the 25-row unordered read. This is a
   production change, it is the coordinator's to sequence, and the user's word for it is this turn's "fix the fault". It
   changes no analysis, but every future observation, entry price and evaluation inherits the defect until it is done -
   so it precedes the display work rather than following it. Validation status must be read from
   `docs/GOLD_HISTORY_PATCH_VALIDATION.md` at the time of the change; nothing in this filing asserts that the installed
   n8n validation has passed, because it has not.
2. **Build the tidied one-page tabbed view** of section 4, on the dashboard lane, in the same pass as the navigation work
   where that is possible.
3. **Open the movement measurement** (R1): the provisional lane `gold-declared-band-measurement-026` needs a register edit
   and the user's go-ahead, which is this turn's answer 1. It is the only thing that can put real per-factor numbers in the
   Movement tab, and it is answerable from the 147,465 stored spread fields with no new run.
4. **Fold the calls scoreboard** (R2) into the Direction tab; every number in it is already measured.
5. **The forward record (R4) is withdrawn**, at the user's instruction. His reasoning is sound for the use he has in mind:
   he wants to analyse historical data for patterns and correlations, and a forward record answers a different question -
   whether a pattern still holds after it has been found. That question matters because every figure on these tabs is
   chosen by looking at the same history it is measured on; a pattern that looks good here is fitted to this archive. A
   forward record would be the only later test. With it dropped, the honest consequence is written on the page instead:
   the numbers describe the past, nothing tests them afterwards, and no row on them should be read as an edge. Ten rules
   are no longer declared ahead of looking, so no later filing may quote the ten base rates as a pre-declared test.

**Default that stands unasked:** the four day-size figures stay as the lane's marked 2026-09-28 measurement rather than
being re-derived with one added median print, since the user answered "not sure yet" and the stated default holds. It is a
presentation-accuracy point only - the scan that re-runs today prints the movement counts and the ladder, not the size
medians - and it can be closed later at the cost of one added print.

## 6. What is asked of the coordinator, and what is still the user's

Asked of the coordinator, and nothing beyond it:

1. **Sequence the fault fix first** as the production priority on the Gold input, using the user's word recorded here.
2. **Put the gold-view tidy on the dashboard lane** with section 4 as the brief, folded in with the navigation work rather
   than run against it, so the page is edited once.
3. **Open the movement measurement**: a register edit for `gold-declared-band-measurement-026` and a decision on whether
   that lane is `gold-research` or another one. An advisory worker cannot touch the register.
4. **Record that R4 is withdrawn** so no later review expects a forward record, a declared rule set or a review date.

Still the user's, and restated in plain words here because he asked for them again:

1. On the eight pages other than the dashboard, should the small menu actually switch the dashboard to the right view
   (this needs about ten lines of code added, which the gold page already does for its own tabs), or should it only open
   the dashboard's front view? Recommended: make it switch.
2. On those same pages, should the date and clock be left off (recommended, because no other page loads the code that
   fills them, so a copy would sit on "Loading date..." forever), or should a fixed date line be baked in by the builder?
3. Should the dashboard lane start the shared header and side-menu tidy-up now? The release it was queued behind - the
   gold page - is live, so nothing is waiting on it any more. Recommended: yes, Task 0 first.

## 7. What this filing does not do

- It changes no page, stylesheet, script, template, generator, guard, data artifact, number, register entry, assignment,
  lock, controller or bridge file. It publishes, refreshes and triggers nothing.
- It applies no patch, and it does not claim the collector patch is validated: it records the fix as outstanding and the
  validation status as unverified at the time of writing.
- It asserts no edge, no accuracy, no prediction, no timing, no profitability and no deployment; nothing here is a
  trading result, and the sealed prospective window stays sealed until `2027-03-25T15:00:00Z`.
- It does not re-open the questions the user has already settled, and it does not present the four routes as authorised by
  being written down. Advice is a proposal until the coordinator adopts it.

## 8. Provenance

Measured this turn, 2026-10-03, read-only:

- Live pages fetched over HTTPS with `Invoke-WebRequest` (status, byte length and `<title>` recorded in section 2), plus
  the anchors of the live `index.html` and the four `<iframe>` sources and titles of the live `gold.html`.
- The live draft tab's answered count and as-of line read from the fetched page text ("50 of 50", "As of 30 September 2026").
- All figures in section 3 are carried from `-040` and its accepted addendum, where they were re-verified today;
  `docs/strategy/GOLD_DATA_USEFULNESS_READ_20261003.md` is the full record, including the reproduction commands
  (`tmp/l2l-scan8-20260929.js`, exit 0, both internal assertions PASS; `tmp/count-report-fields.js`).
- Collector-fault status read from `docs/GOLD_HISTORY_PATCH_VALIDATION.md` and `docs/CURRENT_STATE.md`, and the patch file's
  own unchanged state from `backtester/drafts/gold_collector_history_query_patch.json`.
- The tab set, the four framed pages and the "one bar entry" rule are the live state plus
  `docs/strategy/GOLD_PAGE_TABS_MERGE_REQUEST.md` and `docs/strategy/GOLD_TABS_BUILD_BRIEF.md`; the header/rail coupling is
  from `docs/strategy/COORDINATOR_NAV_TIDY_HANDOVER_20261003.md` and
  `docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md`.

