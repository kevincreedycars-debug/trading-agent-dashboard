# Logic Documents

This directory stores the canonical logic documents for each independent Layer 1 agent.

Each Layer 1 agent must only read its own logic document and the latest usable market snapshot.

Expected files:

- `agent_usd_direction.md`
- `agent_eur_direction.md`
- `agent_gold_direction.md`
- `agent_nq_direction.md`
- `agent_btc_direction.md`

## Rule

Layer 1 logic documents define raw independent directional calls only. They must not include Layer 2 event adjustment logic or cross-agent synthesis.
