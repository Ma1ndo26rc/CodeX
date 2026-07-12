import { isNearDuplicate, truncateText, uniqueTexts } from "./textUtils.js";

const INDEX_DEFINITIONS = [
  { id: "sp500", label: "SPY", aliases: ["s&p", "sp500", "^gspc", "spy"], historyAliases: ["SPY"] },
  { id: "nasdaq", label: "QQQ", aliases: ["nasdaq", "^ixic", "qqq"], historyAliases: ["QQQ"] },
  { id: "dow", label: "DOW", aliases: ["dow", "^dji", "dia"], historyAliases: ["DOW", "DIA", "^DJI"] },
  { id: "vix", label: "VIX", aliases: ["vix", "^vix"], historyAliases: ["VIX", "^VIX"] },
];

const MACRO_DRIVER_DEFINITIONS = [
  { name: "Labor Market", pattern: /jobs?|payroll|unemployment|labor|participation|wages?|employment/i },
  { name: "Fed Policy", pattern: /\bfed\b|fomc|powell|warsh|monetary policy|rate cuts?|rate hikes?|\brates?\b/i },
  { name: "Treasury Market", pattern: /treasury|yields?|bonds?|10-year|2-year|\btnx\b|\btlt\b/i },
  { name: "Risk Appetite", pattern: /nasdaq|dow|s&p|semiconductors?|crypto|bitcoin|\bvix\b|risk[- ]?off|risk[- ]?on|sell[- ]?off|rally/i },
];

const MACRO_SCORECARD_DEFINITIONS = [
  { factor: "Inflation", pattern: /inflation|\bcpi\b|\bpce\b|consumer prices?|price pressure|tariffs?|stagflation/i },
  { factor: "Labor Market", pattern: /jobs?|payroll|unemployment|labor|participation|wages?|employment/i },
  { factor: "Fed Policy", pattern: /\bfed\b|fomc|powell|warsh|monetary policy|rate cuts?|rate hikes?|\brates?\b/i },
  { factor: "Treasury Market", pattern: /treasury|yields?|bonds?|10-year|2-year|\btnx\b|\btlt\b/i },
  { factor: "Liquidity", pattern: /liquidity|credit|funding|bank lending|money market/i },
  { factor: "Risk Appetite", pattern: /nasdaq|dow|s&p|semiconductors?|crypto|bitcoin|\bvix\b|risk[- ]?off|risk[- ]?on|sell[- ]?off|rally/i },
];

const eventCache = new WeakMap();

export function getDashboardSummary(report, marketHistory) {
  const source = objectValue(report);
  const events = getAllEvents(source);
  const sentiment = getSentimentStats(source);
  const sectors = getSectorStats(source);
  const themes = normalizeThemes(source.todays_themes);
  const dominantTheme = themes[0]?.name || dominantValue(events.flatMap((event) => event.themes), "Mixed");
  const macroDrivers = getMacroDrivers(source);

  return {
    snapshot: normalizeSnapshot(source.market_snapshot ?? source.market_data, sentiment.average, marketHistory),
    narrative: buildDashboardNarrative(source, events, dominantTheme),
    regime: regimeFromSentiment(sentiment.average),
    stats: {
      total_events: events.length,
      avg_impact: average(events.map((event) => event.impact_score)),
      avg_sentiment: sentiment.average,
      sentiments: sentiment.counts,
      dominant_theme: dominantTheme,
      top_sector: sectors[0]?.name || "Broad Market",
    },
    macro_brief: {
      summary: firstSentence(source.macro_outlook),
      summary_zh: firstSentence(source.translations?.zh?.macro_outlook),
      drivers: macroDrivers.slice(0, 3),
    },
  };
}

function buildDashboardNarrative(source, events, dominantTheme) {
  const topEvents = [...events].sort((a, b) => b.decision_score - a.decision_score || b.impact_score - a.impact_score).slice(0, 5);
  const positive = topEvents.find((event) => Number(event.sentiment_score) > 0.1) ?? topEvents.find((event) => /ai|technology|earnings|growth|rally|record|gain/i.test(`${event.title} ${event.summary}`));
  const negative = topEvents.find((event) => Number(event.sentiment_score) < -0.1) ?? topEvents.find((event) => /risk|uncertain|inflation|oil|yield|fed|geopolit|miss|fall|pressure/i.test(`${event.title} ${event.summary}`));
  const dedicated = objectValue(source.market_narrative);
  const dedicatedZh = objectValue(source.translations?.zh?.market_narrative);
  const legacyNarrative = typeof source.market_narrative === "string" ? text(source.market_narrative) : "";
  const summary = text(dedicated.summary) || legacyNarrative || text(source.market_summary);
  const narrative = text(dedicated.summary) || legacyNarrative;
  const macro = text(source.macro_outlook);
  const risk = text(source.risk_and_sentiment);
  const summaryZh = text(source.translations?.zh?.market_summary);
  const dedicatedSummaryZh = text(dedicatedZh.summary);
  const macroZh = text(source.translations?.zh?.macro_outlook);
  const riskZh = text(source.translations?.zh?.risk_and_sentiment);
  const watchItems = normalizeWatchItems(source.what_to_watch_tomorrow).map((item) => item.item);
  const watchItemsZh = normalizeWatchItems(source.what_to_watch_tomorrow).map((item) => item.item_zh || translateMacroPhrase(item.item));
  const forces = arrayValue(dedicated.key_forces).map((item) => ({
    label: text(item?.label),
    value: text(item?.text ?? item?.value),
  })).filter((item) => item.value).slice(0, 3);
  const forcesZh = arrayValue(dedicatedZh.key_forces).map((item) => ({
    label: text(item?.label),
    value: text(item?.text ?? item?.value),
  })).filter((item) => item.value).slice(0, 3);
  const dedicatedWatch = stringList(dedicated.watch_next).slice(0, 4);
  const dedicatedWatchZh = stringList(dedicatedZh.watch_next).slice(0, 4);
  const hasDedicatedNarrative = Boolean(text(dedicated.headline) || text(dedicated.summary) || forces.length || dedicatedWatch.length);

  return {
    headline: text(dedicated.headline) || text(source.dynamic_headline) || headlineFromEvents(topEvents),
    headline_zh: text(dedicatedZh.headline) || text(source.translations?.zh?.dynamic_headline) || headlineFromEvents(topEvents, "zh"),
    summary,
    summary_zh: dedicatedSummaryZh || summaryZh,
    thesis: firstSentence(summary) || firstSentence(narrative) || headlineFromEvents(topEvents),
    thesis_zh: firstSentence(dedicatedSummaryZh) || firstSentence(summaryZh) || headlineFromEvents(topEvents, "zh"),
    explanation: conciseDashboardExplanation(hasDedicatedNarrative ? [summary] : [summary, narrative, macro, risk]),
    explanation_zh: conciseDashboardExplanation(dedicatedSummaryZh ? [dedicatedSummaryZh] : [summaryZh, macroZh, riskZh]),
    key_forces: forces.length ? forces : [
      { label: "Positive driver", value: eventTitle(positive) || "Selective strength in higher-conviction sectors" },
      { label: "Negative driver", value: eventTitle(negative) || firstSentence(risk) || "Macro uncertainty remains a constraint" },
      { label: "Main market theme", value: dominantTheme || "Mixed" },
    ],
    key_forces_zh: forcesZh.length ? forcesZh : [
      { label: "正面驱动", value: eventTitle(positive, "zh") || "高确定性板块仍有选择性支撑" },
      { label: "负面压力", value: eventTitle(negative, "zh") || firstSentence(riskZh) || "宏观不确定性仍是约束" },
      { label: "主要主题", value: translateMacroPhrase(dominantTheme) || dominantTheme || "混合" },
    ],
    watch_next: dedicatedWatch.length ? dedicatedWatch : conciseList(watchItems, topEvents.map((event) => event.title)).slice(0, 3),
    watch_next_zh: dedicatedWatchZh.length ? dedicatedWatchZh : conciseList(watchItemsZh, topEvents.map((event) => event.title_zh || translateMacroPhrase(event.title))).slice(0, 3),
  };
}

function headlineFromEvents(events, language = "en") {
  const primary = events[0];
  const secondary = events.find((event) => event !== primary && Math.sign(Number(event.sentiment_score)) !== Math.sign(Number(primary?.sentiment_score)));
  const first = eventTitle(primary, language);
  const second = eventTitle(secondary, language);
  if (first && second) return `${first}; ${second}`;
  return first || "Markets weigh policy, growth and earnings signals";
}

function eventTitle(event, language = "en") {
  if (!event) return "";
  if (language === "zh") return text(event.title_zh ?? event.zh_title ?? event.translated_title) || translateMacroPhrase(event.title);
  return text(event.title);
}

function conciseDashboardExplanation(values) {
  const sentences = uniqueTexts(values.flatMap((value) => splitSentences(value))).filter(Boolean);
  return sentences.slice(0, 4).join(" ");
}

export function getTopSignals(report, limit = 8) {
  return [...getAllEvents(report)]
    .sort((a, b) => b.decision_score - a.decision_score || b.impact_score - a.impact_score)
    .slice(0, limit);
}

