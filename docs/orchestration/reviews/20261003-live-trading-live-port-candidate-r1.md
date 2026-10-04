# Durable review: 20261003-live-trading-live-port-candidate-r1

Worker: `live-trading`. Assignment: `live-trading-002` (the candidate), filed as one
`ready_for_review` submission. Reviewed and acted on 2026-10-03 in the coordinator session the user
put this lane's work first in, under the user's own authorisation to put the 1h and 4h views and the
levels marking on the live dashboard.

## Decision

**accepted, and the port is published.** The candidate is a truthful record of its own bytes, it is
the lane's own new work and nothing else, and the production step the review of
`20261003-live-trading-marking-store-and-live-port-r1` left with the coordinator was taken in a
user-authorised cycle. Acceptance covers the filing and the candidate commit `a6ae075` as the
reviewed record. It does not make the lane's guard worktree published work, and the two answers it
asked for are given below.

## What the envelope claimed, and what verified here

- **The candidate.** `a6ae07535ead664e8a7ab619536d4ecc37a1d17b` on
  `workers/live-trading-port-tip-a94fb550`, sole parent `a94fb55030d67cff0a76ea04e92482bf7bc838f6`,
  the published tip when it was cut. Reproduced from the checkout: `git diff --name-status a94fb550
  a6ae075` names exactly the eight declared files and `--numstat` reproduces the declared counts to
  the line - `index.html` 2/0, `script.js` 751/46, `styles.css` 48/4, `lib/l2l_ladder.js` 192/0,
  `lib/l2l_levels_store.js` 792/0, `scripts/l2l-levels-tool.js` 51/229, `tests/l2l_levels.test.js`
  914/15, `scripts/README-l2l-levels-tool.md` 142/30, +2,892/-324 in total - and no conflict marker
  is present in any of the seven ported text files.
- **The scope.** Nothing outside those eight files is in the candidate, so `data/l2l-levels.json` and
  the published `liveTradingUrl` are left exactly as `main` carried them, as declared.
- **The tests, re-run here rather than trusted.** `node --check` exits 0 on `script.js`,
  `lib/l2l_levels_store.js`, `lib/l2l_ladder.js` and `scripts/l2l-levels-tool.js`;
  `node --test tests/l2l_levels.test.js` is 48 of 48;
  `node --test tests/validate_architecture_map.test.js tests/dashboard_writer_selection.test.js` is
  15 of 15.
- **The blocker the lane named is real.** `tests/live_trading_dashboard.browser.test.js` fails 1 of 2
  on the candidate - "the read-only section must carry no form control", 6 against 0 - and passes 2
  of 2 on the pristine tip.
- **Nothing was pushed by the lane.** The branch is local under an ignored path and the register row
  was unchanged by the filing, as its own declaration says.


## What the coordinator did with it

- **The guard widening is the coordinator's, made at publish time (answer to question 1).**
  `tests/live_trading_dashboard.browser.test.js` now requires that every control in the read-only
  section be one the section binds with its own live data attribute, that no form, dropdown or
  free-text area exist, that the token field stay a password field, that the panel say where the token
  is sent, and that no control read like an order path - the guard's original meaning kept, not
  relaxed. It is 31/11 in one file and takes the guard from 1 of 2 to 2 of 2. A ninth file from the
  lane is therefore not needed, and the lane's `live-trading-guard` worktree (created at `a6ae075`)
  should not be filed: it would duplicate published work.
- **The publish.** A release worktree `.local/live-trading-port-release` on
  `release/live-trading-port-20261003`. The candidate was first re-cut on the tip that moved under it
  (`3350a89`, the printable Layer 1 call map published by another lane at 21:24:59) by the same recipe,
  and the eight files came across byte-identically with no conflict. One further line of `index.html`
  moves the `script.js` cache-buster token to `20261003-live-trading-port`, because the file it names
  changed and a returning reader would otherwise be served the pre-port script from cache.
  `origin/main` was fast-forwarded `3350a89..360cb4e`, and the live site was re-read after it:
  `index.html` 200 with `lib/l2l_ladder.js`, `lib/l2l_levels_store.js` and the new token, `script.js`
  200 with `liveTradingPublishPanel` and `data-live-chart-timeframe` present, `lib/l2l_ladder.js` 200
  (8,275 bytes), `lib/l2l_levels_store.js` 200 (34,403 bytes).
