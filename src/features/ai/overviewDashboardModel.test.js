import test from "node:test";
import assert from "node:assert/strict";
import { formatOverviewValue, projectOverviewModels, projectOverviewSuccessRate, projectOverviewUsage } from "./overviewDashboardModel.js";

test("Overview provider counts aggregate from adapter models without inventing usage", () => {
  const result = projectOverviewModels({ demo: true, total: 3, items: [
    { provider: "OpenAI", model: "gpt-1", enabled: true },
    { provider: "OpenAI", model: "gpt-2", enabled: false, usageSummary: { requestCount: 7 } },
    { provider: "DeepSeek", model: "ds-1", enabled: true },
  ] });
  assert.deepEqual(result.providers.map(({ name, modelCount, enabledCount, requestCount }) => ({ name, modelCount, enabledCount, requestCount })), [
    { name: "OpenAI", modelCount: 2, enabledCount: 1, requestCount: null },
    { name: "DeepSeek", modelCount: 1, enabledCount: 1, requestCount: null },
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.demo, true);
});

test("Overview health fields remain unknown when absent", () => {
  const result = projectOverviewModels({ items: [{ model: "x", provider: "p", enabled: true }] });
  assert.deepEqual(result.models[0], { name: "x", provider: "p", enabled: true, health: null, successRate: null, latencyMs: null, requestCount: null, quotaRemaining: null, quotaUsagePercent: null });
  assert.equal(result.providers[0].health, "UNKNOWN");
});

test("provider totals preserve explicit zero and reject partial unknown totals", () => {
  const zero = projectOverviewModels({ items: [{ provider: "p", requestCount: 0, healthStatus: "READY" }] });
  assert.equal(zero.providers[0].requestCount, 0);
  assert.equal(zero.providers[0].health, "READY");
  const partial = projectOverviewModels({ items: [{ provider: "p", requestCount: 7, healthStatus: "READY" }, { provider: "p" }] });
  assert.equal(partial.providers[0].requestCount, null);
  assert.equal(partial.providers[0].health, "UNKNOWN");
});

test("usage projection preserves missing/unknown cost and only maps known DTO values", () => {
  const empty = projectOverviewUsage();
  assert.equal(empty.knownCost, null);
  assert.equal(empty.unknownCostCount, null);
  const populated = projectOverviewUsage({
    summary: { summary: { requestCount: 18, successCount: 17, failureCount: 1, totalTokens: 900, knownCost: 2.4, unknownCostCount: 3, monthlyCost: null, budget: { status: "UNKNOWN" } } },
    trends: { items: [{ time: "2026-10-01", requestCount: 18, inputTokens: 600, outputTokens: 300, knownCost: 2.4, unknownCostCount: 3 }] },
    breakdowns: { provider: [{ key: "OpenAI", knownCost: 2.4, requestCount: 18 }] },
  });
  assert.equal(populated.knownCost, 2.4);
  assert.equal(populated.monthlyCost, null);
  assert.equal(populated.trends[0].knownCost, 2.4);
  assert.deepEqual(populated.providerCosts, [{ key: "OpenAI", knownCost: 2.4, requestCount: 18 }]);
});

test("overview formatter distinguishes unknown from a real zero", () => {
  assert.equal(formatOverviewValue(null), "未知");
  assert.equal(formatOverviewValue(0), "0");
  assert.equal(formatOverviewValue(1250), "1,250");
});

test("success rate uses known success and failure outcomes, not total request count", () => {
  assert.equal(projectOverviewSuccessRate(90, 10), 90);
  assert.equal(projectOverviewSuccessRate(0, 0), null);
  assert.equal(projectOverviewSuccessRate(null, 1), null);
});
