# Current task

Hold at the completed 28-factor stage and take the one outstanding prospective envelope.

`gold-coverage-025` was reviewed and accepted on 2026-09-25 (mailbox `a1543786...` reproduced, reply
`bd4804c1...`, review `docs/orchestration/reviews/20260925-gold-coverage-025.md`, a controller-locked run
separate from authorship), so the plain-English verdict page is delivered: one additive file,
`docs/GOLD_BACKTEST_VERDICT_20260925.md`, 59 lines and 518 words, sha256 `7198e24e...`, committed as `65e8b3a4`
from base `cdd350af`. Every number in it was verified against the accepted artifacts and every accepted
artifact of 019 through 024 stays byte-identical. The page currently exists only in the Gold worker checkout
(`.local/worktrees/gold-research`, branch `workers/gold-research-policy-20260920`), not in this canonical
folder, because acceptance is not integration.

Nothing in the circuit is accuracy, ranking, timing or edge evidence, and none is possible from spent
intervals; rev1, rev2 and rev3 are spent and immutable, so the batch must not be re-run and no ranking may be
presented as a result. The five declared research definitions (`fed_bias`, `inflation_signal`,
`risk_headline_context`, `equities_regime`, `growth_regime`) are not live Layer 1 fields.

The only outstanding obligation is the 022 item A observation envelope for the `2026-09-28T14:00:00Z|gold|entry`
identity, due at or after the `2026-09-28T16:00:00Z` lane close, delivered from the worker's ignored `tmp/` as
one envelope before stopping. Because a reply or assignment notifies a worker bridge once per content version,
that envelope needs a fresh wake at or after the lane close - an operator resume of the Gold window or a later
coordinator event. The register keeps `gold-coverage-025` published at status exactly
`instructions_published_awaiting_worker` for exactly that reason.

The live window needs no action: exactly one scheduled task, `GoldQualificationWindowTick018`, keeps capturing
through the v2 wrapper and must not be disturbed. It was observed read-only in this review (Ready, one `PT10M`
trigger, `LastRun` 20:46:01 local, `LastTaskResult` 0, zero missed runs). No prospective observation or outcome
may be read before `2027-03-25T15:00:00Z`.

One page was added on 2026-09-27 and changes nothing above: `gold-direction-scorecard.html` renders the accepted
direction check as a self-contained research surface (25 scored states, every hit rate beside its own drift floor, with
the unscored, neutral and unreadable states printed rather than hidden). It measures nothing new. The user authorised
publication on the evening of 2026-09-27 and chose the three-page scope, so the scorecard with its two sibling Gold
pages is public in production `main` `c91bd6f` behind a `Gold Direction` link on the dashboard; the deeper repo-relative
evidence links inside those pages stay local-only, and whether to publish those evidence artefacts is the part of the
publication decision that remains open.

Next: hold, and take the 022 item A envelope at the lane close. No further research is authorised. Two precise
unresolved decisions are the user's: whether to open another exploratory stage over the spent intervals, since
the undeclared `event_releases` cell at 40,324 would need a selection rule and the other horizons, context
fields and endpoint groups sit in the same already-consumed calendar; and whether to promote the accepted
verdict page from the worker checkout into this canonical checkout. The CRLF materialisation and the
accepted-inputs raw/LF digest asymmetry stay owned by the `backtester-spike` change request and are not to be
repaired here.