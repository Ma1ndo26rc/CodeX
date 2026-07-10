export function truncateText(value, maxLength = 180) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNearDuplicate(a, b, threshold = 0.72) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return false;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const smaller = Math.min(left.size, right.size);
  return intersection / smaller >= threshold;
}

export function uniqueTexts(values, threshold = 0.72) {
  const result = [];
  for (const value of values.map((item) => String(item ?? "").trim()).filter(Boolean)) {
    if (!result.some((existing) => isNearDuplicate(existing, value, threshold))) result.push(value);
  }
  return result;
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
}
