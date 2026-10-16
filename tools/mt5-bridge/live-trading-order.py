"""The live-trading order tool: the only file in this repository that may place a trade.

Written on 2026-10-04 for one deliberate purpose: prove the loop end to end by opening the smallest
position the broker allows, closing it, and reading both back through `live-trading-snapshot.py` into the
dashboard's Live Trading section. It is a separate file and a separate process from the read-only
producer on purpose:

  * `live-trading-snapshot.py` reads and can send nothing, and `tests/live_trading_feed.test.js` still
    fails the suite if an order call appears in it;
  * this file sends, and reads only what it needs to size and confirm one order;
  * `tests/live_trading_order_tool.test.js` asserts that exactly one file in the repository names an
    order function, and that this is that file.

From the same Windows session as the logged-in terminal:

    python tools/mt5-bridge/live-trading-order.py status
    python tools/mt5-bridge/live-trading-order.py open --symbol BTCUSD --side buy --confirm-live
    python tools/mt5-bridge/live-trading-order.py open --symbol EURUSD --side sell --entry-price 1.17025 \
        --stop-loss 1.17130 --take-profit 1.16500 --expire-minutes 30 --confirm-live
    python tools/mt5-bridge/live-trading-order.py close --ticket 12345678 --confirm-live
    python tools/mt5-bridge/live-trading-order.py modify --ticket 12345678 --stop-loss 84530.00 --confirm-live
    python tools/mt5-bridge/live-trading-order.py cancel --ticket 12345678 --confirm-live

Nothing is sent without `--confirm-live`. A run without it prints the plan it would send - the symbol, the
side, the numeric size and the cap that allows it - and exits 3 without importing or attaching to the
terminal at all, so the refusal paths can be exercised on a machine with no MT5 install. The size defaults
to the symbol's own `volume_min` - the smallest position
the instrument accepts - and the cap a run allows is that same minimum unless `--max-lots` raises it
deliberately. The default of this tool is therefore the smallest trade that exists, and anything larger
is something a caller has to ask for twice: once with `--lots` and once with a `--max-lots` that covers
it. Closing is the one exception, because a position that cannot be capped cannot be closed either: the
default cap for `close` is the position's own volume.

Every invocation appends one JSON line to `tmp/live-trading-orders.log` (ignored): the plan, the request
as sent, and the terminal's raw answer. The log is the standing evidence and the printed block is the
same object, so nothing has to be reconstructed from a console buffer later.

Four uses - one market order, one pending limit, one level change and one removal - and no rule of its own. With no
`--entry-price` it sends one market order; with an `--entry-price` it leaves one pending limit at that price,
which is the entry the L2L rule states. Either way it carries no entry rule, no exit rule and no size rule of
its own: the stop and the target are only whatever `--stop-loss` and `--take-profit` say, so a caller that does
have a rule - the loop in `scripts/run-live-trading-trader.js`, which hands over the ticket
`lib/l2l_strategy.js` produced - has to pass that rule's own numbers in. It is plumbing, not a signal, and its
`magic` number marks every position and every pending order it leaves so a read-back can say which ones came
from this path.

`cancel` takes one *working pending order* back out of the market and does nothing else. A pending entry is a
limit left at a marked line rather than a position, so removing it is `TRADE_ACTION_REMOVE` on that ticket and
not a closing deal; closing a position stays `close`, and a `cancel` on a position is refused with the word
`close` in the message. A ticket that another path placed is refused as well, by its own magic, because a tool
that removes what it did not place is a tool that can remove anything.

`modify` moves the tolerance levels of one *position that already exists* and does nothing else: no size, no
entry, no exit. It is `TRADE_ACTION_SLTP` on the position's own ticket, which makes it the one action here that
reaches a trade already open, and it is where the rule's own adjustment arrives - a trade that has run to twice
the risk it was placed with has its stop taken to breakeven rather than left where it was placed. It chooses no
level of its own: `--stop-loss` is the level the position's stop is moved to, and the position's own take-profit
is carried through unchanged unless one is stated, because the terminal reads an `SlTp` request with no target in
it as a request to clear the target. Three refusals stand in front of the send and each names the fact it is: a
ticket that is not an open position on this account, a ticket carrying another path's magic - a tool that moves
what it did not place is a tool that can move anything - and a stop on the wrong side of the market, which the
terminal would answer by refusing or by closing the position on the spot. A stop the symbol will not accept that
close to the market is refused the way a pending entry's own levels are.

The lifetime of a pending entry belongs to the rule rather than to this tool. As the user ruled it on
2026-10-05, the L2L levels are permanent: a level is activated by the 5m deviation that confirmed the call, it
stays active after a stop is hit, and it is deactivated only by its take-profit being taken or by the day's call
changing direction - and the loop is what removes the resting limit on those two readings. `--expire-minutes`
is therefore this tool's own hand-run cap rather than the rule, and the loop passes no expiry at all: a caller
may still make one ticket run out on the terminal's clock, deliberately, by asking for it here.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# The instruments the dashboard publishes. Any other symbol is refused: an order on a symbol the lane does
# not follow would be a position no section reads back.
ALLOWED_SYMBOLS = ("EURUSD", "XAUUSD", "US100.cash", "BTCUSD")
SIDES = ("buy", "sell")
ACTIONS = ("open", "close", "modify", "cancel", "status", "help")
# Marks every deal this tool places, so the closed-trade read-back can say which trades came from here.
MAGIC = 20261004
# The comment the deals history carries, for the same reason in words.
DEFAULT_COMMENT = "live-trading-loop-proof"
# Points of slippage a market order may take. BTCUSD points are 0.01, so 20 points is $0.20 of price.
DEFAULT_DEVIATION_POINTS = 20
# The capability bits in `symbol_info.filling_mode`: this package ships no SYMBOL_FILLING_* names, only
# ORDER_FILLING_*, so the mask that says what the *symbol* accepts is read with its documented values.
SYMBOL_FILLS_FOK = 1
SYMBOL_FILLS_IOC = 2
DEFAULT_JOURNAL = "tmp/live-trading-orders.log"
# What every journal record names as its author, so a reader of the log knows which file sent a trade.
TOOL = "tools/mt5-bridge/live-trading-order.py"

EXIT_OK = 0
EXIT_USAGE = 2
# Refused by a guard in this file before anything was sent: no --confirm-live, a symbol outside the
# allowlist, a size above the run's cap, a ticket that is not an open position.
EXIT_REFUSED = 3
# Sent and answered by the terminal with something other than done. The answer is in the log either way.
EXIT_BROKER = 4

# Retcodes that mean "ask again": the price moved between the read and the send, or the filling mode was
# not the one this symbol wants. Both are ordinary on a fast instrument and neither is a refusal.
RETRYABLE_RETCODES = (
    "TRADE_RETCODE_REQUOTE",
    "TRADE_RETCODE_PRICE_CHANGED",
    "TRADE_RETCODE_PRICE_OFF",
    "TRADE_RETCODE_INVALID_FILL",
)
# Retcodes that mean the server will not take an expiry on a pending order at all. The request is sound
# otherwise, so the expiry - this tool's own guard against a ticket sitting there for ever, not the rule's own
# entry - is dropped for one further attempt rather than costing the signal. The record says which was left.
EXPIRY_RETCODES = (
    "TRADE_RETCODE_INVALID_EXPIRATION",
    "TRADE_RETCODE_INVALID_EXPIRATION_TIME",
)

USAGE = f"""The live-trading order tool. It places trades; run it deliberately, by hand, from the
terminal's own Windows session.

