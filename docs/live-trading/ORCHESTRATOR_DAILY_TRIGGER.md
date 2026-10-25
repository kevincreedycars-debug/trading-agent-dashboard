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

