import DecisionSignalCard from "../components/DecisionSignalCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import MacroBriefCard from "../components/MacroBriefCard.jsx";
import MarketAgentEntry from "../components/MarketAgentEntry.jsx";
import MarketSnapshotStrip from "../components/MarketSnapshotStrip.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useLanguage } from "../lib/i18n.jsx";
import "./DecisionDashboard.css";

const HEADER = {
  en: {
    eyebrow: "DECISION LAYER / TODAY",
    title: "WHAT IS HAPPENING NOW?",
    subtitle: "A curated view of the market forces that matter today, ranked for decision relevance.",
  },
  zh: {
    eyebrow: "决策层 / 今日",
    title: "WHAT IS HAPPENING NOW?",
    subtitle: "聚焦今日真正影响市场的力量，并按决策相关性排序。",
  },
};

const COPY = {
  en: {
    priority: "DECISION PRIORITY",
    signals: "Top Signals",
    ranked: "Ranked by decision relevance",
    narrative: "MARKET NARRATIVE",
    keyForces: "Key Forces",
    watchNext: "Watch Next",
    explore: "EXPLORE MORE",
    allEvents: "Browse all events",
    macro: "Deep dive into macro",
    emptyTitle: "No high-impact signals",
    emptyDescription: "The current report contains no ranked market signals.",
  },
  zh: {
    priority: "决策优先级",
    signals: "重点信号",
    ranked: "按决策相关性排序",
    explore: "继续研究",
    allEvents: "浏览全部事件",
    macro: "深入宏观分析",
    emptyTitle: "暂无高影响信号",
    emptyDescription: "当前报告尚未识别出可展示的高影响事件。",
  },
};

export default function DecisionDashboard({ model, agentStatus, onOpenAgent, onOpenEvents, onOpenMacro }) {
  const { language } = useLanguage();
  const header = HEADER[language] ?? HEADER.en;
  const copy = COPY[language] ?? COPY.en;
  const signals = (model?.top_signals ?? []).slice(0, 8);
  const narrative = model?.narrative ?? {};

  return (
    <div className="landing-dashboard">
      <PageHeader {...header} />

      <MarketNarrative narrative={narrative} copy={copy} language={language} />

      <MarketSnapshotStrip snapshot={model?.snapshot} regime={model?.regime} />

      <section className="landing-signals" aria-labelledby="top-signals-title">
        <div className="landing-section-heading is-signals">
          <div>
            <span>{copy.priority}</span>
            <h2 id="top-signals-title">{copy.signals}</h2>
          </div>
          <p>{copy.ranked}</p>
        </div>
        <div className="landing-signal-list">
          {signals.map((signal, index) => (
            <DecisionSignalCard key={signal.id} signal={signal} rank={index + 1} />
          ))}
          {!signals.length && <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />}
        </div>
      </section>

      <section className="landing-insight-strip">
        <MarketAgentEntry dataStatus={agentStatus} onOpen={onOpenAgent} />
        <MacroBriefCard brief={model?.macro_brief} onOpen={onOpenMacro} />
      </section>
    </div>
  );
}

function MarketNarrative({ narrative, copy, language }) {
  const isZh = language === "zh";
  const forces = (isZh ? narrative.key_forces_zh ?? narrative.key_forces : narrative.key_forces)?.slice(0, 3);
  const watch = (isZh ? narrative.watch_next_zh ?? narrative.watch_next : narrative.watch_next)?.slice(0, 4);
  const headline = compactText(isZh ? narrative.headline_zh || narrative.headline : narrative.headline, 96);
  const summary = isZh ? narrative.summary_zh || narrative.summary : narrative.summary;
  const thesis = isZh ? narrative.thesis_zh || narrative.thesis : narrative.thesis;
  const explanation = isZh ? narrative.explanation_zh || narrative.explanation : narrative.explanation;
  const body = compactSentences([summary || thesis, explanation], 3, 360);
  return (
    <section className="landing-market-brief" aria-label={copy.narrative || "Market Narrative"}>
      <div className="landing-market-narrative">
        <span>{copy.narrative || "MARKET NARRATIVE"}</span>
        <h2>{headline || compactText(thesis, 96) || "Markets balance policy, growth and earnings signals"}</h2>
        <p>{body || "Market direction remains tied to the balance between policy expectations, earnings revisions and sector leadership."}</p>
      </div>
      <aside className="landing-market-brief-side">
        <BriefList title={copy.keyForces || "Key Forces"} items={forces} />
        <BriefList title={copy.watchNext || "Watch Next"} items={watch} />
      </aside>
    </section>
  );
}

function BriefList({ title, items }) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 3) : [];
  return (
    <section>
      <h3>{title}</h3>
      <ul>
        {rows.map((item) => {
          const label = typeof item === "object" ? item.label : "";
          const value = typeof item === "object" ? item.value : item;
          return <li key={`${label}-${value}`}>{label && <span>{label}</span>}<p>{value}</p></li>;
        })}
      </ul>
    </section>
  );
}

function compactSentences(values, limit, maxLength) {
  const sentences = values
    .flatMap((value) => splitSentences(value))
    .filter(Boolean);
  return compactText([...new Set(sentences)].slice(0, limit).join(" "), maxLength);
}

function splitSentences(value) {
  return String(value || "")
    .split(/(?<=[.!?。！？])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}
