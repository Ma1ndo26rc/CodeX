from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class NewsItem:
    title: str
    link: str
    source: str
    published_at: datetime | None
    summary: str = ""
    content: str = ""
    category: str = "uncategorized"
    sentiment: str = "neutral"
    dedupe_key: str = ""
    tickers: list[str] = field(default_factory=list)
    score: float = 0.0

    def text_blob(self) -> str:
        return " ".join([self.title, self.summary, self.content]).strip()

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "link": self.link,
            "source": self.source,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "summary": self.summary,
            "content": self.content,
            "category": self.category,
            "sentiment": self.sentiment,
            "dedupe_key": self.dedupe_key,
            "tickers": self.tickers,
            "score": self.score,
        }
