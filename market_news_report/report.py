from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from .analysis_schema import parse_and_validate_market_json


def build_report(analysis: dict[str, Any], charts: dict[str, Path] | None = None) -> str:
    analysis = parse_and_validate_market_json(analysis)
    charts = charts or {}

    md = [
        "# US Stock Daily Report",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Report Snapshot",
        _report_snapshot(analysis["key_events"]),
        "",
        "## Real-Time Market Data",
        _market_data_table(analysis.get("market_data", {})),
        "",
        "## Executive Takeaways",
    ]
    for takeaway in _executive_takeaways(analysis["key_events"]):
        md.append(f"- {takeaway}")
    md.extend(
        [
        "",
        "## Market Summary",
        analysis["market_summary"] or "No summary available.",
        "",
        "## Index Performance Summary",
        analysis["index_performance_summary"] or "No index performance summary available.",
        "",
        "## Macro Outlook",
        analysis["macro_outlook"] or "No macro outlook available.",
        "",
        "## Risk & Sentiment",
        analysis["risk_and_sentiment"] or "No risk and sentiment analysis available.",
        "",
        ]
    )

    if charts:
        md.extend(["## Market Event Overview", ""])
        for label, path in charts.items():
            md.append(f"![{label}]({path.as_posix()})")
        md.append("")

    for title, layer_events in _layered_events(analysis["key_events"]).items():
        md.extend([f"## {title}", ""])
        if not layer_events:
            md.append("No major events in this layer.")
            md.append("")
            continue
        for idx, event in enumerate(layer_events, 1):
            md.extend(_event_section(idx, event))

    md.extend(["", "## Cross-Market Watch", ""])
    for line in _cross_market_watch(analysis["key_events"]):
        md.append(f"- {line}")

    md.extend(["", "## What To Watch Next", ""])
    for line in _what_to_watch_next(analysis["key_events"]):
        md.append(f"- {line}")

    md.extend(["", "## Strategy Notes", ""])
    for line in _strategy_notes(analysis["key_events"]):
        md.append(f"- {line}")

    return "\n".join(md)


