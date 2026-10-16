"""Read-only FTMO/MT5 snapshot producer for the dashboard's Live Trading section.

Writes `data/live-trading.json` from a running, logged-in MT5 terminal: account facts and, for each
of the four dashboard instruments, the current quote plus the recent bars the chart and the 5m
close-beyond-level trigger need, on three timeframes: `m5` (the trigger's), and `h1` and `h4` (the
zoomed-out views the L2L seed levels are marked on). Each timeframe block carries the bars as full
OHLC (`bars`), so the dashboard can mirror the terminal's candles rather than a close line, and a
compact close-only series (`close_series`) that the existing cards render.

Every block carries its own freshness proof (`bar_age_seconds` against the instrument's live tick,
`refresh_attempts`, and `stale`). MT5 answers bar requests from its local history cache and syncs the
rest from the broker in the background, so a run made before that sync lands can return a series that
stops hours earlier than the instrument's own tick. The producer re-asks until the newest bar reaches
the present and, if it never does, says so in the snapshot instead of presenting an old series as a
current read. The limit is per timeframe - two bar widths, not one number - because an H4 bar is
14400 seconds wide, an H1 bar 3600, and an M5 bar 300.

Read-only by construction. No order function is imported, called or armed: there is no
`order_send`, `order_check` or positions-close call anywhere in this file, and the snapshot records
that fact (`read_only`, `order_functions_called`, `no_order_path`) so a reader can see it without
trusting the documentation.

What it does read back is what has already been executed, so a trade placed deliberately by hand can be
seen to have happened rather than taken on trust: every open position with its own entry price, current
price, size and floating result (`positions`), every position that has closed inside a fourteen-day
window with its entry and exit prices, its profit, commission and swap, and its own open and close
timestamps (`closed_trades`, paired out of `history_deals_get`), and - since v4 - every working pending
order with the level it sits at, the stop and the target it carries and the moment it was placed
(`orders`). The orders matter for the L2L lane: a ticket left as a limit is neither a position nor a
closed trade, so without this block the one thing the dashboard cannot see is the level a live trade is
actually working at. All three are reads. The trades themselves are
not placed here and cannot be: the one file in this repository that can place one is
`tools/mt5-bridge/live-trading-order.py`, a separate process run deliberately from the terminal session,
and `tests/live_trading_order_tool.test.js` asserts that this producer names no order function while that
file is the only file that does.

Usage (same Windows session as the logged-in terminal):
    python tools/mt5-bridge/live-trading-snapshot.py
    python tools/mt5-bridge/live-trading-snapshot.py --path "C:\\Program Files\\FTMO Global Markets MT5 Terminal"

`--path` takes `terminal64.exe` or the folder containing it. The package attaches to an
already-running terminal; it cannot log in for you.

Clock rule: MT5 returns the broker's wall clock, not UTC. Every timestamp is written twice, as
`time_server` and as the corrected `time_utc`, so no downstream reader has to guess. FTMO's server
runs on UTC+3 while the FTMO trading day is 00:00-23:59:59 CE(S)T, so daily-loss and
minimum-trading-day arithmetic must use FTMO's own boundary rather than either raw timestamp.

Nothing here is an edge claim and nothing here places a trade.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import MetaTrader5 as mt5

SCHEMA_VERSION = "live-trading-feed-v4"

# The four instruments the dashboard publishes, in dashboard order. The value is the existing
# Layer 1 asset code so the live section lines up with the rest of the dashboard.
INSTRUMENTS = [
    ("EURUSD", "EUR"),
    ("XAUUSD", "GOLD"),
    ("US100.cash", "NQ"),
    ("BTCUSD", "BTC"),
]

# Which dashboard card a trade belongs to. A position on a symbol outside this map is still published -
# the terminal's read of the account is not filtered by what the cards happen to show - but it carries no
# dashboard_asset rather than a guessed one.
ASSET_BY_SYMBOL = dict(INSTRUMENTS)

# How far back the closed-trade read-back looks. Fourteen days holds a fortnight of trading - enough to see
# a trade placed today and any earlier one the user wants compared against it - while staying small enough
# to publish on the 5m cadence.
HISTORY_WINDOW_DAYS = 14

OFFSET_SNAP_SECONDS = 900
# A real UTC offset lies between -12h and +14h. A measurement outside that band is a closed market's
# last tick being read as a clock rather than as a clock, so it is refused and the offset documented
# for the FTMO server is used instead.
OFFSET_MIN_SECONDS = -12 * 3600
OFFSET_MAX_SECONDS = 14 * 3600
FTMO_SERVER_OFFSET_SECONDS = 10800
# How deep each block is, and that is the whole of how far a chart can be dragged: the pane slides across the
# bars a snapshot publishes and no further (`behind = total - fill` in `script.js`), so "see more historical
# data" is a deeper block rather than a page change. On 2026-10-06 the reader asked to scroll back "at least 24
# hours worth of 5m candles" and the answer was 288 - one day of M5. On 2026-10-07 the reader asked to "drag and
# move to the left more" to "see more historical data on the 4 live charts", which is the same lever pulled
# further: 576 M5 bars is two days, so at the widest view the whole 48 hours is drawn, each zoom press halves that
# window (288, 144, 72, 36) and a drag at any step reaches back through both days. Still small enough to publish
# on the 5m cadence.
DEFAULT_CANDLES = 576
# H1 and H4 are the zoomed-out views the L2L seed levels are marked on, doubled alongside the M5 block for the
# same request: two weeks of hourly bars and forty days of four-hour bars. An L2L ladder is read there, not on
# the 5m chart.
DEFAULT_H1_CANDLES = 336
DEFAULT_H4_CANDLES = 240
DEFAULT_STALE_SECONDS = 900

# A block whose newest bar opens more than this far behind the instrument's own live tick is not the
# current read the dashboard presents it as. Two bar widths, so an ordinary forming bar never trips
# it while a missing history sync does: an M5 bar is 300s wide, an H1 bar 3600, an H4 bar 14400.
M5_BAR_STALE_SECONDS = 660
H1_BAR_STALE_SECONDS = 7200
H4_BAR_STALE_SECONDS = 28800
M5_REFRESH_ATTEMPTS = 6
M5_REFRESH_WAIT_SECONDS = 2.0

# The blocks a snapshot publishes, in dashboard order. `m5` is what the 5m close-beyond-level trigger
# reads; `h1` and `h4` are the wider views that carry a marked L2L ladder.
TIMEFRAME_KEYS = ("m5", "h1", "h4")
TIMEFRAME_LABELS = {"m5": "M5", "h1": "H1", "h4": "H4"}


def timeframe_plan(candle_counts):
    """The three blocks to publish: block key, MT5 timeframe, bars asked for, staleness limit."""
    limits = {"m5": M5_BAR_STALE_SECONDS, "h1": H1_BAR_STALE_SECONDS, "h4": H4_BAR_STALE_SECONDS}
    timeframes = {"m5": mt5.TIMEFRAME_M5, "h1": mt5.TIMEFRAME_H1, "h4": mt5.TIMEFRAME_H4}
    return [
        (key, timeframes[key], candle_counts.get(key) or 0, limits[key])
        for key in TIMEFRAME_KEYS
    ]


def mask_login(login):
    return None if login is None else "***" + str(login)[-3:]


def resolve_path(path):
    """Accept either terminal64.exe or the folder that contains it."""
    if not path:
        return path
    candidate = Path(path)
    if candidate.is_dir():
        return str(candidate / "terminal64.exe")
    return path


def detect_server_offset():
    """Measure the broker clock offset, snapped to 15 minutes to ignore tick lag.

    Returns (symbol_used, offset_seconds). Interpreting an MT5 epoch as UTC gives server time;
    subtracting the offset gives real UTC.

    Each instrument offers `tick.time - now_epoch`, which is the true offset minus that tick's own
    staleness, so the freshest tick carries the largest value: the maximum across the four is the
    measurement least polluted by a closed market. Reading the first instrument instead is wrong
    whenever that instrument is shut - on 2026-10-03, a Saturday, EURUSD's last tick was Friday's
    close and measured -52200s, which shifted every `time_utc` in the snapshot 17.5 hours, while
    BTCUSD, which trades the weekend, measured the true +10800s. A maximum that is still outside the
    band a real UTC offset can take is refused rather than applied, and the offset documented for the
    FTMO server is used, with `server_offset_source_symbol` saying the measurement fell back.
    """
    now_epoch = time.time()
    freshest_symbol = None
    freshest_raw = None
    for symbol, _ in INSTRUMENTS:
        tick = mt5.symbol_info_tick(symbol)
        if tick is None or not tick.time:
            continue
        raw = tick.time - now_epoch
        if freshest_raw is None or raw > freshest_raw:
            freshest_symbol, freshest_raw = symbol, raw
    if freshest_raw is None:
        return None, None
    snapped = int(round(freshest_raw / OFFSET_SNAP_SECONDS) * OFFSET_SNAP_SECONDS)
    if snapped < OFFSET_MIN_SECONDS or snapped > OFFSET_MAX_SECONDS:
        return f"{freshest_symbol} (stale tick refused; FTMO UTC+3 default)", FTMO_SERVER_OFFSET_SECONDS
    return freshest_symbol, snapped


def stamp(epoch, offset_seconds):
    """Write one MT5 timestamp as both server time and corrected UTC."""
    if epoch is None:
        return {}
    server = datetime.fromtimestamp(int(epoch), timezone.utc)
    return {
        "time_server": server.isoformat(),
        "time_utc": (server - timedelta(seconds=offset_seconds or 0)).isoformat(),
    }


def candle_row(row, offset_seconds):
    return {
        **stamp(row["time"], offset_seconds),
        "open": float(row["open"]),
        "high": float(row["high"]),
        "low": float(row["low"]),
        "close": float(row["close"]),
        "tick_volume": int(row["tick_volume"]),
        "spread_points": int(row["spread"]),
    }


def newest_bar_age_seconds(rates, reference_epoch):
    """Age of the newest bar's open, in seconds, against the instrument's own live tick.

    Both are server-clock epochs, so the difference is meaningful without the offset.
    """
    if rates is None or len(rates) == 0 or reference_epoch is None:
        return None
    return max(0, int(reference_epoch) - int(rates[-1]["time"]))


def fetch_bar_rows(symbol, timeframe, candle_count, reference_epoch, stale_seconds):
    """Fetch the newest bars on one timeframe, waiting out MT5's on-demand history sync.

    MT5 answers `copy_rates_from_pos` from the terminal's local history cache and pulls anything
    missing from the broker in the background. A call made before that download lands returns a
    series that stops hours earlier than the instrument's own live tick - observed on three of the
    four instruments on 2026-09-30 after the terminal re-synced - which would otherwise render as a
    current read. Re-asking until the newest bar reaches the present, and recording how many
    attempts it took and how old the bar still is, is the difference between a live read and a stale
    one. The tolerance is the timeframe's own: two H4 bar widths is eight hours, not eleven minutes.

    Returns (rates, attempts, bar_age_seconds). `rates` is None when the terminal returned nothing.
    """
    rates = None
    for attempt in range(1, M5_REFRESH_ATTEMPTS + 1):
        candidate = mt5.copy_rates_from_pos(symbol, timeframe, 0, candle_count)
        if candidate is not None and len(candidate):
            rates = candidate
        age = newest_bar_age_seconds(rates, reference_epoch)
        if age is not None and age <= stale_seconds:
            return rates, attempt, age
        if attempt < M5_REFRESH_ATTEMPTS:
            time.sleep(M5_REFRESH_WAIT_SECONDS)
    return rates, M5_REFRESH_ATTEMPTS, newest_bar_age_seconds(rates, reference_epoch)


def build_timeframe_block(key, symbol, timeframe, offset_seconds, candle_count, reference_epoch, stale_seconds):
    """One timeframe's bars, with its own freshness proof.

    The H1 and H4 blocks carry the same shape as the M5 one, because the dashboard draws all three
    the same way and only the bar width changes.
    """
    label = TIMEFRAME_LABELS.get(key, key.upper())
    rates, attempts, bar_age = fetch_bar_rows(symbol, timeframe, candle_count, reference_epoch, stale_seconds)
    if rates is None or len(rates) == 0:
        return {
            "candle_count": 0,
            "bars": [],
            "close_series": [],
            "last_close": None,
            "bar_age_seconds": None,
            "refresh_attempts": attempts,
            "stale": True,
            "note": f"No {label} candles returned by the terminal.",
        }

    rows = [candle_row(row, offset_seconds) for row in rates]
    closes = [row["close"] for row in rows]
    series = []
    for index, row in enumerate(rows):
        previous = closes[index - 1] if index else row["open"]
        series.append({
            "time_server": row["time_server"],
            "time_utc": row["time_utc"],
            "close": row["close"],
            "direction": "up" if row["close"] > previous else ("down" if row["close"] < previous else "flat"),
        })

    last = rows[-1]
    previous_close = closes[-2] if len(closes) > 1 else None
    change = None if previous_close is None else last["close"] - previous_close
    change_pct = None if not previous_close else (change / previous_close) * 100
    stale = bar_age is None or bar_age > stale_seconds
    block = {
        "candle_count": len(rows),
        # Full OHLC so the dashboard can draw the same candles MT5 draws, not just a close line.
        # `close_series` stays as the compact close-only view the existing cards render.
        "bars": rows,
        "close_series": series,
        "last_close": last,
        "previous_close": rows[-2] if len(rows) > 1 else None,
        "range_high": max(row["high"] for row in rows),
        "range_low": min(row["low"] for row in rows),
        "change_points": change,
        "change_pct": change_pct,
        "direction": "flat" if not change else ("up" if change > 0 else "down"),
        "bar_age_seconds": bar_age,
        "refresh_attempts": attempts,
        "stale": stale,
    }
    if stale:
        lag = (
            f"{round(bar_age / 60)} minutes behind the live tick"
            if bar_age is not None
            else "not measurable against a live tick"
        )
        block["note"] = (
            f"The newest {symbol} {label} bar is {lag} after {attempts} request(s), so this is not "
            f"a current {label} read. MT5 serves bars from its local cache and syncs the rest from "
            "the broker in the background."
        )
    return block


def build_instrument(symbol, dashboard_asset, offset_seconds, plan, now_utc):
    info = mt5.symbol_info(symbol)
    if info is None:
        return {
            "symbol": symbol,
            "dashboard_asset": dashboard_asset,
            "available": False,
            "note": "Symbol not served by this terminal.",
        }

    tick = mt5.symbol_info_tick(symbol)
    point = float(info.point)
    row = {
        "symbol": symbol,
        "dashboard_asset": dashboard_asset,
        "available": True,
        "description": info.description,
        "digits": int(info.digits),
        "point": point,
        "tick_size": float(info.trade_tick_size),
        "contract_size": float(info.trade_contract_size),
        "min_lot": float(info.volume_min),
        "lot_step": float(info.volume_step),
        "stops_level": int(info.trade_stops_level),
        "trade_mode": int(info.trade_mode),
    }

    if tick is None or not tick.bid:
        row["quote"] = None
        row["note"] = "No tick returned; the instrument is not quoting to this terminal."
    else:
        spread_price = float(tick.ask) - float(tick.bid)
        tick_stamp = stamp(tick.time, offset_seconds)
        age_seconds = None
        if tick_stamp:
            age_seconds = round((now_utc - datetime.fromisoformat(tick_stamp["time_utc"])).total_seconds(), 1)
        row["quote"] = {
            "bid": float(tick.bid),
            "ask": float(tick.ask),
            "spread_price": round(spread_price, int(info.digits)),
            "spread_points": int(round(spread_price / point)) if point else None,
            "tick_age_seconds": age_seconds,
            "market_state": "quoting" if (age_seconds is not None and age_seconds <= 180) else "no recent ticks",
            **tick_stamp,
        }

    reference_epoch = int(tick.time) if tick is not None and tick.time else None
    for key, timeframe, candle_count, stale_seconds in plan:
        row[key] = build_timeframe_block(
            key,
            symbol,
            timeframe,
            offset_seconds,
            candle_count,
            reference_epoch,
            stale_seconds,
        )
    return row


def build_position(row, offset_seconds):
    """One open position, in the fields the dashboard renders and nothing else.

    `positions_get` carries all of it: the entry price, the current price, the size, the floating profit
    and swap, and the open and last-update times. The signed move is computed here rather than left to the
    reader, because a sell whose price has fallen is up: a column that shows money without saying which way
    the trade faces is a column every reader has to re-derive.
    """
    side = "buy" if row.type == mt5.POSITION_TYPE_BUY else "sell"
    change = float(row.price_current) - float(row.price_open)
    if side == "sell":
        change = -change
    opened = float(row.price_open)
    return {
        "ticket": int(row.ticket),
        "symbol": row.symbol,
        "dashboard_asset": ASSET_BY_SYMBOL.get(row.symbol),
        "side": side,
        "volume": float(row.volume),
        "price_open": float(row.price_open),
        "price_current": float(row.price_current),
        "stop_loss": float(row.sl) if row.sl else None,
        "take_profit": float(row.tp) if row.tp else None,
        "profit": float(row.profit),
        "swap": float(row.swap),
        "floating_pct": round((change / opened) * 100, 4) if opened else None,
        "magic": int(row.magic),
        "comment": row.comment,
        "opened": stamp(row.time, offset_seconds),
        "updated": stamp(row.time_update, offset_seconds),
    }


def build_positions(rows, offset_seconds):
    """Every open position the terminal reports, oldest first, so one run's order is stable."""
    if not rows:
        return []
    return [build_position(row, offset_seconds) for row in sorted(rows, key=lambda row: (row.time, row.ticket))]


