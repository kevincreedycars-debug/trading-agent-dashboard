# Macro Analyser Live Event-Responsive Engine

## Master VS Code / Codex Project Brief

**Date:** 19 August 2026  
**Status:** Research and staged implementation only until all evidence gates pass  
**Primary objective:** Build a continuous intraday macro-intelligence layer that preserves the opening directional diagnosis, detects materially new information during the trading day, interprets its market mechanism, confirms the response across related markets, and issues a clearly versioned revised call with alerts, expected duration, invalidation and expiry.

---

## 1. Instruction to the implementation agent

You are working inside the existing Macro Analyser / Trading Agent Dashboard VS Code workspace.

Before changing anything:

1. Read every applicable repository instruction file in full, including `AGENTS.md`, startup documents, current-state documents, task documents and handover documents.
2. Inspect and report the exact workspace path, repository, branch, HEAD, upstream divergence, dirty tracked files, untracked files and relevant running services.
3. Identify the current production, staged and research boundaries from repository evidence. Do not infer them from filenames alone.
4. Locate the existing USD, EUR, Gold, NQ and BTC collectors, Layer 1 workflows, Layer 2 logic, Master workflow, Dashboard Writer, data contracts, Supabase tables, replay logic and tests.
5. Locate and read the Donnelly USD ruleset and Omor supplement actually used by the live system. The supplied reference copies are `usd_ruleset.md` and `omors_supplement.md`, but repository copies and their provenance must be identified before implementation.
6. Trace one complete existing run from input collection through Layer 1, Layer 2, persistence and dashboard rendering.
7. Produce a short audit report and proposed file/workflow change list before writing code.

Do not deploy, refresh, activate, deactivate or modify production workflows during the initial build. Do not overwrite the frozen directional-close or half-L2L research. Do not reuse production workflow IDs in staged routes. Do not silently clean, reset, switch or discard a dirty worktree.

GitHub remains the source of truth, n8n is the execution layer, Supabase is the data layer and the dashboard is the presentation layer. Work incrementally, preserve backward compatibility and use dry-run-first connected changes.

---

## 2. Why this project is required

The existing system is strongest as a pre-session macro diagnosis. The latest independent session-close research found approximately chance-level directional performance:

- Layer 1 session-close accuracy: **47.65%**.
- Layer 2 session-close accuracy: **47.99%**.
- The earlier high excursion percentages measured path-dependent travel availability, not reliable closing-direction forecasting.
- Historical input timing was not sufficiently defensible for a clean pre-session redesign because many inputs were date-stamped rather than exact-time-stamped.
- Layer 2 did not create a reliable improvement over Layer 1.

This evidence is frozen and must not be reinterpreted or overwritten.

The new hypothesis is materially different:

> A baseline daily macro thesis may be useful as context, but the system must continuously detect and respond to new information that arrives after the baseline was sealed.

The 19 August 2026 US Treasury announcement is the motivating example. A surprise increase in long-end Treasury buybacks rapidly changed yields, the dollar, EUR/USD, gold and Bitcoin. A static morning snapshot could not know this event in advance. A capable engine should detect the new event and its cross-market transmission quickly enough to participate in the safer second wave, without pretending it can beat institutional news algorithms in the first milliseconds.

The target is reliable detection and reaction within approximately **one to five minutes after sufficient evidence becomes available**, not a guarantee that every event will be caught or that every revised call will be profitable.

---

## 3. Product definition

Macro Analyser becomes a continuous, versioned intraday decision system with two truths:

1. **Baseline call:** the immutable call produced from information available at the designated pre-session seal.
2. **Current actionable call:** the latest valid call after incorporating timestamped intraday events and confirmed market reactions.

The system must always answer:

- What did we believe at the start of the trading session?
- What do we believe now?
- What changed?
- Which evidence caused the change?
- How large and reliable is the change?
- Is the new call actionable or already too extended?
- When must it next be reviewed?
- How long is it expected to remain relevant?
- What would invalidate it?
- When does it expire automatically?

The primary product remains a daily per-pair answer to: **take this trade now, wait, or do not trade**. This project does not turn the platform into a high-frequency execution system.

---

## 4. Non-negotiable architecture and safeguards

### 4.1 Preserve existing Layer 1 isolation

