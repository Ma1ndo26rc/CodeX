import { AlertCircle, ArrowRight, BarChart3, CheckCircle2, Database, FileText, Gauge, LoaderCircle, Search, ShieldAlert, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { buildAgentContext } from "../lib/agentContext.js";
import { askMarketAgent } from "../lib/marketAgentClient.js";
import { useLanguage } from "../lib/i18n.jsx";
import { getDisplayTitle } from "../lib/localizedText.js";
import { formatTimestamp } from "../lib/utils.js";
import "./MarketAgentWorkspace.css";
import "./MarketAgentResearchResponse.css";
import "./MarketAgentSellSide.css";

const QUESTIONS = {
  en: [
    ["COMPANY", "Why did NVIDIA fall today?", "What is the current thesis for AI leaders?"],
    ["SECTOR", "Analyze near-term risks for AI semiconductors", "Which sectors are under pressure?"],
    ["MACRO", "How do rate-cut expectations affect equities?", "Summarize today's market changes"],
  ],
  zh: [
    ["公司研究", "为什么 NVIDIA 今天下跌？", "当前 AI 龙头的投资逻辑是什么？"],
    ["行业研究", "分析 AI 半导体近期风险", "哪些行业当前承受的压力最大？"],
    ["宏观研究", "美联储降息预期如何影响市场？", "总结今天美股市场主要变化"],
  ],
};

const COPY = {
  en: {
    header: { eyebrow: "AI EQUITY RESEARCH / WORKSPACE", title: "EQUITY RESEARCH", subtitle: "Turn the current market report into a structured, evidence-grounded research view." },
    synced: "REPORT SYNCHRONIZED", noData: "NO REPORT DATA", latest: "Latest report", events: "Events", sentiment: "Sentiment", theme: "Dominant theme", sector: "Top sector",
    evidence: "EVIDENCE CONTEXT", scope: "Current research basis", report: "CURRENT REPORT", reportName: "Latest market intelligence brief", inputs: "ANALYSIS INPUTS", inputItems: ["Current report", "News events", "Macro themes"], signals: "PRIORITY EVIDENCE", context: "MARKET CONTEXT",
    query: "RESEARCH QUERY", queryTitle: "What do you want to understand?", queryHelp: "Ask a company, sector or macro question. The result is organized as an analyst research note.", placeholder: "e.g. Analyze near-term risks for AI semiconductors", run: "Run analysis", running: "Building research view...",
    output: "RESEARCH OUTPUT", empty: "Start with a research question", emptyHelp: "Select a suggested question or enter your own to generate a structured analyst view.", stance: "STANCE", confidence: "CONFIDENCE", analysisType: "ANALYSIS TYPE", horizon: "TIME HORIZON", reportId: "REPORT ID", generated: "GENERATED", based: "BASED ON", relatedEvidence: "RELATED EVIDENCE", source: "SOURCE", published: "PUBLISHED", impactScore: "IMPACT", severity: "SEVERITY", fallback: "Live analysis unavailable. Showing report-based analysis.", error: "Analysis is temporarily unavailable. Please try again.",
    sections: ["Executive Summary", "Key Drivers", "Market Impact", "Risk Factors", "What To Watch", "Evidence Register"],
  },
  zh: {
    header: { eyebrow: "AI 股票研究 / 工作台", title: "EQUITY RESEARCH", subtitle: "将当前市场报告转化为结构化、基于证据的投资研究观点。" },
    synced: "报告已同步", noData: "暂无报告数据", latest: "最新报告", events: "事件数量", sentiment: "市场情绪", theme: "主导主题", sector: "重点行业",
    evidence: "证据上下文", scope: "当前研究依据", report: "当前报告", reportName: "最新市场情报简报", inputs: "分析依据", inputItems: ["当前报告", "新闻事件", "宏观主题"], signals: "优先证据", context: "市场背景",
    query: "研究问题", queryTitle: "你希望理解什么？", queryHelp: "提出公司、行业或宏观问题，结果将按分析师研究报告组织。", placeholder: "例如：分析 AI 半导体近期风险", run: "运行分析", running: "正在构建研究观点…",
    output: "研究结果", empty: "从一个研究问题开始", emptyHelp: "选择建议问题或输入自己的问题，以生成结构化分析师观点。", stance: "观点", confidence: "置信度", analysisType: "分析类型", horizon: "时间范围", reportId: "报告 ID", generated: "生成时间", based: "分析依据", relatedEvidence: "相关证据", source: "来源", published: "发布时间", impactScore: "影响", severity: "严重程度", fallback: "实时分析暂不可用，当前显示基于报告的分析。", error: "分析暂时不可用，请稍后重试。",
    sections: ["Executive Summary", "Key Drivers", "Market Impact", "Risk Factors", "What To Watch", "Evidence Register"],
  },
};

export default function MarketAgentWorkspace({ reportData, initialQuestion = "" }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const context = useMemo(() => buildAgentContext(reportData), [reportData]);
  const key = `equity-research:${context.report_time || "latest"}`;
  const [input, setInput] = useState(() => initialQuestion || read(`${key}:input`));
  const [question, setQuestion] = useState(() => read(`${key}:question`));
  const [research, setResearch] = useState(() => readObject(`${key}:result`));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (initialQuestion) setInput(initialQuestion); }, [initialQuestion]);
  useEffect(() => { setInput(initialQuestion || read(`${key}:input`)); setQuestion(read(`${key}:question`)); setResearch(readObject(`${key}:result`)); setError(""); }, [key, initialQuestion]);
  useEffect(() => write(`${key}:input`, input), [key, input]);
  useEffect(() => write(`${key}:question`, question), [key, question]);
  useEffect(() => writeObject(`${key}:result`, research), [key, research]);

  async function run(event, suggested = "") {
    event?.preventDefault();
    const next = (suggested || input).trim();
    if (!next || loading) return;
    setInput(next); setQuestion(next); setError(""); setLoading(true);
    try {
      const response = await askMarketAgent({ question: next, context });
      setResearch(response);
    } catch { setError(copy.error); }
    finally { setLoading(false); }
  }

  return <div className="agent-page er-workspace">
    <header className="agent-hero"><PageHeader {...copy.header} /><div className={`agent-data-status ${context.has_data ? "is-ready" : "is-empty"}`}>{context.has_data ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}<span>{context.has_data ? copy.synced : copy.noData}</span></div></header>
    <section className="agent-status-strip">
      <Status label={copy.latest} value={context.report_time ? formatTimestamp(context.report_time, language) : "Unavailable"}/><Status label={copy.events} value={context.total_events}/><Status label={copy.sentiment} value={context.market_sentiment} tone={sentimentTone(context.sentiment_score)}/><Status label={copy.theme} value={context.dominant_theme}/><Status label={copy.sector} value={context.top_sector}/>
    </section>
    <div className="er-layout">
      <Evidence context={context} copy={copy} language={language}/>
      <main className="er-main">
        <section className="er-query">
          <header><div><span>{copy.query}</span><h2>{copy.queryTitle}</h2><p>{copy.queryHelp}</p></div><Sparkles size={19}/></header>
          <form onSubmit={run}><Search size={17}/><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={copy.placeholder} rows={2}/><button disabled={!input.trim() || loading}>{loading ? <LoaderCircle className="spin" size={16}/> : <ArrowRight size={16}/>}<span>{loading ? copy.running : copy.run}</span></button></form>
          <div className="er-prompts">{(QUESTIONS[language] ?? QUESTIONS.en).map(([label, ...items]) => <section key={label}><span>{label}</span><div>{items.map(item => <button key={item} onClick={(e) => run(e,item)}>{item}</button>)}</div></section>)}</div>
        </section>
        {error && <div className="er-error"><AlertCircle size={15}/>{error}</div>}
        <Output research={research} question={question} loading={loading} copy={copy} context={context} language={language}/>
      </main>
    </div>
  </div>;
}