Usage:
  python tools/mt5-bridge/live-trading-order.py open  --symbol BTCUSD [--side buy] [--lots N]
                                                      [--max-lots N] [--stop-loss P] [--take-profit P]
                                                      [--comment TEXT] --confirm-live
  python tools/mt5-bridge/live-trading-order.py close --ticket N [--lots N] [--max-lots N] --confirm-live
  python tools/mt5-bridge/live-trading-order.py modify --ticket N --stop-loss P [--take-profit P] --confirm-live
  python tools/mt5-bridge/live-trading-order.py cancel --ticket N --confirm-live
  python tools/mt5-bridge/live-trading-order.py status [--ticket N]

  --confirm-live           required to send anything; without it a run prints its plan and exits {EXIT_REFUSED}
  --symbol <name>          one of {", ".join(ALLOWED_SYMBOLS)} (default BTCUSD)
  --side <buy|sell>        direction to open (default buy)
  --lots <n>               volume; defaults to the symbol's volume_min, the smallest size it accepts
  --max-lots <n>           the cap this run allows; defaults to volume_min, so the smallest size is the
                           default and a larger one has to be asked for here as well
  --stop-loss <price>      optional protective stop, in price; for modify it is the level the position's own stop
                           is moved to, and it is required there because moving it is the whole of the action
  --take-profit <price>    optional target, in price; a modify that names none carries the position's own target
                           through unchanged, because the terminal reads an absent field as a request to clear it
  --entry-price <price>    leave one pending limit at this price instead of taking the market: a buy limit
                           has to sit below the market and a sell limit above it, and the stop and the
                           target are then checked against this price rather than against the tick
  --expire-minutes <n>     pending entries only, and this tool's own cap rather than the rule's: the order
                           expires this many minutes from the last tick's own server clock. The L2L rule
                           states no expiry - a level is permanent and is deactivated only by its take-profit
                           being taken or by the day's call changing direction - so the loop passes none, and
                           this is here for a deliberate hand run
  --ticket <n>             the position to close (close), the position's levels to move (modify), the working
                           pending order to remove (cancel) or the ticket to report (status)
  --deviation <points>     slippage allowed on the market order (default {DEFAULT_DEVIATION_POINTS})
  --path <path>            terminal64.exe or its folder, if the package cannot find the terminal
  --journal <path>         append-only evidence log (default {DEFAULT_JOURNAL})

Every run appends one JSON line to the journal: the plan, the request as sent and the terminal's answer.
"""


def resolve_path(path):
    """Accept either terminal64.exe or the folder that contains it."""
    if not path:
        return path
    candidate = Path(path)
    return str(candidate / "terminal64.exe") if candidate.is_dir() else path


def attach(path):
    """Import the broker package and attach to the running terminal.

    The import sits inside this function rather than at the top of the file so that the guard paths - the
    ones that refuse before sending anything - run on a machine where the package is not installed.
    """
    import MetaTrader5 as mt5

    initialized = mt5.initialize(path=resolve_path(path)) if path else mt5.initialize()
    if not initialized:
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")
    return mt5


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def round_to_step(value, step):
    """Round a volume to the instrument's own step, so the terminal is not asked for an impossible size."""
    if not step:
        return float(value)
    return round(round(float(value) / float(step)) * float(step), 8)


