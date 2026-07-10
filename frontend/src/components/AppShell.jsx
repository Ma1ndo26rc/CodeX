import { Activity, Archive, Bot, CalendarClock, Languages, Moon, Sun, Waves } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";
import { formatMarketClock } from "../lib/utils.js";

const NAVIGATION = [
  { id: "dashboard", label: { en: "Dashboard", zh: "首页" }, icon: Activity },
  { id: "events", label: { en: "Event Feed", zh: "事件动态" }, icon: Waves },
  { id: "macro", label: { en: "Macro Analysis", zh: "宏观分析" }, icon: CalendarClock },
  { id: "agent", label: { en: "Market Agent", zh: "市场助手" }, icon: Bot, badge: { en: "Beta", zh: "测试" } },
  { id: "reports", label: { en: "Reports", zh: "报告" }, icon: Archive },
];

const COPY = {
  en: { latest: "Latest", premarket: "Pre-Market", close: "Market Close", stale: "STALE", ready: "SYNCHRONIZED" },
  zh: { latest: "最新", premarket: "盘前", close: "收盘", stale: "数据过期", ready: "已同步" },
};

export default function AppShell({ route, onRoute, meta, reportSelection, onReportSelection, reportLoading, isDark, onToggleTheme, children }) {
  const { language, setLanguage } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  return (
    <div className="pa-shell">
      <header className="pa-header">
        <button className="pa-brand" onClick={() => onRoute("dashboard")}>
          <span>MI</span>
          <div><strong>MARKET INTELLIGENCE</strong><small>OPERATING SYSTEM / V2</small></div>
        </button>
        <nav className="pa-nav" aria-label="Primary navigation">
          {NAVIGATION.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} className={route === id ? "is-active" : ""} onClick={() => onRoute(id)}>
              <Icon size={15} />{label[language] ?? label.en}{badge && <small className="pa-nav-badge">{badge[language] ?? badge.en}</small>}
            </button>
          ))}
        </nav>
        <div className="pa-tools">
          <select value={reportSelection} onChange={(event) => onReportSelection(event.target.value)} disabled={reportLoading} aria-label="Report session">
            <option value="latest">{copy.latest}</option>
            <option value="premarket">{copy.premarket}</option>
            <option value="close">{copy.close}</option>
          </select>
          <button onClick={() => setLanguage(language === "en" ? "zh" : "en")} aria-label="Switch language"><Languages size={15} />{language === "en" ? "中文" : "EN"}</button>
          <button onClick={onToggleTheme} aria-label="Toggle color theme">{isDark ? <Sun size={15} /> : <Moon size={15} />}</button>
        </div>
      </header>
      <div className="pa-context-bar">
        <span>{meta?.report_label}</span>
        <span title={meta?.generated_at || ""}>{meta?.generated_at ? formatMarketClock(meta.generated_at) : "Timestamp unavailable"}</span>
        <span className={meta?.data_freshness_warning ? "is-stale" : "is-live"}>{meta?.data_freshness_warning ? copy.stale : copy.ready}</span>
      </div>
      <main className={`pa-page pa-page-${route}`}>{children}</main>
    </div>
  );
}
