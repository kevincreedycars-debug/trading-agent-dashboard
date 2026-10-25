# Live trading agent - full briefing for an outside reviewer

**What this is.** A self-contained summary of a working automated trading system, written 2026-10-24 so that a
reviewer with no access to the code can judge two concrete proposals at the end: (A) moving the live system onto an
always-on Windows host (VPS) so the owner's PC can be off for a week, and (B) adding a **second FTMO account** to the
same system. Everything below is either observed on the machine, read out of the repository, or explicitly marked as
unverified. Section 9 lists exactly what is being asked of the reviewer; section 10 is a glossary.

**Who is writing it.** The owner is not the programmer. The system was built and is maintained by an AI coding agent
(Cline) working in a git repository, in the owner's style: small commits that state what was done and why, tests next
to every rule, and documents that record evidence rather than intent. Some phrasing below is deliberately blunt about
what is and is not proven, because the owner's standing instruction is that nothing may be called live, profitable or
tested without an artifact to prove it.

**Two standing rules the reviewer should respect,** because they are the owner's, not the agent's:

1. **Layer 1 (the directional calls) stays sealed.** Nothing downstream - including anything built for execution -
   may feed back into how those calls are produced. Suggestions that involve "using live results to improve the
   signals" are out of scope.
2. **Backtesting and research never gate live execution, and live execution never changes research.** The reviewer
   is asked for operations and infrastructure judgement, not for strategy redesign.

---

## 1. The one-paragraph version

A cloud n8n workflow publishes eight independent directional calls (USD, EUR, GBP, GOLD, SILVER, WTI, NQ, BTC) as
sealed JSON to a GitHub repository; a GitHub Pages dashboard renders them. On top of that, a separate "live trading"
lane reads a hand-marked level ladder and the owner's own rule (a five-minute close beyond a marked level, a limit
order back at that level, the next marked level as the target, the stop set at one fifth of that distance), and
executes it on a single **10,000 USD FTMO 2-Step Challenge account** on MetaTrader 5, through a Python bridge, driven by two
Windows scheduled tasks every five minutes: one that publishes a read-only account snapshot to the dashboard, one
that places, cancels, moves and closes orders. That lane has been armed since 2026-10-05. It currently holds 1 open
position, has closed 10 trades in the last 14 days, and its state file records 36 placements, 4 cancellations, 1
close and 3 stop moves. It runs **only while the owner's PC is on, logged in, with the terminal open**, which is why
the hosting question exists.

## 2. The two layers, and why they are separate

**Layer 1 - calls (cloud, untouched by any of this).** Eight n8n flows, one per asset, run in n8n cloud at 07:00 ET and
publish `data/layer1.json` to `main` on GitHub. Each agent writes a call per horizon (`24h`, `3d`, `current_week`,
`next_week`, `current_month`) with `direction`, `conviction`, `sealed_at`, `expires_at`, and a forecast window. Agents
are sealed: they read only their own logic document and the latest upstream inputs. The dashboard shows them. Example
of the current shape (2026-10-24 11:24Z publication): USD BEARISH, EUR BULLISH_LEAN, GOLD BULLISH_LEAN, SILVER
BULLISH_LEAN, NQ BEARISH, BTC BULLISH_LEAN, WTI BULLISH, GBP BULLISH_LEAN, most expiring 2026-10-27.

**Layer 2 - the rule (`lib/l2l_strategy.js`, "L2L").** The owner's rule, in his words, is four steps:

1. take the direction Layer 1 published for the asset;
2. wait for a five-minute candle to **close** beyond a level the owner has marked on the chart (a *close* beyond, in
   the crossing candle itself - price that has merely been above a line for hours has crossed nothing);
3. put a **limit order back at that level** (a retracement entry, not a market chase);
4. aim the target at the **next marked level** on the ladder, and set the stop so the reward is five times the risk
   (one fifth of the entry-to-target distance).

The level ladder is a hand-marked file, `data/l2l-levels.json`, four instruments, marked by the owner on 2026-10-04
(seeds he drew, plus levels duplicated from them). The rule is *prices only*: it says nothing about position size, and
size is the instrument's minimum (0.01 lots on this account) until the owner scales it. The same code is loaded by the
dashboard and by the tests, so the page cannot drift from the code that runs.

