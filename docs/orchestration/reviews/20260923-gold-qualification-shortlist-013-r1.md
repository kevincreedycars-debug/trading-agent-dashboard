# Gold qualification-shortlist-013 revision 1 accepted

Reviewed interactively on 2026-09-23 after the user asked to push the work to Gold.
Submission `20260923-gold-qualification-shortlist-013-r1`, mailbox SHA-256
`d2046724f3736a867f958d380b467d47910d7db109cbe49ab0552ce414ffcd63`.
Worker branch clean at `0d82157` from accepted base `67fcc09`, one commit and the six
disclosed files only.

## Independent verification

- The mailbox and submitted code/artifact hashes reproduce exactly. The selector
  and CLI hash to `8f3a3896...` and `aaf5c38f...`.
- A fresh coordinator run reproduced 255 eligible candidates, four selected and 251
  skipped. Its shortlist SHA-256 `ffa69b30...` and exhaustive-audit SHA-256
  `e7c57773...` are byte-identical to the submitted artifacts.
- The four ids occur in accepted order at positions 1, 2, 4 and 5. They use eight
  distinct variables; the ninth variable is excluded by the frozen one-use rule.
  Every id belongs to the frozen registry and passes the accepted gate.
- Code inspection and adversarial tests confirm the exact five permitted selection
  fields, reported-first ordering, complete tie breaker, one-per-pair and
  one-per-variable constraints, no skipped-candidate re-entry, cap enforcement and
  fail-closed input hashes/joins.
- Coordinator tests: shortlist file 7/7; nine focused Gold files 79/79; full local
  suite 463/463. The worker's 459/463 split is the known environment-dependent four
  secret-scanner failures, which pass in this environment.
- No prospective window, post-boundary outcome, holdout, live, integration,
  deployment or production action occurred. All protected 012/run-011 artifacts
  remain outside the six-file diff.

## Decision

Accepted as a bounded shortlist-freeze checkpoint. This is not prediction,
qualification, accuracy, causation, profitability or trading edge. The shortlist is
four fixed candidate ids, not a leaderboard, winner, formula or live rule.

The next bounded assignment is `gold-qualification-window-freeze-014`. Because the
012 first-anchor date predates the 013 shortlist freeze, 014 must freeze a genuinely
future first anchor at `2026-09-24T14:00:00Z`, prohibit backfill, and bind the four
ids and their consumed reference signs without reading prospective outcomes. A
separate later review is required before the window can start.
