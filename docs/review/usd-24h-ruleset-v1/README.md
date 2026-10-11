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

## The reviewer's three questions, answered from this repository

1. Coordinator: Cline, running in VS Code on the canonical working folder `D:\trading-agent-dashboard-codex`, with
   the repository's own manual-file-mailbox coordination (`docs/orchestration/`). Not a Codex app-server client, so
   the Codex bridge described in the brief does not apply as written.
2. Repository: `https://github.com/kevincreedycars-debug/trading-agent-dashboard.git`. The coordinator works on
   `orchestration/control-plane-20260920`; live code and published data are on `origin/main`
   (tip `31fd44e`). Both are listed in the discovery report, including which artefacts differ between them.
3. Runtime: n8n is still live. Evidence: `origin/main:data/layer1.json` refreshed 2026-10-11T08:55:44Z with all
   eight agent rows run that morning, and the `live-trading` lane is committing M5/H1/H4 snapshots every 15
   minutes. Whether the repository exports equal the running workflows is **unproven** and needs a scoped live
   export.

## Boundaries

Discovery only. No live workflow, dashboard, database or credential was read or changed. Claims about trading edge,
causal feature timing and deployment identity are explicitly out of scope here and are unanswered in the report.
