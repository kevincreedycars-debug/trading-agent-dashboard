# Central coordinator implementation brief
Date: 11 October 2026
Project: existing trading-analysis system with eight Layer 1 engines
Primary repair: USD Layer 1 and the shared score/data contract
Companion files: USD_24h_Master_Ruleset_v1.md; USD_24h_Policy_Config_v1.json
Status: ready for repository discovery and shadow implementation; no live changes made here

## 1. Immediate task for the coordinator

Read the current project's AGENTS.md and operating instructions first. Read these handoff files and the earlier USD_Layer1_Review_and_Research_Blueprint.md. Establish actual current code and live workflow behavior before changing it.

The user's intent is to fix USD and assess the same class of defects in seven other engines. Do not conclude that all eight share a particular defect without evidence. Deliver a verified discovery report, targeted engineering repairs, a candidate USD engine in shadow mode, and a migration plan for shared contracts.

Implement reversible repo work and meaningful tests. Use the project-approved release process for live workflow/dashboard changes. This brief calls for shadow candidate behavior initially; do not silently switch production economics.

## 2. What this handoff establishes

The prior supplied USD dossier reports:
- gpt-4.1-mini classifications are overwritten by a deterministic node;
- rulebook and export use different weights/formulas;
- F7 uses latest_us_event.usd_signal without the written age/actual-versus-consensus enforcement;
- F8 scores absolute hawkish/dovish state rather than change;
- missing inputs can shrink the score denominator and inflate winning share;
- F1/F9 repeat VIX evidence;
- exported, replayed and displayed confidence use different meanings;
- the replay parity check does not execute the exported workflow;
- five asset fixtures use incompatible confidence conventions;
- raw inputs and selection details are stripped before the output write.

These are findings from a supplied frozen dossier, not independent findings about today's deployed system. Reproduce or falsify each one against the current project and live export. Record RESOLVED_ALREADY, CONFIRMED, NOT_REPRODUCED, or UNKNOWN, with file/function/workflow-node references and versions.

## 3. Discovery package to return first

Return one archive or a repository folder containing the following, with credentials removed:

| Item | Required contents | Why |
| --- | --- | --- |
| Project identity | Repository URL, branch, full commit SHA, working tree status, relevant AGENTS.md | Anchors review to a reproducible source state. |
| Coordinator identity | Codex/Cline/custom tool name, version, launch/runtime, how tasks and responses move | Determines whether direct integration is practical. |
| Eight-engine inventory | Actual IDs/names, target series, horizons, workflow IDs, code entrypoints, rulebooks, score authority | Avoids assuming the other three asset names or sign logic. |
| Current USD workflow | Fresh n8n export if it remains the live runtime, export time, workflow ID/version, enabled state, non-secret configuration | Establishes what actually runs. |
| Runtime chain | Collectors -> snapshots -> L1 -> Dashboard Writer -> L2 -> calibration | Finds overrides and consumers. |
| Input definitions | Table schema/migrations, collector transformation code, units, providers, refresh times, publication/ingestion clocks | Finds freshness, unit and availability defects upstream. |
| Snapshot examples | At least one complete, one missing-field, one stale-event and one conflicting snapshot | Gives concrete reproduction cases. |
| Output examples | Stored USD row, dashboard serialized data and pair result for the same run/snapshot | Reveals score-semantic conversion. |
| Scoring/replay | Current source modules, fixtures, parity script, checker/evaluation code | Allows actual engine-to-replay comparison. |
| Outcome contract | Exact USD and pair price series, cutoff, endpoint, label, market-closure policy | Makes accuracy claims measurable. |
| Deployment procedure | Workflow export/import route, version checks, rollback method, environment identity | Prevents applying a repo change to the wrong runtime. |

The sample count above is diagnostic, not statistical. Historical datasets can follow after the implementation contract is understood.

