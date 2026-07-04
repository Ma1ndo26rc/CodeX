import { ChevronDown, Layers3 } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

export default function EventClustersV2({ clusters }) {
  const { language, localized } = useLanguage();
  const copy = language === "zh"
    ? { eyebrow: "二级分析层", title: "事件集群", empty: "暂无可用事件集群", events: "个相关事件" }
    : { eyebrow: "Secondary analysis layer", title: "Event Clusters", empty: "No event clusters available", events: "related events" };
  return (
    <section className="mi-section">
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} count={clusters.length} />
      <div className="mi-cluster-grid">
        {clusters.map((cluster) => (
          <details key={cluster.id} className="mi-cluster">
            <summary>
              <div className="mi-cluster-icon"><Layers3 size={18} /></div>
              <div>
                <h3>{localized(cluster, "title") || localized(cluster, "name") || cluster.title}</h3>
                <p>{localized(cluster, "description") || localized(cluster, "explanation") || cluster.description || `${cluster.events.length} ${copy.events}`}</p>
              </div>
              <span>{cluster.events.length}</span>
              <ChevronDown size={18} className="mi-cluster-chevron" />
            </summary>
            <div className="mi-cluster-events">
              {cluster.events.map((event) => (
                <div key={event.id} className="mi-cluster-event">
                  <div><strong>{localized(event, "title") || event.title}</strong><p>{localized(event, "one_line_summary") || localized(event, "summary") || event.one_line_summary}</p></div>
                  <span>{Math.round(event.impact_score)}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
        {!clusters.length && <div className="mi-empty">{copy.empty}</div>}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, count }) {
  return <div className="mi-section-heading"><div><p>{eyebrow}</p><h2>{title}</h2></div>{count != null && <span>{String(count).padStart(2, "0")}</span>}</div>;
}