The existing isolated asset agents remain:

- USD
- EUR
- Gold
- NQ
- BTC

Each Layer 1 agent may consume only its authorised logic document and authorised current market/event snapshot. It must not read another Layer 1 agent's output to manufacture agreement.

### 4.2 Preserve Layer 2 derivation

Layer 2 remains leg-driven and deterministic. It consumes compatible, currently valid Layer 1 legs only.

- Both source legs and source run IDs must be stored.
- `valid_from = max(source valid_from)`.
- `expires_at = min(source expires_at)` unless an earlier explicit invalidation applies.
- A revised leg triggers a fresh Layer 2 computation.
- Non-overlapping or mismatched legs produce `UNAVAILABLE` or `SUPERSEDED`, never an inferred active trade.
- An expired leg produces an expired pair.
- A `NO_CALL` leg produces `NO_CALL` according to the locked precedence rules.
- Stale stored outputs must render as `STALE` or `EXPIRED`, never `ACTIVE`.

Do not change the locked directional-opposition rule, confidence/strength semantics or status precedence as part of the first implementation. New event evidence may update Layer 1; Layer 2 still derives from Layer 1.

### 4.3 Preserve every call version

Never overwrite a call in place. A new call must reference the call it supersedes. The complete sequence must remain replayable.

### 4.4 Fail closed

- No fabricated values.
- No silent defaults.
- No carrying forward stale market values as if current.
- Required missing or stale inputs must produce a visible degraded or unavailable state.
- All timestamps must include timezone and be normalised to UTC for storage.
- Every output must carry source and run provenance.
- The frontend must never infer validity from a date or from whichever row happens to be latest.

### 4.5 No production mutation before evidence

Build in a research/staged route first. Production remains the benchmark. Promotion requires deterministic replay, shadow running, false-alert review and explicit approval.

---

## 5. Target architecture

```text
OFFICIAL RELEASES ─┐
NEWS / SPEECHES ───┼──> EVENT INGESTION + NORMALISATION ──┐
ECONOMIC CALENDAR ─┘                                      │
                                                          ├──> EVENT / SHOCK ORCHESTRATOR
1-MINUTE PRICES ───┐                                      │
YIELDS / SPREADS ──┼──> PRICE-LED SHOCK DETECTOR ─────────┘
FX BREADTH ────────┤
VIX / VOLUME ──────┘
                                                                  │
                                                                  v
BASELINE CALL ───────────────────────────────> MECHANISM CLASSIFIER
                                                                  │
                                                                  v
                                                     CONFIRMATION + TRADE GATE
                                                                  │
                                                                  v
                                                    VERSIONED LAYER 1 CURRENT CALLS
                                                                  │
                                                                  v
                                                    SYNCHRONISED LAYER 2 RECOMPUTE
                                                                  │
                                                                  v
                                                DASHBOARD + NOTIFICATION + OUTCOME STORE
```

The orchestration loop is:

```text
INGEST -> NORMALISE -> VALIDATE -> DETECT -> INTERPRET -> CONFIRM
-> RECOMPUTE -> PUBLISH -> MONITOR -> INVALIDATE/EXPIRE -> EVALUATE
```

---

## 6. Required engines and components

### 6.1 Scheduled-event collector

Maintain a timestamped economic and policy calendar containing:

- Event name and jurisdiction.
- Event type and expected affected assets.
- Scheduled release time in the source timezone and UTC.
- Consensus, prior, revised prior and available whisper/positioning context.
- Historical surprise distribution where defensible.
- Expected impact tier.
- Pre-event review time.
- Post-event mandatory recalculation windows.

Scheduled releases must be scored using actual versus consensus and revisions, not the absolute print alone.

### 6.2 Unscheduled-event collector

Continuously monitor authoritative sources and sufficiently reliable financial news for:

- Treasury and finance-ministry action.
- Central-bank decisions, speeches and intervention.
- Fiscal, debt-ceiling, sovereign-rating and liquidity announcements.
- Geopolitical escalation or resolution.
- Unexpected regulation or policy.
- Large cross-border capital-flow events.
- Material crypto-native events for BTC.

Each item must retain the original publication timestamp, system receipt timestamp, source URL/identifier, raw headline/text reference, source reliability and deduplication key.

