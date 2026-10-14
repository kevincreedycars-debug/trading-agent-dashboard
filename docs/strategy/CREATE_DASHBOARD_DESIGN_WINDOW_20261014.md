# Build order - a design-only window on the live dashboard, on DeepSeek

Prepared 2026-10-14 by worker `strategy` (`strategy-advisory-001`) in this checkout, at the user's instruction,
verbatim: *"Also can you build another VSC that focuses purely on design changes on the live dashboard, also setup
with deepseek."* Advice only: this lane writes nothing outside `docs/strategy/`, so it cannot create a worktree,
edit the register, publish an assignment, write in `tools/`, or push. Every file body below is ready to copy
verbatim; the coordinator (or the user by hand) is the one who creates it.

## 1. The two asks, and what is actually ready

**1.1 The research briefs.** Five briefs are published on `origin/main` under
`docs/research/usd-session/v1/assignments/`, and every one of them carries status exactly `READY_TO_SEND`
(verified this turn with a JSON read of all five files):

- `USD-SESSION-A1.price-and-risk.json` - slot `field-model-1`, seven price and risk cards.
- `USD-SESSION-A2.rates-releases-calendar.json` - second field slot, rates, releases and the calendar.
- `USD-SESSION-A3.reviewer-a-mechanisms.json` - reviewer slot A, mechanisms.
- `USD-SESSION-A4.reviewer-b-methodology.json` - reviewer slot B, methodology.
- `USD-SESSION-A5.synthesis.json` - the synthesis slot.

Nothing has been sent to any model: the assignment JSON carries no `model` field and A1 says of its slot only
"One frontier model fills the cards". The corrected target is in place (2026-10-14, `CHECKPOINT_3.md`: 05:00
`Europe/London` to 05:00 `Europe/London` on the next local date, one 24-hour session, Monday-to-Friday starts only).

**1.2 The name "Astra".** It appears nowhere in the coordinator's published tree - `git grep -in astra origin/main`
returns no match - and nowhere in the register or the mailbox. The only occurrence in any checkout this lane can
read is inside this worktree's older gold-research handoff, where the reviewing agent is labelled "Codex (Astra)".
So this needs one word from the user: if "Astra" means the USD session briefs above, they are ready to send; if it
means a different research agent, then no brief anywhere is addressed to it and the coordinator has nothing filed
under that name.

**1.3 What the coordinator can act on today.** `node scripts/coordination.js check` this turn: 18 workers, 12
mailbox connections, `errors: []`, 2 submissions pending project-wide. Both pending items are this lane's, both at
`pending_review` with no reply file: `20261008-strategy-layer2-provenance-correction-and-refreshes-065` and
`2026-10-09-strategy-layer1-pack-and-element-instructions-066`. The controller was offline at the last monitor
snapshot (2026-10-12T21:03Z) and the coordinator's activity line last read `working` on 2026-10-13, on the USD
research programme. So the answer to "is it ready" is: the research briefs are ready and published; the coordinator
is not mid-cycle on anything that would block this build order.

## 2. Why a separate window is the right shape, and what the old decision said

The register already carries a coordinator workstream `dashboard` at status
`gold_release_published_nav_n1_next`, and its text ends "Only user-requested UI changes; preserve original
pair-grid semantics". The 2026-10-03 review record in the same file states plainly that "no dashboard worker
exists" and that a live-page edit is production work the coordinator's dashboard lane carries, gated on the user's
go-ahead. That decision was correct while the ask was research; the user has now asked for the worker itself, so the
coordinator opens a row rather than adding to the queue. Nothing in this file changes the existing workstream, its
status or its queue.

## 3. What this lane measured today, so the order rests on facts

Read-only, from the canonical checkout; nothing was fetched from the live site and nothing was written.

- `origin/main` tip `72bbaf92c421316a69a0c8ca1ba29120bfea5b8f`, committed 2026-10-14T20:40:22+01:00. The site is
  moving today, so a design lane must cut from `origin/main` at the moment it starts, not from any older worktree.
