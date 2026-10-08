# Review: 20261008-strategy-layer1-pack-frontier-redteam-and-engine-scope-064

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261008-strategy-layer1-pack-frontier-redteam-and-engine-scope-064.json` - 11,216 bytes, sha256 `0048d5fc86b73bc9988706c782cc1a75d9008977bea84fc2814a1630ff9b3d59` (reproduced from the immutable inbox file; equal to the requested hash).
- Revision handled in the same cycle: `.local/orchestration/inbox/strategy/20261008-strategy-layer1-pack-frontier-redteam-and-engine-scope-064-r1.json` - 5,124 bytes, sha256 `e3ded1eb00a87e60f3c00325f880733df9743b53f9ef4551e26bc65b2f03dea5` (reproduced; artifact-line revision only).
- Replies: `.local/orchestration/replies/strategy/20261008-strategy-layer1-pack-frontier-redteam-and-engine-scope-064.json` - decision **accepted**, 14,087 bytes, sha256 `9264a6c9271b62c9210e500b00f7c1b9eb3471a36c62e5e32a5b3b037767227b`; and `.local/orchestration/replies/strategy/20261008-strategy-layer1-pack-frontier-redteam-and-engine-scope-064-r1.json` - decision **accepted**, 2,728 bytes, sha256 `a678b0918e53e97b6eca9a39c5833026021b400d0d21a9849f19f58eec5dbce6`. Both published with the canonical CLI (`node scripts/coordination.js reply --file ...`), each `submission_sha256` equal to its own inbox hash; after publication `check --worker strategy` reports `pending 0`, `errors []`, and the whole mailbox `pending 0`, `errors 0`.
- Cycle: 2026-10-08, background coordination cycle, dispatched background run from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/run.lock` pid 39948 naming this submission, `controller/status.json` state `reviewing`, detail this submission, updated `2026-10-08T07:48:35.341Z`). A background turn already owns the lock, so no pause or stop was run and no controller or bridge setting was touched.
- Assignment published by this review: **none**. `strategy` stays `advisory_active` under `strategy-advisory-001`, and no worker status changed anywhere in the register.

## What was filed

A `ready_for_review` docs-only advisory answering the user's 2026-10-08 brief on seven parts: one shareable markdown pack on every gold Layer 1 element with why it is used and why it is weighted as it is; per-element research instructions inside the same document; staged element-by-element progress on the live dashboard; frontier models confirming or denying the 24hr call logic; instructions for a red team; a dashboard phase running a non-LLM, non-token engine over historical days and grading full L2L, 0.5 L2L and general direction; and a comparison against today's Layer 1 calls and the Layer 2 XAU/USD calls, which needs the USD Layer 1 calls of the old/current model.

One commit on `workers/strategy-advisory-20260920`, base `a5caf22`, head `0ee34543ec57a11d7012e885461dc5ffa492eb10`:

- `docs/strategy/LAYER1_GOLD_FRONTIER_REDTEAM_AND_ENGINE_SCOPE_20261008.md` - 342/0.
- `docs/strategy/CONVERSATION_NOTES.md` - 57/0.

399 insertions, 0 deletions in total; tree clean apart from ignored `tmp/`. The lane disclaims any build, request, schedule, production, credential, warehouse, holdout or prospective-observation action, and makes no accuracy, edge, timing or completion claim.

## Scope and artefacts reproduced from the checkout

- `git` in `.local/worktrees/strategy`: head `0ee3454` has sole parent `a5caf22053d33f1ef5d822b76d7dff3b54bf8ed9` (the declared base), `git rev-list --count a5caf22..0ee3454` is 1, `git show --numstat` names exactly the two declared files, and the tree is clean under `git status --short --untracked-files=all`.
- Both artefacts reproduce byte for byte at the filed head: the note is 29,480 CRLF bytes over 342 lines with 0 bare LF and 0 bare CR and sha256 `2f588d304d201bd06f89d980e11b86438b449ca9685d2b3bfbe281b2da35e9c1`; `CONVERSATION_NOTES.md` is 400,450 bytes / sha256 `d56aca9e13cfbe9be1eee2c2f52772d6d1ec7657f1d4ef6e9cf66e62913697a3`. Both equal the declared figures.
- Tests are correctly disclosed as not run, with the reason stated (two markdown documents and no source, data, workflow, dashboard or backtester file), which the assignment permits for documentation-only work.
- The note was read end to end rather than summarised: the seven-part requirement table, the eleven-field element template, the D1-D4 document shapes, the five-phase dashboard surface with the added `needs_you` status, the engine's three grades and four comparison arms, the seven decisions with their defaults, the leakage rules, the red-team boundary that no finding may feed a live weight, threshold or input, and the limits section.

