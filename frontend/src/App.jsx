import { useEffect, useState } from "react";
import MarketIntelligenceDashboard from "./pages/MarketIntelligenceDashboard.jsx";
import { useReportData } from "./lib/useReportData.js";

export default function App() {
  const {
    dashboard,
    reportSelection,
    setReportSelection,
    reportLoading,
    reportError,
    loading,
    error,
  } = useReportData();
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  if (loading) return <StatusPanel>Loading market decision intelligence...</StatusPanel>;
  if (error) return <StatusPanel tone="error">Data load error: {error}</StatusPanel>;

  return (
    <MarketIntelligenceDashboard
      dashboard={dashboard}
      reportSelection={reportSelection}
      onReportSelection={setReportSelection}
      reportLoading={reportLoading}
      reportError={reportError}
      isDark={isDark}
      onToggleTheme={() => setIsDark((value) => !value)}
    />
  );
}

function StatusPanel({ children, tone = "neutral" }) {
  return (
    <div className="mi-status-page">
      <div className={tone === "error" ? "is-error" : ""}>{children}</div>
    </div>
  );
}
