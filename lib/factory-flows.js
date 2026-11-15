// GENERATED FILE - do not edit by hand.
// Written by `node scripts/build_factory_flows.js` from the Layer 1 agent exports in `exports/`.
//
// Only an allowlist of fields is copied out of each export: node names, node types, type versions, the
// connection edges between them and the purpose written for each step. Node parameters, credential references,
// provider endpoints and workflow URLs never reach this file, so the browser cannot load a raw n8n export.
// Run `node scripts/build_factory_flows.js --check` to prove this file still matches the exports it names.
window.FactoryFlows = {
  "schemaVersion": "factory-flows-v1",
  "builtBy": "scripts/build_factory_flows.js",
  "note": "Allowlisted presentation data only: node names, node types, connection edges and written purposes. The raw n8n exports are not loaded by the browser and are not copied here.",
  "assets": {
    "USD": {
      "code": "USD",
      "workflow": "USD Layer 1 Agent",
      "exportPath": "exports/usd_layer1_agent.json",
      "order": [
        "when-executed-by-another-workflow",
        "supabase-get-many",
        "build-usd-input-pack",
        "get-usd-logic-document",
        "combine-md-market-snapshot",
        "message-a-model",
        "parse-usd-agent-output",
        "calculate-usd-conviction",
        "create-a-row"
      ],
      "status": "verified",
      "statusLabel": "Verified flow",
      "note": "The dossier walks the same export node by node and executes the scoring code against a frozen fixture. Its eight-step table omits the combine node, which the export places between the rulebook fetch and the model call; this diagram draws all nine nodes of the export.",
      "source": {
        "sha256": "719ff071a17cb90adaab3cd217ef6f11f73c22830d8f4eb7a4eb340a4e31f6be",
        "bytes": 64519,
        "activeInExport": true,
        "nodes": 9,
        "edges": 8
      },
      "verifiedBy": [
        [
          "docs/analysis-engine/USD_LAYER1_LOGIC.md",
          "Verified against the export and the logic dossier"
        ]
      ],
      "upstream": {
        "direct": {
          "label": "Master Orchestrator · Execute Workflow",
          "purpose": "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and the snapshot is read from storage by the agent's own first data node.",
          "evidence": [
            "workflows/master_orchestrator.md",
            "Master Orchestrator workflow note"
          ]
        },
        "storage": {
          "label": "market_snapshots table",
          "purpose": "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through storage, so the hand-off is a stored row rather than a direct workflow invocation.",
          "evidence": [
            "docs/HISTORICAL_DATA_INVENTORY.md",
            "Historical data inventory"
          ]
        }
      },
      "downstream": {
        "label": "agent_outputs table → Dashboard Writer",
        "purpose": "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes data/layer1.json; nothing downstream reads this workflow directly.",
        "evidence": [
          "workflows/WORKFLOW_INVENTORY.md",
          "Workflow inventory"
        ]
      },
      "nodes": [
        {
          "id": "build-usd-input-pack",
          "name": "Build USD Input Pack",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "pack",
          "step": "03 PACK",
          "purpose": "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the inputs that are missing. A row that fails the test is dropped rather than partially scored.",
          "inputs": "The snapshot rows from the read step.",
          "outputs": "One input pack: the chosen snapshot, its missing-input list and the run date.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "message-a-model",
          "name": "Message a model",
          "type": "@n8n/n8n-nodes-langchain.openAi",
          "typeLabel": "OpenAI model",
          "typeVersion": "2.3",
          "role": "model",
          "step": "06 MODEL",
          "purpose": "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: the scoring node re-derives every number afterwards.",
          "inputs": "The combined payload: rule text, snapshot and the output contract.",
          "outputs": "A drafted factor reading in the row contract.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "supabase-get-many",
          "name": "Supabase Get Many",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-read",
          "step": "02 READ",
          "purpose": "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test happen in the next Code node, which keeps the rule readable in one place.",
          "inputs": "The market_snapshots table, through the stored Supabase connection.",
          "outputs": "Every snapshot row, sorted only by the next node.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "create-a-row",
          "name": "Create a row",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-write",
          "step": "09 WRITE",
          "purpose": "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later stage is invoked from inside this workflow.",
          "inputs": "The finished call row.",
          "outputs": "One row in agent_outputs, which the Dashboard Writer publishes.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 0
        },
        {
          "id": "combine-md-market-snapshot",
          "name": "Combine md & market snapshot",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "combine",
          "step": "05 COMBINE",
          "purpose": "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: it only assembles what the two earlier branches produced.",
          "inputs": "The logic document and the input pack.",
          "outputs": "One prompt payload carrying the rules and the snapshot.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "get-usd-logic-document",
          "name": "Get USD Logic Document",
          "type": "n8n-nodes-base.github",
          "typeLabel": "GitHub",
          "typeVersion": "1.1",
          "role": "rulebook",
          "step": "04 RULEBOOK",
          "purpose": "Reads the agent's logic document from the repository. The rule text is fetched on every run, so the document is an input to the call rather than a copy of it.",
          "inputs": "The repository path of the agent's logic document.",
          "outputs": "The rule text, as a file the next node can combine.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "parse-usd-agent-output",
          "name": "Parse USD Agent Output",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "parse",
          "step": "07 PARSE",
          "purpose": "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial reading cannot pass as a complete one.",
          "inputs": "The model's drafted reading.",
          "outputs": "A structured set of factor readings plus the missing-input flags.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "calculate-usd-conviction",
          "name": "Calculate USD Conviction",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "score",
          "step": "08 SCORE",
          "purpose": "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
          "inputs": "The raw snapshot and the parsed reading.",
          "outputs": "The call: direction, conviction, the factor signals and the missing inputs.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "when-executed-by-another-workflow",
          "name": "When Executed by Another Workflow",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeLabel": "Execute Workflow trigger",
          "typeVersion": "1.2",
          "role": "trigger",
          "step": "01 TRIGGER",
          "purpose": "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data arrives through this node.",
          "inputs": "A workflow invocation from the Master Orchestrator.",
          "outputs": "One empty item that starts the chain.",
          "evidence": [
            [
              "docs/analysis-engine/USD_LAYER1_LOGIC.md",
              "The verified pipeline dossier"
            ]
          ],
          "incoming": 0,
          "outgoing": 1
        }
      ],
      "edges": [
        {
          "from": "build-usd-input-pack",
          "to": "get-usd-logic-document",
          "branch": 0,
          "input": 0
        },
        {
          "from": "supabase-get-many",
          "to": "build-usd-input-pack",
          "branch": 0,
          "input": 0
        },
        {
          "from": "message-a-model",
          "to": "parse-usd-agent-output",
          "branch": 0,
          "input": 0
        },
        {
          "from": "combine-md-market-snapshot",
          "to": "message-a-model",
          "branch": 0,
          "input": 0
        },
        {
          "from": "get-usd-logic-document",
          "to": "combine-md-market-snapshot",
          "branch": 0,
          "input": 0
        },
        {
          "from": "parse-usd-agent-output",
          "to": "calculate-usd-conviction",
          "branch": 0,
          "input": 0
        },
        {
          "from": "calculate-usd-conviction",
          "to": "create-a-row",
          "branch": 0,
          "input": 0
        },
        {
          "from": "when-executed-by-another-workflow",
          "to": "supabase-get-many",
          "branch": 0,
          "input": 0
        }
      ],
      "joins": [],
      "branches": []
    },
    "EUR": {
      "code": "EUR",
      "workflow": "EUR Layer 1 Agent",
      "exportPath": "exports/eur_layer1_agent.json",
      "order": [
        "when-executed-by-another-workflow",
        "supabase-get-many",
        "build-eur-input-pack",
        "get-eur-logic-document",
        "combine-md-market-snapshot",
        "message-a-model",
        "parse-eur-agent-output",
        "calculate-eur-conviction",
        "create-a-row"
      ],
      "status": "documented",
      "statusLabel": "Documented workflow",
      "note": "The flow is drawn from the checked-in export. No document walks this agent's pipeline node by node, so the diagram is the export and the written purpose of each step, nothing more.",
      "source": {
        "sha256": "0df653a31c1f90ed2aaa4892a81781b492bbccdb3e25381058297da0e0fe694a",
        "bytes": 72180,
        "activeInExport": true,
        "nodes": 9,
        "edges": 8
      },
      "verifiedBy": [],
      "upstream": {
        "direct": {
          "label": "Master Orchestrator · Execute Workflow",
          "purpose": "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and the snapshot is read from storage by the agent's own first data node.",
          "evidence": [
            "workflows/master_orchestrator.md",
            "Master Orchestrator workflow note"
          ]
        },
        "storage": {
          "label": "market_snapshots table",
          "purpose": "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through storage, so the hand-off is a stored row rather than a direct workflow invocation.",
          "evidence": [
            "docs/HISTORICAL_DATA_INVENTORY.md",
            "Historical data inventory"
          ]
        }
      },
      "downstream": {
        "label": "agent_outputs table → Dashboard Writer",
        "purpose": "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes data/layer1.json; nothing downstream reads this workflow directly.",
        "evidence": [
          "workflows/WORKFLOW_INVENTORY.md",
          "Workflow inventory"
        ]
      },
      "nodes": [
        {
          "id": "message-a-model",
          "name": "Message a model",
          "type": "@n8n/n8n-nodes-langchain.openAi",
          "typeLabel": "OpenAI model",
          "typeVersion": "2.3",
          "role": "model",
          "step": "06 MODEL",
          "purpose": "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: the scoring node re-derives every number afterwards.",
          "inputs": "The combined payload: rule text, snapshot and the output contract.",
          "outputs": "A drafted factor reading in the row contract.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "supabase-get-many",
          "name": "Supabase Get Many",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-read",
          "step": "02 READ",
          "purpose": "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test happen in the next Code node, which keeps the rule readable in one place.",
          "inputs": "The market_snapshots table, through the stored Supabase connection.",
          "outputs": "Every snapshot row, sorted only by the next node.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "create-a-row",
          "name": "Create a row",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-write",
          "step": "09 WRITE",
          "purpose": "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later stage is invoked from inside this workflow.",
          "inputs": "The finished call row.",
          "outputs": "One row in agent_outputs, which the Dashboard Writer publishes.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 0
        },
        {
          "id": "combine-md-market-snapshot",
          "name": "Combine md & market snapshot",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "combine",
          "step": "05 COMBINE",
          "purpose": "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: it only assembles what the two earlier branches produced.",
          "inputs": "The logic document and the input pack.",
          "outputs": "One prompt payload carrying the rules and the snapshot.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "build-eur-input-pack",
          "name": "Build EUR Input Pack",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "pack",
          "step": "03 PACK",
          "purpose": "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the inputs that are missing. A row that fails the test is dropped rather than partially scored.",
          "inputs": "The snapshot rows from the read step.",
          "outputs": "One input pack: the chosen snapshot, its missing-input list and the run date.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "get-eur-logic-document",
          "name": "Get EUR Logic Document",
          "type": "n8n-nodes-base.github",
          "typeLabel": "GitHub",
          "typeVersion": "1.1",
          "role": "rulebook",
          "step": "04 RULEBOOK",
          "purpose": "Reads the agent's logic document from the repository. The rule text is fetched on every run, so the document is an input to the call rather than a copy of it.",
          "inputs": "The repository path of the agent's logic document.",
          "outputs": "The rule text, as a file the next node can combine.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "parse-eur-agent-output",
          "name": "Parse EUR Agent Output",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "parse",
          "step": "07 PARSE",
          "purpose": "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial reading cannot pass as a complete one.",
          "inputs": "The model's drafted reading.",
          "outputs": "A structured set of factor readings plus the missing-input flags.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "calculate-eur-conviction",
          "name": "Calculate EUR Conviction",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "score",
          "step": "08 SCORE",
          "purpose": "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
          "inputs": "The raw snapshot and the parsed reading.",
          "outputs": "The call: direction, conviction, the factor signals and the missing inputs.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "when-executed-by-another-workflow",
          "name": "When Executed by Another Workflow",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeLabel": "Execute Workflow trigger",
          "typeVersion": "1.2",
          "role": "trigger",
          "step": "01 TRIGGER",
          "purpose": "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data arrives through this node.",
          "inputs": "A workflow invocation from the Master Orchestrator.",
          "outputs": "One empty item that starts the chain.",
          "evidence": [],
          "incoming": 0,
          "outgoing": 1
        }
      ],
      "edges": [
        {
          "from": "supabase-get-many",
          "to": "build-eur-input-pack",
          "branch": 0,
          "input": 0
        },
        {
          "from": "message-a-model",
          "to": "parse-eur-agent-output",
          "branch": 0,
          "input": 0
        },
        {
          "from": "combine-md-market-snapshot",
          "to": "message-a-model",
          "branch": 0,
          "input": 0
        },
        {
          "from": "build-eur-input-pack",
          "to": "get-eur-logic-document",
          "branch": 0,
          "input": 0
        },
        {
          "from": "get-eur-logic-document",
          "to": "combine-md-market-snapshot",
          "branch": 0,
          "input": 0
        },
        {
          "from": "parse-eur-agent-output",
          "to": "calculate-eur-conviction",
          "branch": 0,
          "input": 0
        },
        {
          "from": "calculate-eur-conviction",
          "to": "create-a-row",
          "branch": 0,
          "input": 0
        },
        {
          "from": "when-executed-by-another-workflow",
          "to": "supabase-get-many",
          "branch": 0,
          "input": 0
        }
      ],
      "joins": [],
      "branches": []
    },
    "GOLD": {
      "code": "GOLD",
      "workflow": "GOLD Layer 1 Agent",
      "exportPath": "exports/gold_layer1_agent.json",
      "order": [
        "when-executed-by-another-workflow",
        "supabase-get-many",
        "build-gold-input-pack",
        "get-gold-logic-document",
        "combine-md-market-snapshot",
        "message-a-model",
        "parse-gold-agent-output",
        "calculate-gold-conviction",
        "create-a-row"
      ],
      "status": "documented",
      "statusLabel": "Documented workflow",
      "note": "The flow is drawn from the checked-in export. No document walks this agent's pipeline node by node, so the diagram is the export and the written purpose of each step, nothing more.",
      "source": {
        "sha256": "8e49555a5cb0c8db8c369a3edf497d785bf65db7f13a84cf5fefb7d641153322",
        "bytes": 61473,
        "activeInExport": true,
        "nodes": 9,
        "edges": 8
      },
      "verifiedBy": [],
      "upstream": {
        "direct": {
          "label": "Master Orchestrator · Execute Workflow",
          "purpose": "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and the snapshot is read from storage by the agent's own first data node.",
          "evidence": [
            "workflows/master_orchestrator.md",
            "Master Orchestrator workflow note"
          ]
        },
        "storage": {
          "label": "market_snapshots table",
          "purpose": "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through storage, so the hand-off is a stored row rather than a direct workflow invocation.",
          "evidence": [
            "docs/HISTORICAL_DATA_INVENTORY.md",
            "Historical data inventory"
          ]
        }
      },
      "downstream": {
        "label": "agent_outputs table → Dashboard Writer",
        "purpose": "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes data/layer1.json; nothing downstream reads this workflow directly.",
        "evidence": [
          "workflows/WORKFLOW_INVENTORY.md",
          "Workflow inventory"
        ]
      },
      "nodes": [
        {
          "id": "message-a-model",
          "name": "Message a model",
          "type": "@n8n/n8n-nodes-langchain.openAi",
          "typeLabel": "OpenAI model",
          "typeVersion": "2.3",
          "role": "model",
          "step": "06 MODEL",
          "purpose": "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: the scoring node re-derives every number afterwards.",
          "inputs": "The combined payload: rule text, snapshot and the output contract.",
          "outputs": "A drafted factor reading in the row contract.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "supabase-get-many",
          "name": "Supabase Get Many",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-read",
          "step": "02 READ",
          "purpose": "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test happen in the next Code node, which keeps the rule readable in one place.",
          "inputs": "The market_snapshots table, through the stored Supabase connection.",
          "outputs": "Every snapshot row, sorted only by the next node.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "create-a-row",
          "name": "Create a row",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-write",
          "step": "09 WRITE",
          "purpose": "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later stage is invoked from inside this workflow.",
          "inputs": "The finished call row.",
          "outputs": "One row in agent_outputs, which the Dashboard Writer publishes.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 0
        },
        {
          "id": "combine-md-market-snapshot",
          "name": "Combine md & market snapshot",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "combine",
          "step": "05 COMBINE",
          "purpose": "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: it only assembles what the two earlier branches produced.",
          "inputs": "The logic document and the input pack.",
          "outputs": "One prompt payload carrying the rules and the snapshot.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "build-gold-input-pack",
          "name": "Build GOLD Input Pack",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "pack",
          "step": "03 PACK",
          "purpose": "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the inputs that are missing. A row that fails the test is dropped rather than partially scored.",
          "inputs": "The snapshot rows from the read step.",
          "outputs": "One input pack: the chosen snapshot, its missing-input list and the run date.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "get-gold-logic-document",
          "name": "Get GOLD Logic Document",
          "type": "n8n-nodes-base.github",
          "typeLabel": "GitHub",
          "typeVersion": "1.1",
          "role": "rulebook",
          "step": "04 RULEBOOK",
          "purpose": "Reads the agent's logic document from the repository. The rule text is fetched on every run, so the document is an input to the call rather than a copy of it.",
          "inputs": "The repository path of the agent's logic document.",
          "outputs": "The rule text, as a file the next node can combine.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "parse-gold-agent-output",
          "name": "Parse GOLD Agent Output",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "parse",
          "step": "07 PARSE",
          "purpose": "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial reading cannot pass as a complete one.",
          "inputs": "The model's drafted reading.",
          "outputs": "A structured set of factor readings plus the missing-input flags.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "calculate-gold-conviction",
          "name": "Calculate GOLD Conviction",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "score",
          "step": "08 SCORE",
          "purpose": "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
          "inputs": "The raw snapshot and the parsed reading.",
          "outputs": "The call: direction, conviction, the factor signals and the missing inputs.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "when-executed-by-another-workflow",
          "name": "When Executed by Another Workflow",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeLabel": "Execute Workflow trigger",
          "typeVersion": "1.2",
          "role": "trigger",
          "step": "01 TRIGGER",
          "purpose": "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data arrives through this node.",
          "inputs": "A workflow invocation from the Master Orchestrator.",
          "outputs": "One empty item that starts the chain.",
          "evidence": [],
          "incoming": 0,
          "outgoing": 1
        }
      ],
      "edges": [
        {
          "from": "supabase-get-many",
          "to": "build-gold-input-pack",
          "branch": 0,
          "input": 0
        },
        {
          "from": "message-a-model",
          "to": "parse-gold-agent-output",
          "branch": 0,
          "input": 0
        },
        {
          "from": "combine-md-market-snapshot",
          "to": "message-a-model",
          "branch": 0,
          "input": 0
        },
        {
          "from": "build-gold-input-pack",
          "to": "get-gold-logic-document",
          "branch": 0,
          "input": 0
        },
        {
          "from": "get-gold-logic-document",
          "to": "combine-md-market-snapshot",
          "branch": 0,
          "input": 0
        },
        {
          "from": "parse-gold-agent-output",
          "to": "calculate-gold-conviction",
          "branch": 0,
          "input": 0
        },
        {
          "from": "calculate-gold-conviction",
          "to": "create-a-row",
          "branch": 0,
          "input": 0
        },
        {
          "from": "when-executed-by-another-workflow",
          "to": "supabase-get-many",
          "branch": 0,
          "input": 0
        }
      ],
      "joins": [],
      "branches": []
    },
    "SILVER": {
      "code": "SILVER",
      "workflow": "SILVER Layer 1 Agent",
      "exportPath": "exports/silver_layer1_agent.json",
      "order": [
        "when-executed-by-another-workflow",
        "supabase-get-many",
        "build-silver-input-pack",
        "get-silver-logic-document",
        "combine-md-market-snapshot",
        "message-a-model",
        "parse-silver-agent-output",
        "calculate-silver-conviction",
        "create-a-row"
      ],
      "status": "documented",
      "statusLabel": "Documented workflow",
      "note": "The flow is drawn from the checked-in export. No document walks this agent's pipeline node by node, so the diagram is the export and the written purpose of each step, nothing more.",
      "source": {
        "sha256": "1802be46ff1376e71baf05efc16054bb622014f20b7de7c066221bd11be2d560",
        "bytes": 38918,
        "activeInExport": false,
        "nodes": 9,
        "edges": 8
      },
      "verifiedBy": [],
      "upstream": {
        "direct": {
          "label": "Master Orchestrator · Execute Workflow",
          "purpose": "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and the snapshot is read from storage by the agent's own first data node.",
          "evidence": [
            "workflows/master_orchestrator.md",
            "Master Orchestrator workflow note"
          ]
        },
        "storage": {
          "label": "market_snapshots table",
          "purpose": "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through storage, so the hand-off is a stored row rather than a direct workflow invocation.",
          "evidence": [
            "docs/HISTORICAL_DATA_INVENTORY.md",
            "Historical data inventory"
          ]
        }
      },
      "downstream": {
        "label": "agent_outputs table → Dashboard Writer",
        "purpose": "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes data/layer1.json; nothing downstream reads this workflow directly.",
        "evidence": [
          "workflows/WORKFLOW_INVENTORY.md",
          "Workflow inventory"
        ]
      },
      "nodes": [
        {
          "id": "message-a-model",
          "name": "Message a model",
          "type": "@n8n/n8n-nodes-langchain.openAi",
          "typeLabel": "OpenAI model",
          "typeVersion": "2.3",
          "role": "model",
          "step": "06 MODEL",
          "purpose": "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: the scoring node re-derives every number afterwards.",
          "inputs": "The combined payload: rule text, snapshot and the output contract.",
          "outputs": "A drafted factor reading in the row contract.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "supabase-get-many",
          "name": "Supabase Get Many",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-read",
          "step": "02 READ",
          "purpose": "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test happen in the next Code node, which keeps the rule readable in one place.",
          "inputs": "The market_snapshots table, through the stored Supabase connection.",
          "outputs": "Every snapshot row, sorted only by the next node.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "create-a-row",
          "name": "Create a row",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-write",
          "step": "09 WRITE",
          "purpose": "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later stage is invoked from inside this workflow.",
          "inputs": "The finished call row.",
          "outputs": "One row in agent_outputs, which the Dashboard Writer publishes.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 0
        },
        {
          "id": "combine-md-market-snapshot",
          "name": "Combine md & market snapshot",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "combine",
          "step": "05 COMBINE",
          "purpose": "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: it only assembles what the two earlier branches produced.",
          "inputs": "The logic document and the input pack.",
          "outputs": "One prompt payload carrying the rules and the snapshot.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "build-silver-input-pack",
          "name": "Build SILVER Input Pack",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "pack",
          "step": "03 PACK",
          "purpose": "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the inputs that are missing. A row that fails the test is dropped rather than partially scored.",
          "inputs": "The snapshot rows from the read step.",
          "outputs": "One input pack: the chosen snapshot, its missing-input list and the run date.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "get-silver-logic-document",
          "name": "Get SILVER Logic Document",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "rulebook",
          "step": "04 RULEBOOK",
          "purpose": "Reads the agent's logic document inside a Code node rather than a GitHub node. The rule text is still fetched on every run, so the document is an input to the call rather than a copy of it.",
          "inputs": "The repository path of the agent's logic document.",
          "outputs": "The rule text, as a file the next node can combine.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "parse-silver-agent-output",
          "name": "Parse SILVER Agent Output",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "parse",
          "step": "07 PARSE",
          "purpose": "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial reading cannot pass as a complete one.",
          "inputs": "The model's drafted reading.",
          "outputs": "A structured set of factor readings plus the missing-input flags.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "calculate-silver-conviction",
          "name": "Calculate SILVER Conviction",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "score",
          "step": "08 SCORE",
          "purpose": "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
          "inputs": "The raw snapshot and the parsed reading.",
          "outputs": "The call: direction, conviction, the factor signals and the missing inputs.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "when-executed-by-another-workflow",
          "name": "When Executed by Another Workflow",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeLabel": "Execute Workflow trigger",
          "typeVersion": "1.2",
          "role": "trigger",
          "step": "01 TRIGGER",
          "purpose": "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data arrives through this node.",
          "inputs": "A workflow invocation from the Master Orchestrator.",
          "outputs": "One empty item that starts the chain.",
          "evidence": [],
          "incoming": 0,
          "outgoing": 1
        }
      ],
      "edges": [
        {
          "from": "supabase-get-many",
          "to": "build-silver-input-pack",
          "branch": 0,
          "input": 0
        },
        {
          "from": "message-a-model",
          "to": "parse-silver-agent-output",
          "branch": 0,
          "input": 0
        },
        {
          "from": "combine-md-market-snapshot",
          "to": "message-a-model",
          "branch": 0,
          "input": 0
        },
        {
          "from": "build-silver-input-pack",
          "to": "get-silver-logic-document",
          "branch": 0,
          "input": 0
        },
        {
          "from": "get-silver-logic-document",
          "to": "combine-md-market-snapshot",
          "branch": 0,
          "input": 0
        },
        {
          "from": "parse-silver-agent-output",
          "to": "calculate-silver-conviction",
          "branch": 0,
          "input": 0
        },
        {
          "from": "calculate-silver-conviction",
          "to": "create-a-row",
          "branch": 0,
          "input": 0
        },
        {
          "from": "when-executed-by-another-workflow",
          "to": "supabase-get-many",
          "branch": 0,
          "input": 0
        }
      ],
      "joins": [],
      "branches": []
    },
    "NQ": {
      "code": "NQ",
      "workflow": "NQ Layer 1 Agent",
      "exportPath": "exports/nq_layer1_agent.json",
      "order": [
        "when-executed-by-another-workflow",
        "supabase-get-many",
        "build-nq-input-pack",
        "get-nq-logic-document",
        "combine-md-market-snapshot",
        "message-a-model",
        "parse-nq-agent-output",
        "calculate-nq-conviction",
        "create-a-row"
      ],
      "status": "documented",
      "statusLabel": "Documented workflow",
      "note": "The flow is drawn from the checked-in export. No document walks this agent's pipeline node by node, so the diagram is the export and the written purpose of each step, nothing more.",
      "source": {
        "sha256": "b24e23d2a544b218c1f1f5c218496d69eb74ac16d536eeccb908005949920f71",
        "bytes": 62475,
        "activeInExport": true,
        "nodes": 9,
        "edges": 8
      },
      "verifiedBy": [],
      "upstream": {
        "direct": {
          "label": "Master Orchestrator · Execute Workflow",
          "purpose": "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and the snapshot is read from storage by the agent's own first data node.",
          "evidence": [
            "workflows/master_orchestrator.md",
            "Master Orchestrator workflow note"
          ]
        },
        "storage": {
          "label": "market_snapshots table",
          "purpose": "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through storage, so the hand-off is a stored row rather than a direct workflow invocation.",
          "evidence": [
            "docs/HISTORICAL_DATA_INVENTORY.md",
            "Historical data inventory"
          ]
        }
      },
      "downstream": {
        "label": "agent_outputs table → Dashboard Writer",
        "purpose": "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes data/layer1.json; nothing downstream reads this workflow directly.",
        "evidence": [
          "workflows/WORKFLOW_INVENTORY.md",
          "Workflow inventory"
        ]
      },
      "nodes": [
        {
          "id": "message-a-model",
          "name": "Message a model",
          "type": "@n8n/n8n-nodes-langchain.openAi",
          "typeLabel": "OpenAI model",
          "typeVersion": "2.3",
          "role": "model",
          "step": "06 MODEL",
          "purpose": "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: the scoring node re-derives every number afterwards.",
          "inputs": "The combined payload: rule text, snapshot and the output contract.",
          "outputs": "A drafted factor reading in the row contract.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "supabase-get-many",
          "name": "Supabase Get Many",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-read",
          "step": "02 READ",
          "purpose": "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test happen in the next Code node, which keeps the rule readable in one place.",
          "inputs": "The market_snapshots table, through the stored Supabase connection.",
          "outputs": "Every snapshot row, sorted only by the next node.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "create-a-row",
          "name": "Create a row",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-write",
          "step": "09 WRITE",
          "purpose": "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later stage is invoked from inside this workflow.",
          "inputs": "The finished call row.",
          "outputs": "One row in agent_outputs, which the Dashboard Writer publishes.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 0
        },
        {
          "id": "combine-md-market-snapshot",
          "name": "Combine md & market snapshot",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "combine",
          "step": "05 COMBINE",
          "purpose": "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: it only assembles what the two earlier branches produced.",
          "inputs": "The logic document and the input pack.",
          "outputs": "One prompt payload carrying the rules and the snapshot.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "build-nq-input-pack",
          "name": "Build NQ Input Pack",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "pack",
          "step": "03 PACK",
          "purpose": "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the inputs that are missing. A row that fails the test is dropped rather than partially scored.",
          "inputs": "The snapshot rows from the read step.",
          "outputs": "One input pack: the chosen snapshot, its missing-input list and the run date.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "get-nq-logic-document",
          "name": "Get NQ Logic Document",
          "type": "n8n-nodes-base.github",
          "typeLabel": "GitHub",
          "typeVersion": "1.1",
          "role": "rulebook",
          "step": "04 RULEBOOK",
          "purpose": "Reads the agent's logic document from the repository. The rule text is fetched on every run, so the document is an input to the call rather than a copy of it.",
          "inputs": "The repository path of the agent's logic document.",
          "outputs": "The rule text, as a file the next node can combine.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "parse-nq-agent-output",
          "name": "Parse NQ Agent Output",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "parse",
          "step": "07 PARSE",
          "purpose": "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial reading cannot pass as a complete one.",
          "inputs": "The model's drafted reading.",
          "outputs": "A structured set of factor readings plus the missing-input flags.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "calculate-nq-conviction",
          "name": "Calculate NQ Conviction",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "score",
          "step": "08 SCORE",
          "purpose": "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
          "inputs": "The raw snapshot and the parsed reading.",
          "outputs": "The call: direction, conviction, the factor signals and the missing inputs.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "when-executed-by-another-workflow",
          "name": "When Executed by Another Workflow",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeLabel": "Execute Workflow trigger",
          "typeVersion": "1.2",
          "role": "trigger",
          "step": "01 TRIGGER",
          "purpose": "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data arrives through this node.",
          "inputs": "A workflow invocation from the Master Orchestrator.",
          "outputs": "One empty item that starts the chain.",
          "evidence": [],
          "incoming": 0,
          "outgoing": 1
        }
      ],
      "edges": [
        {
          "from": "supabase-get-many",
          "to": "build-nq-input-pack",
          "branch": 0,
          "input": 0
        },
        {
          "from": "message-a-model",
          "to": "parse-nq-agent-output",
          "branch": 0,
          "input": 0
        },
        {
          "from": "combine-md-market-snapshot",
          "to": "message-a-model",
          "branch": 0,
          "input": 0
        },
        {
          "from": "build-nq-input-pack",
          "to": "get-nq-logic-document",
          "branch": 0,
          "input": 0
        },
        {
          "from": "get-nq-logic-document",
          "to": "combine-md-market-snapshot",
          "branch": 0,
          "input": 0
        },
        {
          "from": "parse-nq-agent-output",
          "to": "calculate-nq-conviction",
          "branch": 0,
          "input": 0
        },
        {
          "from": "calculate-nq-conviction",
          "to": "create-a-row",
          "branch": 0,
          "input": 0
        },
        {
          "from": "when-executed-by-another-workflow",
          "to": "supabase-get-many",
          "branch": 0,
          "input": 0
        }
      ],
      "joins": [],
      "branches": []
    },
    "BTC": {
      "code": "BTC",
      "workflow": "BTC Layer 1 Agent",
      "exportPath": "exports/btc_layer1_agent.json",
      "order": [
        "when-executed-by-another-workflow",
        "supabase-get-many",
        "build-btc-input-pack",
        "get-btc-logic-document",
        "combine-md-market-snapshot",
        "message-a-model",
        "parse-btc-agent-output",
        "calculate-btc-conviction",
        "create-a-row"
      ],
      "status": "documented",
      "statusLabel": "Documented workflow",
      "note": "The flow is drawn from the checked-in export. No document walks this agent's pipeline node by node, so the diagram is the export and the written purpose of each step, nothing more.",
      "source": {
        "sha256": "0a5dc51cdee0e27cd5ee7315fc543cc97a79b8dac3ec6235bb03ea2d6db990d4",
        "bytes": 73520,
        "activeInExport": true,
        "nodes": 9,
        "edges": 8
      },
      "verifiedBy": [],
      "upstream": {
        "direct": {
          "label": "Master Orchestrator · Execute Workflow",
          "purpose": "The orchestrator invokes this agent as a workflow. That is a direct n8n call: it carries no market data, and the snapshot is read from storage by the agent's own first data node.",
          "evidence": [
            "workflows/master_orchestrator.md",
            "Master Orchestrator workflow note"
          ]
        },
        "storage": {
          "label": "market_snapshots table",
          "purpose": "The asset collector writes one normalised snapshot row per pipeline run. The agent reads that table through storage, so the hand-off is a stored row rather than a direct workflow invocation.",
          "evidence": [
            "docs/HISTORICAL_DATA_INVENTORY.md",
            "Historical data inventory"
          ]
        }
      },
      "downstream": {
        "label": "agent_outputs table → Dashboard Writer",
        "purpose": "The finished call is inserted as a row. The Dashboard Writer reads the newest row per asset and publishes data/layer1.json; nothing downstream reads this workflow directly.",
        "evidence": [
          "workflows/WORKFLOW_INVENTORY.md",
          "Workflow inventory"
        ]
      },
      "nodes": [
        {
          "id": "message-a-model",
          "name": "Message a model",
          "type": "@n8n/n8n-nodes-langchain.openAi",
          "typeLabel": "OpenAI model",
          "typeVersion": "2.3",
          "role": "model",
          "step": "06 MODEL",
          "purpose": "Sends the rulebook and the input pack to the model and receives a drafted reading. The draft is not the call: the scoring node re-derives every number afterwards.",
          "inputs": "The combined payload: rule text, snapshot and the output contract.",
          "outputs": "A drafted factor reading in the row contract.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "supabase-get-many",
          "name": "Supabase Get Many",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-read",
          "step": "02 READ",
          "purpose": "Pulls every row of the market_snapshots table. No filter is applied here: sorting and the usability test happen in the next Code node, which keeps the rule readable in one place.",
          "inputs": "The market_snapshots table, through the stored Supabase connection.",
          "outputs": "Every snapshot row, sorted only by the next node.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "create-a-row",
          "name": "Create a row",
          "type": "n8n-nodes-base.supabase",
          "typeLabel": "Supabase",
          "typeVersion": "1",
          "role": "storage-write",
          "step": "09 WRITE",
          "purpose": "Inserts the finished call into agent_outputs. This is the storage hand-off the dashboard reads; no later stage is invoked from inside this workflow.",
          "inputs": "The finished call row.",
          "outputs": "One row in agent_outputs, which the Dashboard Writer publishes.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 0
        },
        {
          "id": "combine-md-market-snapshot",
          "name": "Combine md & market snapshot",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "combine",
          "step": "05 COMBINE",
          "purpose": "Joins the fetched rule text with the input pack into one payload for the model. It adds no rule of its own: it only assembles what the two earlier branches produced.",
          "inputs": "The logic document and the input pack.",
          "outputs": "One prompt payload carrying the rules and the snapshot.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "build-btc-input-pack",
          "name": "Build BTC Input Pack",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "pack",
          "step": "03 PACK",
          "purpose": "Keeps the newest snapshot that carries its date, its run time and every required input field, and names the inputs that are missing. A row that fails the test is dropped rather than partially scored.",
          "inputs": "The snapshot rows from the read step.",
          "outputs": "One input pack: the chosen snapshot, its missing-input list and the run date.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "get-btc-logic-document",
          "name": "Get BTC Logic Document",
          "type": "n8n-nodes-base.github",
          "typeLabel": "GitHub",
          "typeVersion": "1.1",
          "role": "rulebook",
          "step": "04 RULEBOOK",
          "purpose": "Reads the agent's logic document from the repository. The rule text is fetched on every run, so the document is an input to the call rather than a copy of it.",
          "inputs": "The repository path of the agent's logic document.",
          "outputs": "The rule text, as a file the next node can combine.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "parse-btc-agent-output",
          "name": "Parse BTC Agent Output",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "parse",
          "step": "07 PARSE",
          "purpose": "Reads the model's answer into the row contract and flags any input the draft names as missing, so a partial reading cannot pass as a complete one.",
          "inputs": "The model's drafted reading.",
          "outputs": "A structured set of factor readings plus the missing-input flags.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "calculate-btc-conviction",
          "name": "Calculate BTC Conviction",
          "type": "n8n-nodes-base.code",
          "typeLabel": "Code",
          "typeVersion": "2",
          "role": "score",
          "step": "08 SCORE",
          "purpose": "Re-derives every factor from the raw snapshot and computes the direction and conviction deterministically. The model's own numbers are overwritten here, which is why this node is the decision and the model is not.",
          "inputs": "The raw snapshot and the parsed reading.",
          "outputs": "The call: direction, conviction, the factor signals and the missing inputs.",
          "evidence": [],
          "incoming": 1,
          "outgoing": 1
        },
        {
          "id": "when-executed-by-another-workflow",
          "name": "When Executed by Another Workflow",
          "type": "n8n-nodes-base.executeWorkflowTrigger",
          "typeLabel": "Execute Workflow trigger",
          "typeVersion": "1.2",
          "role": "trigger",
          "step": "01 TRIGGER",
          "purpose": "The orchestrator calls this agent directly. Nothing inside the agent schedules itself, and no market data arrives through this node.",
          "inputs": "A workflow invocation from the Master Orchestrator.",
          "outputs": "One empty item that starts the chain.",
          "evidence": [],
          "incoming": 0,
          "outgoing": 1
        }
      ],
      "edges": [
        {
          "from": "supabase-get-many",
          "to": "build-btc-input-pack",
          "branch": 0,
          "input": 0
        },
        {
          "from": "message-a-model",
          "to": "parse-btc-agent-output",
          "branch": 0,
          "input": 0
        },
        {
          "from": "combine-md-market-snapshot",
          "to": "message-a-model",
          "branch": 0,
          "input": 0
        },
        {
          "from": "build-btc-input-pack",
          "to": "get-btc-logic-document",
          "branch": 0,
          "input": 0
        },
        {
          "from": "get-btc-logic-document",
          "to": "combine-md-market-snapshot",
          "branch": 0,
          "input": 0
        },
        {
          "from": "parse-btc-agent-output",
          "to": "calculate-btc-conviction",
          "branch": 0,
          "input": 0
        },
        {
          "from": "calculate-btc-conviction",
          "to": "create-a-row",
          "branch": 0,
          "input": 0
        },
        {
          "from": "when-executed-by-another-workflow",
          "to": "supabase-get-many",
          "branch": 0,
          "input": 0
        }
      ],
      "joins": [],
      "branches": []
    }
  }
};
