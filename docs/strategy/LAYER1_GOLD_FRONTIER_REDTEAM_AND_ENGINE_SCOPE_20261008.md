# The layer 1 pack, the frontier review, the red team and the daily engine

Advisory note by worker `strategy` (`strategy-advisory-001`), 2026-10-08, at the user's instruction this turn. His
framing, verbatim: *"Okay lets discuss the needs here"*, then *"I need a full md document that breaks down the layer 1
logic of gold, all elements why they are used and why they are weighted as they are. I want this presented in a
document that I can share with other fronteir models who are reportedly better at analysis. Then inside the same
docuemnt I want instructions on each element so a research agent can validate whether each component ... I need this
all on the live dashboard so that we can see the progress of where we are at with everything, how each staged/element
has been researched and confirmed valid. then can be put into the fronteir models who can either confirm or deny the
validity of the 24hr call logic. I then need the instructions to build the red team that are able to analyse and
counter anything that is weak logic. Then we want as a phase on the page in the live dashboard the ability to turn
this improved analysis logic into a non llm api toekn based analysis engine that can review all the data of
historical days then make the call the engine would have made and confirm whether a l2l directional call would have
worked and a 0.5l2l directional call would have worked then a general directional call would have worked. We then
want to compare that against the current layer 1 calls in terms of perofrmance and the layer 2 calls for xau/usd so
this means we also need the usd layer 1 calls for the old/current model."*

This note confirms the requirement set, records the honest answer to "why are they weighted as they are", says what
already exists so nothing is built twice, fixes the shape of the four documents and the two builds this asks for,
and lists the seven decisions only he can make. It writes no page, no code, no engine, no assignment and no weight.
This worker holds no credentials for this advisory assignment, and the sealed prospective window (until
`2027-03-25T15:00:00Z`) was not read.

## 1. The requirement set, in seven parts

| # | What he asked for | Where it lands |
| --- | --- | --- |
| A | One shareable markdown document: every gold Layer 1 element, why it is used, why it carries the weight it does | document D1, `LAYER1_GOLD_LOGIC_PACK` |
| B | Inside the same document, per-element instructions so a research agent can validate each component | document D2, referenced from every element block |
| C | The whole thing visible on the live dashboard as staged progress, element by element, with "researched and confirmed valid" states | new stage surface on the dashboard (build 2) |
| D | Frontier models then confirm or deny the validity of the 24hr call logic | document D3 plus the per-element digest |
| E | Instructions to build the red team that attacks weak logic | document D4 |
| F | A dashboard phase running a non-LLM engine over historical days, making the call the engine would have made, graded three ways: full L2L reach, 0.5 L2L reach, general direction | the engine build (build 1) |
| G | Compare the engine against today's Layer 1 calls and the Layer 2 XAU/USD calls, which needs the USD Layer 1 calls of the old/current model | comparison arms, section 8 |

Parts A, B, D and E are documents this lane can write. Parts C, F and G are builds: this lane cannot build, publish
or run them, and each needs its own bounded assignment (section 10). Confirmed understanding, in one line: the
deliverable is one outside-facing pack that carries the element-by-element truth and the work orders for other
people, and its progress and its result are then shown on the dashboard as stages, not as prose.


## 2. The honest answer to "why are they weighted as they are"

He will ask the pack this first, so it is answered here before it is dressed up.

