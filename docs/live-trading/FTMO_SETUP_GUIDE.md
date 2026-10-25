# FTMO purchase and setup guide

Assignment `live-trading-001`. First written 2026-09-30.
Companion documents: [STRATEGY_LIVE.md](STRATEGY_LIVE.md), [CONVERSATION_NOTES.md](CONVERSATION_NOTES.md).

Status: **the FTMO account is bought and the read-only link is proven**. The Challenge account was
purchased and the FTMO terminal is installed, logged in and connected; the read-only probe attached to
it on 2026-09-30 and recorded the server, the exact symbol names, contract specs and M5 candles. No
credential was read, requested or stored, and **no order path exists** - no order function has ever
been called.

## 1. Decisions locked on 2026-09-30

| Decision | Value |
| --- | --- |
| Account | FTMO, 2-Step Challenge, **$10,000**, one login, one terminal |
| Account type | **Swing** where FTMO still offers it, otherwise the standard 2-Step account |
| Platform | MetaTrader 5 desktop, its own installation, `/portable` (confirmed 2026-09-30) |
| Instruments | the four main pairs only: EUR/USD, XAU/USD, NQ/USD, BTC/USD |
| Signal sources | Layer 2 pair trade, or a Layer 1 call taken on its own when Layer 2 is not active |
| Precedence | **Layer 2 overrides Layer 1 per instrument**: one position per instrument, never both |
| L2L levels | marked by the user on the MT5 charts inside the dashboard, then encoded here |
| Entry trigger | **5-minute candle close** above (long) or below (short) the L2L level; a wick through it is not a trigger |
| Published chart cadence | **5 minutes** - the same interval as the confirming candle |
| Chart view | published on the live site in its own section (user-authorised 2026-09-30) |
| Record keeping | every evaluated signal logged, plus a win-rate summary table |

## 2. Step 1 - what to buy (user)

1. Open `ftmo.com`, create an account, verify the email.
2. Choose **FTMO Challenge, 2-Step**, account size **$10,000**.
3. Choose the **Swing** account type if the checkout still offers it. Same objectives, but it is
   the type that is allowed to hold over a weekend and trade around news once funded. If FTMO has
   merged the types, take the standard $10k 2-Step and we build the Friday close-out anyway.
4. Platform: **MetaTrader 5**. Currency: USD.
5. Pay, then open the **FTMO Client Area**. The Challenge account there shows a login number, a
   password and a server name (for example `FTMO-Server3`). Those are the phase-1 live MT5
   credentials, and **they are also the demo-side credentials used for our build and break tests**.
   Our account turned out to be on server **`FTMO-Server`** (read-only probe, 2026-09-30).
6. Confirmed at checkout on 2026-09-30: FTMO Challenge **2-Step**, **$10,000**, **USD**,
   **MetaTrader 5**, account type **FTMO Swing**, £85.70 including VAT. This matches every locked
   decision above.

Two clocks start the moment the credentials exist. The phase must be **activated by opening a position
within 30 calendar days** (Terms 5.8.4), otherwise access is suspended and can only be renewed within
six months. And the **14-day withdrawal right ends the moment that first position is opened**
(Terms 12.1), so the first order placed on the Challenge account must be a rehearsed one - rehearsals
belong on a separate demo inside the same terminal.

Objectives to be aware of, as read from FTMO on 2026-09-30: 10% profit target in Challenge, 5% in
Verification, 5% maximum daily loss, 10% maximum loss, and a **Minimum Trading Days rule of four
trading days per phase** (a trading day is any day where at least one position is opened, measured
00:00:00 to 23:59:59 CE(S)T). The objectives live on FTMO's website rather than in the Terms and can
change; the clauses that set our dates and constrain the design are in section 8.

## 3. Step 2 - FTMO side, before any software (user, guided)

- Never let another bot or EA trade this login. One login has one daily-loss limit and one max-loss
  limit, and a second bot stacks risk into them invisibly.