def order_type_name(value):
    """The symbolic name of an ORDER_TYPE_*, so the feed says BUY_LIMIT rather than 2.

    Mirrors `order_type_name` in tools/mt5-bridge/live-trading-order.py: the page and the terminal's own
    journal name the same order the same way, and a name this walk cannot produce is written as the raw
    number rather than guessed at.
    """
    for name in dir(mt5):
        if name.startswith("ORDER_TYPE_") and getattr(mt5, name) == value:
            return name
    return str(int(value))


def build_order(row, offset_seconds):
    """One working pending order, in the fields the dashboard renders and nothing else.

    `orders_get` carries a ticket that is neither a position nor a closed trade: a limit waiting under
    the market at a level, with the stop and the target it was sent with. That level is the one fact the
    L2L rule's own reading cannot supply - a trade whose limit is working is still that trade, and the
    page has to be able to state the level it is working at rather than the far side of the ladder.
    `time_expiration` is 0 on an order with no expiry of its own, which is written as null rather than
    as the epoch, so "no expiry" and "an expiry of 1970" stay different facts.
    """
    expiration = int(row.time_expiration) if int(row.time_expiration or 0) else None
    return {
        "ticket": int(row.ticket),
        "symbol": row.symbol,
        "dashboard_asset": ASSET_BY_SYMBOL.get(row.symbol),
        "type": order_type_name(row.type),
        "side": "buy" if row.type in (
            mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_BUY_LIMIT, mt5.ORDER_TYPE_BUY_STOP
        ) else "sell",
        "volume": float(row.volume_current or row.volume_initial),
        "price_open": float(row.price_open),
        "stop_loss": float(row.sl) if row.sl else None,
        "take_profit": float(row.tp) if row.tp else None,
        "magic": int(row.magic),
        "comment": row.comment,
        "placed": stamp(row.time_setup, offset_seconds),
        "expiration": stamp(expiration, offset_seconds) if expiration else None,
    }


