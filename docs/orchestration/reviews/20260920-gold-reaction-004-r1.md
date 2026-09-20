# Individual-variable report review: changes requested

Submission 20260920-gold-reaction-004-r1; SHA-256
1168797fb5dc9baf638344626fd55ba6fa5dd5422b72045bccf05e21b03832e3.
Worker HEAD a6978bf; checkout clean. Coordinator reran 16 focused tests (all pass)
and reproduced report hash 215365ec8621b7bf0d5e3a3b5d022511427ffca962d96a5b17a6a6f8b0dabc4a
in ignored tmp/gold-004-review-report. Full suite not independently rerun.

The report pipeline exists and preserves the 28 inventory rows, but these findings
prevent acceptance of the variable-level conclusions:

1. variableReportRow keys stateByAnchor only by timestamp. Multiple event rows at
   one release time overwrite one another, so distinct events inherit the last
   event's state. Event observations already retain event_row; preserve identity.
2. Baseline and variable direction/magnitude statistics aggregate all computed
   outcomes together. Exact/delayed counts alone do not provide separate statistics.
3. contextStrata aggregates outcomes by context independently; variableReportRow
   never joins variable state with prior context. This does not answer the requested
   individual-variable reactions conditioned on prior context.
4. Event surprise signs are grouped without event-family keys, despite within-family
   comparability labels. Recent-surprise context likewise loses family identity.
5. Variable year_breakdown uses all computed outcomes rather than each variable
   state and its available observations, making the year tables generic baselines.

Issue gold-reaction-005 to correct these within the existing report-owned files.
Keep original outputs immutable and retain all existing research limitations.
