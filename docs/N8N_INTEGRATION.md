# n8n Integration

Last updated: 2026-06-19

## Workspace

Base URL:

```text
https://silver17.app.n8n.cloud
```

Project/workflow UI URL supplied by user:

```text
https://silver17.app.n8n.cloud/projects/ISQG9XU7TGTT6Fcu/workflows
```

The project/workflow URL is useful for browser navigation, but API calls should use the base workspace URL.

## API Credential Handling

An n8n API key was supplied in chat during setup.

Do not commit the API key to GitHub.
Do not store it in repository documentation.
Do not paste it into workflow JSON exports.

Recommended long-term action:

1. Use the current key only for initial testing if needed.
2. Revoke it after connection is proven.
3. Generate a fresh API key.
4. Store it only in the secure runtime/tooling environment.

## Integration Strategy

Use n8n API first.

Reasons:

- stable production interface
- supports workflow inspection and updates
- supports workflow activation/deactivation and execution
- easier to reason about than AI browser automation

Add n8n MCP second if it improves AI-native workflow browsing.

## Intended Capabilities

The AI development environment should eventually be able to:

- list all workflows
- fetch a workflow by ID
- inspect workflow nodes
- locate a named node
- update node code/parameters
- save workflow changes
- export workflow JSON into GitHub
- execute a workflow
- inspect latest execution result
- update GitHub documentation after changes

## Safety Rules

1. Never change production workflows without recording the intent in GitHub.
2. Prefer exporting/backing up a workflow before editing it.
3. Never commit credentials.
4. Prefer targeted node edits over whole-workflow rewrites.
5. After editing, run the smallest relevant workflow first before running the full Master Orchestrator.
6. Record all changes in `docs/CHANGELOG.md` and `docs/SESSION_NOTES.md`.

## Live Refresh Triggering

Verified against the live workspace on 2026-09-30:

- The production workflow `Master Orchestrator` (`X75RKU34ikiM5RMU`) is active and carries exactly two triggers:
  `Manual Start - Run All Agents` (manual) and `Dashboard Trigger - Run All Agents`
  (`POST master-orchestrator-dashboard-refresh`, `responseMode: onReceived`).
- No active workflow in the workspace has a schedule trigger, so nothing regenerates the layers on a clock. The
  published `data/layer1.json` says the same thing: `dashboard_meta.refresh_schedule` is `07:00`,
  `refresh_schedule_status` is `PROVISIONAL`, and `validity_schedule_note` reads
  "No authoritative orchestrator cron exists in the repository".
- Layer 1 and Layer 2 therefore only change when the dashboard `Run Refresh` button, an n8n manual run, or a direct
  POST to the webhook starts the orchestrator. Every recent recorded run is `mode: webhook`.
- An untouched day leaves the previous calls in place until they expire. On 2026-09-29 the USD 24h call carried
  `expires_at: 2026-09-30T08:04:36.805Z`, so the dashboard showed expired calls from 08:04Z on 30 September.

Read-only inspection (through the local credential runner; secrets are never printed):

```powershell
& "$env:USERPROFILE\.trading-agent-dashboard\scripts\run-with-credentials.ps1" -Scope n8n -Command node -Arguments "scripts\inspect_recent_n8n_executions.js"
& "$env:USERPROFILE\.trading-agent-dashboard\scripts\run-with-credentials.ps1" -Scope n8n -Command node -Arguments "scripts\inspect_latest_n8n_error.js"
```

Triggering a refresh outside the browser (the same POST the button makes; the webhook answers
`{"message":"Workflow was started"}`):

```powershell
Invoke-WebRequest -Uri "https://silver17.app.n8n.cloud/webhook/master-orchestrator-dashboard-refresh" -Method POST -ContentType "application/json" -Body '{"source":"manual","requested_at":"<iso-timestamp>"}'
```

Worked timing example (30 September 2026): orchestrator `4352` started 10:08:41Z, finished 10:13:18Z, and the
published `data/layer1.json` `last_updated_et` moved to `2026-09-30T10:13:13.937Z` with all 8 agents. A full
refresh plus publication is roughly five minutes; GitHub Pages then serves the new files.

Dashboard button notes:

- `data/workflow-control.json` on the served branch must keep `enabled: true` and the webhook URL. Without a
  webhook URL the button reads "Add the n8n webhook URL to data/workflow-control.json" and stays disabled.
- The button is also disabled while a non-terminal refresh request is stored in the browser profile under the
  `dashboard-workflow-refresh-state` localStorage key ("A refresh request is already being tracked in this browser
  profile"). That lock is browser-local, so it blocks only that profile. Opening the published site in a clean
  profile leaves the button enabled and raises no page errors.

## Current n8n Priorities

1. Export all active workflows into `exports/`.
2. Create human-readable workflow documents in `workflows/`.
3. Fix EUR Layer 1 parser.
4. Fix Eco Events duplicate insert handling.
5. Add Master Orchestrator execution summary.
