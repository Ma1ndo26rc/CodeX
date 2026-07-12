from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA = {
    "report_type": "close",
    "report_label": "Market Close Brief",
    "generated_at": "",
    "market_session": "US Market Close",
    "source_window": "Previous 24 hours through the market close cutoff",
    "data_freshness_warning": False,
    "dynamic_headline": "",
    "market_summary": "",
    "market_narrative": {
        "headline": "",
        "summary": "",
        "key_forces": [],
        "watch_next": [],
    },
    "index_performance_summary": "",
    "macro_outlook": "",
    "risk_and_sentiment": "",
    "key_drivers": [
        {
            "name": "",
            "importance_score": 0,
            "explanation": "",
            "affected_assets": [],
        }
    ],
    "sector_theme_impact": {
        "winners": [],
        "losers": [],
        "themes_to_watch": [],
    },
    "macro_analysis": {
        "market_regime": {
            "title": "",
            "summary": "",
            "key_takeaway": "",
            "stance": "",
            "confidence": "",
        },
        "themes": [
            {
                "title": "",
                "current_view": "",
                "what_changed": "",
                "why_it_matters": "",
                "market_impact": {
                    "equities": "",
                    "rates": "",
                    "sectors": [],
                },
                "watch_next": [],
            }
        ],
        "asset_view": {
            "equities": {
                "view": "",
                "reason": "",
            },
            "rates": {
                "view": "",
                "reason": "",
            },
            "growth_stocks": {
                "view": "",
                "reason": "",
            },
            "financials": {
                "view": "",
                "reason": "",
            },
            "sectors": [
                {
                    "positive": [],
                    "negative": [],
                }
            ],
        },
        "watch_next": {
            "macro_data": [],
            "policy": [],
            "company_events": [],
        },
    },
    "what_to_watch_tomorrow": [
        {
            "item": "",
            "type": "",
            "why_it_matters": "",
        }
    ],
    "market_data": {},
    "key_events": [
        {
            "title": "",
            "entities": [],
            "sector": "",
            "event_type": "",
            "summary": "",
            "market_impact_score": 0,
            "sentiment_score": 0.0,
            "time_horizon": "",
            "why_it_matters": "",
            "affected_markets": [],
            "topics": [],
            "related_tickers": [],
            "priority_level": "",
            "source_names": [],
            "source_urls": [],
            "image_urls": [],
            "image_paths": [],
        }
    ],
}

EVENT_SCHEMA = SCHEMA["key_events"][0]


class MarketJSONValidationError(ValueError):
    """Raised when market analysis JSON cannot be parsed or safely serialized."""


def empty_market_analysis() -> dict[str, Any]:
    data = deepcopy(SCHEMA)
    data["key_events"] = []
    data["key_drivers"] = []
    data["what_to_watch_tomorrow"] = []
    data["todays_themes"] = []
    data["news_items"] = []
    data["news_events"] = []
    return data


