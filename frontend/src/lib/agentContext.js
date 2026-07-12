import { buildResearchContext, hasResearchContext } from "./researchSchema.js";

/**
 * Compatibility adapter for existing MarketAgent consumers.
 * Canonical fields come directly from ResearchContext; legacy aliases can be
 * removed after the Workspace and API migrate fully.
 */
export function buildAgentContext(reportData) {
  const research = buildResearchContext(reportData);
  const topSignals = [...research.events].sort((a, b) => b.impact_score - a.impact_score).slice(0, 3);
  const dominantTheme = research.macro_themes[0]?.title || dominant(research.events.flatMap((event) => event.themes), "Mixed");
  const topSector = dominant(research.events.map((event) => event.sector).filter((value) => !["Macro", "Cross-market"].includes(value)), "Broad Market");

  return {
    ...research,
    has_data: hasResearchContext(research),
    report_time: research.market_state.generated_at,
    market_summary: research.market_state.summary,
    index_performance_summary: research.market_state.index_performance_summary,
    macro_outlook: research.macro_themes.map((theme) => theme.current_view).filter(Boolean).join(" "),
    risk_and_sentiment: research.risks.map((risk) => risk.description || risk.title).filter(Boolean).join(" "),
    key_events: research.events,
    top_signals: topSignals,
    source_count: research.sources.length,
    news_count: research.events.length,
    total_events: research.events.length,
    market_sentiment: research.market_state.sentiment,
    sentiment_score: research.market_state.sentiment_score,
    dominant_theme: dominantTheme,
    top_sector: topSector,
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

function text(value) {
  return value == null ? "" : String(value).trim();
}
