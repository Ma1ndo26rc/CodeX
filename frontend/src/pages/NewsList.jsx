import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useState } from "react";
import SectionHeader from "../components/SectionHeader.jsx";
import { formatTimestamp, getEventLayer, sentimentTone, toNumber, unique } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

const SORT_OPTIONS = [["important", "mostImportant"], ["latest", "latest"], ["impact", "highestImpact"], ["bearish", "mostBearish"], ["bullish", "mostBullish"], ["discussed", "mostDiscussed"]];
const TOPIC_FILTERS = [["All", "allTopics"], ["Macro", "macro"], ["Fed / Rates", "fedRates"], ["Geopolitics", "geopolitics"], ["Oil / Energy", "oilEnergy"], ["AI", "ai"], ["Semiconductor", "semiconductor"], ["Big Tech", "bigTech"], ["Earnings", "earnings"], ["Company News", "companyNews"], ["Low Priority", "lowPriority"]];

export default function NewsList({ events = [], newsItems = [], newsEvents = [] }) {
  const { language, localized, t, term } = useLanguage();
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState("All");
  const [topic, setTopic] = useState("All");
  const [sortBy, setSortBy] = useState("important");
  const [expanded, setExpanded] = useState({});
  const rows = newsEvents.length ? newsEvents : newsItems.length ? newsItems.map(item => newsToEvent(item, language)) : events;

  const filtered = rows.filter((item) => {
    const haystack = [
      item.title,
      item.summary,
      localized(item, "title"),
      localized(item, "summary"),
      item.sector,
      item.event_type,
      item.why_it_matters,
      ...(item.keywords ?? item.entities ?? []),
      ...(item.related_tickers ?? []),
      ...(item.source_names ?? []),
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesLayer = layer === "All" || eventLayer(item) === layer;
    const matchesTopic = topic === "All" || topicMatches(item, topic);
    return matchesQuery && matchesLayer && matchesTopic;
  }).sort(sortEvents(sortBy));

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow={t("newsCount", { count: filtered.length, total: rows.length })} title={t("sourceLinkedTape")} />
      <div className="terminal-card flex flex-wrap gap-3 p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-64 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-terminal text-sm outline-none focus:border-terminal-amber dark:border-terminal-line dark:bg-terminal-panel2"
        />
        <FilterSelect label={t("sortBy")} value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} t={t} />
        <FilterSelect label={t("filterBy")} value={topic} onChange={setTopic} options={TOPIC_FILTERS} t={t} />
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
        <div className="hidden grid-cols-[80px_1fr_150px_110px_170px] gap-4 border-b border-slate-300 px-4 py-3 font-terminal text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:border-terminal-line dark:text-slate-400 lg:grid">
          <span>{t("layer")}</span>
          <span>{t("marketEvent")}</span>
          <span>{t("score")}</span>
          <span>{t("sentiment")}</span>
          <span>{t("sources")}</span>
        </div>
        {filtered.map((event, index) => {
          const id = event.event_id || `${event.title}-${index}`;
          const articles = event.articles ?? [];
          const tone = sentimentTone(event.sentiment_score);
          const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-terminal-amber";
          return (
            <article key={id} className="grid gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 dark:border-terminal-line lg:grid-cols-[80px_1fr_150px_110px_170px]">
              <span className="font-terminal text-xs text-terminal-amber">{term(eventLayer(event))}</span>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={event.priority_level} t={t} />
                  {(event.topics ?? []).slice(0, 3).map((value) => <MetaBadge key={value}>{term(value)}</MetaBadge>)}
                </div>
                <h3 className="font-display text-base font-black">{localized(event, "title")}</h3>
                {localized(event, "summary") && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{localized(event, "summary")}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {unique(event.related_tickers?.length ? event.related_tickers : event.keywords ?? event.entities).slice(0, 6).map((entity) => (
                    <span key={entity} className="rounded bg-slate-200 px-2 py-1 font-terminal text-[10px] dark:bg-white/[0.08]">
                      {term(entity)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-terminal text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  <span>{t("timeHorizon")}: {term(localized(event, "time_horizon") || t("upcoming"))}</span>
                  <span>{t("sourceQuality")}: {toNumber(event.source_quality_score).toFixed(0)}</span>
                  <span>{t("confidence")}: {toNumber(event.confidence_score).toFixed(0)}</span>
                  <span>{t("discussedBy", { count: event.source_count || articles.length || 1 })}</span>
                </div>
                <p className="mt-3 border-l-2 border-terminal-amber pl-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-terminal-amber">{t("whyItMatters")}</span>
                  {localized(event, "why_it_matters") || t("notEnoughConfirmation")}
                </p>
                {!!articles.length && (
                  <button className="mt-3 inline-flex items-center gap-1 font-terminal text-xs text-terminal-blue" onClick={() => setExpanded((value) => ({ ...value, [id]: !value[id] }))}>
                    {expanded[id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {expanded[id] ? t("hideArticles") : t("showArticles", { count: articles.length })}
                  </button>
                )}
              </div>
              <div className="font-terminal text-sm">
                <p>{toNumber(event.final_score || event.market_impact_score).toFixed(1)} <span className="text-xs text-slate-500">{t("final")}</span></p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{toNumber(event.market_impact_score).toFixed(0)} / 100 {t("impactShort")}</p>
              </div>
              <span className={`font-terminal text-sm ${toneClass}`}>{toNumber(event.sentiment_score).toFixed(2)}</span>
              <div className="flex flex-wrap gap-2">
                {(event.related_sources?.length ? event.related_sources : (event.source_urls ?? []).map((url, sourceIndex) => ({ url, name: event.source_names?.[sourceIndex] }))).slice(0, 4).map((source, sourceIndex) => (
                  <a key={`${source.url}-${sourceIndex}`} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-terminal text-xs text-terminal-blue">
                    {source.name || t("source", { count: sourceIndex + 1 })}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
              {expanded[id] && <ArticleDetails articles={articles} language={language} localized={localized} t={t} />}
            </article>
          );
        })}
        {!filtered.length && <div className="p-6 text-sm text-slate-500 dark:text-slate-400">{t("noNews")}</div>}
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, t }) {
  return (
    <label className="flex min-w-44 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 dark:border-terminal-line dark:bg-terminal-panel2">
      <span className="font-terminal text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 font-terminal text-xs outline-none">
        {options.map(([key, labelKey]) => <option key={key} value={key}>{t(labelKey)}</option>)}
      </select>
    </label>
  );
}

function PriorityBadge({ priority = "Medium", t }) {
  const tone = {
    Critical: "border-terminal-red bg-terminal-red/10 text-terminal-red",
    High: "border-terminal-amber bg-terminal-amber/10 text-terminal-amber",
    Medium: "border-terminal-blue bg-terminal-blue/10 text-terminal-blue",
    Low: "border-slate-300 text-slate-500 dark:border-terminal-line",
  }[priority] ?? "border-slate-300 text-slate-500";
  return <span className={`rounded-md border px-2 py-1 font-terminal text-[10px] uppercase tracking-[0.15em] ${tone}`}>{t(`priority${priority}`)}</span>;
}

function MetaBadge({ children }) {
  return <span className="rounded-md border border-slate-300 px-2 py-1 font-terminal text-[10px] uppercase tracking-[0.12em] text-slate-500 dark:border-terminal-line dark:text-slate-400">{children}</span>;
}

function ArticleDetails({ articles, language, localized, t }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-terminal-line dark:bg-black/20 lg:col-span-5 lg:ml-24">
      <p className="terminal-label">{t("relatedArticles")}</p>
      <div className="mt-3 grid gap-2">
        {articles.map((article, index) => (
          <a key={`${article.source_url}-${index}`} href={article.source_url} target="_blank" rel="noreferrer" className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 hover:border-terminal-blue dark:border-terminal-line dark:bg-terminal-panel2 sm:grid-cols-[1fr_auto]">
            <div><p className="text-sm font-bold">{localized(article, "title")}</p><p className="mt-1 font-terminal text-[10px] text-slate-500">{article.source_name} / {t("sourceQuality")} {article.source_quality_score}</p></div>
            <span className="font-terminal text-[10px] text-slate-500">{formatTimestamp(article.published_at, language)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function eventLayer(event) {
  if (["Macro", "Fed / Rates", "Geopolitics"].some((value) => event.topics?.includes(value))) return "Macro";
  if (event.sector === "Company" || event.event_type === "Company News") return "Company";
  return getEventLayer(event);
}

function topicMatches(event, topic) {
  if (topic === "Low Priority") return event.priority_level === "Low" || event.topics?.includes(topic);
  if (topic === "Macro") return eventLayer(event) === "Macro" || event.topics?.includes(topic);
  return event.topics?.includes(topic) || event.event_type === topic;
}

function sortEvents(key) {
  return (left, right) => {
    if (key === "latest") return dateValue(right.published_at) - dateValue(left.published_at);
    if (key === "impact") return toNumber(right.market_impact_score) - toNumber(left.market_impact_score);
    if (key === "bearish") return toNumber(left.sentiment_score) - toNumber(right.sentiment_score);
    if (key === "bullish") return toNumber(right.sentiment_score) - toNumber(left.sentiment_score);
    if (key === "discussed") return toNumber(right.source_count) - toNumber(left.source_count) || toNumber(right.final_score) - toNumber(left.final_score);
    return toNumber(right.final_score || right.market_impact_score) - toNumber(left.final_score || left.market_impact_score);
  };
}

function dateValue(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function newsToEvent(item, language) {
  const category = String(item.category || "market");
  return {
    ...item,
    sector: category === "policy" ? "macro" : category,
    event_type: category,
    entities: language === "zh" && item.translations?.zh?.keywords?.length
      ? item.translations.zh.keywords
      : item.keywords?.length ? item.keywords : item.tickers ?? [],
    market_impact_score: item.market_impact_score || estimateImpact(item),
    sentiment_score: item.sentiment_score ?? sentimentScore(item.sentiment),
    source_names: item.source_name ? [item.source_name] : [],
    source_urls: item.source_url ? [item.source_url] : [],
  };
}

function sentimentScore(sentiment) {
  if (sentiment === "positive") return 0.35;
  if (sentiment === "negative") return -0.35;
  return 0;
}

function estimateImpact(item) {
  const category = String(item.category || "").toLowerCase();
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  let score = 38 + ({ macro: 14, policy: 12, company: 9, industry: 7 }[category] || 4);
  if (item.sentiment && item.sentiment !== "neutral") score += 5;
  if (["fed", "inflation", "rate", "yield", "earnings", "guidance", "tariff", "ai", "semiconductor"].some(word => text.includes(word))) score += 9;
  return Math.min(85, score);
}