### 6.3 Price-led shock detector

The system must be capable of detecting that something important is happening even when the explanatory headline is late or unavailable.

Minimum continuous inputs:

- DXY.
- US 2Y, 5Y, 10Y and 30Y yields.
- US/Germany differentials where available.
- US 10Y real-yield proxy or verified real-yield feed.
- EUR/USD, GBP/USD, AUD/USD, NZD/USD, USD/JPY, USD/CAD and USD/CHF.
- Gold.
- NQ and a broad US equity index.
- BTC.
- VIX and volume/liquidity indicators where available.

Detection must be time-of-day aware. A move that is normal at 13:30 London around US data may be exceptional at a quiet time. Candidate techniques include robust rolling z-scores, realised-volatility-normalised returns, change-point detection, yield-basis-point thresholds, cross-asset breadth and volume expansion.

Do not hardcode final thresholds without measuring them on historical one-minute data. Initial thresholds must be configuration, logged and replayable.

### 6.4 Mechanism classifier

Classify the event before assigning direction. Required classes include:

- Growth surprise.
- Inflation surprise.
- Labour-market surprise.
- Central-bank hawkish/dovish surprise.
- QE/QT or balance-sheet change.
- Treasury liquidity-support buying or fiscal-market intervention.
- Institutional safe-haven bond rotation.
- Growth-fear / Dollar Smile right-side activation.
- Global risk-on or risk-off transition.
- Direct FX intervention.
- Fiscal/debt credibility shock.
- Geopolitical shock.
- Capital-flow/rebalancing event.
- Crypto-native event.
- Unknown cause.

`UNKNOWN_CAUSE` is permitted. The system may issue a market-shock warning but must not invent a narrative. An actionable revised direction requires sufficient market confirmation even when the cause remains unknown.

### 6.5 Confirmation and trade gate

The first price movement is not automatically a trade. Confirm using:

- Source reliability.
- Event surprise or policy delta.
- Yield response and identified yield mechanism.
- DXY direction.
- Seven-cross USD breadth.
- Gold and real-yield alignment.
- NQ/VIX regime alignment.
- BTC/NQ/DXY alignment where relevant.
- Persistence beyond the first algorithmic reaction.
- Pre-event NewsPivot hold or rejection.
- Remaining ADR.
- Remaining session time and liquidity.
- Distance travelled since the earliest realistically executable confirmation.
- Spread, slippage and available reward-to-invalidation.

The system targets the second wave. It must not recommend chasing a move solely because a large candle has already printed.

### 6.6 Versioned call manager

Required state progression:

```text
BASELINE_ACTIVE
-> WATCH
-> SHOCK_DETECTED
-> MECHANISM_IDENTIFIED
-> CONFIRMING
-> ACTIVE_EVENT_CALL
-> WEAKENING
-> INVALIDATED or EXPIRED or SUPERSEDED
```

Not every event reaches `ACTIVE_EVENT_CALL`. Rejected candidates must be retained for false-positive analysis.

### 6.7 Notification service

Build a provider-independent notification contract. Phase 1 must support:

1. Persistent dashboard alert centre and visible banner.
2. Browser/desktop notification when permission is enabled and the dashboard is open.
3. One external outbound adapter through a configurable n8n webhook so another channel can be connected without changing call logic.

Do not hardcode private recipient details or credentials. Use existing credential routes and environment separation.

---

## 7. Intraday recalculation timetable

The engines must run continuously. The timetable below defines additional mandatory review checkpoints, not the only times calculations may change.

Store schedules in UTC and render in `Europe/London` and `America/New_York`. Never hardcode a permanent UK/US offset because British and US daylight-saving changes occur on different dates.

### Mini trading-day review list

