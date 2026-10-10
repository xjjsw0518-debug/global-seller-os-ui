export const USAGE_CHART_BASELINE = 216;
export const USAGE_CHART_PLOT_HEIGHT = 192;
export const USAGE_CHART_GRIDLINES = Object.freeze([24, 72, 120, 168, USAGE_CHART_BASELINE]);

export function projectUsageChartPosition(value, max) {
  const ratio = typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.max(0, Math.min(1, value / (typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 1)))
    : 0;
  const height = ratio * USAGE_CHART_PLOT_HEIGHT;
  return { y: USAGE_CHART_BASELINE - height, height };
}
