# Astra audit of USD research prompts v3.2.0

Date: 2026-11-02. Scope: the 78 canonical USD stage prompts authored by the integrated `scripts/build_research_library.js`: 25 factor chains with research, red-team and adjudication, followed by three asset-level stages. This is an audit of instructions, not generated research, an adjudication of existing reports, a backtest or a deployment.

Governing input: [USD North Star Model Contract v2.0](USD_North_Star_Model_Contract_v2.md), SHA-256 `e39e13098829fd2f61e53a8430277bcbf04ba103b8ef9f93b914847c19e8369f`. The supplied contract describes itself as proposed; using it for this authorised prompt audit does not approve production changes or the later automation phases it describes.

The authoritative starting point was the integrated v3.1.0 generator in the isolated checkout at base `2be1226`, not the older template module in the outer research worktree. The audit inspected the complete generator, all six rendering functions, shared requirements, the 25 authored factor-question sets and their topic context. Coverage is established through those render paths and factor mappings, then checked on the generated outputs by the local verification work. It does not claim 78 independent research investigations.

## Findings and implemented remedies

1. **The earlier weekday study was presented as the governing universal horizon.** Every prompt asserted exactly 24 elapsed hours and unconditional Monday-to-Friday eligibility. The v2 interval instead resolves both 05:00 London endpoints independently on successive local dates. The shared session section now requires IANA resolution, UTC endpoints and offsets, identifies earlier weekday eligibility as provisional, retains Friday-to-Saturday endpoints, and prohibits Monday substitution or filling absent quotes. Remaining references to “24-hour” are explicitly shorthand, not elapsed-time arithmetic. The shared catalogue objective and chain question now use the defined session. Earlier historical briefs and legacy task details remain historical records.

2. **Contract identity was not pinned.** All 78 prompt frontmatters now carry contract version, repository path and SHA-256, distinguish new requirements from historical assignments and describe honest handling of inaccessible or mismatched copies. The catalogue carries the same provenance and `buildChains()` checks the actual contract bytes. The prompt template version is `research-prompt-v3.2.0`; the existing per-stage hashing path remains authoritative.

3. **Primary-source preference was explicit mainly in the VIX dispatch exception.** Every stage now requires original sources for material claims, source metadata and passage/reference traceability, honest access limitations and strongest opposing evidence. Red-team duties explicitly require an independent search beyond the author's bibliography. Adjudication must tie decisions to claims, objections, parent versions, sources and reasons, rather than count agreement as evidence. A later v2 coverage gap in a historical report is distinguished from an erroneous claim in that report.

4. **Publication, availability and ingestion were too easily collapsed.** The common ledger distinguishes reference/observation time, scheduled and actual release, first publicly obtainable time, vendor dissemination, local ingestion and vintage/revision. It separates information publicly available before cutoff from information actually possessed by the operational system. Revised historical series, undated consensus and assumed publication lags cannot establish causal feature timing.

5. **Regimes and events were named unevenly.** Every stage now explicitly considers inflation, growth, labour, monetary-policy expectations, relative international policy, liquidity/funding stress, risk appetite and crises. Every stage checks relevance of CPI, PCE, NFP, FOMC, GDP, retail sales, ISM and ECB decisions, with release-level detail for macro/calendar factors and relevant conditional channels or justified non-applicability elsewhere. This does not demand a new factor for each item. Unscheduled shocks are a separate uncertainty class. The tailored factor questions below retain distinct responsibilities and flow into all three stages.

6. **Forecast identity and post-release research were underspecified.** Prompts now preserve original issue/target times, snapshots, model and prompt versions, evidence, direction/abstention and confidence. Post-release shadow forecasts and alternative horizons have separate timestamps, snapshots and scored cohorts. Event infrastructure instructions require inventory and code evidence before asserting the event-to-snapshot-to-model path; proposals reuse existing collection and name completeness, vintage, deduplication, cooldown, rate-limit, market-hours and stale-data safeguards. No pipeline, trigger or trading change is authorised.