def build_orders(rows, offset_seconds):
    """Every working pending order the terminal reports, oldest first, so one run's list is stable."""
    if not rows:
        return []
    return [build_order(row, offset_seconds) for row in sorted(rows, key=lambda row: (row.time_setup, row.ticket))]


def deal_side(deal):
    return "buy" if deal.type == mt5.DEAL_TYPE_BUY else "sell"


def read_position_levels(position_ids):
    """The stop and the target each closed position carried, keyed by position id.

    MT5 books the two levels on the *order*, not on the deal, so they are read from the position's own order
    history - the entry order and any later modification of it, oldest first, so the last level actually set
    is the one reported. A run that cannot read the order history (no history, or a terminal that refuses the
    call) leaves both levels unstated, which the snapshot writes as null: a level the terminal did not report
    is not the same fact as a level that was never set, and neither is worth failing the read-back over.
    """
    levels = {}
    for position_id in position_ids:
        stop = None
        target = None
        try:
            orders = mt5.history_orders_get(position=position_id)
        except Exception:
            orders = None
        for order in sorted(orders or (), key=lambda row: (row.time_setup, row.ticket)):
            if getattr(order, "sl", 0):
                stop = float(order.sl)
            if getattr(order, "tp", 0):
                target = float(order.tp)
        levels[position_id] = (stop, target)
    return levels


