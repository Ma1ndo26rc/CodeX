import { createContext, useContext, useEffect, useState } from "react";

const messages = {
  en: {
    dashboard: "Dashboard", newsList: "News List", macroAnalysis: "Macro Analysis", marketData: "Market Data",
    usEquity: "US Equity", dailyTerminal: "Daily Terminal",
    appDescription: "AI-curated market intelligence from news, sources, sentiment and live snapshots.",
    latestBuild: "Latest Build", workspace: "Bloomberg-style workspace", light: "Light", dark: "Dark",
    switchLanguage: "中文", switchLanguageLabel: "Switch to Chinese", loading: "Loading market report data...",
    loadError: "Data load error: {error}", marketSummary: "Market Summary",
    heroTitle: "AI market brief with source-linked event intelligence.", riskSentiment: "Risk & Sentiment",
    keyEvents: "Key Events", rankedDrivers: "LLM-ranked market drivers", avgImpact: "Avg Impact",
    eventScore: "0-100 event score", avgSentiment: "Avg Sentiment", sentimentScale: "-1 risk-off to +1 risk-on",
    macro: "Macro", macroSub: "Rates, inflation, policy", company: "Company", companySub: "Single-name catalysts",
    indexPerformance: "Index Performance Summary", marketReadThrough: "Market Read-Through",
    macroOutlook: "Macro Outlook", macroDirection: "Macro Direction", topEventTape: "Top Event Tape",
    sensitiveStories: "Most Market-Sensitive Stories", sourceLinkedTape: "Source-Linked Event Tape",
    searchPlaceholder: "Search ticker, source, topic...", all: "All", market: "Market", layer: "Layer",
    headline: "Headline", impact: "Impact", sentiment: "Sentiment", sources: "Sources", source: "Source {count}",
    ratesPolicyTitle: "Rates, Policy, Growth And Risk Appetite", macroLayer: "Macro Layer",
    macroLayerDesc: "Fed, inflation, yields, policy and cross-asset macro catalysts.", marketLayer: "Market Layer",
    marketLayerDesc: "Index breadth, sector rotation, risk appetite and factor-level stories.", companyLayer: "Company Layer",
    companyLayerDesc: "Earnings, layoffs, guidance, regulation and single-name catalysts.", eventCount: "{count} events",
    noLayerEvents: "No events classified in this layer.", realtimeSnapshot: "Real-Time Snapshot", changeSuffix: "change",
    snapshotTime: "Snapshot Time", asset: "Asset", symbol: "Symbol", price: "Price", change: "Change",
    changePercent: "Change %", untitledEvent: "Untitled event", whyItMatters: "Why it matters: ",
    impactSentiment: "Impact x Sentiment", topEventsCount: "Top {count} events", negative: "NEGATIVE",
    positive: "POSITIVE", highImpact: "HIGH IMPACT", indexTrends: "Index Trends",
    noTrendData: "No trend data yet. Run python main.py --market-data to fetch market trends.",
    rangeMeta: "Range {range} / interval {interval} / updated {updated}", overRange: "over range",
    chartPoints: "{count} chart points", scheduledSnapshots: "{count} scheduled snapshots",
    notEnoughData: "Not enough data", noMarketData: "No market data snapshot available.", standardJson: "Standard JSON",
  },
  zh: {
    dashboard: "首页看板", newsList: "新闻列表", macroAnalysis: "宏观分析", marketData: "市场数据",
    usEquity: "美国股市", dailyTerminal: "每日市场终端", appDescription: "整合新闻、来源、情绪与实时行情的 AI 市场情报。",
    latestBuild: "最新生成", workspace: "Bloomberg 风格工作台", light: "浅色", dark: "深色",
    switchLanguage: "EN", switchLanguageLabel: "切换到英文", loading: "正在加载市场报告数据...",
    loadError: "数据加载失败：{error}", marketSummary: "市场综述", heroTitle: "基于可信来源与事件影响的 AI 市场简报。",
    riskSentiment: "风险与情绪", keyEvents: "关键事件", rankedDrivers: "由大模型筛选的市场驱动因素",
    avgImpact: "平均影响力", eventScore: "事件评分 0-100", avgSentiment: "平均情绪",
    sentimentScale: "-1 避险至 +1 风险偏好", macro: "宏观", macroSub: "利率、通胀与政策",
    company: "公司", companySub: "个股催化因素", indexPerformance: "指数表现摘要", marketReadThrough: "市场解读",
    macroOutlook: "宏观展望", macroDirection: "宏观方向", topEventTape: "重点事件",
    sensitiveStories: "市场敏感度最高的新闻", sourceLinkedTape: "带原文来源的事件列表",
    searchPlaceholder: "搜索股票、来源或主题...", all: "全部", market: "市场", layer: "层级", headline: "标题",
    impact: "影响力", sentiment: "情绪", sources: "来源", source: "来源 {count}",
    ratesPolicyTitle: "利率、政策、增长与风险偏好", macroLayer: "宏观层",
    macroLayerDesc: "美联储、通胀、收益率、政策及跨资产宏观催化因素。", marketLayer: "市场层",
    marketLayerDesc: "指数广度、行业轮动、风险偏好与因子层面的事件。", companyLayer: "公司层",
    companyLayerDesc: "财报、裁员、指引、监管与个股催化因素。", eventCount: "{count} 个事件",
    noLayerEvents: "该层级暂无已分类事件。", realtimeSnapshot: "实时行情快照", changeSuffix: "涨跌幅",
    snapshotTime: "快照时间", asset: "资产", symbol: "代码", price: "价格", change: "涨跌",
    changePercent: "涨跌幅", untitledEvent: "未命名事件", whyItMatters: "为何重要：",
    impactSentiment: "影响力 × 情绪", topEventsCount: "影响力最高的 {count} 个事件", negative: "负面",
    positive: "正面", highImpact: "高影响力", indexTrends: "指数走势",
    noTrendData: "暂无走势数据。运行 python main.py --market-data 获取市场走势。",
    rangeMeta: "区间 {range} / 周期 {interval} / 更新于 {updated}", overRange: "区间涨跌",
    chartPoints: "{count} 个图表数据点", scheduledSnapshots: "{count} 个定时快照", notEnoughData: "数据不足",
    noMarketData: "暂无市场行情快照。", standardJson: "标准 JSON",
  },
};

const termMap = {
  zh: {
    Macro: "宏观", Market: "市场", Company: "公司", Technology: "科技", Financials: "金融", Energy: "能源",
    Healthcare: "医疗保健", Policy: "政策", Corporate: "公司事件", Regulatory: "监管", Geopolitical: "地缘政治",
    "Monetary Policy": "货币政策", "Merger and Acquisition": "并购", "Analyst Commentary": "分析师观点",
    Equity: "股票", "short-term": "短期", "medium-term": "中期", "long-term": "长期",
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem("language") || "en");

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const t = (key, values = {}) => {
    const template = messages[language]?.[key] ?? messages.en[key] ?? key;
    return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
  };
  const term = (value) => termMap[language]?.[value] ?? value;
  const localized = (object, field) => {
    if (!object) return "";
    if (language === "zh") return object[`${field}_zh`] ?? object.translations?.zh?.[field] ?? object[field] ?? "";
    return object[field] ?? "";
  };

  return <LanguageContext.Provider value={{ language, setLanguage, t, term, localized }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
