import test from "node:test";
import assert from "node:assert/strict";
import {
  USAGE_COST_CONTRACT_VERSION,
  USAGE_COST_ENDPOINTS,
  buildUsageCostQuery,
  mapUsageCostBreakdowns,
  mapUsageCostCsv,
  mapUsageCostDetail,
  mapUsageCostRecords,
  mapUsageCostSummary,
  mapUsageCostTrends,
} from "./usageCostReadContract.js";
import { configureAiModelOperationsReadTransport, modelQuotaAdapter } from "./modelQuotaAdapter.js";

const aggregate = (overrides = {}) => ({
  request_count: 0, attempt_count: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0,
  unknown_usage_count: 0, known_cost: 0, unknown_cost_count: 0, need_verify_cost_count: 0,
  success_count: 0, failure_count: 0, retry_count: 0, fallback_count: 0, ...overrides,
});

const record = (overrides = {}) => ({
  request_id: "req-fixture-01", provider_id: "provider-fixture-uuid", provider_name: "Fixture Provider",
  model_name: "fixture-model", request_type: "CHAT", status: "SUCCEEDED", usage_known: true,
  input_tokens: 10, output_tokens: 5, total_tokens: 15, cost_state: "KNOWN", cost: 0,
  currency: "USD", cost_source: "VERIFIED_PRICING", latency_ms: 42, worker_id: "worker-fixture-uuid",
  runtime_id: "runtime-fixture-uuid", task_id: "task-fixture-uuid", created_at: "2026-10-01T00:00:00Z",
  completed_at: "2026-10-01T00:00:00Z", error_code: "", fallback_used: false, attempts: [], ...overrides,
});

const page = (overrides = {}) => ({
  contract: USAGE_COST_CONTRACT_VERSION, page: 1, page_size: 20, total: 1, items: [record()], ...overrides,
});

test("A26 summary keeps unknown budget, cost, FX and token-package values unknown while preserving explicit zeroes", () => {
  const result = mapUsageCostSummary({
    contract: USAGE_COST_CONTRACT_VERSION,
    period: "today",
    summary: aggregate({
      total_tokens: null,
      known_cost: 0,
      unknown_cost_count: 2,
      budget: { status: "UNKNOWN", limit: null, used: 0, used_known: false, percent: null, source: "NEED_VERIFY" },
      token_package: { status: "NOT_CONFIGURED", source: "MODEL_BILLING_MODE" },
      fx: { status: "UNKNOWN", source: "NEED_VERIFY", original_currencies: [] },
    }),
  });
  assert.equal(result.summary.totalTokens, null);
  assert.equal(result.summary.knownCost, 0);
  assert.equal(result.summary.unknownCostCount, 2);
  assert.equal(result.summary.budget.limit, null);
  assert.equal(result.summary.budget.used, 0);
  assert.equal(result.summary.budget.usedKnown, false);
  assert.equal(result.summary.budget.percent, null);
  assert.equal(result.summary.fx.originalCurrencies.length, 0);
});

test("trends and breakdowns preserve aggregate zeroes, missing fields and unknown dimensions", () => {
  const trends = mapUsageCostTrends({ contract: USAGE_COST_CONTRACT_VERSION, items: [{ time: "2026-10-01", ...aggregate({ total_tokens: null, known_cost: 0 }) }] });
  assert.equal(trends.items[0].time, "2026-10-01");
  assert.equal(trends.items[0].knownCost, 0);
  assert.equal(trends.items[0].totalTokens, null);
  const breakdowns = mapUsageCostBreakdowns({
    contract: USAGE_COST_CONTRACT_VERSION,
    provider: [{ key: "UNKNOWN", ...aggregate({ known_cost: 0 }) }],
    model: [{ key: "m1", request_count: 1 }],
  });
  assert.equal(breakdowns.provider[0].key, "UNKNOWN");
  assert.equal(breakdowns.provider[0].knownCost, 0);
  assert.equal(breakdowns.model[0].totalTokens, null);
  assert.equal(breakdowns.worker, null, "absent breakdown is unknown, not an empty result");
});

