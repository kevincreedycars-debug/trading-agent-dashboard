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