function Evidence({ context, copy, language }) {
  return <aside className="er-evidence"><header><Database size={16}/><div><span>{copy.evidence}</span><h2>{copy.scope}</h2></div></header>{!context.has_data ? <EmptyState title={copy.noData} icon={FileText} compact/> : <>
    <section className="er-report"><span>{copy.report}</span><strong>{copy.reportName}</strong><time>{context.report_time ? formatTimestamp(context.report_time, language) : "Unavailable"}</time></section>
    <section className="er-inputs"><span>{copy.inputs}</span><ul>{copy.inputItems.map((item,i) => <li key={item}><CheckCircle2 size={13}/>{item}<b>{i===0?"01":i===1?context.total_events:context.dominant_theme}</b></li>)}</ul></section>
    <section className="er-context"><span>{copy.context}</span><p>{context.market_summary || "Data unavailable."}</p></section>
    <section className="er-signals"><span>{copy.signals}</span>{context.top_signals.slice(0,3).map((signal,i) => <article key={`${signal.title}-${i}`}><b>{String(i+1).padStart(2,"0")}</b><p>{getDisplayTitle(signal,language)||signal.title}</p><strong>{Math.round(signal.impact_score)}</strong></article>)}</section>
  </>}</aside>;
}

function Output({ research, question, loading, copy, context, language }) {
  if (!research) return <section className={`er-output ${loading?"is-loading":"is-empty"}`}>{loading?<LoaderCircle className="spin" size={23}/>:<Target size={23}/>}<strong>{loading?copy.running:copy.empty}</strong><p>{copy.emptyHelp}</p></section>;
  const evidenceMap = new Map((research.evidence ?? []).map((item) => [item.id, item]));
  const reportId = context.market_state?.report_id || [context.market_state?.report_type || "latest", context.market_state?.generated_at].filter(Boolean).join(":");
  return <article className="er-output" aria-live="polite">
    <div className="er-metadata"><Meta label={copy.analysisType} value={formatLabel(research.analysis_type)}/><Meta label={copy.reportId} value={reportId||"latest"}/><Meta label={copy.generated} value={context.report_time?formatTimestamp(context.report_time,language):"Unavailable"}/></div>
    <header className="er-output-head"><div><span>{copy.output} / {formatLabel(research.analysis_type)}</span><h2>{research.query || question}</h2><p>QUERY · {research.query || question}</p></div><div className="er-analyst"><Metric label={copy.stance} value={formatLabel(research.stance)} tone={stanceTone(research.stance)}/><Metric label={copy.confidence} value={`${research.confidence}%`}/><Metric label={copy.analysisType} value={formatLabel(research.analysis_type)}/><Metric label={copy.horizon} value={research.market_impact?.time_horizon||"N/A"}/></div></header>
    <div className="er-document">
      <Section n="01" icon={FileText} title={copy.sections[0]}><p className="lead">{research.executive_summary}</p></Section>
      <Section n="02" icon={BarChart3} title={copy.sections[1]}><DriverList items={research.key_drivers} evidenceMap={evidenceMap} copy={copy}/></Section>
      <Section n="03" icon={Gauge} title={copy.sections[2]}><ImpactView value={research.market_impact}/></Section>
      <div className="er-split"><Section n="04" icon={ShieldAlert} title={copy.sections[3]}><RiskList items={research.risk_factors} evidenceMap={evidenceMap} copy={copy}/></Section><Section n="05" icon={Target} title={copy.sections[4]}><WatchList items={research.watch_next}/></Section></div>
      <Section n="06" icon={Database} title={copy.sections[5]}><EvidenceTable items={research.evidence} copy={copy} language={language}/></Section>
    </div>
    <footer><span>{copy.based}</span>{research.evidence.map(item=><b key={item.id}>{item.source || item.title}</b>)}</footer>
  </article>;
}

