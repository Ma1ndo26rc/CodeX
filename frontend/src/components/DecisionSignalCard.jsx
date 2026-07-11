import { Clock3 } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";
import { formatTimestamp } from "../lib/utils.js";
import { getDisplaySummary, getDisplayTitle } from "../lib/localizedText.js";

export default function DecisionSignalCard({ signal, rank }) {
  const { language } = useLanguage();
  const copy = language === "zh"
    ? { unknown: "未知来源", time: "时间未知", summary: "暂无摘要。" }
    : { unknown: "Unknown Source", time: "Time unavailable", summary: "Summary unavailable." };
  const summary = oneSentence(getDisplaySummary(signal, language) || signal.one_line_summary || copy.summary);
  const impact = Number(signal.impact_score ?? signal.market_impact_score);
  const sentiment = Number(signal.sentiment_score);
  const impactValue = Number.isFinite(impact) ? Math.max(0, Math.min(100, Math.round(impact))) : 0;
  const sentimentValue = Number.isFinite(sentiment) ? sentiment : 0;
  const sentimentTone = sentimentValue > 0.1 ? "positive" : sentimentValue < -0.1 ? "negative" : "neutral";

  return (
    <article className="landing-signal-card">
      <span className="landing-signal-rank">{String(rank).padStart(2, "0")}</span>
      <div className="landing-signal-story">
        <div className="landing-signal-meta">
          <span>{signal.sector || "Cross-market"}</span>
          <span>{signal.primary_source || copy.unknown}</span>
          <time><Clock3 size={11} />{signal.timestamp ? formatTimestamp(signal.timestamp, language) : copy.time}</time>
        </div>
        <h3>{getDisplayTitle(signal, language) || signal.title}</h3>
        <p>{summary}</p>
      </div>
      <div className="landing-signal-impact">
        <div><span>IMPACT</span><strong>{impactValue}</strong></div>
        <i aria-hidden="true"><b style={{ width: `${impactValue}%` }} /></i>
      </div>
      <div className="landing-signal-sentiment">
        <span>SENTIMENT</span>
        <strong className={`is-${sentimentTone}`}>{formatSentiment(sentimentValue)}</strong>
      </div>
    </article>
  );
}

function oneSentence(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const [first] = text.split(/(?<=[.!?。！？])\s+/);
  return first || text;
}

function formatSentiment(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}