Known paths from the supplied dossier, to verify rather than assume:
- logic/agent_usd_direction.md
- exports/usd_layer1_agent.json
- backtester/replay/usd/usd_replay_core.js
- backtester/lib/headline_confidence.js
- backtester/lib/layer2_pair_logic.js
- backtester/lib/confidence_calibration.js
- backtester/scripts/check_usd_live_replay_24h_parity.js
- backtester/fixtures/usd_live_replay_24h_parity_fixture.json
- data/layer1.json
- data/backtester-checker-usd-24h-2024-01.json
- relevant collector and Dashboard Writer sources, wherever they actually live.

Exclude .env files, tokens, passwords, authentication headers, private keys and credential values. Sanitise exported workflows and logs; report that credential references exist without exporting credential material. Include units, timestamps and market observations intact where possible.

## 4. Work packages and acceptance criteria

### WP0: Freeze and reproduce
Record source SHA, fresh live export hash, rulebook content hash and actual configuration. Capture an immutable representative snapshot.

Run the current export's deterministic gate, replay implementation and serialized dashboard calculation against the identical snapshot. Do not merely compare replay with a hard-coded expected fixture. Compare direction, weights, counts, evidence shares, participation, strength and all named confidence fields. Record any LLM parse failure and whether it prevents deterministic scoring.

Acceptance: a reproducible output-difference report that identifies which stage produced each number. Existing bugs are preserved in a clearly labelled legacy baseline, not hidden by changing expected fixtures.

### WP1: Eight-engine semantic inventory
For each engine discover the true score authority. Check whether prose/model/runtime/replay/dashboard differ. Record:
- conviction field meaning and numerical range;
- whether it is calibrated, and which target/horizon;
- counts versus weighted scores;
- missing-data denominator behavior;
- freshness and horizon fallbacks;
- duplicated inputs and reliance on upstream string classifications;
- whether the daily LLM verdict is used, validated, overridden or discarded.

Acceptance: eight inventory rows with evidence; UNKNOWN for inaccessible engines. Report affected consumers. The five fixtures in the earlier USD dossier are evidence to investigate, not the entire eight-engine inventory.

### WP2: Canonical contract and consumer migration
Introduce layer1-output-v2 without overwriting old rows. Add profile/versions, exact target/horizon, status, signed score, directional participation, valid-data coverage, evidence shares, risk flags and p_up_24h/calibration_version.

Prefer one pure scoring core and adapters over duplicated logic. Put factor IDs, weights, thresholds and definitions in versioned config. Generate the human factor table where feasible.

Consumer migration:
1. Add a dual-write/adapter that preserves legacy fields and adds canonical fields.
2. Update dashboard labels to evidence/heuristic/calibrated quantities explicitly.
3. Update L2 to inspect status, profile, currency/instrument and semantic compatibility.
4. Migrate calibration/outcome code by schema version.
5. Deprecate legacy conviction fields only once consumers stop depending on them.

Do not silently map the 85 raw share to the 87 headline or one asset's 0-100 score onto another's.

Acceptance: consumer-contract tests prevent mixing scales. Legacy rows remain interpretable with their original version; unversioned historical rows are LEGACY_UNKNOWN until their convention is established.

### WP3: Point-in-time input repair
Replace getAll/full-table loading with bounded indexed as-of retrieval appropriate to the actual database. Keep correctness before optimisation.

Select the latest run snapshot at cutoff. Validate each field separately against source-specific freshness and data availability. Make asynchronous as-of joins visible. Add immutable snapshot reference/hash and detailed provenance to outputs.

Eliminate silent 1d->5d and 5d->20d substitutions. Validate units and spread identities. Distinguish missing, stale, invalid, future, neutral and inapplicable.

Acceptance: missingness never renormalises the remaining evidence budget or manufactures coverage; future/revised-after-cutoff data never enters historical predictions; stale complete rows cannot silently masquerade as the current run. Removing opposing evidence can legitimately change the signed score, so do not impose a false monotonicity assertion on net direction.

### WP4: USD repair profile
Implement repair_v1 independently from legacy_frozen:
- compute/validate events from original actual/consensus/series definition;
- enforce the documented 72h event boundary as a provisional repair TTL;
- aggregate multiple releases explicitly or record conflict;
- replace absolute fed_bias vote with measurable change/structured baseline comparison;
- apply fixed-denominator evidence scoring and coverage/participation direction gates;
- use typed risk flags rather than warning text;
- record remaining legacy economic mappings and dependency limitations.

