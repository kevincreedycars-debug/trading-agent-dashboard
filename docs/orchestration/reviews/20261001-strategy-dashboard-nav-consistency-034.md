# Strategy 034: the navigation-consistency request - measured correctly, superseded by 035

Reviewed on 2026-10-01 from the canonical checkout `D:\trading-agent-dashboard-codex` by the coordinator lane.
Submission `20261001-strategy-dashboard-nav-consistency-034`, mailbox SHA-256
`15050acb053e1895b8645b0859fe6064f971de82638e7813451b7f57b0e985b9`, reproduced independently from the immutable
inbox file (6,332 bytes) and equal to the requested hash. Reply published at
`.local/orchestration/replies/strategy/20261001-strategy-dashboard-nav-consistency-034.json` (3,251 bytes, SHA-256
`3d8563348b93725c40b8c97822a5304b2b5d071040b5ffed6825663c02ed8583`), decision `acknowledged`, closed as superseded.

This item and submission `20261001-strategy-nav-answers-notify-035` (mailbox
`9e573ba7a09d989a5f17bbfde97f27dd8016e34b492a439a8fdb3329abddab79`) are one queue item: -034 is the measured
request, -035 is its materially revised current revision under a new ID as the assignment requires. -034 must not be
resubmitted; any further change goes in a new ID again. Neither reply implements anything: no page, stylesheet,
script, guard, template, generator or data artefact was touched, no lane was opened, no worker status was altered
and nothing was published, copied or merged.

## What the submission is

A queue request from the user's own words (`queue up the next work for the coordinator to add to the dashboard and
make sure all pages across the dashboard have the same header and side bar menu`), written as
`docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md` sections 1-11, with the served pages measured read-only from
`origin/main` blobs and five couplings written out: the rail entries are `button.tab-button[data-tab]` driven by
`script.js`; the draft page's guard forbids any external reference; four gold pages are generated from
`backtester/templates/*`; the draft page is a light theme among dark ones; and the look is already centralised in the
published `styles.css`, so the work is markup plus a link, not new CSS.

## Independent verification (reproduced, not trusted)

Measured read-only from the canonical checkout against `origin/main`, which is now `104716a` (the Dashboard Writer's
`2026-10-01T13:08` publish) rather than the `1f82c55` the envelope measured. On that moved base every page-by-page
figure the envelope reports holds unchanged: `dashboard-northstar.html` 5,002 bytes, `standing-dashboard.html` 8,957,
`gold-direction-scorecard.html` 143,102, `gold-backtesting.html` 292,270, `gold-backtest-outcomes.html` 19,186,
`gold-factor-wip.html` 21,281 and `backtest-flow.html` 18,402 bytes, with `index.html` alone carrying
`header.topbar` and 11 `side-rail` references while the other seven carry none.

- **One number is corrected, and it is immaterial to the route:** five of the eight root pages carry no
  `styles.css` reference (`index.html`, `dashboard-northstar.html` and `standing-dashboard.html` do), not the six the
  envelope reports. `backtest-flow.html`'s only `link` elements are two Google Fonts preconnects and the four gold
  pages carry no `link` element at all. Recorded because this review checks numbers rather than repeating them.
- **The guard coupling is confirmed exactly as stated:** `backtester/tests/gold_factor_wip_dashboard_link.browser.test.js`
  line 44 asserts `page.locator('script, link, img, iframe').count()` is 0 on `gold-factor-wip.html`, so an injected
  `nav.js` or a `styles.css` link on that page fails its own guard and its header and rail must be inline markup.
  That is the strongest support for the advised route N1.
- **Scope:** the changed set at `372bcf8` is `docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md`,
  `docs/strategy/GOLD_TABS_BUILD_BRIEF.md` and `docs/strategy/CONVERSATION_NOTES.md`; the worktree is clean and no
  code, test, dashboard page, guard, generator, data artefact, register entry or other worker checkout is in it.

## Decision

`acknowledged`, superseded by -035, which carries the adoption, the two user answers (same theme everywhere; after
the gold page release) and the route decision (N1). The measurement body of -034 stands as the record the -035
revision builds on.
