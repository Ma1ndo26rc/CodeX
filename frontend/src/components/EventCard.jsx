import { ExternalLink } from "lucide-react";
import { formatScore, sentimentTone, unique } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

export default function EventCard({ event, compact = false }) {
  const { localized, t, term } = useLanguage();
  const tone = sentimentTone(event.sentiment_score);
  const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-terminal-amber";
  const image = event.image_paths?.[0];
  const sources = unique(event.source_names ?? []);

  return (
    <article className="terminal-card overflow-hidden">
      {image && !compact && (
        <div className="h-44 overflow-hidden border-b border-slate-300 dark:border-terminal-line">
          <img src={image} alt="" className="h-full w-full object-cover opacity-90 grayscale-[25%]" loading="lazy" />
        </div>
      )}
      <div className="p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Tag>{term(localized(event, "sector") || t("market"))}</Tag>
          <Tag>{term(localized(event, "event_type") || "event")}</Tag>
          {event.time_horizon && <Tag>{term(localized(event, "time_horizon"))}</Tag>}
        </div>
        <h3 className="font-display text-lg font-black leading-tight">{localized(event, "title") || t("untitledEvent")}</h3>
        {!compact && <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{localized(event, "summary")}</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Score label={t("impact")} value={formatScore(event.market_impact_score)} />
          <Score label={t("sentiment")} value={formatScore(event.sentiment_score, 2)} className={toneClass} />
        </div>
        {!compact && event.why_it_matters && (
          <div className="mt-4 border-l-2 border-terminal-amber pl-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <span className="font-bold text-terminal-amber">{t("whyItMatters")}</span>
            {localized(event, "why_it_matters")}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {(event.entities ?? []).slice(0, 6).map((entity) => (
            <span key={entity} className="rounded-full bg-slate-200 px-2 py-1 font-terminal text-[11px] text-slate-700 dark:bg-white/[0.08] dark:text-slate-300">
              {entity}
            </span>
          ))}
        </div>
        <SourceLinks names={sources} urls={event.source_urls} fallbackLabel={t("source")} />
      </div>
    </article>
  );
}

function Tag({ children }) {
  return (
    <span className="rounded-md border border-slate-300 px-2 py-1 font-terminal text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-terminal-line dark:text-slate-400">
      {children}
    </span>
  );
}

function Score({ label, value, className = "" }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-terminal-line dark:bg-terminal-panel2">
      <p className="terminal-label">{label}</p>
      <p className={`mt-2 font-terminal text-xl font-black ${className}`}>{value}</p>
    </div>
  );
}

function SourceLinks({ names = [], urls = [], fallbackLabel }) {
  if (!names.length && !urls?.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {(urls ?? []).slice(0, 4).map((url, index) => (
        <a
          key={`${url}-${index}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 font-terminal text-[11px] text-terminal-blue hover:border-terminal-blue dark:border-terminal-line"
        >
          {names[index] || fallbackLabel.replace("{count}", index + 1)}
          <ExternalLink size={12} />
        </a>
      ))}
    </div>
  );
}
