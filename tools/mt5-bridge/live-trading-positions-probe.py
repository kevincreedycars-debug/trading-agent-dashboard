#!/usr/bin/env python
"""Read one MT5 terminal's open positions and working orders. Read-only, for the cTrader copier.

The copier's source side has to be the account itself, not a document another lane publishes on its own
schedule: a copy placed five minutes after the entry is not a copy. This probe attaches to one terminal by
path, reads `positions_get` and `orders_get`, and prints a document. It calls no order function and opens no
deal - there is no send path in this file at all - so running it cannot move the FTMO-1 account.

Fields per position: ticket, symbol, side, volume (lots), entry price, stop loss and take profit as the
terminal holds them, magic, comment and open time. The contract size comes from the symbol, because the
copier converts size into the destination's own lots and cannot do that from lots alone.

Usage:
  python tools/mt5-bridge/live-trading-positions-probe.py --path "<terminal folder>" [--magic 20261006]
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import MetaTrader5 as mt5

SCHEMA_VERSION = 1


def resolve_path(value):
    """`terminal64.exe` or the folder that holds it, the same rule the snapshot uses for `--path`."""
    if not value:
        return None
    candidate = Path(value)
    if candidate.is_file():
        return str(candidate)
    if candidate.is_dir():
        executable = candidate / "terminal64.exe"
        return str(candidate if not executable.exists() else executable)
    return str(candidate)


def iso(moment):
    return None if moment is None else datetime.fromtimestamp(int(moment), timezone.utc).isoformat().replace("+00:00", "Z")


def position_row(row):
    return {
        "ticket": int(row.ticket),
        "symbol": row.symbol,
        "side": "buy" if row.type == mt5.POSITION_TYPE_BUY else "sell",
        "volume": float(row.volume),
        "price_open": float(row.price_open),
        "price_current": float(row.price_current),
        "stop_loss": float(row.sl),
        "take_profit": float(row.tp),
        "magic": int(row.magic),
        "comment": row.comment,
        "time_utc": iso(row.time),
        "profit": float(row.profit),
    }


def order_kind_name(kind):
    if kind in (mt5.ORDER_TYPE_BUY_LIMIT, mt5.ORDER_TYPE_SELL_LIMIT):
        return "limit"
    if kind in (mt5.ORDER_TYPE_BUY_STOP, mt5.ORDER_TYPE_SELL_STOP):
        return "stop"
    return "stop_limit"


def order_row(row):
    return {
        "ticket": int(row.ticket),
        "symbol": row.symbol,
        "side": "buy" if row.type in (mt5.ORDER_TYPE_BUY_LIMIT, mt5.ORDER_TYPE_BUY_STOP) else "sell",
        "kind": int(row.type),
        "kind_name": order_kind_name(row.type),
        "volume": float(row.volume_current),
        "price_open": float(row.price_open),
        "stop_loss": float(row.sl),
        "take_profit": float(row.tp),
        "magic": int(row.magic),
        "comment": row.comment,
        "time_setup_utc": iso(row.time_setup),
        "time_expiration_utc": iso(row.time_expiration) if int(row.time_expiration) > 0 else None,
    }


def probe(path=None):
    """Return the probe document. A missing terminal or a raised call is described, never thrown."""
    started = datetime.now(timezone.utc)
    document = {
        "schema_version": SCHEMA_VERSION,
        "probed_at_utc": started.isoformat().replace("+00:00", "Z"),
        "read_only": True,
        "order_functions_called": False,
        "path_requested": resolve_path(path),
        "ok": False,
        "error": None,
        "account": None,
        "positions": [],
        "orders": [],
        "contract_sizes": {},
    }
    resolved = resolve_path(path)
    initialized = mt5.initialize(path=resolved) if resolved else mt5.initialize()
    if not initialized:
        code, message = mt5.last_error()
        document["error"] = {"code": code, "message": message, "note": "No terminal reachable at the stated path."}
        return document
    try:
        account = mt5.account_info()
        if account is None:
            code, message = mt5.last_error()
            document["error"] = {"code": code, "message": message, "note": "The terminal is not logged in."}
            return document
        document["account"] = {
            "login": int(account.login),
            "server": account.server,
            "company": account.company,
            "currency": account.currency,
            "balance": float(account.balance),
            "equity": float(account.equity),
            "trade_allowed": bool(account.trade_allowed),
        }
        for row in sorted(mt5.positions_get() or (), key=lambda item: item.ticket):
            document["positions"].append(position_row(row))
        for row in sorted(mt5.orders_get() or (), key=lambda item: item.ticket):
            document["orders"].append(order_row(row))
        for name in sorted({row["symbol"] for row in document["positions"] + document["orders"]}):
            info = mt5.symbol_info(name)
            if info is not None:
                document["contract_sizes"][name] = float(info.trade_contract_size)
        document["ok"] = True
        return document
    except Exception as error:  # a probe must describe a failure, not become one
        document["error"] = {"code": None, "message": repr(error), "note": "The probe raised."}
        return document
    finally:
        mt5.shutdown()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Read one MT5 terminal's open positions and working orders. Read-only."
    )
    parser.add_argument("--path", default=None, help="Terminal64.exe or its folder; omitted means 'any terminal'.")
    parser.add_argument("--out", default=None, help="Optional file; the document is printed to stdout either way.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    document = probe(path=args.path)
    text = json.dumps(document, indent=2, default=str)
    print(text)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(text, encoding="utf-8")
    return 0 if document["ok"] else 2


if __name__ == "__main__":
    sys.exit(main())
