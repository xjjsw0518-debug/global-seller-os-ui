import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { presentAiAdapterFailure } from "./aiAdapterStatus.js";
import { initialModelDraft, validateModelDraft } from "./modelDraftSchema.js";
import { modelQuotaAdapter } from "./modelQuotaAdapter.js";

test("A14 add form uses testConnection and mock outcome presentation, not draft create validation", async () => {
  const source = await readFile(new URL("./AddModelPage.jsx", import.meta.url), "utf8");
  assert.match(source, /adapter\.testConnection\(/);
  assert.doesNotMatch(source, /adapter\.validateConnection\(/);
  assert.match(source, /setTestResult\(\{ status: "TESTING", mock: true \}\)/);
  assert.match(source, /connectionTestInFlightRef\.current = false/);
  assert.match(source, /connectionTestRequestIdRef\.current \+= 1/);
  assert.match(source, /if \(requestId !== connectionTestRequestIdRef\.current\) return/);
  assert.match(source, /if \(busy\) return; if \(dirty\)/, "cancel/exit is ignored while a test request is pending");
});

test("A14 valid fixture can fail once, retry via a second testConnection call, and pass without losing fields", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: "?mockConnectionTestFailure=1" } };
  const draft = {
    ...initialModelDraft,
    providerName: "OPENAI",
    providerDisplayName: "OpenAI (SYNTHETIC)",
    providerId: "fixture-openai-0001",
    modelId: "offline-connection-retry-fixture",
    displayName: "Offline connection retry fixture",
    costLevel: "LOW",
    usageStrategy: "NORMAL",
    capabilities: [],
  };
  const before = structuredClone(draft);
  assert.equal(validateModelDraft(draft).valid, true);
  const request = {
    id: draft.providerId,
    provider: draft.providerDisplayName,
    providerId: draft.providerId,
    modelId: draft.modelId,
    endpointMode: draft.endpointMode,
    mock: true,
  };
  const calls = [];
  const testAdapter = {
    async testConnection(config) {
      calls.push(structuredClone(config));
      return modelQuotaAdapter.testConnection(config);
    },
  };
  const statuses = [];
  try {
    statuses.push("TESTING");
    const failed = await testAdapter.testConnection(request);
    statuses.push(failed.state === "SUCCESS" ? "TEST_SUCCESS" : "TEST_FAILED");
    const failure = presentAiAdapterFailure({ ...failed, code: failed.code || failed.state, mock: true });
    assert.equal(statuses.at(-1), "TEST_FAILED");
    assert.equal(failure.state, "MOCK_OPERATION_FAILURE");
    assert.equal(failure.source, "LOCAL_MOCK");
    assert.equal(failure.productionVerified, false);
    assert.equal(statuses.at(-1) === "TEST_SUCCESS", false, "failed test keeps enable gate closed");

    globalThis.window.location.search = "?mockConnectionTestSuccess=1";
    statuses.push("TESTING");
    const retried = await testAdapter.testConnection(request);
    statuses.push(retried.state === "SUCCESS" ? "TEST_SUCCESS" : "TEST_FAILED");
    assert.deepEqual(statuses, ["TESTING", "TEST_FAILED", "TESTING", "TEST_SUCCESS"]);
    assert.equal(statuses.at(-1) === "TEST_SUCCESS", true, "only successful retry opens the mock enable gate");
    assert.equal(calls.length, 2, "the retry makes a second testConnection call");
    assert.deepEqual(calls, [request, request]);
    assert.equal(Object.hasOwn(calls[0], "apiKey"), false);
    assert.deepEqual(draft, before, "connection testing leaves the completed form fields intact");
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
