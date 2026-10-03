# Analysis engine: how the daily calls are made today

Assignment: `analysis-engine-001`. Published 2026-10-03.
Worker: `analysis-engine`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/analysis-engine`.
Branch: `workers/analysis-engine-20261003`. Starting commit: `4fbde41`.
User authorization: on 2026-10-03 the user asked for a second strategy window named **Analysis Engine**, to
discuss how the analysis and the daily calls are currently being made and whether that logic can be improved.

## Purpose and lane

This is an **audit and advisory lane**, not a build lane. Its subject is the logic that produces the daily
directional calls as it exists today: read it, describe it in plain words, say where it is weak and where the
weakness is only asserted rather than shown, and rank bounded options for improving it. The deliverable is a
verified description of what is, plus options - never a rewrite, never a change to a live path.

## The starting picture, to be re-verified rather than trusted

Re-read each of these and correct this paragraph where it is wrong; the reasoning matters more than the list.

- `logic/agent_<asset>_direction.md` - the called "Weighted Analysis Engine" documents (v2.0, and v2.1 for
  USD) for gold, usd, eur, nq, btc and gbp, under the rule stated in `logic/README.md`: each Layer 1 agent
  reads only its own logic document and the latest usable market snapshot. Two things to check and report
  plainly: there is no `logic/agent_silver_direction.md` and no `logic/agent_wti_direction.md`, and
  `logic/README.md`'s own expected-file list names five agents (usd, eur, gold, nq, btc) while a sixth
  (`agent_gbp_direction.md`) exists in the directory.
- `exports/<asset>_layer1_agent.json`, `exports/<asset>_collector.json`, `exports/layer2_trade_selection_agent.json`
  and `exports/master_orchestrator.json` - the exported workflow behind each call.
- `data/layer1.json` and `data/layer2.json` - the published call artifacts; `data/layer2.json`'s confidence is
  re-derived in the browser from the Layer 1 headline figure.
- `data/workflow-status.json`, `data/workflow-control.json` and `workflows/master_orchestrator.md` - the run
  status and the trigger.
- `backtester/replay/<asset>/<asset>_replay_core.js` for btc, eur, gbp, gold, nq and usd - the replay form of
  the same logic, with gold's live-parity fixture `backtester/fixtures/gold_live_replay_24h_parity_fixture.json`
  binding it to the live deterministic semantics rather than to the markdown document.
- `index.html` and `script.js` - how the published calls become the dashboard's cards and tabs. The dashboard
  is downstream of the call and feeds nothing back into it.
- The gold factor work's own public page already records the user's stated purpose for that work: the algorithm
  behind the daily calls is to be reassembled from what the factors are shown to have done. Treat that as the
  user's framing of this lane, not as a licence to start it.

Also read `docs/ARCHITECTURE.md` for the Layer 1 rules, `docs/backtester_master_logic.md`,
`docs/LAYER1_COMPACT_SUMMARY_20260919.md` and `docs/DEEPSEEK_LAYER1_PROGRESS.md`, and `data/architecture-map.json`
for the file map.

## Scope

Three documents, nothing else:

1. `docs/analysis-engine/DAILY_CALL_LOGIC.md` - how one day's call is produced today, step by step and factor
   by factor, naming the file and the line each step comes from. Cover at least: which factors enter, where
   their weights and thresholds come from and whether they are stated or implicit, how the direction is
   decided, how the confidence figure is derived and whether it is calibrated, what is deterministic and what
   is model-generated, which parts are frozen published artifacts and which are re-derived on read, what
   happens when an input is missing or stale, and the honest unknowns where the documents and the
   implementations disagree.
2. `docs/analysis-engine/IMPROVEMENT_OPTIONS.md` - ranked, bounded options. For each: the weak point, the
   evidence that it is weak rather than merely disliked, what the change would cost, what it would change
   downstream, what it must not touch, and how it could be judged. Rank them, recommend at most one, and put
   every question that only the user can answer to the user in plain words.
3. `docs/analysis-engine/CONVERSATION_NOTES.md` - what the user decided, what is still open, and what was
   asked but not answered. Keep it current so a later window can pick the discussion up.

## Owned scope

Write only `docs/analysis-engine/` in this worktree, plus ignored scratch under `tmp/`. Read central state, the
logic documents, the exports, the published artifacts and the dashboard by absolute path. Never edit the
canonical folder, `logic/`, `exports/`, `data/`, `workflows/`, `script.js`, `index.html`, `backtester/`, the
register, assignments, another worker's worktree or another worker's mailbox. Submit only through the canonical
mailbox CLI. Do not create a private mailbox or a second copy of the register.

## Boundaries

- **Layer 1 stays independent and backtesting stays downstream-only.** No proposal may let a backtest
  result, an outcome, a holdout or a prospective observation feed a live Layer 1 input, weight or threshold.
  If an option would do that, it is out of scope and reported as such.
- No code, no workflow edit, no trigger, no refresh, no publication, no deployment, no warehouse read or
  write, no credential, no package installation, no order and no arming.
- Read no holdout, no sealed prospective window and no outcome dataset. This lane reads the logic and the
  published artifacts, not the evaluation evidence.
- A passing replay, a cleaner description or a re-derived figure is not proof of edge. Make no live claim.
- Report an honest `blocked` envelope if the window cannot read or write the canonical mailbox, instead of
  working around it.

## Accepted bindings

Re-verify each before relying on it, and say plainly if a claim or digest has moved:

- `docs/ARCHITECTURE.md` - the Layer 1 rules and the independence of the agents.
- `logic/README.md` - the contract each logic document obeys.
- `data/architecture-map.json` and `data/research-proof-map.json` - what is wired to what, and what is
  declared `needs_you` or blocked.
- `docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` - the timing contract any proposed change has to respect.
- This repository runs `core.autocrlf=true` with no `.gitattributes`, so a committed file is stored as the LF
  form of your CRLF working copy. Compare the normalised form rather than raw bytes when you quote a digest.

## Deliverable, submission and finish

Report real activity at task start, at milestones, at least once per minute during long active work, and when
pausing, with
`node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity analysis-engine <state> "<task>"`.
File one `ready_for_review` envelope through the canonical mailbox with the two documents and a summary that
names the files, byte counts and digests, then pause. Discussion with the user continues in this window; the
mailbox is the record of it.
