from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any


SCHEMA = {
    "market_summary": "",
    "index_performance_summary": "",
    "macro_outlook": "",
    "risk_and_sentiment": "",
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
    return data


def parse_and_validate_market_json(raw_text: str | dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(raw_text, dict):
        payload = raw_text
    else:
        payload = _loads_market_json(raw_text or "")

    analysis = empty_market_analysis()
    analysis["market_summary"] = _to_str(payload.get("market_summary"))
    analysis["index_performance_summary"] = _to_str(payload.get("index_performance_summary"))
    analysis["macro_outlook"] = _to_str(payload.get("macro_outlook"))
    analysis["risk_and_sentiment"] = _to_str(payload.get("risk_and_sentiment"))
    analysis["market_data"] = payload.get("market_data") if isinstance(payload.get("market_data"), dict) else {}
    analysis["translations"] = _validate_analysis_translations(payload.get("translations"))

    key_events = payload.get("key_events")
    if not isinstance(key_events, list):
        key_events = []
    analysis["key_events"] = [_validate_event(event) for event in key_events if isinstance(event, dict)]
    return analysis


def save_market_analysis(analysis: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / "market_analysis.json"
    archive_path = output_dir / f"market_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    validated = parse_and_validate_market_json(analysis)
    text = json.dumps(validated, ensure_ascii=False, indent=2)
    path.write_text(text, encoding="utf-8")
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
        "source_names": _to_str_list(event.get("source_names")),
        "source_urls": _to_str_list(event.get("source_urls")),
        "image_urls": _to_str_list(event.get("image_urls")),
        "image_paths": _to_str_list(event.get("image_paths")),
    }
    validated["translations"] = _validate_event_translations(event.get("translations"))
    return validated


def _validate_analysis_translations(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or not isinstance(value.get("zh"), dict):
        return {}
    zh = value["zh"]
    return {
        "zh": {
            "market_summary": _to_str(zh.get("market_summary")),
            "index_performance_summary": _to_str(zh.get("index_performance_summary")),
            "macro_outlook": _to_str(zh.get("macro_outlook")),
            "risk_and_sentiment": _to_str(zh.get("risk_and_sentiment")),
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
        }
    }


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
