import { Activity, Gauge, ShieldCheck } from "lucide-react";

export default function MarketSnapshotStrip({ snapshot, regime }) {
  const indices = snapshot?.indices ?? [];
  const sentiment = snapshot?.sentiment ?? { score: 0, label: "Mixed" };
  return (
    <section className="landing-snapshot" aria-label="Market Snapshot">
      <header><Activity size={15} /><span>MARKET SNAPSHOT</span></header>
      <div className="landing-market-items">
        {indices.map((item) => <MarketItem key={item.id} item={item} />)}
        <div className="landing-market-item is-sentiment">
          <span><Gauge size={13} />Sentiment</span>
          <strong className={toneClass(sentiment.score)}>{signed(sentiment.score)}</strong>
          <small>{sentiment.label}</small>
        </div>
        <div className="landing-market-item is-regime">
          <span><ShieldCheck size={13} />Regime</span>
          <strong className={toneClass(regime?.score)}>{regime?.label || "Mixed"}</strong>
          <small>Current positioning</small>
        </div>
      </div>
    </section>
  );
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
