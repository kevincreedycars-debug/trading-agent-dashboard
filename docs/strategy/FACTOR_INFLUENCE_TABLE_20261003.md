# What actually moves the gold price: the plain table the user wants

Advisory note by worker `strategy` (`strategy-advisory-001`), 2026-10-03 (second note the same day), at the user's
instruction this turn, verbatim: *"no please see my requirements for the tbale I actually want, none of these so far
are what I need, a simple table that clearly explains what factors influence price."* His two other sentences in the
same turn: *"I cant see anywhere this 28 factors table?"* and *"the current 4 tabs done show me what im looking
for."* The third of the four points he answered this turn was *"Dont understand the question just use your logic"*,
so the defaults this note rests on are listed in section 8 rather than held open.

## 1. What changed today, and what this file replaces

Earlier today this lane wrote `docs/strategy/FACTOR_TABLE_SPEC_20261003.md`. That file specifies a **measurement**:
whether gold travels further or less than usual while a factor state is on, printed as the share of days clearing half
L2L and full L2L, on the 1/2/3/5-session ladder. He has now read all four live tabs and says none of them is what he
needs. That measurement is still something he asked for in his own words (*"we want to see direction, l2l and 0.5l2l
data always"*), its lane is already published, and the spec stays on record for it - but it is no longer the table he
is waiting for.

The table he is waiting for is an **explanation, not a measurement**: a short table that says, factor by factor, what
the factor is, which way it pushes gold, why, and how big a part of the picture it is. Every part of that is already
written down in this repository. It needs no research window, no measurement run, no new data and no credentials.

## 2. The one sentence the table has to answer

*"Which things influence the gold price, which way, and how much?"* - answered for a reader who has never opened a
research page and does not want to.

## 3. The table, drafted so it can be checked rather than imagined

Ten rows, one per declared factor, in plain words. The weights are the system's own declared weights from
`logic/agent_gold_direction.md` (they add to 100); the direction rules are that document's own rules.

| Factor | What it is, in one line | Which way it moves gold | Why | Weight |
| --- | --- | --- | --- | ---: |
| Real interest rates | The return on 10-year US government bonds once inflation is taken out | Rising more than 5 basis points -> gold down; falling more than 5 -> gold up | Gold pays no interest, so higher real yields make holding it costlier | 22 |
| The US dollar | How strong the dollar is against a basket of other currencies | Dollar up more than 0.30% -> gold down; down more than 0.30% -> gold up | Gold is priced in dollars, so a stronger dollar makes it dearer for everyone else | 18 |
| Fed stance | Whether the Federal Reserve is leaning towards tightening or easing | More hawkish -> gold down; more dovish -> gold up | Fed policy drives real yields and how much money is around | 14 |
| Two-year US yield | The interest rate the market expects from the Fed over the next two years | Up more than 5 basis points -> gold down; down more than 5 -> gold up | It is the market's own bet on policy, and it moves real yields | 8 |
| Gold's own recent move | What gold has already done over the last day to month | Strongly up -> gold up; strongly down -> gold down | Confirmation only: the system never lets it outrank the macro rows above | 8 |
| Market fear (VIX) | How much US share-price volatility the market is pricing | Above 25 -> gold up; below 16 -> gold down; in between, neutral | Gold gets bought when investors are frightened | 10 |
| US data surprises | Whether this week's US releases came in above or below expectations | Stronger than expected -> gold down; weaker -> gold up | Strong data raises the odds of a more hawkish Fed; weak data raises the odds of cuts | 6 |
| Inflation news | Whether inflation is running hot or cooling | Hot inflation while cuts are expected -> gold up; cooling -> gold down | Gold is often bought as protection against inflation | 6 |
| Safe-haven demand | Wars, financial accidents and other stress headlines | Stress -> gold up; calm -> neutral; it is never allowed to say down | Money runs to gold in a crisis | 6 |
| Liquidity and growth | Whether money is being added to the system or withdrawn | Expanding -> gold up; contracting -> gold down | More money in the system tends to lift hard assets | 2 |

How the weight is meant to read: the top four rows are the system's own "primary drivers"; when they disagree the
system lowers its confidence, and when they agree it raises it. The weight is the share of the picture, not a
probability and not a forecast.

## 4. Where the number 28 comes from, and what it is

The "28" is the declared set of readings the gold agent is allowed to read, not 28 separate ideas. It is held in
`backtester/lib/gold_source_readiness.js` as the constant `GOLD_VARIABLES` and declared in
`backtester/registries/gold_variable_horizon_context.v1.json` with `declared_count: 28`, whose own derivation line
says: *"Ten weighted Layer 1 factors (F1-F10) plus explicit event decomposition. Twenty of the twenty-eight entries are
levels or transformations of five macro/price series; they are not twenty independent raw inputs."*

Under the ten rows of section 3 the readings sit like this (labels as the registry carries them):

- **Real interest rates (3):** US 10-year real yield; its five-observation change; its twenty-observation change.
- **The US dollar (4):** dollar index level; one-day change; five-day change; twenty-day change.
- **Fed stance (1):** Fed policy bias.
- **Two-year US yield (3):** the yield; its five-observation change; its twenty-observation change.
- **Gold's own move (4):** gold price; one-day, five-day and twenty-day percentage change.
- **Market fear (3):** VIX level; one-observation change; five-observation change.
- **US data surprises (6):** event family; released value; pre-release consensus; previous value as first released;
  the surprise itself; hours since the release.
- **Inflation news (1):** inflation signal.
- **Safe-haven demand (1):** risk headline context.
- **Liquidity and growth (2):** equities regime; growth regime.

One honest caveat travels with the dollar row: the series the live agent reads for it is FRED `DTWEXBGS`, a broad
trade-weighted dollar index rather than the classic ICE DXY (`backtester/docs/historical_collector_handoff.md` maps
`DTWEXBGS` to `dxy_level`; `backtester/docs/usd_historical_data_acquisition_plan.md` records that it is not classic
ICE DXY). The row says "how strong the dollar is" rather than naming a contract.

## 5. What the archive has actually shown about these directions

Stated plainly on the page, because a table of directions invites the reading that they are proven, and they are not:

- The direction rules are the agent's **declared expectations** from `logic/agent_gold_direction.md`, written by the
  system, not findings from the data.
- The archive has been scored against them and returned no usable direction. The live Direction tab's own embedded
  summary reads: 25 states scored on the session with all 25 verdicts `no_information`; 24 `no_information` on the
  week with one `unstable_across_years`; and exactly one session row at or above the interest threshold - the same
  row this lane has already reported as sitting at the noise floor (about two and a half rows would reach that level
  by chance across the rows tested).
- So a row may carry one short line saying what the archive showed and pointing at the Direction tab. It must never
  print a strength, hit rate or rank that has not been published, and it must never be read as advice.

## 6. Where it goes on the dashboard, and who builds it

On the live **Gold** page, as a new **first** tab named, by default, **What moves gold** - because it is the page a
reader wants before the four that are there now. The four existing tabs (Direction, Backtest evidence, 28-factor
outcomes, Factor tables (draft)) stay exactly as they are, after it. The dashboard lane owns the page build and the
page's bar-and-rail generator; this file is the check target. Cost: markup only, built from the logic document and
the already-published censuses. No new data, no provider call, no credential, no measurement, no publish of anything
that is not already accepted.

## 7. What this table is not

Not a forecast, a pick, a ranking, a score out of 100, a signal or a trading result. It does not claim any direction
row "works", it does not replace the Direction tab's measured verdict, and it does not re-open any question the user
has already closed. It answers "what influences the price", and nothing beyond it.

## 8. The defaults used this turn (his "just use your logic")

1. **Tab name and place:** "What moves gold", first in the Gold page's strip. Reason: it is the explanation, and the
   four existing tabs are the evidence behind it.
2. **The 28 readings:** listed under the ten rows as a second, collapsed table. Reason: he has asked twice where the
   28 are, and this accounts for the number without turning the main table into a list.
3. **One "what the archive showed" line per row**, pointing at the Direction tab. Reason: it keeps the page honest
   and costs one line.
4. **Weights printed**, labelled as the system's declared weights out of 100. Reason: it is what makes "how much"
   answerable in one glance.
5. **A one-line plain statement at the top** that the directions are the system's expectations, not proven results.
   Reason: no reader should have to infer it.

Any of these can be changed by one word from him; none of them blocks the build.

## 9. Where the table he could not find actually is (measured this turn, over HTTPS)

- **The 28-factor table is live and reachable**:
  `https://kevincreedycars-debug.github.io/trading-agent-dashboard/gold-backtest-outcomes.html` answers HTTP 200 at
  27,841 bytes, title "Gold 28-Factor Outcomes - Research only", and it is the third tab of the Gold page. It is a
  **census** - its first table is "Declared before anything was evaluated" and its sections explain how many
  observations there were and why candidates did not qualify - so it answers "was this tested and why did nothing
  qualify", not "what influences the price". That is the gap this note fills.
- **The draft tab** `.../gold-factor-wip.html` answers HTTP 200 at 33,053 bytes, title "Gold factor work in progress
  (draft)"; it still reads "50 of 50" and carries no factor-by-factor numbers, because the measurement it waits for
  has not run.
- **The four tabs as served**, with byte counts: Direction -> `gold-direction-scorecard.html` 151,757 bytes ("Gold
  factor direction scorecard - Research only"); Backtest evidence -> `gold-backtesting.html` 300,925 bytes; 28-factor
  outcomes -> `gold-backtest-outcomes.html` 27,841 bytes; Factor tables (draft) -> `gold-factor-wip.html` 33,053
  bytes. The Gold page itself, `gold.html`, is 14,388 bytes and frames those four in that order.
- The one link to hand him in plain words: **the Gold page**, third tab **28-factor outcomes**. The new table of
  section 3 would sit in its own tab ahead of those four on the same page.

## 10. Provenance and limits of this note

Read this turn, canonical checkout, read-only: `logic/agent_gold_direction.md` (weights table at section 4 and the
ten factor rule blocks), `backtester/lib/gold_source_readiness.js` (`GOLD_VARIABLES`, 28 names),
`backtester/registries/gold_variable_horizon_context.v1.json` (28 declared entries with labels and factor mappings),
`backtester/docs/historical_collector_handoff.md` and `backtester/docs/usd_historical_data_acquisition_plan.md` (the
dollar mapping and its caveat), the `origin/main` blobs of the five gold pages and `index.html`, the live pages over
HTTPS with byte counts and titles, and this lane's own notes and filings.

Limits: this is advisory. It writes down a table shape and the facts behind it; it does not build, publish or edit
any page, and it does not claim that the directions in section 3 are true - section 5 says the opposite in plain
words. The weight column is the system's declared weight, not a measured importance.
