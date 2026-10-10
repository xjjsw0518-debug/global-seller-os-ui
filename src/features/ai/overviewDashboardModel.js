const finite = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export function projectOverviewModels(page) {
  const items = Array.isArray(page?.items) ? page.items : [];
  const providers = new Map();
  for (const model of items) {
    const name = model?.provider || "UNKNOWN";
    const row = providers.get(name) ?? { name, modelCount: 0, enabledCount: 0, requestCount: 0, knownRequestCount: 0, unknownHealth: false, latencyTotal: 0, latencyCount: 0, health: "READY" };
    row.modelCount += 1;
    if (model?.enabled === true) row.enabledCount += 1;
    if (finite(model?.requestCount) !== null) { row.requestCount += model.requestCount; row.knownRequestCount += 1; }
    if (!["READY", "DEGRADED", "UNAVAILABLE"].includes(model?.healthStatus)) row.unknownHealth = true;
    if (finite(model?.averageLatencyMs) !== null) { row.latencyTotal += model.averageLatencyMs; row.latencyCount += 1; }
    if (model?.healthStatus === "DEGRADED") row.health = "DEGRADED";
    else if (model?.healthStatus === "UNAVAILABLE" && row.health === "READY") row.health = "UNAVAILABLE";
    providers.set(name, row);
  }
  return {
    providers: [...providers.values()].map(({ knownRequestCount, unknownHealth, ...row }) => ({
      ...row,
      requestCount: knownRequestCount === row.modelCount ? row.requestCount : null,
      health: row.health === "READY" && unknownHealth ? "UNKNOWN" : row.health,
      averageLatencyMs: row.latencyCount ? row.latencyTotal / row.latencyCount : null,
    })),
    models: items.slice(0, 5).map((item) => ({
      name: item?.displayName || item?.model || "UNKNOWN",
      provider: item?.provider || "UNKNOWN",
      enabled: typeof item?.enabled === "boolean" ? item.enabled : null,
      health: typeof item?.healthStatus === "string" && item.healthStatus !== "UNKNOWN" ? item.healthStatus : null,
      successRate: finite(item?.successRate),
      latencyMs: finite(item?.averageLatencyMs),
      requestCount: finite(item?.requestCount),
      quotaRemaining: finite(item?.quotaSummary?.remaining),
      quotaUsagePercent: finite(item?.quotaSummary?.total) && item.quotaSummary.total > 0 && finite(item?.quotaSummary?.used) !== null
        ? item.quotaSummary.used / item.quotaSummary.total * 100 : null,
    })),
    total: Number.isInteger(page?.total) ? page.total : items.length,
    demo: page?.demo === true,
    readMode: page?.readMode || (page?.demo ? "LOCAL_MOCK" : "UNKNOWN"),
  };
}

export function projectOverviewUsage({ summary, trends, breakdowns } = {}) {
  const value = summary?.summary ?? {};
  const trendItems = Array.isArray(trends?.items) ? trends.items : [];
  const providerRows = Array.isArray(breakdowns?.provider) ? breakdowns.provider : [];
  return {
    requestCount: finite(value.requestCount),
    successCount: finite(value.successCount),
    failureCount: finite(value.failureCount),
    totalTokens: finite(value.totalTokens),
    knownCost: finite(value.knownCost),
    unknownCostCount: finite(value.unknownCostCount),
    monthlyCost: finite(value.monthlyCost),
    monthlyUnknownCostCount: finite(value.monthlyUnknownCostCount),
    budgetStatus: typeof value.budget?.status === "string" ? value.budget.status : "UNKNOWN",
    trends: trendItems.map((item) => ({
      time: item.time,
      requestCount: finite(item.requestCount),
      inputTokens: finite(item.inputTokens),
      outputTokens: finite(item.outputTokens),
      knownCost: finite(item.knownCost),
      unknownCostCount: finite(item.unknownCostCount),
    })),
    providerCosts: providerRows.map((item) => ({ key: item.key, knownCost: finite(item.knownCost), requestCount: finite(item.requestCount) }))
      .filter((item) => item.knownCost !== null),
    connected: Boolean(summary || trends || breakdowns),
  };
}

export function formatOverviewValue(value, suffix = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value)}${suffix}`
    : "未知";
}

export function projectOverviewSuccessRate(successCount, failureCount) {
  const successful = finite(successCount);
  const failed = finite(failureCount);
  const outcomeCount = successful === null || failed === null ? null : successful + failed;
  return outcomeCount > 0 ? successful / outcomeCount * 100 : null;
}
