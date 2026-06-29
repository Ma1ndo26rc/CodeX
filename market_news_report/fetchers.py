from __future__ import annotations

from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import re
from urllib.parse import quote_plus

import feedparser
import requests

from .config import CONFIG
from .models import NewsItem


RSS_SOURCES = [
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
    ("CNBC Markets", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("CNBC Business", "https://www.cnbc.com/id/10001147/device/rss/rss.html"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("Nasdaq", "https://www.nasdaq.com/feed/rssoutbound?category=Stocks"),
]
GOOGLE_NEWS_BASE = "https://news.google.com/rss/search?q={query}+when:1d&hl=en-US&gl=US&ceid=US:en"
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; USStockDailyReport/1.0; +https://example.com/bot)"
}
FETCH_DIAGNOSTICS: list[dict[str, str | int]] = []


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _parse_entry_dt(entry) -> datetime | None:
    published = _parse_dt(getattr(entry, "published", None) or getattr(entry, "updated", None))
    if published:
        return published
    parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if parsed:
        return datetime(*parsed[:6], tzinfo=timezone.utc)
    return None


def _within_lookback(dt: datetime | None, lookback_hours: int) -> bool:
    if dt is None:
        return True
    now = datetime.now(timezone.utc)
    return dt.astimezone(timezone.utc) >= now - timedelta(hours=lookback_hours)


def _extract_image_url(entry) -> str:
    for attr in ("media_content", "media_thumbnail"):
        for media in getattr(entry, attr, []) or []:
            url = media.get("url") if isinstance(media, dict) else None
            if url:
                return url
    for link in getattr(entry, "links", []) or []:
        if link.get("type", "").startswith("image/") and link.get("href"):
            return link["href"]
    html = getattr(entry, "summary", "") or ""
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    return match.group(1) if match else ""


def _entry_to_item(entry, source: str) -> NewsItem:
    published = _parse_entry_dt(entry)
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
        image_url=_extract_image_url(entry),
    )


def fetch_rss(url: str, source: str, lookback_hours: int) -> list[NewsItem]:
    feed = _parse_feed_url(url, source)
    items: list[NewsItem] = []
    for entry in feed.entries:
        item = _entry_to_item(entry, source)
        if _within_lookback(item.published_at, lookback_hours):
            items.append(item)
    return items


def _parse_feed_url(url: str, label: str):
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=CONFIG.fetch_timeout_seconds)
        response.raise_for_status()
        FETCH_DIAGNOSTICS.append({"source": label, "status": "ok", "url": url, "http_status": response.status_code})
        return feedparser.parse(response.content)
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        FETCH_DIAGNOSTICS.append({"source": label, "status": "failed", "url": url, "error": message})
        print(f"News source fetch failed [{label}]: {message}")
        return feedparser.parse("")


def fetch_google_news(keywords: list[str], lookback_hours: int) -> list[NewsItem]:
    items: list[NewsItem] = []
    queries = keywords or ["US stocks", "S&P 500", "Nasdaq"]
    for query in queries:
        url = GOOGLE_NEWS_BASE.format(query=quote_plus(query))
        feed = _parse_feed_url(url, f"Google News: {query}")
        for entry in feed.entries:
            item = _entry_to_item(entry, _google_news_source(entry, query))
            if _within_lookback(item.published_at, lookback_hours):
                items.append(item)
    return items


def _google_news_source(entry, query: str) -> str:
    source = getattr(entry, "source", None)
    if isinstance(source, dict) and source.get("title"):
        return source["title"]
    if getattr(source, "title", None):
        return source.title
    return f"Google News: {query}"


def fetch_all_news(lookback_hours: int = 24, keywords: list[str] | None = None) -> list[NewsItem]:
    FETCH_DIAGNOSTICS.clear()
    items = []
    for source, url in RSS_SOURCES:
        items.extend(fetch_rss(url, source, lookback_hours))
    items.extend(fetch_google_news(keywords or ["US stock market", "S&P 500", "Nasdaq"], lookback_hours))
    return items


def source_counts(items: list[NewsItem]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item.source] = counts.get(item.source, 0) + 1
    return counts
