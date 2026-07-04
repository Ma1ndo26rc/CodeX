import { ChevronDown, ExternalLink, Newspaper } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

export default function RawNewsFeedV2({ items }) {
  const { language, localized } = useLanguage();
  const copy = language === "zh"
    ? { title: "原始新闻流", subtitle: "低优先级 · 按时间倒序", empty: "暂无原始新闻" }
    : { title: "Raw News Feed", subtitle: "Low priority · reverse chronological", empty: "No raw news available" };
  return (
    <details className="mi-raw-feed">
      <summary>
        <Newspaper size={18} />
        <div><h2>{copy.title}</h2><p>{copy.subtitle}</p></div>
        <span>{items.length}</span>
        <ChevronDown size={18} className="mi-raw-chevron" />
      </summary>
      <div className="mi-raw-list">
        {items.map((item) => (
          <article key={item.id}>
            <time>{formatTime(item.published_at, language)}</time>
            <div><h3>{localized(item, "title") || item.title}</h3><p>{item.source}</p></div>
            {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer" aria-label={item.title}><ExternalLink size={15} /></a>}
          </article>
        ))}
        {!items.length && <div className="mi-empty">{copy.empty}</div>}
      </div>
    </details>
  );
}

function formatTime(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleString(language === "zh" ? "zh-CN" : "en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
