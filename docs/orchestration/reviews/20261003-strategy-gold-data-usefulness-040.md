# Review: 20261003-strategy-gold-data-usefulness-040

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261003-strategy-gold-data-usefulness-040.json` - 9,548 bytes, sha256 `6e976bab081ae3c4d0943f0f1b25b1525d3c010e190b39dc001ab2d880c6491b` (reproduced from the immutable inbox file).
- Reply: `.local/orchestration/replies/strategy/20261003-strategy-gold-data-usefulness-040.json` - sha256 `19c807d7ce972630ea5364fe17c7fd6ecc5db9302a893b25d7e7acd9ed3e8a28`, decision **accepted**.
- Cycle: 2026-10-03, eleventh cycle, background dispatcher run, from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/status.json` state `reviewing`, detail this submission, pid 8184, `run.lock` owned by that pid).

## What was filed

A `ready_for_review` advisory filed at the user's instruction, quoting the user verbatim: return to the Gold
backtest data and analysis because it still reads as useless. It diagnoses why the published Gold surfaces read
as useless, states the base rates usable today, offers four bounded routes (R1 movement by factor state, R2 the
calls scoreboard, R3 apply the validated collector patch, R4 declare the forward record), asks the coordinator
two sequencing questions and the user four questions. Deliverable: `docs/strategy/GOLD_DATA_USEFULNESS_READ_20261003.md`
plus a `docs/strategy/CONVERSATION_NOTES.md` append. Docs-only inside `docs/strategy/`; nothing production-facing
was touched.

## Inspected evidence

- Scope: `git log ddac5a0..34309cc` is one commit; `git diff --stat` changes exactly two files, both under
  `docs/strategy/` (CONVERSATION_NOTES.md +60, GOLD_DATA_USEFULNESS_READ_20261003.md +163); clean tree at that head.
- Served pages from `origin/main` `f8bc80fe1d44a050ebfc247b24ae21cfe2bbf852`: gold-backtest-outcomes.html
  19,186; gold-direction-scorecard.html 143,102; gold-backtesting.html 292,270; gold-factor-wip.html 24,398;
  gold.html 5,733 - all five reproduce.
- Scorecard, read from the page's own embedded JSON via `tmp/served-data.js`: session_verdicts no_information 25,
  week_verdicts no_information 24 + unstable_across_years 1, 20 states right of their own drift and 5 wrong, one row
  at or above the 60 percent threshold on each horizon; baselines session n 964 at 55.81 percent (51.54 / 59.16 / 60.15 /
  50.83 by year) and week n 960 at 58.23 percent (2025 68.58); coverage 965 anchors, 964 with outcome, 5,115 event rows,
  28 variables, 25 states scored, 7 factors scored.
- Movement ladder: `tmp/l2l-scan8-20260929.js` re-run here, exit 0, both internal assertions PASS, headline cells
  reproduce (0.50 L2L either way 97.89 percent n 558; one-sided call 45.63 percent against always-up 61.13 percent; close
  on the call side 46.32 percent against 56.84 percent; five sessions 99.82 percent and 44.32 percent against 67.05 percent).
- Accepted 019 report: exactly 95,842,994 bytes; `tmp/count-report-fields.js` returns 147,465 each of median/q1/q3
  and 148,920 exact_zero.
- Parity artifact: `data/backtester-checker-gold-24h-2024-2026.json` carries 608 rows and no trade, entry, exit or P&L field.
- Input defect: `docs/CURRENT_STATE.md` still records the unordered 25-row Gold history read as a live input defect;
  `docs/GOLD_HISTORY_PATCH_VALIDATION.md` still reads installed n8n validation and production application outstanding;
  `backtester/drafts/gold_collector_history_query_patch.json` is unchanged.

## Hash reconciliation

The filing's artifact line (13,136 bytes, sha256 `4428f1c2...`) is the CRLF worktree form of the document as committed
at `34309cc` (LF blob `e8f1a0f6`, 12,973 bytes), not the file on disk after the lane's own follow-up commit. The lane
filed `20261003-strategy-gold-data-usefulness-040-addendum` (4,442 bytes, sha256 `2567d53f...`) in the same turn; its
commit `e17c260` narrows the attribution of four base rates and moves the document to 13,407 bytes / sha256 `25e05853...`
(LF blob `dc9256c4`, 13,242 bytes) and the notes to 258,038 bytes / sha256 `b35ddfc7...`, both reproduced here with a
clean tree. The addendum is a separate submission and was deliberately not reviewed in this cycle.

## Not re-derived

Four day-size figures (day range 1.4472 percent of session open, full L2L 0.7236 percent, 0.50 L2L 0.3618 percent, median
close-to-close move 0.6701 percent) and the per-side split (300 bearish / 270 bullish) are the lane's 2026-09-28
measurements on the same 570 sessions; the re-run scan does not print the size medians and the corrected document says so.
Re-deriving them would need one added median print, a research change this filing does not make.

## Decision and rationale

**Accepted**, as an accurate, in-scope, docs-only exploratory diagnosis with every load-bearing figure that can be
reproduced reproduced here, and with the one materially unreproducible class (the 2026-09-28 size medians) explicitly
marked by the lane. Acceptance is not adoption, execution, integration or deployment.

## Unresolved limitations

- The read is an exploratory diagnosis, not an accuracy qualification; the pilot's 54.88 percent on 82 scored calls is not an edge.
- The 2026-09-28 size medians are not independently re-measured.
- The stored-call pilot's entry timing is next-minute, not authenticated publication timing.

## Integration / deployment status

Nothing integrated, merged, published, deployed, refreshed or mutated. No assignment published, no worker status set to a
publish state, no holdout or prospective observation read, no controller or bridge file changed, no subagent spawned.
`strategy` stays `advisory_active` under `strategy-advisory-001`.