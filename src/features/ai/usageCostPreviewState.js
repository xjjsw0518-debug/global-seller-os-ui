export const USAGE_PREVIEW_PAGE_SIZE = 20;
const numberText = (value) => value == null ? "未知" : new Intl.NumberFormat("zh-CN").format(value);
const statusText = (status) => ({ SUCCESS: "成功", FAILED: "失败", ERROR: "失败", TIMEOUT: "超时", RETRIED: "重试中", RETRY_SUCCESS: "重试后成功" }[status] || status || "未知");
const costStateText = (state) => state === "UNKNOWN" ? "未知" : state === "NEED_VERIFY" ? "待核验" : state || "未知";

export function isUsageCostRequestId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function projectUsagePreviewRecord(row) {
  return {
    id: row.requestId || "UNKNOWN", time: row.createdAt || "UNKNOWN", provider: row.provider || "UNKNOWN", model: row.model || "UNKNOWN",
    worker: row.workerId || "UNKNOWN", runtime: row.runtimeId || "UNKNOWN", task: row.taskId || "UNKNOWN",
    status: statusText(row.status), input: row.inputTokens, output: row.outputTokens, tokens: row.totalTokens,
    cost: row.cost, costState: costStateText(row.costState), currency: row.currency,
    latency: row.latencyMs == null ? null : `${row.latencyMs} ms`, source: row.costSource,
    attempts: (row.attempts || []).map(projectUsagePreviewAttempt),
  };
}

const statusFilterValues = Object.freeze({
  SUCCESS: ["成功", "重试后成功", "SUCCESS", "RETRY_SUCCESS"],
  FAILED: ["失败", "超时", "FAILED", "ERROR", "TIMEOUT"],
  RETRIED: ["重试中", "RETRIED"],
  TIMEOUT: ["超时", "TIMEOUT"],
});

export function filterUsagePreviewRows(rows, filters = {}) {
  if (!Array.isArray(rows)) return [];
  const provider = typeof filters.provider === "string" ? filters.provider : "";
  const model = typeof filters.model === "string" ? filters.model.trim().toLowerCase() : "";
  const worker = typeof filters.worker === "string" ? filters.worker.trim().toLowerCase() : "";
  const runtime = typeof filters.runtime === "string" ? filters.runtime.trim().toLowerCase() : "";
  const task = typeof filters.task === "string" ? filters.task.trim().toLowerCase() : "";
  const statuses = statusFilterValues[filters.status];
  return rows.filter((row) => {
    if (provider && row.provider !== provider) return false;
    if (model && !String(row.model ?? "").toLowerCase().includes(model)) return false;
    if (worker && !String(row.worker ?? "").toLowerCase().includes(worker)) return false;
    if (runtime && !String(row.runtime ?? "").toLowerCase().includes(runtime)) return false;
    if (task && !String(row.task ?? "").toLowerCase().includes(task)) return false;
    if (statuses && !statuses.includes(row.status)) return false;
    if (filters.unknownCostsOnly === true && row.costState !== "未知") return false;
    return true;
  });
}

export function projectUsagePreviewAttempt(attempt) {
  return {
    provider: attempt.providerId || "UNKNOWN", model: attempt.model || "UNKNOWN", status: statusText(attempt.status),
    tokens: numberText(attempt.totalTokens),
    cost: attempt.costState === "KNOWN" && attempt.cost != null ? `${attempt.cost} ${attempt.currency || ""}` : costStateText(attempt.costState),
    latency: attempt.latencyMs == null ? "UNKNOWN" : `${attempt.latencyMs} ms`,
  };
}

export function projectUsagePreviewDetail(baseRecord, detail) {
  if (!detail?.request || detail.request.requestId !== baseRecord.id) throw Object.assign(new Error("Request detail identity mismatch."), { code: "AI_USAGE_COST_DETAIL_MISMATCH" });
  return { ...baseRecord, ...projectUsagePreviewRecord({ ...detail.request, attempts: detail.attempts || [] }) };
}

export function buildPreviewFilters({ period, dateFrom, dateTo, providerId, modelId, workerId, runtimeId, taskId, status, search }) {
  return Object.fromEntries(Object.entries({ period, date_from: dateFrom, date_to: dateTo, provider_id: providerId, model_id: modelId, worker_id: workerId, runtime_id: runtimeId, task_id: taskId, status, search }).filter(([, value]) => value != null && value !== ""));
}