def plan_open(args):
    """What this run intends to do, printed before anything is sent."""
    return {
        "action": "open",
        "symbol": args.symbol,
        "side": args.side,
        "entry": "pending limit at --entry-price" if args.entry_price else "market at the tick",
        "entry_price": args.entry_price,
        "expire_minutes": args.expire_minutes,
        "requested_lots": args.lots if args.lots else "symbol volume_min (the smallest size it accepts)",
        "max_lots": args.max_lots if args.max_lots else "symbol volume_min",
        "stop_loss": args.stop_loss,
        "take_profit": args.take_profit,
        "comment": args.comment,
        "magic": MAGIC,
    }


def plan_close(args):
    return {
        "action": "close",
        "ticket": args.ticket,
        "requested_lots": args.lots if args.lots else "the position's whole volume",
        "max_lots": args.max_lots if args.max_lots else "the position's own volume",
        "comment": args.comment,
        "magic": MAGIC,
    }


def plan_cancel(args):
    """What this run intends to remove, printed before anything is sent.

    A pending entry is a limit left in the market, not a position, so the plan says which ticket is taken back
    out and that nothing is closed by it.
    """
    return {
        "action": "cancel",
        "ticket": args.ticket,
        "trader_action": "TRADE_ACTION_REMOVE on a working pending order",
        "note": "this removes one working pending order; it never closes a position - that is the close action",
        "comment": args.comment,
        "magic": MAGIC,
    }


def plan_modify(args):
    """What this run intends to change, printed before anything is sent.

    A level change on a position that already exists, so the plan says which ticket it reaches, what the stop
    becomes and that nothing is opened or closed by it. No `--take-profit` means the position keeps the target
    it has: the field is carried through rather than left out, because the terminal reads an `SlTp` request
    without one as a request to clear it.
    """
    return {
        "action": "modify",
        "ticket": args.ticket,
        "stop_loss": args.stop_loss,
        "take_profit": args.take_profit if args.take_profit else "the position's own target, carried through unchanged",
        "trader_action": "TRADE_ACTION_SLTP on an open position",
        "note": "this moves the levels of a position that already exists; it never opens and never closes one",
        "comment": args.comment,
        "magic": MAGIC,
    }


def guard_before_broker(args):
    """The refusals that need no terminal: the confirm flag, the symbol allowlist, the ticket.

    Returns (reason, exit_code) when the run must stop, or (None, None) when it may attach.
    """
    if args.action in ("open", "close", "modify", "cancel") and not args.confirm_live:
        return (
            "refused: --confirm-live is required to send anything; this run planned and sent nothing. "
            "Add --confirm-live to place it.",
            EXIT_REFUSED,
        )
    if args.action == "open" and args.symbol not in ALLOWED_SYMBOLS:
        return (
            f"refused: {args.symbol} is not one of the four instruments this lane trades "
            f"({', '.join(ALLOWED_SYMBOLS)}); nothing was sent.",
            EXIT_REFUSED,
        )
    if args.action == "close" and (not isinstance(args.ticket, int) or args.ticket <= 0):
        return (
            "refused: --ticket must be the positive ticket of the position to close; nothing was sent.",
            EXIT_REFUSED,
        )
    if args.action == "cancel" and (not isinstance(args.ticket, int) or args.ticket <= 0):
        return (
            "refused: --ticket must be the positive ticket of the working pending order to remove; nothing "
            "was sent.",
            EXIT_REFUSED,
        )
    if args.action == "modify" and (not isinstance(args.ticket, int) or args.ticket <= 0):
        return (
            "refused: --ticket must be the positive ticket of the open position whose levels are moved; "
            "nothing was sent.",
            EXIT_REFUSED,
        )
    if args.action == "modify" and args.stop_loss is None:
        return (
            "refused: --stop-loss is the level the modify action moves, and this run carries none, so there "
            "is nothing to ask the terminal for. Nothing was sent.",
            EXIT_REFUSED,
        )
    if args.stop_loss is not None and args.stop_loss <= 0:
        return (f"refused: --stop-loss must be positive, not {args.stop_loss}; nothing was sent.", EXIT_REFUSED)
    if args.take_profit is not None and args.take_profit <= 0:
        return (f"refused: --take-profit must be positive, not {args.take_profit}; nothing was sent.", EXIT_REFUSED)
    if args.lots is not None and args.lots <= 0:
        return (f"refused: --lots must be positive, not {args.lots}; nothing was sent.", EXIT_REFUSED)
    if args.max_lots is not None and args.max_lots <= 0:
        return (f"refused: --max-lots must be positive, not {args.max_lots}; nothing was sent.", EXIT_REFUSED)
    if args.entry_price is not None and args.entry_price <= 0:
        return (f"refused: --entry-price must be positive, not {args.entry_price}; nothing was sent.", EXIT_REFUSED)
    if args.expire_minutes is not None and args.entry_price is None:
        return (
            "refused: --expire-minutes says when a pending entry runs out, so it needs an --entry-price as "
            "well; a market order is filled or refused there and then. Nothing was sent.",
            EXIT_REFUSED,
        )
    if args.expire_minutes is not None and args.expire_minutes <= 0:
        return (
            f"refused: --expire-minutes must be positive, not {args.expire_minutes}; nothing was sent.",
            EXIT_REFUSED,
        )
    return (None, None)