def parse_and_validate_market_json(raw_text: str | dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(raw_text, dict):
        payload = raw_text
    else:
        payload = _loads_market_json(raw_text or "")

    analysis = empty_market_analysis()
    report_type = normalize_report_type(payload.get("report_type"))
    defaults = report_metadata(report_type)
    analysis["report_type"] = report_type
    analysis["report_label"] = _to_str(payload.get("report_label")) or defaults["report_label"]
    analysis["generated_at"] = _to_str(payload.get("generated_at")) or defaults["generated_at"]
    analysis["market_session"] = _to_str(payload.get("market_session")) or defaults["market_session"]
    analysis["source_window"] = _to_str(payload.get("source_window")) or defaults["source_window"]
    analysis["data_freshness_warning"] = _to_bool(payload.get("data_freshness_warning"))
    analysis["dynamic_headline"] = _to_str(payload.get("dynamic_headline"))
    analysis["market_summary"] = _to_str(payload.get("market_summary"))
    analysis["market_narrative"] = _validate_market_narrative(payload.get("market_narrative"))
    analysis["index_performance_summary"] = _to_str(payload.get("index_performance_summary"))
    analysis["macro_outlook"] = _to_str(payload.get("macro_outlook"))
    analysis["risk_and_sentiment"] = _to_str(payload.get("risk_and_sentiment"))
    key_drivers = payload.get("key_drivers")
    analysis["key_drivers"] = [_validate_driver(item) for item in key_drivers if isinstance(item, dict)] if isinstance(key_drivers, list) else []
    analysis["sector_theme_impact"] = _validate_sector_impact(payload.get("sector_theme_impact"))
    analysis["macro_analysis"] = _validate_macro_analysis(payload.get("macro_analysis"))
    watch_items = payload.get("what_to_watch_tomorrow")
    analysis["what_to_watch_tomorrow"] = [_validate_watch_item(item) for item in watch_items if isinstance(item, dict)] if isinstance(watch_items, list) else []
    analysis["market_data"] = payload.get("market_data") if isinstance(payload.get("market_data"), dict) else {}
    analysis["translations"] = _validate_analysis_translations(payload.get("translations"))
    news_items = payload.get("news_items")
    analysis["news_items"] = [_validate_news_item(item) for item in news_items if isinstance(item, dict)] if isinstance(news_items, list) else []
    news_events = payload.get("news_events")
    analysis["news_events"] = [_validate_news_event(item) for item in news_events if isinstance(item, dict)] if isinstance(news_events, list) else []
    themes = payload.get("todays_themes")
    analysis["todays_themes"] = [_validate_theme(item) for item in themes if isinstance(item, dict)] if isinstance(themes, list) else []

    key_events = payload.get("key_events")
    if not isinstance(key_events, list):
        key_events = []
    analysis["key_events"] = [_validate_event(event) for event in key_events if isinstance(event, dict)]
    _validate_unicode_tree(analysis)
    return analysis


def serialize_market_json(analysis: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Validate, serialize as UTF-8 JSON, and verify an exact JSON round trip."""
    validated = parse_and_validate_market_json(analysis)
    try:
        text = json.dumps(validated, ensure_ascii=False, indent=2, allow_nan=False)
        encoded = text.encode("utf-8", errors="strict")
        decoded = encoded.decode("utf-8", errors="strict")
        reparsed = json.loads(decoded)
    except (TypeError, ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise MarketJSONValidationError(f"Market report JSON serialization failed: {exc}") from exc
    if not isinstance(reparsed, dict):
        raise MarketJSONValidationError("Market report JSON root must be an object after serialization.")
    if reparsed != validated:
        raise MarketJSONValidationError("Market report JSON changed during UTF-8 serialization round trip.")
    return validated, text


def write_validated_json(path: Path, payload: dict[str, Any]) -> None:
    """Write JSON as UTF-8 and immediately verify the bytes and parsed document."""
    validated, _ = serialize_market_json(payload)
    write_utf8_json(path, validated)


def write_utf8_json(path: Path, payload: dict[str, Any]) -> None:
    """Write any JSON object as strict UTF-8 and verify the saved document."""
    _validate_unicode_tree(payload)
    try:
        text = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False)
        encoded = text.encode("utf-8", errors="strict")
    except (TypeError, ValueError, UnicodeError) as exc:
        raise MarketJSONValidationError(f"JSON serialization failed for {path}: {exc}") from exc
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encoded)
    validate_json_file(path)


def validate_json_file(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
        text = raw.decode("utf-8", errors="strict")
    except (OSError, UnicodeDecodeError) as exc:
        raise MarketJSONValidationError(f"{path}: file is not valid UTF-8: {exc}") from exc
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise MarketJSONValidationError(
            f"{path}: invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(payload, dict):
        raise MarketJSONValidationError(f"{path}: JSON root must be an object.")
    _validate_unicode_tree(payload, location=str(path))
    return payload


def normalize_report_type(value: Any) -> str:
    return "premarket" if str(value or "").strip().lower() == "premarket" else "close"


def report_metadata(report_type: str, generated_at: str | None = None) -> dict[str, Any]:
    normalized = normalize_report_type(report_type)
    is_premarket = normalized == "premarket"
    return {
        "report_type": normalized,
        "report_label": "Pre-Market Brief" if is_premarket else "Market Close Brief",
        "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
        "market_session": "US Pre-Market" if is_premarket else "US Market Close",
        "source_window": (
            "Previous 24 hours through the pre-market cutoff"
            if is_premarket
            else "Previous 24 hours through the market close cutoff"
        ),
        "data_freshness_warning": False,
    }


def apply_report_metadata(
    analysis: dict[str, Any],
    report_type: str,
    *,
    source_window: str | None = None,
    data_freshness_warning: bool = False,
) -> dict[str, Any]:
    enriched = dict(analysis)
    enriched.update(report_metadata(report_type))
    if source_window:
        enriched["source_window"] = source_window
    enriched["data_freshness_warning"] = bool(data_freshness_warning)
    return enriched


def save_market_analysis(analysis: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "market_analysis.json"
    latest_path = output_dir / "latest.json"
    history_dir = output_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    validated, _ = serialize_market_json(analysis)
    report_type = normalize_report_type(validated.get("report_type"))
    report_date = _report_date(validated.get("generated_at"))
    typed_path = output_dir / f"{report_type}.json"
    history_path = history_dir / f"{report_date}-{report_type}.json"
    archive_path = output_dir / f"market_analysis_{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    for target in (path, latest_path, typed_path, history_path, archive_path):
        write_validated_json(target, validated)
    _write_history_index(output_dir)
    return path, archive_path


def load_market_analysis(path: Path) -> dict[str, Any]:
    return parse_and_validate_market_json(validate_json_file(path))


def _write_history_index(output_dir: Path) -> Path:
    history_dir = output_dir / "history"
    reports = []
    for history_path in history_dir.glob("*.json"):
        try:
            raw_report = json.loads(history_path.read_text(encoding="utf-8"))
            if not isinstance(raw_report, dict):
                continue
            report = parse_and_validate_market_json(raw_report)
        except (OSError, json.JSONDecodeError, MarketJSONValidationError) as exc:
            print(f"Skipping invalid history report {history_path}: {exc}")
            continue
        events = report.get("key_events") or report.get("news_events") or []
        impact_values = [float(event.get("market_impact_score", 0)) for event in events if isinstance(event, dict)]
        report_type = normalize_report_type(raw_report.get("report_type") or _type_from_filename(history_path.name))
        generated_at = _to_str(raw_report.get("generated_at"))
        reports.append(
            {
                "date": _report_date(generated_at, fallback=history_path.name[:10]),
                "report_type": report_type,
                "report_label": report.get("report_label") or report_metadata(report_type)["report_label"],
                "generated_at": generated_at,
                "market_session": report.get("market_session", ""),
                "source_window": report.get("source_window", ""),
                "data_freshness_warning": bool(report.get("data_freshness_warning", False)),
                "file": f"history/{history_path.name}",
                "dynamic_headline": report.get("dynamic_headline", ""),
                "dynamic_headline_zh": report.get("translations", {}).get("zh", {}).get("dynamic_headline", ""),
                "market_summary": report.get("market_summary", ""),
                "market_summary_zh": report.get("translations", {}).get("zh", {}).get("market_summary", ""),
                "event_count": len(events),
                "avg_impact": round(sum(impact_values) / len(impact_values), 2) if impact_values else 0,
            }
        )
    reports.sort(key=lambda item: (item.get("generated_at") or item["date"], item["report_type"]), reverse=True)
    index_path = output_dir / "history_index.json"
    write_utf8_json(index_path, {"generated_at": datetime.now(timezone.utc).isoformat(), "reports": reports})
    return index_path


def _report_date(value: Any, fallback: str | None = None) -> str:
    text = str(value or "")
    if len(text) >= 10 and text[4:5] == "-" and text[7:8] == "-":
        return text[:10]
    return fallback or datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _type_from_filename(name: str) -> str:
    return "premarket" if "premarket" in name.lower() else "close"


def _loads_market_json(text: str) -> dict[str, Any]:
    cleaned = _extract_json(text)
    if not cleaned:
        raise MarketJSONValidationError("Market report JSON is empty.")
    try:
        loaded = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        excerpt = cleaned[max(0, exc.pos - 80) : exc.pos + 80].replace("\n", " ")
        raise MarketJSONValidationError(
            f"Invalid market report JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}. "
            f"Near: {excerpt!r}"
        ) from exc
    if not isinstance(loaded, dict):
        raise MarketJSONValidationError(
            f"Market report JSON root must be an object, got {type(loaded).__name__}."
        )
    return loaded


def _validate_unicode_tree(value: Any, *, location: str = "market report", path: str = "$") -> None:
    if isinstance(value, str):
        try:
            value.encode("utf-8", errors="strict")
        except UnicodeEncodeError as exc:
            raise MarketJSONValidationError(f"{location}: invalid Unicode at {path}: {exc}") from exc
        if "\ufffd" in value:
            raise MarketJSONValidationError(f"{location}: replacement character U+FFFD found at {path}; source text is corrupted.")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            _validate_unicode_tree(item, location=location, path=f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _validate_unicode_tree(item, location=location, path=f"{path}[{index}]")


def _extract_json(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").removesuffix("```").strip()
    elif cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").removesuffix("```").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        return cleaned[start : end + 1]
    return cleaned


def _validate_event(event: dict[str, Any]) -> dict[str, Any]:
    validated = {
        "title": _to_str(event.get("title")),
        "entities": _to_str_list(event.get("entities")),
        "sector": _to_str(event.get("sector")),
        "event_type": _to_str(event.get("event_type")),
        "summary": _to_str(event.get("summary")),
        "market_impact_score": _to_int(event.get("market_impact_score"), minimum=0, maximum=100),
        "sentiment_score": _to_float(event.get("sentiment_score"), minimum=-1.0, maximum=1.0),
        "time_horizon": _to_str(event.get("time_horizon")),
        "why_it_matters": _to_str(event.get("why_it_matters")),
        "affected_markets": _to_str_list(event.get("affected_markets")),
        "topics": _to_str_list(event.get("topics")),
        "related_tickers": _to_str_list(event.get("related_tickers")),
        "priority_level": _priority(event.get("priority_level")),
        "source_names": _to_str_list(event.get("source_names")),
        "source_urls": _to_str_list(event.get("source_urls")),
        "image_urls": _to_str_list(event.get("image_urls")),
        "image_paths": _to_str_list(event.get("image_paths")),
        "source_quality_score": _to_int(event.get("source_quality_score"), minimum=0, maximum=100),
        "source_count": _to_int(event.get("source_count"), minimum=0, maximum=1000),
        "cross_source_frequency": _to_int(event.get("cross_source_frequency"), minimum=0, maximum=100),
        "macro_weight": _to_int(event.get("macro_weight"), minimum=0, maximum=100),
        "freshness_score": _to_int(event.get("freshness_score"), minimum=0, maximum=100),
        "confidence_score": _to_float(event.get("confidence_score"), minimum=0.0, maximum=100.0),
        "final_score": _to_float(event.get("final_score"), minimum=0.0, maximum=100.0),
    }
    validated["translations"] = _validate_event_translations(event.get("translations"))
    return validated


def _validate_analysis_translations(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or not isinstance(value.get("zh"), dict):
        return {}
    zh = value["zh"]
    return {
        "zh": {
            "dynamic_headline": _to_str(zh.get("dynamic_headline")),
            "market_summary": _to_str(zh.get("market_summary")),
            "market_narrative": _validate_market_narrative(zh.get("market_narrative")),
            "index_performance_summary": _to_str(zh.get("index_performance_summary")),
            "macro_outlook": _to_str(zh.get("macro_outlook")),
            "risk_and_sentiment": _to_str(zh.get("risk_and_sentiment")),
            "sector_theme_impact": _validate_sector_impact(zh.get("sector_theme_impact")),
        }
    }


def _validate_event_translations(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or not isinstance(value.get("zh"), dict):
        return {}
    zh = value["zh"]
    return {
        "zh": {
            "title": _to_str(zh.get("title")),
            "sector": _to_str(zh.get("sector")),
            "event_type": _to_str(zh.get("event_type")),
            "summary": _to_str(zh.get("summary")),
            "time_horizon": _to_str(zh.get("time_horizon")),
            "why_it_matters": _to_str(zh.get("why_it_matters")),
            "affected_markets": _to_str_list(zh.get("affected_markets")),
            "topics": _to_str_list(zh.get("topics")),
            "keywords": _to_str_list(zh.get("keywords")),
        }
    }


def _validate_news_item(item: dict[str, Any]) -> dict[str, Any]:
    validated = {
        "title": _to_str(item.get("title")),
        "summary": _to_str(item.get("summary")),
        "category": _to_str(item.get("category")),
        "sentiment": _to_str(item.get("sentiment")),
        "market_impact_score": _to_int(item.get("market_impact_score"), minimum=0, maximum=100),
        "sentiment_score": _to_float(item.get("sentiment_score"), minimum=-1.0, maximum=1.0),
        "source_name": _to_str(item.get("source_name")),
        "source_url": _to_str(item.get("source_url")),
        "image_url": _to_str(item.get("image_url")),
        "published_at": _to_str(item.get("published_at")),
        "tickers": _to_str_list(item.get("tickers")),
        "keywords": _to_str_list(item.get("keywords")),
        "topics": _to_str_list(item.get("topics")),
        "source_quality_score": _to_int(item.get("source_quality_score"), minimum=0, maximum=100),
        "macro_weight": _to_int(item.get("macro_weight"), minimum=0, maximum=100),
        "freshness_score": _to_int(item.get("freshness_score"), minimum=0, maximum=100),
        "priority_level": _priority(item.get("priority_level")),
        "time_horizon": _to_str(item.get("time_horizon")),
    }
    translations = item.get("translations")
    if isinstance(translations, dict) and isinstance(translations.get("zh"), dict):
        zh = translations["zh"]
        validated["translations"] = {
            "zh": {
                "title": _to_str(zh.get("title")),
                "summary": _to_str(zh.get("summary")),
                "category": _to_str(zh.get("category")),
                "keywords": _to_str_list(zh.get("keywords")),
            }
        }
    else:
        validated["translations"] = {}
    return validated


def _validate_news_event(event: dict[str, Any]) -> dict[str, Any]:
    sources = event.get("related_sources")
    articles = event.get("articles")
    validated = {
        "event_id": _to_str(event.get("event_id")),
        "title": _to_str(event.get("title")),
        "summary": _to_str(event.get("summary")),
        "sector": _to_str(event.get("sector")),
        "event_type": _to_str(event.get("event_type")),
        "topics": _to_str_list(event.get("topics")),
        "keywords": _to_str_list(event.get("keywords")),
        "related_tickers": _to_str_list(event.get("related_tickers")),
        "market_impact_score": _to_int(event.get("market_impact_score"), minimum=0, maximum=100),
        "sentiment_score": _to_float(event.get("sentiment_score"), minimum=-1.0, maximum=1.0),
        "priority_level": _priority(event.get("priority_level")),
        "time_horizon": _to_str(event.get("time_horizon")),
        "why_it_matters": _to_str(event.get("why_it_matters")),
        "source_quality_score": _to_int(event.get("source_quality_score"), minimum=0, maximum=100),
        "source_count": _to_int(event.get("source_count"), minimum=0, maximum=1000),
        "cross_source_frequency": _to_int(event.get("cross_source_frequency"), minimum=0, maximum=100),
        "macro_weight": _to_int(event.get("macro_weight"), minimum=0, maximum=100),
        "freshness_score": _to_int(event.get("freshness_score"), minimum=0, maximum=100),
        "confidence_score": _to_float(event.get("confidence_score"), minimum=0.0, maximum=100.0),
        "final_score": _to_float(event.get("final_score"), minimum=0.0, maximum=100.0),
        "published_at": _to_str(event.get("published_at")),
        "primary_source": _validate_source(event.get("primary_source")),
        "related_sources": [_validate_source(item) for item in sources if isinstance(item, dict)] if isinstance(sources, list) else [],
        "source_names": _to_str_list(event.get("source_names")),
        "source_urls": _to_str_list(event.get("source_urls")),
        "articles": [_validate_news_item(item) for item in articles if isinstance(item, dict)] if isinstance(articles, list) else [],
        "translations": _validate_event_translations(event.get("translations")),
    }
    return validated


def _validate_driver(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": _to_str(item.get("name")),
        "importance_score": _to_int(item.get("importance_score"), minimum=0, maximum=100),
        "explanation": _to_str(item.get("explanation")),
        "affected_assets": _to_str_list(item.get("affected_assets")),
        "translations": _validate_named_translation(item.get("translations")),
    }


def _validate_watch_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "item": _to_str(item.get("item")),
        "type": _to_str(item.get("type")),
        "why_it_matters": _to_str(item.get("why_it_matters")),
        "translations": _validate_named_translation(item.get("translations")),
    }


def _validate_theme(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": _to_str(item.get("name")),
        "importance_score": _to_float(item.get("importance_score"), minimum=0.0, maximum=100.0),
        "affected_sectors": _to_str_list(item.get("affected_sectors")),
        "related_tickers": _to_str_list(item.get("related_tickers")),
        "explanation": _to_str(item.get("explanation")),
        "related_events": _to_str_list(item.get("related_events")),
        "translations": _validate_named_translation(item.get("translations")),
    }


def _validate_market_narrative(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        return {
            "headline": "",
            "summary": _to_str(value),
            "key_forces": [],
            "watch_next": [],
        }
    source = value if isinstance(value, dict) else {}
    forces = source.get("key_forces")
    normalized_forces = []
    if isinstance(forces, list):
        for item in forces[:3]:
            if not isinstance(item, dict):
                continue
            label = _to_str(item.get("label"))
            text = _to_str(item.get("text") or item.get("value"))
            if label or text:
                normalized_forces.append({"label": label, "text": text})
    return {
        "headline": _to_str(source.get("headline")),
        "summary": _to_str(source.get("summary")),
        "key_forces": normalized_forces,
        "watch_next": _to_str_list(source.get("watch_next"))[:4],
    }


def _validate_macro_analysis(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    themes = source.get("themes")
    return {
        "market_regime": _validate_macro_regime(source.get("market_regime")),
        "themes": [_validate_macro_theme(item) for item in themes if isinstance(item, dict)] if isinstance(themes, list) else [],
        "asset_view": _validate_asset_view(source.get("asset_view") or source.get("market_impact")),
        "watch_next": _validate_macro_watch_next(source.get("watch_next")),
    }


def _validate_macro_regime(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    return {
        "title": _to_str(source.get("title") or source.get("regime")),
        "title_zh": _to_str(source.get("title_zh")),
        "summary": _to_str(source.get("summary") or source.get("brief")),
        "summary_zh": _to_str(source.get("summary_zh")),
        "key_takeaway": _to_str(source.get("key_takeaway")),
        "key_takeaway_zh": _to_str(source.get("key_takeaway_zh")),
        "stance": _to_str(source.get("stance") or source.get("market_stance")),
        "stance_zh": _to_str(source.get("stance_zh")),
        "confidence": _to_str(source.get("confidence")),
    }


def _validate_macro_theme(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    impact = source.get("market_impact")
    if not isinstance(impact, dict):
        impact = {}
    return {
        "title": _to_str(source.get("title") or source.get("name")),
        "title_zh": _to_str(source.get("title_zh")),
        "current_view": _to_str(source.get("current_view") or source.get("summary")),
        "current_view_zh": _to_str(source.get("current_view_zh") or source.get("summary_zh")),
        "what_changed": _to_str(source.get("what_changed")),
        "what_changed_zh": _to_str(source.get("what_changed_zh")),
        "why_it_matters": _to_str(source.get("why_it_matters") or source.get("explanation")),
        "why_it_matters_zh": _to_str(source.get("why_it_matters_zh") or source.get("explanation_zh")),
        "market_impact": {
            "equities": _to_str(impact.get("equities")),
            "rates": _to_str(impact.get("rates")),
            "sectors": _to_str_list(impact.get("sectors")),
        },
        "market_impact_zh": _validate_theme_impact(source.get("market_impact_zh")),
        "watch_next": _to_str_list(source.get("watch_next")),
        "watch_next_zh": _to_str_list(source.get("watch_next_zh")),
    }


def _validate_asset_view(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    return {
        "equities": _validate_asset_item(source.get("equities")),
        "equities_zh": _validate_asset_item(source.get("equities_zh")),
        "rates": _validate_asset_item(source.get("rates")),
        "rates_zh": _validate_asset_item(source.get("rates_zh")),
        "growth_stocks": _validate_asset_item(source.get("growth_stocks")),
        "growth_stocks_zh": _validate_asset_item(source.get("growth_stocks_zh")),
        "financials": _validate_asset_item(source.get("financials")),
        "financials_zh": _validate_asset_item(source.get("financials_zh")),
        "sectors": [_validate_sector_item(item) for item in source.get("sectors", []) if isinstance(item, dict)] if isinstance(source.get("sectors"), list) else [],
        "sectors_zh": [_validate_sector_item(item) for item in source.get("sectors_zh", []) if isinstance(item, dict)] if isinstance(source.get("sectors_zh"), list) else [],
    }


def _validate_asset_item(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            "view": _to_str(value.get("view") or value.get("stance") or value.get("current")),
            "reason": _to_str(value.get("reason") or value.get("note") or value.get("summary") or value.get("impact")),
        }
    return _to_str(value)


def _validate_sector_item(value: Any) -> dict[str, Any]:
    return {
        "positive": _to_str_list(value.get("positive")),
        "negative": _to_str_list(value.get("negative")),
    }


def _validate_macro_watch_next(value: Any) -> dict[str, list[str]]:
    source = value if isinstance(value, dict) else {}
    return {
        "macro_data": _to_str_list(source.get("macro_data")),
        "macro_data_zh": _to_str_list(source.get("macro_data_zh")),
        "policy": _to_str_list(source.get("policy")),
        "policy_zh": _to_str_list(source.get("policy_zh")),
        "company_events": _to_str_list(source.get("company_events")),
        "company_events_zh": _to_str_list(source.get("company_events_zh")),
    }


def _validate_theme_impact(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    return {
        "equities": _to_str(source.get("equities")),
        "rates": _to_str(source.get("rates")),
        "sectors": _to_str_list(source.get("sectors")),
    }


def _validate_named_translation(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or not isinstance(value.get("zh"), dict):
        return {}
    zh = value["zh"]
    return {
        "zh": {
            "name": _to_str(zh.get("name")),
            "item": _to_str(zh.get("item")),
            "type": _to_str(zh.get("type")),
            "explanation": _to_str(zh.get("explanation")),
            "why_it_matters": _to_str(zh.get("why_it_matters")),
        }
    }


def _validate_sector_impact(value: Any) -> dict[str, list[str]]:
    source = value if isinstance(value, dict) else {}
    return {
        "winners": _to_str_list(source.get("winners")),
        "losers": _to_str_list(source.get("losers")),
        "themes_to_watch": _to_str_list(source.get("themes_to_watch")),
    }


def _validate_source(value: Any) -> dict[str, Any]:
    source = value if isinstance(value, dict) else {}
    return {
        "name": _to_str(source.get("name")),
        "url": _to_str(source.get("url")),
        "quality_score": _to_int(source.get("quality_score"), minimum=0, maximum=100),
        "published_at": _to_str(source.get("published_at")),
    }


def _priority(value: Any) -> str:
    text = _to_str(value).title()
    return text if text in {"Critical", "High", "Medium", "Low"} else "Medium"


def _to_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _to_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [_to_str(item) for item in value if _to_str(item)]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return []


def _to_int(value: Any, minimum: int, maximum: int) -> int:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        number = 0
    return max(minimum, min(maximum, number))


def _to_float(value: Any, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = 0.0
    return max(minimum, min(maximum, number))


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}
