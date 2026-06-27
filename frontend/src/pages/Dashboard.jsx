import DownloadBar from "../components/DownloadBar.jsx";
import EventCard from "../components/EventCard.jsx";
import EventMatrix from "../components/EventMatrix.jsx";
import MarketTicker from "../components/MarketTicker.jsx";
import MetricCard from "../components/MetricCard.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { getEventLayer, toNumber } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

export default function Dashboard({ analysis, manifest }) {
  const { localized, t } = useLanguage();
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
            <p className="terminal-label">{t("marketSummary")}</p>
            <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">{localized(analysis, "market_summary")}</p>
          </div>
          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2">
            <p className="terminal-label">{t("riskSentiment")}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{localized(analysis, "risk_and_sentiment")}</p>
          </div>
        </div>
      </section>

      <MarketTicker items={marketData} />
      <DownloadBar reports={manifest?.reports} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={t("keyEvents")} value={events.length} subValue={t("rankedDrivers")} tone="info" />
        <MetricCard label={t("avgImpact")} value={avgImpact.toFixed(0)} subValue={t("eventScore")} tone={avgImpact >= 65 ? "warn" : "neutral"} />
        <MetricCard label={t("avgSentiment")} value={avgSentiment.toFixed(2)} subValue={t("sentimentScale")} tone={avgSentiment > 0 ? "good" : avgSentiment < 0 ? "bad" : "neutral"} />
        <MetricCard label={t("macro")} value={layers.Macro} subValue={t("macroSub")} />
        <MetricCard label={t("company")} value={layers.Company} subValue={t("companySub")} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <EventMatrix events={events} />
        <section className="terminal-card p-4">
          <SectionHeader eyebrow={t("indexPerformance")} title={t("marketReadThrough")} />
          <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{localized(analysis, "index_performance_summary")}</p>
          <div className="mt-5 border-t border-slate-300 pt-5 dark:border-terminal-line">
            <SectionHeader eyebrow={t("macroOutlook")} title={t("macroDirection")} />
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{localized(analysis, "macro_outlook")}</p>
          </div>
        </section>
      </div>

      <section>
        <SectionHeader eyebrow={t("topEventTape")} title={t("sensitiveStories")} />
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {topEvents.map((event, index) => (
            <EventCard key={`${event.title}-${index}`} event={event} />
          ))}
        </div>
      </section>
    </div>
  );
}
