import IndexTrendCharts from "../components/IndexTrendCharts.jsx";
import { PageHeading, EmptyState } from "./DecisionDashboard.jsx";

export default function MarketData({ model }) {
  const instruments = model?.instruments ?? [];
  return (
    <>
      <PageHeading eyebrow="QUANT LAYER" title="Market Data" subtitle="Prices, changes and time series only. Interpretation is intentionally excluded." />
      <section className="pa-quant-grid">
        {instruments.map((item) => <InstrumentCard key={item.id} item={item} />)}
        {!instruments.length && <EmptyState text="Market data unavailable." />}
      </section>
      <section className="pa-chart-panel">
        <IndexTrendCharts trends={model?.trends} history={model?.history} />
      </section>
      <section className="pa-data-table-wrap">
        <table className="pa-data-table">
          <thead><tr><th>INSTRUMENT</th><th>SYMBOL</th><th>LAST</th><th>CHANGE</th><th>CHANGE %</th></tr></thead>
          <tbody>{instruments.map((item) => <InstrumentRow key={item.id} item={item} />)}</tbody>
        </table>
      </section>
    </>
  );
}

function InstrumentCard({ item }) {
  const tone = toneClass(item.change_pct);
  return <article className="pa-quant-card"><span>{item.name}</span><small>{item.symbol}</small><strong>{formatNumber(item.price)}</strong><b className={tone}>{formatSigned(item.change_pct, "%")}</b></article>;
}

function InstrumentRow({ item }) {
  const tone = toneClass(item.change_pct);
  return <tr><td>{item.name}</td><td>{item.symbol}</td><td>{formatNumber(item.price)}</td><td className={tone}>{formatSigned(item.change)}</td><td className={tone}>{formatSigned(item.change_pct, "%")}</td></tr>;
}

function toneClass(value) {
  return Number(value) > 0 ? "is-positive" : Number(value) < 0 ? "is-negative" : "is-neutral";
}

function formatNumber(value) {
  return value == null ? "N/A" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatSigned(value, suffix = "") {
  if (value == null) return "N/A";
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}${suffix}`;
}
