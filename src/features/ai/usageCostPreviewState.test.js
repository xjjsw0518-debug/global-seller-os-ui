import test from "node:test";
import assert from "node:assert/strict";
import { buildPreviewFilters, clampUsagePreviewPage, filterUsagePreviewRows, isUsageCostRequestId, loadUsagePreviewSnapshot, projectUsageBudgetSummary, projectUsagePreviewDetail, projectUsagePreviewError, projectUsagePreviewRecord, projectUsagePreviewState, validateUsagePreviewDateRange } from "./usageCostPreviewState.js";

const summary = { summary: { requestCount: 0, successCount: null, failureCount: 0, totalTokens: null, knownCost: null, unknownCostCount: 2 } };
const trends = { items: [{ time: "2026-10-01T00:00:00Z", knownCost: 0 }] };
const breakdowns = { provider: [{ key: "UNKNOWN", knownCost: null, requestCount: 2 }] };
const records = { page: 2, pageSize: 20, total: 21, windowLimitReached: false, items: [{ requestId: "req-2", provider: "UNKNOWN", model: "UNKNOWN", status: "UNKNOWN", usageKnown: false, inputTokens: null, outputTokens: null, totalTokens: null, costState: "NEED_VERIFY", cost: null }] };

test("status filtering is stable across rerenders and clearing retains unknown values", () => {
  const rows = [
    { id: "success", provider: "OpenAI", model: "gpt-4o", worker: "worker-a", runtime: "runtime-a", task: "task-a", status: "成功", costState: "未知", cost: null },
    { id: "retry", provider: "OpenAI", model: "gpt-4o-mini", worker: "worker-b", runtime: "runtime-b", task: "task-b", status: "重试后成功", costState: "已知", cost: 0 },
    { id: "timeout", provider: "DeepSeek", model: "deepseek-chat", worker: "worker-c", runtime: "runtime-c", task: "task-c", status: "超时", costState: "未知", cost: null },
  ];
  const selected = filterUsagePreviewRows(rows, { status: "SUCCESS" });
  assert.deepEqual(selected.map((row) => row.id), ["success", "retry"]);
  assert.deepEqual(filterUsagePreviewRows(selected, { status: "SUCCESS" }), selected);
  assert.deepEqual(filterUsagePreviewRows(rows, { status: "FAILED" }).map((row) => row.id), ["timeout"]);
  assert.deepEqual(filterUsagePreviewRows(rows, {}).map((row) => row.id), ["success", "retry", "timeout"]);
  assert.deepEqual(filterUsagePreviewRows(rows, { unknownCostsOnly: true }).map((row) => row.id), ["success", "timeout"]);
  assert.equal(filterUsagePreviewRows(rows, { status: "SUCCESS" })[0].cost, null);
  assert.deepEqual(buildPreviewFilters({ period: "30d", status: "SUCCESS" }), { period: "30d", status: "SUCCESS" });
  assert.deepEqual(buildPreviewFilters({ period: "30d", status: "" }), { period: "30d" });
});

test("preview consumes summary, trends, breakdown and records DTOs without coercing unknowns", async () => {
  const queries = [];
  const adapter = Object.fromEntries([
    ["getUsageCostSummary", async (query) => { queries.push(["summary", query]); return summary; }],
    ["getUsageCostTrends", async (query) => { queries.push(["trends", query]); return trends; }],
    ["getUsageCostBreakdowns", async (query) => { queries.push(["breakdowns", query]); return breakdowns; }],
    ["getUsageCostRecords", async (query) => { queries.push(["records", query]); return records; }],
  ]);
  const result = await loadUsagePreviewSnapshot(adapter, { period: "30d", workerId: "worker-1", providerId: "" }, 2, 20);
  assert.equal(result.state, "ready");
  assert.equal(result.source, "INJECTED_READ_DTO");
  assert.equal(result.summary.requestCount, 0);
  assert.equal(result.summary.knownCost, null);
  assert.equal(result.records[0].usageKnown, false);
  assert.equal(result.records[0].totalTokens, null);
  assert.equal(result.records[0].costState, "NEED_VERIFY");
  assert.deepEqual(queries.find(([name]) => name === "records")[1], { period: "30d", worker_id: "worker-1", page: 2, pageSize: 20 });
});

test("preview state distinguishes an empty result from disconnected and failed reads", async () => {
  const empty = await loadUsagePreviewSnapshot({
    getUsageCostSummary: async () => ({ summary: {} }),
    getUsageCostTrends: async () => ({ items: [] }),
    getUsageCostBreakdowns: async () => ({}),
    getUsageCostRecords: async () => ({ page: 1, pageSize: 20, total: 0, windowLimitReached: false, items: [] }),
  }, {}, 1, 20);
  assert.equal(empty.state, "empty");
  assert.equal(empty.total, 0);
  assert.equal(projectUsagePreviewError({ code: "AI_USAGE_COST_READ_NOT_CONNECTED", source: "NOT_CONNECTED" }).state, "not-connected");
  assert.equal(projectUsagePreviewError({ code: "READ_FAILED" }).state, "error");
});

