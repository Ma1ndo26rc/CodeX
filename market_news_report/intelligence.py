from __future__ import annotations

import hashlib
import math
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any


SOURCE_QUALITY_RULES = (
    (("reuters",), 100),
    (("bloomberg",), 98),
    (("wall street journal", "wsj"), 97),
    (("financial times",), 94),
    (("associated press", "ap news"), 91),
    (("barron's", "barrons"), 90),
    (("nasdaq",), 89),
    (("cnbc",), 88),
    (("marketwatch",), 86),
    (("investor's business daily", "investors business daily"), 78),
    (("yahoo finance", "yahoo"), 76),
    (("seeking alpha",), 74),
    (("zacks",), 68),
    (("fxempire", "trefis"), 64),
    (("tradingkey",), 58),
    (("pcmag",), 55),
)

TOPIC_RULES = {
    "Fed / Rates": ("federal reserve", " fed ", "fomc", "rate hike", "rate cut", "interest rate", "treasury yield", "kashkari", "powell"),
    "Geopolitics": ("iran", "israel", "ukraine", "russia", "ceasefire", "sanction", "strait of hormuz", "drone attack", "geopolitical"),
    "Oil / Energy": ("oil", "crude", "opec", "energy", "natural gas", "strait of hormuz", "tanker"),
    "AI": ("artificial intelligence", " ai ", "openai", "ai capex", "ai demand", "data center"),
    "Semiconductor": ("semiconductor", "nvidia", "nvda", "micron", "amd", "broadcom", "chip", "synaptics", "on semiconductor"),
    "Big Tech": ("apple", "microsoft", "amazon", "alphabet", "google", "meta", "tesla", "oracle", "mega-cap", "big tech"),
    "Earnings": ("earnings", "revenue", "profit", "guidance", "margin", "quarterly results", "beat estimates", "missed estimates"),
    "Macro": ("inflation", "cpi", "ppi", "payroll", "jobs report", "gdp", "recession", "trade deficit", "dollar"),
    "Company News": ("ceo", "layoff", "acquisition", "merger", "ipo", "buyback", "dividend", "shares", "stock"),
}

SOFT_NEWS_TERMS = (
    "apple tv",
    "tv series",
    "streaming show",
    "movie",
    "box office",
    "review",
    "weekend outlook",
    "ram tax",
    "macbook price",
    "product comparison",
    "smart glasses",
    "camera",
    "renewed drops to",
    "flagship for almost half price",
    "shredded cash",
    "$100,000 bill",
    "museum",
    "entertainment review",
)

ENTITY_RULES = {
    "OpenAI": ("openai",),
    "NVIDIA": ("nvidia", "nvda"),
    "Micron": ("micron", " mu "),
    "Federal Reserve": ("federal reserve", " fed ", "fomc"),
    "US Treasury": ("treasury", "10-year yield", "10y yield"),
    "Iran": ("iran",),
    "Strait of Hormuz": ("strait of hormuz", "hormuz"),
    "Crude Oil": ("crude oil", "oil prices", "brent", "wti"),
    "Apple": ("apple", "aapl"),
    "Microsoft": ("microsoft", "msft"),
    "Amazon": ("amazon", "amzn"),
    "Alphabet": ("alphabet", "google", "googl"),
    "Meta": ("meta platforms", "meta", "fb"),
    "Tesla": ("tesla", "tsla"),
    "Oracle": ("oracle", "orcl"),
    "SpaceX": ("spacex",),
    "SEC": ("sec", "securities and exchange commission"),
}

TICKER_RULES = {
    "NVIDIA": "NVDA",
    "Micron": "MU",
    "Apple": "AAPL",
    "Microsoft": "MSFT",
    "Amazon": "AMZN",
    "Alphabet": "GOOGL",
    "Meta": "META",
    "Tesla": "TSLA",
    "Oracle": "ORCL",
}

TITLE_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
    "after", "amid", "says", "reportedly", "report", "reports", "stock", "stocks", "shares", "market", "markets", "news",
}


def source_quality_score(source: str) -> int:
    value = (source or "").lower()
    for names, score in SOURCE_QUALITY_RULES:
        if any(name in value for name in names):
            return score
    return 42 if value else 35


