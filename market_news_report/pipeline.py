from __future__ import annotations

import json

from .analysis_schema import load_market_analysis, save_market_analysis
from .charts import generate_key_event_charts
from .config import CONFIG
from .emailer import send_report_email
from .fetchers import fetch_all_news, source_counts
from .intelligence import (
    build_market_events,
    build_today_themes,
    enrich_news_items,
    rescore_market_events,
    score_key_events,
)
from .llm import LLMAnalyzer
from .market_data import update_market_data_files
from .media import download_event_images, enrich_analysis_with_sources
from .pdf_exporter import convert_markdown_to_pdf
from .processing import build_news_feed, dedupe_news, enrich_items
from .report import build_report, save_report
from .site_generator import generate_site


def run_daily_job() -> tuple[str, str]:
    keywords = [kw.strip() for kw in CONFIG.google_news_keywords.split(",") if kw.strip()]
    raw_items = fetch_all_news(CONFIG.lookback_hours, keywords=keywords)
    raw_source_counts = source_counts(raw_items)
    items = dedupe_news(raw_items)
    items = enrich_items(items)
    analyzer = LLMAnalyzer()
    analysis = analyzer.summarize_market(items)
    analysis = enrich_analysis_with_sources(analysis, items)
    analysis = download_event_images(analysis, CONFIG.report_output_dir / "assets")
    market_data_bundle = update_market_data_files(CONFIG.report_output_dir)
    analysis["market_data"] = market_data_bundle["snapshot"]
    analysis["news_items"] = enrich_news_items(build_news_feed(items, limit=60))
    analysis["news_events"] = build_market_events(analysis["news_items"])
    analysis = analyzer.enrich_market_events(analysis)
    analysis["news_events"] = rescore_market_events(analysis["news_events"])
    analysis["key_events"] = score_key_events(analysis.get("key_events", []))
    analysis["todays_themes"] = build_today_themes(
        [*analysis["key_events"], *analysis["news_events"][:20]]
    )
    analysis = _ensure_market_brief_defaults(analysis)
    analysis = analyzer.translate_market_analysis(analysis)
    market_analysis_path, _ = save_market_analysis(analysis, CONFIG.report_output_dir)
    market_analysis = load_market_analysis(market_analysis_path)
    charts = generate_key_event_charts(market_analysis, CONFIG.report_output_dir / "assets")
    md = build_report(market_analysis, charts)
    md_path, _ = save_report(md, market_analysis, CONFIG.report_output_dir)
    pdf_path = convert_markdown_to_pdf(md_path)
    generate_site()
    send_report_email(f"US Stock Daily Report - {md_path.stem}", md)
    _write_source_diagnostics(raw_source_counts, source_counts(items))
    return str(md_path), str(pdf_path)


def _ensure_market_brief_defaults(analysis: dict) -> dict:
    events = analysis.get("key_events") or analysis.get("news_events") or []
    top_event = events[0] if events else {}
    if not analysis.get("dynamic_headline"):
        analysis["dynamic_headline"] = top_event.get("title") or "US equities await stronger market confirmation."
    if not analysis.get("market_narrative"):
        analysis["market_narrative"] = analysis.get("market_summary") or "Data unavailable."
    if not analysis.get("key_drivers"):
        analysis["key_drivers"] = [
            {
                "name": topic,
                "importance_score": max(40, 90 - index * 10),
                "explanation": f"{topic} is a leading driver in the latest market events.",
                "affected_assets": top_event.get("affected_markets", []),
            }
            for index, topic in enumerate(top_event.get("topics", [])[:5])
        ]
    if not analysis.get("what_to_watch_tomorrow"):
        analysis["what_to_watch_tomorrow"] = [
            {
                "item": "Market breadth and Treasury yields",
                "type": "Upcoming",
                "why_it_matters": "Confirmation is needed before treating the current narrative as a durable trend.",
            }
        ]
    return analysis


def _write_source_diagnostics(raw_counts: dict[str, int], deduped_counts: dict[str, int]) -> None:
    diagnostics_path = CONFIG.report_output_dir / "source_diagnostics.json"
    diagnostics_path.parent.mkdir(parents=True, exist_ok=True)
    diagnostics_path.write_text(
        json.dumps(
            {"raw_source_counts": raw_counts, "deduped_source_counts": deduped_counts},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
