# Messages to paste into agent windows

These messages start the assignments; no agent has been started by creating these files.
Use the correct worker window. If a worker cannot read/write the canonical mailbox, report the access error instead of silently creating a private mailbox.

## gold-research

```text
Check your inbox for the coordinator reply, then read your current assignment from the canonical project:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research
D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md
Your current assignment is `gold-coverage-024`, published 2026-09-25 as the bounded continuation of `gold-coverage-023`. 023 is reviewed: your declaration and its additive harness changes are ACCEPTED and verified, and your blocker is UPHELD, so the stage is not abandoned - it continues here. Do not revise 023 in place: its declaration stays byte-identical at c19315e6 and both spent run directories (combination-run-023-20260926-rev1 and -rev2) stay exactly as they are.
The coordinator reproduced your blocker mechanism read-only, so this is a repair, not a diagnosis. buildAcceptedParts in backtester/lib/gold_combination_rows.js never sets parts.seriesRules, while the accepted builder sets it at gold_individual_variable_report.js:813 and buildContext copies it into every context at :634, which is what seriesLevelAt reads for the declared availability rule. With it undefined the fallback is MAX_AGE_DAYS[seriesId] ?? DEFAULT_MAX_AGE_DAYS (7 days) and DEFAULT_AVAILABILITY_LAG_HOURS (36 h); the coverage-019 provider series declare different rules (SF_FED_DNSI 168h/14d, PHILLY_FED_ADS 36h/14d, SP500 36h/7d), so every risk_headline_context state came back observation_stale_beyond_declared_age (0 of 965 available, median null) and the guard correctly refused with atom_n:risk_headline_context:above_own_median is 0, not 471. You also call loadMacroHistories with three arguments where the accepted builder passes a fourth, prospectiveBoundary(registry) at :805.
Fix it by assembling the accepted parts exactly as the accepted builder does - set parts.seriesRules, pass the boundary argument, and call the accepted loader rather than adding a parallel provider-file loader. Keep the change additive, keep the v1 defaults bit-for-bit, keep the v2 declaration byte-identical, and cover it with focused tests, including that the adapter rebuilt state and atom counts reconcile with the accepted report declared counts for all 28 measured variables including the three provider series, and that a series whose declared rule differs from the module default is measured under its declared rule.
Then execute the accepted harness into a NEW run id, because both 023 run directories are spent and refuse re-entry: prepare/verify/execute with --registry backtester/registries/gold_combination_batch_daily_h24_and.v2.json into backtester/tmp/combination-run-024-20260926-rev1, then analyze_gold_combination_ledger.js. Keep min_n 20, keep the accepted session, horizon, endpoint, availability and exclusion rules, reconcile the endpoint denominators (exact_offset_elapsed + delayed_offset_endpoint + session_close_endpoint = all_computed), refuse any anchor at or after the frozen 2026-09-24T14:00:00Z boundary, and publish docs/GOLD_COMBINATION_ANALYSIS_023.md with the declared cell, the counts actually evaluated, the dependence statement, every exclusion and no accuracy, ranking, timing or edge claim. Preserve the 28-block individual-variable digest and every accepted artifact byte-identical, including the v1 registry (7e2bcff6...), the run-011 ledger (5cd45278...), the frozen 014 manifest (15cd0606...) and the sealed window evidence.
Answering your three questions again so they are not re-asked: (1) the repair belongs to this stage under the same additive allowance, now published as gold-coverage-024; (2) yes, call the same loader the accepted 019 report builder uses, with the boundary argument, and add the 28-variable reconciliation test; (3) yes, if the continuation and the 022 anchor obligation fall on the same wake, deliver the 022 item A envelope first and then continue.
Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research on branch workers/gold-research-policy-20260920, starting HEAD 6fd501a7. One writer only: never open a second session against this worktree. Do not disturb the live capture lane: GoldQualificationWindowTick018 keeps ticking every ten minutes through the v2 wrapper as the only capture path, and no capture identity may be read, sealed or re-attempted by hand. No acquisition, network call or credential is needed or permitted; no holdout; no prospective read; no research-rule change; no repository-level .gitattributes change and no renormalisation of an accepted file; no production, warehouse, Layer 1, live workflow, dashboard or deployment action.
Two known environment conditions are recorded and are not yours to fix: the CRLF materialisation of the hash-bound revision-7 report registry (raw 48161ff9 on disk against the pinned LF 714a5410, which is the five-failure case the backtester-spike change request owns) and the same asymmetry between the LF digest a manifest records and the raw digest verifyManifest compares for accepted_inputs. Disclose them if they appear; do not repair them here.
The documented local suite was not re-run in your previous session, so running it - with exact counts and every failure disclosed - is the final step here. Report actual activity at start and after the repair, the run, the analysis and the anchor envelope, submit a new immutable report with node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>, pause, and report the returned submission path. Stop for coordinator review.
```

