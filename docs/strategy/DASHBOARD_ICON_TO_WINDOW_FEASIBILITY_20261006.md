# Icons on the live dashboard that open the matching VS Code window (2026-10-06)

The user's question, in his words: "is there any way to get icons on the live dashboard open the
associated VSC instance on my desktop?"

Short answer. Not from the published page: a browser page is not allowed to start a program on the
computer, and the one exception - a special `vscode:` link - has already been measured in this project
going to the wrong window, and it would also put this machine's folder names on a public page. It is
straightforward in the one place that is already local and already knows every worker's folder: the
small monitor panel on the desktop, where a click on a worker row can open that worker's window. That
change has to be ordered and built by the coordinator, because it edits `tools/`, and this advisory
window can neither edit `tools/` nor publish a page.

## 1. What those icons are today (measured, not assumed)

Read-only fetch of the published dashboard on 2026-10-06:

- `index.html` is 27,121 bytes and loads `script.js?v=20261004-l2l-size-not-typed`, 850,620 bytes.
- The strip is `<section class="layer1-summary-section">` containing
  `<div id="layer1Grid" class="layer1-summary-grid">`; its heading is "Layer 1 / 24H independent
  calls" and the line under it reads "Select an asset for details - Conviction is a model score".
- Eight tiles are rendered by `renderLayer1Summary`, each a
  `<button type="button" class="layer1-summary-tile" data-agent="...">` carrying a small square icon
  glyph. The live icon map is USD `$`, EUR `EUR sign`, GOLD `Au`, SILVER `Ag`, NQ `NQ`, BTC `BTC sign`,
  WTI `Oil`, GBP `GBP sign`, with `-` as the fallback.
- What a click does today: `grid.querySelectorAll("[data-agent]")` attaches
  `setTab(el.dataset.agent)`, so a tile switches to that asset's own tab inside the page. Nothing
  leaves the page and no external program is invoked.
- The published page and its script contain no launch capability at all. Searched in the live
  `script.js`: `vscode` not found, `Code.exe` not found, `openWindow` not found. Searched in the live
  `index.html`: `vscode` not found, `icon` not found (the icon markup is built in the script).

So the icons the user is looking at are in-page tab buttons with a decorative glyph. There is no
existing link, handler or placeholder that could be pointed at VS Code.

## 2. Why the published page cannot do it

- A web page has no permission to start a desktop program. The only route out of the page is a
  custom-protocol link; the browser asks the operator and hands the URL to the operating system's
  registered handler. VS Code registers the `vscode:` scheme, so `vscode://file/<path>` would open a
  window - but that route is wrong here for three measured reasons.
- It cannot be aimed at a chosen existing window. This project has measured that twice. The mailbox
  bridge documentation states that `vscode://` task URLs are deliberately not used "because VS Code
  routes those to whichever window it chooses, which can open a task in an unrelated worker window".
  On 2026-10-04 the harness lane sent `vscode://` probe URLs and VS Code delivered them to the Live
  Trading window rather than to the window that lane had focused.
- The dashboard is public. GitHub Pages serves it to anyone; per-machine folder names would be
  readable by any visitor, and a link could only ever work on the machine whose paths it names.
- It could not be verified by the page's own guards, because the outcome would depend on the reader's
  browser, prompt and local paths rather than on the page.

## 3. Where it can work

### Route A - one click per worker row in the monitor panel (recommended)

The desktop monitor is `tools/project-monitor/ProjectMonitor.cs`, started by
`npm run monitor` -> `tools/project-monitor/start.ps1`, compiled by `tools/project-monitor/build.ps1`
with the .NET Framework C# compiler and Windows Forms. It already satisfies both halves of this job:

- It already knows every folder. It reads the canonical snapshot through
  `scripts/monitor-state.js snapshot`, whose worker objects carry `folder`. Measured today, all 18 rows
  have one: `strategy` -> `.local/worktrees/strategy`, `gold-research` ->
  `.local/worktrees/gold-research`, `gbp` -> `D:/trading-agent-dashboard-codex.worktrees/agent-gbp`,
  each `backtester-<asset>` -> its own worktree, and so on.
- It already has the launch mechanism that works on this machine. `OpenFile` runs
  `Process.Start(new ProcessStartInfo(file){UseShellExecute = true})`, the plain shell association.
  That is exactly the route that worked on 2026-10-04 when the lane windows were reopened: the
  canonical state record notes that `Code.exe --new-window <workspace>` was inert here (each attempt
  opened an empty window, four had to be closed) and that "each lane window was reopened through the
  plain shell association on its `.code-workspace`".

So the work is small and self-contained: one row action - an icon or a button on each worker row -
that shell-opens the VS Code workspace file belonging to that worker. No new dependency, no new
runtime, no change to any dashboard page, no change to the data or to any live behaviour.

### What is actually missing: the worker-to-workspace mapping

The plumbing exists; the mapping does not.

- The register `docs/orchestration/projects.json` holds one `path` per worker - the worktree - and no
  field naming a workspace file.
