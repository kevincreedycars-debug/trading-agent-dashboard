# Backtesting: the native tab

Research surface only. Every figure here is read from two committed artefacts:
`data/usd-layer1-backtester/run-v1.json` (the 725-morning replay, its calls, outcomes, level provenance and the
two-day EUR/USD execution demo) and `data/usd-layer1-backtester/engine-v1.json` (the frozen 25-row book decided by
one engine, one decision and one state row per morning). Nothing on the tab calls a model, a workflow, Supabase or
the network beyond fetching those two files.

## Opening it

- Side rail â†’ Evidence â†’ **Backtesting** (`data-tab="usd-layer1-backtester"`, unchanged, so saved navigation state
  still resolves).
- Top menu â†’ **Backtesting**, which is `index.html#backtesting`.
- Deep links: `#backtesting`, `#backtesting/<date>`, `#backtesting/<test>/<market>/<date>`, for example
  `index.html#backtesting/l2l_full_5r/EURUSD/2026-11-05`. The address bar is kept in step as the reader selects.
- The standalone rules page still works: `usd-l1-decision-rules-v1.html` opens with a link into the tab.

## The verified count: 0 / 725

The strip immediately above the columns answers one question in one place: on how many of the 725 historical mornings
can we prove the intended 25-factor USD agent had every input it needed by 05:00 London and applied the final
adjudicator's logic? The answer is none, and it is the artefact's verdict rather than the tab's arithmetic.
`run-v1.json` carries a `validity_gate` whose `research_gate.accepted` is 0 and whose note is: presence, freshness, a
verified clock and the named instrument - no replayed morning passes all four rungs, so the strict gate accepts no
call and no accuracy denominator survives unqualified.

The gate's own ladder, over 725 sessions:

| Rung | Mornings passing | What it asks |
| --- | --- | --- |
| present | 618 | every required input has a value |
| fresh | 617 | inside the age its release allows |
| clocked | 0 | a receipt proves the print existed at 05:00 London |
| identified | 0 | the instrument the research names, not a declared proxy |

The intended candidate is `CONFIG_BLOCKED` with `rule_defined: false` in `run-v1.json`
(`validity_gate.intended_model`), so all 725 mornings are undefined-rule mornings for it whatever the data says; the
book that actually ran - v1.0.0's `challenger_v1`, the equal-weight null hypothesis - is quoted beside it and labelled
experimental. The strip prints six blockers, each with the dates it touches and the file that closes it:

| Reason | Mornings | Closes with |
| --- | --- | --- |
| No adjudicated rule: the candidate is `CONFIG_BLOCKED` | 725 | a frozen combined rule, then `rule_defined` in `backtester/lib/usd_layer1_backtester/model_identity.js` |
| No receipt proves the print existed at 05:00 London | 718 | receipt times archived by the 05:00 collection (`collection.js`, `automation/n8n/usd-l1-shadow-decision.workflow.json`) |
| The staged series is a declared proxy | 720 | the named gold, NAS100, EUR/USD and JPY instruments, then `same_instrument` in `model_identity.js` |
| A required input is absent | 107 | backfill of the five-day legs into `run-v1.json`'s per-morning inputs |
| Older than the gate's freshness limit | 1 | book v1.1 (`config/usd_l1_factor_rulebook_v1.json`); the frozen 4-business-day age also refuses F5 and safe-haven demand on 311 and 310 mornings |
| F8 Fed bias has no source | 725 | acquire a Fed-bias source, or record it permanently absent in the rulebook |

The rows overlap and are not additive: 725 of 725 mornings fail at least one data rung and 725 are undefined-rule
mornings, so the rows meet at 0 and must never be summed. The strip says that in the same words the gate does.

Below the blockers, each of the four tests carries its own denominator: `verified 0 / 725`, with the artefact's
experimental numbers printed beside it and marked experimental - the broker `DXY.cash` lane (current 141 of 284,
challenger_v1 91 of 209), the four markets with their matched-date corrections and spoilages, and the two-day
2026-11-05/06 EUR/USD execution demo (6 fills / 7R for 5R; 10 fills / 8R for the midpoint geometry), which sits
outside the 725 and has no engine state row.

No verified morning exists to link, so the strip says so and links the morning that comes closest instead:
`#backtesting/four_markets/EURUSD/2024-02-06`, the artefact's own worked morning - every stored input accounted for,
abstained BULLISH at band 2, and still unscorable because the rule it would be scored against is undefined. The
inputs that fail a rung are named there.

