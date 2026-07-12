from __future__ import annotations

import json
from typing import Any, Mapping


REQUIRED_FIELDS = (
    "query",
    "analysis_type",
    "stance",
    "confidence",
    "executive_summary",
    "key_drivers",
    "market_impact",
    "risk_factors",
    "watch_next",
    "evidence",
    "limitations",
)
ARRAY_FIELDS = ("key_drivers", "risk_factors", "watch_next", "evidence", "limitations")


class ResearchResponseValidationError(ValueError):
    """Raised when an LLM response violates the ResearchResponse contract."""


def validate_research_response(raw: str | Mapping[str, Any]) -> dict[str, Any]:
    payload = _parse_payload(raw)
    errors: list[str] = []

    missing = [field for field in REQUIRED_FIELDS if field not in payload]
    if missing:
        errors.append(f"missing required fields: {', '.join(missing)}")

    for field in ("query", "analysis_type", "stance", "executive_summary"):
        if field in payload and not isinstance(payload[field], str):
            errors.append(f"{field} must be a string")

    confidence = payload.get("confidence")
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        errors.append("confidence must be a number")
    elif not 0 <= confidence <= 100:
        errors.append("confidence must be between 0 and 100")

    for field in ARRAY_FIELDS:
        if field in payload and not isinstance(payload[field], list):
            errors.append(f"{field} must be an array")

    if "market_impact" in payload and not isinstance(payload["market_impact"], Mapping):
        errors.append("market_impact must be an object")
    elif isinstance(payload.get("market_impact"), Mapping):
        _validate_market_impact(payload["market_impact"], errors)

    _validate_object_array(payload.get("key_drivers"), "key_drivers", errors)
    _validate_object_array(payload.get("risk_factors"), "risk_factors", errors)
    _validate_object_array(payload.get("watch_next"), "watch_next", errors)
    _validate_object_array(payload.get("evidence"), "evidence", errors)

    if isinstance(payload.get("limitations"), list) and any(not isinstance(item, str) for item in payload["limitations"]):
        errors.append("limitations must contain only strings")

    if errors:
        raise ResearchResponseValidationError("Invalid ResearchResponse: " + "; ".join(errors))

    return dict(payload)


def _parse_payload(raw: str | Mapping[str, Any]) -> Mapping[str, Any]:
    if isinstance(raw, Mapping):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        raise ResearchResponseValidationError("ResearchResponse is empty.")
    text = raw.strip()
    if text.startswith("```"):
        raise ResearchResponseValidationError("ResearchResponse must be raw JSON without Markdown code fences.")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ResearchResponseValidationError(
            f"ResearchResponse is not valid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(payload, Mapping):
        raise ResearchResponseValidationError("ResearchResponse JSON root must be an object.")
    return payload


def _validate_market_impact(value: Mapping[str, Any], errors: list[str]) -> None:
    for field in ("equities", "rates", "time_horizon"):
        if field in value and not isinstance(value[field], str):
            errors.append(f"market_impact.{field} must be a string")
    if "sectors" in value and not isinstance(value["sectors"], list):
        errors.append("market_impact.sectors must be an array")
    elif isinstance(value.get("sectors"), list) and any(not isinstance(item, str) for item in value["sectors"]):
        errors.append("market_impact.sectors must contain only strings")


def _validate_object_array(value: Any, field: str, errors: list[str]) -> None:
    if not isinstance(value, list):
        return
    for index, item in enumerate(value):
        if not isinstance(item, Mapping):
            errors.append(f"{field}[{index}] must be an object")
