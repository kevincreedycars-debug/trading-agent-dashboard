# Gold combination-run-011 revision 2

Decision: changes requested, documentation-only. Reviewed interactively on
2026-09-23 after the user requested the next step and communication with Gold.
Submission hash: a5f2d6568706fed7b5b69b38fe37ad27f96aa404eb24bb975ff20d555c8644ab.
Worker clean at 1526d34; correction committed before execution at 5204894.

The substantive correction passes review. Independent manifest verification
re-hashed the unchanged frozen registry, accepted inputs, sources and module
closure. Independent ledger traversal validated all 2,548 unique records in
registry order, reproduced all 81 reconstruction checks and all submitted totals,
and found zero denominator or median mismatches when rebuilding every candidate's
availability-matched baseline. The focused suite passes 61/61. The new ledger
SHA-256 is 5cd452780e75af3f992bafd2618786fe1b0363ae1dd92e34810f1e6c3bee4f75.

No code or data rerun is requested. Two report sentences still contradict the
required scope and endpoint wording:

- The section-1 Outcome row still describes 1-hour, 4-hour and fifth-session
  endpoints even though this batch executed h24_post_event only.
- Sections 1 and 6 correctly say pooled all_computed is the sum of the separate
  endpoint groups, then say it is "never merged" / the observations are "never
  merged into one statistic." That is false for the explicitly pooled row. The
  intended statement is that exact and delayed denominators remain separately
  visible alongside the pooled sum and the pooled sum is not an independent
  sample or statistic.

Revision 3 is limited to correcting those sentences, removing the extra blank line
at EOF, and adding a small text regression if practical. Preserve every code file,
registry, input, manifest, ledger, summary, analysis and run directory byte-for-byte.
Do not rerun or regenerate outcome artifacts. Submit a unique revision 3 and pause.

No alternative cell, ranking, holdout, integration or production action occurred.

