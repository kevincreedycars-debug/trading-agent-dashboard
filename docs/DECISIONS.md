# Decision Log

Each new decision should include the date, decision, reasoning, and alternatives considered.

## 2026-06-19 — GitHub as Source of Truth

Decision: GitHub is the canonical source of truth for project memory, architecture, logic documents, workflow exports, and development state.

Reason: The platform is too large to rely on chat history. Future ChatGPT/Codex sessions need durable state.

## 2026-06-19 — n8n as Execution Engine

Decision: n8n remains the execution engine for collectors, agents, orchestration, and dashboard writing.

Reason: Existing workflows are already operational and should not be replaced unless required.

## 2026-06-19 — n8n API First, MCP Second

Decision: Use the n8n API first for direct workflow inspection/editing/execution. Add MCP later if it improves AI workflow navigation.

Reason: The API is the cleaner production interface. MCP may be valuable for AI-native browsing but should not be the first dependency.

## 2026-06-19 — Preserve Layer 1 Isolation

Decision: Layer 1 agents must remain independent raw directional agents.

Reason: Layer 1 must provide uncontaminated raw calls before Layer 2 economic-event adjustment or cross-asset synthesis.

## 2026-06-20 — Dashboard Trigger Uses Webhook And Status File

Decision: The public dashboard triggers the Master Orchestrator through an n8n webhook and reads run state from `data/workflow-status.json`.

Reason: The static dashboard must never expose the n8n API key. A webhook plus GitHub-published status file keeps credentials out of browser code while still allowing the dashboard to show success and failure reports.

## 2026-06-20 - Codex Startup Uses Permanent Working Memory

Decision: Codex must read `CODEX_STARTUP.md` first, then the project memory and architecture documents, before editing files.

Reason: Project context must survive between sessions without relying on chat history. A fixed startup sequence makes the repository memory authoritative and reduces accidental work from stale context.

Alternatives considered: relying on chat history, keeping memory only in `CODEX.md`, or duplicating memory files at the repository root. These were rejected because they are easier to miss, less explicit as a session procedure, or create duplicate sources of truth.

## 2026-06-20 - Canonical Memory Documents Live Under `docs/`

Decision: Keep project memory documents under `docs/`, with only `CODEX_STARTUP.md` at the repository root as the first-read entry point.

Reason: Existing memory files already live in `docs/`, and preserving that structure avoids duplicate root-level files with the same purpose.

Alternatives considered: moving all memory files to the repository root or creating root-level duplicates. Both were rejected because they would churn existing documentation and risk conflicting sources of truth.

## 2026-06-20 - Continuous Project Memory Maintenance

Decision: Meaningful completed work must update the relevant project memory documents immediately and be committed as a logical milestone before continuing.

Reason: Long Codex sessions can end unexpectedly. Updating memory and committing at each milestone keeps GitHub recoverable as the project source of truth without relying on chat history.

Alternatives considered: updating documentation only at session end or making very large combined commits. These were rejected because they increase the amount of project state that can be lost or become hard to review.

## 2026-06-20 - Active Milestone Checkpoint

Decision: Add `docs/ACTIVE_MILESTONE.md` as the live checkpoint for the current feature, read it during startup immediately after `docs/CURRENT_TASK.md`, and keep it current whenever work pauses or the active task changes.

Reason: `docs/CHANGELOG.md` records completed history, but new Codex sessions need one concise file that states what is being worked on right now and the exact next action.

Alternatives considered: using only `docs/SESSION_NOTES.md` or adding milestone history to `docs/CHANGELOG.md`. These were rejected because session notes can be broader handoff text, and changelog should remain completed-work history rather than a live checkpoint.

## 2026-06-20 - Smart Startup Uses Staged Context Loading

Decision: `CODEX_STARTUP.md` remains the single startup entry point, but startup should always load only the core memory files first and load additional documentation only when it is relevant to the current task.

Reason: Reading every memory document on every session adds unnecessary context load and makes startup less efficient. A staged startup keeps the repository as the source of truth while still allowing Codex to recover task-relevant state safely.

Alternatives considered: always reading the full memory set on every session or relying on ad hoc file selection with no fixed core set. These were rejected because they either waste context or make startup recovery inconsistent.

## 2026-06-22 - Research Measures Production Before Optimization

Decision: The historical research platform exists first to measure the current production Layer 1 agents exactly as they are. `/logic` remains the production source of truth, research remains downstream-only, and no live Layer 1 changes should be made without historical justification and explicit human approval.

Reason: Optimization before measurement creates an untrustworthy feedback loop. The platform needs a defensible baseline before any Layer 1 Version 2 work can be evaluated or approved.

Alternatives considered: optimizing live Layer 1 logic early, replaying a research-only variant instead of production logic, or allowing research outputs to influence production automatically. These were rejected because they contaminate the benchmark and weaken production/research separation.

## 2026-06-29 - Live USD Workflow Is The Production Source Of Truth

Decision: The live USD workflow remains the production source of truth. Replay and checker code must be adjusted to reproduce live USD 24H behavior, and the live workflow should not be changed during the first alignment pass.

Reason: The current production benchmark is the live USD workflow behavior already used by the platform. Aligning replay to live preserves production truth while allowing historical research and determinism checks to measure the same logic safely downstream.

Alternatives considered: making `usd_replay_core.js` the canonical source immediately and changing live USD to match it, or treating replay-vs-replay checker success as sufficient proof of parity. These were rejected because they would either alter production behavior prematurely or overstate what the current checker has actually validated.

