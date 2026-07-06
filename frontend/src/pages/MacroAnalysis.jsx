import { Banknote, BriefcaseBusiness, CircleGauge, Landmark, Waves } from "lucide-react";
import { PageHeading } from "./DecisionDashboard.jsx";

const SECTIONS = [
  { key: "policy", title: "Fed & Rates", icon: Landmark },
  { key: "inflation", title: "Inflation", icon: CircleGauge },
  { key: "labor", title: "Labor Conditions", icon: BriefcaseBusiness },
  { key: "liquidity", title: "Liquidity", icon: Waves },
];

export default function MacroAnalysis({ model }) {
  return (
    <>
      <PageHeading eyebrow="EXPLANATION LAYER" title="Macro Analysis" subtitle="Macro regime, policy, inflation, labor and liquidity. Company-level events are intentionally excluded." />
      <section className="pa-macro-regime">
        <div className="pa-macro-index"><Banknote size={22} /><span>MACRO REGIME</span><b>01</b></div>
        <div><h2>Current Conditions</h2><p>{model?.regime || "Macro regime analysis is unavailable for this report."}</p></div>
      </section>
      <section className="pa-macro-grid">
        {SECTIONS.map(({ key, title, icon: Icon }, index) => (
          <article key={key} className="pa-macro-note">
            <header><Icon size={17} /><span>{String(index + 2).padStart(2, "0")}</span></header>
            <h2>{title}</h2>
            <p>{model?.[key] || "Data unavailable. This section will populate when the macro analysis pipeline provides a dedicated assessment."}</p>
          </article>
        ))}
      </section>
      {!!model?.indicators?.length && (
        <section className="pa-macro-indicators">
          {model.indicators.map((indicator, index) => <div key={indicator.name ?? index}><span>{indicator.name}</span><strong>{indicator.value ?? "N/A"}</strong><small>{indicator.period ?? ""}</small></div>)}
        </section>
      )}
    </>
  );
}
