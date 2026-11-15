# Replay libraries: what sits under each chamber

2026-11-15 · public summary for the Architecture map's document libraries · presentation only

Each replay chamber on the Architecture map has an **Explore test library** control. Selecting it moves the camera
under the chamber, keeps the chamber in frame above, and opens five document groups in the order a visitor would
investigate a test:

1. **Research and adjudication** - what was investigated, attacked and settled before a rule was written.
2. **Model and decision rules** - the book the engine computes and the code that applies it.
3. **Historical inputs** - what the replay feeds the model, and where those rows were built.
4. **Replay and validation checks** - the runner, its scoring code and the shared rules it follows.
5. **Results** - the artefact a run left behind, or the named gap that says there is none.

Every document states its title, the model or test it belongs to, the question it answers and its committed path.
A document is tagged **used by the replay** only when the run reads it - the logic document, the frozen rulebook,
the builder, the runner, the replay core, the level ladder, the artefacts. Research prompts, handoff packs, the
catalogue and the summaries are tagged **related research**, because the replay does not read them.

## The USD chamber: four tests, reported separately

The USD library exposes the four tests one at a time. Each states its market, its logic, the data it needs and the
artefact it writes:

| Test | Market | Status in the artefact |
| --- | --- | --- |
| T1 USD direction | DXY cash, official close | Official lane **blocked**: no licensed ICE cash history in this checkout. A named broker CFD lane is scored instead. |
| T2 Four markets | EUR/USD, XAU/USD, NAS100, BTC/USD | **Scored**: per-market counts, flat bands and confidence bands recorded. |
| T3 Original ladder at 5R | The same four markets | **Blocked for all four**: no M5 tape and no ladder archived before the setup. A two-day execution demo is kept separate and labelled. |
| T4 Half grid at 3R | The same four markets | **Blocked for all four**, for the same two reasons. |

The result artefact is `data/usd-layer1-backtester/run-v1.json`; the data audit behind its coverage counts is
`data/usd-layer1-backtester/audit-v1.json`. The library also keeps the three USD factor sets visibly apart: the
ten-factor deployed book (Set A), the twenty-five-chain research programme (Set B) and the nine-mechanism historical
challenger (Set C).

## The other chambers

EUR, gold, NQ and BTC have a historical builder and a replay runner, so their libraries fill the first four groups
and record one gap in the fifth: no replay report is stored in this checkout, because the runner prints one per run
and nothing is committed. Silver, WTI and GBP have no builder and no runner, so their libraries hold the logic
document and any research note that exists, and the groups they cannot fill say exactly that.

The map never fills a gap with a placeholder: an empty chamber says it is empty, names what is missing, and links the
documents that do exist.

## What these libraries leave out

Nothing here adds a claim that the repository does not already make. The libraries do not quote a performance figure,
they do not call a blocked test a result, and they do not present the execution demo as a replay. Operator material -
the host handoff, the runbooks, the broker account-terms guide and the collector exports - stays out of the inspector,
and no document carries a credential, an account identifier or a provider endpoint.

## Sources

- `lib/factory-library.js` - the library data the map draws, one row per committed document.
- `data/usd-layer1-backtester/run-v1.json` - the four USD tests and their statuses.
- `backtester/replay/usd/README.md` - how the USD replay scores both books.
- `docs/dashboard-design/usd-factor-sets.md` - the three USD factor sets, side by side.
