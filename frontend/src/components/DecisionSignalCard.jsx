import { Clock3 } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";
import { formatTimestamp } from "../lib/utils.js";

export default function DecisionSignalCard({ signal, rank }) {
  const { language, localized } = useLanguage();
  const sentiment = Number(signal.sentiment_score) || 0;
  return (
    <article className="landing-signal-card">
      <span className="landing-signal-rank">{String(rank).padStart(2, "0")}</span>
      <div className="landing-signal-story">
        <div className="landing-signal-meta">
          <span>{signal.sector || "Cross-market"}</span>
          <span>{signal.primary_source || "Source unavailable"}</span>
          <time><Clock3 size={11} />{signal.timestamp ? formatTimestamp(signal.timestamp, language) : "Time unavailable"}</time>
        </div>
        <h3>{localized(signal, "title") || signal.title}</h3>
        <p>{localized(signal, "one_line_summary") || localized(signal, "summary") || signal.one_line_summary || "Summary unavailable."}</p>
      </div>
      <div className="landing-signal-impact">
        <div><span>IMPACT</span><strong>{Math.round(signal.impact_score)}</strong></div>
        <i><b style={{ width: `${signal.impact_score}%` }} /></i>
      </div>
      <div className="landing-signal-sentiment">
        <span>SENTIMENT</span>
        <strong className={sentiment > 0.15 ? "is-positive" : sentiment < -0.15 ? "is-negative" : "is-neutral"}>{sentiment > 0 ? "+" : ""}{sentiment.toFixed(2)}</strong>
      </div>
    </article>
  );
}
