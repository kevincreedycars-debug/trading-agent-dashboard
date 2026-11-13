# FTMO 3 on cTrader

Build the project with `dotnet build -c Release` or import the source into cTrader Algo. Use one instance per mapped symbol on its M5 chart. Select the third FTMO account. Set Expected account number and Expected cTrader symbol from the account and chart. Orders default to disabled.

Use the original marked ladder for each instrument. From the dashboard repository root, print the per-symbol parameter values with:

```sh
node -e "for (const i of require('./data/l2l-levels.json').instruments) console.log(i.symbol, i.levels.map(l => l.price).join(','))"
```

Match EURUSD, XAUUSD, US100.cash and BTCUSD to the instruments actually offered on that cTrader account. Compare the prices and tick sizes before loading their lists. Update the parameter if the marked ladder changes. The cBot rejects off-tick marks. Test in preview and in cTrader backtesting with trading enabled for the simulated account to exercise fills and exits.

On startup and after a position closes, the bot brackets the current bid with the nearest original level strictly above and below. A completed M5 candle crossing either boundary by one tick from the other side confirms that direction. A limit returns to that boundary, targets the next original level and risks one fifth of that distance, rounded to the tradable tick. Orders use the minimum volume in units for the symbol. While any position or pending order exists on that account for the symbol the instance waits. A cancelled pending order resets the bracket. On restart the instance checks broker orders and positions before acting and requires a new completed candle. A pending order remains working until filled or cancelled. Each symbol is independent.

Account verification still requires the target cTrader environment. Confirm minimum units and the accepted entry, absolute SL and TP in a simulated fill before enabling the intended account. The preview logs signals in cTrader and does not publish an FTMO 3 dashboard heartbeat.
