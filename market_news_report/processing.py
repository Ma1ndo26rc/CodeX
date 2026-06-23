from __future__ import annotations

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


def group_by_category(items: list[NewsItem]) -> dict[str, list[NewsItem]]:
    grouped = defaultdict(list)
    for item in items:
        grouped[item.category].append(item)
    return dict(grouped)
