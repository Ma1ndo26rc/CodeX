from __future__ import annotations

import json
import re
from typing import Any


class MockLLMClient:
    """Deterministic local LLMClient used to verify the backend chain."""

    def generate(self, prompt: str) -> str:
        question = _line_value(prompt, "USER QUESTION:") or "Market research question"
        analysis_type = _line_value(prompt, "ANALYSIS TYPE:") or "market_summary"
        context = _prompt_context(prompt)
        events = context.get("events") if isinstance(context.get("events"), list) else []
        lead = events[0] if events else {}
        evidence = [
            {
                "id": str(item.get("id") or f"event-{index + 1}"),
                "title": str(item.get("title") or "Market event"),
                "source": str((item.get("sources") or ["Current market report"])[0]),
                "sources": item.get("sources") or [],
                "url": str((item.get("source_urls") or [""])[0]),
                "published_at": str(item.get("published_at") or ""),
                "impact_score": float(item.get("impact_score") or 0),
                "sentiment_score": float(item.get("sentiment_score") or 0),
            }
            for index, item in enumerate(events[:3])
            if isinstance(item, dict)
        ]
        response: dict[str, Any] = {
            "query": question,
            "analysis_type": analysis_type,
            "stance": "neutral_selective",
            "confidence": 55 if events else 25,
            "executive_summary": str(
                lead.get("summary")
                or context.get("market_state", {}).get("summary")
                or "The current report contains limited evidence for a stronger conclusion."
            ),
            "key_drivers": [
                {
                    "title": item["title"],
                    "direction": "positive" if item["sentiment_score"] > 0.1 else "negative" if item["sentiment_score"] < -0.1 else "mixed",
                    "importance": item["impact_score"],
                    "analysis": item.get("summary") or item["title"],
                    "evidence_ids": [item["id"]],
                }
                for item in evidence
            ],
            "market_impact": {
                "equities": "Selective, report-grounded impact.",
                "sectors": list(dict.fromkeys(str(item.get("sector")) for item in events[:4] if item.get("sector"))),
                "rates": str(context.get("asset_view", {}).get("rates", {}).get("reason") or "No incremental rates conclusion."),
                "time_horizon": str(lead.get("time_horizon") or "near term"),
            },
            "risk_factors": [],
            "watch_next": [
                {"item": item, "why_it_matters": "This may confirm or invalidate the current view.", "evidence_ids": []}
                for item in context.get("watch_next", {}).get("general", [])[:3]
            ],
            "evidence": evidence,
            "limitations": [
                "Mock LLM response for local integration testing only.",
                "No real model inference was performed.",
            ],
        }
        return json.dumps(response, ensure_ascii=False)


def _line_value(prompt: str, prefix: str) -> str:
    match = re.search(rf"^{re.escape(prefix)}\s*(.+)$", prompt, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def _prompt_context(prompt: str) -> dict[str, Any]:
    marker = "MARKET RESEARCH CONTEXT:\n"
    if marker not in prompt:
        return {}
    try:
        value = json.loads(prompt.split(marker, 1)[1].strip())
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