export function getAllEvents(report) {
  const source = objectValue(report);
  if (eventCache.has(source)) return eventCache.get(source);

  const nativeEvents = arrayValue(source.events);
  const candidates = nativeEvents.length
    ? nativeEvents
    : [...arrayValue(source.key_events), ...arrayValue(source.news_events)];
  const newsItems = arrayValue(source.news_items);
  const seen = new Set();
  const events = candidates
    .map((event, index) => normalizeEvent(event, index, newsItems))
    .filter((event) => {
      if (!event.title) return false;
      const key = comparableTitle(event.event_id || event.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  eventCache.set(source, events);
  return events;
}

export function getMacroEvents(report) {
  return getAllEvents(report)
    .filter((event) => event.category === "Macro" || macroContext(event).match(/fed|fomc|cpi|inflation|payroll|labor|jobs|yield|treasury|policy|liquidity|dollar|geopolit/i))
    .sort((a, b) => b.decision_score - a.decision_score || b.impact_score - a.impact_score);
}

export function getMacroDrivers(report) {
  const source = objectValue(report);
  const schemaDrivers = normalizeSchemaDrivers(source.macro_analysis?.drivers);
  if (schemaDrivers.length) return schemaDrivers;

  const macroEvents = getMacroEvents(source);
  const usedExplanations = [];

  return MACRO_DRIVER_DEFINITIONS.map((definition) => {
    const related = macroEvents
      .filter((event) => isDriverRelevant(event, definition))
      .sort((a, b) => b.impact_score - a.impact_score || b.decision_score - a.decision_score);
    if (!related.length) return null;

    const sentiment = related.length ? average(related.map((event) => event.sentiment_score)) : 0;
    const explanation = buildDriverExplanation(definition, related, usedExplanations);
    const explanationZh = buildDriverExplanation(definition, related, usedExplanations, "zh");
    usedExplanations.push(explanation);
    return {
      name: definition.name,
      name_zh: macroDriverNameZh(definition.name),
      stance: stanceFromSentiment(sentiment),
      status: driverStatus(definition.name, sentiment, related),
      status_zh: translateMacroPhrase(driverStatus(definition.name, sentiment, related)),
      trend: trendFromSentiment(sentiment),
      trend_zh: translateMacroPhrase(trendFromSentiment(sentiment)),
      signal: buildDriverSignal(definition, related, usedExplanations),
      signal_zh: buildDriverSignalZh(definition, related),
      market_impact: buildDriverMarketImpact(definition.name, sentiment),
      market_impact_zh: buildDriverMarketImpactZh(definition.name, sentiment),
      confidence: confidenceLabel(related),
      confidence_zh: translateMacroPhrase(confidenceLabel(related)),
      explanation,
      explanation_zh: explanationZh,
      related_event_count: related.length,
      sentiment_score: sentiment,
      impact_score: Math.max(...related.map((event) => event.impact_score)),
    };
  }).filter(Boolean).sort((a, b) => b.impact_score - a.impact_score || b.related_event_count - a.related_event_count);
}

export function getMacroScorecard(report) {
  const source = objectValue(report);
  const explicit = arrayValue(source.macro_analysis?.scorecard).map((item) => ({
    factor: text(item?.factor),
    factor_zh: text(item?.factor_zh) || translateMacroPhrase(item?.factor),
    current: text(item?.current),
    current_zh: text(item?.current_zh) || translateMacroPhrase(item?.current),
    trend: normalizeTrend(item?.trend),
    trend_zh: translateMacroPhrase(normalizeTrend(item?.trend)),
    impact: text(item?.impact ?? item?.market_impact),
    impact_zh: text(item?.impact_zh ?? item?.market_impact_zh) || translateMacroPhrase(item?.impact ?? item?.market_impact),
  })).filter((item) => item.factor);
  if (explicit.length) return explicit;

  const macroEvents = getMacroEvents(source);
  return MACRO_SCORECARD_DEFINITIONS.map((definition) => {
    const related = macroEvents.filter((event) => definition.pattern.test(macroContext(event)));
    const sentiment = related.length ? average(related.map((event) => event.sentiment_score)) : 0;
    const current = scorecardCurrent(definition.factor, related, sentiment);
    const trend = trendFromSentiment(sentiment);
    const impact = scorecardImpact(definition.factor, sentiment);
    return {
      factor: definition.factor,
      factor_zh: translateMacroPhrase(definition.factor),
      current,
      current_zh: translateMacroPhrase(current),
      trend,
      trend_zh: translateMacroPhrase(trend),
      impact,
      impact_zh: translateMacroPhrase(impact),
    };
  });
}

export function getMacroTransmission(report) {
  const source = objectValue(report);
  const explicit = arrayValue(source.macro_analysis?.transmission).map((item) => ({
    factor: text(item?.factor),
    factor_zh: text(item?.factor_zh) || translateMacroPhrase(item?.factor),
    channel: text(item?.channel),
    channel_zh: text(item?.channel_zh) || translateMacroPhrase(item?.channel),
    asset_impact: text(item?.asset_impact ?? item?.impact),
    asset_impact_zh: text(item?.asset_impact_zh ?? item?.impact_zh) || translateMacroPhrase(item?.asset_impact ?? item?.impact),
  })).filter((item) => item.factor || item.channel || item.asset_impact);
  if (explicit.length) return explicit.slice(0, 4);

  const drivers = getMacroDrivers(source);
  const rows = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) rows.push({
    factor: "Labor slowdown",
    factor_zh: "就业放缓",
    channel: "Fed easing expectation",
    channel_zh: "降息预期升温",
    asset_impact: "Treasury yields down; growth stocks supported",
    asset_impact_zh: "美债收益率下行；成长股获得支撑",
  });
  if (drivers.some((driver) => driver.name === "Fed Policy")) rows.push({
    factor: "Fed repricing",
    factor_zh: "美联储预期重定价",
    channel: "Discount-rate channel",
    channel_zh: "折现率通道",
    asset_impact: "Duration assets more volatile",
    asset_impact_zh: "长久期资产波动加大",
  });
  if (drivers.some((driver) => driver.name === "Treasury Market")) rows.push({
    factor: "Yield volatility",
    factor_zh: "收益率波动",
    channel: "Valuation multiple pressure",
    channel_zh: "估值倍数压力",
    asset_impact: "Equity multiples and cyclicals sensitive",
    asset_impact_zh: "股票估值倍数和周期股更敏感",
  });
  if (drivers.some((driver) => driver.name === "Risk Appetite")) rows.push({
    factor: "Risk appetite shift",
    factor_zh: "风险偏好变化",
    channel: "Positioning and volatility",
    channel_zh: "仓位与波动率",
    asset_impact: "High-beta sectors react first",
    asset_impact_zh: "高贝塔板块率先反应",
  });
  return rows.slice(0, 4);
}

export function getMacroRegime(report) {
  const source = objectValue(report);
  const schema = objectValue(source.macro_analysis);
  const events = getMacroEvents(source);
  const drivers = getMacroDrivers(source);
  const sentiment = events.length ? average(events.map((event) => event.sentiment_score)) : getSentimentStats(source).average;
  const confidenceValues = events.map((event) => event.confidence_score).filter((value) => value > 0);
  const confidence = confidenceValues.length ? average(confidenceValues) : null;
  const outlook = text(source.macro_outlook) || text(source.risk_and_sentiment);
  const outlookZh = text(source.translations?.zh?.macro_outlook) || text(source.translations?.zh?.risk_and_sentiment);
  const bullets = uniqueTexts(splitSentences(outlook));
  const bulletsZh = uniqueTexts(splitSentences(outlookZh));
  const stance = marketStance(sentiment);
  const tension = bullets.find((item) => /but|while|however|risk|pressure|concern/i.test(item)) || keyTension(drivers, sentiment);

  return {
    regime: text(schema.regime) || inferCycleRegime(drivers, sentiment),
    regime_zh: text(schema.regime_zh) || translateMacroPhrase(text(schema.regime) || inferCycleRegime(drivers, sentiment)),
    cycle_position: text(schema.cycle_position) || inferCyclePosition(drivers, sentiment),
    cycle_position_zh: text(schema.cycle_position_zh) || translateMacroPhrase(text(schema.cycle_position) || inferCyclePosition(drivers, sentiment)),
    brief: truncateText(bullets[0] || regimeBriefFromDrivers(drivers, sentiment), 180),
    brief_zh: truncateText(bulletsZh[0] || regimeBriefFromDriversZh(drivers, sentiment), 180),
    stance: text(schema.market_stance) || stance,
    market_stance: text(schema.market_stance) || stance,
    stance_zh: text(schema.market_stance_zh) || translateMacroPhrase(text(schema.market_stance) || stance),
    tension: truncateText(tension, 190),
    tension_zh: truncateText(bulletsZh.find((item) => /但|然而|风险|压力|担忧|矛盾/.test(item)) || keyTensionZh(drivers, sentiment), 190),
    current_regime: regimeFromSentiment(sentiment).label,
    current_regime_zh: translateMacroPhrase(regimeFromSentiment(sentiment).label),
    risk_level: riskLevel(events, sentiment),
    risk_level_zh: translateMacroPhrase(riskLevel(events, sentiment)),
    confidence: parseConfidence(schema.confidence) ?? confidence,
    confidence_basis: [
      "Signal consistency",
      "Data completeness",
      "Macro alignment",
    ],
    confidence_basis_zh: [
      "信号一致性",
      "数据完整度",
      "宏观逻辑匹配度",
    ],
  };
}

export function getMacroInterpretation(report) {
  const source = objectValue(report);
  const events = getMacroEvents(source);
  const drivers = getMacroDrivers(source);
  const overview = text(source.macro_outlook) || text(source.risk_and_sentiment);
  const overviewZh = text(source.translations?.zh?.macro_outlook) || text(source.translations?.zh?.risk_and_sentiment);
  const primary = events[0];
  const why = conciseAnalysis(
    text(primary?.why_it_matters) || firstSentence(overview) || mechanismFromDrivers(drivers),
    "Macro conditions matter because they change discount rates, earnings expectations and risk appetite at the same time.",
  );
  const changed = conciseAnalysis(
    interpretationText(text(primary?.summary), overview, events.map((event) => event.why_it_matters)) || changedFromDrivers(drivers),
    "The report does not provide enough previous-expectation context, so this section should be treated as low confidence.",
  );

  return {
    why_it_matters: why,
    why_it_matters_zh: conciseAnalysis(
      text(primary?.why_it_matters_zh) || firstSentence(overviewZh) || mechanismFromDriversZh(drivers),
      "宏观环境会同时影响折现率、盈利预期和风险偏好，因此会改变股票市场的定价逻辑。",
    ),
    what_changed: changed,
    what_changed_zh: conciseAnalysis(
      text(primary?.summary_zh) || interpretationText("", overviewZh, []) || changedFromDriversZh(drivers),
      "当前报告缺少足够的前后预期对比，因此这一判断应视为低置信度。",
    ),
    what_to_watch: conciseList(normalizeWatchItems(source.what_to_watch_tomorrow).map((item) => item.item), outlookWatchItems(drivers)),
    what_to_watch_zh: conciseList(normalizeWatchItems(source.what_to_watch_tomorrow).map((item) => item.item_zh || translateMacroPhrase(item.item)), outlookWatchItemsZh(drivers)),
    market_impact: macroImpactRows(drivers),
    market_impact_zh: macroImpactRowsZh(drivers),
    low_confidence: !events.length && !overview,
  };
}

export function getMarketOutlook(report) {
  const source = objectValue(report);
  const schema = objectValue(source.macro_analysis);
  const drivers = getMacroDrivers(source);
  const watch = normalizeWatchItems(source.what_to_watch_tomorrow).map((item) => item.item);
  return {
    near_term_catalysts: conciseList(arrayValue(schema.catalysts).map(text), conciseList(watch, ["Fed communication", "Inflation releases", "Earnings guidance"])),
    near_term_catalysts_zh: conciseList(normalizeWatchItems(source.what_to_watch_tomorrow).map((item) => item.item_zh || translateMacroPhrase(item.item)), ["美联储沟通", "通胀数据发布", "企业盈利指引"]),
    potential_risks: conciseList(arrayValue(schema.risks).map(text), conciseList(risksFromDrivers(drivers), ["Growth slowdown", "Earnings disappointment", "Volatility shock"])),
    potential_risks_zh: conciseList(risksFromDriversZh(drivers), ["增长放缓", "盈利不及预期", "波动率冲击"]),
    key_variables: conciseList(variablesFromDrivers(drivers), ["Treasury yields", "Dollar", "Market breadth"]),
    key_variables_zh: conciseList(variablesFromDriversZh(drivers), ["美债收益率", "美元", "市场广度"]),
    upcoming_events: conciseList(arrayValue(schema.upcoming_events).map(text), conciseList(watch, ["CPI", "FOMC", "Earnings"])),
    upcoming_events_zh: conciseList(arrayValue(schema.upcoming_events_zh).map(text), ["CPI", "FOMC", "财报"]),
  };
}

export function getMacroResearchRegime(report) {
  const source = objectValue(report);
  const schema = objectValue(source.macro_analysis?.market_regime);
  const fallback = getMacroRegime(source);
  return {
    title: text(schema.title) || fallback.regime || "Late Cycle",
    title_zh: text(schema.title_zh) || fallback.regime_zh || translateMacroPhrase(fallback.regime),
    summary: text(schema.summary) || fallback.tension || fallback.brief,
    summary_zh: text(schema.summary_zh) || fallback.tension_zh || fallback.brief_zh,
    key_takeaway: text(schema.key_takeaway) || keyTension(getMacroDrivers(source), 0),
    key_takeaway_zh: text(schema.key_takeaway_zh) || keyTensionZh(getMacroDrivers(source), 0),
    stance: text(schema.stance) || fallback.market_stance || fallback.stance,
    stance_zh: text(schema.stance_zh) || fallback.stance_zh,
    confidence: parseConfidence(schema.confidence) ?? fallback.confidence,
  };
}

export function getMacroThemes(report) {
  const source = objectValue(report);
  const explicit = arrayValue(source.macro_analysis?.themes).map((item) => normalizeMacroTheme(item)).filter(Boolean);
  if (explicit.length) return explicit.slice(0, 4);

  return buildInvestmentMacroThemes(source).slice(0, 4);
}

export function getMacroAssetView(report) {
  const source = objectValue(report);
  const explicit = objectValue(source.macro_analysis?.asset_view ?? source.macro_analysis?.market_impact);
  if (Object.keys(explicit).length) {
    return {
      equities: normalizeAssetView("US Equities", explicit.equities),
      equities_zh: normalizeAssetView("美股", explicit.equities_zh || translateMacroPhrase(explicit.equities)),
      rates: normalizeAssetView("Rates", explicit.rates),
      rates_zh: normalizeAssetView("利率", explicit.rates_zh || translateMacroPhrase(explicit.rates)),
      growth_stocks: normalizeAssetView("Growth Stocks", explicit.growth_stocks),
      growth_stocks_zh: normalizeAssetView("成长股", explicit.growth_stocks_zh || translateMacroPhrase(explicit.growth_stocks)),
      financials: normalizeAssetView("Financials", explicit.financials),
      financials_zh: normalizeAssetView("金融股", explicit.financials_zh || translateMacroPhrase(explicit.financials)),
      sectors: normalizeSectorImpact(explicit.sectors),
      sectors_zh: normalizeSectorImpact(explicit.sectors_zh),
    };
  }

  const drivers = getMacroDrivers(source);
  const hasLaborWeakness = drivers.some((driver) => driver.name === "Labor Market" && /weak|slow|cool/i.test(`${driver.status} ${driver.signal}`));
  const hasFed = drivers.some((driver) => driver.name === "Fed Policy");
  return {
    equities: { label: "US Equities", stance: "Neutral / Cautious", note: "Growth concerns offset part of the support from easier policy expectations." },
    equities_zh: { label: "股票", stance: "中性 / 谨慎", note: "增长担忧部分抵消了宽松政策预期带来的支撑。" },
    rates: { label: "Rates", stance: hasLaborWeakness ? "Positive" : "Neutral", note: hasLaborWeakness ? "Lower growth momentum supports yields decline." : "Rate direction needs confirmation from inflation and Fed communication." },
    rates_zh: { label: "利率", stance: hasLaborWeakness ? "正面" : "中性", note: hasLaborWeakness ? "增长动能走弱支持收益率下行。" : "利率方向仍需通胀和美联储沟通确认。" },
    growth_stocks: { label: "Growth Stocks", stance: hasFed ? "Sensitive / Supported" : "Sensitive", note: "Duration exposure makes growth stocks highly responsive to rate expectations." },
    growth_stocks_zh: { label: "成长股", stance: hasFed ? "敏感 / 受支撑" : "敏感", note: "长久期属性使成长股对利率预期高度敏感。" },
    financials: { label: "Financials", stance: "Mixed", note: "Lower yields can pressure net interest margins while softer growth raises credit sensitivity." },
    financials_zh: { label: "金融股", stance: "混合", note: "收益率下行可能压制净息差，而增长放缓会提高信用风险敏感度。" },
    sectors: { positive: ["Technology", "Defensives"], negative: ["Cyclicals", "Small caps"] },
    sectors_zh: { positive: ["科技", "防御板块"], negative: ["周期股", "小盘股"] },
  };
}

export function getMacroForwardBrief(report) {
  const source = objectValue(report);
  const schema = objectValue(source.macro_analysis);
  const watchNext = objectValue(schema.watch_next);
  const outlook = getMarketOutlook(source);
  return {
    macro_data: conciseList(stringList(watchNext.macro_data), ["CPI", "Payrolls", "ISM"]),
    macro_data_zh: conciseList(stringList(watchNext.macro_data_zh), ["CPI", "非农", "ISM"]),
    policy: conciseList(stringList(watchNext.policy), ["FOMC", "Fed speakers", "Treasury auctions"]),
    policy_zh: conciseList(stringList(watchNext.policy_zh), ["FOMC", "美联储官员讲话", "美债拍卖"]),
    company_events: conciseList(stringList(watchNext.company_events), ["Earnings season", "AI capex updates", "Semiconductor guidance"]),
    company_events_zh: conciseList(stringList(watchNext.company_events_zh), ["财报季", "AI 资本开支更新", "半导体指引"]),
    catalysts: conciseList(arrayValue(schema.catalysts).map(text), outlook.near_term_catalysts),
    catalysts_zh: conciseList(arrayValue(schema.catalysts_zh).map(text), outlook.near_term_catalysts_zh),
    risks: conciseList(arrayValue(schema.risks).map(text), outlook.potential_risks),
    risks_zh: conciseList(arrayValue(schema.risks_zh).map(text), outlook.potential_risks_zh),
    events: conciseList(arrayValue(schema.events).map(text), outlook.upcoming_events),
    events_zh: conciseList(arrayValue(schema.events_zh).map(text), outlook.upcoming_events_zh),
  };
}

export function getSentimentStats(report) {
  const events = getAllEvents(report);
  const counts = { Positive: 0, Negative: 0, Neutral: 0 };
  for (const event of events) {
    if (event.sentiment_score > 0.1) counts.Positive += 1;
    else if (event.sentiment_score < -0.1) counts.Negative += 1;
    else counts.Neutral += 1;
  }
  return { average: average(events.map((event) => event.sentiment_score)), counts };
}

export function getSectorStats(report) {
  const counts = new Map();
  for (const event of getAllEvents(report)) {
    if (!event.sector || isGenericClassification(event.sector)) continue;
    const current = counts.get(event.sector) ?? { name: event.sector, count: 0, total_impact: 0, total_sentiment: 0 };
    current.count += 1;
    current.total_impact += event.impact_score;
    current.total_sentiment += event.sentiment_score;
    counts.set(event.sector, current);
  }
  return [...counts.values()]
    .map((item) => ({ ...item, avg_impact: item.total_impact / item.count, avg_sentiment: item.total_sentiment / item.count }))
    .sort((a, b) => b.count - a.count || b.avg_impact - a.avg_impact);
}

export function getMacroAnalysis(report) {
  const source = objectValue(report);
  const drivers = getMacroDrivers(source);
  const regime = getMacroRegime(source);
  const interpretation = getMacroInterpretation(source);
  const outlook = getMarketOutlook(source);
  const marketRegime = getMacroResearchRegime(source);
  const themes = getMacroThemes(source);
  const assetView = getMacroAssetView(source);
  const forward = getMacroForwardBrief(source);

  return {
    has_data: Boolean(marketRegime.title || themes.length || regime.brief || interpretation.why_it_matters || drivers.length),
    market_regime: marketRegime,
    themes,
    asset_view: assetView,
    forward,
    regime,
    scorecard: getMacroScorecard(source),
    interpretation,
    transmission: getMacroTransmission(source),
    drivers: drivers.slice(0, 4),
    outlook,
  };
}

export function getEventFilterOptions(report) {
  const events = getAllEvents(report);
  return {
    sectors: unique(events.map((event) => event.sector).filter((value) => value && !isGenericClassification(value))),
    themes: unique(events.flatMap((event) => event.themes)),
    sources: unique(events.flatMap((event) => event.sources.length ? event.sources : [event.primary_source]).filter(Boolean)),
  };
}

function normalizeEvent(event, index, newsItems) {
  const record = objectValue(event);
  const articles = arrayValue(record.articles);
  const firstArticle = objectValue(articles[0]);
  const matchingNews = findMatchingNewsItem(record, firstArticle, newsItems);
  const sourceNames = sourceList(record.source_names).length
    ? sourceList(record.source_names)
    : articles.map((article) => sourceText(article?.source_name ?? article?.source)).filter(Boolean);
  const title = text(record.title);
  const summary = text(record.summary ?? record.one_line_summary);
  const themes = stringList(record.topics ?? record.themes);
  const entities = stringList(record.entities ?? record.keywords);
  const tickers = stringList(record.related_tickers ?? record.affected_assets ?? record.affected_markets);
  const impactScore = bounded(record.impact_score ?? record.market_impact_score, 0, 100);
  const finalScore = bounded(record.final_score, 0, 100);
  const primarySource = sourceText(record.primary_source ?? record.source_name ?? firstArticle.source_name ?? firstArticle.source ?? matchingNews.source_name ?? matchingNews.source) || sourceNames[0] || "Unknown Source";

  return {
    id: text(record.id ?? record.event_id) || `event-${index}`,
    event_id: text(record.event_id),
    title,
    title_zh: text(record.title_zh ?? record.translations?.zh?.title),
    zh_title: text(record.zh_title),
    translated_title: text(record.translated_title),
    summary,
    summary_zh: text(record.summary_zh ?? record.translations?.zh?.summary),
    zh_summary: text(record.zh_summary),
    translated_summary: text(record.translated_summary),
    one_line_summary: text(record.one_line_summary ?? summary),
    one_line_summary_zh: text(record.one_line_summary_zh ?? record.summary_zh ?? record.translations?.zh?.summary),
    translated_one_line_summary: text(record.translated_one_line_summary ?? record.translated_summary),
    image_url: normalizeImageUrl(firstImage(record, firstArticle, matchingNews)),
    impact_score: impactScore,
    sentiment_score: bounded(record.sentiment_score, -1, 1),
    confidence_score: normalizeConfidence(record.confidence_score),
    decision_score: finalScore || impactScore,
    final_score: finalScore,
    timestamp: text(record.timestamp ?? record.published_at ?? record.detected_at ?? firstArticle.published_at),
    sector: text(record.sector) || "Cross-market",
    event_type: text(record.event_type) || "Market event",
    time_horizon: text(record.time_horizon),
    themes,
    theme: themes[0] || text(record.event_type) || "Market event",
    category: classifyEvent(record),
    entities,
    company: text(record.company) || entities[0] || "",
    tickers,
    sources: sourceNames.length ? sourceNames : [primarySource],
    primary_source: primarySource,
    source_url: firstUrl(record, firstArticle, matchingNews),
    source_count: Number(record.source_count) || articles.length || 1,
    why_it_matters: text(record.why_it_matters),
    why_it_matters_zh: text(record.why_it_matters_zh ?? record.translations?.zh?.why_it_matters),
  };
}

function normalizeSnapshot(snapshot, sentimentAverage, marketHistory) {
  const source = objectValue(snapshot);
  const rows = Array.isArray(snapshot) ? snapshot : arrayValue(source.indices ?? source.items);
  const indices = INDEX_DEFINITIONS.map((definition) => {
    const match = rows.find((row) => {
      const haystack = `${row?.name ?? ""} ${row?.symbol ?? ""}`.toLowerCase();
      return definition.aliases.some((alias) => haystack.includes(alias));
    });
    const fallback = snapshotHistoryFallback(definition, marketHistory);
    const price = finiteOrNull(match?.price ?? match?.last ?? match?.value);
    const changePct = finiteOrNull(match?.change_pct ?? match?.percent_change);
    return {
      id: definition.id,
      label: definition.label,
      symbol: text(match?.symbol) || fallback.symbol || definition.label,
      price: price ?? fallback.price,
      change_pct: changePct ?? fallback.change_pct,
      is_stale: Boolean(match?.is_stale) || (price == null && fallback.price != null),
      stale_as_of: text(match?.stale_as_of) || fallback.time,
    };
  });
  const sourceSentiment = objectValue(source.sentiment);
  const score = sourceSentiment.score == null ? sentimentAverage : bounded(sourceSentiment.score, -1, 1);
  return {
    indices,
    sentiment: { score, label: text(sourceSentiment.label) || regimeFromSentiment(score).label },
    as_of: text(source.as_of ?? source.updated_at),
  };
}

function snapshotHistoryFallback(definition, marketHistory) {
  const series = objectValue(marketHistory?.series);
  const candidateKeys = [
    definition.label,
    definition.id,
    ...(definition.historyAliases ?? []),
    ...definition.aliases,
  ];
  for (const key of candidateKeys) {
    const points = arrayValue(series[key]);
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      const price = finiteOrNull(point?.price);
      if (price == null) continue;
      return {
        symbol: text(point?.symbol),
        price,
        change_pct: finiteOrNull(point?.change_pct),
        time: text(point?.time),
      };
    }
  }
  return {};
}

function normalizeThemes(value) {
  return arrayValue(value).map((theme) => ({
    name: text(theme?.name),
    importance_score: bounded(theme?.importance_score, 0, 100),
  })).filter((theme) => theme.name).sort((a, b) => b.importance_score - a.importance_score);
}

function normalizeWatchItems(value) {
  if (typeof value === "string") return splitSentences(value).map((item) => ({ item, why_it_matters: "" }));
  return arrayValue(value).map((entry) => ({
    item: text(entry?.item ?? entry?.title ?? entry?.name),
    item_zh: text(entry?.item_zh ?? entry?.translations?.zh?.item),
    why_it_matters: text(entry?.why_it_matters ?? entry?.summary),
    why_it_matters_zh: text(entry?.why_it_matters_zh ?? entry?.translations?.zh?.why_it_matters),
  })).filter((entry) => entry.item);
}

function normalizeSchemaDrivers(value) {
  return arrayValue(value).map((item) => {
    const name = text(item?.name);
    if (!name) return null;
    const status = text(item?.status) || "Mixed";
    const trend = normalizeTrend(item?.trend);
    const marketImpact = text(item?.market_impact ?? item?.impact);
    return {
      name,
      name_zh: text(item?.name_zh) || macroDriverNameZh(name),
      stance: status,
      status,
      status_zh: text(item?.status_zh) || translateMacroPhrase(status),
      trend,
      trend_zh: text(item?.trend_zh) || translateMacroPhrase(trend),
      signal: text(item?.signal),
      signal_zh: text(item?.signal_zh),
      market_impact: marketImpact,
      market_impact_zh: text(item?.market_impact_zh ?? item?.impact_zh) || translateMacroPhrase(marketImpact),
      confidence: text(item?.confidence) || "Medium",
      confidence_zh: text(item?.confidence_zh) || translateMacroPhrase(item?.confidence || "Medium"),
      related_event_count: 0,
      sentiment_score: sentimentFromImpact(marketImpact),
      impact_score: 70,
    };
  }).filter(Boolean).slice(0, 4);
}

function normalizeMacroTheme(item) {
  const record = objectValue(item);
  const title = normalizeInvestmentThemeTitle(text(record.title || record.name));
  if (!title) return null;
  const impact = objectValue(record.market_impact);
  const summary = text(record.current_view ?? record.summary);
  const keySignals = stringList(record.key_signals);
  return {
    title,
    title_zh: text(record.title_zh) || translateMacroPhrase(title),
    summary,
    summary_zh: text(record.summary_zh),
    current_view: summary,
    current_view_zh: text(record.current_view_zh ?? record.summary_zh),
    what_changed: text(record.what_changed) || keySignals[0] || "",
    what_changed_zh: text(record.what_changed_zh) || stringList(record.key_signals_zh)[0] || "",
    why_it_matters: text(record.why_it_matters ?? record.explanation),
    why_it_matters_zh: text(record.why_it_matters_zh ?? record.explanation_zh),
    key_signals: keySignals,
    key_signals_zh: stringList(record.key_signals_zh),
    market_impact: {
      equities: text(impact.equities),
      rates: text(impact.rates),
      sectors: stringList(impact.sectors),
    },
    market_impact_zh: {
      equities: text(impact.equities_zh) || translateMacroPhrase(impact.equities),
      rates: text(impact.rates_zh) || translateMacroPhrase(impact.rates),
      sectors: stringList(impact.sectors_zh).length ? stringList(impact.sectors_zh) : stringList(impact.sectors).map(translateMacroPhrase),
    },
    watch_next: stringList(record.watch_next),
    watch_next_zh: stringList(record.watch_next_zh),
  };
}

function buildInvestmentMacroThemes(source) {
  const drivers = getMacroDrivers(source);
  const events = getAllEvents(source);
  const fedDriver = findDriverNarrative(drivers, /fed|rate|treasury/i);
  const growthDriver = findDriverNarrative(drivers, /labor|growth|macro/i);
  const aiEvents = events.filter((event) => /ai|semiconductor|chip|nvidia|nvda|amd|soxx|cloud|capex/i.test(macroContext(event)));
  const earningsEvents = events.filter((event) => /earnings|guidance|revenue|margin|valuation|multiple/i.test(macroContext(event)));

  return [
    themeFromResearchInputs({
      title: "Fed Policy & Rate Path",
      driver: fedDriver,
      currentView: "Policy remains restrictive, but market pricing is increasingly sensitive to any evidence that cuts can move closer.",
      whatChanged: fedDriver?.signal || "Rate expectations are being repriced through labor, inflation and Treasury-yield signals.",
      whyItMatters: "The rate path is the main bridge between macro data and equity multiples, especially for long-duration growth exposure.",
      marketImpact: { equities: "Neutral for broad indexes; supportive for duration if growth does not break.", rates: "Bullish if data softens and inflation stays contained.", sectors: ["Positive: Technology and rate-sensitive growth", "Negative: Banks if curve pressure returns"] },
      watchNext: ["CPI", "FOMC", "Fed speakers"],
    }),
    themeFromResearchInputs({
      title: "Growth & Labor Market",
      driver: growthDriver,
      currentView: "Growth risk is the swing factor for whether lower yields are interpreted as support or as a warning signal.",
      whatChanged: growthDriver?.signal || "Investors are watching whether softer activity data remains orderly or starts to challenge earnings assumptions.",
      whyItMatters: "Labor and demand data affect both forward earnings and the Fed reaction function, so the same data can move rates and equities in opposite ways.",
      marketImpact: { equities: "Cautious until breadth confirms resilience.", rates: "Lower yields if growth momentum cools.", sectors: ["Positive: Defensives and quality balance sheets", "Negative: Cyclicals, small caps and credit-sensitive financials"] },
      watchNext: ["Payrolls", "Jobless claims", "ISM"],
    }),
    themeFromResearchInputs({
      title: "AI & Technology Leadership",
      events: aiEvents,
      currentView: "AI leadership remains the clearest equity-specific support, but the trade is more dependent on capex durability and rate stability.",
      whatChanged: aiEvents[0]?.summary || aiEvents[0]?.title || "Technology leadership is still carrying a large share of index-level risk appetite.",
      whyItMatters: "Concentrated technology leadership can keep indexes resilient even when the broader tape is mixed, but it raises crowding and valuation risk.",
      marketImpact: { equities: "Supportive for Nasdaq leadership if yields stay contained.", rates: "High duration sensitivity to discount-rate repricing.", sectors: ["Positive: Semiconductors, cloud infrastructure and mega-cap platforms", "Negative: Unprofitable long-duration software if yields rise"] },
      watchNext: ["AI capex guidance", "Semiconductor earnings", "Mega-cap margins"],
    }),
    themeFromResearchInputs({
      title: "Earnings & Valuation",
      events: earningsEvents,
      currentView: "Elevated multiples require earnings delivery and credible guidance rather than headline momentum alone.",
      whatChanged: earningsEvents[0]?.summary || earningsEvents[0]?.title || "The market is shifting from macro-only repricing toward guidance, margin and demand confirmation.",
      whyItMatters: "Valuation leaves less room for disappointment when growth signals weaken, making earnings breadth important for market durability.",
      marketImpact: { equities: "Neutral / cautious until earnings leadership broadens.", rates: "Lower yields can help multiples but cannot offset weak guidance.", sectors: ["Positive: Quality compounders and cash generators", "Negative: Margin-sensitive cyclicals and expensive defensives"] },
      watchNext: ["Earnings season", "Margin guidance", "Buyback commentary"],
    }),
  ];
}

function themeFromResearchInputs({ title, driver, events = [], currentView, whatChanged, whyItMatters, marketImpact, watchNext }) {
  const eventSignals = uniqueTexts(events.slice(0, 2).map((event) => event.title));
  return {
    title,
    title_zh: translateMacroPhrase(title),
    summary: currentView,
    summary_zh: translateMacroPhrase(currentView),
    current_view: currentView,
    current_view_zh: translateMacroPhrase(currentView),
    what_changed: whatChanged,
    what_changed_zh: translateMacroPhrase(whatChanged),
    why_it_matters: whyItMatters,
    why_it_matters_zh: translateMacroPhrase(whyItMatters),
    key_signals: uniqueTexts([driver?.status, driver?.signal, ...eventSignals].filter(Boolean)).slice(0, 3),
    key_signals_zh: uniqueTexts([driver?.status_zh, driver?.signal_zh, ...eventSignals].filter(Boolean)).slice(0, 3),
    market_impact: marketImpact,
    market_impact_zh: {
      equities: translateMacroPhrase(marketImpact.equities),
      rates: translateMacroPhrase(marketImpact.rates),
      sectors: marketImpact.sectors.map(translateMacroPhrase),
    },
    watch_next: watchNext,
    watch_next_zh: watchNext.map(translateMacroPhrase),
  };
}

function themeFromDriver(driver) {
  const title = normalizeInvestmentThemeTitle(driver.name === "Fed Policy" ? "Fed Policy & Rate Path" : driver.name);
  return {
    title,
    title_zh: driver.name === "Fed Policy" ? "美联储政策与利率" : macroDriverNameZh(driver.name),
    summary: driver.signal || driver.market_impact || driver.explanation,
    summary_zh: driver.signal_zh || driver.market_impact_zh || driver.explanation_zh,
    current_view: driver.signal || driver.market_impact || driver.explanation,
    current_view_zh: driver.signal_zh || driver.market_impact_zh || driver.explanation_zh,
    what_changed: driver.status || "",
    what_changed_zh: driver.status_zh || "",
    why_it_matters: driver.market_impact || driver.explanation,
    why_it_matters_zh: driver.market_impact_zh || driver.explanation_zh,
    key_signals: uniqueTexts([driver.status, driver.signal].filter(Boolean)).slice(0, 3),
    key_signals_zh: uniqueTexts([driver.status_zh, driver.signal_zh].filter(Boolean)).slice(0, 3),
    market_impact: themeMarketImpact(driver.name),
    market_impact_zh: themeMarketImpactZh(driver.name),
    watch_next: themeWatchNext(driver.name),
    watch_next_zh: themeWatchNextZh(driver.name),
  };
}

function themeMarketImpact(name) {
  if (name === "Fed Policy") return { equities: "Multiple sensitivity", rates: "Policy repricing", sectors: "Growth and duration assets" };
  if (name === "Labor Market") return { equities: "Cautious", rates: "Yields lower if weakness persists", sectors: "Cyclicals and financials" };
  if (name === "Treasury Market") return { equities: "Valuation pressure", rates: "Volatility channel", sectors: "Rate-sensitive sectors" };
  return { equities: "Risk positioning", rates: "Secondary", sectors: "High-beta sectors" };
}

function themeMarketImpactZh(name) {
  if (name === "Fed Policy") return { equities: "估值倍数敏感", rates: "政策预期重定价", sectors: "成长股和长久期资产" };
  if (name === "Labor Market") return { equities: "谨慎", rates: "若走弱持续则收益率下行", sectors: "周期股和金融股" };
  if (name === "Treasury Market") return { equities: "估值压力", rates: "波动率通道", sectors: "利率敏感板块" };
  return { equities: "风险仓位", rates: "次级影响", sectors: "高贝塔板块" };
}

function themeWatchNext(name) {
  if (name === "Fed Policy") return ["FOMC", "CPI", "Fed speakers"];
  if (name === "Labor Market") return ["Payroll revisions", "Jobless claims", "Wage data"];
  if (name === "Treasury Market") return ["10-year yield", "Treasury auctions", "Inflation data"];
  return ["VIX", "Market breadth", "High-beta leadership"];
}

function themeWatchNextZh(name) {
  if (name === "Fed Policy") return ["FOMC", "CPI", "美联储官员讲话"];
  if (name === "Labor Market") return ["非农修正", "初请失业金", "工资数据"];
  if (name === "Treasury Market") return ["10年期美债收益率", "美债拍卖", "通胀数据"];
  return ["VIX", "市场广度", "高贝塔领涨情况"];
}

function dedupeThemes(themes) {
  const seen = new Set();
  return themes.filter((theme) => {
    const key = comparableTitle(theme.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeAssetView(label, value) {
  if (value && typeof value === "object") {
    return {
      label,
      stance: text(value.stance ?? value.view ?? value.current),
      note: text(value.note ?? value.reason ?? value.summary ?? value.impact),
    };
  }
  return { label, stance: text(value) || "Mixed", note: "" };
}

function normalizeSectorImpact(value) {
  if (Array.isArray(value)) {
    const positive = [];
    const negative = [];
    for (const row of value) {
      if (row && typeof row === "object") {
        positive.push(...stringList(row.positive));
        negative.push(...stringList(row.negative));
      } else {
        const item = text(row);
        if (/negative|pressure|risk|loser/i.test(item)) negative.push(item);
        else if (item) positive.push(item);
      }
    }
    return {
      positive: uniqueTexts(positive).slice(0, 4),
      negative: uniqueTexts(negative).slice(0, 4),
    };
  }
  return { positive: [], negative: [] };
}

function normalizeInvestmentThemeTitle(value) {
  const key = text(value).toLowerCase();
  if (!key) return "";
  if (/fed|rate|treasury|yield/.test(key)) return "Fed Policy & Rate Path";
  if (/labor|jobs|payroll|growth|macro/.test(key)) return "Growth & Labor Market";
  if (/ai|technology|semiconductor|chip|big tech/.test(key)) return "AI & Technology Leadership";
  if (/earnings|valuation|profit|margin/.test(key)) return "Earnings & Valuation";
  return text(value);
}

function normalizeTrend(value) {
  const result = text(value);
  if (["↑", "↓", "→"].includes(result)) return result;
  if (/up|rising|improv|positive|constructive/i.test(result)) return "↑";
  if (/down|fall|weak|negative|deterior/i.test(result)) return "↓";
  return "→";
}

function parseConfidence(value) {
  if (value == null || value === "") return null;
  const number = Number(String(value).replace("%", ""));
  if (!Number.isFinite(number)) return null;
  return number <= 1 ? number * 100 : number;
}

function trendFromSentiment(value) {
  const number = Number(value) || 0;
  if (number > 0.1) return "↑";
  if (number < -0.1) return "↓";
  return "→";
}

function sentimentFromImpact(value) {
  const result = text(value).toLowerCase();
  if (/positive|support|constructive|upside/.test(result)) return 0.25;
  if (/negative|pressure|risk|downside|volatile/.test(result)) return -0.25;
  return 0;
}

function scorecardCurrent(factor, relatedEvents, sentiment) {
  const context = relatedEvents.map(macroContext).join(" ");
  if (factor === "Inflation") {
    if (/stagflation|price pressure|tariff/i.test(context)) return "Sticky";
    return relatedEvents.length ? "Mixed" : "No clear signal";
  }
  if (factor === "Labor Market") return driverStatus("Labor Market", sentiment, relatedEvents);
  if (factor === "Fed Policy") return driverStatus("Fed Policy", sentiment, relatedEvents);
  if (factor === "Treasury Market") return driverStatus("Treasury Market", sentiment, relatedEvents);
  if (factor === "Liquidity") return sentiment > 0.1 ? "Improving" : sentiment < -0.1 ? "Tightening" : "Mixed";
  if (factor === "Risk Appetite") return driverStatus("Risk Appetite", sentiment, relatedEvents);
  return "Mixed";
}

function scorecardImpact(factor, sentiment) {
  if (factor === "Inflation") return sentiment < -0.1 ? "Negative" : "Mixed";
  if (factor === "Labor Market") return sentiment < -0.1 ? "Negative" : "Mixed";
  if (factor === "Fed Policy") return sentiment > 0.1 ? "Positive" : sentiment < -0.1 ? "Negative" : "Mixed";
  if (factor === "Treasury Market") return sentiment > 0.1 ? "Positive" : sentiment < -0.1 ? "Negative" : "Mixed";
  if (factor === "Liquidity") return sentiment > 0.1 ? "Positive" : sentiment < -0.1 ? "Negative" : "Mixed";
  if (factor === "Risk Appetite") return sentiment > 0.1 ? "Positive" : sentiment < -0.1 ? "Negative" : "Mixed";
  return "Mixed";
}

function inferCycleRegime(drivers, sentiment) {
  if (drivers.some((driver) => driver.name === "Labor Market" && /weak|slow|cool/i.test(`${driver.status} ${driver.signal}`))) return "Late Cycle Slowdown";
  if (sentiment < -0.25) return "Risk-off Environment";
  if (sentiment > 0.2) return "Reacceleration";
  return "Late Cycle";
}

function inferCyclePosition(drivers, sentiment) {
  if (drivers.some((driver) => driver.name === "Labor Market" && /weak|slow|cool/i.test(`${driver.status} ${driver.signal}`))) return "Slowdown";
  if (sentiment < -0.25) return "Recession";
  if (sentiment > 0.2) return "Expansion";
  return "Late Cycle";
}

function isDriverRelevant(event, definition) {
  const context = macroContext(event);
  if (!definition.pattern.test(context)) return false;
  if (event.impact_score < 40 && event.decision_score < 40) return false;
  return true;
}

function buildDriverExplanation(definition, relatedEvents, usedExplanations, language = "en") {
  const candidates = relatedEvents.flatMap((event) => {
    const summary = language === "zh" ? event.summary_zh || event.summary : event.summary;
    const why = language === "zh" ? event.why_it_matters_zh || event.why_it_matters : event.why_it_matters;
    return [why, summary, event.one_line_summary, event.title].map(text).filter(Boolean);
  });
  const uniqueCandidates = uniqueTexts(candidates);
  const selected = uniqueCandidates.find((candidate) => {
    return definition.pattern.test(candidate) && !usedExplanations.some((used) => isNearDuplicate(used, candidate));
  });
  if (selected) return truncateText(selected, 190);
  return `Detected from ${relatedEvents.length} related events; details are limited in the current report.`;
}

function buildDriverSignal(definition, relatedEvents, usedExplanations) {
  const context = relatedEvents.map(macroContext).join(" ");
  if (definition.name === "Labor Market") {
    if (/miss|slow|weak|participation|unemployment/i.test(context)) return "Labor momentum is cooling, with payroll and participation signals pointing to weaker growth quality.";
    return "Labor data is a central input for the growth and policy outlook, but the current report does not provide a clear directional break.";
  }
  if (definition.name === "Fed Policy") {
    if (/cut|easing|dovish/i.test(context)) return "Policy expectations are shifting toward easier financial conditions as investors reassess growth and inflation risks.";
    if (/hike|hawkish|higher for longer/i.test(context)) return "Policy expectations remain restrictive, keeping discount-rate pressure on long-duration equities.";
    return "Fed expectations are being repriced through the growth-data channel rather than a single policy announcement.";
  }
  if (definition.name === "Treasury Market") {
    if (/yield|treasury|bond/i.test(context)) return "Treasury-market signals are part of the valuation channel, with yields influencing equity multiples and risk positioning.";
    return "Bond-market confirmation is limited, so this driver should be treated as a secondary macro channel.";
  }
  if (definition.name === "Risk Appetite") {
    if (/risk[- ]?off|sell[- ]?off|vix|weak|pressure/i.test(context)) return "Risk appetite is fragile, with high-beta assets sensitive to macro repricing and volatility.";
    if (/rally|surge|risk[- ]?on|bitcoin|crypto/i.test(context)) return "Risk appetite is selectively improving in high-beta assets, but confirmation from broader market breadth is still needed.";
    return "Risk positioning is mixed, with investors waiting for clearer confirmation from breadth and volatility.";
  }
  const explanation = buildDriverExplanation(definition, relatedEvents, usedExplanations);
  return conciseAnalysis(explanation, `Detected from ${relatedEvents.length} related macro signals.`);
}

function buildDriverSignalZh(definition, relatedEvents) {
  const context = relatedEvents.map(macroContext).join(" ");
  if (definition.name === "Labor Market") {
    if (/miss|slow|weak|participation|unemployment/i.test(context)) return "就业动能正在降温，非农和劳动参与率信号显示增长质量走弱。";
    return "就业数据仍是判断增长和政策路径的核心变量，但当前报告没有给出明确单边突破。";
  }
  if (definition.name === "Fed Policy") {
    if (/cut|easing|dovish/i.test(context)) return "随着投资者重新评估增长和通胀风险，政策预期正转向更宽松的金融条件。";
    if (/hike|hawkish|higher for longer/i.test(context)) return "政策预期仍偏紧，对长久期股票形成折现率压力。";
    return "美联储预期正在通过增长数据重新定价，而不是来自单一政策声明。";
  }
  if (definition.name === "Treasury Market") {
    if (/yield|treasury|bond/i.test(context)) return "美债市场是估值传导渠道，收益率变化会影响股票估值倍数和风险偏好。";
    return "债券市场确认度有限，因此该驱动应视为次级宏观通道。";
  }
  if (definition.name === "Risk Appetite") {
    if (/risk[- ]?off|sell[- ]?off|vix|weak|pressure/i.test(context)) return "风险偏好较脆弱，高贝塔资产对宏观重新定价和波动率更敏感。";
    if (/rally|surge|risk[- ]?on|bitcoin|crypto/i.test(context)) return "高贝塔资产的风险偏好有选择性改善，但仍需要市场广度确认。";
    return "风险仓位整体偏混合，投资者仍在等待市场广度和波动率给出更清晰确认。";
  }
  return `从 ${relatedEvents.length} 个相关宏观信号中识别，当前报告细节有限。`;
}

function buildDriverMarketImpact(name, sentiment) {
  const tone = sentiment < -0.1 ? "pressures" : sentiment > 0.1 ? "supports" : "keeps investors focused on";
  if (name === "Labor Market") return `Labor data ${tone} the balance between rate-cut hopes and earnings risk.`;
  if (name === "Fed Policy") return `Fed expectations ${tone} liquidity, discount rates and equity duration exposure.`;
  if (name === "Treasury Market") return `Yield moves ${tone} valuation multiples and cross-asset risk appetite.`;
  return `Risk appetite ${tone} positioning in equities, crypto and high-beta sectors.`;
}

function buildDriverMarketImpactZh(name, sentiment) {
  const tone = sentiment < -0.1 ? "压制" : sentiment > 0.1 ? "支撑" : "使投资者继续关注";
  if (name === "Labor Market") return `就业数据会${tone}降息预期与盈利风险之间的平衡。`;
  if (name === "Fed Policy") return `美联储预期会${tone}流动性、折现率和长久期股票敞口。`;
  if (name === "Treasury Market") return `收益率变化会${tone}估值倍数和跨资产风险偏好。`;
  return `风险偏好会${tone}股票、加密资产和高贝塔板块的仓位。`;
}

function driverStatus(name, sentiment, relatedEvents) {
  const context = relatedEvents.map(macroContext).join(" ");
  if (name === "Labor Market") {
    if (/miss|slow|weak|unemployment|participation declined|fewer/i.test(context)) return "Weakening";
    if (/strong|beat|hiring|employment growth/i.test(context)) return "Improving";
  }
  if (name === "Fed Policy") {
    if (/cut|easing|dovish/i.test(context)) return "Easing bias";
    if (/hike|hawkish|higher for longer/i.test(context)) return "Restrictive";
  }
  if (name === "Treasury Market") {
    if (/yield.*rise|rising yield|higher yield/i.test(context)) return "Yields rising";
    if (/yield.*fall|lower yield|declining yield/i.test(context)) return "Yields easing";
  }
  if (name === "Risk Appetite") {
    if (sentiment < -0.1) return "Defensive";
    if (sentiment > 0.1) return "Constructive";
  }
  return "Mixed";
}

function confidenceLabel(relatedEvents) {
  if (relatedEvents.length >= 5) return "High";
  if (relatedEvents.length >= 2) return "Medium";
  return "Low";
}

function macroDriverNameZh(name) {
  return {
    "Labor Market": "就业市场",
    "Fed Policy": "美联储政策",
    "Treasury Market": "美债市场",
    "Risk Appetite": "风险偏好",
  }[name] || name;
}

function conciseAnalysis(value, fallback) {
  const sentences = uniqueTexts(splitSentences(value)).slice(0, 3);
  return truncateText(sentences.join(" "), 360) || fallback;
}

function conciseList(primary, fallback) {
  const values = uniqueTexts([...(primary ?? []), ...fallback]).filter(Boolean);
  return values.slice(0, 4);
}

function regimeBriefFromDrivers(drivers, sentiment) {
  const dominant = drivers[0]?.name || "macro data";
  if (sentiment < -0.1) return `${dominant} is keeping the macro regime cautious, with investors prioritizing downside risk.`;
  if (sentiment > 0.1) return `${dominant} is supporting a more constructive macro setup, though confirmation is still needed.`;
  return `${dominant} is leaving the macro regime mixed, with investors balancing growth, policy and valuation signals.`;
}

function regimeBriefFromDriversZh(drivers, sentiment) {
  const dominant = drivers[0]?.name_zh || macroDriverNameZh(drivers[0]?.name) || "宏观数据";
  if (sentiment < -0.1) return `${dominant}使宏观状态偏谨慎，投资者更关注下行风险。`;
  if (sentiment > 0.1) return `${dominant}支撑更积极的宏观环境，但仍需要进一步确认。`;
  return `${dominant}使宏观状态保持混合，投资者需要在增长、政策和估值信号之间权衡。`;
}

function marketStance(sentiment) {
  if (sentiment < -0.2) return "Cautious";
  if (sentiment > 0.2) return "Constructive";
  return "Cautious / Mixed";
}

function keyTension(drivers, sentiment) {
  const hasLabor = drivers.some((driver) => driver.name === "Labor Market");
  const hasFed = drivers.some((driver) => driver.name === "Fed Policy");
  if (hasLabor && hasFed) return "Lower-rate expectations can support liquidity, but weaker growth can pressure earnings expectations.";
  if (sentiment < -0.1) return "Defensive positioning is rising as investors weigh policy support against growth and earnings risks.";
  return "Macro signals are not one-directional, leaving investors sensitive to the next data release.";
}

function keyTensionZh(drivers, sentiment) {
  const hasLabor = drivers.some((driver) => driver.name === "Labor Market");
  const hasFed = drivers.some((driver) => driver.name === "Fed Policy");
  if (hasLabor && hasFed) return "更低利率预期有助于流动性，但增长走弱可能压制盈利预期。";
  if (sentiment < -0.1) return "防御性仓位上升，投资者正在权衡政策支持与增长、盈利风险。";
  return "宏观信号并非单向，市场对下一组关键数据仍高度敏感。";
}

function mechanismFromDrivers(drivers) {
  if (drivers.some((driver) => driver.name === "Treasury Market")) return "The key mechanism is the link between yields, valuation multiples and risk appetite.";
  if (drivers.some((driver) => driver.name === "Fed Policy")) return "The key mechanism is the transmission from Fed expectations into liquidity and discount rates.";
  return "The key mechanism is the interaction between growth expectations, policy expectations and investor positioning.";
}

function mechanismFromDriversZh(drivers) {
  if (drivers.some((driver) => driver.name === "Treasury Market")) return "关键传导机制是收益率、估值倍数和风险偏好之间的联动。";
  if (drivers.some((driver) => driver.name === "Fed Policy")) return "关键传导机制是美联储预期如何影响流动性和折现率。";
  return "关键传导机制是增长预期、政策预期和投资者仓位之间的相互作用。";
}

function changedFromDrivers(drivers) {
  const names = drivers.map((driver) => driver.name).slice(0, 2).join(" and ");
  return names ? `${names} shifted the balance of risks versus prior expectations.` : "";
}

function changedFromDriversZh(drivers) {
  const names = drivers.map((driver) => driver.name_zh || macroDriverNameZh(driver.name)).slice(0, 2).join("和");
  return names ? `${names}改变了市场对风险平衡的判断。` : "";
}

function outlookWatchItems(drivers) {
  const items = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) items.push("Labor data revisions");
  if (drivers.some((driver) => driver.name === "Fed Policy")) items.push("Fed communication");
  if (drivers.some((driver) => driver.name === "Treasury Market")) items.push("Treasury yields");
  if (drivers.some((driver) => driver.name === "Risk Appetite")) items.push("Market breadth");
  return items;
}

function outlookWatchItemsZh(drivers) {
  const items = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) items.push("就业数据修正");
  if (drivers.some((driver) => driver.name === "Fed Policy")) items.push("美联储沟通");
  if (drivers.some((driver) => driver.name === "Treasury Market")) items.push("美债收益率");
  if (drivers.some((driver) => driver.name === "Risk Appetite")) items.push("市场广度");
  return items;
}

function risksFromDrivers(drivers) {
  const items = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) items.push("Growth slowdown");
  if (drivers.some((driver) => driver.name === "Fed Policy")) items.push("Policy repricing");
  if (drivers.some((driver) => driver.name === "Treasury Market")) items.push("Yield volatility");
  if (drivers.some((driver) => driver.name === "Risk Appetite")) items.push("Positioning reversal");
  return items;
}

function risksFromDriversZh(drivers) {
  const items = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) items.push("增长放缓");
  if (drivers.some((driver) => driver.name === "Fed Policy")) items.push("政策预期重新定价");
  if (drivers.some((driver) => driver.name === "Treasury Market")) items.push("收益率波动");
  if (drivers.some((driver) => driver.name === "Risk Appetite")) items.push("仓位反转");
  return items;
}

function variablesFromDrivers(drivers) {
  const items = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) items.push("Payrolls and unemployment");
  if (drivers.some((driver) => driver.name === "Fed Policy")) items.push("Rate-cut probabilities");
  if (drivers.some((driver) => driver.name === "Treasury Market")) items.push("10-year Treasury yield");
  if (drivers.some((driver) => driver.name === "Risk Appetite")) items.push("VIX and market breadth");
  return items;
}

