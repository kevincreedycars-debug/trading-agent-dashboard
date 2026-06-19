# Trading Agent Dashboard

Static dashboard for independent n8n trading agents.

GitHub Pages URL:

```text
https://kevincreedycars-debug.github.io/trading-agent-dashboard/
```

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

## Static Site

The dashboard is served directly from the repository root:

- `index.html`
- `styles.css`
- `script.js`
- `data/layer1.json`
- `data/layer2.json`

## Deploy

GitHub Pages can serve this repository as a root static site from the `main` branch.

Dashboard Writer already uses the n8n GitHub node to update `data/layer1.json` in this repository, so GitHub Pages can replace Netlify hosting without changing the n8n workflow.

n8n should use the GitHub node to edit:
- `data/layer1.json` for raw agent calls
- `data/layer2.json` for event-adjusted calls
