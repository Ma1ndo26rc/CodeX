from __future__ import annotations

import argparse
import os

from market_news_report.config import CONFIG
from market_news_report.market_data import update_market_data_files
from market_news_report.pdf_exporter import convert_markdown_to_pdf
from market_news_report.pipeline import run_daily_job
from market_news_report.scheduler import run_market_data_scheduler, run_scheduler
from market_news_report.site_generator import generate_site


def main() -> None:
    os.makedirs(CONFIG.workspace_root, exist_ok=True)
    os.chdir(CONFIG.workspace_root)

    parser = argparse.ArgumentParser(description="US stock daily AI news report")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--schedule", action="store_true", help="Run daily scheduler")
    parser.add_argument("--market-schedule", action="store_true", help="Update market data/trends on a minute interval")
    parser.add_argument("--hour", type=int, default=8, help="Scheduler hour")
    parser.add_argument("--minute", type=int, default=0, help="Scheduler minute")
    parser.add_argument("--interval-minutes", type=int, default=30, help="Market data scheduler interval in minutes")
    parser.add_argument("--pdf", help="Convert an existing markdown report to PDF")
    parser.add_argument("--site", action="store_true", help="Generate static website from the latest report data")
    parser.add_argument("--market-data", action="store_true", help="Update market data/trend files and rebuild the website")
    args = parser.parse_args()

    if args.pdf:
        print(convert_markdown_to_pdf(args.pdf))
    elif args.market_data:
        print(update_market_data_files(CONFIG.report_output_dir))
        print(generate_site())
    elif args.site:
        print(generate_site())
    elif args.market_schedule:
        run_market_data_scheduler(args.interval_minutes)
    elif args.schedule:
        run_scheduler(args.hour, args.minute)
    else:
        print(run_daily_job())


if __name__ == "__main__":
    main()