The strip's hooks are stable for the tests: `[data-bt-verify="0 / 725"]`, `[data-bt-verify-lead]`,
`[data-bt-verified-outcome]`, `[data-bt-rung]`, `[data-bt-blocker]`, `[data-bt-verified-test]`,
`[data-bt-verified-market]`, `[data-bt-verify-overlap]`, `[data-bt-verified-exemplar]` and `[data-bt-verified-blocked]`.



## What the first screen says

Above everything: the North Star, in the brief's own words, including the four tests and the £100,000 / 1% account.

Under the strip, three columns:

| Column | What it shows | Where it comes from |
| --- | --- | --- |
| Left | The 05:00 London snapshot (cutoff instant, factors readable, factors carried forward, whether a 05:00 bar is staged) and the model that actually ran: engine, book, decision and run versions | `engine-v1.json` (`morning_states`, `book_detail`, `summary`), `run-v1.json` (`sessions`) |
| Centre | The USD call: direction, conviction band, trade qualification, engine outcome, and the run totals (41 allowed / 541 blocked / 143 abstained / 62 traded) | `engine-v1.json` (`morning_states`, `fired_rule_log`, `summary`) |
| Right | The four selectable tests, each with the count it can actually stand behind | `run-v1.json` (`tests`, `coverage`, `execution_demo`) |

The four tests are (1) USD direction on the broker `DXY.cash` lane with the official ICE lane still blocked,
(2) the USD-only hypothesis applied to EUR/USD, XAU/USD, NAS100 and BTC/USD separately, (3) original L2L at 5R,
(4) half L2L at 3R.

## The map and the selected path

Three.js draws the chain snapshot â†’ decision â†’ band â†’ trade â†’ test â†’ market â†’ date. The selected path is
highlighted; everything else fades so the chain the reader picked is the thing the eye follows. Clicking a test,
market or date moves the selection, re-renders the diagram and keeps the printed path in step.

When WebGL is unavailable the same nodes are drawn on a 2D canvas, and the caption says so. Either way the printed
path below carries: the morning call, the market prediction and the actual move, the levels archived before entry,
the coded entry, the stop, the target and the outcome. Where the evidence ends, `Where the path stops` names the
missing item instead of leaving a blank:

- test 1: the per-date `DXY.cash` move is not stored (the lane publishes aggregates) and the official ICE series is
  blocked - both are said in that block;
- tests 3 and 4: no five-minute tape and no archived ladder outside the six archived ladder dates, so the path stops
  at the morning call; the two-day EUR/USD execution demo (2026-11-05/06) does show the trade and is labelled *execution demo*, with no engine state row for those dates.

## Data completeness for the selected morning

`All 25 factors on <date>` expands to every row of the frozen book with its role, the adjudication's treatment and
disposition, its state at the cutoff (readable, absent, stale, not read), the vote it contributed, whether it was
carried forward and for how many business days, its owning signals and the research verdict. Expanding a row lists
each input with the print date the run artefact recorded, its staleness and the age the book allows. Rows that do not
vote say so ("not a voting row", or "cannot vote today" for a direction row that is stale) rather than showing a vote
they do not have.

Every result also carries the version stamp (`usd-session-engine-v1 Â· book usd-l1-factor-rulebook-v1.0.0 Â·
decision usd-l1-decision-rules-v1.0.0 Â· run usd-l1-backtester-r1`), so a reader can tell which model and which rule
version produced it. The nine-input `challenger_v1` experiment is labelled as the experiment throughout, and the
execution demo is labelled as a demo wherever it appears.

## Fail-safes

The engine's six checks are printed with what each one checks, its status on the selected date, and the engine's own
sentence when it fired:

| Id | Checks | On failure |
| --- | --- | --- |
| E1 | every reading is stamped before the 05:00 London cutoff | blocks |
| E2 | the RG-4 volatility gate is open at the cutoff | blocks |
| E3 | every vote belongs to a direction row that may vote | blocks |
| E4 | enough of the book is readable for the eligibility rule (6 signals, 4 families) | blocks |
| E5 | the family vote leaves the deadband and nets away from zero | abstains |
| E6 | the provisional trade rule is met | abstains; **not applicable** when there is no call |

