# Why `live-trading-monitor` went red 35 times in a row

**Status 2026-11-02, midday. The monitor was right every time and there was no monitor defect: publication had
stopped at the host.** The last scheduled green run was 2026-10-26T05:03:41Z. From 2026-10-26T11:02:17Z to
2026-11-02T09:49:42Z the workflow failed 35 consecutive times (runs 40312018215 .. 41423813695), and it went
green again on the 2026-11-02T11:53:54Z publish without anyone touching it. This page is the evidence for that
sentence, the one change it justified, and the two things it does not fix.

## 1. What the red runs said, and what was true

| The run said | What the published artifacts showed |
| --- | --- |
| the snapshot is NNNNs old, past the 900s window it declares | true: not one of the 35 samples landed inside a window that was actually fresh |
| the lanes document loaded and named lane `ftmo-1` | true: it never moved either - it is rewritten in the same commit as the snapshot |
| nothing about identity | `account.login_masked` was `***614` / `FTMO-Server` at every sample, which is what the lanes file names |
| nothing about the host | the trader heartbeat named `DESKTOP-UD0L47I`, the same host the lanes file describes |

`node scripts/check-live-trading-publication.js` re-run by hand during the outage reproduced the red, and the age
it reported matched the age computed from `main`'s own commit stamps to within 9 seconds. The monitor was not
reading a stale CDN copy, a different host or a different account.

## 2. The publication timeline (`data/live-trading.json` on `main`)

| Gap | From | To | What it was |
| --- | --- | --- | --- |
| 4,800s | 2026-10-25T22:23:52Z | 2026-10-25T23:43:52Z | 80 minutes, the first sign |
| 98,401s | 2026-10-26T10:13:53Z | 2026-10-27T13:33:54Z | **27.3 hours, the first stall** |
| 20 publishes | 2026-10-27T13:33:54Z | 2026-10-27T16:23:53Z | a partial recovery, 2.8 hours |
| 502,201s | 2026-10-27T16:23:53Z | 2026-11-02T11:53:54Z | **5.8 days, the second stall** |
| 1,128s | 2026-11-02T12:05:05Z | 2026-11-02T12:23:53Z | a skipped tick, section 5 |

Those gaps are commits that never happened, not deployments that failed: git history contains no publish in the
window, and the page kept serving the last one.

## 3. Why this is not a monitor fault

- **Not a stale cache.** `data/live-trading.json`, `data/live-trading-lanes.json` and
  `data/live-trading-trader.ftmo-1.json` as served by the page are byte-identical to `origin/main` (sha256
  compared), so the monitor was reading the same bytes a person would.
- **Not a host mismatch.** The lanes file, the snapshot and the heartbeat all name `***614` / `FTMO-Server`, and
  the heartbeat names `DESKTOP-UD0L47I`, the PC that runs the tasks - the host
  [VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md) says is still doing the publishing.
- **Not the threshold.** The checker compares the snapshot's age against `stale_after_seconds` read from the
  snapshot itself, so the page's own badge and the monitor use one number. During the outage it was exceeded by
  hours.
- **Not the workflow.** A `workflow_dispatch` of the same commit went green the moment publication resumed (run
  41445652242, verdict `ok`).

The honest summary is that the monitor did the job it exists for: it is the only thing in the system that looks at
the published result rather than at the host's belief about itself, so it was the only thing that could say the PC
had stopped publishing while the PC was off.

## 4. The one change this justified

`2300a67c` (PR #2, merged 2026-11-02T12:45:02Z) makes a stale snapshot say which of its two causes it is. The
lanes document is rewritten in the same commit as the snapshot, so its own age answers the question: as old as the
window means publication has stopped, younger means a publish did happen and the snapshot it carries is the part
that is late. `lanes_document.age_seconds` is now in the JSON, and the note is added only to a lane that failed on
freshness.

Nothing was weakened to do it: exit codes, thresholds, the verdict and every existing problem and note are
unchanged, a late snapshot is still exit 1, and the suites cover the new sentence in both directions
(`live_trading_publication_monitor.test.js` and `live_trading_monitor_workflow.test.js` 11/11,
`npm run test:unit` 648 pass / 0 fail). The post-merge dispatched run 41447249852 read
`lanes_document.age_seconds: 97` against a snapshot age of 308s and stayed `ok`, which is the new sentence
appearing on a healthy cycle.

The workflow header also records the cadence GitHub actually keeps: 39 runs in the 7.5 days to 2026-11-02, about
five a day, so a green run is not fifteen-minute coverage.

## 5. Two things this does not fix, both needing a decision outside monitoring

1. **The publisher is a desktop PC.** Publishing stops when the machine is off, asleep or restarted, and the
   always-on host in [VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md) was never bought or
   deployed. Both stalls above are that fact, and no monitor change can make a powered-off host publish.
2. **The publish cadence has less slack than it looks.** The live task repeats every 600s and the wrapper it runs
   passes `--min-interval-seconds 540`, and a publish carries a snapshot that is already ~211s old at push time
   (2026-11-02T12:40:20Z snapshot, 211s age, 3.85s to push). A publish that takes more than ~55s therefore makes
   the next tick refuse, and the served copy genuinely crosses its own 900s window:
   2026-11-02T12:05:05Z -> 12:23:53Z reached 1,128s, about 19 minutes of a page whose own badge says stale. That is
   a live-publishing change (`register-live-trading-lanes-publish-task.ps1`, `--MinIntervalSeconds`), not a monitor
   change, and it is deliberately not made here.

## 6. How to read a red run now

- `publication has stopped rather than fallen behind` - nothing is publishing. Look at the host: is the PC on, do
  `LiveTradingFeedTick019` / `LiveTradingPublishLanes019` exist and run, does
  `.local/worktrees/live-trading/tmp/live-trading-lanes-publish.log` end inside the last ten minutes.
- `a publish did happen; the snapshot it carries is the part that is late` - the publish task is alive and the
  snapshot is not advancing. Look at the MT5 terminal and the feed tick, not at git.
- `exit code 2` - the lanes document itself could not be read. That is Pages or the commit, not a lane.

The scripts that produced the tables above stayed local in `tmp/live-monitor` (ignored), because they read git
history and the Actions API rather than anything the repository needs to keep.