Acceptance: static hawkish state, stale CPI, one live factor, no recent release, missed release and conflicting releases all have explicit correct handling under the new specification.

### WP5: Candidate USD profile
Implement candidate_v1 according to the master document, behind a profile flag:
- Dollar Smile is a regime selector, not another VIX vote;
- VIX and cross-asset signs require registered conditional rules;
- a past release has no standalone persistence vote unless explicitly registered;
- use verified dependency clusters and flag unresolved cross-family overlap;
- give priority to relative market-priced policy repricing;
- record actual LLM contributions and validation outcomes.

Current allocations/bands are inherited or provisional experimental settings. Do not claim they are empirically optimal. Check collector availability before promising new factors. An unavailable factor remains unavailable; no invented data.

Acceptance: candidate outputs are stored separately and trade_eligible=false in shadow mode. The candidate remains reproducible with supplied LLM interpretation outputs; deterministic arithmetic is identical in runtime and replay.

### WP6: Layer 2 and evaluation
Existing exact BULLISH/BEARISH and opposite-leg requirements can remain as part of the current strategy, but add canonical status/profile checks. If the project changes that strategy, make it a separate labelled change.

min(target,USD) is not a calibrated pair-success probability. Preserve it only as an explicitly labelled heuristic using compatible inputs. Pair calibration must predict the actual specified pair outcome; target and USD targets are not interchangeable.

Audit the recorded target-side checker outcome: verify it is genuinely the intended pair-market return, with the same start/end timestamps. Do not assume it is wrong because it is stored under a target engine, or right because it is labelled “pair”.

Acceptance: pair outcome series/quote orientation is explicit. No confidence mixing, no shadow candidate trade firing and no multi-horizon result passed into a 24h gate without an adapter.

### WP7: Research, testing and promotion
Build a per-family evidence registry and preserve counterevidence. Research additional returns after cutoff rather than simply showing contemporaneous market impact. Run chronological walk-forward comparisons and ablations; purge overlapping 24h labels.

Compare legacy, repaired and candidate outputs on identical valid forecasts, then show coverage differences separately. Do not select only successful candidate forecasts or only days both models traded. Estimate uncertainty using distinct/clustered outcomes rather than 604 overlapping rows as independent trials.

Use prospective shadow results to complement historical LLM tests. Pre-register promotion criteria, rollback and release version. Engineering parity, empirical edge and probability calibration are three separate acceptance claims.

Acceptance: named evaluation report, untouched holdout, reproducible dataset availability rules and stated limitations. No new calibrated percentage until the model exists and is validated.

## 5. Eight-engine audit matrix template

| Actual engine ID | Target / quote orientation | Rulebook / runtime / replay | Conviction meaning | Freshness / missingness | Overrides / duplication | Finding / fix scope |
| --- | --- | --- | --- | --- | --- | --- |
| USD | Discover and verify | Discover and verify | Discover and verify | Discover and verify | Discover and verify | Primary detailed repair |
| Engine 2 | Discover | Discover | Discover | Discover | Discover | Audit first |
| Engine 3 | Discover | Discover | Discover | Discover | Discover | Audit first |
| Engine 4 | Discover | Discover | Discover | Discover | Discover | Audit first |
| Engine 5 | Discover | Discover | Discover | Discover | Discover | Audit first |
| Engine 6 | Discover | Discover | Discover | Discover | Discover | Audit first |
| Engine 7 | Discover | Discover | Discover | Discover | Discover | Audit first |
| Engine 8 | Discover | Discover | Discover | Discover | Discover | Audit first |

Common infrastructure can share schema, source timing, reproducibility, validation, score semantics and calibration machinery. Asset-specific economics must retain distinct factor definitions, units, sign rules, market calendars and target outcomes. USD-up does not mean Nasdaq-up or gold-up; crypto may run seven days while FX does not. Verify each instrument calendar.

A shared-core change needs contract tests against every engine adapter before rollout. An USD-only rule change should not automatically edit seven other rulebooks.

## 6. Coordinator response protocol

