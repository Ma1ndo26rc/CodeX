from __future__ import annotations

import argparse
import os

from market_news_report.config import CONFIG
from market_news_report.pipeline import run_daily_job
from market_news_report.scheduler import run_scheduler


def main() -> None:
    os.makedirs(CONFIG.workspace_root, exist_ok=True)
    os.chdir(CONFIG.workspace_root)

    parser = argparse.ArgumentParser(description="US stock daily AI news report")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--schedule", action="store_true", help="Run daily scheduler")
    parser.add_argument("--hour", type=int, default=8, help="Scheduler hour")
    parser.add_argument("--minute", type=int, default=0, help="Scheduler minute")
    args = parser.parse_args()

    if args.schedule:
        run_scheduler(args.hour, args.minute)
    else:
        run_daily_job()


if __name__ == "__main__":
    main()
