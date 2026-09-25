# Gold coverage-completion-019 revision 1 accepted

Reviewed on 2026-09-25 by the background Central Orchestrator. Submission
`20260925-gold-coverage-completion-019-r1`, mailbox SHA-256
`87a6cfdeb99d1381d27341c5d0088102dde545a2e4022afa4165a2b26869df36` (reproduced by `check`).
Reply published at `.local/orchestration/replies/gold-research/20260925-gold-coverage-completion-019-r1.json`
(SHA-256 `09e1a168760b8b21a6a2424a2fc17729113bdc8d0c2c4025f10e5b4083fff3f8`). Review is a
separate session from authorship; acceptance is not integration, merge, deployment or a
trading result.

## Scope checked

Worker `gold-research`, worktree `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`,
branch `workers/gold-research-policy-20260920`, base `67f51e8` (accepted 018), HEAD `3240f598`,
working tree clean. Two commits, in the declared order:

- `f24f76f` "Declare the coverage-019 variable revisions before any outcome is read" (15:37:43 local)
- `3240f598` "Measure the seven remaining Gold drivers and publish the digest at 28 of 28 variables"
  (15:47:54 local)

Fifteen changed files, exactly the disclosed set. No accepted 014/015/016/017/018 artifact, frozen
manifest, execution contract, scheduler package, collection protocol, consumed-data manifest,
combination batch registry, live-input inventory or remaining-source audit is modified.

## Independent verification

- **Envelope and provenance.** Mailbox hash, worker, assignment and submission ids, worktree, branch,
  base and HEAD all match the register and the submission. Read-only reproduction of every disclosed
  digest: committed digest `d2307a74...`, revision-8 registry `2be6701c...`, coverage declaration
  `34fcd310...`, report artifact `ffcd9cbc...`, ignored companion `35153fd2...`, acquisition ledger
  `2cc1606a...`; the run's recorded `registry_sha256` `2be6701c...`, `policy_sha256` `08cf9e3f...`
  and `code_sha256` `74534a0c...` all reproduce from the committed files, and `74534a0c...` is
  exactly the HEAD bytes of `backtester/lib/gold_individual_variable_report.js`, so the artifact was
  produced by the committed code.
- **Declare before measure.** The declaration commit precedes the acquisition ledger timestamp
  (`2026-09-25T14:38:33.760Z`) and both report runs. The only earlier artefact is a transport probe
  under the worker's ignored `tmp/gold-019-probe/`, which contains raw downloads only and no measured
  value.
- **Retirement, not relabelling.** Revision 8 removes `dxy_level`, `dxy_d1`, `dxy_d5`, `dxy_d20`,
  adds the four `usd_broad_index_*` ids at the same declared positions, preserves the order of all
  retained declarations, and leaves no `dxy_*` id in the measured set. `retired_variables` carries an
  explicit reason per id and a refusal guard; the loader refuses a `dxy_*` relabel, a retired id in
  `variables`, an undeclared series file and a route that is not declared keyless. The accepted
  revision-7 file is preserved byte-for-byte, and its LF-normalised SHA-256 still reproduces the
  digest `714a5410...` pinned by the frozen combination batch, so the frozen batch keeps exactly the
  declared inputs it recorded.
- **Central claim re-derived, not trusted.** An independent coordinator comparison of the new report
  against the accepted coverage-008 report returns: 21 previously measured blocks byte-identical,
  newly measured exactly the seven declared ids, baselines, exclusions, context strata and
  prior-context reconciliation identical, and conditioning cells purely additive (21,746 to 25,063).
- **No research-rule change.** `endpoint_groups`, `context_strata`, `exclusions`, `cohorts`,
  `horizons`, `outcome_definition`, `reporting_policy`, `multi_event_policy`, `family_scoping` and
  `year_breakdown_scope` are unchanged between revisions 7 and 8; the single strata addition
  (`median_split_revision_8`) reuses the already-declared own-median split and explicitly introduces
  no threshold, band or tercile.
- **No prospective read.** The declared boundary `2026-09-24T14:00:00.000Z` equals the frozen
  manifest's `first_anchor_utc`. Every series the report reads ends strictly before it (SP500
  2026-09-23, SF Fed 2026-09-17, ADS 2026-09-12 with latest stored vintage 2026-09-18; carried FRED
  series 2026-09-04 to 2026-09-21). The seven carried FRED series are byte-identical to the
  coverage-008 archive and match the digests pinned in the consumed-data manifest. The ledger
  declares keyless acquisition, `credential_used` false and `encrypted_runner_used` false; the
  encrypted runner was not used and no credential appears in any evidence path.