1. **The weights are declared, not derived.** `logic/agent_gold_direction.md` (v2.0, 7,794 bytes) carries exactly one
   vector - F1 22, F2 18, F3 14, F4 8, F5 8, F6 10, F7 6, F8 6, F9 6, F10 2, total 100 - with no derivation, no
   sample, no citation and no date. Searches for a recorded choice ("weights were chosen / set / derived /
   calibrated", "weight rationale", "why these weights") return nothing anywhere in the repository.
2. **The repository says so itself.** `backtester/lib/gold_source_readiness.js` opens with the comment *"Repository
   logic inputs, not a claim of an exhaustive economic literature review."* That is the project's own statement that
   the element list is a design choice, not a literature-backed model.
3. **A second vector set exists in code.** The Gold workflow's conviction node carries five per-timeframe weight
   vectors; its 24h column is F1 26, F2 22, F3 12, F4 10, F5 10, F6 8, F7 8, F8 2, F9 1, F10 1, and it implements an
   F2 threshold of 0.15 where the document declares 0.30. The stored 24h rows were produced with the code's vector,
   not the document's (verified 2026-10-08 from `exports/gold_layer1_agent.json`); the document's single vector sits
   nearest the code's current-week column (summed absolute difference 8, against 12 for the 3-day column).
4. **Only three of the ten elements carry a stated reason at all.** F1 and F2 have a "Reason" paragraph; the KEY
   RULES list an ordering in words (real yields most important, DXY second, Fed third) with no measurement behind it.
   F3 to F10 have rules and thresholds and no stated justification.
5. **The reasons that do exist are mechanism arguments, not results.** Cost of carry and the inverse dollar are the
   textbook place to start; they are not evidence of daily directional skill, and the project's own measurements say
   the same - Layer 1 sessions read 47.65% against a 53.19% always-up baseline.

So every element block in the pack prints two things side by side: why the design believes it, and what the record
shows. Anything else would hand a frontier model a claim this repository cannot support.

## 3. What already exists, so nothing is rebuilt or duplicated

Measured or read this turn, canonical checkout, read-only.

**Per-element progress already has a live control surface.** `data/research-proof-map.json` (4,589 bytes, generated
2026-09-03) carries six stages with statuses - reach `complete`, audit `complete`, elements `active`, combinations
`planned`, executable `blocked`, gate `planned` - each with its evidence, next action and target tab; a release gate
with four requirements, the second being literally *"Assess every individual algorithm element, then combinations and
correlation clusters, before proposing any weight change"*; four performance tiles (Full L2L reach 73.2% = 328/448,
0.5 L2L reach 99.1% = 444/448, data coverage 73.7%, call gate `NOT QUALIFIED`); and a five-item todo list whose
entries carry `active`, `needs_you`, `planned` and `blocked` states. It renders as the **Research Proof Map** tab of
`index.html` (`script.js`, `renderResearchProofMap`). This is the shape he is describing; it needs four more stages,
not a new invention.

**Per-call outcome grading already exists, for four of the five assets.** `data/l2l-trading-day-directional-v1.json`
(13,785,165 bytes, generated 2026-08-15) holds 4,085 eligible rows: 2,493 Layer 1 and 1,592 Layer 2, each with the
designated session's open, close, movement, `terminalDirection`, `classification`, `reachedHalfAdr20`,
`reachedFullAdr20`, the maximum favourable and adverse excursion in ADR units, the three reversal-but-reach flags,
the strength and exact-confidence buckets, and the chronological fold (`TRAIN` / `VALIDATION`). Its own published
comparisons, read this turn: Layer 1 overall 47.65% (1,188/2,493) against a 53.19% always-bullish baseline - EUR
46.14 (570), Gold 46.32 (570), NQ 51.96 (560), BTC 46.66 (793); Layer 2 overall 47.99% (764/1,592) against 53.45% -
EUR/USD 44.68 (385), **XAU/USD 46.88 (448)**, NQ/USD 54.84 (372), BTC/USD 45.99 (387). So the three grades he wants
are already computed per call, and the Layer 2 XAU/USD arm he wants as a comparator is already there. **No USD entity
appears in either layer of that artifact**, so USD Layer 1 has never been graded under this session definition.

**The USD calls of the old/current model do exist and are already parity-checked.** Five 24h checker archives sit on
disk for 2024-01-02 to 2026-04-30, each holding the stored call arm and the replay-core arm row for row:
`backtester-checker-gold-24h-2024-2026.json` (608 rows, 608 pass, 608 exact), `backtester-checker-usd-24h-2024-01.json`
(21,108,646 bytes, 604 rows, 604 pass, 603 exact plus one tolerance pass), `-eur-` (602/602/602), `-nq-`
(604/604/604), `-btc-` (850/850/850). Every row carries the stored arm's own `evaluation_result` and the
`evaluation_inputs` (open price, close price, close date), and the evaluation logic is the shared
`backtester/lib/outcome_evaluation.js`. Outcome counts read this turn: gold CORRECT 223 / WRONG 173 / FLAT 141 /
NO_CALL 26 / NOT_EVALUABLE 45; usd 197/175/172/15/45; eur 173/184/179/21/45; nq 179/175/177/28/45; btc
294/187/312/56/1. In all five archives the stored arm and the checker arm agree on `evaluation_result` on every row -
that is parity, not independent validation, because both arms are the same arithmetic.

So his closing sentence has a precise answer: **the USD Layer 1 calls of the old/current model are already on disk,
604 of them with outcomes**, and the gap is not the calls. The gaps are that nobody has graded USD under the
designated-session definition, that USD has no traded pair of its own so it can only be judged through the pairs that
consume it, and that the engine arm has never been graded at all.

