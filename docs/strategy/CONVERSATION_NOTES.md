# Strategy conversation notes

Record dated user decisions, questions and recommendations here. No discussion has been recorded yet.

## 2026-09-20 - User request: this window only, darker purple (environment change)

- The user first asked for the VS Code window to be dark purple, then narrowed the requirement: only
  the strategy window, darker purple, all other windows untouched.
- Sequence of actions:
  1. A global `workbench.colorCustomizations` block (90 keys) plus `"window.titleBarStyle": "custom"`
     was first added to the VS Code **user** settings
     `C:\Users\A17\AppData\Roaming\Code\User\settings.json`. User settings are machine-global, so this
     coloured every VS Code window, including other workers' windows. Reverted on user instruction;
     the file is now byte-identical to its pre-change backup (SHA256
     `3A05AABB5168B285549F750A89C7BE535D100283ED6B36C303DCA996B0593184`).
  2. Darker palette (deep aubergine: editor/side bar `#120A1D`, activity bar/panel/terminal `#0D0716`,
     raised surfaces `#1A0F2B`, selection `#241338`, borders `#2B1745`, accent `#7C3AED`, text
     `#DCD3EE`) written to the git-ignored, folder-scoped
     `.vscode/settings.json` of this worktree (90 colour keys, `Dark+` syntax colours untouched).
  3. Scope finding: this window is a multi-root workspace opened from
     `D:\trading-agent-dashboard-codex\tools\strategy-node\Strategy.code-workspace` (folders: this
     worktree plus the central checkout), identified via the most recently written
     `%APPDATA%\Code\User\workspaceStorage\f828deb49f18ad711159df15879fab7a\workspace.json`. In a
     multi-root window, window-level colours resolve from the workspace file's `settings` block, so
     the folder-scoped file covers this folder only when it is opened on its own. That workspace file
     lives in the central reference folder, which this assignment forbids editing, so the change was
     held pending explicit authorisation.
  4. The user authorised that single central-folder edit, and the darker palette (90 keys, identical
     to the folder-scoped file) was added to the workspace file's `settings` block, leaving the
     existing `window.title` and `git.autoRepositoryDetection` untouched. The central checkout now
     shows ` M tools/strategy-node/Strategy.code-workspace` - an authorised, intentional change made
     from this window's worker.
  5. `window.titleBarStyle` is deliberately not set anywhere: this build already defaults to the
     custom title bar (the shipped workbench bundle returns `"custom"` from its title-bar style
     resolver), so the `titleBar.*` colours apply without it and no application-scoped setting is
     needed.
  6. The user then judged the full palette "all too purple" and asked for the default colour scheme
     with only a purple tint, purely to identify the window. The colour block was replaced by a 12-key
     tint in both places (title bar, activity bar + badge, status bar, `window.activeBorder` /
     `window.inactiveBorder`, `focusBorder`); every editor, side-bar, tab, panel, terminal, menu and
     list surface plus all syntax colours are back to the `Dark+` defaults.
- Verification performed: user settings restored byte-identically (SHA256 match against the backup);
  both the workspace file and the folder fallback parse as strict JSON, carry only valid hex values
  (90 keys for the full palette, 12 for the final tint), and use only colour ids that exist as
  literals in the bundles shipped with VS Code 1.136.1 (commit a44adf7f53); the canonical diff is a
  small additive change with no line-ending churn; the worktree
  `git status` stays clean because `.gitignore:37` (`/.vscode/`) hides the folder file.
- Rollback: remove the `workbench.colorCustomizations` block from
  `D:\trading-agent-dashboard-codex\tools\strategy-node\Strategy.code-workspace`, delete
  `d:\trading-agent-dashboard-codex\.local\worktrees\strategy\.vscode\settings.json` (and the
  `.vscode` folder), and keep
  `C:\Users\A17\AppData\Roaming\Code\User\settings.json.strategy-backup-20260920` as the user-level
  restore point.
