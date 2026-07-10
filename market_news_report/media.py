from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

import requests

from .fetchers import REQUEST_HEADERS
from .models import NewsItem


def enrich_analysis_with_sources(analysis: dict, items: list[NewsItem], max_sources: int = 3) -> dict:
    for event in analysis.get("key_events", []):
        matches = _rank_matching_items(event, items)
        source_pairs = _source_pairs_from_event(event)
        image_urls = []

        for item in matches[:max_sources]:
            if item.link:
                source_pairs.append((item.source or _source_name_from_url(item.link), item.link))
            if item.image_url:
                image_urls.append(item.image_url)

        source_pairs = _unique_pairs(source_pairs)[:max_sources]
        event["source_names"] = [name for name, _ in source_pairs]
        event["source_urls"] = [url for _, url in source_pairs]
        event["image_urls"] = _unique(image_urls)[:max_sources]
    return analysis


def download_event_images(
    analysis: dict,
    output_dir: Path,
    max_images_per_event: int = 1,
    max_events: int = 24,
    event_fields: tuple[str, ...] = ("key_events", "news_events"),
) -> dict:
    image_dir = output_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    used_images = set()
    processed_events = 0

    for event in _iter_image_events(analysis, event_fields):
        image_urls = _event_image_urls(event)
        if not image_urls:
            event["image_paths"] = []
            continue
        if processed_events >= max_events:
            break
        processed_events += 1
        local_paths = []
        for image_index, image_url in enumerate(image_urls[:max_images_per_event], 1):
            image_key = _image_key(image_url)
            if image_key and image_key in used_images:
                continue
            if image_key:
                used_images.add(image_key)
            path = _download_image(image_url, image_dir, processed_events, image_index)
            if path:
                local_paths.append(path.as_posix())
        event["image_paths"] = local_paths
    return analysis


def _iter_image_events(analysis: dict, fields: tuple[str, ...]):
    seen = set()
    for field in fields:
        for event in analysis.get(field, []) or []:
            if not isinstance(event, dict):
                continue
            key = event.get("event_id") or event.get("title") or id(event)
            if key in seen:
                continue
            seen.add(key)
            yield event


def _event_image_urls(event: dict) -> list[str]:
    urls = []
    for field in ("image_urls", "images"):
        value = event.get(field)
        if isinstance(value, list):
            urls.extend(str(item) for item in value if item)
        elif value:
            urls.append(str(value))
    for field in ("image_url", "thumbnail_url", "thumbnail", "media_url", "og_image"):
        value = event.get(field)
        if value:
            urls.append(str(value))
    for article in event.get("articles", []) or []:
        if not isinstance(article, dict):
            continue
        for field in ("image_url", "thumbnail_url", "thumbnail", "media_url", "og_image"):
            value = article.get(field)
            if value:
                urls.append(str(value))
    return _unique(urls)


def _rank_matching_items(event: dict, items: list[NewsItem]) -> list[NewsItem]:
    terms = _event_terms(event)
    scored = []
    for item in items:
        text = f"{item.title} {item.summary} {item.source}".lower()
        score = sum(1 for term in terms if term and term in text)
        if score and item.image_url:
            score += 0.5
        if score:
            scored.append((score, item))
    scored.sort(key=lambda row: row[0], reverse=True)
    return [item for _, item in scored]


def _event_terms(event: dict) -> set[str]:
    text = " ".join(
        [
            str(event.get("title", "")),
            str(event.get("sector", "")),
            str(event.get("event_type", "")),
            " ".join(event.get("entities", []) or []),
        ]
    )
    return {term.lower() for term in re.findall(r"[A-Za-z0-9][A-Za-z0-9&.-]{2,}", text)}


def _download_image(url: str, image_dir: Path, event_index: int, image_index: int) -> Path | None:
    if not url or not url.startswith(("http://", "https://")):
        return None
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        response.raise_for_status()
    except Exception:
        return None

    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        return None

    suffix = _image_suffix(url, content_type)
    path = image_dir / f"event_{event_index:02d}_{image_index:02d}{suffix}"
    path.write_bytes(response.content)
    return path


def _image_suffix(url: str, content_type: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return suffix
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    if "gif" in content_type:
        return ".gif"
    return ".jpg"


def _image_key(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.netloc.lower()}{parsed.path}".lower()


def _unique(values: list[str]) -> list[str]:
    seen = set()
    unique_values = []
    for value in values:
        if value and value not in seen:
            unique_values.append(value)
            seen.add(value)
    return unique_values


def _source_pairs_from_event(event: dict) -> list[tuple[str, str]]:
    names = event.get("source_names", []) or []
    urls = event.get("source_urls", []) or []
    pairs = []
    for index, url in enumerate(urls):
        name = names[index] if index < len(names) and names[index] else _source_name_from_url(url)
        pairs.append((name, url))
    return pairs


def _source_name_from_url(url: str) -> str:
    host = urlparse(url).netloc.lower().removeprefix("www.")
    known = {
        "cnbc.com": "CNBC",
        "finance.yahoo.com": "Yahoo Finance",
        "reuters.com": "Reuters",
        "bloomberg.com": "Bloomberg",
        "marketwatch.com": "MarketWatch",
        "wsj.com": "WSJ",
    }
    for domain, name in known.items():
        if host.endswith(domain):
            return name
    return host or "Source"


def _unique_pairs(values: list[tuple[str, str]]) -> list[tuple[str, str]]:
    seen = set()
    unique_values = []
    for name, url in values:
        if url and url not in seen:
            unique_values.append((name, url))
            seen.add(url)
    return unique_values
