# Rebuild the LLM analysis chain as a program, then backtest the whole day

Recorded 2026-10-08. Advisory only. Answers the user's brief of this date: a ten-day plan to
deep-research every element inside the LLM analysis logic, have frontier models judge whether the
logic makes sense, have two frontier coding models red-team it, then rebuild the LLM's logic chain as
a program and backtest that as a full daily analysis engine - to answer "what is actually in this
black box" and to backtest the LLM analysis without paying for a model call per day.

## 1. What the brief is really asking for

Two questions are being bundled into one piece of work, and they are the same work:

1. **What is in the black box.** What actually runs when a daily call is produced, which parts are
   the model's judgement and which parts are arithmetic that would produce the same number without it.
2. **A cheap full-history backtest.** Grade a complete day's analysis over years of history without
   one model call per day per asset.

If the chain can be written as a program that reproduces the live call, question 1 is answered by the
same artifact that answers question 2. That is the whole value of the plan, and it is the reason it
should be done in this order.

## 2. What the chain actually is today (verified, not assumed)

Source: `exports/gold_layer1_agent.json`, workflow name "GOLD Layer 1 Agent", nine nodes. Read this
turn. The same shape is expected for the other assets but has not been checked node by node.

| # | Node | Type | What it does |
| - | ---- | ---- | ------------ |
| 1 | When Executed by Another Workflow | trigger | called by the Master Orchestrator |
| 2 | Supabase Get Many | supabase getAll | pulls recent `market_snapshots` |
| 3 | Build GOLD Input Pack | code, 2,245 chars | keeps the newest row with `snapshot_date` + `run_time_et`, builds `available_inputs` (~25 fields) |
| 4 | Get GOLD Logic Document | github get | fetches `logic/agent_gold_direction.md` |
| 5 | Combine md & market snapshot | code, 391 chars | `{ logic_document, market_snapshot }` |
| 6 | Message a model | OpenAI node | **gpt-4.1-mini**; system prompt "follow the supplied GOLD logic document exactly", "return raw JSON only"; user message = the logic document + the snapshot + an `output_requirement` block |
| 7 | Parse GOLD Agent Output | code, 3,044 chars | strips code fences, `JSON.parse`, throws if there is no text; maps the model's `direction_*` into `call_*_direction`, sets every `conviction_*` to null |
| 8 | Calculate GOLD Conviction | code, **14,655 chars** | recomputes all ten factor signals from `market_inputs` itself, applies per-timeframe weight tables, computes bull/bear case, net edge, participation and conviction |
| 9 | Create a row | supabase insert | writes to `agent_outputs`, `autoMapInputData` |

**The finding that matters.** Node 8 does not consume the model's answer. It rebuilds the ten factor
signals from the snapshot (its own `factorSignals(tf)` function), scores them, and then node 9 writes
`direction_24h: output.direction_24h`, `factor_breakdown: output.factor_breakdown`,
`reasoning_summary: output.reasoning_summary` and so on - all of them **the code's own values**. The
model's directions, factor breakdown and reasons are parsed in node 7 and then overwritten.

Consequences, stated plainly:

- The stored number the dashboard shows is produced by arithmetic on the snapshot. On this workflow,
  the gpt-4.1-mini call is a **guard, not an author**: the chain fails if it returns no text or
  invalid JSON, but its verdict does not reach the stored row.
- The model is given a logic document whose weights and thresholds are **not** the ones the
  arithmetic uses (section 3). It is being asked to classify factors by a document that the same
  workflow then ignores.
