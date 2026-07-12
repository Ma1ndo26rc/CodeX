const LIMITS = { events: 8, drivers: 6, risks: 6, themes: 4 };

export function retrieveAgentContext(question, analysisType, researchContext) {
  const context = object(researchContext);
  const type = normalizeType(analysisType);
  const terms = queryTerms(question);
  const events = array(context.events ?? context.key_events);
  const drivers = array(context.drivers);
  const risks = array(context.risks);
  const themes = array(context.macro_themes);

  let relevantEvents = [];
  let relevantDrivers = [];
  let relevantRisks = [];
  let relevantThemes = [];

  if (type === "company") {
    relevantEvents = rank(events, terms, companySearchText).slice(0, LIMITS.events);
    const companySectors = unique(relevantEvents.map((event) => event.sector));
    relevantDrivers = rank(drivers, [...terms, ...companySectors.map(lower)], driverSearchText).slice(0, LIMITS.drivers);
    relevantRisks = linkedRisks(risks, relevantEvents, terms).slice(0, LIMITS.risks);
    relevantThemes = rank(themes, [...terms, ...companySectors.map(lower)], themeSearchText).slice(0, 2);
  } else if (type === "sector") {
    relevantEvents = rank(events, terms, eventSearchText).slice(0, LIMITS.events);
    const sectors = unique(relevantEvents.map((event) => event.sector));
    relevantThemes = rank(themes, [...terms, ...sectors.map(lower)], themeSearchText).slice(0, LIMITS.themes);
    relevantDrivers = rank(drivers, [...terms, ...sectors.map(lower)], driverSearchText).slice(0, LIMITS.drivers);
    relevantRisks = linkedRisks(risks, relevantEvents, [...terms, ...sectors.map(lower)]).slice(0, LIMITS.risks);
  } else if (type === "macro") {
    relevantThemes = rank(themes, terms, themeSearchText, true).slice(0, LIMITS.themes);
    relevantRisks = rank(risks, terms, riskSearchText, true).slice(0, LIMITS.risks);
    relevantEvents = rank(events, [...terms, "macro", "policy", "rates", "fed"], eventSearchText).slice(0, 5);
    relevantDrivers = rank(drivers, terms, driverSearchText, true).slice(0, LIMITS.drivers);
  } else {
    relevantDrivers = [...drivers].sort(byImportance).slice(0, LIMITS.drivers);
    relevantRisks = [...risks].sort(bySeverity).slice(0, LIMITS.risks);
    relevantEvents = [...events].sort(byImpact).slice(0, 5);
    relevantThemes = themes.slice(0, 2);
  }

  return {
    relevant_events: relevantEvents,
    relevant_drivers: relevantDrivers,
    relevant_risks: relevantRisks,
    relevant_themes: relevantThemes,
    relevance_score: relevanceScore({ type, terms, relevantEvents, relevantDrivers, relevantRisks, relevantThemes }),
  };
}

export function buildRetrievedResearchContext(researchContext, retrieval) {
  const source = object(researchContext);
  const result = object(retrieval);
  const events = array(result.relevant_events);
  const drivers = array(result.relevant_drivers);
  const risks = array(result.relevant_risks);
  const themes = array(result.relevant_themes);
  const eventSourceNames = new Set(events.flatMap((event) => array(event.sources)));
  const sources = array(source.sources).filter((item) => eventSourceNames.has(item?.name));
  const topSignals = [...events].sort(byImpact).slice(0, 3);
  return {
    market_state: source.market_state ?? {},
    market_snapshot: source.market_snapshot ?? {},
    drivers,
    risks,
    events,
    macro_themes: themes,
    asset_view: source.asset_view ?? {},
    watch_next: source.watch_next ?? {},
    sources,
    retrieval: result,
    has_data: Boolean(source.has_data ?? (events.length || drivers.length || themes.length)),
    report_time: source.report_time ?? source.market_state?.generated_at ?? "",
    market_summary: source.market_summary ?? source.market_state?.summary ?? "",
    key_events: events,
    top_signals: topSignals,
    total_events: events.length,
    source_count: sources.length,
    market_sentiment: source.market_sentiment ?? source.market_state?.sentiment ?? "Mixed",
    sentiment_score: source.sentiment_score ?? source.market_state?.sentiment_score ?? 0,
    dominant_theme: themes[0]?.title ?? source.dominant_theme ?? "Mixed",
    top_sector: dominant(events.map((event) => event.sector), source.top_sector ?? "Broad Market"),
  };
}