- Never hold opposite positions on the same symbol across FTMO accounts you control.
- Expect **new credentials for every phase**. The day the Challenge is passed, the old login stops
  working. The bridge refuses on a login mismatch, which is exactly what turns that into an alert
  instead of silence.

## 4. Step 3 - MT5 installation (user, guided)

1. Install FTMO's MT5 once. For every further account, copy the whole program folder and launch the
   copy's `terminal64.exe` with `/portable`; do not run the installer twice.
2. File > Login to Trade Account, enter the FTMO login, tick **Save password**.
3. Turn on Algo Trading, and Tools > Options > Expert Advisors > **Allow algorithmic trading**.
   With it off every order is rejected.
4. Add every symbol we trade to Market Watch, using FTMO's exact names (the Nasdaq is `US100.cash`).
5. Leave the terminal open and the machine awake during market hours. MT5 has no headless mode and
   must run in a logged-in desktop session. The sleep setting lives at **Settings > System > Power &
   battery > Screen and sleep** on Windows 11 ("Power & sleep" on Windows 10): set *When plugged in,
   put my device to sleep after* to **Never**. The screen turning itself off is harmless; only sleep
   stops the terminal. The command-line equivalent is `powercfg /change standby-timeout-ac 0`
   (add `-hibernate-timeout-ac 0` for hibernate).

### Verifying the Python link (checked 2026-09-30)

- The Python side is ready: `MetaTrader5` **5.0.6231** is installed for the system Python 3.13.7 on
  this PC. It was smoke-tested with a deliberately wrong path and failed cleanly
  (`IPC initialize failed, Process create failed`), which proves the package loads without starting
  any terminal.
- The read-only probe is `tmp/mt5-connection-probe.py` (scratch folder, Git-ignored: it is a tool, not
  a deliverable). Run it from the worktree root, either with no argument to attach to the terminal
  the package last used, or with an explicit path:
  `python tmp/mt5-connection-probe.py --path "C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe"`
- The `--path` argument takes either the **`terminal64.exe` file or the folder that contains it** (a
  folder is resolved to its `terminal64.exe`). A path with no `terminal64.exe` under it fails with
  `IPC initialize failed, Process create failed`; the folder path used to fail the same way before the
  fix.
- It reports the terminal build, the account's server and masked login, the exact symbol names found
  for each of our four instruments, their contract specs, live bid/ask, the last few **M5 candles**
  and the open position and order counts, and writes the same to
  `tmp/mt5-connection-probe-output.json`. **It calls no order function at all.**
- Two things to know about the mechanism. The Python package **attaches to a running, already-logged-in
  terminal**; it cannot log in for you, so MT5 has to be open in this desktop session. And symbol
  names are served by the broker, so `US100.cash` for example can only be confirmed from an actual
  FTMO login - a demo on another server will show different names.

### First live evidence, 2026-09-30 13:23 UTC

- Terminal `FTMO Global Markets MT5 Terminal`, build **6231**, `connected: true`, `trade_allowed: true`,
  `tradeapi_disabled: false`. The terminal was already logged in; the package only attached to it.
- Account `***614` on server **`FTMO-Server`** (FTMO Global Markets Ltd), currency **USD**, leverage
  **1:30** (the Swing leverage), balance and equity **$10,000.00**, **0 positions, 0 open orders**.
- **166 symbols** are served. All four instruments exist under plain names **with no suffix**:
  `EURUSD`, `XAUUSD` (our "gold" - there is no `GOLD` symbol), `US100.cash`, `BTCUSD`.
- Contract specs as served, all four `trade_mode: 4` (full trading) and `stops_level: 0` (no minimum
  stop distance, so our tight stops are legal):

  | Symbol | Description | Digits | Contract size | Tick value | Min / max lot | Spread seen |
  | --- | --- | --- | --- | --- | --- | --- |
  | `EURUSD` | Forex | 5 | 100,000 | $1.00 | 0.01 / 50 | 1 point |
  | `XAUUSD` | Spot CFD, Metals CFD | 2 | 100 | $1.00 | 0.01 / 100 | 41 points |
  | `US100.cash` | Spot CFD, NASDAQ 100 | 2 | 1 | $0.01 | 0.01 / 1,000 | 195 points |
  | `BTCUSD` | Spot CFD, Crypto I CFD | 2 | 1 | $0.01 | 0.01 / 5 | 100 points |

