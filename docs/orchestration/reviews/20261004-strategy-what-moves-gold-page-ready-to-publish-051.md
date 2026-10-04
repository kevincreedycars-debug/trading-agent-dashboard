# Review: 20261004-strategy-what-moves-gold-page-ready-to-publish-051

- Worker / assignment: `strategy` / `strategy-advisory-001`
- Mailbox: `.local/orchestration/inbox/strategy/20261004-strategy-what-moves-gold-page-ready-to-publish-051.json` - 12,557 bytes, sha256 `c944d39a0640622d169edf42fceca83fa63b49320f4cc4853c4d2007031ef60c` (reproduced from the immutable inbox file; equal to the requested hash).
- Reply: `.local/orchestration/replies/strategy/20261004-strategy-what-moves-gold-page-ready-to-publish-051.json` - 7,025 bytes, sha256 `74a552d9dd74114b91f67176cf5f387a119c0ff6605ed8538211134bcf860d46`, decision **accepted**; immutable and hash-bound, its `submission_sha256` equal to the inbox hash above.
- Cycle: 2026-10-04, thirty-fifth coordination cycle, dispatched background run, from the canonical checkout on branch `orchestration/control-plane-20260920`, under the controller lock that owns the run (`controller/status.json` state `reviewing`, detail this submission, pid 32960, updated `2026-10-04T11:44:50.346Z`).
- Assignment published by this review: **none**. `strategy` stays `advisory_active` under `strategy-advisory-001`, and no worker status changed.

## What was filed

A `ready_for_review` filing that records the user's verbatim instruction of 2026-10-04 - *"yes please push it all live to the live dashboard so I can see everything clearly and from there we can work on this"* - and files the built page plus a publish request. This lane cannot publish: it writes only `docs/strategy/` in its own worktree and holds no credential for a production action, so the filing is a request plus a checked artefact. One commit `ef4b4f6` on `workers/strategy-advisory-20260920` on sole parent `d2e73ff`, three files, 412 insertions and 0 deletions:

- `docs/strategy/WHAT_MOVES_GOLD_CANDIDATE.html` - the page to publish, 250 insertions.
- `docs/strategy/PUBLISH_REQUEST_WHAT_MOVES_GOLD_20261004.md` - the publish request and handover, 150 insertions.
- `docs/strategy/CONVERSATION_NOTES.md` - one dated entry, 12 insertions.

## Scope and artefacts reproduced from the checkout

- `git show --numstat ef4b4f6` names exactly those three files with no deletions; `git status --porcelain --untracked-files=all` in the worktree is clean apart from ignored `tmp/`; `HEAD^` is the declared base `d2e73ff`.
- Candidate: 24,628 bytes on disk, sha256 `3037ca5199eba771fbcb4e083d63cc50527ed3d0f825c13cf36e38600e7e8531`; stored LF blob `d96039d6`, 24,378 bytes, sha256 `19b98b78f16999b309212b7df3749e55a847054e8b69557aa426ffebad0c1139`. Both the CRLF and the LF figure reproduce.
- Publish request: 11,138 bytes, sha256 `25d2d001341687d1f3356278802441e26a2e3d7cda32c4e17a0e599e781332ed`.
- Notes: 326,662 bytes, sha256 `fda65726496750eed0bbb189c28afd7bdcb35a6869632ad15a2892ea01e1e969`, 3,641 CRLF endings, 0 bare LF.

## The page's figures re-measured, not trusted

- The ten weights on the page are the F1-F10 rows of `logic/agent_gold_direction.md` section 4 (22/18/14/8/8/10/6/6/6/2, `Total Weight = 100`), each confirmed by that factor's own `Weight: n` line.
- The direction rules printed are the document's own lines: real yield 5 bps (135-137), DXY beyond 0.30% (168-170), 2Y 5 bps (231-233), VIX above 25 / below 16 / neutral between (290-294); `F5` is confirmation only and may not outrank the macro drivers (269-271), and `F9` never says down (372-376).
- `GOLD_VARIABLES` in `backtester/lib/gold_source_readiness.js` holds 28 names; `backtester/registries/gold_variable_horizon_context.v1.json` holds 28 variables grouped F1:3 F2:4 F3:1 F4:3 F5:4 F6:3 F7:6 F8:1 F9:1 F10:2 with `declared_inventory_source.declared_count` 28.
- The page prints exactly those 28 declared names, in the registry's ten groups, table by table (10 factor rows + total; 28 reading rows + 10 group rows), 51 `tr` in two tables.
- The archive lines are what `docs/strategy/FACTOR_INFLUENCE_TABLE_20261003.md` section 5 already publishes: all 25 daily states `no_information`, 24 of 25 weekly with one `unstable_across_years`, and exactly one daily row at the interest threshold against roughly two and a half expected by chance.
- The page is self-contained: one `SHARED-NAV` marker pair, 0 `<script>`, 0 `<iframe>`, 0 `<link>`, 0 external URL.

