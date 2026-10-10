export const USAGE_COST_CONTRACT_VERSION = "USAGE_COST_DATA_API_CONTRACT_V1";
export const USAGE_COST_ENDPOINTS = Object.freeze({
  summary: "/api/v1/ai-usage-cost/summary",
  trends: "/api/v1/ai-usage-cost/trends",
  breakdowns: "/api/v1/ai-usage-cost/breakdowns",
  records: "/api/v1/ai-usage-cost/records",
  detail: "/api/v1/ai-usage-cost/records/",
  exportCsv: "/api/v1/ai-usage-cost/export.csv",
});
export const USAGE_COST_PAGE_SIZE_DEFAULT = 20;
export const USAGE_COST_PAGE_SIZE_MAX = 100;
export const USAGE_COST_RECORD_WINDOW_MAX = 5000;

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonNegativeNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const optionalText = (value) => typeof value === "string" ? value : null;
const contractError = (message, code = "AI_USAGE_COST_BAD_RESPONSE") => Object.assign(new Error(message), { code });

export function buildUsageCostQuery(filters = {}) {
  const allowed = ["period", "date_from", "date_to", "provider_id", "model_id", "worker_id", "runtime_id", "task_id", "status", "search"];
  const query = {};
  for (const key of allowed) {
    const value = filters[key];
    if (value == null || value === "") continue;
    query[key] = value instanceof Date ? value.toISOString() : String(value);
  }
  return query;
}

function validateEnvelope(dto, description) {
  if (!isRecord(dto) || dto.contract !== USAGE_COST_CONTRACT_VERSION) {
    throw contractError(`Invalid ${description} response contract.`);
  }
}

export function mapUsageCostAggregate(value) {
  if (!isRecord(value)) throw contractError("Invalid usage-cost aggregate row.");
  return {
    requestCount: nonNegativeNumber(value.request_count),
    attemptCount: nonNegativeNumber(value.attempt_count),
    inputTokens: nonNegativeNumber(value.input_tokens),
    outputTokens: nonNegativeNumber(value.output_tokens),
    totalTokens: nonNegativeNumber(value.total_tokens),
    unknownUsageCount: nonNegativeNumber(value.unknown_usage_count),
    knownCost: nonNegativeNumber(value.known_cost),
    unknownCostCount: nonNegativeNumber(value.unknown_cost_count),
    needVerifyCostCount: nonNegativeNumber(value.need_verify_cost_count),
    successCount: nonNegativeNumber(value.success_count),
    failureCount: nonNegativeNumber(value.failure_count),
    retryCount: nonNegativeNumber(value.retry_count),
    fallbackCount: nonNegativeNumber(value.fallback_count),
  };
}

export function mapUsageCostSummary(dto) {
  validateEnvelope(dto, "summary");
  if (!isRecord(dto.summary)) throw contractError("Usage-cost summary is missing.");
  const raw = dto.summary;
  const budget = isRecord(raw.budget) ? raw.budget : {};
  const tokenPackage = isRecord(raw.token_package) ? raw.token_package : {};
  const fx = isRecord(raw.fx) ? raw.fx : {};
  const currencies = Array.isArray(fx.original_currencies) ? fx.original_currencies.filter((item) => typeof item === "string") : null;
  return {
    contract: USAGE_COST_CONTRACT_VERSION,
    period: optionalText(dto.period) ?? "UNKNOWN",
    summary: {
      ...mapUsageCostAggregate(raw),
      monthlyCost: nonNegativeNumber(raw.monthly_cost),
      monthlyUnknownCostCount: nonNegativeNumber(raw.monthly_unknown_cost_count),
      monthlyNeedVerifyCostCount: nonNegativeNumber(raw.monthly_need_verify_cost_count),
      budget: {
        status: optionalText(budget.status) ?? "UNKNOWN",
        limit: nonNegativeNumber(budget.limit),
        used: nonNegativeNumber(budget.used),
        usedKnown: typeof budget.used_known === "boolean" ? budget.used_known : null,
        percent: nonNegativeNumber(budget.percent),
        source: optionalText(budget.source) ?? "UNKNOWN",
      },
      tokenPackage: { status: optionalText(tokenPackage.status) ?? "UNKNOWN", source: optionalText(tokenPackage.source) ?? "UNKNOWN" },
      fx: { status: optionalText(fx.status) ?? "UNKNOWN", source: optionalText(fx.source) ?? "UNKNOWN", originalCurrencies: currencies },
    },
    source: "CANDIDATE_READ_DTO",
  };
}

export function mapUsageCostTrends(dto) {
  validateEnvelope(dto, "trends");
  if (!Array.isArray(dto.items)) throw contractError("Usage-cost trends items are missing.");
  return {
    contract: USAGE_COST_CONTRACT_VERSION,
    items: dto.items.map((item) => ({ time: optionalText(item?.time) ?? "UNKNOWN", ...mapUsageCostAggregate(item), usedAmount: nonNegativeNumber(item?.used_amount), totalQuota: nonNegativeNumber(item?.total_quota) })),
    source: "CANDIDATE_READ_DTO",
  };
}

