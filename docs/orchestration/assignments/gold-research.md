# Reconcile the accepted declarations the gate and the audit still read as stale

Assignment: `gold-coverage-020`. Published 2026-09-25.
Worker: `gold-research`. Worktree: `D:/trading-agent-dashboard-codex/.local/worktrees/gold-research`.
Branch: `workers/gold-research-policy-20260920`. Starting commit: `3240f598` (019 accepted).
Predecessor: `gold-coverage-completion-019`, accepted on 2026-09-25 and recorded in
`docs/orchestration/reviews/20260925-gold-coverage-completion-019-r1.md`.

Standing user direction: the coverage and individual-relationship lane continues under the
orchestrator, with bounded assignments published after coordinator review. This revision was
published by the coordinator after accepting 019, because the review found that two accepted
declarations the qualification gate and the audit read are now factually stale. It adds no new
research rule, opens no candidate space and reads no outcome.

## Why this is the next bounded step

019 measured all 28 declared variables honestly, but three accepted declarations still describe the
pre-019 state, and one of them is read by the accepted qualification gate:

1. `backtester/registries/gold_live_input_inventory.v1.json` still carries
   `research.status: unavailable_no_local_source` for `risk_headline_context`, `equities_regime` and
   `growth_regime`, and its F2 entries use the retired `dxy_*` ids while the measured research ids are
   now `usd_broad_index_*`. `backtester/lib/gold_qualification_gate.js` resolves every candidate atom
   through this inventory and records `atom_variable_declared`, `atom_research_measured` and
   `atom_timing_rule_declared`, so a revision-8 candidate cannot currently be gated truthfully.
2. `backtester/registries/gold_remaining_source_audit.v1.json` still states that its nine audited
   variables are `unavailable_no_local_source`.
3. `backtester/registries/gold_variable_horizon_context.v1.json` still shows the original unsourced
   `source_mapping` and `timestamp_semantics` for `fed_bias` and `inflation_signal`, although both
   have been measured since coverage-008 through the declared macro source additions.

## Scope

1. **Live-input inventory (declared in-place revision).** In `gold_live_input_inventory.v1.json`,
   correct only the declaration facts that 019 made stale: the `research` block of each variable the
   accepted report registry revision 8 now measures (status, measurement kind, series and route
   reference), the F2 id vocabulary so the live field name and the measured research id are both
   stated explicitly for the four dollar variables, and a revision note naming this assignment and the
   accepted predecessor declaration. Do not change any `live` status, live field name, factor key or
   weight, the atoms list, the candidate universe, the consumed boundary or the context field. Add a
   declared retirement/replacement note for the retired `dxy_*` ids instead of deleting their history.
2. **Remaining-source audit (new versioned file).** Write `gold_remaining_source_audit.v2.json`
   superseding `gold_remaining_source_audit.v1.json`, which stays byte-identical: every one of the nine
   audited variables carries the accepted revision-8 measurement status with the evidence hash it is
   taken from, and the audit's own scope note states that the nine-variable unmeasured scope is closed
   by `gold-coverage-008` and `gold-coverage-completion-019`.
3. **Coverage declaration (declared in-place revision).** In
   `gold_variable_horizon_context.v1.json`, correct only the `source_mapping`,
   `timestamp_semantics`, `known_gaps` and research-status text of `fed_bias` and `inflation_signal`
   so they match the sources already declared in the accepted report registry, and update the gap note
   that currently records this discrepancy. No other declared variable block may change; the 28-id
   order, the horizons, the context fields, the forbidden context and the unresolved policies stay
   exactly as accepted.
4. **Gate compatibility, data-only.** Prove from the revised declarations, with a focused test, that
   the accepted gate can resolve a candidate atom whose research variable id is a revision-8 id and
   still fails closed on an undeclared, `absent_live` or `proxy_redefined` variable. Reading the gate
   is in scope; changing `backtester/lib/gold_qualification_gate.js`, the combination ledger, the batch
   registry or any accepted protocol artifact is not. If truthful gating needs a code change, stop and
   submit that as the blocker with the exact failing check instead of editing the code.
5. **Record every before/after digest.** For each file you revise in place, record its SHA-256 before
   and after in your progress document, and state the LF-normalised value where the file is
   hash-bound.

## Owned scope

Write only inside your own worktree/branch: the three registries above, its focused test file, the
progress and decision documents that describe this revision, and ignored raw evidence under
`backtester/tmp/`. Do not write to the canonical checkout, another worktree or another mailbox copy.

## Accepted bindings

Re-verify before acting: `docs/orchestration/reviews/20260925-gold-coverage-completion-019-r1.md`;
the accepted report registry `backtester/registries/gold_individual_variable_report.v2.json`
(SHA-256 `2be6701ccbc169d8e12e6933c234bb185b48523161ff60364663d71209ccb497`); the preserved revision-7
file `backtester/registries/gold_individual_variable_report.v1.json` (LF-normalised SHA-256
`714a5410cc14ab0762f6d8a364b5a53b2524ab7716cf597b6d5bed1844d6c042`); the frozen manifest
`backtester/registries/gold_qualification_window_manifest.v1.json` with `first_anchor_utc`
`2026-09-24T14:00:00.000Z`; the frozen execution contract and scheduler package.

## Boundaries

No production, live workflow, warehouse, Layer 1, dashboard, credential, scheduler, deployment or
purchase action. No change to the prospective window, its task, wrapper, driver or sealed evidence,
and no hand capture. No research-rule, threshold, band, tercile or formula change. No candidate
space may be declared or opened, no selector may run, no outcome, aggregate, qualification or
evaluation value may be read, and the evaluation stays sealed until `2027-03-25T15:00:00Z`. Do not
revive, relabel or back-fill a retired `dxy_*` id, and do not report `DTWEXBGS` under a `dxy_*` name.
Do not fix the CRLF materialisation defect here: it belongs to the assigned `backtester-spike` change
request, and a global line-ending change would collide with it. One writer per worktree. Stop at the
review boundary.

## Evidence and validation

Focused tests first, covering: the revised research status and id vocabulary resolve; the retired ids
are still refused; a candidate naming a revision-8 id is not refused for being undeclared; an
`absent_live`, `proxy_redefined` or unmeasured variable still fails closed; the v1 artifacts are
unchanged byte-for-byte where they must be; and the before/after digests are reproducible. Then run
the documented local suite and report exact counts and every failure, disclosing the known
CRLF-materialisation and console-width cases as environment, not as new work.

## Reporting (mandatory)

Report activity first, then work in this order: item 1, then 2, then 3, then 4, then 5. Finish only by
reporting. On completion, on a blocker or at a decision point:

1. write one envelope from `templates/submission.json` into your own ignored `tmp/` with status
   `ready_for_review`, `blocked` or `status_report`, the observed worktree/branch/base/HEAD, changed
   files, exact test commands and results, artifact hashes, blockers, questions and production
   disclosure;
2. submit it with `node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <that file>`;
3. record `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity gold-research paused "<what finished>"`;
4. stop. Start no further work, in any asset or checkout, until a recorded reply arrives; read it with
   `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker gold-research`.

A blocker is submitted when it is found, not at the end of the task.