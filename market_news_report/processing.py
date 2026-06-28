from __future__ import annotations

import html
import re
from collections import defaultdict

from .models import NewsItem


_CATEGORY_RULES = {
    "macro": ["fed", "inflation", "cpi", "ppi", "jobs", "yield", "treasury", "rate", "rates", "gdp", "oil", "tariff", "recession"],
    "company": ["earnings", "revenue", "guidance", "shares", "stock", "ceo", "acquisition", "merger", "ipo", "buyback", "dividend"],
    "industry": ["semiconductor", "banking", "energy", "ai", "cloud", "software", "retail", "auto", "healthcare", "consumer", "tech"],
    "policy": ["sec", "congress", "white house", "regulation", "antitrust", "law", "policy", "ban", "sanction", "government"],
}

_POSITIVE_WORDS = {"beat", "growth", "surge", "rally", "upgrade", "strong", "record", "profit", "bullish", "gain"}
_NEGATIVE_WORDS = {"miss", "fall", "drop", "lawsuit", "probe", "weak", "down", "bearish", "loss", "cut", "crash"}


def dedupe_news(items: list[NewsItem]) -> list[NewsItem]:
    seen: dict[str, NewsItem] = {}
    for item in items:
        key = re.sub(r"\W+", " ", item.title.lower()).strip()
        key = re.sub(r"\b(inc|corp|ltd|co|company|stock|shares)\b", "", key).strip()
        if key not in seen:
            item.dedupe_key = key
            seen[key] = item
    return list(seen.values())


def classify_item(item: NewsItem) -> str:
    text = f"{item.title} {item.summary} {item.content}".lower()
    scores = {cat: 0 for cat in _CATEGORY_RULES}
    for cat, keywords in _CATEGORY_RULES.items():
        for kw in keywords:
            if kw in text:
                scores[cat] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "macro"


def sentiment_item(item: NewsItem) -> str:
    text = f"{item.title} {item.summary} {item.content}".lower()
    pos = sum(1 for w in _POSITIVE_WORDS if w in text)
    neg = sum(1 for w in _NEGATIVE_WORDS if w in text)
    if pos > neg:
        return "positive"
    if neg > pos:
        return "negative"
    return "neutral"


def enrich_items(items: list[NewsItem]) -> list[NewsItem]:
    for item in items:
        item.category = classify_item(item)
        item.sentiment = sentiment_item(item)
    return items


def build_news_feed(items: list[NewsItem], limit: int = 30) -> list[dict]:
    ranked = sorted(
        items,
        key=lambda item: item.published_at.timestamp() if item.published_at else 0,
        reverse=True,
    )
    return [
        {
            "title": item.title,
            "summary": _clean_feed_text(item.summary or item.content)[:500],
            "category": item.category,
            "sentiment": item.sentiment,
            "market_impact_score": _feed_impact_score(item),
            "sentiment_score": {"positive": 0.35, "negative": -0.35}.get(item.sentiment, 0.0),
            "source_name": item.source,
            "source_url": item.link,
            "image_url": item.image_url,
            "published_at": item.published_at.isoformat() if item.published_at else "",
            "tickers": list(item.tickers),
            "keywords": list(item.tickers),
        }
        for item in ranked[:limit]
    ]


def _clean_feed_text(value: str) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _feed_impact_score(item: NewsItem) -> int:
    text = item.text_blob().lower()
    score = 38
    score += {"macro": 14, "policy": 12, "company": 9, "industry": 7}.get(item.category, 4)
    if item.sentiment != "neutral":
        score += 5
    if any(name in item.source.lower() for name in ("reuters", "bloomberg", "cnbc", "yahoo finance", "marketwatch", "financial times")):
        score += 7
    if any(word in text for word in ("fed", "inflation", "rate", "yield", "earnings", "guidance", "tariff", "ai", "semiconductor")):
        score += 9
    return max(30, min(85, score))


def group_by_category(items: list[NewsItem]) -> dict[str, list[NewsItem]]:
    grouped = defaultdict(list)
    for item in items:
        grouped[item.category].append(item)
    return dict(grouped)
