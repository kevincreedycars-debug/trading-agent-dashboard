# The daily orchestrator trigger, 2026-10-24

## What was missing

The eight Layer 1 agents have no schedule of their own: each holds an `executeWorkflowTrigger` and is called by the
Master Orchestrator. The orchestrator was reachable only two ways - the dashboard's Refresh button and a person
pressing Execute in n8n - so "07:00 ET" existed in `dashboard_meta.execution_clock` and in the docs, and in no
caller. [VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md) recorded that as open item 1: *who or
what POSTs the orchestrator webhook*.

## What now calls it

`.github/workflows/master-orchestrator-daily.yml`, on `main`. It calls
`data/workflow-control.json`'s `webhook_url` - the same POST the dashboard's Refresh button makes - so the trigger
obeys the same switch the page obeys: if `enabled` is false there, the job rings the webhook zero times and fails
loudly instead.

Why a GitHub workflow rather than an n8n Schedule Trigger: GitHub's cron is the only scheduler this repository can
change, review and audit from the repository itself, and the run list is the log. An n8n schedule would be invisible
here until someone re-exported the flow.

**How the clock works.** GitHub cron is UTC and cannot follow a New York clock, so the workflow wakes hourly at :07
UTC and decides in `America/New_York` whether this slot is the day's run:

| local hour (America/New_York) | what the job does |
| --- | --- |
| before 07:00 | skip, "it is before 07:00 New York" |
| 07:00-10:59, nothing run today | call the webhook, then confirm the run from `data/workflow-status.json` |
| 07:00-10:59, a run today already succeeded | skip, so a delayed slot cannot double up |
| 07:00-10:59, a run today still in flight | skip, so a second call cannot overlap the orchestrator |
| 11:00 or later | skip, so an outage at 07:00 does not fire a run at ten at night |
| a person dispatches with `force` | run when the day is otherwise free: force bends the clock, never the duplicate or overlap guards |
| a person dispatches with `dry_run` (the default) | print the decision and stop; a dry run never counts as the day's run |

The four slots at 07:07, 08:07, 09:07 and 10:07 exist because GitHub often starts scheduled runs several minutes
late; a 07:00 slot that starts at 07:14 still runs. Daylight saving needs no maintenance: the hour is read on a New
York clock, so the same cron gives 07:00 ET in both halves of the year.

A dry run and a live run are the same workflow, so the run list cannot tell them apart by conclusion. Each run names
itself instead — `orchestrator daily dry` or `orchestrator daily live` — and only the live ones count towards the
day. Without that, one hand-run dry run would have used up the day and the next morning's slot would have reported
"already ran" and done nothing.

**What the job writes.** Nothing. It is `contents: read` and never checks out the repository. The record of the
invocation is the Actions run itself: the step summary carries the local time, the decision and why, the webhook's
HTTP status, and the run's own `last_run_started_at`/`last_run_finished_at`/`status`/`failed_step` read back from
the committed `data/workflow-status.json`. A run that reports `failed`, or a call whose status file never moves
inside fifteen minutes, fails the job, so a silent orchestrator shows up as a red run rather than as a page nobody
looks at.

**How to check it by hand.** `gh run list --workflow master-orchestrator-daily.yml --limit 5`. To see the decision
without calling anything: `gh workflow run master-orchestrator-daily.yml -f dry_run=true` - the dispatch defaults to
`dry_run: true`, so the one way a person can start it by hand cannot start an orchestrator run by accident. Passing
`-f dry_run=false -f force=true` calls the webhook outside the window, which is the same act as pressing Refresh.

`tests/master_orchestrator_schedule.test.js` holds the invariants: hourly cron with a New York clock, the
07:00-10:00 gate, the concurrency group, one POST in the whole file, the once-a-day and in-flight guards, read-only
permissions, no checkout, and the dispatch defaults.

## The first real dispatch, and what a green run proves

On `origin/main` the workflow is live and has been dispatched twice — once dry, once live. The live one is
**run 40203054555**, title `orchestrator daily live`, event `workflow_dispatch`, started 2026-10-25T14:36:48Z,
conclusion **success** (`gh run view 40203054555 --json conclusion,status,displayTitle,createdAt,event`).

That conclusion is stronger than "the POST was accepted": the job exits 1 if the webhook fails, if
`data/workflow-status.json` on `main` still carries the previous `last_run_started_at` after fifteen minutes, or if
the run reports any `status` other than `success`. A green run therefore means the orchestrator ran and wrote its
own record. The step summary of that run carries `decision`, the webhook HTTP code, and the run's
`status`/`failed_step` for the same reason.

