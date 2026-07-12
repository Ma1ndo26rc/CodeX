export const MARKET_AGENT_CONTEXT_VERSION = "v1";

export const AgentRequestSchema = Object.freeze({
  question: "",
  report_id: "",
  analysis_type: "",
  context_version: MARKET_AGENT_CONTEXT_VERSION,
});

export const ResearchResponseSchema = Object.freeze({
  query: "",
  analysis_type: "",
  stance: "",
  confidence: 0,
  executive_summary: "",
  key_drivers: [],
  market_impact: { equities: "", sectors: [], rates: "", time_horizon: "" },
  risk_factors: [],
  watch_next: [],
  evidence: [],
  limitations: [],
});

export function createAgentRequest({ question, report_id, analysis_type, context } = {}) {
  const prompt = text(question);
  if (!prompt) throw new Error("Market Agent request requires a question.");
  return {
    question: prompt,
    report_id: text(report_id) || reportIdFromContext(context),
    analysis_type: text(analysis_type) || inferAnalysisType(prompt),
    context_version: MARKET_AGENT_CONTEXT_VERSION,
  };
}

export function createResearchResponse(value = {}) {
  const source = isObject(value) ? value : {};
  return {
    query: text(source.query),
    analysis_type: text(source.analysis_type) || inferAnalysisType(source.query),
    stance: normalizeStance(source.stance),
    confidence: bounded(source.confidence, 0, 100, 0),
    executive_summary: text(source.executive_summary),
    key_drivers: normalizeDrivers(source.key_drivers),
    market_impact: normalizeMarketImpact(source.market_impact),
    risk_factors: normalizeRisks(source.risk_factors),
    watch_next: normalizeWatch(source.watch_next),
    evidence: normalizeEvidence(source.evidence),
    limitations: normalizeStrings(source.limitations),
  };
}

export function normalizeResearchResponse(payload, { question = "", fallback = null } = {}) {
  const fallbackResponse = fallback ? createResearchResponse(fallback) : null;
  const candidate = responseCandidate(payload);
  if (!candidate) return fallbackResponse ?? createResearchResponse({ query: question });
  const normalized = createResearchResponse({ ...candidate, query: candidate.query || question });
  if (!hasResearchResponseContent(normalized) && fallbackResponse) return fallbackResponse;
  return mergeWithFallback(normalized, fallbackResponse);
}

export function hasResearchResponseContent(value) {
  return Boolean(value?.executive_summary || value?.key_drivers?.length || value?.evidence?.length);
}

export function inferAnalysisType(question) {
  const query = text(question).toLowerCase();
  if (/nvidia|nvda|stock|company|earnings|英伟达|公司|个股|财报/.test(query)) return "company";
  if (/sector|industry|semiconductor|行业|板块|半导体|芯片/.test(query)) return "sector";
  if (/fed|rate|inflation|macro|美联储|利率|降息|通胀|宏观/.test(query)) return "macro";
  return "market_summary";
}

function responseCandidate(payload) {
  if (!isObject(payload)) return null;
  for (const value of [payload.research_response, payload.result, payload.data, payload]) {
    if (isObject(value) && !Array.isArray(value)) return value;
  }
  return null;
}

function mergeWithFallback(value, fallback) {
  if (!fallback) return value;
  return {
    query: value.query || fallback.query,
    analysis_type: value.analysis_type || fallback.analysis_type,
    stance: value.stance || fallback.stance,
    confidence: value.confidence || fallback.confidence,
    executive_summary: value.executive_summary || fallback.executive_summary,
    key_drivers: value.key_drivers.length ? value.key_drivers : fallback.key_drivers,
    market_impact: {
      equities: value.market_impact.equities || fallback.market_impact.equities,
      sectors: value.market_impact.sectors.length ? value.market_impact.sectors : fallback.market_impact.sectors,
      rates: value.market_impact.rates || fallback.market_impact.rates,
      time_horizon: value.market_impact.time_horizon || fallback.market_impact.time_horizon,
    },
    risk_factors: value.risk_factors.length ? value.risk_factors : fallback.risk_factors,
    watch_next: value.watch_next.length ? value.watch_next : fallback.watch_next,
    evidence: value.evidence.length ? value.evidence : fallback.evidence,
    limitations: value.limitations.length ? value.limitations : fallback.limitations,
  };
}

function normalizeDrivers(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((driver, index) => ({
    title: text(driver.title ?? driver.name) || `Driver ${index + 1}`,
    direction: normalizeDirection(driver.direction),
    importance: bounded(driver.importance ?? driver.importance_score, 0, 100, 0),
    analysis: text(driver.analysis ?? driver.summary),
    evidence_ids: normalizeStrings(driver.evidence_ids),
  }));
}

function normalizeMarketImpact(value) {
  const impact = isObject(value) ? value : {};
  return {
    equities: text(impact.equities),
    sectors: normalizeStrings(impact.sectors),
    rates: text(impact.rates),
    time_horizon: text(impact.time_horizon),
  };
}

function normalizeRisks(value) {
  if (!Array.isArray(value)) return [];
  return value.map((risk, index) => {
    if (!isObject(risk)) return { title: text(risk) || `Risk ${index + 1}`, level: "medium", analysis: "", evidence_ids: [] };
    return {
      title: text(risk.title ?? risk.name) || `Risk ${index + 1}`,
      level: normalizeLevel(risk.level ?? risk.severity),
      analysis: text(risk.analysis ?? risk.description),
      evidence_ids: normalizeStrings(risk.evidence_ids),
    };
  }).filter((risk) => risk.title);
}

function normalizeWatch(value) {
  if (!Array.isArray(value)) return [];
  return value.map((watch, index) => {
    if (!isObject(watch)) return { item: text(watch) || `Watch item ${index + 1}`, why_it_matters: "", evidence_ids: [] };
    return {
      item: text(watch.item ?? watch.title) || `Watch item ${index + 1}`,
      why_it_matters: text(watch.why_it_matters ?? watch.analysis),
      evidence_ids: normalizeStrings(watch.evidence_ids),
    };
  }).filter((watch) => watch.item);
}

function normalizeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((item, index) => ({
    id: text(item.id) || `evidence-${index + 1}`,
    title: text(item.title),
    source: text(item.source),
    sources: normalizeStrings(item.sources),
    url: text(item.url),
    published_at: text(item.published_at),
    impact_score: bounded(item.impact_score, 0, 100, 0),
    sentiment_score: bounded(item.sentiment_score, -1, 1, 0),
  }));
}

function reportIdFromContext(context) {
  const state = isObject(context?.market_state) ? context.market_state : {};
  return text(state.report_id) || [text(state.report_type) || "latest", text(state.generated_at)].filter(Boolean).join(":");
}

function normalizeStrings(value) { return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : []; }
function normalizeStance(value) { const stance = text(value).toLowerCase().replaceAll(" ", "_"); return ["constructive", "cautious", "neutral", "neutral_selective", "bullish", "bearish", "mixed"].includes(stance) ? stance : stance || "neutral"; }
function normalizeDirection(value) { const direction = text(value).toLowerCase(); return ["positive", "negative", "mixed", "neutral"].includes(direction) ? direction : "mixed"; }
function normalizeLevel(value) { const level = text(value).toLowerCase(); return ["high", "medium", "low"].includes(level) ? level : "medium"; }
function isObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function text(value) { return value == null ? "" : String(value).trim(); }
function bounded(value, minimum, maximum, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback; }
