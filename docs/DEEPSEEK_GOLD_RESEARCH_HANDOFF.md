# DeepSeek Gold research handoff

September 20 superseding setup: the coverage milestone is accepted (b8193ba / 0b0e92d). Do not repeat it or implement in the canonical checkout. Read `D:/trading-agent-dashboard-codex/docs/orchestration/assignments/gold-research.md` and the central protocol for the separate worktree and next bounded policy proposal. The original assignment below is historical.

Assignment date: 2026-09-19. Intended runner: DeepSeek through Cline or another coding extension in a second VS Code window.

## 1. Operator setup

1. Open `D:\trading-agent-dashboard-codex` in the other VS Code window. Use the canonical project, not the GBP/Silver/WTI worktrees.
2. Select your DeepSeek provider/model in your coding extension. Confirm its billing settings and set a spending limit where supported. This document does not configure or start the model.
3. Use one active writer in this checkout: pause Codex implementation while DeepSeek works. Two windows pointing here share files, branch and Git index; they are not isolated agents. If concurrent implementation is required later, arrange a separate worktree first.
4. Paste the prompt in section 9. DeepSeek must inspect the actual branch/status and preserve existing edits. At handoff creation the branch is `docs/gold-variable-research-scope`, with uncommitted agreed-scope documentation; do not reset, stash, discard or commit those edits as your own work.
5. Let DeepSeek complete the bounded first milestone below. Return its progress document, diff/commit IDs, generated summary and test results to Codex for a checkpoint review. Do not paste raw datasets into chat.

## 2. Goal and order

Understand how Gold price responds to individual variables, including event actual-versus-consensus surprises, over meaningful horizons up to five trading days. Include preceding weekly price and macro context. Then study combinations systematically, develop a daily-direction formula and separately qualify its reliability.

This is association research first. No prediction model, greater-than-60% claim, live signal or trading profitability claim is required for this assignment. Claims below consensus is one existing lead, not the sole research target. Do not assume negative macro news causes continuing declines until another release.

Use programs, workflows and database queries for bulk work. AI writes/debugs code and interprets compact reports; it must not analyse each row or each combination through model calls.

## 3. Read in this order

1. `AGENTS.md`, `CODEX_STARTUP.md`, then the four current-state/task/milestone/session documents named there. Prioritize current entries; older session entries are history.
2. This document, the September 19 section of `docs/BACKTESTING_REVIEW_PLAN.md`, and `docs/GOLD_RESEARCH_DELIVERY_CONTRACT.md`.
3. `docs/GOLD_EXTENDED_RESEARCH_20260918.md`, `logic/agent_gold_direction.md`, `backtester/docs/variable_event_research_framework.md`.
4. Inspect relevant existing code before proposing new modules: `backtester/scripts/audit_gold_snapshot_variables.js`, `backtester/lib/gold_source_readiness.js`, `backtester/lib/gold_macro_vintage_dataset.js`, `backtester/lib/gold_research_experiments.js`, `backtester/lib/variable_event_research.js`, and `backtester/scripts/run_gold_research_bundle.js`.
5. Inspect source manifests and schemas as needed: `backtester/schema/observation-first-research-schema.md`, existing `backtester/sql/`, and the source directories identified in the extended-results report. SQL files alone do not prove a schema is deployed. Read `docs/CREDENTIAL_CONTINUITY.md` before authenticated access; use its scoped encrypted runner, never print secrets.

Use targeted file reads and program-generated counts/schema summaries. Do not send whole raw archives into the model context.

## 4. First assignment: coverage registry and executable audit

Complete this milestone, then stop for review before broader analysis implementation.

1. Inspect branch/status and record the initial dirty files. Trace the existing 28-variable inventory and intended Gold inputs. Do not equate 20 transformations of five series with 20 independent variables or complete coverage. If original research references are unavailable, list that gap.
2. Create `backtester/registries/gold_variable_horizon_context.v1.json`. For every intended variable record a stable ID, definition, units, source/schema mapping, transformations, event/non-event type, timestamp/version semantics, relevant horizons, known availability and gaps. Separate verified facts from proposed mappings. Include unavailable variables instead of silently dropping them.
3. Define candidate immediate/event-window, 1-hour, 4-hour, 24-hour and five-trading-day horizons, marking applicability and required resolution. Do not invent minute-level reactions from hourly candles. Define trading-session/calendar requirements; five trading days must not be treated automatically as 120 elapsed hours. Keep unresolved calendar policies explicitly pending.
4. Define prior context fields: preceding five-trading-day return and volatility, prior yield/dollar changes, recent macro surprises and time since release where sources support them. Separate price trend from macro context. Every context cutoff must precede the observation; never use the eventual same-week direction.
5. Implement a deterministic coverage CLI using existing local versioned datasets first. Accept explicit input paths and a new output directory; do not hard-code a machine-specific path. Audit variable values, actual/consensus availability, timestamp quality, usable horizon endpoints, continuity, prior-context coverage, missing values and duplicate releases. Report unsupported checks as unknown, not passed. Refuse to overwrite completed reports.
6. Generate JSON and concise Markdown outputs with source hashes, registry version, run command, counts and exclusion reasons. Distinguish event observations from daily snapshots. Reconcile totals under an explicit deduplication policy and retain overlapping exclusion flags separately if needed.
7. Produce an implementation gap report: existing reusable modules, required extensions, missing data and the proposed next individual-variable report. No large combination search in this milestone. Do not change the strict exact-24-hour evaluator to accommodate additional horizons.
8. Add meaningful synthetic tests and execute the CLI against available real local sources. Do not fabricate a successful real-data run when inputs are absent; deliver runnable tooling, fixture validation and exact missing-input details instead. Existing database/schema inspection may be read-only; avoid unnecessary remote queries when cached evidence answers the question.