const breakdownKeys = Object.freeze({ provider: "provider", model: "model", worker: "worker", runtime: "runtime", task: "task" });
export function mapUsageCostBreakdowns(dto) {
  validateEnvelope(dto, "breakdowns");
  const result = { contract: USAGE_COST_CONTRACT_VERSION, source: "CANDIDATE_READ_DTO" };
  for (const key of Object.keys(breakdownKeys)) {
    const rows = dto[key];
    result[key] = Array.isArray(rows)
      ? rows.map((row) => ({ key: optionalText(row?.key) ?? "UNKNOWN", ...mapUsageCostAggregate(row) }))
      : null;
  }
  return result;
}

function mapAttempt(item) {
  if (!isRecord(item)) throw contractError("Invalid usage-cost attempt row.");
  const usageKnown = typeof item.usage_known === "boolean" ? item.usage_known : null;
  const costState = ["KNOWN", "UNKNOWN", "NEED_VERIFY"].includes(item.cost_state) ? item.cost_state : "UNKNOWN";
  return {
    attemptNumber: nonNegativeNumber(item.attempt_number),
    providerId: optionalText(item.provider_id),
    model: optionalText(item.model_name) ?? "UNKNOWN",
    status: optionalText(item.status) ?? "UNKNOWN",
    usageKnown,
    inputTokens: usageKnown === false ? null : nonNegativeNumber(item.input_tokens),
    outputTokens: usageKnown === false ? null : nonNegativeNumber(item.output_tokens),
    totalTokens: usageKnown === false ? null : nonNegativeNumber(item.total_tokens),
    costState,
    cost: costState === "KNOWN" ? nonNegativeNumber(item.cost) : null,
    currency: optionalText(item.currency),
    latencyMs: nonNegativeNumber(item.latency_ms),
    fallback: typeof item.fallback === "boolean" ? item.fallback : null,
    errorCode: optionalText(item.error_code),
  };
}

export function mapUsageCostRecord(item) {
  if (!isRecord(item)) throw contractError("Invalid usage-cost record.");
  const usageKnown = typeof item.usage_known === "boolean" ? item.usage_known : null;
  const costState = ["KNOWN", "UNKNOWN", "NEED_VERIFY"].includes(item.cost_state) ? item.cost_state : "UNKNOWN";
  return {
    requestId: optionalText(item.request_id),
    providerId: optionalText(item.provider_id),
    provider: optionalText(item.provider_name) ?? "UNKNOWN",
    model: optionalText(item.model_name) ?? "UNKNOWN",
    requestType: optionalText(item.request_type) ?? "UNKNOWN",
    status: optionalText(item.status) ?? "UNKNOWN",
    usageKnown,
    inputTokens: usageKnown === false ? null : nonNegativeNumber(item.input_tokens),
    outputTokens: usageKnown === false ? null : nonNegativeNumber(item.output_tokens),
    totalTokens: usageKnown === false ? null : nonNegativeNumber(item.total_tokens),
    costState,
    cost: costState === "KNOWN" ? nonNegativeNumber(item.cost) : null,
    currency: optionalText(item.currency),
    costSource: optionalText(item.cost_source) ?? "UNKNOWN",
    latencyMs: nonNegativeNumber(item.latency_ms),
    workerId: optionalText(item.worker_id),
    runtimeId: optionalText(item.runtime_id),
    taskId: optionalText(item.task_id),
    createdAt: optionalText(item.created_at),
    completedAt: optionalText(item.completed_at),
    errorCode: optionalText(item.error_code),
    fallbackUsed: typeof item.fallback_used === "boolean" ? item.fallback_used : null,
    attempts: Array.isArray(item.attempts) ? item.attempts.map(mapAttempt) : null,
  };
}

export function mapUsageCostRecords(dto) {
  validateEnvelope(dto, "records");
  const page = dto.page;
  const pageSize = dto.page_size;
  const total = dto.total;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > USAGE_COST_PAGE_SIZE_MAX
    || !Number.isInteger(total) || total < 0 || !Array.isArray(dto.items) || dto.items.length > pageSize) {
    throw contractError("Usage-cost records pagination is missing or outside the supported bounds.", "AI_USAGE_COST_BAD_PAGINATION");
  }
  return {
    contract: USAGE_COST_CONTRACT_VERSION,
    page,
    pageSize,
    total,
    windowLimit: USAGE_COST_RECORD_WINDOW_MAX,
    windowLimitReached: total >= USAGE_COST_RECORD_WINDOW_MAX,
    items: dto.items.map(mapUsageCostRecord),
    source: "CANDIDATE_READ_DTO",
  };
}

export function mapUsageCostDetail(dto) {
  validateEnvelope(dto, "record detail");
  if (!isRecord(dto.request)) throw contractError("Usage-cost request detail is missing.");
  return {
    contract: USAGE_COST_CONTRACT_VERSION,
    request: mapUsageCostRecord(dto.request),
    attempts: Array.isArray(dto.attempts) ? dto.attempts.map(mapAttempt) : null,
    source: "CANDIDATE_READ_DTO",
  };
}

export function mapUsageCostCsv(value) {
  if (typeof value !== "string") throw contractError("Usage-cost CSV response must be text.");
  return { csv: value, source: "CANDIDATE_READ_DTO", productionVerified: false };
}
