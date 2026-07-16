from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOCAL_CORS_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def _workspace_root() -> Path:
    configured = os.getenv("WORKSPACE_ROOT", "").strip()
    return Path(configured).expanduser().resolve() if configured else PROJECT_ROOT


def _report_output_dir() -> Path:
    workspace_root = _workspace_root()
    configured = os.getenv("REPORT_OUTPUT_DIR", "").strip()
    if not configured:
        return workspace_root / "reports"
    report_dir = Path(configured).expanduser()
    return report_dir if report_dir.is_absolute() else workspace_root / report_dir


def _cors_origins() -> tuple[str, ...]:
    configured = [
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    if "*" in configured:
        raise ValueError("CORS_ORIGINS must not contain the wildcard origin '*'.")
    return tuple(dict.fromkeys((*LOCAL_CORS_ORIGINS, *configured)))


@dataclass(frozen=True)
class AppConfig:
    market_agent_provider: str = os.getenv("MARKET_AGENT_PROVIDER", "mock")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
    openai_base_url: str | None = os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com/v1") or None
    openai_model: str = os.getenv("OPENAI_MODEL", "deepseek-chat")
    smtp_host: str | None = os.getenv("SMTP_HOST") or None
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str | None = os.getenv("SMTP_USER") or None
    smtp_password: str | None = os.getenv("SMTP_PASSWORD") or None
    smtp_from: str | None = os.getenv("SMTP_FROM") or None
    smtp_to: str | None = os.getenv("SMTP_TO") or None
    enable_email: bool = os.getenv("ENABLE_EMAIL", "false").lower() == "true"
    workspace_root: Path = field(default_factory=_workspace_root)
    report_output_dir: Path = field(default_factory=_report_output_dir)
    cors_origins: tuple[str, ...] = field(default_factory=_cors_origins)
    timezone: str = os.getenv("TIMEZONE", "Asia/Shanghai")
    lookback_hours: int = int(os.getenv("LOOKBACK_HOURS", "24"))
    fetch_timeout_seconds: int = int(os.getenv("FETCH_TIMEOUT_SECONDS", "12"))
    market_data_timeout_seconds: int = int(os.getenv("MARKET_DATA_TIMEOUT_SECONDS", "12"))
    image_download_event_limit: int = int(os.getenv("IMAGE_DOWNLOAD_EVENT_LIMIT", "24"))
    image_download_per_event: int = int(os.getenv("IMAGE_DOWNLOAD_PER_EVENT", "1"))
    google_news_keywords: str = os.getenv(
        "GOOGLE_NEWS_KEYWORDS",
        "US stock market,S&P 500,Nasdaq,Dow Jones,Federal Reserve,US earnings,"
        "AI stocks,semiconductors,Mag 7 stocks,Tesla,Nvidia,Apple,Microsoft,Amazon,Meta,Google stock,"
        "bank stocks,energy stocks,retail earnings,small cap stocks,US Treasury yields,oil prices",
    )


CONFIG = AppConfig()