function variablesFromDriversZh(drivers) {
  const items = [];
  if (drivers.some((driver) => driver.name === "Labor Market")) items.push("非农和失业率");
  if (drivers.some((driver) => driver.name === "Fed Policy")) items.push("降息概率");
  if (drivers.some((driver) => driver.name === "Treasury Market")) items.push("10年期美债收益率");
  if (drivers.some((driver) => driver.name === "Risk Appetite")) items.push("VIX 和市场广度");
  return items;
}

function macroImpactRows(drivers) {
  const hasLaborWeakness = drivers.some((driver) => driver.name === "Labor Market" && /weak|slow|cool/i.test(`${driver.status} ${driver.signal}`));
  const hasFed = drivers.some((driver) => driver.name === "Fed Policy");
  const hasRisk = drivers.some((driver) => driver.name === "Risk Appetite");
  return [
    { label: "Rates", direction: hasLaborWeakness || hasFed ? "↓" : "→", tone: hasLaborWeakness || hasFed ? "positive" : "neutral" },
    { label: "Growth Stocks", direction: hasFed ? "↑" : "→", tone: hasFed ? "positive" : "neutral" },
    { label: "Cyclicals", direction: hasLaborWeakness || hasRisk ? "↓" : "→", tone: hasLaborWeakness || hasRisk ? "negative" : "neutral" },
  ];
}

