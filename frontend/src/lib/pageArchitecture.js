import {
  getAllEvents,
  getDashboardSummary,
  getEventFilterOptions,
  getTopSignals,
} from "./reportDerivedData.js";
import { buildResearchContext, EMPTY_RESEARCH_CONTEXT, hasResearchContext } from "./researchSchema.js";

export function buildPageArchitecture(report, marketHistory, marketTrends, reportHistory) {
  const source = report && typeof report === "object" ? report : {};
  const events = getAllEvents(source);
  const dashboard = getDashboardSummary(source, marketHistory);
  const research = Object.keys(source).length ? buildResearchContext(source) : EMPTY_RESEARCH_CONTEXT;
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
    macro_analysis: macroModelFromResearch(research),
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

function macroModelFromResearch(context) {
  const research = context && typeof context === "object" ? context : EMPTY_RESEARCH_CONTEXT;
  const state = research.market_state ?? EMPTY_RESEARCH_CONTEXT.market_state;
  const assetView = research.asset_view ?? EMPTY_RESEARCH_CONTEXT.asset_view;
  const watch = research.watch_next ?? EMPTY_RESEARCH_CONTEXT.watch_next;
  return {
    has_data: hasResearchContext(research),
    market_regime: {
      title: strategyRegimeTitle(state, research.macro_themes, research.risks),
      title_zh: strategyRegimeTitleZh(state, research.macro_themes, research.risks),
      executive_view: executiveMacroView(state.summary, research.drivers),
      executive_view_zh: executiveMacroView(state.summary_zh, research.drivers),
      key_takeaway: macroStrategyTakeaway(research.macro_themes, assetView, research.risks),
      key_takeaway_zh: macroStrategyTakeawayZh(research.macro_themes, assetView, research.risks),
      strategist_view: strategistView(research.macro_themes, research.risks),
      strategist_view_zh: strategistViewZh(research.macro_themes, research.risks),
      investment_view: investmentView(state.stance, state.sentiment_score),
      investment_view_zh: investmentViewZh(state.stance, state.sentiment_score),
      confidence: state.confidence,
    },
    macro_themes: (research.macro_themes ?? []).map((theme) => ({
      name: theme.title,
      name_zh: theme.title_zh,
      current_view: conciseThemeView(theme.current_view),
      current_view_zh: conciseThemeView(theme.current_view_zh),
      what_changed: theme.what_changed,
      what_changed_zh: theme.what_changed_zh,
      why_it_matters: theme.why_it_matters,
      why_it_matters_zh: theme.why_it_matters_zh,
      market_impact: theme.market_impact,
    })),
    asset_transmission: [
      strategyTransmission("US Equities", "美股", assetView.equities, assetView.equities_zh),
      strategyTransmission("Rates", "利率", assetView.rates, assetView.rates_zh),
      strategyTransmission("Growth Stocks", "成长股", assetView.growth_stocks, assetView.growth_stocks_zh),
      strategyTransmission("Financials", "金融股", assetView.financials, assetView.financials_zh),
      sectorTransmission(assetView),
    ].filter((item) => item.transmission || item.implication),
    risks: (research.risks ?? []).map((risk) => ({
      factor: risk.title,
      factor_zh: risk.title_zh,
      transmission: risk.description,
      transmission_zh: risk.description_zh,
      trigger: riskTrigger(risk),
      trigger_zh: riskTriggerZh(risk),
      severity: String(risk.level || "medium").toUpperCase(),
    })),
    watch_next: {
      macro_data: (watch.macro_data ?? []).slice(0, 4).map(watchEvent),
      policy: (watch.policy ?? []).slice(0, 4).map(watchEvent),
      company_events: (watch.company_events ?? []).slice(0, 4).map(watchEvent),
    },
  };
}

function strategyRegimeTitle(state, themes, risks) {
  const corpus = `${state.regime || ""} ${(themes ?? []).map((theme) => theme.title).join(" ")}`;
  if (/AI|Technology/i.test(corpus) && (risks ?? []).length) return "AI-led Growth with Elevated Risk Premium";
  return state.regime || "Selective Growth with Macro Cross-Currents";
}

function strategyRegimeTitleZh(state, themes, risks) {
  const corpus = `${state.regime || ""} ${(themes ?? []).map((theme) => theme.title).join(" ")}`;
  if (/AI|Technology/i.test(corpus) && (risks ?? []).length) return "AI驱动增长延续，但风险溢价正在上升";
  return state.regime_zh || "增长主线延续，宏观分歧仍待确认";
}

function investmentView(stance, sentimentScore) {
  const value = String(stance || "").toLowerCase();
  if (/bullish|positive|constructive/.test(value) || Number(sentimentScore) > 0.12) return "Selective Risk-On";
  if (/bearish|negative|cautious/.test(value) || Number(sentimentScore) < -0.12) return "Cautious / Defensive";
  return /growth|tech/.test(value) ? "Neutral with Growth Bias" : "Neutral / Selective";
}

function investmentViewZh(stance, sentimentScore) {
  const view = investmentView(stance, sentimentScore);
  return { "Selective Risk-On": "选择性风险偏好", "Cautious / Defensive": "谨慎 / 防御", "Neutral with Growth Bias": "中性，偏向成长", "Neutral / Selective": "中性 / 精选" }[view];
}

function strategyTransmission(asset, assetZh, value = {}, valueZh = {}) {
  return {
    asset,
    asset_zh: assetZh,
    transmission: value.reason || value.view || "The current signal requires confirmation.",
    transmission_zh: valueZh.reason || valueZh.view || "当前信号仍需进一步确认。",
    implication: assetImplication(asset, value),
    implication_zh: assetImplicationZh(asset, valueZh),
  };
}

function strategyAssetView(value) {
  const text = String(value || "").toLowerCase();
  if (/overweight|bullish|positive/.test(text)) return "Constructive / Selective";
  if (/underweight|bearish|negative/.test(text)) return "Cautious";
  return text ? "Neutral / Selective" : "Neutral";
}

function strategyAssetViewZh(value) {
  const view = strategyAssetView(value);
  return { "Constructive / Selective": "积极 / 精选", Cautious: "谨慎", "Neutral / Selective": "中性 / 精选", Neutral: "中性" }[view];
}

function assetImplication(asset, value) {
  if (asset === "Rates") return "Duration and curve exposure remain sensitive to inflation and policy repricing.";
  if (asset === "Financials") return "Watch curve shape, funding costs and credit sensitivity.";
  if (asset === "Growth Stocks") return "Leadership depends on earnings delivery and stable long-duration valuations.";
  return value.reason || "Favor evidence-backed leadership over broad index exposure.";
}

function assetImplicationZh(asset) {
  if (asset === "Rates") return "久期与曲线敞口仍对通胀和政策重定价敏感。";
  if (asset === "Financials") return "关注收益率曲线、融资成本与信用敏感度。";
  if (asset === "Growth Stocks") return "领导力取决于盈利兑现和长期估值稳定性。";
  return "优先关注有证据支持的结构性主线。";
}

function conciseThemeView(value) {
  const text = String(value || "").trim();
  const firstSentence = text.split(/(?<=[.!?。！？])\s*/)[0];
  return firstSentence || text;
}

function executiveMacroView(summary, drivers = []) {
  const sentences = String(summary || "").split(/(?<=[.!?。！？])\s+/).filter(Boolean).slice(0, 2);
  if (sentences.length) return sentences.join(" ");
  return (drivers ?? []).slice(0, 2).map((driver) => driver.explanation || driver.name).filter(Boolean).join(" ");
}

function macroStrategyTakeaway(themes = [], assetView = {}, risks = []) {
  const lead = themes[0]?.title || "structural growth leadership";
  const beneficiary = assetView.sectors?.positive?.[0] || "quality growth";
  const risk = risks[0]?.title || "macro repricing";
  return `Maintain selective exposure to ${beneficiary} as ${lead} remains intact, while monitoring ${risk}.`;
}

function macroStrategyTakeawayZh(themes = [], assetView = {}, risks = []) {
  const beneficiary = assetView.sectors_zh?.positive?.[0] || assetView.sectors?.positive?.[0] || "优质成长资产";
  const risk = risks[0]?.title_zh || risks[0]?.title || "宏观重定价风险";
  return `在主要增长逻辑仍然成立的情况下，保持对${beneficiary}的选择性敞口，同时关注${risk}。`;
}

function strategistView(themes = [], risks = []) {
  const logic = themes.find((theme) => /AI|Technology|Growth/i.test(theme.title || ""))?.title || themes[0]?.title || "The investment cycle";
  const risk = risks[0]?.title || "valuation and macro dispersion";
  return `${logic} remains the primary market logic, but ${risk} requires selective positioning and tighter confirmation thresholds.`;
}

function strategistViewZh(themes = [], risks = []) {
  const logic = themes.find((theme) => /AI|Technology|Growth/i.test(theme.title || ""))?.title_zh || "当前主要增长逻辑";
  const risk = risks[0]?.title_zh || risks[0]?.title || "估值与宏观分化";
  return `${logic}仍是市场核心支撑，但${risk}要求投资者保持精选并提高确认门槛。`;
}

function sectorTransmission(assetView = {}) {
  const positive = assetView.sectors?.positive ?? [];
  const negative = assetView.sectors?.negative ?? [];
  return {
    asset: "Sector Rotation",
    asset_zh: "行业轮动",
    transmission: positive.length ? `Leadership is concentrated in ${positive.join(", ")}.` : "",
    transmission_zh: positive.length ? `市场领导力集中在${positive.join("、")}。` : "",
    implication: negative.length ? `Relative pressure remains in ${negative.join(", ")}.` : "Rotation breadth remains the key confirmation signal.",
    implication_zh: negative.length ? `${negative.join("、")}仍面临相对压力。` : "行业扩散程度仍是关键确认信号。",
  };
}

function riskTrigger(risk = {}) {
  const corpus = `${risk.title || ""} ${risk.description || ""}`.toLowerCase();
  if (/geopolit|iran|war|oil|energy/.test(corpus)) return "Energy or oil price shock";
  if (/valuation|multiple|earnings|ai/.test(corpus)) return "Earnings miss or multiple compression";
  if (/rate|fed|inflation|yield/.test(corpus)) return "Hawkish repricing or yield spike";
  if (/consumer|growth|labor/.test(corpus)) return "Material downside data surprise";
  return "";
}

function riskTriggerZh(risk = {}) {
  const trigger = riskTrigger(risk);
  return { "Energy or oil price shock": "能源或油价冲击", "Earnings miss or multiple compression": "盈利不及预期或估值压缩", "Hawkish repricing or yield spike": "鹰派重定价或收益率跳升", "Material downside data surprise": "关键数据显著低于预期" }[trigger] || "";
}

function watchEvent(value) {
  const event = String(value || "").trim();
  const patterns = [
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:-\d{1,2})?\b/i,
    /\b\d{1,2}\/\d{1,2}(?:-\d{1,2})?\b/,
  ];
  const match = patterns.map((pattern) => event.match(pattern)).find(Boolean);
  const date = match?.[0] || "";
  return { date, event: date ? event.replace(date, "").replace(/^[\s()\-–—:]+|[\s()]+$/g, "").trim() : event };
}

function hasMarketDataWarning(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  if (snapshot.status === "stale") return true;
  const items = Array.isArray(snapshot) ? snapshot : snapshot.items ?? snapshot.indices ?? [];
  if (!Array.isArray(items) || !items.length) return false;
  return items.every((item) => item?.price == null && item?.value == null && item?.last == null);
}
