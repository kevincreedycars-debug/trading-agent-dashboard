# Gold future-window manifest freeze

Assignment: gold-qualification-window-freeze-014. Published 2026-09-23.
Worker: gold-research. Worktree: D:/trading-agent-dashboard-codex/.local/worktrees/gold-research
Branch: workers/gold-research-policy-20260920. Starting HEAD: 0d82157.
Standing user authority to advance Gold research applies.

Assignment 013 is accepted. Its exact frozen selector returned four hypotheses from
the 255-candidate eligible pool and the audit reconciles all 255 dispositions. This
assignment freezes the evaluation manifest and a genuinely future qualification
boundary for those four ids. It does not acquire or read any prospective outcome
and does not start or backfill the window.

1. Bind the manifest to the accepted 013 shortlist and audit before reading any
   additional consumed field:
   - `backtester/tmp/gold-shortlist-013-20260923/selection-shortlist.json`, SHA-256
     `ffa69b3065e8564e121778286c6d63fc9504774e5e233ca3deb5cdef3b6e338f`;
   - `backtester/tmp/gold-shortlist-013-20260923/selection-audit.json`, SHA-256
     `e7c5777307ffd834429ea3950f3ebf9bebd08f2e984f52765a812318e76cda42`;
   - accepted run-011 revision-2 ledger, SHA-256
     `5cd452780e75af3f992bafd2618786fe1b0363ae1dd92e34810f1e6c3bee4f75`.
   Require exactly the four accepted candidate ids in accepted order and refuse any
   mismatch, duplicate, replacement, reordering or change to selector rules.
2. Correct the prospective timing before the window opens. The protocol-012 date
   `2026-09-15T14:00:00Z` predates the shortlist freeze and must not be backfilled.
   Freeze the first weekday 14:00 UTC anchor strictly after this assignment was
   published: **2026-09-24T14:00:00Z**. Freeze the corresponding 26-week boundary
   and enumerate the expected weekday anchors deterministically. Record the old
   date as superseded-before-use, not consumed and not retrospectively eligible.
3. For each of the four already-selected ids only, attach the accepted exploratory
   reference median sign needed by protocol 012's later consistency comparison.
   Read it from the hash-bound consumed ledger only after the selected id/order is
   fixed; it must not change selection, ordering, thresholds or membership. Record
   the exact source field and fail closed on zero, missing, non-finite, contradictory
   or ambiguous reference signs. Do not attach any post-boundary observation.
4. Freeze a new immutable machine-readable evaluation manifest containing the four
   ids in accepted order, reference signs, the future anchor schedule/boundary, the
   unchanged protocol-012 scoring rules, stopping rule, minimum sample, exact/delayed
   endpoint separation, flat and missing-data handling, dependence/multiplicity
   warnings, and all input/code/output hashes. Provide a human-readable companion.
5. Add focused tests proving no anchor earlier than 2026-09-24 enters the manifest,
   no backfill path exists, only the four accepted ids can enter, reference signs
   cannot affect membership/order, input drift fails closed, and the output repeats
   byte-identically. Run focused tests and `npm test`, submit one unique 014 envelope,
   and pause for coordinator review.

Owned scope: a new offline manifest builder/CLI, focused tests, immutable manifest
artifact and scoped documentation. Preserve assignments 012/013, their accepted
code/docs/artifacts, the frozen registry and every run-011 artifact byte-for-byte.
Do not start, execute or simulate the qualification window; acquire/read no outcome
at or after the new first anchor; do not use anchors from 2026-09-15 through
2026-09-23; do not reserve/consume a separate holdout, fit a formula or alter the
four-id shortlist. No network, live workflow, warehouse, credential, Layer 1,
dashboard, integration, deployment, purchase, weight or production change. Stop
and submit a blocker if the accepted artifacts cannot support the manifest exactly.
