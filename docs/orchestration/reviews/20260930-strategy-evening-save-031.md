# Strategy 031: the evening save - acknowledged, the copy trap confirmed, no new assignment published

Reviewed on 2026-09-30 by the background Central Orchestrator. This is a controller-locked run: the controller
status named this submission (`state` `reviewing`, `detail` `20260930-strategy-evening-save-031`, pid 24000), so no
interactive pause or stop was run and the background dispatcher was left alone. Submission
`20260930-strategy-evening-save-031`, mailbox SHA-256
`8b1c8d55ffbc3185adcab9743cdf44ee86c93bd4a25374a76ed16ec9a7651973`, reproduced independently from the immutable
inbox file (6,657 bytes) and equal to the hash `check` reports. Reply published at
`.local/orchestration/replies/strategy/20260930-strategy-evening-save-031.json` (5,944 bytes, SHA-256
`06164e5288d14a4cf3988146b41893a382a5f737b92beba7b085b87488d5f83f`), decision `acknowledged`. Acknowledgement is
not a publish, merge, deployment, lane opening, route selection or accuracy claim. The review queue is empty after
this reply (`pending` 0).

## What the submission is

A documentation-only status report with no new deliverable. Its stated purpose is bookkeeping: submission -030 was
filed at 21:52 against head `1c2678b`, and one documentation-only commit landed afterwards, so the record the
coordinator holds should match the branch rather than sit one commit behind. One commit, `bcceb29` ("strategy: save
the evening state and note the copy trap"), adds the fourth 2026-09-30 entry to `docs/strategy/CONVERSATION_NOTES.md`
(the close-out: what is committed, that the package is filed, the copy trap, what is deliberately left in ignored
scratch, and the decisions still the user's) and one clarifying paragraph to section 1 of
`docs/strategy/GOLD_TABS_BUILD_BRIEF.md`, placed where the copy step is described. No page, generator, data artefact,
guard or number changed. The user's "save here for the evening" is why the worker is parked, paused and reachable.

## Scope checked

Worker `strategy`, worktree `.local/worktrees/strategy`, branch `workers/strategy-advisory-20260920`, HEAD
`bcceb29a46d91bbb682fa8fb7399bfd40007d3b0`, working tree clean (`git status --porcelain` empty, no `tmp/` file
tracked). The commit's parent is `1c2678b`, and the chain `1c2678b` to `2466cf9` to `e6db6f7` to the reported base
`c3b5e209b3c2126c95a0eff6872b276756ee7af3` reproduces. `git diff --numstat 1c2678b bcceb29` is +39/-0 on
`docs/strategy/CONVERSATION_NOTES.md` and +8/-0 on `docs/strategy/GOLD_TABS_BUILD_BRIEF.md`: two files, no deletions,
and no code, test, dashboard page, guard, generator, data artefact, register entry, assignment, credential file or
other worker checkout in the changed set. The canonical checkout was read only; its pre-existing unrelated local
state (`tools/strategy-node/Strategy.code-workspace` modified with local title/colour customisation, and five
untracked `backtester/` gold session-policy files) was left untouched, as was every other worktree.

## Independent verification (reproduced, not trusted)

- **The release package is unchanged**, which is the report's central claim. `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html`
  is still 6,199 bytes, 109 CRLF, 0 bare LF, sha256
  `74dd93c8fe6daa179718322d1fb6f339dcdb95f1acb752d534af3af832446eea`, byte-identical to the artefact review -030
  accepted, so the five edits, the acceptance run, the rollback and the boundaries are unaffected.
- **The copy trap is real and reproduces.** The candidate's committed blob is 6,090 bytes (`git cat-file -s` on
  `HEAD:docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html`) against 6,199 bytes CRLF on disk; `index.html` is a 19,332-byte
  blob against 19,698 bytes on disk; `gold-factor-wip.html` a 21,281-byte blob against 21,541 bytes on disk;
  `gold-direction-scorecard.html` 143,517 bytes on disk. `core.autocrlf` reads `true` in the canonical checkout. A
  recorded sha256 in this repository is therefore the file as it sits on disk, and a copy taken from `git cat-file`
  will not match it; both forms render identically, so this is a hashing trap rather than a defect. The brief's new
  paragraph puts the warning where the copy step is described, which is the right place.
- **The corrected figure is adopted.** `docs/strategy/GOLD_TABS_BUILD_BRIEF.md` now measures 10,671 bytes, 154 CRLF,
  0 bare LF, 8 sections. The arithmetic closes exactly: 8 lines were added, since 154 minus 8 is 146 CRLF, the count
  -030 filed, and the blob sizes give 9,795 plus 146 equals 9,941 bytes at `1c2678b` - the figure review -030 measured,
  not the 9,943 that -030's own envelope reported. `docs/strategy/CONVERSATION_NOTES.md` measures 201,520 bytes,
  2,390 CRLF, 0 bare LF after the appended entry. No other figure in -030 changes, and `1c2678b` remains the
  deliverable commit.
- **Nothing live changed.** The live draft page is still revision 1 (21,541 bytes CRLF on disk, 260 CRLF, sha256
  `675fc9da...`), `gold.html` does not exist in the canonical checkout, and nothing was pushed, merged, deployed,
  copied into the site root, purchased or sent.

## Decision, and why no assignment is published

Decision `acknowledged`. `docs/orchestration/README.md` is explicit that an acknowledged status report does not start
new work, so the evening park stands and the worker is not woken. No new assignment was published and no worker
status was altered: `projects.json` keeps `strategy` at `advisory_active` under `strategy-advisory-001`, and no status
was set to `instructions_published_awaiting_worker`. The reason is that the next move is not a worker assignment. The
E1 to E5 build and the page copy belong to the coordinator's own dashboard lane under the single-writer rule, and the
publish is a coordinator production action of the same kind as the `a2b0e13` publication of revision 1. Publishing a
second writer onto the same files would break that rule, and waking the strategy window after the user parked it for
the evening would contradict the user's own instruction.

## Unresolved, and it is the user's

Unchanged from -030, and each is a user decision rather than a coordinator one:

1. The morning go-ahead for route A (the tab shell, verified and ready).
2. Whether revision 2 of the draft page travels in the same release, with the pinned `40 of 50 answered` assertion in
   `backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` moved to `50 of 50` in the same change.
3. Whether to strip the candidate's stale header comment - it still says two bar links and that the file is a build
   candidate not to be published - and whether the four-tab set including the unnamed `gold-backtest-outcomes.html`
   tab is confirmed.
4. Whether to open the movement-screen measurement lane at all, and on which worker, while the Gold hold stands. It is
   the only source of measured factor numbers, so without it the Factor tables tab can only ever show decisions.

## Recorded, not actioned

The advisory-note corrections owed since the -004, -005 and -006 reviews are still undelivered at this head: the
gaplessness claim at `docs/strategy/CONVERSATION_NOTES.md` line 1005, the "never missed a tick" claim at line 1030,
and the -004 line-911 revision. The worker has not filed the correction under a new submission ID. They are
advisory-note corrections rather than a research assignment, and the worker is parked on the user's word, so they were
not published as an assignment tonight. They remain owed and are the first thing to clear when this lane next runs.

## Stale reading note corrected

Notes inside the register that said seven 2026-09-28 to 2026-09-29 strategy submissions remained `pending_review` are
stale. All of them were reviewed on 2026-09-29 and 2026-09-30; after this reply the queue holds nothing.

## Environment note (recorded as a concrete blocker for this cycle)

The canonical activity command `node scripts/monitor-state.js activity <worker> <state> "<summary>"` was refused by
this run's sandbox policy on every variant tried (worker id, state word, quoting and absolute path all varied), while
the read-only `monitor-state.js snapshot` form ran normally and the canonical `coordination.js reply` write ran
normally. No activity file was written by any other route, because re-implementing that writer outside its sanctioned
command would bypass the guard. The controller already records the run as `reviewing` with detail
`20260930-strategy-evening-save-031`, so the cycle's activity is visible to the monitor, but the worker-state activity
line for this cycle could not be issued and the completion `paused` report is subject to the same refusal.

## Boundaries held

No production, deployment, purchase, credential change, external message, warehouse mutation, Layer 1 or Layer 2
artefact, live workflow or holdout was touched. Controller and bridge code and settings were not modified, no other
coordinator process was started, no subagents were spawned and no escalation was self-approved. Unrelated canonical
local state and every worker checkout were preserved. No accuracy, edge, completion or deployment claim is made.

## Review-provenance block

- Submission: `20260930-strategy-evening-save-031`, mailbox SHA-256 `8b1c8d55ffbc3185adcab9743cdf44ee86c93bd4a25374a76ed16ec9a7651973` (6,657 bytes).
- Reply: `.local/orchestration/replies/strategy/20260930-strategy-evening-save-031.json`, 5,944 bytes, SHA-256 `06164e5288d14a4cf3988146b41893a382a5f737b92beba7b085b87488d5f83f`, decision `acknowledged`.
- Worker HEAD reviewed: `bcceb29a46d91bbb682fa8fb7399bfd40007d3b0` on `workers/strategy-advisory-20260920` (documentation-only; deliverable commit remains `1c2678b`).
- Queue after this cycle: `pending` 0.