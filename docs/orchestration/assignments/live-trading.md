# Live trading path: the MT5 connection lane

Assignment: `live-trading-001`. Published 2026-09-29.
Worker: `live-trading`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/live-trading`.
Branch: `workers/live-trading-20260929`. Starting commit: `5ff1bf3`.
User authorization: on 2026-09-29 the user asked for another registered agent window running
Cline with DeepSeek, connected to the wider project and the dashboard, so the live-trading path
through a MetaTrader 5 connection can be discussed in its own window before anything is built.

## Purpose and lane

This is an **advisory and design lane**, not an execution lane. Its subject is the one thing the
project does not have: how the existing sealed Layer 1 directional calls would ever reach a real
broker through MetaTrader 5 (MT5), and what has to be true before that is allowed to happen.

Read this paragraph as the starting picture, and re-verify it from the files rather than trusting
it. No MT5 connector, client, bridge or order path exists anywhere in the repository. MT5 appears
only as a declared gap and a visual target:

- `data/research-proof-map.json` lists *"Provide an MT5 data export or read-only feed"* as
  `needs_you` and marks `executable` trade validation `blocked`, with `executable_trade_validated`
  still false.
- `docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md` is a 2026-08-21 visual direction for a dashboard
  view that *mirrors real MT5 fills*, with no implementation behind it.
- `docs/BACKTESTING_REVIEW_PLAN.md` and `docs/GOLD_TIMESTAMPED_EVALUATION_CONTRACT.md` both name
  MT5-aligned execution evidence as a missing prerequisite; a passing local replay does not
  satisfy it.
- Machine facts to re-check before relying on them: two MT5 terminals are installed
  (`C:\Program Files\MetaTrader 5`, `C:\Program Files\RL Crates MT5 Terminal`), Python 3.13.7 is
  available, and the `MetaTrader5` Python package is **not** installed.

## Scope

Two documents, nothing else:

1. `docs/live-trading/STRATEGY_LIVE.md` - objectives, verified state, unknowns, ranked next steps,
   dependencies, alternatives, and exactly one recommended bounded assignment for building the
   MT5 path. Rank the options honestly, including "the demo/read-only step first, order placement
   later" against "connect a funded account".
2. `docs/live-trading/CONVERSATION_NOTES.md` - what the user decided, what is still open, and what
   was asked but not answered. Keep it current so a later window can pick the discussion up.

Both are discussion and design documents. This assignment authorizes no code, no connection and no
order.

## Owned scope

Write only `docs/live-trading/` in this worktree, plus ignored scratch under `tmp/` or
`backtester/tmp/`. Read central state, the dashboard files, reports and registered worktrees by
absolute path. Never edit the canonical folder, the register, assignments, another worker's
worktree or another worker's mailbox. Submit only through the canonical mailbox CLI.

## Accepted bindings

Re-verify each before relying on it, and say so plainly if a claim or digest has moved:

- `docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md` - what the mirrored view must show, and the duty
  to label real fills apart from proposed or simulated trades and stale broker sync.
- `data/research-proof-map.json` - the `needs_you` MT5 feed item and the blocked execution gate.
- `docs/ARCHITECTURE.md` - the Layer 1 rules, so a live path never feeds back into Layer 1 inputs.
- `docs/CREDENTIAL_CONTINUITY.md` and `config/credential-manifest.json` - the scoped CLIXML runner
  and the existing scopes; note that no MT5 scope exists yet.
- `docs/orchestration/DECISIONS.md` - including the sealed prospective window whose evaluation stays
  closed until `2027-03-25T15:00:00Z`.

## Boundaries

No production, live workflow, warehouse, Layer 1, dashboard, credential, scheduler, deployment or
purchase action. Specifically, this assignment does **not** authorize:

- connecting to any MT5 terminal, broker server or account, demo or funded;
- installing the `MetaTrader5` Python package, an MQL5 Expert Advisor, or any other dependency;
- asking the user to paste an MT5 login, password, server or investor password in chat, or reading,
  storing, committing or logging any such value. If credentials are ever needed, they go through the
  documented local prompt into the scoped CLIXML store, and a manifest change is a separate,
  user-authorized step;
- placing, modifying, closing or cancelling an order, or arming any path that could;
- reading account or deal history from a funded account;
- any change to `config/credential-manifest.json`, `docs/CREDENTIAL_CONTINUITY.md`, n8n, the
  dashboard, Layer 1 logic or the evaluation boundary.

The authority question - a read-only feed, demo execution, or real-money execution - is the user's
and stays open. Do not settle it by quietly starting to build. A design document is not proof that a
connection works, that broker timing is causal, or that any edge exists.

## Evidence and validation

Documentation only, so no test run is required; if you run anything, report the exact command and
result. State unavailable information explicitly instead of inventing a file, a digest or a result.
Keep raw logs and screenshots in your own ignored `tmp/`, never in a tracked path.

## Reporting (mandatory)

Finish only by reporting. On completion, on a blocker or at a decision point:

1. write one envelope from `templates/submission.json` into your own ignored `tmp/` with status
   `ready_for_review`, `blocked` or `status_report`, the observed worktree/branch/base/HEAD, changed
   files, exact commands and results, artifact hashes, blockers, questions and a production
   disclosure;
2. submit it with `node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <file>`;
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity live-trading paused "<what finished>"`;
4. stop. Start no further work until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker live-trading`.

A blocker is submitted when it is found, not at the end of the task.

## Window and provider

Open `tools/live-trading-node/LiveTrading.code-workspace` in its own VS Code window, select
**DeepSeek** in the existing agent extension, and run *Mailbox: Connect This Cline Worker* once.
This adds no API key, no credential scope, no provider configuration and no background model
runner. The register marks this worker `mailbox_auto_connect`, so the connection is restored after a
reload. Keep exactly one Cline task open in that window: the bridge binds to the first workspace
folder's registered path and has no task selector. The startup message to paste is in
`docs/orchestration/AGENT_MESSAGES.md` and in `tools/live-trading-node/README.md`.