- Thirteen top-level `.html` files are served, with these blob sizes at that tip: `backtest-flow.html` 29,372;
  `dashboard-northstar.html` 15,863; `gold-backtest-outcomes.html` 30,047; `gold-backtesting.html` 303,131;
  `gold-direction-scorecard.html` 153,963; `gold-factor-wip.html` 35,259; `gold.html` 36,231; `index.html` 28,856;
  `layer1-call-flow.html` 38,862; `standing-dashboard.html` 19,818; `usd-layer1-call-flow.html` 34,345;
  `usd-layer1-logic.html` 86,940; `what-moves-gold.html` 26,496. Beside them `styles.css` 229,068,
  `script.js` 930,980 and `playwright-dashboard-smoke.js` 124,620.
- The 2026-10-03 navigation change shipped: both `index.html` and `gold.html` carry top-bar and side-rail markers at
  that tip (69 and 67 matching lines). The bar and rail are therefore the thing a design change must preserve, not
  the thing it replaces; the guard for them is `backtester/tests/site_nav_consistency.browser.test.js`, written in
  the same change's order.
- The user's own design reference is in the repository root: `Design Reference/claude dash example.txt` (94,941
  bytes, a complete cream/ink/gold/navy dashboard with a declared token palette) plus its screenshot. That is the
  named target look, and it is the one asset no design lane should have to guess about.
- The window pattern to copy is `tools/strategy-node/`: one `.code-workspace` (own worktree first, central checkout
  second, window title naming the provider, a title-bar tint) plus a `README.md` that carries the one-time message,
  the "no new key" line and the note that the monitor row appears by itself. `StrategyLive.code-workspace` is the
  precedent for a second workspace in the same folder, and there is deliberately no second README there.
- Guard and preview commands that already exist: `node scripts/test-local.js browser` (`npm run test:browser` for
  the same set), `npm run research-library`, which serves the repository locally so a page can be looked at before
  anything is published, and `npm run test:monitor` for the monitor and mailbox tests.

## 4. What to create: one worktree, five files, one register row

**4.1 The worktree and branch.** Cut from `origin/main`, never from the canonical working tree:

```
git -C D:/trading-agent-dashboard-codex fetch --no-tags origin main
git -C D:/trading-agent-dashboard-codex worktree add \
  D:/trading-agent-dashboard-codex/.local/worktrees/dashboard-design \
  -b workers/dashboard-design-20261014 origin/main
```

**4.2 The register row.** Insert this object into `workers` in `docs/orchestration/projects.json`, keeping the
file's existing key order and style. `baseline` is the `origin/main` tip the worktree was cut from; it was `72bbaf9`
when this order was written, and the writer of the row should re-read the tip rather than copy it.

```json
{
  "id": "dashboard-design",
  "mailbox_auto_connect": true,
  "path": "D:/trading-agent-dashboard-codex/.local/worktrees/dashboard-design",
  "branch": "workers/dashboard-design-20261014",
  "assignment_id": "dashboard-design-001",
  "assignment": "docs/orchestration/assignments/dashboard-design.md",
  "status": "instructions_published_awaiting_worker",
  "last_verified": "2026-10-14",
  "baseline": "<origin/main tip at creation>",
  "next": "Open the live-dashboard design lane at the user's instruction of 2026-10-14 (verbatim: build another VSC that focuses purely on design changes on the live dashboard, also setup with deepseek). Design surface only: the thirteen top-level pages, styles.css, script.js, templates and the builders that emit them, plus the browser guards their own change needs. The bar and rail contract, every measured number, banner, as-of line, label meaning, route and file name stay as they are. Publishing: the lane builds in its own worktree cut from origin/main, shows the page from the worktree first, and pushes only on the user's go-ahead with one purpose per push, the browser suite green in the same change and the served bytes named per page afterwards; one writer on the pages at a time, so the lane holds while the coordinator's dashboard workstream has an open change. No credentials; no other worker, register, assignment, mailbox, controller or monitor file.",
  "display_name": "Dashboard Design Agent"
}
```

