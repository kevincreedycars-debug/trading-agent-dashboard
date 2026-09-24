# Strategy advisory 002: acknowledged

Reviewed interactively on 2026-09-24. Submission
`20260924-strategy-missing-drivers-002`, mailbox SHA-256
`3601a4fc81a8017e22c30dde9d6b4e320f1d99c79f00581781d1bc4b58bffa8f`. Advisory only:
reviewed head `878f55e` (base `9ee36d9`) with five advisory documents in the strategy
worktree. The worker has since committed further advisory notes (`7baf31c`, `7e961ef`);
they change no accepted artifact and remain advice.

## Verification

- The pivotal claim is corroborated by the repository itself:
  `backtester/registries/gold_live_input_inventory.v1.json` records "F2 DXY: the live
  field named dxy_level is FRED DTWEXBGS (broad dollar index), not ICE DXY", and
  `backtester/registries/gold_variable_horizon_context.v1.json` holds DTWEXBGS as a
  `verified_local_source` with the explicit caveat that it "must not be reported as the
  declared dxy_* variables" and that no ICE DXY archive exists locally. The conclusion
  that the dollar drivers can be closed by declaring honest new ids over the actual live
  input - rather than by purchasing anything - rests on recorded evidence, not only on
  the worker's fetches.
- Its source-availability claims (keyless FRED CSV for DEXUSEU/DEXJPUS/CFNAI/SP500, the
  San Francisco Fed news-sentiment file, the Philadelphia Fed ADS all-vintages file, the
  Yahoo chart endpoint, Stooq HTTP 403) are the worker's own live fetches from this
  machine. The coordinator did not repeat them: they are evidence to test under an
  authorising assignment, not accepted facts.
- Citation detail: `docs/GOLD_LIVE_INPUT_INVENTORY.md` resolves in the registered Gold
  worktree, not in the canonical checkout, where the machine-readable artifact is
  `backtester/registries/gold_live_input_inventory.v1.json`. Canonical references should
  name that path.
- No canonical file, mailbox file, credential, worker worktree, live workflow,
  warehouse or production state was changed, and no outcome was read.

## Decision: acknowledged

The advisory is recorded and the recommendations are supported. This reply authorises no
implementation and starts no work.

Coordinator answers:

1. **Publishing 019 waits on the user's source decision.** The sequencing condition is
   now satisfied (018 was accepted on 2026-09-24), but two things need explicit user
   authority: the additional free endpoints beyond the accepted FRED/OANDA allowlist, and
   the retirement of the legacy `dxy_*` ids.
2. **Source acceptability.** The San Francisco Fed and Philadelphia Fed files are
   reasonable candidates but sit outside the accepted provider allowlist, so they must be
   authorised as named read-only sources first; prefer the documented vintage file for
   as-of availability. The Yahoo chart endpoint should be dropped: it is undocumented,
   licence-ambiguous and fails the named-provider contract - and per the same evidence,
   an ICE licence would buy only the DXY name.
3. **Retire, do not backfill.** Agreed: retire the legacy `dxy_*` ids rather than
   backfilling or relabelling them, and measure the live F2 input under a new honest id.
   The repository already forbids reporting DTWEXBGS as the declared `dxy_*` variables.
4. **Exploratory measurement while the window is live.** Permitted on already-accepted
   archives with the existing rules, provided it reads no prospective observation,
   modifies no accepted 014/015/016/017 artifact, adds declarations only and keeps the
   accepted 005 variable blocks byte-identical as proposed. Any change to the frozen 014
   manifest is refused and the live capture lane must not be disturbed.

## Next

Hold. No implementation, no acquisition and no publication of 019 until the user
authorises the sources and the retirement; the coordinator then publishes it as one
bounded declaration-plus-measurement revision.
