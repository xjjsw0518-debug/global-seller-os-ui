import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_MODEL_OPERATIONS_ENDPOINT,
  mapAiModelOperationPage,
} from "./modelOperationsReadContract.js";
import {
  configureAiModelOperationsReadTransport,
  getAiModelOperationsReadStatus,
  modelQuotaAdapter,
} from "./modelQuotaAdapter.js";

const validItem = (overrides = {}) => ({
  model_registry_id: "fixture-model-uuid",
  provider_id: "fixture-provider-uuid",
  provider_display_name: "Fixture Provider",
  model_id: "fixture-model-v1",
  display_name: "Fixture Model",
  enabled: true,
  credential_configured: false,
  endpoint_mode: "AUTO",
  health_status: "READY",
  health_source: "CONNECTION_TEST_STATUS",
  quota_summary: { status: "KNOWN", total: 2000, used: 10, remaining: 1990, period: "CONFIGURED", source: "CONFIGURED" },
  usage_summary: { request_count: 1, input_tokens: 3, output_tokens: 7, total_tokens: 10, known_cost_request_count: 1 },
  cost_summary: { status: "UNKNOWN", amount: null, currency: null, source: "NEED_VERIFY", unknown_request_count: 1 },
  ...overrides,
});

const validPage = (overrides = {}) => ({
  items: [validItem()], total: 1, page: 1, page_size: 20, total_pages: 1, summary: { enabled: 1, healthy: 1 },
  ...overrides,
});

test("maps paginated operation DTOs without changing server IDs or known zeroes", () => {
  const result = mapAiModelOperationPage(validPage({ items: [validItem({
    quota_summary: { status: "KNOWN", total: 0, used: 0, remaining: 0, source: "CONFIGURED" },
    usage_summary: { request_count: 0, total_tokens: 0 },
    cost_summary: { status: "KNOWN", amount: 0, currency: "USD", source: "USAGE_LEDGER" },
  })] }));
  assert.equal(result.items[0].id, "fixture-model-uuid");
  assert.equal(result.items[0].providerId, "fixture-provider-uuid");
  assert.equal(result.items[0].quotaSummary.total, 0);
  assert.equal(result.items[0].usageSummary.totalTokens, 0);
  assert.equal(result.items[0].costSummary.amount, 0);
  assert.equal(result.pageSize, 20);
  assert.deepEqual(result.summary, { enabled: 1, healthy: 1 });
  assert.equal(result.source, "SERVER_READ_PROJECTION");
});

test("missing optional summaries remain unknown or null instead of becoming zero", () => {
  const result = mapAiModelOperationPage(validPage({ items: [validItem({
    quota_summary: undefined, usage_summary: undefined, cost_summary: undefined,
  })], summary: {} }));
  assert.equal(result.items[0].quotaSummary.status, "UNKNOWN");
  assert.equal(result.items[0].quotaSummary.total, null);
  assert.equal(result.items[0].usageSummary.totalTokens, null);
  assert.equal(result.items[0].costSummary.status, "UNKNOWN");
  assert.equal(result.items[0].costSummary.amount, null);
  assert.equal(result.summary.enabled, null);
});

test("rejects malformed pagination and missing model/provider identity fields", () => {
  for (const dto of [null, [], { ...validPage(), page: 0 }, { ...validPage(), page_size: 19 }, { ...validPage(), total: -1 }]) {
    assert.throws(() => mapAiModelOperationPage(dto), { code: "AI_MODEL_OPERATIONS_BAD_RESPONSE" });
  }
  for (const field of ["model_registry_id", "provider_id", "model_id", "display_name", "provider_display_name", "enabled", "credential_configured"]) {
    const item = validItem();
    delete item[field];
    assert.throws(() => mapAiModelOperationPage(validPage({ items: [item] })), { code: "AI_MODEL_OPERATIONS_BAD_RESPONSE" }, field);
  }
});

