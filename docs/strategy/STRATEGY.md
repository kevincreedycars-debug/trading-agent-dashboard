# Project strategy — advisory review 1

Adviser: `strategy` (assignment `strategy-advisory-001`). Date 2026-09-20.
Evidence read: canonical `D:/trading-agent-dashboard-codex` at `b91b621`
(`orchestration/control-plane-20260920`), register/decisions/assignments/reviews, mailbox check,
monitor snapshot, worktree HEADs. Advice only: nothing here is adopted, integrated or deployed,
and no worker report is treated as proof of completion.

Scope limits: I read coordination artifacts, not other chat histories. I did not rerun any worker
test suite; test numbers attributed to workers are quoted as *reported*, not verified by me.

## 1. Objectives as stated by canonical memory

- Product: a multi-asset trading dashboard driven by n8n — collectors → independent Layer 1 raw
  directional agents → Layer 2 event adjustment / cross-asset synthesis → writer → static
  dashboard. Backtesting is downstream-only and never feeds Layer 1 inputs.
- Delivery model (changed 2026-09-20): the canonical checkout is the central coordinator; six
  registered workers work in separate worktrees and exchange immutable files through
  `.local/orchestration`; a native Windows monitor polls but starts nothing; the user starts each
  session and says "check submissions" to trigger review.
- Active objective (`docs/CURRENT_TASK.md`): coordinate the whole project from the canonical
  checkout through bounded assignments, keeping decisions, dependencies and integration status in
  `docs/orchestration`.

## 2. Verified state (2026-09-20 evening)

Coordination plane:

- Coordinator branch `orchestration/control-plane-20260920` at `b91b621`; monitor built and
  iterated (tray panel, five-second scans, stale heartbeat after five minutes).
- Mailbox `check --worker strategy`: `pending 0`, `errors []`, no reply bound to me.
- Register (`docs/orchestration/projects.json`) lists six workers; implementation workers live in
  `.local/worktrees/*` and `.worktrees/agent-*`.
- Live monitor states: `gold-research` **working** on `gold-policy-003`; `gbp`, `silver`, `wti`,
  `eur-pairs` **not started / no report** although their status-reconciliation assignments are
  published; the coordinator reports no recent update.

Gold chain (the only in-flight implementation work):

- Coverage registry milestone accepted (`b8193ba`, accepted in `0b0e92d`): 28 variables declared,
  16 with a local source, and the accepted audit reports **zero contiguous 24-hour windows** in
  both cohorts.
- Policy revision 2 (`ccd4c37`) was reviewed at `3c605c68…` with **changes requested**: five
  closes span only four close-to-close intervals (six boundary closes are required for five),
  endpoint delay must be separated from exact-24h returns, and the holiday/session register is
  fitted to the same archive being checked. The transition review separately reproduced two
  blocking bugs — a future close admitted into prior context and a missing declared final bar
  silently replaced.
- `gold-policy-003` (active) carries five bounded corrections: six-boundary return with a
  hand-calculated example, label/registry reconciliation, a bounded read-only attempt at
  applicable provider (OANDA) calendar evidence, keeping all 28 variables visible, and a hashed
  audit on resubmission. Explicitly excluded: reaction reports, combination search, formula work.

Evidence limitations that constrain any claim:

- The September stored-call pilot is descriptive (proxy timestamps, unverified vintages, repeated
  snapshots, no complete strict 24-hour path); the June 9 reference defect affects 143 of 147
  linked snapshots.
- The L2L final-test window (2025-10-01 to 2026-04-30) is consumed; intraday reach rates are not
  directional accuracy or executable win rates. A fresh, timestamp-defensible dataset is required
  before new qualification.
- Dashboard: latest deployed change is `683a840`; `input-health.json` is still dated 2026-09-01 and
  marked CRITICAL, so the public page can show a degraded badge driven by a stale artifact rather
  than by the latest successful workflow.
- Production hygiene: the unordered 25-row Gold history query defect is open, the prepared repair
  is unapplied, and it requires isolated n8n validation; authenticated access exists through the
  scoped encrypted credential runner, not through ambient environment variables.
- Test reality as reported: gold worker 376 tests / 370 pass / 6 fail (four pre-existing
  secret-scanner console-width failures plus two timing-sensitive dashboard tests that pass on
  isolated re-run); the coordinator independently reran 12 focused gold tests. No full-suite result
  is claimed by me.

## 3. Unknowns I cannot resolve from evidence

1. Which value stream you want next: (a) Gold research depth, (b) status reconciliation across the
   four idle asset workers, or (c) dashboard and production hygiene.