| Approximate London time | Market point | Required system action |
|---|---|---|
| 00:00 UTC | UTC/BTC day rollover | Seal BTC day reference, validate overnight feeds and reassess crypto-native events |
| 06:45 | Pre-London check | Data-health check, overnight event digest, Asia move/shock review |
| 07:00 | Common UK data window | Recalculate affected GBP, USD and risk relationships when a scheduled release occurs |
| 08:00 | London open | Seal or confirm European-session baseline; refresh FX breadth and opening ranges |
| 09:00-10:00 | Common European data window | Event-driven recalculation for Eurozone/UK releases and ECB communications |
| 12:00 | Pre-New York preparation | Review ADR consumed, pending US events, NewsPivots and current baseline validity |
| 08:30 ET | Main US data window | Immediate event ingest; shock detection; mandatory reviews at +1, +5, +15 and +30 minutes |
| 09:30 ET | US cash open | Reassess NQ, risk regime, breadth, volume and whether the data move is confirming or reversing |
| 10:00 ET | ISM/JOLTS/confidence window | Event-driven recalculation with the same +1/+5/+15/+30 review sequence |
| 16:00 London | WMR fix | Detect flow-driven distortion; do not automatically interpret a fix move as a macro regime change |
| 16:30 London | London cash close | Reassess whether FX/gold momentum persists without London liquidity |
| 14:00 ET | Common Fed/FOMC/minutes window | Mandatory event sequence; evaluate policy surprise, yields, DXY and risk assets |
| 14:30 ET | Common Fed press-conference window | Recalculate on material guidance changes or answer-driven reversals |
| 16:00 ET | US cash close | Close-of-session evaluation for NQ and US-led risk; preserve still-valid multi-session calls |
| 17:00 ET | FX rollover | Expire session-only calls where required; mark thin-liquidity conditions |

In addition:

- Poll official event/news sources according to their permitted update frequency.
- Calculate one-minute shock features whenever fresh market bars arrive.
- Run the heavier confirmation/recalculation pass at least every five minutes while markets are active.
- Trigger immediate recalculation when an event, threshold breach or existing-call invalidation arrives.
- Perform data-health checks separately from directional calculations.

Scheduled calendar items override generic clock times. For example, an ECB decision, Treasury announcement or emergency speech creates its own pre-event and post-event review sequence.

---

## 8. Call duration, review and expiry contract

Do not give the user a single unsupported statement such as “this call lasts 24 hours”. Every active baseline or revised call must expose three distinct time concepts:

### 8.1 `next_review_at`

The earliest time the call must be formally reassessed. It is determined by:

- The next +1/+5/+15/+30 minute post-event checkpoint.
- The next scheduled high-impact release.
- A major session open, fix or close.
- A data freshness deadline.
- A weakening-confirmation threshold.

### 8.2 `expected_valid_until`

The system's current estimate of how long the event thesis is likely to remain the dominant driver. Initially classify this as:

| Persistence class | Provisional duration | Intended meaning |
|---|---:|---|
| `TRANSITORY` | 15-60 minutes | Flow, headline reaction or likely mean reversion |
| `SESSION` | Remainder of the active session, normally 1-8 hours | Confirmed intraday repricing |
| `MULTI_SESSION` | 24-72 active market hours | Durable policy/regime information likely to persist |
| `OPEN_ENDED_REVIEW` | No reliable duration estimate | Valid only until the next stated review/invalidation; never silently perpetual |

These are provisional labels, not assumed truths. Historical event replay must calibrate persistence by event class, surprise magnitude, market breadth and regime.

### 8.3 `hard_expires_at`

The absolute latest time the call may remain active without a new sealed reassessment. It must be no later than the earliest of:

- The relevant horizon boundary.
- The next incompatible Tier 1 event.
- Source-leg expiry for Layer 2.
- Market-calendar closure rule.
- A configured maximum event-call lifetime.

### 8.4 Dynamic shortening and extension

The engine may shorten expected duration when:

- Price returns through the NewsPivot.
- Yield or breadth confirmation disappears.
- The move becomes isolated to one instrument.
- A contradictory authoritative event arrives.
- ADR is exhausted and momentum deteriorates.
- Liquidity conditions make the signal unreliable.

It may extend expected duration only through a new versioned reassessment showing persistent mechanism, breadth and price confirmation. Never extend a timestamp silently.

### 8.5 Required user-facing duration wording

Every material-change alert must say, for example:

```text
Expected persistence: SESSION, approximately 3h 20m remaining
Next mandatory review: 14:45 London
Hard expiry: 16:30 London
Invalidates earlier if: DXY recovers above the NewsPivot and USD breadth falls below 4/7
```

---

## 9. Notification rules