- No project/strategy decision was made in this turn, so no submission was filed.

## 2026-09-20 - User asked for a project status review

- User: "start a new chat session then lets review where the project is currently at?" A chat
  session cannot be created from inside one (that is the extension's New Task action), so this
  session carried the review instead; `docs/strategy/STRATEGY.md` and these notes are the durable
  context a fresh session should read first.
- Adviser produced `docs/strategy/STRATEGY.md` (review 1) from read-only evidence: canonical
  `CURRENT_STATE.md`, `CURRENT_TASK.md`, `ACTIVE_MILESTONE.md`, `SESSION_NOTES.md`, the
  orchestration register/decisions/README, both gold reviews, the mailbox check and the monitor
  snapshot. Live states at review time: `gold-research` working on `gold-policy-003`; `gbp`,
  `silver`, `wti`, `eur-pairs` not started with status-reconciliation assignments published.
- Recommendation submitted to the coordinator mailbox as `20260920-strategy-review-001`
  (`ready_for_review`), whose headline is the bounded assignment `gold-calendar-status-001`
  (two-mode calendar status, one read-only provider-evidence attempt, a regression forbidding
  verified/exact-24h labels in inferred mode, no gap fitting) plus a ranked order of work.
- Open questions raised for the user: priority order (gold research depth vs asset-worker
  reconciliation vs dashboard/production hygiene), realistic worker sessions per day, provider
  calendar evidence versus an adopted inferred-mode convention, and a stopping rule for the gold
  enquiry.
- No implementation, no canonical edits, no production action arose from this review.

## 2026-09-20 - Display name: "Strategy Agent"

- User asked for this adviser to be labelled **Strategy Agent** in this window and on the monitor card.
- Window title updated in the workspace file to `Strategy Agent | DeepSeek | ...`. The worker id
  stays `strategy` everywhere it is a key (mailbox folder, register, activity file, assignment id),
  because `coordination.js` validates the id against the register and the mailbox path.
- Monitor card label still shows `strategy`: it renders `projects.json` worker ids through
  `scripts/monitor-state.js` into `ProjectMonitor.cs`. A display rename needs a small patch in those
  three files plus a monitor rebuild, which is outside this worker's write scope - pending user
  go-ahead or a coordinator change.
- Also noted for future turns: keep chat replies short (a few lines, one or two questions).

## 2026-09-20 - Project aim stated by the user

- Aim: every tracked asset gives a **24-hour directional call**; Layer 2 then issues a
  **higher-conviction cross-pair call when two Layer 1 calls move in opposing directions**. The
  dashboard is the decision aid for acting on those calls.
- Recorded at the top of `docs/strategy/STRATEGY.md`, with the implications: the gold
  session/calendar policy is on the critical path (a 24h call needs a defined session interval);
  "all tracked assets" makes the four unreported workers part of the core aim; and Layer 2's
  documented economic-event role differs from the divergence-synthesis role the aim implies.
- Open question put to the user: is Layer 2 the eco-event adjuster (as `README.md` documents), the
  opposing-call divergence synthesizer (as the aim implies), or eco-event adjustment followed by
  divergence synthesis?
- User asked for a copy-ready instruction for the orchestrator: rename this worker's monitor card to
  "Strategy Agent" (patch `projects.json` + `monitor-state.js` + `ProjectMonitor.cs`, rebuild and
  restart the monitor; the worker id stays `strategy`) and record the aim in canonical memory.

## 2026-09-20 - Correction: gold is a separate sub-project, not the live path

- User clarified the aim structure: **two tracks**. The gold work currently in flight is its own
  research sub-project — identify how gold's input variables actually relate to real price
  movement, then build the daily call formula from real-data-supported probabilities. It is **not**
  the live dashboard path.
- Corrected `docs/strategy/STRATEGY.md`: the earlier note that gold session/calendar policy is on
  the critical path for the 24h-call aim was wrong and has been replaced with the two-track
  statement.
- Still open on the live path: (a) does each Layer 1 agent already emit a 24h call on a daily
  schedule, or only when a refresh is triggered; (b) is Layer 2 the economic-events adjuster, the
  opposing-call divergence synthesizer, or events followed by divergence.

## 2026-09-20 - Correction: eight tracked assets, not five

- User corrected the adviser: there are **8** Layer 1 assets now. Verified in canonical:
  `script.js` maps eight asset codes (USD, EUR, GOLD, NQ, BTC, GBP, SILVER, WTI) in its pair and
  weekday tables, while the *published* agent set still lists five — `README.md`,
  `data/layer1.json` (`dashboard_meta.required_agents`) and `script.js` `orderedAgents`.
- `data/layer1.json` in the repository is dated 2026-09-07T06:14Z, so the published decision aid may
  be showing five stale calls rather than eight current ones.
- `data/layer2.json` names its source `layer_2_trade_selection_agent` and currently emits only
  `avoid_today` entries (EUR/USD, XAU/USD, BTC/USD, NQ/USD) with reason "Missing 24H conviction from
  one or both Layer 1 assets". So production Layer 2 already pairs assets for selection — closer to
  the user's aim than the README's Eco Events description.
- Open questions: are GBP/SILVER/WTI live in n8n and emitting 24h calls, or still worktree drafts;
  and is the dashboard grid meant to display all eight assets?
- Implication for advice: before recommending sequencing, the *count and live status* of Layer 1
  producers must come from runtime evidence, not from the memory docs, which are stale on this point.

### Verified live state (read from n8n's own committed outputs on origin/main, 2026-09-20)

- `data/layer1.json` @ `0930132` (12:46:33Z today): `required_agents` = **8** — USD, EUR, GOLD,
  SILVER, NQ, BTC, WTI, GBP — all `status: live`, all with a 24H call from today's run:
  USD BULLISH 60, EUR BULLISH 70, GOLD BEARISH 45, SILVER BEARISH_LEAN 24, NQ BULLISH 100,
  BTC BULLISH 82, WTI BULLISH 62, GBP BULLISH_LEAN 32 (expiry 2026-09-21/22).
- `data/layer2.json` @ `b0806bf`: source `layer_2_trade_selection_agent`, `trade_opportunities: []`
  today, with seven `avoid_today` entries (EUR/USD, XAU/USD, BTC/USD, NQ/USD, WTI/USD, XAG/USD,
  GBP/USD) explained as "Both assets point in the same 24H direction" or "Mixed or low conviction
  24H signals". So production Layer 2 already implements the user's aim mechanic: a pair trade only
  when the two 24H calls disagree.
- `data/workflow-status.json` @ `1a8edd8`: `success`, "Manual Refresh Complete", 16 steps all
  success, including Silver Collector, WTI Layer 1 Agent, Silver Layer 1 Agent, Layer 2 Trade
  Selection Agent and Dashboard Writer. **GBP Collector and GBP Layer 1 Agent are not among the
  recorded steps**, yet GBP has a fresh call — so GBP appears to run outside the Master run.
- `data/input-health.json` `generated_at` = **2026-09-12T19:05:56Z**, eight days older than today's
  successful run, so the dashboard's health badge can still be driven by a stale artifact.
- The canonical checkout's own branch is behind origin/main for `data/`, which is why the first pass
  saw a September 7 copy and five agents; memory docs (README, CURRENT_STATE) still say five.
- Adviser could not query the n8n API directly (this assignment has no credential access); the
  evidence above comes from the artifacts n8n itself commits after each run.

## 2026-09-20 - Communication preference: English only

- User requirement: English only in all replies and notes. One earlier chat reply accidentally opened
  with a Chinese sentence; the adviser apologised, re-verified that no strategy note contains
  non-English characters, and restated the content in English.
- Standing rule for future turns, together with the earlier preference for short replies (a few
  lines, at most one or two questions).
