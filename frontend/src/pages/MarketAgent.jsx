import { AlertCircle, ArrowUp, Bot, CheckCircle2, Database, FileText, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { buildAgentContext } from "../lib/agentContext.js";
import { askMarketAgent } from "../lib/marketAgentClient.js";
import { formatTimestamp } from "../lib/utils.js";

const WELCOME = "Hi, I'm your Market Agent. I can help explain today's market, summarize key events, compare themes, and identify risks based on the latest report.";
const SUGGESTED_QUESTIONS = [
  "What are the biggest risks in the market today?",
  "Which sectors are under the most pressure?",
  "Explain why the top signal matters.",
  "Summarize today's AI-related market signals.",
  "What events should I watch next?",
  "Give me a 5-bullet market briefing.",
];

export default function MarketAgent({ reportData, initialQuestion = "" }) {
  const context = buildAgentContext(reportData);
  const [input, setInput] = useState(initialQuestion);
  const [messages, setMessages] = useState([{ id: "welcome", role: "agent", content: WELCOME }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
  }, [initialQuestion]);

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
        <div><span>AI ANALYSIS WORKSPACE / BETA</span><h1>Market Agent</h1><p>Ask questions based on the latest market intelligence report.</p></div>
        <div className={`agent-data-status ${context.has_data ? "is-ready" : "is-empty"}`}>
          {context.has_data ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{context.has_data ? "DATA SYNCHRONIZED" : "NO REPORT DATA"}</span>
        </div>
      </header>

      <section className="agent-status-strip">
        <Status label="Latest report" value={context.report_time ? formatTimestamp(context.report_time, "en") : "Unavailable"} />
        <Status label="Total events" value={context.total_events} />
        <Status label="Market sentiment" value={context.market_sentiment} tone={sentimentTone(context.sentiment_score)} />
        <Status label="Dominant theme" value={context.dominant_theme} />
        <Status label="Top sector" value={context.top_sector} />
      </section>

      <div className="agent-workspace">
        <aside className="agent-context-card">
          <header><Database size={16} /><div><span>ACTIVE CONTEXT</span><h2>Latest report scope</h2></div></header>
          {!context.has_data && <div className="agent-empty"><FileText size={20} />Load a report to enable grounded market answers.</div>}
          {context.has_data && (
            <div className="agent-context-sections">
              <ContextBlock label="Market summary" value={context.market_summary} />
              <ContextBlock label="Risk & sentiment" value={context.risk_and_sentiment} />
              <ContextBlock label="Macro outlook" value={context.macro_outlook} />
              <div className="agent-top-signals"><span>TOP 3 SIGNALS</span>{context.top_signals.map((signal, index) => <div key={`${signal.title}-${index}`}><b>{index + 1}</b><p>{signal.title}</p><strong>{Math.round(signal.impact_score)}</strong></div>)}</div>
              <div className="agent-context-counts"><span>{context.news_count} news items</span><span>{context.source_count} sources</span></div>
            </div>
          )}
        </aside>

        <section className="agent-console">
          <div className="agent-console-head"><Bot size={18} /><div><span>MARKET INTELLIGENCE ASSISTANT</span><h2>Analysis notebook</h2></div></div>
          <div className="agent-suggestions">
            {SUGGESTED_QUESTIONS.map((question) => <button key={question} onClick={() => setInput(question)}>{question}</button>)}
          </div>
          <div className="agent-transcript" aria-live="polite">
            {messages.map((message) => <article key={message.id} className={`agent-message is-${message.role}`}><span>{message.role === "agent" ? "MARKET AGENT" : "YOU"}</span><p>{message.content}</p></article>)}
            {loading && <div className="agent-loading"><LoaderCircle size={16} />Analyzing current report context...</div>}
          </div>
          {error && <div className="agent-error"><AlertCircle size={15} />{error}</div>}
          <form className="agent-composer" onSubmit={submit}>
            <Sparkles size={16} />
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about risks, sectors, themes or the next market catalyst..." rows={2} />
            <button type="submit" disabled={loading || !input.trim()}><span>Send</span><ArrowUp size={16} /></button>
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
