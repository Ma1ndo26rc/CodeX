from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any


SCHEMA = {
    "dynamic_headline": "",
    "market_summary": "",
    "market_narrative": "",
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
    analysis["dynamic_headline"] = _to_str(payload.get("dynamic_headline"))
    analysis["market_summary"] = _to_str(payload.get("market_summary"))
    analysis["market_narrative"] = _to_str(payload.get("market_narrative"))
    analysis["index_performance_summary"] = _to_str(payload.get("index_performance_summary"))
    analysis["macro_outlook"] = _to_str(payload.get("macro_outlook"))
    analysis["risk_and_sentiment"] = _to_str(payload.get("risk_and_sentiment"))
    key_drivers = payload.get("key_drivers")
    analysis["key_drivers"] = [_validate_driver(item) for item in key_drivers if isinstance(item, dict)] if isinstance(key_drivers, list) else []
    analysis["sector_theme_impact"] = _validate_sector_impact(payload.get("sector_theme_impact"))
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
    return analysis


def save_market_analysis(analysis: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "market_analysis.json"
    latest_path = output_dir / "latest.json"
    history_dir = output_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    history_path = history_dir / f"{datetime.now().strftime('%Y-%m-%d')}.json"
    archive_path = output_dir / f"market_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    validated = parse_and_validate_market_json(analysis)
    text = json.dumps(validated, ensure_ascii=False, indent=2)
    path.write_text(text, encoding="utf-8")
    latest_path.write_text(text, encoding="utf-8")
    history_path.write_text(text, encoding="utf-8")
    archive_path.write_text(text, encoding="utf-8")
    return path, archive_path


def load_market_analysis(path: Path) -> dict[str, Any]:
    return parse_and_validate_market_json(path.read_text(encoding="utf-8"))


def _loads_market_json(text: str) -> dict[str, Any]:
    cleaned = _extract_json(text)
    try:
        loaded = json.loads(cleaned)
    except json.JSONDecodeError:
        return {}
    return loaded if isinstance(loaded, dict) else {}


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
            "market_narrative": _to_str(zh.get("market_narrative")),
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
