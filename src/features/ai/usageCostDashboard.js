export const USAGE_COST_DASHBOARD_FIXTURE = Object.freeze({
  summary: Object.freeze({ requestCount: 128460, successCount: 127320, failureCount: 1140, totalTokens: 892500, knownCost: 243.5, unknownCostCount: 37, averageCost: 0.0019, averageLatencyMs: 832, peakQps: 120, savings: 48.2 }),
  providerCosts: Object.freeze([
    { name: "OpenAI", cost: 76, requests: 31240, color: "#168df2" },
    { name: "Anthropic", cost: 59.9, requests: 26810, color: "#14c99a" },
    { name: "Google", cost: 45, requests: 20970, color: "#f6a93c" },
    { name: "DeepSeek", cost: 39.2, requests: 18420, color: "#8665fa" },
    { name: "Others", cost: 23.4, requests: 11020, color: "#96a9bd" },
  ]),
  modelCosts: Object.freeze([
    { name: "deepseek-chat", cost: 69.5, share: 28.6, color: "#1598ef" },
    { name: "gpt-4o-mini", cost: 54.3, share: 22.3, color: "#15c79a" },
    { name: "gpt-4o", cost: 45, share: 18.5, color: "#8c62f4" },
    { name: "llama3.1:8b", cost: 29.5, share: 12.1, color: "#f5a637" },
    { name: "deepseek-coder", cost: 21, share: 8.7, color: "#ef5b6e" },
    { name: "Others", cost: 24.2, share: 9.8, color: "#9aaec2" },
  ]),
  modelTypes: Object.freeze([
    { name: "RPA Planner", share: 35.2, color: "#168df2" },
    { name: "RPA Worker", share: 28.1, color: "#14c99a" },
    { name: "Chat Assistant", share: 18.3, color: "#f6a93c" },
    { name: "Data Analysis", share: 10.5, color: "#8665fa" },
    { name: "Others", share: 7.9, color: "#96a9bd" },
  ]),
  trend: Object.freeze([
    { time: "12-01", requestCount: 18200, inputTokens: 15100, outputTokens: 5100, knownCost: 10 },
    { time: "12-04", requestCount: 21800, inputTokens: 20700, outputTokens: 9700, knownCost: 11 },
    { time: "12-07", requestCount: 20100, inputTokens: 26600, outputTokens: 8900, knownCost: 12 },
    { time: "12-10", requestCount: 23200, inputTokens: 22400, outputTokens: 11300, knownCost: 15 },
    { time: "12-13", requestCount: 18400, inputTokens: 27600, outputTokens: 8200, knownCost: 12 },
    { time: "12-16", requestCount: 24800, inputTokens: 21100, outputTokens: 9400, knownCost: 10 },
    { time: "12-19", requestCount: 19200, inputTokens: 24700, outputTokens: 10800, knownCost: 12 },
    { time: "12-22", requestCount: 26800, inputTokens: 22900, outputTokens: 7600, knownCost: 15 },
    { time: "12-25", requestCount: 23100, inputTokens: 27800, outputTokens: 10400, knownCost: 13 },
    { time: "12-28", requestCount: 30200, inputTokens: 21300, outputTokens: 8700, knownCost: 16 },
    { time: "12-31", requestCount: 32700, inputTokens: 31200, outputTokens: 12100, knownCost: 15 },
  ]),
  hourlyHeat: Object.freeze([
    [1,1,1,1,1,2,2,3,3,4,3,2], [1,1,1,1,2,2,3,3,4,4,3,2], [1,1,1,2,2,3,3,4,4,3,3,2],
    [1,1,2,2,3,3,4,4,3,3,2,2], [1,1,1,2,2,3,4,4,4,3,2,2], [1,1,1,1,2,2,3,3,3,2,2,1],
    [1,1,1,1,1,2,2,2,2,2,1,1],
  ]),
  budget: Object.freeze({ limit: 500, used: 243.5, remaining: 256.5, estimate: 468.2 }),
  alerts: Object.freeze([
    { model: "DeepSeek", text: "模型成本较上周上升 65%", time: "今天 14:23", level: "高" },
    { model: "GPT-4o", text: "单次调用成本异常", time: "今天 11:06", level: "中" },
  ]),
});

const nonNegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export function projectUsageDashboardKpis(summary = {}, { injected = false, unknownMode = false } = {}) {
  if (!injected) {
    if (unknownMode) return {
      requestCount: 8, successCount: null, failureCount: null, totalTokens: null, knownCost: null,
      unknownCostCount: 8, averageCost: null, averageLatencyMs: null, peakQps: null, savings: null,
      successRate: null, source: "LOCAL_MOCK",
    };
    return { ...USAGE_COST_DASHBOARD_FIXTURE.summary, successRate: 99.1, source: "LOCAL_MOCK" };
  }
  const requestCount = nonNegative(summary.requestCount);
  const successCount = nonNegative(summary.successCount);
  const failureCount = nonNegative(summary.failureCount);
  const knownCost = nonNegative(summary.knownCost);
  const unknownCostCount = nonNegative(summary.unknownCostCount);
  const needVerifyCostCount = nonNegative(summary.needVerifyCostCount);
  const settledRequestCount = requestCount != null && unknownCostCount != null && needVerifyCostCount != null
    ? requestCount - unknownCostCount - needVerifyCostCount
    : null;
  const fullyKnownCost = unknownCostCount === 0 && needVerifyCostCount === 0;
  const averageCost = fullyKnownCost && settledRequestCount > 0 && knownCost != null ? knownCost / settledRequestCount : null;
  const outcomeCount = successCount == null || failureCount == null ? null : successCount + failureCount;
  return {
    requestCount, successCount, failureCount, totalTokens: nonNegative(summary.totalTokens), knownCost,
    unknownCostCount, averageCost, averageLatencyMs: null, peakQps: null, savings: null,
    successRate: outcomeCount > 0 ? successCount / outcomeCount * 100 : null,
    source: "INJECTED_READ_DTO",
  };
}

export function getKnownCostShares(items = []) {
  const known = items.filter((item) => typeof item?.cost === "number" && Number.isFinite(item.cost) && item.cost >= 0);
  const total = known.reduce((sum, item) => sum + item.cost, 0);
  if (total <= 0) return [];
  return known.map((item) => ({ ...item, share: item.cost / total * 100 }));
}
