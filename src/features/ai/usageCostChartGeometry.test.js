import test from "node:test";
import assert from "node:assert/strict";
import { projectUsageChartPosition, USAGE_CHART_BASELINE, USAGE_CHART_GRIDLINES, USAGE_CHART_PLOT_HEIGHT } from "./usageCostChartGeometry.js";

test("bars, 0 tick and final gridline share the usage chart baseline", () => {
  const zeroBar = projectUsageChartPosition(0, 100);
  const maxBar = projectUsageChartPosition(100, 100);
  assert.equal(zeroBar.y + zeroBar.height, USAGE_CHART_BASELINE);
  assert.equal(maxBar.y, USAGE_CHART_BASELINE - USAGE_CHART_PLOT_HEIGHT);
  assert.equal(USAGE_CHART_GRIDLINES.at(-1), USAGE_CHART_BASELINE);
  assert.equal(projectUsageChartPosition(25, 100).y, 168);
});

test("chart geometry clamps values and never converts invalid data into a negative bar", () => {
  assert.deepEqual(projectUsageChartPosition(-10, 100), { y: USAGE_CHART_BASELINE, height: 0 });
  assert.deepEqual(projectUsageChartPosition(200, 100), { y: USAGE_CHART_BASELINE - USAGE_CHART_PLOT_HEIGHT, height: USAGE_CHART_PLOT_HEIGHT });
  assert.deepEqual(projectUsageChartPosition(null, 100), { y: USAGE_CHART_BASELINE, height: 0 });
});