def resolve_volume(requested, info, max_lots, position_volume=None):
    """The volume to send, or the reason nothing may be sent.

    `requested` of None means the symbol's own minimum when opening and the position's own volume when
    closing: the smallest size the instrument accepts, or exactly the exposure already open. The cap is
    that same figure unless the caller passed --max-lots, so growing an opening trade past the smallest
    size the instrument accepts takes two explicit arguments rather than one. A close is capped at the
    position's own volume, because a position that cannot be capped cannot be closed either.
    """
    minimum = float(info.volume_min)
    step = float(info.volume_step) or minimum
    base = float(position_volume) if position_volume else minimum
    cap = float(max_lots) if max_lots else max(minimum, base)
    volume = round_to_step(base if requested is None else requested, step)
    if volume + 1e-9 < minimum:
        return None, f"refused: {volume} is below {info.name}'s minimum of {minimum}; nothing was sent."
    if volume > cap + 1e-9:
        return None, (
            f"refused: {volume} is above the cap this run allows ({cap}); raise --max-lots deliberately "
            f"to send a larger size. Nothing was sent."
        )
    return volume, None


def filling_modes(mt5, info):
    """The filling modes the symbol accepts, in the order to try them.

    `symbol_info.filling_mode` is a capability mask rather than a choice, and this package ships no
    SYMBOL_FILLING_* names (5.0.6231 has only ORDER_FILLING_*), so the mask is read with its documented
    bit values: 1 is FOK, 2 is IOC. RETURN is appended because it is the mode the mask cannot express and
    the one a symbol that rejects both of the others falls back to.
    """
    modes = []
    if info.filling_mode & SYMBOL_FILLS_IOC:
        modes.append(mt5.ORDER_FILLING_IOC)
    if info.filling_mode & SYMBOL_FILLS_FOK:
        modes.append(mt5.ORDER_FILLING_FOK)
    return modes + [mt5.ORDER_FILLING_RETURN]


def retcode_name(mt5, retcode):
    """The symbolic name of a retcode, so the log says `TRADE_RETCODE_DONE` rather than `10009`."""
    for name in dir(mt5):
        if name.startswith("TRADE_RETCODE_") and getattr(mt5, name) == retcode:
            return name
    return f"RETCODE_{retcode}"


def send_with_retries(mt5, request, modes, refresh_price, attempts=3):
    """Send one request, trying each filling mode and re-reading the price between attempts.

    A market order built from a tick that has already moved comes back as a requote or a price change
    rather than as a fill, and a symbol that does not accept the first filling mode answers
    `TRADE_RETCODE_INVALID_FILL`. Both are ordinary here, so the price is refreshed from a new tick and the
    next mode tried instead of the same request being resent unchanged. Returns (result, mode, attempts).
    """
    last_result = None
    last_mode = None
    last_attempt = 0
    for mode in modes:
        request["type_filling"] = mode
        for attempt in range(1, attempts + 1):
            if attempt > 1 or last_mode is not None:
                time.sleep(0.5)
                refresh_price(request)
            result = mt5.order_send(request)
            last_result, last_mode, last_attempt = result, mode, attempt
            if result is None:
                continue
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                return result, mode, attempt
            if retcode_name(mt5, result.retcode) not in RETRYABLE_RETCODES:
                return result, mode, attempt
    return last_result, last_mode, last_attempt


def result_fields(result):
    """The terminal's answer as plain data, so the journal holds the raw record and not a summary of it."""
    if result is None:
        return None
    if hasattr(result, "_asdict"):
        return result._asdict()
    return {name: getattr(result, name) for name in getattr(result, "_fields", ())}


def summarise(mt5, result, mode):
    """The handful of facts a caller needs out of that answer, in the words the dashboard uses."""
    if result is None:
        return {"sent": True, "answer": None, "note": "the terminal returned nothing: treat this as not sent"}
    return {
        "sent": True,
        "retcode": result.retcode,
        "retcode_name": retcode_name(mt5, result.retcode),
        "done": result.retcode == mt5.TRADE_RETCODE_DONE,
        "deal": getattr(result, "deal", None) or None,
        "order": getattr(result, "order", None) or None,
        "volume": getattr(result, "volume", None) or None,
        "price": getattr(result, "price", None) or None,
        "comment": getattr(result, "comment", None) or None,
        "filling_mode": mode,
        "request_id": getattr(result, "request_id", None) or None,
    }


def prices_are_ordered(side, stop_loss, take_profit, price):
    """A stop or target on the wrong side of the entry is refused before it is sent, not after."""
    if stop_loss:
        if (side == "buy" and stop_loss >= price) or (side == "sell" and stop_loss <= price):
            return False, f"refused: a {side} stop-loss at {stop_loss} is not on the protective side of {price}."
    if take_profit:
        if (side == "buy" and take_profit <= price) or (side == "sell" and take_profit >= price):
            return False, f"refused: a {side} take-profit at {take_profit} is not beyond {price}."
    return True, None


def order_type_name(mt5, value):
    """The symbolic name of an ORDER_TYPE_*, so the journal says BUY_LIMIT rather than 2."""
    for name in dir(mt5):
        if name.startswith("ORDER_TYPE_") and getattr(mt5, name) == value:
            return name
    return f"ORDER_TYPE_{value}"


