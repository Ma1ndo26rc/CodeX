import { ArrowRight, Bot, Database } from "lucide-react";

const QUICK_QUESTIONS = [
  "What are the biggest risks today?",
  "Which sectors are under pressure?",
  "Why does the top signal matter?",
  "Give me a 5-bullet briefing.",
];

export default function MarketAgentEntry({ dataStatus = "no data", onOpen }) {
  return (
    <aside className="landing-agent-entry">
      <div className="landing-agent-mark"><Bot size={22} /></div>
      <div className="landing-agent-copy"><span>MARKET AGENT / BETA</span><h3>Ask anything about today's market.</h3><p>Use the latest report, ranked signals and macro context as a focused research workspace.</p></div>
      <div className="landing-agent-questions">{QUICK_QUESTIONS.map((question) => <button key={question} onClick={() => onOpen(question)}>{question}</button>)}</div>
      <div className="landing-agent-action"><span className={dataStatus === "synchronized" ? "is-ready" : ""}><Database size={12} />{dataStatus}</span><button onClick={() => onOpen("")}>Open Agent <ArrowRight size={14} /></button></div>
    </aside>
  );
}
