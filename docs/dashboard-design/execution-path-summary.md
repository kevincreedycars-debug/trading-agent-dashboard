# Execution path summary: junction, terminal, two lanes, conditional payout

2026-11-15 · public summary used by the Architecture map's execution stations · presentation only

This page is the public-safe description of what happens after the Layer 2 junction. It is written for a visitor
reading the Architecture map, so it names the code and the geometry and deliberately leaves out everything that
would describe a machine, an account or a deployment.

## The chain

1. **The junction** emits BUY or SELL on one pair, with the lower of the two Layer 1 confidences, or it emits no trade
   at all. `backtester/lib/layer2_pair_logic.js` is the rule; `docs/CALL_MAP_LAYER2_20261004.md` is the call map.
2. **The execution terminal** runs outside the browser on a private host. It reads the pair output, the marked level
   ladder and the M5 bars, and places and manages the bracket. This dashboard never reads it and has no control over
   it: the Architecture map is an illustration of a route, not a remote control.
3. **Lane 1** trades the marked ladder as it stands. The target is the next marked level and the stop is set so the
   reward is five times the risk - `REWARD_R_MULTIPLE = 5` in `lib/l2l_strategy.js`.
4. **Lane 2** trades the same rule on a half grid, with one midpoint inserted between every pair of marked levels. The
   target is nearer, so the geometry is three to one - `HALF_LANE_R_MULTIPLE = 3` in the same file.
5. **An approved payout** is the only route by which account profit could leave a trading account. The step is dotted
   on the map because it is conditional, and it is not automated by this repository.
6. **A personal account marker** ends the illustration. It is not a component of the system and nothing on the page
   connects to it.

## What the committed code fixes, and what it does not

The two geometries are constants, not preferences: 5R on the full ladder and 3R on the half grid. Position size is a
percentage of the running balance at the moment an order fills, in `lib/l2l_sizing.js`, not of the starting balance.
The level store in `lib/l2l_levels_store.js` holds the marked ladder that both lanes read. One shared bridge serves two
independent accounts: each lane carries its own identifier and never reads the other account's position.

Nothing in the repository fixes lane performance, a payout schedule, a transfer rule or a banking instruction. No
stored performance figure is shown on the map, and none is claimed here.

## What this summary leaves out, on purpose

The repository also carries operator material for the host and the accounts: an access handoff, a host
specification, a lane runbook and a broker account-terms guide. Those documents name a host, an address, login
references and deployment steps. They are operational configuration, so the Architecture map's inspector does not
link them and this summary does not restate them. What the map links instead is the code that decides the orders and
the public documents that describe the geometry.

## Sources

- `lib/l2l_strategy.js` - the two reward multiples and the bracket geometry.
- `lib/l2l_sizing.js` - the sizing rule.
- `lib/l2l_ladder.js`, `lib/l2l_levels_store.js` - the level ladder and its store.
- `backtester/lib/layer2_pair_logic.js` - the join that produces the pair output.
- `docs/CALL_MAP_LAYER2_20261004.md` - the Layer 2 call map.

## What this page does not claim

It does not claim a trading edge, a live result or a payout. It describes an implemented route; the validation gate
in the Architecture map records that a passing replay is not proof of live deployment, of causal feature timing or of
a trading edge.
