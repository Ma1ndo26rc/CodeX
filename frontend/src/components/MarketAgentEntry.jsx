import { ArrowRight, Bot, Database } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

const QUICK_QUESTIONS = [
  "What are the biggest risks today?",
  "Which sectors are under pressure?",
  "Why does the top signal matter?",
];

const QUICK_QUESTIONS_ZH = [
  "今天最大的风险是什么？",
  "哪些行业承压？",
  "为什么首要信号重要？",
];

export default function MarketAgentEntry({ dataStatus = "no data", onOpen }) {
  const { language } = useLanguage();
  const copy = language === "zh"
    ? {
        eyebrow: "市场助手 / BETA",
        title: "询问任何关于今日市场的问题。",
        description: "以最新报告、重点信号和宏观背景作为研究工作台。",
        open: "打开助手",
        ready: "已同步",
        noData: "暂无数据",
        questions: QUICK_QUESTIONS_ZH,
      }
    : {
        eyebrow: "MARKET AGENT / BETA",
        title: "Ask anything about today's market.",
        description: "Use the latest report, ranked signals and macro context as a focused research workspace.",
        open: "Open Agent",
        ready: "synchronized",
        noData: "no data",
        questions: QUICK_QUESTIONS,
      };

  return (
    <aside className="landing-agent-entry">
      <div className="landing-agent-mark"><Bot size={22} /></div>
      <div className="landing-agent-copy">
        <span>{copy.eyebrow}</span>
        <h3>{copy.title}</h3>
        <p>{copy.description}</p>
      </div>
      <div className="landing-agent-questions">
        {copy.questions.map((question) => (
          <button key={question} type="button" onClick={() => onOpen(question)}>{question}</button>
        ))}
      </div>
      <div className="landing-agent-action">
        <span className={dataStatus === "synchronized" ? "is-ready" : ""}>
          <Database size={12} />
          {dataStatus === "synchronized" ? copy.ready : copy.noData}
        </span>
        <button type="button" onClick={() => onOpen("")}>
          {copy.open}
          <ArrowRight size={14} />
        </button>
      </div>
    </aside>
  );
}