def enrich_news_items(items: list[dict[str, Any]], now: datetime | None = None) -> list[dict[str, Any]]:
    reference = now or datetime.now(timezone.utc)
    for item in items:
        text = _text_blob(item)
        topics = classify_topics(text, item.get("category", ""))
        entities = extract_entities(text, item.get("keywords", []))
        tickers = _unique([*item.get("tickers", []), *(TICKER_RULES[name] for name in entities if name in TICKER_RULES)])
        quality = source_quality_score(str(item.get("source_name", "")))
        impact = estimate_impact_score(text, topics, str(item.get("category", "")), quality)
        sentiment = estimate_sentiment_score(text, str(item.get("sentiment", "neutral")))
        freshness = freshness_score(item.get("published_at"), reference)
        macro_weight = macro_weight_score(topics)
        item.update(
            {
                "topics": topics,
                "keywords": _unique([*entities, *item.get("keywords", [])])[:6],
                "tickers": tickers[:6],
                "source_quality_score": quality,
                "market_impact_score": impact,
                "sentiment_score": sentiment,
                "macro_weight": macro_weight,
                "freshness_score": freshness,
                "priority_level": "Low" if "Low Priority" in topics else priority_level(impact),
                "time_horizon": infer_time_horizon(topics, text),
            }
        )
    return items


