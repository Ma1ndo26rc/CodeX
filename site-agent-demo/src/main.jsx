import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, BarChart3, BookOpen, ChevronRight, CircleAlert, Database, Gauge, Search, Sparkles, Target, TrendingUp } from "lucide-react";
import "./styles.css";

const fallback = {
  asOf: "2026-07-09 · US Market Close",
  regime: "Defensive Risk-On",
  confidence: 72,
  sentiment: "谨慎偏多",
  headline: "AI 资本开支韧性抵消地缘政治风险，科技股继续主导指数表现",
  summary: "美股主要指数温和收高。半导体与 AI 基础设施成为主要上行动力，但消费疲软、住房可负担性和中东局势限制风险偏好扩张。当前盘面更接近“科技驱动、宏观对冲”的防御性风险偏好。",
  indices: [
    { symbol: "S&P 500", value: "+0.3%", tone: "up" },
    { symbol: "NASDAQ", value: "+0.6%", tone: "up" },
    { symbol: "DOW", value: "-0.0%", tone: "down" },
    { symbol: "RUSSELL 2K", value: "-0.2%", tone: "down" },
    { symbol: "VIX", value: "18–19", tone: "flat" }
  ],
  drivers: [
    { rank: "01", label: "AI & Semiconductors", score: 85, view: "Positive", detail: "Micron 投资、Meta 模型升级及数据中心需求重新强化 AI 资本开支叙事。" },
    { rank: "02", label: "Geopolitical Premium", score: 90, view: "Watch", detail: "美伊局势推升尾部风险，但市场仍在定价冲突可控。" },
    { rank: "03", label: "Fed & Rate Path", score: 78, view: "Mixed", detail: "避险需求压低收益率，消费放缓提高年内降息概率。" },
    { rank: "04", label: "Consumer Health", score: 75, view: "Negative", detail: "PepsiCo 盈利不及预期，显示日常消费需求与科技支出继续分化。" }
  ],
  risks: [
    ["01", "地缘政治升级", "若能源供应受扰，通胀与利率路径将重新定价", "HIGH"],
    ["02", "科技估值集中", "指数上涨依赖少数 AI 与半导体标的", "HIGH"],
    ["03", "消费需求走弱", "必需消费盈利预警可能外溢至更广泛板块", "MED"],
    ["04", "住房与利率", "高房价与高按揭利率压制周期性需求", "MED"]
  ],
  watchlist: [
    { ticker: "NVDA", name: "NVIDIA", thesis: "AI 算力领导者", status: "Momentum intact", change: "+" },
    { ticker: "MU", name: "Micron", thesis: "HBM / 制造投资催化", status: "Catalyst active", change: "+" },
    { ticker: "SOXX", name: "Semiconductors", thesis: "板块广度验证", status: "Leadership", change: "+" },
    { ticker: "XLP", name: "Consumer Staples", thesis: "需求弹性压力", status: "Under review", change: "−" }
  ]
};

const prompts = ["为什么今天 NVIDIA 下跌？", "分析 AI 半导体板块近期风险", "美联储降息预期如何影响市场？", "总结今天美股市场主要变化"];

function normalizeContext(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...fallback,
    summary: raw.market_summary || fallback.summary,
    headline: raw.macro_summary || raw.market_summary?.slice(0, 90) || fallback.headline,
    risks: raw.risk_summary ? [["01", "当前风险判断", raw.risk_summary, "HIGH"], ...fallback.risks.slice(1)] : fallback.risks,
    asOf: raw.generated_at || fallback.asOf
  };
}