test("list read seam is NOT_CONNECTED by default and preserves the local mock mode", async () => {
  configureAiModelOperationsReadTransport(null);
  assert.deepEqual(getAiModelOperationsReadStatus(), {
    state: "TEST_FIXTURE_ONLY", endpoint: AI_MODEL_OPERATIONS_ENDPOINT, mutationsAvailable: false, productionVerified: false,
  });
  const result = await modelQuotaAdapter.list();
  assert.equal(result.demo, true);
  assert.equal(result.items.length, result.total);
});

test("injected list seam calls only GET with pagination and leaves writes explicitly local mock", async () => {
  const calls = [];
  configureAiModelOperationsReadTransport({
    async get(endpoint, options) {
      calls.push({ endpoint, options });
      return validPage();
    },
  });
  try {
    assert.equal(getAiModelOperationsReadStatus().state, "READ_TRANSPORT_INJECTED");
    const result = await modelQuotaAdapter.list({ page: 2, pageSize: 40, search: "fixture" });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      endpoint: AI_MODEL_OPERATIONS_ENDPOINT,
      options: { query: { page: 2, page_size: 40, search: "fixture" } },
    });
    assert.equal(result.readMode, "INJECTED_READ_ONLY");
    assert.equal(result.writeMode, "LOCAL_MOCK");
    assert.equal(result.productionVerified, false);
    assert.equal(result.items[0].id, "fixture-model-uuid");
    await assert.rejects(modelQuotaAdapter.list({ page: 0 }), { code: "AI_MODEL_OPERATIONS_INVALID_PAGINATION" });
    assert.equal(calls.length, 1);
  } finally {
    configureAiModelOperationsReadTransport(null);
  }
});

test("transport errors propagate without fallback to mock fixtures", async () => {
  configureAiModelOperationsReadTransport({ async get() { throw Object.assign(new Error("fixture transport unavailable"), { code: "OFFLINE" }); } });
  try {
    await assert.rejects(modelQuotaAdapter.list(), (error) => {
      assert.equal(error.code, "OFFLINE");
      assert.equal(error.source, "INJECTED_READ_TRANSPORT");
      assert.equal(error.productionVerified, false);
      return true;
    });
  } finally {
    configureAiModelOperationsReadTransport(null);
  }
});

test("local edit, enable, archive, and restore stay mock-only beside injected server reads", async () => {
  const remoteItem = validItem();
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "" } };
  let getCount = 0;
  configureAiModelOperationsReadTransport({ async get() { getCount += 1; return validPage({ items: [remoteItem] }); } });
  try {
    const created = await modelQuotaAdapter.create({ provider: "OPENAI", model: `offline-isolation-${Date.now()}`, quota: "250", type: "OPENAI_COMPATIBLE" });
    assert.equal(created.mock, true);
    const updated = await modelQuotaAdapter.update(created.item.id, { provider: "OPENAI", model: `${created.item.model}-edited`, type: "OPENAI_COMPATIBLE", context: "unknown", quota: "250", priority: "P3" });
    assert.equal(updated.mock, true);
    const enabled = await modelQuotaAdapter.setEnabled(created.item.id, true);
    assert.equal(enabled.mock, true);
    const archived = await modelQuotaAdapter.archive(created.item.id);
    assert.equal(archived.mock, true);
    const restored = await modelQuotaAdapter.restore(created.item.id);
    assert.equal(restored.mock, true);

    const listed = await modelQuotaAdapter.list();
    assert.equal(getCount, 1, "only list may call the injected read transport");
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0].id, "fixture-model-uuid");
    assert.equal(listed.items.some((item) => item.id === created.item.id), false, "local draft must not appear in the injected server page");

    await assert.rejects(modelQuotaAdapter.update(remoteItem.model_registry_id, { model: "misleading" }), /model not found/);
    await assert.rejects(modelQuotaAdapter.setEnabled(remoteItem.model_registry_id, false), /model not found/);
    await assert.rejects(modelQuotaAdapter.archive(remoteItem.model_registry_id), /model not found/);
    assert.equal(getCount, 1, "write attempts against a server UUID must not call GET or appear successful");
  } finally {
    configureAiModelOperationsReadTransport(null);
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