## 5. Ownership and boundaries

This user-requested research assignment explicitly supersedes the older blanket restriction in `docs/PARALLEL_AGENT_HANDOFF.md` and `docs/DEEPSEEK_BUILD_BRIEF.md` that reserved all backtester work for Codex, only for the files listed here. Existing asset-builder assignments remain unchanged.

Owned new files:

- `backtester/registries/gold_variable_horizon_context.v1.json`
- `backtester/lib/gold_variable_coverage.js`
- `backtester/scripts/audit_gold_variable_coverage.js`
- `backtester/tests/gold_variable_coverage.test.js`
- Synthetic fixtures under `backtester/tests/fixtures/gold-variable-coverage/`
- `backtester/docs/gold_variable_coverage.md`
- `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md`

Reuse existing modules without editing them in this first milestone. If an existing defect blocks progress, report its location, reproduction and proposed change for review. Do not work around it by weakening validation. The existing local test runner discovers new `.test.js` files automatically.

Do not edit global current-task/milestone/session documents, other builders' files, existing production exports, dashboard UI, package/lockfiles, frozen reports or existing registries. Do not switch/reset branches, deploy, push, activate n8n workflows, change credentials, provision schemas or write to the linked warehouse. Use only scoped read-only access if required. New subscriptions/paid bulk acquisition are outside this milestone.

Raw data, generated evidence and logs belong in ignored `backtester/tmp/gold-variable-coverage-<run-id>/` or `tmp/`. Verify ignore status before writing sensitive evidence. Synthetic fixtures and concise implementation documentation may be tracked. Local commits may include only owned implementation files; never use `git add .` or commit inherited documentation edits.

## 6. Research and cost discipline

- Reuse existing Node.js tools and dependencies. No new orchestration platform or model-powered data pipeline is needed.
- Use cached inputs, hashes and incremental processing. Run bulk computations through scripts/SQL; do not loop through records in chat.
- No per-record/per-combination LLM calls and no additional model sub-agents for this milestone. Keep progress updates concise and avoid repeatedly reading large documents.
- Keep release actuals, pre-release consensus and revisions distinct. Current archive values without original versions remain retrospective evidence, not authenticated surprises available at the time.
- Missing values are not zero. Exclude/flag unsupported timestamps, units and mappings explicitly. Report repeated releases, sparse cohorts and overlapping windows.
- Association does not establish causation. Later combination searches must retain all attempts and evaluate stability across periods; do not optimize until an attractive accuracy appears.
- Layer 1 remains independent and research stays downstream. Later daily-call qualification is separate from descriptive research and trade profitability.

## 7. Validation and completion

From the project root, use PowerShell-compatible commands:

```powershell
node --test backtester/tests/gold_variable_coverage.test.js
npm.cmd test
git diff --check
git status --short --untracked-files=all
```

Test missing/null values, timestamp cutoff boundaries, revised/unknown consensus, duplicate releases, insufficient resolution, weekends/session gaps, prior-context leakage, deterministic output and denominator reconciliation. Use independently calculated expected examples, not assertions that merely repeat implementation logic. Do not run linked-warehouse integration suites.

In `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md`, deliver:

1. Owned files and what was implemented.
2. Exact CLI/test commands and observed pass/fail counts; distinguish fixtures from real-source execution.
3. Compact coverage totals and source/report locations/hashes; no secrets or bulk raw data.
4. Proven gaps versus unverified assumptions, with proposed next actions.
5. Commit IDs if committed; otherwise a precise changed-file list. Note pre-existing changes left untouched.
6. Confirmation that no production changes or predictive qualification occurred.

Completion means the registry, reusable audit program, meaningful tests, generated evidence and gap report exist. A prose plan alone is not completion. Resolve routine implementation choices autonomously within scope; only stop early for a concrete blocking dependency or out-of-scope action, while finishing independent work.

## 8. Later milestones, not part of this assignment

After checkpoint review: implement automated individual-variable reaction reports and prior-context comparisons; then bounded pairs and supported larger combinations; then derive a formula and evaluate untouched data. Statistical methodology, source timing and session semantics receive review before expensive searches. Astra/Codex is used at these checkpoints, not continuously for routine coding or scanning.

## 9. Paste this into DeepSeek

```text
You are the assigned DeepSeek implementation agent for Gold variable research in D:\trading-agent-dashboard-codex. Read AGENTS.md and CODEX_STARTUP.md, then docs/DEEPSEEK_GOLD_RESEARCH_HANDOFF.md and its specified current documents. Follow that handoff as your bounded assignment; it explicitly authorizes its listed backtester files despite older asset-builder-only restrictions.

Complete the first milestone: a machine-readable variable/horizon/prior-context registry, deterministic executable coverage audit, meaningful tests, real-local-source coverage report where available, and implementation gap report. Use programs and existing data for bulk work; no model calls for record scanning or combination searches. Preserve the existing exact-24-hour evaluator and all inherited edits. Do not change branches, deploy, write to the linked warehouse, or edit unowned files. This checkout has one active writer; do not start other agents.

Record results in docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md. Run the specified local validation and report exact results. Continue autonomously within scope until the milestone is complete, then stop at the review checkpoint before implementing later phases. Start by inspecting branch/status and identifying existing reusable code and source manifests, not by asking me to restate the plan.
```
