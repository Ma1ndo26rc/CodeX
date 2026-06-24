from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from .models import NewsItem


def generate_charts(items: list[NewsItem], output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return {}

    charts: dict[str, Path] = {}
    charts["category"] = _bar_chart(
        Counter(i.category for i in items),
        output_dir / "category_distribution.png",
        "News Category Distribution",
        "Category",
        "Articles",
        plt,
    )
    charts["sentiment"] = _bar_chart(
        Counter(i.sentiment for i in items),
        output_dir / "sentiment_distribution.png",
        "Sentiment Distribution",
        "Sentiment",
        "Articles",
        plt,
    )
    charts["source"] = _bar_chart(
        Counter(i.source for i in items).most_common(12),
        output_dir / "source_distribution.png",
        "Source Distribution",
        "Source",
        "Articles",
        plt,
        rotate_labels=True,
    )
    return charts


def generate_key_event_charts(analysis: dict[str, Any], output_dir: Path) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    _remove_stale_chart_files(output_dir)
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return {}

    events = analysis.get("key_events", [])
    if not isinstance(events, list):
        events = []

    charts: dict[str, Path] = {}
    charts["market_event_overview"] = _market_event_overview_chart(
        events,
        output_dir / "market_event_overview.png",
        plt,
    )
    return charts


def _bar_chart(data, path: Path, title: str, xlabel: str, ylabel: str, plt, rotate_labels: bool = False) -> Path:
    if hasattr(data, "items"):
        labels = list(data.keys())
        values = list(data.values())
    else:
        labels = [row[0] for row in data]
        values = [row[1] for row in data]

    if not labels:
        labels = ["none"]
        values = [0]

    fig_width = max(7, min(14, len(labels) * 0.8))
    fig, ax = plt.subplots(figsize=(fig_width, 4.5), dpi=150)
    colors = ["#2f6f9f", "#d08c2e", "#4f8f5b", "#b84a62", "#6f5aa8", "#2d8c86"]
    ax.bar(labels, values, color=[colors[i % len(colors)] for i in range(len(labels))])
    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(axis="y", alpha=0.25)
    if rotate_labels:
        ax.tick_params(axis="x", rotation=35)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def _short_label(value: str, index: int) -> str:
    cleaned = _clean_label(value)
    if not cleaned:
        return f"Event {index}"
    return cleaned[:36] + "..." if len(cleaned) > 39 else cleaned


def _clean_label(value) -> str:
    return str(value).strip() if value is not None else ""


def _to_number(value, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _market_event_overview_chart(events: list[dict[str, Any]], path: Path, plt) -> Path:
    ranked = sorted(
        events,
        key=lambda event: _to_number(event.get("market_impact_score"), 0),
        reverse=True,
    )[:8]
    labels = [_short_label(event.get("title", f"Event {idx}"), idx) for idx, event in enumerate(ranked, 1)]
    impact_scores = [_to_number(event.get("market_impact_score"), 0) for event in ranked]
    sentiment_scores = [_to_number(event.get("sentiment_score"), 0.0) for event in ranked]

    if not labels:
        labels = ["No events"]
        impact_scores = [0]
        sentiment_scores = [0.0]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5), dpi=150)
    fig.suptitle("Key Market Event Overview", fontsize=14)

    y_positions = range(len(labels))
    axes[0].barh(list(y_positions), impact_scores, color="#2f6f9f")
    axes[0].set_yticks(list(y_positions), labels=labels)
    axes[0].invert_yaxis()
    axes[0].set_xlim(0, 100)
    axes[0].set_title("Impact Score")
    axes[0].grid(axis="x", alpha=0.25)

    colors = ["#4f8f5b" if score >= 0 else "#b84a62" for score in sentiment_scores]
    axes[1].barh(list(y_positions), sentiment_scores, color=colors)
    axes[1].axvline(0, color="#333333", linewidth=0.8)
    axes[1].set_yticks(list(y_positions), labels=[""] * len(labels))
    axes[1].set_xlim(-1, 1)
    axes[1].set_title("Sentiment Score")
    axes[1].grid(axis="x", alpha=0.25)

    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    return path


def _remove_stale_chart_files(output_dir: Path) -> None:
    stale_names = (
        "category_distribution.png",
        "sentiment_distribution.png",
        "source_distribution.png",
        "impact_score_chart.png",
        "sentiment_score_chart.png",
        "sector_distribution_chart.png",
        "event_type_distribution_chart.png",
    )
    for name in stale_names:
        path = output_dir / name
        if path.exists():
            path.unlink()
