import { Landmark } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useLanguage } from "../lib/i18n.jsx";

const COPY = {
  en: {
    header: {
      eyebrow: "EXPLANATION LAYER",
      title: "MACRO ANALYSIS",
      subtitle: "A sell-side style macro brief focused on regime, themes, asset impact and upcoming catalysts.",
    },
    empty: "No macro-specific signals detected in the current report.",
    lowConfidence: "Low confidence: the current report has limited macro-specific confirmation.",
    regime: "Current Market Regime",
    themes: "Today's Macro Themes",
    marketImpact: "Asset Impact",
    catalysts: "What Investors Watch Next",
    marketRegime: "Market Regime",
    keyTakeaway: "Key Takeaway",
    stance: "Market Stance",
    confidence: "Confidence",
    currentView: "Current View",
    whatChanged: "What Changed",
    whyItMatters: "Why It Matters",
    impact: "Market Impact",
    watch: "Watch Next",
    equities: "US Equities",
    rates: "Rates",
    growth: "Growth Stocks",
    financials: "Financials",
    sectorImpact: "Sector Impact",
    positive: "Positive",
    negative: "Negative",
    macroData: "Macro Data",
    policy: "Policy",
    companyEvents: "Company Events",
  },
  zh: {
    header: {
      eyebrow: "解释层",
      title: "MACRO ANALYSIS",
      subtitle: "以宏观状态、主题、资产影响和未来催化为核心的卖方研究式晨报。",
    },
    empty: "当前报告未检测到明确宏观信号。",
    lowConfidence: "低置信度：当前报告中的宏观专项确认有限。",
    regime: "当前市场状态",
    themes: "今日宏观主题",
    marketImpact: "市场影响",
    catalysts: "未来催化",
    stance: "市场立场",
    confidence: "置信度",
    summary: "摘要",
    keySignals: "关键信号",
    impact: "市场影响",
    watch: "接下来关注",
    equities: "股票",
    rates: "利率",
    growth: "成长股",
    financials: "金融股",
    catalystList: "催化因素",
    riskList: "风险",
    eventList: "事件",
  },
};

export default function MacroAnalysis({ model }) {
  const { language } = useLanguage();
  const copy = { ...COPY.en, ...(COPY[language] ?? {}) };

  if (!model?.has_data) {
    return (
      <>
        <PageHeader {...copy.header} />
        <EmptyState title={copy.empty} icon={Landmark} />
      </>
    );
  }

  const regime = model.market_regime ?? {};
  const themes = model.themes ?? [];
  const assetView = model.asset_view ?? {};
  const forward = model.forward ?? {};

  return (
    <>
      <PageHeader {...copy.header} />

      <section className="macro-brief-section macro-brief-regime">
        <SectionTitle number="01" title={copy.regime} />
        <div className="macro-brief-hero">
          <div className="macro-brief-call">
            <span>{copy.marketRegime}</span>
            <h2>{localField(regime, "title", language) || localizePhrase("Late Cycle", language)}</h2>
            <p>{localField(regime, "summary", language) || copy.lowConfidence}</p>
            <div className="macro-key-takeaway">
              <strong>{copy.keyTakeaway}</strong>
              <p>{localField(regime, "key_takeaway", language) || copy.lowConfidence}</p>
            </div>
          </div>
          <aside className="macro-brief-status">
            <Metric label={copy.stance} value={localField(regime, "stance", language) || localizePhrase("Cautious", language)} />
            <Metric label={copy.confidence} value={formatConfidence(regime.confidence, language)} />
          </aside>
        </div>
      </section>

      <section className="macro-brief-section">
        <SectionTitle number="02" title={copy.themes} />
        <div className="macro-theme-stack">
          {themes.map((theme) => (
            <article key={theme.title} className="macro-theme-brief">
              <header>
                <h3>{localField(theme, "title", language)}</h3>
                <h4>{copy.currentView}</h4>
                <p>{localField(theme, "current_view", language) || localField(theme, "summary", language) || copy.lowConfidence}</p>
              </header>
              <div className="macro-theme-columns">
                <TextColumn title={copy.whatChanged} value={localField(theme, "what_changed", language)} fallback={copy.lowConfidence} />
                <TextColumn title={copy.whyItMatters} value={localField(theme, "why_it_matters", language)} fallback={copy.lowConfidence} />
                <ImpactColumn title={copy.impact} impact={localImpact(theme, language)} />
                <BriefColumn title={copy.watch} items={localList(theme, "watch_next", language)} fallback={copy.lowConfidence} />
              </div>
            </article>
          ))}
          {!themes.length && <EmptyState title={copy.empty} compact />}
        </div>
      </section>

      <section className="macro-brief-section">
        <SectionTitle number="03" title={copy.marketImpact} />
        <div className="macro-asset-view">
          <AssetViewCard item={localAsset(assetView, "equities", language)} fallbackLabel={copy.equities} />
          <AssetViewCard item={localAsset(assetView, "rates", language)} fallbackLabel={copy.rates} />
          <AssetViewCard item={localAsset(assetView, "growth_stocks", language)} fallbackLabel={copy.growth} />
          <AssetViewCard item={localAsset(assetView, "financials", language)} fallbackLabel={copy.financials} />
          <SectorImpactPanel
            title={copy.sectorImpact}
            positiveLabel={copy.positive}
            negativeLabel={copy.negative}
            sectors={localSectorImpact(assetView, language)}
          />
        </div>
      </section>

      <section className="macro-brief-section">
        <SectionTitle number="04" title={copy.catalysts} />
        <div className="macro-forward-brief">
          <ForwardBlock title={copy.macroData} items={localList(forward, "macro_data", language)} fallback={copy.lowConfidence} />
          <ForwardBlock title={copy.policy} items={localList(forward, "policy", language)} fallback={copy.lowConfidence} />
          <ForwardBlock title={copy.companyEvents} items={localList(forward, "company_events", language)} fallback={copy.lowConfidence} />
        </div>
      </section>
    </>
  );
}

