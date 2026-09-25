# Active milestone

Current milestone: verify the repaired live Gold entry lane at its first reachable anchor
(`gold-coverage-022` item A), while the accepted window keeps capturing unattended.

Status at 2026-09-25 late evening: `017`, `018`, `019`, `021` and `022` item B are accepted; `020`
is closed changes-requested with its blocker resolved by 021 item B. `022` item B is accepted at
clean `134e8148` from base `a9bb3654` (reply `44467da1...`, review
`docs/orchestration/reviews/20260925-gold-coverage-022-r1.md`): the two deferred 020 coverage-test
expectations are closed, the coverage suite is 24 of 24, exactly two test-and-documentation files
changed, and no test file sits among the frozen 014 manifest's eight bound paths, so the accepted gate
cannot move. Item A remains observation only: the first reachable anchor is `2026-09-28T14:00:00Z`
with entry lane `15:00-16:00Z`, so no live entry proof exists yet and none has been implied.
`GoldQualificationWindowTick018` keeps ticking every ten minutes as the only capture path through the
v2 wrapper (`Ready`, `Last Result` `0` at `19:06:01` local, zero missed runs, 72 metadata-only
blocks, four of them v2, `attempted 0` and an empty open set), the evidence root still holds exactly
four directories, and no directory exists for `2026-09-28T14:00:00.000Z|gold|entry`. No new
assignment is published; the register keeps status exactly `instructions_published_awaiting_worker`
for `gold-coverage-022`. Opening a fresh exploratory combination stage over the 28 measured variables
remains an open user decision and is not authorized.

Next immediate action on resume: at or after the `2026-09-28T16:00:00Z` lane close, review Gold's one
post-close envelope for `2026-09-28T14:00:00.000Z|gold|entry` (pre-15:00Z `not_yet_eligible` rows
with no provider call and no directory; the in-lane outcome as one sealed capture with an H1 entry
candle at or after the anchor and a request end within the observed clock minus the one-hour OANDA lag,
or one sealed blocked attempt with `rescheduled` false and the exact reason code; the post-close
`already_settled` state; the block count, task settings and `LastTaskResult`; and the byte-identity
of the four preserved artifacts). The capture task continues on its own and must not be disturbed.
