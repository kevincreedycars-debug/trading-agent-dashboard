# Review: 20261004-strategy-live-call-reliability-and-rebalance-evidence-056

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261004-strategy-live-call-reliability-and-rebalance-evidence-056.json` - 17,397 bytes, sha256 `923c435dfea7a5e96cf05135e299dc0dc33dd3c637b2afe5167309567d2cf8ef` (reproduced from the immutable inbox file; equal to the requested hash).
- Reply: `.local/orchestration/replies/strategy/20261004-strategy-live-call-reliability-and-rebalance-evidence-056.json` - decision **accepted**, published with the canonical CLI (`node scripts/coordination.js reply --file ...`), reply sha256 `6ead0fb0c36c8ac637d8d2ae8550e7e838596c4b0913935720c9f47f42a89fd9`, its `submission_sha256` equal to the inbox hash above; after publication `check --worker strategy` reports this filing `accepted` with `errors []`.
- Cycle: 2026-10-04, forty-second coordination cycle, dispatched background run, from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/status.json` state `reviewing`, detail this submission, pid 32960, updated `2026-10-04T14:38:53.860Z`).
- Assignment published by this review: **none**. `strategy` stays `advisory_active` under `strategy-advisory-001`, and no worker status changed.

## What was filed

A `ready_for_review` docs-only advisory answering the user's two-part question - are today's live Layer 1 calls reliable, and is the re-weighting attempt statistically better than the original - from artifacts already on disk, read-only. One commit on `workers/strategy-advisory-20260920`, base `de5617f`, head `95f479354706ce530cdd38be9201b2d512f75f3e`:

- `docs/strategy/LIVE_CALL_RELIABILITY_READ_20261004.md` - 207/0.
- `docs/strategy/CONVERSATION_NOTES.md` - 56/0.

263 insertions, 0 deletions; tree clean apart from ignored `tmp/`. The lane explicitly disclaims any live, weight, collector, dashboard, workflow or other worker action, and makes no accuracy, profitability or trading-edge claim.

## Scope and artefacts reproduced from the checkout

- `git` in `.local/worktrees/strategy`: head `95f4793` is exactly one commit past the declared base `de5617f` (`rev-list --count de5617f..95f4793` = 1); `git show --numstat HEAD` names exactly the two declared files at 207/0 and 56/0; `git status --porcelain --untracked-files=all` prints nothing.
- Both artefacts reproduce byte-exactly at the filed head, re-derived here: the read is `17,391` bytes, `207` CRLF, `0` bare LF, sha256 `0cc1dcdaa7743188d2e7624103f3e8ccad1540410545769b74b1adf3624bf868`; the notes are `354,918` bytes, `3,817` CRLF, `0` bare LF, sha256 `bdcdb41bcdaa2c1267e95b7959e896b46932157911e709e497f1007652bd268e`.
- The remote tip equals the filed head: `git ls-remote origin refs/heads/workers/strategy-advisory-20260920` returns `95f479354706ce530cdd38be9201b2d512f75f3e`, so the push landed even though the branch has no configured upstream.

## The answer reproduces, figure by figure

Re-derived from the published artifacts, not taken from the document:

- **Session contract** (`data/l2l-trading-day-directional-v1.json` 2026-08-15T16:47:04.959Z; verdict `data/l2l-directional-research-verdict-v1.json` 2026-08-15T18:42:25.793Z): population 4,085 = 2,493 Layer 1 + 1,592 Layer 2 with the cross-layer duplicate ids flagged; folds TRAIN 2024-01-03/2024-12-31, VALIDATION 2025-01-01/2025-09-30, FINAL_TEST 2025-10-01/2026-04-30 sealed and `final_test_consumed`. Layer 1 **47.65%** (1,188/2,493), Wilson 45.70-49.62, -2.35pp vs 50 and -5.5pp vs the **53.19%** majority baseline; bullish **50.69%**, bearish **42.96%**; EUR 46.14% n 570 i 42.09-50.25 b 50.18, GOLD 46.32% n 570 i 42.26-50.42 b 56.84, NQ 51.96% n 560 i 47.83-56.07 b 57.32, BTC 46.66% n 793 i 43.21-50.14 b 50.19; gold bearish 40.00% (120/300, i 34.62-45.64) vs bullish 53.33% (144/270); pooled by fold TRAIN 49.95% n 1,089 b 54.18, VALIDATION 43.84% n 796 i 40.43-47.31 b 54.52, FINAL_TEST 48.52% n 608 i 44.57-52.49 b 50.33 (fold counts 1,089 + 796 + 608 = 2,493); `layer1AccuracyMonotonicNonDecreasing` false; Layer 2 matched 1,592, net improvement 0, improved 0, worsened 0; the verdict `plainEnglish` and `prohibitedFutureClaims` quoted verbatim. The 97% / 70-72% figures are the path-dependent excursion metric (96.99 / 70.52 Layer 1) and are correctly quarantined.
- **Stored-gold defect** (`backtester/docs/gold_stored_call_pilot_20260906.md`): 154 stored outputs 7 June-6 September, 143 of 147 linked snapshots implying the same 4266.066005 reference price, all 154 reproducing their recorded signals (replay parity, not input quality), and the counterfactual changing 97/154 F5 signals and 19 final direction labels.
- **24-hour panel** (`data/confidence-band-delivery.json` 2026-07-28T19:35:10.154Z, horizon `following 24hrs`): pooled Layer 1 directional accuracy 54.39%, gold 56.31%; band rows reproduce as quoted (30-39 51.0% n 398, 80-89 57.8% n 232, 90-100 90.9% n 11; thresholds very limited 0-9, limited 10-29, reasonable 30-99, substantial 100+, `insufficient_for_primary_emphasis` under 30).
- **Re-weighting** (`data/phase-2-shadow-backtest.json` 2026-07-07T11:26:43.687Z): gold original 608/563/76/338/149 ex-flat **18.4%**, shadow 395/170/123/102/178-no-call ex-flat **58.0%**, comparison `PASS`, `ex_flat_change_pct_points` **39.6**; overall 5 assets, 2 improved 0 degraded 3 mixed, average 23 points. Its methodology contains no confidence, Wilson, significance, p-value, interval or statistical term, so the claim of no interval or paired test reproduces; the `agree ex-flat 56.3% vs asset baseline 18.4%` factor-text inconsistency the filing flags also reproduces.

