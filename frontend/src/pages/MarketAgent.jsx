import { AlertCircle, ArrowUp, Bot, CheckCircle2, Database, FileText, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { buildAgentContext } from "../lib/agentContext.js";
import { askMarketAgent } from "../lib/marketAgentClient.js";
import { useLanguage } from "../lib/i18n.jsx";
import { getDisplayTitle } from "../lib/localizedText.js";
import { formatTimestamp } from "../lib/utils.js";
import "./MarketAgent.css";

const RESEARCH_QUESTION_GROUPS = {
  en: [
    { label: "MARKET OVERVIEW", questions: ["Give me today's market briefing", "What moved markets today?", "Explain the current market regime"] },
    { label: "RISK", questions: ["What are today's biggest risks?", "Which sectors are under pressure?"] },
    { label: "SECTOR", questions: ["Analyze semiconductor stocks", "Which sectors benefit from today's events?"] },
    { label: "RESEARCH", questions: ["Summarize today's market in 5 bullets", "What should investors watch next?"] },
  ],
  zh: [
    { label: "市场概览", questions: ["请给我今天的市场简报", "今天是什么推动了市场？", "当前市场处于什么宏观状态？"] },
    { label: "风险", questions: ["今天最大的风险是什么？", "哪些行业承受压力？"] },
    { label: "行业", questions: ["分析半导体行业", "哪些行业受益于今天的事件？"] },
    { label: "研究", questions: ["用五个要点总结今天的市场", "投资者接下来应该关注什么？"] },
  ],
};

const COPY = {
  en: {
    header: { eyebrow: "AI ANALYSIS WORKSPACE / BETA", title: "MARKET AGENT", subtitle: "Ask questions based on today's market intelligence." },
    welcome: "I analyze today's market using the latest report, key signals, macro context and sector impacts.\n\nAsk me why markets moved, what risks matter, or which sectors are affected.",
    synchronized: "DATA SYNCHRONIZED", noData: "NO REPORT DATA", latest: "Latest report", events: "Total events", sentiment: "Market sentiment", theme: "Dominant theme", sector: "Top sector",
    activeContext: "ACTIVE CONTEXT", scope: "Agent knowledge", empty: "No report context", emptyDescription: "Load a report to enable grounded market answers.",
    report: "REPORT", reportName: "Latest market report", knowledge: "KNOWLEDGE AVAILABLE", knowledgeItems: ["Market events", "Top signals", "Macro context", "Sector impact"], currentView: "CURRENT MARKET VIEW", regime: "Regime", mainTheme: "Main theme",
    summary: "Market summary", risk: "Risk & sentiment", macro: "Macro outlook", topSignals: "TOP 3 SIGNALS", newsItems: "news items", sources: "sources",
    assistant: "MARKET INTELLIGENCE ASSISTANT", notebook: "Research workspace", positioning: "Grounded in the latest report, key signals, macro context and sector impact.", agent: "MARKET INTELLIGENCE ASSISTANT", you: "YOU", loading: "Analyzing market intelligence...", send: "Send",
    basedOn: "BASED ON", basedOnItems: ["Latest report", "Market signals", "Macro analysis"], liveUnavailable: "Live analysis unavailable. Showing report-based analysis.", requestUnavailable: "Live analysis is temporarily unavailable. Please try again shortly.",
    placeholder: "Ask about risks, sectors, themes or the next market catalyst...",
    questions: ["What are today's biggest risks?", "Why did AI stocks fall today?", "Summarize today's market.", "What should investors watch next?", "Which sectors are under the most pressure?", "Give me a 5-bullet market briefing."],
  },
  zh: {
    welcomeV21: "我使用最新市场报告、关键信号、宏观背景和行业影响分析今日市场。\n\n你可以询问市场为何波动、哪些风险值得关注，或哪些行业受到影响。",
    report: "报告", reportName: "最新市场报告", knowledge: "可用知识", knowledgeItems: ["市场事件", "重点信号", "宏观背景", "行业影响"], currentView: "当前市场观点", regime: "市场状态", mainTheme: "主要主题",
    liveUnavailable: "实时分析暂时不可用，当前显示基于报告的分析。", requestUnavailable: "实时分析暂时不可用，请稍后重试。",
    welcomeV2: "市场情报助手。基于最新市场报告、关键信号、宏观背景和行业影响提供研究支持。",
    positioning: "基于最新报告、关键信号、宏观背景和行业影响。", analyzing: "正在分析", reportContext: ["最新市场报告", "关键市场信号", "宏观状态", "行业影响"], basedOn: "基于", basedOnItems: ["最新报告", "市场信号", "宏观分析"],
    header: { eyebrow: "AI 分析工作台 / 测试版", title: "MARKET AGENT", subtitle: "基于今日市场情报进行提问。" },
    welcome: "你好，我是 Market Agent。我可以基于最新报告解释今日市场、总结关键事件、比较主题并识别风险。",
    synchronized: "数据已同步", noData: "暂无报告数据", latest: "最新报告", events: "事件总数", sentiment: "市场情绪", theme: "主导主题", sector: "重点行业",
    activeContext: "当前上下文", scope: "最新报告范围", empty: "暂无报告上下文", emptyDescription: "加载报告后即可进行基于数据的市场问答。",
    summary: "市场摘要", risk: "风险与情绪", macro: "宏观展望", topSignals: "前三项信号", newsItems: "条新闻", sources: "个来源",
    assistant: "市场情报助手", notebook: "分析工作簿", agent: "市场助手", you: "你", loading: "正在分析当前报告上下文...", send: "发送",
    placeholder: "询问风险、行业、主题或下一项市场催化剂...",
    questions: ["今天市场最大的风险是什么？", "哪些行业承受的压力最大？", "解释为什么首要信号值得关注。", "总结今天与 AI 相关的市场信号。", "接下来应该关注哪些事件？", "给我一份五点市场简报。"],
  },
};

export default function MarketAgent({ reportData, initialQuestion = "" }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const welcome = copy.welcomeV21 || copy.welcomeV2 || copy.welcome;
  const context = buildAgentContext(reportData);
  const storageKey = `market-agent:${context.report_time || "latest"}`;
  const inputStorageKey = `${storageKey}:input`;
  const [input, setInput] = useState(() => initialQuestion || readStoredInput(inputStorageKey));
  const [messages, setMessages] = useState(() => readStoredMessages(storageKey, welcome));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    setMessages(readStoredMessages(storageKey, welcome));
    setInput(initialQuestion || readStoredInput(inputStorageKey));
    setError("");
  }, [storageKey, inputStorageKey, welcome, initialQuestion]);

  useEffect(() => {
    writeStoredMessages(storageKey, messages);
  }, [storageKey, messages]);

  useEffect(() => {
    writeStoredInput(inputStorageKey, input);
  }, [inputStorageKey, input]);

  const submit = async (event) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: question }]);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const answer = await askMarketAgent({ question, context });
      const result = normalizeAgentAnswer(answer, copy.liveUnavailable);
      setMessages((current) => [...current, { id: `agent-${Date.now()}`, role: "agent", content: result.content, notice: result.notice }]);
    } catch {
      setError(copy.requestUnavailable || "Live analysis is temporarily unavailable. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="agent-page">
      <header className="agent-hero">
        <PageHeader {...copy.header} />
        <div className={`agent-data-status ${context.has_data ? "is-ready" : "is-empty"}`}>
          {context.has_data ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{context.has_data ? copy.synchronized : copy.noData}</span>
        </div>
      </header>

      <section className="agent-status-strip">
        <Status label={copy.latest} value={context.report_time ? formatTimestamp(context.report_time, language) : "Unavailable"} />
        <Status label={copy.events} value={context.total_events} />
        <Status label={copy.sentiment} value={context.market_sentiment} tone={sentimentTone(context.sentiment_score)} />
        <Status label={copy.theme} value={context.dominant_theme} />
        <Status label={copy.sector} value={context.top_sector} />
      </section>

      <div className="agent-workspace">
        <aside className="agent-context-card">
          <header><Database size={16} /><div><span>{copy.activeContext}</span><h2>{copy.scope}</h2></div></header>
          {!context.has_data && <EmptyState title={copy.empty} description={copy.emptyDescription} icon={FileText} compact />}
          {context.has_data && (
            <div className="agent-context-sections">
              <section className="agent-context-report">
                <span>{copy.report || "REPORT"}</span>
                <strong>{copy.reportName || "Latest market report"}</strong>
                <time>{context.report_time ? formatTimestamp(context.report_time, language) : "Unavailable"}</time>
              </section>
              <section className="agent-active-context">
                <span>{copy.knowledge || "KNOWLEDGE AVAILABLE"}</span>
                <ul>{(copy.knowledgeItems || []).map((item) => <li key={item}><CheckCircle2 size={14} />{item}</li>)}</ul>
              </section>
              <ContextBlock label={copy.summary || "MARKET SUMMARY"} value={context.market_summary} />
              <ContextBlock label={copy.risk || "RISK & SENTIMENT"} value={context.risk_and_sentiment} />
              <div className="agent-top-signals"><span>{copy.topSignals || "TOP 3 SIGNALS"}</span>{context.top_signals.slice(0, 3).map((signal, index) => <div key={`${signal.title}-${index}`}><b>{index + 1}</b><p>{getDisplayTitle(signal, language) || signal.title}</p><strong>{Math.round(signal.impact_score)}</strong></div>)}</div>
            </div>
          )}
        </aside>

        <section className="agent-console">
          <div className="agent-console-head"><Bot size={18} /><div><span>{copy.assistant}</span><h2>{copy.notebook}</h2><p>{copy.positioning}</p></div></div>
          <div className="agent-suggestions">
            {(RESEARCH_QUESTION_GROUPS[language] ?? RESEARCH_QUESTION_GROUPS.en).map((group) => (
              <section key={group.label} className="agent-question-group"><span>{group.label}</span><div>{group.questions.map((question) => <button key={question} onClick={() => setInput(question)}>{question}</button>)}</div></section>
            ))}
          </div>
          <div className="agent-transcript" aria-live="polite">
            {messages.map((message) => <AgentMessage key={message.id} message={message} copy={copy} />)}
            {loading && <div className="agent-loading"><LoaderCircle size={16} />{copy.loading}</div>}
          </div>
          {error && <div className="agent-error"><AlertCircle size={15} />{error}</div>}
          <form className="agent-composer" onSubmit={submit}>
            <Sparkles size={16} />
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={copy.placeholder} rows={2} />
            <button type="submit" disabled={loading || !input.trim()}><span>{copy.send}</span><ArrowUp size={16} /></button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Status({ label, value, tone = "" }) {
  return <div className="agent-status-item"><span>{label}</span><strong className={tone}>{value ?? "Unavailable"}</strong></div>;
}

function AgentMessage({ message, copy }) {
  const isAgent = message.role === "agent";
  const normalized = isAgent ? normalizeAgentAnswer(message.content, copy.liveUnavailable) : { content: message.content, notice: "" };
  const sections = isAgent ? answerSections(normalized.content) : [];
  const notice = message.notice || normalized.notice;
  return (
    <article className={`agent-message is-${message.role}`}>
      <span>{isAgent ? copy.agent : copy.you}</span>
      <div className="agent-message-body">
        {isAgent && <div className="agent-answer-context"><b>{copy.basedOn || "BASED ON"}</b>{(copy.basedOnItems || []).map((item) => <span key={item}>{item}</span>)}</div>}
        {notice && <p className="agent-response-notice">{notice}</p>}
        {sections.length ? <div className="agent-answer-note"><span>MARKET BRIEF</span><div className="agent-answer-sections">{sections.map((section, index) => <section key={`${section.title}-${index}`}><h3>{section.title}</h3><p>{section.content}</p></section>)}</div></div> : <p>{normalized.content}</p>}
      </div>
    </article>
  );
}

function answerSections(content) {
  const headingNames = {
    "DIRECT ANSWER": "SUMMARY",
    SUMMARY: "SUMMARY",
    "KEY DRIVERS": "KEY DRIVERS",
    "MARKET IMPACT": "MARKET IMPACT",
    "MARKET IMPLICATION": "MARKET IMPACT",
    "WATCH NEXT": "WATCH NEXT",
    "WHAT TO WATCH NEXT": "WATCH NEXT",
  };
  const sections = [];
  let current;
  const preamble = [];
  String(content || "").split("\n").forEach((line) => {
    const match = line.match(/^\s*(?:#{1,3}\s*)?(DIRECT ANSWER|SUMMARY|KEY DRIVERS|MARKET IMPACT|MARKET IMPLICATION|WATCH NEXT|WHAT TO WATCH NEXT)\s*:?[ \t]*(.*)$/i);
    const normalizedHeading = match ? headingNames[match[1].toUpperCase()] : "";
    if (match && normalizedHeading) {
      current = { title: normalizedHeading, content: match[2].trim() };
      sections.push(current);
    } else if (current) {
      current.content = `${current.content}${current.content ? "\n" : ""}${line}`.trim();
    } else if (line.trim()) {
      preamble.push(line.trim());
    }
  });
  if (!sections.length) return [];
  if (preamble.length) sections.unshift({ title: "SUMMARY", content: preamble.join(" ") });
  return mergeAnswerSections(sections.filter((section) => section.content));
}

function mergeAnswerSections(sections) {
  return sections.reduce((result, section) => {
    const existing = result.find((item) => item.title === section.title);
    if (existing) existing.content = `${existing.content}\n${section.content}`;
    else result.push({ ...section });
    return result;
  }, []);
}

function ContextBlock({ label, value }) {
  return <section className="agent-context-brief"><span>{label}</span><p>{value || "Data unavailable."}</p></section>;
}

function normalizeAgentAnswer(answer, fallbackMessage) {
  const raw = String(answer || "").trim();
  const fallbackPattern = /^\s*Local report fallback:[^\n]*(?:\n+|$)/i;
  const usedFallback = fallbackPattern.test(raw);
  const content = raw.replace(fallbackPattern, "").trim();
  return {
    content: content || fallbackMessage,
    notice: usedFallback ? fallbackMessage : "",
  };
}

function sentimentTone(value) {
  return Number(value) > 0.1 ? "is-positive" : Number(value) < -0.1 ? "is-negative" : "is-neutral";
}

function readStoredMessages(key, welcome) {
  if (typeof sessionStorage === "undefined") return defaultMessages(welcome);
  try {
    const parsed = JSON.parse(sessionStorage.getItem(`${key}:messages`) || "[]");
    if (!Array.isArray(parsed) || !parsed.length) return defaultMessages(welcome);
    return parsed.map((message) => message?.id === "welcome" ? { ...message, content: welcome } : message);
  } catch {
    return defaultMessages(welcome);
  }
}

function writeStoredMessages(key, messages) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${key}:messages`, JSON.stringify(messages));
}

function readStoredInput(key) {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(key) || "";
}

function writeStoredInput(key, value) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, value);
}

function defaultMessages(welcome) {
  return [{ id: "welcome", role: "agent", content: welcome }];
}
