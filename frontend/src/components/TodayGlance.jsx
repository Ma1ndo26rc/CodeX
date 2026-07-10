import { Activity, BarChart3, Layers3, Scale, Target, TrendingUp } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

const COPY = {
  en: { eyebrow: "TODAY AT A GLANCE", title: "The market in six signals", total: "Total Events", detected: "Detected today", impact: "Average Impact", outOf: "Out of 100", sentiment: "Average Sentiment", theme: "Dominant Theme", frequent: "Most frequent event type", balance: "Positive vs Negative", neutral: "neutral", sector: "Top Sector", concentration: "Highest event concentration", positive: "Positive bias", negative: "Negative bias", balanced: "Balanced tone" },
  zh: { eyebrow: "今日概览", title: "六项信号看懂市场", total: "事件总数", detected: "今日识别", impact: "平均影响", outOf: "满分 100", sentiment: "平均情绪", theme: "主导主题", frequent: "出现频率最高的事件类型", balance: "正面与负面", neutral: "中性", sector: "重点行业", concentration: "事件集中度最高", positive: "偏正面", negative: "偏负面", balanced: "情绪均衡" },
};

export default function TodayGlance({ stats }) {
  const { language } = useLanguage();
  const copy = COPY[language] ?? COPY.en;
  const positive = stats?.sentiments?.Positive ?? 0;
  const negative = stats?.sentiments?.Negative ?? 0;
  const items = [
    { label: copy.total, value: stats?.total_events ?? 0, note: copy.detected, icon: Activity, tone: "blue" },
    { label: copy.impact, value: Number(stats?.avg_impact ?? 0).toFixed(1), note: copy.outOf, icon: Target, tone: "amber" },
    { label: copy.sentiment, value: signed(stats?.avg_sentiment), note: sentimentLabel(stats?.avg_sentiment, copy), icon: TrendingUp, tone: sentimentTone(stats?.avg_sentiment) },
    { label: copy.theme, value: stats?.dominant_theme ?? "Mixed", note: copy.frequent, icon: Layers3, tone: "ink" },
    { label: copy.balance, value: `${positive} / ${negative}`, note: `${stats?.sentiments?.Neutral ?? 0} ${copy.neutral}`, icon: Scale, tone: positive >= negative ? "green" : "red" },
    { label: copy.sector, value: stats?.top_sector ?? "Broad Market", note: copy.concentration, icon: BarChart3, tone: "blue" },
  ];
  return (
    <section className="landing-glance" aria-labelledby="glance-title">
      <div className="landing-section-heading"><span>{copy.eyebrow}</span><h2 id="glance-title">{copy.title}</h2></div>
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

function sentimentLabel(value, copy) {
  return Number(value) > 0.1 ? copy.positive : Number(value) < -0.1 ? copy.negative : copy.balanced;
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}
