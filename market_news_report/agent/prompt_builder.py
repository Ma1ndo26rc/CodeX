from __future__ import annotations

import json
from typing import Any, Mapping

from .context_formatter import format_research_context


RESEARCH_RESPONSE_SHAPE = {
    "query": "string",
    "analysis_type": "company | sector | macro | market_summary",
    "stance": "constructive | cautious | neutral | neutral_selective | bullish | bearish | mixed",
    "confidence": "number from 0 to 100",
    "executive_summary": "string",
    "key_drivers": [
        {
            "title": "string",
            "direction": "positive | negative | mixed | neutral",
            "importance": "number from 0 to 100",
            "analysis": "string",
            "evidence_ids": ["event or evidence id"],
        }
    ],
    "market_impact": {
        "equities": "string",
        "sectors": ["string"],
        "rates": "string",
        "time_horizon": "string",
    },
    "risk_factors": [
        {
            "title": "string",
            "level": "high | medium | low",
            "analysis": "string",
            "evidence_ids": ["event or evidence id"],
        }
    ],
    "watch_next": [
        {
            "item": "string",
            "why_it_matters": "string",
            "evidence_ids": ["event or evidence id"],
        }
    ],
    "evidence": [
        {
            "id": "string",
            "title": "string",
            "source": "string",
            "sources": ["string"],
            "url": "string",
            "published_at": "string",
            "impact_score": "number from 0 to 100",
            "sentiment_score": "number from -1 to 1",
        }
    ],
    "limitations": ["string"],
}


def build_research_prompt(
    question: str,
    analysis_type: str,
    context: Mapping[str, Any] | None,
) -> str:
    query = str(question or "").strip()
    if not query:
        raise ValueError("Research prompt requires a non-empty user question.")
    normalized_type = str(analysis_type or "market_summary").strip() or "market_summary"
    compact_context = format_research_context(context)

    return "\n".join(
        [
            "You are an institutional US equity research analyst.",
            "Answer the research question using only the supplied MarketResearchContext.",
            "Separate confirmed evidence from inference. Do not invent prices, events, sources, or catalysts.",
            "If evidence is insufficient, lower confidence and state the limitation explicitly.",
            "",
            "OUTPUT RULES:",
            "- Return exactly one valid JSON object matching ResearchResponse.",
            "- Do not return Markdown, code fences, headings outside JSON, or prose before/after JSON.",
            "- Do not return a chat response or a long unstructured narrative.",
            "- confidence must be a number between 0 and 100.",
            "- Every key driver and risk should cite evidence_ids when evidence exists.",
            "- evidence entries must refer only to supplied context events or sources.",
            "",
            f"USER QUESTION: {query}",
            f"ANALYSIS TYPE: {normalized_type}",
            "",
            "RESEARCH RESPONSE SCHEMA:",
            json.dumps(RESEARCH_RESPONSE_SHAPE, ensure_ascii=False, indent=2),
            "",
            "MARKET RESEARCH CONTEXT:",
            json.dumps(compact_context, ensure_ascii=False, separators=(",", ":")),
        ]
    )
