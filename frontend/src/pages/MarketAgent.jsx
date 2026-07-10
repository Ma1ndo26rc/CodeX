import { AlertCircle, ArrowUp, Bot, CheckCircle2, Database, FileText, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { buildAgentContext } from "../lib/agentContext.js";
import { askMarketAgent } from "../lib/marketAgentClient.js";
import { useLanguage } from "../lib/i18n.jsx";
import { getDisplayTitle } from "../lib/localizedText.js";
import { formatTimestamp } from "../lib/utils.js";

const COPY = {
  en: {
    header: { eyebrow: "AI ANALYSIS WORKSPACE / BETA", title: "MARKET AGENT", subtitle: "Ask questions based on today's market intelligence." },
    welcome: "Hi, I'm your Market Agent. I can help explain today's market, summarize key events, compare themes, and identify risks based on the latest report.",
    synchronized: "DATA SYNCHRONIZED", noData: "NO REPORT DATA", latest: "Latest report", events: "Total events", sentiment: "Market sentiment", theme: "Dominant theme", sector: "Top sector",
    activeContext: "ACTIVE CONTEXT", scope: "Latest report scope", empty: "No report context", emptyDescription: "Load a report to enable grounded market answers.",
    summary: "Market summary", risk: "Risk & sentiment", macro: "Macro outlook", topSignals: "TOP 3 SIGNALS", newsItems: "news items", sources: "sources",
    assistant: "MARKET INTELLIGENCE ASSISTANT", notebook: "Analysis notebook", agent: "MARKET AGENT", you: "YOU", loading: "Analyzing market intelligence...", send: "Send",
    placeholder: "Ask about risks, sectors, themes or the next market catalyst...",
    questions: ["What are today's biggest risks?", "Why did AI stocks fall today?", "Summarize today's market.", "What should investors watch next?", "Which sectors are under the most pressure?", "Give me a 5-bullet market briefing."],
  },
  zh: {
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
  const context = buildAgentContext(reportData);
  const storageKey = `market-agent:${context.report_time || "latest"}`;
  const inputStorageKey = `${storageKey}:input`;
  const [input, setInput] = useState(() => initialQuestion || readStoredInput(inputStorageKey));
  const [messages, setMessages] = useState(() => readStoredMessages(storageKey, copy.welcome));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    setMessages(readStoredMessages(storageKey, copy.welcome));
    setInput(initialQuestion || readStoredInput(inputStorageKey));
    setError("");
  }, [storageKey, inputStorageKey, copy.welcome, initialQuestion]);

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
      setMessages((current) => [...current, { id: `agent-${Date.now()}`, role: "agent", content: answer }]);
    } catch (requestError) {
      setError(requestError.message || "Market Agent could not complete the request.");
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
              <ContextBlock label={copy.summary} value={context.market_summary} />
              <ContextBlock label={copy.risk} value={context.risk_and_sentiment} />
              <ContextBlock label={copy.macro} value={context.macro_outlook} />
              <div className="agent-top-signals"><span>{copy.topSignals}</span>{context.top_signals.map((signal, index) => <div key={`${signal.title}-${index}`}><b>{index + 1}</b><p>{getDisplayTitle(signal, language) || signal.title}</p><strong>{Math.round(signal.impact_score)}</strong></div>)}</div>
              <div className="agent-context-counts"><span>{context.news_count} {copy.newsItems}</span><span>{context.source_count} {copy.sources}</span></div>
            </div>
          )}
        </aside>

        <section className="agent-console">
          <div className="agent-console-head"><Bot size={18} /><div><span>{copy.assistant}</span><h2>{copy.notebook}</h2></div></div>
          <div className="agent-suggestions">
            {copy.questions.map((question) => <button key={question} onClick={() => setInput(question)}>{question}</button>)}
          </div>
          <div className="agent-transcript" aria-live="polite">
            {messages.map((message) => <article key={message.id} className={`agent-message is-${message.role}`}><span>{message.role === "agent" ? copy.agent : copy.you}</span><p>{message.content}</p></article>)}
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

function ContextBlock({ label, value }) {
  return <section><span>{label}</span><p>{value || "Data unavailable."}</p></section>;
}

function sentimentTone(value) {
  return Number(value) > 0.1 ? "is-positive" : Number(value) < -0.1 ? "is-negative" : "is-neutral";
}

function readStoredMessages(key, welcome) {
  if (typeof sessionStorage === "undefined") return defaultMessages(welcome);
  try {
    const parsed = JSON.parse(sessionStorage.getItem(`${key}:messages`) || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : defaultMessages(welcome);
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