- Two caveats, both checkable and neither yet checked by this lane:
  - `exports/` drift is a known open item owned by the live-path adviser, so the repo export may not
    be the workflow that is live in n8n today. Everything in this section rests on the repo export.
  - The other assets have their own workflows and their own gate node sizes (`usd_replay_core.js` is
    37 KB against Gold's 15 KB), so the "model is overwritten" pattern must be confirmed per asset.
    One repository commit - `0f6eaa3`, the SILVER contract fix - shows a workflow carrying the **GOLD**
    asset prompt, so per-asset prompt defects are real.

## 3. The document and the code disagree, and always have

`logic/agent_gold_direction.md` declares one weight vector for all horizons:

`F1 22, F2 18, F3 14, F4 8, F5 8, F6 10, F7 6, F8 6, F9 6, F10 2` (total 100).

Node 8 carries **five** vectors, one per timeframe. The 24h row is:

`F1 26, F2 22, F3 12, F4 10, F5 10, F6 8, F7 8, F8 2, F9 1, F10 1` (total 100).

The 3d, current-week, next-week and current-month rows differ again. The document's single vector is
closest to the code's **current week** column, which suggests the document was written around a
one-week horizon and never updated when the code went per-timeframe.

Other divergences read out of the same node:

- F2 threshold: the code uses **0.15** on 24h and 0.3 on every other timeframe; the document states a
  uniform 0.30.
- A second threshold pair (`0.3` on 24h, `0.5` otherwise) sits on another factor.
- Provenance: `logic/agent_gold_direction.md` was added by `3f614f6` ("Add files via upload",
  2026-06-07) and has **never been revised since**. The code moved; the document did not.

This is the first concrete answer to "what is in the black box": two different rule sets exist in the
same pipeline, and no artifact in the repository says which one is the project's own.

## 4. The program the user wants already half-exists

| Piece | Location | State |
| ----- | -------- | ----- |
| Deterministic re-implementation of the same logic, per asset | `backtester/replay/{gold,usd,eur,nq,btc,gbp}/<asset>_replay_core.js` plus `run_<asset>_historical_replay.js` | Exists. Gold core is 14.8 KB; it mirrors the live gate, per-timeframe weights included |
| Live-parity binding | `backtester/fixtures/gold_live_replay_24h_parity_fixture.json` | Exists |
| Stored call vs program comparison | `data/backtester-checker-gold-24h-2024-2026.json` | Exists. Meta generated 2026-06-30; **608 rows, 608 pass, 608 exact matches**; 15 fields compared per row including `factor_scores`; replay source `gold_replay_core.js`, outcome source `backtester/lib/outcome_evaluation.js`, flat band 0.3, tolerance 0.5 pp |
| Outcome evaluation | `backtester/lib/outcome_evaluation.js` and the `l2l-*` artifacts | Exists |
| Model-free factor measurement | `data/factor-edge-lab.json`, the factor coverage registry | Exists |
| One shared engine for all assets and all timeframes | - | **Does not exist.** Today it is six per-asset copies, mainly the 24h row |
| Whole-day replay (five horizons scored as one day) | - | **Does not exist** |

The 608-for-608 parity result must be read carefully, and the honest reading is weaker than it
looks: the checker and the replay core are the same arithmetic, so a perfect match is close to
guaranteed by construction. It proves the arithmetic is reproducible and that the stored rows were
produced by it. It is **not** yet evidence about the document, and it is not evidence about the
model's own judgement.

The same caution applies to the older pilot (`backtester/docs/gold_stored_call_pilot_20260906.md`):
154 stored Gold outputs reproduce their recorded factor signals and directions under the existing
replay, but the inputs are known-defective - **143 of 147 linked snapshots imply the same stale Gold
reference price**, because the collector read 25 unordered rows. Replacing that one input with the
best prior-date value changed **97 of 154 F5 signals and 19 final direction labels**. A faithful
rebuild therefore reproduces a call that was computed on wrong prices, and no accuracy claim can be
made until the input is repaired.

Already-recorded measurement limits that the rebuild inherits: F8 and F9 have no active observations
in the stored sample; 82 of 100 weight points are testable; the 25 session verdicts tested so far are
all no-information; the largest single row effect (F9) sits at roughly the noise floor for its sample
size.

## 5. The brief, step by step, mapped

**Step 1 - deep-research every element of the logic.** Elements are the ten weighted factors and the
28 declared drivers hanging under them. Existing: the coverage registry (16 of 28 drivers have a
local source), the factor-edge lab, the Gold research pages. Missing: a per-element research brief
with declared evidence rules (what counts as a source, what counts as a test) and honest coverage
reporting. Candidate owner: the idle Gold research lane - but note its standing rule is descriptive
research only, no outcome and no holdout reads, which is compatible with this step.

**Step 2 - frontier models judge whether the logic makes sense.** Nothing exists. The nearest thing is
the `analysis-engine` lane, published 2026-10-03 and still awaiting its worker: it is an audit lane
whose job is to describe, factor by factor, how one day's call is produced today and where the
weaknesses are. That overlaps this step's factual half and should be aligned with rather than
duplicated. What does not exist is a review protocol: frozen document and frozen inputs, two
independent reviewers, written disagreements kept.

**Step 3 - two frontier coding models red-team the logic.** Nothing exists. This is the cheapest step
because the surface is small and concrete: one 14,655-character gate node, six replay cores, one
document. The flaws are findable by inspection, and three are already found in section 3 by reading
alone.

**Step 4 - rebuild the chain as a program.** Largely done in per-asset 24h form; the work is to make
it one engine, seeded from the export rather than hand-re-derived, covering all five timeframes, with
a parity harness against stored rows, and with one explicit decision recorded: whether the model step
stays in the daily path as a guard or is dropped.

**Step 5 - backtest it as a full daily engine.** The evaluator exists; the engine does not. Two hard
dependencies: (a) the user's still-open decision on which session close defines a trading day, which
gates every lane's outcome definition; (b) input timing - the snapshot carries no authenticated
release timestamps, so a whole-day replay cannot yet prove that each input was knowable at call time.

## 6. Why the cost argument is stronger than the brief assumes

If the stored numbers already come from arithmetic (section 2), then a full-history daily backtest
needs **no model calls at all** - it needs engineering. The cost of the plan is therefore not tokens;
it is the price of getting the rules and the inputs right. That reframes the ten days: the spend that
matters is the research and the two reviews, not the replay.

What it cannot buy: a model's judgement where the document is silent. The document gives explicit
thresholds for F1, F2, F4, F5 and F6 and prose only for F3, F7, F8, F9 and F10 - and it is exactly the
prose factors that never speak in the stored sample. If those factors are ever to carry weight, a
judgement step has to exist somewhere, and that is a design decision, not a rebuild.

## 7. What must not happen

- No outcome, hit rate or backtest result may feed a live Layer 1 input, weight or threshold. Layer 1
  stays independent and backtesting stays downstream.
- No weight tuning on consumed holdouts, and no claim of edge from a passing replay.
- The sealed prospective window stays sealed until 2027-03-25T15:00:00Z.
- No per-record or per-combination model calls for work a program can do - this is the repository's
  own stated rule and it is what makes the plan affordable.
- The old Gold input defect is not silently retimed or overwritten; it is recorded as a defect.

## 8. Suggested bounded order

1. **Confirm the export against live n8n** before anything is built on it. One small, read-only check;
   the live-path adviser owns this surface.
2. **Freeze a one-page daily-engine contract**: which session basis, which weight vector, which inputs
   available at what time. Needs one user decision (the trading-day basis) and one project decision
   (document vector or code vectors).
3. **Build the shared deterministic engine** from the export, all five timeframes, with a parity
   harness over the stored archive.
4. **Deep-research the elements** with declared evidence rules; results feed the factor library, not
   the weights.
5. **Two independent frontier-model reviews** on the frozen document plus the frozen code; keep the
   disagreements.
6. **Whole-day backtest on the consumed archive**, labelled exploratory; the untouched holdout stays
   untouched.

Steps 1 and 2 are cheap and they gate everything. Nothing in this note is built, requested or
scheduled by this lane.

## 9. Open questions for the user

1. Where does the "10-day plan" live, and what is the book the initial algorithm came from (title and
   author)? Neither is present anywhere in this project, so this note maps the brief's words only.
2. Which rule set is the project's own: the document's one vector, or the code's five per-timeframe
   vectors? The stored 24h rows were produced with the code's 26/22/12/10/10/8/8/2/1/1.
3. Was the model ever meant to contribute, or was it always a formatting guard? If it was meant to
   contribute, node 9 overwriting its answer is a bug to be fixed; if not, the model step can be
   dropped and the daily call becomes free.
4. Which session or close defines a trading day? This remains the one decision that gates every
   backtest outcome in the project.
5. May the already-consumed Gold archive (608 rows, 2024-01-02 to 2026-04-30) be used for parity and
   exploratory work? Nothing fresh or sealed is needed.
6. Which lane builds the shared engine? The harness lane designs but may not build, the six asset
   lanes are standby and may not build, and the Gold research lane is idle but is not a build lane -
   so this needs one new bounded assignment from the coordinator.

## 10. Boundaries of this turn

Documentation and read-only inspection only. Read: the Gold workflow export, the Gold logic document,
the 24h checker artifact, the stored-call pilot, the replay and orchestration layout, the register,
the analysis-engine assignment. Files changed: this note and the notes entry. No code, workflow,
dashboard, data artifact, register entry, assignment, credential or production surface was touched.
Nothing was built, requested or scheduled, and no outcome, holdout or prospective observation was
read.