test("A29 records retain unknown usage/cost and only show explicit known zero cost", () => {
  const result = mapUsageCostRecords(page({ items: [
    record({ request_id: "unknown-1", usage_known: false, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_state: "UNKNOWN", cost: 0 }),
    record({ request_id: "known-zero", cost_state: "KNOWN", cost: 0 }),
    record({ request_id: "verify-1", cost_state: "NEED_VERIFY", cost: 12.5 }),
  ], total: 3 }));
  assert.equal(result.items[0].inputTokens, null);
  assert.equal(result.items[0].totalTokens, null);
  assert.equal(result.items[0].cost, null);
  assert.equal(result.items[0].costState, "UNKNOWN");
  assert.equal(result.items[1].cost, 0);
  assert.equal(result.items[2].cost, null);
  assert.equal(result.items[2].costState, "NEED_VERIFY");
});

test("A29 pagination enforces the API page-size cap and signals the 5,000-row server window", () => {
  assert.throws(() => mapUsageCostRecords(page({ page_size: 101 })), { code: "AI_USAGE_COST_BAD_PAGINATION" });
  assert.throws(() => mapUsageCostRecords(page({ page: 0 })), { code: "AI_USAGE_COST_BAD_PAGINATION" });
  assert.throws(() => mapUsageCostRecords(page({ page_size: 1, items: [record(), record()] })), { code: "AI_USAGE_COST_BAD_PAGINATION" });
  const result = mapUsageCostRecords(page({ total: 5000, page_size: 100, items: Array.from({ length: 100 }, (_, index) => record({ request_id: `row-${index}` })) }));
  assert.equal(result.pageSize, 100);
  assert.equal(result.windowLimit, 5000);
  assert.equal(result.windowLimitReached, true);
});

test("A30 request detail preserves unknown attempt values and the request identity", () => {
  const result = mapUsageCostDetail({
    contract: USAGE_COST_CONTRACT_VERSION,
    request: record({ usage_known: false, input_tokens: null, output_tokens: null, total_tokens: null, cost_state: "NEED_VERIFY", cost: null }),
    attempts: [{ attempt_number: 1, attempt_status: "TIMEOUT", usage_known: false, input_tokens: null, output_tokens: null, total_tokens: null, cost_state: "UNKNOWN", cost: null }],
  });
  assert.equal(result.request.requestId, "req-fixture-01");
  assert.equal(result.request.totalTokens, null);
  assert.equal(result.request.cost, null);
  assert.equal(result.attempts[0].totalTokens, null);
  assert.equal(result.attempts[0].cost, null);
});

test("A31 query filters use an allowlist and A32 CSV mapping requires raw text", () => {
  assert.deepEqual(buildUsageCostQuery({ period: "30d", worker_id: "worker-1", page: 4, pageSize: 100, apiKey: "must-not-pass", date_from: new Date("2026-10-01T00:00:00Z") }), {
    period: "30d", date_from: "2026-10-01T00:00:00.000Z", worker_id: "worker-1",
  });
  assert.deepEqual(mapUsageCostCsv("request_id,cost_state\nfixture,UNKNOWN\n"), {
    csv: "request_id,cost_state\nfixture,UNKNOWN\n", source: "CANDIDATE_READ_DTO", productionVerified: false,
  });
  assert.throws(() => mapUsageCostCsv({ body: "not raw CSV" }), { code: "AI_USAGE_COST_BAD_RESPONSE" });
});

test("A31 CSV export mapping preserves RFC-style quoting, newlines, Unicode, UNKNOWN, and empty files verbatim", () => {
  const fixture = 'request_id,status,note\nreq-1,UNKNOWN,"comma, quote ""quoted"" and newline\n二次尝试 — café"\n';
  assert.deepEqual(mapUsageCostCsv(fixture), { csv: fixture, source: "CANDIDATE_READ_DTO", productionVerified: false });
  assert.deepEqual(mapUsageCostCsv(""), { csv: "", source: "CANDIDATE_READ_DTO", productionVerified: false });
  assert.match(mapUsageCostCsv(fixture).csv, /,UNKNOWN,/);
});