def pending_entry_refusal(info, args, price):
    """Why a pending limit cannot be left where the caller said, or None when it can.

    A limit is not a market order: a buy limit at or above the market is a buy now, and a sell limit at or
    below it is a sell now, so the ticket the caller described would not be the ticket that opens. That is
    refused here by name rather than left to the terminal, and so is a level the symbol will not accept
    that close to the entry - the stop and the target are checked against the entry, not against the tick,
    because the entry is where a position would open.
    """
    if args.side == "buy" and args.entry_price >= price:
        return (
            f"refused: a buy limit at {args.entry_price} is at or above the market ({price}), so the "
            f"retrace it waits for has already happened. Nothing was sent."
        )
    if args.side == "sell" and args.entry_price <= price:
        return (
            f"refused: a sell limit at {args.entry_price} is at or below the market ({price}), so the "
            f"retrace it waits for has already happened. Nothing was sent."
        )
    minimum = float(getattr(info, "trade_stops_level", 0) or 0) * float(info.point or 0)
    if minimum > 0:
        if abs(float(args.entry_price) - float(price)) + 1e-12 < minimum:
            return (
                f"refused: the limit sits closer to the market than {info.name} accepts (its own floor is "
                f"{minimum}); nothing was sent."
            )
        for name, level in (("stop-loss", args.stop_loss), ("take-profit", args.take_profit)):
            if level is not None and abs(float(level) - float(args.entry_price)) + 1e-12 < minimum:
                return (
                    f"refused: the {name} is {abs(float(level) - float(args.entry_price))} from the entry "
                    f"and {info.name} will not accept a level closer than {minimum} to it; nothing was sent."
                )
    return None


