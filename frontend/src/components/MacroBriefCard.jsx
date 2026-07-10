import { ArrowRight, Landmark } from "lucide-react";
import { useLanguage } from "../lib/i18n.jsx";

const DRIVER_NAMES = {
  Fed: "美联储",
  Inflation: "通胀",
  Labor: "就业",
  Treasury: "美债",
  Liquidity: "流动性",
  Policy: "政策",
  Dollar: "美元",
  "Risk Appetite": "风险偏好",
};

export default function MacroBriefCard({ brief, onOpen }) {
  const { language } = useLanguage();
  const copy = language === "zh"
    ? {
        eyebrow: "宏观简报",
        title: "当前宏观驱动",
        empty: "当前报告未识别到宏观驱动。",
        open: "查看宏观分析",
      }
    : {
        eyebrow: "MACRO BRIEF",
        title: "Current macro drivers",
        empty: "No macro-specific drivers were detected in this report.",
        open: "View Macro Analysis",
      };
  const summary = language === "zh" ? brief?.summary_zh || brief?.summary : brief?.summary;
  const drivers = brief?.drivers ?? [];

  return (
    <aside className="landing-macro-brief">
      <header>
        <Landmark size={16} />
        <span>{copy.eyebrow}</span>
      </header>
      <h3>{copy.title}</h3>
      <p>{summary || copy.empty}</p>
      {!!drivers.length && (
        <ul>
          {drivers.slice(0, 3).map((driver) => (
            <li key={driver.name}>
              <span>{language === "zh" ? DRIVER_NAMES[driver.name] || driver.name : driver.name}</span>
              <strong className={toneClass(driver.sentiment_score)}>{signed(driver.sentiment_score)}</strong>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onOpen}>
        {copy.open}
        <ArrowRight size={14} />
      </button>
    </aside>
  );
}

function toneClass(value) {
  const number = Number(value) || 0;
  if (number > 0.1) return "is-positive";
  if (number < -0.1) return "is-negative";
  return "is-neutral";
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}`;
}
