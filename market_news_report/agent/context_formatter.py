from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping


CONTEXT_VERSION = "v1"
DEFAULT_LIMITS = {
    "drivers": 6,
    "risks": 6,
    "macro_themes": 4,
    "events": 12,
    "sources_per_event": 4,
    "watch_items_per_group": 6,
}


def format_research_context(
    context: Mapping[str, Any] | None,
    *,
    limits: Mapping[str, int] | None = None,
) -> dict[str, Any]:
    """Return a compact, JSON-safe subset of a MarketResearchContext.

    The formatter intentionally excludes news article bodies, images, report
    history, charts, and other fields that do not improve grounded analysis.
    """
    source = _mapping(context)
    active_limits = {**DEFAULT_LIMITS, **dict(limits or {})}

    compact = {
        "context_version": CONTEXT_VERSION,
        "market_state": _market_state(source.get("market_state")),
        "drivers": [
            _driver(item)
            for item in _records(source.get("drivers"))[: active_limits["drivers"]]
        ],
        "risks": [
            _risk(item)
            for item in _records(source.get("risks"))[: active_limits["risks"]]
        ],
        "macro_themes": [
            _macro_theme(item)
            for item in _records(source.get("macro_themes"))[: active_limits["macro_themes"]]
        ],
        "events": [
            _event(item, active_limits["sources_per_event"])
            for item in _records(source.get("events"))[: active_limits["events"]]
        ],
        "asset_view": _asset_view(source.get("asset_view")),
        "watch_next": _watch_next(
            source.get("watch_next"),
            active_limits["watch_items_per_group"],
        ),
    }
    return deepcopy(compact)


def _market_state(value: Any) -> dict[str, Any]:
    source = _mapping(value)
    return _pick(
        source,
        "report_type",
        "report_label",
        "generated_at",
        "market_session",
        "source_window",
        "headline",
        "summary",
        "regime",
        "stance",
        "sentiment",
        "sentiment_score",
        "confidence",
        "index_performance_summary",
    )


def _driver(value: Mapping[str, Any]) -> dict[str, Any]:
    return _pick(
        value,
        "id",
        "name",
        "explanation",
        "importance_score",
        "direction",
        "affected_assets",
        "evidence_event_ids",
    )


def _risk(value: Mapping[str, Any]) -> dict[str, Any]:
    return _pick(
        value,
        "id",
        "title",
        "description",
        "level",
        "affected_assets",
        "evidence_event_ids",
    )


def _macro_theme(value: Mapping[str, Any]) -> dict[str, Any]:
    return _pick(
        value,
        "id",
        "title",
        "current_view",
        "what_changed",
        "why_it_matters",
        "market_impact",
        "watch_next",
    )


def _event(value: Mapping[str, Any], source_limit: int) -> dict[str, Any]:
    event = _pick(
        value,
        "id",
        "title",
        "summary",
        "why_it_matters",
        "sector",
        "event_type",
        "themes",
        "tickers",
        "entities",
        "affected_markets",
        "impact_score",
        "sentiment_score",
        "confidence_score",
        "priority",
        "time_horizon",
        "published_at",
    )
    event["sources"] = _strings(value.get("sources"))[:source_limit]
    event["source_urls"] = _strings(value.get("source_urls"))[:source_limit]
    return event


def _asset_view(value: Any) -> dict[str, Any]:
    source = _mapping(value)
    return {
        "equities": _asset(source.get("equities")),
        "rates": _asset(source.get("rates")),
        "growth_stocks": _asset(source.get("growth_stocks")),
        "financials": _asset(source.get("financials")),
        "sectors": {
            "positive": _strings(_mapping(source.get("sectors")).get("positive")),
            "negative": _strings(_mapping(source.get("sectors")).get("negative")),
        },
    }


def _asset(value: Any) -> dict[str, Any]:
    return _pick(_mapping(value), "label", "stance", "view", "reason")


def _watch_next(value: Any, limit: int) -> dict[str, list[str]]:
    source = _mapping(value)
    return {
        key: _strings(source.get(key))[:limit]
        for key in ("macro_data", "policy", "company_events", "general")
    }


def _pick(source: Mapping[str, Any], *keys: str) -> dict[str, Any]:
    return {key: _json_value(source.get(key)) for key in keys if source.get(key) is not None}


def _json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return str(value)


def _records(value: Any) -> list[Mapping[str, Any]]:
    return [item for item in value if isinstance(item, Mapping)] if isinstance(value, list) else []


def _strings(value: Any) -> list[str]:
    return [str(item).strip() for item in value if str(item).strip()] if isinstance(value, list) else []


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}
