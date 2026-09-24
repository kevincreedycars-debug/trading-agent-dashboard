# Gold qualification-collector-016 revision 1 accepted

Reviewed interactively on 2026-09-24. Submission
`20260924-gold-qualification-collector-016-r1`, mailbox SHA-256
`efe76d7ccf362f3eb7d408572035f5c3ad501215c44ef1c15f799d7312c982c3`.
Worker branch clean at `4eea9a8` from accepted 015 base `b5f2e27`; one commit
adding exactly the four disclosed files (+408/-0) and no deletions.

## Independent verification

- `git diff --name-status b5f2e27 4eea9a8` returns only the disclosed additions:
  `backtester/lib/gold_qualification_collectors.js`,
  `backtester/scripts/run_gold_qualification_collector_dry_run.js`,
  `backtester/tests/gold_qualification_collectors.test.js` and
  `docs/GOLD_QUALIFICATION_COLLECTOR_RUNBOOK.md`. Working tree clean.
- Accepted bindings reproduce: manifest `15cd0606...`, contract `208c5844...`,
  015 execution runbook `7cb5bea3...` unchanged. The new runbook hashes to the
  submitted `3c10d7ba...`.
- Coordinator dry run used a fresh fixture with different rows and values. Two
  runs into distinct new directories were byte-identical, and the produced
  `capture-plan.json` equals the submitted artifact `807dc73e...` exactly.
- The plan reconciles 130 unique anchors and 780 unique items, with 130
  `exact_only` and 130 `delayed_only_never_merged` lanes, and
  `blocked_no_reschedule` on every item; state is
  `declaration_only_real_window_inactive`.
- Envelope metadata and the capture index contain identities, hashes, timestamps,
  coverage, provenance and parser version only; a scan found no payload values.
- Fail-closed controls reproduced: existing output directory, output escape, and a
  fixture outside the registered worker root are refused; the CLI refuses
  `--network`, `--evaluate`, retrieval at `2026-09-24T14:00:00.000Z`, a post-window
  observation and any non-synthetic run.
- Tamper probes: rewriting the sealed envelope's metadata without rewriting the
  index fails with `Envelope hash mismatch`; a self-consistent rewritten
  envelope/index pair fails with `Value leakage into metadata at $.close`, so
  verification re-scans rather than trusting hashes alone.
- Coordinator focused file passes 10/10. The coordinator full local suite reports
  490 tests / 486 pass / 4 fail; all four failures are the pre-existing,
  environment-dependent `backtester/tests/secret_scanner.test.js` console-width
  cases already tracked as a separate register backlog item, and that file is
  untouched by this commit. Every Gold test passes here.
- No network, credential, scheduler, daemon, real acquisition, prospective read,
  window activation, evaluation, live workflow, warehouse, Layer 1, dashboard,
  integration, deployment or production action occurred.

## Decision

Accepted as an outcome-blind offline-collector checkpoint. This is not window
execution or qualification, and no successor assignment was published. Real
prospective collection and activation need network/provider access, scoped
credentials and an explicit user decision, so the window stays closed and the
worker stops at `4eea9a8`.
