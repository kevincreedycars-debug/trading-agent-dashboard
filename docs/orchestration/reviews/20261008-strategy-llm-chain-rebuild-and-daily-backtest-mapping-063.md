# Review: 20261008-strategy-llm-chain-rebuild-and-daily-backtest-mapping-063

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261008-strategy-llm-chain-rebuild-and-daily-backtest-mapping-063.json` - 7,517 bytes, sha256 `36df3ce2b9db8bca635b34ea11295a0c90a4d7380591493dc5913cc87763acc0` (reproduced from the immutable inbox file; equal to the requested hash).
- Reply: `.local/orchestration/replies/strategy/20261008-strategy-llm-chain-rebuild-and-daily-backtest-mapping-063.json` - decision **accepted**, 9,928 bytes, published with the canonical CLI (`node scripts/coordination.js reply --file ...`), reply sha256 `ec972d0035d4fd529edbc93c07926f9f2e002c20e0312199eb478b1a543aa3bd`, its `submission_sha256` equal to the inbox hash; after publication `check --worker strategy` reports this filing `accepted`, `pending 0`, `errors []`, and the whole mailbox `pending 0`, `errors 0`.
- Cycle: 2026-10-08, background coordination cycle, dispatched background run from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/run.lock` pid 39948 naming this submission, `controller/status.json` state `reviewing`, detail this submission, updated `2026-10-08T07:30:31.251Z`). A background turn already owns the lock, so no pause or stop was run and no controller or bridge setting was touched.
- Assignment published by this review: **none**. `strategy` stays `advisory_active` under `strategy-advisory-001`, and no worker status changed.

## What was filed

A `ready_for_review` docs-only advisory answering the user's 2026-10-08 brief: a ten-day plan to deep-research every element of the LLM analysis logic, have frontier models judge whether it makes sense, have two frontier coding models red-team it, then rebuild the LLM logic chain as a program and backtest that as a full daily analysis engine - to answer what is actually in the black box and to backtest the LLM analysis without a model call per day. One commit on `workers/strategy-advisory-20260920`, base `c2ba8ac`, head `99aea5b`:

- `docs/strategy/LLM_CHAIN_REBUILD_AND_DAILY_BACKTEST_MAPPING_20261008.md` - 217/0.
- `docs/strategy/CONVERSATION_NOTES.md` - 39/0.

256 insertions, 0 deletions in total; tree clean apart from ignored `tmp/`. The lane disclaims any build, request, schedule, production, credential, warehouse, holdout or prospective-observation action, and makes no accuracy, edge, timing or completion claim.

## Scope and artefacts reproduced from the checkout

- `git` in `.local/worktrees/strategy`: head `99aea5b8c55650341d25928462bdb485f8f6256b` has sole parent `c2ba8ac9bb448962d6c8d045312bfcb26c687890` (the declared base), `git rev-list --count c2ba8ac..HEAD` is 1, `git show --numstat` names exactly the two declared files, and the tree is clean under `git status --short --untracked-files=all`.
- Both artefacts reproduce byte for byte at the filed head: the mapping note is 14,920 worktree bytes, sha256 `544041e9093b756d74b775ed6a5d8a48f35c92b09c5a2c48c8f785dc48ec6729`; `CONVERSATION_NOTES.md` is 389,588 worktree bytes, sha256 `3702f1db91c433bd3c84b207065359db3a6b367896558828e4bdb9b08c1a5a79`. Both equal the declared figures.
- Tests are correctly disclosed as not run, with the reason stated (two markdown documents and no source, data, workflow, dashboard or backtester file), which the assignment permits for documentation-only work.

## The node-level finding reproduces independently

Read node by node from `exports/gold_layer1_agent.json` in the canonical checkout, not taken from the filing:

- The workflow is named `GOLD Layer 1 Agent` and carries exactly nine nodes.
- The connections read `When Executed by Another Workflow` -> `Supabase Get Many` -> `Build GOLD Input Pack` -> `Get GOLD Logic Document` -> `Combine md & market snapshot` -> `Message a model` -> `Parse GOLD Agent Output` -> `Calculate GOLD Conviction` -> `Create a row`.
- The four code nodes measure 2,245 / 391 / 3,044 / 14,655 characters, matching the filing exactly, including the 14,655-character conviction node.
- The conviction node recomputes all ten factor signals from `market_inputs` through its own `factorSignals(tf)`, scores them per timeframe, and returns `direction_24h`, `conviction_24h`, `reason_24h`, `factor_breakdown`, `weighted_score`, `conviction_model`, `reasoning_summary`, `score_bullish/bearish/neutral` and `full_output`/`raw_agent_output` - all its own values.
- The `Create a row` node writes to `agent_outputs` with `dataToSend` `autoMapInputData`, so the stored row carries the conviction node's own direction, breakdown, weighted score and reasoning summary. The model's `direction_*`, `factor_breakdown`, `reasoning_summary` and even its `full_output`/`raw_agent_output`, set in the parse node, are overwritten before the write.

The filing's headline claim therefore stands as written: on this workflow the gpt-4.1-mini call is a guard, not an author. It fails the run if it returns no text or invalid JSON, but its verdict does not reach the stored row.

## The document-versus-code divergence reproduces

- `logic/agent_gold_direction.md` declares one weight vector for all horizons - F1 22, F2 18, F3 14, F4 8, F5 8, F6 10, F7 6, F8 6, F9 6, F10 2, total 100 - and a uniform DXY threshold of 0.30 (`DXY rising >0.30% = BEARISH`).
- The code's `TIMEFRAME_WEIGHTS` carries five vectors; the 24h row is F1 26, F2 22, F3 12, F4 10, F5 10, F6 8, F7 8, F8 2, F9 1, F10 1 (total 100), and 3d, current_week, next_week and current_month differ again.
- The code's F2 threshold is 0.15 on 24h and 0.3 on every other timeframe, against the document's uniform 0.30; F5 carries a second pair at 0.3 on 24h and 0.5 otherwise.
- The document's single vector is nearest the code's `current_week` column (summed absolute difference 8, against 12 for 3d and 28 for 24h and current_month) - the filing's reading.
- Provenance: `git log --follow` on `logic/agent_gold_direction.md` returns exactly one commit, `3f614f6` (`Add files via upload`, 2026-06-07), so the document was never revised while the code moved.
- `0f6eaa3`, the SILVER Layer 1 contract fix, does describe a live user prompt that still declared asset GOLD, so the filing's warning that per-asset prompt defects are real is accurate.

## The existing-asset mapping reproduces

- Six replay cores exist under `backtester/replay/`: gold 14,794 B, usd 37,283 B, eur 15,886 B, nq 16,825 B, btc 22,211 B, gbp 9,932 B. The filing's `Gold core is 14.8 KB` and `usd_replay_core.js is 37 KB` both hold.
- `data/backtester-checker-gold-24h-2024-2026.json` reads meta generated 2026-06-30, asset GOLD, timeframe `following 24hrs`, range 2024-01-02..2026-04-30, replay source `backtester/replay/gold/gold_replay_core.js`, evaluation source `backtester/lib/outcome_evaluation.js`, flat threshold 0.3, tolerance 0.5 pp, session rule `weekday_only`; summary `rows_checked` 608, `pass` 608, `exact_matches` 608; `fields_compared` is exactly 15 entries including `factor_scores`. The filing's caution that this parity is near-guaranteed by construction, because the checker and the replay core are the same arithmetic, is the correct reading and is why it is not evidence about the document or the model.
- `backtester/docs/gold_stored_call_pilot_20260906.md` reproduces the pilot facts: 143 of 147 linked snapshots imply the same `4266.066005` reference price, 154 stored outputs reproduce their recorded signals, and replacing the stale Gold input changed 97 of 154 F5 signals and 19 final direction labels.
- The recorded `25/25` session `no_information` verdicts reproduce from the accepted `-055` review and `docs/CHANGELOG.md`.

