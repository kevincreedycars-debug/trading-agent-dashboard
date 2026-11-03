# One gold trade reviewed: 304775222, 2026-11-03

The first position this lane closed on a changed call rather than on its stop or its target. Written because the
question asked of it - *it closed early and looks like a 1R trade, did the direction close it?* - is answered
entirely by the journal and the run log, and the answer is worth keeping rather than reconstructing.

## What the trade was

| | |
| --- | --- |
| ticket | `304775222`, `XAUUSD`, sell, 0.01 lot - the smallest size the symbol takes |
| opened | 04:07:58Z (06:07:58 server), filled as a limit at `3926.08` |
| the call it was left for | GOLD `BEARISH_LEAN`, sealed `2026-11-02T12:23:05Z`, expiring `2026-11-03T12:23:05Z` |
| stop as placed | `3940.37` - 1R = 14.296 price units, about $14.30 on 0.01 lot |
| target as placed | `3854.59` - the rule's 5R |
| closed | 10:36:31Z at `3902.63` |
| result | `+23.45` gross, `+23.39` net after `-0.06` commission, **1.64R** |
| held | 6h 28m |

## What it did before it closed

The 5-minute reads in `tmp/live-trading-orders.log` are the path, and the best it ever showed was 2.07R:

- 04:11 to 06:31 - ground between `-4.02` and `+8.13`, price between `3930.1` and `3919.91`.
- 07:01 to 08:36 - a steady `+13` to `+19`, price near `3909`.
- **08:56:31** - the stop went to breakeven: `3926.07`, the entry it was placed with. The trigger was `3897.478`, two
  times the 14.296 risk, and it was found in an M5 bar's low rather than in the live quote - `marketHasReached` reads
  the bars from the bar the ticket was placed in, so a touch between two five-minute reads still counts. The trade
  could not lose from this point.
- **09:01:31** - the deepest read, `+29.52` at `3896.56`, which is 2.07R. The target at `3854.59` was still 42
  dollars of price away and was never approached.
- 09:06 to 10:31 - back and forth between `+17` and `+26`.

## Why it closed

At **10:29:45Z** Layer 1 sealed a new GOLD call: `BULLISH_LEAN`. The 10:36:30Z run read it, saw a long call against a
short position, and exited at the market:

> "The call this position was opened for has turned: Layer 1 now reads BULLISH_LEAN for GOLD, a long call against
> this short position, so the user's rule for a changed call is that the position is exited rather than left waiting
> on a direction that is gone."

That reason is `reviewPositions` in `scripts/run-live-trading-trader.js` (the branch at "has turned"), which is the
implementation of the instruction given on 2026-10-06: *"or if the directioncal call changed during the day, if it did
then exit the position."* The close went through the tool's `close`, reached only this lane's own magic `20261004`,
and came back `TRADE_RETCODE_DONE` (`order 304868153`, `request_id 3293745497`). The state file holds it in `closes`,
the journal holds it as the last of the ticket's entries, and both agree on `10:36:31`.

So: **not a stop, not a target, not a close request from the dashboard, and not a hand on the terminal.** The
close-request file published 0 requests that tick and every tick around it, and the terminal's own record shows the
position leaving at a price that is neither its stop nor its target.

## The three questions this raises, and what the code says now

1. **Was it 1R?** No - 1.64R, and it was risk-free from 08:56. The chart's appearance of a small winner comes from
   the exit being seven minutes of price after a 2R high, not from the trade being cut at its entry.
2. **Does a lean count as a changed call?** The code says yes, and it says so for entry as well as exit:
   `lib/l2l_strategy.js` maps `BULLISH_LEAN` to long and `BEARISH_LEAN` to short, so a lean flipping to the opposite
   lean is a change of side. This trade was opened on `BEARISH_LEAN` and closed on `BULLISH_LEAN` - two leans, the
   weaker of the two stated readings, on both ends. If a lean should open a position but not close one, or close one
   only when a full call opposes it, that is a change to `sideForDirection`'s use in `reviewPositions` and it has to
   be stated as a rule rather than inferred, because the same function gates the entries.
3. **Where does the 5R go?** It is the target the trade carries, not the result the rule promises. A call that turns
   before the target is reached ends the trade at the market, which is by design; with a 24-hour call window and
   ATR-sized stops, the realistic outcome is a mix of stops, changed-call exits between 1R and 3R, and the occasional
   target. Anyone reading the 5R geometry as an expectation is reading the placement rather than the rule.

The honest summary of this trade: a good entry, a risk-free second half, and an exit that gave back about 0.4R of a
2.07R best read in exchange for not sitting in a position whose direction had been withdrawn.
