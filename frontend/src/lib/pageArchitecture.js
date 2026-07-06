const INDEX_DEFINITIONS = [
  { id: "sp500", label: "S&P 500", aliases: ["s&p", "sp500", "^gspc", "spy"] },
  { id: "nasdaq", label: "NASDAQ", aliases: ["nasdaq", "^ixic", "qqq"] },
  { id: "dow", label: "DOW", aliases: ["dow", "^dji", "dia"] },
  { id: "vix", label: "VIX", aliases: ["vix", "^vix"] },
];

export function buildPageArchitecture(report, marketHistory, marketTrends, reportHistory) {
  const source = report && typeof report === "object" ? report : {};
  const events = normalizeEvents(source);
  const snapshot = normalizeSnapshot(source.market_snapshot ?? source.market_data, events);
  const stats = calculateEventStats(events);

  return {
    dashboard: {
      snapshot,
      regime: snapshot.sentiment,
      stats,
      top_signals: [...events]
        .sort((a, b) => b.impact_score - a.impact_score)
        .slice(0, 8)
        .map(({ id, title, impact_score, sentiment_score, one_line_summary, sector, primary_source, timestamp, translations }) => ({
          id,
          title,
          impact_score,
          sentiment_score,
          one_line_summary,
          sector,
          primary_source,
          timestamp,
          translations,
        })),
    },
    event_feed: {
      events: [...events].sort((a, b) => dateValue(b.timestamp) - dateValue(a.timestamp)),
    },
    macro_analysis: normalizeMacro(source),
    market_agent: {
      report_time: source.generated_at ?? source.market_data?.as_of ?? "",
      total_events: stats.total_events,
      sentiment: snapshot.sentiment,
      dominant_theme: stats.dominant_theme,
      top_sector: stats.top_sector,
      data_status: Object.keys(source).length ? "synchronized" : "no data",
    },
    reports: {
      index: reportHistory ?? { reports: [] },
    },
    meta: {
      report_type: source.report_type ?? "latest",
      report_label: source.report_label ?? "Market Intelligence Brief",
      generated_at: source.generated_at ?? source.market_data?.as_of ?? "",
      source_window: source.source_window ?? "Data window unavailable",
      data_freshness_warning: Boolean(source.data_freshness_warning),
    },
  };
}

