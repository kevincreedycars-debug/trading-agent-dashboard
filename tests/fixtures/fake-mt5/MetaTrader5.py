"""A stand-in for the broker package, for the order tool's own tests.

It is not a simulator and it decides nothing: it answers the handful of calls
`tools/mt5-bridge/live-trading-order.py` makes with whatever `FAKE_MT5_STATE` names, and it appends every
`order_send` it is given to `FAKE_MT5_SENDS` so a test can say what was sent - most importantly, that nothing was.

The state file is a JSON object:

    {
      "login": 7654321,
      "server": "FTMO-Server",
      "connected": true,
      "terminal_path": "C:\\\\Program Files\\\\FTMO Global Markets MT5 Terminal 2",
      "symbols": {"US100.cash": {"name": "US100.cash", "volume_min": 0.1, "volume_step": 0.1, "point": 0.01,
                                 "trade_stops_level": 10, "filling_mode": 2, "digits": 2}},
      "ticks": {"US100.cash": {"bid": 24990.0, "ask": 24991.0}},
      "positions": [], "orders": [],
      "login_after": {"calls": 1, "login": 1111111}
    }

`login_after` is the one piece of behaviour: from the (calls + 1)th `account_info` onward the terminal reports a
different login, which is how a test states the case the gate exists for - the account changed between the read at
the top of a run and the send at the bottom of it.
"""
import json
import os
from types import SimpleNamespace

STATE_PATH = os.environ.get("FAKE_MT5_STATE")
SENDS_PATH = os.environ.get("FAKE_MT5_SENDS")
COUNTER_PATH = os.environ.get("FAKE_MT5_COUNTER")

TRADE_RETCODE_DONE = 10009
TRADE_RETCODE_PLACED = 10008
TRADE_RETCODE_REQUOTE = 10004
TRADE_RETCODE_PRICE_CHANGED = 10020
TRADE_RETCODE_PRICE_OFF = 10021
TRADE_RETCODE_INVALID_FILL = 10030
TRADE_RETCODE_INVALID_EXPIRATION = 10022
TRADE_RETCODE_INVALID_EXPIRATION_TIME = 10023

ORDER_FILLING_FOK = 0
ORDER_FILLING_IOC = 1
ORDER_FILLING_RETURN = 2

TRADE_ACTION_DEAL = 1
TRADE_ACTION_PENDING = 5
TRADE_ACTION_SLTP = 6
TRADE_ACTION_REMOVE = 8

ORDER_TYPE_BUY = 0
ORDER_TYPE_SELL = 1
ORDER_TYPE_BUY_LIMIT = 2
ORDER_TYPE_SELL_LIMIT = 3
ORDER_TYPE_BUY_STOP = 4
ORDER_TYPE_SELL_STOP = 5

POSITION_TYPE_BUY = 0
POSITION_TYPE_SELL = 1

ORDER_TIME_GTC = 0
ORDER_TIME_DAY = 1
ORDER_TIME_SPECIFIED = 2
ORDER_TIME_SPECIFIED_DAY = 3