7. **Evidence stages could be mistaken for empirical validation.** Stage 1 proposes mechanisms, measurements and falsifiable tests; stage 2 challenges independently; stage 3 records traceable decisions, including exclusion, regime-only findings, insufficient evidence and no incremental value. None requires running a new backtest. All stages specify downstream walk-forward/out-of-sample design, untouched holdout, exposure records, baselines, ablations, uncertainty and multiple-testing controls. Directional accuracy, coverage and confidence calibration remain separate from L2L outcomes under their own execution, costs and risk contract.

8. **A “complete candidate” could pressure the final stage to invent thresholds or weights.** Unsupported numeric choices now stay named unresolved parameters with required evidence and fail-closed blockers. A supported candidate value needs provenance and remains unvalidated until tested. Final adjudication can conclude that no executable candidate is supported while still returning the complete decision/gap specification in the required final section. No positive result is mandatory.

9. **Final synthesis lacked a concrete completeness audit.** Each final stage now maps all named regimes and events to factor ids, adjudicated claims and supported/rejected/missing/not-applicable outcomes. The dependence map covers shared data, transformations, common causes, mediators and interactions. Downstream portfolio exposure and common-shock consistency are considered without transferring USD signs or weights to other assets and without coupling independent Layer 1 calls.

10. **Several probes embedded questionable assumptions.** The F2 probe now asks actual DGS2 availability rather than asserting a fixed lag. F7 distinguishes consensus archived before release from the actual first print published at release. F6 asks whether the claimed gold instrument, provider and trading hours can be verified rather than assuming 24/7 gold from a provider name. The macro topic allows revisions legitimately known by cutoff, keeping first-release surprise and revision-news tests distinct. Data exclusions and model abstentions are explicitly separated. The volatility gate now explicitly requests coverage-matched and always-call comparisons.

## Stage responsibilities and coverage

| Stage | Count | Required outcome after this audit |
|---|---:|---|
| `research` | 25 | Primary-source mechanism/measurement research, conditional hypotheses, contrary evidence, point-in-time ledger and proposed falsification tests; no new backtest required. |
| `red_team` | 25 | Independent source verification and omitted-source challenge, alternative explanations, leakage and multiplicity scrutiny, and a verdict for each load-bearing claim. |
| `adjudication` | 25 | Traceable claim/objection decisions, surviving conditions, exclusions and unresolved evidence, without manufacturing validation. |
| `final_analysis` | 1 | Synthesis of all adjudications with source traceability, dependence map, conditional regime/event completeness and proposed downstream comparisons. |
| `final_red_team` | 1 | Independent challenge of source evidence, dependence, programme-wide multiple testing, omitted regimes/events, and improper Layer 1 coupling. |
| `final_adjudication` | 1 | Final traceable decisions and candidate/gap specification, with unresolved parameters, fail-closed blockers and a separate downstream OOS evaluation plan. |
| Total | 78 | One Markdown document per stage; no research output was generated by this audit. |

Each prompt also asks for a coverage checklist inside its one Markdown return: addressed, partial, not applicable with reason, or blocked with missing evidence. Missing or truncated required sections cannot be declared complete. A properly documented negative result is valid; lack of source access is visible rather than disguised as completed verification. This is an instruction requirement, not a claim that an automated content validator has been implemented.

## All 25 factor scopes

Each row was audited across research, red-team and adjudication (3 prompts per row, 75 total). Existing factor identities, topic ownership, stage order, dependencies, prompt paths and distinct original questions remain intact except for the specific assumption corrections above. Each factor receives one additional tailored question; shared regime/event requirements are proportionate rather than a demand for the same essay 25 times.

