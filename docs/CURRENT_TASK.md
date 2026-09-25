# Current task

The Gold prospective qualification window runs unattended through the accepted and repaired v2 capture
path, and the accepted declarations are reconciled. `gold-coverage-021` was reviewed and accepted on
2026-09-25 at clean `a9bb3654`: the live entry lane is repaired by a versioned v2 activation path (no
future-dated provider request, refused before any call without consuming the identity), the installed
task action now runs the v2 wrapper, and the stale shortlist input binding is re-accepted in
LF-normalised form after the outcome-identity proof. The next bounded assignment, `gold-coverage-022`,
is published and awaiting Gold: close the two deferred coverage-test expectations the 020 review
recorded, and observe (never trigger) the repaired entry lane at its first reachable anchor
`2026-09-28T14:00:00Z`, whose entry lane runs `15:00-16:00Z`.

The live window needs no action: exactly one scheduled task, `GoldQualificationWindowTick018`, captures
the declared lanes every ten minutes through the v2 wrapper and must not be disturbed; anchor 1 stays
blocked and the anchor-2 entry identity `2026-09-25T14:00:00.000Z` stays sealed as a blocked attempt
(`provider_error`, HTTP 400, no reschedule); the three sealed anchor-2 captures are unchanged at
`302e4a26`, `58ece552` and `c51ad9b9`; and no prospective observation or outcome may be read before
`2027-03-25T15:00:00Z`.

Next: Gold picks up `gold-coverage-022` (status `instructions_published_awaiting_worker`) and reports
for review. Opening a fresh exploratory combination stage over the 28 measured variables remains an
open user decision and is not authorized.