function SectionTitle({ number, title }) {
  return (
    <div className="macro-panel-title">
      <span>{number}</span>
      <h2>{title}</h2>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="macro-metric">
      <span>{label}</span>
      <strong>{value || "N/A"}</strong>
    </div>
  );
}

function TextColumn({ title, value, fallback }) {
  return (
    <div className="macro-brief-column">
      <h4>{title}</h4>
      <p>{value || fallback}</p>
    </div>
  );
}

function BriefColumn({ title, items, fallback }) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];
  return (
    <div className="macro-brief-column">
      <h4>{title}</h4>
      {rows.length ? <ul>{rows.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{fallback}</p>}
    </div>
  );
}

function ImpactColumn({ title, impact }) {
  const rows = [
    ["Equities", impact.equities],
    ["Rates", impact.rates],
    ["Sector", impact.sectors],
  ].filter(([, value]) => value);
  return (
    <div className="macro-brief-column">
      <h4>{title}</h4>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{Array.isArray(value) ? value.join("; ") : value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AssetViewCard({ item, fallbackLabel }) {
  return (
    <article className="macro-asset-card">
      <h3>{item.label || fallbackLabel}</h3>
      <strong>{item.stance || "Mixed"}</strong>
      <p>{item.note || "Macro signal is mixed and needs confirmation."}</p>
    </article>
  );
}

function SectorImpactPanel({ title, positiveLabel, negativeLabel, sectors }) {
  const positive = Array.isArray(sectors.positive) ? sectors.positive.filter(Boolean).slice(0, 4) : [];
  const negative = Array.isArray(sectors.negative) ? sectors.negative.filter(Boolean).slice(0, 4) : [];
  if (!positive.length && !negative.length) return null;
  return (
    <article className="macro-sector-impact">
      <h3>{title}</h3>
      <div>
        <SectorList label={positiveLabel} items={positive} />
        <SectorList label={negativeLabel} items={negative} />
      </div>
    </article>
  );
}

function SectorList({ label, items }) {
  if (!items.length) return null;
  return (
    <section>
      <strong>{label}</strong>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function ForwardBlock({ title, items, fallback }) {
  const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 5) : [];
  return (
    <article className="macro-forward-card">
      <h3>{title}</h3>
      {rows.length ? <ul>{rows.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{fallback}</p>}
    </article>
  );
}

function localField(item, field, language) {
  if (!item) return "";
  if (language === "zh") return item[`${field}_zh`] || localizePhrase(item[field], language) || item[field] || "";
  return item[field] || "";
}

function localList(item, field, language) {
  if (!item) return [];
  const value = language === "zh" ? item[`${field}_zh`] || item[field] : item[field];
  if (!Array.isArray(value)) return [];
  return language === "zh" ? value.map((entry) => localizePhrase(entry, language)) : value;
}

function localImpact(item, language) {
  if (!item) return {};
  return language === "zh" ? item.market_impact_zh || item.market_impact || {} : item.market_impact || {};
}

function localAsset(assetView, key, language) {
  if (!assetView) return {};
  return language === "zh" ? assetView[`${key}_zh`] || assetView[key] || {} : assetView[key] || {};
}

function localSectorImpact(assetView, language) {
  if (!assetView) return {};
  return language === "zh" ? assetView.sectors_zh || assetView.sectors || {} : assetView.sectors || {};
}

function formatConfidence(value, language) {
  const number = Number(value);
  if (!Number.isFinite(number)) return localizePhrase("Low", language);
  return `${Math.round(number)}%`;
}

function localizePhrase(value, language) {
  if (language !== "zh") return value || "";
  return {
    Mixed: "混合",
    Cautious: "谨慎",
    Constructive: "建设性",
    "Late Cycle": "周期后段",
    "Late Cycle Slowdown": "周期后段放缓",
    Positive: "正面",
    Negative: "负面",
    Neutral: "中性",
    "Neutral / Cautious": "中性 / 谨慎",
    "Sensitive / Supported": "敏感 / 受支撑",
    Sensitive: "敏感",
    Bullish: "偏多",
    Bearish: "偏空",
    Low: "低",
  }[value] || value || "";
}
