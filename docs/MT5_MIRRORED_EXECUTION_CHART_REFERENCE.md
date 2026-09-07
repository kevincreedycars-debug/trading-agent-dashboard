# MT5 Mirrored Execution Chart Reference

Reference image supplied by the user on 2026-08-21. Use it as the visual
direction when adding the dashboard view that mirrors live MT5 trade executions.

## Visual direction

- Retain the terminal-style left navigation rail and compact system ticker.
- Use a wide, dark candlestick chart as the dominant surface.
- Overlay reaction-confirmed levels as thin horizontal teal lines with concise
  right-edge value tags.
- Plot live execution markers directly on the candles, with readable BUY/SELL
  labels and short connector lines to the fill location.
- Include timeframe and chart-mode controls in a compact toolbar above the plot.
- Show a selected instrument row with health, freshness, and level-spacing
  badges before the chart.

## Product requirement

The eventual implementation must mirror actual MT5 execution records, including
instrument, side, fill time, fill price, size, stop, target, and exit outcome.
It must distinguish real fills from proposed or simulated trades and label stale
or incomplete broker synchronization prominently.
