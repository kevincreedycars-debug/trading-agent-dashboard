# Current task

The Gold prospective qualification window runs unattended, and its accepted declarations are being
reconciled. `gold-coverage-completion-019` was reviewed and accepted on 2026-09-25 at clean `3240f598`:
all 28 declared variables are measured, the 21 earlier blocks are byte-identical, the legacy `dxy_*`
ids are retired without back-fill, and section 8 hardened the installed capture task. The next bounded
assignment, `gold-coverage-020`, is published and awaiting Gold: correct the live-input inventory stale
`research` statuses for the newly measured ids and its retired `dxy_*` F2 vocabulary, write
`gold_remaining_source_audit.v2.json` (v1 byte-identical), revise the `fed_bias` and `inflation_signal`
source mapping in the horizon-context registry, and prove from the revised declarations that the
accepted gate can resolve a revision-8 candidate atom - data-only, stopping with a blocker if a code
change would be required.

The live window needs no action: exactly one scheduled task, `GoldQualificationWindowTick018`, captures
the declared lanes every ten minutes and must not be disturbed; anchor 1 stays blocked and the anchor-2
entry identity `2026-09-25T14:00:00.000Z` was sealed as a blocked attempt (`provider_error`, HTTP 400,
no reschedule); no prospective observation or outcome may be read before `2027-03-25T15:00:00Z`.

Next: Gold picks up `gold-coverage-020` (status `instructions_published_awaiting_worker`) and reports
the reconciliation for review. Opening a fresh exploratory combination stage over the 28 measured
variables remains an open user decision and is not authorized.
