import { Activity, Gauge } from "lucide-react";

export default function MarketSnapshotV2({ snapshot, language }) {
  const copy = language === "zh"
    ? { title: "市场快照", unavailable: "暂无数据", sentiment: "市场情绪" }
    : { title: "Market Snapshot", unavailable: "N/A", sentiment: "Market Sentiment" };
  const indices = snapshot?.indices ?? [];

  return (
    <section className="mi-snapshot" aria-label={copy.title}>
      <div className="mi-snapshot-label">
        <Activity size={16} />
        <span>{copy.title}</span>
      </div>
      <div className="mi-ticker-row">
        {indices.map((item) => <SnapshotItem key={item.id} item={item} unavailable={copy.unavailable} />)}
        <div className="mi-ticker-card mi-sentiment-card">
          <div className="mi-ticker-name"><Gauge size={14} />{copy.sentiment}</div>
          <div className={`mi-sentiment ${sentimentClass(snapshot?.sentiment?.score)}`}>
            {snapshot?.sentiment?.label || copy.unavailable}
            <span>{signed(snapshot?.sentiment?.score, 2)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SnapshotItem({ item, unavailable }) {
  const changeClass = item.change_pct > 0 ? "is-positive" : item.change_pct < 0 ? "is-negative" : "is-neutral";
  return (
    <div className="mi-ticker-card">
      <div className="mi-ticker-name">{item.label}<span>{item.symbol}</span></div>
      <div className="mi-ticker-value">
        <strong>{item.price == null ? unavailable : item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
        <span className={changeClass}>{item.change_pct == null ? unavailable : signed(item.change_pct, 2, "%")}</span>
      </div>
    </div>
  );
}

function sentimentClass(value) {
  return value > 0.15 ? "is-positive" : value < -0.15 ? "is-negative" : "is-neutral";
}

function signed(value, digits, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0.00";
  return `${number > 0 ? "+" : ""}${number.toFixed(digits)}${suffix}`;
}
