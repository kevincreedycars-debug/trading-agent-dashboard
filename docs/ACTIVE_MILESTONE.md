# Active milestone

Current milestone: keep the accepted Gold prospective qualification window capturing, on
one installed task, while every evaluation stays sealed.

Status: assignment `gold-qualification-window-activation-018` was delivered at clean
worker `67f51e8` (three files, +204/-0) and accepted by an independent coordinator review
at 2026-09-24. The real lane is live: exactly one scheduled task
`GoldQualificationWindowTick018` is `Ready`, runs the accepted 017 runner through the
encrypted credential runner with only `FRED_API_KEY` and `OANDA_API_TOKEN`, repeats every
ten minutes, and has already run a real tick (anchor 1 `anchor_one_left_blocked`, anchor 2
features `already_settled`, nothing backfilled). Three real anchor-2 pre-anchor feature
captures are sealed (`302e4a26`, `58ece552`, `c51ad9b9`); 017 remains accepted and every
accepted artifact is byte-identical.

Next immediate action: let the installed task capture the remaining anchor-2 lanes (entry
`2026-09-25T14:00:00Z`-`16:00:00Z`, exact lane `15:00:00Z`-`16:00:00Z`), then verify those
seals and the tick health. Gold holds with no new work until a new versioned assignment.
