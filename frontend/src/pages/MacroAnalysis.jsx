import EventCard from "../components/EventCard.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { getEventLayer, toNumber } from "../lib/utils.js";

export default function MacroAnalysis({ analysis, events = [] }) {
  const macroEvents = events.filter((event) => getEventLayer(event) === "Macro");
  const marketEvents = events.filter((event) => getEventLayer(event) === "Market");
  const companyEvents = events.filter((event) => getEventLayer(event) === "Company");

  return (
    <div className="space-y-5">
      <section className="terminal-card p-5">
        <SectionHeader eyebrow="Macro Analysis" title="Rates, Policy, Growth And Risk Appetite" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Narrative title="Macro Outlook" text={analysis.macro_outlook} />
          <Narrative title="Market Summary" text={analysis.market_summary} />
          <Narrative title="Risk & Sentiment" text={analysis.risk_and_sentiment} />
        </div>
      </section>

      <Layer title="Macro Layer" description="Fed, inflation, yields, policy and cross-asset macro catalysts." events={macroEvents} />
      <Layer title="Market Layer" description="Index breadth, sector rotation, risk appetite and factor-level stories." events={marketEvents} />
      <Layer title="Company Layer" description="Earnings, layoffs, guidance, regulation and single-name catalysts." events={companyEvents} />
    </div>
  );
}

function Narrative({ title, text }) {
  return (
    <article className="rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2">
      <p className="terminal-label">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{text}</p>
    </article>
  );
}

function Layer({ title, description, events }) {
  const sorted = [...events].sort((a, b) => toNumber(b.market_impact_score) - toNumber(a.market_impact_score));
  return (
    <section>
      <SectionHeader eyebrow={`${events.length} events`} title={title}>
        <p className="max-w-xl text-right text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
      </SectionHeader>
      {sorted.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {sorted.map((event, index) => (
            <EventCard key={`${event.title}-${index}`} event={event} compact={title !== "Macro Layer"} />
          ))}
        </div>
      ) : (
        <div className="terminal-card p-5 text-sm text-slate-500 dark:text-slate-400">No events classified in this layer.</div>
      )}
    </section>
  );
}
