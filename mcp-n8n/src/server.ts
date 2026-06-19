import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

type N8nWorkflowListResponse = {
  data?: N8nWorkflow[];
};

type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  nodes?: N8nNode[];
};

type N8nNode = {
  id: string;
  name: string;
  type: string;
  parameters?: Record<string, unknown>;
};

const N8N_BASE_URL = process.env.N8N_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_BASE_URL) {
  throw new Error('Missing required environment variable: N8N_BASE_URL');
}

if (!N8N_API_KEY) {
  throw new Error('Missing required environment variable: N8N_API_KEY');
}

function n8nUrl(path: string): string {
  const base = N8N_BASE_URL!.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}/api/v1${cleanPath}`;
}

async function n8nRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(n8nUrl(path), {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY!,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body: unknown = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep body as text for diagnostics.
  }

  if (!response.ok) {
    throw new Error(`n8n API error ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function listWorkflows(limit = 250): Promise<N8nWorkflow[]> {
  const data = (await n8nRequest(`/workflows?limit=${limit}`)) as N8nWorkflowListResponse | N8nWorkflow[];
  return Array.isArray(data) ? data : data.data || [];
}

async function getWorkflow(workflowId: string): Promise<N8nWorkflow> {
  return (await n8nRequest(`/workflows/${encodeURIComponent(workflowId)}`)) as N8nWorkflow;
}

function matchesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

function summarizeParameters(parameters: Record<string, unknown> = {}) {
  const summary: Record<string, unknown> = {};
  const allowedKeys = [
    'operation',
    'resource',
    'tableId',
    'filePath',
    'inputSource',
    'url',
    'method',
    'authentication',
  ];

  for (const key of allowedKeys) {
    if (!(key in parameters)) continue;

    if (key === 'url' && typeof parameters[key] === 'string') {
      summary[key] = (parameters[key] as string).replace(/\?.*$/, '?<redacted>');
    } else {
      summary[key] = parameters[key];
    }
  }

  if ('jsCode' in parameters && typeof parameters.jsCode === 'string') {
    summary.jsCode = {
      present: true,
      length: parameters.jsCode.length,
    };
  }

  return summary;
}

const server = new McpServer({
  name: 'trading-agent-n8n-mcp',
  version: '0.1.0',
});

server.tool(
  'n8n_list_workflows',
  'List workflows from the connected n8n workspace. Read-only.',
  {
    limit: z.number().int().positive().max(250).optional().describe('Maximum workflows to return.'),
  },
  async ({ limit }) => {
    const query = limit ? `?limit=${limit}` : '';
    const data = await n8nRequest(`/workflows${query}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_find_workflow',
  'Find workflows by exact or partial name. Read-only.',
  {
    name: z.string().min(1).describe('Workflow name or partial name to search for.'),
    limit: z.number().int().positive().max(250).optional().describe('Maximum workflows to search.'),
  },
  async ({ name, limit }) => {
    const workflows = await listWorkflows(limit || 250);
    const matches = workflows
      .filter((workflow) => matchesQuery(workflow.name, name))
      .map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ query: name, matches }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_get_workflow_summary',
  'Fetch a workflow summary with node names, IDs and types. Read-only.',
  {
    workflowId: z.string().min(1).describe('The n8n workflow ID.'),
  },
  async ({ workflowId }) => {
    const workflow = await getWorkflow(workflowId);
    const summary = {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      nodes: (workflow.nodes || []).map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_get_workflow',
  'Fetch one workflow by n8n workflow ID. Read-only.',
  {
    workflowId: z.string().min(1).describe('The n8n workflow ID.'),
  },
  async ({ workflowId }) => {
    const data = await n8nRequest(`/workflows/${encodeURIComponent(workflowId)}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_find_node',
  'Find nodes by exact or partial node name and return a safe parameter summary. Read-only.',
  {
    workflowId: z.string().min(1).describe('The n8n workflow ID.'),
    nodeName: z.string().min(1).describe('Node name or partial name to search for.'),
  },
  async ({ workflowId, nodeName }) => {
    const workflow = await getWorkflow(workflowId);
    const matches = (workflow.nodes || [])
      .filter((node) => matchesQuery(node.name, nodeName))
      .map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        parameters: summarizeParameters(node.parameters),
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ workflowId: workflow.id, workflowName: workflow.name, query: nodeName, matches }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_backup_workflow',
  'Return the full workflow JSON as text for caller-managed backup. Read-only; does not write files.',
  {
    workflowId: z.string().min(1).describe('The n8n workflow ID.'),
  },
  async ({ workflowId }) => {
    const workflow = await getWorkflow(workflowId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(workflow, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_get_code_node',
  'Fetch one code node by exact or partial name, or node ID, and return code content only. Read-only.',
  {
    workflowId: z.string().min(1).describe('The n8n workflow ID.'),
    node: z.string().min(1).describe('Code node name, partial name, or node ID.'),
  },
  async ({ workflowId, node }) => {
    const workflow = await getWorkflow(workflowId);
    const matches = (workflow.nodes || [])
      .filter((candidate) => candidate.type === 'n8n-nodes-base.code')
      .filter((candidate) => candidate.id === node || matchesQuery(candidate.name, node))
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        code: typeof candidate.parameters?.jsCode === 'string' ? candidate.parameters.jsCode : '',
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ workflowId: workflow.id, workflowName: workflow.name, query: node, matches }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_get_execution',
  'Fetch one n8n execution by execution ID. Read-only.',
  {
    executionId: z.string().min(1).describe('The n8n execution ID.'),
  },
  async ({ executionId }) => {
    const data = await n8nRequest(`/executions/${encodeURIComponent(executionId)}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

server.tool(
  'n8n_list_executions',
  'List recent n8n executions. Read-only.',
  {
    limit: z.number().int().positive().max(100).optional().describe('Maximum executions to return.'),
  },
  async ({ limit }) => {
    const query = limit ? `?limit=${limit}` : '';
    const data = await n8nRequest(`/executions${query}`);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
