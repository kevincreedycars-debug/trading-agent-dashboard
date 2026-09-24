# Gold qualification-activation-package-017 revision 1 accepted

Reviewed interactively on 2026-09-24 by a coordinator session that is not the
submission's author, as the overlap record requires. Submission
`20260924-gold-qualification-activation-package-017-r1`, mailbox SHA-256
`f3ac41d9572d27301862ac9284810da5b98c00c5d65739911793d03ac193bc74`.
Worker branch clean at `6cbbd01` from accepted 016 base `4eea9a8`; one commit
adding exactly the six disclosed files (+1067/-0) and no deletions.

## Independent verification

- `git show --stat 6cbbd01` returns only the disclosed additions:
  `backtester/lib/gold_qualification_activation.js`,
  `backtester/lib/gold_qualification_provider_client.js`,
  `backtester/registries/gold_qualification_scheduler_package.v1.json`,
  `backtester/scripts/run_gold_qualification_activation.js`,
  `backtester/tests/gold_qualification_activation.test.js` and
  `docs/GOLD_QUALIFICATION_ACTIVATION_RUNBOOK.md`. Working tree clean; no dirty
  files and no deletions.
- Coordinator reruns: the focused activation file passes 13/13. The full local
  suite run in the worker tree reports 503 tests / 500 pass / 3 fail, the three
  being `backtester/tests/secret_scanner.test.js` 388, 389 and 390 - the
  pre-existing console-width cases already tracked as a separate register backlog
  item, in a file this commit does not touch (the count varies with console width;
  the worker reported four).
- Evidence hashes reproduce: `smoke-summary.json` `18cbe5ae0955f5336ec098739095853eef959bac0e6b3126e7085297353dbdaa`
  and `fred_dfii10_daily/capture.envelope.json` `5ba44dac6408198aed7037bc272e9a1696aaabbb0906e09941f21c2c1e126cff`
  recomputed identically; the four sealed directories each carry the accepted 016
  capture plan `807dc73e...` and a metadata-only index.
- Smoke evidence is strictly pre-window and metadata only: requested intervals
  `2026-08-03` to `2026-08-14` for FRED DFII10/DGS2/VIXCLS and
  `2026-08-03T00:00Z` to `03:00Z` for OANDA XAU_USD H1, all ending before the first
  real anchor `2026-09-24T14:00:00Z`; every capture is
  `complete_sealed_smoke_not_window_evidence`; the summary carries identities,
  hashes, byte counts, row counts, intervals and statuses only, with no values.
- Read-only provider client: only the two accepted endpoints are hard-coded, calls
  are GET only with a 30-second timeout and bounded size (FRED limit <= 10 rows,
  OANDA span <= 6 h). Credential names are exactly `FRED_API_KEY` and
  `OANDA_API_TOKEN`; overbreadth (Supabase, n8n, RapidAPI, DeepSeek, Alpha Vantage,
  `OANDA_ACCOUNT_ID`, OpenAI, Anthropic) is refused. Only `url_without_key` reaches
  response metadata, and `api_key=` values and `Bearer` headers are redacted from
  errors, so no credential material reaches evidence, logs or stdout.
- Fail-closed controls reproduced against the tests: unknown identity, unopened and
  closed intervals, clock and anchor overrides, output-directory reuse and
  worker-root escape are refused; the first anchor's items are refused as
  `interval_closed_no_backfill` with `rescheduled: false` and sealed as a
  reason-coded blocked attempt.
- The scheduler package is inert text (`installed`, `enabled` and `started` all
  false) and no Windows scheduled task matching gold, trading or qualification
  exists on this machine.
- No real 014 anchor was captured; no scheduler or daemon was installed, enabled or
  started; no outcome, aggregate or evaluation was read; the only network calls are
  the four sealed pre-window smokes. No live workflow, warehouse, Layer 1,
  dashboard, integration, deployment or production change occurred.

## Decision

Accepted as a bounded, inert provider-activation package. This is preparation, not
window execution or qualification, and acceptance is not deployment or trading edge.

The two-session overlap is accepted as reconciled by this single revision, as
recorded in `20260924-gold-017-overlap-reconciliation.md`; the superseded artifacts
stay preserved as provenance under `backtester/tmp/superseded-017-other-session-20260924/`
and must not be re-committed or treated as an alternative implementation.

Answers to the submission's questions: the first accepted 014 anchor is recorded
blocked/unavailable and permanently missed (`interval_closed_no_backfill`,
`rescheduled: false`), with no catch-up, backfill or re-request and no reconstructing
the missed lane; the overlap needs no further action from the worker; and real window
activation plus any scheduler install remain separately gated by the user and a new
versioned assignment.

Consequence for the milestone: nothing is scheduled, so anchor 2
(`2026-09-25T14:00:00Z`) loses its pre-anchor feature interval at 14:00:00Z on
2026-09-25 unless the user separately authorizes a reviewed one-time capture lane and
a scheduler install. Gold holds at clean `6cbbd01` until then.
