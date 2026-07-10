import {
  getAllEvents,
  getDashboardSummary,
  getEventFilterOptions,
  getMacroAnalysis,
  getTopSignals,
} from "./reportDerivedData.js";

export function buildPageArchitecture(report, marketHistory, marketTrends, reportHistory) {
  const source = report && typeof report === "object" ? report : {};
  const events = getAllEvents(source);
  const dashboard = getDashboardSummary(source, marketHistory);
  const marketDataWarning = hasMarketDataWarning(source.market_data ?? source.market_snapshot);

  return {
    dashboard: {
      ...dashboard,
      top_signals: getTopSignals(source),
    },
    event_feed: {
      events,
      filters: getEventFilterOptions(source),
    },
    macro_analysis: getMacroAnalysis(source),
    market_agent: {
      report_time: source.generated_at ?? source.market_data?.as_of ?? "",
      total_events: dashboard.stats.total_events,
      sentiment: dashboard.snapshot.sentiment,
      dominant_theme: dashboard.stats.dominant_theme,
      top_sector: dashboard.stats.top_sector,
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
      data_freshness_warning: Boolean(source.data_freshness_warning) || marketDataWarning,
    },
    market_history: marketHistory,
    market_trends: marketTrends,
  };
}

function hasMarketDataWarning(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (snapshot.status === "stale") return true;
  const items = Array.isArray(snapshot) ? snapshot : snapshot.items ?? snapshot.indices ?? [];
  if (!Array.isArray(items) || !items.length) return false;
  return items.every((item) => item?.price == null && item?.value == null && item?.last == null);
}