The row deliberately carries no provider field: as with `strategy-2`, the provider is the user's selection in the
Cline task in that window (DeepSeek), not a register value.

**4.3 The assignment.** Write `docs/orchestration/assignments/dashboard-design.md` from Appendix A below; it is the
standing authority for the new worker, in the same shape as `assignments/strategy.md`.

**4.4 The workspace.** Write `tools/dashboard-design-node/DashboardDesign.code-workspace` from Appendix B. Teal is
proposed because purple is this lane's, copper is `strategy-2`'s and blue is the backtester family's; the tint is only
there to identify the window.

**4.5 The README.** Write `tools/dashboard-design-node/README.md` from Appendix C. It carries the one-time message in
Appendix D, the provider line and the "nothing else was installed" line, exactly as the strategy folder does.

**4.6 Optional, same commit.** If the coordinator keeps a per-window section in
`docs/orchestration/AGENT_MESSAGES.md`, add a `### dashboard-design` section carrying the same one-time message and
the check command; and add the lane to `docs/orchestration/README.md`'s worker list if that list is explicit. The
monitor row needs nothing: it is read from the register.

**4.7 First turn, in the new window.** The agent creates `docs/dashboard-design/README.md` and
`docs/dashboard-design/CONVERSATION_NOTES.md` in its own worktree, as this lane did, and writes nothing else until it
has read the assignment, the two orchestration docs and the live-page measurements it takes itself.

## 5. Scope: the design surface, and the hard lines

**Owns (design surface only).** The thirteen top-level pages listed in section 3; `styles.css`; `script.js` where it
renders or lays out; `templates/*` and the builders that emit templated pages; `backtester/partials/shared_nav.html`;
and the browser guard files under `backtester/tests/*.browser.test.js` and `tests/*.browser.test.js` where its own
change requires them.

**Never.** Any measured number, table cell, banner, as-of or date line, count, threshold, verdict, or the meaning of
a label; any route, file name or hash behaviour; any data artifact, dataset, collector, workflow, weight, rule, call,
schedule or export; the bar-and-rail contract itself (one of each per page, the same ordered labels, the same
targets - restyling is in scope, re-labelling and re-targeting are not); and any other worker's folder, plus the
register, assignments, mailbox, controller, monitor and credentials. No secrets, no sealed window, no holdout, no
trading credential.

**One writer at a time.** The coordinator's `dashboard` workstream and this lane must not push to the pages at the
same time. If the workstream status is anything other than settled, the lane builds and waits.

## 6. Publishing: the one real decision, with a recommended default

- **A - the lane pushes, per-change go-ahead (recommended).** It builds in its own worktree cut from `origin/main`,
  shows the user the page served from the worktree first (`npm run research-library`), and pushes only when the user
  says go in that window: one purpose per push, browser suite green in the same change, served bytes named per page
  (size and digest) after the push, rollback by one revert. This is what "design changes on the live dashboard"
  means in practice, and the go-ahead gate is what the register's own dashboard text already demands.
- **B - the lane never pushes.** Every push stays with the coordinator's dashboard lane; the design lane only
  prepares the change and proves it. This is the shape every registered worker has today (they write their own notes
  only) and it is the safe fallback if the user does not want a second publishing window.
- **C - the lane pushes freely.** Not recommended: it removes the per-change go-ahead the register's dashboard
  workstream already carries, and leaves two writers on production with no gate.

## 7. Acceptance: how the reviewer knows the window is built

1. The new row appears in the existing monitor by itself (it is read from the register), and the mailbox connection
   file appears once the user runs **Mailbox: Connect This Cline Worker** in that window.
2. From the new worktree, `node D:/trading-agent-dashboard-codex/scripts/coordination.js check --worker
   dashboard-design` returns `errors: []`.
3. The first turn of the new window produces measurements and questions only: no page, stylesheet, script, guard or
   register file is edited before the agent has read its assignment and reported the live state.
4. Before any publish: `node scripts/test-local.js browser` green in the same change; a diff whose every hunk is
   markup, style or a guard; the page shown to the user from the worktree.
