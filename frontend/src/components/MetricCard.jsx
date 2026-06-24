import { clsx } from "../lib/utils.js";

export default function MetricCard({ label, value, subValue, tone = "neutral" }) {
  const toneClass = {
    neutral: "text-slate-950 dark:text-slate-50",
    good: "text-terminal-green",
    bad: "text-terminal-red",
    warn: "text-terminal-amber",
    info: "text-terminal-cyan",
  }[tone];

  return (
    <div className="terminal-card p-4">
      <p className="terminal-label">{label}</p>
      <p className={clsx("mt-3 font-terminal text-2xl font-black", toneClass)}>{value}</p>
      {subValue && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{subValue}</p>}
    </div>
  );
}
