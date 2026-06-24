from __future__ import annotations

import html
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from .analysis_schema import load_market_analysis
from .config import CONFIG


def generate_site(site_dir: Path | None = None, reports_dir: Path | None = None) -> Path:
    reports_dir = reports_dir or CONFIG.report_output_dir
    site_dir = site_dir or (CONFIG.workspace_root / "site")
    react_site = _build_react_site(site_dir)
    if react_site:
        return react_site

    site_dir.mkdir(parents=True, exist_ok=True)

    analysis_path = reports_dir / "market_analysis.json"
    analysis = load_market_analysis(analysis_path) if analysis_path.exists() else {"key_events": []}
    latest = _latest_report_files(reports_dir)
    html_text = _render_site(analysis, latest, site_dir)
    index_path = site_dir / "index.html"
    index_path.write_text(html_text, encoding="utf-8")
    return index_path


def _build_react_site(site_dir: Path) -> Path | None:
    frontend_dir = CONFIG.workspace_root / "frontend"
    package_json = frontend_dir / "package.json"
    node_modules = frontend_dir / "node_modules"
    if not package_json.exists() or not node_modules.exists():
        return None

    npm = "npm.cmd" if os.name == "nt" else "npm"
    try:
        subprocess.run(
            [npm, "run", "build"],
            cwd=frontend_dir,
            check=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"React site build failed, falling back to legacy static site: {exc}")
        return None

    index_path = site_dir / "index.html"
    return index_path if index_path.exists() else None


def _latest_report_files(reports_dir: Path) -> dict[str, Path | None]:
    return {
        "markdown": _latest(reports_dir.glob("US_STOCK_DAILY_*.md")),
        "pdf": _latest(reports_dir.glob("US_STOCK_DAILY_*.pdf")),
        "json": _latest(reports_dir.glob("US_STOCK_DAILY_*.json")),
        "chart": reports_dir / "assets" / "market_event_overview.png",
    }


def _latest(paths) -> Path | None:
    existing = [path for path in paths if path.exists()]
    return max(existing, key=lambda path: path.stat().st_mtime) if existing else None


def _render_site(analysis: dict[str, Any], latest: dict[str, Path | None], site_dir: Path) -> str:
    events = analysis.get("key_events", [])
    layers = _layers(events)
    market_data = analysis.get("market_data", {})
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    actions = _action_links(latest, site_dir)
    chart = _asset_img(latest.get("chart"), site_dir, "Market event overview")

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>US Stock Daily Report</title>
  <style>{_css()}</style>
</head>
<body>
  <header class="hero">
    <div>
      <p class="eyebrow">Generated {html.escape(generated)}</p>
      <h1>US Stock Daily Report</h1>
      <p class="lead">{_esc(analysis.get("market_summary") or "No market summary available.")}</p>
    </div>
    <nav class="actions">{actions}</nav>
  </header>

  <main>
    <section class="band metrics">
      <h2>Real-Time Market Data</h2>
      {_market_table(market_data)}
    </section>

    <section class="band split">
      <article>
        <h2>Risk & Sentiment</h2>
        <p>{_esc(analysis.get("risk_and_sentiment") or "No risk analysis available.")}</p>
      </article>
      <article>
        <h2>Macro Outlook</h2>
        <p>{_esc(analysis.get("macro_outlook") or "No macro outlook available.")}</p>
      </article>
    </section>

    <section class="band chart">
      <h2>Market Event Overview</h2>
      {chart}
    </section>

    {_layer_section("Macro Layer", layers["Macro Layer"], site_dir)}
    {_layer_section("Market Layer", layers["Market Layer"], site_dir)}
    {_layer_section("Company Layer", layers["Company Layer"], site_dir)}
  </main>
</body>
</html>
"""


def _css() -> str:
    return """
:root {
  --paper: #f7f4ec;
  --ink: #18211c;
  --muted: #667064;
  --line: #d8d0bf;
  --green: #235c4a;
  --blue: #275f7b;
  --gold: #b57a25;
  --red: #ad4d45;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: linear-gradient(135deg, #f7f4ec 0%, #eef3ed 55%, #f9f2df 100%);
  color: var(--ink);
  font-family: "Aptos", "Segoe UI", sans-serif;
}
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  padding: 42px clamp(20px, 4vw, 56px) 30px;
  border-bottom: 1px solid var(--line);
}
.eyebrow { color: var(--gold); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 8px; }
h1 { font-family: Georgia, "Times New Roman", serif; font-size: clamp(34px, 5vw, 64px); line-height: 1; margin: 0 0 14px; }
h2 { font-size: 19px; margin: 0 0 14px; color: var(--green); }
h3 { font-size: 17px; margin: 0 0 10px; color: var(--ink); }
p { line-height: 1.58; }
.lead { max-width: 980px; color: #303a33; font-size: 17px; }
.actions { display: flex; flex-wrap: wrap; align-content: start; gap: 10px; }
.actions a {
  color: white;
  background: var(--green);
  text-decoration: none;
  padding: 10px 13px;
  border-radius: 6px;
  font-size: 14px;
}
main { padding: 24px clamp(20px, 4vw, 56px) 56px; }
.band {
  border-top: 1px solid var(--line);
  padding: 24px 0;
}
.metrics table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255,255,255,.45);
}
th, td { padding: 11px 12px; border-bottom: 1px solid var(--line); text-align: left; }
th { color: var(--muted); font-weight: 700; font-size: 12px; text-transform: uppercase; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.pos { color: var(--green); }
.neg { color: var(--red); }
.split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 36px;
}
.chart img {
  display: block;
  max-width: min(100%, 980px);
  border: 1px solid var(--line);
  background: white;
}
.events {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}
.event {
  background: rgba(255,255,255,.58);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 14px;
}
.pill {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 8px;
  color: var(--muted);
  font-size: 12px;
  background: rgba(255,255,255,.5);
}
.event img { width: 100%; max-height: 240px; object-fit: cover; border-radius: 6px; margin: 10px 0; }
.sources a { color: var(--blue); display: inline-block; margin: 0 10px 6px 0; }
@media (max-width: 760px) {
  .hero, .split { grid-template-columns: 1fr; }
}
"""


def _market_table(market_data: dict[str, Any]) -> str:
    items = market_data.get("items", []) if isinstance(market_data, dict) else []
    if not items:
        return "<p>Market data unavailable.</p>"
    rows = []
    for item in items:
        change = item.get("change_pct")
        cls = "pos" if change and change > 0 else "neg" if change and change < 0 else ""
        rows.append(
            "<tr>"
            f"<td>{_esc(item.get('name'))}</td>"
            f"<td>{_esc(item.get('symbol'))}</td>"
            f"<td class='num'>{_fmt_value(item.get('name'), item.get('price'))}</td>"
            f"<td class='num {cls}'>{_fmt_signed(item.get('change'))}</td>"
            f"<td class='num {cls}'>{_fmt_pct(change)}</td>"
            "</tr>"
        )
    return "<table><thead><tr><th>Instrument</th><th>Symbol</th><th>Last</th><th>Change</th><th>Change %</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>"


def _layer_section(title: str, events: list[dict[str, Any]], site_dir: Path) -> str:
    cards = "".join(_event_card(event, site_dir) for event in events) or "<p>No major events in this layer.</p>"
    return f"<section class='band'><h2>{html.escape(title)}</h2><div class='events'>{cards}</div></section>"


def _event_card(event: dict[str, Any], site_dir: Path) -> str:
    image = _event_image(event, site_dir)
    sources = _sources(event)
    return f"""
