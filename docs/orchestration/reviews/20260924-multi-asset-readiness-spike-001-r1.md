# Multi-asset one-day readiness spike revision 1: changes requested

Reviewed interactively on 2026-09-24. Submission
`20260924-multi-asset-readiness-spike-001-r1`, mailbox SHA-256
`0c41e8d93dd9c0322611b1f59867cbc2aa609148226023d97e56f927a06efb1c`.
Worker branch `spike/multi-asset-readiness-20260924` clean at `927f799`; two commits
adding exactly the ten disclosed files, and `git diff --name-status 6cbbd01 927f799` is
additions only, so no accepted artifact was modified.

## What is verified and stands

- Focused `asset_batch_runner.test.js` passes 10/10 on coordinator rerun.
- `--benchmark --real --workers 1,2,4,8 --candidates 2548 --anchors 965 --shard-size 128`
  reproduces logical equivalence at every worker count with aggregate checksum
  `727126fee998bbb97cf7326c53b043f4727f048a9651598ddcb58e32284e99e4`, chosen
  concurrency 8, measured wall 706 ms.
- `--rehearse --assets gold,usd,eur,nq,btc --asset-concurrency 4` runs all five ready
  assets in one pass, each `parity_ok` through its own real checker and `budget_ok`.
- `--acquire`, `--network`, `--credentials`, `--warehouse`, `--publish`, `--schedule`,
  `--install`, `--evaluate` and `--outcome` each exit 1 with `Forbidden spike option`.
- `asset_adapters.js` performs no network call, writes only inside the caller's
  directory, binds committed fixtures and refuses un-onboarded assets (gbp, silver, wti).
  Records are fixture-derived and the document says so: this is a platform and
  determinism rehearsal, not an accuracy or edge measurement.

## Why changes are requested

1. **The documented local suite was not run for this assignment and its omission hid a
   real platform defect.** Coordinator rerun of `npm test` in this worktree reports 469
   pass and 37 fail. The dominant cause is not the spike: hash-bound inputs are
   git-materialised with CRLF in a fresh worktree, so their raw-byte digests change.
   Measured evidence:
   - `backtester/registries/gold_qualification_window_manifest.v1.json` is 14,058 bytes
     with 0 CRLF (`sha256 15cd0606...`) in the registered Gold worktree but 14,387 bytes
     with 329 CRLF (`sha256 3eb9ef07...`) here, so the accepted gate fails closed with
     `Accepted manifest drift`;
   - the frozen batch registry materialises as
     `8ab096e151c3b00ed07768e8037c5920f2bfc630335007868b739e4231b4d213` instead of the
     approved `7e2bcff68a6054e7f7635225e06ed80a1557e6525f8a068dfa926ccf142759a2`;
   - 15 of this worktree's registries carry CRLF against 7 in the Gold worktree.
   This matters to the milestone itself: a rehearsal, an adapter or a freshly created
   worktree cannot be expected to reproduce an accepted digest while the materialisation
   is not stable, which is exactly the "one batch in one day" path.
2. The submission therefore also needs the local-suite disclosure its assignment
   required.

## Required, bounded corrections

- Normalise the hash-bound inputs to one stable materialisation (a `.gitattributes`
  entry setting `eol=lf` for the hash-bound registries and fixtures plus an explicit
  renormalisation), and add a focused regression test that fails when a hash-bound
  input's raw digest no longer matches its recorded digest.
- Reconcile and disclose every recorded digest that was computed from a CRLF copy. Do
  not change a recorded digest silently; where a digest must be re-recorded, do it in
  one disclosed revision.
- Demonstrate in a fresh worktree that the accepted Gold gate binds the manifest and
  that the Gold tests failing here now pass.
- Then re-run the documented local suite in this worktree, disclose exact counts and
  failures, and submit a new revision.

No research rule changes, no acquisition, no warehouse, Layer 1, live workflow,
dashboard, scheduler or production action, and no modification of accepted Gold evidence.

## Answers to the submission's questions

- Keep the stand-in kernel, clearly labelled and never usable as a gate result or
  evidence, with the real fixture-parity path as the rehearsal default; retire it in a
  later bounded step once every ready asset runs the real path.
- Group the USD/EUR/NQ/BTC session-policy and outcome-definition registries into one
  bounded assignment with one registry file per asset and one reviewable commit. GBP
  onboarding and any Silver/WTI work stay separate and unauthorised until their data and
  timing contracts exist.

## Status

The spike's delivered scope stands as verified above; the revision is requested for the
byte-stability fix and the missing suite disclosure. Acceptance here would not mean
deployment, and no asset is claimed one-day ready until the rehearsals run on consumed
data under a separate assignment.
