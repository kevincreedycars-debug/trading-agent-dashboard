# Review: 20261003-strategy-gold-view-and-fault-first-042

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261003-strategy-gold-view-and-fault-first-042.json` - 12,025 bytes, sha256 `56e70c366b749b4068446214f175a774acbbd8f4b4d00e5f0cccecb7bccb3ed1` (reported by `coordination.js check` and reproduced from the immutable inbox file).
- Reply: `.local/orchestration/replies/strategy/20261003-strategy-gold-view-and-fault-first-042.json` - sha256 `2c21ebdf50a211bdeeeef1823d4580ba0dbacd5980acdb0a1d1a8ad92687603c`, decision **accepted**.
- Cycle: 2026-10-03, fifteenth cycle, background dispatcher run, from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/status.json` state `reviewing`, detail this submission; `.local/orchestration/controller/56e70c366b749b4068446214f175a774acbbd8f4b4d00e5f0cccecb7bccb3ed1.jsonl` is this submission's own lock file).
- Assignment published by this review: `gold-declared-band-measurement-026` on `gold-research`, register status exactly `instructions_published_awaiting_worker`.

## What was filed

A `ready_for_review` advisory filed on the user's answers this turn, not new research. It orders the gold work
the user asked for - fix the collector fault first, tidy the gold view onto one tabbed page, open the movement
measurement - and records the withdrawal of the forward record (R4 of `-040`). Deliverables: two `docs/strategy/`
files, `GOLD_VIEW_TIDY_AND_FAULT_FIRST_ORDER_20261003.md` (new) and a `CONVERSATION_NOTES.md` append. Docs-only
inside `docs/strategy/`; no page, stylesheet, script, template, builder, guard, generator or data artifact was
touched.

## Inspected evidence (reproduced, not trusted)

- Scope: `git rev-parse HEAD` is `8a08113a634181fa1771cc8df8fd8fbb5206c5ac` with sole parent
  `2147cac210abcdc720147035b953708568e5d4e9`; `git diff --name-only 2147cac 8a08113` lists exactly the two
  reported files; `git show --stat` gives 49 insertions on the notes and 190 on the filing, 239/0 in total.
- Blobs: the filing's LF blob is `a527d45d7d944781a392d78510a82398195d5e18` at 15,624 bytes and the notes' is
  `330e0dcdfa4e5af1e621e9effe97e45f3e460f86` at 263,604 bytes - both exactly the objects the envelope declares;
  15,814 bytes CRLF / sha256 `ce3f4b32...` and 266,670 bytes CRLF / sha256 `6567387...` are their CRLF
  materialisation, matching the artifact line.
- Served tree, from `origin/main` `f8bc80fe1d44a050ebfc247b24ae21cfe2bbf852` by `git cat-file -s` on each blob:
  `index.html` 18,775; `gold.html` 5,733 titled "Gold - one page with tabs" with zero `.topbar` and zero
  `side-rail` references; `gold-direction-scorecard.html` 143,102; `gold-backtesting.html` 292,270;
  `gold-backtest-outcomes.html` 19,186; `gold-factor-wip.html` 24,398. The bar carries exactly one gold entry,
  `<a class="topbar-link" href="gold.html">Gold</a>`, and `gold-factor-wip.html` carries "50 of 50 answers in".
- Fault: `docs/CURRENT_STATE.md` still records the unordered 25-row Gold history query as a live production input
  defect with the prepared repair unapplied; `docs/GOLD_HISTORY_PATCH_VALIDATION.md` line 3 still reads "installed
  n8n validation and production application remain outstanding"; `backtester/drafts/gold_collector_history_query_patch.json`
  is present and unchanged.
- Figures: 46.32 / 56.84 / 53.33 / 40.00 percent are pre-existing measurements of 2026-09-28 on the same 570
  sessions, present in `GOLD_VIX_BOTH_AND_FACTOR_TABLE_PLAN_20260928.md`, `INTENT_QUESTIONS_ANSWER_SHEET_20260929.md`
  and the accepted `-040` read, not newly invented by this filing.

## Undeclared post-filing divergence (recorded, not penalised)

The envelope reports `dirty_files: []` and a clean tree, and both were true at filing (17:05:49). The lane has
since committed `1604389dc1b4785b8d9920377f8aa91567c53b01` at 17:15:16, "strategy: name the gold page in the nav
work order, close the three choices, and judge the day-size figures", +163/-30 across `CONVERSATION_NOTES.md`,
`COORDINATOR_NAV_TIDY_HANDOVER_20261003.md` and `GOLD_VIEW_TIDY_AND_FAULT_FIRST_ORDER_20261003.md`, with the
worktree clean again at that tip. That revision answers a later user turn about the gold page's own top and side
bar and closes `-039`'s three navigation choices, so it is the advisory lane continuing its live conversation
with the user rather than a defect in the reviewed bytes. It does mean the reviewed bytes are no longer the branch
tip and section 1's "the three navigation choices need restating" is already superseded; that revision needs its
own submission ID before any coordinator action relies on it.

## Decision and rationale

**Accepted**, as an accurate, in-scope, docs-only advisory whose every load-bearing claim reproduced here, with
one precision note (the patch is "unchanged since 2026-09-07", the file's own last commit, not the 2026-09-09
prepared date of the validation document) that changes no figure, verdict or ask. Acceptance is not adoption,
execution, integration or deployment.

## Assignment published by this review

`gold-research` moves to `gold-declared-band-measurement-026` at register status exactly
`instructions_published_awaiting_worker`. The new work order `docs/orchestration/assignments/gold-research.md`
measures the share of sessions clearing full L2L and half L2L, on the accepted 1/2/3/5-session ladder, for factor
states already accepted, derived only from already-accepted artifacts (the 019 report's stored per-state
`median`/`q1`/`q3`/`exact_zero` fields) and the lane's accepted scans. It declares no new band, rule, threshold,
operator or state; re-runs no spent revision; reads no outcome, holdout or prospective observation; touches no
production surface; and stops at the review boundary. The superseded `gold-coverage-025` work order is archived at
`docs/orchestration/assignments/gold-coverage-025-archive.md`, and its carried 022 item A anchor observation
envelope is preserved as section 0 of the new work order. R4's withdrawal is recorded in `DECISIONS.md`.

Asks (1) and (2) of the filing are not a background run's: applying the validated collector patch is a production
change with a live workflow, and the tidied one-page view is a coordinator edit to the published site. Both stay
with the user and the interactive coordinator, and this run carries no production authority.

## Unresolved limitations

- The advisory is not accuracy, edge, timing or qualification evidence, and the movement measurement it opens is
  exploratory and descriptive only.
- Whether the accepted 019 report's stored fields can supply every cell of the measurement is not asserted here;
  the work order requires the worker to report any cell the accepted artifacts cannot supply rather than invent it.
- The four 2026-09-28 day-size figures remain the lane's own measurement; a later revision directs one added print.

## Integration / deployment status

Nothing integrated, merged, published, deployed, refreshed or mutated. No page, patch, workflow, credential, Layer
1 input, dashboard file or data artifact was touched. No controller or bridge file was changed, no controller pause
or stop was run, no other coordinator process was started, no subagent was spawned, no external message was sent,
and no outcome, holdout or prospective observation was read. The canonical checkout's unrelated dirty state (a
modified `tools/strategy-node/Strategy.code-workspace` and five untracked backtester gold session-policy files) was
left exactly as found. `strategy` stays `advisory_active` under `strategy-advisory-001`.