## Every headline figure re-derives independently

Read from the canonical checkout and the lane worktree, not taken from the summary:

- `data/l2l-trading-day-directional-v1.json` is 13,785,165 bytes; `source_population` is `eligibleInputRows` 4,085 = `eligibleLayer1Rows` 2,493 + `eligibleLayer2Rows` 1,592; no USD entity appears in either layer. Layer 1 overall 47.65% (1,188/2,493) against a 53.19% always-bullish baseline, with EUR 46.14 (570), Gold 46.32 (570), NQ 51.96 (560), BTC 46.66 (793). Layer 2 overall 47.99% (764/1,592) against 53.45%, with EUR/USD 44.68 (385), XAU/USD 46.88 (448), NQ/USD 54.84 (372), BTC/USD 45.99 (387).
- A sampled Layer 1 row carries `terminalDirection`, `classification`, `reachedHalfAdr20`, `reachedFullAdr20`, `maxFavourableExcursion` / `maxAdverseExcursion` and their ADR forms, `halfReachButTerminalReversal`, `fullReachButTerminalReversal`, `anyReachButTerminalReversal`, `strengthBucket`, `exactConfidenceBucketKey` and `chronologicalFold` - so the three grades and the folds do already exist per call, as filed.
- The five 24h checker archives re-read exactly: gold 608 rows / 608 pass / 608 exact, usd 604 / 604 / 603, eur 602 / 602 / 602, nq 604 / 604 / 604, btc 850 / 850 / 850. Stored-arm outcome counts: gold CORRECT 223 / WRONG 173 / FLAT 141 / NO_CALL 26 / NOT_EVALUABLE 45; usd 197/175/172/15/45; eur 173/184/179/21/45; nq 179/175/177/28/45; btc 294/187/312/56/1. The stored arm and the checker arm agree on `evaluation_result` on every row of all five archives (0 disagreements, 0 non-pass statuses).
- `data/research-proof-map.json` reproduces as six stages (reach `complete`, audit `complete`, elements `active`, combinations `planned`, executable `blocked`, gate `planned`), a four-requirement release gate whose second requirement is the element-by-element assessment before any weight change, four performance tiles (73.2% = 328/448, 99.1% = 444/448, coverage 73.7%, call gate `NOT QUALIFIED`) and a five-row todo carrying `active`, `needs_you`, `planned` and `blocked`.
- `logic/agent_gold_direction.md` carries exactly one vector - F1 22 / F2 18 / F3 14 / F4 8 / F5 8 / F6 10 / F7 6 / F8 6 / F9 6 / F10 2 - and a uniform DXY threshold of 0.30. `exports/gold_layer1_agent.json` carries five per-timeframe vectors whose 24h row is F1 26 / F2 22 / F3 12 / F4 10 / F5 10 / F6 8 / F7 8 / F8 2 / F9 1 / F10 1 with `tf === "24h" ? 0.15 : 0.3` on F2. The divergence is real and is the first red-team item as the note says.
- Six replay cores and five runners exist under `backtester/replay/` (gold core 14,794 bytes, usd core 37,283), beside the shared outcome evaluator; `data/layer1.json` is 417,783 bytes.
- On `origin/main`: the release label `release/usd-call-flow-20261008` reproduces from `docs/USD_CALL_FLOW_PUBLICATION_20261008.md`; `gold.html` carries the six-tab strip the note quotes; `what-moves-gold.html` carries the four named sections and 13 case-sensitive occurrences of `weight`; `usd-layer1-call-flow.html` carries "What moves the call, and how each factor votes" and "How the ten votes become the call"; `index.html` and `script.js` still reach the proof map and its data URL. `git tag --list` is empty, so the release is a branch label rather than a tag - a naming nuance, not a defect.