## The first scheduled tick, 2026-10-25, and what it did not prove

The cron fired on its own for the first time: **run 40220928984**, event `schedule`, started
2026-10-25T18:22:23Z (14:22 New York), conclusion success, with `runs_today_succeeded=1` and
`decision=skip (today already has a successful run of this job, so a second call would be a duplicate)` in the step
summary - `nothing was called`.

That is the guard working, not the schedule failing: the day's live run was the hand-dispatched 40203054555 at
14:36:48Z, and the 18:22Z slot is past the 10:07 New York cut-off in any case, so the duplicate guard answered first.

Two consequences. The first **automatic** live run is the 07:07 `America/New_York` slot on 2026-10-26 (11:07Z), and it
is the one to watch: a red run there says the schedule is wrong, a green one with `decision=trigger` is the first
evidence that the clock, and not a person, starts the orchestrator. Until then "the cloud schedule runs it daily" is
still a claim about a guard that fired, not about a scheduled run that called the webhook.

## The clock reconciled: 11:07Z is 07:07 New York, not a polling time

The reported next run, 2026-10-26 11:07Z, is the day's first trigger **attempt**, not a check that waits for something
else to start the orchestrator. The scheduler is `.github/workflows/master-orchestrator-daily.yml` on `main`:

- `on.schedule.cron: "7 * * * *"` - one wake every hour at :07 **UTC**, and the first step decides.
- `env.TZ: America/New_York` - the decision reads `date` on a New York clock, not the UTC slot number.
- The window is 07:00-10:59 New York, four slots a day (`07:07`, `08:07`, `09:07`, `10:07`), the first one at or after
  07:00 that finds the day free calls `data/workflow-control.json`'s webhook; a later slot that finds the day already
  succeeded, or still in flight, or past 11:00 New York, skips and says why.

**Why seven minutes.** The cron minute is 7, not 0, and the hour cannot be fixed either. GitHub's cron is UTC-only:
07:00 New York is 11:00Z while New York is on EDT and 12:00Z once it is on EST, so a single fixed UTC cron cannot
hold "07:00 New York" across the year. The workflow therefore wakes **every** hour and asks the local clock whether
this slot is the day's run - that design is the DST handling, and the minute-7 offset is its cost: it also keeps off
the top of the hour, when GitHub's scheduler is most congested, and it leaves four attempts inside the window so a
slot that starts late still runs the day.

**DST, concretely.** Today (2026-10-25) New York is on EDT (UTC-4) until 2026-11-01 02:00 local, so 11:07Z is 07:07
EDT. On 2026-11-01 the same 11:07Z slot becomes 06:07 EST - before 07:00, so the job skips it as "it is before 07:00
New York" - and the 12:07Z slot is 07:07 EST and runs. The daily start moves from 11:07Z to 12:07Z by itself, with no
code or cron change.

**The honest statement of the agreed time.** The agreed time was 07:00 America/New_York; what runs is 07:07. That is
the earliest slot the hourly-slot design can produce. If exactly 07:00 matters, it is a workflow change (`0 11,12 *
* * *` with the same local-clock guard, and the window text and `tests/master_orchestrator_schedule.test.js` move with
it) - not a documentation change, and not done here.

## 2026-10-25: today's green run, and the record tomorrow needs

Two different things happened today and only one of them is evidence about the schedule.

- **The schedule fired and skipped.** Run 40220928984, event `schedule`, started 2026-10-25T18:22:23Z, conclusion
  success, `decision=skip` with `runs_today_succeeded=1` and `nothing was called`. That proves the cron exists and
  that the duplicate guard answers. It proves nothing about an automatic end-to-end run.
- **The day's actual run was a person's.** Run 40203054555, `workflow_dispatch`, title `orchestrator daily live`,
  started 2026-10-25T14:36:48Z. Its webhook run wrote `data/workflow-status.json`: `status: success`,
  `failed_step: null`, `last_run_started_at`/`last_run_finished_at` = 2026-10-25T14:42:32.225Z, and all fifteen steps
  success - the economic-events collector, the six pair collectors, the seven Layer 1 agents, Layer 2, and the
  Dashboard Writer. `data/layer1.json` was committed by that run (`328d7fc9`, 14:42:30Z) with
  `generated_at 2026-10-25T14:42:28.917Z`, and that is the calls file the trader read on its next tick.

**What today's success therefore means, precisely:** every step the flow declares completed and reported success, the
run wrote its own record, and the calls artifact was published today. It does **not** mean the schedule ran it (a
person did), and it does not mean every artifact was independently re-validated - the job checks `status` and
`failed_step`, not the contents of each output. `triggered_by` still reads `dashboard_or_manual` because the n8n status
node hardcodes that label, so the webhook body cannot be told from a Refresh press. The L2L ladder
(`data/l2l-levels.json`, `generated_at 2026-10-04T16:14:19Z`) is not regenerated by this flow at all, so a green run
carries no claim about it.

