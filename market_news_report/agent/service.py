from __future__ import annotations

from typing import Any, Mapping

from .context_formatter import CONTEXT_VERSION, format_research_context
from .interfaces import LLMClient
from .prompt_builder import build_research_prompt
from .response_validator import (
    ResearchResponseValidationError,
    validate_research_response,
)


ALLOWED_ANALYSIS_TYPES = {"company", "sector", "macro", "market_summary"}


class AgentRequestValidationError(ValueError):
    """Raised when an AgentRequest does not satisfy the v1 contract."""


class AgentServiceError(RuntimeError):
    """Raised when an injected LLM client cannot complete generation."""


def run_market_agent(
    request: Mapping[str, Any],
    research_context: Mapping[str, Any] | None,
    llm_client: LLMClient | None = None,
) -> dict[str, Any]:
    """Run the provider-neutral MarketAgent workflow.

    The service has no knowledge of HTTP, FastAPI, API keys, or any concrete
    model SDK. A caller may inject any object implementing LLMClient.generate.
    """
    validated_request = _validate_request(request)
    compact_context = format_research_context(research_context)
    prompt = build_research_prompt(
        validated_request["question"],
        validated_request["analysis_type"],
        compact_context,
    )

    if llm_client is None:
        return _not_connected_response(validated_request)
    if not isinstance(llm_client, LLMClient):
        raise AgentServiceError("llm_client must implement generate(prompt: str) -> str.")

    try:
        raw_response = llm_client.generate(prompt)
    except Exception as exc:
        raise AgentServiceError(f"LLM generation failed: {type(exc).__name__}: {exc}") from exc

    try:
        return validate_research_response(raw_response)
    except ResearchResponseValidationError:
        raise
    except Exception as exc:
        raise AgentServiceError(f"ResearchResponse validation failed unexpectedly: {exc}") from exc


def _validate_request(request: Mapping[str, Any]) -> dict[str, str]:
    if not isinstance(request, Mapping):
        raise AgentRequestValidationError("AgentRequest must be an object.")

    question = _text(request.get("question"))
    report_id = _text(request.get("report_id"))
    analysis_type = _text(request.get("analysis_type"))
    context_version = _text(request.get("context_version"))
    errors: list[str] = []

    if not question:
        errors.append("question is required")
    if not report_id:
        errors.append("report_id is required")
    if analysis_type not in ALLOWED_ANALYSIS_TYPES:
        errors.append(
            "analysis_type must be one of: "
            + ", ".join(sorted(ALLOWED_ANALYSIS_TYPES))
        )
    if context_version != CONTEXT_VERSION:
        errors.append(f"context_version must be {CONTEXT_VERSION!r}")
    if errors:
        raise AgentRequestValidationError("Invalid AgentRequest: " + "; ".join(errors))

    return {
        "question": question,
        "report_id": report_id,
        "analysis_type": analysis_type,
        "context_version": context_version,
    }


def _not_connected_response(request: Mapping[str, str]) -> dict[str, Any]:
    return {
        "query": request["question"],
        "analysis_type": request["analysis_type"],
        "stance": "neutral",
        "confidence": 0,
        "executive_summary": "Market Agent analysis is unavailable because no LLM client is connected.",
        "key_drivers": [],
        "market_impact": {
            "equities": "",
            "sectors": [],
            "rates": "",
            "time_horizon": "",
        },
        "risk_factors": [],
        "watch_next": [],
        "evidence": [],
        "limitations": [
            "LLM client not connected.",
            f"Request was validated against context version {request['context_version']}.",
        ],
    }


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()