- **The release's own suite.** The 30 files under `backtester/tests`, `tests` and `macro-engine/tests`
  minus the two warehouse suites the local runner excludes: 234 tests, 229 pass, 5 fail, and the same
  five fail on a separate worktree checked out at the pristine tip `a94fb550` - four `secret_scanner`
  cases and `confidence_band_delivery`'s "Expected exact market-and-direction row for SILVER". The
  publish adds no failure.

## Answers to the two questions the lane asked

1. The guard widening is the coordinator's change at publish time, made and published as above. Do not
   add a ninth file.
2. The snapshot refresh is **not** in this publish. The published `data/live-trading.json` still
   carries `quote` and `m5` only, so the two new view buttons render disabled until a producer run
   writes the `h1` and `h4` blocks and the coordinator republishes the artifact. That run is the
   producer on the machine holding the terminal, not a code change, and it is filed and republished as
   its own step rather than folded into a code publish.

## Boundaries

No order path was created or widened; no broker connection, credential, key, table or arming; Layer 1
stays independent and backtesting downstream-only; the sealed Gold prospective window stays sealed
until `2027-03-25T15:00:00Z`; and a published chart view, a marked ladder and two marked levels are
not an edge, an accuracy claim, a causal feature-timing proof or a profit rule. The lane's own
worktree, branch and files were left exactly as found, and the two uncommitted-in-canonical items
(the modified `tools/strategy-node/Strategy.code-workspace` and the five untracked `backtester/` gold
session-policy files) are untouched.

## Unresolved

1. **The `h1` and `h4` data.** Until the producer run writes them, the two new view buttons are
   disabled on the live page. This is the user's producer and the coordinator's republish.
2. **The seed levels.** `data/l2l-levels.json` carries four instruments at zero levels; the seeds are
   the user's own judgement marked on the 1h and 4h charts, and the ladder read that section 17's ten
   blanks want cannot start before that.

## Addendum, same day, after the publish: the lane's own snapshot landed and the store wrote marks

Both unresolved items moved without another coordinator publish, so the record is corrected here rather
than left as it stood at acceptance.

- `main` advanced `360cb4e` -> `8ccbc39` (the gold-view publish) -> `9b0b5f2` (the lane's H1/H4 snapshot
  publish: `data/live-trading.json`, `index.html`, `script.js`, +22,833/-4,116) -> `1d01f37` (the lane's
  own port-record docs) -> `4a99258` "Mark L2L levels on the live dashboard (2026-10-03T20:58:23.489Z)",
  written by the marking store inside the published page and touching `data/l2l-levels.json` only.
- Unresolved item 1 is closed by the lane's publish rather than by a coordinator republish, and it was
  re-read live: `live-trading-feed-v2` generated `2026-10-03T20:47:34.821199+00:00`, `read_only` true,
  `order_functions_called` false, all four instruments at 120 M5 / 168 H1 / 120 H4 bars with none of the
  three stale, `index.html` carrying `script.js?v=20261003-live-trading-h1h4-snapshot` and `script.js`
  carrying the feed token `20261003-h1h4-snapshot`. The two view buttons are no longer disabled.
- Unresolved item 2 changed shape and is not closed. The committed `data/l2l-levels.json` now carries 22
  levels, all BTCUSD and all on the H1 view, whose two seeds are 83,113.66 and 84,568.53 at 1,454.87
  spacing, with every row `marked_by: "dashboard duplicate"`; EURUSD, XAUUSD and US100.cash stay empty.
  That is the shape of the lane's own in-page probe rather than evidence of the user's judgement, so the
  marks are treated as a probe's clicks until the user says which they are.
- Consequence measured on `main`'s own bytes at `4a99258`, in the ignored worktree
  `.local/verify-tip-4a99258`: 17 test files, 165 tests, 164 pass, 1 fail, the failure being
  `tests/l2l_levels.test.js`'s "the committed artifact starts every published symbol at zero levels",
  which requires an empty `levels` array per published symbol. Reverting only `data/l2l-levels.json` to
  its `8ccbc39` bytes restores that test, so the red is the published marks and not the code. No
  coordinator edit was made to `main` for it.

