from __future__ import annotations

import schedule
import time

from .config import CONFIG
from .market_data import update_market_data_files
from .pipeline import run_daily_job
from .site_generator import generate_site


def run_scheduler(hour: int = 8, minute: int = 0) -> None:
    schedule.every().day.at(f"{hour:02d}:{minute:02d}").do(run_daily_job)
    while True:
        schedule.run_pending()
        time.sleep(30)


def run_market_data_scheduler(interval_minutes: int = 30) -> None:
    schedule.every(interval_minutes).minutes.do(_update_market_data_site)
    _update_market_data_site()
    while True:
        schedule.run_pending()
        time.sleep(30)


def _update_market_data_site() -> None:
    update_market_data_files(CONFIG.report_output_dir)
    generate_site()
