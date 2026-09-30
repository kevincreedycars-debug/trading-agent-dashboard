# Strategy 030: the gold tab shell, verified and release-ready - accepted, and no publish taken

Reviewed on 2026-09-30 by the background Central Orchestrator. This is a controller-locked run: the controller
status named this submission (`state` `reviewing`, `detail` `20260930-strategy-gold-tabs-release-ready-030`,
pid 24000), so no interactive pause or stop was run and the background dispatcher was left alone. Submission
`20260930-strategy-gold-tabs-release-ready-030`, mailbox SHA-256
`8522d1292cc3966a46f6815ca14c9598001daf0a679fe10ce5ce70507dcde52f`, reproduced independently from the immutable
inbox file (8,183 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/strategy/20260930-strategy-gold-tabs-release-ready-030.json` (8,560 bytes, SHA-256 `08847820edd18d3937d8e03f0db27fa2be2ebe5db46a841360073c8645a68df2`), decision `accepted`.
Acceptance is not a publish, merge, deployment, lane opening, route selection or accuracy claim. Nothing in this
cycle pushed, merged, tagged, deployed, copied a page into the site root, edited a bar or a guard, or touched a
credential, workflow, warehouse, Layer 1 or Layer 2 artefact.

## What the submission is

A release package, not a change. It carries the Route A shell itself
(`docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html`), a build brief and release checklist
(`docs/strategy/GOLD_TABS_BUILD_BRIEF.md`) with the five edits written out against the exact text they replace, a
rollback, an acceptance run and the boundaries the building lane must keep, and section 9 added to the merge request
so a reader of the request finds the ready artefact. The user's instruction of the same evening - save this for
tonight, be ready to push it live in the morning - is why the package exists, and the worker's own write authority
(`docs/strategy/`) is why it stops at the package: the live pages, the top bar and the guards belong to the
coordinator's dashboard work under the single-writer rule.

## Scope checked

Worker `strategy`, worktree `.local/worktrees/strategy`, branch `workers/strategy-advisory-20260920`. Two commits,
both reported in the envelope: `2466cf9` (`docs/strategy/CONVERSATION_NOTES.md`, +16/-0) and `1c2678b`
(`+310/-0` across exactly the four files the envelope names - the candidate, the brief, the merge request and the
conversation notes). The parent chain is `1c2678b` to `2466cf9` to `e6db6f7` to the reported base
`c3b5e209b3c2126c95a0eff6872b276756ee7af3`, so the lineage reproduces. The worktree is clean, and no code, test,
dashboard page, guard, generator, data artefact, register entry, assignment, credential file or other worker
checkout is in the changed set. The canonical checkout was read only; its unrelated dirty state
(`tools/strategy-node/Strategy.code-workspace` modified, five untracked `backtester/` gold session-policy files)
was left untouched, as was every other worktree.

## Independent verification (reproduced, not trusted)

- **The candidate reproduces byte-exactly.** `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` is 6,199 bytes, 109 CRLF
  lines, 0 bare LF, sha256 `74dd93c8fe6daa179718322d1fb6f339dcdb95f1acb752d534af3af832446eea`.
- **The other two documents reproduce too**, with one small arithmetic note. The merge request is 11,807 bytes,
  145 CRLF, 0 bare LF, 146 lines, with 9 numbered sections and section 9 present; the conversation notes are
  197,841 bytes. The brief measures **9,941** bytes here, not the 9,943 the submission reports (146 CRLF, 0 bare LF,
  8 sections, as claimed). Two bytes is immaterial to the release and is recorded only because this review checks
  numbers rather than repeating them.
- **The coupling reproduces exactly.** `WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html` is 24,687 bytes, 289 CRLF, 0 bare
  LF, sha256 `aa9e104c81b6e479ca59b05b9b31840877b4626624e54c5a0170dc202a98dd1e`, with 5 `<h2>` sections, exactly one
  `.draft` banner, reads `50 of 50 answered` and **not** `40 of 50 answered`, and keeps the line
  `As of 30 September 2026`. `gold_factor_wip_dashboard_link.browser.test.js` line 28 is exactly
  `assert.match(await page.locator('.draft').textContent(), /40 of 50 answered/);`, so the same-change rule in the
  brief's section 4 is right.
- **The guard the brief leans on is green today, re-run here rather than accepted:**
  `node --test backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` in the canonical checkout is
  2 tests, 2 pass, 0 fail (613 ms and 706 ms). Any failure after the change therefore belongs to the change.
- **The four gold pages are untouched and still reproduce the merge request's own table of live pages**, re-measured
  from the canonical checkout: `gold-direction-scorecard.html` 143,517 bytes / 415 CRLF / `0caf0559...`;
  `gold-backtesting.html` 292,270 / 0 CRLF with 88 bare LF / `60dca907...`; `gold-backtest-outcomes.html` 19,420 /
  234 CRLF / `a72a25eb...`; `gold-factor-wip.html` 21,541 / 260 CRLF / `675fc9da...`. `gold.html` does not exist in
  the canonical checkout, so edit E1 is genuinely additive.
- **The shell was re-driven in a real browser by this review, not by the worker's own script.** The coordinator's own
  harness (ignored scratch, `.local/orchestration/tmp/review-030-sim.js`) copied `styles.css`, `index.html`, the four
  gold pages and the candidate as `gold.html` into an ignored folder, served it on loopback, and drove it with
  Playwright Chromium at 1440x900. Result line `CANDIDATE OK (coordinator re-run)`: all four tabs select and set
  `aria-selected`; each open frame measures 1398 px wide and reads the page's own value in its own context -
  `#c-scored` `25` with 25 `#rows tr`, the backtesting `h1` `Gold backtesting evidence`, `#c-evaluated` `4,956`, and
  the draft banner's `40 of 50 answered` with one `.draft`; `gold.html#factor` reopens that tab after a reload; the
  arrow key moves the selection to the backtesting tab and the hash follows; the four old addresses, `index.html` and
  `gold.html` all answer 200; zero 404s and zero console errors. The worker's own figure of 1398x750 per open frame is
  consistent with this.
- **Every bar line the brief quotes is the line that is there.** In the canonical checkout `index.html`, line 19 is
  the `Gold Backtest` outcomes entry, line 20 `Gold Direction`, line 21 `Backtest Flow` (explicitly preserved) and
  line 22 `Gold Factor (draft)`; line 45 is `<button class="tab-button" data-tab="GOLD">Gold</button>`, an in-page
  dashboard tab that the brief correctly tells the lane to leave alone.
- **No guard outside the three gold hops depends on the gold bar, checked rather than assumed.** Searching every test
  file for `topbar-link` finds exactly four: the three gold hop guards plus
  `backtester/tests/backtest_flow_page.browser.test.js`, whose assertion is about the `backtest-flow.html` entry that
  E2 keeps. The brief's five-file acceptance list therefore covers the bar-dependent guards, and its statement that
  the page-level gold guards need no edit holds.

## The one material finding: the checkout bar is not the published bar

The submission's correction - that the checkout carries **three** gold bar links, not the two the merge request
assumed - is right for the file it measured, and this review reproduced it. But the file that the live site serves is
not that file. The published line and this checkout have diverged - 275 commits exist only on `origin/main`
(`599c686`), 179 only on this branch - and `git diff origin/main -- index.html` is 39 insertions and 33 deletions: the published bar
carries **two** gold entries (`Gold Direction`, `Gold Factor (draft)`) plus `Backtest Flow`, and no `Gold Backtest`
outcomes entry at all, while the checkout carries three gold entries and no live-trading section, no Silver, WTI or
GBP rail tabs, and older `styles.css` and `script.js` cache-buster strings. So both numbers are true of their own
file: the merge request's original two describe production, and the worker's three describe the checkout it hands
the lane.

Nothing in the package is wrong because of this, but the release inherits it as a rule: **build the release on the
published `index.html`, not by copying the checkout file over it**, or it would revert the live Silver, WTI, GBP and
Live Trading work and the newer cache-busters along with the intended one-entry change. For the same reason the
merge is the first change that gives the outcomes page any live route at all - it currently has none - which is why
the E4 guard rewrite is load-bearing rather than cosmetic.

## Notes, not defects

- **The candidate's own header comment is stale in one clause.** It says to replace the two gold bar links in
  `index.html` with one; measured, the checkout carries three. It also carries a build-candidate banner saying it is
  not to be published from that folder. E1 says copy byte for byte, so both would go live inside the published file's
  HTML comment. Neither affects behaviour and no guard reads it, but the lane should decide whether to strip or accept
  the header before publishing, because a published page whose source says it is a build candidate is a readability
  and honesty wrinkle, not a functional one.
- **The fourth tab.** The user named three pages; the shell carries four tabs, adding `gold-backtest-outcomes.html`
  because that is where the checkout's `Gold Backtest` entry points. The brief and the merge request both disclose the
  inference. It is the one tab that does not come from the user's own list, and it is also the only thing that would
  give that page a live route.
- **The frames are navigation only.** Nothing in the shell re-derives a number, moves a threshold or presents a
  figure as a result, a ranking or an edge. Each frame shows the page's own values, including the draft page's own
  banner, and the load-bearing honesty mechanisms sit inside the framed documents where they already live.

## Dependency impact

Nil for the research circuit: no generator, template, data artefact, registry, run, ledger or guard input is
referenced by the changed set, the four page blobs are unchanged, and the release as specified touches only
`index.html`, one new page and three guard hops. The known coupling is the revision-2 answered count, already
measured and already written into the brief. `npm test` and its focused variants were not run as a whole by this
cycle - the changed files are documentation and one unbuilt candidate page - so the focused guard above is the
evidence this review adds, plus its own browser re-run of the candidate.

## Decision and next action

Accepted, as a verified advisory release package. `node scripts/coordination.js check` afterwards reports the mailbox with 0 pending and 0 errors, and this submission as `accepted`. No page, bar entry, guard, generator, data artefact, lane
registration, release worktree or live system was touched, and no number was re-derived.

No new assignment is published and no worker status was altered: `projects.json` keeps `strategy` at
`advisory_active` under `strategy-advisory-001`, and this submission is spent. The reason is authority rather than
reluctance: the build is the coordinator's own dashboard work under the single-writer rule, the publish is a
coordinator production action of the same kind as `a2b0e13`, and this background run carries no production
authority. Publishing a worker assignment to build a release the user has asked to take in the morning would put a
second writer on the same files.

The immediate next action, when the user's morning word arrives, is the five edits in the brief's section 3 (plus the
revision-2 copy and its one-line guard move if that is taken in the same release), performed on the published
`index.html` and followed by the acceptance run in the brief's section 5 and a live check. Rollback is the brief's
section 6 and is cheap, because the old addresses never stop working.

## The precise unresolved decisions, all the user's

- **The morning go-ahead for Route A**, which is the only thing standing between this package and the live site. The
  user's request to be ready to push it live in the morning is read as Route A, ready as briefed, and not yet as the
  push itself.
- **Whether revision 2 of the draft page travels in the same release**, with the pinned `40 of 50 answered`
  assertion moved to `50 of 50` in the same change. Ready either way, in one line.
- **Whether to open the movement-screen measurement lane at all, and on which worker**, while the Gold hold stands.
  It remains the only source of measured factor numbers, so without it the Factor tables tab can only ever show
  decisions.
- **Whether to strip the candidate's header comment before publishing**, and whether the four-tab set, including the
  outcomes tab the user did not name, is confirmed.

## Concurrent change observed

The controller lock and the mailbox were the only coordination state this run read; no other cycle's files were
edited, and the run left the dispatcher, the bridge and the controller untouched. Unrelated and unchanged: the
material forks D1-D5 of the gold band and edge plan, the live-trading call-to-order contract, the carried 022 item A
anchor observation envelope for `gold-research`, the seven `sent_unconfirmed` backtester windows, and the promotion
of the accepted Gold verdict page into this canonical checkout.