### 9.1 Alert severity

| Level | Trigger | User treatment |
|---|---|---|
| `INFO` | Routine scheduled recalculation; no material call change | Store in timeline, no intrusive alert |
| `WATCH` | Abnormal event or price shock detected but not confirmed | Dashboard badge/banner, optional quiet desktop notice |
| `MATERIAL` | Direction unchanged but evidence strength, validity, vehicle or trade/no-trade status changes materially | Visible dashboard and desktop/external notification |
| `REVERSAL` | Confirmed direction changes bullish to bearish or bearish to bullish | Immediate high-priority notification |
| `INVALIDATION` | Active call loses its required confirmation or crosses its invalidation | Immediate high-priority notification |
| `DATA_RISK` | Required data is stale, missing, contradictory or unavailable | Immediate warning; affected calls fail closed |

### 9.2 Material-change conditions

Initial configurable conditions include:

- Direction reversal.
- `TRADE` to `NO_TRADE`, or `NO_TRADE` to `TRADE`.
- Call status becomes `ACTIVE`, `WEAKENING`, `INVALIDATED`, `STALE`, `EXPIRED` or `UNAVAILABLE`.
- Evidence-strength score changes by at least 15 points.
- Star/strength band changes by at least one full band when accompanied by new evidence.
- Expected persistence class changes.
- Hard expiry or next review moves materially earlier.
- The recommended Layer 2 vehicle changes.

Thresholds are configuration and must be calibrated. Evidence strength is not labelled as a probability of the closing direction.

### 9.3 Alert payload

Every intrusive alert must include:

```text
Asset/pair
Previous call -> new call
Alert severity
Detected at / confirmed at / notified at
Primary event or UNKNOWN_CAUSE
Why it changed, in two or three concise bullets
Key confirming markets
Evidence strength and change
Action status: TRADE / WAIT / NO_TRADE / EXIT-REVIEW
Entry-chase warning where applicable
Next review time
Expected persistence class and estimated end
Hard expiry
Invalidation condition
Direct link to the dashboard event/call timeline
```

### 9.4 Deduplication and alert fatigue

- Deduplicate the same source event and the same call transition.
- Do not repeat unchanged alerts every five minutes.
- Allow escalation from `WATCH` to `MATERIAL` or `REVERSAL`.
- Send a resolution alert when a material call is invalidated or expires.
- Maintain a full quiet timeline even when no intrusive notification is sent.

---

## 10. Minimum data contracts

### 10.1 Event record

```json
{
  "event_id": "stable-id",
  "event_type": "TREASURY_LIQUIDITY_SUPPORT",
  "scheduled": false,
  "source": "authoritative-source",
  "source_reliability": "PRIMARY",
  "published_at": "UTC timestamp",
  "received_at": "UTC timestamp",
  "processed_at": "UTC timestamp",
  "jurisdictions": ["US"],
  "affected_assets": ["USD", "EUR", "GOLD", "NQ", "BTC"],
  "consensus": null,
  "actual": null,
  "policy_delta": "structured delta from prior known policy",
  "surprise_score": null,
  "raw_reference": "immutable source reference",
  "dedupe_key": "stable-key",
  "data_status": "VALID"
}
```

### 10.2 Versioned Layer 1 call

```json
{
  "call_id": "stable-version-id",
  "asset": "USD",
  "call_kind": "BASELINE or EVENT_OVERLAY",
  "direction": "BULLISH or BEARISH or NEUTRAL",
  "action_status": "TRADE or WAIT or NO_TRADE",
  "evidence_strength": 0,
  "strength_band": "existing canonical band",
  "generated_at": "UTC timestamp",
  "sealed_at": "UTC timestamp",
  "valid_from": "UTC timestamp",
  "next_review_at": "UTC timestamp",
  "expected_valid_until": "UTC timestamp or null",
  "persistence_class": "TRANSITORY or SESSION or MULTI_SESSION or OPEN_ENDED_REVIEW",
  "hard_expires_at": "UTC timestamp",
  "invalidated_at": null,
  "call_status": "ACTIVE",
  "supersedes_call_id": "prior id or null",
  "baseline_call_id": "immutable baseline id",
  "trigger_event_ids": ["event-id"],
  "mechanism": "classified mechanism",
  "confirmation": {
    "dxy": "aligned",
    "yield_curve": "aligned",
    "fx_breadth": "6/7",
    "gold_real_yield": "aligned",
    "risk_regime": "aligned"
  },
  "invalidation_rules": ["machine-readable rule"],
  "source_run_id": "exact run id",
  "horizon_code": "canonical horizon",
  "horizon_basis": "explicit definition",
  "timezone": "UTC",
  "market_calendar": "explicit calendar",
  "data_freshness": "VALID"
}
```

