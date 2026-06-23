from __future__ import annotations

import schedule
import time

from .pipeline import run_daily_job


def run_scheduler(hour: int = 8, minute: int = 0) -> None:
    schedule.every().day.at(f"{hour:02d}:{minute:02d}").do(run_daily_job)
    while True:
        schedule.run_pending()
        time.sleep(30)
