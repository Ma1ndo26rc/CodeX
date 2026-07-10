import { Bot, Clock3, ExternalLink, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState.jsx";
import NewsThumbnail from "../components/NewsThumbnail.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useLanguage } from "../lib/i18n.jsx";
import { getDisplaySource, getDisplaySummary, getDisplayTitle } from "../lib/localizedText.js";
import { formatTimestamp } from "../lib/utils.js";

const HEADER = {
  en: {
    eyebrow: "INFORMATION LAYER",
    title: "EVENT FEED",
    subtitle: "Browse all market-moving events from today's report.",
  },
  zh: {
    eyebrow: "信息层",
    title: "EVENT FEED",
    subtitle: "浏览今日报告中识别出的市场事件。",
  },
};

const COPY = {
  en: {
    search: "Search title, summary, source, ticker, sector or theme",
    allSectors: "All sectors",
    allThemes: "All themes",
    allSources: "All sources",
    allSentiment: "All sentiment",
    allImpact: "All impact",
    latest: "Latest",
    impact: "Highest Impact",
    positive: "Most Positive",
    negative: "Most Negative",
    events: "EVENTS",
    unknown: "Unknown Source",
    timeUnavailable: "Time unavailable",
    summary: "Summary unavailable.",
    impactLabel: "IMPACT",
    sentimentLabel: "SENTIMENT",
    open: "Open",
    ask: "Ask Agent",
    noMatch: "No events match your filters",
    noMatchDescription: "Clear the search query or loosen the filters to see more events.",
    impactLevels: { high: "High impact", medium: "Medium impact", low: "Low impact" },
    sentiments: { positive: "Positive", negative: "Negative", neutral: "Neutral" },
  },
  zh: {
    search: "搜索标题、摘要、来源、代码、行业或主题",
    allSectors: "全部行业",
    allThemes: "全部主题",
    allSources: "全部来源",
    allSentiment: "全部情绪",
    allImpact: "全部影响",
    latest: "最新",
    impact: "影响最高",
    positive: "最积极",
    negative: "最消极",
    events: "事件",
    unknown: "未知来源",
    timeUnavailable: "时间未知",
    summary: "暂无摘要。",
    impactLabel: "影响",
    sentimentLabel: "情绪",
    open: "打开",
    ask: "问 Agent",
    noMatch: "没有符合筛选条件的事件",
    noMatchDescription: "清空搜索或放宽筛选条件以查看更多事件。",
    impactLevels: { high: "高影响", medium: "中等影响", low: "低影响" },
    sentiments: { positive: "积极", negative: "消极", neutral: "中性" },
  },
};

const IMPACT_LEVELS = [
  { value: "high", minimum: 80 },
  { value: "medium", minimum: 50, maximum: 79.999 },
  { value: "low", maximum: 49.999 },
];

export default function NewsList({ model, onAskAgent }) {
  const { language } = useLanguage();
  const header = HEADER[language] ?? HEADER.en;
  const copy = COPY[language] ?? COPY.en;
  const filters = model?.filters ?? {};
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const [sector, setSector] = useState("");
  const [theme, setTheme] = useState("");
  const [source, setSource] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [impact, setImpact] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const events = useMemo(() => {
    return [...(model?.events ?? [])]
      .filter((event) => matchesQuery(event, deferredQuery, language))
      .filter((event) => !sector || event.sector === sector)
      .filter((event) => !theme || event.theme === theme || event.themes?.includes(theme))
      .filter((event) => !source || event.sources?.includes(source) || getDisplaySource(event) === source)
      .filter((event) => !sentiment || sentimentBucket(event.sentiment_score) === sentiment)
      .filter((event) => !impact || impactBucket(event.impact_score) === impact)
      .sort(sortEvents(sort));
  }, [deferredQuery, impact, language, model?.events, sector, sentiment, sort, source, theme]);

  const visibleImages = new Set();

  return (
    <>
      <PageHeader {...header} />
      <div className="pa-feed-controls">
        <label className="pa-feed-search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} />
        </label>
        <div className="pa-filter-grid">
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort events">
            <option value="latest">{copy.latest}</option>
            <option value="impact">{copy.impact}</option>
            <option value="positive">{copy.positive}</option>
            <option value="negative">{copy.negative}</option>
          </select>
          <select value={sector} onChange={(event) => setSector(event.target.value)} aria-label="Filter by sector">
            <option value="">{copy.allSectors}</option>
            {(filters.sectors ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Filter by theme">
            <option value="">{copy.allThemes}</option>
            {(filters.themes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Filter by source">
            <option value="">{copy.allSources}</option>
            {(filters.sources ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sentiment} onChange={(event) => setSentiment(event.target.value)} aria-label="Filter by sentiment">
            <option value="">{copy.allSentiment}</option>
            <option value="positive">{copy.sentiments.positive}</option>
            <option value="negative">{copy.sentiments.negative}</option>
            <option value="neutral">{copy.sentiments.neutral}</option>
          </select>
          <select value={impact} onChange={(event) => setImpact(event.target.value)} aria-label="Filter by impact">
            <option value="">{copy.allImpact}</option>
            {IMPACT_LEVELS.map((level) => <option key={level.value} value={level.value}>{copy.impactLevels[level.value]}</option>)}
          </select>
        </div>
        <span>{events.length} {copy.events}</span>
      </div>

      <section className="pa-event-feed">
        {events.map((event) => {
          const title = getDisplayTitle(event, language) || event.title;
          const summary = getDisplaySummary(event, language) || event.one_line_summary || copy.summary;
          const sourceName = getDisplaySource(event) || copy.unknown;
          const score = Math.round(Number(event.impact_score) || 0);
          const sentimentScore = Number(event.sentiment_score) || 0;
          const imageKey = imageFingerprint(event);
          const suppressImage = Boolean(imageKey && visibleImages.has(imageKey));
          if (imageKey && !suppressImage) visibleImages.add(imageKey);
          return (
            <article key={event.id} className="pa-event-row">
              <NewsThumbnail item={event} source={sourceName} ticker={event.tickers?.[0]} sector={event.sector} eventType={event.event_type} suppressImage={suppressImage} />
              <div className="pa-event-story">
                <div className="pa-event-byline">
                  <strong>{sourceName}</strong>
                  <time><Clock3 size={12} />{event.timestamp ? formatTimestamp(event.timestamp, language) : copy.timeUnavailable}</time>
                  {!!event.sector && <span>{event.sector}</span>}
                  {!!event.theme && <span>{event.theme}</span>}
                </div>
                {event.source_url ? (
                  <a className="pa-event-headline" href={event.source_url} target="_blank" rel="noreferrer">{title}</a>
                ) : (
                  <h2 className="pa-event-headline">{title}</h2>
                )}
                <p className="pa-event-summary">{summary}</p>
              </div>
              <div className="pa-event-metrics">
                <div className="pa-event-score"><span>{copy.impactLabel}</span><strong>{score}</strong></div>
                <div className="pa-event-sentiment">
                  <span>{copy.sentimentLabel}</span>
                  <strong className={toneClass(sentimentScore)}>{signed(sentimentScore)}</strong>
                </div>
              </div>
              <div className="pa-event-actions">
                {event.source_url && (
                  <a href={event.source_url} target="_blank" rel="noreferrer" aria-label={`${copy.open} ${title}`}>
                    <ExternalLink size={15} />
                    <span>{copy.open}</span>
                  </a>
                )}
                <button type="button" onClick={() => onAskAgent?.(`Explain this market event: ${title}`)}>
                  <Bot size={15} />
                  <span>{copy.ask}</span>
                </button>
              </div>
            </article>
          );
        })}
        {!events.length && <EmptyState title={copy.noMatch} description={copy.noMatchDescription} compact />}
      </section>
    </>
  );
}

function matchesQuery(event, query, language) {
  if (!query) return true;
  return [
    getDisplayTitle(event, language),
    getDisplaySummary(event, language),
    getDisplaySource(event),
    event.company,
    event.sector,
    event.theme,
    event.event_type,
    ...(event.tickers ?? []),
    ...(event.entities ?? []),
    ...(event.sources ?? []),
    ...(event.themes ?? []),
  ].join(" ").toLowerCase().includes(query);
}

function sortEvents(sort) {
  if (sort === "impact") return (a, b) => (Number(b.impact_score) || 0) - (Number(a.impact_score) || 0);
  if (sort === "positive") return (a, b) => (Number(b.sentiment_score) || 0) - (Number(a.sentiment_score) || 0);
  if (sort === "negative") return (a, b) => (Number(a.sentiment_score) || 0) - (Number(b.sentiment_score) || 0);
  return (a, b) => dateValue(b.timestamp) - dateValue(a.timestamp);
}

function sentimentBucket(value) {
  const number = Number(value) || 0;
  if (number > 0.1) return "positive";
  if (number < -0.1) return "negative";
  return "neutral";
}

function impactBucket(value) {
  const number = Number(value) || 0;
  if (number >= 80) return "high";
  if (number >= 50) return "medium";
  return "low";
}

function toneClass(value) {
  const number = Number(value) || 0;
  if (number > 0.1) return "is-positive";
  if (number < -0.1) return "is-negative";
  return "is-neutral";
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}

function dateValue(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function imageFingerprint(event) {
  const value = firstImageValue(event);
  if (!value) return "";
  return value.split("?")[0].replace(/\\/g, "/").toLowerCase();
}

function firstImageValue(event) {
  if (!event || typeof event !== "object") return "";
  for (const field of ["image", "image_url", "thumbnail", "thumbnail_url", "urlToImage", "media_url", "og_image"]) {
    const value = event[field];
    const result = typeof value === "object" && value ? stringValue(value.url ?? value.src) : stringValue(value);
    if (result) return result;
  }
  for (const field of ["image_urls", "image_paths", "images"]) {
    const value = Array.isArray(event[field]) ? event[field][0] : event[field];
    const result = typeof value === "object" && value ? stringValue(value.url ?? value.src) : stringValue(value);
    if (result) return result;
  }
  return "";
}

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}
