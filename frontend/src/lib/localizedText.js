export function getLocalizedField(item, field, language) {
  if (!item || !field) return "";
  if (language !== "zh") return item[field] ?? "";

  return firstValue(
    item[`${field}_zh`],
    item[`zh_${field}`],
    item[`translated_${field}`],
    item[field],
  );
}

export function getDisplayTitle(item, language) {
  return getLocalizedField(item, "title", language);
}

export function getDisplaySummary(item, language) {
  return firstValue(
    getLocalizedField(item, "summary", language),
    getLocalizedField(item, "one_line_summary", language),
  );
}

export function getDisplaySource(item) {
  if (!item) return "Unknown Source";
  const value = item.primary_source ?? item.source ?? item.publisher ?? item.source_name ?? item.sources?.[0];
  if (value && typeof value === "object") {
    return stringValue(value.name ?? value.title ?? value.publisher ?? value.label) || "Unknown Source";
  }
  const source = stringValue(value);
  return source && source !== "[object Object]" ? source : "Unknown Source";
}

// Backward-compatible alias for components not yet migrated to the explicit helpers.
export const getLocalizedText = getLocalizedField;

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}
