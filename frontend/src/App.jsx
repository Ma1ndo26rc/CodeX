import { useEffect, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import DecisionDashboard from "./pages/DecisionDashboard.jsx";
import MacroAnalysis from "./pages/MacroAnalysis.jsx";
import MarketAgent from "./pages/MarketAgent.jsx";
import NewsList from "./pages/NewsList.jsx";
import ReportArchive from "./pages/ReportArchive.jsx";
import { useReportData } from "./lib/useReportData.js";

const ROUTES = new Set(["dashboard", "events", "macro", "agent", "reports"]);

export default function App() {
  const { analysis, architecture, reportSelection, setReportSelection, reportLoading, loading, error } = useReportData();
  const [route, setRoute] = useState(readRoute);
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    const syncRoute = () => setRoute(readRoute());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  if (loading) return <StatusPanel>Loading market intelligence layers...</StatusPanel>;
  if (error) return <StatusPanel tone="error">Data load error: {error}</StatusPanel>;

  const navigate = (nextRoute) => {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  };
  const openAgent = (question = "") => {
    window.location.hash = question ? `agent?question=${encodeURIComponent(question)}` : "agent";
    setRoute("agent");
  };

  return (
    <AppShell
      route={route}
      onRoute={navigate}
      meta={architecture.meta}
      reportSelection={reportSelection}
      onReportSelection={setReportSelection}
      reportLoading={reportLoading}
      isDark={isDark}
      onToggleTheme={() => setIsDark((value) => !value)}
    >
      {route === "dashboard" && <DecisionDashboard model={architecture.dashboard} agentStatus={architecture.market_agent.data_status} onOpenAgent={openAgent} />}
      {route === "events" && <NewsList model={architecture.event_feed} />}
      {route === "macro" && <MacroAnalysis model={architecture.macro_analysis} />}
      {route === "agent" && <MarketAgent reportData={analysis} initialQuestion={readAgentQuestion()} />}
      {route === "reports" && <ReportArchive model={architecture.reports} />}
    </AppShell>
  );
}

function readRoute() {
  const route = window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return ROUTES.has(route) ? route : "dashboard";
}

function readAgentQuestion() {
  const query = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(query).get("question") ?? "";
}

function StatusPanel({ children, tone = "neutral" }) {
  return <div className="mi-status-page"><div className={tone === "error" ? "is-error" : ""}>{children}</div></div>;
}
