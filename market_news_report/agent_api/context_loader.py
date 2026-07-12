from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from ..config import CONFIG


class ReportContextNotFoundError(FileNotFoundError):
    pass


class ReportContextLoadError(ValueError):
    pass


def load_research_context(
    report_id: str,
    *,
    reports_dir: Path | None = None,
) -> dict[str, Any]:
    root = reports_dir or CONFIG.report_output_dir
    path = root / "latest.json"
    if not path.exists():
        raise ReportContextNotFoundError(f"Latest market report not found: {path}")
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError as exc:
        raise ReportContextLoadError(f"Latest market report is not valid UTF-8: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise ReportContextLoadError(
            f"Latest market report contains invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(report, Mapping):
        raise ReportContextLoadError("Latest market report JSON root must be an object.")

    current_id = report_identifier(report)
    requested = str(report_id or "").strip()
    if requested not in {"latest", current_id}:
        raise ReportContextNotFoundError(
            f"Report {requested!r} is not available. Current report id is {current_id!r}."
        )
    return build_research_context(report)


def report_identifier(report: Mapping[str, Any]) -> str:
    report_type = _text(report.get("report_type")) or "latest"
    generated_at = _text(report.get("generated_at"))
    return f"{report_type}:{generated_at}" if generated_at else report_type


def build_research_context(report: Mapping[str, Any] | None) -> dict[str, Any]:
    """Python counterpart of the frontend ResearchContext v1 normalizer."""
    source = report if isinstance(report, Mapping) else {}
    events = _events(source)
    macro = _mapping(source.get("macro_analysis"))
    regime = _mapping(macro.get("market_regime"))
    asset_view = _mapping(macro.get("asset_view") or macro.get("market_impact"))
    watch = _mapping(macro.get("watch_next"))
    drivers = [_driver(item, index) for index, item in enumerate(_records(source.get("key_drivers")))]
    if not drivers:
        drivers = [_event_driver(item, index) for index, item in enumerate(events[:5])]
    risks = _risks(source, macro, events)
    themes = [_theme(item, index) for index, item in enumerate(_records(macro.get("themes"))[:4])]

    return {
        "market_state": {
            "report_type": _text(source.get("report_type")) or "latest",
            "report_label": _text(source.get("report_label")) or "Market Intelligence Brief",
            "generated_at": _text(source.get("generated_at")),
            "market_session": _text(source.get("market_session")),
            "source_window": _text(source.get("source_window")),
            "headline": _text(source.get("dynamic_headline")),
            "summary": _text(source.get("market_summary")),
            "regime": _text(regime.get("title")),
            "stance": _text(regime.get("stance")),
            "sentiment": _sentiment_label(events),
            "sentiment_score": _average([item["sentiment_score"] for item in events]),
            "confidence": _confidence(regime.get("confidence")),
            "index_performance_summary": _text(source.get("index_performance_summary")),
        },
        "market_snapshot": _snapshot(source.get("market_snapshot") or source.get("market_data")),
        "drivers": drivers,
        "risks": risks,
        "events": events,
        "macro_themes": themes,
        "asset_view": {
            "equities": _asset("US Equities", asset_view.get("equities")),
            "rates": _asset("Rates", asset_view.get("rates")),
            "growth_stocks": _asset("Growth Stocks", asset_view.get("growth_stocks")),
            "financials": _asset("Financials", asset_view.get("financials")),
            "sectors": _sectors(asset_view.get("sectors") or source.get("sector_theme_impact")),
        },
        "watch_next": {
            "macro_data": _strings(watch.get("macro_data")),
            "policy": _strings(watch.get("policy")),
            "company_events": _strings(watch.get("company_events")),
            "general": _general_watch(source),
        },
        "sources": _sources(events),
    }


def _events(report: Mapping[str, Any]) -> list[dict[str, Any]]:
    raw = next((value for value in (report.get("events"), report.get("key_events"), report.get("news_events")) if isinstance(value, list) and value), [])
    rows, seen = [], set()
    for index, item in enumerate(raw):
        if not isinstance(item, Mapping):
            continue
        title = _text(item.get("title"))
        event_id = _text(item.get("event_id") or item.get("id")) or f"event-{index + 1}"
        if not title or event_id in seen:
            continue
        seen.add(event_id)
        articles = _records(item.get("articles"))
        sources = _unique(_strings(item.get("source_names")) + [_text(row.get("source_name") or row.get("source")) for row in articles])
        urls = _unique(_strings(item.get("source_urls")) + [_text(row.get("source_url") or row.get("url")) for row in articles])
        rows.append({
            "id": event_id, "title": title, "summary": _text(item.get("one_line_summary") or item.get("summary")),
            "why_it_matters": _text(item.get("why_it_matters")), "sector": _text(item.get("sector")) or "Cross-market",
            "event_type": _text(item.get("event_type") or item.get("category")) or "Market event",
            "themes": _strings(item.get("topics") or item.get("themes")), "tickers": _strings(item.get("related_tickers") or item.get("tickers")),
            "entities": _strings(item.get("entities")), "affected_markets": _strings(item.get("affected_markets")),
            "impact_score": _bounded(item.get("impact_score") or item.get("market_impact_score") or item.get("final_score"), 0, 100),
            "sentiment_score": _bounded(item.get("sentiment_score"), -1, 1), "confidence_score": _nullable_number(item.get("confidence_score")),
            "priority": _text(item.get("priority_level")), "time_horizon": _text(item.get("time_horizon")),
            "published_at": _text(item.get("published_at")), "sources": sources, "source_urls": urls,
        })
    return rows


def _driver(item: Mapping[str, Any], index: int) -> dict[str, Any]:
    return {"id": _text(item.get("id")) or f"driver-{index + 1}", "name": _text(item.get("name") or item.get("title")) or f"Driver {index + 1}", "explanation": _text(item.get("explanation") or item.get("summary")), "importance_score": _bounded(item.get("importance_score") or item.get("impact_score"), 0, 100), "direction": _text(item.get("direction")) or "mixed", "affected_assets": _strings(item.get("affected_assets") or item.get("affected_markets")), "evidence_event_ids": _strings(item.get("evidence_event_ids"))}


def _event_driver(item: Mapping[str, Any], index: int) -> dict[str, Any]:
    return {"id": f"event-driver-{index + 1}", "name": item["title"], "explanation": item["why_it_matters"] or item["summary"], "importance_score": item["impact_score"], "direction": "positive" if item["sentiment_score"] > .1 else "negative" if item["sentiment_score"] < -.1 else "mixed", "affected_assets": item["affected_markets"], "evidence_event_ids": [item["id"]]}


def _risks(report: Mapping[str, Any], macro: Mapping[str, Any], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    explicit = _records(macro.get("risks") or report.get("risks") or report.get("risk_factors"))
    if explicit:
        return [{"id": _text(item.get("id")) or f"risk-{index + 1}", "title": _text(item.get("title") or item.get("name")), "description": _text(item.get("description") or item.get("analysis")), "level": _text(item.get("level")) or "medium", "affected_assets": _strings(item.get("affected_assets")), "evidence_event_ids": _strings(item.get("evidence_event_ids"))} for index, item in enumerate(explicit)]
    return [{"id": f"event-risk-{index + 1}", "title": item["title"], "description": item["why_it_matters"] or item["summary"], "level": "high" if item["impact_score"] >= 80 else "medium", "affected_assets": item["affected_markets"], "evidence_event_ids": [item["id"]]} for index, item in enumerate([event for event in events if event["sentiment_score"] < -.1][:5])]


def _theme(item: Mapping[str, Any], index: int) -> dict[str, Any]:
    impact = _mapping(item.get("market_impact"))
    return {"id": _text(item.get("id")) or f"macro-theme-{index + 1}", "title": _text(item.get("title") or item.get("name")), "current_view": _text(item.get("current_view") or item.get("summary")), "what_changed": _text(item.get("what_changed")), "why_it_matters": _text(item.get("why_it_matters")), "market_impact": {"equities": _text(impact.get("equities")), "rates": _text(impact.get("rates")), "sectors": _strings(impact.get("sectors"))}, "watch_next": _strings(item.get("watch_next"))}


def _snapshot(value: Any) -> dict[str, Any]:
    source = _mapping(value); rows = value if isinstance(value, list) else source.get("items") or source.get("indices") or []
    return {"as_of": _text(source.get("as_of") or source.get("updated_at")), "status": _text(source.get("status")), "items": [{"name": _text(item.get("name") or item.get("label")), "symbol": _text(item.get("symbol")), "price": _nullable_number(item.get("price") or item.get("last") or item.get("value")), "change_pct": _nullable_number(item.get("change_pct") or item.get("percent_change"))} for item in _records(rows)[:12]], "sentiment": source.get("sentiment") if isinstance(source.get("sentiment"), Mapping) else None}


def _asset(label: str, value: Any) -> dict[str, Any]:
    source = _mapping(value); return {"label": _text(source.get("label")) or label, "stance": _text(source.get("stance") or source.get("view")), "view": _text(source.get("view") or source.get("summary") or source.get("note")), "reason": _text(source.get("reason") or source.get("note") or source.get("summary"))}


def _sectors(value: Any) -> dict[str, list[str]]:
    source = _mapping(value[0] if isinstance(value, list) and value else value); return {"positive": _strings(source.get("positive") or source.get("winners")), "negative": _strings(source.get("negative") or source.get("losers"))}


def _general_watch(report: Mapping[str, Any]) -> list[str]:
    rows = report.get("what_to_watch_tomorrow") or []; return _unique([_text(item if isinstance(item, str) else item.get("item") or item.get("title")) for item in rows if isinstance(item, (str, Mapping))])


def _sources(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = {}; 
    for event in events:
        for index, name in enumerate(event["sources"]):
            key = (name, event["source_urls"][index] if index < len(event["source_urls"]) else ""); row = result.setdefault(key, {"name": key[0], "url": key[1], "event_count": 0, "event_ids": []}); row["event_count"] += 1; row["event_ids"].append(event["id"])
    return sorted(result.values(), key=lambda item: (-item["event_count"], item["name"]))


def _sentiment_label(events: list[dict[str, Any]]) -> str:
    value = _average([item["sentiment_score"] for item in events]); return "Risk-on" if value > .1 else "Risk-off" if value < -.1 else "Mixed"


def _confidence(value: Any) -> float | None:
    number = _nullable_number(value)
    if number is not None: return max(0, min(100, number))
    return {"high": 80, "moderate": 60, "medium": 60, "low": 35}.get(_text(value).lower())


def _average(values: list[float]) -> float: return round(sum(values) / len(values), 3) if values else 0
def _records(value: Any) -> list[Mapping[str, Any]]: return [item for item in value if isinstance(item, Mapping)] if isinstance(value, list) else []
def _mapping(value: Any) -> Mapping[str, Any]: return value if isinstance(value, Mapping) else {}
def _strings(value: Any) -> list[str]: return [_text(item) for item in value if _text(item)] if isinstance(value, list) else []
def _unique(values: list[str]) -> list[str]: return list(dict.fromkeys(value for value in values if value))
def _text(value: Any) -> str: return "" if value is None else str(value).strip()
def _number(value: Any) -> float:
    try: return float(value)
    except (TypeError, ValueError): return 0
def _nullable_number(value: Any) -> float | None:
    try: return float(value) if value is not None and value != "" else None
    except (TypeError, ValueError): return None
def _bounded(value: Any, low: float, high: float) -> float: return max(low, min(high, _number(value)))
