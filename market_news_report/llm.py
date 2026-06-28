from __future__ import annotations

import html
import json
import re
from collections import Counter

from openai import OpenAI

from .analysis_schema import SCHEMA, parse_and_validate_market_json
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
        payload = "\n".join(
            (
                f"- title: {i.title}\n"
                f"  source: {i.source}\n"
                f"  published_at: {i.published_at.isoformat() if i.published_at else ''}\n"
                f"  category: {i.category}\n"
                f"  sentiment: {i.sentiment}\n"
                f"  source_url: {i.link}\n"
                f"  image_url: {i.image_url}\n"
                f"  summary: {i.summary[:500]}"
            )
            for i in items[:80]
        )

        prompt = f"""
You are a professional US equity research analyst.

Analyze the following news and return ONLY valid JSON.

Schema:
{json.dumps(SCHEMA, ensure_ascii=False, indent=2)}

Rules:
- key_events: 5-10 most important events
- dynamic_headline: one sentence stating the dominant market narrative
- market_narrative: 1-2 concise paragraphs explaining why markets moved, the main drivers and affected assets
- key_drivers: 3-5 ranked drivers, not a list of article summaries
- sector_theme_impact: identify winners, losers and themes to watch
- what_to_watch_tomorrow: macro data, earnings, Fed speakers, key tickers or geopolitical risks
- market_impact_score: integer 0-100
- sentiment_score: float -1 to 1
- use 80-100 for market-wide events, 65-85 for sector events, 55-75 for major company events, and 10-40 for soft news
- clearly directional news should not receive 0 sentiment
- include all fields
- estimate missing values using market judgment
- summary and why_it_matters should be substantive, not headline repeats
- risk_and_sentiment should discuss positioning, volatility, breadth and risk direction without repeating market_narrative
- source_urls and image_urls should use URLs from the input news where relevant

News:
{payload}
"""
        resp = self.client.chat.completions.create(
            model=CONFIG.openai_model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        return parse_and_validate_market_json(resp.choices[0].message.content or "")

    def enrich_market_events(self, analysis: dict, batch_size: int = 12) -> dict:
        if not self.enabled:
            return analysis
        events = analysis.get("news_events", [])
        for start in range(0, len(events), batch_size):
            batch = events[start : start + batch_size]
            payload = [
                {
                    "index": start + offset,
                    "title": event.get("title", ""),
                    "summary": event.get("summary", ""),
                    "topics": event.get("topics", []),
                    "keywords": event.get("keywords", []),
                    "related_tickers": event.get("related_tickers", []),
                    "sources": event.get("related_sources", []),
                    "heuristic_impact": event.get("market_impact_score", 0),
                    "heuristic_sentiment": event.get("sentiment_score", 0.0),
                }
                for offset, event in enumerate(batch)
            ]
            prompt = f"""
You are a US equity market intelligence editor.
Return ONLY a valid JSON array with: index, title, summary, why_it_matters,
market_impact_score, sentiment_score, time_horizon, topics, related_tickers,
title_zh, summary_zh, why_it_matters_zh, topics_zh.

Calibrate impact using: market-wide 80-100, sector 65-85, major company 55-75,
ordinary company 30-55, soft/product news 10-40. Give directional sentiment when evidence exists.
Write why_it_matters as investment analysis, not a headline restatement. Do not invent facts.

Events:
{json.dumps(payload, ensure_ascii=False)}
"""
            try:
                response = self.client.chat.completions.create(
                    model=CONFIG.openai_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                )
                rows = self._load_json_array(response.choices[0].message.content or "")
            except Exception as exc:
                print(f"Market event enrichment batch skipped: {exc}")
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                try:
                    index = int(row.get("index"))
                except (TypeError, ValueError):
                    continue
                if not 0 <= index < len(events):
                    continue
                event = events[index]
                for key in ("title", "summary", "why_it_matters", "time_horizon"):
                    if row.get(key):
                        event[key] = str(row[key])
                if isinstance(row.get("topics"), list) and row["topics"]:
                    event["topics"] = [str(value) for value in row["topics"]]
                if isinstance(row.get("related_tickers"), list):
                    event["related_tickers"] = [str(value) for value in row["related_tickers"]]
                event["market_impact_score"] = self._bounded_number(row.get("market_impact_score"), 0, 100, event.get("market_impact_score", 0))
                event["sentiment_score"] = self._bounded_number(row.get("sentiment_score"), -1, 1, event.get("sentiment_score", 0.0))
                event["translations"] = {
                    "zh": {
                        "title": str(row.get("title_zh", "")),
                        "summary": str(row.get("summary_zh", "")),
                        "why_it_matters": str(row.get("why_it_matters_zh", "")),
                        "topics": [str(value) for value in row.get("topics_zh", [])] if isinstance(row.get("topics_zh"), list) else [],
                        "keywords": event.get("translations", {}).get("zh", {}).get("keywords", []),
                    }
                }
        return analysis

    def translate_market_analysis(self, analysis: dict) -> dict:
        """Attach faithful Chinese translations without changing the English analysis."""
        if not self.enabled:
            return analysis

        payload = {
            "dynamic_headline": analysis.get("dynamic_headline", ""),
            "market_summary": analysis.get("market_summary", ""),
            "market_narrative": analysis.get("market_narrative", ""),
            "index_performance_summary": analysis.get("index_performance_summary", ""),
            "macro_outlook": analysis.get("macro_outlook", ""),
            "risk_and_sentiment": analysis.get("risk_and_sentiment", ""),
            "key_drivers": analysis.get("key_drivers", []),
            "sector_theme_impact": analysis.get("sector_theme_impact", {}),
            "what_to_watch_tomorrow": analysis.get("what_to_watch_tomorrow", []),
            "todays_themes": analysis.get("todays_themes", []),
            "key_events": [
                {
                    "index": index,
                    "title": event.get("title", ""),
                    "sector": event.get("sector", ""),
                    "event_type": event.get("event_type", ""),
                    "summary": event.get("summary", ""),
                    "time_horizon": event.get("time_horizon", ""),
                    "why_it_matters": event.get("why_it_matters", ""),
                    "affected_markets": event.get("affected_markets", []),
                }
                for index, event in enumerate(analysis.get("key_events", []))
            ],
        }
        prompt = f"""
Translate the following US equity analysis into professional Simplified Chinese.
Return ONLY valid JSON with exactly the same keys and event indexes.
Preserve company names, tickers, numbers, facts and market meaning. Do not add commentary.

JSON:
{json.dumps(payload, ensure_ascii=False)}
"""
        try:
            response = self.client.chat.completions.create(
                model=CONFIG.openai_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            translated = self._load_json_object(response.choices[0].message.content or "")
            self._attach_chinese_translations(analysis, translated)
        except Exception as exc:  # Translation failure should not block the daily report.
            print(f"Chinese translation skipped: {exc}")
        self.translate_news_items(analysis)
        return analysis

    def translate_news_items(self, analysis: dict, batch_size: int = 15) -> dict:
        if not self.enabled:
            return analysis
        news_items = analysis.get("news_items", [])
        for start in range(0, len(news_items), batch_size):
            batch = news_items[start : start + batch_size]
            payload = [
                {
                    "index": start + offset,
                    "title": item.get("title", ""),
                    "summary": item.get("summary", ""),
                    "category": item.get("category", ""),
                    "source": item.get("source_name", ""),
                }
                for offset, item in enumerate(batch)
            ]
            prompt = f"""
Create concise bilingual briefs for these financial news items.
Return ONLY a valid JSON array. Each item must contain:
index, title, summary, summary_en, category, keywords_en, keywords_zh.
- title: professional Simplified Chinese translation of the title
- summary_en: a distinct 1-2 sentence English brief based only on the supplied title and summary
- summary: faithful Simplified Chinese translation of summary_en
- category: Simplified Chinese translation of the category
- keywords_en: 2-5 concise English market-relevant named entities, tickers, people, products or markets
- keywords_zh: Chinese equivalents of keywords_en, while keeping company names, tickers and product names in canonical form
- keep canonical forms such as NVIDIA, NVDA, Federal Reserve, Apple TV or US Treasury where appropriate
- do not use generic category words such as company, macro, industry, policy or market as keywords
- when the supplied summary repeats the title, explain the event and its cautious market relevance without inventing facts
- preserve company names, tickers, numbers and all factual meaning

JSON:
{json.dumps(payload, ensure_ascii=False)}
"""
            try:
                response = self.client.chat.completions.create(
                    model=CONFIG.openai_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                )
                translated = self._load_json_array(response.choices[0].message.content or "")
            except Exception as exc:
                print(f"News translation batch skipped: {exc}")
                continue
            for row in translated:
                if not isinstance(row, dict):
                    continue
                try:
                    index = int(row.get("index"))
                except (TypeError, ValueError):
                    continue
                if not 0 <= index < len(news_items):
                    continue
                if row.get("summary_en"):
                    news_items[index]["summary"] = str(row["summary_en"])
                keywords_en = row.get("keywords_en")
                keywords_zh = row.get("keywords_zh")
                if isinstance(keywords_en, list):
                    news_items[index]["keywords"] = [str(value) for value in keywords_en if value][:5]
                news_items[index]["translations"] = {
                    "zh": {
                        "title": row.get("title", ""),
                        "summary": row.get("summary", ""),
                        "category": row.get("category", ""),
                        "keywords": [str(value) for value in keywords_zh if value][:5] if isinstance(keywords_zh, list) else [],
                    }
                }
        return analysis

    def _attach_chinese_translations(self, analysis: dict, translated: dict) -> None:
        analysis["translations"] = {
            "zh": {
                key: translated.get(key, "")
                for key in (
                    "dynamic_headline",
                    "market_summary",
                    "market_narrative",
                    "index_performance_summary",
                    "macro_outlook",
                    "risk_and_sentiment",
                )
            }
        }
        analysis["translations"]["zh"]["sector_theme_impact"] = translated.get("sector_theme_impact", {})
        self._attach_named_translations(analysis.get("key_drivers", []), translated.get("key_drivers", []))
        self._attach_named_translations(analysis.get("what_to_watch_tomorrow", []), translated.get("what_to_watch_tomorrow", []))
        self._attach_named_translations(analysis.get("todays_themes", []), translated.get("todays_themes", []))
        events = analysis.get("key_events", [])
        for row in translated.get("key_events", []):
            if not isinstance(row, dict):
                continue
            try:
                index = int(row.get("index"))
            except (TypeError, ValueError):
                continue
            if not 0 <= index < len(events):
                continue
            events[index]["translations"] = {
                "zh": {
                    key: row.get(key, [] if key == "affected_markets" else "")
                    for key in (
                        "title",
                        "sector",
                        "event_type",
                        "summary",
                        "time_horizon",
                        "why_it_matters",
                        "affected_markets",
                    )
                }
            }

    def _attach_named_translations(self, target: list[dict], translated: object) -> None:
        if not isinstance(translated, list):
            return
        for index, row in enumerate(translated):
            if index >= len(target) or not isinstance(row, dict):
                continue
            target[index]["translations"] = {
                "zh": {
                    key: row.get(key, "")
                    for key in ("name", "item", "type", "explanation", "why_it_matters")
                }
            }

    def _bounded_number(self, value, minimum: float, maximum: float, fallback: float) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = float(fallback)
        return round(max(minimum, min(maximum, number)), 2)

    def _load_json_object(self, text: str) -> dict:
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start >= 0 and end > start:
            cleaned = cleaned[start : end + 1]
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else {}

    def _load_json_array(self, text: str) -> list:
        cleaned = text.strip()
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
        start, end = cleaned.find("["), cleaned.rfind("]")
        if start >= 0 and end > start:
            cleaned = cleaned[start : end + 1]
        value = json.loads(cleaned)
        return value if isinstance(value, list) else []

    def _fallback_summary(self, items: list[NewsItem]) -> dict:
        positives = sum(1 for i in items if i.sentiment == "positive")
        negatives = sum(1 for i in items if i.sentiment == "negative")
        neutrals = sum(1 for i in items if i.sentiment == "neutral")
        category_counts = Counter(i.category for i in items)
        source_counts = Counter(i.source for i in items)
        dominant_category = category_counts.most_common(1)[0][0] if category_counts else "market"
        tone = self._market_tone(positives, negatives, neutrals)
        top_sources = ", ".join(source for source, _ in source_counts.most_common(5)) or "major financial news sources"
        fallback_themes = self._theme_counts(items)[:5]
        driver_names = [name for name, _ in fallback_themes] or [dominant_category.title()]

        key_events = []
        for item in self._rank_fallback_items(items)[:10]:
            key_events.append(
                {
                    "title": item.title,
                    "entities": self._extract_entities(item),
                    "sector": item.category,
                    "event_type": self._infer_event_type(item),
                    "summary": self._fallback_event_summary(item),
                    "market_impact_score": self._fallback_impact_score(item),
                    "sentiment_score": self._fallback_sentiment_score(item),
                    "time_horizon": self._fallback_time_horizon(item),
                    "why_it_matters": self._fallback_why_it_matters(item),
                    "affected_markets": self._affected_markets(item),
                    "source_names": [item.source] if item.source else [],
                    "source_urls": [item.link] if item.link else [],
                    "image_urls": [item.image_url] if item.image_url else [],
                    "image_paths": [],
                }
            )
        return parse_and_validate_market_json(
            {
                "dynamic_headline": f"{driver_names[0]} leads a {tone} US equity session.",
                "market_summary": (
                    f"The news flow is {tone}, based on {len(items)} articles from {top_sources}. "
                    f"The dominant theme is {dominant_category}, with {category_counts.get('macro', 0)} macro items, "
                    f"{category_counts.get('company', 0)} company items, {category_counts.get('industry', 0)} industry items, "
                    f"and {category_counts.get('policy', 0)} policy items. The tape looks more useful for identifying "
                    f"near-term rotation and risk appetite than for making a single directional index call."
                ),
                "market_narrative": (
                    f"US equities are trading with a {tone} bias as {', '.join(driver_names[:3])} dominate the information flow. "
                    "The most useful confirmation will come from index breadth, Treasury yields and whether leadership broadens beyond the largest stocks."
                ),
                "index_performance_summary": self._fallback_index_summary(category_counts),
                "macro_outlook": self._fallback_macro_outlook(items),
                "risk_and_sentiment": (
                    f"Sentiment is {tone}: {positives} positive, {negatives} negative, and {neutrals} neutral articles. "
                    f"My read is to avoid treating headline volume as conviction by itself; the more important signal is "
                    f"whether macro-sensitive and technology-sensitive stories are pointing in the same direction."
                ),
                "key_drivers": [
                    {
                        "name": name,
                        "importance_score": max(40, 90 - index * 10),
                        "explanation": f"{name} is prominent in the latest market coverage and may influence positioning.",
                        "affected_assets": ["US equities"],
                    }
                    for index, name in enumerate(driver_names[:5])
                ],
                "sector_theme_impact": {
                    "winners": ["Defensive and cash-generative sectors if risk appetite weakens"],
                    "losers": ["High-duration growth exposure if yields rise"],
                    "themes_to_watch": driver_names[:5],
                },
                "what_to_watch_tomorrow": [
                    {
                        "item": "Treasury yields and index breadth",
                        "type": "market confirmation",
                        "why_it_matters": "They will show whether the dominant news themes are producing broad follow-through.",
                    }
                ],
                "key_events": key_events,
            }
        )

    def _rank_fallback_items(self, items: list[NewsItem]) -> list[NewsItem]:
        return sorted(items, key=self._fallback_item_score, reverse=True)

    def _fallback_item_score(self, item: NewsItem) -> float:
        text = item.text_blob().lower()
        score = 30.0
        score += {"macro": 18, "policy": 16, "company": 14, "industry": 12}.get(item.category, 8)
        score += {"positive": 6, "negative": 8, "neutral": 2}.get(item.sentiment, 0)
        source = item.source.lower()
        if any(name in source for name in ("reuters", "bloomberg", "wsj", "financial times", "cnbc", "yahoo finance", "marketwatch")):
            score += 8
        if any(word in text for word in ("fed", "inflation", "rate", "yield", "treasury", "earnings", "guidance", "ai", "semiconductor")):
            score += 10
        if item.image_url:
            score += 2
        return score

    def _market_tone(self, positives: int, negatives: int, neutrals: int) -> str:
        if negatives > positives * 1.2:
            return "cautious to risk-off"
        if positives > negatives * 1.2:
            return "constructive but selective"
        if neutrals > positives + negatives:
            return "mixed and wait-and-see"
        return "balanced but headline-sensitive"

    def _fallback_index_summary(self, category_counts: Counter) -> str:
        parts = []
        if category_counts.get("industry", 0) or category_counts.get("company", 0):
            parts.append(
                "Nasdaq and growth indexes should be the most sensitive part of the tape when AI, semiconductor, mega-cap tech, or guidance stories dominate."
            )
        if category_counts.get("macro", 0):
            parts.append(
                "S&P 500 direction is likely to remain tied to Treasury yields, Fed expectations, inflation data, and broad risk appetite."
            )
        if category_counts.get("policy", 0):
            parts.append(
                "Dow and equal-weight exposure may react more to policy, regulation, tariff, and industrial-cycle headlines."
            )
        return " ".join(parts) or "The index read is mixed; stronger conclusions require live price, breadth, and sector performance data."

    def _fallback_macro_outlook(self, items: list[NewsItem]) -> str:
        macro_items = [item for item in items if item.category == "macro"]
        themes = self._theme_counts(macro_items or items)
        if not themes:
            return "Macro signal is light in the collected articles; keep the focus on yields, the dollar, oil, and upcoming Fed communication."
        theme_text = ", ".join(f"{theme} ({count})" for theme, count in themes[:4])
        return (
            f"Macro coverage is concentrated around {theme_text}. The practical implication is that equity rallies may need confirmation from rates "
            f"and inflation expectations; if yields rise while growth headlines weaken, risk appetite can fade quickly."
        )

    def _fallback_event_summary(self, item: NewsItem) -> str:
        summary = self._clean_text(item.summary or item.content)
        if summary:
            return summary[:500]
        return (
            f"{item.source} reported: \"{item.title}\". The item is classified as {item.category} news with "
            f"{item.sentiment} sentiment, making it relevant for near-term positioning and sector watchlists."
        )

    def _fallback_why_it_matters(self, item: NewsItem) -> str:
        market = ", ".join(self._affected_markets(item))
        category_view = {
            "macro": "Macro stories can reset discount rates, earnings multiples, and broad risk appetite.",
            "company": "Company-specific stories can spill over into peers when they involve guidance, demand, margins, or capital allocation.",
            "industry": "Industry stories matter when they change expectations for sector leadership, pricing power, or capex cycles.",
            "policy": "Policy stories can change regulatory risk, cost structures, and investor appetite for exposed sectors.",
        }.get(item.category, "The story can affect positioning because it changes the market narrative.")
        return (
            f"{category_view} For this item, the relevant market lens is {market}. "
            f"My practical read is to watch whether the headline creates follow-through in related ETFs, peers, or index breadth."
        )

    def _fallback_impact_score(self, item: NewsItem) -> int:
        score = int(self._fallback_item_score(item))
        return max(35, min(90, score))

    def _fallback_sentiment_score(self, item: NewsItem) -> float:
        if item.sentiment == "positive":
            return 0.35
        if item.sentiment == "negative":
            return -0.35
        return 0.0

    def _fallback_time_horizon(self, item: NewsItem) -> str:
        if item.category in {"macro", "policy"}:
            return "short-to-medium term"
        return "short-term"

    def _infer_event_type(self, item: NewsItem) -> str:
        text = item.text_blob().lower()
        rules = [
            ("earnings", ("earnings", "revenue", "profit", "guidance", "margin")),
            ("monetary_policy", ("fed", "rate", "inflation", "cpi", "ppi", "yield", "treasury")),
            ("regulation_policy", ("sec", "antitrust", "regulation", "tariff", "sanction", "government")),
            ("corporate_action", ("merger", "acquisition", "buyback", "dividend", "ipo", "stake")),
            ("sector_trend", ("ai", "semiconductor", "energy", "bank", "retail", "cloud", "software")),
        ]
        for label, keywords in rules:
            if any(keyword in text for keyword in keywords):
                return label
        return "market_news"

    def _affected_markets(self, item: NewsItem) -> list[str]:
        text = item.text_blob().lower()
        markets = ["US equities"]
        if any(word in text for word in ("nasdaq", "ai", "semiconductor", "nvidia", "apple", "microsoft", "tesla", "tech")):
            markets.append("Nasdaq")
        if any(word in text for word in ("fed", "rate", "yield", "treasury", "inflation")):
            markets.extend(["S&P 500", "US Treasuries"])
        if any(word in text for word in ("oil", "energy", "crude")):
            markets.append("Energy")
        if any(word in text for word in ("bank", "financial")):
            markets.append("Financials")
        return list(dict.fromkeys(markets))

    def _extract_entities(self, item: NewsItem) -> list[str]:
        title = item.title or ""
        tickers = list(item.tickers)
        known_names = re.findall(r"\b[A-Z][A-Za-z&.-]{2,}(?:\s+[A-Z][A-Za-z&.-]{2,})?\b", title)
        entities = tickers + [name for name in known_names if name.lower() not in {"the", "and", "for", "with"}]
        return list(dict.fromkeys(entities))[:6]

    def _theme_counts(self, items: list[NewsItem]) -> list[tuple[str, int]]:
        themes = {
            "Fed/rates": ("fed", "rate", "rates", "treasury", "yield"),
            "inflation": ("inflation", "cpi", "ppi", "prices"),
            "growth/jobs": ("jobs", "payroll", "gdp", "growth"),
            "oil/energy": ("oil", "crude", "energy"),
            "tariffs/policy": ("tariff", "policy", "regulation", "government"),
        }
        counts = Counter()
        for item in items:
            text = item.text_blob().lower()
            for label, keywords in themes.items():
                if any(keyword in text for keyword in keywords):
                    counts[label] += 1
        return counts.most_common()

    def _clean_text(self, value: str) -> str:
        text = html.unescape(value or "")
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text
