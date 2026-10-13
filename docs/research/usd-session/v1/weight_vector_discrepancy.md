# The two live weight vectors (2026-10-13)

Answering the brief's question 3: where each vector is stored, which calculation uses it, what the dashboard
consumes, and what "both are live" means precisely. Nothing here is a proposal and nothing was changed:
no workflow, no node, no rulebook, no configuration, no dashboard file.

## 1. Where each vector is stored

| Vector | Stored in | Read by | Changed by |
| --- | --- | --- | --- |
| **Coded weights** (the arithmetic) | `exports/usd_layer1_agent.json`, node `Calculate USD Conviction`, the `WEIGHTS` literal, one object per timeframe | the JavaScript node, in the deployed USD workflow `OCt1tB9yVMUgFTha` (measured at v154 on 2026-10-11) | redeploying the workflow |
| **Rulebook weights** | `logic/agent_usd_direction.md`, section 4 weight table (version 2.1) | the model, as part of its prompt: node `Get USD Logic Document` fetches this file live from GitHub on every run and `Combine md & market snapshot` joins it to the day's inputs | a commit to the file on the branch the node fetches |

The 24-hour row of the coded vector, quoted exactly:

```
"24h": { F1: 10, F2: 14, F3: 10, F4: 10, F5: 14, F6: 4, F7: 24, F8: 12, F9: 1, F10: 1 }
```

The rulebook's own table, quoted exactly: `F1 10, F2 14, F3 16, F4 14, F5 6, F6 5, F7 3, F8 18, F9 12, F10 2`.
Same total, 100; six of the ten rows differ; the largest single gap is F7 at 24 coded against 3 in the rulebook,
with F8 at 12 against 18 and F5 at 14 against 6 the next largest.

The coded literal carries four timeframes (`24h`, `3d`, `current_week`, `next_week`); the rulebook publishes one
table. A third file exists but is **not** live: `config/usd_24h_ruleset_v2.json` is `CANDIDATE_SHADOW_ONLY`,
`production_enabled` false, and has never run in n8n.

## 2. Which calculation actually uses which vector

The published number is produced by the code path only:

1. `Parse USD Agent Output` turns the model's per-factor verdict strings into one state per factor
   (`BULLISH` / `BEARISH` / `NEUTRAL` / missing). Those strings are the model's output, and the model read the
   rulebook's table while writing them.
2. `Calculate USD Conviction` applies the **coded** weights to those states: `bullish` and `bearish` are the
   sums of the weights of bullish and bearish factors, `active = bullish + bearish`,
   `bullishArgument = round(bullish / active * 100)`, `netEdge = bullishArgument - bearishArgument`, direction
   is the larger side (`_LEAN` when the absolute net edge is below 20, `NO_CLEAR_BIAS` on an exact tie), and
   `conviction` is the winning argument percentage.

So the split is exact and both halves are load-bearing: **the rulebook's weights never enter the arithmetic, but
they are read by the model that produces the verdicts the arithmetic consumes.** A rulebook row that tells the
model F7 is worth 3 points while the code weights it at 24 is not inert; it is a different prior feeding the
same decision.

Consequences worth stating plainly:

- Conviction is a **share of active evidence**, not a probability, and it can read 100 per cent while half the
  weight is missing, because missing inputs fall to the neutral pile rather than into `active`.
- With the coded vector, `NO_CLEAR_BIAS` cannot occur: ties are impossible for the stated 24h weights, so the
  branch is unreachable by construction.
- Three rulebook rules are documented but not implemented (the VIX 1d/5d modifiers and the conflict rule, F8 as
  a delta, the participation cap / missing-input penalty / conflict penalty / agreement boost, which the code
  hard-codes to 0). A model reading the rulebook will reason about machinery that does not execute.

## 3. What the dashboard consumes

The dashboard never reads a weight vector. The path to the screen is:

```
Calculate USD Conviction -> Create a row (Supabase agent_outputs)
  -> Build Layer 1 JSON -> data/layer1.json -> dashboard 24H tiles, conviction, confidence, strength band
  -> data/layer2.json (Layer 2 adjustment) -> Pair Analysis
```

`data/layer1.json` and `data/layer2.json` are published artefacts the live pipeline refreshes directly on
`main`. The weights are not exposed in any panel, in `data/architecture-map.json`, or on the Backtest /
Accuracy surface, so a reader cannot tell from the dashboard which of the two vectors produced a call.

## 4. What "both are live" means, precisely

- Both files are read, on every run, from live locations: the node code from the deployed workflow, the
  rulebook from GitHub at the moment of the run. Neither is a shadow copy, a fixture or a draft.
- Both are authoritative for different things: the code for the published number, the rulebook for the
  model's reasoning and verdicts.
- There is **no reconciliation step** anywhere: no test, no workflow node and no checker compares the two, so
  a future edit to either file silently changes behaviour, or reasoning, with nothing to catch the divergence.
- The practical reading: the published call is defensible as the code's output, and the rulebook is
  documentation the model is instructed by its own prompt to follow. Where they disagree, the code wins the
  number while the rulebook may still shape the verdict.

## 5. Preserved as two identifiable research baselines

Both vectors are preserved, unmodified, as separate named baselines, so a later comparison can name which one
it used:

| Baseline id | Content | Where |
| --- | --- | --- |
| `weights.coded.24h.v154` | `F1 10, F2 14, F3 10, F4 10, F5 14, F6 4, F7 24, F8 12, F9 1, F10 1` | `exports/usd_layer1_agent.json`, node `Calculate USD Conviction` |
| `weights.rulebook.v2.1` | `F1 10, F2 14, F3 16, F4 14, F5 6, F6 5, F7 3, F8 18, F9 12, F10 2` | `logic/agent_usd_direction.md`, section 4 |

Both are also registered in the Research Library catalogue as the live-engine factor family, so the coded and
rulebook weight of every factor are shown side by side in the dashboard rather than buried in two files. The
catalogue records a hash of the checkout copy of the rulebook and states that the workflow fetches the file
live, so a checkout copy is evidence of the text but not proof of what was read on a given day.

Nothing was changed by this work. Which vector is the project's own, or whether the rulebook is edited to match
the code or the reverse, remains the user's decision, and it is recorded in the Research Library as an open
blocker on the `live.f5-dxy-delta` and `live.f7-economic-surprise` factors.