Each test adds its own data fail-safes: the broker lane's price coverage and the blocked official series for test 1;
a USD direction to apply and a priced outcome per market for test 2; an archived ladder, a five-minute tape and a
filled trigger for tests 3 and 4. A check that did not apply says so instead of passing.

## Why this morning made this call

Three additions answer the question a reader actually asks of a single morning: why this call, or why no call, and
whether it counted.

- **The accuracy line** under the printed path says what the morning is in the directional-accuracy count: a hit or a
  miss with the market's close and the flat band (`2026-10-12`: a bearish USD call, EUR/USD closed âˆ’0.3194%, counted as
  a miss), â€œexcluded from directional accuracyâ€ when the engine issued no call (`2026-10-09`), or â€œnot scoredâ€ when no
  priced outcome is stored for that market. Tests 2â€“4 say that they score a different question, so the morning does not
  enter the USD-call count.
- **Inputs the engine refused** lists every row the engine marked missing_or_stale with the reading that broke it and
  the age the book allows. On `2026-10-09` and `2026-10-12` those are `broad_dollar_d5_pct` and `broad_dollar_d1_pct`
  on `live.f5-dxy-delta`, and `usdjpy_d1_pct` and `usdchf_d1_pct` on `risk.usd-safe-haven-demand`: the run artefact
  records those prints with a date but no time of day, so they are unclocked at a 05:00 cutoff and may not vote. This
  is the same list the engine's own E3 sentence names, and a unit test holds the two together.
- **Rows that could vote, and how they voted** prints the recorded vote symbol for each of the eleven direction rows
  with its state and whether it counted, plus a tally (`2026-10-09`: 3 bullish, 2 bearish, 4 flat, 2 could not vote).
  Beside it, exit check E5's own sentence says whether the vote cleared the 0.20 deadband â€” on `2026-10-09` it did not,
  so the engine abstained.

The tab deliberately does not print a family net score. The artefacts store one vote symbol per book row and the
engine's per-signal votes are not reconstructed by the tab, so a computed net would be the tab's arithmetic rather than
the run's. The rows, the tally and the E5 sentence are what the run records; `native.voteRegister` is tested to expose
no `net_score` field for that reason.


## Rules, data and infrastructure

Every test subtab carries three expandable sections:

- **Rules and research** - the frozen rulebook, the decision arithmetic, the engine source, the adjudication
  manifest and the engine note.
- **Data and infrastructure** - the run and engine artefacts, the decision-rules and audit artefacts, the live
  Supabase tables `market_snapshots` and `agent_outputs` (read only; the backtest never writes to them) and the n8n
  shadow workflow *export* (not imported, alert and log destinations unwired).
- **Fail-safes** - the table above, for the selected date and market.

Every link is asserted to exist in the checkout by `tests/backtesting_native.test.js`; the two Supabase links are the
only ones marked external.


## What is planned, and what is old

Post-release reviews (first shadow week, the 4-business-day FRED age, H.10 legs on intraday tape) are listed as
*planned* with the precondition each still needs. Older gold runs, the backtest flow and the standalone rules page sit
in their own group and are never mixed into this programme's counts.

## Evidence

- `data/usd-layer1-backtester/engine-v1.json` carries `morning_states` (725 positional state/vote/age strings plus
  per-morning `checks`), `book_detail` (25 named rows, 12 signals with owners, 6 families, eligibility) and
  `check_contract`. `node backtester/scripts/run_usd_l1_engine_v1.js --check` reports it current at 41 allowed,
  541 blocked and 143 abstained over 725 mornings.
- `tests/backtesting_native.test.js` 13/13: versions, fail-safe statuses against the fired-rule log, the 25-row
  ledger against the stored strings, the map path, a scored morning, a stopped path, the equity gate, the lane
  fail-safes, deep links, every link target, the refused inputs held against the engine's own E3 sentence, and the
  vote register showing who could vote without inventing a family score.
- `tests/backtesting_native.browser.test.js` 7/7: the normal menu and active styling, North Star above the map, three
  columns with four ordinals, test 3 â†’ EUR/USD â†’ a stopped path and the labelled demo date, one scored morning and one
  blocked morning with evidence and all 25 expandable factors, a deep link, a 390-pixel phone with no sideways
  scroll, the 12 October miss and the 9 October no call read from the rendered tab, and both of those mornings again
  at 390 pixels with the vote block and the accuracy line still readable.