- **The FTMO server clock runs at UTC+3**, measured by the probe as `server_offset_seconds: 10800`
  (server 16:25 while real UTC was 13:25). MT5 timestamps are server-clock, so the probe was corrected
  to write every time **twice**: `time_server` and the converted `time_utc`. Still to settle: FTMO
  measures its trading day 00:00:00-23:59:59 **CE(S)T**, which is neither the terminal's UTC+3 nor UTC,
  so the daily-loss and minimum-trading-day logic must use FTMO's boundary explicitly rather than any
  raw MT5 timestamp.
- Full record, Git-ignored scratch: `tmp/mt5-connection-probe-output.json`.

## 5. Step 4 - how the credentials reach the bot (never a chat paste)

Repository rule: credentials only ever reach a process through the documented scoped
encrypted-credential runner, and an MT5 scope is a separate **user-authorised** manifest change.
Do not paste the login, password, server name or any bridge token into chat, a document or Git.
When we reach that step the order of work is: add an `mt5` scope to
`config/credential-manifest.json` with your approval, store the values through the runner, then let
the bridge read them from its own config file outside Git.

## 6. Step 5 - what has to be true before the bridge is started

- One Windows machine that stays on, logged in, with the FTMO terminal running. **Decided
  2026-09-30: this PC.** Consequences accepted with that choice: sleep and Windows Update restarts
  must be controlled during the trading week, the session must be logged in for the terminal to run,
  and nothing trades while the PC is off.
- The read-only bridge first: `/health`, account information, positions, deals, prices and candles.
  No order code armed.
- The dashboard charts in their own site section, which is a production publication from `main` and
  therefore a separate authorised release step.

## 7. Order of work from here

1. Buy the account, complete Steps 2 and 3 above. **Done 2026-09-30.**
2. **Connection first (current focus, 2026-09-30).** Attach the read-only probe to the FTMO terminal
   and record the server name, exact symbol names, contract specs and a set of M5 candles. Rules,
   level encoding and the order path are deliberately not part of this step.
   **Done 2026-09-30**: all four symbols confirmed unsuffixed, specs and candles captured, no order
   function called. Section 4 holds the evidence.
3. Read-only bridge, health and reads verified against the FTMO terminal.
4. MT5 charts published in the dashboard's own section; user marks the L2L levels.
5. Levels encoded as entry, stop and target; the trade-log and win-rate tables built.
6. Demo-side orders, then the deliberate break tests, then - separately authorised - the Challenge.

## 8. Terms and Conditions read in full, 2026-09-30

The FTMO Challenge Terms and Conditions (last updated 2026-08-04) were read in full, and the pages
they point at were fetched where reachable. This is an operator's reading of the clauses that change
what we build. It is not legal advice.

### Clock and money clauses that set our dates

| Clause | Rule | Consequence here |
| --- | --- | --- |
| 3.2 | the Options chosen at checkout are fixed for that Order | Swing / 2-Step / $10k / USD / MT5 has to be right at payment |
| 3.12, 12.1 | no refunds, and the 14-day withdrawal right ends the moment the first simulated trade is opened | the money-back window closes at the first order on the Challenge account |
| 5.8.4 | a phase must be activated by opening a trade within 30 calendar days of being made available, else suspended; renewal within 6 months or the Agreement is terminated with no refund | credentials in early October means a first trade by roughly the end of October |
| 13.2.3 | 30 consecutive days with no trade, or a loss between 8% and 10% held longer than 30 days, are grounds for termination | an idle bot is not a neutral bot |
| 5.8.6 | a phase will not be evaluated until all simulated trades **and pending orders** are closed | the bridge needs one explicit "close everything, cancel all orders" control, used at the end of every phase |
| 5.8.5(c), 6.3 | aggregate Initial Simulated Capital across our accounts and FTMO-group accounts is capped at USD 400,000, counted per client, per strategy, per ultimate beneficial owner | one $10k account, not a ladder of them |
| 19.1 | the registered email address cannot be changed | register with an address that will still exist in a year |

