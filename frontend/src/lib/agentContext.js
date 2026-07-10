export function buildAgentContext(reportData) {
  const report = reportData && typeof reportData === "object" ? reportData : {};
  const events = selectEvents(report).slice(0, 10).map(normalizeContextEvent);
  const allSources = new Set(events.flatMap((event) => event.sources));
  const sentiments = events.map((event) => event.sentiment_score).filter(Number.isFinite);
  const averageSentiment = sentiments.length
    ? sentiments.reduce((sum, value) => sum + value, 0) / sentiments.length
    : 0;
  const snapshot = normalizeSnapshot(report.market_snapshot ?? report.market_data);

  return {
    has_data: Object.keys(report).length > 0,
    report_time: text(report.generated_at ?? report.market_data?.as_of),
    market_summary: text(report.market_summary),
    index_performance_summary: text(report.index_performance_summary),
    macro_outlook: text(report.macro_outlook),
    risk_and_sentiment: text(report.risk_and_sentiment),
    key_events: events,
    top_signals: [...events].sort((a, b) => b.impact_score - a.impact_score).slice(0, 3),
    market_snapshot: snapshot,
    source_count: allSources.size,
    news_count: Array.isArray(report.news_items) ? report.news_items.length : events.length,
    total_events: selectEvents(report).length,
    market_sentiment: snapshot.sentiment?.label || sentimentLabel(averageSentiment),
    sentiment_score: snapshot.sentiment?.score ?? Number(averageSentiment.toFixed(2)),
    dominant_theme: dominant(events.flatMap((event) => event.themes), "Mixed"),
    top_sector: dominant(events.map((event) => event.sector).filter((value) => !["Macro", "Cross-market"].includes(value)), "Broad Market"),
  };
}

function selectEvents(report) {
  const native = Array.isArray(report.events) ? report.events : [];
  const ranked = Array.isArray(report.key_events) ? report.key_events : [];
  const detected = Array.isArray(report.news_events) ? report.news_events : [];
  const rows = native.length ? native : [...ranked, ...detected];
  const seen = new Set();
  return rows.filter((event) => {
    const key = text(event?.event_id ?? event?.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeContextEvent(event) {
  const articles = Array.isArray(event.articles) ? event.articles : [];
  const sources = list(event.source_names).length
    ? list(event.source_names)
    : articles.map((article) => text(article.source_name ?? article.source)).filter(Boolean);
  return {
    title: text(event.title),
    title_zh: text(event.title_zh ?? event.translations?.zh?.title),
    zh_title: text(event.zh_title),
    translated_title: text(event.translated_title),
    summary: text(event.one_line_summary ?? event.summary),
    summary_zh: text(event.summary_zh ?? event.translations?.zh?.summary),
    zh_summary: text(event.zh_summary),
    translated_summary: text(event.translated_summary),
    sector: text(event.sector) || "Cross-market",
    impact_score: number(event.impact_score ?? event.market_impact_score),
    sentiment_score: bounded(event.sentiment_score, -1, 1),
    themes: list(event.topics),
    sources: [...new Set(sources)].slice(0, 4),
  };
}

function normalizeSnapshot(value) {
  const source = value && typeof value === "object" ? value : {};
  const rows = Array.isArray(source) ? source : source.indices ?? source.items ?? [];
  return {
    as_of: text(source.as_of ?? source.updated_at),
    items: rows.slice(0, 8).map((item) => ({
      name: text(item.name ?? item.label),
      symbol: text(item.symbol),
      price: nullableNumber(item.price ?? item.last ?? item.value),
      change_pct: nullableNumber(item.change_pct ?? item.percent_change),
    })),
    sentiment: source.sentiment && typeof source.sentiment === "object"
      ? { label: text(source.sentiment.label), score: bounded(source.sentiment.score, -1, 1) }
      : null,
  };
}

function dominant(values, fallback) {
  const ignored = new Set(["macro", "company", "industry", "policy"]);
  const counts = new Map();
  for (const value of values.map(text).filter(Boolean)) {
    if (ignored.has(value.toLowerCase())) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function sentimentLabel(value) {
  return value > 0.1 ? "Risk-on" : value < -0.1 ? "Risk-off" : "Mixed";
}

function list(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bounded(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, number(value)));
}
