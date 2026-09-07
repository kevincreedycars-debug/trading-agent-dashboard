# Repository consolidation — 2026-09-07

Authorized scope: preserve and inventory the messy research workspace, consolidate useful changes, return to the original project folder, retire redundant worktrees and establish a clearer backtesting direction. Production deployment is not part of the local cutover.

## Baseline and preservation

The integration branch `consolidate/main-20260907` starts from production `origin/main` at `125d871e8f0ad0964f91b7ef5ea84a5ad2e21623`, fetched on 7 September. It preserves the production dashboard's newer Backtest Engine, Research Proof Map, market-state presentation and published data instead of replacing them with the old research checkout.

Before integration, all ten existing worktree directories were archived. The research archive contains 2,142 files / 790,660,467 uncompressed bytes, including ignored research evidence and untracked work. Dependency directories and Git administrative files are excluded from file archives; a verified all-refs Git bundle preserves commit history, branches and checkpoint refs. Every archived file has a SHA-256 manifest entry; ZIP CRC verification passed for every archive. Missing/prunable worktree registrations have no directory to archive, but their refs are in the bundle.

Recovery location after cutover: `D:\trading-agent-dashboard-codex\.local\consolidation-20260907\`. This is ignored local material and may contain historical credentials/browser state. Do not publish it. `worktrees-before.json`, `refs-before.txt`, `manifest.json`, `research-before.patch` and `all-refs.bundle` describe the pre-consolidation state.

The original trial checkout was clean before consolidation. Its branch and archive preserve the trial implementation separately.

## Worktree and branch dispositions

| Original checkout / branch | Disposition |
| --- | --- |
| Original folder / `trial-foundation-m1` (`c76605d`) | Preserve trial history; use the original folder for consolidated local `main`. No trial frontend promotion. |
| Research / `research/half-l2l-reach-20260809` (`cdc9d5a`) | Recover source, tests, selected reports, workflow fixes and GBP drafts. Preserve complete original working files in the recovery archive. |
| Accuracy audit / `audit/backtester-accuracy-20260808` (`9fd0abf`) | History already represented in the baseline; archive and retire checkout. |
| Backtesting release / `release/backtesting-development-20260903` (`0c70f9b`) | Already in production ancestry; keep production implementation and retire checkout. |
| Production fixes / `codex/production-fixes-20260822` (`628288b`) | Recover the tablet-width fix. Later production styling remains authoritative; older issue-document edits and original styling remain in parked branch/archive. |
| Sidebar baseline (`b438104`, detached) | Covered by history; preserve screenshot/local files, retire checkout. |
| Calendar hardening / `codex/market-calendar-hardening` (`482030c`) | Park the coherent calendar/readiness/master/credential migration proposal. Do not silently apply workflow or database behavior. Preserve branch and local operational scripts. |
| Status publisher / `codex/publish-status-json` (`b438104`) | Covered by history; retire checkout. |
| Macro phase 1 / `codex/macro-engine-phase1` (`1e3424d`) | Recover isolated `macro-engine/` and `docs/macro-engine/` source, SQL contract and tests. Keep inactive; retire checkout. |
| Production sync / `codex/production-sync-20260902` (`8531373`) | Covered by production ancestry; retire checkout. |
| Two missing temporary deployment checkouts | Prune stale registrations after preserving refs. |

Branch histories are retained even when a checkout is retired. Parked work is not silently discarded or relabeled production-ready. The archive also captures worktrees' untracked screenshots and maintenance scripts.

## File dispositions

- **Integrated:** L2L research libraries/builders/tests and selected reports; Gold correctness, timestamped evaluation, audits, acquisition commands and evidence page; GBP drafts, replay and contract tests; local workflow fixes and tests; isolated macro prototype; repository visual skills.
- **Reconciled:** `index.html`, `script.js`, `styles.css` use a three-way comparison with the research base and current production. Production removals of posture badges and old top links are retained. Local research navigation is added alongside current production views. The production North Star page is retained; its only local difference was an obsolete wireframe link.
- **Sanitized:** old FRED/Finnhub URL credential literals in existing collector exports are replaced with named environment references, including embedded active-version copies. No live workflow/credential changes. Runtime binding must be reviewed before import.
- **Archived:** superseded root handoffs, VS Code startup note, dated audits, prior state/task/milestone/session/next-step files and old operating instructions under `docs/archive/pre-consolidation-20260907/`.
- **Local only:** raw acquisitions, evidence, browser profiles, diagnostics, temporary repair scripts and recovery archives. Dependency directories are reproducible from lockfiles. `.gitignore` now excludes root scratch/diagnostic output and `.local/`.
- **Preserved unchanged:** DeepSeek GBP workstream files and progress, frozen checker/research baseline artifacts, and production published data at the chosen baseline.

The archived Markdown retains original formatting and historical paths. Three intentional Markdown hard-break lines and one final blank line in archived macro reports are the only initial whitespace-check findings; active code is checked separately.

## Validation

- First full local run: 270 passed / 5 failed. Three Gold CLI tests assumed `tmp/` existed. Two refresh tests depended on changing live data shape/timestamps.
- Fixed fresh-checkout temp setup, gave the release browser test an ephemeral port, and froze the refresh test artifacts as dated fixtures. No live data was rewritten to satisfy a test.
- Focused regression run: 34 passed. Workflow/GBP contract run: 23 passed.
- Final combined local run: **275 passed / 0 failed**. Additional provider credential-reference checks: **5 passed / 0 failed**.
- Browser audit: Overview, Backtest Engine, Research Proof Map, Backtesting Development, Architecture and Gold evidence at 1440, 768 and 390 pixels: **18 combinations, no page overflow or JavaScript errors**. Screenshot review accompanies the geometry audit.
- `npm test` now discovers the local suites. The linked-warehouse `evaluation_pipeline.test.js` and `replay_smoke.test.js` suites are excluded because they can write remote research data. They were not run.
- Secret scanning, main-folder installation/validation and final retirement details are recorded in the cutover checkpoint below.

Logs and screenshots are retained in the ignored recovery directory. Passing tests establish the checked contracts, not predictive edge or live runtime health.

## Recovery

To inspect old work, extract the relevant ZIP to a separate folder. Use `manifest.json` to verify file hashes. Clone `all-refs.bundle` into a separate recovery repository to inspect prior commits/branches, or fetch a specific preserved ref from it. Do not overwrite the current main folder to inspect history. `node_modules` can be recreated with the appropriate lockfile.

Raw research files required by current scripts remain at their original relative paths under ignored `backtester/tmp/` and `tmp/` after cutover. Browser profiles and obsolete nested checkout copies belong only in the recovery archive.

## Cutover checkpoint

Completed 2026-09-07. `D:\trading-agent-dashboard-codex` is the sole registered worktree, on local `main`. Seven coherent integration commits (`30ffe5b` through `b14b63a`) preserve the recovered work; a final handoff commit records the cutover. All redundant worktrees were retired after preservation and validation. The old research directory is empty and unregistered; Windows currently holds that empty directory open through a running process, so its final directory removal must wait for the handle to close. No project files remain there. Branch histories remain available.

`npm ci --ignore-scripts` succeeded from the original folder (zero reported package vulnerabilities), and **all 280 local tests passed there**. The full tracked-file audit covered **424 files with zero credential findings**, using the repository scanner patterns and narrow allowlist. Active-code whitespace checks passed; archived Markdown keeps its original hard-break whitespace.

The copied recovery ZIPs, original Git bundle and manifest match their source hashes. **101 raw research evidence files** and **six GBP draft/progress files** were verified. **34 research data artifacts** match the original research checkout; the four changed live-data files come from the selected production baseline. Before final retirement, original research source hashes were rechecked; the changing browser debug log was retained separately.

Editor settings now preview `/index.html`. Open the main folder and `docs/BACKTESTING_REVIEW_PLAN.md` in VS Code. No live n8n workflow, warehouse, credential or production publication was changed. Local `main` is intentionally ahead of `origin/main`; do not push it as an incidental cleanup step because that may publish GitHub Pages.

Final logs: `.local/consolidation-20260907/main-tests.log`, `main-verification.json`, `full-secret-audit.json`, `visual-audit.json`, `retired-checkouts.json`, and `retired-final.json`. `consolidated.bundle` provides the post-cutover Git recovery snapshot.

## Next direction

[BACKTESTING_REVIEW_PLAN.md](BACKTESTING_REVIEW_PLAN.md) is the active plan. Start with the Gold timestamped directional contract and lineage; preserve the known collection defect as a prerequisite for calibration. GBP expansion, macro provisioning and model optimization remain parked.