def build_market_events(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    clusters: list[list[dict[str, Any]]] = []
    ranked = sorted(
        items,
        key=lambda row: (row.get("market_impact_score", 0), row.get("source_quality_score", 0), row.get("freshness_score", 0)),
        reverse=True,
    )
    for item in ranked:
        best_index = -1
        best_score = 0.0
        for index, cluster in enumerate(clusters):
            score = max(_article_similarity(item, candidate) for candidate in cluster)
            if score > best_score:
                best_index, best_score = index, score
        if best_index >= 0 and best_score >= 0.48:
            clusters[best_index].append(item)
        else:
            clusters.append([item])

    events = [_cluster_to_event(cluster) for cluster in clusters]
    return sorted(events, key=lambda event: event["final_score"], reverse=True)


def score_key_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for event in events:
        text = _text_blob(event)
        topics = classify_topics(text, str(event.get("sector", "")))
        sources = _unique(event.get("source_names", []))
        qualities = [source_quality_score(source) for source in sources]
        quality = max(qualities, default=50)
        source_count = max(1, len(sources))
        cross = cross_source_score(source_count)
        macro = macro_weight_score(topics)
        freshness = 72
        impact = int(event.get("market_impact_score", 0) or estimate_impact_score(text, topics, str(event.get("sector", "")), quality))
        sentiment = float(event.get("sentiment_score", 0.0))
        if abs(sentiment) < 0.05:
            sentiment = estimate_sentiment_score(text, "neutral")
        final = calculate_final_score(impact, macro, quality, cross, freshness)
        event.update(
            {
                "topics": topics,
                "source_quality_score": quality,
                "source_count": source_count,
                "cross_source_frequency": cross,
                "macro_weight": macro,
                "freshness_score": freshness,
                "confidence_score": round(0.55 * quality + 0.45 * cross, 1),
                "final_score": final,
                "priority_level": "Low" if "Low Priority" in topics else priority_level(final),
                "sentiment_score": round(sentiment, 2),
            }
        )
    return sorted(events, key=lambda event: event.get("final_score", 0), reverse=True)


def rescore_market_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for event in events:
        topics = classify_topics(_text_blob(event), "")
        impact = max(0, min(100, int(event.get("market_impact_score", 0))))
        macro = macro_weight_score(topics)
        quality = max(0, min(100, int(event.get("source_quality_score", 42))))
        cross = max(0, min(100, int(event.get("cross_source_frequency", 20))))
        freshness = max(0, min(100, int(event.get("freshness_score", 45))))
        sentiment = float(event.get("sentiment_score", 0.0))
        if abs(sentiment) < 0.02:
            sentiment = estimate_sentiment_score(_text_blob(event), "neutral")
        final = calculate_final_score(impact, macro, quality, cross, freshness)
        event["final_score"] = final
        event["topics"] = topics
        event["macro_weight"] = macro
        event["sentiment_score"] = sentiment
        event["priority_level"] = "Low" if "Low Priority" in topics else priority_level(final)
        event["confidence_score"] = round(0.55 * quality + 0.45 * cross, 1)
    return sorted(events, key=lambda event: event.get("final_score", 0), reverse=True)


def build_today_themes(events: list[dict[str, Any]], limit: int = 6) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        for topic in event.get("topics", []):
            if topic in {"Company News", "Low Priority"}:
                continue
            grouped.setdefault(topic, []).append(event)

    themes = []
    for name, related in grouped.items():
        ranked = sorted(related, key=lambda row: row.get("final_score", 0), reverse=True)
        importance = min(100, round(max(row.get("final_score", 0) for row in ranked) + min(8, (len(ranked) - 1) * 2), 1))
        tickers = _unique(value for row in ranked for value in (row.get("related_tickers") or row.get("entities") or []))[:8]
        sectors = _unique(str(row.get("sector", "")) for row in ranked if row.get("sector"))[:5]
        themes.append(
            {
                "name": name,
                "importance_score": importance,
                "affected_sectors": sectors,
                "related_tickers": tickers,
                "explanation": _theme_explanation(name, ranked[0]),
                "related_events": [row.get("title", "") for row in ranked[:3]],
                "translations": {},
            }
        )
    return sorted(themes, key=lambda row: row["importance_score"], reverse=True)[:limit]


def classify_topics(text: str, category: str = "") -> list[str]:
    padded = f" {text.lower()} "
    topics = [name for name, terms in TOPIC_RULES.items() if any(term in padded for term in terms)]
    monetary_context = any(term in padded for term in ("rate", "inflation", "yield", "monetary", "hawkish", "dovish", "dot plot", "fomc"))
    if "Fed / Rates" in topics and not monetary_context:
        topics.remove("Fed / Rates")
    big_tech_context = any(term in padded for term in ("earnings", "stock", "shares", "capex", "revenue", "guidance", "market share", "regulation", "acquisition", "ai", "cloud"))
    if "Big Tech" in topics and not big_tech_context:
        topics.remove("Big Tech")
    category_lower = category.lower()
    if category_lower in {"macro", "policy"} and "Macro" not in topics:
        topics.append("Macro")
    if category_lower == "company" and "Company News" not in topics:
        topics.append("Company News")
    if any(term in padded for term in SOFT_NEWS_TERMS):
        topics.append("Low Priority")
        if "Macro" in topics and not any(term in padded for term in ("inflation", "rate", "yield", "gdp", "jobs report", "trade deficit")):
            topics.remove("Macro")
    return _unique(topics) or ["Company News"]


def estimate_impact_score(text: str, topics: list[str], category: str, quality: int) -> int:
    base = {"macro": 62, "policy": 60, "industry": 52, "company": 46}.get(category.lower(), 42)
    floors = {
        "Fed / Rates": 84,
        "Geopolitics": 78,
        "Oil / Energy": 76,
        "Semiconductor": 70,
        "AI": 66,
        "Macro": 68,
        "Earnings": 60,
        "Big Tech": 56,
        "Company News": 45,
    }
    score = max([base, *(floors.get(topic, base) for topic in topics)])
    lowered = text.lower()
    if any(term in lowered for term in ("market-wide", "supply shock", "rate hike", "inflation tops", "fomc", "ceasefire", "sell-off", "selloff", "crash")):
        score += 8
    if any(term in lowered for term in ("record earnings", "guidance cut", "profit warning", "ipo delay", "acquisition")):
        score += 5
    score += round((quality - 60) * 0.08)
    if "Low Priority" in topics:
        score = min(score, 38)
    return max(10, min(100, int(score)))


def estimate_sentiment_score(text: str, label: str = "neutral") -> float:
    value = text.lower()
    negative_rules = (
        (("hawkish", "rate hike", "higher rates"), -0.55),
        (("supply shock", "supply disruption", "ceasefire", "drone attack"), -0.45),
        (("sell-off", "selloff", "tumbles", "plunges", "down 20%", "down 17%"), -0.55),
        (("regulatory risk", "probe", "investigation", "lawsuit", "sanction"), -0.4),
        (("layoff", "job cuts", "guidance cut", "profit warning", "missed estimates"), -0.45),
        (("inflation", "trade deficit", "recession"), -0.25),
        (("delay", "weakness", "decline", "falls", "slips"), -0.2),
    )
    positive_rules = (
        (("strong earnings", "record earnings", "beat estimates", "beats estimates"), 0.5),
        (("ai demand", "demand growth", "raises guidance", "upgrade"), 0.45),
        (("rally", "surges", "jumps", "record high"), 0.4),
        (("rate cut", "cooling inflation", "soft landing"), 0.35),
        (("growth", "expands", "market share", "approval"), 0.22),
    )
    score = 0.0
    for terms, weight in negative_rules:
        if any(term in value for term in terms):
            score += weight
    for terms, weight in positive_rules:
        if any(term in value for term in terms):
            score += weight
    if abs(score) < 0.05:
        score = 0.16 if label == "positive" else -0.16 if label == "negative" else 0.03
    return round(max(-1.0, min(1.0, score)), 2)


def macro_weight_score(topics: list[str]) -> int:
    weights = {
        "Fed / Rates": 100,
        "Geopolitics": 95,
        "Oil / Energy": 92,
        "Macro": 90,
        "Semiconductor": 78,
        "AI": 76,
        "Big Tech": 64,
        "Earnings": 58,
        "Company News": 35,
        "Low Priority": 15,
    }
    if "Low Priority" in topics and not any(topic in topics for topic in ("Fed / Rates", "Geopolitics", "Oil / Energy")):
        return 15
    return max((weights.get(topic, 30) for topic in topics), default=30)


def freshness_score(value: Any, now: datetime | None = None) -> int:
    published = _parse_datetime(value)
    if not published:
        return 45
    reference = now or datetime.now(timezone.utc)
    if reference.tzinfo is None:
        reference = reference.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (reference - published).total_seconds() / 3600)
    return max(20, min(100, round(100 - age_hours * 2.5)))


