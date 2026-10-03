# Coordinator handover, 2026-10-03

Prepared by worker `strategy` (`strategy-advisory-001`) for the dashboard lane and the coordinator, on the user's own
word this session. Filed as submission `20261003-strategy-gold-release-and-helper-go-ahead-036` (mailbox sha256
`2a8606a092885d2207436c485f7ed5e35203b5ad98fd2ecbf0c032f05975655e`).

## Authority

The user was asked, in plain words, at the close of a status check:

> "do you want me to tell the coordinator to clear the frozen helper and publish the gold page now? Default is yes, go
> ahead - and the data refresh needs your word at the same time."

The user answered **"yes"**. That one word authorises the three actions below and nothing beyond them. It does not
authorise a new assignment, a new lane, a page redesign, a navigation change, a credential, a warehouse action or any
trading authority. Reading it back: (1) clear the dead lock and restart the helper, (2) publish the gold release now,
(3) refresh the live data panel. The user's earlier one-line "okay push everything" (submission
`20261001-strategy-user-goahead-publish-033`, acknowledged) remains the broader go-ahead for the gold release; this
turn supplies the missing piece, the user's word for the refresh and for the lock clearing.

## Order, and why

1. **Clear the dead lock and restart the helper first.** Nothing reviews or publishes while the helper is frozen, so
   this is the enabling step.
2. **Publish the gold release second.** It is the item both the register and the accepted reviews have held as next
   since 2026-10-01, and it must land before the navigation change by the user's own answer "after".
3. **Refresh the data third (or in parallel).** It is independent of the release and takes minutes.

## Task 1 - clear the dead lock and restart the background review helper

Verified this turn, read-only, and unchanged since 2026-09-30:

- `.local/orchestration/controller/run.lock` still names PID `24000` and submission
  `20260930-strategy-evening-save-031`.
- `.local/orchestration/controller/status.json` still reads `"state": "reviewing"`, `"detail":
  "20260930-strategy-evening-save-031"`, `"pid": 24000`, `"updated_at": "2026-09-30T21:02:00.315Z"` - roughly three
  days stale.
- The process is gone and `node scripts/monitor-state.js snapshot` reports the controller `offline`.

What to do: clear the stale lock and return the controller to an idle state, then restart the helper so new filings are
picked up. This is coordinator housekeeping on a process that no longer exists; it cannot disturb the strategy lane's
worktree, its notes or its mailbox. Confirm the outcome by re-running `node scripts/monitor-state.js snapshot` and
`node scripts/coordination.js check` and reporting the controller state. Do not touch any other worker's files, any
accepted artifact or any production file while doing this.

## Task 2 - publish the gold release

Follow `docs/strategy/GOLD_TABS_BUILD_BRIEF.md` (this worktree) steps **E1-E5** exactly. The short form, with the two
places a copy can slip:

- **E1 - add the page.** Copy `docs/strategy/GOLD_TABS_SHELL_CANDIDATE.html` (revision 2) to the site root as `gold.html`,
  byte for byte, from the worktree file - **not** from `git cat-file`, because git stores the LF blob (5,733 bytes) while
  the file on disk is the recorded 5,839-byte CRLF form. Verified this turn: 5,839 bytes, 106 CRLF, 0 bare LF, sha256
  `de60c2b7c452aa74ac282d475707e15d2d68977c77c4cd2a505cb4d205e64da6`, at HEAD of the strategy worktree, unchanged from
  the version already checked and approved. Nothing needs rebuilding.
- **E2 - one top-bar entry, on the file the site actually serves.** Edit the **published** `index.html` (start from
  `origin/main`), remove its two gold links and add one: `<a class="topbar-link" href="gold.html">Gold</a>`. Do **not**
  copy the repository checkout's `index.html` over the published one - they are different files and the checkout copy is
  missing the live Silver, WTI, GBP and Live Trading work. Leave the in-page `Gold` tab button alone. One deliberate
  consequence: the outcomes page gains its first bar route, which is why the outcomes guard rewrite in E4 is
  load-bearing.
- **E3-E5 - the three hop guards.** Each guard now goes bar link then tab; assertions keep the same values, so the guards
  get one step longer rather than weaker. Per-file changes are in the brief, section 3.
- **Draft revision 2 in the same change.** If revision 2 of the draft page is published with this release, the pinned
  count in `backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` must move from `/40 of 50 answered/` to
  `/50 of 50 answered/` **in the same change as the copy**, or the tree is left with a failing guard and there is no CI
  to catch it.
- **Acceptance run** (hand-run, no CI): the five browser guards, or `node scripts/test-local.js browser`. Run them in a
  tree whose `index.html` carries the one-entry bar, or bring the checkout copy's bar to the same state in the same
  change; a green guard about a file the site does not serve is not an acceptance. Then, by hand in a browser: one gold
  entry; it opens `gold.html`; all four tabs show the right page; `gold.html#outcomes` reopens that tab; the arrow keys
  move the selection; and the three old addresses plus the draft page still load.
- **Materialisation, the one choice to state out loud.** The served bytes differ by line ending: the repository stores
  the LF blob (5,733 bytes) while the worktree file is 5,839 bytes of CRLF. The consistent route is the one revision 1
  of the draft page already took - let the repository's line-ending setting store the LF form and record the served byte
  count and hash. State which one went live; that is the fingerprint a later check must reproduce.
- **Rollback** is in the brief, section 6: remove `gold.html`, restore the bar lines, revert the three guard hops. The
  four gold pages, their generators, artifacts and the shared stylesheet are untouched, and the old addresses never stop
  working.

## Task 3 - refresh the live data panel

The panel has aged out of its freshness window and reads stale again. The standing rule is that a fresh reading needs
the user's word and a coordinator re-publish, never a lane's own push; the user's "yes" above is that word. Trigger the
existing, documented path - the same call the dashboard's own refresh control makes:

```
POST https://silver17.app.n8n.cloud/webhook/master-orchestrator-dashboard-refresh
```

Configuration and the poll contract are in `data/workflow-control.json`: method `POST`, `no-cors`, status from
`data/workflow-status.json`, poll every 10s, first poll 180s after the trigger - do not infer completion from a countdown,
read the status file. Verify it the way the 2026-10-01 run was verified: `status: success`, `failed_step: null`,
`message: Manual Refresh Complete`, a fresh `last_updated_et` in `data/layer1.json` with eight distinct `sealed_at`
values. Report what the live panel then shows.

## Still queued after this, not covered by the go-ahead

- **Navigation consistency** - route N1, same dark header and rail on every served page, the user's own answer
  "same theme everywhere", sequenced "after" this release. Request and measurements in
  `docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md`; adopted in the accepted review of
  `20261001-strategy-nav-answers-notify-035`.
- **Movement-screen measurement** - recommended lane `gold-declared-band-measurement-026`, still unopened; it is the
  only thing that can put real factor numbers in the Factor tables tab.

## What this worker did, and did not do

Advice only. This worker's write scope is `docs/strategy/` in
`D:/trading-agent-dashboard-codex/.local/worktrees/strategy`; it cannot publish a page, edit the bar, clear a lock or
trigger a refresh. This turn it changed only `docs/strategy/CONVERSATION_NOTES.md` (the dated go-ahead entry) and added
this file, committed on `workers/strategy-advisory-20260920` and pushed to origin at `5e76c53`. No page, bar, guard,
generator, stylesheet, data artifact, number, lock, controller file or register entry was touched, and nothing is live
as a result of it.