function Section({n,icon:Icon,title,children}){return <section className="er-section"><header><span>{n}</span><Icon size={15}/><h3>{title}</h3></header><div>{children}</div></section>}
function DriverList({items=[],evidenceMap,copy}){return <div className="er-driver-grid">{items.map((x,i)=><article key={`${x.title}-${i}`}><header><span>{String(i+1).padStart(2,"0")}</span><h4>{x.title}</h4><b className={`is-${x.direction}`}>{x.direction}</b><strong>{Math.round(Number(x.importance)||0)}</strong></header><p>{x.analysis}</p><RelatedEvidence ids={x.evidence_ids} evidenceMap={evidenceMap} copy={copy}/></article>)}</div>}
function ImpactView({value={}}){return <dl className="er-impact"><div><dt>Equities</dt><dd>{value.equities||"No confirmed equity impact."}</dd></div><div><dt>Rates</dt><dd>{value.rates||"No confirmed rates impact."}</dd></div><div><dt>Sectors</dt><dd>{(value.sectors||[]).join(" · ")||"Broad market"}</dd></div><div><dt>Horizon</dt><dd>{value.time_horizon||"Near term"}</dd></div></dl>}
function RiskList({items=[],evidenceMap,copy}){return <div className="er-risk-list">{items.map((x,i)=><article key={`${x.title||x}-${i}`}><header><strong>{x.title||x}</strong><b className={`risk-level is-${x.level||"medium"}`}>{x.level||"medium"}</b></header>{x.analysis&&<p>{x.analysis}</p>}<RelatedEvidence ids={x.evidence_ids} evidenceMap={evidenceMap} copy={copy}/></article>)}</div>}
function WatchList({items=[]}){return <ul className="er-bullets">{items.map((x,i)=><li key={`${x.item||x}-${i}`}><strong>{x.item||x}</strong>{x.why_it_matters&&<p>{x.why_it_matters}</p>}</li>)}</ul>}
function RelatedEvidence({ids=[],evidenceMap,copy}){const rows=ids.map(id=>evidenceMap.get(id)).filter(Boolean);return rows.length?<div className="er-related"><span>{copy.relatedEvidence}</span>{rows.map(item=><div key={item.id}><b>{item.source||item.sources?.[0]||copy.source}</b><p>{item.title}</p><strong>{Math.round(Number(item.impact_score)||0)}</strong></div>)}</div>:null}
function EvidenceTable({items=[],copy,language}){return <div className="er-evidence-table"><div className="head"><span>{copy.source}</span><span>Title</span><span>{copy.published}</span><span>{copy.impactScore}</span></div>{items.map(item=><article key={item.id}><b>{item.source||item.sources?.[0]||"Current report"}</b><p>{item.title}</p><time>{item.published_at?formatTimestamp(item.published_at,language):"—"}</time><strong>{Math.round(Number(item.impact_score)||0)}</strong></article>)}</div>}
function Status({label,value,tone=""}){return <div className="agent-status-item"><span>{label}</span><strong className={tone}>{value??"Unavailable"}</strong></div>}
function Metric({label,value,tone=""}){return <div><span>{label}</span><strong className={tone}>{value||"N/A"}</strong></div>}
function Meta({label,value}){return <div><span>{label}</span><strong>{value}</strong></div>}

function sentimentTone(v){return Number(v)>.1?"is-positive":Number(v)<-.1?"is-negative":"is-neutral"}
function stanceTone(v){return /constructive|bullish|positive/i.test(v)?"is-positive":/cautious|bearish|negative/i.test(v)?"is-negative":"is-neutral"}
function formatLabel(value){return String(value||"N/A").replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase())}
function read(k){try{return sessionStorage.getItem(k)||""}catch{return ""}}function write(k,v){try{if(v)sessionStorage.setItem(k,v);else sessionStorage.removeItem(k)}catch{/* unavailable */}}function readObject(k){try{const v=JSON.parse(sessionStorage.getItem(k)||"null");return v&&typeof v==="object"?v:null}catch{return null}}function writeObject(k,v){try{if(v)sessionStorage.setItem(k,JSON.stringify(v));else sessionStorage.removeItem(k)}catch{/* unavailable */}}
