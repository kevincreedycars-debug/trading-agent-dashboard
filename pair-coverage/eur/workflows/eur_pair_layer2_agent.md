# EUR Pair Layer 2 Agent (DRAFT)

## Purpose

Derive Layer 2 pair trade selection for the six EUR pairs that are not EUR/USD
(EUR/GBP, XAU/EUR, XAG/EUR, WTI/EUR, NQ/EUR, BTC/EUR) from the latest Layer 1
`agent_outputs` rows, and publish `data/layer2.json`.

This is a reviewable DRAFT (see `pair-coverage/eur/exports/eur_pair_layer2_agent.json`);
it is not deployed or activated.

## Layer rule

Layer 2 combination only. This workflow must not feed its output back into any
Layer 1 agent, and it must not read another agent's interpretation as its own
input. Layer 1 assets remain sealed and independent.

## Trigger

- `Execute Sub-workflow Trigger` ("When Executed by Another Workflow").
- Draft status: no schedule, `active: false`.

## Inputs

Supabase `agent_outputs`, `layer = 1`, newest row per agent
(`orderBy created_at desc`, `limit 20`):

- `EUR`, `GBP` (EUR/GBP legs)
- `GOLD`, `SILVER`, `WTI`, `NQ`, `BTC` (base legs of the EUR-quoted crosses)

## Outputs

A single `data/layer2.json` commit shaped exactly like the live USD-pair producer
(`layer_2_trade_selection_agent`):

- `dashboard_meta.last_updated_et`, `dashboard_meta.source`
- `trade_opportunities[]`: `instrument`, `direction` (`BUY`/`SELL`), `confidence`,
  `reason`, `rank`
- `avoid_today[]`: `instrument`, `reason`

## Key nodes

1. `When Executed by Another Workflow`
2. `Get latest EUR rows` / `Get latest GBP rows` / `Get latest GOLD rows` /
   `Get latest SILVER rows` / `Get latest WTI rows` / `Get latest NQ rows` /
   `Get latest BTC rows` (Supabase reads)
3. `Code | Build EUR Pair Layer 2 JSON` (quote-agnostic combination)
4. `Write data/layer2.json to GitHub`

## Difference from the live USD-pair producer

The live `exports/layer2_trade_selection_agent.json` hardwires the quote asset
(`const usd = calls.USD;`, pair list `EUR/USD`, `XAU/USD`, `BTC/USD`, `NQ/USD`).
This draft takes `quote` per pair from the pair list, so the same semantics serve
EUR, GBP and USD quotes. Direction normalization, the 60 conviction floor, the
rounded-average confidence, the avoid reasons and the ranking are unchanged, so
USD-quoted output would be byte-identical.

## Data requirements and availability

- Requires a fresh, usable Layer 1 24H direction **and** conviction for both legs.
  A missing conviction, a non-directional leg, or a leg below 60 blocks the pair.
- The pair's **base asset** session governs live eligibility. `BTC/EUR` is the only
  cross that can trade at a weekend; the rest are suppressed while their market is
  closed. See `pair-coverage/eur/eur_pair_logic.md`.

## Known issues / gaps

- Draft only. No credential binding is embedded; the GitHub and Supabase nodes must
  be bound to the existing project credentials at import time.
- Requires `SILVER` and `WTI` Layer 1 agents to exist before `XAG/EUR` and `WTI/EUR`
  can produce anything other than a blocked result.
- Contract tests do not establish provider coverage, historical validation or
  executable profitability.

## Last verified status

- 2026-09-12: draft JSON shape, node contracts, quote-agnostic code and adapter
  parity validated by `tests/pair-coverage/eur/eur_pair_workflow_draft.test.js`.
  Not deployed, not executed in n8n.
