import test from "node:test";
import assert from "node:assert/strict";
import { getKnownCostShares, projectUsageDashboardKpis } from "./usageCostDashboard.js";

test("dashboard local design values are explicitly a mock fixture", () => {
  const value = projectUsageDashboardKpis({}, { injected: false });
  assert.equal(value.source, "LOCAL_MOCK");
  assert.equal(value.requestCount, 128460);
  assert.equal(value.knownCost, 243.5);
  assert.equal(value.averageLatencyMs, 832);
});

test("dashboard unknown-cost preview does not convert unknown values to zero", () => {
  const value = projectUsageDashboardKpis({}, { injected: false, unknownMode: true });
  assert.equal(value.knownCost, null);
  assert.equal(value.totalTokens, null);
  assert.equal(value.averageCost, null);
  assert.equal(value.unknownCostCount, 8);
});

test("injected DTO only maps fields it actually supplies", () => {
  const value = projectUsageDashboardKpis({ requestCount: 10, successCount: 9, failureCount: 1, totalTokens: 250, knownCost: 2.5, unknownCostCount: 1, needVerifyCostCount: 0 }, { injected: true });
  assert.equal(value.requestCount, 10);
  assert.equal(value.successRate, 90);
  assert.equal(value.averageCost, null);
  assert.equal(value.averageLatencyMs, null);
  assert.equal(value.peakQps, null);
  assert.equal(value.savings, null);
});

test("average known cost is derived only when the candidate count is fully known", () => {
  const value = projectUsageDashboardKpis({ requestCount: 10, successCount: 10, failureCount: 0, knownCost: 2.5, unknownCostCount: 0, needVerifyCostCount: 0 }, { injected: true });
  assert.equal(value.averageCost, 0.25);
});

test("cost shares exclude unknown and malformed entries and retain explicit zero", () => {
  const result = getKnownCostShares([{ name: "A", cost: 0 }, { name: "B", cost: 3 }, { name: "C", cost: null }, { name: "D", cost: -1 }]);
  assert.deepEqual(result.map((item) => [item.name, item.share]), [["A", 0], ["B", 100]]);
  assert.deepEqual(getKnownCostShares([{ cost: null }]), []);
});
