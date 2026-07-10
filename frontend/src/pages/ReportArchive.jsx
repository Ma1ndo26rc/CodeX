import { CalendarDays, ExternalLink, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useLanguage } from "../lib/i18n.jsx";

const COPY = {
  en: { header: { eyebrow: "REPORTS LAYER", title: "REPORTS", subtitle: "Download full research reports and archives." }, empty: "No reports available", emptyDescription: "Generated reports will appear here after the next successful run.", archive: "ARCHIVE", daily: "Daily Report", historical: "HISTORICAL REPORT", open: "OPEN JSON", events: "EVENTS", impact: "AVG IMPACT", type: "REPORT TYPE", loading: "Loading historical document...", error: "Historical document unavailable.", summary: "MARKET SUMMARY", macro: "MACRO OUTLOOK", risk: "RISK & SENTIMENT", unavailable: "Data unavailable." },
  zh: { header: { eyebrow: "报告层", title: "REPORTS", subtitle: "下载完整研究报告并浏览历史归档。" }, empty: "暂无报告", emptyDescription: "下次成功生成报告后，归档会显示在这里。", archive: "归档", daily: "每日报告", historical: "历史报告", open: "打开 JSON", events: "事件数", impact: "平均影响", type: "报告类型", loading: "正在加载历史报告...", error: "历史报告暂时无法加载。", summary: "市场摘要", macro: "宏观展望", risk: "风险与情绪", unavailable: "暂无数据。" },
};

export default function ReportArchive({ model }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const reports = model?.index?.reports ?? [];
  const [selected, setSelected] = useState(reports[0] ?? null);
  const [document, setDocument] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    setSelected((current) => reports.some((report) => report.file === current?.file) ? current : reports[0] ?? null);
  }, [reports]);

  useEffect(() => {
    if (!selected?.file) {
      setDocument(null);
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(`./data/${selected.file}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => { setDocument(data); setStatus("idle"); })
      .catch((error) => {
        if (error.name !== "AbortError") { setDocument(null); setStatus("error"); }
      });
    return () => controller.abort();
  }, [selected]);

  return (
    <>
      <PageHeader {...copy.header} />
      {!reports.length ? <EmptyState title={copy.empty} description={copy.emptyDescription} /> : (
        <div className="pa-report-layout">
          <aside className="pa-report-index">
            <header><span>{copy.archive}</span><strong>{reports.length}</strong></header>
            {reports.map((report) => (
              <button key={report.file} className={selected?.file === report.file ? "is-active" : ""} onClick={() => setSelected(report)}>
                <CalendarDays size={15} /><div><strong>{report.date}</strong><span>{report.report_label || report.report_type || copy.daily}</span></div><b>{Math.round(report.avg_impact ?? 0)}</b>
              </button>
            ))}
          </aside>
          <article className="pa-report-document">
            <header>
              <div><span>{selected?.report_label || copy.historical}</span><h2>{selected?.dynamic_headline || selected?.date}</h2><p>{selected?.date}</p></div>
              <a href={`./data/${selected?.file}`} target="_blank" rel="noreferrer"><ExternalLink size={14} />{copy.open}</a>
            </header>
            <div className="pa-report-metrics">
              <Metric label={copy.events} value={selected?.event_count ?? 0} />
              <Metric label={copy.impact} value={Number(selected?.avg_impact ?? 0).toFixed(1)} />
              <Metric label={copy.type} value={selected?.report_type || copy.daily} />
            </div>
            {status === "loading" && <div className="pa-document-state"><FileText size={20} />{copy.loading}</div>}
            {status === "error" && <div className="pa-document-state is-error">{copy.error}</div>}
            {status === "idle" && document && (
              <div className="pa-report-body">
                <section><span>{copy.summary}</span><p>{document.market_summary || copy.unavailable}</p></section>
                <section><span>{copy.macro}</span><p>{document.macro_outlook || copy.unavailable}</p></section>
                <section><span>{copy.risk}</span><p>{document.risk_and_sentiment || copy.unavailable}</p></section>
              </div>
            )}
          </article>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