### Clauses that constrain the automated design

- **7.2 personal use.** No third party may access the account or its data, and no third party may
  perform simulated trades for the holder or in coordination with them. Our bot is the holder's own
  local software driven by their own terminal; the credentials are typed into MT5 and nowhere else.
  Nothing is shared, delegated or sold, and the bridge never holds a login. This is the same reason
  the login must never appear in chat, a document or Git.
- **7.5 Risk Management Rules.** No substantially larger position than the account's other trades, no
  substantially different number of positions, and no repeated build-up of exposure in one symbol or
  in correlated symbols. All four of our instruments are quoted in USD against a USD account, so one
  day's basket is one correlated idea. Sizing has to keep four simultaneous stops far below the 5%
  daily loss limit.
- **7.6** FTMO may cancel trades, reduce leverage, impose a Risk per Trade Idea cap, or terminate,
  at their discretion, with no compensation and no refund. The test is their judgement, so the
  design has to be explainable rather than merely inside the letter of the rules.
- **9.4.6** no automated means of viewing, displaying or collecting information from FTMO's Website,
  Services or Content. We do not scrape ftmo.com, the Client Area or their charts. The dashboard
  reads only our own published feed, and the trading side uses the platform vendor's own Python API
  against the locally installed terminal.
- **10.2.4, 4.9** the Trading Platform and its data are third-party; FTMO is not liable for platform
  faults or data inaccuracies.

### Still to verify with FTMO before the first automated order

1. A first-party statement that automated trading is permitted on Challenge and FTMO accounts.
   Nothing read so far prohibits it - the Terms prohibit third-party human access, abusive practices
   and non-genuine risk management - but it was not found in the affirmative either. Ask support in
   writing and keep the reply.
2. Whether Swing accounts may trade around news during the Evaluation Process.
3. Leverage and margin for the four instruments, read from the terminal rather than assumed; the
   probe reports them.
4. **Asked, not yet answered - and the loop was armed anyway on the user's instruction, 2026-10-05.** The automatic
   placement path in `scripts/run-live-trading-trader.js` places a confirmed row's limit on the Challenge account
   `***614` at the instrument's own minimum size, with item 1 above still open. Section 39 of
   [STRATEGY_LIVE.md](STRATEGY_LIVE.md) records the decision and the reasoning; the answer, when it comes, is what
   decides whether the cadence stays armed. Asked again after the first ticket had been placed and read back, the user
   said to keep the cadence armed and to leave the size at the instrument's minimum until different instructions: so
   the cadence runs, unarmed runs still send nothing, and the only size it will ever ask for is the symbol's own
   `volume_min` - 0.01 lot on the four instruments, about six US cents of risk on the ticket below - until the user
   says otherwise in writing.

### Facts read from FTMO, 2026-09-30

- Objectives, subject to change by FTMO: 10% profit target in the Challenge phase, 5% in
  Verification, 5% maximum daily loss, 10% maximum loss, 4 minimum trading days per phase. A trading
  day is any day measured 00:00:00 to 23:59:59 CE(S)T on which at least one position is opened.
- Weekend and overnight holding, quoted: "Overnight and weekend position restrictions apply only to
  the Standard account type. The Swing account type does not have any restrictions on holding
  positions overnight or over the weekend... they do not apply during the Evaluation Process." So
  Swing starts to matter only once the funded FTMO Account exists.
- Account-type modification from Standard to Swing is offered for the 2-Step and not for the 1-Step.
- Currency conversion adjustment: a flat 0.7% applies to realised profit and loss when the position's
  P&L currency differs from the account currency. All four instruments are USD-quoted on a USD
  account, so it should not apply to us.
- Liability is capped at the Challenge Fee (10.3); the services are unregulated (2.1) and the terms
  are governed by Czech law (18.1).
