# Active milestone

Current milestone: complete Gold's declared 28-variable coverage while the accepted
prospective window captures unattended.

Status: `gold-coverage-completion-019` is published from accepted `67f51e8`; its wake is
queued behind the worker bridge's 12-per-day limit and is delivered after 01:00 local, or
sooner if the operator pastes the agent prompt. The live lane needs no action: exactly one
scheduled task `GoldQualificationWindowTick018` is `Ready` on a `PT10M` trigger, has run
real ticks with anchor 1 `anchor_one_left_blocked` and anchor 2 features `already_settled`
and nothing backfilled, and three real anchor-2 captures are sealed. 018 was accepted at
`67f51e8`.

Next immediate action: Gold declares the seven new ids, acquires the four free keyless
sources read-only and measures them on the accepted historical path; the coordinator
reviews that evidence while the capture task continues untouched. Anchor 2's entry lane is
`2026-09-25T14:00:00Z`-`16:00:00Z` and needs no manual action.


Waiting on the operator, not the coordinator: the registered second adviser (`strategy-2`) is
published with status `instructions_published_awaiting_worker` and revision 2 names DeepSeek
explicitly. It starts when the user opens `tools/strategy-node/StrategyLive.code-workspace`
and connects that window once. Publication is not pickup, and it does not change the immediate
action above.