function buildResearch(question, data) {
  const q = question.toLowerCase();
  const ai = /nvidia|英伟达|ai|半导体|芯片/.test(q);
  const fed = /美联储|降息|利率|fed|rate/.test(q);
  const market = /总结|市场|美股|today|market/.test(q);
  if (ai) return {
    title: question.includes("风险") ? "AI 半导体：基本面动能仍强，估值与拥挤度是主要脆弱点" : "NVIDIA / AI 链：短期价格波动更可能来自估值与仓位，而非需求拐点",
    verdict: "NEUTRAL–BULLISH", confidence: 74,
    executive: "现有日报没有给出 NVIDIA 单日下跌的唯一公司级催化，因此不应制造因果。更可靠的判断是：AI 资本开支主线仍获 Micron、Meta 与数据中心投资验证，但高估值、拥挤交易和利率敏感性会放大短期回撤。",
    drivers: ["AI 基础设施投资与 HBM 需求仍是中期正向支撑", "科技权重集中使获利回吐对指数与板块影响更大", "长端利率与风险溢价变化会快速影响高久期估值"],
    impact: "半导体仍是相对强势板块，但个股分化将加大。若 SOXX 广度恶化而 NVDA 独自承压，偏向仓位调整；若订单、云厂商资本开支或 HBM 定价转弱，才构成基本面风险。",
    risks: ["估值压缩", "AI 资本开支见顶预期", "出口限制与供应链政策", "市场领导力过度集中"],
    watch: ["云厂商资本开支指引", "HBM 供需与毛利率", "SOXX 相对强弱", "美国 10 年期收益率"]
  };
  if (fed) return {
    title: "降息预期：先利好久期资产，但最终取决于“为什么降”",
    verdict: "CONSTRUCTIVE", confidence: 71,
    executive: "年内降息概率上升通常支持科技、成长与利率敏感资产，但若降息源于需求快速恶化，盈利下修会抵消估值扩张。当前数据更接近温和放缓，而非衰退确认。",
    drivers: ["消费走弱为政策转松提供空间", "地缘政治不确定性增加金融条件波动", "劳动力市场仍具韧性，限制激进降息"],
    impact: "初始影响偏利好成长股、REITs 与公用事业；银行可能受曲线变化压制。对大盘而言，温和降息是最佳情景，衰退式降息则不利于周期股和盈利预期。",
    risks: ["通胀重新加速", "市场提前透支降息", "收益率曲线异常波动", "盈利下修超过估值扩张"],
    watch: ["核心 CPI / PCE", "FOMC 沟通", "初请失业金", "2Y–10Y 曲线"]
  };
  return {
    title: market ? "今日美股：科技驱动温和上行，风险偏好仍带对冲" : "市场研究结论：主线清晰，但需要等待下一项确认信号",
    verdict: "SELECTIVE RISK-ON", confidence: data.confidence,
    executive: data.summary,
    drivers: data.drivers.slice(0, 3).map(x => `${x.label}：${x.detail}`),
    impact: "纳指与半导体相对占优，小盘与消费相关资产落后。市场愿意持有长期增长主题，但尚未解除对地缘政治、利率和消费需求的对冲。",
    risks: data.risks.slice(0, 3).map(x => x[1]),
    watch: ["AI 资本开支后续指引", "中东局势与油价", "美联储表态", "市场广度是否改善"]
  };
}

