# Gold coverage completion: measure the seven remaining drivers

Assignment: `gold-coverage-completion-019`. Published 2026-09-24.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting HEAD: `67f51e8` (018 accepted).

User authority: on 2026-09-24 the user authorised (a) the additional free, keyless,
read-only sources named below, (b) retiring the legacy `dxy_*` ids rather than backfilling
or relabelling them, and (c) publishing this assignment. This followed the coordinator
recording strategy advisory 002 and establishing from
`backtester/registries/gold_live_input_inventory.v1.json` and
`backtester/registries/gold_variable_horizon_context.v1.json` that the live F2 dollar
input is FRED `DTWEXBGS` and must not be reported as the declared `dxy_*` variables.

## 0. Do not disturb the live capture lane (first rule)

The accepted 014 prospective window is live and is captured by the installed scheduled
task `GoldQualificationWindowTick018` (`Ready`, `PT10M`). This assignment must not modify,
stop, pause, reconfigure, duplicate or test-replace that task, its wrapper, the tick
driver, the accepted 017 activation package, or the sealed evidence under
`backtester/tmp/gold-qualification-window-018/`. Frozen while the window is live: the 014
manifest, the 015 execution contract, the 016 collectors/scaffold/dry-run CLI, and the
017 activation library, provider client, CLI and scheduler registry - any change to them
breaks the running gate's digest checks. Report the observed task state in both your
preflight line and your submission.

## 1. Declare before measuring (one additive declaration revision)

Add exactly seven new variable ids, each with its source id, state rule, cutoff,
availability rule and evidence mode, declared before any value is measured, and without
editing, renaming or relabelling any existing declared variable:

- `usd_broad_index_level` plus its `usd_broad_index_d1`, `usd_broad_index_d5` and
  `usd_broad_index_d20` changes, from FRED `DTWEXBGS` (already present in the accepted
  FRED archive), measuring the actual live F2 input under honest names;
- `risk_headline_context` from the San Francisco Fed Daily News Sentiment Index CSV;
- `equities_regime` from FRED `SP500`;
- `growth_regime` from the Philadelphia Fed ADS business-conditions index, using its
  published all-vintages file so an anchor sees only the vintage then available.

The legacy `dxy_level`, `dxy_d1`, `dxy_d5` and `dxy_d20` ids are retired with an explicit
declared reason. Never backfill, relabel, substitute or silently remap them, and never
report `DTWEXBGS` under a `dxy_*` name. The Yahoo chart endpoint is refused: no
undocumented or licence-ambiguous source may be used.

## 2. Acquire read-only, keyless and hash-verified

- Keyless only: load, request or persist no credential for any of these sources, and do
  not use the encrypted runner for them. Credential overbreadth remains refused.
- Read-only GET with bounded request sizes, provider-appropriate pacing and a declared
  user agent where the provider asks for one.
- Store every acquisition as an immutable local archive recording provider, requested
  interval, schema version, row count and SHA-256. Record the exact vintage/as-of
  semantics for the Philadelphia Fed file and the revision behaviour of the FRED series.
- Stop a route after two failed attempts and report the blocker; never fit exceptions to
  price gaps and never substitute a source silently.

## 3. Measure on the accepted historical path with the existing rules

- Measure the seven variables on the accepted 2023-2026 archive path using the existing
  rules: same anchors, same horizons, same availability cutoffs, same no-fill and
  no-substitution semantics. Change no research rule.
- Read no observation at or after the prospective window and compute no prospective
  outcome. Evaluation of the 014 window stays sealed until `2027-03-25T15:00:00Z`.
- Publish the regenerated findings digest at 28 of 28 variables, keeping the 21 existing
  variable blocks byte-identical. If a block cannot stay byte-identical, stop and report
  why rather than publishing a changed block.

## 4. Evidence and validation

- New declarations, registries and reports inside your own worktree; ignored raw archives
  under `backtester/tmp/`.
- Focused tests for the new declarations, the retired ids, the availability and vintage
  rules, refusal of a `dxy_*` relabel, refusal of a credentialed or undocumented source,
  and refusal to read a prospective observation.
- Then the documented local suite (`npm test`) with exact counts and failures disclosed.
- Preserve every accepted artifact byte-for-byte, including the 005/006/008 reports and
  registries and all 014/015/016/017/018 files.

## 5. Boundaries

No purchase, subscription or licence; no credential and no provider beyond the four named
above; no warehouse write; no Layer 1, live workflow, dashboard, integration, deployment
or production change; no research-rule change; no change to the prospective window, its
task or its evidence; and no second writer in this worktree.

## 6. Reporting (mandatory)

Start with a one-line preflight report (`monitor-state.js activity gold-research working`)
stating the observed scheduled-task state. Finish by writing one envelope from
`templates/submission.json` into your own ignored `tmp/` with the observed worktree,
branch, base and HEAD, changed files, exact tests and results, artifact hashes, the seven
new ids, the retired ids, blockers, questions and production disclosure; submit it with
`node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`;
then record `monitor-state.js activity gold-research paused "<what finished>"` and stop.
Start no further work until a recorded reply arrives, and report any blocker when it is
found rather than at the end.