def cross_source_score(source_count: int) -> int:
    return {1: 20, 2: 55, 3: 75, 4: 88}.get(max(1, source_count), 100)


def calculate_final_score(impact: float, macro: float, quality: float, cross_source: float, freshness: float) -> float:
    return round(0.45 * impact + 0.20 * macro + 0.15 * quality + 0.10 * cross_source + 0.10 * freshness, 1)


def priority_level(score: float) -> str:
    if score >= 80:
        return "Critical"
    if score >= 65:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def infer_time_horizon(topics: list[str], text: str) -> str:
    if "Fed / Rates" in topics or "Macro" in topics:
        return "short-to-medium term"
    if "Geopolitics" in topics or "Oil / Energy" in topics:
        return "near-term"
    if any(value in topics for value in ("AI", "Semiconductor", "Big Tech")) and any(term in text.lower() for term in ("capex", "demand", "regulation", "acquisition")):
        return "medium-term"
    return "short-term"


def extract_entities(text: str, existing: list[str] | None = None) -> list[str]:
    padded = f" {text.lower()} "
    values = list(existing or [])
    for name, aliases in ENTITY_RULES.items():
        if any(alias in padded for alias in aliases):
            values.append(name)
    values.extend(re.findall(r"\b[A-Z]{2,5}\b", text))
    return _unique(values)[:8]


def _cluster_to_event(cluster: list[dict[str, Any]]) -> dict[str, Any]:
    articles = sorted(cluster, key=lambda row: (row.get("source_quality_score", 0), row.get("market_impact_score", 0)), reverse=True)
    primary = articles[0]
    sources = []
    seen_urls = set()
    for article in articles:
        url = str(article.get("source_url", ""))
        if url in seen_urls:
            continue
        seen_urls.add(url)
        sources.append(
            {
                "name": article.get("source_name", ""),
                "url": url,
                "quality_score": article.get("source_quality_score", 0),
                "published_at": article.get("published_at", ""),
            }
        )
    source_count = len(_unique(source.get("name", "") for source in sources if source.get("name"))) or 1
    quality = max((source.get("quality_score", 0) for source in sources), default=42)
    cross = cross_source_score(source_count)
    topics = _unique(topic for article in articles for topic in article.get("topics", []))
    macro = max((article.get("macro_weight", 30) for article in articles), default=30)
    freshness = max((article.get("freshness_score", 45) for article in articles), default=45)
    impact = min(100, max(article.get("market_impact_score", 0) for article in articles) + min(10, (source_count - 1) * 3))
    sentiment = _weighted_sentiment(articles)
    final = calculate_final_score(impact, macro, quality, cross, freshness)
    title = _clean_title(str(primary.get("title", "")), str(primary.get("source_name", "")))
    entities = _unique(value for article in articles for value in article.get("keywords", []))[:8]
    tickers = _unique(value for article in articles for value in article.get("tickers", []))[:8]
    return {
        "event_id": hashlib.sha1(_normalized_title(title).encode("utf-8")).hexdigest()[:12],
        "title": title,
        "summary": primary.get("summary", ""),
        "sector": _event_sector(topics, str(primary.get("category", ""))),
        "event_type": topics[0] if topics else "Company News",
        "topics": topics,
        "keywords": entities,
        "related_tickers": tickers,
        "market_impact_score": impact,
        "sentiment_score": sentiment,
        "priority_level": "Low" if "Low Priority" in topics else priority_level(final),
        "time_horizon": primary.get("time_horizon", "short-term"),
        "why_it_matters": _why_it_matters(topics, title, tickers),
        "source_quality_score": quality,
        "source_count": source_count,
        "cross_source_frequency": cross,
        "macro_weight": macro,
        "freshness_score": freshness,
        "confidence_score": round(0.55 * quality + 0.45 * cross, 1),
        "final_score": final,
        "published_at": max((str(article.get("published_at", "")) for article in articles), default=""),
        "primary_source": sources[0] if sources else {},
        "related_sources": sources,
        "source_names": [source.get("name", "") for source in sources],
        "source_urls": [source.get("url", "") for source in sources],
        "articles": articles,
        "translations": {},
    }


