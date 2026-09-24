# Gold qualification-window-activation-018 revision 1 accepted

Reviewed interactively on 2026-09-24. Submission
`20260924-gold-qualification-window-activation-018-r1`, mailbox SHA-256
`c74356fe08db726ed92b99d447d3ffb33a192f5f82f72271314a0f919ee3155e`. Worker branch clean at `67f51e8` from accepted 017 base `6cbbd01`;
one commit adding exactly the three disclosed files (+204/-0).

## Independent verification

- `git show --stat 67f51e8` returns only the disclosed additions: the tick driver
  (125 lines), the scheduled wrapper (15) and the focused test file (64). Working tree
  clean; no accepted 014/015/016/017 artifact is modified.
- Coordinator reruns: the focused driver file passes 5/5. The full local suite reports
  508 tests / 504 pass / 4 fail: the three console-width `secret_scanner.test.js` cases
  (393-395) plus the pre-existing dashboard publish-window case 482. All four are
  environment-dependent and untouched by this commit (the worker's own run reported five,
  adding case 397).
- Exactly **one** scheduled task matches gold/qualification/tick:
  `GoldQualificationWindowTick018`, state `Ready`, action
  `powershell -NoProfile -ExecutionPolicy Bypass -File <worker>/backtester/scripts/run_gold_qualification_window_tick.ps1`,
  time trigger starting 2026-09-24T21:06 local and repeating every `PT10M`. No service,
  daemon, login-startup entry or second capture path exists.
- The wrapper calls the encrypted runner with exactly `FRED_API_KEY,OANDA_API_TOKEN`,
  appends metadata-only output to `backtester/tmp/gold-qualification-window-018/tick.log`
  and exits with the runner's code.
- The driver spawns the accepted 017 activation CLI for every identity, holds an
  exclusive `tick.lock`, refuses the documented option set, keeps evidence inside the
  worker root, skips the six anchor-1 identities as `anchor_one_left_blocked`, skips
  settled identities and defers past `--max 12` attempts in a tick. It never writes an
  envelope itself and uses the accepted library's exported `captureInterval`, so the
  lanes are the accepted lanes.
- A real scheduled tick has run: `tick.log` at `2026-09-24T20:06:27Z` records
  `attempted 0 / settled 0 / blocked 0`, anchor 1 rows `anchor_one_left_blocked` and the
  three anchor-2 features `already_settled` - no backfill and no re-attempt.
- Three real prospective captures are sealed for anchor 2 (`2026-09-25T14:00:00Z`):
  envelopes `302e4a26...` (DFII10), `58ece552...` (DGS2) and `c51ad9b9...` (VIXCLS);
  coordinator recomputation reproduces the disclosed hashes. Indexes are metadata only -
  identity, hashes, coverage, counts, parser version, provenance and the accepted 014
  manifest / 015 contract bindings - and `url_without_key` carries no credential. The
  DFII10 capture retrieved `2026-09-24T19:57:43Z` covers `2026-09-15` to `2026-09-22`
  with 6 observations and availability strictly before the anchor.
- Anchor 1 remains blocked: no attempt, no capture, no reconstruction.
- No outcome, aggregate, qualification, evaluation, warehouse, Layer 1, live workflow,
  dashboard, integration, deployment or production action occurred.

## Decision

Accepted as the window-activation checkpoint: the accepted inert package is now an
operating, single-path, 10-minute capture lane with reason-coded blocked attempts and no
backfill. Acceptance is not deployment of a trading result, and no outcome has been read.

Notes: the sealed artifacts carry the `gold-qualification-activation-package-017`
assignment label because the accepted 016/017 sealer is reused unchanged; that is
provenance, not scope drift. Health may stay log-only: monitor activity is for agents
reporting their own work, so the scheduled task must not write heartbeats. The driver's
fail-closed stop on a same-identity retry is correct; recovery stays a separate reviewed
attempt that references the failed immutable one.

Next action for Gold: hold. The task runs the window; report a blocked envelope if a lane
is missed or the task fails repeatedly, and start no other work until a new versioned
assignment is published.
