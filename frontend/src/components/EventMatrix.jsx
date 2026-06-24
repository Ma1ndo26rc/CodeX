import { getEventLayer, sentimentTone, toNumber } from "../lib/utils.js";

export default function EventMatrix({ events = [] }) {
  const topEvents = [...events].sort((a, b) => toNumber(b.market_impact_score) - toNumber(a.market_impact_score)).slice(0, 12);

  if (!topEvents.length) return null;

  return (
    <div className="terminal-card terminal-grid p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="terminal-label">Impact x Sentiment</p>
        <p className="font-terminal text-xs text-slate-500 dark:text-slate-400">Top {topEvents.length} events</p>
      </div>
      <div className="relative h-80 rounded-xl border border-slate-300 bg-white/70 dark:border-terminal-line dark:bg-black/20">
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300 dark:bg-terminal-line" />
        <div className="absolute bottom-1/2 left-0 h-px w-full bg-slate-300 dark:bg-terminal-line" />
        {topEvents.map((event, index) => {
          const sentiment = Math.max(-1, Math.min(1, toNumber(event.sentiment_score)));
          const impact = Math.max(0, Math.min(100, toNumber(event.market_impact_score)));
          const left = `${(sentiment + 1) * 50}%`;
          const bottom = `${impact}%`;
          const tone = sentimentTone(sentiment);
          const color = tone === "good" ? "bg-terminal-green" : tone === "bad" ? "bg-terminal-red" : "bg-terminal-amber";
          return (
            <div
              key={`${event.title}-${index}`}
              className="group absolute -translate-x-1/2 translate-y-1/2"
              style={{ left, bottom }}
              title={event.title}
            >
              <div className={`h-3 w-3 rounded-full ${color} ring-4 ring-black/10 dark:ring-white/10`} />
              <div className="pointer-events-none absolute bottom-5 left-1/2 hidden w-60 -translate-x-1/2 rounded-xl border border-terminal-line bg-terminal-panel p-3 text-xs text-white shadow-terminal group-hover:block">
                <p className="font-bold text-terminal-amber">{event.title}</p>
                <p className="mt-1 text-slate-300">{getEventLayer(event)} / impact {impact}</p>
              </div>
            </div>
          );
        })}
        <span className="absolute bottom-2 left-3 font-terminal text-[10px] text-slate-500">NEGATIVE</span>
        <span className="absolute bottom-2 right-3 font-terminal text-[10px] text-slate-500">POSITIVE</span>
        <span className="absolute left-3 top-2 font-terminal text-[10px] text-slate-500">HIGH IMPACT</span>
      </div>
    </div>
  );
}
