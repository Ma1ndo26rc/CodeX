import { CalendarDays, ExternalLink, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeading, EmptyState } from "./DecisionDashboard.jsx";

export default function ReportArchive({ model }) {
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
      <PageHeading eyebrow="HISTORICAL LAYER" title="Reports" subtitle="Daily archives and prior regime snapshots for historical comparison." />
      {!reports.length ? <EmptyState text="No historical reports are available yet." /> : (
        <div className="pa-report-layout">
          <aside className="pa-report-index">
            <header><span>ARCHIVE</span><strong>{reports.length}</strong></header>
            {reports.map((report) => (
              <button key={report.file} className={selected?.file === report.file ? "is-active" : ""} onClick={() => setSelected(report)}>
                <CalendarDays size={15} /><div><strong>{report.date}</strong><span>{report.report_label || report.report_type || "Daily Report"}</span></div><b>{Math.round(report.avg_impact ?? 0)}</b>
              </button>
            ))}
          </aside>
          <article className="pa-report-document">
            <header>
              <div><span>{selected?.report_label || "HISTORICAL REPORT"}</span><h2>{selected?.dynamic_headline || selected?.date}</h2><p>{selected?.date}</p></div>
              <a href={`./data/${selected?.file}`} target="_blank" rel="noreferrer"><ExternalLink size={14} />OPEN JSON</a>
            </header>
            <div className="pa-report-metrics">
              <Metric label="EVENTS" value={selected?.event_count ?? 0} />
              <Metric label="AVG IMPACT" value={Number(selected?.avg_impact ?? 0).toFixed(1)} />
              <Metric label="REPORT TYPE" value={selected?.report_type || "DAILY"} />
            </div>
            {status === "loading" && <div className="pa-document-state"><FileText size={20} />Loading historical document...</div>}
            {status === "error" && <div className="pa-document-state is-error">Historical document unavailable.</div>}
            {status === "idle" && document && (
              <div className="pa-report-body">
                <section><span>MARKET SUMMARY</span><p>{document.market_summary || "Data unavailable."}</p></section>
                <section><span>MACRO OUTLOOK</span><p>{document.macro_outlook || "Data unavailable."}</p></section>
                <section><span>RISK & SENTIMENT</span><p>{document.risk_and_sentiment || "Data unavailable."}</p></section>
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
