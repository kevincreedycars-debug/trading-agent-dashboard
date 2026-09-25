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

## 7. Continuation notice (coordinator, 2026-09-25)

Latest coordinator notification: `2026-09-25T11:26:26Z` - `gold-coverage-completion-019` was
published and delivered through bridge 0.2.1 when this window reconnected. No worker activity was
recorded after that delivery, so this revision republishes the same assignment under the recorded
assignment-version rule. If you already have this assignment open, this is the same work: resume it,
do not restart it and do not repeat finished steps.

Report activity first (`monitor-state.js activity gold-research working "<step>"`), then work in
this order inside this one assignment:

1. section 8 task hardening first, because anchor 2's entry lane opens at `2026-09-25T14:00:00Z`;
2. section 1 declarations, then section 2 acquisition, section 3 measurement and the 28 of 28
   digest, section 4 evidence and validation, section 5 boundaries and section 6 reporting.

Two clarifications for this run only, which do not widen or narrow sections 0 to 8:

- Do not renormalise line endings, rewrite or re-check-out accepted files, and do not add a
  repository-level `.gitattributes` entry. A hash-bound materialisation defect is already under a
  separate assigned change request, so a global fix here would collide with it. If an accepted
  digest cannot be reproduced, stop and report it under section 3 rather than publishing a changed
  block.
- The live lane keeps running while you work: the capture task ticks every ten minutes, the sealed
  anchor-2 captures stay byte-identical, and no hand capture, task change or scheduler test may
  touch them.

## 8. Task hardening (user-authorised)

The user authorised hardening the installed capture task so that a missed trigger or a
logon gap cannot quietly drop a lane. Do this before anchor 2's entry lane opens at
`2026-09-25T14:00:00Z`, keeping it minimal:

1. Set the task's `StartWhenAvailable` to true so a trigger missed while the machine was
   off, asleep or logged off runs as soon as possible afterwards.
2. Clear `DisallowStartIfOnBatteries` and `StopIfGoingOnBatteries` so a battery-powered
   machine does not skip a lane.
3. Keep the task otherwise exactly as accepted: the same name
   `GoldQualificationWindowTick018`, the same action (the accepted wrapper through the
   encrypted runner), the same `PT10M` repetition, `MultipleInstances` `IgnoreNew`, exactly
   one task, no second trigger that could run the tick twice at the same instant, and no
   change to the accepted wrapper, driver, 017 package or any other frozen file.
4. Verify before you report: the task is `Enabled` and `Ready`, its next run time is set,
   the settings read back as intended, and one real tick after the change completes
   successfully and appends a metadata-only entry to `tick.log` without sealing,
   re-attempting or disturbing any existing capture or lane.
5. If the change cannot be verified, revert the settings to the accepted values and report
   the blocker instead of leaving the lane unguarded.

Report the before and after settings, the verification tick, and confirmation that the
three sealed anchor-2 captures are byte-identical.