### 10.3 Notification record

Store notification ID, call ID, event IDs, severity, channel, created time, sent time, delivery result, dedupe key and resolution state. A notification failure must not change the call itself.

---

## 11. Dashboard requirements

Add a live intraday area without breaking the existing Overview, Backtest/Accuracy or manual-review contracts.

Minimum display:

1. **Baseline versus current call** for every Layer 1 asset and Layer 2 pair.
2. **Changed since open** badge.
3. Previous direction, current direction and exact change time.
4. Current action: `TRADE`, `WAIT`, `NO_TRADE` or `EXIT-REVIEW`.
5. Next review countdown.
6. Expected persistence and hard-expiry countdown.
7. Evidence-strength change, clearly labelled as evidence strength rather than probability.
8. Event/mechanism summary.
9. Cross-market confirmation panel.
10. Invalidation rule.
11. Full event and call-version timeline.
12. Feed-health and staleness status.
13. Notification-centre history with read/unread and resolved state.

The user must be able to see whether a changed call is still fresh, weakening, already too extended or expired.

---

## 12. Research and replay requirements

The design must be proven using timestamp-correct event replay before promotion.

### 12.1 Replay contract

- Use only information available by each simulated timestamp.
- Use true publication/receipt timestamps where available.
- Do not use end-of-day articles as if available at event time.
- Replay one-minute or finest defensible market data chronologically.
- Preserve revisions separately from initial releases.
- Apply the same production candidate code, not a duplicate approximation.
- Make thresholds, cooldowns and state transitions deterministic.
- Stop and report unavailable history rather than inventing it.

### 12.2 Required event sample

Include diverse events, not only successful trend days:

- Scheduled data beats, misses and mixed-detail releases.
- Hawkish and dovish central-bank surprises.
- Treasury/fiscal/liquidity announcements.
- Risk-off events where yields fall and USD rises.
- Yield declines where USD does not weaken.
- Geopolitical shocks.
- Flow-driven false alarms and WMR-fix reversals.
- No-news price shocks.
- Events that reverse through the NewsPivot.
- BTC-specific events that do and do not spread to macro markets.

### 12.3 Primary measurements

- Event receipt latency.
- Shock-detection latency.
- Mechanism-classification latency.
- Confirmation and notification latency.
- Earliest realistically actionable price.
- Maximum favourable and adverse excursion after confirmation.
- Session-close direction from the revised call timestamp.
- Outcome after spread, slippage and conservative execution delay.
- False-positive rate.
- Missed-event rate.
- Reversal/invalidation accuracy.
- Alert precision and alerts per day.
- Persistence-class calibration.
- Baseline versus revised-call incremental value.
- Layer 1 versus Layer 2 incremental value.

Do not optimise only for hit rate. A useful system must improve decisions after costs while controlling false alarms and alert fatigue.

---

## 13. Build phases and stop gates

### Phase 0: Repository and runtime audit

Deliver:

- Exact architecture map.
- Existing-versus-missing capability table.
- Data-source inventory with freshness and licensing constraints.
- Current schema and workflow IDs by environment.
- Proposed changes, risks and tests.

**Stop gate:** no implementation until the audit demonstrates where the new path can be isolated safely.

### Phase 1: Contracts and local deterministic core

Build:

- Event schema.
- Call-version schema.
- State machine.
- Persistence/expiry calculator.
- Alert decision and deduplication logic.
- Unit tests and fixtures.

No external writes and no production connections.

### Phase 2: Observation-only ingestion

Build staged collectors for official events, calendar events and one-minute market signals. Store observation records separately from production calls.

**Stop gate:** source timestamps, staleness, deduplication and market-calendar conversion must pass.

### Phase 3: Shock detection and mechanism classification