## Provenance observed

`main` moved after the read. `e2df9f6` ("Give the USD call map the white printable version, and publish it", 08:45:19 +0100) was the tip read; the tip is now `bf13747` ("Record the live read-back of the white printable version", 08:48:04 +0100), so the page inventory was taken at a valid commit now one ahead. Nothing in the note depends on the difference.

## Four precision points of record, and one correction

Four non-material observations, to refresh rather than re-file:

1. **Page counts.** At `e2df9f6` there are 12 top-level HTML files, not thirteen: backtest-flow, dashboard-northstar, gold-backtest-outcomes, gold-backtesting, gold-direction-scorecard, gold-factor-wip, gold, index, layer1-call-flow, standing-dashboard, usd-layer1-call-flow and what-moves-gold. Thirteen is the recursive count once `backtester/partials/shared_nav.html` is included. The canonical tree's nine are the same nine files the note's later clause names, so the process note's "carries no site pages at all" contradicts its own next clause: it carries nine, and what it lacks is the four published family pages (`gold.html`, `what-moves-gold.html`, `layer1-call-flow.html`, `usd-layer1-call-flow.html`).
2. **Three page sizes read one byte higher here than as filed** - `what-moves-gold.html` 26,309 LF bytes against 26,308, `layer1-call-flow.html` 38,675 against 38,674, `usd-layer1-call-flow.html` 34,068 against 34,067 - a one-byte reading convention applied consistently across all three, with no argument resting on it.
3. **"all eleven files" under `backtester/replay/`** is the eleven `.js` cores and runners; `README.md` is a twelfth file in that directory.
4. **The usd checker's own summary** records `rows_checked` 604, `pass` 604, `exact_matches` 603 and `tolerance_pass` 0, so "one tolerance pass" is correctly inferred from pass minus exact but is not written in the artifact's own tolerance counter. One further imprecision, recorded as an example rather than a claim: the sampled graded row's evaluation window runs 22:00Z to 21:00Z, so "roughly 00:00Z to 21:00Z" in decision 4 is loose; the point that the session basis must be declared on every table stands.

One correction of record, and it is exactly the trap the startup procedure names. The note's provenance list reads "`data/layer2.json` (673 bytes - the latter is empty of opportunities today and lists XAU/USD as avoided for missing 24H conviction)". The 673-byte file is the canonical checkout copy, dated 2026-09-07T06:14:48Z, and it is only as new as this branch. The live published copy on `origin/main` is dated 2026-10-08T05:37:28.052Z and is not empty: it carries two opportunities (BTC/USD BUY rank 1, NQ/USD BUY rank 2) and it avoids XAU/USD for "Mixed or low conviction 24H signals", not for a missing conviction. So "today" is wrong and the quoted reason is stale. Nothing in the note's argument rests on it - the pair call is avoided either way - but the pack must not print a checkout copy as today's dashboard, and the correct reading is `git fetch origin` then `git show origin/main:data/layer2.json`.

## The artifact-line revision

`20261008-strategy-layer1-pack-frontier-redteam-and-engine-scope-064-r1` (inbox 5,124 bytes, sha256 `e3ded1eb00a87e60f3c00325f880733df9743b53f9ef4551e26bc65b2f03dea5`) supersedes the -064 envelope's artifact line only. Head `969d3565023104d4851a844e75b4ef54ab2599f1`, sole parent `0ee34543`, two commits past the declared base, `+19/-0` on the one markdown file. The revised note reproduces byte for byte at 30,905 CRLF bytes over 362 lines with 361 CRLF, 0 bare LF and 0 bare CR and sha256 `4783e38a12ba84d3255114d7da9f7706e63aa58e74a642a949d15212530f0700`; `CONVERSATION_NOTES.md` is genuinely unchanged. The delta is verified by diff, not accepted on description: it is items 4 to 7 of section 10 (send the pack out, then the red team, then the engine, then the page last), the paragraph reflow that stops the five-phase paragraph being absorbed into the fifth list item, and the removed double blank line in section 3. The lane branch tip on origin equals `969d356`. No measurement, finding, figure, question, decision or blocker changed.

