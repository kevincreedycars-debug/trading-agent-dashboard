# Review package — USD 24h ruleset v1 and the eight-engine contract

Created 2026-10-11 by the project coordinator (Cline in VS Code) to receive the external USD handoff, run WP0/WP1
discovery against the real system, and give the reviewer a file-based return path. Nothing here is production
logic; the pipeline was not touched.

## Files

| File | What it is |
| --- | --- |
| `USD_24h_Master_Ruleset_v1.md` | Supplied specification, copied verbatim (SHA-256 `4FEF3F834DC1A30D…`) |
| `Central_Coordinator_USD_and_8_Engine_Brief.md` | Supplied implementation brief, copied verbatim (`E073FE11036766F8…`) |
| `USD_24h_Policy_Config_v1.json` | Supplied policy configuration, copied verbatim (`D42A9469A68166D1…`) |
| `discovery_report.md` | Coordinator's WP0/WP1 result: source identity, runtime liveness, eight-engine inventory, C1–C12 verdicts, blockers |
| `coordinator_status_USD-L1-WP0.json` | Machine-readable status record in the brief's suggested shape |
| `live_export_and_harness_report.md` | WP0b result: the authorised read-only n8n export, deployment identity, credential-material finding, routing trace for SILVER/WTI, and the live-versus-replay comparison |
| `live_export_identity.json` | Machine-readable identity evidence for all 45 exported workflows: ids, versions, timestamps, per-node code hashes, routing, credential bindings, sanitized hashes |
| `live-exports/` | Sanitized export of all 45 live workflows plus `manifest.json` and `scrub_report.json` |
| `usd_live_replay_comparison.json` | Per-case comparison of the exported live code, the replay implementation and the dashboard calculation, with the `layer1-confidence-map-v1` mapping per case and for the published row |
| `../..//scripts/lib/layer1_null_conversion_repair.js` | Planner and minimal-diff applier for the unavailable-versus-zero conversion repair in the eight layer 1 engines (`scripts/repair_layer1_null_conversion.js` runs it offline or against a live workflow) |
| `../..//backtester/lib/layer1_confidence_mapping.js` | `layer1-confidence-map-v1` contract: evidence shares, heuristic strength and calibrated probability mapped into three disjoint blocks, with a validator |

New tests added with those two artefacts: `tests/layer1_null_conversion_repair.test.js`,
`backtester/tests/layer1_null_conversion_profile.test.js`, `backtester/tests/layer1_confidence_mapping.test.js`.

## The reviewer's three questions, answered from this repository

1. Coordinator: Cline, running in VS Code on the canonical working folder `D:\trading-agent-dashboard-codex`, with
   the repository's own manual-file-mailbox coordination (`docs/orchestration/`). Not a Codex app-server client, so
   the Codex bridge described in the brief does not apply as written.
2. Repository: `https://github.com/kevincreedycars-debug/trading-agent-dashboard.git`. The coordinator works on
   `orchestration/control-plane-20260920`; live code and published data are on `origin/main`
   (tip `31fd44e`). Both are listed in the discovery report, including which artefacts differ between them.
3. Runtime: n8n is still live. Evidence: `origin/main:data/layer1.json` refreshed 2026-10-11T08:55:44Z with all
   eight agent rows run that morning, and the `live-trading` lane is committing M5/H1/H4 snapshots every 15
   minutes. Deployment identity is now **measured** for the USD deterministic code nodes: an authorised,
   scoped, read-only export of all 45 live workflows on 2026-10-11T18:59:54Z shows the active
   `USD Layer 1 Agent` (`OCt1tB9yVMUgFTha`, v154) carrying code nodes byte-identical to
   `exports/usd_layer1_agent.json`. See `live_export_and_harness_report.md` and `live_export_identity.json`;
   the other engine differences listed there remain unreviewed.

## Boundaries

Discovery, one authorised read-only export and a local comparison harness. No live workflow, dashboard,
database or credential value was read into this package or changed; the export used GET requests only and the
dispatcher was left exactly as found. Raw export copies stay in the ignored `tmp/live/` folder; the committed
copies are sanitized, and the sanitizer's rules and every redaction path are recorded in
`live-exports/scrub_report.json`. Claims about trading edge, causal feature timing and full historical
live/replay equivalence are out of scope here and are unanswered. The 13 harness tests prove arithmetic and
bookkeeping agreement or disagreement on eight frozen snapshots; they are not evidence of predictive accuracy.
