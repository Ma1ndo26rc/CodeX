const TARGET_INDICES = [
  { id: "sp500", label: "S&P 500", aliases: ["s&p", "sp500", "^gspc", "spy"] },
  { id: "nasdaq", label: "NASDAQ", aliases: ["nasdaq", "^ixic", "qqq"] },
  { id: "dow", label: "DOW", aliases: ["dow", "^dji", "dia"] },
  { id: "vix", label: "VIX", aliases: ["vix", "^vix"] },
];

export function buildDashboardSchema(report) {
  const source = report && typeof report === "object" ? report : {};
  const sourceEvents = nativeSignals(source).length
    ? nativeSignals(source)
    : uniqueEvents([...(source.key_events ?? []), ...(source.news_events ?? [])]);
  const topSignals = sourceEvents
    .map(normalizeSignal)
    .filter((signal) => signal.title)
    .sort((a, b) => b.impact_score - a.impact_score)
    .slice(0, 5);

  return {
    market_snapshot: normalizeMarketSnapshot(source.market_snapshot ?? source.market_data, topSignals),
    top_signals: topSignals,
    event_clusters: normalizeClusters(source, sourceEvents),
    raw_news: normalizeRawNews(source.raw_news ?? source.news_items ?? []),
    meta: {
      report_type: source.report_type ?? "latest",
      report_label: source.report_label ?? "Market Intelligence Brief",
      generated_at: source.generated_at ?? source.market_data?.as_of ?? "",
      source_window: source.source_window ?? "Data window unavailable",
      data_freshness_warning: Boolean(source.data_freshness_warning),
      dynamic_headline: source.dynamic_headline ?? "Market signals awaiting confirmation",
      translations: source.translations ?? {},
    },
  };
}

function nativeSignals(source) {
  return Array.isArray(source.top_signals) ? source.top_signals : [];
}

function normalizeSignal(event, index) {
  const impact = bounded(event.impact_score ?? event.market_impact_score, 0, 100);
  const sentiment = bounded(event.sentiment_score, -1, 1);
  const confidence = bounded(event.confidence_score ?? event.source_quality_score, 0, 100);
  const affectedAssets = stringList(event.affected_assets ?? event.affected_markets ?? event.related_tickers);
  const sector = text(event.sector) || "Cross-market";
  const eventType = text(event.event_type) || "Market signal";
  return {
    ...event,
    id: event.id ?? event.event_id ?? `${slug(event.title)}-${index ?? 0}`,
    title: text(event.title),
    sector,
    event_type: eventType,
    time_horizon: text(event.time_horizon) || "Near term",
    impact_score: impact,
    sentiment_score: sentiment,
    confidence_score: confidence,
    one_line_summary: text(event.one_line_summary ?? event.summary) || "Signal summary unavailable.",
    why_it_matters: text(event.why_it_matters) || "Investment significance requires further confirmation.",
    transmission_path: text(event.transmission_path) || buildTransmissionPath(eventType, sector, affectedAssets),
    affected_assets: affectedAssets,
    translations: event.translations ?? {},
  };
}

function normalizeMarketSnapshot(snapshot, signals) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const keyedRows = TARGET_INDICES.flatMap((target) => {
    const value = source[target.id] ?? source[target.label] ?? source[target.label.toLowerCase()];
    return value && typeof value === "object" ? [{ ...value, name: value.name ?? target.label }] : [];
  });
  const rows = Array.isArray(source) ? source : source.indices ?? source.items ?? keyedRows;
  const indices = TARGET_INDICES.map((target) => {
    const match = rows.find((row) => {
      const haystack = `${row?.name ?? ""} ${row?.symbol ?? ""}`.toLowerCase();
      return target.aliases.some((alias) => haystack.includes(alias));
    });
    return {
      id: target.id,
      label: target.label,
      symbol: match?.symbol ?? "",
      price: finiteOrNull(match?.price ?? match?.last ?? match?.value),
      change_pct: finiteOrNull(match?.change_pct ?? match?.percent_change),
    };
  });
  const averageSentiment = signals.length
    ? signals.reduce((sum, signal) => sum + signal.sentiment_score, 0) / signals.length
    : 0;
  const sentiment = source.sentiment && typeof source.sentiment === "object"
    ? source.sentiment
    : {
        score: Number(averageSentiment.toFixed(2)),
        label: averageSentiment > 0.15 ? "Risk-on" : averageSentiment < -0.15 ? "Risk-off" : "Mixed",
      };
  return {
    indices,
    sentiment: {
      score: bounded(sentiment.score, -1, 1),
      label: text(sentiment.label) || "Mixed",
    },
    as_of: source.as_of ?? source.updated_at ?? "",
  };
}