## gbp

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gbp.md from those absolute paths.
Your worker ID is gbp; assignment ID is gbp-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-gbp on branch agents/gbp-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gbp
```

## silver

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/silver.md from those absolute paths.
Your worker ID is silver; assignment ID is silver-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-silver on branch agents/silver-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker silver
```

## wti

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/wti.md from those absolute paths.
Your worker ID is wti; assignment ID is wti-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-wti on branch agents/wti-layer1-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker wti
```

## eur-pairs

```text
This project is now coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/eur-pairs.md from those absolute paths.
Your worker ID is eur-pairs; assignment ID is eur-pairs-status-001.
Use D:/trading-agent-dashboard-codex.worktrees/agent-eur-pairs on branch agents/eur-pair-coverage-20260907.
Preserve your existing work. This first assignment is status reconciliation only, not more implementation.
Copy D:/trading-agent-dashboard-codex/docs/orchestration/templates/submission.json to a local temporary file; fill in your correct worker, assignment, actual worktree/branch, unique submission ID, commits, dirty files, test evidence, blockers and questions.
Submit using: node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Do not edit central state, instructions or another worker directory. Stop after submitting and report the returned submission path.
To check feedback when prompted: node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker eur-pairs
```

## strategy-2

```text
This project is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/strategy-2.md from those absolute paths.
Your worker ID is strategy-2; assignment ID is strategy-advisory-2-001. Select DeepSeek in your existing agent extension for this window; this adds no API key, credential scope or provider configuration.
Use D:/trading-agent-dashboard-codex/.local/worktrees/strategy-2 on branch workers/strategy-advisory-2-20260924 (created 2026-09-24 from canonical 4884339).
Run this window on DeepSeek, exactly as adviser 1 does: the existing Cline extension with DeepSeek selected, no new key, credential or provider configuration.
Your lane is the live path and the multi-asset rollout: Layer 1/Layer 2 honesty and observability, the four unreconciled asset workers, the multi-asset readiness/multi-process rollout, and mailbox/background-reviewer automation. Adviser 1 (strategy) keeps the gold research engine lane; do not duplicate it and never contradict it silently.
Write only docs/strategy-2/ in your worktree plus ignored scratch. Never edit the canonical folder, the register, assignments or another worker's files, and never submit secrets.
Deliver docs/strategy-2/STRATEGY_LIVE.md and docs/strategy-2/CONVERSATION_NOTES.md, submit materially revised recommendations through the shared mailbox with a unique submission ID:
node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <absolute-path-to-your-submission.json>
Report real activity with monitor-state.js activity strategy-2 working|paused|blocked "task", then pause.
This window is the only Strategy window connected to the mailbox bridge; keep it connected and leave adviser 1 disconnected.
```

## Coordinator prompt

```text
Check submissions. Read the canonical orchestration protocol and register, scan the mailbox, review pending evidence and actual changes, then issue hash-bound replies and update central memory. Do not assume reported work is accepted, merged or deployed.
```

## backtester-spike

```text
This worktree is coordinated centrally by Codex at D:\trading-agent-dashboard-codex.
Read D:/trading-agent-dashboard-codex/docs/orchestration/README.md and D:/trading-agent-dashboard-codex/docs/orchestration/assignments/backtester-spike.md from those absolute paths.
Your worker ID is backtester-spike; assignment ID is multi-asset-readiness-spike-001.
Use D:/trading-agent-dashboard-codex/.local/worktrees/backtester-spike on branch spike/multi-asset-readiness-20260924, base 927f799.
Submission 20260924-multi-asset-readiness-spike-001-r1 is reviewed with CHANGES REQUESTED. Read the reply first:
node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker backtester-spike
Then do exactly two things: make the hash-bound inputs byte-stable (a .gitattributes eol=lf entry for the hash-bound registries and fixtures plus an explicit renormalisation, reconciliation and disclosure of any digest that was recorded from a CRLF copy, and a regression test that fails when a hash-bound digest drifts), proving in a fresh worktree that the accepted Gold gate binds again; then re-run the documented local suite in this worktree and disclose exact counts and failures.
Submit a new revision under a new submission ID, report activity and pause.
Preserve every accepted Gold artifact and every other worktree. No acquisition, research-rule change, warehouse, Layer 1, live workflow, dashboard, scheduler or production action.
```

## Worker follow-up prompt

```text
Check your central mailbox replies using your worker ID. Read the reply and current assignment from the canonical project. Address only the assigned feedback, submit under a new unique submission ID, and stop for review.
```
