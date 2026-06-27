import { FileDown } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

const labels = {
  markdown: "Markdown",
  pdf: "PDF",
  json: "JSON",
  standard_json: "standardJson",
};

export default function DownloadBar({ reports = {} }) {
  const { t } = useLanguage();
  const entries = Object.entries(reports).filter(([, href]) => Boolean(href));
  if (!entries.length) return null;

  return (
    <div className="terminal-card flex flex-wrap gap-2 p-3">
      {entries.map(([key, href]) => (
        <a
          key={key}
          href={href}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 font-terminal text-xs text-terminal-amber transition hover:bg-terminal-amber hover:text-black dark:bg-white/[0.08]"
        >
          <FileDown size={15} />
          {key === "standard_json" ? t(labels[key]) : labels[key] ?? key}
        </a>
      ))}
    </div>
  );
}