Produce candidate events and explanations without changing any live call.

**Stop gate:** manually review a representative sample of confirmed events, rejected events and unknown-cause shocks.

### Phase 4: Shadow event calls

Generate versioned baseline/current calls in a research namespace. Recompute research-only Layer 2 pairs. Do not publish these as production guidance.

**Stop gate:** deterministic replay and shadow outputs must agree from identical inputs.

### Phase 5: Dashboard and quiet notifications

Display the staged timeline and store alerts without sending intrusive external notifications.

**Stop gate:** review alert precision, duplicates, incorrect reversals, expiry and user comprehension.

### Phase 6: Controlled notifications

Enable the dashboard notification centre, optional browser notifications and one configured external webhook in staged mode.

### Phase 7: Promotion proposal

Produce an evidence pack. Do not promote automatically. Production promotion requires explicit approval, environment-guard verification, dry run, exact workflow diff, rollback plan and post-apply probe.

---

## 14. Acceptance criteria

The project is not complete merely because a workflow runs.

Minimum acceptance criteria:

1. Baseline calls remain immutable and visible.
2. Every revised call has exact causal event/run lineage.
3. Price shocks can be detected without a known headline.
4. Unknown causes are labelled unknown rather than invented.
5. All revised calls expose `next_review_at`, persistence class, `expected_valid_until`, `hard_expires_at` and invalidation.
6. Layer 2 uses only compatible active Layer 1 versions.
7. Stale/missing/mismatched data fails closed.
8. Notifications deduplicate and escalate correctly.
9. Routine recalculations do not spam the user.
10. DST and market-calendar tests cover UK/US offset-mismatch weeks.
11. Replay contains no future leakage.
12. The exact same deterministic core is used for replay and staged live operation.
13. Existing Overview, Backtest/Accuracy, manual-review and frozen research artifacts remain intact.
14. Production IDs and workflows remain untouched until explicit promotion approval.
15. Evidence demonstrates whether revised calls add value relative to the frozen baseline, including after realistic delay and costs.

---

## 15. Explicit non-goals for the first build

- Do not build millisecond high-frequency trading.
- Do not promise to react as quickly as Bloomberg/Reuters direct-feed bank algorithms.
- Do not automatically execute real-money trades.
- Do not rewrite the Donnelly or Omor framework wholesale.
- Do not train a black-box direction model before establishing timestamp-correct inputs and replay.
- Do not label evidence strength as a calibrated probability until calibration proves it.
- Do not optimise thresholds on one exceptional day.
- Do not change production Layer 1/Layer 2 logic simply to make historical results look better.
- Do not use LLM interpretation as the sole shock detector or sole trade gate.

---

## 16. Required implementation documentation

Maintain or create:

- Architecture decision record for baseline/current-call separation.
- Event taxonomy and mechanism map.
- Data-source and freshness contract.
- State-machine specification.
- Persistence and expiry specification.
- Notification severity and deduplication specification.
- Replay methodology and leakage controls.
- Environment/workflow identity map.
- Test matrix.
- Operational runbook and rollback plan.
- Daily session handover noting exact completed work, evidence, blockers and next step.

All claims must be backed by repository files, test output or recorded staged evidence.

---

## 17. First working session instruction

For the first VS Code session, perform **Phase 0 only**.

Return:

1. Exact repository/worktree identity and safety status.
2. Current end-to-end production and staged workflow map.
3. Current collectors, frequencies, timestamps and data sources.
4. Existing support for scheduled events, unscheduled news, intraday prices, yields and alerts.
5. Exact gaps against this brief.
6. Proposed isolated file, database and n8n workflow changes.
7. Test and replay plan.
8. Questions or blockers that genuinely require user choice.

Do not implement or deploy during this audit unless the user explicitly authorises the next phase after reviewing the findings.

---

## 18. Definition of success

The successful system does not claim to predict every surprise before it happens. It does something more defensible:

> It preserves what was known at the session start, notices when the world materially changes, identifies or honestly leaves unknown the mechanism, waits for sufficient market confirmation, issues a traceable revised call quickly enough to evaluate the remaining opportunity, tells the user how long that call is expected to matter, and alerts immediately when the actionable direction, validity or risk has materially changed.

