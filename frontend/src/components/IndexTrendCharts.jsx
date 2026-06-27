import { formatTimestamp, sentimentTone, toNumber } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

const COLORS = {
  SPY: "#66D9EF",
  QQQ: "#6AA9FF",
  VIX: "#FF5D5D",
  "10Y Yield": "#F6B739",
};

export default function IndexTrendCharts({ trends, history }) {
  const { language, t } = useLanguage();
  const series = trends?.series ?? [];
  if (!series.length) {
    return (
      <section className="terminal-card p-5">
        <p className="terminal-label">{t("indexTrends")}</p>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t("noTrendData")}</p>
      </section>
    );
  }

  return (
    <section className="terminal-card p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="terminal-label">{t("indexTrends")}</p>
          <h2 className="terminal-title mt-1">SPY / QQQ / VIX / 10Y Yield</h2>
        </div>
        <p className="font-terminal text-xs text-slate-500 dark:text-slate-400">
          {t("rangeMeta", { range: trends.range || "1mo", interval: trends.interval || "1d", updated: formatTimestamp(trends.as_of, language) })}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {series.map((item) => (
          <TrendCard key={item.name} item={item} historyPoints={history?.series?.[item.name]?.length ?? 0} />
        ))}
      </div>
    </section>
  );
}

function TrendCard({ item, historyPoints }) {
  const { t } = useLanguage();
  const points = (item.points ?? []).filter((point) => point.price !== null && point.price !== undefined);
  const first = points[0]?.price;
  const last = points[points.length - 1]?.price;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const tone = sentimentTone(changePct);
  const color = COLORS[item.name] ?? "#F6B739";
  const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-terminal-amber";

  return (
    <article className="rounded-2xl border border-slate-300 bg-slate-50 p-4 dark:border-terminal-line dark:bg-terminal-panel2">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="terminal-label">{item.symbol}</p>
          <h3 className="mt-1 font-display text-xl font-black">{item.name}</h3>
        </div>
        <div className="text-right font-terminal">
          <p className="text-lg font-black">{toNumber(last).toLocaleString()}</p>
          <p className={`text-xs ${toneClass}`}>{formatSigned(changePct)} {t("overRange")}</p>
        </div>
      </div>
      <Sparkline points={points} color={color} />
      <div className="mt-3 flex items-center justify-between font-terminal text-[11px] text-slate-500 dark:text-slate-400">
        <span>{t("chartPoints", { count: points.length })}</span>
        <span>{t("scheduledSnapshots", { count: historyPoints })}</span>
      </div>
    </article>
  );
}

function Sparkline({ points, color }) {
  const { t } = useLanguage();
  if (points.length < 2) {
    return <div className="flex h-44 items-center justify-center rounded-xl border border-slate-300 text-sm text-slate-500 dark:border-terminal-line">{t("notEnoughData")}</div>;
  }

  const width = 720;
  const height = 210;
  const padding = 18;
  const prices = points.map((point) => toNumber(point.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (points.length - 1);
  const path = points
    .map((point, index) => {
      const x = padding + stepX * index;
      const y = height - padding - ((toNumber(point.price) - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const area = `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full rounded-xl border border-slate-300 bg-white/80 dark:border-terminal-line dark:bg-black/20" role="img">
      <defs>
        <linearGradient id={`trend-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} stroke="currentColor" className="text-slate-200 dark:text-terminal-line" strokeWidth="1" />
      ))}
      <path d={area} fill={`url(#trend-${color.replace("#", "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width - padding} cy={lastY(points, min, range, height, padding)} r="5" fill={color} />
      <text x={padding} y={height - 6} className="fill-slate-500 font-terminal text-[20px] dark:fill-slate-400">
        {toNumber(min).toLocaleString()}
      </text>
      <text x={width - padding} y={24} textAnchor="end" className="fill-slate-500 font-terminal text-[20px] dark:fill-slate-400">
        {toNumber(max).toLocaleString()}
      </text>
    </svg>
  );
}

function lastY(points, min, range, height, padding) {
  const last = points[points.length - 1];
  return height - padding - ((toNumber(last.price) - min) / range) * (height - padding * 2);
}

function formatSigned(value) {
  const number = toNumber(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(2)}%`;
}
