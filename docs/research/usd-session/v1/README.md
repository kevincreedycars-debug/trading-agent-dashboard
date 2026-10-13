# USD session research programme — checkpoint 1 (2026-10-13)

Branch `research/usd-session-20261013`, cut from `orchestration/control-plane-20260920` at `c1ea8ab`.
Everything here is discovery and preparation. Nothing was deployed, published, activated, merged or sent.

## What this package contains

| File | What it is |
| --- | --- |
| `CHECKPOINT_1.md` | The first-checkpoint return in the brief's own order: inventory, target contract, exposed periods, card schema, research packages, implementation plan, blockers |
| `inventory.md` | Every input, transformation, decision rule, threshold, lookback, fallback and confidence step extracted from the live USD engine, with what is documented versus implemented versus LLM discretion |
| `session_contract_v1.json` | The 05:00 Europe/London → 17:00 America/New_York target: both zones declared separately, the as-of rule, the label instrument decision, flat handling, eligibility, scoring |
| `exposed_periods.md` | Exactly which periods and results have already been read, and what therefore cannot be called unseen |
| `research-card.schema.json` | Reusable research-card schema, asset-agnostic |
| `research_card_schema.md` | How each schema field answers a sentence of the brief |
| `assignments/` | Ready-to-send frontier-model packages: two field assignments, two independent reviewer assignments, one synthesis assignment |
| `review-issue-register.schema.json` | The artefact a reviewer returns, so objections carry severity, evidence, remedy and a falsifying test |
| `implementation_plan.md` | The build plan, the isolation mechanism, the frozen evaluation design, the experiment budget and the specific blockers |
| `isolation.md` | Why a separate branch is not enough, and what actually stops a research run writing into production |
| `research-cards/` | Card files; currently the template plus one stub, waiting on the frontier models |

## What is extracted, researched, reviewed, implemented and tested

- **Extracted** (coordinator, from the repository): the whole inventory, the target contract, the exposed
  periods, and the mapping of documented versus implemented behaviour. No frontier model is needed for this.
- **Researched**: not yet. The research cards are stubs. The two field assignments are written and waiting
  for the models the user runs externally.
- **Reviewed**: not yet. Reviewer A and Reviewer B assignments are written; neither has run, and no synthesis
  exists.
- **Implemented**: only the interfaces and guards — the session-target contract, the as-of leakage refusal,
  the research write-path guard and the card validator. **No forecasting engine exists yet**, and no
  performance number in this package was produced by a forecasting harness.
- **Tested**: 29 local assertions across three files (`npm run test:usd-session`), covering the DST edges at
  both ends, the refusal of a late observation, the refusal to write into a production path, and the card
  schema. Numbers in this package come from the repository artefacts named in each file, never from an
  estimate.

## The two open decisions this package cannot make for the user

1. The **label instrument and quote source** (`session_contract_v1.json` → `outcome_instrument`): no free
   intraday DXY print exists in this repository or in the collector, and the question of which instrument the
   call is actually about is a substantive decision. Until it is answered, the label is unverifiable at both
   ends.
2. The **frozen evaluation design**, which Reviewer B must approve before any candidate is scored. The
   proposed split, budget and sealed set are in `implementation_plan.md` §4–5 and are proposals only.
