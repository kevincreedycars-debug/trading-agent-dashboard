# First checkpoint — USD session research programme (2026-10-13)

Ordered as the brief asks. Every claim is labelled **extracted**, **researched**, **reviewed**,
**implemented** or **tested**. No performance figure in this package was produced by a forecasting harness:
none exists yet, and saying otherwise would be a false report.

## 1. The current USD input and decision inventory — **extracted**

`inventory.md`. Ten factors, ten weights, thresholds and lookbacks, exactly as the live node computes them;
the collector's inputs with units, source and availability lag; missing/stale/fallback behaviour; and the
split between documented, implemented and LLM-discretionary behaviour. Headline findings:

- The code's 24h weights (`10,14,10,10,14,4,24,12,1,1`) disagree with the committed rulebook's own table
  (`10,14,16,14,6,5,3,18,12,2`), and both are live: the code computes the published number, the rulebook is
  fetched from GitHub on every run and read by the model.
- The rulebook is version 2.1 and cites **no book or edition**. No source material exists in the repository:
  a flagged gap, not something to reconstruct from memory.
- Three rulebook rules are not implemented (VIX 1d/5d modifiers and the conflict rule, F8 as a delta, the
  conviction penalty/boost machinery, which the code hard-codes to zero).
- The highest-weight live family (economic surprise plus Fed bias, 36 of 100 as coded) cannot be verified
  from repository-reachable data at all.

## 2. The session-target contract and the data-availability assessment — **extracted**, one decision **open**

`session_contract_v1.json`. Cutoff 05:00 `Europe/London`, endpoint 05:00 `Europe/London` on the next local date:
one 24-hour session whose two ends are wall-clock times in the same zone, so no US changeover date can move it,
and `America/New_York` is kept only for the timing of the Fed's H.10 release. Every eligible start is exactly 24
hours; the London spring and autumn transitions fall inside the preceding Saturday start, which is not a session
and measures 23 or 25 hours (measured, and held by test over every Monday-to-Friday start). **Corrected on
2026-10-14** from the original 05:00 London → 17:00 New York statement; the correction and its consequences are
in `CHECKPOINT_3.md`. The as-of rule is
enforced in code: an observation dated after the cutoff is refused, not down-weighted.

Data-availability assessment, live and historical assessed separately, is in `inventory.md` §7. The short
version: **no intraday USD instrument exists on either path today.** The live collector takes one snapshot
per day at the 09:30 ET pipeline time and prices the dollar with FRED `DTWEXBGS`, a daily index published
with a 1–2 business-day lag (re-measured in checkpoint 2 as a **2–6 business-day availability lag at the
05:00 London cutoff, median 4**: H.10 is released Mondays at 16:15 ET for the previous business week, and the
1–2 day figure is the FRED refresh lag); the repository holds hourly OANDA caches only for EUR/USD, XAU/USD and NAS100,
and only to 2026-04-30. The label instrument and quote source are therefore **unverified**, and that is the
first blocking decision; the contract file lists the three candidates reviewed, why each fails as a DXY
source, and the fallback of publishing the call in whatever instrument actually has a source.

## 3. The research task list and the ready-to-run frontier packages — **prepared**, not **researched**

`assignments/`. Five self-contained packages, each stating what it may read, what is deliberately withheld
so the work is genuinely independent, and what it must return:

| Package | Assignment |

## 4. The proposed reusable research-card schema — **implemented and tested**

`research-card.schema.json`, explained field by field in `research_card_schema.md`, with
`backtester/lib/usd_session_research_card.js` as the validator and
`backtester/tests/usd_session_research_card.test.js` as its guard. Each schema field is traceable to a
sentence of the brief: mechanism, sign-change/weakening/priced-in conditions, role as direction or regime or
quality gate or abstention gate, dependencies and double-counting risk, historical and live data
requirements, what was observable at 05:00 London, a programmable hypothesis with bounded parameters, a test
that could reject it, and only-fetched sources. It is asset-agnostic, so the same shape will carry EUR, GBP,
GOLD, SILVER, NQ, BTC and WTI cards later without a schema rewrite.

## 5. The record of exposed evaluation periods — **extracted**

