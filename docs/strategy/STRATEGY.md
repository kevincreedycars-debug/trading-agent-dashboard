# Project strategy — advisory review 1

Adviser: `strategy` (assignment `strategy-advisory-001`). Date 2026-09-20.
Evidence read: canonical `D:/trading-agent-dashboard-codex` at `b91b621`
(`orchestration/control-plane-20260920`), register/decisions/assignments/reviews, mailbox check,
monitor snapshot, worktree HEADs. Advice only: nothing here is adopted, integrated or deployed,
and no worker report is treated as proof of completion.

Scope limits: I read coordination artifacts, not other chat histories. I did not rerun any worker
test suite; test numbers attributed to workers are quoted as *reported*, not verified by me.

## 0. Aim (stated by the user, 2026-09-20)

Every tracked asset produces a **24-hour directional call**; Layer 2 then issues a
**higher-conviction cross-pair call when two Layer 1 calls move in opposing directions**. The
dashboard is the decision aid through which those calls are acted on.

Implications recorded for later sequencing:

- Two tracks, not one. **(A) Live path** — the five Layer 1 agents emit 24-hour calls, Layer 2
  synthesises opposing-call cross-pair conviction, and the dashboard is the decision aid. **(B) A
  separate gold sub-project**, currently running, whose job is to measure how gold's input
  variables actually relate to real price movement and then build gold's daily call formula on
  probability-supported evidence. The gold session/calendar policy work belongs to track B and is
  not on the live path.
- "All tracked assets" puts the four unreported workers (gbp, silver, wti, eur-pairs) in scope for
  the live path, not in optional reconciliation.
- Layer 2's documented role (`README.md`: economic-event adjustment via the Eco Events Agent)
  differs from the divergence-synthesis role this aim implies. Which one is first, and whether they
  run in sequence, is unresolved.


## 0b. Programme stages as stated by the user (2026-09-21)

The user described the whole programme this session, with the backtest engine as the current focus. Recorded verbatim in
substance, then reconciled against canonical memory:

1. **Northstar:** a high-conviction 24-hour directional call based on tested macroeconomic inputs.
2. **Layer 1** builds that call: researched inputs are pieced together by a weighted call algorithm, written in
   JavaScript inside n8n, which pulls macro variables each time a call is requested and emits the day's call.
3. **Layer 2** pairs assets whose Layer 1 calls point in opposite directions and gives the pair a strength rating.
4. **Backtest engine (the current build):** a standalone system every future asset can be fed into. Gold is first:
   all known drivers of gold's Layer 1 call are ingested, each is reviewed every day it had a chance to influence the
   market over 24h then 5 days, then variables are combined with each other until clear patterns show which macro
   variables truly drive price. Layer 1 is then **rebuilt on the measured weightings** and tested against the
   baseline algorithm over 2+ years of price data: directional alignment, L2L movement and 0.5 L2L movement.
5. **Re-qualify and swap in:** once the rebuilt Layer 1 is confirmed, it replaces the live Layer 1 on the dashboard.
6. **Roll out:** the same engine is then run on every traded asset.
7. **Automated bot:** only after the engine and circuit are confirmed, daily 0.5 L2L trades across assets where
   conviction is high - consistently over 60% accuracy in the direction, L2L or 0.5 L2L.

Confirmed consistent with canonical memory: the n8n-built weighted Layer 1, eight live assets, Layer 2 pairing
already in production, gold as the first asset through the engine, the "descriptive first, then formula, then
untouched qualification" order (`BACKTESTING_REVIEW_PLAN.md`,
`GOLD_RESEARCH_DELIVERY_CONTRACT.md`), the engine staying downstream-only, and asset-by-asset extension.

Three qualifications the plan must carry, so the stages do not over-promise:

- **"Confirmed accurate and profitable" is two gates, not one.** Directional evidence and executable evidence are
  separate; accepted gold work is explicitly `executable_trade_validated: false` and still lacks bid/ask, spread,
  fills and adverse-boundary assumptions. Stage 5 should be gated on directional qualification, stage 7 on the
  executable gate.