One non-material wording observation, recorded rather than penalised: section 2 of the note describes the Gold gate node as `15 KB` while section 4 measures the same file at 14.8 KB (14,794 bytes). Both are roundings of one file and no conclusion rests on it.

## Decision

1. **Accepted on the reviewed bytes only, as the record it is.** The advisory changes no code, data, page, workflow, schedule, formula or number. No accuracy, edge, timing, readiness or completion claim is made or granted; a clean tree, a parity pass or a read-only export read is not evidence of live deployment, causal feature timing or trading edge.
2. **No assignment is published and no worker status changes.** The register row keeps status exactly `advisory_active` under `strategy-advisory-001`. The evidence supports no bounded research assignment this cycle, and the reason is a chain of gating decisions rather than an absence of work (see below).
3. **The dashboard-icon question from `-062` stays open and unbuilt**, exactly as that answer left it; the user put it on hold before giving this brief.

## Why no assignment is published now

- Step 1 of the note's order (confirm the repo export against live n8n) is the live-path adviser's surface and needs provider access a background turn may not take.
- Step 2 (the one-page daily-engine contract) is blocked on the user's trading-day basis decision.
- Step 3 (the shared engine) is a build, and no existing lane may build it: the harness lane designs only, the six `backtester-<asset>` lanes are standby, and the Gold research lane is not a build lane.
- Step 4 (element research) is undefined until the authoritative rule set is chosen, because the ten factors are described by a document the code ignores.
- Step 5 (two independent frontier-model reviews) has no lane.
- Step 6 (whole-day backtest) needs both the engine and the trading-day basis.
- Publishing a second assignment onto `gold-research` would break the one-assignment rule and be masked: that lane already carries an unstarted `gold-dark-factor-repair-027` at exactly `instructions_published_awaiting_worker`, its last connection write is `sent_unconfirmed` for `gold-declared-band-measurement-026`, and a bare re-publish there is suppressed by its own record.

## Precise unresolved decisions that gate the next assignment

1. The user's: which session or close defines a trading day - it gates every lane's outcome definition and therefore steps 2 and 6.
2. The user's or the project's: which rule set is authoritative - the document's one vector (22/18/14/8/8/10/6/6/6/2, F2 0.30) or the code's five per-timeframe vectors (24h 26/22/12/10/10/8/8/2/1/1, F2 0.15). The stored 24h rows were produced with the code's vector, so the document is currently a description the pipeline does not implement.
3. The user's: whether the model step stays in the daily path as a guard or is dropped, which decides whether a daily call costs anything at all.
4. Unverified premise with a named owner: whether `exports/gold_layer1_agent.json` is the workflow live in n8n today - `exports/` drift is an open item owned by the live-path adviser, and every node-level finding here rests on the repo export.
5. Where the ten-day plan and the source book live: a read-only search of the repository's markdown and JSON found no occurrence of the plan, so the mapping rests on the brief's words alone.
6. Which lane may build the shared engine, which needs one new bounded assignment from the user or coordinator before any build lane exists.
7. Whether the already-consumed Gold archive (608 rows, 2024-01-02..2026-04-30) may be used for parity and exploratory work; nothing fresh or sealed is required for that use.

## Boundaries held

No production, deployment, workflow execution, warehouse read or write, purchase, credential change, external message or holdout read by this cycle. Layer 1 stays independent and backtesting stays downstream-only; a faithful rebuild that reproduces a call computed on defective inputs is reproducibility, not accuracy, edge or causal feature timing, and the note says so. The canonical checkout's pre-existing unrelated state (`M tools/strategy-node/Strategy.code-workspace` and the five untracked `backtester/` Gold session-policy files) was left exactly as found. This cycle's own activity was recorded with `monitor-state.js` (`working`, then `paused`).
