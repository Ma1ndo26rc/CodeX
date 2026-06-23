from __future__ import annotations

from .config import CONFIG
from .emailer import send_report_email
from .fetchers import fetch_all_news
from .llm import LLMAnalyzer
from .processing import dedupe_news, enrich_items
from .report import build_report, save_report


def run_daily_job() -> tuple[str, str]:
    items = fetch_all_news(CONFIG.lookback_hours)
    items = dedupe_news(items)
    items = enrich_items(items)
    analyzer = LLMAnalyzer()
    analysis = analyzer.summarize_market(items)
    md, data = build_report(items, analysis)
    md_path, json_path = save_report(md, data, CONFIG.report_output_dir)
    send_report_email(f"US Stock Daily Report - {md_path.stem}", md)
    return str(md_path), str(json_path)
