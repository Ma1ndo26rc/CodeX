from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import requests

from .config import CONFIG
from .fetchers import REQUEST_HEADERS


MARKET_SYMBOLS = {
    "SPY": "SPY",
    "QQQ": "QQQ",
    "VIX": "^VIX",
    "10Y Yield": "^TNX",
}


def fetch_market_data() -> dict:
    items = []
    for label, symbol in MARKET_SYMBOLS.items():
        items.append(_fetch_symbol(label, symbol))

    return {"as_of": datetime.now().isoformat(), "items": items}


def update_market_data_files(output_dir: Path | None = None) -> dict:
    output_dir = output_dir or CONFIG.report_output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    snapshot = fetch_market_data()
    previous_trends = _read_json(output_dir / "market_trends.json", None)
    trends = _merge_with_previous_trends(fetch_market_trends(), previous_trends)
    snapshot_path = output_dir / "market_snapshot.json"
    trends_path = output_dir / "market_trends.json"
    history_path = append_market_history(snapshot, output_dir)

    _write_json(snapshot_path, snapshot)
    _write_json(trends_path, trends)
    _update_market_analysis_snapshot(output_dir / "market_analysis.json", snapshot)
    return {
        "snapshot": snapshot,
        "trends": trends,
        "snapshot_path": str(snapshot_path),
        "trends_path": str(trends_path),
        "history_path": str(history_path),
    }


def fetch_market_trends(range_period: str = "1mo", interval: str = "1d") -> dict:
    series = []
    for label, symbol in MARKET_SYMBOLS.items():
        series.append(_fetch_symbol_trend(label, symbol, range_period, interval))

    return {
        "as_of": datetime.now().isoformat(),
        "range": range_period,
        "interval": interval,
        "series": series,
    }


def append_market_history(snapshot: dict, output_dir: Path | None = None, max_points: int = 500) -> Path:
    output_dir = output_dir or CONFIG.report_output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    history_path = output_dir / "market_history.json"
    history = _read_json(history_path, {"updated_at": None, "series": {}})
    history.setdefault("series", {})
    timestamp = snapshot.get("as_of") or datetime.now().isoformat()

    for item in snapshot.get("items", []):
        name = item.get("name") or item.get("symbol")
        if not name:
            continue
        points = history["series"].setdefault(name, [])
        if points and points[-1].get("time") == timestamp:
            continue
        points.append(
            {
                "time": timestamp,
                "symbol": item.get("symbol"),
                "price": item.get("price"),
                "change_pct": item.get("change_pct"),
            }
        )
        history["series"][name] = points[-max_points:]

    history["updated_at"] = datetime.now().isoformat()
    _write_json(history_path, history)
    return history_path


def _fetch_symbol(label: str, symbol: str) -> dict:
    try:
        result = _fetch_chart_result(symbol, {"range": "2d", "interval": "5m"})
        meta = result.get("meta", {})
        price = meta.get("regularMarketPrice")
        previous = meta.get("chartPreviousClose") or meta.get("previousClose")
        change = float(price) - float(previous) if price is not None and previous is not None else None
        change_pct = (change / float(previous) * 100) if change is not None and previous else None
        return {
            "name": label,
            "symbol": symbol,
            "price": _format_price(label, price),
            "change": _round(_format_tnx_change(label, change)),
            "change_pct": _round(change_pct),
            "market_time": meta.get("regularMarketTime"),
        }
    except Exception as exc:
        return {"name": label, "symbol": symbol, "price": None, "change": None, "change_pct": None, "error": str(exc)}


def _fetch_symbol_trend(label: str, symbol: str, range_period: str, interval: str) -> dict:
    try:
        result = _fetch_chart_result(symbol, {"range": range_period, "interval": interval})
        timestamps = result.get("timestamp", [])
        quotes = result.get("indicators", {}).get("quote", [{}])[0]
        closes = quotes.get("close", [])
        points = []
        for timestamp, close in zip(timestamps, closes):
            if close is None:
                continue
            points.append(
                {
                    "time": datetime.fromtimestamp(timestamp).isoformat(),
                    "price": _format_price(label, close),
                }
            )

        return {"name": label, "symbol": symbol, "points": points}
    except Exception as exc:
        return {"name": label, "symbol": symbol, "points": [], "error": str(exc)}


def _fetch_chart_result(symbol: str, params: dict) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    last_error = None
    for _ in range(2):
        try:
            response = requests.get(
                url,
                params=params,
                headers=REQUEST_HEADERS,
                timeout=CONFIG.market_data_timeout_seconds,
            )
            response.raise_for_status()
            return response.json().get("chart", {}).get("result", [{}])[0]
        except Exception as exc:
            last_error = exc
    raise last_error


def _merge_with_previous_trends(current: dict, previous: dict | None) -> dict:
    if not previous:
        return current
    previous_by_name = {item.get("name"): item for item in previous.get("series", [])}
    merged = []
    for item in current.get("series", []):
        if item.get("points"):
            merged.append(item)
        else:
            fallback = previous_by_name.get(item.get("name"))
            merged.append(fallback or item)
    current["series"] = merged
    return current


def _format_price(label: str, value) -> float | None:
    if value is None:
        return None
    number = float(value)
    if label == "10Y Yield" and number > 10:
        number = number / 10
    return round(number, 3)


def _format_tnx_change(label: str, value) -> float | None:
    if value is None:
        return None
    number = float(value)
    if label == "10Y Yield":
        number = number / 10
    return number


def _round(value) -> float | None:
    return round(float(value), 3) if value is not None else None


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _update_market_analysis_snapshot(path: Path, snapshot: dict) -> None:
    if not path.exists():
        return
    analysis = _read_json(path, None)
    if not isinstance(analysis, dict):
        return
    analysis["market_data"] = snapshot
    _write_json(path, analysis)
