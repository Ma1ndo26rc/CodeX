import EventMatrix from "../components/EventMatrix.jsx";
import IndexTrendCharts from "../components/IndexTrendCharts.jsx";
import MetricCard from "../components/MetricCard.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { formatPercent, formatTimestamp, sentimentTone, toNumber } from "../lib/utils.js";
import { useLanguage } from "../lib/i18n.jsx";

export default function MarketData({ marketData = [], analysis, marketTrends, marketHistory }) {
  const { language, t } = useLanguage();
  return (
    <div className="space-y-5">
      <SectionHeader eyebrow={t("marketData")} title={t("realtimeSnapshot")} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {marketData.map((item) => {
          const tone = sentimentTone(item.change_pct);
          return (
            <MetricCard
              key={item.symbol}
              label={`${item.name} / ${item.symbol}`}
              value={toNumber(item.price).toLocaleString()}
              subValue={`${formatPercent(item.change_pct)} ${t("changeSuffix")}`}
              tone={tone === "good" ? "good" : tone === "bad" ? "bad" : "neutral"}
            />
          );
        })}
      </section>

      <IndexTrendCharts trends={marketTrends} history={marketHistory} />

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="terminal-card overflow-hidden">
          <div className="border-b border-slate-300 p-4 dark:border-terminal-line">
            <p className="terminal-label">{t("snapshotTime")}</p>
            <p className="mt-2 font-terminal text-sm">{formatTimestamp(analysis?.market_data?.as_of, language)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left font-terminal text-sm">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:bg-terminal-panel2 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("asset")}</th>
                  <th className="px-4 py-3">{t("symbol")}</th>
                  <th className="px-4 py-3">{t("price")}</th>
                  <th className="px-4 py-3">{t("change")}</th>
                  <th className="px-4 py-3">{t("changePercent")}</th>
                </tr>
              </thead>
              <tbody>
                {marketData.map((item) => {
                  const tone = sentimentTone(item.change_pct);
                  const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-terminal-amber";
                  return (
                    <tr key={item.symbol} className="border-t border-slate-200 dark:border-terminal-line">
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3 text-terminal-amber">{item.symbol}</td>
                      <td className="px-4 py-3">{toNumber(item.price).toLocaleString()}</td>
                      <td className={`px-4 py-3 ${toneClass}`}>{toNumber(item.change).toFixed(3)}</td>
                      <td className={`px-4 py-3 ${toneClass}`}>{formatPercent(item.change_pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <EventMatrix events={analysis?.key_events ?? []} />
      </div>
    </div>
  );
}