function macroImpactRowsZh(drivers) {
  return macroImpactRows(drivers).map((item) => ({
    ...item,
    label: translateMacroPhrase(item.label),
  }));
}

function translateMacroPhrase(value) {
  const key = text(value);
  return {
    "Labor Market": "就业市场",
    "Fed Policy": "美联储政策",
    "Treasury Market": "美债市场",
    "Risk Appetite": "风险偏好",
    Inflation: "通胀",
    Liquidity: "流动性",
    Expansion: "扩张",
    "Late Cycle": "周期后段",
    Slowdown: "放缓",
    Recession: "衰退",
    "Late Cycle Slowdown": "周期后段放缓",
    "Risk-off Environment": "风险规避环境",
    Reacceleration: "再加速",
    Weakening: "走弱",
    Improving: "改善",
    Sticky: "粘性",
    Tightening: "收紧",
    "No clear signal": "无明确信号",
    "Easing bias": "宽松倾向",
    Restrictive: "偏紧",
    Supportive: "支撑",
    "Yields rising": "收益率上行",
    "Yields easing": "收益率回落",
    Defensive: "防御",
    Constructive: "建设性",
    Mixed: "混合",
    "Risk-on": "风险偏好",
    "Risk-off": "风险规避",
    Cautious: "谨慎",
    "Cautious / Mixed": "谨慎 / 混合",
    High: "高",
    Medium: "中",
    Low: "低",
    Elevated: "偏高",
    Moderate: "中等",
    Positive: "正面",
    Negative: "负面",
    "↑": "↑",
    "↓": "↓",
    "→": "→",
    "Low confidence": "低置信度",
    "Labor data revisions": "就业数据修正",
    "Fed communication": "美联储沟通",
    "Treasury yields": "美债收益率",
    "Market breadth": "市场广度",
    "Growth slowdown": "增长放缓",
    "Policy repricing": "政策预期重新定价",
    "Yield volatility": "收益率波动",
    "Positioning reversal": "仓位反转",
    "Payrolls and unemployment": "非农和失业率",
    "Rate-cut probabilities": "降息概率",
    "10-year Treasury yield": "10年期美债收益率",
    "VIX and market breadth": "VIX 和市场广度",
    "Inflation releases": "通胀数据发布",
    "Earnings guidance": "企业盈利指引",
    "Earnings disappointment": "盈利不及预期",
    "Volatility shock": "波动率冲击",
    Dollar: "美元",
    Rates: "利率",
    "Growth Stocks": "成长股",
    Cyclicals: "周期股",
  }[key] || key;
}