export function projectUsagePreviewState({ summary, trends, breakdowns, records }) {
  return {
    state: records.items.length ? "ready" : "empty",
    source: "INJECTED_READ_DTO",
    total: records.total,
    page: records.page,
    pageSize: records.pageSize,
    pageCount: getUsagePreviewPageCount(records.total, records.pageSize),
    windowLimitReached: records.windowLimitReached,
    summary: summary.summary,
    budget: projectUsageBudgetSummary(summary.summary?.budget),
    trends: trends.items,
    breakdowns,
    records: records.items,
  };
}

export function getUsagePreviewPageCount(total, pageSize = USAGE_PREVIEW_PAGE_SIZE) {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(pageSize) || pageSize < 1) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampUsagePreviewPage(page, total, pageSize = USAGE_PREVIEW_PAGE_SIZE) {
  const lastPage = getUsagePreviewPageCount(total, pageSize);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, lastPage);
}

function isUtcCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function validateUsagePreviewDateRange(filters = {}) {
  if (filters.period !== "custom") return null;
  if (!isUtcCalendarDate(filters.dateFrom) || !isUtcCalendarDate(filters.dateTo)) return "AI_USAGE_COST_INVALID_UTC_DATE";
  return filters.dateFrom <= filters.dateTo ? null : "AI_USAGE_COST_REVERSED_DATE_RANGE";
}

export function projectUsageBudgetSummary(value) {
  const budget = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const knownAmount = (amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : null;
  const limit = knownAmount(budget.limit);
  const usedKnown = budget.usedKnown === true;
  const used = usedKnown ? knownAmount(budget.used) : null;
  const percent = usedKnown && typeof budget.percent === "number" && Number.isFinite(budget.percent) && budget.percent >= 0 && budget.percent <= 100
    ? budget.percent
    : null;
  return {
    status: typeof budget.status === "string" && budget.status ? budget.status : "UNKNOWN",
    limit,
    used,
    usedKnown: used != null,
    percent,
    source: typeof budget.source === "string" && budget.source ? budget.source : "UNKNOWN",
    ranking: { state: "NOT_PROVIDED", items: [] },
  };
}

export function projectUsagePreviewError(error) {
  const code = typeof error?.code === "string" ? error.code : "AI_USAGE_COST_READ_FAILED";
  return {
    state: code === "AI_USAGE_COST_READ_NOT_CONNECTED" ? "not-connected" : "error",
    code,
    source: error?.source === "NOT_CONNECTED" ? "NOT_CONNECTED" : "INJECTED_READ_TRANSPORT",
    message: code === "AI_USAGE_COST_READ_NOT_CONNECTED" ? "Usage data is not connected. Showing local preview data." : "Usage data could not be loaded. Local preview data remains available.",
  };
}

export async function loadUsagePreviewSnapshot(adapter, filters, page = 1, pageSize = USAGE_PREVIEW_PAGE_SIZE) {
  const dateError = validateUsagePreviewDateRange(filters);
  if (dateError) {
    return { state: "error", code: dateError, source: "LOCAL_FILTER_VALIDATION", message: dateError === "AI_USAGE_COST_REVERSED_DATE_RANGE" ? "The UTC date range is reversed. No usage read was sent." : "Enter valid UTC calendar dates. No usage read was sent." };
  }
  if (!adapter || typeof adapter.getUsageCostSummary !== "function") {
    return { state: "mock", source: "LOCAL_MOCK", total: null, page, pageSize, windowLimitReached: false };
  }
  try {
    const query = buildPreviewFilters(filters);
    const [summary, trends, breakdowns, records] = await Promise.all([
      adapter.getUsageCostSummary(query),
      adapter.getUsageCostTrends(query),
      adapter.getUsageCostBreakdowns(query),
      adapter.getUsageCostRecords({ ...query, page, pageSize }),
    ]);
    return projectUsagePreviewState({ summary, trends, breakdowns, records });
  } catch (error) {
    return projectUsagePreviewError(error);
  }
}
