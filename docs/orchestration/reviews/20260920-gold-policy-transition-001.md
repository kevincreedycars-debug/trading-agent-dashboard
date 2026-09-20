# Gold policy transition review

Submission: `20260920-gold-policy-transition-001`; worker `gold-research`;
assignment `gold-policy-001`.
Submission SHA-256: `170817bbc6e918defd75bfd60f735caa09543ce358ac86e45a85be25565476e1`.

Decision: **changes requested**. Transition/preservation verified; implementation
and session qualification not accepted. Nothing integrated or deployed.

## Independent checks

- Canonical tracked files remain unchanged at bbb7111 before this review; five
  untracked files match every submitted SHA-256 and byte size. Gold worktree is
  clean on workers/gold-research-policy-20260920.
- Re-ran the submitted focused tests: 14/14 pass. Did not rerun the full suite;
  374/378 is the worker's reported result, not this review's verification.
- Re-ran the local audit into a fresh ignored directory. Content hash reproduces
  `2afa40f4009d3c877e8da19af7bd88c1a3de7568acab3a7069f95a67708d267e`.
  Its counts reproduce under its declared rules; this does not independently
  establish those rules or validate the claimed usable horizons.
- Independent synthetic probes saved at
  `tmp/gold-transition-review-20260920/probes.json`. Audit output is under
  `backtester/tmp/gold-session-policy-coordinator-review-20260920/`.

## Findings that block acceptance

1. **Future close in prior context.** `buildSessionCalendar` stores the bar's open
   timestamp as daily_close.time; `priorSessionCloses` compares that timestamp
   with the anchor. A complete historical H1 candle opened at 23:00 is admitted
   at a 23:30 anchor even though its close is available at 00:00. Reproduced on
   2026-01-05. Use actual close/availability time for prior cutoffs and distinguish
   it from bar open and session identity throughout reporting.
2. **Missing final bar silently replaced.** `buildSessionCalendar` chooses the
   last present trading bar, not the required declared final bar. With winter
   Monday's declared 23:00 bar absent, the probe selects 21:00 as daily_close.
   This contradicts the registry/documentation's explicit no-fallback contract.
   Missing/incomplete final bars must make the close unavailable. Preserve
   expected-session positions so missing sessions cannot compress a five-session
   horizon/lookback into five surviving sessions.
3. **Calendar validation is circular.** The 44-date register and six closures
   are fitted to the same archive being checked. Freezing them after inspection
   does not independently prove absent hours were market closures. Zero
   unexplained absences is an archive-fit result, not source completeness.
   Obtain applicable provider schedule/holiday evidence with dates; otherwise
   keep exceptions explicitly inferred/unknown and blocking in a verified mode.
4. **Session identity and estimator units need resolution.** Current sessions
   are grouped by UTC calendar date, including Sunday snippets; that is not yet
   justified as five provider trading sessions. Volatility takes consecutive
   available closes across variable-duration gaps but is labelled per hour.
   Define the session boundary and distinguish adjacent-observation volatility
   from genuinely hourly returns; unexpected gaps must not silently disappear.
5. **Aligned horizon qualification needs explicit limits.** Entry/endpoint
   searches can advance without a delay bound. Preserve the reported user rule
   to align to the first complete bar, but specify which delayed observations
   are excluded or placed in separate strata and report actual price-availability
   intervals. A delayed endpoint is not automatically an exact 24-hour return.

## Answers and next authority

The user's substantive research authorization remains valid. The coordinator
protocol governs routing and integration; it does not erase earlier work. The
reported 1h/4h diagnostic-only and first-complete-bar choices are carried forward
as reported user constraints, not replaced with new trading rules. Record their
provenance separately from archive-derived calendar assumptions.

Preserve the existing code, do not discard it or rewrite from scratch. New
assignment `gold-policy-002` authorizes a hash-verified copy of the five files
into the clean worker checkout and an explicitly experimental baseline commit,
then corrective code/tests and a policy proposal in separate commits. This
baseline is preservation, not acceptance. Do not reset the branch to 0b0e92d or
remove coordinator setup commits. Canonical originals stay untouched pending
later reconciliation. Reaction reports and further formula work remain gated on
review of the corrected policy implementation.

Reply: `.local/orchestration/replies/gold-research/20260920-gold-policy-transition-001.json`.
Current assignment: `docs/orchestration/assignments/gold-research.md`.
