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

export function formatTimestamp(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