5. After any publish: HTTP 200 per touched page, with size and digest named per page and the page re-read over
   HTTPS; a guard exists that fails if the fix drifts back.
6. A revert returns the page byte for byte, and the reverted commit is named.

## 8. Risks, and what each one is answered by

- **Two writers on production.** Answered by the one-writer rule in section 5 and the go-ahead gate in section 6.
- **A number changed and called design.** Answered by the diff rule in section 5 and by 7.5's guard.
- **A design change breaking an existing guard** (`site_nav_consistency`, the three gold dashboard-link guards,
  `backtest_flow_page`, the live-trading dashboard guard). Answered by running the browser suite in the same change,
  and, because the change is look-only, a failure costs a revert and nothing else.
- **Cutting from the wrong base.** The canonical checkout is not `origin/main` and its working tree drifts (it has
  been reported clean-but-old before). Answered by 4.1: always `git worktree add ... origin/main`.
- **Editing a 930,980-byte `script.js` or a 229,068-byte `styles.css` by hand.** Answered by instructing small
  hunks and by the browser suite, which is the only cheap proof that a large file still parses and runs.
- **Drift between a templated page and its template.** Answered by keeping the builder and the built page in one
  change, as the existing orders require.

## 9. Provenance

Every measurement in this file was taken read-only on 2026-10-14 from this worktree and the canonical checkout, and
none of it from the live site:

- `git -C D:/trading-agent-dashboard-codex log -1 --format='origin/main %H %cI' origin/main` -> `72bbaf9...`
  (2026-10-14T20:40:22+01:00); `git fetch --no-tags origin main` succeeded before the read.
- `git ls-tree -l origin/main` for the thirteen page blobs, `styles.css`, `script.js`,
  `playwright-dashboard-smoke.js` and their sizes.
- `git grep -c -E 'topbar|side-rail' origin/main -- gold.html index.html` -> 67 and 69 matching lines.
- `git grep -in astra origin/main` -> no match. Local check of this worktree's markdown and text files: two hits,
  both in `docs/DEEPSEEK_GOLD_RESEARCH_HANDOFF.md` and `docs/DEEPSEEK_GOLD_RESEARCH_PROGRESS.md` (the
  "Codex (Astra)" label).
- `node -e` reads of `docs/orchestration/projects.json` (18 workers, workstream `dashboard`), of the five USD
  assignment JSON files (all `READY_TO_SEND`) and of `%TEMP%/strategy-check.json` from
  `node scripts/coordination.js check`.
- `docs/research/usd-session/v1/CHECKPOINT_3.md` (7,464 bytes, 2026-10-14) for the corrected session definition.
- `docs/strategy/COORDINATOR_NAV_TIDY_HANDOVER_20261003.md` sections 9 and 10 for the guard and acceptance shape a
  page change is held to, and `tools/strategy-node/README.md` plus its two workspace files for the window pattern.

No page, stylesheet, script, template, builder, guard, register, assignment, mailbox file, controller or monitor file
was changed by this lane, and nothing was pushed, published or deployed.

## 10. Open questions for the user, each with the default if it goes unanswered

1. Does the new window publish to the live site itself, one change at a time and only after your go-ahead
   (recommended), or does every push stay with the central coordinator? **Default: it publishes, with your go-ahead
   each time.**
2. Is the whole public site in scope or only the dashboard home page to start? **Default: the whole site, starting
   with the home page and the Gold page.**
3. May it restyle the top bar and side rail while keeping every label and link exactly as they are, or leave the
   navigation alone? **Default: restyling allowed, labels and targets frozen.**
4. Should it run the browser guards and add a new one for whatever it fixes, in the same change? **Default: yes.**
5. Should it follow your shipped design reference (`Design Reference/claude dash example.txt`) as the target look, or
   keep the dashboard's current look and only tidy it? **Default: the reference is the target look, applied
   page by page with your approval on each.**

## Appendix A - the assignment file, ready to copy to `docs/orchestration/assignments/dashboard-design.md`

