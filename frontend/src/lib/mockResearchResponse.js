import { createResearchResponse, inferAnalysisType } from "./marketAgentSchema.js";

export function buildMockResearchResponse(question, context = {}) {
  const query = text(question);
  const events = context.events ?? context.key_events ?? [];
  const relevant = selectRelevantEvents(query, events);
  const evidenceEvents = (relevant.length ? relevant : context.top_signals ?? events).slice(0, 5);
  const negative = evidenceEvents.filter((event) => event.sentiment_score < -0.1);
  const analysisType = classifyQuestion(query);
  const stance = inferStance(evidenceEvents, context.market_state?.sentiment_score ?? context.sentiment_score);
  const confidence = inferConfidence(evidenceEvents, context);

  return createResearchResponse({
    query,
    analysis_type: analysisType,
    stance,
    confidence,
    executive_summary: executiveSummary(analysisType, evidenceEvents, context),
    key_drivers: evidenceEvents.slice(0, 4).map((event, index) => ({
      title: event.title || `Market driver ${index + 1}`,
      direction: direction(event.sentiment_score),
      importance: Math.round(number(event.impact_score)),
      analysis: event.why_it_matters || event.summary || `This signal is relevant to the current ${dominantTheme(context)} research view.`,
      evidence_ids: [eventId(event, index)],
    })),
    market_impact: {
      equities: equityImpact(stance, context),
      sectors: unique(evidenceEvents.map((event) => event.sector).filter(Boolean)),
      rates: context.asset_view?.rates?.reason || context.asset_view?.rates?.view || "The current report does not provide a confirmed incremental rates signal.",
      time_horizon: dominantHorizon(evidenceEvents),
    },
    risk_factors: riskFactors(negative, evidenceEvents, context),
    watch_next: watchItems(evidenceEvents, context),
    evidence: evidenceEvents.map((event, index) => ({
      id: eventId(event, index),
      title: event.title || "Untitled market event",
      source: event.sources?.[0] || "Current market report",
      sources: event.sources ?? [],
      impact_score: Math.round(number(event.impact_score)),
      sentiment_score: number(event.sentiment_score),
    })),
    limitations: context.has_data ? ["Analysis is limited to the current report window and is not investment advice."] : ["No current report context is available."],
  });
}

function selectRelevantEvents(question, events) {
  const terms = tokens(question);
  if (!terms.length) return [];
  return events
    .map((event) => ({ event, score: relevance(event, terms) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || number(b.event.impact_score) - number(a.event.impact_score))
    .map((row) => row.event);
}

function relevance(event, terms) {
  const haystack = `${event.title || ""} ${event.summary || ""} ${event.sector || ""} ${(event.themes || []).join(" ")}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function tokens(value) {
  const aliases = text(value).toLowerCase()
    .replaceAll("英伟达", " nvidia ")
    .replaceAll("半导体", " semiconductor ")
    .replaceAll("美联储", " fed rates ")
    .replaceAll("降息", " rates cut ");
  return unique(aliases.split(/[^a-z0-9\u4e00-\u9fff]+/).filter((term) => term.length > 1 && !STOP_WORDS.has(term)));
}

function classifyQuestion(value) { return inferAnalysisType(value); }

function executiveSummary(type, events, context) {
  if (!context.has_data) return "No current report context is available. This mock response cannot establish a research conclusion.";
  if (!events.length) return context.market_state?.summary || context.market_summary || "The current report contains insufficient evidence for a specific conclusion.";
  const lead = events[0];
  const scope = type === "company" ? "company-level" : type === "sector" ? "sector" : type === "macro" ? "macro" : "market";
  return `${lead.summary || lead.title} This is the leading ${scope} signal in the current report. The conclusion remains report-grounded and should be confirmed against the next catalyst and market breadth.`;
}

function riskFactors(negative, events, context) {
  const candidates = (negative.length ? negative : events.slice(0, 3)).map((event, index) => ({
    title: event.title || `Risk ${index + 1}`,
    level: number(event.impact_score) >= 80 ? "high" : number(event.impact_score) >= 50 ? "medium" : "low",
    analysis: event.summary || "The event can invalidate or weaken the current research view.",
    evidence_ids: [eventId(event, index)],
  }));
  const contextRisk = context.risks?.[0];
  if (contextRisk) candidates.push({ title: contextRisk.title || "Market positioning and sentiment", level: contextRisk.level || "medium", analysis: contextRisk.description || contextRisk.title, evidence_ids: contextRisk.evidence_event_ids || [] });
  return candidates.slice(0, 5);
}

function watchItems(events, context) {
  const items = events.slice(0, 4).map((event, index) => ({
    item: event.title || `Signal ${index + 1}`,
    why_it_matters: `Confirmation or reversal would change the confidence in this ${dominantTheme(context)} view.`,
    evidence_ids: [eventId(event, index)],
  }));
  if (!items.length) items.push({ item: "Next market catalyst", why_it_matters: "New evidence is required before increasing confidence.", evidence_ids: [] });
  return items;
}

function inferStance(events, sentiment) {
  const values = events.map((event) => number(event.sentiment_score));
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : number(sentiment);
  return average > 0.12 ? "constructive" : average < -0.12 ? "cautious" : "neutral_selective";
}

function inferConfidence(events, context) {
  if (!context.has_data) return 20;
  const sourceCount = context.sources?.length || new Set(events.flatMap((event) => event.sources ?? [])).size;
  const impact = events.length ? events.reduce((sum, event) => sum + number(event.impact_score), 0) / events.length : 0;
  return Math.round(Math.max(35, Math.min(85, 42 + events.length * 4 + sourceCount * 2 + impact * 0.12)));
}

function equityImpact(stance, context) {
  if (stance === "constructive") return context.asset_view?.equities?.reason || `Constructive but selective. ${topSector(context)} has the strongest current signal concentration.`;
  if (stance === "cautious") return "Cautious. Negative event concentration and positioning risk can limit index follow-through.";
  return context.asset_view?.equities?.reason || `Neutral and selective. ${dominantTheme(context)} needs broader confirmation before supporting a stronger directional view.`;
}

function dominantTheme(context) { return context.macro_themes?.[0]?.title || context.dominant_theme || "market"; }
function topSector(context) { return context.asset_view?.sectors?.positive?.[0] || context.top_sector || "Leading sectors"; }

function dominantHorizon(events) {
  const horizons = events.map((event) => event.time_horizon).filter(Boolean);
  return horizons[0] || "short-to-medium term";
}

function eventId(event, index) { return text(event.id ?? event.event_id) || `event-${index + 1}`; }
function direction(value) { const score = number(value); return score > 0.1 ? "positive" : score < -0.1 ? "negative" : "mixed"; }
function text(value) { return value == null ? "" : String(value).trim(); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

const STOP_WORDS = new Set(["why", "what", "today", "the", "and", "for", "how", "are", "did", "分析", "为什么", "今天", "近期", "如何", "市场"]);
