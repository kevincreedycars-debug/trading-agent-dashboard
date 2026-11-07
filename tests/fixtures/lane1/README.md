# Lane 1 baseline fixtures

A fixed snapshot of lane 1's own artifacts, read at one instant, so any change made for the second account can
be shown not to have moved lane 1.

- `calls.json`, `levels.json`, `feed.json` - the four instruments, the whole marked ladder and the two open
  positions, taken from `data/layer1.json`, `data/l2l-levels.json` and `data/live-trading.json` by
  `scripts/capture-lane1-baseline-fixtures.js`. Tickets are fixture numbers (810001, 810002); balance, equity,
  profit and swap are fixed at 10000/0 so the fixtures carry no account money. No login beyond the published
  mask `***614`, no company, no history, no closed trades.
- `clock.json` - the instant every fixture is read at: the close of the newest M5 bar the feed fixture carries,
  never the wall clock.
- `readings.golden.json` - `lib/l2l_strategy.js`'s reading of those three artifacts, every stage, ticket and
  sentence included.
- `run.golden.json` - one `runOnce` of `scripts/run-live-trading-trader.js` against the same artifacts with a
  stubbed order bridge, every decision, placement and tool argument included.

`tests/live_trading_lane1_baseline.test.js` compares the live code to the goldens. Regenerate them only when the
change to lane 1 is the point, with `LANE1_GOLDEN=write node --test tests/live_trading_lane1_baseline.test.js`,
and treat the regenerated diff as a review item rather than a fixed test.
