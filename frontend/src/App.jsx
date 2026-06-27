import { Activity, BarChart3, Building2, Languages, Moon, Newspaper, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import NewsList from "./pages/NewsList.jsx";
import MacroAnalysis from "./pages/MacroAnalysis.jsx";
import MarketData from "./pages/MarketData.jsx";
import { useReportData } from "./lib/useReportData.js";
import { clsx, formatTimestamp } from "./lib/utils.js";
import { useLanguage } from "./lib/i18n.jsx";

const navItems = [
  { id: "dashboard", labelKey: "dashboard", icon: Activity },
  { id: "news", labelKey: "newsList", icon: Newspaper },
  { id: "macro", labelKey: "macroAnalysis", icon: Building2 },
  { id: "market", labelKey: "marketData", icon: BarChart3 },
];

export default function App() {
  const { language, setLanguage, t } = useLanguage();
  const { analysis, manifest, marketHistory, marketTrends, loading, error } = useReportData();
  const [activePage, setActivePage] = useState(() => pageFromHash());
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  function navigate(page) {
    setActivePage(page);
    window.location.hash = page;
  }

  const events = analysis?.key_events ?? [];
  const marketData = analysis?.market_data?.items ?? [];
  const generatedAt = manifest?.generated_at || analysis?.market_data?.as_of;

  return (
    <div className="min-h-screen bg-stone-100 text-slate-950 dark:bg-terminal-ink dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(246,183,57,0.18),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(102,217,239,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-300/70 bg-white/[0.65] p-5 backdrop-blur dark:border-terminal-line dark:bg-terminal-panel/[0.88] lg:block">
          <div className="mb-8">
            <p className="font-terminal text-[11px] uppercase tracking-[0.35em] text-terminal-amber">{t("usEquity")}</p>
            <h1 className="mt-3 font-display text-2xl font-black leading-tight">{t("dailyTerminal")}</h1>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t("appDescription")}
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left font-terminal text-sm transition",
                    activePage === item.id
                      ? "border-terminal-amber bg-terminal-amber/15 text-terminal-amber"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:hover:border-terminal-line dark:hover:bg-white/5",
                  )}
                  onClick={() => navigate(item.id)}
                >
                  <Icon size={18} />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2">
            <p className="font-terminal text-[10px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">{t("latestBuild")}</p>
            <p className="mt-2 font-terminal text-xs text-slate-700 dark:text-slate-200">{formatTimestamp(generatedAt, language)}</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-300/70 bg-stone-100/[0.86] px-4 py-3 backdrop-blur-xl dark:border-terminal-line dark:bg-terminal-ink/80 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-terminal text-[10px] uppercase tracking-[0.3em] text-terminal-amber">{t("workspace")}</p>
                <h2 className="font-display text-xl font-black sm:text-2xl">{t(navItems.find((item) => item.id === activePage)?.labelKey)}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-slate-300 bg-white p-1 dark:border-terminal-line dark:bg-terminal-panel lg:hidden">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      className={clsx("rounded-lg px-2 py-2 font-terminal text-xs", activePage === item.id && "bg-terminal-amber text-black")}
                      onClick={() => navigate(item.id)}
                    >
                      {t(item.labelKey).split(" ")[0]}
                    </button>
                  ))}
                </div>
                <button
                  aria-label={t("switchLanguageLabel")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-terminal text-xs dark:border-terminal-line dark:bg-terminal-panel"
                  onClick={() => setLanguage(language === "en" ? "zh" : "en")}
                >
                  <Languages size={16} />
                  {t("switchLanguage")}
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-terminal text-xs dark:border-terminal-line dark:bg-terminal-panel"
                  onClick={() => setIsDark((value) => !value)}
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  {isDark ? t("light") : t("dark")}
                </button>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6">
            {loading && <TerminalPanel>{t("loading")}</TerminalPanel>}
            {error && <TerminalPanel tone="bad">{t("loadError", { error })}</TerminalPanel>}
            {!loading && !error && (
              <>
                {activePage === "dashboard" && <Dashboard analysis={analysis} manifest={manifest} />}
                {activePage === "news" && <NewsList events={events} />}
                {activePage === "macro" && <MacroAnalysis analysis={analysis} events={events} />}
                {activePage === "market" && <MarketData marketData={marketData} analysis={analysis} marketTrends={marketTrends} marketHistory={marketHistory} />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function pageFromHash() {
  const page = window.location.hash.replace("#", "");
  return navItems.some((item) => item.id === page) ? page : "dashboard";
}

function TerminalPanel({ children, tone = "neutral" }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-6 font-terminal text-sm shadow-terminal",
        tone === "bad"
          ? "border-terminal-red bg-red-950/20 text-terminal-red"
          : "border-terminal-line bg-terminal-panel text-slate-100",
      )}
    >
      {children}
    </div>
  );
}