<article class="event">
  <h3>{_esc(event.get("title"))}</h3>
  <div class="meta">
    <span class="pill">{_esc(event.get("sector") or "N/A")}</span>
    <span class="pill">{_esc(event.get("event_type") or "N/A")}</span>
    <span class="pill">Impact {_esc(event.get("market_impact_score"))}/100</span>
    <span class="pill">Sentiment {_esc(event.get("sentiment_score"))}</span>
  </div>
  {image}
  <p>{_esc(event.get("summary") or "No summary available.")}</p>
  <p><strong>Why it matters:</strong> {_esc(event.get("why_it_matters") or "No rationale available.")}</p>
  <div class="sources">{sources}</div>
</article>
"""


def _layers(events: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    layers = {"Macro Layer": [], "Market Layer": [], "Company Layer": []}
    for event in sorted(events, key=lambda row: row.get("market_impact_score", 0), reverse=True):
        layers[_event_layer(event)].append(event)
    return layers


def _event_layer(event: dict[str, Any]) -> str:
    text = " ".join(
        [
            str(event.get("title", "")),
            str(event.get("sector", "")),
            str(event.get("event_type", "")),
            " ".join(event.get("affected_markets", []) or []),
            " ".join(event.get("entities", []) or []),
        ]
    ).lower()
    if any(term in text for term in ("rout", "selloff", "sell-off", "futures", "index", "etf", "sector", "global", "qqq", "s&p", "nasdaq")):
        return "Market Layer"
    if any(term in text for term in ("earnings", "layoff", "stock", "shares", "ceo", "guidance", "investigates", "tumbles", "oracle", "tesla", "nvidia", "alphabet")):
        return "Company Layer"
    if any(term in text for term in ("fed", "inflation", "treasury", "yield", "rate", "policy", "sanction", "housing", "bill", "oil", "tariff")):
        return "Macro Layer"
    return "Market Layer"


def _event_image(event: dict[str, Any], site_dir: Path) -> str:
    image_paths = event.get("image_paths") or []
    if not image_paths:
        return ""
    return _asset_img(Path(image_paths[0]), site_dir, str(event.get("title") or "event image"))


def _asset_img(path: Path | None, site_dir: Path, alt: str) -> str:
    if not path or not path.exists():
        return ""
    rel = _rel(path, site_dir)
    return f'<img src="{html.escape(rel)}" alt="{html.escape(alt)}">'


def _sources(event: dict[str, Any]) -> str:
    urls = event.get("source_urls") or []
    names = event.get("source_names") or []
    links = []
    for index, url in enumerate(urls[:4]):
        label = names[index] if index < len(names) and names[index] else f"Source {index + 1}"
        links.append(f'<a href="{html.escape(url)}">{html.escape(label)}</a>')
    return "".join(links)


def _action_links(latest: dict[str, Path | None], site_dir: Path) -> str:
    labels = {"markdown": "Markdown", "pdf": "PDF", "json": "JSON"}
    links = []
    for key, label in labels.items():
        path = latest.get(key)
        if path and path.exists():
            links.append(f'<a href="{html.escape(_rel(path, site_dir))}">{label}</a>')
    return "".join(links)


def _rel(path: Path, site_dir: Path) -> str:
    return Path(os.path.relpath(path.resolve(), site_dir.resolve())).as_posix()


def _fmt_value(name: Any, value: Any) -> str:
    if value is None:
        return "N/A"
    number = float(value)
    return f"{number:.3f}%" if str(name) == "10Y Yield" else f"{number:.2f}"


def _fmt_signed(value: Any) -> str:
    return "N/A" if value is None else f"{float(value):+.2f}"


def _fmt_pct(value: Any) -> str:
    return "N/A" if value is None else f"{float(value):+.2f}%"


def _esc(value: Any) -> str:
    return html.escape(str(value or ""))