def _state():
    if not STATE_PATH or not os.path.exists(STATE_PATH):
        return {}
    with open(STATE_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _calls():
    """How many times `account_info` has been asked, counted in a file so a switch survives one call."""
    if not COUNTER_PATH:
        return 0
    try:
        with open(COUNTER_PATH, "r", encoding="utf-8") as handle:
            return int(handle.read().strip() or "0")
    except (OSError, ValueError):
        return 0


def _bump():
    calls = _calls() + 1
    if COUNTER_PATH:
        with open(COUNTER_PATH, "w", encoding="utf-8") as handle:
            handle.write(str(calls))
    return calls


def initialize(path=None, **kwargs):
    return True


def last_error():
    return (0, "no error")


def shutdown():
    return True


def account_info():
    state = _state()
    calls = _bump()
    login = state.get("login")
    after = state.get("login_after") or {}
    if after and calls > int(after.get("calls", 0)):
        login = after.get("login", login)
    if login is None:
        return None
    return SimpleNamespace(
        login=int(login),
        server=state.get("server", "FTMO-Server"),
        balance=float(state.get("balance", 10000.0)),
        equity=float(state.get("equity", 10000.0)),
        margin_free=float(state.get("margin_free", 10000.0)),
        currency=state.get("currency", "USD"),
        leverage=state.get("leverage", 30),
        company=state.get("company", "FTMO Global Markets Ltd"),
    )


def terminal_info():
    state = _state()
    return SimpleNamespace(
        name=state.get("terminal_name", "FTMO Global Markets MT5 Terminal 2"),
        path=state.get("terminal_path", "C:\\Program Files\\FTMO Global Markets MT5 Terminal 2"),
        build=state.get("build", 6296),
        connected=bool(state.get("connected", True)),
        trade_allowed=True,
    )
def symbol_info(symbol):
    state = _state()
    row = (state.get("symbols") or {}).get(symbol)
    if not row:
        return None
    return SimpleNamespace(
        name=row.get("name", symbol),
        digits=int(row.get("digits", 2)),
        point=float(row.get("point", 0.01)),
        volume_min=float(row.get("volume_min", 0.1)),
        volume_step=float(row.get("volume_step", 0.1)),
        volume_max=float(row.get("volume_max", 100.0)),
        trade_stops_level=int(row.get("trade_stops_level", 10)),
        trade_contract_size=float(row.get("trade_contract_size", 1.0)),
        filling_mode=int(row.get("filling_mode", 2)),
        trade_mode=int(row.get("trade_mode", 4)),
    )


def symbol_info_tick(symbol):
    state = _state()
    row = (state.get("ticks") or {}).get(symbol)
    if not row:
        return None
    return SimpleNamespace(
        bid=float(row.get("bid", 0.0)),
        ask=float(row.get("ask", 0.0)),
        time=int(row.get("time", 0)),
        time_msc=int(row.get("time_msc", 0)),
    )


def _rows(kind):
    state = _state()
    rows = []
    for row in state.get(kind) or []:
        rows.append(SimpleNamespace(
            ticket=int(row["ticket"]),
            symbol=row["symbol"],
            magic=int(row.get("magic", 0)),
            type=int(row.get("type", POSITION_TYPE_BUY)),
            volume=float(row.get("volume", 0.01)),
            volume_current=float(row.get("volume", 0.01)),
            volume_initial=float(row.get("volume", 0.01)),
            price_open=float(row.get("price_open", 0.0)),
            price_current=float(row.get("price_current", row.get("price_open", 0.0))),
            sl=float(row.get("sl", 0.0) or 0.0),
            tp=float(row.get("tp", 0.0) or 0.0),
            profit=float(row.get("profit", 0.0)),
            swap=float(row.get("swap", 0.0)),
            comment=row.get("comment", ""),
            time=int(row.get("time", 0)),
            time_expiration=int(row.get("time_expiration", 0) or 0),
        ))
    return rows


def positions_get(ticket=None, **kwargs):
    rows = _rows("positions")
    if ticket:
        return tuple(row for row in rows if row.ticket == int(ticket)) or None
    return tuple(rows)


def orders_get(ticket=None, **kwargs):
    rows = _rows("orders")
    if ticket:
        return tuple(row for row in rows if row.ticket == int(ticket)) or None
    return tuple(rows)


def order_send(request):
    """Every send is written down before it is answered, so "nothing was sent" is a fact a test can read."""
    if SENDS_PATH:
        with open(SENDS_PATH, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(request, default=str) + "\n")
    return SimpleNamespace(
        retcode=TRADE_RETCODE_DONE,
        deal=9000001,
        order=9000002,
        volume=request.get("volume"),
        price=request.get("price"),
        comment="fake",
        request_id=1,
    )