def build_closed_trades(deals, offset_seconds, levels=None):
    """Closed positions inside the window: one record per position, built from the deals that made it.

    MT5 reports history as deals, not as trades. A position that opened and closed is an entry deal
    (`DEAL_ENTRY_IN`) and one or more exit deals (`DEAL_ENTRY_OUT`, or `DEAL_ENTRY_OUT_BY` when one position
    was closed by another), sharing a `position_id`, with the commission and the swap booked on the deals
    rather than on the position. Pairing them is what turns "what was executed and what it made" into
    something the dashboard can print instead of something a reader reconstructs from a statement.

    A position whose exit deals are not in this window is left out whole rather than shown as half a trade:
    it is either still open, in which case `positions` carries it, or it closed before the window opened.

    The stop and the target are the levels the entry order carried when the position was opened, read from the
    position's own order history because MT5 books both on the order and not on the deal. They are the two
    prices the chart draws a trade's position tool from, so they are read back here rather than reconstructed
    from the bars: a trade opened with nothing attached carries null for both, which is a different fact from
    a stop that was set at some price the snapshot does not know.
    """
    grouped = {}
    for deal in deals or ():
        entry = int(deal.entry)
        bucket = grouped.setdefault(int(deal.position_id), {"in": [], "out": []})
        if entry == mt5.DEAL_ENTRY_IN:
            bucket["in"].append(deal)
        elif entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY):
            bucket["out"].append(deal)

    trades = []
    for position_id, sides in grouped.items():
        if not sides["in"] or not sides["out"]:
            continue
        opened_deal = sorted(sides["in"], key=lambda deal: deal.time)[0]
        exits = sorted(sides["out"], key=lambda deal: deal.time)
        # The levels the position carried, read from its own order history: unstated (null) when the run
        # could not read them, which is not the same as a trade opened with nothing attached.
        stop_loss, take_profit = (levels or {}).get(position_id, (None, None))
        exit_volume = sum(float(deal.volume) for deal in exits) or 1.0
        price_close = sum(float(deal.price) * float(deal.volume) for deal in exits) / exit_volume
        closed_epoch = int(exits[-1].time)
        opened_epoch = int(opened_deal.time)
        profit = sum(float(deal.profit) for deal in sides["in"] + sides["out"])
        commission = sum(float(deal.commission) for deal in sides["in"] + sides["out"])
        swap = sum(float(deal.swap) for deal in sides["in"] + sides["out"])
        trades.append({
            "position_id": position_id,
            "symbol": opened_deal.symbol,
            "dashboard_asset": ASSET_BY_SYMBOL.get(opened_deal.symbol),
            "side": deal_side(opened_deal),
            "volume": float(opened_deal.volume),
            "price_open": float(opened_deal.price),
            "price_close": round(price_close, 8),
            # The two levels the entry order carried, exactly as the position row states its own.
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "profit": round(profit, 2),
            "commission": round(commission, 2),
            "swap": round(swap, 2),
            "net_profit": round(profit + commission + swap, 2),
            "magic": int(opened_deal.magic),
            "comment": opened_deal.comment,
            "deal_count": len(sides["in"]) + len(sides["out"]),
            "entry_deal": int(opened_deal.ticket),
            "exit_deal": int(exits[-1].ticket),
            "opened": stamp(opened_epoch, offset_seconds),
            "closed": stamp(closed_epoch, offset_seconds),
            "duration_seconds": closed_epoch - opened_epoch,
        })
    # Newest close first: the trade just placed is the one a reader is looking for.
    trades.sort(key=lambda trade: trade["closed"]["time_server"], reverse=True)
    return trades