- **Section 8 hardening verified live.** Exactly one Gold task exists:
  `GoldQualificationWindowTick018`, state `Ready`, `Enabled` true, `StartWhenAvailable` true,
  `DisallowStartIfOnBatteries` and `StopIfGoingOnBatteries` false, `MultipleInstances` `IgnoreNew`,
  one trigger with `PT10M` repetition and the accepted action. `Get-ScheduledTaskInfo` returned last
  run `2026-09-25 15:46:01` local, `LastTaskResult` 0, `NumberOfMissedRuns` 0. The three sealed
  anchor-2 capture envelopes still hash to `302e4a26`, `58ece552` and `c51ad9b9`.
- **Tests reproduced by the coordinator.** Focused new file `gold_coverage_019_sources.test.js`
  12/12; focused group (individual-variable report, coverage, findings render, qualification protocol,
  remaining-source audit) 75/75; documented local suite 520 tests, 515 pass, 5 fail. The five
  failures are exactly the combination-batch manifest tests refusing the hash-bound revision-7
  registry because this checkout materialises it as CRLF (`48161ff9...` on disk against the declared
  `714a5410...`); that LF-normalised digest reproduces exactly, so the declaration content is intact.
  This is the pre-existing materialisation defect already under the `backtester-spike` change request
  and is not caused by `019`. The submission's four console-width `secret_scanner` failures did not
  reproduce in this run, which confirms they are environment-dependent; the submission disclosed them
  honestly rather than hiding them.
- **Boundaries.** No Layer 1, live workflow, dashboard, integration, warehouse, credential, purchase,
  licence or deployment change; no change to the prospective window, its wrapper, driver, task
  identity or sealed evidence; one writer in the worktree.

## Reviewer findings recorded (not blocking acceptance)

- The accepted live-input inventory is now stale in two ways: its `research.status` still reads
  `unavailable_no_local_source` for `risk_headline_context`, `equities_regime` and `growth_regime`,
  and its F2 vocabulary still uses the retired `dxy_*` ids while the research ids are now
  `usd_broad_index_*`. Because the qualification gate resolves candidate atoms through that inventory
  and additionally requires `research.status === measured` with a declared no-look-ahead timing rule,
  a revision-8 candidate cannot yet be gated truthfully. This is the concrete next bounded step.
- The accepted remaining-source audit still describes its nine audited variables as
  `unavailable_no_local_source`, and the coverage registry's `fed_bias` and `inflation_signal` entries
  still show their original unsourced `source_mapping`. The worker disclosed both and did not silently
  rewrite accepted artifacts; the horizon-context registry records the discrepancy in its own gaps.
- The three redefined regime/context variables stay ineligible for any prospective candidate space
  under the existing protocol: `risk_headline_context` is `absent_live`, `equities_regime` and
  `growth_regime` are `proxy_redefined`, and no separate approval exists. This answers the worker's
  second question with no new decision.
- Live-lane observation for the user, outside `019`: the anchor-2 gold entry identity
  `2026-09-25T14:00:00.000Z` is sealed as a blocked attempt at `14:06:03.033Z` with reason
  `provider_error` (HTTP 400), `rescheduled` false and no same-identity retry; later ticks report that
  identity as `already_settled`. The feature lanes for that anchor remain sealed and unchanged.

## Decision

Accepted as the coverage-completion checkpoint: the seven declared drivers are sourced, acquired
keylessly and measured on the accepted path, the declaration revision precedes the measurement, the
retirement is honest and reversible only by a new declaration, and the digest is at 28 of 28 with the
21 previously measured blocks byte-identical. This is exploratory consumption of already-used
historical anchors: it is not an accuracy, qualification, predictive or trading result, no outcome or
aggregate of the prospective window has been read, and evaluation stays sealed until
`2027-03-25T15:00:00Z`.

Next action for Gold: hold until the bridge wakes it with revision `gold-coverage-020` (declaration
reconciliation). The capture lane continues untouched. Opening a fresh exploratory combination stage
over the 28 measured variables is left as an explicit user decision and is not authorized here.