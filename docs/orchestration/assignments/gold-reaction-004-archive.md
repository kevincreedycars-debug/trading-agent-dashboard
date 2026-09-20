# Gold individual-variable diagnostic report

Assignment ID: gold-reaction-004. User confirmed 2026-09-20.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: 23aac6e.
Read canonical orchestration instructions and revision-3 review/reply by absolute path.
Policy corrections accepted for exploratory use only; calendar verification remains blocked.

## Build and run the first report

Use deterministic programs, existing local sources and revision-3 session helpers.
Retain all 28 variables with explicit unavailable-source/unimplemented rows; no invented
values, retirement, bulk acquisition or per-record AI calls. Report direction as
positive/negative/exact-zero and magnitude (counts, median, quartiles). Exact zero is
not an economic flat band; do not tune thresholds or set formula eligibility.
Keep daily and event cohorts separate. Retain every declared horizon: immediate
unavailable when hourly resolution is insufficient; 1h/4h diagnostics only; exact
elapsed 24h separate from delayed endpoints; five-session outcomes calendar-dependent.
Disclose entry/endpoint delays, price availability and elapsed intervals.

Include prior five-session price return/volatility and prior yields/dollar, recent
surprise and time since release where available, with strict prior cutoffs and explicit
missing-context statuses. Declare context strata in the registry before looking at
outcomes; no outcome-driven bins or combination searches. Show supported context
strata alongside unconditioned results. Preserve consensus-vintage and proxy-availability
caveats. Label archive_fit results exploratory and verified-mode blockers explicitly.
Never fill missing bars/closes or claim verified continuity from archive inference.

Reconcile source anchors through variable/context, entry/endpoint and continuity
exclusions with mutually exclusive primary reasons and separate overlapping flags.
Include year breakdowns, all attempts and small-sample disclosures. No formula fitting.

## Owned files

- backtester/registries/gold_individual_variable_report.v1.json
- backtester/lib/gold_individual_variable_report.js
- backtester/scripts/build_gold_individual_variable_report.js
- backtester/tests/gold_individual_variable_report.test.js
- backtester/tests/fixtures/gold-individual-variable-report/ (synthetic only)
- backtester/docs/gold_individual_variable_report.md
- docs/GOLD_INDIVIDUAL_VARIABLE_REPORT_PROGRESS.md

Reuse existing helpers read-only; report prerequisite defects before changing outside
this scope. Read canonical ignored sources by absolute path. Raw evidence goes only
in worker ignored tmp/ or backtester/tmp/. Write immutable JSON/Markdown reports in a
new output directory, refuse overwrite, record source/registry/code hashes and a
deterministic content hash. Commit source/tests/docs only, with compact results and
artifact paths in the progress document.

Test missing variables, timing cutoffs, prior context, cohort separation, delayed
endpoints and denominator reconciliation with synthetic fixtures. Run focused tests,
the documented local suite and the real-source report; disclose exact failures.
Submit under gold-reaction-004 with a new ID, commits, hashes, evidence and blockers.
Report activity at start/progress and pause after submission for coordinator review.
No canonical edits, other worker edits, combinations, live operations, warehouse
mutations, credentials, integration or deployment. This supersedes the reaction-report
hold in the previous assignment; do not stop at another generic proposal.
