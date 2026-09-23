# Current task

Gold run-011 revision 2 has been independently reviewed. Its corrected per-candidate
availability baselines, immutable 2,548-record ledger, 81 reconstruction checks and
all aggregates reconcile with zero baseline mismatches; focused tests pass 61/61.
The remaining request is documentation-only: describe the executed h24 horizon
instead of the broader 1h/4h/five-session policy, and state that pooled all_computed
is the explicit sum of separately visible endpoint groups rather than saying the
groups are never merged. Await revision 3 with no code change or outcome rerun. No
alternative cell, next-stage research, holdout, integration or production action.
