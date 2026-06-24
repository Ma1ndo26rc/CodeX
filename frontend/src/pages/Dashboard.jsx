import DownloadBar from "../components/DownloadBar.jsx";
import EventCard from "../components/EventCard.jsx";
import EventMatrix from "../components/EventMatrix.jsx";
import MarketTicker from "../components/MarketTicker.jsx";
import MetricCard from "../components/MetricCard.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { getEventLayer, toNumber } from "../lib/utils.js";

export default function Dashboard({ analysis, manifest }) {
  const events = analysis?.key_events ?? [];
  const marketData = analysis?.market_data?.items ?? [];
  const topEvents = [...events].sort((a, b) => toNumber(b.market_impact_score) - toNumber(a.market_impact_score)).slice(0, 6);
  const avgImpact = events.length ? events.reduce((sum, event) => sum + toNumber(event.market_impact_score), 0) / events.length : 0;
  const avgSentiment = events.length ? events.reduce((sum, event) => sum + toNumber(event.sentiment_score), 0) / events.length : 0;
  const layers = events.reduce(
    (acc, event) => {
      acc[getEventLayer(event)] += 1;
      return acc;
    },
    { Macro: 0, Market: 0, Company: 0 },
  );

  return (
    <div className="space-y-5">
      <section className="terminal-card overflow-hidden">
        <div className="grid gap-6 p-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <p className="terminal-label">Market Summary</p>
            <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-5xl">
              AI market brief with source-linked event intelligence.
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">{analysis.market_summary}</p>
          </div>
          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2">
            <p className="terminal-label">Risk & Sentiment</p>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{analysis.risk_and_sentiment}</p>
          </div>
        </div>
      </section>

      <MarketTicker items={marketData} />
      <DownloadBar reports={manifest?.reports} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Key Events" value={events.length} subValue="LLM-ranked market drivers" tone="info" />
        <MetricCard label="Avg Impact" value={avgImpact.toFixed(0)} subValue="0-100 event score" tone={avgImpact >= 65 ? "warn" : "neutral"} />
        <MetricCard label="Avg Sentiment" value={avgSentiment.toFixed(2)} subValue="-1 risk-off to +1 risk-on" tone={avgSentiment > 0 ? "good" : avgSentiment < 0 ? "bad" : "neutral"} />
        <MetricCard label="Macro" value={layers.Macro} subValue="Rates, inflation, policy" />
        <MetricCard label="Company" value={layers.Company} subValue="Single-name catalysts" />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <EventMatrix events={events} />
        <section className="terminal-card p-4">
          <SectionHeader eyebrow="Index Performance Summary" title="Market Read-Through" />
          <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{analysis.index_performance_summary}</p>
          <div className="mt-5 border-t border-slate-300 pt-5 dark:border-terminal-line">
            <SectionHeader eyebrow="Macro Outlook" title="Macro Direction" />
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{analysis.macro_outlook}</p>
          </div>
        </section>
      </div>

      <section>
        <SectionHeader eyebrow="Top Event Tape" title="Most Market-Sensitive Stories" />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {topEvents.map((event, index) => (
            <EventCard key={`${event.title}-${index}`} event={event} />
          ))}
        </div>
      </section>
    </div>
  );
}