def save_report(md: str, analysis: dict[str, Any], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    md_path = output_dir / f"US_STOCK_DAILY_{timestamp}.md"
    json_path = output_dir / f"US_STOCK_DAILY_{timestamp}.json"
    validated = parse_and_validate_market_json(analysis)
    md_path.write_text(md, encoding="utf-8")
    json_path.write_text(json.dumps(validated, ensure_ascii=False, indent=2), encoding="utf-8")
    return md_path, json_path


def _cell(value: Any) -> str:
    text = str(value or "").replace("\n", " ").replace("|", "\\|")
    return text.strip()


def _rank_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(events, key=lambda event: event["market_impact_score"], reverse=True)


def _event_section(index: int, event: dict[str, Any]) -> list[str]:
    entities = ", ".join(event["entities"]) or "N/A"
    markets = ", ".join(event["affected_markets"]) or "N/A"
    rows = [
        f"### {index}. {event['title'] or 'Untitled event'}",
        "",
        f"- Sector: {event['sector'] or 'N/A'}",
        f"- Event Type: {event['event_type'] or 'N/A'}",
        f"- Time Horizon: {event['time_horizon'] or 'N/A'}",
        f"- Impact / Sentiment: {event['market_impact_score']} / {event['sentiment_score']:.2f}",
        f"- Entities: {entities}",
        f"- Affected Markets: {markets}",
        "",
        f"Summary: {event['summary'] or 'No event summary available.'}",
        "",
        f"Why It Matters: {event['why_it_matters'] or 'No market impact rationale available.'}",
        "",
    ]
    image_markup = _event_image_markup(event)
    if image_markup:
        rows.extend(["Image:", "", image_markup, ""])
    source_links = _source_links(event)
    if source_links:
        rows.append("Original Sources:")
        rows.extend(source_links)
        rows.append("")
    return rows


def _cross_market_watch(events: list[dict[str, Any]]) -> list[str]:
    rows = []
    seen = set()
    for event in _rank_events(events):
        markets = ", ".join(event["affected_markets"]) or "US equities"
        sector = event["sector"] or "market"
        line = f"{sector}: {markets}"
        if line not in seen:
            rows.append(line)
            seen.add(line)
        if len(rows) >= 6:
            break
    return rows or ["No cross-market signals available."]


def _what_to_watch_next(events: list[dict[str, Any]]) -> list[str]:
    rows = []
    for event in _rank_events(events)[:5]:
        title = event["title"] or "Untitled event"
        horizon = event["time_horizon"] or "near term"
        markets = ", ".join(event["affected_markets"]) or "US equities"
        rows.append(f"Watch whether \"{title}\" produces confirmation in {markets} over the {horizon}.")
    return rows or ["No follow-up events available."]


def _report_snapshot(events: list[dict[str, Any]]) -> str:
    if not events:
        return "No key events available."
    avg_impact = sum(event["market_impact_score"] for event in events) / len(events)
    avg_sentiment = sum(event["sentiment_score"] for event in events) / len(events)
    top_sector = _top_value(event["sector"] for event in events)
    top_event_type = _top_value(event["event_type"] for event in events)
    return (
        f"{len(events)} key events identified. Average impact score: {avg_impact:.1f}/100. "
        f"Average sentiment score: {avg_sentiment:.2f}. "
        f"Most represented sector: {top_sector}. Main event type: {top_event_type}."
    )


def _executive_takeaways(events: list[dict[str, Any]]) -> list[str]:
    if not events:
        return ["No executive takeaways available."]
    ranked = _rank_events(events)
    takeaways = []
    for event in ranked[:3]:
        sentiment = "positive" if event["sentiment_score"] > 0.15 else "negative" if event["sentiment_score"] < -0.15 else "mixed"
        takeaways.append(
            f"{event['title'] or 'Untitled event'} carries a {event['market_impact_score']}/100 impact score "
            f"with {sentiment} sentiment across {', '.join(event['affected_markets']) or 'US equities'}."
        )
    takeaways.append(
        "The highest-value follow-up is to watch whether these events broaden from single-name moves into sector or index-level rotation."
    )
    return takeaways


def _event_image_markup(event: dict[str, Any]) -> str:
    image_paths = event.get("image_paths", [])
    image_urls = event.get("image_urls", [])
    if image_paths:
        return f"![{_cell(event['title'])}]({image_paths[0]})"
    if image_urls:
        return f"![{_cell(event['title'])}]({image_urls[0]})"
    return ""


def _source_links(event: dict[str, Any]) -> list[str]:
    links = []
    for index, url in enumerate(event.get("source_urls", [])[:5], 1):
        names = event.get("source_names", [])
        label = names[index - 1] if index - 1 < len(names) and names[index - 1] else _source_name_from_url(url)
        links.append(f"- [{label}]({url})")
    return links


def _top_value(values) -> str:
    counts = {}
    for value in values:
        key = str(value or "N/A")
        counts[key] = counts.get(key, 0) + 1
    return max(counts, key=counts.get) if counts else "N/A"


def _strategy_notes(events: list[dict[str, Any]]) -> list[str]:
    if not events:
        return ["No strategy notes available."]
    ranked = _rank_events(events)
    avg_sentiment = sum(event["sentiment_score"] for event in events) / len(events)
    high_impact = [event for event in ranked if event["market_impact_score"] >= 70]
    notes = []
    if avg_sentiment < -0.15:
        notes.append(
            "Bias is defensive: treat rallies as needing confirmation from breadth, rates, and leadership rather than assuming immediate follow-through."
        )
    elif avg_sentiment > 0.15:
        notes.append(
            "Bias is constructive but selective: favor stories where company-level news is supported by sector momentum and macro stability."
        )
    else:
        notes.append(
            "Bias is balanced: avoid overreacting to single headlines and focus on whether high-impact events cluster around the same sector or macro theme."
        )
    if high_impact:
        sectors = ", ".join(dict.fromkeys(event["sector"] or "N/A" for event in high_impact[:4]))
        notes.append(f"High-impact watchlist sectors: {sectors}. These deserve priority over low-impact headline noise.")
    notes.append(
        "For practical use, pair this news read with live index performance, sector ETF moves, Treasury yields, and premarket/after-hours breadth before making trading decisions."
    )
    return notes


def _market_data_table(market_data: dict[str, Any]) -> str:
    items = market_data.get("items", []) if isinstance(market_data, dict) else []
    if not items:
        error = market_data.get("error") if isinstance(market_data, dict) else ""
        return f"Market data unavailable. {error}".strip()

    rows = [
        "| Instrument | Symbol | Last | Change | Change % |",
        "| --- | --- | ---: | ---: | ---: |",
    ]
    for item in items:
        rows.append(
            "| "
            + " | ".join(
                [
                    _cell(item.get("name")),
                    _cell(item.get("symbol")),
                    _format_market_value(item.get("name"), item.get("price")),
                    _format_market_change(item.get("name"), item.get("change")),
                    _format_percent(item.get("change_pct")),
                ]
            )
            + " |"
        )
    return "\n".join(rows)


def _layered_events(events: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    layers = {"Macro Layer": [], "Market Layer": [], "Company Layer": []}
    for event in _rank_events(events):
        layers[_event_layer(event)].append(event)
    return layers


def _event_layer(event: dict[str, Any]) -> str:
    text = " ".join(
        [
            event.get("title", ""),
            event.get("sector", ""),
            event.get("event_type", ""),
            " ".join(event.get("affected_markets", [])),
            " ".join(event.get("entities", [])),
        ]
    ).lower()
    if any(term in text for term in ("rout", "selloff", "sell-off", "futures", "index", "etf", "sector", "global", "qqq", "s&p", "nasdaq")):
        return "Market Layer"
    if any(term in text for term in ("earnings", "layoff", "stock", "shares", "ceo", "guidance", "investigates", "tumbles", "oracle", "tesla", "nvidia", "alphabet")):
        return "Company Layer"
    if any(term in text for term in ("fed", "inflation", "treasury", "yield", "rate", "policy", "sanction", "housing", "bill", "oil", "tariff")):
        return "Macro Layer"
    return "Market Layer"


def _format_market_value(name: Any, value: Any) -> str:
    if value is None:
        return "N/A"
    number = float(value)
    if str(name) == "10Y Yield":
        return f"{number:.3f}%"
    return f"{number:.2f}"


def _format_number(value: Any) -> str:
    return "N/A" if value is None else f"{float(value):+.2f}"


def _format_market_change(name: Any, value: Any) -> str:
    if value is None:
        return "N/A"
    if str(name) == "10Y Yield":
        return f"{float(value):+.3f}"
    return _format_number(value)


def _format_percent(value: Any) -> str:
    return "N/A" if value is None else f"{float(value):+.2f}%"


def _source_name_from_url(url: str) -> str:
    from urllib.parse import urlparse

    host = urlparse(url).netloc.lower().removeprefix("www.")
    known = {
        "cnbc.com": "CNBC",
        "finance.yahoo.com": "Yahoo Finance",
        "reuters.com": "Reuters",
        "bloomberg.com": "Bloomberg",
        "marketwatch.com": "MarketWatch",
        "wsj.com": "WSJ",
    }
    for domain, name in known.items():
        if host.endswith(domain):
            return name
    return host or "Source"
