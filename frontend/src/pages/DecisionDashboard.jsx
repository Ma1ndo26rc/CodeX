import DecisionSignalCard from "../components/DecisionSignalCard.jsx";
import MarketSnapshotStrip from "../components/MarketSnapshotStrip.jsx";
import TodayGlance from "../components/TodayGlance.jsx";
import MarketAgentEntry from "../components/MarketAgentEntry.jsx";

export default function DecisionDashboard({ model, agentStatus, onOpenAgent }) {
  const signals = model?.top_signals ?? [];
  return (
    <div className="landing-dashboard">
      <section className="landing-hero">
        <span>DECISION LAYER / TODAY</span>
        <h1>WHAT IS HAPPENING NOW?</h1>
        <p>A curated view of the market forces that matter today, ranked for decision relevance.</p>
      </section>

      <MarketSnapshotStrip snapshot={model?.snapshot} regime={model?.regime} />

      <TodayGlance stats={model?.stats} />

      <section className="landing-signals" aria-labelledby="top-signals-title">
        <div className="landing-section-heading is-signals">
          <div><span>DECISION PRIORITY</span><h2 id="top-signals-title">Top Signals</h2></div>
          <p>Ranked by estimated market impact</p>
        </div>
        <div className="landing-signal-list">
          {signals.map((signal, index) => <DecisionSignalCard key={signal.id} signal={signal} rank={index + 1} />)}
          {!signals.length && <EmptyState text="No high-impact signals available." />}
        </div>
        <MarketAgentEntry dataStatus={agentStatus} onOpen={onOpenAgent} />
      </section>
    </div>
  );
}

export function PageHeading({ eyebrow, title, subtitle }) {
  return <header className="pa-page-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></header>;
}

export function EmptyState({ text }) {
  return <div className="pa-empty">{text}</div>;
}
