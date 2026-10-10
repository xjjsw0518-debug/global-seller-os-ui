// Typed table values; missing data remains unknown and sorts last in either direction.
const finite = (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : null;
function numericLabel(value, prefix = "") {
  if (typeof value === "number") return finite(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  const pattern = prefix === "P" ? /^P?(\d+)$/i : /^(\d+(?:\.\d+)?)\s*([KM])?$/i;
  const match = text.match(pattern);
  if (!match) return null;
  return Number(match[1]) * (prefix === "P" ? 1 : ({ K: 1000, M: 1000000 }[match[2]?.toUpperCase()] || 1));
}
export function modelSortValue(model, key) {
  if (key === "priority") return numericLabel(model.rawOperation?.route_priority ?? model.priority, "P");
  if (key === "context") return numericLabel(model.rawOperation?.context_window ?? model.rawOperation?.context_length ?? model.context);
  if (key === "updated") {
    const raw = model.rawOperation?.updated_at ?? model.updated;
    if (!raw) return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (key === "usage") {
    const quota = finite(model.quota), used = finite(model.used);
    return quota !== null && quota > 0 && used !== null ? used / quota : null;
  }
  if (key === "used" || key === "quota") return finite(model[key]);
  const value = model[key];
  return value == null || value === "" || value === "—" || value === "未知" ? null : String(value);
}
export function compareModelRows(a, b, sort) {
  if (!sort) return 0;
  const av = modelSortValue(a, sort.key), bv = modelSortValue(b, sort.key);
  if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
  const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "zh-CN");
  return sort.dir === "desc" ? -comparison : comparison;
}
export function matchesModelSearch(model, search) {
  const needle = String(search || "").trim().toLocaleLowerCase();
  return !needle || [model.model, model.modelId, model.provider, model.type, model.rawOperation?.description].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
}
