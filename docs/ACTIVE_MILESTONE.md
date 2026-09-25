# Active milestone

Current milestone: repair the live Gold entry lane and re-accept the stale shortlist input binding
(`gold-coverage-021`), while the accepted window keeps capturing unattended.

Status at 2026-09-25 19:00 local: `017`, `018` and `019` are accepted; `020` is closed
changes-requested with its blocker upheld and its verified items 1-5 standing. `021` is published and
awaiting pickup, register status `instructions_published_awaiting_worker`, baseline `35ad4bb5`, and the
register records the delivery of `020` at that commit. Two live-lane facts drive the urgency: the entry
capture always requests a range ending up to an hour in the future, which OANDA refuses with HTTP 400
(`Invalid value specified for 'from'. Time is in the future`), and the sealed blocked attempt at
`2026-09-25T14:06:03.033Z` permanently consumed `2026-09-25T14:00:00.000Z|gold|entry`; the first
still-reachable anchor is `2026-09-28T14:00:00Z`. Anchor 1 stays permanently missed and sealed
`blocked_no_reschedule`, the three sealed anchor-2 captures are unchanged at `302e4a26`, `58ece552` and
`c51ad9b9`, and `GoldQualificationWindowTick018` keeps ticking every ten minutes as the only capture
path (`Ready`, result `0`, zero missed runs). The stale shortlist binding is re-accepted in
LF-normalised form after the coordinator proved outcome-identity in
`tmp/coordinator-verify-shortlist-020-20260925` (identical four ids, order, pool 2548/255, counts
255/4/251, byte-identical audit entries, frozen artifact `ffa69b30...` unchanged). The unattended
reviewer is enabled and running again after its 020 run timed out and disabled dispatch. Mailbox empty,
zero validation errors.

Next immediate action on resume: confirm Gold picked up `021` from its own activity record, then review
the v2 entry-eligibility guard, the task-action swap and verification tick, and the normalised binding
re-acceptance at 7/7. The capture task continues on its own and must not be disturbed.
