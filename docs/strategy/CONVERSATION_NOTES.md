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

## 2026-09-20 - Why GBP is missing from the master run's step list

- `exports/master_orchestrator.json` shows the status node `Build Workflow Status JSON` carries a
  **hardcoded `stepNames` array**; the live `data/workflow-status.json` lists 16 steps — Silver and
  WTI are present, GBP is not.
- GBP nevertheless executes inside the refresh windows: the GBP worker's own close-out log records
  `agent_outputs` successes at `2026-09-20T11:57:44Z` and `2026-09-20T12:46:01Z`, its row lands in
  `data/layer1.json` before the writer commits (12:46:33Z), and today's Layer 2 evaluated GBP/USD
  ("Mixed or low conviction 24H signals") instead of reporting a missing 24H call — which it does
  when a Layer 1 input is absent.
- Conclusion: GBP runs but is **absent from the hardcoded status list** — an under-reporting defect
  in the dashboard's status surface, not a missing agent. Confidence is high but not proof: the repo
  cannot confirm the live node list because `exports/` is stale (`master_orchestrator.json` has 17
  nodes and also lacks Silver/WTI; `dashboard_writer.json` and `layer2_trade_selection_agent.json`
  still describe the pre-GBP system, as the GBP worker's own log notes at commit `7f84801`).
- Fix options, in order of preference: (a) if GBP call nodes exist in the live master, add GBP to
  `stepNames` (single-node edit); (b) if they do not, insert the GBP call before Layer 2 and Writer;
  (c) refresh the repo exports so this drift stops recurring. All require n8n credentials, so the
  work belongs to the coordinator, not this adviser.
- Related items carried forward from the GBP close-out: the live Layer 2 publisher scores only the
  seven USD-quoted pairs (GBP-quoted crosses are dashboard-derived), `factor_edge_lab.js` still lists
  GBP/USD as onboarding, `market_snapshots` has no GBP columns, and the platform-wide
  `_LEAN`/same-direction NO-TRADE policy is still open.

## 2026-09-20 - Session close (overnight handoff)

State saved. Nothing is running on this worker; activity is reported as stopped for the night.

- **Aim recorded** in `STRATEGY.md` section 0: all tracked assets give a 24-hour call, then Layer 2
  issues a higher-conviction cross-pair call when two Layer 1 calls disagree; the dashboard is the
  decision aid.
- **Live state verified** from n8n's committed outputs: eight agents live with today's 24H calls, and
  Layer 2 produced no trade (all pairs same-direction or low conviction) — the intended mechanic.
- **Diagnosis recorded**: GBP executes but is absent from the Master Orchestrator's hardcoded status
  step list; `exports/` is stale and cannot confirm the live node list.
- **Pending, awaiting the user's go-ahead**: a bounded orchestrator assignment covering (a) GBP in the
  master status list or master call nodes, (b) the delayed-endpoint fix for the `input-health.json`
  artifact last generated 2026-09-12, (c) refreshing the stale `exports/` so live-vs-repo drift stops
  recurring.
- **Open strategy questions carried over**: the Layer 2 role (economic-events adjuster vs
  opposing-call synthesis vs both in sequence), and the stopping rule for the gold sub-project.
- For a new session: read this file, `STRATEGY.md`, then canonical `CODEX_STARTUP.md` and the four
  state documents; the adviser holds no chat memory across sessions.

## 2026-09-20 - Communication preference: English only

- User requirement: English only in all replies and notes. One earlier chat reply accidentally opened
  with a Chinese sentence; the adviser apologised, re-verified that no strategy note contains
  non-English characters, and restated the content in English.
- Standing rule for future turns, together with the earlier preference for short replies (a few
  lines, at most one or two questions).

## 2026-09-21 - User request: "check inboxes"

- Ran the canonical mailbox check (`coordination.js check`, per worker and global) and the monitor
  snapshot. Result: **pending submissions 0**, **zero validation errors**, and **nothing new
  addressed to `strategy`**. The only file in `inbox/strategy` is the adviser's own
  `20260920-strategy-review-001`, whose reply file is a hash-bound `acknowledged`.
- Inbox contents by worker: `gold-research` 7 submissions (policy-transition-001, policy-002-r2,
  policy-003-r3, reaction-004-r1, reaction-005-r1, findings-summary-005-r1 and -r2); `gbp`,
  `silver`, `wti`, `eur-pairs` have empty inbox and reply folders. Registered status of each of
  those four is still `awaiting_status_submission`, so no reconciliation report exists yet.
- New since the adviser's last session (2026-09-20 21:29 local): the coordinator completed its own
  inbox sweep at 07:42-07:43 today and published
  `docs/orchestration/reviews/20260921-gold-findings-summary-005-r2.md` - decision **changes
  requested**, documentation classification only - plus updated `projects.json`,
  `CURRENT_TASK.md`, `ACTIVE_MILESTONE.md` and `SESSION_NOTES.md` to 2026-09-21.
- Substance of that review, recorded because it changes one earlier adviser assumption: revision 2's
  pooled-sign totals reproduce exactly (47/29/314, 48/21/298, 6/50/231), but the between-year
  classification still counts single-year states as agreement. Required correction moves six pooled
  and seven exact single-year states to not-assessable, giving corrected between-year totals of
  pooled 43/27/320, exact 41/21/305, delayed 6/50/231. Also requested: narrow the reproduction-scope
  wording (primary-horizon traversal describes consistency/conditioning counts, while the baseline
  table covers four horizons) and drop an unverified page-count assertion.
- `projects.json` for `gold-research` now reads `findings_digest_changes_requested`,
  `last_verified: 2026-09-21`, next action "Read revision-2 reply; correct between-year
  classification and submit a new digest. Phase 1 remains unassigned." The accepted measurement
  report stays accepted for exploratory use; the digest is not accepted.
- Adviser actions taken: none beyond reading and reporting. No submission filed, because no
  materially revised recommendation arose from an inbox check (the assignment says not to submit
  every chat turn). No canonical file, other worker or live system was touched.
- Open questions for the user, unchanged from the overnight handoff: (a) authorize the bounded
  orchestrator hygiene batch (GBP in the Master status list, the stale `input-health.json`
  artifact, refreshing stale `exports/`); (b) whether Phase 1 Gold return transformations should be
  assigned at all; (c) the Layer 2 role (economic-events adjuster vs opposing-call synthesis vs
  both); (d) a stopping rule for the gold sub-project.

## 2026-09-21 - User: refine the gold map into a "what/why/where" reference sheet

- User judged the first gold map "too messy" and asked specifically: which variables are tested and why, where each
  stands, how they are analysed and over what time frames (and why), where the data is stored and in what form, what
  the 28 drivers actually are, what the "36-hour FRED thing" is, what "anchor" means, and whether "pull the archive
  once" means a database. Design was left open, so the page was rebuilt around answers rather than the earlier
  waterfall styling.
- Rebuilt `docs/strategy/GOLD_ENGINE_MAP.html` as a five-band reference sheet: (1) header with status; (2) the engine
  in five moves; (3) the 28 drivers grouped by the live algorithm's factors F1-F10 with source and status;
  (4) "over what time frames and why" beside "how each driver is analysed"; (5) "where the data lives" beside
  "anchor and the 36-hour rule". Answering each question meant reading sources not previously opened: the coverage
  registry, the report registry (revision 6), the session/horizon policy registry, the three archive manifests and
  the head of the 80 MB accepted report, summarised by ignored scripts `tmp/extract-gold-facts.js`,
  `tmp/archive-facts.js`, `tmp/peek-report-inputs.js` (outputs `tmp/gold-facts.txt`, `tmp/archive-facts.txt`).
- Facts newly verified for the sheet:
  - The 28 declared drivers map to ten weighted factors (F1 real yield, F2 dollar, F3 Fed stance, F4 2-year,
    F5 gold itself, F6 VIX, F7 events, F8 inflation, F9 news tone, F10 regimes) drawn from
    `logic/agent_gold_direction.md` plus explicit event decomposition; twenty of the twenty-eight are levels or
    transformations of five macro/price series, so they are not twenty independent inputs.
  - Measured today: the three 10-year real-yield rows, the three 2-year rows, gold_price and the three new
    prior-return rows, the three VIX rows, and the six event rows = 19. Unmeasured: dxy_level plus the three dxy
    changes, fed_bias, inflation_signal, risk_headline_context, equities_regime, growth_regime = 9.
  - Discrepancy worth the coordinator's attention: report registry revision 6 marks `fed_bias` and
    `inflation_signal` as **measured** by declared redefinition (Fed target-range direction from DFEDTARU; five-year
    breakeven T5YIE, 20-observation change), while the accepted digest and its coverage plan classify both as
    unmeasured with "unavailable source". The accepted report ran on an archive that contains neither series, so
    both produced no values - which resolves the count to 19, but the two documents read inconsistently.
  - Data: three JSON archives under the canonical checkout - hourly gold candles (21,871 bars, bid/mid/ask, 2023-01-02
    to 2026-09-11, merged from 15 hashed page files), merged US HIGH/MEDIUM events (5,115 rows, 1,130 HIGH / 3,985
    MEDIUM, 2022-12-01 to 2026-09-11), and five FRED vintage series (DFII10, DGS2, DGS10, VIXCLS, DTWEXBGS;
    1,008-2,146 observations each, 2022-11-01 to 2026-09-12). No database and no warehouse: plain JSON, one
    directory per acquisition, each file hashed in `manifest.json`, read-only afterwards.
  - The 36-hour rule: FRED vintages carry a date, not a publication instant, so a macro value counts as available at
    `vintage date + 36h` (`backtester/lib/gold_macro_vintage_dataset.js`, `vintage_date_plus_36h_conservative_proxy`);
    conservative means later than reality, never earlier.
  - Anchor: the t=0 of one test - a weekday 14:00 UTC grid slot (964) or a real release instant (5,106); entry price
    is the close of the candle containing the anchor, available one hour later, which is why entry/endpoint delay is
    disclosed, and one anchor feeds every horizon, driver and cell.
  - Frames and why: h24 primary (the product is a 24-hour call), h1/h4 declared diagnostics that may never be formula
    inputs, five-session close for the L2L / 0.5 L2L horizon, sub-hourly declared but unsupported at H1. Endpoint
    kinds are never pooled; daily h24 is 766 exact + 198 delayed = 964. Analysis: pre-declared states (median split,
    sign, event family, present/missing, surprise sign, age bucket), per-state counts/medians/quartiles with
    subset year breakdowns, then one-variable-at-a-time conditioning over 8 prior-context fields (1,192 daily +
    7,178 event cells), min n = 20.
- Also observed while reading: a fresh acquisition directory `backtester/tmp/gold-fred-coverage-008-20260921/`
  already holds DFEDTARU and T5YIE beside the older five series, i.e. the in-flight batch is fetching exactly the two
  series the discrepancy above turns on.
- Validation: `tmp/check-gold-engine-map.js` (Playwright, print media, A4 width) - 198.0 x 277.3 mm against the
  285 mm printable height, one PDF page, 4 tables, 19 table rows, 4 boxes, 11 status pills, no unrendered entities.
  Iterations measured 376.2 mm, 357.7 mm, 352.4 mm, 314.1 mm before the grouped-factor table brought it to one page.
- No canonical file, other worker or live system touched. All extraction ran read-only against the canonical
  archives and the gold worker's registries.

## 2026-09-21 - User: printable map of the gold backtest engine (A4) - first version, later superseded

- User asked for a second one-page map in the same style, this time for the gold instance of the backtest engine:
  what it does, what is tested, why it takes time, where the tests are stored and how to access them.
- Delivered `docs/strategy/GOLD_ENGINE_MAP.html` - one A4, seven-step waterfall (declare > acquire > as-of dataset
  > anchor > measure > condition > publish/reproduce) with a rail for "where the batch is now", "where it lives /
  how to open it", "why each batch takes time" and "not established". Print-validated: 198.0 x 282.9 mm, one PDF
  page, columns balanced at 242.4 / 244.6 mm (`tmp/check-gold-engine-map.js`, preview in ignored `tmp/`).
- State re-verified while building it - the engine has moved since the previous turn:
  **coverage-006 is accepted** (worker clean at `4e051ca`, review `reviews/20260921-gold-coverage-006-r1.md`):
  19 of 28 drivers measured (was 16) after the three prior-return transformations were implemented and measured;
  report content hash `c4da8de535b028449d338b727271794b8ea632adacae86bbba5df6c7a7cc7369`; digest revision 4
  (`docs/GOLD_VARIABLE_FINDINGS_AND_COVERAGE.md`, 281 lines, sha256 `1917b201f4af2ef96fbc267a81784b0a766f0ee21b00f8a62f14fa0a6d85aa12`)
  plus ignored companion `tmp/findings-tables-full-coverage-006-20260921.md`; coordinator reran the batch and
  reproduced the hashes; focused runs 15/15, 23/23, 24/24; full suite 402 tests, 398 pass, four pre-existing
  secret-scanner failures. Original 16 variable blocks and baselines are byte-identical to the accepted 005
  report; conditioning grew from 19,170 to 20,709 cells; digest-reported conditioning cells are 1,192 daily
  (413 at or above min_n) and 7,178 event (1,576 at or above).
- New canonical position: `CURRENT_TASK.md` now names assignment **gold-source-007** (sources and timing for the
  remaining drivers, DXY feasibility, exact consumed-data ranges) with a standing instruction to advance research
  without repeated approval requests; `ACTIVE_MILESTONE.md` has moved to "automatic mailbox communication"
  (Cline worker bridge built and installed, live connection pending). My earlier advisory review 1 sequencing and
  the "Phase 1 awaiting user decision" line in it are therefore superseded - flagged for the next material update.
- Adviser posture unchanged and restated on the map: descriptive association only, no driver formula-eligible,
  archive-inferred calendar, prior-return drivers share the archive that prices the outcome, counts overlap.
- No canonical file, other worker or live system touched.

## 2026-09-21 - User: printable programme map (A4) + full programme statement

- User gave the whole programme in one message and asked for a single A4 printable waterfall map of it, confirming
  it makes sense. Recorded in full in `docs/strategy/STRATEGY.md` section 0b; the map is
  `docs/strategy/PROGRAM_MAP.html`.
- Programme as stated: Northstar (high-conviction 24h call on tested macro inputs) -> Layer 1 weighted algorithms
  built in n8n from researched inputs -> Layer 2 pairs opposing calls with a strength rating -> **backtest engine
  built now, standalone and asset-agnostic, gold first** (every known gold driver ingested; each reviewed daily for
  its 24h then 5-day influence; variables combined until clear patterns show what truly drives price; Layer 1
  rebuilt on measured weights; new algorithm vs baseline over 2+ years on direction, L2L and 0.5 L2L) -> re-qualify
  and swap into the live dashboard -> run the engine on all traded assets -> automated bot placing daily 0.5 L2L
  trades only where same-day conviction is consistently above 60%.
- Adviser confirmation given, with three qualifications: (1) "accurate and profitable" is two gates - directional
  evidence and executable evidence (bid/ask, spread, fills, adverse boundary); accepted gold work is
  `executable_trade_validated: false`. (2) Above 60% needs an untouched test, a predeclared denominator,
  dependence-aware uncertainty and a predeclared lower confidence bound above 60% plus a baseline beat; 60% is a
  target, not a guarantee. (3) Coverage is not evidence, and replacing live Layer 1 is a production change needing
  explicit authorization.
- Map build: one self-contained HTML page in `docs/strategy/`, print CSS `@page A4 portrait, 6 mm margin`, seven
  numbered stages with dependency arrows, amber "you are here" on stage 3, and a right-hand rail (you are here,
  gates, not-true-yet, decision queue, how to read it).
- Validation, run from ignored `tmp/check-program-map.js` with Playwright from the canonical `node_modules`:
  rendered at A4 width, print media emulated - sheet 198.0 x 261.8 mm against a 285 mm printable height, one PDF
  page, 7 stages, 5 rail cards, 9 flow chips, both columns balanced (222.7 mm vs 226.1 mm). Preview PNG and PDF
  stay in ignored `tmp/`. Earlier iteration measured 311.7 mm (two pages) and was trimmed before delivery.
- No canonical file, other worker or live system touched; the map is advisory documentation only.

## 2026-09-21 - User challenge: "we are building out the backtesting engine through gold, no? Has this objective got lost?"

- The user is substantially right. `docs/BACKTESTING_REVIEW_PLAN.md` (baseline 2026-09-07) does
  frame Gold as the first bounded review of the **existing** engine: `gold_asof_dataset.js` /
  `gold_stored_call_evidence.js` are marked "First review target", `gold_timestamped_evaluation.js`
  "First evaluator target", and "other assets follow Gold qualification". Working discipline is
  explicit: "Avoid building another engine until this inventory demonstrates why an existing path
  cannot answer the question."
- What has genuinely advanced the engine: shared harness `backtester/lib/variable_event_research.js`
  with its contract doc, the 28-variable coverage registry (b8193ba, accepted 0b0e92d), the
  timestamped evaluator contract v2, and the accepted exploratory reaction report.
- What has not moved (engine gates named in the same plan and in
  `GOLD_RESEARCH_DELIVERY_CONTRACT.md`): dependence-adjusted inference ("remains to implement"),
  a predeclared untouched Gold holdout, original release/consensus vintage provenance, the
  executable-research gate (`executable_trade_validated: false`), and asset-by-asset extension of
  the proven contract.
- Where the drift came from: the 2026-09-19 scope change made descriptive variable-price research
  the immediate objective, so coverage (a dataset objective) took precedence over the engine gates.
  The last three Gold cycles (policy-002/003, reaction-004/005, findings-digest r1-r3) were
  documentation/classification correctness on one report - valuable, but no new engine capability.
- Phase 1 as recorded for the user: `gold_d1_pct`, `gold_d5_pct`, `gold_d20_pct` declared in the
  policy registry before outcomes, implemented as prior 1/5/20-session close-to-close windows from
  the hourly archive already on disk with strict prior cutoffs, boundary unit tests, no acquisition.
  Effect is measured coverage 16/28 -> 19/28. It is a coverage step; it does not touch the calendar,
  vintage, dependence or holdout limits.
- Adviser position: if the objective is the engine, the next Gold cycle should be bound to an engine
  gate (dependence/overlap-aware uncertainty plus a predeclared holdout split), with Phase 1 folded
  in as the small data-side step; if the objective is coverage, Phase 1 alone is fine but should be
  labelled a coverage step. Recorded question put to the user: (a) Phase 1 only, (b) Phase 1 plus an
  engine gate, or (c) engine gate only.

## 2026-09-21 - Standing rule: short chat replies (reinforced)

- User: "these messages are too long". Hard rule for this adviser from now on: chat replies are a
  few short lines - headline plus at most one or two questions. No tables, no multi-section
  strategy essays in chat. All depth goes into `docs/strategy/` notes instead, and links to them.
- Applies retroactively to the previous two turns: the strategy framing was delivered as a long
  reply; the same content is already in this file (2026-09-21 strategy options A/B/C) and that is
  where it belongs.

## 2026-09-21 - User request: "lets think on the strategy here"

State re-verified at the start of the turn (canonical CLI + absolute-path reads):

- `gold-research` submitted findings-digest revision 3 and the coordinator **accepted** it at
  `ffa380c` (`reviews/20260921-gold-findings-summary-005-r3.md`): corrected between-year totals
  reproduced (pooled 43/27/320, exact 41/21/305, delayed 6/50/231), digest and companion regenerated
  byte-for-byte. `projects.json` now reads `accepted_exploratory_awaiting_next_assignment`,
  next action "Hold; Phase 1 prior Gold return transformations proposed, awaiting user confirmation
  and new assignment." `CURRENT_TASK.md` and `ACTIVE_MILESTONE.md` both reduce the immediate
  decision to Phase 1 authorization.
- `DECISIONS.md` gained the consistency rule (two supported years required for any between-year
  claim) at 07:44 today.
- Unchanged: `gbp`, `silver`, `wti`, `eur-pairs` still `awaiting_status_submission` with empty
  inboxes and no session; coordinator idle; mailbox `pending 0`, `errors []`.
- Adviser's earlier `gold-calendar-status-001` proposal is largely overtaken: the two-mode
  convention already exists in practice as `archive_fit_exploratory` with `verified_continuity`
  blocked, so what remains is a policy decision, not an implementation gap.


## 2026-09-21 - User: retitle the gold sheet and restore the full driver list

- Three changes requested and made to `docs/strategy/GOLD_ENGINE_MAP.html`: title is now
  "Backtesting agent architecture - XAU (Gold)"; the driver section lists all 28 drivers individually
  again (one row each, numbered with its factor id, why, source and status) instead of grouping them
  by factor; and the sub-hourly row was removed from the time-frames table because that horizon is not
  being measured.
- To fit one A4 with 28 individual rows: the driver tables use a fixed layout (10.5 / 33 / 34 / 15 mm),
  the "why" text carries the source after a separator so the separate source column could go, and the
  long paragraphs in the data box were tightened. Re-measured with `tmp/check-gold-engine-map.js`:
  198.0 x 283.0 mm, one PDF page, 4 tables, 28 driver rows (36 rows including the frames and archive
  tables), 29 status pills, no unrendered entities. Intermediate builds measured 348.5 mm (28 rows with

## 2026-09-21 - Session close (user: "save here for tonight")

State saved. Nothing is running on this worker; activity is reported as stopped for the night. Worktree
`D:/trading-agent-dashboard-codex/.local/worktrees/strategy` is clean on `workers/strategy-advisory-20260920`
at `cd7606c`; all advisor writes are under `docs/strategy/` (STRATEGY.md, CONVERSATION_NOTES.md,
PROGRAM_MAP.html, GOLD_ENGINE_MAP.html) plus ignored `tmp/` scratch.

Advisor submissions: review 1 (`20260920-strategy-review-001`) is still the only one, acknowledged; mailbox
`check --worker strategy` returns `pending 0`, `errors []`, nothing new addressed to this worker.

What was delivered today: the two printable A4 maps (programme map; gold architecture sheet, retitled
"Backtesting agent architecture - XAU (Gold)" with the full 28-driver list), the staged programme recorded in
`STRATEGY.md` section 0b, and these notes. Verification for the sheets is in `tmp/check-program-map.js` and
`tmp/check-gold-engine-map.js` (print media, A4 width, page count); extraction scripts and outputs are in
`tmp/extract-gold-facts.js`, `tmp/archive-facts.js`, `tmp/peek-report-inputs.js` and their `.txt` outputs.

State of the project at close (read from the canonical mailbox and monitor):

- Gold coverage moved twice today after the sheet was built: coverage-006 accepted (19 of 28 measured), then
  **coverage-008 submitted and reviewed with changes requested** - core evidence reproduced (fresh report content
  hash `14447d8fd995900dbe9b80b7b98f233dbd20ffd7ec8faa1268d8f191d565ccb4`, focused tests 70/70, local 410/410, all
  19 earlier variable blocks invariant) but one provenance contradiction must be corrected: the digest says no
  final-test split was consumed, while the accepted manifest records the L2L final-test period
  2025-10-01 through 2026-04-30 as consumed and ineligible as a fresh test. Coverage is now **21 of 28 measured**
  (fed_bias via FRED DFEDTARU policy-step direction; inflation_signal via T5YIE 20-observation change), with
  **7 variables remaining** and Phase 1b shown complete in that digest.
- That resolves the registry-versus-digest wording discrepancy I flagged this afternoon: both series now have
  data, and the count is 21 rather than 19.
- Coordinator: auto coordinator paused, waiting for instruction; gold worker wake notification sent for
  coverage-008 with pickup unconfirmed ("check worker window if this persists").
- Unchanged: `gbp`, `silver`, `wti`, `eur-pairs` have never submitted; the live-path hygiene items (GBP missing
  from the Master status list, stale `input-health.json`, drifted `exports/`) are still open; the L2L final-test
  interval being consumed means no fresh gold holdout is reserved while that manifest stands.

First tasks for the next session, in order:

1. Refresh `docs/strategy/GOLD_ENGINE_MAP.html` to 21 of 28 (fed_bias and inflation_signal become measured with
   their declared redefinitions; the remaining 7 are the DXY block, risk_headline_context, equities_regime,
   growth_regime) and to the newer digest revision, then re-run the print check.
2. Re-read the coverage-008 revision and review before any advice that depends on those counts.
3. Decide with the user whether to send the coordinator the live-path hygiene batch (GBP status list,
   input-health freshness, stale exports) - the only open item from my side that is not gold research.

Still open for the user, carried forward: the Layer 2 role (economic-events adjuster vs opposing-call synthesis
vs both), a stopping rule for the gold sub-project, and whether the live-path hygiene batch should be authorized
now. No implementation, canonical edit, credential use or production action arose from this session.

  five columns), 300 mm, 297.2 mm, 283 mm.
- The page keeps the "19 measured, 9 not yet" note, now naming the blocks rather than two rows.

Strategic reading recorded for the user (advice, not adopted):

1. **The constraint is decision and review bandwidth, not measurement capacity.** One coordinator
   review slot and one user session gate every worker cycle, so the question is which decision a
   proposed cycle unlocks - not how much can be measured.
2. **The gold sub-project has a criteria hole.** Its order is direction AND magnitude ->
   conditioning -> combinations with year stability -> frozen formula and untouched
   qualification, but nothing declares the numeric bar (minimum n, minimum magnitude, flat-band /
   neutral definition, how many attempts are accounted for, whether archive-inferred calendar can
   ever support a formula input). The accepted digest is explicitly ineligible as formula input and
   shows why: pooled directions sit near balance (daily h24 964 = 483/482/0), medians are small and
   positive at every horizon, conditioning cells are mostly below `min_n` (daily 321/929; event
   1411/6843 at or above), and only 43 of 390 pooled states can be assessed for between-year
   agreement. Without a declared bar, each new variable adds rows, not decisions.
3. **Phase 1 is cheap but buys coverage, not evidence.** The three transformations
   (`gold_d1_pct`, `gold_d5_pct`, `gold_d20_pct`) use the existing hourly archive, no acquisition,
   and would lift measured coverage from 16/28 to 19/28. They cannot lift the calendar,
   vintage or independence limitations and they are not on the live path.
4. **The live path is the stated product promise and is cheaper to finish than to keep
   documenting.** Eight Layer 1 agents are live; the remaining gaps are honesty and observability:
   GBP absent from the Master status step list, `input-health.json` still a stale artifact,
   `exports/` drift, and the repo's published agent set still reading five. None of that depends on
   gold research, and the four unreconciled asset workers are the real "all tracked assets" risk.

Options put to the user, with the adviser's lean:

- **A. Gold-forward:** authorize Phase 1 now, and require the same assignment (or a small parallel
  one) to declare the qualification bar and the open decisions (flat band, delay strata, DXY path)
  so Phase 1 output is interpretable on arrival.
- **B. Live-path-first:** run the bounded hygiene batch (GBP status list, `input-health.json`,
  `exports/` refresh) plus one asset worker status reconciliation, and leave gold holding.
- **C. Gate-first:** define the qualification bar and Phase 2/DXY decisions before any further
  measurement, accepting an idle gold worker.

Adviser recommendation: **A and B together, one item per lane** - they consume different resources
(gold worker cycle vs coordinator/credential path), both are small, and neither blocks the other.
Do not authorize both Phase 1 and a Phase 2 source hunt in the same batch, and do not let more than
one gold assignment be in flight at a time. Standing caution restated: nothing in the accepted gold
work is a trading result, and coverage growth is not evidence growth.

Open questions for the user from this turn: (1) authorize Phase 1 as recommended, hold gold, or
gate-first; (2) authorize the live-path hygiene batch (and if so, which asset worker reconciles
first).

## 2026-09-22 - Session close: status check only, no changes

- User asked the adviser to recall recent memory/work and compare the adviser model to DeepSeek;
  no implementation, canonical edit, credential use or production action was requested or taken.
- Adviser confirmed no persistent memory existed yet for this project (fresh memory store) and
  read the state back from this file instead: coverage-008 changes-requested status, the 21/28
  gold coverage count, the live-path hygiene gaps, and the three carried-forward options (A/B/C)
  and open decisions (Layer 2 role, gold stopping rule, hygiene batch authorization) all still
  stand unchanged from the 2026-09-21 close.
- Adviser has now written its own persistent memory of this project state for future sessions
  (separate from this file, which remains the canonical dated record).
- Nothing new to carry forward beyond what the 2026-09-21 close already listed as first tasks.
