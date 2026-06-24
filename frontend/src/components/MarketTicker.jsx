import { formatPercent, sentimentTone, toNumber } from "../lib/utils.js";

export default function MarketTicker({ items = [] }) {
  if (!items.length) {
    return <div className="terminal-card p-4 text-sm text-slate-500 dark:text-slate-400">No market data snapshot available.</div>;
  }

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex gap-0 overflow-x-auto">
        {items.map((item) => {
          const tone = sentimentTone(item.change_pct);
          const toneClass = tone === "good" ? "text-terminal-green" : tone === "bad" ? "text-terminal-red" : "text-slate-500";
          return (
            <div key={item.symbol} className="min-w-56 border-r border-slate-300 px-4 py-3 last:border-r-0 dark:border-terminal-line">
              <p className="terminal-label">{item.name}</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <span className="font-terminal text-xl font-black">{toNumber(item.price).toLocaleString()}</span>
                <span className={`font-terminal text-sm ${toneClass}`}>{formatPercent(item.change_pct)}</span>
              </div>
              <p className="mt-1 font-terminal text-xs text-slate-500 dark:text-slate-400">{item.symbol}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
