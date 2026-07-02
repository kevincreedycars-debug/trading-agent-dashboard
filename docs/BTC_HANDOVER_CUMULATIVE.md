# BTC Historical Replay Handover

## Purpose

This handover is for the next historical replay build after USD, EUR, Gold, and NQ.

BTC must not be treated as an isolated new asset. The correct build process now depends on the lessons already learned from the full rollout sequence.

Objective:

> reproduce exactly what the live Layer 1 BTC agent would have displayed historically, then evaluate accuracy downstream without changing live semantics

---

## Non-Negotiables

1. Audit live BTC first.
2. Treat the exported workflow and live deterministic node as the source of truth if docs differ.
3. Do not optimise logic.
4. Do not redesign architecture.
5. Do not trust dashboard output until replay -> evaluation -> checker -> dashboard validation passes end to end.
6. Keep research downstream-only. Do not change live Layer 1 behavior during replay work.

---

## Lessons From USD

- Live workflow parity must be proven separately from replay reproducibility.
- A checker that only proves replay-vs-replay consistency is not enough.
- Freeze a one-snapshot live-vs-replay fixture before scaling out the historical range.
- Historical evaluation and dashboard work should only begin after the parity gate passes.
- Source-of-truth order matters:
  exported workflow/live output first, docs second, replay code third.

---

## Lessons From EUR

- Do not assume the benchmark from the asset label alone.
- Confirm the primary evaluation market explicitly before coding.
- Use direct market evaluation when the live asset is effectively expressing that exact benchmark.
- Dashboard matrix buckets must use displayed headline confidence, not raw conviction, when the live display semantics differ.
- Asset-specific flat bands are allowed when validated downstream and scoped narrowly.

---

## Lessons From Gold

- Historical replay can be intentionally scoped to the parity-validated 24H path first when that is the trusted research path.
- Checker validation must prove the full chain:
  replay -> outcome evaluation -> stored artifact -> dashboard rendering
- Browser smoke should confirm the dashboard still renders when ancillary research views fail.
- Do not treat dashboard availability as proof of trusted data. Trust comes from checker PASS with zero fail, zero missing, zero tolerance.

---

## Lessons From NQ

- Live display examples can reveal important semantics that are easy to miss if you only read the markdown logic doc.
- Null handling must stay null. Do not coerce missing inputs to `0`.
- Cross-asset confirmation lookbacks may differ from the obvious short-term field names. Audit the live output evidence, not just the snapshot payload.
- The deterministic node can contain practical live semantics that are stricter or narrower than the prose doc.
- If the research warehouse/timeframe model does not cleanly support a live secondary timeframe, do not fake it. Persist only the trusted canonical research path and keep full live-style output inside the raw replay output.
- Flat-band sensitivity queries must be validated against the real evaluation table shape; an empty result is a bug, not a successful sensitivity run.

---

## BTC Build Order

1. Audit live BTC
2. Confirm BTC benchmark convention
3. Build one-snapshot parity fixture
4. Build BTC parity script
5. Require parity PASS before historical replay
6. Build BTC replay
7. Build BTC outcome evaluator
8. Run flat-band sensitivity
9. Build deterministic checker artifact
10. Wire BTC matrix/checker into dashboard
11. Run browser smoke
12. Run regression checks for USD, EUR, Gold, and NQ
13. Commit and push only after validation passes

---

## BTC Audit Checklist

- `logic/agent_btc_direction.md`
- exported BTC workflow JSON
- deterministic conviction node
- dashboard display logic
- current live Supabase/dashboard BTC output examples
- benchmark convention
- confidence semantics
- missing-input behavior
- no-call behavior
- weekday/weekend evaluation rules

BTC is the one asset where weekend handling is expected to differ from USD/EUR/Gold/NQ.
Do not inherit weekday-only rules from the other assets without proving that live BTC and the evaluation model require them.

---

## Confidence Rules

- Use canonical headline confidence only via `backtester/lib/headline_confidence.js` whenever dashboard/checker bucketing is based on displayed confidence.
- Do not mix replay raw conviction with displayed headline confidence.
- Preserve raw live conviction semantics inside replay output when the live asset exposes them.
- Store and compare the displayed headline confidence explicitly when the dashboard is meant to display that value.

---

## Validation Standard

Required validation before BTC is trusted:

- syntax checks
- BTC live-vs-replay parity PASS
- replay run succeeds
- outcome evaluation run succeeds
- flat-band sensitivity returns real rows
- checker artifact build succeeds
- checker validation returns PASS / 0 fail / 0 missing / 0 tolerance
- dashboard/browser smoke passes
- USD/EUR/Gold/NQ regression checks still pass

---

## Implementation Notes For BTC

- Confirm the BTC primary evaluation market before writing any evaluation code.
- Confirm whether BTC uses direct `BTCUSD` evaluation only, and whether any contextual markets are dashboard-only diagnostics.
- Confirm weekend treatment from both the live asset and `backtester/docs/historical_outcome_evaluation.md`.
- Confirm whether BTC dashboard confidence buckets should use displayed headline confidence or raw conviction.
- Confirm whether any BTC factor families use longer-lookback confirmation fields in 24H mode, as NQ did.
- Confirm missing-input fields from real live output examples, not from assumptions.

---

## Exit Condition

BTC is ready only when:

- parity passes
- checker passes cleanly
- dashboard renders BTC correctly
- regression checks stay green
- the resulting work is committed and pushed

Until then, BTC research output is provisional and must not be treated as trusted.
