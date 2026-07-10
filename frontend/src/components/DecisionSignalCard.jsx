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
    </article>
  );
}

function oneSentence(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  const [first] = text.split(/(?<=[.!?。！？])\s+/);
  return first || text;
}
