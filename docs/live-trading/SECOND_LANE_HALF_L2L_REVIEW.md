# A second lane on 0.5 L2L: what the live trader is today, and what a second account would take

**Status 2026-11-03, evening. Written for an external review (ChatGPT) of viability, not as a build log or a plan of
record.** Everything in sections 1-3 is running or committed and is named with the file that holds it. Everything in
sections 4-7 is a proposal, and each claim that cannot be proved from this checkout says so. Sources:
[VPS_DEPLOYMENT_STATUS_20261024.md](VPS_DEPLOYMENT_STATUS_20261024.md) (§14-15 are today's),
[STRATEGY_LIVE.md](STRATEGY_LIVE.md) (§39-58), [FTMO_SETUP_GUIDE.md](FTMO_SETUP_GUIDE.md),
[CONVERSATION_NOTES.md](CONVERSATION_NOTES.md).

## 1. The live trader, end to end

One Windows host, one MT5 terminal, one lane, one loop that sends. The PC is out of the loop; its three tasks are
`Disabled`.

| Piece | What it is | Cadence |
| --- | --- | --- |
| Host | Contabo Cloud VPS Core 4, 4 vCPU / 8 GB / 100 GB SSD, Windows Server with Desktop Experience, UK, `158.220.87.240`, hostname `vmi3697641`. Clock is UTC. | always on |
| `LiveTradingTerminalStartup` | launches `terminal64.exe` from `C:\live-trading\terminal` at logon +45 s, `AllowLiveTrading=1`, no credential in the ini | at logon |
| `LiveTradingLane-ftmo1` | `run-live-trading-feed.js --once --align` in `C:\live-trading\runtime`: the read-only snapshot producer for that lane's terminal, then its validator | 5 min |
| `LiveTradingTraderTick019` | `run-live-trading-trader.js --once --align --confirm-live --lane ftmo-1 --published C:\live-trading\publisher`: the one order path | 5 min |
| `LiveTradingPublishLanes019` | `publish-live-trading-lanes.js --checkout C:\live-trading\publisher`: one commit for every lane | 10 min, gated to 600 s |
| `LiveTradingRefresh0600` | `logs\trigger-refresh-0600.ps1`, the daily Layer 1 run | daily 06:00 UTC |
| `LiveTradingWatchdog` | `run-live-trading-watchdog.ps1` as `SYSTEM`: terminal process, snapshot age, restart through the logon task, reboot marker, autologon hardening | startup + 10 min |
| GitHub `live-trading-monitor` | `scripts/check-live-trading-publication.js` against the published URLs, one request per lane, writes nothing, exit 0/1/2 is the alarm | cron `*/15` (in practice ~5 runs a day) |

The five data tasks run as `Administrator` at `Highest` - a task registered `Limited` cannot write the checkout
(§14.2 fault 2). The watchdog runs as `SYSTEM` because the case it exists for is a host with nobody signed on.

### 1.1 The inputs the loop reads

| Input | Path | Why there |
| --- | --- | --- |
| Sealed Layer 1 calls | `<published>/data/layer1.json` | read exactly the way the page reads them: the priority call's direction, falling back to the 24h call's; a call whose window has closed is no direction |
| The marked ladder | `<published>/data/l2l-levels.json` | the bytes the published page serves, so a line a reader can see is a line the loop can trade from |
| Bars and the account | this machine's own `data/live-trading.json` | written by the feed cadence seconds after each M5 close, fresher than the published copy; carries `orders`, `positions`, `closed_trades` |
| The dashboard's close asks | `<published>/data/live-trading-close-request.json` | a row names the lane, the masked login, the server and a ticket |

The daily calls are refreshed by `.github/workflows/master-orchestrator-daily.yml`, which wakes hourly at :07 UTC and
calls the n8n webhook only inside the 07:00-10:59 New York window, once a day, never overlapping an in-flight run. So
the trading day's direction is set before the London session and does not change again that day.

### 1.2 The rule the loop applies (`lib/l2l_strategy.js`, shared with the page)

1. Direction comes from the sealed call for that asset, and only while that call is still standing.
2. Trigger is a **closed** M5 bar that finishes past a marked L2L level which the bar before it did not finish past - a
   wick, or a price that has simply sat above a line for hours, is not a crossing.
3. The entry is a **limit back at that level**, not a market order at the close.
4. The target is the **next marked level** on the same side - a price the user marked on the chart, not a multiple.
5. The stop follows the target at five to one: **one fifth of the entry-to-target distance**, behind the entry
   (`REWARD_R_MULTIPLE = 5` in `lib/l2l_strategy.js`).
6. The entry has **no expiry**. It stands until the take-profit is hit or the call direction changes; a stop-out is
   answered by putting the limit back at the same level with the same target and stop.
7. One ticket per pair; a signal bar is spent once; `--max-per-day` defaults to 4 on a Europe/Prague day.
8. A position that reaches **twice its risk** has its stop moved to break-even, once, and nothing else is ever amended.
9. **Size is the instrument's own `volume_min`.** The loop passes no `--lots`; growing it takes a hand edit in the order
   tool's words, not a number in the loop.
10. Every ticket carries magic `20261004` and a comment prefix naming the lane's rule; rows of another magic are
    invisible to the loop.

Gates that refuse rather than warn: `--confirm-live` absent (plan only), a stale snapshot, an unreadable terminal, an
account that does not match the lane, a signal bar already spent, a pair already holding a ticket, the day's cap.

### 1.3 What the dashboard shows

One published commit carries every lane's snapshot, the trader heartbeat, the lanes document and the orders. The page
draws the corner lamp, the Accounts strip, the four-pair M5/H1/H4 chart with the marked ladder and the executed trades,
the trade-logic tab that states the rule in words, the closed-trades table on both clocks, the position tool and the
Close button that writes a close request.

The lamps were rebuilt today: a heartbeat is judged by **its age when the publisher read it** against the 15-minute
window, and the page's own **copy** is judged separately against a one-hour ceiling. That split exists because the
publisher commits roughly every 20 minutes (10-minute ticks through a 600-second gate), so a healthy loop's record was
routinely 20+ minutes old at publish and the old single-window rule flashed amber for a quarter of every cycle.

### 1.4 Evidence

`tests/live_trading_trader.test.js` (127 KB of contract), plus feed, cadence, publish, lanes-publish, order-tool,
close-request, effective-config, host-prepare, migration-bundle, monitor-workflow and publication-monitor suites, and
ten browser suites for the panel, chart, levels, close control and accounts strip. Whole local suite: 763 tests.

## 2. What the second lane already has

The two-lane architecture was built before the second account existed, and lane 2 is **parked, not missing**:

- `config/live-trading-lanes.json` carries `ftmo-2` with `"enabled": false`, its own `root` (`../ftmo2`), its own
  terminal (`C:\Program Files\FTMO Global Markets MT5 Terminal 2`), its own task names (`LiveTradingLane-ftmo2`,
  `LiveTradingTraderTick-ftmo2`, `LiveTradingTerminalStartup-ftmo2`) and its own published files
  (`data/live-trading.account2.json`, `data/live-trading-trader.ftmo-2.json`). The file's own note says flipping
  `enabled` to true is the whole switch-on.
- One publisher for all lanes, so the page can never serve one account newer than the other, and a lane that is missing
  or stale refuses the run instead of publishing half a picture.
- The accounts strip already draws a parked row - the live page today reads `FTMO account 2 / disabled`.
- Registration is per lane: `register-live-trading-trader-task.ps1 -Lane ftmo-2 -Terminal "...MT5 Terminal 2"
  -Published C:\live-trading\publisher`.
- Close requests are account-scoped, so an ask typed on one card can never be acted on by the other loop.

**What is not there:** the page reads exactly one chart feed (`data/live-trading.json`), so lane 2's snapshot would be
published and never drawn; the levels document is shared, not per lane; the rule has no per-lane variant of any kind -
`rMultiple` is an option in the module that the trader never passes; and the watchdog is registered per terminal, so it
needs a second instance rather than a change.

## 3. What "0.5 L2L" means here, and what the recorded evidence actually says

`0.5 L2L` is the **half-distance equivalent of the L2L distance**: the level halfway between the marked line and the
line beyond it. The ladder store already accepts a level `kind` of `"half-l2l"`, and the marking tool's `duplicate`
action already derives lines from a measured seed distance - but the published ladder carries **88 `l2l` levels and no
half levels**.

What is recorded about it, in `data/backtest-engine.json` and `data/research-proof-map.json`:

| Figure | Value | The sentence beside it |
| --- | --- | --- |
| Full L2L reach | 73.2% (328 / 448 eligible directional calls) | reach only |
| 0.5 L2L reach | 99.1% (444 / 448 eligible calls, 1h median time) | reach only |
| Qualification gate | `not qualified` | "the current 73.2% and 99.1% figures show directional reach only. They are not expectancy, risk-adjusted performance, or a production strength grade" |
| Executable full algorithm | `blocked` | "blocked until entry timing, target, adverse boundary, and intraday sequencing are defined on real price paths" |

Three limits a reviewer must not paper over:

1. **Reach is not survival.** "Price reached the half level 99.1% of the time, median one hour" says nothing about
   whether price went **against** the entry by the stop's distance first. Every geometry below except one tightens the
   stop, and a tighter stop is exactly what a reach-only study cannot price.
2. **The research artifacts are not in this checkout.** `data/half-l2l-reach-research.json` and
   `data/half-l2l-executable-entry-v1-draft.json` are referenced by the docs and fetched by the Backtest tab, but
   neither file is present in this tree - the figures above are the recorded summary, not a study that can be
   re-derived here.
3. **The half-L2L draft is research only.** It proxies entry at "the open of the first available 1H bar" and sizes stop
   and target at ADR20 multiples; it is marked `research_only` / `DRAFT_BLOCKED_FROM_PROFITABILITY_EXECUTION`, a
   reference for the shape of a rule rather than an edge.

## 4. Three ways to turn "0.5 L2L" into a lane, and what each costs

The rule's geometry comes from one function, `ticketGeometry({ entry, side, levels, point, rMultiple, minBreak })`: the
target is the next marked line and `risk = reward / rMultiple`. So "0.5 L2L" is one decision - *which of the two numbers
halves* - and the answer changes the risk profile completely.

| Option | Target | Stop | Reward:risk | What it means | New code |
| --- | --- | --- | --- | --- | --- |
| **A. Half the target, keep 5R** | halfway to the next line | 1/5 of the half distance = **half of today's stop** | 5R | the 0.5 L2L rule literally: same rule, half-size geometry, tighter invalidation | target-mode option through `ticketGeometry`, `reentryPlan`, `positionTicket`; `--target-mode half` on the trader; a per-lane field |
| **B. Half the target, keep today's stop** | halfway to the next line | 1/5 of the **full** distance | **2.5R** | the invalidation stays where the tested rule puts it; only the prize shrinks | same plumbing, one different line of arithmetic |
| **C. Half levels as their own ladder rows** | the `half-l2l` row | 1/5 of that distance (= A) | 5R | no strategy change at all, but the ladder must become per-lane or lane 1's targets move too | a kind filter per lane + half-level derivation in the marking tool |

**Recommendation: define the variant as B for a first live lane, and treat A as the version to test in the same
harness.** B is the only one whose outcome is measurable from artifacts that already exist - every published snapshot
carries the bars, the ladder and the entry, so "did price reach the half line before it reached the invalidation" is
arithmetic over history nobody has to buy. A is a genuinely different strategy (half the stop), and 90 days of live data
is a thin sample for a stop half the size. C is the cheapest to build and the worst to reason about, because it changes
what "the next marked line" means for everyone.

One consequence worth stating plainly: with size fixed at `volume_min`, B risks **the same money per trade as lane 1 but
aims at half the distance**, so lane 2 would be expected to win more often and earn less per win; A risks **half the
money and aims at half the distance**, so its R stays 5 and its money risk per trade halves. Neither doubles anything
unless somebody raises the lots. `--max-open` and `--max-per-day` are already per lane.

## 5. Do we need two FTMO accounts? Yes for real money, no for the first test

- **Two live variants at once need two accounts.** One login carries one set of daily-loss and max-loss limits, and the
  rule holds one ticket per pair - so full L2L and 0.5 L2L cannot both trade the four pairs on one account without
  stacking two tickets and two risk budgets into one limit.
- **Two accounts are not two samples.** Both lanes trade the same sealed calls and the same marked ladder, so a bad day
  is the same bad day twice: the second account does not diversify, it doubles the exposure to one idea. That is a
  sizing decision rather than an architecture one, but it is the first thing an external reviewer should be told.
- **FTMO permission is not yet in writing.** `VPS_DEPLOYMENT_STATUS_20261024.md` §4 already holds the question to ask,
  and until the answer arrives account #2 stays unarmed. For this change the wording needs one clause more: *"the second
  account would run the same signals with a different take-profit and stop distance - same direction, never the opposite
  position."* The guide's own rule on the other side is: never hold opposite positions on the same symbol across
  accounts you control. Same-direction duplication is not that, but it is the sentence FTMO should answer.
- **The cheaper first step is a shadow lane**: run the 0.5 variant on the account that exists, in plan-only mode (the
  mode the loop already has - it prints the ticket it would place and sends nothing), publishing its own heartbeat and
  its own would-be tickets. That produces evidence for a few weeks before a second challenge fee is paid. One caveat to
  handle rather than discover: a shadow lane reading lane 1's terminal sees lane 1's tickets as its own (same magic,
  same account), so either it runs on its own demo account, or its reading of "the pair already has a trade" is scoped
  to the variant.

## 6. One host or two?

**Same host is the right call for now**, and the reason is the publisher, not the CPU. One publisher reads every lane's
checkout and publishes them in one commit precisely so the page cannot serve account 1 newer than account 2; a second
host would either need a second publisher (two commits seconds apart, racing the same remote - the fault the design
exists to prevent) or a rework of the publish handoff. Capacity is not the constraint: 4 vCPU / 8 GB already runs a
terminal plus three node loops, and a second MT5 terminal is a few hundred MB and one more core-second every five
minutes. What a second host buys is independence from the host dying - which the external monitor covers by telling you
it died, not by trading through it.

Three host-side things a second lane inherits from today's faults and must respect:

1. The lane's tasks must run at `Highest`, or the tree is read-only for them (§14.2 fault 2).
2. Each lane's trader needs `--published` pointing at the publisher checkout (§14.2 fault 3).
3. A **cold** terminal only quotes symbols it has a reason to quote; the producer's `subscribe_symbol()` fix is what
   makes a freshly booted lane publish four instruments instead of two (§14.5), and lane 2 gets that for free because
   it is the same producer.

The watchdog needs a second registered instance (it takes `-TerminalProcess` and `-Snapshot` as parameters), and
`config/live-trading-lanes.local.json` on the host needs lane 2's root - that file is what tells the publisher where a
lane's checkout lives when it is not beside it.

## 7. Staged setup, cheapest first

**Stage 0 - the variant, no money (code and tests only).** Add `--target-mode <full|half>` to the trader and a matching
option through `lib/l2l_strategy.js`; carry it per lane (the lanes file is the natural home, beside `--max-open`); add a
"keep the full-distance stop" flag if B is chosen. Tests: the geometry in both modes on all four pairs, a re-entry that
keeps the mode, the stop-inside-the-grid refusal the module already has, and the trade-logic tab's own wording.
Nothing in this stage touches a terminal.

**Stage 1 - evidence, still no money.** Run the variant in plan-only mode as a shadow lane for two to four weeks,
recording every would-be ticket and its outcome from the published snapshots. The two questions to answer before any
account is bought: does the half target get reached before the invalidation (A and B, from bars already published), and
does B's 2.5R beat A's tighter 5R on the same calls.

**Stage 2 - the account, when FTMO has answered.** A second account of the same size and type as lane 1 ($10k 2-Step,
Swing where offered) so the lanes stay comparable; install the second terminal by copying the program folder and
launching its `terminal64.exe /portable` (the guide's method - do not run the installer twice); log in by hand; run
`live-trading-account-probe.py` against that terminal for the masked login, server, currency, leverage and symbol specs;
fill lane 2's rows in `config/live-trading-lanes.json` (`account_login_masked`, `account_server`, `account_type`,
`account_stage`, `enabled: true`); add lane 2's root to the host's local lanes file; register the lane's feed and trader
task with `-Lane ftmo-2` **unarmed**, watch one clean plan run, then arm; register the second watchdog instance; run
`-Mode Verify -ProbeTerminal` until every check is `ok`.

**Stage 3 - the page, only if it earns its keep.** The accounts strip needs nothing: lane 2 appears the moment it
publishes. Watching lane 2's own chart and tickets needs a lane switcher in the Live Trading panel and a per-lane feed
URL - a real dashboard change (a fetch, a control, its browser tests), worth doing after lane 2 has run, not before.

## 8. Open questions, in the order they block work

1. **Which number halves - A or B?** Everything downstream depends on it, and only B is measurable from data that already
   exists.
2. **FTMO's written answer** to §4's question plus the half-distance clause. Account #2 stays unarmed until it lands.
3. **Shadow lane or second account first?** The shadow lane costs a wrapper file and two weeks; the account costs a
   challenge fee and a manual login.
4. **Does lane 2 need to be visible on the page, or is its card enough?** A lane switcher is a dashboard change with its
   own tests.
5. **Risk per lane in money terms.** Both lanes still trade `volume_min`, so "0.5 L2L" means half the money risk of lane 1
   only under A. Equal money risk per lane would need lot sizing, which does not exist yet.
6. **Aggregate exposure.** The same four calls on two accounts is one idea twice. Nothing in this repository sets a
   cross-lane exposure cap, and FTMO's per-account limits will not see the other account.

## 9. What this document does not claim

That 0.5 L2L has an edge, that a reach figure is expectancy, that two lanes are independent evidence, or that any
lane-2 step has been built. Nothing in sections 4-7 exists as code, no account #2 is bought, and no FTMO answer is in
hand.
