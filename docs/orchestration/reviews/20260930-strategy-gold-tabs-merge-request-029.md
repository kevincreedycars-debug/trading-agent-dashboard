# Strategy 029: one gold page with tabs - accepted as a request, and the three decisions stay the user's

Reviewed on 2026-09-30 by the background Central Orchestrator (a controller-locked run whose `run.lock` and
controller status name this submission, so no interactive pause/stop was run). Submission
`20260930-strategy-gold-tabs-merge-request-029`, mailbox SHA-256
`e3d0f7301759de0fb34c1df642fae0baa4d1101c55446fbb7cae2b4887346cfe`, reproduced independently from the immutable
inbox file (7,985 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/strategy/20260930-strategy-gold-tabs-merge-request-029.json` (8,223 bytes, SHA-256
`ef4bf66abcb0ede01deea6d2be46f90dadb9fc0e81dad33fa1a7cee5c4f8c1b7`), decision `accepted`. Acceptance is not a
publish, merge, deployment, lane opening, route selection or accuracy claim, and nothing in this cycle pushed,
merged, tagged, deployed or published.

## What the submission is

A request and a recommendation, not a change. The user's own instruction on the evening of 2026-09-30 - that the
gold pages be merged into one page with tabs - is turned into one specification document with acceptance criteria
(`docs/strategy/GOLD_PAGE_TABS_MERGE_REQUEST.md`), two costed routes, and the boundary the worker cannot cross: its
write authority is `docs/strategy/` only, while the live pages, the top bar and the shared stylesheet belong to the
coordinator and its dashboard lane under the single-writer rule. The submission therefore asks for three decisions
rather than taking any, and answers the user's own second sentence of that turn by evidence.

## Scope checked

Worker `strategy`, worktree `.local/worktrees/strategy`, branch `workers/strategy-advisory-20260920`. The single
commit `e6db6f7` is `+155/-0` across exactly the two files the envelope names, and its only parent is the
`c3b5e209b3c2126c95a0eff6872b276756ee7af3` the envelope reports as the base, so the reported lineage reproduces.
The worktree is clean, and no code, test, generated page, guard, generator, data artifact, register entry,
assignment, credential file, other worker checkout or production artefact is in the changed set. The canonical
checkout was read only; its unrelated dirty state (`tools/strategy-node/Strategy.code-workspace` modified, five
untracked `backtester/` gold session-policy files, one untracked earlier review) was left untouched.

## Independent verification (reproduced, not trusted)

- **Both artifacts reproduce byte-exactly.** `docs/strategy/GOLD_PAGE_TABS_MERGE_REQUEST.md` is 10,033 bytes, 123
  CRLF lines, 0 bare LF, no BOM, with 8 numbered sections - exactly the shape the worker's own static check
  reports. `docs/strategy/CONVERSATION_NOTES.md` is 192,814 bytes.
- **Every figure in the request's own table of live pages reproduces from the canonical checkout**, including the
  line-ending shape: `gold-direction-scorecard.html` 143,517 bytes / 415 CRLF / sha256 `0caf0559...`;
  `gold-backtesting.html` 292,270 bytes / LF, 0 CRLF and 88 bare LF / sha256 `60dca907...`;
  `gold-backtest-outcomes.html` 19,420 bytes / 234 CRLF / sha256 `a72a25eb...`; `gold-factor-wip.html` 21,541 bytes
  / 260 CRLF / sha256 `675fc9da...`.
- **Every generator, template and data artifact the table names exists where it says**: `build_gold_direction_scorecard.js`,
  `build_gold_evidence_audit.js`, `build_gold_backtest_outcomes.js`, `templates/gold-direction-scorecard.html`,
  `templates/gold-research.html`, `templates/gold-outcomes.html`, `data/gold-direction-scorecard-20260927.json`,
  `data/backtester-checker-gold-24h-2024-2026.json`, `data/gold-evidence-audit.json`,
  `data/gold-28-factor-outcomes-20260925.json`.
- **The three hop guards are quoted exactly, and they read the checkout `index.html`, not the published one.**
  `gold_direction_dashboard_link.browser.test.js` asserts exactly one `a.topbar-link` to
  `gold-direction-scorecard.html`, then `#c-scored` = 25 and 25 `#rows tr`. `gold_outcomes_dashboard_link.browser.test.js`
  asserts exactly one such link to `gold-backtest-outcomes.html`, then `#c-evaluated` = 4,956.
  `gold_factor_wip_dashboard_link.browser.test.js` asserts exactly one link to `gold-factor-wip.html` whose label
  matches `/draft/i`, then `.draft` matching `/40 of 50 answered/` and `.meta` matching `/As of 30 September 2026/`.
  The three page-level guards named in the request are present unchanged, and the draft-page guard additionally
  pins zero `script`, `link`, `img` or `iframe` inside the draft page itself.
- **The claim that the backtesting page has no top-bar entry is right, and its reachability was checked.**
  `origin/main:index.html` and the checkout both carry no link to `gold-backtesting.html`; the page is reachable
  from `backtest-flow.html` line 287, which is a different bar entry.
- **The answers the request relies on are present.** The answer sheet reads `50 of 50 answered` at its head and
  is closed; rows 47 and 50 are both `Yes`, with 50 reading "The movement screen is built before anything else."
- **Credentials and boundaries.** No credential value appears in any changed file; the mailbox, n8n, the
  warehouse, Layer 1 and Layer 2, the sealed prospective window, the live capture task and the live dashboard
  were untouched. Nothing unpublished was read by the worker, and nothing was measured by this review.

## The coupling the worker found, verified

This is the load-bearing technical point in the submission, and it reproduces exactly:

- The live draft page is still **revision 1**: `origin/main:gold-factor-wip.html` is git object `1094c0bf`,
  21,281 bytes, sha256 `5dbe13645fac400fab052edee69528dd06195fe0a17d2a93d2fae351154e95c7`, and the checkout copy it
  normalises from reads `40 of 50 answered` with `As of 30 September 2026` - precisely what
  `gold_factor_wip_dashboard_link.browser.test.js` pins.
- **Revision 2** - `docs/strategy/WORK_IN_PROGRESS_GOLD_FACTOR_TABLES.html`, re-verified here at 24,687 bytes, 289
  CRLF lines, 0 bare LF, sha256 `aa9e104c81b6e479ca59b05b9b31840877b4626624e54c5a0170dc202a98dd1e` - reads
  `50 of 50 answered`, with its five `h2` sections intact.
- Therefore publishing revision 2 without moving that assertion in the same change leaves a failing guard in the
  tree, and this repository has no CI workflow at all (there is no `.github` directory), so nothing else would
  catch it.
- **One refinement in the worker's favour:** `scripts/test-local.js` classifies every `*.browser.*` file and mode
  `all` includes them, so the default `npm test` run carries this guard as well, not only
  `npm run test:browser`. The mismatch would surface on any full local run with Playwright chromium installed,
  which makes the same-change rule easier to enforce rather than harder.

## Notes, each a note and not a defect

- **Bar state, measured.** The checkout those guards read carries the three gold-ish links the worker names. The
  published bar does not: `origin/main:index.html` carries only `Gold Direction` and `Gold Factor (draft)`, plus
  `Backtest Flow` - there is no `Gold Backtest` entry live - so on the published site the outcomes page has no bar
  entry either, and `gold_outcomes_dashboard_link.browser.test.js` currently passes only because it reads the
  checkout copy of `index.html`. This does not change the request, but the lane taking the merge must decide which
  `index.html` it edits, and must not read a locally green guard as evidence about the published page.
- **The fourth tab.** Section 1 says "one tab per page the user named"; the user named three, and the table carries
  four, adding `gold-backtest-outcomes.html` because that is what today's `Gold Backtest` bar entry points at. The
  summary discloses the inference and section 1 hands the lane the exact wording and order, so this is a labelling
  nuance - but it is the one tab that does not come from the user's own list, and the lane should confirm it.
- **Route A leaves the draft page's own guard untouched.** The frames Route A introduces live in the new shell, so
  the draft page's own "loads no script, stylesheet, image or frame" assertion survives as it stands. The ten-kilobyte
  weight is plainly labelled an estimate rather than a measurement, which is the right way to state it before the
  lane builds it.
- **The motion the request asks for is navigation only.** Nothing in it re-derives a number, moves a threshold or
  presents a figure as a result, a signal or a ranking, and section 5 states those limits as requirements.

## The live copy, and the publish that was not taken

The live dashboard is unchanged and keeps revision 1, re-measured here from the published blob rather than from the
record. No publish was taken and none could be taken from this background run, which carries no production
authority: no copy, no release worktree, no push, no live check, and therefore no live bytes to name in this cycle.
The rule recorded for a future publish is unchanged from the 028 cycle: revision 2 is the 24,687-byte CRLF file, and
because this repository runs `core.autocrlf=true` with no `.gitattributes` the commit stores its LF form - measured
at 24,398 bytes sha256 `b0aa8afea8145a24e64d4464ec952d91ed1a8ab11c935a8ee5f254ff40dc37e6`. If revision 2 is
published, that publish must move the pinned assertion in `gold_factor_wip_dashboard_link.browser.test.js` from
`40 of 50 answered` to `50 of 50` **in the same change**, and the merge lane's own guard edits must land with it.

## Decision and next action

Accepted, as an advisory request and recommendation only. No page, bar entry, guard, generator, data artifact,
lane registration, release worktree or live system was touched by this cycle, and no number was re-derived.

No new assignment is published, and no worker status was altered: `projects.json` keeps `strategy` at
`advisory_active` under `strategy-advisory-001`, and the submission is spent. The reason is not reluctance but
authority - the three decisions the worker asks for are each one the user owns, and the fourth possible next move,
building the merge, is the coordinator's own dashboard work under the single-writer rule rather than a bounded
worker assignment. Publishing a worker assignment to build a page the user has not yet chosen a route for would
invert the order the request itself sets out.

## The precise unresolved decisions, all three the user's

- **Route A now or Route B.** One shell around the three existing pages, about ten kilobytes of new markup and CSS,
  with the generators, artifacts and page guards untouched; or one generated document of roughly 450 KB needing a
  new composition step and repointed page guards.
- **The go-ahead to publish revision 2**, with the pinned `40 of 50 answered` assertion moved to `50 of 50` in the
  same change. This is a coordinator production action of the same kind as the `a2b0e13` publication of revision 1.
- **Whether to open the movement-screen measurement lane at all, and on which worker, while the Gold hold stands.**
  Answers 47 and 50 put the movement screen first and the question round is closed at 50 of 50, so no factor number
  is missing because a question is unanswered; but opening that lane is a measurement over already-spent intervals
  that expands scope, runs into the standing hold on the Gold lane whose register entry is deliberately kept at
  `instructions_published_awaiting_worker` for the carried 022 item A envelope, and has no registered worker.

## Concurrent change observed in the same window

Another coordinator cycle landed in this same window and is not this review's work: commit `ab21177` on
`orchestration/control-plane-20260920` published the read-only Live Trading section, and `origin/main` advanced to
`bc538d7`. Every figure this review measures was therefore re-taken after that move: `origin/main:gold-factor-wip.html`
is still git object `1094c0bf` at 21,281 bytes, so the live gold draft page is still revision 1, and the published bar
still carries no `gold-backtesting.html` and no `gold-backtest-outcomes.html` link. The moved line changes nothing in
this review's findings or its three unresolved decisions, and the concurrent cycle's own scoped files are preserved
untouched.
Related and unchanged: the material forks D1-D5 of the gold band and edge plan, the page lane having no registered
owner (the suggested `dashboard-gold-tabs-001` is not registered by this review), queue position 2 (the live-trading
authority level and the port recipe), and the promotion of the accepted Gold verdict page.