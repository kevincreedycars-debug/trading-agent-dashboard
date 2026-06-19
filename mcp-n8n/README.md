# n8n MCP Server

This folder contains a small MCP server that exposes selected n8n API operations to an AI client.

## Current Version

Read-only.

Available tools:

- `n8n_list_workflows`
- `n8n_get_workflow`
- `n8n_list_executions`
- `n8n_get_execution`

Write/edit tools should only be added after all live workflows have been exported to GitHub.

## Required Environment Variables

Do not commit secrets.

```bash
N8N_BASE_URL=https://silver17.app.n8n.cloud
N8N_API_KEY=<secret>
```

## Local Test

From the repository root:

```bash
cd mcp-n8n
npm install
N8N_BASE_URL=https://silver17.app.n8n.cloud N8N_API_KEY=<secret> npm run dev
```

This starts the MCP server over stdio.

## Client Configuration Example

Exact configuration varies by MCP client, but the shape is usually:

```json
{
  "mcpServers": {
    "trading-agent-n8n": {
      "command": "npm",
      "args": ["--prefix", "mcp-n8n", "run", "dev"],
      "env": {
        "N8N_BASE_URL": "https://silver17.app.n8n.cloud",
        "N8N_API_KEY": "<secret>"
      }
    }
  }
}
```

## First AI Task After Connection

Ask the AI client:

```text
Use the trading-agent-n8n MCP server. List all n8n workflows, match them against workflows/WORKFLOW_INVENTORY.md, and report which expected workflows are found or missing. Do not edit any workflows.
```

## Second AI Task

After workflow list is confirmed:

```text
Fetch each expected workflow through MCP and save the JSON exports into exports/. Do not edit live workflows.
```

## Security Rules

1. Keep this MCP server read-only until exports exist.
2. Do not expose destructive tools until there is a working backup/restore process.
3. Do not commit API keys.
4. Do not store secrets inside workflow exports.
5. Revoke the setup API key after proof-of-connection and replace it with a fresh key stored securely.

## Future Tools

Only after backups are complete, add carefully scoped tools:

- `n8n_update_workflow_node`
- `n8n_activate_workflow`
- `n8n_deactivate_workflow`
- `n8n_run_workflow`

Do not add broad arbitrary-write tools unless absolutely necessary.
