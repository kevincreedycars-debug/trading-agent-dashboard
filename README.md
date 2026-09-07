# Trading Agent Dashboard

Static dashboard for independent n8n trading agents.

GitHub Pages URL:

```text
https://kevincreedycars-debug.github.io/trading-agent-dashboard/
```

## Working baseline

Use `D:\trading-agent-dashboard-codex` on local `main`. Start with [current state](docs/CURRENT_STATE.md) and [backtesting review plan](docs/BACKTESTING_REVIEW_PLAN.md). See the [consolidation record](docs/CONSOLIDATION_20260907.md) for branch dispositions and recovery.

For local preview, run `python -m http.server 8000 --bind 127.0.0.1` from the repository root and open `http://127.0.0.1:8000/`.

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

## Local Test Setup

This repository now includes a local Playwright-backed browser suite for the dashboard refresh workflow.

Install dependencies:

```powershell
npm ci
npm run playwright:install
```

Run all local engine, contract and browser tests (linked-warehouse mutation suites excluded):

```powershell
npm test
```

Or run the focused script directly:

```powershell
npm run test:refresh-harness
npm run test:refresh-browser
```

The browser suite currently verifies:
- refresh request lifecycle states such as `Accepted`, `Publishing`, `Delayed`, `Failed`, `Incomplete`, and `Association unverified`
- browser-local lock recovery through `localStorage`
- exact-associated vs browser-only unverified publication behavior
- operator-facing failure wording for collector and publication failures

The fast harness suite verifies the reusable fixture and mock-server helpers that support the browser workflow tests.

Reference:
- [Refresh Workflow Testing](docs/REFRESH_WORKFLOW_TESTING.md)

## Local Gold research

Open [Gold backtesting evidence](gold-backtesting.html) for the stored-call pilot and preserved daily-snapshot audit. The 6 September investigation confirmed a stale Gold history-reference defect; the prepared repair is local and unapplied. See [findings and reproduction commands](backtester/docs/gold_stored_call_pilot_20260906.md) and the [Codex progress handoff](docs/CODEX_GOLD_BACKTEST_PROGRESS.md).