- Acceptance captures (ignored): `tmp/backtesting-acceptance/desktop-scored-2026-10-12.png`,
  `desktop-blocked-2026-10-09.png`, `mobile-blocked-2026-10-09.png` and `mobile-path-2026-10-09.png`.
- Acceptance read back through `tmp/probe-acceptance.js` (ignored) at 1440 and 390 pixels: `2026-10-12` prints
  `miss`, EUR/USD `-0.3194%` and the attributed move `-0.3194`; `2026-10-09` prints `excluded from directional
  accuracy`, E5's own deadband sentence `abstained`, the refused rows `live.f5-dxy-delta` and
  `risk.usd-safe-haven-demand` with the unclocked-print reason, and a tally of 2 rows that could not vote. No page
  error was raised, and on the 390-pixel phone no section, panel, table or canvas exceeded the viewport - the votes
  and the fail-safes print as stacked cards there, so nothing needs a sideways scroll.
- Full `npm test` on this port, after the rebase onto `main`'s architecture-map work: 914 tests, 902 pass, 8 fail, and
  none of the 8 is this work. Six also fail in a clean worktree of `origin/main` with the same `node_modules` -
  `site_nav_consistency.browser.test.js` 3 of 5 (its `--check` reports the same one stale page, `index.html`, on both
  trees), `live_trading_chart_pan.browser.test.js`, `live_trading_chart_zoom.browser.test.js`,
  `backtesting_development_release.browser.test.js` (it waits for a `Backtest Engine` button that page no longer has)
  and `tests/research_library.browser.test.js`. The other two read the published feed files and the wall clock:
  `live_trading_publication_monitor.test.js` fails 1 of 10 in the parallel run and passes 10/10 alone, and
  `refresh_progress.browser.test.js` fails 1 of 26 in the run, 1 of 26 alone a few minutes later, and 2 of the same 26
  in the clean `origin/main` worktree at the same moment - the publish windows it asserts move as the snapshots age.
  Two failures earlier in the session were local state rather than code: six `data/live-trading*.json` snapshots and
  two backtester artefacts had been rewritten in the working tree, so `refresh_progress.browser.test.js` and the
  registry hash checks read stale and re-encoded bytes; restored from `HEAD`, they passed 26 of 26 and 41 of 41.
- Published from a branch rebased onto `main`: `index.html` and `script.js` end up carrying both sides, the
  architecture map's `ensureSystemMap()` loader and `system-map.css` beside the backtesting scripts and render block,
  and the three map suites read 16/16 with `backtesting_native` at 20/20 after the union resolution.
- Live read-back (15 Nov 2026, after PR #6 merged `main` at `a289a259`): the top menu's `Backtesting` link opens
  `index.html#backtesting` at 1440 and 390 pixels with the panel drawn, and both deep links read the same as the local
  captures - `2026-10-12` a `miss` with EUR/USD `-0.3194%` and E5 `passed`, `2026-10-09` `excluded` with E5
  `abstained`, the two refused rows and a vote tally of 3 bullish, 2 bearish, 4 flat and 2 unable to vote. The live
  `lib/backtesting_native.js` is 12,204 bytes, both artefacts return 200, the map draws in WebGL at both widths, no
  page error is raised and `documentElement` reports no horizontal overflow at 390 pixels.

## Gaps that are displayed, not hidden

- The official ICE cash DXY lane is blocked; the broker `DXY.cash` lane is reported beside it and never as it.
- No morning carries a 05:00 London timing receipt, F8 is not consumed by the published book and the event calendar is
  unstaged, so the gate to an accuracy statement is unchanged.
- The 4-business-day FRED age closes F5 and safe-haven demand on roughly 40% of mornings; that is visible in E3/E4
  evidence and is a book change (v1.1), not a setting.
- Tests 3 and 4 replay only the two-day EUR/USD execution demo and the six archived ladders; no market besides
  EUR/USD has a tape in this checkout.
- The tab is published on `main` (`a289a259`, feature commit `cd5ce545`) and reads at
  `https://kevincreedycars-debug.github.io/trading-agent-dashboard/index.html#backtesting`. Publishing it re-published
  GitHub Pages, so a later change to the panel is its own operation again, and the live page still shows the two refused
  F5 and safe-haven prints on both acceptance mornings rather than a scored book.