function interpretationText(primary, overview, avoidValues) {
  const candidates = uniqueTexts([primary, ...splitSentences(overview)]);
  return candidates.find((candidate) => !avoidValues.some((value) => isNearDuplicate(candidate, value))) || candidates[0] || "";
}

function findDriverNarrative(value, pattern) {
  return arrayValue(value).find((item) => pattern.test(`${item?.name ?? ""} ${item?.explanation ?? ""}`));
}

function matchingSentence(value, pattern) {
  return splitSentences(value).find((sentence) => pattern.test(sentence)) || firstSentence(value);
}

function macroContext(event) {
  return [event.title, event.summary, event.sector, event.event_type, event.category, ...event.themes, ...event.entities, ...event.tickers].join(" ");
}

function regimeFromSentiment(score) {
  if (score > 0.15) return { score, label: "Risk-on" };
  if (score < -0.15) return { score, label: "Risk-off" };
  return { score, label: "Mixed" };
}

function stanceFromSentiment(score) {
  if (score > 0.15) return "Supportive";
  if (score < -0.15) return "Restrictive";
  return "Mixed";
}

function riskLevel(events, sentiment) {
  if (!events.length) return "Low confidence";
  const maxImpact = Math.max(...events.map((event) => event.impact_score));
  if (maxImpact >= 85 || sentiment <= -0.4) return "High";
  if (maxImpact >= 65 || sentiment <= -0.15) return "Elevated";
  return "Moderate";
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number <= 1 ? bounded(number * 100, 0, 100) : bounded(number, 0, 100);
}

