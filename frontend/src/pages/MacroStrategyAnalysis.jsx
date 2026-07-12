import { AlertTriangle, Landmark } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useLanguage } from "../lib/i18n.jsx";
import "./MacroStrategyAnalysis.css";
import "./MacroStrategyRefinement.css";

const COPY = {
  en: {
    header: { eyebrow: "MACRO STRATEGY / RESEARCH", title: "MACRO ANALYSIS", subtitle: "The current market regime, its asset transmission and the risks that can change the view." },
    empty: "No macro strategy context is available in the current report.", regime: "Market Regime", executive: "Executive View", takeaway: "Key Takeaway", strategist: "Strategist View", investment: "Investment View", confidence: "Confidence",
    themes: "Macro Themes", theme: "Theme", current: "Current View", changed: "What Changed", matters: "Why It Matters", impact: "Asset Transmission", asset: "Asset", transmission: "Transmission", implication: "Implication",
    risks: "Risk Monitor", risk: "Risk Factor", trigger: "Trigger", severity: "Severity", date: "Date", event: "Event",
    watch: "What Investors Watch Next", macroData: "Macro Data", policy: "Policy", company: "Company Events", unavailable: "Signal requires confirmation.",
  },
  zh: {
    header: { eyebrow: "宏观策略 / 研究", title: "MACRO ANALYSIS", subtitle: "判断当前市场环境、资产传导路径，以及可能改变观点的主要风险。" },
    empty: "当前报告暂未形成可用的宏观策略上下文。", regime: "Market Regime", executive: "核心观点", takeaway: "关键判断", strategist: "策略师观点", investment: "投资观点", confidence: "置信度",
    themes: "Macro Themes", theme: "主题", current: "当前观点", changed: "发生了什么变化", matters: "为什么重要", impact: "Asset Transmission", asset: "资产", transmission: "传导路径", implication: "市场含义",
    risks: "Risk Monitor", risk: "风险因素", trigger: "触发条件", severity: "严重程度", date: "日期", event: "事件",
    watch: "What Investors Watch Next", macroData: "宏观数据", policy: "政策", company: "公司事件", unavailable: "当前信号仍需进一步确认。",
  },
};

export default function MacroStrategyAnalysis({ model }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const zh = language === "zh";
  if (!model?.has_data) return <><PageHeader {...copy.header}/><EmptyState title={copy.empty} icon={Landmark}/></>;
  const regime = model.market_regime ?? {};
  const themes = model.macro_themes ?? [];
  const assets = model.asset_transmission ?? [];
  const risks = model.risks ?? [];
  const watch = model.watch_next ?? {};
  return <div className="macro-strategy-page">
    <PageHeader {...copy.header}/>
    <section className="ms-section"><SectionTitle n="01" title={copy.regime}/><div className="ms-regime">
      <div className="ms-regime-copy"><span>{copy.regime}</span><h2>{local(regime,"title",zh)||copy.unavailable}</h2><div className="ms-executive"><b>{copy.executive}</b><p>{local(regime,"executive_view",zh)||copy.unavailable}</p></div><div className="ms-takeaway"><b>{copy.takeaway}</b><p>{local(regime,"key_takeaway",zh)||copy.unavailable}</p></div><div className="ms-strategist"><b>{copy.strategist}</b><p>{local(regime,"strategist_view",zh)||copy.unavailable}</p></div></div>
      <aside className="ms-analyst-view"><Metric label={copy.investment} value={local(regime,"investment_view",zh)||copy.unavailable}/><Metric label={copy.confidence} value={formatConfidence(regime.confidence)}/></aside>
    </div></section>

    <section className="ms-section"><SectionTitle n="02" title={copy.themes}/><div className="ms-theme-table">
      <div className="ms-table-head"><span>{copy.theme}</span><span>{copy.current}</span><span>{copy.changed}</span><span>{copy.matters}</span></div>
      {themes.map((theme,index)=><article key={`${theme.name}-${index}`}><h3>{local(theme,"name",zh)}</h3><p className="is-view">{local(theme,"current_view",zh)||copy.unavailable}</p><p>{local(theme,"what_changed",zh)||copy.unavailable}</p><p>{local(theme,"why_it_matters",zh)||copy.unavailable}</p></article>)}
    </div></section>

    <section className="ms-section"><SectionTitle n="03" title={copy.impact}/><div className="ms-asset-table">
      <div className="ms-table-head is-assets"><span>{copy.asset}</span><span>{copy.transmission}</span><span>{copy.implication}</span></div>
      {assets.map((asset,index)=><article className="is-transmission" key={`${asset.asset}-${index}`}><h3>{local(asset,"asset",zh)}</h3><p>{local(asset,"transmission",zh)||copy.unavailable}</p><p>{local(asset,"implication",zh)||copy.unavailable}</p></article>)}
    </div></section>

    <section className="ms-section"><SectionTitle n="04" title={copy.risks}/><div className="ms-risk-table"><div className="ms-risk-head"><span>{copy.risk}</span><span>{copy.transmission}</span><span>{copy.trigger}</span><span>{copy.severity}</span></div>{risks.length?risks.map((risk,index)=><article key={`${risk.factor}-${index}`}><div><AlertTriangle size={13}/><strong>{local(risk,"factor",zh)}</strong></div><p>{local(risk,"transmission",zh)||copy.unavailable}</p><p className="ms-trigger">{local(risk,"trigger",zh)}</p><b className={`severity is-${String(risk.severity).toLowerCase()}`}>{risk.severity}</b></article>):<p className="ms-empty-row">{copy.unavailable}</p>}</div></section>

    <section className="ms-section"><SectionTitle n="05" title={copy.watch}/><div className="ms-watch-grid"><WatchBlock title={copy.macroData} items={watch.macro_data} copy={copy}/><WatchBlock title={copy.policy} items={watch.policy} copy={copy}/><WatchBlock title={copy.company} items={watch.company_events} copy={copy}/></div></section>
  </div>;
}

function SectionTitle({n,title}){return <div className="ms-section-title"><span>{n}</span><h2>{title}</h2></div>}
function Metric({label,value}){return <div><span>{label}</span><strong>{value}</strong></div>}
function WatchBlock({title,items=[],copy}){return <article><span>{title}</span><div className="ms-watch-head"><b>{copy.date}</b><b>{copy.event}</b></div><ol>{items.map((item,index)=><li key={`${item.event}-${index}`}><time>{item.date||"—"}</time><p>{item.event}</p></li>)}</ol></article>}
function local(item,field,zh){return zh?(item?.[`${field}_zh`]||item?.[field]||""):(item?.[field]||"")}
function formatConfidence(value){const number=Number(value);return Number.isFinite(number)?`${Math.round(number)}%`:"N/A"}