def read_history(offset_seconds, now_utc, window_days):
    """The deals in the window and the closed trades paired out of them.

    Returns (closed_trades, history_summary). The summary says which window the list covers and how many
    deals built it, because "no closed trades" and "a window that holds none" are different facts and the
    dashboard has to be able to tell them apart.
    """
    server_now = now_utc + timedelta(seconds=offset_seconds or 0)
    start = server_now - timedelta(days=window_days)
    deals = mt5.history_deals_get(start, server_now)
    # One order-history read per closed position in the window, for the stop and the target it carried.
    levels = read_position_levels({int(deal.position_id) for deal in deals or ()})
    closed_trades = build_closed_trades(deals, offset_seconds, levels)
    return closed_trades, {
        "window_days": window_days,
        "from_server": start.isoformat(),
        "from_utc": (now_utc - timedelta(days=window_days)).isoformat(),
        "to_utc": now_utc.isoformat(),
        "deal_count": 0 if deals is None else len(deals),
        "closed_positions": len(closed_trades),
        "source": "history_deals_get",
        "note": (
            "Deals, not trades: the entry and exit deals of one position are paired here by position_id. A "
            "trade that closed before this window is not in the list, and a position with an entry deal and "
            "no exit deal inside it is still open, so it appears in positions instead."
        ),
    }


