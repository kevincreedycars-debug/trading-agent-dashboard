# Live trading port - the 1h and 4h views and the levels marking, published

Date: 2026-10-03. Branch: `release/live-trading-port-20261003`, cut on the published tip
`3350a89` with the filed candidate `a6ae075` replayed as its content. Candidate filed by worker
`live-trading` as `20261003-live-trading-live-port-candidate-r1` under assignment
`live-trading-002`. Published by the coordinator in the user-authorised cycle the user's own words
opened - "just get the ability for me to scroll out to the 1h and 4h to set the L2L levels from
there" - which the user then put above every other queued item in this session.

## What was published

| Item | Value |
| --- | --- |
| Candidate commit | `a6ae07535ead664e8a7ab619536d4ecc37a1d17b` on `workers/live-trading-port-tip-a94fb550`, the reviewed record |
| Candidate base | `a94fb55030d67cff0a76ea04e92482bf7bc838f6`, the published tip when the lane cut it |
| Published on | `3350a89`, which another lane published while this publish was being prepared; the candidate was replayed on it by the same recipe and the eight files came across with the same counts and no conflict |
| Size, reproduced here | 8 files, +2,892/-324: `index.html` 2/0, `script.js` 751/46, `styles.css` 48/4, `lib/l2l_ladder.js` 192/0, `lib/l2l_levels_store.js` 792/0, `scripts/l2l-levels-tool.js` 51/229, `tests/l2l_levels.test.js` 914/15, `scripts/README-l2l-levels-tool.md` 142/30 |
| Recipe | the already-ruled hunk recipe, not a merge: a three-way merge of the three page files with base `d4fe9ae` and whole-file carries of the five others, zero conflict markers |
| Companion changes | `tests/live_trading_dashboard.browser.test.js`, 31/11 in one file, and one cache-buster token in `index.html`, both made in the publish rather than by the lane |

## The tip moved under the candidate

The lane cut its candidate on `a94fb550` and filed it; by the time this publish ran, another lane
had published the printable Layer 1 call map as `3350a89` at 21:24:59. The candidate was therefore
replayed on `3350a89` by the same recipe rather than merged, the eight-file diff is byte-identical
to the reviewed one, and `a6ae075` stays the reviewed record the reply is bound to.

## The two companion changes, and why

`main`'s own published-page guard asserted that the read-only section carries no form control at
all. The ruled marking panel renders six fields of its own - repository, branch, token, remember
and the two ladder step counts - so the guard failed 1 of 2 on the candidate while passing 2 of 2
on the pristine tip. That guard is a `main` file outside the lane's eight-file set, so the lane
named it as the companion change the publish owes and asked who should make it; it is made here,
the way the earlier chart port widened the same guard.

The guard keeps its original meaning rather than being relaxed: every control in the read-only
section must carry one of the section's own live data bindings, no undeclared control may exist,
the section may carry no form, dropdown or free-text area, the token field must stay a password
field, the panel must say where the token is sent, and no control may read like an order path. The
chart deck and the marking panel's fields must both render, so the guard still proves the section
is what it says it is.

The second change is one line of `index.html`: the `script.js` cache-buster token moves to
`20261003-live-trading-port`, because the file it names has changed and a returning reader would
otherwise be served the pre-port script from cache under the old token. The two new library tags
keep the lane's own tokens.

## Evidence read here, not taken on the filing's word

- `node --check` exits 0 on `script.js`, `lib/l2l_levels_store.js`, `lib/l2l_ladder.js` and `scripts/l2l-levels-tool.js`.
- `node --test tests/l2l_levels.test.js` is 48 of 48.
- `node --test tests/validate_architecture_map.test.js tests/dashboard_writer_selection.test.js` is 15 of 15.
- The published-page guard is 1 of 2 on the candidate before the companion change, with six form controls against a required zero, and 2 of 2 after it.
- The release's own local suite - the 30 files under `backtester/tests`, `tests` and `macro-engine/tests` minus the two warehouse suites the local runner excludes - is 230 tests, 225 pass, 5 fail; the same five fail on a second worktree checked out at the pristine tip `a94fb55`: four `secret_scanner` cases already recorded as pre-existing and environment-dependent, and `confidence_band_delivery`'s "Expected exact market-and-direction row for SILVER", which reads published call data this change does not touch. The publish adds no failure.
- `data/l2l-levels.json` is not in the candidate's file set and is unchanged from what `main` already carried.

## What this publish does not do

- The published snapshot still carries `quote` and `m5` only, with no `h1` or `h4` block, so the two new view buttons draw disabled until the producer refreshes `data/live-trading.json` and the coordinator republishes it. The port is code; the data is not in it.
- `data/l2l-levels.json` still carries four instruments at zero levels, because the seeds are the user's judgement marked on the chart.
- Marking stays the reader's own: levels are held in the browser and published to `data/l2l-levels.json` with the reader's own token, sent only to `api.github.com` and never written into the page. No hosted store, key or table was added, and the lane's browser-local-first advice stays overruled by the user's ruling rather than re-argued.
- No order path, no broker connection, no MT5 credential and no arming. A rendered chart, a marked ladder and two marked levels are not an edge, an accuracy claim, a causal feature-timing proof or a profit rule.
- The lane's guard worktree `live-trading-guard`, created at `a6ae075`, is not needed: the guard change is published here, and a ninth file would now duplicate it.
