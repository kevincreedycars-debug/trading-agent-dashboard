# The project in plain words

Last updated 2026-09-29. Written for a reader who does not work in this project and does not need to.

## In short

A five-line version of the evening of 29 September 2026, for sharing as plain text:

- We answered a long list of simple yes/no questions about how the trading calls should be judged, and turned two
  answers into rules.
- We checked five written reports one at a time: three went back for small mistakes, two were accepted as
  accurate records.
- We opened two new desks - one for live-trading advice, and seven standby desks for the markets with no
  backtester yet (dollar, euro, Nasdaq, bitcoin, pound, silver, oil).
- We found the automatic helper that queues reports for review had switched itself off, left it alone, and noted
  that twelve reports are waiting.
- Gold was left untouched, nothing was deployed, and nothing was shown to make money.

## What it is

It is a dashboard that watches five markets - the US dollar, the euro, gold, the Nasdaq and bitcoin - and shows
one plain call for each: up or down over the next 24 hours.

The calls come from five separate robots. Each robot reads only its own written rulebook and the newest market
facts, and none of them can see another robot's answer. A second layer reads those five finished calls and adds
one extra call when two markets point in opposite directions. Every market fact is saved first, one snapshot per
refresh, so the same facts can be looked at again later.

## The second half: the laboratory

The laboratory does not make calls. It takes a copy of what was already saved, plus the rulebooks exactly as
they stood, and re-runs the old rules over old dates. Six steps, always in the same order:

1. **Copy.** Take a copy of the saved data and the old rules. Nothing live is touched.
2. **Rebuild.** Rebuild the exact facts a robot saw at that moment, and say honestly where a fact was missing.
3. **Replay.** Run the old rules again, one market at a time. A replay only counts once it reproduces what the
   live run actually did on that date.
4. **Score.** Check what the price really did over the next 24 hours. A call only counts as right if the move
   beat the market's ordinary noise.
5. **Check.** An automatic checker must pass with nothing missing, and whatever it could not cover is written
   down next to the result instead of being smoothed over.
6. **Publish.** Save the result as a fixed, dated file that cannot change quietly, beside the page that shows it.

## The rules that keep it honest

- Research only ever reads from the live side. Nothing the laboratory does can change a live call, a saved row
  or a live workflow.
- Nothing is changed because it seems like a good idea. Every change has to answer three questions: what
  evidence supports it, how much better does it make things, and does the improvement reproduce over years of
  data.
- A test passing on this machine is not proof that anything live changed, and a result being accepted into the
  record is not proof that it is accurate, correctly timed or profitable.
- Some dates are sealed on purpose and are not opened early, however tempting.

## How the work gets done

One person, several AI workers, and a written protocol between them.

Each worker gets its own desk: its own window, its own copy of the project, one job at a time, and a written
boundary of what it may and may not touch. Work is handed over through a mailbox rather than by chat: the worker
sends a short report, the claim is checked against the actual files, and a reply is written that either accepts
it, asks for changes, or sends it back. Every handover is logged, so what was claimed can be compared with what
the files say. The person in charge answers the open questions and authorises each next step.

## What happened on the evening of 29 September 2026

- The strategy desk spent the evening working through one long list of plain yes/no questions, answered in
  batches. The point of the list is to turn vague preferences into written rules before anything is built.
- Two answers became rules: a call only matters if price moves at least 0.80% in the called direction during the
  24-hour session, and the long and short sides are sized equally (1.00). The desk also showed that a fixed
  0.8% behaves differently every year on gold, while the same distance measured against gold's own daily range
  stays steady - a useful thing to know before spending money on it.
- Replies were capped at three short bullets, because the long reports were not being read.
- Five reports were reviewed, one at a time. Three were sent back for small documentation mistakes and two were
  accepted. Acceptance means the numbers in the report match the files - nothing more.
- Two new desks were opened: one for live-trading advice, and seven standby desks for the markets that do not
  have their own backtester yet (the dollar, the euro, the Nasdaq, bitcoin, the pound, silver and oil). The
  standby desks may only read and write down where each market stands. No backtester was built.
- The automatic helper that picks up the next report to review was found switched off, and was left as it was
  rather than prodded. Twelve reports are now waiting in the queue.
- Gold was left alone on purpose, including its sealed dates.

## What that evening does not mean

Nothing was proven to work, nothing was deployed, no live rule was changed, and no money was risked or tested.
Seven standby desks are not seven backtesters, and a written report is not a working system.

## Where to look

- The live picture and the research picture side by side:
  https://kevincreedycars-debug.github.io/trading-agent-dashboard/backtest-flow.html
- The gold evidence pages, same address with these names: `gold-backtesting.html`,
  `gold-backtest-outcomes.html` and `gold-direction-scorecard.html`.
- The gold factor draft, the page being written now, labelled as a draft in the menu:
  https://kevincreedycars-debug.github.io/trading-agent-dashboard/gold-factor-wip.html
- The project's own record: `docs/SESSION_NOTES.md` (what happened, dated) and `docs/CHANGELOG.md` (what was
  completed, with the detail).