**Tomorrow's record, to be filled in separately from today's green.** For the 2026-10-26 11:07Z slot, record as its
own evidence: `decision` (`trigger` / `skip` + reason), the webhook HTTP code, `data/workflow-status.json`'s
`status`/`failed_step`/`last_run_finished_at`, and the `generated_at_utc` of the artifacts it published. A skip is a
skip; only `decision=trigger` plus a changed status file is proof that the clock, not a person, starts the orchestrator.

## What this does not fix

- The n8n flow's own status writer stamps `triggered_by: "dashboard_or_manual"` in a Code node. A scheduled call is
  therefore labelled as if a person had pressed Refresh. The Actions log is the authoritative record until that node
  reads the webhook body; it is a two-line change in n8n and belongs to whoever next re-exports the flow.
- The webhook URL is public and unauthenticated, as it was before this. Anything on the internet can POST it and
  start a run; the dashboard's `no-cors` POST means the same. The once-a-day guard lives in the caller, not at the
  webhook.
- 07:00 is a decision time for the Layer 1 agents, and the run is daily including weekends. The intended design in
  the older notes says weekdays; if that is wanted, gate on `date +%u` in the same step - one line, and the doc and
  test that name the window should move with it.
- A schedule firing is not evidence of a decision: the weekend and holiday caveat in the deployment status doc still
  applies, and nothing here says the agents' calls are good.

## Related

- `data/workflow-control.json` - the switch and the webhook the page and this job share.
- `data/workflow-status.json` - what the flow writes when it finishes; the job's evidence.
- `exports/master_orchestrator.json` - the exported definition, including the webhook node and the status node.

## The daily schedule, stated as an attempt rather than a time

The schedule is an **attempt**, and the doc says so because the difference matters when the record is read back:

| what | when (America/New_York) | what it is |
| --- | --- | --- |
| first intended attempt | 07:07 | the first slot at or after 07:00 that finds the day free calls the webhook |
| later attempts | 08:07, 09:07, 10:07 | retries, used only when the earlier slot skipped or was not started |
| cutoff | 11:00 | a slot at or after 11:00 skips, so an outage at 07:00 cannot fire a run in the evening |

GitHub's cron wakes every hour at :07 UTC and the job decides on a New York clock, so these are *scheduled
attempts*: GitHub can start a slot minutes late, drop one under load, or skip a day entirely. Nothing in this
repository can promise 07:07 happened; the run list is what says whether it did.

