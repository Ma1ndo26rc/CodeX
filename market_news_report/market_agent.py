from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from openai import OpenAI

from .analysis_schema import load_market_analysis
from .config import CONFIG


AGENT_SYSTEM_PROMPT = "You are an institutional US equity research assistant."


def build_market_context(
    report: dict[str, Any] | None = None,
    *,
    report_path: Path | None = None,
    output_path: Path | None = None,
) -> dict[str, Any]:
    """Build a compact context file for grounded Market Agent answers."""
    source = report or _load_latest_report(report_path)
    events = _select_top_events(source)
    context = {
        "market_summary": _text(source.get("market_summary") or source.get("market_narrative")),
        "macro_summary": _macro_summary(source),
        "risk_summary": _text(source.get("risk_and_sentiment")),
        "top_events": events,
        "sector_summary": _sector_summary(source, events),
    }
    target = output_path or (CONFIG.report_output_dir / "market_context.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(context, ensure_ascii=False, indent=2), encoding="utf-8")
    return context


def answer_market_question(question: str, context: dict[str, Any] | None = None) -> str:
    prompt = _text(question)
    if not prompt:
        raise ValueError("Question is required.")
    market_context = context or _load_or_build_context()
    if not CONFIG.openai_api_key:
        raise RuntimeError("Market Agent API is not configured. Set OPENAI_API_KEY for DeepSeek-compatible requests.")

    client = OpenAI(api_key=CONFIG.openai_api_key, base_url=CONFIG.openai_base_url)
    response = client.chat.completions.create(
        model=CONFIG.openai_model,
        messages=[
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {"role": "user", "content": _agent_prompt(market_context, prompt)},
        ],
        temperature=0.2,
    )
    return _text(response.choices[0].message.content) or "Insufficient context to answer the question."


def run_market_agent_api(host: str = "127.0.0.1", port: int = 8765) -> None:
    build_market_context()
    server = ThreadingHTTPServer((host, port), _MarketAgentHandler)
    print(f"Market Agent API listening on http://{host}:{port}/api/market-agent")
    server.serve_forever()


class _MarketAgentHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/api/market-agent":
            self._send_json({"error": "Not found"}, status=404)
            return
        try:
            payload = self._read_json()
            question = _text(payload.get("question"))
            answer = answer_market_question(question)
            self._send_json({"answer": answer})
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=400)
        except Exception:
            self._send_json({"error": "Market Agent request failed. Check backend configuration and report context."}, status=500)

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        payload = json.loads(raw or "{}")
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)


def _agent_prompt(market_context: dict[str, Any], question: str) -> str:
    return f"""
You have access to today's market intelligence:

{json.dumps(market_context, ensure_ascii=False, indent=2)}

User question:

{question}

Answer requirements:

1. Direct answer first.
2. Explain key drivers.
3. Explain market implication.
4. Mention what investors should watch next.

Rules:
- Do not invent information.
- Use only provided context.
- If information is insufficient, say so.
- Do not provide buy/sell recommendations.
"""


def _load_or_build_context() -> dict[str, Any]:
    path = CONFIG.report_output_dir / "market_context.json"
    if path.exists():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError:
            pass
    return build_market_context()


def _load_latest_report(report_path: Path | None = None) -> dict[str, Any]:
    path = report_path or CONFIG.report_output_dir / "latest.json"
    if not path.exists():
        path = CONFIG.report_output_dir / "market_analysis.json"
    return load_market_analysis(path) if path.exists() else {}


def _select_top_events(report: dict[str, Any], limit: int = 8) -> list[dict[str, Any]]:
    rows = _array(report.get("events")) or [*_array(report.get("key_events")), *_array(report.get("news_events"))]
    deduped = []
    seen = set()
    for event in sorted(rows, key=_event_score, reverse=True):
        title = _text(event.get("title"))
        key = title.lower()
        if not title or key in seen:
            continue
        seen.add(key)
        deduped.append(
            {
                "title": title,
                "summary": _text(event.get("summary") or event.get("one_line_summary")),
                "impact_score": event.get("final_score") or event.get("market_impact_score") or event.get("impact_score") or 0,
                "sentiment_score": event.get("sentiment_score") or 0,
            }
        )
        if len(deduped) >= limit:
            break
    return deduped


def _macro_summary(report: dict[str, Any]) -> str:
    macro = report.get("macro_analysis") if isinstance(report.get("macro_analysis"), dict) else {}
    regime = macro.get("market_regime") if isinstance(macro.get("market_regime"), dict) else {}
    parts = [
        _text(regime.get("title")),
        _text(regime.get("key_takeaway")),
        _text(regime.get("summary")),
        _text(report.get("macro_outlook")),
    ]
    return " ".join(part for part in parts if part)


def _sector_summary(report: dict[str, Any], events: list[dict[str, Any]]) -> str:
    sector_impact = report.get("sector_theme_impact") if isinstance(report.get("sector_theme_impact"), dict) else {}
    winners = ", ".join(_array(sector_impact.get("winners"))[:4])
    losers = ", ".join(_array(sector_impact.get("losers"))[:4])
    themes = ", ".join(_array(sector_impact.get("themes_to_watch"))[:4])
    if winners or losers or themes:
        return "; ".join(
            part
            for part in (
                f"Positive sectors/themes: {winners}" if winners else "",
                f"Negative sectors/themes: {losers}" if losers else "",
                f"Themes to watch: {themes}" if themes else "",
            )
            if part
        )
    titles = "; ".join(event["title"] for event in events[:3])
    return f"Sector signal is inferred from top events: {titles}" if titles else ""


def _event_score(event: dict[str, Any]) -> float:
    try:
        return float(event.get("final_score") or event.get("market_impact_score") or event.get("impact_score") or 0)
    except (TypeError, ValueError):
        return 0.0


def _array(value: Any) -> list:
    return value if isinstance(value, list) else []


def _text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return str(value).strip()
