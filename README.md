# Trading Agent Dashboard

Netlify-ready static dashboard for independent n8n trading agents.

## Architecture

Layer 1:
- USD
- EUR
- GOLD
- NQ
- BTC

Each Layer 1 agent is sealed and independent. It should only write its own raw directional verdict into `data/layer1.json`.

Layer 2:
- Eco Events Agent

Layer 2 reads Layer 1 outputs plus economic event data/outcomes and writes adjusted calls into `data/layer2.json`.

## Deploy

Upload this folder to GitHub, then connect the repo to Netlify.

n8n should use the GitHub node to edit:
- `data/layer1.json` for raw agent calls
- `data/layer2.json` for event-adjusted calls
