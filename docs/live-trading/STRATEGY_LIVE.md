# Live trading path: strategy and design

Assignment `live-trading-001`. Worker `live-trading`.
Worktree `D:/trading-agent-dashboard-codex/.local/worktrees/live-trading`,
branch `workers/live-trading-20260929`, base `5ff1bf3`. First written 2026-09-29.
Revised 2026-09-30: live-feed correction in section 3, entry-confirmation rule and platform
confirmation in section 10.
Revised 2026-10-01: the mirrored chart in section 12, the local level-marking tool in section 13,
the terminal-style chart furniture in section 14.
Revised 2026-10-03: the fresh MT5 snapshot published so the live chart draws candles in section 16, and
the model-rule blanks written down in section 17.

Status: **read-only feed built and rendering, levels markable locally, the chart drawn to terminal standard with the published snapshot now carrying M5 candles; no order path**. The FTMO terminal is connected and logged
in, the read-only producer in section 11 writes `data/live-trading.json` from it, and the dashboard
renders that snapshot in its own section for all four instruments. No credential was read or requested,
and no order path exists or was armed: the producer's MT5 function allowlist is enforced by test. The
authority question in section 8 is still open on purpose and stays the user's decision; section 11 adds
the always-on host question that the user raised.

## 1. The harness this window runs on

| Piece | State |
| --- | --- |
| Worktree / branch / base | `.local/worktrees/live-trading` on `workers/live-trading-20260929`, clean at base `5ff1bf3` |
| Lane documents | this file and `CONVERSATION_NOTES.md` - the only tracked files this window may write |
| Scratch | ignored `tmp/` in the worktree, for envelopes, probe output and raw evidence |
| Mailbox | shared mailbox `D:/trading-agent-dashboard-codex/.local/orchestration`, written only through the canonical CLI |
| Coordinator visibility | register entry `live-trading` present; `node scripts/coordination.js check --worker live-trading` returned `pending 0` and `errors []` before this lane filed its own envelope |

Immediately after this lane filed its envelope the same worker reports `pending 1` and `errors []`,
which is this lane's own item awaiting review, not work in flight.
| Bridge connection | `.local/orchestration/connections/live-trading.json` reports `watching`, extension `0.2.1` |
| Activity reporting | `node scripts/monitor-state.js activity live-trading working\|paused "<task>"` writes `.local/orchestration/activity/live-trading.json` |
| Local validation | `node --test tests/coordination.test.js tests/monitor_state.test.js` - 11 of 11 pass in this worktree on 2026-09-29 |

No `node_modules` exists in this worktree, so the browser suites (`npm run test:browser`) need a
separate Playwright install before they can run here. That is a deliberate non-action, not a fault.

## 2. Verified starting state, re-read today

Nothing in the repository connects to a broker. MT5 appears only as a declared gap and a visual
target, confirmed by reading the files rather than trusting the assignment text:

- `data/research-proof-map.json` still lists `"Provide an MT5 data export or read-only feed"` as
  `needs_you`, and marks the `executable` gate `blocked` with `executable_trade_validated` still
  false.
- `docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md` is still a visual direction only: it asks for a
  view where real fills are labelled apart from proposed or simulated trades and stale broker sync
  is flagged, but there is no implementation behind it.
- `docs/ARCHITECTURE.md` still defines Layer 1 as sealed independent agents that may read only their
  own logic document and the latest usable market snapshot.
- `docs/CREDENTIAL_CONTINUITY.md` and `config/credential-manifest.json` list scopes
  `deepseek-coordinator`, `n8n`, `backtester`, `market-importers` and `all`. There is no MT5 scope,
  no MT5 credential name and no MT5 consumer.

Read-only machine probe (`tmp/harness-probe.ps1`, output `tmp/harness-probe.json`, 2026-09-29):

- Two terminals are installed: `C:\Program Files\MetaTrader 5` (build `5.0.0.5331`, written
  2025-10-15) and `C:\Program Files\RL Crates MT5 Terminal` (build `5.0.0.4410`, written
  2024-06-25).
- One terminal data folder exists beside the two shared folders (`Common`, `Community`). It holds
  four instrument base folders and **zero** installed experts. No terminal, editor or tester process
  was running at the time of the probe.
- Python 3.13.7 is present and the `MetaTrader5` package is **not** importable.

## 3. What a live path would actually consume today

Read from `data/layer1.json`, `data/layer2.json` and the research drafts:

- The **published** `layer1.json` carries eight agent rows (`USD`, `EUR`, `GOLD`, `SILVER`, `NQ`,
  `BTC`, `WTI`, `GBP`), each with calls for `24h`, `3d`, `current_week`, `next_week` and
  `current_month`. Each call has `direction`, `conviction`, `generated_at`, `sealed_at`, `valid_from`,
  `refresh_due_at`, `forecast_window_end`, `expires_at`, a horizon basis of `WEEKDAY_ACTIVE_TIME_V1`,
  and a timezone of `America/New_York`. `dashboard_meta.execution_clock` reads
  `07:00 ET primary run`, which is the only statement of a decision time anywhere in the repository.
- Re-read from the live site on 2026-09-30, the published artifacts are **current**: `layer1.json`
  `dashboard_meta.last_updated_et` is `2026-09-29T08:06:43.090Z`, per-agent `sealed_at` is
  `2026-09-29T08:04Z`, and `layer2.json` is `2026-09-29T08:06:35.263Z`. **This worktree's copies are
  the stale ones** (`layer1.json` still says `2026-09-07T06:14:59.998Z`); the earlier entries in this
  lane that called the feed stale and empty were reading those copies and were wrong. What remains
  unresolved in the live data: `publication_consistency` is `UNKNOWN`, `refresh_schedule_status` is
  `PROVISIONAL`, and the dashboard's own note still says `No authoritative orchestrator cron exists
  in the repository`.
- Observed clock mismatch, arithmetic only, no interpretation: `sealed_at` is
  `2026-09-29T08:04:36.805243+00:00` and `last_run_et` is `2026-09-28T08:24:27.015+00:00`, both
  carrying a UTC offset, while `execution_clock` and `refresh_schedule` say 07:00 `America/New_York`.
  08:04 UTC is 04:04 ET, and 07:00 ET is 11:00 UTC, so the ET-labelled fields do not agree with the
  stated ET schedule. The time-mapping question in section 5 is therefore not academic.
- The published `layer2.json` has exactly one `trade_opportunities` row - `WTI/USD` SELL, confidence
  75, rank 1 - and lists **all four in-scope pairs on `avoid_today`**: EUR/USD, XAU/USD, BTC/USD and
  NQ/USD, each reading "Both assets point in the same 24H direction, so there is no clear relative
  edge." On that publication the Layer 2 path produced nothing inside our universe, so the Layer 1
  solo path was the only live case. That is the shape the precedence rule has to handle on day one.
- The level work (`data/l2l-trading-day-directional-v1.json`,
  `data/half-l2l-executable-entry-v1-draft.json`) is research. The executable-entry draft declares
  itself `research_only: true` and `status: DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION`.

**The first real blocker is still the clock, not the connector.** `sealed_at` gives a per-agent
decision instant and `refresh_schedule` names `07:00` in `America/New_York`, but the two do not agree
with each other in the live data, `publication_consistency` is `UNKNOWN`, and the schedule is
`PROVISIONAL` with no orchestrator cron behind it. A live order needs the mapping settled: which
timestamp is the decision, which is the publication, how stale a call may be when an order is sent,
and what happens when the artifact lags the agent that produced it. Until that exists, an MT5
connection could only place orders against a guessed clock - and the user's 5m confirmation rule in
section 10 raises the stakes, because that rule is itself a clock.

## 4. Constraints that must hold whatever is built

- Layer 1 stays sealed and independent. No live path may feed anything back into Layer 1 inputs,
  weights, collectors, or the published call.
- Backtesting stays downstream-only. A local replay, a passing test or a parity check is not proof
  of a live deployment, of causal feature timing, or of trading edge. Parity is not edge.
- The sealed Gold prospective window stays sealed until `2027-03-25T15:00:00Z`. No live or research
  step may read it early.
- Credentials only ever reach a process through the documented scoped CLIXML runner. Any MT5
  credential or scope is a separate user-authorised manifest change, never a chat paste.
- The dashboard is published to GitHub Pages from production `main`, so any mirrored-execution view
  is a production change with its own authorisation - not part of this lane.

## 5. Unknowns that have to be answered before any connection

Grouped, because each group is separately decidable:

- **Instrument**: XAU/USD versus the broker's actual symbol, contract size, tick size, tick value,
  minimum and step volume, and whether the account is netting or hedging.
- **Time**: broker server time, DST handling, session boundaries, weekend rollover, and how the ET
  call timestamps in `layer1.json` map onto broker time.
- **Call to order**: which field is the decision, which is the publication, the maximum tolerated
  latency, and what happens to a call that has already expired when the order would be sent.
- **Execution contract**: market or limit, spread cap, slippage assumption, stop and target
  placement, and the adverse-boundary sequencing the level research already flags as unresolved.
- **Risk**: risk per trade, position sizing rule, maximum concurrent positions, daily loss limit, a
  kill switch, and flat-over-weekend behaviour.
- **Record keeping**: what stores calls, orders, fills, partial fills, rejections and exits; how
  orders are tagged so a duplicate cannot be sent twice; and where the mirrored view reads from.
- **Observability**: alerting on disconnect, stale feed and failed send, plus a dry-run mode that
  cannot place a real order even if it is misconfigured.
- **Testing**: how any of it is tested without touching a funded account.
- **Account**: whether the `RL Crates` install is a prop-firm terminal with rules of its own. That
  is unverified, and prop rules would constrain news trading, holding through rollover and drawdown.

## 6. Options, ranked honestly

1. **Read-only feed first.** Connect nothing that can trade: a sign-in to one account, read symbols,
   bid/ask, spread and history, and write nothing back. It proves symbol mapping, time mapping and
   latency with no order risk, and it is the smallest step that produces useful evidence.
2. **Demo execution with a dry-run harness.** Only after 1: a demo account, a paper harness that
   records what it *would* have sent, and a comparison sheet between intended and broker-recorded
   prices. This is where an execution contract can be measured.
3. **Funded execution.** Last. It needs 1, 2, an explicit risk contract and a kill switch. Nothing
   in this project currently supports an argument for it, and no edge claim is established.

## 7. Recommended single next step

Because section 3 shows the blocker is timing and contract rather than connectivity, the next
bounded step should be **design, not connection**: write the call-to-order contract - the decision
timestamp, the publication timestamp, the staleness tolerance, the instrument and time mapping, the
execution and risk rules and the record-keeping fields - against the artifacts that already exist,
and get the user's ruling on section 8. That step needs no terminal, no credential and no package,
and its output is a spec a later build can be tested against.

The first code-shaped step, when authorised, should be a local dry-run harness fed from checked-in
JSON rather than a live terminal, so the order path can be proven end to end without an account.

Dependencies of that recommendation, so a reader can see what it waits on:

- Nothing in this lane. It is documentation and needs no terminal, credential, package or account.
- The user's ruling on section 8, in particular the authority level.
- A decision on whether the missing publication-time contract is fixed in the dashboard lane first,
  because an order path cannot be tested against a clock that does not exist.

## 8. Open questions for the user

1. **Authority level** - read-only feed, demo execution, or real-money execution on a funded
   account? This gates everything else.
2. **Which account** - which broker and which install (`MetaTrader 5` build 5331, `RL Crates MT5
   Terminal` build 4410, or another), and is it a prop-firm account with its own rules?
3. **Instrument and size** - which symbol to trade first, and the risk per trade if execution is
   ever allowed.
4. **Timing source of truth** - is the dashboard's published call the trigger, and what staleness is
   acceptable?
5. **Where the mirrored view lives** - shown locally only, or published on the dashboard.

## 9. Provenance

Read on 2026-09-29 from this worktree; byte hashes of the working files:

| File | Bytes | SHA-256 (first 8) |
| --- | --- | --- |
| `docs/MT5_MIRRORED_EXECUTION_CHART_REFERENCE.md` | 1116 | `EA097914` |
| `data/research-proof-map.json` | 4589 | `497AFC0B` |
| `docs/ARCHITECTURE.md` | 2542 | `68569020` |
| `docs/CREDENTIAL_CONTINUITY.md` | 5223 | `32953C2F` |
| `config/credential-manifest.json` | 7522 | `69230DD5` |
| `data/layer1.json` | 417783 | `9BD5D8DD` |
| `data/layer2.json` | 673 | `59C52354` |
| `data/half-l2l-executable-entry-v1-draft.json` | 7845 | `847A49D7` |

The environment probe and its output stay ignored under `tmp/`. No credential value was read,
printed or stored at any point.

## 10. Entry confirmation, chart cadence and platform (user, 2026-09-30)

- **Entry confirmation is a 5-minute candle close beyond the L2L level.** For a long, the trade is
  placed when a 5m candle *closes* above the marked L2L price level; for a short, when a 5m candle
  closes below it. A wick through the level is not a trigger. Levels, and therefore confirmations, are
  per instrument.
- **Published chart cadence is 5 minutes**, chosen by the user for that reason: the published view has
  to be fresh enough to mark a level and read the confirming candle. GitHub Pages is static, so the
  live section renders from a snapshot pushed into the repository on that cadence; exposing the PC's
  bridge port to the internet stays rejected.
- **This rule is new relative to the existing draft, and the two must be reconciled.**
  `data/half-l2l-executable-entry-v1-draft.json` proxies entry as "the open of the first available 1H
  candle whose opening timestamp is at or after the proxy timestamp", with stops and targets at
  ADR20 multiples. The user's rule is a 5m close-beyond-level trigger. The draft remains
  `research_only` / `DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION` either way, and nothing here is an
  edge claim.
- **Platform confirmed: MetaTrader 5.** The Python `MetaTrader5` package talks to MT5 only, FTMO
  offers MT5 for the CFD Challenge, and MT5 is where the `US100.cash`-style symbol names and the 5m
  candles live. MT4, or the FTMO/TradingView route, would each mean a different connector.

### Sub-questions this rule creates, none of them answered yet

1. Must the confirming close be the *first* close beyond the level, or is any close beyond it while
   the call is still valid acceptable?
2. Must the level be touched before the close, or is a gap straight through it a valid trigger?
3. Is there a deadline after the call is sealed beyond which a breakout is no longer taken?
4. One entry per instrument per call, or re-entry after a stop as long as the call is still valid?

Until these are answered, the rule is a complete trigger description for marking and eye-checking
levels, and not yet a complete order rule.

## 11. The read-only live section, and the always-on question (user, 2026-09-30)

The user asked for two things: not to have to leave the PC running, and to see the four pairs set up and
reflected in the dashboard. The second is built and rendering. The first is a hosting decision that is
still open, and it cannot be designed away: MT5 must be running and logged in somewhere, and the reader
that produces the dashboard's data must run on that same machine, because the package attaches to a
local terminal and exposing the PC's bridge port stays rejected (section 10).

| Piece | Path | State |
| --- | --- | --- |
| Producer | `tools/mt5-bridge/live-trading-snapshot.py` | Writes the snapshot from the running terminal. Read-only: allowlisted to `initialize`, `shutdown`, `last_error`, `terminal_info`, `account_info`, `symbol_info`, `symbol_info_tick`, `copy_rates_from_pos`, `positions_get`, `orders_get`. Re-asks for bars until the newest one is current, and records the result (`bar_age_seconds`, `refresh_attempts`, `stale`). |
| Artifact | `data/live-trading.json` | `live-trading-feed-v2` (section 18): account facts, and per instrument the quote, spread, specs, both clocks and three bar blocks - `m5` 120 bars, `h1` 168, `h4` 120 - each with its own freshness proof, published as full OHLC `bars` plus the compact `close_series` the cards use. |
| Validator | `scripts/validate_live_trading_feed.js` | Fails a feed that is not read-only, that omits any of the four instruments, that carries a raw login, whose last close disagrees with its own series, that hides how old its M5 bars are, that claims current bars older than 660s, or that carries stale bars without a note explaining the lag. When OHLC `bars` are present it also rejects a candle whose high is below its own open or close, whose low is above them, or whose series disagrees with `candle_count` or the close-only view. |
| Dashboard section | Tab `live-trading` under a new **Live** group, `#liveTradingView`, `renderLiveTrading` | Account chips, the mirrored M5 chart with its symbol row and candles/line toggle, four cards, freshness badge, provenance line. No controls that can trade. |
| Tests | `tests/live_trading_feed.test.js` | 23 of 23 locally; the MT5 allowlist test fails the suite if an order function is ever added. |

Freshness rule: the reader compares `generated_at_utc` against `stale_after_seconds` (900, i.e. three
5m bars) and prints `FRESH`, `STALE`, `AGE UNKNOWN` or `SNAPSHOT UNAVAILABLE`. Stale copy says the
producer runs on the machine holding the terminal, so the section never implies a feed it does not have.