- **"Over 60%" needs more than a point estimate.** The delivery contract requires an untouched chronological test, a
  predeclared denominator, adequate effective sample size, dependence-aware uncertainty and a predeclared lower
  confidence bound above 60% plus a baseline beat. Both ex-flat and all-evaluable-call denominators must be shown.
  60% is a target, not a guaranteed deliverable.
- **Coverage is not evidence, and replacing live Layer 1 is a production change.** The accepted digest shows
  near-balanced directions, small positive medians, conditioning mostly below `min_n` and only 43 of 390 pooled
  states assessable for between-year agreement; the rebuilt weights only mean something once dependence-aware
  inference and a declared holdout exist. Swapping the live algorithm needs explicit user authorization.

Printable artifact delivered for this: `docs/strategy/PROGRAM_MAP.html` (one A4 page, print-validated at 261.8 mm on a
285 mm printable area, single PDF page), with a companion page for the gold engine instance at
`docs/strategy/GOLD_ENGINE_MAP.html` - rebuilt on 2026-09-21 as a driver-and-data reference sheet answering "which
28 drivers, why, where they stand, over what frames, and where the data lives" - titled "Backtesting agent architecture - XAU
(Gold)", listing all 28 drivers individually (277.3 mm -> 283.0 mm after the full driver list was restored, still one PDF page).

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

R0. **Fix the live path's status reporting first (small, no research dependency).** Add GBP to the
    Master Orchestrator's hardcoded status step list (or add the missing GBP call nodes if they are
    absent), and refresh the stale `exports/` so the dashboard's status surface stops under-reporting
    an agent that is actually running. Depends on: n8n credentials, so it belongs to the coordinator.
R1. **Let `gold-policy-003` finish, then review it** with independent checks (focused test rerun and
    reproduction of the documented audit hash) and record the outcome. This is the critical path for track B only (it does not gate the live path):
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

**Superseded 2026-09-24:** this recommendation was overtaken by events. The two-mode calendar labels
were adopted through the accepted policy revisions, and the chain moved on through coverage-008, the
findings digest, combination registry 010, run 011, prospective protocol 012, shortlist 013, the
frozen 014 manifest, scaffold 015, collectors 016 and the activation package 017 now in review. Kept
for history only; section 7 holds the live asks.

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

## 7. Asks back to you (simplified, 2026-09-24)

Three decisions. If you do not answer, the default is **no change** and I stop asking.

1. **Anchor capture.** Anchor 1 of the frozen window (24 Sep 14:00 UTC) is already lost, because the
   window opened before package 017 was published. Anchor 2 is 25 Sep 14:00 UTC and its feature lane
   is open now. Once 017 is reviewed, authorize real capture plus the one-time scheduler install, or
   keep the window closed? *Default: closed - anchor 2 is lost as well.*
2. **The 7 unmeasured drivers - now a free fix.** All seven can be unblocked with data that costs
   nothing: the four dollar ones via the broad dollar index we already hold (declared under its own
   name, which is what the live agent actually uses) or Yahoo's free ICE index history; news tone via
   the San Francisco Fed's free daily sentiment index; equities via FRED's S&P 500; growth via the
   Philadelphia Fed's free daily ADS index. Say "measure them" and I will turn it into one bounded
   instruction; say no and 21 of 28 stands. *Default: unmeasured.*
3. **Automation.** Restart the background reviewer and apply the three mailbox fixes from the 24 Sep
   audit (publish the reply before the next assignment; bound the working-suppression; confirm pickup
   on the dispatch record), or keep reviews manual? *Default: manual.*

Retired or answered, so no longer asked: priority order between Gold, asset reconciliation and
hygiene (answered by your Gold-first direction); worker sessions per day (one at a time is working);
provider calendar evidence versus inferred mode (answered - accepted two-mode archive-inferred
labels); the Layer 2 role, the stopping rule and the live-path hygiene batch (parked, not blocking).
Definition questions are settled by the frozen 014 manifest: flat band, delayed endpoints, minimum n,
stopping and multiplicity semantics.

Boundaries preserved by this advice: independent Layer 1 agents, downstream-only backtesting,
timing provenance, untouched evaluation, and no production action arising from advice.