## 3. The live execution path, concretely

Everything below runs on one Windows 11 PC, in `D:\trading-agent-dashboard-codex`, as the owner's own Windows user
(`A17`). No cloud service touches the broker.

| Component | File | What it does |
| --- | --- | --- |
| Terminal | FTMO MetaTrader 5, build 6231, `FTMO-Server`, login masked `***614` | The broker connection. `Algo Trading` is deliberately **off**: the owner's lane is an external process, not an expert advisor. |
| Snapshot producer | `tools/mt5-bridge/live-trading-snapshot.py` (Python 3.13, `MetaTrader5` package) | Read-only. Attaches to the running terminal, writes `data/live-trading.json`: account row, M5 and H1 bars for 4 instruments, open orders, open positions, 14 days of closed trades, server clock offset. Its MT5 function allowlist is enforced by test - it cannot place anything. |
| Feed cadence | `scripts/run-live-trading-feed.js`, task `LiveTradingFeedTick019`, every 5 min | Runs the producer, then optionally publishes the artifact to `main` if four gates pass (the validator accepts it, it is inside its own freshness window, it is strictly newer than what `main` carries, and 600 s have passed since the last publish - GitHub's Pages soft limit is ten builds an hour). |
| Trader loop | `scripts/run-live-trading-trader.js`, task `LiveTradingTraderTick019`, every 5 min, armed | Reads the published calls, the level ladder and the fresh snapshot, applies the rule, and places/cancels/moves/closes through the bridge. |
| Order bridge | `tools/mt5-bridge/live-trading-order.py` | The only thing that can send. Placing requires an explicit `--confirm-live`; it marks every order with its own magic number (`20261004`); it refuses to touch a ticket that is not on this account or not carrying its own magic; it refuses an order whose stop is on the wrong side of the entry, or whose size is above `--max-lots` or not positive. Every call is journalled to `tmp/live-trading-orders.log`. |
| Dashboard | `index.html` + `script.js` + GitHub Pages | Renders the snapshot (charts, the rule's per-pair state, positions, closed trades) and a "Live Trade Logic" tab that states the rule in words and holds itself to `lib/l2l_strategy.js`. |
| Close control | `data/live-trading-close-request.json` on `main`, plus a local `l2lclose:` link | Two ways for the owner to close a position by hand from the page. |

**The loop's decision model, in the loop's own terms.** For each of the four pairs it works out one *stage*:
`unavailable`, `no-call`, `no-levels`, `waiting`, `confirmed`, `in-trade`, `blocked`. Only `confirmed` carries a
ticket. `blocked` means the one-ticket-per-pair cap is doing its work. On top of the rule there are four behaviours
the owner added after watching it work:

- **One ticket per pair.** A pair already carrying a working order or a filled position gets no second ticket.
- **A turned call exits the position.** If the sealed call for that asset flips against the open trade, the position
  is closed by the loop (market order through the bridge), not by the stop.
- **A reached target invalidates a resting entry.** If price reaches the trade's target before the limit is filled,
  the pending order is cancelled rather than left to fill late.
- **The stop takes exactly one rung at 2R.** Once a position has run twice its original risk, the stop moves once and
  no further; there is no trailing stop.

**Caps, read back from the scheduler rather than from a document:** `--confirm-live --max-open 1 --max-per-day 4
--settle-seconds 90 --align`. One open trade at a time across all four pairs, four placements a day, and a 90-second
wait after the candle close so the bar is settled before it is read.

**The loop's memory.** `tmp/live-trading-trader-state.json` holds every placement keyed by the signal bar it came
from, every cancellation, every answered close request, and every stop move. It is what stops the loop placing the
same ticket twice for one bar, or moving a stop twice. As of the last tick: **placements 36, cancellations 4, closes
1, moves 3**.

**What landed today (13:40Z), verbatim from the logs:** the feed ran in 1.1 s, exit 0, wrote `live-trading-feed-v4`,
576 M5 bars per instrument, 1 position open, 10 closed trades in the 14-day window, publish decision `too_soon` ("the
last publish was 297s ago, inside the 600s cadence"). The trader ran in 2.3 s, status `nothing_to_place`: EURUSD
`waiting` (its limit level sits on the far side of the market), XAUUSD `blocked` (position already open), the others
`waiting`; the XAUUSD stop stayed where it was because the market has to reach 4026.14, twice the original risk,
before the one rung is allowed.

**Current exposure (weekend, 2026-10-24).** One position: XAUUSD buy, 0.01 lots, opened 2026-10-23 20:07Z at 3997.55,
stop 3983.25, target 4069.03, floating -4.25 USD. Account: 10,000 USD starting balance, now 10,014.23, equity
10,009.40, leverage 1:30. Three of the four instruments show 60,000-second-old ticks because the market is shut; only
BTCUSD is live.

## 4. Safety design, and what has actually been proven

The owner's rule for this project is that an assertion without an artifact is not evidence, so the system is built
with narrow permissions and every claim below was produced by a run, not by intention.

- **Read cannot send.** The snapshot producer's MT5 function list is an explicit allowlist, and a test fails if any
  order-sending function appears in it. Every snapshot carries `read_only: true`, `order_functions_called: []` and
  `no_order_path: true`.
- **Sending needs two independent keys.** The bridge refuses to place anything without `--confirm-live`; the loop
  refuses to place without `--arm`. A loop started without `--arm` writes a plan and sends nothing - that is how it
  was tested before it was ever armed, and it is the mode the reviewer should assume for any dry run.
- **Wrong-ticket protection.** Orders carry magic `20261004`. The bridge refuses to close, cancel or move a ticket
  that is not on this account or not carrying that magic, so the owner's manual trades are untouchable by the loop.
- **Risk caps inside the tool, not just in the caller.** The bridge refuses a stop on the wrong side of the entry, a
  volume above `--max-lots` or at/under zero, and a new stop the broker's own distance rules would reject - it exits
  non-zero with the reason instead of sending. Sizing itself is the instrument's minimum lot: this is a rule-precision
  project, not yet a risk-managed one, and the owner has not scaled size.
- **Staleness is a first-class state.** A snapshot older than 900 s is stale; the loop refuses to act on a stale
  snapshot, and the dashboard renders the age rather than a silent blank.
- **Test coverage of the live lane:** six suites - feed, feed cadence, feed publish, trader loop, order tool, close
  request - **186 tests, 0 failures**, re-run 2026-10-24 (13 s). They cover, among others, the rule's stages, the
  one-ticket-per-pair and daily caps, the cancellation-on-target, the single 2R stop move, the turned-call exit, the
  close-request freshness window, the publisher's four gates and the 600-second cadence, and the bridge's refusals.
- **No secret is stored in the repository.** The publisher pushes with the machine's own git credential. The trading
  login lives in the terminal, not in code. The Gold research lane's API keys are in a DPAPI-encrypted file bound to
  the Windows user account on that PC.
- **One real incident, recorded honestly.** On 2026-10-16 the owner pressed the dashboard's close link and nothing
  happened. Cause: the confirmation dialog was asked for its "No" button by name, but Windows names that argument by
  position, so the call threw inside a hidden window and the error had nowhere to go - no box, no log line, no close.
  Nothing was sent and no trade was at risk, but the lesson is recorded in the lane notes: every failing path must
  leave a line somewhere. The link now writes its own log and the fix was tested by pressing the real confirmation.

## 5. How it got here (owner-facing timeline)

| Date | What happened |
| --- | --- |
| 2026-09-29 | Lane opened. Read-only feed designed: a producer that attaches to the terminal and publishes a snapshot. |
| 2026-09-30 | Dashboard renders the snapshot for four instruments; the owner's five-minute confirmation rule written down. |
| 2026-10-03 | Snapshot carries two days of M5 candles so the live charts can be dragged back. |
| 2026-10-04 | Level ladder hand-marked by the owner (`data/l2l-levels.json`). |
| 2026-10-05 | The rule finalised in the owner's words (target from the ladder, stop at one fifth). **The owner instructs the agent to arm the loop.** First live tickets placed that day. |
| 2026-10-06..10-22 | Four behaviours added after watching it trade: one ticket per pair, turned-call exit, target-reached cancellation, the single 2R stop move. Charts, closed-trades table, and a "Live Trade Logic" tab that states the rule and is held to the code. |
| 2026-10-16 | Close link failed on its first real press (section 4); fixed and re-tested. |
| 2026-10-23 | The position the account still holds (XAUUSD) was placed by the loop. |
| 2026-10-24 | Owner asks how to keep this running for a week with the PC off, and whether a second FTMO account can be added. |

## 6. Question A - keeping it running with the PC off

**The problem is a session, not a schedule.** Both live tasks are registered under the owner's own Windows account
with logon type **Interactive** (read back from Task Scheduler). An interactive task runs only inside a logged-in
desktop session, and MetaTrader 5 needs a desktop session in any case. So there is no "run as a service" checkbox to
tick here: when the PC sleeps, signs out or is switched off, the loop stops, the feed goes stale, and nothing alerts
the owner beyond a STALE badge on the dashboard.

**Options weighed, and why the current plan is the one that was written up:**

| Option | Verdict |
| --- | --- |
| Windows VPS (Server 2019/2022 with Desktop Experience, or Windows 11 Pro) with autologon | **Current plan.** Runs the exact same binaries, paths, tasks and terminal the system already runs on this PC. |
| A small always-on PC at home (mini PC) reached over RDP | Same Windows requirement, cheaper hardware, but shares the home's power and internet - the failure it is meant to remove. |
| MetaTrader 5's own hosted VPS | Believed unsuitable: that service hosts the terminal and expert advisors. This lane's order path is an external Node/Python process, not an EA. Not verified today. |
| Linux VPS + Wine | Believed fragile: the official `MetaTrader5` Python package is Windows-only. Not attempted. |
| A broker-side REST API | Believed unavailable at FTMO, and MT5 has no supported HTTP trading interface beyond the terminal itself. Not verified today. |

**The written plan** (`docs/live-trading/VPS_BUILD_RUNBOOK.md`, ten sections, prepared 2026-10-24, nothing bought or
built): Windows Server with **Desktop Experience** (Server Core has no desktop and cannot run MT5), 2 vCPU, 4 GB RAM,
60-80 GB SSD, provider datacentre nearest the broker's server; autologon for a dedicated user; the terminal started
with the session with its login saved and `Algo Trading` off; a plain clone of `main` (the loop's code is
byte-identical to production, so no branch is needed); the same two scheduled tasks re-registered on the host; one
git credential scoped to the repository for publishing; the loop's state file copied across; then cutover, then tests.

**The risks in that plan, stated rather than buried:**

- **Two armed loops on one account is the only catastrophic failure.** Two loops can each place their own ticket for
  the same signal bar, doubling risk without anything looking wrong. Cutover is therefore stop-before-start: the PC's
  trader task is removed first, the state file travels, and only then is the host armed.
- **Autologon stores the account password** so the box can come back after a reboot with nobody present. On a
  single-purpose VPS that is a reasonable trade; it is still a credential at rest on the machine.
- **If the host dies while the owner is away,** stops and targets live at the broker, so an open position still has
  its protection, and resting limit orders keep working - but nothing exits on a turned call and nothing cancels a
  resting entry whose target was reached. That is the real exposure of the week away, and it is not fixed by any of
  this: it is only made less likely than leaving the PC on.
- **Provider reboots and maintenance windows** produce freshness gaps, shown as STALE with an age rather than hidden.
- **The fast close link dies with the PC.** It is a per-user protocol handler that runs the loop on *that* machine.
  From the road, closing a position means the page's close-request file, answered on the next tick, valid only while
  the row is under thirty minutes old - so up to five minutes of latency.
- **Cost is unknown**: no provider price has been read. The sizing narrows it to an entry-class Windows VPS with a
  licence.

**How it would be tested** (three layers, in the runbook): A, the six local suites, 186 tests, already green. B, on
the host: a read-only snapshot plus validator, the same six suites, each registration script's own self-test task, a
publisher dry run plus `git push --dry-run` for the credential, the first real publish, and an unarmed tick that must
report a plan and send nothing. C, the ones that answer the actual question: reboot the host with nobody logged in and
watch the feed come back; shut the PC down for 30 minutes and confirm the dashboard stays fresh; a 12-hour unattended
run with a gap check on the feed log; a single-writer check on the account; and a rollback rehearsal.

**What was actually said to the owner** (this is the message that follows this brief): the VPS plan is ready to
execute, roughly 90 minutes once a host exists; a second FTMO account is a second lane rather than a setting; nothing
needs rewriting because the tools take their paths as flags; and whether FTMO permits the same strategy on two accounts
is a broker-rule question, not a code question.

## 7. Question B - adding a second FTMO account

**Why it is not a setting.** MetaTrader 5 is one login per terminal installation. A second account therefore means: a
second terminal installation (its own data folder and platform copy), a second Python bridge attached to that
installation, a second pair of scheduled tasks, a second state file, and a second snapshot artifact. Most of the pieces
already take their paths as arguments, so this is wiring more than engineering:

| Tool | Flags that already exist |
| --- | --- |
| `live-trading-snapshot.py` | `--path` (which terminal installation), `--out`, `--candles`, `--stale-seconds` |
| `run-live-trading-feed.js` | `--out`, `--python`, `--terminal`, `--state`, `--lock` |
| `run-live-trading-trader.js` | `--feed`, `--state`, `--levels`, `--calls`, caps, `--arm` |
| `publish-live-trading-feed.js` | `--feed`, `--state`, `--checkout`, `--min-interval-seconds` |
| `live-trading-order.py` | `--path` (which terminal), `--journal`, `--max-lots` |

**What is hard-coded today, and so needs a decision or a small change:**

- The registration script hard-codes the snapshot path `data\live-trading.json`, so a second lane either runs from its
  own clone in its own folder (then each clone has its own `data\` and `tmp\`, and nothing changes) or needs that path
  parameterised.
- The publisher's default artifact is `data/live-trading.json` in the same repository, and the page fetches exactly one
  file (`script.js`, `liveTradingUrl`). Two accounts in one repository means a second artifact path plus a page change
  (a second tab or section), or a second page/site.
- The order tool's magic number is a constant (`20261004`) with no flag. Across two separate accounts that is harmless.
  If the two lanes ever shared one terminal, however, the loops could not tell each other's tickets apart, so a
  `--magic` flag would be needed first.
- The publisher's 600-second gate and the GitHub Pages build quota are per machine and per repository. Two lanes
  publishing into one repository would fight each other; the simple answer is that the second lane publishes to its own
  path through one queue, or does not publish at all.

**What is genuinely hard is not the code:**

- **FTMO's own terms.** Whether the same automated strategy may run across two of the owner's accounts (copy-trading and
  third-party-automation clauses) has to be read and, ideally, asked of FTMO support. This cannot be assumed either way.
- **It doubles exposure, not diversification.** The same signals at the same size on a second account is two bets on one
  edge. FTMO accounts carry per-account daily-loss and maximum-loss limits, so a bad sequence would threaten both
  accounts at once.
- **If the second account has different rules from this one** - another Challenge, a Verification stage, or a funded
  account - its profit target and drawdown limits differ, and the loop's caps (`--max-open 1`, `--max-per-day 4`) are
  modelled on none of them; they are the owner's risk choice, not the firm's limits.
- **Symbol naming.** The bridge's symbol allowlist is literal (`EURUSD`, `XAUUSD`, `US100.cash`, `BTCUSD`). A different
  FTMO account type with suffixed symbols (`XAUUSD.pro` and the like) would be refused by the tool until the allowlist
  is extended - which is a deliberate safety property, not an oversight.

**The answer given to the owner** was: possible, but it is a second lane - second terminal, second task pair, second
state file, and a dashboard change - not a checkbox; and the FTMO policy question is his to settle before any of it is
built.

## 8. What has NOT been verified (and should not be asserted)

- **No host exists.** No provider, no price, no region, no Windows image has been chosen or read.
- **Two MT5 installations on one Windows host**: believed workable (separate installations, separate IPC endpoints, and
  the Python package accepts an explicit path), but not proven. It must be proven with a read-only snapshot before a
  second lane is armed.
- **FTMO multi-account policy** on the same strategy: unread.
- **Survival of an unattended Windows Update reboot** with autologon: designed for, but the reboot test has not run
  because there is no host.
- **MetaTrader 5's own hosted VPS** and **Linux + Wine**: both rejected on belief, neither tried.
- **Profitability**: nothing in this document is evidence of edge. The account shows balance 10,014.23 against its
  10,000 starting balance after 36 placements, 10 closed trades and one open position. That is noise, not a result, and
  no test here says the rule makes money.
- **Day boundaries**: the loop's `--max-per-day` counts **UTC** days (stated in its own help text), while FTMO measures
  its daily-loss rule on its own trading day, which the FTMO setup record notes is CE(S)T - neither UTC nor the
  terminal's UTC+3 clock. Nothing reconciles the two, and no test covers it.

## 9. What the reviewer is asked to answer

Please answer in plain prose or short bullets, most important first, and **lead with anything you consider unsafe or
plainly wrong** - the owner would rather hear it before spending money. Keep off strategy design: the rule, the ladder
and the caps are the owner's decisions and are not on the table. Do not propose backtests as proof of anything; that
separation is deliberate.

1. **Is the host plan right?** Windows VPS with Desktop Experience, autologon, terminal started with the session, the
   same two interactive scheduled tasks every five minutes, code cloned from `main`. Given that MetaTrader 5 has no
   headless mode and no broker HTTP API, is there a materially better way to keep an MT5-attached Python process alive
   unattended for a week? If not, what would you change in the plan?
2. **What failure modes are missing?** Rank them by risk, and say which are cheap to close. The ones already known and
   accepted are listed in section 6: two-armed-loops (closed by cutover order), autologon credentials at rest,
   host-death-while-away leaving a position without the turned-call exit, provider maintenance gaps, and losing the
   fast close link.
3. **Is the week-away exposure acceptable** for a 10,000 USD FTMO 2-Step Challenge account - an evaluation with a profit
   target, a daily-loss limit, a maximum-loss limit and a minimum number of trading days - given a loop holding at most
   one position at minimum size? If it is not, what is the smallest change that makes it acceptable?
4. **Second account:** should it be done at all, and if so as a mirror of the same signals or as a separate instance
   with its own ladder and caps? What should the owner ask FTMO before building it, and what would you insist be
   proven first (the two-terminal test and the symbol suffix being the two known unknowns)?
5. **Anything about the design that would worry you as an operator**, in particular: the publisher pushing to the same
   branch that serves the dashboard from the same box that trades; a git credential on an always-on box; a single
   Windows user session as the thing that keeps everything alive; a JSON-on-`main` file as the remote close mechanism.
6. **Cost sanity:** roughly what monthly figure should an entry-class Windows VPS with a licence cost in 2026, and is
   that worth it versus an always-on mini PC at home? If you think a different hosting shape is better value, say which
   and why.

If something in sections 1-8 is ambiguous or looks like it contradicts itself, say so - the owner will ask the agent to
prove or correct it, and the answer will be recorded in the repository.

## 10. Glossary, for a reader outside this project

- **Layer 1**: the eight sealed directional agents running in n8n cloud; they publish calls, they never see live results.
- **L2L / level-to-level**: the owner's rule - close beyond a marked level, limit back at the level, target at the next
  marked level, stop at one fifth of the distance.
- **Tick**: one run of one scheduled task. Two tasks run every five minutes, so about 24 runs an hour across them.
- **Armed**: the loop is started with `--arm`, the flag that lets it send. Unarmed, it records what it would have done.
- **MT5 / terminal**: MetaTrader 5, the broker's desktop platform; the Python `MetaTrader5` package attaches to a
  running terminal, it does not log in by itself.
- **FTMO**: the prop firm whose account this is. The account is a **2-Step Challenge**, i.e. an evaluation that must hit
  a profit target without breaching a daily-loss limit, a maximum-loss limit or a minimum number of trading days.
- **PT5M**: the Task Scheduler repetition interval used by both tasks (every five minutes, indefinitely).
- **Prop / funded account**: capital provided by a firm under strict loss limits; a breach ends the account.
- **Pages**: GitHub Pages, which serves the dashboard from the `main` branch of the repository.
- **DPAPI**: Windows' per-user encryption used for the research lane's stored API keys; it does not move between
  machines or user accounts.
