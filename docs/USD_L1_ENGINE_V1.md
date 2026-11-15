# USD Layer 1 engine v1 - the frozen rulebook and its one decision engine

Research only. Nothing in this milestone reads the network, the warehouse, the dispatcher or a production path,
and a green replay is not evidence of live deployment, causal feature timing or trading edge.

## What is frozen

- `config/usd_l1_factor_rulebook_v1.json` - 25 rows (11 direction, 6 counted elsewhere, 2 excluded, 2 event
  missing, 2 calendar window, 1 inactive, 1 gate), 10 interaction rules IR-1 to IR-10, 3 open judgements
  OJ-1 to OJ-3, and an age profile for every staged input.
- `config/usd_l1_decision_rules_v1.json` - the arithmetic: family means, the 0.20 deadband, bands 1 to 5, the two
  band caps, the eligibility minimums (6 signals, 4 families) and the provisional trade rule. The book points at
  this file by path and version and does not restate any of it.
- `backtester/lib/usd_layer1_backtester/factor_rulebook_v1.js` - loads the book, joins the audit plan's names and
  the registered adjudication verdicts onto each row, and refuses to load a book that fails 13 named checks.
- `backtester/lib/usd_layer1_backtester/factor_access_v1.js` - reads a morning: one state per row
  (`valid_unchanged`, `verified_absent`, `missing_or_stale`, `not_read`), the coverage that adds up to, and the
  rows whose absence is a blocker. A derived series takes the age of its oldest leg; an event row with no release
  before the cutoff is absent, never filled.
- `backtester/lib/usd_layer1_backtester/engine_v1.js` - one `decide()` for both paths, six checks in one order.
- `backtester/scripts/run_usd_l1_engine_v1.js` - replay of the checked-in run artefact through that engine.
- `backtester/scripts/run_usd_l1_shadow_decision.js` - the shadow entry point the n8n workflow calls.
- `automation/n8n/usd-l1-shadow-decision.workflow.json` - inactive workflow: 05:05 London, decide, split.

## The six checks

| check | fails | because |
| --- | --- | --- |
| E1 cutoff | blocked | the morning is not the 05:00-London session, or a reading is stamped after its cutoff |
| E2 gate | blocked | the RG-4 volatility gate is closed or undefined at the cutoff |
| E3 provenance | blocked | a vote has no single direction owner, or its owner may not vote this morning |
| E4 coverage | blocked | fewer than 6 signals or 4 families are readable |
| E5 call | abstained | the family vote sits inside the 0.20 deadband or nets exactly zero |
| E6 trade | abstained | the provisional trade rule is not met (event family, all twelve signals, band >= 3) |

Blocked is a refusal: the engine emits nothing rather than explaining a gap away. Abstained is a decision: the
data was good enough and the book chose not to call. Every refusal, abstention and band cap is written into
`fired_rules`, and each entry carries the factor ids and the interaction rules (IR-n) that bind them.

## The replay record

`data/usd-layer1-backtester/engine-v1.json` (725 mornings, 2024-01-02 to 2026-10-12) holds the summary, the
per-factor access roll-up, four assertions, one worked morning kept whole, and the fired-rule log for every
morning. `node backtester/scripts/run_usd_l1_engine_v1.js --check` fails if a fresh replay differs from the
committed file or if an assertion fails. The four assertions are invariance against `decision_rules_v1` on every
morning, six checks in the declared order, no silent refusal, and a full trace on the worked morning.

## The finding this milestone records

The book's frozen `fred_daily` age of 4 business days is stricter than the run's own per-input freshness. The
H.10-derived legs (broad dollar, USD/JPY, USD/CHF) carry a 5 to 6 business-day print lag on roughly 40 per cent of
mornings, so `live.f5-dxy-delta` and `risk.usd-safe-haven-demand` are `missing_or_stale` there, and the engine
blocks rather than voting them (E3 refused 297 mornings). The RG-4 gate is closed on 373 mornings and undefined on
31 (E2). Together the replay is 41 allowed, 541 blocked and 143 abstained. That is the fail-safe working as frozen,
not a defect: raising the age, moving those legs to the intraday tape, or accepting fewer voters is a rulebook
version change, decided on evidence, not a quiet tolerance bump inside the engine.

## Reproduce

```
npm run test:usd-layer1-engine        # 29 tests: the book and the engine
npm run backtest:usd-l1-engine        # rewrite data/usd-layer1-backtester/engine-v1.json
npm run check:usd-l1-engine           # fail if the committed record is stale
npm run shadow:usd-l1 -- --sealed <sealed.json>   # one shadow morning, stdout only
```

The shadow path stages nothing by itself: a sealed collection without a `readings` block (values plus print
stamps) and without votes is reported as unstaged and the engine blocks it. Turning provider payloads into book
inputs is the collector's job and is deliberately not reimplemented in the shadow entry point.
