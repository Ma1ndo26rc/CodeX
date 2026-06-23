from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import feedparser
import requests

from .models import NewsItem


YAHOO_RSS_URL = "https://finance.yahoo.com/news/rssindex"
CNBC_RSS_URL = "https://www.cnbc.com/id/100003114/device/rss/rss.html"
GOOGLE_NEWS_BASE = "https://news.google.com/rss/search?q={query}+when:1d&hl=en-US&gl=US&ceid=US:en"


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _within_lookback(dt: datetime | None, lookback_hours: int) -> bool:
    if dt is None:
        return True
    now = datetime.now(timezone.utc)
    return dt.astimezone(timezone.utc) >= now - timedelta(hours=lookback_hours)


def _entry_to_item(entry, source: str) -> NewsItem:
    published = _parse_dt(getattr(entry, "published", None) or getattr(entry, "updated", None))
    summary = getattr(entry, "summary", "") or ""
    content = ""
    if getattr(entry, "content", None):
        content = " ".join(part.value for part in entry.content if getattr(part, "value", None))
    return NewsItem(
        title=getattr(entry, "title", "").strip(),
        link=getattr(entry, "link", "").strip(),
        source=source,
        published_at=published,
        summary=summary.strip(),
        content=content.strip(),
    )


def fetch_rss(url: str, source: str, lookback_hours: int) -> list[NewsItem]:
    feed = feedparser.parse(url)
    items: list[NewsItem] = []
    for entry in feed.entries:
        item = _entry_to_item(entry, source)
        if _within_lookback(item.published_at, lookback_hours):
            items.append(item)
    return items


def fetch_google_news(keywords: list[str], lookback_hours: int) -> list[NewsItem]:
    items: list[NewsItem] = []
    queries = keywords or ["US stocks", "S&P 500", "Nasdaq"]
    for query in queries:
        url = GOOGLE_NEWS_BASE.format(query=quote_plus(query))
        feed = feedparser.parse(url)
        for entry in feed.entries:
            item = _entry_to_item(entry, f"Google News: {query}")
            if _within_lookback(item.published_at, lookback_hours):
                items.append(item)
    return items


def fetch_all_news(lookback_hours: int = 24) -> list[NewsItem]:
    items = []
    items.extend(fetch_rss(YAHOO_RSS_URL, "Yahoo Finance", lookback_hours))
    items.extend(fetch_rss(CNBC_RSS_URL, "CNBC", lookback_hours))
    items.extend(fetch_google_news(["US stock market", "S&P 500", "Nasdaq"], lookback_hours))
    return items
