const MONTHS_BY_PERIOD = { month: 1, quarter: 3, halfYear: 6 };

/** Rolling UTC calendar months; clamp month-end dates and preserve the source instant. */
export function modelTrendWindow(period, now = new Date()) {
  const months = typeof period === "string" && Object.hasOwn(MONTHS_BY_PERIOD, period) ? MONTHS_BY_PERIOD[period] : null;
  const end = new Date(now);
  if (!months || !Number.isFinite(end.getTime())) {
    throw Object.assign(new Error("Invalid model trend date range."), { code: "AI_MODEL_TREND_RANGE_INVALID" });
  }
  const start = new Date(end);
  const day = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return { period: "custom", date_from: start.toISOString(), date_to: end.toISOString() };
}

export function modelTrendWindowQuery(period, now = new Date()) {
  return new URLSearchParams(modelTrendWindow(period, now)).toString();
}