2. Session budget: how many worker sessions you are willing to run per day, and whether the four
   idle workers should run sequentially or in parallel.
3. Calendar provenance: obtain applicable provider evidence before measurement, or adopt an
   explicit "inferred" reporting mode and proceed with the blocker disclosed.
4. Stopping rule for the Gold hypothesis: what observed result would end the line of enquiry.
5. Whether honest degradation states (stale health artifact) are a user-facing requirement now.


## 4. Trading hypotheses — explicitly NOT project priorities

Quoted from canonical research notes and **unqualified**. They must not reorder assignments until
the policy gate passes and an untouched evaluation exists.

- "Claims below consensus" bullish event lead: 43/58 training, 12/16 validation, five validation
  flats, month-block interval 47.83%-100%. Retrospective, selection-prone, no complete 24-hour
  paths, no untouched test window.
- Macro-only winner 15/28 validation; descriptive reaction is not causation or reliable influence.
- Coverage counts, reach rates and calendar contiguity measure data availability, not edge. An
  accepted registry is not an accepted strategy.

## 5. Ranked next steps, dependencies and alternatives

R1. **Let `gold-policy-003` finish, then review it** with independent checks (focused test rerun and
    reproduction of the documented audit hash) and record the outcome. This is the critical path:
    the research-reporting workstream is gated on it and adding scope mid-batch would break the
    hash-bound review cycle. Depends on: worker finishing, coordinator review slot.
R2. **Decide the calendar-provenance gate, then adopt it explicitly.** Recommended shape: a
    two-mode convention (verified / archive-inferred) recorded in the registry, the audit and every
    report label, plus one bounded read-only provider-evidence attempt as its own item. This
    unblocks measurement without manufacturing evidence; today's blocker is provenance acceptance,
    not code volume. Depends on: R1 and a user decision.
R3. **Start at most one idle asset worker at a time** (eur-pairs or gbp first), then the next. Four
    parallel sessions multiply review load with no dependency benefit; sequential reporting still
    gives the register real data. Depends on: user-started sessions.
R4. **Bounded production-hygiene batch, kept outside the research chain:** (a) regenerate or
    re-scope `input-health.json` so the dashboard stops showing a September-1 CRITICAL badge, and
    (b) validate the prepared Gold history repair in isolated n8n. Both are user-visible or
    input-integrity risks with small scope, and neither depends on the gold policy gate. Depends
    on: credential runner, isolated runtime, coordinator assignment.
R5. **Defer:** reaction reports, combination search, formula qualification, the parked macro
    prototype, and the secret-scanner console-width fix (assign only to an idle worker).

Alternatives considered and rejected:

- Keep chasing provider calendar evidence indefinitely: blocks all measurement on a third party.
- Run all four asset workers in parallel now: review overload, no dependency gain.
- Advance Gold straight to reaction or combination work: violates downstream-only and untouched
  evaluation discipline and would build on unaccepted policy.
- Polish the dashboard next: already user-request-gated (683a840 deployed), no research progress.

## 6. Recommended bounded assignment for the coordinator

`gold-calendar-status-001` (worker `gold-research`, starting only after the `gold-policy-003`
review):

1. Add the two-mode calendar status (verified / archive-inferred) to the policy registry, the audit
   labels and any report-labelling helper.
2. Make one bounded, read-only provider-evidence attempt and record feed applicability, source URL,
   retrieval date and historical coverage; if inaccessible, keep the blocker explicit.
3. Add a regression proving inferred mode cannot emit an exact-24h return or a verified-continuity
   label.
4. Fit no new exceptions to gaps; no reaction report, combination search or formula work.

Acceptance: the coordinator reruns the focused tests, reproduces the documented audit hash, and
confirms the mode is visible in every emitted label. Stop after delivery.

Fallbacks if you prefer not to spend another Gold cycle: `ui-health-artifact-001` (dashboard
stale-health honesty) or `asset-status-001` (reconcile one idle asset worker).

## 7. Asks back to you

1. Priority order among (a) Gold research depth, (b) asset-worker reconciliation and (c) dashboard
   and production hygiene.
2. How many worker sessions per day are realistic, so assignments can be sized to your review time.
3. Is provider calendar evidence worth pursuing now, or should inferred mode be adopted and
   disclosed so measurement can proceed?
4. What would end the Gold enquiry (a stopping rule), so effort is not open-ended.

Boundaries preserved by this advice: independent Layer 1 agents, downstream-only backtesting,
timing provenance, untouched evaluation, and no production action arising from advice.

