import { Activity, Archive, Bot, CalendarClock, Languages, Moon, Sun, Waves } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

const NAVIGATION = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "events", label: "Event Feed", icon: Waves },
  { id: "macro", label: "Macro Analysis", icon: CalendarClock },
  { id: "agent", label: "Market Agent", icon: Bot, badge: "Beta" },
  { id: "reports", label: "Reports", icon: Archive },
];

export default function AppShell({ route, onRoute, meta, reportSelection, onReportSelection, reportLoading, isDark, onToggleTheme, children }) {
  const { language, setLanguage } = useLanguage();
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
              <Icon size={15} />{label}{badge && <small className="pa-nav-badge">{badge}</small>}
            </button>
          ))}
        </nav>
        <div className="pa-tools">
          <select value={reportSelection} onChange={(event) => onReportSelection(event.target.value)} disabled={reportLoading} aria-label="Report session">
            <option value="latest">Latest</option>
            <option value="premarket">Pre-Market</option>
            <option value="close">Market Close</option>
          </select>
          <button onClick={() => setLanguage(language === "en" ? "zh" : "en")} aria-label="Switch language"><Languages size={15} />{language === "en" ? "中文" : "EN"}</button>
          <button onClick={onToggleTheme} aria-label="Toggle color theme">{isDark ? <Sun size={15} /> : <Moon size={15} />}</button>
        </div>
      </header>
      <div className="pa-context-bar">
        <span>{meta?.report_label}</span>
        <span>{meta?.generated_at || "Timestamp unavailable"}</span>
        <span className={meta?.data_freshness_warning ? "is-stale" : "is-live"}>{meta?.data_freshness_warning ? "STALE" : "SYNCHRONIZED"}</span>
      </div>
      <main className={`pa-page pa-page-${route}`}>{children}</main>
    </div>
  );
}