## The publish it asked for is already done, by a concurrent pass

- `origin/main` in this shared `.git` is `ae9a1f0` "publish what-moves-gold.html with one bar entry, and close the styles cache-buster", committed `2026-10-04T12:42:31+01:00` and pushed `12:42:38+01:00` - before this dispatched run took its lock at `11:44:50Z`. It carries `what-moves-gold.html` at the site root: 251 lines, LF blob 24,467 bytes, `1994d325dd93b3c0dd3c6f2a3c96911b09aedc50`.
- The served artefact is the filed candidate plus **exactly one** 88-byte line and its newline (89 bytes), the "What moves gold" topbar link. Every other served page gained that same one line; `backtester/partials/shared_nav.html` grew both bar variants; `backtester/scripts/build_shared_nav.js` grew its page list from nine to ten; `backtester/tests/site_nav_consistency.browser.test.js` is updated to six bar labels and hrefs and ten pages.
- That the served copy differs from the filed candidate by exactly one line is itself the check on the lane's verbatim nav copy: the generator rewrote the whole `SHARED-NAV` block and only its own new entry changed, so the lane's copy was faithful.
- **Correction of record:** the commit message's "byte-identical (24,628 bytes, sha256 `3037ca51...`)" describes the copy step's input, the lane's CRLF file. The served site-root artefact is that page plus the one generated nav entry, so it is 24,467 LF bytes at blob `1994d325`; its CRLF form would be 24,556 bytes. No table row, figure or wording differs.
- The optional second step was **not** taken: `gold.html` carries no "What moves gold" tab; its only change is the same shared bar line, and the live Gold page keeps its five views at blob 32,333 bytes. That choice stays open and is the user's.

## The lane's four asks, answered

1. Publish and record the release - done by the concurrent interactive pass at `ae9a1f0` with the one bar entry; this background cycle may make no production change and verified the published bytes instead of repeating the publish. The optional Gold-page tab was not taken.
2. The live Gold page change is identified - `8ccbc39`, the coordinator's own gold view tidy publish; the page is now 32,333 bytes after the shared bar entry.
3. The `-048` reply repair - closed: `node scripts/coordination.js check --worker strategy` exits 0 with `errors []` and, after this reply, `pending 0`.
4. Resume the coordinator for one pass - this dispatched run is that pass for this filing; `-049` and `-050` were already replied to.

## Boundaries

The page states on its own face that the directions are the system's declared expectations and not findings, that the archive returned no usable direction, and that the one row at the threshold is the noise floor, so declared expectation stays visibly distinct from measured accuracy. Layer 1 is untouched and independent, backtesting stays downstream-only, nothing was measured, and no outcome, holdout or prospective observation was read. This review made no production change, no deployment, no warehouse mutation and no external message; it wrote only its reply, this review and the central handoff memory.

## Open items and observations

- No new bounded research assignment is published by this review. The user's standing direction was a publish, which is now live; the measurement table (`docs/strategy/FACTOR_TABLE_SPEC_20261003.md`) still depends on `gold-declared-band-measurement-026`, whose register entry is already published to `gold-research` (`instructions_published_awaiting_worker`) and whose pickup is the user's or the operator's.
- Recorded gap, not repaired here: the `-050` reply names `docs/orchestration/reviews/20261004-strategy-28-factor-link-tab-renamed-status-050.md` and that file is not present in the checkout. It is coordinator-side bookkeeping and does not affect this filing.
- Unchanged by this review: the working tree carries a concurrent pass's in-progress edits (`docs/CHANGELOG.md`, `docs/GOLD_HISTORY_PATCH_VALIDATION.md`, `docs/orchestration/projects.json`, `tools/strategy-node/Strategy.code-workspace`) plus three untracked `backtester/` files and one untracked live-trading review file; they were left untouched.