test("custom date filters validate UTC calendar boundaries and preserve date-only values", () => {
  assert.equal(validateUsagePreviewDateRange({ period: "custom", dateFrom: "2026-03-08", dateTo: "2026-03-08" }), null);
  assert.equal(validateUsagePreviewDateRange({ period: "custom", dateFrom: "2024-02-29", dateTo: "2024-03-01" }), null);
  assert.equal(validateUsagePreviewDateRange({ period: "custom", dateFrom: "2026-02-30", dateTo: "2026-03-01" }), "AI_USAGE_COST_INVALID_UTC_DATE");
  assert.equal(validateUsagePreviewDateRange({ period: "custom", dateFrom: "2026-02-29", dateTo: "2026-03-01" }), "AI_USAGE_COST_INVALID_UTC_DATE");
  assert.equal(validateUsagePreviewDateRange({ period: "custom", dateFrom: "2026-10-02", dateTo: "2026-10-01" }), "AI_USAGE_COST_REVERSED_DATE_RANGE");
  assert.equal(validateUsagePreviewDateRange({ period: "30d", dateFrom: "invalid", dateTo: "invalid" }), null);
  assert.deepEqual(buildPreviewFilters({ period: "custom", dateFrom: "2026-03-08", dateTo: "2026-03-08" }), { period: "custom", date_from: "2026-03-08", date_to: "2026-03-08" });
});

test("invalid and reversed custom ranges do not call the read adapter", async () => {
  let calls = 0;
  const adapter = Object.fromEntries(["getUsageCostSummary", "getUsageCostTrends", "getUsageCostBreakdowns", "getUsageCostRecords"].map((name) => [name, async () => { calls += 1; return {}; }]));
  const invalid = await loadUsagePreviewSnapshot(adapter, { period: "custom", dateFrom: "2026-02-30", dateTo: "2026-03-01" });
  const reversed = await loadUsagePreviewSnapshot(adapter, { period: "custom", dateFrom: "2026-10-02", dateTo: "2026-10-01" });
  assert.equal(invalid.source, "LOCAL_FILTER_VALIDATION");
  assert.equal(invalid.code, "AI_USAGE_COST_INVALID_UTC_DATE");
  assert.equal(reversed.code, "AI_USAGE_COST_REVERSED_DATE_RANGE");
  assert.equal(calls, 0);
});

test("pagination clamps a page when an updated total shrinks the available range", () => {
  assert.equal(clampUsagePreviewPage(3, 41, 20), 3);
  assert.equal(clampUsagePreviewPage(2, 3, 20), 1);
  assert.equal(clampUsagePreviewPage(2, 0, 20), 1);
  assert.equal(clampUsagePreviewPage(0, 21, 20), 1);
});

test("budget summary displays only explicit known values and never invents ranking rows", () => {
  const knownZero = projectUsageBudgetSummary({ status: "KNOWN", limit: 0, used: 0, usedKnown: true, percent: 0, source: "CONFIGURED" });
  assert.deepEqual({ limit: knownZero.limit, used: knownZero.used, usedKnown: knownZero.usedKnown, percent: knownZero.percent }, { limit: 0, used: 0, usedKnown: true, percent: 0 });
  assert.deepEqual(knownZero.ranking, { state: "NOT_PROVIDED", items: [] });
  const unverified = projectUsageBudgetSummary({ status: "UNKNOWN", limit: 900, used: 10, usedKnown: false, percent: 1, source: "UNKNOWN" });
  assert.equal(unverified.limit, 900);
  assert.equal(unverified.used, null);
  assert.equal(unverified.percent, null);
  assert.equal(unverified.usedKnown, false);
  const missing = projectUsageBudgetSummary(null);
  assert.equal(missing.limit, null);
  assert.equal(missing.used, null);
  assert.deepEqual(missing.ranking.items, []);
});

test("read snapshot exposes aggregate budget but declares entity ranking unavailable", () => {
  const result = projectUsagePreviewState({
    summary: { summary: { budget: { status: "KNOWN", limit: 100, used: 25, usedKnown: true, percent: 25, source: "CONFIGURED" } } },
    trends: { items: [] }, breakdowns: { provider: [] }, records: { items: [], total: 0, page: 1, pageSize: 20, windowLimitReached: false },
  });
  assert.deepEqual(result.budget, { status: "KNOWN", limit: 100, used: 25, usedKnown: true, percent: 25, source: "CONFIGURED", ranking: { state: "NOT_PROVIDED", items: [] } });
});

test("preview keeps local mock mode when no read adapter is supplied", async () => {
  const result = await loadUsagePreviewSnapshot(null, {}, 1, 20);
  assert.equal(result.state, "mock");
  assert.equal(result.source, "LOCAL_MOCK");
});

test("A30 detail projection keeps matching identity and presents unknown attempt values safely", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(isUsageCostRequestId(id), true);
  assert.equal(isUsageCostRequestId("req_local_demo"), false);
  const base = projectUsagePreviewRecord({ requestId: id, provider: "Fixture", model: "fixture", status: "SUCCESS", costState: "UNKNOWN", attempts: [] });
  const detail = projectUsagePreviewDetail(base, {
    request: { requestId: id, provider: "Fixture", model: "fixture", status: "SUCCESS", usageKnown: false, costState: "UNKNOWN" },
    attempts: [{ providerId: null, model: "fixture", status: "FAILED", usageKnown: false, totalTokens: null, costState: "NEED_VERIFY", cost: null, latencyMs: null }],
  });
  assert.equal(detail.id, id);
  assert.equal(detail.attempts[0].status, "失败");
  assert.equal(detail.attempts[0].tokens, "未知");
  assert.equal(detail.attempts[0].cost, "待核验");
  assert.equal(detail.attempts[0].latency, "UNKNOWN");
  assert.throws(() => projectUsagePreviewDetail(base, { request: { requestId: "other" } }), { code: "AI_USAGE_COST_DETAIL_MISMATCH" });
});