## 2026-06-29 - Checker Validates Determinism After Replay Alignment

Decision: The current January 2024 USD checker result should be treated as proof of replay-vs-replay reproducibility only. Live-vs-replay parity must be proven separately with a one-snapshot USD 24H fixture before expanding checker coverage to the full 2024 dataset.

Reason: The checker currently re-runs replay logic against stored replay outputs. That is useful for determinism, but it does not prove replay already matches the live USD production workflow. A one-snapshot live-vs-replay fixture is the smallest reliable gate before widening scope.

Alternatives considered: expanding directly to full-year 2024 before live-vs-replay parity or changing live workflow and replay together in one step. These were rejected because they would blur the source of truth and make validation harder to trust.

## 2026-09-29 - Declared-band contract gap accepted as a finding; the two proposed lanes stay closed

Decision: `strategy` submission `20260928-strategy-gold-band-edge-table-007` is accepted as an accurate specification
advisory, and its finding is recorded as a project fact: the Gold Layer 1 document (`logic/agent_gold_direction.md` v2.0)
declares absolute bands and magnitude thresholds (VIX >25 / <16, 5 bps, 0.30%) while the accepted measurement vocabulary
measures level variables as a median split of their own distribution and change variables as a bare sign, so the document's
own band never reaches a report cell. Both sides declare the mismatch in writing - the report registry in
`variable_state_strata.median_split_revision_8` and the expectations registry through the `threshold_is_absolute_band`,
`level_band_not_declared`, `regime_label_not_reproduced` and `change_rule_absent` reasons - and the code forces the split at
`lib/gold_individual_variable_report.js` lines 1042/1060/1064/1104 regardless of the declared `strata` field. The gap is a
vocabulary and contract gap, not missing analysis, and 26 of the scorecard's unscored-or-neutral states are its measured
cost. Acceptance covers the advisory and its evidence only. Neither proposed lane is opened:
`gold-declared-band-measurement-026` and `dashboard-gold-factor-edge-page-001` stay unpublished.

Reason: three facts verified in the review. First, the delivered 454-line spec has already been rewritten in place by the
worker's own later submissions that are still queued (`-008` head `1576e89` and `-009` head `73e64852` both rewrite
`docs/strategy/GOLD_BAND_FIX_AND_EDGE_TABLE_SPEC_20260928.md`, `-010` head `45b7864a` revises again), so publishing an
implementation assignment from the reviewed text would issue a plan its own revision already replaced. Second, the material
forks in the spec's own section 9 are open: D6 (replace the interpreted F9 news-sentiment mapping with a declared safe-haven
rule built the way the live field is built), D8 (standalone page versus a research sub-tab inside `index.html`/`script.js`),
D4 (leave the six VIX change states unscored) and D15 (two sequenced writers versus one). Third, the page lane has no owner:
`docs/orchestration/projects.json` carries a `dashboard` coordinator workstream (status `latest_change_deployed`, policy
"Only user-requested UI changes") but no dashboard worker, worktree or assignment convention.

Alternatives considered: publishing `gold-declared-band-measurement-026` immediately under the user's six recorded
decisions of 2026-09-28 (rejected: it would take effect before the revision still sitting behind the one-review-per-cycle
rule was reviewed, and before the D1-D15 forks were answered); publishing both lanes at once (rejected: the page lane
consumes the measurement output, so it is downstream by construction, and it has no owner); requesting changes on the
citation slips (rejected: neither slip alters a number or a conclusion, and the same file is already being rewritten).

Unresolved and the user's: whether to open any further exploratory stage over the already-spent intervals at all; if opened,
which writer model; whether the page lane may run while it has no registered worker; and, separately, whether to promote
the accepted Gold verdict page from the worker checkout into canonical `docs/`.

## 2026-10-01 — Dashboard navigation: same theme everywhere, and after the gold page

Decision: the navigation-consistency work the user asked for is adopted as a coordinator dashboard queue item on route
N1 and sequenced after the gold tabs release. Every served page carries the same dark header and the same dark side
rail, including the light draft page `gold-factor-wip.html`, with no light variant and no runtime script: one canonical
fragment injected as bytes at build time.

Reason: the user's own two answers of 2026-10-01 (`same theme everywhere`; `after`), recorded in
`docs/strategy/DASHBOARD_NAV_CONSISTENCY_REQUEST.md` and reviewed at
`docs/orchestration/reviews/20261001-strategy-nav-answers-notify-035.md`. Route N1 is the only route that keeps
`gold-factor-wip.html` passing its own guard, which asserts a count of 0 for `script, link, img, iframe` on that page
(`backtester/tests/gold_factor_wip_dashboard_link.browser.test.js` line 44). Sequencing the change after the release
means the fingerprint it settles already holds the single `gold.html` top-bar entry, so no candidate revision 3 is
needed.

Alternatives considered: N2, a shared `nav.js` plus a `styles.css` link on every page (rejected: it breaks the draft
page's self-containment guard); N3, hand-paste with one byte-fingerprint guard (kept as fallback only); nav first, so
the shell ships as candidate revision 3 (rejected: the user chose `after`); a light variant of the header for the draft
page (rejected: the user chose `same theme everywhere`).

Unresolved and the user's: the go-ahead to execute the gold tabs release, which is a coordinator production action
taken with the user's word in-session; whether to open the movement-screen measurement lane
`gold-declared-band-measurement-026`, not opened, with the standing Gold hold unchanged until it is; and the stale
coordinator lock from dead pid `24000`, which keeps dispatch from self-starting until it is cleared.