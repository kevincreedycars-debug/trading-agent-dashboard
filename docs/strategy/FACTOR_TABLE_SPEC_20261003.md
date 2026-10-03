# The factor table the user asked to see, in plain words

Advisory note by worker `strategy` (`strategy-advisory-001`), 2026-10-03, at the user's instruction this turn,
verbatim: *"what I want to see is the factor breakdown table we have previously discussed, super improtant."*

This is the shape of the one table he has been asking for since the question round, written down so the lane that
builds it cannot drift from what he expects, and so he can see what is coming before it exists. It is advice to the
coordinator and its lanes, not an applied change: this worker writes only `docs/strategy/` in its own worktree, holds
no credentials for this assignment, and cannot open a lane, run the measurement or publish a page. No production file,
page, number, register entry or artifact was touched, no new data was read, and the prospective window sealed until
`2027-03-25T15:00:00Z` was not read.

## 1. What he asked for, and what it maps to in the record

The table he means is the one this lane has described since 2026-09-28 as *the movement table by factor state*: the
first stage of his own split - **first does it move, then which way** - where gold's realised travel is measured for
each factor state that is already accepted, rather than asking the direction question the archive cannot answer.

His own authority for it is already recorded. On 2026-10-03 he directed *"Yes this thread was interrupted we want to
see and analyse all the gold data as per above"* and *"we want to see direction, l2l and 0.5l2l data always"*, and the
coordinator's fifteenth cycle published the measurement lane from the accepted strategy filing
`20261003-strategy-gold-view-and-fault-first-042` (review `docs/orchestration/reviews/20261003-strategy-gold-view-and-fault-first-042.md`,
line 7): assignment `gold-declared-band-measurement-026` on `gold-research`, register status exactly
`instructions_published_awaiting_worker`, work order `docs/orchestration/assignments/gold-research.md`.

So the table is not blocked on a decision, a design or a number. It is open, published, waiting to be picked up.

## 2. What each row of the table says

One row per factor state, and the row is readable without any jargon:

- **Which factor it is**, named the way the scorecard names it, grouped under its factor so all the states of one
  factor read together.
- **Whether gold travelled more or less than usual while that state was on** - the realised spread while the state is
  on against the same period's own normal, printed as the share of days that clear the two ranges he named: half L2L
  and full L2L. Nothing is converted into a fixed percentage, because his own range moves with the day.
- **How long it lasts**, on the ladder he wrote himself - 1, 2, 3 and 5 sessions - so he can see whether a state is a
  one-day event or sets the tone for a few days.
- **How many days the row rests on**, always printed, and the row is never dropped for being thin or rare (his answers
  9 and 12: *"Yes keep both even if rare its still something to factor into the analysis agent"*).
- **One light and one short line** (his answer to question 11): *worth watching today* or *nothing here today*, with
  one plain reason line underneath carrying the size of the move and the day count - for example "0.6% more than a
  normal day, on 112 days". No score out of 100, no ordering of factors best to worst, and the line never states a
  direction or says a factor "works".
- **The direction read beside each row**, per his standing presentation rule, with its own day count and its own plain
  sentence - but the table does not pick a side.
- **No blank cell.** His instruction of 2026-09-29 - *"just fill the gaps so we have all data clear"* - stands: where an
  accepted artifact cannot supply a number, the cell says so in words and gives the reason, and no number is invented.

The table's four blocks, in reading order, are already settled: (D) the movement screen first, with no direction
column; (A) any row that clears the accepted interest bar, expected to be empty; (B) every other declared-band row
with its complete ladder; (C) the VIX change rows, context only, direction column empty. One `looks_counted` figure
travels with the whole sweep so the best-looking cell cannot be read as if it were the only one.

## 3. Where he will see it

On the live **Gold** page, in its last tab, **Factor tables**, which is already there and already labelled draft. Read
live over HTTPS this turn: `gold.html` is 14,388 bytes and its tab strip is Direction, Backtest evidence, 28-factor
outcomes, Factor tables (draft); that last tab frames `gold-factor-wip.html`, live at 33,053 bytes, which reads
"50 of 50" and carries 5 tables and 42 rows of the record, the settled questions and the base rates - and no
factor-by-factor numbers, because the measurement has not run.

When the table lands, it replaces that draft framing inside the same tab. Nothing else on the page changes. The table
is the one surface that answers *"which factors are worth watching, and does the day travel further or less while they
are on"*; the three tabs beside it keep answering the direction, backtest-evidence and 28-factor-census questions.

## 4. Who does what, and in what order

1. **`gold-research` picks the lane up.** Its work order's own first duty is an older overdue item: the anchor note for
   the `2026-09-28T14:00:00Z|gold|entry` identity, which is to be filed or closed by a blocked report - then the
   measurement continues. Nothing else stands in front of it.
2. **The measurement runs** as published: the share of sessions clearing half L2L and full L2L, on the 1/2/3/5-session
   ladder, for the already-accepted factor states, derived **only** from accepted artifacts - the accepted
   individual-variable report of 2026-09-25 (95,842,994 bytes, with 147,465 each of `median`/`q1`/`q3` and 148,920
   `exact_zero` fields already stored and never cut) and the lane's own accepted scan scripts. Nothing new is declared.
