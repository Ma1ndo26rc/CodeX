export function clsx(...parts) {
  return parts.flat().filter(Boolean).join(" ");
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function formatPercent(value) {
  const number = toNumber(value);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(2)}%`;
}

export function formatScore(value, digits = 0) {
  return toNumber(value).toFixed(digits);
}

export function formatTimestamp(value, language = "en", options = {}) {
  if (!value) return language === "zh" ? "暂无数据" : "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...options,
  });
}

export function formatMarketClock(value) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${formatClockPart(date, "Asia/Hong_Kong")} HKG / ${formatClockPart(date, "America/New_York")} ET`;
}

function formatClockPart(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((values, part) => {
    values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function getEventLayer(event) {
  const sector = String(event?.sector ?? "").toLowerCase();
  const type = String(event?.event_type ?? "").toLowerCase();
  if (sector.includes("company") || type.includes("earnings") || type.includes("layoff")) return "Company";
  if (sector.includes("macro") || sector.includes("policy") || type.includes("rate") || type.includes("inflation")) return "Macro";
  return "Market";
}

export function sentimentTone(score) {
  const value = toNumber(score);
  if (value > 0.15) return "good";
  if (value < -0.15) return "bad";
  return "flat";
}

export function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}