function normalizeEvents(source) {
  const native = Array.isArray(source.events) ? source.events : [];
  const candidates = native.length
    ? native
    : [...(source.key_events ?? []), ...(source.news_events ?? [])];
  const seen = new Set();

  const newsItems = Array.isArray(source.news_items) ? source.news_items : [];
  return candidates.map((event, index) => normalizeEvent(event, index, newsItems)).filter((event) => {
    if (!event.title) return false;
    const key = event.event_id || event.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeEvent(event, index, newsItems = []) {
  const articles = Array.isArray(event.articles) ? event.articles : [];
  const firstArticle = articles[0] ?? {};
  const matchingNews = findMatchingNewsItem(event, firstArticle, newsItems);
  const sourceNames = stringList(event.source_names).length
    ? stringList(event.source_names)
    : articles.map((article) => text(article.source_name ?? article.source)).filter(Boolean);
  return {
    id: event.id ?? event.event_id ?? `event-${index}`,
    event_id: text(event.event_id),
    title: text(event.title),
    one_line_summary: text(event.one_line_summary ?? event.summary),
    image_url: normalizeImageUrl(firstImage(event, firstArticle, matchingNews)),
    impact_score: bounded(event.impact_score ?? event.market_impact_score, 0, 100),
    sentiment_score: bounded(event.sentiment_score, -1, 1),
    timestamp: text(event.timestamp ?? event.published_at ?? event.detected_at ?? firstArticle.published_at),
    sector: text(event.sector) || "Cross-market",
    event_type: text(event.event_type) || "Market event",
    themes: stringList(event.topics),
    category: classifyEvent(event),
    entities: stringList(event.entities ?? event.keywords),
    tickers: stringList(event.related_tickers ?? event.affected_assets ?? event.affected_markets),
    sources: sourceNames,
    primary_source: text(event.primary_source ?? event.source_name ?? firstArticle.source_name ?? firstArticle.source ?? matchingNews.source_name ?? matchingNews.source) || sourceNames[0] || "",
    source_url: firstUrl(event, firstArticle, matchingNews),
    source_count: Number(event.source_count) || articles.length || 1,
    translations: event.translations ?? {},
  };
}

function calculateEventStats(events) {
  const total = events.length;
  const sum = (key) => events.reduce((value, event) => value + Number(event[key] || 0), 0);
  const categoryCounts = { Macro: 0, Company: 0, Industry: 0, Policy: 0 };
  const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0 };

  for (const event of events) {
    categoryCounts[event.category] += 1;
    if (event.sentiment_score > 0.1) sentimentCounts.Positive += 1;
    else if (event.sentiment_score < -0.1) sentimentCounts.Negative += 1;
    else sentimentCounts.Neutral += 1;
  }

  return {
    total_events: total,
    avg_impact: total ? sum("impact_score") / total : 0,
    avg_sentiment: total ? sum("sentiment_score") / total : 0,
    categories: categoryCounts,
    sentiments: sentimentCounts,
    dominant_theme: dominantValue(
      events.flatMap((event) => event.themes).filter((value) => !isGenericClassification(value)),
      dominantValue(events.map((event) => event.event_type).filter((value) => !isGenericClassification(value)), "Mixed"),
    ),
    top_sector: dominantValue(
      events.map((event) => event.sector).filter((value) => !isGenericClassification(value)),
      "Broad Market",
    ),
  };
}

function isGenericClassification(value) {
  return ["macro", "company", "industry", "policy", "market event", "cross-market"].includes(text(value).toLowerCase());
}

function dominantValue(values, fallback) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function classifyEvent(event) {
  const explicit = text(event.category ?? event.layer).toLowerCase();
  const context = [event.sector, event.event_type, ...(event.topics ?? [])].join(" ").toLowerCase();
  if (explicit.includes("policy") || /policy|regulat|legislation|sec\b|antitrust/.test(context)) return "Policy";
  if (explicit.includes("macro") || /macro|fed|rate|inflation|cpi|nfp|payroll|treasury|geopolit/.test(context)) return "Macro";
  if (explicit.includes("company") || /company|earnings|corporate|merger|layoff|product/.test(context)) return "Company";
  return "Industry";
}

function findMatchingNewsItem(event, firstArticle, newsItems) {
  const eventTitle = comparableTitle(event.title);
  const articleUrl = text(firstArticle.source_url ?? firstArticle.url);
  const eventUrls = stringList(event.source_urls);
  return newsItems.find((item) => {
    const itemUrl = text(item.source_url ?? item.url);
    return (articleUrl && itemUrl === articleUrl)
      || (itemUrl && eventUrls.includes(itemUrl))
      || (eventTitle && comparableTitle(item.title) === eventTitle);
  }) ?? {};
}

function firstImage(...records) {
  const fields = ["image", "image_url", "thumbnail", "thumbnail_url", "urlToImage", "media_url", "og_image", "imageUrl"];
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    for (const field of fields) {
      const value = imageValue(record[field]);
      if (value) return value;
    }
    for (const field of ["image_urls", "image_paths", "images"]) {
      const value = Array.isArray(record[field]) ? record[field][0] : record[field];
      if (text(value)) return value;
    }
  }
  return "";
}

function imageValue(value) {
  if (typeof value === "string") return text(value);
  if (value && typeof value === "object") return text(value.url ?? value.src ?? value.href);
  return "";
}

function firstUrl(event, firstArticle, matchingNews) {
  return [
    stringList(event.source_urls)[0],
    event.source_url,
    event.url,
    firstArticle.source_url,
    firstArticle.url,
    matchingNews.source_url,
    matchingNews.url,
  ].map(text).find(Boolean) ?? "";
}

function normalizeImageUrl(value) {
  const url = text(value).replace(/\\/g, "/");
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("reports/")) return `./data/${url.slice("reports/".length)}`;
  if (url.startsWith("assets/")) return `./data/${url}`;
  return url;
}

function comparableTitle(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeSnapshot(snapshot, events) {
  const source = snapshot && typeof snapshot === "object" ? snapshot : {};
  const rows = Array.isArray(source) ? source : source.indices ?? source.items ?? [];
  const indices = INDEX_DEFINITIONS.map((definition) => {
    const match = rows.find((row) => {
      const haystack = `${row?.name ?? ""} ${row?.symbol ?? ""}`.toLowerCase();
      return definition.aliases.some((alias) => haystack.includes(alias));
    });
    return {
      id: definition.id,
      label: definition.label,
      symbol: text(match?.symbol),
      price: finiteOrNull(match?.price ?? match?.last ?? match?.value),
      change_pct: finiteOrNull(match?.change_pct ?? match?.percent_change),
    };
  });
  const average = events.length
    ? events.reduce((total, event) => total + event.sentiment_score, 0) / events.length
    : 0;
  const sentiment = source.sentiment && typeof source.sentiment === "object"
    ? source.sentiment
    : { score: average, label: average > 0.15 ? "Risk-on" : average < -0.15 ? "Risk-off" : "Mixed" };

  return {
    indices,
    sentiment: {
      score: bounded(sentiment.score, -1, 1),
      label: text(sentiment.label) || "Mixed",
    },
    as_of: text(source.as_of ?? source.updated_at),
  };
}

function normalizeMacro(source) {
  const macro = source.macro_analysis && typeof source.macro_analysis === "object"
    ? source.macro_analysis
    : {};
  return {
    regime: text(macro.regime_explanation ?? source.macro_outlook),
    policy: text(macro.fed_policy ?? macro.policy_outlook),
    inflation: text(macro.inflation_conditions),
    labor: text(macro.labor_conditions),
    liquidity: text(macro.liquidity_conditions),
    indicators: Array.isArray(macro.indicators) ? macro.indicators : [],
  };
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

function dateValue(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
