/**
 * Normalize any supported CodeX report into a stable research context.
 *
 * This module is intentionally independent from reportDerivedData.js so pages
 * can migrate incrementally without changing their existing view models.
 */

export const EMPTY_RESEARCH_CONTEXT = Object.freeze({
  market_state: {
    report_type: "latest",
    report_label: "Market Intelligence Brief",
    generated_at: "",
    market_session: "",
    source_window: "",
    headline: "",
    summary: "",
    regime: "",
    stance: "",
    sentiment: "Mixed",
    sentiment_score: 0,
    confidence: null,
    index_performance_summary: "",
  },
  market_snapshot: { as_of: "", status: "", items: [], sentiment: null },
  drivers: [],
  risks: [],
  events: [],
  macro_themes: [],
  asset_view: {
    equities: emptyAsset("US Equities"),
    rates: emptyAsset("Rates"),
    growth_stocks: emptyAsset("Growth Stocks"),
    financials: emptyAsset("Financials"),
    sectors: { positive: [], negative: [] },
  },
  watch_next: { macro_data: [], policy: [], company_events: [], general: [] },
  sources: [],
});

export function buildResearchContext(report) {
  const source = object(report);
  if (!Object.keys(source).length) return cloneEmptyContext();

  const events = selectEvents(source).map(normalizeEvent).filter((event) => event.title);
  const drivers = normalizeDrivers(source, events);
  const macro = object(source.macro_analysis);
  const marketRegime = object(macro.market_regime);
  const sentimentScore = marketSentimentScore(source, events);

  return {
    market_state: {
      report_type: text(source.report_type) || "latest",
      report_label: text(source.report_label) || "Market Intelligence Brief",
      generated_at: text(source.generated_at ?? source.market_data?.as_of ?? source.market_snapshot?.as_of),
      market_session: text(source.market_session),
      source_window: text(source.source_window),
      headline: text(source.dynamic_headline ?? source.market_narrative?.headline),
      summary: text(source.market_summary ?? source.market_narrative?.summary),
      regime: text(marketRegime.title ?? source.market_regime?.title ?? source.market_regime),
      stance: text(marketRegime.stance ?? source.market_stance),
      sentiment: text(source.market_snapshot?.sentiment?.label ?? source.market_data?.sentiment?.label) || sentimentLabel(sentimentScore),
      sentiment_score: sentimentScore,
      confidence: normalizeConfidence(marketRegime.confidence ?? source.confidence_score),
      index_performance_summary: text(source.index_performance_summary),
    },
    market_snapshot: normalizeMarketSnapshot(source.market_snapshot ?? source.market_data),
    drivers,
    risks: normalizeRisks(source, events),
    events,
    macro_themes: normalizeMacroThemes(source, drivers),
    asset_view: normalizeAssetView(source),
    watch_next: normalizeWatchNext(source),
    sources: normalizeSources(source, events),
  };
}

export function hasResearchContext(context) {
  const value = object(context);
  return Boolean(
    value.market_state?.summary ||
    value.events?.length ||
    value.drivers?.length ||
    value.macro_themes?.length,
  );
}