## Corrections of record

Acceptance is on the reviewed bytes only; the following are recorded centrally and must be applied in the lane's next revision of the read. None changes the answer to either half of the user's question, and all four are confined to derived or side figures:

1. **Section 2 pooled counts are doubled.** The doc's 2,132 correct of 3,920 evaluated across 6,362 calls is `pooled_layer_band` (1,066/1,960/3,268) plus `pooled_layer_direction` (1,066/1,960/3,094) - two overlapping scope groupings of the same Layer 1 rows; gold's 446/792 across 1,186 is `exact_market_direction` (223/396/578) plus `market_band_both_directions` (223/396/608). Single-count figures: pooled Layer 1 **1,066/1,960 = 54.39%**, gold **223/396 = 56.31%**. The rates are unaffected, but the standard error at n 1,960 is about **1.13pp**, not 0.8pp, and the call totals are 3,094 or 3,268 (gold 578), not 6,362.
2. **Section 2 uses the wrong base rate.** 53.19% is the session contract's Layer 1 bullish share (1,326 of 2,493), not measured on the 24-hour panel's window. The panel's own unconditional bullish share, recomputed from its rows (correct on BULLISH rows plus wrong on BEARISH rows), is 1,065 of 1,960 = **54.34%**, so on its own window the panel is **+0.05pp over always-up, not +1.2pp**. This strengthens the filing's conclusion - the 24-hour calls also show no skill over base - but the sentence as written imports another window's base, the very trap section 6 warns about.
3. **The "15 rows carry no historical calls" figure does not reproduce**: 11 of the 100 Layer 1 market-by-direction rows, and 16 of the 180 Layer 1 rows across all scope types, carry zero historical calls.
4. **The "both in the 20-60% range" reach claim is half right**: the half-ADR-20 reach rate is 61.8-66.6% across the Layer 1 assets (64.34% pooled, 64.04% gold); only the reach-but-terminal-reversal rate (20.2-22.3%) is inside 20-60%.

## Boundaries

Read-only throughout. Layer 1 stayed independent and backtesting downstream-only; exploratory results stayed distinct from accuracy qualification. Nothing was measured on the market, and no outcome, holdout or prospective observation was read, so no final holdout was consumed; the sealed window stays prohibited until `2027-03-25T15:00:00Z`. This cycle made no production change, no deployment, no purchase, no credential change, no warehouse mutation and no external message; it wrote only its reply, this review and the central handoff memory; it changed no controller or bridge file or setting, ran no controller pause or stop, started no other coordinator process and spawned no subagent. The unrelated canonical dirty state (one modified `tools/strategy-node/Strategy.code-workspace` and five untracked `backtester/` Gold session-policy files) and every worker checkout were inspected only and left exactly as found.

## Open items and the precise unresolved decision

- **No new bounded research assignment is published by this review.** The lane's own question - whether to schedule the Phase-2 gold baseline reconciliation - is answered no for now: that step is real, cheap and downstream-only (arithmetic over stored inputs that would either resurrect or retire the +39.6pp headline), and is recorded here as the concrete candidate, but every lane that could take it (`gold-research`, `analysis-engine`, `live-trading`, `strategy-2` and the seven `backtester-<asset>` lanes) already holds its one assignment, so a second assignment would break the one-assignment rule.
- **The precise unresolved decision is the user's or the operator's:** whether to schedule the Phase-2 shadow original-gold-arm reconciliation (default if unanswered: hold at "not measurable at today's weights" and publish nothing), and on which lane; and separately the existing pickup of `gold-declared-band-measurement-026`, whose connection record reads `sent_unconfirmed` at `2026-10-04T14:43:25.002Z` while `gold-research` activity still sits at `gold-coverage-025` paused `2026-09-25T19:54:06.758Z`, so a bare reset is masked and none may be reported as woken.
- The companion filing `20261004-strategy-weighting-balanced-evidence-055` remains `pending_review` in the queue and is not adjudicated here.