def build_report(offset_symbol, offset_seconds, now_utc, plan, stale_after_seconds):
    terminal = mt5.terminal_info()
    account = mt5.account_info()
    position_rows = mt5.positions_get()
    order_rows = mt5.orders_get()
    positions = build_positions(position_rows, offset_seconds)
    orders = build_orders(order_rows, offset_seconds)
    closed_trades, history = read_history(offset_seconds, now_utc, HISTORY_WINDOW_DAYS)

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at_utc": now_utc.isoformat(),
        "time_server": (now_utc + timedelta(seconds=offset_seconds or 0)).isoformat(),
        "server_offset_seconds": offset_seconds,
        "server_offset_source_symbol": offset_symbol,
        "clock_note": (
            "MT5 returns server-clock timestamps. Every time is written twice: time_server is the "
            "broker wall clock, time_utc is the same instant corrected by server_offset_seconds. "
            "FTMO's trading day boundary is CE(S)T midnight, not either of these."
        ),
        "stale_after_seconds": stale_after_seconds,
        "cadence_note": (
            "The dashboard's published view is a snapshot of this file. It is only fresh while a "
            "producer is running against the terminal."
        ),
        "read_only": True,
        "order_functions_called": False,
        "no_order_path": "This producer cannot send, modify, close or cancel anything.",
        "terminal": None if terminal is None else {
            "name": terminal.name,
            "company": terminal.company,
            "path": terminal.path,
            "build": terminal.build,
            "connected": terminal.connected,
            "trade_allowed": terminal.trade_allowed,
            "tradeapi_disabled": terminal.tradeapi_disabled,
        },
        "account": None if account is None else {
            "login_masked": mask_login(account.login),
            "server": account.server,
            "company": account.company,
            "currency": account.currency,
            "leverage": account.leverage,
            "balance": account.balance,
            "equity": account.equity,
            "margin_free": account.margin_free,
            "positions_open": len(positions),
            "orders_open": 0 if order_rows is None else len(order_rows),
        },
        "execution_note": (
            "This snapshot places nothing. Anything in `orders`, `positions` or `closed_trades` was executed "
            "outside it, by tools/mt5-bridge/live-trading-order.py run deliberately from the terminal session, "
            "or by hand in the terminal."
        ),
        # What has already been executed, read back so it can be seen rather than taken on trust. A ticket
        # left as a limit is neither a position nor a closed trade, which is why the working orders are
        # published beside them rather than folded into either.
        "orders": orders,
        "positions": positions,
        "closed_trades": closed_trades,
        "history": history,
        "instrument_count": len(INSTRUMENTS),
        "instruments": [
            build_instrument(symbol, asset, offset_seconds, plan, now_utc)
            for symbol, asset in INSTRUMENTS
        ],
        "source": {
            "producer": "tools/mt5-bridge/live-trading-snapshot.py",
            "platform": "MetaTrader 5",
            "package": f"MetaTrader5 {mt5.__version__}",
            "cadence": "5m",
            "timeframes": list(TIMEFRAME_KEYS),
            "scope": "read-only: quotes, account facts, M5/H1/H4 candles, working orders, open positions and closed trades",
        },
    }