**The non-LLM engine is half-built already.** Six replay cores exist (`backtester/replay/{btc,eur,gbp,gold,nq,usd}/
*_replay_core.js`; gold 14,794 bytes, usd 37,283) with runners for five of them (gbp has none), a live-parity fixture
for gold, and the shared evaluator `backtester/lib/outcome_evaluation.js`. What they lack is not logic: it is a
per-day input history for most assets and a grading pass over the engine's own arm. The USD path names its source as
`historical_usd_market_snapshots` (a credentialled table, `backtester/replay/usd/README.md`) and its input map exists
in `backtester/docs/usd_historical_data_acquisition_plan.md` (FRED `DGS2`, `DGS10`, `DFII10`, `VIXCLS` and the rest).
This advisory lane cannot read that table.

**A sibling lane already owns the plain-words description.** `analysis-engine` was published 2026-10-03 and is still
awaiting its worker; it owns `docs/analysis-engine/DAILY_CALL_LOGIC.md` ("how one day's call is produced today"),
`IMPROVEMENT_OPTIONS.md` and its own notes. Documents A and B overlap its factual half and must be aligned with it,
not duplicated: its job is what the system does today, this pack's job is to be readable by people and models outside
the repository.

**The plain factor table and a per-factor votes page are already live, and a USD one went out today.** Read from
`origin/main` (`e2df9f6`, release `usd-call-flow-20261008`) rather than from the canonical working tree, which sits on
the coordinator's control-plane branch and does not carry the site files at all - a trap this note avoided by using
`git ls-tree` and blob reads. The site has thirteen top-level pages, not the nine the branch checkout shows.
`gold.html` carries a six-tab strip: What moves gold, Start here, Direction, Movement - L2L and half L2L, Factor tables
(draft), Archive census. `what-moves-gold.html` (26,308 bytes, title "What moves the gold price") carries exactly four
sections - The ten factors, Where the number 28 comes from, What the archive has shown about these directions, What
this page is not - and mentions weights thirteen times. Published today, `layer1-call-flow.html` (38,674 bytes, "How
the calls are made") and `usd-layer1-call-flow.html` (34,067 bytes) are the one-page maps of the chain, and the USD
one already carries the section headings "What moves the call, and how each factor votes" and "How the ten votes
become the call". **So the pack he is asking for is the gold member of a family that already exists**: the same four
sections as `what-moves-gold.html`, expanded to the eleven-field element block, plus the per-element status table.
It extends that page rather than opening a fourth parallel surface.


**Four of the ten elements are known dark**, filed as `-059`: the inflation signal is a hardcoded stub in the rule
engine, safe haven has no field to read anywhere, Fed bias is a real live column that the historical builder writes
as null, and liquidity/growth is dead on a word - `"contracting".includes("contraction")` is false, so every
backtest scores it NEUTRAL forever. The pack must ship a status column, or half of it will describe something that
cannot run.

## 4. The four documents this lane will write

All four live in `docs/strategy/` in this worktree. They are written to be lifted out of the repository and read by
someone who has never seen it.

**D1 - `LAYER1_GOLD_LOGIC_PACK.md`, the shareable document.** Self-contained: no repository paths required to follow
it, no jargon without a one-line gloss, and every claim tagged as stated design or measured record.
1. What the system is, in five sentences, and the one question it answers.
2. The ten elements, one block each, in the template below.
3. The weight story: the declared vector, the code's five vectors, the divergence, and the plain statement that no
   derivation record exists.
4. The rules that are asserted rather than implemented, printed as such.
5. The 28 readings, each mapped to the element that consumes it (3/4/1/3/4/3/6/1/1/2), with the four dark ones marked.
6. What the system does not claim, in his own framing: no forecast guarantee, no result, and the current measured
   base rates printed next to the always-up baseline.
7. A one-page glossary: L2L, 0.5 L2L, designated session, conviction, participation, element, factor, snapshot.
8. Provenance table: every figure and the artifact it came from, so an outside reader can spot-check.

**Every element block carries these eleven fields**, and the pack is refused if any is blank:
1. Name and a one-line plain description.
2. The readings it consumes, with units and frequency.
3. The rule as implemented: the exact test, the exact thresholds, and which file and expression holds them.
4. The rule as documented: the same, from `logic/agent_gold_direction.md`, with any divergence named as divergence.
5. Which way it pushes gold, and for which horizon.
6. The weight it carries, which vector that number came from, and the provenance - declared, with no derivation record.
7. Why the design believes it matters: the mechanism, marked as a mechanism argument and not a result.
8. What would falsify it, in one falsifiable sentence.
9. How it is validated: the pointer to its D2 instruction block.
10. Its status today: live, live but dark, stubbed, or word-match dead, with the artifact that says so.
11. The honest unknown: what nobody knows yet about this element.

**D2 - `LAYER1_GOLD_ELEMENT_VALIDATION_INSTRUCTIONS.md`, the research agent's work orders.** The pack's element
blocks each point at one block here. The fixed shape of a block, so thirty runs are comparable:
1. The single hypothesis, one line: this element, this direction, this horizon.
2. The data: which artifact or table, which fields, the coverage, and the availability lag that must be respected.
3. The split, declared before anything is read: the interval, and the project's existing chronological folds kept
   intact rather than re-drawn.
4. The measurement: the element's own directional accuracy on its horizon, the full-L2L reach share, the 0.5-L2L
   reach share, the day count, the Wilson interval, and the best constant call on the same days printed beside all
   of it.
5. The verdict vocabulary, fixed: `holds`, `no_information` when the interval contains the baseline, `insufficient`
   when the day count is too thin to say, `dead` when the reading is dark or the match cannot fire.
6. The leakage guards: the reading must be knowable at call time; the split may not move after results are seen; no
   weight may be changed by this work.
7. The one-line plain summary for the dashboard row, written for a reader with no statistics.

**D3 - `LAYER1_GOLD_FRONTIER_REVIEW_BRIEF.md`, what the outside models are given and asked.** The pack plus the
per-element digest, and nothing else. The brief asks one thing per horizon - confirm, deny or cannot verify the 24hr
call logic as a coherent set of non-overlapping elements, then the 3-day, week and month - and requires each answer to
name the element, the evidence it rests on, and the one measurement that would overturn it. Two rules are printed in
the brief: a new weight vector may not be fitted to the material they were shown, and any proposal has to be
pre-registered and then tested on data that was not used to propose it. The sealed window stays out of the brief
entirely, and so does the row-level archive if a clean holdout is wanted later.

**D4 - `LAYER1_RED_TEAM_CHARTER.md`, the instructions for the red team.** The target is the logic, not the code
style. The charter ships the armoury that already exists so the red team starts from facts: the twin F2 thresholds
(0.30 declared against 0.15 in code), the two vector sets, the dead word-match, the four dark elements, the
same-day-input problem in which a stored dollar reading equals the negation of the same day's dollar change, the
always-up baseline the calls lose to, and the uncited weights. Each finding must be one sentence of the flaw, the
artifact that shows it, the measurement that would settle it, and severity - and nothing that is merely a preference.
One boundary is printed in bold in the charter: **no red-team finding may feed a live weight, threshold or input**,
because the project's own rule is that evidence never enters the live path.

## 5. What has to appear on the live dashboard

He asked for progress to be visible stage by stage and element by element, so the page has two levels rather than
one paragraph.

**Level one: the five phases, as stages with a status.** Written in the same shape `data/research-proof-map.json`
already uses - id, label, status, evidence, next action - so it can sit on the existing Research Proof Map surface
instead of inventing a second grammar, with the element-level table as a new tab on the Gold page beside Movement -
L2L and half L2L:
1. **Pack and instructions written** - evidence: D1 and D2, with their byte counts and digests.
2. **Elements researched** - evidence: one digest row per element, with the day count and the verdict.
3. **Frontier review** - evidence: the returned per-element verdicts, quoted, with the model named and the date.
4. **Red team** - evidence: the findings list, each with its severity and the measurement that would settle it.
5. **Engine and comparison** - evidence: the engine's graded arm against the four comparison arms (section 6).

Each stage needs the honest status vocabulary that already exists on that surface: complete, active, planned,
blocked - plus one the user's own wording needs, **needs_you**, for anything waiting on a decision of his. The page
rules the published family already holds itself to apply here too: a static page with no script, no frame and no
external request, built by a generator from named artifacts, with a build checker that fails when the wording, the
element count or a number drifts from the artifact it came from.

**Level two: one row per element**, and it is the table he has been asking for since 2026-10-03, now with the extra
columns his new brief adds: which readings it uses, its weight and where that weight came from, its status (live,
dark, stubbed, dead), whether it has been researched, the verdict and the day count, and one plain line saying what
the research found. No cell is blank: an unmeasured element prints "not yet researched", not a dash.

**What the page must say it is not**, on the page rather than in a footnote: these are the system's declared
expectations and research findings, not a forecast, not a pick, not a ranking and not a trading result; the current
base rates sit beside the always-up baseline so the reader can see the honest position; and no row on this page may
ever move a live weight.

## 6. The engine and comparison phase, exactly as he described it

**What the engine is.** A non-LLM, non-token program that, for each historical day, reads that day's inputs and
produces the call the deterministic engine would have made - no model call per day, no token cost - and then grades
it three ways:

1. **Full L2L directional call**: did price travel the published full L2L distance in the called direction?
2. **0.5 L2L directional call**: did it travel the half distance?
3. **General directional call**: was the designated session's direction right, independent of distance?

**The four comparison arms, and where each stands today.**

| Arm | What it answers | State on disk |
| --- | --- | --- |
| Engine (new) | what the program would have called, graded three ways | logic exists as six replay cores; has never been graded as an arm |
| Current Layer 1 calls | how today's calls perform | 2,493 graded rows, four assets (EUR 46.14, Gold 46.32, NQ 51.96, BTC 46.66) |
| Layer 2 XAU/USD calls | how the pair call performs | 448 graded rows at 46.88%, plus the published tiles: full L2L reach 73.2% (328/448) and 0.5 L2L 99.1% (444/448) |
| USD Layer 1, old/current model | the dollars side of the pair | 604 stored calls with outcome labels on disk, never graded under the session definition |

**The USD point he raised, settled.** The calls exist; what does not exist is a sensible way to grade USD on its own,
because USD is not a traded pair in this system - it enters the picture through the pairs that consume it. So the
honest design is to grade the dollars side through XAU/USD: run the engine's USD call into the same pair rule and
compare the resulting XAU/USD arm against the 448 real XAU/USD rows already graded, and separately report what the
USD call alone would have said, labelled as a diagnostic and not as a trade.

**What the engine phase cannot do without.** (1) A per-day input vector history at call time for each asset - gold has
an exported stored-call and snapshot history, USD's sources are mapped but not assembled, and the tables behind them
need credentials this lane does not hold. (2) The trading-day basis decision, which still gates every outcome
definition. (3) A declared entry and evaluation contract, because the proof map's own executable stage is `blocked`
for exactly this reason: without an intraday path and an adverse boundary, reach is research context and not
expectancy.

## 7. What this asks of the project

Three things, none of which this lane can do:
1. **One bounded build assignment for the engine** - the code plus the grading run, owned by a build-capable lane.
   The existing lanes each already hold one assignment and may not take a second, and `analysis-engine` is an
   advisory lane by its own terms, so this needs a new assignment rather than a re-use.
2. **One bounded build assignment for the dashboard surface** - the five phases and the element table, on the
   Research Proof Map surface or as its own page, written so every number on it names its artifact.
3. **A decided home for the per-element research itself.** The gold research lane already carries an unstarted
   `gold-dark-factor-repair-027` and an unconfirmed `gold-declared-band-measurement-026`, so a second assignment onto
   that lane would be suppressed by the one-assignment rule; the per-element work needs to be sequenced behind them
   or given its own lane deliberately.

## 8. The seven decisions, each with the default this lane will assume

1. **Which rule set is the pack's subject - the document's single vector or the code's five per-timeframe vectors?**
   Default: the pack prints both, marks the code's 24h vector as the one that actually produced the stored calls, and
   names the divergence as the first red-team item. Reason: printing one and hiding the other would make the pack
   disagree with the archive.
2. **Was the model meant to contribute, or is it only a formatting guard?** Default: describe it as a guard and
   recommend dropping the step, as already filed under `-063`. Reason: the conviction code node overwrites the
   model's parsed answer before the row is written, so the model changes nothing today.
3. **Where do the ten-day plan and the source book live?** Default: the pack states plainly that no derivation record
   for the weights exists in this project and names the day the document was last touched (2026-06-07). Reason: if a
   plan or a book exists outside the repository, it is the only place the weight rationale could be recovered from.
4. **Which session or close defines a trading day?** Default: keep the session the existing graded artifact already
   uses (its rows carry evaluation start and end times, roughly 00:00Z to 21:00Z) and print it as an assumption on
   every table. Reason: this single choice re-defines every outcome in the engine phase.
5. **What may the frontier and red-team work see?** Default: the declared pack, the per-element digest and the
   published base rates - never the sealed window, and not the row-level archive if a clean holdout is wanted later.
   Reason: a model that is shown the outcomes will invent weights that fit them, which is the one thing the release
   gate forbids.
6. **May the already-consumed archives be used for the engine comparison?** Default: yes - the five checker archives,
   the 4,085 graded rows and the published reach tiles are spent data, nothing sealed is needed. Reason: `-063`
   already assumed this and nothing in the plan requires fresh evidence.
7. **Which lanes build the engine and the page, and who does the per-element research?** Default: one new bounded
   assignment each for the engine and the page, and the per-element research sequenced behind the two gold-research
   items already queued on that lane. Reason: the one-assignment rule suppresses a second job on the same lane, and
   `analysis-engine` may not build.

## 9. Limits and provenance of this turn

Read this turn, canonical checkout, read-only: `logic/agent_gold_direction.md` (7,794 bytes - the weight table and
all ten rule blocks); `backtester/lib/gold_source_readiness.js` (the "not a claim of an exhaustive economic
literature review" comment, `GOLD_VARIABLES`); `data/research-proof-map.json` (4,589 bytes, six stages, release gate,
four performance tiles, five todo rows); `data/l2l-trading-day-directional-v1.json` (13,785,165 bytes - meta,
lineage, source population, the eleven comparison groups, the entity groups, one row per entity, one full row);
`data/backtester-checker-{gold,usd,eur,nq,btc}-24h-*.json` (all five, meta, summary, one row, and the outcome counts
across every row); `data/layer1.json` (417,783 bytes) and `data/layer2.json` (673 bytes - the latter is empty of
opportunities today and lists XAU/USD as avoided for missing 24H conviction); `backtester/replay/` (all eleven files);
`backtester/replay/usd/README.md`; `backtester/docs/usd_historical_data_acquisition_plan.md`;
`docs/orchestration/assignments/analysis-engine.md`; `logic/` (six agent documents, 7,794 to 35,026 bytes);
`docs/strategy/FACTOR_INFLUENCE_TABLE_20261003.md` and `docs/strategy/FACTOR_TABLE_SPEC_20261003.md`; the site's
thirteen top-level pages as they stand on `origin/main` `e2df9f6` (`git ls-tree --name-only origin/main`, then blob
reads of `gold.html`, `what-moves-gold.html`, `index.html`, `layer1-call-flow.html`, `usd-layer1-call-flow.html`,
`standing-dashboard.html`, `backtest-flow.html`), with `script.js` checked on the same commit for the proof-map
renderer and its data URL.

Limits, stated plainly:
- **This is advisory.** It writes a shape and the facts behind it. It builds no page, no engine, no assignment and no
  register entry, and it changes no weight, threshold, workflow, export, artifact or number anywhere.
- **The pack is not a claim of edge.** Every figure quoted here is a description of what exists, not a result about
  the future; the measured position is a coin flip against an always-up baseline, and the pack will say so.
- **Nothing here was verified against live n8n.** `exports/` may have drifted from what runs, which is the live-path
  adviser's surface, and this lane did not check it.
- **No warehouse, credential or sealed window was touched.** The archive rows quoted come from artifacts already on
  disk; reading the snapshot tables themselves would need credentials this assignment does not authorise.
- **The four documents are not written yet.** They are specified here because three of their seven inputs are the
  user's own unanswered decisions, and writing the element blocks before the rule-set question is answered would
  produce a pack that contradicts the stored calls.

## 10. What happens next, in order, once he answers

1. **Turn his answers into the four documents.** The pack first, because the element blocks and the instructions
   share the same wording; then the frontier brief and the red-team charter, which only quote the pack.
2. **Put the element status table in front of him before anything runs**, so the four dark elements cannot quietly
   become "researched" on the strength of a rule that never fires.
3. **Hand the per-element work orders to whichever lane is given them**, with the split declared before any read and
   the verdict vocabulary fixed. The gold research lane's two queued items come first, and its dark-factor repair
   (`gold-dark-factor-repair-027`) is the natural home for the four dark elements.
4. **Send the pack out to the frontier models** with the brief, collect the per-element verdicts, and print them
   beside the evidence rather than instead of it.
5. **Run the red team** on the same material and publish its findings with their severity, noting that none of them
   may move a weight.
6. **Only then build the engine**, because the engine is the thing whose output the whole pack is judged against:
   the graded three-way arm and the comparison table against today's Layer 1 calls and the Layer 2 XAU/USD calls.
7. **Publish the page last**, when there is a result to show, with every row naming the artifact behind it.





