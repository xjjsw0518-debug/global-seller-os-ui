const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeScope = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en");

export function filterWorkerRowsByGeography(rows, { view, countryCode, cityName }) {
  if (view === "global") return [...rows];
  const country = normalizeScope(countryCode);
  return rows.filter((row) => {
    if (normalizeScope(row.countryCode) !== country) return false;
    return view !== "city" || normalizeScope(row.city) === normalizeScope(cityName);
  });
}

export function isStableWorkerResource(row) {
  return row?.entityType === "VPS_RESOURCE" && typeof row.entityId === "string" && UUID_PATTERN.test(row.entityId);
}

function validCoordinatePair(value) {
  return Array.isArray(value) && value.length >= 2
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && value[0] >= -85.05112878 && value[0] <= 85.05112878
    && value[1] >= -180 && value[1] <= 180;
}

export function projectWorkerResourceLocation(row, cityCenter) {
  if (!isStableWorkerResource(row) || !validCoordinatePair(cityCenter)
    || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)
    || row.latitude < -85.05112878 || row.latitude > 85.05112878
    || row.longitude < -180 || row.longitude > 180) return { x: null, y: null };
  // Preview city coordinates center the viewport only. Marker locations always come from this DTO row.
  const x = Math.max(2, Math.min(98, 50 + (row.longitude - cityCenter[1]) * 8));
  const y = Math.max(2, Math.min(98, 50 - (row.latitude - cityCenter[0]) * 8));
  return { x, y };
}