def _article_similarity(left: dict[str, Any], right: dict[str, Any]) -> float:
    left_tokens, right_tokens = _title_tokens(left.get("title", "")), _title_tokens(right.get("title", ""))
    union = left_tokens | right_tokens
    jaccard = len(left_tokens & right_tokens) / len(union) if union else 0.0
    sequence = SequenceMatcher(None, _normalized_title(left.get("title", "")), _normalized_title(right.get("title", ""))).ratio()
    left_entities, right_entities = set(left.get("keywords", [])), set(right.get("keywords", []))
    entity_overlap = len(left_entities & right_entities) / max(1, min(len(left_entities), len(right_entities)))
    left_tickers, right_tickers = set(left.get("tickers", [])), set(right.get("tickers", []))
    ticker_overlap = 1.0 if left_tickers & right_tickers else 0.0
    topic_overlap = 1.0 if set(left.get("topics", [])) & set(right.get("topics", [])) else 0.0
    score = 0.45 * jaccard + 0.20 * sequence + 0.20 * entity_overlap + 0.10 * ticker_overlap + 0.05 * topic_overlap
    if ticker_overlap and topic_overlap and jaccard >= 0.2:
        score += 0.08
    return min(1.0, score)


def _weighted_sentiment(articles: list[dict[str, Any]]) -> float:
    total_weight = sum(max(1, article.get("source_quality_score", 1)) for article in articles)
    value = sum(article.get("sentiment_score", 0.0) * max(1, article.get("source_quality_score", 1)) for article in articles) / total_weight
    return round(max(-1.0, min(1.0, value)), 2)


def _event_sector(topics: list[str], category: str) -> str:
    if any(topic in topics for topic in ("Fed / Rates", "Macro", "Geopolitics")):
        return "Macro"
    if "Oil / Energy" in topics:
        return "Energy"
    if any(topic in topics for topic in ("AI", "Semiconductor", "Big Tech")):
        return "Technology"
    return category.title() or "Market"


def _why_it_matters(topics: list[str], title: str, tickers: list[str]) -> str:
    lens = {
        "Fed / Rates": "This can reprice Treasury yields, equity discount rates and growth-stock multiples.",
        "Geopolitics": "This adds a geopolitical risk premium that can move energy, inflation expectations and broad risk appetite.",
        "Oil / Energy": "Oil moves feed directly into inflation expectations, margins and sector rotation.",
        "AI": "The event can reset expectations for AI demand, capital spending and high-multiple technology valuations.",
        "Semiconductor": "Semiconductor demand and guidance often transmit quickly across the Nasdaq and the broader AI trade.",
        "Earnings": "The key market signal is whether results change forward guidance, margins or peer expectations.",
        "Big Tech": "Mega-cap moves can materially affect index direction because of their concentration in major benchmarks.",
    }
    explanation = next((lens[topic] for topic in topics if topic in lens), "The event may affect positioning if it changes earnings expectations, valuation or sector leadership.")
    ticker_text = f" Watch {', '.join(tickers[:5])} for confirmation." if tickers else ""
    return f"{explanation}{ticker_text}"


def _theme_explanation(name: str, event: dict[str, Any]) -> str:
    title = event.get("title", "the leading event")
    return f"{name} is a leading market theme today, led by {title}."


def _text_blob(item: dict[str, Any]) -> str:
    return " ".join(
        [
            str(item.get("title", "")),
            str(item.get("summary", "")),
            str(item.get("category", item.get("sector", ""))),
            " ".join(item.get("keywords", []) or []),
            " ".join(item.get("entities", []) or []),
        ]
    )


def _title_tokens(value: Any) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", str(value).lower()) if len(token) > 2 and token not in TITLE_STOPWORDS}


def _normalized_title(value: Any) -> str:
    return " ".join(sorted(_title_tokens(value)))


def _clean_title(title: str, source: str) -> str:
    cleaned = title.strip()
    if source:
        cleaned = re.sub(rf"\s*[-|]\s*{re.escape(source)}\s*$", "", cleaned, flags=re.IGNORECASE)
    return cleaned


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _unique(values) -> list:
    result = []
    seen = set()
    for value in values:
        cleaned = str(value).strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result
