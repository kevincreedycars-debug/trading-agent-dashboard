# The Layer 1 research programme: ownership, state and delivery order

This folder is the shared specification for the factor programme across all eight assets. It says who owns
what, which decisions are already made, which are open, and what a completed piece of work is allowed to
claim. It is written so that the three coordination lanes can work in parallel without editing each other's
files.

Start here, then read:

- `SHARED_CONTRACT.md` - the research contract itself: session, instruments, the five evidence kinds, the
  states a document passes through, and the rules that keep an upload from being mistaken for a validated rule.
- `INTERFACES.md` - the hand-off objects between the lanes: the prompt package, the stage return, the
  registration payload, the read-back, and the queue and allowance states the automation lane must implement.
- `PROMPT_AUDIT_20261025.md` - the audit of the generated USD prompt set, the one contract gap it found, the
  regeneration, and what remains open per asset.

The catalogue, the registry and the generated prompts stay where they are: `data/research-library/`,
`docs/research/factors/`, `docs/research/final/` and `docs/research/handoff/`. This folder describes them; it
does not duplicate them, and where a number changes the catalogue is the authority.

## Objective

Determine how each factor, alone and in combination with others, relates to the subsequent 24-hour asset
price direction, whether it provides incremental predictive information available at the decision cutoff, and
how it should be represented and tested in the Layer 1 algorithm. USD first, then EUR, GOLD, SILVER, NQ, BTC,
WTI and GBP, each with its own factor catalogue and instrument definitions.

The programme does not assume that a factor is useful or that more factors improve accuracy. Exclusion,
regime-only use and insufficient evidence are valid conclusions, and any claim of improved accuracy has to
come from an empirical test rather than from research prose.

## The three lanes

| Lane | Id | Worktree and branch | Owns | Assignment |
| --- | --- | --- | --- | --- |
| Research | `research-coordinator` | `D:/trading-agent-dashboard-codex/.local/worktrees/research-coordinator`, `workers/research-coordinator-20261025` | Prompt templates, factor briefs, prompt generation under `docs/research/` | `docs/orchestration/assignments/research-coordinator.md` |
| Automation | `automation-coordinator` | `D:/trading-agent-dashboard-codex/.local/worktrees/automation-coordinator`, `workers/automation-coordinator-20261025` | Supported Astra execution, queue, allowance handling, hosted registration | `docs/orchestration/assignments/automation-coordinator.md` |
| Integration | `central-orchestrator` | `D:/trading-agent-dashboard-codex` | This specification, the catalogue and registry schema, the dashboard, deployment, gate semantics | `docs/CURRENT_TASK.md` |

The two assignment files live in the canonical coordination checkout and are read from that absolute path.
They are deliberately not published with the site: the mailbox register is local coordination state, while
this folder is the part of the programme that belongs in the repository.

Nothing is sent to a model from the dashboard. A prompt is copied by a person or read by the automation lane;
the page holds no model credentials, and no lane may add one to it.

## Delivery order

1. **Agree the shared contract and the interfaces.** Written here on 2026-10-25. The contract is the owner's;
   the interface shapes are the integration lane's and stay proposals until both working lanes accept them.
2. **Integrate the cleaned USD prompt generator and review its generated outputs.** Done in the same cycle:
   see `PROMPT_AUDIT_20261025.md`. Seventy-eight prompts were regenerated from the authored chains and
   re-hashed, and the audit names what the set still lacks.
3. **Run one complete automated factor-chain pilot.** Blocked: no supported Astra execution route has been
   established, so nothing has been dispatched, returned or registered by a machine. This step owns its
   blocker and does not move until a route exists.
4. **Verify persistence, downloads, parent links, restart recovery and quota pauses.** Persistence, downloads
   and parent links were verified by hand on 2026-10-24 against the live page with the local service stopped;
   restart recovery and quota pauses are unverified and belong to step 3's lane.
5. **Expand to the remaining USD work, then the other assets.** Not started. No non-USD asset has factors,
   chains, prompts or instrument definitions, and every non-USD asset in the catalogue reads not started and
   refuses to inherit a USD result.

## Where the programme actually stands

Measured from the committed registry and catalogue on 2026-10-25, not from memory:

| Fact | Value |
| --- | --- |
| Factor chains | 25, three stages each, 78 generated prompts, plus the gated asset-level final chain |
| Delivered stages | 1 - the VIX factor chain's research report, `usd-baseline-audit-01-vix-usd-report` version 1 |
| VIX chain state | research delivered, red team awaiting a file, adjudication not started |
| Final asset chain | `usd-final-asset-analysis` locked at 0/25 factor chains complete, no stage rendered |
| Factor status | 22 research ready, 3 blocked on data access; review pending on all 25; backtest not tested on all 25 |
| Validated factors | 0. No factor has an accepted adjudication and a measured out-of-sample test |

The registry gate is not a formality: while the final chain is locked the store refuses a final-stage upload,
and a factor upload never unlocks it.

## What is not claimed here

- No automation works. No run has been executed end to end by any lane, and no document in the library was
  produced by a machine run.
- No factor is validated, and no document in the library is a trading rule.
- The label instrument and quote source for the USD session are still unresolved, so the session is defined
  but unmeasured.
- Nothing in this folder changed a live call, a weight, a threshold, an MT5 path, a workflow or a data file.