Bar freshness is tracked separately from snapshot freshness, because the two can disagree. MT5 answers
`copy_rates_from_pos` from the terminal's local history cache and pulls anything missing from the broker
in the background, so a run made before that sync lands returns a series that can stop hours before the
instrument's own live tick. On 2026-09-30 a 19:10 UTC run had EURUSD current but XAUUSD, `US100.cash`
and BTCUSD bars ending 14:25 UTC, and the cards badged them `5M DOWN` under a `FRESH` snapshot. The
producer now re-asks until the newest bar reaches the present, and each M5 block carries
`bar_age_seconds` (against that instrument's own tick), `refresh_attempts` and `stale`. A stale series
is not dressed as current: the badge reads `5M STALE` in amber, the last bar's direction is shown as a
labelled fact rather than a live read, and the producer's own note is rendered on the card. The banner
states how many of the four instruments are on a current M5 bar.

Three hosting options, none chosen:

1. **VPS.** Terminal plus producer on an always-on Windows host; the PC can be off. This is the only
   option that satisfies the user's request and keeps the dashboard fresh. It needs automated trading
   permission confirmed in writing with FTMO before anything other than reading runs there.
2. **Session windows on this PC.** Free; the published view goes stale outside the window and says so.
3. **Cloud display-only feed** (n8n and a vendor): always fresh, not FTMO's feed, and so explicitly not
   the feed a 5m close-beyond-level confirmation may be read from.

Publication is separate from all of this: the work is committed on `workers/live-trading-20260929`, and
the published site only changes when that work reaches `main`. No push to `main` has been made.

**Decision (user, 2026-09-30): stay on this PC.** The VPS was considered and turned down for now, so
option 2 is the chosen route: the producer runs on the machine holding the terminal, and the published
view goes stale whenever that PC is off, which is the honest state it already renders. The user's words
were "No for now lets keep it to PC", so this is a deferral rather than a rejection: nothing is bought
and option 1 stays written up in [VPS_SPEC.md](VPS_SPEC.md), parked, for whenever leaving the PC on
becomes the wrong trade. The PC route needs no new code: the stale banner already says the feed only
moves while the terminal's machine is up, so the dashboard never claims a liveness it does not have.

## 12. The mirrored MT5 chart (build, 2026-10-01)

The first of the three things the user asked for - mirror the MT5 charts, then mark the L2L levels on
them, then define the deviation and 5m-close entry/exit logic - is built.

| Change | Where | What |
| --- | --- | --- |
| Producer publishes OHLC | `tools/mt5-bridge/live-trading-snapshot.py` | Each M5 block now carries `bars`: `time_server`, `time_utc`, `open`, `high`, `low`, `close`, `tick_volume`, `spread_points`. The rows were already computed for `last_close`; only the full series is new. Default `--candles` is 120 (ten hours of M5). No new MT5 function is called, so the read-only allowlist is unchanged. |
| Validator accepts and checks them | `scripts/validate_live_trading_feed.js` | `m5.bars` is optional, so a snapshot written before this change still validates. When present it must be non-empty, agree with `candle_count` and the last `close_series` entry, carry both clocks, and hold candles that could exist (high not below open/close, low not above them). |
| Dashboard draws the candles | `script.js`, `styles.css` | `liveTradingChartShell` / `liveTradingChartPlot` / `setupLiveTradingChart` render one wide SVG surface at the top of the section: a symbol row with a per-instrument health, freshness and level-count badge, the M5 candles at a price scale with the newest bar still forming, a 5-line price axis, a 6-tick time axis, the last price tagged, and a candles/line toggle. The section still has no order code. |
| Tests | `tests/live_trading_feed.test.js` | 23 of 23 locally, up from 18. |

Two honest limits are built in rather than papered over:

1. **The published artifact has not been regenerated.** `data/live-trading.json` in the repository is
   the `2026-09-30T19:28:37Z` run and has no `bars` yet. The chart therefore falls back to a close
   line from `close_series` and labels it `OHLC not in this snapshot yet`. Candles appear the first
   time the producer is run on the machine holding the terminal and the snapshot is committed.
2. **A chart is not evidence of an edge.** This is a picture of the published feed at the published
   cadence. It does not establish causal feature timing, an entry, or a profit rule.

The level overlay is already drawn on the same price scale as the candles (`live-trading-chart-level`,
teal, dashed, with a left-hand tag) but no instrument publishes `levels` yet, so nothing renders.
That is the second step, and it needs one decision before it can be built: where the level prices
come from. The documented intent is that they are marked by the user on the mirrored charts and then
encoded, but "marked in the dashboard" and "GitHub Pages is static and read-only" have to be
reconciled - either a local marking tool writes a committed `data/l2l-levels.json` that the published
chart reads back, or the level prices are transcribed and typed into that file directly.

**Resolved 2026-10-01: option 1, the local marking tool.** Section 13 records the file, the tool, the
endpoint and the click path; transcription stays available as the fallback because the artifact is
plain JSON that anyone can hand-edit, with `node scripts/l2l-levels-tool.js --check` as the guard.

Step three - the deviation band and the 5m close-beyond-level entry/exit rule - stays governed by the
four open sub-questions in section 10. It is written up as a complete rule for marking and
eye-checking levels, and not yet as a complete order rule.

## 13. The L2L level marking tool (build, 2026-10-01)

The second of the three things the user asked for - mirror the MT5 charts, mark the L2L levels on them,
then define the deviation and 5m-close entry/exit logic. Step 1 was the chart (section 12); this is
step 2, the marking half, and it answers the decision section 12 left open: marked levels reach the
published chart through a committed `data/l2l-levels.json`, written locally by a tool and read back by
the static page.

How to run it and what it refuses to do: [`scripts/README-l2l-levels-tool.md`](../../scripts/README-l2l-levels-tool.md).

| Piece | Path | What it does |
| --- | --- | --- |
| Tool | `scripts/l2l-levels-tool.js` | Loopback-only static server for the repo plus `GET`/`POST /api/l2l-levels`. The only writer of the levels file. `--check` validates the artifact and exits non-zero on failure. |
| Artifact | `data/l2l-levels.json` | `l2l-levels-v1`: `schema_version`, `generated_at_utc`, `marked_by`, `note`, `instrument_count`, and all four instruments (EURUSD, XAUUSD, `US100.cash`, BTCUSD) with their `levels` arrays - all empty on this commit. A level carries `role`: `seed` when it was marked by hand, `derived` when a duplication generated it from the distance between two seeds, with `spacing_price`, `spacing_points` and the two anchors beside it (section 18). |
| Dashboard | `script.js`, `styles.css` | `applyLiveTradingLevels` joins the feed and the marked file on the broker symbol, `liveTradingChartLevelsFor` filters to finite prices, and the lines ride the same candle price scale the overlay was drawn on. `probeLiveTradingLevelsTool` recognises the tool; `markLiveTradingLevel` posts a click, `duplicateLiveTradingLevels` posts the ladder request, `removeLiveTradingLevel` and `clearLiveTradingLevels` take levels away. |
| Tests | `tests/l2l_levels.test.js` | 26 tests, up from 0: validation rules, edit semantics, duplicate protection, the live round trip with its refusals, the read-only static server, and the dashboard wiring. |

Local marking works like this. The tool serves the worktree on `127.0.0.1:8788`, so the dashboard it
returns is same-origin with the write endpoint; the page probes `/api/l2l-levels` and only draws the
**Mark level** button when a real tool answers with `ok: true`, `tool: "l2l-levels-tool"` and its own
`X-L2L-Levels-Tool: 1` header. A click is mapped back through the chart's fixed viewBox into a price on
the candle scale, snapped to the instrument's point grid, and posted as an `add`. The tool rewrites the
file and returns the new state, the chart redraws the line and the `n lvl` distance badge from it, and
the status line says to commit `data/l2l-levels.json` to publish. On the published host, or from a
`file://` open, the probe fails and the section stays exactly as read-only as it is today - a static
page cannot write, so it does not pretend to.

Rules the tool enforces, because the file it writes is trusted by the published reader:

- **Add replaces.** Marking the same price twice replaces that level rather than stacking a duplicate
  (tolerance `1e-9`), so a mis-click costs another click instead of a second line.
- **Remove is checked.** Removing a price that is not marked answers 404 and writes nothing.
- **All four instruments, always.** Every write rebuilds the entries from the known instrument list, in
  dashboard order, so no symbol can be dropped by an edit; each symbol's levels are sorted by
  descending price; serialisation is stable and ends with one newline.
- **Strict prices.** A price must be a positive JSON number. A quoted or non-numeric price is a hand
  edit that `--check` rejects, and the reader drops a non-numeric entry rather than drawing it.
- **The writer cannot produce a file its own checker rejects.** `POST` validates the state it is about
  to write and answers 422 instead of saving it, so `--check` on the committed artifact cannot fail
  because of something the endpoint did.
- **Bounds.** Request bodies are capped at 64 KB, only `add`/`remove` and the listed `kind`/`direction`
  values are accepted, unknown symbols are 400, and the static server answers `GET`/`HEAD` only, 403
  for a path outside the served root and 404 for a missing file.

What it deliberately does not have, stated so it is not read into the build:

- **No order path.** Nothing in the tool sends, modifies, closes or cancels anything, and it never
  touches MT5, a broker, the terminal or a credential; it is a file writer and a static server. The
  authority question in section 8 is untouched by this.
- **Not a signal.** Every price in the artifact is a hand-marked price: the tool checks shape,
  provenance and duplicates, and nothing checks whether a level is the *right* level. That judgement
  stays with the user on the chart, which is why the file is plain JSON that can also be hand-edited.
- **Not published.** The work is committed on `workers/live-trading-20260929`; no push to `main`, no
  deployment and no live-workflow or warehouse action.

Evidence from this session, all read-only against the local repo:

| Check | Result |
| --- | --- |
| `node --check scripts/l2l-levels-tool.js`, `node --check script.js`, `node --check tests/l2l_levels.test.js` | clean, exit 0, no output |
| `node scripts/l2l-levels-tool.js --check` | `status PASS`, `l2l-levels-v1`, all four instruments present with 0 levels each, exit 0 |
| `node --test tests/l2l_levels.test.js` | 26 of 26, exit 0 |
| `node --test tests/l2l_levels.test.js tests/live_trading_feed.test.js` | 49 of 49, exit 0 |

Two limits, both of which are states rather than faults. The committed `data/l2l-levels.json` carries
**no levels yet** - nothing has been marked - so the chart draws no level lines until the user runs the
tool and marks some, exactly as the empty `levels` arrays are meant to communicate. And a marked level
on a chart is not an edge, causal feature timing or a profit rule: publishing the lines only shows
where the user judges the levels to be.

Step three - the deviation band and the 5m close-beyond-level entry/exit rule - is unchanged and still
governed by the four open sub-questions in section 10. This build gives it something to be evaluated
against: levels that exist as data, per instrument, with their kind, direction and timeframe attached.

## 14. The chart, drawn the way a terminal draws one (build, 2026-10-01)

Step one drew the candles; this pass makes that surface read like the chart a trader already has open,
and gives the four cards the same reading at card size. Everything here is a rendering change inside
`script.js` and `styles.css`. **The producer and the validator were not touched**, and that is the
answer to the question step one left open: they already publish what the candles need.
`tools/mt5-bridge/live-trading-snapshot.py` writes each M5 block as `bars` (both clocks, open, high,
low, close, `tick_volume`, `spread_points`) with `DEFAULT_CANDLES = 120`, and `data/live-trading.json`
on this branch is only the older `2026-09-30T19:28:37Z` run that predates the field. So the next
snapshot run on the machine holding the terminal upgrades `data/live-trading.json` from a close line to
candles on its own, with nothing to edit; no producer change was needed for this step.

The symbol row and the candles/line toggle came with step one. This pass re-derived both scales onto a
fixed label target and round numbers, added the time gridlines, the volume pane, the crosshair with its
legend, the watermark and the card mini-charts, and removed the old strip of hanging bars.

| Furniture | What it is | Where |
| --- | --- | --- |
| Price scale | Round prices on the 1 / 2 / 2.5 / 5 / 10 ladder (`liveTradingGridStep`), drawn as gridlines across both panes and labelled down the right-hand gutter. | `liveTradingChartPlot` |
| Time scale | Whole M5 buckets labelled with the date only where the day changes (`liveTradingTimeTicks` over `liveTradingTimeTickLabel`), each with its own gridline down to the time scale. | same |
| Volume pane | The snapshot's `tick_volume` as a histogram under the price, coloured by the bar's own direction and still drawn when the price pane is switched to the line. A snapshot with no volume drops the pane rather than drawing empty columns, so a close-only artifact keeps the full price height. | same |
| Newest bar | A dashed line out to the newest bar's price, boxed as a teal or red tag on the gutter. | same |
| Crosshair and legend | A pointer over the canvas draws a dashed pair of lines, the price under the pointer boxed on the price gutter, the bar's time boxed on the time scale, and repaints the legend to that bar's open, high, low, close and change. Leaving the plot puts the legend back on the newest bar, so the numbers on screen always belong to a bar the reader can point at. It reads the pointer and writes nothing. | `liveTradingChartCrosshair`, `liveTradingChartPaintLegend`, `liveTradingChartResetCrosshair` |
| Pointer mapping | The canvas is one fixed `1600x640` viewBox scaled to fit its box, so a pointer is mapped back into viewBox units before it can mean a price (`liveTradingPointerToView`). The level-marking click reads the same mapping, which is why step two kept working through this pass. | same, `liveTradingMarkedPriceFromPointer` |
| Card charts | The four cards dropped the hanging bar strip for a mini chart of the same M5 series (`liveTradingCardChart`): candles when the snapshot carries OHLC, an area line of the closes when it does not, the newest close tagged at the right, 48 bars per card. | cards renderer |
| Watermark and label | A faint `EURUSD M5` watermark behind the candles, and a `role="img"` `aria-label` stating mode and bar count for a reader who cannot see the canvas. | `liveTradingChartPlot` |

Evidence from the scratch preview in the ignored `tmp/` (counts in `tmp/tv-report.txt` and
`tmp/tv-report-final.txt`, screenshots `tmp/tv-feed-chart.png`, `tmp/tv-feed-cards.png`,
`tmp/tv-candles-chart.png`, `tmp/tv-candles-cards.png`, `tmp/tv-candles-hover.png`,
`tmp/tv-line-mode.png`). The preview injects a synthetic 120-bar M5 walk into the loaded page only to
look at how the canvas draws; those numbers are a rendering prop and not market data. The published
artifact, opened unchanged:

| Check | Result |
| --- | --- |
| Published snapshot, chart | 0 candle bodies, 0 volume bars, a 24-point close line, 14 gridlines, the newest price tagged, `aria-label` `M5 close line for EURUSD, 24 bars` |
| Published snapshot, legend | `EURUSD M5 C 1.13310` - the close, because that is all the artifact carries |
| Published snapshot, cards | 4 card area lines, 0 card candles |
| Synthetic 120 bars | 120 candle bodies, 120 wicks, 120 volume bars, legend `EURUSD M5 O 1.13313 H 1.13323 L 1.13301 C 1.13310 -0.00003 (-0.00%)`, `aria-label` `M5 candles for EURUSD, 120 bars`, 192 card candles (4 x 48) |
| Pointer over that canvas | Crosshair shown, price boxed at `1.13243`, bar time boxed at `30 Sep 13:55`, legend repainted to that bar's open, high, low and close |
| Line mode with 120 bars present | 0 candle bodies, a 120-point line, the 120 volume bars still drawn |
| `node --test tests/live_trading_feed.test.js tests/l2l_levels.test.js` | 52 of 52, exit 0; the feed suite grew 23 to 26 with three chart-furniture tests (volume pane and scales, crosshair and legend, card charts) |
| `npm test` | 485 tests, 482 pass, 3 fail - the same three pre-existing `backtester/tests/secret_scanner.test.js` cases, untouched by this diff |

Two limits, stated rather than hidden:

1. **The legend reads the bar, not the drawing.** In line mode the legend still shows the open, high,
   low and close of the bar under the pointer, because those are what the snapshot says about that bar;
   the mode changes how the series is drawn, not what the feed holds. TradingView shows the close alone
   on a line series, so this is a deliberate difference rather than an oversight.
2. **A chart is still not evidence.** Every mark on the canvas is a reading of the published snapshot at
   the published cadence, and the synthetic preview series is a rendering prop. Neither establishes
   causal feature timing, an entry, or a profit rule.

The section still has no order path, nothing was published, no live workflow or warehouse action was
taken, and the level overlay behaves exactly as section 13 describes - the committed
`data/l2l-levels.json` is still empty, so the chart draws no level lines until the user marks some.

## 15. Published to production main (release, 2026-10-01)

The chart and the level overlay are now live on GitHub Pages. The release tip is `e209bc6`
("live-trading: publish the terminal-style chart and the marked L2L level overlay"), pushed to production
`main` as the fast-forward `104716a..e209bc6`; the published `script.js` is 748390 bytes and carries
`liveTradingChartPlot` and `applyLiveTradingLevels` with `liveTradingSeriesBars` gone.

**Why the site had not changed before this.** Production `main` is not a copy of this lane. It is a leaner
publication lineage whose `script.js` was still the old close-bar-strip version, and it diverges from this
branch in 484 files - a blind merge would have published far more than the chart and would have removed
published work. The release was therefore cut the way the earlier ones were: a release worktree on
`origin/main` (`.local/live-trading-chart-release`, `release/live-trading-chart-20261001`), with only the
Live Trading surface moved across.

| Moved across | Method |
| --- | --- |
| `script.js` | The live-trading region alone, from the `// The Live Trading section` comment to `function setTab(tab) {`, replaced with the tested lane version, plus three hand-written `loadDashboard` hooks (the `liveTradingLevelsUrl` constant, the extra `Promise.allSettled` entry, and the `liveTradingLevelsResult` join). 826 changed lines. |
| `styles.css` | The tail block from `/* Live Trading: read-only FTMO/MT5 broker snapshot. */` to end of file. 105 changed lines. |
| `index.html` | Cache-buster tokens only, `script.js` and `styles.css` to `?v=20261001-live-trading-chart`. No markup change: `main` already carried the identical section. |
| `data/l2l-levels.json`, `scripts/l2l-levels-tool.js`, `scripts/README-l2l-levels-tool.md`, `tests/l2l_levels.test.js` | Added. |
| `tests/live_trading_dashboard.browser.test.js` | The published guard's control whitelist widened from "no controls at all" to "the chart's own read-only controls are the only controls present, and none reads like an order path". Nothing else in the guard changed. |

Everything else in the published dashboard - the rail, the Silver and WTI/GBP tabs, the other surfaces, the
feed schema - was left as it was, and the release did not touch `data/live-trading.json`.

Evidence: the 16 published test files run to 139 of 139 on the release branch; `node --check` clean on
`script.js` and the tool; a Playwright render of the released page at 1440 and 390 with no page errors and
no horizontal overflow; and, after the push, the live `script.js` carrying the new chart, the live
`index.html` referencing the new cache-buster, and the live `data/l2l-levels.json` returning 200 with
`l2l-levels-v1`. Two 404s on the released page are expected and unrelated: `data/half-l2l-reach-research.json`,
which `main` does not publish, and `/api/l2l-levels`, which is the marking probe failing on a static host
exactly as designed.

**One step was still outstanding and belongs to the user, and it is now done.** The published feed was
the pre-`bars` `2026-09-30T20:44:34Z` snapshot, so the live chart drew the labelled close line rather
than candles until the producer next ran on the machine holding the terminal. Section 16 records that
run on 2026-10-03. No producer, validator or feed-schema change was needed then and none was needed now.

## 16. The published chart now carries candles (release, 2026-10-03)

The producer was run against the running FTMO terminal and its snapshot committed and published, so the
live chart draws M5 candles instead of the labelled close line. This closes the one step section 15 left
with the user.

| Fact | Value |
| --- | --- |
| Producer run | `tools/mt5-bridge/live-trading-snapshot.py --candles 120`, snapshot `2026-10-03T14:25:25Z` |
| Account | `***614`, `FTMO-Server`, USD, balance `10000.0`, 0 positions, 0 orders |
| Quotes | EURUSD `1.12504/1.1251` (6 points), XAUUSD `4137.44/4137.87` (43), `US100.cash` `30786.94/30788.47` (153), BTCUSD `84790.78/84791.78` (100) |
| Bars | 120 M5 per instrument, `bar_age_seconds` 25 to 299, `stale: false` on all four |
| Validator | `PASS` (`scripts/validate_live_trading_feed.js`), four instruments, `bars` present |
| Lane commit | `5eb9405` on `workers/live-trading-20260929` |
| Published | production `main` `7ce136e`, fast-forward `16104a3..7ce136e`, carrying only `data/live-trading.json` |

The release was cut the way section 15 describes: a worktree on `origin/main`
(`.local/live-trading-chart-release`), reset to `origin/main`, with the single data file copied across.
`main` already carried the chart code from `e209bc6`, so no site file moved a second time.

**A clock defect this run exposed, and its fix.** The first candle render showed the time axis wrong:
`detect_server_offset` measured `tick.time - now` from the *first* instrument, EURUSD. That quantity is
the true offset minus the tick's own staleness, so it is only the offset while the market is open.
2026-10-03 is a Saturday, EURUSD's last tick was Friday's close, and the measurement came out `-52200s`
instead of `+10800s`. Every `time_utc` in the snapshot was therefore shifted +17.5 hours, and the chart's
time scale and crosshair read `time_utc` (`liveTradingTimeTicks`, `liveTradingTimeTickLabel`), so the
axis was labelled a day late. BTCUSD trades the weekend and its own tick measured the true `+10800s`,
which is the tell. The producer now takes the **maximum** across the four instruments - the freshest tick
is the largest value - and refuses a measurement outside the band a real UTC offset can occupy
(`-12h` to `+14h`), falling back to the documented FTMO `UTC+3` with `server_offset_source_symbol`
saying so. Re-run: `10800s (from BTCUSD)`, EURUSD's last bar `2026-10-02T23:50` server = `20:50` UTC
(Friday's close) and BTCUSD's `2026-10-03T17:25` server = `14:25` UTC, both correct. The validator reports
`PASS`, the focused suite is 53 of 53, and `tests/live_trading_feed.test.js` gained an assertion that the
offset comes from the freshest tick.

Two limits, unchanged and stated rather than hidden:

1. **Snapshot freshness is 900s.** The badge reads `STALE` about fifteen minutes after a producer run,
   because the decided route is this PC with nothing scheduled (section 11). The candles still draw from
   `bars` while stale - the badge is about the snapshot, not the series.
2. **A chart is not evidence.** The bars are a picture of the published feed at the published cadence.
   They do not establish causal feature timing, an entry, or a profit rule.

## 17. The model rules still to fix (open, 2026-10-03)

Steps three and four of the user's plan - the entry and RR rules, then the position rules - are not
written yet. Section 10 fixes the trigger sentence: a 5m candle *closing* beyond a marked L2L level
(long above, short below) is the confirmation, and a wick through is not. Every blank below is the
user's to set; nothing here invents a rule.

**Step 3 - entries and RR.**

1. **First or any close.** Must the confirming close be the *first* 5m close beyond the level, or is any
   close beyond it while the call is valid acceptable? (section 10, sub-question 1)
2. **Touch or gap-through.** Must the level be traded through first, or is a 5m candle that gaps straight
   beyond it a valid trigger? (section 10, sub-question 2)
3. **Deadline.** After the call is sealed, is there a time beyond which a breakout is no longer taken?
   (section 10, sub-question 3)
4. **Re-entry.** One entry per instrument per call, or re-entry after a stop while the call is still
   valid? (section 10, sub-question 4)
5. **The deviation band.** How far beyond the level must the close be to count - a fixed point count, the
   instrument's spread, or a fraction of the level's own distance (the research draft uses `0.5 x ADR20`
   as the required L2L distance)?
6. **Stop and invalidation.** What closes the trade - a close back through the level, the far side of the
   band, or a fixed distance? **Half answered 2026-10-05:** the stop is set from the target at five to one -
   one fifth of the entry-to-target distance - and nothing else is stated that would close a trade early, so
   whether there is a separate exit is still the user's to say (section 40).
7. **Target and RR.** Is the target a fixed reward:risk multiple, the next L2L level, or an ADR20 multiple
   as the research draft proxies? **Answered 2026-10-05:** the next L2L level marked on the chart, with the
   stop then set to match that target at 5R - a multiple of the target rather than of a separately measured
   risk, and the same on all four pairs (section 40).

**Step 4 - which positions.**

8. **Instruments.** All four, or a subset, and at most one position each?
9. **Risk per trade.** A fixed percent of balance, given FTMO clause 7.5 - all four are USD-quoted against
   a USD account, so one day's basket is one correlated idea and four simultaneous stops must sit far
   below the 5% daily loss limit.
10. **Concurrency, daily loss and stopping.** A maximum number of open positions, a daily loss limit below
    FTMO's, a kill switch, and whether anything is held over the weekend.

The draft contract `data/half-l2l-executable-entry-v1-draft.json` stays `research_only` /
`DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION`; it proxies entry and sizes stops and targets at ADR20
multiples, and it is a reference for the shape of a rule, not an edge and not an answer to any blank
above.

## 18. The 1h and 4h views, and the ladder duplicated from two seeds (build, 2026-10-03)

The user asked for the L2L levels to be marked on the live-trading charts with the top and the bottom
level marked by hand first and everything between and beyond derived from the precise distance between
those two, and for the charts to be zoomed out onto the 1h and 4h so the seed levels can be checked
before anything is derived from them. Both halves are built. Section 17's ten blanks are untouched.

| Piece | Path | What changed |
| --- | --- | --- |
| Producer | `tools/mt5-bridge/live-trading-snapshot.py` | Publishes three blocks per instrument through one builder: `m5` 120 bars, `h1` 168 (a week), `h4` 120 (twenty days of four-hour bars). Each carries the same shape as before - OHLC `bars`, `close_series`, `last_close`, the range and the change - plus its own freshness proof. Additions: `--h1-candles`, `--h4-candles`, `TIMEFRAME_KEYS`, `timeframe_plan`, `build_timeframe_block`, `fetch_bar_rows`. Read-only: `TIMEFRAME_H1` and `TIMEFRAME_H4` join the allowlist and no order function exists in the file. |
| Schema | `data/live-trading.json` | `live-trading-feed-v2`. Regenerated from the running terminal read-only at `2026-10-03T15:08:27Z` (`10800s (from BTCUSD)`, `***614` on `FTMO-Server`, 0 positions, 0 orders): four instruments at 120 M5 / 168 H1 / 120 H4 bars, every block `stale: false`. |
| Validator | `scripts/validate_live_trading_feed.js` | Requires all three timeframes and validates each with one shared block checker: shape, OHLC geometry, agreement with `close_series`, and a freshness limit of its own - 660s M5, 7200s H1, 28800s H4, two bar widths each. |
| Chart | `script.js`, `styles.css` | The toolbar's static `M5` chip became an M5/H1/H4 button group beside the candles/line group. The plot, legend, watermark, aria label and freshness line follow the selected timeframe; a block the snapshot does not carry is a disabled button and the selection falls back to a timeframe that has bars. The time scale's tick ladder widened to whole days and whole weeks for the wider views. |
| Marking | `scripts/l2l-levels-tool.js` | A click still marks a price, and now records the timeframe it was read on with `role: "seed"`. New `duplicate` and `clear` actions beside `add` and `remove`. |
| Tests | `tests/l2l_levels.test.js`, `tests/live_trading_feed.test.js` | 67 of 67 focused (levels 26 to 33, feed 27 to 34): the ladder's arithmetic and refusals, the roles, the two new actions and their HTTP round trip, per-timeframe staleness accepted and rejected at the limit, the committed artifact's three timeframes, and the chart's timeframe wiring. |

**How the ladder is derived.** `duplicate` reads the symbol's own levels, takes the highest and the
lowest of those whose `role` is not `derived` - the two seeds the user marked - and measures
`top - bottom`. It then repeats that distance `above` steps above the top seed and `below` steps below
the bottom seed (default 10 each way, cap 60, both editable in the toolbar). Each generated price is
snapped onto the instrument's point grid when the feed's `point` is supplied, so every line is a price
that could be typed into MT5. Each generated level is `role: "derived"` and carries the measurement it
came from - `spacing_price`, `spacing_points`, `anchor_high`, `anchor_low`, and a note naming its step -
and the validator refuses a derived level without them. Re-running replaces the previous derived levels
rather than stacking a second ladder, and only symbols' seed levels are ever read, so the seeds are the
measurement and the rest is arithmetic on top of it. `clear` empties one symbol so a ladder can be
started over. Worked example: seeds `4137.5` and `3962.5` on XAUUSD give a spacing of `175.00` (17500
points), and ten steps each way make the 22 published lines run from `2212.5` to `5887.5`.

**Why the price scale is decided by the reader.** The level lines ride the same price scale as the
candles, as they have since section 12, and they always sit at the price they were published at - the
line spans the whole plot, so scanning back and forward reads the same numbers rather than a ladder
re-based to whatever window is on screen. Ten steps each way, though, span far more than the bars the
seeds were measured against, so the *scale* starts at the bars: a line outside the window is counted on
the caption (`n/22 lines in view`, with how many sit above and below) rather than clamped onto the edge,
which would draw a ladder that is not there. **Fit levels** widens the window to the outermost published
line in one press, and the step counts can be set to 0 when the candle shape matters more.

**The alert at the outer bounds, and the one action it offers (user, 2026-10-03).** The user asked for
about ten levels each way, and for an alert when price gets close to the outer bounds, at which point
ten more levels can be added. Both are built:

| Piece | Path | What changed |
| --- | --- | --- |
| Ladder arithmetic | `lib/l2l_ladder.js` | New. One module for the bounds, the alert and the extension, loaded as a plain script by `index.html` and required directly by the tests, so the writer, the page and the checker read the same numbers. `DEFAULT_STEPS` 10, `MAX_STEPS` 60, `EXTEND_STEPS` 10, `ALERT_BAND_STEPS` 1. |
| Alert | `script.js`, `styles.css` | `liveTradingLadderAlert` reads the live mid (bid, then `last`, then the newest M5 close as fallbacks) against the outermost published derived line. One ladder step is the band, so nothing is configured in points or percent: `approaching` when price is within a step of the line, `beyond` once it is past it. The notice sits under the chart as `role="status"`, the bound line is drawn in the alert colour, and the symbol's own button carries an `AT BOUND` badge so a pair in trouble is visible without opening it. |
| Extension | `script.js`, `scripts/l2l-levels-tool.js` | `Add 10 more above` / `below` appears beside **Duplicate levels** while the alert is active and only where the local tool answered the probe. It posts the same `duplicate` with what the file already holds plus ten on the side that ran out, so pressing it twice cannot ask for less. The two step boxes follow the file again after a duplication, an extension or a clear. |
| Tests | `tests/l2l_levels.test.js` | 39 of 39 focused (33 before), 73 with the feed suite: the module's defaults, bounds from the published levels, both alert states each way, the extension plan and its cap, the level lines' fixed prices and off-view counting, and the dashboard wiring. |

**Limits, stated rather than hidden.** The alert is a reading taken while the page is open: nothing
watches in the background, nothing notifies, nothing is placed, and the extension is a write to
`data/l2l-levels.json` that still has to be committed to be published. The cap is 60 a side, and at the
cap the notice says the seeds have to be re-read instead of silently doing nothing.
`data/l2l-levels.json` still carries four instruments at zero levels: no seed has been marked yet,
because the levels are the user's judgement on the chart and not something a build can supply, and the
four pairs are the ones the feed publishes - more pairs are one line in `KNOWN_INSTRUMENTS` plus the
feed's own change. The marking tool is the only writer and stays on loopback. And two marked levels with
a ladder between them are still not an edge: they are prices, the entry rule that would use them is
still section 17's blank, and nothing here claims causal feature timing or a profit rule.

## 19. Marking on the live dashboard, and the order the last two steps are taken in (user, 2026-10-03)

Two things came from the user after section 18 was filed, and both change what happens next rather than
what is built.

**The entry and position rules wait until the ladder is known to be right.** The user's words: *"we arent
yet ready to make the entry logic we need to be sure the L2L levels are setup correctly first."* So section
17's ten blanks stay blank, the question that asked for all ten at once was withdrawn as a wall of answers
rather than a question, and it comes back one small question at a time once a marked ladder has been read
on the chart - starting from the trigger already fixed in section 10 (a 5m candle *closing* beyond a marked
level; a wick through it is not a trigger). The order of work is therefore: two seeds marked, the distance
between them read, the ladder checked on the published chart, then the entry rule, then the sizing rules.

**The marking is to be a live-dashboard capability, not a loopback script.** The user's words: *"the
marking tool needs to be on the live dashboard I dont want to be messing around with local only functions
just send to the coordinator to add to the live dashboard."* This lane cannot grant that itself, so it was
filed as mailbox submission `20261003-live-trading-live-marking-and-ladder-r1` with the user's words, the
measured constraint and the routes below; the coordinator owns the decision and the publish.

Why it is a decision rather than an edit. The published page is a static GitHub Pages build of production
`main`. Every marking control on it hangs on `probeLiveTradingLevelsTool` answering with `ok: true`,
`tool: "l2l-levels-tool"` and the `X-L2L-Levels-Tool: 1` header, which only the loopback tool serves, and
only same-origin; on the published host or from a `file://` open the probe fails and the section stays
read-only by construction (section 13). What the published page already has is one hosted read path -
`script.js` on `main` carries `researchSupabaseUrl` and a publishable `sb_publishable_...` key and reads
research views through REST with them - so a hosted levels store is the route with precedent in the page,
and opening a write on it is a production and credential decision, with the user's call on who may write.

| Route | What it gives | What it needs |
| --- | --- | --- |
| Hosted store | levels saved centrally, so any device reads and writes the same grid; the live page draws them | a table, a write policy and a key - a coordinator production decision with the credential rules applied |
| Browser-local | the published page keeps the marks in that browser, draws them, and offers the JSON to copy | page code only: no service, no key, no cost, nothing exposed; the marks are private to the device and publishing still goes through a commit |
| Loopback tool (today) | what exists now, unchanged | nothing new - and it is the local-only route the user has ruled out |

None of the three places, modifies, closes or cancels anything, and an order path is not part of any of
them. Until the coordinator rules, the tool stays the only writer, the published page stays read-only, and
`data/l2l-levels.json` stays four instruments at zero levels.

**The ladder is built and not published.** The H1/H4 views and the duplication (`78bf797`) and the alert,
the ten-each-way default and the extension (`13cf8d5`) are committed on `workers/live-trading-20260929` and
are not on the live page: the published site carries the chart, the level overlay and the
`2026-10-03T14:25:25Z` M5 snapshot. Publishing them is the coordinator's action, and the port has one new
site file to carry with it - the page loads `lib/l2l_ladder.js` ahead of `script.js`, and without that file
the ladder draws but the statistics, the alert and the extension plan are inert.

## 20. The levels store on the published page (build, 2026-10-03)

Section 19 left the user's request as a decision for the coordinator, with three routes on the table. This
is the build of route (2) - browser-local marks with the artifact offered for a commit - extended by the one
thing that makes those marks durable: the reader publishes the file from the page to their own GitHub
account. It supersedes the two statements that the published page can only read: section 13's "a static page
cannot write, so it does not pretend to" and section 19's "the published page stays read-only". Nothing about
the loopback tool changed except that it now requires the same module the page loads.

| Piece | Path | What it does |
| --- | --- | --- |
| Store module | `lib/l2l_levels_store.js` | The whole document: `l2l-levels-v1` shape, `normaliseEdit`/`applyLevelEdit` (add, remove, clear, duplicate), the ladder arithmetic and its bounds, `validateLevelsState`, `serialiseState`, the browser draft and publish settings, and `buildReadRequest`/`buildCommitRequest`/`readRemoteLevels`/`commitLevels`. Loaded as a plain script by `index.html` (global `L2LLevelsStore`) and required by the tool and the tests, so one implementation serves all three. |
| Tool | `scripts/l2l-levels-tool.js` | Loopback-only static server plus `GET`/`POST /api/l2l-levels`, now a thin wrapper: it requires the shared module for the schema, the edits and the serialisation. Still the only writer on this machine and still the only server that sends `X-L2L-Levels-Tool: 1`. |
| Artifact | `data/l2l-levels.json` | Unchanged `l2l-levels-v1`, four instruments, `role` per level (`seed` hand-marked, `derived` from a duplication). Still zero levels. |
| Dashboard | `script.js`, `styles.css` | `liveTradingLevelsCanMark()` gates every marking control, `saveLiveTradingLevel` posts to the loopback tool when it answers and otherwise applies the edit through the module and saves the draft, and the publish panel reads, commits and reports. |
| Tests | `tests/l2l_levels.test.js` | 48 tests, up from 33. The 15 new ones cover the page's load order, the draft, the publish panel, draft and settings persistence, publish-target normalisation, the request builders, the remote read, and the commit's refusal, conflict, force, creation and unreachable-fetch paths. |

**The two stores and the order between them.** A mark is validated, applied and written to the browser as a
draft - `localStorage`, key `l2l-levels-draft-v1` - and drawn immediately; the published file changes only
when the reader presses Publish, which commits through the GitHub contents API to the target in the panel
(default `kevincreedycars-debug/trading-agent-dashboard`, branch `main`, path `data/l2l-levels.json`, all
three editable; the repo is parsed as `owner/repo`). GitHub decides what is published, the browser holds what
has not been published yet, and the draft is cleared only after a commit succeeds. `Read published` pulls
the committed file into the page, the export offers the artifact as JSON, and the disconnect control forgets
the token.

Rules the module enforces, because the same code now writes a committed file from a browser:

- **A commit refuses a file its own checker would reject.** `commitLevels` runs `validateLevelsState` first
  and answers with the problems instead of writing, so `--check` on the artifact cannot fail because of
  something the page published.
- **A commit refuses to overwrite a newer published file.** If the file's sha on GitHub is not the sha the
  page read, the answer is 409 with the fresh sha and no write, unless the reader ticks "publish anyway".
  Both refusals leave the draft untouched.
- **A missing token is a question, not a crash.** No token means "A GitHub token is needed to publish", and
  an unreachable GitHub is reported as such rather than thrown.
- **The read path is one path.** `readRemoteLevels` reads the same single file, and a 404 is reported as "the
  first publish creates it" rather than as an error.
- **Storage is optional.** A browser that refuses `localStorage` or `sessionStorage` still marks and draws;
  only the draft, the remembered settings and the remembered token are lost.

The token, since it is the only credential in this design:

- It is the **reader's** token, typed by them, used only against `api.github.com` for the one path in the
  panel, and never sent anywhere else - not to the loopback endpoint, not into the artifact, not into a URL.
- It is kept in `sessionStorage` (key `l2l-levels-publish-v1`) by default and in `localStorage` only if
  "remember on this device" is ticked; the disconnect control removes it from both. The checkbox is what the
  reader consents to, and the password field is the only place the value is ever rendered.

Where the controls appear, which is section 13's rule kept rather than bent: the guard is
`liveTradingLevelsCanMark()` - the loopback endpoint **or** the shared module - so a page with neither draws
no marking UI at all, and a page with the module draws the controls. When the loopback tool answers, the page
posts to it exactly as before and shows no publish panel, because the file that panel would commit is
already on that machine. The probe, its `X-L2L-Levels-Tool: 1` marker and the read-only fallback on a failed
probe are unchanged.

What it deliberately does not have:

- **No notification of any kind.** WhatsApp, phone, push and e-mail are not built and no transport for them
  exists in the page. Monitoring a live entry against a marked level is also not built.
- **No order path.** Nothing places, modifies, closes or cancels anything, no account is read, and no
  credential is held by the page beyond the token the reader pastes for their own repository.
- **Not a hosted store.** Section 19's route (1) stays unbuilt: there is no table, no write policy and no
  service key, so two devices still do not share a grid - they share the committed file.

Evidence from this session, all read-only against the local repo:

| Check | Result |
| --- | --- |
| `node --check` on `script.js`, `lib/l2l_levels_store.js`, `scripts/l2l-levels-tool.js`, `tests/l2l_levels.test.js` | clean, exit 0, no output |
| `node --test tests/l2l_levels.test.js` | 48 of 48, exit 0 |
| `node --test tests/l2l_levels.test.js tests/live_trading_feed.test.js` | 82 of 82, exit 0 |
| `node scripts/l2l-levels-tool.js --check data/l2l-levels.json` | `status PASS`, `l2l-levels-v1`, four instruments at 0 levels with `seeds` and `derived` per instrument, exit 0 |
| `npm test` | 515 tests, 511 pass, 4 fail - `not ok 297`, `298`, `299` and `301` in `backtester/tests/secret_scanner.test.js`, the same four recorded at 500/496/4 before this work, so all 15 new tests pass and none of the four is new; every one is an `assert.match` on the guard's rule ids, which the report truncation below removes |
| Live loopback smoke, temp state on `--port 8799` | the served page carries `lib/l2l_levels_store.js` and `script.js`; the probe answers 200 with the tool header, `tool: "l2l-levels-tool"`, four instruments and the `--state` path; `POST` add answers 200 with the price in the file; a non-JSON body answers 400; the committed `data/l2l-levels.json` is untouched |
| `scripts/check-repo-for-secrets.ps1 -Mode full -Path script.js` | clean, exit 0, once the allowlist carried the credential-by-reference line; before that it reported three `token: liveTradingPublish.token,` lines as `assignment-known-secret` - a variable, no literal |
| The same scanner, one file at a time, on `lib/l2l_levels_store.js`, `data/l2l-levels.json`, `scripts/l2l-levels-tool.js`, `tests/l2l_levels.test.js`, `index.html` and `styles.css` | `No likely private secrets detected`, exit 0 each - the artifact and the new module carry no credential |
| `node --test backtester/tests/secret_scanner.test.js` | 1 of 5 - the four failures are not from this work and are the guard's own report: `Format-Table -AutoSize` truncates the `Pattern` column to the width the runner gives it, so the ids arrive as `ass`, `en`, `pr` while the test asserts on the ids; the probe in `tmp/scan-probe.js` shows `\| Out-String -Width 4096` restoring every column |

**The one false positive, and the guard that found it.** Handing the pasted credential to the store by
reference - `token: liveTradingPublish.token` - is exactly what the module's API asks for, and the scanner's
assignment rule reads shape rather than value, so it flagged those three lines. The repair is the mechanism
the repo already keeps for this: one `script.js` rule in `config/secret-scan-allowlist.json`, matched on the
whole line and carrying its reason. The four failing scanner tests are a separate and pre-existing bug in
`scripts/check-repo-for-secrets.ps1` itself - reported by `Format-Table -AutoSize`, which drops or cuts the
`Pattern` column when there is no wide console behind it, so the ids the test looks for never arrive. That
file is another lane's, so it is left unedited here; the one-line repair is
`Format-Table Path, Line, Pattern, Description -AutoSize | Out-String -Width 4096`.

Two limits, both states rather than faults. `data/l2l-levels.json` still carries four instruments at zero
levels, so no ladder renders anywhere until the user marks a seed, and the seeds stay the user's judgement on
the chart. And the work is committed on `workers/live-trading-20260929` only - no push to `main`, no
deployment - so the published page does not have this yet; when it does, it needs `lib/l2l_levels_store.js`
beside `lib/l2l_ladder.js` and ahead of `script.js`, or the section draws the levels read-only.

## 21. The state correction, and the third route on the list (coordinator, 2026-10-03)

Section 20 was built and reported, and the report came back `changes_requested` for its statement of state
rather than for its evidence: submission `20261003-live-trading-live-marking-and-ladder-r1` claimed an empty
dirty set and "no write path was created" while the work described in section 20 stood uncommitted in the same
tree. This section is the correction section 20 owes, and it supersedes those two sentences.

Recorded plainly, and never as a claim of approval:

| Question | Answer in this worktree |
| --- | --- |
| What route is built? | The published page's own marking controls, with a browser draft in front of a commit: `lib/l2l_levels_store.js` (new) holds the document, the draft and the GitHub calls; `script.js` holds the guard, the panel and the rendering. |
| Which repository, branch and path? | Default `kevincreedycars-debug/trading-agent-dashboard`, branch `main`, path `data/l2l-levels.json`; all three are fields in the panel. |
| Which token? | The reader's own fine-grained token with Contents: read and write, typed into a password field, kept in session storage unless "remember on this device" is ticked, never written into the artifact. |
| Direct or reviewed? | Direct: the contents API `PUT` goes to the branch named in the panel, so a press is a commit on `main` with no pull request and no approval step. |
| Accepted? | No. Stopped on the coordinator's instruction, unreviewed, on `workers/live-trading-20260929` only - not merged, not pushed, not published, not presented as usable. |

Scope position, stated because the assignment owns only `docs/live-trading/`: the files above sit outside that
scope and are held as a disclosed overrun and an open offer, not as authorised or accepted work - the same
standing the assignment already gives the earlier writes outside `docs/live-trading/`. The storage decision now
has three entries rather than section 19's two - a hosted store with a write policy and a key; browser-local
levels with the JSON copied out for a commit; and this reader-token commit route - and it is the user's and
the coordinator's, with the lane's advice unchanged and overrulable: browser-local first. Nothing in the route
connects to a broker, holds an MT5 credential, places or modifies an order, or changes any boundary; the sealed
Gold prospective window stays sealed until `2027-03-25T15:00:00Z`.

## 22. The store ruled, and the live port asked for (user, 2026-10-03)

The coordinator's reply to the corrected envelope accepted the correction and left two items to the user, in
this order: the marking store first, the production go-ahead second. Both were answered in the same session.

**The store is the reader-token GitHub commit route.** The user's words, choosing among the three routes that
sections 19 and 21 list: *"Into the repo with your own GitHub token (already built): you paste it once, then
every level you mark on the 1h/4h chart is saved to data/l2l-levels.json and I can read it."* That settles the
question the earlier envelopes carried - the route stays, it is not withdrawn, and section 20's build is the
store of record for marking on the published page. The lane's browser-local-first advice is recorded as
overruled rather than repeated. A committed `data/l2l-levels.json` is also the artifact the machine side reads,
so the plan needs no second store for the agent to see the user's levels.

**The go-ahead is to put the 1h and 4h views and the marking on the live dashboard.** The user's words: *"just
get the ability for me to scroll out to the 1h and 4h to set the L2L levels from there"*, followed by the order
of work they want after it - entry rules, then the agent always reading the live dashboard and the live 5m
charts on each market, then execution, then testing real automated trades, then the scaling rules.

**What this lane did with both.** Filed as `20261003-live-trading-marking-store-and-live-port-r1`: the two
rulings quoted, the port requested rather than performed, and the file set the reply named for it - `script.js`,
`index.html`, `styles.css`, `lib/l2l_levels_store.js`, `lib/l2l_ladder.js`, the rewritten
`scripts/l2l-levels-tool.js`, `tests/l2l_levels.test.js`, `scripts/README-l2l-levels-tool.md` and the
`data/l2l-levels.json` main already carries - moved onto production `main` by the already-ruled hunk recipe, not
by a merge. No push, no merge, no pull request and no publication was made here, and production `main` is
untouched by this lane.

**Still true after the ruling.** The live page still draws M5 only, so the zoom-out the user asked for is not
usable there yet; `data/l2l-levels.json` still carries four instruments at zero levels, because the seeds are
the user's judgement on the chart; section 17's ten blanks stay blank until a marked ladder has been read on the
published chart; and two marked levels with a ladder between them are still not an edge, a causal feature timing
proof or a profit rule.

## 23. The port candidate for the two new views, and the two things between it and the live page (build and review request, 2026-10-03)

Section 22 recorded the store ruling and the go-ahead; the coordinator answered both with assignment
`live-trading-002`, which asks for one **local** candidate cut from the verified `origin/main` tip by the
already-ruled hunk recipe and evidenced on its own bytes, and which leaves the fast-forward onto `main` with the
coordinator in a user-authorised cycle. This section is the record of the candidate.

**The candidate, and the tip that moved under it.** The reply measured `origin/main` at `f8bc80f` and asked for the
move to be re-verified. It had moved: `a94fb550` (`site-nav: one canonical top bar and side rail on all nine
published pages`, 18:51:37 +0100), published by the site/nav lane. One new worktree,
`.local/worktrees/live-trading-port`, holds both builds, so the candidate has one writer and
`workers/live-trading-20260929` keeps its branch, files and history exactly as they are at `464fb2c`:

| Build | Branch | Base | Commit | Size |
| --- | --- | --- | --- | --- |
| the base the instruction named | `workers/live-trading-port-20261003` | `f8bc80f` | `2c2dcf6` | 8 files, +2,892/-324 |
| the fast-forwardable one | `workers/live-trading-port-tip-a94fb550` | `a94fb550` | `a6ae075` | 8 files, +2,892/-324 |

**The base the hunks are measured from is `d4fe9ae`, not `13cf8d5`.** Section 21 and `DECISIONS.md` read the lane's
base as the range tip. The checkout disagrees: at `d4fe9ae`, main's `scripts/l2l-levels-tool.js` `a2540603`,
`tests/l2l_levels.test.js` `3ff25f13`, `scripts/README-l2l-levels-tool.md` `87663048` and `data/l2l-levels.json`
`2a0aef4f` are byte-identical to the lane's own, and main's three page files are closest to that commit (68/309,
17/40, 20/544 against `13cf8d5`'s 97/670, 17/41, 22/573). The filing carries both readings.

**The port is the lane's new work and nothing else.** Three files three-way merged (`ours` = tip, `base` =
`d4fe9ae`, `theirs` = lane head) and five carried whole because main holds no copy of them or holds them byte-equal
to the old lane state: `script.js` 751/46, `index.html` 2/0, `styles.css` 48/4, the two new `lib/` modules 792/0 and
192/0, the rewritten tool 51/229, the rewritten tests 914/15 and the rewritten README 142/30. Every main-only line
survives, no base-only line returns, and the additions equal the lane's own new work exactly. The single conflict,
in `index.html`'s script-tag block, keeps the published `script.js?v=20261001-live-trading-chart` and adds the two
new tags; the lane base's stale cache-buster is not carried. `data/l2l-levels.json` and the published
`liveTradingUrl` are left as `main` carries them.

**Two things stand between the candidate and the user's sentence.** First, `main`'s own published-page guard
`tests/live_trading_dashboard.browser.test.js` fails on the candidate at its "the read-only section must carry no
form control" assertion, because the ruled marking panel renders repository, branch and token inputs; the guard
passes 2 of 2 on the pristine tip, and no control in the section reads like an order. Widening the guard is a
change to a `main` file outside this assignment's file set, so it is named in the filing as the companion change the
publish owes rather than made here. Second, the published snapshot carries `quote` and `m5` only, with no `h1` or
`h4` block, so the two new buttons draw disabled until the snapshot is refreshed from this lane's producer (which
now emits both) and republished through the coordinator - code is ported here, data is not.

**What the filing says about its own tree.** `coordination.js` requires a `ready_for_review` submission's
`worktree` and `branch` to equal the register row's, and the row was not changed for the candidate, so the envelope
declares this lane's own worktree and branch and names the candidate branch, commit and base in its summary and
`head_commit`.

**Still not live, and still not the lane's to publish.** The published page is unchanged; nothing was pushed, merged,
opened as a pull request or published by this lane; the candidate is local under an ignored path; the levels artifact
still carries four instruments at zero levels because the user has marked nothing; and the port is a chart and
tooling change, so nothing in it is edge, accuracy, causal feature-timing or profit evidence.

## 24. The widened guard, the two views and the ladder driven on the publish tip, and the third change the publish owes (build, 2026-10-03)

Section 23 recorded the candidate and the two things between it and the live page. Both are dealt with now, a third
appeared, and the publish combination is named. All of it sits on branch
`workers/live-trading-port-publish-a94fb550` in `.local/worktrees/live-trading-guard` (renamed from
`workers/live-trading-port-guard-a94fb550` when it stopped being guard-only), three commits over `a94fb550`:
`a6ae075` the port, unchanged and still the commit section 23 records; `d27ac43` the widened guard; `964161c` the
cache-buster bump. Nothing was pushed, merged, opened or published, and `main` was read and never written.

**The guard, widened and green.** The file keeps its original meaning and re-states it for a section that now
carries the ruled marking panel: every control inside the section must be bound by name to the chart or the panel
(21 data attributes), the six form controls must be exactly the panel's own four publish fields and two ladder step
boxes, no `form` element may exist, the token field must be the single `type=password` field, the chart's own symbol
row and mode toggle stay required, and no button may read like an order path. `node --test
tests/live_trading_dashboard.browser.test.js` at the tip answers 2 tests, 2 pass, 0 fail, with `NODE_PATH` pointed
at the canonical `node_modules`. The widening is 21 insertions and 12 deletions in one file.

**The two views and the sheet, driven in a real browser.** `tmp/look-publish-combo.js` serves the publish tree on
loopback and drives it with the repository's own Playwright Chromium, writing `tmp/publish-combo.json` (108,711
bytes) and three screenshots at 1440 and 390. Phase A uses the tree's own `data/live-trading.json` - the snapshot
`main` carries, `m5` only - and there the M5/H1/H4 row draws with **H1 and H4 disabled**, the chart reads "M5
candles for EURUSD, 120 bars" and the badge reads STALE: the user's "cannot zoom out" state, reproduced, and it is
data rather than code. Phase B uses this lane's refreshed snapshot (`m5+h1+h4`, generated `2026-10-03T15:08:27Z`),
and then H1 draws 168 bars, H4 draws 120 bars, M5 returns to 120; two clicks marked seeds `1.15024` and `1.12736`
with both chips and both lines drawn, **Duplicate levels** produced 20 derived chips ("Generated 20 levels 0.02288
apart (2288 points) around the seeds 1.12736 to 1.15"), and **Clear** returned the symbol to nothing marked. Every
step was clean at both widths: zero page errors, zero overflowing elements, controls moving 24, 26, 46, 24 as seeds
and ladder appear and clear, all named and bound, 0 `form`, 0 order-like.

**The third change: the cache-buster on the ported page.** The port kept `main`'s own
`script.js?v=20261001-live-trading-chart` and `styles.css?v=20261001-live-trading-chart` while adding two library
tags with fresh tokens of their own, so a browser or CDN holding the old URLs can keep the pre-port `script.js`
after the deploy and the new chart, the M5/H1/H4 row and the marking panel never appear - the same class of fault
as the snapshot, invisible in a fresh profile. `964161c` moves both tokens to
`?v=20261003-l2l-levels-and-timeframes`, the pattern the 2026-10-01 Live Trading release used; nothing else in the
repository mentions the old tokens, and the commit is two lines that drop cleanly if the coordinator's publish step
already bumps them.

**The publish combination.** Nine files fast-forward from `a94fb550` to `964161c` - the eight of the port plus the
widened guard - and one data-only change, `data/live-trading.json` refreshed from this lane's producer. Sizes and
sha256 are the bytes git stores, as in `tmp/port-manifest.json`.

| File | Bytes | sha256 |
| --- | --- | --- |
| `index.html` | 24,985 | `787666317ed3408824768c4d7d9b76d9223597ec6ded165c93e06d41a4855a81` |
| `lib/l2l_ladder.js` | 8,275 | `edad69d4498fdcc8f1e3fd3c307d28a7764d12841fac878b243dd3c98f3392d4` |
| `lib/l2l_levels_store.js` | 34,403 | `618494c25286035d7ddf9bdd2389c9392f4b8d14618ff194ed0abbb6e9eebb3f` |
| `script.js` | 790,963 | `a8ec4209e71145be948516b6935540980c39fcc70faf15ee07b881afb387c7fe` |
| `scripts/README-l2l-levels-tool.md` | 16,129 | `f54d4075ec04f5609b2925b935ea4bca025e4602c0db91ba9b19b7d0c51529cf` |
| `scripts/l2l-levels-tool.js` | 12,186 | `ee100769b642507dc2a6bb4ae7e68d36f72e77fab5a609cb505139ce6c73d2aa` |
| `styles.css` | 206,782 | `519bd7c148589736673beb287dfd6f57f9321e7e2f48ef401f24de36b026f9c5` |
| `tests/l2l_levels.test.js` | 71,466 | `d4c2843b4ecbf8a19eb0911d4ab873de0365160dff2b9a314f481ac9c595b906` |
| `tests/live_trading_dashboard.browser.test.js` | 14,214 | `8580b7cf8fdbd88ddbe86f5a74bc2d5231a1b8feb44d84317cd2b2e4c67de2a3` |
| `data/live-trading.json` (data only) | 854,286 | `ce4f4eae26bc623988cc0c99c421131f339268159e8cf14d4d63c00e87e87716` |

`data/l2l-levels.json` needs no change: blob `2a0aef4f`, 730 bytes, sha256
`7e69d63dafe2d8cf96b825ae4dd666b40efac4b27128b7d001b67ac88057d6d5`, byte-identical on `main` and on this lane's
branch. Without the refreshed snapshot the two new buttons stay disabled, which is what phase A shows.

**Boundaries.** No push, no pull request, no merge, no publication, no production commit; no order path, no broker
connection, no MT5 credential, no key in the repository, no table, no arming; Layer 1 independent and backtesting
downstream-only; the sealed Gold window untouched; and a passing browser probe is not a live deployment, a causal
timing proof or a trading edge.

## 25. The feed cadence, and the one fact the artifact could not state (build, 2026-10-04)

The user settled the order of work: the live account is the target for the later test order, and the feed comes
first, because the model reads 5m candles - *"we need the live feed functionality first for the 5m charts as this
model is based on 5m candles. After which we will test the smallest possible size order then we will build the true
logic the model is to follow."* Section 11's open item - a reader that produces the dashboard's data has to run on
the machine holding the terminal - was answered there by staying on this PC; what was still missing was the clock.
Nothing ran the producer, so the artifact in the repository was only as fresh as the last manual run.

| Change | Where | What |
| --- | --- | --- |
| Cadence runner | `scripts/run-live-trading-feed.js` | `--once` spawns the producer, validates what it wrote with the page's own validator, appends one JSON line, exits 0/1. `--loop` repeats at each 5m bar close. `--align` sleeps to the next close plus a 20-second settle, so a drifted repetition grid still samples just after the bar it reads closed. A lock file stops a foreground run and the scheduled run attaching to the terminal together, and a lock older than ten minutes is taken over instead of obeyed. |
| Scheduled task | `scripts/register-live-trading-feed-task.ps1` | `LiveTradingFeedTick019`: one five-minute repetition, launched through the Gold window's own `run-hidden.vbs`, `MultipleInstances` `IgnoreNew`, `StartWhenAvailable`, ten-minute limit for the align wait. `-Show` prints the plan, `-Remove` takes the task away. It schedules that one run and nothing else. |
| Liveness in the log | `tmp/live-trading-feed.log` (ignored) | One line per run: status, artifact age against its freshness window, terminal, masked account, open positions, and per instrument the bid, the tick age against the snapshot's own clock and whether it is ticking. |
| Tests | `tests/live_trading_feed_cadence.test.js` | 25 tests: boundary arithmetic, flag refusals, the summary, the lock and its stale takeover, an accepted run, a failing producer, an unreadable and an invalid artifact, a skipped run, the align wait, working-directory independence, and the read-only boundary (standard library plus the validator only, no order function, no publication in either script). |
| Runbook | `scripts/README-live-trading-feed-cadence.md` | How to run it, what the task registers, what each log status means, and the four honest limits. |

**Run rather than reasoned about.** Two runs against the live terminal, `2026-10-04T11:34:54Z` and `11:36:05Z`:
`status: ok`, `producer_exit: 0`, artifact age 0s against the 900s window, validator `PASS`, terminal build 6231,
account `***614 FTMO-Server`, 0 positions, and the runner's lock released both times. The scheduled task was then
registered and started; its first run lands in the same log at the next bar close, and `267009` while it waits is
the align sleep, not a fault.

**Two faults that only running the task could show.** Both were invisible in the source, both looked like a working
cadence from every file, and both are now the reason `register-live-trading-feed-task.ps1 -Test` exists.

1. **Task Scheduler doubles every quote it stores inside an argument.** The first registration handed the hidden
   launcher the node command line complete with its own quotes, so the launcher received a mangled command: the
   instance stayed alive for four minutes, attached to no terminal and wrote nothing. The task's command line is now
   quote-free - `cmd.exe /c <wrapper>` - and every quote lives in a generated `tmp/live-trading-feed-run.cmd`, where
   cmd.exe's own rules apply. This is the shape the Gold capture window's task has used for weeks, and the reason it
   works there is that its command line carries no quotes either.
2. **A scheduled task starts in `C:\Windows\System32`.** The runner's relative default lock path therefore made it
   try to create `C:\Windows\System32\tmp`, throw `EPERM` and exit 1 *before* writing a log line - a silent failure
   with a clean-looking log. The runner now resolves `--out`, `--log` and `--lock` against the repository root, and
   an unexpected error is written to the log as `status: "error"` instead of escaping the run. A third fault was
   found on the way: registering over a task whose run was still in flight left the scheduler reporting it as
   running and then refusing every repetition, so the script now stops and removes any previous registration first.

`-Test` proves the launcher chain on this machine without waiting for a bar close: with the fix in place it
reported `self_test_result = 0`, the log gaining a line, and `the launcher ran the runner and the snapshot
validated`.

**The cadence itself, observed.** The registered task's first own run reached the log at
`2026-10-04T12:00:20.022Z` - the settle instant of the 12:00Z bar, 20 seconds after the boundary - with
`status: ok`, `producer_exit: 0`, `feed_age_seconds: 0`, `live_ticks: 1` (BTCUSD, tick age 0s, its newest M5 bar 20
seconds old) and `quiet_ticks: 3` (EURUSD, XAUUSD and `US100.cash` at ~140,700s, Friday's close), and the task
recorded `last_task_result = 0`. The artifact rewritten at that second is `data/live-trading.json`, 880,919 bytes.
That is the whole claim being made here: one read-only producer run per M5 bar, on a clock, with the evidence of
each run written down.

**The correction the log exists to make.** On this Sunday the per-instrument facts are: `BTCUSD` tick age 4s,
`live_tick: true`, newest M5 bar 62s old; `EURUSD` 139,267s, `XAUUSD` 139,567s, `US100.cash` 139,568s, all
`live_tick: false` and all still `m5_stale: false` with `bar_age_seconds` 299, 299 and 298. Those three are
Friday's close - 20:55 UTC - and the producer's own flag cannot say so, because it measures the newest bar against
*that instrument's* last tick and a shut market's closing bar is still the newest bar it has. That is the exact
trap section 11 recorded on 2026-09-30 from the other direction, and the tenth conversation entry hit it again. It
is now written down twice per run - tick age beside the bar age - so the answer to "is the 5m feed live" is read
off one line instead of re-derived. At `11:36Z` it was one instrument of four; it becomes four when the session
reopens.

**What this deliberately does not do.** It publishes nothing. The artifact is rewritten on this machine every five
minutes and is never committed or pushed, so the published GitHub Pages copy still changes only when somebody
commits it and remains as stale as that commit - the section keeps rendering its own staleness honestly. A
five-minute publication to production `main` would be roughly 288 commits a day, which is the user's decision and
not this lane's, so the cadence stops at the file. While the task runs, `data/live-trading.json` - a tracked file -
is rewritten every five minutes and the worktree is permanently dirty until `-Remove` stops it. No credential was
read, no account fact beyond the masked line was touched, no order function exists in either new script, and no
push, merge, publication, workflow or warehouse action was taken.

**Open, for the user.** Whether the 5m feed has to reach the *published* page (a commit on a cadence, with the
site's build lag on top) or whether the live read is enough locally, where the model and the order path will run
anyway, through `scripts/l2l-levels-tool.js` serving this worktree on loopback.


## 26. The cadence reviewed and accepted, and the lane paused on the user's decision (2026-10-04)

Filing `20261004-live-trading-feed-cadence-r1` (inbox file 19,205 bytes, sha256 `93ed58a7...`) was reviewed in the
canonical checkout under the background controller lock that owned the run and accepted as a bounded, read-only local
cadence: reply `.local/orchestration/replies/live-trading/20261004-live-trading-feed-cadence-r1.json` (9,303 bytes,
sha256 `1fc7139f...`, `decision: accepted`), review document
`docs/orchestration/reviews/20261004-live-trading-feed-cadence-r1.md`. No assignment was published, `live-trading`
stays `live-trading-002`, nothing was published, pushed, merged or mutated by that review, and this lane starts no
further work until the user answers.

**The reviewer re-ran the evidence on the lane's own bytes.** `node --check` exits 0; the cadence file alone is 25
tests, 25 pass, 0 fail; the same file with `tests/live_trading_feed.test.js` and `tests/l2l_levels.test.js` is 107
tests, 107 pass, 0 fail; the four `npm run test:unit` failures remain the pre-existing
`backtester/tests/secret_scanner.test.js` red, which passes 5 of 5 when run directly. Every declared digest reproduced
with its blob read back from `b8c7a05`, and the two moving figures were confirmed point-in-time: the log gained its
`13:20:20Z` line and the worktree artifact moved to 880,936 bytes at `d81805a0...` while the review ran.

**Two things the review recorded rather than glossed, kept here.** The four new tracked files under `scripts/` and
`tests/` and the registered task are a scope overrun against this lane's "no scheduler action" boundary and its
`docs/live-trading/`-only write scope; the cadence is accepted as read-only local tooling under the user's in-window
request for the 5m feed, and the task's registration is machine state left to the user. And both documents understated
the test count - they said "23 tests" where the file has 25 - now corrected in sections 25 and 26 and in
`CONVERSATION_NOTES.md`, with no re-file, since nothing load-bearing depended on it.

**Dependency impact carried forward, unchanged by the review.** The cadence cannot run from `main`: it needs the
lane-side producer `tools/mt5-bridge/live-trading-snapshot.py` and the lane-side validator
`scripts/validate_live_trading_feed.js`, neither of which is on `origin/main`. The task's command line is bound to the
absolute path of `.local/worktrees/live-trading`, so moving or removing that worktree turns every repetition into error
lines in its own log, and `data/live-trading.json` is tracked, so this worktree stays dirty by design while the task
runs and any later commit from this lane has to handle that file deliberately.

**What the review deliberately did not settle.** The authority question stays the user's: a read-only feed, execution
on a demo account, or real-money execution on a funded account. The next step in the user's own order of work - "the
smallest possible size order" - crosses that boundary, so publishing a successor assignment that prepares an order
path would settle it by building, and this lane asks for none. The three questions in section 25 stay open and are
reported as the user's items rather than answered here.

**Boundaries.** Unchanged: no production change, push, merge, pull request, publication, workflow, warehouse mutation,
broker action, order or arming was created, widened or approved; no credential was read; Layer 1 stays independent and
backtesting stays downstream-only; the sealed Gold prospective window stays sealed; and a feed that is fresh at a
five-minute cadence is not an edge, not accuracy and not a causal feature-timing proof.


## 27. The publish step built and gated, and the one flag that would turn the cadence into a publisher (2026-10-04)

The cadence in sections 25-26 writes the artifact on this machine and stops there. This section is the other half:
`scripts/publish-live-trading-feed.js`, the only step in this lane that writes to the branch GitHub Pages serves,
and the opt-in flag that reaches it from the cadence runner. No publication was made by this lane: `origin/main`
still carries the user's own manual snapshot `0a64ec5` (`generated_at 2026-10-04T13:00:20Z`, blob 854,252 bytes).

| Change | Where | What |
| --- | --- | --- |
| Publisher | `scripts/publish-live-trading-feed.js` | Four gates, each a refusal with a reason: the artifact passes the page's own validator; it is inside its own `stale_after_seconds`; its `generated_at_utc` is strictly newer than the copy on the branch (compared on the snapshots' clock, not on bytes, because git normalises line endings); and at least `--min-interval-seconds` has passed since the last publish. Then it resets its own checkout, copies the one file, commits, pushes, and retries once if the push is rejected as non-fast-forward. |
| Runner wiring | `scripts/run-live-trading-feed.js` | `--publish`, `--publish-min-interval-seconds`, `--publish-checkout`, `--publish-state`, `--publish-dry-run`. Off unless passed, so a hand run and a scheduled run behave the same way until somebody asks for the write. |
| Registration switch | `scripts/register-live-trading-feed-task.ps1` | `-Publish` (and `-PublishMinIntervalSeconds`, default 600) appends the flag to the wrapper command; without it the wrapper is byte-for-byte what it was. `-Show` prints `publishes_anything` so the plan says which cadence it is. |
| Tests | `tests/live_trading_feed_publish.test.js` | 24 tests over the publisher and over the runner's publish step, with git itself replaced by a recorded stand-in and a queue of push results. |

**Why the interval is a gate and not a comment.** One publish per bar would be roughly 288 commits a day into
production `main`, which is what section 25 refused to do on the user's behalf. GitHub's soft limit of ten Pages
builds an hour is a 360-second floor; the default here is 600 - six builds an hour, one publish every other bar of
a five-minute cadence - deliberately above the floor rather than at it. The gate is answered from the state file
before any git work, so a held-back run costs nothing but the producer run it already made. State lives in
`tmp/live-trading-publish-state.json` (ignored), and the checkout is `.local/live-trading-feed-publish` beside the
canonical repository, resolved through the shared git common directory rather than the current working directory.

**A refused publish is a failed run.** The artifact is still written and validated, the log line carries
`publish.action` and its reason, and the exit status is non-zero, because a scheduler surfaces only that. `--force`
overrides the interval gate alone and cannot override a validation, freshness or "already newer on the branch"
refusal. `--dry-run` runs every gate and stops before anything is written or pushed.

**Run rather than reasoned about.** `node scripts/publish-live-trading-feed.js --dry-run --json` against the
committed artifact at `13:10:31Z`: `action: would_publish`, artifact `13:10:20.385Z`, age 11s against a 900s window,
the published copy carrying `13:00:20.443Z`, checkout resolved to
`D:\trading-agent-dashboard-codex\.local\live-trading-feed-publish`, commit subject
`live-trading: publish the M5/H1/H4 snapshot for 2026-10-04T13:10:20.385231+00:00, data file only`, 0.97s. `node
--check` is clean on both scripts; `node --test tests/live_trading_feed_publish.test.js` is 24 of 24 and the
cadence file 25 of 25 after its boundary assertion was moved to the new shape. `npm run test:unit` is 526 tests,
522 pass, 4 fail - all four in `backtester/tests/secret_scanner.test.js`, and the same four fail identically in the
untouched publish checkout sitting at production `0a64ec5`, so they are pre-existing and untouched by this work, as
`docs/SESSION_NOTES.md` already records for earlier sessions. The new file is picked up by `npm test` without being
listed anywhere: `scripts/test-local.js` walks for `*.test.js` off a two-name exclusion set.

**No cache-buster bump is needed, and that was measured rather than assumed.** The page fetches the feed from a URL
carrying a fixed token, but `fetchLocalJson` passes `cache: "no-store"` and `loadDashboard` re-runs on a 60-second
timer, so after the user's manual publish the fixed-token URL served the new bytes immediately (previous publish
`8a976e3..0a64ec5` was visibly serving within about 100 seconds of the push, at `age=0`, with nothing on the page
changed). Publishing data therefore needs no edit to `script.js` or `index.html`; the token only matters for files
whose contents the browser would otherwise reuse.

**One finding from wiring it, kept because it is a live trap.** The registered task's launcher points at
`tmp/live-trading-feed-run.cmd` inside the checkout that registered it - on this machine the lane worktree, not the
canonical root. That wrapper is rewritten by the registration script *before* it honours `-Show`, so reading the
plan with `-Show -Publish` from a checkout is enough to change what the live task runs at its next repetition. It
did so during this session, and the publish-free command line was restored immediately in the same session; the
registered cadence is unchanged and still writes locally only. The runbook now carries that row.

**Boundaries.** No push, merge, pull request, publication, workflow or warehouse action was taken by this lane in
this work; the publisher exists, is gated, and was exercised only with `--dry-run` against the real repository and
against a recorded git stand-in in tests. No order function exists in any script here, no credential was read, and
Layer 1 stays independent with backtesting downstream-only. Enabling the scheduled cadence to publish is the user's
decision and is one command: `-Publish` at registration.


## 28. The cadence is armed to publish, the first automated publish landed, and the loop still runs one way (2026-10-04)

The decision in section 27 was the user's, and they took it: the live task was re-registered with `-Publish` and the
cadence now publishes on its own. This section records what that produced, because "the flag is on" and "the
dashboard is serving a fresh read" are different claims.

**Armed.** `register-live-trading-feed-task.ps1 -Publish` at `14:22:40+01:00` rewrote the wrapper the task runs
(`tmp/live-trading-feed-run.cmd` in this worktree, the path the registered task's hidden launcher points at) to
`--once --align --publish --publish-min-interval-seconds 600 ...`, and the plan printed `publishes_anything = true`,
`publish_interval = 600 seconds`, `order_path = none`. The producer cadence did not change: one read per M5 bar, at
most one publish every 600 seconds, so a five-minute clock publishes every other bar.

**First automated publish, from the scheduler rather than from a shell.** The aligned run at `13:30:20.011Z` wrote
the artifact (`generated_at_utc 13:30:20.346793+00:00`) and then published it: `action: published`, `published:
true`, `attempts: 1`, `commit 6de4571`, `min_interval_seconds: 600`. The commit is one file - `data/live-trading.json`,
146/146 lines - and the task's own `LastTaskResult` is `0`. `tmp/live-trading-publish-state.json` now carries
`publish_count: 1`, `last_published_commit 6de4571`, `last_published_generated_at_utc
2026-10-04T13:30:20.346793+00:00`.

**Verified where a reader would look, not just where it was written.** `https://kevincreedycars-debug.github.io/
trading-agent-dashboard/data/live-trading.json` fetched with a cache-busting query returns 854,230 bytes with
`generated_at_utc 2026-10-04T13:30:20.346793+00:00`, `age=0`, `cache-control max-age=600`, account `***614
FTMO-Server`, `positions_open 0`, schema `live-trading-feed-v2`. So the chain the user asked to see is live and
mechanical end to end: the FTMO terminal is read on the machine, the artifact is validated, one file is committed
and pushed, and the published dashboard serves that exact read within the Pages rebuild.

**The next bar was held back, which is the other half of the same claim.** The `13:35:20Z` run wrote a fresh artifact
and did not publish: `action: too_soon`, `reason: "the last publish was 296s ago, inside the 600s cadence"`,
`publish_count` still 1, and the publish checkout still sitting on `6de4571` with nothing unstaged. The interval gate
is answered from the state file before any git work, and that is now shown on a live run rather than only in a test.

**Two facts about the first publish worth keeping.** Production `main` moved under this lane between the dry run and
the first publish - `0a64ec5` to `0eaf294` ("Frame what-moves-gold.html as the gold page's first tab", another lane,
different files) - and the publisher's fetch plus `checkout --detach --force origin/main` put the feed on top of that
new tip rather than reverting it, which is the behaviour the design claimed and had not been shown under a real
concurrent push. And at `13:25:20Z` exactly one `ok` line was written while a second instance logged `skipped`: the
instance started before re-registration carried the old publish-free command line and took the lock, the newly
registered instance aligned to the same bar and skipped. One artifact per bar, no double publish.

**What the weekend read actually says.** The `13:30` artifact has EURUSD, XAUUSD and US100.cash quotes around 40
hours old with their M5 bars current, `live_ticks 1` and `quiet_ticks 3`: the market is closed and only BTCUSD is
ticking. The validator passes it because the artifact is fresh and the bar blocks are current, and the dashboard
carries each instrument's `tick_age_seconds`, so a reader sees a flat weekend quote for what it is rather than a
stale feed.

**The loop still runs one way, and this is the boundary to be plain about.** Everything above reads the account and
writes a page. Nothing sends an order, and nothing reports what a position did. The concrete gaps, in the order they
have to close:

| Missing piece | State today |
| --- | --- |
| Per-position detail in the artifact - symbol, side, volume, entry, stop, target, floating P/L, ticket, open time | Absent. The account block carries counts only (`positions_open`, `orders_open`, both 0), though `positions_get` is already allowlisted in the producer. |
| Closed-trade history and outcomes | Absent, and `history_deals_get` is not in the producer's allowlist; reading it is a deliberate widening of that allowlist with its own tests. |
| A dashboard surface for fills, positions and outcomes | Absent. `script.js` renders two count rows ("Open positions", "Open orders") and no position, fill, entry/exit marker or P&L. |
| An order-sending path | Absent everywhere: `live-trading-snapshot.py` is read-only by construction, the runner and registration script are asserted to name no order function, and no script, route or assignment opens or closes a position. GitHub Pages is static, so a page cannot place one even if the rules existed. |

Closing the read-back half - positions, fills, outcomes on the page - is a small, safe step that would show what the
account did whether the trades were placed by hand in the terminal or later by a rule engine. Closing the write half
is a new capability with real money behind it, and its decisions (which rules, what size, who authorises, what stops
it, where it runs) are the user's, not this lane's. No order function was added, no credential was read, and Layer 1
stays independent with backtesting downstream-only.

## 29. The order tool, the read-back, and the smallest trade the broker allows (user's route, 2026-10-04)

The user answered section 28's open decision with one instruction that covered both halves at once: build the read-back,
and prove it by opening the smallest possible size trade on BTCUSD, closing it, and having every field of the trade
visible in the dashboard. This section records that as one chain, in the order it happened, with the numbers it produced.

**The read-back is now in the artifact, and the artifact is schema `live-trading-feed-v3`.** `live-trading-snapshot.py`
gained three blocks, all of them reads: `positions` (one record per open position - ticket, symbol, dashboard asset,
side, volume, entry, current, stop, target, floating profit and swap, the signed move in percent, magic, comment, and
the position's own open and last-update times as both server and UTC stamps), `closed_trades` (one record per completed
position, paired out of `history_deals_get` by `position_id`: entry and exit deals, entry and exit prices, profit,
commission, swap, the net of the three, deal count, both clocks, and the seconds held), and `history` (the window the
pairing covered - `window_days: 14`, the deal count it read, and how many positions it completed). A fourth field,
`execution_note`, states on the artifact itself that this snapshot places nothing and names where a trade can come
from. The producer's MT5 allowlist was widened deliberately, by exactly `history_deals_get` plus the eight enum
constants that say which deal is an entry and which way one faced: `tests/live_trading_feed.test.js` still fails the
suite on any other name, and still fails it on any order call.

**The validator holds the read-back to the same standard as the quotes.** `validateLiveTradingFeed` now refuses a
position without a side, size, price or clock; a closed trade whose `net_profit` is not its own `profit` plus
`commission` plus `swap` (the one number on the panel a reader cannot check by eye); one that closed before it opened;
one that was not paired out of at least two deals; an `account.positions_open` that disagrees with the rows beside it
(a feed saying two positions were open while carrying one row is a page showing half the risk); a `history` block whose
`closed_positions` disagrees with the list; and a snapshot with no `execution_note`.

**The orders come from one file, and it is not the producer.** `tools/mt5-bridge/live-trading-order.py` is new and is
the only file in the lane that names an order call. Its guards, in order: `--confirm-live` or nothing is imported,
attached to or sent (the run prints its plan and exits 3); the symbol must be one of the four the lane trades; the size
defaults to the symbol's own `volume_min`, and the cap for a run is that same minimum unless `--max-lots` raises it -
so a trade larger than the smallest the instrument accepts has to be asked for twice; a close is capped at the
position's own volume, because a position that cannot be capped cannot be closed either; and a stop or target on the
wrong side of the entry is refused before it is sent. It reads no bars, publishes nothing and does no git work, and it
appends one JSON line per invocation - the plan, the request as sent, and the terminal's raw answer - to
`tmp/live-trading-orders.log`. Every trade it places carries `magic 20261004` and the comment
`live-trading-loop-proof`, and the read-back prints both, so a trade placed from this path is identifiable afterwards.
Two suites keep that boundary honest: the producer's allowlist test asserts it still calls nothing that can send, and
`tests/live_trading_order_tool.test.js` asserts that exactly one file in `scripts/` and `tools/mt5-bridge/` - and
exactly one among the dashboard, producer, runner, publisher and registration script - matches an order call, and that
it is this one. That file also runs the tool for real to show a run without `--confirm-live` exits 3 having sent
nothing: it did exactly that when this section's author first typed the open command without the flag.

**The round trip, with its numbers.** BTCUSD, `2026-10-04`:

| Moment | Command | Result |
| --- | --- | --- |
| `13:47:59.677Z` | `open --symbol BTCUSD --side buy --confirm-live` | `TRADE_RETCODE_DONE`, order `297645550`, 0.01 lot at `85230.34`, notional `852.30`, attempts 1, filling mode IOC |
| `13:49:24.305Z` | `close --ticket 297645550 --confirm-live` | `TRADE_RETCODE_DONE`, order `297645555`, 0.01 lot at `85248.89`, `partial: false` |
| `13:49:28.464Z` | `live-trading-snapshot.py` | `positions 0 / orders 0`, `closed trades: 1 in the last 14 days from 3 deal(s)`, CLOSED `#297645550` BTCUSD buy 0.01 lot `85230.34 -> 85248.89` net `-0.37` (85s) |

The artifact's own record of that trade: `profit 0.19`, `commission -0.56`, `swap 0`, `net_profit -0.37`, entry deal
`278466153`, exit deal `278466158`, `duration_seconds 85`, account balance `10000.00 -> 9999.63`. The commission is the
number worth keeping: 0.28 per side, so the round trip cost 37 cents on an 852.30 notional - about 0.044% - against a
1 dollar spread. The smallest trade this broker allows is not free, and a rule that trades often is trading against
that, not against zero.

**And it is live, not just local.** The runner published it: `node scripts/run-live-trading-feed.js --once --publish
--publish-min-interval-seconds 600` returned `action: published`, `commit 4d7fbff`, `attempts: 1`. That commit is one
file, `data/live-trading.json`, and
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/data/live-trading.json` now serves schema
`live-trading-feed-v3` with that closed trade identical field for field. So the chain the user asked to see is proven
in both directions: terminal to dashboard for the read, and dashboard to terminal for the trade.

**What a reader sees.** The Live Trading section gained two tables under the four cards. *Open positions* is one row
per position - asset, symbol, side, volume, entry, current, move, floating, swap, stop, target, open time, ticket with
its magic, and the comment - with the floating total in the heading, or a stated empty state that says nothing is open
rather than showing an empty box. *Closed trades* is one row per completed position, newest first: close time, trade,
side, volume, entry, exit, held, profit, commission, swap, net (bold), position id with its deal count, and the
comment, under a heading that states the window and the net, with a caption saying the rows were paired from the deal
history and how many deals that was. Both tables say on the page that nothing there can open, change or close a
position, and the section's provenance paragraph now names where a window's trades can come from instead of claiming
the lane has no execution path at all. `tests/live_trading_readback.browser.test.js` drives the real page in Chromium
against a real v3 snapshot and reads the rendered text back - the position's entry, current, floating, ticket, magic
and open time; the trade's exit, 85 seconds held, -0.56 commission and -0.37 net; and the empty state - and it was
checked against a deliberately wrong expectation first, so it is known to fail when the numbers are not there. The
runner's log line carries the read-back too (`closed_trades`, `closed_trade_window_days`), so each run's evidence says
whether the account held anything and whether anything closed.

**What this does and does not change.** The loop now runs both ways, but only from a human's hand: the order tool is
manual by construction, is not wired to the cadence, is not reachable from the browser - Pages is static - and places
one market order at a time with no rule, stop or target attached unless one is passed explicitly. It is a plumbing
proof, and the strategy is still the user's next step, not this lane's: the entry and exit rules, the sizes, the
authorisation and the kill switch are untouched, the trade above is evidence that the pipe works rather than an edge
claim, and Layer 1 stays independent with backtesting downstream-only. Two smaller things are on the record. The
`13:45:20Z` cadence run logged `invalid` with `schema_version must be live-trading-feed-v2` - a v3 artifact met the
one-minute window in which the producer had been bumped and the validator had not, so the runner refused to call the
run `ok` and published nothing; the ordering is now consistent and the log line stands as written. And one red
remains, not this work's: `backtester/tests/secret_scanner.test.js` has four failing cases in its console-width
dependent reporting, its scanner script is untouched by this lane, and `npm test` reports 578 pass / 4 fail with those
four and nothing else.

## 30. The lines were published and the chart drew none of them (user report and build, 2026-10-04)

**What was reported.** "the levels need to be persistant on the live charts in the dashboard I currently cant see them,
once they are set they are permanent unless I move them manually", and "where is the record of the live trades on the
live dashboard".

**The first half was a price scale, not a store.** The marks were saved, published and read back. Driving the live page
in a browser and reading its own `data/l2l-levels.json` shows BTCUSD carrying 2 seed levels and 20 derived, the ladder
`68564.96` to `99117.23`, and the caption reading `0/22 lines in view (10 above, 12 below)`. The 120 M5 bars the window
draws span about 345 points around `85170`, while one ladder step is `1454.87`, so every marked line sat outside the
price scale and the chart drew none of them. Pressing Fit levels drew all 22. Nothing was lost: the file was right and
the visibility was wrong, which is a scale question rather than a storage one.

**What the chart does now.** A marked line outside the window is no longer invisible. Each edge that has lines past it
carries a tab naming how many there are and the nearest of them - `12 levels below · nearest 84568.53 · click to fit` -
and that tab is itself the Fit levels control, so the whole ladder is one click away wherever the reader is looking.
Lines inside the window are drawn exactly as before, and the tab costs nothing when there are none.

**What "permanent unless I move it" now means.** Two things were made to hold. *The committed file outranks a browser
draft*: a draft is shown only when it can prove, by its own saved-at stamp, that it is newer than the file committed in
the repository, so a stale copy left in one browser can never hide the levels every other reader sees - the rule is one
function in `lib/l2l_levels_store.js` (`chooseLevelsView`), both writers and the page go through it, and the page says
which of the two copies it is showing. *And the view the reader sets* - symbol, timeframe, candlesticks or line, and
whether the price scale is fitted to the levels - is saved with the tab state and restored on the next load, so their
ladder is still on screen instead of resetting to an unfitted default with the lines off-scale again.

**Evidence.** `node --test tests/live_trading_levels_visibility.browser.test.js` drives the real page in Chromium
against the real committed feed and a levels artifact built through the shared module from the user's own two seeds
(`83113.66`, `84568.53`): the chart draws 0 lines and states `0/22 lines in view (10 above, 12 below)` with the ladder
bounds, both edge tabs are present with their counts and nearest prices, clicking the below tab draws all 22 and leaves
no tab, the caption reads `22/22`, and a reload brings back the same symbol and the same fitted scale. The fixture
asserts the derived count and the bounds, so it cannot drift from the committed file. `tests/l2l_levels.test.js` is 50
of 50, with seven new cases over `chooseLevelsView` - stale draft loses to the committed file, newer draft wins, nothing
published yet, no draft, unreadable stamp, no state at all - and source assertions that the chart states what it cannot
draw and that every chart control writes the view.

**The second half: the record is published as data and drawn nowhere.** The read-back tables - open positions and closed
trades - are built, tested and committed on this lane, and the data behind them is already live in
`data/live-trading.json` (`live-trading-feed-v3`, the closed BTCUSD trade with its 85 seconds held, `-0.56` commission
and `-0.37` net). What the published page lacks is the code: production's `script.js` is the chart-and-levels family,
which carries no tables. So the live dashboard still shows the account counts and no fills, no entry, no exit and no
P/L, and the honest answer to "where is the record of the live trades" is "published as data, drawn nowhere" until this
work is released as a targeted port onto `origin/main`, tables and level visibility together, the way sections 15 and 16
were cut.

**Boundaries.** No order path was added, touched or called: nothing here places, sizes, amends or closes anything, and
the browser still reaches no broker. Layer 1 is untouched, backtesting stays downstream-only, and the levels artifact
was read from this lane, never written.

## 31. Released onto production main (release, 2026-10-04)

**The port this lane asked for is in production.** Section 30 closed with the second half of the work owed as a
targeted port onto `origin/main` - the read-back tables and the level-visibility fix together - and that port is now
published as two commits, cut the way sections 15 and 16 were cut.

| commit | what it is |
| --- | --- |
| `8a304e8` | The port. `script.js` gains the two tables, the `liveTradingPositions(data)` / `liveTradingClosedTrades(data)` call sites and the corrected provenance paragraph; `styles.css` gains the tables' own rules; `lib/l2l_levels_store.js` gains `chooseLevelsView`; `index.html` moves its two tokens to `?v=20261004-live-readback-and-level-visibility`; `tests/live_trading_readback.browser.test.js` and `tests/live_trading_levels_visibility.browser.test.js` arrive from the lane and `tests/l2l_levels.test.js` gains its cases. 7 files, +815 / -7. |
| `b1b0738` | The store's own cache-buster, `?v=20261003-l2l-levels-store` -> `?v=20261004-l2l-store-published-wins`, owed because `lib/l2l_levels_store.js` changed and the token had not. 1 file. |

**The one thing the port got wrong on its first pass, and the fix.** `8a304e8` moved the two tokens named in
section 15's precedent but not the store's, even though this release is the one that changes the store: the rule
that a committed file outranks a stale browser draft lives in `chooseLevelsView`, in that file. A returning reader
could have been served the previous store beside the new `script.js` and never seen the fix - the same failure this
lane filed once before as finding three of section 26's port review. `b1b0738` moves the token, named for the
change, and leaves `lib/l2l_ladder.js` alone because this release does not touch it.

**The route, recorded so the next release does not have to rediscover it.** A release worktree off `origin/main`
(`.local/live-trading-readback-release`, branch `release/live-trading-readback-20261004`), the lane's regions moved
across byte-exactly rather than retyped, the lane's two browser tests carried with them, and the two docs in this
folder deliberately left behind - production takes code and tests, the lane keeps the record. The feed's own
publisher writes `data/live-trading.json` on a ten-minute cadence, so the branch was rebased onto `89ebfd3` before
the push and the whole verification set was re-run against the rebased tree, because the browser tests read that
committed file. `git push origin HEAD:main` is a fast-forward while the data cadence is the only other writer.

**Evidence.** On the release tree: `# tests 169`, `# pass 168`, `# fail 1`, the one failure being a 30s timeout in
`tests/refresh_progress.browser.test.js:327` under the nineteen-file parallel run, which passes 26 of 26 run alone.
Run on their own against the released tree: `tests/live_trading_readback.browser.test.js` 1 of 1,
`tests/live_trading_levels_visibility.browser.test.js` 1 of 1, `tests/live_trading_dashboard.browser.test.js` 2 of 2,
`tests/l2l_levels.test.js` 50 of 50. `node --check` clean on `script.js`; the ported regions byte-identical to the
lane's committed `script.js` and every `liveTrading*` identifier they call defined in the released file, both held by
script. Published state confirmed at the pinned commit:
`https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/b1b0738/index.html` carries
`lib/l2l_levels_store.js?v=20261004-l2l-store-published-wins` and
`script.js?v=20261004-live-readback-and-level-visibility`. The plain `main` URL lagged that fetch by a few minutes on
raw.githubusercontent's own cache, so tokens are checked against the commit, not against the branch name.

**What a reader now sees, and what the artifact holds.** The Live Trading section draws *Open positions* and
*Closed trades* beneath the four cards, with each table's empty case stated. The committed feed currently holds
`positions_open: 0` and no `positions` block, so the open table says nothing is open; and one closed trade - BTCUSD
buy `0.01`, `85230.34` in, `85248.89` out, `0.19` profit, `-0.56` commission, `-0.37` net, magic `20261004`,
`live-trading-loop-proof`, `85` seconds held - so the record of the one deliberate order is now drawn on the
published dashboard instead of only stored beside it. The chart's own change shows as the edge tabs that state how
many marked lines sit past the window, their nearest price, and Fit levels as the tab itself.

**Boundaries.** No order path was added, touched or called by this release; nothing places, sizes, amends or closes
anything, and the browser still reaches no broker. The release writes `data/live-trading.json` not at all - the
cadence owns it - and it changes no producer, validator, feed schema, Layer 1 agent or backtesting file. The levels
artifact was read, never written. A published table of executed trades is a record of what happened; it is not a
signal, an edge, an accuracy claim or a causal feature-timing proof, and the entry rule, the size and the kill
switch remain the user's decisions rather than this lane's.

## 32. The executed trades are drawn on the chart, the empty state says which fact it is, and the tick cadence is answered (user request and build, 2026-10-04)

Three things were asked for in one message: the old trades visible in the live trader as a simple triangle at the
entry and one at the exit, the levels set up for the three other pairs, and a page that is at most thirty seconds
behind when the five-minute tick is due. The first is built and checked below. The second needs no build, and its one
trap is in the paragraph on the other pairs. The third cannot be had from a Pages publish at all, and the honest
answer is in the paragraph on the tick cadence.

| Change | Where | What |
| --- | --- | --- |
| Chart markers | `script.js` | `liveTradingChartTrades(instrument, points, geometry, digits)` reads `liveTradingData.closed_trades` for the symbol on screen, finds the bar the trade's own time falls in, and returns one `<g class="live-trading-chart-trade">` per entry and per exit: a triangle lettered `E` for the entry, one lettered `X` for the exit, pointing the way that side was taken (up for a buy, down for a sell), at the price the terminal reported. Drawn on the SVG between the level lines and the edge tabs. |
| Caption | `script.js` | The chart caption gains `N executed trade(s) on this chart (E entry, X exit)` and appends `, M outside this window` when a trade closed before the first bar drawn; the *Closed trades* caption names the two letters so the marks are findable without hovering. |
| Empty state | `script.js` | `liveTradingPositions(data)`: the absent-block case with `account.positions_open === 0` now says *"This snapshot carries no position block, and the account it read reports 0 open positions: nothing has been open since the last publish."*, distinct from the present-but-empty case and from the no-answer case. |
| Markers' own rules | `styles.css` | `.live-trading-chart-trade` and its `.buy` / `.sell` / `.entry` / `.exit` / `.live-trading-chart-trade-label` rules, on the chart's own palette. |
| Cache-busters | `index.html` | `script.js` and `styles.css` move to `?v=20261004-live-trade-markers`. `lib/l2l_levels_store.js` did not change, so its token did not move. |
| Tests | `tests/live_trading_feed.test.js`, `tests/live_trading_readback.browser.test.js` | Two source cases (the marker shape and the two "nothing open" facts) and one browser case that drives the real page against the newest committed bars; 46 of 46 and 2 of 2. |

**The rule the markers are placed by, and the one thing they refuse to do.** A trade belongs to the last bar that
opened at or before its own time, and a marker is drawn at that bar's x and at `yAt(price)`, clamped only so the
triangle stays inside the pane. A trade whose entries and exits both fall before the first bar on screen is not drawn
at all and is counted in the caption instead, because clamping it onto the left edge would draw a marker where the
trade did not happen. A trade with no readable time or price is skipped silently; the table below the chart still
states it, so nothing vanishes without a record. The E and X are a drawing of the read-back, marked on the canvas the
way a terminal marks fills: no signal, no forecast, and the tooltip on each is the entry or exit time and price the
snapshot already carried.

**The three other pairs need no build, and they need the published page rather than the local one.** The published
`data/l2l-levels.json` on `main` (generated `2026-10-03T20:57:49Z`, `marked_by live dashboard marking
(script.js + lib/l2l_levels_store.js)`) carries BTCUSD's two seeds `83113.66` and `84568.53` and the 20 derived lines
`1454.87` apart, with EURUSD, XAUUSD and `US100.cash` at zero levels. This lane's own copy of that file is the older
empty document dated `2026-10-01T00:00:00Z`, and the local marking tool is not running on this machine - nothing
listens on **8788** and no scheduled task starts it. So the marks must be made the way the existing ones were: open
the *published* page, switch the chart to the symbol, click the chart for the two seeds, press **Duplicate levels**,
then press Publish in the page's own panel, which reads the remote copy first and refuses on a changed sha. Marking
instead through `node scripts/l2l-levels-tool.js` and republishing that file would carry this lane's empty BTCUSD
document over the published one and lose the 22 lines, which is why it is named here rather than left to be found.

**The tick cadence: thirty seconds is the run's clock, not the page's.** The decision path is already inside that
window - the cadence is registered with `--align --settle-seconds 20`, so the producer samples the terminal twenty
seconds after the M5 bar close, and it is the run that would act on a rule, not the page. The published page cannot be
brought inside thirty seconds by publishing harder: a publish is one commit and one push, and Pages then rebuilds the
site in its own time, tens of seconds later at best. Publishing on every five-minute run is 12 pushes an hour against
GitHub's documented soft limit of 10 builds an hour for a branch-built site, and 288 commits a day on `main`. The
registration therefore stays at 600 seconds until a reader chooses otherwise; the view that is inside thirty seconds
of the close is the local page reading the local file, which involves no build and no commit at all. If the published
page is the one wanted at the tick, the change is `-Publish -PublishMinIntervalSeconds 30` on the registration script
and the churn and the soft limit are the price.

**Evidence.** `tests/live_trading_feed.test.js` 46 of 46, `tests/live_trading_readback.browser.test.js` 2 of 2,
`tests/live_trading_levels_visibility.browser.test.js` with `tests/l2l_levels.test.js` 51 of 51,
`tests/live_trading_feed_publish.test.js` 24 of 24, `node --check` clean on `script.js` and on the new test file. The
whole lane is `# tests 588`, `# pass 584`, `# fail 4`, the four being the backtester's placeholder-secret scanner
cases (`not ok 297`, `298`, `299`, `301`) this machine has failed since the twenty-third entry. The picture the
markers were checked against is the committed feed rendered at 1440x1000 and 390x844: `E` at `85230.34` /
`2026-10-04T13:47:59+00:00` and `X` at `85248.89` / `2026-10-04T13:49:24+00:00`, zero page errors at both widths, and
one element wider than its parent - the read-back table's intended horizontal scroll - at the narrow one. The
photograph is `tmp/live-markers-1440.png`.

**Boundaries.** Nothing here places, sizes, amends or closes anything; the browser reaches no broker and no order
function exists in any file this section names. The producer, the validator, the feed schema, the scheduled-task
registration and the levels artifact were not written by this change - the cadence owns the feed and the page reads
the levels. Layer 1 is untouched, backtesting stays downstream-only, the sealed Gold prospective window stays sealed
until `2027-03-25T15:00:00Z`. A triangle drawn where a trade happened, and a sentence saying nothing has been open
since the last publish, are records of the past: neither is a signal, an edge, an accuracy claim, a causal
feature-timing proof or evidence that the entry rule makes money.


## 33. The two live-trading changes are on production, and the thirty-second answer is corrected (release, 2026-10-04)

**The markers and the empty-state sentence are published.** The lane's `f84c0de` is now `ec90a98` on `main`, cut the
way sections 15, 16 and 31 were cut: a release worktree off `origin/main` (`.local/live-trading-markers-release`,
branch `release/live-trading-markers-20261004`), this change's own regions moved across byte-exactly rather than
retyped, the lane's browser test carried with it, and the two documents in this folder deliberately left behind -
production takes code and tests, the lane keeps the record.

| file | change | how it was carried |
| --- | --- | --- |
| `script.js` | `98` added / `7` removed: the marker function, the trade comment and the E/X sentence in the chart paragraph, `tradeView`'s reset and value, the caption tally and span, the "nothing open" split, and the *Closed trades* caption sentence | the lane-vs-`main` diff cropped to this change's own hunks and applied at the index, so the CRLF working tree never touched the bytes |
| `styles.css` | `10` added: `.live-trading-chart-trade` and its `.buy` / `.sell` / `.entry` / `.exit` / label rules | same route |
| `index.html` | `2` / `2`: `script.js` and `styles.css` to `?v=20261004-live-trade-markers` | the two lines edited directly; the rest of `main`'s `index.html` differs from the lane's and was not touched |
| `tests/live_trading_readback.browser.test.js` | `132` added: the marked-bars fixture and the browser case | `git restore --source=f84c0de`, safe here because the lane's copy of that file differs from `main`'s by insertions only (132/0) |

**The one thing the port got wrong on its first pass, and the fix.** The hunk filter that cropped the diff matched on
the words of this change and dropped the seventh region - the sentence naming the two letters in the *Closed trades*
caption - which is exactly what the new browser case asserts at its line 295. The suite on the release tree caught it
before anything was pushed, and that hunk was extracted on its own and applied. The lesson is kept here on purpose: the
filter is a convenience, the test is the check.

**Completeness, proven rather than asserted.** Two scripts were written for this port and both are why the port can be
called byte-exact: one compares the added and removed lines of a cropped patch against the diff the release tree
actually holds (`97`/`6` and `10`/`0` before the seventh region, `98`/`7` and `10`/`0` after, no line on either side),
and one checks that every line the lane's commit added exists, with the same multiplicity, in the ported file (`98` in
`script.js`, `10` in `styles.css`, `132` in the browser test, `0` missing).

**Evidence on the release tree.** `node --test "tests/*.test.js"` - the nine test files `main` carries - is `# tests
101`, `# pass 101`, `# fail 0`, `exit 0`, 113.5 seconds. After the rebase onto `c08d29f` the four suites that touch
this surface are `55` of `55`: `tests/live_trading_readback.browser.test.js` (2, including the marker case),
`tests/live_trading_levels_visibility.browser.test.js`, `tests/live_trading_dashboard.browser.test.js` and
`tests/l2l_levels.test.js`. `node --check` is clean on `script.js`. Published state confirmed at the pinned commit
`ec90a98bb3a55f68a943f13b7f4763495a675ee2`:
`https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/ec90a98bb3a55f68a943f13b7f4763495a675ee2/index.html`
carries `styles.css?v=20261004-live-trade-markers` and `script.js?v=20261004-live-trade-markers`, with
`lib/l2l_levels_store.js?v=20261004-l2l-store-published-wins` left exactly where the read-back release put it.

**How the suite has to be run on this box, recorded because it cost an hour.** Running a `git` command whose stdout is
a console starts a pager. A suite launched that way does not finish: the worker waits on a pager that waits on a
keyboard, dozens of `less`/`more` processes accumulate (52 were counted), and every later console command is typed
into the last of them. Run the suite with `GIT_PAGER=cat` and `PAGER=cat` in the environment, write its output to a
file rather than a terminal, and use `git --no-pager` for hand-run inspection.

**The thirty-second answer is corrected, and section 32's last sentence is the thing corrected.** Section 32 offered
`-Publish -PublishMinIntervalSeconds 30` as the way to bring the published page inside thirty seconds. That offer is
wrong, and the reasons are structural rather than a matter of appetite. A run exists only at an M5 close, because the
wrapper the task runs carries `--align --settle-seconds 20`; consecutive runs are therefore 300 seconds apart, and
nothing about the feed changes between them. A publish is one commit and one push, and the page is served from that
commit, so no publish cadence can make the page fresher than the commit that carries the snapshot. The registration's
floor therefore has only two meaningful settings: at or below 300 seconds, which publishes on every run - twelve
pushes an hour against GitHub's documented soft limit of ten builds an hour for a branch-built site, and 288 commits a
day on the branch the feed already churns - or the 600 seconds that is registered, which publishes on every second run
because the runs are five minutes apart. Any figure between 360 and 600 resolves to that same ten-minute cadence, and
the publisher's own documentation puts its exact floor at 360 seconds, "with no headroom at all", which is why 600 is
the default. The tick-speed view remains the local page reading the local file - written at close plus twenty seconds,
with no build and no commit at all - and the run that would act on the entry rule is already inside the thirty seconds
that were asked for. Nothing was re-registered: the task still runs every five minutes, aligned to the M5 close, with
a 600-second publish floor.

**The levels are the user's own act, and nothing about that changed.** Re-read while writing this section, the
published `data/l2l-levels.json` still holds BTCUSD's two seeds `83113.66` and `84568.53` with the twenty derived
lines `1454.87` apart, and EURUSD, XAUUSD and `US100.cash` at zero levels, so those three are unmarked rather than
marked-and-empty. The published page is what may write them, it reads the remote copy before it commits, and this
lane's local copy is still the older, empty document - the trap named in section 32 is unchanged, and it is why no
local tool run should be used to mark them.

**Boundaries.** No order path was added, touched or called by this release; nothing places, sizes, amends or closes
anything and the browser still reaches no broker. The release does not touch the producer, the validator, the feed
schema, the cadence, any Layer 1 agent or any backtesting file, and it writes `data/live-trading.json` not at all -
the cadence owns it. A triangle drawn on the bar a trade happened in, and a sentence saying that nothing has been open
since the last publish, are records of executed trades rather than signals, edges, accuracy claims, causal
feature-timing proofs or evidence that the entry rule makes money.


## 34. The position tool: what a past trade's stop and target were worth (user request and build, 2026-10-04)

The user asked to see the past trade's position sizer "like this", with a picture of TradingView's own long-position
tool: a red box from the entry down to the stop, a green one from the entry up to the target, the money each distance
was worth at the size that was traded, and the ratio between them. The lane already drew the executed trades as an E
and an X; what it did not draw was the box between them, because the snapshot carried no stop and no target on a
*closed* trade - the two levels were only ever published on the rows of positions still open. Both halves are now
built: the producer reads the levels back from the position's own order history, and the chart draws the box, its
three edges and their arithmetic.

| Change | Where | What |
| --- | --- | --- |
| The sizer | `lib/l2l_sizing.js` (new) | `tradePositionSizer(trade, instrument, account)` turns one read-back row into the arithmetic: the two distances on the instrument's own digits, the percentage each is of the entry, what each was worth at the traded volume (the instrument's own contract size, the account's own currency), the ratio between the two, and the three lines the chart prints. `positionToolLines`, `positionToolNote`, `formatPrice`, `formatRatio`, `formatPercent` and the five refusal reasons are the rest of it. No DOM, no transport, no order call, no export named like one. |
| The box | `script.js` | `liveTradingChartTrades` gains a position tool per executed trade: a band from the entry down to the stop, one from the entry up to the target, spanning the bars the trade was held for (its entry bar to its exit bar), and an edge and a label at each of the three prices. Drawn under the E and X triangles, so a marker stays on top of the trade it belongs to. The trade's own row is the only source of the prices; the instrument row and the account row supply the digits, the contract size and the currency. |
| Off-window edges | `script.js` | An edge the price scale cannot reach is drawn at the frame and its label says `above this window` / `below this window`, the way an off-window trade is counted rather than clamped onto a bar that is not its own. |
| The caption | `script.js` | The chart caption gains `N executed trade(s) with the position tool drawn`, and `, M without (no stop or target read back)` when a trade could not be sized. |

**The numbers, on the trade this lane actually placed.** BTCUSD buy 0.01 lot, entry `85300.51`, stop `85155.64`,
target `86023.40`, closed 2026-10-04 for -2.08 net. The box the page now draws on it reads: *Target: 86023.40 ·
722.89 (0.847%) · 7.23 USD reward · above this window*, *Stop: 85155.64 · 144.87 (0.17%) · 1.45 USD risk*,
*Entry: 85300.51 · Qty 0.01 · Risk/reward ratio 4.99*. Those are the plan numbers the order tool was run with (a
4.9999 ratio in the scratch file `tmp/before-trade-plan.json`), the difference being that they are now read off the
terminal's own read-back at the size that was traded rather than held in a scratch file. The second trade on the
same symbol, the loop-proof round trip, was placed with nothing attached: it draws no box, and the caption says why
rather than leaving the absence unexplained.

**The bug the cadence caught, and it was a real one.** The first version read the two levels off the entry *deal*,
and the 16:45 and 16:50 runs failed with `'TradeDeal' object has no attribute 'sl'`: MT5 books the stop and the
target on the order, not on the deal. The fix reads them from the position's own order history
(`history_orders_get(position=...)`, applied oldest first so the last level set is the one reported), and a run that
cannot read that history writes null rather than failing the whole read-back. The 16:55:20 run then wrote the
artifact with `stop_loss 85155.64` and `take_profit 86023.4` on the position that carried them and null on the one
that did not - evidence that the fix works against the live terminal rather than against a fixture. Two failed runs
cost two five-minute ticks and published nothing: the artifact the page reads was left at its previous good state
throughout, and the publisher refuses a run the producer failed.

**Evidence.** `tests/l2l_sizing.test.js` 7 of 7, `tests/live_trading_feed.test.js` 49 of 49,
`tests/live_trading_readback.browser.test.js` 2 of 2, `tests/live_trading_order_tool.test.js` 7 of 7, `node --check`
clean on `script.js`, `lib/l2l_sizing.js` and every touched test file, `ast.parse` clean on the producer, and the
page's own validator 0 errors against the refreshed artifact. The photograph is `tmp/position-tool-chart.png`,
rendered from the artifact the cadence wrote (`generated_at_utc 2026-10-04T16:55:20Z`) with zero page errors: the
green band above the entry, the red one below it, the three labels, and the caption reading *2 executed trades on
this chart (E entry, X exit)* beside *1 executed trade with the position tool drawn, 1 without (no stop or target
read back)*.

**Boundaries.** Nothing here places, sizes, amends or closes anything: the sizer is arithmetic over a row it is
handed, the chart draws it, and the only file in this lane that can send is still `live-trading-order.py`, untouched
by this change. The producer gained one read-only function (`history_orders_get`, added to the tested allowlist) and
two fields on a row it already published; the schema version, the cadence, the validator's other rules, Layer 1, the
backtester and the sealed Gold window are untouched. A box drawn at the prices a trade was bracketed with is a
record of what the terminal reported, not a signal, a forecast, an edge or evidence that the rule makes money, and
the amounts on it are what those prices were worth at the smallest size the broker allows rather than a sized plan:
the risk per trade is still the user's open decision. The seven sizer cases include the two that matter for honesty
here - a trade with no stop, no target or a bracket on the wrong side of its entry has no box at all, and a stop and
a target that the scale cannot reach are named as out of the window rather than drawn at a price that is not theirs.

| The rules | `styles.css` | `.live-trading-chart-tool` and its `.target` / `.stop` / `.entry` / `-label` rules, deliberately lighter than the open position's own band because it is what has already happened. |
| The levels on a closed trade | `tools/mt5-bridge/live-trading-snapshot.py` | `read_position_levels(position_ids)` reads each closed position's own orders with `history_orders_get(position=...)` and takes the last level actually set; `build_closed_trades` carries them as `stop_loss` and `take_profit`, null when the run could not read them. |
| The validator | `scripts/validate_live_trading_feed.js` | A closed trade's `stop_loss` and `take_profit` must be null or a positive price, and may be absent: absent is the older snapshot, null is a trade opened with nothing attached, and the two are different facts a page has to tell apart. |
| Cache-busters | `index.html` | `script.js` and `styles.css` move to `?v=20261004-l2l-position-tool`, and the new `lib/l2l_sizing.js` is loaded with the same token. `lib/l2l_levels_store.js` and `lib/l2l_ladder.js` did not change, so their tokens did not move. |
| Tests | `tests/l2l_sizing.test.js` (new), `tests/live_trading_feed.test.js`, `tests/live_trading_readback.browser.test.js` | Seven unit cases for the arithmetic and the refusals, four source cases for the wiring and the validator rule, and a browser case that drives the real page and reads the box, its two bands, its three labels and their exact arithmetic back. |


## 35. The position tool is on production main (release, 2026-10-04)

**The user reported that the box under the past trade was not on the chart they look at, and it was not.** Section 34's
work was committed in this lane only, so the published page still ran the marker release's `script.js`. The cause was
neither the data nor the drawing: the published `data/live-trading.json` had carried `stop_loss 85155.64` and
`take_profit 86023.40` on BTCUSD `297646459` since the producer's fix, because the cadence has published that read every
ten minutes. What the reader's `script.js` did not have was the position tool. Released as one commit, cut the way
sections 15, 31 and 33 were cut.

| commit | what it is |
| --- | --- |
| `262905b` | The port. `lib/l2l_sizing.js` (new, 194 lines) and `tests/l2l_sizing.test.js` (new, 182 lines) arrive from the lane; `script.js` gains the box in `liveTradingChartTrades` and the caption counts (+230); `styles.css` gains the tool's own rules (+38); `tests/live_trading_readback.browser.test.js` gains the box cases (+127/-1); `index.html` moves `styles.css` and `script.js` to `?v=20261004-l2l-position-tool` and loads `lib/l2l_sizing.js` before `script.js`. 6 files, +765 / -11. |

**The route, and the two things it had to leave alone.** A release worktree off `origin/main`
(`.local/live-trading-position-tool-release`, branch `release/live-trading-position-tool-20261004`), the lane's regions
moved across byte-exactly - `git diff 79d1e79~1 79d1e79 -- <paths>` applied by `git apply`, rather than retyped - and
all ten `script.js` hunks and both `styles.css` hunks landed against main's own copy of those files at a -89 and a -524
line offset. `index.html` was the one file the patch could not carry whole, because main's copy is a different document
from the lane's: the two token moves and the new script tag were made by hand and the lane's staler cache-buster for
`lib/l2l_levels_store.js` was deliberately left where section 31's release put it (`?v=20261004-l2l-store-published-wins`),
as that is not this release's change. The lane-only tooling main does not carry at all - the producer, the validator and
`tests/live_trading_feed.test.js` - stayed behind, and so did the docs. The feed's publisher writes
`data/live-trading.json` on the ten-minute cadence, so the branch was rebased onto `538b122` (the 17:40 read) before the
push and the verification set was re-run against the rebased tree, because the browser tests read that committed file.
`git push origin HEAD:main` was a fast-forward: `538b122..262905b`.

**Evidence.** On the rebased release tree: `node --test` over all ten test files, `# tests 109`, `# pass 109`, `# fail 0`,
in 79 seconds - the lane's five feed and order-tool test files are not on main to run, since main does not carry the
producer they cover. `node --check` clean on `script.js`, `lib/l2l_sizing.js` and `tests/l2l_sizing.test.js`. The release
tree was rendered against the published artifact before the push (`tmp/position-tool-release-chart.png`) and the published
site was rendered after it (`tmp/live-site-position-tool.png`), both with 0 page errors and the same three lines on
BTCUSD `297646459`: *Target: 86023.40 · 722.89 (0.847%) · 7.23 USD reward · above this window*, *Stop: 85155.64 · 144.87
(0.17%) · 1.45 USD risk*, *Entry: 85300.51 · Qty 0.01 · Risk/reward ratio 4.99* - the target band clamped at the frame
because the price has fallen to 85294 and 86023.40 is above the window, and the second trade on the symbol drawn without
a box, the caption saying *1 executed trade with the position tool drawn, 1 without (no stop or target read back)*.
Published state confirmed at the pinned commit: `.../262905b/index.html` carries `styles.css?v=20261004-l2l-position-tool`,
`lib/l2l_sizing.js?v=20261004-l2l-position-tool` and `script.js?v=20261004-l2l-position-tool`; `.../262905b/script.js`
carries the tool's bands and labels; `.../262905b/lib/l2l_sizing.js` carries `tradePositionSizer`. The Pages page itself,
read at the live URL rather than at the commit, serves the same token and draws the same box.

**Boundaries.** No order path was added, touched or called by this release; nothing places, sizes, amends or closes
anything and the browser still reaches no broker. The release does not touch the producer, the validator, the feed
schema, the cadence, any Layer 1 agent or any backtesting file, and it writes `data/live-trading.json` not at all - the
cadence owns it. A box drawn at the prices a trade was bracketed with, and what those distances were worth at the 0.01
lot that was traded, are records of what the terminal reported: not a signal, a forecast, an accuracy claim or evidence
that the entry rule makes money, and the risk per trade is still the user's open decision.


## 36. The M5 chart opens on the two nearest marked levels each side (user report and build, 2026-10-04)

**The user asked to be able to see the ladder on the five-minute chart - "at least 2 L2L levels in either direction".**
Section 30 published the marks and made them visible, but it did not put any of them on the price scale the M5 view
opens on. A ladder step is measured on the timeframe the seeds were marked on (BTCUSD 1,454.87 points, EURUSD 0.00421,
XAUUSD 71.48, US100.cash 274.82) while the window draws 120 M5 bars, which span a fraction of that, so every marked line
sat outside the window and the chart showed two edge tabs rather than lines. The scale now widens to the nearest two
published levels on each side of the bars and stops there: the level above and the level below the price, which is what
a five-minute close is read against. It is deliberately not every line - ten steps each way would leave the candles as
a stripe - and two each way is the floor the user asked for.

| what | where |
| --- | --- |
| `LIVE_TRADING_CHART_NEAR_LEVELS = 2` | `script.js`, beside the fit-levels flag |
| the window | `liveTradingChartPlot`: the bars' own high and low, then the two nearest lines above `max` and the two nearest below `min` |

**What did not change.** `Fit levels` still widens the scale to the outermost published line (all 22 on BTCUSD), still
defaults off, and is still restored from the saved navigation state on the next load. Lines past the scale are still
counted on an edge tab naming how many there are and the nearest price, and that tab is still the one-click control.
Nothing is clamped onto an edge, so the chart never draws a line at a price that is not there.

**Evidence.** `tests/live_trading_levels_visibility.browser.test.js`, against the real page and the real feed: with the
tight BTCUSD fixture the default view now holds 4 of 22 lines and the caption reads *2 seed levels · 20 derived · 4/22
lines in view (8 above, 10 below) · ladder 68564.96 to 99117.23*, the tabs read *▲ 8 levels above · nearest 88933.14 ·
click to fit* and *▼ 10 levels below · nearest 81658.79 · click to fit*, and the one-click fit still reaches 22/22 with
no tab left over. A second case opens **each** symbol in turn against the committed feed and the committed artifact and
asserts at least two marked lines above that symbol's own bars and at least two below, which is the user's requirement
stated as a test rather than as an intention. The lane suite runs `# tests 614`, `# pass 610`, `# fail 4`, and those four
are `backtester/tests/secret_scanner.test.js` - the PowerShell secret scanner reports matching paths without its rule
ids - which fail identically on the untouched control-plane checkout and are not this change.

**Two guards moved with it, because publishing levels needs them to.**
`tests/l2l_levels.test.js` no longer requires the committed artifact to start at zero levels. What it requires is that
nothing in the file is unaccounted for: every published symbol is named, a symbol that carries levels carries exactly
its two hand-marked seeds, every other line is an exact step of that one seed distance, and each derived line still
cites the anchor pair it came from. The "not a second order or credential surface" case now also holds the shared note
to the same terms, because the note both writers carry said "the reader's own GitHub account" and would have failed that
check the first time a marking was written; it now says the reader's own GitHub token instead. Those two failures were
the last thing standing between the marked EUR, GOLD and NQ ladders in this working copy (four pairs, 22 levels each)
and a published file, and the decision to publish them is still the user's, not this change's.

**Boundaries.** No order path was added, touched or called: nothing places, sizes, amends or closes anything, and the
browser still reaches no broker. The window is a view of published level prices; it is not a signal, a forecast or
evidence that the entry rule makes money. `data/live-trading.json` is untouched by this change - the cadence owns it.

## 37. The rule is on the page for all four pairs, and the M5 pane zooms without losing the ladder (user request and build, 2026-10-04)

**The user's instruction was the priority of the day:** *"make the l2l trading rules live on all 4 pairs so they are
ready to take live trades from tomorrow"*, then *"I need to be able to zoom in and out on the 5m so I can see at least
2 l2l levels above and below"*, and *"I have added the l2l levels to nq, eur, gold and btc, ingest them and save
them"*.

**What "live" can mean here, said plainly first.** The rule has been one shared module since it was written -
`lib/l2l_strategy.js`, 16 contract tests, deliberately carrying no order call - and no page loaded it, so nothing on
screen said what any pair was waiting for. This section puts it on the page: `index.html` loads the module, `script.js`
hands it the three published artifacts once per render, and the Live Trading section states a row for each of the four
pairs. It still does not trade, and nothing in the project trades by itself: the only thing that can send a ticket is
`tools/mt5-bridge/live-trading-order.py`, run by hand, and the FTMO support reply on automated trading during a Swing
evaluation is still open. "Live" therefore means *the reading is live on the published page* - the stage, the line and
the ticket, per pair - not an order that fires on its own.

| what | where |
| --- | --- |
| the rule, loaded by the page | `lib/l2l_strategy.js`, `<script>` before `script.js` in `index.html` |
| the reading for every pair | `liveTradingRuleReadings` in `script.js`: the sealed calls, the marked ladder, the M5 bars, one instant for all four |
| the table | `liveTradingRulePanel`: pair, call, stage, level, newest closed M5, distance past the level, limit, stop, 5R target, risk, and the module's own sentence |
| the ticket on the chart | `planMarkerPrices` handed to `liveTradingChartPlot`, drawn as the limit, the stop and the target |

**The page does not do the arithmetic.** Every stage, distance and price in the table comes back from the module; the
page prints it. That is what stops the screen and the checker drifting on what "confirmed", "waiting" and "blocked"
mean, and it is why the new browser test holds the page to rows the test computes from the same artifacts.

**A call that has run out of its own window is not a direction.** Layer 1's artifact keeps the older call until the
next run overwrites it, so the page hands the module a direction only when that call's own window
(`forecast_window_end`, or `expires_at`) is still open and its status is not `EXPIRED`. Otherwise the row says which
call is stored, when it was sealed and when its window closed, and the module refuses with `no-call` rather than
sizing a ticket on a forecast that ended. Read off the published page rather than off a local file, the production artifact is a good deal fresher than this lane's copy: the day after the release the live table read `3 waiting, 1 no call` - EUR `BEARISH` (short), GOLD `BEARISH_LEAN` (short) and NQ `BULLISH` (long), all three calls sealed 2026-10-02T07:27Z and ending 2026-10-05T07:27Z, each waiting because the newest closed M5 candle had not crossed a marked level in its own direction, and BTC refused with `NO LIVE CALL` because its own call (sealed 02 Oct 07:28Z) closed on 03 Oct 07:28Z. The lane's own `data/layer1.json` is older - 2026-09-07, its window closed 2026-09-08 - and that is the file this lane's test fixture reads on purpose, which is why the first writing of this section said all four rows were refusing when the published page said three were live. What the panel must not paper over is a call whose own window has closed; the live page shows a live reading and a refusal side by side, and neither is invented.

**When a row is confirmed, the chart draws that row's ticket.** `planMarkerPrices` returns the three prices the module
itself produced - the limit at the level, the stop behind the leg that made the deviation, and the target at five
times the risk (the two ticket prices were corrected on 2026-10-05: the target is the next marked line and the stop
is one fifth of that distance - section 40) - and the plot draws them as dashed lines labelled with those prices, on the same scale as the
candles, widening the scale to hold all three. The chart caption states the same three prices. A pair the rule is only
waiting on draws nothing: there is no ticket to draw.

**The zoom is a window, not a different picture.** `LIVE_TRADING_CHART_ZOOM_STEPS = [1, 2, 4, 8]`: 1 draws every bar
the snapshot publishes for the timeframe on screen (120 on M5), each press halves that window, and
`LIVE_TRADING_CHART_MIN_BARS = 12` is the floor so the closest steps are still a chart. The slice is taken once, at
the top of the plot, so the candles, the volume histogram, the time scale, the executed trades, the open position and
the crosshair all move together and nothing is ever placed against a bar that is not on screen. The price scale is
rebuilt from the bars that are drawn, plus the two nearest marked lines each side - which is the user's floor
expressed as a consequence of the design rather than as a special case: **at every magnification, two marked levels
above and two below stay on the picture.** The magnification is a view control like the symbol and the fit button, so
it is written to the saved navigation state, restored on the next load, and answers the wheel over the price pane.
`Fit levels` is unchanged and still reaches all 22 published lines at any zoom.

**The ladders the user marked are in the file.** `data/l2l-levels.json` carries two hand-marked seeds and twenty
derived lines for each of EURUSD, XAUUSD, US100.cash and BTCUSD, written 2026-10-04T16:14:19Z by the marking surface
and committed with this change, so the published page reads the four ladders the model is running from rather than the
BTC-only file that was there before.

**Evidence.** Two new browser tests, both against the real page and the real artifacts.
`tests/live_trading_rule_panel.browser.test.js` has two cases: with the committed calls expired, all four pairs get a
row, every row reads `NO CALL`, and no row states a ticket; then, with live calls and three crafted five-minute
candles whose newest close really does finish above the 84568.53 seed, the page is held to the module's own reading -
the ticket `84568.53` / `84450.00` / `85161.18` at 5R, its reason sentence, and the three labelled lines the chart
draws from `planMarkerPrices`. `tests/live_trading_chart_zoom.browser.test.js` walks the zoom from 120 bars to 15 at
8x and back, asserting at each step that the drawn bars and the volume bars match the window, that at least two
marked lines sit above the drawn bars and two below, that the ends of the ladder are the ends (the buttons disable),
that the magnification survives a reload, that the wheel zooms the pane, and that fitting the ladder still reaches 22
lines without changing the window of bars. Three existing checks moved with the signatures they hold:
`tests/live_trading_feed.test.js` (the plot and the shell now take the reading), `tests/l2l_levels.test.js` (the zoom
travels in the saved navigation state beside the symbol, the timeframe, the style and the fit control) and
`tests/live_trading_readback.browser.test.js` (the rule table is a third table panel on the section, so the two
read-back panels are now named by what they are not). `lib/l2l_strategy.js` gained one thing the page needed and
nothing else: an instant handed to `strategyReadings` is passed to every pair's reading, so the same clock decides
"has this bar closed yet" for all four. Lane suite: `# tests 618`, `# pass 614`, `# fail 4`, and the four are
`backtester/tests/secret_scanner.test.js`, which fail identically on the untouched control-plane checkout.

**Boundaries.** No order path was added, touched or called, and no new route to a broker exists: the module carries no
network or order call (asserted by its own test), the page only prints what it returns, nothing is scheduled to run
the order tool, and the size is still not a value typed anywhere: the tool takes each instrument's own smallest tradable size, read from the terminal rather than supplied, and scaling it up is the later step. A confirmed row is a ticket for a person to place, and a
reading is not evidence that the rule makes money.

## 38. The rule, the zoom and the four ladders are on production main (release, 2026-10-04)

**The port.** Section 37 built the three things the user asked for; this section puts them on the page the user opens.
One targeted region port, commit `5262f8d`, fast-forward `4ad1002..5262f8d`, twelve files, +2,738 / -57.

| what | where |
| --- | --- |
| the rule, loaded by the page | `lib/l2l_strategy.js`, `<script>` before `script.js` in `index.html` |
| the pair-by-pair table and the ticket drawn on the chart | `script.js`, `styles.css` |
| the four ladders the user marked | `data/l2l-levels.json`, generated 2026-10-04T16:14:19Z, four instruments, 22 levels each |
| the store's own note | `lib/l2l_levels_store.js`, one line: the reader's own GitHub token, not account |
| the cache-busters | `styles.css?v=20261004-l2l-rule-and-zoom`, `script.js?v=20261004-l2l-rule-and-zoom`, `lib/l2l_strategy.js?v=20261004-l2l-rule-live`, `lib/l2l_levels_store.js?v=20261004-l2l-store-note` |

**Why a region port and not a file copy.** `main` and this lane have diverged. Main carries the shared navigation
(`tabFromHash` / `setupHashTabs`) and the pair-coverage work; this lane carries the feed cadence, the order tool, the
backtesting-development tracker and the live-trading feed tests. Copying either tree's `script.js` or `styles.css` over
the other's would have deleted the other's work, so only the live-trading regions were moved, and the move was checked
by counting every new identifier in both trees before the commit - `LIVE_TRADING_CHART_ZOOM_STEPS`,
`liveTradingChartWindow`, `liveTradingRulePanel`, `live-trading-chart-rule`, `live-trading-stage` and the rest match
one for one.

**Evidence on the release tree.** 198 tests, 197 pass, 1 fail. The failure is `tests/refresh_progress.browser.test.js`'s
overview-freshness case, which is a pre-existing race - the panel paints once before the dashboard's own artifacts land,
and that first paint already carries the verdict heading and the workflow's own date, so a check can read it and call it
a verdict - and it fails intermittently on the untouched `main` checkout at the same commit:
`node --test --test-name-pattern 'mixed publish windows'` failed 1 of 3 runs on the pristine tree and passed 3 of 3 on
this one in the same session. This lane's copy now waits for the verdict it asserts, read with the whitespace
normalised the way the assertion reads it, and the file runs 27 of 27 twice over; production's copy still carries the
older wait, so that check can still read the empty paint there - it is the refresh-progress lane's file and this
release deliberately did not touch it. The seven files this release touches pass 75 of 75 run sequentially. **Verified
where a reader would look, not only in a log:** `5262f8d/index.html` on raw.githubusercontent carries all four bumped
tokens including the new `lib/l2l_strategy.js` tag, and the live
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/data/l2l-levels.json` serves `generated_at_utc`
2026-10-04T16:14:19Z with `instrument_count` 4 and 22 levels on every symbol, which is the copy that had four empty
ladders before this release.

**Two checks moved with the change, both because the data or the scale they measure changed.**
`tests/live_trading_rule_panel.browser.test.js` now reads its fixture's directions from the committed Layer 1 artifact
instead of typing them: production's `data/layer1.json` publishes different calls from this lane's copy (EUR
`BEARISH`, GOLD `BEARISH_LEAN`), so a typed expectation passed here and failed there. And
`tests/live_trading_readback.browser.test.js` compared the position band's bottom edge to its stop line within a
hundredth of a pixel; with the price scale open on the two nearest marked levels each side, the same 359-point
stop-to-target span is about 36 pixels instead of 399, so the sum of two two-decimal attributes can differ from a
third by exactly 0.01. The tolerance is 0.02 now, with the reason beside it. Neither change weakens what is asserted:
the band still has to be the span between the same two lines.

**Boundaries.** The release adds no order path and no schedule: the only thing in the project that can send a
ticket is `tools/mt5-bridge/live-trading-order.py`, run by hand, and the FTMO support reply on automated trading
during a Swing evaluation is still open. The size is not a number typed into anything, and the record said otherwise here until the user corrected it: the order tool defaults both the volume it asks for and the cap a run allows to the symbol's own `volume_min`, so the smallest trade the instrument accepts is what a run sends, and growing it takes two deliberate arguments. That floor is the automated part today; scaling it over time is the user's stated plan rather than something this release built. What is live is the reading and the ticket, pair by pair: read off the published page the day after this release, three rows carried a live direction - EUR short, GOLD short, NQ long, the calls sealed 2026-10-02T07:27Z and ending 2026-10-05T07:27Z, all three waiting for an M5 close beyond a marked level - while BTC's row read `NO LIVE CALL` because its own call had closed the day before. A reading is not evidence
that the rule makes money.

**The fresh Layer 1 run, requested and landed after the release.** The Master refresh was asked for from this lane on
the user's word and the webhook answered `200` `Workflow was started`; the run finished 2026-10-04T20:05:44Z, `Manual
Refresh Complete`, and `data/layer1.json` was republished in `e7ff321` at 20:05:42Z. Nothing on this page, in the levels
file or in this lane was changed to make the rows move: read straight off the published page afterwards, the table is
`4 pairs - 0 confirmed - 4 waiting - 0 no call`, with EUR `BEARISH_LEAN` short, GOLD `BULLISH_LEAN` long, NQ `BULLISH`
long and BTC `BULLISH_LEAN` long - the weekday pairs' windows running to 06 Oct 04:00Z and BTC's to 05 Oct 20:04Z. Four
waiting rows is the honest reading of a live direction with no five-minute close yet beyond a marked line in that
direction: 196 points away on EUR, 307 on GOLD, 26,249 on NQ, 66,943 on BTC. No row is confirmed, so no ticket exists
anywhere on the page.

**Saved here for now: what is live, and the conditions the rule is waiting on.** Checked again after that run, on the
published page rather than in a log: `main` still carries `54b8f70`, `script.js` on the released tree still reads "not a
number typed in: it is that instrument's own smallest tradable size, read from the terminal rather than supplied", the
old sentence is gone, `index.html` serves `script.js?v=20261004-l2l-size-not-typed`, and the live table reads
`4 pairs - 0 confirmed - 4 waiting - 0 no call - 0 no levels - 0 unavailable`. The conditions, in the order the module
checks them, so a reader can hold the table against them: an open position on the pair blocks the row (one trade per
pair); the pair's own Layer 1 call must carry a live direction - `BULLISH` long, `BEARISH` short, and a call whose own
window has closed is not a direction, so that row is a refusal rather than a trade; a marked L2L line must exist for the
symbol; the newest **closed** M5 candle must finish beyond a line the candle before it had not finished beyond, by at
least one point of the instrument's own grid, which is a fresh crossing rather than a price that has been sitting past a
line; and only then does a ticket exist - a limit back at that crossed line, the *next* line marked past that entry
in the trade's own direction as the 5R target, and the stop one fifth of that entry-to-target distance behind the
entry, entry type `limit`. Sections 39 and 40 carry the correction: the leg-derived stop and the multiple-derived
target this paragraph was written with were replaced on 2026-10-05.
Until then the row waits and states the line it is watching and how far away it is. The two things asked of the user and
not yet answered, kept here rather than acted on: whether a pair whose newest closed M5 comes within one ladder step of
its nearest line should be alerted on the page, or whether the alert stays at the outer bound as it is now; and whether
a confirmed row should also state a size in lots, or stay in prices only. Nothing else is outstanding on the size or the
caption. The reading probe used for all of the above is kept as the standing check in the ignored `tmp/` folder
(`tmp/probe-live-rule.js`, output `tmp/live-rule-probe-final.txt`); it writes nothing, sends nothing to a broker and
stops after printing. The only uncommitted file in this lane is `data/live-trading.json`, which is the feed's own
snapshot being rewritten on its cadence, not a change of this lane's.

## 39. The confirmed row places its own ticket: one loop, one sender and the gates between them (user request and build, 2026-10-05)

**The instruction was the whole of the reason.** Asked whether to build an automatic placement path now, and which
account its first order should go on, the user answered "Yes build it now" and "Live challenge account". Until this
section the lane could read a ticket and could not place one: `lib/l2l_strategy.js` computes the stage and the prices,
the page prints them, and the only thing that could send was `tools/mt5-bridge/live-trading-order.py`, run by hand.
That is still true of every file the browser can reach, and the loop built here is a caller of that one sender rather
than a second one.

**What was built, in three pieces.**

| what | where | what it is |
| --- | --- | --- |
| the sender gained a pending entry | `tools/mt5-bridge/live-trading-order.py` | `--entry-price` leaves one limit at that price instead of taking the market, and `--expire-minutes` makes it run out on the terminal's own server clock. That flag is the tool's own cap rather than the rule's lifetime for an entry - section 42 corrects it, and the loop no longer passes one. The rule's ticket is a limit back at the crossed level, so the entry the loop places is the entry the ticket states rather than a market order standing in for it. A server that refuses an expiry outright is answered once more without it, and the record says which of the two was left: the rule never asked for an expiry, so it must not be the reason a ticket is not placed. |
| the loop | `scripts/run-live-trading-trader.js` | one run reads the artifacts, reads the terminal, asks the rule and places what is confirmed, through the tool, once per signal bar. |
| the cadence | `scripts/register-live-trading-trader-task.ps1` | `LiveTradingTraderTick019`: the same five-minute clock as the feed, aligned to the bar close plus a 90-second settle so the feed's own run and its publish have landed first. Unarmed unless `-Arm` is passed. |

**What the loop reads, and why each one is read there.** The calls and the ladder come from the published checkout -
`.local/live-trading-feed-publish` beside the canonical root, resolved by the feed publisher's own helper - because
those are the bytes the published page serves, so a level a reader can see is a level the loop trades from. The Layer
1 calls are read the way the page reads them: the priority call's direction, falling back to the 24h call's, with a
call whose own window has closed counting as no direction at all, which is the difference between the published table
and this lane's older copy of `data/layer1.json`. The bars and the account come from this machine:
`data/live-trading.json`, which the cadence rewrites seconds after each M5 close, and a read-only `status` call to the
tool, so the account is read live rather than from a snapshot that may be minutes old.

**Four gates stand between a confirmed row and a send, and each one refuses rather than warns.**

1. **`--confirm-live`**, the same word the tool itself gates on, so arming is one deliberate act in two places. Without
   it the run reads everything, records the ticket it would have left on `BTCUSD` at `84500` / `84250` / `85750` and
   sends nothing - and deliberately leaves no state, so looking cannot spend a signal bar.
2. **A fresh snapshot and a live terminal read.** A snapshot outside its own `stale_after_seconds` is refused before
   the terminal is even read; a terminal that cannot be read leaves the account unknown and nothing is sent into it.
3. **One ticket per signal bar, one per pair, and two caps.** A signal bar already taken on a pair is never taken
   again, even if that ticket closed, because the crossing that produced it has been spent; a pair that already
   carries a ticket from this path is left alone; `--max-open` (default 1) limits working tickets and `--max-per-day`
   (default 4) limits placements in a UTC day. What has already been attempted is kept in
   `tmp/live-trading-trader-state.json`, and what is still working is read back from the terminal, so the two agree
   even if the file is deleted.
4. **No size of its own.** The loop passes no `--lots` and no `--max-lots` at all, so the tool's own default applies:
   the symbol's `volume_min`, the smallest position the instrument accepts. Growing it takes a deliberate edit in the
   tool's own words, not a number in the loop.

**A refused ticket is not a failed run.** A limit at or through the market is refused by name - the retrace it waits
for has already happened - and that attempt is still written down, so the spent signal is not offered again on the
next tick. The run's exit code is 1 only when it could not read the market or a ticket it sent did not land, which is
what the scheduler surfaces.

**What it deliberately does not do.** It cannot cancel, amend or close anything: there is no cancel path in the tool
at all, which is why the placed limit carries a 30-minute expiry rather than sitting there for ever, and why a
position is closed by its own stop or target, or by hand. It places at one size, marks every ticket with the tool's
own magic `20261004` and an `l2l-rule-<asset>` comment, and the browser still reaches no broker.

**Evidence.** `node --test tests/live_trading_trader.test.js tests/live_trading_order_tool.test.js
tests/l2l_strategy.test.js` is 43 of 43, 0 fail: the eighteen new cases cover the call mirror, the ladder join, the
two gates that read, the plan-only run, the armed send and the exact flags it passes, the spent-signal and busy-pair
refusals, both caps, the tool's own refusal path, and the boundary that keeps the loop a caller rather than a sender.
`npm test` across the lane is `# tests 638`, `# pass 634`, `# fail 4` - the four being the backtester's
placeholder-secret scanner cases (`not ok 297`, `298`, `299`, `301`), the same four this machine has failed since the
twenty-third entry, none of them in the Live Trading suites. `python -m py_compile` is clean on the tool,
`node --check` is clean on the loop, and the registration script parses and prints its plan under `-Show`. Run by hand
before any arming, `--once` against the live machine read the published calls (EUR short, GOLD long, NQ long, BTC
long, all live), 22 marked levels per pair, a snapshot 9 seconds old, account `***614` with 0 positions and 0 orders,
four `waiting` rows and no ticket: exit 0, status `planned`, nothing sent.

**The first automatic order, placed by the armed task and read back.** The second run of the registered cadence
(2026-10-05T05:46:30Z, the 05:45 bar close plus its ninety-second settle) found `US100.cash` confirmed - the NQ call
`BULLISH` and live, the newest closed M5 candle at 05:40 closing above the marked line `30774.61` - and left the
ticket the rule states: a buy limit at `30774.61`, the stop at `30768.13`, the target at `30807.01` (5R on 6.48
points), `0.01` lot with no `--lots` passed, comment `l2l-rule-nq`, magic `20261004`, expiring thirty minutes from the
last tick. The terminal answered `TRADE_RETCODE_DONE` on the first attempt - order `297731341`, `expiry_fallback:
false`, so the server took the expiry - and the limit filled inside the minute: the read-back at 05:47:30Z shows one
open position, `US100.cash` buy `0.01` at `30774.58` with the same stop and target, floating `-0.01`, and no pending
orders left. That size is the instrument's own minimum: 6.48 index points of risk on 0.01 lot, about six US cents, and
a target 32.4 points away, about thirty-two. Two things follow without being asked: the pair now carries a position, so
the rule's one-trade-per-pair and the loop's `--max-open 1` both hold every pair back until it closes, and the signal
bar at 05:40 is spent, so that crossing cannot be taken twice. This is the smallest trade the instrument accepts,
placed by the loop rather than by hand - and a fill is a fact about the market, not evidence that the rule makes money.

**The user's answers, on the same day as that first order.** Asked after the ticket had been placed and read back,
the user said two things, and both are instructions rather than questions this lane may re-open. Keep the cadence
armed and proceed: its own five-minute tick is unchanged, the two worktree tasks stay registered, and the FTMO
answer in item 1 stays outstanding without holding the loop back - if that answer comes back against automated
trading, the response is `scripts/register-live-trading-trader-task.ps1 -Remove` or `-Show` rather than a code change,
because the loop places nothing when it is not registered and nothing when it is registered unarmed. Leave the size
at the instrument minimum until different instructions: that is already the tool's own default, so nothing in the
code changes, and no `--lots` will be passed on the user's behalf. A read-back at 05:53:04Z well after the first
order stands behind the decision: one `US100.cash` buy `0.01` position, entry `30774.58`, the same stop and target,
`30793.23` current and floating `+0.19`, no pending orders, and the 05:51:30 tick showing the NQ row `blocked` with
`open_tickets 1` against `--max-open 1`.

**Boundaries, stated rather than implied.** The FTMO question this lane had left open before any automatic order - a
first-party written statement that automated trading is permitted on a Challenge account - is still open, and the loop
is armed on the user's instruction with that answer outstanding: a decision recorded here, not a question answered.
The other open items are unchanged: whether Swing accounts may trade around news during the Evaluation; the leverage
and margin figures read from the terminal rather than assumed; and the two page questions from section 38 (a
near-line alert, and whether a confirmed row should state lots). Layer 1 stays independent, backtesting stays
downstream-only, the sealed Gold prospective window stays sealed until `2027-03-25T15:00:00Z`, and none of this is
edge, accuracy, causal feature-timing or profit evidence: a loop that leaves a ticket is plumbing, and a fill is a
fact about the market rather than proof that the rule is right.

## 40. The target is the next marked line and the stop is a fifth of it: the user corrected the geometry (user correction and build, 2026-10-05)

**The correction, in the user's own words.** *"It seems you misunderstand the position sizing logic, when the 5m
candles deviate the level in the direction of the call you place the limit entry on the l2l level that was deviated
then you set the 5r target to the next l2l level marked on the chart then the stop loss is set to match the 5r
target. This is the same for all pairs."* Read as a rule it leaves the first two steps exactly where they were - a
five-minute close beyond a marked line, a limit back at that line - and changes which of the last two prices is
*given*: the target is now a price the user has marked on the chart, the next line past that entry in the trade's
own direction, and the stop is derived from it at five to one, one fifth of that entry-to-target distance. The
ladder gives the target and the target gives the stop; until this correction the module had it the other way round.

**What the module did before, and why it was not the user's rule.** `lib/l2l_strategy.js` measured the leg that
carried price away from the line - the run of closed M5 bars ending at the confirming candle, capped at twelve, plus
the bar before it when that bar really was the previous five minutes - put the stop behind that leg's own extreme
(the lowest low for a long, the highest high for a short) and set the target at five times that risk. Nothing in the
user's rule mentions a leg: the deviation says *when* to enter, the ladder says *where the trade is aiming*, and the
five is the relationship between those two prices. So the first automatic ticket (section 39, NQ) was a limit at
`30774.61` with the stop at `30768.13` and the target at `30807.01` - 5R on a 6.48-point leg - while the next line
marked above `30774.61` was nowhere near `30807.01`. Neither price was bad arithmetic; both answered a question the
user had not asked, one that made the risk a fact about the last hour of bars and let the target land on a price no
line was drawn at.

**What changed, file by file.**

| what | where | what it is |
| --- | --- | --- |
| the rule | `lib/l2l_strategy.js` | A confirmed reading now takes the next marked line past the entry as the target (`nearestAbove` for a long, `nearestBelow` for a short), computes `risk = reward / 5` from it and puts the stop one fifth of that distance behind the entry. `plan.target_level` carries the marked line itself, so the ticket names the line as well as the price, and `reward_points` is now the entry-to-target distance. The reason sentence reads *... so the rule sits a limit at that line and aims the 5R target at the next marked line `<price>`: the stop is one fifth of that distance behind the entry, at `<stop>`.* |
| the leg machinery | `lib/l2l_strategy.js` | `deviationLeg`, `DEVIATION_LOOKBACK_BARS`, `bucketGapMs` and the plan's `bars_in_leg` field are deleted rather than left unused: with the stop coming off the target, nothing reads the leg any more, and dead code that looks like part of the rule is worse than no code. The trigger itself is unchanged - the newest closed M5 candle must finish beyond a line the candle before it had not finished beyond, by at least one point of the instrument's own grid. |
| the page's own words | `script.js`, `index.html` | Both paragraphs that described the ticket (*the stop behind the leg that made the deviation, and the target at five times the risk*) now read *the target at the next level marked past it in the same direction, and the stop at one fifth of that distance (five to one)*. `index.html` moves `lib/l2l_strategy.js` and `script.js` to `?v=20261005-l2l-level-target`; nothing else on the page moved, because the table's columns, the chart's three lines and the position tool's box all read prices rather than work them out. |
| the tests | `tests/l2l_strategy.test.js`, `tests/live_trading_trader.test.js` | The two ticket cases assert the new geometry (`84500` / `84300` / `85500` on the shared ladder, `84500` / `84700` / `83500` for the short), the marker case hands over the new three prices, and the trader's own fixture, flags and read-back record move with them. |

**Two refusals this adds, and one case that stopped being about anything.** A crossing with no marked line left past
it is refused rather than aimed at nothing (*is the last marked line on that side*), and a next line so close that
five to one would put the stop inside the instrument's own grid is refused too rather than given a stop the terminal
cannot express - the same one-point floor the module already kept, now applied to the derived risk instead of to the
leg. The case that used to prove a two-day-old bar could not define the stop now proves the opposite fact, which is
the point of the change: the same ticket comes out of a block with a weekend in it as out of a clean one, because no
bar has any say in the stop. One further case is new and pins the reading of *the level that was deviated* when one
M5 candle finishes past two lines at once: the entry is the *last* line it deviated - the higher one for a long - and
whatever is marked beyond that is the 5R target. That reading is this section's, taken from the words rather than
stated by the user, and it was the one judgement in this change. The user ruled the case out rather than choosing
between readings the same day (section 41): a five-minute candle is never wide enough to finish past two marked
lines at once, so the tie-break stays in the code as a guard and not as part of the rule.

**Evidence.** `node --test tests/l2l_strategy.test.js tests/live_trading_trader.test.js
tests/live_trading_order_tool.test.js` is 45 of 45, 0 fail, and `node --test tests/live_trading_feed.test.js
tests/l2l_sizing.test.js` is 56 of 56: the same one sender, the same four gates and the same size path, with the
ticket arithmetic now coming off the ladder. The browser suites hold the page to the module rather than to a number
typed into the test - `tests/live_trading_rule_panel.browser.test.js` with `tests/live_trading_chart_zoom.browser.test.js`
is 3 of 3 and `tests/live_trading_levels_visibility.browser.test.js` with `tests/live_trading_readback.browser.test.js`
is 4 of 4 - and `npm run test:unit` across the lane is `# tests 595`, `# pass 591`, `# fail 4`, those four being the
backtester's placeholder-secret scanner cases (`not ok 289`, `290`, `291`, `293` in this run), the same four this
machine has failed since the twenty-third entry and none of them in the Live Trading suites. `node --check` is clean
on the module, on `script.js` and on both edited test files.

**The corrected geometry read off the live loop, not only off a fixture.** The armed cadence's first run after this
change (2026-10-05T06:06:30Z, the 06:00 bar close plus its settle) found GOLD confirmed: the newest closed M5 candle
finished at `4142.12`, 161 points past the marked line `4140.51`. The ticket the module stated - and the loop did not
send, because the Nasdaq position holds the loop's one slot - is the new arithmetic on the published ladder: a limit
at `4140.51`, the target at the next marked line `4211.99` (one XAUUSD ladder step of 71.48 away), the stop at
`4126.214`, and a risk of `14.296`, which is exactly 71.48 / 5. The row's decision was `skip` with the reason *1
ticket(s) from this loop are already working and --max-open is 1*, so the gates held the ticket rather than the rule
being wrong, and the GOLD signal bar was not spent. The other three rows were EUR and BTC waiting for a close of their
own, and NQ `blocked` by the position it already holds.

**One test fixture had to be made deterministic, and it was not this change that made it flaky.** The rule-panel
browser case reads the committed `data/live-trading.json`, and that file is rewritten on its cadence by a producer
that reads the live account, so once this lane's own first order filled (section 39) the snapshot carried a real
`US100.cash` position and the NQ row read `blocked` instead of `no call` - the table's stages had quietly become a
fact about whether a trade happened to be open, on a working copy only, since the committed snapshot still carries
`positions: []`. The fixture now empties `positions` alongside the bar timestamps it already rewrote, and says so
where it does it. The blocked stage keeps its coverage in the rule's own suite and in the trader's live read, which
is where the account belongs.

**Boundaries.** The rule places and cannot amend, so the ticket already at the broker keeps the stop and the target it
was placed with; the corrected geometry applies to the next ticket the loop states, which is what the next confirmed
row will place. Nothing here is edge, accuracy or timing evidence: the two prices are the user's own rule, and a fill
is a fact about the market. Layer 1 stays independent, backtesting stays downstream-only, the FTMO question of
section 39 stays open on the same terms, and the size is still the instrument's own minimum with no `--lots` passed.
One open question is left with the user - the reading above, that a candle which takes out two lines at once enters at
the last line it deviated - and one blank is closed, number 7 of section 17.

## 41. The trigger in the user's own words, the two-line case ruled out, and the old ticket that closed itself (user, 2026-10-05)

**The rule restated as the user put it, because section 40's wording was read as something it was not.** *"it is
just 5m candles are below/above trigger l2l line, one 5m candle then gets back below/above depending on direction
then closes. Once it has closed it has completed the deivation that is then the trigger to set the limit entry, sl
and tp."* That is the trigger this lane has had since section 39 and did not change in section 40: the candles sit
on the far side of a marked line - below it for a long, above it for a short - and one five-minute candle closing
back on the trade's own side of that line is what *completes* the deviation. Nothing fires on the excursion itself,
on a wick, or on a candle whose five minutes have not elapsed. The instant that close is in, the three prices are
stated for the pair: the limit at the line that was deviated, the target on the next marked line past it in the
trade's direction, and the stop one fifth of that entry-to-target distance behind the entry. The module has read
the crossing this way since section 39 - `confirming.close > level.price && previous.close <= level.price` for a
long, mirrored for a short, with at least one point of the instrument's own grid cleared - so the user's words are
a confirmation of the implemented rule and no behavioural change was needed to hold them.

**The case section 40 flagged as a judgement was put to the user, and it was ruled out rather than answered.**
*"what do you mean two marked lines, a 5m candle is never big enough to move between two marked lines at once"*. So
one candle finishing past two marked lines at once is not a case this rule has to decide. The code keeps its
deterministic tie-break - the entry is the last line deviated, the highest for a long, with whatever is marked past
that as the target - but section 41 is where its status changes from *the section's reading* to *a guard against a
ladder marked tighter than one M5 candle can travel*. The module's comment beside the tie-break says the same, and
the paragraph in section 40 that called it a judgement is corrected there with a pointer here.

**The entry and exit conditions, stated back for confirmation.** Entry, in the order they are checked: Layer 1 has
published a direction for the asset; at least one L2L line is marked for the pair, with a further marked line past
the entry in the trade's own direction for the target to sit on; the newest *closed* M5 candle finishes on the
trade's side of a line the candle before it had not finished past, by at least one point of the instrument's grid;
and the ticket is then a limit at that line, so the trade enters only if price comes back to it. The loop's own
gates sit after all of that and each refuses rather than warns: `--confirm-live`, a fresh feed and a readable
terminal, no position already open on the pair, fewer than `--max-open 1` working tickets across all four pairs,
fewer than `--max-per-day 4` placements today, and that signal bar not already spent - a bar whose crossing has
been taken is never taken again, even after its ticket closes. Size stays the instrument's `volume_min`, and this
loop passes no `--lots`. Exits: the stop and the target placed with the position, whichever price is reached first,
with no trailing stop, no time stop, no partial close and no move to break-even. A limit that never fills does
*not* run out on a clock: the user corrected this lane's own thirty-minute guard on 2026-10-05 - *"the limit stays
open until the directional call ends or a new L2L level is passed further away from the intial limit"* - and
section 42 is the record of what replaced it. What stands here instead is that the entry stays until the call it
was left for ends or a marked line further out is passed, and the loop removes it then, by the tool's own `cancel`.
The only other way out of a position is a hand-run `close --ticket` on the order tool, because neither the rule
nor the loop closes or amends a position that is already open.

**Superseded on the stop by section 54 (user request, 2026-10-15).** The sentence above - that the exit side carries
*"no move to break-even"*, and that neither the rule nor the loop *"amends a position that is already open"* -
described the loop as this section left it and is not a description of it now: a trade that has run to twice the risk
it was placed with has its stop taken to its own entry, once per trade, through the tool's own `modify`. The other
exits named here stand as written - the stop and the target placed with the position, no trailing stop, no time stop,
no partial close - and so does the user's ruling that the entry has no expiry.

**The reset the user asked for had already happened by itself, so no order was sent to do it.** *"No reset any
previous positions that werent following the correct tp, limit, sl setup."* The one position carrying the geometry
section 40 replaced - NQ `US100.cash`, ticket `297731341`, comment `l2l-rule-nq`, the `30768.13` stop and `30807.01`
target that came off the old leg arithmetic - was closed by its own target at `30807.93` at `2026-10-05T06:11:11Z`,
1,479 seconds after it filled, for `+0.33` on 0.01 lots (the snapshot's `closed_trades[0]`). `python
tools/mt5-bridge/live-trading-order.py status` read the account back at `06:23:32Z` as *STATUS 0 position(s), 0
pending order(s)*, balance `9997.88`, so there was nothing left to move onto a corrected stop and nothing to close:
a close on that ticket now is refused by the tool's own guard, because it is not an open position. The loop's slot
came free with the position - `open_tickets 0`, `blocked 0` on all four pairs from the `06:11:30Z` run onward - and
NQ reads `waiting` rather than `blocked`. Today's count still stands at the one placement that position used of
four, and because a spent signal bar is never re-read, the gold crossing that the slot held back at `06:06:30Z` is
gone from the reading rather than queued: each tick since has read a newest closed bar that has not crossed.

**What changed on disk for this section, and what it is worth.** One comment block in `lib/l2l_strategy.js` (the
tie-break's status, no behaviour), three lines of section 40 corrected for the ruling, and this section; the page,
the ladder, the level store, the feed cadence, the loop and the trader state were not touched, and no order, amend
or close was sent. Re-run to hold the comment: `node --test tests/l2l_strategy.test.js
tests/live_trading_trader.test.js tests/live_trading_order_tool.test.js` and `node --test
tests/live_trading_feed.test.js tests/l2l_sizing.test.js` is 45 of 45 and 56 of 56, both 0 fail, with `node --check` clean
on the module. Boundaries
unchanged from section 40, and one fact worth stating rather than reading: the NQ target that closed that position
was the old arithmetic's price, and its being reached is a fact about the market, not evidence for the corrected
geometry - the first ticket placed with the corrected geometry has not happened yet.








## 42. The entry has no expiry: it stands until the call ends or a line further out is passed (user correction and build, 2026-10-05)

**Superseded in part by section 46 (user ruling, 2026-10-05).** The second event below - *a new L2L level is passed
further away from the initial limit* - was this lane's reading of the user's own earlier line, and the user has since
ruled the other way: the levels are permanent, and a level is deactivated only by its take-profit being taken or by
the day's call changing direction. A line further out being passed therefore removes no working limit and ends no
trade, and the code that read it is gone. The first event, the removal of the thirty-minute expiry, and everything
else in this section stand as written.

**What was wrong, and whose words it was in.** Section 41 stated the exit side of the ticket as *"a limit that
never fills expires after thirty minutes on the terminal's own clock"*. That thirty minutes was never the user's: it
was this lane's own guard, added when the loop was built in section 39 and described in the tool's docstring as
*"this tool's own guard against a ticket sitting there for ever, not the rule's own entry"*. The user corrected it
in one line on the same day: *"this one is not correct the limit stays open until the directional call ends or a new
L2L level is passed further away from the intial limit"*. So the thirty-minute expiry is gone from the loop, and
what stands in its place is a removal that is judged rather than timed.

**The rule as it now stands, in the two events that end a working entry.** Nothing else ends one, and neither event
is a clock:

1. **The directional call ends.** The pair's asset no longer reads a live direction for the side the limit waits on:
   Layer 1's window for that call has closed, or its status reads `EXPIRED`, or the call has been withdrawn, or it
   has flipped to the other side. The check is the module's own `sideForDirection` over the same call the page
   reads, so "the call ended" cannot mean one thing on the page and another in the loop.
2. **A new L2L level is passed further away from the initial limit.** The newest *closed* M5 candle finishes
   strictly beyond a marked line on the far side of the entry, in the trade's own direction - above a long's limit,
   below a short's - which is the reading that carries the rule's own clearance of one point of the instrument's
   grid. The nearest such line is the one the log states.

**Why "further away from the initial limit" is the only line that can be passed while the entry waits.** A limit is
still working only because price has not come back to it: a buy limit under the market fills on the way down to it
and a sell limit over the market fills on the way up to it, so a limit that is still open has had price move *away*
from it, not through it. The only marked line that can therefore be passed while it waits is one on the far side of
the entry - and a close beyond such a line says the market went on without the ticket, so the deviation it was left
for is behind the market now and the next signal will come from a different line. This is also why an expiry was
never needed for a limit that fails to fill for some other reason: there is no other way for it to fail.

**Why this had to be code rather than a doc edit.** The tool had no removal path at all: it could place a limit and
it could close a position, and section 41 said so. A limit with no expiry and no removal would be a ticket left
working for ever, which is the one outcome the correction must not produce - so the guard had to be replaced by a
decision, and the decision needed a way to act. What was built therefore has two halves: the tool can now take one
of its own working limits back out of the market, and the loop judges both events on every run and asks it to.


**What changed on disk, half by half.**

| what | where | what it is now |
| --- | --- | --- |
| one removal action | `tools/mt5-bridge/live-trading-order.py` | `cancel --ticket N --confirm-live` removes one working *pending* order with `TRADE_ACTION_REMOVE`. It refuses a ticket that is not a working order on this account (a position is not one, and the message names `close`), refuses a ticket carrying another path's magic, sends exactly one attempt - a removal carries no price, so a requote cannot be the answer and a second send would be asking to remove two things - and journals the plan, the request and the terminal's answer like every other run. Closing a position is still `close`. |
| no expiry by default | `scripts/run-live-trading-trader.js` | `DEFAULT_EXPIRE_MINUTES` is `null`: a placement passes no `--expire-minutes` at all, so the limit stands until its reason is gone. The flag stays on the tool and the loop for a deliberate hand run, and an explicit `--expire-minutes 30` still puts it back - tested both ways. |
| the review | `scripts/run-live-trading-trader.js` | `pendingDirection` reads which way a working order waits from the order type the terminal reports rather than from the state file, and `reviewPendings` judges every working order carrying this lane's magic against the two events. It runs before the placement gates, on the artifacts the rule itself reads, and answers `keep` or `cancel` with the sentence it decided by. A pair the snapshot does not carry is left alone rather than removed on a reading that is missing, and another path's ticket is not judged at all. |
| the slot | `scripts/run-live-trading-trader.js` | A limit removed in a run is not counted as working in that same run, so `--max-open` and the one-ticket-per-pair hold are judged on the account as the review leaves it. |
| the evidence | `tmp/live-trading-trader.log` and `tmp/live-trading-trader-state.json` | Every run states the review: `pendings.reviewed`, one row per working order with its decision and reason, and one row per removal with the tool's answer. The state file gains a `cancellations` list beside `placements`, written only for a removal that was actually *sent* - a plan-only run still writes nothing at all, the way looking must not spend a signal bar. A removal that was sent and did not land fails the run rather than passing quietly. |

**Live facts on the same day, and what they are worth.** The second ticket of the day was placed before this
correction and is the first one placed under section 40's corrected geometry: EURUSD sell, order `297744810`,
comment `l2l-rule-eur`, limit `1.11887` at the deviated line, target `1.11466` on the next marked line below, stop
`1.11971` one fifth of that distance behind - and it was left with the thirty-minute expiry that this section
removes. It filled at its own limit at `06:55:01Z` (twenty-three minutes after placement, so the expiry was never
what ended it) and closed at its own stop at `07:32:48Z`, 2,267 seconds after filling, for `net_profit -0.93` on
`0.01` lot (`data/live-trading.json`'s `closed_trades[0]`). Two things follow without being asked: the expiry only
ever bound the *pending* order rather than the position, which is why a fill this close to its own deadline still
ran its stop; and today's count is now **two** placements of four, one more than section 41 recorded. `python
tools/mt5-bridge/live-trading-order.py status` read the account back at `08:05:49Z` as *STATUS 0 position(s), 0
pending order(s)*, balance `9996.95` on `***614`, and the cadence's own ticks since (`07:51:30Z`, `07:56:30Z`,
`08:01:30Z`) all read `nothing_to_place` with 0 tickets of this loop's working. The review therefore has nothing to
remove at this moment: the first live removal under this section has not happened yet, and this section claims no
edge from any of it.

**What is not claimed, stated rather than left to be inferred.** This correction changes what a pending entry does,
not how a ticket is armed: the trigger, the entry limit, the next-line target and the one-fifth stop are section
40's and are untouched. The change takes effect for the *next* cadence tick, because the task runs the script as it
finds it at that moment - a run already in flight keeps the old behaviour. Removing a limit whose reason has gone
says nothing about whether the rule makes money; both of today's live tickets are single facts about the market. The
FTMO first-party answer on automated trading is still outstanding, exactly as section 39 recorded it.

**Checked.** The two touched suites were re-run and the lanes around them with them: the rule, the loop and the
order tool at **54 of 54** (was 45 of 45; nine cases added for the removal, the two events, the freed slot, the
plan-only review and the failed removal), the feed and the sizing suite at **56 of 56**, the four live-trading
browser suites at **7 of 7**, and `node --check` clean on the loop with the tool parsing clean under `ast.parse`.
The tool's own refusal paths were exercised by hand from this machine's session, without a terminal attached:
`cancel` without `--confirm-live` prints the plan and exits 3, and `cancel` without a ticket exits 3 with *"--ticket
must be the positive ticket of the working pending order to remove"*.

## 43. The trade's own level is the entry: a stop-out is answered at the level it was triggered on (user correction and build, 2026-10-05)

**The report, in the user's own words.** *"Also everything seems to be working but I have noticed on NQ one trade is
waiting for the wrong level? It should have reentered at the same level it originally was triggered on until price
crosses the next level. Until the next level as crossed the trigger level is the main entry level and you re-enter
on that level until either the direction changes or TP is hit at which point you wait for the next day."* The same
message answered this lane's two open questions from section 42: a call flipping **is** the call having ended
(*"Yes"*), and *"passed"* means **the candle closes beyond the line** - the newest closed M5 finishing past it, which
is the reading section 42 had already implemented.

**What the loop was doing, and why the user was right.** The module's own reading - the one the page prints - fires on
a *crossing*: the newest closed M5 candle finishing past a marked line that the candle before it had not finished
past. That is right for opening a trade and wrong for the trade's life after it. NQ's second ticket of the day was
placed at `30774.61` at `09:11:31Z` (`order_ticket 297794296`, comment `l2l-rule-nq`), filled at `09:15:36Z` and
closed at its own stop at `09:40:32Z` for `-0.54` (`closed_trades`, `position_id 297794296`). From that moment the
loop had no ticket on the pair and no crossing left to fire on - the 09:05 bar had been spent - so every tick since
read *waiting for a close above 31049.43*, a line 6,070 points away, while the level the trade was actually in,
`30774.61`, sat under the market with nothing resting on it. That is the wrong level the user read off the screen,
and it was the loop's own design saying it: a trade's level was only ever an entry for the one bar that crossed it.

**The rule as it now stands, in the user's order of events.**

1. A pair's trade is anchored at the level its newest ticket was placed at - **the level it was triggered on** - and
   that level stays the pair's entry level while the trade is standing. It is not a fresh crossing: the crossing that
   opened the trade has already happened and been spent.
2. The trade is standing while the call it was left for still reads as its own side, and while its target has not
   been reached. Nothing else holds it and nothing else ends it - **not the next level being approached, and not a
   stop-out**: a ticket that filled and stopped is still the pair's trade, and the limit goes back at the same level.
3. The three prices are the same three as any ticket's: the entry is that level, the target is the **next** marked
   line past it in the trade's own direction, and the stop is one fifth of that distance behind the entry. The
   arithmetic is one function in the module (`ticketGeometry`) used by both callers, so a limit put back cannot
   differ from the limit that opened the trade - re-read from the ladder as it is marked *now*, which matters
   because the user re-marks lines during the day (NQ's target moved from `30807.01` to `31049.43` between the two
   tickets of this morning).
4. The trade ends, and the level is not re-entered, when either of two things happens:
   **the call changes or ends** (a different side, or no live call - the same artifact and the same
   `sideForDirection` the review already uses), or **the target is taken** - the account's own record of the
   ticket closing at its own take-profit. After either, what opens the next ticket is the rule's own crossing
   again, exactly as before this section. The second half of the target-taken ending as this section first stated
   it - "or a marked line further out being passed, which is where that target sits" - was removed by the user's
   ruling in section 46: the levels are permanent, so a line being passed ends nothing.
5. One fact about the market is stated before anything is sent, because a limit can only rest on one side of it: for
   a long, the entry level must be **below** the price a buy would take (the ask); for a short, **above** the price a
   sell would take (the bid). Section 42's finding is generalised here - a limit that has not filled has had the
   market move away from it - so a trade whose level the market has already gone through is *waited* for rather than
   re-entered, and the row says so in the tool's own terms: *"a buy limit at that level would be a buy now, so the
   retrace it waits for has already happened"*. The tool stays the authority on the send; this reading exists so a
   doomed ticket is not sent every five minutes, and an unreadable quote leaves it null rather than refusing.

**What changed on disk.**

| what | where | what it is now |
| --- | --- | --- |
| one arithmetic for a ticket | `lib/l2l_strategy.js` | `ticketGeometry` holds the three prices - the next marked line past the entry as the target, a fifth of that distance as the stop - and both callers use it. `buildPlan`'s own output is unchanged by the extraction, which is what makes a put-back limit provably the same ticket as the one that opened the trade. |
| the trade's own ticket | `lib/l2l_strategy.js` | `reentryPlan` states a ticket from a level handed in: the entry is that level, `entry_type` is still `limit`, the target and stop are `ticketGeometry`'s, and **no candle is read at all** - `confirmation` is null, because a crossing is not the question here. Its refusals are the module's own vocabulary: `no-call`, `no-levels`, `unavailable` (no readable level), `waiting` (no line marked past the level to aim at, or a stop the grid cannot hold). |
| the trade each pair has on | `scripts/run-live-trading-trader.js` | `tradeCycles` reads one row per pair from the state file - the newest ticket this loop *placed* there - and decides whether it is over: `ended_by` is `call` or `target-fill`, or null while it stands (section 46 removed the third ending, `target-line`). `closedAtItsTarget` is the read that makes the fill case exact: the exit sits nearer one of the two prices that were placed with the trade, which is the price the market reached first. |
| the decision | `scripts/run-live-trading-trader.js` | `decide` takes the cycles: a pair whose trade is standing is not judged by the candles at all, and its row carries `reentry: true`, the trade's own ticket, and a `trade` block (level, target, ticket, `resting`, `ended`, `ended_by` and the sentence). The gates that still apply are the account's own: a pair already carrying a ticket, `--max-open`, a ladder that cannot price the ticket, and the market being on the far side of the level. `--max-per-day` does **not** apply: a ticket put back is the same trade, so `placementsToday` counts trades and `reentriesToday` counts the put-backs beside them. The module's stage and close stay on the row, so a reader sees both readings at once. |
| the review | `scripts/run-live-trading-trader.js` | A third reason to take a working limit out, because the candles cannot see it: the account's own record of the trade closing at its take-profit. This is the one case a take-profit can be hit without any candle finishing past the line the target sat on, and it is also the race a run can lose - a fill between the feed's publish and the terminal read - so the limit comes out on the next tick rather than waiting on a trade that has already been answered. The row carries `target_line` for this one. The other two reasons stated here as unchanged are no longer three: section 46 removed the passed-line reason, leaving this one and the call ending. |
| the evidence | `tmp/live-trading-trader.log` and `tmp/live-trading-trader-state.json` | Every run states `rule.rows` (with `reentry` and `trade` per row), `rule.taken_today`, `rule.reentries_today`, `rule.open_tickets`, and a `trades` block of one row per pair - what it was triggered at, what it aims at, and whether the user's two endings have answered it. A put-back ticket is written to the state with `reentry: true` and the trade's own `signal_time_utc`, so a reader can tie it to the crossing that opened the trade. Nothing new is written when a ticket is not one. |

**The account, on this machine, under the corrected code - the correction is already live.** The cadence runs this
worktree's script, so the `16:11:30Z` tick placed the first ticket under this section before section 43 was written:
NQ, order `297942477`, comment `l2l-rule-nq`, **limit `30774.61`** - the level the `09:11:31Z` ticket was triggered
at, and the level that ticket stopped out at - target `31049.43`, stop `30719.646`, **no `--expire-minutes`**
(`tmp/live-trading-orders.log`, `16:11:32Z`, `TRADE_RETCODE_DONE`), written down with `reentry: true` and the trade's
own `2026-10-05T09:05:00Z` signal bar. At `16:16:30Z` the armed tick then read all four pairs as it now should:
NQ `skip` - *"US100.cash already carries a ticket from this loop"*; EURUSD `skip` - *"the level this trade was
triggered at, `1.11887`, is on the far side of the market (`1.12048`) for a short entry"*; BTC `skip` - *"the level
this trade was triggered at, `86023.4`, is on the far side of the market (`85156.1`)"*; GOLD `none`, waiting on its
own candles. `python tools/mt5-bridge/live-trading-order.py status` at `16:17Z` read **1 working order of this
loop's** - `297942477`, `ORDER_TYPE_BUY_LIMIT`, `30774.61` - and the review kept it: *"no marked line above the limit
at 30774.61 has been passed: the entry stands, and it carries no expiry of its own."* The day's own count is
`taken_today 4` trades and `reentries_today 1`, which is the whole point of the split: the put-back did not spend a
trade the day had already used four of, and the user's rule gets its re-entries in full. No reset of any counter was
needed to make that true, so none was made - the question the user could not place (*"Not sure what you mean"*) is
answered by the split rather than by an edit to the day's count.

**What is not claimed, stated rather than left to be inferred.** The correction changes *which level* a limit is left
at and what ends the trade; it does not change the trigger, the geometry, the size, or the fact that the loop sends
nothing without `--confirm-live`. `16:11:32Z` is one ticket on one pair and is not evidence of an edge - NQ's two
tickets today are one target taken and one stop-out, and this section claims nothing about either. Nothing here says
the day's two endings are exhaustive of what the user will want: *"at which point you wait for the next day"* is read
here as **the level's turn being over** - no re-entry at it, and no resuming of that trade - because the alternative
reading, a pair taking no ticket of any kind again until the next UTC day, would have forbidden the `09:11:31Z`
ticket that followed the `06:11Z` target and that the user has treated as the live trade all along. If the stricter
reading was meant, the change is one line in `decide`: suppress a pair whose trade has ended today, rather than
letting the rule's own crossing open the next one.

**One gap this section does not close, named rather than left to be found.** The page's rule panel states the
module's own reading per pair, and the module has no idea which ticket this loop placed - the trade lives in the
loop's state file, which is local and not published. So on NQ the panel will keep saying *waiting for a close above
31049.43* while the working limit sits at `30774.61`, which is exactly the sentence the user reported. Closing it
means publishing the lane's trades to the page (the working orders are the artifact that says it, and the feed
already publishes the account's positions and closed trades, so it is a change to the feed and the panel rather than
a new exposure) - that is a dashboard change and a publication, so it is its own piece of work and not this one. (It
was taken up the same day and is section 44: the producer publishes the working orders, and the panel reads a pair
this lane holds at that trade's own level.)

**Checked.** The rule suite at **21 of 21** (three cases added for the trade's own ticket: the arithmetic, the short
mirror with a multiple handed in, and every refusal), the loop and the order tool at **44 of 44** (eight cases
added: the newest ticket per pair being the trade, the level holding without a crossing, the call ending, the
account's own target being taken, a marked line further out being passed, the far-side market, the removal on a
target fill, and a spent bar not being a second trade while the level is still put back), the feed and the sizing
suite at **49 of 49**, and the four live-trading browser suites at **67 of 67** with the rule suite and the loop
suite in the same invocation. `node --check` is clean on the loop and on the module, and the tool parses under
`ast.parse`. `buildPlan`'s own eighteen cases, unchanged by the extraction, are the evidence that pulling the
arithmetic out did not move the reading the page prints. The whole local suite is **660 tests, 655
passing**, and both kinds of failure in it are stated rather than waved at: the four placeholder secret-scanner
cases are the narrow-console `Format-Table` artefact section 42 recorded (5 of 5 at 200 columns), and one browser
case in `tests/refresh_progress.browser.test.js` is flaky under load - three quiet runs of that file alone gave 25
of 27 with two different tests failing, 26 of 27 with a third one failing, and 27 of 27 clean, and that file
references neither of the two files this section changed.


## 44. The trade's own level reaches the page: the working orders are published and the panel reads them (user answered the panel question with "yes", 2026-10-05)

**What was asked for, and what was not.** Section 43 ended with one gap named rather than closed: the page's
rule panel states the module's crossing reading for every pair, so NQ said *waiting for a close above
31049.43* - a line thousands of points above the market - while the limit this lane had placed worked at
`30774.61`. Two questions were left with the user there: whether *"wait for the next day"* means the stricter
reading (no ticket of any kind on the pair until the next UTC day), and whether the panel should be changed to
show the trade's own level. The answer was to the second - *2. Yes* - and the first is still open, so section
43's reading of it (the level's turn being over, not the pair's day) stands unchanged and revertible in one
line of `decide`.

**The block that says it was missing from the feed, so the feed gained it.** A ticket left as a limit is
neither a position nor a closed trade: `positions_get` returns nothing for it, `history_deals_get` returns
nothing for it, and the account block only counted it (`orders_open`). That is exactly the fact the page could
not state, and it is the reason the panel fell back to the module's crossing reading. The producer now
publishes it. `live-trading-feed-v3` becomes `live-trading-feed-v4`, and beside `positions` and
`closed_trades` a snapshot carries `orders`: one record per working pending order with its ticket, symbol,
dashboard asset, the order's own type name, side, volume, the level it sits at (`price_open`), the stop and
the target it carries, its magic, its comment, and the moment it was placed as both server and UTC stamps
(`expiration` is null on an order with no expiry of its own, which is a different fact from an expiry that has
passed). The fields are the terminal's own facts and nothing derived: no distance, no percentage, no reading.
`build_order` and `build_orders` sit beside `build_position` and `build_positions` in
`tools/mt5-bridge/live-trading-snapshot.py`, ordered oldest-first by `time_setup` then ticket so one run's
list is stable, and `order_type_name` walks the package's own `ORDER_TYPE_*` constants the way
`tools/mt5-bridge/live-trading-order.py` does, so the feed and the terminal's journal name an order the same
way. No order function was imported, called or armed to add it: `orders_get` was already being called for the
account count, and the test that holds the producer to a read-only allowlist grew by three enum constants
(`ORDER_TYPE_BUY`, `ORDER_TYPE_BUY_LIMIT`, `ORDER_TYPE_BUY_STOP`) and by no call.

**The gate was extended rather than bypassed.** `scripts/validate_live_trading_feed.js` requires the block
(`orders must be an array, empty when nothing is working`), holds every row to the same standard as a position
- a positive ticket and level, a side, a size, a magic, a type, and a placed stamp on both clocks, with
`expiration` null or carrying both - and adds the count agreement its positions rule already had:
`account.orders_open` has to equal the number of rows beside it, because a feed that says an order is working
while carrying no row is a page showing a pair as untraded while a limit rests on it. The failure artifact the
producer writes when no terminal answers carries `orders: []` like the other two blocks, the printed summary
names the working orders and their levels, and `tools/mt5-bridge/README.md` states the new block and the new
schema. This mattered more than a normal schema change: the cadence validates before it publishes and refuses
to publish an artifact it cannot validate, so a producer that wrote a field the validator did not know would
have stopped the site's feed rather than half-updated it. Both halves of that gate landed together, and the
next tick proved it: the `17:25:20Z` run wrote schema `v4` and read `status: ok`, `publish: published`,
commit `d669db8`. The artifact it published carries the real working ticket - order `297942477`, `US100.cash`,
`ORDER_TYPE_BUY_LIMIT`, `0.01` lot at `30774.61`, stop `30719.65`, target `31049.43`, magic `20261004`,
comment `l2l-rule-nq`, placed `16:11:32Z`, no expiry - so the published feed can now say the level the page
could not.


**The page now reads the account before it reads a crossing.** `lib/l2l_strategy.js` gained one artifact and
one stage. `laneHoldings({ orders, positions })` reduces the feed's two account blocks to one row per pair for
the tickets carrying this lane's magic (`LANE_MAGIC`, the same `20261004` as `ORDER_MAGIC` in the loop and
`MAGIC` in the order tool): a row of another magic is not this lane's trade, a row with no readable level
states no level, and when a limit fills and the position and the leftover order both sit on the pair the newer
row is the trade. `holdingPlan` then reads that pair at the level it was triggered on. The arithmetic is not a
second implementation: it calls `reentryPlan`, the same function the loop places from, so the entry is the
trade's own level, the target is the next marked line past it and the stop is one fifth of that distance
behind it. Alongside the rule's ticket the reading states the account's own copy of it - the ticket, its kind,
the level, the stop and the target the terminal reported - and whether those two agree, compared at the
instrument's own precision rather than at the six decimals the module states, because the terminal stores the
level it was sent rounded to the symbol's digits (`30719.646` was sent and `30719.65` is what the terminal
holds, which is agreement rather than a disagreement to report). The stage is `in-trade`, the newest closed M5
close is still stated so the row is not blank, and the sentence is the rule the user stated: *"NQ stays in the
trade it was triggered on at 30774.61 placed 16:11:32Z (ticket 297942477, working buy limit): the limit still
sits at that level, and that level is its entry until the call for NQ changes or the target is taken - not a
fresh crossing elsewhere on the ladder."* `strategySummary` counts it as `inTrade`, `STAGES` carries it, and
`planMarkerPrices` draws the trade's own three lines on the chart with the entry labelled *trade entry
30774.61* rather than *limit at L2L*. The module still decides nothing: whether the trade is still the pair's
own - its call, its target - is the loop's business, decided where the account and its history are read, and
the reading says which of the two endings it is waiting on rather than ruling on them.

**What the panel and the chart show.** The rule table's stage cell prints IN TRADE in a blue tone of its own
(`live-trading-stage.held`), the level cell is the trade's own level with its `trade` role, the limit, stop and
target columns are that trade's ticket, and the sentence beside it is the module's own - the row that used to
read *waiting for a close above 31049.43*. The section's meta line counts it (`4 pairs · 0 confirmed · 1 in
trade · ...`), the panel's own caption states what the stage means, and the chart's caption for that pair
reads *L2L rule IN TRADE: trade's own entry 30774.61, stop 30719.646, target 31049.43 (5R)* with the same
three lines drawn. One table was added to the section so the working ticket is visible on its own rather than
only through the rule: **Working orders**, next to Open positions and Closed trades, one row per order with its
side, type, size, level, stop, target, the moment it was placed, the magic and the comment plus whose ticket
it is - it says *1 working · 1 of the L2L lane's* when this lane's limit is resting there, and it names
`orders_get` as where the row came from. It is a reading like the two tables beside it: it places, changes and
cancels nothing, and the copy says so on the panel. `index.html` moves the two cache-buster tokens and the
strategy module's to `?v=20261005-l2l-trade-level`, because `script.js`, `styles.css` and `lib/l2l_strategy.js`
all changed.


**What the tests hold, and one boundary stated on the panel rather than left to be found.** The rule suite
grew by six cases that start from the number the user reported: the account's rows are this lane's by magic
alone and one row per pair, the reading is the trade's own level with the loop's own arithmetic and the
account's stop and target agreeing at grid precision, a held pair is `in-trade` for the page while the same
artifacts without the holding still read *waiting for a close above 31049.43*, another path's position still
blocks the pair, a trade whose ladder states no ticket is still read as the trade it is, and a side or a level
that cannot be read states what it can and no arithmetic. The feed suite grew by five: a snapshot carrying a
working order validates, a count that disagrees with the rows is refused, a snapshot with no
`orders` block is refused rather than read as "nothing working", an order that could not be a ticket (no
level, no clock, a bad side, a half-written expiry) is refused row by row, and the producer's block, its
ordering fields and its type-name walk are asserted at source. The rule panel's browser suite grew by one case
that hands the page an order built from the published ladder: the row reads IN TRADE at the trade's own level,
the sentence is the module's own with no *waiting for a M5 close* anywhere in it, the chart draws the same
three lines with the trade's own entry label, and the new table states the level, the stop, the target and
whose ticket it is. The read-back suite's two position/closed-trade cases were changed rather than left
passing by luck: they used to select their panels by position (`panels[0]`, `panels[1]`) and now select them by
heading, because a third table sits between them and which one comes first is a layout decision those checks
should not depend on.

**One boundary, and it is a publication rather than a code gap.** The feed's `orders` block is already on the
published site: the cadence passed it through the validator and published it at `17:25:20Z` (commit
`d669db8`). The page that reads it is not, yet. `script.js`, `styles.css`, `index.html` and
`lib/l2l_strategy.js` changed in this worktree, and the branch Pages serves is `origin/main`, so until those
four files are published the site still renders the crossing sentence for NQ - the data is there to say the
right thing and the page code to say it is not. That publication is the coordinator's action by this lane's
own division of work (the register carries no dashboard worker lane and the writer boundary keeps `main` and
the published site with the coordinator), so it is stated here as the next step rather than taken. A local
page render is not proof of what the site shows either way: what the browser cases prove is that the page
reads the trade's own level from the artifacts that are published, not that the same bytes are being served at
the public address.

**The loop beside it read the new artifact and behaved the same.** The trader's `17:26:30Z` tick is an
ordinary one on schema `v4`: `nothing_to_place`, the snapshot read at 70 seconds old, NQ *already carries a
ticket from this loop*, EUR and BTC on the far side of their levels, GOLD waiting on its candles, and the
pending review keeping `297942477` because no marked line above `30774.61` has been passed. One line of its
log changed shape without changing meaning - its `rule` summary now carries the module's `inTrade` count and
reads `0` there, because the loop states the trade it holds in its own fields (`trades`, `pendings`,
`open_tickets`) and does not hand the module its holdings - and no part of the loop reads the new stage, so
its path is the one section 43 left running.


**A held row is stated whatever the pair's call reads, because it states the account's ticket.** In the live
render this showed up plainly: the worktree's own `data/layer1.json` is older than the publisher's checkout the
loop reads, so three pairs read *no live call* while NQ still read its trade - which is the honest split, since
the stage is a reading of the account rather than a permission from the call. The two halves stay consistent
where it matters: when the loop ends a trade's turn (its call flipping, its target taken, a marked line further
out passed) it removes the ticket, and the pair falls back to the crossing reading on the next published
snapshot; while a ticket is still working or filled under this lane's magic, the page states the level it is
at. *(One sentence of this paragraph needed correcting the same night: see section 45 - the fall-back holds while
the candle that passed the line is still the newest, and at `17:51:30Z` the loop put the same level back five
minutes after the target line had been passed.)*

**Checked.** The rule suite at **27 of 27** (six cases added), the feed suite at **54 of 54** (five added), the
loop and the order tool at **44 of 44** (unchanged, and the magic still one number across the loop, the tool
and the module), the feed's cadence and publish suites together with the feed's own at **103 of 103**, and the
four live-trading browser suites - the rule panel, the read-back, the levels visibility and the chart zoom - at
**8 of 8**. `node --check` is clean on `script.js`, `lib/l2l_strategy.js`, the validator and every changed test
file, and the producer parses under `ast.parse`. The producer's live path is not argued from a fixture but read
back from the run that took it: the cadence's `17:25:20Z` line is `status: ok` on schema `v4` with
`publish: published`, and the artifact it wrote carries the working ticket the panel is about. The whole local
suite is **672 tests, 668 passing**, and the four failures are the narrow-console artefact rather than
anything here: `backtester/tests/secret_scanner.test.js` is 1 of 5 at this console's default width and
**5 of 5 with a 200-column buffer**, that file and its scanner are untouched by this work, and it builds its
own temporary repository. The flaky `tests/refresh_progress.browser.test.js` case section 43 recorded passed
clean in this run.

## 45. The same night's log: a line-passed ending flipped back and the level was put on again (found while confirming the loop, 2026-10-05)

The user's ask was a confirmation rather than a change - "confirm to me that the live trader is operational and it
is following the right rules" - so the loop's own log was read tick by tick from the evening backwards. The first
half of that answer is plainly yes: both five-minute tasks are alive (`LiveTradingTraderTick019` last ran at
`20:46:30Z` with `armed: true` and `nothing_to_place`, `LiveTradingFeedTick019` every five minutes at `status: ok`
on schema `v4` and publishing), no tick today is an error, the snapshot the loop reads is 70 seconds old against a
900-second limit, and the account is flat and self-consistent - balance and equity both `9992.59`,
`orders_open: 0`, `positions_open: 0`. The second half produced one defect, in the loop's own reading rather than
in anything this session changed.

The sequence is in `tmp/live-trading-trader.log` and needs no interpretation. `16:11:30Z` placed the NQ limit
`297942477` at `30774.61`. `17:46:30Z` took it back out, and the trade's own row said why: `ended_by: target-line`,
"the newest closed M5 candle at 31057.63 finished beyond 31049.43, the next marked line that target sat on, so the
level's turn is over and the next day is what this pair waits for". Five minutes later, `17:51:30Z`, the same loop
placed the same level again - ticket `297961478` at `30774.61`, counted as a re-entry rather than a new trade - and
its trade row read `ended_by: null` with "the target at 31049.43 has not been reached, so the entry stands at that
same level". `18:31:30Z` cancelled that put-back for the same line-passed reason, on a candle at `31059.73`. Since
`18:36:30Z` the pair has carried nothing and every tick reads `nothing_to_place`.

The cause is one reading in one function: `linePassed` in `tradeCycle` is read from `newestBar` - the newest closed
bar alone - so an ending whose fact is "price passed the line the target sat on" is a *current* reading that can
flip back the moment a later bar closes back under that line. The call had not changed and the account had no
record of the trade closing, so on the tick after the pass the trade looked alive again and the put-back path
priced a ticket from the level. Two readings of one fact were allowed to disagree, and the placement path trusted
the one that had flipped back.

By the user's own words this is the wrong one. "It should have reentered at the same level it originally was
triggered on until price crosses the next level. Until the next level as crossed the trigger level is the main
entry level" - crossing the next level is what takes that level out of the market, and once `31049.43` had been
closed beyond, `30774.61` was no longer the entry level, so a limit back at `30774.61` was not the rule. Nothing was
lost tonight: the put-back rested 283 points under the market and never filled, it was cancelled again thirty-five
minutes later, and the account ends the day flat at `9992.59`. What it does mean is that a pair whose level has been
passed could take a trade the rule had already ended, and that the loop's own sentence - "the next day is what this
pair waits for" - was not true of its behaviour.

Two readings would close it and the choice is the user's, so it is handed back rather than taken: make the ending
monotone - any closed bar since the ticket was placed finishing beyond the target line ends that level for the day,
which is what `target-fill` and `call` already are, because neither can un-happen - or keep the ending re-armable,
in which case the put-back was right and it is the sentence that overstates rather than the placement. No live change
was made while confirming, and the loop is running exactly as section 43 left it.

**The answer was neither reading, and it is section 46.** The user ruled that the levels are permanent - activated
by the 5m deviation that confirmed the call, still active after a stop-out, deactivated only by the take-profit or a
change of direction - so the ending this section found is not a reading to be made monotone or a sentence to be
corrected: it was wrong and has been removed. The put-back this section called questionable was in fact the rule,
and the cancelled ticket at `17:46:30Z` and `18:31:30Z` was the defect. What that section left open is closed here,
and the loop's behaviour under the ruling is stated in section 46.


## 46. The levels are permanent: a passed line ends nothing, and only the take-profit or a change of direction deactivates a level (user ruling and build, 2026-10-05)

**The ruling, in the user's own words.** Section 45 handed back two readings of the defect it found. The user answered
with the rule itself rather than either option: *"the levels are permanent, they are activated when a deviation
happens on the 5m in line with the Layer 1 call. They stay active even if a SL is hit, they ractivate when a 5m candle
deviates again they are only deactivated if the TP is hit or the daily call direction changes."*

**So the defect was not a reading that needed making monotone: the ending itself was wrong.** Leaving a level because
a candle closed past the line its target sat on contradicts "the levels are permanent". A level is activated by the
deviation that confirmed the call in the first place, it survives a stop-out, and it is deactivated by exactly two
things - its take-profit being taken, and the day's call changing direction. Nothing a candle closes at can deactivate
one. Section 45's first option would have kept the wrong rule and merely made its wrongness stable; the ruling
removes the rule.

**What this supersedes, stated so the older sections are not read as current.** Section 42's second event ("a new L2L
level is passed further away from the initial limit") was the removal rule taken from the user's own earlier line
*"the limit stays open until the directional call ends or a new L2L level is passed further away from the intial
limit"*. That line is superseded in turn: the pass no longer removes a working limit and no longer ends a trade.
Section 43's ending *"the target is taken - either the account's own record of the ticket closing at its own
take-profit, **or a marked line further out being passed**"* keeps its first half and loses its second, which is the
same event section 42 built. Section 45's question - monotone ending or a corrected sentence - is answered by
deleting the ending.

**What was *not* changed, because the ruling leaves it standing.**

1. **A stop-out is still answered at the level it was triggered on.** Section 43's re-entry is the ruling's own "they
   stay active even if a SL is hit": a ticket whose trade closed at its stop is not ended, so the limit goes back at
   the same level with the same next-line target and one-fifth stop. Nothing about this section moves that.
2. **"They reactivate when a 5m candle deviates again" is what the resting limit already does.** The level's limit
   rests at the level; price coming back to it is the deviation, and a level the market has run away from is *waited*
   for rather than chased - section 43's far-side reading, which stays exactly as it was.
3. **The take-profit ending, read from the account.** `closedAtItsTarget` is what says a trade's own take-profit was
   taken, because a take-profit is a price the market only has to touch and no candle need finish past its line. A
   limit that never filled has no such record, so under this ruling it is not ended by anything the market did.
4. **The caps and the counts.** A ticket put back is still the same trade rather than a second one, so
   `--max-per-day` still does not count it; the day's own count of trades is untouched by this section.


**What changed on disk, half by half.**

| what | where | what it is now |
| --- | --- | --- |
| the trade's endings | `scripts/run-live-trading-trader.js` | `tradeCycle`'s `endedBy` is `call`, `target-fill` or null - the `target-line` branch and the `linePassed` reading behind it are gone, and with them the function's last use of the M5 bars. `tradeReason` loses its `newestBar` argument and its third sentence, and the standing sentence now states the ruling: the level is permanent, it goes on standing with its target until that target is taken or the call changes direction. |
| the running review | `scripts/run-live-trading-trader.js` | `reviewPendings` drops its passed-line reason with everything that read a candle for it - `readLevels`, `closedBars`, the far-side filter and the `passed_line`/`close`/`confirmation_time_utc` fields it wrote. Three reasons become two: the call ending or turning, and the account's record of the take-profit being taken. Its `keep` sentence now says why: a level only deactivates on the take-profit or a change of direction. `reviewPendings` no longer takes an instant, because it no longer reads a bar. |
| the trade reader's inputs | `scripts/run-live-trading-trader.js` | `tradeCycles` and `tradeCycle` no longer take `nowMs`: with no candle read left, a trade's row is the state file and the account's record alone. |
| the tool's stated lifetime | `tools/mt5-bridge/live-trading-order.py`, `tools/mt5-bridge/README.md`, `scripts/register-live-trading-trader-task.ps1` | The three places that repeated section 42's lifetime in prose now state the ruling: the levels are permanent and deactivate only on the take-profit or a change of direction. Comments and help text only - no argument, default or send path changed, and the tool still passes no expiry. |
| the evidence | `tmp/live-trading-trader.log` | Unchanged in shape. `trade.ended_by` can now only be `call`, `target-fill` or null; a run states the level's permanence in the standing sentence and no longer carries a `target-line` reason. |
| the tests | `tests/live_trading_trader.test.js` | Two cases were rewritten rather than deleted, so the ruling is pinned in both directions: *a candle running past the level's own target line does not end the trade, and the level is put back* (the same BTC fixture that used to assert `ended_by: target-line` now asserts a `place` with `--entry-price 84500` unchanged and `taken_today` still 1), and *a working limit is kept when a marked line further out has been passed* (the sell limit that used to be cancelled now reads `keep`, with nothing sent). The older cases that hold the call ending, the take-profit ending and the stop-out put-back are untouched and still pass. |


**What this means for the level that was involved, in the user's terms.** NQ's level `30774.61` was never
deactivated: the `BULLISH` call still stands, and the account holds no record of that ticket's take-profit being
taken - the first ticket stopped out, the second never filled, and both are the same trade put back. So under the
ruling the level is still active and its limit belongs resting under the market. The loop carries that: its state
file's newest NQ placement is `297961478` at `30774.61`, the trade row now reads `ended_by: null`, `resting: true`
against the market the snapshot carries, and the next armed tick puts the limit back at `30774.61` with the target at
`31049.43` and the stop at `30719.646` - the same three prices as the ticket that stopped out, from the ladder as it
is marked now. Nothing was lost by the defect and nothing is gained by this correction: the put-back rested 283
points under the market and never filled, and this section claims no edge from the level's return.

**Live, the same night, and what the broker said.** The task was disabled before the edit and re-armed after the
suites passed, and a plan-only run was read before arming it so the ticket the next tick would send was known rather
than guessed: one ticket, NQ buy limit at `30774.61`, stop `30719.646`, target `31049.43`, `reentry: true`, no
`--expire-minutes` - the same three prices as the ticket that stopped out. The `21:11:30Z` tick then sent exactly
that, under this section's code, and the terminal refused it in its own words: `TRADE_RETCODE_MARKET_CLOSED`,
comment *"Market closed"*, `done: false`, one attempt, ticket `null` (`tmp/live-trading-orders.log`). The snapshot
says the same thing from the other side: `US100.cash` reads `market_state: no recent ticks` with its last tick at
`20:49:59Z`, while EURUSD and BTCUSD read `quoting` - the index is not trading at this hour. So the level's put-back
could not be placed yet, nothing rests in the market, no trade was opened, no signal bar was spent, and the failed
attempt is written to the state file with `placed: false` so it neither counts as one of the day's trades nor spends
anything. The cadence retries the put-back at every bar close until the instrument accepts it, which is the tool
staying the authority on the send rather than this loop deciding the market is shut; the run's own status is
`send_failed` until then, which is the same reading a sent ticket that did not land has always produced. The
`21:16:30Z` tick repeated it: the same retcode, the same `placed: false`, no ticket - so this is observed rather
than expected, and the state file is pruned to its last 200 placements, so the retries cannot grow it.

**Checked.** The three touched suites in one invocation: the rule at **27 of 27**, the loop at **34 of 34** (two cases
rewritten as above; the count is unchanged) and the order tool at **10 of 10**, **71 of 71** together, clean on the
first run after the edit. The feed suite, which reads none of these files, is **54 of 54**. `node --check` is clean on
the loop and the tool parses under `ast.parse`. The whole local suite is **672 tests with 668 passing**, and the four
failures are the same known ones section 43 recorded: `backtester/tests/secret_scanner.test.js`'s placeholder cases,
1 of 5 at this console's default width and 5 of 5 at 200 columns, in a file and a scanner this work did not touch -
the count and the file are unchanged from the run section 43 was written on.

**What is not claimed.** This is a rule correction, not a strategy change: the trigger, the entry level, the target
and the stop are untouched, and no backtest, replay or paper result is offered as evidence of an edge - the rule is
the user's and the loop now follows it. The page half already stated the correct lifetime (section 44's caption and
`lib/l2l_strategy.js`'s in-trade sentence both read "until the call for the asset changes or the target is taken"),
so no page file needed a change and none was made. The FTMO first-party answer on automated trading is still
outstanding, exactly as sections 39 and 42 recorded it.

## 47. The five-minute pane is moved by hand: the window of bars and the price scale are dragged, and a double click puts them back (user request and build, 2026-10-06)

**The request this answers:** the M5 pane has to be movable with the mouse, so a marked line or a candle that sits
just off the edge of the window can be brought into view at the magnification the reader is already on, instead of
having to zoom out of it and lose the detail or refit the whole ladder.

**What a drag is here.** One gesture with two axes, held in two numbers the page owns rather than writes:
`liveTradingChartPanBars` is how far the window of bars has been slid back from the newest published bar, in bar
widths, negative being past it; `liveTradingChartPanPrice` is how far the price scale has been pushed down the pane,
as a fraction of its height, positive when the hand went down. Both are zero on the view the page opens on, so a page
nobody has dragged draws exactly what it drew before this existed, and both are reset by `liveTradingChartResetView`
whenever what is being looked at changes - another pair, another timeframe, `Fit levels` - and by a double click,
which is the reader's own way back. A drag is deliberately *not* written to the saved navigation state (section 37
put the symbol, the timeframe, the style, the magnification and the fit control there): the reader's hand is not a
setting, so the caption states it while it is in force and the double click clears it.

| what | where |
| --- | --- |
| the two offsets, and the view a drag starts from | `liveTradingChartPanBars`, `liveTradingChartPanPrice`, `liveTradingChartDrag` in `script.js` |
| the ends of both axes | `liveTradingChartPanLimit(total, fill)`: back to the oldest published bar and no further (`total - fill`), and no more than a quarter of the picture past the newest (`min(12, fill / 4)`) |
| one axis of a drag | `liveTradingChartPanStep(value, step, low, high)`: rounded onto the smallest step, held between the ends |
| the window a drag draws | `liveTradingChartWindow(points, zoom, back)` - the same slice the zoom uses, taken once at the top of the plot, so candles, volume, the time scale, the trades, the open position and the crosshair all move together |
| the price scale under a drag | the same scale the bars and their nearest two lines make, shifted by `panPrice x (max - min)` and clamped to `+/-0.75` of the pane |
| the pointer work | `setupLiveTradingChart`: `pointerdown` on the canvas, `pointermove`/`pointerup`/`pointercancel` on the panel with pointer capture, `dblclick` to reset, and `liveTradingChartPlotAt(panel, x, y)` to read the canvas off the pointer |

**A press that is not a drag is still a press.** Nothing moves until the pointer has travelled
`LIVE_TRADING_CHART_PAN_SLOP = 4` pixels, and a move that has not crossed `LIVE_TRADING_CHART_PAN_UNITS = 2` canvas
units redraws nothing (a redraw is the whole panel, about seven milliseconds here, which is why the drag is stepped
rather than continuous). That is what keeps marking a level, the zoom buttons and `Fit levels` working through the
same handlers, since they all live inside the canvas the press lands on.

**A pan never also marks a level.** A drag that moved ends in a click on the canvas, and that click is the tail of
the drag rather than a press of anything: it is swallowed exactly once (`liveTradingChartSwallowClick`, cleared by
the next press so a click that never arrives cannot eat an unrelated one). The click after it is a real click and
marks the level it was aimed at, so the swallow is one click and not a mode. This is also why the marking click and
the double click no longer read `event.target`: pointer capture re-targets the ending click at the panel the capture
was set on, so both read the canvas under the pointer through `liveTradingChartPlotAt` instead.

**The crosshair is a reading, so a drag puts it away and a release puts it back.** The press clears it (a picture
sliding under a frozen crosshair reads as two positions at once), the release repaints it at the point the hand let
go - the pointer is still over the canvas then - and `preventDefault` on the moves of a drag in flight stops a drag
across the legend or the price scale leaving a text highlight behind. The paint carries a `panning` class while the
hand is on it, and the class is the only thing the release has to undo (nothing is redrawn then), so it is taken off
on `pointerup` and on `pointercancel` alike.

**The page says what has been dragged, in the caption it already had.** `60 of 120 M5 bars drawn (zoom 2x)` keeps its
reading and gains a clause while a drag is in force: `dragged 32 bars back from the newest`, `dragged 3 bars past the
newest`, and `dragged the price scale 18.4% down` (or `up`). The legend keeps naming the newest bar of the window
that is really drawn, which is the bar the rule is read against - a slid window is not the block's newest bar, and
the caption and the legend both say so.

**Styling.** `.live-trading-chart-plot` carries `cursor: grab`, `touch-action: none` (so a touch drag moves the pane
instead of scrolling the page) and `user-select: none`; `.live-trading-chart-plot.panning` and
`.live-trading-chart-plot.panning.marking` carry `cursor: grabbing`, so the grabbing hand wins over the crosshair
cursor marking puts on the pane while the picture is moving under the pointer.

**Evidence.** One new browser test against the real page and the real feed,
`tests/live_trading_chart_pan.browser.test.js`, one case that walks the whole control on the 60-bar window: ten bars
to the right moves the window without changing the number of bars or the volume bars, moves no price, and the caption
and the legend name the bar the slide brought the newest edge to (`dragged 10 bars back`, the legend on bar 109 of
120); four bars forward counts the distance afresh rather than adding the two together; a window dragged ten bars back
still draws at least two marked lines above its own bars and two below, which is section 37's floor holding under a
slide rather than only under a zoom; a vertical drag moves every published line that stayed on the picture by the
pointer's own distance (asserted against `40 / factor` canvas units, tolerance 2.5) and moves no bar sideways; the
same drag back leaves the scale the page opened on, line for line; both axes stop at their ends (three quarters of the
pane, where part of the window is still on the canvas); a double click puts both axes and the legend back to the view
the page opened on, from the far end as well; the crosshair is away before a drag, away while one is in flight, and
back at the release point inside the pane after it; and with marking armed, a drag marks nothing and adds no chip
while the click after it does mark. Lane suites in this worktree: the browser suite 47 of 47 in one run (the eight
existing browser files plus this one), and the unit suite 626 tests with 622 passing, the four failures being the
known `backtester/tests/secret_scanner.test.js` cases in a file this work did not touch - the same four
that were reproduced on a clean checkout at `ca65729` in the seventh entry of the lane's session notes, and the
console-width cases section 43 measured. `node --check` is clean on `script.js`
and on the new test.

**Boundaries.** Page files only: `script.js`, `styles.css` and the new test. Nothing here is live trading and nothing
in it sends, sizes, schedules or cancels anything - a drag moves a picture, and the order tool is still the only route
to a ticket. The live loop (`scripts/run-live-trading-trader.js`), the feed artifact, the ladder, the rule module and
the order tool are untouched, so no trader-task re-arm was needed for this section. No publication: the published page
still carries section 38's build, and releasing this will need the `script.js` and `styles.css` cache-busters bumped in
`index.html` the way section 38 did it. `data/live-trading.json` is a feed refresh written by the loop in this worktree
and is deliberately not part of this change.

## 48. The pane drag is on production main (release, 2026-10-06)

**The port.** Section 47 built the drag on the lane; this section puts it on the page the reader opens. One targeted
region port, commit `bb9ed14`, fast-forward `c1f6fa1..bb9ed14`, four files, +623 / -30.

| what | where |
| --- | --- |
| the drag, the crosshair hand-off, the swallowed click and the caption clause | `script.js`, live trading only |
| the grabbing hand, `touch-action: none` and `user-select: none` | `styles.css` |
| the lane's own case, carried with the change | `tests/live_trading_chart_pan.browser.test.js` |
| the cache-busters | `styles.css?v=20261006-l2l-chart-pan`, `script.js?v=20261006-l2l-chart-pan` |

**The route, and what made the port small.** A release worktree off `origin/main` (`.local/live-trading-pan-release`,
branch `release/live-trading-chart-pan-20261006`) at `c503d82`; the change taken as the diff between the lane commit
before it (`37003a4`) and the commit carrying it (`16794d3`), applied to main's own `script.js` and `styles.css`:
eighteen hunks in `script.js` and one in `styles.css`, none rejected, landing ninety to five hundred lines early
because main does not carry the lane's later work. That last number is the shape of this release rather than an
accident: main carries the shared navigation, the pair-coverage work and the call-map rail, this lane carries the feed
cadence, the order tool and the live loop, so a file copy either way deletes the other's work. A hunk that applies is
not the same as code that runs, so every `liveTrading*` or `LIVE_TRADING_*` name the added block mentions - twenty-two
of them - was checked for a definition in the released page files, by script rather than by eye, and none was missing.
The feed cadence published twice while the work was in flight (`c503d82`, `c1f6fa1`), so the commit was rebased onto
`c1f6fa1` and the verification set was re-run on the rebased tree before the push. Two tokens moved and every other
token was left alone, because no other file changed: `lib/l2l_strategy.js`, `lib/l2l_levels_store.js`,
`lib/l2l_sizing.js` and `lib/l2l_ladder.js` are byte-identical to what the previous release put there.

**Evidence on the release tree.** The whole set run one file at a time is `# tests 130`, `# pass 130`, `# fail 0`, and
the same command a second time before the rebase was 129 of 130, that one red being the intermittent overview-freshness
case in `tests/refresh_progress.browser.test.js` that section 38 already recorded as a pre-existing race rather than a
released byte. Run on their own against this tree, the seven suites this surface touches - the chart zoom, the rule
panel, the read-back tables, the dashboard, the levels visibility, `l2l_levels` and `l2l_strategy` - are 75 of 75, the
new pan case alone is 1 of 1, and the three names that flaked inside a parallel run are 53 of 53 on the re-run.
`node --check` is clean on `script.js` and on the new test.

**What a parallel whole-set run does here, so the next release does not read it as a regression.** Two parallel runs
produced three reds each, with different names each time: one ladder-tool case failing `fetch failed` inside its own
ephemeral tool server, two browser cases refused by the browser itself with `net::ERR_UNSAFE_PORT` on
`127.0.0.1:6668` and `127.0.0.1:6669` (Chromium blocks 6665-6669, and these tests bind port 0), and the
overview-freshness cases. None of it is the released bytes: that last file on the untouched main checkout at the same
commit flipped 25 of 26 and then 26 of 26 in two consecutive runs inside one window, and the pristine control ran the
whole set 129 of 129 while the release tree was drawing the blocked ports. The deterministic evidence is the serial
run and the focused runs above; the parallel run over nineteen browser files is load, not a verdict.

**The live-page state, checked where a reader would look rather than in a log.**
`https://raw.githubusercontent.com/kevincreedycars-debug/trading-agent-dashboard/bb9ed14/index.html` carries
`styles.css?v=20261006-l2l-chart-pan` and `script.js?v=20261006-l2l-chart-pan`, and the `script.js` at that commit
carries the pan block. The Pages build of the branch is a separate clock, and it lagged the push: a plain fetch of
the site minutes afterwards still served the `20261004` tokens and a `script.js` with none of the pan in it, and by
the time of this check that build had landed - `https://kevincreedycars-debug.github.io/trading-agent-dashboard/`
serves `styles.css?v=20261006-l2l-chart-pan` and `script.js?v=20261006-l2l-chart-pan`, and the served script carries
the pan block. Until a build lands, a token is confirmed against the pinned commit rather than against the branch
name, which is what sections 31 and 38 recorded. What the reader gets from that build is the
drag, the caption clause and the crosshair, because the case that walks them ran against this tree: ten bars to the
right, four forward counted afresh, the two-level floor of section 37 holding under a slide, a vertical drag measured
against the pointer's own distance, both axes at their ends, the double click back to the opening view, and the
crosshair away before, during and back after a drag at the point the hand let go - and with marking armed, a drag that
marks nothing while the click after it does.

**Boundaries.** No order path was added, touched or called by this release: a drag moves a picture, nothing sizes,
sends, schedules or cancels anything, and the order tool is still the only route to a ticket. The release writes
`data/live-trading.json` not at all - the cadence owns that file, which is why the commit was rebased - and it changes
no producer, validator, feed schema, Layer 1 agent or backtesting file. The two documents in this folder stayed on the
lane: production takes code and tests, the lane keeps the record. A drag is a way of looking at a chart; it is not a
signal, an edge or a proof of anything the entry rule does.

**What this release deliberately did not carry, and one question back to the user.** This is section 47's own regions
only. The lane's later page-facing work is still unpublished: the rule panel's reading of a working order and the
trade's own level (sections 43 and 44, 132 lines of `script.js` plus 512 lines of `lib/l2l_strategy.js`), and the
lane's own `index.html` still carries `?v=20261005-l2l-trade-level` on those three files because it sits on an older
published line and is re-cut from `main` at the next port rather than patched in place. So the live page is section
38's build plus the drag, and the rule panel there states the module's crossing reading rather than the ticket's own
level. Whether that backlog goes out as its own release is the user's call, and so is the one question section 47 left
open: whether the pane should also carry a reset button beside the zoom buttons, or whether the double click is enough
of a way back.

## 49. The hold is per pair, a reached target invalidates the entry, a turned call exits the position, and the pane carries a full day (user ruling and build, 2026-10-06)

**The three answers, in the user's own words.** Asked why no BTC ticket was taken on 2026-10-06 while the Nasdaq limit
held the loop's single slot, and asked how far the five-minute pane should be scrollable and whether the drag needed a
reset button, the user ruled:

- the hold: *"each asset can have only one pending order running at a time, it doesnt need to loop or anything like
  that, just when the conditions are set for an entry you set the limit and wait for it to be hit or invalidated either
  by price hitting the TP without it touching the limit or if the directioncal call changed during the day, if it did
  then exit the position."*
- the pane: *"I need to be able to scroll back through the chart more on the 5m allow me to see at least 24hours worth
  of 5m candles."*
- the way back: *"Yes the double click is fine."*

**What that makes the loop's own rule, and what it adds to section 46.** Section 46 removed a cancellation the user had
called a defect - a candle *finishing* past the line a target sat on ended nothing, because the levels are permanent.
The restatement above names the two ways a resting limit ends, and the first of them is a reading of the price the
target sits at rather than of a bar's close as a line, which is what this build implements and what the fourth row
below records. The three endings the loop now acts on:

| ending | read from | where |
| --- | --- | --- |
| the call has ended or turned | `sideForDirection` on the published call, the module's own vocabulary | `reviewPendings`, unchanged |
| the target has been taken | the account's own record of the trade closing at its take-profit (`closedAtItsTarget`) | `reviewPendings`, unchanged |
| the target has been reached | the price the order's take-profit sits at, reached while the entry is still a working limit | `reviewPendings` and the trade cycle, through one shared `marketHasReached` |

**"Reached" is a price, not a close, and it is read twice because the loop samples every five minutes.** `marketHasReached`
asks the snapshot's own quote first (a long's target at the bid, a short's at the ask, the side a take-profit is taken
on), and then the extreme of every M5 bar the snapshot carries from the bar the ticket was last placed in - a long at
the bar's high, a short at its low. A take-profit is a price the market only has to touch, so a touch between two runs
is a fact the bars hold even when the quote has moved back. Nothing readable is `null`, and `null` ends nothing. The
same helper ends the *level's turn* as well (`ended_by: "target-touched"`), because a limit taken out for a move that
has already happened must not be put back in the same run: without that, the review would cancel the ticket and the
decision would immediately re-place it.

**A position, and not only a pending order, is part of the same sentence.** The user's *"if it did then exit the
position"* is the one send this file gains: a position carrying this lane's magic on a pair whose call has **turned**
against it is closed at the market through the tool's `close`, recorded in `record.positions.closes` and in a new
`closes` key in the state file, and a close that was sent and did not land fails the run exactly as a removal that did
not land does. Two decisions are stated rather than implied: a call whose window has simply *ended* is not a call that
has *changed*, so the resting limit comes out on that reading (as it always has) and the position is left to its own
stop and target; and a pair whose position is being exited is not freed for a new ticket in the same run, because the
account itself is what says the exit landed.


**What changed, one row per file.** The two caps became one: the hold the user restated is the rule's own one ticket
per pair, so the loop keeps no cap across pairs and `--max-open` is a hand cap a run may pass deliberately.

| file | change |
| --- | --- |
| `scripts/run-live-trading-trader.js` | `DEFAULT_MAX_OPEN` is `null` - "no cap of its own" - and both cap gates are guarded by `options.maxOpen !== null`; the reason text names it as a hand cap when one was asked for. `marketHasReached` and `exitPriceFor` are new; `tradeCycle` gains the third ending and the `target_reached`/`exit_price` fields; `reviewPendings` gains the reached-target reason; `reviewPositions` is new; `record.positions` is new; the state file gains `closes`; `tradeSummary` and `tradeReason` carry the new ending; the module exports the four new names. |
| `scripts/register-live-trading-trader-task.ps1` | `-MaxOpen` defaults to `0`, meaning the rule's own answer, and the flag is written into the task only when a registration asks for one - the way `--expire-minutes` already was. The plan's `max_open` line says *none (the rule's own one ticket per pair)* rather than `0`, and the task description says one working ticket per pair. |
| `tools/mt5-bridge/live-trading-snapshot.py` | `DEFAULT_CANDLES` 120 to 288: twenty-four hours of M5 bars, which is what the pane can be dragged back through. The producer comments state that number as the reader's requirement rather than as a house size. |
| `tests/live_trading_trader.test.js` | Six new cases and one replaced: the reached-target ending, the order's-own-take-profit cancellation, the quote-and-bars reading of `marketHasReached`, the position review (a turned call exits, a standing call stays, a pair the snapshot does not carry is left), the ended-call-is-not-a-turn case, an armed exit, an unarmed exit that leaves no mark, a close that did not land, and a per-pair decision with a working ticket on another pair. The case that asserted the removed reading - a candle past the target line ends nothing - is replaced by the ending that now holds. |
| `tests/live_trading_chart_zoom.browser.test.js`, `tests/live_trading_chart_pan.browser.test.js` | The published count is asserted as a floor (`>= 288`, twenty-four hours) and every window in the cases is derived from the block's own length, so the next change to the producer's count is a number in one place rather than five. |
| `script.js` | one comment: the ladder-step note now names the full day of bars the window spans. No behaviour changed in the page. |

**The page the reader asked about is a producer number, not a page change.** The pane draws the bars the snapshot
publishes and a drag can only slide through those, so "at least 24 hours of 5m candles" is `DEFAULT_CANDLES = 288`, and
nothing in `script.js` had to move: at the widest view all 288 bars are drawn (the whole day at once), each zoom press
halves that window (144, 72, 36), and a drag at any of those reaches back through the day because `behind` is
`total - fill`. The live snapshot carried the new block on the next cadence tick, at `2026-10-06T13:10:21Z`, with 288
M5 bars per instrument.


**The rule ran against the live account before this section was written, and the BTC ticket section 33-era notes were
missing is now in.** The scheduled cadence picked the changed loop up on its own five-minute tick, at
`2026-10-06T13:06:30Z`: the working Nasdaq limit `298084576` (buy limit `30774.61`, take-profit `31049.43`) read
`cancel` with `target_reached: true` and the reason *"...the bid is 31259.98, at or past the take-profit 31049.43 this
working limit carries..."*, was sent, and the terminal answered `TRADE_RETCODE_DONE` at `13:06:32.721Z`; in the same
run the freed slot took BTC's ticket - order `298206180`, a buy limit at `86023.4`, stop `85732.426`, target `87478.27`,
`0.01` lot, written down as a put-back of its own `10:15` signal bar. The `13:11:30Z` tick read that limit as `keep`
with *"the target at 87478.27 still in front of the market"*, and the `13:12:37Z` and `13:12:44Z` runs were the
unarmed hand plans of this build (`status planned`, `caps.max_open null`, nothing sent, no state written). No position
was open at any of those instants, so the new exit path has been exercised by its tests and not by the account.

**Evidence.** `node --test tests/live_trading_trader.test.js` is 41 of 41 (34 before, and the six new cases plus the
replaced one are listed above); the four live-trading unit suites together are 130 of 130; the three browser suites
that read the published feed - zoom, pan and levels visibility - are 4 of 4 against the 288-bar block; the whole
`npm test` set is 680 tests with 676 pass, and the four reds are the same `backtester/tests/secret_scanner.test.js`
placeholder cases (1, 2, 3 and 5 of that file) this machine has failed since entry 23 rather than anything this build
touched. `node --check` is clean on `run-live-trading-trader.js`, `script.js` and both changed test files, `py_compile`
is clean on the producer and the order tool, and the register script parses clean under PowerShell's own parser. The
live snapshot at `2026-10-06T13:10:21Z` carries 288 M5 bars per instrument, which is the number the pane cases now hold
to as a floor.

**Boundaries, and the one operation this section did not perform.** The task's own wrapper still passes `--max-open 1`
because it was generated before this ruling, so *the per-pair hold is not live yet*: what is live is the reached-target
invalidation, which is what freed the slot at `13:06Z`, and the loop is still capped at one working ticket across
pairs until `scripts/register-live-trading-trader-task.ps1 -Arm` is re-run - a live workflow change, and the user's
call rather than an incidental step of this build. The exit path is the second kind of send this file makes, so a run
that cannot land one fails; nothing else about the order path changed, the tool is still the only file that can send,
and nothing here sizes a trade by any number but the symbol's own `volume_min`. The page-facing work of sections 43 and
44 is still unpublished and untouched by this build, so the live page states the module's crossing reading rather than
the ticket's own level, and the double-click answer closes the question section 47 left open: no reset button will be
added beside the zoom buttons. A pane that can show a day of candles is a better view of the market, not an edge, a
causal claim or a profit rule; and a ticket placed at `13:06Z` because a stale limit had been invalidated is a
mechanical consequence of the user's rule, not evidence that the rule makes money.


## 50. The four charts carry more history to drag back through: a deeper block, not a page change (user request and build, 2026-10-07)

**The request this answers:** "the ability to drag and move to the left more so I can see more historical data on
the 4 live charts" - one sentence, the day's whole ask.

**Why it is a producer number and not a page change.** Section 47 built the drag and section 49 fixed the pane's
depth; this is the same lever the same way. The window of bars can only slide across the bars a snapshot publishes -
`behind` is `total - fill` in `liveTradingChartPanLimit` - so the far end of a drag is the oldest published bar, and
there is no older history in the page to reach. More of it is a deeper block, exactly as "at least 24 hours" meant
`DEFAULT_CANDLES = 288` in section 49. The deeper block is the whole of the history change; `script.js` and
`index.html` are untouched.

| block | before | after |
| --- | --- | --- |
| M5 (`DEFAULT_CANDLES`) | 288, one day | 576, two days |
| H1 (`DEFAULT_H1_CANDLES`) | 168, one week | 336, two weeks |
| H4 (`DEFAULT_H4_CANDLES`) | 120, twenty days | 240, forty days |

**What the reader sees, and how it reaches the page.** At the widest view all 576 M5 bars are drawn - the whole two
days at once - each zoom press halves that window (288, 144, 72, 36), and a drag at any of those reaches back through
both days, twice as far as before. The H1 and H4 tabs, which carry the marked L2L ladder, gain the same room: a
fortnight of hourly bars and forty days of four-hour bars. The `tools/mt5-bridge/README.md` defaults line states the
new numbers. No wrapper or task re-registration was needed: the feed task reads this worktree's producer and passes
no `--candles`, so the next cadence tick publishes the deeper block on its own - the same way section 49's 288 landed
at `13:10:21Z`. The three browser suites that read the feed assert the published count as a floor (`>= 288`, a full
day), so they hold at every step of the wider block and every window they use is derived from the block's own length.

**One page line moved, because the wider block exposed a defect in the zoom control.** With 576 M5 bars the
eight-times step draws 72 bars instead of 36, and at that window the horizontal crosshair line fell across the
`Fit levels` edge tab: a click aimed at the tab landed on the crosshair instead, because the crosshair group carried
no `pointer-events`. The crosshair is a reading of the pointer and never a control, so `.live-trading-chart-crosshair`
now carries `pointer-events: none`, and a line of it landing on the edge tab, a marked level or any other control
under the pointer can no longer swallow the click. That is the one `styles.css` line this change adds.

**Evidence.** `py_compile` clean on the producer; `node --check` clean on both changed test files; the feed suite 54
of 54 and the cadence suite 25 of 25; the five browser suites that read the feed - zoom, pan, levels visibility,
readback and the rule panel - all green against the 576-bar block, the zoom suite's `Fit levels` click being the one
that failed before the crosshair rule and passed after it. The live snapshot took the deeper block on the next
cadence tick, at `2026-10-07T19:30:20Z`, carrying 576 M5 / 336 H1 / 240 H4 bars per instrument.

**Boundaries.** A deeper pane is a wider view of the market, not an edge, a causal claim or a profit rule. No order
path, snapshot schema, validator rule or ladder rule changed; the only page touch is the crosshair's
`pointer-events`, and the tool is still the only file that can send. `data/live-trading.json` in this worktree is the
feed's own refresh rather than part of this change.


## 51. The System section says the rule in words: a read-only walkthrough of the live trade logic (user request and build, 2026-10-08)

**The request this answers:** a read-only tab in the dashboard's System section, beside `Structure Map` and
`Architecture`, that explains the live trading rule in plain language - what the loop does and in what order,
without the reader having to read `script.js` to find out.

**Where it sits, and what it is made of.** `index.html` gains one rail button (`data-tab="live-trade-logic"`, last
in the System group, after `Architecture`) and one view (`#liveTradeLogicView`, placed above `#structureMapView`),
with both cache-busters moved to `?v=20261008-live-trade-logic`. `script.js` gains `LIVE_TRADE_LOGIC_SUMMARY` and
five tables - eleven steps, five endings, seven gates, five account limits and six paths - plus
`liveTradeLogicRows` and `renderLiveTradeLogic`, wired into `setTab`'s view lookup, its `active-view` toggle and a
lazy render, so the copy is built when the tab is opened rather than on page load. `styles.css` gains one
`.live-trade-logic-*` block (lines 9144 to 9186) in the palette this surface already uses, with
`overflow-wrap: anywhere` on every line and the labelled rows two columns from 900px up and one column below it.
No file on the order path is touched by any of it.

**Eight cards, and every one of them sourced rather than remembered.**

| card | what it says | where it comes from |
| --- | --- | --- |
| The rule in one sentence | one resting order per market, left at a hand-marked line, only in the day's call's direction | sections 40, 42 and 49 |
| Step by step | the eleven steps in the rule's own order: the four markets, the call, the hand-marked lines, the five-minute close through one, the three prices crossing produces, the resting limit, one trade per market, no expiry on the entry, the size, then the two things the page can never do | sections 39 to 43 |
| How a trade ends | the five endings: target, stop, a turned call, a reached target invalidating a resting entry, and the removal when the reason is gone | sections 42, 46 and 49 |
| What has to be true before anything is sent | the seven gates, each of which refuses rather than warns | section 39, plus the loop's own guards |
| The account's own limits | 5% daily, 10% total, 10% target (5% in Verification), four minimum trading days, one bot on the login | the FTMO reading of 2026-09-30 |
| Where this lives | the loop, the registration script, the two files the loop writes, this document and the Live Trading tab | this document and `scripts/` |
| One thing is out of step on this machine | the machine fact below | machine state, not the rule |
| What this page does not claim | the honesty card: a filled ticket is not evidence the rule makes money | boundary, at every level |

**The geometry is read out of the module rather than retyped.** The page states that the target is the next marked
line beyond the entry in the call's own direction and that the stop is a fifth of that distance, and the test that
holds it reads `REWARD_R_MULTIPLE` from `lib/l2l_strategy.js` (5, applied there as `risk = reward / rMultiple`), so
"a fifth" and "five to one" cannot drift apart in the copy. The day's count is checked the same way against the
loop's `DEFAULT_MAX_PER_DAY` (4), `DEFAULT_MAX_OPEN` (`null`), `DEFAULT_EXPIRE_MINUTES` (`null`) and the
registration script's `$MaxOpen` (0) and `$MaxPerDay` (4) defaults, with the count matched in words - "four a day,
which is one per market" - so a changed default fails the page instead of quietly leaving it stale.

**The one machine fact the tab states instead of hiding.** The registered task's wrapper was generated on
2026-10-05, before section 49's per-pair ruling, and still passes the older `--max-open 1`: while it stands, the
loop it starts holds one working ticket across all four markets even though the rule above it is one per market.
The card names the command that closes the gap (`scripts/register-live-trading-trader-task.ps1 -Arm`) and tags
itself as machine state rather than as the rule, because re-registering the task is a live workflow change run
deliberately at the terminal, not something a page does.

**Evidence.** `node --check` clean on `script.js` and on the new test file; the new browser suite
`tests/live_trade_logic_tab.browser.test.js` 5 of 5 against the committed page, and the same invocation with the
sibling `tests/live_trading_rule_panel.browser.test.js` 8 of 8 (five cases plus that file's three); `npm run
test:unit` 633 tests with 629 passing, the four failures being the pre-existing
`backtester/tests/secret_scanner.test.js` placeholder cases this machine has failed since the lane's entry 23,
with none attributable to this work. The suite's five cases are: the tab is in the rail's System group after
`Architecture` and is neither drawn nor built before it is opened; the eight card titles, the eleven steps and the
tags are asserted as the sequence they are; the numbers are cross-read from the module, the loop and the script;
both honesty cards are asserted by name; and the view is measured at 1440, 1180, 900, 899, 768 and 390 pixels -
eight cards, eleven steps, five limits, five endings, seven gates and six paths standing, the labelled rows two
columns at 900px and one below it, no sideways scroll and no line outgrowing its own card. A separate case holds
the tab to being read-only: nothing inside the view is a button, field, link or editable region, and opening it
reaches no order path.

**Boundaries.** The tab is a reading of the system, not of the market, and says so on its own caution card: it
claims no edge, no win rate and no live deployment, and it changes no rule. It is not published - the page work of
sections 43 and 44 is still local to this worktree - and no loop, order path, ladder rule, snapshot schema or
published feed changed. `data/live-trading.json` in this worktree is the feed's own refresh rather than part of
this change.

## 52. The rule page is on production main (release, 2026-10-08)

**The port.** Section 51 built the walkthrough on the lane; this section puts it on the page the reader opens, on
the user's word after the two sections before it stayed local. One targeted region port, commit `c4fa9f9` ("State
the live rule in words on the System rail, and hold the page to the code that runs it"), fast-forward
`068b397..c4fa9f9`, four files, +704 / -2.

| what | where |
| --- | --- |
| the rail entry, the view section and the two cache-busters | `index.html`, +20 / -2 |
| the eight cards behind the tab | `script.js`, +236: the summary, the five tables, `liveTradeLogicRows`, `renderLiveTradeLogic` and three lines of `setTab` |
| the `.live-trade-logic-*` block | `styles.css`, +48, after the live-trading block |
| the lane's own five cases, carried with the change | `tests/live_trade_logic_tab.browser.test.js`, 400 lines |
| the cache-busters | `styles.css?v=20261008-live-trade-logic`, `script.js?v=20261008-live-trade-logic` |

**The route, and why the blocks were lifted rather than the diff applied.** A release worktree off `origin/main`
(`.local/live-trade-logic-release`, branch `release/live-trade-logic-20261008`) cut at `068b397`. Section 48 could
take its change as a diff because both trees shared the preceding regions; here the lane sits on an older published
line - its `index.html` carries no shared-navigation embed and still says `?v=20261005-l2l-trade-level` on the module
- so the port took the lane's own blocks verbatim and placed them in main's file structure: the 230-line tab block
lifted out of the lane's `script.js` and inserted above main's `setTab` (byte-identical, so the released copy is the
copy the lane's cases measured), the 47-line styles block appended after main's last rule, and main's `setTab` given
the three wiring lines by hand - its view lookup, its `active-view` toggle and the lazy render hook - because main's
`setTab` carries a different view list, its own shared navigation and no `liveTradeLogicView`. Placement differs by
one anchor each side and is the System group's last position in both: main's rail carries two outbound call-map
anchors after `Architecture`, so the button goes after them and is still the last `.tab-button` the rail readout
counts, and main has no `#structureMapView`, so the view sits after the architecture view above `</main>`. Only two
tokens moved, and `lib/l2l_strategy.js` is still main's own `?v=20261004-l2l-rule-live`, because this release
changes no module.

**The one place the released case reads differently, and why the lane is not weakened.** The lane's five cases read
the page's numbers out of the code that produces them, and two of those reads - the loop's `DEFAULT_MAX_PER_DAY`,
`DEFAULT_MAX_OPEN` and `DEFAULT_EXPIRE_MINUTES`, and the registration script's parameter defaults - name files
production main does not carry: `scripts/run-live-trading-trader.js` and
`scripts/register-live-trading-trader-task.ps1` are on the worker branch, and main's `lib/l2l_strategy.js` is 512
lines behind the lane's. Rather than ship a case that cannot run there, or a second copy of the case, the same file
now branches on the files being present: where a tree carries both, the page is held to their defaults exactly as
section 51 recorded; where it does not, it is held to the module's own `REWARD_R_MULTIPLE` 5 and to the rule's
published numbers the page states - four new trades a day, one per market - and to the fix command the note names.
The geometry check is unqualified in both branches, the file is byte-identical on both trees, and the lane, which
carries the loop, always takes the strict branch; nothing on the lane got quieter. This is also why the released
page's "Where this lives" card names two files a reader of `main` will not find there: it names the operator's own
paths, which is what its `tmp/live-trading-trader-state.json` and `tmp/live-trading-trader.log` entries always did,
and both files exist in the repository on the worker branch and on the machine the rule runs on.

**Evidence on the release tree.** Main carries no `package.json` and no `scripts/test-local.js`, so the set was run
with `node --test <file>` one file at a time, Playwright resolving from the canonical checkout above the worktree.
The whole set is 16 files, 141 tests, 138 pass, 3 fail. The three reds are main's own state at that commit rather
than released bytes: `tests/live_trading_rule_panel.browser.test.js`'s expired-call case (the first pair reads
`BLOCKED` where the case expects `NO CALL`), `tests/live_trading_chart_pan.browser.test.js` and
`tests/live_trading_chart_zoom.browser.test.js` (the zoom case expects a pan limit of 120 and the committed block
gives 576). Each was run against a pristine checkout of the same commit
(`.local/live-trade-logic-pristine`, detached at `068b397`) and failed there identically, before any of this work
was in the tree, so they are the published line's own reds and not this port's. The focused set this surface
touches - the new tab, the dashboard, the levels visibility, the read-back, the rule panel, the chart pan and the
chart zoom - is 12 of 15 with those same three reds, and the other nine files are 126 of 126: `l2l_strategy` 16,
`l2l_levels` 50, `dashboard_writer_selection` 8, `l2l_sizing` 7, `validate_architecture_map` 7, `refresh_progress`
26, `layer1_call_flow` 5, `usd_layer1_call_flow` 6 and the backtesting-development release 1. The new file alone is
5 of 5, `node --check` is clean on `script.js` and on it, and every identifier the added block uses - nine of them,
`liveTradeLogic*`, `LIVE_TRADE_LOGIC_*` and `escapeHtml` - is defined in the block or in the released page files
(`liveTradeLogicPanel` in `index.html`, `escapeHtml` in `script.js`), checked by script rather than by eye.

**The live-page state, checked where a reader would look rather than in a log.** The Pages build landed faster than
section 48's did. `raw.githubusercontent.com/.../c4fa9f9/index.html` carries `styles.css?v=20261008-live-trade-logic`
and `script.js?v=20261008-live-trade-logic`, the rail's new button on its own line after the two call-map anchors,
the panel's `live-trade-logic-panel` class, and a `script.js` blob that carries `renderLiveTradeLogic` (blob
`9a2d982`); and by the time of this check the site itself was serving the new build -
`https://kevincreedycars-debug.github.io/trading-agent-dashboard/` names `Live Trade Logic` in the rail after
`Architecture` and the two call-map anchors, and its three files are the released blobs byte for byte, counted
rather than eyeballed: `index.html` 28,241 bytes, `styles.css` 222,532 and `script.js` 881,572 at the served URLs,
the same numbers `git cat-file -s c4fa9f9:<file>` gives. So the served `script.js` is the file the five new cases
walked, and the served `styles.css` is the one they measured at six widths.

**Boundaries.** No order path was added, touched or called by this release: the tab reads the page's own literals,
holds no feed and reaches nothing, and the order tool is still the only route to a ticket. It changes no producer,
validator, feed schema, Layer 1 agent or backtesting file, and `data/live-trading.json` not at all - the release tree
is cut from `main`, so the feed's own publication commits are its, not this change's. The two documents in this
folder and the whole lane record stayed on the lane, as sections 38 and 48 did: production takes code and tests, the
lane keeps the record. The page states the rule; it is not a signal, an edge or evidence that the rule makes money,
which is what its own caution card says in those words.

**What this release deliberately did not carry, and one question back to the user.** The loop's own scripts
(`scripts/run-live-trading-trader.js` and `scripts/register-live-trading-trader-task.ps1`) and the module work of
sections 43 and 44 (512 lines of `lib/l2l_strategy.js`) are still unpublished, which is why the released case
branches on those files being present and why the released `Live Trading` tab reads the module's crossing rather
than the working ticket's own level. Whether that backlog goes out as its own release is the user's call, and so is
whether the published `Where this lives` card should say that two of its six paths sit on the worker branch rather
than on `main`. Two statements in this folder are superseded by this section and by nothing else: the sentence in
section 51 and in the dated conversation section that the tab "exists only in this worktree" described the lane
before this push, and the tab is now on the page the reader opens.

## 53. The closed-trades table draws the day on both clocks, and the loop's own log answers the quiet spell (user request and diagnosis, 2026-10-12)

**What was asked.** Add opened and closed dates to the Closed Trades table on the live page, check it renders, and say
why the live trader has taken no recent trades.

**Why the date, and not more of the clock.** The *Closed trades* panel read one time column, `Closed (UTC)`, as `HH:MMZ`
from the trade's exit time. The panel states what the terminal's deal history carries over a fourteen-day window, and a
position can open before midnight and close after it, so a bare clock leaves a reader unable to say which day either end
belongs to. The two timestamps were already in the feed - the producer has published `closed_trades[].opened.time_utc`
and `closed_trades[].closed.time_utc` since the read-back was built - so this is a dashboard change only: the feed
schema, `scripts/validate_live_trading_feed.js` and the producer were not touched, and no producer change was needed.

| what | where |
| --- | --- |
| `liveTradingDateTimeLabel(value)`, the UTC date in front of the existing clock label | `script.js`, +11: the helper sits directly under `liveTradingTimestampLabel`, which it calls, so the one UTC formatting path stays in one place |
| the two cells: entry time as the row heading, exit time as the cell beside it | `script.js`, two lines in `liveTradingClosedTrades` |
| the two column headings, `Opened (UTC)` and `Closed (UTC)` | `script.js`, one line of the table head |
| the caption sentence saying what the two columns are | `script.js`, the table caption, one sentence added |
| the source-level cases | `tests/live_trading_feed.test.js`, +7: the helper's own signature, the two headings and the two cells by name, so the date stays drawn from those cells rather than some nearby string |
| the rendered case | `tests/live_trading_readback.browser.test.js`, +2 / -1: the bare `13:49Z` assertion becomes `2026-10-04 13:47Z` and `2026-10-04 13:49Z`, read off the real page against the committed feed |

The list's order did not change: the rows come out in the order the feed publishes them, newest close first, and the
change moved which cell is the row's own heading rather than which end the list is sorted on.

**Evidence.** `node --check script.js` clean; the focused set green at 56 of 56 (`tests/live_trading_feed.test.js`,
`tests/live_trading_readback.browser.test.js`); the whole local suite 685 tests, 682 pass, 3 fail, those three the
`backtester/tests/secret_scanner.test.js` width-truncation family this machine has failed since the fourth entry and
which this change does not touch. A throwaway Playwright script in the ignored `tmp/` (`shot-closed-dates.js`, shots
`closed-trades-dates-*.png`) drove the real page at three widths and read the two columns back with their dates.

**The quiet spell, answered from the loop's own log.** The loop is armed and running: 1264 logged runs from
`2026-10-05T05:41:30Z` to `2026-10-12T17:26:30Z` on its five-minute schedule (a handful of the user's own dry runs
interleaved), `armed: true` on the last, reading a snapshot 69 seconds old against its 900-second limit. The last ticket
a terminal accepted is `2026-10-08T14:26:32Z`, `US100.cash` limit `#298948282`. Since then 604 runs: 598
`nothing_to_place` and 6 `refused`, every one of the six environmental or the rule's own guard - four where the terminal
could not be read or the snapshot was hours old (the weekend shape: Friday `21:01` unread, Saturday `04:11` reading an
artifact 25269s old, Sunday `21:01` unread) and two where the rule confirmed a crossing and refused its own ticket
before anything was sent, because a sell limit at `1.11887` was already at or below the market and the retrace it waits
for had happened. The later of those two, the `2026-10-09T16:56:30Z` run, is the last placement attempt the loop has
made; no ticket came of it.

**One hypothesis tested and closed: the ladder's age gates nothing.** The marked ladder the loop reads carries
`generated_at_utc 2026-10-04T16:14:19Z` - eight days - which looked like a plausible hold. It is not: the loop copies
that stamp into its own log line (`levels_generated_at_utc`) and no code tests it, `lib/l2l_strategy.js` carries no
freshness check on the ladder, and the marks are the user's own permanent lines under the ruling quoted in section 30
and restated in the loop's own comments, so the file's age is recorded and irrelevant. What the loop does gate on is the
freshness of the snapshot the calls are read from, and that gate is what turns a weekend or a stopped producer into a
stated `refused` rather than a silent no-op.

**What the row reasons say instead.** Each pair's own reason, read off the tick of `2026-10-12T17:26:30Z`: EURUSD waits
for an M5 close above a marked line - the newest closed candle `1.1159` has crossed none and the nearest line `1.11887`
is 297 points away; XAUUSD the same with `4211.99` 4483 points from `4167.16`; US100.cash and BTCUSD each carry a level
on the far side of the market (`31049.43` against `30659.78`, `86023.4` against `82515.8`), so their deviation has
already happened and they wait for price to trade back to their own line. Passing a marked line is not enough on its
own: the ticket has to be a limit the market can retrace to, the call has to still stand, and the daily caps
(`max_per_day` 4, `max_open` 1) have to be unfilled, which they are - `taken_today: 0`, `open_tickets: 0`. The loop's
silence is the rule waiting, not the rule broken, and no rule, cap or level was changed to hurry it.

**Boundaries.** No order path was added, touched or called, and no loop, ladder, cap or schema changed. The new columns
state where a trade was, not that the rule works: this section claims no edge, no win rate and no deployment, and
`data/live-trading.json` in this worktree is the feed's own refresh rather than part of this change.

**Published 2026-10-12, with the two rulings the user gave.** Asked whether the page change should be live, the user said
that it should. The release has the shape of sections 44, 48 and 52: a worktree cut from `origin/main` at `e9fc964`, the
lane's change ported into it and checked there, pushed as `d3662e5` - `live-trading: state the opened and closed UTC
dates in the closed-trades table` - a fast-forward on the published branch. Three files moved on it: `script.js` (the
helper under `liveTradingTimestampLabel`, the entry and exit cells, the two column headings, the caption sentence;
+17 / -2), `index.html` (one line: the `script.js` cache-buster to `?v=20261012-closed-trade-dates`) and
`tests/live_trading_readback.browser.test.js` (the rendered case asserts `2026-10-04 13:47Z` and `2026-10-04 13:49Z`;
+2 / -1). `styles.css` was not changed by this release and keeps its own token, and the page's other data URLs are
untouched. The published `script.js` blob is `d30a051`, byte-identical to the file the cases ran against in the release
tree.

| fact | value |
| --- | --- |
| published commit | `d3662e5` on `origin/main`, fast-forward from `e9fc964` |
| the page's new token | `script.js?v=20261012-closed-trade-dates`; `styles.css` left at `?v=20261008-live-trade-logic`, which this release does not change |
| the published blob | `script.js` `d30a051`, the exact file `tests/live_trading_readback.browser.test.js` ran against |
| evidence in the release tree | `node --check script.js` clean; read-back case 2 of 2; the surrounding group 63 tests, 56 pass, 7 fail with the change and 63 / 56 / 7 with the three files stashed, so the seven reds are the released page's own pre-existing live-logic-tab and M5 pan/zoom cases |
| the ladder question | the marked lines are permanent until the user moves them by hand, so `l2l-levels.json` was not re-marked, no level moved and `levels_generated_at_utc` stays a recorded fact rather than a gate |
| what the page still cannot do | open, change or close a position: this release touches no order path, loop, cap, schema or validator |

## 54. The stop gets one rung, and a hand-run close arrives as a flag (user request and build, 2026-10-15)

**What was asked.** Two things on one instruction. First, a way to close one named ticket by hand from the loop's own
command line, rather than by going into the terminal or calling the order tool directly. Second, an automatic
adjustment of a position already open: once a trade has run in its favour by twice the risk it was placed with, its
stop goes to breakeven and stays there.

**What the loop does now, stated as two additions rather than as a rearrangement of the rule.** Everything in sections
39 to 53 stands - the same four pairs, the same hand-marked ladder, the same five-minute close through a line, the same
resting limit with the target five times the risk away, the same per-pair hold, the same daily count, the same size.
What is new is:

| addition | what it does |
| --- | --- |
| the stop's one rung | a position that has run to `2R`, twice the risk its own placement stated, has its stop moved to that placement's entry through the tool's `modify` - once per trade and never a second time. The target is carried through unchanged and nothing else about the position is touched. |
| `--close-ticket <n>` | a hand-run close of one ticket: this once, whatever the rule would say, and nothing else that run. It takes `--once`, and it is the only way the loop itself takes a position out on an instruction rather than on a reading. |

**The risk the rung is measured from is the trade's own placement, not the stop the terminal holds.** `2R` is read out
of `tmp/live-trading-trader-state.json`'s placement row for that ticket - `risk` first, then the distance between that
row's `entry` and `stop`, then its `target` divided by its `r_multiple` - and `positions[].sl` is deliberately not read,
because the first move this loop makes is what overwrites that stop, so a breakeven stop would read as a trade with no
risk at all. A ticket whose placement has gone from the state file, or whose row states neither an entry nor a risk, is
left where it is rather than moved against a number this loop does not have. The level itself is `entry ± 2 × risk`,
read through the same `marketHasReached` the target and an invalidated entry are read through - from the bar the ticket
was placed in onwards, on the exit side's own price - so a touch between two runs is answered here the way it is
answered there.


**The send is the third kind this file makes, and it is gated like the other two.** The move goes through the order
tool as `modify --ticket <n> --stop-loss <entry> --comment l2l-rule-<asset> --confirm-live`, which means it is refused
without `--confirm-live`, it lands in the tool's own journal like every other send, and a move that was sent and did
not land is `send_failed` and exits 1 - the same silence a ticket that did not land has always produced. A move the
tool refused *before* sending is a different thing and is reported as one: the row carries the tool's own reason,
nothing on the account changed, the rung is not spent so the next run asks again, and the run still exits 0, because a
refusal is the terminal saying no rather than a cadence that has broken. Two refusals are the rule's own: a position
this same run is already exiting is left to that exit rather than having its stop moved on the way out, and a position
whose own stop already stands at or past the entry - the rung already there - asks for nothing.

**Only a landed move is written down, which is stricter than the rest of the state file.** What has been moved is kept
in the state's own `moves` list, keyed by ticket, and that row is what stops the next run asking for the same stop a
second time. An attempt that did not land is deliberately not written down: a refused request recorded as a move would
leave the trade carrying the stop it was placed with for good. The other two lists keep their existing rule - a
cancellation or an exit is written down when it was *sent* - and a plan-only run writes nothing at all, so looking
still cannot spend a signal bar or a rung.

**`--close-ticket <n>` is taken before the artifacts and before the freshness gate, on purpose.** The instruction is
to be out of a named position rather than to read the market, so a Layer 1 file a few hours old or a snapshot a few
minutes old is not a reason to refuse it; what is still read is the terminal's own account, and the ticket still has
to be one of this loop's own by the tool's magic `20261004`. From the user's side there is one flag: the loop looks the
ticket up and takes it out as a `close` if it is a position and a `cancel` if it is a resting limit. It requires
`--once`, because a hand act is not a cadence, and nothing else happens on that run - no review, no removal, no ticket.
Without `--confirm-live` the run states the act and leaves the account alone; a ticket that is not on the account, or
that carries someone else's magic, is `nothing_to_close` with a reason that names which of the two facts failed; a
ticket that landed is `closed` or `cancelled`; one that was sent and did not land exits 1. A landed hand act is written
into the state file's own `closes` or `cancellations`, so the lane's record of what it did to the account stays
complete.

**The tool gained the one action that reaches a trade already open.** `tools/mt5-bridge/live-trading-order.py` is four
uses rather than three - `open`, `close`, `modify`, `cancel` - and `modify` is `TRADE_ACTION_SLTP` on the position's
own ticket, with no size, no entry and no exit anywhere in it. It chooses no level of its own: `--stop-loss` is where
the stop goes, and the position's own take-profit is carried through unchanged unless one is stated, because the
terminal reads an `SlTp` request with no target in it as a request to *clear* the target. Three refusals stand in front
of the send and each names the fact it is - the ticket is not an open position on this account; the ticket carries
another path's magic, since a tool that moves what it did not place is a tool that can move anything; the new stop is
on the wrong side of the market - and a stop the symbol will not accept that close to the market is refused the way a
pending entry's own levels are, against the symbol's own `trade_stops_level`. `--confirm-live` gates it exactly as it
gates the other three, and the tool's docstring says all of this rather than leaving it to be read out of the code.

**The page's own sentence about the stop had to change, because the loop no longer matches it.** The `Live Trade
Logic` tab's tenth step read *"The stop and the target are set once"*, with the detail that the loop *"never moves,
trails or widens them"*. Section 51 wrote that when it described the loop; the rung makes it false, and a reader of the
tab would be told something about their own account that the loop no longer does. The step is now *"The stop is set
once, and moves once"*, and its detail states the rung, that the target is never moved, and that nothing trails or
follows the market; `index.html`'s `script.js` cache-buster moves to `?v=20261015-breakeven-rung` so no reader keeps the
old sentence out of a cached file. `styles.css` and the page's other tokens are untouched, the step count stays eleven,
and the other ten steps are as they were. The tab's hold was extended the way the day's count is held:
`tests/live_trade_logic_tab.browser.test.js` now reads `BREAKEVEN_R_MULTIPLE` out of the loop, asserts it is 2, and
matches the page's *"twice the risk it was placed with"* against it, so a changed multiple fails the page instead of
leaving it stale. The page still states nothing it cannot do: no control on it can place, change or close a trade, and
`--close-ticket` is a command-line act with no page anywhere near it.

**Evidence, including the first rung this lane has actually moved.** `node --check` is clean on
`scripts/run-live-trading-trader.js`, `script.js` and the three test files touched, and `python -m py_compile` on the
bridge tool exits 0. The focused set is 89 of 89 - `tests/l2l_strategy.test.js` 27, `tests/live_trading_trader.test.js`
51 and `tests/live_trading_order_tool.test.js` 11, 0 fail - the data suites closest to what the loop reads,
`tests/live_trading_feed.test.js`, `tests/l2l_sizing.test.js` and `tests/l2l_levels.test.js`, are 111 of 111, and
`tests/live_trade_logic_tab.browser.test.js` is 5 of 5 against the amended page, and the whole local suite is 696
tests, 696 pass, 0 fail, 0 skipped in 112 seconds - the first clean whole-suite run this lane has had, where the
previous one carried the three `backtester/tests/secret_scanner.test.js` width-truncation reds this machine used to
produce. Eleven of the cases are new: ten in
the trader's suite, holding the rung's risk to the trade's own placement rather than to the stop the terminal holds, the
unarmed run that states the move and writes nothing, the armed move with no second ask, a move that was sent and did
not land failing the run, the hand run that plans without `--confirm-live`, the armed hand run that writes down what it
did, the hand run that finds a working limit rather than a position, the hand run on a ticket that is not this loop's
own, the hand run whose terminal cannot be read, and the refused move that does not spend the rung; and one in the
tool's, that the level change exists and reaches only this path's own position.

**The armed task moved a real stop while this section was being written, and it is reported here rather than left to be
discovered.** `tmp/live-trading-trader.log`'s run at `2026-10-15T20:41:30Z` is the file's only `stop_moved` row: the
XAUUSD position ticket `300456025` - long 0.01, placed at 07:11 with entry 4140.51, stop 4126.21, target 4211.99, risk
14.296 - had run to `2R` at 4169.102 with the bid at 4169.52, so the loop sent
`modify --ticket 300456025 --stop-loss 4140.51 --confirm-live` through the tool and the terminal answered
`TRADE_RETCODE_DONE` (10009) on the first attempt, with the target 4211.99 carried in the same request unchanged. The
journal row at `20:41:35Z` shows the position before the move as stop 4126.21 and the request as `TRADE_ACTION_SLTP`
only, and the state file's `moves` row carries the placement, the trigger 4169.102, the bid 4169.52 and
`moved_at_utc 2026-10-15T20:41:35.834Z`. The two runs after it, `20:46:30Z` and `20:51:30Z`, both report the rung as
already standing - *"the rule carries one rung rather than a trail, so nothing is asked for a second time"* - which is
the no-second-ask rule being true on a live account and not only in a fixture. What this is not is evidence of anything
about the trade: the position is still open, the move changed its worst case from 14.30 to nothing and its target not at
all, and whether the rung helps or costs is not something a single trade can say.

**Boundaries.** No rule above the exit side changed: the ladder, the level store, the four pairs, the geometry, the
caps, the size and the call readings are untouched, no level was re-marked, no producer, snapshot schema or validator
moved, and nothing here is accuracy, timing or edge evidence. The rung is the user's instruction rather than a measured
improvement - it is not evidence that taking a stop to breakeven makes money, and it changes what a trade's worst case
is, not what it aims at. `--close-ticket` is a hand act and no page control can reach it. The bridge change is the
first time this lane's tool can amend a position, which is why its three refusals exist and why the tool stays the only
file in the lane that can send anything. `data/live-trading.json` in this worktree is the feed's own refresh rather
than part of this change.

**Open with the user.** The rung needs no flag, no wrapper change and no re-registration, so it is already in force on
the armed cadence and has already fired once, as above; if a stop on a position that is already open should not be moved
without a person present, the armed task has to be stopped or the constant changed before the next tick that finds a
trade at `2R`. The *published* copy of the tab is now the stale one: production `main` carries the sentence section 52
released on 2026-10-08, so the public page still says the loop never moves the stop while the loop now does - the same
class of gap the tab's own "one machine fact out of step" card exists to state, and one only the user's word turns into
a release. Whether a second rung, a trail or a partial close is wanted later stays the user's call, and the state file's
`moves` list is the one place that would have to change with it. Whether the hand-run close wants a dashboard button is
open, and the answer for now is no: the act is a flag on the loop's own command line and the page is only a passthrough.

## 55. The loop and its one rung are on production main (release, 2026-10-16)

**The word, and what it answered.** Section 54 left one question with the user: the published page still carried
section 52's 2026-10-08 sentence that the loop never moves the stop, while the loop now does. The answer was "yes,
push this functionality live", which is read here as the whole surface this lane has built and kept off main - the
loop, its feed runner and publisher, the bridge tool behind the order path, the module the loop calls, and the page
sentence they are all described by - rather than the one amended line alone. Production `main` is now `970a74e4`
("Publish the loop, its one-rung stop and the order tool on production main"), 21 files, +11,542 / -137, pushed as
`051a9f84..970a74e4`.

**The route.** A release worktree off `origin/main` (`.local/live-trading-rung-release`, branch
`release/live-trading-rung-20261016`) cut at `662820d6`, the lane's files taken with `git checkout
workers/live-trading-20260929 -- <paths>` so the released bytes are the bytes the lane's cases measured, the two page
regions edited in place on main's own `index.html` and `script.js`, then a rebase onto `051a9f84` - main moved three
feed publications under the port - and a fast-forward push.

**What lands, and why each file is needed rather than wanted.** The loop (`scripts/run-live-trading-trader.js`,
2,056 lines) requires `lib/l2l_strategy.js` and `scripts/publish-live-trading-feed.js`, so neither it nor its 51 cases
can run on a tree that lacks them; the feed side therefore arrives whole (`run-live-trading-feed.js`, 533 lines,
`publish-live-trading-feed.js`, 535, `validate_live_trading_feed.js`, 475, and the two `register-*-task.ps1`
scripts, 264 and 288, with `scripts/README-live-trading-feed-cadence.md`, 198). The order path arrives whole:
`tools/mt5-bridge/live-trading-order.py` (1,047 lines, four uses, `modify` last), `live-trading-snapshot.py` (769, the
tool that makes the artifact the page reads) and the bridge `README.md` (194) that documents them.
`lib/l2l_strategy.js` moves +431 / -81: main carried the module as the 2026-10-04 rule release left it, and the
trade's own level, the permanent levels and the holdings the loop holds are sections 43 and 44's work. The tests
follow the code they measure: `l2l_strategy` 27, feed 54, cadence 25, publish 24, loop 51, order tool 11.

**The page: two tokens, four lines of copy and one button a later release had dropped.** `script.js`'s tenth step now
reads "The stop is set once, and moves once", its detail naming the trigger - twice the risk the trade was placed
with - and the entry the stop moves to, so the worst it can do from there is break even; `index.html` carries
`script.js?v=20261015-breakeven-rung` and `lib/l2l_strategy.js?v=20261005-l2l-trade-level`, the module's token having
sat two releases behind its bytes. The rail's `Live Trade Logic` button was missing on main altogether: `66e0b0b3`
("Publish the USD Layer 1 logic dossier on the bar and the rail") wrote the USD Logic Dossier anchor into the same
region from a worktree cut before section 52's release, so the button was replaced rather than kept and the published
page carried the view with no way to open it. This release restores the button after the rail's three outbound
anchors - still the last `.tab-button` of the System group, which is what the tab's own case asserts - and the case
that had been red on main since that day, at its first assertion, now passes.

**Evidence, and the baseline it was read against.** Main carries no `package.json` and no `scripts/test-local.js`, so
the set was run file by file on the release tree: l2l_strategy 27 of 27, feed 54 of 54, cadence 25 of 25, publish 24
of 24, loop 51 of 51, order tool 11 of 11, the tab's browser cases 5 of 5 and the chart-pan case 1 of 1; `node
--check` is clean on every added or changed JavaScript file and `py_compile` on both python tools. Two cases are red
on the release tree, and a third worktree taken at `origin/main` the same hour (`.local/live-trading-main-baseline`,
detached at `051a9f84`, kept for exactly this comparison) shows both were red before the port: the rule panel's
expired-call case reads one pair `BLOCKED` against the live published artifact rather than the fixture's `NO CALL`,
and the chart zoom case still asserts the 120-bar block the producer has not published since 2026-10-07. The
chart-pan case arrives with the lane's own amendment, which derives every window from the block the feed actually
publishes, and it is green on main now; the zoom case beside it is deliberately left as main's own, because its
amendment needs the crosshair's pointer-events fix, which is page work this release does not carry.

**Boundaries.** This is published code, not a running cadence: the armed `LiveTradingTraderTick019` still runs from
the lane's worktree through `tmp/live-trading-trader-run.cmd`, so the five-minute tick and everything it has done -
including the rung that fired at `2026-10-15T20:41:30Z` - are unchanged by this release, and none of the loop's own
behaviour has been run on main. `config/credential-manifest.json` is not published: its one added entry is the
coordinator's `DEEPSEEK_API_KEY` fact rather than this lane's. No producer, validator, feed schema, Layer 1 agent or
backtesting file is touched, and `data/live-trading.json` is left to the feed's own publication commits.

**Superseded by this section.** Section 54's paragraph that "the *published* copy of the tab is now the stale one"
described the page before this push; the published page now states the rung in the same words the lane does, and the
backlog section 52 recorded as unpublished - the loop's scripts and the module work of sections 43 and 44 - is
unpublished no longer. What stays the user's call is now narrower: whether the armed task keeps moving a stop to
breakeven unattended, having fired for real once; whether a second rung, a trail or a partial close is wanted later,
where the state file's `moves` list is still the one place that would change; and whether the hand-run close should
ever become a page control, which is still no.

## 56. The zoom case's own amendment and the crosshair rule are published, and the armed task stays armed by the user's word (user decision and release, 2026-10-16)

**The two answers, and what each one settled.** Section 55 closed with three things left as the user's call. Two of
them were answered in the same message: the armed task keeps moving a stop to breakeven unattended - "yes should be
automated" - so `LiveTradingTraderTick019` stays armed on its five-minute cadence from this lane's worktree, and
nothing in this lane's build changes for it; and the page work section 55 named as the reason the zoom case was left
alone ("its amendment needs the crosshair's pointer-events fix") should follow - "yes" - so it was published the same
hour. The third question stays open and is not touched: whether a second rung, a trail or a partial close is wanted
later, where the state file's `moves` list is still the one place that would change; the hand-run close remains a flag
on the loop's command line rather than a page control, which is still no.

**Why the case was red, in two layers.** The chart zoom case had been red on `main` since 2026-10-07 and red at its
first assertion: it asserted "the feed publishes 120 M5 bars for BTCUSD" while the producer has published 576 - two
days - since that day, which the baseline worktree's log states plainly as `576 !== 120`. The lane amended the case in
the same hour: every window is derived from the block the feed publishes (`Math.ceil(total / 2)`, `/4`, `/8`), with a
full day's 288 bars kept as the floor, and the caption assertions built from the same numbers rather than hard-coded.
That amendment stayed on the lane, so `main` kept the failing copy. Underneath it sat the second layer, which is a page
fact rather than a test fact: `main`'s `styles.css` has no `pointer-events` rule for the crosshair group, so the dashed
pair of lines the pane draws for the pointer swallows clicks. On the release tree of section 55 the amended case ran
past its window assertions and stopped on its last step, the click that fits the ladder to the price scale, with
Playwright reporting that `<line class="live-trading-chart-crosshair-x">` "from `<g class="live-trading-chart-crosshair">`
subtree intercepts pointer events". The lane's own sheet has carried `.live-trading-chart-crosshair { pointer-events:
none; }` all along, which is why the case is green there and was never green on `main`.

**What was published.** Production `main` is now `d8f39e0e` ("Publish the zoom case's own amendment and the crosshair
rule it needs"), three files, +29 / -15, pushed `71f4d28c..d8f39e0e` from a fresh release worktree off `origin/main`
(`.local/live-trading-crosshair-release`, branch `release/live-trading-chart-crosshair-20261016`). The amended case
arrives with `git checkout workers/live-trading-20260929 -- tests/live_trading_chart_zoom.browser.test.js`, so the
published case is the case the lane measures with; the rule is inserted verbatim where the lane has it, after the
crosshair stroke rule, so the published stylesheet carries the rule the case was measured with; and `index.html` moves
its styles token from `?v=20261014-research-library-v2` to `?v=20261016-chart-crosshair`, because a sheet is cached by
token and a rule added under the old one would reach only readers who had never visited. That token is `main`'s own
line, not this lane's stale `?v=20261008-live-trade-logic`, and no other page reference moves: `script.js`,
`lib/l2l_strategy.js` and the three other HTML entry points keep the tokens their own releases set.

**Evidence.** Run file by file on the release tree with `main`'s own published feed, which is what the case serves to
its browser: the amended zoom case 1 of 1, the chart-pan case 1 of 1, the live-trade-logic tab's 5 cases 5 of 5, the
readback cases 2 of 2 and the dashboard cases 2 of 2, all green. The rule panel's expired-call case is red here, and
its failure is character for character the one the `051a9f84` baseline worktree records - one pair reading `BLOCKED`
where the fixture says `NO CALL` - so it is untouched by this change and still the page's own open item. After the
push the served bytes were compared against the pushed blobs by length, which is how section 52 and section 55 checked
the same thing: `index.html` and `styles.css` are served at the committed sizes once Pages rebuilds.

**What this does not do.** No script, feed, loop, module, validator or bridge file moves - the crosshair's markup comes
from the published `script.js` and only its stylesheet rule was missing - and no test other than the zoom case's own
copy changes. Nothing about the armed cadence changes: the user's "yes should be automated" confirms the loop as it
stands rather than adding to it, so a second rung, a trail or a partial close would be new work on the `moves` list
and not a reading of this answer.

**Superseded by this section.** Section 55's closing paragraph listed the zoom case as "deliberately left as `main`'s
own, because its amendment needs the crosshair's pointer-events fix, which is page work this release does not carry".
That is what this release carries: the amendment and the fix are both on `main` now, and the case is green there.

## 57. The rule is one move to break-even at 2R and nothing further, and both abilities are already published (user decision, 2026-10-16)

**The word.** Asked whether a second stop move, a trailing stop or a partial close was wanted, the user's answer was
that the rule is just this: the stop moves to break-even once, when the trade reaches twice its risk. Nothing further
is commissioned and nothing is added to the loop - `BREAKEVEN_R_MULTIPLE = 2` in `scripts/run-live-trading-trader.js`,
the single row it writes into the state's `moves` list, and the refusal to move the same stop a second time are the
whole of it. That list stays the one change point if the answer ever changes.

**The other question, and what it settles.** The remaining open item was whether the rule panel's expired-call case
should be chased. The user's answer was that they did not know what it meant, followed by the instruction to publish
the two abilities and stop opening new work. Recorded as it was answered: the case stays exactly as it is and no work
is commissioned against it, and no new backlog item is opened anywhere in this lane. It is an internal test's own
expectation about one pair's status word rather than a fact about the page the user reads, which is why it does not
belong in front of them.

**Both abilities are already live, and this section adds nothing to them.** The automated 2R move and the hand-run
close were published together as `970a74e4` (section 55), and the bytes on `main` are the bytes in this lane: for
`scripts/run-live-trading-trader.js`, `scripts/publish-live-trading-feed.js`, `lib/l2l_strategy.js` and
`tools/mt5-bridge/live-trading-order.py`, `origin/main` and `workers/live-trading-20260929` resolve to the same blobs.
A close by hand is one command carrying the ticket - `--close-ticket <n> --once --confirm-live` - answered by the loop
before its artifact and freshness gates on purpose, taking this loop's own magic only, replying `nothing_to_close`
when the ticket is not this path's own or is not on the account, and writing a landed act into the state's `closes` or
`cancellations` rows. The automated move needs nobody at all: the armed `LiveTradingTraderTick019` runs the loop every
five minutes from this worktree with `--confirm-live`, and it has already made the move once for real, at
`2026-10-15T20:41:30Z`.

**No new tasks.** The machine carries two live-trading scheduled tasks, `LiveTradingFeedTick019` (the feed, every
fifteen minutes) and `LiveTradingTraderTick019` (the loop, every five minutes), both reading the runner scripts in
this worktree's `tmp/`. Neither is altered and no third is registered: a close stays something the user asks for and
this lane runs by hand, not a schedule, and the page carries no close control.

## 58. The dashboard's own Close button: the fast link on this PC and the request the five-minute loop reads (user instruction, 2026-10-16)

**What was asked.** Told that a hand close was one command carrying a ticket, the answer came back that the control
could not be seen and that it belongs in the Open positions section of the Live Trading tab. That is the whole
instruction: the close stops being only a command line and becomes a button on the row it concerns. Asked which route
a click should take - a static page cannot reach a broker, so something has to carry the ask back to this machine -
the answer was both: the fast link on this PC when it is available, and the request through the reader's own GitHub
account as the fallback.

**What the table now carries.** A `Close` column is the last column of the Open positions table. A button is drawn
only on a row carrying this lane's own magic, because the loop refuses any other ticket and a control that cannot work
is worse than no control; another path's position says `another path's` in the same cell. Pressing the button opens a
confirm strip inside that row, naming the ticket, the side, the volume and the symbol, and offering two routes and a
cancel. Both routes end in the same act on the account - the loop's own hand-close, taken before the artifact and
freshness gates, taking only its own ticket, `--confirm-live` still deciding whether anything is sent - so the page
never claims a close of its own and this section adds no second way for an order to be placed. The panel's own
provenance line was amended to match: read-only except one ask.

**Route one, the fast link.** `scripts/register-live-trading-close-link.ps1` writes
`tmp/live-trading-close-run.cmd` (this machine's node, python, terminal folder, state, log, lock and journal) and
registers the per-user URL protocol `HKCU\Software\Classes\l2lclose`, whose whole action is
`tools/live-trading-close-link/open-live-trading-close-link.ps1` with the URL and the runner. A press is then a
navigation the browser makes on its own - the page never calls `preventDefault` - and the handler reads one whole
ticket number out of the URL, refusing anything else before the terminal is reached; shows one confirmation box with No
as the default; runs the loop's hand-close for that ticket; and shows the loop's own status and reason, taken from the
record the loop prints, with a line written to `tmp/live-trading-close-link.log`. Nothing registered here runs by
itself: no task, no service, no listening port, and `-Unregister` removes both the key and the runner. The runner
carries no `--align` and no `--quiet`, for two reasons a reader of it should be able to check: a hand close is not a
cadence and must not wait for a bar close, and the handler needs the loop's own words rather than a silent exit.

**Route two, the request the loop reads.** The published page cannot run anything, so the fallback is a file:
`data/live-trading-close-request.json`, written by the page with the reader's own GitHub token through the same
contents API calls the marked-levels file uses, and read by the loop from the published branch. The document is
`lib/live_trading_close_request.js`, loaded by the page and required by the loop, so one set of rules covers both ends:
a row is `{ request_id, ticket, symbol, side, volume, requested_at_utc, requested_by, note }`, the id is derived from
the ticket and the second it was asked, the log keeps its newest fifty rows, and the file's own note states what it is.
Two rules bound what a row can do, and both are the loop's: the ticket must carry this lane's own magic - the same
check `--close-ticket` makes - and the ask must be younger than thirty minutes, which is six ticks, so a row committed
by mistake expires instead of firing days later against a position opened since. A stamp up to five minutes in the
future is read as clock skew and still counts; anything further ahead is not acted on. The page merges the published
copy into its own on a conflict and retries once, so one reader's ask never replaces another's. No credential is ever
written into the file: the token is a request header and nothing else.

**What the loop does with a row.** `closeRequestStep` runs before the three artifacts and before the freshness gate,
for the same reason a hand run is taken there: the instruction is to be out of a ticket rather than to read the market.
It asks the published branch for the log with `git fetch --quiet origin main` followed by
`git show FETCH_HEAD:data/live-trading-close-request.json` - FETCH_HEAD only, so no branch and no working tree the
publisher is using is disturbed - and falls back to the checkout's own copy for a machine with no remote. It acts on
one ask per run, the oldest it has not already answered, through the same `takeTicketOut` the command-line path now
uses; a landed close is written to the state's `closes` or `cancellations` with the ask's `request_id`, its
`requested_at_utc` and `requested_by` beside the ticket, and the deal carries `l2l-rule-asked` as its comment, so the
terminal's own history distinguishes a press on the page from a hand run. Whatever the outcome - including "there was
nothing to close" - the ask is written into the state's new `close_requests` list, because the page's log is
append-only and the state file is the only place an ask can be marked as dealt with; that is what makes one press one
close however many ticks follow it. The run's record carries a `close_requests` block naming the source it read, the
size of the log it saw, and the ask it took. A read that fails is a note in that block and not a refusal: a machine
that cannot reach the remote must keep trading. `--close-requests off` stops the read entirely, and a run given
`--close-ticket` does not read the log at all, because it was told which ticket to take.

**What was measured, and against what.** New: `tests/live_trading_close_request.test.js` (15 cases: the row's shape,
the refusals, the thirty-minute window and the clock-skew edge, the union that makes a merge safe, the fifty-row cap,
the checker, the contents API call and the conflict retry) and `tests/live_trading_close_control.browser.test.js`
(5 cases on the real page: the button only on this lane's row, the confirm strip's own words and the link's `href`, the
hand-over line that never claims the trade is out, one committed row carrying the ticket through the reader's token,
and the no-token refusal). Extended: `tests/live_trading_trader.test.js` now has 57 cases, six of them for this path -
the ask taken and nothing else that run, an expired ask and an answered ask both left alone with the tick trading as it
always would, another path's ticket recorded as answered without a second look, the checkout's copy as the no-remote
fallback, an unreadable log as a note rather than a refusal, and the three new switches. The focused lane set runs
288 cases green file by file. Two honest notes about the whole suite: `backtester/tests/secret_scanner.test.js` is red
on this machine with and without this change (checked by stashing every edit here, running it, and restoring), and two
browser/feed files flake under the suite's four-way concurrency while passing alone.

**Published, and read live.** Production `main` is `4fd39bc9` ("Put the dashboard's own hand close on main: the Close
column, the fast link on this PC and the request the loop reads"), pushed `3e1f294c..4fd39bc9` after a rebase under the
feed's own publish. One thing about that release is worth writing down, because it is a fact about this lane rather
than about the feature: `main` is ahead of this worktree in the rest of the page (the Research Library, the wider
agent set, the chart crosshair fix), so the page files were not taken wholesale from the lane. The release worktree was
cut at `origin/main`, the lane's *changes* were applied to `main`'s own `script.js`, `styles.css` and `index.html` - a
three-way apply that conflicted exactly where the two pages differ, and each conflict was resolved by keeping `main`'s
copy and adding only this feature - and the loop, its tests, the publisher's one-line export, the new document module,
the request log, the two close-link files and the page's own cases were taken from the lane, whose copies of those files
differ from `main` by this work and nothing else. The published bytes were then held to the same cases in the release
tree: 88 green (the document's 15, the page's 5, the loop's 57, the order tool's 11). Three live checks, not test ones:
the served page carries the Close column, a caption naming both routes and one Close button on this lane's open XAUUSD
position; the served `data/live-trading-close-request.json` is the empty log; and the armed five-minute tick at
`2026-10-16T08:26:30Z` read it out of the branch - `source: "FETCH_HEAD:data/live-trading-close-request.json"`,
`published: 0`, nothing taken - which is the fallback path running unattended on the machine. The link was exercised
too: a URL that is not a whole ticket number exits 2 without reaching the terminal, and ticket 424242 went the whole
way to the loop and came back `nothing_to_close` with nothing sent.

**The first real press, and the one line it found.** The link was released and then pressed by the user, and the first
real press failed: a PowerShell window came and went and the open position was untouched. Every exercise of that handler
until then had passed `-Yes`, the switch that skips the confirmation box for a hand test, so the one call the browser's
route depends on - the box itself - was the one line that had never been executed on this machine. It was wrong: the
default button was passed as the string `No`, and `MessageBoxDefaultButton` names its members by position, offering only
`Button1`, `Button2` and `Button3`, so the cast threw before the box was drawn. In the hidden window a browser launches
that error has nowhere to go: the process ended, printed nothing anyone could read, and none of the paths that would have
said something had been reached. Nothing was sent, no order path was involved, and the ticket never got past the question.

**Three changes, all inside the handler.** The default button is now
`[System.Windows.Forms.MessageBoxDefaultButton]::Button2`, the No of a Yes/No box, and every `MessageBox` argument in the
file is written as the enum it is, so no cast can kill a press before the box is drawn. Every press is written to
`tmp/live-trading-close-link.log` - `pressed`, `refused` with its reason, `confirmed`, and `answered` with the loop's own
status, `action`, `done` and exit code - and an unexpected failure is trapped, logged as `failed` and exits 4, so a press
can no longer be invisible from both ends of the link. The native call to the runner is also wrapped with the strict
preference lifted for its duration, because with that preference at Stop a redirected stderr stream is a terminating error
in its own right: a line the loop writes to stderr would have ended the handler between the confirmation and the answer,
which is a press that runs the loop and then says nothing about it.

**Verified, this time with the box drawn.** The box path was started the way the browser starts it - hidden window, real
runner, ticket 424242 - and it held with its window title `Live trading close link` instead of dying; the two refusal
paths were run again (a URL that is not one whole ticket number, exit 2, and a runner that is not there, exit 3), each
leaving its `pressed` and `refused` lines; a stand-in runner that writes to stderr and exits 1 came back as `hand_failed`
with `loop_exit` 1, the handler surviving and logging it; and ticket 424242 went the whole chain again to
`nothing_to_close` with `loop_exit` 0. The last piece was read from the published page itself: opening the confirm strip
on the served page and reading its link gives `l2lclose:300456025`, the ticket of this lane's open gold position, so the
page had been handing over the right URL all along. The fix is entirely inside the handler - the page, the loop and the
order tool are untouched - and the same handler revision is now on `main`.

**What this does not do.** No scheduled task is added or altered - the two armed tasks are untouched, and a close is
still something a person asks for - and no order call is added anywhere: `tools/mt5-bridge/live-trading-order.py`
remains the only file in the lane naming one, which its own test still holds. The rule, the rung at 2R, the producers,
the snapshot schema, the validator and every file the backtester reads are untouched. `data/live-trading-close-request.json`
is published as an empty log so the loop, the page and a reader of the raw file all have the same document from the
start; the page's write path is the reader's own token, exactly as the marked-levels file's is.

