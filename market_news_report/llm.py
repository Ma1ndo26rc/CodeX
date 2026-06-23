from __future__ import annotations

import json

from openai import OpenAI

from .config import CONFIG
from .models import NewsItem


class LLMAnalyzer:
    def __init__(self) -> None:
        self.enabled = bool(CONFIG.openai_api_key)
        self.client = (
            OpenAI(api_key=CONFIG.openai_api_key, base_url=CONFIG.openai_base_url)
            if self.enabled
            else None
        )

    def summarize_market(self, items: list[NewsItem]) -> dict:
        if not self.enabled or not items:
            return self._fallback_summary(items)
        payload = "\n".join(f"- {i.title} | {i.source} | {i.category} | {i.sentiment}" for i in items[:50])

        prompt = f"""
You are a sell-side style US stock market news analyst.
Return strict JSON with keys:
market_summary, index_performance_summary, macro_events, risk_and_sentiment, top_company_news.

News:
{payload}

Each value should be concise markdown-friendly text. top_company_news should be an array of objects with title, why_it_matters, sentiment.
"""
        resp = self.client.chat.completions.create(
            model=CONFIG.openai_model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        text = self._extract_json(resp.choices[0].message.content or "")
        return json.loads(text)

    def _extract_json(self, text: str) -> str:
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned.removeprefix("```json").removesuffix("```").strip()
        elif cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```").removesuffix("```").strip()
        return cleaned

    def _fallback_summary(self, items: list[NewsItem]) -> dict:
        positives = sum(1 for i in items if i.sentiment == "positive")
        negatives = sum(1 for i in items if i.sentiment == "negative")
        return {
            "market_summary": f"Collected {len(items)} articles. Positive tone: {positives}, negative tone: {negatives}.",
            "index_performance_summary": "Index snapshots can be wired from market data API if needed.",
            "macro_events": [],
            "risk_and_sentiment": f"Overall sentiment is {'risk-on' if positives >= negatives else 'risk-off'} based on article tone.",
            "top_company_news": [],
        }