3. **The coordinator's dashboard lane renders it** into the Factor tables tab and adds the one extra print of `median`,
   `q1` and `q3` so the four day-size figures on the page come from the same run as the movement counts, with the
   marked 2026-09-28 figures standing until that print lands.
4. **The collector fix stays first among the production jobs**, and ahead of any forward record, but it does not gate
   this table: the table reads spent archive data only.

Measured this turn, so the order is stated against the live site rather than against a plan: the Gold page's bar and
rail **already match the home page**. Remote `main` moved to `a94fb55030d67cff0a76ea04e92482bf7bc838f6`,
"site-nav: one canonical top bar and side rail on all nine published pages", 16 files and 1,729 insertions, and the
live page carries `<header class="topbar site-nav">` with the same four bar entries as the home page and
`<aside class="side-rail site-nav">`. So of the three production jobs the user authorised in order, the second is
already live and no longer waits on anyone; the first (the collector fault) and the third (the added print) remain.

## 5. What it costs

Nothing new: no data feed, no provider call, no credential, no new measurement method, no new state, band, threshold
or rule, and no re-run of any spent revision. One run inside a lane that is already open, one table artifact with a
declared schema, one plain page in that worker's own worktree, and one page edit on the dashboard lane's side. The
register was written on 2026-10-03; the only thing missing is the worker's time.

## 6. What the table will not say

No direction call and no pick; no ranking, score out of 100 or "winner"; no forecast, holdout or re-check date; no
trading result, cost or signal; no claim that a state "works"; and no published number relabelled or silently rounded.
The four standing limits travel with the page: associations only and only on spent intervals; anchors are shared
between rows; complements are not independent trials; and the register was written after the accepted report existed,
so it is not a pre-registration.

## 7. What the building lane is held to

Checks a reviewer can run against the finished table, all of them the user's own rules rather than this lane's taste:

- Every row carries its own day count, and no row is absent for being thin or rare.
- Wherever a rate is printed, the direction read, the full-L2L share and the half-L2L share appear together, each with
  its own sample count and its own one-line plain explanation.
- Every state and horizon is one that is already declared and accepted; anything else prints as unavailable with the
  reason rather than being invented.
- Every number names the accepted artifact, path and hash behind it.
- No cell is blank, and no published figure is relabelled or rounded differently from how it was published.
- The page says plainly what it is not, and the figure scanned is stated once so the whole table carries one date.

## 8. What the user can do, and what is actually needed

Nothing is needed from him for the measurement itself - the authority is recorded, the lane is published and the data
is already on disk. The one thing that makes it land sooner is the research window being resumed: that window's own
activity record still names the previous assignment and a pause from 2026-09-25, and it has filed nothing since, so the
lane is open but the worker is not running. Anyone who can resume that window - the coordinator, or the user asking for
it - unblocks the table.

## 9. Provenance of this turn's reads

Read live over HTTPS, read-only, 2026-10-03: `gold.html` (HTTP 200, 14,388 bytes, one `<header class="topbar site-nav">`
with four bar entries, one `<aside class="side-rail site-nav">`, four tabs ending in Factor tables (draft));
`index.html` (HTTP 200, 24,821 bytes, bar and rail present); `gold-factor-wip.html` (HTTP 200, 33,053 bytes, five tables,
forty-two rows, "50 of 50" four times). Read from the canonical checkout: remote `main` tip
`a94fb55030d67cff0a76ea04e92482bf7bc838f6` and its commit stat (16 files, 1,729 insertions);
`docs/orchestration/projects.json` row for `gold-research` (assignment_id `gold-declared-band-measurement-026`, status
`instructions_published_awaiting_worker`, baseline `cdd350af`); `docs/orchestration/assignments/gold-research.md`;
`docs/orchestration/reviews/20261003-strategy-gold-view-and-fault-first-042.md`; `.local/orchestration/activity/gold-research.json`
(assignment `gold-coverage-025`, `paused`, updated 2026-09-25T19:54:06.758Z); `docs/GOLD_HISTORY_PATCH_VALIDATION.md`
("installed n8n validation and production application remain outstanding"). The plan figures this note repeats
(half L2L 0.3618%, full L2L 0.7236%, the 1/2/3/5 ladder, the two-light rule, the 147,465 / 148,920 field counts) are
carried from `docs/strategy/GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md` and
`docs/strategy/GOLD_DATA_USEFULNESS_READ_20261003.md`, where they were measured on spent intervals.

## 10. What this file is not

It is not an assignment, a register entry, a measurement or an authority to publish; the coordinator registers lanes and
publishes pages. It does not re-open what the user already settled, it applies no patch, and it changes no page,
stylesheet, script, template, builder, guard, generator, data artifact, number, register entry, assignment, lock,
controller or bridge file. It is one thing only: the table he asked for, written down in his words and this lane's, so
that what arrives is what he asked to see.