- Eleven workspace files exist, all under `tools/`: `strategy-node/Strategy.code-workspace`,
  `strategy-node/StrategyLive.code-workspace`, `analysis-engine-node/AnalysisEngine.code-workspace`,
  `live-trading-node/LiveTrading.code-workspace`, the seven
  `backtester-<usd|eur|gbp|silver|wti|nq|btc>-node/Backtester<Asset>.code-workspace`, and
  `backtester-harness-node/BacktesterHarness.code-workspace`.
- `gold-research` has no workspace file at all; its window is opened on its worktree folder. A Gold
  icon therefore has nothing declared to point at until the user says what it should open.
- The dashboard's eight assets are not the same list as the workers. GBP and EUR each have two lanes
  (`gbp` and `backtester-gbp`, `eur-pairs` and `backtester-eur`), and the `backtester-<asset>` windows
  are the backtesting lanes rather than the live feed. Only the user can say which of those a GBP or
  EUR icon means.
- On the monitor this problem disappears: its rows are workers, and each row would open its own
  window, so no asset-to-worker decision is needed.

### Two honest limits

- VS Code exposes no supported way for another program to raise or focus one particular existing
  window. Shell-opening a workspace file may therefore open a second window on the same folder instead
  of bringing the open one forward. The earlier evidence says the shell association at least opens the
  right workspace; whether it focuses an already open one must be observed by whoever builds this, and
  must not be promised in advance.
- The monitor is a tray application the operator starts. The click works only while it is running,
  which is already true of the panel itself, so this adds no new obligation.

### Route B - a local-only copy of the page with `vscode://file/...` links

Technically possible: a second copy of the dashboard kept on disk, never published, whose tiles are
`vscode://file/<local path>` links. It would work only on this machine, would ask the browser's
approval on every click, and would still suffer the wrong-window and no-focus limits. Offer it only if
the user specifically wants the page rather than the panel.

### Route C - the public tiles

Rejected. It cannot work from a public static page, it would disclose local folder names, and it could
not be verified by the page's own guards. See section 2.

## 4. Recommendation, bounded

One small change, owned by the coordinator, in the monitor tool only:

1. Declare the mapping, in the register or as a small table inside the monitor tool: worker id ->
   workspace file (or worktree folder where no workspace file exists). Named by the user, not guessed,
   because Gold, GBP and EUR each have a genuine ambiguity.
2. Add one row action to `tools/project-monitor/ProjectMonitor.cs` that shell-opens that path, reusing
   the existing `UseShellExecute` open. An icon is optional; a short label is enough and is easier to
   read in the panel's own row style, which today draws a state dot and an attention marker and no
   per-worker icon.
3. Verify with the lane windows already open and record, per row, whether the click opened a new
   window or focused the existing one. The build is `tools/project-monitor/build.ps1`; the monitor is
   started with `npm run monitor`.
4. Out of scope and named so: no change to any dashboard page or script, no new dependency, no change
   to the mailbox bridge, no `vscode://` URL anywhere, no change to the register's existing fields
   other than the added mapping, and no change to what the monitor reports.

Default if the user does not choose: build nothing. This is convenience only; it fixes no defect and
changes no number, so it should never displace a correctness item.

## 5. Open points for the user, with defaults

1. Where the click lives: the monitor panel (default) or a local copy of the page (only if he asks for
   the page in so many words).
2. Which window each icon means, wherever there is more than one candidate - Gold has none, GBP and
   EUR have two lanes each, and the backtesting windows are not the live feed. Default: nothing is
   built until he names them.
3. Whether to accept a possible second window when the workspace is already open. Default: accept,
   because focusing an existing window is not something VS Code exposes to another program.

## 6. Boundaries of this turn

Advisory only. Nothing in `tools/`, the dashboard pages, scripts, styles, data, workflows, schedules or
production was created or changed by this lane; no page was published; no credential was used; no
outcome or holdout was read; and the only file this lane changed is its own notes entry and this note
in `docs/strategy/`.

## 7. Provenance

Files read for this note: `tools/project-monitor/ProjectMonitor.cs`, `tools/project-monitor/build.ps1`,
`tools/project-monitor/start.ps1`, `package.json`, `scripts/monitor-state.js`,
`docs/orchestration/projects.json`, `docs/orchestration/AGENT_MESSAGES.md`,
`tools/agent-mailbox-bridge/README.md`, `docs/CURRENT_STATE.md`, `script.js`, `index.html`, the
`.code-workspace` inventory under `tools/`, this lane's own `docs/strategy/CONVERSATION_NOTES.md`, and
the canonical check snapshot for `strategy`.

Read-only commands run: `node scripts/monitor-state.js snapshot` (18 worker rows, each with a folder);
`node scripts/coordination.js check --worker strategy` (no errors, no pending item, -060 accepted and
not stale); a `git show main:script.js` comparison; the `.code-workspace` inventory (11 files); and
`tmp/live-page-probe-20261006.js`, which fetched the published `index.html` (27,121 bytes) and
`script.js` (850,620 bytes) and searched them for `const icon =`, `layer1-summary-tile`, `data-agent`,
`vscode`, `Code.exe` and `openWindow`, writing `tmp/live-page-probe-20261006.txt`. The probe only
reads; it writes nothing outside this lane's ignored `tmp/`.