def append_journal(path, record):
    """One JSON line per invocation, appended. This is the evidence; the printed block is the same object."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, default=str) + "\n")
    return target


def emit(record, journal, lines=()):
    """The one place that prints and journals, so a run leaves the same record in both places."""
    append_journal(journal, record)
    for line in lines:
        print(line)
    print(json.dumps(record, default=str, separators=(",", ":")))


def refuse(journal, base, message, plan=None):
    """Stop without sending: record why, print it, journal it. Returns the refused exit code."""
    record = {
        **base,
        "refused": True,
        "message": message,
        "note": "nothing was sent; this record is the whole of what happened.",
    }
    if plan is not None:
        record["plan"] = plan
    emit(record, journal, [message])
    return EXIT_REFUSED


def tick_price(mt5, symbol, side):
    """The price a market order of `side` would take: the ask when buying, the bid when selling."""
    tick = mt5.symbol_info_tick(symbol)
    if tick is None or not tick.bid or not tick.ask:
        return None, None
    return (float(tick.ask) if side == "buy" else float(tick.bid)), tick


def open_order(mt5, args, journal):
    """Open one position: a market order, or one pending limit when --entry-price is given.

    The size is the smallest the symbol allows unless told otherwise twice, and the stop and the target are
    only what the caller passed. With an --entry-price the entry is a limit left at that price, which is
    the entry the L2L rule states: the retrace, not the candle that broke the level.
    """
    base = {"at_utc": now_iso(), "tool": TOOL, "action": "open"}
    info = mt5.symbol_info(args.symbol)
    plan = plan_open(args)
    if info is None:
        return refuse(journal, base, f"refused: {args.symbol} is not served by this terminal; nothing was sent.", plan)

    price, tick = tick_price(mt5, args.symbol, args.side)
    if price is None:
        return refuse(
            journal, base, f"refused: {args.symbol} returned no tick, so there is no price to send; nothing was sent.", plan
        )

    volume, reason = resolve_volume(args.lots, info, args.max_lots)
    if reason:
        return refuse(journal, base, reason, plan)

    # What the stop and the target are judged against: the tick for a market entry, the limit itself for a
    # pending one, because that is where a position would open.
    reference = float(args.entry_price) if args.entry_price else price
    ordered, reason = prices_are_ordered(args.side, args.stop_loss, args.take_profit, reference)
    if not ordered:
        return refuse(journal, base, reason, plan)
    if args.entry_price:
        reason = pending_entry_refusal(info, args, price)
        if reason:
            return refuse(journal, base, reason, plan)

    entry_type = "pending limit" if args.entry_price else "market"
    if args.entry_price:
        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": info.name,
            "volume": volume,
            "type": mt5.ORDER_TYPE_BUY_LIMIT if args.side == "buy" else mt5.ORDER_TYPE_SELL_LIMIT,
            "price": float(args.entry_price),
            "magic": MAGIC,
            "comment": args.comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_RETURN,
        }
        if args.expire_minutes:
            # The terminal reads an expiry on its own server clock, so it is anchored to the last tick's
            # server time rather than to this process's clock.
            request["type_time"] = mt5.ORDER_TIME_SPECIFIED
            request["expiration"] = int(tick.time) + int(args.expire_minutes) * 60
    else:
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": info.name,
            "volume": volume,
            "type": mt5.ORDER_TYPE_BUY if args.side == "buy" else mt5.ORDER_TYPE_SELL,
            "price": price,
            "deviation": args.deviation,
            "magic": MAGIC,
            "comment": args.comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_RETURN,
        }
    if args.stop_loss:
        request["sl"] = float(args.stop_loss)
    if args.take_profit:
        request["tp"] = float(args.take_profit)

    def refresh_price(target):
        # Only a market entry follows the market: a limit stays where the rule put it.
        if args.entry_price:
            return
        fresh, _ = tick_price(mt5, args.symbol, args.side)
        if fresh:
            target["price"] = fresh

    result, mode, attempts = send_with_retries(mt5, request, filling_modes(mt5, info), refresh_price)
    # A server that will not take an expiry answers a pending request with an expiry retcode while the request
    # itself is sound. The ticket the rule states is a limit at the level; the expiry is this tool's own guard
    # against it sitting there for ever, so it is dropped for one further attempt rather than costing the
    # signal, and the record says which of the two was left.
    expiry_fallback = False
    if (
        result is not None
        and result.retcode != mt5.TRADE_RETCODE_DONE
        and "expiration" in request
        and retcode_name(mt5, result.retcode) in EXPIRY_RETCODES
    ):
        request.pop("expiration", None)
        request["type_time"] = mt5.ORDER_TIME_GTC
        expiry_fallback = True
        result, mode, attempts = send_with_retries(mt5, request, filling_modes(mt5, info), refresh_price)
    answer = summarise(mt5, result, mode)
    record = {
        **base,
        "plan": plan,
        "entry_type": entry_type,
        "entry_price": float(args.entry_price) if args.entry_price else price,
        "expiry_fallback": expiry_fallback,
        "symbol_min_volume": float(info.volume_min),
        "symbol_volume_step": float(info.volume_step),
        "contract_size": float(info.trade_contract_size),
        "notional": round(volume * float(info.trade_contract_size) * float(request["price"]), 2),
        "request": request,
        "answer": answer,
        "answer_raw": result_fields(result),
        "attempts": attempts,
    }
    emit(record, journal, [
        f"OPEN {args.symbol} {args.side} {volume} lot {entry_type} at {request['price']} "
        f"(minimum for this symbol: {info.volume_min})",
        f"  answered {answer.get('retcode_name')} deal {answer.get('deal')} order {answer.get('order')}",
        f"  journal {journal}",
    ])
    return EXIT_OK if answer.get("done") else EXIT_BROKER


def close_order(mt5, args, journal):
    """Close one named position at the market, so what was executed can be read back as a closed trade."""
    base = {"at_utc": now_iso(), "tool": TOOL, "action": "close"}
    plan = plan_close(args)
    positions = mt5.positions_get(ticket=args.ticket)
    if not positions:
        return refuse(
            journal, base, f"refused: ticket {args.ticket} is not an open position on this account; nothing was sent.", plan
        )
    if len(positions) > 1:
        return refuse(
            journal, base, f"refused: ticket {args.ticket} matches {len(positions)} positions; nothing was sent.", plan
        )

    position = positions[0]
    info = mt5.symbol_info(position.symbol)
    if info is None:
        return refuse(journal, base, f"refused: {position.symbol} is not served by this terminal; nothing was sent.", plan)

    side = "buy" if position.type == mt5.POSITION_TYPE_BUY else "sell"
    closing_price_side = "sell" if side == "buy" else "buy"
    price, tick = tick_price(mt5, position.symbol, closing_price_side)
    if price is None:
        return refuse(
            journal, base, f"refused: {position.symbol} returned no tick, so there is no price to send; nothing was sent.", plan
        )

    volume, reason = resolve_volume(args.lots, info, args.max_lots, position_volume=float(position.volume))
    if reason:
        return refuse(journal, base, reason, plan)

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "volume": volume,
        "type": mt5.ORDER_TYPE_SELL if side == "buy" else mt5.ORDER_TYPE_BUY,
        "position": int(position.ticket),
        "price": price,
        "deviation": args.deviation,
        "magic": MAGIC,
        "comment": args.comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_RETURN,
    }

    def refresh_price(target):
        fresh, _ = tick_price(mt5, position.symbol, closing_price_side)
        if fresh:
            target["price"] = fresh

    result, mode, attempts = send_with_retries(mt5, request, filling_modes(mt5, info), refresh_price)
    answer = summarise(mt5, result, mode)
    record = {
        **base,
        "plan": plan,
        "position": {
            "ticket": int(position.ticket),
            "symbol": position.symbol,
            "side": side,
            "volume": float(position.volume),
            "price_open": float(position.price_open),
            "profit": float(position.profit),
            "swap": float(position.swap),
        },
        "partial": volume + 1e-9 < float(position.volume),
        "request": request,
        "answer": answer,
        "answer_raw": result_fields(result),
        "attempts": attempts,
    }
    emit(record, journal, [
        f"CLOSE {position.symbol} {side} {volume} lot of ticket {position.ticket} at {price}",
        f"  answered {answer.get('retcode_name')} deal {answer.get('deal')} order {answer.get('order')}",
        f"  journal {journal}",
    ])
    return EXIT_OK if answer.get("done") else EXIT_BROKER


def modify_order(mt5, args, journal):
    """Move the levels of one position this tool placed, without opening or closing anything.

    The rule's own adjustment arrives here: a trade that has run to twice the risk it was placed with has its stop
    taken to breakeven rather than left where it was placed. That is a level change on a position that already
    exists, so the request is `TRADE_ACTION_SLTP` on the position's own ticket - not an order and not a deal - and
    the take-profit is carried through unchanged when the caller states none, because the terminal reads an `SlTp`
    request with no target in it as a request to clear the target.

    The stop is judged against the price a position of this side would actually close at - the bid for a long, the
    ask for a short, the same price `close` sends to - so a stop the market is already through is refused here
    rather than left to the terminal, which could only answer it by closing the position on the spot. A ticket
    carrying another path's magic is refused for the reason the other actions refuse one: a tool that moves what
    it did not place is a tool that can move anything. Exactly one attempt is made, deliberately: an `SlTp`
    request carries no price of its own, so a requote cannot be its answer, and resending the same levels would
    ask the same question twice. The terminal's own answer is journaled.
    """
    base = {"at_utc": now_iso(), "tool": TOOL, "action": "modify"}
    plan = plan_modify(args)
    positions = mt5.positions_get(ticket=args.ticket)
    if not positions:
        return refuse(
            journal,
            base,
            f"refused: ticket {args.ticket} is not an open position on this account; nothing was sent. A working "
            "pending order is removed with the cancel action rather than this one, and a position is closed with "
            "the close action.",
            plan,
        )
    if len(positions) > 1:
        return refuse(
            journal, base, f"refused: ticket {args.ticket} matches {len(positions)} positions; nothing was sent.", plan
        )

    position = positions[0]
    if int(position.magic) != MAGIC:
        return refuse(
            journal,
            base,
            f"refused: ticket {position.ticket} carries magic {int(position.magic)}, not this tool's {MAGIC}: another "
            "path placed it, and this tool moves only what it placed. Nothing was sent.",
            plan,
        )
    info = mt5.symbol_info(position.symbol)
    if info is None:
        return refuse(journal, base, f"refused: {position.symbol} is not served by this terminal; nothing was sent.", plan)

    side = "buy" if position.type == mt5.POSITION_TYPE_BUY else "sell"
    closing_price_side = "sell" if side == "buy" else "buy"
    price, tick = tick_price(mt5, position.symbol, closing_price_side)
    if price is None:
        return refuse(
            journal,
            base,
            f"refused: {position.symbol} returned no tick, so there is no market for the new stop to be judged "
            "against; nothing was sent.",
            plan,
        )

    stop_loss = float(args.stop_loss)
    # The position's own target, carried through: a `tp` of zero is the terminal's "no target", and it is passed on
    # as no target rather than as a price of zero.
    take_profit = float(args.take_profit) if args.take_profit else (float(position.tp) or None)
    ordered, reason = prices_are_ordered(side, stop_loss, take_profit, price)
    if not ordered:
        return refuse(journal, base, reason, plan)
    minimum = float(getattr(info, "trade_stops_level", 0) or 0) * float(info.point or 0)
    if minimum > 0 and abs(stop_loss - price) + 1e-12 < minimum:
        return refuse(
            journal,
            base,
            f"refused: the new stop sits {abs(stop_loss - price)} from the market and {info.name} will not accept a "
            f"level closer than {minimum} to it; nothing was sent.",
            plan,
        )

    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": position.symbol,
        "position": int(position.ticket),
        "sl": stop_loss,
        "magic": MAGIC,
        "comment": args.comment,
    }
    if take_profit is not None:
        request["tp"] = take_profit

    result = mt5.order_send(request)
    answer = summarise(mt5, result, None)
    record = {
        **base,
        "plan": plan,
        "position": {
            "ticket": int(position.ticket),
            "symbol": position.symbol,
            "side": side,
            "volume": float(position.volume),
            "price_open": float(position.price_open),
            "stop_loss": float(position.sl) or None,
            "take_profit": float(position.tp) or None,
            "profit": float(position.profit),
            "swap": float(position.swap),
        },
        "reference_price": price,
        "request": request,
        "answer": answer,
        "answer_raw": result_fields(result),
        "attempts": 1,
    }
    emit(record, journal, [
        f"MODIFY {position.symbol} {side} position {position.ticket}: stop-loss {float(position.sl) or None} -> "
        f"{stop_loss} (take-profit {take_profit if take_profit is not None else 'none'})",
        f"  answered {answer.get('retcode_name')} deal {answer.get('deal')}",
        f"  journal {journal}",
    ])
    return EXIT_OK if answer.get("done") else EXIT_BROKER


def cancel_order(mt5, args, journal):
    """Remove one working pending order this tool placed, because the reason for the entry has gone.

    A pending entry is a limit left at a marked line, so taking it back out is a removal rather than a closing
    deal: `close` acts on a position that already exists, and this acts on an order that has not become one.
    Three refusals stand in front of the send, and each names the fact it is: a ticket that is not a working
    pending order on this account at all - a read of `orders_get`, so a position is not one and the message says
    which action closes one - a ticket that carries another path's magic, and the tool's own `--confirm-live`.

    Exactly one attempt is made, deliberately: a removal is not a price-bearing request, so a requote cannot be
    the answer and sending it twice would be asking to remove two things. The terminal's own answer is journaled.
    """
    base = {"at_utc": now_iso(), "tool": TOOL, "action": "cancel"}
    plan = plan_cancel(args)
    orders = mt5.orders_get(ticket=args.ticket)
    if not orders:
        return refuse(
            journal,
            base,
            f"refused: ticket {args.ticket} is not a working pending order on this account; nothing was sent. "
            "A position is closed with the close action rather than this one, and an entry that has already "
            "filled or run out has nothing left to remove.",
            plan,
        )
    if len(orders) > 1:
        return refuse(
            journal,
            base,
            f"refused: ticket {args.ticket} matches {len(orders)} pending orders; nothing was sent.",
            plan,
        )

    order = orders[0]
    if int(order.magic) != MAGIC:
        return refuse(
            journal,
            base,
            f"refused: ticket {order.ticket} carries magic {int(order.magic)}, not this tool's {MAGIC}: another "
            "path placed it, and this tool removes only what it placed. Nothing was sent.",
            plan,
        )

    side = "buy" if order.type in (
        mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_BUY_LIMIT, mt5.ORDER_TYPE_BUY_STOP
    ) else "sell"
    request = {
        "action": mt5.TRADE_ACTION_REMOVE,
        "order": int(order.ticket),
        "magic": MAGIC,
        "comment": args.comment,
    }
    result = mt5.order_send(request)
    answer = summarise(mt5, result, None)
    record = {
        **base,
        "plan": plan,
        "order": {
            "ticket": int(order.ticket),
            "symbol": order.symbol,
            "type": order_type_name(mt5, order.type),
            "side": side,
            "volume": float(order.volume_current or order.volume_initial),
            "price_open": float(order.price_open),
            "stop_loss": float(order.sl) or None,
            "take_profit": float(order.tp) or None,
            "comment": order.comment,
            "magic": int(order.magic),
        },
        "request": request,
        "answer": answer,
        "answer_raw": result_fields(result),
        "attempts": 1,
    }
    emit(record, journal, [
        f"CANCEL {order.symbol} {side} {float(order.volume_current or order.volume_initial)} lot pending entry "
        f"at {order.price_open} (ticket {order.ticket})",
        f"  answered {answer.get('retcode_name')} order {answer.get('order')}",
        f"  journal {journal}",
    ])
    return EXIT_OK if answer.get("done") else EXIT_BROKER


def report_status(mt5, args, journal):
    """What the account holds right now: read-only, and the same rows the feed publishes."""
    positions = mt5.positions_get(ticket=args.ticket) if args.ticket else mt5.positions_get()
    orders = mt5.orders_get()
    account = mt5.account_info()
    rows = []
    for position in positions or ():
        rows.append({
            "ticket": int(position.ticket),
            "symbol": position.symbol,
            "side": "buy" if position.type == mt5.POSITION_TYPE_BUY else "sell",
            "volume": float(position.volume),
            "price_open": float(position.price_open),
            "price_current": float(position.price_current),
            "stop_loss": float(position.sl) or None,
            "take_profit": float(position.tp) or None,
            "profit": float(position.profit),
            "swap": float(position.swap),
            "comment": position.comment,
            "magic": int(position.magic),
        })
    # The pending orders as well as the positions. A ticket left as a limit is neither, and a caller that
    # has to know whether its own ticket is still working - the trader loop beside this tool - cannot read
    # that off the positions alone.
    order_rows = []
    for order in orders or ():
        order_rows.append({
            "ticket": int(order.ticket),
            "symbol": order.symbol,
            "type": order_type_name(mt5, order.type),
            "side": "buy" if order.type in (
                mt5.ORDER_TYPE_BUY, mt5.ORDER_TYPE_BUY_LIMIT, mt5.ORDER_TYPE_BUY_STOP
            ) else "sell",
            "volume": float(order.volume_current or order.volume_initial),
            "price_open": float(order.price_open),
            "stop_loss": float(order.sl) or None,
            "take_profit": float(order.tp) or None,
            "expiration": int(order.time_expiration) or None,
            "comment": order.comment,
            "magic": int(order.magic),
        })
    record = {
        "at_utc": now_iso(),
        "tool": TOOL,
        "action": "status",
        "account": None if account is None else {
            "login_masked": "***" + str(account.login)[-3:],
            "balance": account.balance,
            "equity": account.equity,
            "positions_open": len(positions or ()),
            "orders_open": len(orders or ()),
        },
        "ticket_filter": args.ticket,
        "positions": rows,
        "orders": order_rows,
    }
    emit(record, journal, [f"STATUS {len(rows)} position(s), {len(order_rows)} pending order(s)"])
    return EXIT_OK




def build_parser():
    parser = argparse.ArgumentParser(
        prog="live-trading-order.py",
        add_help=False,
        description="Place and close one trade at a time, deliberately, from the terminal's own session.",
    )
    parser.add_argument("action", nargs="?", default="help", choices=list(ACTIONS))
    parser.add_argument("--symbol", default="BTCUSD", help=f"one of {', '.join(ALLOWED_SYMBOLS)}")
    parser.add_argument("--side", default="buy", choices=list(SIDES))
    parser.add_argument("--lots", type=float, default=None)
    parser.add_argument("--max-lots", dest="max_lots", type=float, default=None)
    parser.add_argument("--ticket", type=int, default=None)
    parser.add_argument("--stop-loss", dest="stop_loss", type=float, default=None)
    parser.add_argument("--take-profit", dest="take_profit", type=float, default=None)
    parser.add_argument("--entry-price", dest="entry_price", type=float, default=None)
    parser.add_argument("--expire-minutes", dest="expire_minutes", type=int, default=None)
    parser.add_argument("--comment", default=DEFAULT_COMMENT)
    parser.add_argument("--deviation", type=int, default=DEFAULT_DEVIATION_POINTS)
    parser.add_argument("--path", default=None)
    parser.add_argument("--journal", default=DEFAULT_JOURNAL)
    parser.add_argument("--confirm-live", dest="confirm_live", action="store_true")
    parser.add_argument("--help", dest="help", action="store_true")
    return parser


def main(argv=None):
    args = build_parser().parse_args(sys.argv[1:] if argv is None else argv)
    if args.action == "help" or args.help:
        print(USAGE)
        return EXIT_OK

    reason, code = guard_before_broker(args)
    if reason:
        base = {"at_utc": now_iso(), "tool": TOOL, "action": args.action, "plan": None}
        if args.action == "open":
            base["plan"] = plan_open(args)
        elif args.action == "close":
            base["plan"] = plan_close(args)
        elif args.action == "modify":
            base["plan"] = plan_modify(args)
        elif args.action == "cancel":
            base["plan"] = plan_cancel(args)
        return refuse(
            args.journal,
            base,
            f"{reason} (nothing was imported, attached to, or sent to the terminal.)"
        )

    mt5 = attach(args.path)
    try:
        if args.action == "open":
            return open_order(mt5, args, args.journal)
        if args.action == "close":
            return close_order(mt5, args, args.journal)
        if args.action == "modify":
            return modify_order(mt5, args, args.journal)
        if args.action == "cancel":
            return cancel_order(mt5, args, args.journal)
        return report_status(mt5, args, args.journal)
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    sys.exit(main())