| Factor id | Targeted conditional or event addition |
|---|---|
| `live.f1-vix-level` | Inflation-driven equity stress versus funding crisis, with pre-cutoff CPI/FOMC conditioning. |
| `risk.vix-level-and-change-at-cutoff` | Scheduled-event volatility premium versus unscheduled crisis shock. |
| `live.f2-us-2y-delta` | CPI/PCE/NFP/FOMC policy response across inflation and labour regimes. |
| `live.f3-us-de-2y-spread-delta` | Fed/ECB divergence with asynchronous leg availability. |
| `live.f4-real-yield-delta` | CPI/PCE repricing versus growth and TIPS liquidity. |
| `rates.us-front-end-delta` | Inflation/labour/FOMC conditioning and bill collateral effects. |
| `rates.relative-front-end-delta` | Instrument-matched international policy comparisons versus global shocks. |
| `rates.real-yield-delta` | Maturity differences and point-in-time survey/model vintages under inflation, growth and crisis shocks. |
| `rates.term-premium-and-curve` | GDP/retail sales/ISM conditioning and full-sample model leakage. |
| `rates.credit-spread-delta` | Growth/default/funding distinctions and unscheduled credit shocks. |
| `live.f5-dxy-delta` | H.10 availability, constituent exposures and US/ECB news under instrument mismatch. |
| `live.f6-gold-delta` | Inflation, real rates, liquidation and safe-haven sign changes. |
| `live.f9-dollar-smile` | Growth exceptionalism, relative weakness and crisis demand identified before outcomes. |
| `live.f10-equity-versus-usd` | Discount-rate versus growth shocks and a common-news alternative explanation. |
| `live.f7-economic-surprise` | Named releases, components, prior revisions and consensus vintages; policy shocks distinguished. |
| `live.f8-fed-bias` | Official FOMC communications and expectation-relative changes with timestamps. |
| `macro.release-surprise-at-first-print` | Named first-release pairs, revision context, normalisation using earlier data and separate post-release cohorts. |
| `fx.usd-session-momentum` | Already-released versus upcoming event news, policy divergence and crisis funding. |
| `fx.usd-overnight-range-position` | Upcoming events, thin liquidity and pre-cutoff range/regime freezing. |
| `fx.usd-session-volatility-regime` | Scheduled-event versus crisis risk and coverage-matched abstention tests. |
| `risk.usd-safe-haven-demand` | Global funding crises versus US-specific confidence shocks and relative carry. |
| `risk.risk-on-off-cross-asset-state` | Growth/inflation/liquidity patterns and asynchronous composite inputs. |
| `calendar.known-releases-between-cutoff-and-endpoint` | All eight named releases, existing calendar vintages and separate shadow design. |
| `calendar.days-since-and-until-high-impact-events` | Rescheduling, time zones, revisions and positioning measured independently of later prices. |
| `data.quality-gate-for-abstention` | Availability/dissemination/ingestion/vintage separation, incomplete and duplicate/stale event payloads. |

The three final stages cover the same 25 chains through the existing final-chain input map. Completion of that map remains an evidence gate, not a consequence of prompt generation.

## Preserved boundaries, validation and limitations

The edits preserve the five evidence kinds, five allowed conclusions, quoted-claim review verdicts, existing factor and final chain identifiers, paths, dispatch lineage, historical VIX brief hashes, document-parent relationships, one-Markdown return format, final-chain gate and prohibition on live changes. Existing research documents and `data/research-library/documents.json` are not modified by the audit. The prior prompt identities/hashes are preserved in the parent-prepared `PROMPT_V310_BASELINE.json`; normal generated v3.2 hashes identify the new prompt bytes rather than silently reusing old fingerprints.

Syntax and whitespace checks passed for the edited generator before regeneration. The integration results in PHASE2_VALIDATION_V320.md record catalogue/prompt regeneration, deterministic/hash checks and local test execution. Revised prompts remain unpublished; there was no live dashboard readback of revised bytes. No external factual or financial research was conducted here: source names and event examples are instructions drawn from the provided contract and existing generator, not independently verified market claims.

Prompt completeness does not establish operational readiness. Label instrument/source and evaluation-design decisions remain open where existing evidence says so; source/vintage gaps remain gaps. The existing dispatcher enumerates 75 factor-stage prompts. The three final prompts remain catalogued behind the final-chain gate, but have no dispatcher execution support; this audit does not add that support. Adjudication also needs the full research/review input package before unattended execution. A local preview/round trip cannot prove a live upload, deployment, source availability, causal timing, subscription allowances, model execution or trading edge. Astra was used as the requested platform audit agent; no research stage, paid external API call, calendar pipeline, automatic event trigger, order change or publication was performed by this audit.
