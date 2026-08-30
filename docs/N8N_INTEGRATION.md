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

### Workflow Export Credentials

Workflow exports must not contain provider secrets. The current collector exports
expect the following n8n environment variables or their equivalent managed
credential values:

- `RAPIDAPI_KEY` for economic-calendar requests.
- `FINNHUB_API_KEY` for Finnhub collector requests.

Before importing the updated exports, configure those values in the n8n runtime
and rotate any provider key that was previously stored in a repository export.
The repository test `tests/workflow_export_credentials.test.js` prevents those
literals from being reintroduced.

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

## Current n8n Priorities

1. Export all active workflows into `exports/`.
2. Configure managed provider credentials before importing updated collectors.
3. Publish `data/input-health.json` from the same cycle as Layer 1 and Layer 2
   artifacts, including an explicit failed/degraded economic-event source state.
4. Block new actionable calls whenever required input health is not healthy.
5. Create human-readable workflow documents in `workflows/`.
6. Fix EUR Layer 1 parser.
7. Add a Master Orchestrator execution summary that includes input health.
