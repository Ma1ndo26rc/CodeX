import { AlertTriangle, Clock3, Languages, Moon, Radio, Sun } from "lucide-react";
import EventClustersV2, { SectionHeading } from "../components/EventClustersV2.jsx";
import MarketSnapshotV2 from "../components/MarketSnapshotV2.jsx";
import RawNewsFeedV2 from "../components/RawNewsFeedV2.jsx";
import TopSignalCard from "../components/TopSignalCard.jsx";
import { formatTimestamp } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

export default function MarketIntelligenceDashboard({ dashboard, reportSelection, onReportSelection, reportLoading, reportError, isDark, onToggleTheme }) {
  const { language, setLanguage, localized } = useLanguage();
  const copy = language === "zh"
    ? {
        brand: "市场决策情报",
        topEyebrow: "一级决策层",
        topTitle: "关键信号",
        empty: "该报告尚未生成或没有可用信号。",
        latest: "最新",
        premarket: "盘前",
        close: "收盘",
        stale: "数据时效警告",
        live: "数据已同步",
      }
    : {
        brand: "Market Decision Intelligence",
        topEyebrow: "Primary decision layer",
        topTitle: "Top Signals",
        empty: "This report has not been generated or contains no usable signals.",
        latest: "Latest",
        premarket: "Pre-Market",
        close: "Market Close",
        stale: "Freshness warning",
        live: "Data synchronized",
      };

  return (
    <div className="mi-dashboard">
      <div className="mi-sticky-stack">
        <div className="mi-command-bar">
          <div className="mi-command-copy">
            <p>{copy.brand}</p>
            <h1>{localized(dashboard?.meta, "dynamic_headline") || dashboard?.meta?.dynamic_headline || "Market Intelligence Dashboard v2"}</h1>
          </div>
          <div className="mi-report-switcher">
            {["latest", "premarket", "close"].map((value) => (
              <button key={value} className={reportSelection === value ? "is-active" : ""} onClick={() => onReportSelection(value)} disabled={reportLoading}>
                {copy[value]}
              </button>
            ))}
          </div>
          <div className={`mi-freshness ${dashboard?.meta?.data_freshness_warning ? "is-stale" : ""}`}>
            {dashboard?.meta?.data_freshness_warning ? <AlertTriangle size={15} /> : <Radio size={15} />}
            <span>{dashboard?.meta?.data_freshness_warning ? copy.stale : copy.live}</span>
          </div>
          <div className="mi-command-actions">
            <button onClick={() => setLanguage(language === "en" ? "zh" : "en")} aria-label="Switch language"><Languages size={15} />{language === "en" ? "中文" : "EN"}</button>
            <button onClick={onToggleTheme} aria-label="Toggle color theme">{isDark ? <Sun size={15} /> : <Moon size={15} />}</button>
          </div>
        </div>
        <MarketSnapshotV2 snapshot={dashboard?.market_snapshot} language={language} />
      </div>

      <main className="mi-main">
        <div className="mi-report-meta">
          <span>{dashboard?.meta?.report_label}</span>
          <span><Clock3 size={13} />{formatTimestamp(dashboard?.meta?.generated_at, language)}</span>
          <span>{dashboard?.meta?.source_window}</span>
        </div>

        <section className="mi-section mi-primary-section">
          <SectionHeading eyebrow={copy.topEyebrow} title={copy.topTitle} count={dashboard?.top_signals?.length ?? 0} />
          <div className="mi-signal-list">
            {(dashboard?.top_signals ?? []).map((signal, index) => <TopSignalCard key={signal.id} signal={signal} rank={index + 1} />)}
            {!(dashboard?.top_signals?.length) && <div className="mi-empty">{reportError || copy.empty}</div>}
          </div>
        </section>

        <EventClustersV2 clusters={dashboard?.event_clusters ?? []} />
        <RawNewsFeedV2 items={dashboard?.raw_news ?? []} />
      </main>
    </div>
  );
}
