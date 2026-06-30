import { CalendarDays, Download, ExternalLink, FileJson, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import SectionHeader from "../components/SectionHeader.jsx";
import { formatScore, sentimentTone } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

const copy = {
  en: {
    eyebrow: "Historical Reports",
    title: "Report Archive",
    subtitle: "Review prior daily market briefs, compare top drivers and reopen saved JSON snapshots.",
    noReports: "No historical reports available yet. Run the daily job at least once to create reports/history/YYYY-MM-DD.json.",
    reports: "Reports",
    events: "events",
    avgImpact: "avg impact",
    topEvents: "Top Events",
    openJson: "Open JSON",
    loadReport: "Load report",
    selectedReport: "Selected Report",
    marketSummary: "Market Summary",
    keyEvents: "Key Events",
    loading: "Loading report...",
    loadFailed: "Unable to load this historical report.",
    score: "Score",
    impact: "Impact",
    sentiment: "Sentiment",
    sourceData: "Source data",
  },
  zh: {
    eyebrow: "往期报告",
    title: "历史日报",
    subtitle: "查看过去生成的每日市场简报，对比当日主线、核心事件和保存的 JSON 快照。",
    noReports: "暂无历史报告。至少运行一次每日任务后，会生成 reports/history/YYYY-MM-DD.json。",
    reports: "报告",
    events: "事件",
    avgImpact: "平均影响",
    topEvents: "重点事件",
    openJson: "打开 JSON",
    loadReport: "查看报告",
    selectedReport: "选中报告",
    marketSummary: "市场总结",
    keyEvents: "关键事件",
    loading: "正在加载报告...",
    loadFailed: "无法加载这份历史报告。",
    score: "评分",
    impact: "影响",
    sentiment: "情绪",
    sourceData: "原始数据",
  },
};

export default function ReportArchive({ historyIndex }) {
  const { language, localized } = useLanguage();
  const text = copy[language] ?? copy.en;
  const reports = historyIndex?.reports ?? [];
  const [selected, setSelected] = useState(reports[0] ?? null);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    setSelected((current) => current ?? reports[0] ?? null);
  }, [reports]);

  useEffect(() => {
    if (!selected?.file) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(`./data/${selected.file}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => {
        setDetail(json);
        setStatus("idle");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setDetail(null);
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, [selected]);

  if (!reports.length) {
    return (
      <div className="terminal-card p-6">
        <SectionHeader eyebrow={text.eyebrow} title={text.title} />
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{text.noReports}</p>
      </div>
    );
  }

  const detailEvents = [...(detail?.key_events ?? []), ...(detail?.news_events ?? [])]
    .filter((event) => event?.title)
    .sort((a, b) => Number(b.final_score ?? b.market_impact_score ?? 0) - Number(a.final_score ?? a.market_impact_score ?? 0))
    .slice(0, 8);
  const headline = language === "zh"
    ? selected.dynamic_headline_zh || selected.dynamic_headline
    : selected.dynamic_headline;
  const summary = language === "zh"
    ? detail?.translations?.zh?.market_summary || selected.market_summary_zh || detail?.market_summary || selected.market_summary
    : detail?.market_summary || selected.market_summary;

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow={text.eyebrow} title={text.title}>
        <p className="max-w-2xl text-right text-sm leading-6 text-slate-500 dark:text-slate-400">{text.subtitle}</p>
      </SectionHeader>

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="terminal-card overflow-hidden">
          <div className="border-b border-slate-300 p-4 dark:border-terminal-line">
            <p className="terminal-label">{text.reports}</p>
            <p className="mt-1 font-terminal text-2xl font-black text-terminal-amber">{reports.length}</p>
          </div>
          <div className="max-h-[680px] overflow-auto">
            {reports.map((report) => (
              <button
                key={report.file}
                className={`block w-full border-b border-slate-200 p-4 text-left transition dark:border-terminal-line ${
                  selected?.file === report.file
                    ? "bg-terminal-amber/15"
                    : "hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                }`}
                onClick={() => setSelected(report)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 font-terminal text-sm font-black">
                      <CalendarDays size={16} className="text-terminal-amber" />
                      {report.date}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {language === "zh" ? report.dynamic_headline_zh || report.dynamic_headline : report.dynamic_headline}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-terminal text-xs text-slate-500 dark:text-slate-400">
                    <p>{report.event_count} {text.events}</p>
                    <p>{formatScore(report.avg_impact, 1)} {text.avgImpact}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <article className="terminal-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="terminal-label">{text.selectedReport}</p>
                <h3 className="mt-2 font-display text-3xl font-black leading-tight">{headline || selected.date}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`./data/${selected.file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-terminal text-xs text-terminal-blue dark:border-terminal-line dark:bg-terminal-panel"
                >
                  <FileJson size={15} />
                  {text.openJson}
                  <ExternalLink size={13} />
                </a>
                <a
                  href={`./data/${selected.file}`}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 font-terminal text-xs text-terminal-blue dark:border-terminal-line dark:bg-terminal-panel"
                >
                  <Download size={15} />
                  {text.sourceData}
                </a>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label={text.events} value={selected.event_count} />
              <Metric label={text.avgImpact} value={formatScore(selected.avg_impact, 1)} />
              <Metric label={text.score} value={formatScore(selected.top_events?.[0]?.final_score ?? selected.avg_impact, 1)} />
            </div>

            <div className="mt-5 border-l-2 border-terminal-amber pl-4">
              <p className="terminal-label">{text.marketSummary}</p>
              {status === "loading" && <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500"><RotateCw size={14} className="animate-spin" />{text.loading}</p>}
              {status === "error" && <p className="mt-2 text-sm text-terminal-red">{text.loadFailed}</p>}
              {status !== "loading" && status !== "error" && (
                <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">{summary || "Data unavailable."}</p>
              )}
            </div>
          </article>

          <article className="terminal-card p-5">
            <SectionHeader eyebrow={text.topEvents} title={text.keyEvents} />
            <div className="space-y-3">
              {(detailEvents.length ? detailEvents : selected.top_events ?? []).map((event, index) => (
                <EventRow key={`${event.title}-${index}`} event={event} index={index} text={text} localized={localized} />
              ))}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2">
      <p className="terminal-label">{label}</p>
      <p className="mt-2 font-terminal text-2xl font-black">{value}</p>
    </div>
  );
}

function EventRow({ event, index, text, localized }) {
  const tone = sentimentTone(event.sentiment_score);
  const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-terminal-amber";
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2 lg:grid-cols-[44px_minmax(0,1fr)_220px]">
      <div className="font-terminal text-xl font-black text-terminal-amber">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <h4 className="font-display text-lg font-black">{localized(event, "title") || event.title}</h4>
        {event.summary && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{localized(event, "summary") || event.summary}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2 font-terminal text-xs lg:grid-cols-1">
        <Score label={text.score} value={formatScore(event.final_score ?? event.market_impact_score, 1)} />
        <Score label={text.impact} value={formatScore(event.market_impact_score)} />
        <Score label={text.sentiment} value={formatScore(event.sentiment_score, 2)} className={toneClass} />
      </div>
    </div>
  );
}

function Score({ label, value, className = "" }) {
  return (
    <div>
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-base font-black ${className}`}>{value}</p>
    </div>
  );
}