function normalizeClusters(source, sourceEvents) {
  if (Array.isArray(source.event_clusters)) {
    return source.event_clusters.map((cluster, index) => ({
      id: cluster.id ?? `cluster-${index}`,
      title: text(cluster.title ?? cluster.name) || `Cluster ${index + 1}`,
      description: text(cluster.description ?? cluster.explanation),
      events: (cluster.events ?? cluster.included_events ?? []).map(normalizeClusterEvent).filter((event) => event.title),
      translations: cluster.translations ?? {},
    }));
  }

  const events = uniqueEvents(sourceEvents).map(normalizeSignal);
  const themes = Array.isArray(source.todays_themes) ? source.todays_themes : [];
  if (themes.length) {
    return themes.slice(0, 6).map((theme, index) => {
      const title = text(theme.name) || `Theme ${index + 1}`;
      const relatedTitles = stringList(theme.related_events).map((value) => value.toLowerCase());
      const included = events.filter((event) => {
        const topics = stringList(event.topics).map((value) => value.toLowerCase());
        return relatedTitles.some((value) => event.title.toLowerCase().includes(value) || value.includes(event.title.toLowerCase()))
          || topics.some((topic) => title.toLowerCase().includes(topic) || topic.includes(title.toLowerCase()));
      });
      return {
        id: `theme-${index}`,
        title,
        description: text(theme.explanation),
        events: (included.length ? included : events.slice(index, index + 2)).map(normalizeClusterEvent),
        translations: theme.translations ?? {},
      };
    });
  }

  const grouped = new Map();
  for (const event of events) {
    const group = stringList(event.topics)[0] || event.sector || "Cross-market";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(normalizeClusterEvent(event));
  }
  return [...grouped.entries()].slice(0, 6).map(([title, groupedEvents], index) => ({
    id: `derived-${index}`,
    title,
    description: `${groupedEvents.length} related market signal${groupedEvents.length === 1 ? "" : "s"}.`,
    events: groupedEvents,
    translations: {},
  }));
}

function normalizeClusterEvent(event) {
  if (typeof event === "string") {
    return {
      id: slug(event),
      title: text(event),
      one_line_summary: "",
      impact_score: 0,
      sentiment_score: 0,
      translations: {},
    };
  }
  return {
    id: event.id ?? event.event_id ?? slug(event.title),
    title: text(event.title),
    one_line_summary: text(event.one_line_summary ?? event.summary),
    impact_score: bounded(event.impact_score ?? event.market_impact_score, 0, 100),
    sentiment_score: bounded(event.sentiment_score, -1, 1),
    translations: event.translations ?? {},
  };
}

function normalizeRawNews(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: item.id ?? `${slug(item.title)}-${index}`,
      title: text(item.title),
      source: text(item.source ?? item.source_name) || "Unknown source",
      source_url: text(item.source_url ?? item.link ?? item.url),
      published_at: text(item.published_at),
      translations: item.translations ?? {},
    }))
    .filter((item) => item.title)
    .sort((a, b) => Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0));
}

function uniqueEvents(events) {
  const seen = new Set();
  return (Array.isArray(events) ? events : []).filter((event) => {
    const key = text(event?.event_id ?? event?.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTransmissionPath(eventType, sector, assets) {
  return [eventType, sector, assets.slice(0, 3).join(" / ") || "risk appetite"].join(" -> ");
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function bounded(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function slug(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "signal";
}