def write(path, payload):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    return target


def parse_args():
    parser = argparse.ArgumentParser(description="Write a read-only MT5 snapshot for the dashboard.")
    parser.add_argument("--path", default=None, help="Optional terminal64.exe or terminal folder path.")
    parser.add_argument("--out", default="data/live-trading.json", help="Output file (default data/live-trading.json).")
    parser.add_argument("--candles", type=int, default=DEFAULT_CANDLES, help="M5 candles kept per instrument.")
    parser.add_argument("--h1-candles", type=int, default=DEFAULT_H1_CANDLES, help="H1 candles kept per instrument.")
    parser.add_argument("--h4-candles", type=int, default=DEFAULT_H4_CANDLES, help="H4 candles kept per instrument.")
    parser.add_argument("--stale-seconds", type=int, default=DEFAULT_STALE_SECONDS, help="Freshness window for readers.")
    return parser.parse_args()


def main():
    args = parse_args()
    now_utc = datetime.now(timezone.utc)

    initialized = mt5.initialize(path=resolve_path(args.path)) if args.path else mt5.initialize()
    if not initialized:
        write(args.out, {
            "schema_version": SCHEMA_VERSION,
            "generated_at_utc": now_utc.isoformat(),
            "read_only": True,
            "order_functions_called": False,
            "initialize_error": mt5.last_error(),
            "note": (
                "No terminal reachable. MT5 must be installed, running and logged in inside this "
                "Windows session; the package cannot log in for you."
            ),
            "instruments": [],
            # The read-back's shape, empty: a failure to reach the terminal is not a claim that the
            # account holds nothing, so this artifact is one the validator refuses rather than one the
            # dashboard shows.
            "orders": [],
            "positions": [],
            "closed_trades": [],
            "history": None,
        })
        print("No terminal reachable. Snapshot written with the failure recorded.")
        return 1

    try:
        offset_symbol, offset_seconds = detect_server_offset()
        plan = timeframe_plan({
            "m5": args.candles,
            "h1": args.h1_candles,
            "h4": args.h4_candles,
        })
        report = build_report(offset_symbol, offset_seconds, now_utc, plan, args.stale_seconds)
    finally:
        mt5.shutdown()

    target = write(args.out, report)
    account = report.get("account") or {}
    print(f"Snapshot written to {target}")
    print(f"  server offset: {report['server_offset_seconds']}s (from {report['server_offset_source_symbol']})")
    print(f"  account: {account.get('login_masked')} {account.get('server')} {account.get('currency')} balance {account.get('balance')}")
    print(f"  positions {account.get('positions_open')} / orders {account.get('orders_open')}")
    for order in report["orders"]:
        print(
            f"    ORDER #{order['ticket']} {order['symbol']} {order['side']} {order['type']} "
            f"{order['volume']} lot at {order['price_open']} sl {order['stop_loss']} tp {order['take_profit']} "
            f"magic {order['magic']} placed {order['placed'].get('time_utc')}"
        )
    for position in report["positions"]:
        print(
            f"    POSITION #{position['ticket']} {position['symbol']} {position['side']} "
            f"{position['volume']} lot @ {position['price_open']} now {position['price_current']} "
            f"P/L {position['profit']} ({position['floating_pct']}%) opened {position['opened'].get('time_utc')}"
        )
    history = report["history"] or {}
    print(
        f"  closed trades: {len(report['closed_trades'])} in the last {history.get('window_days')} days "
        f"from {history.get('deal_count')} deal(s)"
    )
    for trade in report["closed_trades"][:5]:
        print(
            f"    CLOSED #{trade['position_id']} {trade['symbol']} {trade['side']} {trade['volume']} lot "
            f"{trade['price_open']} -> {trade['price_close']} net {trade['net_profit']} "
            f"({trade['duration_seconds']}s) closed {trade['closed'].get('time_utc')}"
        )
    for instrument in report["instruments"]:
        quote = instrument.get("quote") or {}
        print(
            f"  {instrument['symbol']:>11} bid {quote.get('bid')} ask {quote.get('ask')} "
            f"spread {quote.get('spread_points')} points"
        )
        for key in TIMEFRAME_KEYS:
            block = instrument.get(key) or {}
            bar_state = "STALE" if block.get("stale") else "current"
            print(
                f"      {TIMEFRAME_LABELS.get(key, key):>4} {bar_state} "
                f"{block.get('candle_count')} bars, newest {block.get('bar_age_seconds')}s old "
                f"after {block.get('refresh_attempts')} request(s)"
            )
    print("READ-ONLY snapshot complete. No order function was called; orders, positions and closed trades were read back.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