function classifyEvent(event) {
  const explicit = text(event.category ?? event.layer).toLowerCase();
  const context = [event.sector, event.event_type, ...stringList(event.topics)].join(" ").toLowerCase();
  if (explicit.includes("policy") || /policy|regulat|legislation|sec\b|antitrust/.test(context)) return "Policy";
  if (explicit.includes("macro") || /macro|fed|rate|inflation|cpi|nfp|payroll|treasury|geopolit|labor/.test(context)) return "Macro";
  if (explicit.includes("company") || /company|earnings|corporate|merger|layoff|product/.test(context)) return "Company";
  return "Industry";
}

function findMatchingNewsItem(event, firstArticle, newsItems) {
  const eventTitle = comparableTitle(event.title);
  const articleUrl = text(firstArticle.source_url ?? firstArticle.url);
  const eventUrls = stringList(event.source_urls);
  return newsItems.find((item) => {
    const itemUrl = text(item?.source_url ?? item?.url);
    return (articleUrl && itemUrl === articleUrl) || (itemUrl && eventUrls.includes(itemUrl)) || (eventTitle && comparableTitle(item?.title) === eventTitle);
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
  return [stringList(event.source_urls)[0], event.source_url, event.url, firstArticle.source_url, firstArticle.url, matchingNews.source_url, matchingNews.url].map(text).find(Boolean) ?? "";
}

function normalizeImageUrl(value) {
  const url = text(value).replace(/\\/g, "/");
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith("reports/")) return `/data/${url.slice("reports/".length)}`;
  if (url.startsWith("assets/")) return `/data/${url}`;
  return url;
}

function splitSentences(value) {
  return text(value).split(/(?<=[.!?。！？])\s+/).map((item) => item.trim()).filter(Boolean);
}

function firstSentence(value) {
  return splitSentences(value)[0] || "";
}

function dominantValue(values, fallback) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function unique(values) {
  return [...new Set(values.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : 0;
}

function isGenericClassification(value) {
  return ["macro", "company", "industry", "policy", "market event", "cross-market"].includes(text(value).toLowerCase());
}

function comparableTitle(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function sourceList(value) {
  if (Array.isArray(value)) return value.map(sourceText).filter(Boolean);
  if (typeof value === "string") return value.split(",").map(sourceText).filter(Boolean);
  return [];
}

function sourceText(value) {
  if (value && typeof value === "object") return text(value.name ?? value.title ?? value.publisher ?? value.label);
  const result = text(value);
  return result === "[object Object]" ? "" : result;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  if (value == null || typeof value === "object") return "";
  return String(value).trim();
}

function bounded(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