```markdown
# Dashboard design lane

Read the central coordinator surface first: `D:/trading-agent-dashboard-codex/docs/orchestration/README.md`, then
`docs/orchestration/projects.json`, then this file again. This assignment is the authority for this worker and it
supersedes any copied instruction from another window.

Worker `dashboard-design`; assignment `dashboard-design-001`; branch `workers/dashboard-design-20261014`; writable
checkout `D:/trading-agent-dashboard-codex/.local/worktrees/dashboard-design`. The central folder is included in your
workspace for reference only: read it by absolute path, never write to it. Write only inside your own worktree, and
inside it only to the design surface below, your own `docs/dashboard-design/` notes and ignored scratch.

## What this lane is for

You make the live dashboard look and read better. Design only: layout, spacing, type scale, colour token use,
component states, responsive behaviour, contrast and accessibility, icon choice, and the wording of headings and
short labels. Nothing else changes. You are not a research lane, not an engine lane and not a data lane.

## What you own

- The thirteen public pages served from `main`: `index.html`, `gold.html`, `gold-factor-wip.html`,
  `dashboard-northstar.html`, `standing-dashboard.html`, `backtest-flow.html`, `gold-direction-scorecard.html`,
  `gold-backtest-outcomes.html`, `gold-backtesting.html`, `what-moves-gold.html`, `layer1-call-flow.html`,
  `usd-layer1-call-flow.html`, `usd-layer1-logic.html`. The list may grow; re-read `git ls-tree origin/main` before
  each change and treat every top-level `.html` file as in scope.
- `styles.css`, and `script.js` only where it renders or lays out what you restyle.
- `templates/*` and the builders that emit templated pages: a builder and its built page change together, never
  apart.
- `backtester/partials/shared_nav.html`, and the browser guards under `backtester/tests/*.browser.test.js` and
  `tests/*.browser.test.js` where your own change requires them.

## Hard lines - these are not judgement calls

1. No measured number, table cell, banner, as-of or date line, count, percentage, threshold or verdict changes. Not
   even by one digit, and not as a side effect of a layout edit.
2. No label changes meaning, and no route, file name, anchor or hash behaviour changes.
3. The top bar and side rail keep their contract: exactly one of each on every page, the same ordered labels, the
   same targets, the same brand string. You may restyle them. You may not re-label, re-order, add or remove entries.
4. Nothing outside your worktree: no register, assignment, mailbox, controller, monitor, other worker's folder,
   dataset, collector, workflow, weight, rule, schedule or export.
5. No credentials, no secret file, no sealed window, no holdout, no prospective observation, no trading credential.
   This assignment needs none of them.
6. One writer on the pages at a time. If the coordinator's dashboard workstream has an open page change, build and
   wait.

## The design language

The user's own reference is in the repository root: `Design Reference/claude dash example.txt` and its screenshot.
Read that file end to end before your first proposal; it declares its palette, type stack and component shapes. Your
job is to bring the live dashboard toward that quality without changing what it says.

## How you work, in order

1. **Measure.** Read the page as served, over HTTPS, and record its size, its structure and what is actually live.
   A working tree drifts; the served bytes are the truth. Never restyle a page you have not read live.
2. **Report first.** Tell the user what you found and what you would change, with the specific finding behind each
   change. Change nothing before he answers.
3. **Preview before publish.** Serve the page from your own worktree so he can look at it before it is live.
4. **Publish only on his go-ahead in this window.** One purpose per push, cut from `origin/main`, browser suite
   green in the same change (`node scripts/test-local.js browser`), then name what is served - size and digest per
   page - so the result is checkable from outside rather than asserted.
5. **Guard what you fix.** Add a browser assertion that fails if the page drifts back to what you just fixed.
6. **Rollback.** Your change is look-only, so a revert costs the look and nothing else, and no address stops
   working. Say so, and name the revert commit if one is needed.
7. **Report state.** At turn and checkpoint boundaries:
   `node D:/trading-agent-dashboard-codex/scripts/monitor-state.js activity dashboard-design <state> "<one line>"`.
   File a submission with `node D:/trading-agent-dashboard-codex/scripts/coordination.js submit --file <envelope>`
   only when a recommendation is materially new and reviewable; a chat answer on its own is not a submission.
8. **Keep notes.** `docs/dashboard-design/README.md` and `docs/dashboard-design/CONVERSATION_NOTES.md` hold your
   durable record, dated, in your own worktree. Nothing is decided by writing it down.

## Access, provider and escalation

Your window runs on DeepSeek, selected by the user in this task; no new API key, credential scope or provider
configuration is created for you. If a design question cannot be settled by reading the pages and the reference, put
it to the user with two or three concrete options and a recommended default rather than choosing silently. If a
change would touch anything in the hard lines, stop and say so; the coordinator's `dashboard` workstream is the lane
that carries production changes of that kind.
```

## Appendix B - the workspace file, ready to copy to `tools/dashboard-design-node/DashboardDesign.code-workspace`

```json
{
  "folders": [
    { "name": "Dashboard design - own worktree", "path": "../../.local/worktrees/dashboard-design" },
    { "name": "Central project and dashboard - reference", "path": "../.." }
  ],
  "settings": {
    "window.title": "Dashboard Design | DeepSeek | ${activeEditorShort}${separator}${appName}",
    "git.autoRepositoryDetection": false,
    "workbench.colorCustomizations": {
      "titleBar.activeBackground": "#12333A",
      "titleBar.inactiveBackground": "#0E272C",
      "titleBar.border": "#1B4A52",
      "window.activeBorder": "#2E9E9A",
      "window.inactiveBorder": "#12333A",
      "activityBar.background": "#0F2C31",
      "activityBar.border": "#12333A",
      "activityBarBadge.background": "#2E9E9A",
      "statusBar.background": "#12333A",
      "statusBar.border": "#1B4A52",
      "statusBar.noFolderBackground": "#0F2C31",
      "focusBorder": "#2E9E9A"
    }
  }
}
```

## Appendix C - the README, ready to copy to `tools/dashboard-design-node/README.md`

```markdown
# DeepSeek dashboard design workspace

Open [DashboardDesign.code-workspace](DashboardDesign.code-workspace) in VS Code, select DeepSeek in your existing
agent extension, and start with this one-time message:

> You are the live-dashboard design agent. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/dashboard-design.md and follow it. Your writable
> checkout is D:/trading-agent-dashboard-codex/.local/worktrees/dashboard-design. Read the live pages and the central
> register first, then tell me what you would change and why, before you change anything. Publish only when I say go.
> Send recommendations through the shared mailbox and report activity to the monitor.

No new API key, provider configuration or background model runner is installed. The central folder is included for
reference; this is a cooperative write boundary, not an OS-enforced read-only mount. There is no shared chat memory;
the design agent saves relevant conversation outcomes in its own notes.

The Dashboard Design row appears in the existing monitor automatically, because the row is read from the register.
Submissions alert the user and enter the same coordinator queue as Gold and Strategy. Active sessions check files at
turn and checkpoint boundaries; file notifications alone do not wake an idle AI session. The token footer includes
DeepSeek only when supported local extension logs expose usage.

This window publishes design changes to the live site only when the user says go in this window, one purpose per
push, with the browser suite green in the same change and the served bytes named afterwards. While the coordinator's
dashboard workstream has an open page change, this window prepares and does not push. The strategy lane's own folder
documents the pattern this window copies; the two must not drift, so this is the only README for this workspace.
```

## Appendix D - the one-time message, for the user to paste into the new window

> You are the live-dashboard design agent. Read
> D:/trading-agent-dashboard-codex/docs/orchestration/assignments/dashboard-design.md and follow it. Your writable
> checkout is D:/trading-agent-dashboard-codex/.local/worktrees/dashboard-design. Read the live pages and the central
> register first, then tell me what you would change and why, before you change anything. Publish only when I say go.
> Send recommendations through the shared mailbox and report activity to the monitor.

The user's steps, in order: open the workspace file in a new VS Code window; select DeepSeek in the Cline task; paste
the message above; run **Mailbox: Connect This Cline Worker** once so the connection file is written; then read the
first report before authorising any change.
