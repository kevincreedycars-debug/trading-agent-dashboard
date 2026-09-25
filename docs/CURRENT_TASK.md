# Current task

Verify the repaired live Gold entry lane at its first reachable anchor, and keep the accepted
prospective qualification window capturing unattended through the accepted v2 path.

`gold-coverage-022` item B was reviewed and accepted on 2026-09-25 at clean `134e8148`: the two
deferred 020 coverage-test expectations are closed (the coverage class asserted absent with
`hasOwnProperty` plus a tally reconciliation to `declared_inventory_total`, and the `fed_bias`
missing-series verdict pinning `registry_coverage_status`, `reason` and `series_id` with
`DFEDTARU`), the coverage suite is 24 of 24, and the two changed files are test-and-documentation
only. Item A stays open, observation only and never triggered: the first reachable anchor is
`2026-09-28T14:00:00Z` with its entry lane `15:00-16:00Z`, so no live entry proof can exist before
then.

The live window needs no action: exactly one scheduled task, `GoldQualificationWindowTick018`,
captures the declared lanes every ten minutes through the v2 wrapper and must not be disturbed. Its
observed state is unchanged (`Ready`, action the v2 wrapper, one `PT10M` trigger, `IgnoreNew`,
`StartWhenAvailable` true, battery flags false, `Last Result` `0`, zero missed runs, 72
metadata-only blocks with `attempted 0` and an empty open set). Anchor 1 stays blocked and the
anchor-2 entry identity `2026-09-25T14:00:00.000Z` stays sealed as a blocked attempt
(`provider_error`, HTTP 400, no reschedule); the three sealed anchor-2 captures are unchanged at
`302e4a26`, `58ece552` and `c51ad9b9`; no directory exists for
`2026-09-28T14:00:00.000Z|gold|entry`; and no prospective observation or outcome may be read before
`2027-03-25T15:00:00Z`.

Next: at or after the `2026-09-28T16:00:00Z` lane close, review Gold's one post-close envelope for the
repaired entry lane. No new assignment is published - item B is closed and item A is blocked only on
wall-clock - and the register keeps status exactly `instructions_published_awaiting_worker`.
Opening a fresh exploratory combination stage over the 28 measured variables remains an open user
decision and is not authorized.