**Automatic daily execution is not verified.** Until an actual `schedule` run reaches `decision=trigger`,
calls the webhook, writes `data/workflow-status.json` and publishes valid artifacts, the honest statement is:
the cron exists and its guard answers. Two separate records must be kept apart in any handoff - a manual
`workflow_dispatch` success (today's 40203054555) and a scheduled skip (40220928984) are neither of them proof
of an automatic trading day.
## 2026-11-03: the 06:00 UTC slot, fired from the host

The dashboard's own **Run Refresh** button and the daily slot call the same thing -
`https://silver17.app.n8n.cloud/webhook/master-orchestrator-dashboard-refresh`, the webhook in
`data/workflow-control.json` - so the daily slot is one POST and nothing more. Since 2026-11-03 the host runs it:

- Task `LiveTradingRefresh0600` on `158.220.87.240`, daily at **06:00** in the host's clock, which is UTC.
  It runs `C:\live-trading\logs\trigger-refresh-0600.ps1`, which POSTs the webhook, appends one line to
  `C:\live-trading\logs\refresh-0600.log`, and exits 0 or 1 so the scheduler records the outcome.
- Tested by running the task itself at 13:13:41Z on 2026-11-03: `posted status=200`. Next run `2026-11-04 06:00:00`.
- It holds no token and no key, because the webhook the public page already calls is the one it calls.

This is a host task, not an n8n **Schedule Trigger** node. The n8n-native version is the better end state - it fires
whether or not the host is up - and it needs either an API key (which would live in a gitignored file beside
`config/live-trading-lanes.local.json`, never in a commit) or one edit in the n8n UI: add **Schedule Trigger**
(Trigger Interval: Days, Hour 6, Minute 0, Timezone GMT) wired to the existing webhook path node's successor, then
remove `LiveTradingRefresh0600` so the refresh is not fired twice.

A separate GitHub Actions cron over the same webhook still exists (the table above). Two schedulers and one webhook
means two runs on a day both fire; that was already true before today and is worth settling in favour of one of
them.


## 2026-11-04: the 06:00 slot fired, the run failed at the USD Collector, and the GitHub guard had been spending the day

**The morning looked like a scheduler that never fired and was two separate faults.** What actually happened, in
order, from `data/workflow-status.json`, `data/layer1.json` and the run list:

| UTC | What | Evidence |
| --- | --- | --- |
| 06:00 | the host task `LiveTradingRefresh0600` POSTs the webhook, as it has since 2026-11-03 | `logs\refresh-0600.log` on the host; the run below is 6 minutes later |
| 06:06:37 | the run finishes **failed** at step `USD Collector`: *"Bad gateway - the service failed to handle your request"* | status commit `ea27ad7c`; the other 14 steps, `Dashboard Writer` included, report `success` |
| 06:06:35 | `layer1.json` is republished anyway, carrying the previous day's USD direction | commit `6a3d8d9c` |
| 07:44:16 | a person presses Refresh; the run succeeds and republishes | status commit `4cdf333b`, `layer1.json` commit `50b2608e` |

Two things were read wrong before this page was written, and both are worth keeping:

- **`triggered_by` in the status file is a constant.** It is the string `dashboard_or_manual`, typed into the flow's
  own `Build Workflow Status JSON` Code node, so a host-triggered run records exactly what a hand press records.
  "manual" there is not evidence that a person pressed anything. The 06:06 run was the host's.
- **A scheduled slot that skips concludes green under the live title.** Every slot since 2026-10-25 shows
  *Call the webhook* = `skipped` (runs 40203054555 .. 41753003767, 2026-11-04's only delivery at 01:17Z), and the
  duplicate guard counted those green runs as "today already ran" — the first slot of each New York day is a slot
  before 07:00, so it spent the day and the real 07:00-10:00 slot was turned away. The GitHub schedule has never
  produced a run; every daily run in the table above came from the host task or a hand press.

### What changed

1. **`.github/workflows/master-orchestrator-daily.yml`** no longer reads run titles. The day's record is
   `data/workflow-status.json` on `main`: a run today counts only when that file says `success`, so a skipped slot
   spends nothing and a *failed* run leaves the day free for a later slot to retry. The run list is still asked one
   question — is a run of this workflow still in flight — because the status file is only written at the end.
   A status file that cannot be read is a skip, not a call.
2. **`scripts/trigger-orchestrator-refresh.ps1`** is the daily slot as a versioned script: read
   `data/workflow-control.json` (and refuse, loudly, when `enabled` is false), POST the webhook, wait for
   `last_run_started_at` to move, read `status` and `failed_step`, and call again up to `-MaxAttempts` (default 3,
   two minutes apart). It writes one JSON line per attempt to its log and exits 0 only on a successful run, so the
   task's `LastTaskResult` answers "did today's Layer 1 run happen". It holds no token or key: the webhook is public
   and the status file is read from `raw.githubusercontent.com`. `-WhatIf` posts nothing.
3. **`scripts/register-orchestrator-refresh-task.ps1`** puts it on the clock as `LiveTradingRefresh0600`, daily at
   06:00 in the host's clock (UTC on that host), as SYSTEM with `StartWhenAvailable` and `IgnoreNew`.
4. **Tests**: `npm run test:orchestrator-schedule` runs `tests/master_orchestrator_schedule.test.js` (the guard is
   the status file, no guard reads a title) and `tests/orchestrator_refresh_trigger.test.js` (five cases against a
   local listener: failure-then-success, exhausted attempts exit 1, a 502 to the POST is retried, `-WhatIf` spends
   nothing, an off switch is refused).

### What is not proved, and what is left

- **The host ran the old slot until 2026-11-05.** `LiveTradingRefresh0600` pointed at
  `C:\live-trading\logs\trigger-refresh-0600.ps1`, which is not in this repository and does no read-back.
  Section 12 below is the day it was replaced; the short version is that the registration script could not register
  anything, so "not registered yet" was not a missing step but a broken command that reported success.
- **The 502 is not fixed here.** It came from inside n8n, at the `USD Collector` step, whose `executeWorkflow` node
  in `exports/master_orchestrator.json` carries no `retryOnFail`. The durable fix is `Retry On Fail` (2 tries, a few
  seconds apart) on that node in the n8n UI — the export in this repository is a snapshot, not a deployment. The
  retry added here is a whole-chain retry from outside, which is coarser but does not depend on the flow being
  edited.
- **GitHub's cron is not the morning's net.** It delivered three or four of the twenty-four hourly slots per day in
  this record (2026-11-03: 06:39Z, 15:02Z, 20:56Z; 2026-11-04: 01:17Z). With the guard fixed it can retry a failed
  morning inside 07:00-10:00 New York, which is worth having, but the host's 06:00 slot remains the one that is
  expected to fire.
- **No automatic retry has been observed yet.** The honest statement until a `schedule` run reaches
  `decision=trigger` and calls the webhook, or the host's new task logs `"action":"retry"` followed by
  `"action":"success"`, is: the guard now reads the right file and the slot script retries against a local listener.


## 12. 2026-11-05: the slot is on the clock, and the command that put it there had been a no-op

**What the host actually held.** `LiveTradingRefresh0600` still ran `C:\live-trading\logs\trigger-refresh-0600.ps1`
- the nineteen-line POST with no read-back that section 204 is about - as `Administrator` / `Interactive`, and its log
carried three lines of `posted status=200`, one per morning, including 2026-11-04's run that failed at `USD Collector`.
Nothing in that log could have said so.

**Why the replacement never landed, and it is not the missing key.** `scripts/register-orchestrator-refresh-task.ps1`
opened `if ($Test) {` and never closed it. Every statement after the dry-run branch - `$arguments`, the action, the
SYSTEM principal, the trigger, the settings, the `Register-ScheduledTask` call and the read-back that prints
`task_state` - sat inside that branch, whose first statement is `return`. So `-Test` worked, `-Show` printed nothing,
and a plain run printed nothing, exited 0 and registered nothing. The command looked like it succeeded because it did
succeed at doing nothing. This is why the host's carry-over said "the new task has not been registered there": the
registration had been attempted with a tool that cannot register.

The PowerShell AST was what showed it - `if ($Test)` spanning lines 62-130, the registration call at 111 - and the
missing brace is now closed (guard 62-68, call at 111 outside it). `tests/orchestrator_refresh_register.test.js` keeps
the three modes apart so a re-edit cannot swallow them again:

- the statement tree: the `$Test` guard ends before `Register-ScheduledTask`, and that call is not a descendant of the
  guard (this is the exact shape of the bug, asserted rather than read);
- `-Show` prints the definition - task name, trigger path, SYSTEM principal, `daily at 06:00`, `StartWhenAvailable,
  IgnoreNew` - and leaves the scheduler alone;
- `-Test` runs the slot's own `-WhatIf` pass against a live local listener and posts nothing.

`npm run test:orchestrator-schedule` now runs these three with `master_orchestrator_schedule` and the slot's five
cases, 9 of 9. The fix is on `main` as `0dd3d958`.

**What the host holds now.** Registered from the host itself on 2026-11-05T09:56:23Z, with `-NoStart` because the
script's default `Start-ScheduledTask` would have spent a real orchestrator run when the day already had a green one at
06:06:54Z:

| Field | Value |
| --- | --- |
| action | `powershell.exe -File "C:\live-trading\runtime\scripts\trigger-orchestrator-refresh.ps1" -ControlPath "C:\live-trading\runtime\data\workflow-control.json" -Log "C:\live-trading\logs\refresh-0600.log" -MaxAttempts 3 -RetryDelaySeconds 120 -TimeoutSeconds 900` |
| principal | `SYSTEM` / `ServiceAccount` / `Highest` |
| trigger | daily at `06:00` host clock (UTC), `StartWhenAvailable`, `IgnoreNew`, 61-minute limit |
| next | `2026-11-06T06:00:00Z` |
| last result | `267011` (`0x41303`, has not run yet) |

The two files were taken from `main` by the object store (`git checkout origin/main -- <path>`), so the host's copies
are byte-identical to the committed ones, and `C:\live-trading\runtime\data\workflow-control.json` already matched
`main` (`enabled = true`, the n8n webhook named).

**The SYSTEM context was proved without spending a run.** A temporary task with the same principal ran the slot with
`-WhatIf` and redirected its output to `C:\live-trading\logs\refresh-system-probe.log`; it read the control file,
printed `enabled=True` and the webhook, and the temporary task was then removed. That is the one thing `-Test` under
`Administrator` could not answer.

**What is left.** The first real run under the new task is 2026-11-06 06:00Z - until it happens, the task's
`LastTaskResult` is the only claim, and `0x0` plus a `"action":"success"` line in `refresh-0600.log` is what ends the
question. `Retry On Fail` on the orchestrator's `USD Collector` node is still unset in n8n (section 247's second
bullet). The old script stays at `C:\live-trading\logs\trigger-refresh-0600.ps1` as history and is referenced by
nothing.