function App() {
  const [data, setData] = useState(fallback);
  const [question, setQuestion] = useState("");
  const [activeQuestion, setActiveQuestion] = useState("");
  const [status, setStatus] = useState("LOCAL REPORT CONTEXT");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch("../site/data/market_context.json").then(r => r.ok ? r.json() : Promise.reject()).then(raw => {
      const parsed = normalizeContext(raw); if (parsed) { setData(parsed); setStatus("LIVE PROJECT DATA"); }
    }).catch(() => {});
  }, []);
  const research = useMemo(() => activeQuestion ? buildResearch(activeQuestion, data) : null, [activeQuestion, data]);
  function run(q = question) {
    if (!q.trim()) return;
    setQuestion(q); setLoading(true);
    setTimeout(() => { setActiveQuestion(q); setLoading(false); document.getElementById("research")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 520);
  }
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark">CX</span><span>CodeX <b>Market Intelligence</b></span></a>
      <nav><a className="active" href="#top">Analyst</a><a href="#drivers">Drivers</a><a href="#risk">Risk Monitor</a><a href="#research">Research</a></nav>
      <div className="status"><i></i>{status}</div>
    </header>

    <main id="top">
      <section className="hero">
        <div className="eyebrow"><Sparkles size={13}/> AI MARKET ANALYST / DAILY RESEARCH WORKSPACE</div>
        <div className="hero-grid">
          <div><h1>Markets, interpreted.<br/><em>Not just summarized.</em></h1><p>{data.headline}</p></div>
          <div className="regime-panel">
            <div className="panel-kicker">CURRENT MARKET REGIME <span>AS OF {data.asOf}</span></div>
            <div className="regime-main"><div><span className="regime-dot"></span><strong>{data.regime}</strong><small>{data.sentiment} · 科技领涨 / 周期分化</small></div><div className="confidence"><b>{data.confidence}</b><span>/100<br/>CONFIDENCE</span></div></div>
            <p>{data.summary}</p>
          </div>
        </div>
      </section>

      <section className="ticker-strip">{data.indices.map(x => <div key={x.symbol}><span>{x.symbol}</span><b className={x.tone}>{x.value}</b></div>)}</section>

      <section id="drivers" className="section two-col">
        <div>
          <SectionTitle index="01" title="核心市场驱动" subtitle="RANKED BY MARKET IMPACT" />
          <div className="driver-list">{data.drivers.map(x => <div className="driver" key={x.rank}><span className="rank">{x.rank}</span><div><div className="driver-head"><b>{x.label}</b><span className={`tag ${x.view.toLowerCase()}`}>{x.view}</span></div><p>{x.detail}</p></div><div className="score"><span>IMPACT</span><b>{x.score}</b><i style={{"--score": `${x.score}%`}}></i></div></div>)}</div>
        </div>
        <aside className="focus-panel">
          <div className="focus-head"><Target size={17}/><b>重点关注</b><span>FOCUS LIST</span></div>
          {data.watchlist.map(x => <div className="watch-row" key={x.ticker}><div className="ticker-badge">{x.ticker}</div><div><b>{x.name}</b><span>{x.thesis}</span></div><div className={x.change === "+" ? "positive" : "negative"}>{x.status}</div></div>)}
          <div className="analyst-note"><BookOpen size={15}/><div><b>ANALYST NOTE</b><p>关注“AI 领涨是否扩散”为判断风险偏好可持续性的关键验证。</p></div></div>
        </aside>
      </section>

      <section id="risk" className="section risk-section">
        <SectionTitle index="02" title="风险雷达" subtitle="WHAT CAN BREAK THE THESIS" />
        <div className="risk-table"><div className="risk-header"><span>RANK</span><span>RISK FACTOR</span><span>TRANSMISSION</span><span>LEVEL</span></div>{data.risks.map(r => <div className="risk-row" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b><p>{r[2]}</p><span className={`level ${r[3].toLowerCase()}`}>{r[3]}</span></div>)}</div>
      </section>

      <section className="agent-entry">
        <div className="agent-label"><div><Sparkles size={18}/></div><span>CODEX RESEARCH AGENT</span><small>REPORT-GROUNDED ANALYSIS</small></div>
        <div className="agent-copy"><h2>提出一个投资研究问题</h2><p>Agent 将从现有日报中提取证据、区分事实与推断，并按机构研究结构输出结论。</p></div>
        <div className="prompt-box"><Search size={18}/><input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} placeholder="例如：分析 AI 半导体板块近期风险" aria-label="输入市场研究问题"/><button onClick={() => run()} disabled={!question.trim() || loading}>{loading ? "分析中…" : <>运行分析 <ArrowRight size={16}/></>}</button></div>
        <div className="suggestions">{prompts.map(p => <button key={p} onClick={() => run(p)}>{p}<ChevronRight size={13}/></button>)}</div>
        <div className="source-line"><Database size={13}/> KNOWLEDGE: reports/latest.json · market_analysis.json · site/data/market_context.json <span>NO LIVE API</span></div>
      </section>

      <section id="research" className={`research ${research ? "visible" : ""}`} aria-live="polite">
        {research && <>
          <div className="research-header"><div><span>AI EQUITY RESEARCH / ON-DEMAND NOTE</span><h2>{research.title}</h2><p>QUERY: “{activeQuestion}”</p></div><div className="research-meta"><span>STANCE</span><b>{research.verdict}</b><span>CONFIDENCE</span><strong>{research.confidence}%</strong></div></div>
          <div className="research-body">
            <ReportBlock number="01" title="Executive Summary"><p className="lead">{research.executive}</p></ReportBlock>
            <ReportBlock number="02" title="Key Drivers"><ol>{research.drivers.map((x,i) => <li key={x}><span>{String(i+1).padStart(2,"0")}</span>{x}</li>)}</ol></ReportBlock>
            <ReportBlock number="03" title="Market Impact"><p>{research.impact}</p></ReportBlock>
            <div className="report-split"><ReportBlock number="04" title="Risk Factors"><ul>{research.risks.map(x => <li key={x}><CircleAlert size={14}/>{x}</li>)}</ul></ReportBlock><ReportBlock number="05" title="What To Watch"><ul>{research.watch.map(x => <li key={x}><Gauge size={14}/>{x}</li>)}</ul></ReportBlock></div>
          </div>
          <div className="disclaimer">研究原型 · 基于本地日报上下文生成 · 不构成投资建议</div>
        </>}
      </section>
    </main>
    <footer><span>CodeX Market Intelligence / Agent Prototype</span><span>DATA → EVIDENCE → THESIS → MONITOR</span></footer>
  </div>;
}

function SectionTitle({index,title,subtitle}) { return <div className="section-title"><span>{index}</span><div><h2>{title}</h2><small>{subtitle}</small></div></div>; }
function ReportBlock({number,title,children}) { return <section className="report-block"><header><span>{number}</span><h3>{title}</h3></header><div>{children}</div></section>; }

createRoot(document.getElementById("root")).render(<App />);