`exposed_periods.md`. The 24-hour study's development, validation and holdout windows, its accuracies, its
winner and its losers, and its shadow window are all recorded as **already read**. The only genuinely
untouched objects for the new study are the 05:00→05:00 London intraday label itself, which no artefact in this
repository has ever computed, and prospective days after 2026-04-30. The record therefore imposes three
rules: freeze design before scoring, count the first exploratory look at the label's own distribution as a
cost to be recorded, and reserve a declared tail block plus the prospective days for independent
confirmation. The 24-hour archive may be used for mechanism exploration and pipeline testing and never again
as a holdout.

## 6. Implementation and experiment plan, with blockers — **implemented** interfaces only

`implementation_plan.md`. Isolation, data and feature construction, the three separately identified engines
(original, repaired, research), a proposed frozen evaluation design with splits, budget and a sealed block,
the 100-configuration limit, and the sequencing. What actually exists in code today:

- `backtester/lib/usd_session_engine_interface.js` — session resolution for the two London instants and the as-of
  snapshot that refuses look-ahead (18 test assertions);
- `backtester/scripts/lib/research_path_guard.js` — the write-path guard (7 test assertions);
- `backtester/lib/usd_session_research_card.js` — the card validator (8 test assertions).

`npm run test:usd-session` runs all 33. **No forecasting engine, dataset or harness has been built**, and
none of the 100 configurations has been run.

Blockers, in the order they bite: the label instrument and quote source (substantive, the user's); Reviewer
B's approval of the frozen design (review gate); the book/edition gap (missing source material); consensus
and first-print vintages (access, or an explicit decision to keep that family out of the directional
budget); the three frontier-model runs (external); and live collector paths for any new input before a

## 8. The horizon-mismatch caveat, recorded here rather than in the closed study's report

The 05:00→05:00 London target makes the closed 24-hour study's endpoint a different object from the one the
new engine is asked about: that study measured a 09:30 ET snapshot against the 16:00 ET close of the *next*
valid trading session, whose measured elapsed time is 30.5 hours at the median. Its numbers stand as the
answer to that question. Re-measured on the study's own 583 evaluable rows against the corrected window, the
study's interval overlaps the session for 14.5 hours (15.5 in the weeks when New York changes before London),
leaves the session's first 9.5 hours (New York time 00:00 to 09:30) uncovered, and runs a median 16 hours past
the session's endpoint. When the deployed engine is scored on the new label, every table must disclose that
mismatch; the "about 7 nominal hours" figure recorded below at checkpoint 1 was an artefact of the superseded
17:00 New York endpoint and is withdrawn.

The coordinator deliberately did **not** edit `docs/review/usd-24h-ruleset-v1/USD_24H_IMPROVEMENT_RESULTS.md`
to add this note: that file already carries unrelated uncommitted edits from another workstream, and adding
to them would have mixed two programmes in one review artefact. The caveat lives here instead.

shadow phase (access, and out of scope for this research instruction).

## 7. What changed in the repository, and what did not

Changed: this new tree under `docs/research/usd-session/v1/`, three guarded modules
(`backtester/lib/usd_session_engine_interface.js`, `backtester/lib/usd_session_research_card.js`,
`backtester/scripts/lib/research_path_guard.js`), three new test files, and one focused npm script
(`test:usd-session`). No existing document was edited, including the closed study's report, which still
carries its own unrelated uncommitted edits untouched.

Not changed: no workflow export, no production configuration, no dashboard file, no dispatcher or mailbox
state, no credential file, no credential-bearing artefact, and none of the pre-existing uncommitted
gold-policy, confidence-mapping or workspace edits, which remain exactly as found.

| --- | --- |
| `USD-SESSION-A1` | USD price behaviour and risk conditions at the cutoff (7 cards) |
| `USD-SESSION-A2` | Rates, policy expectations, releases and calendar context (8 cards) |
| `USD-SESSION-A3` | Reviewer A: mechanisms, signs, timing, interactions, regimes, double-counting |
| `USD-SESSION-A4` | Reviewer B: data availability, leakage, statistical design, fidelity, overfitting |
| `USD-SESSION-A5` | Synthesis into one engine specification plus an issue register |

Each package withholds the 24-hour study's numbers and the coordinator's expectations from the two field
assignments, and keeps Reviewer A and Reviewer B blind to each other. They are ready to hand to the models
the user runs externally; **no card, review or synthesis has been produced**, and the coordinator has not
substituted its own analysis for the assigned research.
