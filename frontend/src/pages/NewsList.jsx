import { Clock3, ExternalLink, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { PageHeading, EmptyState } from "./DecisionDashboard.jsx";
import { formatTimestamp } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";
import NewsThumbnail from "../components/NewsThumbnail.jsx";

export default function NewsList({ model }) {
  const { language, localized } = useLanguage();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("latest");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const events = [...(model?.events ?? [])]
    .filter((event) => !deferredQuery || factualText(event).includes(deferredQuery))
    .sort(sort === "impact"
      ? (a, b) => b.impact_score - a.impact_score
      : (a, b) => dateValue(b.timestamp) - dateValue(a.timestamp));

  return (
    <>
      <PageHeading eyebrow="INFORMATION LAYER" title="Event Feed" subtitle="Detected market events with factual metadata only. No interpretation or transmission analysis." />
      <div className="pa-feed-controls">
        <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, ticker, entity or source" /></label>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort events">
          <option value="latest">Latest first</option>
          <option value="impact">Highest score</option>
        </select>
        <span>{events.length} EVENTS</span>
      </div>
      <section className="pa-event-feed">
        {events.map((event) => (
          <article key={event.id} className="pa-event-row">
            <NewsThumbnail src={event.image_url} alt="" source={event.primary_source || event.sources[0]} />
            <div className="pa-event-story">
              <div className="pa-event-byline">
                <strong>{event.primary_source || event.sources[0] || "Source unavailable"}</strong>
                <time><Clock3 size={12} />{event.timestamp ? formatTimestamp(event.timestamp, language) : "Time unavailable"}</time>
                <span>{event.sector}</span>
              </div>
              {event.source_url ? (
                <a className="pa-event-headline" href={event.source_url} target="_blank" rel="noreferrer">{localized(event, "title") || event.title}</a>
              ) : <h2>{localized(event, "title") || event.title}</h2>}
              <p className="pa-event-summary">{localized(event, "one_line_summary") || localized(event, "summary") || event.one_line_summary || "Summary unavailable."}</p>
            </div>
            <div className="pa-event-score"><span>IMPACT</span><strong>{Math.round(event.impact_score)}</strong></div>
            {event.source_url && <a className="pa-event-open" href={event.source_url} target="_blank" rel="noreferrer" aria-label={`Open ${event.title}`}><ExternalLink size={15} /></a>}
          </article>
        ))}
        {!events.length && <EmptyState text="No events match the current filter." />}
      </section>
    </>
  );
}

function factualText(event) {
  return [event.title, event.sector, event.event_type, ...event.tickers, ...event.entities, ...event.sources].join(" ").toLowerCase();
}

function dateValue(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
