import { Activity, BarChart3, Layers3, Scale, Target, TrendingUp } from "lucide-react";

export default function TodayGlance({ stats }) {
  const positive = stats?.sentiments?.Positive ?? 0;
  const negative = stats?.sentiments?.Negative ?? 0;
  const items = [
    { label: "Total Events", value: stats?.total_events ?? 0, note: "Detected today", icon: Activity, tone: "blue" },
    { label: "Average Impact", value: Number(stats?.avg_impact ?? 0).toFixed(1), note: "Out of 100", icon: Target, tone: "amber" },
    { label: "Average Sentiment", value: signed(stats?.avg_sentiment), note: sentimentLabel(stats?.avg_sentiment), icon: TrendingUp, tone: sentimentTone(stats?.avg_sentiment) },
    { label: "Dominant Theme", value: stats?.dominant_theme ?? "Mixed", note: "Most frequent event type", icon: Layers3, tone: "ink" },
    { label: "Positive vs Negative", value: `${positive} / ${negative}`, note: `${stats?.sentiments?.Neutral ?? 0} neutral`, icon: Scale, tone: positive >= negative ? "green" : "red" },
    { label: "Top Sector", value: stats?.top_sector ?? "Broad Market", note: "Highest event concentration", icon: BarChart3, tone: "blue" },
  ];
  return (
    <section className="landing-glance" aria-labelledby="glance-title">
      <div className="landing-section-heading"><span>TODAY AT A GLANCE</span><h2 id="glance-title">The market in six signals</h2></div>
      <div className="landing-glance-grid">
        {items.map(({ label, value, note, icon: Icon, tone }) => (
          <article key={label} className={`landing-glance-card tone-${tone}`}>
            <Icon size={15} /><span>{label}</span><strong>{value}</strong><small>{note}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function sentimentTone(value) {
  return Number(value) > 0.1 ? "green" : Number(value) < -0.1 ? "red" : "ink";
}

function sentimentLabel(value) {
  return Number(value) > 0.1 ? "Positive bias" : Number(value) < -0.1 ? "Negative bias" : "Balanced tone";
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}