function selectEvents(report) {
  const candidates = [report.events, report.key_events, report.news_events];
  const preferred = candidates.find((value) => Array.isArray(value) && value.length) ?? [];
  const seen = new Set();
  return preferred.filter((event) => {
    if (!event || typeof event !== "object") return false;
    const key = text(event.event_id ?? event.id ?? event.title).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeEvent(value, index) {
  const event = object(value);
  const articles = array(event.articles).map(object);
  const sources = unique([
    ...strings(event.source_names),
    ...articles.map((item) => text(item.source_name ?? item.source)),
    text(event.primary_source?.name),
  ]);
  const sourceUrls = unique([
    ...strings(event.source_urls),
    ...articles.map((item) => text(item.source_url ?? item.url)),
    text(event.primary_source?.url),
  ]);
  return {
    id: text(event.event_id ?? event.id) || `event-${index + 1}`,
    title: text(event.title),
    title_zh: localized(event, "title"),
    summary: text(event.one_line_summary ?? event.summary),
    summary_zh: localized(event, "summary"),
    why_it_matters: text(event.why_it_matters),
    why_it_matters_zh: localized(event, "why_it_matters"),
    sector: text(event.sector) || "Cross-market",
    event_type: text(event.event_type ?? event.category) || "Market event",
    themes: unique(strings(event.topics ?? event.themes)),
    tickers: unique(strings(event.related_tickers ?? event.tickers)),
    entities: unique(strings(event.entities)),
    affected_markets: unique(strings(event.affected_markets)),
    impact_score: bounded(event.impact_score ?? event.market_impact_score ?? event.final_score, 0, 100),
    sentiment_score: bounded(event.sentiment_score, -1, 1),
    confidence_score: nullableBounded(event.confidence_score, 0, 100),
    priority: text(event.priority_level) || priorityLabel(event.market_impact_score ?? event.impact_score),
    time_horizon: text(event.time_horizon),
    published_at: text(event.published_at ?? event.primary_source?.published_at),
    sources,
    source_urls: sourceUrls,
  };
}

function normalizeDrivers(report, events) {
  const explicit = array(report.key_drivers ?? report.drivers)
    .filter(isObject)
    .map((value, index) => {
      const driver = object(value);
      return {
        id: text(driver.id) || `driver-${index + 1}`,
        name: text(driver.name ?? driver.title ?? driver.label) || `Driver ${index + 1}`,
        name_zh: localized(driver, "name") || localized(driver, "title"),
        explanation: text(driver.explanation ?? driver.summary ?? driver.current_view),
        explanation_zh: localized(driver, "explanation") || localized(driver, "summary"),
        importance_score: bounded(driver.importance_score ?? driver.impact_score, 0, 100),
        direction: normalizeDirection(driver.direction ?? driver.stance ?? driver.signal),
        affected_assets: unique(strings(driver.affected_assets ?? driver.affected_markets)),
        evidence_event_ids: unique(strings(driver.evidence_event_ids)),
      };
    });
  if (explicit.length) return explicit;
  return events.slice(0, 5).map((event, index) => ({
    id: `event-driver-${index + 1}`,
    name: event.title,
    name_zh: event.title_zh,
    explanation: event.why_it_matters || event.summary,
    explanation_zh: event.why_it_matters_zh || event.summary_zh,
    importance_score: event.impact_score,
    direction: event.sentiment_score > 0.1 ? "positive" : event.sentiment_score < -0.1 ? "negative" : "mixed",
    affected_assets: event.affected_markets,
    evidence_event_ids: [event.id],
  }));
}

function normalizeRisks(report, events) {
  const macro = object(report.macro_analysis);
  const explicit = array(macro.risks ?? report.risks ?? report.risk_factors);
  const risks = explicit.map((value, index) => normalizeRisk(value, index)).filter((risk) => risk.title);
  if (risks.length) return risks;

  const negativeEvents = events.filter((event) => event.sentiment_score < -0.1).slice(0, 5);
  if (negativeEvents.length) {
    return negativeEvents.map((event, index) => ({
      id: `event-risk-${index + 1}`,
      title: event.title,
      title_zh: event.title_zh,
      description: event.why_it_matters || event.summary,
      description_zh: event.why_it_matters_zh || event.summary_zh,
      level: event.impact_score >= 80 ? "high" : event.impact_score >= 50 ? "medium" : "low",
      affected_assets: event.affected_markets,
      evidence_event_ids: [event.id],
    }));
  }

  const narrative = text(report.risk_and_sentiment);
  return narrative ? [{ id: "report-risk-1", title: "Risk & Sentiment", title_zh: "风险与情绪", description: narrative, description_zh: localized(object(report.translations?.zh), "risk_and_sentiment"), level: "medium", affected_assets: [], evidence_event_ids: [] }] : [];
}

function normalizeRisk(value, index) {
  if (typeof value === "string") return { id: `risk-${index + 1}`, title: value, title_zh: "", description: "", description_zh: "", level: "medium", affected_assets: [], evidence_event_ids: [] };
  const risk = object(value);
  return {
    id: text(risk.id) || `risk-${index + 1}`,
    title: text(risk.title ?? risk.name ?? risk.label),
    title_zh: localized(risk, "title") || localized(risk, "name"),
    description: text(risk.description ?? risk.analysis ?? risk.why_it_matters),
    description_zh: localized(risk, "description") || localized(risk, "why_it_matters"),
    level: normalizeLevel(risk.level ?? risk.severity ?? risk.priority),
    affected_assets: unique(strings(risk.affected_assets ?? risk.affected_markets)),
    evidence_event_ids: unique(strings(risk.evidence_event_ids)),
  };
}

function normalizeMacroThemes(report, drivers) {
  const explicit = array(report.macro_analysis?.themes ?? report.macro_themes)
    .filter(isObject)
    .map((value, index) => {
      const theme = object(value);
      const impact = object(theme.market_impact);
      return {
        id: text(theme.id) || `macro-theme-${index + 1}`,
        title: text(theme.title ?? theme.name),
        title_zh: localized(theme, "title") || localized(theme, "name"),
        current_view: text(theme.current_view ?? theme.summary),
        current_view_zh: localized(theme, "current_view") || localized(theme, "summary"),
        what_changed: text(theme.what_changed),
        what_changed_zh: localized(theme, "what_changed"),
        why_it_matters: text(theme.why_it_matters),
        why_it_matters_zh: localized(theme, "why_it_matters"),
        market_impact: {
          equities: text(impact.equities),
          rates: text(impact.rates),
          sectors: unique(strings(impact.sectors)),
        },
        watch_next: unique(strings(theme.watch_next)),
      };
    })
    .filter((theme) => theme.title);
  if (explicit.length) return explicit;

  return drivers.filter((driver) => macroLike(driver.name)).slice(0, 4).map((driver, index) => ({
    id: `derived-macro-theme-${index + 1}`,
    title: driver.name,
    title_zh: driver.name_zh,
    current_view: driver.explanation,
    current_view_zh: driver.explanation_zh,
    what_changed: "",
    what_changed_zh: "",
    why_it_matters: driver.explanation,
    why_it_matters_zh: driver.explanation_zh,
    market_impact: { equities: "", rates: "", sectors: driver.affected_assets },
    watch_next: [],
  }));
}

function normalizeAssetView(report) {
  const explicit = object(report.macro_analysis?.asset_view ?? report.macro_analysis?.market_impact ?? report.asset_view);
  const rawSectors = explicit.sectors ?? report.sector_theme_impact;
  const sectorImpact = Array.isArray(rawSectors) ? object(rawSectors[0]) : object(rawSectors);
  return {
    equities: normalizeAsset("US Equities", explicit.equities ?? explicit.us_equities),
    rates: normalizeAsset("Rates", explicit.rates),
    growth_stocks: normalizeAsset("Growth Stocks", explicit.growth_stocks ?? explicit.growth),
    financials: normalizeAsset("Financials", explicit.financials),
    sectors: {
      positive: unique(strings(sectorImpact.positive ?? sectorImpact.winners)),
      negative: unique(strings(sectorImpact.negative ?? sectorImpact.losers)),
    },
  };
}

function normalizeMarketSnapshot(value) {
  const snapshot = object(value);
  const rows = Array.isArray(value) ? value : array(snapshot.items ?? snapshot.indices);
  const sentiment = object(snapshot.sentiment);
  return {
    as_of: text(snapshot.as_of ?? snapshot.updated_at),
    status: text(snapshot.status),
    items: rows.slice(0, 12).map((item) => {
      const row = object(item);
      return {
        name: text(row.name ?? row.label),
        symbol: text(row.symbol),
        price: nullableNumber(row.price ?? row.last ?? row.value),
        change: nullableNumber(row.change),
        change_pct: nullableNumber(row.change_pct ?? row.percent_change),
      };
    }),
    sentiment: Object.keys(sentiment).length ? {
      label: text(sentiment.label),
      score: nullableBounded(sentiment.score, -1, 1),
    } : null,
  };
}

function normalizeAsset(label, value) {
  if (typeof value === "string") return { label, stance: normalizeDirection(value), view: value, reason: value };
  const asset = object(value);
  return {
    label: text(asset.label) || label,
    stance: text(asset.stance ?? asset.direction ?? asset.view),
    view: text(asset.view ?? asset.summary ?? asset.note),
    reason: text(asset.reason ?? asset.rationale ?? asset.note ?? asset.summary),
  };
}

function normalizeWatchNext(report) {
  const macroWatch = object(report.macro_analysis?.watch_next);
  const legacy = array(report.what_to_watch_tomorrow ?? report.watch_next);
  return {
    macro_data: unique(strings(macroWatch.macro_data)),
    policy: unique(strings(macroWatch.policy)),
    company_events: unique(strings(macroWatch.company_events)),
    general: unique([
      ...strings(macroWatch.general),
      ...legacy.map((item) => typeof item === "string" ? item : text(item?.item ?? item?.title ?? item?.why_it_matters)),
      ...strings(report.market_narrative?.watch_next),
    ]),
  };
}

function normalizeSources(report, events) {
  const rows = new Map();
  events.forEach((event) => {
    event.sources.forEach((name, index) => {
      const url = event.source_urls[index] || "";
      const key = `${name.toLowerCase()}|${url}`;
      const current = rows.get(key) ?? { name, url, event_count: 0, event_ids: [] };
      current.event_count += 1;
      current.event_ids.push(event.id);
      rows.set(key, current);
    });
  });
  array(report.sources).filter(isObject).forEach((value) => {
    const item = object(value);
    const name = text(item.name ?? item.source_name);
    const url = text(item.url ?? item.source_url);
    if (name) rows.set(`${name.toLowerCase()}|${url}`, { name, url, event_count: number(item.event_count), event_ids: strings(item.event_ids) });
  });
  return [...rows.values()].map((item) => ({ ...item, event_ids: unique(item.event_ids) })).sort((a, b) => b.event_count - a.event_count || a.name.localeCompare(b.name));
}

function cloneEmptyContext() {
  return {
    market_state: { ...EMPTY_RESEARCH_CONTEXT.market_state },
    market_snapshot: { as_of: "", status: "", items: [], sentiment: null },
    drivers: [], risks: [], events: [], macro_themes: [],
    asset_view: { equities: emptyAsset("US Equities"), rates: emptyAsset("Rates"), growth_stocks: emptyAsset("Growth Stocks"), financials: emptyAsset("Financials"), sectors: { positive: [], negative: [] } },
    watch_next: { macro_data: [], policy: [], company_events: [], general: [] }, sources: [],
  };
}

function emptyAsset(label) { return { label, stance: "", view: "", reason: "" }; }
function localized(value, field) { const item = object(value); return text(item[`${field}_zh`] ?? item.translations?.zh?.[field] ?? item.zh?.[field]); }
function marketSentimentScore(report, events) { const explicit = nullableNumber(report.market_snapshot?.sentiment?.score ?? report.market_data?.sentiment?.score); if (explicit != null) return Math.max(-1, Math.min(1, explicit)); const values = events.map((event) => event.sentiment_score).filter(Number.isFinite); return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3)) : 0; }
function sentimentLabel(value) { return value > 0.1 ? "Risk-on" : value < -0.1 ? "Risk-off" : "Mixed"; }
function normalizeDirection(value) { const direction = text(value).toLowerCase(); if (/positive|bullish|constructive|upside|risk-on/.test(direction)) return "positive"; if (/negative|bearish|cautious|downside|risk-off/.test(direction)) return "negative"; return direction ? "mixed" : ""; }
function normalizeLevel(value) { const level = text(value).toLowerCase(); if (/critical|high|severe/.test(level)) return "high"; if (/low|minor/.test(level)) return "low"; return "medium"; }
function priorityLabel(value) { const score = number(value); return score >= 80 ? "High" : score >= 50 ? "Medium" : "Low"; }
function normalizeConfidence(value) { const numeric = nullableNumber(value); if (numeric != null) return Math.max(0, Math.min(100, numeric)); const label = text(value).toLowerCase(); if (label === "high") return 80; if (label === "moderate" || label === "medium") return 60; if (label === "low") return 35; return null; }
function macroLike(value) { return /fed|rate|inflation|growth|labor|econom|policy|geopolit|oil|treasury|yield/i.test(text(value)); }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function isObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function text(value) { return value == null ? "" : String(value).trim(); }
function strings(value) { if (Array.isArray(value)) return value.map((item) => text(typeof item === "object" ? item.name ?? item.title ?? item.label ?? item.value : item)).filter(Boolean); if (typeof value === "string") return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean); return []; }
function unique(values) { return [...new Set(values.map(text).filter(Boolean))]; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function nullableNumber(value) { const parsed = Number(value); return value != null && value !== "" && Number.isFinite(parsed) ? parsed : null; }
function bounded(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, number(value))); }
function nullableBounded(value, minimum, maximum) { const parsed = nullableNumber(value); return parsed == null ? null : Math.max(minimum, Math.min(maximum, parsed)); }
