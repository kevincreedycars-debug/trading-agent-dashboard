"""Read one lane's account identity, permissions and symbol rules. Read-only, by construction.

The snapshot producer answers "what is the market doing"; the order tool is the one file that may name an
order call. This probe answers a third question, the one a migration asks before anything is armed: *is this
the account I think it is, may it trade, and does it carry the instruments the plan already names?*

Three facts make it worth a separate file rather than a flag on the snapshot:

- it is run per lane against one terminal, and a lane whose account does not match its configuration must be
  refused before a trader is armed, not discovered afterwards in a heartbeat;
- on a host with two terminals, `mt5.initialize()` with no path attaches to whichever terminal is reachable,
  so the path is an argument here and is echoed back in the document;
- it must print a machine-readable answer (`ConvertFrom-Json` in prepare-live-trading-host.ps1), which is a
  different contract from the snapshot's human summary.

No order function is imported or called in this file, and the test suite asserts the names are absent rather
than trusting this sentence. `symbol_info` is read without selecting, so the probe cannot even change what the
terminal shows in Market Watch; a symbol the terminal knows but does not carry in Market Watch is reported as
`visible: false` with the reason, which is the operator's cue rather than something this file fixes.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import MetaTrader5 as mt5

SCHEMA_VERSION = "live-trading-account-probe-v1"

# The package's enums, spelled out so the document can be read without the Python package to hand.
TRADE_MODE_NAMES = {
    0: "disabled",
    1: "long_only",
    2: "short_only",
    3: "close_only",
    4: "full",
}
FILLING_NAMES = {
    0: "fok",
    1: "ioc",
    2: "return",
}
MARGIN_MODE_NAMES = {
    0: "retail_netting",
    1: "exchange",
    2: "retail_hedging",
}


def mask_login(login):
    """The account card's own masking: never the full login, in this document or in a log."""
    return None if login is None else "***" + str(login)[-3:]


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



def probe(symbols, path=None):
    """Return the probe document. Never raises for a missing terminal: that is a document, not a crash."""
    started = datetime.now(timezone.utc)
    document = {
        "schema_version": SCHEMA_VERSION,
        "probed_at_utc": started.isoformat().replace("+00:00", "Z"),
        "read_only": True,
        "order_functions_called": False,
        "path_requested": resolve_path(path),
        "ok": False,
        "error": None,
        "terminal": None,
        "account": None,
        "symbols": [],
    }

    # The package takes the executable, not the folder it sits in, so the same `resolve_path` the snapshot
    # uses is applied here: `--path <folder>` is the form a person types off the task's own command line.
    resolved = resolve_path(path)
    initialized = mt5.initialize(path=resolved) if resolved else mt5.initialize()
    if not initialized:
        code, message = mt5.last_error()
        document["error"] = {
            "code": code,
            "message": message,
            "note": (
                "No terminal reachable. MT5 must be installed, running and logged in inside the same "
                "Windows session as this process; the package cannot log in for you."
            ),
        }
        return document

    try:
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        if terminal is None or account is None:
            code, message = mt5.last_error()
            document["error"] = {
                "code": code,
                "message": message,
                "note": "A terminal answered but no account was readable: it is running and not logged in.",
            }
            return document

        document["terminal"] = {
            "name": terminal.name,
            "company": terminal.company,
            "path": terminal.path,
            "data_path": terminal.data_path,
            "build": terminal.build,
            "connected": bool(terminal.connected),
            "community_account": bool(terminal.community_account),
            "trade_allowed": bool(terminal.trade_allowed),
            "dlls_allowed": bool(terminal.dlls_allowed),
            "maxbars": terminal.maxbars,
            "language": terminal.language,
        }
        document["account"] = {
            "login_masked": mask_login(account.login),
            "server": account.server,
            "company": account.company,
            "currency": account.currency,
            "leverage": account.leverage,
            "balance": account.balance,
            "equity": account.equity,
            "margin_free": account.margin_free,
            "margin_mode": MARGIN_MODE_NAMES.get(account.margin_mode, str(account.margin_mode)),
            "margin_so_call": account.margin_so_call,
            "margin_so_so": account.margin_so_so,
            "trade_allowed": bool(account.trade_allowed),
            "trade_expert": bool(account.trade_expert),
            "positions_open": len(mt5.positions_get() or ()),
            "orders_open": len(mt5.orders_get() or ()),
        }

        for symbol in symbols:
            document["symbols"].append(probe_symbol(symbol))

        document["ok"] = True
        return document
    except Exception as error:  # a probe must describe a failure, not become one
        document["error"] = {"code": None, "message": repr(error), "note": "The probe raised."}
        return document
    finally:
        mt5.shutdown()


def probe_symbol(symbol):
    """One instrument, read without selecting it: known, in Market Watch, tradable, and at what rules."""
    entry = {
        "symbol": symbol,
        "known": False,
        "visible": False,
        "trade_mode": None,
        "trade_mode_name": None,
        "tradable": False,
        "filling_mode": None,
        "filling_name": None,
        "digits": None,
        "point": None,
        "contract_size": None,
        "min_volume": None,
        "volume_step": None,
        "volume_max": None,
        "stops_level": None,
        "freeze_level": None,
        "spread_points": None,
        "error": None,
    }
    known = mt5.symbols_get(symbol)
    if not known:
        entry["error"] = f"the terminal does not list {symbol} at all"
        return entry
    entry["known"] = True

    info = mt5.symbol_info(symbol)
    if info is None:
        entry["error"] = f"{symbol} exists on the server but is not carried in Market Watch"
        return entry

    entry.update({
        "visible": bool(info.visible),
        "trade_mode": info.trade_mode,
        "trade_mode_name": TRADE_MODE_NAMES.get(info.trade_mode, str(info.trade_mode)),
        # The rule the trader needs: full trading. Close-only or disabled reads as not tradable even though
        # the symbol is there, which is exactly the state an account can be in after a permission change.
        "tradable": info.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL and bool(info.visible),
        "filling_mode": info.filling_mode,
        "filling_name": FILLING_NAMES.get(info.filling_mode, str(info.filling_mode)),
        "digits": info.digits,
        "point": info.point,
        "contract_size": info.trade_contract_size,
        "min_volume": info.volume_min,
        "volume_step": info.volume_step,
        "volume_max": info.volume_max,
        "stops_level": info.trade_stops_level,
        "freeze_level": info.trade_freeze_level,
        "spread_points": info.spread,
    })
    return entry


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Read one MT5 terminal's account identity, trading permissions and symbol rules. Read-only."
    )
    parser.add_argument("--path", default=None, help="Terminal64.exe or its folder; omitted means 'any terminal'.")
    parser.add_argument(
        "--symbols",
        default="",
        help="Comma-separated instruments to check, usually the ones the published plan names.",
    )
    parser.add_argument("--out", default=None, help="Optional file; the document is printed to stdout either way.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    symbols = [item.strip() for item in args.symbols.split(",") if item.strip()]
    document = probe(symbols, path=args.path)
    text = json.dumps(document, indent=2, default=str)
    print(text)
    if args.out:
        target = Path(args.out)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text + "\n", encoding="utf-8")
    return 0 if document["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

