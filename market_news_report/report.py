from __future__ import annotations

import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from .models import NewsItem


def _fmt_dt(dt: datetime | None) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else "Unknown"


def build_report(items: list[NewsItem], analysis: dict) -> tuple[str, dict]:
    top_items = sorted(items, key=lambda x: (x.score, x.published_at or datetime.min), reverse=True)[:10]
    categories = Counter(i.category for i in items)
    sentiment = Counter(i.sentiment for i in items)

    md = []
    md.append(f"# US Stock Daily Report")
    md.append("")
    md.append(f"Generated: {_fmt_dt(datetime.now())}")
    md.append("")
    md.append("## Market Summary")
    md.append(analysis.get("market_summary", "No summary available."))
    md.append("")
    md.append("## Index Performance Summary")
    md.append(analysis.get("index_performance_summary", "No index summary available."))
    md.append("")
    md.append("## Top Company News (Top 10)")
    for idx, item in enumerate(top_items, 1):
        md.append(f"{idx}. **{item.title}**")
        md.append(f"   - Source: {item.source}")
        md.append(f"   - Published: {_fmt_dt(item.published_at)}")
        md.append(f"   - Category: {item.category} | Sentiment: {item.sentiment}")
        md.append(f"   - Link: {item.link}")
    md.append("")
    md.append("## Macro Events")
    macro_events = analysis.get("macro_events", [])
    if isinstance(macro_events, list) and macro_events:
        for row in macro_events:
            md.append(f"- {row}")
    else:
        md.append(analysis.get("macro_events", "No macro events available."))
    md.append("")
    md.append("## Risk & Sentiment")
    md.append(analysis.get("risk_and_sentiment", "No sentiment available."))
    md.append("")
    md.append("## Statistics")
    md.append(f"- Total articles: {len(items)}")
    md.append(f"- Category counts: {dict(categories)}")
    md.append(f"- Sentiment counts: {dict(sentiment)}")

    data = {
        "generated_at": datetime.now().isoformat(),
        "market_summary": analysis.get("market_summary", ""),
        "index_performance_summary": analysis.get("index_performance_summary", ""),
        "macro_events": analysis.get("macro_events", []),
        "risk_and_sentiment": analysis.get("risk_and_sentiment", ""),
        "top_company_news": [
            {
                "title": item.title,
                "source": item.source,
                "published_at": item.published_at.isoformat() if item.published_at else None,
                "category": item.category,
                "sentiment": item.sentiment,
                "link": item.link,
            }
            for item in top_items
        ],
        "articles": [item.to_dict() for item in items],
        "stats": {"categories": dict(categories), "sentiment": dict(sentiment), "total_articles": len(items)},
    }
    return "\n".join(md), data


def save_report(md: str, data: dict, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    yyyymmdd = datetime.now().strftime("%Y%m%d")
    md_path = output_dir / f"US_STOCK_DAILY_{yyyymmdd}.md"
    json_path = output_dir / f"US_STOCK_DAILY_{yyyymmdd}.json"
    md_path.write_text(md, encoding="utf-8")
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return md_path, json_path
