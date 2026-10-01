# Strategy 035: same theme everywhere, after the gold page - accepted as a queue item on route N1

Reviewed on 2026-10-01 from the canonical checkout `D:\trading-agent-dashboard-codex` by the coordinator lane.
Submission `20261001-strategy-nav-answers-notify-035`, mailbox SHA-256
`9e573ba7a09d989a5f17bbfde97f27dd8016e34b492a439a8fdb3329abddab79`, reproduced independently from the immutable
inbox file (4,488 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/strategy/20261001-strategy-nav-answers-notify-035.json` (3,353 bytes, SHA-256
`c6dffab6b2aa84acfd7ea2f79045c5644ab6990f59f58b9cc5eadc4877b06a15`), decision `accepted`.

Acceptance is of the advisory, its measurements and its record only: it implements nothing, edits no page,
stylesheet, script or guard, opens no lane, changes no worker status and creates no publish.

## What the submission is

The materially revised version of `20261001-strategy-dashboard-nav-consistency-034` under a new ID, carrying the
user's two answers verbatim (`same theme everywhere`; `after`): the dark header and the dark rail are carried on every
served page including the light `gold-factor-wip.html`, with no light variant; and the navigation-consistency change
is sequenced after the gold page release, so the fingerprint that change settles already holds the single `gold.html`
top-bar entry and no candidate revision 3 is needed. Both answers were written into
`docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md` in place, and the request is otherwise unchanged.

## Adopted into the dashboard queue

- **Route N1** - one canonical fragment injected as bytes at build time, so the served pages gain markup and no
  runtime script, and the draft page's zero-external-reference guard stays green.
- **Same theme everywhere** - the dark header and rail on all pages, the draft page keeping its pale body and inline
  markup. Recorded as the user's own words, not as inference.
- **Sequenced after the gold page release** - release first, this second, and the guard run as part of that change's
  acceptance.

The item is a queue entry, not a start. The queue order is the gold tabs release, then this. The movement-screen
measurement was not opened by this reply - opening lane `gold-declared-band-measurement-026` needs a register edit and
the user's word, and the standing Gold hold stands until it is opened.

## Independent verification (reproduced, not trusted)

- **The document reproduces.**
  `docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md` is 13,500 bytes, 153 CRLF, raw-byte SHA-256
  `f678f6229c8f90ef98ea7030c6edd5776bb7fe06cf76a2868651c227b20af25d` at HEAD `33a6d85`, against 12,444 bytes, 143
  CRLF, SHA-256 `36f875e05bb68f3b0c838643fa0dc5f8cc21597d88c59909e9e6e8069cdaf2f3` at `372bcf8`. Only the two answered
  sections moved, so the measured body is the one -034 delivered.
- **Scope:** the changed set at `33a6d85` is `docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md` and
  `docs/strategy/CONVERSATION_NOTES.md`; the worktree is clean; the branch is on origin at `33a6d85`.
- **The couplings carry,** including the guard coupling confirmed at
  `backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` line 44 (a count of 0 for
  `script, link, img, iframe` on the draft page) and the template coupling, and the page-by-page measurement
  reproduces on today's `origin/main` `104716a` exactly as recorded, with the one correction carried from the -034
  review: five, not six, of the eight pages carry no `styles.css` reference.

## Decision

`accepted` and adopted as above. What follows is the coordinator's work, not the worker's: the gold page release
first, then this navigation change under N1 with the byte-fingerprint guard written and run as part of its acceptance
- both are dashboard production changes taken with the user's go-ahead. No production change was made by this review
cycle.
