import { Activity, Gauge, ShieldCheck } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

const COPY = {
  en: { snapshot: "MARKET SNAPSHOT", sentiment: "Sentiment", regime: "Regime", positioning: "Current positioning", mixed: "Mixed", riskOn: "Risk-on", riskOff: "Risk-off" },
  zh: { snapshot: "市场快照", sentiment: "市场情绪", regime: "市场状态", positioning: "当前市场定位", mixed: "中性", riskOn: "风险偏好", riskOff: "风险规避" },
};

export default function MarketSnapshotStrip({ snapshot, regime }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const indices = snapshot?.indices ?? [];
  const sentiment = snapshot?.sentiment ?? { score: 0, label: "Mixed" };
  return (
    <section className="landing-snapshot" aria-label="Market Snapshot">
      <header><Activity size={15} /><span>{copy.snapshot}</span></header>
      <div className="landing-market-items">
        {indices.map((item) => <MarketItem key={item.id} item={item} />)}
        <div className="landing-market-item is-sentiment">
          <span><Gauge size={13} />{copy.sentiment}</span>
          <strong className={toneClass(sentiment.score)}>{signed(sentiment.score)}</strong>
          <small>{translateRegime(sentiment.label, copy)}</small>
        </div>
        <div className="landing-market-item is-regime">
          <span><ShieldCheck size={13} />{copy.regime}</span>
          <strong className={toneClass(regime?.score)}>{translateRegime(regime?.label, copy)}</strong>
          <small>{copy.positioning}</small>
        </div>
      </div>
    </section>
  );
}

function translateRegime(value, copy) {
  const normalized = String(value || "Mixed").toLowerCase();
  if (normalized.includes("risk-on")) return copy.riskOn;
  if (normalized.includes("risk-off")) return copy.riskOff;
  return copy.mixed;
}

function MarketItem({ item }) {
  return (
    <div className="landing-market-item">
      <span>{item.label}<small>{item.symbol}</small></span>
      <strong>{item.price == null ? "N/A" : item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
      <small className={toneClass(item.change_pct)}>{item.change_pct == null ? "N/A" : signed(item.change_pct, "%")}</small>
    </div>
  );
}

function toneClass(value) {
  return Number(value) > 0.1 ? "is-positive" : Number(value) < -0.1 ? "is-negative" : "is-neutral";
}

function signed(value, suffix = "") {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}${suffix}`;
}
