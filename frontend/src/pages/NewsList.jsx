import { ExternalLink } from "lucide-react";
import { useState } from "react";
import SectionHeader from "../components/SectionHeader.jsx";
import { getEventLayer, sentimentTone, toNumber, unique } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

export default function NewsList({ events = [] }) {
  const { localized, t, term } = useLanguage();
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState("All");

  const filtered = events.filter((event) => {
    const haystack = [event.title, event.summary, event.sector, event.event_type, ...(event.entities ?? []), ...(event.source_names ?? [])]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesLayer = layer === "All" || getEventLayer(event) === layer;
    return matchesQuery && matchesLayer;
  });

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow={t("newsList")} title={t("sourceLinkedTape")} />
      <div className="terminal-card flex flex-wrap gap-3 p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-64 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-terminal text-sm outline-none focus:border-terminal-amber dark:border-terminal-line dark:bg-terminal-panel2"
        />
        <div className="flex rounded-xl border border-slate-300 bg-slate-100 p-1 dark:border-terminal-line dark:bg-terminal-panel2">
          {["All", "Macro", "Market", "Company"].map((item) => (
            <button
              key={item}
              className={`rounded-lg px-3 py-2 font-terminal text-xs ${layer === item ? "bg-terminal-amber text-black" : "text-slate-600 dark:text-slate-300"}`}
              onClick={() => setLayer(item)}
            >
              {item === "All" ? t("all") : term(item)}
            </button>
          ))}
        </div>
      </div>

      <div className="terminal-card overflow-hidden">
        <div className="hidden grid-cols-[80px_1fr_130px_110px_140px] gap-4 border-b border-slate-300 px-4 py-3 font-terminal text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:border-terminal-line dark:text-slate-400 lg:grid">
          <span>{t("layer")}</span>
          <span>{t("headline")}</span>
          <span>{t("impact")}</span>
          <span>{t("sentiment")}</span>
          <span>{t("sources")}</span>
        </div>
        {filtered.map((event, index) => {
          const tone = sentimentTone(event.sentiment_score);
          const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-terminal-amber";
          return (
            <article key={`${event.title}-${index}`} className="grid gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 dark:border-terminal-line lg:grid-cols-[80px_1fr_130px_110px_140px]">
              <span className="font-terminal text-xs text-terminal-amber">{term(getEventLayer(event))}</span>
              <div>
                <h3 className="font-display text-base font-black">{localized(event, "title")}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{localized(event, "summary")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unique(event.entities).slice(0, 5).map((entity) => (
                    <span key={entity} className="rounded bg-slate-200 px-2 py-1 font-terminal text-[10px] dark:bg-white/[0.08]">
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
              <span className="font-terminal text-sm">{toNumber(event.market_impact_score).toFixed(0)} / 100</span>
              <span className={`font-terminal text-sm ${toneClass}`}>{toNumber(event.sentiment_score).toFixed(2)}</span>
              <div className="flex flex-wrap gap-2">
                {(event.source_urls ?? []).slice(0, 3).map((url, sourceIndex) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-terminal text-xs text-terminal-blue">
                    {event.source_names?.[sourceIndex] || t("source", { count: sourceIndex + 1 })}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