function rank(items, terms, searchText, includeUnmatched = false) {
  return items
    .map((item) => ({ item, score: matchScore(searchText(item), terms) }))
    .filter((row) => includeUnmatched || row.score > 0)
    .sort((a, b) => b.score - a.score || itemWeight(b.item) - itemWeight(a.item))
    .map((row) => row.item);
}

function linkedRisks(risks, events, terms) {
  const eventIds = new Set(events.map((event) => event.id));
  return risks
    .map((risk) => ({ risk, linked: array(risk.evidence_event_ids).some((id) => eventIds.has(id)), score: matchScore(riskSearchText(risk), terms) }))
    .filter((row) => row.linked || row.score > 0)
    .sort((a, b) => Number(b.linked) - Number(a.linked) || b.score - a.score || bySeverity(a.risk, b.risk))
    .map((row) => row.risk);
}

function relevanceScore({ type, terms, relevantEvents, relevantDrivers, relevantRisks, relevantThemes }) {
  const matched = relevantEvents.length * 4 + relevantDrivers.length * 3 + relevantRisks.length * 2 + relevantThemes.length * 3;
  const typeBase = type === "market_summary" ? 28 : terms.length ? 18 : 8;
  const evidenceBonus = Math.min(20, relevantEvents.flatMap((event) => array(event.sources)).length * 2);
  return Math.max(0, Math.min(100, Math.round(typeBase + matched + evidenceBonus)));
}

function queryTerms(value) {
  const expanded = lower(value)
    .replaceAll("英伟达", " nvidia nvda ")
    .replaceAll("半导体", " semiconductor chips ")
    .replaceAll("美联储", " fed rates policy ")
    .replaceAll("降息", " rate cuts easing ")
    .replaceAll("科技", " technology tech ");
  return unique(expanded.split(/[^a-z0-9\u4e00-\u9fff]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term)));
}

function companySearchText(item) { return lower([item.title, item.summary, item.sector, ...array(item.tickers), ...array(item.entities), ...array(item.themes)].join(" ")); }
function eventSearchText(item) { return lower([companySearchText(item), item.why_it_matters, item.event_type, ...array(item.affected_markets)].join(" ")); }
function driverSearchText(item) { return lower([item.name, item.explanation, item.direction, ...array(item.affected_assets)].join(" ")); }
function riskSearchText(item) { return lower([item.title, item.description, item.level, ...array(item.affected_assets)].join(" ")); }
function themeSearchText(item) { return lower([item.title, item.current_view, item.what_changed, item.why_it_matters, item.market_impact?.equities, item.market_impact?.rates, ...array(item.market_impact?.sectors)].join(" ")); }
function matchScore(text, terms) { return terms.reduce((score, term) => score + (text.includes(term) ? (term.length > 4 ? 3 : 2) : 0), 0); }
function itemWeight(item) { return Number(item.impact_score ?? item.importance_score ?? 0); }
function byImpact(a, b) { return Number(b.impact_score ?? 0) - Number(a.impact_score ?? 0); }
function byImportance(a, b) { return Number(b.importance_score ?? 0) - Number(a.importance_score ?? 0); }
function bySeverity(a, b) { return severity(b.level) - severity(a.level); }
function severity(value) { return ({ high: 3, medium: 2, low: 1 })[lower(value)] ?? 0; }
function normalizeType(value) { return ["company", "sector", "macro", "market_summary"].includes(value) ? value : "market_summary"; }
function dominant(values, fallback) { const counts = new Map(); values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1)); return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function array(value) { return Array.isArray(value) ? value : []; }
function lower(value) { return String(value ?? "").toLowerCase(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

const STOP_WORDS = new Set(["why", "what", "today", "current", "analyze", "analysis", "market", "the", "and", "for", "how", "are", "did", "为什么", "今天", "当前", "分析", "市场", "近期", "如何"]);