## Decision

1. **Accepted on the reviewed bytes only, as the record it is.** The advisory writes no page, code, engine, artifact, weight, threshold, workflow, export or number. No accuracy, edge, timing, readiness or completion claim is made or granted; a clean tree, a parity pass or a read-only export read is not evidence of live deployment, causal feature timing or trading edge, and the note says so itself.
2. **The -064-r1 artifact-line revision is accepted in the same cycle** on its own hash, as a revision of the same note and nothing more.
3. **No assignment is published and no worker status changes.** The register row keeps status exactly `advisory_active` under `strategy-advisory-001`, and nothing anywhere in the register was set to any other status.
4. **The pack, the element work orders, the frontier brief and the red-team charter are accepted as specified shapes only.** None of the four documents exists yet.
5. **The dashboard-icon question from the accepted -062 advisory stays open and unbuilt**, exactly as that answer left it.

## Why no assignment is published now

- The only decision-free part of the work is this lane's own drafting on its stated defaults, and an advisory lane that already holds `strategy-advisory-001` needs no new assignment to continue writing its own notes.
- The per-element research cannot be homed on `gold-research` without breaking the one-assignment rule and being masked: that lane still carries an unstarted `gold-dark-factor-repair-027` at exactly `instructions_published_awaiting_worker`, and its connection record for `gold-declared-band-measurement-026` reads `sent_unconfirmed`.
- The two builds have no lane: the seven `backtester-<asset>` lanes are readiness and standby only and already hold their own revisions; `backtester-harness` designs but builds nothing and sits at `design_records_accepted_awaiting_decisions`; `analysis-engine` is advisory by its own terms and still awaits its worker; and creating a build lane is a structural change the register shows has always been the user's to trigger.
- The engine's per-day inputs sit behind credentials this advisory assignment does not hold and a background coordination run may not open, and the proof map's own executable stage is `blocked` pending an entry and adverse-boundary contract.

## Precise unresolved decisions that gate the next assignment

1. The user's: which session or close defines a trading day - it gates every outcome definition and therefore the engine comparison.
2. The user's: which rule set the pack describes - the document's single vector (F2 0.30) or the code's five per-timeframe vectors (24h, F2 0.15); the stored 24h rows were produced with the code's vector, so printing both and marking the code's 24h vector as behind the stored rows is the only honest default, and decision 1 already says so.
3. The user's: whether the model step stays as a guard or is dropped.
4. The user's: whether the spent archives (the five checker archives, the 4,085 graded rows and the published reach tiles) may serve the engine comparison and the per-element measurement; decision 6 defaults to yes and nothing sealed is needed.
5. The user's: where the per-element research lives, defaulting to sequenced behind the gold lane's two queued items.
6. Coordinator and user together: which lane may build the engine and which the page, which needs one new bounded build assignment before either exists.
7. Owner-bound, not the user's to answer here: whether `exports/gold_layer1_agent.json` is the workflow live in n8n today - `exports/` drift is an open item owned by the live-path adviser, and every node-level claim in `-063` and this note rests on the repo export.
8. Added by this cycle: whether this lane should now draft the decision-free parts of the pack on its stated defaults - the weight story, the 28-reading map, the provenance table, the glossary and the what-it-does-not-claim section - while the element blocks wait for the rule-set answer.

## Boundaries held

No production, deployment, workflow execution, warehouse read or write, purchase, credential change, external message or holdout read by this cycle. Layer 1 stays independent and backtesting stays downstream-only; the pack is a description of declared logic and measured base rates, never a qualification. The canonical checkout's pre-existing unrelated state (`M tools/strategy-node/Strategy.code-workspace` and the five untracked `backtester/` Gold session-policy files) was left exactly as found, and the lane's worktree and branch were not modified. This cycle's own activity was recorded with `monitor-state.js` (`working`, then `paused`).
