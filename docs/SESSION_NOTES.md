# Session Notes

Last updated: 2026-06-29

## Work Completed

- Audited live EUR 24H logic using `logic/agent_eur_direction.md` for factor intent and `exports/eur_layer1_agent.json` for the exact deterministic parity target.
- Confirmed the effective live EUR 24H weights are `F1 20 / F2 18 / F3 20 / F4 14 / F5 4 / F6 12 / F7 4 / F8 4 / F9 2 / F10 2`.
- Added a one-snapshot EUR live-vs-replay parity fixture and parity script.
- Brought `backtester/replay/eur/eur_replay_core.js` into exact parity with the current live EUR deterministic node.
- Confirmed EUR one-snapshot parity is passing, including factor classifications, bull/bear/neutral weights, net edge, confidence, LEAN conversion, strength, missing-input neutrality, and `NO_CLEAR_BIAS` handling.
- Generated EUR historical replay for `2024-01-02` through `2026-04-30`.
- Imported historical EURUSD data to unblock direct EUR/USD outcome evaluation.
- Confirmed EUR historical evaluation is now measurable against EUR/USD without using DXY benchmark logic.
- Set the provisional EUR-only 24H flat band to `0.15` in the EUR evaluation/checker path.
- Built the EUR deterministic checker artifact and confirmed result `602 / 0 / 0 / 0`.
- Added dashboard support for the EUR checker and EUR 24H matrix while preserving the USD views.
- Fixed the linked-warehouse Node tests so they assert stable invariants instead of brittle all-history row counts.
- Re-ran release validation successfully: Node tests, `script.js` syntax check, and EUR parity check now pass.

## Unfinished Work

- Push the EUR dashboard release to GitHub Pages.
- Monitor the public Backtest / Accuracy panel after push.
- Decide whether the next EUR research phase is historical EUR macro backfill or broader replay-window expansion.

## Blockers

- No repository-side blocker.
- No current release blocker.
- Known research limitation: incomplete historical EUR macro inputs still cap how closely some old snapshots mirror the full live environment, but they do not block direct EUR/USD evaluation or the current checker.
- Any n8n API key previously exposed in chat should still be treated as compromised and replaced if it has not already been rotated.

## Assumptions

- Canonical memory documents live in `docs/`, with `CODEX_STARTUP.md` kept at the repository root.
- `docs/ACTIVE_MILESTONE.md` is the current checkpoint only; completed milestone history belongs in `docs/CHANGELOG.md`.
- GitHub remains the source of truth, n8n remains execution, Supabase remains data, and GitHub Pages remains the active dashboard host.
- Historical research work remains downstream-only and must not change production runtime behavior.
- EUR replay semantics now match the current live deterministic export and should stay frozen until an explicit optimization phase begins.
- The EUR-specific `0.15` flat band remains scoped to EUR 24H evaluation/checker, not shared USD evaluation defaults.

## Exact Next Task

Push the validated EUR historical replay, checker, and dashboard support to the live GitHub Pages branch and verify the public Backtest / Accuracy tab renders both USD and EUR research sections cleanly.
