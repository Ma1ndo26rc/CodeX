import { ChevronDown, Route } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../lib/i18n.jsx";

export default function TopSignalCard({ signal, rank }) {
  const [expanded, setExpanded] = useState(false);
  const { language, localized } = useLanguage();
  const copy = language === "zh"
    ? { impact: "影响力", sentiment: "情绪", confidence: "置信度", why: "为何重要", path: "传导路径", assets: "受影响资产", expand: "展开完整分析", collapse: "收起分析" }
    : { impact: "Impact", sentiment: "Sentiment", confidence: "Confidence", why: "Why it matters", path: "Transmission path", assets: "Affected assets", expand: "Open full analysis", collapse: "Collapse analysis" };
  const sentiment = Number(signal.sentiment_score ?? 0);

  return (
    <article className={`mi-signal-card impact-${impactLevel(signal.impact_score)}`}>
      <div className="mi-signal-rank">{String(rank).padStart(2, "0")}</div>
      <div className="mi-signal-content">
        <header className="mi-signal-header">
          <div>
            <h3>{localized(signal, "title") || signal.title}</h3>
            <div className="mi-tags">
              {[signal.sector, signal.event_type, signal.time_horizon].filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
          </div>
          <span className="mi-confidence">{copy.confidence} {Math.round(signal.confidence_score)}%</span>
        </header>

        <div className="mi-metrics-row">
          <MetricBar label={copy.impact} value={signal.impact_score} level={impactLevel(signal.impact_score)} />
          <div className="mi-sentiment-metric">
            <span>{copy.sentiment}</span>
            <strong className={sentiment > 0.15 ? "is-positive" : sentiment < -0.15 ? "is-negative" : "is-neutral"}>
              {sentiment > 0 ? "+" : ""}{sentiment.toFixed(2)}
            </strong>
          </div>
        </div>

        <p className="mi-one-line">{localized(signal, "one_line_summary") || localized(signal, "summary") || signal.one_line_summary}</p>

        <button className="mi-expand-button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? copy.collapse : copy.expand}
          <ChevronDown size={16} className={expanded ? "rotate-180" : ""} />
        </button>

        {expanded && (
          <div className="mi-signal-details">
            <Detail label={copy.why} value={localized(signal, "why_it_matters") || signal.why_it_matters} />
            <div className="mi-detail-block">
              <span><Route size={14} />{copy.path}</span>
              <p>{localized(signal, "transmission_path") || signal.transmission_path}</p>
            </div>
            <div className="mi-detail-block">
              <span>{copy.assets}</span>
              <div className="mi-asset-chips">{signal.affected_assets.map((asset) => <b key={asset}>{asset}</b>)}</div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function MetricBar({ label, value, level }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mi-impact-metric">
      <div><span>{label}</span><strong>{Math.round(normalized)}</strong></div>
      <div className="mi-impact-track"><i className={`impact-${level}`} style={{ width: `${normalized}%` }} /></div>
    </div>
  );
}

function Detail({ label, value }) {
  return <div className="mi-detail-block"><span>{label}</span><p>{value || "Data unavailable"}</p></div>;
}

function impactLevel(value) {
  if (value >= 80) return "high";
  if (value >= 50) return "medium";
  return "low";
}