Return evidence in files, not “done” messages:
- discovery_report.md: current source identity, inventory, reproduced issues and remaining unknowns;
- remediation_plan.md: affected paths, migration order, economic versus engineering changes;
- diff/branch/PR reference: concrete source modifications;
- test_report.md: commands, exit status, meaningful assertions and representative before/after rows;
- shadow_comparison.json: same snapshot across frozen/repair/candidate, with schema/version;
- deployment_status.md: what is in repo, what is actually live, and rollback identity.

Suggested status record:
```json
{
  "task_id": "USD-L1-WP0",
  "status": "DISCOVERED",
  "repo_commit": "<actual full SHA>",
  "live_export_hash": "<actual hash or null>",
  "claims": [
    {
      "issue": "F7 event age",
      "finding": "CONFIRMED",
      "evidence": ["<actual path:function or workflow node>"],
      "reproduction": "<actual fixture/test reference>"
    }
  ],
  "blockers": [],
  "next_work_package": "WP1"
}
```
Example only: replace every placeholder with actual evidence. The task ID is a proposed local tracking label, not an existing project ticket.

## 7. Communication with this reviewer

### Available immediately: file handoff
Save these files into a project docs/review folder. Have the coordinator read the brief and return the discovery package here. This works with Codex, Cline or a custom coordinator. It requires no live integration.

### Best ongoing route when the project is on GitHub
Supply the repository URL, branch and coordinator's response-file paths. This session has GitHub tools available. Actual repository permissions and visibility must be verified once the target is supplied. Use a dedicated review folder/branch and versioned response files; this reviewer can inspect that shared evidence. GitHub access alone does not connect to the local VS Code agent or live n8n state, and it does not provide uncommitted local changes.

No repository URL was supplied in this request; this reviewer has not accessed a project repository or sent tasks to the central coordinator.

### Optional later: custom agent bridge
First identify the coordinator technology and supported interface. An actual message bridge needs an authenticated reachable interface, callable tools in this chat, task IDs, evidence payloads and response persistence. A localhost URL on the user's PC is not reachable from this cloud workspace.

If the coordinator is Codex-based, official documentation describes the Codex app-server protocol for custom clients and conversation/event exchange. That is an engineering integration, not an automatic pairing of this chat with an existing VS Code thread. The docs currently label app-server/WebSocket transport experimental and unsupported for production workloads. The retired codex mcp-server command is not the current route.

If the coordinator is Cline/custom, use that runtime's actual supported interface; do not impose a Codex protocol without checking compatibility. A local API-backed review process can be built, but it is a separate runtime and will not automatically inherit this chat's tools/history. Its context and file contract must be supplied explicitly.

Do not expose an unauthenticated local coordinator listener. Keep credentials in the runtime's secret configuration. A direct bridge should be scoped to sending review tasks and returning evidence; live deployment actions need the project's own access and release controls.

Official references checked 11 October 2026:
- https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/mcp-server

## 8. First message to give the coordinator

Read USD_24h_Master_Ruleset_v1.md, USD_24h_Policy_Config_v1.json and this brief. Treat the specification as a proposed shadow implementation. Verify the current project and live workflow before editing production logic. Complete WP0 and WP1 first: export the current USD workflow, identify the actual eight engines, reproduce score-semantic/freshness/Fed/event issues, and build the sanitised discovery package. Then proceed with reversible repository fixes and meaningful tests under project instructions. Keep engineering repairs separate from economic-model changes, preserve the frozen baseline, and return source references, diffs, test results and deployment status. Do not claim all eight engines are defective without evidence, reuse a confidence field for a new meaning, or activate the candidate for trades during shadow mode.

## 9. What the user needs to provide now

Minimum first response:
1. Which coordinator runs in VS Code: Codex extension/CLI, Cline, or custom?
2. Repository URL and branch, or the coordinator-generated sanitised discovery archive.
3. Whether n8n is still the live execution environment and whether the exported repo workflows match it.

The coordinator can discover asset names, target series, schemas and code paths from the project. The user does not need to explain those manually first. If information is absent from code/config, return a short unresolved-decision list, including the USD target and forecast timing, for user resolution.

