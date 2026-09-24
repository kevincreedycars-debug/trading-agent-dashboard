# Proposed bounded assignment: finish the 7 unmeasured drivers (user-authorized 2026-09-24)

Advisory recommendation to the coordinator. Proposed id: `gold-coverage-completion-019`.
Worker `gold-research`. Sequenced **after** `gold-qualification-window-activation-018` is accepted,
so the capture lane and scheduler are already installed and are not disturbed.

User decision recorded: on 2026-09-24, after a checked list of free sources was presented, the user
said **"measure them"**. That authorizes declaring and measuring the seven remaining drivers with
free data only. It authorizes no purchase, no formula work, no combination re-search and no change to
the frozen window or to any accepted artifact.

## Deliverable

1. **Declaration first.** In one registry/policy revision, declare each new variable with its source id,
   state rule, cutoff rule, availability rule and evidence mode, *before* any outcome is read. Retire
   (never backfill) the legacy `dxy_*` ids. Record that the live Gold F2 input is FRED `DTWEXBGS`, so
   the new dollar ids measure the actual live input rather than a relabelling of it.
2. **Measure**, using the accepted 005 measurement path, with the existing rules: state maps fixed
   before outcomes, endpoint groups never pooled, year breakdown per state, min n = 20, one-variable
   conditioning, no outcome-driven bins.
3. **Regenerate the findings digest** to cover 28 of 28 declared variables, keeping every existing
   variable block byte-identical (additive only).
4. Focused tests, one unique submission envelope, pause for review.

## Sources and proposed declared rules (all free; three of four need no key)

| New variable | Source | Proposed state rule | Availability rule |
| --- | --- | --- | --- |
| `usd_broad_index_level`, `_d1`, `_d5`, `_d20` | FRED `DTWEXBGS` (already in the accepted FRED archive) | level vs its own median; changes by sign | existing FRED vintage convention, unchanged |
| `risk_headline_context` | San Francisco Fed Daily News Sentiment Index (frbsf.org), daily since 1980 | sign of the 5-observation change, and level vs its own median | never earlier than the file's own update date; a declared conservative lag is acceptable if the update date is absent; evidence mode `proxy` |
| `equities_regime` | FRED `SP500`, daily (history starts 2016, ample warm-up for 2023-2026) | level vs its own 200-observation average | observation date plus a declared publication lag |
| `growth_regime` | Philadelphia Fed ADS business conditions index (philadelphiafed.org), daily since 1960, all-vintages file available | sign of the 3-observation change; level vs zero | use the as-of vintage for each anchor, never a later revision |

## Hard rules (same discipline as 014-018)

- Download each source once, record URL, retrieval time, byte size and SHA-256 in a manifest beside the
  raw bytes under the worker's ignored evidence area; keep the raw bytes immutable; redistribute nothing.
- Two new hosts are required, `frbsf.org` and `philadelphiafed.org`. They are key-free read-only GETs
  and are **outside** the 017 provider allowlist, so this assignment must name them explicitly. No new
  credentials; `FRED_API_KEY` stays the only one used, through the existing encrypted runner.
- Do not touch the 014/015/016/017/018 artifacts, the frozen registry, the manifest, the capture lane,
  the scheduled task or the 130-anchor plan; keep them byte-identical. Additive code, tests and docs only.
- No outcome, return, direction, sign, qualification or aggregate may be read or computed at any
  horizon for the prospective window; this batch measures the 2023-2026 archive only.
- No formula fitting, no combination re-search, no candidate ranking, no holdout use, no live,
  dashboard, warehouse, n8n or production change. One writer in the worktree.

## Acceptance

Coordinator reruns the focused tests, re-hashes the preserved artifacts, confirms the 21 existing
variable blocks are unchanged and that the seven new blocks are the only additions, and confirms the
declaration revision predates the measurement run. Stop after delivery.
