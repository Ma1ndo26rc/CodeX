from __future__ import annotations

import json

from .analysis_schema import load_market_analysis, save_market_analysis
from .charts import generate_key_event_charts
from .config import CONFIG
from .emailer import send_report_email
from .fetchers import fetch_all_news, source_counts
from .llm import LLMAnalyzer
from .market_data import update_market_data_files
from .media import download_event_images, enrich_analysis_with_sources
from .pdf_exporter import convert_markdown_to_pdf
from .processing import dedupe_news, enrich_items
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