test("existing adapter singleton maps usage-cost endpoints through the injected GET seam only", async () => {
  const calls = [];
  configureAiModelOperationsReadTransport({
    async get(endpoint, options) {
      calls.push({ endpoint, options });
      if (endpoint === USAGE_COST_ENDPOINTS.summary) return { contract: USAGE_COST_CONTRACT_VERSION, period: "today", summary: aggregate() };
      if (endpoint === USAGE_COST_ENDPOINTS.records) return page({ page: 2, page_size: 50, total: 5000, items: [record({ cost_state: "UNKNOWN", cost: null })] });
      if (endpoint === `${USAGE_COST_ENDPOINTS.detail}123e4567-e89b-42d3-a456-426614174000`) return { contract: USAGE_COST_CONTRACT_VERSION, request: record(), attempts: [] };
      if (endpoint === USAGE_COST_ENDPOINTS.exportCsv) return "id,cost\nfixture,UNKNOWN\n";
      if (endpoint === USAGE_COST_ENDPOINTS.trends) return { contract: USAGE_COST_CONTRACT_VERSION, items: [] };
      if (endpoint === USAGE_COST_ENDPOINTS.breakdowns) return { contract: USAGE_COST_CONTRACT_VERSION };
      throw new Error("unexpected endpoint");
    },
  });
  try {
    const summary = await modelQuotaAdapter.getUsageCostSummary({ period: "today", apiKey: "must-not-pass" });
    assert.equal(summary.summary.requestCount, 0);
    assert.deepEqual(calls[0], { endpoint: USAGE_COST_ENDPOINTS.summary, options: { query: { period: "today" } } });
    const records = await modelQuotaAdapter.getUsageCostRecords({ page: 2, pageSize: 50, task_id: "task-1" });
    assert.equal(records.page, 2);
    assert.equal(records.pageSize, 50);
    assert.equal(records.items[0].cost, null);
    assert.deepEqual(calls[1].options.query, { task_id: "task-1", page: 2, page_size: 50 });
    await assert.rejects(modelQuotaAdapter.getUsageCostRecords({ pageSize: 101 }), { code: "AI_USAGE_COST_BAD_PAGINATION" });
    await assert.rejects(modelQuotaAdapter.getUsageCostRecordDetail("not-a-uuid"), { code: "AI_USAGE_COST_BAD_REQUEST_ID" });
    const detail = await modelQuotaAdapter.getUsageCostRecordDetail("123e4567-e89b-42d3-a456-426614174000");
    assert.equal(detail.request.requestId, "req-fixture-01");
    const trends = await modelQuotaAdapter.getUsageCostTrends({ period: "7d" });
    const breakdowns = await modelQuotaAdapter.getUsageCostBreakdowns({ period: "7d" });
    const csv = await modelQuotaAdapter.exportUsageCostCsv({ period: "today" });
    assert.deepEqual(trends.items, []);
    assert.equal(breakdowns.provider, null);
    assert.match(csv.csv, /^id,cost/);
    assert.deepEqual(calls[5].options, { query: { period: "today" }, responseType: "text" });
    assert.equal(calls.length, 6, "each endpoint uses one GET and invalid inputs make no call");
  } finally {
    configureAiModelOperationsReadTransport(null);
  }
});

test("usage-cost read failures identify the seam and never fall back to synthetic display data", async () => {
  configureAiModelOperationsReadTransport({ async get() { throw Object.assign(new Error("private raw response"), { code: "OFFLINE" }); } });
  try {
    await assert.rejects(modelQuotaAdapter.getUsageCostSummary(), (error) => {
      assert.equal(error.code, "OFFLINE");
      assert.equal(error.source, "INJECTED_READ_TRANSPORT");
      assert.equal(error.productionVerified, false);
      assert.doesNotMatch(error.message, /private raw response/);
      return true;
    });
  } finally {
    configureAiModelOperationsReadTransport(null);
  }
});
